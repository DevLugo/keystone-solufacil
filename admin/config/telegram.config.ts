export interface TelegramBotConfig {
  botToken: string;
  defaultChatId: string;
  webhookUrl?: string;
  allowedUsers: string[];
  adminUsers: string[];
}

// Configuración por defecto - DEBE SER CONFIGURADA EN PRODUCCIÓN
export const telegramConfig: TelegramBotConfig = {
  // Obtener el token del bot de @BotFather en Telegram
  botToken: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
  
  // Chat ID por defecto (puede ser un grupo o usuario individual)
  defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || 'YOUR_CHAT_ID_HERE',
  
  // URL del webhook (opcional, para recibir actualizaciones)
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
  
  // Usuarios permitidos para usar el bot
  allowedUsers: process.env.TELEGRAM_ALLOWED_USERS?.split(',') || [],
  
  // Usuarios administradores del bot
  adminUsers: process.env.TELEGRAM_ADMIN_USERS?.split(',') || [],
};

/**
 * Valida la configuración de Telegram
 */
export function validateTelegramConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!telegramConfig.botToken || telegramConfig.botToken === 'YOUR_BOT_TOKEN_HERE') {
    errors.push('TELEGRAM_BOT_TOKEN no está configurado');
  }

  if (!telegramConfig.defaultChatId || telegramConfig.defaultChatId === 'YOUR_CHAT_ID_HERE') {
    errors.push('TELEGRAM_DEFAULT_CHAT_ID no está configurado');
  }

  if (telegramConfig.botToken && !telegramConfig.botToken.startsWith('5')) {
    errors.push('TELEGRAM_BOT_TOKEN parece ser inválido (debe empezar con números)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Obtiene la configuración validada
 */
export function getValidatedTelegramConfig(): TelegramBotConfig {
  const validation = validateTelegramConfig();
  
  if (!validation.isValid) {
    console.error('Configuración de Telegram inválida:');
    validation.errors.forEach(error => console.error(`- ${error}`));
    throw new Error('Configuración de Telegram inválida');
  }

  return telegramConfig;
}

/**
 * Configuración para diferentes entornos
 */
export const environmentConfigs = {
  development: {
    botToken: process.env.TELEGRAM_BOT_TOKEN_DEV || telegramConfig.botToken,
    defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID_DEV || telegramConfig.defaultChatId,
  },
  production: {
    botToken: process.env.TELEGRAM_BOT_TOKEN_PROD || telegramConfig.botToken,
    defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID_PROD || telegramConfig.defaultChatId,
  },
  test: {
    botToken: process.env.TELEGRAM_BOT_TOKEN_TEST || 'test_token',
    defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID_TEST || 'test_chat_id',
  },
};

/**
 * Obtiene la configuración según el entorno
 */
export function getEnvironmentConfig(env: string = process.env.NODE_ENV || 'development'): TelegramBotConfig {
  const envConfig = environmentConfigs[env as keyof typeof environmentConfigs] || environmentConfigs.development;
  
  return {
    ...telegramConfig,
    ...envConfig,
  };
}
