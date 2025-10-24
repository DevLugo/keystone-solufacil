/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { Stack, Text } from '@keystone-ui/core';
import { gql, useQuery, useMutation } from '@apollo/client';
import { FaCog, FaBell, FaBellSlash, FaSave, FaTelegram, FaExclamationTriangle } from 'react-icons/fa';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Toast, ToastProps } from '../components/Toast';

// Componente Box personalizado
const CustomBox = ({ children, css, ...props }) => {
  return (
    <div style={{ ...css, ...props }}>
      {children}
    </div>
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

// Componente Select personalizado
const CustomSelect = ({ value, onChange, options, placeholder }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        backgroundColor: 'white'
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

// Query para obtener configuración de notificaciones
const GET_NOTIFICATION_CONFIG = gql`
  query GetNotificationConfig {
    notificationConfigs {
      id
      name
      isActive
      sendErrorNotifications
      sendMissingNotifications
      errorNotificationMessage
      missingNotificationMessage
      createdAt
      updatedAt
    }
  }
`;

// Mutation para crear/actualizar configuración
const UPSERT_NOTIFICATION_CONFIG = gql`
  mutation UpsertNotificationConfig($data: NotificationConfigUpsertInput!) {
    upsertNotificationConfig(data: $data) {
      id
      name
      isActive
      sendErrorNotifications
      sendMissingNotifications
      errorNotificationMessage
      missingNotificationMessage
      createdAt
      updatedAt
    }
  }
`;

// Interfaces
interface NotificationConfig {
  id: string;
  name: string;
  isActive: boolean;
  sendErrorNotifications: boolean;
  sendMissingNotifications: boolean;
  errorNotificationMessage: string;
  missingNotificationMessage: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationConfigForm {
  name: string;
  isActive: boolean;
  sendErrorNotifications: boolean;
  sendMissingNotifications: boolean;
  errorNotificationMessage: string;
  missingNotificationMessage: string;
}

export default function ConfiguracionNotificacionesDocumentosPage() {
  // Estados
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [formData, setFormData] = useState<NotificationConfigForm>({
    name: 'Configuración de Notificaciones de Documentos',
    isActive: true,
    sendErrorNotifications: true,
    sendMissingNotifications: true,
    errorNotificationMessage: '🚨 <b>DOCUMENTO CON ERROR</b>\n\n📋 Tipo: {documentType}\n👤 Persona: {personName} ({personType})\n🏠 Localidad: {localityName}\n🛣️ Ruta: {routeName}\n👨‍💼 Líder: {routeLeadName}\n\n❌ <b>Descripción del Error:</b>\n{errorDescription}\n\n📅 Fecha: {date}\n\n🔗 <a href="{documentUrl}">Ver Documento</a>',
    missingNotificationMessage: '📋 <b>DOCUMENTO FALTANTE</b>\n\n👤 Persona: {personName} ({personType})\n🏠 Localidad: {localityName}\n🛣️ Ruta: {routeName}\n👨‍💼 Líder: {routeLeadName}\n\n📅 Fecha: {date}\n\n🔗 <a href="{loanUrl}">Ver Préstamo</a>'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados para toasts
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  // Queries
  const { data: configData, loading: configLoading, refetch } = useQuery(GET_NOTIFICATION_CONFIG);
  
  // Mutations
  const [upsertNotificationConfig] = useMutation(UPSERT_NOTIFICATION_CONFIG);

  // Efecto para cargar configuración existente
  useEffect(() => {
    if (configData?.notificationConfigs?.length > 0) {
      const existingConfig = configData.notificationConfigs[0];
      setConfig(existingConfig);
      setFormData({
        name: existingConfig.name,
        isActive: existingConfig.isActive,
        sendErrorNotifications: existingConfig.sendErrorNotifications,
        sendMissingNotifications: existingConfig.sendMissingNotifications,
        errorNotificationMessage: existingConfig.errorNotificationMessage,
        missingNotificationMessage: existingConfig.missingNotificationMessage
      });
    }
  }, [configData]);

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

  // Función para manejar cambios en el formulario
  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Función para guardar configuración
  const handleSaveConfig = async () => {
    setIsSaving(true);
    
    try {
      const result = await upsertNotificationConfig({
        variables: {
          data: {
            name: formData.name,
            isActive: formData.isActive,
            sendErrorNotifications: formData.sendErrorNotifications,
            sendMissingNotifications: formData.sendMissingNotifications,
            errorNotificationMessage: formData.errorNotificationMessage,
            missingNotificationMessage: formData.missingNotificationMessage
          }
        }
      });

      if (result.data?.upsertNotificationConfig) {
        setConfig(result.data.upsertNotificationConfig);
        addToast({
          type: 'success',
          title: 'Configuración guardada',
          message: 'La configuración de notificaciones se ha guardado exitosamente'
        });
        
        // Refetch para obtener la configuración actualizada
        refetch();
      }
    } catch (error) {
      console.error('Error saving notification config:', error);
      addToast({
        type: 'error',
        title: 'Error al guardar',
        message: 'Error al guardar la configuración: ' + (error as Error).message
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Función para resetear a valores por defecto
  const handleResetToDefaults = () => {
    if (confirm('¿Estás seguro de que quieres resetear a los valores por defecto?')) {
      setFormData({
        name: 'Configuración de Notificaciones de Documentos',
        isActive: true,
        sendErrorNotifications: true,
        sendMissingNotifications: true,
        errorNotificationMessage: '🚨 <b>DOCUMENTO CON ERROR</b>\n\n📋 Tipo: {documentType}\n👤 Persona: {personName} ({personType})\n🏠 Localidad: {localityName}\n🛣️ Ruta: {routeName}\n👨‍💼 Líder: {routeLeadName}\n\n❌ <b>Descripción del Error:</b>\n{errorDescription}\n\n📅 Fecha: {date}\n\n🔗 <a href="{documentUrl}">Ver Documento</a>',
        missingNotificationMessage: '📋 <b>DOCUMENTO FALTANTE</b>\n\n👤 Persona: {personName} ({personType})\n🏠 Localidad: {localityName}\n🛣️ Ruta: {routeName}\n👨‍💼 Líder: {routeLeadName}\n\n📅 Fecha: {date}\n\n🔗 <a href="{loanUrl}">Ver Préstamo</a>'
      });
    }
  };

  // Loading state
  if (configLoading) {
    return (
      <PageContainer header="🔔 Configuración de Notificaciones">
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
              Cargando configuración...
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
    <PageContainer header="🔔 Configuración de Notificaciones de Documentos">
      <CustomBox css={{ padding: '32px' }}>
        {/* Header */}
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
              Configuración de Notificaciones de Documentos
            </Text>
            <Text size="small" color="neutral600" css={{ marginTop: '8px' }}>
              Controla si se envían notificaciones de Telegram cuando se marcan documentos con error o faltantes
            </Text>
          </CustomBox>
        </CustomBox>

        {/* Formulario de configuración */}
        <CustomBox css={{
          padding: '32px',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          {/* Configuración general */}
          <CustomBox css={{ marginBottom: '32px' }}>
            <Text weight="bold" size="large" color="black" css={{ marginBottom: '24px' }}>
              ⚙️ Configuración General
            </Text>
            
            <CustomBox css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Nombre de la configuración */}
              <CustomBox>
                <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
                  Nombre de la Configuración
                </Text>
                <CustomInput
                  value={formData.name}
                  onChange={(value) => handleFormChange('name', value)}
                  placeholder="Nombre de la configuración"
                />
              </CustomBox>

              {/* Estado activo */}
              <CustomBox>
                <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
                  Estado
                </Text>
                <CustomSelect
                  value={formData.isActive ? 'active' : 'inactive'}
                  onChange={(value) => handleFormChange('isActive', value === 'active')}
                  options={[
                    { value: 'active', label: 'Activo' },
                    { value: 'inactive', label: 'Inactivo' }
                  ]}
                  placeholder="Selecciona el estado"
                />
              </CustomBox>
            </CustomBox>
          </CustomBox>

          {/* Configuración de notificaciones */}
          <CustomBox css={{ marginBottom: '32px' }}>
            <Text weight="bold" size="large" color="black" css={{ marginBottom: '24px' }}>
              📱 Configuración de Notificaciones
            </Text>
            
            <CustomBox css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Notificaciones de error */}
              <CustomBox css={{
                padding: '20px',
                backgroundColor: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca'
              }}>
                <CustomBox css={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <FaExclamationTriangle style={{ marginRight: '8px', color: '#dc2626' }} />
                  <Text weight="bold" size="medium" color="red600">
                    Notificaciones de Error
                  </Text>
                </CustomBox>
                
                <CustomBox css={{ marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.sendErrorNotifications}
                      onChange={(e) => handleFormChange('sendErrorNotifications', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <Text size="small" color="red800">
                      Enviar notificaciones cuando se marque un documento con error
                    </Text>
                  </label>
                </CustomBox>
              </CustomBox>

              {/* Notificaciones de faltante */}
              <CustomBox css={{
                padding: '20px',
                backgroundColor: '#fef3c7',
                borderRadius: '8px',
                border: '1px solid #fcd34d'
              }}>
                <CustomBox css={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <FaBell style={{ marginRight: '8px', color: '#d97706' }} />
                  <Text weight="bold" size="medium" color="yellow600">
                    Notificaciones de Faltante
                  </Text>
                </CustomBox>
                
                <CustomBox css={{ marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.sendMissingNotifications}
                      onChange={(e) => handleFormChange('sendMissingNotifications', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <Text size="small" color="yellow800">
                      Enviar notificaciones cuando se marque un documento como faltante
                    </Text>
                  </label>
                </CustomBox>
              </CustomBox>
            </CustomBox>
          </CustomBox>

          {/* Plantillas de mensajes */}
          <CustomBox css={{ marginBottom: '32px' }}>
            <Text weight="bold" size="large" color="black" css={{ marginBottom: '24px' }}>
              📝 Plantillas de Mensajes
            </Text>
            
            <CustomBox css={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              {/* Plantilla para errores */}
              <CustomBox>
                <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
                  Plantilla para Notificaciones de Error
                </Text>
                <Text size="small" color="neutral600" css={{ marginBottom: '8px' }}>
                  Variables disponibles: {'{documentType}'}, {'{personName}'}, {'{personType}'}, {'{localityName}'}, {'{routeName}'}, {'{routeLeadName}'}, {'{errorDescription}'}, {'{date}'}, {'{documentUrl}'}
                </Text>
                <textarea
                  value={formData.errorNotificationMessage}
                  onChange={(e) => handleFormChange('errorNotificationMessage', e.target.value)}
                  placeholder="Plantilla del mensaje para errores"
                  style={{
                    width: '100%',
                    height: '120px',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />
              </CustomBox>

              {/* Plantilla para faltantes */}
              <CustomBox>
                <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
                  Plantilla para Notificaciones de Faltante
                </Text>
                <Text size="small" color="neutral600" css={{ marginBottom: '8px' }}>
                  Variables disponibles: {'{personName}'}, {'{personType}'}, {'{localityName}'}, {'{routeName}'}, {'{routeLeadName}'}, {'{date}'}, {'{loanUrl}'}
                </Text>
                <textarea
                  value={formData.missingNotificationMessage}
                  onChange={(e) => handleFormChange('missingNotificationMessage', e.target.value)}
                  placeholder="Plantilla del mensaje para faltantes"
                  style={{
                    width: '100%',
                    height: '120px',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />
              </CustomBox>
            </CustomBox>
          </CustomBox>

          {/* Botones de acción */}
          <CustomBox css={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'flex-end',
            paddingTop: '24px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <CustomButton
              onClick={handleResetToDefaults}
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
              Resetear a Valores por Defecto
            </CustomButton>
            <CustomButton
              onClick={handleSaveConfig}
              disabled={isSaving}
              css={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isSaving ? '#9ca3af' : '#10b981',
                color: 'white',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                '&:hover': { 
                  backgroundColor: isSaving ? '#9ca3af' : '#059669' 
                },
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isSaving ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #ffffff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Guardando...
                </>
              ) : (
                <>
                  <FaSave />
                  Guardar Configuración
                </>
              )}
            </CustomButton>
          </CustomBox>
        </CustomBox>

        {/* Información adicional */}
        <CustomBox css={{
          marginTop: '24px',
          padding: '20px',
          backgroundColor: '#f0f9ff',
          borderRadius: '8px',
          border: '1px solid #bae6fd'
        }}>
          <Text weight="medium" size="small" color="blue600" css={{ marginBottom: '8px' }}>
            💡 Información Importante
          </Text>
          <Text size="small" color="blue800">
            • Las notificaciones solo se enviarán si el líder de ruta tiene Telegram configurado<br/>
            • Los mensajes soportan formato HTML para texto en negrita, cursiva y enlaces<br/>
            • Las variables se reemplazarán automáticamente con los datos reales del documento<br/>
            • Si desactivas las notificaciones, no se enviarán mensajes de Telegram para ese tipo de problema
          </Text>
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
        gap: '10px'
      }}>
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </PageContainer>
  );
}
