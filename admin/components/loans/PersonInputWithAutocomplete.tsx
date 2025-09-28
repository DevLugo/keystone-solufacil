/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { jsx } from '@keystone-ui/core';
import { useLazyQuery, useMutation } from '@apollo/client';
import { SEARCH_POTENTIAL_COLLATERALS } from '../../graphql/queries/loans';
import { CREATE_PERSONAL_DATA } from '../../graphql/mutations/loans';
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

interface PersonInputWithAutocompleteProps {
  loanId: string;
  // Datos básicos
  currentName: string;
  currentPhone: string;
  onNameChange: (name: string) => void;
  onPhoneChange: (phone: string) => void;
  onClear: () => void;
  onActionChange: (action: 'create' | 'update' | 'connect' | 'clear') => void;
  onPersonUpdated?: (updatedPerson: PersonalData) => void; // ✅ Nueva prop para refrescar datos
  
  // Configuración de autocomplete
  enableAutocomplete?: boolean;
  searchQuery?: any; // GraphQL query para búsqueda
  searchVariables?: any; // Variables para la búsqueda
  onSearchResults?: (results: PersonalData[]) => void; // Callback para procesar resultados
  
  // Configuración de persona seleccionada
  selectedPersonId?: string;
  onPersonSelect?: (person: PersonalData) => void;
  
  // Configuración de persona existente (para renovaciones)
  isFromPrevious?: boolean;
  originalData?: { name: string; phone: string };
  clientPersonalDataId?: string; // ID real del PersonalData del cliente
  clientPhoneId?: string; // ID real del teléfono del cliente
  selectedCollateralPhoneId?: string; // ID real del teléfono del aval
  leaderLocation?: string;
  leaderName?: string;
  showLocationTag?: boolean;
  
  // Configuración de filtros
  usedPersonIds?: string[];
  borrowerLocationId?: string;
  includeAllLocations?: boolean;
  
  // Configuración de UI
  namePlaceholder?: string;
  phonePlaceholder?: string;
  readonly?: boolean;
  containerStyle?: React.CSSProperties;
  
  // Configuración de acción
  actionType?: 'client' | 'aval';
}

