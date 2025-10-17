/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, jsx, Text } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput, Select } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { AlertDialog } from '@keystone-ui/modals';
import { FaSearch, FaUser, FaUserTie, FaCalendarAlt, FaMapMarkerAlt, FaFilter } from 'react-icons/fa';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { GET_LEADS_SIMPLE } from '../graphql/queries/routes-optimized';
import { ImageModal } from '../components/documents/ImageModal';
import { UploadModal } from '../components/documents/UploadModal';
import { DocumentsModal } from '../components/documents/DocumentsModal';
import { ErrorModal } from '../components/documents/ErrorModal';
import { ToastContainer, ToastProps } from '../components/Toast';
import { UPDATE_PERSONAL_DATA_NAME, UPDATE_PERSONAL_DATA_PHONE, CREATE_PERSONAL_DATA_PHONE, UPDATE_DOCUMENT_PHOTO_MISSING } from '../graphql/mutations/personalData';

// Query para obtener rutas
const GET_ROUTES = gql`
  query GetRoutes {
    routes(where: {}) {
      id
      name
    }
  }
`;

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
        routes {
          id
          name
        }
      }
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
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
      documentPhotos {
        id
        title
        description
        photoUrl
        publicId
        documentType
        isError
        errorDescription
        isMissing
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
  isMissing: boolean;
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
  collaterals: Array<{
    id: string;
    fullName: string;
    phones: Array<{ id: string; number: string }>;
    addresses: Array<{
      location: {
        name: string;
        municipality: {
          state: {
            name: string;
          };
        };
      };
    }>;
  }>;
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
      // Inicializar con la semana anterior (no la semana actual)
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (today.getDay() + 6) - 7); // -7 días para ir a la semana anterior
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    } catch (error) {
      return new Date('2025-01-01T00:00:00.000Z');
    }
  });

  // Estado para el selector de semanas
  const [selectedWeek, setSelectedWeek] = useState<{ label: string; value: string } | null>(() => {
    // Inicializar con la semana anterior (no la semana actual)
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (today.getDay() + 6) - 7); // -7 días para ir a la semana anterior
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const label = `${weekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')}`;
    const value = weekStart.toISOString();
    
    return { label, value };
  });

  // Generar opciones de semanas (últimas 12 semanas, excluyendo la semana en curso)
  const weekOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    
    for (let i = 1; i <= 12; i++) {
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

  // Estados para rutas
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Array<{id: string; name: string}>>([]);
  
  // Estado para filtro de revisados/no revisados
  const [reviewFilter, setReviewFilter] = useState<'all' | 'reviewed' | 'not_reviewed'>('not_reviewed');
  const [showReviewFilter, setShowReviewFilter] = useState(false);
  
  // Estado para loader de cambio de ruta
  const [isChangingRoute, setIsChangingRoute] = useState(false);
  
  // Estados para filtro de localidad
  const [selectedLocality, setSelectedLocality] = useState<string>('');
  const [showLocalityFilter, setShowLocalityFilter] = useState(false);

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
    loan?: any;
  }>({
    isOpen: false,
    documentType: 'INE',
    personType: 'TITULAR',
    personalDataId: '',
    loanId: '',
    personName: '',
    loan: null
  });

  const [documentsModal, setDocumentsModal] = useState<{
    isOpen: boolean;
    loan: Loan | null;
    temporarilyClosed: boolean; // Para manejar el cierre temporal cuando se abre el modal de subir
  }>({
    isOpen: false,
    loan: null,
    temporarilyClosed: false
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

  // Estados para toasts
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  // Funciones para manejar toasts
  const addToast = (toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Date.now().toString();
    const newToast: ToastProps = {
      ...toast,
      id,
      onClose: removeToast
    };
    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Función para obtener el fin de la semana (domingo) basada en la fecha de inicio
  const getEndOfWeek = (startDate: Date): Date => {
    const endOfWeek = new Date(startDate);
    endOfWeek.setDate(startDate.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return endOfWeek;
  };

  // Query para obtener rutas
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES, {
    fetchPolicy: 'cache-first'
  });

  // Query para obtener los líderes de la ruta seleccionada (igual que en RouteLeadSelector)
  const { data: leadsData, loading: leadsLoading, error: leadsError } = useQuery(GET_LEADS_SIMPLE, {
    variables: { routeId: selectedRouteId || '' },
    skip: !selectedRouteId, // Solo ejecutar si hay una ruta seleccionada
    fetchPolicy: 'cache-first'
  });

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
  const [updateDocumentPhotoMissing] = useMutation(UPDATE_DOCUMENT_PHOTO_MISSING);
  const [updatePersonalDataName] = useMutation(UPDATE_PERSONAL_DATA_NAME);
  const [updatePersonalDataPhone] = useMutation(UPDATE_PERSONAL_DATA_PHONE);
  const [createPersonalDataPhone] = useMutation(CREATE_PERSONAL_DATA_PHONE);

  // Efecto para actualizar rutas cuando se cargan los datos
  useEffect(() => {
    if (routesData?.routes) {
      setRoutes(routesData.routes);
      // Seleccionar la primera ruta por defecto si no hay ninguna seleccionada
      if (routesData.routes.length > 0 && !selectedRouteId) {
        setSelectedRouteId(routesData.routes[0].id);
      }
    }
  }, [routesData, selectedRouteId]);

  // Efecto para actualizar préstamos cuando cambia la query
  useEffect(() => {
    if (data?.loans) {
      setLoans(data.loans);
      setLoading(false);
    }
  }, [data]);

  // Efecto para triggear búsqueda cuando cambia la ruta seleccionada
  useEffect(() => {
    if (selectedRouteId) {
      setIsChangingRoute(true);
      refetch().finally(() => {
        setIsChangingRoute(false);
      });
    }
  }, [selectedRouteId, refetch]);

  // Efecto para limpiar la localidad seleccionada cuando cambie la ruta
  useEffect(() => {
    setSelectedLocality('');
  }, [selectedRouteId]);

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
            isMissing: false, // Si tiene imagen, no es faltante
            personalData: { connect: { id: data.personalDataId } },
            loan: { connect: { id: data.loanId } }
          }
        }
      });

      // Mostrar toast de éxito
      addToast({
        type: 'success',
        title: 'Documento subido exitosamente',
        message: `${data.documentType} de ${data.title} se ha guardado correctamente`,
        duration: 4000
      });

      // Refrescar datos
      refetch();

      // Reabrir el modal de documentos si estaba temporalmente cerrado
      if (documentsModal.temporarilyClosed && documentsModal.loan) {
        setTimeout(() => {
          setDocumentsModal(prev => ({
            ...prev,
            isOpen: true,
            temporarilyClosed: false
          }));
        }, 200); // Delay un poco más largo para asegurar que el modal de subir se cierre completamente
      }
    } catch (error) {
      console.error('Error al crear documento:', error);
      
      // Mostrar toast de error
      addToast({
        type: 'error',
        title: 'Error al subir documento',
        message: error instanceof Error ? error.message : 'Ocurrió un error inesperado',
        duration: 6000
      });
      
      throw error;
    }
  };

  // Función para eliminar documento
  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocumentPhoto({
        variables: { id: documentId }
      });

      // Mostrar toast de éxito
      addToast({
        type: 'success',
        title: 'Documento eliminado',
        message: 'El documento se ha eliminado correctamente',
        duration: 3000
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
      
      // Mostrar toast de error
      addToast({
        type: 'error',
        title: 'Error al eliminar documento',
        message: 'No se pudo eliminar el documento. Inténtalo de nuevo.',
        duration: 5000
      });
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

  // Función para manejar el estado de faltante del documento
  const handleDocumentMissing = async (documentId: string, isMissing: boolean) => {
    try {
      if (isMissing) {
        // Marcar como faltante
        await updateDocumentPhotoMissing({
          variables: { 
            id: documentId, 
            isMissing: true
          }
        });
      } else {
        // Si se quita el estado de faltante, eliminar el documento
        // porque un documento no faltante sin foto no debería existir
        await deleteDocumentPhoto({
          variables: { id: documentId }
        });
      }

      // Refrescar datos
      refetch();
    } catch (error) {
      console.error('Error al actualizar estado de faltante del documento:', error);
      alert('Error al actualizar el estado de faltante del documento');
    }
  };

  // Función para crear un documento faltante
  const handleCreateMissingDocument = async (
    documentType: 'INE' | 'DOMICILIO' | 'PAGARE',
    personalDataId: string,
    loanId: string,
    personName: string
  ) => {
    try {
      await createDocumentPhoto({
        variables: {
          data: {
            title: `${getTypeLabel(documentType)} - ${personName}`,
            description: 'Documento marcado como faltante',
            // No incluir photoUrl y publicId - son opcionales y no deben enviarse como null
            documentType: documentType,
            isError: false,
            errorDescription: '',
            isMissing: true, // Explícitamente marcado como faltante
            personalData: { connect: { id: personalDataId } },
            loan: { connect: { id: loanId } }
          }
        }
      });

      // Refrescar datos
      refetch();
    } catch (error) {
      console.error('Error al crear documento faltante:', error);
      alert('Error al crear documento faltante');
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
    personName: string,
    loan?: any
  ) => {
    // Cerrar temporalmente el modal de documentos si está abierto
    if (documentsModal.isOpen) {
      setDocumentsModal(prev => ({
        ...prev,
        isOpen: false,
        temporarilyClosed: true
      }));
      
      // Pequeño delay para asegurar que el modal de documentos se cierre antes de abrir el de subir
      setTimeout(() => {
        setUploadModal({
          isOpen: true,
          documentType,
          personType,
          personalDataId,
          loanId,
          personName,
          loan
        });
      }, 100);
    } else {
      // Si el modal de documentos no está abierto, abrir directamente el modal de subir
      setUploadModal({
        isOpen: true,
        documentType,
        personType,
        personalDataId,
        loanId,
        personName,
        loan
      });
    }
  };

  // Función para abrir modal de documentos
  const openDocumentsModal = (loan: Loan) => {
    // Cerrar el modal de subir si está abierto
    if (uploadModal.isOpen) {
      setUploadModal({ ...uploadModal, isOpen: false });
    }
    
    setDocumentsModal({
      isOpen: true,
      loan,
      temporarilyClosed: false
    });
  };

  // Función para cerrar modal de documentos
  const closeDocumentsModal = () => {
    setDocumentsModal({
      isOpen: false,
      loan: null,
      temporarilyClosed: false
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

  // Función para verificar si un préstamo tiene todos los documentos requeridos revisados
  // Un documento está "revisado" si está subido, marcado como error, o marcado como faltante
  const isLoanComplete = (loan: any) => {
    const documents = loan.documentPhotos;
    
    // Contar documentos por tipo y persona
    const titularDocs = documents.filter((doc: any) => 
      doc.personalData.id === loan.borrower.personalData.id
    );
    // Los documentos del aval son los que pertenecen a los collaterals
    const avalDocs = documents.filter((doc: any) => 
      loan.collaterals.some((collateral: any) => collateral.id === doc.personalData.id)
    );
    
    // Función auxiliar para verificar si un tipo de documento está revisado
    // Un documento está revisado si: tiene imagen, está marcado como error, o está marcado como faltante
    const isDocumentTypeReviewed = (docs: any[], documentType: string) => {
      return docs.some((doc: any) => 
        doc.documentType === documentType && 
        (doc.photoUrl || doc.isError || doc.isMissing) // Tiene imagen, marcado como error, o marcado como faltante
      );
    };
    
    // Verificar documentos del TITULAR (INE, DOMICILIO, PAGARE)
    const hasTitularINE = isDocumentTypeReviewed(titularDocs, 'INE');
    const hasTitularDOMICILIO = isDocumentTypeReviewed(titularDocs, 'DOMICILIO');
    const hasTitularPAGARE = isDocumentTypeReviewed(titularDocs, 'PAGARE');
    
    // Verificar documentos del AVAL (INE, DOMICILIO)
    const hasAvalINE = isDocumentTypeReviewed(avalDocs, 'INE');
    const hasAvalDOMICILIO = isDocumentTypeReviewed(avalDocs, 'DOMICILIO');
    
    // Un préstamo está completo si todos los documentos requeridos están revisados
    return hasTitularINE && hasTitularDOMICILIO && hasTitularPAGARE && hasAvalINE && hasAvalDOMICILIO;
  };

  // Función para obtener la localidad del líder asociado al crédito (igual que en RouteLeadSelector)
  const getLocality = (loan: any) => {
    const lead = loan.lead;
    
    if (lead?.personalData?.addresses?.[0]?.location?.name) {
      const locality = lead.personalData.addresses[0].location.name;
      const state = lead.personalData.addresses[0].location.municipality?.state?.name;
      return state ? `${locality} · ${state}` : locality;
    }
    
    return 'Sin localidad';
  };

  // Obtener localidades únicas de los líderes de la ruta seleccionada (igual que en RouteLeadSelector)
  const uniqueLocalities = useMemo(() => {
    const localities = new Set<string>();
    
    if (leadsData?.employees) {
      leadsData.employees.forEach((lead: any) => {
        if (lead?.personalData?.addresses?.[0]?.location?.name) {
          const locality = lead.personalData.addresses[0].location.name;
          const state = lead.personalData.addresses[0].location.municipality?.state?.name;
          const localityLabel = state ? `${locality} · ${state}` : locality;
          localities.add(localityLabel);
        }
      });
    }
    
    return Array.from(localities).sort();
  }, [leadsData]);

  // Crear opciones para el Select de localidad (igual que en RouteLeadSelector)
  const localityOptions = useMemo(() => {
    const options: Array<{label: string, value: string, data: string | null}> = [
      { label: 'Todas las localidades', value: '', data: null }
    ];
    
    uniqueLocalities.forEach(locality => {
      options.push({
        label: locality,
        value: locality,
        data: locality
      });
    });
    
    return options;
  }, [uniqueLocalities]);

  // Filtrar préstamos por término de búsqueda, ruta, completitud y localidad
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
    if (selectedRouteId) {
      // Verificar si el préstamo pertenece a la ruta seleccionada
      const loanRoutes = loan.lead.routes;
      
      // Verificar que routes sea un array antes de usar .some()
      if (Array.isArray(loanRoutes)) {
        matchesRoute = loanRoutes.some((route: any) => route.id === selectedRouteId);
      } else if (loanRoutes && typeof loanRoutes === 'object' && 'id' in loanRoutes) {
        // Si routes es un objeto (relación directa), verificar por ID
        matchesRoute = (loanRoutes as any).id === selectedRouteId;
      } else {
        // Si no hay routes o es null/undefined, no coincide
        matchesRoute = false;
      }
    }
    
    // Filtro por estado de revisión
    let matchesReview = true;
    if (reviewFilter !== 'all') {
      const isReviewed = isLoanComplete(loan);
      matchesReview = reviewFilter === 'reviewed' ? isReviewed : !isReviewed;
    }
    
    // Filtro por localidad
    let matchesLocality = true;
    if (selectedLocality) {
      const loanLocality = getLocality(loan);
      matchesLocality = loanLocality === selectedLocality;
    }
    
    return matchesSearch && matchesRoute && matchesReview && matchesLocality;
  });

  // Calcular estadísticas basadas en los préstamos filtrados
  const totalCredits = filteredLoans.length;
  const creditsReviewed = filteredLoans.filter(loan => isLoanComplete(loan)).length;
  const totalDocuments = filteredLoans.reduce((total, loan) => total + loan.documentPhotos.length, 0);
  const creditsNotReviewed = totalCredits - creditsReviewed;

  if (loading || queryLoading) {
    return (
      <PageContainer header="Documentos Personales">
        <Box 
          padding="large" 
          css={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            gap: '16px'
          }}
        >
          <LoadingDots label="Cargando documentos..." />
          <Text size="medium" color="neutral600">
            Obteniendo información de la semana seleccionada...
          </Text>
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
        paddingBottom: '40px', // Espacio adicional en la parte inferior
        overflow: 'hidden',
        '@media (max-width: 768px)': {
          paddingLeft: '4px',
          paddingRight: '4px',
          paddingBottom: '60px' // Más espacio en móviles para asegurar que el botón se vea completo
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
        },
        '@keyframes fadeInDown': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-10px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        }
      }}>
        {/* Tabs de rutas */}
        <Box
          css={{
            marginBottom: '24px',
            width: '100%',
            '@media (max-width: 768px)': {
              marginBottom: '16px'
            }
          }}
        >
          <Box
            css={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '8px',
              '&::-webkit-scrollbar': {
                height: '4px'
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f5f9'
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#cbd5e1',
                borderRadius: '2px'
              }
            }}
          >
            {/* Tabs de rutas individuales */}
            {routes.map((route) => (
              <Button
                key={route.id}
                size="small"
                onClick={() => setSelectedRouteId(route.id)}
                css={{
                  backgroundColor: selectedRouteId === route.id ? '#3b82f6' : '#f8fafc',
                  color: selectedRouteId === route.id ? 'white' : '#64748b',
                  border: '1px solid',
                  borderColor: selectedRouteId === route.id ? '#3b82f6' : '#e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  minWidth: '120px',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: selectedRouteId === route.id ? '#2563eb' : '#f1f5f9',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                {route.name}
              </Button>
            ))}
          </Box>
        </Box>


        {/* Filtro de localidad */}
        <Box
          css={{
            marginBottom: '24px',
            '@media (max-width: 768px)': {
              marginBottom: '16px'
            }
          }}
        >
          <Box
            css={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              '@media (max-width: 768px)': {
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: '8px'
              }
            }}
          >
            <Text weight="medium" size="small" color="black">
              Filtros adicionales
            </Text>
            
            {/* Botón para mostrar/ocultar filtros */}
            <Button
              size="small"
              onClick={() => setShowReviewFilter(!showReviewFilter)}
              css={{
                backgroundColor: showReviewFilter ? '#3b82f6' : '#f8fafc',
                color: showReviewFilter ? 'white' : '#6b7280',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: showReviewFilter ? '#2563eb' : '#f1f5f9',
                  borderColor: showReviewFilter ? '#2563eb' : '#cbd5e1'
                },
                '@media (max-width: 768px)': {
                  width: '100%',
                  justifyContent: 'center'
                }
              }}
            >
              <FaFilter size={14} />
              Filtros
            </Button>
          </Box>

          {/* Panel de filtros (colapsable) */}
          {showReviewFilter && (
            <Box
              css={{
                marginTop: '12px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                animation: 'fadeInDown 0.3s ease-out',
                '@media (max-width: 768px)': {
                  padding: '12px'
                }
              }}
            >
              {/* Filtro de estado de revisión */}
              <Box css={{ marginBottom: '16px' }}>
                <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
                  Estado de Revisión
                </Text>
                
                <Box
                  css={{
                    display: 'flex',
                    gap: '4px',
                    backgroundColor: '#f1f5f9',
                    padding: '4px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    '@media (max-width: 768px)': {
                      width: '100%'
                    }
                  }}
                >
                  <Button
                    size="small"
                    onClick={() => setReviewFilter('not_reviewed')}
                    css={{
                      backgroundColor: reviewFilter === 'not_reviewed' ? '#3b82f6' : 'transparent',
                      color: reviewFilter === 'not_reviewed' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                      boxShadow: reviewFilter === 'not_reviewed' ? '0 1px 2px 0 rgba(0, 0, 0, 0.1)' : 'none',
                      flex: 1,
                      '&:hover': {
                        backgroundColor: reviewFilter === 'not_reviewed' ? '#2563eb' : '#e2e8f0'
                      }
                    }}
                  >
                    No Revisados
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setReviewFilter('reviewed')}
                    css={{
                      backgroundColor: reviewFilter === 'reviewed' ? '#3b82f6' : 'transparent',
                      color: reviewFilter === 'reviewed' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                      boxShadow: reviewFilter === 'reviewed' ? '0 1px 2px 0 rgba(0, 0, 0, 0.1)' : 'none',
                      flex: 1,
                      '&:hover': {
                        backgroundColor: reviewFilter === 'reviewed' ? '#2563eb' : '#e2e8f0'
                      }
                    }}
                  >
                    Revisados
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setReviewFilter('all')}
                    css={{
                      backgroundColor: reviewFilter === 'all' ? '#3b82f6' : 'transparent',
                      color: reviewFilter === 'all' ? 'white' : '#6b7280',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                      boxShadow: reviewFilter === 'all' ? '0 1px 2px 0 rgba(0, 0, 0, 0.1)' : 'none',
                      flex: 1,
                      '&:hover': {
                        backgroundColor: reviewFilter === 'all' ? '#2563eb' : '#e2e8f0'
                      }
                    }}
                  >
                    Todos
                  </Button>
                </Box>
              </Box>

              {/* Filtro de localidad */}
              <Box>
                <Text weight="medium" size="small" color="black" css={{ marginBottom: '8px' }}>
                  Localidad del Líder
                </Text>
                
                <Select
                  value={localityOptions.find(option => option.value === selectedLocality) || null}
                  options={localityOptions}
                  onChange={(option) => setSelectedLocality(option?.value || '')}
                  placeholder={leadsLoading ? "Cargando localidades..." : "Seleccionar localidad"}
                  isLoading={leadsLoading}
                  isDisabled={!selectedRouteId || leadsLoading}
                  css={{
                    width: '100%',
                    '@media (max-width: 768px)': {
                      width: '100%'
                    }
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>

        {/* Selector de semanas */}
        <Box
          css={{
            marginBottom: '24px',
            width: '100%',
            '@media (max-width: 768px)': {
              marginBottom: '16px'
            }
          }}
        >
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

        {/* Estadísticas fusionadas con contador claro */}
        <Box
          css={{
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            marginBottom: '16px',
            '@media (max-width: 768px)': {
              padding: '12px',
              marginBottom: '12px'
            }
          }}
        >
          <Box
            css={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              '@media (max-width: 768px)': {
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: '8px'
              }
            }}
          >
            <Text weight="semibold" size="medium" color="neutral900">
              Resumen de Clientes
            </Text>
            <Text size="small" color="neutral600">
              {reviewFilter === 'not_reviewed' ? 'Mostrando solo no revisados' : 
               reviewFilter === 'reviewed' ? 'Mostrando solo revisados' : 
               'Mostrando todos los clientes'}
            </Text>
        </Box>

        <Box
          css={{
            display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
              '@media (max-width: 768px)': {
                gap: '12px'
              }
          }}
        >
            {/* Total de clientes */}
          <Box
            css={{
                textAlign: 'center',
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                '@media (max-width: 768px)': {
                  padding: '8px'
                }
              }}
            >
              <Text weight="bold" size="large" color="neutral900">
              {totalCredits}
            </Text>
              <Text size="small" color="neutral600" weight="medium">
                Total
            </Text>
          </Box>

            {/* Revisados */}
          <Box
            css={{
                textAlign: 'center',
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                '@media (max-width: 768px)': {
                  padding: '8px'
                }
              }}
            >
              <Text weight="bold" size="large" color="green600">
                {creditsReviewed}
            </Text>
              <Text size="small" color="neutral600" weight="medium">
                Revisados
            </Text>
          </Box>

            {/* No Revisados */}
          <Box
            css={{
                textAlign: 'center',
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                '@media (max-width: 768px)': {
                  padding: '8px'
                }
            }}
          >
            <Text weight="bold" size="large" color="red600">
              {creditsNotReviewed}
            </Text>
              <Text size="small" color="neutral600" weight="medium">
              No Revisados
            </Text>
          </Box>
          </Box>

          {/* Barra de progreso visual */}
          {totalCredits > 0 && (
            <Box
              css={{
                marginTop: '12px',
                backgroundColor: '#e5e7eb',
                borderRadius: '6px',
                height: '6px',
                overflow: 'hidden'
              }}
            >
              <Box
                css={{
                  width: `${(creditsReviewed / totalCredits) * 100}%`,
                  backgroundColor: '#10b981',
                  height: '100%',
                  transition: 'width 0.3s ease'
                }}
              />
            </Box>
          )}
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
              alignItems: 'stretch',
              marginBottom: '20px'
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
        <Box css={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          marginBottom: '20px', // Espacio adicional después de la lista
          '@media (max-width: 768px)': {
            marginBottom: '30px' // Más espacio en móviles
          }
        }}>
          {/* Loader sutil cuando se está cargando nueva información */}
          {(queryLoading || isChangingRoute) && !loading && (
            <Box
              css={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px'
              }}
            >
              <LoadingDots label={isChangingRoute ? "Cambiando ruta..." : "Actualizando información..."} />
              <Text size="small" color="neutral600" css={{ marginLeft: '12px' }}>
                {isChangingRoute ? "Cargando documentos de la nueva ruta..." : "Cargando nueva información..."}
              </Text>
            </Box>
          )}

          {filteredLoans.map((loan) => {
            const isExpanded = selectedLoan?.id === loan.id;
            const borrowerDocuments = loan.documentPhotos.filter(doc => 
              doc.personalData.id === loan.borrower.personalData.id
            );
            // Los documentos del aval son los que pertenecen a los collaterals
            const collateralDocuments = loan.documentPhotos.filter(doc => 
              loan.collaterals.some(collateral => collateral.id === doc.personalData.id)
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
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    borderColor: '#3b82f6'
                  },
                  '@media (max-width: 768px)': {
                    borderRadius: '12px',
                    margin: '0 4px'
                  }
                }}
              >
                {/* Indicador de estado */}
                <Box
                  css={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: '600',
                    backgroundColor: isLoanComplete(loan) ? '#d1fae5' : '#fef3c7',
                    color: isLoanComplete(loan) ? '#065f46' : '#92400e',
                    border: `1px solid ${isLoanComplete(loan) ? '#10b981' : '#f59e0b'}`,
                    zIndex: 1,
                    '@media (max-width: 768px)': {
                      top: '8px',
                      right: '8px',
                      padding: '3px 6px',
                      fontSize: '9px'
                    }
                  }}
                >
                  {isLoanComplete(loan) ? 'Revisado' : 'No Revisado'}
                </Box>

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
                      width: '100%',
                      '@media (max-width: 768px)': {
                        gridTemplateColumns: '1fr',
                        gap: '8px'
                      }
                    }}
                  >
                    {/* Columna izquierda */}
                    <Box css={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      minWidth: 0,
                      width: '100%'
                    }}>
                      <Box css={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaCalendarAlt color="#6b7280" />
                        <Box
                          css={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #0ea5e9',
                            fontSize: '10px',
                            fontWeight: '600',
                            color: '#0369a1',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: '#e0f2fe',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.2)'
                            }
                          }}
                        >
                          {new Date(loan.signDate).toLocaleDateString('es-ES')}
                        </Box>
                      </Box>

                      <Box css={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FaMapMarkerAlt color="#6b7280" />
                        <Box
                          css={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #22c55e',
                            fontSize: '10px',
                            fontWeight: '600',
                            color: '#15803d',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: '#dcfce7',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)'
                            }
                          }}
                        >
                          {getLocality(loan)}
                        </Box>
                      </Box>

                      <Box css={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        minWidth: 0,
                        flex: 1
                      }}>
                        <FaUser color="#6b7280" />
                        <div 
                          css={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                            flex: 1,
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#000000',
                            maxWidth: '100%',
                            '@media (max-width: 768px)': {
                              maxWidth: 'calc(100vw - 120px)'
                            }
                          }}
                          title={loan.borrower.personalData.fullName}
                        >
                          {loan.borrower.personalData.fullName}
                        </div>
                      </Box>

                    </Box>

                    {/* Columna derecha */}
                    <Box css={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      minWidth: 0,
                      width: '100%'
                    }}>
                      <Box css={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        minWidth: 0,
                        flex: 1
                      }}>
                        <FaUserTie color="#6b7280" />
                        <div 
                          css={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                            flex: 1,
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#000000',
                            maxWidth: '100%',
                            '@media (max-width: 768px)': {
                              maxWidth: 'calc(100vw - 120px)'
                            }
                          }}
                          title={loan.lead.personalData.fullName}
                        >
                          {loan.lead.personalData.fullName}
                        </div>
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
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    '@media (max-width: 768px)': {
                      padding: '12px',
                      marginTop: '10px'
                    }
                  }}>
                    {/* Tags del Titular */}
                    <Box css={{ marginBottom: '8px' }}>
                      <Text size="xsmall" color="neutral700" css={{ 
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        👤 Titular:
                      </Text>
                      <Box css={{ 
                        display: 'flex', 
                        gap: '4px', 
                        flexWrap: 'wrap',
                        '@media (max-width: 768px)': {
                          gap: '3px'
                        }
                      }}>
                        {DOCUMENT_TYPES_TITULAR.map((type) => {
                          const document = getDocumentByTypeAndPerson(
                            borrowerDocuments,
                            type,
                            loan.borrower.personalData.id
                          );
                          const hasDocument = !!document;
                          const hasError = hasDocument && document.isError;
                          const isMissing = hasDocument && document.isMissing;
                          
                          return (
                            <Box
                              key={`collapsed-titular-${type}`}
                              css={{
                                padding: '4px 8px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: '600',
                                backgroundColor: hasError 
                                  ? 'rgba(239, 68, 68, 0.15)' 
                                  : isMissing
                                    ? 'rgba(156, 163, 175, 0.15)'
                                    : hasDocument 
                                      ? 'rgba(34, 197, 94, 0.15)' 
                                      : '#f3f4f6',
                                color: hasError 
                                  ? '#dc2626' 
                                  : isMissing
                                    ? '#6b7280'
                                    : hasDocument 
                                      ? '#166534' 
                                      : '#6b7280',
                                border: hasError 
                                  ? '1px solid rgba(239, 68, 68, 0.4)' 
                                  : isMissing
                                    ? '1px solid rgba(156, 163, 175, 0.4)'
                                    : hasDocument 
                                      ? '1px solid rgba(34, 197, 94, 0.4)' 
                                      : '1px solid #e5e7eb',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                '&:hover': {
                                  transform: 'translateY(-1px)',
                                  boxShadow: hasError 
                                    ? '0 2px 4px rgba(239, 68, 68, 0.2)' 
                                    : isMissing
                                      ? '0 2px 4px rgba(156, 163, 175, 0.2)'
                                      : hasDocument 
                                        ? '0 2px 4px rgba(34, 197, 94, 0.2)' 
                                        : '0 2px 4px rgba(0, 0, 0, 0.1)'
                                },
                                '@media (max-width: 768px)': {
                                  padding: '5px 10px',
                                  fontSize: '11px'
                                }
                              }}
                              title={hasError ? `Error: ${document.errorDescription || 'Documento marcado como error'}` : isMissing ? 'Documento marcado como faltante' : undefined}
                            >
                              {getTypeLabel(type)}
                              {hasError && ' ⚠️'}
                              {isMissing && ' ❌'}
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
                      <Box css={{ 
                        display: 'flex', 
                        gap: '4px', 
                        flexWrap: 'wrap',
                        '@media (max-width: 768px)': {
                          gap: '3px'
                        }
                      }}>
                        {DOCUMENT_TYPES_AVAL.map((type) => {
                          // Para los avales, necesitamos obtener el primer collateral (aval principal)
                          const primaryCollateral = loan.collaterals[0];
                          const document = primaryCollateral ? getDocumentByTypeAndPerson(
                            collateralDocuments,
                            type,
                            primaryCollateral.id
                          ) : null;
                          const hasDocument = !!document;
                          const hasError = hasDocument && document.isError;
                          const isMissing = hasDocument && document.isMissing;
                          
                          return (
                            <Box
                              key={`collapsed-aval-${type}`}
                              css={{
                                padding: '4px 8px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: '600',
                                backgroundColor: hasError 
                                  ? 'rgba(239, 68, 68, 0.15)' 
                                  : isMissing
                                    ? 'rgba(156, 163, 175, 0.15)'
                                    : hasDocument 
                                      ? 'rgba(34, 197, 94, 0.15)' 
                                      : '#f3f4f6',
                                color: hasError 
                                  ? '#dc2626' 
                                  : isMissing
                                    ? '#6b7280'
                                    : hasDocument 
                                      ? '#166534' 
                                      : '#6b7280',
                                border: hasError 
                                  ? '1px solid rgba(239, 68, 68, 0.4)' 
                                  : isMissing
                                    ? '1px solid rgba(156, 163, 175, 0.4)'
                                    : hasDocument 
                                      ? '1px solid rgba(34, 197, 94, 0.4)' 
                                      : '1px solid #e5e7eb',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                '&:hover': {
                                  transform: 'translateY(-1px)',
                                  boxShadow: hasError 
                                    ? '0 2px 4px rgba(239, 68, 68, 0.2)' 
                                    : isMissing
                                      ? '0 2px 4px rgba(156, 163, 175, 0.2)'
                                      : hasDocument 
                                        ? '0 2px 4px rgba(34, 197, 94, 0.2)' 
                                        : '0 2px 4px rgba(0, 0, 0, 0.1)'
                                },
                                '@media (max-width: 768px)': {
                                  padding: '5px 10px',
                                  fontSize: '11px'
                                }
                              }}
                              title={hasError ? `Error: ${document.errorDescription || 'Documento marcado como error'}` : isMissing ? 'Documento marcado como faltante' : undefined}
                            >
                              {getTypeLabel(type)}
                              {hasError && ' ⚠️'}
                              {isMissing && ' ❌'}
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
                        borderRadius: '8px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: '600',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': {
                          backgroundColor: '#2563eb',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
                        },
                        '&:active': {
                          transform: 'translateY(0)'
                        },
                        '@media (max-width: 768px)': {
                          padding: '12px 16px',
                          fontSize: '15px'
                        }
                      }}
                    >
                      Ver Documentos
                    </Button>
                  </Box>
                </Box>

              </Box>
            );
          })}
        </Box>

        {/* Mensaje cuando no hay créditos */}
        {filteredLoans.length === 0 && !queryLoading && (
          <Box
            css={{
              textAlign: 'center',
              padding: '60px 40px',
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              margin: '20px 0',
              '@media (max-width: 768px)': {
                padding: '40px 20px',
                margin: '16px 0'
              }
            }}
          >
            <Box
              css={{
                fontSize: '48px',
                marginBottom: '16px',
                '@media (max-width: 768px)': {
                  fontSize: '36px'
                }
              }}
            >
              📋
            </Box>
            <Text 
              size="large" 
              color="black" 
              weight="medium"
              css={{ 
                marginBottom: '8px',
                '@media (max-width: 768px)': {
                  fontSize: '18px'
                }
              }}
            >
              {reviewFilter === 'reviewed' 
                ? 'No hay clientes revisados' 
                : reviewFilter === 'not_reviewed' 
                  ? 'No hay clientes sin revisar' 
                  : 'No hay clientes en esta ruta'
              }
            </Text>
            <Text 
              size="medium" 
              color="neutral600"
              css={{ 
                marginBottom: '16px',
                '@media (max-width: 768px)': {
                  fontSize: '14px'
                }
              }}
            >
              {reviewFilter === 'reviewed' 
                ? 'Todos los clientes de esta ruta están sin revisar'
                : reviewFilter === 'not_reviewed' 
                  ? 'Todos los clientes de esta ruta ya están revisados'
                  : 'Esta ruta no tiene clientes para la semana seleccionada'
              }
            </Text>
            <Text size="small" color="neutral500">
              {reviewFilter === 'reviewed' 
                ? 'Los clientes revisados aparecerán aquí una vez que se revisen todos los documentos'
                : reviewFilter === 'not_reviewed' 
                  ? 'Los clientes sin revisar aparecerán aquí una vez que falten documentos por revisar'
                  : 'Intenta seleccionar otra ruta o semana'
              }
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
          // Usar la función openUploadModal que maneja el cierre temporal del modal de documentos
          openUploadModal(
            data.documentType,
            data.personType,
            data.personalDataId,
            data.loanId,
            data.personName,
            documentsModal.loan
          );
        }}
        onDocumentError={handleMarkAsError}
        onDocumentMissing={handleDocumentMissing}
        onCreateMissingDocument={handleCreateMissingDocument}
        onDocumentDelete={handleDocumentDelete}
        onNameEdit={handleNameEdit}
        onPhoneEdit={handlePhoneEdit}
      />

      {/* Modal de subida - Renderizado DESPUÉS del modal de documentos para asegurar z-index correcto */}
      <UploadModal
        isOpen={uploadModal.isOpen}
        onClose={() => {
          setUploadModal({ ...uploadModal, isOpen: false });
          // Reabrir el modal de documentos si estaba temporalmente cerrado
          if (documentsModal.temporarilyClosed && documentsModal.loan) {
            setTimeout(() => {
              setDocumentsModal(prev => ({
                ...prev,
                isOpen: true,
                temporarilyClosed: false
              }));
            }, 200); // Delay consistente con el de handleDocumentUpload
          }
        }}
        onUpload={handleDocumentUpload}
        documentType={uploadModal.documentType}
        personType={uploadModal.personType}
        personalDataId={uploadModal.personalDataId}
        loanId={uploadModal.loanId}
        personName={uploadModal.personName}
        loan={uploadModal.loan}
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

      {/* Toast Container */}
      <ToastContainer
        toasts={toasts}
        onClose={removeToast}
      />
    </PageContainer>
  );
}
