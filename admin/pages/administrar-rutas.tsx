/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Button } from '@keystone-ui/button';
import { Select, TextInput } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { Box, jsx } from '@keystone-ui/core';
import { FaExchangeAlt, FaEye, FaSave, FaUndo, FaMapMarkerAlt, FaUsers, FaMoneyBillWave } from 'react-icons/fa';
import ProtectedRoute from '../components/ProtectedRoute';

// Query para obtener todas las rutas con sus localidades
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
      employees {
        id
        type
        personalData {
          fullName
          addresses {
            location {
              name
              municipality {
                state {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Query para obtener todos los préstamos activos
const GET_ALL_ACTIVE_LOANS = gql`
  query GetAllActiveLoans {
    loans(where: {
      AND: [
        { finishedDate: { equals: null } },
        { pendingAmountStored: { gt: "0" } },
        { excludedByCleanup: null }
      ]
    }) {
      id
      status
      borrower {
        id
        personalData {
          addresses {
            location {
              name
            }
          }
        }
      }
      lead {
        id
        personalData {
          addresses {
            location {
              name
            }
          }
        }
      }
    }
  }
`;

// Mutation para actualizar la ruta de un empleado (que representa la localidad)
const UPDATE_LOCALITY_ROUTE = gql`
  mutation UpdateLocalityRoute($employeeId: ID!, $routeId: ID!) {
    updateEmployee(where: { id: $employeeId }, data: { routes: { connect: { id: $routeId } } }) {
      id
      type
      personalData {
        fullName
        addresses {
          location {
            name
          }
        }
      }
      routes {
        id
        name
      }
    }
  }
`;

interface Route {
  id: string;
  name: string;
  employees: Employee[];
}

interface Employee {
  id: string;
  type: string;
  personalData: {
    fullName: string;
    addresses: {
      location: {
        name: string;
        municipality: {
          state: {
            name: string;
          };
        };
      };
    }[];
  };
}

interface ActiveLoan {
  id: string;
  status: string;
  borrower: {
    id: string;
    personalData: {
      addresses: {
        location: {
          name: string;
        };
      }[];
    };
  };
  lead: {
    id: string;
    personalData: {
      addresses: {
        location: {
          name: string;
        };
      }[];
    };
  };
}

interface RouteStats {
  activeClients: number;
  payingClients: number;
  totalClients: number;
}

const AdministrarRutasPage = () => {
  const [selectedLocalities, setSelectedLocalities] = useState<Set<string>>(new Set());
  const [targetRouteId, setTargetRouteId] = useState<string>('');
  const [sourceRouteId, setSourceRouteId] = useState<string>('');
  const [pendingMoves, setPendingMoves] = useState<Array<{ employeeId: string; fromRouteId: string; toRouteId: string }>>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Queries
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery(GET_ROUTES);
  const { data: activeLoansData, loading: activeLoansLoading, error: activeLoansError } = useQuery(GET_ALL_ACTIVE_LOANS);

  // Mutation
  const [updateLocationRoute, { loading: updateLoading }] = useMutation(UPDATE_LOCALITY_ROUTE);

  const routes = routesData?.routes || [];

  // Calcular estadísticas por ruta
  const routeStats = useMemo(() => {
    if (!activeLoansData?.loans || !routes.length) return {};

    const stats: Record<string, RouteStats> = {};

    routes.forEach((route: Route) => {
      const routeLocalities = route.employees.map((emp: Employee) => emp.personalData.addresses[0]?.location.name).filter(Boolean);
      
      // Contar clientes activos por localidad en esta ruta
      const activeClients = new Set<string>();
      const payingClients = new Set<string>();

      activeLoansData.loans.forEach((loan: ActiveLoan) => {
        const loanLocation = loan.borrower?.personalData?.addresses?.[0]?.location?.name || 
                           loan.lead?.personalData?.addresses?.[0]?.location?.name;
        
        if (loanLocation && routeLocalities.includes(loanLocation)) {
          const clientId = loan.borrower?.id || loan.lead?.id;
          if (clientId) {
            activeClients.add(clientId);
            if (loan.status === 'ACTIVE') {
              payingClients.add(clientId);
            }
          }
        }
      });

      stats[route.id] = {
        activeClients: activeClients.size,
        payingClients: payingClients.size,
        totalClients: activeClients.size
      };
    });

    return stats;
  }, [activeLoansData, routes]);

  // Calcular estadísticas generales
  const generalStats = useMemo(() => {
    if (!routes.length || !routeStats) return { totalRoutes: 0, totalLocalities: 0, totalActiveClients: 0 };

    const totalRoutes = routes.length;
    const totalLocalities = routes.reduce((sum: number, route: Route) => sum + route.employees.length, 0);
    const totalActiveClients = Object.values(routeStats).reduce((sum: number, stats: RouteStats) => sum + stats.activeClients, 0);

    return { totalRoutes, totalLocalities, totalActiveClients };
  }, [routes, routeStats]);

  // Calcular preview de la ruta destino
  const destinationPreview = useMemo(() => {
    // Solo calcular preview cuando se haya seleccionado una ruta destino
    if (!targetRouteId || !sourceRouteId || selectedLocalities.size === 0) return null;

    const sourceRoute = routes.find((r: Route) => r.id === sourceRouteId);
    const targetRoute = routes.find((r: Route) => r.id === targetRouteId);
    
    if (!sourceRoute || !targetRoute) return null;

    // Obtener las localidades seleccionadas
    const selectedEmployees = sourceRoute.employees.filter((emp: Employee) => 
      selectedLocalities.has(emp.id)
    );

    // Contar clientes reales de las localidades seleccionadas
    let movingClientsCount = 0;
    if (activeLoansData?.loans) {
      const selectedLocalityNames = selectedEmployees.map((emp: Employee) => 
        emp.personalData.addresses[0]?.location.name
      ).filter(Boolean);

      // Agrupar préstamos por cliente para las localidades seleccionadas
      const loansByClient: { [clientId: string]: any[] } = {};
      
      activeLoansData.loans.forEach((loan: ActiveLoan) => {
        const loanLocation = loan.borrower?.personalData?.addresses?.[0]?.location?.name || 
                           loan.lead?.personalData?.addresses?.[0]?.location?.name;
        
        if (loanLocation && selectedLocalityNames.includes(loanLocation)) {
          const clientId = loan.borrower?.id || loan.lead?.id;
          if (clientId) {
            if (!loansByClient[clientId]) {
              loansByClient[clientId] = [];
            }
            loansByClient[clientId].push(loan);
          }
        }
      });

      // Contar clientes únicos
      movingClientsCount = Object.keys(loansByClient).length;
    }

    // Estadísticas actuales de la ruta destino
    const currentTargetStats = routeStats[targetRouteId] || { activeClients: 0, payingClients: 0, totalClients: 0 };

    // Estadísticas después del movimiento
    return {
      currentLocalities: targetRoute.employees.length,
      newLocalities: targetRoute.employees.length + selectedEmployees.length,
      currentTotalClients: currentTargetStats.totalClients,
      newTotalClients: currentTargetStats.totalClients + movingClientsCount
    };
  }, [targetRouteId, sourceRouteId, selectedLocalities, routes, routeStats, activeLoansData]);

  // Handlers
  const handleLocalityToggle = (localityId: string, routeId: string) => {
    const newSelected = new Set(selectedLocalities);
    
    if (newSelected.has(localityId)) {
      newSelected.delete(localityId);
    } else {
      newSelected.add(localityId);
    }
    
    setSelectedLocalities(newSelected);
    
    if (newSelected.size > 0) {
      setSourceRouteId(routeId);
    } else {
      setSourceRouteId('');
      setTargetRouteId('');
    }
  };

  const handleTargetRouteChange = (routeId: string) => {
    setTargetRouteId(routeId);
  };

  const handleConfirmMove = async () => {
    if (selectedLocalities.size === 0 || !targetRouteId || !sourceRouteId) return;

    const moves = Array.from(selectedLocalities).map(employeeId => ({
      employeeId,
      fromRouteId: sourceRouteId,
      toRouteId: targetRouteId
    }));

    setPendingMoves(moves);
    setIsPreviewMode(true);
  };

  const executeMoves = async () => {
    try {
      for (const move of pendingMoves) {
        await updateLocationRoute({
          variables: {
            employeeId: move.employeeId,
            routeId: move.toRouteId
          }
        });
      }
      
      // Resetear estado
      setSelectedLocalities(new Set());
      setSourceRouteId('');
      setTargetRouteId('');
      setPendingMoves([]);
      setIsPreviewMode(false);
      
      // Recargar datos
      window.location.reload();
    } catch (error) {
      console.error('Error al mover localidades:', error);
    }
  };

  const cancelChanges = () => {
    setSelectedLocalities(new Set());
    setSourceRouteId('');
    setTargetRouteId('');
    setPendingMoves([]);
    setIsPreviewMode(false);
  };

  if (routesLoading || activeLoansLoading) {
    return (
      <PageContainer header="Administrar Rutas y Localidades">
        <Box padding="large">
          <LoadingDots label="Cargando..." />
        </Box>
      </PageContainer>
    );
  }

  if (routesError || activeLoansError) {
    return (
      <PageContainer header="Administrar Rutas y Localidades">
        <Box padding="large">
          <GraphQLErrorNotice
            errors={routesError ? [routesError] : [activeLoansError!]}
            networkError={undefined}
          />
        </Box>
      </PageContainer>
    );
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <PageContainer header="Administrar Rutas y Localidades">
        <Box padding="large">
        <Box css={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Resumen General */}
          <Box css={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
            <Box css={{ fontSize: '24px', fontWeight: '700', color: '#1a202c', marginBottom: '20px' }}>
              📊 Resumen General
            </Box>
            
            <Box css={{ backgroundColor: '#ebf8ff', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bee3f8' }}>
              <Box css={{ fontSize: '14px', color: '#2b6cb0', textAlign: 'center' }}>
                Nota: Los números de clientes son valores reales obtenidos de la base de datos de préstamos activos.
              </Box>
            </Box>

            <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
              <Box css={{ textAlign: 'center' }}>
                <Box css={{ fontSize: '48px', fontWeight: '700', color: '#3182ce' }}>
                  {generalStats.totalRoutes}
                </Box>
                <Box css={{ fontSize: '16px', color: '#2d3748' }}>Rutas</Box>
              </Box>
              
              <Box css={{ textAlign: 'center' }}>
                <Box css={{ fontSize: '48px', fontWeight: '700', color: '#38a169' }}>
                  {generalStats.totalLocalities}
                </Box>
                <Box css={{ fontSize: '16px', color: '#2d3748' }}>Localidades</Box>
              </Box>
              
              <Box css={{ textAlign: 'center' }}>
                <Box css={{ fontSize: '48px', fontWeight: '700', color: '#d69e2e' }}>
                  {generalStats.totalActiveClients}
                </Box>
                <Box css={{ fontSize: '16px', color: '#2d3748' }}>Clientes Activos (real)</Box>
              </Box>
            </Box>
          </Box>

          {/* Mover Localidades */}
          <Box css={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
            <Box css={{ fontSize: '24px', fontWeight: '700', color: '#1a202c', marginBottom: '24px' }}>
              🔄 Mover Localidades
            </Box>

            {/* Controles de selección */}
            {selectedLocalities.size > 0 && (
              <Box css={{ backgroundColor: '#f7fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <Box css={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <Box css={{ fontSize: '16px', color: '#2d3748' }}>
                    Mover a ruta:
                  </Box>
                  <select
                    value={targetRouteId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTargetRouteChange(e.target.value)}
                    style={{ minWidth: '200px', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="">Seleccionar ruta destino</option>
                    {routes
                      .filter((route: Route) => route.id !== sourceRouteId)
                      .map((route: Route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                  </select>
                  
                  <Button
                    tone="positive"
                    weight="bold"
                    onClick={handleConfirmMove}
                    disabled={!targetRouteId}
                  >
                    Confirmar Movimiento
                  </Button>
                </Box>
              </Box>
            )}

            {/* Preview de la ruta destino */}
            {targetRouteId && destinationPreview && (
              <Box css={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <Box css={{ fontSize: '18px', fontWeight: '600', color: '#1a202c', marginBottom: '16px' }}>
                  📊 Preview de Ruta Destino: {routes.find((r: Route) => r.id === targetRouteId)?.name}
                </Box>
                
                <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <Box css={{ backgroundColor: '#f7fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <Box css={{ fontSize: '14px', color: '#718096', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>
                      Localidades
                    </Box>
                    <Box css={{ fontSize: '24px', fontWeight: '700', color: '#2d3748' }}>
                      {destinationPreview.currentLocalities} → {destinationPreview.newLocalities}
                    </Box>
                    <Box css={{ fontSize: '12px', color: '#38a169' }}>
                      Actual → Después del movimiento
                    </Box>
                  </Box>



                  <Box css={{ backgroundColor: '#fef5e7', padding: '20px', borderRadius: '12px', border: '1px solid #fed7aa' }}>
                    <Box css={{ fontSize: '14px', color: '#718096', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>
                      Total Clientes
                    </Box>
                    <Box css={{ fontSize: '24px', fontWeight: '700', color: '#2d3748' }}>
                      {destinationPreview.currentTotalClients} → {destinationPreview.newTotalClients}
                    </Box>
                    <Box css={{ fontSize: '12px', color: '#ed8936' }}>
                      Actual → Después del movimiento
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Lista de rutas y localidades */}
            <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              {routes.map((route: Route) => {
                const stats = routeStats[route.id] || { activeClients: 0, payingClients: 0, totalClients: 0 };
                const isSourceRoute = sourceRouteId === route.id;
                const isDisabled = sourceRouteId && !isSourceRoute;

                return (
                  <Box
                    key={route.id}
                    css={{
                      backgroundColor: isDisabled ? '#f7fafc' : 'white',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                      border: `1px solid ${isDisabled ? '#e2e8f0' : '#e2e8f0'}`,
                      opacity: isDisabled ? 0.6 : 1
                    }}
                  >
                    <Box css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <Box css={{ fontSize: '20px', fontWeight: '700', color: '#1a202c' }}>
                        🗺️ {route.name}
                      </Box>
                      <Box css={{ 
                        backgroundColor: '#38a169', 
                        color: 'white', 
                        padding: '4px 12px', 
                        borderRadius: '20px', 
                        fontSize: '12px', 
                        fontWeight: '600' 
                      }}>
                        {route.employees.length} localidades
                      </Box>
                    </Box>

                    <Box css={{ fontSize: '16px', color: '#4a5568', marginBottom: '20px' }}>
                      👥 {stats.activeClients} clientes activos (real)
                    </Box>

                    <Box css={{ fontSize: '16px', color: '#2d3748', marginBottom: '16px' }}>
                      Localidades:
                    </Box>

                    <Box css={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {route.employees.map((employee: Employee) => {
                        const localityName = employee.personalData.addresses[0]?.location.name || 'Sin ubicación';
                        const isSelected = selectedLocalities.has(employee.id);
                        
                        return (
                          <Box
                            key={employee.id}
                            css={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '8px 12px',
                              backgroundColor: isSelected ? '#ebf8ff' : 'transparent',
                              borderRadius: '8px',
                              border: isSelected ? '1px solid #bee3f8' : '1px solid transparent'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleLocalityToggle(employee.id, route.id)}
                              disabled={isDisabled || false}
                              css={{ width: '16px', height: '16px' }}
                            />
                            <Box css={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <Box css={{ color: '#e53e3e' }}>📍</Box>
                              <Box css={{ fontSize: '14px', color: '#2d3748' }}>{localityName}</Box>
                            </Box>
                            <Box css={{
                              backgroundColor: '#e2e8f0',
                              color: '#4a5568',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '12px'
                            }}>
                              {/* Mostrar número real de clientes de esta localidad */}
                              {(() => {
                                if (!activeLoansData?.loans) return '0 clientes';
                                
                                const localityName = employee.personalData.addresses[0]?.location.name;
                                if (!localityName) return '0 clientes';
                                
                                // Contar clientes activos para esta localidad específica
                                const loansByClient: { [clientId: string]: any[] } = {};
                                
                                activeLoansData.loans.forEach((loan: ActiveLoan) => {
                                  const loanLocation = loan.borrower?.personalData?.addresses?.[0]?.location?.name || 
                                                     loan.lead?.personalData?.addresses?.[0]?.location?.name;
                                  
                                  if (loanLocation === localityName) {
                                    const clientId = loan.borrower?.id || loan.lead?.id;
                                    if (clientId) {
                                      if (!loansByClient[clientId]) {
                                        loansByClient[clientId] = [];
                                      }
                                      loansByClient[clientId].push(loan);
                                    }
                                  }
                                });
                                
                                const clientCount = Object.keys(loansByClient).length;
                                return `${clientCount} clientes`;
                              })()}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Modal de confirmación */}
          {isPreviewMode && (
            <Box css={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <Box css={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 20px 25px rgba(0, 0, 0, 0.1)'
              }}>
                <Box css={{ fontSize: '20px', fontWeight: '700', color: '#1a202c', marginBottom: '16px' }}>
                  Confirmar Movimiento
                </Box>
                
                <Box css={{ fontSize: '16px', color: '#4a5568', marginBottom: '24px' }}>
                  ¿Estás seguro de que quieres mover {pendingMoves.length} localidad(es) a la ruta destino?
                </Box>

                <Box css={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <Button
                    tone="passive"
                    weight="bold"
                    onClick={cancelChanges}
                  >
                    Cancelar
                  </Button>
                  <Button
                    tone="positive"
                    weight="bold"
                    onClick={executeMoves}
                    disabled={updateLoading}
                  >
                    {updateLoading ? 'Ejecutando...' : 'Confirmar'}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </PageContainer>
    </ProtectedRoute>
  );
};

export default AdministrarRutasPage;
