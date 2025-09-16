// ✅ SCRIPT PARA CONFIGURAR WEBHOOK DE TELEGRAM EN DIFERENTES AMBIENTES
import axios from 'axios';

// ✅ CONFIGURACIONES DE AMBIENTES
const ENVIRONMENTS = {
  local: {
    name: 'Local (ngrok)',
    baseUrl: 'https://tu-ngrok-url.ngrok.io', // Reemplaza con tu URL de ngrok
    webhookPath: '/api/telegram-webhook',
    description: 'Para desarrollo local con ngrok'
  },
  staging: {
    name: 'Staging',
    baseUrl: 'https://tu-staging-url.com', // Reemplaza con tu URL de staging
    webhookPath: '/api/telegram-webhook',
    description: 'Para ambiente de pruebas'
  },
  production: {
    name: 'Producción',
    baseUrl: 'https://www.solufacil.mx',
    webhookPath: '/api/telegram-webhook',
    description: 'Para ambiente de producción'
  }
};

// ✅ CONFIGURACIÓN DE TELEGRAM
const TELEGRAM_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '7652894751:AAHJNOZ0ZcLInlvTilkrojk7_NIBuBZUz0g',
  allowedUpdates: ['message', 'edited_message'],
  dropPendingUpdates: true
};

// ✅ CLASE PRINCIPAL PARA MANEJAR WEBHOOKS
class WebhookManager {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  // ✅ CONFIGURAR WEBHOOK
  async setWebhook(webhookUrl: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`🔗 Configurando webhook: ${webhookUrl}`);
      
      const response = await axios.post(
        `https://api.telegram.org/bot${this.botToken}/setWebhook`,
        {
          url: webhookUrl,
          allowed_updates: TELEGRAM_CONFIG.allowedUpdates,
          drop_pending_updates: TELEGRAM_CONFIG.dropPendingUpdates
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.ok) {
        return {
          success: true,
          message: 'Webhook configurado exitosamente',
          data: response.data
        };
      } else {
        return {
          success: false,
          message: `Error: ${response.data.description}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error de conexión: ${error.message}`
      };
    }
  }

  // ✅ VERIFICAR WEBHOOK ACTUAL
  async getWebhookInfo(): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${this.botToken}/getWebhookInfo`
      );

      if (response.data.ok) {
        return {
          success: true,
          data: response.data.result
        };
      } else {
        return {
          success: false,
          message: `Error: ${response.data.description}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error de conexión: ${error.message}`
      };
    }
  }

  // ✅ ELIMINAR WEBHOOK
  async deleteWebhook(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${this.botToken}/deleteWebhook`
      );

      if (response.data.ok) {
        return {
          success: true,
          message: 'Webhook eliminado exitosamente'
        };
      } else {
        return {
          success: false,
          message: `Error: ${response.data.description}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error de conexión: ${error.message}`
      };
    }
  }

  // ✅ PROBAR WEBHOOK
  async testWebhook(webhookUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      // Enviar un mensaje de prueba al bot
      const testMessage = `🧪 Test de webhook - ${new Date().toLocaleString('es-ES')}`;
      
      const response = await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: process.env.TELEGRAM_TEST_CHAT_ID || '123456789',
          text: testMessage
        }
      );

      if (response.data.ok) {
        return {
          success: true,
          message: 'Mensaje de prueba enviado exitosamente'
        };
      } else {
        return {
          success: false,
          message: `Error enviando mensaje: ${response.data.description}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error de conexión: ${error.message}`
      };
    }
  }
}

// ✅ FUNCIÓN PRINCIPAL
async function main() {
  console.log('🤖 CONFIGURADOR DE WEBHOOK DE TELEGRAM');
  console.log('=' * 50);

  // Verificar token
  if (!TELEGRAM_CONFIG.botToken || TELEGRAM_CONFIG.botToken === 'YOUR_BOT_TOKEN_HERE') {
    console.log('❌ TELEGRAM_BOT_TOKEN no configurado');
    console.log('💡 Configura tu token en el archivo .env');
    process.exit(1);
  }

  const manager = new WebhookManager(TELEGRAM_CONFIG.botToken);

  // Obtener argumentos de línea de comandos
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = args[1];

  switch (command) {
    case 'set':
      await handleSetWebhook(manager, environment);
      break;
    case 'info':
      await handleGetInfo(manager);
      break;
    case 'delete':
      await handleDeleteWebhook(manager);
      break;
    case 'test':
      await handleTestWebhook(manager, environment);
      break;
    case 'list':
      handleListEnvironments();
      break;
    default:
      showHelp();
  }
}

