import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLazyQuery, gql } from '@apollo/client';
import EditPersonModal from './EditPersonModal';
import { SEARCH_POTENTIAL_COLLATERALS } from '../../graphql/queries/loans';
import styles from './ClientLoanUnifiedInput.module.css';

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
    rate: string;
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
    location?: string | null;
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

  // Modo de visualización: 'inline' (default) o 'modal' (para mostrar cards)
  displayMode?: 'inline' | 'modal';

  // Errores de validación
  nameError?: string;
  phoneError?: string;

  // Callback para notificar cuando se marca como "sin teléfono"
  onNoPhoneChange?: (hasNoPhone: boolean) => void;
  hideErrorMessages?: boolean;

  // Permitir buscar personas (PersonalData) que no son borrowers aún (solo mode='client')
  allowPersonSearch?: boolean;
}

type ClientState = 'new' | 'edited' | 'renewed' | 'newClient';

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
  phonePlaceholder = "Teléfono...",
  displayMode = 'inline',
  nameError,
  phoneError,
  onNoPhoneChange,
  hideErrorMessages = false,
  allowPersonSearch = false
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [clientState, setClientState] = useState<ClientState>('new');
  const [searchText, setSearchText] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<any[]>([]);
  const [hasNoPhone, setHasNoPhone] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
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
      } else if (mode === 'client' && allowPersonSearch) {
        // Lógica para búsqueda de personas en modo cliente (para nuevos créditos)
        let filteredResults = data.personalDatas || [];

        // Excluir personas que ya tienen préstamos activos (ya deberían aparecer en la búsqueda normal de préstamos)
        // Opcional: Si queremos mostrar todos, quitamos este filtro.
        // Por ahora mostramos todos los que coinciden, diferenciándolos visualmente.

        const personOptions = filteredResults.map((person: any) => {
          return {
            value: person.id,
            label: person.fullName, // Solo nombre, el teléfono se muestra en el subtexto si se quiere
            personData: person,
            isPerson: true, // Flag para identificar que es una persona y no un préstamo previo
            location: person.addresses?.[0]?.location?.name || 'Sin localidad',
            locationColor: '#10B981', // Verde para diferenciar
            phone: person.phones?.[0]?.number || ''
          };
        });

        // Combinar con las opciones de préstamos ya filtradas (si existen)
        // Nota: Esto se maneja en el useEffect de filtrado, aquí solo actualizamos las opciones de personas
        // Pero como searchPersons es async, necesitamos una forma de combinarlo.
        // Una estrategia es guardar estas opciones en un estado separado y combinarlas en el render o en otro efecto.
        // Por simplicidad, vamos a actualizar filteredOptions aquí, pero teniendo en cuenta que puede sobrescribir
        // los resultados de préstamos si no tenemos cuidado.
        // MEJOR ESTRATEGIA: Disparar esta búsqueda SOLO si no hay coincidencias de préstamos o SIEMPRE y combinar.

        // Vamos a combinar con los resultados actuales de préstamos filtrados
        setFilteredOptions(prevOptions => {
          const existingLoanOptions = prevOptions.filter(opt => !opt.isPerson);

          // Filtrar personas que ya están en las opciones de préstamos (por nombre/teléfono similar) para evitar duplicados visuales
          // Aunque técnicamente son entidades diferentes (Loan vs PersonalData), para el usuario es la misma persona.
          // Si ya sale como préstamo, mejor que lo seleccione como préstamo (renovación).
          const uniquePersonOptions = personOptions.filter((pOption: any) => {
            return !existingLoanOptions.some(lOption =>
              lOption.label.toLowerCase() === pOption.label.toLowerCase()
            );
          });

          return [...existingLoanOptions, ...uniquePersonOptions];
        });

        if (!justSelectedOptionRef.current) {
          // Mostrar dropdown si hay resultados (ya sea préstamos o personas)
          // Nota: filteredOptions se actualiza asíncronamente, así que verificamos la longitud combinada
          setShowDropdown(isInputFocused);
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
      // Check if user is typing a new client (no autocomplete match)
      // New client state: user has typed at least 2 characters AND no autocomplete results match
      const isTypingNewClient = searchText.trim().length >= 2 &&
        filteredOptions.length === 0 &&
        !isLoading &&
        !(mode === 'aval' && searchPersonsLoading) &&
        !(mode === 'aval' && selectedPersonId);

      if (isTypingNewClient) {
        setClientState('newClient');
      } else {
        setClientState('new');
      }
    } else {
      setClientState('new');
    }
  }, [previousLoan, currentName, currentPhone, searchText, filteredOptions.length, isLoading, mode, searchPersonsLoading, selectedPersonId]);

  // Filtrar opciones basado en el texto de búsqueda
  useEffect(() => {
    // No hacer nada si acabamos de seleccionar una opción
    if (justSelectedOptionRef.current) {
      return;
    }

    const trimmedSearch = searchText.trim();

    if (mode === 'client') {
      if (trimmedSearch) {
        const searchLower = trimmedSearch.toLowerCase();
        const filtered = previousLoanOptions.filter(option =>
          option.label.toLowerCase().includes(searchLower)
        );
        setFilteredOptions(filtered);
        setShowDropdown(true);

        // Si está habilitada la búsqueda de personas, disparar la query
        if (allowPersonSearch && trimmedSearch.length >= 3) {
          searchPersons({
            variables: {
              searchTerm: trimmedSearch
            }
          });
        }

      } else {
        setFilteredOptions([]);
        setShowDropdown(false);
      }
    } else if (mode === 'aval') {
      // Modo aval: buscar personas cuando el usuario escribe
      // No mostrar dropdown si ya hay una persona seleccionada
      if (searchText.trim().length >= 2 && isInputFocused && !selectedPersonId) {
        searchPersons({ variables: { searchTerm: searchText } });
      } else {
        // Cerrar dropdown si hay selección, no hay texto, o no está enfocado
        setFilteredOptions([]);
        setShowDropdown(false);
      }
    }
  }, [searchText, previousLoanOptions, mode, searchPersons, isLoading, isInputFocused, allowPersonSearch, selectedPersonId]);

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
      case 'newClient':
        // Blue design for new client creation (no autocomplete match)
        return {
          border: '1px solid #3B82F6',
          backgroundColor: '#EFF6FF',
          textColor: '#1E40AF',
          boxShadow: isInputFocused ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none'
        };
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
      if (option.isPerson) {
        // Selección de Persona (PersonalData) que no es préstamo
        // Usamos onPreviousLoanSelect para pasar la opción al padre, 
        // ya que el padre maneja tanto préstamos como personas en este campo ahora.
        onPreviousLoanSelect(option);
        
        setSearchText(option.label);
        // Actualizar input name
        if (inputRef.current) inputRef.current.value = option.label;

        const phone = option.phone || '';
        if (phoneInputRef.current) phoneInputRef.current.value = phone;

        // Eliminamos llamadas redundantes que causan race conditions
        // onPhoneChange(phone);
        // onClientDataChange({ ... });

        setClientState('newClient'); // Estado para cliente nuevo (sin préstamo previo)
      } else {
        // Selección de Préstamo existente (Renovación)
        // Verificar si la localidad del LEAD del préstamo anterior es diferente a la del líder seleccionado actualmente
        const previousLoanLeadLocationId = option.loanData?.lead?.personalData?.addresses?.[0]?.location?.id;
        const previousLoanLeadLocationName = option.loanData?.lead?.personalData?.addresses?.[0]?.location?.name || 'desconocida';
        const currentLeadLocationName = leaderLocation || 'desconocida';

        if (selectedLeadLocationId && previousLoanLeadLocationId && previousLoanLeadLocationId !== selectedLeadLocationId && onLocationMismatch) {
          onLocationMismatch(previousLoanLeadLocationName, currentLeadLocationName);
        }

        onPreviousLoanSelect(option);
        
        // Actualizar el texto de búsqueda con el nombre del cliente
        const clientName = option.loanData?.borrower?.personalData?.fullName || option.label || '';
        setSearchText(clientName);
        
        setClientState('renewed');
      }
      
      // Cerrar el dropdown inmediatamente
      setShowDropdown(false);
      setFilteredOptions([]);
      
      // Resetear el flag después de un pequeño delay
      setTimeout(() => {
        justSelectedOptionRef.current = false;
      }, 100);
    } else if (mode === 'aval') {
      // Modo aval: seleccionar persona
      const person = option.personData;
      const phone = person.phones?.[0]?.number || '';
      const phoneId = person.phones?.[0]?.id;

      // Get aval location from the person's addresses
      const avalLocationId = person.addresses?.[0]?.location?.id;
      const avalLocationName = person.addresses?.[0]?.location?.name || option.location || 'desconocida';
      const borrowerLocationName = leaderLocation || 'desconocida';

      // Verificar si la localidad del aval es diferente a la del borrower
      if (borrowerLocationId && avalLocationId && borrowerLocationId !== avalLocationId && onLocationMismatch) {
        onLocationMismatch(avalLocationName, borrowerLocationName);
      }

      // Cerrar el dropdown ANTES de actualizar el texto para evitar que se reabra
      setShowDropdown(false);
      setFilteredOptions([]);

      // Actualizar el estado local
      setSearchText(person.fullName);
      if (inputRef.current) inputRef.current.value = person.fullName;

      if (phoneInputRef.current) phoneInputRef.current.value = phone;

      // Eliminamos llamadas redundantes que causan race conditions
      // onNameChange(person.fullName);
      // onPhoneChange(phone);

      // Notificar al padre con los datos del aval (UNA SOLA LLAMADA)
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

      // Resetear el flag después de un pequeño delay
      setTimeout(() => {
        justSelectedOptionRef.current = false;
      }, 100);
    }

    setIsInputFocused(false);
    if (inputRef.current) inputRef.current.blur();
  };

  // Prevenir que el dropdown se cierre cuando se hace click dentro de él
  const handleDropdownMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const hasPreviousLoan = previousLoan && previousLoan.borrower?.personalData;

  // Sincronizar hasNoPhone con el estado del teléfono
  useEffect(() => {
    if (!currentPhone || currentPhone.trim() === '') {
      // Si el teléfono está vacío y no hay préstamo previo, mantener hasNoPhone
      if (!hasPreviousLoan || mode !== 'client') {
        // No resetear hasNoPhone automáticamente
      }
    } else {
      // Si hay teléfono, resetear el estado de "sin teléfono"
      setHasNoPhone(false);
      onNoPhoneChange?.(false);
    }
  }, [currentPhone, hasPreviousLoan, mode, onNoPhoneChange]);

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Solo cerrar el dropdown si el click fue fuera del componente y no es del mismo modo
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current && !inputRef.current.contains(event.target as Node)) {
        // Verificar que el elemento clickeado no sea de este mismo componente
        const target = event.target as HTMLElement;
        const clickedAutocomplete = target.closest('[data-autocomplete-id]');
        const isThisComponent = clickedAutocomplete?.getAttribute('data-autocomplete-id') === loanId;

        if (!isThisComponent) {
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
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}
      data-autocomplete-mode={mode}
      data-autocomplete-id={loanId}
    >
      {/* Input principal con autocomplete - DOS INPUTS SEPARADOS */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        position: 'relative',
        width: '100%'
      }}>
        {clientState === 'newClient' && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500',
            color: '#1E40AF',
            width: 'fit-content'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <span>Nuevo Cliente - Se creará un registro nuevo</span>
          </div>
        )}
        {/* PRIMER INPUT: Nombre (con autocomplete) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          position: 'relative',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div
              onClick={() => {
                // Hacer que todo el contenedor sea clickable - enfocar el input
                if (inputRef.current) {
                  inputRef.current.focus();
                }
              }}
              style={{
                flex: 1,
                position: 'relative',
                border: nameError ? '1px solid #DC2626' : stateColors.border,
                borderRadius: '8px',
                backgroundColor: nameError ? '#FEF2F2' : stateColors.backgroundColor,
                transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out',
                display: 'flex',
                alignItems: 'center',
                minWidth: '400px',
                height: '40px',
                padding: '0 14px',
                boxSizing: 'border-box',
                boxShadow: nameError ? '0 0 0 3px rgba(220, 38, 38, 0.1)' : (stateColors.boxShadow || 'none'),
                cursor: 'text'
              }}>
              {/* Nombre del cliente */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                height: '100%'
              }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchText}
                  onChange={(e) => handleNameChange(e.target.value)}
                  readOnly={hasPreviousLoan && mode === 'client'}
                  title={hasPreviousLoan ? "Use el icono de editar o la X para limpiar" : ""}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '13px',
                    padding: '0',
                    outline: 'none',
                    color: stateColors.textColor,
                    height: '100%',
                    flex: '1',
                    lineHeight: '20px',
                    boxSizing: 'border-box',
                    boxShadow: 'none',
                    transition: 'none',
                    cursor: hasPreviousLoan && mode === 'client' ? 'pointer' : 'text',
                    userSelect: hasPreviousLoan && mode === 'client' ? 'none' : 'auto',
                    pointerEvents: 'auto',
                    width: '100%',
                    minWidth: '0'
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
                    // Solo mostrar dropdown si hay resultados
                    if (searchText.length >= 2 && filteredOptions.length > 0) {
                      setShowDropdown(true);
                    }
                  }}
                  onBlur={(e) => {
                    // No cerrar el dropdown si el focus se movió al dropdown
                    if (dropdownRef.current && dropdownRef.current.contains(e.relatedTarget as Node)) {
                      return;
                    }

                    // Si acabamos de seleccionar una opción, no hacer nada en el blur
                    // para evitar sobrescribir la selección con onNameChange
                    if (justSelectedOptionRef.current) {
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

                {/* Teléfono al lado del nombre cuando hay selección */}
                {currentPhone && (hasPreviousLoan || (mode === 'aval' && selectedPersonId)) && (
                  <span style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    whiteSpace: 'nowrap',
                    paddingLeft: '8px',
                    borderLeft: '1px solid #E5E7EB',
                    marginLeft: '8px'
                  }}>
                    {currentPhone}
                  </span>
                )}
                {/* Badge de deuda pendiente cuando hay préstamo previo */}
                {hasPreviousLoan && previousLoan?.pendingAmount && parseFloat(previousLoan.pendingAmount) > 0 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#DC2626',
                    backgroundColor: '#FEE2E2',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    marginLeft: '8px'
                  }}>
                    Deuda: ${parseFloat(previousLoan.pendingAmount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}

                {/* Badge de sin deuda cuando hay préstamo previo sin deuda */}
                {hasPreviousLoan && previousLoan?.pendingAmount && parseFloat(previousLoan.pendingAmount) === 0 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#059669',
                    backgroundColor: '#D1FAE5',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    marginLeft: '8px'
                  }}>
                    Sin deuda
                  </span>
                )}

                {/* Texto "Sin teléfono" cuando no hay teléfono */}
                {!currentPhone && (hasPreviousLoan || (mode === 'aval' && selectedPersonId)) && (
                  <span style={{
                    fontSize: '11px',
                    color: '#9CA3AF',
                    fontStyle: 'italic',
                    whiteSpace: 'nowrap',
                    paddingLeft: '8px',
                    borderLeft: '1px solid #E5E7EB',
                    marginLeft: '8px'
                  }}>
                    Sin teléfono
                  </span>
                )}
              </div>

              {/* Indicador de dropdown */}
              {filteredOptions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  right: '14px',
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
          </div>

          {/* Mensaje de error para el nombre */}
          {!hideErrorMessages && nameError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '4px',
              padding: '6px 10px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#DC2626'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{nameError}</span>
            </div>
          )}

          {/* Dropdown de autocomplete - JUSTO DESPUÉS DEL INPUT DE NOMBRE */}
          {((showDropdown && searchText.trim().length >= 2) || isLoading || (mode === 'aval' && searchPersonsLoading)) && (
            <div
              ref={dropdownRef}
              onMouseDown={handleDropdownMouseDown}
              className={styles.dropdown}
            >
              {/* Loader - solo mostrar uno */}
              {((mode === 'client' && isLoading) || (mode === 'aval' && searchPersonsLoading)) && (
                <div className={styles.loadingState}>
                  <span className={styles.loadingSpinner} />
                  <span>Buscando...</span>
                </div>
              )}

              {/* Estado vacío - No se encontraron resultados */}
              {((mode === 'client' && !isLoading) || (mode === 'aval' && !searchPersonsLoading)) && filteredOptions.length === 0 && searchText.trim().length >= 2 && (
                <div className={styles.emptyState}>
                  No se encontraron resultados
                </div>
              )}

              {/* Opciones */}
              {((mode === 'client' && !isLoading) || (mode === 'aval' && !searchPersonsLoading)) && filteredOptions.length > 0 && (
                <>
                  {filteredOptions.map((option) => {
                    if (mode === 'client') {
                      // Verificar si es una persona (nuevo crédito) o un préstamo anterior (renovación)
                      if (option.isPerson) {
                        // Renderizar opción de Persona (Nuevo Crédito)
                        const personName = option.label || option.personData?.fullName || '';
                        const personPhone = option.phone || option.personData?.phones?.[0]?.number || '';
                        const location = option.location || 'Sin localidad';

                        return (
                          <div
                            key={option.value}
                            className={styles.dropdownItem}
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevenir que el input pierda focus
                              handleSelectOption(option, e);
                            }}
                            style={{
                              // borderLeft: '3px solid #10B981' // Removed green border as requested
                            }}
                          >
                            {/* Content left, badges right */}
                            <div className={styles.dropdownItemContent}>
                              <span className={styles.dropdownItemName}>{personName}</span>
                              {personPhone && (
                                <span className={styles.dropdownItemPhone}>{personPhone}</span>
                              )}
                            </div>
                            <div className={styles.dropdownItemBadges}>
                              <span className={`${styles.badge}`} style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                Sin crédito previo
                              </span>
                              {location && location !== 'Sin localidad' && (
                                <span className={`${styles.badge} ${styles.badgeLocation}`}>
                                  📍 {location}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Modo cliente: mostrar préstamos anteriores (Renovación)
                      const debtAmount = option.debtAmount || '0';
                      const location = option.location || null;
                      const debtColor = option.debtColor || '#6B7280';

                      // Determinar si es de otra localidad comparando la localidad del borrower con la del lead del préstamo
                      const borrowerLocationId = option.loanData?.borrower?.personalData?.addresses?.[0]?.location?.id;
                      const leadLocationId = option.loanData?.lead?.personalData?.addresses?.[0]?.location?.id;
                      const isDifferentLocation = borrowerLocationId && leadLocationId && borrowerLocationId !== leadLocationId;

                      // Color del badge de localidad: amarillo si es de otra localidad, azul si es de la misma
                      const locationColor = isDifferentLocation ? '#F59E0B' : '#3B82F6';

                      // Extract name and phone from label
                      const clientName = option.loanData?.borrower?.personalData?.fullName || '';
                      const clientPhone = option.loanData?.borrower?.personalData?.phones?.[0]?.number || '';

                      return (
                        <div
                          key={option.value}
                          className={styles.dropdownItem}
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevenir que el input pierda focus
                            handleSelectOption(option, e);
                          }}
                          style={{
                            borderLeft: isDifferentLocation ? '3px solid #F59E0B' : 'none'
                          }}
                        >
                          {/* Content left, badges right */}
                          <div className={styles.dropdownItemContent}>
                            <span className={styles.dropdownItemName}>{clientName}</span>
                            {clientPhone && (
                              <span className={styles.dropdownItemPhone}>{clientPhone}</span>
                            )}
                          </div>
                          <div className={styles.dropdownItemBadges}>
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
                            <span className={`${styles.badge} ${parseFloat(debtAmount) > 0 ? styles.badgeDebt : styles.badgeNoDebt}`}>
                              Deuda: ${debtAmount}
                            </span>
                            {((location && location !== 'Sin localidad') || option.municipality) && (
                              <span className={`${styles.badge} ${styles.badgeLocation}`}>
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

                      // Extract name and phone from personData
                      const personName = option.personData?.fullName || '';
                      const personPhone = option.personData?.phones?.[0]?.number || '';

                      return (
                        <div
                          key={option.value}
                          className={styles.dropdownItem}
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevenir que el input pierda focus
                            handleSelectOption(option, e);
                          }}
                          style={{
                            borderLeft: isDifferentLocation ? '3px solid #F59E0B' : 'none'
                          }}
                        >
                          {/* Content left, badges right */}
                          <div className={styles.dropdownItemContent}>
                            <span className={styles.dropdownItemName}>{personName}</span>
                            {personPhone && (
                              <span className={styles.dropdownItemPhone}>{personPhone}</span>
                            )}
                          </div>
                          <div className={styles.dropdownItemBadges}>
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
                              <span className={`${styles.badge} ${styles.badgeLocation}`}>
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
          )}
        </div>

        {/* Badge de Nuevo Cliente - ENTRE nombre y teléfono */}


        {/* SEGUNDO INPUT: Teléfono y badge de localidad */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          position: 'relative'
        }}>
          <div
            onClick={() => {
              // Hacer que todo el contenedor sea clickable - enfocar el input
              if (phoneInputRef.current && !(hasPreviousLoan && mode === 'client')) {
                phoneInputRef.current.focus();
              }
            }}
            style={{
              flex: 1,
              position: 'relative',
              border: phoneError && !hasNoPhone ? '1px solid #DC2626' : (hasNoPhone ? '1px solid #9CA3AF' : (clientState === 'newClient' ? stateColors.border : '1px solid #D1D5DB')),
              borderRadius: '8px',
              backgroundColor: phoneError && !hasNoPhone ? '#FEF2F2' : (hasNoPhone ? '#F3F4F6' : (clientState === 'newClient' ? stateColors.backgroundColor : '#FFFFFF')),
              transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out',
              display: 'flex',
              alignItems: 'center',
              minWidth: '400px',
              height: '40px',
              padding: '0 40px 0 14px',
              boxSizing: 'border-box',
              cursor: hasPreviousLoan && mode === 'client' ? 'default' : (hasNoPhone ? 'default' : 'text'),
              boxShadow: phoneError && !hasNoPhone ? '0 0 0 3px rgba(220, 38, 38, 0.1)' : 'none'
            }}>
            {hasNoPhone ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: '#6B7280',
                fontStyle: 'italic',
                width: '100%'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M19 12.55a10 10 0 1 1-2.44-2.44M19 12.55l-3.27-3.27" />
                  <path d="M22 2L2 22" />
                </svg>
                <span>Sin teléfono</span>
              </div>
            ) : (
              <>
                <input
                  ref={phoneInputRef}
                  type="text"
                  value={currentPhone}
                  readOnly={(hasPreviousLoan && mode === 'client') || hasNoPhone}
                  disabled={(hasPreviousLoan && mode === 'client') || hasNoPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (!hasPreviousLoan || mode !== 'client') {
                      onPhoneChange(e.target.value);
                      if (e.target.value.trim() !== '') {
                        setHasNoPhone(false);
                        onNoPhoneChange?.(false);
                      }
                    }
                  }}
                  placeholder={phonePlaceholder}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '13px',
                    padding: '0',
                    outline: 'none',
                    color: clientState === 'newClient' ? stateColors.textColor : '#6b7280',
                    height: '100%',
                    width: '100%',
                    lineHeight: '20px',
                    boxSizing: 'border-box',
                    cursor: hasPreviousLoan && mode === 'client' ? 'default' : (hasNoPhone ? 'default' : 'text'),
                    boxShadow: 'none',
                    transition: 'color 0.15s ease-in-out',
                    pointerEvents: 'auto'
                  }}
                />

                {/* Badge de localidad (solo en modo aval) - DENTRO del input de teléfono */}
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
                      flexShrink: 0,
                      marginLeft: '8px'
                    }}
                    title={borrowerLocationId && selectedPersonLocation.id === borrowerLocationId ? 'Misma localidad' : 'Otra localidad'}
                  >
                    {borrowerLocationId && selectedPersonLocation.id === borrowerLocationId ? '✓' : '⚠'} {selectedPersonLocation.name}
                  </span>
                )}
              </>
            )}

            {/* Botón "Sin teléfono" - Dentro del input, esquina derecha */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasNoPhone) {
                  // Si ya está marcado como sin teléfono, desmarcar y enfocar el input
                  setHasNoPhone(false);
                  onNoPhoneChange?.(false);
                  setTimeout(() => {
                    phoneInputRef.current?.focus();
                  }, 0);
                } else {
                  // Marcar como sin teléfono y limpiar el teléfono
                  setHasNoPhone(true);
                  onPhoneChange('');
                  onNoPhoneChange?.(true);
                }
              }}
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                padding: '0',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: hasNoPhone ? '#DC2626' : 'transparent',
                color: hasNoPhone ? '#FFFFFF' : '#6B7280',
                cursor: 'pointer',
                transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0,
                zIndex: 1
              }}
              onMouseEnter={(e) => {
                if (!hasNoPhone) {
                  e.currentTarget.style.backgroundColor = '#F3F4F6';
                  e.currentTarget.style.color = '#374151';
                } else {
                  e.currentTarget.style.backgroundColor = '#B91C1C';
                }
              }}
              onMouseLeave={(e) => {
                if (!hasNoPhone) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6B7280';
                } else {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                }
              }}
              title={hasNoPhone ? 'Hacer clic para agregar teléfono' : 'Marcar como sin teléfono'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mensaje de error para el teléfono */}
        {!hideErrorMessages && phoneError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '4px',
            padding: '6px 10px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#DC2626'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{phoneError}</span>
          </div>
        )}
      </div>

      {/* Botones de acción - Solo visibles cuando hay selección - FUERA del contenedor de inputs */}
      {(hasPreviousLoan || (mode === 'aval' && selectedPersonId)) && (
        <div className={styles.buttonGroup} style={{ marginTop: '-46px', marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {/* Botón de editar */}
          <button
            className={styles.editButton}
            onClick={handleEditClick}
            title="Editar cliente"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
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
          </button>

          {/* Botón de limpiar */}
          <button
            className={styles.clearButton}
            onClick={handleClear}
            title="Limpiar selección"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
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
          </button>
        </div>
      )}

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
