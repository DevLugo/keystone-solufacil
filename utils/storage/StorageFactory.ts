/**
 * Factory para crear instancias de proveedores de almacenamiento
 * Implementa el patrón Factory
 */

import { StorageProvider, StorageFactory, SupportedProviders } from './types';
import { CloudinaryProvider } from './providers/CloudinaryProvider';
import { AwsS3Provider } from './providers/AwsS3Provider';

export class StorageProviderFactory implements StorageFactory {
  private providers: Map<string, new () => StorageProvider> = new Map();

  constructor() {
    this.registerDefaultProviders();
  }

  /**
   * Registrar proveedores por defecto
   */
  private registerDefaultProviders(): void {
    this.registerProvider('cloudinary', CloudinaryProvider);
    this.registerProvider('aws-s3', AwsS3Provider);
  }

  /**
   * Crear instancia de un proveedor
   */
  createProvider(providerName: string): StorageProvider {
    const ProviderClass = this.providers.get(providerName);
    
    if (!ProviderClass) {
      throw new Error(`Proveedor '${providerName}' no está registrado. Proveedores disponibles: ${this.getAvailableProviders().join(', ')}`);
    }

    try {
      return new ProviderClass();
    } catch (error) {
      throw new Error(`Error al crear proveedor '${providerName}': ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtener lista de proveedores disponibles
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Registrar un nuevo proveedor
   */
  registerProvider(name: string, providerClass: new () => StorageProvider): void {
    if (this.providers.has(name)) {
      console.warn(`Proveedor '${name}' ya está registrado. Sobrescribiendo...`);
    }

    this.providers.set(name, providerClass);
  }

  /**
   * Verificar si un proveedor está disponible
   */
  isProviderAvailable(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  /**
   * Obtener información de todos los proveedores
   */
  getProvidersInfo(): Array<{ name: string; available: boolean; features?: string[] }> {
    const info = [];
    
    for (const [name, ProviderClass] of this.providers) {
      try {
        const provider = new ProviderClass();
        const providerInfo = provider.getInfo();
        info.push({
          name,
          available: true,
          features: providerInfo.features
        });
      } catch (error) {
        info.push({
          name,
          available: false
        });
      }
    }

    return info;
  }
}

// Instancia singleton del factory
export const storageFactory = new StorageProviderFactory();
