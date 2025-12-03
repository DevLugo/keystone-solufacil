import React from 'react';
import { LayoutDashboard, DollarSign, CreditCard, Receipt, ArrowLeftRight, Settings, LogOut } from 'lucide-react';
interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}
export function Sidebar({
  activeTab,
  onTabChange
}: SidebarProps) {
  const menuItems = [{
    id: 'resumen',
    label: 'Dashboard',
    icon: LayoutDashboard
  }, {
    id: 'abonos',
    label: 'Abonos',
    icon: DollarSign
  }, {
    id: 'creditos',
    label: 'Créditos',
    icon: CreditCard
  }, {
    id: 'gastos',
    label: 'Gastos',
    icon: Receipt
  }, {
    id: 'transferencias',
    label: 'Transferencias',
    icon: ArrowLeftRight
  }];
  return <div className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">FinanciaPro</h1>
            <p className="text-slate-400 text-xs">Sistema de Pagos</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {menuItems.map(item => <button key={item.id} onClick={() => onTabChange(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === item.id ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>)}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-700 space-y-1">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
          <Settings className="w-5 h-5" />
          <span className="font-medium">Configuración</span>
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Salir</span>
        </button>
      </div>
    </div>;
}