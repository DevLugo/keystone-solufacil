import React, { useState, useCallback, useEffect, useRef } from 'react';

interface ClientDropdownProps {
  loanId: string;
  currentClientName: string;
  currentClientPhone: string;
  isFromPreviousLoan?: boolean; // ✅ NUEVA: Indicar explícitamente si viene de préstamo anterior
  onClientChange: (clientName: string, clientPhone: string, action: 'create' | 'update' | 'connect' | 'clear') => void;
  readonly?: boolean;
}

const ClientDropdown: React.FC<ClientDropdownProps> = ({
  loanId,
  currentClientName,
  currentClientPhone,
  isFromPreviousLoan: externalIsFromPreviousLoan = false, // ✅ NUEVA: Prop externa
  onClientChange,
  readonly = false
}) => {
  const [clientName, setClientName] = useState(currentClientName);
  const [clientPhone, setClientPhone] = useState(currentClientPhone);
  const [internalIsFromPreviousLoan, setInternalIsFromPreviousLoan] = useState(externalIsFromPreviousLoan);
  const [originalData, setOriginalData] = useState({ name: '', phone: '' });

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
          label: 'Cliente existente'
        };
      case 'update':
        return {
          backgroundColor: '#FFFBEB',
          borderColor: '#D69E2E',
          textColor: '#2D3748',
          icon: '✏️',
          label: 'Cliente editado'
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
  }, [getCurrentAction]);

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
      alignItems: 'center'
    }}>
      {/* Contenedor principal con colores */}
      <div style={{
        display: 'flex',
        width: '100%',
        border: `2px solid ${actionConfig.borderColor}`,
        borderRadius: '6px',
        backgroundColor: actionConfig.backgroundColor,
        padding: '4px',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}>
        {/* Indicador visual */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          fontSize: '12px',
          color: actionConfig.textColor
        }}>
          {actionConfig.icon}
        </div>

        {/* Campos de entrada */}
        <div style={{
          display: 'flex',
          gap: '4px',
          flex: 1
        }}>
          {/* Campo Nombre */}
          <input
            type="text"
            placeholder="Nombre del cliente..."
            value={clientName}
            onChange={(e) => handleNameChange(e.target.value)}
            style={{
              flex: 2,
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              padding: '4px 6px',
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
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              padding: '4px 6px',
              outline: 'none',
              color: actionConfig.textColor
            }}
          />
        </div>

        {/* Botón limpiar */}
        {(clientName || clientPhone) && (
          <button
            onClick={handleClearClient}
            style={{
              border: 'none',
              background: 'transparent',
              color: actionConfig.textColor,
              fontSize: '16px',
              cursor: 'pointer',
              padding: '2px 6px',
              opacity: 0.6
            }}
            title="Limpiar cliente"
          >
            ×
          </button>
        )}

        {/* Etiqueta de estado */}
        <div style={{
          position: 'absolute',
          top: '-8px',
          left: '8px',
          fontSize: '9px',
          fontWeight: '500',
          color: actionConfig.borderColor,
          backgroundColor: 'white',
          padding: '1px 4px',
          borderRadius: '2px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {actionConfig.label}
        </div>
      </div>
    </div>
  );
};

export default ClientDropdown;
