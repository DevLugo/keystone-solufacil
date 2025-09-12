/** @jsxRuntime automatic */

import React, { useState } from 'react';
import { Button } from '@keystone-ui/button';
import { FaInfoCircle, FaEllipsisV } from 'react-icons/fa';
import DateMover from './utils/DateMover';

// Sistema de alturas consistente
const HEIGHT_SYSTEM = {
  small: '32px',    // Botones pequeños, inputs pequeños
  medium: '36px',   // Botones estándar, inputs estándar
  large: '40px',    // Botones grandes, inputs grandes
  xlarge: '44px'    // Botones principales, inputs principales
};

const PADDING_SYSTEM = {
  small: '6px 12px',
  medium: '8px 16px', 
  large: '10px 20px',
  xlarge: '12px 24px'
};

const FONT_SYSTEM = {
  small: '11px',
  medium: '12px',
  large: '13px',
  xlarge: '14px',
  table: '11px',      // Para textos de tabla
  tableHeader: '12px' // Para headers de tabla
};

interface KPIChip {
  label: string;
  value: string | number;
  color: string;
  backgroundColor: string;
  borderColor: string;
  showTooltip?: boolean;
  tooltipContent?: React.ReactNode;
}

interface KPIBarProps {
  chips: KPIChip[];
  buttons: {
    label: string;
    onClick: () => void;
    tone?: 'active' | 'passive' | 'positive' | 'negative';
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
  }[];
  // Opcional: acciones del botón principal (menú desplegable)
  primaryMenu?: {
    onSave: () => void;
    onReportFalco: () => void;
    onMove: () => void;
    saving?: boolean;
    disabled?: boolean;
  };
  dateMover?: {
    type: 'loans' | 'payments' | 'expenses';
    selectedDate: Date;
    selectedLead?: { id: string; personalData: { fullName: string } } | null;
    selectedRoute?: { id: string; name: string } | null;
    onSuccess?: () => void;
    itemCount: number;
    label: string;
  };
  massCommission?: {
    value: string;
    onChange: (value: string) => void;
    onApply: () => void;
    visible: boolean;
  };
}

