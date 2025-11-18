import React from 'react';
import { cn } from '../../lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, disabled, children, style, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    const baseStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      height: '40px',
      width: '100%',
      borderRadius: '6px',
      border: '1px solid #D1D5DB',
      backgroundColor: disabled ? '#F9FAFB' : '#FFFFFF',
      padding: '0 12px',
      paddingRight: '36px',
      fontSize: '14px',
      color: disabled ? '#9CA3AF' : '#111827',
      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out',
      outline: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit',
      lineHeight: '1.5',
      boxSizing: 'border-box',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
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
      <select
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
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

