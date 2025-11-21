/**
 * Format a number as currency with MXN locale
 * Always displays 2 decimal places
 * 
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export const formatCurrency = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle invalid numbers
  if (isNaN(numAmount)) {
    return '$0.00';
  }
  
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

/**
 * Format a number as currency without the currency symbol
 * Useful for input fields
 * 
 * @param amount - The amount to format
 * @returns Formatted number string (e.g., "1,234.56")
 */
export const formatAmount = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '0.00';
  }
  
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

/**
 * Parse a formatted currency string to a number
 * 
 * @param value - The formatted string to parse
 * @returns Parsed number
 */
export const parseCurrency = (value: string): number => {
  // Remove currency symbols, spaces, and commas
  const cleaned = value.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};
