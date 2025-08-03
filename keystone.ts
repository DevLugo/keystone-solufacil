// Welcome to Keystone!
//
// This file is what Keystone uses as the entry-point to your headless backend
//
// Keystone imports the default export of this file, expecting a Keystone configuration object
//   you can find out more at https://keystonejs.com/docs/apis/config

import { config } from '@keystone-6/core'
import { PrismaClient } from '@prisma/client';

// to keep this file tidy, we define our schema in a different file
import { lists } from './schema'

// authentication is configured separately here too, but you might move this elsewhere
// when you write your list-level access control functions, as they typically rely on session data
import { withAuth, session } from './auth'
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { extendGraphqlSchema } from './graphql/extendGraphqlSchema';

// Declare global types
declare global {
  var prisma: PrismaClient | undefined;
}

// Load environment variables from .env file
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Error: Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('\n💡 Please set these variables in your .env file or deployment environment');
  process.exit(1);
}

// Validate DATABASE_URL format for PostgreSQL
if (!process.env.DATABASE_URL?.startsWith('postgresql://') && !process.env.DATABASE_URL?.startsWith('postgres://')) {
  console.error('❌ Error: DATABASE_URL must be a valid PostgreSQL connection string');
  console.error('   Example: postgresql://username:password@hostname:5432/database_name');
  process.exit(1);
}

console.log('✅ Environment variables validated successfully');
console.log(`🚀 Starting Keystone in ${process.env.NODE_ENV || 'development'} mode`);

const app = express();

// Initialize Prisma client with proper typing
let prisma: PrismaClient;

if (typeof global.prisma === 'undefined') {
  global.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  });
}

prisma = global.prisma;
export { prisma };

