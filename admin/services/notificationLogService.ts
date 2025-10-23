import { Context } from '.keystone/types';

export interface NotificationLogData {
  documentId: string;
  documentType?: string;
  personalDataId?: string;
  personName?: string;
  loanId?: string;
  routeId?: string;
  routeName?: string;
  localityName?: string;
  routeLeadId?: string;
  routeLeadName?: string;
  routeLeadUserId?: string;
  telegramUserId?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  issueType: 'ERROR' | 'MISSING' | 'REPORT'; // Agregado REPORT para reportes automáticos
  description?: string;
  messageContent?: string;
  status: 'SENT' | 'ERROR' | 'FAILED' | 'NO_TELEGRAM' | 'NO_LEADER' | 'NO_ROUTE';
  telegramResponse?: string;
  telegramErrorCode?: number;
  telegramErrorMessage?: string;
  sentAt?: Date;
  responseTimeMs?: number;
  retryCount?: number;
  lastRetryAt?: Date;
  notes?: string;
  // Campos específicos para reportes automáticos
  reportType?: string;
  reportConfigId?: string;
  reportConfigName?: string;
  recipientUserId?: string;
  recipientName?: string;
  recipientEmail?: string;
}

export class NotificationLogService {
  private context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  /**
   * Crea un log de notificación
   */
  async createLog(logData: NotificationLogData) {
    try {
      const prisma = (this.context.prisma as any);
      
      console.log('📝 [NotificationLogService] Creando log de notificación:', {
        documentId: logData.documentId,
        status: logData.status,
        telegramChatId: logData.telegramChatId
      });

      const log = await prisma.documentNotificationLog.create({
        data: {
          documentId: logData.documentId,
          documentType: logData.documentType,
          personalDataId: logData.personalDataId,
          personName: logData.personName,
          loanId: logData.loanId,
          routeId: logData.routeId,
          routeName: logData.routeName,
          localityName: logData.localityName,
          routeLeadId: logData.routeLeadId,
          routeLeadName: logData.routeLeadName,
          routeLeadUserId: logData.routeLeadUserId,
          telegramUserId: logData.telegramUserId,
          telegramChatId: logData.telegramChatId,
          telegramUsername: logData.telegramUsername,
          issueType: logData.issueType,
          description: logData.description,
          messageContent: logData.messageContent,
          status: logData.status,
          telegramResponse: logData.telegramResponse,
          telegramErrorCode: logData.telegramErrorCode,
          telegramErrorMessage: logData.telegramErrorMessage,
          sentAt: logData.sentAt,
          responseTimeMs: logData.responseTimeMs,
          retryCount: logData.retryCount || 0,
          lastRetryAt: logData.lastRetryAt,
          notes: logData.notes
        }
      });

      console.log('✅ [NotificationLogService] Log creado exitosamente:', log.id);
      return log;
    } catch (error) {
      console.error('❌ [NotificationLogService] Error creando log:', error);
      throw error;
    }
  }

