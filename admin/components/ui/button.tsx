import React from 'react';
import { cn } from '../../lib/utils';
import styles from './button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'primary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', children, className = '', ...props }, ref) => {
    const variantClass = {
      default: styles.buttonPrimary,
      destructive: styles.buttonDestructive || styles.buttonPrimary,
      outline: styles.buttonSecondary,
      secondary: styles.buttonSecondary,
      ghost: styles.buttonGhost,
      primary: styles.buttonPrimary,
    }[variant] || styles.buttonPrimary;

    const sizeClass = {
      default: '',
      sm: styles.buttonSm,
      lg: '',
      icon: styles.buttonIcon,
    }[size] || '';

    return (
      <button
        ref={ref}
        className={cn(styles.button, variantClass, sizeClass, className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
