export interface DeadDebtLoan {
  id: string;
  requestedAmount: number;
  amountGived: number;
  signDate: string;
  pendingAmountStored: number;
  badDebtDate?: string;
  borrower: {
    fullName: string;
    clientCode: string;
  };
  lead: {
    fullName: string;
    personalData?: {
      addresses?: {
        location?: {
          name: string;
        };
      }[];
    };
  };
  loantype?: {
    name: string;
    weekDuration: number;
  };
  weeksSinceLoan: number;
  weeksWithoutPayment: number;
}

export interface DeadDebtSummary {
  locality: string;
  loanCount: number;
  totalAmount: number;
}

export interface DeadDebtByMonth {
  locality: string;
  loanCount: number;
  totalAmount: number;
  loans: {
    id: string;
    requestedAmount: number;
    amountGived: number;
    signDate: string;
    badDebtDate: string;
    borrower: {
      fullName: string;
      clientCode: string;
    };
    lead: {
      fullName: string;
    };
  }[];
}

export interface Route {
  id: string;
  name: string;
}

export interface DeadDebtFilters {
  weeksSinceLoan: number;
  weeksWithoutPayment: number;
  routeId?: string;
  month?: number;
  year?: number;
}

export interface MarkDeadDebtResult {
  success: boolean;
  message: string;
  updatedCount: number;
  errors?: {
    loanId: string;
    message: string;
  }[];
}

