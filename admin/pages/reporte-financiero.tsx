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

// Query para obtener el reporte financiero
const GET_FINANCIAL_REPORT = gql`
  query GetFinancialReport($routeId: String!, $year: Int!) {
    getFinancialReport(routeId: $routeId, year: $year)
  }
`;

interface FinancialReportData {
  route: {
    id: string;
    name: string;
  };
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
  }
};

export default function ReporteFinancieroPage() {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
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
    variables: { routeId: selectedRoute, year: selectedYear },
    skip: !selectedRoute
  });

  const processedData: FinancialReportData | null = reportData?.getFinancialReport || null;

  const handleGenerateReport = () => {
    if (selectedRoute) {
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

  return (
    <PageContainer header="📊 Reporte Financiero - Gastos vs Ganancias">
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
              isDisabled={!selectedRoute || reportLoading}
            >
              {reportLoading ? 'Generando...' : 'Generar Reporte'}
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
                {processedData.route.name} - {processedData.year}
              </h2>
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
                      const data = processedData.data[monthKey];
                      const gastosTotales = (data?.totalExpenses || 0) + (data?.badDebtAmount || 0);
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
                      {annualTotals.totalExpenses && annualTotals.badDebtAmount 
                        ? formatCurrency(annualTotals.totalExpenses + annualTotals.badDebtAmount) 
                        : '-'}
                    </td>
                  </tr>

                  {/* Gastos Operativos */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '32px', backgroundColor: '#fef5e7' }}>
                      ├─ Gastos Operativos
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-data?.generalExpenses || 0) }}>
                          {data?.generalExpenses ? formatCurrency(data.generalExpenses) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Comisiones */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '32px', backgroundColor: '#fef5e7' }}>
                      ├─ Comisiones
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-data?.comissions || 0) }}>
                          {data?.comissions ? formatCurrency(data.comissions) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Nómina */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '32px', backgroundColor: '#fef5e7' }}>
                      ├─ Nómina
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-data?.nomina || 0) }}>
                          {data?.nomina ? formatCurrency(data.nomina) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Gasolina */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '32px', backgroundColor: '#fef5e7' }}>
                      ├─ Gasolina
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-data?.totalGasolina || 0) }}>
                          {data?.totalGasolina ? formatCurrency(data.totalGasolina) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Gasolina TOKA */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '48px', backgroundColor: '#fef5e7' }}>
                      ├─ TOKA
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-data?.tokaGasolina || 0) }}>
                          {data?.tokaGasolina ? formatCurrency(data.tokaGasolina) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Gasolina Efectivo */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '48px', backgroundColor: '#fef5e7' }}>
                      └─ Efectivo
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef5e7', ...getValueColor(-data?.cashGasolina || 0) }}>
                          {data?.cashGasolina ? formatCurrency(data.cashGasolina) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Deuda Mala */}
                  <tr style={{ backgroundColor: '#fef5e7' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '32px', backgroundColor: '#fef5e7' }}>
                      └─ Deuda Mala
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ 
                          ...styles.td, 
                          backgroundColor: '#fef5e7', 
                          ...getValueColor(-data?.badDebtAmount || 0),
                          color: data?.badDebtAmount > 0 ? '#d32f2f' : '#666'
                        }}>
                          {data?.badDebtAmount ? formatCurrency(data.badDebtAmount) : '-'}
                        </td>
                      );
                    })}
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
                  <tr style={{ backgroundColor: '#f0f7ff' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '32px', backgroundColor: '#f0f7ff' }}>
                      ├─ Ganancia Pura
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#f0f7ff', color: '#22c55e', fontWeight: '600' }}>
                          {data?.profitReturn ? formatCurrency(data.profitReturn) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  <tr style={{ backgroundColor: '#f0f7ff' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '32px', backgroundColor: '#f0f7ff' }}>
                      └─ Capital Devuelto
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#f0f7ff', color: '#3b82f6', fontWeight: '600' }}>
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
                  <tr style={{ backgroundColor: '#fef2f2' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '32px', backgroundColor: '#fef2f2' }}>
                      ├─ Préstamos Otorgados
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: '600' }}>
                          {data?.loanDisbursements ? formatCurrency(data.loanDisbursements) : '-'}
                        </td>
                      );
                    })}
                  </tr>

                  <tr style={{ backgroundColor: '#fef2f2' }}>
                    <td style={{ ...styles.tdFirst, paddingLeft: '32px', backgroundColor: '#fef2f2' }}>
                      └─ Gastos Operativos
                    </td>
                    {processedData.months.map((month, index) => {
                      const monthKey = (index + 1).toString().padStart(2, '0');
                      const data = processedData.data[monthKey];
                      return (
                        <td key={month} style={{ ...styles.td, backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: '600' }}>
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
        {!reportLoading && !processedData && selectedRoute && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '12px',
            color: '#718096'
          }}>
            No hay datos disponibles para el período seleccionado
          </div>
        )}
      </div>
    </PageContainer>
  );
} 