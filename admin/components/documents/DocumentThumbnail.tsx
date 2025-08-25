/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx, Box, Text } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { LoadingDots } from '@keystone-ui/loading';
import { FaCamera, FaEye, FaPlus, FaCheck } from 'react-icons/fa';

interface DocumentThumbnailProps {
  type: 'INE' | 'DOMICILIO' | 'PAGARE';
  personType: 'TITULAR' | 'AVAL';
  imageUrl?: string;
  publicId?: string;
  onImageClick?: () => void;
  onUploadClick?: () => void;
  isUploading?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const DocumentThumbnail: React.FC<DocumentThumbnailProps> = ({
  type,
  personType,
  imageUrl,
  publicId,
  onImageClick,
  onUploadClick,
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
        return { width: '140px', height: '140px', fontSize: '14px' };
      default: // medium
        return { width: '110px', height: '110px', fontSize: '12px' };
    }
  };

  const sizeStyles = getSizeStyles(size);

  const hasImage = imageUrl && publicId;

  return (
    <Box
      css={{
        position: 'relative',
        width: sizeStyles.width,
        height: sizeStyles.height,
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: hasImage ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        border: '2px solid',
        borderColor: hasImage ? '#10b981' : '#d1d5db',
        backgroundColor: hasImage ? '#f0fdf4' : '#f9fafb',
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

      {/* Imagen existente */}
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

          {/* Indicador de completado */}
          <Box
            css={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FaCheck size={8} color="white" />
          </Box>
        </>
      ) : (
        /* Estado vacío */
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
            backgroundColor: '#f8fafc',
            border: '2px dashed #d1d5db',
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
            <FaCamera size={20} color="#3b82f6" />
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

          {/* Botón para subir */}
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onUploadClick?.();
            }}
                          css={{
                padding: '4px 8px',
                fontSize: Math.max(8, sizeStyles.fontSize - 2),
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '500',
                '&:hover': { 
                  backgroundColor: '#2563eb',
                  transform: 'scale(1.05)',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <FaPlus size={10} />
          </Button>
        </Box>
      )}
    </Box>
  );
};
