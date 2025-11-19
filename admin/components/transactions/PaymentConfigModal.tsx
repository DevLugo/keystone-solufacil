import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import type { Loan } from '../../types/loan';

interface InitialPayment {
  amount: string;
  paymentMethod: 'CASH' | 'MONEY_TRANSFER';
  comission: string;
}

interface PaymentConfigModalProps {
  loan: Loan | null;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payment: InitialPayment) => Promise<void>;
}

export const PaymentConfigModal: React.FC<PaymentConfigModalProps> = ({
  loan,
  isOpen,
  isSaving,
  onClose,
  onSave,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MONEY_TRANSFER'>('CASH');
  const [amount, setAmount] = useState<string>('0');
  const [comission, setComission] = useState<string>('8');

  if (!isOpen || !loan) return null;

  const handleSave = async () => {
    await onSave({
      amount,
      paymentMethod,
      comission,
    });
  };

  return (
    <div
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          width: '500px',
          maxWidth: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#1a1f36' }}>
          Configurar Primer Pago
        </h2>
        <p style={{ margin: '0 0 20px 0', color: '#697386', fontSize: '14px' }}>
          Cliente: {loan.borrower?.personalData?.fullName}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Método de Pago
            </label>
            <Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'MONEY_TRANSFER')}
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: '14px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: 'white',
              }}
            >
              <option value="CASH">Efectivo</option>
              <option value="MONEY_TRANSFER">Transferencia</option>
            </Select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Monto del Pago
            </label>
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: '14px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: 'white',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Comisión por Pago ($)
            </label>
            <Input
              type="number"
              placeholder="0"
              value={comission}
              onChange={(e) => setComission(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: '14px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: 'white',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Button
            onClick={onClose}
            variant="outline"
            size="default"
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            variant="default"
            size="default"
            style={{
              backgroundColor: isSaving ? '#9CA3AF' : '#16a34a',
              color: 'white',
            }}
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  );
};
