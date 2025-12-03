import React from 'react';
import { User, Key, Phone, BarChart2, Calendar, Trophy, Map, MapPin, Building2, Globe2 } from 'lucide-react';
interface ClientData {
  name: string;
  id: string;
  phone: string;
  roles: string[];
  since: string;
  leader: {
    name: string;
    route: string;
    location: string;
    municipality: string;
    state: string;
    phone: string;
  };
  loanCount: number;
}
interface ClientProfileProps {
  client: ClientData;
}
export function ClientProfile({
  client
}: ClientProfileProps) {
  return <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client Info */}
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <User size={18} className="text-blue-500" />
              Cliente
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <User size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Nombre:</span>
              <span className="font-medium">{client.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Key size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Clave:</span>
              <span className="font-medium">{client.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Teléfono:</span>
              <span className="font-medium">{client.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Relación:</span>
              <div className="flex gap-1">
                {client.roles.includes('Cliente') && <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    <svg className="mr-1 h-2 w-2 fill-current" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                    Cliente
                  </span>}
                {client.roles.includes('Aval') && <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                    <svg className="mr-1 h-2 w-2 fill-current" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                    Aval
                  </span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Desde:</span>
              <span className="font-medium">{client.since}</span>
            </div>
          </div>
        </div>
        {/* Leader Info */}
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <Trophy size={18} className="text-amber-500" />
              Líder Asignado
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <User size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Nombre:</span>
              <span className="font-medium">{client.leader.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Map size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Ruta:</span>
              <span className="font-medium">{client.leader.route}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Localidad:</span>
              <span className="font-medium">{client.leader.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Municipio:</span>
              <span className="font-medium">{client.leader.municipality}</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe2 size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Estado:</span>
              <span className="font-medium">{client.leader.state}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">Teléfono:</span>
              <span className="font-medium">{client.leader.phone}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex flex-col items-center justify-center">
          <div className="text-blue-700 font-medium text-sm mb-1">
            Como Cliente
          </div>
          <div className="text-3xl font-bold text-blue-700">
            {client.loanCount}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 8H15.01M9 8H12M9 12H12M9 16H12M17 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V5C19 3.89543 18.1046 3 17 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium">Documentos</span>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">0</span>{' '}
              documentos
            </div>
            <div className="text-sm text-muted-foreground">
              Aval: <span className="font-medium text-foreground">0</span>{' '}
              documentos
            </div>
          </div>
          <button className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            Ver Documentos
          </button>
        </div>
      </div>
    </div>;
}