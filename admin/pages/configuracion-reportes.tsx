import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Stack, Text } from '@keystone-ui/core';
import { gql, useQuery, useMutation } from '@apollo/client';
import { telegramConfig } from '../config/telegram.config';
import { FaCog, FaTelegram, FaClock, FaRoute, FaUsers, FaPaperPlane, FaSave, FaTrash, FaPlay, FaPause, FaCalendarAlt, FaDownload } from 'react-icons/fa';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { createExecutionLog, updateExecutionLog } from '../services/reportExecutionService';
import { useCronControl } from '../hooks/useCronControl';
import { TimePicker } from '../components/TimePicker';
import { Toast, ToastProps } from '../components/Toast';

// Componente Box personalizado
const CustomBox = ({ children, css, ...props }) => {
  return (
    <div style={{ ...css, ...props }}>
      {children}
    </div>
  );
};



// Componente Input personalizado
const CustomInput = ({ value, onChange, placeholder, type = 'text' }) => {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        backgroundColor: 'white'
      }}
    />
  );
};

// Componente Button personalizado
const CustomButton = ({ children, onClick, css, ...props }) => {
  return (
    <button
      onClick={onClick}
      style={{ ...css, ...props }}
    >
      {children}
    </button>
  );
};

// Componente Select personalizado
const CustomSelect = ({ value, onChange, options, placeholder, isMulti = false }) => {
  return (
    <select
      value={isMulti ? undefined : value}
      onChange={(e) => {
        if (isMulti) {
          const selectedOptions = Array.from(e.target.selectedOptions).map(option => ({ value: option.value, label: option.text }));
          onChange(selectedOptions);
        } else {
          onChange({ value: e.target.value });
        }
      }}
      multiple={isMulti}
      style={{
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        backgroundColor: 'white',
        minHeight: isMulti ? '100px' : '40px'
      }}
    >
      {!isMulti && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option 
          key={option.value} 
          value={option.value}
          defaultSelected={isMulti ? (Array.isArray(value) ? value.some(v => v.value === option.value) : false) : value === option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
};

// Tipos de reportes disponibles
const REPORT_TYPES = [
  { value: 'notificacion_tiempo_real', label: 'Notificación en Tiempo Real de Documentos con Error' },
  { value: 'creditos_con_errores', label: 'Reporte PDF de Créditos con Documentos con Error' }
];

// Días de la semana
const WEEK_DAYS = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' }
];

// Horas del día
const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString().padStart(2, '0'),
  label: `${i.toString().padStart(2, '0')}:00`
}));


// Query para obtener rutas
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;

// Query para obtener usuarios
const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
      email
      role
    }
  }
`;

// Query para obtener configuraciones de reportes
const GET_REPORT_CONFIGS = gql`
  query GetReportConfigs {
    reportConfigs {
      id
      name
      reportType
      routes {
        id
        name
      }
      telegramUsers {
        id
        chatId
        name
        username
        isActive
      }
      schedule
      isActive
      createdAt
    }
  }
`;

// Query para obtener usuarios de Telegram
const GET_TELEGRAM_USERS = gql`
  query GetTelegramUsers {
    telegramUsers {
      id
      chatId
      name
      username
      isActive
      platformUser {
        id
        name
        email
      }
    }
  }
`;

// Mutation para crear configuración de reporte
const CREATE_REPORT_CONFIG = gql`
  mutation CreateReportConfig($data: ReportConfigCreateInput!) {
    createReportConfig(data: $data) {
      id
      name
      reportType
      routes {
        id
        name
      }
      telegramUsers {
        id
        chatId
        name
        username
        isActive
      }
      schedule
      isActive
      createdAt
    }
  }
`;

// Mutation para actualizar configuración
const UPDATE_REPORT_CONFIG = gql`
  mutation UpdateReportConfig($id: ID!, $data: ReportConfigUpdateInput!) {
    updateReportConfig(where: { id: $id }, data: $data) {
      id
      name
      reportType
      routes {
        id
        name
      }
      telegramUsers {
        id
        chatId
        name
        username
        isActive
      }
      schedule
      isActive
      updatedAt
    }
  }
`;

// Mutation para eliminar configuración
const DELETE_REPORT_CONFIG = gql`
  mutation DeleteReportConfig($id: ID!) {
    deleteReportConfig(where: { id: $id }) {
      id
    }
  }
`;

// Mutation para enviar reporte ahora
const SEND_REPORT_NOW = gql`
  mutation SendReportNow($configId: ID!) {
    updateReportConfig(
      where: { id: $configId }
      data: { }
    ) {
      id
      name
      reportType
      routes {
        id
        name
      }
      telegramUsers {
        id
        chatId
        name
        isActive
      }
      schedule
      isActive
    }
  }
`;

// Mutation para enviar mensaje de prueba a Telegram
const SEND_TEST_TELEGRAM = gql`
  mutation SendTestTelegram($chatId: String!, $message: String!) {
    sendTestTelegramMessage(chatId: $chatId, message: $message)
  }
`;

// Mutation para generar reporte PDF para descarga
const GENERATE_REPORT_PDF = gql`
  mutation GenerateReportPDF($reportType: String!, $routeIds: [String!]) {
    generateReportPDF(reportType: $reportType, routeIds: $routeIds)
  }
`;

// Mutation para enviar reporte con PDF a Telegram (con filtro de rutas)
const SEND_REPORT_WITH_PDF = gql`
  mutation SendReportWithPDF($chatId: String!, $reportType: String!, $routeIds: [String!]) {
    sendReportWithPDF(chatId: $chatId, reportType: $reportType, routeIds: $routeIds)
  }
