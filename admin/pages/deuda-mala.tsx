import React, { useState, useEffect } from 'react';
import { gql, useLazyQuery } from '@apollo/client';

// Definir el tipo de préstamo para bad debt (datos que vienen del GraphQL resolver)
interface BadDebtLoan {
  id: string;
  clientName: string;
  location: string;
  routeName: string;
  amountOwed: number;
  signDate: string;
  createdAt: string;
  weeksElapsed: number;
  weeksWithoutPayment: number;
  loanType: string;
  weekDuration: number;
  amountGived: number;
  totalDebtAcquired: number;
  totalPaid: number;
}

interface RouteData {
  id: string;
  name: string;
}

// GraphQL query para obtener rutas
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;

// GraphQL query para obtener préstamos que entrarán en bad debt
const GET_BAD_DEBT_CANDIDATES = gql`
  query GetBadDebtCandidates($routeId: String) {
    getBadDebtCandidates(routeId: $routeId)
  }
`;

const BadDebtManagementPage: React.FC = () => {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [badDebtCandidates, setBadDebtCandidates] = useState<BadDebtLoan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [getRoutes, { data: routesData }] = useLazyQuery(GET_ROUTES);
  const [getBadDebtCandidates] = useLazyQuery(GET_BAD_DEBT_CANDIDATES);

  useEffect(() => {
    getRoutes();
  }, [getRoutes]);

  // La lógica de filtrado y cálculos se maneja en el GraphQL resolver

  const handleRouteChange = async (routeId: string) => {
    setSelectedRoute(routeId);
    setIsLoading(true);
    
    try {
      const { data } = await getBadDebtCandidates({
        variables: { routeId: routeId || undefined }
      });
      
      if (data?.getBadDebtCandidates?.loans) {
        setBadDebtCandidates(data.getBadDebtCandidates.loans);
      }
    } catch (error) {
      console.error('Error fetching bad debt candidates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Los préstamos ya vienen filtrados desde el GraphQL resolver
  const loansEnteringBadDebt = badDebtCandidates;

  // Agrupar por localidad
  const groupedByLocation = loansEnteringBadDebt.reduce((acc, loan) => {
    const location = loan.location || 'Sin localidad';
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(loan);
    return acc;
  }, {} as Record<string, any[]>);

  // Función para exportar a PDF
  const exportToPDF = async () => {
    if (loansEnteringBadDebt.length === 0) {
      alert('No hay préstamos que entren en deuda mala para exportar');
      return;
    }

    const routeName = selectedRoute 
      ? routesData?.routes?.find((r: RouteData) => r.id === selectedRoute)?.name 
      : 'Todas las Rutas';

    // Preparar datos para el PDF - los datos ya vienen procesados del GraphQL resolver
    const pdfData = {
      routeName,
      generatedDate: new Date().toISOString(),
      loans: loansEnteringBadDebt
    };

    try {
      const response = await fetch('/export-baddebt-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pdfData),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `reporte_deuda_mala_${routeName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Error al generar PDF:', response.statusText);
        alert('Error al generar el PDF');
      }
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al exportar el PDF');
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '30px',
        borderRadius: '12px',
        marginBottom: '30px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>
          🚨 Gestión de Deuda Mala
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '16px', opacity: 0.9 }}>
          Préstamos que entrarán en bad debt a fin de mes
        </p>
      </div>

      {/* Filtros */}
      <div style={{ 
        background: '#ffffff',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        border: '1px solid #e1e5e9'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '5px', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Filtrar por Ruta:
            </label>
            <select
              value={selectedRoute}
              onChange={(e) => handleRouteChange(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                minWidth: '200px'
              }}
            >
              <option value="">Todas las Rutas</option>
              {routesData?.routes?.map((route: RouteData) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={exportToPDF}
            disabled={loansEnteringBadDebt.length === 0}
            style={{
              background: loansEnteringBadDebt.length > 0 ? '#dc2626' : '#9ca3af',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: loansEnteringBadDebt.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '600',
              marginTop: '20px'
            }}
          >
            📄 Exportar Reporte PDF
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px', 
        marginBottom: '30px' 
      }}>
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#dc2626' }}>
            {loansEnteringBadDebt.length}
          </div>
          <div style={{ fontSize: '14px', color: '#7f1d1d', marginTop: '5px' }}>
            Préstamos entrando en Bad Debt
          </div>
        </div>
        
        <div style={{
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#ea580c' }}>
            {Object.keys(groupedByLocation).length}
          </div>
          <div style={{ fontSize: '14px', color: '#9a3412', marginTop: '5px' }}>
            Localidades Afectadas
          </div>
        </div>

        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#0284c7' }}>
                      {formatCurrency(
            loansEnteringBadDebt.reduce((total, loan) => 
              total + (loan.amountOwed || 0), 0
            )
          )}
          </div>
          <div style={{ fontSize: '14px', color: '#075985', marginTop: '5px' }}>
            Monto Total en Riesgo
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Cargando préstamos...</div>
        </div>
      )}

      {/* Lista por Localidades */}
      {!isLoading && Object.keys(groupedByLocation).length > 0 && (
        <div>
          {Object.entries(groupedByLocation)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([location, loans]) => (
            <div key={location} style={{ 
              marginBottom: '30px',
              background: '#ffffff',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              border: '1px solid #e1e5e9'
            }}>
              <div style={{
                background: '#f8fafc',
                padding: '15px 20px',
                borderBottom: '1px solid #e1e5e9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, color: '#1f2937', fontSize: '18px', fontWeight: '600' }}>
                  📍 {location}
                </h3>
                <span style={{
                  background: '#dc2626',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {loans.length} préstamo{loans.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Cliente</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Monto Adeudado</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Fecha Creación</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Semanas Transcurridas</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Semanas Sin Pago</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Tipo Préstamo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans
                      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                      .map((loan, index) => (
                      <tr key={loan.id} style={{ 
                        background: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                        borderBottom: '1px solid #f3f4f6'
                      }}>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#1f2937' }}>
                          {loan.clientName || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#dc2626' }}>
                          {formatCurrency(loan.amountOwed || 0)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
                          {formatDate(loan.createdAt)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
                          {loan.weeksElapsed || 0}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: '#dc2626' }}>
                          {loan.weeksWithoutPayment || 0}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                          {loan.loanType || 'N/A'} ({loan.weekDuration || 0} sem.)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && loansEnteringBadDebt.length === 0 && badDebtCandidates.length > 0 && (
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          padding: '40px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h3 style={{ color: '#0284c7', margin: '0 0 8px' }}>¡Excelente!</h3>
          <p style={{ color: '#075985', margin: 0 }}>
            No hay préstamos que entren en deuda mala próximamente en la ruta seleccionada.
          </p>
        </div>
      )}

      {!isLoading && badDebtCandidates.length === 0 && selectedRoute && (
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          padding: '40px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ color: '#374151', margin: '0 0 8px' }}>Sin datos</h3>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Selecciona una ruta para ver los préstamos que entrarán en deuda mala.
          </p>
        </div>
      )}
    </div>
  );
};

export default BadDebtManagementPage;