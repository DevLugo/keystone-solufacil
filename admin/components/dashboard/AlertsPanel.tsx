/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { FaBell, FaExclamationTriangle, FaInfoCircle, FaCheckCircle } from 'react-icons/fa';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  value?: number;
}

interface AlertsPanelProps {
  cvPercentage: number;
  averageWeeksWithoutPayment: number;
  dangerousLocalitiesCount: number;
  decliningLocalitiesCount: number;
  criticalClientsCount: number;
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
  alertsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  alert: (type: 'critical' | 'warning' | 'info' | 'success') => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 
      type === 'critical' ? '#fef2f2' :
      type === 'warning' ? '#fffbeb' :
      type === 'info' ? '#f0f9ff' : '#f0fdf4',
    border: `1px solid ${
      type === 'critical' ? '#fecaca' :
      type === 'warning' ? '#fed7aa' :
      type === 'info' ? '#bae6fd' : '#bbf7d0'
    }`,
  }),
  alertIcon: (type: 'critical' | 'warning' | 'info' | 'success') => ({
    color: 
      type === 'critical' ? '#dc2626' :
      type === 'warning' ? '#d97706' :
      type === 'info' ? '#2563eb' : '#16a34a',
    fontSize: '16px',
    marginTop: '2px',
    flexShrink: 0,
  }),
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: '4px',
  },
  alertMessage: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.4',
  },
  noAlerts: {
    textAlign: 'center' as const,
    color: '#16a34a',
    fontSize: '14px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
};

export const AlertsPanel = ({
  cvPercentage,
  averageWeeksWithoutPayment,
  dangerousLocalitiesCount,
  decliningLocalitiesCount,
  criticalClientsCount,
}: AlertsPanelProps) => {
  const alerts: Alert[] = [];

  // Critical alerts
  if (cvPercentage > 40) {
    alerts.push({
      id: 'cv-critical',
      type: 'critical',
      title: 'Cartera Vencida Crítica',
      message: `El ${cvPercentage.toFixed(1)}% de tu cartera está vencida. Requiere atención inmediata.`,
      value: cvPercentage,
    });
  }

  if (averageWeeksWithoutPayment > 4) {
    alerts.push({
      id: 'payment-critical',
      type: 'critical',
      title: 'Promedio de Pago Crítico',
      message: `Promedio de ${averageWeeksWithoutPayment.toFixed(1)} semanas sin pago es muy alto.`,
      value: averageWeeksWithoutPayment,
    });
  }

  // Warning alerts
  if (cvPercentage > 25 && cvPercentage <= 40) {
    alerts.push({
      id: 'cv-warning',
      type: 'warning',
      title: 'Cartera Vencida Elevada',
      message: `El ${cvPercentage.toFixed(1)}% de cartera vencida requiere seguimiento cercano.`,
      value: cvPercentage,
    });
  }

  if (dangerousLocalitiesCount > 0) {
    alerts.push({
      id: 'dangerous-growth',
      type: 'warning',
      title: 'Localidades con Crecimiento Peligroso',
      message: `${dangerousLocalitiesCount} localidades están creciendo muy rápido. Monitorea la capacidad de cobranza.`,
      value: dangerousLocalitiesCount,
    });
  }

  if (decliningLocalitiesCount > 0) {
    alerts.push({
      id: 'declining-localities',
      type: 'warning',
      title: 'Localidades en Declive',
      message: `${decliningLocalitiesCount} localidades muestran declive en nuevos préstamos.`,
      value: decliningLocalitiesCount,
    });
  }

  if (criticalClientsCount > 0) {
    alerts.push({
      id: 'critical-clients',
      type: 'warning',
      title: 'Clientes con Rachas Largas',
      message: `${criticalClientsCount} clientes tienen más de 3 semanas sin pagar.`,
      value: criticalClientsCount,
    });
  }

  // Info alerts
  if (averageWeeksWithoutPayment > 2 && averageWeeksWithoutPayment <= 4) {
    alerts.push({
      id: 'payment-info',
      type: 'info',
      title: 'Promedio de Pago Moderado',
      message: `Promedio de ${averageWeeksWithoutPayment.toFixed(1)} semanas sin pago. Considera estrategias de seguimiento.`,
      value: averageWeeksWithoutPayment,
    });
  }

  // Success message if no major issues
  if (alerts.length === 0) {
    alerts.push({
      id: 'all-good',
      type: 'success',
      title: 'Todo en Orden',
      message: 'No hay alertas críticas en tu ruta. ¡Excelente trabajo!',
    });
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <FaExclamationTriangle />;
      case 'warning':
        return <FaBell />;
      case 'info':
        return <FaInfoCircle />;
      case 'success':
        return <FaCheckCircle />;
      default:
        return <FaInfoCircle />;
    }
  };

  return (
    <div css={styles.container}>
      <h2 css={styles.title}>
        <FaBell />
        Alertas y Notificaciones
      </h2>
      
      {alerts.length > 0 ? (
        <div css={styles.alertsList}>
          {alerts.map((alert) => (
            <div key={alert.id} css={styles.alert(alert.type)}>
              <span css={styles.alertIcon(alert.type)}>
                {getAlertIcon(alert.type)}
              </span>
              <div css={styles.alertContent}>
                <div css={styles.alertTitle}>{alert.title}</div>
                <div css={styles.alertMessage}>{alert.message}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div css={styles.noAlerts}>
          <FaCheckCircle />
          No hay alertas activas
        </div>
      )}
    </div>
  );
};