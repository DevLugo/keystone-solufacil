/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useMemo } from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { gql, useQuery } from '@apollo/client';
import { BankIncomeModal } from './BankIncomeModal';
import { DiscrepanciesModal } from './DiscrepanciesModal';

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

const GET_ALL_ROUTES = gql`
  query GetAllRoutes {
    routes {
      id
      name
    }
  }
`;

const GET_BANK_INCOME_TRANSACTIONS = gql`
  query GetBankIncomeTransactions($startDate: String!, $endDate: String!, $routeIds: [ID!]!, $onlyAbonos: Boolean) {
    getBankIncomeTransactions(startDate: $startDate, endDate: $endDate, routeIds: $routeIds, onlyAbonos: $onlyAbonos)
  }
`;

const GET_DISCREPANCIES = gql`
  query GetDiscrepancies($routeId: ID, $startDate: String, $endDate: String, $status: String) {
    getDiscrepancies(routeId: $routeId, startDate: $startDate, endDate: $endDate, status: $status) {
      id
      discrepancyType
      date
      weekStartDate
      expectedAmount
      actualAmount
      difference
      description
      category
      status
      notes
      screenshotUrls
      telegramReported
      reportedAt
      route {
        id
        name
      }
      lead {
        id
        personalData {
          fullName
        }
      }
      createdAt
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
  isClientPayment?: boolean;
  isLeaderPayment?: boolean;
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
  const [showDiscrepanciesModal, setShowDiscrepanciesModal] = useState(false);
  
  // Estados para filtros del modal
  const [onlyAbonos, setOnlyAbonos] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<Array<{ id: string; name: string }>>([]);

  // Query para obtener todas las rutas disponibles
  const { data: allRoutesData } = useQuery(GET_ALL_ROUTES, {
    skip: !showBankIncomeModal
  });

  // Query para obtener diferencias - SIN FILTROS de ruta o fecha para ver TODAS
  const { data: discrepanciesData, loading: discrepanciesLoading, refetch: refetchDiscrepancies } = useQuery(GET_DISCREPANCIES, {
    variables: {
      routeId: null, // No filtrar por ruta - mostrar TODAS las rutas
      startDate: null, // No filtrar por fecha de inicio
      endDate: null, // No filtrar por fecha de fin
      status: null, // Obtener todas (pendientes, completadas, descartadas)
    },
    skip: !showDiscrepanciesModal, // Solo ejecutar cuando se abre el modal
    fetchPolicy: 'network-only', // Siempre buscar datos frescos
  });

  // Query para obtener entradas al banco (solo se ejecuta cuando se abre el modal)
  const { data: bankIncomeData, loading: bankIncomeLoading, refetch: refetchBankIncome, error: bankIncomeError } = useQuery(GET_BANK_INCOME_TRANSACTIONS, {
    variables: {
      routeIds: selectedRouteIds.length > 0 ? selectedRouteIds : (selectedRoute?.id ? [selectedRoute.id] : []),
      startDate: customStartDate ? new Date(customStartDate + 'T06:00:00.000Z').toISOString() : (() => {
        // Calcular inicio de semana (lunes) en UTC para 00:00 hora México (06:00 UTC)
        const startOfWeek = new Date(selectedDate);
        const dayOfWeek = startOfWeek.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
        
        const year = startOfWeek.getFullYear();
        const month = startOfWeek.getMonth();
        const day = startOfWeek.getDate();
        const startDate = new Date(Date.UTC(year, month, day, 6, 0, 0, 0));
        return startDate.toISOString();
      })(),
      endDate: customEndDate ? new Date(customEndDate + 'T23:59:59.999Z').toISOString() : (() => {
        // Calcular fin de semana (domingo) en UTC para 23:59 hora México (05:59 UTC del día siguiente)
        const startOfWeek = new Date(selectedDate);
        const dayOfWeek = startOfWeek.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        const year = endOfWeek.getFullYear();
        const month = endOfWeek.getMonth();
        const day = endOfWeek.getDate();
        const endDate = new Date(Date.UTC(year, month, day + 1, 5, 59, 59, 999));
        return endDate.toISOString();
      })(),
      onlyAbonos: onlyAbonos
    },
    skip: !showBankIncomeModal || !selectedDate || (selectedRouteIds.length === 0 && !selectedRoute?.id), // Solo ejecutar cuando el modal esté abierto y tengamos los datos necesarios
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

  // Función para calcular fechas por defecto (semana actual)
  const getDefaultWeekDates = () => {
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    
    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0]
    };
  };

  // Inicializar fechas por defecto cuando se abre el modal
  useEffect(() => {
    if (showBankIncomeModal && !customStartDate && !customEndDate) {
      const defaultDates = getDefaultWeekDates();
      setCustomStartDate(defaultDates.start);
      setCustomEndDate(defaultDates.end);
    }
  }, [showBankIncomeModal, selectedDate]);

  // Inicializar rutas disponibles y seleccionar la ruta actual por defecto
  useEffect(() => {
    if (allRoutesData?.routes) {
      setAvailableRoutes(allRoutesData.routes);
      if (selectedRoute?.id && !selectedRouteIds.includes(selectedRoute.id)) {
        setSelectedRouteIds([selectedRoute.id]);
      }
    }
  }, [allRoutesData, selectedRoute]);

  // Procesar datos de diferencias usando useMemo
  const { allDiscrepancies, totalPending, totalCompleted, totalDiscarded } = useMemo(() => {
    if (!discrepanciesData || discrepanciesLoading) {
      return {
        allDiscrepancies: [],
        totalPending: 0,
        totalCompleted: 0,
        totalDiscarded: 0,
      };
    }

    const discrepancies = discrepanciesData.getDiscrepancies || [];
    
    return {
      allDiscrepancies: discrepancies,
      totalPending: discrepancies.filter((d: any) => d.status === 'PENDING').length,
      totalCompleted: discrepancies.filter((d: any) => d.status === 'COMPLETED').length,
      totalDiscarded: discrepancies.filter((d: any) => d.status === 'DISCARDED').length,
    };
  }, [discrepanciesData, discrepanciesLoading]);

  // Procesar datos de entradas al banco usando useMemo
  const { bankIncomes, totalTransactions, totalAmount } = useMemo(() => {
    if (!bankIncomeData || bankIncomeLoading) {
      return {
        bankIncomes: [],
        totalTransactions: 0,
        totalAmount: 0
      };
    }

    const response = bankIncomeData.getBankIncomeTransactions;
    if (!response || !response.success) {
      return {
        bankIncomes: [],
        totalTransactions: 0,
        totalAmount: 0
      };
    }

    const transactions = response.transactions || [];

    const processedIncomes = transactions.map((transaction: any) => {
      const isClientPayment = transaction.isClientPayment || (transaction.type === 'INCOME' && transaction.incomeSource === 'BANK_LOAN_PAYMENT');
      const isLeaderPayment = transaction.isLeaderPayment || (transaction.type === 'TRANSFER');
      
      return {
        id: transaction.id,
        name: transaction.name || 'Sin nombre',
        date: transaction.date,
        amount: transaction.amount,
        type: transaction.type,
        locality: transaction.locality,
        employeeName: transaction.employeeName,
        leaderLocality: transaction.leaderLocality,
        description: transaction.description,
        isClientPayment,
        isLeaderPayment
      };
    });

    const totalAmount = processedIncomes.reduce((sum: any, income: any) => sum + income.amount, 0);
    const totalTransactions = processedIncomes.length;

    return {
      bankIncomes: processedIncomes,
      totalTransactions,
      totalAmount
    };
  }, [bankIncomeData, bankIncomeLoading]);

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

  // Funciones para manejar el modal
  const handleRefreshBankIncome = () => {
    refetchBankIncome();
  };

  const handleCloseModal = () => {
    setShowBankIncomeModal(false);
    setOnlyAbonos(false);
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedRouteIds([]);
  };

  const handleResetFilters = () => {
    setOnlyAbonos(false);
    setCustomStartDate('');
    setCustomEndDate('');
    if (selectedRoute?.id) {
      setSelectedRouteIds([selectedRoute.id]);
    } else {
      setSelectedRouteIds([]);
    }
  };

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

      {/* Botones flotantes */}
      <Box css={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'flex-end'
      }}>
        {/* Botón de Diferencias */}
        <button
          onClick={() => setShowDiscrepanciesModal(true)}
          css={{
            backgroundColor: totalPending > 0 ? '#EF4444' : '#8B5CF6',
            color: 'white',
            border: 'none',
            padding: '16px 24px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: totalPending > 0 
              ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
              : '0 4px 12px rgba(139, 92, 246, 0.3)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            '&:hover': {
              backgroundColor: totalPending > 0 ? '#DC2626' : '#7C3AED',
              transform: 'translateY(-2px)',
              boxShadow: totalPending > 0 
                ? '0 6px 16px rgba(239, 68, 68, 0.4)' 
                : '0 6px 16px rgba(139, 92, 246, 0.4)',
            }
          }}
        >
          {totalPending > 0 ? '⚠️' : '✅'} Diferencias
          {totalPending > 0 && (
            <Box css={{
              backgroundColor: '#FFFFFF',
              color: '#EF4444',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {totalPending}
            </Box>
          )}
        </button>
      
      {/* Botón de Entradas al Banco */}
      <Box css={{
        
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
      </Box>

      {/* Modal de Diferencias */}
      <DiscrepanciesModal
        isOpen={showDiscrepanciesModal}
        onClose={() => setShowDiscrepanciesModal(false)}
        discrepancies={allDiscrepancies}
        loading={discrepanciesLoading}
        onRefresh={refetchDiscrepancies}
        totalPending={totalPending}
        totalCompleted={totalCompleted}
        totalDiscarded={totalDiscarded}
      />

      {/* Modal de Entradas al Banco */}
      <BankIncomeModal
        isOpen={showBankIncomeModal}
        onClose={handleCloseModal}
        bankIncomes={bankIncomes}
        totalTransactions={totalTransactions}
        totalAmount={totalAmount}
        loading={bankIncomeLoading}
        onlyAbonos={onlyAbonos}
        onOnlyAbonosChange={setOnlyAbonos}
        startDate={customStartDate}
        onStartDateChange={setCustomStartDate}
        endDate={customEndDate}
        onEndDateChange={setCustomEndDate}
        selectedRouteIds={selectedRouteIds}
        onRouteIdsChange={setSelectedRouteIds}
        availableRoutes={availableRoutes}
        onRefresh={handleRefreshBankIncome}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onResetFilters={handleResetFilters}
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