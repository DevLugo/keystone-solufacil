/**
 * Componentes de Estilo Unificados - Solufacil
 * 
 * Este archivo contiene los estilos de componentes reutilizables
 * que se usan en toda la aplicación.
 * 
 * Uso con Emotion CSS-in-JS:
 * import { buttonStyles, cardStyles } from '../styles/components';
 * <button css={buttonStyles.primary}>Click me</button>
 */

import { 
  colors, 
  shadows, 
  radius, 
  spacing, 
  typography, 
  gradients, 
  transitions 
} from './theme';

// =============================================================================
// BOTONES
// =============================================================================

const buttonBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing[2],
  fontWeight: typography.fontWeight.semibold,
  borderRadius: radius.lg,
  cursor: 'pointer',
  transition: transitions.fast,
  outline: 'none',
  whiteSpace: 'nowrap' as const,
  userSelect: 'none' as const,
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export const buttonStyles = {
  // Variantes
  primary: {
    ...buttonBase,
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
    border: 'none',
    boxShadow: shadows.primarySm,
    '&:hover:not(:disabled)': {
      backgroundColor: colors.primaryHover,
      boxShadow: shadows.primaryMd,
      transform: 'translateY(-1px)',
    },
    '&:active:not(:disabled)': {
      transform: 'translateY(0)',
    },
  },
  secondary: {
    ...buttonBase,
    backgroundColor: colors.secondary,
    color: colors.secondaryForeground,
    border: `1px solid ${colors.border}`,
    '&:hover:not(:disabled)': {
      backgroundColor: colors.secondaryHover,
      borderColor: colors.slate[300],
    },
  },
  outline: {
    ...buttonBase,
    backgroundColor: 'transparent',
    color: colors.foreground,
    border: `1px solid ${colors.border}`,
    '&:hover:not(:disabled)': {
      backgroundColor: colors.slate[50],
      borderColor: colors.slate[300],
    },
  },
  ghost: {
    ...buttonBase,
    backgroundColor: 'transparent',
    color: colors.foreground,
    border: 'none',
    '&:hover:not(:disabled)': {
      backgroundColor: colors.slate[100],
    },
  },
  destructive: {
    ...buttonBase,
    backgroundColor: colors.destructive,
    color: colors.destructiveForeground,
    border: 'none',
    boxShadow: shadows.destructiveSm,
    '&:hover:not(:disabled)': {
      backgroundColor: colors.destructiveHover,
      boxShadow: shadows.destructiveMd,
      transform: 'translateY(-1px)',
    },
  },
  success: {
    ...buttonBase,
    backgroundColor: colors.success,
    color: colors.successForeground,
    border: 'none',
    boxShadow: shadows.successSm,
    '&:hover:not(:disabled)': {
      backgroundColor: colors.successHover,
      boxShadow: shadows.successMd,
      transform: 'translateY(-1px)',
    },
  },
  warning: {
    ...buttonBase,
    backgroundColor: colors.warning,
    color: colors.warningForeground,
    border: 'none',
    '&:hover:not(:disabled)': {
      backgroundColor: colors.warningHover,
      transform: 'translateY(-1px)',
    },
  },
  link: {
    ...buttonBase,
    backgroundColor: 'transparent',
    color: colors.primary,
    border: 'none',
    padding: 0,
    height: 'auto',
    '&:hover:not(:disabled)': {
      textDecoration: 'underline',
    },
  },
  
  // Tamaños
  sm: {
    padding: `${spacing[1.5]} ${spacing[3]}`,
    fontSize: '0.75rem',
    height: '2rem',
    borderRadius: radius.md,
  },
  md: {
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
  iconSm: {
    padding: spacing[1.5],
    width: '2rem',
    height: '2rem',
  },
};

// =============================================================================
// CARDS
// =============================================================================

export const cardStyles = {
  base: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.lg,
    overflow: 'hidden',
    transition: transitions.DEFAULT,
  },
  hoverable: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.lg,
    overflow: 'hidden',
    transition: transitions.DEFAULT,
    '&:hover': {
      boxShadow: shadows.xl,
      transform: 'translateY(-2px)',
    },
  },
  compact: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.sm,
    overflow: 'hidden',
    transition: transitions.fast,
  },
  flat: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    border: 'none',
    boxShadow: shadows.xl,
    overflow: 'hidden',
    transition: transitions.DEFAULT,
  },
  gradient: {
    background: gradients.cardBackground,
    borderRadius: radius['2xl'],
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.lg,
    overflow: 'hidden',
  },
  header: {
    padding: `${spacing[4]} ${spacing[6]}`,
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.slate[50],
  },
  body: {
    padding: spacing[6],
  },
  footer: {
    padding: `${spacing[4]} ${spacing[6]}`,
    borderTop: `1px solid ${colors.border}`,
    backgroundColor: colors.slate[50],
  },
};

// =============================================================================
// BADGES
// =============================================================================

const badgeBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: spacing[1],
  padding: `${spacing[1]} ${spacing[2]}`,
  fontSize: '0.75rem',
  fontWeight: typography.fontWeight.medium,
  borderRadius: radius.md,
  whiteSpace: 'nowrap' as const,
  lineHeight: 1,
};

export const badgeStyles = {
  default: {
    ...badgeBase,
    backgroundColor: colors.slate[100],
    color: colors.slate[700],
  },
  primary: {
    ...badgeBase,
    backgroundColor: colors.blue[100],
    color: colors.blue[700],
  },
  success: {
    ...badgeBase,
    backgroundColor: colors.green[100],
    color: colors.green[700],
  },
  warning: {
    ...badgeBase,
    backgroundColor: colors.amber[100],
    color: colors.amber[700],
  },
  destructive: {
    ...badgeBase,
    backgroundColor: colors.red[100],
    color: colors.red[700],
  },
  purple: {
    ...badgeBase,
    backgroundColor: colors.purple[100],
    color: colors.purple[700],
  },
  teal: {
    ...badgeBase,
    backgroundColor: colors.teal[100],
    color: colors.teal[700],
  },
  outline: {
    ...badgeBase,
    backgroundColor: 'transparent',
    color: colors.slate[700],
    border: `1px solid ${colors.border}`,
  },
  // Solid variants (más llamativos)
  solidPrimary: {
    ...badgeBase,
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
  },
  solidSuccess: {
    ...badgeBase,
    backgroundColor: colors.success,
    color: colors.successForeground,
  },
  solidDestructive: {
    ...badgeBase,
    backgroundColor: colors.destructive,
    color: colors.destructiveForeground,
  },
};

// =============================================================================
// INPUTS
// =============================================================================

export const inputStyles = {
  base: {
    width: '100%',
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: '0.875rem',
    lineHeight: '1.5',
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
    '&:disabled': {
      backgroundColor: colors.slate[100],
      cursor: 'not-allowed',
      opacity: 0.7,
    },
  },
  sm: {
    padding: `${spacing[1.5]} ${spacing[2.5]}`,
    fontSize: '0.75rem',
    height: '2rem',
  },
  lg: {
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: '1rem',
    height: '3rem',
  },
  error: {
    borderColor: colors.destructive,
    '&:focus': {
      borderColor: colors.destructive,
      boxShadow: `0 0 0 3px ${colors.red[100]}`,
    },
  },
  success: {
    borderColor: colors.success,
    '&:focus': {
      borderColor: colors.success,
      boxShadow: `0 0 0 3px ${colors.green[100]}`,
    },
  },
};

// =============================================================================
// TABLAS
// =============================================================================

export const tableStyles = {
  container: {
    width: '100%',
    overflowX: 'auto' as const,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    border: `1px solid ${colors.border}`,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.875rem',
  },
  header: {
    padding: `${spacing[3]} ${spacing[4]}`,
    textAlign: 'left' as const,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    backgroundColor: colors.slate[50],
    borderBottom: `1px solid ${colors.border}`,
    whiteSpace: 'nowrap' as const,
  },
  cell: {
    padding: `${spacing[3]} ${spacing[4]}`,
    color: colors.foreground,
    borderBottom: `1px solid ${colors.border}`,
    verticalAlign: 'middle' as const,
  },
  row: {
    transition: transitions.fast,
    '&:hover': {
      backgroundColor: colors.slate[50],
    },
  },
  rowHighlighted: {
    backgroundColor: colors.blue[50],
    '&:hover': {
      backgroundColor: colors.blue[100],
    },
  },
};

// =============================================================================
// MODALES
// =============================================================================

