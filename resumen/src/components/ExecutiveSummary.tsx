import React from 'react';
import { BarChart3, DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard } from 'lucide-react';
import { ExecutiveSummaryData } from '../types/financial';
interface ExecutiveSummaryProps {
  data: ExecutiveSummaryData;
}
export function ExecutiveSummary({
  data
}: ExecutiveSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  const summaryItems = [{
    label: 'Préstamos Otorgados',
    value: data.totalLoansGiven,
    icon: DollarSign,
    color: 'blue'
  }, {
    label: 'Comisiones',
    value: data.totalCommissions,
    icon: TrendingUp,
    color: 'purple'
  }, {
    label: 'Abonos Efectivo',
    value: data.totalCashPayments,
    icon: Wallet,
    color: 'green'
  }, {
    label: 'Abonos Banco',
    value: data.totalBankPayments,
    icon: CreditCard,
    color: 'teal'
  }];
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    teal: 'from-teal-500 to-teal-600'
  };
  return <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Resumen Ejecutivo</h3>
            <p className="text-sm text-slate-300">
              Consolidado de todas las localidades
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {summaryItems.map((item, index) => <div key={index} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 bg-gradient-to-br ${colorMap[item.color]} rounded-lg flex items-center justify-center`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {item.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(item.value)}
              </p>
            </div>)}
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium opacity-90">
                Balance Total Efectivo
              </span>
            </div>
            <p className="text-4xl font-bold mb-2">
              {formatCurrency(data.totalCashBalance)}
            </p>
            <div className="flex items-center gap-2 text-sm opacity-75">
              {data.totalCashBalance >= 0 ? <>
                  <TrendingUp className="w-4 h-4" />
                  <span>Balance positivo</span>
                </> : <>
                  <TrendingDown className="w-4 h-4" />
                  <span>Balance negativo</span>
                </>}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium opacity-90">
                Balance Total Banco
              </span>
            </div>
            <p className="text-4xl font-bold mb-2">
              {formatCurrency(data.totalBankBalance)}
            </p>
            <div className="flex items-center gap-2 text-sm opacity-75">
              {data.totalBankBalance >= 0 ? <>
                  <TrendingUp className="w-4 h-4" />
                  <span>Balance positivo</span>
                </> : <>
                  <TrendingDown className="w-4 h-4" />
                  <span>Balance negativo</span>
                </>}
            </div>
          </div>
        </div>
      </div>
    </div>;
}