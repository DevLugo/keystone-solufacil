/**
 * KeystonePageWrapper - Wrapper para inyectar el tema en páginas que usan PageContainer
 *
 * Este componente envuelve el PageContainer de Keystone con el ThemeProvider
 * para que las páginas existentes funcionen con dark/light mode sin cambios
 */

import React, { ReactNode, useEffect } from 'react';
import { PageContainer as KeystonePageContainer } from '@keystone-6/core/admin-ui/components';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';

type KeystonePageWrapperProps = {
  children: ReactNode;
  header: ReactNode;
  title?: string;
};

// Componente interno que consume el tema y aplica los estilos
function ThemedPageContent({ children, header, title }: KeystonePageWrapperProps) {
  const { isDark } = useTheme();

  // Aplicar clase dark al documento cuando cambia el tema
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [isDark]);

  return (
    <KeystonePageContainer header={header} title={title}>
      {children}
    </KeystonePageContainer>
  );
}

/**
 * Wrapper que proporciona el tema a las páginas de Keystone
 *
 * Uso:
 * ```tsx
 * // En lugar de:
 * // import { PageContainer } from '@keystone-6/core/admin-ui/components';
 *
 * // Usar:
 * import { KeystonePageWrapper as PageContainer } from '../components/layout/KeystonePageWrapper';
 * ```
 */
export function KeystonePageWrapper({ children, header, title }: KeystonePageWrapperProps) {
  return (
    <ThemeProvider>
      <ThemedPageContent header={header} title={title}>
        {children}
      </ThemedPageContent>
    </ThemeProvider>
  );
}

// Export como PageContainer para compatibilidad
export { KeystonePageWrapper as PageContainer };
