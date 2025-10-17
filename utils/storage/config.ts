/**
 * Configuración de proveedores de almacenamiento
 */

import { storageManager } from './StorageManager';
import { ProviderConfig, SupportedProviders } from './types';

// Configuraciones por defecto basadas en variables de entorno
export const DEFAULT_CONFIGS: Record<SupportedProviders, ProviderConfig> = {
  'cloudinary': {
    name: 'cloudinary',
    enabled: true,
    credentials: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
      api_key: process.env.CLOUDINARY_API_KEY || '',
      api_secret: process.env.CLOUDINARY_API_SECRET || ''
    },
    settings: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      defaultQuality: 'auto:good',
      defaultFormat: 'auto'
    }
  },
  'aws-s3': {
    name: 'aws-s3',
    enabled: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET || ''
    },
    settings: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      defaultRegion: 'us-east-1'
    }
  },
  'google-cloud': {
    name: 'google-cloud',
    enabled: false,
    credentials: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE || '',
      bucket: process.env.GOOGLE_CLOUD_BUCKET || ''
    },
    settings: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
  },
  'azure-blob': {
    name: 'azure-blob',
    enabled: false,
    credentials: {
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      containerName: process.env.AZURE_STORAGE_CONTAINER || ''
    },
    settings: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
  },
  'local': {
    name: 'local',
    enabled: false,
    credentials: {
      uploadPath: process.env.LOCAL_UPLOAD_PATH || './uploads'
    },
    settings: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
  }
};

/**
 * Inicializar el proveedor por defecto
 */
export function initializeStorageProvider(providerName: SupportedProviders = 'cloudinary'): void {
  try {
    const config = DEFAULT_CONFIGS[providerName];
    
    if (!config.enabled) {
      throw new Error(`Proveedor '${providerName}' está deshabilitado`);
    }

    // Verificar que las credenciales estén presentes
    const missingCredentials = Object.entries(config.credentials)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingCredentials.length > 0) {
      throw new Error(`Faltan credenciales para '${providerName}': ${missingCredentials.join(', ')}`);
    }

    // Configurar el proveedor
    storageManager.configureProvider(providerName, config);
    storageManager.setActiveProvider(providerName);
    
    console.log(`✅ Proveedor de almacenamiento inicializado: ${providerName}`);
  } catch (error) {
    console.error(`❌ Error al inicializar proveedor '${providerName}':`, error);
    throw error;
  }
}

/**
 * Cambiar el proveedor activo
 */
export function switchStorageProvider(providerName: SupportedProviders): void {
  try {
    const config = DEFAULT_CONFIGS[providerName];
    
    if (!config.enabled) {
      throw new Error(`Proveedor '${providerName}' está deshabilitado`);
    }

    // Verificar credenciales
    const missingCredentials = Object.entries(config.credentials)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingCredentials.length > 0) {
      throw new Error(`Faltan credenciales para '${providerName}': ${missingCredentials.join(', ')}`);
    }

    // Cambiar proveedor
    storageManager.configureProvider(providerName, config);
    storageManager.setActiveProvider(providerName);
    
    console.log(`🔄 Proveedor cambiado a: ${providerName}`);
  } catch (error) {
    console.error(`❌ Error al cambiar proveedor a '${providerName}':`, error);
    throw error;
  }
}

/**
 * Obtener información del proveedor activo
 */
export function getActiveProviderInfo() {
  return storageManager.getActiveProviderInfo();
}

/**
 * Obtener información de todos los proveedores
 */
export function getAllProvidersInfo() {
  return storageManager.getAllProvidersInfo();
}

/**
 * Verificar si el sistema está listo
 */
export function isStorageReady(): boolean {
  return storageManager.isReady();
}

/**
 * Configuración personalizada de proveedor
 */
export function configureCustomProvider(
  providerName: SupportedProviders, 
  customConfig: Partial<ProviderConfig>
): void {
  const baseConfig = DEFAULT_CONFIGS[providerName];
  const mergedConfig: ProviderConfig = {
    ...baseConfig,
    ...customConfig,
    credentials: {
      ...baseConfig.credentials,
      ...customConfig.credentials
    },
    settings: {
      ...baseConfig.settings,
      ...customConfig.settings
    }
  };

  storageManager.configureProvider(providerName, mergedConfig);
  storageManager.setActiveProvider(providerName);
  
  console.log(`✅ Proveedor personalizado configurado: ${providerName}`);
}
