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
  query GetCartera($routeId: String!, $weeksWithoutPayment: Int!, $includeBadDebt: Boolean!, $analysisMonth: String, $analysisYear: Int, $includeOverdue: Boolean!, $includeOverdrawn: Boolean!) {
    getCartera(routeId: $routeId, weeksWithoutPayment: $weeksWithoutPayment, includeBadDebt: $includeBadDebt, analysisMonth: $analysisMonth, analysisYear: $analysisYear, includeOverdue: $includeOverdue, includeOverdrawn: $includeOverdrawn)
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
  totalPendingDebt: number;
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
        addresses: Array<{
          location: {
            name: string;
          };
        }>;
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
    originalWeeksDuration: number;
    isOverdue: boolean;
    isOverdrawn: boolean;
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

// Función para obtener el último día laboral del mes
const getLastWorkingDayOfMonth = (year: number, month: number): Date => {
  const lastDay = new Date(year, month + 1, 0); // Último día del mes
  const dayOfWeek = lastDay.getDay();
  
  // Si es domingo (0), retroceder al sábado (6)
  // Si es sábado (6), mantener
  // Si es otro día, retroceder al sábado anterior
  if (dayOfWeek === 0) {
    lastDay.setDate(lastDay.getDate() - 1);
  } else if (dayOfWeek !== 6) {
    lastDay.setDate(lastDay.getDate() - (dayOfWeek + 1));
  }
  
  return lastDay;
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
  filterGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  checkboxGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  analysisInfo: {
    backgroundColor: '#e6fffa',
    border: '1px solid #81e6d9',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '16px',
    fontSize: '14px',
    color: '#234e52'
  },
  overdueInfo: {
    backgroundColor: '#fef5e7',
    border: '1px solid #f6ad55',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '16px',
    fontSize: '14px',
    color: '#744210'
  },
  overdrawnInfo: {
    backgroundColor: '#fed7d7',
    border: '1px solid #fc8181',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '16px',
    fontSize: '14px',
    color: '#742a2a'
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
  debtSummary: {
    backgroundColor: '#fef5e7',
    border: '1px solid #f6ad55',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px',
    textAlign: 'center' as const
  },
  debtAmount: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#d69e2e',
    marginBottom: '8px'
  },
  debtLabel: {
    fontSize: '14px',
    color: '#744210',
    fontWeight: '500'
  },
  selectionControls: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '12px'
  },
  selectionInfo: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: '500'
  },
  selectionButtons: {
    display: 'flex',
    gap: '8px'
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
  thCheckbox: {
    backgroundColor: '#2b6cb0',
    color: 'white',
    padding: '12px 8px',
    textAlign: 'center' as const,
    fontWeight: '600',
    fontSize: '11px',
    borderRight: '1px solid #1a5490',
    width: '40px'
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
  tdCheckbox: {
    padding: '8px',
    textAlign: 'center' as const,
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    fontSize: '11px',
    width: '40px'
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

const months = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function CarteraPage() {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [weeksWithoutPayment, setWeeksWithoutPayment] = useState<number>(2);
  const [includeBadDebt, setIncludeBadDebt] = useState<boolean>(false);
  const [useHistoricalAnalysis, setUseHistoricalAnalysis] = useState<boolean>(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [includeOverdue, setIncludeOverdue] = useState<boolean>(false);
  const [includeOverdrawn, setIncludeOverdrawn] = useState<boolean>(false);
  const [selectedLoans, setSelectedLoans] = useState<Set<string>>(new Set());
  
  // Query para rutas
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);
  
  // Query para la cartera
  const { 
    data: carteraData, 
    loading: carteraLoading, 
    error: carteraError,
    refetch: refetchCartera 
  } = useQuery(GET_CARTERA, {
    variables: { 
      routeId: selectedRoute, 
      weeksWithoutPayment,
      includeBadDebt,
      analysisMonth: useHistoricalAnalysis ? selectedMonth : null,
      analysisYear: useHistoricalAnalysis ? selectedYear : null,
      includeOverdue,
      includeOverdrawn
    },
    skip: !selectedRoute
  });

  const processedData: CarteraData | null = carteraData?.getCartera || null;

  const handleGenerateReport = () => {
    if (selectedRoute) {
      setSelectedLoans(new Set()); // Reset selections when generating new report
      refetchCartera();
    }
  };

  const handleSelectAll = () => {
    if (processedData) {
      const allLoanIds = processedData.loans.map(loan => loan.id);
      setSelectedLoans(new Set(allLoanIds));
    }
  };

  const handleDeselectAll = () => {
    setSelectedLoans(new Set());
  };

  const handleToggleLoan = (loanId: string) => {
    const newSelected = new Set(selectedLoans);
    if (newSelected.has(loanId)) {
      newSelected.delete(loanId);
    } else {
      newSelected.add(loanId);
    }
    setSelectedLoans(newSelected);
  };

  const getStatusColor = (status: string, badDebtDate: string | null, weeksWithoutPayment: number, isOverdue: boolean, isOverdrawn: boolean) => {
    if (badDebtDate) return styles.statusDead;
    if (isOverdrawn) return styles.statusDead;
    if (isOverdue) return styles.statusOverdue;
    if (weeksWithoutPayment >= 2) return styles.statusOverdue;
    return styles.statusActive;
  };

  const getStatusText = (status: string, badDebtDate: string | null, weeksWithoutPayment: number, isOverdue: boolean, isOverdrawn: boolean) => {
    if (badDebtDate) return 'CARTERA MUERTA';
    if (isOverdrawn) return 'SOBREGIRADO';
    if (isOverdue) return 'SOBREGIRADO';
    if (weeksWithoutPayment >= 2) return 'VENCIDO';
    return 'ACTIVO';
  };

  const getLocality = (loan: any) => {
    const addresses = loan.borrower?.personalData?.addresses || [];
    return addresses.length > 0 ? addresses[0].location?.name : 'Sin localidad';
  };

  const getAnalysisDate = () => {
    if (!useHistoricalAnalysis || !selectedMonth || !selectedYear) return null;
    const month = parseInt(selectedMonth) - 1; // Mes en JS es 0-indexed
    return getLastWorkingDayOfMonth(selectedYear, month);
  };

  const analysisDate = getAnalysisDate();
  const analysisDateFormatted = analysisDate ? formatDate(analysisDate.toISOString()) : '';

  // Calcular deuda pendiente de los préstamos seleccionados
  const selectedPendingDebt = processedData 
    ? processedData.loans
        .filter(loan => selectedLoans.has(loan.id))
        .reduce((total, loan) => total + loan.pendingDebt, 0)
    : 0;

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
            <div style={styles.filterGroup}>
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

            <div style={styles.filterGroup}>
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

            <div style={styles.filterGroup}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Filtro de Estado
              </label>
              <div style={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  id="includeBadDebt"
                  checked={includeBadDebt}
                  onChange={(e) => setIncludeBadDebt(e.target.checked)}
                />
                <label htmlFor="includeBadDebt" style={{ fontSize: '14px' }}>
                  Incluir Cartera Muerta (badDebtDate)
                </label>
              </div>
            </div>

            <div style={styles.filterGroup}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Análisis Histórico
              </label>
              <div style={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  id="useHistoricalAnalysis"
                  checked={useHistoricalAnalysis}
                  onChange={(e) => setUseHistoricalAnalysis(e.target.checked)}
                />
                <label htmlFor="useHistoricalAnalysis" style={{ fontSize: '14px' }}>
                  Analizar hasta fecha específica
                </label>
              </div>
            </div>

            <div style={styles.filterGroup}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Créditos Sobregirados
              </label>
              <div style={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  id="includeOverdue"
                  checked={includeOverdue}
                  onChange={(e) => setIncludeOverdue(e.target.checked)}
                />
                <label htmlFor="includeOverdue" style={{ fontSize: '14px' }}>
                  Solo créditos que se pasaron de su plazo (14+ semanas)
                </label>
              </div>
            </div>

            <div style={styles.filterGroup}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Créditos en Sobregiro
              </label>
              <div style={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  id="includeOverdrawn"
                  checked={includeOverdrawn}
                  onChange={(e) => setIncludeOverdrawn(e.target.checked)}
                />
                <label htmlFor="includeOverdrawn" style={{ fontSize: '14px' }}>
                  Solo créditos con pagos excesivos (más de lo debido)
                </label>
              </div>
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

          {/* Filtros de fecha histórica */}
          {useHistoricalAnalysis && (
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div style={styles.filterGroup}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Mes
                </label>
                <Select
                  value={months.find(m => m.value === selectedMonth) || null}
                  options={months}
                  onChange={(option: any) => setSelectedMonth(option?.value || '')}
                  placeholder="Seleccionar mes..."
                />
              </div>

              <div style={styles.filterGroup}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Año
                </label>
                <Select
                  value={years.find(y => y === selectedYear) ? { value: selectedYear.toString(), label: selectedYear.toString() } : null}
                  options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
                  onChange={(option: any) => setSelectedYear(parseInt(option?.value) || currentYear)}
                  placeholder="Seleccionar año..."
                />
              </div>
            </div>
          )}

          {/* Información del análisis histórico */}
          {useHistoricalAnalysis && analysisDate && (
            <div style={styles.analysisInfo}>
              📅 <strong>Análisis Histórico:</strong> Calculando semanas sin pago hasta el {analysisDateFormatted} 
              (último día laboral del {months.find(m => m.value === selectedMonth)?.label} {selectedYear})
            </div>
          )}

          {/* Información de créditos sobregirados */}
          {includeOverdue && (
            <div style={styles.overdueInfo}>
              ⚠️ <strong>Créditos Sobregirados:</strong> Mostrando solo préstamos que se pasaron de su plazo original de 14 semanas
            </div>
          )}

          {/* Información de créditos en sobregiro */}
          {includeOverdrawn && (
            <div style={styles.overdrawnInfo}>
              💰 <strong>Créditos en Sobregiro:</strong> Mostrando solo préstamos donde el cliente pagó más de lo que debía
            </div>
          )}
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
              {useHistoricalAnalysis && analysisDate && (
                <span style={{ fontSize: '14px', color: '#718096', fontWeight: '400' }}>
                  {' '}(Análisis hasta {analysisDateFormatted})
                </span>
              )}
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

            {/* Resumen de Deuda Pendiente */}
            <div style={styles.debtSummary}>
              <div style={styles.debtAmount}>
                {formatCurrency(processedData.totalPendingDebt)}
              </div>
              <div style={styles.debtLabel}>
                Total de Deuda Pendiente por Pagar
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
                {useHistoricalAnalysis && analysisDate && (
                  <span style={{ fontSize: '14px', color: '#718096', fontWeight: '400' }}>
                    {' '}- Análisis hasta {analysisDateFormatted}
                  </span>
                )}
              </h2>
            </div>

            {/* Controles de selección */}
            <div style={styles.selectionControls}>
              <div style={styles.selectionInfo}>
                {selectedLoans.size} de {processedData.loans.length} préstamos seleccionados
                {selectedLoans.size > 0 && (
                  <span style={{ marginLeft: '12px', fontWeight: '600', color: '#d69e2e' }}>
                    - Deuda seleccionada: {formatCurrency(selectedPendingDebt)}
                  </span>
                )}
              </div>
              <div style={styles.selectionButtons}>
                <Button
                  size="small"
                  tone="active"
                  onClick={handleSelectAll}
                >
                  Seleccionar Todos
                </Button>
                <Button
                  size="small"
                  tone="passive"
                  onClick={handleDeselectAll}
                >
                  Deseleccionar Todos
                </Button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedLoans.size === processedData.loans.length && processedData.loans.length > 0}
                        onChange={() => {
                          if (selectedLoans.size === processedData.loans.length) {
                            handleDeselectAll();
                          } else {
                            handleSelectAll();
                          }
                        }}
                        style={{ transform: 'scale(1.2)' }}
                      />
                    </th>
                    <th style={styles.thFirst}>CLIENTE</th>
                    <th style={styles.th}>LÍDER</th>
                    <th style={styles.th}>LOCALIDAD</th>
                    <th style={styles.th}>MONTO PRESTADO</th>
                    <th style={styles.th}>TASA</th>
                    <th style={styles.th}>DEUDA TOTAL</th>
                    <th style={styles.th}>PAGADO</th>
                    <th style={styles.th}>PENDIENTE</th>
                    <th style={styles.th}>ÚLTIMO PAGO</th>
                    <th style={styles.th}>SEMANAS SIN PAGAR</th>
                    <th style={styles.th}>PLAZO ORIGINAL</th>
                    <th style={styles.th}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {processedData.loans.map((loan) => (
                    <tr key={loan.id}>
                      <td style={styles.tdCheckbox}>
                        <input
                          type="checkbox"
                          checked={selectedLoans.has(loan.id)}
                          onChange={() => handleToggleLoan(loan.id)}
                          style={{ transform: 'scale(1.2)' }}
                        />
                      </td>
                      <td style={styles.tdFirst}>
                        {loan.borrower?.personalData?.fullName || 'N/A'}
                      </td>
                      <td style={styles.td}>
                        {loan.lead?.personalData?.fullName || 'N/A'}
                      </td>
                      <td style={styles.td}>
                        {getLocality(loan)}
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
                        {loan.originalWeeksDuration || 14} semanas
                      </td>
                      <td style={styles.td}>
                        <span style={getStatusColor(loan.status, loan.badDebtDate, loan.weeksWithoutPayment, loan.isOverdue, loan.isOverdrawn)}>
                          {getStatusText(loan.status, loan.badDebtDate, loan.weeksWithoutPayment, loan.isOverdue, loan.isOverdrawn)}
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