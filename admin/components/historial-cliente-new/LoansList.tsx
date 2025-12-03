/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React, { useState } from 'react';
import { LoanCard } from './LoanCard';
import { User, AlertCircle } from 'lucide-react';
import { colors, radius, commonStyles } from './theme';
import { useSafeTheme, useSafeThemeColors } from '../../contexts/ThemeContext';

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

interface LoansListProps {
  loans: Loan[];
  title?: string;
  isCollateral?: boolean;
}

export function LoansList({
  loans,
  title = "Préstamos como Cliente",
  isCollateral = false
}: LoansListProps) {
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  // Use safe hooks that don't throw when outside ThemeProvider
  const { isDark } = useSafeTheme();
  const themeColors = useSafeThemeColors();

  const toggleLoanExpand = (loanId: string) => {
    setExpandedLoan(expandedLoan === loanId ? null : loanId);
  };

  const iconColor = isCollateral ? colors.red[500] : colors.blue[500];

  return (
    <div>
      <div css={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 css={{ 
          fontSize: '1.25rem', 
          fontWeight: 600, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          color: themeColors.foreground, 
          margin: 0,
          transition: 'color 0.3s ease',
        }}>
          <User size={20} color={iconColor} />
          {title} ({loans.length})
        </h2>
      </div>

      <div css={{ 
        backgroundColor: themeColors.card, 
        borderRadius: radius.xl, 
        padding: '1rem', 
        border: `1px solid ${themeColors.border}`, 
        marginBottom: '1.5rem',
        transition: 'all 0.3s ease',
      }}>
        <div css={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem', 
          fontSize: '0.875rem', 
          color: themeColors.foregroundMuted, 
          marginBottom: '0.5rem' 
        }}>
          <AlertCircle size={16} />
          <span>
            Haz clic en cualquier fila para ver el detalle completo de pagos y fechas
          </span>
        </div>
        <div css={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
          <LegendItem 
            color={isDark ? colors.blue[900] : colors.blue[100]} 
            border={isDark ? colors.blue[700] : colors.blue[200]} 
            label="Cubierto por sobrepago" 
            isDark={isDark}
            themeColors={themeColors}
          />
          <LegendItem 
            color={isDark ? colors.amber[900] : colors.amber[100]} 
            border={isDark ? colors.amber[700] : colors.amber[200]} 
            label="Pago parcial" 
            isDark={isDark}
            themeColors={themeColors}
          />
          <LegendItem 
            color={isDark ? colors.red[900] : colors.red[100]} 
            border={isDark ? colors.red[700] : colors.red[200]} 
            label="Falta (sin pago)" 
            isDark={isDark}
            themeColors={themeColors}
          />
        </div>
      </div>

      <div css={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {loans.map(loan => (
          <LoanCard 
            key={loan.id} 
            loan={loan} 
            isExpanded={expandedLoan === loan.id} 
            onToggleExpand={() => toggleLoanExpand(loan.id)} 
          />
        ))}
      </div>
    </div>
  );
}

interface LegendItemProps {
  color: string;
  border: string;
  label: string;
  isDark?: boolean;
  themeColors?: {
    foreground?: string;
  };
}

function LegendItem({ color, border, label, themeColors }: LegendItemProps) {
  return (
    <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div css={{ 
        width: '1rem', 
        height: '1rem', 
        borderRadius: '0.25rem', 
        backgroundColor: color, 
        border: `1px solid ${border}` 
      }}></div>
      <span css={{ 
        fontSize: '0.875rem', 
        color: themeColors?.foreground || colors.foreground,
        transition: 'color 0.3s ease',
      }}>{label}</span>
    </div>
  );
}
