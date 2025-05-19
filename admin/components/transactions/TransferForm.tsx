/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { Box, jsx } from '@keystone-ui/core';
import { useMutation, useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { Select } from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { FieldContainer, FieldLabel, TextInput } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { AlertDialog } from '@keystone-ui/modals';
import type { Route, Employee } from '../../types/transaction';
import { formatCurrency } from '../../utils/formatters';

// GraphQL para obtener las cuentas disponibles
const GET_ACCOUNTS = gql`
  query GetAccounts($routeId: ID) {
    accounts(where: { route: { id: { equals: $routeId } } }) {
      id
      name
      type
      amount
    }
  }
`;

// Mutation para crear una transacción de transferencia
const CREATE_TRANSFER = gql`
  mutation CreateTransaction($data: TransactionCreateInput!) {
    createTransaction(data: $data) {
      id
      amount
      type
      date
    }
  }
`;

interface TransferFormProps {
  selectedDate: Date;
  selectedRoute: Route | null;
  selectedLead: Employee | null;
  refreshKey: number;
  onTransferComplete?: () => void;
}

interface Account {
  id: string;
  name: string;
  type: string;
  amount: string | number;
}

interface AccountOption {
  label: string;
  value: string;
  data: Account;
}

export const TransferForm: React.FC<TransferFormProps> = ({
  selectedDate,
  selectedRoute,
  selectedLead,
  refreshKey,
  onTransferComplete
}) => {
  const [sourceAccount, setSourceAccount] = useState<string | null>(null);
  const [destinationAccount, setDestinationAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Consulta para obtener las cuentas basadas en la ruta seleccionada
  const { data, loading: accountsLoading } = useQuery(GET_ACCOUNTS, {
    variables: { routeId: selectedRoute?.id || null },
    skip: !selectedRoute?.id,
    fetchPolicy: 'network-only',
  });

  // Mutation para crear la transferencia
  const [createTransfer, { loading: transferLoading }] = useMutation(CREATE_TRANSFER);

  // Resetear valores cuando cambie la ruta o la pestaña
  useEffect(() => {
    setSourceAccount(null);
    setDestinationAccount(null);
    setAmount('');
    setDescription('');
    setErrorMessage(null);
  }, [selectedRoute, refreshKey]);

  // Opciones para el selector de cuentas
  const accountOptions: AccountOption[] = data?.accounts?.map((account: Account) => ({
    label: `${account.name} (${formatCurrency(account.amount)})`,
    value: account.id,
    data: account
  })) || [];

  // Filtrar las cuentas de origen y destino para no mostrar la misma opción
  const sourceOptions = accountOptions;
  const destinationOptions = sourceAccount
    ? accountOptions.filter((option: AccountOption) => option.value !== sourceAccount)
    : accountOptions;

  // Obtener los datos de la cuenta de origen
  const sourceAccountData = sourceAccount 
    ? data?.accounts?.find((acc: Account) => acc.id === sourceAccount)
    : null;
    
  // Obtener el saldo disponible en la cuenta
  const availableBalance = sourceAccountData 
    ? parseFloat(sourceAccountData.amount.toString()) 
    : 0;
  
  // Verificar si el monto excede el saldo disponible
  const isAmountValid = !amount || parseFloat(amount) <= availableBalance;
  
  // Mensaje de error si el monto excede el saldo
  const amountErrorMessage = !isAmountValid 
    ? `Monto excede el saldo disponible (${formatCurrency(availableBalance)})` 
    : null;
  
  // Verificar si los datos están completos para habilitar el botón de envío
  const isFormValid = sourceAccount && destinationAccount && amount && parseFloat(amount) > 0 && isAmountValid;

  // Manejar la transferencia
  const handleTransfer = async () => {
    if (!isFormValid || !selectedRoute) {
      setErrorMessage('Por favor completa todos los campos requeridos.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const numericAmount = parseFloat(amount);

      // Crear la transferencia
      await createTransfer({
        variables: {
          data: {
            amount: numericAmount.toString(), // Convertir a string para cumplir con el tipo Decimal
            date: selectedDate.toISOString(),
            type: 'TRANSFER',
            description: description || 'Transferencia entre cuentas',
            sourceAccount: { connect: { id: sourceAccount } },
            destinationAccount: { connect: { id: destinationAccount } },
            lead: selectedLead ? { connect: { id: selectedLead.id } } : undefined
          }
        }
      });

      setShowSuccess(true);
      
      // Resetear formulario
      setSourceAccount(null);
      setDestinationAccount(null);
      setAmount('');
      setDescription('');
      
      // Notificar que la transferencia se completó
      if (onTransferComplete) {
        onTransferComplete();
      }
    } catch (error) {
      console.error('Error al realizar la transferencia:', error);
      setErrorMessage('Error al realizar la transferencia. Por favor intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (accountsLoading) {
    return (
      <Box css={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
        <LoadingDots label="Cargando cuentas..." />
      </Box>
    );
  }

  return (
    <Box css={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
      <h3 css={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Transferencia entre Cuentas</h3>
      
      {!selectedRoute && (
        <Box css={{ padding: '16px', backgroundColor: '#FFFBEA', borderRadius: '4px', marginBottom: '16px' }}>
          Por favor selecciona una ruta para ver las cuentas disponibles.
        </Box>
      )}
      
      <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <FieldContainer>
          <FieldLabel>Cuenta de Origen</FieldLabel>
          <Select
            value={sourceOptions.find(option => option.value === sourceAccount) || null}
            options={sourceOptions}
            onChange={(option: AccountOption | null) => {
              setSourceAccount(option?.value || null);
              // Si se selecciona la misma cuenta como destino, deseleccionarla
              if (option?.value === destinationAccount) {
                setDestinationAccount(null);
              }
            }}
            placeholder="Seleccionar cuenta de origen"
            isDisabled={!selectedRoute || isSubmitting}
          />
        </FieldContainer>
        
        <FieldContainer>
          <FieldLabel>Cuenta de Destino</FieldLabel>
          <Select
            value={destinationOptions.find(option => option.value === destinationAccount) || null}
            options={destinationOptions}
            onChange={(option: AccountOption | null) => setDestinationAccount(option?.value || null)}
            placeholder="Seleccionar cuenta de destino"
            isDisabled={!sourceAccount || isSubmitting}
          />
        </FieldContainer>
      </Box>
      
      <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <FieldContainer>
          <FieldLabel>Monto a Transferir</FieldLabel>
          <TextInput
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Ingresa el monto"
            disabled={!sourceAccount || !destinationAccount || isSubmitting}
            min="0"
            step="0.01"
            invalid={amount !== '' && !isAmountValid}
          />
          {sourceAccountData && (
            <div css={{ fontSize: '13px', color: '#4B5563', marginTop: '4px' }}>
              Saldo disponible: {formatCurrency(availableBalance)}
            </div>
          )}
          {amount !== '' && !isAmountValid && (
            <div css={{ fontSize: '13px', color: '#DC2626', marginTop: '4px' }}>
              {amountErrorMessage}
            </div>
          )}
        </FieldContainer>
        
        <FieldContainer>
          <FieldLabel>Descripción (Opcional)</FieldLabel>
          <TextInput
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descripción de la transferencia"
            disabled={isSubmitting}
          />
        </FieldContainer>
      </Box>
      
      {errorMessage && (
        <Box css={{ padding: '12px', backgroundColor: '#FEE2E2', color: '#B91C1C', borderRadius: '4px', marginBottom: '16px' }}>
          {errorMessage}
        </Box>
      )}
      
      <Box css={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="medium"
          tone="active"
          weight="bold"
          onClick={handleTransfer}
          isDisabled={!isFormValid || isSubmitting}
          isLoading={isSubmitting}
        >
          Realizar Transferencia
        </Button>
      </Box>
      
      {showSuccess && (
        <AlertDialog
          title="Transferencia completada"
          isOpen={showSuccess}
          actions={{
            confirm: {
              label: 'Aceptar',
              action: () => setShowSuccess(false),
            },
          }}
        >
          La transferencia se ha realizado correctamente.
        </AlertDialog>
      )}
    </Box>
  );
};

export default TransferForm; 