/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useCallback } from 'react';
import { jsx, Box, Text } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { AlertDialog } from '@keystone-ui/modals';
import { FaTimes, FaUser, FaUserTie, FaCamera } from 'react-icons/fa';
import { DocumentThumbnail } from './DocumentThumbnail';
import { InlineEditField } from './InlineEditField';
import { useMutation, useApolloClient, gql } from '@apollo/client';
import { CREATE_DOCUMENT_PHOTO } from '../../graphql/mutations/documents';
import { UPDATE_PERSONAL_DATA_NAME } from '../../graphql/mutations/personalData';
import { ImageModal } from './ImageModal';

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
}

interface Loan {
  id: string;
  requestedAmount: string;
  signDate: string;
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

interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  onDocumentUpload: (data: {
    documentType: 'INE' | 'DOMICILIO' | 'PAGARE';
    personType: 'TITULAR' | 'AVAL';
    personalDataId: string;
    loanId: string;
    personName: string;
  }) => void;
  onDocumentError: (documentId: string, isError: boolean, errorDescription?: string) => void;
  onDocumentMissing: (documentId: string, isMissing: boolean) => void;
  onCreateMissingDocument: (documentType: 'INE' | 'DOMICILIO' | 'PAGARE', personalDataId: string, loanId: string, personName: string, personType: 'TITULAR' | 'AVAL') => void;
  onDocumentDelete: (documentId: string, documentTitle: string, documentType: 'INE' | 'DOMICILIO' | 'PAGARE', personalDataId: string) => void;
  onNameEdit: (personalDataId: string, newName: string) => void;
  onPhoneEdit: (personalDataId: string, phoneId: string | undefined, newPhone: string) => void;
}

const DOCUMENT_TYPES_TITULAR: Array<'INE' | 'DOMICILIO' | 'PAGARE'> = ['INE', 'DOMICILIO', 'PAGARE'];
const DOCUMENT_TYPES_AVAL: Array<'INE' | 'DOMICILIO'> = ['INE', 'DOMICILIO'];

const getTypeLabel = (type: 'INE' | 'DOMICILIO' | 'PAGARE') => {
  switch (type) {
    case 'INE': return 'INE';
    case 'DOMICILIO': return 'Domicilio';
    case 'PAGARE': return 'Pagaré';
    default: return type;
  }
};

const getDocumentByTypeAndPerson = (
  documents: DocumentPhoto[],
  type: 'INE' | 'DOMICILIO' | 'PAGARE',
  personalDataId: string
): DocumentPhoto | null => {
  return documents.find(doc => 
    doc.documentType === type && doc.personalData.id === personalDataId
  ) || null;
};

interface SelectedImage {
  url: string;
  title: string;
  description: string;
  documentType: string;
  personType: 'TITULAR' | 'AVAL';
}

