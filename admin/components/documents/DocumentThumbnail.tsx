/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx, Box, Text } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { LoadingDots } from '@keystone-ui/loading';
import { FaCamera, FaEye, FaPlus, FaTrash, FaExclamationTriangle } from 'react-icons/fa';

interface DocumentThumbnailProps {
  type: 'INE' | 'DOMICILIO' | 'PAGARE';
  personType: 'TITULAR' | 'AVAL';
  imageUrl?: string;
  publicId?: string;
  isError?: boolean;
  errorDescription?: string;
  isMissing?: boolean;
  onImageClick?: () => void;
  onUploadClick?: () => void;
  onMarkAsError?: (isError: boolean, errorDescription?: string) => void;
  onMarkAsMissing?: (isMissing: boolean) => void;
  onDelete?: () => void;
  isUploading?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const DocumentThumbnail: React.FC<DocumentThumbnailProps> = ({
  type,
  personType,
  imageUrl,
  publicId,
  isError = false,
  errorDescription = '',
  isMissing = false,
  onImageClick,
  onUploadClick,
  onMarkAsError,
  onMarkAsMissing,
  onDelete,
  isUploading = false,
  size = 'medium'
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'INE': return 'INE';
      case 'DOMICILIO': return 'Domicilio';
      case 'PAGARE': return 'Pagaré';
      default: return type;
    }
  };

  const getPersonLabel = (personType: string) => {
    return personType === 'TITULAR' ? 'Titular' : 'Aval';
  };

  const getSizeStyles = (size: string) => {
    switch (size) {
      case 'small':
        return { width: '80px', height: '80px', fontSize: '10px' };
      case 'large':
        return { width: '160px', height: '180px', fontSize: '14px' }; // Aumenté el ancho y altura
      default: // medium
        return { width: '110px', height: '110px', fontSize: '12px' };
    }
  };

  const sizeStyles = getSizeStyles(size);

  const hasImage = imageUrl && publicId;
  const isDocumentReviewed = hasImage || isError || isMissing;

