/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx, Box } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { gql, useQuery } from '@apollo/client';

const GET_LOANS = gql`
  query GetLoans($leadId: ID!) {
    loans(where: { lead: { id: { equals: $leadId } } }) {
      id
      weeklyPaymentAmount
      requestedAmount
      amountGived
      amountToPay
      pendingAmount
      signDate
      finishedDate
      createdAt
      updatedAt
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            number
          }
        }
      }
      avalName
      avalPhone
      previousLoan {
        id
        pendingAmount
        avalName
        avalPhone
        borrower {
          id
          personalData {
            fullName
          }
        }
      }
    }
  }
`;

type Loan = {
  id: string;
  weeklyPaymentAmount: string;
  requestedAmount: string;
  amountGived: string;
  amountToPay: string;
  pendingAmount: string;
  signDate: string;
  finishedDate: string | null;
  createdAt: string;
  updatedAt: string;
  borrower: {
    id: string;
    personalData: {
      id: string;
      fullName: string;
      phones: Array<{ number: string }>;
    };
  };
  avalName: string;
  avalPhone: string;
  previousLoan?: {
    id: string;
    pendingAmount: string;
    avalName: string;
    avalPhone: string;
    borrower: {
      id: string;
      personalData: {
        fullName: string;
      };
    };
  };
};

interface LoanListProps {
  leadId: string | null;
  onLoanSelect?: (loan: Loan) => void;
}

export const LoanList: React.FC<LoanListProps> = ({ leadId, onLoanSelect }) => {
  const { data, loading, error } = useQuery(GET_LOANS, {
    variables: { leadId },
    skip: !leadId,
  });

  if (!leadId) {
    return null;
  }

  if (loading) {
    return (
      <Box css={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <LoadingDots label="Cargando préstamos" size="large" tone="active" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box css={{ color: 'red', padding: '1rem' }}>
        Error al cargar los préstamos: {error.message}
      </Box>
    );
  }

  const loans = data?.loans || [];

  if (loans.length === 0) {
    return (
      <Box css={{
        padding: '2rem',
        textAlign: 'center',
        background: 'white',
        borderRadius: '8px',
        color: '#666'
      }}>
        No hay préstamos para mostrar
      </Box>
    );
  }

  return (
    <Box css={{ marginTop: '2rem' }}>
      <div css={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
      }}>
        {loans.map((loan: Loan) => (
          <div
            key={loan.id}
            css={{
              padding: '1.5rem',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              ':hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }
            }}
          >
            <div css={{ marginBottom: '1rem' }}>
              <h3 css={{ margin: '0 0 0.5rem', color: '#2D3748' }}>
                {loan.borrower.personalData.fullName}
              </h3>
              <div css={{ color: '#718096', fontSize: '0.875rem' }}>
                ID: {loan.id}
              </div>
            </div>
            
            <div css={{ display: 'grid', gap: '0.5rem', color: '#4A5568' }}>
              <div css={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monto Solicitado:</span>
                <strong>${loan.requestedAmount}</strong>
              </div>
              <div css={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monto Pendiente:</span>
                <strong>${loan.pendingAmount}</strong>
              </div>
              <div css={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pago Semanal:</span>
                <strong>${loan.weeklyPaymentAmount}</strong>
              </div>
            </div>

            <div css={{ 
              marginTop: '1rem',
              padding: '0.5rem 0 0',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem'
            }}>
              {onLoanSelect && (
                <Button
                  tone="active"
                  size="small"
                  onClick={() => onLoanSelect(loan)}
                >
                  Seleccionar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Box>
  );
};
