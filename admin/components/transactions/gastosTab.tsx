/** @jsxRuntime automatic */

import React, { useState, useEffect, useMemo } from 'react';
import { gql, useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { AlertDialog } from '@keystone-ui/modals';
import { TrashIcon } from '@keystone-ui/icons';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { DatePicker, Select, TextInput } from '@keystone-ui/fields';
import { FaPlus, FaTrash, FaEdit, FaEllipsisV, FaCheck, FaTimes } from 'react-icons/fa';
import { createPortal } from 'react-dom';

// Import components
import RouteLeadSelector from '../routes/RouteLeadSelector';
import DateMover from './utils/DateMover';

// Import GraphQL queries and mutations
import { GET_ROUTES_SIMPLE } from '../../graphql/queries/routes-optimized';
import { CREATE_TRANSACTION, UPDATE_TRANSACTION } from '../../graphql/mutations/transactions';
import type { Transaction, Account, Option, TransactionCreateInput, Route, Employee } from '../../types/transaction';

// Query optimizada con límite y filtro específico de expenseSource para mejor rendimiento
const GET_EXPENSES_BY_DATE_SIMPLE = gql`
  query GetExpensesByDateSimple($date: DateTime!, $nextDate: DateTime!, $take: Int = 200) {
    transactions(
      where: {
        AND: [
          { date: { gte: $date } }
          { date: { lt: $nextDate } }
          { type: { equals: "EXPENSE" } }
          { expenseSource: { 
            in: ["VIATIC", "GASOLINE", "ACCOMMODATION", "NOMINA_SALARY", "EXTERNAL_SALARY", "VEHICULE_MAINTENANCE", "MISC"] 
          }}
        ]
      }
      orderBy: { date: desc }
      take: $take
    ) {
      id
      amount
      type
      expenseSource
      date
      sourceAccount {
        id
        name
        type
      }
      lead {
        id
        personalData {
          fullName
        }
      }
    }
    transactionsCount(
      where: {
        AND: [
          { date: { gte: $date } }
          { date: { lt: $nextDate } }
          { type: { equals: "EXPENSE" } }
        ]
      }
    )
  }
`;

const DELETE_TRANSACTION = gql`
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(where: { id: $id }) {
      id
    }
  }
`;

const expenseTypes = [
  { label: 'Seleccionar tipo de gasto', value: '' },
  { label: 'Viáticos', value: 'VIATIC' },
  { label: 'Gasolina', value: 'GASOLINE' },
  { label: 'Hospedaje', value: 'ACCOMMODATION' },
  { label: 'Nómina', value: 'NOMINA_SALARY' },
  { label: 'Salario Externo', value: 'EXTERNAL_SALARY' },
  { label: 'Mantenimiento de Vehículo', value: 'VEHICULE_MAINTENANCE' },
  { label: 'Gasto de Líder', value: 'LEAD_EXPENSE' },
  { label: 'Lavado de Auto', value: 'LAVADO_DE_AUTO' },
  { label: 'Caseta', value: 'CASETA' },
  { label: 'Papelería', value: 'PAPELERIA' }
];

interface DropdownPortalProps {
  children: React.ReactNode;
  isOpen: boolean;
}

const DropdownPortal = ({ children, isOpen }: DropdownPortalProps) => {
  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: 9999,
    }}>
      {children}
    </div>,
    document.body
  );
};

export interface GastosProps {
  selectedDate: Date;
  selectedRoute: Route | null;
  selectedLead: Employee | null;
  onSaveComplete?: () => void;
  refreshKey: number;
}

interface FormState {
  newTransactions: TransactionCreateInput[];
  transactions: Transaction[];
  editedTransactions: { [key: string]: Transaction };
  showSuccessMessage: boolean;
  editingTransaction: Transaction | null;
}

