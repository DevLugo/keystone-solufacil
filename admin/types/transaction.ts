export interface Route {
  id: string;
  name: string;
  account: {
    id: string;
    type: string;
  };
}

export interface Employee {
  id: string;
  type: string;
  personalData: {
    fullName: string;
  };
  routes: {
    account: {
      id: string;
      type: string;
    };
  };
}

export interface Option {
  value: string;
  label: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
}

export interface RouteOption extends Option {
  account: Account;
}

export interface Transaction {
  id: string;
  amount: string;
  type: string;
  expenseSource: string;
  date: string;
  sourceAccount: Account;
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
  date: string;
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
}
