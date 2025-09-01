import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';

const prisma = new PrismaClient();

export const extendExpressApp = (app: express.Express) => {
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
      doc.image('./solufacil.png', doc.page.width - 100, 15, { width: 60 });
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

  // Fragmento mejorado para keystone-extensions.ts

// Fragmento mejorado para keystone-extensions.ts
// Reemplazar el endpoint /api/generar-listados existente
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

    // Obtener préstamos activos
    const activeLoans = await prisma.loan.findMany({
      where: {
        AND: [
          { finishedDate: null },
          { pendingAmountStored: { gt: "0" } },
          { excludedByCleanup: null },
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
      orderBy: {
        signDate: 'asc'
      }
    }) as any[];

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

    const shortCodeFromId = (id?: string): string => {
      if (!id) return '';
      const base = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return base.slice(-6);
    };

    // Helpers de semanas
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = (day + 6) % 7;
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

      const now = new Date();
      const sign = new Date(loan.signDate);
      const signWeekStart = getMonday(sign);
      const signWeekEnd = new Date(signWeekStart);
      signWeekEnd.setDate(signWeekEnd.getDate() + 6);
      signWeekEnd.setHours(23, 59, 59, 999);
      const boundary = new Date(signWeekEnd);
      boundary.setDate(boundary.getDate() + 1);
      boundary.setHours(0, 0, 0, 0);
      const boundaryForCalc = new Date(boundary);
      if (weekMode === 'next') {
        boundaryForCalc.setDate(boundaryForCalc.getDate() + 7);
      }
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksElapsedSinceBoundary = Math.max(0, Math.floor((getMonday(weekEnd).getTime() - getMonday(boundaryForCalc).getTime()) / msPerWeek));
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

    const totalComisionEsperada = filteredActiveLoans.reduce((sum: number, loan: any) => {
      if (loan.loantype?.loanPaymentComission) {
        const commission = parseFloat(loan.loantype.loanPaymentComission.toString());
        return sum + commission;
      }
      return sum;
    }, 0);

    // ==================== CREAR PDF MEJORADO ====================
    const doc = new PDFDocument({ 
      margin: 20, // Márgenes reducidos para aprovechar espacio
      size: 'A4',
      autoFirstPage: true // Solo una página inicial
    });
    
    const filename = `listado_cobranza_${(localityName as string).replace(/\s+/g, '_')}.pdf`;

    res.setHeader('Content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Generar fecha semanal
    const weekRange = `${weekStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} al ${weekEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`;

    // ==================== CONFIGURACIÓN DE DISEÑO ====================
    const colors = {
      black: '#000000',
      darkGray: '#333333',
      mediumGray: '#666666',
      lightGray: '#999999',
      veryLightGray: '#fafafa', // Mucho más claro para ahorrar tinta
      borderGray: '#cccccc',
      white: '#ffffff'
    };

    // Configuración de la tabla optimizada - redistribuida para dar más espacio a nombre y aval
    const pageWidth = doc.page.width - 40; // Usar todo el ancho disponible
    const tableStartX = 20;
    
    // Anchos de columna optimizados - más espacio para nombre y aval
    const columnWidths = {
      id: pageWidth * 0.07,       // 7% (aumentado para evitar multilínea)
      name: pageWidth * 0.18,     // 18% (ajustado)
      phone: pageWidth * 0.09,    // 9% (aumentado para evitar multilínea)
      abono: pageWidth * 0.07,    // 7% (reducido)
      adeudo: pageWidth * 0.07,   // 7% (reducido)
      plazos: pageWidth * 0.05,   // 5% (reducido)
      pagoVdo: pageWidth * 0.07,  // 7% (reducido)
      abonoParcial: pageWidth * 0.07, // 7% (reducido)
      fInicio: pageWidth * 0.08,  // 8% (reducido)
      nSemana: pageWidth * 0.05,  // 5% (reducido)
      aval: pageWidth * 0.20      // 20% (ajustado)
    };

    const totalTableWidth = Object.values(columnWidths).reduce((a, b) => a + b, 0);

    // ==================== FUNCIÓN PARA DIBUJAR HEADER ====================
    const drawPageHeader = (pageNum: number = 1) => {
      let headerY = 20;
      
      // Logo
      try {
        doc.image('./solufacil.png', doc.page.width - 90, 15, { width: 70 });
      } catch (e) {
        // Continuar sin logo si no existe
      }

      // Título principal
      doc.fontSize(16).fillColor(colors.black).font('Helvetica-Bold')
        .text('LISTADO DE COBRANZA', tableStartX, headerY);
      
      // Ruta
      doc.fontSize(11).fillColor(colors.darkGray).font('Helvetica')
        .text(routeName as string, tableStartX, headerY + 20);
      
      // Fecha
      doc.fontSize(9).fillColor(colors.mediumGray)
        .text(`Semana: ${weekRange}`, tableStartX, headerY + 35);
      
      // Línea divisoria
      doc.strokeColor(colors.borderGray).lineWidth(0.5)
        .moveTo(tableStartX, headerY + 50)
        .lineTo(tableStartX + totalTableWidth, headerY + 50)
        .stroke();

      return headerY + 60;
    };

    // ==================== FUNCIÓN PARA DIBUJAR INFORMACIÓN ====================
    const drawInfoSection = (startY: number) => {
      let y = startY;
      
      // Información en dos columnas
      doc.fontSize(8).fillColor(colors.darkGray).font('Helvetica');
      
      // Columna izquierda
      doc.text('Localidad:', tableStartX, y);
      doc.font('Helvetica-Bold').text(localityName as string, tableStartX + 50, y);
      
      doc.font('Helvetica').text('Total clientes:', tableStartX, y + 12);
      doc.font('Helvetica-Bold').text(totalClientes.toString(), tableStartX + 50, y + 12);
      
      // Columna derecha
      doc.font('Helvetica').text('Líder:', tableStartX + 250, y);
      doc.font('Helvetica-Bold').text((leaderName as string) || 'Sin asignar', tableStartX + 280, y);
      
      doc.font('Helvetica').text('Cobranza esperada:', tableStartX + 250, y + 12);
      doc.font('Helvetica-Bold').text(formatCurrency(totalCobranzaEsperada), tableStartX + 340, y + 12);
      
      doc.font('Helvetica').text('Comisión líder:', tableStartX + 250, y + 24);
      doc.font('Helvetica-Bold').text(formatCurrency(totalComisionEsperada), tableStartX + 340, y + 24);
      
      return y + 40;
    };

    // ==================== FUNCIÓN PARA DIBUJAR HEADERS DE TABLA ====================
    const drawTableHeaders = (y: number): number => {
      // Headers abreviados para optimizar espacio
      const headers = ['ID', 'NOMBRE', 'TEL', 'ABONO', 'ADEUDO', 'PLZ', 'P.VDO', 'A.PARC', 'F.INICIO', 'SEM', 'AVAL'];
      const headerHeight = 20;

      // Fondo del header con gris claro
      doc.rect(tableStartX, y, totalTableWidth, headerHeight)
        .fillAndStroke('#e0e0e0', colors.borderGray);
      
      // Texto del header
      doc.fillColor(colors.darkGray).fontSize(7).font('Helvetica-Bold');
      
      let xPos = tableStartX;
      Object.keys(columnWidths).forEach((key, index) => {
        const width = (columnWidths as any)[key];
        const header = headers[index];
        
        // Centrar texto en la columna
        doc.text(header, xPos, y + 7, { 
          width: width,
          align: 'center',
          lineBreak: false
        });
        
        // Dibujar línea vertical después de cada columna (excepto la última)
        if (index < headers.length - 1) {
          doc.strokeColor(colors.borderGray).lineWidth(0.5)
            .moveTo(xPos + width, y)
            .lineTo(xPos + width, y + headerHeight)
            .stroke();
        }
        
        xPos += width;
      });

      return y + headerHeight;
    };

    // ==================== FUNCIÓN PARA DIBUJAR FILA ====================
    const drawRow = (payment: any, y: number, isEven: boolean): number => {
      const fontSize = 6.5; // Tamaño de fuente optimizado
      const lineHeight = 10; // Altura de línea para texto
      const minRowHeight = 14; // Altura mínima de la fila
      const padding = 2;
      
      // Calcular altura necesaria para nombre y aval (pueden ser multilínea)
      doc.fontSize(fontSize).font('Helvetica');
      const nameHeight = doc.heightOfString(payment.name || '', { 
        width: columnWidths.name - padding * 2,
        lineGap: 1
      });
      const avalHeight = doc.heightOfString(payment.aval || '', { 
        width: columnWidths.aval - padding * 2,
        lineGap: 1
      });
      
      // Altura de la fila basada en el contenido más alto
      const rowHeight = Math.max(minRowHeight, nameHeight + 6, avalHeight + 6);
      
      // Fondo alternado muy sutil (opcional - se puede quitar completamente)
      // Comentado para máximo ahorro de tinta
      /*
      if (isEven) {
        doc.rect(tableStartX, y, totalTableWidth, rowHeight)
          .fill(colors.veryLightGray);
      }
      */
      
      // Bordes de la fila
      doc.rect(tableStartX, y, totalTableWidth, rowHeight)
        .stroke(colors.borderGray);
      
      // Contenido de la fila
      doc.fillColor(colors.black).fontSize(fontSize).font('Helvetica');
      
      let xPos = tableStartX;
      const textY = y + 4; // Padding superior para el texto
      
      // ID
      doc.text(payment.id || '', xPos + padding, textY + (rowHeight - minRowHeight) / 2, {
        width: columnWidths.id - padding * 2,
        align: 'center',
        lineBreak: false
      });
      // Línea vertical
      doc.strokeColor(colors.borderGray).lineWidth(0.5)
        .moveTo(xPos + columnWidths.id, y)
        .lineTo(xPos + columnWidths.id, y + rowHeight)
        .stroke();
      xPos += columnWidths.id;
      
      // Nombre (multilínea)
      doc.text(payment.name || '', xPos + padding, textY, {
        width: columnWidths.name - padding * 2,
        align: 'left',
        lineGap: 1
      });
      // Línea vertical
      doc.moveTo(xPos + columnWidths.name, y)
        .lineTo(xPos + columnWidths.name, y + rowHeight)
        .stroke();
      xPos += columnWidths.name;
      
      // Teléfono
      doc.text(payment.phone || '', xPos + padding, textY + (rowHeight - minRowHeight) / 2, {
        width: columnWidths.phone - padding * 2,
        align: 'center',
        lineBreak: false
      });
      // Línea vertical
      doc.moveTo(xPos + columnWidths.phone, y)
        .lineTo(xPos + columnWidths.phone, y + rowHeight)
        .stroke();
      xPos += columnWidths.phone;
      
      // Abono
      doc.text(payment.abono || '', xPos + padding, textY + (rowHeight - minRowHeight) / 2, {
        width: columnWidths.abono - padding * 2,
        align: 'right',
        lineBreak: false
      });
      // Línea vertical
      doc.moveTo(xPos + columnWidths.abono, y)
        .lineTo(xPos + columnWidths.abono, y + rowHeight)
        .stroke();
      xPos += columnWidths.abono;
      
      // Adeudo
      doc.text(payment.adeudo || '', xPos + padding, textY + (rowHeight - minRowHeight) / 2, {
        width: columnWidths.adeudo - padding * 2,
        align: 'right',
        lineBreak: false
      });
      // Línea vertical
      doc.moveTo(xPos + columnWidths.adeudo, y)
        .lineTo(xPos + columnWidths.adeudo, y + rowHeight)
        .stroke();
      xPos += columnWidths.adeudo;
      
      // Plazos
      doc.text(payment.plazos || '', xPos + padding, textY + (rowHeight - minRowHeight) / 2, {
        width: columnWidths.plazos - padding * 2,
        align: 'center',
        lineBreak: false
      });
      // Línea vertical
      doc.moveTo(xPos + columnWidths.plazos, y)
        .lineTo(xPos + columnWidths.plazos, y + rowHeight)
        .stroke();
      xPos += columnWidths.plazos;
      
      // Pago VDO
      doc.text(payment.pagoVdo || '', xPos + padding, textY + (rowHeight - minRowHeight) / 2, {
        width: columnWidths.pagoVdo - padding * 2,
        align: 'right',
        lineBreak: false
      });
      // Línea vertical
      doc.moveTo(xPos + columnWidths.pagoVdo, y)
        .lineTo(xPos + columnWidths.pagoVdo, y + rowHeight)
        .stroke();
      xPos += columnWidths.pagoVdo;
      
      // Abono Parcial
      doc.text(payment.abonoParcial || '', xPos + padding, textY + (rowHeight - minRowHeight) / 2, {
        width: columnWidths.abonoParcial - padding * 2,
        align: 'right',
        lineBreak: false
      });
      // Línea vertical
      doc.moveTo(xPos + columnWidths.abonoParcial, y)
        .lineTo(xPos + columnWidths.abonoParcial, y + rowHeight)
        .stroke();
      xPos += columnWidths.abonoParcial;
      
      // Fecha Inicio
      doc.text(payment.fInicio || '', xPos + padding, textY + (rowHeight - minRowHeight) / 2, {
        width: columnWidths.fInicio - padding * 2,
        align: 'center',
        lineBreak: false
      });
      // Línea vertical
      doc.moveTo(xPos + columnWidths.fInicio, y)
        .lineTo(xPos + columnWidths.fInicio, y + rowHeight)
        .stroke();
      xPos += columnWidths.fInicio;
      
      // Número Semana
      doc.text(payment.nSemana || '', xPos + padding, textY + (rowHeight - minRowHeight) / 2, {
        width: columnWidths.nSemana - padding * 2,
        align: 'center',
        lineBreak: false
      });
      // Línea vertical
      doc.moveTo(xPos + columnWidths.nSemana, y)
        .lineTo(xPos + columnWidths.nSemana, y + rowHeight)
        .stroke();
      xPos += columnWidths.nSemana;
      
      // Aval (multilínea)
      doc.text(payment.aval || '', xPos + padding, textY, {
        width: columnWidths.aval - padding * 2,
        align: 'left',
        lineGap: 1
      });
      // No se dibuja línea vertical después de la última columna
      
      return y + rowHeight;
    };

    // ==================== RENDERIZAR DOCUMENTO ====================
    let currentY = drawPageHeader(1);
    currentY = drawInfoSection(currentY);
    currentY = drawTableHeaders(currentY);
    
    let pageNumber = 1;
    const pageBottom = doc.page.height - 30; // Límite inferior de la página
    let needsNewPage = false;
    
    // Procesar todas las filas
    for (let index = 0; index < payments.length; index++) {
      const payment = payments[index];
      
      // Calcular altura real de la fila
      doc.fontSize(6.5).font('Helvetica');
      const nameHeight = doc.heightOfString(payment.name || '', { 
        width: columnWidths.name - 4,
        lineGap: 1
      });
      const avalHeight = doc.heightOfString(payment.aval || '', { 
        width: columnWidths.aval - 4,
        lineGap: 1
      });
      const rowHeight = Math.max(14, nameHeight + 6, avalHeight + 6);
      
      // Verificar si hay espacio en la página actual
      if (currentY + rowHeight > pageBottom) {
        needsNewPage = true;
      }
      
      // Si necesitamos nueva página
      if (needsNewPage) {
        // Primero: agregar número de página a la página actual
        doc.fontSize(8).fillColor(colors.lightGray).font('Helvetica')
          .text(`Página ${pageNumber}`, 0, doc.page.height - 20, {
            align: 'center'
          });
        
        // Segundo: crear nueva página
        doc.addPage();
        pageNumber++;
        needsNewPage = false;
        
        // Tercero: dibujar header de continuación
        currentY = 20;
        doc.fontSize(12).fillColor(colors.black).font('Helvetica-Bold')
          .text('LISTADO DE COBRANZA (cont.)', tableStartX, currentY);
        doc.fontSize(9).fillColor(colors.mediumGray).font('Helvetica')
          .text(`${routeName} - ${localityName}`, tableStartX, currentY + 15);
        currentY += 35;
        
        // Cuarto: dibujar headers de tabla
        currentY = drawTableHeaders(currentY);
      }
      
      // Dibujar la fila
      currentY = drawRow(payment, currentY, index % 2 === 0);
    }
    
    // Agregar número de página final SOLO si hay contenido en la página
    if (currentY > 100) { // Solo si hay contenido real en la página
      doc.fontSize(8).fillColor(colors.lightGray).font('Helvetica')
        .text(`Página ${pageNumber}`, 0, doc.page.height - 20, {
          align: 'center'
        });
    }
    
    // Finalizar el documento sin agregar páginas extra
    doc.end();

  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ error: 'Error interno del servidor al generar PDF' });
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
        doc.image('./solufacil.png', doc.page.width - 100, 10, { width: 80 });
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
        const pendingDebt = summary?.currentPendingDebtAsClient || 0;
        
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
        
        // Indicador de cumplimiento basado en pagos semanales
        const calculateComplianceScore = (loans: any[]) => {
          if (!loans || loans.length === 0) return 0;
          
          let totalExpectedPayments = 0;
          let totalMissedPayments = 0;
          
          console.log('📊 Calculando índice de cumplimiento...');
          
          loans.forEach((loan, index) => {
            // Calcular semanas esperadas del préstamo
            const expectedWeeks = loan.weekDuration || 16; // Default 16 semanas si no está especificado
            const missedWeeks = loan.noPaymentPeriods?.length || 0;
            
            totalExpectedPayments += expectedWeeks;
            totalMissedPayments += missedWeeks;
            
            console.log(`Préstamo ${index + 1}: ${expectedWeeks} semanas esperadas, ${missedWeeks} fallos`);
          });
          
          if (totalExpectedPayments === 0) return 0;
          
          // Calcular porcentaje de cumplimiento
          const complianceScore = Math.max(0, Math.round(((totalExpectedPayments - totalMissedPayments) / totalExpectedPayments) * 100));
          
          console.log(`📊 Total esperado: ${totalExpectedPayments}, Total fallos: ${totalMissedPayments}, Score: ${complianceScore}%`);
          
          return complianceScore;
        };
        
        const reliabilityScore = calculateComplianceScore(loansAsClient || []);
        doc.fontSize(11).fillColor('#1e40af').text('Indice de Cumplimiento:', 55, y);
        doc.fontSize(12).fillColor(reliabilityScore >= 80 ? '#16a34a' : reliabilityScore >= 60 ? '#f59e0b' : '#dc2626').text(`${reliabilityScore}%`, 250, y);
        
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

            // Tabla de pagos si los hay
            if (loan.payments && loan.payments.length > 0) {
              doc.fontSize(10).fillColor('#2d3748').text('Historial de Pagos:', 55, y);
              y += 15;

              const paymentHeaders = ['Fecha', 'Monto', 'No. Pago'];
              const availableWidth = doc.page.width - 120; // Ancho disponible dentro del card
              const paymentColumnWidths = [
                Math.floor(availableWidth * 0.35), // 35% para fecha
                Math.floor(availableWidth * 0.35), // 35% para monto  
                Math.floor(availableWidth * 0.3)   // 30% para número
              ];
              const totalPaymentWidth = paymentColumnWidths.reduce((a, b) => a + b, 0);
              const paymentTableX = 55;

              // Encabezados
              doc.fontSize(8).fillColor('#ffffff');
              doc.rect(paymentTableX, y, totalPaymentWidth, 18).fill('#1e40af');
              doc.fillColor('#ffffff');
              paymentHeaders.forEach((header, index) => {
                const headerX = paymentTableX + paymentColumnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                doc.text(header, headerX + 5, y + 6, { width: paymentColumnWidths[index] - 10, align: 'center' });
              });
              y += 20;

              // Filas de pagos (máximo 10 para evitar páginas muy largas)
              const paymentsToShow = loan.payments.slice(0, 10);
              paymentsToShow.forEach((payment: any, paymentIndex: number) => {
                const paymentRowColor = paymentIndex % 2 === 0 ? '#f0f9ff' : '#ffffff';
                doc.rect(paymentTableX, y - 2, totalPaymentWidth, 16).fill(paymentRowColor);

                const paymentData = [
                  formatDate(payment.receivedAt),
                  formatCurrency(payment.amount),
                  payment.paymentNumber?.toString() || 'N/A'
                ];

                paymentData.forEach((cell, cellIndex) => {
                  const cellX = paymentTableX + paymentColumnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
                  doc.fontSize(7).fillColor('#2d3748').text(cell, cellX + 5, y + 4, { width: paymentColumnWidths[cellIndex] - 10, align: 'center' });
                });
                y += 16;
              });

              if (loan.payments.length > 10) {
                doc.fontSize(8).fillColor('#718096').text(`... y ${loan.payments.length - 10} pagos mas`, 55, y);
                y += 15;
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

            // Pagos del préstamo actual
            if (latestLoan.payments && latestLoan.payments.length > 0) {
              doc.fontSize(10).fillColor('#2d3748').text('Historial de Pagos:', 55, y);
              y += 15;

              const paymentHeaders = ['Fecha', 'Monto', 'No. Pago'];
              const availableWidth = doc.page.width - 120; // Ancho disponible dentro del card
              const paymentColumnWidths = [
                Math.floor(availableWidth * 0.35), // 35% para fecha
                Math.floor(availableWidth * 0.35), // 35% para monto  
                Math.floor(availableWidth * 0.3)   // 30% para número
              ];
              const totalPaymentWidth = paymentColumnWidths.reduce((a, b) => a + b, 0);
              const paymentTableX = 55;

              // Encabezados
              doc.fontSize(8).fillColor('#ffffff');
              doc.rect(paymentTableX, y, totalPaymentWidth, 18).fill('#1e40af');
              
              // Asegurar que el texto sea blanco sobre fondo azul
              doc.fillColor('#ffffff');
              paymentHeaders.forEach((header, index) => {
                const headerX = paymentTableX + paymentColumnWidths.slice(0, index).reduce((a, b) => a + b, 0);
                doc.text(header, headerX + 5, y + 6, { width: paymentColumnWidths[index] - 10, align: 'center' });
              });
              y += 20;

              // Todas las filas de pagos del préstamo actual
              latestLoan.payments.forEach((payment: any, paymentIndex: number) => {
                if (y > doc.page.height - 80) {
                  doc.addPage();
                  y = 40;
                }

                const paymentRowColor = paymentIndex % 2 === 0 ? '#f0f9ff' : '#ffffff';
                doc.rect(paymentTableX, y - 2, totalPaymentWidth, 16).fill(paymentRowColor);

                const paymentData = [
                  formatDate(payment.receivedAt),
                  formatCurrency(payment.amount),
                  payment.paymentNumber?.toString() || 'N/A'
                ];

                paymentData.forEach((cell, cellIndex) => {
                  const cellX = paymentTableX + paymentColumnWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0);
                  doc.fontSize(7).fillColor('#2d3748').text(cell, cellX + 5, y + 4, { width: paymentColumnWidths[cellIndex] - 10, align: 'center' });
                });
                y += 16;
              });
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
