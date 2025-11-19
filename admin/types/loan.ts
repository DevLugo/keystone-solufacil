// Phone type
export type Phone = {
  id: string;
  number: string;
  __typename?: string;
};

// Location type
export type Location = {
  id: string;
  name: string;
  municipality?: {
    id: string;
    name: string;
    state?: {
      id: string;
      name: string;
    };
  };
  __typename?: string;
};

// Address type
export type Address = {
  id: string;
  location: Location;
  __typename?: string;
};

// Personal Data type for collaterals
export type PersonalData = {
  id: string;
  fullName: string;
  phones: Phone[];
  addresses?: Address[];
  __typename?: string;
};

// Base loan type with only database fields
export type BaseLoan = {
  id: string;
  requestedAmount: string;
  amountGived: string;
  signDate: string;
  firstPaymentDate?: string;
  finishedDate?: string;
  createdAt: string;
  updatedAt: string;
  loantype: LoanType;
  borrower: {
    id: string;
    personalData: {
      id: string;
      fullName: string;
      phones: Array<{ id: string; number: string }>;
      addresses?: Array<{
        id: string;
        location: {
          id: string;
          name: string;
        };
      }>;
    };
  };
  collaterals?: PersonalData[];
  previousLoan?: {
    id: string;
    pendingAmount: string;
    collaterals?: PersonalData[];
    borrower: {
      id: string;
      personalData: {
        fullName: string;
      };
    };
  };
};

// Full loan type including virtual fields
export type Loan = BaseLoan & {
  weeklyPaymentAmount: string;
  amountToPay: string;
  totalDebtAcquired: string;
  pendingAmount: string;
  pendingAmountStored?: string; // Para préstamos anteriores
  comissionAmount: string;
  avalName: string;
  avalPhone: string;
  lead?: {
    id: string;
    personalData: {
      fullName: string;
      addresses?: Address[];
    };
  };
  status?: string;
  renewedDate?: string | null;
};

export type LoanType = {
  id: string;
  name: string;
  weekDuration: number;
  rate: string;
  loanPaymentComission: string;
};

export type Lead = {
  id: string;
  type: string;
  personalData: {
    fullName: string;
  };
};

export type Route = {
  id: string;
  name: string;
};

export type Option = {
  value: string;
  label: string;
};

export type PhoneCreateInput = {
  create: { number: string }[] | null;
};

export type PersonalDataCreateInput = {
  create: {
    phones: PhoneCreateInput;
    fullName: string | null;
  };
};

export type BorrowerCreateOrConnectInput = {
  create?: {
    email?: string | null;
    personalData: PersonalDataCreateInput;
  } | null;
  connect?: { id: string } | null;
};

export type ExtendedLoan = Omit<BaseLoan, 'loantype'> & {
  lead?: { connect: { id: string } };
  comission?: string;
  loantype: LoanType;
};

export type ExtendedLoanWithOptionalType = Omit<ExtendedLoan, 'loantype'> & {
  loantype: LoanType | null;
};

export type LoanCreateInput = {
  requestedAmount: string;
  amountGived: string;
  loantype: { connect: { id: string } };
  signDate: Date;
  avalName: string;
  avalPhone: string;
  grantor?: { connect: { id: string } };
  lead: { connect: { id: string } };
  borrower: BorrowerCreateOrConnectInput;
  previousLoan?: { connect: { id: string } };
  comissionAmount: string;
};

// Types específicos para CreditosTabNew
export interface ExtendedLoanForCredits extends Partial<Loan> {
  id: string;
  selectedCollateralId?: string;
  selectedCollateralPhoneId?: string;
  avalAction?: 'create' | 'update' | 'connect' | 'clear';
  avalName?: string;
  avalPhone?: string;
  avalData?: {
    avalName?: string;
    avalPhone?: string;
  };
  lead?: {
    id: string;
    personalData: {
      fullName: string;
      addresses?: Address[];
    };
  };
  previousLoanOption?: PreviousLoanOption | null;
}

export interface PreviousLoanOption {
  value: string;
  label: string;
  loanData: Loan;
  hasDebt?: boolean;
  statusColor?: string;
  statusTextColor?: string;
  debtColor?: string;
  locationColor?: string;
  location?: string | null;
  debtAmount?: string;
  leaderName?: string;
}

export interface InitialPayment {
  amount: string;
  paymentMethod: 'CASH' | 'MONEY_TRANSFER';
  comission: string;
}

export interface LoanTypeOption {
  label: string;
  value: string;
  weekDuration: number;
  rate: string;
  typeData: LoanType;
}

export interface LeadInfo {
  id: string;
  type: string;
  personalData: {
    fullName: string;
    addresses?: Address[];
    __typename?: string;
  };
  __typename?: string;
}

export interface LocationInfo {
  id: string;
  name: string;
}
