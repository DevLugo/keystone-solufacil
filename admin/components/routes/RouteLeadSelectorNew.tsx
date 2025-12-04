/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag jsx.Fragment */

import React, { useState, useEffect } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { jsx } from '@keystone-ui/core';
import { gql } from '@apollo/client';
import { FaTimes } from 'react-icons/fa';
import { useBalanceRefresh } from '../../contexts/BalanceRefreshContext';
import type { Employee, Option } from '../../types/transaction';

// Theme Context
import { useTheme, useThemeColors } from '../../contexts/ThemeContext';

// Import shadcn components
import { Button } from '../ui/button';

// GraphQL Queries
import { GET_LEADS_SIMPLE, GET_ROUTES_SIMPLE } from '../../graphql/queries/routes-optimized';

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

interface RouteLeadSelectorProps {
  selectedRoute: any | null;
  selectedLead: Employee | null;
  selectedDate: Date;
  onRouteSelect: (route: any | null) => void;
  onLeadSelect: (lead: Employee | null) => void;
  onDateSelect: (date: Date) => void;
  hideDateField?: boolean;
}

const processRouteStats = (route: RouteSimple) => {
  const accounts: AccountSummary[] = [];

  if (route.accounts && route.accounts.length > 0) {
    route.accounts.forEach(account => {
      accounts.push({
        id: account.id,
        name: account.name || 'Cuenta sin nombre',
        type: account.type || 'UNKNOWN',
        totalAccounts: 1,
        amount: account.amount || 0
      });
    });

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

const RouteLeadSelectorNew: React.FC<RouteLeadSelectorProps> = ({
  selectedRoute,
  selectedLead,
  selectedDate,
  onRouteSelect,
  onLeadSelect,
  onDateSelect,
  hideDateField = false,
}) => {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();
  const [isRefreshingAmounts, setIsRefreshingAmounts] = useState(false);
  const { refreshTrigger } = useBalanceRefresh();

  const { data: routesData, loading: routesLoading, refetch: refetchRoutes } = useQuery<{ routes: RouteSimple[] }>(GET_ROUTES_SIMPLE, {
    variables: { where: {} },
    fetchPolicy: 'network-only',
  });

  const [getLeads, { data: leadsData, loading: leadsLoading }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS_SIMPLE);

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

  React.useEffect(() => {
    if (refreshTrigger > 0) {
      setIsRefreshingAmounts(true);
      refetchRoutes().then(() => {
        setIsRefreshingAmounts(false);
      }).catch(() => {
        setIsRefreshingAmounts(false);
      });
    }
  }, [refreshTrigger, refetchRoutes]);

  const routes = routesData?.routes || [];
  const leads = leadsData?.employees || [];

  const uniqueLeads = leads.reduce((acc: Lead[], current: Lead) => {
    if (current.personalData?.id) {
      const exists = acc.find(lead => lead.personalData?.id === current.personalData?.id);
      if (!exists) {
        acc.push(current);
      }
    } else {
      const exists = acc.find(lead =>
        lead.personalData?.fullName === current.personalData?.fullName
      );
      if (!exists) {
        acc.push(current);
      }
    }
    return acc;
  }, []);

  const handleRouteChange = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    onRouteSelect(route || null);
    onLeadSelect(null);
  };

  const handleLeadChange = (leadId: string) => {
    const lead = uniqueLeads.find(l => l.id === leadId);
    if (lead) {
      onLeadSelect({
        id: lead.id,
        type: lead.type,
        personalData: {
          fullName: lead.personalData.fullName,
          addresses: lead.personalData.addresses || []
        },
        routes: {
          accounts: []
        }
      });
    } else {
      onLeadSelect(null);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    if (dateString) {
      const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
      const date = new Date(year, month - 1, day);
      date.setUTCHours(12, 0, 0, 0);
      onDateSelect(date);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (routesLoading) {
    return (
      <div css={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        fontSize: '14px',
        color: themeColors.foregroundMuted
      }}>
        Cargando rutas...
      </div>
    );
  }

  return (
    <div css={{
      width: '100%',
      padding: '0',
      transition: 'all 0.3s ease',
    }}>
      <div css={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <h2 css={{
          fontSize: '18px',
          fontWeight: '600',
          color: themeColors.foreground,
          margin: '0',
          transition: 'color 0.3s ease',
        }}>
          Selección de Ruta y Localidad
        </h2>
        {isRefreshingAmounts && (
          <div css={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: themeColors.infoBackground,
            borderRadius: '6px',
            border: `1px solid ${themeColors.info}`,
            fontSize: '13px',
            color: themeColors.infoForeground,
            fontWeight: '500',
            transition: 'all 0.3s ease',
          }}>
            <span>Actualizando balances...</span>
          </div>
        )}
      </div>

      <div css={{
        display: 'grid',
        gridTemplateColumns: hideDateField ? '1fr 1fr' : 'repeat(3, 1fr)',
        gap: '20px',
        width: '100%',
        marginBottom: '20px',
        '@media (max-width: 768px)': {
          gridTemplateColumns: '1fr',
          gap: '16px'
        }
      }}>
        {/* Ruta Selector */}
        <div css={{ width: '100%' }}>
          <label css={{
            fontSize: '14px',
            fontWeight: '600',
            color: themeColors.foreground,
            marginBottom: '8px',
            display: 'block',
            transition: 'color 0.3s ease',
          }}>
            Ruta
          </label>
          <select
            value={selectedRoute?.id || ''}
            onChange={(e) => handleRouteChange(e.target.value)}
            css={{
              width: '100%',
              height: '40px',
              padding: '8px 12px',
              border: `2px solid ${themeColors.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              color: themeColors.foreground,
              backgroundColor: themeColors.card,
              fontWeight: '500',
              transition: 'all 0.2s ease',
              outline: 'none',
              cursor: 'pointer',
              '&:focus': {
                borderColor: themeColors.primary,
                boxShadow: `0 0 0 3px ${themeColors.primary}20`,
              },
              '&:hover': {
                borderColor: themeColors.borderHover,
              }
            }}
          >
            <option value="">Seleccionar ruta</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name}
              </option>
            ))}
          </select>
        </div>

        {/* Localidad Selector */}
        <div css={{ width: '100%' }}>
          <label css={{
            fontSize: '14px',
            fontWeight: '600',
            color: themeColors.foreground,
            marginBottom: '8px',
            display: 'block',
            transition: 'color 0.3s ease',
          }}>
            Localidad
          </label>
          <div css={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}>
            <select
              value={selectedLead?.id || ''}
              onChange={(e) => handleLeadChange(e.target.value)}
              disabled={!selectedRoute}
              css={{
                width: '100%',
                height: '40px',
                padding: '8px 12px',
                border: `2px solid ${themeColors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                color: themeColors.foreground,
                backgroundColor: themeColors.card,
                fontWeight: '500',
                transition: 'all 0.2s ease',
                outline: 'none',
                cursor: selectedRoute ? 'pointer' : 'not-allowed',
                opacity: selectedRoute ? 1 : 0.6,
                '&:focus': {
                  borderColor: themeColors.primary,
                  boxShadow: `0 0 0 3px ${themeColors.primary}20`,
                },
                '&:hover': {
                  borderColor: selectedRoute ? themeColors.borderHover : themeColors.border,
                }
              }}
            >
              <option value="">Seleccionar localidad</option>
              {uniqueLeads.map((lead) => {
                const locality = lead.personalData?.addresses?.[0]?.location?.name || '';
                const state = (lead.personalData as any)?.addresses?.[0]?.location?.municipality?.state?.name || '';
                const label = locality && state
                  ? `${locality} · ${state} · (${lead.personalData?.fullName})`
                  : locality || lead.personalData?.fullName || 'Sin nombre';
                return (
                  <option key={lead.id} value={lead.id}>
                    {label}
                  </option>
                );
              })}
            </select>
            {selectedLead && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onLeadSelect(null)}
                title="Limpiar localidad seleccionada"
              >
                <FaTimes />
              </Button>
            )}
          </div>
        </div>

        {/* Date Selector */}
        {!hideDateField && (
          <div css={{ width: '100%' }}>
            <label css={{
              fontSize: '14px',
              fontWeight: '600',
              color: themeColors.foreground,
              marginBottom: '8px',
              display: 'block',
              transition: 'color 0.3s ease',
            }}>
              Fecha
            </label>
            <input
              type="date"
              value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
              onChange={handleDateChange}
              css={{
                width: '100%',
                padding: '12px 16px',
                border: `2px solid ${themeColors.border}`,
                borderRadius: '10px',
                fontSize: '14px',
                color: themeColors.foreground,
                backgroundColor: themeColors.card,
                fontWeight: '500',
                transition: 'all 0.2s ease',
                outline: 'none',
                '&:focus': {
                  borderColor: themeColors.primary,
                  boxShadow: `0 0 0 3px ${themeColors.primary}20`,
                },
                '&:hover': {
                  borderColor: themeColors.borderHover,
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Cuentas de la Ruta */}
      {selectedRoute && routeSummary && (
        <div>
          <div css={{
            fontSize: '13px',
            fontWeight: '600',
            color: themeColors.foreground,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'color 0.3s ease',
          }}>
            Cuentas de la Ruta
            {isRefreshingAmounts && (
              <div css={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: themeColors.foregroundMuted,
                fontWeight: '400'
              }}>
                <span>Actualizando...</span>
              </div>
            )}
          </div>
          <div css={{
            display: 'flex',
            flexWrap: 'wrap' as const,
            gap: '8px',
            width: '100%',
            marginTop: '8px',
          }}>
            {routeSummary.accounts.map((account) => {
              const isCashFund = account.type === 'EMPLOYEE_CASH_FUND';
              const isBank = account.type === 'BANK';
              const isSpecialAccount = isCashFund || isBank;

              return (
                <div
                  key={account.id}
                  css={{
                    backgroundColor: isSpecialAccount
                      ? (isDark ? '#1e3a8a' : '#F0F9FF')
                      : themeColors.card,
                    padding: isSpecialAccount ? '8px 14px' : '6px 12px',
                    borderRadius: '999px',
                    border: isSpecialAccount
                      ? `2px solid ${isDark ? '#3b82f6' : '#0EA5E9'}`
                      : `1px solid ${themeColors.border}`,
                    boxShadow: isSpecialAccount
                      ? (isDark ? '0 2px 4px rgba(59, 130, 246, 0.25)' : '0 2px 4px rgba(14, 165, 233, 0.15)')
                      : '0 1px 2px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: isSpecialAccount ? '12px' : '12px',
                    fontWeight: isSpecialAccount ? '600' : '500',
                    color: isSpecialAccount
                      ? (isDark ? '#dbeafe' : '#0C4A6E')
                      : themeColors.foregroundSecondary,
                    minWidth: 'fit-content',
                    whiteSpace: 'nowrap' as const,
                    position: 'relative' as const,
                    transition: 'all 0.3s ease',
                  }}
                >
                  <span css={{
                    fontSize: '11px',
                    fontWeight: isSpecialAccount ? '600' : '500',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {account.name}
                  </span>
                  <span css={{
                    fontSize: isSpecialAccount ? '13px' : '12px',
                    fontWeight: isSpecialAccount ? '700' : '600',
                  }}>
                    {isRefreshingAmounts ? '...' : formatCurrency(account.amount)}
                  </span>
                  {isSpecialAccount && (
                    <div css={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      width: '8px',
                      height: '8px',
                      backgroundColor: isDark ? '#3b82f6' : '#0EA5E9',
                      borderRadius: '50%',
                      border: `2px solid ${themeColors.card}`
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteLeadSelectorNew;
