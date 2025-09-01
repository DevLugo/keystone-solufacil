/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { FaMapMarkerAlt, FaExclamationTriangle, FaTrendingUp, FaTrendingDown } from 'react-icons/fa';

interface LocalityCardProps {
  name: string;
  growth: number;
  activeLoans: number;
  cvLoans: number;
  type: 'declining' | 'dangerous';
}

const styles = {
  card: (type: 'declining' | 'dangerous') => ({
    backgroundColor: type === 'declining' ? '#fef2f2' : '#fffbeb',
    borderRadius: '12px',
    padding: '16px',
    border: `1px solid ${type === 'declining' ? '#fecaca' : '#fed7aa'}`,
    transition: 'transform 0.2s ease-in-out',
    '&:hover': {
      transform: 'translateY(-1px)',
    },
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  nameContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  name: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a202c',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  growthBadge: (type: 'declining' | 'dangerous') => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: type === 'declining' ? '#dc2626' : '#f59e0b',
    color: 'white',
  }),
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#6b7280',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a202c',
  },
  statLabel: {
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  cvPercentage: (percentage: number) => ({
    fontSize: '12px',
    fontWeight: '600',
    color: percentage > 50 ? '#dc2626' : percentage > 30 ? '#f59e0b' : '#16a34a',
    marginTop: '8px',
    textAlign: 'center' as const,
  }),
};

export const LocalityCard = ({ name, growth, activeLoans, cvLoans, type }: LocalityCardProps) => {
  const cvPercentage = activeLoans > 0 ? (cvLoans / activeLoans) * 100 : 0;
  const icon = type === 'declining' ? <FaTrendingDown /> : <FaTrendingUp />;

  return (
    <div css={styles.card(type)}>
      <div css={styles.header}>
        <div css={styles.nameContainer}>
          <FaMapMarkerAlt style={{ color: '#6b7280', fontSize: '12px' }} />
          <span css={styles.name} title={name}>{name}</span>
        </div>
        <div css={styles.growthBadge(type)}>
          {icon}
          {Math.abs(growth).toFixed(1)}%
        </div>
      </div>
      
      <div css={styles.statsRow}>
        <div css={styles.statItem}>
          <span css={styles.statValue}>{activeLoans}</span>
          <span css={styles.statLabel}>Activos</span>
        </div>
        <div css={styles.statItem}>
          <span css={styles.statValue}>{cvLoans}</span>
          <span css={styles.statLabel}>Vencidos</span>
        </div>
      </div>
      
      <div css={styles.cvPercentage(cvPercentage)}>
        {cvPercentage > 0 && <FaExclamationTriangle style={{ marginRight: '4px' }} />}
        {cvPercentage.toFixed(1)}% CV
      </div>
    </div>
  );
};