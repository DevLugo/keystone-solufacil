/**
 * Implementación de AWS S3 usando el patrón Strategy
 * Ejemplo de cómo agregar otros proveedores
 */

import { BaseStorageProvider } from '../BaseProvider';
import { ProviderConfig, UploadResult, UploadOptions, DeleteOptions } from '../types';
import { generateFolderPath } from '../../folderStructure';

export class AwsS3Provider extends BaseStorageProvider {
  private s3Client: any = null;
  private bucketName: string = '';

  constructor() {
    super('aws-s3');
  }

  protected validateConfig(config: ProviderConfig): void {
    const required = ['accessKeyId', 'secretAccessKey', 'region', 'bucket'];
    const missing = required.filter(key => !config.credentials[key]);
    
    if (missing.length > 0) {
      throw new Error(`AWS S3: Faltan credenciales: ${missing.join(', ')}`);
    }

    this.bucketName = config.credentials.bucket;
  }

  protected getFeatures(): string[] {
    return [
      'high-availability',
      'global-distribution',
      'versioning',
      'lifecycle-management',
      'encryption',
      'access-logs'
    ];
  }

  protected async performUpload(file: File | string | Buffer, options: UploadOptions): Promise<UploadResult> {
    this.validateFile(file);
    await this.initializeS3Client();

    // Determinar la clave del objeto
    const objectKey = this.determineObjectKey(options);

    // Convertir archivo a buffer si es necesario
    const buffer = await this.fileToBuffer(file);

    // Subir a S3
    const uploadParams = {
      Bucket: this.bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: this.getContentType(file),
      ...options.metadata
    };

    try {
      const result = await this.s3Client.upload(uploadParams).promise();
      
      return {
        publicId: objectKey,
        secureUrl: result.Location,
        url: result.Location,
        format: this.getFileFormat(file),
        width: 0, // S3 no proporciona dimensiones automáticamente
        height: 0,
        bytes: buffer.length,
        provider: this.name,
        metadata: {
          etag: result.ETag,
          version: result.VersionId
        }
      };
    } catch (error) {
      throw new Error(`Error al subir a S3: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  protected async performDelete(options: DeleteOptions): Promise<void> {
    await this.initializeS3Client();

    const deleteParams = {
      Bucket: this.bucketName,
      Key: options.publicId
    };

    try {
      await this.s3Client.deleteObject(deleteParams).promise();
    } catch (error) {
      throw new Error(`Error al eliminar de S3: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  protected performGetUrl(publicId: string, transformations?: any): string {
    // Para S3, las transformaciones requerirían un servicio adicional como CloudFront
    // Por ahora, devolvemos la URL directa
    const region = this.config?.credentials.region || 'us-east-1';
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${publicId}`;
  }

  /**
   * Inicializar cliente S3
   */
  private async initializeS3Client(): Promise<void> {
    if (this.s3Client) return;

    try {
      // Importación dinámica para evitar errores si AWS SDK no está instalado
      const AWS = await import('aws-sdk');
      
      this.s3Client = new AWS.S3({
        accessKeyId: this.config!.credentials.accessKeyId,
        secretAccessKey: this.config!.credentials.secretAccessKey,
        region: this.config!.credentials.region
      });
    } catch (error) {
      throw new Error('AWS SDK no está instalado. Ejecuta: npm install aws-sdk');
    }
  }

  /**
   * Determinar la clave del objeto en S3
   */
  private determineObjectKey(options: UploadOptions): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);

    if (options.folder) {
      return `${options.folder}/${timestamp}-${randomId}`;
    }

    if (options.loan && options.documentType) {
      const folderPath = generateFolderPath(
        { loan: options.loan, documentType: options.documentType },
        options.customConfig
      );
      return `${folderPath}/${timestamp}-${randomId}`;
    }

    return `documentos-personales/${timestamp}-${randomId}`;
  }

  /**
   * Convertir archivo a buffer
   */
  private async fileToBuffer(file: File | string | Buffer): Promise<Buffer> {
    if (Buffer.isBuffer(file)) {
      return file;
    }

    if (typeof file === 'string') {
      if (file.startsWith('data:')) {
        const base64Data = file.split(',')[1];
        return Buffer.from(base64Data, 'base64');
      }
      throw new Error('URLs no soportadas en S3');
    }

    // File object
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Obtener tipo de contenido
   */
  private getContentType(file: File | string | Buffer): string {
    if (typeof file === 'string') {
      return 'image/jpeg'; // Por defecto
    }

    if (Buffer.isBuffer(file)) {
      return 'image/jpeg'; // Por defecto
    }

    return file.type || 'image/jpeg';
  }

  /**
   * Obtener formato del archivo
   */
  private getFileFormat(file: File | string | Buffer): string {
    if (typeof file === 'string') {
      return 'jpg'; // Por defecto
    }

    if (Buffer.isBuffer(file)) {
      return 'jpg'; // Por defecto
    }

    const type = file.type;
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
    if (type.includes('png')) return 'png';
    if (type.includes('gif')) return 'gif';
    if (type.includes('webp')) return 'webp';
    
    return 'jpg'; // Por defecto
  }
}
