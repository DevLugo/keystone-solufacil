import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface TelegramMessage {
  chat_id: string;
  text?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
}

export interface TelegramDocument {
  chat_id: string;
  document: Buffer | string;
  filename: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export interface TelegramResponse {
  ok: boolean;
  result?: any;
  error_code?: number;
  description?: string;
}

export class TelegramService {
  private botToken: string;
  private baseUrl: string;

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Envía un mensaje de texto con retry logic
   */
  async sendMessage(message: TelegramMessage, maxRetries: number = 3): Promise<TelegramResponse> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📱 [TelegramService] Enviando mensaje (intento ${attempt}/${maxRetries})`, {
          chatId: message.chat_id,
          messageLength: message.text?.length || 0
        });

        const response = await axios.post(`${this.baseUrl}/sendMessage`, message, {
          timeout: 10000 // 10 segundos timeout
        });

        console.log(`✅ [TelegramService] Mensaje enviado exitosamente`, {
          ok: response.data.ok,
          messageId: response.data.result?.message_id
        });

        return response.data;
      } catch (error) {
        lastError = error;
        console.error(`❌ [TelegramService] Error en intento ${attempt}:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });

        // Si es error de rate limit, esperar más tiempo
        if (error.response?.status === 429) {
          const retryAfter = error.response.data?.parameters?.retry_after || 60;
          console.log(`⏳ [TelegramService] Rate limit excedido, esperando ${retryAfter} segundos...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        } else if (attempt < maxRetries) {
          // Exponential backoff para otros errores
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ [TelegramService] Esperando ${delay}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    console.error(`❌ [TelegramService] Todos los intentos fallaron después de ${maxRetries} reintentos`);
    throw new Error(`Failed to send Telegram message after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Envía un documento (PDF, etc.) con retry logic
   */
  async sendDocument(document: TelegramDocument, maxRetries: number = 3): Promise<TelegramResponse> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📱 [TelegramService] Enviando documento (intento ${attempt}/${maxRetries})`, {
          chatId: document.chat_id,
          filename: document.filename,
          documentSize: document.document.length
        });

        const formData = new FormData();
        
        formData.append('chat_id', document.chat_id);
        formData.append('document', document.document, document.filename);
        
        if (document.caption) {
          formData.append('caption', document.caption);
        }
        
        if (document.parse_mode) {
          formData.append('parse_mode', document.parse_mode);
        }

        const response = await axios.post(`${this.baseUrl}/sendDocument`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 30000 // 30 segundos timeout para documentos
        });

        console.log(`✅ [TelegramService] Documento enviado exitosamente`, {
          ok: response.data.ok,
          messageId: response.data.result?.message_id
        });

        return response.data;
      } catch (error) {
        lastError = error;
        console.error(`❌ [TelegramService] Error enviando documento en intento ${attempt}:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });

        // Si es error de rate limit, esperar más tiempo
        if (error.response?.status === 429) {
          const retryAfter = error.response.data?.parameters?.retry_after || 60;
          console.log(`⏳ [TelegramService] Rate limit excedido, esperando ${retryAfter} segundos...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        } else if (attempt < maxRetries) {
          // Exponential backoff para otros errores
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ [TelegramService] Esperando ${delay}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    console.error(`❌ [TelegramService] Todos los intentos de envío de documento fallaron después de ${maxRetries} reintentos`);
    throw new Error(`Failed to send Telegram document after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Envía un mensaje con formato HTML
   */
  async sendHtmlMessage(chatId: string, htmlText: string): Promise<TelegramResponse> {
    return this.sendMessage({
      chat_id: chatId,
      text: htmlText,
      parse_mode: 'HTML',
    });
  }

  /**
   * Envía un mensaje con formato Markdown
   */
  async sendMarkdownMessage(chatId: string, markdownText: string): Promise<TelegramResponse> {
    return this.sendMessage({
      chat_id: chatId,
      text: markdownText,
      parse_mode: 'Markdown',
    });
  }

  /**
   * Envía un PDF desde un buffer
   */
  async sendPdfFromBuffer(
    chatId: string, 
    pdfBuffer: Buffer, 
    filename: string, 
    caption?: string
  ): Promise<TelegramResponse> {
    return this.sendDocument({
      chat_id: chatId,
      document: pdfBuffer,
      filename: filename,
      caption: caption,
      parse_mode: 'HTML',
    });
  }

  /**
   * Envía un PDF desde un archivo
   */
  async sendPdfFromFile(
    chatId: string, 
    filePath: string, 
    caption?: string
  ): Promise<TelegramResponse> {
    try {
      const pdfBuffer = fs.readFileSync(filePath);
      const filename = path.basename(filePath);
      
      return this.sendDocument({
        chat_id: chatId,
        document: pdfBuffer,
        filename: filename,
        caption: caption,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error reading PDF file:', error);
      throw new Error(`Failed to read PDF file: ${error}`);
    }
  }

  /**
   * Verifica que el bot esté funcionando
   */
  async getMe(): Promise<TelegramResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      return response.data;
    } catch (error) {
      console.error('Error getting bot info:', error);
      throw new Error(`Failed to get bot info: ${error}`);
    }
  }

  /**
   * Obtiene las actualizaciones del bot
   */
  async getUpdates(offset?: number, limit?: number): Promise<TelegramResponse> {
    try {
      const params: any = {};
      if (offset) params.offset = offset;
      if (limit) params.limit = limit;

      const response = await axios.get(`${this.baseUrl}/getUpdates`, { params });
      return response.data;
    } catch (error) {
      console.error('Error getting updates:', error);
      throw new Error(`Failed to get updates: ${error}`);
    }
  }

  /**
   * Valida que un chat ID sea válido y accesible
   */
  async validateChatId(chatId: string): Promise<{ isValid: boolean; error?: string; chatInfo?: any }> {
    try {
      console.log(`🔍 [TelegramService] Validando chat ID: ${chatId}`);
      
      // Intentar obtener información del chat
      const response = await axios.get(`${this.baseUrl}/getChat`, {
        params: { chat_id: chatId }
      });

      if (response.data.ok) {
        console.log(`✅ [TelegramService] Chat ID válido:`, response.data.result);
        return {
          isValid: true,
          chatInfo: response.data.result
        };
      } else {
        console.log(`❌ [TelegramService] Chat ID inválido:`, response.data);
        return {
          isValid: false,
          error: response.data.description || 'Chat ID inválido'
        };
      }
    } catch (error) {
      console.error(`❌ [TelegramService] Error validando chat ID:`, error);
      return {
        isValid: false,
        error: error.response?.data?.description || error.message || 'Error validando chat ID'
      };
    }
  }

  /**
   * Envía un mensaje de prueba para verificar la configuración
   */
  async sendTestMessage(chatId: string): Promise<{ success: boolean; error?: string; messageId?: number }> {
    try {
      console.log(`🧪 [TelegramService] Enviando mensaje de prueba a: ${chatId}`);
      
      const testMessage = {
        chat_id: chatId,
        text: '🧪 Mensaje de prueba - Configuración de Telegram funcionando correctamente',
        parse_mode: 'HTML'
      };

      const response = await this.sendMessage(testMessage, 1); // Solo 1 intento para pruebas

      if (response.ok) {
        console.log(`✅ [TelegramService] Mensaje de prueba enviado exitosamente`);
        return {
          success: true,
          messageId: response.result?.message_id
        };
      } else {
        console.log(`❌ [TelegramService] Error en mensaje de prueba:`, response);
        return {
          success: false,
          error: response.description || 'Error enviando mensaje de prueba'
        };
      }
    } catch (error) {
      console.error(`❌ [TelegramService] Error en mensaje de prueba:`, error);
      return {
        success: false,
        error: error.message || 'Error enviando mensaje de prueba'
      };
    }
  }

  /**
   * Diagnostica la configuración completa del bot
   */
  async diagnoseConfiguration(): Promise<{
    botInfo: any;
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let botInfo: any = null;

    try {
      console.log(`🔍 [TelegramService] Iniciando diagnóstico de configuración...`);

      // 1. Verificar información del bot
      try {
        const botResponse = await this.getMe();
        if (botResponse.ok) {
          botInfo = botResponse.result;
          console.log(`✅ [TelegramService] Bot configurado correctamente:`, botInfo);
        } else {
          errors.push(`Error obteniendo información del bot: ${botResponse.description}`);
        }
      } catch (error) {
        errors.push(`Error conectando con la API de Telegram: ${error.message}`);
      }

      // 2. Verificar token
      if (!this.botToken) {
        errors.push('TELEGRAM_BOT_TOKEN no configurado');
      } else if (!this.botToken.includes(':')) {
        errors.push('Formato de token inválido (debe contener ":")');
      }

      // 3. Verificar URL base
      if (!this.baseUrl.includes('api.telegram.org')) {
        errors.push('URL base de Telegram inválida');
      }

      return {
        botInfo,
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      console.error(`❌ [TelegramService] Error en diagnóstico:`, error);
      return {
        botInfo: null,
        isValid: false,
        errors: [`Error en diagnóstico: ${error.message}`],
        warnings: []
      };
    }
  }
}

/**
 * Función helper para crear mensajes HTML formateados
 */
export function createHtmlMessage(title: string, content: string, footer?: string): string {
  let message = `<b>${title}</b>\n\n`;
  message += content;
  
  if (footer) {
    message += `\n\n<em>${footer}</em>`;
  }
  
  return message;
}

/**
 * Función helper para crear mensajes Markdown formateados
 */
export function createMarkdownMessage(title: string, content: string, footer?: string): string {
  let message = `*${title}*\n\n`;
  message += content;
  
  if (footer) {
    message += `\n\n_${footer}_`;
  }
  
  return message;
}

/**
 * Función helper para formatear fechas
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Función helper para formatear números de moneda
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}
