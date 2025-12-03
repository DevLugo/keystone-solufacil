/**
 * Sistema de Diseño Unificado - Solufacil
 * 
 * Este archivo contiene todos los tokens de diseño que deben ser usados
 * en todos los componentes de la aplicación para mantener consistencia.
 * 
 * Inspirado en: Vercel, Linear, Stripe, Notion
 */

// =============================================================================
// COLORES
// =============================================================================

export const colors = {
  // Colores base
  background: '#ffffff',
  foreground: '#0f172a',
  
  // Colores de superficie
  card: '#ffffff',
  cardForeground: '#0f172a',
  
  // Colores mutados
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  
  // Bordes e inputs
  border: '#e2e8f0',
  input: '#e2e8f0',
  
  // Colores primarios
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  primaryHover: '#1d4ed8',
  
  // Colores secundarios
  secondary: '#f1f5f9',
  secondaryForeground: '#0f172a',
  secondaryHover: '#e2e8f0',
  
  // Colores de acento
  accent: '#f1f5f9',
  accentForeground: '#0f172a',
  
  // Colores destructivos
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
  destructiveHover: '#dc2626',
  
  // Colores de éxito
  success: '#10b981',
  successForeground: '#ffffff',
  successHover: '#059669',
  
  // Colores de advertencia
  warning: '#f59e0b',
  warningForeground: '#ffffff',
  warningHover: '#d97706',
  
  // Colores de información
  info: '#3b82f6',
  infoForeground: '#ffffff',
  
  // Ring (focus)
  ring: '#2563eb',
  
  // Paleta Slate (grises)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  
  // Paleta Blue
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  
  // Paleta Green
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  
  // Paleta Red
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  
  // Paleta Amber
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  
  // Paleta Purple
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  // Alias para compatibilidad
  purpleColors: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  
  // Paleta Teal
  teal: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  // Alias para compatibilidad
  tealColors: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  
  // Paleta Pink
  pink: {
    50: '#fdf2f8',
    100: '#fce7f3',
    200: '#fbcfe8',
    300: '#f9a8d4',
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
    800: '#9d174d',
    900: '#831843',
  },
};

// =============================================================================
// SOMBRAS
// =============================================================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  // Sombras con color
  primarySm: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
  primaryMd: '0 6px 12px -2px rgba(37, 99, 235, 0.3)',
  successSm: '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
  successMd: '0 6px 12px -2px rgba(16, 185, 129, 0.3)',
  destructiveSm: '0 4px 6px -1px rgba(239, 68, 68, 0.2)',
  destructiveMd: '0 6px 12px -2px rgba(239, 68, 68, 0.3)',
};

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const radius = {
  none: '0',
  sm: '0.125rem',    // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  '3xl': '1.5rem',   // 24px
  full: '9999px',
};

// =============================================================================
// ESPACIADO
// =============================================================================

export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
};

// =============================================================================
// TIPOGRAFÍA
// =============================================================================

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

// =============================================================================
// GRADIENTES
// =============================================================================

export const gradients = {
  // Gradientes sólidos
  blueToBlue: 'linear-gradient(to bottom right, #3b82f6, #2563eb)',
  purpleToPurple: 'linear-gradient(to bottom right, #a855f7, #9333ea)',
  greenToGreen: 'linear-gradient(to bottom right, #22c55e, #16a34a)',
  tealToTeal: 'linear-gradient(to bottom right, #14b8a6, #0d9488)',
  redToRed: 'linear-gradient(to bottom right, #ef4444, #dc2626)',
  amberToAmber: 'linear-gradient(to bottom right, #f59e0b, #d97706)',
  
  // Gradientes mixtos
  purpleToPink: 'linear-gradient(to bottom right, #a855f7, #ec4899)',
  blueToPurple: 'linear-gradient(to bottom right, #3b82f6, #9333ea)',
  greenToTeal: 'linear-gradient(to bottom right, #22c55e, #14b8a6)',
  
  // Gradientes de fondo
  slateToSlate: 'linear-gradient(to right, #1e293b, #0f172a)',
  pageBackground: 'linear-gradient(to bottom right, #f8fafc, #eff6ff, #faf5ff)',
  cardBackground: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
  
  // Gradientes sutiles
  subtleBlue: 'linear-gradient(to bottom right, #eff6ff, #dbeafe)',
  subtlePurple: 'linear-gradient(to bottom right, #faf5ff, #f3e8ff)',
  subtleGreen: 'linear-gradient(to bottom right, #f0fdf4, #dcfce7)',
  subtleAmber: 'linear-gradient(to bottom right, #fffbeb, #fef3c7)',
};

// =============================================================================
// TRANSICIONES
// =============================================================================

