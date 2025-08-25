/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx, Box, Text } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { FaTimes, FaDownload, FaSearchPlus, FaSearchMinus, FaExpand } from 'react-icons/fa';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  description?: string;
  documentType: string;
  personType: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  description,
  documentType,
  personType
}) => {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${documentType}_${personType}_${title}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

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

  return (
    <Box
      css={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <Box
        css={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
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
            padding: '16px 20px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <Box>
            <Text weight="semibold" size="large">
              {title}
            </Text>
            <Text size="small" color="muted">
              {getTypeLabel(documentType)} - {getPersonLabel(personType)}
            </Text>
            {description && (
              <Text size="small" color="neutral" marginTop="xsmall">
                {description}
              </Text>
            )}
          </Box>
          
          <Button
            size="small"
            onClick={onClose}
            css={{
              padding: '8px',
              minWidth: 'auto',
              backgroundColor: '#ef4444',
              '&:hover': { backgroundColor: '#dc2626' }
            }}
          >
            <FaTimes size={16} />
          </Button>
        </Box>

        {/* Controles de zoom */}
        <Box
          css={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <Button
            size="small"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            css={{
              padding: '6px 10px',
              backgroundColor: '#64748b',
              '&:hover': { backgroundColor: '#475569' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' }
            }}
          >
            <FaSearchMinus size={12} />
          </Button>
          
          <Text size="small" color="neutral">
            {Math.round(zoom * 100)}%
          </Text>
          
          <Button
            size="small"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            css={{
              padding: '6px 10px',
              backgroundColor: '#64748b',
              '&:hover': { backgroundColor: '#475569' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' }
            }}
          >
            <FaSearchPlus size={12} />
          </Button>
          
          <Button
            size="small"
            onClick={handleResetZoom}
            css={{
              padding: '6px 10px',
              backgroundColor: '#0ea5e9',
              '&:hover': { backgroundColor: '#0284c7' }
            }}
          >
            Reset
          </Button>
          
          <Button
            size="small"
            onClick={handleDownload}
            css={{
              padding: '6px 10px',
              backgroundColor: '#10b981',
              '&:hover': { backgroundColor: '#059669' }
            }}
          >
            <FaDownload size={12} />
          </Button>
          
          <Button
            size="small"
            onClick={handleFullscreen}
            css={{
              padding: '6px 10px',
              backgroundColor: '#8b5cf6',
              '&:hover': { backgroundColor: '#7c3aed' }
            }}
          >
            <FaExpand size={12} />
          </Button>
        </Box>

        {/* Imagen */}
        <Box
          css={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            minHeight: '400px',
            overflow: 'auto'
          }}
        >
          <img
            src={imageUrl}
            alt={title}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              transform: `scale(${zoom})`,
              transition: 'transform 0.2s ease',
              cursor: zoom > 1 ? 'grab' : 'default'
            }}
            draggable={zoom > 1}
          />
        </Box>
      </Box>
    </Box>
  );
};
