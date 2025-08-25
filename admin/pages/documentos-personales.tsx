/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Box, jsx, Stack } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput, Select } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { FaPlus, FaTrash, FaEdit, FaEye, FaDownload, FaCamera, FaUpload, FaUser, FaPhone, FaCalendarAlt, FaFileImage } from 'react-icons/fa';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';

// Import GraphQL queries and mutations
import { GET_ROUTE } from '../graphql/queries/routes';

// Definir interfaces para tipos de datos
interface DocumentPhoto {
  id: string;
  originalName: string;
  documentType: 'INE' | 'ADDRESS_PROOF' | 'PROMISSORY_NOTE';
  cloudinaryUrl: string;
  cloudinarySecureUrl: string;
  cloudinaryPublicId: string;
  size: number;
  createdAt: string;
  description?: string;
  personalData: {
    id: string;
    fullName: string;
  };
  loan?: {
    id: string;
    requestedAmount: number;
  };
}

interface PersonalData {
  id: string;
  fullName: string;
  phones: { number: string }[];
  documentPhotos: DocumentPhoto[];
}

interface LoanWithDocuments {
  id: string;
  requestedAmount: number;
  amountGived: number;
  signDate: string;
  loanType: string;
  borrower: {
    id: string;
    personalData: PersonalData;
  };
  collaterals: PersonalData[];
  documentPhotos: DocumentPhoto[];
}

interface DocumentosPersonalesProps {
  selectedDate: Date | null;
  selectedRoute: string | null;
  selectedLead: {
    id: string;
    type: string;
    personalData: {
      fullName: string;
      __typename: string;
    };
    __typename: string;
  } | null;
}

// GraphQL Query para obtener documentos por fecha de crédito
const GET_DOCUMENT_PHOTOS_BY_CREDIT_DATE = gql`
  query GetDocumentPhotosByCreditDate($date: DateTime!, $leadId: ID) {
    getDocumentPhotosByCreditDate(date: $date, leadId: $leadId) {
      success
      message
      loans {
        id
        requestedAmount
        amountGived
        signDate
        loanType
        borrower {
          id
          personalData {
            id
            fullName
            phones {
              number
            }
            documentPhotos {
              id
              originalName
              documentType
              cloudinaryUrl
              cloudinarySecureUrl
              cloudinaryPublicId
              createdAt
            }
          }
        }
        collaterals {
          id
          fullName
          phones {
            number
          }
          documentPhotos {
            id
            originalName
            documentType
            cloudinaryUrl
            cloudinarySecureUrl
            cloudinaryPublicId
            createdAt
          }
        }
        documentPhotos {
          id
          originalName
          documentType
          cloudinaryUrl
          cloudinarySecureUrl
          cloudinaryPublicId
          createdAt
          personalData {
            id
            fullName
          }
        }
      }
    }
  }
`;

// GraphQL Mutation para subir documentos
const UPLOAD_DOCUMENT_PHOTO = gql`
  mutation UploadDocumentPhoto($input: UploadDocumentPhotoInput!) {
    uploadDocumentPhoto(input: $input) {
      success
      message
      documentPhoto {
        id
        filename
        originalName
        documentType
        cloudinaryUrl
        cloudinarySecureUrl
        cloudinaryPublicId
        size
        createdAt
      }
    }
  }
`;

// GraphQL Mutation para actualizar datos personales
const UPDATE_PERSONAL_DATA = gql`
  mutation UpdatePersonalData($where: PersonalDataWhereUniqueInput!, $data: PersonalDataUpdateInput!) {
    updatePersonalData(where: $where, data: $data) {
      id
      fullName
      phones {
        id
        number
      }
    }
  }
`;

// Estilos reutilizables
const cardStyle = {
  backgroundColor: 'white',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  padding: '20px',
  marginBottom: '16px',
  border: '1px solid #E5E7EB',
};

const documentTypeLabels = {
  INE: 'INE',
  ADDRESS_PROOF: 'Comprobante de Domicilio',
  PROMISSORY_NOTE: 'Pagaré'
};

const documentTypeColors = {
  INE: '#10B981', // Verde
  ADDRESS_PROOF: '#3B82F6', // Azul
  PROMISSORY_NOTE: '#F59E0B' // Amarillo
};

