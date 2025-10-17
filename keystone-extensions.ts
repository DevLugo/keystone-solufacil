import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { generatePaymentChronology, PaymentChronologyItem } from './admin/utils/paymentChronology';

const prisma = new PrismaClient();

export const extendExpressApp = (app: express.Express) => {
  // Endpoint para generar reportes
  
  // Endpoint para recibir webhooks de Telegram
  app.post('/api/telegram-webhook', express.json(), async (req, res) => {
    try {
      console.log('📱 Webhook de Telegram recibido:', JSON.stringify(req.body, null, 2));

      const update = req.body;
      const message = update?.message;

      if (!message) {
        console.log('❌ No se recibió mensaje válido');
        return res.json({ success: false, message: 'No se recibió mensaje válido' });
      }

      const chatId = message.chat?.id?.toString();
      const text = message.text;
      const from = message.from;

      if (!chatId || !text || !from) {
        console.log('❌ Datos del mensaje incompletos');
        return res.json({ success: false, message: 'Datos del mensaje incompletos' });
      }

      console.log('📝 Procesando mensaje:', { chatId, text, from });

      // Procesar comando /start
      if (text === '/start') {
        const name = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
        const username = from.username;

        // Verificar si el usuario ya existe
        const existingUser = await (prisma as any).telegramUser.findUnique({
          where: { chatId }
        });

        if (existingUser) {
          console.log('✅ Usuario ya existe, actualizando actividad');
          await (prisma as any).telegramUser.update({
            where: { chatId },
            data: {
              lastActivity: new Date(),
              isActive: true
            }
          });

          // Enviar respuesta al usuario
          await sendTelegramMessage(chatId, `¡Hola ${name}! Ya estás registrado. Tu actividad ha sido actualizada.`);

          return res.json({
            success: true,
            message: `Usuario ${name} ya registrado. Actividad actualizada.`
          });
        }

        // Crear nuevo usuario
        const newUser = await (prisma as any).telegramUser.create({
          data: {
            chatId,
            name,
            username: username || 'sin_username',
            isActive: true,
            registeredAt: new Date(),
            lastActivity: new Date(),
            reportsReceived: 0,
            isInRecipientsList: false,
            notes: 'Registrado automáticamente via webhook de Telegram'
          }
        });

        console.log('✅ Nuevo usuario de Telegram creado via webhook:', newUser);

        // Enviar respuesta al usuario
        await sendTelegramMessage(chatId, `¡Bienvenido ${name}! Te has registrado exitosamente. Usa /help para ver comandos disponibles.`);

        return res.json({
          success: true,
          message: `Usuario ${name} registrado exitosamente via webhook con ID: ${newUser.id}`
        });
      }

      // Procesar otros comandos
      if (text === '/status') {
        const user = await (prisma as any).telegramUser.findUnique({
          where: { chatId }
        });

        if (user) {
          const statusMessage = `Estado: Activo\nRegistrado: ${user.registeredAt.toLocaleDateString()}\nReportes recibidos: ${user.reportsReceived}`;
          await sendTelegramMessage(chatId, statusMessage);
          return res.json({ success: true, message: statusMessage });
        } else {
          const notRegisteredMessage = 'No estás registrado. Envía /start para registrarte.';
          await sendTelegramMessage(chatId, notRegisteredMessage);
          return res.json({ success: false, message: notRegisteredMessage });
        }
      }

      if (text === '/help') {
        const helpMessage = 'Comandos disponibles:\n/start - Registrarse\n/status - Ver estado\n/help - Esta ayuda';
        await sendTelegramMessage(chatId, helpMessage);
        return res.json({ success: true, message: helpMessage });
      }

      const unknownCommandMessage = `Comando no reconocido: ${text}. Envía /help para ver comandos disponibles.`;
      await sendTelegramMessage(chatId, unknownCommandMessage);
      return res.json({ success: false, message: unknownCommandMessage });

    } catch (error) {
      console.error('❌ Error al procesar webhook de Telegram:', error);
      res.status(500).json({
        success: false,
        message: `Error al procesar webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });


  // Agregar este endpoint en keystone-extensions.ts después del endpoint de historial de cliente

app.post('/export-cartera-pdf', express.json(), async (req, res) => {
  try {
    console.log('📊 Iniciando generación de PDF del reporte de cartera');
    
    const {
      routeName,
      weekRange,
      kpiData,
      weeklyData,
      comparisonData,
      filters
    } = req.body;

    // Validar parámetros requeridos
    if (!routeName || !kpiData || !weeklyData) {
      console.error('❌ Error: Faltan parámetros requeridos');
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    console.log('✅ Parámetros válidos, procediendo con la generación');

    // Crear PDF con diseño profesional
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: 'landscape', // Paisaje para mejor visualización de tablas
      bufferPages: true
    });

    const filename = `reporte_cartera_${routeName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;

    res.setHeader('Content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Funciones de formato
    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount || 0);
    };

    const formatPercent = (value: number): string => {
      return `${value.toFixed(1)}%`;
    };

    const formatDate = (dateString: string): string => {
      return new Date(dateString).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    // Colores corporativos consistentes con el historial
    const colors = {
      primary: '#2c3e50',      // Azul oscuro profesional
      secondary: '#3498db',    // Azul brillante
      success: '#27ae60',      // Verde
      danger: '#e74c3c',       // Rojo
      warning: '#f39c12',      // Naranja
      info: '#16a085',         // Turquesa
      light: '#ecf0f1',        // Gris claro
      dark: '#34495e',         // Gris oscuro
      background: '#ffffff',   // Blanco
      border: '#bdc3c7',       // Gris borde
      headerBg: '#2c3e50',     // Fondo header
      alternateRow: '#f8f9fa'  // Fila alternada
    };

    // ================== HEADER PROFESIONAL ==================
    let y = 30;
    
    // Fondo del header
    doc.rect(0, 0, doc.page.width, 80).fill(colors.primary);
    
    // Logo
    try {
      doc.image('./public/solufacil.png', doc.page.width - 100, 15, { width: 60 });
    } catch (error) {
      console.log('Logo no encontrado, continuando sin él');
    }

    // Título principal
    doc.fontSize(24).fillColor('#ffffff').text('REPORTE DE CARTERA', 40, y, { align: 'left' });
    y += 30;
    
    // Subtítulo con información de ruta y fecha
    doc.fontSize(12).fillColor('#ecf0f1')
      .text(`${routeName} | ${weekRange || 'Semana Actual'}`, 40, y, { align: 'left' });
    
    // Fecha de generación
    doc.fontSize(9).fillColor('#bdc3c7')
      .text(`Generado: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`, 
        doc.page.width - 200, y, { align: 'right', width: 160 });

    y = 100;

    // ================== SECCIÓN DE KPIs ENFOCADOS EN CLIENTES ==================
    doc.fontSize(14).fillColor(colors.dark).text('INDICADORES CLAVE DE CLIENTES', 40, y);
    y += 25;

    // Grid de KPIs (4 columnas)
    const kpiWidth = (doc.page.width - 100) / 4;
    const kpiHeight = 80;
    const kpiStartX = 40;
    
    const kpis = [
      {
        label: 'Clientes Activos',
        value: kpiData.totalActiveClients || 0,
        color: colors.info,
        icon: '👥',
        format: 'number'
      },
      {
        label: 'Clientes Nuevos',
        value: kpiData.totalNewClients || 0,
        color: colors.success,
        icon: '🆕',
        format: 'number'
      },
      {
        label: 'Clientes Renovados',
        value: kpiData.totalRenewedClients || 0,
        color: colors.primary,
        icon: '🔄',
        format: 'number'
      },
      {
        label: '% Pagando',
        value: kpiData.payingPercent || 0,
        color: kpiData.payingPercent >= 80 ? colors.success : colors.warning,
        icon: '💳',
        format: 'percent'
      }
    ];

    kpis.forEach((kpi, index) => {
      const x = kpiStartX + (index * kpiWidth) + (index * 10);
      
      // Tarjeta KPI con sombra
      doc.rect(x, y, kpiWidth - 10, kpiHeight)
        .fillAndStroke('#ffffff', colors.border);
      
      // Barra de color superior
      doc.rect(x, y, kpiWidth - 10, 4).fill(kpi.color);
      
      // Contenido del KPI
      doc.fontSize(10).fillColor(colors.dark)
        .text(kpi.label, x + 10, y + 15, { width: kpiWidth - 20, align: 'center' });
      
      // Valor principal
      let displayValue = '';
      if (kpi.format === 'currency') {
        displayValue = formatCurrency(kpi.value as number);
      } else if (kpi.format === 'percent') {
        displayValue = formatPercent(kpi.value as number);
      } else {
        displayValue = kpi.value.toString();
      }
      
      doc.fontSize(18).fillColor(kpi.color)
        .text(displayValue, x + 10, y + 40, { width: kpiWidth - 20, align: 'center' });
    });

    y += kpiHeight + 30;

    // ================== TABLA SEMANAL DETALLADA ==================
    // Verificar si necesitamos nueva página para la tabla
    if (y > doc.page.height - 200) {
      doc.addPage();
      y = 40;
    }

    // Header de la tabla semanal
    doc.fontSize(16).fillColor(colors.dark).text('DETALLE SEMANAL DE CARTERA', 40, y);
    y += 30;

    // Información de filtros aplicados
    if (filters) {
      doc.fontSize(9).fillColor(colors.dark);
      let filterText = 'Filtros aplicados: ';
      if (filters.weeksWithoutPayment) filterText += `${filters.weeksWithoutPayment} semanas sin pago | `;
      if (filters.includeBadDebt) filterText += 'Incluye cartera muerta | ';
      if (filters.includeOverdue) filterText += 'Incluye vencidos | ';
      doc.text(filterText, 40, y);
      y += 20;
    }

    // ================== TABLA SEMANAL DETALLADA ==================
    if (weeklyData && weeklyData.length > 0) {
      const tableStartX = 40;
      const tableWidth = doc.page.width - 80;
      
      // Definir anchos de columna optimizados para landscape - enfocados en clientes
      const columnWidths = {
        week: 60,
        date: 80,
        activeClients: 70,
        clientChange: 70,
        newClients: 70,
        renewedClients: 70,
        finishedClients: 70,
        cvClients: 70,
        cvChange: 70,
        payingClients: 70,
        payingPercent: 70
      };

      // Headers de tabla con diseño profesional - enfocados en clientes
      doc.rect(tableStartX, y, tableWidth, 30).fill(colors.headerBg);
      doc.fontSize(8).fillColor('#ffffff');
      
              const tableHeaders = [
          { text: 'Semana', width: columnWidths.week },
          { text: 'Fecha', width: columnWidths.date },
          { text: 'Clientes\nActivos', width: columnWidths.activeClients },
          { text: 'Cambio\nClientes', width: columnWidths.clientChange },
          { text: 'Clientes\nNuevos', width: columnWidths.newClients },
          { text: 'Clientes\nRenovados', width: columnWidths.renewedClients },
          { text: 'Clientes\nFinalizados', width: columnWidths.finishedClients },
          { text: 'Clientes\nCV', width: columnWidths.cvClients },
          { text: 'Cambio\nCV', width: columnWidths.cvChange },
          { text: 'Clientes\nPagando', width: columnWidths.payingClients },
          { text: '%\nPagando', width: columnWidths.payingPercent }
        ];

      let headerX = tableStartX;
      tableHeaders.forEach(header => {
        const lines = header.text.split('\n');
        if (lines.length > 1) {
          doc.text(lines[0], headerX + 2, y + 8, { width: header.width - 4, align: 'center' });
          doc.text(lines[1], headerX + 2, y + 18, { width: header.width - 4, align: 'center' });
        } else {
          doc.text(header.text, headerX + 2, y + 12, { width: header.width - 4, align: 'center' });
        }
        headerX += header.width;
      });

      y += 30;

      // Filas de datos semanales
      weeklyData.forEach((week: any, index: number) => {
        // Verificar si necesitamos nueva página
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 40;
          
          // Repetir headers en nueva página
          doc.rect(tableStartX, y, tableWidth, 30).fill(colors.headerBg);
          doc.fontSize(8).fillColor('#ffffff');
          
          headerX = tableStartX;
          tableHeaders.forEach(header => {
            const lines = header.text.split('\n');
            if (lines.length > 1) {
              doc.text(lines[0], headerX + 2, y + 8, { width: header.width - 4, align: 'center' });
              doc.text(lines[1], headerX + 2, y + 18, { width: header.width - 4, align: 'center' });
            } else {
              doc.text(header.text, headerX + 2, y + 12, { width: header.width - 4, align: 'center' });
            }
            headerX += header.width;
          });
          
          y += 30;
        }

        // Alternar color de fondo de filas
        const rowBgColor = index % 2 === 0 ? colors.alternateRow : '#ffffff';
        const rowHeight = 22;
        
        doc.rect(tableStartX, y, tableWidth, rowHeight).fill(rowBgColor);
        
        // Datos de la fila
        doc.fontSize(8).fillColor(colors.dark);
        let dataX = tableStartX;
        
        // Semana
        doc.text(week.weekNumber || `S${index + 1}`, dataX + 2, y + 7, 
          { width: columnWidths.week - 4, align: 'center' });
        dataX += columnWidths.week;
        
        // Fecha
        doc.text(week.dateRange || '', dataX + 2, y + 7, 
          { width: columnWidths.date - 4, align: 'center' });
        dataX += columnWidths.date;
        
        // Clientes activos
        doc.text(week.activeClients?.toString() || '0', dataX + 2, y + 7, 
          { width: columnWidths.activeClients - 4, align: 'center' });
        dataX += columnWidths.activeClients;
        
        // Cambio de clientes
        const clientChangeColor = week.clientChange > 0 ? colors.success : 
                                 week.clientChange < 0 ? colors.danger : colors.dark;
        doc.fillColor(clientChangeColor)
          .text((week.clientChange > 0 ? '+' : '') + (week.clientChange || 0), dataX + 2, y + 7, 
            { width: columnWidths.clientChange - 4, align: 'center' });
        dataX += columnWidths.clientChange;
        
        // Clientes nuevos
        doc.fillColor(colors.success)
          .text(week.newClients?.toString() || '0', dataX + 2, y + 7, 
            { width: columnWidths.newClients - 4, align: 'center' });
        dataX += columnWidths.newClients;
        
        // Clientes renovados
        doc.fillColor(colors.primary)
          .text(week.renewedClients?.toString() || '0', dataX + 2, y + 7, 
            { width: columnWidths.renewedClients - 4, align: 'center' });
        dataX += columnWidths.renewedClients;
        
        // Clientes finalizados
        doc.fillColor(colors.dark)
          .text(week.finishedClients?.toString() || '0', dataX + 2, y + 7, 
            { width: columnWidths.finishedClients - 4, align: 'center' });
        dataX += columnWidths.finishedClients;
        
        // Clientes CV
        doc.fillColor(colors.danger)
          .text(week.cvClients?.toString() || '0', dataX + 2, y + 7, 
            { width: columnWidths.cvClients - 4, align: 'center' });
        dataX += columnWidths.cvClients;
        
        // Cambio de CV
        const cvChangeColor = week.cvChange > 0 ? colors.danger : 
                             week.cvChange < 0 ? colors.success : colors.dark;
        doc.fillColor(cvChangeColor)
          .text((week.cvChange > 0 ? '+' : '') + (week.cvChange || 0), dataX + 2, y + 7, 
            { width: columnWidths.cvChange - 4, align: 'center' });
        dataX += columnWidths.cvChange;
        
        // Clientes pagando
        doc.fillColor(colors.success)
          .text(week.payingClients?.toString() || '0', dataX + 2, y + 7, 
            { width: columnWidths.payingClients - 4, align: 'center' });
        dataX += columnWidths.payingClients;
        
        // Porcentaje pagando
        const payingPercent = week.payingPercent || 0;
        const payingColor = payingPercent >= 80 ? colors.success : 
                           payingPercent >= 60 ? colors.warning : colors.danger;
        doc.fillColor(payingColor)
          .text(formatPercent(payingPercent), dataX + 2, y + 7, 
            { width: columnWidths.payingPercent - 4, align: 'center' });
        
        // Línea divisoria sutil
        doc.strokeColor(colors.border).lineWidth(0.5)
          .moveTo(tableStartX, y + rowHeight)
          .lineTo(tableStartX + tableWidth, y + rowHeight)
          .stroke();
        
        y += rowHeight;
      });

      // ================== RESUMEN FINAL ==================
      y += 30;
      
      if (y > doc.page.height - 150) {
        doc.addPage();
        y = 40;
      }

      // Caja de resumen con diseño elegante
      const summaryBoxHeight = 120;
      doc.rect(40, y, doc.page.width - 80, summaryBoxHeight)
        .fillAndStroke('#f8f9fa', colors.border);
      
      // Título del resumen
      doc.rect(40, y, doc.page.width - 80, 30).fill(colors.primary);
      doc.fontSize(12).fillColor('#ffffff')
        .text('RESUMEN EJECUTIVO', 50, y + 10);
      
      y += 40;
      
      // Contenido del resumen en columnas - enfocado en clientes
      const summaryData = {
        totalActiveClients: weeklyData.reduce((sum: number, w: any) => sum + (w.activeClients || 0), 0),
        totalNewClients: weeklyData.reduce((sum: number, w: any) => sum + (w.newClients || 0), 0),
        totalRenewedClients: weeklyData.reduce((sum: number, w: any) => sum + (w.renewedClients || 0), 0),
        totalFinishedClients: weeklyData.reduce((sum: number, w: any) => sum + (w.finishedClients || 0), 0),
        totalCV: weeklyData.reduce((sum: number, w: any) => sum + (w.cvClients || 0), 0),
        totalPayingClients: weeklyData.reduce((sum: number, w: any) => sum + (w.payingClients || 0), 0),
        averagePayingPercent: weeklyData.reduce((sum: number, w: any) => sum + (w.payingPercent || 0), 0) / weeklyData.length
      };

      // Primera fila del resumen
      const summaryColumns1 = [
        {
          label: 'Promedio Clientes Activos del Mes',
          value: Math.round(summaryData.totalActiveClients / weeklyData.length).toString(),
          color: colors.primary
        },
        {
          label: 'Total Clientes Nuevos',
          value: summaryData.totalNewClients.toString(),
          color: colors.success
        },
        {
          label: 'Total Clientes Renovados',
          value: summaryData.totalRenewedClients.toString(),
          color: colors.info
        }
      ];

      const colWidth = (doc.page.width - 100) / 3;
      summaryColumns1.forEach((item, index) => {
        const colX = 50 + (index * colWidth);
        doc.fontSize(9).fillColor(colors.dark)
          .text(item.label, colX, y, { width: colWidth - 10, align: 'center' });
        doc.fontSize(14).fillColor(item.color)
          .text(item.value, colX, y + 15, { width: colWidth - 10, align: 'center' });
      });

      y += 40;

      // Segunda fila del resumen
      const summaryColumns2 = [
        {
          label: 'Total Clientes Finalizados',
          value: summaryData.totalFinishedClients.toString(),
          color: colors.dark
        },
        {
          label: 'Promedio Clientes CV del Mes',
          value: Math.round(summaryData.totalCV / weeklyData.length).toString(),
          color: colors.danger
        },
        {
          label: 'Promedio Clientes Pagando del Mes',
          value: Math.round(summaryData.totalPayingClients / weeklyData.length).toString(),
          color: colors.success
        }
      ];

      summaryColumns2.forEach((item, index) => {
        const colX = 50 + (index * colWidth);
        doc.fontSize(9).fillColor(colors.dark)
          .text(item.label, colX, y, { width: colWidth - 10, align: 'center' });
        doc.fontSize(14).fillColor(item.color)
          .text(item.value, colX, y + 15, { width: colWidth - 10, align: 'center' });
      });

      y += 40;

      // Tercera fila del resumen
      const summaryColumns3 = [
        {
          label: '% Pagando Promedio del Mes',
          value: formatPercent(summaryData.averagePayingPercent),
          color: summaryData.averagePayingPercent >= 80 ? colors.success : colors.danger
        }
      ];

      summaryColumns3.forEach((item, index) => {
        const colX = 50 + (index * colWidth);
        doc.fontSize(9).fillColor(colors.dark)
          .text(item.label, colX, y, { width: colWidth - 10, align: 'center' });
        doc.fontSize(14).fillColor(item.color)
          .text(item.value, colX, y + 15, { width: colWidth - 10, align: 'center' });
      });

      // ================== DESGLOSE POR LOCALIDAD ==================
      y += 60;
      
      if (y > doc.page.height - 200) {
        doc.addPage();
        y = 40;
      }

      doc.fontSize(14).fillColor(colors.dark).text('DESGLOSE POR LOCALIDAD', 40, y);
      y += 30;

      // Obtener datos de localidades desde el reporte
      if (req.body.localityData) {
        const localityData = req.body.localityData;
        
        // Título de la sección
        doc.fontSize(14).fillColor(colors.primary).text('DESGLOSE POR LOCALIDAD - ENFOQUE EN CAMBIOS', 40, y);
        y += 25;

        // Para cada semana, mostrar todas las localidades
        if (req.body.weeklyData && req.body.weeklyData.length > 0) {
          console.log('📊 Datos semanales recibidos:', req.body.weeklyData);
          req.body.weeklyData.forEach((weekData: any, weekIndex: number) => {
            const week = weekData.weekNumber || `Semana ${weekIndex + 1}`;
            if (y > doc.page.height - 200) {
              doc.addPage();
              y = 40;
            }

            // Título de la semana
            doc.fontSize(12).fillColor(colors.secondary).text(`SEMANA ${weekIndex + 1}: ${week}`, 40, y);
            y += 20;

            // Headers de la tabla para esta semana
            const localityTableStartX = 40;
            const localityTableWidth = doc.page.width - 80;
            
            // Headers de tabla por localidad para esta semana
            const localityColumnWidths = {
              locality: 120,
              clientChange: 60,
              clientTotal: 60,
              cvChange: 60,
              cvTotal: 60,
              newClients: 60,
              renewedClients: 60,
              finishedClients: 60,
              payingPercent: 60
            };

            // Headers
            doc.rect(localityTableStartX, y, localityTableWidth, 30).fill(colors.headerBg);
            doc.fontSize(8).fillColor('#ffffff');
            
            const localityHeaders = [
              { text: 'Localidad', width: localityColumnWidths.locality },
              { text: 'Cambio\nClientes', width: localityColumnWidths.clientChange },
              { text: 'Total\nClientes', width: localityColumnWidths.clientTotal },
              { text: 'Cambio\nCV', width: localityColumnWidths.cvChange },
              { text: 'Total\nCV', width: localityColumnWidths.cvTotal },
              { text: 'Nuevos', width: localityColumnWidths.newClients },
              { text: 'Renovados', width: localityColumnWidths.renewedClients },
              { text: 'Finalizados', width: localityColumnWidths.finishedClients },
              { text: '%\nPagando', width: localityColumnWidths.payingPercent }
            ];

            let localityHeaderX = localityTableStartX;
            localityHeaders.forEach(header => {
              const lines = header.text.split('\n');
              if (lines.length > 1) {
                doc.text(lines[0], localityHeaderX + 2, y + 8, { width: header.width - 4, align: 'center' });
                doc.text(lines[1], localityHeaderX + 2, y + 18, { width: header.width - 4, align: 'center' });
              } else {
                doc.text(header.text, localityHeaderX + 2, y + 12, { width: header.width - 4, align: 'center' });
              }
              localityHeaderX += header.width;
            });

            y += 30;

            // Filas de localidades para esta semana
            Object.entries(localityData).forEach(([localityName, data]: [string, any], localityIndex: number) => {
              if (y > doc.page.height - 80) {
                doc.addPage();
                y = 40;
              }

              const weekData = data.weeklyData?.find((w: any) => w.week === week);
              if (!weekData) return;

              const rowBgColor = localityIndex % 2 === 0 ? colors.alternateRow : '#ffffff';
              const rowHeight = 20;
              
              doc.rect(localityTableStartX, y, localityTableWidth, rowHeight).fill(rowBgColor);
              
              doc.fontSize(8).fillColor(colors.dark);
              let localityDataX = localityTableStartX;
              
              // Nombre de localidad
              doc.text(localityName, localityDataX + 5, y + 6, { width: localityColumnWidths.locality - 10 });
              localityDataX += localityColumnWidths.locality;
              
              // Cambio de clientes (vs semana anterior)
              let clientChange = weekData.clientChange || 0;
              const clientChangeColor = clientChange > 0 ? colors.success : clientChange < 0 ? colors.danger : colors.dark;
              doc.fillColor(clientChangeColor)
                .text(clientChange > 0 ? `+${clientChange}` : clientChange.toString(), localityDataX + 2, y + 6, 
                  { width: localityColumnWidths.clientChange - 4, align: 'center' });
              localityDataX += localityColumnWidths.clientChange;
              
              // Total de clientes activos
              doc.text(weekData.activeClients?.toString() || '0', localityDataX + 2, y + 6, 
                { width: localityColumnWidths.clientTotal - 4, align: 'center' });
              localityDataX += localityColumnWidths.clientTotal;
              
              // Cambio de CV (vs semana anterior)
              let cvChange = weekData.cvChange || 0;
              const cvChangeColor = cvChange < 0 ? colors.success : cvChange > 0 ? colors.danger : colors.dark;
              doc.fillColor(cvChangeColor)
                .text(cvChange > 0 ? `+${cvChange}` : cvChange.toString(), localityDataX + 2, y + 6, 
                  { width: localityColumnWidths.cvChange - 4, align: 'center' });
              localityDataX += localityColumnWidths.cvChange;
              
              // Total de CV
              doc.fillColor(colors.danger)
                .text(weekData.cv?.toString() || '0', localityDataX + 2, y + 6, 
                  { width: localityColumnWidths.cvTotal - 4, align: 'center' });
              localityDataX += localityColumnWidths.cvTotal;
              
              // Clientes nuevos
              doc.fillColor(colors.success)
                .text(weekData.grantedNew?.toString() || '0', localityDataX + 2, y + 6, 
                  { width: localityColumnWidths.newClients - 4, align: 'center' });
              localityDataX += localityColumnWidths.newClients;
              
              // Clientes renovados
              doc.fillColor(colors.primary)
                .text(weekData.grantedRenewed?.toString() || '0', localityDataX + 2, y + 6, 
                  { width: localityColumnWidths.renewedClients - 4, align: 'center' });
              localityDataX += localityColumnWidths.renewedClients;
              
              // Clientes finalizados
              doc.fillColor(colors.dark)
                .text(weekData.finished?.toString() || '0', localityDataX + 2, y + 6, 
                  { width: localityColumnWidths.finishedClients - 4, align: 'center' });
              localityDataX += localityColumnWidths.finishedClients;
              
              // Porcentaje pagando
              const payingPercent = weekData.payingPercent || 0;
              const payingColor = payingPercent >= 80 ? colors.success : 
                                 payingPercent >= 60 ? colors.warning : colors.danger;
              doc.fillColor(payingColor)
                .text(formatPercent(payingPercent), localityDataX + 2, y + 6, 
                  { width: localityColumnWidths.payingPercent - 4, align: 'center' });
              
              y += rowHeight;
            });

            y += 20; // Espacio entre semanas
          });
        }
      }
    }

    // ================== PIE DE PÁGINA ==================
    // Solo agregar pie de página a las páginas que realmente existen
    const currentPageCount = doc.bufferedPageRange().count;
    console.log(`📄 Agregando pie de página a ${currentPageCount} páginas`);
    
    for (let i = 0; i < currentPageCount; i++) {
      doc.switchToPage(i);
      
      // Línea divisoria
      doc.strokeColor(colors.border).lineWidth(0.5)
        .moveTo(40, doc.page.height - 50)
        .lineTo(doc.page.width - 40, doc.page.height - 50)
        .stroke();
      
      // Número de página
      doc.fontSize(8).fillColor(colors.dark)
        .text(`Página ${i + 1} de ${currentPageCount}`, 40, doc.page.height - 40, 
          { align: 'center', width: doc.page.width - 80 });
      
      // Información adicional
      doc.fontSize(7).fillColor(colors.border)
        .text('Documento generado automáticamente por el Sistema de Gestión de Cartera', 
          40, doc.page.height - 30, { align: 'center', width: doc.page.width - 80 });
    }

    console.log('📄 Finalizando PDF');
    const finalPageCount = doc.bufferedPageRange().count;
    console.log(`📊 Total de páginas generadas: ${finalPageCount}`);
    doc.end();
    console.log('✅ PDF de reporte de cartera generado exitosamente');

  } catch (error) {
    console.error('❌ Error generando PDF del reporte de cartera:', error);
    console.error('📋 Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    res.status(500).json({ error: 'Error interno del servidor al generar PDF' });
  }
});
  // Endpoint de prueba para verificar que funcione
  app.get('/api/telegram-webhook', (req, res) => {
    res.json({
      success: true,
      message: 'Endpoint de webhook de Telegram funcionando',
      instructions: 'Configura tu bot para enviar POST a este endpoint'
    });
  });

  // Endpoint de test hardcoded para probar localmente
  app.post('/api/test-telegram-local', async (req, res) => {
    try {
      console.log('🧪 Test local de Telegram iniciado');

      // Simular un mensaje /start hardcoded
      const testMessage = {
        message: {
          chat: {
            id: 999888777,
            type: 'private'
          },
          from: {
            id: 999888777,
            first_name: 'Usuario',
            last_name: 'de Prueba',
            username: 'testuser_local'
          },
          text: '/start',
          date: Math.floor(Date.now() / 1000)
        }
      };

      console.log('📝 Procesando mensaje de prueba:', testMessage);

      const chatId = testMessage.message.chat.id.toString();
      const text = testMessage.message.text;
      const from = testMessage.message.from;

      // Procesar comando /start
      if (text === '/start') {
        const name = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
        const username = from.username;

        // Verificar si el usuario ya existe
        const existingUser = await (prisma as any).telegramUser.findUnique({
          where: { chatId }
        });

        if (existingUser) {
          console.log('✅ Usuario ya existe, actualizando actividad');
          await (prisma as any).telegramUser.update({
            where: { chatId },
            data: {
              lastActivity: new Date(),
              isActive: true
            }
          });

          return res.json({
            success: true,
            message: `Usuario ${name} ya registrado. Actividad actualizada.`,
            user: existingUser
          });
        }

        // Crear nuevo usuario
        const newUser = await (prisma as any).telegramUser.create({
          data: {
            chatId,
            name,
            username: username || 'sin_username',
            isActive: true,
            registeredAt: new Date(),
            lastActivity: new Date(),
            reportsReceived: 0,
            isInRecipientsList: false,
            notes: 'Registrado automáticamente via test local'
          }
        });

        console.log('✅ Nuevo usuario de Telegram creado via test local:', newUser);

        return res.json({
          success: true,
          message: `Usuario ${name} registrado exitosamente via test local con ID: ${newUser.id}`,
          user: newUser
        });
      }

      res.json({ success: false, message: 'Comando no reconocido en test local' });

    } catch (error) {
      console.error('❌ Error en test local de Telegram:', error);
      res.status(500).json({
        success: false,
        message: `Error en test local: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Endpoint para control del sistema de cron
  app.post('/api/cron-control', express.json(), async (req, res) => {
    try {
      console.log('🔍 API de cron recibió request:', req.method, req.body);

      const { action, configId, config } = req.body;
      console.log('📋 Acción solicitada:', action);

      if (!action) {
        return res.status(400).json({ error: 'Acción requerida' });
      }

      // Importar el servicio real de cron
      const {
        startCronSystem,
        stopCronSystem,
        getCronStatus,
        rescheduleConfig,
        unscheduleConfig
      } = require('./admin/services/cronService');

      switch (action) {
        case 'start':
          // Iniciar el sistema de cron
          console.log('🚀 Iniciando sistema de cron...');
          try {
            // Obtener configuraciones activas de la base de datos
            const activeConfigs = await (prisma as any).reportConfig.findMany({
              where: { isActive: true },
              include: {
                routes: true,
                recipients: true
              }
            });

            console.log(`📋 Configuraciones activas encontradas: ${activeConfigs.length}`);

            // Iniciar el sistema real de cron
            startCronSystem(activeConfigs, { prisma }, async (configId: string) => {
              console.log(`📤 Enviando reporte para configuración: ${configId}`);

              try {
                // Obtener la configuración del reporte
                const reportConfig = activeConfigs.find(config => config.id === configId);
                if (!reportConfig) {
                  console.log(`❌ Configuración no encontrada para ID: ${configId}`);
                  return;
                }

                // Importar y usar el servicio real de reportes
                const { processCronReport } = require('./admin/services/cronReportService');

                // Procesar el reporte usando el servicio real
                await processCronReport(reportConfig, prisma);

                console.log(`✅ Reporte ${reportConfig.name} procesado correctamente por el cron`);

              } catch (error) {
                console.error(`❌ Error procesando reporte ${configId}:`, error);
              }
            });

            res.status(200).json({
              success: true,
              message: 'Sistema de cron iniciado',
              status: 'running'
            });
          } catch (error) {
            console.error('❌ Error iniciando cron:', error);
            res.status(500).json({
              success: false,
              error: 'Error iniciando sistema de cron',
              details: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
          break;

        case 'stop':
          // Detener el sistema de cron
          console.log('⏹️ Deteniendo sistema de cron...');
          try {
            stopCronSystem();
            res.status(200).json({
              success: true,
              message: 'Sistema de cron detenido',
              status: 'stopped'
            });
          } catch (error) {
            console.error('❌ Error deteniendo cron:', error);
            res.status(500).json({
              success: false,
              error: 'Error deteniendo sistema de cron',
              details: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
          break;

        case 'status':
          // Obtener estado del sistema de cron
          console.log('📊 Solicitando estado del cron...');
          try {
            const status = getCronStatus();
            console.log('✅ Estado del cron obtenido:', status);
            res.status(200).json({
              success: true,
              status
            });
          } catch (error) {
            console.log('❌ Error obteniendo estado del cron, devolviendo estado por defecto:', error);
            const defaultStatus = {
              isRunning: false,
              activeTasks: 0,
              taskIds: []
            };
            console.log('🔄 Devolviendo estado por defecto:', defaultStatus);
            res.status(200).json({
              success: true,
              status: defaultStatus
            });
          }
          break;

        case 'reschedule':
          // Reprogramar una configuración específica
          console.log('📅 Reprogramando configuración:', config?.name);
          if (!config) {
            return res.status(400).json({ error: 'Configuración requerida para reprogramar' });
          }

          try {
            // Obtener contexto de base de datos
            const context = { prisma };

            console.log('🔄 Deteniendo cron actual para reprogramar...');
            stopCronSystem();

            console.log('🔄 Iniciando cron con nueva configuración...');
            // Iniciar el sistema real de cron con la nueva configuración
            startCronSystem([config], { prisma }, async (configId: string) => {
              console.log(`📤 Enviando reporte para configuración: ${configId}`);
              // Aquí implementarías la lógica real de envío de reportes
              return Promise.resolve();
            });

            res.status(200).json({
              success: true,
              message: `Configuración ${config.name} reprogramada`
            });
          } catch (error) {
            console.error('❌ Error reprogramando configuración:', error);
            res.status(500).json({
              success: false,
              error: 'Error reprogramando configuración',
              details: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
          break;

        case 'unschedule':
          // Desprogramar una configuración específica
          console.log('⏹️ Desprogramando configuración:', configId);
          if (!configId) {
            return res.status(400).json({ error: 'ID de configuración requerido' });
          }

          try {
            unscheduleConfig(configId);
            res.status(200).json({
              success: true,
              message: `Configuración ${configId} desprogramada`
            });
          } catch (error) {
            console.error('❌ Error desprogramando configuración:', error);
            res.status(500).json({
              success: false,
              error: 'Error desprogramando configuración',
              details: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
          break;

        default:
          res.status(400).json({ error: 'Acción no válida' });
      }
    } catch (error) {
      console.error('❌ Error en API de cron:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });


  app.post('/api/upload-image', async (req, res) => {
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
          // Obtener parámetros del body
          const body = (req as any).body || {};
          const folder = body.folder;
          const loanData = body.loan ? JSON.parse(body.loan) : null;
          const documentType = body.documentType;

          // Usar el sistema de almacenamiento simplificado
          const { simpleUploadDocument } = await import('./utils/storage/simple');
          
          // Subir usando el sistema de almacenamiento configurable
          const result = await simpleUploadDocument(
            file.buffer,
            loanData,
            documentType || 'general',
            {
              customConfig: body.customConfig,
              metadata: {
                originalName: file.originalname,
                mimeType: file.mimetype,
                fileSize: file.size // Cambiar 'size' por 'fileSize' para evitar conflicto
              }
            }
          );

          // Convertir resultado al formato esperado por el frontend
          const response = {
            public_id: result.public_id,
            secure_url: result.secure_url,
            url: result.url,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            provider: result.provider
          };

          res.status(200).json(response);
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

  app.get('/api/generar-listados', async (req, res) => {
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

      // Obtener préstamos activos (misma lógica que abonosTab.tsx)
      const activeLoans = await prisma.loan.findMany({
        where: {
          AND: [
            { finishedDate: null },           // ✅ Solo préstamos NO finalizados
            { pendingAmountStored: { gt: "0" } }, // ✅ Solo con monto pendiente > 0
            { excludedByCleanup: null },     // ✅ NO excluidos por limpieza
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
          collaterals: {
            include: {
              phones: { select: { number: true } }
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
        orderBy: [
          { signDate: 'asc' },
          { id: 'asc' }
        ]
      }) as any[];

      // Ya no necesitamos filtrar aquí porque se hace en la consulta Prisma
      const filteredActiveLoans = activeLoans;
      


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

      // Calcular número de semana del mes actual ANTES del loop de payments
      // Primera semana de agosto, segunda semana de agosto, etc.
      const currentMonth = weekStart.getMonth();
      const currentYear = weekStart.getFullYear();
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      
      // Calcular qué semana del mes es la semana actual
      // Usar el día del mes para calcular la semana
      const dayOfMonth = weekStart.getDate();
      const weekNumberInMonth = Math.ceil(dayOfMonth / 7);

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
        // El boundary siempre debe ser el mismo (lunes siguiente a la semana de firma)
        // No se debe desplazar para semana siguiente
        const boundaryForCalc = new Date(boundary);
        
        // Número de semana actual (para mostrar en el listado)
        // Calcular semanas desde la firma del préstamo
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksElapsedSinceBoundary = Math.max(0, Math.floor((getMonday(weekEnd).getTime() - getMonday(boundaryForCalc).getTime()) / msPerWeek));
        const nSemanaValue = weeksElapsedSinceBoundary + 1;
        
        // ✅ LÓGICA CORREGIDA PARA VDO BASADA EN HISTORIAL-CLIENTE.TSX:
        // Usar la misma lógica que detecta faltas en el historial de cliente
        
        let arrearsAmount = 0;
        
        // Función para obtener el lunes de la semana (igual que en historial-cliente.tsx)
        const getMondayOfWeek = (date: Date): Date => {
          const monday = new Date(date);
          const dayOfWeek = monday.getDay();
          const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          monday.setDate(monday.getDate() + diff);
          return monday;
        };
        
        // Función para obtener el domingo de la semana (igual que en historial-cliente.tsx)
        const getSundayOfWeek = (date: Date): Date => {
          const sunday = new Date(date);
          const dayOfWeek = sunday.getDay();
          const diff = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
          sunday.setDate(sunday.getDate() + diff);
          return sunday;
        };
        
        // Calcular hasta qué fecha evaluar (igual que en historial-cliente.tsx)
        const isNextWeek = weekMode === 'next';
        const endOfLastWeek = isNextWeek ? weekEnd : new Date(weekStart.getTime() - 1);
        
        // Generar todas las semanas desde la segunda semana después de la firma (igual que historial-cliente.tsx)
        const signDate = new Date(loan.signDate);
        const weeks: { monday: Date, sunday: Date }[] = [];
        let currentMonday = getMondayOfWeek(signDate);
        currentMonday.setDate(currentMonday.getDate() + 7); // Primera semana no se espera pago
        
        while (currentMonday <= endOfLastWeek) {
          const sunday = getSundayOfWeek(currentMonday);
          weeks.push({ 
            monday: new Date(currentMonday), 
            sunday: new Date(sunday) 
          });
          currentMonday.setDate(currentMonday.getDate() + 7);
        }
        
        // Obtener fechas de pago (igual que en historial-cliente.tsx)
        const paymentDates = (loan.payments || [])
          .filter(payment => payment.amount > 0)
          .map(payment => new Date(payment.receivedAt || payment.createdAt))
          .sort((a, b) => a.getTime() - b.getTime());
        
        let weeksWithoutPayment = 0;
        let surplusAccumulated = 0; // Sobrepago acumulado
        
        for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
          const week = weeks[weekIndex];
          
          const now = new Date();
          if (week.sunday > now) {
            break; // No evaluar semanas futuras
          }
          
          // Calcular pagado antes de esta semana
          const paidBeforeWeek = (loan.payments || []).reduce((sum: number, p: any) => {
            const paymentDate = new Date(p.receivedAt || p.createdAt);
            return paymentDate < week.monday ? sum + parseFloat((p.amount || 0).toString()) : sum;
          }, 0);
          
          const expectedBefore = weekIndex * expectedWeeklyPayment;
          
          // Calcular sobrepago acumulado antes de esta semana
          surplusAccumulated = paidBeforeWeek - expectedBefore;
          
          // Buscar pagos en esta semana específica
          const paymentsInWeek = (loan.payments || []).filter((p: any) => {
            const paymentDate = new Date(p.receivedAt || p.createdAt);
            return paymentDate >= week.monday && paymentDate <= week.sunday;
          });
          
          const weeklyPaid = paymentsInWeek.reduce((sum: number, p: any) => 
            sum + parseFloat((p.amount || 0).toString()), 0
          );
          
          // Verificar si la semana está cubierta (pago directo + sobrepago)
          const isWeekCovered = (surplusAccumulated + weeklyPaid) >= expectedWeeklyPayment && expectedWeeklyPayment > 0;
          
          // Solo contar como falta si NO está cubierta
          if (!isWeekCovered) {
            weeksWithoutPayment++;
          }
          
          // Actualizar sobrepago para la siguiente semana
          surplusAccumulated = surplusAccumulated + weeklyPaid - expectedWeeklyPayment;
        }
        
        // Calcular PAGO VDO = semanas sin pago × pago semanal esperado
        arrearsAmount = Math.max(0, Math.min(
          weeksWithoutPayment * expectedWeeklyPayment,
          pendingAmountStored
        ));
        
        // Debug específico para casos problemáticos
        if (loan.borrower?.personalData?.fullName?.includes('JUANA SANTIAGO LOPEZ') || arrearsAmount > 0) {
          console.log(`🔍 VDO Debug - ${loan.borrower?.personalData?.fullName}:`);
          console.log(`   - Pago semanal esperado: ${expectedWeeklyPayment}`);
          console.log(`   - Total de semanas evaluadas: ${weeks.length}`);
          console.log(`   - Semanas sin pago: ${weeksWithoutPayment}`);
          console.log(`   - PAGO VDO calculado: ${arrearsAmount}`);
          console.log(`   - Monto pendiente almacenado: ${pendingAmountStored}`);
          console.log(`   - Rango de semana: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
          console.log(`   - Fechas de pago: ${paymentDates.map(d => d.toLocaleDateString()).join(', ')}`);
          console.log(`   - Sobrepago final acumulado: ${surplusAccumulated}`);
          console.log(`   - Fecha actual: ${new Date().toLocaleDateString()}`);
        }
        

        // Para abono parcial, calcular solo pagos de la semana actual
        const totalPaidInCurrentWeek = (loan.payments || []).reduce((sum: number, p: any) => {
          const d = new Date(p.receivedAt || p.createdAt);
          if (d >= weekStart && d <= weekEnd) { // Solo semana actual
            return sum + parseFloat((p.amount || 0).toString());
          }
          return sum;
        }, 0);

        // Abono parcial = sobrepago en la semana actual
        // Si pagó más del pago semanal esperado, la diferencia es el abono parcial
        const abonoParcialAmount = Math.max(0, totalPaidInCurrentWeek - expectedWeeklyPayment);
        
        // Debug para verificar cálculos de abono parcial
        if (loan.borrower?.personalData?.fullName?.includes('Test') || abonoParcialAmount > 0) {
          console.log(`💰 Abono Parcial Debug - ${loan.borrower?.personalData?.fullName}:`);
          console.log(`   - Pago semanal esperado: ${expectedWeeklyPayment}`);
          console.log(`   - Pagado en semana actual: ${totalPaidInCurrentWeek}`);
          console.log(`   - Abono parcial (sobrepago): ${abonoParcialAmount}`);
          console.log(`   - Rango de semana: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
        }

        // Pago VDO (monto total no pagado hasta la semana actual)

        // Número de semana: semanas globales desde el lunes posterior a la semana de firma
        // (ya calculado arriba como weeksElapsedSinceBoundary + 1)

        // Texto de AVAL obtenido del primer collateral asociado al loan
        let avalDisplay = '';
        if (loan.collaterals && loan.collaterals.length > 0) {
          const primaryCollateral = loan.collaterals[0];
          const avalName = primaryCollateral.fullName || '';
          const avalPhone = primaryCollateral.phones?.[0]?.number || '';
          avalDisplay = [avalName, avalPhone].filter(Boolean).join(', ');
        }

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
          nSemana: String(nSemanaValue),
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

      // ✅ CORREGIDO: Calcular comisión esperada basada en loanPaymentComission de cada préstamo
      const totalComisionEsperada = filteredActiveLoans.reduce((sum: number, loan: any) => {
        if (loan.loantype?.loanPaymentComission) {
          const commission = parseFloat(loan.loantype.loanPaymentComission.toString());
          return sum + commission;
        }
        return sum;
      }, 0);
      
      // Debug específico para "Nuevo Progreso"
      const nuevoProgresoLoans = filteredActiveLoans.filter((loan: any) => {
        const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name || '';
        return locality.toLowerCase().includes('nuevo progreso');
      });
      console.log(`   - Préstamos en "Nuevo Progreso": ${nuevoProgresoLoans.length}`);
      
      // Debug de comisiones
      const loansWithCommission = filteredActiveLoans.filter((loan: any) => 
        loan.loantype?.loanPaymentComission && parseFloat(loan.loantype.loanPaymentComission.toString()) > 0
      );
      console.log(`   - Préstamos con comisión > 0: ${loansWithCommission.length}`);
      console.log(`   - Comisión total esperada: ${totalComisionEsperada}`);

      // weeksElapsedSinceBoundary ya calculado antes del loop

      // Crear PDF con diseño de keystone2.ts
      const doc = new PDFDocument({ margin: 30 });
      
      // Generar nombre de archivo con formato: localidad-semana-fecha
      const localitySlug = (localityName as string).replace(/\s+/g, '_').toLowerCase();
      const currentDate = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const currentMonthName = new Date().toLocaleDateString('es-MX', { month: 'long' });
      
      // Usar el número de semana del mes calculado anteriormente
      const weekNumber = weekMode === 'next' ? weekNumberInMonth + 1 : weekNumberInMonth;
      const filename = `listado_${localitySlug}_semana_${weekNumber}_${currentMonthName}_${currentDate}.pdf`;

      res.setHeader('Content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-type', 'application/pdf');
      doc.pipe(res);

      // Generar fecha semanal
      const weekRange = `${weekStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} al ${weekEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`;

      // Header elements (diseño de keystone2.ts)
      const headerY = 25;
      doc.fontSize(14).text(routeName as string, 30, headerY, { align: 'left', baseline: 'middle' });
      doc.fontSize(14).text('Listado de Cobranza', 0, headerY, { align: 'center', baseline: 'middle' });
      doc.image('./public/solufacil.png', 450, 10, { width: 100 });

      const subtitleY = headerY + 20;
      doc.fontSize(10).text(`Semanal del ${weekRange}`, 0, subtitleY, { align: 'center', baseline: 'middle' });

      const detailsY = subtitleY + 30;
      doc.fontSize(8).fillColor('gray').text('Localidad:', 30, detailsY, { align: 'left', baseline: 'middle' });
      doc.fontSize(8).fillColor('black').text(localityName as string, 100, detailsY, { align: 'left', baseline: 'middle' });
      doc.fontSize(8).fillColor('gray').text('Lider:', 400, detailsY, { align: 'left', baseline: 'middle' });
      doc.fontSize(8).fillColor('black').text((leaderName as string) || 'Sin asignar', 450, detailsY, { align: 'left', baseline: 'middle' });

      const additionalDetailsY = detailsY + 15; // Reducido de 20 a 15
      doc.fontSize(8).fillColor('black').text(`Total de clientes: ${totalClientes}`, 30, additionalDetailsY, { align: 'left' });
      doc.text(`Comisión a pagar al líder: ${formatCurrency(totalComisionEsperada)}`, 30, additionalDetailsY + 12, { align: 'left' }); // Reducido de 15 a 12
      doc.text(`Total de cobranza esperada: ${formatCurrency(totalCobranzaEsperada)}`, 30, additionalDetailsY + 24, { align: 'left' }); // Reducido de 30 a 24

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
        const headerHeight = 20; // Reducido de 30 a 20

        doc.rect(30, y, Object.values(columnWidths).reduce((a, b) => a + b, 0), headerHeight).fillAndStroke('#f0f0f0', '#000');
        doc.fillColor('#000').fontSize(6); // Reducido de 7 a 6
        headers.forEach((header, i) => {
          const x = 30 + Object.values(columnWidths).slice(0, i).reduce((a, b) => a + b, 0);
          const columnWidth = Object.values(columnWidths)[i];

          if (header.includes(' ')) {
            const [firstLine, secondLine] = header.split(' ');
            doc.text(firstLine, x, y + 3, { width: columnWidth, align: 'center' }); // Ajustado de 5 a 3
            doc.text(secondLine, x, y + 12, { width: columnWidth, align: 'center' }); // Ajustado de 15 a 12
          } else {
            doc.text(header, x, y + 8, { width: columnWidth, align: 'center' }); // Ajustado de 10 a 8
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
      let currentY = drawTableHeaders(additionalDetailsY + 35); // Reducido de 50 a 35
      let pageNumber = 1;
      addPageNumber(pageNumber);

      const paddingBottom = 1; // Reducido de 3 a 1
      const lineHeight = 8; // Reducido de 10 a 8
      const pageHeight = doc.page.height - doc.page.margins.bottom;

      // Dibujar filas con datos reales de la DB
      payments.forEach((payment, rowIndex) => {
        // Calcular alto real considerando tanto el nombre como el aval
        doc.fontSize(5); // Reducido de 6 a 5
        const columnKeys = Object.keys(columnWidths);
        
        // Calcular altura del nombre
        const nameOffset = columnKeys.slice(0, columnKeys.indexOf('name')).reduce((sum, key) => sum + (columnWidths as any)[key], 0);
        const nameStartX = 30 + nameOffset + 2; // Reducido de 3 a 2
        const nameBlockWidth = columnWidths.name - 4; // Reducido de 6 a 4
        const nameTextHeight = doc.heightOfString(payment.name || '', { width: nameBlockWidth });
        
        // Calcular altura del aval (puede ser muy largo)
        const avalOffset = columnKeys.slice(0, columnKeys.indexOf('aval')).reduce((sum, key) => sum + (columnWidths as any)[key], 0);
        const avalStartX = 30 + avalOffset + 2;
        const avalBlockWidth = columnWidths.aval - 4;
        const avalTextHeight = doc.heightOfString(payment.aval || '', { width: avalBlockWidth });
        
        // Usar la altura máxima entre nombre y aval
        const maxTextHeight = Math.max(nameTextHeight, avalTextHeight);
        const rowHeight = Math.max(maxTextHeight + paddingBottom + 3, 14); // Reducido de 16 a 14

        if (currentY + rowHeight > pageHeight) {
          // Add page number to current page before creating new one
          addPageNumber(pageNumber);
          doc.addPage();
          pageNumber++;
          currentY = drawTableHeaders(30);
        }

        // Dibujar nombre en bloque con auto-wrap
        doc.text(payment.name || '', nameStartX, currentY + 2, { width: nameBlockWidth, align: 'left' }); // Reducido de 3 a 2

        // Dibujar columnas individuales para evitar problemas de TypeScript
        const drawColumn = (key: string, x: number, width: number) => {
          const paddingLeft = key === 'name' ? 2 : 0; // Reducido de 3 a 2
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
              // Para aval, alinear al inicio (no centrar) para texto largo
              doc.text(value, x + 2, currentY + 2, { width: width - 4, align: 'left' }); // Reducido de 3 a 2 y de 6 a 4
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

      // Add page number to the final page
      addPageNumber(pageNumber);
      
      // Verificar que la respuesta no haya sido enviada antes de finalizar el PDF
      if (!res.headersSent) {
        doc.end();
      } else {
        console.error('Error: No se pudo finalizar el PDF porque la respuesta ya fue enviada');
      }

    } catch (error) {
      console.error('Error generando PDF:', error);
      
      // Verificar si la respuesta ya fue enviada
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error interno del servidor al generar PDF' });
      } else {
        console.error('Error: No se pudo enviar respuesta de error porque ya se envió una respuesta');
      }
    }
  });

  app.get('/resumen', async (req, res) => {
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
        include: {
          loan: {
            include: {
              lead: {
                include: {
                  personalData: {
                    include: {
                      addresses: {
                        include: {
                          location: true
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
                  addresses: {
                    include: {
                      location: true
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
  app.post('/export-client-history-pdf', express.json(), async (req, res) => {
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
        loansAsCollateral,
        detailed = false
      } = req.body;

      // Validar parámetros requeridos
      if (!clientName) {
        console.error('❌ Error: clientName es requerido');
        return res.status(400).json({ error: 'clientName es requerido' });
      }

      console.log('✅ Parámetros válidos, procediendo con la generación');
      console.log(`📊 Modo: ${detailed ? 'Detallado' : 'Resumen'}`);

      // Crear PDF profesional y moderno
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        layout: 'portrait',
        info: {
          Title: `Historial Crediticio - ${clientName}`,
          Author: 'SoluFácil',
          Subject: 'Historial Crediticio del Cliente',
          Creator: 'SoluFácil Sistema de Gestión'
        }
      });
      const filename = `historial_${clientName.replace(/\s+/g, '_')}_${detailed ? 'completo' : 'resumen'}.pdf`;

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

      // Función para limpiar el tipo de préstamo (remover porcentaje de interés)
      const cleanLoanType = (loanType: string): string => {
        if (!loanType) return 'N/A';
        // Remover porcentajes y texto relacionado con interés
        return loanType
          .replace(/\s*-?\s*\d+(\.\d+)?%.*$/i, '') // Remover "- X%" y todo lo que sigue
          .replace(/\s*\(\d+(\.\d+)?%.*\)$/i, '') // Remover "(X%...)"
          .replace(/\s*\d+(\.\d+)?%.*$/i, '') // Remover "X%..." al final
          .trim();
      };

      // Funciones auxiliares para cálculos estadísticos
      const calculateLoanStats = (loans: any[]) => {
        if (!loans || loans.length === 0) return null;
        
        console.log('📊 Calculando estadísticas para', loans.length, 'préstamos');
        console.log('📋 Datos de préstamos:', loans.map(l => ({ 
          signDate: l.signDate, 
          finishedDate: l.finishedDate, 
          status: l.status,
          noPaymentPeriods: l.noPaymentPeriods?.length || 0
        })));
        
        // Usar tanto finishedDate como status para determinar préstamos completados
        const completedLoans = loans.filter(loan => 
          (loan.finishedDate && loan.finishedDate !== null) || 
          loan.status === 'TERMINADO' || 
          loan.status === 'FINALIZADO'
        );
        
        console.log('✅ Préstamos completados encontrados:', completedLoans.length);
        
        const failedPayments = loans.reduce((total, loan) => {
          return total + (loan.noPaymentPeriods?.length || 0);
        }, 0);
        
        const avgWeeksToComplete = completedLoans.length > 0 
          ? Math.round(completedLoans.reduce((sum, loan) => {
              const startDate = new Date(loan.signDate);
              const endDate = loan.finishedDate ? new Date(loan.finishedDate) : new Date();
              const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
              return sum + Math.max(weeks, 0); // Evitar semanas negativas
            }, 0) / completedLoans.length)
          : 0;
        
        // Calcular fallos promedio de manera más precisa
        const avgFailuresPerLoan = loans.length > 0 
          ? Math.round((failedPayments / loans.length) * 100) / 100 // Más precisión
          : 0;
        
        const result = {
          totalLoans: loans.length,
          completedLoans: completedLoans.length,
          avgWeeksToComplete,
          totalFailures: failedPayments,
          avgFailuresPerLoan: avgFailuresPerLoan
        };
        
        console.log('📊 Estadísticas calculadas:', result);
        return result;
      };

      // Header moderno y profesional
      const headerHeight = 90;
      
      // Fondo azul profesional para el header
      doc.rect(0, 0, doc.page.width, headerHeight).fill('#1e40af');

      // Logo (si existe) - más grande
      try {
        doc.image('./public/solufacil.png', doc.page.width - 100, 10, { width: 80 });
      } catch (e) {
        // Si no hay logo, continuamos sin él
      }

      // Título principal con tipografía moderna
      doc.fontSize(24).fillColor('#ffffff').text('HISTORIAL CREDITICIO', 40, 20, { align: 'left' });
      doc.fontSize(11).fillColor('#e2e8f0').text(`${detailed ? 'Reporte Completo' : 'Reporte Resumen'} - Generado: ${new Date().toLocaleDateString('es-SV')} ${new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}`, 40, 45, { align: 'left' });
      
      // Línea decorativa
      doc.rect(40, 70, doc.page.width - 80, 2).fill('#ffffff');

      // Información del cliente con diseño moderno
      let y = 120;
      
      // Card de información del cliente (calculado dinámicamente)
      let clientCardHeight = 90; // Base height
      if (clientDui) clientCardHeight += 18;
      if (clientPhones && clientPhones.length > 0) clientCardHeight += 18;
      if (clientAddresses && clientAddresses.length > 0) {
        clientCardHeight += 15 + (clientAddresses.length * 12);
      }
      
      doc.roundedRect(40, y, doc.page.width - 80, clientCardHeight, 8).fill('#f0f9ff');
      doc.roundedRect(40, y, doc.page.width - 80, clientCardHeight, 8).stroke('#1e40af');
      
      y += 15;
      doc.fontSize(14).fillColor('#1e40af').text('INFORMACION DEL CLIENTE', 55, y, { underline: true });
      y += 25;

      doc.fontSize(12).fillColor('#1a202c').text(`Nombre: ${clientName}`, 55, y);
      y += 18;
      
      if (clientDui) {
        doc.fontSize(10).fillColor('#4a5568').text(`DUI: ${clientDui}`, 55, y);
        y += 15;
      }

      if (clientPhones && clientPhones.length > 0) {
        doc.fontSize(10).fillColor('#4a5568').text(`Telefonos: ${clientPhones.join(', ')}`, 55, y);
        y += 15;
      }

      if (clientAddresses && clientAddresses.length > 0) {
        doc.fontSize(10).fillColor('#4a5568').text('Direcciones:', 55, y);
        y += 12;
        clientAddresses.forEach((addr: any) => {
          doc.fontSize(9).fillColor('#718096').text(`${addr.street}, ${addr.city}, ${addr.location} (${addr.route})`, 70, y);
          y += 12;
        });
      }

      // RESUMEN EJECUTIVO - Solo en modo resumen
      if (!detailed && (loansAsClient?.length > 0 || loansAsCollateral?.length > 0)) {
        // Card de resumen ejecutivo
        doc.roundedRect(40, y, doc.page.width - 80, 120, 8).fill('#f0f9ff');
        doc.roundedRect(40, y, doc.page.width - 80, 120, 8).stroke('#1e40af');
        
        y += 15;
        doc.fontSize(16).fillColor('#1e40af').text('RESUMEN EJECUTIVO', 55, y);
        y += 30;
        
        // Métricas principales en grid
        const totalLoans = (loansAsClient?.length || 0) + (loansAsCollateral?.length || 0);
        const activeLoans = (summary?.activeLoansAsClient || 0) + (summary?.activeLoansAsCollateral || 0);
        
        // Calcular deuda pendiente real del préstamo actual
        let pendingDebt = 0;
        if (loansAsClient && loansAsClient.length > 0) {
          const currentLoan = loansAsClient[0]; // Préstamo más reciente
          console.log('📊 Calculando deuda pendiente del préstamo actual:');
          console.log(`- Monto solicitado: ${currentLoan.amountRequested}`);
          console.log(`- PendingDebt del objeto: ${currentLoan.pendingDebt}`);
          console.log(`- Pagos registrados: ${currentLoan.payments?.length || 0}`);
          
          if (currentLoan.pendingDebt !== undefined && currentLoan.pendingDebt !== null) {
            pendingDebt = currentLoan.pendingDebt;
            console.log(`- Usando pendingDebt del objeto: ${pendingDebt}`);
          } else {
            // Si no hay pendingDebt en los datos, calcularlo
            const totalPaid = currentLoan.payments?.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0) || 0;
            pendingDebt = Math.max(0, (currentLoan.amountRequested || 0) - totalPaid);
            console.log(`- Total pagado: ${totalPaid}`);
            console.log(`- Deuda pendiente calculada: ${pendingDebt}`);
          }
        }
        
        // Primera fila de métricas
        doc.fontSize(11).fillColor('#1e40af');
        doc.text('Total de Relaciones Crediticias:', 55, y);
        doc.fontSize(12).fillColor('#1e40af').text(totalLoans.toString(), 250, y);
        doc.fontSize(11).fillColor('#1e40af').text('Prestamos Activos:', 350, y);
        doc.fontSize(12).fillColor('#1e40af').text(activeLoans.toString(), 480, y);
        y += 20;
        
        // Segunda fila de métricas
        doc.fontSize(11).fillColor('#1e40af').text('Deuda Pendiente:', 55, y);
        doc.fontSize(12).fillColor(pendingDebt > 0 ? '#dc2626' : '#16a34a').text(formatCurrency(pendingDebt), 250, y);
        y += 20;
        
        // Indicador de cumplimiento basado en pagos semanales contemplando sobrepagos
        const calculateComplianceScore = (loans: any[]) => {
          if (!loans || loans.length === 0) return 0;
          
          let totalExpectedPayments = 0;
          let totalMissedPayments = 0;

          console.log('📊 Calculando índice de cumplimiento considerando sobrepagos...');

          loans.forEach((loan, index) => {
            // Construir LoanData para usar la misma lógica de cronología que la UI
            const loanData = {
              id: loan.id,
              signDate: loan.signDate,
              weekDuration: loan.weekDuration || 16,
              status: loan.status,
              finishedDate: loan.finishedDate,
              amountRequested: loan.amountRequested,
              totalAmountDue: loan.totalAmountDue,
              payments: (loan.payments || []).map((p: any) => ({
                id: p.id,
                receivedAt: p.receivedAt,
                receivedAtFormatted: p.receivedAtFormatted,
                amount: p.amount,
                paymentMethod: p.paymentMethod,
                balanceBeforePayment: p.balanceBeforePayment,
                balanceAfterPayment: p.balanceAfterPayment,
                paymentNumber: p.paymentNumber
              }))
            } as any;

            const chronology = generatePaymentChronology(loanData);
            // Semanas evaluadas = semanas presentes en la cronología (PAYMENT o NO_PAYMENT)
            const weekSet = new Set<number>();
            chronology.forEach(item => {
              if (item.weekIndex) weekSet.add(item.weekIndex);
            });
            const expectedWeeks = weekSet.size;

            // Faltas reales = NO_PAYMENT con coverageType === 'MISS'
            const missedWeeks = chronology.filter(item => item.type === 'NO_PAYMENT' && item.coverageType === 'MISS').length;

            totalExpectedPayments += expectedWeeks;
            totalMissedPayments += missedWeeks;

            console.log(`Préstamo ${index + 1}: semanas=${expectedWeeks}, faltas reales=${missedWeeks}`);
          });
          
          if (totalExpectedPayments === 0) return { score: 0, expectedWeeks: 0, missedWeeks: 0 };
          
          // Calcular porcentaje de cumplimiento
          const complianceScore = Math.max(0, Math.round(((totalExpectedPayments - totalMissedPayments) / totalExpectedPayments) * 100));
          
          console.log(`📊 Total semanas evaluadas: ${totalExpectedPayments}, Total fallos: ${totalMissedPayments}, Score: ${complianceScore}%`);
          
          return { score: complianceScore, expectedWeeks: totalExpectedPayments, missedWeeks: totalMissedPayments };
        };
        
        const compliance = calculateComplianceScore(loansAsClient || []);
        const reliabilityScore = typeof compliance === 'number' ? compliance : compliance.score;
        const expectedWeeksDisplay = typeof compliance === 'number' ? 0 : compliance.expectedWeeks;
        const missedWeeksDisplay = typeof compliance === 'number' ? 0 : compliance.missedWeeks;
        const paidWeeksDisplay = Math.max(0, expectedWeeksDisplay - missedWeeksDisplay);
        doc.fontSize(11).fillColor('#1e40af').text('Indice de Cumplimiento:', 55, y);
        doc.fontSize(12).fillColor(reliabilityScore >= 80 ? '#16a34a' : reliabilityScore >= 60 ? '#f59e0b' : '#dc2626').text(`${reliabilityScore}%`, 250, y);
        // Mostrar detalle (pagadas/esperadas), ej. 15/20
        doc.fontSize(10).fillColor('#1e40af').text(`(${paidWeeksDisplay}/${expectedWeeksDisplay})`, 320, y);
        
        y += 40;
      }



      // PRÉSTAMOS COMO CLIENTE - Nueva implementación
      if (loansAsClient && loansAsClient.length > 0) {
        // Calcular estadísticas
        const clientStats = calculateLoanStats(loansAsClient);
        
        // Header de sección con diseño moderno
        doc.roundedRect(40, y, doc.page.width - 80, 40, 6).fill('#1e40af');
        doc.fontSize(16).fillColor('#ffffff').text('PRESTAMOS COMO CLIENTE', 55, y + 12);
        y += 50;

        if (detailed) {
          // MODO DETALLADO: Mostrar todos los préstamos con pagos completos
          loansAsClient.forEach((loan: any, loanIndex: number) => {
            if (y > doc.page.height - 200) {
              doc.addPage();
              y = 40;
            }

            // Card del préstamo
            const loanCardHeight = 60 + (loan.payments?.length || 0) * 20 + (loan.noPaymentPeriods?.length || 0) * 15;
            doc.roundedRect(40, y, doc.page.width - 80, Math.min(loanCardHeight, 300), 6).fill('#f7fafc');
            doc.roundedRect(40, y, doc.page.width - 80, Math.min(loanCardHeight, 300), 6).stroke('#cbd5e0');
            
            y += 15;
            doc.fontSize(12).fillColor('#2d3748').text(`PRÉSTAMO ${loanIndex + 1}: ${cleanLoanType(loan.loanType)}`, 55, y);
            y += 20;
            
            // Información básica del préstamo
            doc.fontSize(10).fillColor('#4a5568');
            doc.text(`Fecha: ${formatDate(loan.signDate)}`, 55, y);
            doc.text(`Monto: ${formatCurrency(loan.amountRequested)}`, 250, y);
            y += 15;
            doc.text(`Estado: ${loan.status}`, 55, y);
            doc.text(`Líder: ${loan.leadName}`, 250, y);
            y += 25;

            // Historial cronológico de pagos y faltas (mismo que en resumen individual)
            if (loan.payments && loan.payments.length > 0) {
              doc.fontSize(10).fillColor('#2d3748').text('Historial Cronologico de Pagos:', 55, y);
              y += 15;

              // Usar función utilitaria común para generar cronología
              const loanData = {
                id: loan.id,
                signDate: loan.signDate,
                weekDuration: loan.weekDuration || 16,
                status: loan.status,
                finishedDate: loan.finishedDate,
                totalAmountDue: loan.totalAmountDue,
                amountRequested: loan.amountRequested,
                payments: loan.payments?.map((payment: any) => ({
                  id: payment.id,
                  receivedAt: payment.receivedAt,
                  receivedAtFormatted: payment.receivedAtFormatted,
                  amount: payment.amount,
                  paymentMethod: payment.paymentMethod,
                  balanceBeforePayment: payment.balanceBeforePayment,
                  balanceAfterPayment: payment.balanceAfterPayment,
                  paymentNumber: payment.paymentNumber
                })) || []
              };
              
              const chronology = generatePaymentChronology(loanData);
              
              // Convertir a formato del PDF con información de sobrepagos
              const chronologicalEvents = chronology.map((item: PaymentChronologyItem) => ({
                date: new Date(item.date),
                type: item.type === 'PAYMENT' ? 'payment' : 'no_payment',
                amount: item.amount || 0,
                paymentNumber: item.paymentNumber || null,
                description: item.description,
                week: item.weekIndex || 1,
                coverageType: item.coverageType || 'MISS',
                weeklyExpected: item.weeklyExpected || 0,
                weeklyPaid: item.weeklyPaid || 0,
                surplusBefore: item.surplusBefore || 0,
                surplusAfter: item.surplusAfter || 0
              }));
              
              // Si fue renovado, agregar nota informativa
              const isRenewed = loan.status === 'RENOVADO' || loan.status === 'RENOVADO';
              if (isRenewed) {
                chronologicalEvents.push({
                  date: new Date(loan.finishedDate || loan.signDate),
                  type: 'renewal',
                  amount: 0,
                  paymentNumber: null,
                  description: `Préstamo renovado - Semanas posteriores no evaluadas`,
                  week: (loan.weekDuration || 16) + 1
                });
              }
              
              // Ordenar por fecha real
              chronologicalEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

              if (chronologicalEvents.length > 0) {
                const eventHeaders = ['Fecha', 'Tipo', 'Monto', 'Descripcion'];
                const availableWidth = doc.page.width - 120;
                const eventColumnWidths = [
                  Math.floor(availableWidth * 0.25), // 25% para fecha
                  Math.floor(availableWidth * 0.15), // 15% para tipo
                  Math.floor(availableWidth * 0.2),  // 20% para monto  
                  Math.floor(availableWidth * 0.4)   // 40% para descripción
                ];
                const totalEventWidth = eventColumnWidths.reduce((a, b) => a + b, 0);
                const eventTableX = 55;

              // Encabezados
              doc.fontSize(8).fillColor('#ffffff');
                doc.rect(eventTableX, y, totalEventWidth, 18).fill('#1e40af');
              doc.fillColor('#ffffff');
                eventHeaders.forEach((header, index) => {
                  const headerX = eventTableX + eventColumnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                  doc.text(header, headerX + 5, y + 6, { width: eventColumnWidths[index] - 10, align: 'center' });
              });
              y += 20;

                // Filas de eventos (todos los eventos) con corte agresivo para evitar páginas en blanco
                chronologicalEvents.forEach((event: any, eventIndex: number) => {
                  // Corte MUY agresivo: si estamos en el 70% de la página, cambiar
                  const pageHeight = doc.page.height;
                  const currentPagePercentage = (y / pageHeight) * 100;
                  const rowHeight = 16;
                  
                  if (currentPagePercentage > 70) {
                    // Cambiar página MUY temprano para evitar páginas en blanco
                    doc.addPage();
                    y = 40;
                    
                    // Recrear encabezados de la tabla en la nueva página
                    doc.fontSize(8).fillColor('#ffffff');
                    doc.rect(eventTableX, y, totalEventWidth, 18).fill('#1e40af');
                    doc.fillColor('#ffffff');
                    eventHeaders.forEach((header, index) => {
                      const headerX = eventTableX + eventColumnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                      doc.text(header, headerX + 5, y + 6, { width: eventColumnWidths[index] - 10, align: 'center' });
                    });
                    y += 20;
                  }

                  // Dibujar fila de la tabla con colores según sobrepagos
                  let eventRowColor = eventIndex % 2 === 0 ? '#f0f9ff' : '#ffffff';
                  
                  // Aplicar colores según el tipo de cobertura (igual que en el frontend)
                  if (event.coverageType === 'COVERED_BY_SURPLUS') {
                    eventRowColor = '#E0F2FE'; // Azul claro - cubierto por sobrepago
                  } else if (event.coverageType === 'PARTIAL') {
                    eventRowColor = '#FEF9C3'; // Amarillo claro - pago parcial
                  } else if (event.coverageType === 'MISS' && event.type === 'no_payment') {
                    eventRowColor = '#FEE2E2'; // Rojo claro - falta sin pago
                  }
                  
                  doc.rect(eventTableX, y - 2, totalEventWidth, rowHeight).fill(eventRowColor);

                  // Mejorar descripción para mostrar información de sobrepagos
                  let enhancedDescription = event.description;
                  if (event.coverageType === 'COVERED_BY_SURPLUS' && event.type === 'no_payment') {
                    enhancedDescription = 'Sin pago (cubierto por sobrepago previo)';
                  } else if (event.coverageType === 'COVERED_BY_SURPLUS' && event.type === 'payment') {
                    enhancedDescription = `${event.description} (con sobrepago)`;
                  } else if (event.coverageType === 'PARTIAL') {
                    enhancedDescription = `${event.description} (pago parcial)`;
                  }

                  const eventData = [
                    formatDate(event.date.toISOString().split('T')[0]),
                    event.type === 'payment' ? 'PAGO' : event.type === 'renewal' ? 'RENOVADO' : 'SIN PAGO',
                    event.type === 'payment' ? formatCurrency(event.amount) : '-',
                    enhancedDescription
                  ];

                  eventData.forEach((cell, cellIndex) => {
                    const cellX = eventTableX + eventColumnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
                    let cellColor = '#2d3748'; // Color por defecto
                    
                    // Aplicar colores de texto según el tipo de cobertura
                    if (event.coverageType === 'MISS' && event.type === 'no_payment') {
                      cellColor = '#b91c1c'; // Rojo para faltas reales
                    } else if (event.coverageType === 'COVERED_BY_SURPLUS') {
                      cellColor = '#1e40af'; // Azul para sobrepagos
                    } else if (event.coverageType === 'PARTIAL') {
                      cellColor = '#d97706'; // Naranja para pagos parciales
                    } else if (event.type === 'renewal') {
                      cellColor = '#f59e0b';
                    }
                    
                    doc.fontSize(7).fillColor(cellColor).text(cell, cellX + 5, y + 4, { width: eventColumnWidths[cellIndex] - 10, align: 'center' });
                  });
                  y += rowHeight;
                });
              }
            }

            y += 20;
          });

        } else {
          // MODO RESUMEN: Mostrar estadísticas y solo detalles del último préstamo
          
          // Estadísticas generales
          if (clientStats) {
            doc.roundedRect(40, y, doc.page.width - 80, 100, 6).fill('#f0f9ff');
            doc.roundedRect(40, y, doc.page.width - 80, 100, 6).stroke('#1e40af');
            
            y += 15;
            doc.fontSize(12).fillColor('#1e40af').text('RESUMEN ESTADISTICO', 55, y);
            y += 25;
            
            // Grid de estadísticas
            const statsData = [
              { label: 'Total de Prestamos:', value: clientStats.totalLoans.toString() },
              { label: 'Prestamos Completados:', value: clientStats.completedLoans.toString() },
              { label: 'Promedio de Semanas:', value: `${clientStats.avgWeeksToComplete} semanas` },
              { label: 'Promedio de Fallos:', value: `${clientStats.avgFailuresPerLoan} por prestamo` }
            ];
            
            statsData.forEach((stat, index) => {
              const x = index % 2 === 0 ? 55 : 300;
              const currentY = y + Math.floor(index / 2) * 20;
              
              doc.fontSize(9).fillColor('#1e40af').text(stat.label, x, currentY);
              doc.fontSize(9).fillColor('#1e40af').text(stat.value, x + 120, currentY);
            });
            
            y += 60;
          }

          // Detalles del último préstamo (más reciente)
          const latestLoan = loansAsClient[0]; // Asumiendo que están ordenados por fecha desc
          if (latestLoan) {
            // Calcular altura necesaria para el card del préstamo actual
            const estimatedHeight = 150 + (latestLoan.payments?.length || 0) * 18;
            
            // Solo agregar nueva página si realmente no hay espacio
            if (y > doc.page.height - Math.min(estimatedHeight, 200)) {
              doc.addPage();
              y = 40;
            }
            
            y += 20;
            
            // Card del préstamo actual
            const currentLoanHeight = 120 + (latestLoan.payments?.length || 0) * 16;
            doc.roundedRect(40, y, doc.page.width - 80, Math.min(currentLoanHeight, 400), 6).fill('#f0f9ff');
            doc.roundedRect(40, y, doc.page.width - 80, Math.min(currentLoanHeight, 400), 6).stroke('#1e40af');
            
            y += 15;
            doc.fontSize(14).fillColor('#1e40af').text('PRESTAMO ACTUAL/RECIENTE', 55, y);
            y += 25;
            
            // Información del préstamo actual
            doc.fontSize(11).fillColor('#2d3748');
            doc.text(`Tipo: ${cleanLoanType(latestLoan.loanType)}`, 55, y);
            doc.text(`Estado: ${latestLoan.status}`, 300, y);
            y += 18;
            doc.text(`Fecha: ${formatDate(latestLoan.signDate)}`, 55, y);
            doc.text(`Monto: ${formatCurrency(latestLoan.amountRequested)}`, 300, y);
            y += 18;
            doc.text(`Deuda Pendiente: ${formatCurrency(latestLoan.pendingDebt)}`, 55, y);
            y += 25;

            // Historial unificado de pagos y periodos sin pago
            if (latestLoan.payments && latestLoan.payments.length > 0) {
              // Salto de página para la tabla de historial
              doc.addPage();
              y = 40;
              
              // Header de la nueva página
              doc.roundedRect(40, y, doc.page.width - 80, 40, 6).fill('#1e40af');
              doc.fontSize(16).fillColor('#ffffff').text('HISTORIAL CRONOLOGICO DE PAGOS', 55, y + 12);
              y += 60;

              // Usar función utilitaria común para generar cronología
              const loanData = {
                id: latestLoan.id,
                signDate: latestLoan.signDate,
                weekDuration: latestLoan.weekDuration || 16,
                // Proveer montos para calcular weeklyExpected y sobrepagos
                amountRequested: latestLoan.amountRequested,
                totalAmountDue: latestLoan.totalAmountDue,
                payments: latestLoan.payments?.map((payment: any) => ({
                  id: payment.id,
                  receivedAt: payment.receivedAt,
                  receivedAtFormatted: payment.receivedAtFormatted,
                  amount: payment.amount,
                  paymentMethod: payment.paymentMethod,
                  balanceBeforePayment: payment.balanceBeforePayment,
                  balanceAfterPayment: payment.balanceAfterPayment,
                  paymentNumber: payment.paymentNumber
                })) || []
              };
              
              const chronology = generatePaymentChronology(loanData);
              
              // Convertir a formato del PDF con información de sobrepagos
              const chronologicalEvents = chronology.map((item: PaymentChronologyItem) => ({
                date: new Date(item.date),
                type: item.type === 'PAYMENT' ? 'payment' : 'no_payment',
                amount: item.amount || 0,
                paymentNumber: item.paymentNumber || null,
                description: item.description,
                week: item.weekIndex || 1,
                coverageType: item.coverageType || 'MISS',
                weeklyExpected: item.weeklyExpected || 0,
                weeklyPaid: item.weeklyPaid || 0,
                surplusBefore: item.surplusBefore || 0,
                surplusAfter: item.surplusAfter || 0
              }));
              
              // Si fue renovado, agregar nota informativa
              const isRenewed = latestLoan.status === 'RENOVADO' || latestLoan.status === 'RENOVADO';
              if (isRenewed) {
                chronologicalEvents.push({
                  date: new Date(latestLoan.finishedDate || latestLoan.signDate),
                  type: 'renewal',
                  amount: 0,
                  paymentNumber: null,
                  description: `Préstamo renovado - Semanas posteriores no evaluadas`,
                  week: (latestLoan.weekDuration || 16) + 1
                });
              }
              
              // Ordenar por fecha real (no por semana)
              chronologicalEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

              // Solo mostrar la tabla si hay eventos cronológicos
              if (chronologicalEvents.length > 0) {
                const eventHeaders = ['Fecha', 'Tipo', 'Monto', 'Descripcion'];
                const availableWidth = doc.page.width - 120; // Ancho disponible
                const eventColumnWidths = [
                  Math.floor(availableWidth * 0.25), // 25% para fecha
                  Math.floor(availableWidth * 0.15), // 15% para tipo
                  Math.floor(availableWidth * 0.2),  // 20% para monto  
                  Math.floor(availableWidth * 0.4)   // 40% para descripción
                ];
                const totalEventWidth = eventColumnWidths.reduce((a, b) => a + b, 0);
                const eventTableX = 55;

                // Encabezados de la tabla
                doc.fontSize(10).fillColor('#ffffff');
                doc.rect(eventTableX, y, totalEventWidth, 20).fill('#1e40af');
              
              // Asegurar que el texto sea blanco sobre fondo azul
              doc.fillColor('#ffffff');
                eventHeaders.forEach((header, index) => {
                  const headerX = eventTableX + eventColumnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                  doc.text(header, headerX + 5, y + 6, { width: eventColumnWidths[index] - 10, align: 'center' });
                });
                y += 25;

                // Filas de eventos cronológicos con corte agresivo para evitar páginas en blanco
                chronologicalEvents.forEach((event: any, eventIndex: number) => {
                  // Corte MUY agresivo: si estamos en el 70% de la página, cambiar
                  const pageHeight = doc.page.height;
                  const currentPagePercentage = (y / pageHeight) * 100;
                  const rowHeight = 18;
                  
                  if (currentPagePercentage > 70) {
                    // Cambiar página MUY temprano para evitar páginas en blanco
                  doc.addPage();
                  y = 40;
                    
                    // Recrear encabezados de la tabla en la nueva página
                    doc.fontSize(10).fillColor('#ffffff');
                    doc.rect(eventTableX, y, totalEventWidth, 20).fill('#1e40af');
                    doc.fillColor('#ffffff');
                    eventHeaders.forEach((header, index) => {
                      const headerX = eventTableX + eventColumnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                      doc.text(header, headerX + 5, y + 6, { width: eventColumnWidths[index] - 10, align: 'center' });
                    });
                    y += 25;
                  }

                  // Colorear fila según coverageType (igual que UI)
                  let eventRowColor = eventIndex % 2 === 0 ? '#f0f9ff' : '#ffffff';
                  if (event.coverageType === 'COVERED_BY_SURPLUS') {
                    eventRowColor = '#E0F2FE'; // Azul claro - cubierto por sobrepago
                  } else if (event.coverageType === 'PARTIAL') {
                    eventRowColor = '#FEF9C3'; // Amarillo - pago parcial
                  } else if (event.coverageType === 'MISS' && event.type === 'no_payment') {
                    eventRowColor = '#FEE2E2'; // Rojo claro - falta real
                  }
                  doc.rect(eventTableX, y - 2, totalEventWidth, rowHeight).fill(eventRowColor);

                  // Descripción enriquecida
                  let enhancedDescription = event.description;
                  if (event.coverageType === 'COVERED_BY_SURPLUS' && event.type === 'no_payment') {
                    enhancedDescription = 'Sin pago (cubierto por sobrepago previo)';
                  } else if (event.coverageType === 'COVERED_BY_SURPLUS' && event.type === 'payment') {
                    enhancedDescription = `${event.description} (con sobrepago)`;
                  } else if (event.coverageType === 'PARTIAL') {
                    enhancedDescription = `${event.description} (pago parcial)`;
                  }

                  const eventData = [
                    formatDate(event.date.toISOString().split('T')[0]),
                    event.type === 'payment' ? 'PAGO' : event.type === 'renewal' ? 'RENOVADO' : 'SIN PAGO',
                    event.type === 'payment' ? formatCurrency(event.amount) : '-',
                    enhancedDescription
                  ];

                  eventData.forEach((cell, cellIndex) => {
                    const cellX = eventTableX + eventColumnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
                    let cellColor = '#2d3748';
                    if (event.coverageType === 'MISS' && event.type === 'no_payment') {
                      cellColor = '#b91c1c';
                    } else if (event.coverageType === 'COVERED_BY_SURPLUS') {
                      cellColor = '#1e40af';
                    } else if (event.coverageType === 'PARTIAL') {
                      cellColor = '#d97706';
                    } else if (event.type === 'renewal') {
                      cellColor = '#f59e0b';
                    }
                    doc.fontSize(9).fillColor(cellColor).text(cell, cellX + 5, y + 5, { width: eventColumnWidths[cellIndex] - 10, align: 'center' });
                  });
                  y += rowHeight;
                });
              }
            }

            y += 30;
          }

          // Resumen de préstamos anteriores (si hay más de uno)
          if (loansAsClient.length > 1) {
            // Solo agregar nueva página si realmente no hay espacio para el card completo
            if (y > doc.page.height - 90) {
              doc.addPage();
              y = 40;
            }

            doc.roundedRect(40, y, doc.page.width - 80, 80, 6).fill('#f0f9ff');
            doc.roundedRect(40, y, doc.page.width - 80, 80, 6).stroke('#1e40af');
            
            y += 15;
            doc.fontSize(12).fillColor('#1e40af').text(`RESUMEN DE ${loansAsClient.length - 1} PRESTAMOS ANTERIORES`, 55, y);
            y += 25;
            
            const previousLoans = loansAsClient.slice(1);
            const previousStats = calculateLoanStats(previousLoans);
            
            if (previousStats) {
              doc.fontSize(10).fillColor('#1e40af');
              doc.text('Total de prestamos anteriores: ' + previousStats.totalLoans, 55, y);
              y += 15;
              doc.text('Prestamos completados: ' + previousStats.completedLoans, 55, y);
              doc.text('Promedio de finalizacion: ' + previousStats.avgWeeksToComplete + ' semanas', 300, y);
              y += 15;
              doc.text('Fallos promedio: ' + previousStats.avgFailuresPerLoan + ' por prestamo', 55, y);
            }
            
            y += 25;
          }
        }

        y += 30;
      }

      // PRÉSTAMOS COMO AVAL - Nueva implementación
      if (loansAsCollateral && loansAsCollateral.length > 0) {
        // Calcular estadísticas para avales
        const collateralStats = calculateLoanStats(loansAsCollateral);
        
        // Header de sección con diseño moderno
        doc.roundedRect(40, y, doc.page.width - 80, 40, 6).fill('#1e40af');
        doc.fontSize(16).fillColor('#ffffff').text('PRESTAMOS COMO AVAL', 55, y + 12);
        y += 50;

        if (detailed) {
          // MODO DETALLADO: Mostrar todos los préstamos como aval
          loansAsCollateral.forEach((loan: any, loanIndex: number) => {
            if (y > doc.page.height - 200) {
              doc.addPage();
              y = 40;
            }

            // Card del préstamo como aval
            const loanCardHeight = 80 + (loan.payments?.length || 0) * 16;
            doc.roundedRect(40, y, doc.page.width - 80, Math.min(loanCardHeight, 300), 6).fill('#f0f9ff');
            doc.roundedRect(40, y, doc.page.width - 80, Math.min(loanCardHeight, 300), 6).stroke('#1e40af');
            
            y += 15;
            doc.fontSize(12).fillColor('#1e40af').text(`AVAL ${loanIndex + 1}: ${cleanLoanType(loan.loanType)}`, 55, y);
            y += 20;
            
            // Información del préstamo como aval
            doc.fontSize(10).fillColor('#1e40af');
            doc.text(`Cliente: ${loan.clientName || 'N/A'}`, 55, y);
            doc.text(`Estado: ${loan.status}`, 300, y);
            y += 15;
            doc.text(`Fecha: ${formatDate(loan.signDate)}`, 55, y);
            doc.text(`Monto: ${formatCurrency(loan.amountRequested)}`, 300, y);
            y += 15;
            doc.text(`Pendiente: ${formatCurrency(loan.pendingDebt)}`, 55, y);
            y += 25;

            // Pagos del préstamo como aval (resumen)
            if (loan.payments && loan.payments.length > 0) {
              doc.fontSize(9).fillColor('#1e40af').text(`Pagos registrados: ${loan.payments.length}`, 55, y);
              doc.text(`Ultimo pago: ${formatDate(loan.payments[loan.payments.length - 1].receivedAt)}`, 300, y);
              y += 15;
            }

            y += 20;
          });

        } else {
          // MODO RESUMEN: Solo estadísticas de avales
          if (collateralStats) {
            // Solo agregar nueva página si realmente no hay espacio para el card completo
            if (y > doc.page.height - 110) {
              doc.addPage();
              y = 40;
            }
            
            doc.roundedRect(40, y, doc.page.width - 80, 100, 6).fill('#f0f9ff');
            doc.roundedRect(40, y, doc.page.width - 80, 100, 6).stroke('#1e40af');
            
            y += 15;
            doc.fontSize(12).fillColor('#1e40af').text('RESUMEN COMO AVAL', 55, y);
            y += 25;
            
            // Estadísticas de avales
            const avalStats = [
              { label: 'Total como Aval:', value: collateralStats.totalLoans.toString() },
              { label: 'Avales Completados:', value: collateralStats.completedLoans.toString() },
              { label: 'Promedio de Semanas:', value: `${collateralStats.avgWeeksToComplete} semanas` },
              { label: 'Promedio de Fallos:', value: `${collateralStats.avgFailuresPerLoan} por prestamo` }
            ];
            
            avalStats.forEach((stat, index) => {
              const x = index % 2 === 0 ? 55 : 300;
              const currentY = y + Math.floor(index / 2) * 20;
              
              doc.fontSize(9).fillColor('#1e40af').text(stat.label, x, currentY);
              doc.fontSize(9).fillColor('#1e40af').text(stat.value, x + 120, currentY);
            });
            
            y += 60;
          }
        }

        y += 30;
      }

      // Nota final en modo resumen
      if (!detailed && (loansAsClient?.length > 0 || loansAsCollateral?.length > 0)) {
        y += 20;
        
        // Card de información sobre el reporte más compacto
        doc.roundedRect(40, y, doc.page.width - 80, 50, 6).fill('#f0f9ff');
        doc.roundedRect(40, y, doc.page.width - 80, 50, 6).stroke('#1e40af');
        
        y += 12;
        doc.fontSize(9).fillColor('#1e40af').text('INFORMACION DEL REPORTE', 55, y);
        y += 15;
        doc.fontSize(8).fillColor('#1e40af').text('Este es un reporte resumido. Para ver el historial completo active la opcion "PDF detallado completo".', 55, y);
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

  // Endpoint para generar PDF del historial del cliente
  app.post('/api/generate-client-pdf', async (req: Request, res: Response) => {
    try {
      const { clientId } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: 'clientId es requerido' });
      }

      // Obtener información del cliente
      const client = await prisma.lead.findUnique({
        where: { id: clientId },
        include: {
          personalData: {
            include: {
              addresses: {
                include: {
                  location: {
                    include: {
                      route: true
                    }
                  }
                }
              }
            }
          },
          loans: {
            include: {
              loantype: true,
              borrower: {
                include: {
                  personalData: true
                }
              },
              collaterals: {
                include: {
                  personalData: true
                }
              },
              payments: {
                orderBy: { receivedAt: 'asc' }
              }
            },
            orderBy: { signDate: 'desc' }
          }
        }
      });

      if (!client) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      // Crear PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      });

      // Configurar respuesta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="historial-cliente-${clientId}.pdf"`);
      doc.pipe(res);

      // Agregar contenido al PDF
      doc.fontSize(24).text('HISTORIAL DEL CLIENTE', { align: 'center' });
      doc.moveDown();

      doc.fontSize(16).text(`Cliente: ${client.personalData?.firstName || ''} ${client.personalData?.lastName || ''}`);
      doc.fontSize(12).text(`Ruta: ${client.personalData?.addresses?.[0]?.location?.route?.name || 'No asignada'}`);
      doc.moveDown();

      // Información de préstamos
      doc.fontSize(14).text('PRÉSTAMOS:', { underline: true });
      doc.moveDown();

      client.loans.forEach((loan: any, index: number) => {
        doc.fontSize(12).text(`Préstamo ${index + 1}:`);
        doc.fontSize(10).text(`  Fecha: ${formatDate(loan.signDate)}`);
        doc.fontSize(10).text(`  Monto: $${loan.amountGived || 0}`);
        doc.fontSize(10).text(`  Estado: ${loan.finishedDate ? 'Terminado' : 'Activo'}`);
        doc.moveDown(0.5);
      });

      doc.end();
    } catch (error) {
      console.error('Error generando PDF del cliente:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Endpoint para generar PDF del reporte financiero
  app.post('/api/generate-financial-pdf', async (req: Request, res: Response) => {
    try {
      const { routeId, year } = req.body;

      if (!routeId || !year) {
        return res.status(400).json({ error: 'routeId y year son requeridos' });
      }

      // Obtener información de la ruta
      const route = await prisma.route.findUnique({
        where: { id: routeId }
      });

      if (!route) {
        return res.status(404).json({ error: 'Ruta no encontrada' });
      }

      // Crear PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      });

      // Configurar respuesta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-financiero-${routeId}-${year}.pdf"`);
      doc.pipe(res);

      // Agregar contenido al PDF
      doc.fontSize(24).text('REPORTE FINANCIERO', { align: 'center' });
      doc.moveDown();

      doc.fontSize(16).text(`Ruta: ${route.name}`);
      doc.fontSize(12).text(`Año: ${year}`);
      doc.moveDown();

      doc.fontSize(14).text('Este es un reporte financiero básico.', { align: 'center' });
      doc.fontSize(12).text('Para obtener el reporte completo, usa la funcionalidad del reporte financiero en la interfaz web.');
      doc.moveDown();

      doc.end();
    } catch (error) {
      console.error('Error generando PDF financiero:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

};



// Función para enviar mensajes de vuelta al usuario
async function sendTelegramMessage(chatId: string, text: string) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.log('❌ TELEGRAM_BOT_TOKEN no configurado');
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });

    if (response.ok) {
      console.log('✅ Mensaje enviado a Telegram:', text);
    } else {
      console.error('❌ Error al enviar mensaje a Telegram:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Error al enviar mensaje a Telegram:', error);
  }
}
