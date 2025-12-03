import React from 'react';
import { BoxIcon } from 'lucide-react';
interface StatCardProps {
  title: string;
  value: string;
  icon: BoxIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  gradient: string;
}
export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  gradient
}: StatCardProps) {
  return <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-100 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-14 h-14 rounded-xl ${gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        {trend && <div className={`px-3 py-1 rounded-full text-xs font-semibold ${trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </div>}
      </div>
      <h3 className="text-sm font-medium text-slate-600 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>;
}