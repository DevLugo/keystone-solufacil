/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { radius, transitions } from '../../styles';

interface ThemeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ThemeToggle({ size = 'md', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme();
  
  const sizes = {
    sm: { button: 32, icon: 16, padding: 6 },
    md: { button: 40, icon: 20, padding: 8 },
    lg: { button: 48, icon: 24, padding: 10 },
  };
  
  const currentSize = sizes[size];
  
  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      css={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        width: showLabel ? 'auto' : currentSize.button,
        height: currentSize.button,
        padding: showLabel ? `${currentSize.padding}px 16px` : currentSize.padding,
        borderRadius: radius.lg,
        border: 'none',
        cursor: 'pointer',
        transition: transitions.fast,
        backgroundColor: isDark ? '#334155' : '#f1f5f9',
        color: isDark ? '#fbbf24' : '#64748b',
        '&:hover': {
          backgroundColor: isDark ? '#475569' : '#e2e8f0',
          transform: 'scale(1.05)',
        },
        '&:active': {
          transform: 'scale(0.95)',
        },
        '&:focus-visible': {
          outline: `2px solid ${isDark ? '#60a5fa' : '#2563eb'}`,
          outlineOffset: '2px',
        },
      }}
    >
      <span
        css={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: transitions.DEFAULT,
          transform: isDark ? 'rotate(0deg)' : 'rotate(360deg)',
        }}
      >
        {isDark ? (
          <Moon size={currentSize.icon} />
        ) : (
          <Sun size={currentSize.icon} />
        )}
      </span>
      {showLabel && (
        <span css={{ 
          fontSize: size === 'sm' ? '0.75rem' : '0.875rem',
          fontWeight: 500,
        }}>
          {isDark ? 'Oscuro' : 'Claro'}
        </span>
      )}
    </button>
  );
}

// Versión con switch animado
export function ThemeSwitch({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { isDark, toggleTheme } = useTheme();
  
  const sizes = {
    sm: { width: 44, height: 24, thumb: 18 },
    md: { width: 56, height: 28, thumb: 22 },
    lg: { width: 64, height: 32, thumb: 26 },
  };
  
  const currentSize = sizes[size];
  const thumbOffset = 3;
  const translateX = isDark ? currentSize.width - currentSize.thumb - thumbOffset * 2 : 0;
  
  return (
    <button
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      css={{
        position: 'relative',
        width: currentSize.width,
        height: currentSize.height,
        borderRadius: radius.full,
        border: 'none',
        cursor: 'pointer',
        transition: transitions.DEFAULT,
        backgroundColor: isDark ? '#1e40af' : '#e2e8f0',
        padding: 0,
        '&:focus-visible': {
          outline: `2px solid ${isDark ? '#60a5fa' : '#2563eb'}`,
          outlineOffset: '2px',
        },
      }}
    >
      {/* Track icons */}
      <span
        css={{
          position: 'absolute',
          top: '50%',
          left: thumbOffset + 2,
          transform: 'translateY(-50%)',
          color: isDark ? '#fbbf24' : '#94a3b8',
          opacity: isDark ? 0 : 1,
          transition: transitions.fast,
          display: 'flex',
        }}
      >
        <Sun size={currentSize.thumb - 6} />
      </span>
      <span
        css={{
          position: 'absolute',
          top: '50%',
          right: thumbOffset + 2,
          transform: 'translateY(-50%)',
          color: isDark ? '#fbbf24' : '#94a3b8',
          opacity: isDark ? 1 : 0,
          transition: transitions.fast,
          display: 'flex',
        }}
      >
        <Moon size={currentSize.thumb - 6} />
      </span>
      
      {/* Thumb */}
      <span
        css={{
          position: 'absolute',
          top: thumbOffset,
          left: thumbOffset,
          width: currentSize.thumb,
          height: currentSize.thumb,
          borderRadius: radius.full,
          backgroundColor: 'white',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
          transition: transitions.DEFAULT,
          transform: `translateX(${translateX}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isDark ? (
          <Moon size={currentSize.thumb - 8} color="#1e40af" />
        ) : (
          <Sun size={currentSize.thumb - 8} color="#f59e0b" />
        )}
      </span>
    </button>
  );
}

export default ThemeToggle;

