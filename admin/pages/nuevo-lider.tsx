/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Button } from '@keystone-ui/button';
import { Select, TextInput, Checkbox } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { Box, jsx } from '@keystone-ui/core';
import { 
  FaUserPlus, 
  FaMapMarkerAlt, 
  FaRoute, 
  FaPhone, 
  FaCalendarAlt,
  FaExclamationTriangle,
  FaCheckCircle
} from 'react-icons/fa';
import ProtectedRoute from '../components/ProtectedRoute';

// Query para obtener todas las rutas
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;

// Query para obtener todas las localidades
const GET_LOCATIONS = gql`
  query GetLocations {
    locations {
      id
      name
      municipality {
        name
        state {
          name
        }
      }
    }
  }
`;

// Query para verificar si ya existe un líder en una localidad
const CHECK_EXISTING_LEADER = gql`
  query CheckExistingLeader($locationId: ID!) {
    employees(where: {
      type: { equals: "ROUTE_LEAD" }
      personalData: {
        addresses: {
          some: {
            location: { id: { equals: $locationId } }
          }
        }
      }
    }) {
      id
      personalData {
        fullName
        addresses {
          location {
            name
          }
        }
      }
    }
  }
`;

// Mutación para crear nuevo líder
const CREATE_NEW_LEADER = gql`
  mutation CreateNewLeader($fullName: String!, $birthDate: String, $phone: String, $locationId: ID!, $routeId: ID!, $replaceExisting: Boolean) {
    createNewLeader(fullName: $fullName, birthDate: $birthDate, phone: $phone, locationId: $locationId, routeId: $routeId, replaceExisting: $replaceExisting)
  }
`;

interface Route {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  municipality: {
    name: string;
    state: {
      name: string;
    };
  };
}

interface ExistingLeader {
  id: string;
  personalData: {
    fullName: string;
    addresses: {
      location: {
        name: string;
      };
    }[];
  };
}

