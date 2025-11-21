/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect } from 'react';
import { Box, jsx } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { DatePicker } from '@keystone-ui/fields';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { GET_ROUTES_SIMPLE } from '../graphql/queries/routes-optimized';
import RouteLeadSelector from '../components/routes/RouteLeadSelector';
import type { Route, Employee } from '../types/transaction';
import type { RouteWithEmployees, EmployeeWithTypename } from '../types/components';
import { CreateExpensesForm } from '../components/transactions/gastosTab';
import { CreditosTabNew } from '../components/transactions/CreditosTabNew';
import { CreatePaymentForm } from '../components/transactions/abonosTab';
import { SummaryTab } from '../components/transactions/SummaryTab';
import TransferForm from '../components/transactions/TransferTab';
import { BalanceRefreshProvider, useBalanceRefresh } from '../contexts/BalanceRefreshContext';
import { ToastProvider } from '../components/ui/toast';

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
      addresses: lead.personalData.addresses,
      __typename: lead.personalData.__typename
    },
    __typename: lead.__typename
  };
}

function TransaccionesPageContent() {
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

  // Usar el contexto para obtener la función de refresh
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

  // Escuchar disparos de refresh de balance y forzar refetch del resumen
  const { refreshTrigger } = useBalanceRefresh();
  useEffect(() => {
    if (activeTab === 'summary') {
      refetchSummary();
    }
  }, [refreshTrigger]);

  // Cuando se activa "ver avales incompletos", limpiar selecciones de ruta y líder
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

  // Efecto para ocultar loading cuando Apollo termine
  useEffect(() => {
    if (!routesLoading && isLoading) {
      // Pequeño delay para asegurar transición suave
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
    // Si el lead ya tiene __typename, lo dejamos igual, si no, lo convertimos
    if (lead && (lead as any).__typename) {
      setSelectedLead(lead as EmployeeWithTypename);
    } else if (lead) {
      setSelectedLead({
        ...lead,
        __typename: 'Employee',
        personalData: {
          ...lead.personalData,
          addresses: lead.personalData.addresses, // Preservar addresses
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
        <Box css={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          borderRadius: '12px',
          margin: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Efecto de ondas de fondo */}
          <Box css={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite'
          }} />
          
          {/* Spinner moderno */}
          <Box css={{
            width: '60px',
            height: '60px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px',
            position: 'relative',
            zIndex: 1
          }} />
          
          {/* Texto de carga */}
          <Box css={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            position: 'relative',
            zIndex: 1
          }}>
            Cargando transacciones...
          </Box>
          
          {/* Subtítulo */}
          <Box css={{
            fontSize: '14px',
            color: '#6b7280',
            position: 'relative',
            zIndex: 1
          }}>
            Preparando datos para {activeTab === 'summary' ? 'resumen' : 
                                 activeTab === 'payments' ? 'abonos' :
                                 activeTab === 'credits' ? 'créditos' :
                                 activeTab === 'expenses' ? 'gastos' : 'transferencias'}
          </Box>
          
          {/* CSS para animaciones */}
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
        </Box>
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
            <Box marginBottom="large" style={{
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                color: '#DC2626'
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
                <div style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  fontStyle: 'italic',
                  padding: '4px 12px',
                  backgroundColor: '#FFF7ED',
                  borderRadius: '6px',
                  border: '1px solid #F97316'
                }}>
                  💡 Mostrando todos los préstamos con avales incompletos. Los préstamos aparecen marcados en naranja. Haz click en ellos para editar.
                </div>
              )}
            </Box>
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
    <PageContainer header={<h2>Transacciones</h2>}>
      <Box css={{ padding: '24px' }}>
        {/* Sección de selección de ruta y localidad */}
        <Box css={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '32px',
          padding: '20px',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #E2E8F0'
        }}>
          <RouteLeadSelector
            selectedRoute={selectedRoute}
            selectedLead={selectedLead}
            selectedDate={selectedDate}
            onRouteSelect={handleRouteSelect}
            onLeadSelect={handleLeadSelect}
            onDateSelect={date => handleDateChange(date.toISOString())}
          />
        </Box>

        {/* Sistema de tabs integrado */}
        <Box css={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Barra de tabs */}
          <Box css={{
            display: 'flex',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            padding: '0 4px'
          }}>
            {[
              { key: 'summary', label: 'Resumen', testId: 'tab-summary' },
              { key: 'payments', label: 'Abonos', testId: 'tab-payments' },
              { key: 'credits', label: 'Créditos', testId: 'tab-credits' },
              { key: 'expenses', label: 'Gastos', testId: 'tab-expenses' },
              { key: 'transfers', label: 'Transferencias', testId: 'tab-transfers' }
            ].map((tab, index) => (
              <Box
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                data-testid={tab.testId}
                css={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: activeTab === tab.key ? 'white' : 'transparent',
                  color: activeTab === tab.key ? '#1E40AF' : '#64748B',
                  border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid #3B82F6' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.key ? '600' : '500',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  textAlign: 'center',
                  '&:hover': {
                    backgroundColor: activeTab === tab.key ? 'white' : '#F1F5F9',
                    color: activeTab === tab.key ? '#1E40AF' : '#475569',
                  },
                  '&:first-of-type': {
                    borderTopLeftRadius: '8px'
                  },
                  '&:last-of-type': {
                    borderTopRightRadius: '8px'
                  }
                }}
              >
                {tab.label}
              </Box>
            ))}
          </Box>

          {/* Contenido de la tab activa */}
          <Box css={{
            padding: '0',
            backgroundColor: 'white',
            minHeight: '400px'
          }}>
            {renderTabContent()}
          </Box>
        </Box>
      </Box>
    </PageContainer>
  );
}

export default function TransaccionesPage() {
  return (
    <BalanceRefreshProvider>
      <ToastProvider>
        <TransaccionesPageContent />
      </ToastProvider>
    </BalanceRefreshProvider>
  );
}
