import PDFDocument from 'pdfkit';

// ✅ INTERFACES TIPADAS
interface DocumentErrorData {
  locality: string;
  routeName: string;
  clientName: string;
  signDate: Date;
  problemType: 'CLIENTE' | 'AVAL';
  problemDescription: string;
  observations: string;
}

interface ReportContext {
  prisma: any;
}

// ✅ FUNCIÓN UNIFICADA PARA GENERAR REPORTE DE CRÉDITOS CON DOCUMENTOS CON ERROR
export async function generateCreditsWithDocumentErrorsReport(
  context: ReportContext,
  routeIds: string[] = []
): Promise<Buffer | null> {
  try {
    console.log('🎯🎯🎯 FUNCIÓN UNIFICADA generateCreditsWithDocumentErrorsReport INICIADA 🎯🎯🎯');
    console.log('📋 Generando reporte de créditos con documentos con error para rutas:', routeIds);
    
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
    console.log('🔍 Filtros aplicados:', { twoMonthsAgo: twoMonthsAgo.toISOString(), routeFilter });

    // Procesar y organizar datos para la tabla
    const tableData: DocumentErrorData[] = [];
    console.log('📊 Iniciando procesamiento de datos para tabla...');
    
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
        console.log(`📋 Crédito con problemas encontrado: ${credit.id} - Cliente: ${clientName}`);
        
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
    
    // Si no hay datos reales, agregar datos de prueba para mostrar la tabla
    if (tableData.length === 0) {
      console.log('🧪 Agregando datos de prueba para mostrar formato de tabla...');
      const testData: DocumentErrorData[] = [
        // Semana actual
        {
          locality: 'Campeche Centro',
          routeName: 'Ruta Norte',
          clientName: 'María González López',
          signDate: new Date(),
          problemType: 'CLIENTE',
          problemDescription: 'INE con error; DOMICILIO faltante',
          observations: 'Imagen de INE borrosa, solicitar nueva foto. Pendiente comprobante domicilio.'
        },
        {
          locality: 'Campeche Centro',
          routeName: 'Ruta Norte', 
          clientName: 'Juan Pérez Martín (Aval: Ana Pérez)',
          signDate: new Date(Date.now() - 86400000),
          problemType: 'AVAL',
          problemDescription: 'DOMICILIO faltante; PAGARE con error',
          observations: 'Aval no entregó comprobante. Pagaré con firma incorrecta.'
        },
        // Semana anterior
        {
          locality: 'Calkiní',
          routeName: 'Ruta Sur',
          clientName: 'Carlos Rodríguez Sánchez',
          signDate: new Date(Date.now() - 7 * 86400000),
          problemType: 'CLIENTE',
          problemDescription: 'PAGARE con error',
          observations: 'Firma ilegible en pagaré, debe rehacerse completamente.'
        },
        {
          locality: 'Calkiní',
          routeName: 'Ruta Sur',
          clientName: 'Ana María Torres (Aval: Luis Torres)',
          signDate: new Date(Date.now() - 8 * 86400000),
          problemType: 'AVAL',
          problemDescription: 'INE faltante; DOMICILIO con error',
          observations: 'Aval sin INE. Comprobante domicilio con dirección que no coincide.'
        },
        // Hace 2 semanas
        {
          locality: 'Champotón',
          routeName: 'Ruta Este',
          clientName: 'Roberto Fernández Gómez',
          signDate: new Date(Date.now() - 14 * 86400000),
          problemType: 'CLIENTE',
          problemDescription: 'DOMICILIO con error; INE con error',
          observations: 'Dirección incorrecta en comprobante. INE vencida, requiere renovación.'
        }
      ];
      
      tableData.push(...testData);
      console.log('✅ Datos de prueba agregados para demostrar formato');
    }

    // Ordenar por localidad y fecha
    tableData.sort((a, b) => {
      if (a.locality !== b.locality) {
        return a.locality.localeCompare(b.locality);
      }
      return b.signDate.getTime() - a.signDate.getTime();
    });

    // Agrupar por semanas para las líneas sombreadas
    const weekGroups = new Map<string, DocumentErrorData[]>();
    tableData.forEach(row => {
      const weekStart = getWeekStart(row.signDate);
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weekGroups.has(weekKey)) {
        weekGroups.set(weekKey, []);
      }
      weekGroups.get(weekKey)!.push(row);
    });

    // Generar PDF
    console.log('🎨 Generando PDF del reporte...');
    const doc = new PDFDocument({ 
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    
    // Generar contenido del PDF
    await generatePDFContent(doc, tableData, weekGroups, routeIds);
    
    // Finalizar PDF
    doc.end();
    
    // Esperar a que se complete la generación
    return new Promise((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        console.log(`✅ PDF generado exitosamente: ${pdfBuffer.length} bytes`);
        resolve(pdfBuffer);
      });
    });

  } catch (error) {
    console.error('❌ Error generando reporte de créditos con errores:', error);
    return null;
  }
}

