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
      startDate: selectedDate.toISOString().split('T')[0],
      endDate: selectedDate.toISOString().split('T')[0]
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

  // Agrupar por localidad
  const groupedByLocality = summaryData.reduce((acc: Record<string, any>, item: any) => {
    const localityName = item.locality || 'General';
    if (!acc[localityName]) {
      acc[localityName] = {
        locality: localityName,
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
    const income = item.abono;
    const expenses = item.viatic + item.gasoline + item.accommodation + 
                    item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                    item.loanGranted + item.otro;
    const comissions = item.loanPaymentComission + item.loanGrantedComission + item.leadComission;

    acc[localityName].totalIncome += income;
    acc[localityName].totalExpenses += expenses;
    acc[localityName].totalComissions += comissions;
    acc[localityName].balance += item.balance;
    acc[localityName].profit += item.profit;
    acc[localityName].cashBalance += item.cashBalance;
    acc[localityName].bankBalance += item.bankBalance;
    acc[localityName].details.push(item);

    return acc;
  }, {});

  const localities = Object.values(groupedByLocality) as LocalitySummary[];

  return (
    <Box css={{ padding: '16px' }}>
      {localities.map((locality: any) => (
        <Box key={locality.locality} css={{ marginBottom: '24px' }}>
          <h2 css={{ 
            margin: '0 0 16px 0', 
            padding: '8px 16px',
            backgroundColor: '#f7fafc',
            borderRadius: '4px',
            borderLeft: '4px solid #4299e1'
          }}>
            {locality.locality.split(' - ')[0]} - {locality.locality.split(' - ')[1]}
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
                  ${locality.details.reduce((sum: number, item: any) => sum + item.credito, 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Gastos operativos</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                  ${locality.details.reduce((sum: number, item: any) => 
                    sum + item.viatic + item.gasoline + item.accommodation + 
                    item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                    item.otro, 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Comisiones</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                  ${locality.totalComissions.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Efectivo</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                  ${locality.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Banco</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                  ${locality.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0).toFixed(2)}
                </td>
              </tr>
              <tr css={{ backgroundColor: '#f7fafc', fontWeight: 'bold' }}>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance en Efectivo</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  ${locality.cashBalance.toFixed(2)}
                </td>
              </tr>
              <tr css={{ backgroundColor: '#f7fafc', fontWeight: 'bold' }}>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance en Banco</td>
                <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                  ${locality.bankBalance.toFixed(2)}
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
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.credito, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Gastos operativos</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => 
                  sum + item.viatic + item.gasoline + item.accommodation + 
                  item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                  item.otro, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Comisiones</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.totalComissions, 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Efectivo</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Banco</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr css={{ backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance Total en Efectivo</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.cashBalance, 0).toFixed(2)}
              </td>
            </tr>
            <tr css={{ backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance Total en Banco</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.bankBalance, 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </Box>
    </Box>
  );
}; 