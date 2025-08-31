import { TelegramService, TelegramConfig } from './telegramService';
import { ReportGeneratorService, ReportData } from './reportGeneratorService';

export interface ReportSenderConfig {
  telegram: TelegramConfig;
  defaultFormat: 'text' | 'pdf';
}

export interface SendReportOptions {
  reportType: string;
  routes: string[];
  recipients: string[];
  channel: 'telegram' | 'email' | 'whatsapp';
  format?: 'text' | 'pdf';
  date?: Date;
  customMessage?: string;
}

export interface SendReportResult {
  success: boolean;
  sentTo: string[];
  failedTo: string[];
  reportContent?: string;
  reportFilename?: string;
  errors: string[];
}

export class ReportSenderService {
  private telegramService: TelegramService;
  private reportGenerator: ReportGeneratorService;
  private config: ReportSenderConfig;

  constructor(config: ReportSenderConfig) {
    this.config = config;
    this.telegramService = new TelegramService(config.telegram);
    this.reportGenerator = new ReportGeneratorService();
  }

  /**
   * Envía un reporte a todos los destinatarios especificados
   */
  async sendReport(options: SendReportOptions): Promise<SendReportResult> {
    const result: SendReportResult = {
      success: false,
      sentTo: [],
      failedTo: [],
      errors: [],
    };

    try {
      // 1. Generar el reporte
      const reportData: ReportData = {
        reportType: options.reportType,
        routes: options.routes,
        date: options.date || new Date(),
      };

      let reportResult;
      if (options.format === 'pdf') {
        reportResult = await this.reportGenerator.generatePdfReport(reportData);
      } else {
        reportResult = await this.reportGenerator.generateReport(reportData);
      }

      if (!reportResult.success) {
        result.errors.push(`Error generando reporte: ${reportResult.error}`);
        return result;
      }

      result.reportContent = reportResult.content;
      result.reportFilename = reportResult.filename;

      // 2. Enviar según el canal
      switch (options.channel) {
        case 'telegram':
          await this.sendToTelegram(options, reportResult, result);
          break;
        case 'email':
          // TODO: Implementar envío por email
          result.errors.push('Envío por email no implementado aún');
          break;
        case 'whatsapp':
          // TODO: Implementar envío por WhatsApp
          result.errors.push('Envío por WhatsApp no implementado aún');
          break;
        default:
          result.errors.push(`Canal no soportado: ${options.channel}`);
      }

      // 3. Determinar si fue exitoso
      result.success = result.sentTo.length > 0 && result.failedTo.length === 0;

    } catch (error) {
      result.errors.push(`Error general: ${error}`);
    }

    return result;
  }

  /**
   * Envía reporte por Telegram
   */
  private async sendToTelegram(
    options: SendReportOptions,
    reportResult: any,
    result: SendReportResult
  ): Promise<void> {
    try {
      // Enviar a cada destinatario
      for (const recipientId of options.recipients) {
        try {
          if (options.format === 'pdf' && reportResult.pdfBuffer) {
            // Enviar como PDF
            await this.telegramService.sendPdfFromBuffer(
              recipientId,
              reportResult.pdfBuffer,
              reportResult.filename || 'reporte.pdf',
              this.createTelegramCaption(options, reportResult)
            );
          } else {
            // Enviar como mensaje de texto
            const message = this.createTelegramMessage(options, reportResult);
            await this.telegramService.sendHtmlMessage(recipientId, message);
          }

          result.sentTo.push(recipientId);
        } catch (error) {
          result.failedTo.push(recipientId);
          result.errors.push(`Error enviando a ${recipientId}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Error en envío por Telegram: ${error}`);
    }
  }

  /**
   * Crea el mensaje para Telegram
   */
  private createTelegramMessage(options: SendReportOptions, reportResult: any): string {
    let message = '';

    if (options.customMessage) {
      message += `${options.customMessage}\n\n`;
    }

    if (reportResult.content) {
      message += reportResult.content;
    } else {
      message += `📊 Reporte: ${options.reportType}\n`;
      message += `📅 Fecha: ${new Date().toLocaleDateString('es-MX')}\n`;
      message += `🛣️ Rutas: ${options.routes.join(', ')}\n`;
      message += `📋 Formato: ${options.format || 'texto'}`;
    }

    return message;
  }

  /**
   * Crea el caption para archivos PDF
   */
  private createTelegramCaption(options: SendReportOptions, reportResult: any): string {
    let caption = '';

    if (options.customMessage) {
      caption += `${options.customMessage}\n\n`;
    }

    caption += `📊 Reporte: ${options.reportType}\n`;
    caption += `📅 Fecha: ${new Date().toLocaleDateString('es-MX')}\n`;
    caption += `🛣️ Rutas: ${options.routes.join(', ')}\n`;
    caption += `📋 Formato: PDF`;

    return caption;
  }

  /**
   * Envía un reporte de prueba para verificar la configuración
   */
  async sendTestReport(recipientId: string): Promise<boolean> {
    try {
      const testMessage = `
🧪 <b>Reporte de Prueba</b>

✅ Este es un mensaje de prueba para verificar la configuración del bot de Telegram.

📅 Fecha: ${new Date().toLocaleDateString('es-MX')}
🕐 Hora: ${new Date().toLocaleTimeString('es-MX')}
🤖 Bot: Configuración de Reportes Automáticos

Si recibes este mensaje, la configuración está funcionando correctamente.
      `;

      await this.telegramService.sendHtmlMessage(recipientId, testMessage);
      return true;
    } catch (error) {
      console.error('Error sending test report:', error);
      return false;
    }
  }

  /**
   * Verifica la configuración de Telegram
   */
  async testTelegramConnection(): Promise<boolean> {
    try {
      const botInfo = await this.telegramService.getMe();
      return botInfo.ok;
    } catch (error) {
      console.error('Error testing Telegram connection:', error);
      return false;
    }
  }

  /**
   * Obtiene información del bot
   */
  async getBotInfo(): Promise<any> {
    try {
      return await this.telegramService.getMe();
    } catch (error) {
      console.error('Error getting bot info:', error);
      throw error;
    }
  }
}

/**
 * Función helper para crear una instancia del servicio con configuración por defecto
 */
export function createReportSenderService(
  botToken: string,
  defaultChatId: string,
  defaultFormat: 'text' | 'pdf' = 'text'
): ReportSenderService {
  const config: ReportSenderConfig = {
    telegram: {
      botToken,
      chatId: defaultChatId,
    },
    defaultFormat,
  };

  return new ReportSenderService(config);
}
