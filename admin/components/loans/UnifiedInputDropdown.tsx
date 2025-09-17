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
  
  // Estados para modal de edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonalData | null>(null);
  
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

  // Lógica de acción
  const getAction = useCallback(() => {
    if (!name.trim() && !phone.trim()) {
      return 'clear';
    } else if (isFromPrevious) {
      const nameChanged = name !== originalData.name;
      const phoneChanged = phone !== originalData.phone;
      return (nameChanged || phoneChanged) ? 'update' : 'connect';
    } else if (selectedPersonId) {
      if (hasDataChanges) {
        return 'update';
      }
      return 'connect';
    } else {
      return 'create';
    }
  }, [name, phone, isFromPrevious, originalData, selectedPersonId, hasDataChanges]);

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
          backgroundColor: '#FFFBEB',
          borderColor: '#D69E2E',
          textColor: '#2D3748',
          icon: '✏️',
          label: actionType === 'client' ? 'Cliente editado' : 'Aval actualizado',
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
    
    let newIsNewPerson: boolean;
    let newHasDataChanges: boolean;
    let currentAction: 'create' | 'update' | 'connect' | 'clear';
    
    if (!value.trim() && !phone.trim()) {
      newIsNewPerson = false;
      newHasDataChanges = false;
      currentAction = 'clear';
    } else if (selectedPersonId) {
      const nameChanged = value !== originalData.name;
      const phoneChanged = phone !== originalData.phone;
      newIsNewPerson = false;
      newHasDataChanges = nameChanged || phoneChanged;
      
      if (newHasDataChanges) {
        currentAction = 'update';
      } else {
        currentAction = 'connect';
      }
    } else {
      newIsNewPerson = true;
      newHasDataChanges = false;
      currentAction = 'create';
    }
    
    setIsNewPerson(newIsNewPerson);
    setHasDataChanges(newHasDataChanges);
    
    onNameChange(value);
    onActionChange(currentAction);
  }, [enableAutocomplete, searchPotentialCollaterals, searchVariables, phone, onNameChange, onActionChange, selectedPersonId, originalData]);

  const handlePhoneChange = useCallback((value: string) => {
    setPhone(value);
    
    let newIsNewPerson: boolean;
    let newHasDataChanges: boolean;
    let currentAction: 'create' | 'update' | 'connect' | 'clear';
    
    if (!name.trim() && !value.trim()) {
      newIsNewPerson = false;
      newHasDataChanges = false;
      currentAction = 'clear';
    } else if (selectedPersonId) {
      const nameChanged = name !== originalData.name;
      const phoneChanged = value !== originalData.phone;
      newIsNewPerson = false;
      newHasDataChanges = nameChanged || phoneChanged;
      
      if (newHasDataChanges) {
        currentAction = 'update';
      } else {
        currentAction = 'connect';
      }
    } else {
      newIsNewPerson = true;
      newHasDataChanges = false;
      currentAction = 'create';
    }
    
    setIsNewPerson(newIsNewPerson);
    setHasDataChanges(newHasDataChanges);
    
    onPhoneChange(value);
    onActionChange(currentAction);
  }, [name, onPhoneChange, onActionChange, selectedPersonId, originalData]);

  const handleClear = useCallback(() => {
    setName('');
    setPhone('');
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
  }, [onNameChange, onPhoneChange, onActionChange]);

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
        selectedPerson={selectedPersonId ? {
          id: selectedPersonId,
          fullName: name,
          phones: [{ id: 'person-phone', number: phone }],
          addresses: []
        } : null}
        onEditPerson={handleEditPerson}
        showEditButton={!!selectedPersonId || isFromPrevious}
        compact={true}
        readonly={readonly}
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