export const KPIBar: React.FC<KPIBarProps> = ({
  chips,
  buttons,
  dateMover,
  massCommission,
  primaryMenu
}) => {
  const [showCommissionTooltip, setShowCommissionTooltip] = useState(false);
  const [openPrimary, setOpenPrimary] = useState(false);

  // Cerrar menú al hacer click fuera o ESC
  React.useEffect(() => {
    if (!openPrimary) return;
    const onClick = () => setOpenPrimary(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPrimary(false); };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openPrimary]);

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px 20px',
      margin: '0 24px 16px 24px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    }}>
      {/* Sección de KPIs - 60% del ancho */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '8px', 
        alignItems: 'center',
        flex: '0 0 60%',
        minWidth: 0
      }}>
        {chips.map((chip, index) => (
          <div key={index} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ 
              fontSize: 12, 
              color: chip.color, 
              background: chip.backgroundColor, 
              border: `1px solid ${chip.borderColor}`, 
              padding: '6px 12px', 
              borderRadius: 999, 
              fontWeight: '500' 
            }}>
              {chip.label}: {chip.value}
            </span>
            
            {chip.showTooltip && (
              <>
                <span
                  onMouseEnter={() => setShowCommissionTooltip(true)}
                  onMouseLeave={() => setShowCommissionTooltip(false)}
                  style={{ 
                    cursor: 'help', 
                    width: 16, 
                    height: 16, 
                    borderRadius: 8, 
                    background: chip.borderColor, 
                    color: chip.color, 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: 11 
                  }}
                >
                  <FaInfoCircle size={10} />
                </span>
                {showCommissionTooltip && chip.tooltipContent && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    zIndex: 20,
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    minWidth: '200px',
                    marginTop: '4px'
                  }}>
                    {chip.tooltipContent}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        
        {/* Comisión Masiva - Solo cuando está visible */}
        {massCommission?.visible && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: 11, 
            color: '#6B7280', 
            background: '#F8FAFC', 
            border: '1px solid #E2E8F0', 
            padding: '6px 10px', 
            borderRadius: 999,
            fontWeight: '500'
          }}>
            <span>Comisión:</span>
            <input
              type="number"
              value={massCommission.value}
              onChange={(e) => massCommission.onChange(e.target.value)}
              style={{
                width: '60px',
                height: HEIGHT_SYSTEM.small,
                padding: PADDING_SYSTEM.small,
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                fontSize: FONT_SYSTEM.small,
                textAlign: 'center'
              }}
              placeholder="0"
            />
            <Button
              tone="active"
              size="small"
              onClick={massCommission.onApply}
              style={{ 
                fontSize: FONT_SYSTEM.small, 
                padding: PADDING_SYSTEM.small, 
                height: HEIGHT_SYSTEM.small, 
                minWidth: 'auto',
                fontWeight: '500'
              }}
            >
              Aplicar
            </Button>
          </div>
        )}
      </div>

      {/* Sección de Botones - 40% del ancho */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        flex: '0 0 40%',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        position: 'relative'
      }}>
        {/* Botón principal destacado a la derecha */}
        {primaryMenu && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch' }}>
            {/* Grupo adjunto (flush/attached) al estilo Chakra's isAttached */}
            <div style={{
              display: 'inline-flex',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid #15803d'
            }}>
              {/* Botón principal: ejecuta guardar directamente */}
              <Button
                tone="positive"
                size="small"
                onClick={primaryMenu.onSave}
                disabled={primaryMenu.disabled}
                isLoading={primaryMenu.saving}
                style={{ 
                  fontSize: FONT_SYSTEM.small, 
                  padding: PADDING_SYSTEM.small, 
                  height: HEIGHT_SYSTEM.small, 
                  fontWeight: '700',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRight: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 0
                }}
              >
                Guardar cambios
              </Button>

              {/* Botón dividido (tres puntos) que abre opciones extra */}
              <Button
                tone="active"
                size="small"
                onClick={(e) => { e.stopPropagation(); setOpenPrimary(v => !v); }}
                disabled={primaryMenu.disabled}
                style={{ 
                  fontSize: FONT_SYSTEM.small, 
                  padding: '0 10px', 
                  height: HEIGHT_SYSTEM.small, 
                  fontWeight: '700',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: 0
                }}
                title="Más opciones"
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#15803d'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#16a34a'; }}
              >
                <FaEllipsisV size={12} />
              </Button>
            </div>
            {openPrimary && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                minWidth: 220,
                zIndex: 2000
              }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenPrimary(false); primaryMenu.onReportFalco(); }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >🚫 Reportar falco</button>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenPrimary(false); primaryMenu.onMove(); }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff7ed')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >📅 Mover</button>
              </div>
            )}
          </div>
        )}

        {/* Botones secundarios opcionales (si se quieren mantener) */}
        {(!primaryMenu ? buttons : []).map((button, index) => (
          <Button
            key={index}
            tone={button.tone || 'active'}
            size="small"
            onClick={button.onClick}
            disabled={button.disabled}
            isLoading={button.loading}
            style={{ 
              fontSize: FONT_SYSTEM.small, 
              padding: PADDING_SYSTEM.small, 
              height: HEIGHT_SYSTEM.small, 
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {button.icon}
            {button.label}
          </Button>
        ))}
        
        {/* DateMover - Solo si está configurado */}
        {dateMover && (
          <DateMover
            type={dateMover.type}
            selectedDate={dateMover.selectedDate}
            selectedLead={dateMover.selectedLead}
            selectedRoute={dateMover.selectedRoute}
            onSuccess={dateMover.onSuccess}
            itemCount={dateMover.itemCount}
            label={dateMover.label}
            compact={true}
          />
        )}
      </div>
    </div>
  );
};

export default KPIBar;
