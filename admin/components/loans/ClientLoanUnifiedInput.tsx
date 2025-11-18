import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLazyQuery, gql } from '@apollo/client';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import EditPersonModal from './EditPersonModal';
import { SEARCH_POTENTIAL_COLLATERALS } from '../../graphql/queries/loans';

interface Loan {
  id: string;
  requestedAmount?: string;
  amountGived?: string;
  signDate?: string;
  finishedDate?: string;
  pendingAmountStored?: string;
  pendingAmount?: string;
  loantype?: {
    id: string;
    name: string;
    rate: number;
    weekDuration: number;
    loanPaymentComission: string;
  };
  borrower: {
    id: string;
    personalData: {
      id: string;
      fullName: string;
      phones: Array<{
        id: string;
        number: string;
      }>;
      addresses?: Array<{
        id: string;
        location: {
          id: string;
          name: string;
        };
      }>;
    };
  };
  collaterals?: Array<{
    id: string;
    fullName: string;
    phones: Array<{
      id: string;
      number: string;
    }>;
  }>;
  lead?: {
    id: string;
    personalData: {
      fullName: string;
      addresses?: Array<{
        id: string;
        location: {
          id: string;
          name: string;
        };
      }>;
    };
  };
}

interface ClientLoanUnifiedInputProps {
  loanId: string;
  // Datos del préstamo/cliente actual
  currentName: string;
  currentPhone: string;
  previousLoanOption?: any;
  previousLoan?: Loan | any;
  clientPersonalDataId?: string;
  clientPhoneId?: string;
  
  // Callbacks
  onNameChange: (name: string) => void;
  onPhoneChange: (phone: string) => void;
  onPreviousLoanSelect: (option: any) => void;
  onPreviousLoanClear: () => void;
  onClientDataChange: (data: { clientName: string; clientPhone: string; action: 'create' | 'update' | 'connect' | 'clear'; selectedPersonId?: string; selectedPersonPhoneId?: string }) => void;
  onPersonUpdated?: (updatedPerson: any) => void;
  
  // Opciones de préstamos anteriores (solo si mode === 'client')
  previousLoanOptions?: Array<{
    value: string;
    label: string;
    loanData: Loan;
    hasDebt?: boolean;
    statusColor?: string;
    statusTextColor?: string;
    debtColor?: string;
    locationColor?: string;
    location?: string;
    debtAmount?: string;
    leaderName?: string;
  }>;
  
  // Modo de uso: 'client' para préstamos anteriores, 'aval' para buscar personas/avales
  mode?: 'client' | 'aval';
  
  // Para modo 'aval': IDs de personas ya usadas
  usedPersonIds?: string[];
  
  // Para modo 'aval': ID de localidad del borrower para comparar
  borrowerLocationId?: string;
  
  // Para modo 'aval': ID de la persona seleccionada
  selectedPersonId?: string;
  
  // Estado de carga para el autocomplete
  isLoading?: boolean;
  
  // Localidad del líder seleccionado (para comparar con la del cliente)
  selectedLeadLocationId?: string;
  
  // Callback para mostrar alert cuando la localidad es diferente
  onLocationMismatch?: (clientLocation: string, leadLocation: string) => void;
  
  // Configuración
  onInputChange?: (value: string) => void;
  onSearchTextChange?: (text: string) => void;
  isFocused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  leaderLocation?: string;
  leaderName?: string;
  showLocationTag?: boolean;
  
  // Placeholders
  namePlaceholder?: string;
  phonePlaceholder?: string;
}

type ClientState = 'new' | 'edited' | 'renewed';