// ✅ MANEJAR CONFIGURACIÓN DE WEBHOOK
async function handleSetWebhook(manager: WebhookManager, environment: string) {
  if (!environment) {
    console.log('❌ Especifica un ambiente: local, staging, o production');
    return;
  }

  const env = ENVIRONMENTS[environment as keyof typeof ENVIRONMENTS];
  if (!env) {
    console.log('❌ Ambiente no válido. Usa: local, staging, o production');
    return;
  }

  const webhookUrl = env.baseUrl + env.webhookPath;
  
  console.log(`🔧 Configurando webhook para ${env.name}`);
  console.log(`📡 URL: ${webhookUrl}`);
  console.log(`📝 ${env.description}`);
  console.log('');

  const result = await manager.setWebhook(webhookUrl);
  
  if (result.success) {
    console.log('✅ Webhook configurado exitosamente');
    console.log('📊 Datos:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Error configurando webhook:', result.message);
  }
}

// ✅ MANEJAR INFORMACIÓN DEL WEBHOOK
async function handleGetInfo(manager: WebhookManager) {
  console.log('🔍 Obteniendo información del webhook actual...');
  
  const result = await manager.getWebhookInfo();
  
  if (result.success) {
    console.log('✅ Información del webhook:');
    console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Error obteniendo información:', result.message);
  }
}

// ✅ MANEJAR ELIMINACIÓN DEL WEBHOOK
async function handleDeleteWebhook(manager: WebhookManager) {
  console.log('🗑️ Eliminando webhook...');
  
  const result = await manager.deleteWebhook();
  
  if (result.success) {
    console.log('✅ Webhook eliminado exitosamente');
  } else {
    console.log('❌ Error eliminando webhook:', result.message);
  }
}

// ✅ MANEJAR PRUEBA DEL WEBHOOK
async function handleTestWebhook(manager: WebhookManager, environment: string) {
  if (!environment) {
    console.log('❌ Especifica un ambiente: local, staging, o production');
    return;
  }

  const env = ENVIRONMENTS[environment as keyof typeof ENVIRONMENTS];
  if (!env) {
    console.log('❌ Ambiente no válido. Usa: local, staging, o production');
    return;
  }

  const webhookUrl = env.baseUrl + env.webhookPath;
  
  console.log(`🧪 Probando webhook para ${env.name}`);
  console.log(`📡 URL: ${webhookUrl}`);
  console.log('');

  const result = await manager.testWebhook(webhookUrl);
  
  if (result.success) {
    console.log('✅ Prueba exitosa:', result.message);
  } else {
    console.log('❌ Error en la prueba:', result.message);
  }
}

// ✅ MOSTRAR AMBIENTES DISPONIBLES
function handleListEnvironments() {
  console.log('📋 Ambientes disponibles:');
  console.log('');
  
  Object.entries(ENVIRONMENTS).forEach(([key, env]) => {
    console.log(`🔧 ${key}:`);
    console.log(`   Nombre: ${env.name}`);
    console.log(`   URL: ${env.baseUrl}${env.webhookPath}`);
    console.log(`   Descripción: ${env.description}`);
    console.log('');
  });
}

// ✅ MOSTRAR AYUDA
function showHelp() {
  console.log('📖 Uso del script:');
  console.log('');
  console.log('  npm run webhook:set <ambiente>     - Configurar webhook');
  console.log('  npm run webhook:info               - Ver información actual');
  console.log('  npm run webhook:delete             - Eliminar webhook');
  console.log('  npm run webhook:test <ambiente>    - Probar webhook');
  console.log('  npm run webhook:list               - Listar ambientes');
  console.log('');
  console.log('📋 Ambientes disponibles:');
  console.log('  local      - Desarrollo local con ngrok');
  console.log('  staging    - Ambiente de pruebas');
  console.log('  production - Ambiente de producción');
  console.log('');
  console.log('💡 Ejemplos:');
  console.log('  npm run webhook:set local');
  console.log('  npm run webhook:test production');
  console.log('  npm run webhook:info');
}

// ✅ EXPORTAR FUNCIONES PARA USO EXTERNO
export { WebhookManager, ENVIRONMENTS };

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}