  return (
    <Box
      css={{
        position: 'relative',
        width: sizeStyles.width,
        height: sizeStyles.height,
        borderRadius: '8px',
          overflow: 'hidden',
          '@media (min-width: 1024px)': {
            overflow: 'visible' // permitir que los íconos salgan del contenedor en desktop
          },
        cursor: hasImage ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        border: '2px solid',
        borderColor: hasImage ? '#10b981' : isMissing ? '#9ca3af' : '#d1d5db',
        backgroundColor: hasImage ? '#f0fdf4' : isMissing ? '#f3f4f6' : '#f9fafb',
        '&:hover': {
          transform: hasImage ? 'scale(1.05)' : 'none',
          boxShadow: hasImage ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={hasImage ? onImageClick : undefined}
    >
      {/* Estado de carga */}
      {isUploading && (
        <Box
          css={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            zIndex: 10
          }}
        >
          <LoadingDots label="Subiendo..." />
        </Box>
      )}

      {/* Imagen existente o estado de faltante */}
      {hasImage ? (
        <>
          <img
            src={imageUrl}
            alt={`${getTypeLabel(type)} - ${getPersonLabel(personType)}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          
          {/* Overlay con información */}
          {isHovered && (
            <Box
              css={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '4px 6px',
                fontSize: sizeStyles.fontSize,
                textAlign: 'center'
              }}
            >
              <Text size="small" color="white">
                {getTypeLabel(type)} - {getPersonLabel(personType)}
              </Text>
            </Box>
          )}

          {/* Botón de eliminar (esquina superior izquierda) */}
          {hasImage && onDelete && (
            <Box
              css={{
                position: 'absolute',
                top: '6px',
                left: '6px',
                backgroundColor: '#ef4444',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                '&:hover': {
                  backgroundColor: '#dc2626',
                  transform: 'scale(1.1)'
                },
                '@media (min-width: 1024px)': {
                  top: '-10px',
                  left: '-10px'
                },
                '@media (max-width: 768px)': {
                  width: '20px',
                  height: '20px',
                  top: '4px',
                  left: '4px'
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onDelete) {
                  onDelete();
                }
              }}
              title="Eliminar imagen"
            >
              <FaTrash size={11} color="white" />
            </Box>
          )}

          {/* Botón de marcar como error (esquina superior derecha) */}
          {hasImage && onMarkAsError && (
            <Box
              css={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                backgroundColor: isError ? '#ef4444' : '#f59e0b',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                '&:hover': {
                  backgroundColor: isError ? '#dc2626' : '#d97706',
                  transform: 'scale(1.1)'
                },
                '@media (min-width: 1024px)': {
                  top: '-10px',
                  right: '-10px'
                },
                '@media (max-width: 768px)': {
                  width: '20px',
                  height: '20px',
                  top: '4px',
                  right: '4px'
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onMarkAsError) {
                  if (isError) {
                    // Si ya está marcado como error, mostrar/editar el error
                    onMarkAsError(true, errorDescription);
                  } else {
                    // Abrir modal para descripción del error
                    onMarkAsError(true, '');
                  }
                }
              }}
              title={isError ? `Ver/editar error: ${errorDescription || 'Sin descripción'}` : 'Marcar como error'}
            >
              <FaExclamationTriangle size={11} color="white" />
            </Box>
          )}

        </>
      ) : isMissing ? (
        /* Estado de faltante */
        <Box
          css={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            textAlign: 'center',
            backgroundColor: '#f3f4f6',
            border: '2px solid #9ca3af',
            borderRadius: '8px'
          }}
        >
          <Box
            css={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
              transition: 'all 0.2s ease'
            }}
          >
            <Text size="large" color="gray500">❌</Text>
          </Box>
          
          <Text
            size="small"
            color="gray600"
            css={{
              fontSize: sizeStyles.fontSize,
              fontWeight: '600',
              lineHeight: '1.2',
              marginBottom: '3px'
            }}
          >
            {getTypeLabel(type)}
          </Text>
          
          <Text
            size="small"
            color="gray500"
            css={{
              fontSize: Math.max(9, sizeStyles.fontSize - 1),
              lineHeight: '1.2',
              marginBottom: '10px'
            }}
          >
            {getPersonLabel(personType)}
          </Text>

          <Text
            size="small"
            color="gray500"
            css={{
              fontSize: Math.max(8, sizeStyles.fontSize - 2),
              lineHeight: '1.2',
              fontWeight: '500'
            }}
          >
            Faltante
          </Text>

          {/* Botón para desmarcar como faltante */}
          {onMarkAsMissing && (
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsMissing(false);
              }}
              css={{
                padding: '8px 12px',
                fontSize: Math.max(10, sizeStyles.fontSize - 1),
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '500',
                marginTop: '8px',
                height: '32px', // Altura fija para consistencia
                width: '100%', // Ocupa todo el ancho disponible
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': { 
                  backgroundColor: '#4b5563',
                  transform: 'scale(1.02)',
                  boxShadow: '0 2px 8px rgba(107, 114, 128, 0.3)'
                },
                '&:active': {
                  transform: 'scale(0.98)'
                },
                transition: 'all 0.2s ease',
                '@media (max-width: 768px)': {
                  padding: '10px 14px',
                  fontSize: Math.max(11, sizeStyles.fontSize),
                  height: '36px'
                }
              }}
            >
              Desmarcar
            </Button>
          )}
        </Box>
      ) : (
        /* Estado vacío */
        <Box
          css={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 8px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            border: '2px dashed #d1d5db',
            borderRadius: '8px'
          }}
        >
          {/* Títulos en la parte superior */}
          <Box css={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '4px'
          }}>
            <Box
              css={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <FaCamera size={16} color="#3b82f6" />
            </Box>
            
            <Text
              size="small"
              color="gray600"
              css={{
                fontSize: sizeStyles.fontSize,
                fontWeight: '600',
                lineHeight: '1.2'
              }}
            >
              {getTypeLabel(type)}
            </Text>
            
            <Text
              size="small"
              color="gray500"
              css={{
                fontSize: Math.max(9, sizeStyles.fontSize - 1),
                lineHeight: '1.2'
              }}
            >
              {getPersonLabel(personType)}
            </Text>
          </Box>

          {/* Botones de acción en la parte inferior */}
          <Box css={{ 
            display: 'flex', 
            gap: '6px', 
            flexDirection: 'column', 
            alignItems: 'center',
            width: '100%'
          }}>
            {/* Botón para subir */}
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onUploadClick?.();
              }}
              css={{
                padding: '8px 12px',
                fontSize: Math.max(10, sizeStyles.fontSize - 1),
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '500',
                height: '32px', // Altura fija para consistencia
                width: '100%', // Ocupa todo el ancho disponible
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                '&:hover': { 
                  backgroundColor: '#2563eb',
                  transform: 'scale(1.02)',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                },
                '&:active': {
                  transform: 'scale(0.98)'
                },
                transition: 'all 0.2s ease',
                '@media (max-width: 768px)': {
                  padding: '10px 14px',
                  fontSize: Math.max(11, sizeStyles.fontSize),
                  height: '36px'
                }
              }}
            >
              <FaPlus size={12} />
              Subir
            </Button>

            {/* Botón para marcar como faltante */}
            {onMarkAsMissing && (
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsMissing(true);
                }}
                css={{
                  padding: '8px 12px',
                  fontSize: Math.max(10, sizeStyles.fontSize - 1),
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '500',
                  height: '32px', // Altura fija para consistencia
                  width: '100%', // Ocupa todo el ancho disponible
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  '&:hover': { 
                    backgroundColor: '#4b5563',
                    transform: 'scale(1.02)',
                    boxShadow: '0 2px 8px rgba(107, 114, 128, 0.3)'
                  },
                  '&:active': {
                    transform: 'scale(0.98)'
                  },
                  transition: 'all 0.2s ease',
                  '@media (max-width: 768px)': {
                    padding: '10px 14px',
                    fontSize: Math.max(11, sizeStyles.fontSize),
                    height: '36px'
                  }
                }}
              >
                ❌ Faltante
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};
