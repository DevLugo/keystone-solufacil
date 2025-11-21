/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag jsx.Fragment */

import React, { useState, useEffect } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { Select } from '@keystone-ui/fields';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { GET_LEADS_SIMPLE, GET_ROUTES_SIMPLE } from '../../graphql/queries/routes-optimized';
import type { Employee, Option } from '../../types/transaction';
import { gql } from '@apollo/client';
import { FaTimes } from 'react-icons/fa';
import { useBalanceRefresh } from '../../contexts/BalanceRefreshContext';

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
  type: string;
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
    padding: '0',
    backgroundColor: 'transparent',
    borderRadius: '0',
    boxShadow: 'none',
    '@media (max-width: 768px)': {
      padding: '0',
      width: '100%',
      maxWidth: '100%'
    }
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    margin: '0',
  },
  content: {
    width: '100%',
  },
  selectorsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    width: '100%',
    marginBottom: '20px',
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
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
    textTransform: 'none' as const,
    letterSpacing: '0.025em',
  },
  dateInput: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #E5E7EB',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    outline: 'none',
    '&:focus': {
      borderColor: '#3B82F6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
    },
    '&:hover': {
      borderColor: '#9CA3AF',
    }
  },
  accountsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    width: '100%',
    marginTop: '16px',
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: '6px 12px',
    borderRadius: '999px',
    border: '1px solid #E5E7EB',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#6B7280',
    minWidth: 'fit-content',
    whiteSpace: 'nowrap'
  },
  summaryCardCashFund: {
    backgroundColor: '#F0F9FF',
    padding: '8px 14px',
    borderRadius: '999px',
    border: '2px solid #0EA5E9',
    boxShadow: '0 2px 4px rgba(14, 165, 233, 0.15)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#0C4A6E',
    minWidth: 'fit-content',
    whiteSpace: 'nowrap',
    position: 'relative'
  },
  cardTopBorder: {
    display: 'none'
  },
  cardLabel: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 0,
    textTransform: 'none' as const,
    letterSpacing: '0.02em',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  cardValue: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#111827',
    letterSpacing: '-0.02em',
    lineHeight: '1',
    marginBottom: 0,
  },
  cardSubValue: {
    fontSize: '10px',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  cardLabelCashFund: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 0,
    textTransform: 'none' as const,
    letterSpacing: '0.02em',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  cardValueCashFund: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#0C4A6E',
    letterSpacing: '-0.02em',
    lineHeight: '1',
    marginBottom: 0,
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
  },
  selectWrapper: {
    width: '100%',
    '& > div': {
      display: 'flex',
      alignItems: 'center',
      minHeight: '40px',
    },
    '& input, & [role="combobox"]': {
      display: 'flex',
      alignItems: 'center',
      minHeight: '40px',
      padding: '8px 12px',
    }
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
        type: account.type || 'UNKNOWN',
        totalAccounts: 1, // Simplificado - solo contamos las cuentas
        amount: account.amount || 0
      });
    });
    
    // Ordenar para que EMPLOYEE_CASH_FUND aparezca primero y BANK segundo
    accounts.sort((a, b) => {
      if (a.type === 'EMPLOYEE_CASH_FUND') return -1;
      if (b.type === 'EMPLOYEE_CASH_FUND') return 1;
      if (a.type === 'BANK') return -1;
      if (b.type === 'BANK') return 1;
      return 0;
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
  // Estado para controlar loading de amounts
  const [isRefreshingAmounts, setIsRefreshingAmounts] = useState(false);
  
  // Usar el contexto para obtener el refreshTrigger
  const { refreshTrigger } = useBalanceRefresh();

  // OPTIMIZADO: Usar network-only para obtener datos frescos cuando se triggea refresh
  const { data: routesData, loading: routesLoading, error: routesError, refetch: refetchRoutes } = useQuery<{ routes: RouteSimple[] }>(GET_ROUTES_SIMPLE, {
    variables: { where: {} },
    fetchPolicy: 'network-only', // Cambiado para obtener datos frescos
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

  // Efecto para triggear refetch cuando cambie el refreshTrigger
  React.useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 RouteLeadSelector: Triggeando refresh de balances, refreshTrigger:', refreshTrigger);
      setIsRefreshingAmounts(true);
      refetchRoutes().then(() => {
        console.log('✅ RouteLeadSelector: Refresh de balances completado');
        setIsRefreshingAmounts(false);
      }).catch((error) => {
        console.error('❌ RouteLeadSelector: Error en refresh de balances:', error);
        setIsRefreshingAmounts(false);
      });
    }
  }, [refreshTrigger, refetchRoutes]);

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
          fullName: option.data.personalData.fullName,
          addresses: option.data.personalData.addresses || []
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

  if (routesLoading) return (
    <Box css={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '200px',
      fontSize: '14px',
      color: '#6b7280'
    }}>
      Cargando rutas...
    </Box>
  );
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
        {isRefreshingAmounts && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#E0F2FE',
            borderRadius: '6px',
            border: '1px solid #0284C7',
            fontSize: '13px',
            color: '#0284C7',
            fontWeight: '500'
          }}>
            <span>Actualizando balances...</span>
          </div>
        )}
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
            <Box css={styles.selectWrapper}>
              <Select
                value={routeOptions.find(option => option.value === selectedRoute?.id) || null}
                options={routeOptions}
                onChange={handleRouteChange}
                placeholder="Seleccionar ruta"
                isLoading={routesLoading}
                data-testid="route-selector"
              />
            </Box>
          </Box>

          <Box css={styles.selector}>
            <div css={styles.selectorLabel}>Localidad</div>
            <Box css={styles.selectContainer}>
              <Box css={styles.selectWrapper}>
                <Select
                  value={leadOptions.find(option => option.value === selectedLead?.id) || null}
                  options={leadOptions}
                  onChange={handleLeadChange}
                  placeholder="Seleccionar localidad"
                  isLoading={leadsLoading}
                  isDisabled={!selectedRoute}
                  data-testid="lead-selector"
                />
              </Box>
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
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              Cuentas de la Ruta
              {isRefreshingAmounts && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: '#6B7280',
                  fontWeight: '400'
                }}>
                  <span>Actualizando...</span>
                </div>
              )}
            </div>
            <Box css={styles.accountsContainer}>
              {routeSummary.accounts.map((account) => {
                const isCashFund = account.type === 'EMPLOYEE_CASH_FUND';
                const isBank = account.type === 'BANK';
                const isSpecialAccount = isCashFund || isBank;
                
                return (
                  <div key={account.id} css={isSpecialAccount ? styles.summaryCardCashFund : styles.summaryCard}>
                    <span css={isSpecialAccount ? styles.cardLabelCashFund : styles.cardLabel}>{account.name}</span>
                    <span css={isSpecialAccount ? styles.cardValueCashFund : styles.cardValue}>
                      {isRefreshingAmounts ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>...</span>
                        </div>
                      ) : (
                        formatCurrency(account.amount)
                      )}
                    </span>
                    {isSpecialAccount && (
                      <div style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#0EA5E9',
                        borderRadius: '50%',
                        border: '2px solid white'
                      }} />
                    )}
                  </div>
                );
              })}
            </Box>
          </div>
        )}

        {(routesError || leadsError) && (
          <GraphQLErrorNotice networkError={routesError || leadsError} errors={[]} />
        )}
      </Box>
    </Box>
  );
};

export default RouteLeadSelectorComponent;
