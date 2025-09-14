import React, { useState } from 'react';

interface DeadDebtLoan {
  id: string;
  requestedAmount: number;
  amountGived: number;
  signDate: string;
  pendingAmountStored: number;
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
  const [weeksSinceLoan, setWeeksSinceLoan] = useState(17);
  const [weeksWithoutPayment, setWeeksWithoutPayment] = useState(4);
  const [badDebtDate, setBadDebtDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loans, setLoans] = useState<DeadDebtLoan[]>([]);
  const [summary, setSummary] = useState<DeadDebtSummary[]>([]);
  const [hasData, setHasData] = useState(false);

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
            deadDebtDate: badDebtDate
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
      
      console.log(`Marcando como cartera muerta: ${selectedLoans.join(', ')} con fecha ${badDebtDate}`);
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
            query GetLoansForDeadDebt($weeksSinceLoan: Int!, $weeksWithoutPayment: Int!) {
              loansForDeadDebt(weeksSinceLoan: $weeksSinceLoan, weeksWithoutPayment: $weeksWithoutPayment)
              deadDebtSummary(weeksSinceLoan: $weeksSinceLoan, weeksWithoutPayment: $weeksWithoutPayment)
            }
          `,
          variables: {
            weeksSinceLoan,
            weeksWithoutPayment
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
      const loansData = JSON.parse(result.data.loansForDeadDebt) as DeadDebtLoan[];
      const summaryData = JSON.parse(result.data.deadDebtSummary) as DeadDebtSummary[];

      setLoans(loansData);
      setSummary(summaryData);
      setHasData(true);
      setSuccess(`Se encontraron ${loansData.length} créditos elegibles para cartera muerta`);
    } catch (err: any) {
      console.error('Error al cargar créditos:', err);
      setError('Error al cargar los datos: ' + (err.message || 'Error desconocido'));
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
              Semanas desde el crédito:
            </label>
            <input
              type="number"
              value={weeksSinceLoan}
              onChange={(e) => setWeeksSinceLoan(parseInt(e.target.value) || 0)}
              min="1"
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
              Semanas sin pago:
            </label>
            <input
              type="number"
              value={weeksWithoutPayment}
              onChange={(e) => setWeeksWithoutPayment(parseInt(e.target.value) || 0)}
              min="1"
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
              Fecha de cartera muerta:
            </label>
            <input
              type="date"
              value={badDebtDate}
              onChange={(e) => setBadDebtDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
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
      </div>

      {hasData && (
        <>
          {/* Resumen por localidad */}
          {summary.length > 0 && (
            <div style={{ 
              backgroundColor: 'white', 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Resumen por Localidad</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {summary.map((item, index) => (
                  <div key={index} style={{ 
                    padding: '1rem', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '4px',
                    border: '1px solid #e9ecef'
                  }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>{item.locality}</h3>
                    <p style={{ margin: '0 0 0.25rem 0', color: '#6c757d' }}>
                      <strong>Créditos:</strong> {item.loanCount}
                    </p>
                    <p style={{ margin: '0', color: '#6c757d' }}>
                      <strong>Monto:</strong> ${item.totalAmount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                backgroundColor: '#e3f2fd', 
                borderRadius: '4px',
                border: '1px solid #bbdefb'
              }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#1565c0' }}>Total General</h3>
                <p style={{ margin: '0 0 0.25rem 0', color: '#0d47a1' }}>
                  <strong>Total Créditos:</strong> {summary.reduce((sum, item) => sum + item.loanCount, 0)}
                </p>
                <p style={{ margin: '0', color: '#0d47a1' }}>
                  <strong>Monto Total:</strong> ${summary.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Lista de créditos */}
          {loans.length > 0 && (
            <div style={{ 
              backgroundColor: 'white', 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: '0', color: '#333' }}>Créditos Elegibles ({loans.length})</h2>
                <button
                  onClick={handleSelectAll}
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {selectedLoans.length === 0 ? 'Seleccionar Todos' : 'Deseleccionar Todos'}
                </button>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6' }}>
                        <input
                          type="checkbox"
                          checked={selectedLoans.length === loans.length && loans.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Cliente</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Líder</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #dee2e6' }}>Localidad</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #dee2e6' }}>Monto Pendiente</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Semanas Crédito</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>Sin Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => (
                      <tr key={loan.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>
                          <input
                            type="checkbox"
                            checked={selectedLoans.includes(loan.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLoans([...selectedLoans, loan.id]);
                              } else {
                                setSelectedLoans(selectedLoans.filter(id => id !== loan.id));
                              }
                            }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>
                          <div>
                            <div style={{ fontWeight: '500' }}>{loan.borrower.fullName}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>{loan.borrower.clientCode}</div>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>{loan.lead.fullName}</td>
                        <td style={{ padding: '0.75rem', border: '1px solid #dee2e6' }}>{loan.lead.locality.name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #dee2e6' }}>
                          ${loan.pendingAmountStored.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                          {loan.weeksSinceLoan}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #dee2e6' }}>
                          {loan.weeksWithoutPayment}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          {loans.length > 0 && (
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
        </>
      )}

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
            <li><strong>Fecha de cartera muerta:</strong> Fecha que se asignará al marcar como cartera muerta</li>
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
              Créditos con más de {weeksSinceLoan} semanas desde el crédito y {weeksWithoutPayment} semanas sin pago
            </p>
          </div>
        </div>
      )}
    </div>
  );
}