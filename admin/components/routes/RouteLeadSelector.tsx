/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Select } from '@keystone-ui/fields';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { GET_ROUTES, GET_LEADS } from '../../graphql/queries/routes';

type Lead = {
  id: string;
  personalData: {
    fullName: string;
  };
  type: string;
};

type Route = {
  name: string;
  id: string;
  account: {
    id: string;
    type: string;
  };
};

type Option = {
  value: string;
  label: string;
};

interface RouteLeadSelectorProps {
  onRouteSelect: (route: Option | null) => void;
  onLeadSelect: (lead: Option | null) => void;
  selectedRoute: Option | null;
  selectedLead: Option | null;
  comission?: number;
  onComissionChange?: (comission: number) => void;
}

export const RouteLeadSelector: React.FC<RouteLeadSelectorProps> = ({
  onRouteSelect,
  onLeadSelect,
  selectedRoute,
  selectedLead,
  comission,
  onComissionChange
}) => {
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
    variables: { where: {} },
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS);

  const handleRouteSelect = (route: Option | null) => {
    onRouteSelect(route);
    onLeadSelect(null);
    if (route) {
      getLeads({
        variables: { routeId: route.value }
      });
    }
  };

  if (routesLoading) return <LoadingDots label="Loading routes" />;
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

  const routeOptions = routesData?.routes
    ?.filter(route => route.account?.type === 'EMPLOYEE_CASH_FUND')
    ?.map(route => ({
      value: route.id,
      label: `${route.name} (Cuenta: ${route.account.id})`,
    })) || [];

  const leadOptions = leadsData?.employees
    ?.filter(employee => employee.type === 'LEAD')
    ?.map(lead => ({
      value: lead.id,
      label: lead.personalData.fullName,
    })) || [];

  return (
    <Box style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '16px' }}>
      <Box style={{ flex: 1 }}>
        <label style={{ display: 'block', marginBottom: '4px' }}>Ruta</label>
        <Select
          options={routeOptions}
          isLoading={routesLoading}
          value={selectedRoute}
          onChange={handleRouteSelect}
        />
      </Box>
      <Box style={{ flex: 1 }}>
        <label style={{ display: 'block', marginBottom: '4px' }}>Lider (Opcional)</label>
        <Select
          options={leadOptions}
          isLoading={leadsLoading}
          value={selectedLead}
          onChange={onLeadSelect}
          isClearable
          placeholder="Seleccionar líder (opcional)"
        />
      </Box>
      {onComissionChange && (
        <Box style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>Comision</label>
          <input
            type="number"
            value={comission}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            onChange={(e) => onComissionChange(parseInt(e.target.value))}
          />
        </Box>
      )}
    </Box>
  );
};
