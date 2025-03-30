/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Box, jsx, Stack } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput, Select } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { FaPlus, FaTrash, FaEdit, FaSearch, FaEllipsisV, FaCheck, FaTimes } from 'react-icons/fa';

// Import types
import type { Loan } from '../../types/loan';

interface CreditosTabProps {
  selectedDate: Date | null;
  selectedRoute: string | null;
  selectedLead: string | null;
}

interface DropdownPortalProps {
  children: ReactNode;
  isOpen: boolean;
}

const DropdownPortal = ({ children, isOpen }: DropdownPortalProps) => {
  if (!isOpen) return null;
  return createPortal(
    children,
    document.body
  );
};

export const CreditosTab = ({ selectedDate, selectedRoute, selectedLead }: CreditosTabProps) => {
  const [loans, setLoans] = useState<Loan[]>([
    {
      id: '1',
      requestedAmount: '1000',
      amountGived: '1000',
      amountToPay: '1100',
      pendingAmount: '0',
      signDate: selectedDate?.toISOString() || '',
      finishedDate: '',
      createdAt: '',
      updatedAt: '',
      comissionAmount: '50',
      avalName: 'John Doe',
      avalPhone: '1234567890',
      loantype: { id: '1', name: 'Personal', rate: 10, weekDuration: 4, __typename: 'LoanType' },
      lead: { id: '1', personalData: { fullName: 'Jane Doe', __typename: 'PersonalData' }, __typename: 'Lead' },
      borrower: {
        id: '1',
        personalData: {
          id: '1',
          fullName: 'Jane Doe',
          phones: [{ id: '1', number: '0987654321', __typename: 'Phone' }],
          __typename: 'PersonalData'
        },
        __typename: 'Borrower'
      },
      previousLoan: null,
      __typename: 'Loan'
    },
    // Agrega más préstamos simulados aquí
  ]);

  const [newLoan, setNewLoan] = useState<Partial<Loan>>({
    requestedAmount: '',
    amountGived: '',
    amountToPay: '',
    pendingAmount: '0',
    signDate: selectedDate?.toISOString() || '',
    finishedDate: '',
    createdAt: '',
    updatedAt: '',
    comissionAmount: '',
    avalName: '',
    avalPhone: '',
    loantype: { id: '1', name: 'Personal', rate: 10, weekDuration: 4, __typename: 'LoanType' },
    lead: { id: '1', personalData: { fullName: 'Jane Doe', __typename: 'PersonalData' }, __typename: 'Lead' },
    borrower: {
      id: '1',
      personalData: {
        id: '1',
        fullName: 'Jane Doe',
        phones: [{ number: '0987654321', __typename: 'Phone' }],
        __typename: 'PersonalData'
      },
      __typename: 'Borrower'
    },
    previousLoan: null,
    __typename: 'Loan'
  });

  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [newLoanId, setNewLoanId] = useState<string | null>(null);
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const getDropdownPosition = (buttonId: string) => {
    const button = buttonRefs.current[buttonId];
    if (!button) return { top: 0, left: 0 };

    const rect = button.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      left: rect.right - 160, // 160px es el ancho del dropdown
    };
  };

  // Efecto para resaltar el nuevo préstamo por 3 segundos
  useEffect(() => {
    if (newLoanId) {
      const timer = setTimeout(() => {
        setNewLoanId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newLoanId]);

  // Cerrar el menú cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddLoan = () => {
    setIsAddingNew(true);
    setNewLoan({
      requestedAmount: '',
      amountGived: '',
      amountToPay: '',
      pendingAmount: '0',
      signDate: selectedDate?.toISOString() || '',
      finishedDate: '',
      createdAt: '',
      updatedAt: '',
      comissionAmount: '',
      avalName: '',
      avalPhone: '',
      loantype: { id: '1', name: 'Personal', rate: '10', weekDuration: '4', __typename: 'LoanType' },
      lead: { id: '1', personalData: { fullName: 'Jane Doe', __typename: 'PersonalData' }, __typename: 'Lead' },
      borrower: {
        id: '1',
        personalData: {
          id: '1',
          fullName: 'Jane Doe',
          phones: [{ number: '0987654321', __typename: 'Phone' }],
          __typename: 'PersonalData'
        },
        __typename: 'Borrower'
      },
      previousLoan: undefined,
      __typename: 'Loan'
    });
  };

  const handleSaveNewLoan = () => {
    const newId = String(loans.length + 1);
    setLoans([...loans, { ...newLoan, id: newId } as Loan]);
    setNewLoanId(newId);
    setIsAddingNew(false);
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
  };

  const handleEditLoan = (loan: Loan) => {
    setEditingLoan(loan);
  };

  const handleUpdateLoan = () => {
    if (editingLoan) {
      setLoans(loans.map(loan => loan.id === editingLoan.id ? editingLoan : loan));
      setEditingLoan(null);
    }
  };

  const handleDeleteLoan = (id: string) => {
    setLoans(loans.filter(loan => loan.id !== id));
  };

  // Calcular totales
  const totals = loans.reduce((acc, loan) => ({
    count: acc.count + 1,
    amountGived: acc.amountGived + parseFloat(loan.amountGived || '0'),
    amountToPay: acc.amountToPay + parseFloat(loan.amountToPay || '0'),
    newLoans: acc.newLoans + (loan.previousLoan ? 0 : 1),
    renewals: acc.renewals + (loan.previousLoan ? 1 : 0),
  }), { count: 0, amountGived: 0, amountToPay: 0, newLoans: 0, renewals: 0 });

  return (
    <>
      <Box paddingTop="xlarge">
        <div style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'flex-start',
          marginBottom: '24px',
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}>
          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '1px',
            background: '#E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            flex: 1,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column' as const,
              background: 'white',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: '#0052CC',
                opacity: 0.1,
              }} />
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '8px',
              }}>
                TOTAL DE CRÉDITOS
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '4px',
              }}>
                {totals.count}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>Activos</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column' as const,
              background: 'white',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: '#0052CC',
                opacity: 0.1,
              }} />
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '8px',
              }}>
                CRÉDITOS NUEVOS
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '4px',
              }}>
                {totals.newLoans}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>Primera vez</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column' as const,
              background: 'white',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: '#0052CC',
                opacity: 0.1,
              }} />
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '8px',
              }}>
                RENOVACIONES
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '4px',
              }}>
                {totals.renewals}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>Clientes recurrentes</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column' as const,
              background: 'white',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: '#0052CC',
                opacity: 0.1,
              }} />
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '8px',
              }}>
                TOTAL OTORGADO
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '4px',
              }}>
                ${totals.amountGived.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>En {totals.count} préstamos</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column' as const,
              background: 'white',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: '#0052CC',
                opacity: 0.1,
              }} />
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#6B7280',
                marginBottom: '8px',
              }}>
                TOTAL A PAGAR
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '4px',
              }}>
                ${totals.amountToPay.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>Retorno esperado</span>
              </div>
            </div>
          </div>

          {/* Add Loan Button */}
          <Button
            tone="active"
            size="medium"
            weight="bold"
            onClick={handleAddLoan}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              borderRadius: '8px',
              backgroundColor: '#0052CC',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '40px',
              whiteSpace: 'nowrap',
              alignSelf: 'center',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <FaPlus size={14} style={{ marginTop: '-1px' }} />
            <span>Nuevo Préstamo</span>
          </Button>
        </div>

        {/* Loans Table */}
        <Box
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            position: 'relative',
          }}
        >
          <div style={{
            padding: '16px',
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '14px',
            }}>
              <thead>
                <tr style={{ 
                  backgroundColor: '#F9FAFB',
                  borderBottom: '1px solid #E5E7EB' 
                }}>
                  <th style={tableHeaderStyle}>ID</th>
                  <th style={tableHeaderStyle}>Tipo</th>
                  <th style={tableHeaderStyle}>Monto Solicitado</th>
                  <th style={tableHeaderStyle}>Monto Entregado</th>
                  <th style={tableHeaderStyle}>Monto a Pagar</th>
                  <th style={tableHeaderStyle}>Monto Pendiente</th>
                  <th style={tableHeaderStyle}>Fecha de Firma</th>
                  <th style={tableHeaderStyle}>Comisión</th>
                  <th style={tableHeaderStyle}>Nombre del Aval</th>
                  <th style={tableHeaderStyle}>Teléfono del Aval</th>
                  <th style={{
                    ...tableHeaderStyle,
                    width: '40px',
                    minWidth: '40px',
                  }}></th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr 
                    key={loan.id}
                    style={{
                      borderBottom: '1px solid #E5E7EB',
                      transition: 'all 0.3s ease',
                      backgroundColor: loan.id === newLoanId ? '#F0F9FF' : 'white',
                      position: 'relative',
                    }}
                  >
                    {loan.id === newLoanId && (
                      <td
                        colSpan={10}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: '3px',
                          height: '100%',
                          backgroundColor: '#0052CC',
                        }}
                      />
                    )}
                    <td style={tableCellStyle}>{loan.id}</td>
                    <td style={tableCellStyle}>{loan.loantype.name}</td>
                    <td style={tableCellStyle}>${loan.requestedAmount}</td>
                    <td style={tableCellStyle}>${loan.amountGived}</td>
                    <td style={tableCellStyle}>${loan.amountToPay}</td>
                    <td style={tableCellStyle}>${loan.pendingAmount}</td>
                    <td style={tableCellStyle}>{new Date(loan.signDate).toLocaleDateString()}</td>
                    <td style={tableCellStyle}>${loan.comissionAmount}</td>
                    <td style={tableCellStyle}>{loan.avalName}</td>
                    <td style={tableCellStyle}>{loan.avalPhone}</td>
                    <td style={{
                      ...tableCellStyle,
                      width: '40px',
                      position: 'relative',
                    }}>
                      <Button
                        ref={el => buttonRefs.current[loan.id] = el}
                        tone="passive"
                        size="small"
                        onClick={() => setActiveMenu(activeMenu === loan.id ? null : loan.id)}
                        style={{
                          padding: '6px',
                          minWidth: '32px',
                          height: '32px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FaEllipsisV size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {isAddingNew && (
                  <tr style={{
                    backgroundColor: '#F0F9FF',
                    position: 'relative',
                  }}>
                    <td style={tableCellStyle}>Nuevo</td>
                    <td style={tableCellStyle}>
                      <Select
                        options={[
                          { label: 'Personal', value: '1' },
                          { label: 'Negocio', value: '2' },
                        ]}
                        onChange={value => setNewLoan({
                          ...newLoan,
                          loantype: { 
                            id: value || '1', 
                            name: value === '2' ? 'Negocio' : 'Personal',
                            rate: '10',
                            weekDuration: '4',
                            __typename: 'LoanType'
                          }
                        })}
                        value={newLoan.loantype?.id}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        type="number"
                        value={newLoan.requestedAmount}
                        onChange={e => setNewLoan({ ...newLoan, requestedAmount: e.target.value })}
                        style={tableInputStyle}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        type="number"
                        value={newLoan.amountGived}
                        onChange={e => setNewLoan({ ...newLoan, amountGived: e.target.value })}
                        style={tableInputStyle}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        type="number"
                        value={newLoan.amountToPay}
                        onChange={e => setNewLoan({ ...newLoan, amountToPay: e.target.value })}
                        style={tableInputStyle}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        type="number"
                        value={newLoan.pendingAmount}
                        onChange={e => setNewLoan({ ...newLoan, pendingAmount: e.target.value })}
                        style={tableInputStyle}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        type="date"
                        value={newLoan.signDate?.split('T')[0]}
                        onChange={e => setNewLoan({ ...newLoan, signDate: e.target.value })}
                        style={tableInputStyle}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        type="number"
                        value={newLoan.comissionAmount}
                        onChange={e => setNewLoan({ ...newLoan, comissionAmount: e.target.value })}
                        style={tableInputStyle}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        type="text"
                        value={newLoan.avalName}
                        onChange={e => setNewLoan({ ...newLoan, avalName: e.target.value })}
                        style={tableInputStyle}
                        placeholder="Nombre del aval"
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <input
                        type="tel"
                        value={newLoan.avalPhone}
                        onChange={e => setNewLoan({ ...newLoan, avalPhone: e.target.value })}
                        style={tableInputStyle}
                        placeholder="Teléfono"
                      />
                    </td>
                    <td style={{
                      ...tableCellStyle,
                      width: '100px',
                    }}>
                      <Box style={{ display: 'flex', gap: '4px' }}>
                        <Button
                          tone="positive"
                          size="small"
                          onClick={handleSaveNewLoan}
                          style={{
                            padding: '6px',
                            width: '32px',
                            height: '32px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Guardar"
                        >
                          <FaCheck size={14} />
                        </Button>
                        <Button
                          tone="passive"
                          size="small"
                          onClick={handleCancelNew}
                          style={{
                            padding: '6px',
                            width: '32px',
                            height: '32px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Cancelar"
                        >
                          <FaTimes size={14} />
                        </Button>
                        <div style={{ position: 'relative' }}>
                          <Button
                            ref={el => buttonRefs.current['new'] = el}
                            tone="passive"
                            size="small"
                            onClick={() => setActiveMenu('new')}
                            style={{
                              padding: '6px',
                              minWidth: '32px',
                              height: '32px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Más opciones"
                          >
                            <FaEllipsisV size={14} />
                          </Button>
                        </div>
                      </Box>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Box>
      </Box>

      {/* Global Dropdown Container */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}>
        {loans.map((loan) => (
          activeMenu === loan.id && (
            <div
              key={`dropdown-${loan.id}`}
              ref={menuRef}
              style={{
                position: 'absolute',
                ...getDropdownPosition(loan.id),
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                pointerEvents: 'auto',
                minWidth: '160px',
              }}
            >
              <button
                onClick={() => {
                  handleEditLoan(loan);
                  setActiveMenu(null);
                }}
                style={menuItemStyle}
              >
                <FaEdit size={14} style={{ marginRight: '8px' }} />
                Editar
              </button>
              <button
                onClick={() => {
                  handleDeleteLoan(loan.id);
                  setActiveMenu(null);
                }}
                style={{
                  ...menuItemStyle,
                  color: '#DC2626',
                  borderTop: '1px solid #E5E7EB',
                }}
              >
                <FaTrash size={14} style={{ marginRight: '8px' }} />
                Eliminar
              </button>
            </div>
          )
        ))}

        {activeMenu === 'new' && (
          <div
            ref={menuRef}
            style={{
              position: 'absolute',
              ...getDropdownPosition('new'),
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              pointerEvents: 'auto',
              minWidth: '160px',
            }}
          >
            <button
              onClick={() => {
                // Acción para Opción 1
                setActiveMenu(null);
              }}
              style={menuItemStyle}
            >
              <FaEdit size={14} style={{ marginRight: '8px' }} />
              Opción 1
            </button>
            <button
              onClick={() => {
                // Acción para Opción 2
                setActiveMenu(null);
              }}
              style={{
                ...menuItemStyle,
                borderTop: '1px solid #E5E7EB',
              }}
            >
              <FaEdit size={14} style={{ marginRight: '8px' }} />
              Opción 2
            </button>
            <button
              onClick={() => {
                // Acción para Opción 3
                setActiveMenu(null);
              }}
              style={{
                ...menuItemStyle,
                borderTop: '1px solid #E5E7EB',
              }}
            >
              <FaEdit size={14} style={{ marginRight: '8px' }} />
              Opción 3
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingLoan && (
        <Box
          style={{
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
          }}
        >
          <Box
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '12px',
              width: '500px',
              maxWidth: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <Stack gap="large">
              <Stack gap="medium">
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '20px', 
                  fontWeight: '600',
                  color: '#1a1f36'
                }}>
                  Editar Préstamo
                </h2>
                <p style={{ 
                  margin: 0, 
                  color: '#697386',
                  fontSize: '14px'
                }}>
                  Modifica los detalles del préstamo seleccionado
                </p>
              </Stack>

              <Stack gap="medium">
                <TextInput
                  type="text"
                  placeholder="Monto Solicitado"
                  value={editingLoan.requestedAmount}
                  onChange={(e) => setEditingLoan({ ...editingLoan, requestedAmount: e.target.value })}
                  style={inputStyle}
                />
                <TextInput
                  type="text"
                  placeholder="Monto Entregado"
                  value={editingLoan.amountGived}
                  onChange={(e) => setEditingLoan({ ...editingLoan, amountGived: e.target.value })}
                  style={inputStyle}
                />
                <TextInput
                  type="text"
                  placeholder="Monto a Pagar"
                  value={editingLoan.amountToPay}
                  onChange={(e) => setEditingLoan({ ...editingLoan, amountToPay: e.target.value })}
                  style={inputStyle}
                />
                <TextInput
                  type="text"
                  placeholder="Monto Pendiente"
                  value={editingLoan.pendingAmount}
                  onChange={(e) => setEditingLoan({ ...editingLoan, pendingAmount: e.target.value })}
                  style={inputStyle}
                />
                <TextInput
                  type="text"
                  placeholder="Comisión"
                  value={editingLoan.comissionAmount}
                  onChange={(e) => setEditingLoan({ ...editingLoan, comissionAmount: e.target.value })}
                  style={inputStyle}
                />
                <TextInput
                  type="text"
                  placeholder="Nombre del Aval"
                  value={editingLoan.avalName}
                  onChange={(e) => setEditingLoan({ ...editingLoan, avalName: e.target.value })}
                  style={inputStyle}
                />
                <TextInput
                  type="text"
                  placeholder="Teléfono del Aval"
                  value={editingLoan.avalPhone}
                  onChange={(e) => setEditingLoan({ ...editingLoan, avalPhone: e.target.value })}
                  style={inputStyle}
                />
              </Stack>

              <Box style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                marginTop: '16px'
              }}>
                <Button
                  tone="negative"
                  size="large"
                  onClick={() => setEditingLoan(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  tone="active"
                  size="large"
                  weight="bold"
                  onClick={handleUpdateLoan}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#0052CC',
                  }}
                >
                  Guardar Cambios
                </Button>
              </Box>
            </Stack>
          </Box>
        </Box>
      )}
    </>
  );
};

// Styles
const tableHeaderStyle = {
  padding: '12px 8px',
  textAlign: 'left' as const,
  fontWeight: '500',
  color: '#374151',
  whiteSpace: 'normal' as const,
  fontSize: '13px',
  lineHeight: '1.2',
  minWidth: '80px',
  maxWidth: '120px',
};

const tableCellStyle = {
  padding: '12px 8px',
  color: '#1a1f36',
  fontSize: '13px',
  whiteSpace: 'nowrap' as const,
  maxWidth: '120px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const inputStyle = {
  width: '100%',
  padding: '10px 16px',
  fontSize: '14px',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  outline: 'none',
  transition: 'all 0.2s ease',
};

const menuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '8px 16px',
  fontSize: '14px',
  color: '#1a1f36',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left' as const,
  transition: 'background-color 0.2s ease',
  ':hover': {
    backgroundColor: '#F9FAFB',
  },
};

const tableInputStyle = {
  width: '100%',
  padding: '6px 8px',
  fontSize: '14px',
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  outline: 'none',
  transition: 'all 0.2s ease',
  '&:focus': {
    borderColor: '#0052CC',
    boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.1)',
  },
}; 