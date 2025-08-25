/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect } from 'react';
import { jsx, Heading } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { useQuery } from '@apollo/client';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { Select } from '@keystone-ui/fields';
import { GET_ROUTES_FOR_PDF, GET_ROUTE_LOCALITIES } from '../graphql/queries/pdf-reports';

interface Route {
  id: string;
  name: string;
  employees: Leader[];
}

interface Leader {
  id: string;
  personalData: {
    id: string;
    fullName: string;
    addresses: Address[];
  };
}

interface Address {
  id: string;
  location: {
    id: string;
    name: string;
  };
}

interface LocalityWithLeader {
  id: string;
  name: string;
  leaderName: string;
  leaderId: string;
}

export default function GenerarPDFsPage() {
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedLocalities, setSelectedLocalities] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [weekMode, setWeekMode] = useState<'current' | 'next'>('next');

  // Consulta para obtener todas las rutas
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery(GET_ROUTES_FOR_PDF);

  // Consulta para obtener localidades de la ruta seleccionada
  const { data: localitiesData, loading: localitiesLoading } = useQuery(GET_ROUTE_LOCALITIES, {
    variables: { routeId: selectedRouteId },
    skip: !selectedRouteId,
  });

  // Resetear localidades seleccionadas cuando cambia la ruta
  useEffect(() => {
    setSelectedLocalities(new Set());
  }, [selectedRouteId]);

  const handleRouteChange = (value: string) => {
    setSelectedRouteId(value);
  };

  const handleLocalityToggle = (localityId: string) => {
    const newSelected = new Set(selectedLocalities);
    if (newSelected.has(localityId)) {
      newSelected.delete(localityId);
    } else {
      newSelected.add(localityId);
    }
    setSelectedLocalities(newSelected);
  };

  const handleSelectAll = () => {
    if (localities.length === 0) return;
    const allLocalityIds = new Set(localities.map((l: LocalityWithLeader) => l.id));
    setSelectedLocalities(allLocalityIds);
  };

  const handleSelectNone = () => {
    setSelectedLocalities(new Set());
  };

  const handleGeneratePDFs = async () => {
    if (selectedLocalities.size === 0) {
      alert('Por favor selecciona al menos una localidad');
      return;
    }

    setIsGenerating(true);
    
    try {
      // Generar un PDF por cada localidad seleccionada
      for (const localityId of selectedLocalities) {
        const locality = localities.find((l: LocalityWithLeader) => l.id === localityId);
        if (!locality) continue;

        const params = new URLSearchParams({
          localityId,
          routeId: selectedRouteId,
          localityName: locality.name,
          routeName: localitiesData?.route?.name || '',
          leaderName: locality.leaderName,
          leaderId: locality.leaderId,
          weekMode
        });

        // Abrir cada PDF en una nueva pestaña
        window.open(`/generate-pdf?${params.toString()}`, '_blank');
        
        // Pequeña pausa entre PDFs para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error generando PDFs:', error);
      alert('Error al generar los PDFs. Por favor intenta de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Estilos
  const containerStyle = {
    padding: '24px',
    maxWidth: '800px',
  };

  const sectionStyle = {
    background: '#ffffff',
    border: '1px solid #e1e5e9',
    borderRadius: '6px',
    padding: '24px',
    marginBottom: '24px',
  };

  const checkboxContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '12px',
    marginTop: '16px',
  };

  const checkboxItemStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    border: '1px solid #e1e5e9',
    borderRadius: '4px',
    background: '#f8f9fa',
    cursor: 'pointer',
  };

  const checkboxStyle = {
    marginRight: '8px',
  };

  const buttonGroupStyle = {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
    marginBottom: '24px',
  };

  const generateButtonStyle = {
    background: '#0066cc',
    color: 'white',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: isGenerating ? 'not-allowed' : 'pointer',
    opacity: isGenerating ? 0.6 : 1,
  };

  if (routesLoading) {
    return (
      <PageContainer header={<Heading type="h1">Generar PDFs de Cobranza</Heading>}>
        <div css={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <LoadingDots label="Cargando rutas" size="large" tone="active" />
        </div>
      </PageContainer>
    );
  }

  if (routesError) {
    return (
      <PageContainer header={<Heading type="h1">Generar PDFs de Cobranza</Heading>}>
        <div css={{ color: 'red', padding: '20px' }}>
          Error al cargar las rutas: {routesError.message}
        </div>
      </PageContainer>
    );
  }

  const routeOptions = routesData?.routes?.map((route: Route) => ({
    label: route.name,
    value: route.id,
  })) || [];

  // Extraer localidades con información del líder
  const extractLocalitiesFromRoute = (routeData: any): LocalityWithLeader[] => {
    if (!routeData?.employees) return [];
    
    const localities: LocalityWithLeader[] = [];
    const seenLocalities = new Set<string>(); // Para evitar duplicados
    
    routeData.employees.forEach((leader: Leader) => {
      const leaderName = leader.personalData?.fullName || 'Líder sin nombre';
      
      leader.personalData?.addresses?.forEach((address: Address) => {
        if (address.location && !seenLocalities.has(address.location.id)) {
          localities.push({
            id: address.location.id,
            name: address.location.name,
            leaderName: leaderName,
            leaderId: leader.id
          });
          seenLocalities.add(address.location.id);
        }
      });
    });
    
    return localities.sort((a, b) => a.name.localeCompare(b.name));
  };

  const selectedRoute = localitiesData?.route;
  const localities = selectedRoute ? extractLocalitiesFromRoute(selectedRoute) : [];

  const handleRouteSelect = (option: { value: string; label: string } | null) => {
    handleRouteChange(option?.value || '');
  };

  return (
    <PageContainer header={<Heading type="h1">Generar PDFs de Cobranza</Heading>}>
      <div css={containerStyle}>
        
        {/* Sección de selección de ruta */}
        <div css={sectionStyle}>
          <Heading type="h3">1. Seleccionar Ruta</Heading>
          <div css={{ marginTop: '16px' }}>
            <Select
              value={routeOptions.find((option: { value: string; label: string }) => option.value === selectedRouteId) || null}
              onChange={handleRouteSelect}
              options={routeOptions}
              placeholder="Selecciona una ruta..."
              isClearable={false}
            />
          </div>
        </div>

        {/* Sección de selección de localidades */}
        {selectedRouteId && (
          <div css={sectionStyle}>
            <Heading type="h3">2. Seleccionar Localidades</Heading>
            <p css={{ color: '#666', margin: '8px 0 0 0' }}>
              Selecciona las localidades para las cuales deseas generar PDFs de cobranza
            </p>
            
            {localitiesLoading ? (
              <div css={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <LoadingDots label="Cargando localidades" size="medium" tone="active" />
              </div>
            ) : (
              <>
                <div css={buttonGroupStyle}>
                  <Button
                    size="small"
                    tone="active"
                    onClick={handleSelectAll}
                    isDisabled={localities.length === 0}
                  >
                    Seleccionar Todas
                  </Button>
                  <Button
                    size="small"
                    tone="passive"
                    onClick={handleSelectNone}
                    isDisabled={selectedLocalities.size === 0}
                  >
                    Deseleccionar Todas
                  </Button>
                </div>

                {localities.length === 0 ? (
                  <p css={{ color: '#666', fontStyle: 'italic' }}>
                    No hay localidades disponibles para esta ruta
                  </p>
                ) : (
                  <div css={checkboxContainerStyle}>
                    {localities.map((locality: LocalityWithLeader) => (
                      <div
                        key={locality.id}
                        css={{
                          ...checkboxItemStyle,
                          background: selectedLocalities.has(locality.id) ? '#e3f2fd' : '#f8f9fa',
                          borderColor: selectedLocalities.has(locality.id) ? '#0066cc' : '#e1e5e9',
                        }}
                        onClick={() => handleLocalityToggle(locality.id)}
                      >
                        <input
                          type="checkbox"
                          css={checkboxStyle}
                          checked={selectedLocalities.has(locality.id)}
                          onChange={() => {}} // Manejado por onClick del contenedor
                        />
                        <div css={{ display: 'flex', flexDirection: 'column' }}>
                          <span css={{ fontSize: '14px', fontWeight: '500' }}>
                            {locality.name}
                          </span>
                          <span css={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                            ({locality.leaderName})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Sección de generación */}
        {selectedRouteId && localities.length > 0 && (
          <div css={sectionStyle}>
            <Heading type="h3">3. Generar PDFs</Heading>
            <p css={{ color: '#666', margin: '8px 0 16px 0' }}>
              {selectedLocalities.size === 0 
                ? 'Selecciona al menos una localidad para generar los PDFs'
                : `Se generarán ${selectedLocalities.size} PDF${selectedLocalities.size === 1 ? '' : 's'} de cobranza`
              }
            </p>

            <div css={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <label style={{ fontSize: 14 }}>Semana objetivo:</label>
              <select
                value={weekMode}
                onChange={(e) => setWeekMode((e.target.value as 'current' | 'next') || 'next')}
                style={{ padding: '6px 10px', border: '1px solid #e1e5e9', borderRadius: 4 }}
              >
                <option value="current">En curso</option>
                <option value="next">Siguiente</option>
              </select>
              <span style={{ fontSize: 12, color: '#666' }}>
                Por defecto: Siguiente semana
              </span>
            </div>
            
            <button
              css={generateButtonStyle}
              onClick={handleGeneratePDFs}
              disabled={isGenerating || selectedLocalities.size === 0}
            >
              {isGenerating ? 'Generando PDFs...' : `Generar ${selectedLocalities.size} PDF${selectedLocalities.size === 1 ? '' : 's'}`}
            </button>
            
            {selectedLocalities.size > 0 && (
              <div css={{ marginTop: '16px', padding: '12px', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
                <p css={{ margin: '0', fontSize: '14px', color: '#856404' }}>
                  💡 <strong>Tip:</strong> Los PDFs se abrirán en pestañas separadas. 
                  Asegúrate de permitir ventanas emergentes en tu navegador.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}