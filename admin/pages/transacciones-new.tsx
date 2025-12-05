/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect } from 'react';
import { jsx } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { GET_ROUTES_SIMPLE } from '../graphql/queries/routes-optimized';
import RouteLeadSelectorNew from '../components/routes/RouteLeadSelectorNew';
import type { Route, Employee } from '../types/transaction';
import type { RouteWithEmployees, EmployeeWithTypename } from '../types/components';
import { CreateExpensesForm } from '../components/transactions/gastosTabNew';
import { CreditosTabNew } from '../components/transactions/CreditosTabNew';
import { CreatePaymentForm } from '../components/transactions/abonosTabNew';
import { SummaryTab } from '../components/transactions/SummaryTab';
import { SummaryTabNew } from '../components/transactions/SummaryTabNew';
import TransferForm from '../components/transactions/TransferTabNew';
import { BalanceRefreshProvider, useBalanceRefresh } from '../contexts/BalanceRefreshContext';
import { ToastProvider } from '../components/ui/toast';

// Theme Context
import { ThemeProvider, useTheme, useThemeColors } from '../contexts/ThemeContext';

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
      type: acc.type as any,
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
      addresses: lead.personalData.addresses,
      __typename: lead.personalData.__typename
    },
    __typename: lead.__typename
  };
}