const PersonInputWithAutocomplete: React.FC<PersonInputWithAutocompleteProps> = ({
  loanId,
  // Datos básicos
  currentName,
  currentPhone,
  onNameChange,
  onPhoneChange,
  onClear,
  onActionChange,
  onPersonUpdated,
  
  // Configuración de autocomplete
  enableAutocomplete = false,
  searchQuery,
  searchVariables,
  onSearchResults,
  
  // Configuración de persona seleccionada
  selectedPersonId,
  onPersonSelect,
  
  // Configuración de persona existente
  isFromPrevious = false,
  originalData = { name: '', phone: '' },
  clientPersonalDataId,
  clientPhoneId,
  selectedCollateralPhoneId,
  leaderLocation = '',
  leaderName = '',
  showLocationTag = false,
  
  // Configuración de filtros
  usedPersonIds = [],
  borrowerLocationId,
  includeAllLocations = false,
  
  // Configuración de UI
  namePlaceholder = "Nombre...",
  phonePlaceholder = "Teléfono...",
  readonly = false,
  containerStyle = {},
  
  // Configuración de acción
  actionType = 'client'
}) => {
  // Estados internos
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const [searchResults, setSearchResults] = useState<PersonalData[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNewPerson, setIsNewPerson] = useState(false);
  const [hasDataChanges, setHasDataChanges] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [includeAllLocationState, setIncludeAllLocationState] = useState(includeAllLocations);
  const [internalSelectedPersonId, setInternalSelectedPersonId] = useState<string | undefined>(selectedPersonId);
  
  // Estados para modal de edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonalData | null>(null);
  
  // Debug
  console.log('PersonInputWithAutocomplete props:', {
    actionType,
    isFromPrevious,
    clientPersonalDataId,
    clientPhoneId,
    currentName,
    currentPhone
  });
  
  // Debug específico para el selectedPerson
  console.log('selectedPerson debug:', {
    shouldShow: (actionType === 'client' && isFromPrevious) || (actionType === 'aval' && internalSelectedPersonId),
    phoneId: actionType === 'client' ? (clientPhoneId || 'temp-phone') : 'temp-phone',
    clientPhoneId,
    actionType,
    isFromPrevious
  });
  
  // Verificar si tenemos el ID real del PersonalData
  if (actionType === 'client' && isFromPrevious && !clientPersonalDataId) {
    console.error('❌ ERROR: clientPersonalDataId is undefined for client from previous loan!');
  }
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // GraphQL hooks
  const [searchPotentialCollaterals, { loading: searchLoading }] = useLazyQuery(
    searchQuery || SEARCH_POTENTIAL_COLLATERALS,
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
            if (selectedPersonId && person.id === selectedPersonId) {
              return true;
            }
            return !usedPersonIds.includes(person.id);
          });
        }
        
        setSearchResults(filteredResults);
        setIsDropdownOpen(true);
        
        // Callback personalizado para procesar resultados
        if (onSearchResults) {
          onSearchResults(filteredResults);
        }
      },
      onError: (error) => {
        console.error('Error searching persons:', error);
      }
    }
  );

  // Efectos para sincronizar con props externas
  useEffect(() => {
    const propsName = currentName || '';
    const propsPhone = currentPhone || '';
    
    if (propsName !== name || propsPhone !== phone) {
      setName(propsName);
      setPhone(propsPhone);
    }
  }, [currentName, currentPhone]);

  useEffect(() => {
    setInternalSelectedPersonId(selectedPersonId);
  }, [selectedPersonId]);

  // Lógica de acción
  const getAction = useCallback(() => {
    if (!name.trim() && !phone.trim()) {
      return 'clear';
    } else if (isFromPrevious) {
      const nameChanged = name !== originalData.name;
      const phoneChanged = phone !== originalData.phone;
      return (nameChanged || phoneChanged) ? 'update' : 'connect';
    } else if (internalSelectedPersonId) {
      if (hasDataChanges) {
        return 'update';
      }
      return 'connect';
    } else {
      return 'create';
    }
  }, [name, phone, isFromPrevious, originalData, internalSelectedPersonId, hasDataChanges]);

  const getActionConfig = useCallback(() => {
    const action = getAction();
    
    switch (action) {
      case 'connect':
        return {
          backgroundColor: '#EBF8FF',
          borderColor: '#3182CE',
          textColor: '#2D3748',
          icon: '🔗',
          label: actionType === 'client' ? 'Cliente existente' : 'Aval seleccionado',
          location: showLocationTag && leaderLocation && leaderLocation !== 'Sin localidad' ? leaderLocation : undefined,
          leaderName: leaderName
        };
      case 'update':
        return {
          backgroundColor: '#EBF8FF',
          borderColor: '#3182CE',
          textColor: '#2D3748',
          icon: '🔗',
          label: actionType === 'client' ? 'Cliente existente' : 'Aval seleccionado',
          location: showLocationTag && leaderLocation && leaderLocation !== 'Sin localidad' ? leaderLocation : undefined,
          leaderName: leaderName
        };
      case 'create':
        return {
          backgroundColor: '#F0FFF4',
          borderColor: '#38A169',
          textColor: '#2D3748',
          icon: '➕',
          label: actionType === 'client' ? 'Nuevo cliente' : 'Nuevo aval'
        };
      case 'clear':
      default:
        return {
          backgroundColor: '#F7FAFC',
          borderColor: '#E2E8F0',
          textColor: '#718096',
          icon: '👤',
          label: actionType === 'client' ? 'Sin cliente' : 'Sin aval'
        };
    }
  }, [getAction, leaderLocation, leaderName, showLocationTag, actionType]);

  // Handlers
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    
    if (enableAutocomplete && value.length >= 2) {
      searchPotentialCollaterals({ 
        variables: searchVariables || { searchTerm: value }
      });
    } else {
      setSearchResults([]);
    }
    
    onNameChange(value);
  }, [enableAutocomplete, searchPotentialCollaterals, searchVariables, onNameChange]);

  const handlePhoneChange = useCallback((value: string) => {
    setPhone(value);
    onPhoneChange(value);
  }, [onPhoneChange]);

  // Efecto para manejar la lógica de estado sin interferir con las selecciones
  useEffect(() => {
    // Solo actualizar el estado interno, no llamar onActionChange aquí
    let newIsNewPerson: boolean;
    let newHasDataChanges: boolean;
    
    if (!name.trim() && !phone.trim()) {
      newIsNewPerson = false;
      newHasDataChanges = false;
    } else if (isFromPrevious) {
      const nameChanged = name !== originalData.name;
      const phoneChanged = phone !== originalData.phone;
      newIsNewPerson = false;
      newHasDataChanges = nameChanged || phoneChanged;
    } else if (internalSelectedPersonId) {
      newIsNewPerson = false;
      newHasDataChanges = hasDataChanges;
    } else {
      newIsNewPerson = true;
      newHasDataChanges = true;
    }
    
    setIsNewPerson(newIsNewPerson);
    setHasDataChanges(newHasDataChanges);
  }, [name, phone, isFromPrevious, originalData, internalSelectedPersonId, hasDataChanges]);

  const handleClear = useCallback(() => {
    setName('');
    setPhone('');
    setInternalSelectedPersonId(undefined);
    setIsNewPerson(false);
    setHasDataChanges(false);
    setIsDropdownOpen(false);
    onClear();
    onActionChange('clear');
  }, [onClear, onActionChange]);

  const handleSelectPerson = useCallback((person: PersonalData) => {
    const primaryPhone = person.phones?.[0]?.number || '';
    
    setName(person.fullName);
    setPhone(primaryPhone);
    setInternalSelectedPersonId(person.id);
    setIsDropdownOpen(false);
    
    setIsNewPerson(false);
    setHasDataChanges(false);
    
    if (onPersonSelect) {
      onPersonSelect(person);
    }
    
    onNameChange(person.fullName);
    onPhoneChange(primaryPhone);
    onActionChange('connect');
  }, [onPersonSelect, onNameChange, onPhoneChange, onActionChange]);

  const handleCreateNew = useCallback(() => {
    if (!name.trim()) return;
    
    setIsNewPerson(true);
    setHasDataChanges(false);
    setIsDropdownOpen(false);
    onActionChange('create');
  }, [name, onActionChange]);

  const handleNameBlur = useCallback(() => {
    if (enableAutocomplete && name.trim() && searchResults.length === 0 && !searchLoading) {
      setTimeout(() => {
        if (name.trim() && searchResults.length === 0) {
          handleCreateNew();
        }
      }, 1000);
    }
  }, [enableAutocomplete, name, searchResults, searchLoading, handleCreateNew]);

  // Handlers para modal de edición
  const handleEditPerson = useCallback((person: PersonalData) => {
    setEditingPerson(person);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingPerson(null);
  }, []);

  const handleSaveEditedPerson = useCallback((updatedPerson: PersonalData) => {
    setName(updatedPerson.fullName);
    setPhone(updatedPerson.phones?.[0]?.number || '');
    onNameChange(updatedPerson.fullName);
    onPhoneChange(updatedPerson.phones?.[0]?.number || '');
    onActionChange('update');
    
    // ✅ SOLUCION: Notificar al componente padre que la persona fue actualizada
    if (onPersonUpdated) {
      onPersonUpdated(updatedPerson);
    }
  }, [onNameChange, onPhoneChange, onActionChange, onPersonUpdated]);

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
        <span>{name || `Sin ${actionType}`}</span>
        <span>{phone || 'Sin teléfono'}</span>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%',
      ...containerStyle 
    }}>
      {/* Checkbox para buscar en todas las localidades (solo si autocomplete está habilitado) */}
      {enableAutocomplete && (
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
      )}
      
      <UnifiedInput
        name={name}
        phone={phone}
        onNameChange={handleNameChange}
        onPhoneChange={handlePhoneChange}
        onClear={handleClear}
        actionConfig={actionConfig}
        namePlaceholder={namePlaceholder}
        phonePlaceholder={phonePlaceholder}
        isFocused={isInputFocused}
        onFocus={() => {
          setIsInputFocused(true);
          if (enableAutocomplete) {
            setIsDropdownOpen(true);
          }
        }}
        onBlur={() => {
          setIsInputFocused(false);
          if (enableAutocomplete) {
            setTimeout(() => {
              handleNameBlur();
              setIsDropdownOpen(false);
            }, 150);
          }
        }}
        showDropdown={enableAutocomplete && isDropdownOpen}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onSelectPerson={enableAutocomplete ? handleSelectPerson : undefined}
        onCreateNew={enableAutocomplete ? handleCreateNew : undefined}
        dropdownRef={dropdownRef}
        inputRef={inputRef}
        selectedPerson={(actionType === 'client' && isFromPrevious) || (actionType === 'aval' && internalSelectedPersonId) ? {
          id: actionType === 'client' ? (clientPersonalDataId || 'client-selected') : (selectedPersonId || internalSelectedPersonId || 'temp-id'),
          fullName: name,
          phones: phone ? [{ 
            id: actionType === 'client' 
              ? (clientPhoneId || 'temp-phone') 
              : (selectedCollateralPhoneId && selectedCollateralPhoneId !== 'temp-phone' ? selectedCollateralPhoneId : 'temp-phone'), 
            number: phone 
          }] : [],
          addresses: []
        } : null}
        onEditPerson={handleEditPerson}
        showEditButton={actionType === 'client' ? isFromPrevious : !!internalSelectedPersonId}
        compact={true}
        readonly={readonly}
        showClearOption={actionType === 'aval'}
      />

      {/* Modal de edición */}
      <EditPersonModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        person={editingPerson}
        onSave={handleSaveEditedPerson}
        title={`Editar ${actionType === 'client' ? 'Cliente' : 'Aval'}`}
      />
    </div>
  );
};

export default PersonInputWithAutocomplete;
