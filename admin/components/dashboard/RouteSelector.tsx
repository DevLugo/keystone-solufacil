/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { Select } from '@keystone-ui/fields';
import { FaRoute } from 'react-icons/fa';

interface Route {
  id: string;
  name: string;
}

interface RouteSelectorProps {
  routes: Route[];
  selectedRouteId: string;
  onRouteChange: (routeId: string) => void;
  isAdmin?: boolean;
  hasMultipleRoutes?: boolean;
  accessType?: 'ADMIN_ALL_ROUTES' | 'MULTIPLE_ROUTES' | 'SINGLE_ROUTE';
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: '250px',
    '@media (max-width: 767px)': {
      width: '100%',
      minWidth: 'auto',
    },
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    whiteSpace: 'nowrap' as const,
  },
  select: {
    flex: 1,
    minWidth: '180px',
  },
};

export const RouteSelector = ({ 
  routes, 
  selectedRouteId, 
  onRouteChange, 
  isAdmin, 
  hasMultipleRoutes,
  accessType 
}: RouteSelectorProps) => {
  // Show selector if:
  // 1. User is admin (can see all routes)
  // 2. User has multiple routes assigned
  // 3. There are multiple routes available
  const shouldShowSelector = isAdmin || hasMultipleRoutes || routes.length > 1;
  
  if (!shouldShowSelector) {
    return null;
  }

  const options = routes.map(route => ({
    label: route.name,
    value: route.id,
  }));

  const getPlaceholder = () => {
    if (isAdmin) return 'Selecciona una ruta (Admin)...';
    if (hasMultipleRoutes) return 'Selecciona una ruta...';
    return 'Selecciona una ruta...';
  };

  return (
    <div css={styles.container}>
      <span css={styles.label}>
        <FaRoute />
        {isAdmin ? 'Todas las Rutas:' : hasMultipleRoutes ? 'Mis Rutas:' : 'Ruta:'}
      </span>
      <div css={styles.select}>
        <Select
          value={options.find(opt => opt.value === selectedRouteId)}
          onChange={(option) => option && onRouteChange(option.value)}
          options={options}
          placeholder={getPlaceholder()}
        />
      </div>
      {routes.length > 1 && (
        <span css={{
          fontSize: '11px',
          color: '#6b7280',
          marginLeft: '8px',
          whiteSpace: 'nowrap',
        }}>
          ({routes.length} rutas)
        </span>
      )}
    </div>
  );
};