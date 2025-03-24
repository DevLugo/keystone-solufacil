/** @jsxRuntime classic */
/** @jsx jsx */

import React from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Select } from '@keystone-ui/fields';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { GET_LEADS } from '../../graphql/queries/routes';
import type { Employee } from '../../types/transaction';
import { gql } from '@apollo/client';

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
  mainContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  selectorsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    width: '100%',
    marginBottom: '8px'
  },
  selector: {
    width: '100%'
  },
  dateInput: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    '&:focus': {
      outline: 'none',
      borderColor: '#4299e1',
      boxShadow: '0 0 0 2px rgba(66, 153, 225, 0.2)',
    },
    '&:hover': {
      borderColor: '#4299e1',
    }
  },
  accountsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  accountSection: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  accountHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#fff',
  },
  accountTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a202c',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  accountBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
  },
  summaryContainer: {
    padding: '20px',
  },
  summaryHeader: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: '12px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  cardLabel: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '500',
  },
  cardValue: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#0f172a',
  },
  cardSubValue: {
    fontSize: '14px',
    color: '#64748b',
  },
  selectorLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: '6px',
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

export const RouteLeadSelector: React.FC<RouteLeadSelectorProps> = ({
  selectedRoute,
  selectedLead,
  selectedDate,
  onRouteSelect,
  onLeadSelect,
  onDateSelect
}) => {
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
    variables: { where: {} },
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS);

  // Actualizar la lógica para obtener el resumen de la ruta
  const routeSummary = selectedRoute ? {
    accounts: processRouteStats(selectedRoute)
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

  const handleRouteChange = (option: any) => {
    onRouteSelect(option?.data || null);
    onLeadSelect(null);
  };

  const handleLeadChange = (option: any) => {
    onLeadSelect(option?.data || null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const [year, month, day] = e.target.value.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      onDateSelect(date);
    } catch (error) {
      console.error('Error al procesar la fecha:', error);
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
    <Box css={styles.mainContainer}>
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
          <Select
            value={leadOptions.find(option => option.value === selectedLead?.id) || null}
            options={leadOptions}
            onChange={handleLeadChange}
            placeholder="Seleccionar líder"
            isLoading={leadsLoading}
            isDisabled={!selectedRoute}
          />
        </Box>
        <Box css={styles.selector}>
          <div css={styles.selectorLabel}>Fecha</div>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={handleDateChange}
            css={styles.dateInput}
          />
        </Box>
      </Box>

      {selectedRoute && routeSummary && (
        <Box css={styles.accountsContainer}>
          <div css={styles.accountSection}>
            <div css={styles.summaryContainer}>
              <div css={styles.summaryGrid}>
                {routeSummary.accounts.map((account) => (
                  <div key={account.id} css={styles.summaryCard}>
                    <div css={styles.cardLabel}>{account.name}</div>
                    <div css={styles.cardValue}>{formatCurrency(account.amount)}</div>
                    <div css={styles.cardSubValue}>
                      {account.totalAccounts} cuentas
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Box>
      )}
    </Box>
  );
};
