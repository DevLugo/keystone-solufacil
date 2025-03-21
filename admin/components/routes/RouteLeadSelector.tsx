/** @jsxRuntime classic */
/** @jsx jsx */

import React from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Select } from '@keystone-ui/fields';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { GET_ROUTES, GET_LEADS } from '../../graphql/queries/routes';
import type { Employee } from '../../types/transaction';

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
  selectedRoute: Route | null;
  selectedLead: Employee | null;
  selectedDate: Date;
  onRouteSelect: (route: Route | null) => void;
  onLeadSelect: (lead: Employee | null) => void;
  onDateSelect: (date: Date) => void;
}

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    width: '100%'
  },
  selector: {
    width: '100%'
  },
  dateInput: {
    width: '100%',
    padding: '8px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    '&:focus': {
      outline: 'none',
      borderColor: '#4299e1',
      boxShadow: '0 0 0 1px #4299e1',
    }
  }
};

export const RouteLeadSelector: React.FC<RouteLeadSelectorProps> = ({
  selectedRoute,
  selectedLead,
  selectedDate,
  onRouteSelect,
  onLeadSelect,
  onDateSelect
}) => {
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
    variables: { where: {} },
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS);

  React.useEffect(() => {
    if (selectedRoute?.id) {
      getLeads({ variables: { routeId: selectedRoute.id } });
    }
  }, [selectedRoute, getLeads]);

  const routes = routesData?.routes || [];
  const leads = leadsData?.employees || [];

  const routeOptions = routes.map((route: Route) => ({
    label: route.name,
    value: route.id,
    data: route
  }));

  const leadOptions = leads.map((lead: Lead) => ({
    label: lead.personalData?.fullName || 'Sin nombre',
    value: lead.id,
    data: lead
  }));

  const handleRouteChange = (option: any) => {
    onRouteSelect(option?.data || null);
    onLeadSelect(null);
  };

  const handleLeadChange = (option: any) => {
    onLeadSelect(option?.data || null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const [year, month, day] = e.target.value.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      onDateSelect(date);
    } catch (error) {
      console.error('Error al procesar la fecha:', error);
    }
  };

  if (routesLoading) return <LoadingDots label="Loading routes" />;
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

  return (
    <Box css={styles.container}>
      <Box css={styles.selector}>
        <Select
          value={routeOptions.find(option => option.value === selectedRoute?.id) || null}
          options={routeOptions}
          onChange={handleRouteChange}
          placeholder="Seleccionar ruta"
          isLoading={routesLoading}
        />
      </Box>
      <Box css={styles.selector}>
        <Select
          value={leadOptions.find(option => option.value === selectedLead?.id) || null}
          options={leadOptions}
          onChange={handleLeadChange}
          placeholder="Seleccionar líder"
          isLoading={leadsLoading}
          isDisabled={!selectedRoute}
        />
      </Box>
      <Box css={styles.selector}>
        <input
          type="date"
          value={selectedDate.toISOString().split('T')[0]}
          onChange={handleDateChange}
          css={styles.dateInput}
        />
      </Box>
    </Box>
  );
};
