import React from 'react';
interface StatusBadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'purple' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}
export function StatusBadge({
  variant = 'default',
  size = 'md',
  children
}: StatusBadgeProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-full';
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  };
  const variantClasses = {
    default: 'bg-slate-100 text-slate-800',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-white',
    destructive: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
    purple: 'bg-purple-500 text-white',
    outline: 'bg-transparent text-foreground border border-muted'
  };
  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]}`;
  return <span className={classes}>{children}</span>;
}