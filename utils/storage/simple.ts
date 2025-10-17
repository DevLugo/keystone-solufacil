/**
 * Versión simplificada del sistema de almacenamiento
 * Para uso directo en endpoints de API
 */

import { v2 as cloudinary } from 'cloudinary';
import { generateFolderPath } from '../folderStructure';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface SimpleUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  provider: string;
}

export interface SimpleUploadOptions {
  folder?: string;
  loan?: any;
  documentType?: string;
  customConfig?: any;
  metadata?: Record<string, any>;
}

/**
 * Función simplificada para subir documentos
 */
export async function simpleUploadDocument(
  file: File | string | Buffer,
  loan?: any,
  documentType?: string,
  options: SimpleUploadOptions = {}
): Promise<SimpleUploadResult> {
  try {
    // Validar que Cloudinary esté configurado
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary no está configurado. Verifica las variables de entorno.');
    }

    // Convertir archivo a base64
    let base64Data: string;
    
    if (typeof file === 'string') {
      if (file.startsWith('data:') || file.startsWith('http')) {
        base64Data = file;
      } else {
        throw new Error('Formato de archivo no válido');
      }
    } else if (Buffer.isBuffer(file)) {
      const base64 = file.toString('base64');
      base64Data = `data:image/jpeg;base64,${base64}`;
    } else {
      // Convertir File a base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const mimeType = file.type;
      base64Data = `data:${mimeType};base64,${base64}`;
    }

    // Determinar la carpeta de destino
    let targetFolder: string;
    
    if (options.folder) {
      targetFolder = options.folder;
    } else if (loan && documentType) {
      targetFolder = generateFolderPath(
        { loan, documentType },
        options.customConfig
      );
    } else {
      targetFolder = 'documentos-personales';
    }

    // Generar nombre personalizado del archivo: {id-cliente}-{tipo-documento}
    let customPublicId: string | undefined;
    if (loan && documentType) {
      const clientId = loan.borrower?.personalData?.id;
      if (clientId) {
        // Limpiar el tipo de documento para el nombre del archivo
        const cleanDocumentType = documentType.toLowerCase().replace(/[^a-z0-9]/g, '-');
        customPublicId = `${clientId}-${cleanDocumentType}`;
      }
    }

    // Preparar parámetros de Cloudinary
    const cloudinaryParams: any = {
      folder: targetFolder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ],
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      max_bytes: 10 * 1024 * 1024 // 10MB máximo
    };

    // Agregar public_id personalizado si está disponible
    if (customPublicId) {
      cloudinaryParams.public_id = customPublicId;
    }

    // Agregar metadata segura (solo strings y números)
    if (options.metadata) {
      const safeMetadata: Record<string, any> = {};
      Object.entries(options.metadata).forEach(([key, value]) => {
        // Solo agregar valores que sean strings o números
        if (typeof value === 'string' || typeof value === 'number') {
          safeMetadata[key] = value;
        }
      });
      
      // Agregar metadata segura a los parámetros
      Object.assign(cloudinaryParams, safeMetadata);
    }

    // Subir a Cloudinary
    const result = await new Promise<SimpleUploadResult>((resolve, reject) => {
      cloudinary.uploader.upload(
        base64Data,
        cloudinaryParams,
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              public_id: result.public_id,
              secure_url: result.secure_url,
              url: result.url,
              format: result.format,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              provider: 'cloudinary'
            });
          } else {
            reject(new Error('No se pudo subir la imagen'));
          }
        }
      );
    });

    return result;
  } catch (error) {
    console.error('Error al subir imagen:', error);
    throw new Error(`Error al subir la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * Función simplificada para eliminar documentos
 */
export async function simpleDeleteDocument(publicId: string): Promise<void> {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary no está configurado. Verifica las variables de entorno.');
    }

    await new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    throw new Error(`Error al eliminar la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * Función simplificada para obtener URLs
 */
export function simpleGetDocumentUrl(publicId: string, transformations?: {
  width?: number;
  height?: number;
  quality?: string;
  format?: string;
}): string {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary no está configurado. Verifica las variables de entorno.');
  }

  const transformationsArray = [];
  
  if (transformations?.width) transformationsArray.push(`w_${transformations.width}`);
  if (transformations?.height) transformationsArray.push(`h_${transformations.height}`);
  if (transformations?.quality) transformationsArray.push(`q_${transformations.quality}`);
  if (transformations?.format) transformationsArray.push(`f_${transformations.format}`);
  
  const transformationString = transformationsArray.length > 0 ? transformationsArray.join(',') + '/' : '';
  
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${transformationString}${publicId}`;
}
