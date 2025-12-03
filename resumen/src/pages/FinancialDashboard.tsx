import React, { useMemo, useState } from 'react';
import { ArrowUpCircle, Calendar, Download } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { StatCard } from '../components/StatCard';
import { LocalityCard } from '../components/LocalityCard';
import { ExecutiveSummary } from '../components/ExecutiveSummary';
import { LocalityFilter } from '../components/LocalityFilter';
import { mockLocalities } from '../data/mockData';
import { ExecutiveSummaryData } from '../types/financial';
import { DollarSign, TrendingUp, Wallet, CreditCard } from 'lucide-react';
export function FinancialDashboard() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [selectedLocality, setSelectedLocality] = useState('all');
  const filteredLocalities = useMemo(() => {
    if (selectedLocality === 'all') {
      return mockLocalities;
    }
    return mockLocalities.filter(loc => loc.name === selectedLocality);
  }, [selectedLocality]);
  const executiveSummary: ExecutiveSummaryData = useMemo(() => {
    const localities = selectedLocality === 'all' ? mockLocalities : filteredLocalities;
    return localities.reduce((acc, locality) => {
      return {
        totalCreditsGiven: acc.totalCreditsGiven + 0,
        totalLoansGiven: acc.totalLoansGiven + locality.totalPlaced.creditsAndLoans,
        totalOperatingExpenses: acc.totalOperatingExpenses + 0,
        totalCommissions: acc.totalCommissions + locality.totalPlaced.commissions,
        totalCashPayments: acc.totalCashPayments + locality.totalPlaced.collectionCash,
        totalBankPayments: acc.totalBankPayments + locality.totalPlaced.collectionBank,
        totalMoneyInvestment: acc.totalMoneyInvestment + 0,
        totalCashBalance: acc.totalCashBalance + locality.balances.cash,
        totalBankBalance: acc.totalBankBalance + locality.balances.bank
      };
    }, {
      totalCreditsGiven: 0,
      totalLoansGiven: 0,
      totalOperatingExpenses: 0,
      totalCommissions: 0,
      totalCashPayments: 0,
      totalBankPayments: 0,
      totalMoneyInvestment: 0,
      totalCashBalance: 0,
      totalBankBalance: 0
    });
  }, [filteredLocalities, selectedLocality]);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  const localityNames = mockLocalities.map(loc => loc.name);
  return <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Dashboard Financiero
              </h1>
              <p className="text-slate-600">
                Gestión de pagos semanales por localidad
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                <Calendar className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">
                  Esta semana
                </span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                <Download className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">
                  Exportar
                </span>
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Préstamos Otorgados" value={formatCurrency(executiveSummary.totalLoansGiven)} icon={DollarSign} gradient="bg-gradient-to-br from-blue-500 to-blue-600" />
            <StatCard title="Comisiones" value={formatCurrency(executiveSummary.totalCommissions)} icon={TrendingUp} gradient="bg-gradient-to-br from-purple-500 to-purple-600" />
            <StatCard title="Balance Efectivo" value={formatCurrency(executiveSummary.totalCashBalance)} icon={Wallet} gradient="bg-gradient-to-br from-green-500 to-green-600" trend={{
            value: executiveSummary.totalCashBalance >= 0 ? 'Positivo' : 'Negativo',
            isPositive: executiveSummary.totalCashBalance >= 0
          }} />
            <StatCard title="Balance Banco" value={formatCurrency(executiveSummary.totalBankBalance)} icon={CreditCard} gradient="bg-gradient-to-br from-teal-500 to-teal-600" trend={{
            value: executiveSummary.totalBankBalance >= 0 ? 'Positivo' : 'Negativo',
            isPositive: executiveSummary.totalBankBalance >= 0
          }} />
          </div>

          {/* Filter */}
          <div className="mb-6">
            <LocalityFilter localities={localityNames} selectedLocality={selectedLocality} onSelectLocality={setSelectedLocality} />
          </div>

          {/* Localities Grid */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Localidades
            </h2>
            <div className="space-y-4">
              {filteredLocalities.map(locality => <LocalityCard key={locality.id} locality={locality} />)}
            </div>
          </div>

          {/* Executive Summary */}
          <ExecutiveSummary data={executiveSummary} />
        </div>
      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-8 right-8 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-semibold transition-all hover:scale-105 hover:shadow-green-500/50">
        <ArrowUpCircle className="w-6 h-6" />
        <span>Entradas al Banco</span>
      </button>
    </div>;
}