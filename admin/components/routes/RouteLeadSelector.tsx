/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag jsx.Fragment */

import React, { useState, useEffect } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Select } from '@keystone-ui/fields';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { GET_LEADS_SIMPLE, GET_ROUTES_SIMPLE } from '../../graphql/queries/routes-optimized';
import type { Employee, Option } from '../../types/transaction';
import { gql } from '@apollo/client';
import { FaTimes } from 'react-icons/fa';

type Lead = {
  id: string;
  personalData: {
    id: string;
    fullName: string;
    addresses?: Array<{
      location: {
        name: string;
      } | null;
    }> | null;
  };
  type: string;
};

// Tipo simplificado para evitar cargar datos pesados
type RouteSimple = {
  id: string;
  name: string;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    amount: number;
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
  selectedRoute: any | null; // Flexibilizado para evitar problemas de tipo
  selectedLead: Employee | null;
  selectedDate: Date;
  onRouteSelect: (route: any | null) => void;
  onLeadSelect: (lead: Employee | null) => void;
  onDateSelect: (date: Date) => void;
  hideDateField?: boolean; // Nueva prop para ocultar el campo de fecha
}

const styles = {
  container: {
    width: '100%',
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    '@media (max-width: 768px)': {
      padding: '16px',
      width: '100%',
      maxWidth: '100%'
    }
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
    marginBottom: '24px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
      gap: '20px'
    }
  },
  selector: {
    width: '100%',
    '@media (max-width: 768px)': {
      width: '100%',
      minWidth: '100%'
    }
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
          amountGived
          finishedDate
          badDebtDate
          loantype {
            id
            rate
            weekDuration
          }
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

const processRouteStats = (route: RouteSimple) => {
  const accounts: AccountSummary[] = [];
  
  // Procesar todas las cuentas de la ruta de forma simplificada
  if (route.accounts && route.accounts.length > 0) {
    route.accounts.forEach(account => {
      accounts.push({
        id: account.id,
        name: account.name || 'Cuenta sin nombre',
        totalAccounts: 1, // Simplificado - solo contamos las cuentas
        amount: account.amount || 0
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
  hideDateField = false,
}) => {
  // OPTIMIZADO: Usar cache-first y consulta simple
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: RouteSimple[] }>(GET_ROUTES_SIMPLE, {
    variables: { where: {} },
    fetchPolicy: 'cache-first', // Cambiado de 'network-only'
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS_SIMPLE);

  const [routesErrorState, setRoutesErrorState] = useState<Error | null>(null);
  const [leadsErrorState, setLeadsErrorState] = useState<Error | null>(null);

  const dateOptions: Option[] = [
    { label: 'Hoy', value: new Date().toISOString() },
    { label: 'Ayer', value: new Date(Date.now() - 86400000).toISOString() },
    { label: 'Esta semana', value: new Date(Date.now() - 604800000).toISOString() },
  ];

  // ELIMINADO: refetch innecesario que causaba problemas
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

  const routeOptions = routes.map((route: RouteSimple) => ({
    label: route.name,
    value: route.id,
    data: route
  }));

  // Deduplicar leads basándose en personalData.id para evitar entradas repetidas
  const uniqueLeads = leads.reduce((acc: Lead[], current: Lead) => {
    // Primero intentar por personalData.id
    if (current.personalData?.id) {
      const exists = acc.find(lead => lead.personalData?.id === current.personalData?.id);
      if (!exists) {
        acc.push(current);
      }
    } else {
      // Fallback: deduplicar por nombre completo si no hay ID
      const exists = acc.find(lead => 
        lead.personalData?.fullName === current.personalData?.fullName
      );
      if (!exists) {
        acc.push(current);
      }
    }
    return acc;
  }, []);

  const leadOptions = uniqueLeads.map((lead: Lead) => {
    const locality = lead.personalData?.addresses?.[0]?.location?.name || '';
    const state = (lead.personalData as any)?.addresses?.[0]?.location?.municipality?.state?.name || '';
    const label = locality && state ? `${locality} · ${state} · (${lead.personalData?.fullName})` : locality || lead.personalData?.fullName || 'Sin nombre';
    return {
      label,
      value: lead.id,
      data: lead
    };
  });

  // OPTIMIZADO: Eliminar refetch innecesario
  const handleRouteChange = (option: any) => {
    onRouteSelect(option?.data || null);
    onLeadSelect(null);
    // ELIMINADO: await refetchRoutes(); que causaba timeout
  };

  const handleLeadChange = (option: any) => {
    if (option?.data) {
      onLeadSelect({
        id: option.data.id,
        type: option.data.type,
        personalData: {
          fullName: option.data.personalData.fullName
        },
        routes: {
          accounts: [] // Proporcionar estructura mínima requerida
        }
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
      const date = new Date(year, month - 1, day);
      
      // Ajustamos la zona horaria para evitar problemas de desplazamiento de día
      date.setUTCHours(12, 0, 0, 0);
      
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
        <h2 css={styles.title}>Selección de Ruta y Localidad</h2>
      </Box>

      <Box css={styles.content}>
        <Box css={{
          ...styles.selectorsContainer,
          gridTemplateColumns: hideDateField ? '1fr 1fr' : 'repeat(3, 1fr)',
          '@media (max-width: 768px)': {
            gridTemplateColumns: '1fr',
            gap: '16px'
          }
        }}>
          <Box css={styles.selector}>
            <div css={styles.selectorLabel}>Ruta</div>
            <Select
              value={routeOptions.find(option => option.value === selectedRoute?.id) || null}
              options={routeOptions}
              onChange={handleRouteChange}
              placeholder="Seleccionar ruta"
              isLoading={routesLoading}
              data-testid="route-selector"
            />
          </Box>

          <Box css={styles.selector}>
            <div css={styles.selectorLabel}>Localidad</div>
            <Box css={styles.selectContainer}>
              <Select
                value={leadOptions.find(option => option.value === selectedLead?.id) || null}
                options={leadOptions}
                onChange={handleLeadChange}
                placeholder="Seleccionar localidad"
                isLoading={leadsLoading}
                isDisabled={!selectedRoute}
                data-testid="lead-selector"
              />
              {selectedLead && (
                <button
                  css={styles.clearButton}
                  onClick={() => onLeadSelect(null)}
                  title="Limpiar localidad seleccionada"
                >
                  <FaTimes />
                </button>
              )}
            </Box>
          </Box>

          {!hideDateField && (
            <Box css={styles.selector}>
              <div css={styles.selectorLabel}>Fecha</div>
              <input
                type="date"
                value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                onChange={handleDateChange}
                css={styles.dateInput}
              />
            </Box>
          )}
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
