import React from 'react';
import { X, RefreshCw, Banknote, PiggyBank, Clock, TrendingUp } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
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
  const getRowClass = (payment: Payment & {
    remainingDebt: number;
  }, index: number): string => {
    if (isDoublePayment(payment)) {
      return 'bg-purple-50 border-l-4 border-purple-500';
    }
    switch (payment.status) {
      case 'overpaid':
        return 'bg-emerald-50 border-l-4 border-emerald-400';
      case 'partial':
        return 'bg-yellow-50 border-l-4 border-yellow-400';
      case 'missed':
        return 'bg-red-50 border-l-4 border-red-400';
      default:
        return '';
    }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-semibold mb-1">Historial de Pagos</h2>
            <p className="text-sm text-muted-foreground">
              {loan.date} • {loan.weekCount} semanas
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Loan Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            {loan.renovationId && <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <RefreshCw size={16} className="text-purple-600 flex-shrink-0" />
                <div className="text-xs min-w-0">
                  <span className="text-muted-foreground block">
                    Renovación
                  </span>
                  <div className="font-mono text-purple-700 truncate">
                    {loan.renovationId}
                  </div>
                </div>
              </div>}
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <Banknote size={16} className="text-emerald-600 flex-shrink-0" />
              <div className="text-xs">
                <span className="text-muted-foreground block">Prestado</span>
                <div className="font-semibold">
                  ${loan.amount.toLocaleString('es-MX')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <PiggyBank size={16} className="text-blue-600 flex-shrink-0" />
              <div className="text-xs">
                <span className="text-muted-foreground block">Total</span>
                <div className="font-semibold">
                  ${loan.totalAmount.toLocaleString('es-MX')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <TrendingUp size={16} className="text-amber-600 flex-shrink-0" />
              <div className="text-xs">
                <span className="text-muted-foreground block">Intereses</span>
                <div className="font-semibold">
                  ${loan.interestAmount.toLocaleString('es-MX')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <Clock size={16} className="text-indigo-600 flex-shrink-0" />
              <div className="text-xs">
                <span className="text-muted-foreground block">Duración</span>
                <div className="font-semibold">{loan.weekCount} semanas</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-lg border border-rose-100">
              <TrendingUp size={16} className="text-rose-600 flex-shrink-0" />
              <div className="text-xs">
                <span className="text-muted-foreground block">Tasa</span>
                <div className="font-semibold">{loan.interestRate}%</div>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4 border">
            <div className="text-xs font-medium mb-2 text-muted-foreground">
              Leyenda:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-50 border-l-4 border-emerald-400"></div>
                <span>Adelanto/Sobrepago</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-50 border-l-4 border-purple-500"></div>
                <span>Pago Doble (misma semana)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-50 border-l-4 border-yellow-400"></div>
                <span>Pago Parcial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-50 border-l-4 border-red-400"></div>
                <span>Sin Pago</span>
              </div>
            </div>
          </div>
          {/* Payment Table */}
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left font-medium w-8">#</th>
                  <th className="px-2 py-2 text-left font-medium">Fecha</th>
                  <th className="px-2 py-2 text-right font-medium">Esperado</th>
                  <th className="px-2 py-2 text-right font-medium">Pagado</th>
                  <th className="px-2 py-2 text-right font-medium">
                    Excedente
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    Deuda Pendiente
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paymentsWithDebt.map((payment, index) => <tr key={payment.id} className={getRowClass(payment, index)}>
                    <td className="px-2 py-2 font-medium text-muted-foreground">
                      {payment.id}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span>{payment.date.split(',')[0]}</span>
                        {isDoublePayment(payment) && <span className="inline-flex items-center gap-1 bg-purple-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            DOBLE PAGO
                          </span>}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      ${payment.expected.toLocaleString('es-MX')}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">
                      ${payment.paid.toLocaleString('es-MX')}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {payment.surplus > 0 ? <span className="text-green-600 font-medium">
                          +${payment.surplus.toLocaleString('es-MX')}
                        </span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">
                      <span className={payment.remainingDebt === 0 ? 'text-green-600' : 'text-red-600'}>
                        ${payment.remainingDebt.toLocaleString('es-MX')}
                      </span>
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>;
}