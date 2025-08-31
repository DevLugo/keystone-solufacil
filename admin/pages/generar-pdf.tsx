import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Button } from '@keystone-ui/button';
import { Select, TextInput } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { Box, Stack, Text, Heading, Card, Badge, Alert } from '@keystone-ui/core';
import { FaDownload, FaFilePdf, FaCalendarAlt, FaUser, FaRoute } from 'react-icons/fa';

// Query para obtener rutas
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;

// Query para obtener clientes
const GET_CLIENTS = gql`
  query GetClients($routeId: String, $searchTerm: String) {
    searchClients(searchTerm: $searchTerm, routeId: $routeId, limit: 100)
  }
`;

export default function GenerarPDFPage() {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [reportType, setReportType] = useState<string>('client-history');

  // Obtener rutas
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery(GET_ROUTES);

  // Obtener clientes
  const { data: clientsData, loading: clientsLoading, error: clientsError } = useQuery(GET_CLIENTS, {
    variables: { 
      routeId: selectedRoute || undefined,
      searchTerm: searchTerm || ' '
    },
    skip: !searchTerm
  });

  // Generar PDF de historial de cliente
  const generateClientHistoryPDF = async () => {
    if (!selectedClient) {
      alert('Por favor selecciona un cliente');
      return;
    }

    try {
      const response = await fetch('/api/generate-client-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: selectedClient
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historial-cliente-${selectedClient}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error al generar el PDF');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al generar el PDF');
    }
  };

  // Generar PDF de reporte financiero
  const generateFinancialReportPDF = async () => {
    if (!selectedRoute) {
      alert('Por favor selecciona una ruta');
      return;
    }

    try {
      const response = await fetch('/api/generate-financial-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          routeId: selectedRoute,
          year: new Date().getFullYear()
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-financiero-${selectedRoute}-${new Date().getFullYear()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error al generar el PDF');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al generar el PDF');
    }
  };

  if (routesLoading) return <LoadingDots label="Cargando rutas..." />;
  if (routesError) return <GraphQLErrorNotice errors={[routesError]} />;

  const routes = routesData?.routes || [];
  const clients = clientsData?.searchClients || [];

  return (
    <PageContainer header="Generar PDFs">
      <Box padding="large">
        <Stack gap="large">
          {/* Header */}
          <Card padding="large">
            <Stack gap="medium">
              <Heading level={3}>📄 Generador de PDFs</Heading>
              <Text>
                Genera reportes en PDF para clientes, rutas y análisis financieros
              </Text>
            </Stack>
          </Card>

          {/* Selección de tipo de reporte */}
          <Card padding="large">
            <Stack gap="medium">
              <Heading level={4}>🎯 Tipo de Reporte</Heading>
              <Box display="flex" gap="medium" flexWrap="wrap">
                <Button
                  tone={reportType === 'client-history' ? 'positive' : 'neutral'}
                  onClick={() => setReportType('client-history')}
                  icon={<FaUser />}
                >
                  Historial de Cliente
                </Button>
                <Button
                  tone={reportType === 'financial-report' ? 'positive' : 'neutral'}
                  onClick={() => setReportType('financial-report')}
                  icon={<FaFilePdf />}
                >
                  Reporte Financiero
                </Button>
              </Box>
            </Stack>
          </Card>

          {/* Configuración del reporte */}
          {reportType === 'client-history' && (
            <Card padding="large">
              <Stack gap="medium">
                <Heading level={4}>👤 Historial de Cliente</Heading>
                
                <Box display="flex" gap="medium" alignItems="center">
                  <FaRoute color="#3182ce" />
                  <Select
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    placeholder="Seleccionar ruta (opcional)"
                  >
                    <option value="">Todas las rutas</option>
                    {routes.map((route: any) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                  </Select>
                </Box>

                <Box display="flex" gap="medium" alignItems="center">
                  <FaUser color="#38a169" />
                  <TextInput
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar cliente por nombre..."
                    width="300px"
                  />
                </Box>

                {clientsLoading && <LoadingDots label="Buscando clientes..." />}
                
                {clients.length > 0 && (
                  <Box>
                    <Text size="small" weight="semibold" color="gray600" marginBottom="small">
                      Clientes encontrados:
                    </Text>
                    <Box display="flex" gap="small" flexWrap="wrap">
                      {clients.slice(0, 10).map((client: any) => (
                        <Button
                          key={client.id}
                          size="small"
                          tone={selectedClient === client.id ? 'positive' : 'neutral'}
                          onClick={() => setSelectedClient(client.id)}
                        >
                          {client.name}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                )}

                <Button
                  tone="positive"
                  weight="bold"
                  onClick={generateClientHistoryPDF}
                  icon={<FaDownload />}
                  disabled={!selectedClient}
                >
                  Generar PDF del Historial
                </Button>
              </Stack>
            </Card>
          )}

          {reportType === 'financial-report' && (
            <Card padding="large">
              <Stack gap="medium">
                <Heading level={4}>💰 Reporte Financiero</Heading>
                
                <Box display="flex" gap="medium" alignItems="center">
                  <FaRoute color="#3182ce" />
                  <Select
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    placeholder="Seleccionar ruta"
                  >
                    <option value="">Seleccionar ruta</option>
                    {routes.map((route: any) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                  </Select>
                </Box>

                <Box display="flex" gap="medium" alignItems="center">
                  <FaCalendarAlt color="#d69e2e" />
                  <Text size="medium">
                    Año: <strong>{new Date().getFullYear()}</strong>
                  </Text>
                </Box>

                <Alert tone="info">
                  <Text>
                    El reporte incluirá todas las transacciones, préstamos y análisis financiero 
                    de la ruta seleccionada para el año {new Date().getFullYear()}.
                  </Text>
                </Alert>

                <Button
                  tone="positive"
                  weight="bold"
                  onClick={generateFinancialReportPDF}
                  icon={<FaDownload />}
                  disabled={!selectedRoute}
                >
                  Generar Reporte Financiero
                </Button>
              </Stack>
            </Card>
          )}

          {/* Información adicional */}
          <Card padding="large" backgroundColor="gray50">
            <Stack gap="medium">
              <Heading level={4}>ℹ️ Información</Heading>
              <Text size="small">
                <strong>Historial de Cliente:</strong> Genera un PDF completo con el historial de préstamos, 
                pagos y calificaciones del cliente seleccionado.
              </Text>
              <Text size="small">
                <strong>Reporte Financiero:</strong> Crea un análisis financiero detallado de la ruta 
                incluyendo ingresos, gastos, préstamos y métricas de rendimiento.
              </Text>
              <Text size="small">
                Los PDFs se generan en tiempo real y se descargan automáticamente a tu dispositivo.
              </Text>
            </Stack>
          </Card>
        </Stack>
      </Box>
    </PageContainer>
  );
}
