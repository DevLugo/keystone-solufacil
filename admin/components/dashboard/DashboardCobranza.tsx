// admin/components/dashboard/DashboardCobranza.tsx

import React, { useState, useEffect } from 'react';
import { useQuery, gql } from '@apollo/client';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  DollarSign,
  MapPin,
  Calendar,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  Target,
  Clock,
  Zap
} from 'lucide-react';

// GraphQL Queries
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;

const GET_DASHBOARD_DATA = gql`
  query GetDashboardData($routeId: ID!) {
    loans(
      where: {
        lead: { routes: { id: { equals: $routeId } } }
        finishedDate: null
        excludedByCleanup: null
      }
    ) {
      id
      requestedAmount
      signDate
      status
      pendingAmountStored
      totalPaid
      expectedWeeklyPayment
      borrower {
        personalData {
          fullName
          clientCode
          addresses {
            location {
              id
              name
            }
          }
        }
      }
      payments(orderBy: { receivedAt: desc }, take: 10) {
        id
        amount
        receivedAt
      }
      loantype {
        name
        weekDuration
        rate
      }
    }
  }
`;

// Estilos del tema
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
    paddingBottom: '80px',
    position: 'relative' as const
  },
  header: {
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 40,
    borderBottom: '2px solid #e2e8f0'
  },
  headerContent: {
    padding: '16px'
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1a202c',
    margin: 0
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    marginTop: '4px'
  },
  controlsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  routeSelector: {
    position: 'relative' as const
  },
  routeButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    color: 'white',
    padding: '10px 16px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
  },
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    marginTop: '4px',
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    border: '1px solid #e2e8f0',
    maxHeight: '240px',
    overflowY: 'auto' as const,
    zIndex: 50
  },
  dropdownItem: {
    width: '100%',
    textAlign: 'left' as const,
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#4a5568',
    transition: 'background-color 0.2s ease'
  },
  dropdownItemActive: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    fontWeight: '600'
  },
  periodSelector: {
    width: '100%',
    backgroundColor: '#f7fafc',
    color: '#2d3748',
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e0',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  content: {
    padding: '16px'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '16px'
  },
  kpiCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
    padding: '16px',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    cursor: 'pointer'
  },
  kpiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  kpiBadge: {
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '12px',
    fontWeight: '600'
  },
  kpiLabel: {
    fontSize: '12px',
    color: '#718096',
    marginBottom: '4px'
  },
  kpiValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1a202c',
    marginTop: '4px'
  },
  kpiSubvalue: {
    fontSize: '12px',
    color: '#a0aec0',
    marginTop: '4px'
  },
  indicatorGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
    marginBottom: '16px'
  },
  indicatorCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)',
    padding: '12px',
    borderLeft: '4px solid'
  },
  alertBox: {
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    borderLeft: '4px solid',
    display: 'flex',
    alignItems: 'flex-start'
  },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
    padding: '16px',
    marginBottom: '16px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1a202c'
  },
  localityCard: {
    borderRadius: '8px',
    padding: '12px',
    border: '2px solid',
    marginBottom: '12px',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px'
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.5s ease'
  },
  criticalClient: {
    backgroundColor: '#fff5f5',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #feb2b2',
    marginBottom: '8px'
  },
  trendCard: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
    borderRadius: '12px',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
    padding: '16px',
    color: 'white',
    marginBottom: '16px'
  },
  footer: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTop: '1px solid #e2e8f0',
    padding: '12px 16px',
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)'
  },
  footerGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px'
  },
  footerButton: {
    padding: '10px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
    color: 'white'
  },
  loadingContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px'
  },
  loadingCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    padding: '32px',
    textAlign: 'center' as const
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #2563eb',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 1s linear infinite'
  }
};

