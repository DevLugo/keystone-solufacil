export type Transaction = {
  id: string;
  amount: string;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  expenseSource?: string;
  date: string;
  sourceAccount?: {
    id: string;
    amount: string;
  };
  destinationAccount?: {
    id: string;
    amount: string;
  };
};

export type Account = {
  id: string;
  amount: string;
  type: string;
  name: string;
};

export type Option = {
  value: string;
  label: string;
};

export type TransactionCreateInput = {
  amount: string;
  type: string;
  expenseSource?: string;
  date: string;
  sourceAccount?: { connect: { id: string } };
  destinationAccount?: { connect: { id: string } };
  lead?: { connect: { id: string } };
};
