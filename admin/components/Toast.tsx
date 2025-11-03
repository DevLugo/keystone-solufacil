/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useEffect } from 'react';
import { jsx, Box, Text } from '@keystone-ui/core';
import { FaCheck, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#f0fdf4',
          borderColor: '#22c55e',
          color: '#15803d',
          iconColor: '#22c55e'
        };
      case 'error':
        return {
          backgroundColor: '#fef2f2',
          borderColor: '#ef4444',
          color: '#dc2626',
          iconColor: '#ef4444'
        };
      case 'info':
        return {
          backgroundColor: '#eff6ff',
          borderColor: '#3b82f6',
          color: '#1d4ed8',
          iconColor: '#3b82f6'
        };
      default:
        return {
          backgroundColor: '#f8fafc',
          borderColor: '#64748b',
          color: '#475569',
          iconColor: '#64748b'
        };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FaCheck size={16} />;
      case 'error':
        return <FaExclamationTriangle size={16} />;
      case 'info':
        return <FaExclamationTriangle size={16} />;
      default:
        return null;
    }
  };

  const styles = getToastStyles();

  return (
    <Box
      css={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px',
        backgroundColor: styles.backgroundColor,
        border: `1px solid ${styles.borderColor}`,
        borderRadius: '12px',
        boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        minWidth: '320px',
        maxWidth: '500px',
        animation: 'slideInRight 0.3s ease-out',
        '@keyframes slideInRight': {
          '0%': {
            transform: 'translateX(100%)',
            opacity: '0'
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: '1'
          }
        },
        '@media (max-width: 768px)': {
          minWidth: '280px',
          maxWidth: 'calc(100vw - 32px)',
          padding: '12px'
        }
      }}
    >
      {/* Icono */}
      <Box
        css={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: 'white',
          color: styles.iconColor,
          flexShrink: 0,
          marginTop: '2px'
        }}
      >
        {getIcon()}
      </Box>

      {/* Contenido */}
      <Box css={{ flex: 1, minWidth: 0 }}>
        <Text
          weight="semibold"
          size="small"
          css={{
            color: styles.color,
            marginBottom: message ? '4px' : '0',
            lineHeight: '1.4'
          }}
        >
          {title}
        </Text>
        {message && (
          <Text
            size="small"
            css={{
              color: styles.color,
              opacity: 0.8,
              lineHeight: '1.4'
            }}
          >
            {message}
          </Text>
        )}
      </Box>

      {/* Botón de cerrar */}
      <Box
        css={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          color: styles.color,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            transform: 'scale(1.1)'
          }
        }}
        onClick={() => onClose(id)}
      >
        <FaTimes size={10} />
      </Box>
    </Box>
  );
};

export interface ToastContainerProps {
  toasts: ToastProps[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <Box
      css={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        '@media (max-width: 768px)': {
          top: '16px',
          right: '16px',
          left: '16px'
        }
      }}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={onClose}
        />
      ))}
    </Box>
  );
};
