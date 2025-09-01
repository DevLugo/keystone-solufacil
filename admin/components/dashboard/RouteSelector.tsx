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

export const RouteSelector = ({ routes, selectedRouteId, onRouteChange, isAdmin }: RouteSelectorProps) => {
  if (routes.length <= 1 && !isAdmin) {
    return null;
  }

  const options = routes.map(route => ({
    label: route.name,
    value: route.id,
  }));

  return (
    <div css={styles.container}>
      <span css={styles.label}>
        <FaRoute />
        Ruta:
      </span>
      <div css={styles.select}>
        <Select
          value={options.find(opt => opt.value === selectedRouteId)}
          onChange={(option) => option && onRouteChange(option.value)}
          options={options}
          placeholder="Selecciona una ruta..."
        />
      </div>
    </div>
  );
};