/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { FaChartLine, FaExclamationTriangle, FaClock, FaMapMarkerAlt } from 'react-icons/fa';

interface SummaryStatsProps {
  totalActiveLoans: number;
  totalCVLoans: number;
  cvPercentage: number;
  averageWeeksWithoutPayment: number;
  totalLocalities: number;
}

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    '@media (min-width: 768px)': {
      padding: '24px',
    },
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    '@media (min-width: 768px)': {
      fontSize: '18px',
      marginBottom: '20px',
    },
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
    '@media (min-width: 640px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (min-width: 1024px)': {
      gridTemplateColumns: 'repeat(4, 1fr)',
    },
  },
  statCard: (bgColor: string, borderColor: string) => ({
    backgroundColor: bgColor,
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center' as const,
    border: `1px solid ${borderColor}`,
    transition: 'transform 0.2s ease-in-out',
    '&:hover': {
      transform: 'translateY(-2px)',
    },
  }),
  statValue: (textColor: string) => ({
    fontSize: '24px',
    fontWeight: '700',
    color: textColor,
    marginBottom: '4px',
    '@media (max-width: 767px)': {
      fontSize: '20px',
    },
  }),
  statLabel: (textColor: string) => ({
    fontSize: '12px',
    color: textColor,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: '500',
  }),
  warningIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    marginTop: '8px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
  },
};

const getCardStyle = (type: 'active' | 'cv' | 'average' | 'localities') => {
  switch (type) {
    case 'active':
      return {
        bg: '#f0f9ff',
        border: '#bae6fd',
        text: '#0369a1',
        lightText: '#0c4a6e'
      };
    case 'cv':
      return {
        bg: '#fef2f2',
        border: '#fecaca',
        text: '#dc2626',
        lightText: '#7f1d1d'
      };
    case 'average':
      return {
        bg: '#fffbeb',
        border: '#fed7aa',
        text: '#d97706',
        lightText: '#92400e'
      };
    case 'localities':
      return {
        bg: '#f0fdf4',
        border: '#bbf7d0',
        text: '#16a34a',
        lightText: '#14532d'
      };
    default:
      return {
        bg: '#f8fafc',
        border: '#e2e8f0',
        text: '#1a202c',
        lightText: '#6b7280'
      };
  }
};

export const SummaryStats = ({
  totalActiveLoans,
  totalCVLoans,
  cvPercentage,
  averageWeeksWithoutPayment,
  totalLocalities,
}: SummaryStatsProps) => {
  const activeStyle = getCardStyle('active');
  const cvStyle = getCardStyle('cv');
  const averageStyle = getCardStyle('average');
  const localitiesStyle = getCardStyle('localities');

  const isHighCV = cvPercentage > 30;
  const isHighAverage = averageWeeksWithoutPayment > 3;

  return (
    <div css={styles.container}>
      <h2 css={styles.title}>
        <FaChartLine />
        Resumen General
      </h2>
      
      <div css={styles.statsGrid}>
        {/* Active Loans */}
        <div css={styles.statCard(activeStyle.bg, activeStyle.border)}>
          <div css={styles.statValue(activeStyle.text)}>
            {totalActiveLoans.toLocaleString()}
          </div>
          <div css={styles.statLabel(activeStyle.lightText)}>
            Préstamos Activos
          </div>
        </div>

        {/* CV Percentage */}
        <div css={styles.statCard(cvStyle.bg, cvStyle.border)}>
          <div css={styles.statValue(cvStyle.text)}>
            {cvPercentage.toFixed(1)}%
          </div>
          <div css={styles.statLabel(cvStyle.lightText)}>
            Cartera Vencida
          </div>
          {isHighCV && (
            <div css={{ ...styles.warningIndicator, color: cvStyle.text }}>
              <FaExclamationTriangle />
              Alto Riesgo
            </div>
          )}
        </div>

        {/* Average Weeks Without Payment */}
        <div css={styles.statCard(averageStyle.bg, averageStyle.border)}>
          <div css={styles.statValue(averageStyle.text)}>
            {averageWeeksWithoutPayment.toFixed(1)}
          </div>
          <div css={styles.statLabel(averageStyle.lightText)}>
            Promedio Sem. Sin Pago
          </div>
          {isHighAverage && (
            <div css={{ ...styles.warningIndicator, color: averageStyle.text }}>
              <FaClock />
              Atención Requerida
            </div>
          )}
        </div>

        {/* Total Localities */}
        <div css={styles.statCard(localitiesStyle.bg, localitiesStyle.border)}>
          <div css={styles.statValue(localitiesStyle.text)}>
            {totalLocalities}
          </div>
          <div css={styles.statLabel(localitiesStyle.lightText)}>
            Localidades Activas
          </div>
        </div>
      </div>
    </div>
  );
};