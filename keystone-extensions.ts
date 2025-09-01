import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const extendExpressApp = (app: express.Express) => {
  // Endpoint para recibir webhooks de Telegram
  app.post('/api/telegram-webhook', express.json(), async (req, res) => {
    try {
      console.log('📱 Webhook de Telegram recibido:', JSON.stringify(req.body, null, 2));
      
      const update = req.body;
      const message = update?.message;
      
      if (!message) {
        console.log('❌ No se recibió mensaje válido');
        return res.json({ success: false, message: 'No se recibió mensaje válido' });
      }

      const chatId = message.chat?.id?.toString();
      const text = message.text;
      const from = message.from;

      if (!chatId || !text || !from) {
        console.log('❌ Datos del mensaje incompletos');
        return res.json({ success: false, message: 'Datos del mensaje incompletos' });
      }

      console.log('📝 Procesando mensaje:', { chatId, text, from });

      // Procesar comando /start
      if (text === '/start') {
        const name = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
        const username = from.username;

        // Verificar si el usuario ya existe
        const existingUser = await (prisma as any).telegramUser.findUnique({
          where: { chatId }
        });

        if (existingUser) {
          console.log('✅ Usuario ya existe, actualizando actividad');
          await (prisma as any).telegramUser.update({
            where: { chatId },
            data: { 
              lastActivity: new Date(),
              isActive: true
            }
          });
          
          // Enviar respuesta al usuario
          await sendTelegramMessage(chatId, `¡Hola ${name}! Ya estás registrado. Tu actividad ha sido actualizada.`);
          
          return res.json({ 
            success: true, 
            message: `Usuario ${name} ya registrado. Actividad actualizada.` 
          });
        }

        // Crear nuevo usuario
        const newUser = await (prisma as any).telegramUser.create({
          data: {
            chatId,
            name,
            username: username || 'sin_username',
            isActive: true,
            registeredAt: new Date(),
            lastActivity: new Date(),
            reportsReceived: 0,
            isInRecipientsList: false,
            notes: 'Registrado automáticamente via webhook de Telegram'
          }
        });

        console.log('✅ Nuevo usuario de Telegram creado via webhook:', newUser);
        
        // Enviar respuesta al usuario
        await sendTelegramMessage(chatId, `¡Bienvenido ${name}! Te has registrado exitosamente. Usa /help para ver comandos disponibles.`);
        
        return res.json({ 
          success: true, 
          message: `Usuario ${name} registrado exitosamente via webhook con ID: ${newUser.id}` 
        });
      }

      // Procesar otros comandos
      if (text === '/status') {
        const user = await (prisma as any).telegramUser.findUnique({
          where: { chatId }
        });
        
        if (user) {
          const statusMessage = `Estado: Activo\nRegistrado: ${user.registeredAt.toLocaleDateString()}\nReportes recibidos: ${user.reportsReceived}`;
          await sendTelegramMessage(chatId, statusMessage);
          return res.json({ success: true, message: statusMessage });
        } else {
          const notRegisteredMessage = 'No estás registrado. Envía /start para registrarte.';
          await sendTelegramMessage(chatId, notRegisteredMessage);
          return res.json({ success: false, message: notRegisteredMessage });
        }
      }

      if (text === '/help') {
        const helpMessage = 'Comandos disponibles:\n/start - Registrarse\n/status - Ver estado\n/help - Esta ayuda';
        await sendTelegramMessage(chatId, helpMessage);
        return res.json({ success: true, message: helpMessage });
      }

      const unknownCommandMessage = `Comando no reconocido: ${text}. Envía /help para ver comandos disponibles.`;
      await sendTelegramMessage(chatId, unknownCommandMessage);
      return res.json({ success: false, message: unknownCommandMessage });
      
    } catch (error) {
      console.error('❌ Error al procesar webhook de Telegram:', error);
      res.status(500).json({ 
        success: false, 
        message: `Error al procesar webhook: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Endpoint de prueba para verificar que funcione
  app.get('/api/telegram-webhook', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Endpoint de webhook de Telegram funcionando',
      instructions: 'Configura tu bot para enviar POST a este endpoint'
    });
  });

  // Endpoint de test hardcoded para probar localmente
  app.post('/api/test-telegram-local', async (req, res) => {
    try {
      console.log('🧪 Test local de Telegram iniciado');
      
      // Simular un mensaje /start hardcoded
      const testMessage = {
        message: {
          chat: {
            id: 999888777,
            type: 'private'
          },
          from: {
            id: 999888777,
            first_name: 'Usuario',
            last_name: 'de Prueba',
            username: 'testuser_local'
          },
          text: '/start',
          date: Math.floor(Date.now() / 1000)
        }
      };

      console.log('📝 Procesando mensaje de prueba:', testMessage);

      const chatId = testMessage.message.chat.id.toString();
      const text = testMessage.message.text;
      const from = testMessage.message.from;

      // Procesar comando /start
      if (text === '/start') {
        const name = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
        const username = from.username;

        // Verificar si el usuario ya existe
        const existingUser = await (prisma as any).telegramUser.findUnique({
          where: { chatId }
        });

        if (existingUser) {
          console.log('✅ Usuario ya existe, actualizando actividad');
          await (prisma as any).telegramUser.update({
            where: { chatId },
            data: { 
              lastActivity: new Date(),
              isActive: true
            }
          });
          
          return res.json({ 
            success: true, 
            message: `Usuario ${name} ya registrado. Actividad actualizada.`,
            user: existingUser
          });
        }

        // Crear nuevo usuario
        const newUser = await (prisma as any).telegramUser.create({
          data: {
            chatId,
            name,
            username: username || 'sin_username',
            isActive: true,
            registeredAt: new Date(),
            lastActivity: new Date(),
            reportsReceived: 0,
            isInRecipientsList: false,
            notes: 'Registrado automáticamente via test local'
          }
        });

        console.log('✅ Nuevo usuario de Telegram creado via test local:', newUser);
        
        return res.json({ 
          success: true, 
          message: `Usuario ${name} registrado exitosamente via test local con ID: ${newUser.id}`,
          user: newUser
        });
      }

      res.json({ success: false, message: 'Comando no reconocido en test local' });
      
    } catch (error) {
      console.error('❌ Error en test local de Telegram:', error);
      res.status(500).json({ 
        success: false, 
        message: `Error en test local: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Endpoint para control del sistema de cron
  app.post('/api/cron-control', express.json(), async (req, res) => {
    try {
      console.log('🔍 API de cron recibió request:', req.method, req.body);
      
      const { action, configId, config } = req.body;
      console.log('📋 Acción solicitada:', action);
      
      if (!action) {
        return res.status(400).json({ error: 'Acción requerida' });
      }

      // Importar el servicio real de cron
      const { 
        startCronSystem, 
        stopCronSystem, 
        getCronStatus, 
        rescheduleConfig, 
        unscheduleConfig 
      } = require('./admin/services/cronService');

      switch (action) {
        case 'start':
          // Iniciar el sistema de cron
          console.log('🚀 Iniciando sistema de cron...');
          try {
            // Obtener configuraciones activas de la base de datos
            const activeConfigs = await (prisma as any).reportConfig.findMany({
              where: { isActive: true },
              include: {
                routes: true,
                recipients: true
              }
            });
            
            console.log(`📋 Configuraciones activas encontradas: ${activeConfigs.length}`);
            
            // Iniciar el sistema real de cron
            startCronSystem(activeConfigs, { prisma }, async (configId: string) => {
              console.log(`📤 Enviando reporte para configuración: ${configId}`);
              
              try {
                // Obtener la configuración del reporte
                const reportConfig = activeConfigs.find(config => config.id === configId);
                if (!reportConfig) {
                  console.log(`❌ Configuración no encontrada para ID: ${configId}`);
                  return;
                }
                
                // Importar y usar el servicio real de reportes
                const { processCronReport } = require('./admin/services/cronReportService');
                
                // Procesar el reporte usando el servicio real
                await processCronReport(reportConfig, prisma);
                
                console.log(`✅ Reporte ${reportConfig.name} procesado correctamente por el cron`);
                
              } catch (error) {
                console.error(`❌ Error procesando reporte ${configId}:`, error);
              }
            });
            
            res.status(200).json({ 
              success: true, 
              message: 'Sistema de cron iniciado',
              status: 'running'
            });
          } catch (error) {
            console.error('❌ Error iniciando cron:', error);
            res.status(500).json({ 
              success: false, 
              error: 'Error iniciando sistema de cron',
              details: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
          break;

        case 'stop':
          // Detener el sistema de cron
          console.log('⏹️ Deteniendo sistema de cron...');
          try {
            stopCronSystem();
            res.status(200).json({ 
              success: true, 
              message: 'Sistema de cron detenido',
              status: 'stopped'
            });
          } catch (error) {
            console.error('❌ Error deteniendo cron:', error);
            res.status(500).json({ 
              success: false, 
              error: 'Error deteniendo sistema de cron',
              details: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
          break;

        case 'status':
          // Obtener estado del sistema de cron
          console.log('📊 Solicitando estado del cron...');
          try {
            const status = getCronStatus();
            console.log('✅ Estado del cron obtenido:', status);
            res.status(200).json({ 
              success: true, 
              status 
            });
          } catch (error) {
            console.log('❌ Error obteniendo estado del cron, devolviendo estado por defecto:', error);
            const defaultStatus = {
              isRunning: false,
              activeTasks: 0,
              taskIds: []
            };
            console.log('🔄 Devolviendo estado por defecto:', defaultStatus);
            res.status(200).json({ 
              success: true, 
              status: defaultStatus
            });
          }
          break;

        case 'reschedule':
          // Reprogramar una configuración específica
          console.log('📅 Reprogramando configuración:', config?.name);
          if (!config) {
            return res.status(400).json({ error: 'Configuración requerida para reprogramar' });
          }
          
          try {
            // Obtener contexto de base de datos
            const context = { prisma };
            
            console.log('🔄 Deteniendo cron actual para reprogramar...');
            stopCronSystem();
            
            console.log('🔄 Iniciando cron con nueva configuración...');
            // Iniciar el sistema real de cron con la nueva configuración
            startCronSystem([config], { prisma }, async (configId: string) => {
              console.log(`📤 Enviando reporte para configuración: ${configId}`);
              // Aquí implementarías la lógica real de envío de reportes
              return Promise.resolve();
            });
            
            res.status(200).json({ 
              success: true, 
              message: `Configuración ${config.name} reprogramada` 
            });
          } catch (error) {
            console.error('❌ Error reprogramando configuración:', error);
            res.status(500).json({ 
              success: false, 
              error: 'Error reprogramando configuración',
              details: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
          break;

        case 'unschedule':
          // Desprogramar una configuración específica
          console.log('⏹️ Desprogramando configuración:', configId);
          if (!configId) {
            return res.status(400).json({ error: 'ID de configuración requerido' });
          }
          
          try {
            unscheduleConfig(configId);
            res.status(200).json({ 
              success: true, 
              message: `Configuración ${configId} desprogramada` 
            });
          } catch (error) {
            console.error('❌ Error desprogramando configuración:', error);
            res.status(500).json({ 
              success: false, 
              error: 'Error desprogramando configuración',
              details: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
          break;

        default:
          res.status(400).json({ error: 'Acción no válida' });
      }
    } catch (error) {
      console.error('❌ Error en API de cron:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
};

// Función para enviar mensajes de vuelta al usuario
async function sendTelegramMessage(chatId: string, text: string) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.log('❌ TELEGRAM_BOT_TOKEN no configurado');
      return;
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
      console.log('✅ Mensaje enviado a Telegram:', text);
    } else {
      console.error('❌ Error al enviar mensaje a Telegram:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Error al enviar mensaje a Telegram:', error);
  }
}
