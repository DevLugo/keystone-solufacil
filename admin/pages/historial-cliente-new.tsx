/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useLazyQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { useAuth } from '../hooks/useAuth';

// New Components
import { SearchBar } from '../components/historial-cliente-new/SearchBar';
import { ClientProfile } from '../components/historial-cliente-new/ClientProfile';
import { LoansList } from '../components/historial-cliente-new/LoansList';

// Unified Theme
import { colors, pageStyles, spacing } from '../styles';

// Theme Context
import { ThemeProvider, useTheme, useThemeColors } from '../contexts/ThemeContext';
import { ThemeToggle } from '../components/ui/ThemeToggle';

// GraphQL Queries (Copied from original file)
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
      employees {
        personalData {
          addresses {
            location {
              id
              name
            }
          }
        }
      }
    }
  }
`;

const SEARCH_CLIENTS = gql`
  query SearchClients($searchTerm: String!, $routeId: String, $locationId: String, $limit: Int) {
    searchClients(searchTerm: $searchTerm, routeId: $routeId, locationId: $locationId, limit: $limit)
  }
`;

const GET_CLIENT_HISTORY = gql`
  query GetClientHistory($clientId: String!, $routeId: String, $locationId: String) {
    getClientHistory(clientId: $clientId, routeId: $routeId, locationId: $locationId)
  }
`;

const MERGE_CLIENTS = gql`
  mutation MergeClients($primaryClientId: ID!, $secondaryClientId: ID!) {
    mergeClients(primaryClientId: $primaryClientId, secondaryClientId: $secondaryClientId)
  }
