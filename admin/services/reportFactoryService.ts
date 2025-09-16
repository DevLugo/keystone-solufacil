import { TelegramService } from './telegramService';
import { generateCreditsWithDocumentErrorsReport, generateCarteraReport } from './reportGenerationService';

// ✅ INTERFACES PARA EL PATRÓN FACTORY
export interface ReportConfig {
  id: string;
  name: string;
  reportType: string;
  routes: any[];
  recipients: any[];
}

export interface WeekInfo {
  year: number;
  month: number;
  monthName: string;
}

export interface ReportResult {
  success: boolean;
  pdfBuffer?: Buffer;
  filename?: string;
  caption?: string;
  error?: string;
}

// ✅ INTERFAZ PARA EL GENERADOR DE REPORTES
interface ReportGenerator {
  generateReport(
    context: any,
    routeIds: string[],
    weekInfo?: WeekInfo
  ): Promise<ReportResult>;
}

// ✅ GENERADOR PARA CRÉDITOS CON ERRORES
class CreditosConErroresGenerator implements ReportGenerator {
  async generateReport(
    context: any,
    routeIds: string[],
    weekInfo?: WeekInfo
  ): Promise<ReportResult> {
    try {
      console.log('📊 [FACTORY] Generando reporte de créditos con errores...');
      
      const pdfBuffer = await generateCreditsWithDocumentErrorsReport(context, routeIds);
      
      if (pdfBuffer && pdfBuffer.length > 0) {
        const filename = `reporte_creditos_errores_${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`;
        const caption = `📊 <b>REPORTE AUTOMÁTICO - CRÉDITOS CON ERRORES</b>\n\n📅 Generado: ${new Date().toLocaleString('es-ES')}\n📊 Rutas: ${routeIds.length > 0 ? routeIds.length + ' específicas' : 'Todas'}\n\n✅ Reporte moderno y profesional\n🤖 Enviado automáticamente por el sistema`;
        
        return {
          success: true,
          pdfBuffer,
          filename,
          caption
        };
      } else {
        return {
          success: false,
          error: 'No se pudo generar el PDF o está vacío'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error generando reporte: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
}

// ✅ GENERADOR PARA RESUMEN SEMANAL DE CARTERA
class ResumenSemanalGenerator implements ReportGenerator {
  async generateReport(
    context: any,
    routeIds: string[],
    weekInfo?: WeekInfo
  ): Promise<ReportResult> {
    try {
      console.log('📊 [FACTORY] Generando reporte de cartera (resumen semanal)...');
      
      const pdfBuffer = await generateCarteraReport(context, routeIds, weekInfo);
      
      if (pdfBuffer && pdfBuffer.length > 0) {
        const weekText = weekInfo ? `${weekInfo.monthName} ${weekInfo.year}` : new Date().toLocaleDateString('es-ES');
        const filename = `reporte_cartera_${weekText.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
        const caption = `📊 <b>REPORTE AUTOMÁTICO - CARTERA</b>\n\n📅 Semana: ${weekText}\n🛣️ Ruta: ${routeIds.length > 0 ? 'Específicas' : 'Todas'}\n\n✅ Reporte profesional en PDF\n🤖 Enviado automáticamente por el sistema`;
        
        return {
          success: true,
          pdfBuffer,
          filename,
          caption
        };
      } else {
        return {
          success: false,
          error: 'No se pudo generar el PDF de cartera'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error generando reporte de cartera: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
}

// ✅ GENERADOR PARA OTROS TIPOS DE REPORTES (TEXTO)
class TextReportGenerator implements ReportGenerator {
  async generateReport(
    context: any,
    routeIds: string[],
    weekInfo?: WeekInfo,
    reportType: string = 'general'
  ): Promise<ReportResult> {
    try {
      console.log(`📊 [FACTORY] Generando reporte de texto para: ${reportType}`);
      
      // Generar mensaje de texto según el tipo
      let message = '';
      let filename = '';
      
      switch (reportType) {
        case 'creditos_sin_documentos':
          message = `⚠️ <b>REPORTE AUTOMÁTICO - CRÉDITOS SIN DOCUMENTOS</b>\n\n📅 Generado: ${new Date().toLocaleString('es-ES')}\n📊 Rutas: ${routeIds.length > 0 ? routeIds.length + ' específicas' : 'Todas'}\n\n✅ Reporte generado automáticamente\n🤖 Enviado por el sistema de cron`;
          filename = `reporte_creditos_sin_documentos_${Date.now()}.txt`;
          break;
          
        case 'creditos_completos':
          message = `✅ <b>REPORTE AUTOMÁTICO - CRÉDITOS COMPLETOS</b>\n\n📅 Generado: ${new Date().toLocaleString('es-ES')}\n📊 Rutas: ${routeIds.length > 0 ? routeIds.length + ' específicas' : 'Todas'}\n\n✅ Reporte generado automáticamente\n🤖 Enviado por el sistema de cron`;
          filename = `reporte_creditos_completos_${Date.now()}.txt`;
          break;
          
        case 'reporte_financiero':
          message = `💰 <b>REPORTE AUTOMÁTICO - REPORTE FINANCIERO</b>\n\n📅 Generado: ${new Date().toLocaleString('es-ES')}\n📊 Rutas: ${routeIds.length > 0 ? routeIds.length + ' específicas' : 'Todas'}\n\n✅ Reporte generado automáticamente\n🤖 Enviado por el sistema de cron`;
          filename = `reporte_financiero_${Date.now()}.txt`;
          break;
          
        default:
          message = `📊 <b>REPORTE AUTOMÁTICO</b>\n\nTipo: ${reportType}\nGenerado: ${new Date().toLocaleString('es-ES')}\n\n✅ Enviado automáticamente por el sistema de cron`;
          filename = `reporte_${reportType}_${Date.now()}.txt`;
      }
      
      return {
        success: true,
        pdfBuffer: Buffer.from(message, 'utf-8'),
        filename,
        caption: message
      };
    } catch (error) {
      return {
        success: false,
        error: `Error generando reporte de texto: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
}

// ✅ FACTORY PARA CREAR GENERADORES DE REPORTES
class ReportGeneratorFactory {
  private generators: Map<string, ReportGenerator> = new Map();
  
  constructor() {
    // Registrar generadores específicos
    this.generators.set('creditos_con_errores', new CreditosConErroresGenerator());
    this.generators.set('resumen_semanal', new ResumenSemanalGenerator());
    
    // Generador por defecto para reportes de texto
    this.generators.set('default', new TextReportGenerator());
  }
  
  getGenerator(reportType: string): ReportGenerator {
    return this.generators.get(reportType) || this.generators.get('default')!;
  }
}

// ✅ FUNCIÓN PRINCIPAL UNIFICADA PARA GENERAR Y ENVIAR REPORTES
export async function generateAndSendReport(
  reportType: string,
  weekInfo: WeekInfo | null,
  context: any,
  reportConfig: ReportConfig,
  chatId: string
): Promise<boolean> {
  try {
    console.log(`🚀 [FACTORY] Iniciando generación y envío de reporte: ${reportType}`);
    console.log(`📅 Información de semana:`, weekInfo);
    
    // Obtener el token del bot desde las variables de entorno
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ [FACTORY] TELEGRAM_BOT_TOKEN no configurado');
      return false;
    }
    
    // Crear instancia del servicio de Telegram
    const telegramService = new TelegramService({ botToken, chatId });
    
    // Crear factory y obtener generador
    const factory = new ReportGeneratorFactory();
    const generator = factory.getGenerator(reportType);
    
    // Obtener rutas configuradas
    const routeIds = reportConfig.routes?.map(r => r.id) || [];
    
    // Generar reporte
    const reportResult = await generator.generateReport(context, routeIds, weekInfo);
    
    if (!reportResult.success) {
      console.error(`❌ [FACTORY] Error generando reporte: ${reportResult.error}`);
      
      // Enviar mensaje de error
      const errorMessage = `📊 <b>REPORTE AUTOMÁTICO - ERROR</b>\n\n` +
        `Tipo: ${reportType}\n` +
        `Error: ${reportResult.error}\n` +
        `📅 Generado: ${new Date().toLocaleString('es-ES')}\n\n` +
        `🤖 Enviado automáticamente por el sistema de cron`;
      
      const result = await telegramService.sendHtmlMessage(chatId, errorMessage);
      return result.ok || false;
    }
    
    // Enviar reporte según el tipo
    if (reportResult.pdfBuffer && reportResult.filename && reportResult.caption) {
      // Enviar como PDF
      console.log(`📱 [FACTORY] Enviando PDF: ${reportResult.filename} (${reportResult.pdfBuffer.length} bytes)`);
      
      const result = await telegramService.sendPdfFromBuffer(
        chatId,
        reportResult.pdfBuffer,
        reportResult.filename,
        reportResult.caption
      );
      
      if (result.ok) {
        console.log(`✅ [FACTORY] Reporte PDF enviado exitosamente a ${chatId}`);
        return true;
      } else {
        console.error(`❌ [FACTORY] Error enviando PDF a ${chatId}`);
        return false;
      }
    } else {
      // Enviar como mensaje de texto
      console.log(`📱 [FACTORY] Enviando mensaje de texto`);
      
      const result = await telegramService.sendHtmlMessage(chatId, reportResult.caption || 'Reporte generado');
      
      if (result.ok) {
        console.log(`✅ [FACTORY] Reporte de texto enviado exitosamente a ${chatId}`);
        return true;
      } else {
        console.error(`❌ [FACTORY] Error enviando mensaje de texto a ${chatId}`);
        return false;
      }
    }
    
  } catch (error) {
    console.error(`❌ [FACTORY] Error general en generateAndSendReport:`, error);
    return false;
  }
}

// ✅ FUNCIÓN AUXILIAR PARA CALCULAR LA SEMANA ANTERIOR
export function calculatePreviousWeek(): WeekInfo {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() devuelve 0-11, necesitamos 1-12
  
  // Obtener información de las semanas activas del mes actual
  const activeWeeksInfo = getActiveWeeksInfo(currentYear, currentMonth);
  
  // Encontrar en qué semana activa estamos actualmente
  let currentWeekNumber = 0;
  for (const week of activeWeeksInfo) {
    if (now >= week.start && now <= week.end) {
      currentWeekNumber = week.weekNumber;
      break;
    }
  }
  
  // Si estamos en la semana 1, necesitamos la última semana del mes anterior
  if (currentWeekNumber === 1) {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    return { 
      year: prevYear, 
      month: prevMonth,
      monthName: new Date(prevYear, prevMonth - 1).toLocaleString('es-ES', { month: 'long' })
    };
  }
  
  // Si estamos en la semana 2 o más, necesitamos la semana anterior del mes actual
  return { 
    year: currentYear, 
    month: currentMonth,
    monthName: new Date(currentYear, currentMonth - 1).toLocaleString('es-ES', { month: 'long' })
  };
}

// ✅ FUNCIÓN HELPER PARA OBTENER INFORMACIÓN DE SEMANAS ACTIVAS
function getActiveWeeksInfo(year: number, month: number) {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  // Generar todas las semanas que tocan el mes
  const weeks: Array<{ start: Date, end: Date, weekNumber: number }> = [];
  let currentDate = new Date(firstDayOfMonth);

  // Retroceder hasta encontrar el primer lunes antes del mes
  while (currentDate.getDay() !== 1) { // 1 = lunes
    currentDate.setDate(currentDate.getDate() - 1);
  }

  let weekNumber = 1;

  // Generar semanas hasta cubrir todo el mes
  while (currentDate <= lastDayOfMonth) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6); // Lunes a domingo
    weekEnd.setHours(23, 59, 59, 999);

    // Contar días de trabajo (lunes-sábado) que pertenecen al mes
    let workDaysInMonth = 0;
    let tempDate = new Date(weekStart);

    for (let i = 0; i < 6; i++) { // 6 días de trabajo
      if (tempDate.getMonth() === month - 1) {
        workDaysInMonth++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    // La semana pertenece al mes que tiene más días activos
    // Si hay empate (3-3), la semana va al mes que tiene el lunes
    if (workDaysInMonth > 3 || (workDaysInMonth === 3 && weekStart.getMonth() === month - 1)) {
      weeks.push({
        start: new Date(weekStart),
        end: new Date(weekEnd),
        weekNumber
      });
      weekNumber++;
    }

    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weeks;
}
