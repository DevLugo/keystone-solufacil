/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, jsx, Stack, Text } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { AlertDialog } from '@keystone-ui/modals';
import { FaSearch, FaEye, FaEdit, FaTrash, FaUser, FaUserTie, FaMoneyBillWave, FaCalendarAlt } from 'react-icons/fa';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import RouteLeadSelector from '../components/routes/RouteLeadSelector';
import { InlineEditField } from '../components/documents/InlineEditField';
import { Select } from '@keystone-ui/fields';
import { DocumentThumbnail } from '../components/documents/DocumentThumbnail';
import { ImageModal } from '../components/documents/ImageModal';
import { UploadModal } from '../components/documents/UploadModal';
import { DocumentsModal } from '../components/documents/DocumentsModal';
import { ErrorModal } from '../components/documents/ErrorModal';
import { UPDATE_PERSONAL_DATA_NAME, UPDATE_PERSONAL_DATA_PHONE, CREATE_PERSONAL_DATA_PHONE } from '../graphql/mutations/personalData';
import type { Route, Employee } from '../types/transaction';

// Query para obtener préstamos con información de documentos
const GET_LOANS_WITH_DOCUMENTS = gql`
  query GetLoansWithDocuments($date: DateTime!, $nextDate: DateTime!) {
    loans(
      where: {
        AND: [
          { signDate: { gte: $date } }
          { signDate: { lt: $nextDate } }
          { finishedDate: { equals: null } }
        ]
      }
      orderBy: { signDate: desc }
    ) {
      id
      requestedAmount
      signDate
      createdAt
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            id
            number
          }
        }
      }
      lead {
        id
        personalData {
          id
          fullName
          phones {
            id
            number
          }
        }
        routes {
          id
          name
        }
      }
      documentPhotos {
        id
        title
        description
        photoUrl
        publicId
        documentType
        isError
        errorDescription
        createdAt
        personalData {
          id
          fullName
        }
      }
    }
  }
`;

// Mutation para crear documento
const CREATE_DOCUMENT_PHOTO = gql`
  mutation CreateDocumentPhoto($data: DocumentPhotoCreateInput!) {
    createDocumentPhoto(data: $data) {
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
        requestedAmount
      }
    }
  }
`;

// Mutation para eliminar documento
const DELETE_DOCUMENT_PHOTO = gql`
  mutation DeleteDocumentPhoto($id: ID!) {
    deleteDocumentPhoto(where: { id: $id }) {
      id
    }
  }
`;

// Mutation para actualizar estado de error del documento
const UPDATE_DOCUMENT_PHOTO_ERROR = gql`
  mutation UpdateDocumentPhotoError($id: ID!, $isError: Boolean!, $errorDescription: String) {
    updateDocumentPhoto(where: { id: $id }, data: { isError: $isError, errorDescription: $errorDescription }) {
      id
      isError
      errorDescription
    }
  }
`;

// Tipos de documentos permitidos
const DOCUMENT_TYPES: Array<'INE' | 'DOMICILIO' | 'PAGARE'> = ['INE', 'DOMICILIO', 'PAGARE'];

const DOCUMENT_TYPES_TITULAR: Array<'INE' | 'DOMICILIO' | 'PAGARE'> = ['INE', 'DOMICILIO', 'PAGARE'];
const DOCUMENT_TYPES_AVAL: Array<'INE' | 'DOMICILIO'> = ['INE', 'DOMICILIO'];

// Función para obtener el label legible del tipo de documento
const getTypeLabel = (type: 'INE' | 'DOMICILIO' | 'PAGARE') => {
  switch (type) {
    case 'INE':
      return 'INE';
    case 'DOMICILIO':
      return 'Domicilio';
    case 'PAGARE':
      return 'Pagaré';
    default:
      return type;
  }
};

// Interfaces
interface DocumentPhoto {
  id: string;
  title: string;
  description?: string;
  photoUrl: string;
  publicId: string;
  documentType: 'INE' | 'DOMICILIO' | 'PAGARE';
  isError: boolean;
  errorDescription?: string;
  createdAt: string;
  personalData: {
    id: string;
    fullName: string;
  };
  loan: {
    id: string;
    requestedAmount: string;
  };
}

