import React, { useState } from 'react';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Heading } from '@keystone-ui/core';
import { useQuery, gql } from '@apollo/client';
import { SidebarFilter } from '../components/SidebarFilter';

const GET_BASIC_LOANS = gql`
  query GetBasicLoans {
    loans(take: 50, orderBy: { signDate: desc }) {
      id
      requestedAmount
      amountGived
      signDate
      borrower {
        personalData {
          fullName
        }
      }
      loantype {
        name
        rate
        weekDuration
      }
      lead {
        personalData {
          fullName
        }
      }
    }
  }
`;

const GET_RECENT_PAYMENTS = gql`
  query GetRecentPayments {
    loanPayments(take: 50, orderBy: { receivedAt: desc }) {
      id
      amount
      receivedAt
      loan {
        borrower {
          personalData {
            fullName
          }
        }
      }
    }
  }
`;

export default function ListadosPage() {
  const [activeTab, setActiveTab] = useState<'loans' | 'payments'>('loans');

  const { data: loansData, loading: loansLoading } = useQuery(GET_BASIC_LOANS);
  const { data: paymentsData, loading: paymentsLoading } = useQuery(GET_RECENT_PAYMENTS);

  const tabStyle = {
    padding: '10px 20px',
    border: '1px solid #ddd',
    background: '#f5f5f5',
    cursor: 'pointer',
    marginRight: '5px',
  };

  const activeTabStyle = {
    ...tabStyle,
    background: '#007bff',
    color: 'white',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '20px',
  };

  const thStyle = {
    border: '1px solid #ddd',
    padding: '12px',
    background: '#f5f5f5',
    textAlign: 'left' as const,
  };

  const tdStyle = {
    border: '1px solid #ddd',
    padding: '12px',
  };

  return (
    <PageContainer header={<Heading type="h1">Listados</Heading>}>
      <SidebarFilter />
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', marginBottom: '20px' }}>
          <button
            style={activeTab === 'loans' ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab('loans')}
          >
            Préstamos Recientes
          </button>
          <button
            style={activeTab === 'payments' ? activeTabStyle : tabStyle}
            onClick={() => setActiveTab('payments')}
          >
            Pagos Recientes
          </button>
        </div>

        {activeTab === 'loans' && (
          <div>
            <Heading type="h3">Préstamos Recientes</Heading>
            {loansLoading ? (
              <p>Cargando préstamos...</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Cliente</th>
                    <th style={thStyle}>Monto Solicitado</th>
                    <th style={thStyle}>Monto Entregado</th>
                    <th style={thStyle}>Tipo de Préstamo</th>
                    <th style={thStyle}>Líder</th>
                    <th style={thStyle}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {loansData?.loans?.map((loan: any) => (
                    <tr key={loan.id}>
                      <td style={tdStyle}>
                        {loan.borrower?.personalData?.fullName || 'Sin nombre'}
                      </td>
                      <td style={tdStyle}>${loan.requestedAmount}</td>
                      <td style={tdStyle}>${loan.amountGived}</td>
                      <td style={tdStyle}>
                        {loan.loantype?.name} ({loan.loantype?.rate}% - {loan.loantype?.weekDuration} semanas)
                      </td>
                      <td style={tdStyle}>
                        {loan.lead?.personalData?.fullName || 'Sin asignar'}
                      </td>
                      <td style={tdStyle}>
                        {new Date(loan.signDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div>
            <Heading type="h3">Pagos Recientes</Heading>
            {paymentsLoading ? (
              <p>Cargando pagos...</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Cliente</th>
                    <th style={thStyle}>Monto</th>
                    <th style={thStyle}>Fecha de Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData?.loanPayments?.map((payment: any) => (
                    <tr key={payment.id}>
                      <td style={tdStyle}>
                        {payment.loan?.borrower?.personalData?.fullName || 'Sin nombre'}
                      </td>
                      <td style={tdStyle}>${payment.amount}</td>
                      <td style={tdStyle}>
                        {new Date(payment.receivedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
} 