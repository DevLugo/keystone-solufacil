/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { jsx } from '@keystone-ui/core';
import { useMutation, useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import type { Route, Employee } from '../../types/transaction';
import { formatCurrency } from '../../utils/formatters';

// Theme Context
import { useTheme, useThemeColors } from '../../contexts/ThemeContext';

// Import shadcn components
import { Button } from '../ui/button';

// GraphQL para obtener las cuentas disponibles
const GET_ACCOUNTS = gql`
  query GetAccounts($routeId: ID) {
    accounts(where: { routes: { some: { id: { equals: $routeId } } } }) {
      id
      name
      type
      amount
    }
  }
`;

// Mutation para crear una transacción de transferencia o inversión
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

export const TransferFormNew: React.FC<TransferFormProps> = ({
  selectedDate,
  selectedRoute,
  selectedLead,
  refreshKey,
  onTransferComplete
}) => {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

  const [sourceAccount, setSourceAccount] = useState<string | null>(null);
  const [destinationAccount, setDestinationAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCapitalInvestment, setIsCapitalInvestment] = useState<boolean>(false);

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

  // Resetear cuenta de origen cuando se activa inversión de capital
  useEffect(() => {
    if (isCapitalInvestment) {
      setSourceAccount(null);
    }
  }, [isCapitalInvestment]);

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

  // Verificar si el monto excede el saldo disponible (solo para transferencias)
  const isAmountValid = isCapitalInvestment || !amount || parseFloat(amount) <= availableBalance;

  // Mensaje de error si el monto excede el saldo
  const amountErrorMessage = !isAmountValid
    ? `Monto excede el saldo disponible (${formatCurrency(availableBalance)})`
    : null;

  // Verificar si los datos están completos para habilitar el botón de envío
  const isFormValid = isCapitalInvestment
    ? (destinationAccount && amount && parseFloat(amount) > 0)
    : (sourceAccount && destinationAccount && amount && parseFloat(amount) > 0 && isAmountValid);

  // Manejar la transferencia o inversión
  const handleTransfer = async () => {
    if (!isFormValid || !selectedRoute) {
      setErrorMessage('Por favor completa todos los campos requeridos.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const numericAmount = parseFloat(amount);

      // Crear la transacción según el tipo
      const transactionData = isCapitalInvestment ? {
        amount: numericAmount.toString(),
        date: selectedDate.toISOString(),
        type: 'INCOME',
        incomeSource: 'MONEY_INVESMENT',
        description: description || 'Inversión de capital',
        destinationAccount: { connect: { id: destinationAccount } },
        route: { connect: { id: selectedRoute.id } },
        snapshotRouteId: selectedRoute.id,
        lead: selectedLead ? { connect: { id: selectedLead.id } } : undefined
      } : {
        amount: numericAmount.toString(),
        date: selectedDate.toISOString(),
        type: 'TRANSFER',
        description: description || 'Transferencia entre cuentas',
        sourceAccount: { connect: { id: sourceAccount } },
        destinationAccount: { connect: { id: destinationAccount } },
        route: { connect: { id: selectedRoute.id } },
        snapshotRouteId: selectedRoute.id,
        lead: selectedLead ? { connect: { id: selectedLead.id } } : undefined
      };

      await createTransfer({
        variables: {
          data: transactionData
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
      console.error('Error al realizar la operación:', error);
      setErrorMessage('Error al realizar la operación. Por favor intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (accountsLoading) {
    return (
      <div css={{
        display: 'flex',
        justifyContent: 'center',
        padding: '32px',
        color: themeColors.foreground,
        transition: 'color 0.3s ease',
      }}>
        Cargando cuentas...
      </div>
    );
  }

  return (
    <div css={{
      backgroundColor: themeColors.card,
      padding: '24px',
      borderRadius: '8px',
      boxShadow: isDark ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease',
    }}>
      <h3 css={{
        fontSize: '18px',
        fontWeight: 600,
        marginBottom: '20px',
        color: themeColors.foreground,
        transition: 'color 0.3s ease',
      }}>
        {isCapitalInvestment ? 'Inversión de Capital' : 'Transferencia entre Cuentas'}
      </h3>

      {!selectedRoute && (
        <div css={{
          padding: '16px',
          backgroundColor: themeColors.warningBackground,
          borderRadius: '4px',
          marginBottom: '16px',
          color: themeColors.warningForeground,
          transition: 'all 0.3s ease',
        }}>
          Por favor selecciona una ruta para ver las cuentas disponibles.
        </div>
      )}

      {/* Checkbox para inversión de capital */}
      <div css={{ marginBottom: '20px' }}>
        <label css={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: '14px',
          color: themeColors.foreground,
          transition: 'color 0.3s ease',
        }}>
          <input
            type="checkbox"
            checked={isCapitalInvestment}
            onChange={(e) => setIsCapitalInvestment(e.target.checked)}
            css={{ marginRight: '8px' }}
            disabled={isSubmitting}
            data-testid="capital-investment-checkbox"
          />
          Inversión de Capital
        </label>
        {isCapitalInvestment && (
          <div css={{
            fontSize: '12px',
            color: themeColors.foregroundMuted,
            marginTop: '4px',
            marginLeft: '20px',
            transition: 'color 0.3s ease',
          }}>
            Cuando está activo, no se requiere cuenta de origen (el dinero ingresa al sistema)
          </div>
        )}
      </div>

      <div css={{
        display: 'grid',
        gridTemplateColumns: isCapitalInvestment ? '1fr' : 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {!isCapitalInvestment && (
          <div>
            <label css={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: themeColors.foreground,
              marginBottom: '8px',
              transition: 'color 0.3s ease',
            }}>
              Cuenta de Origen
            </label>
            <select
              value={sourceAccount || ''}
              onChange={(e) => {
                const value = e.target.value || null;
                setSourceAccount(value);
                if (value === destinationAccount) {
                  setDestinationAccount(null);
                }
              }}
              disabled={!selectedRoute || isSubmitting}
              data-testid="source-account"
              css={{
                width: '100%',
                padding: '8px 12px',
                border: `2px solid ${themeColors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                color: themeColors.foreground,
                backgroundColor: themeColors.card,
                fontWeight: '500',
                transition: 'all 0.2s ease',
                outline: 'none',
                cursor: selectedRoute && !isSubmitting ? 'pointer' : 'not-allowed',
                opacity: selectedRoute && !isSubmitting ? 1 : 0.6,
                '&:focus': {
                  borderColor: themeColors.primary,
                  boxShadow: `0 0 0 3px ${themeColors.primary}20`,
                },
                '&:hover': {
                  borderColor: selectedRoute && !isSubmitting ? themeColors.borderHover : themeColors.border,
                }
              }}
            >
              <option value="">Seleccionar cuenta de origen</option>
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label css={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: themeColors.foreground,
            marginBottom: '8px',
            transition: 'color 0.3s ease',
          }}>
            Cuenta de Destino
          </label>
          <select
            value={destinationAccount || ''}
            onChange={(e) => setDestinationAccount(e.target.value || null)}
            disabled={(!sourceAccount && !isCapitalInvestment) || !selectedRoute || isSubmitting}
            data-testid="destination-account"
            css={{
              width: '100%',
              padding: '8px 12px',
              border: `2px solid ${themeColors.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              color: themeColors.foreground,
              backgroundColor: themeColors.card,
              fontWeight: '500',
              transition: 'all 0.2s ease',
              outline: 'none',
              cursor: (sourceAccount || isCapitalInvestment) && selectedRoute && !isSubmitting ? 'pointer' : 'not-allowed',
              opacity: (sourceAccount || isCapitalInvestment) && selectedRoute && !isSubmitting ? 1 : 0.6,
              '&:focus': {
                borderColor: themeColors.primary,
                boxShadow: `0 0 0 3px ${themeColors.primary}20`,
              },
              '&:hover': {
                borderColor: (sourceAccount || isCapitalInvestment) && selectedRoute && !isSubmitting ? themeColors.borderHover : themeColors.border,
              }
            }}
          >
            <option value="">Seleccionar cuenta de destino</option>
            {destinationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div css={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label css={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: themeColors.foreground,
            marginBottom: '8px',
            transition: 'color 0.3s ease',
          }}>
            {isCapitalInvestment ? 'Monto de Inversión' : 'Monto a Transferir'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={isCapitalInvestment ? 'Ingresa el monto a invertir' : 'Ingresa el monto'}
            disabled={(!sourceAccount && !isCapitalInvestment) || !destinationAccount || isSubmitting}
            min="0"
            step="1"
            data-testid="amount-input"
            css={{
              width: '100%',
              padding: '8px 12px',
              border: `2px solid ${amount !== '' && !isAmountValid ? themeColors.destructive : themeColors.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              color: themeColors.foreground,
              backgroundColor: themeColors.card,
              fontWeight: '500',
              transition: 'all 0.2s ease',
              outline: 'none',
              '&:focus': {
                borderColor: amount !== '' && !isAmountValid ? themeColors.destructive : themeColors.primary,
                boxShadow: `0 0 0 3px ${amount !== '' && !isAmountValid ? themeColors.destructive : themeColors.primary}20`,
              },
              '&:disabled': {
                opacity: 0.6,
                cursor: 'not-allowed'
              }
            }}
          />
          {!isCapitalInvestment && sourceAccountData && (
            <div css={{
              fontSize: '13px',
              color: themeColors.foregroundMuted,
              marginTop: '4px',
              transition: 'color 0.3s ease',
            }}>
              Saldo disponible: {formatCurrency(availableBalance)}
            </div>
          )}
          {amount !== '' && !isAmountValid && (
            <div css={{
              fontSize: '13px',
              color: themeColors.destructive,
              marginTop: '4px',
              transition: 'color 0.3s ease',
            }} data-testid="amount-error">
              {amountErrorMessage}
            </div>
          )}
        </div>

        <div>
          <label css={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: themeColors.foreground,
            marginBottom: '8px',
            transition: 'color 0.3s ease',
          }}>
            Descripción (Opcional)
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={isCapitalInvestment ? 'Descripción de la inversión' : 'Descripción de la transferencia'}
            disabled={isSubmitting}
            data-testid="description-input"
            css={{
              width: '100%',
              padding: '8px 12px',
              border: `2px solid ${themeColors.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              color: themeColors.foreground,
              backgroundColor: themeColors.card,
              fontWeight: '500',
              transition: 'all 0.2s ease',
              outline: 'none',
              '&:focus': {
                borderColor: themeColors.primary,
                boxShadow: `0 0 0 3px ${themeColors.primary}20`,
              },
              '&:disabled': {
                opacity: 0.6,
                cursor: 'not-allowed'
              }
            }}
          />
        </div>
      </div>

      {errorMessage && (
        <div css={{
          padding: '12px',
          backgroundColor: themeColors.destructiveBackground,
          color: themeColors.destructiveForeground,
          borderRadius: '4px',
          marginBottom: '16px',
          transition: 'all 0.3s ease',
        }}>
          {errorMessage}
        </div>
      )}

      <div css={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          onClick={handleTransfer}
          disabled={!isFormValid || isSubmitting}
          data-testid="submit-button"
        >
          {isSubmitting ? 'Procesando...' : (isCapitalInvestment ? 'Realizar Inversión' : 'Realizar Transferencia')}
        </Button>
      </div>

      {showSuccess && (
        <div css={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }} onClick={() => setShowSuccess(false)}>
          <div css={{
            backgroundColor: themeColors.card,
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease',
          }} onClick={(e) => e.stopPropagation()} data-testid="success-modal">
            <h3 css={{
              fontSize: '18px',
              fontWeight: '600',
              color: themeColors.foreground,
              marginBottom: '12px',
              transition: 'color 0.3s ease',
            }}>
              {isCapitalInvestment ? 'Inversión completada' : 'Transferencia completada'}
            </h3>
            <p css={{
              fontSize: '14px',
              color: themeColors.foregroundMuted,
              marginBottom: '20px',
              transition: 'color 0.3s ease',
            }}>
              {isCapitalInvestment
                ? 'La inversión de capital se ha registrado correctamente.'
                : 'La transferencia se ha realizado correctamente.'
              }
            </p>
            <div css={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowSuccess(false)}>
                Aceptar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferFormNew;
