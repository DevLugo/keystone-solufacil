/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { colors } from './theme';

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'purple';
  className?: string;
}

export function StatusBadge({
  children,
  variant = 'default',
  className = ''
}: StatusBadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          backgroundColor: colors.green[100],
          color: colors.green[700],
          border: `1px solid ${colors.green[200]}`,
        };
      case 'warning':
        return {
          backgroundColor: colors.amber[100],
          color: colors.amber[700],
          border: `1px solid ${colors.amber[200]}`,
        };
      case 'danger':
        return {
          backgroundColor: colors.red[100],
          color: colors.red[700],
          border: `1px solid ${colors.red[200]}`,
        };
      case 'purple':
        return {
          backgroundColor: colors.purple[100],
          color: colors.purple[700],
          border: `1px solid ${colors.purple[200]}`,
        };
      default:
        return {
          backgroundColor: colors.slate[100],
          color: colors.slate[700],
          border: `1px solid ${colors.slate[200]}`,
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <span
      css={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.625rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1,
        ...styles,
      }}
      className={className}
    >
      <span
        css={{
          display: 'inline-block',
          width: '0.375rem',
          height: '0.375rem',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          marginRight: '0.375rem',
        }}
      />
      {children}
    </span>
  );
}

