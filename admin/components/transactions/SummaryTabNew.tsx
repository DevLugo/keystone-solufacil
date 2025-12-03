/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useMemo } from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { gql, useQuery } from '@apollo/client';
import { DollarSign, TrendingUp, Wallet, CreditCard, ArrowUpCircle } from 'lucide-react';

// New Components
import { StatCard } from '../summary-new/StatCard';
import { LocalityCard } from '../summary-new/LocalityCard';
import { colors, shadows, radius, gradients, formatCurrency } from '../summary-new/theme';

// Import existing modal
import { BankIncomeModal } from './BankIncomeModal';

// GraphQL Queries (from original SummaryTab)
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

// Interfaces
interface SummaryTabNewProps {
  selectedDate: Date;
  selectedRoute?: Route | null;
  refreshKey: number;
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
  details: SummaryDetail[];
  transactions: Transaction[];
  totalPlaced: {
    creditsAndLoans: number;
    commissions: number;
    totalCollection: number;
    collectionCash: number;
    collectionBank: number;
  };
}

interface SummaryDetail {
  abono: number;
  cashAbono: number;
  bankAbono: number;
  credito: number;
  viatic: number;
  gasoline: number;
  accommodation: number;
  nominaSalary: number;
  externalSalary: number;
  vehiculeMaintenance: number;
  loanGranted: number;
  loanPaymentComission: number;
  loanGrantedComission: number;
  leadComission: number;
  leadExpense: number;
  moneyInvestment: number;
  otro: number;
  balance: number;
  profit: number;
  cashBalance: number;
  bankBalance: number;
}

interface Transaction {
  concept: string;
  quantity: number;
  total: number;
  isCommission?: boolean;
  isIncome?: boolean;
}

interface ExecutiveSummaryData {
  totalCreditsGiven: number;
  totalLoansGiven: number;
  totalOperatingExpenses: number;
  totalCommissions: number;
  totalCashPayments: number;
  totalBankPayments: number;
  totalMoneyInvestment: number;
  totalCashBalance: number;
  totalBankBalance: number;
}

