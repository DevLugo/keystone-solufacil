import { NextApiRequest, NextApiResponse } from 'next';
import { v2 as cloudinary } from 'cloudinary';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!filename) {
      return res.status(400).json({ error: 'No filename provided' });
    }

    console.log(`📤 Uploading screenshot: ${filename}`);

    // Subir imagen a Cloudinary
    const result = await cloudinary.uploader.upload(image, {
      folder: 'discrepancies',
      public_id: filename,
      resource_type: 'image',
      transformation: [
        { width: 1920, crop: 'limit' }, // Limitar ancho máximo
        { quality: 'auto:good' }, // Calidad automática buena
      ],
    });

    console.log(`✅ Screenshot uploaded: ${result.secure_url}`);

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error('❌ Error uploading screenshot:', error);
    return res.status(500).json({
      error: 'Failed to upload screenshot',
      details: error.message,
    });
  }
}

// Configuración para manejar archivos grandes
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Permitir hasta 10MB para screenshots
    },
  },
};

