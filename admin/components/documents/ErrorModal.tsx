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
  documentType: string;
  personType: string;
  existingError?: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
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

  return (
    <AlertDialog
      isOpen={isOpen}
      title=""
      tone="negative"
      actions={{
        confirm: {
          label: 'Marcar como Error',
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
            Describe el problema con este documento:
          </Text>
          <textarea
            placeholder="Ej: Documento borroso, información ilegible, documento incorrecto..."
            value={errorDescription}
            onChange={(e) => setErrorDescription(e.target.value)}
            css={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit',
              '&:focus': {
                outline: 'none',
                borderColor: '#3b82f6',
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
              }
            }}
          />
        </Box>

        <Text size="small" color="neutral500">
          Este documento será marcado como problemático y requerirá revisión.
        </Text>
      </Box>
    </AlertDialog>
  );
};
