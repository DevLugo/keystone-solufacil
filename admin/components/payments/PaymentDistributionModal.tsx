/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { AlertDialog } from '@keystone-ui/modals';
import { TextInput } from '@keystone-ui/fields';
import { PaymentDistribution } from '../../types/payment';

interface PaymentDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  distribution: PaymentDistribution;
  onDistributionChange: (distribution: PaymentDistribution) => void;
  totalAmount: number;
}

export const PaymentDistributionModal: React.FC<PaymentDistributionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  distribution,
  onDistributionChange,
  totalAmount,
}) => {
  const handleTransferChange = (value: string) => {
    const transferAmount = Math.max(0, Math.min(parseFloat(value) || 0, totalAmount));
    const cashAmount = totalAmount - transferAmount;
    
    const newDistribution = {
      ...distribution,
      bankPaidAmount: transferAmount,
      cashPaidAmount: cashAmount,
      totalPaidAmount: totalAmount,
      falcoAmount: 0
    };

    onDistributionChange(newDistribution);
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      title="Distribución del Pago"
      actions={{
        confirm: {
          label: 'Confirmar',
          action: onConfirm,
        },
        cancel: {
          label: 'Cancelar',
          action: onClose,
        },
      }}
    >
      <div css={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <label><strong>Total:</strong></label>
          <div css={{ fontWeight: 'bold', fontSize: '1.1em' }}>
            ${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        
        <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <div css={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label>Efectivo:</label>
            <div css={{ 
              padding: '0.75rem', 
              backgroundColor: '#f5f5f5', 
              border: '1px solid #ddd',
              borderRadius: '4px',
              color: '#333',
              fontWeight: '500'
            }}>
              ${distribution.cashPaidAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div css={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label>Transferencia:</label>
            <TextInput
              type="number"
              min="0"
              max={totalAmount}
              value={distribution.bankPaidAmount.toString()}
              onChange={e => handleTransferChange(e.target.value)}
              css={{ 
                border: distribution.bankPaidAmount > totalAmount ? '2px solid #e74c3c' : '1px solid #ccc'
              }}
            />
          </div>
        </div>
        
        {distribution.bankPaidAmount > totalAmount && (
          <div css={{ 
            color: '#e74c3c', 
            fontSize: '0.9em', 
            textAlign: 'center',
            padding: '0.5rem',
            backgroundColor: '#fdf2f2',
            border: '1px solid #fecaca',
            borderRadius: '4px'
          }}>
            El monto de transferencia no puede ser mayor al total de cobranza
          </div>
        )}
      </div>
    </AlertDialog>
  );
};
