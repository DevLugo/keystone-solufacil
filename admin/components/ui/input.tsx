import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, disabled, style, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    const baseStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      height: '32px',
      width: '100%',
      borderRadius: '4px',
      border: '1px solid #D1D5DB',
      backgroundColor: disabled ? '#F9FAFB' : '#FFFFFF',
      padding: '0 10px',
      fontSize: '13px',
      color: disabled ? '#9CA3AF' : '#111827',
      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out',
      outline: 'none',
      cursor: disabled ? 'not-allowed' : 'text',
      fontFamily: 'inherit',
      lineHeight: '1.4',
      boxSizing: 'border-box',
      WebkitAppearance: 'none',
      MozAppearance: 'textfield',
      ...(type === 'number' && {
        // Ocultar spinners en inputs numéricos
        MozAppearance: 'textfield',
        WebkitAppearance: 'none',
      }),
    };

    // Estilos según el estado
    let stateStyles: React.CSSProperties = {};
    
    if (disabled) {
      stateStyles = {
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        color: '#9CA3AF',
      };
    } else if (isFocused) {
      stateStyles = {
        borderColor: '#3B82F6',
        boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
        backgroundColor: '#FFFFFF',
      };
    } else if (isHovered) {
      stateStyles = {
        borderColor: '#9CA3AF',
        backgroundColor: '#FFFFFF',
      };
    } else {
      stateStyles = {
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
      };
    }

    return (
      <>
        <input
          type={type}
          ref={ref}
          className={cn(className)}
          style={{ ...baseStyles, ...stateStyles, ...style }}
          disabled={disabled}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          onMouseEnter={(e) => {
            setIsHovered(true);
            props.onMouseEnter?.(e);
          }}
          onMouseLeave={(e) => {
            setIsHovered(false);
            props.onMouseLeave?.(e);
          }}
          {...props}
        />
        {type === 'number' && (
          <style>{`
            input[type="number"]::-webkit-inner-spin-button,
            input[type="number"]::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            input[type="number"] {
              -moz-appearance: textfield;
            }
          `}</style>
        )}
      </>
    );
  }
);

Input.displayName = 'Input';

