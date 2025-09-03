/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { Box, jsx } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { DatePicker } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { GET_ROUTES_SIMPLE } from '../graphql/queries/routes-optimized';
import RouteLeadSelector from '../components/routes/RouteLeadSelector';
import type { Route, Employee } from '../types/transaction';
import type { RouteWithEmployees, EmployeeWithTypename } from '../types/components';
import { CreateExpensesForm } from '../components/transactions/gastosTab';
import { CreditosTab } from '../components/transactions/CreditosTab';
import { CreatePaymentForm } from '../components/transactions/abonosTab';
import { SummaryTab } from '../components/transactions/SummaryTab';
import TransferForm from '../components/transactions/TransferTab';

const GET_TRANSACTIONS_SUMMARY = gql`
  query GetTransactionsSummary($date: DateTime!, $nextDate: DateTime!) {
    getTransactionsSummary(date: $date, nextDate: $nextDate) {
      totalAbono
      totalExpense
      totalComission
      totalLoanGranted
      totalLoanGrantedComision
      totalLoanPaymentComission
      cashBalance
      bankBalance
      cashAbono
      bankAbono
      localidades {
        name
        totalAbono
        totalExpense
        totalComission
        totalLoanGranted
        totalLoanGrantedComision
        totalLoanPaymentComission
        cashBalance
        bankBalance
        cashAbono
        bankAbono
      }
    }
  }
`;

// Helpers para transformar los tipos extendidos a los tipos base
function toRoute(route: RouteWithEmployees | null): Route | null {
  if (!route) return null;
  return {
    id: route.id,
    name: route.name,
    accounts: (route.accounts || []).map(acc => ({
      id: acc.id,
      name: acc.name,
      type: acc.type as any, // forzamos el tipo, ya que puede venir como string
      amount: acc.amount
    }))
  };
}
function toEmployee(lead: EmployeeWithTypename | null): Employee | null {
  if (!lead) return null;
  return {
    id: lead.id,
    type: lead.type,
    personalData: {
      fullName: lead.personalData.fullName
    },
    routes: lead.routes
  };
}
function toCreditLead(lead: EmployeeWithTypename | null): any {
  if (!lead) return null;
  return {
    id: lead.id,
    type: lead.type,
    personalData: {
      fullName: lead.personalData.fullName,
      __typename: lead.personalData.__typename
    },
    __typename: lead.__typename
  };
}

