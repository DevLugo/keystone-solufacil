/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { ChevronDown, ChevronUp, Phone, Clock, User } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { PaymentHistoryModal } from './PaymentHistoryModal';
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
  const progress = loan.totalAmount > 0 ? Math.round((loan.paidAmount / loan.totalAmount) * 100) : 0;

  return (
    <div css={{
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      border: `1px solid ${colors.border}`,
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s',
      '&:hover': { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }
    }}>
      <div
        css={{
          padding: '1.25rem',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          '&:hover': { backgroundColor: 'rgba(241, 245, 249, 0.3)' } // muted/30
        }}
        onClick={onToggleExpand}
      >
        <div css={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div css={{ flex: 1 }}>
            <div css={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span css={{ 
                backgroundColor: colors.slate[100], 
                color: colors.slate[700], 
                padding: '0.375rem 0.75rem', 
                borderRadius: radius.lg, 
                fontWeight: 600, 
                fontSize: '0.875rem', 
                border: `1px solid ${colors.slate[200]}` 
              }}>
                {loan.date}
              </span>
              {loan.status === 'active' && <StatusBadge variant="success">ACTIVO</StatusBadge>}
              {loan.status === 'completed' && <StatusBadge variant="default">COMPLETADO</StatusBadge>}
              {loan.status === 'renewed' && <StatusBadge variant="purple">RENOVADO</StatusBadge>}
            </div>
            <div css={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: colors.mutedForeground }}>
              <span css={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={14} />
                {loan.weekCount} semanas
              </span>
              <span css={{ 
                backgroundColor: colors.blue[50], 
                color: colors.blue[800], 
                fontSize: '0.75rem', 
                fontWeight: 500, 
                padding: '0.125rem 0.5rem', 
                borderRadius: radius.sm 
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
              color: colors.mutedForeground,
              transition: 'background-color 0.2s',
              '&:hover': { backgroundColor: colors.muted }
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
          <Stat label="PRESTADO" value={`$${loan.amount.toLocaleString('es-MX')}`} />
          <Stat label="TOTAL" value={`$${loan.totalAmount.toLocaleString('es-MX')}`} />
          <Stat label="PAGADO" value={`$${loan.paidAmount.toLocaleString('es-MX')}`} valueColor={colors.green[600]} />
          <Stat 
            label="PENDIENTE" 
            value={`$${loan.remainingAmount.toLocaleString('es-MX')}`} 
            valueColor={loan.remainingAmount > 0 ? colors.red[600] : colors.green[600]} 
          />
        </div>

        {/* Progress bar */}
        <div css={{ width: '100%', backgroundColor: colors.muted, borderRadius: '9999px', height: '0.5rem', marginBottom: '0.75rem' }}>
          <div css={{ 
            backgroundColor: colors.blue[600], 
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
            backgroundColor: colors.blue[50], 
            borderRadius: radius.lg, 
            border: `1px solid ${colors.blue[100]}` 
          }}>
            <div css={{ padding: '0.25rem', backgroundColor: 'white', borderRadius: '50%' }}>
              <User size={14} color={colors.blue[600]} />
            </div>
            <div css={{ flex: 1, minWidth: 0 }}>
              <div css={{ fontSize: '0.75rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                AVAL: {loan.guarantor.name}
              </div>
              <div css={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: colors.mutedForeground }}>
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

function Stat({ label, value, valueColor }: any) {
  return (
    <div>
      <div css={{ fontSize: '0.75rem', color: colors.mutedForeground, marginBottom: '0.25rem' }}>{label}</div>
      <div css={{ fontWeight: 600, fontSize: '0.875rem', color: valueColor || colors.foreground }}>{value}</div>
    </div>
  );
}

