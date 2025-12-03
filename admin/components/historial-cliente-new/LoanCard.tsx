/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { ChevronDown, ChevronUp, Phone, Clock, User } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { PaymentHistoryModal } from './PaymentHistoryModal';
import { colors, radius, commonStyles } from './theme';
import { useTheme, useThemeColors } from '../../contexts/ThemeContext';

interface Payment {
  id: number;
  date: string;
  expected: number;
  paid: number;
  surplus: number;
  status: 'paid' | 'partial' | 'missed' | 'overpaid' | 'upcoming';
}

interface Loan {
  id: string;
  date: string;
  status: 'active' | 'completed' | 'renewed';
  amount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  guarantor: {
    name: string;
    phone: string;
  };
  weekCount: number;
  interestRate: number;
  interestAmount: number;
  payments: Payment[];
  renovationId?: string;
}

interface LoanCardProps {
  loan: Loan;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function LoanCard({
  loan,
  isExpanded,
  onToggleExpand
}: LoanCardProps) {
  // Try to get theme, fallback to light mode values if not in ThemeProvider
  let themeColors;
  let isDark = false;
  try {
    const theme = useTheme();
    themeColors = useThemeColors();
    isDark = theme.isDark;
  } catch {
    themeColors = {
      card: colors.card,
      foreground: colors.foreground,
      foregroundMuted: colors.mutedForeground,
      background: colors.background,
      border: colors.border,
    };
  }

  const progress = loan.totalAmount > 0 ? Math.round((loan.paidAmount / loan.totalAmount) * 100) : 0;

  return (
    <div css={{
      backgroundColor: themeColors.card,
      borderRadius: radius.xl,
      border: `1px solid ${themeColors.border}`,
      boxShadow: isDark ? '0 1px 2px 0 rgb(0 0 0 / 0.2)' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      '&:hover': { 
        boxShadow: isDark ? '0 4px 6px -1px rgb(0 0 0 / 0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
      }
    }}>
      <div
        css={{
          padding: '1.25rem',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          '&:hover': { 
            backgroundColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(241, 245, 249, 0.3)' 
          }
        }}
        onClick={onToggleExpand}
      >
        <div css={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div css={{ flex: 1 }}>
            <div css={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span css={{ 
                backgroundColor: isDark ? colors.slate[700] : colors.slate[100], 
                color: isDark ? colors.slate[200] : colors.slate[700], 
                padding: '0.375rem 0.75rem', 
                borderRadius: radius.lg, 
                fontWeight: 600, 
                fontSize: '0.875rem', 
                border: `1px solid ${isDark ? colors.slate[600] : colors.slate[200]}`,
                transition: 'all 0.3s ease',
              }}>
                {loan.date}
              </span>
              {loan.status === 'active' && <StatusBadge variant="success">ACTIVO</StatusBadge>}
              {loan.status === 'completed' && <StatusBadge variant="default">COMPLETADO</StatusBadge>}
              {loan.status === 'renewed' && <StatusBadge variant="purple">RENOVADO</StatusBadge>}
            </div>
            <div css={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              fontSize: '0.875rem', 
              color: themeColors.foregroundMuted 
            }}>
              <span css={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={14} />
                {loan.weekCount} semanas
              </span>
              <span css={{ 
                backgroundColor: isDark ? colors.blue[900] : colors.blue[50], 
                color: isDark ? colors.blue[300] : colors.blue[800], 
                fontSize: '0.75rem', 
                fontWeight: 500, 
                padding: '0.125rem 0.5rem', 
                borderRadius: radius.sm,
                transition: 'all 0.3s ease',
              }}>
                #{loan.id.slice(-8)}
              </span>
            </div>
          </div>
          <button
            css={{
              padding: '0.5rem',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.875rem',
              color: themeColors.foregroundMuted,
              transition: 'background-color 0.2s',
              '&:hover': { backgroundColor: isDark ? colors.slate[700] : colors.muted }
            }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {isExpanded ? (
              <>
                <ChevronUp size={20} />
                <span css={{ fontSize: '0.75rem' }}>Ocultar</span>
              </>
            ) : (
              <>
                <ChevronDown size={20} />
                <span css={{ fontSize: '0.75rem' }}>Ver detalles</span>
              </>
            )}
          </button>
        </div>

        <div css={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '0.75rem', 
          marginBottom: '0.75rem',
          '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(4, 1fr)' }
        }}>
          <Stat label="PRESTADO" value={`$${loan.amount.toLocaleString('es-MX')}`} isDark={isDark} themeColors={themeColors} />
          <Stat label="TOTAL" value={`$${loan.totalAmount.toLocaleString('es-MX')}`} isDark={isDark} themeColors={themeColors} />
          <Stat label="PAGADO" value={`$${loan.paidAmount.toLocaleString('es-MX')}`} valueColor={colors.green[500]} isDark={isDark} themeColors={themeColors} />
          <Stat 
            label="PENDIENTE" 
            value={`$${loan.remainingAmount.toLocaleString('es-MX')}`} 
            valueColor={loan.remainingAmount > 0 ? colors.red[500] : colors.green[500]} 
            isDark={isDark}
            themeColors={themeColors}
          />
        </div>

        {/* Progress bar */}
        <div css={{ 
          width: '100%', 
          backgroundColor: isDark ? colors.slate[700] : colors.muted, 
          borderRadius: '9999px', 
          height: '0.5rem', 
          marginBottom: '0.75rem' 
        }}>
          <div css={{ 
            backgroundColor: colors.blue[500], 
            height: '0.5rem', 
            borderRadius: '9999px', 
            transition: 'width 0.5s',
            width: `${progress}%` 
          }}></div>
        </div>

        {/* Aval info */}
        {loan.guarantor && loan.guarantor.name && (
          <div css={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            padding: '0.625rem', 
            backgroundColor: isDark ? colors.blue[900] : colors.blue[50], 
            borderRadius: radius.lg, 
            border: `1px solid ${isDark ? colors.blue[700] : colors.blue[100]}`,
            transition: 'all 0.3s ease',
          }}>
            <div css={{ 
              padding: '0.25rem', 
              backgroundColor: isDark ? colors.slate[800] : 'white', 
              borderRadius: '50%' 
            }}>
              <User size={14} color={colors.blue[500]} />
            </div>
            <div css={{ flex: 1, minWidth: 0 }}>
              <div css={{ 
                fontSize: '0.75rem', 
                fontWeight: 500, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                color: isDark ? colors.blue[300] : colors.foreground,
              }}>
                AVAL: {loan.guarantor.name}
              </div>
              <div css={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.25rem', 
                fontSize: '0.75rem', 
                color: themeColors.foregroundMuted 
              }}>
                <Phone size={12} />
                {loan.guarantor.phone}
              </div>
            </div>
          </div>
        )}
      </div>
      {isExpanded && <PaymentHistoryModal loan={loan} onClose={onToggleExpand} />}
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  valueColor?: string;
  isDark?: boolean;
  themeColors?: {
    foreground?: string;
    foregroundMuted?: string;
  };
}

function Stat({ label, value, valueColor, themeColors }: StatProps) {
  return (
    <div>
      <div css={{ 
        fontSize: '0.75rem', 
        color: themeColors?.foregroundMuted || colors.mutedForeground, 
        marginBottom: '0.25rem',
        transition: 'color 0.3s ease',
      }}>{label}</div>
      <div css={{ 
        fontWeight: 600, 
        fontSize: '0.875rem', 
        color: valueColor || themeColors?.foreground || colors.foreground,
        transition: 'color 0.3s ease',
      }}>{value}</div>
    </div>
  );
}
