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
    isError: boolean;
    errorDescription: string;
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
  const [isError, setIsError] = useState(false);
  const [errorDescription, setErrorDescription] = useState('');

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
        loanId,
        isError,
        errorDescription: errorDescription.trim()
      });
      
      // Limpiar formulario
      setDescription('');
      setPhotoUrl('');
      setPublicId('');
      setIsError(false);
      setErrorDescription('');
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
    setIsError(false);
    setErrorDescription('');
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
            backgroundColor: '#f1f5f9',
            borderBottom: '2px solid #e2e8f0'
          }}
        >
          <Box>
            <Text weight="bold" size="large" color="black">
              Subir {getTypeLabel(documentType)}
            </Text>
            <Text size="small" color="black" css={{ marginTop: '4px' }}>
              {getPersonLabel(personType)}: <strong>{personName}</strong>
            </Text>
          </Box>
          
          <Button
            size="small"
            onClick={handleClose}
            disabled={isUploading}
            css={{
              padding: '8px',
              minWidth: 'auto',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              '&:hover': { 
                backgroundColor: '#b91c1c',
                transform: 'scale(1.05)'
              },
              '&:disabled': { 
                opacity: 0.6, 
                cursor: 'not-allowed',
                backgroundColor: '#9ca3af'
              },
              transition: 'all 0.2s ease'
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

          {/* Campo para marcar como error */}
          <Box marginBottom="large">
            <Box css={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'small' }}>
              <input
                type="checkbox"
                id="isError"
                checked={isError}
                onChange={(e) => setIsError(e.target.checked)}
                disabled={isUploading}
                css={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#dc2626',
                  '&:checked': {
                    backgroundColor: '#dc2626',
                    borderColor: '#dc2626'
                  },
                  '&:focus': {
                    outline: '2px solid #fca5a5',
                    outlineOffset: '2px'
                  }
                }}
              />
              <Text weight="semibold" size="small" color="red600">
                Marcar como error
              </Text>
            </Box>
            
            {isError && (
              <TextInput
                placeholder="Descripción del error..."
                value={errorDescription}
                onChange={(e) => setErrorDescription(e.target.value)}
                disabled={isUploading}
                css={{
                  borderColor: '#dc2626',
                  backgroundColor: '#fef2f2',
                  color: '#1f2937',
                  '&:focus': {
                    borderColor: '#b91c1c',
                    boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.2)',
                    backgroundColor: 'white'
                  },
                  '&::placeholder': {
                    color: '#9ca3af'
                  }
                }}
              />
            )}
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
                color: 'white',
                border: 'none',
                fontWeight: '600',
                '&:hover': { 
                  backgroundColor: '#4b5563',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(75, 85, 99, 0.3)'
                },
                '&:disabled': { 
                  opacity: 0.6, 
                  cursor: 'not-allowed',
                  backgroundColor: '#9ca3af'
                },
                transition: 'all 0.2s ease'
              }}
            >
              Cancelar
            </Button>
            
            <Button
              size="medium"
              onClick={handleSubmit}
              disabled={isUploading || !photoUrl || !publicId}
              css={{
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                '&:hover': { 
                  backgroundColor: '#047857',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                },
                '&:disabled': { 
                  opacity: 0.6, 
                  cursor: 'not-allowed',
                  backgroundColor: '#9ca3af'
                },
                transition: 'all 0.2s ease'
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
