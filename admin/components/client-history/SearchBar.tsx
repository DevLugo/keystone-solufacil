import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { ClientSearchResult } from './types';

interface SearchBarProps {
  onSearch: (term: string) => void;
  onClientSelect: (client: ClientSearchResult) => void;
  onClear: () => void;
  searchResults: ClientSearchResult[];
  isSearching: boolean;
  showAutocomplete: boolean;
  selectedClient: ClientSearchResult | null;
  duplicateCount: number;
}

export function SearchBar({
  onSearch,
  onClientSelect,
  onClear,
  searchResults,
  isSearching,
  showAutocomplete,
  selectedClient,
  duplicateCount
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Parent component handles closing autocomplete
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    // Trigger search only if 2+ characters (per FR-001)
    if (value.length >= 2) {
      onSearch(value);
    } else if (value.length === 0) {
      onClear();
    }
  };

  const handleClientClick = (client: ClientSearchResult) => {
    setQuery('');
    onClientSelect(client);
  };

  const handleClearClick = () => {
    setQuery('');
    onClear();
  };

  // Limit to 15 results (per FR-002)
  const displayResults = searchResults.slice(0, 15);
  const hasMoreResults = searchResults.length > 15;

  return (
    <div ref={containerRef} className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-200">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Search className="text-slate-500" size={20} />
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
          Búsqueda de Cliente
        </h2>
      </div>

      <p className="text-slate-600 mb-4 text-xs sm:text-sm">
        Buscar por nombre o clave única (mínimo 2 caracteres)
      </p>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Nombre del cliente o clave única"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          autoComplete="off"
        />
        {query && (
          <button
            onClick={handleClearClick}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {showAutocomplete && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg max-h-96 overflow-auto">
          {isSearching ? (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-slate-600">Buscando clientes...</p>
            </div>
          ) : displayResults.length > 0 ? (
            <>
              {displayResults.map((client) => (
                <div
                  key={client.id}
                  className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors"
                  onClick={() => handleClientClick(client)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900 truncate">
                        {client.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                          {client.clientCode}
                        </span>
                        {client.location && (
                          <span className="truncate">
                            {client.location}, {client.municipality}
                          </span>
                        )}
                      </div>
                      {client.route && (
                        <div className="text-xs text-slate-500 mt-1">
                          Ruta: {client.route}
                        </div>
                      )}
                    </div>
                    {client.totalLoans > 0 && (
                      <div className="flex-shrink-0 text-xs text-slate-500">
                        {client.totalLoans} préstamo{client.totalLoans !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {hasMoreResults && (
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 text-center">
                  <p className="text-xs text-amber-800 font-medium">
                    Se encontraron más resultados, refina tu búsqueda
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-600">No se encontraron clientes</p>
              <p className="text-xs text-slate-500 mt-1">
                Intenta con diferentes términos de búsqueda
              </p>
            </div>
          )}
        </div>
      )}

      {/* Selected Client Display */}
      {selectedClient && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs sm:text-sm text-blue-900">
            <span className="text-blue-600">Cliente seleccionado:</span>{' '}
            <span className="font-semibold">{selectedClient.name}</span>{' '}
            <span className="text-blue-600">({selectedClient.clientCode})</span>
          </p>
        </div>
      )}

      {/* Duplicate Warning */}
      {duplicateCount > 0 && (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs sm:text-sm text-orange-900">
            ⚠️ Se detectaron <strong>{duplicateCount}</strong> posible{duplicateCount !== 1 ? 's' : ''} duplicado{duplicateCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
