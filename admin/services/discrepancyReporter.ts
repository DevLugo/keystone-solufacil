import { TelegramService, TelegramConfig } from './telegramService';

export interface TransactionDiscrepancy {
  id: string;
  discrepancyType: 'PAYMENT' | 'CREDIT' | 'EXPENSE';
  date: Date | string;
  expectedAmount: number | string;
  actualAmount: number | string;
  difference: number | string;
  description: string;
  category?: string;
  status: 'PENDING' | 'COMPLETED' | 'DISCARDED';
  screenshotUrls?: string[];
  route?: {
    id: string;
    name?: string;
  };
  lead?: {
    id: string;
    personalData?: {
      fullName?: string;
    };
  };
}

export interface DiscrepancyReportOptions {
  chatIds: string[];
  includeScreenshots?: boolean;
  customMessage?: string;
}

export class DiscrepancyReporter {
  private telegramService: TelegramService;

  constructor(config: TelegramConfig) {
    this.telegramService = new TelegramService(config);
  }

  /**
   * Reporta una diferencia por Telegram
   */
  async reportDiscrepancy(
    discrepancy: TransactionDiscrepancy,
    options: DiscrepancyReportOptions
  ): Promise<boolean> {
    try {
      const message = this.buildReportMessage(discrepancy, options.customMessage);

      // Enviar mensaje a cada destinatario
      for (const chatId of options.chatIds) {
        try {
          // Enviar mensaje HTML
          await this.telegramService.sendHtmlMessage(chatId, message);

          // Enviar screenshots si existen y están habilitados
          if (
            options.includeScreenshots &&
            discrepancy.screenshotUrls &&
            discrepancy.screenshotUrls.length > 0
          ) {
            for (const screenshotUrl of discrepancy.screenshotUrls) {
              try {
                await this.telegramService.sendPhoto({
                  chat_id: chatId,
                  photo: screenshotUrl,
                  caption: `📸 Captura del sistema - ${discrepancy.description}`,
                  parse_mode: 'HTML',
                });
              } catch (photoError) {
                console.error(
                  `Error enviando screenshot ${screenshotUrl} a ${chatId}:`,
                  photoError
                );
                // Continuar con el siguiente screenshot
              }
            }
          }

          console.log(`✅ Diferencia reportada exitosamente a chatId: ${chatId}`);
        } catch (error) {
          console.error(`❌ Error reportando diferencia a chatId ${chatId}:`, error);
          // Continuar con el siguiente destinatario
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error general al reportar diferencia:', error);
      throw error;
    }
  }

  /**
   * Construye el mensaje HTML para el reporte
   */
  private buildReportMessage(
    discrepancy: TransactionDiscrepancy,
    customMessage?: string
  ): string {
    const typeTranslations = {
      PAYMENT: 'Abono',
      CREDIT: 'Crédito',
      EXPENSE: 'Gasto',
    };

    const expectedAmount = this.parseAmount(discrepancy.expectedAmount);
    const actualAmount = this.parseAmount(discrepancy.actualAmount);
    const difference = this.parseAmount(discrepancy.difference);

    const routeName = discrepancy.route?.name || 'N/A';
    const leadName = discrepancy.lead?.personalData?.fullName || 'N/A';
    const typeLabel = typeTranslations[discrepancy.discrepancyType] || discrepancy.discrepancyType;

    const formattedDate = this.formatDate(discrepancy.date);

    let message = `🚨 <b>DIFERENCIA DETECTADA</b>\n\n`;

    if (customMessage) {
      message += `📝 ${customMessage}\n\n`;
    }

    message += `📅 <b>Fecha:</b> ${formattedDate}\n`;
    message += `🛣️ <b>Ruta:</b> ${routeName}\n`;
    message += `📍 <b>Localidad:</b> ${leadName}\n\n`;

    message += `📊 <b>Tipo:</b> ${typeLabel}\n`;
    message += `💰 <b>Monto Esperado:</b> $${expectedAmount.toFixed(2)}\n`;
    message += `💵 <b>Monto Capturado:</b> $${actualAmount.toFixed(2)}\n`;
    message += `⚠️ <b>Diferencia:</b> ${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}\n\n`;

    message += `📝 <b>Descripción:</b>\n${discrepancy.description}\n\n`;

    if (discrepancy.category) {
      message += `🏷️ <b>Categoría:</b> ${discrepancy.category}\n\n`;
    }

    message += `🔍 <i>Esta diferencia requiere revisión y resolución.</i>`;

    return message;
  }

  /**
   * Envía un resumen de diferencias pendientes
   */
  async sendDiscrepanciesSummary(
    discrepancies: TransactionDiscrepancy[],
    chatIds: string[],
    period: string = 'Semana actual'
  ): Promise<boolean> {
    try {
      const pendingDiscrepancies = discrepancies.filter((d) => d.status === 'PENDING');

      if (pendingDiscrepancies.length === 0) {
        return true; // No hay diferencias pendientes, no enviar nada
      }

      const message = this.buildSummaryMessage(pendingDiscrepancies, period);

      for (const chatId of chatIds) {
        try {
          await this.telegramService.sendHtmlMessage(chatId, message);
          console.log(`✅ Resumen enviado exitosamente a chatId: ${chatId}`);
        } catch (error) {
          console.error(`❌ Error enviando resumen a chatId ${chatId}:`, error);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error enviando resumen de diferencias:', error);
      throw error;
    }
  }

  /**
   * Construye mensaje de resumen
   */
  private buildSummaryMessage(
    discrepancies: TransactionDiscrepancy[],
    period: string
  ): string {
    const totalDifference = discrepancies.reduce((sum, d) => {
      return sum + this.parseAmount(d.difference);
    }, 0);

    const byType = discrepancies.reduce(
      (acc, d) => {
        const type = d.discrepancyType;
        if (!acc[type]) {
          acc[type] = { count: 0, total: 0 };
        }
        acc[type].count++;
        acc[type].total += this.parseAmount(d.difference);
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    let message = `📊 <b>RESUMEN DE DIFERENCIAS</b>\n`;
    message += `🗓️ <b>Período:</b> ${period}\n\n`;

    message += `⚠️ <b>Total de Diferencias:</b> ${discrepancies.length}\n`;
    message += `💰 <b>Monto Total:</b> ${totalDifference >= 0 ? '+' : ''}$${Math.abs(totalDifference).toFixed(2)}\n\n`;

    message += `📋 <b>Por Tipo:</b>\n`;
    for (const [type, data] of Object.entries(byType)) {
      const typeLabel = type === 'PAYMENT' ? 'Abonos' : type === 'CREDIT' ? 'Créditos' : 'Gastos';
      message += `  • ${typeLabel}: ${data.count} (${data.total >= 0 ? '+' : ''}$${data.total.toFixed(2)})\n`;
    }

    message += `\n🔍 <i>Revisa y resuelve estas diferencias en el sistema.</i>`;

    return message;
  }

  /**
   * Parsea un monto a número
   */
  private parseAmount(amount: number | string): number {
    if (typeof amount === 'number') {
      return amount;
    }
    if (typeof amount === 'string') {
      return parseFloat(amount) || 0;
    }
    return 0;
  }

  /**
   * Formatea una fecha
   */
  private formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }

  /**
   * Prueba la conexión del servicio
   */
  async testConnection(): Promise<boolean> {
    try {
      const botInfo = await this.telegramService.getMe();
      return botInfo.ok;
    } catch (error) {
      console.error('Error probando conexión:', error);
      return false;
    }
  }
}

/**
 * Función helper para crear una instancia del servicio con configuración por defecto
 */
export function createDiscrepancyReporter(
  botToken: string,
  defaultChatId: string
): DiscrepancyReporter {
  const config: TelegramConfig = {
    botToken,
    chatId: defaultChatId,
  };

  return new DiscrepancyReporter(config);
}

