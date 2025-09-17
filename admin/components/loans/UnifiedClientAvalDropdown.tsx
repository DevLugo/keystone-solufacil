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

interface UnifiedClientAvalDropdownProps {
  loanId: string;
  // Datos del cliente
  currentClientName: string;
  currentClientPhone: string;
  isFromPreviousLoan?: boolean;
  leaderLocation?: string;
  leaderName?: string;
  showLocationTag?: boolean;
  onClientChange: (clientName: string, clientPhone: string, action: 'create' | 'update' | 'connect' | 'clear') => void;
  // Datos del aval
  currentAvalName: string;
  currentAvalPhone: string;
  borrowerLocationId?: string;
  onAvalChange: (avalName: string, avalPhone: string, personalDataId?: string, action?: 'create' | 'update' | 'connect' | 'clear') => void;
  includeAllLocations?: boolean;
  onlyNameField?: boolean;
  usedAvalIds?: string[];
  selectedCollateralId?: string;
  readonly?: boolean;
  // Estilos personalizables
  containerStyle?: React.CSSProperties;
  clientContainerStyle?: React.CSSProperties;
  avalContainerStyle?: React.CSSProperties;
}

const UnifiedClientAvalDropdown: React.FC<UnifiedClientAvalDropdownProps> = ({
  loanId,
  // Cliente
  currentClientName,
  currentClientPhone,
  isFromPreviousLoan = false,
  leaderLocation = '',
  leaderName = '',
  showLocationTag = false,
  onClientChange,
  // Aval
  currentAvalName,
  currentAvalPhone,
  borrowerLocationId,
  onAvalChange,
  includeAllLocations = false,
  onlyNameField = false,
  usedAvalIds = [],
  selectedCollateralId,
  readonly = false,
  // Estilos personalizables
  containerStyle = {},
  clientContainerStyle = {},
  avalContainerStyle = {}
}) => {
  // Estados del cliente
  const [clientName, setClientName] = useState(currentClientName);
  const [clientPhone, setClientPhone] = useState(currentClientPhone);
  const [internalIsFromPreviousLoan, setInternalIsFromPreviousLoan] = useState(isFromPreviousLoan);
  const [clientOriginalData, setClientOriginalData] = useState({ name: '', phone: '' });
  const [isClientFocused, setIsClientFocused] = useState(false);

  // Estados del aval
  const [avalName, setAvalName] = useState(currentAvalName);
  const [avalPhone, setAvalPhone] = useState(currentAvalPhone);
  const [searchResults, setSearchResults] = useState<PersonalData[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedPersonalDataId, setSelectedPersonalDataId] = useState<string | undefined>(undefined);
  const [isNewAval, setIsNewAval] = useState(false);
  const [hasAvalDataChanges, setHasAvalDataChanges] = useState(false);
  const [avalOriginalData, setAvalOriginalData] = useState<{name: string, phone: string, id?: string}>({
    name: '',
    phone: '',
    id: undefined
  });
  const [isAvalNameInputFocused, setIsAvalNameInputFocused] = useState(false);
  const [includeAllLocationState, setIncludeAllLocationState] = useState(includeAllLocations);

  // Estados para modal de edición
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonalData | null>(null);
  const [editingType, setEditingType] = useState<'client' | 'aval'>('aval');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const avalNameInputRef = useRef<HTMLInputElement>(null);

  // GraphQL hooks
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
        
        // Filtrar avales ya usados hoy (excepto el actual)
        if (usedAvalIds.length > 0) {
          filteredResults = filteredResults.filter((person: PersonalData) => {
            if (selectedPersonalDataId && person.id === selectedPersonalDataId) {
              return true;
            }
            return !usedAvalIds.includes(person.id);
          });
        }
        
        setSearchResults(filteredResults);
        setIsDropdownOpen(true);
      },
      onError: (error) => {
        console.error('Error searching collaterals:', error);
      }
    }
  );

  const [createPersonalData] = useMutation(CREATE_PERSONAL_DATA);

  // Efectos para sincronizar con props externas
  useEffect(() => {
    const propsClientName = currentClientName || '';
    const propsClientPhone = currentClientPhone || '';
    
    if (isFromPreviousLoan) {
      setInternalIsFromPreviousLoan(true);
      if (!clientOriginalData.name && !clientOriginalData.phone) {
        setClientOriginalData({ name: propsClientName, phone: propsClientPhone });
      }
    } else {
      setInternalIsFromPreviousLoan(false);
      setClientOriginalData({ name: '', phone: '' });
    }
    
    if (propsClientName !== clientName || propsClientPhone !== clientPhone) {
      setClientName(propsClientName);
      setClientPhone(propsClientPhone);
    }
  }, [currentClientName, currentClientPhone, isFromPreviousLoan, clientOriginalData.name, clientOriginalData.phone]);

  useEffect(() => {
    const propsAvalName = currentAvalName || '';
    const propsAvalPhone = currentAvalPhone || '';
    
    if (propsAvalName !== avalName || propsAvalPhone !== avalPhone) {
      setAvalName(propsAvalName);
      setAvalPhone(propsAvalPhone);
      
      if (selectedCollateralId && !selectedPersonalDataId) {
        setSelectedPersonalDataId(selectedCollateralId);
      }
      
      if (propsAvalName || propsAvalPhone) {
        setIsNewAval(false);
        setHasAvalDataChanges(false);
        const existingId = selectedCollateralId || selectedPersonalDataId;
        setAvalOriginalData({
          name: propsAvalName,
          phone: propsAvalPhone,
          id: existingId
        });
      } else {
        setIsNewAval(false);
        setHasAvalDataChanges(false);
        setAvalOriginalData({
          name: '',
          phone: '',
          id: undefined
        });
      }
    }
  }, [currentAvalName, currentAvalPhone, selectedCollateralId, selectedPersonalDataId]);

  // Lógica del cliente
  const getClientAction = useCallback(() => {
    if (!clientName.trim() && !clientPhone.trim()) {
      return 'clear';
    } else if (internalIsFromPreviousLoan) {
      const nameChanged = clientName !== clientOriginalData.name;
      const phoneChanged = clientPhone !== clientOriginalData.phone;
      return (nameChanged || phoneChanged) ? 'update' : 'connect';
    } else {
      return 'create';
    }
  }, [clientName, clientPhone, internalIsFromPreviousLoan, clientOriginalData]);

  const getClientActionConfig = useCallback(() => {
    const action = getClientAction();
    
    switch (action) {
      case 'connect':
        return {
          backgroundColor: '#EBF8FF',
          borderColor: '#3182CE',
          textColor: '#2D3748',
          icon: '🔗',
          label: 'Cliente existente',
          location: showLocationTag && leaderLocation && leaderLocation !== 'Sin localidad' ? leaderLocation : undefined,
          leaderName: leaderName
        };
      case 'update':
        return {
          backgroundColor: '#FFFBEB',
          borderColor: '#D69E2E',
          textColor: '#2D3748',
          icon: '✏️',
          label: 'Cliente editado',
          location: showLocationTag && leaderLocation && leaderLocation !== 'Sin localidad' ? leaderLocation : undefined,
          leaderName: leaderName
        };
      case 'create':
        return {
          backgroundColor: '#F0FFF4',
          borderColor: '#38A169',
          textColor: '#2D3748',
          icon: '➕',
          label: 'Nuevo cliente'
        };
      case 'clear':
      default:
        return {
          backgroundColor: '#F7FAFC',
          borderColor: '#E2E8F0',
          textColor: '#718096',
          icon: '👤',
          label: 'Sin cliente'
        };
    }
  }, [getClientAction, leaderLocation, leaderName, showLocationTag]);

  // Lógica del aval
  const getAvalAction = useCallback(() => {
    if (!avalName.trim() && !avalPhone.trim()) {
      return 'clear';
    }
    
    if (isNewAval) {
      return 'create';
    }
    
    if (selectedPersonalDataId) {
      if (hasAvalDataChanges) {
        return 'update';
      }
      return 'connect';
    }
    
    return 'create';
  }, [avalName, avalPhone, isNewAval, selectedPersonalDataId, hasAvalDataChanges]);

  const getAvalActionConfig = useCallback(() => {
    const action = getAvalAction();
    
    switch (action) {
      case 'create':
        return { 
          backgroundColor: '#F0FDF4',
          borderColor: '#22C55E', 
          textColor: '#15803D',
          icon: '👤',
          label: 'Nuevo aval'
        };
      case 'update':
        return { 
          backgroundColor: '#FFFBEB',
          borderColor: '#F59E0B', 
          textColor: '#92400E',
          icon: '👤',
          label: 'Actualizar aval existente'
        };
      case 'connect':
        return { 
          backgroundColor: '#EFF6FF',
          borderColor: '#3B82F6', 
          textColor: '#1E40AF',
          icon: '👤',
          label: 'Aval seleccionado'
        };
      case 'clear':
      default:
        return { 
          backgroundColor: '#F8FAFC',
          borderColor: '#CBD5E1', 
          textColor: '#475569',
          icon: '👤',
          label: 'Sin aval'
        };
    }
  }, [getAvalAction]);

  // Handlers del cliente
  const handleClientNameChange = useCallback((value: string) => {
    setClientName(value);
    const currentAction = getClientAction();
    onClientChange(value, clientPhone, currentAction);
  }, [clientPhone, getClientAction, onClientChange]);

  const handleClientPhoneChange = useCallback((value: string) => {
    setClientPhone(value);
    const currentAction = getClientAction();
    onClientChange(clientName, value, currentAction);
  }, [clientName, getClientAction, onClientChange]);

  const handleClearClient = useCallback(() => {
    setClientName('');
    setClientPhone('');
    setInternalIsFromPreviousLoan(false);
    setClientOriginalData({ name: '', phone: '' });
    onClientChange('', '', 'clear');
  }, [onClientChange]);

  // Handlers del aval
  const handleAvalNameChange = useCallback((value: string) => {
    setAvalName(value);
    
    if (value.length >= 2) {
      searchPotentialCollaterals({ 
        variables: { 
          searchTerm: value
        } 
      });
    } else {
      setSearchResults([]);
    }
    
    let newIsNewAval: boolean;
    let newHasDataChanges: boolean;
    let currentAction: 'create' | 'update' | 'connect' | 'clear';
    
    if (!value.trim() && !avalPhone.trim()) {
      newIsNewAval = false;
      newHasDataChanges = false;
      currentAction = 'clear';
    } else if (selectedPersonalDataId) {
      const nameChanged = value !== avalOriginalData.name;
      const phoneChanged = avalPhone !== avalOriginalData.phone;
      newIsNewAval = false;
      newHasDataChanges = nameChanged || phoneChanged;
      
      if (newHasDataChanges) {
        currentAction = 'update';
      } else {
        currentAction = 'connect';
      }
    } else {
      newIsNewAval = true;
      newHasDataChanges = false;
      currentAction = 'create';
    }
    
    setIsNewAval(newIsNewAval);
    setHasAvalDataChanges(newHasDataChanges);
    
    onAvalChange(value, avalPhone, selectedPersonalDataId, currentAction);
  }, [searchPotentialCollaterals, avalPhone, onAvalChange, selectedPersonalDataId, avalOriginalData.name, avalOriginalData.phone]);

  const handleAvalPhoneChange = useCallback((value: string) => {
    setAvalPhone(value);
    
    let newIsNewAval: boolean;
    let newHasDataChanges: boolean;
    let currentAction: 'create' | 'update' | 'connect' | 'clear';
    
    if (!avalName.trim() && !value.trim()) {
      newIsNewAval = false;
      newHasDataChanges = false;
      currentAction = 'clear';
    } else if (selectedPersonalDataId) {
      const nameChanged = avalName !== avalOriginalData.name;
      const phoneChanged = value !== avalOriginalData.phone;
      newIsNewAval = false;
      newHasDataChanges = nameChanged || phoneChanged;
      
      if (newHasDataChanges) {
        currentAction = 'update';
      } else {
        currentAction = 'connect';
      }
    } else {
      newIsNewAval = true;
      newHasDataChanges = false;
      currentAction = 'create';
    }
    
    setIsNewAval(newIsNewAval);
    setHasAvalDataChanges(newHasDataChanges);
    
    onAvalChange(avalName, value, selectedPersonalDataId, currentAction);
  }, [avalName, onAvalChange, selectedPersonalDataId, avalOriginalData.name, avalOriginalData.phone]);

  const handleSelectAvalPerson = useCallback((person: PersonalData) => {
    const primaryPhone = person.phones?.[0]?.number || '';
    
    setAvalName(person.fullName);
    setAvalPhone(primaryPhone);
    setSelectedPersonalDataId(person.id);
    setIsDropdownOpen(false);
    
    setAvalOriginalData({
      name: person.fullName,
      phone: primaryPhone,
      id: person.id
    });
    
    setIsNewAval(false);
    setHasAvalDataChanges(false);
    
    onAvalChange(person.fullName, primaryPhone, person.id, 'connect');
  }, [onAvalChange]);

  const handleCreateNewAval = useCallback(() => {
    if (!avalName.trim()) return;

    setAvalOriginalData({
      name: '',
      phone: '',
      id: undefined
    });
    
    setSelectedPersonalDataId(undefined);
    setIsNewAval(true);
    setHasAvalDataChanges(false);
    
    onAvalChange(avalName, avalPhone, undefined, 'create');
    setIsDropdownOpen(false);
  }, [avalName, avalPhone, onAvalChange]);

  const handleClearAval = useCallback(() => {
    setAvalName('');
    setAvalPhone('');
    setSelectedPersonalDataId(undefined);
    setAvalOriginalData({ name: '', phone: '', id: undefined });
    setIsNewAval(false);
    setHasAvalDataChanges(false);
    setIsDropdownOpen(false);
    onAvalChange('', '', undefined, 'clear');
  }, [onAvalChange]);

  const handleAvalNameBlur = useCallback(() => {
    if (avalName.trim() && searchResults.length === 0 && !searchLoading) {
      setTimeout(() => {
        if (avalName.trim() && searchResults.length === 0) {
          handleCreateNewAval();
        }
      }, 1000);
    }
  }, [avalName, searchResults, searchLoading, handleCreateNewAval]);

  // Handlers para modal de edición
  const handleEditPerson = useCallback((person: PersonalData, type: 'client' | 'aval') => {
    setEditingPerson(person);
    setEditingType(type);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingPerson(null);
  }, []);

  const handleSaveEditedPerson = useCallback((updatedPerson: PersonalData) => {
    if (editingType === 'client') {
      // Actualizar datos del cliente
      setClientName(updatedPerson.fullName);
      setClientPhone(updatedPerson.phones?.[0]?.number || '');
      onClientChange(updatedPerson.fullName, updatedPerson.phones?.[0]?.number || '', 'update');
    } else {
      // Actualizar datos del aval
      setAvalName(updatedPerson.fullName);
      setAvalPhone(updatedPerson.phones?.[0]?.number || '');
      setSelectedPersonalDataId(updatedPerson.id);
      setAvalOriginalData({
        name: updatedPerson.fullName,
        phone: updatedPerson.phones?.[0]?.number || '',
        id: updatedPerson.id
      });
      onAvalChange(updatedPerson.fullName, updatedPerson.phones?.[0]?.number || '', updatedPerson.id, 'update');
    }
  }, [editingType, onClientChange, onAvalChange]);

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

  const clientActionConfig = getClientActionConfig();
  const avalActionConfig = getAvalActionConfig();

  if (readonly) {
    return (
      <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Cliente:</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span>{clientName || 'Sin nombre'}</span>
            <span>{clientPhone || 'Sin teléfono'}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Aval:</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span>{avalName || 'Sin aval'}</span>
            <span>{avalPhone || 'Sin teléfono'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      gap: '12px', 
      width: '100%',
      ...containerStyle 
    }}>
      {/* Sección Cliente */}
      <div style={{ 
        flex: 1, 
        minWidth: '350px'
      }}>
        <UnifiedInput
          name={clientName}
          phone={clientPhone}
          onNameChange={handleClientNameChange}
          onPhoneChange={handleClientPhoneChange}
          onClear={handleClearClient}
          actionConfig={clientActionConfig}
          namePlaceholder="Nombre del cliente..."
          phonePlaceholder="Teléfono..."
          isFocused={isClientFocused}
          onFocus={() => setIsClientFocused(true)}
          onBlur={() => setIsClientFocused(false)}
          selectedPerson={internalIsFromPreviousLoan ? {
            id: 'client-selected',
            fullName: clientName,
            phones: [{ id: 'client-phone', number: clientPhone }],
            addresses: []
          } : null}
          onEditPerson={(person) => handleEditPerson(person, 'client')}
          showEditButton={internalIsFromPreviousLoan}
          compact={true}
          readonly={readonly}
        />
      </div>

      {/* Sección Aval */}
      <div style={{ 
        flex: 1, 
        minWidth: '400px', 
        position: 'relative'
      }}>
        {/* Checkbox para buscar en todas las localidades */}
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          fontSize: '11px', 
          color: '#6B7280', 
          fontWeight: '500',
          position: 'absolute',
          top: '-30px',
          left: '0px',
          zIndex: 10
        }}>
          <input
            type="checkbox"
            checked={includeAllLocationState}
            onChange={(e) => setIncludeAllLocationState(e.target.checked)}
            style={{ margin: 0 }}
          />
          Buscar en todas las localidades
        </label>
        
        <div>
          <UnifiedInput
          name={avalName}
          phone={avalPhone}
          onNameChange={handleAvalNameChange}
          onPhoneChange={handleAvalPhoneChange}
          onClear={handleClearAval}
          actionConfig={avalActionConfig}
          namePlaceholder="Buscar o escribir nombre del aval..."
          phonePlaceholder={avalName ? `Tel. ${avalName.split(' ')[0]}...` : "Teléfono"}
          isFocused={isAvalNameInputFocused}
          onFocus={() => {
            setIsAvalNameInputFocused(true);
            setIsDropdownOpen(true);
          }}
          onBlur={() => {
            setIsAvalNameInputFocused(false);
            setTimeout(() => {
              handleAvalNameBlur();
              setIsDropdownOpen(false);
            }, 150);
          }}
          showDropdown={isDropdownOpen}
          searchResults={searchResults}
          searchLoading={searchLoading}
          onSelectPerson={(person) => {
            handleSelectAvalPerson(person);
            setIsDropdownOpen(false);
          }}
          onCreateNew={() => {
            handleCreateNewAval();
            setIsDropdownOpen(false);
          }}
          dropdownRef={dropdownRef}
          inputRef={avalNameInputRef}
          selectedPerson={selectedPersonalDataId ? {
            id: selectedPersonalDataId,
            fullName: avalName,
            phones: [{ id: 'aval-phone', number: avalPhone }],
            addresses: []
          } : null}
          onEditPerson={(person) => handleEditPerson(person, 'aval')}
          showEditButton={!!selectedPersonalDataId}
          compact={true}
          readonly={readonly}
        />
        </div>
      </div>

      {/* Modal de edición */}
      <EditPersonModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        person={editingPerson}
        onSave={handleSaveEditedPerson}
        title={editingType === 'client' ? 'Editar Cliente' : 'Editar Aval'}
      />
    </div>
  );
};

export default UnifiedClientAvalDropdown;