export const DocumentsModal: React.FC<DocumentsModalProps> = ({
  isOpen,
  onClose,
  loan,
  onDocumentUpload,
  onDocumentError,
  onDocumentMissing,
  onCreateMissingDocument,
  onDocumentDelete,
  onNameEdit,
  onPhoneEdit
}) => {
  // Hooks siempre al inicio del componente
  const [activeTab, setActiveTab] = useState<'titular' | 'aval'>('titular');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [createDocumentPhoto] = useMutation(CREATE_DOCUMENT_PHOTO);
  const [updatePersonalDataName] = useMutation(UPDATE_PERSONAL_DATA_NAME);
  const client = useApolloClient();

  // Memoizar la función handleUploadClick para evitar recreaciones innecesarias
  const handleUploadClick = useCallback(async (
    documentType: 'INE' | 'DOMICILIO' | 'PAGARE',
    personType: 'TITULAR' | 'AVAL',
    personalDataId: string,
    personName: string
  ) => {
    if (!loan) return;

    try {
      // Llamar al callback original primero para crear el documento
      await onDocumentUpload({
        documentType,
        personType,
        personalDataId,
        loanId: loan.id,
        personName
      });

      // Refrescar el caché de Apollo para asegurar que tenemos los datos más recientes
      await client.refetchQueries({
        include: ['GetLoan'], // Asegúrate de que este es el nombre de tu query
      });

    } catch (error) {
      console.error('Error al crear documento:', error);
    }
  }, [loan, onDocumentUpload, client]);

  // Memoizar los documentos filtrados para evitar recálculos innecesarios
  const borrowerDocuments = React.useMemo(() => {
    if (!loan) return [];
    return loan.documentPhotos.filter(doc => 
      doc.personalData.id === loan.borrower.personalData.id
    );
  }, [loan]);

  // Los documentos del aval son los que pertenecen a los collaterals
  const collateralDocuments = React.useMemo(() => {
    if (!loan) return [];
    return loan.documentPhotos.filter(doc => 
      loan.collaterals.some(collateral => collateral.id === doc.personalData.id)
    );
  }, [loan]);

  if (!loan) return null;

  return (
    <AlertDialog
      isOpen={isOpen}
      title=""
      actions={{
        confirm: {
          label: 'Cerrar',
          action: onClose,
        },
      }}
    >
      <Box css={{ 
        maxHeight: '80vh', 
        overflowY: 'auto',
        width: '100%',
        '@media (max-width: 768px)': {
          maxHeight: '70vh'
        }
      }}>
        {/* Header personalizado */}
        <Box css={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          width: '100%',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <Box>
            <Text weight="bold" size="large" css={{ marginBottom: '4px' }}>
              📄 Documentos del Crédito
            </Text>
            <Text size="small" color="neutral600">
              {loan.borrower.personalData.fullName} - ${parseFloat(loan.requestedAmount).toLocaleString()}
            </Text>
          </Box>
        </Box>

        {/* Pestañas */}
        <Box
          css={{
            display: 'flex',
            backgroundColor: '#f1f5f9',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '20px'
          }}
        >
          <Button
            size="small"
            css={{
              flex: 1,
              backgroundColor: activeTab === 'titular' ? '#3b82f6' : 'transparent',
              color: activeTab === 'titular' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center'
            }}
            onClick={() => setActiveTab('titular')}
          >
            <FaUser size={14} />
            Titular
          </Button>
          <Button
            size="small"
            css={{
              flex: 1,
              backgroundColor: activeTab === 'aval' ? '#3b82f6' : 'transparent',
              color: activeTab === 'aval' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center'
            }}
            onClick={() => setActiveTab('aval')}
          >
            <FaUserTie size={14} />
            Aval
          </Button>
        </Box>

        {/* Contenido de documentos */}
        <Box>
          {activeTab === 'titular' ? (
            <Box>
              {/* Información del Titular */}
              <Box
                css={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '20px'
                }}
              >
                <Text weight="semibold" size="medium" marginBottom="small" color="neutral900">
                  👤 Titular
                </Text>
                
                <Box marginBottom="small">
                  <Text size="small" color="neutral700" marginBottom="xsmall">
                    Nombre
                  </Text>
                  <InlineEditField
                    value={loan.borrower.personalData.fullName}
                    onSave={async (newValue) => {
                      try {
                        const result = await updatePersonalDataName({
                          variables: {
                            where: { id: loan.borrower.personalData.id },
                            data: { fullName: newValue.trim() }
                          }
                        });
                        
                        if (result.data?.updatePersonalData) {
                          // Actualizar el caché de Apollo
                          client.cache.modify({
                            id: `PersonalData:${loan.borrower.personalData.id}`,
                            fields: {
                              fullName: () => newValue.trim()
                            }
                          });
                        }
                      } catch (error) {
                        console.error('Error al actualizar nombre:', error);
                        throw error;
                      }
                    }}
                    placeholder="Nombre del titular"
                  />
                </Box>

                <Box marginBottom="small">
                  <Text size="small" color="neutral700" marginBottom="xsmall">
                    Teléfono
                  </Text>
                  <InlineEditField
                    value={loan.borrower.personalData.phones[0]?.number || ''}
                    onSave={async (newValue) => await onPhoneEdit(
                      loan.borrower.personalData.id,
                      loan.borrower.personalData.phones[0]?.id,
                      newValue
                    )}
                    placeholder="Agregar teléfono"
                  />
                </Box>
              </Box>

              {/* Documentos del Titular */}
              <Box
                css={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '20px',
                  alignItems: 'start',
                  '@media (max-width: 1024px)': {
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '16px'
                  },
                  '@media (max-width: 768px)': {
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '12px'
                  }
                }}
              >
                {DOCUMENT_TYPES_TITULAR.map((type) => {
                  const document = getDocumentByTypeAndPerson(
                    borrowerDocuments,
                    type,
                    loan.borrower.personalData.id
                  );

                  return (
                    <Box
                      key={`titular-${type}`}
                      css={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Text size="small" weight="semibold" color="neutral700">
                        {getTypeLabel(type)}
                      </Text>
                      <DocumentThumbnail
                        type={type}
                        personType="TITULAR"
                        imageUrl={document?.photoUrl}
                        publicId={document?.publicId}
                        isError={document?.isError || false}
                        errorDescription={document?.errorDescription || ''}
                        isMissing={document?.isMissing || false}
                        onImageClick={() => {
                          if (document?.photoUrl) {
                            setSelectedImage({
                              url: document.photoUrl,
                              title: document.title || '',
                              description: document.description || '',
                              documentType: type,
                              personType: 'TITULAR'
                            });
                            setShowImageModal(true);
                          }
                        }}
                        onUploadClick={() => handleUploadClick(
                          type,
                          'TITULAR',
                          loan.borrower.personalData.id,
                          loan.borrower.personalData.fullName
                        )}
                        onMarkAsError={(isError, errorDescription) => 
                          document && onDocumentError(document.id, isError, errorDescription)
                        }
                        onMarkAsMissing={(isMissing) => {
                          if (document) {
                            onDocumentMissing(document.id, isMissing);
                          } else if (isMissing) {
                            // Si no hay documento y queremos marcarlo como faltante, crear uno
                            onCreateMissingDocument(type, loan.borrower.personalData.id, loan.id, loan.borrower.personalData.fullName, 'TITULAR');
                          }
                        }}
                        onDelete={() => document && onDocumentDelete(document.id, document.title, document.documentType as 'INE' | 'DOMICILIO' | 'PAGARE', loan.borrower.personalData.id)}
                        size="large"
                      />
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ) : (
            <Box>
              {/* Información del Aval */}
              {loan.collaterals.length > 0 ? (
                <Box
                  css={{
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '20px'
                  }}
                >
                  <Text weight="semibold" size="medium" marginBottom="small" color="neutral900">
                    🤝 Aval
                  </Text>
                  
                  <Box marginBottom="small">
                    <Text size="small" color="neutral700" marginBottom="xsmall">
                      Nombre
                    </Text>
                    <InlineEditField
                      value={loan.collaterals[0].fullName}
                      onSave={async (newValue) => {
                        try {
                          const result = await updatePersonalDataName({
                            variables: {
                              where: { id: loan.collaterals[0].id },
                              data: { fullName: newValue.trim() }
                            }
                          });
                          
                          if (result.data?.updatePersonalData) {
                            // Actualizar el caché de Apollo
                            client.cache.modify({
                              id: `PersonalData:${loan.collaterals[0].id}`,
                              fields: {
                                fullName: () => newValue.trim()
                              }
                            });
                          }
                        } catch (error) {
                          console.error('Error al actualizar nombre del aval:', error);
                          throw error;
                        }
                      }}
                      placeholder="Nombre del aval"
                    />
                  </Box>

                  <Box marginBottom="small">
                    <Text size="small" color="neutral700" marginBottom="xsmall">
                      Teléfono
                    </Text>
                    <InlineEditField
                      value={loan.collaterals[0].phones[0]?.number || ''}
                      onSave={async (newValue) => await onPhoneEdit(
                        loan.collaterals[0].id,
                        loan.collaterals[0].phones[0]?.id,
                        newValue
                      )}
                      placeholder="Agregar teléfono"
                    />
                  </Box>
                </Box>
              ) : (
                <Box
                  css={{
                    padding: '16px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '12px',
                    border: '1px solid #f59e0b',
                    marginBottom: '20px'
                  }}
                >
                  <Text weight="semibold" size="medium" color="neutral900">
                    🤝 Aval
                  </Text>
                  <Text size="small" color="neutral600">
                    No hay aval asignado a este préstamo
                  </Text>
                </Box>
              )}

              {/* Documentos del Aval */}
              {loan.collaterals.length > 0 ? (
                <Box
                  css={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '20px',
                    alignItems: 'start',
                    '@media (max-width: 1024px)': {
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '16px'
                    },
                    '@media (max-width: 768px)': {
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '12px'
                    }
                  }}
                >
                  {DOCUMENT_TYPES_AVAL.map((type) => {
                    // Usar el primer collateral (aval principal)
                    const primaryCollateral = loan.collaterals[0];
                    const document = getDocumentByTypeAndPerson(
                      collateralDocuments,
                      type,
                      primaryCollateral.id
                    );

                    return (
                      <Box
                        key={`aval-${type}`}
                        css={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Text size="small" weight="semibold" color="neutral700">
                          {getTypeLabel(type)}
                        </Text>
                        <DocumentThumbnail
                          type={type}
                          personType="AVAL"
                          imageUrl={document?.photoUrl}
                          publicId={document?.publicId}
                          isError={document?.isError || false}
                          errorDescription={document?.errorDescription || ''}
                          isMissing={document?.isMissing || false}
                          onImageClick={() => document && window.open(document.photoUrl, '_blank')}
                          onUploadClick={() => handleUploadClick(
                            type,
                            'AVAL',
                            primaryCollateral.id,
                            primaryCollateral.fullName
                          )}
                          onMarkAsError={(isError, errorDescription) => 
                            document && onDocumentError(document.id, isError, errorDescription)
                          }
                          onMarkAsMissing={(isMissing) => {
                            if (document) {
                              onDocumentMissing(document.id, isMissing);
                            } else if (isMissing) {
                              // Si no hay documento y queremos marcarlo como faltante, crear uno
                              onCreateMissingDocument(type, primaryCollateral.id, loan.id, primaryCollateral.fullName, 'AVAL');
                            }
                          }}
                          onDelete={() => document && onDocumentDelete(document.id, document.title, document.documentType as 'INE' | 'DOMICILIO' | 'PAGARE', primaryCollateral.id)}
                          size="large"
                        />
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box
                  css={{
                    padding: '20px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '12px',
                    border: '1px solid #f59e0b',
                    textAlign: 'center'
                  }}
                >
                  <Text size="small" color="neutral600">
                    No se pueden mostrar documentos del aval porque no hay aval asignado
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Modal de imagen */}
      {showImageModal && selectedImage && (
        <ImageModal
          isOpen={showImageModal}
          onClose={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
          imageUrl={selectedImage.url}
          title={selectedImage.title}
          description={selectedImage.description}
          documentType={selectedImage.documentType}
          personType={selectedImage.personType}
        />
      )}
    </AlertDialog>
  );
};
