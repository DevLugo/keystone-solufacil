/**
 * StorageManager - Facade para manejar proveedores de almacenamiento
 * Implementa el patrón Facade y Singleton
 */

import { StorageManager, StorageProvider, ProviderConfig, UploadResult, UploadOptions, DeleteOptions, SupportedProviders } from './types';
import { storageFactory } from './StorageFactory';

export class DocumentStorageManager implements StorageManager {
  private static instance: DocumentStorageManager;
  private activeProvider: StorageProvider | null = null;
  private activeProviderName: SupportedProviders | null = null;

  private constructor() {
    // Constructor privado para Singleton
  }

  /**
   * Obtener instancia singleton
   */
  public static getInstance(): DocumentStorageManager {
    if (!DocumentStorageManager.instance) {
      DocumentStorageManager.instance = new DocumentStorageManager();
    }
    return DocumentStorageManager.instance;
  }

  /**
   * Configurar el proveedor activo
   */
  configureProvider(providerName: SupportedProviders, config: ProviderConfig): void {
    try {
      const provider = storageFactory.createProvider(providerName);
      provider.configure(config);
      
      this.activeProvider = provider;
      this.activeProviderName = providerName;
      
      console.log(`✅ Proveedor '${providerName}' configurado correctamente`);
    } catch (error) {
      console.error(`❌ Error al configurar proveedor '${providerName}':`, error);
      throw error;
    }
  }

  /**
   * Cambiar el proveedor activo
   */
  setActiveProvider(providerName: SupportedProviders): void {
    if (!storageFactory.isProviderAvailable(providerName)) {
      throw new Error(`Proveedor '${providerName}' no está disponible. Proveedores disponibles: ${storageFactory.getAvailableProviders().join(', ')}`);
    }

    this.activeProviderName = providerName;
    this.activeProvider = null; // Se creará cuando se use
    console.log(`🔄 Proveedor activo cambiado a: ${providerName}`);
  }

  /**
   * Obtener el proveedor activo
   */
  getActiveProvider(): StorageProvider {
    if (!this.activeProviderName) {
      throw new Error('No hay proveedor activo configurado');
    }

    if (!this.activeProvider) {
      this.activeProvider = storageFactory.createProvider(this.activeProviderName);
    }

    return this.activeProvider;
  }

  /**
   * Subir archivo usando el proveedor activo
   */
  async upload(file: File | string | Buffer, options: UploadOptions): Promise<UploadResult> {
    const provider = this.getActiveProvider();
    
    if (!provider.isConfigured()) {
      throw new Error(`Proveedor '${this.activeProviderName}' no está configurado. Usa configureProvider() primero.`);
    }

    console.log(`📤 Subiendo archivo con proveedor: ${this.activeProviderName}`);
    return await provider.upload(file, options);
  }

  /**
   * Eliminar archivo usando el proveedor activo
   */
  async delete(options: DeleteOptions): Promise<void> {
    const provider = this.getActiveProvider();
    
    if (!provider.isConfigured()) {
      throw new Error(`Proveedor '${this.activeProviderName}' no está configurado. Usa configureProvider() primero.`);
    }

    console.log(`🗑️ Eliminando archivo con proveedor: ${this.activeProviderName}`);
    await provider.delete(options);
  }

  /**
   * Obtener URL de imagen
   */
  getUrl(publicId: string, transformations?: any): string {
    const provider = this.getActiveProvider();
    
    if (!provider.isConfigured()) {
      throw new Error(`Proveedor '${this.activeProviderName}' no está configurado. Usa configureProvider() primero.`);
    }

    return provider.getUrl(publicId, transformations);
  }

  /**
   * Obtener información del proveedor activo
   */
  getActiveProviderInfo(): { name: string; configured: boolean; features: string[] } {
    if (!this.activeProviderName) {
      return {
        name: 'ninguno',
        configured: false,
        features: []
      };
    }

    const provider = this.getActiveProvider();
    return provider.getInfo();
  }

  /**
   * Obtener información de todos los proveedores disponibles
   */
  getAllProvidersInfo(): Array<{ name: string; available: boolean; features?: string[] }> {
    return storageFactory.getProvidersInfo();
  }

  /**
   * Verificar si hay un proveedor activo y configurado
   */
  isReady(): boolean {
    try {
      const provider = this.getActiveProvider();
      return provider.isConfigured();
    } catch {
      return false;
    }
  }

  /**
   * Obtener nombre del proveedor activo
   */
  getActiveProviderName(): SupportedProviders | null {
    return this.activeProviderName;
  }
}

// Instancia singleton exportada
export const storageManager = DocumentStorageManager.getInstance();
