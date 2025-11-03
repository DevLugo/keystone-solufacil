import React, { useState } from 'react';
import { Box, Text } from '@keystone-ui/core';
import { TextInput, Select } from '@keystone-ui/fields';
import { AlertDialog } from '@keystone-ui/modals';
import { calculateWeeklyPaymentAmount } from '../../utils/loanCalculations';
import type { Loan } from '../../types/loan';

interface InitialPayment {
  amount: string;
  paymentMethod: 'CASH' | 'MONEY_TRANSFER';
  comission: string;
}

interface PaymentConfigModalProps {
  isOpen: boolean;
  selectedLoan: Loan | null;
  initialPayments: Record<string, InitialPayment>;
  onClose: () => void;
  onSave: (payment: InitialPayment) => void;
  isSaving: boolean;
}

const paymentMethods = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Transferencia', value: 'MONEY_TRANSFER' },
];

export const PaymentConfigModal: React.FC<PaymentConfigModalProps> = ({
  isOpen,
  selectedLoan,
  initialPayments,
  onClose,
  onSave,
  isSaving
}) => {
  const [localPayment, setLocalPayment] = useState<InitialPayment>(() => {
    if (!selectedLoan) return { amount: '0', paymentMethod: 'CASH', comission: '8' };
    
    // Verificar si ya existe un pago configurado para este préstamo
    const existingPayment = initialPayments[selectedLoan.id];
    if (existingPayment) {
      return existingPayment;
    }
    
    // Si no existe, calcular valores por defecto
    const weeklyAmount = calculateWeeklyPaymentAmount(
      selectedLoan.requestedAmount?.toString() || '0',
      selectedLoan.loantype?.rate?.toString() || '0',
      selectedLoan.loantype?.weekDuration || 0
    );
    
    const comission = Math.round(parseFloat((selectedLoan.loantype as any)?.loanPaymentComission || '0')) || 8;
    
    return {
      amount: weeklyAmount,
      paymentMethod: 'CASH',
      comission: comission.toString()
    };
  });

  // Actualizar el estado local cuando cambie el préstamo seleccionado
  React.useEffect(() => {
    if (selectedLoan) {
      const existingPayment = initialPayments[selectedLoan.id];
      if (existingPayment) {
        setLocalPayment(existingPayment);
      } else {
        const weeklyAmount = calculateWeeklyPaymentAmount(
          selectedLoan.requestedAmount?.toString() || '0',
          selectedLoan.loantype?.rate?.toString() || '0',
          selectedLoan.loantype?.weekDuration || 0
        );
        
        const comission = Math.round(parseFloat((selectedLoan.loantype as any)?.loanPaymentComission || '0')) || 8;
        
        setLocalPayment({
          amount: weeklyAmount,
          paymentMethod: 'CASH',
          comission: comission.toString()
        });
      }
    }
  }, [selectedLoan, initialPayments]);

  const handleSave = () => {
    onSave(localPayment);
  };

  const handlePaymentMethodChange = (option: any) => {
    setLocalPayment(prev => ({
      ...prev,
      paymentMethod: option.value
    }));
  };

  if (!selectedLoan) return null;

  return (
    <AlertDialog
      title="Configurar Primer Pago"
      isOpen={isOpen}
      actions={{
        confirm: {
          label: isSaving ? 'Guardando...' : 'Guardar',
          action: handleSave,
          loading: isSaving
        },
        cancel: {
          label: 'Cancelar',
          action: onClose
        }
      }}
    >
      <Box padding="large">
        <div style={{ marginBottom: '16px' }}>
          <Text weight="medium" style={{ marginBottom: '8px', display: 'block' }}>
            Cliente: {selectedLoan.borrower?.personalData?.fullName}
          </Text>
          <Text style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
            Monto semanal: ${calculateWeeklyPaymentAmount(
              selectedLoan.requestedAmount?.toString() || '0',
              selectedLoan.loantype?.rate?.toString() || '0',
              selectedLoan.loantype?.weekDuration || 0
            )}
          </Text>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <Text weight="medium" style={{ marginBottom: '8px', display: 'block' }}>
            Método de Pago
          </Text>
          <Select
            value={paymentMethods.find(m => m.value === localPayment.paymentMethod) || null}
            options={paymentMethods}
            onChange={handlePaymentMethodChange}
            placeholder="Selecciona método de pago"
          />
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <Text weight="medium" style={{ marginBottom: '8px', display: 'block' }}>
            Monto del Pago
          </Text>
          <TextInput
            type="number"
            placeholder="0.00"
            value={localPayment.amount}
            onChange={(e) => {
              setLocalPayment(prev => ({
                ...prev,
                amount: e.target.value
              }));
            }}
            style={{ width: '100%' }}
          />
        </div>
        
        <div>
          <Text weight="medium" style={{ marginBottom: '8px', display: 'block' }}>
            Comisión por Pago ($)
          </Text>
          <TextInput
            type="number"
            placeholder="0.00"
            value={localPayment.comission}
            onChange={(e) => {
              setLocalPayment(prev => ({
                ...prev,
                comission: e.target.value
              }));
            }}
            style={{ width: '100%' }}
          />
        </div>
      </Box>
    </AlertDialog>
  );
};