export default function TransaccionesPage() {
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [selectedRoute, setSelectedRoute] = useState<RouteWithEmployees | null>(null);
  const [selectedLead, setSelectedLead] = useState<EmployeeWithTypename | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [routeSelectorKey, setRouteSelectorKey] = useState(0);

  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES_SIMPLE, {
    variables: {
      where: {
        isActive: { equals: true }
      }
    }
  });

  const { data: summaryData, loading: summaryLoading, refetch: refetchSummary } = useQuery(GET_TRANSACTIONS_SUMMARY, {
    variables: {
      date: selectedDate.toISOString(),
      nextDate: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
    },
    skip: activeTab !== 'summary'
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setRefreshKey(prev => prev + 1);
  };

  const handleDateChange = (date: string) => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    setSelectedDate(newDate);
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timeout);
  }, [selectedDate, refreshKey]);

  const handleRouteSelect = (route: RouteWithEmployees | null) => {
    setSelectedRoute(route);
    setRefreshKey(prev => prev + 1);
  };

  const handleLeadSelect = (lead: Employee | null) => {
    // Si el lead ya tiene __typename, lo dejamos igual, si no, lo convertimos
    if (lead && (lead as any).__typename) {
      setSelectedLead(lead as EmployeeWithTypename);
    } else if (lead) {
      setSelectedLead({
        ...lead,
        __typename: 'Employee',
        personalData: {
          ...lead.personalData,
          __typename: 'PersonalData'
        }
      });
    } else {
      setSelectedLead(null);
    }
    setRefreshKey(prev => prev + 1);
  };

  const handleRefresh = async () => {
    setRefreshKey(prev => prev + 1);
    if (activeTab === 'summary') {
      await refetchSummary();
    }
  };

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <Box css={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <LoadingDots label="Cargando..." />
        </Box>
      );
    }

    switch (activeTab) {
      case 'summary':
        return (
          <SummaryTab
            selectedDate={selectedDate}
            refreshKey={refreshKey}
          />
        );
      case 'expenses':
        return (
          <CreateExpensesForm
            selectedDate={selectedDate}
            selectedRoute={toRoute(selectedRoute)}
            selectedLead={toEmployee(selectedLead)}
            refreshKey={refreshKey}
          />
        );
      case 'credits':
        return (
          <CreditosTab
            selectedDate={selectedDate}
            selectedRoute={selectedRoute?.id || null}
            selectedLead={toCreditLead(selectedLead)}
            onBalanceUpdate={() => {
              // Forzar actualización del RouteLeadSelector
              setRouteSelectorKey(prev => prev + 1);
            }}
          />
        );
      case 'payments':
        return (
          <CreatePaymentForm
            selectedDate={selectedDate}
            selectedRoute={toRoute(selectedRoute)}
            selectedLead={toEmployee(selectedLead)}
            refreshKey={refreshKey}
          />
        );
      case 'transfers':
        return (
          <TransferForm
            selectedDate={selectedDate}
            selectedRoute={toRoute(selectedRoute)}
            selectedLead={toEmployee(selectedLead)}
            refreshKey={refreshKey}
            onTransferComplete={handleRefresh}
          />
        );
      default:
        return null;
    }
  };

  return (
    <PageContainer header={<h2>Transacciones</h2>}>
      <Box css={{ padding: '24px' }}>
        <Box css={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <RouteLeadSelector
            key={routeSelectorKey}
            selectedRoute={selectedRoute}
            selectedLead={selectedLead}
            selectedDate={selectedDate}
            onRouteSelect={handleRouteSelect}
            onLeadSelect={handleLeadSelect}
            onDateSelect={date => handleDateChange(date.toISOString())}
          />
        </Box>

        <Box css={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <button
            onClick={() => handleTabChange('summary')}
            data-testid="tab-summary"
            css={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'summary' ? '#3182ce' : '#e2e8f0',
              color: activeTab === 'summary' ? 'white' : '#4a5568',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: activeTab === 'summary' ? '#2c5282' : '#cbd5e0',
              },
            }}
          >
            Resumen
          </button>
          <button
            onClick={() => handleTabChange('payments')}
            data-testid="tab-payments"
            css={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'payments' ? '#3182ce' : '#e2e8f0',
              color: activeTab === 'payments' ? 'white' : '#4a5568',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: activeTab === 'payments' ? '#2c5282' : '#cbd5e0',
              },
            }}
          >
            Abonos
          </button>
          
          <button
            onClick={() => handleTabChange('credits')}
            data-testid="tab-credits"
            css={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'credits' ? '#3182ce' : '#e2e8f0',
              color: activeTab === 'credits' ? 'white' : '#4a5568',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: activeTab === 'credits' ? '#2c5282' : '#cbd5e0',
              },
            }}
          >
            Créditos
          </button>
          <button
            onClick={() => handleTabChange('expenses')}
            data-testid="tab-expenses"
            css={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'expenses' ? '#3182ce' : '#e2e8f0',
              color: activeTab === 'expenses' ? 'white' : '#4a5568',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: activeTab === 'expenses' ? '#2c5282' : '#cbd5e0',
              },
            }}
          >
            Gastos
          </button>
          
          <button
            onClick={() => handleTabChange('transfers')}
            data-testid="tab-transfers"
            css={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'transfers' ? '#3182ce' : '#e2e8f0',
              color: activeTab === 'transfers' ? 'white' : '#4a5568',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: activeTab === 'transfers' ? '#2c5282' : '#cbd5e0',
              },
            }}
          >
            Transferencias
          </button>
        </Box>

        {renderTabContent()}
      </Box>
    </PageContainer>
  );
}
