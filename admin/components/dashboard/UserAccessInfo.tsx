/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { FaUser, FaUserTie, FaRoute, FaInfo, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

interface UserAccessInfoProps {
  userInfo: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  employeeInfo?: {
    id: string;
    type?: string;
    personalData?: {
      fullName: string;
      clientCode?: string;
    };
  };
  routes: Array<{ id: string; name: string; }>;
  accessType: 'ADMIN_ALL_ROUTES' | 'MULTIPLE_ROUTES' | 'SINGLE_ROUTE';
  hasEmployee: boolean;
  isAdmin: boolean;
}

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e2e8f0',
    marginBottom: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '8px',
    '@media (min-width: 640px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#6b7280',
  },
  infoValue: {
    fontWeight: '500',
    color: '#1a202c',
  },
  statusBadge: (type: 'success' | 'warning' | 'info') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: 
      type === 'success' ? '#dcfce7' : 
      type === 'warning' ? '#fef3c7' : '#dbeafe',
    color: 
      type === 'success' ? '#166534' : 
      type === 'warning' ? '#92400e' : '#1e40af',
  }),
  routesList: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#6b7280',
  },
  routeItem: {
    padding: '4px 8px',
    backgroundColor: '#f1f5f9',
    borderRadius: '4px',
    margin: '2px',
    display: 'inline-block',
  },
};

export const UserAccessInfo = ({
  userInfo,
  employeeInfo,
  routes,
  accessType,
  hasEmployee,
  isAdmin,
}: UserAccessInfoProps) => {
  const getAccessStatus = () => {
    if (isAdmin) {
      return { type: 'info' as const, label: 'Acceso Administrativo', icon: <FaCheckCircle /> };
    }
    if (!hasEmployee) {
      return { type: 'warning' as const, label: 'Sin Empleado Vinculado', icon: <FaExclamationTriangle /> };
    }
    if (routes.length === 0) {
      return { type: 'warning' as const, label: 'Sin Rutas Asignadas', icon: <FaExclamationTriangle /> };
    }
    if (routes.length > 1) {
      return { type: 'success' as const, label: 'Múltiples Rutas', icon: <FaCheckCircle /> };
    }
    return { type: 'success' as const, label: 'Ruta Asignada', icon: <FaCheckCircle /> };
  };

  const accessStatus = getAccessStatus();

  return (
    <div css={styles.container}>
      <div css={styles.header}>
        <FaInfo />
        Información de Acceso
        <span css={styles.statusBadge(accessStatus.type)}>
          {accessStatus.icon}
          {accessStatus.label}
        </span>
      </div>
      
      <div css={styles.infoGrid}>
        <div css={styles.infoItem}>
          <FaUser />
          <span>Usuario:</span>
          <span css={styles.infoValue}>{userInfo.name}</span>
        </div>
        
        <div css={styles.infoItem}>
          <span>Rol:</span>
          <span css={styles.infoValue}>{userInfo.role}</span>
        </div>
        
        {hasEmployee && employeeInfo && (
          <>
            <div css={styles.infoItem}>
              <FaUserTie />
              <span>Empleado:</span>
              <span css={styles.infoValue}>
                {employeeInfo.personalData?.fullName || 'Sin nombre'}
              </span>
            </div>
            
            {employeeInfo.type && (
              <div css={styles.infoItem}>
                <span>Tipo:</span>
                <span css={styles.infoValue}>{employeeInfo.type}</span>
              </div>
            )}
          </>
        )}
        
        <div css={styles.infoItem}>
          <FaRoute />
          <span>Rutas:</span>
          <span css={styles.infoValue}>{routes.length}</span>
        </div>
      </div>
      
      {routes.length > 0 && (
        <div css={styles.routesList}>
          <strong>Rutas disponibles:</strong>
          <div style={{ marginTop: '4px' }}>
            {routes.map(route => (
              <span key={route.id} css={styles.routeItem}>
                {route.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};