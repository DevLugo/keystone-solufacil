/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { Select, TextInput, DatePicker } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { gql } from '@apollo/client';
import { FaPlus, FaEllipsisV, FaCheck, FaTimes, FaEdit, FaTrash } from 'react-icons/fa';
import { createPortal } from 'react-dom';

// Import components
import RouteLeadSelector from '../components/routes/RouteLeadSelector';

// Import GraphQL queries and mutations
import { GET_ROUTES, GET_LEADS } from '../graphql/queries/routes';
import { CREATE_TRANSACTION, UPDATE_TRANSACTION } from '../graphql/mutations/transactions';
import type { Transaction, Account, Option, TransactionCreateInput, Route, Employee } from '../types/transaction';

interface DropdownPortalProps {
  isOpen: boolean;
  children: React.ReactNode;
}

const DropdownPortal: React.FC<DropdownPortalProps> = ({ isOpen, children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>,
    document.body
  );
};

const GET_EXPENSES_BY_DATE = gql`
  query GetExpensesByDate($date: DateTime!, $nextDate: DateTime!) {
    transactions(where: {
      AND: [
        { date: { gte: $date } },
        { date: { lt: $nextDate } },
        { type: { equals: "EXPENSE" } },
        { expenseSource: { not: { equals: "LOAN_GRANTED" } } },
        { expenseSource: { not: { equals: "LOAN_GRANTED_COMISSION" } } },
        { expenseSource: { not: { equals: "LOAN_PAYMENT_COMISSION" } } }
      ]
    }) {
      id
      amount
      expenseSource
      date
      sourceAccount {
        id
        name
        __typename
      }
      lead {
        id
        personalData {
          fullName
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const styles = {
  form: {
    width: '100%',
    height: '100%',
    padding: '24px'
  },
  mainContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    width: '100%',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  selectorsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  selectorWrapper: {
    width: '100%'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '16px',
    '& th, & td': {
      padding: '16px',
      textAlign: 'left' as const,
      borderBottom: '1px solid #e5e7eb',
      fontSize: '14px',
    },
    '& th': {
      backgroundColor: '#f8fafc',
      fontWeight: 600,
      color: '#4a5568',
    },
    '& td': {
      backgroundColor: '#ffffff',
    },
    '& tr:hover td': {
      backgroundColor: '#f8fafc',
    }
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a202c',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
  },
  totalAmount: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    '& span': {
      fontSize: '14px',
      fontWeight: '600',
      color: '#2d3748',
    }
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'translateY(-1px)',
    }
  },
  selectContainer: {
    position: 'relative' as const,
    '& .select__menu': {
      zIndex: 9999,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      borderRadius: '8px',
      overflow: 'hidden',
    },
    '& .select__control': {
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      boxShadow: 'none',
      '&:hover': {
        borderColor: '#4299e1',
      },
      '&--is-focused': {
        borderColor: '#4299e1',
        boxShadow: '0 0 0 2px rgba(66, 153, 225, 0.2)',
      }
    },
    '& .select__option': {
      fontSize: '14px',
      padding: '8px 12px',
      '&--is-focused': {
        backgroundColor: '#ebf8ff',
      },
      '&--is-selected': {
        backgroundColor: '#4299e1',
        color: 'white',
      }
    }
  },
  tableHeaderStyle: {
    padding: '12px 16px',
    textAlign: 'left' as const,
    fontSize: '13px',
    fontWeight: '600',
    color: '#4B5563',
    backgroundColor: '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
    whiteSpace: 'nowrap' as const,
  },
  tableCellStyle: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#374151',
    borderBottom: '1px solid #E5E7EB',
    whiteSpace: 'nowrap' as const,
  },
  menuItemStyle: {
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
  },
};

const expenseTypes = [
  { label: 'Seleccionar tipo de gasto', value: '' },
  { label: 'Viáticos', value: 'VIATIC' },
  { label: 'Gasolina', value: 'GASOLINE' },
  { label: 'Hospedaje', value: 'ACCOMMODATION' },
  { label: 'Nómina', value: 'NOMINA_SALARY' },
  { label: 'Salario Externo', value: 'EXTERNAL_SALARY' },
  { label: 'Mantenimiento de Vehículo', value: 'VEHICULE_MAINTENANCE' },
  { label: 'Préstamo Otorgado', value: 'LOAN_GRANTED' },
  { label: 'Comisión de Pago de Préstamo', value: 'LOAN_PAYMENT_COMISSION' },
  { label: 'Comisión de Otorgamiento de Préstamo', value: 'LOAN_GRANTED_COMISSION' },
  { label: 'Comisión de Líder', value: 'LEAD_COMISSION' }
];

const formStyles = {
  wrapper: {
    position: 'relative' as const,
    marginBottom: '8px',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    color: '#4B5563',
    fontWeight: 500,
    fontSize: '14px'
  },
  inputContainer: {
    position: 'relative' as const,
    transition: 'all 0.3s ease',
    '&:focus-within': {
      zIndex: 1,
      transform: 'scale(1.02)',
    }
  },
  input: {
    width: '100%',
    transition: 'all 0.3s ease',
    '&:focus': {
      outline: 'none',
      borderColor: '#2563eb',
    }
  }
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
  focusedInput: string | null;
  editedTransactions: { [key: string]: Transaction };
  showSuccessMessage: boolean;
  expandedSection: 'existing' | 'new' | null;
  editingTransaction: Transaction | null;
}

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

const DELETE_TRANSACTION = gql`
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(where: { id: $id }) {
      id
    }
  }
