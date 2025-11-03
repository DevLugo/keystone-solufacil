/**
 * EJEMPLOS DE ESTRUCTURA DE CARPETAS
 * 
 * Este archivo muestra ejemplos de cómo se verían las estructuras de carpetas
 * con diferentes configuraciones.
 */

console.log('🔧 SISTEMA DE ESTRUCTURA DE CARPETAS CONFIGURABLE');
console.log('='.repeat(60));
console.log('');

// Datos de ejemplo
const sampleLoan = {
  id: 'loan_123',
  signDate: '2025-01-15T10:30:00.000Z',
  lead: {
    routes: [{ name: 'Ruta Centro' }],
    personalData: {
      addresses: [{
        location: {
          name: 'Vicente Guerrero',
          municipality: {
            state: { name: 'Michoacán' }
          }
        }
      }]
    }
  }
};

const documentTypes = ['INE', 'DOMICILIO', 'PAGARE'];

console.log('📋 CONFIGURACIÓN ACTUAL: RECOMMENDED');
console.log('   Descripción: año → mes → ruta → localidad → tipo-documento');
console.log('');

// Ejemplos de estructuras
console.log('📁 EJEMPLOS DE ESTRUCTURAS:');
console.log('');

console.log('1. RECOMMENDED (Actual):');
console.log('   documentos-personales/2025/01-enero/ruta-centro/vicente-guerrero/ine/');
console.log('   documentos-personales/2025/01-enero/ruta-centro/vicente-guerrero/domicilio/');
console.log('   documentos-personales/2025/01-enero/ruta-centro/vicente-guerrero/pagare/');
console.log('');

console.log('2. SIMPLE (Como antes):');
console.log('   documentos-personales/');
console.log('   (todos los archivos en la misma carpeta)');
console.log('');

console.log('3. YEAR_ROUTE:');
console.log('   documentos-personales/2025/ruta-centro/');
console.log('   (organizado por año y ruta únicamente)');
console.log('');

console.log('4. MONTH_DOCUMENT:');
console.log('   documentos-personales/2025/01-enero/ine/');
console.log('   documentos-personales/2025/01-enero/domicilio/');
console.log('   documentos-personales/2025/01-enero/pagare/');
console.log('');

console.log('5. CONFIGURACIÓN PERSONALIZADA (Año + Ruta):');
console.log('   mis-documentos/2025/ruta_centro/');
console.log('   (con separador _ y carpeta base personalizada)');
console.log('');

console.log('⚠️  CASOS EDGE:');
console.log('');

console.log('Préstamo sin ruta:');
console.log('   documentos-personales/2025/01-enero/sin-ruta/vicente-guerrero/ine/');
console.log('');

console.log('Préstamo sin localidad:');
console.log('   documentos-personales/2025/01-enero/ruta-centro/sin-localidad/ine/');
console.log('');

// Instrucciones de uso
console.log('📖 INSTRUCCIONES DE USO:');
console.log('='.repeat(60));
console.log('');
console.log('1. Para cambiar la configuración:');
console.log('   Editar utils/folderStructure.ts');
console.log('   Cambiar: export const ACTIVE_CONFIG = FOLDER_CONFIGS.RECOMMENDED;');
console.log('   Por: export const ACTIVE_CONFIG = FOLDER_CONFIGS.SIMPLE;');
console.log('');
console.log('2. Para usar en el código:');
console.log('   import { getDocumentFolderPath } from "./utils/folderStructure";');
console.log('   const path = getDocumentFolderPath(loan, "INE");');
console.log('');
console.log('3. Para configuración personalizada:');
console.log('   import { generateFolderPath, FOLDER_CONFIGS } from "./utils/folderStructure";');
console.log('   const path = generateFolderPath({ loan, documentType }, customConfig);');
console.log('');
console.log('✅ Sistema listo para usar!');
