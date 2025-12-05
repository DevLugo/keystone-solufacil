/**
 * CustomPageContainer - PageContainer personalizado con soporte de tema
 *
 * Este componente reemplaza el PageContainer por defecto de Keystone
 * y agrega soporte para dark/light mode
 */

import React, { ReactNode, useEffect } from 'react';
import { PageContainer as KeystonePageContainer } from '@keystone-6/core/admin-ui/components';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

// Importar estilos de tema
import '../styles/theme-variables.css';
import '../styles/keystone-theme-override.css';

type CustomPageContainerProps = {
  children: ReactNode;
  header: ReactNode;
  title?: string;
};

// Componente interno que consume el tema
function ThemedContent({ children, header, title }: CustomPageContainerProps) {
  const { isDark } = useTheme();

  // Sincronizar tema con el documento
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDark]);

  return (
    <KeystonePageContainer header={header} title={title}>
      {children}
    </KeystonePageContainer>
  );
}

/**
 * PageContainer que inyecta el ThemeProvider automáticamente
 */
export function CustomPageContainer({ children, header, title }: CustomPageContainerProps) {
  return (
    <ThemeProvider>
      <ThemedContent header={header} title={title}>
        {children}
      </ThemedContent>
    </ThemeProvider>
  );
}
