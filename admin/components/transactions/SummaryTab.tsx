/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useMemo } from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { gql, useQuery } from '@apollo/client';

const GET_TRANSACTIONS_SUMMARY = gql`
  query GetTransactionsSummary($startDate: String!, $endDate: String!, $routeId: String) {
    getTransactionsSummary(startDate: $startDate, endDate: $endDate, routeId: $routeId) {
      date
      locality
      abono
      cashAbono
      bankAbono
      credito
      viatic
      gasoline
      accommodation
      nominaSalary
      externalSalary
      vehiculeMaintenance
      loanGranted
      loanPaymentComission
      loanGrantedComission
      leadComission
      leadExpense
      moneyInvestment
      otro
      balance
      profit
      cashBalance
      bankBalance
      transferFromCash
      transferToBank
    }
  }
`;

const GET_BANK_INCOME_TRANSACTIONS = gql`
  query GetBankIncomeTransactions($startDate: DateTime!, $endDate: DateTime!, $routeId: ID!) {
    transactions(where: {
      AND: [
        { date: { gte: $startDate, lte: $endDate } },
        { route: { id: { equals: $routeId } } },
        {
          OR: [
            { 
              AND: [
                { type: { equals: "TRANSFER" } },
                { destinationAccount: { type: { equals: "BANK" } } }
              ]
            },
            { 
              AND: [
                { type: { equals: "INCOME" } },
                { 
                  OR: [
                    { incomeSource: { equals: "BANK_LOAN_PAYMENT" } },
                    { incomeSource: { equals: "MONEY_INVESMENT" } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }) {
      id
      amount
      type
      incomeSource
      createdAt
      date
      description
      route {
        id
        name
      }
      lead {
        id
        personalData {
          fullName
          addresses {
            location {
              name
              municipality {
                name
                state {
                  name
                }
              }
            }
          }
        }
      }
      destinationAccount {
        id
        type
      }
      sourceAccount {
        id
        type
      }
        leadPaymentReceived {
          id
          lead {
            id
            personalData {
              fullName
              addresses {
                location {
                  name
                  municipality {
                    name
                    state {
                      name
                    }
                  }
                }
              }
            }
          }
          payments {
            id
            amount
            receivedAt
            loan {
              borrower {
                personalData {
                  fullName
                }
              }
            }
          }
        }
        loanPayment {
          id
          amount
          comission
          paymentMethod
          receivedAt
        }
    }
  }
`;

interface SummaryTabProps {
  selectedDate: Date;
  selectedRoute?: Route | null;
  refreshKey: number;
}

interface BankIncomeData {
  id: string;
  name: string;
  date: string;
  amount: number;
  type: string;
  locality?: string;
  employeeName?: string;
  leaderLocality?: string;
  description?: string;
}

interface Route {
  id: string;
  name: string;
}

interface LocalitySummary {
  locality: string;
  municipality: string;
  state: string;
  leaderName: string;
  locationKey: string;
  totalIncome: number;
  totalExpenses: number;
  totalComissions: number;
  balance: number;
  profit: number;
  cashBalance: number;
  bankBalance: number;
  details: any[];
}