export default withAuth(
  config({
    db: {
      provider: 'postgresql',
      url: process.env.DATABASE_URL,
      shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
      enableLogging: process.env.NODE_ENV === 'development',
    },
    lists,
    graphql: {
      extendGraphqlSchema,
    },
    ui: {
      isAccessAllowed: ({ session }) => !!session,
    },
    session,
    server: {
      extendExpressApp: (app) => {
                (app as any).get('/generate-pdf', async (req: Request, res: Response) => {
          try {
            const { localityId, routeId, localityName, routeName, leaderName, leaderId } = req.query;

            // Validación de parámetros
            if (!localityId || !routeId || !localityName || !routeName) {
              return res.status(400).json({ 
                error: 'Faltan parámetros requeridos: localityId, routeId, localityName, routeName' 
              });
            }

            // Inicializar Prisma client
            const prisma = globalThis.prisma || new PrismaClient();
            if (!globalThis.prisma) {
              globalThis.prisma = prisma;
            }

            // Calcular rango de fechas semanal
            const currentDate = new Date();
            const weekStart = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 1));
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            // Obtener préstamos activos
            const activeLoans = await prisma.loan.findMany({
              where: {
                AND: [
                  { finishedDate: null },
                  { badDebtDate: null },
                  leaderId ? { leadId: leaderId as string } : {}
                ]
              },
              include: {
                borrower: {
                  include: {
                    personalData: {
                      include: {
                        phones: true,
                        addresses: {
                          include: {
                            location: true
                          }
                        }
                      }
                    }
                  }
                },
                loantype: true,
                lead: {
                  include: {
                    personalData: true
                  }
                }
              },
              orderBy: {
                signDate: 'asc'
              }
            });

            // Procesar datos para el PDF
            const formatCurrency = (amount: number | string) => {
              const num = typeof amount === 'string' ? parseFloat(amount) : amount;
              return new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(num || 0).replace('MX$', '$');
            };

            const formatDate = (dateString: string | null) => {
              if (!dateString) return '';
              const date = new Date(dateString);
              return date.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
            };

            const calculateWeekNumber = (signDate: string, weekDuration: number) => {
              const sign = new Date(signDate);
              const now = new Date();
              const diffTime = Math.abs(now.getTime() - sign.getTime());
              const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
              return Math.min(diffWeeks, weekDuration);
            };

            // Generar registros de pago
            const payments = activeLoans.map((loan: any) => {
              const phone = loan.borrower?.personalData?.phones?.[0]?.number || '';
               
              let weeklyPaymentAmount = 0;
              if (loan.loantype && loan.loantype.weekDuration && loan.loantype.weekDuration > 0) {
                const rate = loan.loantype.rate ? parseFloat(loan.loantype.rate.toString()) : 0;
                const totalAmountToPay = parseFloat(loan.requestedAmount.toString()) * (1 + rate);
                weeklyPaymentAmount = totalAmountToPay / loan.loantype.weekDuration;
              }
               
              const weekNumber = calculateWeekNumber(loan.signDate, loan.loantype?.weekDuration || 1);
               
              return {
                name: loan.borrower?.personalData?.fullName || '',
                phone: phone,
                abono: formatCurrency(loan.amountGived || 0),
                adeudo: formatCurrency(loan.pendingAmount || 0),
                plazos: (loan.loantype?.weekDuration || 0).toString(),
                pagoVdo: '$0',
                cobroSemana: formatCurrency(weeklyPaymentAmount),
                abonoParcial: '$0',
                fInicio: formatDate(loan.signDate),
                nSemana: weekNumber.toString(),
                aval: loan.avalName || ''
              };
            });

            // Calcular estadísticas
            const totalClientes = payments.length;
            const totalCobranzaEsperada = activeLoans.reduce((sum, loan) => {
              let weeklyPaymentAmount = 0;
              if (loan.loantype && loan.loantype.weekDuration && loan.loantype.weekDuration > 0) {
                const rate = loan.loantype.rate ? parseFloat(loan.loantype.rate.toString()) : 0;
                const totalAmountToPay = parseFloat(loan.requestedAmount.toString()) * (1 + rate);
                weeklyPaymentAmount = totalAmountToPay / loan.loantype.weekDuration;
              }
              return sum + weeklyPaymentAmount;
            }, 0);
             
            const comisionPorcentaje = 0.08;
            const totalComisionEsperada = totalCobranzaEsperada * comisionPorcentaje;

            // Crear PDF con diseño de keystone2.ts
            const doc = new PDFDocument({ margin: 30 });
            const filename = `listado_cobranza_${(localityName as string).replace(/\s+/g, '_')}.pdf`;
             
            res.setHeader('Content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.setHeader('Content-type', 'application/pdf');
            doc.pipe(res);

            // Generar fecha semanal
            const weekRange = `${weekStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} al ${weekEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`;

            // Header elements (diseño de keystone2.ts)
            const headerY = 25;
            doc.fontSize(14).text(routeName as string, 30, headerY, { align: 'left', baseline: 'middle' });
            doc.fontSize(14).text('Listado de Cobranza', 0, headerY, { align: 'center', baseline: 'middle' });
            doc.image('./solufacil.png', 450, 10, { width: 100 });

            const subtitleY = headerY + 20;
            doc.fontSize(10).text(`Semanal del ${weekRange}`, 0, subtitleY, { align: 'center', baseline: 'middle' });

            const detailsY = subtitleY + 30;
            doc.fontSize(8).fillColor('gray').text('Localidad:', 30, detailsY, { align: 'left', baseline: 'middle' });
            doc.fontSize(8).fillColor('black').text(localityName as string, 100, detailsY, { align: 'left', baseline: 'middle' });
            doc.fontSize(8).fillColor('gray').text('Lider:', 400, detailsY, { align: 'left', baseline: 'middle' });
            doc.fontSize(8).fillColor('black').text((leaderName as string) || 'Sin asignar', 450, detailsY, { align: 'left', baseline: 'middle' });

            const additionalDetailsY = detailsY + 20;
            doc.fontSize(8).fillColor('black').text(`Total de clientes: ${totalClientes}`, 30, additionalDetailsY, { align: 'left' });
            doc.text(`Comisión a pagar al líder: ${formatCurrency(totalComisionEsperada)}`, 30, additionalDetailsY + 15, { align: 'left' });
            doc.text(`Total de cobranza esperada: ${formatCurrency(totalCobranzaEsperada)}`, 30, additionalDetailsY + 30, { align: 'left' });

            // Interfaces y columnas (diseño de keystone2.ts)
            interface PaymentRecord {
              name: string;
              phone: string;
              abono: string;
              adeudo: string;
              plazos: string;
              pagoVdo: string;
              cobroSemana: string;
              abonoParcial: string;
              fInicio: string;
              nSemana: string;
              aval: string;
              [key: string]: string;
            }

            interface ColumnWidths {
              name: number;
              phone: number;
              abono: number;
              adeudo: number;
              plazos: number;
              pagoVdo: number;
              cobroSemana: number;
              abonoParcial: number;
              fInicio: number;
              nSemana: number;
              aval: number;
              [key: string]: number;
            }
             
            const columnWidths: ColumnWidths = {
              name: 100,
              phone: 40,
              abono: 70,
              adeudo: 35,
              plazos: 35,
              pagoVdo: 25,
              cobroSemana: 35,
              abonoParcial: 35,
              fInicio: 35,
              nSemana: 40,
              aval: 100,
            };

            // Function to draw table headers (diseño de keystone2.ts)
            const drawTableHeaders = (y: number): number => {
              const headers = ['NOMBRE', 'TELEFONO', 'ABONO', 'ADEUDO', 'PLAZOS', 'PAGO VDO', 'COBRO SEMANA', 'ABONO PARCIAL', 'FECHA INICIO', 'NUMERO SEMANA', 'AVAL'];
              const headerHeight = 30;

              doc.rect(30, y, Object.values(columnWidths).reduce((a, b) => a + b, 0), headerHeight).fillAndStroke('#f0f0f0', '#000');
              doc.fillColor('#000').fontSize(7);
              headers.forEach((header, i) => {
                const x = 30 + Object.values(columnWidths).slice(0, i).reduce((a, b) => a + b, 0);
                const columnWidth = Object.values(columnWidths)[i];

                if (header.includes(' ')) {
                  const [firstLine, secondLine] = header.split(' ');
                  doc.text(firstLine, x, y + 5, { width: columnWidth, align: 'center' });
                  doc.text(secondLine, x, y + 15, { width: columnWidth, align: 'center' });
                } else {
                  doc.text(header, x, y + 10, { width: columnWidth, align: 'center' });
                }
              });

              doc.lineWidth(0.5);
              let x = 30;
              Object.values(columnWidths).forEach((width) => {
                doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke();
                x += width;
              });
              doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke();

              return y + headerHeight;
            };

            // Function to add page numbers (diseño de keystone2.ts)
            const addPageNumber = (pageNumber: number): void => {
              doc.fontSize(10).text(`Página ${pageNumber}`, doc.page.width - 100, doc.page.height - 42, { align: 'right' });
            };

            // Function to split text into multiple lines if necessary (diseño de keystone2.ts)
            const splitText = (text: string, width: number): string[] => {
              const words = text.split(' ');
              const lines = [];
              let currentLine = '';

              words.forEach((word) => {
                const testLine = currentLine + word + ' ';
                const testWidth = doc.widthOfString(testLine);

                if (testWidth > width && currentLine.length > 0) {
                  lines.push(currentLine.trim());
                  currentLine = word + ' ';
                } else {
                  currentLine = testLine;
                }
              });

              lines.push(currentLine.trim());
              return lines;
            };

            // Initial table headers (diseño de keystone2.ts)
            let currentY = drawTableHeaders(additionalDetailsY + 50);
            let pageNumber = 1;
            addPageNumber(pageNumber);

            const paddingBottom = 5;
            const lineHeight = 12;
            const pageHeight = doc.page.height - doc.page.margins.bottom;

            // Dibujar filas con datos reales de la DB
            payments.forEach((payment, rowIndex) => {
                             const nameLines = splitText(payment.name, columnWidths.name);
               const nameLineHeight = 8; // Altura más compacta para líneas del nombre
               const rowHeight = nameLineHeight * nameLines.length + paddingBottom + 10; // Padding vertical arriba y abajo

              if (currentY + rowHeight > pageHeight) {
                doc.addPage();
                pageNumber++;
                currentY = drawTableHeaders(30);
                addPageNumber(pageNumber);
              }

                             doc.fontSize(6);
               nameLines.forEach((line, lineIndex) => {
                 const y = currentY + (lineIndex * nameLineHeight) + 5; // Mismo padding que aval
                 doc.text(line, 40, y, { width: columnWidths.name - 10, align: 'left' });
               });

                             // Dibujar columnas individuales para evitar problemas de TypeScript
               const drawColumn = (key: string, x: number, width: number) => {
                 const paddingLeft = key === 'name' ? 5 : 0;

                 if (key === 'abono') {
                   const subColumnWidth = width / 2;
                   const textHeight = doc.heightOfString(payment[key], { width: subColumnWidth });
                   const verticalOffset = (rowHeight - textHeight) / 2;

                   doc.text('', x + paddingLeft, currentY + verticalOffset, { width: subColumnWidth, align: 'center' });
                   doc.text(payment[key], x + paddingLeft + subColumnWidth, currentY + verticalOffset, { width: subColumnWidth, align: 'center' });
                   doc.moveTo(x + subColumnWidth, currentY).lineTo(x + subColumnWidth, currentY + rowHeight).stroke();
                   doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
                 } else if (key !== 'name') {
                   const value = payment[key];
                   const textHeight = doc.heightOfString(value, { width });
                   const verticalOffset = (rowHeight - textHeight) / 2;
                   
                   if (key === 'aval') {
                     // Padding especial para aval
                     doc.text(value, x + 5, currentY + verticalOffset, { width: width - 10, align: 'left' });
                   } else {
                     doc.text(value, x + paddingLeft, currentY + verticalOffset, { width, align: 'center' });
                   }
                 }
               };

               Object.entries(columnWidths).forEach(([key, width], index) => {
                 const x = 30 + Object.values(columnWidths).slice(0, index).reduce((a, b) => a + b, 0);
                 drawColumn(key, x, width);
               });

              doc.lineWidth(0.5).rect(30, currentY, Object.values(columnWidths).reduce((a, b) => a + b, 0), rowHeight).stroke();

              let x = 30;
              Object.values(columnWidths).forEach((width) => {
                doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
                x += width;
              });
              doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();

              currentY += rowHeight;
            });

            addPageNumber(pageNumber);
            doc.end();

          } catch (error) {
            console.error('Error generando PDF:', error);
            res.status(500).json({ error: 'Error interno del servidor al generar PDF' });
          }
        });
        (app as any).get('/resumen', async (req: Request, res: Response) => {
          const { startDate, endDate, routeId } = req.query;

          if (!startDate || !endDate || !routeId) {
            return res.status(400).json({ error: 'Missing required parameters' });
          }
          
          try {
            const routeIdInt = parseInt(routeId as string);
            const start = new Date(startDate as string);
            const end = new Date(endDate as string);
            end.setHours(23, 59, 59, 999);
            console.log(start, end);
            // Consultar el dinero inicial
            const transactions = await prisma.transaction.findMany({
              where: {
                OR: [
                  {
                    sourceAccountId: "cm6yiw9uw0002ibxcxd01of88",
                  },
                  {
                    destinationAccountId: "cm6yiw9uw0002ibxcxd01of88"
                  }
              ],
                date: {
                  lt: start,
                },
              }
            });

            //suma, resta los valores dependiento de si es un income o un expense
            const initialBalance = transactions.reduce((acc, transaction) => {
              if (transaction.type === 'INCOME') {
                return acc + (transaction.amount ? Number(transaction.amount) : 0);
              }
              return acc - (transaction.amount ? Number(transaction.amount) : 0);
            }, 0);
        
            // Consultar el dinero final
            const finalTransactions = await prisma.transaction.findMany({
              where: {
                OR: [
                  {
                    sourceAccountId: "cm6yiw9uw0002ibxcxd01of88",
                  },
                  {
                    destinationAccountId: "cm6yiw9uw0002ibxcxd01of88"
                  }
                ],
                date: {
                  lt: end,
                },
              },
            });

            //suma, resta los valores dependiento de si es un income o un expense
            const finalBalance = finalTransactions.reduce((acc, transaction) => {
              if (transaction.type === 'INCOME') {
                return acc + (transaction.amount ? Number(transaction.amount) : 0);
              }
              return acc - (transaction.amount ? Number(transaction.amount) : 0);
            }, initialBalance);
        
            //Week transactions by locality
            const rangeTransactions = await prisma.transaction.findMany({
              where: {
                /* OR: [
                  {
                    sourceAccountId: "cm6yiw9uw0002ibxcxd01of88",
                  },
                  {
                    destinationAccountId: "cm6yiw9uw0002ibxcxd01of88"
                  }
              ], */
                date: {
                  gte: start,
                  lte: end,
                },
              },
              include:{
                loan:{
                  include:{
                    lead: {
                      include: {
                        personalData: {
                          include: {
                            addresses:{
                              include: {
                                location:true
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                lead: {
                  include: {
                    personalData: {
                      include: {
                        addresses:{
                          include: {
                            location:true
                          }
                        }
                      }
                    }
                  }
                }
              }
            });

            console.log("rangeTransactions", rangeTransactions.length, start, end);

            // agrupa los transaction por dia y localidad y tipo.

            const localidades: Record<string, Record<string, { [key: string]: number }>> = rangeTransactions.reduce((acc: Record<string, Record<string, { [key: string]: number }>>, transaction) => {
              const date = transaction.date ? transaction.date.toISOString().split('T')[0] : 'Invalid Date';

              // Primero intentamos obtener del lead directo de la transacción
              const locality = (transaction.lead?.personalData?.addresses[0]?.location?.name || transaction.lead?.personalData?.fullName) ||
                           // Si no existe, intentamos obtener del lead a través del préstamo
                           (transaction.loan?.lead?.personalData?.addresses[0]?.location?.name || transaction.loan?.lead?.personalData?.fullName) ||
                           'Sin localidad';

              const type: 'ABONO' | 'CREDITO' | 'VIATIC' | 'GASOLINE' | 'ACCOMMODATION' | 'NOMINA_SALARY' | 'EXTERNAL_SALARY' | 'VEHICULE_MAINTENANCE' | 'LOAN_GRANTED' | 'LOAN_PAYMENT_COMISSION' | 'LOAN_GRANTED_COMISSION' | 'LEAD_COMISSION' | 'MONEY_INVESMENT' | 'OTRO' = 
              transaction.type === 'INCOME' && (transaction.incomeSource === 'CASH_LOAN_PAYMENT' || transaction.incomeSource === 'BANK_LOAN_PAYMENT') ? 'ABONO' :
              transaction.type === 'INCOME' && transaction.incomeSource === 'MONEY_INVESMENT' ? 'MONEY_INVESMENT' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'VIATIC' ? 'VIATIC' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'GASOLINE' ? 'GASOLINE' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'ACCOMMODATION' ? 'ACCOMMODATION' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'NOMINA_SALARY' ? 'NOMINA_SALARY' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'EXTERNAL_SALARY' ? 'EXTERNAL_SALARY' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'VEHICULE_MAINTENANCE' ? 'VEHICULE_MAINTENANCE' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'LOAN_GRANTED' ? 'LOAN_GRANTED' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'LOAN_PAYMENT_COMISSION' ? 'LOAN_PAYMENT_COMISSION' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'LOAN_GRANTED_COMISSION' ? 'LOAN_GRANTED_COMISSION' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'LEAD_COMISSION' ? 'LEAD_COMISSION' :
              transaction.type === 'EXPENSE' && transaction.expenseSource === 'LOAN_GRANTED' ? 'LOAN_GRANTED' :
              'OTRO';
              
              if (!acc[date]) {
              acc[date] = {};
              }
              if (!acc[date][locality]) {
              acc[date][locality] = {
                ABONO: 0,
                CREDITO: 0,
                VIATIC: 0,
                GASOLINE: 0,
                ACCOMMODATION: 0,
                NOMINA_SALARY: 0,
                EXTERNAL_SALARY: 0,
                VEHICULE_MAINTENANCE: 0,
                LOAN_GRANTED: 0,
                LOAN_PAYMENT_COMISSION: 0,
                LOAN_GRANTED_COMISSION: 0,
                LEAD_COMISSION: 0,
                MONEY_INVESMENT: 0,
                OTRO: 0,
                BALANCE: 0,
                PROFIT: 0,
              };
              }
              if (!acc[date][locality][type]) {
              acc[date][locality][type] = 0;
              }
              const amount = transaction.amount ? Number(transaction.amount) : 0;
              const profit = transaction.profitAmount ? Number(transaction.profitAmount) : 0;
              acc[date][locality][type] += amount;
              acc[date][locality].BALANCE += transaction.type === 'INCOME' ? amount : -amount;
              acc[date][locality].PROFIT += profit;
              return acc;
            }, {});

            const totalProfit = Object.values(localidades).reduce((total, dateData) => {
              return total + Object.values(dateData).reduce((dateTotal, localityData) => {
              return dateTotal + localityData.PROFIT;
              }, 0);
            }, 0);

            const totalExpenses = Object.values(localidades).reduce((total, dateData) => {
              return total + Object.values(dateData).reduce((dateTotal, localityData) => {
              return dateTotal + Object.keys(localityData).reduce((keyTotal, key) => {
                if (key !== 'BALANCE' && key !== 'PROFIT' && key !== 'ABONO' && key !== 'MONEY_INVESMENT') {
                return keyTotal + localityData[key];
                }
                return keyTotal;
              }, 0);
              }, 0);
            }, 0);

            const netProfit = totalProfit - totalExpenses;
            
        return res.json({
              initialBalance,
              finalBalance,
              localidades,
              netProfit,
            });
          } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
          }
        });
      },
    },
  })
)