interface Loan {
  id: string;
  requestedAmount: string;
  signDate: string;
  createdAt: string;
  borrower: {
    id: string;
    personalData: {
      id: string;
      fullName: string;
      phones: Array<{ id: string; number: string }>;
    };
  };
  lead: {
    id: string;
    personalData: {
      id: string;
      fullName: string;
      phones: Array<{ id: string; number: string }>;
    };
    routes: Array<{ id: string; name: string }>;
  };
  documentPhotos: DocumentPhoto[];
}

export default function DocumentosPersonalesPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  
  // Estado para modal de confirmación de eliminación
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    documentId: string | null;
    documentTitle: string;
  }>({
    isOpen: false,
    documentId: null,
    documentTitle: ''
  });
  

  // Estados para el DatePicker de semanas
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return now;
    } catch (error) {
      return new Date('2025-01-01T00:00:00.000Z');
    }
  });

  // Estado para el selector de semanas
  const [selectedWeek, setSelectedWeek] = useState<{ label: string; value: string } | null>(() => {
    // Inicializar con la semana actual
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (today.getDay() + 6));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const label = `${weekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')}`;
    const value = weekStart.toISOString();
    
    return { label, value };
  });

  // Generar opciones de semanas (últimas 12 semanas)
  const weekOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (today.getDay() + 6) - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const label = `${weekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')}`;
      const value = weekStart.toISOString();
      
      options.push({ label, value });
    }
    
    return options;
  }, []);

  // Estados para RouteLeadSelector
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedLead, setSelectedLead] = useState<Employee | null>(null);

  // Estados para modales
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    title: string;
    description?: string;
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

  const [uploadModal, setUploadModal] = useState<{
    isOpen: boolean;
    documentType: 'INE' | 'DOMICILIO' | 'PAGARE';
    personType: 'TITULAR' | 'AVAL';
    personalDataId: string;
    loanId: string;
    personName: string;
  }>({
    isOpen: false,
    documentType: 'INE',
    personType: 'TITULAR',
    personalDataId: '',
    loanId: '',
    personName: ''
  });

  const [documentsModal, setDocumentsModal] = useState<{
    isOpen: boolean;
    loan: Loan | null;
  }>({
    isOpen: false,
    loan: null
  });

  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    documentId: string | null;
    documentType: string;
    personType: string;
    existingError: string;
  }>({
    isOpen: false,
    documentId: null,
    documentType: '',
    personType: '',
    existingError: ''
  });

  // Estados para edición inline
  const [editingField, setEditingField] = useState<{
    type: 'name' | 'phone';
    personalDataId: string;
    phoneId?: string;
  } | null>(null);

  // Función para obtener el fin de la semana (domingo) basada en la fecha de inicio
  const getEndOfWeek = (startDate: Date): Date => {
    const endOfWeek = new Date(startDate);
    endOfWeek.setDate(startDate.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return endOfWeek;
  };

  // Query para obtener préstamos
  const { data, loading: queryLoading, error: queryError, refetch } = useQuery(GET_LOANS_WITH_DOCUMENTS, {
    variables: {
      date: selectedDate.toISOString(),
      nextDate: getEndOfWeek(selectedDate).toISOString()
    },
    fetchPolicy: 'cache-and-network'
  });

  // Mutations
  const [createDocumentPhoto] = useMutation(CREATE_DOCUMENT_PHOTO);
  const [deleteDocumentPhoto] = useMutation(DELETE_DOCUMENT_PHOTO);
  const [updateDocumentPhotoError] = useMutation(UPDATE_DOCUMENT_PHOTO_ERROR);
  const [updatePersonalDataName] = useMutation(UPDATE_PERSONAL_DATA_NAME);
  const [updatePersonalDataPhone] = useMutation(UPDATE_PERSONAL_DATA_PHONE);
  const [createPersonalDataPhone] = useMutation(CREATE_PERSONAL_DATA_PHONE);

  // Efecto para actualizar préstamos cuando cambia la query
  useEffect(() => {
    if (data?.loans) {
      setLoans(data.loans);
      setLoading(false);
    }
  }, [data]);

  // Efecto para actualizar el modal de documentos cuando cambia el estado de los préstamos
  useEffect(() => {
    if (documentsModal.isOpen && documentsModal.loan) {
      const updatedLoan = loans.find(loan => loan.id === documentsModal.loan?.id);
      if (updatedLoan) {
        setDocumentsModal(prev => ({
          ...prev,
          loan: updatedLoan
        }));
      }
    }
  }, [loans, documentsModal.isOpen, documentsModal.loan?.id]);

  // Efecto para manejar errores
  useEffect(() => {
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
    }
  }, [queryError]);

  // Efecto para validar que selectedDate sea siempre válida


  // Función para obtener documentos por tipo y persona
  const getDocumentByTypeAndPerson = (
    documents: DocumentPhoto[],
    type: 'INE' | 'DOMICILIO' | 'PAGARE',
    personalDataId: string
  ): DocumentPhoto | null => {
    return documents.find(doc => 
      doc.documentType === type && doc.personalData.id === personalDataId
    ) || null;
  };

  // Función para manejar la subida de documentos
  const handleDocumentUpload = async (data: {
    title: string;
    description: string;
    photoUrl: string;
    publicId: string;
    documentType: 'INE' | 'DOMICILIO' | 'PAGARE';
    personalDataId: string;
    loanId: string;
    isError: boolean;
    errorDescription: string;
  }) => {
    try {
      await createDocumentPhoto({
        variables: {
          data: {
            title: data.title,
            description: data.description,
            photoUrl: data.photoUrl,
            publicId: data.publicId,
            documentType: data.documentType,
            isError: data.isError,
            errorDescription: data.errorDescription,
            personalData: { connect: { id: data.personalDataId } },
            loan: { connect: { id: data.loanId } }
          }
        }
      });

      // Refrescar datos
      refetch();
    } catch (error) {
      console.error('Error al crear documento:', error);
      throw error;
    }
  };

  // Función para eliminar documento
  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocumentPhoto({
        variables: { id: documentId }
      });

      // Actualizar estado local inmediatamente
      setLoans(prevLoans => 
        prevLoans.map(loan => ({
          ...loan,
          documentPhotos: loan.documentPhotos.filter(doc => doc.id !== documentId)
        }))
      );

      // Refrescar datos en segundo plano
      refetch();
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      alert('Error al eliminar el documento');
    }
  };

  // Función para manejar el estado de error del documento
  const handleDocumentError = async (documentId: string, isError: boolean, errorDescription?: string) => {
    try {
      await updateDocumentPhotoError({
        variables: { 
          id: documentId, 
          isError, 
          errorDescription: errorDescription || null 
        }
      });

      // Refrescar datos
      refetch();
    } catch (error) {
      console.error('Error al actualizar estado del documento:', error);
      alert('Error al actualizar el estado del documento');
    }
  };

  // Función para manejar el click en marcar como error
  const handleMarkAsError = (documentId: string, isError: boolean, errorDescription?: string) => {
    // Buscar el documento para obtener su tipo y persona
    const document = loans
      .flatMap(loan => loan.documentPhotos)
      .find(doc => doc.id === documentId);
    
    if (document) {
      const personType = document.personalData.id === 
        loans.find(loan => loan.documentPhotos.some(doc => doc.id === documentId))?.borrower.personalData.id 
        ? 'TITULAR' : 'AVAL';
      
      // Usar la descripción del error del documento real, no la que viene del componente
      const existingErrorDescription = document.errorDescription || '';
      
      if (isError) {
        // Si ya está marcado como error, mostrar/editar el error
        openErrorModal(documentId, document.documentType, personType, existingErrorDescription);
      } else {
        // Si no está marcado como error, abrir modal para nuevo error
        openErrorModal(documentId, document.documentType, personType, '');
      }
    }
  };

  // Función para abrir modal de confirmación de eliminación
  const handleDocumentDelete = (documentId: string, documentTitle: string) => {
    setDeleteConfirmDialog({
      isOpen: true,
      documentId,
      documentTitle
    });
  };

  // Función para confirmar eliminación
  const confirmDeleteDocument = async () => {
    if (!deleteConfirmDialog.documentId) return;

    try {
      await deleteDocumentPhoto({
        variables: { id: deleteConfirmDialog.documentId }
      });

      // Actualizar estado local inmediatamente
      setLoans(prevLoans => 
        prevLoans.map(loan => ({
          ...loan,
          documentPhotos: loan.documentPhotos.filter(doc => doc.id !== deleteConfirmDialog.documentId)
        }))
      );

      // Cerrar modal
      setDeleteConfirmDialog({
        isOpen: false,
        documentId: null,
        documentTitle: ''
      });

      // Refrescar datos en segundo plano
      refetch();
    } catch (error) {
      console.error('Error al eliminar el documento:', error);
      alert('Error al eliminar el documento');
    }
  };

  // Función para cancelar eliminación
  const cancelDeleteDocument = () => {
    setDeleteConfirmDialog({
      isOpen: false,
      documentId: null,
      documentTitle: ''
    });
  };

  // Función para abrir modal de subida
  const openUploadModal = (
    documentType: 'INE' | 'DOMICILIO' | 'PAGARE',
    personType: 'TITULAR' | 'AVAL',
    personalDataId: string,
    loanId: string,
    personName: string
  ) => {
    setUploadModal({
      isOpen: true,
      documentType,
      personType,
      personalDataId,
      loanId,
      personName
    });
  };

  // Función para abrir modal de documentos
  const openDocumentsModal = (loan: Loan) => {
    setDocumentsModal({
      isOpen: true,
      loan
    });
  };

  // Función para cerrar modal de documentos
  const closeDocumentsModal = () => {
    setDocumentsModal({
      isOpen: false,
      loan: null
    });
  };

  // Función para abrir modal de error
  const openErrorModal = (documentId: string, documentType: string, personType: string, existingError: string = '') => {
    setErrorModal({
      isOpen: true,
      documentId,
      documentType,
      personType,
      existingError
    });
  };

  // Función para cerrar modal de error
  const closeErrorModal = () => {
    setErrorModal({
      isOpen: false,
      documentId: null,
      documentType: '',
      personType: '',
      existingError: ''
    });
  };

  // Función para confirmar error
  const confirmError = async (errorDescription: string) => {
    if (!errorModal.documentId) return;

    try {
      await handleDocumentError(errorModal.documentId, true, errorDescription);
      closeErrorModal();
    } catch (error) {
      console.error('Error al marcar documento como error:', error);
    }
  };

  // Función para abrir modal de imagen
  const openImageModal = (document: DocumentPhoto, personType: 'TITULAR' | 'AVAL') => {
    setImageModal({
      isOpen: true,
      imageUrl: document.photoUrl,
      title: document.title,
      description: document.description,
      documentType: document.documentType,
      personType
    });
  };

  // Función para manejar edición inline de nombres
  const handleNameEdit = async (personalDataId: string, newName: string) => {
    try {
      await updatePersonalDataName({
        variables: {
          id: personalDataId,
          data: { fullName: newName }
        }
      });
      refetch();
    } catch (error) {
      console.error('Error al actualizar nombre:', error);
      alert('Error al actualizar el nombre');
    }
  };

  // Función para manejar edición inline de teléfonos
  const handlePhoneEdit = async (personalDataId: string, phoneId: string | undefined, newPhone: string) => {
    try {
      if (phoneId) {
        // Actualizar teléfono existente
        await updatePersonalDataPhone({
          variables: {
            id: phoneId,
            data: { number: newPhone }
          }
        });
      } else {
        // Crear nuevo teléfono
        await createPersonalDataPhone({
          variables: {
            data: {
              number: newPhone,
              personalData: { connect: { id: personalDataId } }
            }
          }
        });
      }
      refetch();
    } catch (error) {
      console.error('Error al actualizar teléfono:', error);
      alert('Error al actualizar el teléfono');
    }
  };

  // Filtrar préstamos por término de búsqueda, ruta y localidad
  const filteredLoans = loans.filter(loan => {
    // Filtro por término de búsqueda
    const searchLower = searchTerm.toLowerCase();
    const borrowerName = loan.borrower.personalData.fullName.toLowerCase();
    const leadName = loan.lead.personalData.fullName.toLowerCase();
    const borrowerPhone = loan.borrower.personalData.phones[0]?.number || '';
    const leadPhone = loan.lead.personalData.phones[0]?.number || '';
    
    const matchesSearch = borrowerName.includes(searchLower) || 
                         leadName.includes(searchLower) ||
                         borrowerPhone.includes(searchTerm) ||
                         leadPhone.includes(searchTerm);
    
    // Filtro por ruta seleccionada
    let matchesRoute = true;
    if (selectedRoute) {
      // Verificar si el préstamo pertenece a la ruta seleccionada
      const loanRoutes = loan.lead.routes;
      
      // Debug: ver qué está llegando
      console.log('Debug - loan.lead.routes:', loanRoutes);
      console.log('Debug - typeof loanRoutes:', typeof loanRoutes);
      console.log('Debug - Array.isArray(loanRoutes):', Array.isArray(loanRoutes));
      
      // Verificar que routes sea un array antes de usar .some()
      if (Array.isArray(loanRoutes)) {
        matchesRoute = loanRoutes.some((route: any) => route.id === selectedRoute.id);
      } else if (loanRoutes && typeof loanRoutes === 'object' && 'id' in loanRoutes) {
        // Si routes es un objeto (relación directa), verificar por ID
        matchesRoute = (loanRoutes as any).id === selectedRoute.id;
      } else {
        // Si no hay routes o es null/undefined, no coincide
        matchesRoute = false;
      }
      
      console.log('Debug - matchesRoute:', matchesRoute);
    }
    
    // Filtro por localidad seleccionada
    let matchesLead = true;
    if (selectedLead) {
      // Verificar si el préstamo tiene el líder seleccionado
      matchesLead = loan.lead.id === selectedLead.id;
    }
    
    return matchesSearch && matchesRoute && matchesLead;
  });

  // Función para verificar si un préstamo tiene todos los documentos requeridos y sin errores
  const isLoanComplete = (loan: any) => {
    const documents = loan.documentPhotos;
    
    // Verificar que no haya documentos con errores
    const hasErrors = documents.some((doc: any) => doc.isError);
    if (hasErrors) return false;
    
    // Contar documentos por tipo y persona
    const titularDocs = documents.filter((doc: any) => 
      doc.personalData.id === loan.borrower.personalData.id
    );
    const avalDocs = documents.filter((doc: any) => 
      doc.personalData.id === loan.lead.personalData.id
    );
    
    // Verificar documentos del TITULAR (INE, DOMICILIO, PAGARE)
    const hasTitularINE = titularDocs.some((doc: any) => doc.documentType === 'INE');
    const hasTitularDOMICILIO = titularDocs.some((doc: any) => doc.documentType === 'DOMICILIO');
    const hasTitularPAGARE = titularDocs.some((doc: any) => doc.documentType === 'PAGARE');
    
    // Verificar documentos del AVAL (INE, DOMICILIO)
    const hasAvalINE = avalDocs.some((doc: any) => doc.documentType === 'INE');
    const hasAvalDOMICILIO = avalDocs.some((doc: any) => doc.documentType === 'DOMICILIO');
    
    // Un préstamo está completo si tiene todos los documentos requeridos sin errores
    return hasTitularINE && hasTitularDOMICILIO && hasTitularPAGARE && hasAvalINE && hasAvalDOMICILIO;
  };

  // Calcular estadísticas basadas en los préstamos filtrados
  const totalCredits = filteredLoans.length;
  const creditsWithDocuments = filteredLoans.filter(loan => isLoanComplete(loan)).length;
  const totalDocuments = filteredLoans.reduce((total, loan) => total + loan.documentPhotos.length, 0);
  const creditsWithoutDocuments = totalCredits - creditsWithDocuments;

  if (loading) {
    return (
      <PageContainer header="Documentos Personales">
        <Box padding="large" css={{ display: 'flex', justifyContent: 'center' }}>
          <LoadingDots label="Cargando documentos..." />
        </Box>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer header="Documentos Personales">
        <Box padding="large">
          <GraphQLErrorNotice errors={[{ message: error }]} networkError={null} />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer header="Documentos Personales">
      <Box padding="large" css={{ 
        width: '100%', 
        maxWidth: '100%',
        paddingLeft: '8px',
        paddingRight: '8px',
        overflow: 'hidden',
        '@media (max-width: 768px)': {
          paddingLeft: '4px',
          paddingRight: '4px'
        },
        // Animaciones CSS
        '@keyframes bounce': {
          '0%, 20%, 50%, 80%, 100%': {
            transform: 'translateY(0)'
          },
          '40%': {
            transform: 'translateY(-4px)'
          },
          '60%': {
            transform: 'translateY(-2px)'
          }
        },
        '@keyframes fadeInUp': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        }
      }}>
        {/* Header con selector de semanas y filtros */}
        <Box
          css={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '20px',
            alignItems: 'start',
            marginBottom: '24px',
            width: '100%',
            '@media (max-width: 768px)': {
              gridTemplateColumns: '1fr',
              gap: '16px'
            }
          }}
        >
                      {/* Selector simple de semanas */}
            <Box css={{ width: '100%' }}>
              <Text weight="medium" size="small" color="black" marginBottom="small">
                Seleccionar Semana
              </Text>
              <Select
                value={selectedWeek}
                onChange={(option) => {
                  if (option) {
                    setSelectedWeek(option);
                    // Extraer la fecha del lunes de la opción seleccionada
                    const mondayDate = new Date(option.value);
                    setSelectedDate(mondayDate);
                  }
                }}
                options={weekOptions}
                placeholder="Selecciona una semana"
              />
            </Box>

          {/* RouteLeadSelector */}
          <RouteLeadSelector
            selectedRoute={selectedRoute}
            selectedLead={selectedLead}
            selectedDate={selectedDate}
            onRouteSelect={setSelectedRoute}
            onLeadSelect={setSelectedLead}
            onDateSelect={setSelectedDate}
            hideDateField={true}
          />
        </Box>

        {/* Estadísticas */}
        <Box
          css={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
            width: '100%'
          }}
        >
          <Box
            css={{
              padding: '20px',
              backgroundColor: '#f0fdf4',
              borderRadius: '12px',
              border: '1px solid #bbf7d0',
              textAlign: 'center'
            }}
          >
            <Text weight="bold" size="large" color="green600">
              {totalCredits}
            </Text>
            <Text size="small" color="neutral600">
              CRÉDITOS COMPLETOS
            </Text>
            <Text size="small" color="green600" weight="medium">
              Completos: {creditsWithDocuments}
            </Text>
          </Box>

          <Box
            css={{
              padding: '20px',
              backgroundColor: '#eff6ff',
              borderRadius: '12px',
              border: '1px solid #bfdbfe',
              textAlign: 'center'
            }}
          >
            <Text weight="bold" size="large" color="blue600">
              {totalDocuments}
            </Text>
            <Text size="small" color="neutral600">
              TOTAL DE DOCUMENTOS
            </Text>
            <Text size="small" color="blue600" weight="medium">
              Fotos subidas
            </Text>
          </Box>

          <Box
            css={{
              padding: '20px',
              backgroundColor: '#fef2f2',
              borderRadius: '12px',
              border: '1px solid #fecaca',
              textAlign: 'center'
            }}
          >
            <Text weight="bold" size="large" color="red600">
              {creditsWithoutDocuments}
            </Text>
            <Text size="small" color="neutral600">
              CRÉDITOS SIN DOCUMENTOS
            </Text>
            <Text size="small" color="red600" weight="medium">
              Pendientes
            </Text>
          </Box>
        </Box>

        {/* Barra de búsqueda */}
        <Box
          css={{
            marginBottom: '24px',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            '@media (max-width: 768px)': {
              flexDirection: 'column',
              alignItems: 'stretch'
            }
          }}
        >
          <Box css={{ flex: 1, position: 'relative' }}>
            <FaSearch
              css={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                fontSize: '16px'
              }}
            />
            <TextInput
              placeholder="Buscar por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              css={{
                paddingLeft: '40px',
                width: '100%'
              }}
            />
          </Box>
        </Box>

        {/* Lista de créditos */}
        <Box css={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredLoans.map((loan) => {
            const isExpanded = selectedLoan?.id === loan.id;
            const borrowerDocuments = loan.documentPhotos.filter(doc => 
              doc.personalData.id === loan.borrower.personalData.id
            );
            const leadDocuments = loan.documentPhotos.filter(doc => 
              doc.personalData.id === loan.lead.personalData.id
            );

            return (
              <Box
                key={loan.id}
                css={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  animation: 'fadeInUp 0.5s ease-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                  },
                  '@media (max-width: 768px)': {
                    borderRadius: '12px',
                    margin: '0 4px'
                  }
                }}
              >
                {/* Header del crédito */}
                <Box
                  css={{
                    padding: '16px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': { 
                      backgroundColor: '#f8fafc',
                      transform: 'translateY(-1px)'
                    },
                    '@media (max-width: 768px)': {
                      padding: '12px'
                    }
                  }}
                >
                  <Box
                    css={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      alignItems: 'start',
                      '@media (max-width: 768px)': {
                        gridTemplateColumns: '1fr',
                        gap: '12px'
                      }
                    }}
                  >
                    {/* Columna izquierda */}
                    <Box css={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Box css={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaCalendarAlt color="#6b7280" />
                        <Text size="small" color="black" weight="medium">
                          {new Date(loan.signDate).toLocaleDateString('es-ES')}
                        </Text>
                      </Box>

                      <Box css={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaUser color="#6b7280" />
                        <Text size="small" color="black" weight="medium" css={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {loan.borrower.personalData.fullName}
                        </Text>
                      </Box>

                      <Box css={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaMoneyBillWave color="#6b7280" />
                        <Text size="small" color="black" weight="bold">
                          ${parseFloat(loan.requestedAmount).toLocaleString()}
                        </Text>
                      </Box>
                    </Box>

                    {/* Columna derecha */}
                    <Box css={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Box css={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaUserTie color="#6b7280" />
                        <Text size="small" color="black" weight="medium" css={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {loan.lead.personalData.fullName}
                        </Text>
                      </Box>

                      <Box css={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Text size="small" color="black" weight="medium">
                          📄 {loan.documentPhotos.length} docs
                        </Text>
                      </Box>
                    </Box>

                  </Box>

                  {/* Tags de documentos */}
                  <Box css={{ 
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    {/* Tags del Titular */}
                    <Box css={{ marginBottom: '8px' }}>
                      <Text size="xsmall" color="neutral700" css={{ 
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        👤 Titular:
                      </Text>
                      <Box css={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {DOCUMENT_TYPES_TITULAR.map((type) => {
                          const document = getDocumentByTypeAndPerson(
                            borrowerDocuments,
                            type,
                            loan.borrower.personalData.id
                          );
                          const hasDocument = !!document;
                          const hasError = hasDocument && document.isError;
                          
                          return (
                            <Box
                              key={`collapsed-titular-${type}`}
                              css={{
                                padding: '2px 6px',
                                borderRadius: '6px',
                                fontSize: '9px',
                                fontWeight: '600',
                                backgroundColor: hasError 
                                  ? 'rgba(239, 68, 68, 0.2)' 
                                  : hasDocument 
                                    ? 'rgba(34, 197, 94, 0.2)' 
                                    : '#f3f4f6',
                                color: hasError 
                                  ? '#dc2626' 
                                  : hasDocument 
                                    ? '#166534' 
                                    : '#6b7280',
                                border: hasError 
                                  ? '1px solid rgba(239, 68, 68, 0.3)' 
                                  : hasDocument 
                                    ? '1px solid rgba(34, 197, 94, 0.3)' 
                                    : '1px solid #e5e7eb'
                              }}
                              title={hasError ? `Error: ${document.errorDescription || 'Documento marcado como error'}` : undefined}
                            >
                              {getTypeLabel(type)}
                              {hasError && ' ⚠️'}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* Tags del Aval */}
                    <Box css={{ marginBottom: '12px' }}>
                      <Text size="xsmall" color="neutral700" css={{ 
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        🤝 Aval:
                      </Text>
                      <Box css={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {DOCUMENT_TYPES_AVAL.map((type) => {
                          const document = getDocumentByTypeAndPerson(
                            leadDocuments,
                            type,
                            loan.lead.personalData.id
                          );
                          const hasDocument = !!document;
                          const hasError = hasDocument && document.isError;
                          
                          return (
                            <Box
                              key={`collapsed-aval-${type}`}
                              css={{
                                padding: '2px 6px',
                                borderRadius: '6px',
                                fontSize: '9px',
                                fontWeight: '600',
                                backgroundColor: hasError 
                                  ? 'rgba(239, 68, 68, 0.2)' 
                                  : hasDocument 
                                    ? 'rgba(34, 197, 94, 0.2)' 
                                    : '#f3f4f6',
                                color: hasError 
                                  ? '#dc2626' 
                                  : hasDocument 
                                    ? '#166534' 
                                    : '#6b7280',
                                border: hasError 
                                  ? '1px solid rgba(239, 68, 68, 0.3)' 
                                  : hasDocument 
                                    ? '1px solid rgba(34, 197, 94, 0.3)' 
                                    : '1px solid #e5e7eb'
                              }}
                              title={hasError ? `Error: ${document.errorDescription || 'Documento marcado como error'}` : undefined}
                            >
                              {getTypeLabel(type)}
                              {hasError && ' ⚠️'}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* Botón Ver */}
                    <Button
                      size="small"
                      onClick={() => openDocumentsModal(loan)}
                      css={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        width: '100%',
                        '&:hover': {
                          backgroundColor: '#2563eb'
                        }
                      }}
                    >
                      Ver
                    </Button>
                  </Box>
                </Box>

              </Box>
            );
          })}
        </Box>

        {/* Mensaje cuando no hay créditos */}
        {filteredLoans.length === 0 && (
          <Box
            css={{
              textAlign: 'center',
              padding: '40px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}
          >
            <Text size="large" color="black">
              No se encontraron créditos para la semana seleccionada
            </Text>
            <Text size="small" marginTop="small">
              Intenta seleccionar otra semana o ajustar los filtros
            </Text>
          </Box>
        )}
      </Box>

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

      {/* Modal de subida */}
      <UploadModal
        isOpen={uploadModal.isOpen}
        onClose={() => setUploadModal({ ...uploadModal, isOpen: false })}
        onUpload={handleDocumentUpload}
        documentType={uploadModal.documentType}
        personType={uploadModal.personType}
        personalDataId={uploadModal.personalDataId}
        loanId={uploadModal.loanId}
        personName={uploadModal.personName}
      />

      {/* Modal de confirmación de eliminación */}
      <AlertDialog
        isOpen={deleteConfirmDialog.isOpen}
        title="Confirmar eliminación"
        tone="negative"
        actions={{
          confirm: {
            label: 'Eliminar',
            action: confirmDeleteDocument,
          },
          cancel: {
            label: 'Cancelar',
            action: cancelDeleteDocument,
          },
        }}
      >
        ¿Estás seguro de que quieres eliminar el documento "{deleteConfirmDialog.documentTitle}"?
        <br />
        <br />
        Esta acción no se puede deshacer.
      </AlertDialog>

      {/* Modal de documentos */}
      <DocumentsModal
        isOpen={documentsModal.isOpen}
        onClose={closeDocumentsModal}
        loan={documentsModal.loan}
        onDocumentUpload={(data) => {
          // Cerrar modal de documentos y abrir modal de subida
          closeDocumentsModal();
          setUploadModal({
            isOpen: true,
            documentType: data.documentType,
            personType: data.personType,
            personalDataId: data.personalDataId,
            loanId: data.loanId,
            personName: data.personName
          });
        }}
        onDocumentError={handleMarkAsError}
        onDocumentDelete={handleDocumentDelete}
        onNameEdit={handleNameEdit}
        onPhoneEdit={handlePhoneEdit}
      />

      {/* Modal de error */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={closeErrorModal}
        onConfirm={confirmError}
        documentType={errorModal.documentType}
        personType={errorModal.personType}
        existingError={errorModal.existingError}
      />
    </PageContainer>
  );
}
