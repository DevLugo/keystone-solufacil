import { NextApiRequest, NextApiResponse } from 'next';
import { TelegramService } from '../services/telegramService';
import { getValidatedTelegramConfig } from '../config/telegram.config';
import { telegramUserService } from '../services/telegramUserService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Log completo de la request para debugging
  console.log('🔔 Webhook recibido:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const { message } = req.body;

    // Verificar que sea un mensaje válido
    if (!message || !message.chat || !message.from) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    const chatId = message.chat.id;
    const user = message.from;
    const text = message.text || '';

    // Crear instancia del servicio de Telegram
    const config = getValidatedTelegramConfig();
    const telegramService = new TelegramService({
      botToken: config.botToken,
      chatId: chatId.toString(),
    });

    // Manejar comandos
    switch (text.toLowerCase()) {
      case '/start':
        await handleStartCommand(telegramService, user);
        break;
      
      case '/status':
        await handleStatusCommand(telegramService, chatId, user);
        break;
      
      case '/help':
        await handleHelpCommand(telegramService, chatId);
        break;
      
      case '/unregister':
        await handleUnregisterCommand(telegramService, chatId, user);
        break;
      
      default:
        // Si no es un comando, enviar mensaje de ayuda
        await handleUnknownCommand(telegramService, chatId);
        break;
    }

    // Responder exitosamente
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error in Telegram webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Maneja el comando /start - Registra al usuario
 */
async function handleStartCommand(
  telegramService: TelegramService,
  user: any
) {
  try {
    console.log('🚀 Procesando comando /start para usuario:', user);
    
    // Verificar si el usuario ya existe
    const existingUser = await telegramUserService.getUserByChatId(user.chatId.toString());
    console.log('🔍 Usuario existente encontrado:', existingUser);
    
    if (existingUser) {
      console.log('🔄 Usuario ya existe, reactivando...');
      // Usuario ya existe, reactivarlo si está inactivo
      if (!existingUser.isActive) {
        await telegramUserService.activateUser(existingUser.id);
      }
      
      // Actualizar última actividad
      await telegramUserService.updateUser({
        id: existingUser.id,
        lastActivity: new Date(),
      });
      
      const reactivateMessage = `
🔄 <b>¡Bienvenido de vuelta!</b>

👤 <b>Usuario:</b> ${user.first_name || 'Usuario'}
✅ <b>Estado:</b> Reactivado exitosamente

📋 <b>Comandos disponibles:</b>
• /status - Ver tu estado
• /help - Mostrar ayuda
• /unregister - Darte de baja

🚀 <b>Estado actual:</b>
• ${existingUser.isInRecipientsList ? '✅ En lista de destinatarios' : '⏳ Pendiente de aprobación'}
• Reportes recibidos: ${existingUser.reportsReceived}
      `;
      
      await telegramService.sendHtmlMessage(user.chatId.toString(), reactivateMessage);
      console.log('✅ Mensaje de reactivación enviado');
      return;
    }

    console.log('🆕 Creando nuevo usuario...');
    // Crear nuevo usuario
    const userData = {
      chatId: user.chatId.toString(),
      name: user.first_name || 'Usuario',
      username: user.username || null,
      isActive: true,
      notes: 'Usuario registrado automáticamente',
    };

    const newUser = await telegramUserService.createUser(userData);

    if (!newUser) {
      throw new Error('No se pudo crear el usuario');
    }

    console.log('✅ Nuevo usuario registrado:', newUser);

    // Enviar mensaje de confirmación
    const welcomeMessage = `
🎉 <b>¡Bienvenido a Solufacil Reportes!</b>

✅ <b>Registro exitoso</b>

👤 <b>Información:</b>
• Nombre: ${user.first_name || 'Usuario'}
• Username: ${user.username ? '@' + user.username : 'No especificado'}
• Chat ID: <code>${chatId}</code>

📊 <b>Estado:</b>
• ✅ Activo para recibir reportes
• 🕐 Registrado: ${new Date().toLocaleString('es-MX')}

📋 <b>Comandos disponibles:</b>
• /status - Ver tu estado
• /help - Mostrar ayuda
• /unregister - Darte de baja

🚀 <b>Próximos pasos:</b>
1. El administrador te agregará a la lista de destinatarios
2. Recibirás reportes automáticos según la configuración
3. Los reportes se enviarán en los horarios programados

¿Tienes alguna pregunta? Contacta al administrador del sistema.
    `;

    await telegramService.sendHtmlMessage(chatId.toString(), welcomeMessage);

    // Notificar al administrador sobre el nuevo usuario
    await notifyAdminAboutNewUser(userData);

  } catch (error) {
    console.error('Error handling start command:', error);
    await telegramService.sendMessage({
      chat_id: chatId.toString(),
      text: '❌ Error al registrar usuario. Contacta al administrador.',
    });
  }
}

/**
 * Maneja el comando /status - Muestra el estado del usuario
 */
async function handleStatusCommand(
  telegramService: TelegramService,
  chatId: number,
  user: any
) {
  try {
    // Obtener estado real de la base de datos
    const userStatus = await telegramUserService.getUserByChatId(chatId.toString());
    
    if (!userStatus) {
      await telegramService.sendMessage({
        chat_id: chatId.toString(),
        text: '❌ No estás registrado. Envía /start para registrarte.',
      });
      return;
    }

    const statusMessage = `
📊 <b>Estado de tu registro</b>

👤 <b>Usuario:</b> ${user.first_name || 'Usuario'}

✅ <b>Estado:</b>
• Registro: ${userStatus.isActive ? '✅ Activo' : '❌ Inactivo'}
• En lista de destinatarios: ${userStatus.isInRecipientsList ? '✅ Sí' : '⏳ Pendiente'}
• Reportes recibidos: ${userStatus.reportsReceived}

📅 <b>Fechas:</b>
• Registrado: ${userStatus.registeredAt.toLocaleDateString('es-MX')}
• Última actividad: ${userStatus.lastActivity.toLocaleDateString('es-MX')}

${userStatus.isInRecipientsList 
  ? '🎯 <b>Estado:</b> Recibirás reportes automáticos según la configuración.'
  : '⏳ <b>Estado:</b> El administrador te agregará pronto a la lista de destinatarios.'
}
    `;

    await telegramService.sendHtmlMessage(chatId.toString(), statusMessage);

  } catch (error) {
    console.error('Error handling status command:', error);
    await telegramService.sendMessage({
      chat_id: chatId.toString(),
      text: '❌ Error al obtener estado. Contacta al administrador.',
    });
  }
}

/**
 * Maneja el comando /help - Muestra ayuda
 */
async function handleHelpCommand(
  telegramService: TelegramService,
  chatId: number
) {
  const helpMessage = `
📚 <b>Ayuda - Solufacil Reportes</b>

🤖 <b>¿Qué es este bot?</b>
Este bot te envía reportes automáticos sobre el estado de tu cartera, documentos y finanzas.

📋 <b>Comandos disponibles:</b>

• <code>/start</code> - Registrarte para recibir reportes
• <code>/status</code> - Ver tu estado actual
• <code>/help</code> - Mostrar esta ayuda
• <code>/unregister</code> - Darte de baja

📊 <b>Tipos de reportes:</b>
• Créditos con documentos con error
• Créditos sin documentos
• Créditos completos
• Resumen semanal de cartera
• Reporte financiero

🕐 <b>Frecuencia:</b>
Los reportes se envían automáticamente según la configuración del administrador (días y horas específicas).

❓ <b>¿Necesitas ayuda?</b>
Contacta al administrador del sistema o envía un mensaje con tu consulta.

🔗 <b>Enlaces útiles:</b>
• Sistema principal: [URL de tu sistema]
• Soporte: [Email de soporte]
    `;

  await telegramService.sendHtmlMessage(chatId.toString(), helpMessage);
}

/**
 * Maneja el comando /unregister - Da de baja al usuario
 */
async function handleUnregisterCommand(
  telegramService: TelegramService,
  chatId: number,
  user: any
) {
  try {
    // Obtener usuario de la base de datos
    const userStatus = await telegramUserService.getUserByChatId(chatId.toString());
    
    if (!userStatus) {
      await telegramService.sendMessage({
        chat_id: chatId.toString(),
        text: '❌ No estás registrado.',
      });
      return;
    }

    // Desactivar usuario
    const success = await telegramUserService.deactivateUser(userStatus.id);
    
    if (!success) {
      throw new Error('No se pudo desactivar el usuario');
    }

    console.log('Usuario desactivado:', chatId);

    const unregisterMessage = `
😔 <b>Usuario desactivado</b>

👤 <b>Usuario:</b> ${user.first_name || 'Usuario'}

❌ <b>Estado:</b> Ya no recibirás reportes automáticos

🔄 <b>Para reactivarte:</b>
Envía <code>/start</code> nuevamente

📞 <b>¿Fue un error?</b>
Contacta al administrador para reactivar tu cuenta

👋 <b>¡Gracias por usar Solufacil Reportes!</b>
    `;

    await telegramService.sendHtmlMessage(chatId.toString(), unregisterMessage);

  } catch (error) {
    console.error('Error handling unregister command:', error);
    await telegramService.sendMessage({
      chat_id: chatId.toString(),
      text: '❌ Error al desactivar usuario. Contacta al administrador.',
    });
  }
}

/**
 * Maneja comandos desconocidos
 */
async function handleUnknownCommand(
  telegramService: TelegramService,
  chatId: number
) {
  const unknownMessage = `
❓ <b>Comando no reconocido</b>

📋 <b>Comandos disponibles:</b>
• <code>/start</code> - Registrarte
• <code>/status</code> - Ver estado
• <code>/help</code> - Mostrar ayuda
• <code>/unregister</code> - Darte de baja

💡 <b>¿Necesitas ayuda?</b>
Envía <code>/help</code> para ver todos los comandos disponibles.
    `;

  await telegramService.sendHtmlMessage(chatId.toString(), unknownMessage);
}

/**
 * Notifica al administrador sobre un nuevo usuario
 */
async function notifyAdminAboutNewUser(userData: any) {
  try {
    const config = getValidatedTelegramConfig();
    const adminTelegramService = new TelegramService({
      botToken: config.botToken,
      chatId: config.defaultChatId,
    });

    const adminNotification = `
🆕 <b>Nuevo usuario registrado</b>

👤 <b>Información:</b>
• Nombre: ${userData.name}
• Username: ${userData.username ? '@' + userData.username : 'No especificado'}
• Chat ID: <code>${userData.chatId}</code>
• Fecha: ${userData.registeredAt.toLocaleString('es-MX')}

📋 <b>Acciones requeridas:</b>
1. Verificar que el usuario sea legítimo
2. Agregarlo a la lista de destinatarios en la configuración
3. Configurar qué reportes recibirá
4. Activar el envío automático

🔗 <b>Acceso directo:</b>
<a href="/configuracion-reportes">Configuración de Reportes</a>
    `;

    await adminTelegramService.sendHtmlMessage(config.defaultChatId, adminNotification);

  } catch (error) {
    console.error('Error notifying admin:', error);
  }
}

// Configurar para Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
