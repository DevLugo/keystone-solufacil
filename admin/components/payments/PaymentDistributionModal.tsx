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
  const handleInputChange = (field: keyof PaymentDistribution, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newDistribution = { ...distribution };

    if (field === 'cashPaidAmount' || field === 'bankPaidAmount') {
      newDistribution[field] = numValue;
      newDistribution.totalPaidAmount = newDistribution.cashPaidAmount + newDistribution.bankPaidAmount;
      newDistribution.falcoAmount = Math.max(0, totalAmount - newDistribution.totalPaidAmount);
    }

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
          <label>Monto Total Esperado:</label>
          <div>{totalAmount.toFixed(2)}</div>
        </div>
        <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <label>Efectivo:</label>
          <TextInput
            type="number"
            value={distribution.cashPaidAmount.toString()}
            onChange={e => handleInputChange('cashPaidAmount', e.target.value)}
          />
        </div>
        <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <label>Transferencia:</label>
          <TextInput
            type="number"
            value={distribution.bankPaidAmount.toString()}
            onChange={e => handleInputChange('bankPaidAmount', e.target.value)}
          />
        </div>
        <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <label>Total Pagado:</label>
          <div>{distribution.totalPaidAmount.toFixed(2)}</div>
        </div>
        <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <label>Falco:</label>
          <div>{distribution.falcoAmount.toFixed(2)}</div>
        </div>
      </div>
    </AlertDialog>
  );
};
