export type Lead = {
  id: string;
  personalData: {
    fullName: string;
  }
  type: string;
};

export type Loan = {
  id: string;
  requestedAmount: string;
  amountGived: string;
  loantype: {
    id: string;
    rate: string;
    weekDuration: number;
  } | null;
  borrower: {
    personalData: {
      fullName: string;
    }
  }
};

export type LoanPayment = {
  amount: string;
  comission: number;
  loanId: string;
  type: PaymentType;
  paymentMethod: PaymentMethod;
};

export type Route = {
  name: string;
  id: string;
};

export type Option = {
  value: string;
  label: string;
};

export type PaymentDistribution = {
  cashPaidAmount: number;
  bankPaidAmount: number;
  totalPaidAmount: number;
  falcoAmount: number;
};

export enum PaymentType {
  PAYMENT = 'PAYMENT',
  FALCO = 'FALCO',
  EXTRA_COLLECTION = 'EXTRA_COLLECTION'
}

export enum PaymentMethod {
  CASH = 'CASH',
  MONEY_TRANSFER = 'MONEY_TRANSFER'
}

export const paymentTypeOptions: Option[] = [
  { label: 'ABONO', value: PaymentType.PAYMENT },
  { label: 'FALCO', value: PaymentType.FALCO },
  { label: 'EXTRA COBRANZA', value: PaymentType.EXTRA_COLLECTION },
];

export const paymentMethodOptions: Option[] = [
  { label: 'Efectivo', value: PaymentMethod.CASH },
  { label: 'Transferencia', value: PaymentMethod.MONEY_TRANSFER },
];
