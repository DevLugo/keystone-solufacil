/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx, Box, Stack } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { RouteLeadSelector } from '../components/routes/RouteLeadSelector';
import CreateLoanForm from './creditos';
import { CreateExpensesForm } from './gastos';
import { CreatePaymentForm } from './abonos';
import type { Option, RouteOption } from '../types/transaction';
import type { Route, Employee } from './gastos';
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px'
  },
  section: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
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

const TransactionsPage = () => {
  const [selectedTab, setSelectedTab] = useState<'expenses' | 'credits' | 'payments'>('expenses');
  const [selectedDate, setSelectedDate] = useState<Date>(
    new Date(new Date().setHours(0, 0, 0, 0))
  );
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedLead, setSelectedLead] = useState<Employee | null>(null);

  const getTabTitle = () => {
    switch (selectedTab) {
      case 'expenses':
        return 'Registrar Gastos';
      case 'credits':
        return 'Registrar Créditos';
      case 'payments':
        return 'Registrar Pagos';
      default:
        return 'Gestión de Transacciones';
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    date.setHours(0, 0, 0, 0);
    setSelectedDate(date);
  };

  const handleRouteSelect = (route: Route | null) => {
    setSelectedRoute(route);
  };

  const handleLeadSelect = (lead: Employee | null) => {
    setSelectedLead(lead);
  };

  return (
    <PageContainer header={<h1>{getTabTitle()}</h1>}>
      <div css={styles.container}>
        <div css={styles.section}>
          <Box marginBottom="large">
            <RouteLeadSelector
              selectedRoute={selectedRoute}
              selectedLead={selectedLead}
              onRouteSelect={handleRouteSelect}
              onLeadSelect={handleLeadSelect}
            />
          </Box>

          <Box marginY="large">
            <label style={{ display: 'block', marginBottom: '4px' }}>Fecha</label>
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={handleDateChange}
              css={styles.dateInput}
            />
          </Box>
        </div>

        <div css={styles.section}>
          <Stack gap="xlarge">
            <Box css={{ display: 'flex', gap: '16px', borderBottom: '2px solid #e2e8f0' }}>
              <button
                onClick={() => setSelectedTab('expenses')}
                css={{
                  padding: '12px 24px',
                  border: 'none',
                  background: 'none',
                  borderBottom: selectedTab === 'expenses' ? '2px solid #4299e1' : 'none',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  color: selectedTab === 'expenses' ? '#2c5282' : '#4a5568',
                  fontWeight: selectedTab === 'expenses' ? 600 : 400
                }}
              >
                Gastos
              </button>
              <button
                onClick={() => setSelectedTab('credits')}
                css={{
                  padding: '12px 24px',
                  border: 'none',
                  background: 'none',
                  borderBottom: selectedTab === 'credits' ? '2px solid #4299e1' : 'none',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  color: selectedTab === 'credits' ? '#2c5282' : '#4a5568',
                  fontWeight: selectedTab === 'credits' ? 600 : 400
                }}
              >
                Créditos
              </button>
              <button
                onClick={() => setSelectedTab('payments')}
                css={{
                  padding: '12px 24px',
                  border: 'none',
                  background: 'none',
                  borderBottom: selectedTab === 'payments' ? '2px solid #4299e1' : 'none',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  color: selectedTab === 'payments' ? '#2c5282' : '#4a5568',
                  fontWeight: selectedTab === 'payments' ? 600 : 400
                }}
              >
                Abonos
              </button>
            </Box>

            <Box>
              {selectedTab === 'expenses' && (
                <CreateExpensesForm
                  selectedDate={selectedDate}
                  selectedRoute={selectedRoute}
                  selectedLead={selectedLead}
                />
              )}
              {selectedTab === 'credits' && (
                <CreateLoanForm
                  selectedDate={selectedDate}
                  selectedRoute={selectedRoute}
                  selectedLead={selectedLead}
                />
              )}
              {selectedTab === 'payments' && (
                <CreatePaymentForm
                  selectedDate={selectedDate}
                  selectedRoute={selectedRoute}
                  selectedLead={selectedLead}
                />
              )}
            </Box>
          </Stack>
        </div>
      </div>
    </PageContainer>
  );
};

export default TransactionsPage;
