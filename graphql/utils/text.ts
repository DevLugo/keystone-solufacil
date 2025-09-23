export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Reemplazar caracteres especiales que pueden causar problemas en PDF
  return text
    .replace(/[^\x20-\x7E\u00C0-\u024F\u1E00-\u1EFF]/g, '') // Mantener solo caracteres ASCII extendidos y latinos
    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
    .trim();
}