const ClientLoanUnifiedInput: React.FC<ClientLoanUnifiedInputProps> = ({
  loanId,
  currentName,
  currentPhone,
  previousLoanOption,
  previousLoan,
  clientPersonalDataId,
  clientPhoneId,
  onNameChange,
  onPhoneChange,
  onPreviousLoanSelect,
  onPreviousLoanClear,
  onClientDataChange,
  onPersonUpdated,
  previousLoanOptions = [],
  mode = 'client',
  usedPersonIds = [],
  borrowerLocationId,
  selectedPersonId,
  isLoading = false,
  selectedLeadLocationId,
  onLocationMismatch,
  onInputChange,
  onSearchTextChange,
  isFocused = false,
  onFocus,
  onBlur,
  leaderLocation,
  leaderName,
  showLocationTag = false,
  namePlaceholder = "Buscar cliente o escribir nombre...",
  phonePlaceholder = "Teléfono..."
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [clientState, setClientState] = useState<ClientState>('new');
  const [searchText, setSearchText] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isTypingRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedNameRef = useRef<string>('');
  const shouldPreserveFocusRef = useRef(false);
  const justSelectedOptionRef = useRef(false);
  const [selectedPersonLocation, setSelectedPersonLocation] = useState<{ id: string; name: string } | null>(null);
  
  // Query para buscar personas (solo en modo 'aval')
  const [searchPersons, { loading: searchPersonsLoading }] = useLazyQuery(SEARCH_POTENTIAL_COLLATERALS, {
    onCompleted: (data) => {
      if (mode === 'aval') {
        let filteredResults = data.personalDatas || [];
        
        // Filtrar personas ya usadas
        if (usedPersonIds.length > 0) {
          filteredResults = filteredResults.filter((person: any) => {
            if (selectedPersonId && person.id === selectedPersonId) {
              return true;
            }
            return !usedPersonIds.includes(person.id);
          });
        }
        
        // Convertir a formato de opciones
        const options = filteredResults.map((person: any) => {
          // Priorizar localidad del líder del préstamo donde es aval
          // Si no hay, usar la localidad de la dirección de la persona
          let location = null;
          if (person.loansAsCollateral && person.loansAsCollateral.length > 0) {
            // Obtener localidad del líder del préstamo más reciente donde es aval
            location = person.loansAsCollateral[0]?.lead?.personalData?.addresses?.[0]?.location;
          }
          
          // Fallback: usar localidad de la dirección de la persona
          if (!location && person.addresses && person.addresses.length > 0) {
            location = person.addresses[0]?.location;
          }
          
          const isDifferentLocation = borrowerLocationId && location?.id && location.id !== borrowerLocationId;
          
          return {
            value: person.id,
            label: `${person.fullName} - ${person.phones?.[0]?.number || 'Sin teléfono'}`,
            personData: person,
            location: location?.name || 'Sin localidad',
            locationColor: isDifferentLocation ? '#F59E0B' : '#3B82F6',
            isDifferentLocation
          };
        });
        
        setFilteredOptions(options);
        // Solo mostrar dropdown si el input está enfocado y no acabamos de seleccionar una opción
        if (!justSelectedOptionRef.current) {
          setShowDropdown(isInputFocused && options.length > 0);
        }
      }
    },
    onError: (error) => {
      console.error('Error searching persons:', error);
    }
  });
  
  // Query para obtener información de la persona seleccionada (solo en modo 'aval')
  const GET_PERSON_INFO = gql`
    query GetPersonInfo($id: ID!) {
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
  
  const [getPersonInfo] = useLazyQuery(GET_PERSON_INFO, {
    onCompleted: (data) => {
      if (data.personalData?.addresses?.[0]?.location) {
        setSelectedPersonLocation({
          id: data.personalData.addresses[0].location.id,
          name: data.personalData.addresses[0].location.name
        });
      } else {
        setSelectedPersonLocation(null);
      }
    },
    onError: () => {
      setSelectedPersonLocation(null);
    }
  });
  
  // Obtener localidad de la persona cuando se selecciona (modo 'aval')
  useEffect(() => {
    if (mode === 'aval' && selectedPersonId) {
      getPersonInfo({ variables: { id: selectedPersonId } });
    } else {
      setSelectedPersonLocation(null);
    }
  }, [selectedPersonId, mode, getPersonInfo]);
  
  // Determinar el estado del cliente
  useEffect(() => {
    if (previousLoan && previousLoan.borrower?.personalData) {
      const originalName = previousLoan.borrower.personalData.fullName || '';
      const originalPhone = previousLoan.borrower.personalData.phones?.[0]?.number || '';
      
      const nameChanged = currentName.trim() !== originalName.trim();
      const phoneChanged = currentPhone.trim() !== originalPhone.trim();
      
      if (nameChanged || phoneChanged) {
        setClientState('edited');
      } else {
        setClientState('renewed');
      }
    } else if (currentName.trim() || currentPhone.trim()) {
      setClientState('new');
    } else {
      setClientState('new');
    }
  }, [previousLoan, currentName, currentPhone]);
  
  // Filtrar opciones basado en el texto de búsqueda
  useEffect(() => {
    // No hacer nada si acabamos de seleccionar una opción
    if (justSelectedOptionRef.current) {
      return;
    }
    
    if (mode === 'client') {
      // Modo cliente: filtrar préstamos anteriores
      if (searchText.trim().length >= 2) {
        // Mostrar dropdown si está cargando o si hay opciones
        const shouldShow = isLoading || previousLoanOptions.length > 0;
        setShowDropdown(shouldShow);
        
        // Filtrar opciones localmente mientras se busca
        const filtered = previousLoanOptions.filter(option => 
          option.label.toLowerCase().includes(searchText.toLowerCase())
        );
        setFilteredOptions(filtered);
      } else {
        setFilteredOptions([]);
        setShowDropdown(false);
      }
    } else if (mode === 'aval') {
      // Modo aval: buscar personas cuando el usuario escribe
      // Solo mostrar dropdown si el input está enfocado o si hay resultados
      if (searchText.trim().length >= 2 && (isInputFocused || filteredOptions.length > 0)) {
        setShowDropdown(true); // Mostrar dropdown mientras busca
        searchPersons({ variables: { searchTerm: searchText } });
      } else {
        // Si el input no está enfocado y no hay texto, cerrar el dropdown
        if (!isInputFocused && searchText.trim().length < 2) {
          setFilteredOptions([]);
          setShowDropdown(false);
        }
      }
    }
  }, [searchText, previousLoanOptions, mode, searchPersons, isLoading, isInputFocused, filteredOptions.length]);
  
  // Restaurar focus después de re-render si estaba enfocado antes
  useEffect(() => {
    if (shouldPreserveFocusRef.current && inputRef.current && document.activeElement !== inputRef.current) {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Restaurar posición del cursor al final
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      });
    }
  });

  // Sincronizar searchText con currentName cuando cambia desde fuera o cuando hay préstamo previo
  useEffect(() => {
    // No actualizar searchText si el usuario está escribiendo (input enfocado o escribiendo)
    // O si estamos preservando el focus (significa que el usuario estaba escribiendo)
    if (isInputFocused || isTypingRef.current || shouldPreserveFocusRef.current) {
      return;
    }
    
    // Si el currentName es el mismo que el último sincronizado, no hacer nada
    if (currentName === lastSyncedNameRef.current) {
      return;
    }
    
    // Si hay préstamo previo, usar el nombre del préstamo
    if (previousLoan && previousLoan.borrower?.personalData?.fullName) {
      const loanName = previousLoan.borrower.personalData.fullName;
      // Solo actualizar si es diferente para evitar loops
      if (searchText !== loanName) {
        setSearchText(loanName);
        lastSyncedNameRef.current = loanName;
      }
    } 
    // Si no hay préstamo previo y hay un currentName, sincronizar
    // pero solo si el searchText no coincide (para evitar loops cuando el usuario está escribiendo)
    else if (currentName && currentName.trim()) {
      // Solo actualizar si el searchText es diferente
      if (searchText !== currentName && searchText.trim() !== currentName.trim()) {
        setSearchText(currentName);
        lastSyncedNameRef.current = currentName;
      }
    }
    // Si no hay currentName y no hay préstamo previo, limpiar searchText solo si tiene valor
    else if (!currentName || !currentName.trim()) {
      if (searchText.trim()) {
        setSearchText('');
        lastSyncedNameRef.current = '';
      }
    }
  }, [currentName, isInputFocused, previousLoan, searchText]);
  
  // Colores según el estado
  const getStateColor = useCallback((state: ClientState) => {
    const hasData = currentName.trim() || currentPhone.trim();
    
    // Si está enfocado, usar estilo de focus (azul) similar a otros inputs
    if (isInputFocused && !hasData) {
      return {
        border: '1px solid #3B82F6',
        backgroundColor: '#FFFFFF',
        textColor: '#111827',
        boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
      };
    }
    
    switch (state) {
      case 'new':
        // Solo mostrar verde si hay datos, sino usar estilo neutral
        if (hasData) {
          return {
            border: '1px solid #10B981', // Verde para nuevo con datos
            backgroundColor: '#ECFDF5',
            textColor: '#065F46',
            boxShadow: isInputFocused ? '0 0 0 3px rgba(16, 185, 129, 0.1)' : 'none'
          };
        }
        // Estilo neutral cuando está vacío
        return {
          border: '1px solid #D1D5DB',
          backgroundColor: '#FFFFFF',
          textColor: '#374151',
          boxShadow: 'none'
        };
      case 'edited':
        return {
          border: '1px solid #F59E0B', // Amarillo para editado
          backgroundColor: '#FFFBEB',
          textColor: '#92400E',
          boxShadow: isInputFocused ? '0 0 0 3px rgba(245, 158, 11, 0.1)' : 'none'
        };
      case 'renewed':
        return {
          border: '1px solid #3B82F6', // Azul para renovado sin cambios
          backgroundColor: '#EFF6FF',
          textColor: '#1E40AF',
          boxShadow: isInputFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
        };
      default:
        return {
          border: '1px solid #D1D5DB',
          backgroundColor: '#FFFFFF',
          textColor: '#374151',
          boxShadow: 'none'
        };
    }
  }, [currentName, currentPhone, isInputFocused]);
  
  const stateColors = getStateColor(clientState);
  
  // Abrir modal de edición
  const handleEditClick = () => {
    // Si hay préstamo previo, usar esos datos
    if (previousLoan?.borrower?.personalData) {
      setEditingPerson({
        id: previousLoan.borrower.personalData.id,
        fullName: currentName || previousLoan.borrower.personalData.fullName,
        phones: currentPhone ? [{ id: clientPhoneId || '', number: currentPhone }] : previousLoan.borrower.personalData.phones || []
      });
      setIsEditModalOpen(true);
    } 
    // Si no hay préstamo previo pero hay datos de cliente, permitir editar
    else if (currentName.trim() || currentPhone.trim()) {
      setEditingPerson({
        id: clientPersonalDataId || 'temp-id',
        fullName: currentName,
        phones: currentPhone ? [{ id: clientPhoneId || 'temp-phone', number: currentPhone }] : []
      });
      setIsEditModalOpen(true);
    }
  };
  
  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setEditingPerson(null);
  };
  
  const handleEditModalSave = async (updatedPerson: any) => {
    onNameChange(updatedPerson.fullName);
    if (updatedPerson.phones?.[0]?.number) {
      onPhoneChange(updatedPerson.phones[0].number);
    }
    if (onPersonUpdated) {
      await onPersonUpdated(updatedPerson);
    }
    handleEditModalClose();
  };
  
  const handleClear = () => {
    setSearchText('');
    onNameChange('');
    onPhoneChange('');
    onPreviousLoanClear();
    setShowDropdown(false);
  };
  
  const handleNameChange = (value: string) => {
    
    
    // Si hay un préstamo previo seleccionado y el usuario está modificando el texto
    // (borrando o cambiando), limpiar toda la selección
    if (previousLoan && previousLoan.borrower?.personalData) {
      const originalName = previousLoan.borrower.personalData.fullName || '';
      // Si el valor es diferente al nombre original (incluso si es más corto), limpiar
      if (value !== originalName) {
        handleClear();
        // Continuar con el nuevo valor para permitir búsqueda
        setSearchText(value);
        lastSyncedNameRef.current = value;
        if (onSearchTextChange) {
          onSearchTextChange(value);
        }
        return;
      }
    }
    
    // Marcar que estamos escribiendo y que debemos preservar el focus
    isTypingRef.current = true;
    shouldPreserveFocusRef.current = true;
    
    // Actualizar searchText primero (estado local)
    setSearchText(value);
    
    // Actualizar lastSyncedNameRef para evitar que el useEffect interfiera
    lastSyncedNameRef.current = value;
    
    // Llamar a onSearchTextChange inmediatamente para disparar la búsqueda
    if (onSearchTextChange) {
      onSearchTextChange(value);
    }
    
    // NO llamar a onNameChange mientras el usuario está escribiendo
    // Solo actualizar el estado local para que el input responda inmediatamente
    // El padre se actualizará solo cuando el input pierda el focus
  };
  
  const handleSelectOption = (option: any, event?: React.MouseEvent) => {
    // Prevenir que el blur cierre el dropdown antes de procesar la selección
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Marcar que acabamos de seleccionar una opción para evitar que el useEffect reabra el dropdown
    justSelectedOptionRef.current = true;
    
    if (mode === 'client') {
      // Modo cliente: seleccionar préstamo anterior
      // Verificar si la localidad del BORROWER (cliente) del préstamo anterior es diferente a la del líder seleccionado
      // La localidad del cliente se obtiene del lead asociado al préstamo anterior
      const previousLoanLeadLocationId = option.loanData?.lead?.personalData?.addresses?.[0]?.location?.id;
      const previousLoanLeadLocationName = option.loanData?.lead?.personalData?.addresses?.[0]?.location?.name || 'desconocida';
      
      if (selectedLeadLocationId && previousLoanLeadLocationId && previousLoanLeadLocationId !== selectedLeadLocationId && onLocationMismatch) {
        // Llamar al callback con las localidades
        onLocationMismatch(previousLoanLeadLocationName, '');
      }
      
      onPreviousLoanSelect(option);
      
      // Cerrar el dropdown inmediatamente
      setShowDropdown(false);
      setFilteredOptions([]);
      
      // Actualizar el texto de búsqueda con el nombre del cliente
      const clientName = option.loanData.borrower.personalData.fullName;
      setSearchText(clientName);
      
      // Resetear el flag después de un pequeño delay para permitir que el useEffect se ejecute sin reabrir
      setTimeout(() => {
        justSelectedOptionRef.current = false;
      }, 100);
      
      // Los cambios de nombre y teléfono se manejarán automáticamente
      // cuando el padre actualice los props (currentName, currentPhone)
    } else if (mode === 'aval') {
      // Modo aval: seleccionar persona
      const person = option.personData;
      const phone = person.phones?.[0]?.number || '';
      const phoneId = person.phones?.[0]?.id;
      
      // Cerrar el dropdown ANTES de actualizar el texto para evitar que se reabra
      setShowDropdown(false);
      setFilteredOptions([]);
      
      // Actualizar el estado local
      setSearchText(person.fullName);
      onNameChange(person.fullName);
      onPhoneChange(phone);
      
      // Notificar al padre con los datos del aval
      onClientDataChange({
        clientName: person.fullName,
        clientPhone: phone,
        action: 'connect',
        selectedPersonId: person.id,
        selectedPersonPhoneId: phoneId
      });
      
      // Obtener localidad de la persona
      if (person.id) {
        getPersonInfo({ variables: { id: person.id } });
      }
      
      // Resetear el flag después de un pequeño delay para permitir que el useEffect se ejecute sin reabrir
      setTimeout(() => {
        justSelectedOptionRef.current = false;
      }, 100);
    }
  };
  
  // Prevenir que el dropdown se cierre cuando se hace click dentro de él
  const handleDropdownMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };
  
  const hasPreviousLoan = previousLoan && previousLoan.borrower?.personalData;
  
  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Solo cerrar el dropdown si el click fue fuera del componente y no es del mismo modo
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        // Verificar que el elemento clickeado no sea otro input del mismo tipo
        const target = event.target as HTMLElement;
        const isOtherInput = target.closest('[data-autocomplete-mode]') && 
                            target.closest('[data-autocomplete-mode]')?.getAttribute('data-autocomplete-mode') !== mode;
        
        if (!isOtherInput) {
          setShowDropdown(false);
          if (mode === 'aval') {
            setFilteredOptions([]);
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mode]);
  
  return (
    <div 
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', position: 'relative' }}
      data-autocomplete-mode={mode}
    >
      {/* Input principal con autocomplete */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        position: 'relative',
        height: '28px'
      }}>
        <div style={{
          flex: 1,
          position: 'relative',
          border: stateColors.border,
          borderRadius: '4px',
          backgroundColor: stateColors.backgroundColor,
          transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          minWidth: '400px',
          height: '28px',
          padding: '0 10px',
          boxSizing: 'border-box',
          boxShadow: stateColors.boxShadow || 'none'
        }}>
          {/* Input de nombre */}
          <div style={{ flex: 2, position: 'relative', minWidth: '150px', height: '24px', display: 'flex', alignItems: 'center' }}>
            <Input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => handleNameChange(e.target.value)}
              readOnly={hasPreviousLoan && mode === 'client'}
              title={hasPreviousLoan ? "Use el icono de editar o la X para limpiar" : ""}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                padding: '0',
                outline: 'none',
                color: stateColors.textColor,
                height: '24px',
                width: '100%',
                lineHeight: '18px',
                boxSizing: 'border-box',
                boxShadow: 'none',
                transition: 'none',
                cursor: hasPreviousLoan && mode === 'client' ? 'pointer' : 'text',
                userSelect: hasPreviousLoan && mode === 'client' ? 'none' : 'auto'
              }}
              onKeyDown={(e) => {
                // Si hay préstamo previo y el usuario intenta escribir, prevenir y limpiar
                if (hasPreviousLoan && mode === 'client' && !e.ctrlKey && !e.metaKey) {
                  // Permitir solo teclas de navegación y selección
                  const allowedKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'Enter', 'Escape'];
                  if (!allowedKeys.includes(e.key) && !e.shiftKey) {
                    e.preventDefault();
                    handleClear();
                    // Enfocar el input para que pueda escribir
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 0);
                  }
                }
              }}
              onFocus={() => {
                setIsInputFocused(true);
                isTypingRef.current = true; // Marcar como escribiendo al enfocar
                shouldPreserveFocusRef.current = true; // Marcar que debemos preservar el focus
                if (onFocus) onFocus();
                if (searchText.length >= 2) {
                  setShowDropdown(true);
                }
              }}
              onBlur={(e) => {
                // No cerrar el dropdown si el focus se movió al dropdown
                if (dropdownRef.current && dropdownRef.current.contains(e.relatedTarget as Node)) {
                  return;
                }
                
                setIsInputFocused(false);
                shouldPreserveFocusRef.current = false; // Ya no necesitamos preservar el focus
                isTypingRef.current = false;
                
                // Cerrar el dropdown después de un pequeño delay para permitir que el click se procese
                setTimeout(() => {
                  setShowDropdown(false);
                }, 200);
                
                // Sincronizar inmediatamente al perder focus con el padre
                if (searchText !== currentName) {
                  onNameChange(searchText);
                  lastSyncedNameRef.current = searchText;
                  
                  if (onInputChange) {
                    onInputChange(searchText);
                  }
                  
                  if (onSearchTextChange) {
                    onSearchTextChange(searchText);
                  }
                }
                
                if (onBlur) onBlur();
              }}
              placeholder={namePlaceholder}
            />
            
            {/* Badge de localidad (solo en modo aval) */}
            {mode === 'aval' && selectedPersonLocation && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '600',
                  backgroundColor: borrowerLocationId && selectedPersonLocation.id === borrowerLocationId ? '#D1FAE5' : '#FEF3C7',
                  color: borrowerLocationId && selectedPersonLocation.id === borrowerLocationId ? '#065F46' : '#92400E',
                  marginLeft: '4px',
                  flexShrink: 0
                }}
                title={borrowerLocationId && selectedPersonLocation.id === borrowerLocationId ? 'Misma localidad' : 'Otra localidad'}
              >
                {borrowerLocationId && selectedPersonLocation.id === borrowerLocationId ? '✓' : '⚠'} {selectedPersonLocation.name}
              </span>
            )}
            
            {/* Indicador de dropdown */}
            {filteredOptions.length > 0 && (
              <div style={{
                position: 'absolute',
                right: mode === 'aval' && selectedPersonLocation ? '80px' : '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#6B7280',
                fontSize: '12px'
              }}>
                ▼
              </div>
            )}
          </div>
          
          {/* Separador visual */}
          <div style={{
            width: '1px',
            height: '20px',
            backgroundColor: '#D1D5DB',
            opacity: 0.5,
            flexShrink: 0
          }} />
          
          {/* Input de teléfono - Editable si no hay préstamo previo seleccionado */}
          <div style={{ flex: 1, position: 'relative', minWidth: '130px', maxWidth: '180px', height: '24px', display: 'flex', alignItems: 'center' }}>
            <Input
              type="text"
              value={currentPhone}
              readOnly={hasPreviousLoan && mode === 'client'}
              disabled={hasPreviousLoan && mode === 'client'}
              onChange={(e) => {
                if (!hasPreviousLoan || mode !== 'client') {
                  onPhoneChange(e.target.value);
                }
              }}
              placeholder={phonePlaceholder}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                padding: '0',
                outline: 'none',
                color: stateColors.textColor,
                height: '24px',
                width: '100%',
                lineHeight: '18px',
                boxSizing: 'border-box',
                cursor: hasPreviousLoan && mode === 'client' ? 'default' : 'text',
                boxShadow: 'none',
                transition: 'none'
              }}
            />
          </div>
        </div>
        
        {/* Botón de editar y botón de limpiar */}
        {(currentName || currentPhone) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {/* Botón de editar */}
            {(hasPreviousLoan || (currentName.trim() || currentPhone.trim())) && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleEditClick}
                title="Editar cliente"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Button>
            )}
            
            {/* Botón de limpiar */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClear}
              title="Limpiar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
        )}
      </div>
      
      {/* Dropdown de autocomplete */}
      {(showDropdown || isLoading || (mode === 'aval' && searchPersonsLoading)) && (() => {
        // Calcular posición del dropdown (arriba o abajo)
        let dropdownTop = 0;
        let dropdownBottom: number | undefined = undefined;
        let maxHeight = '300px';
        
        if (inputRef?.current) {
          const inputRect = inputRef.current.getBoundingClientRect();
          const spaceBelow = window.innerHeight - inputRect.bottom;
          const spaceAbove = inputRect.top;
          const estimatedDropdownHeight = 300; // Altura estimada del dropdown
          
          // Si hay menos espacio abajo que arriba, mostrar hacia arriba
          if (spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow) {
            // Mostrar hacia arriba
            dropdownBottom = window.innerHeight - inputRect.top + 4;
            maxHeight = `${Math.min(spaceAbove - 20, 300)}px`;
          } else {
            // Mostrar hacia abajo
            dropdownTop = inputRect.bottom + 4;
            maxHeight = `${Math.min(spaceBelow - 20, 300)}px`;
          }
        }
        
        return (
          <div
            ref={dropdownRef}
            onMouseDown={handleDropdownMouseDown}
            style={{
              position: 'fixed',
              top: dropdownTop || undefined,
              bottom: dropdownBottom || undefined,
              left: inputRef?.current ? inputRef.current.getBoundingClientRect().left : 0,
              width: inputRef?.current ? Math.max(inputRef.current.offsetWidth, 400) : 'auto',
              backgroundColor: 'white',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999,
              maxHeight: maxHeight,
              overflowY: 'auto'
            }}
          >
          {/* Loader - solo mostrar uno */}
          {((mode === 'client' && isLoading) || (mode === 'aval' && searchPersonsLoading)) && (
            <div style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#6B7280',
              fontSize: '14px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #E5E7EB',
                borderTop: '2px solid #3B82F6',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite'
              }} />
              <span>Buscando...</span>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
          
          {/* Opciones */}
          {((mode === 'client' && !isLoading) || (mode === 'aval' && !searchPersonsLoading)) && filteredOptions.length > 0 && (
            <>
              {filteredOptions.map((option) => {
            if (mode === 'client') {
              // Modo cliente: mostrar préstamos anteriores
              const debtAmount = option.debtAmount || '0';
              const location = option.location || null;
              const debtColor = option.debtColor || '#6B7280';
              
              // Determinar si es de otra localidad comparando la localidad del borrower con la del lead del préstamo
              const borrowerLocationId = option.loanData?.borrower?.personalData?.addresses?.[0]?.location?.id;
              const leadLocationId = option.loanData?.lead?.personalData?.addresses?.[0]?.location?.id;
              const isDifferentLocation = borrowerLocationId && leadLocationId && borrowerLocationId !== leadLocationId;
              
              // Color del badge de localidad: amarillo si es de otra localidad, azul si es de la misma
              const locationColor = isDifferentLocation ? '#F59E0B' : '#3B82F6';
              
              return (
                <div
                  key={option.value}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevenir que el input pierda focus
                    handleSelectOption(option, e);
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '12px',
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    borderLeft: isDifferentLocation ? '3px solid #F59E0B' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget.style.backgroundColor = '#F3F4F6');
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget.style.backgroundColor = '#FFFFFF');
                  }}
                >
                  {/* Una sola línea: Nombre, Deuda, Localidad, Municipio */}
                  <div style={{ 
                    fontWeight: '500', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ flexShrink: 0 }}>{option.label}</span>
                    {isDifferentLocation && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: '600',
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                          flexShrink: 0
                        }}
                        title="Otra localidad"
                      >
                        ⚠
                      </span>
                    )}
                    <span
                      style={{
                        backgroundColor: debtColor,
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '600',
                        flexShrink: 0
                      }}
                    >
                      Deuda: ${debtAmount}
                    </span>
                    {((location && location !== 'Sin localidad') || option.municipality) && (
                      <span
                        style={{
                          backgroundColor: locationColor,
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '600',
                          flexShrink: 0
                        }}
                      >
                        📍 {location && location !== 'Sin localidad' ? location : ''}
                        {location && location !== 'Sin localidad' && option.municipality ? ', ' : ''}
                        {option.municipality ? option.municipality : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            } else {
              // Modo aval: mostrar personas
              const location = option.location || 'Sin localidad';
              const isDifferentLocation = option.isDifferentLocation || false;
              const locationColor = option.locationColor || '#3B82F6';
              
              return (
                <div
                  key={option.value}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevenir que el input pierda focus
                    handleSelectOption(option, e);
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '12px',
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    borderLeft: isDifferentLocation ? '3px solid #F59E0B' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget.style.backgroundColor = '#F3F4F6');
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget.style.backgroundColor = '#FFFFFF');
                  }}
                >
                  {/* Una sola línea: Nombre, Localidad */}
                  <div style={{ 
                    fontWeight: '500', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ flexShrink: 0 }}>{option.label}</span>
                    {isDifferentLocation && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: '600',
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                          flexShrink: 0
                        }}
                        title="Otra localidad"
                      >
                        ⚠
                      </span>
                    )}
                    {location && location !== 'Sin localidad' && (
                      <span
                        style={{
                          backgroundColor: locationColor,
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '600',
                          flexShrink: 0
                        }}
                      >
                        📍 {location}
                      </span>
                    )}
                  </div>
                </div>
              );
            }
              })}
            </>
          )}
          </div>
        );
      })()}
      
      {/* Modal de edición */}
      {isEditModalOpen && editingPerson && (
        <EditPersonModal
          isOpen={isEditModalOpen}
          onClose={handleEditModalClose}
          person={editingPerson}
          onSave={handleEditModalSave}
          title="Editar Cliente"
        />
      )}
    </div>
  );
};

export default ClientLoanUnifiedInput;
