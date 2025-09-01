/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';

interface MiniChartProps {
  data: number[];
  color: string;
  height?: number;
  type?: 'bar' | 'line';
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'end',
    gap: '2px',
    height: '40px',
    minWidth: '60px',
  },
  bar: (height: number, color: string, maxHeight: number) => ({
    width: '6px',
    height: `${(height / maxHeight) * 100}%`,
    backgroundColor: color,
    borderRadius: '2px',
    transition: 'height 0.3s ease',
    minHeight: '2px',
  }),
  lineContainer: {
    position: 'relative' as const,
    width: '100%',
    height: '40px',
  },
  linePath: {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  },
  dot: {
    fill: 'currentColor',
    r: 2,
  },
};

export const MiniChart = ({ data, color, height = 40, type = 'bar' }: MiniChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div css={{ ...styles.container, justifyContent: 'center', alignItems: 'center' }}>
        <span css={{ fontSize: '12px', color: '#9ca3af' }}>Sin datos</span>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(Math.abs));
  const minValue = Math.min(...data);

  if (type === 'line') {
    const width = 60;
    const chartHeight = height;
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div css={styles.lineContainer} style={{ color }}>
        <svg width={width} height={chartHeight} viewBox={`0 0 ${width} ${chartHeight}`}>
          <polyline
            css={styles.linePath}
            points={points}
          />
          {data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
            return (
              <circle
                key={index}
                css={styles.dot}
                cx={x}
                cy={y}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  // Bar chart
  return (
    <div css={styles.container}>
      {data.map((value, index) => {
        const barHeight = maxValue > 0 ? Math.abs(value) : 0;
        const barColor = value < 0 ? '#ef4444' : color;
        
        return (
          <div
            key={index}
            css={styles.bar(barHeight, barColor, maxValue)}
            title={`${value}`}
          />
        );
      })}
    </div>
  );
};