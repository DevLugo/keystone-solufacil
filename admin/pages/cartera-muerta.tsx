import React, { useState } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { Select } from '@keystone-ui/fields';
import { GET_LEADS_SIMPLE, GET_ROUTES_SIMPLE } from '../graphql/queries/routes-optimized';

interface DeadDebtLoan {
  id: string;
  requestedAmount: number;
  amountGived: number;
  signDate: string;
  pendingAmountStored: number;
  badDebtCandidate?: number;
  badDebtDate?: string | null;
  borrower: {
    fullName: string;
    clientCode: string;
  };
  lead: {
    fullName: string;
    locality: {
      name: string;
    };
  };
  weeksSinceLoan: number;
  weeksWithoutPayment: number;
}

interface DeadDebtSummary {
  locality: string;
  loanCount: number;
  totalAmount: number;
}

export default function CarteraMuertaPage() {
  const [weeksSinceLoanMin, setWeeksSinceLoanMin] = useState<number | null>(null);
  const [weeksSinceLoanMax, setWeeksSinceLoanMax] = useState<number | null>(null);
  const [weeksWithoutPaymentMin, setWeeksWithoutPaymentMin] = useState<number | null>(null);
  const [weeksWithoutPaymentMax, setWeeksWithoutPaymentMax] = useState<number | null>(null);
  const [routeId, setRouteId] = useState<string>('');
  const [localities, setLocalities] = useState<string[]>([]);
  const [selectedRouteOption, setSelectedRouteOption] = useState<any | null>(null);
  const [selectedLocalityOptions, setSelectedLocalityOptions] = useState<any[]>([]);
  const [badDebtStatus, setBadDebtStatus] = useState<'ALL' | 'MARKED' | 'UNMARKED'>('UNMARKED');
  const [expandedLocality, setExpandedLocality] = useState<string | null>(null);
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(false);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthlyFromDate, setMonthlyFromDate] = useState<string>('');
  const [monthlyToDate, setMonthlyToDate] = useState<string>('');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedMonthRouteFilter, setExpandedMonthRouteFilter] = useState<string>('');
  const [selectedMonthlyLoans, setSelectedMonthlyLoans] = useState<string[]>([]);
  const [isCopying, setIsCopying] = useState(false);

  // Cargar rutas y leads como en RouteLeadSelector
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES_SIMPLE, {
    variables: { where: {} },
    fetchPolicy: 'network-only'
  });
  const [getLeads, { data: leadsData, loading: leadsLoading }] = useLazyQuery(GET_LEADS_SIMPLE);

  const routeOptions = (routesData?.routes || []).map((route: any) => ({
    label: route.name,
    value: route.id,
    data: route
  }));

  const leads = (leadsData?.employees || []) as any[];
  const localityOptions = Array.from(new Set(
    leads.map(l => l?.personalData?.addresses?.[0]?.location?.name).filter(Boolean)
  )).map((name: string) => ({ label: name, value: name }));
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loans, setLoans] = useState<DeadDebtLoan[]>([]);
  const [summary, setSummary] = useState<DeadDebtSummary[]>([]);
  const [hasData, setHasData] = useState(false);

  // Función para copiar tabla como imagen
  const copyTableAsImage = async (containerId: string) => {
    try {
      setIsCopying(true);
      const container = document.getElementById(containerId);
      if (!container) {
        setError('No se encontró el contenedor para copiar');
        setIsCopying(false);
        return;
      }

      // Crear un contenedor temporal fuera del DOM para capturar todo el contenido
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '100%';
      tempContainer.style.backgroundColor = '#f8f9fa';
      tempContainer.style.padding = '1rem';
      tempContainer.style.border = '1px solid #dee2e6';
      
      // Clonar el contenido completo
      const clonedContent = container.cloneNode(true) as HTMLElement;
      
      // Quitar todos los estilos de scroll del clon
      clonedContent.style.maxHeight = 'none';
      clonedContent.style.overflow = 'visible';
      clonedContent.style.height = 'auto';
      
      // Quitar scroll y sticky de todos los elementos internos
      const scrollableElements = clonedContent.querySelectorAll('*');
      scrollableElements.forEach(element => {
        const el = element as HTMLElement;
        if (el.style.maxHeight) el.style.maxHeight = 'none';
        if (el.style.overflow) el.style.overflow = 'visible';
        if (el.style.height && el.style.height.includes('px')) el.style.height = 'auto';
        if (el.style.position === 'sticky') el.style.position = 'static';
      });
      
      // Agregar el clon al elemento temporal
      tempContainer.appendChild(clonedContent);
      document.body.appendChild(tempContainer);
      
      // Esperar un momento para que se renderice
      await new Promise(resolve => setTimeout(resolve, 200));

      // Usar html2canvas para convertir el contenedor temporal a imagen
      const { default: html2canvas } = await import('html2canvas');
      
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: '#ffffff',
        scale: 2, // Mayor resolución
        useCORS: true,
        allowTaint: true,
        width: tempContainer.scrollWidth,
        height: tempContainer.scrollHeight
      });
      
      // Limpiar el elemento temporal
      document.body.removeChild(tempContainer);

      // Convertir canvas a blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                'image/png': blob
              })
            ]);
            setSuccess('✅ Tabla copiada como imagen al portapapeles');
            setTimeout(() => setSuccess(null), 3000);
          } catch (err) {
            // Fallback: descargar la imagen
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `creditos-${expandedMonth || 'mes'}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setSuccess('✅ Imagen descargada (copia al portapapeles no disponible)');
            setTimeout(() => setSuccess(null), 3000);
          }
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error al copiar tabla:', error);
      setError('Error al copiar la tabla como imagen');
    } finally {
      setIsCopying(false);
    }
  };

  // Funciones para manejar selección de créditos mensuales
  const handleMonthlyLoanSelect = (loanId: string) => {
    setSelectedMonthlyLoans(prev => 
      prev.includes(loanId) 
        ? prev.filter(id => id !== loanId)
        : [...prev, loanId]
    );
  };

  const handleSelectAllMonthlyLoans = (loans: any[]) => {
    const allLoanIds = loans.map(loan => loan.id);
    setSelectedMonthlyLoans(prev => 
      prev.length === allLoanIds.length ? [] : allLoanIds
    );
  };

  const getSelectedMonthlyLoansTotal = (month: any) => {
    const filteredLoans = month.loans.filter((loan: any) => {
      if (!expandedMonthRouteFilter) return true;
      return loan.lead?.route === expandedMonthRouteFilter;
    });
    
    const selectedLoans = filteredLoans.filter((loan: any) => 
      selectedMonthlyLoans.includes(loan.id)
    );
    
    const totalDeuda = selectedLoans.reduce((sum: number, loan: any) => sum + (loan.pendingAmountStored || 0), 0);
    const totalCarteraMuerta = selectedLoans.reduce((sum: number, loan: any) => sum + (loan.badDebtCandidate || 0), 0);
    
    return { totalDeuda, totalCarteraMuerta, count: selectedLoans.length };
  };

  const handleMarkAsDeadDebt = async () => {
    if (selectedLoans.length === 0) {
      setError('Selecciona al menos un crédito para marcar como cartera muerta');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Hacer mutación GraphQL real a la base de datos
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation MarkLoansDeadDebt($loanIds: [ID!]!, $deadDebtDate: String!) {
              markLoansDeadDebt(loanIds: $loanIds, deadDebtDate: $deadDebtDate)
            }
          `,
          variables: {
            loanIds: selectedLoans,
            deadDebtDate: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      // Parsear el resultado de la mutación
      const mutationResult = JSON.parse(result.data.markLoansDeadDebt);
      
      const currentDate = new Date().toISOString().split('T')[0];
      console.log(`Marcando como cartera muerta: ${selectedLoans.join(', ')} con fecha ${currentDate}`);
      setSuccess(`${mutationResult.updatedCount || selectedLoans.length} créditos marcados como cartera muerta exitosamente.`);
      setSelectedLoans([]); // Clear selection after marking
      
      // Re-fetch loans to update the list
      handleUpdate();
    } catch (err: any) {
      console.error('Error al marcar créditos:', err);
      setError(err.message || 'Error al marcar créditos como cartera muerta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedLoans.length === 0) {
      setSelectedLoans(loans.map(loan => loan.id));
    } else {
      setSelectedLoans([]);
    }
  };

  const handleUpdate = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Hacer consulta GraphQL real a la base de datos
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetLoansForDeadDebt($weeksSinceLoanMin: Int, $weeksSinceLoanMax: Int, $weeksWithoutPaymentMin: Int, $weeksWithoutPaymentMax: Int, $routeId: String, $localities: [String!], $badDebtStatus: String) {
              loansForDeadDebt(weeksSinceLoanMin: $weeksSinceLoanMin, weeksSinceLoanMax: $weeksSinceLoanMax, weeksWithoutPaymentMin: $weeksWithoutPaymentMin, weeksWithoutPaymentMax: $weeksWithoutPaymentMax, routeId: $routeId, localities: $localities, badDebtStatus: $badDebtStatus)
              deadDebtSummary(weeksSinceLoanMin: $weeksSinceLoanMin, weeksSinceLoanMax: $weeksSinceLoanMax, weeksWithoutPaymentMin: $weeksWithoutPaymentMin, weeksWithoutPaymentMax: $weeksWithoutPaymentMax, routeId: $routeId, localities: $localities, badDebtStatus: $badDebtStatus)
            }
          `,
          variables: {
            weeksSinceLoanMin,
            weeksSinceLoanMax,
            weeksWithoutPaymentMin,
            weeksWithoutPaymentMax,
            routeId: routeId || null,
            // Si hay ruta pero ninguna localidad seleccionada, enviar [] para que el backend devuelva vacío
            localities: routeId ? localities : null,
            badDebtStatus
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      // Parsear los datos JSON de la respuesta
      const loansResponse = JSON.parse(result.data.loansForDeadDebt) as { loans: DeadDebtLoan[], summary: { totalLoans: number, totalBadDebtCandidate: number, localities: string[] } };
      const summaryData = JSON.parse(result.data.deadDebtSummary) as DeadDebtSummary[];

      setLoans(loansResponse.loans);
      setSummary(summaryData);
      setHasData(true);
      setSuccess(`Se encontraron ${loansResponse.loans.length} créditos elegibles para cartera muerta. Total estimado: $${loansResponse.summary.totalBadDebtCandidate.toLocaleString()}`);
    } catch (err: any) {
      console.error('Error al cargar créditos:', err);
      setError('Error al cargar los datos: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMonthlyData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query DeadDebtMonthlySummary($routeId: String, $localities: [String!], $year: Int!, $weeksSinceLoanMin: Int, $weeksSinceLoanMax: Int, $weeksWithoutPaymentMin: Int, $weeksWithoutPaymentMax: Int, $badDebtStatus: String, $fromDate: String, $toDate: String) {
              deadDebtMonthlySummary(routeId: $routeId, localities: $localities, year: $year, weeksSinceLoanMin: $weeksSinceLoanMin, weeksSinceLoanMax: $weeksSinceLoanMax, weeksWithoutPaymentMin: $weeksWithoutPaymentMin, weeksWithoutPaymentMax: $weeksWithoutPaymentMax, badDebtStatus: $badDebtStatus, fromDate: $fromDate, toDate: $toDate)
            }
          `,
          variables: {
            routeId: routeId,
            localities: localities.length > 0 ? localities : null,
            year: selectedYear,
            weeksSinceLoanMin,
            weeksSinceLoanMax,
            weeksWithoutPaymentMin,
            weeksWithoutPaymentMax,
            badDebtStatus,
            fromDate: monthlyFromDate || null,
            toDate: monthlyToDate || null
          }
        })
      });

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const data = JSON.parse(result.data.deadDebtMonthlySummary);
      setMonthlyData(data);
      setShowMonthlyBreakdown(true);
    } catch (err: any) {
      console.error('Error al cargar datos mensuales:', err);
      setError('Error al cargar datos mensuales: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: '#1a1a1a' }}>Cartera Muerta</h1>
      
      {error && (
        <div style={{ 
          backgroundColor: '#fee', 
          border: '1px solid #fcc', 
          color: '#c33', 
          padding: '1rem', 
          borderRadius: '4px', 
          marginBottom: '1rem' 
        }}>
          {error}
        </div>
      )}
      
      {success && (
        <div style={{ 
          backgroundColor: '#efe', 
          border: '1px solid #cfc', 
          color: '#3c3', 
          padding: '1rem', 
          borderRadius: '4px', 
          marginBottom: '1rem' 
        }}>
          {success}
        </div>
      )}

      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '2rem', 
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Configuración</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Semanas desde el crédito (mínimo):
            </label>
            <input
              type="number"
              value={weeksSinceLoanMin || ''}
              onChange={(e) => setWeeksSinceLoanMin(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Ej: 17"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Semanas desde el crédito (máximo):
            </label>
            <input
              type="number"
              value={weeksSinceLoanMax || ''}
              onChange={(e) => setWeeksSinceLoanMax(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Ej: 52"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Semanas sin pago (mínimo):
            </label>
            <input
              type="number"
              value={weeksWithoutPaymentMin || ''}
              onChange={(e) => setWeeksWithoutPaymentMin(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Ej: 4"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Semanas sin pago (máximo):
            </label>
            <input
              type="number"
              value={weeksWithoutPaymentMax || ''}
              onChange={(e) => setWeeksWithoutPaymentMax(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Ej: 12"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Es cartera muerta:
            </label>
            <Select
              value={{ label: badDebtStatus === 'ALL' ? 'Todos' : badDebtStatus === 'MARKED' ? 'Marcados' : 'No marcados', value: badDebtStatus }}
              onChange={(opt: any) => setBadDebtStatus((opt?.value || 'UNMARKED') as any)}
              options={[
                { label: 'Todos', value: 'ALL' },
                { label: 'Marcados', value: 'MARKED' },
                { label: 'No marcados', value: 'UNMARKED' }
              ]}
              placeholder="Seleccionar estado"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Ruta (opcional):
            </label>
            <Select
              value={selectedRouteOption}
              onChange={(opt: any) => {
                setSelectedRouteOption(opt);
                const id = opt?.value || '';
                setRouteId(id);
                setSelectedLocalityOptions([]);
                setLocalities([]);
                if (id) getLeads({ variables: { routeId: id } });
              }}
              options={routeOptions}
              placeholder={routesLoading ? 'Cargando rutas...' : 'Seleccionar ruta'}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Localidades (opcional):
            </label>
            {!routeId ? (
              <div style={{ color: '#6c757d', fontSize: '13px' }}>Selecciona primero una ruta</div>
            ) : leadsLoading ? (
              <div style={{ color: '#6c757d', fontSize: '13px' }}>Cargando localidades…</div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '8px',
                maxHeight: '180px',
                overflowY: 'auto'
              }}>
                {localityOptions.map(opt => {
                  const checked = localities.includes(opt.value);
                  return (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setLocalities([...localities, opt.value]);
                          } else {
                            setLocalities(localities.filter(v => v !== opt.value));
                          }
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
                {localityOptions.length === 0 && (
                  <div style={{ color: '#6c757d', fontSize: '13px' }}>No hay localidades para esta ruta</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={handleUpdate}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isLoading ? 'Cargando...' : 'Actualizar'}
          </button>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>Desde:</label>
              <input
                type="date"
                value={monthlyFromDate}
                onChange={(e) => setMonthlyFromDate(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>Hasta:</label>
              <input
                type="date"
                value={monthlyToDate}
                onChange={(e) => setMonthlyToDate(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <button
              onClick={handleLoadMonthlyData}
              disabled={isLoading}
              style={{
                backgroundColor: isLoading ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📅 Ver Desglose Mensual
            </button>
          </div>
        </div>
      </div>

          {/* Desglose Mensual */}
          {showMonthlyBreakdown && monthlyData && (
            <div style={{ 
              backgroundColor: 'white', 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: '0', color: '#333' }}>Desglose Mensual - {monthlyData.year}</h2>
                <button
                  onClick={() => setShowMonthlyBreakdown(false)}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ✕ Cerrar
                </button>
              </div>
              
              {/* Criterios aplicados */}
              <div style={{ 
                backgroundColor: '#fff3cd', 
                border: '1px solid #ffeaa7', 
                borderRadius: '8px', 
                padding: '1rem', 
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#856404' }}>📋 Criterios de Evaluación</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.875rem' }}>
                  <div>
                    <strong>Ruta:</strong> {routeId ? 'Seleccionada' : 'Todas las rutas activas'}
                  </div>
                  <div>
                    <strong>Localidades:</strong> {localities.length > 0 ? localities.join(', ') : 'Todas'}
                  </div>
                  <div>
                    <strong>Semanas desde crédito:</strong> {
                      weeksSinceLoanMin && weeksSinceLoanMax 
                        ? `${weeksSinceLoanMin}-${weeksSinceLoanMax}`
                        : weeksSinceLoanMin 
                          ? `≥${weeksSinceLoanMin}`
                          : weeksSinceLoanMax
                            ? `≤${weeksSinceLoanMax}`
                            : 'Sin filtro'
                    }
                  </div>
                  <div>
                    <strong>Semanas sin pago:</strong> {
                      weeksWithoutPaymentMin && weeksWithoutPaymentMax 
                        ? `${weeksWithoutPaymentMin}-${weeksWithoutPaymentMax}`
                        : weeksWithoutPaymentMin 
                          ? `≥${weeksWithoutPaymentMin}`
                          : weeksWithoutPaymentMax
                            ? `≤${weeksWithoutPaymentMax}`
                            : 'Sin filtro'
                    }
                  </div>
                  <div>
                    <strong>Estado cartera muerta:</strong> {
                      badDebtStatus === 'MARKED' ? 'Marcados' :
                      badDebtStatus === 'UNMARKED' ? 'No marcados' : 'Todos'
                    }
                  </div>
                  <div>
                    <strong>Período de análisis:</strong> {
                      monthlyFromDate && monthlyToDate 
                        ? `${new Date(monthlyFromDate).toLocaleDateString('es-ES')} - ${new Date(monthlyToDate).toLocaleDateString('es-ES')}`
                        : monthlyFromDate 
                          ? `Desde ${new Date(monthlyFromDate).toLocaleDateString('es-ES')}`
                          : monthlyToDate
                            ? `Hasta ${new Date(monthlyToDate).toLocaleDateString('es-ES')}`
                            : 'Todo el año'
                    }
                  </div>
                </div>
                
                {/* Información de rutas incluidas */}
                {monthlyData.routesInfo && monthlyData.routesInfo.length > 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ffeaa7' }}>
                    <div style={{ fontSize: '0.875rem', color: '#856404', marginBottom: '0.5rem' }}>
                      <strong>Rutas incluidas ({monthlyData.routesInfo.length}):</strong>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {monthlyData.routesInfo.map((route: any, index: number) => (
                        <span 
                          key={index}
                          style={{ 
                            backgroundColor: '#f8f9fa', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '4px', 
                            fontSize: '0.75rem',
                            border: '1px solid #dee2e6'
                          }}
                        >
                          {route.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Resumen del año */}
              <div style={{ 
                backgroundColor: '#e3f2fd', 
                border: '1px solid #bbdefb', 
                borderRadius: '8px', 
                padding: '1.5rem', 
                marginBottom: '2rem'
              }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#1565c0' }}>Resumen del Año {monthlyData.year}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Total Créditos</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1565c0' }}>
                      {monthlyData.yearTotals?.totalLoans || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Monto Pendiente</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1565c0' }}>
                      ${(monthlyData.yearTotals?.totalPendingAmount || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Cartera Muerta</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#d32f2f' }}>
                      ${(monthlyData.yearTotals?.totalBadDebtCandidate || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Tabla mensual */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Mes</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Período de Evaluación</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Créditos</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #dee2e6' }}>Monto Pendiente</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #dee2e6' }}>Cartera Muerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(monthlyData.monthlySummary || []).map((month: any, index: number) => {
                      const monthKey = `${month.month.year}-${month.month.month}`;
                      const isExpanded = expandedMonth === monthKey;
                      
                      return (
                        <React.Fragment key={index}>
                          <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                            <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>
                              <div style={{ fontWeight: '500' }}>{month.month.name}</div>
                              <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                                {new Date(month.month.startDate).toLocaleDateString()} - {new Date(month.month.endDate).toLocaleDateString()}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>
                              <div style={{ fontSize: '0.875rem', color: '#495057', fontWeight: '500' }}>
                                Desde: {new Date(month.evaluationPeriod?.from || month.month.startDate).toLocaleDateString('es-ES')}
                              </div>
                              <div style={{ fontSize: '0.875rem', color: '#495057', fontWeight: '500' }}>
                                Hasta: {new Date(month.evaluationPeriod?.to || month.month.endDate).toLocaleDateString('es-ES')}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem' }}>
                                Criterios: {
                                  month.criteria?.weeksSinceLoanMin && `≥${month.criteria.weeksSinceLoanMin} sem. desde crédito`
                                }
                                {month.criteria?.weeksWithoutPaymentMin && `, ≥${month.criteria.weeksWithoutPaymentMin} sem. sin pago`}
                                {month.criteria?.badDebtStatus && `, ${month.criteria.badDebtStatus === 'MARKED' ? 'Marcados' : 'No marcados'}`}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                              <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{month.summary.totalLoans}</div>
                              <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>créditos</div>
                              {month.loans && month.loans.length > 0 && (
                                <div 
                                  onClick={() => setExpandedMonth(isExpanded ? null : monthKey)}
                                  style={{ 
                                    fontSize: '0.75rem', 
                                    color: '#0d6efd', 
                                    cursor: 'pointer', 
                                    marginTop: '0.25rem',
                                    textDecoration: 'underline'
                                  }}
                                >
                                  {isExpanded ? 'Ocultar créditos' : 'Ver créditos'}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #dee2e6' }}>
                              ${month.summary.totalPendingAmount.toLocaleString()}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #dee2e6', color: '#d32f2f', fontWeight: '500' }}>
                              ${month.summary.totalBadDebtCandidate.toLocaleString()}
                            </td>
                          </tr>
                          
                          {/* Fila expandida con detalles de créditos */}
                          {isExpanded && month.loans && month.loans.length > 0 && (
                            <tr>
                              <td colSpan={5} style={{ padding: '0', border: 'none' }}>
                                 <div id={`credits-container-${monthKey}`} style={{ 
                                   backgroundColor: '#f8f9fa', 
                                   padding: '1rem', 
                                   border: '1px solid #dee2e6',
                                   borderTop: 'none',
                                   maxHeight: '500px',
                                   overflowY: 'auto'
                                 }}>
                                  {/* Resumen total */}
                                  {(() => {
                                    const filteredLoans = month.loans.filter((loan: any) => {
                                      if (!expandedMonthRouteFilter) return true;
                                      return loan.lead?.route === expandedMonthRouteFilter;
                                    });
                                    
                                    const totalDeuda = filteredLoans.reduce((sum: number, loan: any) => sum + (loan.pendingAmountStored || 0), 0);
                                    const totalCarteraMuerta = filteredLoans.reduce((sum: number, loan: any) => sum + (loan.badDebtCandidate || 0), 0);
                                    const totalClientes = new Set(filteredLoans.map((loan: any) => loan.borrower?.clientCode).filter(Boolean)).size;
                                    const totalRutas = new Set(filteredLoans.map((loan: any) => loan.lead?.route).filter(Boolean)).size;
                                    
                                    return (
                                <div style={{ 
                                  backgroundColor: '#f8f9fa', 
                                  padding: '1rem', 
                                        borderRadius: '8px', 
                                        marginBottom: '1rem',
                                  border: '1px solid #dee2e6',
                                        position: 'sticky',
                                        top: '0',
                                        zIndex: 10
                                }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                          <h4 style={{ margin: '0', color: '#495057', fontSize: '1rem' }}>
                                            Créditos de {month.month.name} ({filteredLoans.length} créditos{expandedMonthRouteFilter ? ` - Filtro: ${expandedMonthRouteFilter}` : ''})
                                  </h4>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                          <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc3545' }}>
                                              ${totalDeuda.toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Deuda Total</div>
                                          </div>
                                          <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#d32f2f' }}>
                                              ${totalCarteraMuerta.toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Cartera Muerta</div>
                                          </div>
                                          <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0d6efd' }}>
                                              {totalClientes}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Clientes Únicos</div>
                                          </div>
                                          <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#198754' }}>
                                              {totalRutas}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Rutas</div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  
                                  {/* Resumen de selección */}
                                  {(() => {
                                    const selectedTotals = getSelectedMonthlyLoansTotal(month);
                                    if (selectedTotals.count > 0) {
                                      return (
                                        <div style={{ 
                                          backgroundColor: '#e3f2fd', 
                                          border: '1px solid #bbdefb', 
                                          borderRadius: '8px', 
                                          padding: '1rem', 
                                          marginBottom: '1rem'
                                        }}>
                                          <h5 style={{ margin: '0 0 0.5rem 0', color: '#1565c0' }}>
                                            📋 Seleccionados: {selectedTotals.count} créditos
                                          </h5>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#dc3545' }}>
                                                ${selectedTotals.totalDeuda.toLocaleString()}
                                              </div>
                                              <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Deuda Total</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#d32f2f' }}>
                                                ${selectedTotals.totalCarteraMuerta.toLocaleString()}
                                              </div>
                                              <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Cartera Muerta</div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                  
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div></div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <select
                                        value={expandedMonthRouteFilter}
                                        onChange={(e) => setExpandedMonthRouteFilter(e.target.value)}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          border: '1px solid #ddd',
                                          borderRadius: '4px',
                                          fontSize: '0.875rem'
                                        }}
                                      >
                                        <option value="">Todas las rutas</option>
                                        {routeOptions.map((route: any) => (
                                          <option key={route.value} value={route.label}>
                                            {route.label}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => copyTableAsImage(`credits-container-${monthKey}`)}
                                        disabled={isCopying}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          backgroundColor: isCopying ? '#6c757d' : '#0d6efd',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '0.875rem',
                                          cursor: isCopying ? 'not-allowed' : 'pointer',
                                          opacity: isCopying ? 0.7 : 1
                                        }}
                                        title="Copiar tabla como imagen"
                                      >
                                        {isCopying ? '⏳ Copiando...' : '📋 Copiar'}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <table id={`credits-table-${monthKey}`} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#e9ecef' }}>
                                          <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6', width: '40px' }}>
                                            <input
                                              type="checkbox"
                                              checked={(() => {
                                                const filteredLoans = month.loans.filter((loan: any) => {
                                                  if (!expandedMonthRouteFilter) return true;
                                                  return loan.lead?.route === expandedMonthRouteFilter;
                                                });
                                                return filteredLoans.length > 0 && filteredLoans.every((loan: any) => selectedMonthlyLoans.includes(loan.id));
                                              })()}
                                              onChange={() => handleSelectAllMonthlyLoans(month.loans.filter((loan: any) => {
                                                if (!expandedMonthRouteFilter) return true;
                                                return loan.lead?.route === expandedMonthRouteFilter;
                                              }))}
                                              style={{ transform: 'scale(1.2)' }}
                                            />
                                          </th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Cliente</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Código</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Localidad</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Ruta</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Fecha Creación</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'right', border: '1px solid #dee2e6' }}>Monto Pendiente</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Semanas Crédito</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Sin Pago</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Último Pago</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'right', border: '1px solid #dee2e6' }}>Cartera Muerta</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Fecha Cartera Muerta</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {month.loans
                                          .filter((loan: any) => {
                                            if (!expandedMonthRouteFilter) return true;
                                            return loan.lead?.route === expandedMonthRouteFilter;
                                          })
                                          .map((loan: any, loanIndex: number) => (
                                          <tr key={loanIndex} style={{ borderBottom: '1px solid #dee2e6' }}>
                                            <td style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                              <input
                                                type="checkbox"
                                                checked={selectedMonthlyLoans.includes(loan.id)}
                                                onChange={() => handleMonthlyLoanSelect(loan.id)}
                                                style={{ transform: 'scale(1.2)' }}
                                              />
                                            </td>
                                            <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>
                                              <div style={{ fontWeight: '500' }}>{loan.borrower?.fullName || 'Sin nombre'}</div>
                                            </td>
                                            <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>
                                              <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{loan.borrower?.clientCode || 'Sin código'}</div>
                                            </td>
                                            <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>
                                              <div style={{ fontSize: '0.875rem' }}>{loan.lead?.locality || 'Sin localidad'}</div>
                                            </td>
                                            <td style={{ padding: '0.5rem', border: '1px solid #dee2e6' }}>
                                              <div style={{ fontSize: '0.875rem' }}>{loan.lead?.route || 'Sin ruta'}</div>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                              <div style={{ fontSize: '0.875rem' }}>{loan.signDate ? new Date(loan.signDate).toLocaleDateString() : '-'}</div>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', border: '1px solid #dee2e6' }}>
                                              ${loan.pendingAmountStored.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                              {loan.weeksSinceLoan}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                              {loan.weeksWithoutPayment}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                              {(() => {
                                                if (loan.payments && loan.payments.length > 0) {
                                                  const lastPayment = loan.payments[0]; // Ya están ordenados por fecha descendente
                                                  return lastPayment.receivedAt ? new Date(lastPayment.receivedAt).toLocaleDateString() : '-';
                                                }
                                                return '-';
                                              })()}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', border: '1px solid #dee2e6', color: '#d32f2f', fontWeight: '500' }}>
                                              ${loan.badDebtCandidate.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                              {loan.badDebtDate ? new Date(loan.badDebtDate).toLocaleDateString() : '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lista de créditos */}

      {!hasData && (
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Instrucciones</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Configura los criterios y haz clic en "Actualizar" para buscar créditos elegibles para cartera muerta.
          </p>
          <ul style={{ marginBottom: '1.5rem', color: '#666', paddingLeft: '1.5rem' }}>
            <li><strong>Semanas desde el crédito:</strong> Mínimo de semanas transcurridas desde que se otorgó el crédito</li>
            <li><strong>Semanas sin pago:</strong> Mínimo de semanas sin realizar pagos</li>
          </ul>
          
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #e9ecef', 
            borderRadius: '4px', 
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#495057' }}>Criterios Actuales:</h3>
            <p style={{ margin: '0', color: '#6c757d' }}>
              {`Créditos ${weeksSinceLoanMin != null ? `con >= ${weeksSinceLoanMin} semanas` : ''}${weeksSinceLoanMin != null && weeksSinceLoanMax != null ? ' y ' : ''}${weeksSinceLoanMax != null ? `<= ${weeksSinceLoanMax} semanas` : ''} desde el crédito`}
              {` y ${weeksWithoutPaymentMin != null ? `>= ${weeksWithoutPaymentMin} semanas` : ''}${weeksWithoutPaymentMin != null && weeksWithoutPaymentMax != null ? ' y ' : ''}${weeksWithoutPaymentMax != null ? `<= ${weeksWithoutPaymentMax} semanas` : ''} sin pago`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}