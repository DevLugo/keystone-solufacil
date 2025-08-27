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

        // Endpoint para subir imágenes a Cloudinary
        app.post('/api/upload-image', async (req: Request, res: Response) => {
          try {
            // Verificar que las variables de entorno estén configuradas
            if (!process.env.CLOUDINARY_CLOUD_NAME || 
                !process.env.CLOUDINARY_API_KEY || 
                !process.env.CLOUDINARY_API_SECRET) {
              return res.status(500).json({ 
                error: 'Configuración de Cloudinary no encontrada' 
              });
            }

            // Importar multer dinámicamente
            const multer = require('multer');
            const { v2: cloudinary } = require('cloudinary');

            // Configurar Cloudinary
            cloudinary.config({
              cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
              api_key: process.env.CLOUDINARY_API_KEY,
              api_secret: process.env.CLOUDINARY_API_SECRET,
            });

            // Configurar multer
            const upload = multer({
              storage: multer.memoryStorage(),
              limits: {
                fileSize: 10 * 1024 * 1024, // 10MB máximo
              },
              fileFilter: (req: any, file: any, cb: any) => {
                if (file.mimetype.startsWith('image/')) {
                  cb(null, true);
                } else {
                  cb(new Error('Solo se permiten archivos de imagen'));
                }
              },
            });

            // Procesar el archivo con multer
            upload.single('file')(req as any, res as any, async (err: any) => {
              if (err) {
                console.error('Error de multer:', err);
                return res.status(400).json({ 
                  error: err.message || 'Error al procesar el archivo' 
                });
              }

              const file = (req as any).file;
              if (!file) {
                return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
              }

              try {
                const folder = (req as any).body?.folder || 'documentos-personales';
                
                // Subir a Cloudinary usando upload_stream
                const result = await new Promise((resolve, reject) => {
                  const stream = cloudinary.uploader.upload_stream(
                    {
                      folder: folder,
                      resource_type: 'image',
                      transformation: [
                        { quality: 'auto:good' },
                        { fetch_format: 'auto' }
                      ],
                      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                      max_bytes: 10 * 1024 * 1024,
                    },
                    (error: any, result: any) => {
                      if (error) {
                        reject(error);
                      } else {
                        resolve({
                          public_id: result.public_id,
                          secure_url: result.secure_url,
                          url: result.url,
                          format: result.format,
                          width: result.width,
                          height: result.height,
                          bytes: result.bytes,
                        });
                      }
                    }
                  );

                  // Convertir buffer a stream
                  const { Readable } = require('stream');
                  const readable = Readable.from(file.buffer);
                  readable.pipe(stream);
                });

                res.status(200).json(result);
              } catch (error) {
                console.error('Error al subir a Cloudinary:', error);
                res.status(500).json({ 
                  error: 'Error al subir la imagen',
                  details: error instanceof Error ? error.message : 'Error desconocido'
                });
              }
            });

          } catch (error) {
            console.error('Error en endpoint de subida:', error);
            res.status(500).json({ 
              error: 'Error interno del servidor',
              details: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
        });

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

            // Calcular rango de fechas semanal (ISO: lunes a domingo) y modo de semana
            const weekMode = (req.query.weekMode as string) === 'current' ? 'current' : 'next';
            const today = new Date();
            const isoDow = (today.getDay() + 6) % 7; // 0 = lunes
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - isoDow);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            if (weekMode === 'next') {
              weekStart.setDate(weekStart.getDate() + 7);
              weekEnd.setDate(weekEnd.getDate() + 7);
            }

            // Obtener préstamos activos
            const activeLoans = await prisma.loan.findMany({
              where: {
                AND: [
                  { finishedDate: null },
                  { badDebtDate: null },
                  // ✅ AGREGAR: Filtrar préstamos con deuda pendiente mayor a 0
                  { pendingAmountStored: { gt: "0" } },
                  leaderId ? { leadId: leaderId as string } : {}
                ]
              },
              include: {
                borrower: {
                  include: {
                    personalData: {
                      include: {
                        phones: { select: { number: true } },
                        addresses: { include: { location: true } }
                      }
                    }
                  }
                },
                loantype: true,
                payments: true,
                lead: {
                  include: {
                    personalData: true
                  }
                }
              },
              orderBy: {
                signDate: 'asc'
              }
            }) as any[];

            // Excluir préstamos ya limpiados (tienen excludedByCleanupId asignado)
            const filteredActiveLoans = activeLoans.filter((loan: any) => !loan.excludedByCleanupId);

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

            // Generar código corto a partir del id (fallback si no hay clientCode)
            const shortCodeFromId = (id?: string): string => {
              if (!id) return '';
              const base = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
              return base.slice(-6);
            };

            // Helpers de semanas activas del mes (definidos antes de su uso)
            const getMonday = (d: Date) => {
              const date = new Date(d);
              const day = date.getDay();
              const diff = (day + 6) % 7; // 0=Lunes
              date.setDate(date.getDate() - diff);
              date.setHours(0, 0, 0, 0);
              return date;
            };
            const generateActiveWeeksForMonth = (ref: Date) => {
              const year = ref.getFullYear();
              const month = ref.getMonth();
              const firstDay = new Date(year, month, 1);
              const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999);
              let cursor = getMonday(firstDay);
              const weeks: Array<{ start: Date; end: Date }> = [];
              while (cursor <= lastDay) {
                const start = new Date(cursor);
                const end = new Date(start);
                end.setDate(end.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                // mayoría de días laborales (L-V) dentro del mes
                let weekdaysInMonth = 0;
                for (let i = 0; i < 5; i++) {
                  const d = new Date(start);
                  d.setDate(start.getDate() + i);
                  if (d.getMonth() === month) weekdaysInMonth++;
                }
                if (weekdaysInMonth >= 3) weeks.push({ start, end });
                cursor.setDate(cursor.getDate() + 7);
              }
              return weeks;
            };
            const activeWeeksCurrentMonth = generateActiveWeeksForMonth(new Date());
            const findWeekContaining = (date: Date) => activeWeeksCurrentMonth.find(w => date >= w.start && date <= w.end);
            const countWeeksElapsedSinceSignInCurrentMonth = (signDateStr: string) => {
              const signDate = new Date(signDateStr);
              const signWeek = findWeekContaining(signDate);
              const now = new Date();
              return activeWeeksCurrentMonth.filter(w => w.end <= now && (!signWeek || w.start > signWeek.end)).length;
            };

            // Generar registros de pago
            const payments = filteredActiveLoans.map((loan: any) => {
              const phone = loan.borrower?.personalData?.phones?.[0]?.number || '';
              const phoneDisplay = phone || '';
               
              const expectedWeeklyPayment = loan.expectedWeeklyPayment ? parseFloat(loan.expectedWeeklyPayment.toString()) : (() => {
                if (loan.loantype && loan.loantype.weekDuration && loan.loantype.weekDuration > 0) {
                  const rate = loan.loantype.rate ? parseFloat(loan.loantype.rate.toString()) : 0;
                  const totalAmountToPay = parseFloat(loan.requestedAmount.toString()) * (1 + rate);
                  return totalAmountToPay / loan.loantype.weekDuration;
                }
                return 0;
              })();
              const pendingAmountStored = loan.pendingAmountStored ? parseFloat(loan.pendingAmountStored.toString()) : 0;

              // Totales pagados bajo lógica de semanas activas del mes
              const now = new Date();
              const sign = new Date(loan.signDate);
              // Semanas globales desde el lunes posterior a la semana de firma (ignora mes activo)
              const signWeekStart = getMonday(sign);
              const signWeekEnd = new Date(signWeekStart);
              signWeekEnd.setDate(signWeekEnd.getDate() + 6);
              signWeekEnd.setHours(23, 59, 59, 999);
              const boundary = new Date(signWeekEnd);
              boundary.setDate(boundary.getDate() + 1); // lunes siguiente
              boundary.setHours(0, 0, 0, 0);
              // Si el modo es next y ya estamos preparando siguiente semana, desplazar boundary 1 semana cuando corresponda
              const boundaryForCalc = new Date(boundary);
              if (weekMode === 'next') {
                boundaryForCalc.setDate(boundaryForCalc.getDate() + 7);
              }
              const msPerWeek = 7 * 24 * 60 * 60 * 1000;
              const weeksElapsedSinceBoundary = Math.max(0, Math.floor((getMonday(weekEnd).getTime() - getMonday(boundaryForCalc).getTime()) / msPerWeek));
              // Semana 1 inicia en el lunes posterior a la semana de firma
              const nSemanaValue = weeksElapsedSinceBoundary + 1;
              const expectedPaidToDateGlobal = expectedWeeklyPayment * nSemanaValue;
              const totalPaidSinceBoundary = (loan.payments || []).reduce((sum: number, p: any) => {
                const d = new Date(p.receivedAt || p.createdAt);
                if (d >= boundaryForCalc && d <= weekEnd) {
                  return sum + parseFloat((p.amount || 0).toString());
                }
                return sum;
              }, 0);
              const abonoParcialAmount = Math.max(0, totalPaidSinceBoundary - expectedPaidToDateGlobal);
              const arrearsAmount = Math.max(0, expectedPaidToDateGlobal - totalPaidSinceBoundary);
 
              // Pago VDO (monto total no pagado hasta la semana actual)
 
              // Número de semana: semanas globales desde el lunes posterior a la semana de firma
              // (ya calculado arriba como weeksElapsedSinceBoundary + 1)
                 
              // Texto de AVAL con ícono de teléfono solo antes del número
              const avalName = loan.avalName || '';
              const avalPhone = loan.avalPhone || '';
              const avalDisplay = [avalName, avalPhone].filter(Boolean).join(', ');

              return {
                id: loan.borrower?.personalData?.clientCode || shortCodeFromId(loan.borrower?.personalData?.id) || '',
                name: loan.borrower?.personalData?.fullName || '',
                phone: phoneDisplay,
                abono: formatCurrency(expectedWeeklyPayment || 0),
                adeudo: formatCurrency(pendingAmountStored || 0),
                plazos: (loan.loantype?.weekDuration || 0).toString(),
                pagoVdo: formatCurrency(arrearsAmount || 0),
                abonoParcial: formatCurrency(abonoParcialAmount || 0),
                fInicio: formatDate(loan.signDate),
                nSemana: String(nSemanaValue + 1),
                aval: avalDisplay
              };
            });

            // Calcular estadísticas
            const totalClientes = payments.length;
            const totalCobranzaEsperada = filteredActiveLoans.reduce((sum: number, loan: any) => {
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
            abonoParcial: string;
            fInicio: string;
            nSemana: string;
            aval: string;
              [key: string]: string;
          }

          interface ColumnWidths {
               id: number;
            name: number;
            phone: number;
            abono: number;
            adeudo: number;
            plazos: number;
            pagoVdo: number;
            abonoParcial: number;
            fInicio: number;
            nSemana: number;
            aval: number;
               [key: string]: number;
          }
          
          const columnWidths: ColumnWidths = {
               id: 30,
            name: 100,
            phone: 40,
            abono: 70,
            adeudo: 35,
            plazos: 35,
            pagoVdo: 25,
            abonoParcial: 35,
            fInicio: 35,
            nSemana: 40,
               aval: 85,
          };

             // Function to draw table headers (diseño de keystone2.ts)
             const drawTableHeaders = (y: number): number => {
               const headers = ['ID', 'NOMBRE', 'TELEFONO', 'ABONO', 'ADEUDO', 'PLAZOS', 'PAGO VDO', 'ABONO PARCIAL', 'FECHA INICIO', 'NUMERO SEMANA', 'AVAL'];
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
               // Calcular alto real del nombre con el ancho de columna para evitar texto encimado
               doc.fontSize(6);
               const columnKeys = Object.keys(columnWidths);
               const nameOffset = columnKeys.slice(0, columnKeys.indexOf('name')).reduce((sum, key) => sum + (columnWidths as any)[key], 0);
               const nameStartX = 30 + nameOffset + 5;
               const nameBlockWidth = columnWidths.name - 10;
               const nameTextHeight = doc.heightOfString(payment.name || '', { width: nameBlockWidth });
               const rowHeight = Math.max(nameTextHeight + paddingBottom + 10, 20);
 
                if (currentY + rowHeight > pageHeight) {
                  doc.addPage();
                  pageNumber++;
                  currentY = drawTableHeaders(30);
                  addPageNumber(pageNumber);
                }
 
               // Dibujar nombre en bloque con auto-wrap
               doc.text(payment.name || '', nameStartX, currentY + 5, { width: nameBlockWidth, align: 'left' });
 
                              // Dibujar columnas individuales para evitar problemas de TypeScript
                const drawColumn = (key: string, x: number, width: number) => {
                  const paddingLeft = key === 'name' ? 5 : 0;
                  if (key === 'abono') {
                    const left = '';
                    const right = payment[key];
                    const subColumnWidth = width / 2;
                    const textHeight = Math.max(
                      doc.heightOfString(left, { width: subColumnWidth }),
                      doc.heightOfString(right, { width: subColumnWidth })
                    );
                    const verticalOffset = (rowHeight - textHeight) / 2;
                    doc.text(left, x + paddingLeft, currentY + verticalOffset, { width: subColumnWidth, align: 'center' });
                    doc.text(right, x + paddingLeft + subColumnWidth, currentY + verticalOffset, { width: subColumnWidth, align: 'center' });
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

            // Crear PDF compacto y profesional
            const doc = new PDFDocument({ 
              margin: 40,
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
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
              });
            };

            // Función para calcular calificación del cliente
            const calculateClientRating = (loansAsClient: any[], loansAsCollateral: any[]) => {
              let score = 100;
              let factors = [];

              // Analizar préstamos como cliente
              const totalLoans = loansAsClient.length;
              const completedLoans = loansAsClient.filter(loan => 
                loan.status === 'TERMINADO' || loan.status === 'PAGADO'
              ).length;
              const onTimeCompletionRate = totalLoans > 0 ? (completedLoans / totalLoans) * 100 : 0;

              // Calcular periodos sin pago
              const totalNoPaymentPeriods = loansAsClient.reduce((total, loan) => 
                total + (loan.noPaymentPeriods?.length || 0), 0
              );

              // Calcular renovaciones
              const renewedLoans = loansAsClient.filter(loan => loan.wasRenewed).length;

              // Deducir puntos por problemas
              if (onTimeCompletionRate < 80) {
                score -= (80 - onTimeCompletionRate) * 0.5;
                factors.push(`Tasa completación: ${onTimeCompletionRate.toFixed(1)}%`);
              }

              if (totalNoPaymentPeriods > 0) {
                score -= Math.min(totalNoPaymentPeriods * 5, 30);
                factors.push(`${totalNoPaymentPeriods} períodos sin pago`);
              }

              if (renewedLoans > 0) {
                score -= Math.min(renewedLoans * 3, 15);
                factors.push(`${renewedLoans} renovaciones`);
              }

              // Bonificar por buen historial
              if (totalLoans >= 3 && onTimeCompletionRate >= 90) {
                score += 5;
                factors.push('Historial sólido');
              }

              score = Math.max(0, Math.min(100, score));

              let rating, color;
              if (score >= 85) { rating = 'EXCELENTE'; color = '#059669'; }
              else if (score >= 70) { rating = 'BUENO'; color = '#0891b2'; }
              else if (score >= 55) { rating = 'REGULAR'; color = '#ea580c'; }
              else { rating = 'MALO'; color = '#dc2626'; }

              return { score: Math.round(score), rating, color, factors };
            };

            // Función para calcular calificación como aval
            const calculateCollateralRating = (loansAsCollateral: any[]) => {
              if (loansAsCollateral.length === 0) {
                return { score: 0, rating: 'SIN EXPERIENCIA', color: '#6b7280', factors: ['No ha sido aval'] };
              }

              let score = 100;
              let factors = [];

              const totalCollateralLoans = loansAsCollateral.length;
              const completedCollateralLoans = loansAsCollateral.filter(loan => 
                loan.status === 'TERMINADO' || loan.status === 'PAGADO'
              ).length;
              const collateralSuccessRate = (completedCollateralLoans / totalCollateralLoans) * 100;

              const totalCollateralNoPayments = loansAsCollateral.reduce((total, loan) => 
                total + (loan.noPaymentPeriods?.length || 0), 0
              );

              if (collateralSuccessRate < 80) {
                score -= (80 - collateralSuccessRate) * 0.7;
                factors.push(`Éxito como aval: ${collateralSuccessRate.toFixed(1)}%`);
              }

              if (totalCollateralNoPayments > 0) {
                score -= Math.min(totalCollateralNoPayments * 7, 40);
                factors.push(`${totalCollateralNoPayments} incumplimientos`);
              }

              if (totalCollateralLoans >= 2 && collateralSuccessRate >= 90) {
                score += 5;
                factors.push('Aval confiable');
              }

              score = Math.max(0, Math.min(100, score));

              let rating, color;
              if (score >= 85) { rating = 'CONFIABLE'; color = '#059669'; }
              else if (score >= 70) { rating = 'BUENO'; color = '#0891b2'; }
              else if (score >= 55) { rating = 'REGULAR'; color = '#ea580c'; }
              else { rating = 'RIESGOSO'; color = '#dc2626'; }

              return { score: Math.round(score), rating, color, factors };
            };

            // Calcular calificaciones
            const clientRating = calculateClientRating(loansAsClient || [], loansAsCollateral || []);
            const collateralRating = calculateCollateralRating(loansAsCollateral || []);

            // Header profesional minimalista
            doc.fontSize(22).fillColor('#1f2937').text('Solufacil - Historial de Pagos', 0, 40, { align: 'center' });
            
            let y = 100;

            // Información básica del cliente
            doc.fontSize(16).fillColor('#374151').text(clientName.toUpperCase(), 40, y);
            doc.fontSize(10).fillColor('#6b7280').text(`${clientDui ? `DUI: ${clientDui}` : ''} | ${clientAddresses?.[0]?.location || ''} | Fecha: ${new Date().toLocaleDateString('es-SV')}`, 40, y + 20);
            
            y += 60;



            // Resumen Financiero (similar a la imagen)
            doc.rect(40, y, 515, 140).fill('#f8f9fa').stroke('#e5e7eb');
            
            doc.fontSize(14).fillColor('#374151').text('Resumen Financiero', 50, y + 10);
            
            // Estadísticas en formato de tabla
            const stats = [
              ['TOTAL PAGADO:', formatCurrency(summary?.totalAmountPaidAsClient || 0)],
              ['DEUDA TOTAL:', formatCurrency(summary?.totalAmountRequestedAsClient || 0)],
              ['DEUDA PENDIENTE:', formatCurrency(summary?.currentPendingDebtAsClient || 0)],
            ];

            let statY = y + 35;
            stats.forEach(([label, value]) => {
              doc.fontSize(10).fillColor('#6b7280').text(label, 50, statY);
              doc.fontSize(10).fillColor('#1f2937').text(value, 250, statY);
              statY += 20;
            });

            // Sección de calificación
            doc.fontSize(12).fillColor('#374151').text('Calificación', 320, y + 10);
            
            // Calificación como cliente
            doc.fontSize(10).fillColor('#6b7280').text('Como Cliente:', 320, y + 35);
            doc.fontSize(12).fillColor(clientRating.color).text(`${clientRating.rating} (${clientRating.score}/100)`, 320, y + 50);
            
            // Calificación como aval
            doc.fontSize(10).fillColor('#6b7280').text('Como Aval:', 320, y + 75);
            doc.fontSize(12).fillColor(collateralRating.color).text(`${collateralRating.rating} (${collateralRating.score}/100)`, 320, y + 90);

            y += 160;

            // Historial de Pagos (simplificado, como en la imagen)
            if (loansAsClient && loansAsClient.length > 0) {
              doc.fontSize(14).fillColor('#374151').text('Historial de Pagos', 40, y);
              y += 25;

              // Crear tabla similar a la imagen
              const tableHeaders = ['FECHA', 'CANTIDAD', 'TIPO'];
              const columnWidths = [100, 100, 315];
              const tableX = 40;

              // Encabezado
              doc.rect(tableX, y, 515, 25).fill('#e5e7eb').stroke('#d1d5db');
              doc.fontSize(10).fillColor('#374151');
              tableHeaders.forEach((header, index) => {
                const headerX = tableX + columnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                doc.text(header, headerX + 5, y + 8, { width: columnWidths[index] - 10 });
              });
              y += 25;

              // Filas de datos (solo información esencial)
              loansAsClient.forEach((loan: any, index: number) => {
                if (y > doc.page.height - 100) {
                  doc.addPage();
                  y = 40;
                }

                const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                doc.rect(tableX, y, 515, 20).fill(rowColor).stroke('#e5e7eb');

                // Determinar tipo y estado
                let tipo = 'ABONO';
                if (loan.status === 'VENCIDO' || loan.status === 'CARTERA MUERTA') {
                  tipo = 'SIN PAGO';
                } else if (loan.status === 'TERMINADO' || loan.status === 'PAGADO') {
                  tipo = 'ABONO';
                } else if (loan.pendingDebt > 0) {
                  tipo = 'ABONO';
                }

                const rowData = [
                  formatDate(loan.signDate),
                  formatCurrency(loan.wasRenewed ? loan.amountRequested : Math.min(loan.totalPaid, loan.totalAmountDue)),
                  tipo
                ];

                doc.fontSize(9).fillColor('#374151');
                rowData.forEach((cell, cellIndex) => {
                  const cellX = tableX + columnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
                  let textColor = '#374151';
                  
                  // Color especial para tipo
                  if (cellIndex === 2) {
                    textColor = cell === 'SIN PAGO' ? '#dc2626' : '#059669';
                  }
                  
                  doc.fillColor(textColor).text(cell, cellX + 5, y + 6, { width: columnWidths[cellIndex] - 10 });
                });

                y += 20;
              });

              y += 30;
            }

            // Información adicional de avales (solo si tiene)
            if (loansAsCollateral && loansAsCollateral.length > 0) {
              // Verificar espacio
              if (y > doc.page.height - 200) {
                doc.addPage();
                y = 40;
              }

              doc.fontSize(14).fillColor('#374151').text('Experiencia como Aval', 40, y);
              y += 25;

              // Resumen compacto de experiencia como aval
              doc.rect(40, y, 515, 80).fill('#fef9f6').stroke('#e5e7eb');
              
              doc.fontSize(12).fillColor('#6b7280').text('Total como aval:', 50, y + 15);
              doc.fontSize(12).fillColor('#1f2937').text(`${loansAsCollateral.length} préstamos`, 200, y + 15);
              
              const successfulAsCollateral = loansAsCollateral.filter(loan => 
                loan.status === 'TERMINADO' || loan.status === 'PAGADO'
              ).length;
              
              doc.fontSize(12).fillColor('#6b7280').text('Préstamos exitosos:', 50, y + 35);
              doc.fontSize(12).fillColor('#1f2937').text(`${successfulAsCollateral} de ${loansAsCollateral.length}`, 200, y + 35);
              
              const totalCollateralAmount = loansAsCollateral.reduce((total, loan) => total + loan.amountRequested, 0);
              doc.fontSize(12).fillColor('#6b7280').text('Monto total avalado:', 50, y + 55);
              doc.fontSize(12).fillColor('#1f2937').text(formatCurrency(totalCollateralAmount), 200, y + 55);

              y += 100;
            }

            // Conclusiones y recomendaciones
            if (y > doc.page.height - 150) {
              doc.addPage();
              y = 40;
            }

            doc.fontSize(14).fillColor('#374151').text('Análisis y Recomendación', 40, y);
            y += 25;

            doc.rect(40, y, 515, 100).fill('#f0f9ff').stroke('#e5e7eb');
            
            // Recomendación basada en las calificaciones
            let recommendation = '';
            if (clientRating.score >= 85) {
              recommendation = 'CLIENTE EXCELENTE - Recomendado para préstamos sin restricciones.';
            } else if (clientRating.score >= 70) {
              recommendation = 'BUEN CLIENTE - Apto para préstamos con condiciones estándar.';
            } else if (clientRating.score >= 55) {
              recommendation = 'CLIENTE REGULAR - Evaluar condiciones especiales o garantías adicionales.';
            } else {
              recommendation = 'ALTO RIESGO - No recomendado sin garantías sólidas.';
            }

            doc.fontSize(11).fillColor('#1f2937').text('Recomendación:', 50, y + 15, { continued: false });
            doc.fontSize(10).fillColor('#374151').text(recommendation, 50, y + 35, { width: 455 });

            // Factores considerados
            if (clientRating.factors.length > 0) {
              doc.fontSize(10).fillColor('#6b7280').text('Factores considerados:', 50, y + 65);
              const factorsText = clientRating.factors.join(', ');
              doc.fontSize(9).fillColor('#374151').text(factorsText, 50, y + 80, { width: 455 });
            }

            y += 120;

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
