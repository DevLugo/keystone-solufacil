/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag jsx.Fragment */

import React, { useState, useEffect } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Select } from '@keystone-ui/fields';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { GET_LEADS } from '../../graphql/queries/routes';
import type { Employee, Option } from '../../types/transaction';
import { gql } from '@apollo/client';
import { FaTimes } from 'react-icons/fa';

type Lead = {
  id: string;
  personalData: {
    fullName: string;
  };
  type: string;
};

type Route = {
  id: string;
  name: string;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    amount: number;
    transactions: Array<{
      id: string;
      amount: number;
      type: string;
    }>;
  }>;
  employees: Array<{
    id: string;
    type: string;
    LeadManagedLoans: Array<{
      id: string;
      status: string;
      requestedAmount: number;
      weeklyPaymentAmount: number;
      finishedDate: string | null;
      badDebtDate: string | null;
      payments: Array<{
        id: string;
        amount: number;
        receivedAt: string;
      }>;
    }>;
  }>;
};

type AccountSummary = {
  id: string;
  name: string;
  totalAccounts: number;
  amount: number;
};

type RouteSummary = {
  accounts: AccountSummary[];
};

interface RouteLeadSelectorProps {
  selectedRoute: Route | null;
  selectedLead: Employee | null;
  selectedDate: Date;
  onRouteSelect: (route: Route | null) => void;
  onLeadSelect: (lead: Employee | null) => void;
  onDateSelect: (date: Date) => void;
}

const styles = {
  container: {
    width: '100%',
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a202c',
    margin: '0',
  },
  content: {
    width: '100%',
  },
  selectorsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    width: '100%',
    marginBottom: '24px'
  },
  selector: {
    width: '100%'
  },
  selectorLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.025em',
  },
  dateInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111827',
    transition: 'all 0.2s ease',
    outline: 'none',
    '&:focus': {
      borderColor: '#0052CC',
      boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.1)',
    },
    '&:hover': {
      borderColor: '#0052CC',
    }
  },
  accountsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    width: '100%',
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  cardTopBorder: {
    height: '2px',
    background: '#0052CC',
    opacity: 0.1,
    marginBottom: '16px'
  },
  cardLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.025em',
  },
  cardValue: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#111827',
    letterSpacing: '-0.02em',
    lineHeight: '1',
    marginBottom: '4px',
  },
  cardSubValue: {
    fontSize: '13px',
    color: '#6B7280',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  clearButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    padding: '0',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      color: '#475569',
    }
  },
  selectContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  }
};

const GET_ROUTES = gql`
  query GetRoutes($where: RouteWhereInput!) {
    routes(where: $where) {
      id
      name
      accounts {
        id
        name
        type
        amount
        __typename
      }
      employees {
        id
        type
        LeadManagedLoans {
          id
          status
          requestedAmount
          weeklyPaymentAmount
          finishedDate
          badDebtDate
          payments {
            id
            amount
            receivedAt
          }
        }
      }
    }
  }
`;

