import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLazyQuery, gql } from '@apollo/client';
import { SEARCH_POTENTIAL_COLLATERALS } from '../../graphql/queries/loans';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { createPortal } from 'react-dom';
import EditPersonModal from './EditPersonModal';
import { FaEdit, FaTimes, FaSpinner } from 'react-icons/fa';

interface PersonalData {
  id: string;
  fullName: string;
  phones: Array<{
    id: string;
    number: string;
  }>;
  addresses: Array<{
    id: string;
    location: {
      id: string;
      name: string;
    };
  }>;
}

interface AvalInputWithAutocompleteShadcnProps {
  loanId: string;
  currentName: string;
  currentPhone: string;
  selectedCollateralId?: string;
  selectedCollateralPhoneId?: string;
  onAvalChange: (avalData: {
    avalName: string;
    avalPhone: string;
    selectedCollateralId?: string;
    selectedCollateralPhoneId?: string;
    avalAction: 'create' | 'connect' | 'clear' | 'update';
  }) => void;
  usedPersonIds?: string[];
  borrowerLocationId?: string;
  includeAllLocations?: boolean;
  readonly?: boolean;
  isFromPrevious?: boolean;
  onAvalUpdated?: (updatedPerson: PersonalData) => void;
}

const AvalInputWithAutocompleteShadcn: React.FC<AvalInputWithAutocompleteShadcnProps> = ({
  loanId,
  currentName,
  currentPhone,
  selectedCollateralId,
  selectedCollateralPhoneId,
  onAvalChange,
  usedPersonIds = [],
  borrowerLocationId,
  includeAllLocations = false,
  readonly = false,
  isFromPrevious = false,
  onAvalUpdated
}) => {
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const [searchResults, setSearchResults] = useState<PersonalData[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonalData | null>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [selectedAvalLocation, setSelectedAvalLocation] = useState<{ id: string; name: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const GET_AVAL_INFO = gql`
    query GetAvalInfo($id: ID!) {
      personalData(where: { id: $id }) {
        id
        fullName
        phones {
          id
          number
        }
        addresses {
          id
          location {
            id
            name
          }
        }
      }
    }
  `;

  const [searchPotentialCollaterals, { loading: searchLoading }] = useLazyQuery(
    SEARCH_POTENTIAL_COLLATERALS,
    {
      onCompleted: (data) => {
        let filteredResults = data.personalDatas || [];
        
        // Siempre buscar en todas las localidades (no filtrar por localidad)
        
        if (usedPersonIds.length > 0) {
          filteredResults = filteredResults.filter((person: PersonalData) => {
            if (selectedCollateralId && person.id === selectedCollateralId) {
              return true;
            }
            return !usedPersonIds.includes(person.id);
          });
        }
        
        setSearchResults(filteredResults);
        setIsDropdownOpen(true);
      },
      onError: (error) => {
        console.error('Error searching persons:', error);
      }
    }
  );

  const [getAvalInfo, { loading: avalInfoLoading }] = useLazyQuery(GET_AVAL_INFO, {
    onCompleted: (data) => {
      if (data.personalData) {
        setEditingPerson(data.personalData);
        setIsEditModalOpen(true);
      }
    },
    onError: (error) => {
      console.error('Error getting aval info:', error);
    }
  });

  // Query para obtener la localidad del aval seleccionado
  const [getAvalLocation] = useLazyQuery(GET_AVAL_INFO, {
    onCompleted: (data) => {
      if (data.personalData?.addresses?.[0]?.location) {
        setSelectedAvalLocation({
          id: data.personalData.addresses[0].location.id,
          name: data.personalData.addresses[0].location.name
        });
      } else {
        setSelectedAvalLocation(null);
      }
    },
    onError: () => {
      setSelectedAvalLocation(null);
    }
  });

  useEffect(() => {
    setName(currentName);
    setPhone(currentPhone);
  }, [currentName, currentPhone]);

  // Obtener localidad del aval cuando se selecciona uno
  useEffect(() => {
    if (selectedCollateralId && selectedCollateralId !== 'temp-phone') {
      getAvalLocation({ variables: { id: selectedCollateralId } });
    } else {
      setSelectedAvalLocation(null);
    }
  }, [selectedCollateralId, getAvalLocation]);

  const getCurrentAction = useCallback(() => {
    if (!name.trim() && !phone.trim()) {
      return 'clear';
    } else if (selectedCollateralId) {
      return 'connect';
    } else {
      return 'create';
    }
  }, [name, phone, selectedCollateralId]);

  const handleNameChange = useCallback((value: string) => {
    const upperCaseValue = value.toUpperCase();
    setName(upperCaseValue);
    
    if (upperCaseValue.length >= 2) {
      searchPotentialCollaterals({ 
        variables: { searchTerm: upperCaseValue }
      });
    } else {
      setSearchResults([]);
      setIsDropdownOpen(false);
    }
    
    onAvalChange({
      avalName: upperCaseValue,
      avalPhone: phone,
      selectedCollateralId: selectedCollateralId,
      selectedCollateralPhoneId: selectedCollateralPhoneId,
      avalAction: selectedCollateralId ? 'connect' : 'create'
    });
  }, [phone, selectedCollateralId, selectedCollateralPhoneId, onAvalChange, searchPotentialCollaterals]);

  const handlePhoneChange = useCallback((value: string) => {
    setPhone(value);
    
    onAvalChange({
      avalName: name,
      avalPhone: value,
      selectedCollateralId: selectedCollateralId,
      selectedCollateralPhoneId: selectedCollateralPhoneId,
      avalAction: selectedCollateralId ? 'connect' : 'create'
    });
  }, [name, selectedCollateralId, selectedCollateralPhoneId, onAvalChange]);

  const handleClear = useCallback(() => {
    setName('');
    setPhone('');
    setIsDropdownOpen(false);
    setSelectedAvalLocation(null);
    
    onAvalChange({
      avalName: '',
      avalPhone: '',
      selectedCollateralId: undefined,
      selectedCollateralPhoneId: undefined,
      avalAction: 'clear'
    });
  }, [onAvalChange]);

  const handleSelectPerson = useCallback((person: PersonalData) => {
    const primaryPhone = person.phones?.[0]?.number || '';
    const location = person.addresses?.[0]?.location;
    
    setName(person.fullName);
    setPhone(primaryPhone);
    setIsDropdownOpen(false);
    
    if (location) {
      setSelectedAvalLocation({
        id: location.id,
        name: location.name
      });
    } else {
      setSelectedAvalLocation(null);
    }
    
    onAvalChange({
      avalName: person.fullName,
      avalPhone: primaryPhone,
      selectedCollateralId: person.id,
      selectedCollateralPhoneId: person.phones?.[0]?.id,
      avalAction: 'connect'
    });
  }, [onAvalChange]);

  const handleCreateNew = useCallback(() => {
    if (!name.trim()) return;
    
    setIsDropdownOpen(false);
    setSelectedAvalLocation(null);
    
    onAvalChange({
      avalName: name.toUpperCase(),
      avalPhone: phone,
      selectedCollateralId: undefined,
      selectedCollateralPhoneId: undefined,
      avalAction: 'create'
    });
  }, [name, phone, onAvalChange]);

  const handleEditPerson = useCallback(() => {
    if (selectedCollateralId && selectedCollateralId !== 'temp-phone') {
      getAvalInfo({ variables: { id: selectedCollateralId } });
    } else if (name || phone) {
      setEditingPerson({
        id: selectedCollateralId || 'temp',
        fullName: name,
        phones: phone ? [{ id: selectedCollateralPhoneId || 'temp-phone', number: phone }] : [],
        addresses: []
      });
      setIsEditModalOpen(true);
    }
  }, [selectedCollateralId, name, phone, selectedCollateralPhoneId, getAvalInfo]);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingPerson(null);
  }, []);

  const handleSaveEditedPerson = useCallback(async (updatedPerson: PersonalData) => {
    try {
      setName(updatedPerson.fullName);
      setPhone(updatedPerson.phones?.[0]?.number || '');
      
      onAvalChange({
        avalName: updatedPerson.fullName,
        avalPhone: updatedPerson.phones?.[0]?.number || '',
        selectedCollateralId: updatedPerson.id,
        selectedCollateralPhoneId: updatedPerson.phones?.[0]?.id,
        avalAction: 'update'
      });
      
      if (onAvalUpdated) {
        onAvalUpdated(updatedPerson);
      }
      
      handleCloseEditModal();
    } catch (error) {
      console.error('Error al guardar cambios del aval:', error);
    }
  }, [onAvalChange, onAvalUpdated, handleCloseEditModal]);

  const handleNameBlur = useCallback(() => {
    if (name.trim() && searchResults.length === 0 && !searchLoading) {
      setTimeout(() => {
        if (name.trim() && searchResults.length === 0) {
          handleCreateNew();
        }
      }, 1000);
    }
  }, [name, searchResults, searchLoading, handleCreateNew]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const action = getCurrentAction();
  const actionConfig = {
    connect: { bg: '#EBF8FF', border: '#3182CE', icon: '🔗', label: 'Aval seleccionado' },
    create: { bg: '#F0FFF4', border: '#38A169', icon: '➕', label: 'Nuevo aval' },
    clear: { bg: '#F7FAFC', border: '#E2E8F0', icon: '👤', label: 'Sin aval' }
  }[action];

  if (readonly) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', height: '36px' }}>
        <span style={{ fontSize: '13px' }}>{name || 'Sin aval'}</span>
        {phone && <span style={{ fontSize: '13px', color: '#6B7280' }}>{phone}</span>}
      </div>
    );
  }

  const dropdownPosition = nameInputRef.current?.getBoundingClientRect();

  // Determinar si el aval es de la misma localidad
  const isSameLocation = borrowerLocationId && selectedAvalLocation?.id === borrowerLocationId;
  const locationBadge = selectedAvalLocation ? (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: '600',
        backgroundColor: isSameLocation ? '#D1FAE5' : '#FEF3C7',
        color: isSameLocation ? '#065F46' : '#92400E',
        marginLeft: '4px'
      }}
      title={isSameLocation ? 'Misma localidad' : 'Otra localidad'}
    >
      {isSameLocation ? '✓' : '⚠'} {selectedAvalLocation.name}
    </span>
  ) : null;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Contenedor de inputs con borde de acción */}
      <div style={{
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        border: `2px solid ${actionConfig.border}`,
        borderRadius: '6px',
        backgroundColor: actionConfig.bg,
        padding: '2px',
        transition: 'all 0.2s',
        minHeight: '36px'
      }}>
        {/* Indicador de acción */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          fontSize: '14px',
          flexShrink: 0
        }}>
          {actionConfig.icon}
        </div>

        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
            <Input
              ref={nameInputRef}
              placeholder="Buscar o escribir nombre del aval..."
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => {
                setNameFocused(true);
                if (name.length >= 2) {
                  setIsDropdownOpen(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setNameFocused(false);
                  handleNameBlur();
                  setIsDropdownOpen(false);
                }, 150);
              }}
              style={{
                height: '32px',
                fontSize: '13px',
                padding: '0 10px',
                border: 'none',
                backgroundColor: 'transparent',
                boxShadow: 'none',
                flex: 1,
                transition: 'none'
              }}
            />
            {locationBadge}
          </div>
          {nameFocused || name ? (
            <Input
              ref={phoneInputRef}
              placeholder={name ? `Tel. ${name.split(' ')[0]}...` : "Teléfono"}
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setPhoneFocused(false)}
              style={{
                height: '32px',
                fontSize: '13px',
                padding: '0 10px',
                border: 'none',
                backgroundColor: 'transparent',
                boxShadow: 'none',
                transition: 'none'
              }}
            />
          ) : null}
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
          {selectedCollateralId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEditPerson}
              style={{
                width: '28px',
                height: '28px',
                padding: '0'
              }}
              title="Editar aval"
            >
              <FaEdit size={12} />
            </Button>
          )}
          {(name || phone) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              style={{
                width: '28px',
                height: '28px',
                padding: '0'
              }}
              title="Limpiar"
            >
              <FaTimes size={12} />
            </Button>
          )}
        </div>
      </div>

      {/* Dropdown de resultados */}
      {isDropdownOpen && dropdownPosition && (
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPosition.bottom + 4,
              left: dropdownPosition.left,
              width: Math.max(dropdownPosition.width, 300),
              backgroundColor: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999,
              maxHeight: '200px',
              overflowY: 'auto'
            }}
          >
            {/* Opción para limpiar */}
            {(name || phone) && (
              <div
                onClick={handleClear}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #E5E7EB',
                  fontSize: '12px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FEE2E2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FEF2F2';
                }}
              >
                🚫 Sin aval
              </div>
            )}

            {searchLoading ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#6B7280' }}>
                <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ marginLeft: '8px', fontSize: '12px' }}>Buscando...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((person) => {
                const primaryPhone = person.phones?.[0]?.number || 'Sin teléfono';
                const location = person.addresses?.[0]?.location?.name || 'Sin localidad';

                return (
                  <div
                    key={person.id}
                    onClick={() => handleSelectPerson(person)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #E5E7EB',
                      fontSize: '12px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <div style={{ fontWeight: '500', color: '#1F2937', marginBottom: '2px' }}>
                      {person.fullName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>
                      {primaryPhone} • {location}
                    </div>
                  </div>
                );
              })
            ) : name.length >= 2 && !searchLoading ? (
              <div
                onClick={handleCreateNew}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  backgroundColor: '#F0FFF4',
                  color: '#059669',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#D1FAE5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F0FFF4';
                }}
              >
                ➕ Crear nuevo: {name}
              </div>
            ) : null}
          </div>,
          document.body
        )
      )}

      {/* Modal de edición */}
      <EditPersonModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        person={editingPerson}
        onSave={handleSaveEditedPerson}
        title="Editar Aval"
      />

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AvalInputWithAutocompleteShadcn;

