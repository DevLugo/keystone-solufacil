/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { jsx } from '@keystone-ui/core';
import { useLazyQuery, useMutation } from '@apollo/client';
import { SEARCH_POTENTIAL_COLLATERALS } from '../../graphql/queries/loans';
import { CREATE_PERSONAL_DATA } from '../../graphql/mutations/loans';

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

interface AvalDropdownProps {
  loanId: string;
  currentAvalName: string;
  currentAvalPhone: string;
  borrowerLocationId?: string;
  onAvalChange: (avalName: string, avalPhone: string, personalDataId?: string, action?: 'create' | 'update' | 'connect' | 'clear') => void;
  includeAllLocations?: boolean;
  onlyNameField?: boolean;
  usedAvalIds?: string[]; // ✅ NUEVO: IDs de avales ya usados hoy
}

const AvalDropdown: React.FC<AvalDropdownProps> = ({
  loanId,
  currentAvalName,
  currentAvalPhone,
  borrowerLocationId,
  onAvalChange,
  includeAllLocations = false,
  onlyNameField = false,
  usedAvalIds = [] // ✅ NUEVO: IDs de avales ya usados
}) => {
  const [avalName, setAvalName] = useState(currentAvalName || '');
  const [avalPhone, setAvalPhone] = useState(currentAvalPhone || '');
  const [searchResults, setSearchResults] = useState<PersonalData[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedPersonalDataId, setSelectedPersonalDataId] = useState<string | undefined>(undefined);
  
  // ✅ NUEVO: Variables separadas para manejar el estado
  const [isNewAval, setIsNewAval] = useState(false); // ¿Es un aval completamente nuevo?
  const [hasDataChanges, setHasDataChanges] = useState(false); // ¿Se modificaron los datos?
  
  const [originalData, setOriginalData] = useState<{name: string, phone: string, id?: string}>({
    name: '',
    phone: '',
    id: undefined
  });
  const [isNameInputFocused, setIsNameInputFocused] = useState(false);
  const [includeAllLocationState, setIncludeAllLocationState] = useState(includeAllLocations);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ✅ NUEVO: Efecto que solo actúa en cambios EXTERNOS de props (no en nuestros propios onChange)
  useEffect(() => {
    // Solo actualizar si los props son diferentes a los valores internos actuales
    const propsName = currentAvalName || '';
    const propsPhone = currentAvalPhone || '';
    
    // Verificar si realmente cambió desde una fuente externa (no desde nuestros propios onChange)
    if (propsName !== avalName || propsPhone !== avalPhone) {
      console.log('🔄 Props REALMENTE cambiaron desde fuente externa:', {
        oldName: avalName,
        newName: propsName,
        oldPhone: avalPhone,
        newPhone: propsPhone
      });
      
      setAvalName(propsName);
      setAvalPhone(propsPhone);
      
      // Solo resetear estado si viene de una fuente externa
      if (propsName || propsPhone) {
        // Si hay datos precargados, es un aval existente (renovación)
        setIsNewAval(false);
        setHasDataChanges(false);
        // Actualizar originalData para que las comparaciones funcionen
        setOriginalData({
          name: propsName,
          phone: propsPhone,
          id: undefined
        });
        console.log('🔗 Aval precargado desde props externos, isNewAval=false, hasDataChanges=false');
      } else {
        // Sin datos = estado inicial limpio
        setIsNewAval(false);
        setHasDataChanges(false);
        setOriginalData({
          name: '',
          phone: '',
          id: undefined
        });
        console.log('⭕ Props externos limpiaron aval, reset a estado inicial');
      }
    } else {
      console.log('🚫 Props no cambiaron realmente (mismo valor interno), ignorando useEffect');
    }
  }, [currentAvalName, currentAvalPhone, avalName, avalPhone]);

  // GraphQL hooks
  const [searchPotentialCollaterals, { loading: searchLoading }] = useLazyQuery(
    SEARCH_POTENTIAL_COLLATERALS,
    {
      onCompleted: (data) => {
        let filteredResults = data.personalDatas || [];
        
        // Filtrar por localidad en el cliente si no incluye todas las localidades
        if (!includeAllLocationState && borrowerLocationId) {
          filteredResults = (data.personalDatas || []).filter((person: PersonalData) =>
            person.addresses?.some(address => 
              address.location?.id === borrowerLocationId
            )
          );
        }
        
        // ✅ NUEVO: Filtrar avales ya usados hoy (excepto el actual)
        if (usedAvalIds.length > 0) {
          const initialCount = filteredResults.length;
          filteredResults = filteredResults.filter((person: PersonalData) => {
            // Permitir el aval actual (si ya está seleccionado)
            if (selectedPersonalDataId && person.id === selectedPersonalDataId) {
              return true;
            }
            // Filtrar otros avales ya usados
            return !usedAvalIds.includes(person.id);
          });
          
          console.log(`🚫 Avales filtrados por uso previo: ${initialCount - filteredResults.length} de ${initialCount}`);
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

  // ✅ NUEVA función para determinar estado basado en variables separadas
  const getCurrentAction = (): 'create' | 'update' | 'connect' | 'clear' => {
    if (!avalName.trim() && !avalPhone.trim()) {
      return 'clear'; // Sin datos = sin aval
    }
    
    if (isNewAval) {
      return 'create'; // Es un aval nuevo (usuario escribió sin seleccionar)
    }
    
    if (selectedPersonalDataId) {
      if (hasDataChanges) {
        return 'update'; // Aval existente con modificaciones
      }
      return 'connect'; // Aval existente sin cambios
    }
    
    return 'create'; // Por defecto, crear nuevo
  };

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

  // Función para buscar avales (simplificada para select)
  const handleNameChange = useCallback(
    (value: string) => {
      setAvalName(value);
      
      // En un select con búsqueda, escribir siempre limpia la selección previa
      if (selectedPersonalDataId) {
        setSelectedPersonalDataId(undefined);
        console.log('🔄 Escribiendo en select, limpiando selección previa');
      }
      
      // Buscar coincidencias para mostrar en el dropdown
      if (value.length >= 2) {
        searchPotentialCollaterals({ 
          variables: { 
            searchTerm: value
          } 
        });
      } else {
        setSearchResults([]);
      }
      
      // ✅ NUEVO: Al escribir sin seleccionar, establecer variables de estado
      if (value.trim()) {
        setIsNewAval(true); // Usuario está creando un aval nuevo
        setHasDataChanges(false); // No hay cambios vs original porque es nuevo
      } else {
        setIsNewAval(false); // Campo vacío
        setHasDataChanges(false);
      }
      
      console.log('📝 handleNameChange (select mode):', {
        value,
        isNewAval: value.trim() ? true : false,
        willSearch: value.length >= 2
      });
      
      // Notificar cambio al componente padre (sin ID ya que no hay selección)
      const currentAction = value.trim() ? 'create' : 'clear';
      onAvalChange(value, avalPhone, undefined, currentAction);
    },
    [searchPotentialCollaterals, avalPhone, onAvalChange, selectedPersonalDataId]
  );

  // Función para seleccionar una persona del dropdown
  const handleSelectPerson = useCallback(
    (person: PersonalData) => {
      const primaryPhone = person.phones?.[0]?.number || '';
      
      setAvalName(person.fullName);
      setAvalPhone(primaryPhone);
      setSelectedPersonalDataId(person.id);
      setIsDropdownOpen(false);
      
      // Guardar datos originales para comparar cambios
      setOriginalData({
        name: person.fullName,
        phone: primaryPhone,
        id: person.id
      });
      
      // ✅ NUEVO: Al seleccionar del dropdown, es un aval existente sin cambios
      setIsNewAval(false); // No es nuevo, fue seleccionado del dropdown
      setHasDataChanges(false); // Sin cambios vs original (recién seleccionado)
      
      console.log('🔗 Aval seleccionado del dropdown:', {
        name: person.fullName,
        phone: primaryPhone,
        id: person.id,
        action: 'connect'
      });
      
      // Notificar al componente padre con el ID del PersonalData existente
      onAvalChange(person.fullName, primaryPhone, person.id, 'connect');
    },
    [onAvalChange]
  );

  // Función para marcar como crear nuevo aval
  const handleCreateNewAval = useCallback(
    () => {
      if (!avalName.trim()) return;

      // Limpiar datos originales ya que es nuevo
      setOriginalData({
        name: '',
        phone: '',
        id: undefined
      });
      
      setSelectedPersonalDataId(undefined);
      
      // ✅ NUEVO: Al crear nuevo, establecer variables de estado
      setIsNewAval(true); // Es un aval completamente nuevo
      setHasDataChanges(false); // No hay cambios vs original porque es nuevo
      
      console.log('➕ Crear nuevo aval:', {
        name: avalName,
        phone: avalPhone,
        action: 'create'
      });
      
      // Notificar al componente padre que se creará nuevo (sin ID)
      onAvalChange(avalName, avalPhone, undefined, 'create');
      setIsDropdownOpen(false);
    },
    [avalName, avalPhone, onAvalChange]
  );

  // ✅ NUEVA función para manejar cambio de teléfono con lógica de variables separadas
  const handlePhoneChange = useCallback(
    (value: string) => {
      setAvalPhone(value);
      
      // ✅ CALCULAR estado y acción con valores actuales (no esperar setState)
      let newIsNewAval: boolean;
      let newHasDataChanges: boolean;
      let currentAction: 'create' | 'update' | 'connect' | 'clear';
      
      if (!avalName.trim() && !value.trim()) {
        // Sin datos = estado limpio
        newIsNewAval = false;
        newHasDataChanges = false;
        currentAction = 'clear';
      } else if (selectedPersonalDataId) {
        // Hay un ID seleccionado = aval existente
        // Verificar si hay cambios vs datos originales
        const nameChanged = avalName !== originalData.name;
        const phoneChanged = value !== originalData.phone;
        newIsNewAval = false; // No es nuevo, ya existe
        newHasDataChanges = nameChanged || phoneChanged; // Hay cambios si algo cambió
        
        if (newHasDataChanges) {
          currentAction = 'update'; // Aval existente con modificaciones
        } else {
          currentAction = 'connect'; // Aval existente sin cambios
        }
      } else {
        // Sin ID pero con datos = aval nuevo (usuario escribiendo)
        newIsNewAval = true; // Es nuevo porque usuario escribió sin seleccionar
        newHasDataChanges = false; // No hay cambios vs original porque es nuevo
        currentAction = 'create';
      }
      
      // Actualizar variables de estado
      setIsNewAval(newIsNewAval);
      setHasDataChanges(newHasDataChanges);
      
      console.log('📞 handlePhoneChange:', {
        avalName,
        phoneValue: value,
        selectedPersonalDataId,
        originalName: originalData.name,
        originalPhone: originalData.phone,
        nameChanged: avalName !== originalData.name,
        phoneChanged: value !== originalData.phone,
        newIsNewAval,
        newHasDataChanges,
        calculatedAction: currentAction
      });
      
      // Notificar cambio al componente padre
      onAvalChange(avalName, value, selectedPersonalDataId, currentAction);
    },
    [avalName, onAvalChange, selectedPersonalDataId, originalData.name, originalData.phone]
  );

  // Función para limpiar el aval
  const handleClearAval = useCallback(
    () => {
      setAvalName('');
      setAvalPhone('');
      setSelectedPersonalDataId(undefined);
      setOriginalData({ name: '', phone: '', id: undefined });
      
      // ✅ NUEVO: Limpiar variables de estado
      setIsNewAval(false);
      setHasDataChanges(false);
      
      setIsDropdownOpen(false);
      
      onAvalChange('', '', undefined, 'clear');
    },
    [onAvalChange]
  );

  // ✅ NUEVA función que calcula el estado directamente sin depender de variables de estado
  const getActionConfig = () => {
    // Calcular el estado actual directamente
    let currentAction: 'create' | 'update' | 'connect' | 'clear';
    
    if (!avalName.trim() && !avalPhone.trim()) {
      currentAction = 'clear';
    } else if (isNewAval) {
      currentAction = 'create';
    } else if (selectedPersonalDataId) {
      if (hasDataChanges) {
        currentAction = 'update';
      } else {
        currentAction = 'connect';
      }
    } else {
      currentAction = 'create';
    }
    
    // Debug log para ver qué está pasando
    console.log('🎨 getActionConfig Debug:', {
      avalName,
      avalPhone,
      isNewAval,
      hasDataChanges,
      selectedPersonalDataId,
      originalData,
      calculatedAction: currentAction
    });
    
    switch (currentAction) {
      case 'create':
        return { 
          backgroundColor: '#F0FDF4',  // Verde muy claro
          borderColor: '#22C55E', 
          textColor: '#15803D',
          icon: '➕',
          text: 'Nuevo aval',
          description: 'Se creará un nuevo registro'
        };
      case 'update':
        return { 
          backgroundColor: '#FFFBEB',  // Amarillo muy claro
          borderColor: '#F59E0B', 
          textColor: '#92400E',
          icon: '✏️',
          text: 'Actualizar aval existente',
          description: 'Se modificará nombre y/o teléfono en el registro'
        };
      case 'connect':
        return { 
          backgroundColor: '#EFF6FF',  // Azul muy claro
          borderColor: '#3B82F6', 
          textColor: '#1E40AF',
          icon: '🔗',
          text: 'Aval seleccionado',
          description: 'Se usará el aval existente sin cambios'
        };
      case 'clear':
      default:
        return { 
          backgroundColor: '#F8FAFC',  // Azul grisáceo muy claro
          borderColor: '#CBD5E1', 
          textColor: '#475569',
          icon: '⭕',
          text: 'Sin aval',
          description: 'No se asignará aval'
        };
    }
  };

  // Función para manejar blur del campo nombre
  const handleNameBlur = useCallback(() => {
    // Si hay un nombre pero no se encontró en los resultados, mostrar opción de crear
    if (avalName.trim() && searchResults.length === 0 && !searchLoading) {
      // Auto-crear si no hay resultados después de 1 segundo
      setTimeout(() => {
        if (avalName.trim() && searchResults.length === 0) {
          handleCreateNewAval();
        }
      }, 1000);
    }
  }, [avalName, searchResults, searchLoading, handleCreateNewAval]);

  const actionConfig = useMemo(() => getActionConfig(), [avalName, avalPhone, isNewAval, hasDataChanges, selectedPersonalDataId]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Container simplificado para alinearse con otros inputs */}
      <div style={{
        backgroundColor: actionConfig.backgroundColor,
        border: `1px solid ${actionConfig.borderColor}`,
        borderRadius: '4px',
        padding: '6px',
        position: 'relative',
        minHeight: '40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        {/* Header compacto */}
        {(avalName || avalPhone) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '2px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '9px',
              fontWeight: '600',
              color: actionConfig.textColor
            }}>
              <span style={{ fontSize: '10px' }}>{actionConfig.icon}</span>
              <span>{actionConfig.text}</span>
            </div>
            
            <button
              onClick={handleClearAval}
              style={{
                padding: '2px 4px',
                background: '#EF4444',
                color: 'white',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '9px',
                fontWeight: '500',
                lineHeight: 1
              }}
              title="Limpiar aval"
            >
              ✕
            </button>
          </div>
        )}

          {/* Layout horizontal cuando incluye ambos campos */}
          {!onlyNameField ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Columna izquierda - Select con búsqueda */}
              <div style={{ 
                flex: isNameInputFocused ? 2 : 1, 
                position: 'relative',
                transition: 'flex 0.2s ease-in-out'
              }}>
                <div style={{
                  position: 'relative',
                  width: '100%'
                }}>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={avalName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => {
                      setIsNameInputFocused(true);
                      setIsDropdownOpen(true);
                    }}
                    onBlur={() => {
                      setIsNameInputFocused(false);
                      // Delay para permitir clicks en el dropdown
                      setTimeout(() => {
                        handleNameBlur();
                        setIsDropdownOpen(false);
                      }, 150);
                    }}
                    placeholder="Buscar o escribir nombre del aval..."
                    style={{
                      width: '100%',
                      padding: '8px 10px 8px 12px',
                      paddingRight: '28px', // Espacio para el ícono
                      border: `1px solid ${isNameInputFocused ? actionConfig.borderColor : '#D1D5DB'}`,
                      borderRadius: '4px',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      outline: 'none',
                      height: '32px',
                      transition: 'border-color 0.2s ease-in-out'
                    }}
                  />
                  
                  {/* Ícono de dropdown */}
                  <div style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: '#6B7280',
                    fontSize: '14px'
                  }}>
                    {isDropdownOpen ? '▲' : '▼'}
                  </div>
                </div>
                
                {/* Dropdown de opciones estilo select */}
                {isDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #D1D5DB',
                      borderRadius: '4px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 9999,
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}
                  >
                    {/* Opción para limpiar */}
                    {(avalName || avalPhone) && (
                      <div
                        onClick={() => {
                          handleClearAval();
                          setIsDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          fontSize: '12px',
                          backgroundColor: '#FEF2F2',
                          color: '#DC2626'
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
                      <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6B7280' }}>
                        🔍 Buscando...
                      </div>
                    ) : searchResults.length > 0 ? (
                      <React.Fragment>
                        <div style={{ 
                          padding: '6px 12px', 
                          fontSize: '10px', 
                          fontWeight: '600', 
                          color: '#6B7280', 
                          backgroundColor: '#F9FAFB',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          AVALES EXISTENTES
                        </div>
                        {searchResults.map((person) => {
                          const location = person.addresses?.[0]?.location?.name || 'Sin localidad';
                          const phone = person.phones?.[0]?.number || 'Sin teléfono';
                          
                          return (
                            <div
                              key={person.id}
                              onClick={() => {
                                handleSelectPerson(person);
                                setIsDropdownOpen(false);
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                fontSize: '12px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#EFF6FF';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ fontWeight: '500', color: '#1F2937' }}>
                                🔗 {person.fullName}
                              </div>
                              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                                📍 {location} • 📞 {phone}
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ) : null}
                    
                    {/* Opción para crear nuevo (siempre visible si hay texto) */}
                    {avalName.trim().length >= 2 && (
                      <React.Fragment>
                        <div style={{ 
                          padding: '6px 12px', 
                          fontSize: '10px', 
                          fontWeight: '600', 
                          color: '#6B7280', 
                          backgroundColor: '#F9FAFB',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          NUEVO AVAL
                        </div>
                        <div
                          onClick={() => {
                            handleCreateNewAval();
                            setIsDropdownOpen(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            backgroundColor: '#F0FDF4'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#DCFCE7';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#F0FDF4';
                          }}
                        >
                          <div style={{ fontWeight: '500', color: '#166534' }}>
                            ➕ Crear: "{avalName}"
                          </div>
                          <div style={{ fontSize: '11px', color: '#22C55E', marginTop: '2px' }}>
                            Se creará un nuevo registro
                          </div>
                        </div>
                      </React.Fragment>
                    )}
                    
                    {/* Mensaje cuando no hay resultados ni texto suficiente */}
                    {!searchLoading && searchResults.length === 0 && avalName.trim().length < 2 && (
                      <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6B7280' }}>
                        💭 Escribe para buscar o crear un aval
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Separador visual */}
              <div style={{
                width: '1px',
                height: '28px',
                backgroundColor: actionConfig.borderColor,
                opacity: 0.3
              }} />

              {/* Columna derecha - Teléfono */}
              <div style={{ 
                flex: isNameInputFocused ? 0.8 : 1,
                transition: 'flex 0.2s ease-in-out'
              }}>
                <input
                  type="tel"
                  value={avalPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder={avalName ? `Tel. ${avalName.split(' ')[0]}...` : "Teléfono"}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    outline: 'none',
                    height: '32px'
                  }}
                />
              </div>
            </div>
          ) : (
            /* Layout simple cuando solo es nombre */
            <div style={{ position: 'relative' }}>
              <input
                ref={nameInputRef}
                type="text"
                value={avalName}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => setIsNameInputFocused(true)}
                onBlur={() => {
                  setIsNameInputFocused(false);
                  handleNameBlur();
                }}
                placeholder="Nombre del aval"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  outline: 'none',
                  height: '28px',
                  transition: 'border-color 0.2s ease-in-out',
                  borderColor: isNameInputFocused ? actionConfig.borderColor : '#D1D5DB'
                }}
              />
          
              {/* Dropdown de resultados */}
              {isDropdownOpen && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #D1D5DB',
                    borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 9999,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  {searchLoading ? (
                    <div style={{ padding: '8px', textAlign: 'center', fontSize: '12px' }}>
                      Buscando...
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((person) => {
                      const location = person.addresses?.[0]?.location?.name || 'Sin localidad';
                      const phone = person.phones?.[0]?.number || 'Sin teléfono';
                      
                      return (
                        <div
                          key={person.id}
                          onClick={() => handleSelectPerson(person)}
                          style={{
                            padding: '8px 10px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0',
                            fontSize: '12px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f5f5f5';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ fontWeight: 'bold' }}>{person.fullName}</div>
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            {location} • {phone}
                          </div>
                        </div>
                      );
                    })
                  ) : avalName.trim().length >= 2 ? (
                    <div
                      onClick={handleCreateNewAval}
                      style={{
                        padding: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#0066cc',
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f8ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {`Crear nuevo aval: "${avalName}"`}
                    </div>
                  ) : (
                    <div style={{ padding: '8px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                      Escribe al menos 2 caracteres
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        {/* Checkbox para buscar en todas las localidades */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '9px', color: actionConfig.textColor }}>
              <input
                type="checkbox"
                checked={includeAllLocationState}
                onChange={(e) => setIncludeAllLocationState(e.target.checked)}
                style={{ marginRight: '4px', transform: 'scale(0.8)' }}
              />
              Buscar en todas las localidades
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvalDropdown;
