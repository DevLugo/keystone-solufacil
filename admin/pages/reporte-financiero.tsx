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
import ProtectedRoute from '../components/ProtectedRoute';

// Query para obtener rutas
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;

  // Mutación para ajustar balance de cuenta
  const ADJUST_ACCOUNT_BALANCE = gql`
    mutation AdjustAccountBalance($accountId: String!, $targetAmount: Float!, $counterAccountId: String, $description: String) {
      adjustAccountBalance(accountId: $accountId, targetAmount: $targetAmount, counterAccountId: $counterAccountId, description: $description)
    }
  `;

// Query para obtener el reporte financiero
const GET_FINANCIAL_REPORT = gql`
  query GetFinancialReport($routeIds: [String!]!, $year: Int!) {
    getFinancialReport(routeIds: $routeIds, year: $year)
  }
`;

interface FinancialReportData {
  routes: {
    id: string;
    name: string;
  }[];
  year: number;
  months: string[];
  data: {
    [month: string]: {
      totalExpenses: number;
      generalExpenses: number;
      nomina: number;
      comissions: number;
      incomes: number;
      totalCash: number;
      loanDisbursements: number;
      balance: number;
      profitPercentage: number;
      balanceWithReinvest: number;
      carteraActiva: number;
      carteraVencida: number;
      carteraMuerta: number;
      renovados: number;
      badDebtAmount: number;
      // Campos de flujo de efectivo
      totalIncomingCash: number;
      capitalReturn: number;
      profitReturn: number;
      operationalCashUsed: number;
      // Campos para ROI real
      totalInvestment: number;
      operationalExpenses: number;
      availableCash: number;
      // Campos para gasolina
      tokaGasolina: number;
      cashGasolina: number;
      totalGasolina: number;
      // Campos de desglose de nómina
      nominaInterna: number;
      salarioExterno: number;
      viaticos: number;
    };
  };
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(amount);
};

