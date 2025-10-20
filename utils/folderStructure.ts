/**
 * Sistema de configuración para estructura de carpetas en Cloudinary
 * Permite configurar fácilmente cómo se organizan los documentos
 */

export interface FolderStructureConfig {
  // Configuración base
  baseFolder: string;
  
  // Niveles de organización (en orden de jerarquía)
  levels: FolderLevel[];
  
  // Configuración de separadores
  separators: {
    level: string; // Separador entre niveles (ej: '/')
    word: string;  // Separador entre palabras (ej: '-')
  };
  
  // Configuración de limpieza de nombres
  nameCleaning: {
    enabled: boolean;
    lowercase: boolean;
    replaceSpaces: boolean;
    removeSpecialChars: boolean;
    maxLength?: number;
  };
}

export interface FolderLevel {
  type: 'year' | 'month' | 'route' | 'locality' | 'documentType' | 'clientName' | 'loanId' | 'custom';
  enabled: boolean;
  format?: string; // Para fechas: 'YYYY', 'MM', 'MM-MMMM'
  fallback?: string; // Valor por defecto si no se encuentra
  customValue?: string; // Para tipo 'custom'
}

// Configuraciones predefinidas
export const FOLDER_CONFIGS = {
  // Configuración actual (simple)
  SIMPLE: {
    baseFolder: 'documentos-personales',
    levels: [
      { type: 'custom', enabled: true, customValue: 'documentos-personales' }
    ],
    separators: { level: '/', word: '-' },
    nameCleaning: {
      enabled: false,
      lowercase: false,
      replaceSpaces: false,
      removeSpecialChars: false
    }
  } as FolderStructureConfig,

  // Configuración recomendada (año/mes/ruta/localidad/tipo)
  RECOMMENDED: {
    baseFolder: 'documentos-personales',
    levels: [
      { type: 'year', enabled: true, format: 'YYYY' },
      { type: 'month', enabled: true, format: 'MM-MMMM' },
      { type: 'route', enabled: true, fallback: 'sin-ruta' },
      { type: 'locality', enabled: true, fallback: 'sin-localidad' },
      { type: 'documentType', enabled: true, fallback: 'general' }
    ],
    separators: { level: '/', word: '-' },
    nameCleaning: {
      enabled: true,
      lowercase: true,
      replaceSpaces: true,
      removeSpecialChars: true,
      maxLength: 50
    }
  } as FolderStructureConfig,

  // Configuración por año y ruta únicamente
  YEAR_ROUTE: {
    baseFolder: 'documentos-personales',
    levels: [
      { type: 'year', enabled: true, format: 'YYYY' },
      { type: 'route', enabled: true, fallback: 'sin-ruta' }
    ],
    separators: { level: '/', word: '-' },
    nameCleaning: {
      enabled: true,
      lowercase: true,
      replaceSpaces: true,
      removeSpecialChars: true
    }
  } as FolderStructureConfig,

  // Configuración por mes y tipo de documento
  MONTH_DOCUMENT: {
    baseFolder: 'documentos-personales',
    levels: [
      { type: 'year', enabled: true, format: 'YYYY' },
      { type: 'month', enabled: true, format: 'MM-MMMM' },
      { type: 'documentType', enabled: true, fallback: 'general' }
    ],
    separators: { level: '/', word: '-' },
    nameCleaning: {
      enabled: true,
      lowercase: true,
      replaceSpaces: true,
      removeSpecialChars: true
    }
  } as FolderStructureConfig,

  // Configuración por año/mes/localidad/tipo (sin ruta)
  YEAR_MONTH_LOCALITY_DOCUMENT: {
    baseFolder: 'documentos-personales',
    levels: [
      { type: 'year', enabled: true, format: 'YYYY' },
      { type: 'month', enabled: true, format: 'MM-MMMM' },
      { type: 'locality', enabled: true, fallback: 'sin-localidad' },
      { type: 'documentType', enabled: true, fallback: 'general' }
    ],
    separators: { level: '/', word: '-' },
    nameCleaning: {
      enabled: true,
      lowercase: true,
      replaceSpaces: true,
      removeSpecialChars: true,
      maxLength: 50
    }
  } as FolderStructureConfig,

  // Configuración por año/mes/localidad/cliente (agrupado por ID de cliente)
  YEAR_MONTH_LOCALITY_CLIENT: {
    baseFolder: 'documentos-personales',
    levels: [
      { type: 'year', enabled: true, format: 'YYYY' },
      { type: 'month', enabled: true, format: 'MM-MMMM' },
      { type: 'locality', enabled: true, fallback: 'sin-localidad' },
      { type: 'clientName', enabled: true, fallback: 'sin-id' }
    ],
    separators: { level: '/', word: '-' },
    nameCleaning: {
      enabled: true,
      lowercase: true,
      replaceSpaces: true,
      removeSpecialChars: true,
      maxLength: 50
    }
  } as FolderStructureConfig,

  // Configuración por año/mes/localidad/loan (agrupado por ID de loan)
  YEAR_MONTH_LOCALITY_LOAN: {
    baseFolder: 'documentos-personales',
    levels: [
      { type: 'year', enabled: true, format: 'YYYY' },
      { type: 'month', enabled: true, format: 'MM-MMMM' },
      { type: 'locality', enabled: true, fallback: 'sin-localidad' },
      { type: 'loanId', enabled: true, fallback: 'sin-loan' }
    ],
    separators: { level: '/', word: '-' },
    nameCleaning: {
      enabled: true,
      lowercase: true,
      replaceSpaces: true,
      removeSpecialChars: true,
      maxLength: 50
    }
  } as FolderStructureConfig
};

