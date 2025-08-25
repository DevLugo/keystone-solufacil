import { Employee, PersonalData } from './transaction';

export interface EmployeeWithTypename extends Employee {
  __typename: string;
  personalData: PersonalData & {
    __typename: string;
  };
}

export interface RouteWithEmployees {
  id: string;
  name: string;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    amount: number;
    transactions: Array<{
      id: string;
      amount: number;
      type: string;
    }>;
  }>;
  employees: Array<{
    id: string;
    type: string;
    LeadManagedLoans: Array<{
      id: string;
      status: string;
      requestedAmount: number;
      weeklyPaymentAmount: number;
      finishedDate: string | null;
      badDebtDate: string | null;
      payments: Array<{
        id: string;
        amount: number;
        receivedAt: string;
      }>;
    }>;
  }>;
} 