import { startCronSystem, stopCronSystem } from './cronService';

// Función para enviar reportes (será implementada por Keystone)
let sendReportFunction: ((configId: string) => Promise<void>) | null = null;

// Función para obtener configuraciones (será implementada por Keystone)
let getConfigsFunction: (() => Promise<any[]>) | null = null;

// Función para obtener contexto de base de datos (será implementada por Keystone)
let getContextFunction: (() => Promise<any>) | null = null;

// Estado del sistema
let isInitialized = false;

// Inicializar el sistema de cron
export const initializeCronSystem = (
  sendReport: (configId: string) => Promise<void>,
  getConfigs: () => Promise<any[]>,
  getContext: () => Promise<any>
) => {
  sendReportFunction = sendReport;
  getConfigsFunction = getConfigs;
  getContextFunction = getContext;
  isInitialized = true;
  
  console.log('✅ Sistema de cron inicializado');
};

// Iniciar el sistema de cron
export const startCron = async () => {
  if (!isInitialized) {
    throw new Error('Sistema de cron no inicializado');
  }
  
  try {
    const configs = await getConfigsFunction!();
    const context = await getContextFunction!();
    
    startCronSystem(configs, context, sendReportFunction!);
    console.log('🚀 Sistema de cron iniciado');
    return true;
  } catch (error) {
    console.error('❌ Error iniciando cron:', error);
    throw error;
  }
};

// Detener el sistema de cron
export const stopCron = () => {
  if (!isInitialized) {
    throw new Error('Sistema de cron no inicializado');
  }
  
  try {
    stopCronSystem();
    console.log('⏹️ Sistema de cron detenido');
    return true;
  } catch (error) {
    console.error('❌ Error deteniendo cron:', error);
    throw error;
  }
};

// Verificar si está inicializado
export const isCronInitialized = () => isInitialized;

// Obtener funciones del sistema
export const getCronFunctions = () => ({
  sendReportFunction,
  getConfigsFunction,
  getContextFunction
});