// Configuración activa (fácil de cambiar)
export const ACTIVE_CONFIG = FOLDER_CONFIGS.YEAR_MONTH_LOCALITY_LOAN;

/**
 * Limpia un nombre para usar en URLs/carpetas
 */
export function cleanName(name: string, config: FolderStructureConfig): string {
  if (!config.nameCleaning.enabled) {
    return name;
  }

  let cleaned = name;

  if (config.nameCleaning.lowercase) {
    cleaned = cleaned.toLowerCase();
  }

  if (config.nameCleaning.replaceSpaces) {
    cleaned = cleaned.replace(/\s+/g, config.separators.word);
  }

  if (config.nameCleaning.removeSpecialChars) {
    // Mantener solo letras, números, guiones y guiones bajos
    cleaned = cleaned.replace(/[^a-z0-9\-_]/gi, '');
  }

  if (config.nameCleaning.maxLength && cleaned.length > config.nameCleaning.maxLength) {
    cleaned = cleaned.substring(0, config.nameCleaning.maxLength);
  }

  return cleaned;
}

/**
 * Formatea una fecha según la configuración
 */
export function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  switch (format) {
    case 'YYYY':
      return year.toString();
    case 'MM':
      return String(month).padStart(2, '0');
    case 'MM-MMMM':
      return `${String(month).padStart(2, '0')}-${monthNames[month - 1]}`;
    case 'MMMM':
      return monthNames[month - 1];
    default:
      return format
        .replace('YYYY', year.toString())
        .replace('MM', String(month).padStart(2, '0'))
        .replace('MMMM', monthNames[month - 1]);
  }
}

/**
 * Obtiene el valor para un nivel específico
 */
export function getLevelValue(
  level: FolderLevel,
  data: {
    loan?: any;
    documentType?: string;
    customData?: Record<string, any>;
  }
): string {
  if (!level.enabled) {
    return '';
  }

  switch (level.type) {
    case 'year':
      if (data.loan?.signDate) {
        return formatDate(new Date(data.loan.signDate), level.format || 'YYYY');
      }
      return formatDate(new Date(), level.format || 'YYYY');

    case 'month':
      if (data.loan?.signDate) {
        return formatDate(new Date(data.loan.signDate), level.format || 'MM-MMMM');
      }
      return formatDate(new Date(), level.format || 'MM-MMMM');

    case 'route':
      const routeName = data.loan?.lead?.routes?.[0]?.name || 
                       data.loan?.lead?.route?.name;
      return routeName || level.fallback || 'sin-ruta';

    case 'locality':
      const locality = data.loan?.lead?.personalData?.addresses?.[0]?.location?.name;
      return locality || level.fallback || 'sin-localidad';

    case 'documentType':
      return data.documentType || level.fallback || 'general';

    case 'clientName':
      // Usar el ID del personal data del titular (borrower) como identificador único del cliente
      const clientId = data.loan?.borrower?.personalData?.id;
      return clientId || level.fallback || 'sin-id';

    case 'loanId':
      // Usar el ID del loan como identificador único
      const loanId = data.loan?.id;
      return loanId || level.fallback || 'sin-loan';

    case 'custom':
      return level.customValue || '';

    default:
      return level.fallback || '';
  }
}

/**
 * Genera la ruta de carpeta completa según la configuración
 */
export function generateFolderPath(
  data: {
    loan?: any;
    documentType?: string;
    customData?: Record<string, any>;
  },
  config: FolderStructureConfig = ACTIVE_CONFIG
): string {
  const pathParts: string[] = [];

  // Agregar carpeta base
  if (config.baseFolder) {
    pathParts.push(config.baseFolder);
  }

  // Procesar cada nivel
  for (const level of config.levels) {
    if (!level.enabled) continue;

    const value = getLevelValue(level, data);
    if (value) {
      const cleanedValue = cleanName(value, config);
      if (cleanedValue) {
        pathParts.push(cleanedValue);
      }
    }
  }

  return pathParts.join(config.separators.level);
}

/**
 * Función de conveniencia para generar paths con la configuración activa
 */
export function getDocumentFolderPath(
  loan: any,
  documentType: string
): string {
  return generateFolderPath(
    { loan, documentType },
    ACTIVE_CONFIG
  );
}

/**
 * Función para cambiar la configuración activa
 */
export function setActiveConfig(configName: keyof typeof FOLDER_CONFIGS): void {
  // Esta función sería útil para cambiar la configuración en runtime
  // Por ahora, simplemente exportamos la configuración activa
  console.log(`Configuración de carpetas cambiada a: ${configName}`);
}

/**
 * Obtiene información sobre la configuración actual
 */
export function getConfigInfo(): {
  name: string;
  description: string;
  levels: string[];
} {
  const config = ACTIVE_CONFIG;
  const levelNames = config.levels
    .filter(level => level.enabled)
    .map(level => level.type);

  return {
    name: 'Configuración Activa',
    description: `Estructura: ${levelNames.join(' → ')}`,
    levels: levelNames
  };
}
