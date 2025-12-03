import React from 'react';
import { User, Key, Phone, Calendar } from 'lucide-react';
import { Client, ClientSummary } from './types';
import { formatDate } from './types';

interface ClientProfileProps {
  client: Client;
  summary: ClientSummary;
  onViewDocuments?: () => void;
}

export function ClientProfile({ client, summary, onViewDocuments }: ClientProfileProps) {
  // Determine client roles
  const roles = [];
  if (summary.hasBeenClient) roles.push('Cliente');
  if (summary.hasBeenCollateral) roles.push('Aval');

  // Get first phone number
  const primaryPhone = client.phones && client.phones.length > 0 ? client.phones[0] : 'N/A';

  // Calculate membership duration (placeholder - would need first loan date)
  const membershipDate = 'N/A'; // TODO: Calculate from first loan date

  return (
    <div className="space-y-6">
      {/* Client and Leader Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Client Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-slate-900">
              <User size={18} className="text-blue-600" />
              Cliente
            </h2>
          </div>
          <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
            <div className="flex items-start gap-2">
              <User size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm text-slate-600 block">Nombre:</span>
                <span className="text-sm sm:text-base font-medium text-slate-900 block break-words">
                  {client.fullName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Key size={16} className="text-slate-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-slate-600">Clave:</span>
              <span className="text-sm sm:text-base font-medium text-slate-900">
                {client.clientCode}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Phone size={16} className="text-slate-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-slate-600">Teléfono:</span>
              <span className="text-sm sm:text-base font-medium text-slate-900">
                {primaryPhone}
              </span>
            </div>

            <div className="flex items-start gap-2">
              <User size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-xs sm:text-sm text-slate-600 block mb-1">Relación:</span>
                <div className="flex flex-wrap gap-1">
                  {roles.includes('Cliente') && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                      <svg className="mr-1 h-2 w-2 fill-current" viewBox="0 0 8 8">
                        <circle cx="4" cy="4" r="3" />
                      </svg>
                      Cliente
                    </span>
                  )}
                  {roles.includes('Aval') && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                      <svg className="mr-1 h-2 w-2 fill-current" viewBox="0 0 8 8">
                        <circle cx="4" cy="4" r="3" />
                      </svg>
                      Aval
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-slate-600">Miembro desde:</span>
              <span className="text-sm sm:text-base font-medium text-slate-900">
                {membershipDate}
              </span>
            </div>
          </div>
        </div>

        {/* Leader Info Card - Integrated from LeaderCard */}
        {client.leader && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white">
              <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-slate-900">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-amber-600">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                </svg>
                Líder Asignado
              </h2>
            </div>
            <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
              <div className="flex items-start gap-2">
                <User size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs sm:text-sm text-slate-600 block">Nombre:</span>
                  <span className="text-sm sm:text-base font-medium text-slate-900 block break-words">
                    {client.leader.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-500 flex-shrink-0">
                  <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-xs sm:text-sm text-slate-600">Ruta:</span>
                <span className="text-sm sm:text-base font-medium text-slate-900">
                  {client.leader.route}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-500 mt-0.5 flex-shrink-0">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-xs sm:text-sm text-slate-600 block">Localidad:</span>
                  <span className="text-sm sm:text-base font-medium text-slate-900 block break-words">
                    {client.leader.location}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-500 flex-shrink-0">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="text-xs sm:text-sm text-slate-600">Municipio:</span>
                <span className="text-sm sm:text-base font-medium text-slate-900 truncate">
                  {client.leader.municipality}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-500 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="text-xs sm:text-sm text-slate-600">Estado:</span>
                <span className="text-sm sm:text-base font-medium text-slate-900">
                  {client.leader.state}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Phone size={16} className="text-slate-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-slate-600">Teléfono:</span>
                <span className="text-sm sm:text-base font-medium text-slate-900">
                  {client.leader.phone}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border border-blue-100 flex flex-col items-center justify-center">
          <div className="text-blue-700 font-medium text-xs sm:text-sm mb-1 text-center">
            Préstamos como Cliente
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-700">
            {summary.totalLoansAsClient}
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl p-3 sm:p-4 border border-amber-100 flex flex-col items-center justify-center">
          <div className="text-amber-700 font-medium text-xs sm:text-sm mb-1 text-center">
            Préstamos como Aval
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-700">
            {summary.totalLoansAsCollateral}
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-3 sm:p-4 border border-green-100 flex flex-col items-center justify-center">
          <div className="text-green-700 font-medium text-xs sm:text-sm mb-1 text-center">
            Préstamos Activos
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-green-700">
            {summary.activeLoansAsClient + summary.activeLoansAsCollateral}
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-600">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="text-xs sm:text-sm font-medium text-slate-700">Documentos</span>
          </div>
          <div className="flex-1 flex flex-col space-y-1">
            <div className="text-xs text-slate-600">
              Cliente: <span className="font-semibold text-slate-900">0</span> docs
            </div>
            <div className="text-xs text-slate-600">
              Aval: <span className="font-semibold text-slate-900">0</span> docs
            </div>
          </div>
          {onViewDocuments && (
            <button
              onClick={onViewDocuments}
              className="mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Ver Documentos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
