import React from 'react';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { LoadingDots } from '@keystone-ui/loading';
import { Box, jsx } from '@keystone-ui/core';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'ADMIN' | 'NORMAL';
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole = 'NORMAL',
  fallback 
}: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();

  // Si está cargando, mostrar loading
  if (loading) {
    return (
      <PageContainer header="Verificando permisos...">
        <Box css={{ padding: '32px', textAlign: 'center' }}>
          <LoadingDots label="Verificando permisos..." />
        </Box>
      </PageContainer>
    );
  }

  // Si se requiere rol de ADMIN y el usuario no es admin
  if (requiredRole === 'ADMIN' && !isAdmin) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <PageContainer header="Acceso Denegado">
        <Box css={{ 
          padding: '32px', 
          textAlign: 'center',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          margin: '32px'
        }}>
          <Box css={{ fontSize: '24px', fontWeight: '700', color: '#dc2626', marginBottom: '16px' }}>
            🚫 Acceso Denegado
          </Box>
          <Box css={{ fontSize: '16px', color: '#7f1d1d' }}>
            No tienes permisos para acceder a esta página. Solo los administradores pueden acceder a páginas administrativas.
          </Box>
        </Box>
      </PageContainer>
    );
  }

  // Si todo está bien, mostrar el contenido
  return <>{children}</>;
}
