import React, { useState, useEffect, useMemo } from 'react';
import { Stack, Text } from '@keystone-ui/core';
import { gql, useQuery, useMutation } from '@apollo/client';
import { telegramConfig } from '../config/telegram.config';
import { FaCog, FaTelegram, FaClock, FaRoute, FaUsers, FaPaperPlane, FaSave, FaTrash } from 'react-icons/fa';
import { PageContainer } from '@keystone-6/core/admin-ui/components';

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
          const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
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
          defaultSelected={isMulti ? (Array.isArray(value) ? value.includes(option.value) : false) : value === option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
};

// Tipos de reportes disponibles
const REPORT_TYPES = [
  { value: 'creditos_con_errores', label: 'Créditos con Documentos con Error' },
  { value: 'creditos_sin_documentos', label: 'Créditos Sin Documentos' },
  { value: 'creditos_completos', label: 'Créditos Completos' },
  { value: 'resumen_semanal', label: 'Resumen Semanal de Cartera' },
  { value: 'reporte_financiero', label: 'Reporte Financiero' }
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

// Canales de envío
const CHANNELS = [
  { value: 'telegram', label: 'Telegram', icon: FaTelegram },
  { value: 'email', label: 'Email', icon: FaTelegram },
  { value: 'whatsapp', label: 'WhatsApp', icon: FaTelegram }
];

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
      schedule
      routes {
        id
        name
      }
      recipients {
        id
        name
        email
      }
      telegramRecipients {
        id
        chatId
        name
        username
      }
      channel
      isActive
      createdAt
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
      schedule
      routes {
        id
        name
      }
      recipients {
        id
        name
        email
      }
      channel
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
      schedule
      routes {
        id
        name
      }
      recipients {
        id
        name
        email
      }
      channel
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

// Mutation para simular envío de reporte
const SEND_REPORT_NOW = gql`
  mutation SendReportNow($configId: ID!) {
    updateReportConfig(
      where: { id: $configId }
      data: { }
    ) {
      id
      name
      reportType
      channel
      isActive
      telegramRecipients {
        id
        chatId
        name
      }
    }
  }
`;

// Mutation para enviar mensaje de prueba a Telegram
const SEND_TEST_TELEGRAM = gql`
  mutation SendTestTelegram($chatId: String!, $message: String!) {
    sendTestTelegramMessage(chatId: $chatId, message: $message)
  }
`;

// Mutation para enviar reporte con PDF a Telegram (versión temporal sin routeIds)
const SEND_REPORT_WITH_PDF = gql`
  mutation SendReportWithPDF($chatId: String!, $reportType: String!) {
    sendReportWithPDF(chatId: $chatId, reportType: $reportType)
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
  recipients: User[];
  telegramRecipients?: TelegramUser[];
  channel: string;
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
  schedule: {
    days: string[];
    hour: string;
    timezone: string;
  };
  routes: string[];
  recipients: string[];
  channel: string;
  isActive: boolean;
}

export default function ConfiguracionReportesPage() {
  // Estados
  const [editingConfig, setEditingConfig] = useState<ReportConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ReportConfigForm>({
    name: '',
    reportType: 'creditos_con_errores', // Valor por defecto
    schedule: {
      days: [],
      hour: '09',
      timezone: 'America/Mexico_City'
    },
    routes: [],
    recipients: [],
    channel: 'telegram',
    isActive: true
  });

  // Queries
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);
  const { data: usersData, loading: usersLoading } = useQuery(GET_USERS);
  const { data: configsData, loading: configsLoading } = useQuery(GET_REPORT_CONFIGS);

  // Mutations
  const [createReportConfig] = useMutation(CREATE_REPORT_CONFIG);
  const [updateReportConfig] = useMutation(UPDATE_REPORT_CONFIG);
  const [deleteReportConfig] = useMutation(DELETE_REPORT_CONFIG);
  const [sendReportNow] = useMutation(SEND_REPORT_NOW);
  const [sendTestTelegram] = useMutation(SEND_TEST_TELEGRAM);
  const [sendReportWithPDF] = useMutation(SEND_REPORT_WITH_PDF);

  // Datos procesados
  const routes = routesData?.routes || [];
  const users = usersData?.users || [];
  const configs = configsData?.reportConfigs || [];

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
    if (formData.recipients.length === 0) {
      alert('Debe seleccionar al menos un destinatario');
      return;
    }
    if (formData.schedule.days.length === 0) {
      alert('Debe seleccionar al menos un día de envío');
      return;
    }

    try {
      const result = await createReportConfig({
        variables: {
          data: {
            name: formData.name,
            reportType: formData.reportType,
            schedule: formData.schedule,
            routes: { connect: formData.routes.map(id => ({ id })) },
            recipients: { connect: formData.recipients.map(id => ({ id })) },
            channel: formData.channel,
            isActive: formData.isActive
          }
        }
      });

      if (result.data?.createReportConfig) {
        setShowForm(false);
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
    if (formData.recipients.length === 0) {
      alert('Debe seleccionar al menos un destinatario');
      return;
    }
    if (formData.schedule.days.length === 0) {
      alert('Debe seleccionar al menos un día de envío');
      return;
    }

    try {
      const result = await updateReportConfig({
        variables: {
          id: editingConfig.id,
          data: {
            name: formData.name,
            reportType: formData.reportType,
            schedule: formData.schedule,
            routes: { connect: formData.routes.map(id => ({ id })) },
            recipients: { connect: formData.recipients.map(id => ({ id })) },
            channel: formData.channel,
            isActive: formData.isActive
          }
        }
      });

      if (result.data?.updateReportConfig) {
        setShowForm(false);
        setEditingConfig(null);
        resetForm();
        alert('Configuración actualizada exitosamente');
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
      await deleteReportConfig({
        variables: { id: configId }
      });

      alert('Configuración eliminada exitosamente');
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

  const handleSendNow = async (configId: string) => {
    try {
      console.log('🔥 FUNCIÓN handleSendNow LLAMADA con configId:', configId);
      
      const config = configs.find(c => c.id === configId);
      console.log('📋 Configuración encontrada:', config);
      
      if (!config) { 
        alert('Configuración no encontrada'); 
        return; 
      }
      
      if (!config.isActive) { 
        alert('La configuración del reporte no está activa'); 
        return; 
      }
      
      if (config.channel === 'telegram' && (!config.telegramRecipients || config.telegramRecipients.length === 0)) {
        alert('No hay destinatarios de Telegram configurados');
        return;
      }

      // Obtener IDs de rutas configuradas
      const routeIds = config.routes.map(route => route.id);
      console.log(`📋 Configuración del reporte:`, {
        id: config.id,
        name: config.name,
        reportType: config.reportType,
        routeIds: routeIds,
        recipientsCount: config.telegramRecipients?.length || 0
      });

      // Enviar a todos los destinatarios de Telegram
      let sentCount = 0;
      let errorCount = 0;
      
      if (config.telegramRecipients && config.telegramRecipients.length > 0) {
        console.log(`📱 Enviando por Telegram a ${config.telegramRecipients.length} destinatarios`);
        
        for (const recipient of config.telegramRecipients) {
          try {
            let sent = false;
            
            console.log(`🔍 Verificando tipo de reporte: "${config.reportType}" === "creditos_con_errores"?`, config.reportType === 'creditos_con_errores');
            console.log(`🔍 Tipo de dato del reportType:`, typeof config.reportType);
            console.log(`🔍 Comparación estricta:`, config.reportType === 'creditos_con_errores');
            console.log(`🔍 Comparación con includes:`, config.reportType.includes('creditos_con_errores'));
            
            // Para créditos con errores, usar la nueva mutación con PDF
            const isCreditsWithErrors = config.reportType === 'creditos_con_errores' || 
                                       config.reportType.includes('creditos_con_errores') ||
                                       config.reportType.includes('Créditos con Documentos con Error');
            
            console.log(`🎯 ¿Es reporte de créditos con errores?`, isCreditsWithErrors);
            
            // TEMPORAL: Forzar uso de PDF para debug
            const forcePDF = true;
            console.log(`🧪 FORZANDO USO DE PDF para debug`);
            console.log(`🔥 ANTES DE LA CONDICIÓN - forcePDF:`, forcePDF);
            
            if (forcePDF) {
              console.log(`📋 DETECTADO REPORTE DE CRÉDITOS CON ERRORES`);
              console.log(`📋 Tipo de reporte: "${config.reportType}"`);
              console.log(`📋 Route IDs: [${routeIds.join(', ')}]`);
              console.log(`📋 Chat ID: ${recipient.chatId}`);
              console.log(`📋 Enviando reporte PDF de créditos con errores a ${recipient.name}`);
              console.log(`📋 Función sendReportWithPDF disponible:`, typeof sendReportWithPDF);
              
              const result = await sendReportWithPDF({
                variables: { 
                  chatId: recipient.chatId, 
                  reportType: config.reportType
                }
              });
              
              console.log(`📋 Mutación ejecutada, esperando respuesta...`);
              
              console.log(`📋 Resultado completo de la mutación:`, result);
              
              if (result.data?.sendReportWithPDF) {
                const response = result.data.sendReportWithPDF;
                sent = response.includes('✅');
                console.log(`📋 Respuesta PDF: ${response}`);
              } else if (result.errors) {
                console.error(`❌ Errores en la mutación:`, result.errors);
              }
            } else {
              console.log(`📝 USANDO MÉTODO ANTERIOR para tipo: "${config.reportType}"`);
              console.log(`❌ LA CONDICIÓN FALLÓ - No se detectó creditos_con_errores`);
              console.log(`❌ Valor exacto recibido: [${config.reportType}]`);
              console.log(`❌ Longitud del string: ${config.reportType.length}`);
              console.log(`❌ Caracteres: ${config.reportType.split('').map(c => c.charCodeAt(0))}`);
              // Para otros tipos de reporte, usar el método anterior (mensaje de texto)
              let reportContent = '';
              switch (config.reportType) {
                case 'creditos_sin_documentos': 
                  reportContent = '⚠️ <b>REPORTE: Créditos Sin Documentos</b>\n\nReporte generado automáticamente\n\n✅ <b>Enviado desde Keystone Admin</b>'; 
                  break;
                case 'creditos_completos': 
                  reportContent = '✅ <b>REPORTE: Créditos Completos</b>\n\nReporte generado automáticamente\n\n✅ <b>Enviado desde Keystone Admin</b>'; 
                  break;
                case 'resumen_semanal': 
                  reportContent = '📊 <b>REPORTE: Resumen Semanal de Cartera</b>\n\nReporte generado automáticamente\n\n✅ <b>Enviado desde Keystone Admin</b>'; 
                  break;
                case 'reporte_financiero': 
                  reportContent = '💰 <b>REPORTE: Reporte Financiero</b>\n\nReporte generado automáticamente\n\n✅ <b>Enviado desde Keystone Admin</b>'; 
                  break;
                default: 
                  reportContent = `📊 <b>REPORTE: ${config.reportType}</b>\n\nReporte generado automáticamente\n\n✅ <b>Enviado desde Keystone Admin</b>`;
              }
              
              sent = await sendTelegramMessage(recipient.chatId, reportContent);
            }
            
            if (sent) {
              sentCount++;
              console.log(`✅ Reporte enviado exitosamente a ${recipient.name} (${recipient.chatId})`);
            } else {
              errorCount++;
              console.log(`❌ Error enviando reporte a ${recipient.name}`);
            }
          } catch (error) {
            console.error(`❌ Error enviando reporte a ${recipient.name}:`, error);
            errorCount++;
          }
        }
      }

      const result = `Reporte enviado: ${sentCount} exitosos, ${errorCount} fallidos`;
      console.log('✅', result);
      
      if (sentCount > 0) {
        alert(`✅ ${result}\n\nRevisa tu Telegram para ver el ${config.reportType === 'creditos_con_errores' ? 'PDF' : 'mensaje'}.`);
      } else {
        alert(`❌ ${result}\n\nRevisa la consola para más detalles.`);
      }
      
    } catch (error) {
      console.error('Error sending report:', error);
      alert('Error al enviar reporte: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };



  // Función para editar configuración
  const handleEditConfig = (config: ReportConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      reportType: config.reportType,
      schedule: config.schedule,
      routes: config.routes.map(r => r.id),
      recipients: config.recipients.map(r => r.id),
      channel: config.channel,
      isActive: config.isActive
    });
    setShowForm(true);
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
      reportType: 'creditos_con_errores', // Valor por defecto
      schedule: {
        days: [],
        hour: '09',
        timezone: 'America/Mexico_City'
      },
      routes: [],
      recipients: [],
      channel: 'telegram',
      isActive: true
    });
  };

  // Funciones auxiliares
  const getReportTypeLabel = (type: string) => {
    return REPORT_TYPES.find(t => t.value === type)?.label || type;
  };

  const getChannelLabel = (channel: string) => {
    return CHANNELS.find(c => c.value === channel)?.label || channel;
  };

  // Loading state
  if (routesLoading || usersLoading || configsLoading) {
    return (
      <PageContainer header="Configuración de Reportes Automáticos">
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
    <PageContainer header="⚙️ Configuración de Reportes Automáticos">
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
              Configuración de Envío Automático
            </Text>
            <Text size="small" color="neutral600" css={{ marginTop: '8px' }}>
              Configura reportes automáticos por ruta, horario y destinatarios
            </Text>
          </CustomBox>
          <CustomButton
            onClick={() => setShowForm(true)}
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

        {/* Formulario de configuración */}
        {showForm && (
          <CustomBox css={{
            padding: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <Text weight="bold" size="large" color="black" css={{ marginBottom: '24px' }}>
              {editingConfig ? 'Editar Configuración' : 'Nueva Configuración'}
            </Text>

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

              {/* Hora de envío */}
              <CustomBox>
                <Text weight="medium" size="small" color="black" marginBottom="small">
                  Hora de Envío
                </Text>
                <CustomSelect
                  value={formData.schedule.hour}
                  onChange={(option) => handleFormChange('schedule.hour', option?.value)}
                  options={HOURS}
                  placeholder="Selecciona la hora"
                />
              </CustomBox>

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

              {/* Destinatarios */}
              <CustomBox>
                <Text weight="medium" size="small" color="black" marginBottom="small">
                  Destinatarios
                </Text>
                <CustomSelect
                  value={formData.recipients}
                  onChange={(options) => handleFormChange('recipients', options)}
                  options={users.map(user => ({ value: user.id, label: `${user.name} (${user.email})` }))}
                  placeholder="Selecciona los destinatarios"
                  isMulti
                />
              </CustomBox>

              {/* Canal de envío */}
              <CustomBox>
                <Text weight="medium" size="small" color="black" marginBottom="small">
                  Canal de Envío
                </Text>
                <CustomSelect
                  value={formData.channel}
                  onChange={(option) => handleFormChange('channel', option?.value)}
                  options={CHANNELS}
                  placeholder="Selecciona el canal"
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
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '1px solid #e2e8f0'
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
                  fontWeight: '600'
                }}
              >
                Cancelar
              </CustomButton>
              <CustomButton
                onClick={editingConfig ? handleUpdateConfig : handleCreateConfig}
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
                {editingConfig ? 'Actualizar' : 'Crear'}
              </CustomButton>
            </CustomBox>
          </CustomBox>
        )}

        {/* Lista de configuraciones existentes */}
        <CustomBox>
          <Text weight="bold" size="large" color="black" css={{ marginBottom: '24px' }}>
            Configuraciones Existentes
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
                No hay configuraciones de reportes automáticos
              </Text>
              <Text size="small" color="neutral500" css={{ marginTop: '8px' }}>
                Crea tu primera configuración para comenzar a enviar reportes automáticamente
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
                        css={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          '&:hover': { backgroundColor: '#2563eb' }
                        }}
                      >
                        <FaPaperPlane style={{ marginRight: '8px' }} />
                        Enviar Ahora
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

                    {/* Destinatarios */}
                    <CustomBox css={{
                      padding: '16px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d'
                    }}>
                      <Text weight="medium" size="small" color="yellow600" css={{ marginBottom: '8px' }}>
                        <FaUsers style={{ marginRight: '8px' }} />
                        Destinatarios
                      </Text>
                      <Text size="small" color="yellow800">
                        {config.recipients.map(recipient => recipient.name).join(', ')}
                      </Text>
                    </CustomBox>

                    {/* Canal */}
                    <CustomBox css={{
                      padding: '16px',
                      backgroundColor: '#f3e8ff',
                      borderRadius: '8px',
                      border: '1px solid #d8b4fe'
                    }}>
                      <Text weight="medium" size="small" color="purple600" css={{ marginBottom: '8px' }}>
                        <FaTelegram style={{ marginRight: '8px' }} />
                        Canal
                      </Text>
                      <Text size="small" color="purple800">
                        {getChannelLabel(config.channel)}
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
     </PageContainer>
   );
 }
