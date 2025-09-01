/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';

const styles = {
  container: {
    padding: '16px',
    '@media (min-width: 768px)': {
      padding: '24px',
    },
  },
  skeletonCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '20px',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    '@media (min-width: 768px)': {
      padding: '32px',
      marginBottom: '32px',
    },
  },
  skeletonLine: (width: string, height: string = '16px') => ({
    backgroundColor: '#d1d5db',
    borderRadius: '4px',
    height,
    width,
    marginBottom: '12px',
  }),
  skeletonGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
    marginBottom: '24px',
    '@media (min-width: 640px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (min-width: 1024px)': {
      gridTemplateColumns: 'repeat(4, 1fr)',
    },
  },
  skeletonKpiCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e5e7eb',
  },
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    gap: '16px',
  },
  loadingText: {
    fontSize: '16px',
    color: '#6b7280',
    textAlign: 'center' as const,
  },
};

export const LoadingDashboard = () => {
  return (
    <div css={styles.container}>
      {/* Header skeleton */}
      <div css={styles.skeletonCard}>
        <div css={styles.skeletonLine('60%', '32px')} />
        <div css={styles.skeletonLine('40%', '16px')} />
        <div css={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <div css={styles.skeletonLine('100px', '36px')} />
          <div css={styles.skeletonLine('100px', '36px')} />
          <div css={styles.skeletonLine('200px', '36px')} />
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div css={styles.skeletonGrid}>
        {[1, 2, 3, 4].map((index) => (
          <div key={index} css={styles.skeletonKpiCard}>
            <div css={styles.skeletonLine('80%', '14px')} />
            <div css={styles.skeletonLine('60%', '28px')} />
            <div css={styles.skeletonLine('90%', '12px')} />
          </div>
        ))}
      </div>

      {/* Loading center */}
      <div css={styles.loadingCenter}>
        <LoadingDots label="Cargando dashboard..." size="large" tone="active" />
        <div css={styles.loadingText}>
          Obteniendo datos de tu ruta...
        </div>
      </div>
    </div>
  );
};

export const LoadingKPIs = () => {
  return (
    <div css={styles.skeletonGrid}>
      {[1, 2, 3, 4].map((index) => (
        <div key={index} css={styles.skeletonKpiCard}>
          <div css={styles.skeletonLine('70%', '14px')} />
          <div css={styles.skeletonLine('50%', '32px')} />
          <div css={styles.skeletonLine('80%', '12px')} />
        </div>
      ))}
    </div>
  );
};