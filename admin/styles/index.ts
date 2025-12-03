/**
 * Sistema de Diseño Unificado - Solufacil
 * 
 * Archivo de índice que exporta todos los tokens y estilos de diseño.
 * 
 * Uso:
 * import { colors, buttonStyles, formatCurrency } from '../styles';
 */

// Re-export everything from theme
export {
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
  theme,
} from './theme';

// Re-export everything from components
export {
  buttonStyles,
  cardStyles,
  badgeStyles,
  inputStyles,
  tableStyles,
  modalStyles,
  dropdownStyles,
  statCardStyles,
  loadingStyles,
  emptyStateStyles,
  pageStyles,
  fabStyles,
  styles,
} from './components';
