import React, { Component } from 'react';
import { ChevronDown, ChevronUp, Phone, RefreshCw, Banknote, PiggyBank, Clock, TrendingUp, Calendar } from 'lucide-react';
import { PaymentHistory } from './PaymentHistory';
import { StatusBadge } from './StatusBadge';
import { PaymentHistoryModal } from './PaymentHistoryModal';
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
  const progress = Math.round(loan.paidAmount / loan.totalAmount * 100);
  return <div className="bg-card rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggleExpand}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-semibold text-sm border border-slate-200">
                {loan.date}
              </span>
              {loan.status === 'active' && <StatusBadge variant="success">ACTIVO</StatusBadge>}
              {loan.status === 'completed' && <StatusBadge variant="default">COMPLETADO</StatusBadge>}
              {loan.status === 'renewed' && <StatusBadge variant="purple">RENOVADO</StatusBadge>}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {loan.weekCount} semanas
              </span>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                #{loan.id.slice(-8)}
              </span>
            </div>
          </div>
          <button className="p-2 hover:bg-muted rounded-full transition-colors flex items-center gap-1 text-sm text-muted-foreground" onClick={e => {
          e.stopPropagation();
          onToggleExpand();
        }}>
            {isExpanded ? <>
                <ChevronUp size={20} />
                <span className="text-xs">Ocultar</span>
              </> : <>
                <ChevronDown size={20} />
                <span className="text-xs">Ver detalles</span>
              </>}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">PRESTADO</div>
            <div className="font-semibold text-sm">
              ${loan.amount.toLocaleString('es-MX')}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">TOTAL</div>
            <div className="font-semibold text-sm">
              ${loan.totalAmount.toLocaleString('es-MX')}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">PAGADO</div>
            <div className="font-semibold text-sm text-green-600">
              ${loan.paidAmount.toLocaleString('es-MX')}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">PENDIENTE</div>
            <div className={`font-semibold text-sm ${loan.remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${loan.remainingAmount.toLocaleString('es-MX')}
            </div>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mb-3">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{
          width: `${progress}%`
        }}></div>
        </div>
        <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
          <div className="p-1 bg-white rounded-full">
            <User size={14} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">
              AVAL: {loan.guarantor.name}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone size={12} />
              {loan.guarantor.phone}
            </div>
          </div>
        </div>
      </div>
      {isExpanded && <PaymentHistoryModal loan={loan} onClose={onToggleExpand} />}
    </div>;
}
function User(props: ComponentProps<typeof Phone>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>;
}