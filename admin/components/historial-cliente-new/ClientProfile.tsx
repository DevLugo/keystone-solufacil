/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { User, Key, Phone, BarChart2, Calendar, Trophy, Map, MapPin, Building2, Globe2 } from 'lucide-react';
import { colors, radius, shadows, commonStyles } from './theme';

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
  return (
    <div css={{ marginBottom: '2rem' }}>
      <div css={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr', 
        gap: '1.5rem',
        '@media (min-width: 768px)': {
          gridTemplateColumns: '1fr 1fr',
        }
      }}>
        {/* Client Info */}
        <div css={commonStyles.card}>
          <div css={{ padding: '1.25rem', borderBottom: `1px solid ${colors.border}` }}>
            <h2 css={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: colors.foreground, margin: 0 }}>
              <User size={18} color={colors.blue[500]} />
              Cliente
            </h2>
          </div>
          <div css={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <InfoRow icon={<User size={16} color={colors.mutedForeground} />} label="Nombre:" value={client.name} />
            <InfoRow icon={<Key size={16} color={colors.mutedForeground} />} label="Clave:" value={client.id} />
            <InfoRow icon={<Phone size={16} color={colors.mutedForeground} />} label="Teléfono:" value={client.phone} />
            
            <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={16} color={colors.mutedForeground} />
              <span css={{ color: colors.mutedForeground }}>Relación:</span>
              <div css={{ display: 'flex', gap: '0.25rem' }}>
                {client.roles.includes('Cliente') && (
                  <span css={{ 
                    display: 'inline-flex', alignItems: 'center', borderRadius: '9999px', 
                    backgroundColor: colors.green[100], padding: '0.125rem 0.5rem', 
                    fontSize: '0.75rem', fontWeight: 500, color: colors.green[700] 
                  }}>
                    <span css={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: 'currentColor', marginRight: '0.25rem' }} />
                    Cliente
                  </span>
                )}
                {client.roles.includes('Aval') && (
                  <span css={{ 
                    display: 'inline-flex', alignItems: 'center', borderRadius: '9999px', 
                    backgroundColor: colors.amber[100], padding: '0.125rem 0.5rem', 
                    fontSize: '0.75rem', fontWeight: 500, color: colors.amber[700] 
                  }}>
                     <span css={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: 'currentColor', marginRight: '0.25rem' }} />
                    Aval
                  </span>
                )}
              </div>
            </div>
            
            <InfoRow icon={<Calendar size={16} color={colors.mutedForeground} />} label="Desde:" value={client.since} />
          </div>
        </div>

        {/* Leader Info */}
        <div css={commonStyles.card}>
          <div css={{ padding: '1.25rem', borderBottom: `1px solid ${colors.border}` }}>
            <h2 css={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: colors.foreground, margin: 0 }}>
              <Trophy size={18} color={colors.amber[500]} />
              Líder Asignado
            </h2>
          </div>
          <div css={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <InfoRow icon={<User size={16} color={colors.mutedForeground} />} label="Nombre:" value={client.leader.name} />
            <InfoRow icon={<Map size={16} color={colors.mutedForeground} />} label="Ruta:" value={client.leader.route} />
            <InfoRow icon={<MapPin size={16} color={colors.mutedForeground} />} label="Localidad:" value={client.leader.location} />
            <InfoRow icon={<Building2 size={16} color={colors.mutedForeground} />} label="Municipio:" value={client.leader.municipality} />
            <InfoRow icon={<Globe2 size={16} color={colors.mutedForeground} />} label="Estado:" value={client.leader.state} />
            <InfoRow icon={<Phone size={16} color={colors.mutedForeground} />} label="Teléfono:" value={client.leader.phone} />
          </div>
        </div>
      </div>

      <div css={{ 
        marginTop: '1.5rem', 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '1rem',
        '@media (min-width: 768px)': {
          gridTemplateColumns: 'repeat(4, 1fr)',
        }
      }}>
        <div css={{ 
          backgroundColor: colors.blue[50], 
          borderRadius: radius.xl, 
          padding: '1rem', 
          border: `1px solid ${colors.blue[100]}`, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <div css={{ color: colors.blue[700], fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            Como Cliente
          </div>
          <div css={{ fontSize: '1.875rem', fontWeight: 700, color: colors.blue[700] }}>
            {client.loanCount}
          </div>
        </div>
        
        {/* Document card placeholder if needed */}
        {/* Note: In the original file there was a document card here, I'll include a placeholder structure */}
         <div css={{ ...commonStyles.card, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
          <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" css={{ color: colors.foreground }}>
              <path d="M15 8H15.01M9 8H12M9 12H12M9 16H12M17 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V5C19 3.89543 18.1046 3 17 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span css={{ fontSize: '0.875rem', fontWeight: 500 }}>Documentos</span>
          </div>
          <div css={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div css={{ fontSize: '0.875rem', color: colors.mutedForeground }}>
              Cliente: <span css={{ fontWeight: 500, color: colors.foreground }}>0</span>{' '}
              documentos
            </div>
            <div css={{ fontSize: '0.875rem', color: colors.mutedForeground }}>
              Aval: <span css={{ fontWeight: 500, color: colors.foreground }}>0</span>{' '}
              documentos
            </div>
          </div>
          <button css={{ 
            marginTop: '0.5rem', 
            fontSize: '0.875rem', 
            color: colors.blue[600], 
            fontWeight: 500, 
            background: 'none', 
            border: 'none', 
            padding: 0, 
            cursor: 'pointer',
            textAlign: 'left',
            '&:hover': { color: colors.blue[800] }
          }}>
            Ver Documentos
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {icon}
      <span css={{ color: colors.mutedForeground }}>{label}</span>
      <span css={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

