/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */

import React, { useState, useRef } from 'react';
import { Button } from '@keystone-ui/button';
import { LoadingDots } from '@keystone-ui/loading';
import { FaUpload, FaCamera, FaTrash, FaEye } from 'react-icons/fa';

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string, publicId: string) => void;
  onImageRemove?: () => void;
  currentImageUrl?: string;
  currentPublicId?: string;
  disabled?: boolean;
  placeholder?: string;
}

interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUpload,
  onImageRemove,
  currentImageUrl,
  currentPublicId,
  disabled = false,
  placeholder = 'Subir imagen'
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    // Validar tamaño (10MB máximo)
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 10MB');
      return;
    }

    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Subir a Cloudinary
    try {
      setIsUploading(true);
      
      // Subir a Cloudinary a través del endpoint de API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'documentos-personales');

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al subir la imagen');
      }

      const result: CloudinaryUploadResult = await response.json();
      
      // Llamar al callback con la URL y public_id
      onImageUpload(result.secure_url, result.public_id);
      
    } catch (error) {
      console.error('Error al subir imagen:', error);
      alert('Error al subir la imagen. Por favor, inténtalo de nuevo.');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    setShowPreview(false);
    if (onImageRemove) {
      onImageRemove();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCapturePhoto = () => {
    // Implementar captura de foto con la cámara
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          // Aquí se implementaría la captura de foto
          alert('Funcionalidad de captura de foto en desarrollo');
        })
        .catch((error) => {
          console.error('Error al acceder a la cámara:', error);
          alert('No se pudo acceder a la cámara');
        });
    } else {
      alert('Tu navegador no soporta la captura de fotos');
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Input de archivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || isUploading}
      />

      {/* Preview de imagen */}
      {previewUrl && (
        <div style={{
          marginBottom: '12px',
          position: 'relative',
          display: 'inline-block'
        }}>
          <img
            src={previewUrl}
            alt="Preview"
            style={{
              maxWidth: '200px',
              maxHeight: '150px',
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
              cursor: 'pointer'
            }}
            onClick={() => setShowPreview(!showPreview)}
          />
          
          {/* Botones de acción sobre la imagen */}
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            display: 'flex',
            gap: '4px'
          }}>
            <Button
              tone="passive"
              size="small"
              onClick={() => setShowPreview(!showPreview)}
              style={{ padding: '4px', minWidth: 'auto' }}
              title="Ver imagen"
            >
              <FaEye size={10} />
            </Button>
            <Button
              tone="negative"
              size="small"
              onClick={handleRemoveImage}
              style={{ padding: '4px', minWidth: 'auto' }}
              title="Eliminar imagen"
            >
              <FaTrash size={10} />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de preview */}
      {showPreview && previewUrl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh'
          }}>
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                borderRadius: '8px'
              }}
            />
            <Button
              tone="negative"
              size="small"
              onClick={() => setShowPreview(false)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                padding: '8px 12px'
              }}
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <Button
          tone="active"
          size="small"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          style={{ fontSize: '12px' }}
        >
          {isUploading ? (
            <LoadingDots label="Subiendo" size="small" />
          ) : (
            <>
              <FaUpload size={12} style={{ marginRight: '6px' }} />
              {placeholder}
            </>
          )}
        </Button>

        <Button
          tone="passive"
          size="small"
          onClick={handleCapturePhoto}
          disabled={disabled || isUploading}
          style={{ fontSize: '12px' }}
        >
          <FaCamera size={12} style={{ marginRight: '6px' }} />
          Cámara
        </Button>

        {previewUrl && (
          <Button
            tone="negative"
            size="small"
            onClick={handleRemoveImage}
            disabled={disabled || isUploading}
            style={{ fontSize: '12px' }}
          >
            <FaTrash size={12} style={{ marginRight: '6px' }} />
            Eliminar
          </Button>
        )}
      </div>

      {/* Información de la imagen actual */}
      {currentImageUrl && !previewUrl && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#F0F9FF',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#6B7280'
        }}>
          Imagen actual: {currentImageUrl.split('/').pop()}
        </div>
      )}
    </div>
  );
};
