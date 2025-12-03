/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { BarChart3, DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard } from 'lucide-react';
import { colors, shadows, radius, gradients, formatCurrency } from './theme';

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

interface ExecutiveSummaryProps {
  data: ExecutiveSummaryData;
}

export function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  const summaryItems = [
    { label: 'Créditos Otorgados', value: data.totalCreditsGiven, icon: <DollarSign size={20} color="white" />, color: 'blue' },
    { label: 'Préstamos Otorgados', value: data.totalLoansGiven, icon: <DollarSign size={20} color="white" />, color: 'purple' },
    { label: 'Gastos Operativos', value: data.totalOperatingExpenses, icon: <TrendingDown size={20} color="white" />, color: 'red' },
    { label: 'Comisiones', value: data.totalCommissions, icon: <TrendingUp size={20} color="white" />, color: 'amber' },
    { label: 'Abonos Efectivo', value: data.totalCashPayments, icon: <Wallet size={20} color="white" />, color: 'green' },
    { label: 'Abonos Banco', value: data.totalBankPayments, icon: <CreditCard size={20} color="white" />, color: 'teal' },
  ];

  const colorMap: Record<string, string> = {
    blue: gradients.blueToBlue,
    purple: gradients.purpleToPurple,
    green: gradients.greenToGreen,
    teal: gradients.tealToTeal,
    red: 'linear-gradient(to bottom right, #ef4444, #dc2626)',
    amber: 'linear-gradient(to bottom right, #f59e0b, #d97706)',
  };

  return (
    <div
      css={{
        backgroundColor: colors.card,
        borderRadius: radius['2xl'],
        boxShadow: shadows.lg,
        border: `1px solid ${colors.slate[100]}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        css={{
          background: gradients.slateToSlate,
          padding: '1.5rem',
        }}
      >
        <div css={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            css={{
              width: '3rem',
              height: '3rem',
              background: gradients.blueToPurple,
              borderRadius: radius.xl,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart3 size={24} color="white" />
          </div>
          <div>
            <h3 css={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', margin: 0 }}>
              Resumen Ejecutivo
            </h3>
            <p css={{ fontSize: '0.875rem', color: colors.slate[300], margin: 0 }}>
              Consolidado de todas las localidades
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div css={{ padding: '1.5rem' }}>
        {/* Summary Grid */}
        <div
          css={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '1rem',
            marginBottom: '1.5rem',
            '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
            '@media (min-width: 1024px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
          }}
        >
          {summaryItems.map((item, index) => (
            <div
              key={index}
              css={{
                background: 'linear-gradient(to bottom right, #f8fafc, #f1f5f9)',
                borderRadius: radius.xl,
                padding: '1rem',
              }}
            >
              <div css={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div
                  css={{
                    width: '2.5rem',
                    height: '2.5rem',
                    background: colorMap[item.color],
                    borderRadius: radius.lg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </div>
                <span css={{ fontSize: '0.75rem', fontWeight: 500, color: colors.slate[600] }}>
                  {item.label}
                </span>
              </div>
              <p css={{ fontSize: '1.5rem', fontWeight: 700, color: colors.slate[900], margin: 0 }}>
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Balance Cards */}
        <div
          css={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '1rem',
            '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
          }}
        >
          {/* Cash Balance */}
          <div
            css={{
              background: gradients.greenToGreen,
              borderRadius: radius.xl,
              padding: '1.5rem',
              color: 'white',
            }}
          >
            <div css={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div
                css={{
                  width: '2.5rem',
                  height: '2.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: radius.lg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wallet size={20} />
              </div>
              <span css={{ fontSize: '0.875rem', fontWeight: 500, opacity: 0.9 }}>
                Balance Total Efectivo
              </span>
            </div>
            <p css={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
              {formatCurrency(data.totalCashBalance)}
            </p>
            <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', opacity: 0.75 }}>
              {data.totalCashBalance >= 0 ? (
                <>
                  <TrendingUp size={16} />
                  <span>Balance positivo</span>
                </>
              ) : (
                <>
                  <TrendingDown size={16} />
                  <span>Balance negativo</span>
                </>
              )}
            </div>
          </div>

          {/* Bank Balance */}
          <div
            css={{
              background: gradients.blueToBlue,
              borderRadius: radius.xl,
              padding: '1.5rem',
              color: 'white',
            }}
          >
            <div css={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div
                css={{
                  width: '2.5rem',
                  height: '2.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: radius.lg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CreditCard size={20} />
              </div>
              <span css={{ fontSize: '0.875rem', fontWeight: 500, opacity: 0.9 }}>
                Balance Total Banco
              </span>
            </div>
            <p css={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
              {formatCurrency(data.totalBankBalance)}
            </p>
            <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', opacity: 0.75 }}>
              {data.totalBankBalance >= 0 ? (
                <>
                  <TrendingUp size={16} />
                  <span>Balance positivo</span>
                </>
              ) : (
                <>
                  <TrendingDown size={16} />
                  <span>Balance negativo</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

