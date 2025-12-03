/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { X, RefreshCw, Banknote, PiggyBank, Clock, TrendingUp } from 'lucide-react';
import { colors, radius, shadows } from './theme';

interface Payment {
  id: number;
  date: string;
  expected: number;
  paid: number;
  surplus: number;
  status: 'paid' | 'partial' | 'missed' | 'overpaid' | 'upcoming';
  remainingDebt?: number; // Added for calculated field
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

interface PaymentHistoryModalProps {
  loan: Loan;
  onClose: () => void;
}

export function PaymentHistoryModal({
  loan,
  onClose
}: PaymentHistoryModalProps) {
  // Calculate remaining debt after each payment
  const paymentsWithDebt = loan.payments.map((payment, index) => {
    const previousPayments = loan.payments.slice(0, index + 1);
    const totalPaid = previousPayments.reduce((sum, p) => sum + p.paid, 0);
    const remainingDebt = Math.max(0, loan.totalAmount - totalPaid);
    return {
      ...payment,
      remainingDebt
    };
  });

  // Detect double payments (same date)
  const paymentDates = paymentsWithDebt.map(p => p.date.split(',')[0]);
  const doublePaymentDates = paymentDates.filter((date, index) => paymentDates.indexOf(date) !== index);
  const isDoublePayment = (payment: Payment) => {
    const dateOnly = payment.date.split(',')[0];
    return doublePaymentDates.includes(dateOnly);
  };

  const getRowStyles = (payment: Payment, index: number) => {
    if (isDoublePayment(payment)) {
      return { backgroundColor: colors.purple[50], borderLeft: `4px solid ${colors.purple[500]}` };
    }
    switch (payment.status) {
      case 'overpaid':
        return { backgroundColor: colors.green[50], borderLeft: `4px solid ${colors.green[400]}` };
      case 'partial':
        return { backgroundColor: colors.amber[50], borderLeft: `4px solid ${colors.amber[400]}` };
      case 'missed':
        return { backgroundColor: colors.red[50], borderLeft: `4px solid ${colors.red[400]}` };
      default:
        return {};
    }
  };

  return (
    <div
      css={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={onClose}
    >
      <div
        css={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          boxShadow: shadows['2xl'], // Assuming 2xl exists or fallback
          width: '100%',
          maxWidth: '72rem', // max-w-6xl
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div css={{ padding: '1.25rem', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.slate[50] }}>
          <div>
            <h2 css={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem', margin: 0 }}>Historial de Pagos</h2>
            <p css={{ fontSize: '0.875rem', color: colors.mutedForeground, margin: 0 }}>
              {loan.date} • {loan.weekCount} semanas
            </p>
          </div>
          <button
            onClick={onClose}
            css={{
              padding: '0.5rem',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              '&:hover': { backgroundColor: colors.muted },
            }}
          >
            <X size={20} color={colors.mutedForeground} />
          </button>
        </div>

        {/* Content */}
        <div css={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {/* Loan Summary */}
          <div css={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '0.75rem', 
            marginBottom: '1.25rem',
            '@media (min-width: 640px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
            '@media (min-width: 1024px)': { gridTemplateColumns: 'repeat(6, 1fr)' }
          }}>
            {loan.renovationId && (
              <SummaryCard 
                icon={<RefreshCw size={16} color={colors.purple[600]} />} 
                bg={colors.purple[50]} 
                border={colors.purple[100]} 
                label="Renovación" 
                value={loan.renovationId} 
                valueColor={colors.purple[700]}
                isMono
              />
            )}
            <SummaryCard icon={<Banknote size={16} color={colors.green[600]} />} bg={colors.green[50]} border={colors.green[100]} label="Prestado" value={`$${loan.amount.toLocaleString('es-MX')}`} />
            <SummaryCard icon={<PiggyBank size={16} color={colors.blue[600]} />} bg={colors.blue[50]} border={colors.blue[100]} label="Total" value={`$${loan.totalAmount.toLocaleString('es-MX')}`} />
            <SummaryCard icon={<TrendingUp size={16} color={colors.amber[600]} />} bg={colors.amber[50]} border={colors.amber[100]} label="Intereses" value={`$${loan.interestAmount.toLocaleString('es-MX')}`} />
            <SummaryCard icon={<Clock size={16} color={colors.purple[600]} />} bg={colors.purple[50]} border={colors.purple[100]} label="Duración" value={`${loan.weekCount} semanas`} /> {/* Changed to purple/indigo */}
            <SummaryCard icon={<TrendingUp size={16} color={colors.red[600]} />} bg={colors.red[50]} border={colors.red[100]} label="Tasa" value={`${loan.interestRate}%`} />
          </div>

          {/* Legend */}
          <div css={{ backgroundColor: colors.slate[50], borderRadius: radius.lg, padding: '0.75rem', marginBottom: '1rem', border: `1px solid ${colors.border}` }}>
            <div css={{ fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.5rem', color: colors.mutedForeground }}>
              Leyenda:
            </div>
            <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', '@media (min-width: 640px)': { gridTemplateColumns: 'repeat(4, 1fr)' } }}>
              <LegendItem color={colors.green[50]} border={colors.green[400]} label="Adelanto/Sobrepago" />
              <LegendItem color={colors.purple[50]} border={colors.purple[500]} label="Pago Doble (misma semana)" />
              <LegendItem color={colors.amber[50]} border={colors.amber[400]} label="Pago Parcial" />
              <LegendItem color={colors.red[50]} border={colors.red[400]} label="Sin Pago" />
            </div>
          </div>

          {/* Payment Table */}
          <div css={{ overflowX: 'auto', margin: '0 -1.25rem', padding: '0 1.25rem' }}>
            <table css={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
              <thead css={{ backgroundColor: colors.slate[100], position: 'sticky', top: 0 }}>
                <tr>
                  <Th>#</Th>
                  <Th>Fecha</Th>
                  <Th align="right">Esperado</Th>
                  <Th align="right">Pagado</Th>
                  <Th align="right">Excedente</Th>
                  <Th align="right">Deuda Pendiente</Th>
                </tr>
              </thead>
              <tbody>
                {paymentsWithDebt.map((payment, index) => (
                  <tr key={payment.id} css={{ borderBottom: `1px solid ${colors.border}`, ...getRowStyles(payment, index) }}>
                    <Td css={{ color: colors.mutedForeground, fontWeight: 500 }}>{payment.id}</Td>
                    <Td>
                      <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{payment.date.split(',')[0]}</span>
                        {isDoublePayment(payment) && (
                          <span css={{ 
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem', 
                            backgroundColor: colors.purple[600], color: 'white', 
                            padding: '0.125rem 0.5rem', borderRadius: '9999px', 
                            fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' 
                          }}>
                            DOBLE PAGO
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td align="right">${payment.expected.toLocaleString('es-MX')}</Td>
                    <Td align="right" css={{ fontWeight: 600 }}>${payment.paid.toLocaleString('es-MX')}</Td>
                    <Td align="right">
                      {payment.surplus > 0 ? (
                        <span css={{ color: colors.green[600], fontWeight: 500 }}>+${payment.surplus.toLocaleString('es-MX')}</span>
                      ) : (
                        <span css={{ color: colors.mutedForeground }}>—</span>
                      )}
                    </Td>
                    <Td align="right" css={{ fontWeight: 600 }}>
                      <span css={{ color: payment.remainingDebt === 0 ? colors.green[600] : colors.red[600] }}>
                        ${payment.remainingDebt?.toLocaleString('es-MX')}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, bg, border, label, value, valueColor, isMono }: any) {
  return (
    <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: bg, borderRadius: radius.lg, border: `1px solid ${border}` }}>
      <div css={{ flexShrink: 0 }}>{icon}</div>
      <div css={{ fontSize: '0.75rem', minWidth: 0 }}>
        <span css={{ display: 'block', color: colors.mutedForeground }}>{label}</span>
        <div css={{ fontWeight: 600, color: valueColor || 'inherit', fontFamily: isMono ? 'monospace' : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, border, label }: any) {
  return (
    <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div css={{ width: '0.75rem', height: '0.75rem', borderRadius: '0.125rem', backgroundColor: color, borderLeft: `4px solid ${border}` }}></div>
      <span>{label}</span>
    </div>
  );
}

function Th({ children, align = 'left' }: any) {
  return <th css={{ padding: '0.5rem', textAlign: align, fontWeight: 500, width: align === 'left' && children === '#' ? '2rem' : 'auto' }}>{children}</th>;
}

function Td({ children, align = 'left', className }: any) {
  return <td className={className} css={{ padding: '0.5rem', textAlign: align }}>{children}</td>;
}

