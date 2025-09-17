/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { jsx } from '@keystone-ui/core';

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

interface UnifiedInputProps {
  // Datos actuales
  name: string;
  phone: string;
  onNameChange: (name: string) => void;
  onPhoneChange: (phone: string) => void;
  onClear: () => void;
  
  // Configuración visual
  actionConfig: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    icon: string;
    label: string;
  };
  
  // Placeholders
  namePlaceholder: string;
  phonePlaceholder: string;
  
  // Estados
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  
  // Opciones del menú
  showClearOption?: boolean;
  
  // Para aval (opcional)
  showDropdown?: boolean;
  searchResults?: PersonalData[];
  searchLoading?: boolean;
  onSelectPerson?: (person: PersonalData) => void;
  onCreateNew?: () => void;
  dropdownRef?: React.RefObject<HTMLDivElement>;
  inputRef?: React.RefObject<HTMLInputElement>;
  
  // Para edición
  selectedPerson?: PersonalData | null;
  onEditPerson?: (person: PersonalData) => void;
  showEditButton?: boolean;
  
  // Configuración de tamaño
  compact?: boolean;
  readonly?: boolean;
}

const UnifiedInput: React.FC<UnifiedInputProps> = ({
  name,
  phone,
  onNameChange,
  onPhoneChange,
  onClear,
  actionConfig,
  namePlaceholder,
  phonePlaceholder,
  isFocused,
  onFocus,
  onBlur,
  showDropdown = false,
  searchResults = [],
  searchLoading = false,
  onSelectPerson,
  onCreateNew,
  dropdownRef,
  inputRef,
  selectedPerson = null,
  onEditPerson,
  showEditButton = false,
  compact = true,
  readonly = false,
  showClearOption = true
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Input principal */}
      <div 
        style={{
          display: 'flex',
          border: compact ? `1px solid ${actionConfig.borderColor}` : `2px solid ${actionConfig.borderColor}`,
          borderRadius: compact ? '4px' : '6px',
          backgroundColor: actionConfig.backgroundColor,
          padding: '0px',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'visible',
          height: '32px',
          alignItems: 'center',
          width: isExpanded ? '400px' : '320px',
          boxShadow: isExpanded ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
          zIndex: isExpanded ? 10 : 1
        }}
      >
      {/* Indicador visual */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '30px',
        fontSize: '12px',
        color: actionConfig.textColor,
        position: 'relative',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '4px',
        padding: '2px',
        flexShrink: 0
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: actionConfig.borderColor }}>
          {actionConfig.icon}
        </div>
      </div>

      {/* Campos de entrada */}
      <div style={{
        display: 'flex',
        gap: '4px',
        flex: 1,
        minWidth: '300px',
        alignItems: 'center'
      }}>
        {/* Campo Nombre */}
        <div style={{ 
          flex: 2, 
          position: 'relative',
          overflow: 'visible'
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={namePlaceholder}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={readonly || !!(selectedPerson && showEditButton)}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              padding: '4px 6px',
              outline: 'none',
              color: actionConfig.textColor,
              height: '30px',
              cursor: (selectedPerson && showEditButton) ? 'not-allowed' : 'text',
              lineHeight: '20px'
            }}
          />
          
          {/* Ícono de dropdown para aval */}
          {showDropdown && !selectedPerson && (
            <div style={{
              position: 'absolute',
              right: '8px',
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

        {/* Campo Teléfono */}
        <div style={{ flex: 1.2, position: 'relative' }}>
          <input
            type="text"
            placeholder={phonePlaceholder}
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={readonly || !!(selectedPerson && showEditButton)}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              padding: '4px 30px 4px 6px', // Padding derecho para el botón
              outline: 'none',
              color: actionConfig.textColor,
              minWidth: '120px',
              height: '30px',
              cursor: (selectedPerson && showEditButton) ? 'not-allowed' : 'text',
              lineHeight: '20px'
            }}
          />
          
          {/* Botón de expansión - Posición absoluta */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              border: '1px solid #E5E7EB',
              background: '#F9FAFB',
              color: '#374151',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '20px',
              width: '20px',
              borderRadius: '3px',
              transition: 'background-color 0.2s ease',
              zIndex: 1
            }}
            title={isExpanded ? 'Contraer' : 'Expandir'}
          >
            {isExpanded ? '◀' : '▶'}
          </button>
        </div>
      </div>
      </div>

      {/* Botón de menú de 3 puntos */}
      {((name || phone) && !readonly) || (selectedPerson && showEditButton && onEditPerson) ? (
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              border: 'none',
              background: 'rgba(107, 114, 128, 0.1)',
              color: '#6B7280',
              fontSize: compact ? '14px' : '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: compact ? '4px 8px' : '6px 10px',
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              opacity: 1,
              minWidth: compact ? '28px' : '32px',
              minHeight: compact ? '24px' : '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Opciones"
          >
            ⋯
          </button>

          {/* Menú dropdown */}
          {showMenu && (
            <div style={{
              position: 'fixed',
              top: menuRef.current ? menuRef.current.getBoundingClientRect().bottom + 4 : 0,
              right: menuRef.current ? window.innerWidth - menuRef.current.getBoundingClientRect().right : 0,
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              zIndex: 10000,
              minWidth: '120px'
            }}>
              {/* Opción Limpiar */}
              {(name || phone) && !readonly && showClearOption && (
                <button
                  onClick={() => {
                    onClear();
                    setShowMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: '#DC2626',
                    fontSize: '14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>🗑️</span>
                  Limpiar
                </button>
              )}

              {/* Opción Editar */}
              {selectedPerson && showEditButton && onEditPerson && (
                <button
                  onClick={() => {
                    onEditPerson(selectedPerson);
                    setShowMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: '#3B82F6',
                    fontSize: '14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>✏️</span>
                  Editar
                </button>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* Dropdown para aval */}
      {showDropdown && searchResults.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: inputRef?.current ? inputRef.current.getBoundingClientRect().top - 205 : 0,
            left: inputRef?.current ? inputRef.current.getBoundingClientRect().left : 0,
            width: inputRef?.current ? Math.max(inputRef.current.offsetWidth * 1.5, 300) : 'auto',
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
          {(name || phone) && (
            <div
              onClick={() => {
                onClear();
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                fontSize: '12px',
                backgroundColor: '#FEF2F2',
                color: '#DC2626'
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
                      onSelectPerson?.(person);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      fontSize: '12px'
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
          {name.trim().length >= 2 && (
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
                  onCreateNew?.();
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  backgroundColor: '#F0FDF4'
                }}
              >
                <div style={{ fontWeight: '500', color: '#166534' }}>
                  ➕ Crear: "{name}"
                </div>
                <div style={{ fontSize: '11px', color: '#22C55E', marginTop: '2px' }}>
                  Se creará un nuevo registro
                </div>
              </div>
            </React.Fragment>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedInput;