const formatPercentage = (percentage: number): string => {
  return `${percentage.toFixed(1)}%`;
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
  reportCard: {
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
  positiveValue: {
    color: '#38a169'
  },
  negativeValue: {
    color: '#e53e3e'
  },
  neutralValue: {
    color: '#4a5568'
  },
  totalRow: {
    backgroundColor: '#edf2f7',
    fontWeight: '600'
  },
  subSectionRow: {
    backgroundColor: '#f7fafc',
    fontWeight: '500'
  },
  subSectionCell: {
    padding: '6px 8px',
    textAlign: 'left' as const,
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    fontSize: '10px',
    backgroundColor: '#f7fafc',
    color: '#4a5568'
  },
  subSectionDataCell: {
    padding: '6px 8px',
    textAlign: 'center' as const,
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    fontSize: '10px',
    backgroundColor: '#f7fafc',
    fontWeight: '500'
  },
  mainSectionCell: {
    padding: '12px 16px',
    textAlign: 'left' as const,
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    fontWeight: '500',
    backgroundColor: '#fef5e7',
    fontSize: '11px'
  }
};

export default function ReporteFinancieroPage() {
  // Por ahora, permitir acceso a todos los usuarios
  // TODO: Implementar verificación de rol más robusta
  const userRole = 'ADMIN'; // Temporalmente hardcodeado para testing

  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Query para rutas
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);
  
  // Query para el reporte
  const { 
    data: reportData, 
    loading: reportLoading, 
    error: reportError,
    refetch: refetchReport 
  } = useQuery(GET_FINANCIAL_REPORT, {
    variables: { routeIds: selectedRoutes, year: selectedYear },
    skip: !selectedRoutes.length
  });

  const processedData: FinancialReportData | null = reportData?.getFinancialReport || null;

  const handleGenerateReport = () => {
    if (selectedRoutes.length > 0) {
      refetchReport();
    }
  };

  const getValueColor = (value: number) => {
    if (value > 0) return styles.positiveValue;
    if (value < 0) return styles.negativeValue;
    return styles.neutralValue;
  };

  // Función para calcular totales anuales
  const calculateAnnualTotals = () => {
    if (!processedData) return {};
    
    const totals: any = {};
    
    // Calcular totales para cada campo
    Object.keys(processedData.data).forEach(monthKey => {
      const monthData = processedData.data[monthKey];
      Object.keys(monthData).forEach(field => {
        if (typeof monthData[field as keyof typeof monthData] === 'number') {
          totals[field] = (totals[field] || 0) + (monthData[field as keyof typeof monthData] as number);
        }
      });
    });
    
    return totals;
  };

  const annualTotals = calculateAnnualTotals();

  const routeOptions = routesData?.routes?.map((route: any) => ({
    label: route.name,
    value: route.id
  })) || [];

  const yearOptions = Array.from({ length: 10 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return { label: year.toString(), value: year.toString() };
  });

  const getSelectedRoutesDisplay = () => {
    if (selectedRoutes.length === 0) return 'Ninguna ruta seleccionada';
    if (selectedRoutes.length === 1) {
      const route = routeOptions.find((r: any) => r.value === selectedRoutes[0]);
      return route ? `${route.label} (${selectedRoutes.length} ruta)` : 'Ruta seleccionada';
    }
    if (selectedRoutes.length === routeOptions.length) return 'Todas las rutas';
    return `${selectedRoutes.length} rutas seleccionadas`;
  };

  const getReportTitle = () => {
    if (!processedData) return '';
    if (processedData.routes.length === 1) {
      return `${processedData.routes[0].name} - ${processedData.year}`;
    }
    if (processedData.routes.length === routeOptions.length) {
      return `Todas las Rutas - ${processedData.year}`;
    }
    return `${processedData.routes.length} Rutas Combinadas - ${processedData.year}`;
  };

  const getRoutesSummary = () => {
    if (!processedData) return '';
    if (processedData.routes.length === 1) {
      return processedData.routes[0].name;
    }
    if (processedData.routes.length === routeOptions.length) {
      return 'Todas las rutas del sistema';
    }
    return processedData.routes.map(route => route.name).join(', ');
  };

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <PageContainer header="📊 Reporte Financiero - Gastos vs Ganancias">
        <div style={styles.container}>
        {/* Filtros */}
        <div style={styles.filtersCard}>
          {/* Mensaje de ayuda */}
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px 16px', 
            backgroundColor: '#f0f9ff', 
            borderRadius: '8px', 
            border: '1px solid #e0f2fe',
            fontSize: '13px',
            color: '#0369a1'
          }}>
            💡 <strong>Nueva funcionalidad:</strong> Ahora puedes seleccionar múltiples rutas para obtener reportes financieros combinados. 
            Usa los checkboxes para seleccionar las rutas que desees incluir en el análisis.
          </div>
          
          <div style={styles.filtersGrid}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Rutas
              </label>
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px', 
                padding: '8px',
                backgroundColor: '#f9fafb'
              }}>
                {routesLoading ? (
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <LoadingDots label="Cargando rutas..." />
                  </div>
                ) : (
                  <>
                    {/* Botones de selección masiva */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '8px', 
                      marginBottom: '12px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <Button
                        size="small"
                        tone="passive"
                        onClick={() => setSelectedRoutes(routeOptions.map((r: any) => r.value))}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        Seleccionar Todas
                      </Button>
                      <Button
                        size="small"
                        tone="passive"
                        onClick={() => setSelectedRoutes([])}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        Deseleccionar Todas
                      </Button>
                    </div>
                    
                    {/* Lista de rutas */}
                    {routeOptions.map((route: any) => (
                      <label key={route.value} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '6px 0',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedRoutes.includes(route.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoutes([...selectedRoutes, route.value]);
                            } else {
                              setSelectedRoutes(selectedRoutes.filter(id => id !== route.value));
                            }
                          }}
                          style={{ margin: 0 }}
                        />
                        <span>{route.label}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
              {selectedRoutes.length > 0 && (
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '12px', 
                  color: '#059669',
                  fontStyle: 'italic',
                  padding: '8px 12px',
                  backgroundColor: '#ecfdf5',
                  borderRadius: '6px',
                  border: '1px solid #a7f3d0'
                }}>
                  ✅ {getSelectedRoutesDisplay()}
                </div>
              )}
              {selectedRoutes.length === 0 && (
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '12px', 
                  color: '#92400e',
                  fontStyle: 'italic',
                  padding: '8px 12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '6px',
                  border: '1px solid #f59e0b'
                }}>
                  💡 Selecciona una o más rutas para generar el reporte financiero
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Año
              </label>
              <Select
                value={yearOptions.find(opt => opt.value === selectedYear.toString()) || null}
                options={yearOptions}
                onChange={(option: any) => setSelectedYear(parseInt(option?.value || new Date().getFullYear().toString()))}
              />
            </div>

            <Button
              size="small"
              tone="active"
              onClick={handleGenerateReport}
              isDisabled={!selectedRoutes.length || reportLoading}
              style={{ 
                minWidth: '160px',
                position: 'relative'
              }}
            >
              {reportLoading ? 'Generando...' : (
                <>
                  Generar Reporte
                  {selectedRoutes.length > 0 && (
                    <span style={{
                      marginLeft: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      {selectedRoutes.length} ruta{selectedRoutes.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Errores */}
        {reportError && (
          <GraphQLErrorNotice errors={[reportError]} networkError={undefined} />
        )}

        {/* Reporte */}
        {processedData && (
          <div style={styles.reportCard}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                {getReportTitle()}
              </h2>
              {processedData.routes.length > 1 && (
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '13px', 
                  color: '#059669',
                  fontStyle: 'italic',
                  padding: '6px 12px',
                  backgroundColor: '#ecfdf5',
                  borderRadius: '6px',
                  border: '1px solid #a7f3d0',
                  display: 'inline-block'
                }}>
                  🔗 Reporte combinado de {processedData.routes.length} rutas
                </div>
              )}
              <div style={{ 
                marginTop: '8px', 
                fontSize: '14px', 
                color: '#6b7280'
              }}>
                📍 {getRoutesSummary()}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thFirst}>CONCEPTO</th>
                    {processedData.months.map((month, index) => (
                      <th key={month} style={styles.th}>
                        {month}
                      </th>
                    ))}
                    <th style={{ ...styles.th, backgroundColor: '#1e40af', fontWeight: '700', fontSize: '12px' }}>
                      TOTAL ANUAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* SECCIÓN: EGRESOS */}
                  <tr style={{ backgroundColor: '#fed7d7', fontWeight: '700' }}>
                    <td colSpan={13} style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#742a2a',
                      fontSize: '12px',
                      letterSpacing: '1px'
                    }}>
                      💸 EGRESOS OPERATIVOS
                    </td>
                  </tr>
                  
                  {/* Gastos Totales */}
                  <tr>
                    <td style={styles.tdFirst}>GASTOS TOTALES</td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const d: any = processedData.data[monthKey] as any;
                      const totalSalarios = Number(d?.nominaInterna || 0) + Number(d?.salarioExterno || 0) + Number(d?.viaticos || 0);
                      const gastosOperativos = Number(d?.generalExpenses || 0) + Number(d?.comissions || 0) + totalSalarios + Number(d?.travelExpenses || 0);
                      const gastosTotales = gastosOperativos + Number(d?.badDebtAmount || 0);
                      return (
                        <td key={month} style={{ ...styles.td, ...getValueColor(-gastosTotales), fontWeight: '600' }}>
                          {gastosTotales > 0 ? formatCurrency(gastosTotales) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#fef2f2', 
                      fontWeight: '700',
                      fontSize: '12px',
                      color: '#dc2626'
                    }}>
                      {(() => {
                        const totalSalariosAnual = Number(annualTotals.nominaInterna || 0) + Number(annualTotals.salarioExterno || 0) + Number(annualTotals.viaticos || 0);
                        const gastosOperativosAnual = Number(annualTotals.generalExpenses || 0) + Number(annualTotals.comissions || 0) + totalSalariosAnual + Number(annualTotals.travelExpenses || 0);
                        const totalAnual = gastosOperativosAnual + Number(annualTotals.badDebtAmount || 0);
                        return totalAnual > 0 ? formatCurrency(totalAnual) : '-';
                      })()}
                    </td>
                  </tr>

                  {/* Gastos Operativos */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={styles.mainSectionCell}>
                      Gastos Operativos
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-data?.generalExpenses || 0), fontWeight: '600' }}>
                          {data?.generalExpenses ? formatCurrency(data.generalExpenses) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#fef5e7', 
                      fontWeight: '700',
                      fontSize: '12px',
                      color: '#dc2626'
                    }}>
                      {annualTotals.generalExpenses ? formatCurrency(annualTotals.generalExpenses) : '-'}
                    </td>
                  </tr>

                  {/* Comisiones */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={styles.mainSectionCell}>
                      Comisiones
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-data?.comissions || 0), fontWeight: '600' }}>
                          {data?.comissions ? formatCurrency(data.comissions) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#fef5e7', 
                      fontWeight: '700',
                      fontSize: '12px',
                      color: '#dc2626'
                    }}>
                      {annualTotals.comissions ? formatCurrency(annualTotals.comissions) : '-'}
                    </td>
                  </tr>

                  {/* Salarios */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={styles.mainSectionCell}>
                      Salarios
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      const totalSalarios = (data?.nominaInterna || 0) + (data?.salarioExterno || 0) + (data?.viaticos || 0);
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-totalSalarios), fontWeight: '600' }}>
                          {totalSalarios > 0 ? formatCurrency(totalSalarios) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#fef5e7', 
                      fontWeight: '700',
                      fontSize: '12px',
                      color: '#dc2626'
                    }}>
                      {(() => {
                        const totalAnual = (annualTotals.nominaInterna || 0) + (annualTotals.salarioExterno || 0) + (annualTotals.viaticos || 0);
                        return totalAnual > 0 ? formatCurrency(totalAnual) : '-';
                      })()}
                    </td>
                  </tr>

                  {/* Nómina Interna */}
                  <tr style={styles.subSectionRow}>
                    <td style={{ ...styles.subSectionCell, paddingLeft: '48px' }}>
                      ├─ Nómina
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.subSectionDataCell, ...getValueColor(-data?.nominaInterna || 0) }}>
                          {data?.nominaInterna ? formatCurrency(data.nominaInterna) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Salario Externo */}
                  <tr style={styles.subSectionRow}>
                    <td style={{ ...styles.subSectionCell, paddingLeft: '48px' }}>
                      ├─ Salario Externo
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.subSectionDataCell, ...getValueColor(-data?.salarioExterno || 0) }}>
                          {data?.salarioExterno ? formatCurrency(data.salarioExterno) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Viáticos */}
                  <tr style={styles.subSectionRow}>
                    <td style={{ ...styles.subSectionCell, paddingLeft: '48px' }}>
                      └─ Viáticos
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.subSectionDataCell, ...getValueColor(-data?.viaticos || 0) }}>
                          {data?.viaticos ? formatCurrency(data.viaticos) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* CONNECT (TRAVEL_EXPENSES) */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={styles.mainSectionCell}>
                      Connect
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data: any = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-Number(data?.travelExpenses || 0)), fontWeight: '600' }}>
                          {Number(data?.travelExpenses || 0) ? formatCurrency(Number(data.travelExpenses)) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#fef5e7', 
                      fontWeight: '700',
                      fontSize: '12px',
                      color: '#dc2626'
                    }}>
                      {annualTotals.travelExpenses ? formatCurrency(annualTotals.travelExpenses) : '-'}
                    </td>
                  </tr>

                  {/* Gasolina */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={styles.mainSectionCell}>
                      Gasolina
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-data?.totalGasolina || 0), fontWeight: '600' }}>
                          {data?.totalGasolina ? formatCurrency(data.totalGasolina) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#fef5e7', 
                      fontWeight: '700',
                      fontSize: '12px',
                      color: '#dc2626'
                    }}>
                      {annualTotals.totalGasolina ? formatCurrency(annualTotals.totalGasolina) : '-'}
                    </td>
                  </tr>

                  {/* Gasolina TOKA */}
                  <tr style={styles.subSectionRow}>
                    <td style={{ ...styles.subSectionCell, paddingLeft: '48px' }}>
                      ├─ TOKA
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.subSectionDataCell, ...getValueColor(-data?.tokaGasolina || 0) }}>
                          {data?.tokaGasolina ? formatCurrency(data.tokaGasolina) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Gasolina Efectivo */}
                  <tr style={styles.subSectionRow}>
                    <td style={{ ...styles.subSectionCell, paddingLeft: '48px' }}>
                      └─ Efectivo
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.subSectionDataCell, ...getValueColor(-data?.cashGasolina || 0) }}>
                          {data?.cashGasolina ? formatCurrency(data.cashGasolina) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Deuda Mala */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={styles.mainSectionCell}>
                      Deuda Mala
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#fef5e7', 
                          ...getValueColor(-data?.badDebtAmount || 0),
                          fontWeight: '600',
                          color: data?.badDebtAmount > 0 ? '#d32f2f' : '#666'
                        }}>
                          {data?.badDebtAmount ? formatCurrency(data.badDebtAmount) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#fef5e7', 
                      fontWeight: '700',
                      fontSize: '12px',
                      color: '#dc2626'
                    }}>
                      {annualTotals.badDebtAmount ? formatCurrency(annualTotals.badDebtAmount) : '-'}
                    </td>
                  </tr>

                  {/* SECCIÓN: INGRESOS */}
                  <tr style={{ backgroundColor: '#d4edda', fontWeight: '700' }}>
                    <td colSpan={13} style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#155724',
                      fontSize: '12px',
                      letterSpacing: '1px'
                    }}>
                      💰 INGRESOS
                    </td>
                  </tr>

                  {/* Ingresos */}
                  <tr>
                    <td style={styles.tdFirst}>INGRESOS POR COBRANZA</td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, ...getValueColor(data?.incomes || 0), fontWeight: '600' }}>
                          {data?.incomes ? formatCurrency(data.incomes) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#f0fdf4', 
                      fontWeight: '700',
                      fontSize: '12px',
                      color: '#16a34a'
                    }}>
                      {annualTotals.incomes ? formatCurrency(annualTotals.incomes) : '-'}
                    </td>
                  </tr>

                  {/* SECCIÓN: RESULTADOS FINANCIEROS */}
                  <tr style={{ backgroundColor: '#f3e5f5', fontWeight: '700' }}>
                    <td colSpan={14} style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#4a148c',
                      fontSize: '12px',
                      letterSpacing: '1px'
                    }}>
                      🎯 RESULTADOS FINANCIEROS
                    </td>
                  </tr>

                  {/* Ganancias Operativas (calculadas en API) */}
                  <tr style={{ backgroundColor: '#f8f9fa', border: '2px solid #6c757d' }}>
                    <td style={{ 
                      ...styles.tdFirst, 
                      backgroundColor: '#f8f9fa', 
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      🏆 GANANCIAS OPERATIVAS
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      // Mostramos lo calculado en la API: operationalProfit = profitReturn - operationalExpenses
                      const gananciasOperativas = Number((data as any)?.operationalProfit || 0);
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#f8f9fa', 
                          fontWeight: '700',
                          fontSize: '12px',
                          ...getValueColor(gananciasOperativas)
                        }}>
                          {gananciasOperativas !== 0 ? formatCurrency(gananciasOperativas) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#f8f9fa', 
                      fontWeight: '700',
                      fontSize: '12px',
                      border: '2px solid #6c757d',
                      color: '#16a34a'
                    }}>
                      {annualTotals.operationalProfit 
                        ? formatCurrency(annualTotals.operationalProfit) 
                        : '-'}
                    </td>
                  </tr>

                  {/* % Ganancia Operativa (desde API) */}
                  <tr style={{ backgroundColor: '#fff3cd' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#fff3cd' }}>
                      📊 % GANANCIA OPERATIVA
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      const porcentajeOperativo = Number((data as any)?.profitPercentage || 0);
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#fff3cd',
                          fontWeight: '600',
                          ...getValueColor(porcentajeOperativo) 
                        }}>
                          {porcentajeOperativo !== 0 ? formatPercentage(porcentajeOperativo) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Ganancia por pago recibido */}
                  <tr style={{ backgroundColor: '#ecfeff' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#ecfeff' }}>
                      💵 GANANCIA POR PAGO RECIBIDO
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data: any = processedData.data[monthKey] as any;
                      const gainPerPayment = Number(data?.gainPerPayment || 0);
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#ecfeff',
                          fontWeight: '600',
                          color: gainPerPayment > 0 ? '#0f766e' : '#64748b'
                        }}>
                          {gainPerPayment > 0 ? formatCurrency(gainPerPayment) : '$0.00'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#ecfeff', 
                      fontWeight: '700',
                      fontSize: '12px',
                      color: '#0f766e'
                    }}>
                      {(() => {
                        // Promedio anual ponderado por cantidad de pagos
                        const months = processedData.months.map((_, index) => (index + 1).toString().padStart(2, '0'));
                        let totalProfit = 0; let totalPayments = 0;
                        months.forEach(mk => {
                          const d: any = (processedData as any).data[mk] || {};
                          totalProfit += Number(d?.profitReturn || 0);
                          totalPayments += Number(d?.paymentsCount || 0);
                        });
                        const val = totalPayments > 0 ? totalProfit / totalPayments : 0;
                        return formatCurrency(val);
                      })()}
                    </td>
                  </tr>



                  {/* SECCIÓN: INVERSIÓN */}
                  <tr style={{ backgroundColor: '#e3f2fd', fontWeight: '700' }}>
                    <td colSpan={14} style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#0d47a1',
                      fontSize: '12px',
                      letterSpacing: '1px'
                    }}>
                      📈 REINVERSIÓN
                    </td>
                  </tr>

                  {/* Préstamos (Reinversión) */}
                  <tr>
                    <td style={styles.tdFirst}>PRÉSTAMOS OTORGADOS</td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, ...getValueColor(-data?.loanDisbursements || 0), fontWeight: '600' }}>
                          {data?.loanDisbursements ? formatCurrency(data.loanDisbursements) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Resultado Final (después de reinversión) */}
                  <tr style={{ backgroundColor: '#e8f5e8', border: '2px solid #4caf50' }}>
                    <td style={{ 
                      ...styles.tdFirst, 
                      backgroundColor: '#e8f5e8', 
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      💎 RESULTADO FINAL (Después de Reinversión)
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      const gastosOperativos = (data?.operationalExpenses || 0) + (data?.badDebtAmount || 0);
                      const gananciasOperativas = (data?.incomes || 0) - gastosOperativos;
                      const resultadoFinal = gananciasOperativas - (data?.loanDisbursements || 0);
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#e8f5e8', 
                          fontWeight: '700',
                          fontSize: '12px',
                          ...getValueColor(resultadoFinal)
                        }}>
                          {resultadoFinal !== 0 ? formatCurrency(resultadoFinal) : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      ...styles.td, 
                      backgroundColor: '#e8f5e8', 
                      fontWeight: '700',
                      fontSize: '12px',
                      border: '2px solid #4caf50',
                      color: '#16a34a'
                    }}>
                      {(() => {
                        const gastosOperativosAnual = (annualTotals.operationalExpenses || 0) + (annualTotals.badDebtAmount || 0);
                        const gananciasOperativasAnual = (annualTotals.incomes || 0) - gastosOperativosAnual;
                        const resultadoFinalAnual = gananciasOperativasAnual - (annualTotals.loanDisbursements || 0);
                        return resultadoFinalAnual !== 0 ? formatCurrency(resultadoFinalAnual) : '-';
                      })()}
                    </td>
                  </tr>

                  {/* SECCIÓN: PORTFOLIO */}
                  <tr style={{ backgroundColor: '#e8f5e8', fontWeight: '700' }}>
                    <td colSpan={14} style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#2e7d32',
                      fontSize: '12px',
                      letterSpacing: '1px'
                    }}>
                      📋 PORTFOLIO DE CRÉDITOS
                    </td>
                  </tr>

                  {/* Créditos Activos */}
                  <tr style={{ backgroundColor: '#f1f8e9' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#f1f8e9' }}>
                      📈 CRÉDITOS ACTIVOS
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#f1f8e9',
                          fontWeight: '600',
                          color: '#2e7d32'
                        }}>
                          {data?.carteraActiva || 0}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Cartera Vencida */}
                  <tr style={{ backgroundColor: '#f1f8e9' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#f1f8e9' }}>
                      ⚠️ CARTERA VENCIDA
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#f1f8e9',
                          fontWeight: '600',
                          color: data?.carteraVencida > 0 ? '#d32f2f' : '#2e7d32'
                        }}>
                          {data?.carteraVencida || 0}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Cartera Muerta */}
                  <tr style={{ backgroundColor: '#f1f8e9' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#f1f8e9' }}>
                      💀 CARTERA MUERTA
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#f1f8e9',
                          fontWeight: '600',
                          color: data?.carteraMuerta > 0 ? '#8b0000' : '#2e7d32'
                        }}>
                          {data?.carteraMuerta || 0}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Renovados */}
                  <tr style={{ backgroundColor: '#f1f8e9' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#f1f8e9' }}>
                      🔄 RENOVADOS
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#f1f8e9',
                          fontWeight: '600',
                          color: '#1976d2'
                        }}>
                          {data?.renovados || 0}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Deuda Mala */}
                  <tr style={{ backgroundColor: '#fff3e0' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#fff3e0' }}>
                      💀 DEUDA MALA
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#fff3e0',
                          fontWeight: '600',
                          color: data?.badDebtAmount > 0 ? '#d32f2f' : '#666'
                        }}>
                          {data?.badDebtAmount ? formatCurrency(data.badDebtAmount) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* SECCIÓN: FLUJO DE EFECTIVO */}
                  <tr style={{ backgroundColor: '#e2e8f0', fontWeight: '700' }}>
                    <td colSpan={13} style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#344767',
                      fontSize: '12px',
                      letterSpacing: '1px'
                    }}>
                      💰 ANÁLISIS DE FLUJO DE EFECTIVO
                    </td>
                  </tr>

                  {/* Total que Ingresa */}
                  <tr>
                    <td style={styles.tdFirst}>💵 TOTAL QUE INGRESA</td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, ...getValueColor(data?.totalIncomingCash || 0), fontWeight: '600' }}>
                          {data?.totalIncomingCash ? formatCurrency(data.totalIncomingCash) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Desglose de Ingresos */}
                  <tr style={styles.subSectionRow}>
                    <td style={{ ...styles.subSectionCell, paddingLeft: '32px' }}>
                      ├─ Ganancia Pura
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.subSectionDataCell, color: '#22c55e' }}>
                          {data?.profitReturn ? formatCurrency(data.profitReturn) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  <tr style={styles.subSectionRow}>
                    <td style={{ ...styles.subSectionCell, paddingLeft: '32px' }}>
                      └─ Capital Devuelto
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.subSectionDataCell, color: '#3b82f6' }}>
                          {data?.capitalReturn ? formatCurrency(data.capitalReturn) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Dinero Usado en Operación */}
                  <tr>
                    <td style={styles.tdFirst}>💸 DINERO USADO EN OPERACIÓN</td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, ...getValueColor(-data?.operationalCashUsed || 0), fontWeight: '600' }}>
                          {data?.operationalCashUsed ? formatCurrency(data.operationalCashUsed) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Flujo Neto Disponible */}
                  <tr style={{ backgroundColor: '#f8f9fa', border: '2px solid #6c757d' }}>
                    <td style={{ 
                      ...styles.tdFirst, 
                      backgroundColor: '#f8f9fa', 
                      fontWeight: '700',
                      fontSize: '13px'
                    }}>
                      📊 FLUJO NETO DISPONIBLE
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      const flujoNeto = (data?.totalIncomingCash || 0) - (data?.operationalCashUsed || 0);
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#f8f9fa', 
                          fontWeight: '700',
                          fontSize: '12px',
                          ...getValueColor(flujoNeto)
                        }}>
                          {flujoNeto !== 0 ? formatCurrency(flujoNeto) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Inversión Total */}
                  <tr>
                    <td style={styles.tdFirst}>💰 INVERSIÓN TOTAL DEL MES</td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, ...getValueColor(-data?.totalInvestment || 0), fontWeight: '600' }}>
                          {data?.totalInvestment ? formatCurrency(data.totalInvestment) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Desglose de Inversión */}
                  <tr style={styles.subSectionRow}>
                    <td style={{ ...styles.subSectionCell, paddingLeft: '32px' }}>
                      ├─ Préstamos Otorgados
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.subSectionDataCell, color: '#dc2626' }}>
                          {data?.loanDisbursements ? formatCurrency(data.loanDisbursements) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  <tr style={styles.subSectionRow}>
                    <td style={{ ...styles.subSectionCell, paddingLeft: '32px' }}>
                      └─ Gastos Operativos
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.subSectionDataCell, color: '#dc2626' }}>
                          {data?.operationalExpenses ? formatCurrency(data.operationalExpenses) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Dinero Disponible en Caja */}
                  <tr style={{ backgroundColor: '#f0f9ff' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#f0f9ff' }}>
                      💰 DINERO DISPONIBLE EN CAJA
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#f0f9ff',
                          fontWeight: '600',
                          color: '#1d4ed8'
                        }}>
                          {data?.availableCash ? formatCurrency(data.availableCash) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* ROI Activo */}
                  <tr style={{ backgroundColor: '#fff3cd' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#fff3cd' }}>
                      🔥 ROI ACTIVO (Solo dinero trabajando)
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      const roiActivo = data?.totalInvestment > 0 
                        ? ((data?.profitReturn || 0) / data.totalInvestment * 100) 
                        : 0;
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#fff3cd',
                          fontWeight: '700',
                          fontSize: '12px',
                          color: roiActivo > 20 ? '#16a34a' : roiActivo > 12 ? '#eab308' : roiActivo > 0 ? '#f97316' : '#ef4444'
                        }}>
                          {roiActivo > 0 ? formatPercentage(roiActivo) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* ROI Total */}
                  <tr style={{ backgroundColor: '#fef3c7' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#fef3c7' }}>
                      💼 ROI TOTAL (Incluyendo caja)
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      const capitalTotal = (data?.totalInvestment || 0) + (data?.availableCash || 0);
                      const roiTotal = capitalTotal > 0 
                        ? ((data?.profitReturn || 0) / capitalTotal * 100) 
                        : 0;
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#fef3c7',
                          fontWeight: '700',
                          fontSize: '12px',
                          color: roiTotal > 15 ? '#16a34a' : roiTotal > 8 ? '#eab308' : roiTotal > 0 ? '#f97316' : '#ef4444'
                        }}>
                          {roiTotal > 0 ? formatPercentage(roiTotal) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Eficiencia de Capital */}
                  <tr style={{ backgroundColor: '#f0f9ff' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#f0f9ff' }}>
                      📊 EFICIENCIA DE CAPITAL (% Activo vs Total)
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      const capitalTotal = (data?.totalInvestment || 0) + (data?.availableCash || 0);
                      const eficiencia = capitalTotal > 0 
                        ? ((data?.totalInvestment || 0) / capitalTotal * 100) 
                        : 0;
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#f0f9ff',
                          fontWeight: '600',
                          color: eficiencia > 90 ? '#16a34a' : eficiencia > 80 ? '#eab308' : '#ef4444'
                        }}>
                          {eficiencia > 0 ? formatPercentage(eficiencia) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Ratio Ganancia vs Inversión */}
                  <tr style={{ backgroundColor: '#f0f9ff' }}>
                    <td style={{ ...styles.tdFirst, backgroundColor: '#f0f9ff' }}>
                      📊 GANANCIA POR PESO INVERTIDO
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      const gananciaXPeso = data?.totalInvestment > 0 
                        ? (data?.profitReturn || 0) / data.totalInvestment 
                        : 0;
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#f0f9ff',
                          fontWeight: '600',
                          color: gananciaXPeso > 0.15 ? '#16a34a' : gananciaXPeso > 0.08 ? '#eab308' : '#ef4444'
                        }}>
                          {gananciaXPeso > 0 ? `$${gananciaXPeso.toFixed(2)}` : '-'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Estado de carga */}
        {reportLoading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <LoadingDots label="Cargando reporte financiero..." />
          </div>
        )}

        {/* Estado sin datos */}
        {!reportLoading && !processedData && selectedRoutes.length > 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>
              📊 Reporte Financiero
            </div>
            <div style={{ fontSize: '14px' }}>
              Selecciona las rutas y el año para generar el reporte financiero
            </div>
          </div>
        )}

        {/* Estado sin rutas seleccionadas */}
        {!reportLoading && !processedData && selectedRoutes.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>
              🎯 Selecciona Rutas
            </div>
            <div style={{ fontSize: '14px' }}>
              Usa los checkboxes de arriba para seleccionar una o más rutas
            </div>
            <div style={{ fontSize: '12px', marginTop: '8px', color: '#9ca3af' }}>
              Puedes seleccionar múltiples rutas para obtener reportes combinados
            </div>
          </div>
        )}
      </div>
    </PageContainer>
    </ProtectedRoute>
  );
} 