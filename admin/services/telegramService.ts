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
   * Envía un mensaje de texto
   */
  async sendMessage(message: TelegramMessage): Promise<TelegramResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, message);
      return response.data;
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      throw new Error(`Failed to send Telegram message: ${error}`);
    }
  }

  /**
   * Envía un documento (PDF, etc.)
   */
  async sendDocument(document: TelegramDocument): Promise<TelegramResponse> {
    try {
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
      });

      return response.data;
    } catch (error) {
      console.error('Error sending Telegram document:', error);
      throw new Error(`Failed to send Telegram document: ${error}`);
    }
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
