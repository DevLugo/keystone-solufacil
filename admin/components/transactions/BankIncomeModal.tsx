/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect } from 'react';
import { jsx, Box } from '@keystone-ui/core';

interface BankIncomeData {
  id: string;
  name: string;
  date: string;
  amount: number;
  type: string;
  locality?: string;
  employeeName?: string;
  leaderLocality?: string;
  description?: string;
  isClientPayment?: boolean;
  isLeaderPayment?: boolean;
}

interface BankIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankIncomes: BankIncomeData[];
  totalTransactions: number;
  totalAmount: number;
  loading?: boolean;
  // NUEVAS PROPS PARA FILTROS:
  onlyAbonos?: boolean;
  onOnlyAbonosChange?: (value: boolean) => void;
  startDate?: string;
  onStartDateChange?: (value: string) => void;
  endDate?: string;
  onEndDateChange?: (value: string) => void;
  selectedRouteIds?: string[];
  onRouteIdsChange?: (value: string[]) => void;
  availableRoutes?: Array<{ id: string; name: string }>;
  onRefresh?: () => void;
  customStartDate?: string;
  customEndDate?: string;
  onResetFilters?: () => void;
}

export const BankIncomeModal = ({ 
  isOpen, 
  onClose, 
  bankIncomes, 
  totalTransactions, 
  totalAmount,
  loading = false,
  // NUEVAS PROPS:
  onlyAbonos = false,
  onOnlyAbonosChange,
  startDate = '',
  onStartDateChange,
  endDate = '',
  onEndDateChange,
  selectedRouteIds = [],
  onRouteIdsChange,
  availableRoutes = [],
  onRefresh,
  customStartDate = '',
  customEndDate = '',
  onResetFilters
}: BankIncomeModalProps) => {
  const [copied, setCopied] = useState(false);
  const [confirmedTransactions, setConfirmedTransactions] = useState<Set<string>>(new Set());

  // Función para manejar la confirmación de transacciones
  const handleConfirmTransaction = (transactionId: string, confirmed: boolean) => {
    setConfirmedTransactions(prev => {
      const newSet = new Set(prev);
      if (confirmed) {
        newSet.add(transactionId);
      } else {
        newSet.delete(transactionId);
      }
      return newSet;
    });
  };

  // Función para confirmar todas las transacciones
  const handleConfirmAll = (confirmed: boolean) => {
    if (confirmed) {
      const allIds = new Set(bankIncomes.map(income => income.id));
      setConfirmedTransactions(allIds);
    } else {
      setConfirmedTransactions(new Set());
    }
  };

  // Contar transacciones confirmadas
  const confirmedCount = confirmedTransactions.size;
  const allConfirmed = bankIncomes.length > 0 && confirmedCount === bankIncomes.length;

  // Limpiar confirmaciones cuando cambien los datos
  useEffect(() => {
    setConfirmedTransactions(new Set());
  }, [bankIncomes]);

  const formatForCopy = () => {
    let text = `ENTRADAS AL BANCO - RESUMEN\n`;
    text += `Total: $${totalAmount.toFixed(2)} (${totalTransactions} transacciones)\n`;
    text += `Confirmadas: ${confirmedCount}/${totalTransactions}\n\n`;

    text += `Entradas al Banco\n`;
    bankIncomes.forEach(income => {
      const date = new Date(income.date).toLocaleDateString('es-MX');
      const employee = income.employeeName ? ` (${income.employeeName}` : '';
      const leaderLocality = income.leaderLocality ? ` - ${income.leaderLocality}` : '';
      const employeeInfo = income.employeeName ? `${employee}${leaderLocality})` : '';
      const confirmed = confirmedTransactions.has(income.id) ? ' ✅' : '';
      text += `-${income.name}${employeeInfo}, ${date}, $${income.amount.toFixed(2)}${confirmed}\n`;
    });

    return text;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatForCopy());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  if (!isOpen) return null;

  console.log('🎯 Modal recibiendo datos:', { bankIncomes, totalTransactions, totalAmount });

  const groupedByLocality = bankIncomes.reduce((acc: Record<string, BankIncomeData[]>, income) => {
    const locality = income.locality || 'Sin localidad';
    if (!acc[locality]) {
      acc[locality] = [];
    }
    acc[locality].push(income);
    return acc;
  }, {});

  return (
    <Box css={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <Box css={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '800px',
        maxHeight: '80vh',
        width: '90%',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <Box css={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <Box css={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#1f2937'
          }}>
            💰 Entradas al Banco
          </Box>
          <Box css={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <Box css={{
              fontSize: '14px',
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
              padding: '6px 12px',
              borderRadius: '6px'
            }}>
              {totalTransactions} transacciones - ${totalAmount.toFixed(2)}
            </Box>
            <button
              onClick={handleCopy}
              css={{
                backgroundColor: copied ? '#10b981' : '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: copied ? '#059669' : '#2563eb'
                }
              }}
            >
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
            <button
              onClick={onClose}
              css={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: '#dc2626'
                }
              }}
            >
              ✕ Cerrar
            </button>
          </Box>
        </Box>

        {/* Controles de Filtro */}
        <Box css={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          {/* Checkbox para solo abonos */}
          <Box css={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <input
              type="checkbox"
              id="onlyAbonos"
              checked={onlyAbonos}
              onChange={(e) => onOnlyAbonosChange?.(e.target.checked)}
              css={{
                width: '16px',
                height: '16px',
                accentColor: '#22c55e'
              }}
            />
            <label 
              htmlFor="onlyAbonos"
              css={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                cursor: 'pointer'
              }}
            >
              Solo mostrar abonos (pagos de préstamos)
            </label>
          </Box>

          {/* Selectores de fecha y ruta */}
          <Box css={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: '12px',
            alignItems: 'end'
          }}>
            <Box>
              <label css={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                Fecha inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange?.(e.target.value)}
                css={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  '&:focus': {
                    outline: 'none',
                    borderColor: '#22c55e',
                    boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.1)'
                  }
                }}
              />
            </Box>

            <Box>
              <label css={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                Fecha fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange?.(e.target.value)}
                css={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  '&:focus': {
                    outline: 'none',
                    borderColor: '#22c55e',
                    boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.1)'
                  }
                }}
              />
            </Box>

            <Box>
              <label css={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                Rutas ({selectedRouteIds.length}/{availableRoutes.length})
              </label>
              <Box css={{
                maxHeight: '120px',
                overflowY: 'auto',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '8px',
                backgroundColor: 'white'
              }}>
                {/* Opción para seleccionar todas las rutas */}
                <Box css={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <input
                    type="checkbox"
                    id="select-all-routes"
                    checked={selectedRouteIds.length === availableRoutes.length && availableRoutes.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onRouteIdsChange?.(availableRoutes.map(route => route.id));
                      } else {
                        onRouteIdsChange?.([]);
                      }
                    }}
                    css={{
                      width: '14px',
                      height: '14px',
                      accentColor: '#22c55e'
                    }}
                  />
                  <label 
                    htmlFor="select-all-routes"
                    css={{
                      fontSize: '12px',
                      color: '#374151',
                      cursor: 'pointer',
                      flex: 1,
                      fontWeight: '600'
                    }}
                  >
                    📋 Seleccionar todas
                  </label>
                </Box>
                
                {availableRoutes.map((route) => (
                  <Box key={route.id} css={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    <input
                      type="checkbox"
                      id={`route-${route.id}`}
                      checked={selectedRouteIds.includes(route.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onRouteIdsChange?.([...selectedRouteIds, route.id]);
                        } else {
                          onRouteIdsChange?.(selectedRouteIds.filter(id => id !== route.id));
                        }
                      }}
                      css={{
                        width: '14px',
                        height: '14px',
                        accentColor: '#22c55e'
                      }}
                    />
                    <label 
                      htmlFor={`route-${route.id}`}
                      css={{
                        fontSize: '12px',
                        color: '#374151',
                        cursor: 'pointer',
                        flex: 1
                      }}
                    >
                      {route.name}
                    </label>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box css={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <button
                onClick={onRefresh}
                css={{
                  padding: '8px 16px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: '#16a34a'
                  }
                }}
              >
                🔄 Actualizar
              </button>
              
              {onResetFilters && (
                <button
                  onClick={onResetFilters}
                  css={{
                    padding: '6px 12px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: '#4b5563'
                    }
                  }}
                >
                  🔄 Reset
                </button>
              )}
            </Box>
          </Box>
        </Box>

        {/* Sumatoria de Filtros Aplicados */}
        <Box css={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: selectedRouteIds.length === 0 ? '#fef2f2' : '#f0f9ff',
          borderRadius: '12px',
          border: selectedRouteIds.length === 0 ? '2px solid #ef4444' : '2px solid #0ea5e9',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <Box css={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <Box css={{
              fontSize: '16px',
              fontWeight: '700',
              color: selectedRouteIds.length === 0 ? '#dc2626' : '#0c4a6e'
            }}>
              {selectedRouteIds.length === 0 ? '⚠️ Sin rutas seleccionadas' : '📊 Resumen de Filtros Aplicados'}
            </Box>
            <Box css={{
              fontSize: '13px',
              color: selectedRouteIds.length === 0 ? '#b91c1c' : '#0369a1'
            }}>
              {selectedRouteIds.length === 0 ? 
                'Selecciona al menos una ruta para ver los datos' :
                `${onlyAbonos ? 'Solo abonos' : 'Todos los tipos'} • 
                ${selectedRouteIds.length} ruta${selectedRouteIds.length !== 1 ? 's' : ''} • 
                ${customStartDate && customEndDate ? 
                  `${new Date(customStartDate).toLocaleDateString('es-MX')} - ${new Date(customEndDate).toLocaleDateString('es-MX')}` : 
                  'Semana actual'
                }`
              }
            </Box>
          </Box>
          
          {selectedRouteIds.length > 0 && (
            <>
              <Box css={{
                textAlign: 'right',
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderRadius: '8px',
                border: '1px solid rgba(14, 165, 233, 0.3)'
              }}>
                <Box css={{
                  fontSize: '11px',
                  color: '#0369a1',
                  marginBottom: '2px',
                  fontWeight: '500'
                }}>
                  Total de transacciones
                </Box>
                <Box css={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#0c4a6e'
                }}>
                  {totalTransactions}
                </Box>
              </Box>
              
              <Box css={{
                textAlign: 'right',
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderRadius: '8px',
                border: '1px solid rgba(14, 165, 233, 0.3)'
              }}>
                <Box css={{
                  fontSize: '11px',
                  color: '#0369a1',
                  marginBottom: '2px',
                  fontWeight: '500'
                }}>
                  Confirmadas
                </Box>
                <Box css={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: confirmedCount === totalTransactions && totalTransactions > 0 ? '#059669' : '#0c4a6e'
                }}>
                  {confirmedCount}/{totalTransactions}
                </Box>
              </Box>
              
              <Box css={{
                textAlign: 'right',
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                borderRadius: '8px',
                border: '1px solid rgba(14, 165, 233, 0.3)'
              }}>
                <Box css={{
                  fontSize: '11px',
                  color: '#0369a1',
                  marginBottom: '2px',
                  fontWeight: '500'
                }}>
                  Suma total
                </Box>
                <Box css={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#0c4a6e'
                }}>
                  ${totalAmount.toFixed(2)}
                </Box>
              </Box>
            </>
          )}
        </Box>

        {/* Content */}
        <Box css={{ maxHeight: '60vh', overflow: 'auto' }}>
          {loading ? (
            <Box css={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <Box css={{
                width: '40px',
                height: '40px',
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '16px'
              }} />
              <Box css={{
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Cargando entradas al banco...
              </Box>
            </Box>
          ) : (
            <Box css={{ marginBottom: '24px' }}>
              {/* Header con checkbox para confirmar todas */}
              <Box css={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                padding: '12px 16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <Box css={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#374151'
                }}>
                  💰 Entradas al Banco
                </Box>
                
                {bankIncomes.length > 0 && (
                  <Box css={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <input
                      type="checkbox"
                      id="confirm-all-transactions"
                      checked={allConfirmed}
                      onChange={(e) => handleConfirmAll(e.target.checked)}
                      css={{
                        width: '16px',
                        height: '16px',
                        accentColor: '#22c55e'
                      }}
                    />
                    <label 
                      htmlFor="confirm-all-transactions"
                      css={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        cursor: 'pointer'
                      }}
                    >
                      ✅ Confirmar todas
                    </label>
                  </Box>
                )}
              </Box>
              {bankIncomes.map((income) => {
                // Determinar el tipo de pago y colores
                const isClientPayment = income.isClientPayment || (income.type === 'INCOME' && income.incomeSource === 'BANK_LOAN_PAYMENT');
                const isLeaderPayment = income.isLeaderPayment || (income.type === 'TRANSFER' && income.destinationAccount?.type === 'BANK');
                
                const paymentTypeColor = isClientPayment ? '#10b981' : isLeaderPayment ? '#3b82f6' : '#6b7280';
                const paymentTypeIcon = isClientPayment ? '👤' : isLeaderPayment ? '👨‍💼' : '💰';
                const paymentTypeLabel = isClientPayment ? 'Pago de Cliente' : isLeaderPayment ? 'Pago de Líder' : 'Otro Ingreso';

                const isConfirmed = confirmedTransactions.has(income.id);

                return (
                  <Box key={income.id} css={{
                    marginBottom: '6px',
                    backgroundColor: isConfirmed ? '#f0fdf4' : 'white',
                    borderRadius: '6px',
                    border: `2px solid ${isConfirmed ? '#22c55e' : paymentTypeColor}`,
                    overflow: 'hidden',
                    boxShadow: isConfirmed ? '0 2px 4px rgba(34, 197, 94, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    position: 'relative'
                  }}>
                    {/* Checkbox de confirmación */}
                    <Box css={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      zIndex: 1
                    }}>
                      <input
                        type="checkbox"
                        id={`confirm-${income.id}`}
                        checked={isConfirmed}
                        onChange={(e) => handleConfirmTransaction(income.id, e.target.checked)}
                        css={{
                          width: '18px',
                          height: '18px',
                          accentColor: '#22c55e',
                          cursor: 'pointer'
                        }}
                      />
                    </Box>

                    {/* Contenido compacto */}
                    <Box css={{ padding: '10px 12px', paddingRight: '40px' }}>
                      <Box css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box css={{ flex: 1 }}>
                          {/* Header compacto con tipo y nombre */}
                          <Box css={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <Box css={{
                              fontSize: '10px',
                              fontWeight: '600',
                              color: paymentTypeColor,
                              backgroundColor: `${paymentTypeColor}15`,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Box css={{ fontSize: '8px' }}>{paymentTypeIcon}</Box>
                              {paymentTypeLabel === 'Pago de Cliente' ? 'Cliente' : paymentTypeLabel === 'Pago de Líder' ? 'Líder' : 'Otro'}
                            </Box>
                            {isConfirmed && (
                              <Box css={{
                                fontSize: '10px',
                                fontWeight: '600',
                                color: '#22c55e',
                                backgroundColor: '#dcfce7',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                ✅ Confirmado
                              </Box>
                            )}
                          </Box>
                          
                          {/* Nombre/localidad principal */}
                          {isClientPayment && <Box css={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#1f2937',
                            lineHeight: '1.3'
                          }}>
                            {income.name}
                          </Box>}
                          
                          {/* Localidad para pagos de cliente */}
                          {isClientPayment && income.leaderLocality && (
                            <Box css={{
                              fontSize: '10px',
                              color: '#6b7280',
                              marginTop: '2px'
                            }}>
                              📍 {income.leaderLocality}
                            </Box>
                          )}
                          
                          {/* Localidad para pagos de líder */}
                          {isLeaderPayment && income.leaderLocality && (
                            <Box css={{
                              fontSize: '10px',
                              color: '#6b7280',
                              marginTop: '2px'
                            }}>
                              📍 {income.leaderLocality}
                            </Box>
                          )}
                        </Box>
                        
                        {/* Información lateral compacta */}
                        <Box css={{ textAlign: 'right', marginLeft: '12px' }}>
                          <Box css={{
                            fontSize: '10px',
                            color: '#6b7280',
                            marginBottom: '2px'
                          }}>
                            {new Date(income.date).toLocaleDateString('es-MX')}
                          </Box>
                          <Box css={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: paymentTypeColor
                          }}>
                            ${income.amount.toFixed(2)}
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
      
      {/* CSS para animaciones */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
};