// Componente principal
export default function DashboardCobranza() {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('week');
  const [showRouteDropdown, setShowRouteDropdown] = useState<boolean>(false);

  // Calcular fechas
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    switch(dateRange) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      default:
        start.setDate(end.getDate() - 7);
    }
    
    return { start, end };
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Query para rutas
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery(GET_ROUTES);

  // Query para datos del dashboard - con manejo de errores
  const { 
    data: dashboardData, 
    loading: dashboardLoading, 
    error: dashboardError 
  } = useQuery(GET_DASHBOARD_DATA, {
    variables: { 
      routeId: selectedRoute
    },
    skip: !selectedRoute,
    fetchPolicy: 'cache-first',
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: false
  });

  // Establecer ruta por defecto - solo cuando se cargan las rutas
  useEffect(() => {
    if (routesData?.routes?.length > 0 && !selectedRoute) {
      setSelectedRoute(routesData.routes[0].id);
    }
  }, [routesData]);

  // Log de errores para debugging
  useEffect(() => {
    if (dashboardError) {
      console.error('Error cargando dashboard:', dashboardError);
    }
    if (routesError) {
      console.error('Error cargando rutas:', routesError);
    }
  }, [dashboardError, routesError]);

  // Procesar métricas con filtrado por fecha del lado del cliente
  const processMetrics = () => {
    if (!dashboardData?.loans) return null;

    const loans = dashboardData.loans;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

    // Filtrar préstamos según el rango de fecha seleccionado
    const filteredLoans = loans.filter(loan => {
      const signDate = new Date(loan.signDate);
      return signDate >= startDate && signDate <= endDate;
    });

    const totalLoans = filteredLoans.length;
    const activeLoans = filteredLoans.filter(l => l.status === 'ACTIVE' || !l.status).length;
    
    const overdueLoans = filteredLoans.filter(loan => {
      const lastPayment = loan.payments?.[0];
      if (!lastPayment) {
        return new Date(loan.signDate) < twoWeeksAgo;
      }
      return new Date(lastPayment.receivedAt) < twoWeeksAgo;
    });

    const criticalClients = filteredLoans.filter(loan => {
      const lastPayment = loan.payments?.[0];
      if (!lastPayment) {
        return new Date(loan.signDate) < threeWeeksAgo;
      }
      return new Date(lastPayment.receivedAt) < threeWeeksAgo;
    });

    const weeklyPayments = filteredLoans.flatMap(loan => 
      loan.payments?.filter(p => new Date(p.receivedAt) >= oneWeekAgo) || []
    );
    
    const weeklyCollection = weeklyPayments.reduce((sum, p) => 
      sum + parseFloat(p.amount || '0'), 0
    );

    const expectedWeeklyTotal = filteredLoans.reduce((sum, loan) => 
      sum + parseFloat(loan.expectedWeeklyPayment || '0'), 0
    );

    const collectionRate = expectedWeeklyTotal > 0 
      ? (weeklyCollection / expectedWeeklyTotal) * 100 
      : 0;

    const localityMetrics = {};
    filteredLoans.forEach(loan => {
      const locality = loan.borrower?.personalData?.addresses?.[0]?.location;
      if (locality) {
        if (!localityMetrics[locality.id]) {
          localityMetrics[locality.id] = {
            name: locality.name,
            totalLoans: 0,
            overdueLoans: 0,
            collection: 0,
            expected: 0,
            criticalClients: 0
          };
        }
        
        localityMetrics[locality.id].totalLoans++;
        
        const lastPayment = loan.payments?.[0];
        const isOverdue = !lastPayment || 
          new Date(lastPayment.receivedAt) < twoWeeksAgo;
        
        if (isOverdue) {
          localityMetrics[locality.id].overdueLoans++;
        }
        
        const isCritical = !lastPayment || 
          new Date(lastPayment.receivedAt) < threeWeeksAgo;
        
        if (isCritical) {
          localityMetrics[locality.id].criticalClients++;
        }
        
        localityMetrics[locality.id].expected += parseFloat(loan.expectedWeeklyPayment || '0');
        
        const weekPayments = loan.payments?.filter(p => 
          new Date(p.receivedAt) >= oneWeekAgo
        ) || [];
        
        localityMetrics[locality.id].collection += weekPayments.reduce((sum, p) => 
          sum + parseFloat(p.amount || '0'), 0
        );
      }
    });

    return {
      totalLoans,
      activeLoans,
      overdueLoans: overdueLoans.length,
      overdueRate: totalLoans > 0 ? (overdueLoans.length / totalLoans) * 100 : 0,
      criticalClients: criticalClients.length,
      weeklyCollection,
      expectedWeeklyTotal,
      collectionRate,
      weeklyPaymentsCount: weeklyPayments.length,
      localityMetrics: Object.values(localityMetrics),
      criticalClientsList: criticalClients.slice(0, 5).map(loan => ({
        name: loan.borrower?.personalData?.fullName || 'Sin nombre',
        code: loan.borrower?.personalData?.clientCode || 'N/A',
        amount: loan.pendingAmountStored || '0',
        lastPayment: loan.payments?.[0]?.receivedAt,
        locality: loan.borrower?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad'
      }))
    };
  };

  const metrics = processMetrics();

  // Funciones de formato
  const formatCurrency = (amount) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount || 0);
  };

  const formatPercent = (value) => `${(value || 0).toFixed(1)}%`;

  const getStatusColor = (value, type = 'rate') => {
    if (type === 'rate') {
      if (value >= 80) return { backgroundColor: '#d4edda', color: '#155724' };
      if (value >= 60) return { backgroundColor: '#fff3cd', color: '#856404' };
      return { backgroundColor: '#f8d7da', color: '#721c24' };
    }
    if (type === 'overdue') {
      if (value <= 10) return { backgroundColor: '#d4edda', color: '#155724' };
      if (value <= 25) return { backgroundColor: '#fff3cd', color: '#856404' };
      return { backgroundColor: '#f8d7da', color: '#721c24' };
    }
    return { backgroundColor: '#f8f9fa', color: '#495057' };
  };

  // Loading y manejo de errores
  if (routesLoading || (selectedRoute && dashboardLoading)) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner}></div>
          <p style={{ marginTop: '16px', color: '#4a5568' }}>Cargando dashboard...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Manejo de errores
  if (routesError || dashboardError) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingCard}>
          <AlertCircle style={{ width: '48px', height: '48px', color: '#ef4444', margin: '0 auto' }} />
          <p style={{ marginTop: '16px', color: '#ef4444', fontWeight: 'bold' }}>
            Error al cargar el dashboard
          </p>
          <p style={{ marginTop: '8px', color: '#6b7280', fontSize: '14px' }}>
            {routesError?.message || dashboardError?.message || 'Error desconocido'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerTop}>
            <div>
              <h1 style={styles.title}>Dashboard Cobranza</h1>
              <p style={styles.subtitle}>Monitoreo en tiempo real</p>
            </div>
            <Activity style={{ width: '32px', height: '32px', color: '#2563eb' }} />
          </div>

          <div style={styles.controlsGrid}>
            <div style={styles.routeSelector}>
              <button
                style={styles.routeButton}
                onClick={() => setShowRouteDropdown(!showRouteDropdown)}
              >
                <MapPin style={{ width: '16px', height: '16px' }} />
                <span style={{ flex: 1, textAlign: 'center', margin: '0 8px' }}>
                  {routesData?.routes?.find(r => r.id === selectedRoute)?.name || 'Seleccionar'}
                </span>
                <ChevronDown style={{ 
                  width: '16px', 
                  height: '16px',
                  transform: showRouteDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>
              
              {showRouteDropdown && (
                <div style={styles.dropdown}>
                  {routesData?.routes?.map(route => (
                    <button
                      key={route.id}
                      style={{
                        ...styles.dropdownItem,
                        ...(selectedRoute === route.id ? styles.dropdownItemActive : {})
                      }}
                      onClick={() => {
                        setSelectedRoute(route.id);
                        setShowRouteDropdown(false);
                      }}
                    >
                      {route.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={styles.periodSelector}
            >
              <option value="week">Última Semana</option>
              <option value="month">Último Mes</option>
              <option value="quarter">Último Trimestre</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div style={styles.content}>
        {metrics ? (
          <>
            {/* KPIs Principales */}
            <div style={styles.kpiGrid}>
              <div style={styles.kpiCard}>
                <div style={styles.kpiHeader}>
                  <Target style={{ width: '20px', height: '20px', color: '#2563eb' }} />
                  <span style={{
                    ...styles.kpiBadge,
                    ...getStatusColor(metrics.collectionRate)
                  }}>
                    {formatPercent(metrics.collectionRate)}
                  </span>
                </div>
                <p style={styles.kpiLabel}>Tasa Cobranza</p>
                <p style={styles.kpiValue}>{formatCurrency(metrics.weeklyCollection)}</p>
                <p style={styles.kpiSubvalue}>de {formatCurrency(metrics.expectedWeeklyTotal)}</p>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiHeader}>
                  <AlertTriangle style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
                  <span style={{
                    ...styles.kpiBadge,
                    ...getStatusColor(metrics.overdueRate, 'overdue')
                  }}>
                    {formatPercent(metrics.overdueRate)}
                  </span>
                </div>
                <p style={styles.kpiLabel}>Cartera Vencida</p>
                <p style={styles.kpiValue}>{metrics.overdueLoans}</p>
                <p style={styles.kpiSubvalue}>de {metrics.totalLoans} créditos</p>
              </div>
            </div>

            {/* Indicadores Secundarios */}
            <div style={styles.indicatorGrid}>
              <div style={{
                ...styles.indicatorCard,
                borderLeftColor: '#10b981'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <CheckCircle style={{ width: '16px', height: '16px', color: '#10b981' }} />
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2d3748' }}>
                    {metrics.activeLoans}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>Activos</p>
              </div>

              <div style={{
                ...styles.indicatorCard,
                borderLeftColor: '#f59e0b'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Clock style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2d3748' }}>
                    {metrics.weeklyPaymentsCount}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>Cobros/Sem</p>
              </div>

              <div style={{
                ...styles.indicatorCard,
                borderLeftColor: '#ef4444'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <XCircle style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2d3748' }}>
                    {metrics.criticalClients}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>Críticos</p>
              </div>
            </div>

            {/* Resto del contenido... */}
          </>
        ) : (
          <div style={{ ...styles.sectionCard, textAlign: 'center', padding: '32px' }}>
            <AlertCircle style={{ width: '48px', height: '48px', color: '#cbd5e0', margin: '0 auto' }} />
            <p style={{ marginTop: '16px', color: '#718096' }}>
              Selecciona una ruta para ver el dashboard
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerGrid}>
          <button 
            style={{
              ...styles.footerButton,
              backgroundColor: '#2563eb'
            }}
            onClick={() => window.location.href = '/borrowers'}
          >
            <Users style={{ width: '16px', height: '16px', marginRight: '4px' }} />
            Clientes
          </button>
          <button 
            style={{
              ...styles.footerButton,
              backgroundColor: '#10b981'
            }}
            onClick={() => window.location.href = '/loans'}
          >
            <DollarSign style={{ width: '16px', height: '16px', marginRight: '4px' }} />
            Cobrar
          </button>
          <button 
            style={{
              ...styles.footerButton,
              backgroundColor: '#8b5cf6'
            }}
            onClick={() => window.location.href = '/lead-payment-receiveds'}
          >
            <Calendar style={{ width: '16px', height: '16px', marginRight: '4px' }} />
            Agenda
          </button>
        </div>
      </div>
    </div>
  );
}

export { DashboardCobranza };