function TransaccionesPageContent() {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

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
  const [showIncompleteAvals, setShowIncompleteAvals] = useState(false);

  const { triggerBalanceRefresh } = useBalanceRefresh();

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

  const { refreshTrigger } = useBalanceRefresh();
  useEffect(() => {
    if (activeTab === 'summary') {
      refetchSummary();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (showIncompleteAvals) {
      setSelectedRoute(null);
      setSelectedLead(null);
    }
  }, [showIncompleteAvals]);

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
  }, [selectedDate, refreshKey]);

  useEffect(() => {
    if (!routesLoading && isLoading) {
      const hideTimeout = setTimeout(() => {
        setIsLoading(false);
      }, 100);

      return () => clearTimeout(hideTimeout);
    }
  }, [routesLoading, isLoading]);

  const handleRouteSelect = (route: RouteWithEmployees | null) => {
    setSelectedRoute(route);
    setRefreshKey(prev => prev + 1);
  };

  const handleLeadSelect = (lead: Employee | null) => {
    if (lead && (lead as any).__typename) {
      setSelectedLead(lead as EmployeeWithTypename);
    } else if (lead) {
      setSelectedLead({
        ...lead,
        __typename: 'Employee',
        personalData: {
          ...lead.personalData,
          addresses: lead.personalData.addresses,
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
        <div css={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          background: themeColors.cardGradient,
          backgroundColor: themeColors.card,
          borderRadius: '12px',
          margin: '20px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}>
          <div css={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: isDark
              ? 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite'
          }} />

          <div css={{
            width: '60px',
            height: '60px',
            border: `4px solid ${themeColors.border}`,
            borderTop: `4px solid ${themeColors.primary}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px',
            position: 'relative',
            zIndex: 1
          }} />

          <div css={{
            fontSize: '18px',
            fontWeight: '600',
            color: themeColors.foreground,
            marginBottom: '8px',
            position: 'relative',
            zIndex: 1
          }}>
            Cargando transacciones...
          </div>

          <div css={{
            fontSize: '14px',
            color: themeColors.foregroundMuted,
            position: 'relative',
            zIndex: 1
          }}>
            Preparando datos para {activeTab === 'summary' ? 'resumen' :
                                 activeTab === 'payments' ? 'abonos' :
                                 activeTab === 'credits' ? 'créditos' :
                                 activeTab === 'expenses' ? 'gastos' : 'transferencias'}
          </div>

          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.5; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.05); }
            }
          `}</style>
        </div>
      );
    }

    switch (activeTab) {
      case 'summary':
        return (
          <SummaryTab
            selectedDate={selectedDate}
            selectedRoute={toRoute(selectedRoute)}
            refreshKey={refreshKey}
          />
        );
      case 'summary-new':
        return (
          <SummaryTabNew
            selectedDate={selectedDate}
            selectedRoute={toRoute(selectedRoute)}
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
          <CreditosTabNew
          selectedDate={selectedDate}
          selectedRoute={selectedRoute?.id || null}
          selectedLead={toCreditLead(selectedLead)}
        />
        );
      case 'payments':
        return (
          <>
            {/* Control para ver avales incompletos */}
            <div css={{
              marginBottom: '24px',
              backgroundColor: themeColors.backgroundSecondary,
              border: `1px solid ${themeColors.border}`,
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              flexWrap: 'wrap' as const,
              transition: 'all 0.3s ease',
            }}>
              <label css={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                color: themeColors.destructive
              }}>
                <input
                  type="checkbox"
                  checked={showIncompleteAvals}
                  onChange={(e) => setShowIncompleteAvals(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                <span>Ver avales incompletos</span>
              </label>
              {showIncompleteAvals && (
                <div css={{
                  fontSize: '13px',
                  color: themeColors.foregroundMuted,
                  fontStyle: 'italic',
                  padding: '4px 12px',
                  backgroundColor: themeColors.warningBackground,
                  borderRadius: '6px',
                  border: `1px solid ${themeColors.warning}`
                }}>
                  💡 Mostrando todos los préstamos con avales incompletos. Los préstamos aparecen marcados en naranja. Haz click en ellos para editar.
                </div>
              )}
            </div>
            <CreatePaymentForm
              selectedDate={selectedDate}
              selectedRoute={toRoute(selectedRoute)}
              selectedLead={toEmployee(selectedLead)}
              refreshKey={refreshKey}
              onSaveComplete={triggerBalanceRefresh}
              showAllLocalities={showIncompleteAvals}
              showOnlyIncompleteAvals={showIncompleteAvals}
            />
          </>
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
    <PageContainer 
      header={
        <h2 css={{ margin: 0 }}>Transacciones</h2>
      }
    >
      <div css={{
        minHeight: '100vh',
        background: themeColors.pageGradient,
        backgroundColor: themeColors.background,
        transition: 'background 0.3s ease',
        padding: '24px',
      }}>
        {/* Sección de selección de ruta y localidad */}
        <div css={{
          padding: '20px',
          backgroundColor: themeColors.card,
          borderRadius: '12px',
          border: `1px solid ${themeColors.border}`,
          marginBottom: '32px',
          transition: 'all 0.3s ease',
        }}>
          <RouteLeadSelectorNew
            selectedRoute={selectedRoute}
            selectedLead={selectedLead}
            selectedDate={selectedDate}
            onRouteSelect={handleRouteSelect}
            onLeadSelect={handleLeadSelect}
            onDateSelect={date => handleDateChange(date.toISOString())}
          />
        </div>

        {/* Sistema de tabs integrado */}
        <div css={{
          backgroundColor: themeColors.card,
          borderRadius: '12px',
          border: `1px solid ${themeColors.border}`,
          boxShadow: isDark
            ? '0 1px 3px rgba(0, 0, 0, 0.3)'
            : '0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease',
        }}>
          {/* Barra de tabs */}
          <div css={{
            display: 'flex',
            borderBottom: `1px solid ${themeColors.border}`,
            backgroundColor: themeColors.backgroundSecondary,
            padding: '0 4px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            transition: 'all 0.3s ease',
          }}>
            {[
              { key: 'summary', label: 'Resumen', testId: 'tab-summary' },
              { key: 'summary-new', label: 'Resumen New', testId: 'tab-summary-new' },
              { key: 'payments', label: 'Abonos', testId: 'tab-payments' },
              { key: 'credits', label: 'Créditos', testId: 'tab-credits' },
              { key: 'expenses', label: 'Gastos', testId: 'tab-expenses' },
              { key: 'transfers', label: 'Transferencias', testId: 'tab-transfers' }
            ].map((tab, index) => (
              <div
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                data-testid={tab.testId}
                css={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: activeTab === tab.key ? themeColors.card : 'transparent',
                  color: activeTab === tab.key ? themeColors.primary : themeColors.foregroundMuted,
                  border: 'none',
                  borderBottom: activeTab === tab.key ? `2px solid ${themeColors.primary}` : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.key ? '600' : '500',
                  transition: 'all 0.2s ease',
                  position: 'relative' as const,
                  textAlign: 'center' as const,
                  '&:hover': {
                    backgroundColor: activeTab === tab.key ? themeColors.card : themeColors.cardHover,
                    color: activeTab === tab.key ? themeColors.primary : themeColors.foregroundSecondary,
                  },
                  ...(index === 0 && {
                    borderTopLeftRadius: '8px'
                  }),
                  ...(index === 5 && {
                    borderTopRightRadius: '8px'
                  })
                }}
              >
                {tab.label}
              </div>
            ))}
          </div>

          {/* Contenido de la tab activa */}
          <div css={{
            padding: '0',
            backgroundColor: themeColors.card,
            minHeight: '400px',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
            transition: 'all 0.3s ease',
          }}>
            {renderTabContent()}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default function TransaccionesPage() {
  return (
    <ThemeProvider>
      <BalanceRefreshProvider>
        <ToastProvider>
          <TransaccionesPageContent />
        </ToastProvider>
      </BalanceRefreshProvider>
    </ThemeProvider>
  );
}