export const DocumentosPersonales = ({ selectedDate, selectedRoute, selectedLead }: DocumentosPersonalesProps) => {
  const [loans, setLoans] = useState<LoanWithDocuments[]>([]);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [editingPersonalData, setEditingPersonalData] = useState<PersonalData | null>(null);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [selectedPersonForUpload, setSelectedPersonForUpload] = useState<{ personalDataId: string; loanId?: string } | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // GraphQL Hooks
  const { data: documentsData, loading: documentsLoading, error: documentsError, refetch: refetchDocuments } = useQuery(GET_DOCUMENT_PHOTOS_BY_CREDIT_DATE, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : '',
      leadId: selectedLead?.id
    },
    skip: !selectedDate || !selectedLead?.id,
  });

  const [uploadDocumentPhoto] = useMutation(UPLOAD_DOCUMENT_PHOTO);
  const [updatePersonalData] = useMutation(UPDATE_PERSONAL_DATA);

  // Efectos
  useEffect(() => {
    if (documentsData?.getDocumentPhotosByCreditDate?.success) {
      setLoans(documentsData.getDocumentPhotosByCreditDate.loans || []);
    }
  }, [documentsData]);

  // Funciones de utilidad
  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case 'INE': return '🆔';
      case 'ADDRESS_PROOF': return '🏠';
      case 'PROMISSORY_NOTE': return '📄';
      default: return '📎';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Función para manejar la subida de archivos
  const handleFileUpload = useCallback(async (file: File, personalDataId: string, documentType: string, loanId?: string) => {
    try {
      setIsUploading(personalDataId);

      // Convertir archivo a base64
      const fileBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

      const { data } = await uploadDocumentPhoto({
        variables: {
          input: {
            file: base64,
            filename: file.name,
            originalName: file.name,
            mimeType: file.type,
            documentType,
            personalDataId,
            loanId,
          }
        }
      });

      if (data?.uploadDocumentPhoto?.success) {
        console.log('✅ Documento subido exitosamente');
        await refetchDocuments();
      } else {
        console.error('❌ Error al subir documento:', data?.uploadDocumentPhoto?.message);
        alert('Error al subir documento: ' + data?.uploadDocumentPhoto?.message);
      }
    } catch (error) {
      console.error('❌ Error al subir archivo:', error);
      alert('Error al subir archivo. Por favor, inténtalo de nuevo.');
    } finally {
      setIsUploading(null);
    }
  }, [uploadDocumentPhoto, refetchDocuments]);

  // Función para actualizar datos personales
  const handleUpdatePersonalData = useCallback(async (personalData: PersonalData, newName: string, newPhone: string) => {
    try {
      const { data } = await updatePersonalData({
        variables: {
          where: { id: personalData.id },
          data: {
            fullName: newName,
            phones: {
              deleteMany: {},
              create: [{ number: newPhone }]
            }
          }
        }
      });

      if (data?.updatePersonalData) {
        console.log('✅ Datos personales actualizados exitosamente');
        await refetchDocuments();
        setEditingPersonalData(null);
      }
    } catch (error) {
      console.error('❌ Error al actualizar datos personales:', error);
      alert('Error al actualizar datos personales');
    }
  }, [updatePersonalData, refetchDocuments]);

  // Calcular estadísticas
  const stats = React.useMemo(() => {
    let totalDocuments = 0;
    let totalPersons = 0;
    let documentsByType = { INE: 0, ADDRESS_PROOF: 0, PROMISSORY_NOTE: 0 };

    loans.forEach(loan => {
      // Documentos del borrower
      if (loan.borrower?.personalData?.documentPhotos) {
        totalDocuments += loan.borrower.personalData.documentPhotos.length;
        loan.borrower.personalData.documentPhotos.forEach(doc => {
          documentsByType[doc.documentType]++;
        });
        totalPersons++;
      }

      // Documentos de collaterals
      loan.collaterals?.forEach(collateral => {
        if (collateral.documentPhotos) {
          totalDocuments += collateral.documentPhotos.length;
          collateral.documentPhotos.forEach(doc => {
            documentsByType[doc.documentType]++;
          });
          totalPersons++;
        }
      });

      // Documentos directos del préstamo
      if (loan.documentPhotos) {
        totalDocuments += loan.documentPhotos.length;
        loan.documentPhotos.forEach(doc => {
          documentsByType[doc.documentType]++;
        });
      }
    });

    return {
      totalDocuments,
      totalPersons,
      totalLoans: loans.length,
      documentsByType
    };
  }, [loans]);

  if (documentsLoading) {
    return (
      <Box paddingTop="xlarge" style={{ display: 'flex', justifyContent: 'center' }}>
        <LoadingDots label="Cargando documentos" size="large" />
      </Box>
    );
  }

  if (documentsError) {
    return (
      <Box paddingTop="xlarge">
        <GraphQLErrorNotice
          errors={documentsError?.graphQLErrors || []}
          networkError={documentsError?.networkError}
        />
      </Box>
    );
  }

  if (!selectedDate || !selectedLead) {
    return (
      <Box paddingTop="xlarge" style={{ textAlign: 'center', color: '#6B7280' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
        <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>Documentos Personales</h3>
        <p style={{ margin: 0 }}>Selecciona una fecha y un líder para ver los documentos de los créditos</p>
      </Box>
    );
  }

  return (
    <Box paddingTop="medium">
      {/* Header con estadísticas */}
      <div style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        marginBottom: '24px',
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}>
        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '1px',
          background: '#E2E8F0',
          borderRadius: '8px',
          overflow: 'hidden',
          flex: 1,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '16px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: '#7C3AED',
            }} />
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '8px',
            }}>
              TOTAL CRÉDITOS
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '4px',
            }}>
              {stats.totalLoans}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <FaCalendarAlt size={12} />
              <span>Fecha seleccionada</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '16px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: '#059669',
            }} />
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '8px',
            }}>
              PERSONAS
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '4px',
            }}>
              {stats.totalPersons}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <FaUser size={12} />
              <span>Con documentos</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '16px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: '#DC2626',
            }} />
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '8px',
            }}>
              TOTAL DOCUMENTOS
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '4px',
            }}>
              {stats.totalDocuments}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <FaFileImage size={12} />
              <span>Archivos subidos</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '16px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: '#10B981',
            }} />
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '8px',
            }}>
              INE
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '4px',
            }}>
              {stats.documentsByType.INE}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>🆔</span>
              <span>Identificaciones</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '16px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: '#3B82F6',
            }} />
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '8px',
            }}>
              COMPROBANTES + PAGARÉS
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '4px',
            }}>
              {stats.documentsByType.ADDRESS_PROOF + stats.documentsByType.PROMISSORY_NOTE}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>📄</span>
              <span>Otros documentos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de créditos con documentos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loans.length === 0 ? (
          <div style={{
            ...cardStyle,
            textAlign: 'center',
            padding: '40px',
            color: '#6B7280'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>No hay créditos para esta fecha</h3>
            <p style={{ margin: 0 }}>Selecciona una fecha diferente o verifica que haya créditos creados.</p>
          </div>
        ) : (
          loans.map((loan) => (
            <div key={loan.id} style={cardStyle}>
              {/* Header del crédito */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: '1px solid #E5E7EB'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    backgroundColor: '#F3F4F6',
                    borderRadius: '8px',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FaFileImage size={20} color="#6B7280" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>
                      Crédito: ${loan.requestedAmount.toLocaleString()}
                    </h3>
                    <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>
                      {loan.loanType} • {new Date(loan.signDate).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                </div>
                <Button
                  tone="passive"
                  size="small"
                  onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}
                >
                  {expandedLoan === loan.id ? 'Contraer' : 'Expandir'}
                </Button>
              </div>

              {/* Cliente (Borrower) */}
              <div style={{ marginBottom: '24px' }}>
                <PersonCard
                  title="Cliente"
                  person={loan.borrower.personalData}
                  loanId={loan.id}
                  isExpanded={expandedLoan === loan.id}
                  isUploading={isUploading === loan.borrower.personalData.id}
                  editingPersonalData={editingPersonalData}
                  onEdit={setEditingPersonalData}
                  onUpdate={handleUpdatePersonalData}
                  onFileUpload={handleFileUpload}
                  fileInputRefs={fileInputRefs}
                />
              </div>

              {/* Avales (Collaterals) */}
              {loan.collaterals && loan.collaterals.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                    Avales ({loan.collaterals.length})
                  </h4>
                  {loan.collaterals.map((collateral, index) => (
                    <div key={collateral.id} style={{ marginBottom: index < loan.collaterals.length - 1 ? '20px' : 0 }}>
                      <PersonCard
                        title={`Aval ${index + 1}`}
                        person={collateral}
                        loanId={loan.id}
                        isExpanded={expandedLoan === loan.id}
                        isUploading={isUploading === collateral.id}
                        editingPersonalData={editingPersonalData}
                        onEdit={setEditingPersonalData}
                        onUpdate={handleUpdatePersonalData}
                        onFileUpload={handleFileUpload}
                        fileInputRefs={fileInputRefs}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Box>
  );
};

// Componente PersonCard para mostrar y gestionar datos de una persona
interface PersonCardProps {
  title: string;
  person: PersonalData;
  loanId: string;
  isExpanded: boolean;
  isUploading: boolean;
  editingPersonalData: PersonalData | null;
  onEdit: (person: PersonalData) => void;
  onUpdate: (person: PersonalData, newName: string, newPhone: string) => void;
  onFileUpload: (file: File, personalDataId: string, documentType: string, loanId?: string) => void;
  fileInputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
}

const PersonCard: React.FC<PersonCardProps> = ({
  title,
  person,
  loanId,
  isExpanded,
  isUploading,
  editingPersonalData,
  onEdit,
  onUpdate,
  onFileUpload,
  fileInputRefs
}) => {
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    if (editingPersonalData?.id === person.id) {
      setEditName(person.fullName);
      setEditPhone(person.phones[0]?.number || '');
    }
  }, [editingPersonalData, person]);

  const documentsCount = person.documentPhotos?.length || 0;
  const documentsByType = person.documentPhotos?.reduce((acc, doc) => {
    acc[doc.documentType] = (acc[doc.documentType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div style={{
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px',
      backgroundColor: '#FAFAFA'
    }}>
      {/* Header de la persona */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isExpanded ? '16px' : '0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            backgroundColor: title === 'Cliente' ? '#EEF2FF' : '#F0FDF4',
            borderRadius: '6px',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FaUser size={16} color={title === 'Cliente' ? '#6366F1' : '#059669'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                {title}: {person.fullName}
              </h4>
              <Button
                tone="passive"
                size="small"
                onClick={() => onEdit(person)}
              >
                <FaEdit size={12} />
              </Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: '#6B7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FaPhone size={12} />
                {person.phones[0]?.number || 'Sin teléfono'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FaFileImage size={12} />
                {documentsCount} documento{documentsCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario de edición */}
      {editingPersonalData?.id === person.id && (
        <div style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '16px',
          border: '1px solid #D1D5DB'
        }}>
          <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>Editar información personal</h5>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <TextInput
              placeholder="Nombre completo"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{ flex: 1 }}
            />
            <TextInput
              placeholder="Teléfono"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              tone="active"
              size="small"
              onClick={() => onUpdate(person, editName, editPhone)}
            >
              Guardar
            </Button>
            <Button
              tone="passive"
              size="small"
              onClick={() => onEdit(null as any)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Documentos expandidos */}
      {isExpanded && (
        <div>
          {/* Botones de upload */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['INE', 'ADDRESS_PROOF', 'PROMISSORY_NOTE'].map((docType) => (
              <div key={docType} style={{ position: 'relative' }}>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  ref={(el) => {
                    fileInputRefs.current[`${person.id}-${docType}`] = el;
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onFileUpload(file, person.id, docType, loanId);
                    }
                  }}
                />
                <Button
                  tone="positive"
                  size="small"
                  onClick={() => fileInputRefs.current[`${person.id}-${docType}`]?.click()}
                  style={{
                    backgroundColor: documentTypeColors[docType as keyof typeof documentTypeColors],
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isUploading ? (
                    <LoadingDots label="" size="small" />
                  ) : (
                    <>
                      <FaCamera size={12} />
                      {documentTypeLabels[docType as keyof typeof documentTypeLabels]}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* Lista de documentos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {person.documentPhotos?.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '32px',
                color: '#6B7280',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px dashed #D1D5DB'
              }}>
                <FaUpload size={24} style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No hay documentos subidos</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Usa los botones de arriba para subir documentos</p>
              </div>
            ) : (
              person.documentPhotos?.map((doc) => (
                <DocumentItem key={doc.id} document={doc} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Componente DocumentItem para mostrar un documento individual
interface DocumentItemProps {
  document: DocumentPhoto;
}

const DocumentItem: React.FC<DocumentItemProps> = ({ document }) => {
  const handleDownload = () => {
    window.open(document.cloudinarySecureUrl, '_blank');
  };

  const handleView = () => {
    window.open(document.cloudinarySecureUrl, '_blank');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px',
      backgroundColor: 'white',
      borderRadius: '6px',
      border: '1px solid #E5E7EB'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          backgroundColor: documentTypeColors[document.documentType],
          borderRadius: '4px',
          padding: '6px',
          minWidth: '32px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '16px' }}>
            {getDocumentTypeIcon(document.documentType)}
          </span>
        </div>
        <div>
          <h6 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '600' }}>
            {document.originalName}
          </h6>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#6B7280' }}>
            <span>{documentTypeLabels[document.documentType]}</span>
            <span>•</span>
            <span>{new Date(document.createdAt).toLocaleDateString('es-MX')}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <Button
          tone="passive"
          size="small"
          onClick={handleView}
        >
          <FaEye size={12} />
        </Button>
        <Button
          tone="passive"
          size="small"
          onClick={handleDownload}
        >
          <FaDownload size={12} />
        </Button>
      </div>
    </div>
  );
};

// Función auxiliar para obtener el ícono del tipo de documento
const getDocumentTypeIcon = (type: string) => {
  switch (type) {
    case 'INE': return '🆔';
    case 'ADDRESS_PROOF': return '🏠';
    case 'PROMISSORY_NOTE': return '📄';
    default: return '📎';
  }
};