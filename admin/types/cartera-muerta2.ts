export interface DeadDebtLoan2 {
  id: string;
  requestedAmount: number;
  amountGived: number;
  signDate: string;
  pendingAmountStored: number;
  badDebtDate: string | null;
  weeksSinceLoan: number;
  weeksWithoutPayment: number;
  borrower: {
    fullName: string;
    clientCode: string;
  };
  lead: {
    fullName: string;
    locality: string;
  };
  loantype: {
    name: string;
    weekDuration: number;
  } | null;
}

export interface DeadDebtSummary2 {
  locality: string;
  loanCount: number;
  totalAmount: number;
}

export interface DeadDebtByMonth2 {
  locality: string;
  loanCount: number;
  totalAmount: number;
  loans: DeadDebtLoan2[];
}

export interface DeadDebtFilters2 {
  weeksSinceLoan: number;
  weeksWithoutPayment: number;
  routeId?: string;
  month?: number;
  year?: number;
}

export interface Route2 {
  id: string;
  name: string;
}

export interface MarkDeadDebtResult2 {
  success: boolean;
  message: string;
  updatedCount: number;
  errors: Array<{
    loanId: string;
    message: string;
  }>;
}

