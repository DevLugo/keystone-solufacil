import React from 'react';
import { cn } from '../../lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'warning';
  children: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variantStyles = {
      default: {
        backgroundColor: '#F0F9FF',
        borderColor: '#BAE6FD',
        textColor: '#0C4A6E',
        iconColor: '#0284C7'
      },
      destructive: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        textColor: '#991B1B',
        iconColor: '#DC2626'
      },
      warning: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        textColor: '#92400E',
        iconColor: '#F59E0B'
      }
    };

    const styles = variantStyles[variant];

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          padding: '12px 16px',
          borderRadius: '6px',
          border: `1px solid ${styles.borderColor}`,
          backgroundColor: styles.backgroundColor,
          color: styles.textColor,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          ...props.style
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h5
        ref={ref}
        className={cn(className)}
        style={{
          margin: 0,
          fontWeight: '600',
          fontSize: '14px',
          lineHeight: '1.5'
        }}
        {...props}
      >
        {children}
      </h5>
    );
  }
);

AlertTitle.displayName = 'AlertTitle';

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(className)}
        style={{
          margin: 0,
          fontSize: '14px',
          lineHeight: '1.5',
          opacity: 0.9
        }}
        {...props}
      >
        {children}
      </p>
    );
  }
);

AlertDescription.displayName = 'AlertDescription';

