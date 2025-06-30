/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx, Box } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { gql, useQuery } from '@apollo/client';

const GET_DEBUG_INFO = gql`
  query GetDebugInfo {
    loantypes {
      id
      name
      rate
      weekDuration
    }
    loans(take: 5) {
      id
      requestedAmount
      loantype {
        id
        name
        rate
      }
    }
  }
`;

export const LoanDebug: React.FC = () => {
  const { data, loading, error } = useQuery(GET_DEBUG_INFO);

  if (loading) return <LoadingDots label="Cargando debug info" />;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <Box css={{ 
      padding: '1rem', 
      backgroundColor: '#f0f0f0', 
      border: '1px solid #ccc',
      marginBottom: '1rem'
    }}>
      <h3>🔍 Debug Info - Tipos de Préstamos</h3>
      
      <div css={{ marginBottom: '1rem' }}>
        <strong>Tipos de préstamos disponibles ({data?.loantypes?.length || 0}):</strong>
        {data?.loantypes?.length > 0 ? (
          <ul>
            {data.loantypes.map((type: any) => (
              <li key={type.id}>
                ID: {type.id} | Nombre: {type.name} | Rate: {type.rate} | Duración: {type.weekDuration}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: 'red' }}>❌ No hay tipos de préstamos en la base de datos</div>
        )}
      </div>

      <div>
        <strong>Préstamos de muestra ({data?.loans?.length || 0}):</strong>
        {data?.loans?.length > 0 ? (
          <ul>
            {data.loans.map((loan: any) => (
              <li key={loan.id}>
                Préstamo ID: {loan.id} | 
                Monto: {loan.requestedAmount} | 
                Tipo asignado: {loan.loantype ? 
                  `${loan.loantype.name} (${loan.loantype.rate}%)` : 
                  '❌ SIN TIPO ASIGNADO'
                }
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: 'red' }}>❌ No hay préstamos en la base de datos</div>
        )}
      </div>
    </Box>
  );
}; 