export const modalStyles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
    padding: spacing[4],
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    boxShadow: shadows['2xl'],
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  containerLg: {
    maxWidth: '800px',
  },
  containerXl: {
    maxWidth: '1000px',
  },
  header: {
    padding: spacing[6],
    borderBottom: `1px solid ${colors.border}`,
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: typography.fontWeight.semibold,
    color: colors.foreground,
    margin: 0,
  },
  description: {
    fontSize: '0.875rem',
    color: colors.mutedForeground,
    marginTop: spacing[2],
  },
  body: {
    padding: spacing[6],
  },
  footer: {
    padding: spacing[6],
    borderTop: `1px solid ${colors.border}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing[3],
  },
};

// =============================================================================
// DROPDOWNS / AUTOCOMPLETE
// =============================================================================

export const dropdownStyles = {
  container: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing[1],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.lg,
    zIndex: 50,
    maxHeight: '300px',
    overflowY: 'auto' as const,
    padding: spacing[1],
  },
  item: {
    padding: `${spacing[2]} ${spacing[3]}`,
    borderRadius: radius.lg,
    cursor: 'pointer',
    transition: transitions.fast,
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    '&:hover': {
      backgroundColor: colors.slate[50],
    },
  },
  itemActive: {
    backgroundColor: colors.blue[50],
    '&:hover': {
      backgroundColor: colors.blue[100],
    },
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    '&:hover': {
      backgroundColor: 'transparent',
    },
  },
  separator: {
    height: '1px',
    backgroundColor: colors.border,
    margin: `${spacing[1]} 0`,
  },
  label: {
    padding: `${spacing[1.5]} ${spacing[3]}`,
    fontSize: '0.75rem',
    fontWeight: typography.fontWeight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase' as const,
  },
};

// =============================================================================
// STAT CARDS (KPIs)
// =============================================================================

export const statCardStyles = {
  container: {
    borderRadius: radius['2xl'],
    padding: spacing[5],
    color: 'white',
    position: 'relative' as const,
    overflow: 'hidden',
    boxShadow: shadows.lg,
    transition: transitions.DEFAULT,
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: shadows.xl,
    },
  },
  icon: {
    width: '3.5rem',
    height: '3.5rem',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: '0.875rem',
    fontWeight: typography.fontWeight.medium,
    opacity: 0.9,
    marginBottom: spacing[1],
  },
  value: {
    fontSize: '1.75rem',
    fontWeight: typography.fontWeight.bold,
    lineHeight: 1.2,
  },
  trend: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2],
    padding: `${spacing[1]} ${spacing[2]}`,
    borderRadius: radius.full,
    fontSize: '0.75rem',
    fontWeight: typography.fontWeight.medium,
  },
  trendPositive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  trendNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
};

// =============================================================================
// LOADING STATES
// =============================================================================

export const loadingStyles = {
  container: {
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
  pulse: {
    position: 'absolute' as const,
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
    animation: 'pulse 2s ease-in-out infinite',
  },
  spinner: {
    width: '60px',
    height: '60px',
    border: `4px solid ${colors.slate[200]}`,
    borderTop: `4px solid ${colors.blue[500]}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: spacing[5],
    position: 'relative' as const,
    zIndex: 1,
  },
  text: {
    fontSize: '1.125rem',
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
    marginBottom: spacing[2],
    position: 'relative' as const,
    zIndex: 1,
  },
  subtext: {
    fontSize: '0.875rem',
    color: colors.slate[500],
    position: 'relative' as const,
    zIndex: 1,
  },
  keyframes: `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }
  `,
};

// =============================================================================
// EMPTY STATES
// =============================================================================

export const emptyStateStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[12],
    textAlign: 'center' as const,
  },
  icon: {
    width: '4rem',
    height: '4rem',
    backgroundColor: colors.slate[100],
    borderRadius: radius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    color: colors.slate[400],
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: typography.fontWeight.semibold,
    color: colors.foreground,
    marginBottom: spacing[2],
  },
  description: {
    fontSize: '0.875rem',
    color: colors.mutedForeground,
    maxWidth: '400px',
  },
};

// =============================================================================
// PAGE LAYOUT
// =============================================================================

export const pageStyles = {
  container: {
    padding: spacing[6],
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: colors.slate[50],
    minHeight: '100vh',
  },
  header: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: typography.fontWeight.bold,
    color: colors.foreground,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: '0.875rem',
    color: colors.mutedForeground,
  },
  section: {
    marginBottom: spacing[8],
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    marginBottom: spacing[4],
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: spacing[6],
    '@media (min-width: 768px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: spacing[6],
    '@media (min-width: 768px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (min-width: 1024px)': {
      gridTemplateColumns: 'repeat(3, 1fr)',
    },
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: spacing[6],
    '@media (min-width: 768px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (min-width: 1024px)': {
      gridTemplateColumns: 'repeat(4, 1fr)',
    },
  },
};

// =============================================================================
// FLOATING ACTION BUTTON
// =============================================================================

export const fabStyles = {
  button: {
    position: 'fixed' as const,
    bottom: spacing[8],
    right: spacing[8],
    padding: `${spacing[4]} ${spacing[6]}`,
    borderRadius: radius['2xl'],
    boxShadow: shadows.xl,
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    fontWeight: typography.fontWeight.semibold,
    fontSize: '1rem',
    border: 'none',
    cursor: 'pointer',
    transition: transitions.DEFAULT,
    zIndex: 100,
    '&:hover': {
      transform: 'scale(1.05) translateY(-2px)',
    },
  },
  badge: {
    backgroundColor: colors.red[500],
    color: 'white',
    borderRadius: radius.full,
    width: '1.5rem',
    height: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: typography.fontWeight.bold,
  },
};

// Export all styles
export const styles = {
  button: buttonStyles,
  card: cardStyles,
  badge: badgeStyles,
  input: inputStyles,
  table: tableStyles,
  modal: modalStyles,
  dropdown: dropdownStyles,
  statCard: statCardStyles,
  loading: loadingStyles,
  emptyState: emptyStateStyles,
  page: pageStyles,
  fab: fabStyles,
};

export default styles;

