/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx, Box, Text } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput, Select } from '@keystone-ui/fields';
import { FaTimes, FaUpload, FaCheck } from 'react-icons/fa';
import { ImageUploader } from './ImageUploader';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: {
    title: string;
    description: string;
    photoUrl: string;
    publicId: string;
    documentType: 'INE' | 'DOMICILIO' | 'PAGARE';
    personalDataId: string;
    loanId: string;
  }) => void;
  documentType: 'INE' | 'DOMICILIO' | 'PAGARE';
  personType: 'TITULAR' | 'AVAL';
  personalDataId: string;
  loanId: string;
  personName: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  documentType,
  personType,
  personalDataId,
  loanId,
  personName
}) => {
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [publicId, setPublicId] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'INE': return 'INE';
      case 'DOMICILIO': return 'Comprobante de Domicilio';
      case 'PAGARE': return 'Pagaré';
      default: return type;
    }
  };

  const getPersonLabel = (personType: string) => {
    return personType === 'TITULAR' ? 'Titular' : 'Aval';
  };

  const handleImageUpload = (url: string, id: string) => {
    setPhotoUrl(url);
    setPublicId(id);
  };

  const handleSubmit = async () => {
    if (!photoUrl || !publicId) {
      alert('Por favor sube una imagen del documento');
      return;
    }

    setIsUploading(true);
    
    try {
      // Generar título automáticamente
      const autoTitle = `${getTypeLabel(documentType)} de ${personName}`;
      
      await onUpload({
        title: autoTitle,
        description: description.trim(),
        photoUrl,
        publicId,
        documentType,
        personalDataId,
        loanId
      });
      
      // Limpiar formulario
      setTitle('');
      setDescription('');
      setPhotoUrl('');
      setPublicId('');
      onClose();
    } catch (error) {
      console.error('Error al subir documento:', error);
      alert('Error al subir el documento. Por favor, inténtalo de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return; // No permitir cerrar mientras sube
    
    setDescription('');
    setPhotoUrl('');
    setPublicId('');
    onClose();
  };

  return (
    <Box
      css={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={handleClose}
    >
      <Box
        css={{
          position: 'relative',
          width: '100%',
          maxWidth: '500px',
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box
          css={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <Box>
            <Text weight="semibold" size="large">
              Subir {getTypeLabel(documentType)}
            </Text>
            <Text size="small" color="muted">
              {getPersonLabel(personType)}: {personName}
            </Text>
          </Box>
          
          <Button
            size="small"
            onClick={handleClose}
            disabled={isUploading}
            css={{
              padding: '8px',
              minWidth: 'auto',
              backgroundColor: '#ef4444',
              '&:hover': { backgroundColor: '#dc2626' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' }
            }}
          >
            <FaTimes size={16} />
          </Button>
        </Box>

        {/* Contenido */}
        <Box css={{ padding: '20px' }}>

          <Box marginBottom="large">
            <Text weight="medium" size="small" color="neutral" marginBottom="small">
              Imagen del documento *
            </Text>
            <ImageUploader
              onImageUpload={handleImageUpload}
              currentImageUrl={photoUrl}
              currentPublicId={publicId}
              placeholder={`Subir ${getTypeLabel(documentType).toLowerCase()}`}
              disabled={isUploading}
            />
          </Box>

          <Box marginBottom="large">
            <Text weight="medium" size="small" color="neutral" marginBottom="small">
              Descripción (opcional)
            </Text>
            <TextInput
              placeholder="Información adicional sobre el documento..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
            />
          </Box>

          {/* Información del documento */}
          <Box
            css={{
              padding: '16px',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px'
            }}
          >
            <Text size="small" color="neutral" marginBottom="xsmall">
              <strong>Tipo:</strong> {getTypeLabel(documentType)}
            </Text>
            <Text size="small" color="neutral" marginBottom="xsmall">
              <strong>Persona:</strong> {getPersonLabel(personType)}
            </Text>
            <Text size="small" color="neutral">
              <strong>Nombre:</strong> {personName}
            </Text>
          </Box>

          {/* Botones de acción */}
          <Box
            css={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}
          >
            <Button
              size="medium"
              onClick={handleClose}
              disabled={isUploading}
              css={{
                backgroundColor: '#6b7280',
                '&:hover': { backgroundColor: '#4b5563' },
                '&:disabled': { opacity: 0.5, cursor: 'not-allowed' }
              }}
            >
              Cancelar
            </Button>
            
            <Button
              size="medium"
              onClick={handleSubmit}
              disabled={isUploading || !title.trim() || !photoUrl || !publicId}
              css={{
                backgroundColor: '#10b981',
                '&:hover': { backgroundColor: '#059669' },
                '&:disabled': { opacity: 0.5, cursor: 'not-allowed' }
              }}
            >
              {isUploading ? (
                <>
                  <FaUpload size={14} />
                  Subiendo...
                </>
              ) : (
                <>
                  <FaCheck size={14} />
                  Subir Documento
                </>
              )}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
