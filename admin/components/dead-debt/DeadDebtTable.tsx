import React from 'react';
import { DeadDebtLoan } from '../../types/dead-debt';

interface DeadDebtTableProps {
  loans: DeadDebtLoan[];
  selectedLoans: string[];
  onSelectLoan: (loanId: string) => void;
  onSelectAll: () => void;
  isLoading: boolean;
}

export default function DeadDebtTableComponent({
  loans,
  selectedLoans,
  onSelectLoan,
  onSelectAll,
  isLoading
}: DeadDebtTableProps) {
  if (isLoading) {
    return (
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Créditos Elegibles</h2>
        <div style={{ textAlign: 'center', color: '#666' }}>
          Cargando créditos...
        </div>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Créditos Elegibles</h2>
        <div style={{ textAlign: 'center', color: '#666' }}>
          No se encontraron créditos que cumplan con los criterios seleccionados.
        </div>
      </div>
    );
  }

  const allSelected = selectedLoans.length === loans.length && loans.length > 0;
  const someSelected = selectedLoans.length > 0 && selectedLoans.length < loans.length;

  const getLocalityName = (loan: DeadDebtLoan): string => {
    return loan.lead.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
  };

  return (
    <div style={{ 
      backgroundColor: 'white', 
      border: '1px solid #ddd', 
      borderRadius: '8px', 
      padding: '2rem',
      marginBottom: '2rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0', color: '#333' }}>
          Créditos Elegibles ({loans.length})
        </h2>
        <button
          onClick={onSelectAll}
          style={{
            backgroundColor: allSelected ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {allSelected ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
        </button>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6', width: '50px' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={onSelectAll}
                />
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Cliente</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Líder</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Localidad</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #dee2e6' }}>Monto Pendiente</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Semanas Crédito</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Sin Pago</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan, index) => {
              const isSelected = selectedLoans.includes(loan.id);
              const localityName = getLocalityName(loan);
              
              return (
                <tr 
                  key={loan.id} 
                  style={{ 
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: isSelected ? '#e3f2fd' : 'white',
                    transition: 'background-color 0.2s ease'
                  }}
                >
                  <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectLoan(loan.id)}
                    />
                  </td>
                  <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#333' }}>
                        {loan.borrower.fullName}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                        {loan.borrower.clientCode}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>
                    <div style={{ fontWeight: '500' }}>
                      {loan.lead.fullName}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>
                    <div style={{ 
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      color: '#495057'
                    }}>
                      {localityName}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #dee2e6' }}>
                    <div style={{ fontWeight: '500', color: '#dc3545' }}>
                      ${loan.pendingAmountStored.toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                    <div style={{ 
                      padding: '0.25rem 0.5rem',
                      backgroundColor: loan.weeksSinceLoan >= 20 ? '#dc3545' : loan.weeksSinceLoan >= 15 ? '#ffc107' : '#28a745',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}>
                      {loan.weeksSinceLoan}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                    <div style={{ 
                      padding: '0.25rem 0.5rem',
                      backgroundColor: loan.weeksWithoutPayment >= 6 ? '#dc3545' : loan.weeksWithoutPayment >= 4 ? '#ffc107' : '#28a745',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}>
                      {loan.weeksWithoutPayment}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                    {loan.badDebtDate ? (
                      <div style={{ 
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>
                        Cartera Muerta
                      </div>
                    ) : (
                      <div style={{ 
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>
                        Activo
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedLoans.length > 0 && (
        <div style={{ 
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          border: '1px solid #bbdefb'
        }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>{selectedLoans.length}</strong> créditos seleccionados
            </div>
            <div style={{ color: '#1565c0' }}>
              Total: ${loans
                .filter(loan => selectedLoans.includes(loan.id))
                .reduce((sum, loan) => sum + loan.pendingAmountStored, 0)
                .toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

