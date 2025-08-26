import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Select } from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { DocumentThumbnail } from '../components/documents/DocumentThumbnail';
import { ImageModal } from '../components/documents/ImageModal';

// GraphQL Queries
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
      employees {
        personalData {
          addresses {
            location {
              id
              name
            }
          }
        }
      }
    }
  }
`;

const SEARCH_CLIENTS = gql`
  query SearchClients($searchTerm: String!, $routeId: String, $locationId: String, $limit: Int) {
    searchClients(searchTerm: $searchTerm, routeId: $routeId, locationId: $locationId, limit: $limit)
  }
`;

const GET_CLIENT_HISTORY = gql`
  query GetClientHistory($clientId: String!, $routeId: String, $locationId: String) {
    getClientHistory(clientId: $clientId, routeId: $routeId, locationId: $locationId)
  }
`;

const GET_CLIENT_DOCUMENTS = gql`
  query GetClientDocuments($clientId: String!) {
    documentPhotos(
      where: {
        OR: [
          { personalData: { id: { equals: $clientId } } },
          { loan: { borrower: { personalData: { id: { equals: $clientId } } } } },
          { loan: { lead: { personalData: { id: { equals: $clientId } } } } }
        ]
      }
      orderBy: { createdAt: desc }
    ) {
      id
      title
      description
      photoUrl
      publicId
      documentType
      createdAt
      personalData {
        id
        fullName
      }
      loan {
        id
        borrower {
          personalData {
            fullName
          }
        }
        lead {
          personalData {
            fullName
          }
        }
      }
    }
  }
