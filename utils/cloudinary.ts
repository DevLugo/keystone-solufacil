import { v2 as cloudinary } from 'cloudinary';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export interface CloudinaryUploadResult {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  folder?: string;
  access_mode: string;
  original_filename: string;
}

export interface DocumentPhotoUploadOptions {
  personalDataId: string;
  documentType: 'INE' | 'ADDRESS_PROOF' | 'PROMISSORY_NOTE';
  loanId?: string;
  description?: string;
}

/**
 * Sube una imagen a Cloudinary con configuración específica para documentos personales
 */
export const uploadDocumentPhoto = async (
  file: Buffer | string,
  options: DocumentPhotoUploadOptions,
  originalFilename: string
): Promise<CloudinaryUploadResult> => {
  try {
    // Definir la carpeta basada en el tipo de documento
    const folderMap = {
      INE: 'personal-documents/ine',
      ADDRESS_PROOF: 'personal-documents/address-proof',
      PROMISSORY_NOTE: 'personal-documents/promissory-notes'
    };

    const folder = folderMap[options.documentType];
    
    // Generar un public_id único
    const timestamp = Date.now();
    const publicId = `${folder}/${options.personalDataId}_${timestamp}_${originalFilename.replace(/\.[^/.]+$/, "")}`;

    const uploadOptions = {
      public_id: publicId,
      folder: folder,
      resource_type: 'auto' as const,
      type: 'upload' as const,
      overwrite: false,
      // Transformaciones para optimización
      transformation: [
        {
          width: 1200,
          height: 1200,
          crop: 'limit',
          quality: 'auto:good',
          format: 'auto'
        }
      ],
      // Tags para organización
      tags: [
        'personal-document',
        options.documentType.toLowerCase(),
        `personal-data-${options.personalDataId}`,
        ...(options.loanId ? [`loan-${options.loanId}`] : [])
      ],
      // Metadata
      context: {
        personalDataId: options.personalDataId,
        documentType: options.documentType,
        ...(options.loanId && { loanId: options.loanId }),
        ...(options.description && { description: options.description }),
        uploadedAt: new Date().toISOString()
      }
    };

    const result = await cloudinary.uploader.upload(file, uploadOptions);
    
    console.log('✅ Imagen subida exitosamente a Cloudinary:', {
      publicId: result.public_id,
      url: result.secure_url,
      documentType: options.documentType,
      personalDataId: options.personalDataId
    });

    return result as CloudinaryUploadResult;
  } catch (error) {
    console.error('❌ Error al subir imagen a Cloudinary:', error);
    throw new Error(`Error al subir imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Elimina una imagen de Cloudinary
 */
export const deleteDocumentPhoto = async (publicId: string): Promise<void> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      console.log('✅ Imagen eliminada exitosamente de Cloudinary:', publicId);
    } else {
      console.warn('⚠️ No se pudo eliminar la imagen de Cloudinary:', publicId, result);
    }
  } catch (error) {
    console.error('❌ Error al eliminar imagen de Cloudinary:', error);
    throw new Error(`Error al eliminar imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Obtiene información de una imagen de Cloudinary
 */
export const getDocumentPhotoInfo = async (publicId: string) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    console.error('❌ Error al obtener información de imagen de Cloudinary:', error);
    throw new Error(`Error al obtener información de imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Lista todas las imágenes de un personalData específico
 */
export const listDocumentPhotosByPersonalData = async (personalDataId: string) => {
  try {
    const result = await cloudinary.search
      .expression(`tags:personal-data-${personalDataId}`)
      .sort_by([['created_at', 'desc']])
      .max_results(100)
      .execute();
    
    return result.resources;
  } catch (error) {
    console.error('❌ Error al listar imágenes de Cloudinary:', error);
    throw new Error(`Error al listar imágenes: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Genera una URL de transformación para mostrar miniaturas
 */
export const getDocumentPhotoThumbnail = (publicId: string, width = 200, height = 200): string => {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality: 'auto:good',
    format: 'auto',
    secure: true
  });
};

/**
 * Genera una URL optimizada para visualización
 */
export const getDocumentPhotoOptimized = (publicId: string, width = 800): string => {
  return cloudinary.url(publicId, {
    width,
    crop: 'scale',
    quality: 'auto:good',
    format: 'auto',
    secure: true
  });
};

export default cloudinary;