/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { X, RefreshCw, Banknote, PiggyBank, Clock, TrendingUp } from 'lucide-react';
import { colors, radius, shadows } from './theme';
import { useTheme, useThemeColors } from '../../contexts/ThemeContext';

interface Payment {
  id: number;
  date: string;
  expected: number;
  paid: number;
  surplus: number;
  status: 'paid' | 'partial' | 'missed' | 'overpaid' | 'upcoming';
  remainingDebt?: number;
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

  const getRowStyles = (payment: Payment) => {
    if (isDoublePayment(payment)) {
      return { 
        backgroundColor: isDark ? colors.purple[900] : colors.purple[50], 
        borderLeft: `4px solid ${colors.purple[500]}` 
      };
    }
    switch (payment.status) {
      case 'overpaid':
        return { 
          backgroundColor: isDark ? colors.green[900] : colors.green[50], 
          borderLeft: `4px solid ${colors.green[400]}` 
        };
      case 'partial':
        return { 
          backgroundColor: isDark ? colors.amber[900] : colors.amber[50], 
          borderLeft: `4px solid ${colors.amber[400]}` 
        };
      case 'missed':
        return { 
          backgroundColor: isDark ? colors.red[900] : colors.red[50], 
          borderLeft: `4px solid ${colors.red[400]}` 
        };
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
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={onClose}
    >
      <div
        css={{
          backgroundColor: themeColors.card,
          borderRadius: radius.xl,
          boxShadow: isDark ? '0 25px 50px -12px rgb(0 0 0 / 0.5)' : shadows['2xl'],
          width: '100%',
          maxWidth: '72rem',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div css={{ 
          padding: '1.25rem', 
          borderBottom: `1px solid ${themeColors.border}`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          backgroundColor: isDark ? colors.slate[800] : colors.slate[50],
          transition: 'all 0.3s ease',
        }}>
          <div>
            <h2 css={{ 
              fontSize: '1.25rem', 
              fontWeight: 600, 
              marginBottom: '0.25rem', 
              margin: 0, 
              color: themeColors.foreground,
              transition: 'color 0.3s ease',
            }}>Historial de Pagos</h2>
            <p css={{ 
              fontSize: '0.875rem', 
              color: themeColors.foregroundMuted, 
              margin: 0 
            }}>
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
              '&:hover': { backgroundColor: isDark ? colors.slate[700] : colors.muted },
            }}
          >
            <X size={20} color={themeColors.foregroundMuted} />
          </button>
        </div>

        {/* Content */}
        <div css={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '1.25rem',
          backgroundColor: themeColors.card,
        }}>
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
                icon={<RefreshCw size={16} color={colors.purple[isDark ? 400 : 600]} />} 
                bg={isDark ? colors.purple[900] : colors.purple[50]} 
                border={isDark ? colors.purple[700] : colors.purple[100]} 
                label="Renovación" 
                value={loan.renovationId} 
                valueColor={isDark ? colors.purple[300] : colors.purple[700]}
                isMono
                isDark={isDark}
                themeColors={themeColors}
              />
            )}
            <SummaryCard 
              icon={<Banknote size={16} color={colors.green[isDark ? 400 : 600]} />} 
              bg={isDark ? colors.green[900] : colors.green[50]} 
              border={isDark ? colors.green[700] : colors.green[100]} 
              label="Prestado" 
              value={`$${loan.amount.toLocaleString('es-MX')}`} 
              isDark={isDark}
              themeColors={themeColors}
            />
            <SummaryCard 
              icon={<PiggyBank size={16} color={colors.blue[isDark ? 400 : 600]} />} 
              bg={isDark ? colors.blue[900] : colors.blue[50]} 
              border={isDark ? colors.blue[700] : colors.blue[100]} 
              label="Total" 
              value={`$${loan.totalAmount.toLocaleString('es-MX')}`} 
              isDark={isDark}
              themeColors={themeColors}
            />
            <SummaryCard 
              icon={<TrendingUp size={16} color={colors.amber[isDark ? 400 : 600]} />} 
              bg={isDark ? colors.amber[900] : colors.amber[50]} 
              border={isDark ? colors.amber[700] : colors.amber[100]} 
              label="Intereses" 
              value={`$${loan.interestAmount.toLocaleString('es-MX')}`} 
              isDark={isDark}
              themeColors={themeColors}
            />
            <SummaryCard 
              icon={<Clock size={16} color={colors.purple[isDark ? 400 : 600]} />} 
              bg={isDark ? colors.purple[900] : colors.purple[50]} 
              border={isDark ? colors.purple[700] : colors.purple[100]} 
              label="Duración" 
              value={`${loan.weekCount} semanas`} 
              isDark={isDark}
              themeColors={themeColors}
            />
            <SummaryCard 
              icon={<TrendingUp size={16} color={colors.red[isDark ? 400 : 600]} />} 
              bg={isDark ? colors.red[900] : colors.red[50]} 
              border={isDark ? colors.red[700] : colors.red[100]} 
              label="Tasa" 
              value={`${loan.interestRate}%`} 
              isDark={isDark}
              themeColors={themeColors}
            />
          </div>

          {/* Legend */}
          <div css={{ 
            backgroundColor: isDark ? colors.slate[800] : colors.slate[50], 
            borderRadius: radius.lg, 
            padding: '0.75rem', 
            marginBottom: '1rem', 
            border: `1px solid ${themeColors.border}`,
            transition: 'all 0.3s ease',
          }}>
            <div css={{ 
              fontSize: '0.75rem', 
              fontWeight: 500, 
              marginBottom: '0.5rem', 
              color: themeColors.foregroundMuted 
            }}>
              Leyenda:
            </div>
            <div css={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '0.5rem', 
              fontSize: '0.75rem', 
              '@media (min-width: 640px)': { gridTemplateColumns: 'repeat(4, 1fr)' } 
            }}>
              <LegendItem 
                color={isDark ? colors.green[900] : colors.green[50]} 
                border={colors.green[400]} 
                label="Adelanto/Sobrepago" 
                isDark={isDark}
                themeColors={themeColors}
              />
              <LegendItem 
                color={isDark ? colors.purple[900] : colors.purple[50]} 
                border={colors.purple[500]} 
                label="Pago Doble (misma semana)" 
                isDark={isDark}
                themeColors={themeColors}
              />
              <LegendItem 
                color={isDark ? colors.amber[900] : colors.amber[50]} 
                border={colors.amber[400]} 
                label="Pago Parcial" 
                isDark={isDark}
                themeColors={themeColors}
              />
              <LegendItem 
                color={isDark ? colors.red[900] : colors.red[50]} 
                border={colors.red[400]} 
                label="Sin Pago" 
                isDark={isDark}
                themeColors={themeColors}
              />
            </div>
          </div>

          {/* Payment Table */}
          <div css={{ overflowX: 'auto', margin: '0 -1.25rem', padding: '0 1.25rem' }}>
            <table css={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
              <thead css={{ 
                backgroundColor: isDark ? colors.slate[700] : colors.slate[100], 
                position: 'sticky', 
                top: 0 
              }}>
                <tr>
                  <Th isDark={isDark} themeColors={themeColors}>#</Th>
                  <Th isDark={isDark} themeColors={themeColors}>Fecha</Th>
                  <Th align="right" isDark={isDark} themeColors={themeColors}>Esperado</Th>
                  <Th align="right" isDark={isDark} themeColors={themeColors}>Pagado</Th>
                  <Th align="right" isDark={isDark} themeColors={themeColors}>Excedente</Th>
                  <Th align="right" isDark={isDark} themeColors={themeColors}>Deuda Pendiente</Th>
                </tr>
              </thead>
              <tbody>
                {paymentsWithDebt.map((payment) => (
                  <tr key={payment.id} css={{ 
                    borderBottom: `1px solid ${themeColors.border}`, 
                    ...getRowStyles(payment) 
                  }}>
                    <Td css={{ color: themeColors.foregroundMuted, fontWeight: 500 }} isDark={isDark} themeColors={themeColors}>{payment.id}</Td>
                    <Td isDark={isDark} themeColors={themeColors}>
                      <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span css={{ color: themeColors.foreground }}>{payment.date.split(',')[0]}</span>
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
                    <Td align="right" isDark={isDark} themeColors={themeColors}>
                      <span css={{ color: themeColors.foreground }}>${payment.expected.toLocaleString('es-MX')}</span>
                    </Td>
                    <Td align="right" css={{ fontWeight: 600, color: themeColors.foreground }} isDark={isDark} themeColors={themeColors}>
                      ${payment.paid.toLocaleString('es-MX')}
                    </Td>
                    <Td align="right" isDark={isDark} themeColors={themeColors}>
                      {payment.surplus > 0 ? (
                        <span css={{ color: colors.green[500], fontWeight: 500 }}>+${payment.surplus.toLocaleString('es-MX')}</span>
                      ) : (
                        <span css={{ color: themeColors.foregroundMuted }}>—</span>
                      )}
                    </Td>
                    <Td align="right" css={{ fontWeight: 600 }} isDark={isDark} themeColors={themeColors}>
                      <span css={{ color: payment.remainingDebt === 0 ? colors.green[500] : colors.red[500] }}>
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

interface SummaryCardProps {
  icon: React.ReactNode;
  bg: string;
  border: string;
  label: string;
  value: string;
  valueColor?: string;
  isMono?: boolean;
  isDark?: boolean;
  themeColors?: {
    foreground?: string;
    foregroundMuted?: string;
  };
}

function SummaryCard({ icon, bg, border, label, value, valueColor, isMono, themeColors }: SummaryCardProps) {
  return (
    <div css={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '0.5rem', 
      padding: '0.75rem', 
      backgroundColor: bg, 
      borderRadius: radius.lg, 
      border: `1px solid ${border}`,
      transition: 'all 0.3s ease',
    }}>
      <div css={{ flexShrink: 0 }}>{icon}</div>
      <div css={{ fontSize: '0.75rem', minWidth: 0 }}>
        <span css={{ 
          display: 'block', 
          color: themeColors?.foregroundMuted || colors.mutedForeground 
        }}>{label}</span>
        <div css={{ 
          fontWeight: 600, 
          color: valueColor || themeColors?.foreground || 'inherit', 
          fontFamily: isMono ? 'monospace' : 'inherit', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
          {value}
        </div>
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
        width: '0.75rem', 
        height: '0.75rem', 
        borderRadius: '0.125rem', 
        backgroundColor: color, 
        borderLeft: `4px solid ${border}` 
      }}></div>
      <span css={{ color: themeColors?.foreground || colors.foreground }}>{label}</span>
    </div>
  );
}

interface ThProps {
  children: React.ReactNode;
  align?: 'left' | 'right';
  isDark?: boolean;
  themeColors?: {
    foreground?: string;
  };
}

function Th({ children, align = 'left', themeColors }: ThProps) {
  return (
    <th css={{ 
      padding: '0.5rem', 
      textAlign: align, 
      fontWeight: 500, 
      width: align === 'left' && children === '#' ? '2rem' : 'auto',
      color: themeColors?.foreground || colors.foreground,
    }}>{children}</th>
  );
}

interface TdProps {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  isDark?: boolean;
  themeColors?: {
    foreground?: string;
    foregroundMuted?: string;
  };
}

function Td({ children, align = 'left', className }: TdProps) {
  return <td className={className} css={{ padding: '0.5rem', textAlign: align }}>{children}</td>;
}
