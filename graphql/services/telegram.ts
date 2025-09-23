// Import fetch for Telegram API calls
const fetch = require('node-fetch');

export function generateReportContent(reportType: string, reportData: any): string {
  switch (reportType) {
    case 'creditos_con_documentos':
      return `📋 REPORTE: Créditos con Documentos\n\n${JSON.stringify(reportData, null, 2)}`;
    
    case 'cartera_vencida':
      return `⚠️ REPORTE: Cartera Vencida\n\n${JSON.stringify(reportData, null, 2)}`;
    
    case 'resumen_financiero':
      return `💰 REPORTE: Resumen Financiero\n\n${JSON.stringify(reportData, null, 2)}`;
    
    default:
      return `📊 REPORTE: ${reportType}\n\n${JSON.stringify(reportData, null, 2)}`;
  }
}

export async function sendTelegramMessageToUser(chatId: string, text: string): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.log('❌ TELEGRAM_BOT_TOKEN no configurado');
      return false;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });

    if (response.ok) {
      console.log('✅ Mensaje enviado a Telegram:', text.substring(0, 100) + '...');
      return true;
    } else {
      console.error('❌ Error al enviar mensaje a Telegram:', response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error al enviar mensaje a Telegram:', error);
    return false;
  }
}

export async function sendTelegramFile(chatId: string, fileBuffer: Buffer, filename: string, caption: string): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.log('❌ TELEGRAM_BOT_TOKEN no configurado');
      return false;
    }

    // Create FormData for file upload
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('chat_id', chatId);
    form.append('document', fileBuffer, {
      filename: filename,
      contentType: 'application/pdf'
    });
    form.append('caption', caption);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    if (response.ok) {
      console.log('✅ Archivo enviado a Telegram:', filename);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Error al enviar archivo a Telegram:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error al enviar archivo a Telegram:', error);
    return false;
  }
}