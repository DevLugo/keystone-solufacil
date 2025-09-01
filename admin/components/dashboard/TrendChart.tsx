/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { FaArrowUp, FaArrowDown, FaMinus } from 'react-icons/fa';

interface TrendChartProps {
  data: number[];
  labels?: string[];
  color: string;
  title: string;
  height?: number;
  showTrend?: boolean;
}

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  trendIndicator: (trend: 'up' | 'down' | 'neutral') => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: '600',
    color: trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : '#6b7280',
  }),
  chartContainer: {
    position: 'relative' as const,
    width: '100%',
    height: '120px',
    marginBottom: '12px',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  gridLine: {
    stroke: '#f3f4f6',
    strokeWidth: 1,
  },
  dataLine: {
    fill: 'none',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  },
  dataPoint: {
    r: 3,
    fill: 'white',
    strokeWidth: 2,
  },
  areaPath: {
    strokeWidth: 0,
    opacity: 0.1,
  },
  labelsContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: '#9ca3af',
    marginTop: '8px',
  },
  valueDisplay: {
    textAlign: 'center' as const,
    marginTop: '8px',
  },
  currentValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a202c',
  },
  valueChange: (trend: 'up' | 'down' | 'neutral') => ({
    fontSize: '12px',
    color: trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : '#6b7280',
    marginTop: '4px',
  }),
};

export const TrendChart = ({ 
  data, 
  labels, 
  color, 
  title, 
  height = 120, 
  showTrend = true 
}: TrendChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div css={styles.container}>
        <div css={styles.header}>
          <span css={styles.title}>{title}</span>
        </div>
        <div css={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px', padding: '40px 0' }}>
          Sin datos disponibles
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  // Calculate trend
  const firstValue = data[0];
  const lastValue = data[data.length - 1];
  const trend = lastValue > firstValue ? 'up' : lastValue < firstValue ? 'down' : 'neutral';
  const trendPercentage = firstValue !== 0 ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100 : 0;

  // Generate SVG path
  const width = 100; // percentage
  const chartHeight = height;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = chartHeight - ((value - minValue) / range) * (chartHeight - 20);
    return { x, y, value };
  });

  const pathData = points.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ');

  // Area path for gradient fill
  const areaPath = `${pathData} L ${points[points.length - 1].x} ${chartHeight} L 0 ${chartHeight} Z`;

  const trendIcon = trend === 'up' ? <FaArrowUp /> : trend === 'down' ? <FaArrowDown /> : <FaMinus />;

  return (
    <div css={styles.container}>
      <div css={styles.header}>
        <span css={styles.title}>{title}</span>
        {showTrend && (
          <div css={styles.trendIndicator(trend)}>
            {trendIcon}
            {Math.abs(trendPercentage).toFixed(1)}%
          </div>
        )}
      </div>

      <div css={styles.chartContainer}>
        <svg css={styles.svg} viewBox={`0 0 ${width} ${chartHeight}`}>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio, index) => (
            <line
              key={index}
              css={styles.gridLine}
              x1="0"
              y1={chartHeight * ratio}
              x2={width}
              y2={chartHeight * ratio}
            />
          ))}

          {/* Area fill */}
          <path
            css={styles.areaPath}
            d={areaPath}
            fill={color}
          />

          {/* Data line */}
          <path
            css={styles.dataLine}
            d={pathData}
            stroke={color}
          />

          {/* Data points */}
          {points.map((point, index) => (
            <circle
              key={index}
              css={styles.dataPoint}
              cx={point.x}
              cy={point.y}
              stroke={color}
            >
              <title>{`${labels?.[index] || index + 1}: ${point.value}`}</title>
            </circle>
          ))}
        </svg>
      </div>

      {labels && (
        <div css={styles.labelsContainer}>
          {labels.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>
      )}

      <div css={styles.valueDisplay}>
        <div css={styles.currentValue}>
          {lastValue.toLocaleString()}
        </div>
        <div css={styles.valueChange(trend)}>
          {trend === 'up' ? '+' : trend === 'down' ? '-' : '±'}{Math.abs(lastValue - firstValue).toLocaleString()}
        </div>
      </div>
    </div>
  );
};