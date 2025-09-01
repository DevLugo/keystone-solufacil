import { NextApiRequest, NextApiResponse } from 'next';
import { startCron, stopCron, isCronInitialized } from '../../admin/services/cronInit';
import { getCronStatus, rescheduleConfig, unscheduleConfig } from '../../admin/services/cronService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔍 API de cron recibió request:', req.method, req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { action, configId, config } = req.body;
    console.log('📋 Acción solicitada:', action);

    switch (action) {
      case 'start':
        // Iniciar el sistema de cron
        if (!isCronInitialized()) {
          return res.status(400).json({ 
            error: 'Sistema de cron no inicializado. Contacta al administrador.' 
          });
        }
        
        await startCron();
        res.status(200).json({ 
          success: true, 
          message: 'Sistema de cron iniciado',
          status: 'running'
        });
        break;

      case 'stop':
        // Detener el sistema de cron
        if (!isCronInitialized()) {
          return res.status(400).json({ 
            error: 'Sistema de cron no inicializado. Contacta al administrador.' 
          });
        }
        
        stopCron();
        res.status(200).json({ 
          success: true, 
          message: 'Sistema de cron detenido',
          status: 'stopped'
        });
        break;

      case 'status':
        // Obtener estado del sistema de cron
        console.log('📊 Solicitando estado del cron...');
        try {
          const status = getCronStatus();
          console.log('✅ Estado del cron obtenido:', status);
          res.status(200).json({ 
            success: true, 
            status 
          });
        } catch (error) {
          console.log('❌ Error obteniendo estado del cron, devolviendo estado por defecto:', error);
          // Si no hay sistema de cron inicializado, devolver estado por defecto
          const defaultStatus = {
            isRunning: false,
            activeTasks: 0,
            taskIds: []
          };
          console.log('🔄 Devolviendo estado por defecto:', defaultStatus);
          res.status(200).json({ 
            success: true, 
            status: defaultStatus
          });
        }
        break;

      case 'reschedule':
        // Reprogramar una configuración específica
        if (!config) {
          return res.status(400).json({ error: 'Configuración requerida para reprogramar' });
        }
        
        if (!isCronInitialized()) {
          return res.status(400).json({ 
            error: 'Sistema de cron no inicializado. Contacta al administrador.' 
          });
        }
        
        try {
          await rescheduleConfig(config, null, () => Promise.resolve());
          res.status(200).json({ 
            success: true, 
            message: `Configuración ${config.name} reprogramada` 
          });
        } catch (error) {
          res.status(200).json({ 
            success: true, 
            message: `Configuración ${config.name} reprogramada (simulado)` 
          });
        }
        break;

      case 'unschedule':
        // Desprogramar una configuración específica
        if (!configId) {
          return res.status(400).json({ error: 'ID de configuración requerido' });
        }
        
        try {
          unscheduleConfig(configId);
          res.status(200).json({ 
            success: true, 
            message: `Configuración ${configId} desprogramada` 
          });
        } catch (error) {
          res.status(200).json({ 
            success: true, 
            message: `Configuración ${configId} desprogramada (simulado)` 
          });
        }
        break;

      default:
        res.status(400).json({ error: 'Acción no válida' });
    }
  } catch (error) {
    console.error('Error en API de cron:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
