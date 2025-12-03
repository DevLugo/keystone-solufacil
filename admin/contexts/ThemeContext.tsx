/**
 * ThemeContext - Contexto para manejar el modo dark/light
 * 
 * Uso:
 * import { useTheme, ThemeProvider } from '../contexts/ThemeContext';
 * 
 * // En el componente raíz
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * 
 * // En cualquier componente hijo
 * const { theme, toggleTheme, isDark } = useTheme();
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'solufacil-theme';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'light' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Intentar obtener el tema guardado del localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
      // Si no hay tema guardado, verificar preferencia del sistema
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return defaultTheme;
  });

  useEffect(() => {
    // Guardar el tema en localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    
    // Actualizar la clase en el documento para CSS global si es necesario
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    // Disparar custom event para sincronizar otros ThemeProviders en el mismo tab
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('themeChange', { detail: theme }));
    }
  }, [theme]);

  // Escuchar cambios en la preferencia del sistema
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Solo cambiar automáticamente si el usuario no ha elegido manualmente
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (!saved) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Sincronizar el tema entre tabs y componentes mediante storage event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const newTheme = e.newValue as Theme;
        if (newTheme === 'dark' || newTheme === 'light') {
          setThemeState(newTheme);
        }
      }
    };

    // También escuchar cambios en el mismo tab mediante custom event
    const handleThemeChange = (e: CustomEvent<Theme>) => {
      setThemeState(e.detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('themeChange', handleThemeChange as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
    };
  }, []);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
    isDark: theme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook para obtener colores según el tema actual
export function useThemeColors() {
  const { isDark } = useTheme();
  return isDark ? darkColors : lightColors;
}

// Colores para modo claro
export const lightColors = {
  // Backgrounds
  background: '#ffffff',
  backgroundSecondary: '#f8fafc',
  backgroundTertiary: '#f1f5f9',
  
  // Foregrounds
  foreground: '#0f172a',
  foregroundSecondary: '#475569',
  foregroundMuted: '#64748b',
  
  // Cards
  card: '#ffffff',
  cardHover: '#f8fafc',
  
  // Borders
  border: '#e2e8f0',
  borderHover: '#cbd5e1',
  
  // Muted (for disabled/readonly states)
  muted: '#f3f4f6',
  mutedForeground: '#9ca3af',
  
  // Modal overlay
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  
  // Primary
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  primaryHover: '#1d4ed8',
  
  // Success
  success: '#10b981',
  successBackground: '#f0fdf4',
  successForeground: '#065f46',
  
  // Destructive
  destructive: '#ef4444',
  destructiveBackground: '#fef2f2',
  destructiveForeground: '#991b1b',
  
  // Warning
  warning: '#f59e0b',
  warningBackground: '#fffbeb',
  warningForeground: '#92400e',
  
  // Info
  info: '#3b82f6',
  infoBackground: '#eff6ff',
  infoForeground: '#1e40af',
  
  // Shadows
  shadowColor: 'rgba(0, 0, 0, 0.1)',
  
  // Gradients
  pageGradient: 'linear-gradient(to bottom right, #f8fafc, #eff6ff, #faf5ff)',
  cardGradient: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
};

// Colores para modo oscuro
export const darkColors = {
  // Backgrounds
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
  backgroundTertiary: '#334155',
  
  // Foregrounds
  foreground: '#f8fafc',
  foregroundSecondary: '#cbd5e1',
  foregroundMuted: '#94a3b8',
  
  // Cards
  card: '#1e293b',
  cardHover: '#334155',
  
  // Borders
  border: '#334155',
  borderHover: '#475569',
  
  // Muted (for disabled/readonly states)
  muted: '#334155',
  mutedForeground: '#64748b',
  
  // Modal overlay
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
  
  // Primary
  primary: '#3b82f6',
  primaryForeground: '#ffffff',
  primaryHover: '#60a5fa',
  
  // Success
  success: '#22c55e',
  successBackground: '#14532d',
  successForeground: '#bbf7d0',
  
  // Destructive
  destructive: '#f87171',
  destructiveBackground: '#7f1d1d',
  destructiveForeground: '#fecaca',
  
  // Warning
  warning: '#fbbf24',
  warningBackground: '#78350f',
  warningForeground: '#fef3c7',
  
  // Info
  info: '#60a5fa',
  infoBackground: '#1e3a8a',
  infoForeground: '#dbeafe',
  
  // Shadows
  shadowColor: 'rgba(0, 0, 0, 0.5)',
  
  // Gradients
  pageGradient: 'linear-gradient(to bottom right, #0f172a, #1e1b4b, #1e293b)',
  cardGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
};

export type ThemeColors = typeof lightColors;