export const transitions = {
  fast: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  DEFAULT: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  colors: 'color, background-color, border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  transform: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// =============================================================================
// Z-INDEX
// =============================================================================

export const zIndex = {
  dropdown: 50,
  sticky: 100,
  fixed: 200,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
};

// =============================================================================
// ESTILOS COMUNES (Emotion CSS-in-JS)
// =============================================================================

export const commonStyles = {
  // Cards
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.lg,
    overflow: 'hidden',
    transition: transitions.DEFAULT,
  },
  cardHover: {
    boxShadow: shadows.xl,
    transform: 'translateY(-2px)',
  },
  cardCompact: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.sm,
    overflow: 'hidden',
    transition: transitions.fast,
  },
  
  // Flex utilities
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexStart: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  flexColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  // Icon containers
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
  },
  iconContainerSm: {
    width: '2rem',
    height: '2rem',
    borderRadius: radius.lg,
  },
  iconContainerMd: {
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: radius.xl,
  },
  iconContainerLg: {
    width: '3rem',
    height: '3rem',
    borderRadius: radius.xl,
  },
  
  // Inputs
  input: {
    width: '100%',
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: '0.875rem',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    color: colors.foreground,
    outline: 'none',
    transition: transitions.fast,
    '&:focus': {
      borderColor: colors.primary,
      boxShadow: `0 0 0 3px ${colors.blue[100]}`,
    },
    '&::placeholder': {
      color: colors.mutedForeground,
    },
  },
  
  // Labels
  label: {
    display: 'block',
    marginBottom: spacing[2],
    fontSize: '0.875rem',
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
  },
  
  // Page containers
  pageContainer: {
    padding: spacing[6],
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: colors.slate[50],
    minHeight: '100vh',
  },
  
  // Section headers
  sectionHeader: {
    fontSize: '1.25rem',
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    marginBottom: spacing[4],
  },
  
  // Badges
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${spacing[1]} ${spacing[2]}`,
    fontSize: '0.75rem',
    fontWeight: typography.fontWeight.medium,
    borderRadius: radius.md,
    whiteSpace: 'nowrap' as const,
  },
  
  // Tables
  tableHeader: {
    padding: `${spacing[2]} ${spacing[3]}`,
    textAlign: 'left' as const,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    backgroundColor: colors.slate[50],
    borderBottom: `1px solid ${colors.border}`,
  },
  tableCell: {
    padding: `${spacing[3]} ${spacing[3]}`,
    color: colors.foreground,
    fontSize: '0.875rem',
    borderBottom: `1px solid ${colors.border}`,
    verticalAlign: 'middle' as const,
  },
  
  // Loading states
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '400px',
    background: gradients.pageBackground,
    borderRadius: radius['2xl'],
    margin: spacing[5],
    position: 'relative' as const,
    overflow: 'hidden',
  },
  
  // Empty states
  emptyState: {
    textAlign: 'center' as const,
    padding: spacing[12],
    color: colors.mutedForeground,
  },
};

// =============================================================================
// UTILIDADES
// =============================================================================

/**
 * Formatea un número como moneda MXN
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formatea un número con separadores de miles
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('es-MX').format(num);
};

/**
 * Formatea una fecha
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Combina clases CSS condicionalmente
 */
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

// =============================================================================
// VARIANTES DE COMPONENTES
// =============================================================================

export const buttonVariants = {
  primary: {
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
    border: 'none',
    '&:hover': {
      backgroundColor: colors.primaryHover,
    },
    '&:focus': {
      boxShadow: `0 0 0 3px ${colors.blue[200]}`,
    },
  },
  secondary: {
    backgroundColor: colors.secondary,
    color: colors.secondaryForeground,
    border: `1px solid ${colors.border}`,
    '&:hover': {
      backgroundColor: colors.secondaryHover,
    },
  },
  outline: {
    backgroundColor: 'transparent',
    color: colors.foreground,
    border: `1px solid ${colors.border}`,
    '&:hover': {
      backgroundColor: colors.slate[50],
    },
  },
  ghost: {
    backgroundColor: 'transparent',
    color: colors.foreground,
    border: 'none',
    '&:hover': {
      backgroundColor: colors.slate[100],
    },
  },
  destructive: {
    backgroundColor: colors.destructive,
    color: colors.destructiveForeground,
    border: 'none',
    '&:hover': {
      backgroundColor: colors.destructiveHover,
    },
  },
  success: {
    backgroundColor: colors.success,
    color: colors.successForeground,
    border: 'none',
    '&:hover': {
      backgroundColor: colors.successHover,
    },
  },
};

export const buttonSizes = {
  sm: {
    padding: `${spacing[1.5]} ${spacing[3]}`,
    fontSize: '0.75rem',
    height: '2rem',
  },
  DEFAULT: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: '0.875rem',
    height: '2.5rem',
  },
  lg: {
    padding: `${spacing[2.5]} ${spacing[5]}`,
    fontSize: '1rem',
    height: '3rem',
  },
  icon: {
    padding: spacing[2],
    width: '2.5rem',
    height: '2.5rem',
  },
};

export const badgeVariants = {
  default: {
    backgroundColor: colors.slate[100],
    color: colors.slate[700],
  },
  primary: {
    backgroundColor: colors.blue[100],
    color: colors.blue[700],
  },
  success: {
    backgroundColor: colors.green[100],
    color: colors.green[700],
  },
  warning: {
    backgroundColor: colors.amber[100],
    color: colors.amber[700],
  },
  destructive: {
    backgroundColor: colors.red[100],
    color: colors.red[700],
  },
  purple: {
    backgroundColor: colors.purple[100],
    color: colors.purple[700],
  },
  outline: {
    backgroundColor: 'transparent',
    color: colors.slate[700],
    border: `1px solid ${colors.border}`,
  },
};

// Export default theme object
export const theme = {
  colors,
  shadows,
  radius,
  spacing,
  typography,
  gradients,
  transitions,
  zIndex,
  commonStyles,
  buttonVariants,
  buttonSizes,
  badgeVariants,
  formatCurrency,
  formatNumber,
  formatDate,
  cn,
};

export default theme;

