/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { jsx, Box } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { LoadingDots } from '@keystone-ui/loading';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { 
  FaChartLine, 
  FaUsers, 
  FaExclamationTriangle, 
  FaTrendingUp, 
  FaTrendingDown,
  FaCalendarWeek,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaClock,
  FaDollarSign,
  FaPercentage
} from 'react-icons/fa';
import { GET_DASHBOARD_KPIS } from '../../graphql/queries/dashboard';
import { formatCurrency } from '../../utils/formatters';
import { useUserRoutes } from '../../hooks/useUserRoutes';
import { KPICard } from './KPICard';
import { LocalityCard } from './LocalityCard';
import { ClientStreakCard } from './ClientStreakCard';
import { MiniChart } from './MiniChart';
import { TrendChart } from './TrendChart';
import { RouteSelector } from './RouteSelector';
import { DashboardHeader } from './DashboardHeader';
import { SummaryStats } from './SummaryStats';
import { AlertsPanel } from './AlertsPanel';
import { LoadingDashboard, LoadingKPIs } from './LoadingDashboard';
import { UserAccessInfo } from './UserAccessInfo';
import { QuickActions } from './QuickActions';
import { DebugPanel } from './DebugPanel';

interface DashboardData {
  routeId: string;
  timeframe: string;
  period: {
    start: string;
    end: string;
    label: string;
  };
  kpis: {
    cvIncrement: {
      current: number;
      previous: number;
      delta: number;
      percentage: number;
    };
    clientIncrement: {
      current: number;
      previous: number;
      delta: number;
      percentage: number;
    };
    activeClients: {
      current: number;
      previous: number;
      delta: number;
      percentage: number;
    };
    payingPercentage: {
      current: number;
      previous: number;
    };
  };
  localityAnalysis: {
    declining: Array<{
      name: string;
      recentGrowth: number;
      activeLoans: number;
      cvLoans: number;
    }>;
    dangerousGrowth: Array<{
      name: string;
      recentGrowth: number;
      activeLoans: number;
      cvLoans: number;
    }>;
    total: number;
  };
  clientsWithLongStreaks: Array<{
    clientName: string;
    clientCode: string;
    weeksWithoutPayment: number;
    locality: string;
    loanAmount: number;
    loanId: string;
  }>;
  summary: {
    totalActiveLoans: number;
    totalCVLoans: number;
    cvPercentage: number;
    averageWeeksWithoutPayment: number;
  };
}

interface Route {
  id: string;
  name: string;
}

const styles = {
  container: {
    padding: '16px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    '@media (min-width: 768px)': {
      padding: '24px',
    },
  },
  header: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    '@media (min-width: 768px)': {
      padding: '32px',
      marginBottom: '32px',
    },
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '8px',
    '@media (min-width: 768px)': {
      fontSize: '28px',
    },
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '20px',
    '@media (min-width: 768px)': {
      fontSize: '16px',
      marginBottom: '24px',
    },
  },
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  },
  toggleButton: (isActive: boolean) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: isActive ? '#4f46e5' : 'white',
    color: isActive ? 'white' : '#374151',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    '@media (min-width: 768px)': {
      padding: '10px 20px',
      fontSize: '16px',
    },
  }),
  routeSelector: {
    marginLeft: 'auto',
    minWidth: '200px',
    '@media (max-width: 767px)': {
      marginLeft: '0',
      width: '100%',
    },
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
    marginBottom: '24px',
    '@media (min-width: 640px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (min-width: 1024px)': {
      gridTemplateColumns: 'repeat(4, 1fr)',
    },
  },
  sectionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '24px',
    '@media (min-width: 1024px)': {
      gridTemplateColumns: '1fr 1fr',
    },
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    '@media (min-width: 768px)': {
      padding: '24px',
    },
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    '@media (min-width: 768px)': {
      fontSize: '18px',
      marginBottom: '20px',
    },
  },
  localityGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
    '@media (min-width: 640px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  clientStreakGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '8px',
  },
  noDataMessage: {
    textAlign: 'center' as const,
    color: '#6b7280',
    fontSize: '14px',
    padding: '20px',
    fontStyle: 'italic',
  },
};

