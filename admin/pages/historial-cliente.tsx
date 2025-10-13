import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useLazyQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Select } from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { DocumentThumbnail } from '../components/documents/DocumentThumbnail';
import { ImageModal } from '../components/documents/ImageModal';
import { generatePaymentChronology, PaymentChronologyItem } from '../utils/paymentChronology';
import { useAuth } from '../hooks/useAuth';

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

const MERGE_CLIENTS = gql`
  mutation MergeClients($primaryClientId: ID!, $secondaryClientId: ID!) {
    mergeClients(primaryClientId: $primaryClientId, secondaryClientId: $secondaryClientId)
  }
`;

// Interfaces
interface ClientSearchResult {
  id: string;
  name: string;
  clientCode: string; // Cambiado de dui a clientCode
  phone: string;
  address: string;
  route: string;
  location: string;
  municipality: string;
  state: string;
  city: string; // En realidad es la dirección (street)
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
    clientCode: string; // Cambiado de dui a clientCode
    phones: string[];
    addresses: Array<{
      street: string;
      city: string;
      location: string;
      route: string;
    }>;
    leader: {
      name: string;
      route: string;
      location: string;
      municipality: string;
      state: string;
      phone: string;
    };
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
  // Agregar estilos CSS para animaciones
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes modalSlideIn {
        from {
          opacity: 0;
          transform: scale(0.9) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const { isAdmin, canMergeClients } = useAuth();

  // Función para calcular la distancia de Levenshtein (diferencias entre strings)
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Inicializar matriz
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // Llenar matriz
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // sustitución
            matrix[i][j - 1] + 1,     // inserción
            matrix[i - 1][j] + 1      // eliminación
          );
        }
      }
    }

    return matrix[len2][len1];
  };

  // Función para detectar posibles duplicados
  const findPotentialDuplicates = (clients: ClientSearchResult[]): Array<{client1: ClientSearchResult, client2: ClientSearchResult, similarity: number}> => {
    const duplicates: Array<{client1: ClientSearchResult, client2: ClientSearchResult, similarity: number}> = [];
    
    for (let i = 0; i < clients.length; i++) {
      for (let j = i + 1; j < clients.length; j++) {
        const client1 = clients[i];
        const client2 = clients[j];
        
        // Normalizar nombres (remover acentos, convertir a mayúsculas)
        const name1 = client1.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const name2 = client2.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        
        // Calcular distancia de Levenshtein
        const distance = levenshteinDistance(name1, name2);
        const maxLength = Math.max(name1.length, name2.length);
        const similarity = ((maxLength - distance) / maxLength) * 100;
        
        // Considerar duplicado si la similitud es >= 85% (máximo 2-3 diferencias en nombres cortos)
        if (similarity >= 85 && distance <= 3) {
          duplicates.push({
            client1,
            client2,
            similarity: Math.round(similarity)
          });
        }
      }
    }
    
    // Ordenar por similitud descendente
    return duplicates.sort((a, b) => b.similarity - a.similarity);
  };
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [showClientHistory, setShowClientHistory] = useState<boolean>(false);
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<Array<{client1: ClientSearchResult, client2: ClientSearchResult, similarity: number}>>([]);
  const [showDuplicates, setShowDuplicates] = useState<boolean>(false);
  
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
  
  // Estado para el toggle de PDF detallado
  const [showDetailedPDF, setShowDetailedPDF] = useState(false);

  // Estados para fusión de clientes
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeClientsList, setMergeClientsList] = useState<ClientSearchResult[]>([]);
  const [mergeSearchTerm, setMergeSearchTerm] = useState<string>('');
  const [mergeClientResults, setMergeClientResults] = useState<ClientSearchResult[]>([]);
  const [showMergeAutocomplete, setShowMergeAutocomplete] = useState<boolean>(false);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);

  // Estados para modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'warning' | 'danger' | 'info';
  } | null>(null);

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
  
  const [mergeClientsMutation, { loading: mergeLoading }] = useMutation(MERGE_CLIENTS);

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
            routeId: null, // No filtrar por ruta
            locationId: null, // No filtrar por localidad
            limit: 20
          }
        });
      }, 300);

      return () => clearTimeout(debounceTimer);
    } else {
      setClientResults([]);
    }
  }, [searchTerm, searchClients, showAutocomplete]);

  useEffect(() => {
    if (searchData?.searchClients) {
      setClientResults(searchData.searchClients);
      // Analizar duplicados cuando se obtienen resultados de búsqueda
      analyzeDuplicates(searchData.searchClients);
    }
  }, [searchData]);

  // Search clients for merge modal
  useEffect(() => {
    if (mergeSearchTerm.length >= 2 && showMergeAutocomplete) {
      const debounceTimer = setTimeout(() => {
        searchClients({
          variables: {
            searchTerm: mergeSearchTerm,
            routeId: null, // No filtrar por ruta
            locationId: null, // No filtrar por localidad
            limit: 20
          }
        });
      }, 300);

      return () => clearTimeout(debounceTimer);
    } else {
      setMergeClientResults([]);
    }
  }, [mergeSearchTerm, searchClients, showMergeAutocomplete]);

  useEffect(() => {
    if (searchData?.searchClients && showMergeModal) {
      setMergeClientResults(searchData.searchClients);
    }
  }, [searchData, showMergeModal]);

  const handleClientSelect = (client: ClientSearchResult) => {
    setSelectedClient(client);
    setSearchTerm(client.name); // Mantener el nombre del cliente seleccionado en el input
    setClientResults([]);
    setShowAutocomplete(false); // Desactivar el autocomplete después de seleccionar
  };

  // Función para analizar duplicados en los resultados de búsqueda
  const analyzeDuplicates = (results: ClientSearchResult[]) => {
    if (results.length > 1) {
      const duplicates = findPotentialDuplicates(results);
      setPotentialDuplicates(duplicates);
    } else {
      setPotentialDuplicates([]);
    }
  };

  const handleGenerateReport = () => {
    if (selectedClient) {
      getClientHistory({
        variables: {
          clientId: selectedClient.id,
          routeId: null, // No filtrar por ruta
          locationId: null // No filtrar por localidad
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

  // Handlers para fusión de clientes
  const handleOpenMergeModal = () => {
    if (!selectedClient) {
      showConfirmation({
        title: 'Error',
        message: 'No hay cliente seleccionado para fusionar',
        onConfirm: () => {},
        confirmText: 'Entendido',
        type: 'warning'
      });
      return;
    }

    // Convertir el cliente seleccionado al formato ClientSearchResult
    const currentClient: ClientSearchResult = {
      id: selectedClient.id,
      name: selectedClient.name,
      clientCode: selectedClient.clientCode,
      phone: selectedClient.phone || 'N/A',
      address: selectedClient.address || 'N/A',
      route: selectedClient.route || 'N/A',
      location: selectedClient.location || 'N/A',
      municipality: selectedClient.municipality || 'N/A',
      state: selectedClient.state || 'N/A',
      city: selectedClient.city || 'N/A',
      latestLoanDate: selectedClient.latestLoanDate || null,
      hasLoans: selectedClient.hasLoans || false,
      hasBeenCollateral: selectedClient.hasBeenCollateral || false,
      totalLoans: selectedClient.totalLoans || 0,
      activeLoans: selectedClient.activeLoans || 0,
      finishedLoans: selectedClient.finishedLoans || 0,
      collateralLoans: selectedClient.collateralLoans || 0
    };

    setShowMergeModal(true);
    setMergeClientsList([currentClient]); // Cargar el cliente actual por defecto
    setSelectedPrimaryId(currentClient.id); // Marcarlo como principal por defecto
    setMergeSearchTerm('');
    setMergeClientResults([]);
    setShowMergeAutocomplete(false);
  };

  const handleCloseMergeModal = () => {
    setShowMergeModal(false);
    setMergeClientsList([]);
    setMergeSearchTerm('');
    setMergeClientResults([]);
    setShowMergeAutocomplete(false);
    setSelectedPrimaryId(null);
  };

  const handleMergeClientSelect = (client: ClientSearchResult) => {
    // Verificar si el cliente ya está seleccionado
    const isAlreadySelected = mergeClientsList.some(c => c.id === client.id);
    
    if (!isAlreadySelected && mergeClientsList.length < 2) {
      setMergeClientsList([...mergeClientsList, client]);
      setMergeSearchTerm('');
    }
    setMergeClientResults([]);
    setShowMergeAutocomplete(false);
  };

  const handleRemoveMergeClient = (clientId: string) => {
    setMergeClientsList(mergeClientsList.filter(c => c.id !== clientId));
    if (selectedPrimaryId === clientId) {
      setSelectedPrimaryId(null);
    }
  };

  const handleSetPrimaryClient = (clientId: string) => {
    setSelectedPrimaryId(clientId);
  };

  // Funciones para modal de confirmación
  const showConfirmation = (data: {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'warning' | 'danger' | 'info';
  }) => {
    setConfirmData(data);
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    if (confirmData?.onConfirm) {
      confirmData.onConfirm();
    }
    setShowConfirmModal(false);
    setConfirmData(null);
  };

  const handleCancel = () => {
    if (confirmData?.onCancel) {
      confirmData.onCancel();
    }
    setShowConfirmModal(false);
    setConfirmData(null);
  };

  const handleExecuteMerge = async () => {
    if (mergeClientsList.length !== 2) {
      showConfirmation({
        title: 'Error de Validación',
        message: 'Por favor selecciona exactamente 2 clientes para fusionar',
        onConfirm: () => {},
        confirmText: 'Entendido',
        type: 'warning'
      });
      return;
    }

    if (!selectedPrimaryId) {
      showConfirmation({
        title: 'Error de Validación',
        message: 'Por favor selecciona cuál cliente se mantendrá como principal',
        onConfirm: () => {},
        confirmText: 'Entendido',
        type: 'warning'
      });
      return;
    }

    const primaryClient = mergeClientsList.find(c => c.id === selectedPrimaryId);
    const secondaryClient = mergeClientsList.find(c => c.id !== selectedPrimaryId);

    if (!primaryClient || !secondaryClient) {
      showConfirmation({
        title: 'Error',
        message: 'Error al identificar los clientes para fusionar',
        onConfirm: () => {},
        confirmText: 'Entendido',
        type: 'danger'
      });
      return;
    }

    showConfirmation({
      title: 'Confirmar Fusión de Clientes',
      message: `¿Estás seguro de que quieres fusionar los clientes?\n\n` +
               `Cliente Principal (se mantiene): ${primaryClient.name} (${primaryClient.clientCode})\n` +
               `Cliente Secundario (se elimina): ${secondaryClient.name} (${secondaryClient.clientCode})\n\n` +
               `El cliente secundario será eliminado y todos sus datos se transferirán al cliente principal.`,
      onConfirm: () => executeMerge(primaryClient, secondaryClient),
      confirmText: 'Sí, Fusionar',
      cancelText: 'Cancelar',
      type: 'danger'
    });
  };

  const executeMerge = async (primaryClient: ClientSearchResult, secondaryClient: ClientSearchResult) => {

    try {
      const result = await mergeClientsMutation({
        variables: {
          primaryClientId: primaryClient.id,
          secondaryClientId: secondaryClient.id
        }
      });

      const message = result.data?.mergeClients;
      if (message && !message.includes('Error')) {
        showConfirmation({
          title: 'Fusión Exitosa',
          message: message,
          onConfirm: () => {
            handleCloseMergeModal();
            // Refrescar la búsqueda actual si uno de los clientes fusionados está seleccionado
            if (selectedClient && (selectedClient.id === primaryClient.id || selectedClient.id === secondaryClient.id)) {
              handleClearSearch();
            }
          },
          confirmText: 'Entendido',
          type: 'info'
        });
      } else {
        showConfirmation({
          title: 'Error en la Fusión',
          message: message || 'Error desconocido al fusionar clientes',
          onConfirm: () => {},
          confirmText: 'Entendido',
          type: 'danger'
        });
      }
    } catch (error) {
      console.error('Error al fusionar clientes:', error);
      showConfirmation({
        title: 'Error en la Fusión',
        message: 'Error al fusionar clientes. Intenta nuevamente.',
        onConfirm: () => {},
        confirmText: 'Entendido',
        type: 'danger'
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

  const handleExportPDF = async (historyData: ClientHistoryData, detailed: boolean = false) => {
    try {
      const response = await fetch('/export-client-history-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: historyData.client.id,
          clientName: historyData.client.fullName,
          clientDui: historyData.client.clientCode,
          clientPhones: historyData.client.phones,
          clientAddresses: historyData.client.addresses,
          summary: historyData.summary,
          loansAsClient: historyData.loansAsClient,
          loansAsCollateral: historyData.loansAsCollateral,
          detailed: detailed
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

        {/* Búsqueda de Cliente */}
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

          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#4a5568' }}>
              Buscar Cliente (Nombre, Clave Única) - La información de ruta y localidad aparecerá en los resultados
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowAutocomplete(true); // Activar autocomplete cuando se escribe
              }}
              onFocus={() => setShowAutocomplete(true)} // Activar autocomplete al hacer focus
              placeholder="Escriba nombre o clave única del cliente..."
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
                {clientResults.map((client: ClientSearchResult) => (
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
                    <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '4px' }}>{client.name}</div>
                    <div style={{ fontSize: '12px', color: '#4a5568', marginBottom: '2px' }}>
                      🔑 <strong>Clave:</strong> {client.clientCode} | 📍 <strong>Localidad:</strong> {client.location} | 🏘️ <strong>Municipio:</strong> {client.municipality} | 🏛️ <strong>Estado:</strong> {client.state}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a5568', marginBottom: '2px' }}>
                      🗺️ <strong>Ruta:</strong> {client.route} | 📞 <strong>Teléfono:</strong> {client.phone}
                    </div>
                    <div style={{ fontSize: '11px', color: '#a0aec0', marginBottom: '2px' }}>
                      🏠 <strong>Dirección:</strong> {client.city}
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

            {/* Sección de duplicados detectados */}
            {showDuplicates && potentialDuplicates.length > 0 && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🔍 Posibles Duplicados Detectados ({potentialDuplicates.length})
                </h3>
                <p style={{
                  margin: '0 0 16px 0',
                  fontSize: '14px',
                  color: '#92400e'
                }}>
                  Se encontraron clientes con nombres muy similares. Revisa si son duplicados y considera fusionarlos.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {potentialDuplicates.map((duplicate, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      backgroundColor: 'white',
                      border: '1px solid #f59e0b',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: '12px',
                      alignItems: isMobile ? 'stretch' : 'center'
                    }}>
                      {/* Cliente 1 */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                          {duplicate.client1.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          🔑 {duplicate.client1.clientCode} | 📍 {duplicate.client1.location}
                        </div>
                      </div>
                      
                      {/* Similitud */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '8px',
                        backgroundColor: duplicate.similarity >= 95 ? '#fef2f2' : '#f0f9ff',
                        borderRadius: '4px',
                        minWidth: '80px'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: duplicate.similarity >= 95 ? '#dc2626' : '#2563eb'
                        }}>
                          {duplicate.similarity}%
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280'
                        }}>
                          similitud
                        </div>
                      </div>
                      
                      {/* Cliente 2 */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                          {duplicate.client2.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          🔑 {duplicate.client2.clientCode} | 📍 {duplicate.client2.location}
                        </div>
                      </div>
                      
                      {/* Botón de fusión rápida */}
                      {canMergeClients && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <Button
                            onClick={() => {
                              // Pre-cargar ambos clientes en el modal de fusión
                              setMergeClientsList([duplicate.client1, duplicate.client2]);
                              setSelectedPrimaryId(duplicate.client1.id);
                              setShowMergeModal(true);
                              setShowDuplicates(false);
                            }}
                            style={{
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            🔗 Fusionar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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

            {canMergeClients && (
              <Button 
                onClick={handleOpenMergeModal}
                style={{
                  backgroundColor: '#805ad5',
                  color: 'white',
                  padding: isMobile ? '12px 16px' : '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  width: isMobile ? '100%' : 'auto',
                  fontSize: isMobile ? '14px' : 'inherit'
                }}
              >
                🔗 Fusionar Clientes
              </Button>
            )}

            {potentialDuplicates.length > 0 && (
              <Button 
                onClick={() => setShowDuplicates(!showDuplicates)}
                style={{
                  backgroundColor: showDuplicates ? '#f59e0b' : '#f97316',
                  color: 'white',
                  padding: isMobile ? '12px 16px' : '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  width: isMobile ? '100%' : 'auto',
                  fontSize: isMobile ? '14px' : 'inherit',
                  marginLeft: isMobile ? '0' : '8px',
                  marginTop: isMobile ? '8px' : '0'
                }}
              >
                🔍 {showDuplicates ? 'Ocultar' : 'Mostrar'} Duplicados ({potentialDuplicates.length})
              </Button>
            )}

            {showClientHistory && historyResult && (
              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                gap: '8px',
                marginLeft: isMobile ? '0px' : '8px',
              }}>
                {/* Toggle para PDF detallado */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#f7fafc',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px'
                }}>
                  <input
                    type="checkbox"
                    id="detailed-pdf-toggle"
                    checked={showDetailedPDF}
                    onChange={(e) => setShowDetailedPDF(e.target.checked)}
                    style={{ marginRight: '4px' }}
                  />
                  <label htmlFor="detailed-pdf-toggle" style={{ color: '#4a5568', cursor: 'pointer' }}>
                    PDF detallado completo
                  </label>
                </div>
                
                {/* Botón de exportar PDF */}
                <Button 
                  onClick={() => handleExportPDF(historyResult, showDetailedPDF)}
                  style={{
                    backgroundColor: '#38a169',
                    color: 'white',
                    padding: isMobile ? '12px 16px' : '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    width: isMobile ? '100%' : 'auto',
                    fontSize: isMobile ? '14px' : 'inherit'
                  }}
                >
                  📄 {showDetailedPDF ? 'Exportar PDF Completo' : 'Exportar PDF Resumen'}
                </Button>
              </div>
            )}

            {selectedClient && (
              <div style={{ 
                fontSize: isMobile ? '12px' : '14px', 
                color: '#4a5568',
                textAlign: isMobile ? 'center' : 'left',
                width: '100%'
              }}>
                Cliente seleccionado: <strong>{selectedClient.name}</strong> ({selectedClient.clientCode})
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
              padding: isMobile ? '16px' : '24px',
              borderRadius: '8px',
              marginBottom: '24px',
              border: '1px solid #cbd5e0'
            }}>
              <h2 style={{ 
                fontSize: isMobile ? '16px' : '18px', 
                fontWeight: '600', 
                marginBottom: '20px', 
                color: '#2d3748' 
              }}>
                Información del Cliente y Líder Asignado
              </h2>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
                gap: isMobile ? '20px' : '32px' 
              }}>
                {/* Información del Cliente */}
                <div style={{
                  backgroundColor: 'white',
                  padding: isMobile ? '12px' : '16px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ 
                    fontSize: isMobile ? '14px' : '16px', 
                    fontWeight: '600', 
                    marginBottom: '12px', 
                    color: '#2d3748',
                    borderBottom: '2px solid #4299e1',
                    paddingBottom: '4px'
                  }}>
                    👤 Cliente
                  </h3>
                  
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>👤 Nombre:</strong> {historyResult.client.fullName}
                    </p>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>🔑 Clave:</strong> {historyResult.client.clientCode}
                    </p>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>📞 Teléfonos:</strong> {historyResult.client.phones.join(', ')}
                    </p>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>📊 Relación:</strong> 
                      {historyResult.summary.hasBeenClient && ' ✅ Cliente'}
                      {historyResult.summary.hasBeenCollateral && ' 🤝 Aval'}
                    </p>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>📅 Desde:</strong> {historyResult.loansAsClient.length > 0 ? 
                        formatDate(historyResult.loansAsClient[historyResult.loansAsClient.length - 1].signDate) : 
                        historyResult.loansAsCollateral.length > 0 ? 
                          formatDate(historyResult.loansAsCollateral[historyResult.loansAsCollateral.length - 1].signDate) : 
                          'N/A'
                      }
                    </p>
                    
                    {/* Dirección del cliente */}
                    {historyResult.client.addresses.map((addr, index) => (
                      <div key={index} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: isMobile ? '12px' : '13px' }}>
                          <strong>📍 Localidad:</strong> {addr.location}
                        </p>
                        <p style={{ margin: '0 0 4px 0', fontSize: isMobile ? '12px' : '13px' }}>
                          <strong>🗺️ Ruta:</strong> {addr.route}
                        </p>
                        <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                          <strong>🏠 Dirección:</strong> {addr.city}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Información del Líder */}
                <div style={{
                  backgroundColor: 'white',
                  padding: isMobile ? '12px' : '16px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ 
                    fontSize: isMobile ? '14px' : '16px', 
                    fontWeight: '600', 
                    marginBottom: '12px', 
                    color: '#2d3748',
                    borderBottom: '2px solid #38a169',
                    paddingBottom: '4px'
                  }}>
                    👨‍💼 Líder Asignado
                  </h3>
                  
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>👤 Nombre:</strong> {historyResult.client.leader.name}
                    </p>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>🗺️ Ruta:</strong> {historyResult.client.leader.route}
                    </p>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>📍 Localidad:</strong> {historyResult.client.leader.location}
                    </p>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>🏘️ Municipio:</strong> {historyResult.client.leader.municipality}
                    </p>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>🌍 Estado:</strong> {historyResult.client.leader.state}
                    </p>
                    <p style={{ margin: '0', fontSize: isMobile ? '12px' : '13px' }}>
                      <strong>📞 Teléfono:</strong> {historyResult.client.leader.phone}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)',
              gap: isMobile ? '8px' : '12px',
              marginBottom: isMobile ? '16px' : '24px'
            }}>
              <div style={{
                backgroundColor: historyResult.summary.hasBeenClient ? '#e6fffa' : '#f7fafc',
                padding: isMobile ? '10px' : '12px',
                borderRadius: '6px',
                border: `1px solid ${historyResult.summary.hasBeenClient ? '#38b2ac' : '#cbd5e0'}`,
                textAlign: 'center'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px', color: '#2d3748', textAlign: 'center' }}>
                  👤 Como Cliente
                </h3>
                <p style={{ fontSize: '22px', fontWeight: '700', color: '#38b2ac', margin: 0, textAlign: 'center' }}>
                  {historyResult.summary.totalLoansAsClient}
                </p>
                <p style={{ fontSize: '10px', color: '#718096', margin: 0, textAlign: 'center', marginTop: '2px' }}>
                  Activos: {historyResult.summary.activeLoansAsClient}
                </p>
              </div>

              <div style={{
                backgroundColor: historyResult.summary.hasBeenCollateral ? '#fff5f5' : '#f7fafc',
                padding: '12px',
                borderRadius: '6px',
                border: `1px solid ${historyResult.summary.hasBeenCollateral ? '#f56565' : '#cbd5e0'}`,
                textAlign: 'center'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px', color: '#2d3748', textAlign: 'center' }}>
                  🤝 Como Aval
                </h3>
                <p style={{ fontSize: '22px', fontWeight: '700', color: '#f56565', margin: 0, textAlign: 'center' }}>
                  {historyResult.summary.totalLoansAsCollateral}
                </p>
                <p style={{ fontSize: '10px', color: '#718096', margin: 0, textAlign: 'center', marginTop: '2px' }}>
                  Activos: {historyResult.summary.activeLoansAsCollateral}
                </p>
              </div>

              {canMergeClients && (
                <>
                  <div style={{
                    backgroundColor: '#f0fff4',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #48bb78',
                    textAlign: 'center'
                  }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: '#2d3748' }}>
                      💰 Total Prestado
                    </h3>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: '#48bb78', margin: 0 }}>
                      {formatCurrency(historyResult.summary.totalAmountRequestedAsClient)}
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: '#fffbf0',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #ed8936',
                    textAlign: 'center'
                  }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: '#2d3748' }}>
                      💳 Total Pagado
                    </h3>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: '#ed8936', margin: 0 }}>
                      {formatCurrency(historyResult.summary.totalAmountPaidAsClient)}
                    </p>
                  </div>
                </>
              )}

              <div style={{
                backgroundColor: historyResult.summary.currentPendingDebtAsClient > 0 ? '#fed7e2' : '#f0fff4',
                padding: '12px',
                borderRadius: '6px',
                border: `1px solid ${historyResult.summary.currentPendingDebtAsClient > 0 ? '#f56565' : '#48bb78'}`,
                textAlign: 'center'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: '#2d3748' }}>
                  💰 Deuda Pendiente Total
                </h3>
                <p style={{ fontSize: '18px', fontWeight: '700', color: historyResult.summary.currentPendingDebtAsClient > 0 ? '#f56565' : '#48bb78', margin: 0 }}>
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
                  {/* Leyenda de colores por semana */}
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: '#E0F2FE', border: '1px solid #bae6fd', borderRadius: 4 }} />
                      <span style={{ fontSize: 12, color: '#334155', fontWeight: '500' }}>Cubierto por sobrepago</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: '#FEF9C3', border: '1px solid #fde68a', borderRadius: 4 }} />
                      <span style={{ fontSize: 12, color: '#334155', fontWeight: '500' }}>Pago parcial</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: '#FEE2E2', border: '1px solid #fecaca', borderRadius: 4 }} />
                      <span style={{ fontSize: 12, color: '#334155', fontWeight: '500' }}>Falta (sin pago)</span>
                    </div>
                  </div>
                  
                  {/* Contenedor de créditos con separación visual */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {historyResult.loansAsClient.map((loan, index) => (
                      <div key={loan.id} style={{
                    backgroundColor: 'white', 
                        borderRadius: '12px',
                        border: '2px solid #e2e8f0',
                    overflow: 'hidden', 
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        position: 'relative'
                      }}>
                        {/* Header del crédito con color distintivo - COMPACTO */}
                        <div style={{
                          backgroundColor: index % 2 === 0 ? '#f0f9ff' : '#fef7ff',
                          borderBottom: `2px solid ${index % 2 === 0 ? '#0ea5e9' : '#a855f7'}`,
                          padding: '10px 12px',
                          position: 'relative'
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '16px',
                            backgroundColor: index % 2 === 0 ? '#0ea5e9' : '#a855f7',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                          fontWeight: '600' 
                          }}>
                            #{index + 1}
                                </div>
                          
                          {/* Información principal en una sola línea */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            marginBottom: '8px',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                              {loan.signDateFormatted || formatDate(loan.signDate)}
                                </div>
                            <div style={{
                              padding: '2px 6px',
                              backgroundColor: 'white',
                                borderRadius: '4px',
                              fontSize: '9px',
                              fontWeight: '600',
                              color: '#475569',
                              border: '1px solid #e2e8f0'
                            }}>
                              {loan.loanType}
                            </div>
                            <div style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                                fontWeight: '600',
                                color: 'white',
                                backgroundColor: getStatusColor(loan.status)
                              }}>
                                {loan.status}
                            </div>
                              {loan.wasRenewed && (
                              <div style={{ 
                                fontSize: '9px', 
                                color: '#7c3aed', 
                                fontWeight: '500',
                                backgroundColor: 'white',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0'
                              }}>
                                  🔄 Renovado
                                </div>
                              )}
                                </div>
                          
                          {/* Información financiera ultra compacta */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            gap: '4px',
                            paddingBottom: '2px'
                          }}>
                            {/* Primera fila - Información financiera principal */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(2, 1fr)', 
                              gap: '4px'
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '3px',
                                backgroundColor: 'white',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                minHeight: '24px'
                              }}>
                                <span style={{ fontSize: '8px', color: '#64748b', fontWeight: '500' }}>PRESTADO:</span>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#0f172a' }}>
                                  {formatCurrency(loan.amountRequested)}
                                </span>
                              </div>
                              
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '3px',
                                backgroundColor: 'white',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                minHeight: '24px'
                              }}>
                                <span style={{ fontSize: '8px', color: '#64748b', fontWeight: '500' }}>TOTAL:</span>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#0f172a' }}>
                                  {formatCurrency(loan.totalAmountDue)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Segunda fila - Pagos y deuda */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(2, 1fr)', 
                              gap: '4px'
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '3px',
                                backgroundColor: 'white',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                minHeight: '24px'
                              }}>
                                <span style={{ fontSize: '8px', color: '#64748b', fontWeight: '500' }}>PAGADO:</span>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#059669' }}>
                                  {formatCurrency(loan.totalPaid)}
                                </span>
                              </div>
                              
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '3px',
                                backgroundColor: 'white',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                minHeight: '24px'
                              }}>
                                <span style={{ fontSize: '8px', color: '#64748b', fontWeight: '500' }}>PENDIENTE:</span>
                                <span style={{ 
                                  fontSize: '10px', 
                                  fontWeight: '700', 
                                  color: loan.pendingDebt > 0 ? '#dc2626' : '#059669'
                                }}>
                                  {formatCurrency(loan.pendingDebt)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Tercera fila - Información adicional (solo AVAL) */}
                            <div style={{ 
                              display: 'flex', 
                              gap: '4px'
                            }}>
                              {loan.avalName && (
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  gap: '2px',
                                  backgroundColor: '#f0f9ff',
                                  padding: '4px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #0ea5e9',
                                  cursor: 'pointer',
                                  position: 'relative',
                                  minHeight: '32px',
                                  transition: 'all 0.2s ease',
                                  flex: 1
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#e0f2fe';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f0f9ff';
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <span style={{ fontSize: '8px', color: '#0ea5e9', fontWeight: '600' }}>AVAL:</span>
                                    <span style={{ fontSize: '9px', fontWeight: '600', color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {loan.avalName}
                                    </span>
                                  </div>
                                  {loan.avalPhone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '20px' }}>
                                      <span style={{ fontSize: '8px', color: '#0ea5e9', fontWeight: '600' }}>📞</span>
                                      <span style={{ fontSize: '8px', color: '#0ea5e9', fontWeight: '600' }}>{loan.avalPhone}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Tabla de pagos expandible */}
                        <div style={{ 
                          cursor: 'pointer',
                          padding: '12px 20px',
                          backgroundColor: '#f8fafc',
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onClick={() => {
                          const expandedRows = (document.querySelector(`#loan-details-${loan.id}`) as HTMLElement);
                          const expandButton = document.querySelector(`#expand-button-${loan.id}`) as HTMLElement;
                          if (expandedRows && expandButton) {
                            const isExpanded = expandedRows.style.display !== 'none';
                            expandedRows.style.display = isExpanded ? 'none' : 'block';
                            expandButton.innerHTML = isExpanded ? '▼ Click para expandir' : '▲ Click para contraer';
                          }
                        }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>
                            📋 Ver detalle de pagos - Préstamo #{loan.id.slice(-8)}
                          </span>
                          <span id={`expand-button-${loan.id}`} style={{ fontSize: '10px', color: '#64748b' }}>
                            ▼ Click para expandir
                          </span>
                        </div>
                        
                        {/* Contenido expandible */}
                        <div id={`loan-details-${loan.id}`} style={{ display: 'none', padding: '16px 20px', backgroundColor: '#fafbfc' }}>
                                {(() => {
                                  const chronology = generatePaymentChronology(loan);
                                  return chronology.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                <table style={{ 
                                  width: '100%', 
                                  fontSize: '12px', 
                                  borderCollapse: 'collapse',
                                  backgroundColor: 'white',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}>
                                        <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>#</th>
                                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Fecha</th>
                                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Descripción</th>
                                      <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Monto</th>
                                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Método</th>
                                      <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Deuda Antes</th>
                                      <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Deuda Después</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {chronology.map((item, index) => {
                                            const bgColor = (() => {
                                              if (item.coverageType === 'COVERED_BY_SURPLUS') return '#E0F2FE'; // azul claro
                                              if (item.coverageType === 'PARTIAL') return '#FEF9C3'; // amarillo claro
                                              if (item.coverageType === 'MISS' && item.type === 'NO_PAYMENT') return '#FEE2E2'; // rojo claro
                                              if (item.coverageType === 'FULL') return 'white';
                                              // fallback previo
                                              return item.type === 'NO_PAYMENT' ? '#fed7e2' : 'white';
                                            })();
                                            const textColor = item.coverageType === 'MISS' && item.type === 'NO_PAYMENT' ? '#b91c1c' : '#2d3748';
                                            return (
                                            <tr key={item.id} style={{ 
                                        borderBottom: '1px solid #f1f5f9',
                                              backgroundColor: bgColor
                                            }}>
                                        <td style={{ padding: '8px', fontSize: '11px', fontWeight: '500' }}>
                                                {item.type === 'PAYMENT' ? (item.paymentNumber || index + 1) : '-'}
                                              </td>
                                        <td style={{ padding: '8px', fontSize: '11px' }}>{item.dateFormatted}</td>
                                              <td style={{ 
                                          padding: '8px',
                                                color: textColor,
                                                fontWeight: item.type === 'NO_PAYMENT' ? '600' : 'normal'
                                              }}>
                                                {item.type === 'NO_PAYMENT' ? (item.description || '⚠️ Sin pago') : item.description}
                                                {item.weeklyExpected != null && (
                                                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                                    Esperado: {formatCurrency(item.weeklyExpected || 0)} | Pagado: {formatCurrency(item.weeklyPaid || 0)} | Excedente previo: {formatCurrency(item.surplusBefore || 0)}
                                                  </div>
                                                )}
                                              </td>
                                              <td style={{ 
                                          padding: '8px', 
                                                textAlign: 'right', 
                                                fontWeight: '600', 
                                          color: item.type === 'PAYMENT' ? '#059669' : '#dc2626'
                                              }}>
                                                {item.type === 'PAYMENT' ? formatCurrency(item.amount || 0) : '-'}
                                              </td>
                                        <td style={{ padding: '8px', fontSize: '11px' }}>
                                                {item.type === 'PAYMENT' ? item.paymentMethod : '-'}
                                              </td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontSize: '11px' }}>
                                                {item.type === 'PAYMENT' ? formatCurrency(item.balanceBefore || 0) : '-'}
                                              </td>
                                              <td style={{ 
                                          padding: '8px', 
                                                textAlign: 'right', 
                                                fontWeight: '600', 
                                                color: item.type === 'PAYMENT' 
                                            ? (item.balanceAfter === 0 ? '#059669' : '#dc2626')
                                            : '#dc2626'
                                              }}>
                                                {item.type === 'PAYMENT' ? formatCurrency(item.balanceAfter || 0) : '-'}
                                              </td>
                                            </tr>
                                          )})}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                              <p style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Sin pagos registrados</p>
                                  );
                                })()}

                                {/* Información adicional */}
                          <div style={{ 
                            marginTop: '16px', 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                            gap: '12px', 
                            fontSize: '11px', 
                            color: '#475569',
                            padding: '16px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0'
                          }}>
                                  {loan.avalName && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>👥</span>
                                <span><strong>Aval:</strong> {loan.avalName}</span>
                              </div>
                                  )}
                                  {loan.renewedFrom && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>🔄</span>
                                <span><strong>Renovación de:</strong> {loan.renewedFrom}</span>
                              </div>
                                  )}
                                  {loan.renewedTo && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>➡️</span>
                                <span><strong>Renovado como:</strong> {loan.renewedTo}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>💰</span>
                              <span><strong>Prestado:</strong> {formatCurrency(loan.amountRequested)}</span>
                                </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>💸</span>
                              <span><strong>Total a pagar:</strong> {formatCurrency(loan.totalAmountDue)}</span>
                              </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📊</span>
                              <span><strong>Intereses:</strong> {formatCurrency(loan.interestAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>⏱️</span>
                              <span><strong>Duración:</strong> {loan.weekDuration} semanas</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📈</span>
                              <span><strong>Tasa:</strong> {loan.rate}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  💡 Haz clic en cualquier tarjeta para ver el detalle completo de pagos del préstamo donde fuiste aval
                </p>
                
                <div style={{ 
                  overflowX: 'auto',
                  fontSize: isMobile ? '12px' : 'inherit'
                }}>
                  {/* Contenedor de créditos como aval con separación visual */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {historyResult.loansAsCollateral.map((loan, index) => (
                      <div key={loan.id} style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        border: '2px solid #e2e8f0',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        position: 'relative'
                      }}>
                        {/* Header del crédito como aval con color distintivo - COMPACTO */}
                        <div style={{
                          backgroundColor: index % 2 === 0 ? '#fef2f2' : '#f0fdf4',
                          borderBottom: `2px solid ${index % 2 === 0 ? '#f56565' : '#22c55e'}`,
                          padding: '10px 12px',
                          position: 'relative'
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '16px',
                            backgroundColor: index % 2 === 0 ? '#f56565' : '#22c55e',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}>
                            Aval #{index + 1}
                                </div>
                          
                          {/* Información principal en una sola línea */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            marginBottom: '8px',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                              👤 {loan.clientName}
                                </div>
                            <div style={{
                              padding: '2px 6px',
                              backgroundColor: 'white',
                                borderRadius: '4px',
                              fontSize: '9px',
                              fontWeight: '600',
                              color: '#475569',
                              border: '1px solid #e2e8f0'
                            }}>
                              {loan.clientDui}
                            </div>
                            <div style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                                fontWeight: '600',
                                color: 'white',
                                backgroundColor: getStatusColor(loan.status)
                              }}>
                                {loan.status}
                            </div>
                              {loan.wasRenewed && (
                              <div style={{ 
                                fontSize: '9px', 
                                color: '#7c3aed', 
                                fontWeight: '500',
                                backgroundColor: 'white',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0'
                              }}>
                                  🔄 Renovado
                                </div>
                              )}
                                </div>
                          
                          {/* Información financiera en múltiples filas optimizadas */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            gap: '8px',
                            paddingBottom: '4px'
                          }}>
                            {/* Primera fila - Información financiera principal */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(2, 1fr)', 
                              gap: '8px'
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                backgroundColor: 'white',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                minHeight: '36px'
                              }}>
                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>PRESTADO:</span>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                                  {formatCurrency(loan.amountRequested)}
                                </span>
                              </div>
                              
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                backgroundColor: 'white',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                minHeight: '36px'
                              }}>
                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>PAGADO:</span>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>
                                  {formatCurrency(loan.totalPaid)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Segunda fila - Deuda (quitamos DÍAS) */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '1fr', 
                              gap: '8px'
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                backgroundColor: 'white',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                minHeight: '36px'
                              }}>
                                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>PENDIENTE:</span>
                                <span style={{ 
                                  fontSize: '12px', 
                                  fontWeight: '700', 
                                  color: loan.pendingDebt > 0 ? '#dc2626' : '#059669'
                                }}>
                                  {formatCurrency(loan.pendingDebt)}
                                </span>
                              </div>
                              
                              
                            </div>
                            
                            {/* Tercera fila - Información adicional (solo AVAL) */}
                            <div style={{ 
                              display: 'flex', 
                              gap: '8px'
                            }}>
                              {loan.avalName && (
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  gap: '3px',
                                  backgroundColor: '#fef2f2',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #f56565',
                                  cursor: 'pointer',
                                  position: 'relative',
                                  minHeight: '40px',
                                  transition: 'all 0.2s ease',
                                  flex: 1
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fee2e2';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fef2f2';
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '8px', color: '#f56565', fontWeight: '600' }}>AVAL:</span>
                                    <span style={{ fontSize: '9px', fontWeight: '600', color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {loan.avalName}
                                    </span>
                                  </div>
                                  {loan.avalPhone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '20px' }}>
                                      <span style={{ fontSize: '8px', color: '#f56565', fontWeight: '600' }}>📞</span>
                                      <span style={{ fontSize: '8px', color: '#f56565', fontWeight: '600' }}>{loan.avalPhone}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Tabla de pagos expandible */}
                        <div style={{ 
                          cursor: 'pointer',
                          padding: '12px 20px',
                          backgroundColor: '#f8fafc',
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onClick={() => {
                          const expandedRows = (document.querySelector(`#collateral-loan-details-${loan.id}`) as HTMLElement);
                          const expandButton = document.querySelector(`#collateral-expand-button-${loan.id}`) as HTMLElement;
                          if (expandedRows && expandButton) {
                            const isExpanded = expandedRows.style.display !== 'none';
                            expandedRows.style.display = isExpanded ? 'none' : 'block';
                            expandButton.innerHTML = isExpanded ? '▼ Click para expandir' : '▲ Click para contraer';
                          }
                        }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>
                            🤝 Ver detalle de pagos (Como Aval) - Préstamo #{loan.id.slice(-8)}
                          </span>
                          <span id={`collateral-expand-button-${loan.id}`} style={{ fontSize: '10px', color: '#64748b' }}>
                            ▼ Click para expandir
                          </span>
                        </div>
                        
                        {/* Contenido expandible */}
                        <div id={`collateral-loan-details-${loan.id}`} style={{ display: 'none', padding: '16px 20px', backgroundColor: '#fafbfc' }}>
                                {(() => {
                                  const chronology = generatePaymentChronology(loan);
                                  return chronology.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                <table style={{ 
                                  width: '100%', 
                                  fontSize: '12px', 
                                  borderCollapse: 'collapse',
                                  backgroundColor: 'white',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}>
                                        <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>#</th>
                                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Fecha</th>
                                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Descripción</th>
                                      <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Monto</th>
                                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Método</th>
                                      <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Deuda Antes</th>
                                      <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Deuda Después</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                    {chronology.map((item, index) => {
                                      const bgColor = (() => {
                                        if (item.coverageType === 'COVERED_BY_SURPLUS') return '#E0F2FE'; // azul claro
                                        if (item.coverageType === 'PARTIAL') return '#FEF9C3'; // amarillo claro
                                        if (item.coverageType === 'MISS' && item.type === 'NO_PAYMENT') return '#FEE2E2'; // rojo claro
                                        if (item.coverageType === 'FULL') return 'white';
                                        // fallback previo
                                        return item.type === 'NO_PAYMENT' ? '#fed7e2' : 'white';
                                      })();
                                      const textColor = item.coverageType === 'MISS' && item.type === 'NO_PAYMENT' ? '#b91c1c' : '#2d3748';
                                      return (
                                            <tr key={item.id} style={{ 
                                        borderBottom: '1px solid #f1f5f9',
                                        backgroundColor: bgColor
                                            }}>
                                        <td style={{ padding: '8px', fontSize: '11px', fontWeight: '500' }}>
                                                {item.type === 'PAYMENT' ? (item.paymentNumber || index + 1) : '-'}
                                              </td>
                                        <td style={{ padding: '8px', fontSize: '11px' }}>{item.dateFormatted}</td>
                                              <td style={{ 
                                          padding: '8px',
                                          color: textColor,
                                                fontWeight: item.type === 'NO_PAYMENT' ? '600' : 'normal'
                                              }}>
                                          {item.type === 'NO_PAYMENT' ? (item.description || '⚠️ Sin pago') : item.description}
                                          {item.weeklyExpected != null && (
                                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                                              Esperado: {formatCurrency(item.weeklyExpected || 0)} | Pagado: {formatCurrency(item.weeklyPaid || 0)} | Excedente previo: {formatCurrency(item.surplusBefore || 0)}
                                            </div>
                                          )}
                                              </td>
                                              <td style={{ 
                                          padding: '8px', 
                                                textAlign: 'right', 
                                                fontWeight: '600', 
                                          color: item.type === 'PAYMENT' ? '#059669' : '#dc2626'
                                              }}>
                                                {item.type === 'PAYMENT' ? formatCurrency(item.amount || 0) : '-'}
                                              </td>
                                        <td style={{ padding: '8px', fontSize: '11px' }}>
                                                {item.type === 'PAYMENT' ? item.paymentMethod : '-'}
                                              </td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontSize: '11px' }}>
                                                {item.type === 'PAYMENT' ? formatCurrency(item.balanceBefore || 0) : '-'}
                                              </td>
                                              <td style={{ 
                                          padding: '8px', 
                                                textAlign: 'right', 
                                                fontWeight: '600', 
                                                color: item.type === 'PAYMENT' 
                                            ? (item.balanceAfter === 0 ? '#059669' : '#dc2626')
                                            : '#dc2626'
                                              }}>
                                                {item.type === 'PAYMENT' ? formatCurrency(item.balanceAfter || 0) : '-'}
                                              </td>
                                            </tr>
                                    )})}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                              <p style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>Sin pagos registrados</p>
                                  );
                                })()}

                                {/* Información adicional para préstamos como aval */}
                          <div style={{ 
                            marginTop: '16px', 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                            gap: '12px', 
                            fontSize: '11px', 
                            color: '#475569',
                            padding: '16px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>👤</span>
                              <span><strong>Cliente Principal:</strong> {loan.clientName}</span>
                            </div>
                                  {loan.renewedFrom && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>🔄</span>
                                <span><strong>Renovación de:</strong> {loan.renewedFrom}</span>
                              </div>
                                  )}
                                  {loan.renewedTo && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>➡️</span>
                                <span><strong>Renovado como:</strong> {loan.renewedTo}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>💰</span>
                              <span><strong>Prestado:</strong> {formatCurrency(loan.amountRequested)}</span>
                                </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>💸</span>
                              <span><strong>Total a pagar:</strong> {formatCurrency(loan.totalAmountDue)}</span>
                              </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📊</span>
                              <span><strong>Intereses:</strong> {formatCurrency(loan.interestAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>⏱️</span>
                              <span><strong>Duración:</strong> {loan.weekDuration} semanas</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📈</span>
                              <span><strong>Tasa:</strong> {loan.rate}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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

        {/* Modal de fusión de clientes mejorado */}
        {showMergeModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              minWidth: isMobile ? '90%' : '600px',
              maxWidth: isMobile ? '95%' : '800px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
            }}>
              <h2 style={{
                margin: '0 0 20px 0',
                fontSize: '20px',
                fontWeight: '600',
                color: '#1F2937',
                textAlign: 'center'
              }}>
                🔗 Fusionar Clientes
              </h2>

              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                {mergeClientsList.length === 0 
                  ? 'Busca y selecciona 2 clientes para fusionar. Luego elige cuál se mantiene como principal.'
                  : mergeClientsList.length === 1
                    ? 'Cliente actual cargado. Busca otro cliente para fusionar.'
                    : 'Selecciona cuál cliente se mantiene como principal.'
                }
              </p>

              {/* Input de búsqueda */}
              {mergeClientsList.length < 2 && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    marginBottom: '8px', 
                    color: '#374151' 
                  }}>
                    Buscar Cliente
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={mergeSearchTerm}
                      onChange={(e) => {
                        setMergeSearchTerm(e.target.value);
                        setShowMergeAutocomplete(true);
                      }}
                      onFocus={() => setShowMergeAutocomplete(true)}
                      placeholder={mergeClientsList.length === 0 
                        ? "Escriba nombre o clave única del cliente..." 
                        : "Buscar segundo cliente para fusionar..."
                      }
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: 'white'
                      }}
                    />
                    
                    {/* Resultados de búsqueda */}
                    {showMergeAutocomplete && mergeClientResults.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}>
                        {mergeClientResults
                          .filter((client: ClientSearchResult) => !mergeClientsList.some(c => c.id === client.id))
                          .map((client: ClientSearchResult) => (
                          <div
                            key={client.id}
                            onClick={() => handleMergeClientSelect(client)}
                            style={{
                              padding: '12px',
                              borderBottom: '1px solid #F3F4F6',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <div style={{ fontWeight: '600', color: '#1F2937' }}>{client.name}</div>
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              🔑 <strong>Clave:</strong> {client.clientCode} | 📍 <strong>Localidad:</strong> {client.location} | 🏘️ <strong>Municipio:</strong> {client.municipality} | 🏛️ <strong>Estado:</strong> {client.state}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Clientes seleccionados */}
              {mergeClientsList.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '16px'
                  }}>
                    Clientes Seleccionados ({mergeClientsList.length}/2)
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {mergeClientsList.map((client, index) => (
                      <div
                        key={client.id}
                        style={{
                          padding: '16px',
                          border: selectedPrimaryId === client.id ? '3px solid #22C55E' : '2px solid #E5E7EB',
                          borderRadius: '8px',
                          backgroundColor: selectedPrimaryId === client.id ? '#F0FDF4' : '#F9FAFB',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => handleSetPrimaryClient(client.id)}
                      >
                        {/* Botón de eliminar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMergeClient(client.id);
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: '#EF4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                        >
                          ×
                        </button>

                        {/* Indicador de cliente principal */}
                        {selectedPrimaryId === client.id && (
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            background: '#22C55E',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            PRINCIPAL
                          </div>
                        )}

                        {/* Indicador de cliente actual */}
                        {index === 0 && mergeClientsList.length === 1 && (
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            left: selectedPrimaryId === client.id ? '80px' : '8px',
                            background: '#3B82F6',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            CLIENTE ACTUAL
                          </div>
                        )}

                        <div style={{ 
                          marginTop: selectedPrimaryId === client.id ? '24px' : '0',
                          marginRight: '32px'
                        }}>
                          <div style={{ 
                            fontWeight: '600', 
                            color: selectedPrimaryId === client.id ? '#166534' : '#1F2937',
                            fontSize: '16px',
                            marginBottom: '8px'
                          }}>
                            {client.name}
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: selectedPrimaryId === client.id ? '#16A34A' : '#6B7280',
                            marginBottom: '4px'
                          }}>
                            🔑 <strong>Clave:</strong> {client.clientCode} | 📞 <strong>Teléfono:</strong> {client.phone}
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: selectedPrimaryId === client.id ? '#16A34A' : '#9CA3AF',
                            marginBottom: '4px'
                          }}>
                            📍 {client.location} | 🏘️ {client.municipality} | 🏛️ {client.state}
                          </div>
                          
                          {/* Conteo de créditos */}
                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: selectedPrimaryId === client.id ? '#ECFDF5' : '#F3F4F6',
                            borderRadius: '6px',
                            border: `1px solid ${selectedPrimaryId === client.id ? '#D1FAE5' : '#E5E7EB'}`
                          }}>
                            {/* Créditos como Cliente */}
                            <div style={{
                              flex: 1,
                              textAlign: 'center',
                              padding: '4px',
                              backgroundColor: selectedPrimaryId === client.id ? '#DCFCE7' : '#E5E7EB',
                              borderRadius: '4px'
                            }}>
                              <div style={{
                                fontSize: '10px',
                                color: selectedPrimaryId === client.id ? '#166534' : '#6B7280',
                                fontWeight: '600',
                                marginBottom: '2px'
                              }}>
                                👤 Como Cliente
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '700',
                                color: selectedPrimaryId === client.id ? '#16A34A' : '#374151'
                              }}>
                                {client.totalLoans || 0}
                              </div>
                              <div style={{
                                fontSize: '9px',
                                color: selectedPrimaryId === client.id ? '#16A34A' : '#6B7280'
                              }}>
                                Activos: {client.activeLoans || 0}
                              </div>
                            </div>

                            {/* Créditos como Aval */}
                            <div style={{
                              flex: 1,
                              textAlign: 'center',
                              padding: '4px',
                              backgroundColor: selectedPrimaryId === client.id ? '#FEE2E2' : '#E5E7EB',
                              borderRadius: '4px'
                            }}>
                              <div style={{
                                fontSize: '10px',
                                color: selectedPrimaryId === client.id ? '#DC2626' : '#6B7280',
                                fontWeight: '600',
                                marginBottom: '2px'
                              }}>
                                🤝 Como Aval
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '700',
                                color: selectedPrimaryId === client.id ? '#DC2626' : '#374151'
                              }}>
                                {client.collateralLoans || 0}
                              </div>
                              <div style={{
                                fontSize: '9px',
                                color: selectedPrimaryId === client.id ? '#DC2626' : '#6B7280'
                              }}>
                                Total avales
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Botón para seleccionar como principal */}
                        {selectedPrimaryId !== client.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetPrimaryClient(client.id);
                            }}
                            style={{
                              marginTop: '12px',
                              padding: '8px 16px',
                              background: '#3B82F6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            Seleccionar como Principal
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Instrucciones */}
                  {mergeClientsList.length === 2 && !selectedPrimaryId && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#FEF3C7',
                      border: '1px solid #F59E0B',
                      borderRadius: '6px',
                      marginTop: '16px'
                    }}>
                      <p style={{
                        margin: 0,
                        fontSize: '14px',
                        color: '#92400E',
                        textAlign: 'center'
                      }}>
                        ⚠️ Haz clic en el cliente que quieres mantener como principal
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Botones de acción */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '24px'
              }}>
                <Button
                  onClick={handleCloseMergeModal}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6B7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleExecuteMerge}
                  disabled={mergeClientsList.length !== 2 || !selectedPrimaryId || mergeLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: (mergeClientsList.length !== 2 || !selectedPrimaryId || mergeLoading) ? '#9CA3AF' : '#DC2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (mergeClientsList.length !== 2 || !selectedPrimaryId || mergeLoading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {mergeLoading ? 'Fusionando...' : 'Fusionar Clientes'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación personalizado */}
        {showConfirmModal && confirmData && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              minWidth: isMobile ? '90%' : '400px',
              maxWidth: isMobile ? '95%' : '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px rgba(0, 0, 0, 0.3)',
              animation: 'modalSlideIn 0.3s ease-out'
            }}>
              {/* Icono según el tipo */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                margin: '0 auto 16px',
                backgroundColor: confirmData.type === 'danger' ? '#FEE2E2' : 
                                confirmData.type === 'warning' ? '#FEF3C7' : '#EFF6FF',
                border: `3px solid ${confirmData.type === 'danger' ? '#FECACA' : 
                                  confirmData.type === 'warning' ? '#FDE68A' : '#BFDBFE'}`
              }}>
                <span style={{
                  fontSize: '32px',
                  color: confirmData.type === 'danger' ? '#DC2626' : 
                         confirmData.type === 'warning' ? '#D97706' : '#2563EB'
                }}>
                  {confirmData.type === 'danger' ? '⚠️' : 
                   confirmData.type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
              </div>

              {/* Título */}
              <h2 style={{
                margin: '0 0 16px 0',
                fontSize: '20px',
                fontWeight: '600',
                color: '#1F2937',
                textAlign: 'center'
              }}>
                {confirmData.title}
              </h2>

              {/* Mensaje */}
              <div style={{
                fontSize: '14px',
                color: '#6B7280',
                lineHeight: '1.6',
                marginBottom: '24px',
                textAlign: 'center',
                whiteSpace: 'pre-line'
              }}>
                {confirmData.message}
              </div>

              {/* Botones */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                {confirmData.cancelText && (
                  <Button
                    onClick={handleCancel}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#6B7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#4B5563';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#6B7280';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {confirmData.cancelText}
                  </Button>
                )}
                <Button
                  onClick={handleConfirm}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: confirmData.type === 'danger' ? '#DC2626' : 
                                   confirmData.type === 'warning' ? '#D97706' : '#2563EB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    const baseColor = confirmData.type === 'danger' ? '#B91C1C' : 
                                     confirmData.type === 'warning' ? '#B45309' : '#1D4ED8';
                    e.currentTarget.style.backgroundColor = baseColor;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    const baseColor = confirmData.type === 'danger' ? '#DC2626' : 
                                     confirmData.type === 'warning' ? '#D97706' : '#2563EB';
                    e.currentTarget.style.backgroundColor = baseColor;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {confirmData.confirmText || 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default HistorialClientePage; 