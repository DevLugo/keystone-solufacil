/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React, { useState } from 'react';
import { LoanCard } from './LoanCard';
import { User, AlertCircle } from 'lucide-react';
import { colors, radius, commonStyles } from './theme';

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

  const toggleLoanExpand = (loanId: string) => {
    setExpandedLoan(expandedLoan === loanId ? null : loanId);
  };

  const iconColor = isCollateral ? colors.red[600] : colors.blue[600];

  return (
    <div>
      <div css={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 css={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: colors.foreground, margin: 0 }}>
          <User size={20} color={iconColor} />
          {title} ({loans.length})
        </h2>
      </div>

      <div css={{ 
        backgroundColor: colors.card, 
        borderRadius: radius.xl, 
        padding: '1rem', 
        border: `1px solid ${colors.border}`, 
        marginBottom: '1.5rem' 
      }}>
        <div css={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: colors.mutedForeground, marginBottom: '0.5rem' }}>
          <AlertCircle size={16} />
          <span>
            Haz clic en cualquier fila para ver el detalle completo de pagos y fechas
          </span>
        </div>
        <div css={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
          <LegendItem color={colors.blue[100]} border={colors.blue[200]} label="Cubierto por sobrepago" />
          <LegendItem color={colors.amber[100]} border={colors.amber[200]} label="Pago parcial" />
          <LegendItem color={colors.red[100]} border={colors.red[200]} label="Falta (sin pago)" />
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

function LegendItem({ color, border, label }: any) {
  return (
    <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div css={{ width: '1rem', height: '1rem', borderRadius: '0.25rem', backgroundColor: color, border: `1px solid ${border}` }}></div>
      <span css={{ fontSize: '0.875rem' }}>{label}</span>
    </div>
  );
}

