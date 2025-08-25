import { v2 as cloudinary } from 'cloudinary';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

export const uploadImageToCloudinary = async (
  file: File | string | Buffer,
  folder: string = 'documentos-personales'
): Promise<CloudinaryUploadResult> => {
  try {
    // Si es un archivo File, convertirlo a base64
    let base64Data: string;
    
    if (typeof file === 'string') {
      // Si ya es una URL o base64, usarlo directamente
      if (file.startsWith('data:') || file.startsWith('http')) {
        base64Data = file;
      } else {
        throw new Error('Formato de archivo no válido');
      }
    } else if (Buffer.isBuffer(file)) {
      // Si es un Buffer, convertirlo a base64
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

    // Subir a Cloudinary
    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      cloudinary.uploader.upload(
        base64Data,
        {
          folder: folder,
          resource_type: 'image',
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ],
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
          max_bytes: 10 * 1024 * 1024, // 10MB máximo
        },
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
            });
          } else {
            reject(new Error('No se pudo subir la imagen'));
          }
        }
      );
    });

    return result;
  } catch (error) {
    console.error('Error al subir imagen a Cloudinary:', error);
    throw new Error('Error al subir la imagen. Por favor, inténtalo de nuevo.');
  }
};

export const deleteImageFromCloudinary = async (publicId: string): Promise<void> => {
  try {
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
    console.error('Error al eliminar imagen de Cloudinary:', error);
    throw new Error('Error al eliminar la imagen.');
  }
};

export const getCloudinaryUrl = (publicId: string, options: {
  width?: number;
  height?: number;
  quality?: string;
  format?: string;
} = {}): string => {
  const transformations = [];
  
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);
  
  const transformationString = transformations.length > 0 ? transformations.join(',') + '/' : '';
  
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${transformationString}${publicId}`;
};
