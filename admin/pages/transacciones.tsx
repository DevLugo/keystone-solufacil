/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx, Box, Stack } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { CreateExpensesForm } from './gastos';
import { CreatePaymentForm } from './abonos';
import { CreditosTab } from '../components/transactions/CreditosTab';
import RouteLeadSelector from '../components/routes/RouteLeadSelector';
import type { Option, RouteOption, Route, Employee } from '../types/transaction';
import { gql, useQuery } from '@apollo/client';

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 16px'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    marginBottom: '16px'
  },
  dateInput: {
    padding: '8px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    width: '100%',
    '&:focus': {
      outline: 'none',
      borderColor: '#4299e1',
      boxShadow: '0 0 0 1px #4299e1',
    }
  }
};

const GET_TRANSACTIONS_SUMMARY = gql`
  query GetTransactionsSummary($startDate: String!, $endDate: String!) {
    getTransactionsSummary(startDate: $startDate, endDate: $endDate) {
      date
      locality
      abono
      credito
      viatic
      gasoline
      accommodation
      nominaSalary
      externalSalary
      vehiculeMaintenance
      loanGranted
      loanPaymentComission
      loanGrantedComission
      leadComission
      moneyInvestment
      otro
      balance
      profit
    }
  }
`;

const SummaryTab = ({ selectedDate }: { selectedDate: Date }) => {
  const { data, loading, error } = useQuery(GET_TRANSACTIONS_SUMMARY, {
    variables: {
      startDate: selectedDate.toISOString().split('T')[0],
      endDate: selectedDate.toISOString().split('T')[0]
    }
  });

  const [expandedLocality, setExpandedLocality] = useState<string | null>(null);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const summaryData = data?.getTransactionsSummary || [];

  // Agrupar por localidad
  const groupedByLocality = summaryData.reduce((acc: Record<string, any>, item: any) => {
    const localityName = item.locality || 'General';
    if (!acc[localityName]) {
      acc[localityName] = {
        locality: localityName,
        totalIncome: 0,
        totalExpenses: 0,
        totalComissions: 0,
        balance: 0,
        profit: 0,
        details: []
      };
    }
    
    // Calcular totales
    const income = item.abono + item.moneyInvestment;
    const expenses = item.credito + item.viatic + item.gasoline + item.accommodation + 
                    item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                    item.loanGranted + item.otro;
    const comissions = item.loanPaymentComission + item.loanGrantedComission + item.leadComission;

    acc[localityName].totalIncome += income;
    acc[localityName].totalExpenses += expenses;
    acc[localityName].totalComissions += comissions;
    acc[localityName].balance += item.balance;
    acc[localityName].profit += item.profit;
    acc[localityName].details.push(item);

    return acc;
  }, {});

  const localities = Object.values(groupedByLocality);

  return (
    <Box css={{ padding: '16px' }}>
      {localities.map((locality: any) => (
        <Box key={locality.locality} css={{ marginBottom: '24px' }}>
          <h2 css={{ 
            margin: '0 0 16px 0', 
            padding: '8px 16px',
            backgroundColor: '#f7fafc',
            borderRadius: '4px',
            borderLeft: '4px solid #4299e1'
          }}>
            {locality.locality.split(' - ')[0]} - {locality.locality.split(' - ')[1]}
          </h2>
          <table css={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Concepto</th>
                <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Créditos otorgados</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  ${locality.totalExpenses.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Comisiones</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  ${locality.totalComissions.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Gastos</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  ${locality.totalExpenses.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Ingresos</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  ${locality.totalIncome.toFixed(2)}
                </td>
              </tr>
              <tr css={{ backgroundColor: '#f7fafc', fontWeight: 'bold' }}>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  ${locality.balance.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </Box>
      ))}
      {/* Totales Generales */}
      <Box css={{ 
        marginTop: '32px', 
        padding: '16px',
        backgroundColor: '#f7fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h2 css={{ margin: '0 0 16px 0', color: '#2d3748' }}>Totales Generales</h2>
        <table css={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Concepto</th>
              <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Total Créditos otorgados</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${localities.reduce((sum, loc) => sum + loc.totalExpenses, 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Total Comisiones</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${localities.reduce((sum, loc) => sum + loc.totalComissions, 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Total Gastos</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${localities.reduce((sum, loc) => sum + loc.totalExpenses, 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Total Ingresos</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${localities.reduce((sum, loc) => sum + loc.totalIncome, 0).toFixed(2)}
              </td>
            </tr>
            <tr css={{ backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance Total</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${localities.reduce((sum, loc) => sum + loc.balance, 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </Box>
    </Box>
  );
};

export default function TransaccionesPage() {
  const [selectedTab, setSelectedTab] = useState<'expenses' | 'credits' | 'payments' | 'summary'>('expenses');
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedRoute, setSelectedRoute] = useState<Option | null>(null);
  const [selectedLead, setSelectedLead] = useState<Employee | null>(null);
  const [routeBalance, setRouteBalance] = useState<number>(0);

  const getTabTitle = () => {
    switch (selectedTab) {
      case 'expenses':
        return 'Registrar Gastos';
      case 'credits':
        return 'Registrar Créditos';
      case 'payments':
        return 'Registrar Pagos';
      case 'summary':
        return 'Resumen de Transacciones';
      default:
        return 'Gestión de Transacciones';
    }
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleRouteSelect = (route: Option | null) => {
    setSelectedRoute(route);
    setSelectedLead(null);
  };

  const handleLeadSelect = (lead: Employee | null) => {
    setSelectedLead(lead);
  };

  const handleBalanceUpdate = (change: number) => {
    setRouteBalance(prev => prev + change);
  };

  return (
    <PageContainer header={<h1>{getTabTitle()}</h1>}>
      <div css={styles.container}>
        <div css={{
          ...styles.section,
          padding: '16px',
          marginBottom: '0'
        }}>
          <Stack gap="medium">
            <Box css={{ 
              display: 'flex', 
              gap: '16px', 
              borderBottom: '2px solid #e2e8f0',
              marginBottom: '8px'
            }}>
              <button
                onClick={() => setSelectedTab('expenses')}
                css={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: selectedTab === 'expenses' ? '2px solid #4299e1' : 'none',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  color: selectedTab === 'expenses' ? '#2c5282' : '#4a5568',
                  fontWeight: selectedTab === 'expenses' ? 600 : 400,
                  fontSize: '14px'
                }}
              >
                Gastos
              </button>
              <button
                onClick={() => setSelectedTab('credits')}
                css={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: selectedTab === 'credits' ? '2px solid #4299e1' : 'none',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  color: selectedTab === 'credits' ? '#2c5282' : '#4a5568',
                  fontWeight: selectedTab === 'credits' ? 600 : 400,
                  fontSize: '14px'
                }}
              >
                Créditos
              </button>
              <button
                onClick={() => setSelectedTab('payments')}
                css={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: selectedTab === 'payments' ? '2px solid #4299e1' : 'none',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  color: selectedTab === 'payments' ? '#2c5282' : '#4a5568',
                  fontWeight: selectedTab === 'payments' ? 600 : 400,
                  fontSize: '14px'
                }}
              >
                Abonos
              </button>
              <button
                onClick={() => setSelectedTab('summary')}
                css={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: selectedTab === 'summary' ? '2px solid #4299e1' : 'none',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  color: selectedTab === 'summary' ? '#2c5282' : '#4a5568',
                  fontWeight: selectedTab === 'summary' ? 600 : 400,
                  fontSize: '14px'
                }}
              >
                Resumen
              </button>
            </Box>

            <Box css={{ marginBottom: '8px' }}>
              <RouteLeadSelector
                selectedRoute={selectedRoute as Route}
                selectedLead={selectedLead}
                selectedDate={selectedDate || new Date()}
                onRouteSelect={handleRouteSelect}
                onLeadSelect={handleLeadSelect}
                onDateSelect={handleDateChange}
              />
            </Box>

            <Box>
              {selectedTab === 'expenses' && (
                <CreateExpensesForm
                  selectedDate={selectedDate || new Date()}
                  selectedRoute={selectedRoute}
                  selectedLead={selectedLead}
                />
              )}
              {selectedTab === 'credits' && (
                <CreditosTab
                  selectedDate={selectedDate || new Date()}
                  selectedRoute={selectedRoute?.value || null}
                  selectedLead={selectedLead}
                  onBalanceUpdate={handleBalanceUpdate}
                />
              )}
              {selectedTab === 'payments' && (
                <CreatePaymentForm
                  selectedDate={selectedDate || new Date()}
                  selectedRoute={selectedRoute}
                  selectedLead={selectedLead}
                />
              )}
              {selectedTab === 'summary' && (
                <SummaryTab selectedDate={selectedDate || new Date()} />
              )}
            </Box>
          </Stack>
        </div>
      </div>
    </PageContainer>
  );
}