  /**
   * Actualiza un log existente
   */
  async updateLog(logId: string | null, updateData: Partial<NotificationLogData>) {
    if (!logId) {
      console.warn('⚠️ [NotificationLogService] Intentando actualizar log con ID nulo, saltando actualización');
      return null;
    }
    
    try {
      const prisma = (this.context.prisma as any);
      
      console.log('📝 [NotificationLogService] Actualizando log:', logId, updateData);

      const log = await prisma.documentNotificationLog.update({
        where: { id: logId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      console.log('✅ [NotificationLogService] Log actualizado exitosamente');
      return log;
    } catch (error) {
      console.error('❌ [NotificationLogService] Error actualizando log:', error);
      throw error;
    }
  }

  /**
   * Busca logs por documento
   */
  async getLogsByDocument(documentId: string) {
    try {
      const prisma = (this.context.prisma as any);
      
      const logs = await prisma.documentNotificationLog.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' }
      });

      return logs;
    } catch (error) {
      console.error('❌ [NotificationLogService] Error obteniendo logs:', error);
      throw error;
    }
  }

  /**
   * Busca logs por chat ID de Telegram
   */
  async getLogsByTelegramChatId(chatId: string) {
    try {
      const prisma = (this.context.prisma as any);
      
      const logs = await prisma.documentNotificationLog.findMany({
        where: { telegramChatId: chatId },
        orderBy: { createdAt: 'desc' }
      });

      return logs;
    } catch (error) {
      console.error('❌ [NotificationLogService] Error obteniendo logs por chat ID:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de notificaciones
   */
  async getNotificationStats(days: number = 7) {
    try {
      const prisma = (this.context.prisma as any);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await prisma.documentNotificationLog.groupBy({
        by: ['status'],
        where: {
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          status: true
        }
      });

      const total = await prisma.documentNotificationLog.count({
        where: {
          createdAt: {
            gte: startDate
          }
        }
      });

      return {
        total,
        byStatus: stats,
        period: `${days} días`
      };
    } catch (error) {
      console.error('❌ [NotificationLogService] Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  /**
   * Valida la configuración de Telegram para un usuario
   */
  async validateTelegramConfig(userId: string) {
    try {
      const prisma = (this.context.prisma as any);
      
      // Buscar usuario de Telegram
      const telegramUser = await prisma.telegramUser.findFirst({
        where: { 
          platformUserId: userId,
          isActive: true 
        }
      });

      if (!telegramUser) {
        return {
          isValid: false,
          reason: 'NO_TELEGRAM_USER',
          message: 'Usuario no tiene Telegram configurado'
        };
      }

      if (!telegramUser.chatId) {
        return {
          isValid: false,
          reason: 'NO_CHAT_ID',
          message: 'Usuario de Telegram no tiene Chat ID'
        };
      }

      // Validar formato del chat ID
      const chatIdPattern = /^-?\d+$/;
      if (!chatIdPattern.test(telegramUser.chatId)) {
        return {
          isValid: false,
          reason: 'INVALID_CHAT_ID',
          message: `Chat ID inválido: ${telegramUser.chatId}`
        };
      }

      return {
        isValid: true,
        telegramUser: {
          id: telegramUser.id,
          chatId: telegramUser.chatId,
          username: telegramUser.username,
          name: telegramUser.name
        }
      };
    } catch (error) {
      console.error('❌ [NotificationLogService] Error validando configuración de Telegram:', error);
      return {
        isValid: false,
        reason: 'VALIDATION_ERROR',
        message: `Error validando configuración: ${error.message}`
      };
    }
  }

  /**
   * Obtiene logs de errores recientes
   */
  async getRecentErrors(hours: number = 24) {
    try {
      const prisma = (this.context.prisma as any);
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const errorLogs = await prisma.documentNotificationLog.findMany({
        where: {
          status: {
            in: ['ERROR', 'FAILED', 'NO_TELEGRAM', 'NO_LEADER', 'NO_ROUTE']
          },
          createdAt: {
            gte: startDate
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      return errorLogs;
    } catch (error) {
      console.error('❌ [NotificationLogService] Error obteniendo logs de errores:', error);
      throw error;
    }
  }

  /**
   * Crea un log para reporte automático
   */
  async createReportLog(logData: {
    reportType: string;
    reportConfigId: string;
    reportConfigName: string;
    recipientUserId: string;
    recipientName: string;
    recipientEmail: string;
    telegramChatId: string;
    telegramUsername?: string;
    messageContent: string;
    status: 'SENT' | 'ERROR' | 'FAILED' | 'NO_TELEGRAM';
    telegramResponse?: string;
    telegramErrorCode?: number;
    telegramErrorMessage?: string;
    sentAt?: Date;
    responseTimeMs?: number;
    notes?: string;
  }) {
    try {
      const prisma = (this.context.prisma as any);
      
      console.log('📝 [NotificationLogService] Creando log de reporte automático:', {
        reportType: logData.reportType,
        reportConfigName: logData.reportConfigName,
        recipientName: logData.recipientName,
        status: logData.status
      });

      const log = await prisma.documentNotificationLog.create({
        data: {
          documentId: `report-${logData.reportConfigId}-${Date.now()}`, // ID único para reportes
          documentType: 'REPORTE_AUTOMATICO',
          issueType: 'REPORT',
          description: `Reporte automático: ${logData.reportType}`,
          messageContent: logData.messageContent,
          status: logData.status,
          telegramChatId: logData.telegramChatId,
          telegramUsername: logData.telegramUsername,
          telegramResponse: logData.telegramResponse,
          telegramErrorCode: logData.telegramErrorCode,
          telegramErrorMessage: logData.telegramErrorMessage,
          sentAt: logData.sentAt,
          responseTimeMs: logData.responseTimeMs,
          retryCount: 0,
          notes: logData.notes,
          // Campos específicos para reportes - NO usar foreign keys
          personName: logData.recipientName,
          routeName: logData.reportConfigName,
          localityName: logData.reportType,
          // NO incluir campos con foreign keys que no son necesarios para reportes
          // personalDataId: null, // No necesario para reportes
          // loanId: null, // No necesario para reportes
          // routeId: null, // No necesario para reportes
          // routeLeadId: null, // No necesario para reportes
          // routeLeadUserId: null, // No necesario para reportes
          // telegramUserId: null // No necesario para reportes
        }
      });

      console.log('✅ [NotificationLogService] Log de reporte creado exitosamente:', log.id);
      return log;
    } catch (error) {
      console.error('❌ [NotificationLogService] Error creando log de reporte:', error);
      throw error;
    }
  }

  /**
   * Obtiene logs de reportes automáticos
   */
  async getReportLogs(reportConfigId?: string, days: number = 30) {
    try {
      const prisma = (this.context.prisma as any);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const whereClause: any = {
        issueType: 'REPORT',
        createdAt: {
          gte: startDate
        }
      };

      if (reportConfigId) {
        whereClause.routeId = reportConfigId;
      }

      const logs = await prisma.documentNotificationLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      return logs;
    } catch (error) {
      console.error('❌ [NotificationLogService] Error obteniendo logs de reportes:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de reportes automáticos
   */
  async getReportStats(days: number = 7) {
    try {
      const prisma = (this.context.prisma as any);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await prisma.documentNotificationLog.groupBy({
        by: ['status', 'localityName'], // localityName contiene el reportType
        where: {
          issueType: 'REPORT',
          createdAt: {
            gte: startDate
          }
        },
        _count: {
          status: true
        }
      });

      const total = await prisma.documentNotificationLog.count({
        where: {
          issueType: 'REPORT',
          createdAt: {
            gte: startDate
          }
        }
      });

      return {
        total,
        byStatus: stats,
        period: `${days} días`
      };
    } catch (error) {
      console.error('❌ [NotificationLogService] Error obteniendo estadísticas de reportes:', error);
      throw error;
    }
  }
}
