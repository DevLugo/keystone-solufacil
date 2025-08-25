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

            // Header profesional y consistente
            const headerHeight = 70;
            doc.rect(0, 0, doc.page.width, headerHeight).fill('#ffffff');
            doc.rect(0, 0, doc.page.width, 1).fill('#e2e8f0');
            
            // Logo discreto
            doc.image('./solufacil.png', doc.page.width - 70, 8, { width: 45 });
            
            // Título principal con tipografía profesional
            doc.fontSize(20).fillColor('#1a202c').text('HISTORIAL DE CLIENTE', 0, 15, { align: 'center' });
            doc.fontSize(9).fillColor('#718096').text(`Generado el ${new Date().toLocaleDateString('es-SV')} a las ${new Date().toLocaleTimeString('es-SV')}`, 0, 40, { align: 'center' });

            // Información del cliente con formato profesional
            let y = 80;
            doc.fontSize(12).fillColor('#1a202c').text('INFORMACIÓN DEL CLIENTE', 30, y);
            y += 18;
            
            doc.fontSize(10).fillColor('#2d3748').text(`Nombre: ${clientName}`, 30, y);
            y += 16;
            
            if (clientPhones && clientPhones.length > 0) {
              doc.fontSize(9).fillColor('#4a5568').text(`Teléfonos: ${clientPhones.join(', ')}`, 30, y);
              y += 16;
            }

            if (clientAddresses && clientAddresses.length > 0) {
              doc.fontSize(9).fillColor('#4a5568').text('Direcciones:', 30, y);
              y += 12;
              clientAddresses.forEach((addr: any) => {
                doc.fontSize(8).fillColor('#718096').text(`${addr.street}, ${addr.city}, ${addr.location} (${addr.route})`, 50, y);
                y += 10;
              });
            }

            y += 20;



            // Préstamos como cliente con diseño profesional
            if (loansAsClient && loansAsClient.length > 0) {
              doc.fontSize(12).fillColor('#1a202c').text('PRÉSTAMOS COMO CLIENTE', 30, y);
              y += 20;

              // Tabla con ancho optimizado para mejor distribución
              const tableHeaders = ['Fecha', 'Tipo', 'Prestado', 'Total a Pagar', 'Pagado', 'Deuda Pendiente', 'Estado', 'Líder'];
              const columnWidths = [65, 55, 65, 75, 65, 75, 55, 65];
              const totalTableWidth = columnWidths.reduce((a, b) => a + b, 0);
              const tableX = 30; // Alineado a la izquierda como las tablas de pagos

              // Encabezados con diseño profesional (mismo formato que tablas de pagos)
              doc.fontSize(8).fillColor('#ffffff');
              doc.rect(tableX, y, totalTableWidth, 25).fill('#2c3e50'); // Aumentado altura para más padding
              doc.fillColor('#ffffff');
              
              tableHeaders.forEach((header, index) => {
                const headerX = tableX + columnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                const headerWidth = columnWidths[index];
                
                // Manejar encabezados de dos líneas con mejor espaciado
                if (header.includes(' ')) {
                  const words = header.split(' ');
                  const midPoint = Math.ceil(words.length / 2);
                  const firstLine = words.slice(0, midPoint).join(' ');
                  const secondLine = words.slice(midPoint).join(' ');
                  
                  doc.text(firstLine, headerX, y + 7, { width: headerWidth, align: 'center' });
                  doc.text(secondLine, headerX, y + 17, { width: headerWidth, align: 'center' });
                } else {
                  doc.text(header, headerX, y + 12, { width: headerWidth, align: 'center' });
                }
              });

              y += 30;

              // Filas de datos con diseño moderno (mismo formato que tablas de pagos)
              loansAsClient.forEach((loan: any, index: number) => {
                if (y > doc.page.height - 120) {
                  doc.addPage();
                  y = 30;
                }

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

                // Calcular altura máxima de la fila basada en el contenido
                let maxLines = 1;
                rowData.forEach((cell, cellIndex) => {
                  const cellWidth = columnWidths[cellIndex];
                  const lines = doc.heightOfString(cell, { width: cellWidth - 4 }) / 8; // 8px por línea
                  maxLines = Math.max(maxLines, Math.ceil(lines));
                });

                const rowHeight = Math.max(20, maxLines * 12); // Mínimo 20px, máximo basado en contenido

                // Fondo alternado sutil
                const rowColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
                doc.rect(tableX, y - 3, totalTableWidth, rowHeight).fill(rowColor);

                rowData.forEach((cell, cellIndex) => {
                  const cellX = tableX + columnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
                  const cellWidth = columnWidths[cellIndex];
                  
                  // Color del estado
                  let textColor = '#2c3e50';
                  if (cellIndex === 6) { // Columna de estado
                    textColor = loan.status === 'ACTIVO' ? '#38a169' : 
                               loan.status === 'VENCIDO' ? '#e53e3e' : 
                               loan.status === 'TERMINADO' ? '#3182ce' : '#718096';
                  }
                  
                  // Centrar verticalmente el texto
                  const textHeight = doc.heightOfString(cell, { width: cellWidth - 4 });
                  const verticalOffset = (rowHeight - textHeight) / 2;
                  
                  doc.fontSize(8).fillColor(textColor).text(cell, cellX, y + verticalOffset, { width: cellWidth - 4, align: 'center' });
                });

                y += rowHeight + 2; // Espacio adicional entre filas
              });

              y += 40;

                          // DETALLE DE PAGOS - VERSIÓN EXPANDIDA
            doc.fontSize(12).fillColor('#1a202c').text('DETALLE DE PAGOS - PRÉSTAMOS COMO CLIENTE', 30, y);
            y += 20;



              loansAsClient.forEach((loan: any, loanIndex: number) => {
                // Verificar si necesitamos nueva página
                if (y > doc.page.height - 150) {
                  doc.addPage();
                  y = 30;
                }

                // Encabezado del préstamo
                doc.fontSize(10).fillColor('#2d3748').text(`PRÉSTAMO ${loanIndex + 1}: ${loan.loanType}`, 30, y);
                y += 12;
                doc.fontSize(8).fillColor('#718096').text(`Fecha de inicio: ${formatDate(loan.signDate)} | Monto: ${formatCurrency(loan.amountRequested)} | Estado: ${loan.status}`, 30, y);
                y += 12;

                // Tabla de pagos del préstamo con ancho optimizado
                if (loan.payments && loan.payments.length > 0) {
                  const paymentHeaders = ['Fecha', 'Monto', 'Método', 'N° Pago', 'Balance Antes', 'Balance Después'];
                  const paymentColumnWidths = [70, 60, 50, 40, 70, 70];

                  // Encabezados de la tabla de pagos alineada a la izquierda
                  const totalPaymentWidth = paymentColumnWidths.reduce((a, b) => a + b, 0);
                  const paymentTableX = 30; // Alineado a la izquierda para consistencia
                  doc.fontSize(7).fillColor('#ffffff');
                  doc.rect(paymentTableX, y, totalPaymentWidth, 16).fill('#2c3e50');
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

                  y += 10;
                } else {
                  doc.fontSize(10).fillColor('#e74c3c').text('No hay pagos registrados para este préstamo', 30, y);
                  y += 20;
                }

                // ✅ NUEVA FUNCIONALIDAD: Mostrar períodos sin pagos con diseño profesional
                if (loan.noPaymentPeriods && loan.noPaymentPeriods.length > 0) {
                  // Verificar espacio para la sección completa
                  const estimatedHeight = 50 + (loan.noPaymentPeriods.length * 25);
                  if (y + estimatedHeight > doc.page.height - 100) {
                    doc.addPage();
                    y = 30;
                  }

                  // Encabezado con fondo similar a las tablas
                  doc.fontSize(9).fillColor('#ffffff');
                  doc.rect(30, y, 360, 20).fill('#e74c3c');
                  doc.fillColor('#ffffff').text('PERÍODOS SIN PAGO', 30, y + 6, { width: 360, align: 'center' });
                  y += 25;

                  // Contenedor con borde para los períodos
                  const periodsHeight = loan.noPaymentPeriods.length * 22 + 10;
                  doc.rect(30, y, 360, periodsHeight).stroke('#e74c3c');
                  doc.rect(30, y, 360, periodsHeight).fill('#fef5f5');

                  y += 8;

                  loan.noPaymentPeriods.forEach((period: any, index: number) => {
                    const periodText = period.weekCount === 1 
                      ? `${period.startDateFormatted} (1 semana)`
                      : `${period.startDateFormatted} al ${period.endDateFormatted} (${period.weekCount} semanas)`;
                    
                    // Texto sin símbolo para evitar problemas de codificación
                    doc.fontSize(8).fillColor('#dc2626').text(periodText, 50, y, { width: 330 });
                    y += 18;
                  });

                  y += 15;
                }

                // Resumen del préstamo
                doc.fontSize(10).fillColor('#2c3e50').text(`Total pagado en este préstamo: ${formatCurrency(loan.totalPaid)}`, 30, y);
                y += 15;
                doc.fontSize(10).fillColor('#2c3e50').text(`Deuda pendiente: ${formatCurrency(loan.pendingDebt)}`, 30, y);
                y += 20;

                // Separador entre préstamos
                if (loanIndex < loansAsClient.length - 1) {
                  doc.rect(30, y, doc.page.width - 60, 1).fill('#e9ecef');
                  y += 20;
                }
              });

              y += 30;
            }

            // Préstamos como aval con diseño profesional
            if (loansAsCollateral && loansAsCollateral.length > 0) {
              doc.fontSize(12).fillColor('#1a202c').text('PRÉSTAMOS COMO AVAL', 30, y);
              y += 20;

              // Tabla de préstamos como aval con ancho optimizado
              const collateralHeaders = ['Cliente', 'Fecha', 'Tipo', 'Prestado', 'Pagado', 'Deuda Pendiente', 'Estado', 'Líder'];
              const collateralColumnWidths = [65, 55, 65, 75, 65, 75, 55, 65];
              const totalCollateralWidth = collateralColumnWidths.reduce((a, b) => a + b, 0);
              const collateralTableX = 30; // Alineado a la izquierda para consistencia

              // Dibujar encabezados con fondo (mismo formato que otras tablas)
              doc.fontSize(8).fillColor('#ffffff');
              doc.rect(collateralTableX, y, totalCollateralWidth, 25).fill('#2c3e50'); // Aumentado altura para más padding
              doc.fillColor('#ffffff');
              
              collateralHeaders.forEach((header, index) => {
                const headerX = collateralTableX + collateralColumnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                const headerWidth = collateralColumnWidths[index];
                
                // Manejar encabezados de dos líneas con mejor espaciado
                if (header.includes(' ')) {
                  const words = header.split(' ');
                  const midPoint = Math.ceil(words.length / 2);
                  const firstLine = words.slice(0, midPoint).join(' ');
                  const secondLine = words.slice(midPoint).join(' ');
                  
                  doc.text(firstLine, headerX, y + 7, { width: headerWidth, align: 'center' });
                  doc.text(secondLine, headerX, y + 17, { width: headerWidth, align: 'center' });
                } else {
                  doc.text(header, headerX, y + 12, { width: headerWidth, align: 'center' });
                }
              });

              y += 30;

              // Dibujar filas de datos con diseño alternado (mismo formato que otras tablas)
              loansAsCollateral.forEach((loan: any, index: number) => {
                if (y > doc.page.height - 100) {
                  doc.addPage();
                  y = 30;
                }

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

                // Calcular altura máxima de la fila basada en el contenido
                let maxLines = 1;
                rowData.forEach((cell, cellIndex) => {
                  const cellWidth = collateralColumnWidths[cellIndex];
                  const lines = doc.heightOfString(cell, { width: cellWidth - 4 }) / 8; // 8px por línea
                  maxLines = Math.max(maxLines, Math.ceil(lines));
                });

                const rowHeight = Math.max(20, maxLines * 12); // Mínimo 20px, máximo basado en contenido

                // Fondo alternado para las filas
                const rowColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
                doc.rect(collateralTableX, y - 3, totalCollateralWidth, rowHeight).fill(rowColor);

                rowData.forEach((cell, cellIndex) => {
                  const cellX = collateralTableX + collateralColumnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
                  const cellWidth = collateralColumnWidths[cellIndex];
                  
                  // Color del estado
                  let textColor = '#2c3e50';
                  if (cellIndex === 6) { // Columna de estado
                    textColor = loan.status === 'ACTIVO' ? '#38a169' : 
                               loan.status === 'VENCIDO' ? '#e53e3e' : 
                               loan.status === 'TERMINADO' ? '#3182ce' : '#718096';
                  }
                  
                  // Centrar verticalmente el texto
                  const textHeight = doc.heightOfString(cell, { width: cellWidth - 4 });
                  const verticalOffset = (rowHeight - textHeight) / 2;
                  
                  doc.fontSize(8).fillColor(textColor).text(cell, cellX, y + verticalOffset, { width: cellWidth - 4, align: 'center' });
                });

                y += rowHeight + 2; // Espacio adicional entre filas
              });

              y += 30;

              // DETALLE DE PAGOS - VERSIÓN EXPANDIDA PARA AVALES
              doc.fontSize(12).fillColor('#1a202c').text('DETALLE DE PAGOS - PRÉSTAMOS COMO AVAL', 30, y);
              y += 20;

              loansAsCollateral.forEach((loan: any, loanIndex: number) => {
                // Verificar si necesitamos nueva página
                if (y > doc.page.height - 150) {
                  doc.addPage();
                  y = 30;
                }

                // Encabezado del préstamo como aval
                doc.fontSize(10).fillColor('#2d3748').text(`PRÉSTAMO COMO AVAL ${loanIndex + 1}: ${loan.loanType}`, 30, y);
                y += 12;
                doc.fontSize(8).fillColor('#718096').text(`Cliente: ${loan.clientName} | Fecha: ${formatDate(loan.signDate)} | Monto: ${formatCurrency(loan.amountRequested)} | Estado: ${loan.status}`, 30, y);
                y += 12;

                // Tabla de pagos del préstamo como aval con ancho optimizado
                if (loan.payments && loan.payments.length > 0) {
                  const paymentHeaders = ['Fecha', 'Monto', 'Método', 'N° Pago', 'Balance Antes', 'Balance Después'];
                  const paymentColumnWidths = [70, 60, 50, 40, 70, 70];

                  // Encabezados de la tabla de pagos alineada a la izquierda
                  const totalPaymentWidth = paymentColumnWidths.reduce((a, b) => a + b, 0);
                  const paymentTableX = 30; // Alineado a la izquierda para consistencia
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

                  y += 10;
                } else {
                  doc.fontSize(10).fillColor('#e74c3c').text('No hay pagos registrados para este préstamo', 30, y);
                  y += 20;
                }

                // ✅ NUEVA FUNCIONALIDAD: Mostrar períodos sin pagos para préstamos como aval con diseño profesional
                if (loan.noPaymentPeriods && loan.noPaymentPeriods.length > 0) {
                  // Verificar espacio para la sección completa
                  const estimatedHeight = 50 + (loan.noPaymentPeriods.length * 25);
                  if (y + estimatedHeight > doc.page.height - 100) {
                    doc.addPage();
                    y = 30;
                  }

                  // Encabezado con fondo similar a las tablas
                  doc.fontSize(9).fillColor('#ffffff');
                  doc.rect(30, y, 360, 20).fill('#e74c3c');
                  doc.fillColor('#ffffff').text('PERÍODOS SIN PAGO', 30, y + 6, { width: 360, align: 'center' });
                  y += 25;

                  // Contenedor con borde para los períodos
                  const periodsHeight = loan.noPaymentPeriods.length * 22 + 10;
                  doc.rect(30, y, 360, periodsHeight).stroke('#e74c3c');
                  doc.rect(30, y, 360, periodsHeight).fill('#fef5f5');

                  y += 8;

                  loan.noPaymentPeriods.forEach((period: any, index: number) => {
                    const periodText = period.weekCount === 1 
                      ? `${period.startDateFormatted} (1 semana)`
                      : `${period.startDateFormatted} al ${period.endDateFormatted} (${period.weekCount} semanas)`;
                    
                    // Texto sin símbolo para evitar problemas de codificación
                    doc.fontSize(8).fillColor('#dc2626').text(periodText, 50, y, { width: 330 });
                    y += 18;
                  });

                  y += 15;
                }

                // Resumen del préstamo como aval
                doc.fontSize(10).fillColor('#2c3e50').text(`Total pagado en este préstamo: ${formatCurrency(loan.totalPaid)}`, 30, y);
                y += 15;
                doc.fontSize(10).fillColor('#2c3e50').text(`Deuda pendiente: ${formatCurrency(loan.pendingDebt)}`, 30, y);
                y += 20;

                // Separador entre préstamos como aval
                if (loanIndex < loansAsCollateral.length - 1) {
                  doc.rect(30, y, doc.page.width - 60, 1).fill('#e9ecef');
                  y += 20;
                }
              });
            }

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
