import React from 'react';
import { SolufacilLogo } from './SolufacilLogo';

export function CustomHeader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 1rem',
      height: '60px',
      backgroundColor: '#ffffff',
    }}>
      <SolufacilLogo width={120} height={40} />
    </div>
  );
}
