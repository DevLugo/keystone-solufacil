import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { 
  Select, 
  TextInput 
} from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { LoadingDots } from '@keystone-ui/loading';
import { 
  GraphQLErrorNotice 
} from '@keystone-6/core/admin-ui/components';
import { gql } from '@apollo/client';

// Query para obtener rutas
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;

// Query para obtener la cartera
const GET_CARTERA = gql`
  query GetCartera($routeId: String!, $weeksWithoutPayment: Int!) {
    getCartera(routeId: $routeId, weeksWithoutPayment: $weeksWithoutPayment)
  }
`;

interface CarteraData {
  route: {
    id: string;
    name: string;
  };
  totalLoans: number;
  activeLoans: number;
  overdueLoans: number;
  deadLoans: number;
  loans: Array<{
    id: string;
    amountGived: number;
    loanRate: number;
    signDate: string;
    status: string;
    badDebtDate: string | null;
    borrower: {
      personalData: {
        fullName: string;
      };
    };
    lead: {
      personalData: {
        fullName: string;
      };
    };
    payments: Array<{
      amount: number;
      receivedAt: string;
    }>;
    totalPaid: number;
    totalDebt: number;
    pendingDebt: number;
    lastPaymentDate: string | null;
    weeksWithoutPayment: number;
  }>;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-MX');
};

const styles = {
  container: {
    padding: '32px',
    backgroundColor: '#f7fafc',
    minHeight: '100vh'
  },
  filtersCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    alignItems: 'end'
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    textAlign: 'center' as const
  },
  summaryItem: {
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: '#f8fafc'
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '4px'
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  tableCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '12px'
  },
  th: {
    backgroundColor: '#2b6cb0',
    color: 'white',
    padding: '12px 8px',
    textAlign: 'center' as const,
    fontWeight: '600',
    fontSize: '11px',
    borderRight: '1px solid #1a5490'
  },
  thFirst: {
    backgroundColor: '#2b6cb0',
    color: 'white',
    padding: '12px 16px',
    textAlign: 'left' as const,
    fontWeight: '600',
    fontSize: '11px',
    minWidth: '180px'
  },
  td: {
    padding: '8px',
    textAlign: 'center' as const,
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    fontSize: '11px'
  },
  tdFirst: {
    padding: '12px 16px',
    textAlign: 'left' as const,
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    fontWeight: '500',
    backgroundColor: '#f8fafc'
  },
  statusActive: {
    color: '#38a169',
    fontWeight: '600'
  },
  statusOverdue: {
    color: '#d69e2e',
    fontWeight: '600'
  },
  statusDead: {
    color: '#e53e3e',
    fontWeight: '600'
  },
  statusFinished: {
    color: '#718096',
    fontWeight: '600'
  }
};

