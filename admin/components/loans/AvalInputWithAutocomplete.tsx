/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jsx } from '@keystone-ui/core';
import { useLazyQuery, gql } from '@apollo/client';
import { SEARCH_POTENTIAL_COLLATERALS } from '../../graphql/queries/loans';
import UnifiedInput from './UnifiedInput';
import EditPersonModal from './EditPersonModal';

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

interface AvalInputWithAutocompleteProps {
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
  isFromPrevious?: boolean; // ✅ NUEVO: Indicar si viene de préstamo anterior
  onAvalUpdated?: (updatedPerson: PersonalData) => void; // ✅ NUEVO: Callback para actualizar aval
}

const AvalInputWithAutocomplete: React.FC<AvalInputWithAutocompleteProps> = ({
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
  isFromPrevious = false, // ✅ NUEVO: Prop para indicar si viene de préstamo anterior
  onAvalUpdated // ✅ NUEVO: Callback para actualizar aval
}) => {
  // Estados internos
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const [searchResults, setSearchResults] = useState<PersonalData[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [includeAllLocationState, setIncludeAllLocationState] = useState(includeAllLocations);
  
  // ✅ NUEVO: Estados para modal de edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonalData | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ NUEVO: Query para obtener información completa del aval
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

  // GraphQL hook para búsqueda
  const [searchPotentialCollaterals, { loading: searchLoading }] = useLazyQuery(
    SEARCH_POTENTIAL_COLLATERALS,
    {
      onCompleted: (data) => {
        let filteredResults = data.personalDatas || [];
        
        // Filtrar por localidad si no incluye todas las localidades
        if (!includeAllLocationState && borrowerLocationId) {
          filteredResults = (data.personalDatas || []).filter((person: PersonalData) =>
            person.addresses?.some(address => 
              address.location?.id === borrowerLocationId
            )
          );
        }
        
        // Filtrar personas ya usadas (excepto la actual)
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

  // ✅ NUEVO: Hook para obtener información completa del aval
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

  // Sincronizar con props externas
  useEffect(() => {
    setName(currentName);
    setPhone(currentPhone);
  }, [currentName, currentPhone]);

  // Determinar la acción actual
  const getCurrentAction = useCallback(() => {
    if (!name.trim() && !phone.trim()) {
      return 'clear';
    } else if (selectedCollateralId) {
      return 'connect';
    } else {
      return 'create';
    }
  }, [name, phone, selectedCollateralId]);

  // Obtener configuración de la acción
  const getActionConfig = useCallback(() => {
    const action = getCurrentAction();
    
    switch (action) {
      case 'connect':
        return {
          backgroundColor: '#EBF8FF',
          borderColor: '#3182CE',
          textColor: '#2D3748',
          icon: '🔗',
          label: 'Aval seleccionado'
        };
      case 'create':
        return {
          backgroundColor: '#F0FFF4',
          borderColor: '#38A169',
          textColor: '#2D3748',
          icon: '➕',
          label: 'Nuevo aval'
        };
      case 'clear':
      default:
        return {
          backgroundColor: '#F7FAFC',
          borderColor: '#E2E8F0',
          textColor: '#718096',
          icon: '👤',
          label: 'Sin aval'
        };
    }
  }, [getCurrentAction]);

  // Handlers
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    
    if (value.length >= 2) {
      searchPotentialCollaterals({ 
        variables: { searchTerm: value }
      });
    } else {
      setSearchResults([]);
    }
    
    // Notificar cambio al padre
    onAvalChange({
      avalName: value,
      avalPhone: phone,
      selectedCollateralId: selectedCollateralId,
      selectedCollateralPhoneId: selectedCollateralPhoneId,
      avalAction: selectedCollateralId ? 'connect' : 'create'
    });
  }, [phone, selectedCollateralId, selectedCollateralPhoneId, onAvalChange, searchPotentialCollaterals]);

  const handlePhoneChange = useCallback((value: string) => {
    setPhone(value);
    
    // Notificar cambio al padre
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
    
    // Notificar cambio al padre
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
    
    setName(person.fullName);
    setPhone(primaryPhone);
    setIsDropdownOpen(false);
    
    // Notificar cambio al padre con la persona seleccionada
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
    
    // Notificar cambio al padre para crear nueva persona
    onAvalChange({
      avalName: name,
      avalPhone: phone,
      selectedCollateralId: undefined,
      selectedCollateralPhoneId: undefined,
      avalAction: 'create'
    });
  }, [name, phone, onAvalChange]);

  // ✅ NUEVO: Función para manejar la edición de persona
  const handleEditPerson = useCallback((person: PersonalData) => {
    // Si el aval tiene un ID real (no temp-phone), obtener información completa desde la base de datos
    if (selectedCollateralId && selectedCollateralId !== 'temp-phone') {
      console.log('🔍 Obteniendo información completa del aval desde la base de datos:', selectedCollateralId);
      getAvalInfo({ variables: { id: selectedCollateralId } });
    } else {
      // Si no tiene ID real, usar la información que tenemos
      setEditingPerson(person);
      setIsEditModalOpen(true);
    }
  }, [selectedCollateralId, getAvalInfo]);

  // ✅ NUEVO: Función para cerrar el modal de edición
  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingPerson(null);
  }, []);

  // ✅ NUEVO: Función para guardar los cambios de la persona editada
  const handleSaveEditedPerson = useCallback(async (updatedPerson: PersonalData) => {
    try {
      // Actualizar el estado local
      setName(updatedPerson.fullName);
      setPhone(updatedPerson.phones?.[0]?.number || '');
      
      // Notificar cambio al padre con los datos actualizados
      onAvalChange({
        avalName: updatedPerson.fullName,
        avalPhone: updatedPerson.phones?.[0]?.number || '',
        selectedCollateralId: updatedPerson.id,
        selectedCollateralPhoneId: updatedPerson.phones?.[0]?.id,
        avalAction: 'update'
      });
      
      // Llamar al callback de actualización si existe
      if (onAvalUpdated) {
        onAvalUpdated(updatedPerson);
      }
      
      // Cerrar el modal
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

  // Efecto para cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const actionConfig = getActionConfig();

  if (readonly) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span>{name || 'Sin aval'}</span>
        <span>{phone || 'Sin teléfono'}</span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Checkbox para buscar en todas las localidades */}
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        fontSize: '11px', 
        color: '#6B7280', 
        fontWeight: '500',
        marginBottom: '6px'
      }}>
        <input
          type="checkbox"
          checked={includeAllLocationState}
          onChange={(e) => setIncludeAllLocationState(e.target.checked)}
          style={{ margin: 0 }}
        />
        Buscar en todas las localidades
      </label>
      
      <UnifiedInput
        name={name}
        phone={phone}
        onNameChange={handleNameChange}
        onPhoneChange={handlePhoneChange}
        onClear={handleClear}
        actionConfig={actionConfig}
        namePlaceholder="Buscar o escribir nombre del aval..."
        phonePlaceholder={name ? `Tel. ${name.split(' ')[0]}...` : "Teléfono"}
        isFocused={false}
        onFocus={() => setIsDropdownOpen(true)}
        onBlur={() => {
          setTimeout(() => {
            handleNameBlur();
            setIsDropdownOpen(false);
          }, 150);
        }}
        showDropdown={isDropdownOpen}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onSelectPerson={handleSelectPerson}
        onCreateNew={handleCreateNew}
        dropdownRef={dropdownRef}
        inputRef={inputRef}
        selectedPerson={selectedCollateralId ? {
          id: selectedCollateralId,
          fullName: name,
          phones: phone ? [{ 
            id: selectedCollateralPhoneId || 'temp-phone', 
            number: phone 
          }] : [],
          addresses: []
        } : null}
        onEditPerson={handleEditPerson} // ✅ NUEVO: Implementar edición
        showEditButton={!!selectedCollateralId} // ✅ NUEVO: Mostrar botón de edición cuando hay aval seleccionado
        compact={true}
        readonly={readonly}
        showClearOption={true}
      />
      
      {/* ✅ NUEVO: Modal de edición */}
      <EditPersonModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        person={editingPerson}
        onSave={handleSaveEditedPerson}
        title="Editar Aval"
      />
    </div>
  );
};

export default AvalInputWithAutocomplete;
