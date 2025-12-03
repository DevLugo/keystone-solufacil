/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { User, Key, Phone, BarChart2, Calendar, Trophy, Map, MapPin, Building2, Globe2 } from 'lucide-react';
import { colors, radius, shadows, commonStyles } from './theme';
import { useTheme, useThemeColors } from '../../contexts/ThemeContext';

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
  // Try to get theme, fallback to light mode values if not in ThemeProvider
  let themeColors;
  let isDark = false;
  try {
    const theme = useTheme();
    themeColors = useThemeColors();
    isDark = theme.isDark;
  } catch {
    themeColors = {
      card: colors.card,
      foreground: colors.foreground,
      foregroundMuted: colors.mutedForeground,
      background: colors.background,
      border: colors.border,
    };
  }

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
        <div css={{ 
          ...commonStyles.card, 
          backgroundColor: themeColors.card,
          transition: 'all 0.3s ease',
        }}>
          <div css={{ padding: '1.25rem', borderBottom: `1px solid ${themeColors.border}` }}>
            <h2 css={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: themeColors.foreground, margin: 0, transition: 'color 0.3s ease' }}>
              <User size={18} color={colors.blue[500]} />
              Cliente
            </h2>
          </div>
          <div css={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <InfoRow icon={<User size={16} color={themeColors.foregroundMuted} />} label="Nombre:" value={client.name} isDark={isDark} themeColors={themeColors} />
            <InfoRow icon={<Key size={16} color={themeColors.foregroundMuted} />} label="Clave:" value={client.id} isDark={isDark} themeColors={themeColors} />
            <InfoRow icon={<Phone size={16} color={themeColors.foregroundMuted} />} label="Teléfono:" value={client.phone} isDark={isDark} themeColors={themeColors} />
            
            <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={16} color={themeColors.foregroundMuted} />
              <span css={{ color: themeColors.foregroundMuted }}>Relación:</span>
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
            
            <InfoRow icon={<Calendar size={16} color={themeColors.foregroundMuted} />} label="Desde:" value={client.since} isDark={isDark} themeColors={themeColors} />
          </div>
        </div>

        {/* Leader Info */}
        <div css={{ 
          ...commonStyles.card, 
          backgroundColor: themeColors.card,
          transition: 'all 0.3s ease',
        }}>
          <div css={{ padding: '1.25rem', borderBottom: `1px solid ${themeColors.border}` }}>
            <h2 css={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: themeColors.foreground, margin: 0, transition: 'color 0.3s ease' }}>
              <Trophy size={18} color={colors.amber[500]} />
              Líder Asignado
            </h2>
          </div>
          <div css={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <InfoRow icon={<User size={16} color={themeColors.foregroundMuted} />} label="Nombre:" value={client.leader.name} isDark={isDark} themeColors={themeColors} />
            <InfoRow icon={<Map size={16} color={themeColors.foregroundMuted} />} label="Ruta:" value={client.leader.route} isDark={isDark} themeColors={themeColors} />
            <InfoRow icon={<MapPin size={16} color={themeColors.foregroundMuted} />} label="Localidad:" value={client.leader.location} isDark={isDark} themeColors={themeColors} />
            <InfoRow icon={<Building2 size={16} color={themeColors.foregroundMuted} />} label="Municipio:" value={client.leader.municipality} isDark={isDark} themeColors={themeColors} />
            <InfoRow icon={<Globe2 size={16} color={themeColors.foregroundMuted} />} label="Estado:" value={client.leader.state} isDark={isDark} themeColors={themeColors} />
            <InfoRow icon={<Phone size={16} color={themeColors.foregroundMuted} />} label="Teléfono:" value={client.leader.phone} isDark={isDark} themeColors={themeColors} />
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
          backgroundColor: isDark ? colors.blue[900] : colors.blue[50], 
          borderRadius: radius.xl, 
          padding: '1rem', 
          border: `1px solid ${isDark ? colors.blue[700] : colors.blue[100]}`, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          transition: 'all 0.3s ease',
        }}>
          <div css={{ color: isDark ? colors.blue[300] : colors.blue[700], fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            Como Cliente
          </div>
          <div css={{ fontSize: '1.875rem', fontWeight: 700, color: isDark ? colors.blue[300] : colors.blue[700] }}>
            {client.loanCount}
          </div>
        </div>
        
        {/* Document card placeholder if needed */}
         <div css={{ 
           ...commonStyles.card, 
           backgroundColor: themeColors.card,
           padding: '1rem', 
           display: 'flex', 
           flexDirection: 'column',
           transition: 'all 0.3s ease',
         }}>
          <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" css={{ color: themeColors.foreground }}>
              <path d="M15 8H15.01M9 8H12M9 12H12M9 16H12M17 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V5C19 3.89543 18.1046 3 17 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span css={{ fontSize: '0.875rem', fontWeight: 500, color: themeColors.foreground }}>Documentos</span>
          </div>
          <div css={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div css={{ fontSize: '0.875rem', color: themeColors.foregroundMuted }}>
              Cliente: <span css={{ fontWeight: 500, color: themeColors.foreground }}>0</span>{' '}
              documentos
            </div>
            <div css={{ fontSize: '0.875rem', color: themeColors.foregroundMuted }}>
              Aval: <span css={{ fontWeight: 500, color: themeColors.foreground }}>0</span>{' '}
              documentos
            </div>
          </div>
          <button css={{ 
            marginTop: '0.5rem', 
            fontSize: '0.875rem', 
            color: colors.blue[500], 
            fontWeight: 500, 
            background: 'none', 
            border: 'none', 
            padding: 0, 
            cursor: 'pointer',
            textAlign: 'left',
            '&:hover': { color: colors.blue[400] }
          }}>
            Ver Documentos
          </button>
        </div>
      </div>
    </div>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  isDark?: boolean;
  themeColors?: {
    foreground: string;
    foregroundMuted: string;
  };
}

function InfoRow({ icon, label, value, themeColors }: InfoRowProps) {
  const foregroundColor = themeColors?.foreground || colors.foreground;
  const mutedColor = themeColors?.foregroundMuted || colors.mutedForeground;
  
  return (
    <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {icon}
      <span css={{ color: mutedColor, transition: 'color 0.3s ease' }}>{label}</span>
      <span css={{ fontWeight: 500, color: foregroundColor, transition: 'color 0.3s ease' }}>{value}</span>
    </div>
  );
}