// Loading Component
const LoadingSpinner = () => (
  <div
    css={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '400px',
      background: gradients.pageBackground,
      borderRadius: radius['2xl'],
      margin: '1.25rem',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      css={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
        animation: 'pulse 2s ease-in-out infinite',
      }}
    />
    <div
      css={{
        width: '60px',
        height: '60px',
        border: `4px solid ${colors.slate[200]}`,
        borderTop: `4px solid ${colors.blue[500]}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '1.25rem',
        position: 'relative',
        zIndex: 1,
      }}
    />
    <div css={{ fontSize: '1.125rem', fontWeight: 600, color: colors.slate[700], marginBottom: '0.5rem', position: 'relative', zIndex: 1 }}>
      Cargando resumen...
    </div>
    <div css={{ fontSize: '0.875rem', color: colors.slate[500], position: 'relative', zIndex: 1 }}>
      Preparando datos de transacciones
    </div>
    <style>{`
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

export const SummaryTabNew = ({ selectedDate, selectedRoute, refreshKey }: SummaryTabNewProps) => {
  // GraphQL Query
  const { data, loading, error, refetch } = useQuery(GET_TRANSACTIONS_SUMMARY, {
    variables: {
      startDate: (() => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();
        const startDate = new Date(Date.UTC(year, month, day, 6, 0, 0, 0));
        return startDate.toISOString();
      })(),
      endDate: (() => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();
        const endDate = new Date(Date.UTC(year, month, day + 1, 5, 59, 59, 999));
        return endDate.toISOString();
      })(),
      routeId: selectedRoute?.id,
    },
    skip: !selectedDate || !selectedRoute,
  });

  // States
  const [showBankIncomeModal, setShowBankIncomeModal] = useState(false);
  const [onlyAbonos, setOnlyAbonos] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<Array<{ id: string; name: string }>>([]);

  // Query for all routes
  const { data: allRoutesData } = useQuery(GET_ALL_ROUTES, {
    skip: !showBankIncomeModal,
  });

  // Query for bank income
  const { data: bankIncomeData, loading: bankIncomeLoading, refetch: refetchBankIncome } = useQuery(GET_BANK_INCOME_TRANSACTIONS, {
    variables: {
      routeIds: selectedRouteIds.length > 0 ? selectedRouteIds : (selectedRoute?.id ? [selectedRoute.id] : []),
      startDate: customStartDate ? new Date(customStartDate + 'T06:00:00.000Z').toISOString() : (() => {
        const startOfWeek = new Date(selectedDate);
        const dayOfWeek = startOfWeek.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
        const year = startOfWeek.getFullYear();
        const month = startOfWeek.getMonth();
        const day = startOfWeek.getDate();
        return new Date(Date.UTC(year, month, day, 6, 0, 0, 0)).toISOString();
      })(),
      endDate: customEndDate ? new Date(customEndDate + 'T23:59:59.999Z').toISOString() : (() => {
        const startOfWeek = new Date(selectedDate);
        const dayOfWeek = startOfWeek.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        const year = endOfWeek.getFullYear();
        const month = endOfWeek.getMonth();
        const day = endOfWeek.getDate();
        return new Date(Date.UTC(year, month, day + 1, 5, 59, 59, 999)).toISOString();
      })(),
      onlyAbonos: onlyAbonos,
    },
    skip: !showBankIncomeModal || !selectedDate || (selectedRouteIds.length === 0 && !selectedRoute?.id),
    fetchPolicy: 'no-cache',
    notifyOnNetworkStatusChange: true,
  });

  // Effects
  useEffect(() => {
    if (selectedDate) {
      refetch();
    }
  }, [refreshKey, refetch, selectedDate]);

  useEffect(() => {
    if (showBankIncomeModal && !customStartDate && !customEndDate) {
      const startOfWeek = new Date(selectedDate);
      const dayOfWeek = startOfWeek.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      setCustomStartDate(startOfWeek.toISOString().split('T')[0]);
      setCustomEndDate(endOfWeek.toISOString().split('T')[0]);
    }
  }, [showBankIncomeModal, selectedDate]);

  useEffect(() => {
    if (allRoutesData?.routes) {
      setAvailableRoutes(allRoutesData.routes);
      if (selectedRoute?.id && !selectedRouteIds.includes(selectedRoute.id)) {
        setSelectedRouteIds([selectedRoute.id]);
      }
    }
  }, [allRoutesData, selectedRoute]);

  // Process bank income data
  const { bankIncomes, totalTransactions, totalAmount } = useMemo(() => {
    if (!bankIncomeData || bankIncomeLoading) {
      return { bankIncomes: [], totalTransactions: 0, totalAmount: 0 };
    }

    const response = bankIncomeData.getBankIncomeTransactions;
    if (!response || !response.success) {
      return { bankIncomes: [], totalTransactions: 0, totalAmount: 0 };
    }

    const transactions = response.transactions || [];
    const processedIncomes = transactions.map((transaction: any) => ({
      id: transaction.id,
      name: transaction.name || 'Sin nombre',
      date: transaction.date,
      amount: transaction.amount,
      type: transaction.type,
      locality: transaction.locality,
      employeeName: transaction.employeeName,
      leaderLocality: transaction.leaderLocality,
      description: transaction.description,
      isClientPayment: transaction.isClientPayment || (transaction.type === 'INCOME' && transaction.incomeSource === 'BANK_LOAN_PAYMENT'),
      isLeaderPayment: transaction.isLeaderPayment || transaction.type === 'TRANSFER',
    }));

    return {
      bankIncomes: processedIncomes,
      totalTransactions: processedIncomes.length,
      totalAmount: processedIncomes.reduce((sum: number, income: any) => sum + income.amount, 0),
    };
  }, [bankIncomeData, bankIncomeLoading]);

  // Process summary data into localities
  const localities = useMemo((): LocalitySummary[] => {
    const summaryData = data?.getTransactionsSummary || [];

    const groupedByLocality = summaryData.reduce((acc: Record<string, LocalitySummary>, item: any) => {
      let localityName = 'General';
      let municipalityName = '';
      let stateName = '';
      let leaderName = '';

      if (item.locality && item.locality !== 'General') {
        if (item.locality.includes(' - ')) {
          const parts = item.locality.split(' - ');
          if (parts.length > 1) {
            leaderName = parts[0].trim();
            const locationPart = parts[1];
            if (locationPart.includes(',')) {
              const locationParts = locationPart.split(',').map((s: string) => s.trim());
              if (locationParts.length >= 3) {
                localityName = locationParts[0];
                municipalityName = locationParts[1];
                stateName = locationParts[2];
              } else if (locationParts.length === 2) {
                localityName = locationParts[0];
                stateName = locationParts[1];
                municipalityName = locationParts[0];
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
          details: [],
          transactions: [],
          totalPlaced: {
            creditsAndLoans: 0,
            commissions: 0,
            totalCollection: 0,
            collectionCash: 0,
            collectionBank: 0,
          },
        };
      }

      const income = item.abono + item.moneyInvestment;
      const expenses = item.viatic + item.gasoline + item.accommodation +
        item.nominaSalary + item.externalSalary + item.vehiculeMaintenance +
        item.otro + item.leadExpense;
      const comissions = item.loanPaymentComission + item.loanGrantedComission + item.leadComission;

      acc[locationKey].totalIncome += income;
      acc[locationKey].totalExpenses += expenses;
      acc[locationKey].totalComissions += comissions;
      acc[locationKey].balance += item.balance;
      acc[locationKey].profit += item.profit;
      acc[locationKey].cashBalance += item.cashBalance;
      acc[locationKey].bankBalance += item.bankBalance;
      acc[locationKey].details.push(item);

      // Update totalPlaced
      acc[locationKey].totalPlaced.creditsAndLoans += item.credito + item.loanGranted;
      acc[locationKey].totalPlaced.commissions += comissions;
      acc[locationKey].totalPlaced.totalCollection += item.cashAbono + item.bankAbono;
      acc[locationKey].totalPlaced.collectionCash += item.cashAbono;
      acc[locationKey].totalPlaced.collectionBank += item.bankAbono;

      return acc;
    }, {});

    // Build transactions for each locality
    Object.values(groupedByLocality).forEach((loc: LocalitySummary) => {
      const transactions: Transaction[] = [];

      const creditoTotal = loc.details.reduce((sum, item) => sum + item.credito, 0);
      if (creditoTotal > 0) {
        transactions.push({ concept: 'Créditos otorgados', quantity: loc.details.filter(item => item.credito > 0).length, total: creditoTotal });
      }

      const prestamoTotal = loc.details.reduce((sum, item) => sum + item.loanGranted, 0);
      if (prestamoTotal > 0) {
        transactions.push({ concept: 'Préstamos otorgados', quantity: loc.details.filter(item => item.loanGranted > 0).length, total: prestamoTotal });
      }

      const gastosTotal = loc.details.reduce((sum, item) =>
        sum + item.viatic + item.gasoline + item.accommodation +
        item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + item.otro, 0);
      if (gastosTotal > 0) {
        transactions.push({ concept: 'Gastos operativos', quantity: loc.details.filter(item =>
          item.viatic > 0 || item.gasoline > 0 || item.accommodation > 0 ||
          item.nominaSalary > 0 || item.externalSalary > 0 || item.vehiculeMaintenance > 0 || item.otro > 0).length, total: gastosTotal, isCommission: true });
      }

      const comisionAbonosTotal = loc.details.reduce((sum, item) => sum + item.loanPaymentComission, 0);
      if (comisionAbonosTotal > 0) {
        transactions.push({ concept: 'Comisiones por abonos', quantity: loc.details.filter(item => item.loanPaymentComission > 0).length, total: comisionAbonosTotal, isCommission: true });
      }

      const abonoEfectivoTotal = loc.details.reduce((sum, item) => sum + item.cashAbono, 0);
      if (abonoEfectivoTotal > 0) {
        transactions.push({ concept: 'Abonos en efectivo', quantity: loc.details.filter(item => item.cashAbono > 0).length, total: abonoEfectivoTotal, isIncome: true });
      }

      const abonoBancoTotal = loc.details.reduce((sum, item) => sum + item.bankAbono, 0);
      if (abonoBancoTotal > 0) {
        transactions.push({ concept: 'Abonos en banco', quantity: loc.details.filter(item => item.bankAbono > 0).length, total: abonoBancoTotal, isIncome: true });
      }

      loc.transactions = transactions;
    });

    return Object.values(groupedByLocality);
  }, [data]);

  // Executive Summary Data
  const executiveSummary: ExecutiveSummaryData = useMemo(() => {
    return localities.reduce(
      (acc, locality) => ({
        totalCreditsGiven: acc.totalCreditsGiven + locality.details.reduce((sum, item) => sum + item.credito, 0),
        totalLoansGiven: acc.totalLoansGiven + locality.details.reduce((sum, item) => sum + item.loanGranted, 0),
        totalOperatingExpenses: acc.totalOperatingExpenses + locality.details.reduce((sum, item) =>
          sum + item.viatic + item.gasoline + item.accommodation +
          item.nominaSalary + item.externalSalary + item.vehiculeMaintenance +
          item.otro + item.leadExpense, 0),
        totalCommissions: acc.totalCommissions + locality.totalComissions,
        totalCashPayments: acc.totalCashPayments + locality.details.reduce((sum, item) => sum + item.cashAbono, 0),
        totalBankPayments: acc.totalBankPayments + locality.details.reduce((sum, item) => sum + item.bankAbono, 0),
        totalMoneyInvestment: acc.totalMoneyInvestment + locality.details.reduce((sum, item) => sum + item.moneyInvestment, 0),
        totalCashBalance: acc.totalCashBalance + locality.cashBalance,
        totalBankBalance: acc.totalBankBalance + locality.bankBalance,
      }),
      {
        totalCreditsGiven: 0,
        totalLoansGiven: 0,
        totalOperatingExpenses: 0,
        totalCommissions: 0,
        totalCashPayments: 0,
        totalBankPayments: 0,
        totalMoneyInvestment: 0,
        totalCashBalance: 0,
        totalBankBalance: 0,
      }
    );
  }, [localities]);

  // Handlers
  const handleRefreshBankIncome = () => refetchBankIncome();

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

  // Render
  if (loading) return <LoadingSpinner />;
  if (error) return <div css={{ padding: '1rem', color: colors.red[600] }}>Error: {error.message}</div>;

  return (
    <div
      css={{
        minHeight: '100vh',
        background: gradients.pageBackground,
        padding: '1.5rem',
      }}
    >
      <div css={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Stats Overview */}
        <div
          css={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '1.5rem',
            marginBottom: '2rem',
            '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
            '@media (min-width: 1024px)': { gridTemplateColumns: 'repeat(4, 1fr)' },
          }}
        >
          <StatCard
            title="Préstamos Otorgados"
            value={executiveSummary.totalLoansGiven}
            icon={<DollarSign size={28} color="white" />}
            gradient={gradients.blueToBlue}
          />
          <StatCard
            title="Comisiones"
            value={executiveSummary.totalCommissions}
            icon={<TrendingUp size={28} color="white" />}
            gradient={gradients.purpleToPurple}
          />
          <StatCard
            title="Balance Efectivo"
            value={executiveSummary.totalCashBalance}
            icon={<Wallet size={28} color="white" />}
            gradient={gradients.greenToGreen}
            trend={{
              value: executiveSummary.totalCashBalance >= 0 ? 'Positivo' : 'Negativo',
              isPositive: executiveSummary.totalCashBalance >= 0,
            }}
          />
          <StatCard
            title="Balance Banco"
            value={executiveSummary.totalBankBalance}
            icon={<CreditCard size={28} color="white" />}
            gradient={gradients.tealToTeal}
            trend={{
              value: executiveSummary.totalBankBalance >= 0 ? 'Positivo' : 'Negativo',
              isPositive: executiveSummary.totalBankBalance >= 0,
            }}
          />
        </div>

        {/* Localities Grid */}
        <div css={{ marginBottom: '2rem' }}>
          <h2 css={{ fontSize: '1.25rem', fontWeight: 700, color: colors.slate[900], marginBottom: '1rem' }}>
            Localidades
          </h2>
          <div css={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {localities.map((locality) => (
              <LocalityCard key={locality.locationKey} locality={locality} />
            ))}
          </div>
        </div>

      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowBankIncomeModal(true)}
        css={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: gradients.greenToGreen,
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: radius['2xl'],
          boxShadow: `0 10px 25px -5px rgba(34, 197, 94, 0.4)`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontWeight: 600,
          fontSize: '1rem',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          zIndex: 100,
          '&:hover': {
            transform: 'scale(1.05) translateY(-2px)',
            boxShadow: `0 15px 30px -5px rgba(34, 197, 94, 0.5)`,
          },
        }}
      >
        <ArrowUpCircle size={24} />
        <span>Entradas al Banco</span>
        {totalTransactions > 0 && (
          <span
            css={{
              backgroundColor: colors.red[500],
              color: 'white',
              borderRadius: radius.full,
              width: '1.5rem',
              height: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {totalTransactions}
          </span>
        )}
      </button>

      {/* Bank Income Modal */}
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
    </div>
  );
};

