/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState } from 'react';
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
}

export const BankIncomeModal = ({ 
  isOpen, 
  onClose, 
  bankIncomes, 
  totalTransactions, 
  totalAmount,
  loading = false
}: BankIncomeModalProps) => {
  const [copied, setCopied] = useState(false);

  const formatForCopy = () => {
    let text = `ENTRADAS AL BANCO - RESUMEN\n`;
    text += `Total: $${totalAmount.toFixed(2)} (${totalTransactions} transacciones)\n\n`;

    text += `Entradas al Banco\n`;
    bankIncomes.forEach(income => {
      const date = new Date(income.date).toLocaleDateString('es-MX');
      const employee = income.employeeName ? ` (${income.employeeName}` : '';
      const leaderLocality = income.leaderLocality ? ` - ${income.leaderLocality}` : '';
      const employeeInfo = income.employeeName ? `${employee}${leaderLocality})` : '';
      text += `-${income.name}${employeeInfo}, ${date}, $${income.amount.toFixed(2)}\n`;
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
              <Box css={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#374151',
                marginBottom: '12px',
                padding: '8px 12px',
                backgroundColor: '#f9fafb',
                borderRadius: '6px',
                borderLeft: '4px solid #3b82f6'
              }}>
                Entradas al Banco
              </Box>
              {bankIncomes.map((income) => {
                // Determinar el tipo de pago y colores
                const isClientPayment = income.isClientPayment || (income.type === 'INCOME' && income.incomeSource === 'BANK_LOAN_PAYMENT');
                const isLeaderPayment = income.isLeaderPayment || (income.type === 'TRANSFER' && income.destinationAccount?.type === 'BANK');
                
                const paymentTypeColor = isClientPayment ? '#10b981' : isLeaderPayment ? '#3b82f6' : '#6b7280';
                const paymentTypeIcon = isClientPayment ? '👤' : isLeaderPayment ? '👨‍💼' : '💰';
                const paymentTypeLabel = isClientPayment ? 'Pago de Cliente' : isLeaderPayment ? 'Pago de Líder' : 'Otro Ingreso';

                return (
                  <Box key={income.id} css={{
                    marginBottom: '6px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    border: `1px solid ${paymentTypeColor}`,
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    {/* Contenido compacto */}
                    <Box css={{ padding: '10px 12px' }}>
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
