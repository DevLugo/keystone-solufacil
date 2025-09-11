/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState } from 'react';
import { Box, jsx } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { FaCalendarAlt, FaExchangeAlt, FaTimes, FaCheck } from 'react-icons/fa';
import { LoadingDots } from '@keystone-ui/loading';
import { MOVE_EXPENSES_TO_DATE, MOVE_LOANS_TO_DATE, MOVE_PAYMENTS_TO_DATE } from '../../../graphql/mutations/dateMovement';


interface DateMoverProps {
  type: 'loans' | 'payments' | 'expenses';
  selectedDate: Date;
  selectedLead?: { id: string; personalData: { fullName: string } } | null;
  selectedRoute?: { id: string; name: string } | null;
  onSuccess?: () => void;
  itemCount?: number;
  label?: string;
  compact?: boolean; // Nueva prop para modo compacto
}

export const DateMover: React.FC<DateMoverProps> = ({
  type,
  selectedDate,
  selectedLead,
  selectedRoute,
  onSuccess,
  itemCount = 0,
  label = 'registros',
  compact = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Seleccionar la mutación correcta según el tipo
  const mutation = type === 'loans' ? MOVE_LOANS_TO_DATE :
                   type === 'payments' ? MOVE_PAYMENTS_TO_DATE :
                   MOVE_EXPENSES_TO_DATE;

  const [moveToDate, { loading, error }] = useMutation(mutation, {
    onCompleted: (data) => {
      const result = data[`move${type.charAt(0).toUpperCase() + type.slice(1)}ToDate`];
      if (result?.success) {
        setShowConfirmation(true);
        setTimeout(() => {
          setIsModalOpen(false);
          setShowConfirmation(false);
          setTargetDate('');
          if (onSuccess) onSuccess();
        }, 2000);
      } else {
        alert(result?.message || 'Error al mover los registros');
      }
    },
    onError: (error) => {
      console.error('Error:', error);
      alert('Error al mover los registros');
    }
  });

  const handleMove = () => {
    if (!targetDate) {
      alert('Por favor selecciona una fecha destino');
      return;
    }

    if (type === 'expenses') {
      // Para gastos, usar leadId si existe, sino routeId
      moveToDate({
        variables: {
          leadId: selectedLead?.id || null,
          routeId: !selectedLead && selectedRoute ? selectedRoute.id : null,
          fromDate: selectedDate.toISOString(),
          toDate: new Date(targetDate + 'T12:00:00').toISOString()
        }
      });
    } else {
      // Para préstamos y pagos, requerir leadId
      if (!selectedLead) {
        alert('Por favor selecciona un líder');
        return;
      }

      moveToDate({
        variables: {
          leadId: selectedLead.id,
          fromDate: selectedDate.toISOString(),
          toDate: new Date(targetDate + 'T12:00:00').toISOString()
        }
      });
    }
  };

  const canMove = type === 'expenses' ? 
    (selectedRoute || selectedLead) && itemCount > 0 :
    selectedLead && itemCount > 0;
    
  // Para el modo compacto, siempre mostrar el botón, pero deshabilitado si no se puede mover
  const shouldShowButton = compact ? true : canMove;

  const typeLabel = type === 'loans' ? 'préstamos' :
                   type === 'payments' ? 'pagos' :
                   'gastos';

  // Renderizado compacto para la barra de KPIs
  if (compact) {
    return (
      <>
        <button
          onClick={() => canMove && setIsModalOpen(true)}
          disabled={!canMove}
          style={{
            height: '32px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '6px',
            backgroundColor: canMove ? '#F3F4F6' : '#F9FAFB',
            color: canMove ? '#374151' : '#9CA3AF',
            border: canMove ? '1px solid #E5E7EB' : '1px solid #F3F4F6',
            cursor: canMove ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            minWidth: '100px',
            outline: 'none',
            '&:hover': canMove ? {
              backgroundColor: '#E5E7EB'
            } : {},
            '&:focus': {
              boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.5)'
            }
          }}
          title={canMove ? `Mover ${itemCount} ${label} a otra fecha` : `No hay ${label} para mover`}
        >
          <FaCalendarAlt size={12} />
          <span>Mover ({itemCount})</span>
        </button>
        
        {/* Modal para modo compacto */}
        {isModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              width: '400px',
              maxWidth: '90%',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937'
              }}>
                Mover {itemCount} {label} a otra fecha
              </h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Fecha actual: {selectedDate.toLocaleDateString('es-MX')}
                </label>
                
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  Nueva fecha:
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <Button
                  tone="passive"
                  onClick={() => {
                    setIsModalOpen(false);
                    setTargetDate('');
                  }}
                  style={{ padding: '8px 16px' }}
                >
                  Cancelar
                </Button>
                <Button
                  tone="active"
                  onClick={handleMove}
                  disabled={loading || !targetDate}
                  style={{ padding: '8px 16px' }}
                >
                  {loading ? <LoadingDots size="small" /> : 'Mover'}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal de confirmación */}
        {showConfirmation && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            }}>
              <FaCheck size={48} style={{ color: '#10B981', marginBottom: '16px' }} />
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#1F2937'
              }}>
                ¡Movimiento exitoso!
              </h3>
              <p style={{
                margin: 0,
                color: '#6B7280',
                fontSize: '14px'
              }}>
                Se movieron {itemCount} {label} correctamente.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Renderizado original para tarjetas
  return (
    <>
      <div
        className="date-mover-card"
        style={{
          display: 'flex',
          flexDirection: 'column' as const,
          background: 'white',
          padding: '12px',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '8px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          border: canMove ? '1.5px solid #3B82F6' : '1px solid #E5E7EB',
          cursor: canMove ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          opacity: canMove ? 1 : 0.6
        }}
        onClick={() => canMove && setIsModalOpen(true)}
        title={canMove ? `Mover ${itemCount} ${label} a otra fecha` : `No hay ${label} para mover`}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: canMove ? '#3B82F6' : '#9CA3AF',
          opacity: canMove ? 1 : 0.5,
        }} />
        
        <div style={{
          fontSize: '12px',
          fontWeight: '500',
          color: '#6B7280',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>CAMBIAR FECHA</span>
          {canMove && (
            <span style={{
              fontSize: '10px',
              color: '#3B82F6',
              fontWeight: '600',
              backgroundColor: '#EFF6FF',
              padding: '2px 6px',
              borderRadius: '10px',
              border: '1px solid #DBEAFE'
            }}>
              CLICK
            </span>
          )}
        </div>
        
        <div style={{
          fontSize: '20px',
          fontWeight: '600',
          color: canMove ? '#1E293B' : '#9CA3AF',
          letterSpacing: '-0.02em',
          lineHeight: '1',
          marginBottom: '2px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <FaCalendarAlt size={16} style={{ color: canMove ? '#3B82F6' : '#9CA3AF' }} />
          {itemCount}
        </div>
        
        <div style={{
          fontSize: '12px',
          color: canMove ? '#3B82F6' : '#9CA3AF',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span>{canMove ? `${label} disponibles` : `No hay ${label}`}</span>
          {canMove && (
            <span style={{
              fontSize: '10px',
              color: '#059669',
              fontWeight: '600'
            }}>
              →
            </span>
          )}
        </div>

        {/* Indicador de interactividad */}
        {canMove && (
          <div 
            className="click-indicator"
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '8px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
            }}
          >
            +
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '28px',
            width: '480px',
            maxWidth: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            animation: 'slideUp 0.3s ease-out',
            border: '1px solid #F1F5F9'
          }}>
            {showConfirmation ? (
              // Vista de confirmación
              <div style={{
                textAlign: 'center',
                padding: '20px 0',
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: '#10B981',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  animation: 'bounceIn 0.5s ease-out',
                }}>
                  <FaCheck size={24} color="white" />
                </div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '8px',
                }}>
                  ¡Movimiento Exitoso!
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6B7280',
                }}>
                  Los {typeLabel} se han movido correctamente
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#EFF6FF',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #DBEAFE'
                    }}>
                      <FaExchangeAlt size={20} color="#2563EB" />
                    </div>
                    <div>
                      <h3 style={{
                        margin: '0 0 4px 0',
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#111827',
                        letterSpacing: '-0.025em'
                      }}>
                        Cambiar Fecha de {typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}
                      </h3>
                      <p style={{
                        margin: '0',
                        fontSize: '14px',
                        color: '#6B7280',
                        lineHeight: '1.4'
                      }}>
                        Mover {itemCount} {label} a una nueva fecha
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#6B7280',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
                  >
                    <FaTimes size={20} />
                  </button>
                </div>

                {/* Content */}
                <div style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '16px',
                  }}>
                    <div style={{ flex: 1 }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6B7280',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.025em',
                      }}>
                        Fecha Origen
                      </label>
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: 'white',
                        border: '1.5px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        borderLeft: '4px solid #3B82F6'
                      }}>
                        {selectedDate.toLocaleDateString('es-MX', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: '#9CA3AF',
                      marginTop: '20px',
                    }}>
                      <FaExchangeAlt size={16} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6B7280',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.025em',
                      }}>
                        Fecha Destino
                      </label>
                      <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #3B82F6',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          backgroundColor: '#EFF6FF',
                          color: '#1E40AF',
                          fontWeight: '500',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px 0 rgba(59, 130, 246, 0.1)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#2563EB';
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#3B82F6';
                          e.target.style.boxShadow = '0 1px 3px 0 rgba(59, 130, 246, 0.1)';
                        }}
                      />
                    </div>
                  </div>

                  {/* Info adicional */}
                  <div style={{
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    gap: '8px',
                  }}>
                    <span style={{ color: '#D97706' }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <p style={{
                        margin: 0,
                        fontSize: '13px',
                        color: '#92400E',
                        lineHeight: '1.5',
                      }}>
                        <strong>Atención:</strong> Esta acción moverá todos los {typeLabel} del{' '}
                        {selectedLead ? (
                          <>líder <strong>{selectedLead.personalData.fullName}</strong></>
                        ) : (
                          <>de la ruta</>
                        )}{' '}
                        de la fecha seleccionada. Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  justifyContent: 'flex-end',
                  marginTop: '8px'
                }}>
                  <Button
                    tone="passive"
                    onClick={() => setIsModalOpen(false)}
                    isDisabled={loading}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: '1.5px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    tone="active"
                    onClick={handleMove}
                    isDisabled={loading || !targetDate}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      backgroundColor: '#3B82F6',
                      border: '1.5px solid #3B82F6',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px 0 rgba(59, 130, 246, 0.1)'
                    }}
                  >
                    {loading ? (
                      <>
                        <LoadingDots label="" size="small" />
                        <span>Moviendo...</span>
                      </>
                    ) : (
                      <>
                        <FaExchangeAlt size={14} />
                        <span>Mover {typeLabel}</span>
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes bounceIn {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .date-mover-card:hover {
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.15) !important;
          border-color: #2563EB !important;
          transform: translateY(-2px) !important;
        }

        .date-mover-card:hover .click-indicator {
          transform: scale(1.1);
          background-color: #2563EB;
        }

        .click-indicator {
          transition: all 0.2s ease;
        }
      `}</style>
    </>
  );
};

export default DateMover;