`;

// Interfaces
interface Route {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ReportConfig {
  id: string;
  name: string;
  reportType: string;
  schedule: any; // JSON object with days, hour, timezone
  routes: Route[];
  telegramUsers: TelegramUser[];

  isActive: boolean;
  createdAt: string;
}

interface TelegramUser {
  id: string;
  chatId: string;
  name: string;
  username?: string;
}

interface ReportConfigForm {
  name: string;
  reportType: string;
  routes: { value: string; label: string }[];
  telegramUsers: { value: string; label: string }[];
  schedule: {
    days: string[];
    hour: string;
    timezone: string;
  };
  isActive: boolean;
}

export default function ConfiguracionReportesPage() {
  // Estados
  const [editingConfig, setEditingConfig] = useState<ReportConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showNewConfigModal, setShowNewConfigModal] = useState(false);
  const [sendingReports, setSendingReports] = useState<Set<string>>(new Set());
  const [cronStatus, setCronStatus] = useState<'running' | 'stopped'>('stopped');
  const [nextExecution, setNextExecution] = useState<Date | null>(null);
  const [lastExecution, setLastExecution] = useState<Date | null>(null);
  
  // Estados para toasts
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  // Funciones para manejar toasts
  const addToast = (toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Date.now().toString();
    const newToast: ToastProps = {
      ...toast,
      id,
      onClose: removeToast
    };
    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  // Hook para controlar el sistema de cron
  const {
    isLoading: cronLoading,
    error: cronError,
    startCronSystem: startCronBackend,
    stopCronSystem: stopCronBackend,
    getCronStatus: getCronBackendStatus,
    rescheduleConfig: rescheduleConfigBackend,
    unscheduleConfig: unscheduleConfigBackend,
    clearError: clearCronError
  } = useCronControl();
  
  const [formData, setFormData] = useState<ReportConfigForm>({
    name: '',
    reportType: 'notificacion_tiempo_real', // Valor por defecto
    routes: [],
    telegramUsers: [],
    schedule: {
      days: [],
      hour: '09',
      timezone: 'America/Mexico_City'
    },
    isActive: true
  });

  // Queries
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);
  const { data: usersData, loading: usersLoading } = useQuery(GET_USERS);
  const { data: configsData, loading: configsLoading } = useQuery(GET_REPORT_CONFIGS);
  const { data: telegramUsersData, loading: telegramUsersLoading } = useQuery(GET_TELEGRAM_USERS);

  // Mutations
  const [createReportConfig] = useMutation(CREATE_REPORT_CONFIG);
  const [updateReportConfig] = useMutation(UPDATE_REPORT_CONFIG);
  const [deleteReportConfig] = useMutation(DELETE_REPORT_CONFIG);
  const [sendReportNow] = useMutation(SEND_REPORT_NOW);
  const [sendTestTelegram] = useMutation(SEND_TEST_TELEGRAM);
  const [sendReportWithPDF] = useMutation(SEND_REPORT_WITH_PDF);
  const [generateReportPDF] = useMutation(GENERATE_REPORT_PDF);

  // Datos procesados
  const routes = routesData?.routes || [];
  const users = usersData?.users || [];
  const configs = configsData?.reportConfigs || [];
  
  // 🔍 DEBUG: Logs para verificar datos de las queries
  console.log('🔍 DEBUG: Routes from GraphQL:', routes);
  console.log('🔍 DEBUG: TelegramUsers from GraphQL:', telegramUsersData?.telegramUsers || []);
  console.log('🔍 DEBUG: Users from GraphQL:', users);

  // Función para manejar cambios en el formulario
  const handleFormChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof ReportConfigForm],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Función para manejar días seleccionados
  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        days: prev.schedule.days.includes(day)
          ? prev.schedule.days.filter(d => d !== day)
          : [...prev.schedule.days, day]
      }
    }));
  };

  // Función para crear nueva configuración
  const handleCreateConfig = async () => {
    // Validación básica
    if (!formData.name.trim()) {
      alert('El nombre de la configuración es requerido');
      return;
    }
    if (!formData.reportType) {
      alert('El tipo de reporte es requerido');
      return;
    }
    if (formData.routes.length === 0) {
      alert('Debe seleccionar al menos una ruta');
      return;
    }
    if (formData.telegramUsers.length === 0) {
      alert('Debe seleccionar al menos un usuario de Telegram');
      return;
    }

    try {
      // 🔍 DEBUG: Logs para diagnosticar el problema
      console.log('🔍 DEBUG: FormData completo:', formData);
      console.log('🔍 DEBUG: Routes IDs being sent:', formData.routes.map(route => route.value));
      console.log('🔍 DEBUG: TelegramUsers IDs being sent:', formData.telegramUsers.map(user => user.value));
      console.log('🔍 DEBUG: Routes data structure:', formData.routes);
      console.log('🔍 DEBUG: TelegramUsers data structure:', formData.telegramUsers);
      
      const result = await createReportConfig({
        variables: {
          data: {
            name: formData.name,
            reportType: formData.reportType,
            routes: { connect: formData.routes.map(route => ({ id: route.value })) },
            telegramUsers: { connect: formData.telegramUsers.map(user => ({ id: user.value })) },
            schedule: formData.schedule,
            isActive: formData.isActive
          }
        }
      });

      if (result.data?.createReportConfig) {
        // Programar el cron con la nueva configuración si está activa
        const newConfig = result.data.createReportConfig;
        if (newConfig.isActive) {
          scheduleConfig(newConfig);
          
          // Si es la primera configuración activa, iniciar el sistema automáticamente
          if (cronStatus === 'stopped') {
            console.log('🚀 Primera configuración activa creada, iniciando sistema automático...');
            startCronSystem();
          }
        }
        
        setShowNewConfigModal(false);
        resetForm();
        alert('Configuración creada exitosamente');
        // Refetch para obtener la lista actualizada
        window.location.reload();
      }
    } catch (error) {
      console.error('Error creating report config:', error);
      alert('Error al crear la configuración: ' + (error as Error).message);
    }
  };

  // Función para actualizar configuración
  const handleUpdateConfig = async () => {
    if (!editingConfig) return;

    // Validación básica
    if (!formData.name.trim()) {
      alert('El nombre de la configuración es requerido');
      return;
    }
    if (!formData.reportType) {
      alert('El tipo de reporte es requerido');
      return;
    }
    if (formData.routes.length === 0) {
      alert('Debe seleccionar al menos una ruta');
      return;
    }
    if (formData.telegramUsers.length === 0) {
      alert('Debe seleccionar al menos un usuario de Telegram');
      return;
    }

    console.log('🔍 DEBUG: FormData antes de actualizar:', formData);
    console.log('🔍 DEBUG: Routes IDs:', formData.routes.map(route => route.value));
    console.log('🔍 DEBUG: TelegramUsers IDs:', formData.telegramUsers.map(user => user.value));
    console.log('🔍 DEBUG: Routes data structure (update):', formData.routes);
    console.log('🔍 DEBUG: TelegramUsers data structure (update):', formData.telegramUsers);

    try {
      const result = await updateReportConfig({
        variables: {
          id: editingConfig.id,
          data: {
            name: formData.name,
            reportType: formData.reportType,
            routes: { connect: formData.routes.map(route => ({ id: route.value })) },
            telegramUsers: { connect: formData.telegramUsers.map(user => ({ id: user.value })) },
            schedule: formData.schedule,
            isActive: formData.isActive
          }
        }
      });

      if (result.data?.updateReportConfig) {
        // Reprogramar el cron con la nueva configuración
        const updatedConfig = result.data.updateReportConfig;
        console.log('🔄 Configuración actualizada, reprogramando cron:', updatedConfig);
        console.log('🕐 Nueva hora configurada:', updatedConfig.schedule.hour);
        console.log('🕐 Hora en formData:', formData.schedule.hour);
        console.log('🕐 Hora en editingConfig:', editingConfig?.schedule.hour);
        
        // Usar la hora del formData en lugar de la de updatedConfig
        const configWithCorrectHour = {
          ...updatedConfig,
          schedule: {
            ...updatedConfig.schedule,
            hour: formData.schedule.hour
          }
        };
        
        console.log('🔄 Configuración con hora corregida:', configWithCorrectHour);
        console.log('🔍 DEBUG: formData.schedule.hour:', formData.schedule.hour);
        console.log('🔍 DEBUG: Tipo de formData.schedule.hour:', typeof formData.schedule.hour);
        console.log('🔍 DEBUG: configWithCorrectHour.schedule.hour:', configWithCorrectHour.schedule.hour);
        
        try {
          // FORZAR REINICIO COMPLETO DEL CRON
          console.log('🔄 Deteniendo cron actual para reiniciar con nueva configuración...');
          await stopCronSystem();
          console.log('✅ Cron detenido, reiniciando con nueva configuración...');
          await startCronSystem();
          console.log('✅ Cron reiniciado exitosamente con nueva configuración');
        } catch (error) {
          console.error('❌ Error reiniciando cron:', error);
        }
        
        setShowForm(false);
        setEditingConfig(null);
        resetForm();
        alert('Configuración actualizada exitosamente');
        
        // Recalcular próxima ejecución inmediatamente
        if (cronStatus === 'running') {
          const activeConfigs = configs.filter(config => config.isActive);
          if (activeConfigs.length > 0) {
            console.log('🔄 Recalculando próxima ejecución después de actualización...');
            const nextExecutions = activeConfigs.map(config => calculateNextExecution(config));
            const nextExec = nextExecutions.reduce((earliest, current) => 
              current < earliest ? current : earliest
            );
            console.log('⏰ Nueva próxima ejecución calculada:', nextExec.toLocaleString('es-ES'));
            setNextExecution(nextExec);
          }
        }
        
        // Refetch para obtener la lista actualizada
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating report config:', error);
      alert('Error al actualizar la configuración: ' + (error as Error).message);
    }
  };

  // Función para eliminar configuración
  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta configuración?')) return;

    try {
      // Desprogramar el cron antes de eliminar
      unscheduleConfig(configId);
      
      await deleteReportConfig({
        variables: { id: configId }
      });

      alert('Configuración eliminada exitosamente');
      
      // Recalcular próxima ejecución después de eliminar
      if (cronStatus === 'running') {
        const remainingActiveConfigs = configs.filter(config => config.id !== configId && config.isActive);
        if (remainingActiveConfigs.length > 0) {
          console.log('🔄 Recalculando próxima ejecución después de eliminar...');
          const nextExecutions = remainingActiveConfigs.map(config => calculateNextExecution(config));
          const nextExec = nextExecutions.reduce((earliest, current) => 
            current < earliest ? current : earliest
          );
          console.log('⏰ Nueva próxima ejecución calculada:', nextExec.toLocaleString('es-ES'));
          setNextExecution(nextExec);
        } else {
          console.log('ℹ️ No quedan configuraciones activas, deteniendo sistema...');
          setCronStatus('stopped');
          setNextExecution(null);
        }
      }
      
      // Refetch para obtener la lista actualizada
      window.location.reload();
    } catch (error) {
      console.error('Error deleting report config:', error);
      alert('Error al eliminar la configuración: ' + (error as Error).message);
    }
  };

  // Función para enviar mensaje real a Telegram
  const sendTelegramMessage = async (chatId: string, message: string) => {
    try {
      console.log(`📱 Enviando mensaje a Telegram via GraphQL...`);
      console.log(`📱 Chat ID: ${chatId}`);
      
      const result = await sendTestTelegram({
        variables: { chatId, message }
      });
      
      console.log('Respuesta de GraphQL:', result);
      
      if (result.data?.sendTestTelegramMessage) {
        const response = result.data.sendTestTelegramMessage;
        if (response.includes('✅')) {
          console.log(`✅ Mensaje enviado exitosamente a ${chatId}`);
          return true;
        } else {
          console.error(`❌ Error: ${response}`);
          return false;
        }
      } else {
        console.error(`❌ Error de GraphQL: ${result.errors}`);
        return false;
      }
      
    } catch (error) {
      console.error('Error enviando a Telegram:', error);
      return false;
    }
  };

  // Función para descargar reporte
  const handleDownloadReport = async (configId: string) => {
    try {
      const config = configs.find(c => c.id === configId);
      
      if (!config) { 
        addToast({
          type: 'error',
          title: 'Error',
          message: 'Configuración no encontrada'
        });
        return; 
      }
      
      console.log('📥 Descargando reporte:', config.name, 'Tipo:', config.reportType);
      
      // Mostrar toast de carga
      const loadingToastId = Date.now().toString();
      addToast({
        type: 'info',
        title: 'Generando reporte',
        message: `Preparando "${config.name}" para descarga...`
      });
      
      // Generar el reporte PDF usando la mutation real
      const result = await generateReportPDF({
        variables: {
          reportType: config.reportType,
          routeIds: config.routes.map(r => r.id)
        }
      });
      
      if (result.data?.generateReportPDF) {
        // Convertir base64 a blob
        const base64Data = result.data.generateReportPDF;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Crear enlace temporal para descarga
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${config.name}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpiar URL temporal
        URL.revokeObjectURL(url);
        
        // Mostrar toast de éxito
        addToast({
          type: 'success',
          title: 'Descarga exitosa',
          message: `Reporte "${config.name}" descargado correctamente`
        });
      } else {
        addToast({
          type: 'error',
          title: 'Error al generar reporte',
          message: 'No se pudo generar el archivo PDF'
        });
      }
      
    } catch (error) {
      console.error('Error downloading report:', error);
      addToast({
        type: 'error',
        title: 'Error al descargar',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  };

  const handleSendNow = async (configId: string) => {
    try {
      // Activar loading para esta configuración
      setSendingReports(prev => new Set(prev).add(configId));
      
      console.log('🔥 FUNCIÓN handleSendNow LLAMADA con configId:', configId);
      
      const config = configs.find(c => c.id === configId);
      console.log('📋 Configuración encontrada:', config);
      
      if (!config) { 
        alert('Configuración no encontrada'); 
        setSendingReports(prev => {
          const newSet = new Set(prev);
          newSet.delete(configId);
          return newSet;
        });
        return; 
      }
      
      if (!config.isActive) { 
        alert('La configuración del reporte no está activa'); 
        setSendingReports(prev => {
          const newSet = new Set(prev);
          newSet.delete(configId);
          return newSet;
        });
        return; 
      }

      // Obtener IDs de rutas configuradas
      const routeIds = config.routes.map(route => route.id);
      console.log(`📋 Configuración del reporte:`, {
        id: config.id,
        name: config.name,
        reportType: config.reportType,
        routeIds: routeIds,
        recipientsCount: config.recipients?.length || 0
      });

      // Enviar a TODOS los destinatarios configurados
      let sentCount = 0;
      let errorCount = 0;
      let usersWithoutTelegram = [];
      
      if (config.recipients && config.recipients.length > 0) {
        console.log(`📱 Procesando ${config.recipients.length} destinatarios`);
        
        for (const recipient of config.recipients) {
          try {
            // Buscar si el usuario tiene Telegram configurado
            const telegramUser = await findTelegramUserByPlatformUserId(recipient.id);
            
            if (telegramUser && telegramUser.isActive) {
              console.log(`📱 Enviando por Telegram a ${recipient.name} (${telegramUser.chatId})`);
              
              // Enviar reporte por Telegram
              const sent = await sendReportToTelegram(telegramUser.chatId, config.reportType, routeIds, config, recipient);
              
              if (sent) {
                sentCount++;
                console.log(`✅ Reporte enviado exitosamente a ${recipient.name}`);
              } else {
                errorCount++;
                console.log(`❌ Error enviando reporte a ${recipient.name}`);
              }
            } else {
              usersWithoutTelegram.push(recipient.name);
              console.log(`⚠️ Usuario ${recipient.name} no tiene Telegram configurado`);
            }
          } catch (error) {
            console.error(`❌ Error procesando usuario ${recipient.name}:`, error);
            errorCount++;
          }
        }
      }

      // Mostrar resumen
      let resultMessage = `📊 Reporte enviado: ${sentCount} exitosos, ${errorCount} fallidos`;
      
      if (usersWithoutTelegram.length > 0) {
        resultMessage += `\n\n⚠️ Usuarios sin Telegram configurado:\n${usersWithoutTelegram.join(', ')}`;
      }
      
      if (sentCount > 0) {
        alert(`✅ ${resultMessage}\n\nRevisa Telegram para ver el reporte.`);
      } else {
        alert(`❌ ${resultMessage}\n\nRevisa la consola para más detalles.`);
      }
      
    } catch (error) {
      console.error('Error sending report:', error);
      alert('Error al enviar reporte: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      // Desactivar loading para esta configuración
      setSendingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(configId);
        return newSet;
      });
    }
  };

  // Función simplificada para enviar reporte a Telegram
  const sendReportToTelegram = async (chatId: string, reportType: string, routeIds: string[] = [], config: any = null, recipient: any = null) => {
    try {
      console.log(`📱 Enviando reporte ${reportType} a ${chatId} con rutas:`, routeIds);
      
      // Preparar parámetros de logging
      const reportConfigId = config?.id || 'unknown';
      const reportConfigName = config?.name || 'Reporte Manual';
      const recipientUserId = recipient?.id || 'unknown';
      const recipientName = recipient?.name || 'Usuario Desconocido';
      const recipientEmail = recipient?.email || 'unknown@example.com';
      
      // Para reporte PDF de créditos con errores
      if (reportType === 'creditos_con_errores') {
        const result = await sendReportWithPDF({
          variables: { 
            chatId: chatId, 
            reportType: reportType,
            routeIds: routeIds,
            reportConfigId,
            reportConfigName,
            recipientUserId,
            recipientName,
            recipientEmail
          }
        });
        
        return result.data?.sendReportWithPDF?.includes('✅') || false;
      } else if (reportType === 'notificacion_tiempo_real') {
        // Para notificaciones en tiempo real, enviar mensaje informativo
        const message = `🔔 <b>CONFIGURACIÓN DE NOTIFICACIONES EN TIEMPO REAL</b>\n\n✅ Las notificaciones automáticas están activas\n📱 Recibirás alertas cuando se marquen documentos con error\n🛠️ Configuración: Administración → Configuración de Notificaciones\n\n📅 Configurado: ${new Date().toLocaleString('es-ES')}`;
        
        const result = await sendTestTelegram({
          variables: { 
            chatId, 
            message,
            reportConfigId,
            reportConfigName,
            recipientUserId,
            recipientName,
            recipientEmail
          }
        });
        
        return result.data?.sendTestTelegramMessage?.includes('✅') || false;
      } else {
        // Para otros tipos, usar mensaje de texto genérico
        const message = `📊 <b>REPORTE AUTOMÁTICO</b>\n\nTipo: ${reportType}\nGenerado: ${new Date().toLocaleString('es-ES')}\n\n✅ Enviado desde Keystone Admin`;
        
        const result = await sendTestTelegram({
          variables: { 
            chatId, 
            message,
            reportConfigId,
            reportConfigName,
            recipientUserId,
            recipientName,
            recipientEmail
          }
        });
        
        return result.data?.sendTestTelegramMessage?.includes('✅') || false;
      }
    } catch (error) {
      console.error('Error enviando reporte a Telegram:', error);
      return false;
    }
  };

  // Función para buscar usuario de Telegram por ID de plataforma
  const findTelegramUserByPlatformUserId = async (platformUserId: string) => {
    try {
      // Buscar en la lista de usuarios de Telegram que ya tenemos
      const telegramUsers = telegramUsersData?.telegramUsers || [];
      const telegramUser = telegramUsers.find(user => 
        user.platformUser && user.platformUser.id === platformUserId
      );
      
      if (telegramUser) {
        return {
          id: telegramUser.id,
          chatId: telegramUser.chatId,
          name: telegramUser.name,
          isActive: telegramUser.isActive
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error buscando usuario de Telegram:', error);
      return null;
    }
  };

  // ===== SISTEMA DE CRON REAL CONECTADO AL BACKEND =====
  
  // Función para convertir configuración a expresión cron
  const configToCronExpression = useCallback((config: ReportConfig): string => {
    if (!config.isActive || !config.schedule?.days?.length) return '';
    
    const hour = config.schedule.hour;
    const minute = '0'; // Siempre en el minuto 0
    
    // Mapear días de la semana a formato cron (0 = Domingo, 1 = Lunes, etc.)
    const dayMap: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    const cronDays = config.schedule.days
      .map(day => dayMap[day])
      .filter(day => day !== undefined)
      .join(',');
    
    // Formato: minuto hora * * día_semana
    return `${minute} ${hour} * * ${cronDays}`;
  }, []);

  // Función para ejecutar un reporte programado (simulado)
  const executeScheduledReport = useCallback(async (config: ReportConfig) => {
    console.log(`🚀 Ejecutando reporte programado: ${config.name}`);
    
    try {
      // Ejecutar el reporte
      await handleSendNow(config.id);
      
      // Actualizar última ejecución
      setLastExecution(new Date());
      
      console.log(`✅ Reporte programado ejecutado: ${config.name}`);
      
    } catch (error) {
      console.error(`❌ Error ejecutando reporte programado ${config.name}:`, error);
    }
  }, [handleSendNow]);

  // Función para programar una configuración (simulada)
  const scheduleConfig = useCallback((config: ReportConfig) => {
    if (!config.isActive) return;
    
    const cronExpression = configToCronExpression(config);
    if (!cronExpression) return;
    
    console.log(`📅 Reporte programado: ${config.name} - ${cronExpression}`);
  }, [configToCronExpression]);

  // Función para desprogramar una configuración
  const unscheduleConfig = useCallback(async (configId: string) => {
    try {
      await unscheduleConfigBackend(configId);
      console.log(`⏹️ Configuración ${configId} desprogramada en el backend`);
    } catch (error) {
      console.error('Error desprogramando configuración:', error);
    }
  }, [unscheduleConfigBackend]);

  // Función para reprogramar una configuración específica
  const rescheduleConfig = useCallback(async (config: ReportConfig) => {
    try {
      await rescheduleConfigBackend(config);
      console.log(`🔄 Configuración ${config.name} reprogramada en el backend`);
    } catch (error) {
      console.error('Error reprogramando configuración:', error);
    }
  }, [rescheduleConfigBackend]);

  // Función para calcular la próxima ejecución (para mostrar en UI)
  const calculateNextExecution = useCallback((config: ReportConfig): Date => {
    console.log('🔍 Calculando próxima ejecución para:', config.name, config.schedule);
    
    if (!config.isActive || !config.schedule?.days?.length) {
      console.log('❌ Configuración no activa o sin días programados');
      return new Date();
    }
    
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    
    // Extraer hora y minuto del formato "HH:MM" o "HH"
    let targetHour: number;
    let targetMinute: number;
    
    if (config.schedule.hour.includes(':')) {
      const [hour, minute] = config.schedule.hour.split(':');
      targetHour = parseInt(hour);
      targetMinute = parseInt(minute);
    } else {
      targetHour = parseInt(config.schedule.hour);
      targetMinute = 0;
    }
    
    console.log('🕐 Hora extraída:', config.schedule.hour, '->', targetHour, ':', targetMinute);
    
    console.log('📅 Día actual:', currentDay, 'Hora objetivo:', targetHour, ':', targetMinute);
    console.log('📋 Días programados:', config.schedule.days);
    
    // Mapear días de la semana
    const dayMap: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    // Encontrar el próximo día programado
    let nextDay = -1;
    for (let i = 1; i <= 7; i++) {
      const checkDay = (currentDay + i) % 7;
      const dayName = Object.keys(dayMap).find(key => dayMap[key] === checkDay);
      if (dayName && config.schedule.days.includes(dayName)) {
        nextDay = checkDay;
        break;
      }
    }
    
    // Si no hay próximo día esta semana, usar el primer día de la próxima semana
    if (nextDay === -1) {
      const firstDay = dayMap[config.schedule.days[0]];
      nextDay = firstDay;
    }
    
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + (nextDay - currentDay + 7) % 7);
    nextDate.setHours(targetHour, targetMinute, 0, 0); // Usar hora Y minuto exactos
    
    console.log('✅ Próxima ejecución calculada:', nextDate.toLocaleString('es-ES'));
    return nextDate;
  }, []);

  // Función para iniciar el sistema de cron
  const startCronSystem = useCallback(async () => {
    try {
      // Verificar si hay configuraciones activas
      const activeConfigs = configs.filter(config => config.isActive);
      if (activeConfigs.length === 0) {
        console.log('ℹ️ No hay configuraciones activas para programar');
        setCronStatus('stopped');
        return;
      }
      
      await startCronBackend();
      setCronStatus('running');
      console.log('🚀 Sistema de cron iniciado en el backend');
      
      // Calcular próxima ejecución para todas las configuraciones activas
      if (activeConfigs.length > 0) {
        console.log('📅 Calculando próxima ejecución para', activeConfigs.length, 'configuraciones activas');
        const nextExecutions = activeConfigs.map(config => calculateNextExecution(config));
        // Tomar la más próxima
        const nextExec = nextExecutions.reduce((earliest, current) => 
          current < earliest ? current : earliest
        );
        console.log('⏰ Próxima ejecución más cercana:', nextExec.toLocaleString('es-ES'));
        setNextExecution(nextExec);
      }
    } catch (error) {
      console.error('Error iniciando cron:', error);
      setCronStatus('stopped');
    }
  }, [startCronBackend, configs, calculateNextExecution]);

  // Función para detener el sistema de cron
  const stopCronSystem = useCallback(async () => {
    try {
      await stopCronBackend();
      setCronStatus('stopped');
      console.log('⏹️ Sistema de cron detenido en el backend');
      setNextExecution(null);
    } catch (error) {
      console.error('Error deteniendo cron:', error);
    }
  }, [stopCronBackend]);

  // Efecto para iniciar automáticamente el cron al cargar la página
  useEffect(() => {
    console.log('🚀 Iniciando sistema automático al startup...');
    // Iniciar automáticamente si hay configuraciones activas
    const activeConfigs = configs.filter(config => config.isActive);
    if (activeConfigs.length > 0) {
      console.log(`✅ Encontradas ${activeConfigs.length} configuraciones activas, iniciando sistema...`);
      startCronSystem();
    } else {
      console.log('ℹ️ No hay configuraciones activas, sistema permanecerá detenido');
      setCronStatus('stopped');
    }
  }, [startCronSystem, configs]);

  // Efecto para calcular próxima ejecución cuando se carguen las configuraciones
  useEffect(() => {
    console.log('📥 Configuraciones cargadas:', configs.length);
    const activeConfigs = configs.filter(config => config.isActive);
    console.log('✅ Configuraciones activas:', activeConfigs.length);
    
    if (activeConfigs.length > 0 && cronStatus === 'running') {
      console.log('🔄 Calculando próxima ejecución inicial...');
      const nextExecutions = activeConfigs.map(config => calculateNextExecution(config));
      const nextExec = nextExecutions.reduce((earliest, current) => 
        current < earliest ? current : earliest
      );
      console.log('⏰ Próxima ejecución inicial:', nextExec.toLocaleString('es-ES'));
      setNextExecution(nextExec);
    } else if (activeConfigs.length === 0 && cronStatus === 'running') {
      console.log('ℹ️ No hay configuraciones activas, deteniendo sistema...');
      setCronStatus('stopped');
      setNextExecution(null);
    }
  }, [configs, cronStatus, calculateNextExecution]);

  // Efecto para recalcular próxima ejecución cuando cambien las configuraciones
  useEffect(() => {
    console.log('🔄 Recalculando próxima ejecución...');
    console.log('📊 Estado del cron:', cronStatus);
    console.log('📋 Configuraciones activas:', configs.filter(config => config.isActive).length);
    
    if (cronStatus === 'running') {
      const activeConfigs = configs.filter(config => config.isActive);
      if (activeConfigs.length > 0) {
        // Calcular próxima ejecución para todas las configuraciones activas
        const nextExecutions = activeConfigs.map(config => calculateNextExecution(config));
        // Tomar la más próxima
        const nextExec = nextExecutions.reduce((earliest, current) => 
          current < earliest ? current : earliest
        );
        console.log('⏰ Próxima ejecución más cercana:', nextExec.toLocaleString('es-ES'));
        setNextExecution(nextExec);
      } else {
        console.log('ℹ️ No hay configuraciones activas');
        setNextExecution(null);
      }
    } else {
      console.log('⏹️ Cron no está corriendo');
      setNextExecution(null);
    }
  }, [configs, cronStatus, calculateNextExecution]);

  // Efecto para manejar la tecla Escape en el modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showNewConfigModal) {
          setShowNewConfigModal(false);
          resetForm();
        }
        if (editingConfig) {
          setEditingConfig(null);
          resetForm();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showNewConfigModal, editingConfig]);

  // Efecto para cerrar modal al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Solo cerrar si el clic es en el overlay (fondo oscuro), no en el contenido del modal
      if (showNewConfigModal && target.classList.contains('modal-overlay')) {
        setShowNewConfigModal(false);
        resetForm();
      }
    };

    if (showNewConfigModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewConfigModal]);

  // Efecto para recalcular próxima ejecución cuando cambie la hora en el formulario
  useEffect(() => {
    if (editingConfig && cronStatus === 'running') {
      console.log('🔄 Hora cambiada en formulario, recalculando próxima ejecución...');
      const activeConfigs = configs.filter(config => config.isActive);
      if (activeConfigs.length > 0) {
        const nextExecutions = activeConfigs.map(config => {
          // Si es la configuración que se está editando, usar el valor del formulario
          if (config.id === editingConfig.id) {
            const tempConfig = { ...config, schedule: { ...config.schedule, hour: formData.schedule.hour } };
            return calculateNextExecution(tempConfig);
          }
          return calculateNextExecution(config);
        });
        const nextExec = nextExecutions.reduce((earliest, current) => 
          current < earliest ? current : earliest
        );
        console.log('⏰ Próxima ejecución actualizada en tiempo real:', nextExec.toLocaleString('es-ES'));
        setNextExecution(nextExec);
      }
    }
  }, [formData.schedule.hour, editingConfig, cronStatus, configs, calculateNextExecution]);

  // Función para editar configuración
  const handleEditConfig = (config: ReportConfig) => {
    console.log('🔍 DEBUG: Configuración a editar:', config);
    console.log('🔍 DEBUG: Routes:', config.routes);
    console.log('🔍 DEBUG: TelegramUsers:', config.telegramUsers);
    
    setEditingConfig(config);
    setFormData({
      name: config.name,
      reportType: config.reportType,
      routes: config.routes?.map(r => ({ value: r.id, label: r.name })) || [],
      telegramUsers: config.telegramUsers?.map(u => ({ value: u.id, label: u.name })) || [],
      schedule: config.schedule || {
        days: [],
        hour: '09',
        timezone: 'America/Mexico_City'
      },
      isActive: config.isActive
    });
    
    console.log('🔍 DEBUG: FormData después de mapear:', {
      routes: config.routes?.map(r => ({ value: r.id, label: r.name })) || [],
      telegramUsers: config.telegramUsers?.map(u => ({ value: u.id, label: u.name })) || []
    });
    // No cambiar showForm para edición, solo editingConfig
  };

  // Función para cancelar edición
  const handleCancel = () => {
    setShowForm(false);
    setEditingConfig(null);
    resetForm();
  };

  // Función para resetear formulario
  const resetForm = () => {
    setFormData({
      name: '',
      reportType: 'notificacion_tiempo_real', // Valor por defecto
      routes: [],
      telegramUsers: [],
      schedule: {
        days: [],
        hour: '09',
        timezone: 'America/Mexico_City'
      },
      isActive: true
    });
  };

  // Funciones auxiliares
  const getReportTypeLabel = (type: string) => {
    return REPORT_TYPES.find(t => t.value === type)?.label || type;
  };


  // Loading state
  if (routesLoading || usersLoading || configsLoading || telegramUsersLoading) {
    return (
      <PageContainer header="🤖 Reportes Automáticos">
        <CustomBox css={{ 
          padding: '32px', 
          display: 'flex', 
          justifyContent: 'center' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '16px', 
              color: '#6b7280',
              marginBottom: '16px'
            }}>
              Cargando...
            </div>
            <div style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              border: '2px solid #e5e7eb',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </CustomBox>
      </PageContainer>
    );
  }

  return (
    <PageContainer header="🤖 Reportes Automáticos">
      <CustomBox css={{ padding: '32px' }}>
        {/* Header con botón para crear nueva configuración */}
        <CustomBox css={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          padding: '24px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <CustomBox>
            <Text weight="bold" size="large" color="black">
              Sistema de Reportes Automáticos
            </Text>
            <Text size="small" color="neutral600" css={{ marginTop: '8px' }}>
              Configura y programa reportes automáticos por ruta, horario y destinatarios
            </Text>
          </CustomBox>
          <CustomButton
            onClick={() => setShowNewConfigModal(true)}
            css={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#2563eb' }
            }}
          >
            <FaCog style={{ marginRight: '8px' }} />
            Nueva Configuración
          </CustomButton>
        </CustomBox>

        {/* Panel de Control del Cron */}
        <CustomBox css={{
          padding: '24px',
          backgroundColor: '#f0f9ff',
          borderRadius: '12px',
          border: '1px solid #bae6fd',
          marginBottom: '24px'
        }}>
          <CustomBox css={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <Text weight="bold" size="large" color="blue900">
              🕐 Control del Sistema Automático
            </Text>
            <CustomBox css={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <CustomButton
                onClick={cronStatus === 'running' ? stopCronSystem : startCronSystem}
                disabled={cronLoading}
                css={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: cronLoading ? '#9ca3af' : (cronStatus === 'running' ? '#dc2626' : '#10b981'),
                  color: 'white',
                  cursor: cronLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  '&:hover': { 
                    backgroundColor: cronLoading ? '#9ca3af' : (cronStatus === 'running' ? '#b91c1c' : '#059669')
                  }
                }}
              >
                {cronLoading ? (
                  <>
                    <div className="spinner" style={{ marginRight: '8px' }} />
                    {cronStatus === 'running' ? 'Deteniendo...' : 'Iniciando...'}
                  </>
                ) : cronStatus === 'running' ? (
                  <>
                    <FaPause />
                    Detener Sistema
                  </>
                ) : (
                  <>
                    <FaPlay />
                    Iniciar Sistema
                  </>
                )}
              </CustomButton>
              {cronError && (
                <CustomButton
                  onClick={clearCronError}
                  css={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    '&:hover': { backgroundColor: '#4b5563' }
                  }}
                >
                  ✕ Limpiar Error
                </CustomButton>
              )}
            </CustomBox>
          </CustomBox>

          <CustomBox css={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {/* Estado del Sistema */}
            <CustomBox css={{
              padding: '16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <Text weight="medium" size="small" color="blue600" css={{ marginBottom: '8px' }}>
                Estado del Sistema
              </Text>
              <Text size="small" color="blue800" css={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: cronStatus === 'running' ? '#10b981' : '#ef4444'
                }} />
                {cronStatus === 'running' ? 'Ejecutándose' : 'Detenido'}
              </Text>
              {cronError && (
                <Text size="small" color="red600" css={{ marginTop: '8px' }}>
                  ❌ Error: {cronError}
                </Text>
              )}
              {configs.filter(config => config.isActive).length === 0 && (
                <Text size="small" color="blue600" css={{ marginTop: '8px' }}>
                  ℹ️ No hay reportes automáticos configurados
                </Text>
              )}
            </CustomBox>

            {/* Próxima Ejecución */}
            <CustomBox css={{
              padding: '16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <Text weight="medium" size="small" color="blue600" css={{ marginBottom: '8px' }}>
                Próxima Ejecución
              </Text>
              <Text size="small" color="blue800">
                {nextExecution ? nextExecution.toLocaleString('es-ES') : 'No programado'}
              </Text>
            </CustomBox>

            {/* Última Ejecución */}
            <CustomBox css={{
              padding: '16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <Text weight="medium" size="small" color="blue600" css={{ marginBottom: '8px' }}>
                Última Ejecución
              </Text>
              <Text size="small" color="blue800">
                {lastExecution ? lastExecution.toLocaleString('es-ES') : 'Nunca'}
              </Text>
            </CustomBox>

            {/* Tareas Activas */}
            <CustomBox css={{
              padding: '16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <Text weight="medium" size="small" color="blue600" css={{ marginBottom: '8px' }}>
                Tareas Activas
              </Text>
              <Text size="small" color="blue800">
                {configs.filter(config => config.isActive).length} reportes activos
              </Text>
            </CustomBox>
          </CustomBox>
        </CustomBox>

        {/* Modal de nueva configuración */}
        {showNewConfigModal && (
          <CustomBox 
            className="modal-overlay"
            css={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <CustomBox 
              css={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '32px',
                maxWidth: '800px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                position: 'relative'
              }}
            >
              {/* Header del modal */}
              <CustomBox css={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <Text weight="bold" size="large" color="black">
                  Nueva Configuración de Reporte
                </Text>
                <CustomButton
                  onClick={() => setShowNewConfigModal(false)}
                  css={{
                    padding: '8px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    cursor: 'pointer',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': { backgroundColor: '#e5e7eb' }
                  }}
                >
                  ✕
                </CustomButton>
              </CustomBox>

              {/* Contenido del formulario */}
              <CustomBox css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Nombre de la configuración */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Nombre de la Configuración
                  </Text>
                  <CustomInput
                    value={formData.name}
                    onChange={(value) => handleFormChange('name', value)}
                    placeholder="Ej: Reporte Semanal de Errores"
                  />
                </CustomBox>

                {/* Tipo de reporte */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Tipo de Reporte
                  </Text>
                  <CustomSelect
                    value={formData.reportType}
                    onChange={(option) => handleFormChange('reportType', option?.value)}
                    options={REPORT_TYPES}
                    placeholder="Selecciona el tipo de reporte"
                  />
                </CustomBox>

                {/* Días de la semana */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Días de Envío
                  </Text>
                  <CustomBox css={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {WEEK_DAYS.map(day => (
                      <CustomButton
                        key={day.value}
                        onClick={() => handleDayToggle(day.value)}
                        css={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: '1px solid #d1d5db',
                          backgroundColor: formData.schedule.days.includes(day.value) ? '#3b82f6' : 'white',
                          color: formData.schedule.days.includes(day.value) ? 'white' : '#374151',
                          cursor: 'pointer',
                          fontSize: '14px',
                          '&:hover': {
                            backgroundColor: formData.schedule.days.includes(day.value) ? '#2563eb' : '#f3f4f6'
                          }
                        }}
                      >
                        {day.label}
                      </CustomButton>
                    ))}
                  </CustomBox>
                </CustomBox>

                {/* Hora de envío - Solo para reportes programados */}
                {formData.reportType !== 'notificacion_tiempo_real' && (
                  <CustomBox>
                    <Text weight="medium" size="small" color="black" marginBottom="small">
                      Hora de Envío
                    </Text>
                    <TimePicker
                      value={formData.schedule.hour}
                      onChange={(time) => handleFormChange('schedule.hour', time)}
                      placeholder="Selecciona la hora"
                      />
                </CustomBox>

                )}
                {/* Rutas */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Rutas a Incluir
                  </Text>
                  <CustomSelect
                    value={formData.routes}
                    onChange={(options) => handleFormChange('routes', options)}
                    options={routes.map(route => ({ value: route.id, label: route.name }))}
                    placeholder="Selecciona las rutas"
                    isMulti
                  />
                </CustomBox>

                {/* Usuarios de Telegram */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Usuarios de Telegram
                  </Text>
                  <CustomSelect
                    value={formData.telegramUsers}
                    onChange={(options) => handleFormChange('telegramUsers', options)}
                    options={telegramUsersData?.telegramUsers?.filter(user => user.isActive).map(user => ({ 
                      value: user.id, 
                      label: `${user.name} (@${user.username || user.chatId})` 
                    })) || []}
                    placeholder="Selecciona los usuarios de Telegram"
                    isMulti
                  />
                </CustomBox>


                {/* Estado activo */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Estado
                  </Text>
                  <CustomSelect
                    value={formData.isActive ? 'active' : 'inactive'}
                    onChange={(option) => handleFormChange('isActive', option?.value === 'active')}
                    options={[
                      { value: 'active', label: 'Activo' },
                      { value: 'inactive', label: 'Inactivo' }
                    ]}
                    placeholder="Selecciona el estado"
                  />
                </CustomBox>
              </CustomBox>

              {/* Botones de acción */}
              <CustomBox css={{
                display: 'flex',
                gap: '16px',
                justifyContent: 'flex-end',
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <CustomButton
                  onClick={() => {
                    setShowNewConfigModal(false);
                    resetForm();
                  }}
                  css={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    fontWeight: '600',
                    '&:hover': { backgroundColor: '#f9fafb' }
                  }}
                >
                  Cancelar
                </CustomButton>
                <CustomButton
                  onClick={handleCreateConfig}
                  css={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    '&:hover': { backgroundColor: '#059669' }
                  }}
                >
                  <FaSave style={{ marginRight: '8px' }} />
                  Crear Configuración
                </CustomButton>
              </CustomBox>
            </CustomBox>
          </CustomBox>
        )}

        {/* Modal para editar configuración */}
        {editingConfig && (
          <CustomBox css={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <CustomBox css={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              position: 'relative'
            }}>
              {/* Header del modal */}
              <CustomBox css={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <Text weight="bold" size="large" color="black">
                  ✏️ Editar Configuración: {editingConfig.name}
                </Text>
                <CustomButton
                  onClick={handleCancel}
                  css={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '8px',
                    borderRadius: '50%',
                    '&:hover': {
                      backgroundColor: '#f3f4f6',
                      color: '#374151'
                    }
                  }}
                >
                  ✕
                </CustomButton>
              </CustomBox>

              {/* Formulario de edición */}
              <CustomBox css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Nombre de la configuración */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Nombre de la Configuración
                  </Text>
                  <CustomInput
                    value={formData.name}
                    onChange={(value) => handleFormChange('name', value)}
                    placeholder="Ej: Reporte Semanal de Errores"
                  />
                </CustomBox>

                {/* Tipo de reporte */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Tipo de Reporte
                  </Text>
                  <CustomSelect
                    value={formData.reportType}
                    onChange={(option) => handleFormChange('reportType', option?.value)}
                    options={REPORT_TYPES}
                    placeholder="Selecciona el tipo de reporte"
                  />
                </CustomBox>

                {/* Días de la semana - Solo para reportes programados */}
                {formData.reportType !== 'notificacion_tiempo_real' && (
                  <CustomBox>
                    <Text weight="medium" size="small" color="black" marginBottom="small">
                      Días de Envío
                    </Text>
                    <CustomBox css={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {WEEK_DAYS.map(day => (
                        <CustomButton
                          key={day.value}
                          onClick={() => handleDayToggle(day.value)}
                          css={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            border: '1px solid #d1d5db',
                            backgroundColor: formData.schedule.days.includes(day.value) ? '#3b82f6' : 'white',
                            color: formData.schedule.days.includes(day.value) ? 'white' : '#374151',
                            cursor: 'pointer',
                            fontSize: '14px',
                            '&:hover': {
                              backgroundColor: formData.schedule.days.includes(day.value) ? '#2563eb' : '#f3f4f6'
                            }
                          }}
                        >
                          {day.label}
                        </CustomButton>
                      ))}
                    </CustomBox>
                  </CustomBox>
                )}

                {/* Hora de envío - Solo para reportes programados */}
                {formData.reportType !== 'notificacion_tiempo_real' && (
                  <CustomBox>
                    <Text weight="medium" size="small" color="black" marginBottom="small">
                      Hora de Envío
                    </Text>
                    <TimePicker
                      value={formData.schedule.hour}
                      onChange={(time) => handleFormChange('schedule.hour', time)}
                      placeholder="Selecciona la hora"
                    />
                  </CustomBox>
                )}

                {/* Rutas */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Rutas a Incluir
                  </Text>
                  <CustomSelect
                    value={formData.routes}
                    onChange={(options) => handleFormChange('routes', options)}
                    options={routes.map(route => ({ value: route.id, label: route.name }))}
                    placeholder="Selecciona las rutas"
                    isMulti
                  />
                </CustomBox>

                {/* Usuarios de Telegram */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Usuarios de Telegram
                  </Text>
                  <CustomSelect
                    value={formData.telegramUsers}
                    onChange={(options) => handleFormChange('telegramUsers', options)}
                    options={telegramUsersData?.telegramUsers?.filter(user => user.isActive).map(user => ({ 
                      value: user.id, 
                      label: `${user.name} (@${user.username || user.chatId})` 
                    })) || []}
                    placeholder="Selecciona los usuarios de Telegram"
                    isMulti
                  />
                </CustomBox>


                {/* Estado activo */}
                <CustomBox>
                  <Text weight="medium" size="small" color="black" marginBottom="small">
                    Estado
                  </Text>
                  <CustomSelect
                    value={formData.isActive ? 'active' : 'inactive'}
                    onChange={(option) => handleFormChange('isActive', option?.value === 'active')}
                    options={[
                      { value: 'active', label: 'Activo' },
                      { value: 'inactive', label: 'Inactivo' }
                    ]}
                    placeholder="Selecciona el estado"
                  />
                </CustomBox>
              </CustomBox>

              {/* Botones de acción del modal */}
              <CustomBox css={{
                display: 'flex',
                gap: '16px',
                justifyContent: 'flex-end',
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <CustomButton
                  onClick={handleCancel}
                  css={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    fontWeight: '600',
                    '&:hover': { backgroundColor: '#f9fafb' }
                  }}
                >
                  Cancelar
                </CustomButton>
                <CustomButton
                  onClick={handleUpdateConfig}
                  css={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    '&:hover': { backgroundColor: '#2563eb' }
                  }}
                >
                  <FaSave style={{ marginRight: '8px' }} />
                  Actualizar Configuración
                </CustomButton>
              </CustomBox>
            </CustomBox>
          </CustomBox>
        )}

        {/* Lista de configuraciones existentes */}
        <CustomBox>
          <Text weight="bold" size="large" color="black" css={{ marginBottom: '24px' }}>
            Reportes Programados
          </Text>

          {configs.length === 0 ? (
            <CustomBox css={{
              padding: '48px',
              textAlign: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <Text size="large" color="neutral600">
                No hay reportes automáticos programados
              </Text>
              <Text size="small" color="neutral500" css={{ marginTop: '8px' }}>
                Crea tu primer reporte automático para comenzar a recibir información programada
              </Text>
            </CustomBox>
          ) : (
            <CustomBox css={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {configs.map(config => (
                <CustomBox
                  key={config.id}
                  css={{
                    padding: '24px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {/* Header de la configuración */}
                  <CustomBox css={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '16px'
                  }}>
                    <CustomBox>
                      <Text weight="bold" size="large" color="black">
                        {config.name}
                      </Text>
                      <Text size="small" color="neutral600" css={{ marginTop: '4px' }}>
                        {getReportTypeLabel(config.reportType)}
                      </Text>
                    </CustomBox>
                    <CustomBox css={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <CustomButton
                        onClick={() => handleSendNow(config.id)}
                        disabled={sendingReports.has(config.id)}
                        css={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: sendingReports.has(config.id) ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          cursor: sendingReports.has(config.id) ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          '&:hover': { 
                            backgroundColor: sendingReports.has(config.id) ? '#9ca3af' : '#2563eb' 
                          },
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        {sendingReports.has(config.id) ? (
                          <>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              border: '2px solid #ffffff',
                              borderTop: '2px solid transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }} />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <FaPaperPlane style={{ marginRight: '8px' }} />
                            Enviar Ahora
                          </>
                        )}
                      </CustomButton>
                      <CustomButton
                        onClick={() => handleDownloadReport(config.id)}
                        css={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid #10b981',
                          backgroundColor: 'white',
                          color: '#10b981',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          '&:hover': { 
                            backgroundColor: '#f0fdf4',
                            borderColor: '#059669',
                            color: '#059669'
                          },
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <FaDownload style={{ marginRight: '8px' }} />
                        Descargar
                      </CustomButton>
                      <CustomButton
                        onClick={() => handleEditConfig(config)}
                        css={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          backgroundColor: 'white',
                          color: '#374151',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          '&:hover': { backgroundColor: '#f3f4f6' }
                        }}
                      >
                        <FaCog style={{ marginRight: '8px' }} />
                        Editar
                      </CustomButton>
                      <CustomButton
                        onClick={() => handleDeleteConfig(config.id)}
                        css={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid #dc2626',
                          backgroundColor: 'white',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          '&:hover': { backgroundColor: '#fef2f2' }
                        }}
                      >
                        <FaTrash style={{ marginRight: '8px' }} />
                        Eliminar
                      </CustomButton>
                    </CustomBox>
                  </CustomBox>

                  {/* Detalles de la configuración */}
                  <CustomBox css={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px'
                  }}>
                    {/* Horario */}
                    <CustomBox css={{
                      padding: '16px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      border: '1px solid #bae6fd'
                    }}>
                      <Text weight="medium" size="small" color="blue600" css={{ marginBottom: '8px' }}>
                        <FaClock style={{ marginRight: '8px' }} />
                        Horario
                      </Text>
                                              <Text size="small" color="blue800">
                          {config.schedule?.days?.map(day => 
                            WEEK_DAYS.find(wd => wd.value === day)?.label
                          ).join(', ') || 'No configurado'} a las {config.schedule?.hour || '00'}:00
                        </Text>
                    </CustomBox>

                    {/* Rutas */}
                    <CustomBox css={{
                      padding: '16px',
                      backgroundColor: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0'
                    }}>
                      <Text weight="medium" size="small" color="green600" css={{ marginBottom: '8px' }}>
                        <FaRoute style={{ marginRight: '8px' }} />
                        Rutas
                      </Text>
                      <Text size="small" color="green800">
                        {config.routes.map(route => route.name).join(', ')}
                      </Text>
                    </CustomBox>

                    {/* Usuarios de Telegram */}
                    <CustomBox css={{
                      padding: '16px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d'
                    }}>
                      <Text weight="medium" size="small" color="yellow600" css={{ marginBottom: '8px' }}>
                        <FaUsers style={{ marginRight: '8px' }} />
                        Usuarios de Telegram
                      </Text>
                      <Text size="small" color="yellow800">
                        {config.telegramUsers?.map(user => user.name).join(', ') || 'Sin usuarios asignados'}
                      </Text>
                    </CustomBox>


                    {/* Estado */}
                    <CustomBox css={{
                      padding: '16px',
                      backgroundColor: config.isActive ? '#f0fdf4' : '#fef2f2',
                      borderRadius: '8px',
                      border: `1px solid ${config.isActive ? '#bbf7d0' : '#fecaca'}`
                    }}>
                      <Text weight="medium" size="small" color={config.isActive ? 'green600' : 'red600'} css={{ marginBottom: '8px' }}>
                        Estado
                      </Text>
                      <Text size="small" color={config.isActive ? 'green800' : 'red800'}>
                        {config.isActive ? 'Activo' : 'Inactivo'}
                      </Text>
                    </CustomBox>
                  </CustomBox>
                </CustomBox>
              ))}
            </CustomBox>
          )}
                 </CustomBox>
       </CustomBox>

       {/* Toast Container */}
       <div style={{
         position: 'fixed',
         top: '20px',
         right: '20px',
         zIndex: 1000,
         display: 'flex',
         flexDirection: 'column',
         alignItems: 'flex-end',
         gap: '10px',
         '@media (max-width: 768px)': {
           top: '10px',
           right: '10px',
           left: '10px',
           alignItems: 'center',
         }
       }}>
         {toasts.map(toast => (
           <Toast key={toast.id} {...toast} />
         ))}
       </div>
     </PageContainer>
   );
 }
