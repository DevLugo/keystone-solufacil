import React, { useState } from 'react';
import { LoanCard } from './LoanCard';
import { User, AlertCircle, Banknote } from 'lucide-react';
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
}
export function LoansList({
  loans
}: LoansListProps) {
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const toggleLoanExpand = (loanId: string) => {
    setExpandedLoan(expandedLoan === loanId ? null : loanId);
  };
  return <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <User size={20} className="text-blue-600" />
          Préstamos como Cliente ({loans.length})
        </h2>
      </div>
      <div className="bg-card rounded-xl p-4 border mb-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
          <AlertCircle size={16} />
          <span>
            Haz clic en cualquier fila para ver el detalle completo de pagos y
            fechas
          </span>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200"></div>
            <span className="text-sm">Cubierto por sobrepago</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200"></div>
            <span className="text-sm">Pago parcial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-200"></div>
            <span className="text-sm">Falta (sin pago)</span>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {loans.map(loan => <LoanCard key={loan.id} loan={loan} isExpanded={expandedLoan === loan.id} onToggleExpand={() => toggleLoanExpand(loan.id)} />)}
      </div>
    </div>;
}