import { TelegramService } from './telegramService';
import { generateCreditsWithDocumentErrorsReport } from './reportGenerationService';

// Interfaz para la configuración del reporte
interface ReportConfig {
  id: string;
  name: string;
  reportType: string;
  routes: any[];
  recipients: any[];
}

// Función para enviar reporte a Telegram (replica la lógica del frontend)
export const sendCronReportToTelegram = async (
  chatId: string, 
  reportType: string,
  prisma: any,
  reportConfig: ReportConfig
): Promise<boolean> => {
  try {
    console.log(`📱 [CRON] Enviando reporte ${reportType} a ${chatId}`);
    
    // Obtener el token del bot desde las variables de entorno
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ [CRON] TELEGRAM_BOT_TOKEN no configurado');
      return false;
    }
    
    // Crear instancia del servicio de Telegram
    const telegramService = new TelegramService({ botToken, chatId });
    
    // Para créditos con errores, generar y enviar PDF REAL usando función unificada
    if (reportType === 'creditos_con_errores') {
      console.log(`📊 [CRON] Generando reporte de créditos con errores usando función unificada...`);
      
      try {
        // ✅ USAR FUNCIÓN UNIFICADA PARA GENERAR PDF
        const routeIds = reportConfig.routes?.map(r => r.id) || [];
        const pdfBuffer = await generateCreditsWithDocumentErrorsReport({ prisma }, routeIds);
        
        if (pdfBuffer) {
          console.log(`📱 [CRON] PDF generado exitosamente (${pdfBuffer.length} bytes), enviando archivo a Telegram...`);
          
          // Enviar el PDF real usando el servicio de Telegram
          const filename = `reporte_creditos_con_errores_${Date.now()}.pdf`;
          const caption = `📊 <b>REPORTE AUTOMÁTICO</b>\n\nTipo: ${reportType}\nGenerado: ${new Date().toLocaleString('es-ES')}\n\n✅ Enviado automáticamente por el sistema de cron`;
          
          const result = await telegramService.sendPdfFromBuffer(chatId, pdfBuffer, filename, caption);
          return result.ok || false;
        } else {
          console.error(`❌ [CRON] No se pudo generar el PDF`);
          // Fallback: enviar mensaje de texto
          const message = `📊 <b>REPORTE AUTOMÁTICO</b>\n\nTipo: ${reportType}\nGenerado: ${new Date().toLocaleString('es-ES')}\n\n⚠️ Error generando PDF, enviando mensaje de texto\n✅ Enviado automáticamente por el sistema de cron`;
          const result = await telegramService.sendHtmlMessage(chatId, message);
          return result.ok || false;
        }
        
      } catch (pdfError) {
        console.error(`❌ [CRON] Error generando PDF usando función unificada:`, pdfError);
        
        // Fallback: enviar mensaje de texto
        const message = `📊 <b>REPORTE AUTOMÁTICO</b>\n\nTipo: ${reportType}\nGenerado: ${new Date().toLocaleString('es-ES')}\n\n⚠️ Error generando PDF, enviando mensaje de texto\n✅ Enviado automáticamente por el sistema de cron`;
        
        const result = await telegramService.sendHtmlMessage(chatId, message);
        return result.ok || false;
      }
      
    } else {
      // Para otros tipos, usar mensaje de texto
      const message = `📊 <b>REPORTE AUTOMÁTICO</b>\n\nTipo: ${reportType}\nGenerado: ${new Date().toLocaleString('es-ES')}\n\n✅ Enviado automáticamente por el sistema de cron`;
      
      const result = await telegramService.sendHtmlMessage(chatId, message);
      return result.ok || false;
    }
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
