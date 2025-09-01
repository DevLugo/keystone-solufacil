import { useState, useCallback } from 'react';

interface CronStatus {
  isRunning: boolean;
  activeTasks: number;
  taskIds: string[];
}

interface CronControlResponse {
  success: boolean;
  message?: string;
  status?: string;
  error?: string;
}

export const useCronControl = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callCronAPI = useCallback(async (action: string, data?: any): Promise<CronControlResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cron-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...data }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error en la API de cron');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startCronSystem = useCallback(async () => {
    try {
      const result = await callCronAPI('start');
      return result;
    } catch (err) {
      console.error('Error iniciando cron:', err);
      throw err;
    }
  }, [callCronAPI]);

  const stopCronSystem = useCallback(async () => {
    try {
      const result = await callCronAPI('stop');
      return result;
    } catch (err) {
      console.error('Error deteniendo cron:', err);
      throw err;
    }
  }, [callCronAPI]);

  const getCronStatus = useCallback(async (): Promise<CronStatus | null> => {
    try {
      const result = await callCronAPI('status');
      return result.status || null;
    } catch (err) {
      console.error('Error obteniendo estado del cron:', err);
      // Retornar estado por defecto si hay error
      return {
        isRunning: false,
        activeTasks: 0,
        taskIds: []
      };
    }
  }, [callCronAPI]);

  const rescheduleConfig = useCallback(async (config: any) => {
    try {
      console.log('🔄 Hook useCronControl: Llamando API para reprogramar:', config.name);
      console.log('🕐 Hora a reprogramar:', config.schedule.hour);
      
      const result = await callCronAPI('reschedule', { config });
      console.log('✅ Hook useCronControl: API respondió exitosamente:', result);
      return result;
    } catch (err) {
      console.error('❌ Hook useCronControl: Error reprogramando configuración:', err);
      throw err;
    }
  }, [callCronAPI]);

  const unscheduleConfig = useCallback(async (configId: string) => {
    try {
      const result = await callCronAPI('unschedule', { configId });
      return result;
    } catch (err) {
      console.error('Error desprogramando configuración:', err);
      throw err;
    }
  }, [callCronAPI]);

  return {
    isLoading,
    error,
    startCronSystem,
    stopCronSystem,
    getCronStatus,
    rescheduleConfig,
    unscheduleConfig,
    clearError: () => setError(null),
  };
};