const processRouteStats = (route: Route) => {
  const accounts: AccountSummary[] = [];
  
  // Procesar todas las cuentas de la ruta
  if (route.accounts && route.accounts.length > 0) {
    route.accounts.forEach(account => {
      const loans = route.employees
        .flatMap(emp => emp.LeadManagedLoans || [])
        .filter(loan => loan !== null && loan !== undefined);

      const activeLoans = loans.filter(loan => 
        loan && loan.status === 'ACTIVE' && !loan.finishedDate && !loan.badDebtDate
      );

      const overdueLoans = loans.filter(loan => {
        if (!loan || !loan.payments || !loan.payments.length) return false;
        const lastPayment = new Date(loan.payments[loan.payments.length - 1].receivedAt);
        const today = new Date();
        const diffDays = Math.floor((today.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > 7;
      });

      accounts.push({
        id: account.id,
        name: account.name || 'Cuenta sin nombre',
        totalAccounts: loans.length,
        amount: account.amount
      });
    });
  }

  return accounts;
};

const RouteLeadSelectorComponent: React.FC<RouteLeadSelectorProps> = ({
  selectedRoute,
  selectedLead,
  selectedDate,
  onRouteSelect,
  onLeadSelect,
  onDateSelect,
}) => {
  const { data: routesData, loading: routesLoading, error: routesError, refetch: refetchRoutes } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
    variables: { where: {} },
    fetchPolicy: 'network-only',
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS);

  const [routesErrorState, setRoutesErrorState] = useState<Error | null>(null);
  const [leadsErrorState, setLeadsErrorState] = useState<Error | null>(null);

  const dateOptions: Option[] = [
    { label: 'Hoy', value: new Date().toISOString() },
    { label: 'Ayer', value: new Date(Date.now() - 86400000).toISOString() },
    { label: 'Esta semana', value: new Date(Date.now() - 604800000).toISOString() },
  ];

  React.useEffect(() => {
    if (selectedRoute?.id) {
      refetchRoutes();
    }
  }, [selectedRoute?.id, refetchRoutes]);

  const currentRoute = selectedRoute?.id 
    ? routesData?.routes.find(route => route.id === selectedRoute.id) 
    : null;

  const routeSummary = currentRoute ? {
    accounts: processRouteStats(currentRoute)
  } : null;

  React.useEffect(() => {
    if (selectedRoute?.id) {
      getLeads({ variables: { routeId: selectedRoute.id } });
    }
  }, [selectedRoute, getLeads]);

  const routes = routesData?.routes || [];
  const leads = leadsData?.employees || [];

  const routeOptions = routes.map((route: Route) => ({
    label: route.name,
    value: route.id,
    data: route
  }));

  const leadOptions = leads.map((lead: Lead) => ({
    label: lead.personalData?.fullName || 'Sin nombre',
    value: lead.id,
    data: lead
  }));

  const handleRouteChange = async (option: any) => {
    onRouteSelect(option?.data || null);
    onLeadSelect(null);
    await refetchRoutes();
  };

  const handleLeadChange = (option: any) => {
    if (option?.data) {
      onLeadSelect({
        id: option.data.id,
        type: option.data.type,
        personalData: {
          fullName: option.data.personalData.fullName,
          __typename: 'PersonalData'
        },
        __typename: 'Employee'
      });
    } else {
      onLeadSelect(null);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value; // formato YYYY-MM-DD
    if (dateString) {
      // Dividimos la cadena de fecha en sus componentes
      const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
      
      // Creamos la fecha asegurando que se use exactamente el día seleccionado
      // Los meses en JavaScript son 0-indexed (enero = 0)
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      onDateSelect(date);
    }
  };

  if (routesLoading) return <LoadingDots label="Loading routes" />;
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Box css={styles.container}>
      <Box css={styles.header}>
        <h2 css={styles.title}>Selección de Ruta y Líder</h2>
      </Box>

      <Box css={styles.content}>
        <Box css={styles.selectorsContainer}>
          <Box css={styles.selector}>
            <div css={styles.selectorLabel}>Ruta</div>
            <Select
              value={routeOptions.find(option => option.value === selectedRoute?.id) || null}
              options={routeOptions}
              onChange={handleRouteChange}
              placeholder="Seleccionar ruta"
              isLoading={routesLoading}
            />
          </Box>

          <Box css={styles.selector}>
            <div css={styles.selectorLabel}>Líder</div>
            <Box css={styles.selectContainer}>
              <Select
                value={leadOptions.find(option => option.value === selectedLead?.id) || null}
                options={leadOptions}
                onChange={handleLeadChange}
                placeholder="Seleccionar líder"
                isLoading={leadsLoading}
                isDisabled={!selectedRoute}
              />
              {selectedLead && (
                <button
                  css={styles.clearButton}
                  onClick={() => onLeadSelect(null)}
                  title="Limpiar líder seleccionado"
                >
                  <FaTimes />
                </button>
              )}
            </Box>
          </Box>

          <Box css={styles.selector}>
            <div css={styles.selectorLabel}>Fecha</div>
            <input
              type="date"
              value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
              onChange={handleDateChange}
              css={styles.dateInput}
            />
          </Box>
        </Box>

        {selectedRoute && routeSummary && (
          <Box css={styles.accountsContainer}>
            {routeSummary.accounts.map((account) => (
              <div key={account.id} css={styles.summaryCard}>
                <div css={styles.cardTopBorder} />
                <div css={styles.cardLabel}>{account.name}</div>
                <div css={styles.cardValue}>{formatCurrency(account.amount)}</div>
                <div css={styles.cardSubValue}>
                  {account.totalAccounts} cuentas
                </div>
              </div>
            ))}
          </Box>
        )}

        {(routesError || leadsError) && (
          <GraphQLErrorNotice networkError={routesError || leadsError} errors={[]} />
        )}
      </Box>
    </Box>
  );
};

export default RouteLeadSelectorComponent;