export default function CarteraPage() {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [weeksWithoutPayment, setWeeksWithoutPayment] = useState<number>(2);
  
  // Query para rutas
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);
  
  // Query para la cartera
  const { 
    data: carteraData, 
    loading: carteraLoading, 
    error: carteraError,
    refetch: refetchCartera 
  } = useQuery(GET_CARTERA, {
    variables: { routeId: selectedRoute, weeksWithoutPayment },
    skip: !selectedRoute
  });

  const processedData: CarteraData | null = carteraData?.getCartera || null;

  const handleGenerateReport = () => {
    if (selectedRoute) {
      refetchCartera();
    }
  };

  const getStatusColor = (status: string, badDebtDate: string | null, weeksWithoutPayment: number) => {
    if (badDebtDate) return styles.statusDead;
    if (status === 'FINISHED') return styles.statusFinished;
    if (weeksWithoutPayment >= 2) return styles.statusOverdue;
    return styles.statusActive;
  };

  const getStatusText = (status: string, badDebtDate: string | null, weeksWithoutPayment: number) => {
    if (badDebtDate) return 'CARTERA MUERTA';
    if (status === 'FINISHED') return 'FINALIZADO';
    if (weeksWithoutPayment >= 2) return 'VENCIDO';
    return 'ACTIVO';
  };

  const routeOptions = routesData?.routes?.map((route: any) => ({
    label: route.name,
    value: route.id
  })) || [];

  return (
    <PageContainer header="📋 Cartera por Ruta">
      <div style={styles.container}>
        {/* Filtros */}
        <div style={styles.filtersCard}>
          <div style={styles.filtersGrid}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Ruta
              </label>
              <Select
                value={routeOptions.find((opt: any) => opt.value === selectedRoute) || null}
                options={routeOptions}
                onChange={(option: any) => setSelectedRoute(option?.value || '')}
                placeholder="Seleccionar ruta..."
                isLoading={routesLoading}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Semanas sin Pago
              </label>
              <TextInput
                type="number"
                value={weeksWithoutPayment.toString()}
                onChange={(e) => setWeeksWithoutPayment(parseInt(e.target.value) || 2)}
                min="1"
                max="52"
              />
            </div>

            <Button
              size="small"
              tone="active"
              onClick={handleGenerateReport}
              isDisabled={!selectedRoute || carteraLoading}
            >
              {carteraLoading ? 'Cargando...' : 'Generar Reporte'}
            </Button>
          </div>
        </div>

        {/* Errores */}
        {carteraError && (
          <GraphQLErrorNotice errors={[carteraError]} networkError={undefined} />
        )}

        {/* Resumen */}
        {processedData && (
          <div style={styles.summaryCard}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
              Resumen de Cartera - {processedData.route.name}
            </h3>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}>
                <div style={{ ...styles.summaryValue, color: '#2b6cb0' }}>
                  {processedData.totalLoans}
                </div>
                <div style={styles.summaryLabel}>Total Préstamos</div>
              </div>
              <div style={styles.summaryItem}>
                <div style={{ ...styles.summaryValue, color: '#38a169' }}>
                  {processedData.activeLoans}
                </div>
                <div style={styles.summaryLabel}>Activos</div>
              </div>
              <div style={styles.summaryItem}>
                <div style={{ ...styles.summaryValue, color: '#d69e2e' }}>
                  {processedData.overdueLoans}
                </div>
                <div style={styles.summaryLabel}>Vencidos</div>
              </div>
              <div style={styles.summaryItem}>
                <div style={{ ...styles.summaryValue, color: '#e53e3e' }}>
                  {processedData.deadLoans}
                </div>
                <div style={styles.summaryLabel}>Cartera Muerta</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de Préstamos */}
        {processedData && (
          <div style={styles.tableCard}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                Detalle de Préstamos ({processedData.loans.length} registros)
              </h2>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thFirst}>CLIENTE</th>
                    <th style={styles.th}>LÍDER</th>
                    <th style={styles.th}>MONTO PRESTADO</th>
                    <th style={styles.th}>TASA</th>
                    <th style={styles.th}>DEUDA TOTAL</th>
                    <th style={styles.th}>PAGADO</th>
                    <th style={styles.th}>PENDIENTE</th>
                    <th style={styles.th}>ÚLTIMO PAGO</th>
                    <th style={styles.th}>SEMANAS SIN PAGAR</th>
                    <th style={styles.th}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {processedData.loans.map((loan) => (
                    <tr key={loan.id}>
                      <td style={styles.tdFirst}>
                        {loan.borrower?.personalData?.fullName || 'N/A'}
                      </td>
                      <td style={styles.td}>
                        {loan.lead?.personalData?.fullName || 'N/A'}
                      </td>
                      <td style={styles.td}>
                        {formatCurrency(loan.amountGived)}
                      </td>
                      <td style={styles.td}>
                        {(loan.loanRate * 100).toFixed(0)}%
                      </td>
                      <td style={styles.td}>
                        {formatCurrency(loan.totalDebt)}
                      </td>
                      <td style={styles.td}>
                        {formatCurrency(loan.totalPaid)}
                      </td>
                      <td style={styles.td}>
                        {formatCurrency(loan.pendingDebt)}
                      </td>
                      <td style={styles.td}>
                        {loan.lastPaymentDate ? formatDate(loan.lastPaymentDate) : 'Sin pagos'}
                      </td>
                      <td style={styles.td}>
                        {loan.weeksWithoutPayment}
                      </td>
                      <td style={styles.td}>
                        <span style={getStatusColor(loan.status, loan.badDebtDate, loan.weeksWithoutPayment)}>
                          {getStatusText(loan.status, loan.badDebtDate, loan.weeksWithoutPayment)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Estado de carga */}
        {carteraLoading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <LoadingDots label="Cargando cartera..." />
          </div>
        )}

        {/* Estado sin datos */}
        {!carteraLoading && !processedData && selectedRoute && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '12px',
            color: '#718096'
          }}>
            No hay datos disponibles para la ruta seleccionada
          </div>
        )}
      </div>
    </PageContainer>
  );
} 