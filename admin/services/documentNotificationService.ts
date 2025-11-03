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
      
      // 🔍 Verificar configuración de notificaciones
      const reportConfigs = await (context.prisma as any).reportConfig.findMany({
        where: { 
          reportType: 'notificacion_tiempo_real',
          isActive: true
        },
        include: {
          telegramUsers: {
            where: { isActive: true }
          }
        }
      });
      
      if (reportConfigs.length === 0) {
        console.log('⚠️ [sendDocumentIssueNotification] No hay configuraciones de notificación en tiempo real activas');
        return '⚠️ No hay configuraciones de notificación en tiempo real activas';
      }
      
      const logService = new NotificationLogService(context);
      let logId: string | undefined = undefined;
      
      try {
        const prisma = (context.prisma as any);
        console.log('📨 [sendDocumentIssueNotification] llamada', { documentId, issueType });
        
        // Crear log inicial
        const initialLog = await logService.createLog({
          documentId,
          issueType: issueType as 'ERROR' | 'MISSING',
          status: 'ERROR', // Temporal, se actualizará
          description: description || undefined,
          notes: 'Iniciando proceso de notificación'
        });
        logId = initialLog.id || undefined;
        // 1) Cargar documento, loan relacionado, datos de persona y localidad, y líder de ruta
        // Obtener el documento con toda la información necesaria
        const document = await (context.prisma as any).documentPhoto.findUnique({
          where: { id: documentId },
          include: {
            personalData: true,
            loan: {
              include: {
                borrower: {
                  include: {
                    personalData: true
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
                    },
                    routes: true
                  }
                }
              }
            }
          }
        });

        // Validar y procesar la información del documento
        const processedDocument = {
          // Información básica del documento
          id: document?.id,
          title: document?.title || '',
          description: document?.description || '',
          photoUrl: document?.photoUrl || '',
          documentType: document?.documentType || '',
          isError: !!document?.isError,
          errorDescription: document?.errorDescription || '',
          isMissing: !!document?.isMissing,
          
          // Información de la persona
          personalData: {
            id: document?.personalData?.id || '',
            fullName: document?.personalData?.fullName || 'Sin nombre'
          },
          
          // Información del préstamo
          loan: {
            id: document?.loan?.id || '',
            signDate: document?.loan?.signDate ? new Date(document?.loan?.signDate).toLocaleDateString('es-MX') : 'Sin fecha',
            borrower: {
              id: document?.loan?.borrower?.id || '',
              fullName: document?.loan?.borrower?.personalData?.fullName || 'Sin nombre'
            },
            lead: {
              id: document?.loan?.lead?.id || '',
              fullName: document?.loan?.lead?.personalData?.fullName || 'Sin nombre',
              // Manejar rutas de forma segura
              routes: Array.isArray(document?.loan?.lead?.routes) 
                ? document.loan.lead.routes.map(r => ({ id: String(r.id), name: String(r.name) }))
                : []
            }
          }
        };

        // Log de la información procesada
        console.log('📄 Documento procesado:', processedDocument);

        // Log específico para la foto
        console.log('📸 Información de la foto:', {
          hasPhoto: !!document?.photoUrl,
          photoUrl: document?.photoUrl,
          isUrl: document?.photoUrl?.startsWith('http'),
          urlLength: document?.photoUrl?.length
        });

        console.log('📄 Documento encontrado:', {
          id: document?.id,
          title: document?.title,
          hasPhoto: !!document?.photoUrl,
          photoUrl: document?.photoUrl,
          documentType: document?.documentType,
          isError: document?.isError,
          isMissing: document?.isMissing
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

        // 4) Obtener usuarios de Telegram configurados para notificaciones en tiempo real
        console.log('🔍 [sendDocumentIssueNotification] Buscando usuarios de Telegram configurados...');
        
        // Buscar configuraciones de reporte activas de tipo "notificacion_tiempo_real"
        const reportConfigs = await (context.prisma as any).reportConfig.findMany({
          where: { 
            reportType: 'notificacion_tiempo_real',
            isActive: true
          },
          include: {
            telegramUsers: {
              where: { isActive: true }
            }
          }
        });
        
        console.log('📋 [sendDocumentIssueNotification] Configuraciones de notificación en tiempo real encontradas:', {
          total: reportConfigs.length,
          configs: reportConfigs.map((config: any) => ({
            id: config.id,
            name: config.name,
            telegramUsersCount: config.telegramUsers.length,
            telegramUsers: config.telegramUsers.map((user: any) => ({
              id: user.id,
              name: user.name,
              chatId: user.chatId,
              username: user.username
            }))
          }))
        });
        
        if (reportConfigs.length === 0) {
          console.log('⚠️ [sendDocumentIssueNotification] No hay configuraciones de notificación en tiempo real activas');
          await logService.updateLog(logId!, {
            status: 'FAILED',
            notes: 'No hay configuraciones de notificación en tiempo real activas'
          });
          return '⚠️ No hay configuraciones de notificación en tiempo real activas';
        }
        
        // Recopilar todos los usuarios de Telegram únicos
        const allTelegramUsers = new Map();
        reportConfigs.forEach((config: any) => {
          config.telegramUsers.forEach((user: any) => {
            if (user.chatId && user.isActive) {
              allTelegramUsers.set(user.id, user);
            }
          });
        });
        
        const telegramUsers = Array.from(allTelegramUsers.values());
        
        if (telegramUsers.length === 0) {
          console.log('⚠️ [sendDocumentIssueNotification] No hay usuarios de Telegram activos en las configuraciones');
          await logService.updateLog(logId!, {
            status: 'NO_TELEGRAM',
            notes: 'No hay usuarios de Telegram activos en las configuraciones'
          });
          return '❌ No hay usuarios de Telegram activos en las configuraciones';
        }
        
        console.log('📱 [sendDocumentIssueNotification] Usuarios de Telegram a notificar:', {
          total: telegramUsers.length,
          users: telegramUsers.map(user => ({
            id: user.id,
            name: user.name,
            chatId: user.chatId,
            username: user.username
          }))
        });
        
        // Actualizar log con información de usuarios
        await logService.updateLog(logId!, {
          notes: `Notificando a ${telegramUsers.length} usuarios de Telegram configurados`
        });

        // 6) Construir mensaje y adjunto
        // 6) Generar mensaje usando plantilla de configuración
        const errorDesc = (description || document.errorDescription || '').trim();
        const docType = String(document.documentType).toUpperCase();
        const personName = document.personalData?.fullName || 'Sin nombre';
        const personType = document.personalData?.id === document.loan?.borrower?.personalData?.id ? 'TITULAR' : 'AVAL';
        const weekLabel = `${weekStart.toLocaleDateString('es-MX')} - ${weekEnd.toLocaleDateString('es-MX')}`;
        const currentDate = new Date().toLocaleString('es-MX');
        const borrowerName = document.loan?.borrower?.personalData?.fullName || 'Sin nombre';
        const signDate = document.loan?.signDate ? new Date(document.loan.signDate).toLocaleDateString('es-MX') : 'No disponible';
        
        // Usar plantilla de mensaje
        let messageTemplate = '';
        if (issueType === 'ERROR') {
          messageTemplate = '🚨 <b>DOCUMENTO CON ERROR</b>\n\n📋 Tipo: {documentType} de {personType}\n💰 Crédito de: {borrowerName}\n📅 Fecha de firma: {signDate}\n👤 Persona: {personName}\n🏠 Localidad: {localityName}\n🛣️ Ruta: {routeName}\n👨‍💼 Líder: {routeLeadName}\n\n❌ <b>Descripción del Error:</b>\n{errorDescription}\n\n📅 Fecha: {date}\n\n🔗 <a href="{documentUrl}">Ver Documento</a>';
        } else {
          messageTemplate = '📋 <b>DOCUMENTO FALTANTE</b>\n\n📋 Tipo: {documentType} de {personType}\n💰 Crédito de: {borrowerName}\n📅 Fecha de firma: {signDate}\n👤 Persona: {personName}\n🏠 Localidad: {localityName}\n🛣️ Ruta: {routeName}\n👨‍💼 Líder: {routeLeadName}\n\n📅 Fecha: {date}\n\n🔗 <a href="{loanUrl}">Ver Préstamo</a>';
        }
        
        // Obtener información adicional del documento
        const documentLocalityName = document.loan?.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
        // Obtener nombre de la ruta (puede ser array u objeto directo)
        let routeName = 'Sin ruta';
        const routes = document.loan?.lead?.routes;
        if (routes) {
          if (Array.isArray(routes) && routes.length > 0) {
            routeName = routes[0].name;
          } else if (typeof routes === 'object' && 'name' in routes) {
            routeName = routes.name;
          }
        }
        const routeLeadName = document.loan?.lead?.personalData?.fullName || 'Sin líder';
        
        // Reemplazar variables en la plantilla
        const caption = messageTemplate
          .replace(/{documentType}/g, docType)
          .replace(/{personName}/g, personName)
          .replace(/{personType}/g, personType)
          .replace(/{borrowerName}/g, borrowerName)
          .replace(/{signDate}/g, signDate)
          .replace(/{localityName}/g, documentLocalityName)
          .replace(/{routeName}/g, routeName)
          .replace(/{routeLeadName}/g, routeLeadName)
          .replace(/{errorDescription}/g, errorDesc)
          .replace(/{date}/g, currentDate)
          .replace(/{documentUrl}/g, `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/documentos-personales`)
          .replace(/{loanUrl}/g, `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/documentos-personales`);

        const { TelegramService } = require('./telegramService');
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          console.log('❌ [sendDocumentIssueNotification] TELEGRAM_BOT_TOKEN no configurado');
          await logService.updateLog(logId!, {
            status: 'ERROR',
            notes: 'TELEGRAM_BOT_TOKEN no configurado'
          });
          return '❌ TELEGRAM_BOT_TOKEN no configurado';
        }

        console.log('📤 [sendDocumentIssueNotification] enviando a usuarios configurados', { 
          totalUsers: telegramUsers.length, 
          length: caption.length 
        });
        
        // Actualizar log con contenido del mensaje
        await logService.updateLog(logId!, {
          messageContent: caption
        });

        // Enviar mensaje a todos los usuarios configurados
        let successCount = 0;
        let errorCount = 0;
        const results = [];
        
        for (const telegramUser of telegramUsers) {
          try {
            const service = new TelegramService({ botToken, chatId: telegramUser.chatId });
            const sendStartTime = Date.now();
            
            let telegramResponse;
            
            console.log('📸 Verificando foto del documento:', {
              issueType,
              hasPhoto: !!document.photoUrl,
              photoUrl: document.photoUrl
            });

            // Si es un error y tiene URL de foto, enviar la foto con el mensaje como caption
            if (issueType === 'ERROR' && processedDocument.photoUrl) {
              // Construir la URL completa de la foto
              const photoUrl = processedDocument.photoUrl.startsWith('http') 
                ? processedDocument.photoUrl 
                : `${process.env.CLOUDINARY_URL || 'https://res.cloudinary.com/solufacil/image/upload/'}${processedDocument.photoUrl}`;

              console.log('📤 Enviando foto con mensaje:', {
                chatId: telegramUser.chatId,
                originalUrl: processedDocument.photoUrl,
                fullPhotoUrl: photoUrl,
                hasPhoto: !!processedDocument.photoUrl,
                urlLength: processedDocument.photoUrl.length
              });

              try {
                // Intentar enviar la foto
                telegramResponse = await service.sendPhoto({
                  chat_id: telegramUser.chatId,
                  photo: photoUrl,
                  caption: caption.replace(/\n/g, '\n'),
                  parse_mode: 'HTML'
                });

                console.log('✅ Respuesta del envío de foto:', {
                  ok: telegramResponse?.ok,
                  messageId: telegramResponse?.result?.message_id,
                  error: telegramResponse?.description
                });
              } catch (photoError: any) {
                console.error('❌ Error enviando foto:', {
                  error: photoError?.message,
                  response: photoError?.response?.data,
                  status: photoError?.response?.status
                });
                
                // Si falla el envío de la foto, intentar enviar solo el mensaje
                telegramResponse = await service.sendHtmlMessage(
                  telegramUser.chatId, 
                  `${caption.replace(/\n/g, '\n')}\n\n❌ No se pudo enviar la foto: ${photoError.message}\nURL: ${photoUrl}`
                );
              }
            } else {
              // Si no hay foto o es un documento faltante, enviar solo el mensaje
              console.log('📝 Enviando solo mensaje (sin foto)');
              telegramResponse = await service.sendHtmlMessage(telegramUser.chatId, caption.replace(/\n/g, '\n'));
            }
            
            const responseTime = Date.now() - sendStartTime;
            
            console.log(`✅ [sendDocumentIssueNotification] respuesta para ${telegramUser.name}:`, telegramResponse);
            
            // Verificar si el envío fue exitoso
            const isSuccess = telegramResponse?.ok === true;
            
            if (isSuccess) {
              successCount++;
              results.push(`✅ ${telegramUser.name}: Enviado`);
            } else {
              errorCount++;
              results.push(`❌ ${telegramUser.name}: ${telegramResponse?.description || 'Error desconocido'}`);
            }
          } catch (telegramError: any) {
            console.error(`❌ [sendDocumentIssueNotification] Error enviando a ${telegramUser.name}:`, telegramError);
            errorCount++;
            results.push(`❌ ${telegramUser.name}: ${telegramError.message}`);
          }
        }
        
        // Actualizar log con resultados
        await logService.updateLog(logId!, {
          status: successCount > 0 ? 'SENT' : 'FAILED',
          telegramResponse: JSON.stringify(results),
          sentAt: new Date(),
          responseTimeMs: Date.now() - startTime,
          notes: `Enviado a ${successCount}/${telegramUsers.length} usuarios. Resultados: ${results.join(', ')}`
        });
        
        if (successCount > 0) {
          return `✅ Notificación enviada a ${successCount}/${telegramUsers.length} usuarios: ${results.join(', ')}`;
        } else {
          return `❌ Error enviando notificación a todos los usuarios: ${results.join(', ')}`;
        }
      } catch (err: any) {
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

