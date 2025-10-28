/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { jsx, Box, Text } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { AlertDialog } from '@keystone-ui/modals';
import { FaExclamationTriangle } from 'react-icons/fa';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (errorDescription: string) => void;
  onUnmarkError?: () => void;
  documentType: string;
  personType: string;
  existingError?: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onUnmarkError,
  documentType,
  personType,
  existingError = ''
}) => {
  const [errorDescription, setErrorDescription] = useState(existingError);

  // Actualizar el estado cuando cambie el error existente
  useEffect(() => {
    setErrorDescription(existingError);
  }, [existingError]);

  const handleConfirm = () => {
    onConfirm(errorDescription.trim());
    setErrorDescription('');
    onClose();
  };

  const handleCancel = () => {
    setErrorDescription('');
    onClose();
  };

  const handleUnmarkError = () => {
    if (onUnmarkError) {
      onUnmarkError();
    }
    setErrorDescription('');
    onClose();
  };

  const hasExistingError = existingError && existingError.trim() !== '';

  // Responsivo: detectar mobile para ajustar layout de botones
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 480px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener ? mq.addEventListener('change', update) : mq.addListener(update);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', update) : mq.removeListener(update);
    };
  }, []);

  return (
    <AlertDialog
      isOpen={isOpen}
      title=""
      tone={hasExistingError ? "active" : "negative"}
      actions={{
        confirm: {
          label: hasExistingError ? 'Actualizar Error' : 'Marcar como Error',
          action: handleConfirm,
        },
        cancel: {
          label: 'Cancelar',
          action: handleCancel,
        },
      }}
    >
      <Box css={{ width: '100%' }}>
        <Box css={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <FaExclamationTriangle size={24} color="#ef4444" />
          <Box>
            <Text weight="bold" size="medium" color="neutral900">
              {existingError ? 'Editar Error' : 'Marcar como Error'}
            </Text>
            <Text size="small" color="neutral600">
              {documentType} - {personType}
            </Text>
          </Box>
        </Box>

        <Box css={{ marginBottom: '16px' }}>
          <Text size="small" color="neutral700" marginBottom="small">
            {hasExistingError ? 'Edita la descripción del error:' : 'Describe el problema con este documento:'}
          </Text>
          <textarea
            placeholder={hasExistingError ? "Edita la descripción del error..." : "Ej: Documento borroso, información ilegible, documento incorrecto..."}
            value={errorDescription}
            onChange={(e) => setErrorDescription(e.target.value)}
            css={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              border: hasExistingError ? '1px solid #f59e0b' : '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit',
              backgroundColor: hasExistingError ? '#fef3c7' : 'white',
              '&:focus': {
                outline: 'none',
                borderColor: hasExistingError ? '#d97706' : '#3b82f6',
                boxShadow: hasExistingError ? '0 0 0 3px rgba(245, 158, 11, 0.1)' : '0 0 0 3px rgba(59, 130, 246, 0.1)'
              }
            }}
          />
        </Box>

        <Text size="small" color="neutral500">
          {hasExistingError 
            ? 'Puedes actualizar la descripción del error o desmarcarlo completamente.'
            : 'Este documento será marcado como problemático y requerirá revisión.'
          }
        </Text>

        {/* Botón adicional para Desmarcar (apilado en mobile) */}
        {hasExistingError && onUnmarkError && (
          <Box css={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              tone="negative"
              onClick={handleUnmarkError}
              css={{ '@media (max-width: 480px)': { width: '100%' } }}
            >
              Desmarcar Error
            </Button>
          </Box>
        )}
      </Box>
    </AlertDialog>
  );
};
