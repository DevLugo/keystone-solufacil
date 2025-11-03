import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Text } from '@keystone-ui/core';

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

// Componente Button personalizado
const CustomButton = ({ children, onClick, disabled, css, ...props }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...css,
        ...props,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1
      }}
    >
      {children}
    </button>
  );
};

// Componente para mostrar información detallada de errores
const LogRow = ({ log }: { log: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT': return '✅';
      case 'ERROR': return '❌';
      case 'FAILED': return '⚠️';
      case 'NO_TELEGRAM': return '📱';
      case 'NO_LEADER': return '👤';
      case 'NO_ROUTE': return '🛣️';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT': return '#10b981';
      case 'ERROR': return '#ef4444';
      case 'FAILED': return '#f59e0b';
      case 'NO_TELEGRAM': return '#8b5cf6';
      case 'NO_LEADER': return '#f97316';
      case 'NO_ROUTE': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const hasErrorDetails = log.status === 'ERROR' || log.status === 'FAILED' || 
                         log.telegramErrorMessage || log.telegramErrorCode || 
                         log.telegramResponse || log.notes;

  return (
    <>
      <CustomBox
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr',
          gap: '16px',
          padding: '16px 24px',
          borderBottom: '1px solid #f3f4f6',
          cursor: hasErrorDetails ? 'pointer' : 'default'
        }}
        onClick={() => hasErrorDetails && setIsExpanded(!isExpanded)}
      >
        <CustomBox>
          <Text size="small" weight="medium" color="black">
            {log.issueType === 'REPORT' ? log.routeName || 'Reporte Automático' : log.documentId}
          </Text>
          <Text size="small" color="neutral600">
            {log.issueType === 'REPORT' ? 'Reporte Automático' : log.documentType}
          </Text>
        </CustomBox>

        <CustomBox>
          <Text size="small" color="black">
            {log.issueType === 'REPORT' ? log.personName || 'Destinatario' : log.personName || 'Sin nombre'}
          </Text>
          <Text size="small" color="neutral600">
            {log.issueType === 'REPORT' ? log.localityName || 'Tipo de Reporte' : log.localityName || 'Sin localidad'}
          </Text>
        </CustomBox>

        <CustomBox>
          <Text size="small" color="black">
            {log.issueType === 'REPORT' ? log.routeName || 'Configuración' : log.routeName || 'Sin ruta'}
          </Text>
          <Text size="small" color="neutral600">
            {log.issueType === 'REPORT' ? `Config: ${log.routeName || 'N/A'}` : `Líder: ${log.routeLeadName || 'Sin líder'}`}
          </Text>
        </CustomBox>

        <CustomBox style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getStatusIcon(log.status)}
          <Text size="small" color={getStatusColor(log.status)}>
            {log.status}
          </Text>
          {hasErrorDetails && (
            <Text size="small" color="neutral500">
              {isExpanded ? '▼' : '▶'}
            </Text>
          )}
        </CustomBox>

        <CustomBox>
          <Text size="small" color="black">
            {log.telegramChatId ? `Chat: ${log.telegramChatId}` : 'Sin Telegram'}
          </Text>
          <Text size="small" color="neutral600">
            {log.telegramUsername || 'Sin username'}
          </Text>
        </CustomBox>

        <CustomBox>
          <Text size="small" color="black">
            {formatDate(log.createdAt)}
          </Text>
          {log.responseTimeMs && (
            <Text size="small" color="neutral600">
              {formatResponseTime(log.responseTimeMs)}
            </Text>
          )}
        </CustomBox>
      </CustomBox>

      {/* Panel expandible con detalles del error */}
      {isExpanded && hasErrorDetails && (
        <CustomBox style={{
          padding: '24px',
          backgroundColor: '#fef2f2',
          borderLeft: '4px solid #ef4444',
          borderBottom: '1px solid #f3f4f6'
        }}>
          <Text weight="bold" size="medium" color="black" style={{ marginBottom: '16px' }}>
            🔍 Detalles del Error
          </Text>
          
          <CustomBox style={{ display: 'grid', gap: '16px' }}>
            {/* Información básica del error */}
            <CustomBox>
              <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                📋 Información Básica
              </Text>
              <CustomBox style={{ 
                padding: '12px', 
                backgroundColor: 'white', 
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <Text size="small" color="black">
                    <strong>Estado:</strong> {log.status}
                  </Text>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <Text size="small" color="black">
                    <strong>Tipo de Problema:</strong> {log.issueType}
                  </Text>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <Text size="small" color="black">
                    <strong>Documento ID:</strong> {log.documentId}
                  </Text>
                </div>
                <div>
                  <Text size="small" color="black">
                    <strong>Descripción:</strong> {log.description || 'Sin descripción'}
                  </Text>
                </div>
              </CustomBox>
            </CustomBox>

            {/* Detalles de Telegram */}
            {(log.telegramChatId || log.telegramUsername || log.telegramErrorMessage || log.telegramErrorCode) && (
              <CustomBox>
                <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                  📱 Información de Telegram
                </Text>
                <CustomBox style={{ 
                  padding: '12px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Text size="small" color="black">
                      <strong>Chat ID:</strong> {log.telegramChatId || 'No disponible'}
                    </Text>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <Text size="small" color="black">
                      <strong>Username:</strong> {log.telegramUsername || 'No disponible'}
                    </Text>
                  </div>
                  {log.telegramErrorCode && (
                    <div style={{ marginBottom: '8px' }}>
                      <Text size="small" color="red">
                        <strong>Código de Error:</strong> {log.telegramErrorCode}
                      </Text>
                    </div>
                  )}
                  {log.telegramErrorMessage && (
                    <div style={{ marginBottom: '8px' }}>
                      <Text size="small" color="red">
                        <strong>Mensaje de Error:</strong> {log.telegramErrorMessage}
                      </Text>
                    </div>
                  )}
                  {log.telegramResponse && (
                    <div>
                      <Text size="small" color="black">
                        <strong>Respuesta de Telegram:</strong> {log.telegramResponse}
                      </Text>
                    </div>
                  )}
                </CustomBox>
              </CustomBox>
            )}

            {/* Información del destinatario */}
            <CustomBox>
              <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                👤 Información del Destinatario
              </Text>
              <CustomBox style={{ 
                padding: '12px', 
                backgroundColor: 'white', 
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <Text size="small" color="black">
                    <strong>Nombre:</strong> {log.personName || 'No disponible'}
                  </Text>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <Text size="small" color="black">
                    <strong>Localidad:</strong> {log.localityName || 'No disponible'}
                  </Text>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <Text size="small" color="black">
                    <strong>Ruta:</strong> {log.routeName || 'No disponible'}
                  </Text>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <Text size="small" color="black">
                    <strong>Líder de Ruta:</strong> {log.routeLeadName || 'No disponible'}
                  </Text>
                </div>
                <div>
                  <Text size="small" color="black">
                    <strong>ID del Líder:</strong> {log.routeLeadId || 'No disponible'}
                  </Text>
                </div>
              </CustomBox>
            </CustomBox>

            {/* Información de tiempo y rendimiento */}
            <CustomBox>
              <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                ⏱️ Información de Tiempo
              </Text>
              <CustomBox style={{ 
                padding: '12px', 
                backgroundColor: 'white', 
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <Text size="small" color="black">
                    <strong>Creado:</strong> {formatDate(log.createdAt)}
                  </Text>
                </div>
                {log.sentAt && (
                  <div style={{ marginBottom: '8px' }}>
                    <Text size="small" color="black">
                      <strong>Enviado:</strong> {formatDate(log.sentAt)}
                    </Text>
                  </div>
                )}
                {log.responseTimeMs && (
                  <div style={{ marginBottom: '8px' }}>
                    <Text size="small" color="black">
                      <strong>Tiempo de Respuesta:</strong> {formatResponseTime(log.responseTimeMs)}
                    </Text>
                  </div>
                )}
                {log.retryCount && log.retryCount > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <Text size="small" color="orange">
                      <strong>Reintentos:</strong> {log.retryCount}
                    </Text>
                  </div>
                )}
                {log.lastRetryAt && (
                  <div>
                    <Text size="small" color="black">
                      <strong>Último Reintento:</strong> {formatDate(log.lastRetryAt)}
                    </Text>
                  </div>
                )}
              </CustomBox>
            </CustomBox>

            {/* Notas y información adicional */}
            {log.notes && (
              <CustomBox>
                <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                  📝 Notas Adicionales
                </Text>
                <CustomBox style={{ 
                  padding: '12px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <Text size="small" color="black">
                    {log.notes}
                  </Text>
                </CustomBox>
              </CustomBox>
            )}

            {/* Información específica para reportes automáticos */}
            {log.issueType === 'REPORT' && (
              <CustomBox>
                <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                  🤖 Información del Reporte Automático
                </Text>
                <CustomBox style={{ 
                  padding: '12px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Text size="small" color="black">
                      <strong>Tipo de Reporte:</strong> {log.localityName || 'No disponible'}
                    </Text>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <Text size="small" color="black">
                      <strong>Configuración:</strong> {log.routeName || 'No disponible'}
                    </Text>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <Text size="small" color="black">
                      <strong>Destinatario:</strong> {log.personName || 'No disponible'}
                    </Text>
                  </div>
                  <div>
                    <Text size="small" color="black">
                      <strong>Email del Destinatario:</strong> {log.routeLeadUserId || 'No disponible'}
                    </Text>
                  </div>
                </CustomBox>
              </CustomBox>
            )}
          </CustomBox>
        </CustomBox>
      )}
    </>
  );
};

// Query GraphQL
const GET_NOTIFICATION_LOGS = `
  query GetNotificationLogs($where: DocumentNotificationLogWhereInput, $orderBy: [DocumentNotificationLogOrderByInput!], $take: Int, $skip: Int) {
    documentNotificationLogs(where: $where, orderBy: $orderBy, take: $take, skip: $skip) {
      id
      documentId
      documentType
      personName
      routeName
      localityName
      routeLeadName
      routeLeadId
      issueType
      status
      telegramChatId
      telegramUsername
      telegramErrorMessage
      telegramErrorCode
      telegramResponse
      sentAt
      responseTimeMs
      retryCount
      lastRetryAt
      notes
      description
      createdAt
    }
  }
`;

const GET_NOTIFICATION_STATS = `
  query GetNotificationStats {
    documentNotificationLogs {
      id
      status
    }
  }
`;

// Opciones para filtros
const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'SENT', label: 'Enviado' },
  { value: 'ERROR', label: 'Error' },
  { value: 'FAILED', label: 'Fallido' },
  { value: 'NO_TELEGRAM', label: 'Sin Telegram' },
  { value: 'NO_LEADER', label: 'Sin Líder' },
  { value: 'NO_ROUTE', label: 'Sin Ruta' }
];

const ISSUE_TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'ERROR', label: 'Error' },
  { value: 'MISSING', label: 'Faltante' },
  { value: 'REPORT', label: 'Reporte Automático' }
];

export default function LogsNotificacionesPage() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    issueType: '',
    dateFrom: '',
    dateTo: '',
    logType: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Queries
  const { data: logsData, loading: logsLoading, refetch: refetchLogs } = useQuery(GET_NOTIFICATION_LOGS, {
    variables: {
      where: {
        ...(filters.search && {
          OR: [
            { personName: { contains: filters.search } },
            { documentId: { contains: filters.search } },
            { routeName: { contains: filters.search } },
            { localityName: { contains: filters.search } }
          ]
        }),
        ...(filters.status && { status: filters.status }),
        ...(filters.issueType && { issueType: filters.issueType }),
        ...(filters.logType && { issueType: filters.logType }),
        ...(filters.dateFrom && { createdAt: { gte: filters.dateFrom } }),
        ...(filters.dateTo && { createdAt: { lte: filters.dateTo } })
      },
      orderBy: [{ createdAt: 'desc' }],
      take: itemsPerPage,
      skip: (currentPage - 1) * itemsPerPage
    }
  });

  const { data: statsData, loading: statsLoading } = useQuery(GET_NOTIFICATION_STATS);

  // Calcular estadísticas
  const stats = React.useMemo(() => {
    if (!statsData?.documentNotificationLogs) return null;

    const logs = statsData.documentNotificationLogs;
    const total = logs.length;
    const byStatus = logs.reduce((acc, log) => {
      acc[log.status] = (acc[log.status] || 0) + 1;
      return acc;
    }, {});

    return { total, byStatus };
  }, [statsData]);

  // Función para manejar cambios en filtros
  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  // Función para limpiar filtros
  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      issueType: '',
      dateFrom: '',
      dateTo: '',
      logType: ''
    });
    setCurrentPage(1);
  };

  // Función para refrescar datos
  const handleRefresh = () => {
    refetchLogs();
  };

  const logs = logsData?.documentNotificationLogs || [];

  return (
    <PageContainer header="📊 Logs de Notificaciones de Documentos">
      <CustomBox style={{ padding: '32px' }}>
        {/* Header con estadísticas */}
        <CustomBox style={{
          padding: '24px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '24px'
        }}>
          <CustomBox style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <Text weight="bold" size="large" color="black">
              📊 Logs de Notificaciones
            </Text>
            <CustomButton
              onClick={handleRefresh}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                color: '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              🔄 Refrescar
            </CustomButton>
          </CustomBox>

          {/* Estadísticas */}
          {stats && (
            <CustomBox style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <CustomBox style={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <Text weight="bold" size="large" color="black">
                  {stats.total}
                </Text>
                <Text size="small" color="neutral600">
                  Total de Logs
                </Text>
              </CustomBox>
              
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <CustomBox key={status} style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <Text weight="bold" size="large" color="black">
                    {count}
                  </Text>
                  <Text size="small" color="neutral600">
                    {status}
                  </Text>
                </CustomBox>
              ))}
            </CustomBox>
          )}
        </CustomBox>

        {/* Filtros */}
        <CustomBox style={{
          padding: '24px',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '24px'
        }}>
          <Text weight="bold" size="medium" color="black" style={{ marginBottom: '16px' }}>
            🔍 Filtros
          </Text>
          
          <CustomBox style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <CustomBox>
              <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                Buscar
              </Text>
              <CustomInput
                value={filters.search}
                onChange={(value) => handleFilterChange('search', value)}
                placeholder="Nombre, documento, ruta, localidad..."
              />
            </CustomBox>

            <CustomBox>
              <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                Estado
              </Text>
              <CustomSelect
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
                options={STATUS_OPTIONS}
                placeholder="Seleccionar estado"
              />
            </CustomBox>

            <CustomBox>
              <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                Tipo de Problema
              </Text>
              <CustomSelect
                value={filters.issueType}
                onChange={(value) => handleFilterChange('issueType', value)}
                options={ISSUE_TYPE_OPTIONS}
                placeholder="Seleccionar tipo"
              />
            </CustomBox>

            <CustomBox>
              <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                Tipo de Log
              </Text>
              <CustomSelect
                value={filters.logType}
                onChange={(value) => handleFilterChange('logType', value)}
                options={[
                  { value: '', label: 'Todos los tipos' },
                  { value: 'ERROR', label: 'Notificaciones de Documentos' },
                  { value: 'MISSING', label: 'Documentos Faltantes' },
                  { value: 'REPORT', label: 'Reportes Automáticos' }
                ]}
                placeholder="Seleccionar tipo de log"
              />
            </CustomBox>

            <CustomBox>
              <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                Desde
              </Text>
              <CustomInput
                type="datetime-local"
                value={filters.dateFrom}
                onChange={(value) => handleFilterChange('dateFrom', value)}
                placeholder="Fecha desde"
              />
            </CustomBox>

            <CustomBox>
              <Text weight="medium" size="small" color="black" style={{ marginBottom: '8px' }}>
                Hasta
              </Text>
              <CustomInput
                type="datetime-local"
                value={filters.dateTo}
                onChange={(value) => handleFilterChange('dateTo', value)}
                placeholder="Fecha hasta"
              />
            </CustomBox>
          </CustomBox>

          <CustomBox style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <CustomButton
              onClick={clearFilters}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                color: '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Limpiar Filtros
            </CustomButton>
          </CustomBox>
        </CustomBox>

        {/* Lista de logs */}
        <CustomBox style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          {logsLoading ? (
            <CustomBox style={{
              padding: '48px',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'inline-block',
                width: '20px',
                height: '20px',
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <Text style={{ marginTop: '16px' }}>Cargando logs...</Text>
            </CustomBox>
          ) : logs.length === 0 ? (
            <CustomBox style={{
              padding: '48px',
              textAlign: 'center'
            }}>
              <Text size="large" color="neutral600">
                No se encontraron logs de notificaciones
              </Text>
              <Text size="small" color="neutral500" style={{ marginTop: '8px' }}>
                Ajusta los filtros para ver más resultados
              </Text>
            </CustomBox>
          ) : (
            <CustomBox>
              {/* Header de la tabla */}
              <CustomBox style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr',
                gap: '16px',
                padding: '16px 24px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: '600',
                fontSize: '14px',
                color: '#374151'
              }}>
                <Text>Documento</Text>
                <Text>Persona</Text>
                <Text>Ruta</Text>
                <Text>Estado</Text>
                <Text>Telegram</Text>
                <Text>Fecha</Text>
              </CustomBox>

              {/* Filas de logs */}
              {logs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </CustomBox>
          )}
        </CustomBox>

        {/* Paginación */}
        {logs.length > 0 && (
          <CustomBox style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            padding: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginTop: '16px'
          }}>
            <CustomButton
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                color: currentPage === 1 ? '#9ca3af' : '#374151',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Anterior
            </CustomButton>

            <Text size="small" color="neutral600">
              Página {currentPage}
            </Text>

            <CustomButton
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={logs.length < itemsPerPage}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: logs.length < itemsPerPage ? '#f3f4f6' : 'white',
                color: logs.length < itemsPerPage ? '#9ca3af' : '#374151',
                cursor: logs.length < itemsPerPage ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Siguiente
            </CustomButton>
          </CustomBox>
        )}
      </CustomBox>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </PageContainer>
  );
}
