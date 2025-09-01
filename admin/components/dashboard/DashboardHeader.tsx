/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { FaCalendarWeek, FaCalendarAlt, FaSync, FaUser } from 'react-icons/fa';
import { RouteSelector } from './RouteSelector';

interface Route {
  id: string;
  name: string;
}

interface DashboardHeaderProps {
  timeframe: 'weekly' | 'monthly';
  onTimeframeChange: (timeframe: 'weekly' | 'monthly') => void;
  routes: Route[];
  selectedRouteId: string;
  onRouteChange: (routeId: string) => void;
  isAdmin: boolean;
  periodLabel?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  userInfo?: {
    name: string;
    role: string;
  };
}

const styles = {
  header: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    '@media (min-width: 768px)': {
      padding: '32px',
      marginBottom: '32px',
    },
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a202c',
    '@media (min-width: 768px)': {
      fontSize: '28px',
    },
  },
  adminBadge: {
    padding: '4px 8px',
    borderRadius: '6px',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#6b7280',
    '@media (max-width: 767px)': {
      order: 1,
      width: '100%',
    },
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '20px',
    '@media (min-width: 768px)': {
      fontSize: '16px',
      marginBottom: '24px',
    },
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap' as const,
    '@media (max-width: 767px)': {
      gap: '12px',
    },
  },
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    padding: '4px',
    border: '1px solid #e2e8f0',
  },
  toggleButton: (isActive: boolean) => ({
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: isActive ? '#4f46e5' : 'transparent',
    color: isActive ? 'white' : '#374151',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    '&:hover': {
      backgroundColor: isActive ? '#4338ca' : '#f1f5f9',
    },
  }),
  refreshButton: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#f8fafc',
      borderColor: '#d1d5db',
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
  },
  routeSelectorContainer: {
    marginLeft: 'auto',
    '@media (max-width: 767px)': {
      marginLeft: '0',
      order: 2,
      width: '100%',
    },
  },
};

export const DashboardHeader = ({
  timeframe,
  onTimeframeChange,
  routes,
  selectedRouteId,
  onRouteChange,
  isAdmin,
  periodLabel,
  onRefresh,
  isLoading,
  userInfo,
}: DashboardHeaderProps) => {
  return (
    <div css={styles.header}>
      <div css={styles.titleRow}>
        <div css={styles.titleContainer}>
          <h1 css={styles.title}>Dashboard del Cobrador</h1>
          {isAdmin && <span css={styles.adminBadge}>Admin</span>}
        </div>
        
        {userInfo && (
          <div css={styles.userInfo}>
            <FaUser />
            <span>{userInfo.name}</span>
          </div>
        )}
      </div>
      
      <p css={styles.subtitle}>
        {periodLabel || 'Resumen de tu ruta asignada'}
      </p>
      
      <div css={styles.controlsRow}>
        {/* Timeframe toggle */}
        <div css={styles.toggleContainer}>
          <button
            css={styles.toggleButton(timeframe === 'weekly')}
            onClick={() => onTimeframeChange('weekly')}
          >
            <FaCalendarWeek />
            Semanal
          </button>
          <button
            css={styles.toggleButton(timeframe === 'monthly')}
            onClick={() => onTimeframeChange('monthly')}
          >
            <FaCalendarAlt />
            Mensual
          </button>
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button
            css={styles.refreshButton}
            onClick={onRefresh}
            disabled={isLoading}
          >
            <FaSync style={{ 
              animation: isLoading ? 'spin 1s linear infinite' : 'none',
            }} />
            Actualizar
          </button>
        )}

        {/* Route selector */}
        <div css={styles.routeSelectorContainer}>
          <RouteSelector
            routes={routes}
            selectedRouteId={selectedRouteId}
            onRouteChange={onRouteChange}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </div>
  );
};