/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { gql, useQuery } from '@apollo/client';

const GET_TRANSACTIONS_SUMMARY = gql`
  query GetTransactionsSummary($startDate: String!, $endDate: String!) {
    getTransactionsSummary(startDate: $startDate, endDate: $endDate) {
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
      moneyInvestment
      otro
      balance
      profit
      cashBalance
      bankBalance
    }
  }
`;

interface SummaryTabProps {
  selectedDate: Date;
  refreshKey: number;
}

interface LocalitySummary {
  locality: string;
  totalIncome: number;
  totalExpenses: number;
  totalComissions: number;
  balance: number;
  profit: number;
  cashBalance: number;
  bankBalance: number;
  details: any[];
}

export const SummaryTab = ({ selectedDate, refreshKey }: SummaryTabProps) => {
  const { data, loading, error, refetch } = useQuery(GET_TRANSACTIONS_SUMMARY, {
    variables: {
      startDate: selectedDate.toISOString(),
      endDate: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
    },
    skip: !selectedDate
  });

  useEffect(() => {
    if (selectedDate) {
      refetch();
    }
  }, [refreshKey, refetch, selectedDate]);

  const [expandedLocality, setExpandedLocality] = useState<string | null>(null);

  if (!selectedDate) return <div>Seleccione una fecha</div>;
  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const summaryData = data?.getTransactionsSummary || [];

  // Agrupar por líder
  const groupedByLeader = summaryData.reduce((acc: Record<string, any>, item: any) => {
    const leaderInfo = item.locality || 'General'; // El campo locality ahora contiene el nombre del líder
    if (!acc[leaderInfo]) {
      acc[leaderInfo] = {
        locality: leaderInfo,
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
                    item.otro; // loanGranted se muestra por separado
    const comissions = item.loanPaymentComission + item.loanGrantedComission + item.leadComission;
    
    // CALCULAR BALANCES EN EL FRONTEND (ingresos - gastos)
    const totalIngresosReales = item.cashAbono + item.bankAbono;
    const totalEgresos = expenses + item.credito + item.loanGranted + comissions;
    
    // CORREGIDO: Balance = Ingresos - Gastos (puede ser negativo)
    let calculatedCashBalance = 0;
    let calculatedBankBalance = 0;
    
    if (totalIngresosReales === 0 && item.moneyInvestment === 0) {
      // CASO 1: No hay ingresos, solo gastos -> Balance negativo
      // Asumir que los gastos se hacen en efectivo por defecto
      calculatedCashBalance = -totalEgresos;
      calculatedBankBalance = 0;
      
    } else if (totalIngresosReales === 0 && item.moneyInvestment > 0) {
      // CASO 2: Solo hay inversión de dinero, no abonos
      // Asumir que la inversión es en efectivo por defecto
      calculatedCashBalance = item.moneyInvestment - totalEgresos;
      calculatedBankBalance = 0;
      
    } else {
      // CASO 3: Hay ingresos reales (abonos), distribuir proporcionalmente
      const cashProportion = item.cashAbono / totalIngresosReales;
      const bankProportion = item.bankAbono / totalIngresosReales;
      
      // Distribuir moneyInvestment proporcionalmente
      const moneyInvestmentCash = item.moneyInvestment * cashProportion;
      const moneyInvestmentBank = item.moneyInvestment * bankProportion;
      
      // Distribuir gastos proporcionalmente
      const cashExpenses = totalEgresos * cashProportion;
      const bankExpenses = totalEgresos * bankProportion;
      
      // Balance final = Ingresos - Gastos
      calculatedCashBalance = (item.cashAbono + moneyInvestmentCash) - cashExpenses;
      calculatedBankBalance = (item.bankAbono + moneyInvestmentBank) - bankExpenses;
    }

    acc[leaderInfo].totalIncome += income;
    acc[leaderInfo].totalExpenses += expenses;
    acc[leaderInfo].totalComissions += comissions;
    acc[leaderInfo].balance += item.balance;
    acc[leaderInfo].profit += item.profit;
    acc[leaderInfo].cashBalance += calculatedCashBalance;
    acc[leaderInfo].bankBalance += calculatedBankBalance;
    acc[leaderInfo].details.push(item);

    return acc;
  }, {});

  const leaders = Object.values(groupedByLeader) as LocalitySummary[];

  return (
    <Box css={{ padding: '16px' }}>
      {leaders.map((leader: any) => (
        <Box key={leader.locality} css={{ marginBottom: '24px' }}>
          <h2 css={{ 
            margin: '0 0 16px 0', 
            padding: '8px 16px',
            backgroundColor: '#f7fafc',
            borderRadius: '4px',
            borderLeft: '4px solid #4299e1'
          }}>
            👤 {leader.locality}
          </h2>
          <table css={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Concepto</th>
                <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Dinero otorgado en créditos</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                  ${leader.details.reduce((sum: number, item: any) => sum + item.credito, 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Préstamos otorgados</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                  ${leader.details.reduce((sum: number, item: any) => sum + item.loanGranted, 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Gastos operativos</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                  ${leader.details.reduce((sum: number, item: any) => 
                    sum + item.viatic + item.gasoline + item.accommodation + 
                    item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                    item.otro, 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Comisiones</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                  ${leader.totalComissions.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Efectivo</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                  ${leader.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Banco</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                  ${leader.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#3182ce' }}>(+) Inversión de dinero</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#3182ce' }}>
                  ${leader.details.reduce((sum: number, item: any) => sum + item.moneyInvestment, 0).toFixed(2)}
                </td>
              </tr>
              <tr css={{ backgroundColor: '#f7fafc', fontWeight: 'bold' }}>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance en Efectivo</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  ${leader.cashBalance.toFixed(2)}
                </td>
              </tr>
              <tr css={{ backgroundColor: '#f7fafc', fontWeight: 'bold' }}>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance en Banco</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  ${leader.bankBalance.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </Box>
      ))}
      {/* Totales Generales */}
      <Box css={{ 
        marginTop: '32px', 
        padding: '16px',
        backgroundColor: '#f7fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h2 css={{ margin: '0 0 16px 0', color: '#2d3748' }}>Totales Generales</h2>
        <table css={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Concepto</th>
              <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Dinero otorgado en créditos</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${leaders.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.credito, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Préstamos otorgados</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${leaders.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.loanGranted, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Gastos operativos</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${leaders.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => 
                  sum + item.viatic + item.gasoline + item.accommodation + 
                  item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                  item.otro, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Comisiones</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${leaders.reduce((sum: number, loc: LocalitySummary) => sum + loc.totalComissions, 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Efectivo</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                ${leaders.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Banco</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                ${leaders.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#3182ce' }}>(+) Total Inversión de dinero</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#3182ce' }}>
                ${leaders.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.moneyInvestment, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr css={{ backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance Total en Efectivo</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${leaders.reduce((sum: number, loc: LocalitySummary) => sum + loc.cashBalance, 0).toFixed(2)}
              </td>
            </tr>
            <tr css={{ backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance Total en Banco</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${leaders.reduce((sum: number, loc: LocalitySummary) => sum + loc.bankBalance, 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </Box>
    </Box>
  );
}; 