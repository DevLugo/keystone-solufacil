import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_DEAD_DEBT_LOANS, GET_DEAD_DEBT_SUMMARY, GET_DEAD_DEBT_BY_MONTH, GET_ROUTES } from '../graphql/queries/dead-debt';
import { MARK_LOANS_DEAD_DEBT } from '../graphql/mutations/dead-debt';
import { DeadDebtFilters, DeadDebtLoan, DeadDebtSummary, Route, MarkDeadDebtResult } from '../types/dead-debt';
import DeadDebtFiltersComponent from '../components/dead-debt/DeadDebtFilters';
import DeadDebtSummaryComponent from '../components/dead-debt/DeadDebtSummary';
import DeadDebtTableComponent from '../components/dead-debt/DeadDebtTable';
import DeadDebtConfirmationModal from '../components/dead-debt/DeadDebtConfirmationModal';

export default function CarteraMuertaPage() {
  const [filters, setFilters] = useState<DeadDebtFilters>({
    weeksSinceLoan: 17,
    weeksWithoutPayment: 4,
    routeId: undefined,
    month: undefined,
    year: undefined
  });
  
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'eligible' | 'existing'>('eligible');

  // Queries
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);
  
  const { data: eligibleLoansData, loading: eligibleLoansLoading, refetch: refetchEligibleLoans } = useQuery(
    GET_DEAD_DEBT_LOANS,
    {
      variables: {
        weeksSinceLoan: filters.weeksSinceLoan,
        weeksWithoutPayment: filters.weeksWithoutPayment,
        routeId: filters.routeId
      },
      skip: viewMode === 'existing' || !filters.weeksSinceLoan || !filters.weeksWithoutPayment
    }
  );

  const { data: eligibleSummaryData, loading: eligibleSummaryLoading } = useQuery(
    GET_DEAD_DEBT_SUMMARY,
    {
      variables: {
        weeksSinceLoan: filters.weeksSinceLoan,
        weeksWithoutPayment: filters.weeksWithoutPayment,
        routeId: filters.routeId
      },
      skip: viewMode === 'existing' || !filters.weeksSinceLoan || !filters.weeksWithoutPayment
    }
  );

  const { data: existingLoansData, loading: existingLoansLoading, refetch: refetchExistingLoans } = useQuery(
    GET_DEAD_DEBT_BY_MONTH,
    {
      variables: {
        month: filters.month || new Date().getMonth() + 1,
        year: filters.year || new Date().getFullYear()
      },
      skip: viewMode === 'eligible' || !filters.month || !filters.year
    }
  );

  // Mutations
  const [markLoansDeadDebt, { loading: markDeadDebtLoading }] = useMutation(MARK_LOANS_DEAD_DEBT);

  const routes: Route[] = routesData?.routes || [];
  const loans: DeadDebtLoan[] = viewMode === 'eligible' 
    ? eligibleLoansData?.loansForDeadDebt || []
    : existingLoansData?.deadDebtByMonth?.flatMap((item: any) => item.loans) || [];
  
  const summary: DeadDebtSummary[] = viewMode === 'eligible'
    ? eligibleSummaryData?.deadDebtSummary || []
    : existingLoansData?.deadDebtByMonth || [];

  const isLoading = eligibleLoansLoading || eligibleSummaryLoading || existingLoansLoading || markDeadDebtLoading;

  // Auto-switch view mode based on filters
  useEffect(() => {
    if (filters.month && filters.year) {
      setViewMode('existing');
    } else {
      setViewMode('eligible');
    }
  }, [filters.month, filters.year]);

  const handleFiltersChange = (newFilters: DeadDebtFilters) => {
    setFilters(newFilters);
    setSelectedLoans([]);
    setError(null);
    setSuccess(null);
  };

  const handleUpdate = () => {
    if (viewMode === 'eligible') {
      refetchEligibleLoans();
    } else {
      refetchExistingLoans();
    }
    setSelectedLoans([]);
    setError(null);
    setSuccess(null);
  };

  const handleSelectLoan = (loanId: string) => {
    setSelectedLoans(prev => 
      prev.includes(loanId) 
        ? prev.filter(id => id !== loanId)
        : [...prev, loanId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLoans.length === loans.length && loans.length > 0) {
      setSelectedLoans([]);
    } else {
      setSelectedLoans(loans.map(loan => loan.id));
    }
  };

  const handleMarkAsDeadDebt = () => {
    if (selectedLoans.length === 0) {
      setError('Selecciona al menos un crédito para marcar como cartera muerta');
      return;
    }
    setShowConfirmationModal(true);
  };

  const handleConfirmMarkDeadDebt = async (badDebtDate: string) => {
    try {
      const result = await markLoansDeadDebt({
        variables: {
          loanIds: selectedLoans,
          badDebtDate
        }
      });

      const mutationResult: MarkDeadDebtResult = result.data.markLoansDeadDebt;
      
      if (mutationResult.success) {
        setSuccess(`${mutationResult.updatedCount} créditos marcados como cartera muerta exitosamente.`);
        setSelectedLoans([]);
        setShowConfirmationModal(false);
        handleUpdate();
      } else {
        setError(mutationResult.message || 'Error al marcar créditos como cartera muerta');
      }
    } catch (err: any) {
      console.error('Error al marcar créditos:', err);
      setError(err.message || 'Error al marcar créditos como cartera muerta');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: '#1a1a1a' }}>Cartera Muerta</h1>
      
      {/* Alertas */}
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

      {/* Filtros */}
      <DeadDebtFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
        routes={routes}
        isLoading={isLoading}
        onUpdate={handleUpdate}
      />

      {/* Resumen por localidad */}
      <DeadDebtSummaryComponent
        summary={summary}
        isLoading={isLoading}
      />

      {/* Tabla de créditos */}
      <DeadDebtTableComponent
        loans={loans}
        selectedLoans={selectedLoans}
        onSelectLoan={handleSelectLoan}
        onSelectAll={handleSelectAll}
        isLoading={isLoading}
      />

      {/* Botones de acción */}
      {loans.length > 0 && viewMode === 'eligible' && (
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Acciones</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleMarkAsDeadDebt}
              disabled={isLoading || selectedLoans.length === 0}
              style={{
                backgroundColor: (isLoading || selectedLoans.length === 0) ? '#6c757d' : '#dc3545',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '4px',
                cursor: (isLoading || selectedLoans.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {isLoading ? 'Procesando...' : `Marcar ${selectedLoans.length} como Cartera Muerta`}
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      <DeadDebtConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={handleConfirmMarkDeadDebt}
        selectedLoans={loans.filter(loan => selectedLoans.includes(loan.id))}
        isLoading={markDeadDebtLoading}
      />

      {/* Instrucciones cuando no hay datos */}
      {loans.length === 0 && !isLoading && (
        <div style={{ 
          backgroundColor: 'white', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Instrucciones</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            {viewMode === 'eligible' 
              ? 'Configura los criterios y haz clic en "Actualizar" para buscar créditos elegibles para cartera muerta.'
              : 'Selecciona un mes y año para ver los créditos ya marcados como cartera muerta.'
            }
          </p>
          <ul style={{ marginBottom: '1.5rem', color: '#666', paddingLeft: '1.5rem' }}>
            <li><strong>Semanas desde el crédito:</strong> Mínimo de semanas transcurridas desde que se otorgó el crédito</li>
            <li><strong>Semanas sin pago:</strong> Mínimo de semanas consecutivas sin realizar pagos</li>
            <li><strong>Ruta:</strong> Filtrar por ruta específica (opcional)</li>
            <li><strong>Ver cartera muerta del mes:</strong> Ver créditos ya marcados como cartera muerta en un mes específico</li>
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
              {viewMode === 'eligible' 
                ? `Créditos con más de ${filters.weeksSinceLoan} semanas desde el crédito y ${filters.weeksWithoutPayment} semanas sin pago`
                : `Cartera muerta del ${filters.month}/${filters.year}`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}