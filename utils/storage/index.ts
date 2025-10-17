/**
 * Sistema de almacenamiento en la nube con patrón Strategy
 * Punto de entrada principal para el sistema de almacenamiento
 */

// Exportar tipos
export * from './types';

// Exportar clases principales
export { BaseStorageProvider } from './BaseProvider';
export { StorageProviderFactory, storageFactory } from './StorageFactory';
export { DocumentStorageManager, storageManager } from './StorageManager';

// Exportar proveedores
export { CloudinaryProvider } from './providers/CloudinaryProvider';
export { AwsS3Provider } from './providers/AwsS3Provider';

// Exportar configuración y utilidades
export {
  DEFAULT_CONFIGS,
  initializeStorageProvider,
  switchStorageProvider,
  getActiveProviderInfo,
  getAllProvidersInfo,
  isStorageReady,
  configureCustomProvider
} from './config';

// Re-exportar funciones de estructura de carpetas para compatibilidad
export {
  generateFolderPath,
  getDocumentFolderPath,
  FOLDER_CONFIGS,
  ACTIVE_CONFIG
} from '../folderStructure';

/**
 * Funciones de conveniencia para uso directo
 */

/**
 * Subir documento con el proveedor activo
 */
export async function uploadDocument(
  file: File | string | Buffer,
  loan: any,
  documentType: string,
  options?: {
    customConfig?: any;
    transformations?: any;
    metadata?: Record<string, any>;
  }
) {
  // Asegurar que el sistema esté inicializado
  if (!storageManager.isReady()) {
    try {
      initializeWithCloudinary();
    } catch (error) {
      console.error('Error al inicializar sistema de almacenamiento:', error);
      throw new Error('Sistema de almacenamiento no está configurado');
    }
  }

  return await storageManager.upload(file, {
    loan,
    documentType,
    customConfig: options?.customConfig,
    transformations: options?.transformations,
    metadata: options?.metadata
  });
}

/**
 * Eliminar documento con el proveedor activo
 */
export async function deleteDocument(publicId: string) {
  // Asegurar que el sistema esté inicializado
  if (!storageManager.isReady()) {
    try {
      initializeWithCloudinary();
    } catch (error) {
      console.error('Error al inicializar sistema de almacenamiento:', error);
      throw new Error('Sistema de almacenamiento no está configurado');
    }
  }

  return await storageManager.delete({ publicId });
}

/**
 * Obtener URL de documento con transformaciones
 */
export function getDocumentUrl(publicId: string, transformations?: any) {
  // Asegurar que el sistema esté inicializado
  if (!storageManager.isReady()) {
    try {
      initializeWithCloudinary();
    } catch (error) {
      console.error('Error al inicializar sistema de almacenamiento:', error);
      throw new Error('Sistema de almacenamiento no está configurado');
    }
  }

  return storageManager.getUrl(publicId, transformations);
}

/**
 * Inicializar sistema con Cloudinary (por defecto)
 */
export function initializeWithCloudinary() {
  return initializeStorageProvider('cloudinary');
}

/**
 * Inicializar sistema con AWS S3
 */
export function initializeWithAwsS3() {
  return initializeStorageProvider('aws-s3');
}

/**
 * Verificar estado del sistema
 */
export function getSystemStatus() {
  return {
    ready: isStorageReady(),
    activeProvider: getActiveProviderInfo(),
    availableProviders: getAllProvidersInfo()
  };
}
