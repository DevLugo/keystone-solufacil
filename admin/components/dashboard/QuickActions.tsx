/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { 
  FaPlus, 
  FaSearch, 
  FaFileAlt, 
  FaMoneyBillWave, 
  FaRoute,
  FaChartBar
} from 'react-icons/fa';

interface QuickActionsProps {
  routeId: string;
  routeName: string;
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
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
    '@media (min-width: 640px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (min-width: 1024px)': {
      gridTemplateColumns: 'repeat(3, 1fr)',
    },
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    color: '#374151',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#f8fafc',
      borderColor: '#d1d5db',
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    },
    '&:active': {
      transform: 'translateY(0)',
    },
  },
  actionIcon: {
    fontSize: '16px',
    color: '#6b7280',
  },
  actionLabel: {
    flex: 1,
  },
};

export const QuickActions = ({ routeId, routeName }: QuickActionsProps) => {
  const actions = [
    {
      icon: <FaSearch />,
      label: 'Buscar Clientes',
      href: `/historial-cliente?route=${routeId}`,
    },
    {
      icon: <FaPlus />,
      label: 'Nuevo Préstamo',
      href: `/loans/create?route=${routeId}`,
    },
    {
      icon: <FaMoneyBillWave />,
      label: 'Registrar Pago',
      href: `/transacciones?route=${routeId}`,
    },
    {
      icon: <FaFileAlt />,
      label: 'Reporte de Cobranza',
      href: `/reporte-cobranza?route=${routeId}`,
    },
    {
      icon: <FaRoute />,
      label: 'Ver Cartera',
      href: `/cartera?route=${routeId}`,
    },
    {
      icon: <FaChartBar />,
      label: 'Generar Listados',
      href: `/generar-pdfs?route=${routeId}`,
    },
  ];

  const handleActionClick = (href: string) => {
    window.location.href = href;
  };

  return (
    <div css={styles.container}>
      <h2 css={styles.title}>
        <FaRoute />
        Acciones Rápidas - {routeName}
      </h2>
      
      <div css={styles.actionsGrid}>
        {actions.map((action, index) => (
          <button
            key={index}
            css={styles.actionButton}
            onClick={() => handleActionClick(action.href)}
          >
            <span css={styles.actionIcon}>{action.icon}</span>
            <span css={styles.actionLabel}>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};