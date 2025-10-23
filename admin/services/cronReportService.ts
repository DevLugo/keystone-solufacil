import { TelegramService } from './telegramService';
// Unificar lógica con el envío manual: usar la misma función del backend
import { generatePDFWithStreams } from '../../graphql/extendGraphqlSchema';

// Función para calcular la semana anterior basada en semanas activas (lunes-domingo)
const calculatePreviousWeek = () => {
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
    return { year: prevYear, month: prevMonth };
  }
  
  // Si estamos en la semana 2 o más, necesitamos la semana anterior del mes actual
  return { year: currentYear, month: currentMonth };
};

// Función helper para obtener información de semanas activas (necesaria para el cálculo)
const getActiveWeeksInfo = (year: number, month: number) => {
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
};

// Interfaz para la configuración del reporte
interface ReportConfig {
  id: string;
  name: string;
  reportType: string;
  routes: any[];
  recipients: any[];
}

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

// Función para enviar reporte a Telegram (replica la lógica del frontend)
export const sendCronReportToTelegram = async (
  chatId: string, 
  reportType: string,
  prisma: any,
  reportConfig: ReportConfig,
  recipient: any = null
): Promise<boolean> => {
  const startTime = Date.now();
  const { NotificationLogService } = require('./notificationLogService');
  
  // Crear contexto simulado para el log service
  const context = { prisma };
  const logService = new NotificationLogService(context);
  let logId: string | null = null;

  try {
    console.log(`📱 [CRON] Enviando reporte ${reportType} a ${chatId}`);
    
    // Crear log inicial para el reporte cron
    const initialLog = await logService.createReportLog({
      reportType,
      reportConfigId: reportConfig.id,
      reportConfigName: reportConfig.name,
      recipientUserId: recipient?.id || 'cron-user',
      recipientName: recipient?.name || 'Usuario Cron',
      recipientEmail: recipient?.email || 'cron@system.com',
      telegramChatId: chatId,
      messageContent: `Reporte automático cron: ${reportType}`,
      status: 'ERROR', // Inicial como error, se actualizará
      notes: 'Iniciando envío de reporte programado por cron'
    });
    logId = initialLog.id;
    
    // Obtener el token del bot desde las variables de entorno
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ [CRON] TELEGRAM_BOT_TOKEN no configurado');
      await logService.updateLog(logId, {
        status: 'FAILED',
        telegramErrorMessage: 'TELEGRAM_BOT_TOKEN no configurado',
        responseTimeMs: Date.now() - startTime,
        notes: 'Error: Token de Telegram no configurado'
      });
      return false;
    }
    
    // Crear instancia del servicio de Telegram
    const telegramService = new TelegramService({ botToken, chatId });
    
    // Para reporte de cobranza, generar con semana anterior
    if (reportType === 'reporte_cobranza') {
      console.log(`📊 [CRON] Generando reporte de cobranza con semana anterior...`);
      
      try {
        // Obtener la primera ruta configurada o usar todas
        const routeId = reportConfig.routes?.length > 0 ? reportConfig.routes[0].id : 'all';
        
        // Generar el reporte de cobranza
        const cobranzaReport = await generateCobranzaReport(prisma, routeId);
        
        if (cobranzaReport.success && cobranzaReport.weekInfo) {
          const weekInfo = cobranzaReport.weekInfo;
          const message = `📊 <b>REPORTE AUTOMÁTICO - COBRANZA</b>\n\n` +
            `📅 Semana mostrada: ${weekInfo.monthName} ${weekInfo.year}\n` +
            `🛣️ Ruta: ${reportConfig.routes?.length > 0 ? reportConfig.routes[0].name : 'Todas'}\n` +
            `📈 Datos: ${JSON.stringify(cobranzaReport.data).length} caracteres\n\n` +
            `✅ Reporte generado automáticamente el ${new Date().toLocaleString('es-ES')}\n` +
            `🤖 Enviado por el sistema de cron`;
          
          const sendStartTime = Date.now();
          const result = await telegramService.sendHtmlMessage(chatId, message);
          const responseTime = Date.now() - sendStartTime;
          
          if (result.ok) {
            await logService.updateLog(logId, {
              status: 'SENT',
              sentAt: new Date(),
              responseTimeMs: responseTime,
              notes: 'Reporte de cobranza enviado exitosamente por cron'
            });
            return true;
          } else {
            await logService.updateLog(logId, {
              status: 'FAILED',
              sentAt: new Date(),
              responseTimeMs: responseTime,
              telegramResponse: JSON.stringify(result),
              notes: 'Error enviando reporte de cobranza por cron'
            });
            return false;
          }
        } else {
          const errorMessage = `📊 <b>REPORTE AUTOMÁTICO - COBRANZA</b>\n\n` +
            `❌ Error generando reporte: ${cobranzaReport.error}\n` +
            `📅 Generado: ${new Date().toLocaleString('es-ES')}\n\n` +
            `🤖 Enviado automáticamente por el sistema de cron`;
          
          const sendStartTime = Date.now();
          const result = await telegramService.sendHtmlMessage(chatId, errorMessage);
          const responseTime = Date.now() - sendStartTime;
          
          if (result.ok) {
            await logService.updateLog(logId, {
              status: 'SENT',
              sentAt: new Date(),
              responseTimeMs: responseTime,
              notes: 'Reporte de cobranza con error enviado por cron'
            });
            return true;
          } else {
            await logService.updateLog(logId, {
              status: 'FAILED',
              sentAt: new Date(),
              responseTimeMs: responseTime,
              telegramResponse: JSON.stringify(result),
              notes: 'Error enviando reporte de cobranza con error por cron'
            });
            return false;
          }
        }
        
      } catch (error) {
        console.error(`❌ [CRON] Error generando reporte de cobranza:`, error);
        
        const errorMessage = `📊 <b>REPORTE AUTOMÁTICO - COBRANZA</b>\n\n` +
          `❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}\n` +
          `📅 Generado: ${new Date().toLocaleString('es-ES')}\n\n` +
          `🤖 Enviado automáticamente por el sistema de cron`;
        
        const sendStartTime = Date.now();
        const result = await telegramService.sendHtmlMessage(chatId, errorMessage);
        const responseTime = Date.now() - sendStartTime;
        
        if (result.ok) {
          await logService.updateLog(logId, {
            status: 'SENT',
            sentAt: new Date(),
            responseTimeMs: responseTime,
            notes: 'Reporte de cobranza con excepción enviado por cron'
          });
          return true;
        } else {
          await logService.updateLog(logId, {
            status: 'FAILED',
            sentAt: new Date(),
            responseTimeMs: responseTime,
            telegramResponse: JSON.stringify(result),
            notes: 'Error enviando reporte de cobranza con excepción por cron'
          });
          return false;
        }
      }
    }
    // Para créditos con errores, generar y enviar PDF usando EXACTAMENTE la misma función que el envío manual
    else if (reportType === 'creditos_con_errores') {
      console.log(`📊 [CRON] Generando reporte de créditos con errores usando función unificada...`);
      
      try {
        // ✅ GENERAR PDF USANDO LA MISMA FUNCIÓN QUE USA el botón "Enviar"
        const routeIds = reportConfig.routes?.map(r => r.id) || [];
        const pdfBuffer = await generatePDFWithStreams('creditos_con_errores', { prisma }, routeIds);
        
        if (pdfBuffer && pdfBuffer.length > 0) {
          console.log(`📱 [CRON] PDF moderno generado exitosamente (${pdfBuffer.length} bytes), enviando archivo a Telegram...`);
          
          // Enviar el PDF mejorado usando el servicio de Telegram
          const filename = `reporte_creditos_errores_${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`;
          const caption = `📊 <b>REPORTE AUTOMÁTICO - CRÉDITOS CON ERRORES</b>\n\n📅 Generado: ${new Date().toLocaleString('es-ES')}\n📊 Rutas: ${routeIds.length > 0 ? routeIds.length + ' específicas' : 'Todas'}\n\n🤖 Enviado automáticamente por el sistema`;
          
          const sendStartTime = Date.now();
          const result = await telegramService.sendPdfFromBuffer(chatId, pdfBuffer, filename, caption);
          const responseTime = Date.now() - sendStartTime;
          
          if (result.ok) {
            await logService.updateLog(logId, {
              status: 'SENT',
              sentAt: new Date(),
              responseTimeMs: responseTime,
              notes: `Reporte PDF de créditos con errores enviado exitosamente por cron (${filename}, ${(pdfBuffer.length / 1024).toFixed(2)} KB)`
            });
            return true;
          } else {
            await logService.updateLog(logId, {
              status: 'FAILED',
              sentAt: new Date(),
              responseTimeMs: responseTime,
              telegramResponse: JSON.stringify(result),
              notes: 'Error enviando PDF de créditos con errores por cron'
            });
            return false;
          }
        } else {
          console.error(`❌ [CRON] No se pudo generar el PDF o está vacío`);
          // Fallback: enviar mensaje de texto con más información
          const message = `📊 <b>REPORTE AUTOMÁTICO - CRÉDITOS CON ERRORES</b>\n\n📅 Generado: ${new Date().toLocaleString('es-ES')}\n⚠️ Error generando PDF\n\n🔧 Posibles causas:\n• Error en la consulta de datos\n• Problemas con la generación del PDF\n• Configuración incorrecta\n\n✅ Enviado automáticamente por el sistema de cron`;
          
          const sendStartTime = Date.now();
          const result = await telegramService.sendHtmlMessage(chatId, message);
          const responseTime = Date.now() - sendStartTime;
          
          if (result.ok) {
            await logService.updateLog(logId, {
              status: 'SENT',
              sentAt: new Date(),
              responseTimeMs: responseTime,
              notes: 'Reporte de créditos con errores (fallback texto) enviado por cron'
            });
            return true;
          } else {
            await logService.updateLog(logId, {
              status: 'FAILED',
              sentAt: new Date(),
              responseTimeMs: responseTime,
              telegramResponse: JSON.stringify(result),
              notes: 'Error enviando reporte de créditos con errores (fallback) por cron'
            });
            return false;
          }
        }
        
      } catch (pdfError) {
        console.error(`❌ [CRON] Error generando PDF usando función unificada:`, pdfError);
        
        // Fallback: enviar mensaje de texto
        const message = `📊 <b>REPORTE AUTOMÁTICO</b>\n\nTipo: ${reportType}\nGenerado: ${new Date().toLocaleString('es-ES')}\n\n⚠️ Error generando PDF, enviando mensaje de texto\n✅ Enviado automáticamente por el sistema de cron`;
        
        const sendStartTime = Date.now();
        const result = await telegramService.sendHtmlMessage(chatId, message);
        const responseTime = Date.now() - sendStartTime;
        
        if (result.ok) {
          await logService.updateLog(logId, {
            status: 'SENT',
            sentAt: new Date(),
            responseTimeMs: responseTime,
            notes: 'Reporte (fallback por error PDF) enviado por cron'
          });
          return true;
        } else {
          await logService.updateLog(logId, {
            status: 'FAILED',
            sentAt: new Date(),
            responseTimeMs: responseTime,
            telegramResponse: JSON.stringify(result),
            notes: 'Error enviando reporte (fallback por error PDF) por cron'
          });
          return false;
        }
      }
      
    } else {
      // Para otros tipos, usar mensaje de texto
      const message = `📊 <b>REPORTE AUTOMÁTICO</b>\n\nTipo: ${reportType}\nGenerado: ${new Date().toLocaleString('es-ES')}\n\n✅ Enviado automáticamente por el sistema de cron`;
      
      const sendStartTime = Date.now();
      const result = await telegramService.sendHtmlMessage(chatId, message);
      const responseTime = Date.now() - sendStartTime;
      
      if (result.ok) {
        await logService.updateLog(logId, {
          status: 'SENT',
          sentAt: new Date(),
          responseTimeMs: responseTime,
          notes: `Reporte de texto (${reportType}) enviado por cron`
        });
        return true;
      } else {
        await logService.updateLog(logId, {
          status: 'FAILED',
          sentAt: new Date(),
          responseTimeMs: responseTime,
          telegramResponse: JSON.stringify(result),
          notes: `Error enviando reporte de texto (${reportType}) por cron`
        });
        return false;
      }
    }
  } catch (error) {
    console.error('❌ [CRON] Error enviando reporte a Telegram:', error);
    if (logId) {
      await logService.updateLog(logId, {
        status: 'ERROR',
        telegramErrorMessage: error.message,
        responseTimeMs: Date.now() - startTime,
        notes: `Error general en cron: ${error.message}`
      });
    }
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
            reportConfig,
            recipient
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
