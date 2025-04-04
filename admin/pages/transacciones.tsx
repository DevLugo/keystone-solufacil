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

export default function TransaccionesPage() {
  const [selectedTab, setSelectedTab] = useState<'expenses' | 'credits' | 'payments'>('expenses');
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
            </Box>
          </Stack>
        </div>
      </div>
    </PageContainer>
  );
}
