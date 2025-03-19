/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Select } from '@keystone-ui/fields';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { GET_ROUTES, GET_LEADS } from '../../graphql/queries/routes';
import { Employee } from '../../pages/gastos';

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
};

interface RouteLeadSelectorProps {
  onRouteSelect: (route: Route | null) => void;
  onLeadSelect: (lead: Employee | null) => void;
  selectedRoute: Route | null;
  selectedLead: Employee | null;
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

  const handleRouteSelect = (option: { value: string; label: string } | null) => {
    if (!option) {
      onRouteSelect(null);
      return;
    }
    
    const selectedRoute = routesData?.routes.find(route => route.id === option.value) || null;
    onRouteSelect(selectedRoute);
    onLeadSelect(null);
    
    if (selectedRoute) {
      getLeads({
        variables: { routeId: selectedRoute.id }
      });
    }
  };

  const handleLeadSelect = (option: { value: string; label: string } | null) => {
    if (!option) {
      onLeadSelect(null);
      return;
    }
    
    const selectedLead = leadsData?.employees.find(lead => lead.id === option.value) || null;
    onLeadSelect(selectedLead as Employee | null);
  };

  if (routesLoading) return <LoadingDots label="Loading routes" />;
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

  const routeOptions = routesData?.routes?.map(route => ({
    value: route.id,
    label: route.name,
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
          value={selectedRoute ? { value: selectedRoute.id, label: selectedRoute.name } : null}
          onChange={handleRouteSelect}
        />
      </Box>
      <Box style={{ flex: 1 }}>
        <label style={{ display: 'block', marginBottom: '4px' }}>Lider</label>
        <Select
          options={leadOptions}
          isLoading={leadsLoading}
          value={selectedLead ? { value: selectedLead.id, label: selectedLead.personalData.fullName } : null}
          onChange={handleLeadSelect}
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
