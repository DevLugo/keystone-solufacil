export const colors = {
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  card: '#ffffff',
  cardForeground: '#0f172a',
  border: '#e2e8f0',
  input: '#e2e8f0',
  primary: '#2563eb',
  primaryForeground: '#ffffff',
  secondary: '#f1f5f9',
  secondaryForeground: '#0f172a',
  accent: '#f1f5f9',
  accentForeground: '#0f172a',
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
  ring: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  purple: '#8b5cf6',
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  purpleColors: {
    50: '#faf5ff',
    100: '#f3e8ff',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
  },
  teal: {
    500: '#14b8a6',
    600: '#0d9488',
  },
  pink: {
    500: '#ec4899',
  }
};

export const gradients = {
  blue: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  purple: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
  green: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  teal: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
  purplePink: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
  slate: 'linear-gradient(to right, #1e293b, #0f172a)',
  bgPage: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #faf5ff 100%)',
  blueLight: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
  purpleLight: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
  greenLight: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
};

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

export const radius = {
  sm: '0.125rem',
  DEFAULT: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  full: '9999px',
};

export const commonStyles = {
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    border: `1px solid ${colors.slate[100]}`,
    boxShadow: shadows.lg,
    overflow: 'hidden',
    transition: 'all 300ms',
    '&:hover': {
      boxShadow: shadows.xl,
    }
  },
};

