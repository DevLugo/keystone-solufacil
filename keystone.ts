// Welcome to Keystone!
//
// This file is what Keystone uses as the entry-point to your headless backend
//
// Keystone imports the default export of this file, expecting a Keystone configuration object
//   you can find out more at https://keystonejs.com/docs/apis/config

import { config } from '@keystone-6/core'

// to keep this file tidy, we define our schema in a different file
import { lists } from './schema'

// authentication is configured separately here too, but you might move this elsewhere
// when you write your list-level access control functions, as they typically rely on session data
import { withAuth, session } from './auth'
import dotenv from 'dotenv';
import express from 'express';
import PDFDocument from 'pdfkit';

// Load environment variables from .env file
dotenv.config();


// Load environment variables from .env file
dotenv.config();

const app = express();


export default withAuth(
  config({
    db: {
      // we're using sqlite for the fastest startup experience
      //   for more information on what database might be appropriate for you
      //   see https://keystonejs.com/docs/guides/choosing-a-database#title
      provider: 'postgresql',
      url: process.env.DATABASE_URL || '',
    },
    lists,
    session,
    server: {
      extendExpressApp: (app) => {
        app.use('/generate-pdf', (req, res) => {
          const doc = new PDFDocument({ margin: 30 });
          let filename = 'listado_cobranza.pdf';
          // Remove special characters from filename
          filename = encodeURIComponent(filename) + '.pdf';
          // Set headers
          res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
          res.setHeader('Content-type', 'application/pdf');
          // Pipe the PDF into the response
          doc.pipe(res);

          // Add header elements
          const headerY = 25;
          doc.fontSize(18).text('Ruta 1', 30, headerY, { align: 'left', baseline: 'middle' });
          doc.fontSize(18).text('Listado de Cobranza', 0, headerY, { align: 'center', baseline: 'middle' });
          doc.image('./solufacil.png', 450, 10, { width: 100 });
          // Add title and other details
          // Add title and other details
          const subtitleY = headerY + 20;
          doc.fontSize(15).text('Semanal del 10 al 15 de abril', 0, subtitleY, { align: 'center', baseline: 'middle' });


          const detailsY = subtitleY + 30;

          doc.fontSize(12).fillColor('gray').text('Localidad:', 30, detailsY, { align: 'left', baseline: 'middle' });
          doc.fontSize(12).fillColor('black').text('Los divorsiados', 100, detailsY, { align: 'left', baseline: 'middle' });
          doc.fontSize(12).fillColor('gray').text('Lider:', 400, detailsY, { align: 'left', baseline: 'middle' });
          doc.fontSize(12).fillColor('black').text('Stephanie de los angeles cocom cabrera', 450, detailsY, { align: 'left', baseline: 'middle' });
          
          //doc.moveDown().fontSize(30);
          const additionalDetailsY = detailsY + 20;
          doc.fontSize(12).fillColor('black').text(`Total de clientas: ${50}`, 30, additionalDetailsY, { align: 'left' });
          doc.text(`Comisión a pagar a la líder: ${1200}`, 30, additionalDetailsY + 15, { align: 'left' });
          doc.text(`Total de cobranza esperada: ${70000}`, 30, additionalDetailsY + 30, { align: 'left' });


          // Add table headers
          doc.moveDown().fontSize(8);
          const headers = ['NOMBRE', 'TELEFONO', 'ABONO', 'ADEUDO', 'PLAZOS', 'PAGO VDO', 'COBRO SEMANA', 'ABONO PARCIAL', 'F INICIO', 'N° SEMANA', 'AVAL'];
          const tableTop = 150;
          const itemHeight = 20;
          const headerHeight = 30;
          const columnWidths = {
            name: 90,
            phone: 60,
            abono: 30,
            adeudo: 45,
            plazos: 40,
            pagoVdo: 30,
            cobroSemana: 40,
            abonoParcial: 40,
            fInicio: 50,
            nSemana: 40,
            aval: 100,
          };


          // Draw table headers with background and border
          doc.rect(30, tableTop, Object.values(columnWidths).reduce((a, b) => a + b, 0), headerHeight).fillAndStroke('#f0f0f0', '#000');
          doc.fillColor('#000');
          headers.forEach((header, i) => {
            const x = 30 + Object.values(columnWidths).slice(0, i).reduce((a, b) => a + b, 0);
            if (header.includes(' ')) {
              const [firstLine, secondLine] = header.split(' ');
              doc.text(firstLine, x, tableTop + 5, { width: columnWidths[header.toLowerCase()], align: 'left' });
              doc.text(secondLine, x, tableTop + 15, { width: columnWidths[header.toLowerCase()], align: 'left' });
            } else {
              doc.text(header, x, tableTop + 10, { width: columnWidths[header.toLowerCase()], align: 'left' });
            }
          });

          // Add table rows
          // Reset font color for table rows
          doc.fillColor('#000').fontSize(8);
          const payments = [
            // Example data, replace with actual data
            { name: 'Juan Carlos Pérez Rodríguez', phone: '1234567890', abono: '100', adeudo: '500', plazos: '5', pagoVdo: '100', cobroSemana: '100', abonoParcial: '50', fInicio: '01/01/2022', nSemana: '1', aval: 'María López García' },
            { name: 'Ana María González Fernández', phone: '0987654321', abono: '200', adeudo: '1000', plazos: '5', pagoVdo: '200', cobroSemana: '200', abonoParcial: '100', fInicio: '01/01/2022', nSemana: '2', aval: 'José Martínez Sánchez' },
            // Add more rows as needed
          ];

          // Add more payments to fill the page
          for (let i = 0; i < 40; i++) {
            payments.push({
              name: `Cliente ${i + 1} Apellido Apellido`,
              phone: `123456789${i}`,
              abono: `${i * 10}`,
              adeudo: `${i * 50}`,
              plazos: `${i % 5 + 1}`,
              pagoVdo: `${i * 10}`,
              cobroSemana: `${i * 10}`,
              abonoParcial: `${i * 5}`,
              fInicio: `01/01/202${i % 10}`,
              nSemana: `${i % 10}`,
              aval: `Aval ${i + 1} Apellido Apellido`,
            });
          }

          const paddingBottom = 5;
          payments.forEach((payment, rowIndex) => {
            const y = tableTop + headerHeight + rowIndex * (itemHeight + paddingBottom);
            Object.keys(columnWidths).forEach((key, i) => {
              const x = 30 + Object.values(columnWidths).slice(0, i).reduce((a, b) => a + b, 0);
              const paddingLeft = key === 'name' ? 5 : 0;
              const paddingTop = 5;
              const paddingBottom = 5;
              doc.text(payment[key], x + paddingLeft, y + paddingTop, { width: columnWidths[key], align: key === 'name' || key === 'aval' ? 'left' : 'center' });
            });
            // Draw border for each row
            doc.lineWidth(0.5).rect(30, y, Object.values(columnWidths).reduce((a, b) => a + b, 0), itemHeight + paddingBottom).stroke();
          });

          // Draw table borders        
          const drawTableBorders = () => {
            doc.lineWidth(0.5);
            doc.rect(30, tableTop, Object.values(columnWidths).reduce((a, b) => a + b, 0), headerHeight).stroke();
            payments.forEach((payment, rowIndex) => {
              const y = tableTop + headerHeight + rowIndex * itemHeight;
              doc.rect(30, y, Object.values(columnWidths).reduce((a, b) => a + b, 0), itemHeight).stroke();
            });
          };

          drawTableBorders();

          // Finalize the PDF and end the stream
          doc.end();
        });
      },
    }

  })
)
