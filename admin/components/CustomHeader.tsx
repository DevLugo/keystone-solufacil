import React from 'react';
import { SolufacilLogo } from './SolufacilLogo';

export function CustomHeader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 1rem',
      height: '60px',
      backgroundColor: 'var(--theme-card)',
      borderBottom: '1px solid var(--theme-border)',
      transition: 'all 0.3s ease',
    }}>
      <SolufacilLogo width={120} height={40} />
    </div>
  );
}
