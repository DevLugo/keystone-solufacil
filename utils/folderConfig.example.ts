/**
 * EJEMPLO: Cómo cambiar la configuración de estructura de carpetas
 * 
 * Para cambiar la estructura, simplemente modifica la línea en folderStructure.ts:
 * 
 * export const ACTIVE_CONFIG = FOLDER_CONFIGS.RECOMMENDED;
 * 
 * Por cualquiera de estas opciones:
 */

import { FOLDER_CONFIGS, FolderStructureConfig } from './folderStructure';

// ========================================
// OPCIONES PREDEFINIDAS DISPONIBLES
// ========================================

// 1. ESTRUCTURA RECOMENDADA (Actual por defecto)
// documentos-personales/2025/01-enero/ruta-1/localidad-a/ine/
export const CONFIG_RECOMMENDED = FOLDER_CONFIGS.RECOMMENDED;

// 2. ESTRUCTURA SIMPLE (Como estaba antes)
// documentos-personales/
export const CONFIG_SIMPLE = FOLDER_CONFIGS.SIMPLE;

// 3. SOLO AÑO Y RUTA
// documentos-personales/2025/ruta-1/
export const CONFIG_YEAR_ROUTE = FOLDER_CONFIGS.YEAR_ROUTE;

// 4. AÑO, MES Y TIPO DE DOCUMENTO
// documentos-personales/2025/01-enero/ine/
export const CONFIG_MONTH_DOCUMENT = FOLDER_CONFIGS.MONTH_DOCUMENT;

// ========================================
// CONFIGURACIONES PERSONALIZADAS
// ========================================

// 5. SOLO POR AÑO
export const CONFIG_YEAR_ONLY: FolderStructureConfig = {
  baseFolder: 'documentos-personales',
  levels: [
    { type: 'year', enabled: true, format: 'YYYY' }
  ],
  separators: { level: '/', word: '-' },
  nameCleaning: {
    enabled: true,
    lowercase: true,
    replaceSpaces: true,
    removeSpecialChars: true
  }
};

// 6. POR RUTA Y TIPO DE DOCUMENTO
export const CONFIG_ROUTE_DOCUMENT: FolderStructureConfig = {
  baseFolder: 'documentos-personales',
  levels: [
    { type: 'route', enabled: true, fallback: 'sin-ruta' },
    { type: 'documentType', enabled: true, fallback: 'general' }
  ],
  separators: { level: '/', word: '-' },
  nameCleaning: {
    enabled: true,
    lowercase: true,
    replaceSpaces: true,
    removeSpecialChars: true
  }
};

// 7. ESTRUCTURA COMPACTA (Año-Mes-Ruta)
export const CONFIG_COMPACT: FolderStructureConfig = {
  baseFolder: 'docs',
  levels: [
    { type: 'year', enabled: true, format: 'YYYY' },
    { type: 'month', enabled: true, format: 'MM' },
    { type: 'route', enabled: true, fallback: 'general' }
  ],
  separators: { level: '/', word: '_' },
  nameCleaning: {
    enabled: true,
    lowercase: true,
    replaceSpaces: true,
    removeSpecialChars: true,
    maxLength: 20
  }
};

// 8. ESTRUCTURA PARA AUDITORÍA (Año-Mes-Día-Ruta)
export const CONFIG_AUDIT: FolderStructureConfig = {
  baseFolder: 'documentos-personales',
  levels: [
    { type: 'year', enabled: true, format: 'YYYY' },
    { type: 'month', enabled: true, format: 'MM-MMMM' },
    { type: 'custom', enabled: true, customValue: 'auditoria' },
    { type: 'route', enabled: true, fallback: 'sin-ruta' }
  ],
  separators: { level: '/', word: '-' },
  nameCleaning: {
    enabled: true,
    lowercase: true,
    replaceSpaces: true,
    removeSpecialChars: true
  }
};

// ========================================
// CÓMO CAMBIAR LA CONFIGURACIÓN
// ========================================

/*
PASO 1: Abrir el archivo utils/folderStructure.ts

PASO 2: Cambiar esta línea:
export const ACTIVE_CONFIG = FOLDER_CONFIGS.RECOMMENDED;

Por cualquiera de estas opciones:

// Para estructura simple (como antes)
export const ACTIVE_CONFIG = FOLDER_CONFIGS.SIMPLE;

// Para solo año y ruta
export const ACTIVE_CONFIG = FOLDER_CONFIGS.YEAR_ROUTE;

// Para configuración personalizada
export const ACTIVE_CONFIG = CONFIG_YEAR_ONLY;

PASO 3: Guardar el archivo

PASO 4: Reiniciar el servidor (si es necesario)

¡Listo! Los nuevos documentos se organizarán con la nueva estructura.
*/

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================

/**
 * Función para probar diferentes configuraciones
 */
export function testFolderStructure(loan: any, documentType: string) {
  const configs = [
    { name: 'RECOMMENDED', config: FOLDER_CONFIGS.RECOMMENDED },
    { name: 'SIMPLE', config: FOLDER_CONFIGS.SIMPLE },
    { name: 'YEAR_ROUTE', config: FOLDER_CONFIGS.YEAR_ROUTE },
    { name: 'MONTH_DOCUMENT', config: FOLDER_CONFIGS.MONTH_DOCUMENT },
    { name: 'YEAR_ONLY', config: CONFIG_YEAR_ONLY },
    { name: 'ROUTE_DOCUMENT', config: CONFIG_ROUTE_DOCUMENT },
    { name: 'COMPACT', config: CONFIG_COMPACT },
    { name: 'AUDIT', config: CONFIG_AUDIT }
  ];

  console.log('=== PRUEBA DE ESTRUCTURAS DE CARPETAS ===');
  console.log(`Préstamo: ${loan?.id || 'N/A'}`);
  console.log(`Tipo: ${documentType}`);
  console.log('');

  configs.forEach(({ name, config }) => {
    const { generateFolderPath } = require('./folderStructure');
    const path = generateFolderPath({ loan, documentType }, config);
    console.log(`${name.padEnd(15)}: ${path}`);
  });
}

/**
 * Función para obtener información de la configuración actual
 */
export function getCurrentConfigInfo() {
  const { getConfigInfo } = require('./folderStructure');
  return getConfigInfo();
}
