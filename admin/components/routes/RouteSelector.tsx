/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useMemo, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Select } from '@keystone-ui/fields';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { GET_ROUTES } from '../../graphql/queries/routes';
import type { Option, Route } from '../../types/loan';

interface RouteSelectorProps {
  value: Option | null;
  onRouteSelect: (route: Option | null) => void;
  onBalanceUpdate?: (balance: number) => void;
}

export const RouteSelector = React.memo(({ value, onRouteSelect, onBalanceUpdate }: RouteSelectorProps) => {
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
    variables: { where: { } },
  });

  const routeOptions = useMemo(() => 
    routesData?.routes?.map(route => ({
      value: route.id,
      label: `${route.name} ($${route.balance || 0})`,
    })) || [], 
    [routesData]
  );

  // Actualizar el balance cuando cambia la ruta seleccionada
  useEffect(() => {
    if (value && routesData?.routes) {
      const selectedRoute = routesData.routes.find(route => route.id === value.value);
      if (selectedRoute && onBalanceUpdate) {
        onBalanceUpdate(selectedRoute.balance || 0);
      }
    }
  }, [value, routesData, onBalanceUpdate]);

  if (routesLoading) return <LoadingDots label="Loading routes" />;
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

  return (
    <Select
      value={value}
      options={routeOptions}
      onChange={onRouteSelect}
      placeholder="Select a route"
    />
  );
});
