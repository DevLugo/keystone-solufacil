/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React from 'react';
import { colors, shadows, radius, formatCurrency } from './theme';
import { useTheme, useThemeColors } from '../../contexts/ThemeContext';

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
  // Try to get theme, fallback to light mode values if not in ThemeProvider
  let themeColors;
  let isDark = false;
  try {
    const theme = useTheme();
    themeColors = useThemeColors();
    isDark = theme.isDark;
  } catch {
    // Not in ThemeProvider, use default light colors
    themeColors = {
      card: colors.card,
      foreground: colors.foreground,
      foregroundSecondary: colors.slate[600],
      foregroundMuted: colors.slate[500],
      border: colors.slate[100],
    };
  }

  return (
    <div
      css={{
        backgroundColor: themeColors.card,
        borderRadius: radius['2xl'],
        padding: '1.5rem',
        boxShadow: shadows.lg,
        border: `1px solid ${isDark ? colors.slate[700] : colors.slate[100]}`,
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
              backgroundColor: trend.isPositive 
                ? (isDark ? colors.green[900] : colors.green[100]) 
                : (isDark ? colors.red[900] : colors.red[100]),
              color: trend.isPositive 
                ? (isDark ? colors.green[300] : colors.green[700]) 
                : (isDark ? colors.red[300] : colors.red[700]),
            }}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </div>
        )}
      </div>
      <h3 css={{ 
        fontSize: '0.875rem', 
        fontWeight: 500, 
        color: themeColors.foregroundSecondary, 
        marginBottom: '0.25rem', 
        margin: 0,
        transition: 'color 0.3s ease',
      }}>
        {title}
      </h3>
      <p css={{ 
        fontSize: '1.875rem', 
        fontWeight: 700, 
        color: themeColors.foreground, 
        margin: 0,
        transition: 'color 0.3s ease',
      }}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
