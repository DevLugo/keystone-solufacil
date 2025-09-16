import { TelegramService } from './telegramService';
import { generateCreditsWithDocumentErrorsReport, generateCarteraReport } from './reportGenerationService';
import { generateAndSendReport, calculatePreviousWeek, ReportConfig, WeekInfo } from './reportFactoryService';

// ✅ INTERFACES Y TIPOS (ahora importados desde reportFactoryService)
// interface ReportConfig ya está importada desde reportFactoryService

// Función para generar reporte de cobranza con semana anterior
const generateCobranzaReport = async (prisma: any, routeId: string) => {
  try {
    // Calcular la semana anterior
    const previousWeek = calculatePreviousWeek();
    
    console.log(`📊 [CRON] Generando reporte de cobranza para semana anterior:`, {
      year: previousWeek.year,
      month: previousWeek.month,
      routeId
    });

    // Llamar a la query getActiveLoansReport con la semana anterior
    const reportData = await prisma.$queryRaw`
      SELECT * FROM getActiveLoansReport(${routeId}, ${previousWeek.year}, ${previousWeek.month}, true)
    `;

    return {
      success: true,
      data: reportData,
      weekInfo: {
        year: previousWeek.year,
        month: previousWeek.month,
        monthName: new Date(previousWeek.year, previousWeek.month - 1).toLocaleString('es-ES', { month: 'long' })
      }
    };
  } catch (error) {
    console.error('❌ [CRON] Error generando reporte de cobranza:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

// ✅ FUNCIÓN SIMPLIFICADA USANDO EL PATRÓN FACTORY
export const sendCronReportToTelegram = async (
  chatId: string, 
  reportType: string,
  prisma: any,
  reportConfig: ReportConfig
): Promise<boolean> => {
  try {
    console.log(`📱 [CRON] Enviando reporte ${reportType} a ${chatId} usando Factory Pattern`);
    
    // Calcular la semana anterior para reportes que la necesiten
    let weekInfo: WeekInfo | null = null;
    
    if (reportType === 'resumen_semanal' || reportType === 'reporte_cobranza') {
      weekInfo = calculatePreviousWeek();
      console.log(`📅 [CRON] Semana calculada:`, weekInfo);
    }
    
    // Usar la función unificada del Factory Pattern
    const success = await generateAndSendReport(
      reportType,
      weekInfo,
      { prisma },
      reportConfig,
      chatId
    );
    
    if (success) {
      console.log(`✅ [CRON] Reporte ${reportType} enviado exitosamente a ${chatId}`);
    } else {
      console.error(`❌ [CRON] Error enviando reporte ${reportType} a ${chatId}`);
    }
    
    return success;
    
  } catch (error) {
    console.error('❌ [CRON] Error enviando reporte a Telegram:', error);
    return false;
  }
};

// Función principal para procesar un reporte programado
export const processCronReport = async (
  reportConfig: ReportConfig,
  prisma: any
): Promise<void> => {
  try {
    console.log(`🚀 [CRON] Procesando reporte: ${reportConfig.name} (${reportConfig.reportType})`);
    
    // Obtener usuarios de la plataforma que son destinatarios
    const platformRecipients = await prisma.user.findMany({
      where: {
        id: { in: reportConfig.recipients?.map(r => r.id) || [] }
      }
    });
    
    console.log(`👥 [CRON] Encontrados ${platformRecipients.length} destinatarios de la plataforma`);
    
    if (platformRecipients.length === 0) {
      console.log(`⚠️ [CRON] No hay destinatarios configurados para el reporte ${reportConfig.name}`);
      return;
    }
    
    // Buscar usuarios de Telegram activos para cada destinatario
    let sentCount = 0;
    let errorCount = 0;
    let usersWithoutTelegram = [];
    
    for (const recipient of platformRecipients) {
      try {
        console.log(`👤 [CRON] Procesando destinatario: ${recipient.name} (${recipient.email})`);
        
        // Buscar si el usuario tiene Telegram configurado
        const telegramUser = await prisma.telegramUser.findFirst({
          where: {
            platformUser: { id: recipient.id },
            isActive: true
          }
        });
        
        if (telegramUser && telegramUser.isActive) {
          console.log(`📱 [CRON] Enviando reporte a ${recipient.name} (${telegramUser.chatId})`);
          
          const sent = await sendCronReportToTelegram(
            telegramUser.chatId, 
            reportConfig.reportType,
            prisma,
            reportConfig
          );
          
          if (sent) {
            sentCount++;
            console.log(`✅ [CRON] Reporte enviado exitosamente a ${recipient.name}`);
          } else {
            errorCount++;
            console.log(`❌ [CRON] Error enviando reporte a ${recipient.name}`);
          }
        } else {
          usersWithoutTelegram.push(recipient.name);
          console.log(`⚠️ [CRON] Usuario ${recipient.name} no tiene Telegram configurado`);
        }
        
      } catch (error) {
        console.error(`❌ [CRON] Error procesando usuario ${recipient.name}:`, error);
        errorCount++;
      }
    }
    
    console.log(`📊 [CRON] Resumen del reporte ${reportConfig.name}: ${sentCount} exitosos, ${errorCount} fallidos`);
    
    if (usersWithoutTelegram.length > 0) {
      console.log(`⚠️ [CRON] Usuarios sin Telegram configurado: ${usersWithoutTelegram.join(', ')}`);
    }
    
  } catch (error) {
    console.error(`❌ [CRON] Error procesando reporte ${reportConfig.name}:`, error);
  }
};
