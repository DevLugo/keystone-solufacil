import React, { useState, useEffect } from 'react';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { LoadingDots } from '@keystone-ui/loading';
import { Box, jsx } from '@keystone-ui/core';

interface AdminRouteGuardProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export default function AdminRouteGuard({ children, pageTitle = "Página Administrativa" }: AdminRouteGuardProps) {
  const [userRole, setUserRole] = useState<string>('NORMAL');
  const [isLoadingRole, setIsLoadingRole] = useState<boolean>(true);

  // Verificar rol del usuario al cargar la página
  useEffect(() => {
      const checkUserRole = async () => {
        try {
          // Usar la API de Keystone para obtener el usuario actual de la sesión
          const response = await fetch('/api/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                query GetCurrentUser {
                  authenticatedItem {
                    ... on User {
                      id
                      role
                    }
                  }
                }
              `
            })
          });

          const result = await response.json();
          if (result.data?.authenticatedItem?.role) {
            setUserRole(result.data.authenticatedItem.role);
          }
        setIsLoadingRole(false);
      } catch (error) {
        console.error('Error fetching user role:', error);
        setIsLoadingRole(false);
      }
    };

    checkUserRole();
  }, []);

  // Si está cargando, mostrar loading
  if (isLoadingRole) {
    return (
      <PageContainer header={pageTitle}>
        <Box css={{ padding: '32px', textAlign: 'center' }}>
          <LoadingDots label="Verificando permisos..." />
        </Box>
      </PageContainer>
    );
  }

  // Si no es admin, mostrar acceso denegado
  if (userRole !== 'ADMIN') {
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
          <Box css={{ fontSize: '14px', color: '#991b1b', marginTop: '16px' }}>
            Rol actual: {userRole}
          </Box>
        </Box>
      </PageContainer>
    );
  }

  // Si es admin, mostrar el contenido
  return <>{children}</>;
}