`;

// Interfaces
interface ClientSearchResult {
  id: string;
  name: string;
  dui: string;
  phone: string;
  address: string;
  route: string;
  location: string;
  latestLoanDate: string | null;
  hasLoans: boolean;
  hasBeenCollateral: boolean;
  totalLoans: number;
  activeLoans: number;
  finishedLoans: number;
  collateralLoans: number;
}

interface LoanPayment {
  id: string;
  amount: number;
  receivedAt: string;
  receivedAtFormatted: string;
  type: string;
  paymentMethod: string;
  paymentNumber: number;
  balanceBeforePayment: number;
  balanceAfterPayment: number;
}

interface NoPaymentPeriod {
  id: string;
  startDate: string;
  endDate: string;
  startDateFormatted: string;
  endDateFormatted: string;
  weekCount: number;
  type: 'NO_PAYMENT_PERIOD';
}

interface LoanDetails {
  id: string;
  signDate: string;
  signDateFormatted: string;
  finishedDate?: string;
  finishedDateFormatted?: string;
  loanType: string;
  amountRequested: number;
  totalAmountDue: number;
  interestAmount: number;
  commission: number;
  totalPaid: number;
  pendingDebt: number;
  daysSinceSign: number;
  status: string;
  statusDescription: string;
  wasRenewed: boolean;
  weekDuration: number;
  rate: number;
  leadName: string;
  routeName: string;
  paymentsCount: number;
  payments: LoanPayment[];
  noPaymentPeriods: NoPaymentPeriod[];
  renewedFrom?: string;
  renewedTo?: string;
  avalName?: string;
  avalPhone?: string;
  clientName?: string; // Para préstamos como aval
  clientDui?: string; // Para préstamos como aval
}

interface ClientDocument {
  id: string;
  title: string;
  description: string;
  photoUrl: string;
  publicId: string;
  documentType: 'INE' | 'DOMICILIO' | 'PAGARE';
  createdAt: string;
  personalData: {
    id: string;
    fullName: string;
  };
  loan: {
    id: string;
    borrower: {
      personalData: {
        id: string;
        fullName: string;
      };
    };
    lead: {
      personalData: {
        id: string;
        fullName: string;
      };
    };
  };
}

interface ClientHistoryData {
  client: {
    id: string;
    fullName: string;
    dui: string;
    phones: string[];
    addresses: Array<{
      street: string;
      city: string;
      location: string;
      route: string;
    }>;
  };
  summary: {
    totalLoansAsClient: number;
    totalLoansAsCollateral: number;
    activeLoansAsClient: number;
    activeLoansAsCollateral: number;
    totalAmountRequestedAsClient: number;
    totalAmountPaidAsClient: number;
    currentPendingDebtAsClient: number;
    hasBeenClient: boolean;
    hasBeenCollateral: boolean;
  };
  loansAsClient: LoanDetails[];
  loansAsCollateral: LoanDetails[];
}

// Utility functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-SV', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'ACTIVO': return '#28a745';        // Verde - préstamo en curso
    case 'RENOVADO': return '#805ad5';      // Púrpura - fue renovado
    case 'TERMINADO': return '#2d3748';     // Gris oscuro - completado
    case 'PAGADO': return '#38a169';        // Verde oscuro - pagado completo
    case 'VENCIDO': return '#ffc107';       // Amarillo - fuera de plazo
    case 'ATRASADO': return '#ed8936';      // Naranja - atrasado pero no vencido
    case 'CARTERA MUERTA': return '#dc3545'; // Rojo - irrecuperable
    default: return '#6c757d';              // Gris - estado desconocido
  }
};

// ✅ NOTA: Los períodos sin pago ahora se calculan en el backend (getClientHistory)
// La función calculateNoPaymentPeriods se movió al GraphQL resolver para evitar duplicación

// Main Component
const HistorialClientePage: React.FC = () => {
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [showClientHistory, setShowClientHistory] = useState<boolean>(false);
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);
  
  // Estado para el modal de imagen
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    title: string;
    description: string;
    documentType: string;
    personType: string;
  }>({
    isOpen: false,
    imageUrl: '',
    title: '',
    description: '',
    documentType: '',
    personType: ''
  });

  // Estado para detectar si es mobile
  const [isMobile, setIsMobile] = useState(false);

  // Detectar tamaño de pantalla
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // GraphQL hooks
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);
  
  const [searchClients, { data: searchData, loading: searchLoading }] = useLazyQuery(SEARCH_CLIENTS);
  
  const [getClientHistory, { data: historyData, loading: historyLoading, error: historyError }] = useLazyQuery(GET_CLIENT_HISTORY);
  
  const [getClientDocuments, { data: documentsData, loading: documentsLoading }] = useLazyQuery(GET_CLIENT_DOCUMENTS);

  // Debug: Log cuando cambian los datos de documentos
  useEffect(() => {
    if (documentsData) {
      console.log('📄 Documentos obtenidos:', documentsData);
      console.log('📊 Total documentos:', documentsData.documentPhotos?.length || 0);
    }
  }, [documentsData]);

  // Options for selects using useMemo (como en el reporte que funciona)
  const routeOptions = useMemo(() => {
    if (!routesData?.routes) return [];
    return routesData.routes.map((route: any) => ({
      label: route.name,
      value: route.id
    }));
  }, [routesData]);

  const locationOptions = useMemo(() => {
    if (!selectedRoute?.employees) {
      console.log('⚠️ No hay empleados para:', selectedRoute);
      return [];
    }
    
    // Extraer localidades únicas de todos los empleados de la ruta
    const locationSet = new Set();
    const locationMap = new Map();
    
    selectedRoute.employees.forEach((employee: any) => {
      employee.personalData?.addresses?.forEach((address: any) => {
        if (address.location && address.location.id) {
          const locationId = address.location.id;
          if (!locationSet.has(locationId)) {
            locationSet.add(locationId);
            locationMap.set(locationId, {
              id: address.location.id,
              name: address.location.name
            });
          }
        }
      });
    });
    
    const options = Array.from(locationMap.values()).map((location: any) => ({
      label: location.name,
      value: location.id
    }));
    
    console.log('🎯 Empleados encontrados:', selectedRoute.employees.length);
    console.log('🏘️ Localidades extraídas:', Array.from(locationMap.values()));
    console.log('🎯 Opciones de localidades generadas:', options);
    return options;
  }, [selectedRoute]);

  // Search clients when search term changes
  useEffect(() => {
    if (searchTerm.length >= 2 && showAutocomplete) {
      const debounceTimer = setTimeout(() => {
        searchClients({
          variables: {
            searchTerm,
            routeId: selectedRoute?.id,
            locationId: selectedLocation?.id,
            limit: 20
          }
        });
      }, 300);

      return () => clearTimeout(debounceTimer);
    } else {
      setClientResults([]);
    }
  }, [searchTerm, selectedRoute, selectedLocation, searchClients, showAutocomplete]);

  useEffect(() => {
    if (searchData?.searchClients) {
      setClientResults(searchData.searchClients);
    }
  }, [searchData]);

  const handleClientSelect = (client: ClientSearchResult) => {
    setSelectedClient(client);
    setSearchTerm(client.name); // Mantener el nombre del cliente seleccionado en el input
    setClientResults([]);
    setShowAutocomplete(false); // Desactivar el autocomplete después de seleccionar
  };

  const handleGenerateReport = () => {
    if (selectedClient) {
      getClientHistory({
        variables: {
          clientId: selectedClient.id,
          routeId: selectedRoute?.id,
          locationId: selectedLocation?.id
        }
      });
      
      // Obtener documentos del cliente
      console.log('🔍 Buscando documentos para cliente:', selectedClient.id);
      getClientDocuments({
        variables: {
          clientId: selectedClient.id
        }
      });
      
      setShowClientHistory(true);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSelectedClient(null);
    setClientResults([]);
    setShowClientHistory(false);
    setShowAutocomplete(true); // Reactivar el autocomplete para nueva búsqueda
    // Limpiar también los datos del historial y documentos
    if (historyData) {
      // Forzar refetch limpio
      getClientHistory({
        variables: { clientId: '', routeId: '', locationId: '' }
      });
    }
    if (documentsData) {
      // Forzar refetch limpio
      getClientDocuments({
        variables: { clientId: '' }
      });
    }
  };

  const openImageModal = (document: ClientDocument, personType: string) => {
    setImageModal({
      isOpen: true,
      imageUrl: document.photoUrl,
      title: document.title,
      description: document.description || '',
      documentType: document.documentType,
      personType
    });
  };

  const getPersonTypeFromDocument = (document: ClientDocument, clientId: string): 'TITULAR' | 'AVAL' => {
    // Si el documento está directamente asociado al personalData del cliente
    if (document.personalData?.id === clientId) {
      return 'TITULAR';
    }
    
    // Si está asociado a un préstamo donde el cliente es el titular
    if (document.loan?.borrower?.personalData?.id === clientId) {
      return 'TITULAR';
    }
    
    // Si está asociado a un préstamo donde el cliente es el aval
    if (document.loan?.lead?.personalData?.id === clientId) {
      return 'AVAL';
    }
    
    return 'TITULAR'; // Por defecto
  };

  const handleExportPDF = async (historyData: ClientHistoryData) => {
    try {
      const response = await fetch('/export-client-history-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: historyData.client.id,
          clientName: historyData.client.fullName,
          clientDui: historyData.client.dui,
          clientPhones: historyData.client.phones,
          clientAddresses: historyData.client.addresses,
          summary: historyData.summary,
          loansAsClient: historyData.loansAsClient,
          loansAsCollateral: historyData.loansAsCollateral
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historial_${historyData.client.fullName.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Error al generar PDF');
        alert('Error al generar el PDF. Intente nuevamente.');
      }
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al exportar el PDF. Intente nuevamente.');
    }
  };

  const historyResult: ClientHistoryData | null = historyData?.getClientHistory || null;

  return (
    <PageContainer header="Historial de Cliente">
      <div style={{ 
        padding: isMobile ? '16px' : '24px', 
        maxWidth: '1400px', 
        margin: '0 auto'
      }}>
        <h1 style={{ 
          fontSize: isMobile ? '24px' : '28px', 
          fontWeight: 'bold', 
          marginBottom: isMobile ? '20px' : '24px',
          color: '#1a202c'
        }}>
          📋 Historial de Cliente
        </h1>

        {/* Filtros de búsqueda */}
        <div style={{
          backgroundColor: '#f7fafc',
          padding: '24px',
          borderRadius: '8px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#2d3748' }}>
            🔍 Búsqueda de Cliente
          </h2>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: isMobile ? '12px' : '16px', 
            marginBottom: '16px' 
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#4a5568' }}>
                Ruta (Opcional)
              </label>
              <Select
                value={routeOptions.find(opt => opt.value === selectedRoute?.id) || null}
                onChange={(option) => {
                  const route = routesData?.routes?.find((r: any) => r.id === option?.value);
                  console.log('🔍 Ruta seleccionada:', route);
                  console.log('👥 Empleados encontrados:', route?.employees?.length);
                  console.log('🏘️ Estructura empleados:', route?.employees);
                  setSelectedRoute(route || null);
                  setSelectedLocation(null); // Limpiar localidad cuando cambia la ruta
                }}
                options={routeOptions}
                placeholder="Seleccionar ruta..."
                isLoading={routesLoading}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#4a5568' }}>
                Localidad (Opcional)
              </label>
              <Select
                value={locationOptions.find((opt: any) => opt.value === selectedLocation?.id) || null}
                onChange={(option) => {
                  // Buscar la localidad en los empleados de la ruta
                  let foundLocation = null;
                  selectedRoute?.employees?.forEach((employee: any) => {
                    employee.personalData?.addresses?.forEach((address: any) => {
                      if (address.location && address.location.id === option?.value) {
                        foundLocation = address.location;
                      }
                    });
                  });
                  console.log('🏠 Localidad seleccionada:', foundLocation);
                  console.log('📍 Empleados disponibles:', selectedRoute?.employees?.length);
                  setSelectedLocation(foundLocation);
                }}
                options={locationOptions}
                placeholder="Seleccionar localidad..."
                isDisabled={!selectedRoute}
              />
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#4a5568' }}>
              Buscar Cliente (Nombre, DUI)
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowAutocomplete(true); // Activar autocomplete cuando se escribe
              }}
              onFocus={() => setShowAutocomplete(true)} // Activar autocomplete al hacer focus
              placeholder="Escriba nombre o DUI del cliente..."
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            />
            
            {/* Resultados de búsqueda */}
            {showAutocomplete && clientResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}>
                {clientResults.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => handleClientSelect(client)}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ fontWeight: '600', color: '#2d3748' }}>{client.name}</div>
                    <div style={{ fontSize: '12px', color: '#718096' }}>
                      📍 {client.location} | 📞 {client.phone} | 🏠 {client.route}
                    </div>
                    {client.latestLoanDate && (
                      <div style={{ fontSize: '11px', color: '#805ad5', marginTop: '2px' }}>
                        📅 Último préstamo: {client.latestLoanDate}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#4a5568', marginTop: '4px' }}>
                      {client.hasLoans && '✅ Cliente'} {client.hasBeenCollateral && '🤝 Aval'} 
                      {client.totalLoans > 0 && ` | 📊 Total: ${client.totalLoans}`}
                      {client.activeLoans > 0 && ` | 🟢 Activos: ${client.activeLoans}`}
                      {client.finishedLoans > 0 && ` | ✅ Finalizados: ${client.finishedLoans}`}
                      {client.collateralLoans > 0 && ` | 🤝 Como aval: ${client.collateralLoans}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {showAutocomplete && searchLoading && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, padding: '12px', backgroundColor: 'white', border: '1px solid #cbd5e0', borderRadius: '6px' }}>
                <LoadingDots label="Buscando clientes..." />
              </div>
            )}


          </div>

          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '8px' : '12px', 
            alignItems: 'center',
            flexDirection: isMobile ? 'column' : 'row',
            width: '100%'
          }}>
            <Button 
              onClick={handleGenerateReport}
              isDisabled={!selectedClient}
              style={{
                backgroundColor: selectedClient ? '#4299e1' : '#a0aec0',
                color: 'white',
                padding: isMobile ? '12px 16px' : '10px 20px',
                border: 'none',
                borderRadius: '6px',
                cursor: selectedClient ? 'pointer' : 'not-allowed',
                width: isMobile ? '100%' : 'auto',
                fontSize: isMobile ? '14px' : 'inherit'
              }}
            >
              📊 Generar Historial
            </Button>
            
            <Button 
              onClick={handleClearSearch}
              style={{
                backgroundColor: '#718096',
                color: 'white',
                padding: isMobile ? '12px 16px' : '10px 20px',
                border: 'none',
                borderRadius: '6px',
                width: isMobile ? '100%' : 'auto',
                fontSize: isMobile ? '14px' : 'inherit'
              }}
            >
              🗑️ Limpiar
            </Button>

            {showClientHistory && historyResult && (
              <Button 
                onClick={() => handleExportPDF(historyResult)}
                style={{
                  backgroundColor: '#38a169',
                  color: 'white',
                  padding: isMobile ? '12px 16px' : '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  marginLeft: isMobile ? '0px' : '8px',
                  width: isMobile ? '100%' : 'auto',
                  fontSize: isMobile ? '14px' : 'inherit'
                }}
              >
                📄 Exportar PDF
              </Button>
            )}

            {selectedClient && (
              <div style={{ 
                fontSize: isMobile ? '12px' : '14px', 
                color: '#4a5568',
                textAlign: isMobile ? 'center' : 'left',
                width: '100%'
              }}>
                Cliente seleccionado: <strong>{selectedClient.name}</strong> ({selectedClient.dui})
              </div>
            )}
          </div>
        </div>

        {/* Error display */}
        {historyError && (
          <GraphQLErrorNotice networkError={historyError.networkError} errors={historyError.graphQLErrors} />
        )}

        {/* Loading state */}
        {historyLoading && (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <LoadingDots label="Cargando historial del cliente..." />
            <p style={{ marginTop: '16px', color: '#718096' }}>Cargando historial del cliente...</p>
          </div>
        )}

        {/* Client History Display */}
        {showClientHistory && historyResult && (
          <div>
            {/* Client Info Header */}
            <div style={{
              backgroundColor: '#edf2f7',
              padding: '24px',
              borderRadius: '8px',
              marginBottom: '24px',
              border: '1px solid #cbd5e0'
            }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#2d3748' }}>
                👤 {historyResult.client.fullName}
              </h2>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: isMobile ? '12px' : '16px' 
              }}>
                <div>
                  <p><strong>DUI:</strong> {historyResult.client.dui}</p>
                  <p><strong>Teléfonos:</strong> {historyResult.client.phones.join(', ')}</p>
                </div>
                <div>
                  {historyResult.client.addresses.map((addr, index) => (
                    <p key={index}><strong>Dirección:</strong> {addr.city}, {addr.location} ({addr.route})</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: isMobile ? '12px' : '16px',
              marginBottom: isMobile ? '24px' : '32px'
            }}>
              <div style={{
                backgroundColor: historyResult.summary.hasBeenClient ? '#e6fffa' : '#f7fafc',
                padding: isMobile ? '16px' : '20px',
                borderRadius: '8px',
                border: `2px solid ${historyResult.summary.hasBeenClient ? '#38b2ac' : '#cbd5e0'}`,
                textAlign: 'center'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
                  👤 Como Cliente
                </h3>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#38b2ac' }}>
                  {historyResult.summary.totalLoansAsClient}
                </p>
                <p style={{ fontSize: '12px', color: '#718096' }}>
                  Activos: {historyResult.summary.activeLoansAsClient}
                </p>
              </div>

              <div style={{
                backgroundColor: historyResult.summary.hasBeenCollateral ? '#fff5f5' : '#f7fafc',
                padding: '20px',
                borderRadius: '8px',
                border: `2px solid ${historyResult.summary.hasBeenCollateral ? '#f56565' : '#cbd5e0'}`,
                textAlign: 'center'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
                  🤝 Como Aval
                </h3>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f56565' }}>
                  {historyResult.summary.totalLoansAsCollateral}
                </p>
                <p style={{ fontSize: '12px', color: '#718096' }}>
                  Activos: {historyResult.summary.activeLoansAsCollateral}
                </p>
              </div>

              <div style={{
                backgroundColor: '#f0fff4',
                padding: '20px',
                borderRadius: '8px',
                border: '2px solid #48bb78',
                textAlign: 'center'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
                  💰 Total Prestado
                </h3>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#48bb78' }}>
                  {formatCurrency(historyResult.summary.totalAmountRequestedAsClient)}
                </p>
              </div>

              <div style={{
                backgroundColor: '#fffbf0',
                padding: '20px',
                borderRadius: '8px',
                border: '2px solid #ed8936',
                textAlign: 'center'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
                  💳 Total Pagado
                </h3>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#ed8936' }}>
                  {formatCurrency(historyResult.summary.totalAmountPaidAsClient)}
                </p>
              </div>

              <div style={{
                backgroundColor: historyResult.summary.currentPendingDebtAsClient > 0 ? '#fed7e2' : '#f0fff4',
                padding: '20px',
                borderRadius: '8px',
                border: `2px solid ${historyResult.summary.currentPendingDebtAsClient > 0 ? '#f56565' : '#48bb78'}`,
                textAlign: 'center'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
                  💰 Deuda Pendiente Total
                </h3>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: historyResult.summary.currentPendingDebtAsClient > 0 ? '#f56565' : '#48bb78' }}>
                  {formatCurrency(historyResult.summary.currentPendingDebtAsClient)}
                </p>
              </div>
            </div>

            {/* Documentos del Cliente */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 'bold', 
                marginBottom: '16px',
                color: '#2d3748',
                borderBottom: '2px solid #805ad5',
                paddingBottom: '8px'
              }}>
                📷 Documentos del Cliente
              </h3>

              {/* Estado de carga */}
              {documentsLoading && (
                <div style={{
                  textAlign: 'center',
                  padding: '32px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <LoadingDots label="Cargando documentos..." />
                  <p style={{ marginTop: '16px', color: '#718096', fontSize: '14px' }}>
                    Buscando documentos asociados al cliente...
                  </p>
                </div>
              )}

              {/* Documentos encontrados */}
              {!documentsLoading && documentsData?.documentPhotos && documentsData.documentPhotos.length > 0 && (
                <>
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#718096', 
                    marginBottom: '16px',
                    fontStyle: 'italic'
                  }}>
                    💡 Haz clic en cualquier documento para ver la imagen completa
                  </p>

                                  <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: isMobile ? '12px' : '16px',
                  padding: isMobile ? '16px' : '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                    {documentsData.documentPhotos.map((document: ClientDocument) => {
                      const personType = getPersonTypeFromDocument(document, historyResult.client.id);
                      return (
                        <DocumentThumbnail
                          key={document.id}
                          type={document.documentType}
                          personType={personType}
                          imageUrl={document.photoUrl}
                          publicId={document.publicId}
                          onImageClick={() => openImageModal(document, personType)}
                          onUploadClick={() => {}} // No permitir subir desde aquí
                          size="medium"
                        />
                      );
                    })}
                  </div>
                </>
              )}

              {/* Sin documentos */}
              {!documentsLoading && (!documentsData?.documentPhotos || documentsData.documentPhotos.length === 0) && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    color: '#a0aec0'
                  }}>
                    📷
                  </div>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    marginBottom: '8px', 
                    color: '#4a5568' 
                  }}>
                    No se encontraron documentos
                  </h4>
                  <p style={{ 
                    fontSize: '14px', 
                    color: '#718096', 
                    marginBottom: '16px',
                    maxWidth: '400px',
                    margin: '0 auto'
                  }}>
                    Este cliente no tiene documentos asociados (INE, comprobante de domicilio, pagarés, etc.)
                  </p>
                  <div style={{
                    fontSize: '12px',
                    color: '#a0aec0',
                    backgroundColor: '#f1f5f9',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    display: 'inline-block'
                  }}>
                    💡 Los documentos se pueden agregar desde la página "Documentos Personales"
                  </div>
                </div>
              )}

              {/* Información adicional */}
              <div style={{
                fontSize: '11px',
                color: '#718096',
                marginTop: '12px',
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                {documentsData?.documentPhotos && documentsData.documentPhotos.length > 0 ? (
                  `Total de documentos: ${documentsData.documentPhotos.length}`
                ) : (
                  'Estado: Sin documentos asociados'
                )}
              </div>
            </div>

            {/* Loans as Client */}
            {historyResult.loansAsClient.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold', 
                  marginBottom: '16px',
                  color: '#2d3748',
                  borderBottom: '2px solid #38b2ac',
                  paddingBottom: '8px'
                }}>
                  👤 Préstamos como Cliente ({historyResult.loansAsClient.length})
                </h3>
                
                <p style={{ 
                  fontSize: '12px', 
                  color: '#718096', 
                  marginBottom: '16px',
                  fontStyle: 'italic'
                }}>
                  💡 Haz clic en cualquier fila para ver el detalle completo de pagos y fechas
                </p>
                
                <div style={{ 
                  overflowX: 'auto',
                  fontSize: isMobile ? '12px' : 'inherit'
                }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse', 
                    backgroundColor: 'white', 
                    borderRadius: '8px', 
                    overflow: 'hidden', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    minWidth: isMobile ? '800px' : 'auto'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f7fafc' }}>
                        <th style={{ 
                          padding: isMobile ? '8px' : '12px', 
                          textAlign: 'left', 
                          borderBottom: '2px solid #e2e8f0', 
                          fontSize: isMobile ? '10px' : '12px', 
                          fontWeight: '600' 
                        }}>FECHA</th>
                        <th style={{ 
                          padding: isMobile ? '8px' : '12px', 
                          textAlign: 'left', 
                          borderBottom: '2px solid #e2e8f0', 
                          fontSize: isMobile ? '10px' : '12px', 
                          fontWeight: '600' 
                        }}>TIPO</th>
                        <th style={{ 
                          padding: isMobile ? '8px' : '12px', 
                          textAlign: 'right', 
                          borderBottom: '2px solid #e2e8f0', 
                          fontSize: isMobile ? '10px' : '12px', 
                          fontWeight: '600' 
                        }}>PRESTADO</th>
                        <th style={{ 
                          padding: isMobile ? '8px' : '12px', 
                          textAlign: 'right', 
                          borderBottom: '2px solid #e2e8f0', 
                          fontSize: isMobile ? '10px' : '12px', 
                          fontWeight: '600' 
                        }}>TOTAL A PAGAR</th>
                        <th style={{ 
                          padding: isMobile ? '8px' : '12px', 
                          textAlign: 'right', 
                          borderBottom: '2px solid #e2e8f0', 
                          fontSize: isMobile ? '10px' : '12px', 
                          fontWeight: '600' 
                        }}>PAGADO</th>
                        <th style={{ 
                          padding: isMobile ? '8px' : '12px', 
                          textAlign: 'right', 
                          borderBottom: '2px solid #e2e8f0', 
                          fontSize: isMobile ? '10px' : '12px', 
                          fontWeight: '600' 
                        }}>DEUDA PENDIENTE</th>
                        <th style={{ 
                          padding: isMobile ? '8px' : '12px', 
                          textAlign: 'center', 
                          borderBottom: '2px solid #e2e8f0', 
                          fontSize: isMobile ? '10px' : '12px', 
                          fontWeight: '600' 
                        }}>ESTADO</th>
                        <th style={{ 
                          padding: isMobile ? '8px' : '12px', 
                          textAlign: 'left', 
                          borderBottom: '2px solid #e2e8f0', 
                          fontSize: isMobile ? '10px' : '12px', 
                          fontWeight: '600' 
                        }}>LÍDER</th>
                        <th style={{ 
                          padding: isMobile ? '8px' : '12px', 
                          textAlign: 'center', 
                          borderBottom: '2px solid #e2e8f0', 
                          fontSize: isMobile ? '10px' : '12px', 
                          fontWeight: '600' 
                        }}>DÍAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyResult.loansAsClient.map((loan, index) => (
                        <React.Fragment key={loan.id}>
                          <tr style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                              onClick={() => {
                                const expandedRows = (document.querySelector(`#loan-details-${loan.id}`) as HTMLElement);
                                if (expandedRows) {
                                  expandedRows.style.display = expandedRows.style.display === 'none' ? 'table-row' : 'none';
                                }
                              }}>
                            <td style={{ padding: '12px', fontSize: '13px' }}>
                              <div>{loan.signDateFormatted || formatDate(loan.signDate)}</div>
                              {loan.finishedDateFormatted && (
                                <div style={{ fontSize: '11px', color: '#718096' }}>
                                  Fin: {loan.finishedDateFormatted}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px' }}>{loan.loanType}</td>
                            <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', fontWeight: '600', color: '#2b6cb0' }}>
                              {formatCurrency(loan.amountRequested)}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right' }}>
                              {formatCurrency(loan.totalAmountDue)}
                              {loan.interestAmount > 0 && (
                                <div style={{ fontSize: '10px', color: '#805ad5' }}>
                                  +{formatCurrency(loan.interestAmount)} interés ({loan.rate}%)
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', fontWeight: '600', color: '#38a169' }}>
                              {formatCurrency(loan.totalPaid)}
                              {loan.paymentsCount > 0 && (
                                <div style={{ fontSize: '10px', color: '#718096' }}>
                                  {loan.paymentsCount} pagos
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', fontWeight: '600', color: loan.pendingDebt > 0 ? '#e53e3e' : '#38a169' }}>
                              {formatCurrency(loan.pendingDebt)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                color: 'white',
                                backgroundColor: getStatusColor(loan.status)
                              }}>
                                {loan.status}
                              </span>
                              {loan.wasRenewed && (
                                <div style={{ fontSize: '10px', color: '#805ad5', marginTop: '2px' }}>
                                  🔄 Renovado
                                </div>
                              )}
                              {loan.statusDescription && (
                                <div style={{ fontSize: '10px', color: '#718096', marginTop: '2px', maxWidth: '100px', lineHeight: '1.2' }}>
                                  {loan.statusDescription}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: '12px', color: '#718096' }}>
                              {loan.leadName}
                              <div style={{ fontSize: '10px' }}>{loan.routeName}</div>
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>
                              {loan.daysSinceSign}
                              <div style={{ fontSize: '10px', color: '#718096' }}>días</div>
                            </td>
                          </tr>
                          
                          {/* Detalles expandibles de pagos */}
                          <tr id={`loan-details-${loan.id}`} style={{ display: 'none', backgroundColor: '#f8fafc' }}>
                            <td colSpan={9} style={{ padding: '16px' }}>
                              <div style={{ maxWidth: '100%' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#2d3748' }}>
                                  📋 Detalle de Pagos - Préstamo #{loan.id.slice(-8)}
                                </h4>
                                
                                {loan.payments && loan.payments.length > 0 ? (
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#e2e8f0' }}>
                                          <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                                          <th style={{ padding: '8px', textAlign: 'left' }}>Fecha</th>
                                          <th style={{ padding: '8px', textAlign: 'right' }}>Monto</th>
                                          <th style={{ padding: '8px', textAlign: 'left' }}>Método</th>
                                                                                     <th style={{ padding: '8px', textAlign: 'right' }}>Deuda Antes</th>
                                           <th style={{ padding: '8px', textAlign: 'right' }}>Deuda Después</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {loan.payments.map((payment) => (
                                          <tr key={payment.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '6px' }}>{payment.paymentNumber}</td>
                                            <td style={{ padding: '6px' }}>{payment.receivedAtFormatted}</td>
                                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: '600', color: '#38a169' }}>
                                              {formatCurrency(payment.amount)}
                                            </td>
                                            <td style={{ padding: '6px' }}>{payment.paymentMethod}</td>
                                            <td style={{ padding: '6px', textAlign: 'right' }}>
                                              {formatCurrency(payment.balanceBeforePayment)}
                                            </td>
                                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: '600', color: payment.balanceAfterPayment === 0 ? '#38a169' : '#e53e3e' }}>
                                              {formatCurrency(payment.balanceAfterPayment)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p style={{ color: '#718096', fontStyle: 'italic' }}>Sin pagos registrados</p>
                                )}

                                {/* ✅ NUEVA SECCIÓN: Períodos sin pago */}
                                {loan.noPaymentPeriods && loan.noPaymentPeriods.length > 0 && (
                                  <div style={{ marginTop: '16px' }}>
                                    <h5 style={{ 
                                      fontSize: '14px', 
                                      fontWeight: '600', 
                                      marginBottom: '8px', 
                                      color: '#e53e3e',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}>
                                      ⚠️ Períodos sin pago ({loan.noPaymentPeriods.length})
                                    </h5>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {loan.noPaymentPeriods.map((period: NoPaymentPeriod) => (
                                        <div 
                                          key={period.id} 
                                          style={{ 
                                            backgroundColor: '#fed7e2', 
                                            padding: '8px 12px', 
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            border: '1px solid #fbb6ce',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                          }}
                                        >
                                          <span style={{ fontWeight: '500', color: '#742a2a' }}>
                                            {period.weekCount === 1 
                                              ? `📅 ${period.startDateFormatted} (1 semana)`
                                              : `📅 ${period.startDateFormatted} hasta ${period.endDateFormatted} (${period.weekCount} semanas)`
                                            }
                                          </span>
                                          <span style={{ 
                                            fontSize: '10px', 
                                            color: '#e53e3e', 
                                            fontWeight: '600',
                                            backgroundColor: '#fed7e2',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            border: '1px solid #f56565'
                                          }}>
                                            SIN PAGO
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Información adicional */}
                                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '11px', color: '#4a5568' }}>
                                  {loan.avalName && (
                                    <div>👥 <strong>Aval:</strong> {loan.avalName}</div>
                                  )}
                                  {loan.renewedFrom && (
                                    <div>🔄 <strong>Renovación de:</strong> {loan.renewedFrom}</div>
                                  )}
                                  {loan.renewedTo && (
                                    <div>➡️ <strong>Renovado como:</strong> {loan.renewedTo}</div>
                                  )}
                                  <div>💰 <strong>Prestado:</strong> {formatCurrency(loan.amountRequested)}</div>
                                  <div>💸 <strong>Total a pagar:</strong> {formatCurrency(loan.totalAmountDue)}</div>
                                  <div>📊 <strong>Intereses:</strong> {formatCurrency(loan.interestAmount)}</div>
                                  <div>⏱️ <strong>Duración:</strong> {loan.weekDuration} semanas</div>
                                  <div>📈 <strong>Tasa:</strong> {loan.rate}%</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Loans as Collateral */}
            {historyResult.loansAsCollateral.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold', 
                  marginBottom: '16px',
                  color: '#2d3748',
                  borderBottom: '2px solid #f56565',
                  paddingBottom: '8px'
                }}>
                  🤝 Préstamos como Aval ({historyResult.loansAsCollateral.length})
                </h3>
                
                <p style={{ 
                  fontSize: '12px', 
                  color: '#718096', 
                  marginBottom: '16px',
                  fontStyle: 'italic'
                }}>
                  💡 Haz clic en cualquier fila para ver el detalle completo de pagos del préstamo donde fuiste aval
                </p>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fed7e2' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '600' }}>CLIENTE</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '600' }}>FECHA</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '600' }}>TIPO</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '600' }}>PRESTADO</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '600' }}>PAGADO</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '600' }}>DEUDA PENDIENTE</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '600' }}>ESTADO</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '12px', fontWeight: '600' }}>LÍDER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyResult.loansAsCollateral.map((loan) => (
                        <React.Fragment key={loan.id}>
                          <tr style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                              onClick={() => {
                                const expandedRows = (document.querySelector(`#collateral-loan-details-${loan.id}`) as HTMLElement);
                                if (expandedRows) {
                                  expandedRows.style.display = expandedRows.style.display === 'none' ? 'table-row' : 'none';
                                }
                              }}>
                            <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600' }}>
                              {loan.clientName}
                              <div style={{ fontSize: '11px', color: '#718096' }}>DUI: {loan.clientDui}</div>
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px' }}>
                              <div>{loan.signDateFormatted || formatDate(loan.signDate)}</div>
                              {loan.finishedDateFormatted && (
                                <div style={{ fontSize: '11px', color: '#718096' }}>
                                  Fin: {loan.finishedDateFormatted}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px' }}>{loan.loanType}</td>
                            <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', fontWeight: '600', color: '#2b6cb0' }}>
                              {formatCurrency(loan.amountRequested)}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', fontWeight: '600', color: '#38a169' }}>
                              {formatCurrency(loan.totalPaid)}
                              {loan.paymentsCount > 0 && (
                                <div style={{ fontSize: '10px', color: '#718096' }}>
                                  {loan.paymentsCount} pagos
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', fontWeight: '600', color: loan.pendingDebt > 0 ? '#e53e3e' : '#38a169' }}>
                              {formatCurrency(loan.pendingDebt)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                color: 'white',
                                backgroundColor: getStatusColor(loan.status)
                              }}>
                                {loan.status}
                              </span>
                              {loan.wasRenewed && (
                                <div style={{ fontSize: '10px', color: '#805ad5', marginTop: '2px' }}>
                                  🔄 Renovado
                                </div>
                              )}
                              {loan.statusDescription && (
                                <div style={{ fontSize: '10px', color: '#718096', marginTop: '2px', maxWidth: '100px', lineHeight: '1.2' }}>
                                  {loan.statusDescription}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: '12px', color: '#718096' }}>
                              {loan.leadName}
                              <div style={{ fontSize: '10px' }}>{loan.routeName}</div>
                            </td>
                          </tr>
                          
                          {/* Detalles expandibles de pagos para préstamos como aval */}
                          <tr id={`collateral-loan-details-${loan.id}`} style={{ display: 'none', backgroundColor: '#f8fafc' }}>
                            <td colSpan={8} style={{ padding: '16px' }}>
                              <div style={{ maxWidth: '100%' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#2d3748' }}>
                                  🤝 Detalle de Pagos (Como Aval) - Préstamo #{loan.id.slice(-8)}
                                </h4>
                                
                                {loan.payments && loan.payments.length > 0 ? (
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#e2e8f0' }}>
                                          <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                                          <th style={{ padding: '8px', textAlign: 'left' }}>Fecha</th>
                                          <th style={{ padding: '8px', textAlign: 'right' }}>Monto</th>
                                          <th style={{ padding: '8px', textAlign: 'left' }}>Método</th>
                                          <th style={{ padding: '8px', textAlign: 'right' }}>Deuda Antes</th>
                                          <th style={{ padding: '8px', textAlign: 'right' }}>Deuda Después</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {loan.payments.map((payment) => (
                                          <tr key={payment.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '6px' }}>{payment.paymentNumber}</td>
                                            <td style={{ padding: '6px' }}>{payment.receivedAtFormatted}</td>
                                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: '600', color: '#38a169' }}>
                                              {formatCurrency(payment.amount)}
                                            </td>
                                            <td style={{ padding: '6px' }}>{payment.paymentMethod}</td>
                                            <td style={{ padding: '6px', textAlign: 'right' }}>
                                              {formatCurrency(payment.balanceBeforePayment)}
                                            </td>
                                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: '600', color: payment.balanceAfterPayment === 0 ? '#38a169' : '#e53e3e' }}>
                                              {formatCurrency(payment.balanceAfterPayment)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p style={{ color: '#718096', fontStyle: 'italic' }}>Sin pagos registrados</p>
                                )}

                                {/* ✅ NUEVA SECCIÓN: Períodos sin pago (para préstamos como aval) */}
                                {loan.noPaymentPeriods && loan.noPaymentPeriods.length > 0 && (
                                  <div style={{ marginTop: '16px' }}>
                                    <h5 style={{ 
                                      fontSize: '14px', 
                                      fontWeight: '600', 
                                      marginBottom: '8px', 
                                      color: '#e53e3e',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}>
                                      ⚠️ Períodos sin pago ({loan.noPaymentPeriods.length})
                                    </h5>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {loan.noPaymentPeriods.map((period: NoPaymentPeriod) => (
                                        <div 
                                          key={period.id} 
                                          style={{ 
                                            backgroundColor: '#fed7e2', 
                                            padding: '8px 12px', 
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            border: '1px solid #fbb6ce',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                          }}
                                        >
                                          <span style={{ fontWeight: '500', color: '#742a2a' }}>
                                            {period.weekCount === 1 
                                              ? `📅 ${period.startDateFormatted} (1 semana)`
                                              : `📅 ${period.startDateFormatted} hasta ${period.endDateFormatted} (${period.weekCount} semanas)`
                                            }
                                          </span>
                                          <span style={{ 
                                            fontSize: '10px', 
                                            color: '#e53e3e', 
                                            fontWeight: '600',
                                            backgroundColor: '#fed7e2',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            border: '1px solid #f56565'
                                          }}>
                                            SIN PAGO
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Información adicional para préstamos como aval */}
                                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '11px', color: '#4a5568' }}>
                                  <div>👤 <strong>Cliente Principal:</strong> {loan.clientName}</div>
                                  {loan.renewedFrom && (
                                    <div>🔄 <strong>Renovación de:</strong> {loan.renewedFrom}</div>
                                  )}
                                  {loan.renewedTo && (
                                    <div>➡️ <strong>Renovado como:</strong> {loan.renewedTo}</div>
                                  )}
                                  <div>💰 <strong>Prestado:</strong> {formatCurrency(loan.amountRequested)}</div>
                                  <div>💸 <strong>Total a pagar:</strong> {formatCurrency(loan.totalAmountDue)}</div>
                                  <div>📊 <strong>Intereses:</strong> {formatCurrency(loan.interestAmount)}</div>
                                  <div>⏱️ <strong>Duración:</strong> {loan.weekDuration} semanas</div>
                                  <div>📈 <strong>Tasa:</strong> {loan.rate}%</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No data message */}
            {historyResult.loansAsClient.length === 0 && historyResult.loansAsCollateral.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '48px',
                backgroundColor: '#f7fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <p style={{ fontSize: '18px', color: '#718096', marginBottom: '8px' }}>📄 Sin historial crediticio</p>
                <p style={{ fontSize: '14px', color: '#a0aec0' }}>
                  Este cliente no tiene préstamos registrados ni como cliente principal ni como aval.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Modal de imagen */}
        <ImageModal
          isOpen={imageModal.isOpen}
          onClose={() => setImageModal({ ...imageModal, isOpen: false })}
          imageUrl={imageModal.imageUrl}
          title={imageModal.title}
          description={imageModal.description}
          documentType={imageModal.documentType}
          personType={imageModal.personType}
        />
      </div>
    </PageContainer>
  );
};

export default HistorialClientePage; 