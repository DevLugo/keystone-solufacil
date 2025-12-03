// TypeScript interfaces for Mobile-Optimized Client History Page
// Based on existing GraphQL schema from admin/pages/historial-cliente.tsx

export interface ClientSearchResult {
  id: string;
  name: string;
  clientCode: string;
  phone: string;
  address: string;
  route: string;
  location: string;
  municipality: string;
  state: string;
  city: string;
  latestLoanDate: string | null;
  hasLoans: boolean;
  hasBeenCollateral: boolean;
  totalLoans: number;
  activeLoans: number;
  finishedLoans: number;
  collateralLoans: number;
}

export interface LoanPayment {
  id: string;
  amount: number;
  receivedAt: string;
  receivedAtFormatted: string;
  type: string;
  paymentMethod: string;
  paymentNumber: number;
  balanceBeforePayment: number;
  balanceAfterPayment: number;
}

export interface NoPaymentPeriod {
  id: string;
  startDate: string;
  endDate: string;
  startDateFormatted: string;
  endDateFormatted: string;
  weekCount: number;
  type: 'NO_PAYMENT_PERIOD';
}

export interface LoanDetails {
  id: string;
  signDate: string;
  signDateFormatted: string;
  finishedDate?: string;
  finishedDateFormatted?: string;
  loanType: string;
  amountRequested: number;
  totalAmountDue: number;
  interestAmount: number;
  commission: number;
  totalPaid: number;
  pendingDebt: number;
  daysSinceSign: number;
  status: string;
  statusDescription: string;
  wasRenewed: boolean;
  weekDuration: number;
  rate: number;
  leadName: string;
  routeName: string;
  paymentsCount: number;
  payments: LoanPayment[];
  noPaymentPeriods: NoPaymentPeriod[];
  renewedFrom?: string;
  renewedTo?: string;
  avalName?: string;
  avalPhone?: string;
  clientName?: string;
  clientDui?: string;
}

export interface ClientDocument {
  id: string;
  title: string;
  description: string;
  photoUrl: string;
  publicId: string;
  documentType: 'INE' | 'DOMICILIO' | 'PAGARE';
  isError: boolean;
  errorDescription?: string;
  isMissing: boolean;
  createdAt: string;
  personalData: {
    id: string;
    fullName: string;
  };
  loan: {
    id: string;
    borrower: {
      personalData: {
        id: string;
        fullName: string;
      };
    };
    lead: {
      personalData: {
        id: string;
        fullName: string;
      };
    };
    collaterals: Array<{
      id: string;
      fullName: string;
      phones: Array<{ id: string; number: string }>;
    }>;
  };
}

export interface Leader {
  name: string;
  route: string;
  location: string;
  municipality: string;
  state: string;
  phone: string;
}

export interface Client {
  id: string;
  fullName: string;
  clientCode: string;
  phones: string[];
  addresses: Array<{
    street: string;
    city: string;
    location: string;
    route: string;
  }>;
  leader: Leader;
}

export interface ClientSummary {
  totalLoansAsClient: number;
  totalLoansAsCollateral: number;
  activeLoansAsClient: number;
  activeLoansAsCollateral: number;
  totalAmountRequestedAsClient: number;
  totalAmountPaidAsClient: number;
  currentPendingDebtAsClient: number;
  hasBeenClient: boolean;
  hasBeenCollateral: boolean;
}

export interface ClientHistoryData {
  client: Client;
  summary: ClientSummary;
  loansAsClient: LoanDetails[];
  loansAsCollateral: LoanDetails[];
}

// Duplicate detection
export interface DuplicatePair {
  client1: ClientSearchResult;
  client2: ClientSearchResult;
  similarity: number;
}

// Utility functions
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-SV', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'ACTIVO': return '#28a745';
    case 'RENOVADO': return '#805ad5';
    case 'TERMINADO': return '#2d3748';
    case 'PAGADO': return '#38a169';
    case 'VENCIDO': return '#ffc107';
    case 'ATRASADO': return '#ed8936';
    case 'CARTERA MUERTA': return '#dc3545';
    default: return '#6c757d';
  }
};
