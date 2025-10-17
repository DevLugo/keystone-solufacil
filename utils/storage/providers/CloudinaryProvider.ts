/**
 * Implementación de Cloudinary usando el patrón Strategy
 */

import { v2 as cloudinary } from 'cloudinary';
import { BaseStorageProvider } from '../BaseProvider';
import { ProviderConfig, UploadResult, UploadOptions, DeleteOptions } from '../types';
import { generateFolderPath } from '../../folderStructure';

export class CloudinaryProvider extends BaseStorageProvider {
  constructor() {
    super('cloudinary');
  }

  protected validateConfig(config: ProviderConfig): void {
    const required = ['cloud_name', 'api_key', 'api_secret'];
    const missing = required.filter(key => !config.credentials[key]);
    
    if (missing.length > 0) {
      throw new Error(`Cloudinary: Faltan credenciales: ${missing.join(', ')}`);
    }
  }

  protected getFeatures(): string[] {
    return [
      'image-optimization',
      'automatic-format-selection',
      'on-the-fly-transformations',
      'responsive-images',
      'video-support',
      'ai-powered-features'
    ];
  }

  protected async performUpload(file: File | string | Buffer, options: UploadOptions): Promise<UploadResult> {
    this.validateFile(file);

    // Configurar Cloudinary si no está configurado
    if (!cloudinary.config().cloud_name) {
      this.configureCloudinary();
    }

    // Convertir archivo a base64
    const base64Data = await this.fileToBase64(file);

    // Determinar carpeta de destino
    const targetFolder = this.determineFolder(options);

    // Generar nombre personalizado del archivo: {id-cliente}-{tipo-documento}
    let customPublicId: string | undefined;
    if (options.loan && options.documentType) {
      const clientId = options.loan.borrower?.personalData?.id;
      if (clientId) {
        // Limpiar el tipo de documento para el nombre del archivo
        const cleanDocumentType = options.documentType.toLowerCase().replace(/[^a-z0-9]/g, '-');
        customPublicId = `${clientId}-${cleanDocumentType}`;
      }
    }

    // Configurar transformaciones
    const transformations = this.buildTransformations(options.transformations);

    // Subir a Cloudinary
    const result = await new Promise<UploadResult>((resolve, reject) => {
      const uploadParams: any = {
        folder: targetFolder,
        resource_type: 'image',
        transformation: transformations,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        max_bytes: 10 * 1024 * 1024, // 10MB máximo
        ...options.metadata
      };

      // Agregar public_id personalizado si está disponible
      if (customPublicId) {
        uploadParams.public_id = customPublicId;
      }

      cloudinary.uploader.upload(
        base64Data,
        uploadParams,
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              publicId: result.public_id,
              secureUrl: result.secure_url,
              url: result.url,
              format: result.format,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              provider: this.name,
              metadata: {
                version: result.version,
                signature: result.signature,
                resource_type: result.resource_type
              }
            });
          } else {
            reject(new Error('No se pudo subir la imagen'));
          }
        }
      );
    });

    return result;
  }

  protected async performDelete(options: DeleteOptions): Promise<void> {
    // Configurar Cloudinary si no está configurado
    if (!cloudinary.config().cloud_name) {
      this.configureCloudinary();
    }

    await new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(options.publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  protected performGetUrl(publicId: string, transformations?: any): string {
    // Configurar Cloudinary si no está configurado
    if (!cloudinary.config().cloud_name) {
      this.configureCloudinary();
    }

    const transformationsArray = [];
    
    if (transformations?.width) transformationsArray.push(`w_${transformations.width}`);
    if (transformations?.height) transformationsArray.push(`h_${transformations.height}`);
    if (transformations?.quality) transformationsArray.push(`q_${transformations.quality}`);
    if (transformations?.format) transformationsArray.push(`f_${transformations.format}`);
    
    const transformationString = transformationsArray.length > 0 ? transformationsArray.join(',') + '/' : '';
    
    return `https://res.cloudinary.com/${this.config!.credentials.cloud_name}/image/upload/${transformationString}${publicId}`;
  }

  /**
   * Configurar Cloudinary con las credenciales
   */
  private configureCloudinary(): void {
    if (!this.config) {
      throw new Error('Cloudinary no está configurado');
    }

    cloudinary.config({
      cloud_name: this.config.credentials.cloud_name,
      api_key: this.config.credentials.api_key,
      api_secret: this.config.credentials.api_secret,
    });
  }

  /**
   * Determinar la carpeta de destino
   */
  private determineFolder(options: UploadOptions): string {
    if (options.folder) {
      return options.folder;
    }

    if (options.loan && options.documentType) {
      return generateFolderPath(
        { loan: options.loan, documentType: options.documentType },
        options.customConfig
      );
    }

    return 'documentos-personales';
  }

  /**
   * Construir transformaciones de Cloudinary
   */
  private buildTransformations(transformations?: UploadOptions['transformations']) {
    const result = [];

    if (transformations?.quality) {
      result.push({ quality: transformations.quality });
    } else {
      result.push({ quality: 'auto:good' });
    }

    if (transformations?.format) {
      result.push({ fetch_format: transformations.format });
    } else {
      result.push({ fetch_format: 'auto' });
    }

    if (transformations?.width) {
      result.push({ width: transformations.width });
    }

    if (transformations?.height) {
      result.push({ height: transformations.height });
    }

    return result;
  }
}