export default function NuevoLiderPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    birthDate: '',
    phone: '',
    locationId: '',
    routeId: '',
    replaceExisting: false
  });

  const [existingLeader, setExistingLeader] = useState<ExistingLeader | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Queries
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);
  const { data: locationsData, loading: locationsLoading } = useQuery(GET_LOCATIONS);
  
  const { data: existingLeaderData, refetch: refetchExistingLeader } = useQuery(CHECK_EXISTING_LEADER, {
    variables: { locationId: formData.locationId },
    skip: !formData.locationId
  });

  // Mutación
  const [createNewLeader, { loading: createLoading }] = useMutation(CREATE_NEW_LEADER);

  // Efecto para verificar líder existente cuando cambia la localidad
  useEffect(() => {
    if (formData.locationId) {
      refetchExistingLeader();
    }
  }, [formData.locationId, refetchExistingLeader]);

  // Efecto para actualizar el estado del líder existente
  useEffect(() => {
    if (existingLeaderData?.employees?.length > 0) {
      setExistingLeader(existingLeaderData.employees[0]);
    } else {
      setExistingLeader(null);
    }
  }, [existingLeaderData]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.locationId || !formData.routeId) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    if (existingLeader && !formData.replaceExisting) {
      alert('Ya existe un líder en esta localidad. Marca la opción "Reemplazar líder existente" si deseas continuar.');
      return;
    }

    try {
      const result = await createNewLeader({
        variables: {
          fullName: formData.fullName,
          birthDate: formData.birthDate || null,
          phone: formData.phone || null,
          locationId: formData.locationId,
          routeId: formData.routeId,
          replaceExisting: formData.replaceExisting
        }
      });

      const response = result.data?.createNewLeader;
      
      if (response?.success) {
        setSuccessMessage(response.message);
        setShowSuccess(true);
        
        // Limpiar formulario
        setFormData({
          fullName: '',
          birthDate: '',
          phone: '',
          locationId: '',
          routeId: '',
          replaceExisting: false
        });
        setExistingLeader(null);
        
        // Ocultar mensaje de éxito después de 5 segundos
        setTimeout(() => {
          setShowSuccess(false);
        }, 5000);
      } else {
        alert(response?.message || 'Error al crear nuevo líder');
      }
    } catch (error) {
      console.error('Error creando nuevo líder:', error);
      alert('Error al crear nuevo líder');
    }
  };

  const selectedLocation = locationsData?.locations?.find((loc: Location) => loc.id === formData.locationId);

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <PageContainer header="Crear Nuevo Líder">
        <Box>
          {showSuccess && (
            <Box
              padding="medium"
              marginBottom="large"
              css={{
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <FaCheckCircle color="#16A34A" size={20} />
              <span style={{ color: '#16A34A', fontWeight: '500' }}>
                {successMessage}
              </span>
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <Box
              css={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px',
                marginBottom: '32px'
              }}
            >
              {/* Información Personal */}
              <Box
                css={{
                  backgroundColor: '#F8FAFC',
                  padding: '24px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0'
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaUserPlus color="#3B82F6" />
                  Información Personal
                </h3>
                
                <Box marginBottom="medium">
                  <TextInput
                    placeholder="Nombre completo del líder"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    required
                  />
                </Box>

                <Box marginBottom="medium">
                  <TextInput
                    type="text"
                    placeholder="Fecha de nacimiento (YYYY-MM-DD)"
                    value={formData.birthDate}
                    onChange={(e) => handleInputChange('birthDate', e.target.value)}
                  />
                </Box>

                <Box marginBottom="medium">
                  <TextInput
                    placeholder="Número de teléfono"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </Box>
              </Box>

              {/* Ubicación y Ruta */}
              <Box
                css={{
                  backgroundColor: '#F8FAFC',
                  padding: '24px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0'
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaMapMarkerAlt color="#3B82F6" />
                  Ubicación y Ruta
                </h3>
                
                <Box marginBottom="medium">
                  <Select
                    placeholder="Seleccionar localidad"
                    value={locationsData?.locations?.find((loc: Location) => loc.id === formData.locationId) ? {
                      label: `${locationsData.locations.find((loc: Location) => loc.id === formData.locationId)?.name}, ${locationsData.locations.find((loc: Location) => loc.id === formData.locationId)?.municipality.name}, ${locationsData.locations.find((loc: Location) => loc.id === formData.locationId)?.municipality.state.name}`,
                      value: formData.locationId
                    } : null}
                    onChange={(option) => handleInputChange('locationId', option?.value || '')}
                    options={locationsData?.locations?.map((location: Location) => ({
                      label: `${location.name}, ${location.municipality.name}, ${location.municipality.state.name}`,
                      value: location.id
                    })) || []}
                    isLoading={locationsLoading}
                    required
                  />
                </Box>

                <Box marginBottom="medium">
                  <Select
                    placeholder="Seleccionar ruta"
                    value={routesData?.routes?.find((route: Route) => route.id === formData.routeId) ? {
                      label: routesData.routes.find((route: Route) => route.id === formData.routeId)?.name || '',
                      value: formData.routeId
                    } : null}
                    onChange={(option) => handleInputChange('routeId', option?.value || '')}
                    options={routesData?.routes?.map((route: Route) => ({
                      label: route.name,
                      value: route.id
                    })) || []}
                    isLoading={routesLoading}
                    required
                  />
                </Box>

                {/* Información de la localidad seleccionada */}
                {selectedLocation && (
                  <Box
                    css={{
                      backgroundColor: '#EFF6FF',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid #BFDBFE'
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '14px', color: '#1E40AF' }}>
                      <strong>Localidad seleccionada:</strong><br />
                      {selectedLocation.name}<br />
                      {selectedLocation.municipality.name}, {selectedLocation.municipality.state.name}
                    </p>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Advertencia de líder existente */}
            {existingLeader && (
              <Box
                css={{
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <FaExclamationTriangle color="#D97706" size={20} />
                <div>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '500', color: '#92400E' }}>
                    Ya existe un líder en esta localidad
                  </p>
                  <p style={{ margin: 0, color: '#92400E' }}>
                    <strong>Líder actual:</strong> {existingLeader.personalData.fullName}
                  </p>
                </div>
              </Box>
            )}

            {/* Opción de reemplazo */}
            {existingLeader && (
              <Box marginBottom="large">
                <Checkbox
                  checked={formData.replaceExisting}
                  onChange={(e) => handleInputChange('replaceExisting', e.target.checked)}
                >
                  Reemplazar líder existente (se transferirán todos los préstamos activos al nuevo líder)
                </Checkbox>
              </Box>
            )}

            {/* Botones */}
            <Box
              css={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}
            >
              <Button
                type="button"
                onClick={() => {
                  setFormData({
                    fullName: '',
                    birthDate: '',
                    phone: '',
                    locationId: '',
                    routeId: '',
                    replaceExisting: false
                  });
                  setExistingLeader(null);
                }}
              >
                Limpiar
              </Button>
              
              <Button
                type="submit"
                tone="positive"
                isLoading={createLoading}
                disabled={!formData.fullName || !formData.locationId || !formData.routeId}
              >
                {createLoading ? <LoadingDots label="Creando líder..." /> : 'Crear Líder'}
              </Button>
            </Box>
          </form>
        </Box>
      </PageContainer>
    </ProtectedRoute>
  );
}
