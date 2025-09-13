import React from 'react';

interface SolufacilLogoProps {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function SolufacilLogo({ 
  width = 120, 
  height = 40, 
  className = '', 
  style = {} 
}: SolufacilLogoProps) {
  return (
    <img
      src="/solufacil.png"
      alt="Solufacil"
      width={width}
      height={height}
      className={className}
      style={{
        objectFit: 'contain',
        ...style
      }}
    />
  );
}
