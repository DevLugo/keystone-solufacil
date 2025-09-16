// ✅ EJEMPLO DE USO DE LA FUNCIÓN UNIFICADA DE REPORTES
import { generateAndSendReport, calculatePreviousWeek, ReportConfig } from './reportFactoryService';

// ✅ EJEMPLO 1: Enviar reporte de créditos con errores
export async function ejemploCreditosConErrores(chatId: string, prisma: any) {
  const reportConfig: ReportConfig = {
    id: '1',
    name: 'Reporte de Créditos con Errores',
    reportType: 'creditos_con_errores',
    routes: [{ id: 'ruta-1', name: 'Ruta Centro' }],
    recipients: []
  };

  // No necesita semana específica
  const success = await generateAndSendReport(
    'creditos_con_errores',
    null, // No necesita semana
    { prisma },
    reportConfig,
    chatId
  );

  return success;
}

// ✅ EJEMPLO 2: Enviar reporte de cartera (resumen semanal)
export async function ejemploResumenSemanal(chatId: string, prisma: any) {
  const reportConfig: ReportConfig = {
    id: '2',
    name: 'Reporte de Cartera Semanal',
    reportType: 'resumen_semanal',
    routes: [{ id: 'ruta-2', name: 'Ruta Norte' }],
    recipients: []
  };

  // Calcular semana anterior automáticamente
  const weekInfo = calculatePreviousWeek();

  const success = await generateAndSendReport(
    'resumen_semanal',
    weekInfo, // Usa la semana calculada
    { prisma },
    reportConfig,
    chatId
  );

  return success;
}

// ✅ EJEMPLO 3: Enviar reporte financiero (texto)
export async function ejemploReporteFinanciero(chatId: string, prisma: any) {
  const reportConfig: ReportConfig = {
    id: '3',
    name: 'Reporte Financiero',
    reportType: 'reporte_financiero',
    routes: [],
    recipients: []
  };

  const success = await generateAndSendReport(
    'reporte_financiero',
    null, // No necesita semana
    { prisma },
    reportConfig,
    chatId
  );

  return success;
}

// ✅ EJEMPLO 4: Función genérica para cualquier tipo de reporte
export async function enviarReporteGenerico(
  reportType: string,
  chatId: string,
  prisma: any,
  routes: any[] = [],
  usarSemanaAnterior: boolean = false
) {
  const reportConfig: ReportConfig = {
    id: Date.now().toString(),
    name: `Reporte ${reportType}`,
    reportType,
    routes,
    recipients: []
  };

  // Calcular semana si es necesario
  const weekInfo = usarSemanaAnterior ? calculatePreviousWeek() : null;

  const success = await generateAndSendReport(
    reportType,
    weekInfo,
    { prisma },
    reportConfig,
    chatId
  );

  return success;
}

// ✅ EJEMPLO 5: Enviar múltiples reportes
export async function enviarTodosLosReportes(chatId: string, prisma: any) {
  const reportes = [
    'creditos_con_errores',
    'resumen_semanal',
    'creditos_sin_documentos',
    'creditos_completos',
    'reporte_financiero'
  ];

  const resultados = [];

  for (const reportType of reportes) {
    console.log(`📊 Enviando reporte: ${reportType}`);
    
    const success = await enviarReporteGenerico(
      reportType,
      chatId,
      prisma,
      [],
      reportType === 'resumen_semanal' // Solo resumen semanal usa semana anterior
    );

    resultados.push({
      reportType,
      success,
      timestamp: new Date().toISOString()
    });

    // Esperar un poco entre reportes para no saturar
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return resultados;
}
