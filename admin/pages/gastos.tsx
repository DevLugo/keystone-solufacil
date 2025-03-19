/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { Select, TextInput } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';

// Import components
import { RouteLeadSelector } from '../components/routes/RouteLeadSelector';

// Import GraphQL queries and mutations
import { GET_ROUTES, GET_LEADS } from '../graphql/queries/routes';
import { CREATE_TRANSACTION } from '../graphql/mutations/transactions';
import type { Transaction, Account, Option, TransactionCreateInput } from '../types/transaction';

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
  }
};

const expenseTypes = [
  { label: 'Seleccionar tipo de gasto', value: '' },
  { label: 'Viáticos', value: 'VIATIC' },
  { label: 'Gasolina', value: 'GASOLINE' },
  { label: 'Hospedaje', value: 'ACCOMMODATION' },
  { label: 'Mantenimiento de Vehículo', value: 'VEHICULE_MAINTENANCE' },
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

export interface Route {
  id: string;
  name: string;
  account: {
    id: string;
    type: string;
  };
}

export interface Employee {
  id: string;
  type: string;
  personalData: {
    fullName: string;
  };
  routes: {
    account: {
      id: string;
      type: string;
    };
  };
}

export interface GastosProps {
  selectedDate: Date;
  selectedRoute: Route | null;
  selectedLead: Employee | null;
}

interface FormState {
  newTransactions: TransactionCreateInput[];
  transactions: Transaction[];
  focusedInput: string | null;
}

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export const CreateExpensesForm = ({ selectedDate, selectedRoute, selectedLead }: GastosProps) => {
  const [state, setState] = useState<FormState>({
    newTransactions: [],
    transactions: [],
    focusedInput: null
  });

  const { 
    newTransactions, transactions, focusedInput 
  } = state;

  const updateState = (updates: Partial<FormState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const { data: routesData, loading: routesLoading, error: routesError } = useQuery(GET_ROUTES, {
    variables: { where: {} },
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery(GET_LEADS);

  const [createTransaction, { loading: createLoading }] = useMutation(CREATE_TRANSACTION);

  useEffect(() => {
    if (selectedRoute?.value) {
      getLeads({ variables: { routeId: selectedRoute.value } });
    }
  }, [selectedRoute, getLeads]);

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
      ...(selectedLead && { lead: { connect: { id: selectedLead.value } } })
    };

    updateState({
      newTransactions: [...newTransactions, newTransaction]
    });
  };

  const handleSubmit = async () => {
    if (newTransactions.length === 0) {
      alert('No hay gastos para guardar');
      return;
    }

    // Validar que todos los gastos tengan los campos requeridos
    const invalidTransactions = newTransactions.filter(
      t => !t.amount || !t.expenseSource || parseFloat(t.amount) <= 0
    );

    if (invalidTransactions.length > 0) {
      alert('Por favor complete todos los campos requeridos para cada gasto');
      return;
    }

    try {
      // Crear las transacciones una por una
      for (const transaction of newTransactions) {
        await createTransaction({
          variables: { data: transaction }
        });
      }

      router.push('/transactions');
    } catch (error) {
      console.error('Error creating transactions:', error);
    }
  };

  const handleRemoveTransaction = (index: number) => {
    const updatedTransactions = newTransactions.filter((_, i) => i !== index);
    updateState({ newTransactions: updatedTransactions });
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

  if (routesLoading) return <LoadingDots label="Loading routes" />;
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

  const totalAmount = newTransactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount || '0'), 0);

  return (
    <Box paddingTop="xlarge">
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
          <Button
            tone="active"
            weight="bold"
            onClick={handleAddTransaction}
            isDisabled={!selectedRoute || !selectedDate}
            style={{ padding: '8px 16px' }}
          >
            Agregar Gasto
          </Button>
        </Box>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Total: ${totalAmount.toFixed(2)}</h3>
        </Box>
      </Box>

      {newTransactions.length > 0 && (
        <Box
          style={{
            marginBottom: '24px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'visible',
          }}
        >
          <Box padding="large">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>Gastos Registrados</h3>
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
                      <Box style={{ position: 'relative', zIndex: 1000 - index }}>
                        <Select
                          value={expenseTypes.find(t => t.value === transaction.expenseSource) || expenseTypes[0]}
                          options={expenseTypes}
                          onChange={option => handleEditTransaction(index, 'expenseType', option?.value || '')}
                          menuPortalTarget={document.body}
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
                    <td>{selectedLead?.label}</td>
                    <td>
                      <Button
                        tone="negative"
                        size="small"
                        onClick={() => handleRemoveTransaction(index)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>
      )}

      {newTransactions.length > 0 && (
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
            onClick={() => updateState({ newTransactions: [] })}
            style={{ padding: '8px 24px', minWidth: '150px' }}
          >
            Limpiar Lista
          </Button>
          <Button
            tone="positive"
            weight="bold"
            onClick={handleSubmit}
            isLoading={createLoading}
            style={{ padding: '8px 24px', minWidth: '150px' }}
          >
            Guardar Gastos
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default function ExpensesPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRoute, setSelectedRoute] = useState<Option | null>(null);
  const [selectedLead, setSelectedLead] = useState<Option | null>(null);

  return (
    <CreateExpensesForm 
      selectedDate={selectedDate}
      selectedRoute={selectedRoute}
      selectedLead={selectedLead}
    />
  );
}
