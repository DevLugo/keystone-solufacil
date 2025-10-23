import React, { useState, useEffect } from 'react';
import { Stack, Text } from '@keystone-ui/core';
import { gql, useQuery } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
// Importaciones de iconos - usando iconos simples para evitar problemas de dependencias
const FaSearch = () => <span>🔍</span>;
const FaFilter = () => <span>🔽</span>;
const FaDownload = () => <span>📥</span>;
const FaRefresh = () => <span>🔄</span>;
const FaExclamationTriangle = () => <span>⚠️</span>;
const FaCheckCircle = () => <span>✅</span>;
const FaTimesCircle = () => <span>❌</span>;
const FaClock = () => <span>🕐</span>;
const FaUser = () => <span>👤</span>;
const FaRoute = () => <span>🛣️</span>;
const FaTelegram = () => <span>📱</span>;

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

// Query para obtener logs de notificaciones
const GET_NOTIFICATION_LOGS = gql`
  query GetNotificationLogs($where: DocumentNotificationLogWhereInput, $orderBy: [DocumentNotificationLogOrderByInput!], $take: Int, $skip: Int) {
    documentNotificationLogs(where: $where, orderBy: $orderBy, take: $take, skip: $skip) {
      id
      documentId
      documentType
      personName
      loanId
      routeId
      routeName
      localityName
      routeLeadName
      telegramChatId
      telegramUsername
      issueType
      description
      messageContent
      status
      telegramResponse
      telegramErrorCode
      telegramErrorMessage
      sentAt
      responseTimeMs
      retryCount
      notes
      createdAt
      updatedAt
    }
  }
`;

// Query para obtener estadísticas
const GET_NOTIFICATION_STATS = gql`
  query GetNotificationStats {
    documentNotificationLogs(where: { createdAt: { gte: "2024-01-01T00:00:00.000Z" } }) {
      id
      status
      createdAt
    }
  }
`;

// Estados de notificación
const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'SENT', label: 'Enviado' },
  { value: 'ERROR', label: 'Error' },
  { value: 'FAILED', label: 'Falló' },
  { value: 'NO_TELEGRAM', label: 'Sin Telegram' },
  { value: 'NO_LEADER', label: 'Sin Líder' },
  { value: 'NO_ROUTE', label: 'Sin Ruta' }
];

// Tipos de problema
const ISSUE_TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'ERROR', label: 'Error' },
  { value: 'MISSING', label: 'Faltante' }
];

// Función para obtener el icono del estado
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'SENT':
      return <FaCheckCircle style={{ color: '#10b981' }} />;
    case 'ERROR':
    case 'FAILED':
      return <FaTimesCircle style={{ color: '#dc2626' }} />;
    case 'NO_TELEGRAM':
    case 'NO_LEADER':
    case 'NO_ROUTE':
      return <FaExclamationTriangle style={{ color: '#f59e0b' }} />;
    default:
      return <FaClock style={{ color: '#6b7280' }} />;
  }
};

// Función para obtener el color del estado
const getStatusColor = (status: string) => {
  switch (status) {
    case 'SENT':
      return '#10b981';
    case 'ERROR':
    case 'FAILED':
      return '#dc2626';
    case 'NO_TELEGRAM':
    case 'NO_LEADER':
    case 'NO_ROUTE':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
};

// Función para formatear fecha
const formatDate = (date: string) => {
  return new Date(date).toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Función para formatear tiempo de respuesta
const formatResponseTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export default function LogsNotificacionesPage() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    issueType: '',
    dateFrom: '',
    dateTo: '',
    logType: '' // Nuevo filtro para tipo de log
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
      dateTo: ''
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
      <CustomBox css={{ padding: '32px' }}>
        {/* Header con estadísticas */}
        <CustomBox css={{
          padding: '24px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '24px'
        }}>
          <CustomBox css={{
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
              css={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                color: '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                '&:hover': { backgroundColor: '#f3f4f6' }
              }}
            >
              <FaRefresh />
              Actualizar
            </CustomButton>
          </CustomBox>

          {/* Estadísticas */}
          {stats && (
            <CustomBox css={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <CustomBox css={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <Text weight="medium" size="small" color="neutral600" css={{ marginBottom: '8px' }}>
                  Total de Notificaciones
                </Text>
                <Text size="large" weight="bold" color="black">
                  {stats.total}
                </Text>
              </CustomBox>

              <CustomBox css={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <Text weight="medium" size="small" color="neutral600" css={{ marginBottom: '8px' }}>
                  Enviadas Exitosamente
                </Text>
                <Text size="large" weight="bold" color="green600">
                  {stats.byStatus.SENT || 0}
                </Text>
              </CustomBox>

              <CustomBox css={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <Text weight="medium" size="small" color="neutral600" css={{ marginBottom: '8px' }}>
                  Con Errores
                </Text>
                <Text size="large" weight="bold" color="red600">
                  {(stats.byStatus.ERROR || 0) + (stats.byStatus.FAILED || 0)}
                </Text>
              </CustomBox>

              <CustomBox css={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <Text weight="medium" size="small" color="neutral600" css={{ marginBottom: '8px' }}>
                  Sin Telegram
                </Text>
                <Text size="large" weight="bold" color="yellow600">
                  {stats.byStatus.NO_TELEGRAM || 0}
                </Text>
              </CustomBox>
            </CustomBox>
          )}
        </CustomBox>

        {/* Filtros */}
        <CustomBox css={{
          padding: '24px',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '24px'
        }}>
          <Text weight="bold" size="medium" color="black" css={{ marginBottom: '16px' }}>
            🔍 Filtros de Búsqueda
          </Text>

          <CustomBox css={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <CustomBox>
              <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
                Buscar
              </Text>
              <CustomInput
                value={filters.search}
                onChange={(value) => handleFilterChange('search', value)}
                placeholder="Nombre, documento, ruta, localidad..."
              />
            </CustomBox>

            <CustomBox>
              <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
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
              <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
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
              <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
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
              <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
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
              <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
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

          <CustomBox css={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <CustomButton
              onClick={clearFilters}
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
              Limpiar Filtros
            </CustomButton>
          </CustomBox>
        </CustomBox>

        {/* Lista de logs */}
        <CustomBox css={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          {logsLoading ? (
            <CustomBox css={{
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
              <Text css={{ marginTop: '16px' }}>Cargando logs...</Text>
            </CustomBox>
          ) : logs.length === 0 ? (
            <CustomBox css={{
              padding: '48px',
              textAlign: 'center'
            }}>
              <Text size="large" color="neutral600">
                No se encontraron logs de notificaciones
              </Text>
              <Text size="small" color="neutral500" css={{ marginTop: '8px' }}>
                Ajusta los filtros para ver más resultados
              </Text>
            </CustomBox>
          ) : (
            <CustomBox>
              {/* Header de la tabla */}
              <CustomBox css={{
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
          <CustomBox css={{
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
              css={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                color: currentPage === 1 ? '#9ca3af' : '#374151',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                '&:hover': { 
                  backgroundColor: currentPage === 1 ? '#f3f4f6' : '#f9fafb' 
                }
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
              css={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: logs.length < itemsPerPage ? '#f3f4f6' : 'white',
                color: logs.length < itemsPerPage ? '#9ca3af' : '#374151',
                cursor: logs.length < itemsPerPage ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                '&:hover': { 
                  backgroundColor: logs.length < itemsPerPage ? '#f3f4f6' : '#f9fafb' 
                }
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