`;

export const CreateExpensesForm = ({ 
  selectedDate, 
  selectedRoute, 
  selectedLead,
  refreshKey 
}: GastosProps) => {
  const [state, setState] = useState<FormState>({
    newTransactions: [],
    transactions: [],
    focusedInput: null,
    editedTransactions: {},
    showSuccessMessage: false,
    expandedSection: 'existing',
    editingTransaction: null
  });

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [isAddingNew, setIsAddingNew] = useState(false);

  const { 
    newTransactions, transactions, focusedInput, editedTransactions, showSuccessMessage, expandedSection, editingTransaction 
  } = state;

  const toggleSection = (section: 'existing' | 'new') => {
    setState(prev => ({
      ...prev,
      expandedSection: prev.expandedSection === section ? null : section
    }));
  };

  const updateState = (updates: Partial<FormState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const { data: routesData, loading: routesLoading, error: routesError, refetch: refetchRoutes } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
    variables: { where: {} },
  });

  const GET_ROUTE = gql`
    query GetRoute($id: ID!) {
      route(where: { id: $id }) {
        id
        name
        accounts {
          id
          name
          type
          amount
        }
      }
    }
  `;

  const { refetch: refetchRoute } = useQuery(GET_ROUTE, {
    skip: !selectedRoute?.id,
    variables: { id: selectedRoute?.id || '' }
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery(GET_LEADS);

  const { data: expensesData, loading: expensesLoading, refetch: refetchExpenses } = useQuery(GET_EXPENSES_BY_DATE, {
    variables: { 
      date: selectedDate.toISOString().split('T')[0] + 'T00:00:00.000Z',
      nextDate: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00.000Z'
    },
    skip: !selectedDate,
    onCompleted: (data) => {
      if (data?.transactions) {
        // Filtramos las transacciones por líder en el cliente si hay uno seleccionado
        const filteredTransactions = selectedLead
          ? data.transactions.filter((t: Transaction) => t.lead?.id === selectedLead.id)
          : data.transactions;
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
    console.log("routeAccount:", routeData);
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
      newTransactions: [...newTransactions, newTransaction],
      expandedSection: 'new'
    });
    setIsAddingNew(true);
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
      await Promise.all([
        refetchExpenses(),
        refetchRoutes(),
        selectedRoute?.id ? refetchRoute() : Promise.resolve()
      ]);

      // Actualizar el componente padre
      if (onSaveComplete) {
        await onSaveComplete();
      }

      updateState({ 
        showSuccessMessage: true,
        editingTransaction: null
      });

      setTimeout(() => {
        updateState(prev => ({
          ...prev,
          showSuccessMessage: false
        }));
      }, 2000);

    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const handleEditTransaction = (index: number, field: string, value: string) => {
    const updatedTransactions = [...newTransactions];
    const transaction = { ...updatedTransactions[index] };

    switch (field) {
      case 'expenseType': {
        transaction.expenseSource = value;
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
    if (updatedTransactions.length === 0) {
      setIsAddingNew(false);
    }
  };

  const handleSaveAllChanges = async () => {
    try {
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
        refetchExpenses(),
        refetchRoutes(),
        selectedRoute?.id ? refetchRoute() : Promise.resolve()
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
        updateState(prev => ({
          ...prev,
          showSuccessMessage: false
        }));
      }, 2000);

    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  const handleDeleteExistingTransaction = async (transactionId: string) => {
    if (!window.confirm('¿Está seguro de eliminar este gasto?')) {
      return;
    }

    try {
      await deleteTransaction({
        variables: { id: transactionId }
      });

      // Refrescar los datos
      await Promise.all([
        refetchExpenses(),
        refetchRoutes(),
        selectedRoute?.id ? refetchRoute() : Promise.resolve()
      ]);

      // Actualizar el componente padre
      if (onSaveComplete) {
        await onSaveComplete();
      }

      updateState({ showSuccessMessage: true });
      setTimeout(() => {
        updateState(prev => ({
          ...prev,
          showSuccessMessage: false
        }));
      }, 2000);

    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  useEffect(() => {
    if (selectedRoute?.id) {
      getLeads({ variables: { routeId: selectedRoute.id } });
    }
  }, [selectedRoute, getLeads]);

  // Efecto para actualizar las transacciones cuando cambie la fecha o el líder
  useEffect(() => {
    if (expensesData?.transactions) {
      const filteredTransactions = selectedLead
        ? expensesData.transactions.filter((t: Transaction) => t.lead?.id === selectedLead.id)
        : expensesData.transactions;
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
      top: rect.bottom + 4,
      left: rect.right - 160,
    };
  };

  if (routesLoading || expensesLoading) return <LoadingDots label="Loading data" />;
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

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
          gridTemplateColumns: 'repeat(4, 1fr)',
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
              <span>Registrados</span>
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
              <span>En {transactions.length + newTransactions.length} gastos</span>
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
        </div>

        {/* Add Expense Button */}
        <Button
          tone="active"
          size="medium"
          weight="bold"
          onClick={handleAddTransaction}
          isDisabled={!selectedRoute || !selectedDate || createLoading}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            borderRadius: '6px',
            backgroundColor: '#0052CC',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '36px',
            whiteSpace: 'nowrap',
            alignSelf: 'center',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
        >
          <FaPlus size={12} style={{ marginTop: '-1px' }} />
          <span>Nuevo Gasto</span>
        </Button>
      </div>

      {/* Expenses Table */}
      <Box
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          position: 'relative',
        }}
      >
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
                backgroundColor: '#F9FAFB',
                borderBottom: '1px solid #E5E7EB' 
              }}>
                <th style={styles.tableHeaderStyle}>Tipo</th>
                <th style={styles.tableHeaderStyle}>Monto</th>
                <th style={styles.tableHeaderStyle}>Fecha</th>
                <th style={styles.tableHeaderStyle}>Líder</th>
                <th style={styles.tableHeaderStyle}>Cuenta</th>
                <th style={{
                  ...styles.tableHeaderStyle,
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
                  <td style={styles.tableCellStyle}>
                    {expenseTypes.find(t => t.value === transaction.expenseSource)?.label || 'Sin tipo'}
                  </td>
                  <td style={styles.tableCellStyle}>
                    ${parseFloat(transaction.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={styles.tableCellStyle}>
                    {new Date(new Date(transaction.date).getTime() + new Date().getTimezoneOffset() * 60000).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </td>
                  <td style={styles.tableCellStyle}>{transaction.lead?.personalData?.fullName || 'Sin líder'}</td>
                  <td style={styles.tableCellStyle}>{transaction.sourceAccount?.name || '-'}</td>
                  <td style={{
                    ...styles.tableCellStyle,
                    width: '40px',
                    position: 'relative',
                  }}>
                    <Button
                      ref={el => buttonRefs.current[transaction.id] = el}
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
                  </td>
                </tr>
              ))}
              {isAddingNew && newTransactions.map((transaction, index) => (
                <tr 
                  key={`new-${index}`}
                  style={{
                    backgroundColor: '#F0F9FF',
                    position: 'relative',
                  }}
                >
                  <td style={styles.tableCellStyle}>
                    <Box css={styles.selectContainer}>
                      <Select
                        value={expenseTypes.find(t => t.value === transaction.expenseSource) || expenseTypes[0]}
                        options={expenseTypes}
                        onChange={option => handleEditTransaction(index, 'expenseType', option?.value || '')}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuPlacement="auto"
                      />
                    </Box>
                  </td>
                  <td style={styles.tableCellStyle}>
                    <TextInput
                      type="number"
                      value={transaction.amount}
                      onChange={e => handleEditTransaction(index, 'amount', e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td style={styles.tableCellStyle}>
                    {new Date(new Date(transaction.date).getTime() + new Date().getTimezoneOffset() * 60000).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </td>
                  <td style={styles.tableCellStyle}>{selectedLead?.personalData?.fullName}</td>
                  <td style={styles.tableCellStyle}>
                    <Box css={styles.selectContainer}>
                      <Select
                        value={selectedRoute?.accounts?.map(acc => ({
                          label: acc.name || '',
                          value: acc.id
                        })).find(acc => acc.value === transaction.sourceAccount?.connect?.id) || null}
                        options={selectedRoute?.accounts?.map(acc => ({
                          label: acc.name || '',
                          value: acc.id
                        })) || []}
                        onChange={option => handleEditTransaction(index, 'sourceAccount', option?.value || '')}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuPlacement="auto"
                      />
                    </Box>
                  </td>
                  <td style={{
                    ...styles.tableCellStyle,
                    width: '100px',
                  }}>
                    <Box style={{ display: 'flex', gap: '4px' }}>
                      <Button
                        tone="positive"
                        size="small"
                        onClick={() => handleSaveAllChanges()}
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
                        onClick={() => handleCancelNew(index)}
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
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

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
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                pointerEvents: 'auto',
                minWidth: '160px',
                zIndex: 10000,
              }}
            >
              <button
                onClick={() => {
                  handleOpenEditModal(transaction);
                  setActiveMenu(null);
                }}
                style={styles.menuItemStyle}
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
                  ...styles.menuItemStyle,
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
              >
                Guardar
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

  const { refetch: refetchRouteData } = useQuery(GET_ROUTES, {
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
        // Forzar la actualización del RouteLeadSelector
        setRefreshKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  return (
    <PageContainer header="Gastos">
      <Box padding="xlarge">
        <Box css={styles.selectorsContainer}>
          <Box css={styles.selectorWrapper}>
            <RouteLeadSelector
              key={refreshKey}
              selectedRoute={selectedRoute}
              selectedLead={selectedLead}
              selectedDate={selectedDate}
              onRouteSelect={handleRouteSelect}
              onLeadSelect={handleLeadSelect}
              onDateSelect={setSelectedDate}
              onRefresh={handleRefresh}
            />
          </Box>
          <Box css={styles.selectorWrapper}>
            <DatePicker
              value={selectedDate.toISOString().split('T')[0]}
              onChange={handleDateChange}
              label="Fecha"
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
