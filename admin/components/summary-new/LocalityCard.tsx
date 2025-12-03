/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React, { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { colors, shadows, radius, gradients, formatCurrency } from './theme';

interface Transaction {
  concept: string;
  quantity: number;
  total: number;
  isCommission?: boolean;
  isIncome?: boolean;
}

interface LocalityData {
  locationKey: string;
  locality: string;
  municipality: string;
  state: string;
  leaderName: string;
  totalIncome: number;
  totalExpenses: number;
  totalComissions: number;
  balance: number;
  profit: number;
  cashBalance: number;
  bankBalance: number;
  transactions: Transaction[];
  totalPlaced: {
    creditsAndLoans: number;
    commissions: number;
    totalCollection: number;
    collectionCash: number;
    collectionBank: number;
  };
}

interface LocalityCardProps {
  locality: LocalityData;
}

export function LocalityCard({ locality }: LocalityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const totalBalance = locality.cashBalance + locality.bankBalance;
  const isPositive = totalBalance >= 0;

  return (
    <div
      css={{
        backgroundColor: colors.card,
        borderRadius: radius['2xl'],
        boxShadow: shadows.lg,
        border: `1px solid ${colors.slate[100]}`,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: shadows.xl,
        },
      }}
    >
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        css={{
          width: '100%',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: colors.slate[50],
          },
        }}
      >
        <div css={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            css={{
              width: '3rem',
              height: '3rem',
              background: gradients.purpleToPink,
              borderRadius: radius.xl,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapPin size={24} color="white" />
          </div>
          <div css={{ textAlign: 'left' }}>
            <h3 css={{ fontSize: '1.25rem', fontWeight: 700, color: colors.slate[900], margin: 0 }}>
              {locality.locationKey}
            </h3>
            <p css={{ fontSize: '0.875rem', color: colors.slate[500], margin: 0 }}>
              {locality.transactions.length} transacciones
            </p>
          </div>
        </div>

        <div css={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Quick Stats - Hidden on mobile */}
          <div css={{ display: 'none', alignItems: 'center', gap: '1.5rem', '@media (min-width: 768px)': { display: 'flex' } }}>
            <div css={{ textAlign: 'right' }}>
              <p css={{ fontSize: '0.75rem', color: colors.slate[500], marginBottom: '0.25rem', margin: 0 }}>Balance Efectivo</p>
              <p css={{ fontSize: '1.125rem', fontWeight: 700, color: locality.cashBalance >= 0 ? colors.green[600] : colors.red[600], margin: 0 }}>
                {formatCurrency(locality.cashBalance)}
              </p>
            </div>
            <div css={{ textAlign: 'right' }}>
              <p css={{ fontSize: '0.75rem', color: colors.slate[500], marginBottom: '0.25rem', margin: 0 }}>Balance Banco</p>
              <p css={{ fontSize: '1.125rem', fontWeight: 700, color: locality.bankBalance >= 0 ? colors.green[600] : colors.red[600], margin: 0 }}>
                {formatCurrency(locality.bankBalance)}
              </p>
            </div>
          </div>

          {isExpanded ? (
            <ChevronUp size={20} color={colors.slate[400]} />
          ) : (
            <ChevronDown size={20} color={colors.slate[400]} />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div css={{ padding: '0 1.5rem 1.5rem', borderTop: `1px solid ${colors.slate[100]}` }}>
          {/* Balance Cards */}
          <div css={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginTop: '1.5rem', marginBottom: '1.5rem', '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(3, 1fr)' } }}>
            <BalanceCard
              label="Efectivo"
              value={locality.cashBalance}
              gradient="linear-gradient(to bottom right, #eff6ff, #dbeafe)"
              iconBg={colors.blue[500]}
            />
            <BalanceCard
              label="Banco"
              value={locality.bankBalance}
              gradient="linear-gradient(to bottom right, #faf5ff, #f3e8ff)"
              iconBg={colors.purple[500]}
            />
            <BalanceCard
              label="Total"
              value={totalBalance}
              gradient="linear-gradient(to bottom right, #f0fdf4, #dcfce7)"
              iconBg={colors.green[500]}
              showTrend
              isPositive={isPositive}
            />
          </div>

          {/* Transactions */}
          {locality.transactions.length > 0 ? (
            <div css={{ marginBottom: '1.5rem' }}>
              <h4 css={{ fontSize: '0.875rem', fontWeight: 600, color: colors.slate[700], marginBottom: '0.75rem', margin: '0 0 0.75rem 0' }}>
                Transacciones
              </h4>
              <div css={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {locality.transactions.map((transaction, index) => (
                  <div
                    key={index}
                    css={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      backgroundColor: colors.slate[50],
                      borderRadius: radius.lg,
                      transition: 'background-color 0.2s ease',
                      '&:hover': {
                        backgroundColor: colors.slate[100],
                      },
                    }}
                  >
                    <div css={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        css={{
                          width: '0.5rem',
                          height: '0.5rem',
                          borderRadius: radius.full,
                          backgroundColor: transaction.isCommission ? colors.red[500] : (transaction.isIncome ? colors.green[500] : colors.blue[500]),
                        }}
                      />
                      <span css={{ fontSize: '0.875rem', color: colors.slate[700] }}>
                        {transaction.concept}
                      </span>
                      <span
                        css={{
                          fontSize: '0.75rem',
                          color: colors.slate[500],
                          backgroundColor: colors.slate[200],
                          padding: '0.125rem 0.5rem',
                          borderRadius: radius.full,
                        }}
                      >
                        {transaction.quantity}x
                      </span>
                    </div>
                    <span
                      css={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: transaction.isCommission ? colors.red[600] : (transaction.isIncome ? colors.green[600] : colors.slate[900]),
                      }}
                    >
                      {formatCurrency(transaction.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div css={{ textAlign: 'center', padding: '2rem', color: colors.slate[400] }}>
              <p css={{ fontSize: '0.875rem', margin: 0 }}>Sin transacciones registradas</p>
            </div>
          )}

          {/* Summary */}
          <div
            css={{
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: `1px solid ${colors.slate[200]}`,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            <div>
              <p css={{ fontSize: '0.75rem', color: colors.slate[500], marginBottom: '0.25rem', margin: '0 0 0.25rem 0' }}>
                Créditos + Préstamos
              </p>
              <p css={{ fontSize: '1.125rem', fontWeight: 700, color: colors.slate[900], margin: 0 }}>
                {formatCurrency(locality.totalPlaced.creditsAndLoans)}
              </p>
            </div>
            <div>
              <p css={{ fontSize: '0.75rem', color: colors.slate[500], marginBottom: '0.25rem', margin: '0 0 0.25rem 0' }}>
                Comisiones
              </p>
              <p css={{ fontSize: '1.125rem', fontWeight: 700, color: colors.red[600], margin: 0 }}>
                {formatCurrency(locality.totalPlaced.commissions)}
              </p>
            </div>
            <div>
              <p css={{ fontSize: '0.75rem', color: colors.slate[500], marginBottom: '0.25rem', margin: '0 0 0.25rem 0' }}>
                Cobranza Efectivo
              </p>
              <p css={{ fontSize: '1.125rem', fontWeight: 700, color: colors.green[600], margin: 0 }}>
                {formatCurrency(locality.totalPlaced.collectionCash)}
              </p>
            </div>
            <div>
              <p css={{ fontSize: '0.75rem', color: colors.slate[500], marginBottom: '0.25rem', margin: '0 0 0.25rem 0' }}>
                Cobranza Banco
              </p>
              <p css={{ fontSize: '1.125rem', fontWeight: 700, color: colors.green[600], margin: 0 }}>
                {formatCurrency(locality.totalPlaced.collectionBank)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceCard({
  label,
  value,
  gradient,
  iconBg,
  showTrend,
  isPositive,
}: {
  label: string;
  value: number;
  gradient: string;
  iconBg: string;
  showTrend?: boolean;
  isPositive?: boolean;
}) {
  return (
    <div
      css={{
        background: gradient,
        borderRadius: radius.xl,
        padding: '1rem',
      }}
    >
      <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div
          css={{
            width: '2rem',
            height: '2rem',
            backgroundColor: iconBg,
            borderRadius: radius.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {showTrend ? (
            isPositive ? (
              <TrendingUp size={16} color="white" />
            ) : (
              <TrendingDown size={16} color="white" />
            )
          ) : (
            <TrendingUp size={16} color="white" />
          )}
        </div>
        <span css={{ fontSize: '0.875rem', fontWeight: 500, color: colors.slate[900] }}>
          {label}
        </span>
      </div>
      <p
        css={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: value >= 0 ? colors.green[600] : colors.red[600],
          margin: 0,
        }}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

