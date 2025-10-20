/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx, Box, Text } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput, Select } from '@keystone-ui/fields';
import { FaTimes, FaUpload, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
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
    personType?: 'TITULAR' | 'AVAL';
    isError: boolean;
    errorDescription: string;
  }) => void;
  documentType: 'INE' | 'DOMICILIO' | 'PAGARE';
  personType: 'TITULAR' | 'AVAL';
  personalDataId: string;
  loanId: string;
  personName: string;
  // Nuevos parámetros para estructura de carpetas
  loan?: any;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  documentType,
  personType,
  personalDataId,
  loanId,
  personName,
  loan
}) => {
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [publicId, setPublicId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorDescription, setErrorDescription] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' | 'warning' } | null>(null);

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
    // Permitir subir sin imagen si está marcado como error
    if (!photoUrl || !publicId) {
      if (!isError) {
        setMessage({ text: 'Por favor sube una imagen del documento o márcalo como error', tone: 'warning' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
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
        personType,
        isError,
        errorDescription: errorDescription.trim()
      });
      
      // Limpiar formulario
      setDescription('');
      setPhotoUrl('');
      setPublicId('');
      setIsError(false);
      setErrorDescription('');
      setMessage({ text: 'Documento subido exitosamente', tone: 'success' });
      
      // Cerrar el modal después de un breve delay para mostrar el mensaje de éxito
      setTimeout(() => {
        setMessage(null);
        onClose(); // Cerrar el modal de subir y regresar al modal de documentos
      }, 1500);
    } catch (error) {
      console.error('Error al subir documento:', error);
      setMessage({ text: 'Error al subir el documento. Por favor, inténtalo de nuevo.', tone: 'error' });
      setTimeout(() => setMessage(null), 5000);
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
        zIndex: 99999,
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

        {/* Message */}
        {message && (
          <Box
            css={{
              padding: '12px 20px',
              backgroundColor: message.tone === 'success' ? '#f0f9ff' : 
                              message.tone === 'error' ? '#fef2f2' : '#fef3c7',
              borderLeft: `4px solid ${
                message.tone === 'success' ? '#0ea5e9' : 
                message.tone === 'error' ? '#dc2626' : '#d97706'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {message.tone === 'success' && <FaCheck color="#0ea5e9" />}
            {message.tone === 'error' && <FaExclamationTriangle color="#dc2626" />}
            {message.tone === 'warning' && <FaExclamationTriangle color="#d97706" />}
            <Text 
              size="small" 
              color={message.tone === 'success' ? 'blue600' : 
                     message.tone === 'error' ? 'red600' : 'orange600'}
            >
              {message.text}
            </Text>
          </Box>
        )}

        {/* Contenido */}
        <Box css={{ padding: '20px' }}>

          <Box marginBottom="large">
            <Text weight="medium" size="small"  marginBottom="small">
              Imagen del documento *
            </Text>
            <ImageUploader
              onImageUpload={handleImageUpload}
              currentImageUrl={photoUrl}
              currentPublicId={publicId}
              placeholder={`Subir ${getTypeLabel(documentType).toLowerCase()}`}
              disabled={isUploading}
              loan={loan}
              documentType={documentType}
              personType={personType}
            />
          </Box>

          <Box marginBottom="large">
            <Text weight="medium" size="small"  marginBottom="small">
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
            <Text size="small"  marginBottom="xsmall">
              <strong>Tipo:</strong> {getTypeLabel(documentType)}
            </Text>
            <Text size="small"  marginBottom="xsmall">
              <strong>Persona:</strong> {getPersonLabel(personType)}
            </Text>
            <Text size="small" >
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
              disabled={isUploading || (!photoUrl && !isError)}
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
                <React.Fragment>
                  <FaUpload size={14} />
                  Subiendo...
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <FaCheck size={14} />
                  Subir Documento
                </React.Fragment>
              )}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
