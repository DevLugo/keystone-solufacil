import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';
import { NotificationLogService } from './notificationLogService';

/**
 * Envía notificación de documento con problema (error o faltante) por Telegram
 */
export const sendDocumentIssueNotification = graphql.field({
    type: graphql.nonNull(graphql.String),
    args: {
      documentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
      issueType: graphql.arg({ type: graphql.nonNull(graphql.String) }), // 'ERROR' | 'MISSING'
      description: graphql.arg({ type: graphql.String }),
    },
    resolve: async (root, { documentId, issueType, description }, context: Context) => {
      const startTime = Date.now();
      const logService = new NotificationLogService(context);
      let logId: string | null = null;
      
      try {
        const prisma = (context.prisma as any);
        console.log('📨 [sendDocumentIssueNotification] llamada', { documentId, issueType });
        
        // Crear log inicial
        const initialLog = await logService.createLog({
          documentId,
          issueType: issueType as 'ERROR' | 'MISSING',
          status: 'ERROR', // Temporal, se actualizará
          description,
          notes: 'Iniciando proceso de notificación'
        });
        logId = initialLog.id;
        // 1) Cargar documento, loan relacionado, datos de persona y localidad, y líder de ruta
        const document = await prisma.documentPhoto.findUnique({
          where: { id: documentId },
          include: {
            personalData: {
              include: {
                addresses: { include: { location: true } }
              }
            },
            loan: {
              include: {
                lead: {
                  include: {
                    personalData: {
                      include: {
                        addresses: { include: { location: { include: { route: true } } } }
                      }
                    }
                  }
                },
                borrower: {
                  include: {
                    personalData: { include: { addresses: { include: { location: true } } } }
                  }
                }
              }
            }
          }
        });

        if (!document) {
          console.log('❌ [sendDocumentIssueNotification] documento no encontrado');
          await logService.updateLog(logId!, {
            status: 'ERROR',
            notes: 'Documento no encontrado'
          });
          return '❌ No se encontró el documento';
        }

        // Actualizar log con información del documento
        await logService.updateLog(logId!, {
          documentType: document.documentType,
          personalDataId: document.personalDataId,
          personName: document.personalData?.fullName,
          loanId: document.loanId
        });

        // 2) Determinar localidad (preferir la del titular; fallback a la del documento)
        const borrowerAddress = document.loan?.borrower?.personalData?.addresses?.[0];
        const documentAddress = document.personalData?.addresses?.[0];
        const localityName = (borrowerAddress?.location?.name) || (documentAddress?.location?.name) || 'Sin localidad';

        // 3) Calcular semana (inicio y fin) con base en createdAt del documento o signDate del crédito
        function getWeekStart(date: Date): Date {
          const d = new Date(date);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          d.setDate(diff);
          d.setHours(0, 0, 0, 0);
          return d;
        }
        function getWeekEnd(date: Date): Date {
          const start = getWeekStart(date);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          return end;
        }

        const baseDate = document.createdAt || document.loan?.signDate || new Date();
        const weekStart = getWeekStart(new Date(baseDate));
        const weekEnd = getWeekEnd(new Date(baseDate));

        // 4) Resolver líder de ruta y su usuario de plataforma
        // Resolver ROUTE_LEAD por la ruta del préstamo
        // Resolver por lead -> localidad -> ruta
        const leadRouteId = document.loan?.lead?.personalData?.addresses?.[0]?.location?.route?.id || null;
        const routeId = leadRouteId || document.loan?.snapshotRouteId || document.loan?.transactions?.[0]?.routeId || null;
        
        // DEBUG: Capturar información detallada de la ruta
        const debugInfo = {
          leadRouteId,
          snapshotRouteId: document.loan?.snapshotRouteId,
          transactionRouteId: document.loan?.transactions?.[0]?.routeId,
          finalRouteId: routeId,
          leadInfo: {
            hasLead: !!document.loan?.lead,
            leadId: document.loan?.lead?.id,
            leadName: document.loan?.lead?.personalData?.fullName,
            hasPersonalData: !!document.loan?.lead?.personalData,
            hasAddresses: !!document.loan?.lead?.personalData?.addresses,
            addressesLength: document.loan?.lead?.personalData?.addresses?.length || 0,
            hasLocation: !!document.loan?.lead?.personalData?.addresses?.[0]?.location,
            locationName: document.loan?.lead?.personalData?.addresses?.[0]?.location?.name,
            hasRoute: !!document.loan?.lead?.personalData?.addresses?.[0]?.location?.route,
            routeId: document.loan?.lead?.personalData?.addresses?.[0]?.location?.route?.id,
            routeName: document.loan?.lead?.personalData?.addresses?.[0]?.location?.route?.name
          }
        };
        
        console.log('🔍 [sendDocumentIssueNotification] DEBUG - Información de ruta:', debugInfo);
        
        if (!routeId) {
          console.log('⚠️ [sendDocumentIssueNotification] no se pudo determinar routeId del préstamo');
          await logService.updateLog(logId!, {
            status: 'NO_ROUTE',
            notes: `No se pudo determinar la ruta del préstamo. Debug: ${JSON.stringify(debugInfo)}`
          });
          return '❌ No se pudo determinar la ruta del préstamo';
        }

        // Actualizar log con información de ruta
        await logService.updateLog(logId!, {
          routeId,
          localityName
        });
        
        // DEBUG: Buscar todos los empleados de tipo ROUTE_LEAD para debug
        const allRouteLeads = await prisma.employee.findMany({
          where: { type: 'ROUTE_LEAD' },
          include: { 
            user: true,
            routes: true,
            personalData: true
          }
        });
        
        console.log('🔍 [sendDocumentIssueNotification] DEBUG - Todos los ROUTE_LEAD encontrados:', {
          total: allRouteLeads.length,
          routeLeads: allRouteLeads.map(rl => ({
            id: rl.id,
            name: rl.personalData?.fullName,
            userId: rl.userId,
            hasUser: !!rl.user,
            routes: rl.routes?.map(r => ({ id: r.id, name: r.name })) || []
          }))
        });
        
        // DEBUG: Buscar específicamente por la ruta
        const routeLeadsForRoute = await prisma.employee.findMany({
          where: { 
            type: 'ROUTE_LEAD',
            routes: { id: routeId }
          },
          include: { 
            user: true,
            routes: true,
            personalData: true
          }
        });
        
        console.log('🔍 [sendDocumentIssueNotification] DEBUG - ROUTE_LEAD para ruta específica:', {
          routeId,
          found: routeLeadsForRoute.length,
          routeLeads: routeLeadsForRoute.map(rl => ({
            id: rl.id,
            name: rl.personalData?.fullName,
            userId: rl.userId,
            hasUser: !!rl.user,
            routes: rl.routes?.map(r => ({ id: r.id, name: r.name })) || []
          }))
        });
        
        // Priorizar empleados que tienen usuario asignado
        const routeLeadWithUser = routeLeadsForRoute.find(rl => rl.userId);
        const routeLead = routeLeadWithUser || routeLeadsForRoute[0];
        
        if (!routeLead || !routeLead.userId) {
          console.log('❌ [sendDocumentIssueNotification] no se encontró ROUTE_LEAD para la ruta', { 
            routeId,
            debugInfo,
            allRouteLeadsCount: allRouteLeads.length,
            routeLeadsForRouteCount: routeLeadsForRoute.length
          });
          await logService.updateLog(logId!, {
            status: 'NO_LEADER',
            notes: `No se encontró líder de ruta para la ruta ${routeId}. Debug completo: ${JSON.stringify({
              routeId,
              allRouteLeads: allRouteLeads.map(rl => ({ id: rl.id, name: rl.personalData?.fullName, routes: rl.routes?.map(r => r.id) })),
              routeLeadsForRoute: routeLeadsForRoute.map(rl => ({ id: rl.id, name: rl.personalData?.fullName }))
            })}`
          });
          return '❌ No se encontró líder de ruta para la ruta del préstamo';
        }

        // Actualizar log con información del líder
        await logService.updateLog(logId!, {
          routeLeadId: routeLead.id,
          routeLeadName: routeLead.personalData?.fullName,
          routeLeadUserId: routeLead.userId
        });

        // 5) Buscar usuario de Telegram del líder
        const telegramUser = await prisma.telegramUser.findFirst({
          where: { platformUserId: routeLead.userId, isActive: true }
        });

        if (!telegramUser || !telegramUser.chatId) {
          console.log('⚠️ [sendDocumentIssueNotification] líder sin Telegram activo');
          await logService.updateLog(logId!, {
            status: 'NO_TELEGRAM',
            notes: `Líder ${routeLead.personalData?.fullName} no tiene Telegram configurado`
          });
          return '❌ El líder de ruta no tiene Telegram configurado';
        }

        // Validar configuración de Telegram
        const telegramValidation = await logService.validateTelegramConfig(routeLead.userId);
        if (!telegramValidation.isValid) {
          console.log('⚠️ [sendDocumentIssueNotification] configuración de Telegram inválida:', telegramValidation);
          await logService.updateLog(logId!, {
            status: 'NO_TELEGRAM',
            notes: `Configuración de Telegram inválida: ${telegramValidation.message}`
          });
          return `❌ Configuración de Telegram inválida: ${telegramValidation.message}`;
        }

        // Actualizar log con información de Telegram
        await logService.updateLog(logId!, {
          telegramUserId: telegramUser.id,
          telegramChatId: telegramUser.chatId,
          telegramUsername: telegramUser.username
        });

        // 6) Construir mensaje y adjunto
        const title = issueType === 'ERROR' ? '🔴 Documento con ERROR' : '🟠 Documento FALTANTE';
        const errorDesc = (description || document.errorDescription || '').trim();
        const docType = String(document.documentType).toUpperCase();
        const personName = document.personalData?.fullName || 'Sin nombre';
        const weekLabel = `${weekStart.toLocaleDateString('es-MX')} - ${weekEnd.toLocaleDateString('es-MX')}`;

        const caption = (
          `${title}\n\n` +
          `• Tipo: ${docType}\n` +
          `• Persona: ${personName}\n` +
          `• Localidad: ${localityName}\n` +
          `• Semana: ${weekLabel}\n` +
          (errorDesc ? `• Descripción: ${errorDesc}\n` : '') +
          `\nID Doc: ${document.id}`
        );

        const { TelegramService } = require('../admin/services/telegramService');
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          console.log('❌ [sendDocumentIssueNotification] TELEGRAM_BOT_TOKEN no configurado');
          await logService.updateLog(logId!, {
            status: 'ERROR',
            notes: 'TELEGRAM_BOT_TOKEN no configurado'
          });
          return '❌ TELEGRAM_BOT_TOKEN no configurado';
        }

        const service = new TelegramService({ botToken, chatId: telegramUser.chatId });

        console.log('📤 [sendDocumentIssueNotification] enviando', { chatId: telegramUser.chatId, length: caption.length });
        
        // Actualizar log con contenido del mensaje
        await logService.updateLog(logId!, {
          messageContent: caption
        });

        // Enviar mensaje con manejo de errores detallado
        let telegramResponse: any;
        let responseTime: number;
        
        try {
          const sendStartTime = Date.now();
          telegramResponse = await service.sendHtmlMessage(telegramUser.chatId, caption.replace(/\n/g, '\n'));
          responseTime = Date.now() - sendStartTime;
          
          console.log('✅ [sendDocumentIssueNotification] respuesta', telegramResponse);
          
          // Verificar si el envío fue exitoso
          const isSuccess = telegramResponse?.ok === true;
          
          await logService.updateLog(logId!, {
            status: isSuccess ? 'SENT' : 'FAILED',
            telegramResponse: JSON.stringify(telegramResponse),
            sentAt: new Date(),
            responseTimeMs: responseTime,
            notes: isSuccess ? 'Notificación enviada exitosamente' : 'Error en respuesta de Telegram'
          });
          
          if (isSuccess) {
            return '✅ Notificación enviada';
          } else {
            return `❌ Error enviando notificación: ${telegramResponse?.description || 'Error desconocido'}`;
          }
        } catch (telegramError) {
          console.error('❌ [sendDocumentIssueNotification] Error enviando a Telegram:', telegramError);
          
          await logService.updateLog(logId!, {
            status: 'FAILED',
            telegramResponse: JSON.stringify(telegramError),
            telegramErrorCode: telegramError?.response?.status || telegramError?.code,
            telegramErrorMessage: telegramError?.message || telegramError?.response?.data?.description,
            sentAt: new Date(),
            responseTimeMs: Date.now() - startTime,
            notes: `Error enviando a Telegram: ${telegramError.message}`
          });
          
          return `❌ Error enviando notificación: ${telegramError.message}`;
        }
      } catch (err) {
        console.error('❌ [sendDocumentIssueNotification] Error:', err);
        
        // Actualizar log con error general
        if (logId) {
          await logService.updateLog(logId, {
            status: 'ERROR',
            telegramResponse: JSON.stringify(err),
            telegramErrorMessage: err.message,
            responseTimeMs: Date.now() - startTime,
            notes: `Error general: ${err.message}`
          });
        }
        
        return '❌ Error enviando notificación';
      }
    }
});

