import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
  asChild?: boolean;
}

const buttonVariants = {
  default: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    border: 'none',
    ':hover': { backgroundColor: '#1E293B' },
  },
  destructive: {
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    border: 'none',
    ':hover': { backgroundColor: '#B91C1C' },
  },
  outline: {
    backgroundColor: 'transparent',
    color: '#374151',
    border: '1px solid #D1D5DB',
    ':hover': { backgroundColor: '#F9FAFB', borderColor: '#9CA3AF' },
  },
  secondary: {
    backgroundColor: '#F3F4F6',
    color: '#374151',
    border: 'none',
    ':hover': { backgroundColor: '#E5E7EB' },
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#374151',
    border: 'none',
    ':hover': { backgroundColor: '#F3F4F6' },
  },
  link: {
    backgroundColor: 'transparent',
    color: '#2563EB',
    border: 'none',
    textDecoration: 'underline',
    textUnderlineOffset: '4px',
    ':hover': { color: '#1D4ED8' },
  },
};

const buttonSizes = {
  default: {
    height: '40px',
    padding: '0 16px',
    fontSize: '14px',
  },
  sm: {
    height: '36px',
    padding: '0 12px',
    fontSize: '13px',
  },
  lg: {
    height: '44px',
    padding: '0 20px',
    fontSize: '16px',
  },
  icon: {
    height: '40px',
    width: '40px',
    padding: '0',
  },
  'icon-sm': {
    height: '32px',
    width: '32px',
    padding: '0',
  },
  'icon-lg': {
    height: '48px',
    width: '48px',
    padding: '0',
  },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, children, style, ...props }, ref) => {
    const variantStyles = buttonVariants[variant];
    const sizeStyles = buttonSizes[size];
    
    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '6px',
      fontWeight: '500',
      transition: 'all 0.2s ease-in-out',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      outline: 'none',
      ...sizeStyles,
    };

    const [isHovered, setIsHovered] = React.useState(false);

    // Estilos base según la variante
    const variantBaseStyles: React.CSSProperties = {
      ...(variant === 'default' && {
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
      }),
      ...(variant === 'destructive' && {
        backgroundColor: '#DC2626',
        color: '#FFFFFF',
      }),
      ...(variant === 'outline' && {
        backgroundColor: 'transparent',
        color: '#374151',
        border: '1px solid #D1D5DB',
      }),
      ...(variant === 'secondary' && {
        backgroundColor: '#F3F4F6',
        color: '#374151',
      }),
      ...(variant === 'ghost' && {
        backgroundColor: 'transparent',
        color: '#6B7280',
      }),
      ...(variant === 'link' && {
        backgroundColor: 'transparent',
        color: '#2563EB',
        textDecoration: 'underline',
        textUnderlineOffset: '4px',
      }),
    };

    // Estilos de hover
    const hoverStyles: React.CSSProperties = isHovered && !disabled ? {
      ...(variant === 'default' && {
        backgroundColor: '#1E293B',
      }),
      ...(variant === 'destructive' && {
        backgroundColor: '#B91C1C',
      }),
      ...(variant === 'outline' && {
        backgroundColor: '#F9FAFB',
        borderColor: '#9CA3AF',
      }),
      ...(variant === 'secondary' && {
        backgroundColor: '#E5E7EB',
      }),
      ...(variant === 'ghost' && {
        backgroundColor: '#F3F4F6',
      }),
      ...(variant === 'link' && {
        color: '#1D4ED8',
      }),
    } : {};

    // Aplicar estilos base y variante
    const computedStyles: React.CSSProperties = {
      ...baseStyles,
      ...variantBaseStyles,
      // Aplicar estilos inline del usuario primero
      ...style,
    };

    // Aplicar estilos de hover después, pero solo si no están sobrescritos por style
    if (isHovered && !disabled) {
      if (variant === 'ghost') {
        // Para ghost, siempre aplicar el background en hover
        computedStyles.backgroundColor = '#F3F4F6';
      } else if (variant === 'outline') {
        computedStyles.backgroundColor = '#F9FAFB';
        computedStyles.borderColor = '#9CA3AF';
      } else if (variant === 'secondary') {
        computedStyles.backgroundColor = '#E5E7EB';
      } else if (variant === 'default') {
        computedStyles.backgroundColor = '#1E293B';
      } else if (variant === 'destructive') {
        computedStyles.backgroundColor = '#B91C1C';
      } else if (variant === 'link') {
        computedStyles.color = '#1D4ED8';
      }
    }

    return (
      <button
        ref={ref}
        className={cn(className)}
        style={computedStyles}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

