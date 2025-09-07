import React, { useState, useCallback, useEffect, useRef } from 'react';

interface ClientDropdownProps {
  loanId: string;
  currentClientName: string;
  currentClientPhone: string;
  isFromPreviousLoan?: boolean; // ✅ NUEVA: Indicar explícitamente si viene de préstamo anterior
  leaderLocation?: string; // ✅ NUEVA: Localidad del líder
  leaderName?: string; // ✅ NUEVA: Nombre del líder
  showLocationTag?: boolean; // ✅ NUEVA: Mostrar tag de localidad solo cuando se busca en todas las localidades
  onClientChange: (clientName: string, clientPhone: string, action: 'create' | 'update' | 'connect' | 'clear') => void;
  readonly?: boolean;
}

const ClientDropdown: React.FC<ClientDropdownProps> = ({
  loanId,
  currentClientName,
  currentClientPhone,
  isFromPreviousLoan: externalIsFromPreviousLoan = false, // ✅ NUEVA: Prop externa
  leaderLocation = '', // ✅ NUEVA: Localidad del líder
  leaderName = '', // ✅ NUEVA: Nombre del líder
  showLocationTag = false, // ✅ NUEVA: Mostrar tag de localidad
  onClientChange,
  readonly = false
}) => {
  const [clientName, setClientName] = useState(currentClientName);
  const [clientPhone, setClientPhone] = useState(currentClientPhone);
  const [internalIsFromPreviousLoan, setInternalIsFromPreviousLoan] = useState(externalIsFromPreviousLoan);
  const [originalData, setOriginalData] = useState({ name: '', phone: '' });
  const [isFocused, setIsFocused] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);

  // ✅ MEJORADO: Actualizar estado interno cuando cambian las props
  useEffect(() => {
    const propsName = currentClientName || '';
    const propsPhone = currentClientPhone || '';
    
    // Si las props externas indican que viene de préstamo anterior, usamos esa información
    if (externalIsFromPreviousLoan) {
      setInternalIsFromPreviousLoan(true);
      // Solo establecer datos originales si no los tenemos ya
      if (!originalData.name && !originalData.phone) {
        setOriginalData({ name: propsName, phone: propsPhone });
      }
    } else {
      // Si no viene de préstamo anterior, resetear el estado
      setInternalIsFromPreviousLoan(false);
      setOriginalData({ name: '', phone: '' });
    }
    
    // Actualizar campos solo si han cambiado
    if (propsName !== clientName || propsPhone !== clientPhone) {
      setClientName(propsName);
      setClientPhone(propsPhone);
    }
  }, [currentClientName, currentClientPhone, externalIsFromPreviousLoan, originalData.name, originalData.phone]);

  const getCurrentAction = useCallback(() => {
    if (!clientName.trim() && !clientPhone.trim()) {
      return 'clear';
    } else if (internalIsFromPreviousLoan) {
      // ✅ MEJORADO: Comparar con datos originales para detectar cambios
      const nameChanged = clientName !== originalData.name;
      const phoneChanged = clientPhone !== originalData.phone;
      return (nameChanged || phoneChanged) ? 'update' : 'connect';
    } else {
      return 'create';
    }
  }, [clientName, clientPhone, internalIsFromPreviousLoan, originalData]);

  const getActionConfig = useCallback(() => {
    const action = getCurrentAction();
    
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
  }, [getCurrentAction, leaderLocation, leaderName, showLocationTag]);

  const handleNameChange = useCallback((value: string) => {
    setClientName(value);
    
    // Notificar cambio
    const currentAction = getCurrentAction();
    onClientChange(value, clientPhone, currentAction);
  }, [clientPhone, getCurrentAction, onClientChange]);

  const handlePhoneChange = useCallback((value: string) => {
    setClientPhone(value);
    
    // Notificar cambio
    const currentAction = getCurrentAction();
    onClientChange(clientName, value, currentAction);
  }, [clientName, getCurrentAction, onClientChange]);

  const handleClearClient = useCallback(() => {
    setClientName('');
    setClientPhone('');
    setInternalIsFromPreviousLoan(false);
    setOriginalData({ name: '', phone: '' });
    onClientChange('', '', 'clear');
  }, [onClientChange]);

  const actionConfig = getActionConfig();

  if (readonly) {
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        <span>{clientName || 'Sin nombre'}</span>
        <span>{clientPhone || 'Sin teléfono'}</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      width: '100%',
      minWidth: (isNameFocused || isPhoneFocused) ? '350px' : '250px',
      maxWidth: (isNameFocused || isPhoneFocused) ? '450px' : '350px',
      alignItems: 'center',
      transition: 'all 0.3s ease',
      height: '32px',
      position: 'relative',
      overflow: 'visible'
    }}>
      {/* Contenedor principal con colores */}
      <div style={{
        display: 'flex',
        width: '100%',
        border: `2px solid ${actionConfig.borderColor}`,
        borderRadius: '6px',
        backgroundColor: actionConfig.backgroundColor,
        padding: '2px',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Indicador visual y etiqueta */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          fontSize: '12px',
          color: actionConfig.textColor,
          position: 'relative',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '4px',
          padding: '1px'
        }}>
          {showLocationTag && (actionConfig.location || leaderLocation) && (actionConfig.location !== 'Sin localidad' && leaderLocation !== 'Sin localidad') && (
            <div style={{
              fontSize: '7px',
              color: '#059669',
              backgroundColor: '#D1FAE5',
              padding: '1px 2px',
              borderRadius: '1px',
              fontWeight: '600'
            }}>
              📍 {actionConfig.location || leaderLocation}
            </div>
          )}
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: actionConfig.borderColor }}>
            {actionConfig.icon}
          </div>
        </div>

        {/* Campos de entrada */}
        <div style={{
          display: 'flex',
          gap: '6px',
          flex: 1,
          minWidth: '200px'
        }}>
          {/* Campo Nombre */}
          <input
            type="text"
            placeholder="Nombre del cliente..."
            value={clientName}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setIsNameFocused(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              setIsNameFocused(false);
            }}
            style={{
              flex: 2,
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              padding: '2px 4px',
              outline: 'none',
              color: actionConfig.textColor
            }}
          />

          {/* Campo Teléfono */}
          <input
            type="text"
            placeholder="Teléfono..."
            value={clientPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setIsPhoneFocused(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              setIsPhoneFocused(false);
            }}
            style={{
              flex: 1.2,
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              padding: '2px 4px',
              outline: 'none',
              color: actionConfig.textColor,
              minWidth: '80px'
            }}
          />
        </div>

        {/* Botón limpiar */}
        {(clientName || clientPhone) && (
          <button
            onClick={handleClearClient}
            style={{
              border: 'none',
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#DC2626',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '3px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              opacity: 1,
              minWidth: '24px',
              minHeight: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Limpiar cliente"
          >
            ×
          </button>
        )}

      </div>
    </div>
  );
};

export default ClientDropdown;
