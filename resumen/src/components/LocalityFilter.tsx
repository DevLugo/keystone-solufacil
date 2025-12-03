import React from 'react';
import { Search, MapPin } from 'lucide-react';
interface LocalityFilterProps {
  localities: string[];
  selectedLocality: string;
  onSelectLocality: (locality: string) => void;
}
export function LocalityFilter({
  localities,
  selectedLocality,
  onSelectLocality
}: LocalityFilterProps) {
  return <div className="flex items-center gap-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input type="text" placeholder="Buscar localidad..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700" />
      </div>

      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <select value={selectedLocality} onChange={e => onSelectLocality(e.target.value)} className="pl-12 pr-8 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 font-medium cursor-pointer appearance-none">
          <option value="all">Todas las localidades</option>
          {localities.map(locality => <option key={locality} value={locality}>
              {locality}
            </option>)}
        </select>
      </div>
    </div>;
}