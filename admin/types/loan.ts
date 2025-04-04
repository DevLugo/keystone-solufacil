// Base loan type with only database fields
export type BaseLoan = {
  id: string;
  requestedAmount: string;
  amountGived: string;
  signDate: string;
  firstPaymentDate?: string;
  finishedDate: string | null;
  createdAt: string;
  updatedAt: string;
  loantype: LoanType;
  borrower: {
    id: string;
    personalData: {
      id: string;
      fullName: string;
      phones: Array<{ number: string }>;
    };
  };
  avalName: string;
  avalPhone: string;
  previousLoan?: {
    id: string;
    pendingAmount: string;
    avalName: string;
    avalPhone: string;
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
  pendingAmount: string;
  comissionAmount: string;
};

export type LoanType = {
  id: string;
  name: string;
  weekDuration: number;
  rate: string;
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
