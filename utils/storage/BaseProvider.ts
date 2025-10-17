/**
 * Clase base abstracta para proveedores de almacenamiento
 * Implementa el patrón Strategy
 */

import { StorageProvider, ProviderConfig, UploadResult, UploadOptions, DeleteOptions } from './types';

export abstract class BaseStorageProvider implements StorageProvider {
  protected config: ProviderConfig | null = null;
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Configurar el proveedor
   */
  configure(config: ProviderConfig): void {
    this.config = config;
    this.validateConfig(config);
  }

  /**
   * Validar configuración específica del proveedor
   */
  protected abstract validateConfig(config: ProviderConfig): void;

  /**
   * Implementación específica de subida
   */
  protected abstract performUpload(file: File | string | Buffer, options: UploadOptions): Promise<UploadResult>;

  /**
   * Implementación específica de eliminación
   */
  protected abstract performDelete(options: DeleteOptions): Promise<void>;

  /**
   * Implementación específica de URL
   */
  protected abstract performGetUrl(publicId: string, transformations?: any): string;

  /**
   * Método público para subir archivos
   */
  async upload(file: File | string | Buffer, options: UploadOptions): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error(`Proveedor ${this.name} no está configurado`);
    }

    try {
      const result = await this.performUpload(file, options);
      return {
        ...result,
        provider: this.name
      };
    } catch (error) {
      console.error(`Error al subir archivo con ${this.name}:`, error);
      throw new Error(`Error al subir archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Método público para eliminar archivos
   */
  async delete(options: DeleteOptions): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(`Proveedor ${this.name} no está configurado`);
    }

    try {
      await this.performDelete(options);
    } catch (error) {
      console.error(`Error al eliminar archivo con ${this.name}:`, error);
      throw new Error(`Error al eliminar archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Método público para obtener URLs
   */
  getUrl(publicId: string, transformations?: any): string {
    if (!this.isConfigured()) {
      throw new Error(`Proveedor ${this.name} no está configurado`);
    }

    return this.performGetUrl(publicId, transformations);
  }

  /**
   * Verificar si está configurado
   */
  isConfigured(): boolean {
    return this.config !== null && this.config.enabled;
  }

  /**
   * Obtener información del proveedor
   */
  getInfo(): { name: string; configured: boolean; features: string[] } {
    return {
      name: this.name,
      configured: this.isConfigured(),
      features: this.getFeatures()
    };
  }

  /**
   * Obtener características específicas del proveedor
   */
  protected abstract getFeatures(): string[];

  /**
   * Convertir archivo a base64 (método helper común)
   */
  protected async fileToBase64(file: File | string | Buffer): Promise<string> {
    if (typeof file === 'string') {
      if (file.startsWith('data:') || file.startsWith('http')) {
        return file;
      }
      throw new Error('Formato de archivo no válido');
    }

    if (Buffer.isBuffer(file)) {
      const base64 = file.toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    }

    // Convertir File a base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type;
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Validar archivo (método helper común)
   */
  protected validateFile(file: File | string | Buffer): void {
    if (typeof file === 'string') {
      if (!file.startsWith('data:') && !file.startsWith('http')) {
        throw new Error('Formato de archivo no válido');
      }
      return;
    }

    if (Buffer.isBuffer(file)) {
      return;
    }

    // Validar File
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('El archivo es demasiado grande (máximo 10MB)');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no permitido');
    }
  }
}