export default function CollectorDashboard() {
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');

  // Get user routes and access information
  const { 
    data: userRoutesData, 
    routes, 
    isAdmin, 
    hasEmployee,
    accessType,
    hasMultipleRoutes,
    message: routeMessage,
    method,
    warning,
    loading: routesLoading 
  } = useUserRoutes();

  // Get dashboard KPIs
  const { data: dashboardData, loading: dashboardLoading, refetch } = useQuery(GET_DASHBOARD_KPIS, {
    variables: {
      routeId: selectedRouteId,
      timeframe,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    },
    skip: !selectedRouteId,
    pollInterval: 60000, // Refresh every minute
  });

  // Set default route when routes are loaded
  useEffect(() => {
    if (routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].id);
    }
  }, [routes, selectedRouteId]);

  // Refresh data when timeframe changes
  useEffect(() => {
    if (selectedRouteId) {
      refetch();
    }
  }, [timeframe, selectedRouteId, refetch]);

  if (routesLoading) {
    return (
      <PageContainer header="Dashboard del Cobrador">
        <LoadingDashboard />
      </PageContainer>
    );
  }

  const dashboardKPIs: DashboardData = dashboardData?.getDashboardKPIs;

  // Handle different access scenarios
  if (routes.length === 0) {
    const getMessageForNoRoutes = () => {
      if (!hasEmployee) {
        return {
          title: 'Usuario Sin Empleado Asociado',
          subtitle: 'Tu cuenta de usuario no está vinculada a un empleado. Contacta al administrador para vincular tu cuenta.',
          type: 'warning'
        };
      }
      return {
        title: 'Sin Rutas Asignadas',
        subtitle: routeMessage || 'No tienes rutas asignadas. Contacta al administrador para asignar rutas a tu cuenta.',
        type: 'info'
      };
    };

    const messageInfo = getMessageForNoRoutes();
    
    return (
      <PageContainer header="Dashboard del Cobrador">
        <Box css={styles.container}>
          <div css={{
            ...styles.header,
            backgroundColor: messageInfo.type === 'warning' ? '#fffbeb' : '#f0f9ff',
            borderColor: messageInfo.type === 'warning' ? '#fed7aa' : '#bae6fd',
          }}>
            <h1 css={styles.title}>{messageInfo.title}</h1>
            <p css={styles.subtitle}>
              {messageInfo.subtitle}
            </p>
            {userRoutesData?.employeeInfo && (
              <div css={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#6b7280',
              }}>
                <strong>Empleado:</strong> {userRoutesData.employeeInfo.personalData?.fullName || 'Sin nombre'} 
                {userRoutesData.employeeInfo.type && (
                  <span> ({userRoutesData.employeeInfo.type})</span>
                )}
              </div>
            )}
          </div>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer header="Dashboard del Cobrador">
      <div css={styles.container}>
        {/* Header with controls */}
        <DashboardHeader
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          routes={routes}
          selectedRouteId={selectedRouteId}
          onRouteChange={setSelectedRouteId}
          isAdmin={isAdmin}
          hasMultipleRoutes={hasMultipleRoutes}
          accessType={accessType}
          periodLabel={dashboardKPIs?.period?.label}
          onRefresh={() => refetch()}
          isLoading={dashboardLoading}
          userInfo={userRoutesData?.userInfo}
          employeeInfo={userRoutesData?.employeeInfo}
        />

        {/* Warning banner for fallback method */}
        {warning && (
          <div css={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fed7aa',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <FaExclamationTriangle style={{ color: '#d97706' }} />
            <div>
              <div css={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>
                Vinculación Temporal por Nombre
              </div>
              <div css={{ fontSize: '13px', color: '#78350f' }}>
                {warning}
              </div>
            </div>
          </div>
        )}

        {/* Debug info */}
        {method && (
          <div css={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#6b7280',
            fontFamily: 'monospace',
          }}>
            Método de acceso: {method}
          </div>
        )}

        {/* User Access Information */}
        {userRoutesData && (
          <UserAccessInfo
            userInfo={userRoutesData.userInfo}
            employeeInfo={userRoutesData.employeeInfo}
            routes={routes}
            accessType={accessType}
            hasEmployee={hasEmployee}
            isAdmin={isAdmin}
          />
        )}

        {dashboardLoading ? (
          <LoadingKPIs />
        ) : dashboardKPIs ? (
          <>
            {/* Main KPIs Grid */}
            <div css={styles.kpiGrid}>
              <KPICard
                title="Cartera Vencida"
                icon={<FaExclamationTriangle />}
                current={dashboardKPIs.kpis.cvIncrement.current}
                previous={dashboardKPIs.kpis.cvIncrement.previous}
                delta={dashboardKPIs.kpis.cvIncrement.delta}
                percentage={dashboardKPIs.kpis.cvIncrement.percentage}
                color="#ef4444"
                format="number"
                suffix=" préstamos"
              />
              
              <KPICard
                title="Nuevos Clientes"
                icon={<FaUsers />}
                current={dashboardKPIs.kpis.clientIncrement.current}
                previous={dashboardKPIs.kpis.clientIncrement.previous}
                delta={dashboardKPIs.kpis.clientIncrement.delta}
                percentage={dashboardKPIs.kpis.clientIncrement.percentage}
                color="#10b981"
                format="number"
                suffix=" clientes"
              />
              
              <KPICard
                title="Clientes Activos"
                icon={<FaChartLine />}
                current={dashboardKPIs.kpis.activeClients.current}
                previous={dashboardKPIs.kpis.activeClients.previous}
                delta={dashboardKPIs.kpis.activeClients.delta}
                percentage={dashboardKPIs.kpis.activeClients.percentage}
                color="#3b82f6"
                format="number"
                suffix=" clientes"
              />
              
              <KPICard
                title="% Pagando"
                icon={<FaPercentage />}
                current={dashboardKPIs.kpis.payingPercentage.current}
                previous={dashboardKPIs.kpis.payingPercentage.previous}
                delta={dashboardKPIs.kpis.payingPercentage.current - dashboardKPIs.kpis.payingPercentage.previous}
                percentage={dashboardKPIs.kpis.payingPercentage.previous > 0 ? 
                  ((dashboardKPIs.kpis.payingPercentage.current - dashboardKPIs.kpis.payingPercentage.previous) / dashboardKPIs.kpis.payingPercentage.previous) * 100 : 0}
                color="#8b5cf6"
                format="percentage"
                suffix="%"
              />
            </div>

            {/* Sections Grid */}
            <div css={styles.sectionsGrid}>
              {/* Declining Localities */}
              <div css={styles.section}>
                <h2 css={styles.sectionTitle}>
                  <FaTrendingDown style={{ color: '#ef4444' }} />
                  Localidades en Declive
                </h2>
                {dashboardKPIs.localityAnalysis.declining.length > 0 ? (
                  <div css={styles.localityGrid}>
                    {dashboardKPIs.localityAnalysis.declining.map((locality, index) => (
                      <LocalityCard
                        key={index}
                        name={locality.name}
                        growth={locality.recentGrowth}
                        activeLoans={locality.activeLoans}
                        cvLoans={locality.cvLoans}
                        type="declining"
                      />
                    ))}
                  </div>
                ) : (
                  <div css={styles.noDataMessage}>
                    No hay localidades en declive significativo
                  </div>
                )}
              </div>

              {/* Fast Growing (Dangerous) Localities */}
              <div css={styles.section}>
                <h2 css={styles.sectionTitle}>
                  <FaTrendingUp style={{ color: '#f59e0b' }} />
                  Localidades de Crecimiento Peligroso
                </h2>
                {dashboardKPIs.localityAnalysis.dangerousGrowth.length > 0 ? (
                  <div css={styles.localityGrid}>
                    {dashboardKPIs.localityAnalysis.dangerousGrowth.map((locality, index) => (
                      <LocalityCard
                        key={index}
                        name={locality.name}
                        growth={locality.recentGrowth}
                        activeLoans={locality.activeLoans}
                        cvLoans={locality.cvLoans}
                        type="dangerous"
                      />
                    ))}
                  </div>
                ) : (
                  <div css={styles.noDataMessage}>
                    No hay localidades con crecimiento peligroso
                  </div>
                )}
              </div>
            </div>

            {/* Clients with Long Payment Streaks */}
            <div css={styles.section}>
              <h2 css={styles.sectionTitle}>
                <FaClock style={{ color: '#ef4444' }} />
                Clientes con Racha Sin Pago
              </h2>
              {dashboardKPIs.clientsWithLongStreaks.length > 0 ? (
                <div css={styles.clientStreakGrid}>
                  {dashboardKPIs.clientsWithLongStreaks.map((client, index) => (
                    <ClientStreakCard
                      key={index}
                      clientName={client.clientName}
                      clientCode={client.clientCode}
                      weeksWithoutPayment={client.weeksWithoutPayment}
                      locality={client.locality}
                      loanAmount={client.loanAmount}
                      loanId={client.loanId}
                    />
                  ))}
                </div>
              ) : (
                <div css={styles.noDataMessage}>
                  No hay clientes con rachas largas sin pago
                </div>
              )}
            </div>

            {/* Summary Stats */}
            <SummaryStats
              totalActiveLoans={dashboardKPIs.summary.totalActiveLoans}
              totalCVLoans={dashboardKPIs.summary.totalCVLoans}
              cvPercentage={dashboardKPIs.summary.cvPercentage}
              averageWeeksWithoutPayment={dashboardKPIs.summary.averageWeeksWithoutPayment}
              totalLocalities={dashboardKPIs.localityAnalysis.total}
            />

            {/* Alerts Panel */}
            <AlertsPanel
              cvPercentage={dashboardKPIs.summary.cvPercentage}
              averageWeeksWithoutPayment={dashboardKPIs.summary.averageWeeksWithoutPayment}
              dangerousLocalitiesCount={dashboardKPIs.localityAnalysis.dangerousGrowth.length}
              decliningLocalitiesCount={dashboardKPIs.localityAnalysis.declining.length}
              criticalClientsCount={dashboardKPIs.clientsWithLongStreaks.filter(c => c.weeksWithoutPayment >= 5).length}
            />

            {/* Quick Actions */}
            <QuickActions
              routeId={selectedRouteId}
              routeName={routes.find(r => r.id === selectedRouteId)?.name || 'Ruta'}
            />
          </>
        ) : (
          <div css={styles.section}>
            <div css={styles.noDataMessage}>
              Selecciona una ruta para ver los datos del dashboard
            </div>
          </div>
        )}

        {/* Debug Panel - Temporary for debugging */}
        <DebugPanel show={false} />
      </div>
    </PageContainer>
  );
}