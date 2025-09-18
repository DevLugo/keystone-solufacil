import React from 'react';
import { DeadDebtSummary as DeadDebtSummaryType } from '../../types/dead-debt';

interface DeadDebtSummaryProps {
  summary: DeadDebtSummaryType[];
  isLoading: boolean;
}

export default function DeadDebtSummaryComponent({ summary, isLoading }: DeadDebtSummaryProps) {
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
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Resumen por Localidad</h2>
        <div style={{ textAlign: 'center', color: '#666' }}>
          Cargando resumen...
        </div>
      </div>
    );
  }

  if (summary.length === 0) {
    return (
      <div style={{ 
        backgroundColor: 'white', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Resumen por Localidad</h2>
        <div style={{ textAlign: 'center', color: '#666' }}>
          No se encontraron créditos que cumplan con los criterios seleccionados.
        </div>
      </div>
    );
  }

  const totalLoans = summary.reduce((sum, item) => sum + item.loanCount, 0);
  const totalAmount = summary.reduce((sum, item) => sum + item.totalAmount, 0);

  return (
    <div style={{ 
      backgroundColor: 'white', 
      border: '1px solid #ddd', 
      borderRadius: '8px', 
      padding: '2rem',
      marginBottom: '2rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Resumen por Localidad</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {summary.map((item, index) => (
          <div key={index} style={{ 
            padding: '1.5rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #e9ecef',
            transition: 'transform 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          >
            <h3 style={{ 
              margin: '0 0 1rem 0', 
              color: '#495057',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}>
              {item.locality}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  color: '#007bff',
                  marginBottom: '0.25rem'
                }}>
                  {item.loanCount}
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6c757d',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Créditos
                </div>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  color: '#28a745',
                  marginBottom: '0.25rem'
                }}>
                  ${item.totalAmount.toLocaleString()}
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6c757d',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Monto
                </div>
              </div>
            </div>

            <div style={{ 
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ 
                fontSize: '0.875rem', 
                color: '#6c757d',
                textAlign: 'center'
              }}>
                Promedio: ${item.loanCount > 0 ? (item.totalAmount / item.loanCount).toLocaleString() : '0'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total General */}
      <div style={{ 
        padding: '1.5rem', 
        backgroundColor: '#e3f2fd', 
        borderRadius: '8px',
        border: '1px solid #bbdefb'
      }}>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          color: '#1565c0',
          fontSize: '1.2rem',
          fontWeight: '600'
        }}>
          Total General
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#0d47a1',
              marginBottom: '0.5rem'
            }}>
              {totalLoans}
            </div>
            <div style={{ 
              fontSize: '1rem', 
              color: '#1565c0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '500'
            }}>
              Total Créditos
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#0d47a1',
              marginBottom: '0.5rem'
            }}>
              ${totalAmount.toLocaleString()}
            </div>
            <div style={{ 
              fontSize: '1rem', 
              color: '#1565c0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '500'
            }}>
              Monto Total
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#0d47a1',
              marginBottom: '0.5rem'
            }}>
              ${totalLoans > 0 ? (totalAmount / totalLoans).toLocaleString() : '0'}
            </div>
            <div style={{ 
              fontSize: '1rem', 
              color: '#1565c0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '500'
            }}>
              Promedio por Crédito
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

