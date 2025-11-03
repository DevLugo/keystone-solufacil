// Tipos para los resolvers de GraphQL
export interface Context {
  prisma: any; // Prisma client
  session?: any; // Sesión de usuario
}

// Tipos para cartera muerta
export interface DeadDebtLoan {
  id: string;
  borrower: {
    fullName: string;
    clientCode: string;
  };
  lead: {
    fullName: string;
    locality: string;
    route: string;
  };
  pendingAmountStored: number;
  weeksSinceLoan: number;
  weeksWithoutPayment: number;
  badDebtCandidate: number;
  badDebtDate: string | null;
  signDate: string;
  status: string;
  payments: Array<{
    receivedAt: string;
    amount: number;
  }>;
}

export interface DeadDebtSummary {
  locality: string;
  loanCount: number;
  totalAmount: number;
}

export interface MonthlyDeadDebtData {
  year: number;
  months: Array<{
    month: string;
    monthNumber: number;
    loans: DeadDebtLoan[];
    summary: {
      totalDeuda: number;
      totalCarteraMuerta: number;
      totalClientes: number;
      totalRutas: number;
    };
  }>;
  routesInfo: Array<{
    id: string;
    name: string;
  }>;
}