export const CreateExpensesForm = ({ 
  selectedDate, 
  selectedRoute, 
  selectedLead,
  refreshKey,
  onSaveComplete
}: GastosProps) => {
  const [state, setState] = useState<FormState>({
    newTransactions: [],
    transactions: [],
    editedTransactions: {},
    showSuccessMessage: false,
    editingTransaction: null
  });

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = React.useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const { 
    newTransactions, transactions, editedTransactions, showSuccessMessage, editingTransaction 
  } = state;

  const updateState = (updates: Partial<FormState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const { data: expensesData, loading: expensesLoading, refetch: refetchExpenses } = useQuery(GET_EXPENSES_BY_DATE_SIMPLE, {
    variables: { 
      date: selectedDate,
      nextDate: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)
    },
    skip: !selectedDate,
    onCompleted: (data) => {
      if (data?.transactions) {
        // Filtramos las transacciones por líder en el cliente si hay uno seleccionado
        // Y también excluimos las transacciones de comisiones
        const filteredTransactions = selectedLead
          ? data.transactions.filter((t: Transaction) => 
              t.lead?.id === selectedLead.id && 
              !['LOAN_PAYMENT_COMISSION', 'LOAN_GRANTED_COMISSION', 'LEAD_COMISSION'].includes(t.expenseSource || '')
            )
          : data.transactions.filter((t: Transaction) => 
              !['LOAN_PAYMENT_COMISSION', 'LOAN_GRANTED_COMISSION', 'LEAD_COMISSION'].includes(t.expenseSource || '')
            );
        updateState({ transactions: filteredTransactions });
      }
    }
  });

  const [createTransaction, { loading: createLoading }] = useMutation(CREATE_TRANSACTION);
  const [updateTransaction, { loading: updateLoading }] = useMutation(UPDATE_TRANSACTION);
  const [deleteTransaction] = useMutation(DELETE_TRANSACTION);

  const router = useRouter();

  const handleAddTransaction = () => {
    if (!selectedRoute || !selectedDate) {
      alert('Por favor seleccione una ruta y una fecha');
      return;
    }

    const routeData = selectedRoute as unknown as Route;
    const routeAccount = routeData?.accounts?.find(account => account.type === 'EMPLOYEE_CASH_FUND');
    
    if (!routeAccount) {
      alert('La ruta seleccionada no tiene una cuenta de fondo asociada');
      return;
    }

    const newTransaction: TransactionCreateInput = {
      amount: '',
      type: 'EXPENSE',
      expenseSource: '',
      date: selectedDate.toISOString(),
      sourceAccount: { connect: { id: routeAccount.id } },
      ...(selectedLead && { lead: { connect: { id: selectedLead.id } } })
    };

    updateState({
      newTransactions: [...newTransactions, newTransaction]
    });
  };

  const handleEditTransaction = (index: number, field: string, value: string) => {
    const updatedTransactions = [...newTransactions];
    const transaction = { ...updatedTransactions[index] };

    switch (field) {
      case 'expenseType': {
        transaction.expenseSource = value;
        
        // Si es gasolina, buscar la cuenta toka como default
        if (value === 'GASOLINE' && selectedRoute?.accounts) {
          const tokaAccount = selectedRoute.accounts.find(acc => 
            acc.type === 'PREPAID_GAS' && acc.name?.toLowerCase().includes('toka')
          );
          if (tokaAccount) {
            transaction.sourceAccount = { connect: { id: tokaAccount.id } };
          }
        }
        break;
      }
      case 'amount': {
        transaction.amount = value;
        break;
      }
      case 'sourceAccount': {
        transaction.sourceAccount = { connect: { id: value } };
        break;
      }
      default: {
        if (field in transaction) {
          (transaction as any)[field] = value;
        }
      }
    }

    updatedTransactions[index] = transaction;
    updateState({ newTransactions: updatedTransactions });
  };

  const handleCancelNew = (index: number) => {
    const updatedTransactions = [...newTransactions];
    updatedTransactions.splice(index, 1);
    updateState({ newTransactions: updatedTransactions });
  };

  const handleSaveAllChanges = async () => {
    try {
      setIsCreating(true);
      
      // Crear las nuevas transacciones
      for (const transaction of newTransactions) {
        await createTransaction({
          variables: { data: transaction }
        });
      }

      // Actualizar las transacciones existentes
      for (const [id, transaction] of Object.entries(editedTransactions)) {
        await updateTransaction({
          variables: { 
            id,
            data: {
              amount: transaction.amount,
              expenseSource: transaction.expenseSource
            }
          }
        });
      }

      // Refrescar todos los datos necesarios
      await Promise.all([
        refetchExpenses()
      ]);

      // Asegurarnos de que los datos se actualicen en el componente padre
      if (onSaveComplete) {
        await onSaveComplete();
      }

      // Mostrar mensaje de éxito y limpiar el estado
      updateState({ 
        showSuccessMessage: true,
        newTransactions: [],
        editedTransactions: {}
      });
      
      // Ocultar el mensaje después de 2 segundos
      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 2000);

    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Error al guardar los cambios');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditExistingTransaction = (transactionId: string, field: string, value: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    const updatedTransaction = {
      ...transaction,
      [field]: value
    };

    updateState({
      editedTransactions: {
        ...editedTransactions,
        [transactionId]: updatedTransaction
      }
    });
  };

  const handleOpenEditModal = (transaction: Transaction) => {
    updateState({ editingTransaction: transaction });
  };

  const handleCloseEditModal = () => {
    updateState({ editingTransaction: null });
  };

  const handleSaveEdit = async () => {
    if (!state.editingTransaction) return;

    try {
      setIsUpdating(state.editingTransaction.id);
      
      await updateTransaction({
        variables: { 
          id: state.editingTransaction.id,
          data: {
            amount: state.editingTransaction.amount,
            expenseSource: state.editingTransaction.expenseSource
          }
        }
      });

      // Refrescar los datos
      await refetchExpenses();

      // Actualizar el componente padre
      if (onSaveComplete) {
        await onSaveComplete();
      }

      updateState({ 
        showSuccessMessage: true,
        editingTransaction: null
      });

      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 2000);

    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteExistingTransaction = async (transactionId: string) => {
    if (!window.confirm('¿Está seguro de eliminar este gasto?')) {
      return;
    }

    try {
      setIsDeleting(transactionId);
      
      await deleteTransaction({
        variables: { id: transactionId }
      });

      // Refrescar los datos
      await refetchExpenses();

      // Actualizar el componente padre
      if (onSaveComplete) {
        await onSaveComplete();
      }

      updateState({ showSuccessMessage: true });
      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 2000);

    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  // Efecto para actualizar las transacciones cuando cambie la fecha o el líder
  useEffect(() => {
    if (expensesData?.transactions) {
      const filteredTransactions = selectedLead
        ? expensesData.transactions.filter((t: Transaction) => 
            t.lead?.id === selectedLead.id && 
            !['LOAN_PAYMENT_COMISSION', 'LOAN_GRANTED_COMISSION', 'LEAD_COMISSION'].includes(t.expenseSource || '')
          )
        : expensesData.transactions.filter((t: Transaction) => 
            !['LOAN_PAYMENT_COMISSION', 'LOAN_GRANTED_COMISSION', 'LEAD_COMISSION'].includes(t.expenseSource || '')
          );
      updateState({ transactions: filteredTransactions });
    }
  }, [selectedDate, selectedLead, expensesData]);

  useEffect(() => {
    refetchExpenses();
  }, [refreshKey, refetchExpenses]);

  const getDropdownPosition = (buttonId: string) => {
    const button = buttonRefs.current[buttonId];
    if (!button) return { top: 0, left: 0 };

    const rect = button.getBoundingClientRect();
    return {
      top: rect.top - 4,
      left: rect.right - 160,
    };
  };

  if (expensesLoading) return <LoadingDots label="Loading expenses" size="large" />;

  const totalAmount = transactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0) +
    newTransactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount || '0'), 0);

  return (
    <Box paddingTop="medium">
      <div style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        marginBottom: '16px',
        background: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}>
        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '1px',
          background: '#E2E8F0',
          borderRadius: '8px',
          overflow: 'hidden',
          flex: 1,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '12px',
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
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '4px',
            }}>
              TOTAL DE GASTOS
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: '1',
              marginBottom: '2px',
            }}>
              {transactions.length + newTransactions.length}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>{transactions.length} registrados + {newTransactions.length} nuevos</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '12px',
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
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '4px',
            }}>
              GASTOS NUEVOS
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: '1',
              marginBottom: '2px',
            }}>
              {newTransactions.length}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>Por guardar</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '12px',
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
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '4px',
            }}>
              TOTAL GASTADO
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: '1',
              marginBottom: '2px',
            }}>
              ${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>${transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0).toFixed(2)} registrados + ${newTransactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0).toFixed(2)} nuevos</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '12px',
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
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '4px',
            }}>
              GASTOS MODIFICADOS
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: '1',
              marginBottom: '2px',
            }}>
              {Object.keys(editedTransactions).length}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>Por guardar</span>
            </div>
          </div>

          {/* Quinta tarjeta - Cambiar Fecha */}
          <DateMover
            type="expenses"
            selectedDate={selectedDate}
            selectedRoute={selectedRoute}
            selectedLead={selectedLead}
            onSuccess={() => {
              refetchExpenses();
              // Aquí deberías llamar a refetchRoute si tienes acceso a esa query
            }}
            itemCount={transactions.length + newTransactions.length}
            label="gasto(s)"
          />
        </div>
      </div>

      {/* Existing Expenses Table */}
      <Box
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          marginBottom: '16px',
        }}
      >
        <div style={{
          padding: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Gastos Registrados</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.keys(editedTransactions).length > 0 && (
                <Button
                  tone="positive"
                  weight="bold"
                  onClick={handleSaveAllChanges}
                  isLoading={updateLoading}
                >
                  Guardar Cambios
                </Button>
              )}
            </div>
          </div>

          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '13px',
          }}>
            <thead>
              <tr style={{ 
                backgroundColor: '#F9FAFB',
                borderBottom: '1px solid #E5E7EB' 
              }}>
                <th style={tableHeaderStyle}>Tipo</th>
                <th style={tableHeaderStyle}>Monto</th>
                <th style={tableHeaderStyle}>Fecha</th>
                <th style={tableHeaderStyle}>Líder</th>
                <th style={tableHeaderStyle}>Cuenta</th>
                <th style={{
                  ...tableHeaderStyle,
                  width: '40px',
                  minWidth: '40px',
                }}></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr 
                  key={transaction.id}
                  style={{
                    borderBottom: '1px solid #E5E7EB',
                    transition: 'all 0.3s ease',
                    backgroundColor: 'white',
                    position: 'relative',
                  }}
                >
                  <td style={tableCellStyle}>
                    {Object.keys(editedTransactions).includes(transaction.id) ? (
                      <Select
                        value={expenseTypes.find(t => t.value === editedTransactions[transaction.id].expenseSource) || expenseTypes[0]}
                        options={expenseTypes}
                        onChange={option => handleEditExistingTransaction(transaction.id, 'expenseSource', option?.value || '')}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuPlacement="auto"
                      />
                    ) : (
                      expenseTypes.find(t => t.value === transaction.expenseSource)?.label || 'Sin tipo'
                    )}
                  </td>
                  <td style={tableCellStyle}>
                    {Object.keys(editedTransactions).includes(transaction.id) ? (
                      <TextInput
                        type="number"
                        value={editedTransactions[transaction.id].amount}
                        onChange={e => handleEditExistingTransaction(transaction.id, 'amount', e.target.value)}
                      />
                    ) : (
                      `$${parseFloat(transaction.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </td>
                  <td style={tableCellStyle}>
                    {new Date(new Date(transaction.date).getTime() + new Date().getTimezoneOffset() * 60000).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </td>
                  <td style={tableCellStyle}>{transaction.lead?.personalData?.fullName || 'Sin líder'}</td>
                  <td style={tableCellStyle}>{transaction.sourceAccount?.name || '-'}</td>
                  <td style={{
                    ...tableCellStyle,
                    width: '40px',
                    position: 'relative',
                  }}>
                    {isDeleting === transaction.id ? (
                      <Box style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '100%',
                        height: '32px'
                      }}>
                        <LoadingDots label="Eliminando" size="small" />
                      </Box>
                    ) : (
                      <Button
                        ref={(el) => { buttonRefs.current[transaction.id] = el; }}
                        tone="passive"
                        size="small"
                        onClick={() => setActiveMenu(activeMenu === transaction.id ? null : transaction.id)}
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      {/* New Expenses Table */}
      {newTransactions.length > 0 && (
        <Box
          style={{
            backgroundColor: '#F0F9FF',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            marginBottom: '16px',
            position: 'relative',
          }}
        >
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #E0F2FE',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#0277BD',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>➕</span>
              Gastos Nuevos ({newTransactions.length})
            </h3>
          </div>
          
          <div style={{
            padding: '12px',
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}>
              <thead>
                <tr style={{ 
                  backgroundColor: '#E0F2FE',
                  borderBottom: '1px solid #B3E5FC' 
                }}>
                  <th style={tableHeaderStyle}>Tipo</th>
                  <th style={tableHeaderStyle}>Monto</th>
                  <th style={tableHeaderStyle}>Fecha</th>
                  <th style={tableHeaderStyle}>Líder</th>
                  <th style={tableHeaderStyle}>Cuenta</th>
                  <th style={{
                    ...tableHeaderStyle,
                    width: '80px',
                  }}></th>
                </tr>
              </thead>
              <tbody>
                {newTransactions.map((transaction, index) => (
                  <tr 
                    key={`new-${index}`}
                    style={{
                      backgroundColor: '#ECFDF5',
                      borderBottom: '1px solid #E0F2FE',
                    }}
                  >
                    <td style={tableCellStyle}>
                      <Select
                        value={expenseTypes.find(t => t.value === transaction.expenseSource) || expenseTypes[0]}
                        options={expenseTypes}
                        onChange={option => handleEditTransaction(index, 'expenseType', option?.value || '')}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuPlacement="auto"
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <TextInput
                        type="number"
                        value={transaction.amount}
                        onChange={e => handleEditTransaction(index, 'amount', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={tableCellStyle}>
                      {new Date(new Date(transaction.date).getTime() + new Date().getTimezoneOffset() * 60000).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      })}
                    </td>
                    <td style={tableCellStyle}>{selectedLead?.personalData?.fullName}</td>
                    <td style={tableCellStyle}>
                      <Select
                        value={selectedRoute?.accounts?.map(acc => ({
                          label: acc.name || '',
                          value: acc.id
                        })).find(acc => acc.value === transaction.sourceAccount?.connect?.id) || null}
                        options={selectedRoute?.accounts?.filter(acc => {
                          // Si es gasolina, solo mostrar PREPAID_GAS (toka) y EMPLOYEE_CASH_FUND (efectivo)
                          if (transaction.expenseSource === 'GASOLINE') {
                            return acc.type === 'PREPAID_GAS' || acc.type === 'EMPLOYEE_CASH_FUND';
                          }
                          // Para otros tipos, mostrar todas las cuentas EXCEPTO PREPAID_GAS (toka)
                          return acc.type !== 'PREPAID_GAS';
                        }).map(acc => ({
                          label: acc.type === 'PREPAID_GAS' ? `${acc.name || 'Toka'} (Prepago Gas)` : 
                                 acc.type === 'EMPLOYEE_CASH_FUND' ? `${acc.name || 'Efectivo'} (Efectivo)` :
                                 acc.name || '',
                          value: acc.id
                        })) || []}
                        onChange={option => handleEditTransaction(index, 'sourceAccount', option?.value || '')}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuPlacement="auto"
                      />
                    </td>
                    <td style={{
                      ...tableCellStyle,
                      width: '80px',
                    }}>
                      <Box style={{ display: 'flex', gap: '4px' }}>
                        <Button
                          tone="negative"
                          size="small"
                          onClick={() => handleCancelNew(index)}
                          style={{
                            padding: '6px',
                            width: '32px',
                            height: '32px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Eliminar de la lista"
                        >
                          <FaTrash size={14} />
                        </Button>
                      </Box>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      )}

      {/* Add New Expense Section */}
      <Box
        style={{
          backgroundColor: '#F8FAFC',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          marginBottom: '16px',
          position: 'relative',
        }}
      >
        <div style={{
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📝</span>
              Agregar Nuevo Gasto
            </h3>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '13px',
              color: '#6B7280',
              fontStyle: 'italic'
            }}>
              💡 Haz clic en el botón para agregar un nuevo gasto a la lista
            </p>
          </div>
          
          <Button
            tone="active"
            size="medium"
            weight="bold"
            onClick={handleAddTransaction}
            isDisabled={!selectedRoute || !selectedDate || createLoading}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              borderRadius: '6px',
              backgroundColor: '#0052CC',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '40px',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <FaPlus size={12} style={{ marginTop: '-1px' }} />
            <span>Nuevo Gasto</span>
          </Button>
        </div>
      </Box>

      {/* Save All Button */}
      {(newTransactions.length > 0 || Object.keys(editedTransactions).length > 0) && (
        <Box
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #e0f2fe',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: '#e0f2fe',
              borderRadius: '6px',
              color: '#0052CC',
              fontSize: '14px',
              fontWeight: '500',
            }}>
              <span>📋</span>
              <span>
                {newTransactions.length} gasto{newTransactions.length !== 1 ? 's' : ''} nuevo{newTransactions.length !== 1 ? 's' : ''} + {Object.keys(editedTransactions).length} modificado{Object.keys(editedTransactions).length !== 1 ? 's' : ''} listo{Object.keys(editedTransactions).length + newTransactions.length !== 1 ? 's' : ''} para guardar
              </span>
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px',
          }}>
            <Button
              tone="negative"
              weight="bold"
              onClick={() => {
                updateState({ 
                  newTransactions: [],
                  editedTransactions: {}
                });
              }}
              style={{ padding: '8px 24px', minWidth: '150px' }}
            >
              Cancelar Todo
            </Button>
            <Button
              tone="active"
              weight="bold"
              onClick={handleSaveAllChanges}
              disabled={isCreating}
              style={{
                padding: '8px 24px',
                minWidth: '200px',
                backgroundColor: '#0052CC',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isCreating ? (
                <>
                  <LoadingDots label="Guardando..." />
                  <span>Guardando gastos...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Guardar Cambios</span>
                </>
              )}
            </Button>
          </div>
        </Box>
      )}

      {/* Global Dropdown Container */}
      <DropdownPortal isOpen={activeMenu !== null}>
        {transactions.map((transaction) => (
          activeMenu === transaction.id && (
            <div
              key={`dropdown-${transaction.id}`}
              ref={menuRef}
              style={{
                position: 'fixed',
                ...getDropdownPosition(transaction.id),
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
                pointerEvents: 'auto',
                minWidth: '160px',
                zIndex: 10000,
                transform: 'translateY(-100%)',
              }}
            >
              <button
                onClick={() => {
                  handleOpenEditModal(transaction);
                  setActiveMenu(null);
                }}
                style={menuItemStyle}
              >
                <FaEdit size={14} style={{ marginRight: '8px' }} />
                Editar
              </button>
              <button
                onClick={() => {
                  handleDeleteExistingTransaction(transaction.id);
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
      </DropdownPortal>

      {/* Edit Modal */}
      {editingTransaction && (
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
            borderRadius: '8px',
            padding: '24px',
            width: '400px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}>
            <h3 style={{
              marginBottom: '16px',
              fontSize: '16px',
              fontWeight: '600',
              color: '#1a202c',
            }}>
              Editar Gasto
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                color: '#4a5568',
              }}>
                Tipo de Gasto
              </label>
              <Select
                value={expenseTypes.find(t => t.value === editingTransaction.expenseSource) || expenseTypes[0]}
                options={expenseTypes}
                onChange={option => updateState({
                  editingTransaction: {
                    ...editingTransaction,
                    expenseSource: option?.value || ''
                  }
                })}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                menuPlacement="auto"
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                color: '#4a5568',
              }}>
                Monto
              </label>
              <TextInput
                type="number"
                value={editingTransaction.amount}
                onChange={e => updateState({
                  editingTransaction: {
                    ...editingTransaction,
                    amount: e.target.value
                  }
                })}
                placeholder="0.00"
              />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}>
              <Button
                tone="passive"
                onClick={handleCloseEditModal}
              >
                Cancelar
              </Button>
              <Button
                tone="positive"
                onClick={handleSaveEdit}
                isLoading={isUpdating === editingTransaction.id}
              >
                {isUpdating === editingTransaction.id ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <Box
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '16px 24px',
            backgroundColor: '#10B981',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontWeight: '500' }}>¡Cambios guardados exitosamente!</span>
        </Box>
      )}
    </Box>
  );
};

export default function ExpensesPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedLead, setSelectedLead] = useState<Employee | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { refetch: refetchRouteData } = useQuery(GET_ROUTES_SIMPLE, {
    variables: { where: {} },
    fetchPolicy: 'network-only',
  });

  const handleRouteSelect = (route: Route | null) => {
    setSelectedRoute(route);
    setSelectedLead(null);
  };

  const handleLeadSelect = (lead: Employee | null) => {
    setSelectedLead(lead);
  };

  const handleDateChange = (date: string) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    setSelectedDate(selectedDate);
  };

  const handleRefresh = async () => {
    try {
      if (selectedRoute?.id) {
        await refetchRouteData();
        setRefreshKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  return (
    <PageContainer header="Gastos">
      <Box padding="xlarge">
        <Box style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <Box style={{ width: '100%' }}>
            <RouteLeadSelector
              key={refreshKey}
              selectedRoute={selectedRoute}
              selectedLead={selectedLead}
              selectedDate={selectedDate}
              onRouteSelect={handleRouteSelect}
              onLeadSelect={handleLeadSelect}
              onDateSelect={setSelectedDate}
            />
          </Box>
          <Box style={{ width: '100%' }}>
            <DatePicker
              value={selectedDate.toISOString().split('T')[0]}
              onUpdate={handleDateChange}
              onClear={() => setSelectedDate(new Date())}
            />
          </Box>
        </Box>
        <CreateExpensesForm
          selectedDate={selectedDate}
          selectedRoute={selectedRoute}
          selectedLead={selectedLead}
          refreshKey={refreshKey}
          onSaveComplete={handleRefresh}
        />
      </Box>
    </PageContainer>
  );
}

// Styles
const tableHeaderStyle = {
  padding: '8px 6px',
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
  padding: '8px 6px',
  color: '#1a1f36',
  fontSize: '13px',
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  position: 'relative' as const,
};

const menuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '8px 16px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#374151',
  transition: 'background-color 0.2s',
  '&:hover': {
    backgroundColor: '#F3F4F6',
  },
};
