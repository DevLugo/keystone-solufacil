export interface Transaction {
  concept: string;
  quantity: number;
  total: number;
  isCommission?: boolean;
}
export interface Balances {
  cash: number;
  bank: number;
}
export interface TotalPlaced {
  creditsAndLoans: number;
  commissions: number;
  totalCollection: number;
  collectionCash: number;
  collectionBank: number;
}
export interface Locality {
  id: string;
  name: string;
  transactions: Transaction[];
  totalPlaced: TotalPlaced;
  balances: Balances;
}
export interface ExecutiveSummaryData {
  totalCreditsGiven: number;
  totalLoansGiven: number;
  totalOperatingExpenses: number;
  totalCommissions: number;
  totalCashPayments: number;
  totalBankPayments: number;
  totalMoneyInvestment: number;
  totalCashBalance: number;
  totalBankBalance: number;
}