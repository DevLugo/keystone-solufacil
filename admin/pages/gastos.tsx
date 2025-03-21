/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { Select, TextInput, DatePicker } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { gql } from '@apollo/client';

// Import components
import { RouteLeadSelector } from '../components/routes/RouteLeadSelector';

// Import GraphQL queries and mutations
import { GET_ROUTES, GET_LEADS } from '../graphql/queries/routes';
import { CREATE_TRANSACTION, UPDATE_TRANSACTION } from '../graphql/mutations/transactions';
import type { Transaction, Account, Option, TransactionCreateInput, Route, Employee } from '../types/transaction';

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
  section: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
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
      padding: '12px',
      textAlign: 'left' as const,
      borderBottom: '1px solid #e5e7eb'
    },
    '& th': {
      backgroundColor: '#f9fafb',
      fontWeight: 600
    }
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px'
  },
  selectContainer: {
    position: 'relative' as const,
    '& .select__menu': {
      zIndex: 9999
    }
  }
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
}

interface FormState {
  newTransactions: TransactionCreateInput[];
  transactions: Transaction[];
  focusedInput: string | null;
  editedTransactions: { [key: string]: Transaction };
  showSuccessMessage: boolean;
  expandedSection: 'existing' | 'new' | null;
}

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export const CreateExpensesForm = ({ selectedDate, selectedRoute, selectedLead }: GastosProps) => {
  const [state, setState] = useState<FormState>({
    newTransactions: [],
    transactions: [],
    focusedInput: null,
    editedTransactions: {},
    showSuccessMessage: false,
    expandedSection: 'existing' // Por defecto, la sección de gastos existentes está expandida
  });

  const { 
    newTransactions, transactions, focusedInput, editedTransactions, showSuccessMessage, expandedSection 
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

  const { data: routesData, loading: routesLoading, error: routesError } = useQuery(GET_ROUTES, {
    variables: { where: {} },
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery(GET_LEADS);

  const { data: expensesData, loading: expensesLoading, refetch: refetchExpenses } = useQuery(GET_EXPENSES_BY_DATE, {
    variables: { 
      date: selectedDate.toISOString().split('T')[0] + 'T00:00:00.000Z',
      nextDate: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 60000).toISOString() // Restamos 1 minuto
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

  const router = useRouter();

  const handleAddTransaction = () => {
    if (!selectedRoute || !selectedDate) {
      alert('Por favor seleccione una ruta y una fecha');
      return;
    }

    const routeData = selectedRoute as unknown as Route;
    const routeAccount = routeData?.account;
    console.log("routeAccount:", routeData);
    if (!routeAccount || routeAccount.type !== 'EMPLOYEE_CASH_FUND') {
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
      expandedSection: 'new' // Expandimos la sección de nuevos gastos
    });
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
      default: {
        if (field in transaction) {
          (transaction as any)[field] = value;
        }
      }
    }

    updatedTransactions[index] = transaction;
    updateState({ newTransactions: updatedTransactions });
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

      // Refrescar el listado de transacciones
      await refetchExpenses();

      // Mostrar mensaje de éxito
      updateState({ showSuccessMessage: true });
      
      // Limpiar el estado después de 2 segundos
      setTimeout(() => {
        updateState({ 
          showSuccessMessage: false,
          newTransactions: [],
          editedTransactions: {}
        });
      }, 2000);

    } catch (error) {
      console.error('Error saving changes:', error);
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

  if (routesLoading || expensesLoading) return <LoadingDots label="Loading data" />;
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

  const totalAmount = transactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0) +
    newTransactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount || '0'), 0);

  return (
    <Box paddingTop="xlarge">
      {showSuccessMessage && (
        <Box
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '16px 24px',
            backgroundColor: '#10B981',
            borderRadius: '8px',
            color: 'white',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <span style={{ fontWeight: 'bold' }}>¡Cambios guardados exitosamente!</span>
        </Box>
      )}

      <Box
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Box style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Total: ${totalAmount.toFixed(2)}</h3>
        </Box>
      </Box>

      {expensesLoading ? (
        <Box
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '48px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          <LoadingDots label="Cargando transacciones..." />
        </Box>
      ) : (
        <>
          <Box
            style={{
              marginBottom: '24px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'visible',
            }}
          >
            <Box
              padding="large"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: expandedSection === 'existing' ? '1px solid #e5e7eb' : 'none'
              }}
            >
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer'
                }}
                onClick={() => toggleSection('existing')}
              >
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  Gastos Existentes ({transactions.length})
                </h3>
              </Box>
              <span style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => toggleSection('existing')}>
                {expandedSection === 'existing' ? '▼' : '▶'}
              </span>
            </Box>
            {expandedSection === 'existing' && transactions.length > 0 && (
              <Box padding="large" paddingTop="medium">
                <table css={styles.table}>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Monto</th>
                      <th>Fecha</th>
                      <th>Líder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction, index) => {
                      const editedTransaction = editedTransactions[transaction.id] || transaction;
                      return (
                        <tr key={transaction.id}>
                          <td>
                            <Box css={styles.selectContainer}>
                              <Select
                                value={expenseTypes.find(t => t.value === editedTransaction.expenseSource) || expenseTypes[0]}
                                options={expenseTypes}
                                onChange={option => handleEditExistingTransaction(transaction.id, 'expenseSource', option?.value || '')}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                menuPlacement="auto"
                              />
                            </Box>
                          </td>
                          <td>
                            <TextInput
                              type="number"
                              value={editedTransaction.amount}
                              onChange={e => handleEditExistingTransaction(transaction.id, 'amount', e.target.value)}
                              placeholder="0.00"
                            />
                          </td>
                          <td>{new Date(transaction.date).toLocaleDateString()}</td>
                          <td>{transaction.lead?.personalData?.fullName || 'Sin líder'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            )}
          </Box>

          <Box
            style={{
              marginBottom: '24px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'visible',
            }}
          >
            <Box
              padding="large"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: expandedSection === 'new' ? '1px solid #e5e7eb' : 'none'
              }}
            >
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer'
                }}
                onClick={() => toggleSection('new')}
              >
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  Nuevos Gastos ({newTransactions.length})
                </h3>
                <Button
                  tone="active"
                  weight="bold"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddTransaction();
                  }}
                  isDisabled={!selectedRoute || !selectedDate || createLoading}
                  style={{ padding: '8px 16px' }}
                >
                  {createLoading ? <LoadingDots label="Agregando..." /> : 'Agregar Gasto'}
                </Button>
              </Box>
              <span style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => toggleSection('new')}>
                {expandedSection === 'new' ? '▼' : '▶'}
              </span>
            </Box>
            {expandedSection === 'new' && newTransactions.length > 0 && (
              <Box padding="large" paddingTop="medium">
                <table css={styles.table}>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Monto</th>
                      <th>Fecha</th>
                      <th>Líder</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newTransactions.map((transaction, index) => (
                      <tr key={index}>
                        <td>
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
                        <td>
                          <TextInput
                            type="number"
                            value={transaction.amount}
                            onChange={e => handleEditTransaction(index, 'amount', e.target.value)}
                            placeholder="0.00"
                          />
                        </td>
                        <td>{new Date(transaction.date).toLocaleDateString()}</td>
                        <td>{selectedLead?.personalData?.fullName}</td>
                        <td>
                          <Button
                            tone="negative"
                            size="small"
                            onClick={() => updateState({ newTransactions: newTransactions.filter((_, i) => i !== index) })}
                          >
                            Eliminar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
          </Box>

          {(newTransactions.length > 0 || Object.keys(editedTransactions).length > 0) && (
            <Box
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '16px',
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <Button
                tone="active"
                weight="bold"
                onClick={() => updateState({ newTransactions: [], editedTransactions: {} })}
                isDisabled={createLoading || updateLoading}
                style={{ padding: '8px 24px', minWidth: '150px' }}
              >
                Limpiar Cambios
              </Button>
              <Button
                tone="positive"
                weight="bold"
                onClick={handleSaveAllChanges}
                isLoading={createLoading || updateLoading}
                style={{ padding: '8px 24px', minWidth: '150px' }}
              >
                {createLoading || updateLoading ? (
                  <LoadingDots label="Guardando..." />
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default function ExpensesPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedLead, setSelectedLead] = useState<Employee | null>(null);

  const handleRouteSelect = (route: Route | null) => {
    setSelectedRoute(route);
    setSelectedLead(null);
  };

  const handleLeadSelect = (lead: Employee | null) => {
    setSelectedLead(lead);
  };

  const handleDateChange = (date: string) => {
    const selectedDate = new Date(date);
    // Ajustamos la fecha para que sea al inicio del día en la zona horaria local
    selectedDate.setHours(0, 0, 0, 0);
    setSelectedDate(selectedDate);
  };

  return (
    <PageContainer header="Gastos">
      <Box padding="xlarge">
        <Box css={styles.selectorsContainer}>
          <Box css={styles.selectorWrapper}>
            <RouteLeadSelector
              selectedRoute={selectedRoute}
              selectedLead={selectedLead}
              onRouteSelect={handleRouteSelect}
              onLeadSelect={handleLeadSelect}
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
        />
      </Box>
    </PageContainer>
  );
}
