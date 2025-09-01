/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { FaArrowUp, FaArrowDown, FaMinus } from 'react-icons/fa';
import { formatCurrency } from '../../utils/formatters';

interface KPICardProps {
  title: string;
  icon: React.ReactNode;
  current: number;
  previous: number;
  delta: number;
  percentage: number;
  color: string;
  format?: 'currency' | 'number' | 'percentage';
  suffix?: string;
}

const styles = {
  card: (color: string) => ({
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 12px rgba(0, 0, 0, 0.1)',
    },
    '@media (max-width: 767px)': {
      padding: '16px',
    },
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  icon: (color: string) => ({
    color,
    fontSize: '18px',
  }),
  currentValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '8px',
    '@media (max-width: 767px)': {
      fontSize: '24px',
    },
  },
  deltaContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    fontWeight: '500',
  },
  deltaValue: (isPositive: boolean, isNeutral: boolean) => ({
    color: isNeutral ? '#6b7280' : isPositive ? '#16a34a' : '#dc2626',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  }),
  previousValue: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
  },
};

const formatValue = (value: number, format: string = 'number', suffix: string = '') => {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    default:
      return `${value}${suffix}`;
  }
};

export const KPICard = ({ 
  title, 
  icon, 
  current, 
  previous, 
  delta, 
  percentage, 
  color, 
  format = 'number',
  suffix = ''
}: KPICardProps) => {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  const deltaIcon = isNeutral ? <FaMinus /> : isPositive ? <FaArrowUp /> : <FaArrowDown />;

  return (
    <div css={styles.card(color)}>
      <div css={styles.header}>
        <div css={styles.titleContainer}>
          <span css={styles.icon(color)}>{icon}</span>
          <span css={styles.title}>{title}</span>
        </div>
      </div>
      
      <div css={styles.currentValue}>
        {formatValue(current, format, suffix)}
      </div>
      
      <div css={styles.deltaContainer}>
        <span css={styles.deltaValue(isPositive, isNeutral)}>
          {deltaIcon}
          {Math.abs(delta)} ({Math.abs(percentage).toFixed(1)}%)
        </span>
      </div>
      
      <div css={styles.previousValue}>
        Anterior: {formatValue(previous, format, suffix)}
      </div>
    </div>
  );
};