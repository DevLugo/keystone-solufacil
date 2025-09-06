/**
 * Utilidades para compresión de imágenes en el cliente
 * Reduce el uso de memoria y mejora la experiencia en dispositivos móviles
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
}

export interface CompressedImageResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Comprime una imagen usando Canvas API
 * @param file - Archivo de imagen original
 * @param options - Opciones de compresión
 * @returns Promise con el archivo comprimido y estadísticas
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    maxSizeKB = 500
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    if (!ctx) {
      reject(new Error('No se pudo obtener el contexto del canvas'));
      return;
    }

    img.onload = () => {
      try {
        // Calcular nuevas dimensiones manteniendo la proporción
        const { width: newWidth, height: newHeight } = calculateDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        );

        // Configurar canvas con las nuevas dimensiones
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Convertir a blob con compresión
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Error al comprimir la imagen'));
              return;
            }

            // Verificar si el tamaño es aceptable
            const sizeKB = blob.size / 1024;
            
            if (sizeKB <= maxSizeKB) {
              // Crear nuevo archivo con el blob comprimido
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });

              resolve({
                file: compressedFile,
                originalSize: file.size,
                compressedSize: blob.size,
                compressionRatio: Math.round((1 - blob.size / file.size) * 100)
              });
            } else {
              // Si aún es muy grande, reducir calidad y reintentar
              const newQuality = Math.max(0.1, quality * 0.7);
              canvas.toBlob(
                (retryBlob) => {
                  if (!retryBlob) {
                    reject(new Error('Error al comprimir la imagen en el segundo intento'));
                    return;
                  }

                  const retryFile = new File([retryBlob], file.name, {
                    type: file.type,
                    lastModified: Date.now()
                  });

                  resolve({
                    file: retryFile,
                    originalSize: file.size,
                    compressedSize: retryBlob.size,
                    compressionRatio: Math.round((1 - retryBlob.size / file.size) * 100)
                  });
                },
                file.type,
                newQuality
              );
            }
          },
          file.type,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Error al cargar la imagen'));
    };

    // Cargar imagen
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calcula las nuevas dimensiones manteniendo la proporción
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let { width, height } = { width: originalWidth, height: originalHeight };

  // Si la imagen es más pequeña que los límites, no redimensionar
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  // Calcular ratio de redimensionamiento
  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const ratio = Math.min(widthRatio, heightRatio);

  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio)
  };
}

/**
 * Verifica si un archivo es una imagen válida
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type);
}

/**
 * Obtiene el tamaño de archivo en formato legible
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Configuración por defecto para diferentes tipos de dispositivos
 */
export const COMPRESSION_PRESETS = {
  mobile: {
    maxWidth: 1280,
    maxHeight: 720,
    quality: 0.7,
    maxSizeKB: 300
  },
  tablet: {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    maxSizeKB: 500
  },
  desktop: {
    maxWidth: 2560,
    maxHeight: 1440,
    quality: 0.9,
    maxSizeKB: 1000
  }
};

/**
 * Detecta el tipo de dispositivo y retorna la configuración apropiada
 */
export function getCompressionPreset(): CompressionOptions {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    return COMPRESSION_PRESETS.mobile;
  } else if (/tablet|ipad/i.test(userAgent)) {
    return COMPRESSION_PRESETS.tablet;
  } else {
    return COMPRESSION_PRESETS.desktop;
  }
}
