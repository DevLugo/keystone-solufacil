/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { DatePicker, Select, TextInput } from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { LoanPayment, PaymentType, PaymentMethod, paymentTypeOptions, paymentMethodOptions } from '../../types/payment';

type SelectOption = { label: string; value: string; };

interface PaymentFormProps {
  index: number;
  payment: LoanPayment;
  loans: Array<{ id: string; borrower: { personalData: { fullName: string } } }>;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof LoanPayment, value: string | PaymentType | PaymentMethod) => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  index,
  payment,
  loans,
  onRemove,
  onChange,
}) => {
  const loanOptions: SelectOption[] = loans?.map(loan => ({
    value: loan.id,
    label: loan.borrower.personalData.fullName,
  })) || [];

  const selectedLoanOption = loanOptions.find(option => option.value === payment.loanId) || null;
  const selectedPaymentType = paymentTypeOptions.find(option => option.value === payment.type) || null;
  const selectedPaymentMethod = paymentMethodOptions.find(option => option.value === payment.paymentMethod) || null;

  return (
    <div css={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #e1e1e1', borderRadius: '4px' }}>
      <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
        <Select
          value={selectedLoanOption}
          options={loanOptions}
          onChange={option => onChange(index, 'loanId', option?.value || '')}
          placeholder="Seleccionar préstamo"
        />
        <TextInput
          type="number"
          value={payment.amount}
          onChange={e => onChange(index, 'amount', e.target.value)}
          placeholder="Monto"
        />
        <Select
          value={selectedPaymentType}
          options={paymentTypeOptions}
          onChange={option => {
            const newType = option?.value as PaymentType || PaymentType.PAYMENT;
            onChange(index, 'type', newType);
          }}
          placeholder="Tipo de pago"
        />
        <Select
          value={selectedPaymentMethod}
          options={paymentMethodOptions}
          onChange={option => {
            const newMethod = option?.value as PaymentMethod || PaymentMethod.CASH;
            onChange(index, 'paymentMethod', newMethod);
          }}
          placeholder="Método de pago"
        />
        <Button
          tone="negative"
          onClick={() => onRemove(index)}
          css={{ marginLeft: '1rem' }}
        >
          Eliminar
        </Button>
      </div>
    </div>
  );
};
