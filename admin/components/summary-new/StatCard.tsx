/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { colors, shadows, radius, formatCurrency } from './theme';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function StatCard({ title, value, icon, gradient, trend }: StatCardProps) {
  return (
    <div
      css={{
        backgroundColor: colors.card,
        borderRadius: radius['2xl'],
        padding: '1.5rem',
        boxShadow: shadows.lg,
        border: `1px solid ${colors.slate[100]}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: shadows.xl,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <div css={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div
          css={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: radius.xl,
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'scale(1.1)',
            },
          }}
        >
          {icon}
        </div>
        {trend && (
          <div
            css={{
              padding: '0.25rem 0.75rem',
              borderRadius: radius.full,
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: trend.isPositive ? colors.green[100] : colors.red[100],
              color: trend.isPositive ? colors.green[700] : colors.red[700],
            }}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </div>
        )}
      </div>
      <h3 css={{ fontSize: '0.875rem', fontWeight: 500, color: colors.slate[600], marginBottom: '0.25rem', margin: 0 }}>
        {title}
      </h3>
      <p css={{ fontSize: '1.875rem', fontWeight: 700, color: colors.slate[900], margin: 0 }}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