// Modal de Entradas al Banco
const BankIncomeModal = ({ 
  isOpen, 
  onClose, 
  bankIncomes, 
  totalTransactions, 
  totalAmount,
  loading = false
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  bankIncomes: BankIncomeData[]; 
  totalTransactions: number; 
  totalAmount: number; 
  loading?: boolean;
}) => {
  const [copied, setCopied] = useState(false);

  const formatForCopy = () => {
    let text = `ENTRADAS AL BANCO - RESUMEN\n`;
    text += `Total: $${totalAmount.toFixed(2)} (${totalTransactions} transacciones)\n\n`;

    text += `Entradas al Banco\n`;
    bankIncomes.forEach(income => {
      const date = new Date(income.date).toLocaleDateString('es-MX');
      const employee = income.employeeName ? ` (${income.employeeName}` : '';
      const leaderLocality = income.leaderLocality ? ` - ${income.leaderLocality}` : '';
      const employeeInfo = income.employeeName ? `${employee}${leaderLocality})` : '';
      text += `-${income.name}${employeeInfo}, ${date}, $${income.amount.toFixed(2)}\n`;
    });

    return text;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatForCopy());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  if (!isOpen) return null;

  console.log('🎯 Modal recibiendo datos:', { bankIncomes, totalTransactions, totalAmount });

  const groupedByLocality = bankIncomes.reduce((acc: Record<string, BankIncomeData[]>, income) => {
    const locality = income.locality || 'Sin localidad';
    if (!acc[locality]) {
      acc[locality] = [];
    }
    acc[locality].push(income);
    return acc;
  }, {});

  return (
    <Box css={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <Box css={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '800px',
        maxHeight: '80vh',
        width: '90%',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <Box css={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <Box css={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#1f2937'
          }}>
            💰 Entradas al Banco
          </Box>
          <Box css={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <Box css={{
              fontSize: '14px',
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
              padding: '6px 12px',
              borderRadius: '6px'
            }}>
              {totalTransactions} transacciones - ${totalAmount.toFixed(2)}
            </Box>
            <button
              onClick={handleCopy}
              css={{
                backgroundColor: copied ? '#10b981' : '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: copied ? '#059669' : '#2563eb'
                }
              }}
            >
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
            <button
              onClick={onClose}
              css={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: '#dc2626'
                }
              }}
            >
              ✕ Cerrar
            </button>
          </Box>
        </Box>

        {/* Content */}
        <Box css={{ maxHeight: '60vh', overflow: 'auto' }}>
          {loading ? (
            <Box css={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <Box css={{
                width: '40px',
                height: '40px',
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '16px'
              }} />
              <Box css={{
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Cargando entradas al banco...
              </Box>
            </Box>
          ) : (
            <Box css={{ marginBottom: '24px' }}>
              <Box css={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#374151',
                marginBottom: '12px',
                padding: '8px 12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                borderLeft: '4px solid #3b82f6'
              }}>
                Entradas al Banco
              </Box>
              {bankIncomes.map((income) => (
                <Box key={income.id} css={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 16px',
                  marginBottom: '4px',
                  backgroundColor: income.type === 'TRANSFER' ? '#f0f9ff' : 
                                 income.type === 'BANK_ABONO' ? '#f0fdf4' :
                                 income.type === 'MONEY_INVESTMENT' ? '#fef3c7' : 
                                 income.type === 'INCOME' ? '#f3e8ff' : '#fef2f2',
                  borderRadius: '4px',
                  borderLeft: `3px solid ${income.type === 'TRANSFER' ? '#0ea5e9' : 
                                        income.type === 'BANK_ABONO' ? '#22c55e' :
                                        income.type === 'MONEY_INVESTMENT' ? '#f59e0b' : 
                                        income.type === 'INCOME' ? '#a855f7' : '#ef4444'}`
                }}>
                  <Box css={{ flex: 1 }}>
                    <Box css={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151'
                    }}>
                      {income.name}
                    </Box>
                    {income.employeeName && (
                      <Box css={{
                        fontSize: '12px',
                        color: '#6b7280',
                        marginTop: '2px'
                      }}>
                        Por: {income.employeeName}
                        {income.leaderLocality && (
                          <span css={{ marginLeft: '8px', color: '#9ca3af' }}>
                            ({income.leaderLocality})
                          </span>
                        )}
                      </Box>
                    )}
                    {income.description && (
                      <Box css={{
                        fontSize: '12px',
                        color: '#6b7280',
                        marginTop: '2px'
                      }}>
                        {income.description}
                      </Box>
                    )}
                  </Box>
                  <Box css={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginRight: '16px'
                  }}>
                    {new Date(income.date).toLocaleDateString('es-MX')}
                  </Box>
                  <Box css={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#059669'
                  }}>
                    ${income.amount.toFixed(2)}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// Componente reutilizable para mensaje de selección
const SelectionMessage = ({ 
  icon, 
  title, 
  description, 
  requirements 
}: { 
  icon: string; 
  title: string; 
  description: string; 
  requirements: string[] 
}) => (
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
    
    {/* Icono */}
    <Box css={{
      width: '60px',
      height: '60px',
      background: 'rgba(59, 130, 246, 0.1)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '20px',
      position: 'relative',
      zIndex: 1
    }}>
      <Box css={{ fontSize: '28px' }}>{icon}</Box>
    </Box>
    
    {/* Título */}
    <Box css={{
      fontSize: '18px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '8px',
      position: 'relative',
      zIndex: 1
    }}>
      {title}
    </Box>
    
    {/* Descripción */}
    <Box css={{
      fontSize: '14px',
      color: '#6b7280',
      marginBottom: '16px',
      textAlign: 'center',
      position: 'relative',
      zIndex: 1
    }}>
      {description}
    </Box>
    
    {/* Requisitos */}
    <Box css={{
      position: 'relative',
      zIndex: 1
    }}>
      {requirements.map((req, index) => (
        <Box key={index} css={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '8px',
          fontSize: '13px',
          color: '#6b7280'
        }}>
          <Box css={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#9ca3af',
            marginRight: '8px'
          }} />
          {req}
        </Box>
      ))}
    </Box>
    
    {/* CSS para animaciones */}
    <style jsx>{`
      @keyframes pulse {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.05); }
      }
    `}</style>
  </Box>
);

export const SummaryTab = ({ selectedDate, selectedRoute, refreshKey }: SummaryTabProps) => {
  const { data, loading, error, refetch } = useQuery(GET_TRANSACTIONS_SUMMARY, {
    variables: {
      startDate: (() => {
        // Crear fecha en UTC para 00:00 hora México (06:00 UTC)
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();
        const startDate = new Date(Date.UTC(year, month, day, 6, 0, 0, 0)); // 06:00 UTC = 00:00 México
        return startDate.toISOString();
      })(),
      endDate: (() => {
        // Crear fecha en UTC para 23:59 hora México (05:59 UTC del día siguiente)
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();
        const endDate = new Date(Date.UTC(year, month, day + 1, 5, 59, 59, 999)); // 05:59 UTC = 23:59 México
        return endDate.toISOString();
      })(),
      routeId: selectedRoute?.id
    },
    skip: !selectedDate || !selectedRoute
  });

  const [expandedLocality, setExpandedLocality] = useState<string | null>(null);
  const [showBankIncomeModal, setShowBankIncomeModal] = useState(false);
  const [isLoadingBankIncome, setIsLoadingBankIncome] = useState(false);

  // Query para obtener entradas al banco (solo se ejecuta cuando se abre el modal)
  const { data: bankIncomeData, loading: bankIncomeLoading, refetch: refetchBankIncome, error: bankIncomeError } = useQuery(GET_BANK_INCOME_TRANSACTIONS, {
    variables: {
      routeId: selectedRoute?.id,
      startDate: (() => {
        // Calcular inicio de semana (lunes) en UTC para 00:00 hora México (06:00 UTC)
        console.log('🔍 selectedDate original:', selectedDate);
        const startOfWeek = new Date(selectedDate);
        const dayOfWeek = startOfWeek.getDay(); // 0 = domingo, 1 = lunes, etc.
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Ajustar para que lunes = 0
        console.log('🔍 dayOfWeek:', dayOfWeek, 'daysToMonday:', daysToMonday);
        startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
        console.log('🔍 startOfWeek (lunes):', startOfWeek);
        
        const year = startOfWeek.getFullYear();
        const month = startOfWeek.getMonth();
        const day = startOfWeek.getDate();
        console.log('🔍 startOfWeek components:', { year, month, day });
        const startDate = new Date(Date.UTC(year, month, day, 6, 0, 0, 0)); // 06:00 UTC = 00:00 México
        console.log('🔍 startDate calculado (lunes):', startDate);
        const result = startDate.toISOString();
        console.log('🔍 startDate ISO result:', result);
        return result;
      })(),
      endDate: (() => {
        // Calcular fin de semana (domingo) en UTC para 23:59 hora México (05:59 UTC del día siguiente)
        console.log('🔍 selectedDate original para endDate:', selectedDate);
        const startOfWeek = new Date(selectedDate);
        const dayOfWeek = startOfWeek.getDay(); // 0 = domingo, 1 = lunes, etc.
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Ajustar para que lunes = 0
        startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6); // Domingo
        console.log('🔍 endOfWeek (domingo):', endOfWeek);
        
        const year = endOfWeek.getFullYear();
        const month = endOfWeek.getMonth();
        const day = endOfWeek.getDate();
        console.log('🔍 endOfWeek components:', { year, month, day });
        const endDate = new Date(Date.UTC(year, month, day + 1, 5, 59, 59, 999)); // 05:59 UTC del día siguiente = 23:59 México
        console.log('🔍 endDate calculado (domingo):', endDate);
        const result = endDate.toISOString();
        console.log('🔍 endDate ISO result:', result);
        return result;
      })()
    },
    skip: !showBankIncomeModal || !selectedDate || !selectedRoute?.id, // Solo ejecutar cuando el modal esté abierto y tengamos los datos necesarios
    fetchPolicy: 'no-cache', // No usar caché
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => {
      console.log('✅ Consulta completada con datos:', data);
    },
    onError: (error) => {
      console.error('❌ Error en consulta de entradas al banco:', error);
    }
  });

  useEffect(() => {
    if (selectedDate) {
      refetch();
    }
  }, [refreshKey, refetch, selectedDate]);

  // Procesar datos de entradas al banco usando useMemo
  const { bankIncomes, totalTransactions, totalAmount } = useMemo(() => {
    console.log('🚀 Iniciando processBankIncomeData con:', bankIncomeData);
    
    // Solo procesar si tenemos datos y no estamos en estado de carga
    if (!bankIncomeData || bankIncomeLoading) {
      console.log('❌ No hay bankIncomeData o está cargando, retornando array vacío');
      return { bankIncomes: [], totalTransactions: 0, totalAmount: 0 };
    }

    console.log('🔍 Procesando datos de entradas al banco:', bankIncomeData);

    const bankIncomes: BankIncomeData[] = [];
    let totalAmount = 0;

    // Procesar transacciones que aumentan el balance del banco
    if (bankIncomeData.transactions) {
      console.log('📋 Hay transacciones para procesar:', bankIncomeData.transactions.length);
      console.log('📋 Todas las transacciones encontradas:', bankIncomeData.transactions.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        createdAt: t.createdAt,
        date: t.date,
        routeId: t.route?.id,
        routeName: t.route?.name,
        incomeSource: t.incomeSource,
        destinationAccount: t.destinationAccount?.type,
        sourceAccount: t.sourceAccount?.type,
        description: t.description,
        leadName: t.lead?.personalData?.fullName
      })));
      
      // Buscar específicamente transacciones de Nicolás Bravo Campeche
      const nicolasBravoTransactions = bankIncomeData.transactions.filter((t: any) => 
        t.route?.name?.toLowerCase().includes('nicolas') || 
        t.route?.name?.toLowerCase().includes('bravo') ||
        t.route?.name?.toLowerCase().includes('campeche')
      );
      
      console.log('🏛️ Transacciones de Nicolás Bravo Campeche:', nicolasBravoTransactions.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        createdAt: t.createdAt,
        routeName: t.route?.name,
        incomeSource: t.incomeSource,
        description: t.description,
        leadPaymentReceivedId: t.leadPaymentReceived?.id
      })));
      
      // Buscar transacciones con leadPaymentReceived específico
      const leadPaymentTransactions = bankIncomeData.transactions.filter((t: any) => 
        t.leadPaymentReceived?.id === 'cmg2omsj60021vpayxbbya1lt'
      );
      
      console.log('💳 Transacciones del LeadPaymentReceived cmg2omsj60021vpayxbbya1lt:', leadPaymentTransactions.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        createdAt: t.createdAt,
        incomeSource: t.incomeSource,
        description: t.description
      })));
      
      // Filtrar transacciones por ruta seleccionada
      const filteredTransactions = bankIncomeData.transactions.filter((transaction: any) => {
        const isCorrectRoute = transaction.route?.id === selectedRoute?.id;
        if (!isCorrectRoute) {
          console.log('❌ Transacción no es de la ruta seleccionada:', {
            transactionRouteId: transaction.route?.id,
            selectedRouteId: selectedRoute?.id,
            routeName: transaction.route?.name
          });
        }
        return isCorrectRoute;
      });
      
      console.log('📋 Transacciones filtradas por ruta:', filteredTransactions.length);
      
      // Log de transacciones que podrían ser entradas al banco
      const potentialBankIncomes = filteredTransactions.filter((t: any) => {
        return t.type === 'TRANSFER' || 
               t.type === 'INCOME' || 
               (t.destinationAccount?.type === 'BANK') ||
               (t.incomeSource === 'BANK_LOAN_PAYMENT' || t.incomeSource === 'MONEY_INVESMENT');
      });
      
      console.log('💰 Transacciones potenciales de entrada al banco:', potentialBankIncomes.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        incomeSource: t.incomeSource,
        destinationAccount: t.destinationAccount?.type,
        description: t.description
      })));
      
      for (const transaction of filteredTransactions) {
        console.log('📊 Procesando transacción:', {
          id: transaction.id,
          type: transaction.type,
          incomeSource: transaction.incomeSource,
          amount: transaction.amount,
          destinationAccount: transaction.destinationAccount
        });
        
        let name = '';
        let locality = '';
        let employeeName = '';
        let leaderLocality = '';

        // Obtener nombre del empleado que realizó la transacción y su localidad
        if (transaction.lead?.personalData) {
          employeeName = transaction.lead.personalData.fullName || 'Empleado desconocido';
          
          // Extraer localidad del líder
          if (transaction.lead.personalData.addresses && transaction.lead.personalData.addresses.length > 0) {
            const address = transaction.lead.personalData.addresses[0];
            if (address.location) {
              leaderLocality = address.location.name || 'Sin localidad';
              if (address.location.municipality?.state?.name) {
                leaderLocality += `, ${address.location.municipality.state.name}`;
              }
            }
          }
        }

        // Determinar si es una entrada al banco y el nombre según el tipo de transacción
        let isBankIncome = false;
        
        switch (transaction.type) {
          case 'TRANSFER':
            // Verificar si es una transferencia al banco
            if (transaction.destinationAccount?.type === 'BANK') {
              name = 'Pago de líder';
              locality = 'Entradas al Banco';
              isBankIncome = true;
              console.log('✅ TRANSFER al banco:', { name, locality });
            } else {
              console.log('❌ TRANSFER no al banco:', transaction.destinationAccount?.type);
              continue; // Saltar esta transacción
            }
            break;
          case 'INCOME':
            console.log('🔍 Procesando INCOME con incomeSource:', transaction.incomeSource);
            // Solo procesar INCOME que realmente aumentan el balance del banco
            if (transaction.incomeSource === 'BANK_LOAN_PAYMENT' || 
                transaction.incomeSource === 'MONEY_INVESMENT') {
              
              if (transaction.incomeSource === 'BANK_LOAN_PAYMENT') {
                name = transaction.description || 'Pago bancario de préstamo';
                locality = 'Entradas al Banco';
                isBankIncome = true;
                console.log('✅ Procesando BANK_LOAN_PAYMENT:', { name, locality });
              } else if (transaction.incomeSource === 'MONEY_INVESMENT') {
                name = transaction.description || 'Inversión de dinero';
                locality = 'Entradas al Banco';
                isBankIncome = true;
                console.log('✅ Procesando MONEY_INVESMENT:', { name, locality });
              }
            } else {
              console.log('❌ Saltando transacción INCOME:', transaction.incomeSource);
              continue; // Saltar esta transacción
            }
            break;
          default:
            // Para otros tipos, verificar si tienen destinationAccount bancario
            if (transaction.destinationAccount?.type === 'BANK') {
              name = transaction.description || `Transacción ${transaction.type}`;
              locality = 'Entradas al Banco';
              isBankIncome = true;
              console.log('✅ Otra transacción al banco:', { type: transaction.type, name, locality });
            } else {
              console.log('❌ Transacción no al banco:', { type: transaction.type, destinationAccount: transaction.destinationAccount?.type });
              continue; // Saltar esta transacción
            }
        }
        
        // Si no es una entrada al banco, saltar esta transacción
        if (!isBankIncome) {
          console.log('❌ No es entrada al banco, saltando transacción:', transaction.type);
          continue; // Saltar esta transacción
        }

        // Si hay LeadPaymentReceived asociado, usar esa información
        if (transaction.leadPaymentReceived) {
          const lpr = transaction.leadPaymentReceived;
          if (lpr.lead?.personalData) {
            locality = lpr.lead.personalData.fullName || 'Sin localidad';
            
            // Extraer localidad del líder desde leadPaymentReceived
            if (lpr.lead.personalData.addresses && lpr.lead.personalData.addresses.length > 0) {
              const address = lpr.lead.personalData.addresses[0];
              if (address.location) {
                leaderLocality = address.location.name || 'Sin localidad';
                if (address.location.municipality?.state?.name) {
                  leaderLocality += `, ${address.location.municipality.state.name}`;
                }
              }
            }
          }
          
          // Si hay pagos asociados, usar el nombre del cliente
          if (lpr.payments && lpr.payments.length > 0) {
            const firstPayment = lpr.payments[0];
            if (firstPayment.loan?.borrower?.personalData) {
              name = firstPayment.loan.borrower.personalData.fullName || 'Cliente desconocido';
            }
          }
        } else {
          // Si no hay LeadPaymentReceived, usar la información de la ruta y el lead
          // locality ya se estableció en el switch anterior
          
          // Si no hay descripción específica, usar el nombre del lead
          if (!name || name === 'Ingreso bancario') {
            if (transaction.lead?.personalData?.fullName) {
              name = `Ingreso - ${transaction.lead.personalData.fullName}`;
            }
          }
        }

        const bankIncomeItem = {
          id: transaction.id,
          name,
          date: transaction.date || transaction.createdAt, // Usar date si existe, sino createdAt
          amount: parseFloat(transaction.amount),
          type: transaction.type,
          locality,
          employeeName,
          leaderLocality,
          description: transaction.description
        };
        
        console.log('💾 Agregando transacción al array:', bankIncomeItem);
        bankIncomes.push(bankIncomeItem);
        totalAmount += parseFloat(transaction.amount);
      }
      console.log('✅ Bucle completado. Total procesadas:', bankIncomes.length);
    } else {
      console.log('❌ No hay transacciones en bankIncomeData.transactions');
    }

    const result = {
      bankIncomes: bankIncomes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalTransactions: bankIncomes.length,
      totalAmount
    };
    
    console.log('✅ Resultado final:', result);
    return result;
  }, [bankIncomeData, bankIncomeLoading]);

  if (!selectedDate) return <div>Seleccione una fecha</div>;
  
  // Validar que se haya seleccionado una ruta
  if (!selectedRoute) {
    return (
      <SelectionMessage
        icon="📍"
        title="Selecciona una Ruta"
        description="Para mostrar el resumen financiero, necesitas seleccionar una ruta específica."
        requirements={[
          "Selecciona una ruta desde el selector superior",
          "El resumen se generará automáticamente",
          "Podrás ver todos los datos de la ruta seleccionada"
        ]}
      />
    );
  }
  
  if (loading) return (
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
        Cargando resumen...
      </Box>
      
      {/* Subtítulo */}
      <Box css={{
        fontSize: '14px',
        color: '#6b7280',
        position: 'relative',
        zIndex: 1
      }}>
        Preparando datos de transacciones
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
  if (error) return <div>Error: {error.message}</div>;

  const summaryData = data?.getTransactionsSummary || [];

  // CAMBIO: Ahora agrupamos por localidad usando las transacciones individuales
  const groupedByLocality = summaryData.reduce((acc: Record<string, any>, item: any) => {
    // Extraer información de ubicación del campo locality que contiene "Líder - Localidad, Estado"
    let localityName = 'General';
    let municipalityName = '';
    let stateName = '';
    let leaderName = '';
    
    if (item.locality && item.locality !== 'General') {
      // Si contiene " - ", extraer la parte después del " - "
      if (item.locality.includes(' - ')) {
        const parts = item.locality.split(' - ');
        if (parts.length > 1) {
          leaderName = parts[0].trim(); // "ESMERALDA ACOSTA MOO"
          const locationPart = parts[1]; // "CASTAMAY, CAMPECHE, CAMPECHE"
          // Separar localidad, municipio y estado por las comas
          if (locationPart.includes(',')) {
            const locationParts = locationPart.split(',').map((s: string) => s.trim());
            if (locationParts.length >= 3) {
              localityName = locationParts[0];    // "CASTAMAY"
              municipalityName = locationParts[1]; // "CAMPECHE"
              stateName = locationParts[2];       // "CAMPECHE"
            } else if (locationParts.length === 2) {
              // Formato anterior: "LOCALIDAD, ESTADO"
              localityName = locationParts[0];
              stateName = locationParts[1];
              municipalityName = locationParts[0]; // Usar localidad como municipio
            }
          } else {
            localityName = locationPart;
            municipalityName = locationPart;
          }
        }
      } else {
        localityName = item.locality;
        municipalityName = item.locality;
      }
    }
    
    // Crear una clave única que incluya localidad, municipio y estado (como RouteLeadSelector)
    const locationKey = stateName ? `${localityName} · ${municipalityName} · ${stateName} · (${leaderName})` : localityName;
    
    if (!acc[locationKey]) {
      acc[locationKey] = {
        locality: localityName,
        municipality: municipalityName,
        state: stateName,
        leaderName: leaderName,
        locationKey: locationKey,
        totalIncome: 0,
        totalExpenses: 0,
        totalComissions: 0,
        balance: 0,
        profit: 0,
        cashBalance: 0,
        bankBalance: 0,
        details: []
      };
    }
    
    // Calcular totales
    const income = item.abono + item.moneyInvestment;
    const expenses = item.viatic + item.gasoline + item.accommodation + 
                    item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                    item.otro + item.leadExpense; // loanGranted se muestra por separado
    const comissions = item.loanPaymentComission + item.loanGrantedComission + item.leadComission;
    
    // CORREGIDO: Usar directamente los balances del API (ya calculados correctamente)
    // El API ya tiene la lógica correcta para calcular balances
    const calculatedCashBalance = item.cashBalance;
    const calculatedBankBalance = item.bankBalance;

    acc[locationKey].totalIncome += income;
    acc[locationKey].totalExpenses += expenses;
    acc[locationKey].totalComissions += comissions;
    acc[locationKey].balance += item.balance;
    acc[locationKey].profit += item.profit;
    acc[locationKey].cashBalance += calculatedCashBalance;
    acc[locationKey].bankBalance += calculatedBankBalance;
    acc[locationKey].details.push(item);

    return acc;
  }, {});

  const localities = Object.values(groupedByLocality) as LocalitySummary[];

  return (
    <Box css={{ 
      padding: '16px',
      background: '#f8fafc',
      minHeight: '100vh'
    }}>
      {localities.map((locality: any) => (
        <Box key={locality.locationKey} css={{ 
          marginBottom: '20px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          border: '1px solid #e5e7eb'
        }}>
          {/* Header minimalista */}
          <Box css={{
            background: '#374151',
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <Box css={{ display: 'flex', alignItems: 'center' }}>
              <Box css={{
                width: '32px',
                height: '32px',
                background: '#6b7280',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px'
              }}>
                <Box css={{ fontSize: '16px' }}>📍</Box>
              </Box>
              <Box>
          <h2 css={{ 
                  margin: '0',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  {locality.locationKey}
          </h2>
                <Box css={{
                  color: '#9ca3af',
                  fontSize: '12px',
                  marginTop: '2px'
                }}>
                  Resumen financiero del día
                </Box>
              </Box>
            </Box>
          </Box>
          {/* Contenido principal con padding */}
          <Box css={{ padding: '16px' }}>
            {/* Tabla principal con diseño minimalista */}
            <Box css={{
              background: 'white',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
              marginBottom: '16px'
            }}>
              <table css={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                  <tr css={{ 
                    background: '#f9fafb',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <th css={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      fontSize: '12px',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>CONCEPTO</th>
                    <th css={{ 
                      padding: '12px 16px', 
                      textAlign: 'center', 
                      fontWeight: '600',
                      fontSize: '12px',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>CANTIDAD</th>
                    <th css={{ 
                      padding: '12px 16px', 
                      textAlign: 'right', 
                      fontWeight: '600',
                      fontSize: '12px',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {/* Créditos */}
              {(() => {
                const creditoTotal = locality.details.reduce((sum: number, item: any) => sum + item.credito, 0);
                const creditoCount = locality.details.filter((item: any) => item.credito > 0).length;
                if (creditoTotal > 0) {
                  return (
                        <tr css={{ 
                          borderBottom: '1px solid #f3f4f6',
                          '&:hover': { backgroundColor: '#f9fafb' }
                        }}>
                          <td css={{ 
                            padding: '12px 16px', 
                            color: '#6b7280',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '14px'
                          }}>
                            <Box css={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#6b7280',
                              marginRight: '8px'
                            }} />
                            Créditos otorgados
                          </td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'center',
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: '14px'
                          }}>{creditoCount}</td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: '#6b7280',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                        ${creditoTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Préstamos */}
              {(() => {
                const prestamoTotal = locality.details.reduce((sum: number, item: any) => sum + item.loanGranted, 0);
                const prestamoCount = locality.details.filter((item: any) => item.loanGranted > 0).length;
                
                if (prestamoTotal > 0) {
                  return (
                        <tr css={{ 
                          borderBottom: '1px solid #f3f4f6',
                          '&:hover': { backgroundColor: '#f9fafb' }
                        }}>
                          <td css={{ 
                            padding: '12px 16px', 
                            color: '#6b7280',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '14px'
                          }}>
                            <Box css={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#6b7280',
                              marginRight: '8px'
                            }} />
                            Préstamos otorgados
                          </td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'center',
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: '14px'
                          }}>{prestamoCount}</td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: '#6b7280',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                        ${prestamoTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Gastos operativos */}
              {(() => {
                const gastosTotal = locality.details.reduce((sum: number, item: any) => 
                  sum + item.viatic + item.gasoline + item.accommodation + 
                  item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                  item.otro, 0);
                const gastosCount = locality.details.filter((item: any) => 
                  item.viatic > 0 || item.gasoline > 0 || item.accommodation > 0 || 
                  item.nominaSalary > 0 || item.externalSalary > 0 || item.vehiculeMaintenance > 0 || 
                  item.otro > 0).length;
                if (gastosTotal > 0) {
                  return (
                        <tr css={{ 
                          borderBottom: '1px solid #f3f4f6',
                          '&:hover': { backgroundColor: '#f9fafb' }
                        }}>
                          <td css={{ 
                            padding: '12px 16px', 
                            color: '#6b7280',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '14px'
                          }}>
                            <Box css={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#6b7280',
                              marginRight: '8px'
                            }} />
                            Gastos operativos
                          </td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'center',
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: '14px'
                          }}>{gastosCount}</td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: '#6b7280',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                        ${gastosTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Comisiones por abonos */}
              {(() => {
                const comisionAbonosTotal = locality.details.reduce((sum: number, item: any) => 
                  sum + item.loanPaymentComission, 0);
                const comisionAbonosCount = locality.details.filter((item: any) => 
                  item.loanPaymentComission > 0).length;
                if (comisionAbonosTotal > 0) {
                  return (
                        <tr css={{ 
                          borderBottom: '1px solid #f3f4f6',
                          '&:hover': { backgroundColor: '#f9fafb' }
                        }}>
                          <td css={{ 
                            padding: '12px 16px', 
                            color: '#6b7280',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '14px'
                          }}>
                            <Box css={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#6b7280',
                              marginRight: '8px'
                            }} />
                            Comisiones por abonos
                          </td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'center',
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: '14px'
                          }}>{comisionAbonosCount}</td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: '#6b7280',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                        ${comisionAbonosTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}

              {/* Gastos de líder */}
              {(() => {
                const gastosLiderTotal = locality.details.reduce((sum: number, item: any) => 
                  sum + item.leadComission, 0);
                const gastosLiderCount = locality.details.filter((item: any) => 
                  item.leadComission > 0).length;
                if (gastosLiderTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Comisiones de líder</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{gastosLiderCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${gastosLiderTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}

              {/* Gastos de líder */}
              {(() => {
                const gastosLiderTotal = locality.details.reduce((sum: number, item: any) => 
                  sum + item.leadExpense, 0);
                const gastosLiderCount = locality.details.filter((item: any) => 
                  item.leadExpense > 0).length;
                if (gastosLiderTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Gastos de líder</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{gastosLiderCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${gastosLiderTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Comisiones por préstamos otorgados */}
              {(() => {
                const comisionPrestamosTotal = locality.details.reduce((sum: number, item: any) => sum + item.loanGrantedComission, 0);
                const comisionPrestamosCount = locality.details.filter((item: any) => item.loanGrantedComission > 0).length;
                if (comisionPrestamosTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Comisiones por préstamos</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{comisionPrestamosCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${comisionPrestamosTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Abonos en efectivo */}
              {(() => {
                const abonoEfectivoTotal = locality.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0);
                const abonoEfectivoCount = locality.details.filter((item: any) => item.cashAbono > 0).length;
                if (abonoEfectivoTotal > 0) {
                  return (
                        <tr css={{ 
                          borderBottom: '1px solid #f3f4f6',
                          '&:hover': { backgroundColor: '#f9fafb' }
                        }}>
                          <td css={{ 
                            padding: '12px 16px', 
                            color: '#059669',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '14px'
                          }}>
                            <Box css={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#059669',
                              marginRight: '8px'
                            }} />
                            Abonos en efectivo
                          </td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'center',
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: '14px'
                          }}>{abonoEfectivoCount}</td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: '#059669',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                        ${abonoEfectivoTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Abonos en banco */}
              {(() => {
                const abonoBancoTotal = locality.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0);
                const abonoBancoCount = locality.details.filter((item: any) => item.bankAbono > 0).length;
                if (abonoBancoTotal > 0) {
                  return (
                        <tr css={{ 
                          borderBottom: '1px solid #f3f4f6',
                          '&:hover': { backgroundColor: '#f9fafb' }
                        }}>
                          <td css={{ 
                            padding: '12px 16px', 
                            color: '#059669',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '14px'
                          }}>
                            <Box css={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#059669',
                              marginRight: '8px'
                            }} />
                            Abonos en banco
                          </td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'center',
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: '14px'
                          }}>{abonoBancoCount}</td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: '#059669',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                        ${abonoBancoTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Inversión de dinero */}
              {(() => {
                const inversionTotal = locality.details.reduce((sum: number, item: any) => sum + item.moneyInvestment, 0);
                const inversionCount = locality.details.filter((item: any) => item.moneyInvestment > 0).length;
                if (inversionTotal > 0) {
                  return (
                        <tr css={{ 
                          borderBottom: '1px solid #f3f4f6',
                          '&:hover': { backgroundColor: '#f9fafb' }
                        }}>
                          <td css={{ 
                            padding: '12px 16px', 
                            color: '#6b7280',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '14px'
                          }}>
                            <Box css={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#6b7280',
                              marginRight: '8px'
                            }} />
                            Inversión de dinero
                          </td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'center',
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: '14px'
                          }}>{inversionCount}</td>
                          <td css={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: '#6b7280',
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                        ${inversionTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
            </tbody>
          </table>
            </Box>
          
            {/* Resumen de totales y balances con diseño minimalista */}
            <Box css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {/* Columna izquierda - Totales */}
              <Box css={{
                background: 'white',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden'
              }}>
                <Box css={{
                  background: '#374151',
                  padding: '12px 16px',
                  color: 'white'
                }}>
                  <h3 css={{ 
                    margin: '0', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>💰 TOTAL COLOCADO</h3>
                </Box>
                <Box css={{ padding: '16px' }}>
                  <Box css={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <Box css={{ fontWeight: '500', color: '#6b7280', fontSize: '14px' }}>Créditos + Préstamos</Box>
                    <Box css={{ 
                      fontWeight: '600', 
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      ${(locality.details.reduce((sum: number, item: any) => sum + item.credito, 0) + 
                         locality.details.reduce((sum: number, item: any) => sum + item.loanGranted, 0)).toFixed(2)}
                    </Box>
                  </Box>
                  <Box css={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <Box css={{ fontWeight: '500', color: '#6b7280', fontSize: '14px' }}>Comisiones</Box>
                    <Box css={{ 
                      fontWeight: '600', 
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      ${locality.totalComissions.toFixed(2)}
                    </Box>
                  </Box>
                  <Box css={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0'
                  }}>
                    <Box css={{ fontWeight: '500', color: '#6b7280', fontSize: '14px' }}>Cobranza Total</Box>
                    <Box css={{ textAlign: 'right' }}>
                      <Box css={{ 
                        fontWeight: '600', 
                        fontSize: '16px',
                        color: '#059669',
                        marginBottom: '2px'
                      }}>
                          ${(locality.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0) + 
                             locality.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0)).toFixed(2)}
                      </Box>
                      <Box css={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '8px' }}>
                        <span css={{ color: '#059669' }}>
                          💵 Efectivo: ${locality.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0).toFixed(2)}
                          </span>
                        <span css={{ color: '#6b7280' }}>
                          🏦 Banco: ${locality.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0).toFixed(2)}
                          </span>
                      </Box>
                    </Box>
                  </Box>
                </Box>
            </Box>
            
            {/* Columna derecha - Balances */}
              <Box css={{
                background: 'white',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden'
              }}>
                <Box css={{
                  background: '#374151',
                  padding: '12px 16px',
                  color: 'white'
                }}>
                  <h3 css={{ 
                    margin: '0', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>💳 BALANCES</h3>
                </Box>
                <Box css={{ padding: '16px' }}>
                  <Box css={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <Box css={{ fontWeight: '500', color: '#6b7280', fontSize: '14px' }}>Balance en Efectivo</Box>
                    <Box css={{ 
                      fontWeight: '600', 
                      fontSize: '14px',
                      color: '#059669'
                    }}>
                      ${locality.cashBalance.toFixed(2)}
                    </Box>
                  </Box>
                  <Box css={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0'
                  }}>
                    <Box css={{ fontWeight: '500', color: '#6b7280', fontSize: '14px' }}>Balance en Banco</Box>
                    <Box css={{ 
                      fontWeight: '600', 
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      ${locality.bankBalance.toFixed(2)}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      ))}
      {/* Totales Generales con diseño minimalista */}
      <Box css={{ 
        marginTop: '24px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
        border: '1px solid #e5e7eb'
      }}>
        {/* Header minimalista */}
        <Box css={{
          background: '#374151',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <Box css={{ display: 'flex', alignItems: 'center' }}>
            <Box css={{
              width: '32px',
              height: '32px',
              background: '#6b7280',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px'
            }}>
              <Box css={{ fontSize: '16px' }}>📊</Box>
            </Box>
            <Box>
              <h2 css={{ 
                margin: '0',
                color: 'white',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Resumen Ejecutivo
              </h2>
              <Box css={{
                color: '#9ca3af',
                fontSize: '12px',
                marginTop: '2px'
              }}>
                Consolidado de todas las localidades
              </Box>
            </Box>
          </Box>
        </Box>
        
        {/* Contenido de la tabla */}
        <Box css={{ padding: '20px' }}>
          <Box css={{
            background: 'white',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
        <table css={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
                <tr css={{ 
                  background: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <th css={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontWeight: '600',
                    fontSize: '12px',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>CONCEPTO</th>
                  <th css={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    fontWeight: '600',
                    fontSize: '12px',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>MONTO</th>
            </tr>
          </thead>
          <tbody>
                {/* Gastos (negativos) */}
                <tr css={{ 
                  borderBottom: '1px solid #f3f4f6',
                  '&:hover': { backgroundColor: '#f9fafb' }
                }}>
                  <td css={{ 
                    padding: '12px 16px', 
                    color: '#6b7280',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}>
                    <Box css={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#6b7280',
                      marginRight: '8px'
                    }} />
                    Total Dinero otorgado en créditos
                  </td>
                  <td css={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: '#6b7280',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.credito, 0), 0).toFixed(2)}
              </td>
            </tr>
                
                <tr css={{ 
                  borderBottom: '1px solid #f3f4f6',
                  '&:hover': { backgroundColor: '#f9fafb' }
                }}>
                  <td css={{ 
                    padding: '12px 16px', 
                    color: '#6b7280',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}>
                    <Box css={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#6b7280',
                      marginRight: '8px'
                    }} />
                    Total Préstamos otorgados
                  </td>
                  <td css={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: '#6b7280',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.loanGranted, 0), 0).toFixed(2)}
                  </td>
                </tr>
                
                <tr css={{ 
                  borderBottom: '1px solid #f3f4f6',
                  '&:hover': { backgroundColor: '#f9fafb' }
                }}>
                  <td css={{ 
                    padding: '12px 16px', 
                    color: '#6b7280',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}>
                    <Box css={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#6b7280',
                      marginRight: '8px'
                    }} />
                    Total Gastos operativos
                  </td>
                  <td css={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: '#6b7280',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => 
                      sum + item.viatic + item.gasoline + item.accommodation + 
                      item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                      item.otro + item.leadExpense, 0), 0).toFixed(2)}
                  </td>
                </tr>
                
                <tr css={{ 
                  borderBottom: '1px solid #f3f4f6',
                  '&:hover': { backgroundColor: '#f9fafb' }
                }}>
                  <td css={{ 
                    padding: '12px 16px', 
                    color: '#6b7280',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}>
                    <Box css={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#6b7280',
                      marginRight: '8px'
                    }} />
                    Total Comisiones
                  </td>
                  <td css={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: '#6b7280',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.totalComissions, 0).toFixed(2)}
                  </td>
                </tr>
                
                {/* Ingresos (positivos) */}
                <tr css={{ 
                  borderBottom: '1px solid #f3f4f6',
                  '&:hover': { backgroundColor: '#f9fafb' }
                }}>
                  <td css={{ 
                    padding: '12px 16px', 
                    color: '#059669',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}>
                    <Box css={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#059669',
                      marginRight: '8px'
                    }} />
                    Total Abonos en Efectivo
                  </td>
                  <td css={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: '#059669',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0), 0).toFixed(2)}
                  </td>
                </tr>
                
                <tr css={{ 
                  borderBottom: '1px solid #f3f4f6',
                  '&:hover': { backgroundColor: '#f9fafb' }
                }}>
                  <td css={{ 
                    padding: '12px 16px', 
                    color: '#059669',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}>
                    <Box css={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#059669',
                      marginRight: '8px'
                    }} />
                    Total Abonos en Banco
                  </td>
                  <td css={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: '#059669',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0), 0).toFixed(2)}
                  </td>
                </tr>
                
                <tr css={{ 
                  borderBottom: '1px solid #f3f4f6',
                  '&:hover': { backgroundColor: '#f9fafb' }
                }}>
                  <td css={{ 
                    padding: '12px 16px', 
                    color: '#6b7280',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}>
                    <Box css={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#6b7280',
                      marginRight: '8px'
                    }} />
                    Total Inversión de dinero
                  </td>
                  <td css={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: '#6b7280',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.moneyInvestment, 0), 0).toFixed(2)}
                  </td>
                </tr>
                
                {/* Balances finales */}
                <tr css={{ 
                  backgroundColor: '#f9fafb',
                  borderTop: '2px solid #e5e7eb',
                  '&:hover': { backgroundColor: '#f3f4f6' }
                }}>
                  <td css={{ 
                    padding: '16px 16px', 
                    fontWeight: '600',
                    fontSize: '16px',
                    color: '#374151',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Box css={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#059669',
                      marginRight: '8px'
                    }} />
                    Balance Total en Efectivo
                  </td>
                  <td css={{ 
                    padding: '16px 16px', 
                    textAlign: 'right',
                    fontWeight: '700',
                    fontSize: '16px',
                    color: '#059669'
                  }}>
                    ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.cashBalance, 0).toFixed(2)}
                  </td>
                </tr>
                
                <tr css={{ 
                  backgroundColor: '#f9fafb',
                  '&:hover': { backgroundColor: '#f3f4f6' }
                }}>
                  <td css={{ 
                    padding: '16px 16px', 
                    fontWeight: '600',
                    fontSize: '16px',
                    color: '#374151',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Box css={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#6b7280',
                      marginRight: '8px'
                    }} />
                    Balance Total en Banco
                  </td>
                  <td css={{ 
                    padding: '16px 16px', 
                    textAlign: 'right',
                    fontWeight: '700',
                    fontSize: '16px',
                    color: '#6b7280'
                  }}>
                    ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.bankBalance, 0).toFixed(2)}
                  </td>
                </tr>
          </tbody>
        </table>
      </Box>
        </Box>
      </Box>

      {/* Botón de Entradas al Banco */}
      <Box css={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 100
      }}>
        <button
          onClick={() => {
            // Abrir el modal - la query se ejecutará automáticamente
            const startDate = (() => {
              const year = selectedDate.getFullYear();
              const month = selectedDate.getMonth();
              const day = selectedDate.getDate();
              const startDate = new Date(Date.UTC(year, month, day, 6, 0, 0, 0));
              return startDate.toISOString();
            })();
            const endDate = (() => {
              const year = selectedDate.getFullYear();
              const month = selectedDate.getMonth();
              const day = selectedDate.getDate();
              const endDate = new Date(Date.UTC(year, month, day + 1, 5, 59, 59, 999));
              return endDate.toISOString();
            })();
            
            console.log('🔍 Abriendo modal con datos:', {
              selectedDate,
              selectedRoute: selectedRoute?.id,
              showBankIncomeModal: true,
              startDate,
              endDate,
              startDateLocal: new Date(startDate).toLocaleString('es-MX'),
              endDateLocal: new Date(endDate).toLocaleString('es-MX')
            });
            setShowBankIncomeModal(true);
          }}
          css={{
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            padding: '16px 24px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            '&:hover': {
              backgroundColor: '#16a34a',
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 16px rgba(34, 197, 94, 0.4)'
            }
          }}
        >
          {isLoadingBankIncome ? (
            <>
              <Box css={{
                width: '16px',
                height: '16px',
                border: '2px solid #ffffff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Cargando...
            </>
          ) : (
            <>
              💰 Entradas al Banco
              {totalTransactions > 0 && (
                <Box css={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  {totalTransactions}
                </Box>
              )}
            </>
          )}
        </button>
      </Box>

      {/* Modal de Entradas al Banco */}
      <BankIncomeModal
        isOpen={showBankIncomeModal}
        onClose={() => setShowBankIncomeModal(false)}
        bankIncomes={bankIncomes}
        totalTransactions={totalTransactions}
        totalAmount={totalAmount}
        loading={bankIncomeLoading || isLoadingBankIncome}
      />
      
      {/* CSS para animaciones */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(1deg); }
          66% { transform: translateY(5px) rotate(-1deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
}; 