import React, { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { Locality } from '../types/financial';
interface LocalityCardProps {
  locality: Locality;
}
export function LocalityCard({
  locality
}: LocalityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  const totalBalance = locality.balances.cash + locality.balances.bank;
  const isPositive = totalBalance >= 0;
  return <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden">
      {/* Header - Collapsible */}
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold text-slate-900">
              {locality.name}
            </h3>
            <p className="text-sm text-slate-500">
              {locality.transactions.length} transacciones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Quick Stats */}
          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">Balance Total</p>
              <p className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">Colocado</p>
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(locality.totalPlaced.creditsAndLoans)}
              </p>
            </div>
          </div>

          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && <div className="px-6 pb-6 border-t border-slate-100">
          {/* Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-blue-900">
                  Efectivo
                </span>
              </div>
              <p className={`text-2xl font-bold ${locality.balances.cash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(locality.balances.cash)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-purple-900">
                  Banco
                </span>
              </div>
              <p className={`text-2xl font-bold ${locality.balances.bank >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(locality.balances.bank)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  {isPositive ? <TrendingUp className="w-4 h-4 text-white" /> : <TrendingDown className="w-4 h-4 text-white" />}
                </div>
                <span className="text-sm font-medium text-green-900">
                  Total
                </span>
              </div>
              <p className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalBalance)}
              </p>
            </div>
          </div>

          {/* Transactions */}
          {locality.transactions.length > 0 ? <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                Transacciones
              </h4>
              {locality.transactions.map((transaction, index) => <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${transaction.isCommission ? 'bg-red-500' : 'bg-blue-500'}`} />
                    <span className="text-sm text-slate-700">
                      {transaction.concept}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                      {transaction.quantity}x
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${transaction.isCommission ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatCurrency(transaction.total)}
                  </span>
                </div>)}
            </div> : <div className="text-center py-8 text-slate-400">
              <p className="text-sm">Sin transacciones registradas</p>
            </div>}

          {/* Summary */}
          <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">
                Créditos + Préstamos
              </p>
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(locality.totalPlaced.creditsAndLoans)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Comisiones</p>
              <p className="text-lg font-bold text-red-600">
                {formatCurrency(locality.totalPlaced.commissions)}
              </p>
            </div>
          </div>
        </div>}
    </div>;
}