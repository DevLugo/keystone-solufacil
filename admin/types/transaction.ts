export interface PersonalData {
  fullName: string;
}

export interface Account {
  id: string;
  name?: string;
  type: 'BANK' | 'OFFICE_CASH_FUND' | 'EMPLOYEE_CASH_FUND' | 'PREPAID_GAS';
  amount?: number;
  routes?: Array<{
    id: string;
    name: string;
  }>;
}

export interface Route {
  id: string;
  name: string;
  accounts: Account[];
}

export interface Employee {
  id: string;
  type: string;
  personalData: PersonalData;
  routes: {
    accounts: Account[];
  };
}

export interface Option {
  value: string;
  label: string;
}

export interface RouteOption extends Option {
  account: Account;
}

export interface Transaction {
  id: string;
  amount: string;
  type: string;
  expenseSource: string;
  description?: string;
  date: string;
  sourceAccount: Account;
  expenseGroupId?: string;
  route?: { id: string };
  lead?: {
    id: string;
    personalData?: {
      fullName: string;
    };
  };
}

export interface TransactionCreateInput {
  amount: string;
  type: string;
  expenseSource: string;
  description?: string;
  date: string;
  expenseGroupId?: string;
  isDistributed?: boolean; // Nuevo campo para indicar si es distribuido
  selectedRouteIds?: string[]; // Rutas seleccionadas para distribución
  sourceAccount: {
    connect: {
      id: string;
    };
  };
  lead?: {
    connect: {
      id: string;
    };
  };
  route?: {
    connect: {
      id: string;
    };
  };
  snapshotRouteId?: string;
}
