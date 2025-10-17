/**
 * @deprecated Este archivo está deprecado. Usar el nuevo sistema de almacenamiento en utils/storage/
 * Se mantiene para compatibilidad hacia atrás
 */

import { 
  simpleUploadDocument,
  simpleDeleteDocument,
  simpleGetDocumentUrl,
  SimpleUploadResult,
  SimpleUploadOptions
} from './storage/simple';

// Interfaces para compatibilidad hacia atrás
export interface CloudinaryUploadResult extends SimpleUploadResult {
  public_id: string;
  secure_url: string;
}

export interface CloudinaryUploadOptions extends SimpleUploadOptions {
  folder?: string;
  loan?: any;
  documentType?: string;
  customConfig?: any;
}

/**
 * @deprecated Usar uploadDocument() del nuevo sistema
 */
export const uploadImageToCloudinary = async (
  file: File | string | Buffer,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> => {
  try {
    // Usar el sistema de almacenamiento simplificado
    const result = await simpleUploadDocument(file, options.loan, options.documentType || 'general', {
      customConfig: options.customConfig,
      metadata: options.metadata
    });

    // Convertir al formato de compatibilidad
    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      url: result.url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      provider: result.provider
    };
  } catch (error) {
    console.error('Error al subir imagen:', error);
    throw new Error('Error al subir la imagen. Por favor, inténtalo de nuevo.');
  }
};

/**
 * @deprecated Usar deleteDocument() del nuevo sistema
 */
export const deleteImageFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await simpleDeleteDocument(publicId);
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    throw new Error('Error al eliminar la imagen.');
  }
};

/**
 * Función de conveniencia para mantener compatibilidad con código existente
 * @deprecated Usar uploadImageToCloudinary con options en su lugar
 */
export const uploadImageToCloudinaryLegacy = async (
  file: File | string | Buffer,
  folder: string = 'documentos-personales'
): Promise<CloudinaryUploadResult> => {
  return uploadImageToCloudinary(file, { folder });
};

/**
 * Función específica para documentos personales con estructura automática
 */
export const uploadDocumentImage = async (
  file: File | string | Buffer,
  loan: any,
  documentType: string,
  customConfig?: FolderStructureConfig
): Promise<CloudinaryUploadResult> => {
  return uploadImageToCloudinary(file, {
    loan,
    documentType,
    customConfig
  });
};

/**
 * @deprecated Usar getDocumentUrl() del nuevo sistema
 */
export const getCloudinaryUrl = (publicId: string, options: {
  width?: number;
  height?: number;
  quality?: string;
  format?: string;
} = {}): string => {
  return simpleGetDocumentUrl(publicId, options);
};
