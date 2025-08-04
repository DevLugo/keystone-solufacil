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
        // Agregar middleware para parsing de JSON
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
                    const value = payment[key as keyof typeof payment];
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



        // Endpoint para exportar historial del cliente a PDF
        (app as any).post('/export-client-history-pdf', async (req: Request, res: Response) => {
          try {
            console.log('📄 Iniciando generación de PDF del historial del cliente');
            console.log('📋 req.body:', req.body);
            console.log('📋 req.headers:', req.headers);
            
            // Verificar si req.body existe
            if (!req.body) {
              console.error('❌ Error: req.body es undefined');
              return res.status(400).json({ error: 'req.body es undefined. Asegúrate de enviar Content-Type: application/json' });
            }
            
            const {
              clientId,
              clientName,
              clientDui,
              clientPhones,
              clientAddresses,
              summary,
              loansAsClient,
              loansAsCollateral
            } = req.body;

            // Validar parámetros requeridos
            if (!clientName) {
              console.error('❌ Error: clientName es requerido');
              return res.status(400).json({ error: 'clientName es requerido' });
            }

            console.log('✅ Parámetros válidos, procediendo con la generación');

            // Crear PDF simple y funcional
            const doc = new PDFDocument({ 
              margin: 30,
              size: 'A4',
              layout: 'portrait'
            });
            const filename = `historial_${clientName.replace(/\s+/g, '_')}.pdf`;
             
            res.setHeader('Content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.setHeader('Content-type', 'application/pdf');
            doc.pipe(res);

            // Funciones de formato
            const formatCurrency = (amount: number): string => {
              return new Intl.NumberFormat('es-SV', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
              }).format(amount);
            };

            const formatDate = (dateString: string): string => {
              return new Date(dateString).toLocaleDateString('es-SV', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              });
            };

            // Header moderno y sobrio
            const headerHeight = 100;
            doc.rect(0, 0, doc.page.width, headerHeight).fill('#ffffff');
            doc.rect(0, 0, doc.page.width, 2).fill('#e1e8ed');
            
            // Logo más discreto
            doc.image('./solufacil.png', doc.page.width - 100, 15, { width: 60 });
            
            // Título principal con tipografía moderna
            doc.fontSize(28).fillColor('#1a202c').text('HISTORIAL DE CLIENTE', 0, 25, { align: 'center' });
            doc.fontSize(11).fillColor('#718096').text(`Generado el ${new Date().toLocaleDateString('es-SV')} a las ${new Date().toLocaleTimeString('es-SV')}`, 0, 60, { align: 'center' });

            // Información del cliente con diseño moderno y compacto
            let y = 130;
            doc.fontSize(16).fillColor('#1a202c').text('INFORMACIÓN DEL CLIENTE', 0, y, { align: 'center' });
            y += 25;
            
            // Contenedor centrado más compacto
            const clientInfoWidth = 350;
            const clientInfoX = (doc.page.width - clientInfoWidth) / 2;
            
            doc.rect(clientInfoX, y - 8, clientInfoWidth, 70).fill('#f7fafc').stroke('#e2e8f0');
            
            doc.fontSize(10).fillColor('#2d3748').text(`Nombre: ${clientName}`, clientInfoX + 15, y);
            y += 15;
            doc.fontSize(10).fillColor('#2d3748').text(`DUI: ${clientDui || 'N/A'}`, clientInfoX + 15, y);
            y += 15;
            
            if (clientPhones && clientPhones.length > 0) {
              doc.fontSize(10).fillColor('#2d3748').text(`Teléfonos: ${clientPhones.join(', ')}`, clientInfoX + 15, y);
              y += 15;
            }

            if (clientAddresses && clientAddresses.length > 0) {
              doc.fontSize(10).fillColor('#2d3748').text('Direcciones:', clientInfoX + 15, y);
              y += 12;
              clientAddresses.forEach((addr: any) => {
                doc.fontSize(9).fillColor('#718096').text(`${addr.street}, ${addr.city}, ${addr.location} (${addr.route})`, clientInfoX + 30, y);
                y += 12;
              });
            }

            y += 30;

            // Resumen estadístico con diseño moderno y compacto
            if (summary) {
              doc.fontSize(16).fillColor('#1a202c').text('RESUMEN ESTADÍSTICO', 0, y, { align: 'center' });
              y += 25;

              // Contenedor centrado más compacto
              const summaryWidth = 400;
              const summaryX = (doc.page.width - summaryWidth) / 2;
              const summaryHeight = 110;
              
              doc.rect(summaryX, y - 8, summaryWidth, summaryHeight).fill('#f7fafc').stroke('#e2e8f0');

              const summaryItems = [
                { label: 'Total préstamos como cliente', value: summary.totalLoansAsClient || 0 },
                { label: 'Total préstamos como aval', value: summary.totalLoansAsCollateral || 0 },
                { label: 'Préstamos activos como cliente', value: summary.activeLoansAsClient || 0 },
                { label: 'Préstamos activos como aval', value: summary.activeLoansAsCollateral || 0 },
                { label: 'Total prestado', value: formatCurrency(summary.totalAmountRequestedAsClient || 0) },
                { label: 'Total pagado', value: formatCurrency(summary.totalAmountPaidAsClient || 0) },
                { label: 'Deuda pendiente total', value: formatCurrency(summary.currentPendingDebtAsClient || 0) }
              ];

              let summaryY = y;
              summaryItems.forEach((item, index) => {
                const rowY = summaryY + (index * 15);
                doc.fontSize(10).fillColor('#2d3748').text(`${item.label}:`, summaryX + 15, rowY);
                doc.fontSize(10).fillColor('#1a202c').text(`${item.value}`, summaryX + 220, rowY);
              });

              y += summaryHeight + 25;
            }

            // Préstamos como cliente con diseño moderno
            if (loansAsClient && loansAsClient.length > 0) {
              doc.fontSize(16).fillColor('#1a202c').text('PRÉSTAMOS COMO CLIENTE', 0, y, { align: 'center' });
              y += 30;

              // Tabla centrada con diseño moderno
              const tableHeaders = ['Fecha', 'Tipo', 'Prestado', 'Total a Pagar', 'Pagado', 'Deuda Pendiente', 'Estado', 'Líder'];
              const columnWidths = [70, 60, 70, 80, 70, 80, 60, 70];
              const totalTableWidth = columnWidths.reduce((a, b) => a + b, 0);
              const tableX = (doc.page.width - totalTableWidth) / 2;

              // Encabezados con diseño sobrio
              doc.rect(tableX, y, totalTableWidth, 30).fill('#f7fafc').stroke('#e2e8f0');
              doc.fillColor('#1a202c').fontSize(10);
              
              tableHeaders.forEach((header, index) => {
                const headerX = tableX + columnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                const headerWidth = columnWidths[index];
                
                // Manejar encabezados de dos líneas
                if (header.includes(' ')) {
                  const [firstLine, secondLine] = header.split(' ');
                  doc.text(firstLine, headerX, y + 8, { width: headerWidth, align: 'center' });
                  doc.text(secondLine, headerX, y + 18, { width: headerWidth, align: 'center' });
                } else {
                  doc.text(header, headerX, y + 12, { width: headerWidth, align: 'center' });
                }
              });

              y += 35;

              // Filas de datos con diseño moderno
              loansAsClient.forEach((loan: any, index: number) => {
                if (y > doc.page.height - 120) {
                  doc.addPage();
                  y = 30;
                }

                // Fondo alternado sutil
                const rowColor = index % 2 === 0 ? '#ffffff' : '#f7fafc';
                doc.rect(tableX, y - 3, totalTableWidth, 25).fill(rowColor).stroke('#e2e8f0');

                const rowData = [
                  formatDate(loan.signDate),
                  loan.loanType,
                  formatCurrency(loan.amountRequested),
                  formatCurrency(loan.totalAmountDue),
                  formatCurrency(loan.totalPaid),
                  formatCurrency(loan.pendingDebt),
                  loan.status,
                  loan.leadName
                ];

                rowData.forEach((cell, cellIndex) => {
                  const cellX = tableX + columnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
                  const cellWidth = columnWidths[cellIndex];
                  
                  // Color del estado
                  let textColor = '#2d3748';
                  if (cellIndex === 6) { // Columna de estado
                    textColor = loan.status === 'ACTIVO' ? '#38a169' : 
                               loan.status === 'VENCIDO' ? '#e53e3e' : 
                               loan.status === 'TERMINADO' ? '#3182ce' : '#718096';
                  }
                  
                  doc.fontSize(9).fillColor(textColor).text(cell, cellX, y + 8, { width: cellWidth, align: 'center' });
                });

                y += 30;
              });

              y += 40;

                          // DETALLE DE PAGOS - VERSIÓN EXPANDIDA
            doc.fontSize(16).fillColor('#2c3e50').text('DETALLE DE PAGOS - PRÉSTAMOS COMO CLIENTE', 30, y);
            y += 30;



              loansAsClient.forEach((loan: any, loanIndex: number) => {
                // Verificar si necesitamos nueva página
                if (y > doc.page.height - 150) {
                  doc.addPage();
                  y = 30;
                }

                // Encabezado del préstamo
                doc.fontSize(14).fillColor('#3498db').text(`PRÉSTAMO ${loanIndex + 1}: ${loan.loanType}`, 30, y);
                y += 20;
                doc.fontSize(10).fillColor('#7f8c8d').text(`Fecha de inicio: ${formatDate(loan.signDate)} | Monto: ${formatCurrency(loan.amountRequested)} | Estado: ${loan.status}`, 30, y);
                y += 20;

                // Tabla de pagos del préstamo
                if (loan.payments && loan.payments.length > 0) {
                  const paymentHeaders = ['Fecha', 'Monto', 'Método', 'N° Pago', 'Balance Antes', 'Balance Después'];
                  const paymentColumnWidths = [80, 70, 60, 50, 80, 80];

                  // Encabezados de la tabla de pagos centrada
                  const totalPaymentWidth = paymentColumnWidths.reduce((a, b) => a + b, 0);
                  const paymentTableX = (doc.page.width - totalPaymentWidth) / 2;
                  doc.fontSize(9).fillColor('#ffffff');
                  doc.rect(paymentTableX, y, totalPaymentWidth, 20).fill('#2c3e50');
                  doc.fillColor('#ffffff');
                  
                  paymentHeaders.forEach((header, index) => {
                    const headerX = paymentTableX + paymentColumnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                    doc.text(header, headerX, y + 6, { width: paymentColumnWidths[index], align: 'center' });
                  });

                  y += 25;

                  // Filas de pagos
                  loan.payments.forEach((payment: any, paymentIndex: number) => {
                    if (y > doc.page.height - 100) {
                      doc.addPage();
                      y = 30;
                    }

                    const paymentRowColor = paymentIndex % 2 === 0 ? '#f8f9fa' : '#ffffff';
                    doc.rect(paymentTableX, y - 3, totalPaymentWidth, 16).fill(paymentRowColor);

                    const paymentData = [
                      formatDate(payment.receivedAt),
                      formatCurrency(payment.amount),
                      payment.paymentMethod || 'N/A',
                      payment.paymentNumber?.toString() || 'N/A',
                      formatCurrency(payment.balanceBeforePayment),
                      formatCurrency(payment.balanceAfterPayment)
                    ];

                    paymentData.forEach((cell, cellIndex) => {
                      const cellX = paymentTableX + paymentColumnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
                      doc.fontSize(7).fillColor('#2c3e50').text(cell, cellX, y + 4, { width: paymentColumnWidths[cellIndex], align: 'center' });
                    });

                    y += 20;
                  });

                  // Resumen del préstamo
                  y += 10;
                  doc.fontSize(10).fillColor('#2c3e50').text(`Total pagado en este préstamo: ${formatCurrency(loan.totalPaid)}`, 30, y);
                  y += 15;
                  doc.fontSize(10).fillColor('#2c3e50').text(`Deuda pendiente: ${formatCurrency(loan.pendingDebt)}`, 30, y);
                  y += 20;
                } else {
                  doc.fontSize(10).fillColor('#e74c3c').text('No hay pagos registrados para este préstamo', 30, y);
                  y += 20;
                }

                // Separador entre préstamos
                if (loanIndex < loansAsClient.length - 1) {
                  doc.rect(30, y, doc.page.width - 60, 1).fill('#e9ecef');
                  y += 20;
                }
              });

              y += 30;
            }

            // Préstamos como aval con diseño mejorado
            if (loansAsCollateral && loansAsCollateral.length > 0) {
              doc.fontSize(16).fillColor('#2c3e50').text('PRÉSTAMOS COMO AVAL', 30, y);
              y += 30;

              // Tabla de préstamos como aval con diseño mejorado
              const collateralHeaders = ['Cliente', 'Fecha', 'Tipo', 'Prestado', 'Pagado', 'Deuda Pendiente', 'Estado', 'Líder'];
              const collateralColumnWidths = [80, 50, 50, 60, 60, 70, 50, 60];

              // Dibujar encabezados con fondo
              let x = 30;
              doc.fontSize(10).fillColor('#ffffff');
              doc.rect(x, y, collateralColumnWidths.reduce((a, b) => a + b, 0), 25).fill('#e74c3c');
              doc.fillColor('#ffffff');
              
              collateralHeaders.forEach((header, index) => {
                doc.text(header, x, y + 8, { width: collateralColumnWidths[index], align: 'center' });
                x += collateralColumnWidths[index];
              });

              y += 30;

              // Dibujar filas de datos con diseño alternado
              loansAsCollateral.forEach((loan: any, index: number) => {
                if (y > doc.page.height - 100) {
                  doc.addPage();
                  y = 30;
                }

                // Fondo alternado para las filas
                const rowColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
                doc.rect(30, y - 5, collateralColumnWidths.reduce((a, b) => a + b, 0), 20).fill(rowColor);

                const rowData = [
                  loan.clientName || 'N/A',
                  formatDate(loan.signDate),
                  loan.loanType,
                  formatCurrency(loan.amountRequested),
                  formatCurrency(loan.totalPaid),
                  formatCurrency(loan.pendingDebt),
                  loan.status,
                  loan.leadName
                ];

                x = 30;
                rowData.forEach((cell, cellIndex) => {
                  const statusColor = loan.status === 'ACTIVO' ? '#2ecc71' : 
                                   loan.status === 'VENCIDO' ? '#e74c3c' : 
                                   loan.status === 'TERMINADO' ? '#3498db' : '#7f8c8d';
                  
                  doc.fontSize(8).fillColor(cellIndex === 6 ? statusColor : '#2c3e50').text(cell, x, y + 5, { width: collateralColumnWidths[cellIndex], align: 'center' });
                  x += collateralColumnWidths[cellIndex];
                });

                y += 25;
              });

              y += 30;

              // DETALLE DE PAGOS - VERSIÓN EXPANDIDA PARA AVALES
              doc.fontSize(16).fillColor('#2c3e50').text('DETALLE DE PAGOS - PRÉSTAMOS COMO AVAL', 30, y);
              y += 30;

              loansAsCollateral.forEach((loan: any, loanIndex: number) => {
                // Verificar si necesitamos nueva página
                if (y > doc.page.height - 150) {
                  doc.addPage();
                  y = 30;
                }

                // Encabezado del préstamo como aval
                doc.fontSize(14).fillColor('#e74c3c').text(`PRÉSTAMO COMO AVAL ${loanIndex + 1}: ${loan.loanType}`, 30, y);
                y += 20;
                doc.fontSize(10).fillColor('#7f8c8d').text(`Cliente: ${loan.clientName} | Fecha: ${formatDate(loan.signDate)} | Monto: ${formatCurrency(loan.amountRequested)} | Estado: ${loan.status}`, 30, y);
                y += 20;

                // Tabla de pagos del préstamo como aval
                if (loan.payments && loan.payments.length > 0) {
                  const paymentHeaders = ['Fecha', 'Monto', 'Método', 'N° Pago', 'Balance Antes', 'Balance Después'];
                  const paymentColumnWidths = [80, 70, 60, 50, 80, 80];

                  // Encabezados de la tabla de pagos
                  x = 30;
                  doc.fontSize(9).fillColor('#ffffff');
                  doc.rect(x, y, paymentColumnWidths.reduce((a, b) => a + b, 0), 20).fill('#e74c3c');
                  doc.fillColor('#ffffff');
                  
                  paymentHeaders.forEach((header, index) => {
                    doc.text(header, x, y + 6, { width: paymentColumnWidths[index], align: 'center' });
                    x += paymentColumnWidths[index];
                  });

                  y += 25;

                  // Filas de pagos
                  loan.payments.forEach((payment: any, paymentIndex: number) => {
                    if (y > doc.page.height - 100) {
                      doc.addPage();
                      y = 30;
                    }

                    const paymentRowColor = paymentIndex % 2 === 0 ? '#f8f9fa' : '#ffffff';
                    doc.rect(30, y - 3, paymentColumnWidths.reduce((a, b) => a + b, 0), 16).fill(paymentRowColor);

                    const paymentData = [
                      formatDate(payment.receivedAt),
                      formatCurrency(payment.amount),
                      payment.paymentMethod || 'N/A',
                      payment.paymentNumber?.toString() || 'N/A',
                      formatCurrency(payment.balanceBeforePayment),
                      formatCurrency(payment.balanceAfterPayment)
                    ];

                    x = 30;
                    paymentData.forEach((cell, cellIndex) => {
                      doc.fontSize(7).fillColor('#2c3e50').text(cell, x, y + 4, { width: paymentColumnWidths[cellIndex], align: 'center' });
                      x += paymentColumnWidths[cellIndex];
                    });

                    y += 20;
                  });

                  // Resumen del préstamo como aval
                  y += 10;
                  doc.fontSize(10).fillColor('#2c3e50').text(`Total pagado en este préstamo: ${formatCurrency(loan.totalPaid)}`, 30, y);
                  y += 15;
                  doc.fontSize(10).fillColor('#2c3e50').text(`Deuda pendiente: ${formatCurrency(loan.pendingDebt)}`, 30, y);
                  y += 20;
                } else {
                  doc.fontSize(10).fillColor('#e74c3c').text('No hay pagos registrados para este préstamo', 30, y);
                  y += 20;
                }

                // Separador entre préstamos como aval
                if (loanIndex < loansAsCollateral.length - 1) {
                  doc.rect(30, y, doc.page.width - 60, 1).fill('#e9ecef');
                  y += 20;
                }
              });
            }

            // Pie de página con diseño mejorado
            const footerY = doc.page.height - 60;
            doc.rect(0, footerY, doc.page.width, 60).fill('#f8f9fa');
            
            doc.fontSize(10).fillColor('#7f8c8d').text(`Documento generado el ${new Date().toLocaleDateString('es-SV')} a las ${new Date().toLocaleTimeString('es-SV')}`, 0, footerY + 20, { align: 'center' });
            doc.fontSize(8).fillColor('#95a5a6').text('Solufacil - Sistema de Gestión de Préstamos', 0, footerY + 40, { align: 'center' });

            console.log('📄 Finalizando PDF');
            doc.end();
            
            console.log('✅ PDF generado exitosamente');

          } catch (error) {
            console.error('❌ Error generando PDF del historial:', error);
            console.error('📋 Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
            res.status(500).json({ error: 'Error interno del servidor al generar PDF' });
          }
        });
      },
    },
  })
)
