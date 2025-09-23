import type { Context } from '.keystone/types';
import { getWeekStart } from '../utils/loan';

// ✅ NUEVA FUNCIÓN MEJORADA PARA GENERAR CONTENIDO DEL REPORTE DIRECTAMENTE EN EL DOCUMENTO
export async function generateCreditsWithDocumentErrorsReportContent(doc: any, context: Context, routeIds: string[] = []) {
  try {
    console.log('🎯 Iniciando generación de reporte de créditos con documentos con error...');
    
    // Calcular fecha de hace 2 meses
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    // Filtro de rutas específicas si se proporcionan
    const routeFilter = routeIds.length > 0 ? {
      lead: {
        routes: {
          id: { in: routeIds }
        }
      }
    } : {};
    
    // Obtener todos los créditos de los últimos 2 meses con información completa
    const allRecentCredits = await context.prisma.loan.findMany({
      where: {
        signDate: {
          gte: twoMonthsAgo
        },
        ...routeFilter
      },
      include: {
        borrower: {
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
        },
        lead: {
          include: {
            routes: true,
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
        },
        documentPhotos: true,
        collaterals: {
          include: {
            documentPhotos: true
          }
        }
      },
      orderBy: [
        { signDate: 'desc' }
      ]
    });

    console.log(`📊 Encontrados ${allRecentCredits.length} créditos en los últimos 2 meses`);

    // Procesar y organizar datos para la tabla
    const tableData: any[] = [];
    
    for (const credit of allRecentCredits) {
      const locality = credit.borrower?.personalData?.addresses?.[0]?.location?.name ||
                      credit.lead?.personalData?.addresses?.[0]?.location?.name ||
                      'Sin localidad';
      
      const routeName = credit.lead?.routes?.name || 'Sin ruta';
      const clientName = credit.borrower?.personalData?.fullName || 'Sin nombre';
      const signDate = new Date(credit.signDate);
      
      // Analizar documentos del cliente
      const clientDocuments = credit.documentPhotos || [];
      const clientDocErrors = clientDocuments.filter(doc => doc.isError);
      
      // Verificar documentos faltantes del cliente
      const requiredDocTypes = ['INE', 'DOMICILIO', 'PAGARE'];
      const clientAvailableTypes = clientDocuments.map(doc => doc.documentType);
      const clientMissingDocs = requiredDocTypes.filter(type => !clientAvailableTypes.includes(type));
      
      // Analizar documentos del aval (si existe)
      const avalDocuments = credit.collaterals?.[0]?.documentPhotos || [];
      const avalDocErrors = avalDocuments.filter(doc => doc.isError);
      const avalAvailableTypes = avalDocuments.map(doc => doc.documentType);
      const avalMissingDocs = requiredDocTypes.filter(type => !avalAvailableTypes.includes(type));
      
      // Solo incluir si hay problemas
      const hasClientProblems = clientDocErrors.length > 0 || clientMissingDocs.length > 0;
      const hasAvalProblems = avalDocErrors.length > 0 || avalMissingDocs.length > 0;
      
      if (hasClientProblems || hasAvalProblems) {
        // Agregar fila para problemas del cliente
        if (hasClientProblems) {
          const errorDescriptions = clientDocErrors.map(doc => `${doc.documentType} con error`);
          const missingDescriptions = clientMissingDocs.map(type => `${type} faltante`);
          const allProblems = [...errorDescriptions, ...missingDescriptions];
          
          const detailedObservations = clientDocErrors
            .map(doc => doc.errorDescription)
            .filter(Boolean)
            .join('; ') || 'Sin observaciones específicas';
          
          tableData.push({
            locality,
            routeName,
            clientName,
            signDate,
            problemType: 'CLIENTE',
            problemDescription: allProblems.join('; '),
            observations: detailedObservations
          });
        }
        
        // Agregar fila para problemas del aval
        if (hasAvalProblems && credit.collaterals?.[0]) {
          const avalName = credit.collaterals[0].fullName || 'Aval sin nombre';
          const avalErrorDescriptions = avalDocErrors.map(doc => `${doc.documentType} con error`);
          const avalMissingDescriptions = avalMissingDocs.map(type => `${type} faltante`);
          const allAvalProblems = [...avalErrorDescriptions, ...avalMissingDescriptions];
          
          const avalDetailedObservations = avalDocErrors
            .map(doc => doc.errorDescription)
            .filter(Boolean)
            .join('; ') || 'Sin observaciones específicas';
          
          tableData.push({
            locality,
            routeName,
            clientName: `${clientName} (Aval: ${avalName})`,
            signDate,
            problemType: 'AVAL',
            problemDescription: allAvalProblems.join('; '),
            observations: avalDetailedObservations
          });
        }
      }
    }

    console.log(`📊 Procesados ${tableData.length} registros con problemas de documentos`);
    
    // Generar header profesional moderno
    await addModernCompanyHeader(doc);
    
    // Título principal del reporte
    doc.fontSize(22).fillColor('#1e40af').text('REPORTE DE CRÉDITOS CON DOCUMENTOS CON ERROR', 50, doc.y, { 
      width: 500, 
      align: 'center' 
    });
    doc.moveDown(1.5);
    
    // Información del período
    const reportStartDate = new Date();
    reportStartDate.setMonth(reportStartDate.getMonth() - 2);
    doc.fontSize(12).fillColor('#64748b').text(`Período de Análisis: ${reportStartDate.toLocaleDateString('es-ES')} - ${new Date().toLocaleDateString('es-ES')}`, 50, doc.y, { 
      width: 500, 
      align: 'center' 
    });
    
    // Información de rutas
    if (routeIds.length > 0) {
      doc.fontSize(10).fillColor('#64748b').text(`Rutas analizadas: ${routeIds.length} ruta(s) específica(s)`, { align: 'center' });
    } else {
      doc.fontSize(10).fillColor('#64748b').text('Análisis: Todas las rutas del sistema', { align: 'center' });
    }
    
    doc.moveDown(2);

    // Si no hay datos reales, mostrar mensaje de éxito
    if (tableData.length === 0) {
      console.log('✅ No se encontraron problemas de documentos - generando mensaje de éxito');
      
      // Caja de estado exitoso con diseño moderno
      const successBoxY = doc.y;
      const successBoxHeight = 120;
      
      // Fondo con gradiente simulado
      doc.fillColor('#f0fdf4').rect(50, successBoxY, 500, successBoxHeight).fill();
      doc.strokeColor('#16a34a').lineWidth(3).rect(50, successBoxY, 500, successBoxHeight).stroke();
      
      // Icono y título
      doc.fontSize(32).fillColor('#16a34a').text('✓', 70, successBoxY + 20, { width: 50, align: 'center' });
      doc.fontSize(18).fillColor('#16a34a').text('EXCELENTE NOTICIA', 130, successBoxY + 25, { width: 350, align: 'left' });
      
      doc.fontSize(14).fillColor('#15803d').text('No se encontraron créditos con documentos con error', 70, successBoxY + 55, { width: 460, align: 'center' });
      doc.text('en el período especificado.', 70, successBoxY + 75, { width: 460, align: 'center' });
      
      doc.fontSize(11).fillColor('#166534').text('✓ Todos los créditos tienen su documentación completa y correcta', 70, successBoxY + 95, { width: 460, align: 'center' });
      
      return;
    }

    console.log(`📊 Generando tabla moderna con ${tableData.length} registros...`);
    
    // Generar estadísticas de resumen antes de la tabla
    await generateExecutiveSummary(doc, tableData);
    
    // Generar tabla moderna mejorada
    await generateModernDocumentErrorTable(doc, tableData);
    
    console.log('✅ Reporte de créditos con errores generado exitosamente');
    
  } catch (error) {
    console.error('❌ Error generando contenido del reporte:', error);
    doc.fontSize(12).fillColor('#dc2626').text(`❌ Error generando reporte: ${error instanceof Error ? error.message : 'Unknown error'}`, { align: 'center' });
  }
}

// ✅ FUNCIÓN PARA AGREGAR HEADER MODERNO DE LA EMPRESA
export async function addModernCompanyHeader(doc: any): Promise<void> {
  try {
    // Fondo del header con gradiente azul
    doc.fillColor('#1e40af').rect(0, 0, 612, 90).fill();
    doc.fillColor('#3b82f6').rect(0, 70, 612, 20).fill();
    
    // Logo y nombre de la empresa
    doc.fontSize(28).fillColor('white').text('SOLUFÁCIL', 50, 25, { align: 'left' });
    doc.fontSize(11).fillColor('#e0f2fe').text('SISTEMA DE GESTIÓN DE CRÉDITOS', 50, 58);
    
    // Información de generación en la esquina derecha
    doc.fontSize(9).fillColor('white');
    const currentDate = new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generado: ${currentDate}`, 350, 25, { align: 'right', width: 200 });
    doc.text('Reporte Oficial', 350, 40, { align: 'right', width: 200 });
    doc.text('Confidencial', 350, 55, { align: 'right', width: 200 });
    
    // Línea divisoria elegante
    doc.strokeColor('#60a5fa').lineWidth(3).moveTo(50, 95).lineTo(562, 95).stroke();
    
    // Espacio después del header
    doc.y = 110;
    doc.fillColor('black'); // Resetear color a negro
    
  } catch (error) {
    console.error('Error agregando header moderno:', error);
    // Fallback simple si hay error
    doc.fontSize(18).fillColor('#1e40af').text('SOLUFÁCIL - REPORTE DE CRÉDITOS', 50, 50, { align: 'center' });
    doc.y = 80;
    doc.fillColor('black');
  }
}

// ✅ FUNCIÓN PARA GENERAR RESUMEN EJECUTIVO MODERNO
export async function generateExecutiveSummary(doc: any, tableData: any[]): Promise<void> {
  try {
    // Calcular estadísticas
    const totalCredits = new Set(tableData.map(row => row.clientName.split(' (Aval:')[0])).size;
    const totalWithClientErrors = tableData.filter(row => row.problemType === 'CLIENTE').length;
    const totalWithAvalErrors = tableData.filter(row => row.problemType === 'AVAL').length;
    const totalLocalities = new Set(tableData.map(row => row.locality)).size;
    const totalRoutes = new Set(tableData.map(row => row.routeName)).size;
    
    // Título del resumen
    doc.fontSize(16).fillColor('#1e40af').text('RESUMEN EJECUTIVO', 50, doc.y, { width: 500, align: 'center' });
    doc.moveDown(1);
    
    // Caja principal de estadísticas con diseño moderno
    const statsBoxY = doc.y;
    const statsBoxHeight = 100;
    
    // Fondo de la caja
    doc.fillColor('#f8fafc').rect(50, statsBoxY, 500, statsBoxHeight).fill();
    doc.strokeColor('#1e40af').lineWidth(2).rect(50, statsBoxY, 500, statsBoxHeight).stroke();
    
    // Estadísticas en grid de 3x2
    const statItems = [
      { label: 'Clientes Afectados', value: totalCredits.toString(), color: '#dc2626' },
      { label: 'Problemas Cliente', value: totalWithClientErrors.toString(), color: '#ea580c' },
      { label: 'Problemas Aval', value: totalWithAvalErrors.toString(), color: '#d97706' },
      { label: 'Localidades', value: totalLocalities.toString(), color: '#059669' },
      { label: 'Rutas', value: totalRoutes.toString(), color: '#0284c7' },
      { label: 'Total Registros', value: tableData.length.toString(), color: '#7c3aed' }
    ];
    
    // Dibujar estadísticas en grid
    statItems.forEach((stat, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 70 + (col * 150);
      const y = statsBoxY + 20 + (row * 35);
      
      doc.fontSize(20).fillColor(stat.color).text(stat.value, x, y, { width: 130, align: 'center' });
      doc.fontSize(9).fillColor('#374151').text(stat.label, x, y + 25, { width: 130, align: 'center' });
    });
    
    doc.y = statsBoxY + statsBoxHeight + 20;
    
    // Desglose por tipo de documento
    doc.fontSize(14).fillColor('#1e40af').text('ANÁLISIS POR TIPO DE DOCUMENTO', 50, doc.y, { width: 500, align: 'left' });
    doc.moveDown(1);
    
    const problemTypes = ['INE', 'DOMICILIO', 'PAGARE'];
    const docStatsY = doc.y;
    
    problemTypes.forEach((docType, index) => {
      const clientProblems = tableData.filter(row => 
        row.problemType === 'CLIENTE' && row.problemDescription.includes(docType)
      ).length;
      const avalProblems = tableData.filter(row => 
        row.problemType === 'AVAL' && row.problemDescription.includes(docType)
      ).length;
      
      if (clientProblems > 0 || avalProblems > 0) {
        const y = docStatsY + (index * 20);
        doc.fontSize(11).fillColor('#374151');
        doc.text(`• ${docType}:`, 70, y, { width: 80, align: 'left' });
        doc.text(`${clientProblems} clientes`, 150, y, { width: 100, align: 'left' });
        doc.text(`${avalProblems} avales`, 250, y, { width: 100, align: 'left' });
        doc.fillColor(clientProblems > avalProblems ? '#dc2626' : '#ea580c');
        doc.text(`${clientProblems + avalProblems} total`, 350, y, { width: 100, align: 'left' });
      }
    });
    
    doc.y = docStatsY + (problemTypes.length * 20) + 20;
    doc.fillColor('black');
    
  } catch (error) {
    console.error('Error generando resumen ejecutivo:', error);
    doc.fontSize(12).text('Error generando resumen ejecutivo', { align: 'center' });
  }
}

// ✅ FUNCIÓN PARA GENERAR TABLA MODERNA DE DOCUMENTOS CON ERROR
export async function generateModernDocumentErrorTable(doc: any, tableData: any[]): Promise<void> {
  try {
    console.log('🎨 Iniciando generación de tabla moderna...');
    
    // Configuración de la tabla moderna (usando todo el ancho disponible)
    const pageWidth = 512; // Ancho total disponible (612 - 100 márgenes)
  const startX = 50;
    const headerHeight = 35;
    const rowHeight = 50;
  let currentY = doc.y;

    // Configuración de columnas con más espacio para observaciones
  const columns = [
      { header: 'RUTA', width: 60, align: 'left' },
      { header: 'LOCALIDAD', width: 90, align: 'left' },
      { header: 'CLIENTE', width: 130, align: 'left' },
      { header: 'TIPO', width: 50, align: 'center' },
      { header: 'PROBLEMAS', width: 90, align: 'left' },
      { header: 'OBSERVACIONES', width: 192, align: 'left' }
    ];
    
    // Función para dibujar header moderno
    const drawModernTableHeader = (y: number) => {
      // Fondo del header con gradiente azul
    doc.fillColor('#1e40af').rect(startX, y, pageWidth, headerHeight).fill();
      doc.fillColor('#3b82f6').rect(startX, y + headerHeight - 5, pageWidth, 5).fill();
      
      // Bordes del header
    doc.strokeColor('#1e40af').lineWidth(2).rect(startX, y, pageWidth, headerHeight).stroke();
      
      // Texto del header
    doc.fillColor('white').fontSize(10);
    let x = startX;
    columns.forEach((col, index) => {
      if (index > 0) {
          // Líneas divisorias verticales
          doc.strokeColor('#60a5fa').lineWidth(1);
        doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke();
      }
        doc.text(col.header, x + 8, y + 12, { 
          width: col.width - 16, 
          align: col.align === 'center' ? 'center' : 'left' 
        });
      x += col.width;
    });
      
    doc.fillColor('black');
    return y + headerHeight;
  };

    // Función para dibujar fila moderna
    const drawModernTableRow = (data: any, y: number, isShaded: boolean = false) => {
    if (!data) return y + rowHeight;
      
      // Fondo alternado moderno
    if (isShaded) {
        doc.fillColor('#f1f5f9').rect(startX, y, pageWidth, rowHeight).fill();
    } else {
      doc.fillColor('white').rect(startX, y, pageWidth, rowHeight).fill();
    }
      
      // Bordes de la fila
      doc.strokeColor('#e2e8f0').lineWidth(1).rect(startX, y, pageWidth, rowHeight).stroke();
      
      // Preparar datos para las celdas
      const cellData = [
        data.routeName || 'N/A',
        data.locality || 'N/A', 
        data.clientName || 'N/A',
        data.problemType || 'N/A',
        data.problemDescription || 'N/A',
        data.observations || 'N/A'
      ];
      
      // Dibujar celdas con contenido optimizado
      let x = startX;
      columns.forEach((col, index) => {
        if (index > 0) {
          // Líneas divisorias verticales
          doc.strokeColor('#e2e8f0').lineWidth(0.5);
          doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
        }
        
        let cellText = cellData[index] || 'N/A';
        
        // Columna de tipo con color
        if (index === 3) {
          const bgColor = cellText === 'CLIENTE' ? '#dcfce7' : '#fef3c7';
          const textColor = cellText === 'CLIENTE' ? '#166534' : '#92400e';
          
          doc.fillColor(bgColor).rect(x + 2, y + 15, col.width - 4, 20).fill();
          doc.strokeColor(textColor).lineWidth(1).rect(x + 2, y + 15, col.width - 4, 20).stroke();
          doc.fontSize(9).fillColor(textColor).text(cellText, x + 4, y + 22, { 
            width: col.width - 8, 
            align: 'center' 
          });
        }
        // Columna de problemas con formato especial
        else if (index === 4) {
          const problems = cellText.split(';').filter((p: string) => p.trim());
          doc.fontSize(8);
          let textY = y + 8;
          
          for (let i = 0; i < Math.min(problems.length, 3); i++) {
            const problem = problems[i].trim();
            if (textY < y + rowHeight - 10) {
              if (problem.includes('con error')) {
                doc.fillColor('#dc2626');
                doc.text(`ERROR: ${problem.replace('con error', '').trim()}`, x + 4, textY, { width: col.width - 8 });
              } else if (problem.includes('faltante')) {
                doc.fillColor('#ea580c');
                doc.text(`FALTA: ${problem.replace('faltante', '').trim()}`, x + 4, textY, { width: col.width - 8 });
              } else {
                doc.fillColor('#374151');
                doc.text(`• ${problem}`, x + 4, textY, { width: col.width - 8 });
              }
              textY += 12;
            }
          }
          
          if (problems.length > 3) {
            doc.fontSize(7).fillColor('#64748b');
            doc.text(`+${problems.length - 3} más...`, x + 4, textY, { width: col.width - 8 });
          }
        }
        // Otras columnas con formato estándar
        else {
          doc.fillColor('#374151');
          
          // Formato estándar para todas las columnas
          doc.fontSize(index === 5 ? 8 : 9); // Observaciones más pequeñas
          
          // Solo para observaciones: ocultar el texto por defecto
          if (index === 5 && cellText === 'Sin observaciones específicas') {
            cellText = ''; // Mostrar vacío en lugar del texto por defecto
          }
          
          // Truncar texto si es muy largo (excepto observaciones)
          if (index !== 5 && cellText.length > 25) {
            cellText = cellText.substring(0, 22) + '...';
          }
          
          doc.text(cellText, x + 8, y + (index === 5 ? 12 : 18), { 
            width: col.width - 16,
            ellipsis: index !== 5, // No truncar observaciones
            lineBreak: index === 5, // Solo multilínea para observaciones
            height: index === 5 ? rowHeight - 20 : undefined
          });
        }
        
        x += col.width;
      });
      
      doc.fillColor('black');
    return y + rowHeight;
  };

    // Título de la tabla
    doc.fontSize(14).fillColor('#1e40af').text('DETALLE DE PROBLEMAS DOCUMENTALES', 50, currentY, { width: 500, align: 'left' });
    doc.moveDown(1);
    currentY = doc.y;
    
    // Dibujar header de la tabla
    currentY = drawModernTableHeader(currentY);
    
    // Agrupar datos por semana para mejor organización
    const weekGroups = new Map<string, any[]>();
    tableData.forEach(row => {
      const weekStart = getWeekStart(row.signDate);
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weekGroups.has(weekKey)) {
        weekGroups.set(weekKey, []);
      }
      weekGroups.get(weekKey)!.push(row);
    });
    
    // Procesar datos por semana
    const sortedWeeks = Array.from(weekGroups.keys()).sort().reverse();
    let isWeekShaded = false;
    let recordCount = 0;
    
    for (const weekKey of sortedWeeks) {
      const weekData = weekGroups.get(weekKey) || [];
      const weekStart = new Date(weekKey);
      
      // Nueva página si es necesario
      if (currentY > 650) {
        doc.addPage();
        await addModernCompanyHeader(doc);
        doc.fontSize(16).fillColor('#1e40af').text('REPORTE DE CRÉDITOS (Continuación)', 50, doc.y, { align: 'center' });
        doc.moveDown(2);
        currentY = doc.y;
        currentY = drawModernTableHeader(currentY);
      }
      
      // Header de semana con diseño moderno
      const weekHeaderY = currentY;
      doc.fillColor('#e0f2fe').rect(startX, weekHeaderY, pageWidth, 25).fill();
      doc.strokeColor('#0284c7').lineWidth(1).rect(startX, weekHeaderY, pageWidth, 25).stroke();
      
      doc.fontSize(11).fillColor('#0284c7');
      doc.text(`Semana del ${weekStart.toLocaleDateString('es-ES')}`, startX + 10, weekHeaderY + 8);
      doc.text(`(${weekData.length} registro${weekData.length !== 1 ? 's' : ''})`, startX + 300, weekHeaderY + 8);
      
      currentY = weekHeaderY + 25;
      
      // Dibujar filas de la semana
      for (const rowData of weekData) {
        if (currentY > 650) {
          doc.addPage();
          await addModernCompanyHeader(doc);
          currentY = doc.y;
          currentY = drawModernTableHeader(currentY);
        }
        
        currentY = drawModernTableRow(rowData, currentY, isWeekShaded);
        recordCount++;
      }
      
      // Alternar sombreado por semana
      isWeekShaded = !isWeekShaded;
      
      // Separador entre semanas
      if (weekKey !== sortedWeeks[sortedWeeks.length - 1]) {
        doc.strokeColor('#0284c7').lineWidth(1);
        doc.moveTo(startX, currentY + 5).lineTo(startX + pageWidth, currentY + 5).stroke();
        currentY += 15;
      }
    }
    
    console.log(`✅ Tabla moderna completada con ${recordCount} registros`);
    
    // Agregar página de resumen final si hay datos
    if (tableData.length > 0) {
      doc.addPage();
      await addModernCompanyHeader(doc);
      await generateFinalActionSummary(doc, tableData);
    }
    
  } catch (error) {
    console.error('Error generando tabla moderna:', error);
    doc.fontSize(12).text('Error generando tabla de documentos', { align: 'center' });
  }
}

// ✅ FUNCIÓN PARA GENERAR RESUMEN FINAL DE ACCIONES
export async function generateFinalActionSummary(doc: any, tableData: any[]): Promise<void> {
  try {
    doc.fontSize(18).fillColor('#1e40af').text('PLAN DE ACCIÓN RECOMENDADO', 50, doc.y, { width: 500, align: 'center' });
    doc.moveDown(2);
    
    // Caja de acción prioritaria
    const actionBoxY = doc.y;
    const actionBoxHeight = 80;
    
    doc.fillColor('#fef2f2').rect(50, actionBoxY, 500, actionBoxHeight).fill();
    doc.strokeColor('#dc2626').lineWidth(3).rect(50, actionBoxY, 500, actionBoxHeight).stroke();
    
    doc.fontSize(14).fillColor('#dc2626').text('🚨 ACCIÓN INMEDIATA REQUERIDA', 70, actionBoxY + 15, { width: 460, align: 'left' });
    doc.fontSize(11).fillColor('#7f1d1d');
    doc.text('1. Contactar a todos los clientes listados para completar documentación', 70, actionBoxY + 35, { width: 460 });
    doc.text('2. Verificar calidad de fotografías y legibilidad de documentos', 70, actionBoxY + 50, { width: 460 });
    doc.text('3. Los créditos no pueden proceder sin documentación completa', 70, actionBoxY + 65, { width: 460 });
    
    doc.y = actionBoxY + actionBoxHeight + 30;
    
    // Estadísticas de prioridad
    const priorityStats = [
      { 
        label: 'ALTA PRIORIDAD', 
        count: tableData.filter(r => r.problemDescription.includes('faltante')).length,
        description: 'Documentos completamente faltantes',
        color: '#dc2626'
      },
      { 
        label: 'MEDIA PRIORIDAD', 
        count: tableData.filter(r => r.problemDescription.includes('con error')).length,
        description: 'Documentos con errores que requieren corrección',
        color: '#ea580c'
      }
    ];
    
    priorityStats.forEach((priority, index) => {
      const y = doc.y + (index * 40);
      
      // Caja de prioridad
      doc.fillColor(priority.color).rect(50, y, 20, 20).fill();
      doc.fontSize(12).fillColor('white').text(priority.count.toString(), 55, y + 6, { width: 10, align: 'center' });
      
      doc.fontSize(12).fillColor(priority.color).text(priority.label, 80, y + 2, { width: 150 });
      doc.fontSize(10).fillColor('#374151').text(priority.description, 80, y + 16, { width: 400 });
    });
    
    doc.y += (priorityStats.length * 40) + 20;
    
    // Footer con información de contacto
    const footerY = doc.y;
    doc.fillColor('#f8fafc').rect(50, footerY, 500, 60).fill();
    doc.strokeColor('#64748b').lineWidth(1).rect(50, footerY, 500, 60).stroke();
    
    doc.fontSize(10).fillColor('#64748b').text('📞 Para más información sobre este reporte, contacte al administrador del sistema', 70, footerY + 15, { width: 460, align: 'center' });
    doc.text(`📊 Reporte generado automáticamente el ${new Date().toLocaleString('es-ES')}`, 70, footerY + 30, { width: 460, align: 'center' });
    doc.text('🔒 Documento confidencial - Solo para uso interno', 70, footerY + 45, { width: 460, align: 'center' });
    
  } catch (error) {
    console.error('Error generando resumen final:', error);
  }
}

// ✅ FUNCIÓN PARA AGREGAR FOOTER PROFESIONAL
export async function addProfessionalFooter(doc: any) {
  try {
    const pageHeight = 792; // Altura estándar de página A4
    const footerY = pageHeight - 50;
    
    // Línea divisoria
    doc.strokeColor('#e2e8f0').lineWidth(1);
    doc.moveTo(50, footerY - 10).lineTo(562, footerY - 10).stroke();
    
    // Información del footer
    doc.fontSize(8).fillColor('gray');
    doc.text('SOLUFACIL - Sistema de Gestión de Créditos', 50, footerY, { align: 'left' });
    doc.text(`Página generada automáticamente - ${new Date().toLocaleDateString('es-ES')}`, 50, footerY + 12, { align: 'left' });
    
    // Información de contacto (lado derecho)
    doc.text('Reporte Confidencial', 400, footerY, { align: 'right', width: 150 });
    doc.text('Para uso interno únicamente', 400, footerY + 12, { align: 'right', width: 150 });
    
    // Resetear color
    doc.fillColor('black');
    
  } catch (error) {
    console.error('Error agregando footer:', error);
  }
}