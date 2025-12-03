import React, { useState } from 'react';
import { Search, BarChart4, Trash2, GitMerge, Users } from 'lucide-react';
interface SearchBarProps {
  onSearch: (query: string) => void;
  initialValue?: string;
}
export function SearchBar({
  onSearch,
  initialValue = ''
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };
  return <div className="bg-card rounded-xl p-6 shadow-sm border">
      <div className="flex items-center gap-2 mb-2">
        <Search className="text-muted-foreground" size={20} />
        <h2 className="text-xl font-medium">Búsqueda de Cliente</h2>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        Buscar Cliente (Nombre, Clave Única) - La información de ruta y
        localidad aparecerá en los resultados
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre del cliente o clave única" className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button type="submit" className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors px-3 py-2 text-white text-sm font-medium">
            <BarChart4 size={16} />
            <span className="hidden sm:inline">Generar</span>
          </button>
          <button type="button" className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-500 hover:bg-slate-600 transition-colors px-3 py-2 text-white text-sm font-medium">
            <Trash2 size={16} />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
          <button type="button" className="flex items-center justify-center gap-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 transition-colors px-3 py-2 text-white text-sm font-medium">
            <GitMerge size={16} />
            <span className="hidden sm:inline">Fusionar</span>
          </button>
          <button type="button" className="flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 transition-colors px-3 py-2 text-white text-sm font-medium">
            <Users size={16} />
            <span className="hidden sm:inline">Duplicados (3)</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors px-3 py-2 text-emerald-700 text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 21H17C19.2091 21 21 19.2091 21 17V7C21 4.79086 19.2091 3 17 3H7C4.79086 3 3 4.79086 3 7V17C3 19.2091 4.79086 21 7 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.5 8H10.5C9.67157 8 9 8.67157 9 9.5V14.5C9 15.3284 9.67157 16 10.5 16H13.5C14.3284 16 15 15.3284 15 14.5V9.5C15 8.67157 14.3284 8 13.5 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 11H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 13H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            PDF Detallado
          </button>
          <button type="button" className="flex items-center justify-center gap-2 rounded-lg border border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 transition-colors px-3 py-2 text-blue-700 text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            PDF Resumen
          </button>
        </div>
      </form>
      {query && <div className="mt-4 text-sm">
          <p className="text-muted-foreground">
            Cliente seleccionado:{' '}
            <span className="font-medium text-foreground">
              MARIA GUADALUPE BONFIL HERNANDEZ
            </span>{' '}
            <span className="text-muted-foreground">(552WJ9)</span>
          </p>
        </div>}
    </div>;
}