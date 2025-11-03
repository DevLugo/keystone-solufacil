import html2canvas from 'html2canvas';

/**
 * Captura un screenshot del elemento especificado usando html2canvas
 * @param elementId - ID del elemento a capturar
 * @returns Base64 string de la imagen capturada (comprimida)
 */
export async function captureTabScreenshot(elementId: string): Promise<string> {
  try {
    const element = document.getElementById(elementId);
    
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found`);
    }

    console.log('📸 Capturando screenshot de elemento:', elementId);

    // Capturar el elemento con configuración optimizada
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 0.8, // Reducir escala para menor tamaño (antes era 2)
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: Math.min(element.scrollWidth, 1600), // Limitar ancho máximo
      height: Math.min(element.scrollHeight, 2400), // Limitar alto máximo
    });

    console.log('📐 Tamaño del canvas:', canvas.width, 'x', canvas.height);

    // Comprimir la imagen usando JPEG con calidad reducida
    const compressedImage = canvas.toDataURL('image/jpeg', 0.6); // 60% de calidad
    
    // Calcular tamaño aproximado en MB
    const sizeInMB = (compressedImage.length * 0.75) / (1024 * 1024);
    console.log('📦 Tamaño del screenshot comprimido:', sizeInMB.toFixed(2), 'MB');

    // Si sigue siendo muy grande, comprimir más
    if (sizeInMB > 2) {
      console.warn('⚠️ Imagen muy grande, aplicando compresión adicional');
      return canvas.toDataURL('image/jpeg', 0.4); // 40% de calidad
    }

    return compressedImage;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
}

/**
 * Sube un screenshot a Cloudinary a través de la API
 * @param base64Image - Imagen en formato base64
 * @param filename - Nombre del archivo
 * @returns URL de la imagen en Cloudinary
 */
export async function uploadScreenshotToCloudinary(
  base64Image: string,
  filename: string
): Promise<string> {
  try {
    const response = await fetch('/api/upload-screenshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        filename: filename,
      }),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.url) {
      throw new Error('No URL returned from upload');
    }

    return data.url;
  } catch (error) {
    console.error('Error uploading screenshot to Cloudinary:', error);
    throw error;
  }
}

/**
 * Captura y sube un screenshot en un solo paso
 * @param elementId - ID del elemento a capturar
 * @param filename - Nombre del archivo (sin extensión)
 * @returns URL de la imagen en Cloudinary
 */
export async function captureAndUploadScreenshot(
  elementId: string,
  filename: string
): Promise<string> {
  const base64Image = await captureTabScreenshot(elementId);
  const cloudinaryUrl = await uploadScreenshotToCloudinary(base64Image, filename);
  return cloudinaryUrl;
}

/**
 * Genera un nombre de archivo único para screenshots
 * @param prefix - Prefijo para el nombre del archivo
 * @returns Nombre de archivo único
 */
export function generateScreenshotFilename(prefix: string = 'discrepancy'): string {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${random}`;
}

