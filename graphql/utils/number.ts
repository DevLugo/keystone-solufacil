// Helper function to safely convert Decimal or any value to number
export function safeToNumber(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }
  
  // Si es un objeto Decimal de Prisma
  if (typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber();
  }
  
  // Si es un string, convertir a número
  if (typeof value === 'string') {
    return parseFloat(value) || 0;
  }
  
  // Si es un número, devolverlo directamente
  if (typeof value === 'number') {
    return value;
  }
  
  // Fallback: intentar convertir a string y luego a número
  try {
    return parseFloat(String(value)) || 0;
  } catch {
    return 0;
  }
}