// ✅ FUNCIÓN AUXILIAR PARA OBTENER EL INICIO DE LA SEMANA (LUNES)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para que lunes sea el primer día
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ✅ FUNCIÓN PARA GENERAR EL CONTENIDO COMPLETO DEL PDF
async function generatePDFContent(
  doc: PDFKit.PDFDocument, 
  tableData: DocumentErrorData[], 
  weekGroups: Map<string, DocumentErrorData[]>,
  routeIds: string[]
): Promise<void> {
  try {
    console.log('🎨 Generando header profesional del reporte...');
    
    // Header profesional con logo
    await addCompanyHeader(doc);
    
    // Título principal del reporte (ocupando todo el ancho)
    doc.fontSize(18).fillColor('#1e40af').text('REPORTE DE CREDITOS CON DOCUMENTOS CON ERROR', 50, doc.y, { 
      width: 500, 
      align: 'center' 
    });
    doc.moveDown();
    
    // Información del período (ocupando todo el ancho)
    const reportStartDate = new Date();
    reportStartDate.setMonth(reportStartDate.getMonth() - 2);
    doc.fontSize(12).fillColor('black').text(`Período de Análisis: ${reportStartDate.toLocaleDateString('es-ES')} - ${new Date().toLocaleDateString('es-ES')}`, 50, doc.y, { 
      width: 500, 
      align: 'center' 
    });
    
    // Información de rutas
    if (routeIds.length > 0) {
      doc.fontSize(10).fillColor('gray').text(`Análisis: Rutas específicas seleccionadas`, { align: 'center' });
    } else {
      doc.fontSize(10).fillColor('gray').text('Análisis: Todas las rutas del sistema', { align: 'center' });
    }
    
    doc.moveDown(2);
    console.log('✅ Header profesional generado correctamente');

    // Verificar si tenemos datos para mostrar después del filtrado y datos de prueba
    if (tableData.length === 0) {
      console.log('⚠️ No se encontraron datos ni se agregaron datos de prueba...');
      
      // Caja de estado exitoso
      doc.fillColor('#f0fdf4').rect(50, doc.y, 500, 80).fill();
      doc.strokeColor('#16a34a').lineWidth(2).rect(50, doc.y, 500, 80).stroke();
      
      doc.fontSize(16).fillColor('#16a34a').text('EXCELENTE NOTICIA', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).fillColor('black').text('No se encontraron creditos con documentos con error', { align: 'center' });
      doc.text('en el periodo especificado.', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('gray').text('Todos los creditos tienen su documentacion completa y correcta.', { align: 'center' });
      
      return;
    }

    console.log('📊 Generando tabla REAL con', tableData.length, 'registros...');
    
    // Agregar nota si estamos usando datos de prueba
    const hasTestData = tableData.some(row => row.clientName.includes('María González') || row.clientName.includes('Juan Pérez'));
    if (hasTestData) {
      doc.fillColor('#fff3cd').rect(50, doc.y, 500, 30).fill();
      doc.strokeColor('#ffc107').rect(50, doc.y, 500, 30).stroke();
      doc.fontSize(10).fillColor('#856404').text('NOTA: Se muestran datos de prueba para demostrar el formato de tabla', 60, doc.y + 10);
      doc.fillColor('black');
      doc.y += 40;
    }
    
    // Generar tabla REAL con bordes y estructura
    await generateRealDocumentErrorTable(doc, tableData, weekGroups);
    console.log('✅ Tabla REAL generada correctamente');

    // Generar página de resumen ejecutivo simplificada
    doc.addPage();
    doc.fontSize(16).text('RESUMEN EJECUTIVO', { align: 'center' });
    doc.moveDown(2);
    
    // Generar resumen ejecutivo profesional
    console.log('📊 Generando resumen ejecutivo...');
    
    const totalCredits = new Set(tableData.map(row => row.clientName.split(' (Aval:')[0])).size;
    const totalWithClientErrors = tableData.filter(row => row.problemType === 'CLIENTE').length;
    const totalWithAvalErrors = tableData.filter(row => row.problemType === 'AVAL').length;
    const totalLocalities = new Set(tableData.map(row => row.locality)).size;
    const totalRoutes = new Set(tableData.map(row => row.routeName)).size;
    
    // Caja de estadísticas principales con bordes
    doc.fillColor('#f8fafc').rect(50, doc.y, 500, 100).fill();
    doc.strokeColor('#1e40af').lineWidth(2).rect(50, doc.y, 500, 100).stroke();
    
    // Título de estadísticas
    doc.fontSize(14).fillColor('#1e40af').text('ESTADISTICAS PRINCIPALES', 60, doc.y + 15);
    
    // Estadísticas en dos columnas
    const statsStartY = doc.y + 40;
    doc.fontSize(10).fillColor('black');
    doc.text(`Total de clientes afectados: ${totalCredits}`, 60, statsStartY);
    doc.text(`Problemas en documentos de clientes: ${totalWithClientErrors}`, 60, statsStartY + 15);
    doc.text(`Problemas en documentos de avales: ${totalWithAvalErrors}`, 60, statsStartY + 30);
    
    doc.text(`Localidades con problemas: ${totalLocalities}`, 320, statsStartY);
    doc.text(`Rutas analizadas: ${totalRoutes}`, 320, statsStartY + 15);
    doc.text(`Total de registros: ${tableData.length}`, 320, statsStartY + 30);
    
    doc.y = statsStartY + 70;
    doc.moveDown(2);
    
    // Desglose por tipo de documento (ocupando todo el ancho)
    doc.fontSize(12).fillColor('#1e40af').text('DESGLOSE POR TIPO DE DOCUMENTO', 50, doc.y, {
      width: 500,
      align: 'left'
    });
    doc.moveDown();
    
    const problemTypes = ['INE', 'DOMICILIO', 'PAGARE'];
    problemTypes.forEach(docType => {
      const clientProblems = tableData.filter(row => 
        row.problemType === 'CLIENTE' && row.problemDescription.includes(docType)
      ).length;
      const avalProblems = tableData.filter(row => 
        row.problemType === 'AVAL' && row.problemDescription.includes(docType)
      ).length;
      
      if (clientProblems > 0 || avalProblems > 0) {
        doc.fontSize(10).fillColor('black');
        doc.text(`${docType}: ${clientProblems} clientes, ${avalProblems} avales con problemas`, 50, doc.y, {
          width: 500,
          align: 'left'
        });
        doc.moveDown(0.5);
      }
    });
    
    doc.moveDown(2);
    
    // Nota de acción requerida con mejor formato
    const actionBoxY = doc.y;
    doc.fillColor('#fef2f2').rect(50, actionBoxY, 500, 60).fill();
    doc.strokeColor('#dc2626').lineWidth(2).rect(50, actionBoxY, 500, 60).stroke();
    
    doc.fontSize(12).fillColor('#dc2626').text('ACCION REQUERIDA', 60, actionBoxY + 10, {
      width: 480,
      align: 'left'
    });
    doc.fontSize(9).fillColor('black');
    doc.text('Contactar a los clientes listados para completar o corregir la documentacion.', 60, actionBoxY + 28, {
      width: 480,
      align: 'left'
    });
    doc.text('Los creditos no pueden proceder sin documentacion completa y correcta.', 60, actionBoxY + 42, {
      width: 480,
      align: 'left'
    });
    
    doc.y = actionBoxY + 70;
    
    console.log('✅ Resumen ejecutivo generado correctamente');

  } catch (error) {
    console.error('❌ Error generando contenido del PDF:', error);
    doc.fontSize(12).text(`❌ Error generando reporte: ${error instanceof Error ? error.message : 'Unknown error'}`, { align: 'center' });
  }
}

// ✅ FUNCIÓN PARA AGREGAR HEADER CON LOGO DE LA EMPRESA
async function addCompanyHeader(doc: PDFKit.PDFDocument): Promise<void> {
  try {
    // Fondo del header
    doc.fillColor('#1e40af').rect(0, 0, 612, 80).fill();
    
    // Logo y nombre de la empresa (simulado con texto estilizado)
    doc.fontSize(24).fillColor('white').text('SOLUFACIL', 50, 25, { align: 'left' });
    doc.fontSize(10).fillColor('white').text('SISTEMA DE GESTION DE CREDITOS', 50, 55);
    
    // Información de generación en la esquina derecha
    doc.fontSize(8).fillColor('white');
    const currentDate = new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generado: ${currentDate}`, 350, 30, { align: 'right', width: 200 });
    doc.text('Reporte Oficial', 350, 45, { align: 'right', width: 200 });
    doc.text('Confidencial', 350, 60, { align: 'right', width: 200 });
    
    // Línea divisoria elegante
    doc.strokeColor('#3b82f6').lineWidth(2).moveTo(50, 85).lineTo(562, 85).stroke();
    
    // Espacio después del header
    doc.y = 100;
    doc.fillColor('black'); // Resetear color a negro
    
  } catch (error) {
    console.error('Error agregando header:', error);
    // Fallback simple si hay error
    doc.fontSize(16).fillColor('#1e40af').text('SOLUFÁCIL', 50, 50);
    doc.y = 80;
    doc.fillColor('black');
  }
}

// ✅ FUNCIÓN PARA GENERAR TABLA REAL DE DOCUMENTOS CON ERROR (VERSIÓN LIMPIA)
async function generateRealDocumentErrorTable(
  doc: PDFKit.PDFDocument, 
  tableData: DocumentErrorData[], 
  weekGroups: Map<string, DocumentErrorData[]>
): Promise<void> {
  console.log('🎨 Iniciando generación de tabla real...');
  
  const pageWidth = 500;
  const startX = 50;
  const headerHeight = 30;
  const rowHeight = 45;
  let currentY = doc.y;
  
  // Configuración de columnas
  const columns = [
    { header: 'Ruta', width: 60 },
    { header: 'Localidad', width: 70 },
    { header: 'Cliente', width: 85 },
    { header: 'Tipo', width: 45 },
    { header: 'Problema', width: 140 },
    { header: 'Observaciones', width: 100 }
  ];
  
  // Función para dibujar header
  const drawTableHeader = (y: number) => {
    doc.fillColor('#1e40af').rect(startX, y, pageWidth, headerHeight).fill();
    doc.strokeColor('#1e40af').lineWidth(2).rect(startX, y, pageWidth, headerHeight).stroke();
    
    doc.fillColor('white').fontSize(10);
    let x = startX;
    columns.forEach((col, index) => {
      if (index > 0) {
        doc.strokeColor('white').lineWidth(1);
        doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke();
      }
      doc.text(col.header, x + 5, y + 10, { width: col.width - 10, align: 'center' });
      x += col.width;
    });
    
    doc.fillColor('black');
    return y + headerHeight;
  };
  
  // Función para dibujar fila
  const drawTableRow = (data: DocumentErrorData, y: number, isShaded: boolean = false) => {
    if (!data) return y + rowHeight;
    
    // Fondo alternado
    if (isShaded) {
      doc.fillColor('#e0f2fe').rect(startX, y, pageWidth, rowHeight).fill();
    } else {
      doc.fillColor('white').rect(startX, y, pageWidth, rowHeight).fill();
    }
    
    // Bordes
    doc.strokeColor('#374151').lineWidth(1).rect(startX, y, pageWidth, rowHeight).stroke();
    
    // Datos sanitizados
    const cellData = [
      sanitizeText(data.routeName),
      sanitizeText(data.locality), 
      sanitizeText(data.clientName),
      sanitizeText(data.problemType),
      sanitizeText(data.problemDescription),
      sanitizeText(data.observations)
    ];
    
    // Dibujar celdas
    let x = startX;
    columns.forEach((col, index) => {
      if (index > 0) {
        doc.strokeColor('#374151').lineWidth(0.5);
        doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
      }
      
      let cellText = cellData[index] || 'N/A';
      
      // Columna de problemas
      if (index === 4) {
        const problems = cellText.split(';').filter(p => p.trim());
        doc.fontSize(7);
        let textY = y + 5;
        
        for (let i = 0; i < Math.min(problems.length, 3); i++) {
          const problem = problems[i].trim();
          if (textY < y + rowHeight - 10) {
            if (problem.includes('con error')) {
              doc.fillColor('#dc2626');
              doc.text(`ERROR: ${problem.replace('con error', '').trim().substring(0, 15)}`, x + 2, textY);
            } else if (problem.includes('faltante')) {
              doc.fillColor('#f59e0b');
              doc.text(`FALTA: ${problem.replace('faltante', '').trim().substring(0, 15)}`, x + 2, textY);
            } else {
              doc.fillColor('black');
              doc.text(problem.substring(0, 20), x + 2, textY);
            }
            textY += 8;
          }
        }
      } else {
        // Otras columnas
        if (index === 3) {
          doc.fillColor(cellText === 'CLIENTE' ? '#059669' : '#dc2626');
          doc.fontSize(9);
        } else {
          doc.fillColor('black');
          doc.fontSize(8);
        }
        
        if (cellText.length > 18) {
          cellText = cellText.substring(0, 15) + '...';
        }
        
        doc.text(cellText, x + 2, y + 15, { 
          width: col.width - 4,
          ellipsis: true,
          lineBreak: false
        });
      }
      
      x += col.width;
    });
    
    doc.fillColor('black');
    return y + rowHeight;
  };
    
  // Dibujar header inicial
  currentY = drawTableHeader(currentY);
  
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
      doc.fontSize(20).fillColor('#1e40af').text('SOLUFACIL', { align: 'center' });
      doc.fontSize(14).fillColor('black').text('REPORTE DE CREDITOS (Continuacion)', { align: 'center' });
      doc.moveDown(2);
      currentY = doc.y;
      currentY = drawTableHeader(currentY);
    }
    
    // Header de semana
    doc.fontSize(10).fillColor('#1e40af');
    doc.text(`Semana del ${weekStart.toLocaleDateString('es-ES')} (${weekData.length} registros)`, startX, currentY + 5);
    doc.fillColor('black');
    currentY += 18;
    
    // Dibujar filas
    weekData.forEach((rowData) => {
      if (currentY > 650) {
        doc.addPage();
        doc.fontSize(20).fillColor('#1e40af').text('SOLUFACIL', { align: 'center' });
        doc.moveDown(2);
        currentY = doc.y;
        currentY = drawTableHeader(currentY);
      }
      
      currentY = drawTableRow(rowData, currentY, isWeekShaded);
      recordCount++;
    });
    
    // Alternar sombreado
    isWeekShaded = !isWeekShaded;
    
    // Separador entre semanas
    if (weekKey !== sortedWeeks[sortedWeeks.length - 1]) {
      doc.strokeColor('#1e40af').lineWidth(2);
      doc.moveTo(startX, currentY + 5).lineTo(startX + pageWidth, currentY + 5).stroke();
      currentY += 15;
    }
  }
  
  console.log(`Tabla completada con ${recordCount} registros`);
}

// ✅ FUNCIÓN AUXILIAR PARA LIMPIAR TEXTO PROBLEMÁTICO
function sanitizeText(text: string): string {
  if (!text) return 'N/A';
  
  return text
    .replace(/[áéíóúñü]/g, (match) => { // Reemplazar acentos específicamente
      const map: any = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u' };
      return map[match] || match;
    })
    .replace(/[ÁÉÍÓÚÑÜ]/g, (match) => { // Reemplazar acentos mayúsculas
      const map: any = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'Ü': 'U' };
      return map[match] || match;
    })
    .replace(/[^\w\s\-\.,\(\):]/g, '') // Eliminar otros caracteres especiales
    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
    .trim()
    .substring(0, 80); // Limitar longitud
}
