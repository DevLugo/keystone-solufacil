/**
 * Tipos e interfaces para el sistema de almacenamiento en la nube
 * Patrón Strategy para intercambiar entre proveedores
 */

export interface UploadResult {
  publicId: string;
  secureUrl: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  provider: string;
  metadata?: Record<string, any>;
}

export interface UploadOptions {
  folder?: string;
  loan?: any;
  documentType?: string;
  customConfig?: any;
  transformations?: {
    quality?: string;
    format?: string;
    width?: number;
    height?: number;
  };
  metadata?: Record<string, any>;
}

export interface DeleteOptions {
  publicId: string;
  provider?: string;
}

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  credentials: Record<string, string>;
  settings?: Record<string, any>;
}

export interface StorageProvider {
  /**
   * Nombre del proveedor
   */
  readonly name: string;

  /**
   * Configurar el proveedor con credenciales
   */
  configure(config: ProviderConfig): void;

  /**
   * Subir un archivo
   */
  upload(file: File | string | Buffer, options: UploadOptions): Promise<UploadResult>;

  /**
   * Eliminar un archivo
   */
  delete(options: DeleteOptions): Promise<void>;

  /**
   * Obtener URL de una imagen con transformaciones
   */
  getUrl(publicId: string, transformations?: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  }): string;

  /**
   * Verificar si el proveedor está configurado correctamente
   */
  isConfigured(): boolean;

  /**
   * Obtener información del proveedor
   */
  getInfo(): {
    name: string;
    configured: boolean;
    features: string[];
  };
}

export interface StorageFactory {
  /**
   * Crear instancia de un proveedor
   */
  createProvider(providerName: string): StorageProvider;

  /**
   * Obtener lista de proveedores disponibles
   */
  getAvailableProviders(): string[];

  /**
   * Registrar un nuevo proveedor
   */
  registerProvider(name: string, providerClass: new () => StorageProvider): void;
}

export type SupportedProviders = 'cloudinary' | 'aws-s3' | 'google-cloud' | 'azure-blob' | 'local';

export interface StorageManager {
  /**
   * Configurar el proveedor activo
   */
  configureProvider(providerName: SupportedProviders, config: ProviderConfig): void;

  /**
   * Cambiar el proveedor activo
   */
  setActiveProvider(providerName: SupportedProviders): void;

  /**
   * Obtener el proveedor activo
   */
  getActiveProvider(): StorageProvider;

  /**
   * Subir archivo usando el proveedor activo
   */
  upload(file: File | string | Buffer, options: UploadOptions): Promise<UploadResult>;

  /**
   * Eliminar archivo usando el proveedor activo
   */
  delete(options: DeleteOptions): Promise<void>;

  /**
   * Obtener URL de imagen
   */
  getUrl(publicId: string, transformations?: any): string;
}