`;

// Interfaces (Copied/Adapted)
interface ClientSearchResult {
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

interface LoanPayment {
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

interface NoPaymentPeriod {
  id: string;
  startDate: string;
  endDate: string;
  startDateFormatted: string;
  endDateFormatted: string;
  weekCount: number;
  type: 'NO_PAYMENT_PERIOD';
}

interface LoanDetails {
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

interface ClientHistoryData {
  client: {
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
    leader: {
      name: string;
      route: string;
      location: string;
      municipality: string;
      state: string;
      phone: string;
    };
  };
  summary: {
    totalLoansAsClient: number;
    totalLoansAsCollateral: number;
    activeLoansAsClient: number;
    activeLoansAsCollateral: number;
    totalAmountRequestedAsClient: number;
    totalAmountPaidAsClient: number;
    currentPendingDebtAsClient: number;
    hasBeenClient: boolean;
    hasBeenCollateral: boolean;
  };
  loansAsClient: LoanDetails[];
  loansAsCollateral: LoanDetails[];
}

// Utils
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;
  for (let i = 0; i <= len2; i++) matrix[i] = [i];
  for (let j = 0; j <= len1; j++) matrix[0][j] = j;
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[len2][len1];
};

const findPotentialDuplicates = (clients: ClientSearchResult[]) => {
  const duplicates: Array<{client1: ClientSearchResult, client2: ClientSearchResult, similarity: number}> = [];
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const client1 = clients[i];
      const client2 = clients[j];
      const name1 = client1.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      const name2 = client2.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      const distance = levenshteinDistance(name1, name2);
      const maxLength = Math.max(name1.length, name2.length);
      const similarity = ((maxLength - distance) / maxLength) * 100;
      if (similarity >= 85 && distance <= 3) {
        duplicates.push({ client1, client2, similarity: Math.round(similarity) });
      }
    }
  }
  return duplicates.sort((a, b) => b.similarity - a.similarity);
};

// Payment Chronology Generation (Simplified port from utils/paymentChronology or kept if it's external)
// Assuming generatePaymentChronology is imported or we need to reimplement it if it's not exported properly.
// It is imported in the original file: import { generatePaymentChronology, PaymentChronologyItem } from '../utils/paymentChronology';
import { generatePaymentChronology } from '../utils/paymentChronology';

const HistorialClienteNewPage: React.FC = () => {
  const { isAdmin, canMergeClients } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [showClientHistory, setShowClientHistory] = useState<boolean>(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<Array<{client1: ClientSearchResult, client2: ClientSearchResult, similarity: number}>>([]);
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);

  const [searchClients, { data: searchData, loading: searchLoading }] = useLazyQuery(SEARCH_CLIENTS);
  const [getClientHistory, { data: historyData, loading: historyLoading, error: historyError }] = useLazyQuery(GET_CLIENT_HISTORY);
  const [mergeClientsMutation, { loading: mergeLoading }] = useMutation(MERGE_CLIENTS);

  const historyResult: ClientHistoryData | null = historyData?.getClientHistory || null;

  // Search Effect
  useEffect(() => {
    if (searchTerm.length >= 2 && showAutocomplete) {
      const debounceTimer = setTimeout(() => {
        searchClients({
          variables: {
            searchTerm,
            routeId: null,
            locationId: null,
            limit: 20
          }
        });
      }, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setClientResults([]);
    }
  }, [searchTerm, searchClients, showAutocomplete]);

  useEffect(() => {
    if (searchData?.searchClients) {
      setClientResults(searchData.searchClients);
      const duplicates = findPotentialDuplicates(searchData.searchClients);
      setPotentialDuplicates(duplicates);
    }
  }, [searchData]);

  const handleClientSelect = (client: ClientSearchResult) => {
    setSelectedClient(client);
    setSearchTerm(client.name);
    setClientResults([]);
    setShowAutocomplete(false);
    
    // Load history immediately
    getClientHistory({ variables: { clientId: client.id } });
    setShowClientHistory(true);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSelectedClient(null);
    setClientResults([]);
    setShowClientHistory(false);
    setShowAutocomplete(true);
  };

  const handleGeneratePDF = async (detailed: boolean) => {
    if (!historyResult) return;
    try {
      const response = await fetch('/export-client-history-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: historyResult.client.id,
          clientName: historyResult.client.fullName,
          clientDui: historyResult.client.clientCode,
          clientPhones: historyResult.client.phones,
          clientAddresses: historyResult.client.addresses,
          summary: historyResult.summary,
          loansAsClient: historyResult.loansAsClient,
          loansAsCollateral: historyResult.loansAsCollateral,
          detailed: detailed
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historial_${historyResult.client.fullName.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error al generar el PDF.');
      }
    } catch (error) {
      console.error('Error export PDF:', error);
      alert('Error al exportar el PDF.');
    }
  };

  // Adapter functions to map data to new components props
  const getClientProfileData = () => {
    if (!historyResult) return null;
    return {
      name: historyResult.client.fullName,
      id: historyResult.client.clientCode,
      phone: historyResult.client.phones.join(', ') || 'N/A',
      roles: [
        historyResult.summary.hasBeenClient ? 'Cliente' : '',
        historyResult.summary.hasBeenCollateral ? 'Aval' : ''
      ].filter(Boolean),
      since: historyResult.loansAsClient.length > 0 
        ? new Date(historyResult.loansAsClient[historyResult.loansAsClient.length - 1].signDate).toLocaleDateString()
        : 'N/A',
      leader: {
        name: historyResult.client.leader.name || 'N/A',
        route: historyResult.client.leader.route || 'N/A',
        location: historyResult.client.leader.location || 'N/A',
        municipality: historyResult.client.leader.municipality || 'N/A',
        state: historyResult.client.leader.state || 'N/A',
        phone: historyResult.client.leader.phone || 'N/A'
      },
      loanCount: historyResult.summary.totalLoansAsClient
    };
  };

  const mapLoanToCard = (loan: LoanDetails) => {
    // Use generatePaymentChronology to get the payment list structure
    const chronology = generatePaymentChronology(loan);
    
    // Map chronology to Payment interface for the component
    const payments = chronology.map((item, idx) => ({
      id: item.paymentNumber || idx + 1,
      date: item.dateFormatted,
      expected: item.weeklyExpected || 0,
      paid: item.amount || 0,
      surplus: item.surplusAfter || 0, // Or calculate differently if needed
      status: item.type === 'NO_PAYMENT' ? 'missed' : (item.coverageType === 'PARTIAL' ? 'partial' : 'paid'), // Simplify status mapping
    }));

    // Also include raw payments if needed, but the component uses the mapped structure
    // The component expects `Payment[]` with specific fields.
    
    // We need to adapt `status` string to the union type
    let status: 'active' | 'completed' | 'renewed' = 'active';
    if (loan.status === 'TERMINADO' || loan.status === 'PAGADO') status = 'completed';
    if (loan.wasRenewed) status = 'renewed';
    
    return {
      id: loan.id,
      date: loan.signDateFormatted || new Date(loan.signDate).toLocaleDateString(),
      status: status,
      amount: loan.amountRequested,
      totalAmount: loan.totalAmountDue,
      paidAmount: loan.totalPaid,
      remainingAmount: loan.pendingDebt,
      guarantor: {
        name: loan.avalName || 'N/A',
        phone: loan.avalPhone || 'N/A'
      },
      weekCount: loan.weekDuration,
      interestRate: loan.rate,
      interestAmount: loan.interestAmount,
      payments: payments as any[], // Cast to avoid strict type mismatch for now, or align types perfectly
      renovationId: loan.renewedFrom
    };
  };

  return (
    <PageContainer header="Historial de Cliente (Nueva Versión)">
      <ThemeProvider>
        <HistorialClienteContent
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          setShowAutocomplete={setShowAutocomplete}
          handleClearSearch={handleClearSearch}
          canMergeClients={canMergeClients}
          potentialDuplicates={potentialDuplicates}
          selectedClient={selectedClient}
          handleGeneratePDF={handleGeneratePDF}
          historyLoading={historyLoading}
          clientResults={clientResults}
          showAutocomplete={showAutocomplete}
          handleClientSelect={handleClientSelect}
          historyError={historyError}
          showClientHistory={showClientHistory}
          historyResult={historyResult}
          getClientProfileData={getClientProfileData}
          mapLoanToCard={mapLoanToCard}
        />
      </ThemeProvider>
    </PageContainer>
  );
};

// Componente interno que usa el tema
interface HistorialClienteContentProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  setShowAutocomplete: (show: boolean) => void;
  handleClearSearch: () => void;
  canMergeClients: boolean;
  potentialDuplicates: Array<{client1: ClientSearchResult, client2: ClientSearchResult, similarity: number}>;
  selectedClient: ClientSearchResult | null;
  handleGeneratePDF: (detailed: boolean) => Promise<void>;
  historyLoading: boolean;
  clientResults: ClientSearchResult[];
  showAutocomplete: boolean;
  handleClientSelect: (client: ClientSearchResult) => void;
  historyError: any;
  showClientHistory: boolean;
  historyResult: ClientHistoryData | null;
  getClientProfileData: () => any;
  mapLoanToCard: (loan: LoanDetails) => any;
}

const HistorialClienteContent = ({
  searchTerm,
  setSearchTerm,
  setShowAutocomplete,
  handleClearSearch,
  canMergeClients,
  potentialDuplicates,
  selectedClient,
  handleGeneratePDF,
  historyLoading,
  clientResults,
  showAutocomplete,
  handleClientSelect,
  historyError,
  showClientHistory,
  historyResult,
  getClientProfileData,
  mapLoanToCard,
}: HistorialClienteContentProps) => {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

  return (
    <div css={{
      ...pageStyles.container,
      backgroundColor: themeColors.background,
      background: themeColors.pageGradient,
      transition: 'background 0.3s ease',
    }}>
      {/* Theme Toggle */}
      <div css={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        marginBottom: spacing[4],
      }}>
        <ThemeToggle size="md" showLabel />
      </div>
      
      <SearchBar 
        onSearch={(term) => {
          setSearchTerm(term);
          setShowAutocomplete(true);
        }}
        searchTerm={searchTerm}
        onSearchTermChange={(term) => {
           setSearchTerm(term);
           setShowAutocomplete(true);
        }}
        onClear={handleClearSearch}
        onMerge={canMergeClients ? () => {} : undefined}
        onShowDuplicates={() => {}}
        showDuplicates={false}
        duplicateCount={potentialDuplicates.length}
        hasSelectedClient={!!selectedClient}
        onGeneratePDF={handleGeneratePDF}
        isLoading={historyLoading}
        selectedClientName={selectedClient?.name}
        selectedClientCode={selectedClient?.clientCode}
        searchResults={clientResults}
        showResults={showAutocomplete}
        onSelectResult={handleClientSelect}
      />

      {historyError && (
        <GraphQLErrorNotice networkError={historyError.networkError} errors={historyError.graphQLErrors} />
      )}

      {historyLoading && (
        <div css={{ display: 'flex', justifyContent: 'center', padding: spacing[12] }}>
          <LoadingDots label="Cargando historial..." />
        </div>
      )}

      {showClientHistory && historyResult && (
        <div css={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <ClientProfile client={getClientProfileData()!} />
          
          {historyResult.loansAsClient.length > 0 && (
            <div css={{ marginBottom: spacing[8] }}>
              <LoansList 
                loans={historyResult.loansAsClient.map(mapLoanToCard)} 
                title="Préstamos como Cliente"
              />
            </div>
          )}

          {historyResult.loansAsCollateral.length > 0 && (
            <div css={{ marginBottom: spacing[8] }}>
              <LoansList 
                loans={historyResult.loansAsCollateral.map(mapLoanToCard)} 
                title="Préstamos como Aval"
                isCollateral
              />
            </div>
          )}

          {historyResult.loansAsClient.length === 0 && historyResult.loansAsCollateral.length === 0 && (
             <div css={{ textAlign: 'center', padding: spacing[12], color: themeColors.foregroundMuted }}>
               No hay historial de préstamos para este cliente.
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistorialClienteNewPage;

