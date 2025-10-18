import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';

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
      try {
        const prisma = (context.prisma as any);
        console.log('📨 [sendDocumentIssueNotification] llamada', { documentId, issueType });
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
          return '❌ No se encontró el documento';
        }

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
        if (!routeId) {
          console.log('⚠️ [sendDocumentIssueNotification] no se pudo determinar routeId del préstamo');
          return '❌ No se pudo determinar la ruta del préstamo';
        }
        const routeLead = await prisma.employee.findFirst({
          where: { type: 'ROUTE_LEAD', routes: { id: routeId } },
          include: { user: true }
        });
        if (!routeLead || !routeLead.userId) {
          console.log('❌ [sendDocumentIssueNotification] no se encontró ROUTE_LEAD para la ruta', { routeId });
          return '❌ No se encontró líder de ruta para la ruta del préstamo';
        }

        // 5) Buscar usuario de Telegram del líder
        const telegramUser = await prisma.telegramUser.findFirst({
          where: { platformUserId: routeLead.userId, isActive: true }
        });

        if (!telegramUser || !telegramUser.chatId) {
          console.log('⚠️ [sendDocumentIssueNotification] líder sin Telegram activo');
          return '❌ El líder de ruta no tiene Telegram configurado';
        }

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
          return '❌ TELEGRAM_BOT_TOKEN no configurado';
        }

        const service = new TelegramService({ botToken, chatId: telegramUser.chatId });

        console.log('📤 [sendDocumentIssueNotification] enviando', { chatId: telegramUser.chatId, length: caption.length });
        // Enviar SIEMPRE como mensaje (sin adjuntar foto por URL)
        const resp = await service.sendHtmlMessage(telegramUser.chatId, caption.replace(/\n/g, '\n'));
        console.log('✅ [sendDocumentIssueNotification] respuesta', resp);
        return '✅ Notificación enviada';
      } catch (err) {
        console.error('❌ [sendDocumentIssueNotification] Error:', err);
        return '❌ Error enviando notificación';
      }
    }
});

