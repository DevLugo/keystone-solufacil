import cron from 'node-cron';

// Interfaz para la configuración de reporte
interface ReportConfig {
  id: string;
  name: string;
  isActive: boolean;
  schedule: {
    days: string[];
    hour: string;
    timezone?: string;
  };
  recipients: any[];
}

// Interfaz para el contexto de la base de datos
interface DatabaseContext {
  prisma: any;
}

// Mapa de tareas cron activas
const cronTasks = new Map<string, cron.ScheduledTask>();

// Función para convertir configuración a expresión cron
export const configToCronExpression = (config: ReportConfig): string => {
  console.log('🔍 DEBUG: Configuración recibida en configToCronExpression:', JSON.stringify(config, null, 2));
  console.log('🔍 DEBUG: config.schedule:', config.schedule);
  console.log('🔍 DEBUG: config.schedule.hour:', config.schedule?.hour);
  console.log('🔍 DEBUG: Tipo de config.schedule.hour:', typeof config.schedule?.hour);
  
  if (!config.isActive || !config.schedule?.days?.length) return '';
  
  // Extraer hora Y minuto del formato "HH:MM" o "HH"
  let hour: string;
  let minute: string;
  
  if (config.schedule.hour.includes(':')) {
    const [hourPart, minutePart] = config.schedule.hour.split(':');
    hour = hourPart;
    minute = minutePart;
  } else {
    hour = config.schedule.hour;
    minute = '0';
  }
  
  console.log(`🕐 Convirtiendo hora: ${config.schedule.hour} -> hora: ${hour}, minuto: ${minute}`);
  
  // Mapear días de la semana a formato cron (0 = Domingo, 1 = Lunes, etc.)
  const dayMap: { [key: string]: number } = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  const cronDays = config.schedule.days
    .map(day => dayMap[day])
    .filter(day => day !== undefined)
    .join(',');
  
  const cronExpression = `${minute} ${hour} * * ${cronDays}`;
  console.log(`📅 Expresión cron generada: ${cronExpression} para días: ${config.schedule.days.join(', ')}`);
  
  return cronExpression;
};

// Función para ejecutar un reporte programado
export const executeScheduledReport = async (
  config: ReportConfig, 
  context: DatabaseContext,
  sendReportFunction: (configId: string) => Promise<void>
) => {
  const startTime = new Date();
  
  try {
    console.log(`🚀 Ejecutando reporte programado: ${config.name}`);
    
    // Ejecutar el reporte
    await sendReportFunction(config.id);
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    console.log(`✅ Reporte programado ejecutado: ${config.name} en ${duration}ms`);
    
  } catch (error) {
    console.error(`❌ Error ejecutando reporte programado ${config.name}:`, error);
  }
};

// Función para programar una configuración
export const scheduleConfig = (
  config: ReportConfig, 
  context: DatabaseContext,
  sendReportFunction: (configId: string) => Promise<void>
) => {
  if (!config.isActive) return;
  
  const cronExpression = configToCronExpression(config);
  if (!cronExpression) return;
  
  // Detener tarea existente si existe
  const existingTask = cronTasks.get(config.id);
  if (existingTask) {
    existingTask.stop();
    cronTasks.delete(config.id);
  }
  
  // Crear nueva tarea cron
  const task = cron.schedule(cronExpression, () => {
    executeScheduledReport(config, context, sendReportFunction);
  }, {
    scheduled: true,
    timezone: config.schedule.timezone || 'America/Mexico_City'
  });
  
  // Guardar referencia a la tarea
  cronTasks.set(config.id, task);
  
  console.log(`📅 Reporte programado: ${config.name} - ${cronExpression}`);
};

// Función para desprogramar una configuración
export const unscheduleConfig = (configId: string) => {
  const task = cronTasks.get(configId);
  if (task) {
    task.stop();
    cronTasks.delete(configId);
    console.log(`⏹️ Reporte desprogramado: ${configId}`);
  }
};

// Función para reprogramar una configuración específica
export const rescheduleConfig = (
  config: ReportConfig, 
  context: DatabaseContext,
  sendReportFunction: (configId: string) => Promise<void>
) => {
  // Primero desprogramar
  unscheduleConfig(config.id);
  
  // Luego reprogramar si está activa
  if (config.isActive) {
    scheduleConfig(config, context, sendReportFunction);
  }
};

// Función para iniciar el sistema de cron
export const startCronSystem = (
  configs: ReportConfig[], 
  context: DatabaseContext,
  sendReportFunction: (configId: string) => Promise<void>
) => {
  console.log('🚀 Sistema de cron iniciado con node-cron');
  
  // Programar todas las configuraciones activas
  configs.forEach(config => {
    if (config.isActive) {
      scheduleConfig(config, context, sendReportFunction);
    }
  });
};

// Función para detener el sistema de cron
export const stopCronSystem = () => {
  console.log('⏹️ Sistema de cron detenido');
  
  // Detener todas las tareas
  cronTasks.forEach(task => task.stop());
  cronTasks.clear();
};

// Función para obtener el estado del sistema de cron
export const getCronStatus = () => {
  return {
    isRunning: cronTasks.size > 0,
    activeTasks: cronTasks.size,
    taskIds: Array.from(cronTasks.keys())
  };
};

// Función para limpiar todas las tareas
export const clearAllTasks = () => {
  cronTasks.forEach(task => task.stop());
  cronTasks.clear();
  console.log('🧹 Todas las tareas cron han sido limpiadas');
};
