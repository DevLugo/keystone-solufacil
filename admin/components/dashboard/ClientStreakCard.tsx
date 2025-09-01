/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { FaUser, FaMapMarkerAlt, FaClock, FaDollarSign } from 'react-icons/fa';
import { formatCurrency } from '../../utils/formatters';

interface ClientStreakCardProps {
  clientName: string;
  clientCode: string;
  weeksWithoutPayment: number;
  locality: string;
  loanAmount: number;
  loanId: string;
}

const styles = {
  card: (urgency: 'high' | 'medium' | 'low') => ({
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '16px',
    border: `2px solid ${
      urgency === 'high' ? '#dc2626' : 
      urgency === 'medium' ? '#f59e0b' : '#6b7280'
    }`,
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    },
    '@media (max-width: 767px)': {
      padding: '12px',
    },
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  clientInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0, // Allow text truncation
  },
  clientName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a202c',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    '@media (min-width: 768px)': {
      fontSize: '16px',
    },
  },
  clientCode: {
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  urgencyBadge: (urgency: 'high' | 'medium' | 'low') => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: 
      urgency === 'high' ? '#dc2626' : 
      urgency === 'medium' ? '#f59e0b' : '#6b7280',
    color: 'white',
    whiteSpace: 'nowrap' as const,
  }),
  detailsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    '@media (min-width: 640px)': {
      gridTemplateColumns: '1fr 1fr 1fr',
    },
  },
  detailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#6b7280',
  },
  detailValue: {
    fontWeight: '600',
    color: '#1a202c',
  },
  loanIdContainer: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#6b7280',
    fontFamily: 'monospace',
    textAlign: 'center' as const,
  },
};

const getUrgency = (weeks: number): 'high' | 'medium' | 'low' => {
  if (weeks >= 8) return 'high';
  if (weeks >= 5) return 'medium';
  return 'low';
};

const getUrgencyText = (weeks: number): string => {
  if (weeks >= 8) return 'CRÍTICO';
  if (weeks >= 5) return 'URGENTE';
  return 'ATENCIÓN';
};

export const ClientStreakCard = ({ 
  clientName, 
  clientCode, 
  weeksWithoutPayment, 
  locality, 
  loanAmount, 
  loanId 
}: ClientStreakCardProps) => {
  const urgency = getUrgency(weeksWithoutPayment);
  const urgencyText = getUrgencyText(weeksWithoutPayment);

  return (
    <div css={styles.card(urgency)}>
      <div css={styles.header}>
        <div css={styles.clientInfo}>
          <FaUser style={{ color: '#6b7280', fontSize: '14px', flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div css={styles.clientName} title={clientName}>
              {clientName}
            </div>
            <div css={styles.clientCode}>{clientCode}</div>
          </div>
        </div>
        <div css={styles.urgencyBadge(urgency)}>
          <FaClock />
          {weeksWithoutPayment} sem
        </div>
      </div>

      <div css={styles.detailsRow}>
        <div css={styles.detailItem}>
          <FaMapMarkerAlt style={{ color: '#6b7280' }} />
          <span css={styles.detailValue}>{locality}</span>
        </div>
        <div css={styles.detailItem}>
          <FaDollarSign style={{ color: '#6b7280' }} />
          <span css={styles.detailValue}>{formatCurrency(loanAmount)}</span>
        </div>
        <div css={styles.detailItem}>
          <span css={{ 
            ...styles.detailValue, 
            color: urgency === 'high' ? '#dc2626' : urgency === 'medium' ? '#f59e0b' : '#6b7280' 
          }}>
            {urgencyText}
          </span>
        </div>
      </div>

      <div css={styles.loanIdContainer}>
        ID: {loanId}
      </div>
    </div>
  );
};