/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { gql, useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { jsx } from '@keystone-ui/core';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import type { Employee, Option } from '../../types/transaction';
import { FaPlus, FaEllipsisV, FaInfoCircle, FaEdit, FaTrash } from 'react-icons/fa';

// Theme Context
import { useTheme, useThemeColors } from '../../contexts/ThemeContext';

// Import shadcn components
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '../ui/dialog';

// Import components
import RouteLeadSelector from '../routes/RouteLeadSelector';
import { useBalanceRefresh } from '../../contexts/BalanceRefreshContext';
import kpiStyles from './CreditosTabNew.module.css';
import EditPersonModal from '../loans/EditPersonModal';
import AvalInputWithAutocomplete from '../loans/AvalInputWithAutocomplete';
import { GET_LEAD_PAYMENTS } from '../../graphql/queries/payments';

// Types
type Loan = {
  id: string;
  weeklyPaymentAmount: string;
  signDate: string;
  finishedDate?: string | null;
  loantype: {
    id: string;
    name: string;
    loanPaymentComission: string;
  };
  borrower: {
    personalData: {
      id?: string;
      fullName: string;
      clientCode?: string;
    }
  };
  collaterals?: Array<{
    id: string;
    fullName: string;
    phones?: Array<{
      id: string;
      number: string;
    }>;
  }>;
  lead?: {
    id: string;
    personalData: {
      fullName: string;
    };
  };
};

type LoanPayment = {
  amount: string;
  comission: number;
  loanId: string;
  type: string;
  paymentMethod: string;
  isUserAdded?: boolean;
  isNew?: boolean;
  loan?: {
    id: string;
    signDate?: string;
    borrower?: {
      personalData?: {
        fullName?: string;
        clientCode?: string;
      };
    };
    loantype?: {
      loanPaymentComission?: string;
    };
  };
};

type LoanPaymentType = {
  id?: string;
  amount: string;
  comission: string;
  type: string;
  paymentMethod: string;
  loan?: {
    id: string;
    signDate?: string;
    borrower?: {
      personalData?: {
        fullName?: string;
        clientCode?: string;
      };
    };
    loantype?: {
      loanPaymentComission?: string;
    };
  };
  leadPaymentReceived?: {
    id: string;
    createdAt: string;
    bankPaidAmount?: string;
    falcoAmount?: string;
  };
  isMigrated?: boolean;
};

type NewPayment = LoanPayment;

type ExistingPayment = {
  id: string;
  amount: string;
  comission: string;
  type: string;
  paymentMethod: string;
  loanId?: string;
  loan?: {
    id: string;
    signDate?: string;
    borrower?: {
      personalData?: {
        fullName?: string;
        clientCode?: string;
        id?: string;
      };
    };
    loantype?: {
      loanPaymentComission?: string;
    };
  };
  leadPaymentReceived?: {
    id: string;
    createdAt: string;
    bankPaidAmount?: string;
    falcoAmount?: string;
  };
  isMigrated?: boolean;
  isMissingPayment?: boolean;
};

type EditedPayment = ExistingPayment;

type GroupedPayment = {
  payments: Array<{
    amount: number;
    comission: number;
    loanId: string;
    type: string;
    paymentMethod: string;
  }>;
  expectedAmount: number;
  cashPaidAmount: number;
  bankPaidAmount: number;
  falcoAmount: number;
  paymentDate: string;
};

type PaymentData = {
  amount: number | string;
  comission: number | string;
  loanId: string;
  type: string;
  paymentMethod: string;
};

type Account = {
  id: string;
  name: string;
  type: string;
  amount: string;
};

type AvalData = {
  id?: string;
  fullName?: string;
  phone?: string;
  phoneId?: string;
  avalAction?: string;
};

type Route = {
  name: string;
  id: string;
};

type Lead = {
  id: string;
  personalData: {
    fullName: string;
  };
  type: string;
};

const GET_LEADS = gql`
  query GetLeads($routeId: ID!) {
    employees(where: {
      AND: [
        { routes: { id: { equals: $routeId } } },
        { type: { equals: "LEAD" } }
      ]
    }) {
      id
      type
      personalData {
        fullName
      }
    }
  }
`;

const GET_CLIENT_HISTORY = gql`
  query GetClientHistory($clientId: String!, $routeId: String, $locationId: String) {
    getClientHistory(clientId: $clientId, routeId: $routeId, locationId: $locationId)
  }
`;

const CREATE_LEAD_PAYMENT_RECEIVED = gql`
  mutation CreateCustomLeadPaymentReceived($expectedAmount: Float!, $agentId: ID!, $leadId: ID!, $payments: [PaymentInput!]!, $cashPaidAmount: Float, $bankPaidAmount: Float, $paymentDate: String!) {
    createCustomLeadPaymentReceived(expectedAmount: $expectedAmount, agentId: $agentId, leadId: $leadId, payments: $payments, cashPaidAmount: $cashPaidAmount, bankPaidAmount: $bankPaidAmount, paymentDate: $paymentDate) {
      id
      expectedAmount
      paidAmount
      cashPaidAmount
      bankPaidAmount
      falcoAmount
      agentId
      leadId
      paymentDate
      payments {
        amount
        comission
        loanId
        type
        paymentMethod
      }
    }
  }
`;

const GET_ROUTES = gql`
  query Routes($where: RouteWhereInput!) {
    routes(where: $where) {
      id
      name
    }
  }
`;

const GET_ACCOUNTS = gql`
  query GetAccounts($routeId: ID) {
    accounts(where: { routes: { some: { id: { equals: $routeId } } } }) {
      id
      name
      type
      amount
    }
  }
`;

const CREATE_INCOME_TRANSACTION = gql`
  mutation CreateTransaction($data: TransactionCreateInput!) {
    createTransaction(data: $data) {
      id
      amount
      type
      incomeSource
      description
      date
      profitAmount
      returnToCapital
      route {
        id
        name
      }
      destinationAccount {
        id
        name
      }
    }
  }
`;

const GET_LOANS_WITH_INCOMPLETE_AVALS = gql`
  query LoansWithIncompleteAvals($where: LoanWhereInput!, $take: Int, $skip: Int) {
    loans(where: $where, orderBy: [{ signDate: asc }, { id: asc }], take: $take, skip: $skip) {
      id
      weeklyPaymentAmount
      signDate
      finishedDate
      loantype {
        id
        name
        loanPaymentComission
      }
      borrower {
        personalData{
          id
          fullName
          clientCode
        }
      }
      lead {
        id
        personalData {
          id
          fullName
          addresses {
            id
            location {
              id
              name
              route {
                id
                name
              }
            }
          }
        }
        routes {
          id
          name
        }
      }
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
      }
    }
    loansCount(where: $where)
  }
`;

const GET_LOANS_BY_LEAD = gql`
  query Loans($where: LoanWhereInput!) {
    loans(where: $where, orderBy: [{ signDate: asc }, { id: asc }]) {
      id
      weeklyPaymentAmount
      signDate
      finishedDate
      loantype {
        id
        name
        loanPaymentComission
      }
      borrower {
        personalData{
          id
          fullName
          clientCode
        }
      }
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
      }
    }
  }
`;

const GET_LEAD_FALCOS = gql`
  query GetLeadFalcos($leadId: ID!) {
    leadPaymentReceiveds(where: {
      AND: [
        { lead: { id: { equals: $leadId } } },
        { falcoAmount: { gt: "0" } }
      ]
    }) {
      id
      expectedAmount
      paidAmount
      cashPaidAmount
      bankPaidAmount
      falcoAmount
      paymentStatus
      createdAt
      agent {
        personalData {
          fullName
        }
      }
      falcoCompensatoryPayments {
        id
        amount
        createdAt
      }
    }
  }
`;

const CREATE_FALCO_PAYMENT = gql`
  mutation CreateFalcoCompensatoryPayment($leadPaymentReceivedId: ID!, $amount: Decimal!) {
    createFalcoCompensatoryPayment(data: {
      amount: $amount
      leadPaymentReceived: { connect: { id: $leadPaymentReceivedId } }
    }) {
      id
      amount
      createdAt
      leadPaymentReceived {
        id
        falcoAmount
        paymentStatus
      }
    }
  }
`;

const GET_MIGRATED_PAYMENTS = gql`
  query GetMigratedPayments($date: DateTime!, $nextDate: DateTime!, $leadId: ID!) {
    loanPayments(where: {
      AND: [
        { receivedAt: { gte: $date, lt: $nextDate } },
        { leadPaymentReceived: null },
        { loan: { lead: { id: { equals: $leadId } } } }
      ]
    }) {
      id
      amount
      comission
      type
      paymentMethod
      receivedAt
      loan {
        id
        signDate
        borrower {
          personalData {
            fullName
          }
        }
      }
    }
  }
`;

const GET_CLIENT_DATA = gql`
  query GetClientData($id: ID!) {
    personalData(where: { id: $id }) {
      id
      fullName
      clientCode
      phones {
        id
        number
      }
      addresses {
        id
        location {
          id
          name
        }
      }
    }
  }
`;

const UPDATE_LEAD_PAYMENT = gql`
  mutation UpdateLeadPayment(
    $id: ID!
    $expectedAmount: Float!
    $cashPaidAmount: Float
    $bankPaidAmount: Float
    $falcoAmount: Float
    $paymentDate: String!
    $payments: [PaymentInput!]!
  ) {
    updateCustomLeadPaymentReceived(
      id: $id
      expectedAmount: $expectedAmount
      cashPaidAmount: $cashPaidAmount
      bankPaidAmount: $bankPaidAmount
      falcoAmount: $falcoAmount
      paymentDate: $paymentDate
      payments: $payments
    ) {
      id
      expectedAmount
      paidAmount
      cashPaidAmount
      bankPaidAmount
      falcoAmount
      paymentStatus
      payments {
        id
        amount
        comission
        loanId
        type
        paymentMethod
      }
    }
  }
`;

const UPDATE_LOAN_PAYMENT = gql`
  mutation UpdateLoanPayment(
    $id: ID!
    $amount: Float!
    $comission: Float!
    $type: String!
    $paymentMethod: String!
  ) {
    updateLoanPayment(
      where: { id: $id }
      data: {
        amount: $amount
        comission: $comission
        type: $type
        paymentMethod: $paymentMethod
      }
    ) {
      id
      amount
      comission
      type
      paymentMethod
    }
  }
`;

const MARK_LOAN_AS_DECEASED = gql`
  mutation MarkLoanAsDeceased($loanId: ID!, $date: DateTime!) {
    updateLoan(
      where: { id: $loanId }
      data: {
        badDebtDate: $date
        finishedDate: $date
        isDeceased: true
      }
    ) {
      id
      badDebtDate
      finishedDate
      isDeceased
    }
  }
`;

const UNMARK_LOAN_AS_DECEASED = gql`
  mutation UnmarkLoanAsDeceased($loanId: ID!) {
    updateLoan(
      where: { id: $loanId }
      data: {
        isDeceased: false
        finishedDate: null
        badDebtDate: null
      }
    ) {
      id
      isDeceased
      finishedDate
      badDebtDate
    }
  }
`;

const PROMOTE_TO_LEAD = gql`
  mutation PromoteToLead($clientId: ID!, $currentLeadId: ID!) {
    promoteToLead(clientId: $clientId, currentLeadId: $currentLeadId)
  }
`;

const UPDATE_LOAN_COLLATERALS = gql`
  mutation UpdateLoanCollaterals($loanId: ID!, $collateralIds: [ID!]!) {
    updateLoan(
      where: { id: $loanId }
      data: {
        collaterals: {
          set: $collateralIds
        }
      }
    ) {
      id
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
      }
    }
  }
`;

const UPDATE_PHONE = gql`
  mutation UpdatePhone($phoneId: ID!, $number: String!) {
    updatePhone(
      where: { id: $phoneId }
      data: { number: $number }
    ) {
      id
      number
    }
  }
`;

const UPDATE_LOAN_WITH_AVAL = gql`
  mutation UpdateLoanWithAval($where: ID!, $data: UpdateLoanWithAvalInput!) {
    updateLoanWithAval(where: $where, data: $data)
  }
`;

type Lead = {
  id: string;
  personalData: {
    fullName: string;
  }
  type: string;
};

type Loan = {
  id: string;
  weeklyPaymentAmount: string;
  signDate: string;
  loantype: {
    id: string;
    name: string;
    loanPaymentComission: string;
  };
  borrower:  {
    personalData: {
      fullName: string;
    }
  }
};

type LoanPayment = {
  amount: string;
  comission: number;
  loanId: string;
  type: string;
  paymentMethod: string;
  isUserAdded?: boolean;
};

type Route = {
  name: string;
  id: string;
};

const paymentTypeOptions: Option[] = [
  { label: 'ABONO', value: 'PAYMENT' },
  { label: 'FALCO', value: 'FALCO' },
  { label: 'EXTRA COBRANZA', value: 'EXTRA_COLLECTION' },
];

const paymentMethods: Option[] = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Transferencia', value: 'MONEY_TRANSFER' },
];

const RouteSelector = React.memo(({ onRouteSelect, value }: { onRouteSelect: (route: Option | null) => void, value: Option | null }) => {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
    variables: { where: { } },
  });

  const routeOptions = useMemo(() =>
    routesData?.routes?.map(route => ({
      value: route.id,
      label: route.name,
    })) || [],
    [routesData]
  );

  if (routesLoading) return (
    <div css={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      color: themeColors.foregroundMuted,
      transition: 'color 0.3s ease',
    }}>
      Loading routes...
    </div>
  );
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

  return (
    <select
      value={value?.value || ''}
      onChange={(e) => {
        const route = routeOptions.find(r => r.value === e.target.value);
        onRouteSelect(route || null);
      }}
      css={{
        width: '100%',
        padding: '8px 12px',
        border: `2px solid ${themeColors.border}`,
        borderRadius: '8px',
        fontSize: '14px',
        color: themeColors.foreground,
        backgroundColor: themeColors.card,
        fontWeight: '500',
        transition: 'all 0.2s ease',
        outline: 'none',
        cursor: 'pointer',
        '&:focus': {
          borderColor: themeColors.primary,
          boxShadow: `0 0 0 3px ${themeColors.primary}20`,
        },
        '&:hover': {
          borderColor: themeColors.borderHover,
        }
      }}
    >
      <option value="">Select a route</option>
      {routeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

const LeadSelector = React.memo(({ routeId, onLeadSelect, value }: { routeId: string | undefined, onLeadSelect: (lead: Option | null) => void, value: Option | null }) => {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

  const { data: leadsData, loading: leadsLoading, error: leadsError } = useQuery<{ employees: Lead[] }>(GET_LEADS, {
    variables: { routeId: routeId || '' },
  });

  const leadOptions = useMemo(() =>
    leadsData?.employees?.map(lead => ({
      value: lead.id,
      label: lead.personalData.fullName,
    })) || [],
    [leadsData]
  );

  if (leadsLoading) return (
    <div css={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      color: themeColors.foregroundMuted,
      transition: 'color 0.3s ease',
    }}>
      Loading leads...
    </div>
  );
  if (leadsError) return <GraphQLErrorNotice errors={leadsError?.graphQLErrors || []} networkError={leadsError?.networkError} />;

  return (
    <select
      value={value?.value || ''}
      onChange={(e) => {
        const lead = leadOptions.find(l => l.value === e.target.value);
        onLeadSelect(lead || null);
      }}
      css={{
        width: '100%',
        padding: '8px 12px',
        border: `2px solid ${themeColors.border}`,
        borderRadius: '8px',
        fontSize: '14px',
        color: themeColors.foreground,
        backgroundColor: themeColors.card,
        fontWeight: '500',
        transition: 'all 0.2s ease',
        outline: 'none',
        cursor: 'pointer',
        '&:focus': {
          borderColor: themeColors.primary,
          boxShadow: `0 0 0 3px ${themeColors.primary}20`,
        },
        '&:hover': {
          borderColor: themeColors.borderHover,
        }
      }}
    >
      <option value="">Select a lead</option>
      {leadOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

export interface AbonosProps {
  selectedDate: Date | null;
  selectedRoute: Route | null;
  selectedLead: Employee | null;
  refreshKey: number;
}

const SelectionMessage = ({
  icon,
  title,
  description,
  requirements
}: {
  icon: string;
  title: string;
  description: string;
  requirements: string[]
}) => {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

  return (
    <div css={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '400px',
      background: isDark
        ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
        : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      borderRadius: '12px',
      margin: '20px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      <div css={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: `radial-gradient(circle, ${themeColors.primary}20 0%, transparent 70%)`,
        animation: 'pulse 2s ease-in-out infinite',
        transition: 'all 0.3s ease',
      }} />

      <div css={{
        width: '60px',
        height: '60px',
        background: `${themeColors.primary}20`,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        position: 'relative',
        zIndex: 1,
        transition: 'all 0.3s ease',
      }}>
        <div css={{ fontSize: '28px' }}>{icon}</div>
      </div>

      <div css={{
        fontSize: '18px',
        fontWeight: '600',
        color: themeColors.foreground,
        marginBottom: '8px',
        position: 'relative',
        zIndex: 1,
        transition: 'color 0.3s ease',
      }}>
        {title}
      </div>

      <div css={{
        fontSize: '14px',
        color: themeColors.foregroundMuted,
        marginBottom: '16px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        transition: 'color 0.3s ease',
      }}>
        {description}
      </div>

      <div css={{
        position: 'relative',
        zIndex: 1
      }}>
        {requirements.map((req, index) => (
          <div key={index} css={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
            fontSize: '13px',
            color: themeColors.foregroundMuted,
            transition: 'color 0.3s ease',
          }}>
            <div css={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: themeColors.foregroundMuted,
              marginRight: '8px',
              transition: 'background-color 0.3s ease',
            }} />
            {req}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};

export const CreatePaymentForm = ({
  selectedDate,
  selectedRoute,
  selectedLead,
  refreshKey,
  onSaveComplete,
  showAllLocalities = false,
  showOnlyIncompleteAvals = false
}: {
  selectedDate: Date,
  selectedRoute: Route | null,
  selectedLead: Employee | null,
  refreshKey: number,
  onSaveComplete?: () => void,
  showAllLocalities?: boolean,
  showOnlyIncompleteAvals?: boolean
}) => {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

  // Ocultar spinners de inputs numéricos para prevenir cambios accidentales
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      input[type="number"]::-webkit-outer-spin-button,
      input[type="number"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type="number"] {
        -moz-appearance: textfield;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [state, setState] = useState<{
    payments: LoanPayment[];
    comission: number;
    isModalOpen: boolean;
    isFalcoModalOpen: boolean;
    isCreateFalcoModalOpen: boolean;
    isMovePaymentsModalOpen: boolean;
    isMultaModalOpen: boolean;
    falcoPaymentAmount: number;
    selectedFalcoId: string | null;
    createFalcoAmount: number;
    loadPaymentDistribution: {
      cashPaidAmount: number;
      bankPaidAmount: number;
      totalPaidAmount: number;
    };
    existingPayments: any[];
    editedPayments: { [key: string]: any };
    isEditing: boolean;
    showSuccessMessage: boolean;
    hasUserEditedDistribution: boolean;
    groupedPayments?: Record<string, {
      payments: Array<{
        amount: number;
        comission: number;
        loanId: string;
        type: string;
        paymentMethod: string;
      }>;
      expectedAmount: number;
      cashPaidAmount: number;
      bankPaidAmount: number;
      falcoAmount: number;
      paymentDate: string;
    }>;
  }>({
    payments: [],
    comission: 8,
    isModalOpen: false,
    isFalcoModalOpen: false,
    isCreateFalcoModalOpen: false,
    isMovePaymentsModalOpen: false,
    isMultaModalOpen: false,
    falcoPaymentAmount: 0,
    selectedFalcoId: null,
    createFalcoAmount: 0,
    loadPaymentDistribution: {
      cashPaidAmount: 0,
      bankPaidAmount: 0,
      totalPaidAmount: 0,
    },
    existingPayments: [],
    editedPayments: {},
    isEditing: false,
    showSuccessMessage: false,
    hasUserEditedDistribution: false,
  });

  const [massCommission, setMassCommission] = useState<string>('0');
  const [showTooltips, setShowTooltips] = useState<{ [key: string]: boolean }>({});

  const [multaData, setMultaData] = useState({
    amount: '',
    description: '',
    destinationAccountId: null as string | null
  });

  const {
    payments, comission, isModalOpen, isFalcoModalOpen, isCreateFalcoModalOpen, isMovePaymentsModalOpen, isMultaModalOpen, falcoPaymentAmount,
    selectedFalcoId, createFalcoAmount, loadPaymentDistribution, existingPayments, editedPayments,
    isEditing, showSuccessMessage, groupedPayments, hasUserEditedDistribution
  } = state;

  const [strikethroughPaymentIds, setStrikethroughPaymentIds] = useState<string[]>([]);
  const [strikethroughNewPaymentIndices, setStrikethroughNewPaymentIndices] = useState<number[]>([]);
  const [previousValuesByPaymentId, setPreviousValuesByPaymentId] = useState<Record<string, { amount: number; comission: number }>>({});
  const [manuallyEditedCommissions, setManuallyEditedCommissions] = useState<Set<string>>(new Set());
  const [showMenuForPayment, setShowMenuForPayment] = useState<string | null>(null);

  const [deceasedModal, setDeceasedModal] = useState<{
    isOpen: boolean;
    loanId: string | null;
    clientName: string;
  }>({
    isOpen: false,
    loanId: null,
    clientName: ''
  });

  const [avalEditModal, setAvalEditModal] = useState<{
    isOpen: boolean;
    loan: any | null;
  }>({
    isOpen: false,
    loan: null
  });

  const [editingAvalData, setEditingAvalData] = useState<any>(null);
  const [selectedRowsForDeletion, setSelectedRowsForDeletion] = useState<Set<string>>(new Set());

  // Función para detectar préstamos con avales incompletos
  const hasIncompleteAval = (loan: Loan | undefined | null): boolean => {
    if (!loan) return false;
    if (!loan.collaterals || loan.collaterals.length === 0) {
      return true; // Sin aval
    }
    const firstCollateral = loan.collaterals[0];
    const avalName = firstCollateral?.fullName || '';
    const avalPhone = firstCollateral?.phones?.[0]?.number || '';
    return !avalName || avalName.trim() === '' || !avalPhone || avalPhone.trim() === '';
  };

  useEffect(() => {
    console.log('editingAvalData changed:', editingAvalData);
  }, [editingAvalData]);

  const handleRowSelection = (paymentId: string, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    const hasNoSelectAttribute = target.closest('[data-no-select="true"]');
    if (hasNoSelectAttribute) {
      return;
    }

    const isInteractiveElement = target.closest(`
      input,
      select,
      button,
      [role="button"],
      .react-select__control,
      .react-select__menu,
      .react-select__value-container,
      .react-select__input-container,
      .react-select__indicators,
      .react-select__indicator,
      .react-select__dropdown-indicator,
      .react-select__clear-indicator,
      .react-select__placeholder,
      .react-select__single-value,
      .react-select__multi-value,
      .react-select__option,
      [data-testid*="select"],
      [class*="select"],
      [class*="dropdown"]
    `);

    if (isInteractiveElement) {
      return;
    }

    if (paymentId.startsWith('new-')) {
      const index = parseInt(paymentId.replace('new-', ''));
      setStrikethroughNewPaymentIndices(prev => {
        if (prev.includes(index)) {
          return prev.filter(i => i !== index);
        } else {
          return [...prev, index];
        }
      });
    } else {
      setStrikethroughPaymentIds(prev => {
        if (prev.includes(paymentId)) {
          return prev.filter(id => id !== paymentId);
        } else {
          return [...prev, paymentId];
        }
      });
    }
  };

  const clearAllSelections = () => {
    setSelectedRowsForDeletion(new Set());
    setStrikethroughPaymentIds([]);
    setStrikethroughNewPaymentIndices([]);
  };

  const [promoteModal, setPromoteModal] = useState<{
    isOpen: boolean;
    clientId: string | null;
    clientName: string;
    currentLeadId: string | null;
  }>({
    isOpen: false,
    clientId: null,
    clientName: '',
    currentLeadId: null
  });

  const [deceasedLoanIds, setDeceasedLoanIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  const updateState = (updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    if (!showMenuForPayment) return;
    const handleClickOutside = () => setShowMenuForPayment(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenuForPayment(null);
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenuForPayment]);

  // ============================================
  // QUERIES - Must be called before any returns
  // ============================================
  
  // Query para obtener préstamos
  // Cuando showAllLocalities está activo, no filtrar por lead (para ver todos los avales incompletos)
  const { data: loansData, loading: loansLoading, error: loansError, refetch: refetchLoans } = useQuery<{ loans: Loan[] }>(GET_LOANS_BY_LEAD, {
    variables: { 
      where: {
        AND: [
          { finishedDate: { equals: null } },
          { pendingAmountStored: { gt: "0" } },
          { excludedByCleanup: null },
          // Solo filtrar por lead si NO está activo "mostrar todas las localidades"
          ...(!showAllLocalities && selectedLead?.id ? [{ lead: { id: { equals: selectedLead.id } } }] : []),
          // Si está activo "mostrar solo incompletos", filtrar en el servidor también
          ...(showOnlyIncompleteAvals ? [{
            OR: [
              // Sin collaterals
              { collaterals: { none: {} } },
              // Con collaterals pero sin phones
              { collaterals: { some: { phones: { none: {} } } } }
            ]
          }] : [])
        ]
      }
    },
    // NO saltar la query cuando showAllLocalities está activo
    skip: showAllLocalities ? false : (!selectedLead || !selectedRoute),
  });

  const { data: paymentsData, loading: paymentsLoading, refetch: refetchPayments } = useQuery(GET_LEAD_PAYMENTS, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : new Date().toISOString(),
      nextDate: selectedDate ? new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString() : new Date().toISOString(),
      leadId: selectedLead?.id || ''
    },
    skip: !selectedDate || !selectedLead || !selectedRoute,
  });

  const { data: falcosData, loading: falcosLoading, refetch: refetchFalcos } = useQuery(GET_LEAD_FALCOS, {
    variables: { leadId: selectedLead?.id || '' },
    skip: !selectedLead || !selectedRoute,
  });

  const { data: migratedPaymentsData, loading: migratedPaymentsLoading, refetch: refetchMigratedPayments } = useQuery(GET_MIGRATED_PAYMENTS, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : new Date().toISOString(),
      nextDate: selectedDate ? new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString() : new Date().toISOString(),
      leadId: selectedLead?.id || ''
    },
    skip: !selectedDate || !selectedLead || !selectedRoute,
  });

  const { data: accountsData } = useQuery(GET_ACCOUNTS, {
    variables: { routeId: selectedRoute?.id || null },
    skip: !selectedRoute?.id,
  });

  // ============================================
  // MUTATIONS - Must be called before any returns
  // ============================================
  const [createCustomLeadPaymentReceived, { error: customLeadPaymentError, loading: customLeadPaymentLoading }] = useMutation(CREATE_LEAD_PAYMENT_RECEIVED);
  const [updateCustomLeadPaymentReceived, { loading: updateLoading }] = useMutation(UPDATE_LEAD_PAYMENT);
  const [createFalcoPayment, { loading: falcoPaymentLoading }] = useMutation(CREATE_FALCO_PAYMENT);
  const [markLoanAsDeceased, { loading: markDeceasedLoading }] = useMutation(MARK_LOAN_AS_DECEASED);
  const [unmarkLoanAsDeceased, { loading: unmarkDeceasedLoading }] = useMutation(UNMARK_LOAN_AS_DECEASED);
  const [updateLoanWithAval, { loading: updateLoanWithAvalLoading }] = useMutation(UPDATE_LOAN_WITH_AVAL);
  const [createIncomeTransaction, { loading: createIncomeLoading }] = useMutation(CREATE_INCOME_TRANSACTION);

  // ============================================
  // EFFECTS - Must be called before any returns
  // ============================================
  
  // Combinar pagos regulares y migrados
  useEffect(() => {
    const regularPayments = paymentsData?.loanPayments || [];
    const migratedPayments = migratedPaymentsData?.loanPayments || [];
    
    if (regularPayments.length > 0 || migratedPayments.length > 0) {
      const markedMigratedPayments = migratedPayments.map((payment: LoanPaymentType) => ({
        ...payment,
        isMigrated: true
      }));

      const allPayments = [...regularPayments, ...markedMigratedPayments];

      const paymentsWithDefaultCommissions = allPayments.map((payment: LoanPaymentType) => {
        const defaultCommission = payment.loan?.loantype?.loanPaymentComission;
        return {
          ...payment,
          type: 'PAYMENT',
          ...(defaultCommission && parseFloat(defaultCommission) > 0 ? {
            comission: Math.round(parseFloat(defaultCommission))
          } : {})
        };
      });
      
      updateState({ existingPayments: paymentsWithDefaultCommissions });
    }
  }, [paymentsData, migratedPaymentsData, selectedDate, selectedLead?.id]);

  // Filtrar préstamos en el cliente cuando showOnlyIncompleteAvals está activo
  const filteredLoans = useMemo(() => {
    if (!loansData?.loans) return [];
    let loans = loansData.loans;
    
    // Si está activo "mostrar solo incompletos", aplicar filtro completo en el cliente
    if (showOnlyIncompleteAvals) {
      loans = loans.filter(hasIncompleteAval);
    }
    
    return loans;
  }, [loansData?.loans, showOnlyIncompleteAvals]);

  // Cargar pagos desde préstamos si no hay pagos existentes
  useEffect(() => {
    if (filteredLoans.length > 0 && existingPayments.length === 0) {
      const newPayments = filteredLoans.map(loan => ({
        amount: loan.weeklyPaymentAmount,
        comission: loan.loantype?.loanPaymentComission ? Math.round(parseFloat(loan.loantype.loanPaymentComission)) : Math.round(comission),
        loanId: loan.id,
        type: 'PAYMENT',
        paymentMethod: 'CASH',
        isNew: true,
        isUserAdded: false,
        loan: {
          id: loan.id,
          signDate: loan.signDate,
          borrower: loan.borrower,
          loantype: loan.loantype
        }
      }));
      
      const sortedNewPayments = newPayments.sort((a: NewPayment, b: NewPayment) => {
        const dateA = new Date(a.loan?.signDate || '1970-01-01');
        const dateB = new Date(b.loan?.signDate || '1970-01-01');
        return dateA.getTime() - dateB.getTime();
      });
      
      updateState({ payments: sortedNewPayments });
    } else if (existingPayments.length > 0) {
      updateState({ payments: [] });
    }
  }, [filteredLoans, comission, existingPayments.length]);

  // Handlers
  const handleAddPayment = () => {
    updateState({
      payments: [
        ...payments,
        {
          amount: '',
          loanId: '',
          type: 'PAYMENT',
          comission: comission,
          paymentMethod: 'CASH',
          isUserAdded: true,
        }
      ]
    });
  };

  const handleRemovePayment = (index: number) => {
    const newPayments = payments.filter((_, i) => i !== index);
    updateState({ payments: newPayments });
  };

  const handleChange = (index: number, field: keyof LoanPayment, value: string | number) => {
    const newPayments = [...payments];
    if (field === 'loanId') {
      newPayments[index][field] = value as string;
      
      if (value && loansData?.loans) {
        const selectedLoanData = loansData.loans.find(loan => loan.id === value);
        if (selectedLoanData?.loantype?.loanPaymentComission) {
          const defaultCommission = Math.round(parseFloat(selectedLoanData.loantype.loanPaymentComission));
          if (defaultCommission > 0) {
            newPayments[index].comission = defaultCommission;
          }
        }
      }
    } else if (field === 'comission') {
      (newPayments[index][field] as unknown as string) = value as string;
      const paymentKey = `new-${index}`;
      setManuallyEditedCommissions(prev => new Set(prev).add(paymentKey));
    } else if (field === 'amount') {
      (newPayments[index][field] as string) = value === null || value === undefined || value === '' ? '0' : value as string;
    } else {
      (newPayments[index][field] as string) = value as string;
    }
    updateState({ payments: newPayments });
  };

  const handleEditExistingPayment = (paymentId: string, field: string, value: string | number) => {
    const payment = existingPayments.find(p => p.id === paymentId);
    if (!payment) return;

    const currentPayment = editedPayments[paymentId] || payment;
    const updatedPayment: EditedPayment = {
      ...currentPayment,
      [field]: value
    };

    setState(prev => ({
      ...prev,
      editedPayments: {
        ...prev.editedPayments,
        [paymentId]: updatedPayment
      }
    }));
  };

  // Calcular totales
  const totalAmount = useMemo(() => {
    return payments
      .filter((_, index) => !strikethroughNewPaymentIndices.includes(index))
      .reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);
  }, [payments, strikethroughNewPaymentIndices]);

  const totalByPaymentMethod = useMemo(() => {
    let cashTotal = 0;
    let transferTotal = 0;

    payments
      .filter((_: LoanPayment, idx: number) => !strikethroughNewPaymentIndices.includes(idx))
      .forEach((payment: LoanPayment) => {
        const amount = parseFloat(payment.amount || '0');
        if (payment.paymentMethod === 'CASH') {
          cashTotal += amount;
        } else if (payment.paymentMethod === 'MONEY_TRANSFER') {
          transferTotal += amount;
        }
      });

    existingPayments
      .filter((payment: ExistingPayment) => !strikethroughPaymentIds.includes(payment.id))
      .forEach((payment: ExistingPayment) => {
        const editedPayment = editedPayments[payment.id] || payment;
        const amount = parseFloat(editedPayment.amount || '0');
        if (editedPayment.paymentMethod === 'CASH') {
          cashTotal += amount;
        } else if (editedPayment.paymentMethod === 'MONEY_TRANSFER') {
          transferTotal += amount;
        }
      });

    return { cashTotal, transferTotal };
  }, [payments, existingPayments, editedPayments, strikethroughNewPaymentIndices, strikethroughPaymentIds]);

  const totalComission = useMemo(() => {
    return payments
      .filter((_, index) => !strikethroughNewPaymentIndices.includes(index))
      .reduce((sum, payment) => sum + parseFloat(payment.comission.toString() || '0'), 0);
  }, [payments, strikethroughNewPaymentIndices]);

  const totalExistingAmount = useMemo(() => {
    return existingPayments
      .filter((payment: ExistingPayment) => !strikethroughPaymentIds.includes(payment.id))
      .reduce((sum: number, payment: ExistingPayment) => {
        const editedPayment = editedPayments[payment.id] || payment;
        return sum + parseFloat(editedPayment.amount || '0');
      }, 0);
  }, [existingPayments, editedPayments, strikethroughPaymentIds]);

  const totalExistingComission = useMemo(() => {
    return existingPayments
      .filter((payment: ExistingPayment) => !strikethroughPaymentIds.includes(payment.id))
      .reduce((sum: number, payment: ExistingPayment) => {
        const editedPayment = editedPayments[payment.id] || payment;
        return sum + parseFloat(editedPayment.comission || '0');
      }, 0);
  }, [existingPayments, editedPayments, strikethroughPaymentIds]);

  const grandTotalAmount = useMemo(() => totalAmount + totalExistingAmount, [totalAmount, totalExistingAmount]);
  const grandTotalComission = useMemo(() => totalComission + totalExistingComission, [totalComission, totalExistingComission]);

  // Calcular distribución de pago de la líder (efectivo vs transferencia)
  const computedLoadPaymentDistribution = useMemo(() => {
    const availableCash = totalByPaymentMethod.cashTotal;

    // Tomar bankPaidAmount persistido si existe en algún pago existente (leadPaymentReceived)
    const persistedBank = (() => {
      const found = existingPayments.find((p: ExistingPayment) => 
        (p as ExistingPayment & { leadPaymentReceived?: { bankPaidAmount?: string | number } }).leadPaymentReceived?.bankPaidAmount !== undefined
      );
      if (!found) return undefined;
      const raw = (found as ExistingPayment & { leadPaymentReceived?: { bankPaidAmount?: string | number } }).leadPaymentReceived?.bankPaidAmount;
      if (raw === null || raw === undefined) return undefined;
      const num = parseFloat(raw.toString());
      return isFinite(num) ? num : undefined;
    })();

    // Si el usuario ya editó manualmente la distribución, respetar su entrada
    const requestedTransfer = hasUserEditedDistribution
      ? loadPaymentDistribution.bankPaidAmount
      : (persistedBank !== undefined ? persistedBank : loadPaymentDistribution.bankPaidAmount);

    // Limitar transferencia al efectivo disponible
    const validTransfer = Math.min(Math.max(0, requestedTransfer || 0), Math.max(0, availableCash));

    return {
      totalPaidAmount: totalAmount,
      bankPaidAmount: validTransfer,
      cashPaidAmount: Math.max(0, availableCash - validTransfer)
    };
  }, [totalAmount, totalByPaymentMethod.cashTotal, loadPaymentDistribution.bankPaidAmount, existingPayments, hasUserEditedDistribution]);

  // Calcular créditos que debían pagar pero no aparecen registrados (SIN PAGO)
  const missingPayments = useMemo(() => {
    // Solo mostrar si ya hay pagos existentes para esta fecha
    if (!filteredLoans || filteredLoans.length === 0 || !selectedDate || existingPayments.length === 0) return [];
    
    const selectedDateObj = new Date(selectedDate);
    
    // Obtener IDs de préstamos que SÍ tienen pagos registrados
    const paidLoanIds = new Set(
      existingPayments
        .map((payment: ExistingPayment) => payment.loan?.id)
        .filter(Boolean)
    );
    
    // Filtrar préstamos que debían pagar en esta fecha pero no tienen pago registrado
    const missing = filteredLoans.filter((loan: Loan) => {
      // Verificar que el préstamo está activo (no terminado)
      if (loan.finishedDate) return false;
      
      // Verificar que el préstamo ya había comenzado antes de la fecha seleccionada
      const signDate = new Date(loan.signDate);
      if (signDate >= selectedDateObj) return false;
      
      // Verificar que no tiene pago registrado para esta fecha
      return !paidLoanIds.has(loan.id);
    });
    
    return missing;
  }, [filteredLoans, selectedDate, existingPayments]);

  // Handler para guardar
  const handleSaveAllChanges = async () => {
    try {
      setIsSaving(true);

      const filteredPayments = existingPayments.filter((payment: ExistingPayment) => {
        const isStrikethrough = strikethroughPaymentIds.includes(payment.id);
        const isMigrated = payment.isMigrated;
        return !isStrikethrough && !isMigrated;
      });

      const paymentsByLeadPayment = filteredPayments
        .reduce((acc: Record<string, GroupedPayment>, payment: ExistingPayment) => {
          const leadPaymentId = payment.leadPaymentReceived?.id;
          if (!leadPaymentId) return acc;

          if (!acc[leadPaymentId]) {
            acc[leadPaymentId] = {
              payments: [],
              expectedAmount: 0,
              cashPaidAmount: 0,
              bankPaidAmount: 0,
              falcoAmount: 0,
              paymentDate: payment.leadPaymentReceived?.createdAt || ''
            };
          }

          const editedPayment = editedPayments[payment.id] || payment;
          acc[leadPaymentId].payments.push({
            amount: parseFloat(editedPayment.amount),
            comission: parseFloat(editedPayment.comission),
            loanId: editedPayment.loan?.id || editedPayment.loanId,
            type: editedPayment.type,
            paymentMethod: editedPayment.paymentMethod
          });

          acc[leadPaymentId].expectedAmount += parseFloat(editedPayment.amount);
          if (editedPayment.paymentMethod === 'CASH') {
            acc[leadPaymentId].cashPaidAmount += parseFloat(editedPayment.amount);
          } else {
            acc[leadPaymentId].bankPaidAmount += parseFloat(editedPayment.amount);
          }

          return acc;
        }, {} as Record<string, GroupedPayment>);

      const firstPaymentGroup = Object.values(paymentsByLeadPayment)[0];
      
      if (!firstPaymentGroup) {
        const firstExistingPayment = existingPayments.find((payment: ExistingPayment) => !payment.isMigrated);
        if (firstExistingPayment?.leadPaymentReceived?.id) {
          await updateCustomLeadPaymentReceived({
            variables: {
              id: firstExistingPayment.leadPaymentReceived.id,
              expectedAmount: 0,
              cashPaidAmount: 0,
              bankPaidAmount: 0,
              falcoAmount: 0,
              paymentDate: firstExistingPayment.leadPaymentReceived.createdAt,
              payments: []
            }
          });
        }
      }

      updateState({ 
        isModalOpen: true,
        loadPaymentDistribution: {
          totalPaidAmount: totalAmount,
          cashPaidAmount: totalByPaymentMethod.cashTotal,
          bankPaidAmount: 0,
        }
      });

      setState(prev => ({
        ...prev,
        groupedPayments: paymentsByLeadPayment
      }));
    } catch (error) {
      console.error('Error preparing changes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);

      if (!selectedLead?.id || !selectedDate) {
        alert('Error: Falta información de líder o fecha seleccionada');
        return;
      }

      const { cashPaidAmount, bankPaidAmount } = loadPaymentDistribution;

      // Incluir TODOS los pagos, incluyendo los "sin pago" (strikethrough) con monto 0
      const allNewPayments = payments
        .filter(p => p.loanId) // Solo incluir pagos con loanId válido
        .map((payment, index) => {
          const isSinPago = strikethroughNewPaymentIndices.includes(index);
          return {
            amount: isSinPago ? 0 : parseFloat(payment.amount || '0'),
            comission: isSinPago ? 0 : parseFloat(payment.comission?.toString() || '0'),
            loanId: payment.loanId,
            type: payment.type,
            paymentMethod: isSinPago ? 'CASH' : payment.paymentMethod
          };
        });

      // Calcular el total esperado (solo pagos con monto > 0)
      let expectedTotalAmount = 0;
      if (groupedPayments) {
        const existingAmount = Object.values(groupedPayments)[0]?.expectedAmount || 0;
        const newAmount = allNewPayments.reduce((sum, payment) => sum + payment.amount, 0);
        expectedTotalAmount = existingAmount + newAmount;
      } else if (allNewPayments.length > 0) {
        expectedTotalAmount = allNewPayments.reduce((sum, payment) => sum + payment.amount, 0);
      }

      if (groupedPayments) {
        for (const [leadPaymentId, data] of Object.entries(groupedPayments)) {
          // Filtrar pagos existentes que NO están en strikethrough
          const existingPaymentsArray = data.payments
            .filter((p: PaymentData) => !strikethroughPaymentIds.includes(p.loanId))
            .map((p: PaymentData) => ({
              amount: parseFloat(p.amount?.toString() || '0'),
              comission: parseFloat(p.comission?.toString() || '0'),
              loanId: p.loanId,
              type: p.type,
              paymentMethod: p.paymentMethod
            }));
          
          // Agregar pagos existentes en strikethrough como $0
          const existingSinPagoPayments = data.payments
            .filter((p: PaymentData) => strikethroughPaymentIds.includes(p.loanId))
            .map((p: PaymentData) => ({
              amount: 0,
              comission: 0,
              loanId: p.loanId,
              type: p.type,
              paymentMethod: 'CASH'
            }));
          
          // Combinar todos los pagos
          const allPayments = [...existingPaymentsArray, ...existingSinPagoPayments, ...allNewPayments];
          
          // Calcular el total esperado
          const totalExpected = allPayments.reduce((sum: number, p: PaymentData) => {
            return sum + parseFloat(p.amount?.toString() || '0');
          }, 0);

          await updateCustomLeadPaymentReceived({
            variables: {
              id: leadPaymentId,
              expectedAmount: totalExpected,
              cashPaidAmount,
              bankPaidAmount,
              falcoAmount: 0,
              paymentDate: data.paymentDate,
              payments: allPayments.map((payment: PaymentData) => ({
                amount: parseFloat(payment.amount?.toString() || '0'),
                comission: parseFloat(payment.comission?.toString() || '0'),
                loanId: payment.loanId,
                type: payment.type,
                paymentMethod: payment.paymentMethod
              }))
            }
          });
        }
      } else if (allNewPayments.length > 0) {
        await createCustomLeadPaymentReceived({
          variables: {
            expectedAmount: expectedTotalAmount,
            cashPaidAmount,
            bankPaidAmount,
            agentId: selectedLead.id,
            leadId: selectedLead.id,
            paymentDate: selectedDate.toISOString(),
            payments: allNewPayments.map(payment => ({
              amount: payment.amount,
              comission: payment.comission,
              loanId: payment.loanId,
              type: payment.type,
              paymentMethod: payment.paymentMethod
            }))
          }
        });
      }

      await Promise.all([refetchPayments(), refetchMigratedPayments(), refetchFalcos()]);
      
      // Limpiar estado después de guardar
      setState(prev => ({ 
        ...prev,
        payments: [],
        editedPayments: {},
        isEditing: false,
        isModalOpen: false,
        groupedPayments: undefined
      }));
      
      // Limpiar los strikethrough
      setStrikethroughPaymentIds([]);
      setStrikethroughNewPaymentIndices([]);

      if (onSaveComplete) onSaveComplete();

      updateState({ showSuccessMessage: true });
      setTimeout(() => updateState({ showSuccessMessage: false }), 3000);
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFalcoPayment = async () => {
    try {
      if (!selectedFalcoId || falcoPaymentAmount <= 0) return;

      await createFalcoPayment({
        variables: {
          leadPaymentReceivedId: selectedFalcoId,
          amount: falcoPaymentAmount.toString()
        }
      });

      await Promise.all([refetchFalcos(), refetchPayments(), refetchMigratedPayments()]);
      if (onSaveComplete) onSaveComplete();

      updateState({
        isFalcoModalOpen: false,
        falcoPaymentAmount: 0,
        selectedFalcoId: null,
        showSuccessMessage: true
      });
      setTimeout(() => updateState({ showSuccessMessage: false }), 3000);
    } catch (error) {
      console.error('Error creating falco payment:', error);
    }
  };

  const handleCreateFalco = async () => {
    try {
      if (!selectedLead?.id || !selectedDate || createFalcoAmount <= 0) return;

      await createCustomLeadPaymentReceived({
        variables: {
          expectedAmount: createFalcoAmount,
          cashPaidAmount: 0,
          bankPaidAmount: 0,
          agentId: selectedLead.id,
          leadId: selectedLead.id,
          paymentDate: selectedDate.toISOString(),
          payments: []
        }
      });

      await Promise.all([refetchFalcos(), refetchPayments(), refetchMigratedPayments()]);
      if (onSaveComplete) onSaveComplete();

      updateState({
        isCreateFalcoModalOpen: false,
        createFalcoAmount: 0,
        showSuccessMessage: true
      });
      setTimeout(() => updateState({ showSuccessMessage: false }), 3000);
    } catch (error) {
      console.error('Error creating falco:', error);
    }
  };

  const handleRegisterMulta = async () => {
    try {
      if (!selectedRoute || !selectedDate || !multaData.amount || parseFloat(multaData.amount) <= 0) {
        alert('Por favor completa todos los campos requeridos');
        return;
      }

      let destinationAccountId = multaData.destinationAccountId;
      
      if (!destinationAccountId && accountsData?.accounts) {
        const cashAccount = accountsData.accounts.find((account: Account) => account.type === 'EMPLOYEE_CASH_FUND');
        if (cashAccount) {
          destinationAccountId = cashAccount.id;
        }
      }

      if (!destinationAccountId) {
        alert('No se encontró una cuenta de destino válida');
        return;
      }

      await createIncomeTransaction({
        variables: {
          data: {
            amount: multaData.amount,
            type: 'INCOME',
            incomeSource: 'MULTA',
            description: multaData.description || 'Multa general de localidad',
            date: selectedDate.toISOString(),
            destinationAccount: { connect: { id: destinationAccountId } },
            route: { connect: { id: selectedRoute.id } },
            snapshotRouteId: selectedRoute.id,
          }
        }
      });

      setMultaData({ amount: '', description: '', destinationAccountId: null });
      updateState({ isMultaModalOpen: false, showSuccessMessage: true });
      setTimeout(() => updateState({ showSuccessMessage: false }), 3000);
      if (onSaveComplete) onSaveComplete();
    } catch (error) {
      console.error('Error registrando multa:', error);
      alert('Error al registrar la multa: ' + (error as Error).message);
    }
  };

  // Función para cerrar modal de edición de aval
  const closeAvalEditModal = () => {
    setAvalEditModal({
      isOpen: false,
      loan: null
    });
    setEditingAvalData(null);
  };

  // Función para guardar los cambios del aval
  const handleSaveAvalChanges = async () => {
    if (!editingAvalData || !avalEditModal.loan) {
      console.log('❌ No hay datos del aval para guardar');
      return;
    }

    try {
      console.log('💾 Guardando cambios del aval:', editingAvalData);
      
      const loanId = avalEditModal.loan.id;
      
      // Preparar datos para la mutación
      const avalData = editingAvalData.id
        ? {
            selectedCollateralId: editingAvalData.id,
            action: 'connect' as const
          }
        : (
            (editingAvalData.fullName || editingAvalData.phone)
              ? {
                  name: editingAvalData.fullName || '',
                  phone: editingAvalData.phone || '',
                  action: editingAvalData.avalAction || 'create'
                }
              : { action: 'clear' as const }
          );

      console.log('🔄 Enviando actualización de aval:', avalData);

      const { data } = await updateLoanWithAval({
        variables: {
          where: loanId,
          data: {
            avalData
          }
        }
      });

      const response = data?.updateLoanWithAval;
      console.log('📊 Respuesta de updateLoanWithAval:', response);

      if (response?.success) {
        console.log('✅ Aval actualizado exitosamente');
        closeAvalEditModal();
        
        // Refrescar los datos de loans
        await refetchLoans();
        console.log('✅ Datos de loans refrescados');
        
        if (onSaveComplete) {
          onSaveComplete();
        }
      } else {
        console.error('❌ Error en la respuesta de updateLoanWithAval:', response);
        throw new Error(response?.message || 'Error desconocido al actualizar aval');
      }
    } catch (error) {
      console.error('❌ Error al actualizar el aval:', error);
    }
  };

  // ============================================
  // EARLY RETURNS - After all hooks
  // ============================================
  
  if (!selectedRoute && !showAllLocalities) {
    return (
      <SelectionMessage
        icon="📋"
        title="Selecciona una Ruta"
        description="Para registrar abonos, primero debes seleccionar una ruta."
        requirements={[
          "Selecciona una ruta del menú superior",
          "Luego selecciona una localidad (líder)",
          "Podrás ver y registrar los abonos de los clientes"
        ]}
      />
    );
  }

  if (!selectedLead && !showAllLocalities) {
    return (
      <SelectionMessage
        icon="📍"
        title="Selecciona una Localidad"
        description="Para registrar abonos, debes seleccionar una localidad específica."
        requirements={[
          "Selecciona una localidad del menú superior",
          "Se mostrarán los clientes de esa localidad",
          "Podrás registrar los abonos del día"
        ]}
      />
    );
  }

  // Loading state - Solo mostrar loading si estamos cargando préstamos
  // Las otras queries (payments, migrated, falcos) solo se ejecutan cuando hay selectedLead
  if (loansLoading || (selectedLead && (paymentsLoading || migratedPaymentsLoading || falcosLoading))) {
  return (
    <div css={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: isDark
          ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        borderRadius: '12px',
        margin: '20px',
      transition: 'all 0.3s ease',
    }}>
      <div css={{
          width: '60px',
          height: '60px',
          border: `4px solid ${themeColors.border}`,
          borderTop: `4px solid ${themeColors.primary}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px',
        }} />
        <div css={{
          fontSize: '18px',
          fontWeight: '600',
          color: themeColors.foreground,
          marginBottom: '8px',
        }}>
          Cargando abonos...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (loansError) {
    return <GraphQLErrorNotice errors={loansError?.graphQLErrors || []} networkError={loansError?.networkError} />;
  }

  const migratedPaymentsCount = existingPayments.filter((payment: ExistingPayment) => payment.isMigrated).length;

  return (
    <div css={{ paddingTop: '16px', transition: 'all 0.3s ease' }}>
      {customLeadPaymentError && (
        <GraphQLErrorNotice
          networkError={customLeadPaymentError?.networkError}
          errors={customLeadPaymentError?.graphQLErrors}
        />
      )}

      {/* Banner de loading cuando se están guardando los pagos */}
      {isSaving && (
    <div css={{
          backgroundColor: themeColors.infoBackground,
          border: `2px solid ${themeColors.info}`,
        borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        transition: 'all 0.3s ease',
      }}>
          <div css={{
            width: '20px',
            height: '20px',
            border: `3px solid ${themeColors.border}`,
            borderTop: `3px solid ${themeColors.info}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div css={{ flex: 1 }}>
            <div css={{
              fontWeight: '600',
              color: themeColors.info,
              fontSize: '14px',
              marginBottom: '4px',
            }}>
              Guardando pagos...
            </div>
            <div css={{
              color: themeColors.infoForeground,
              fontSize: '13px',
              lineHeight: '1.4',
            }}>
              Por favor espera mientras se procesan los pagos y se actualizan los balances.
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de éxito */}
      {showSuccessMessage && (
        <div css={{
          backgroundColor: themeColors.successBackground,
          border: `2px solid ${themeColors.success}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '16px',
          fontWeight: '600',
          color: themeColors.success,
          transition: 'all 0.3s ease',
        }}>
          <span>✅</span>
          <span>Cambios guardados exitosamente</span>
        </div>
      )}

      {/* Banner de datos migrados */}
      {migratedPaymentsCount > 0 && (
        <div css={{
          backgroundColor: themeColors.warningBackground,
          border: `1px solid ${themeColors.warning}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          transition: 'all 0.3s ease',
        }}>
          <div css={{ fontSize: '20px' }}>📊</div>
          <div css={{ flex: 1 }}>
            <div css={{
              fontWeight: '600',
              color: themeColors.warning,
              fontSize: '14px',
              marginBottom: '4px',
            }}>
              Datos migrados de Excel detectados
            </div>
            <div css={{
              color: themeColors.warningForeground,
              fontSize: '13px',
              lineHeight: '1.4',
            }}>
              Se encontraron {migratedPaymentsCount} pago(s) migrados desde Excel. 
              Estos datos son de solo lectura y no se pueden editar.
            </div>
          </div>
        </div>
      )}

      {/* Barra de KPIs - Diseño moderno 2025 */}
      <div className={kpiStyles.kpiBar}>
        {/* Chips de KPIs */}
        <div className={kpiStyles.kpiChipsContainer}>
          {[
            { label: 'Clientes', value: filteredLoans?.length || 0, variant: 'neutral' },
            { label: 'Abonos', value: payments.length - strikethroughNewPaymentIndices.length, variant: 'blue' },
            { label: 'Sin Pago', value: missingPayments.length + strikethroughPaymentIds.length + strikethroughNewPaymentIndices.length, variant: 'amber' },
            { 
              label: 'Comisiones', 
              value: `$${grandTotalComission.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 
              variant: 'purple',
              showTooltip: true,
              tooltipContent: (() => {
                const breakdown: { [key: string]: { count: number, amount: number } } = {};
                existingPayments
                  .filter((payment: ExistingPayment) => !strikethroughPaymentIds.includes(payment.id))
                  .forEach((payment: ExistingPayment) => {
                    const editedPayment = editedPayments[payment.id] || payment;
                    const c = parseFloat(editedPayment.comission || '0');
                    const k = c.toString();
                    if (!breakdown[k]) breakdown[k] = { count: 0, amount: 0 };
                    breakdown[k].count += 1;
                    breakdown[k].amount += c;
                  });
                payments
                  .filter((_: LoanPayment, idx: number) => !strikethroughNewPaymentIndices.includes(idx))
                  .forEach((payment: LoanPayment) => {
                    const c = parseFloat(payment.comission?.toString() || '0');
                    const k = c.toString();
                    if (!breakdown[k]) breakdown[k] = { count: 0, amount: 0 };
                    breakdown[k].count += 1;
                    breakdown[k].amount += c;
                  });
                const sorted = Object.entries(breakdown).sort(([,a], [,b]) => b.amount - a.amount).slice(0, 5);
                
                if (sorted.length === 0) return null;
                
                return (
                  <div>
                    <div css={{ fontSize: '12px', fontWeight: '600', color: themeColors.foreground, marginBottom: '8px' }}>
                      Desglose de Comisiones
        </div>
                    {sorted.map(([value, data]) => (
                      <div key={value} css={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                        borderBottom: `1px solid ${themeColors.border}`,
                        fontSize: '11px'
                      }}>
                        <span css={{ color: themeColors.foregroundMuted }}>
                          ${parseFloat(value).toFixed(0)} × {data.count}
                        </span>
                        <span css={{ fontWeight: '600', color: themeColors.foreground }}>
                          ${data.amount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
      </div>
                    ))}
                  </div>
                );
              })()
            },
            { label: 'Efectivo', value: `$${totalByPaymentMethod.cashTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, variant: 'green' },
            { label: 'Transferencia', value: `$${totalByPaymentMethod.transferTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, variant: 'blue' },
            { 
              label: 'Total', 
              value: `$${grandTotalAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 
              variant: 'green',
              showTooltip: true,
              tooltipContent: (
                <div>
                  <div css={{ fontSize: '12px', fontWeight: '600', color: themeColors.foreground, marginBottom: '8px' }}>
                    Desglose por Método de Pago
                  </div>
                  <div css={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: `1px solid ${themeColors.border}`,
                    fontSize: '11px'
                  }}>
                    <span css={{ color: themeColors.foregroundMuted }}>
                      💵 Efectivo
                    </span>
                    <span css={{ fontWeight: '600', color: themeColors.foreground }}>
                      ${totalByPaymentMethod.cashTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div css={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    fontSize: '11px'
                  }}>
                    <span css={{ color: themeColors.foregroundMuted }}>
                      🏦 Transferencia
                    </span>
                    <span css={{ fontWeight: '600', color: themeColors.foreground }}>
                      ${totalByPaymentMethod.transferTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              )
            },
            { 
              label: 'Distribución', 
              value: (() => {
                const { cashPaidAmount, bankPaidAmount } = computedLoadPaymentDistribution;
                if (cashPaidAmount === 0 && bankPaidAmount === 0) return 'Sin dist.';
                return `E:$${cashPaidAmount.toLocaleString('es-MX', { maximumFractionDigits: 0 })} T:$${bankPaidAmount.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
              })(), 
              variant: 'amber',
              showTooltip: true,
              tooltipContent: (() => {
                const { cashPaidAmount, bankPaidAmount } = computedLoadPaymentDistribution;
                const totalDistributed = cashPaidAmount + bankPaidAmount;
                const availableCash = totalByPaymentMethod.cashTotal;
                
                return (
                  <div>
                    <div css={{ fontSize: '12px', fontWeight: '600', color: themeColors.foreground, marginBottom: '8px' }}>
                      Distribución del Pago de la Líder
                    </div>
                    <div css={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      borderBottom: `1px solid ${themeColors.border}`,
                      fontSize: '11px'
                    }}>
                      <span css={{ color: themeColors.foregroundMuted }}>
                        💵 Efectivo en Caja
                      </span>
                      <span css={{ fontWeight: '600', color: themeColors.foreground }}>
                        ${cashPaidAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div css={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                      borderBottom: `1px solid ${themeColors.border}`,
                      fontSize: '11px'
                    }}>
                      <span css={{ color: themeColors.foregroundMuted }}>
                        🏦 Transferencia al Banco
                      </span>
                      <span css={{ fontWeight: '600', color: themeColors.foreground }}>
                        ${bankPaidAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div css={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      fontSize: '11px',
                      fontWeight: '600',
                      borderTop: `1px solid ${themeColors.border}`,
                      marginTop: '4px'
                    }}>
                      <span css={{ color: themeColors.foreground }}>
                        Total Distribuido
                      </span>
                      <span css={{ color: themeColors.foreground }}>
                        ${totalDistributed.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    {totalDistributed > availableCash && (
                      <div css={{
                        color: '#DC2626',
                        fontSize: '10px',
                        textAlign: 'center',
                        padding: '6px',
                        backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
                        border: `1px solid ${isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA'}`,
                        borderRadius: '4px',
                        marginTop: '8px'
                      }}>
                        ⚠️ La distribución excede el efectivo disponible
                      </div>
                    )}
                  </div>
                );
              })()
            },
          ].map((chip, index) => (
            <div 
              key={index} 
              className={`${kpiStyles.kpiChip} ${kpiStyles[chip.variant as keyof typeof kpiStyles]}`}
              css={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className={kpiStyles.kpiLabel}>{chip.label}:</span>
              <span className={kpiStyles.kpiValue}>{chip.value}</span>
              
              {chip.showTooltip && chip.tooltipContent && (
                <>
                  <span
                    onMouseEnter={() => setShowTooltips(prev => ({ ...prev, [chip.label]: true }))}
                    onMouseLeave={() => setShowTooltips(prev => ({ ...prev, [chip.label]: false }))}
                    css={{ 
                      cursor: 'help', 
                      width: '16px', 
                      height: '16px', 
                      borderRadius: '8px', 
                      background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', 
                      color: themeColors.foregroundMuted, 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '10px',
                      marginLeft: '2px',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                      }
                    }}
                  >
                    ℹ
                  </span>
                  {showTooltips[chip.label] && (
                    <div css={{
                      position: 'absolute',
                      top: '100%',
                      left: '0',
                      zIndex: 100,
                      backgroundColor: themeColors.card,
                      border: `1px solid ${themeColors.border}`,
                      borderRadius: '8px',
                      padding: '12px',
                      boxShadow: isDark 
                        ? '0 4px 20px rgba(0,0,0,0.5)' 
                        : '0 4px 20px rgba(0,0,0,0.15)',
                      minWidth: '200px',
                      marginTop: '6px'
                    }}>
                      {chip.tooltipContent}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Comisión Masiva */}
          {(payments.length > 0 || (isEditing && existingPayments.length > 0)) && (
            <div className={kpiStyles.kpiChip} css={{ background: themeColors.backgroundSecondary, border: `1px solid ${themeColors.border}` }}>
              <span css={{ fontSize: '12px', color: themeColors.foregroundMuted }}>Comisión:</span>
              <Input
                type="number"
                value={massCommission}
                onChange={(e) => setMassCommission(e.target.value)}
                css={{ width: '60px', height: '32px', fontSize: '11px', textAlign: 'center' }}
                placeholder="0"
              />
              <Button
                onClick={() => {
                  const commission = parseFloat(massCommission);
                  if (isNaN(commission)) return;
                  
                  const newPayments = payments.map(payment => ({
                    ...payment,
                    comission: parseFloat(payment.comission?.toString() || '0') > 0 ? commission : payment.comission
                  }));
                  
                  setState(prev => ({ ...prev, payments: newPayments }));
                }}
                css={{ 
                  fontSize: '11px', 
                  height: '32px', 
                  minWidth: 'auto', 
                  padding: '0 12px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  '&:hover': {
                    backgroundColor: '#15803d',
                  }
                }}
              >
                Aplicar
              </Button>
      </div>
          )}
        </div>

        {/* Botones de acción */}
        <div css={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {/* Botón Reportar Falco */}
          <button
            onClick={() => updateState({ isCreateFalcoModalOpen: true })}
            css={{
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: `1px solid ${themeColors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              height: '38px',
              background: themeColors.card,
              color: themeColors.foreground,
              gap: '6px',
              '&:hover': {
                background: themeColors.backgroundSecondary,
                borderColor: themeColors.borderHover,
              }
            }}
          >
            ⚠️ Reportar Falco
          </button>

          {/* Botón Mover */}
          {existingPayments.length > 0 && (
            <button
              onClick={() => updateState({ isMovePaymentsModalOpen: true })}
              css={{
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: `1px solid ${themeColors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                height: '38px',
                background: themeColors.card,
                color: themeColors.foreground,
                gap: '6px',
                '&:hover': {
                  background: themeColors.backgroundSecondary,
                  borderColor: themeColors.borderHover,
                }
              }}
            >
              📦 Mover
            </button>
          )}

          {/* Botón Guardar */}
          <button
            onClick={() => {
              if (existingPayments.length > 0) {
                // handleSaveAllChanges ya inicializa loadPaymentDistribution
                handleSaveAllChanges();
              } else {
                // Para nuevos pagos, inicializar los valores de distribución
                const initialCashAmount = totalByPaymentMethod.cashTotal;
                const initialTotalAmount = totalAmount;
                
                updateState({
                  isModalOpen: true,
                  loadPaymentDistribution: {
                    totalPaidAmount: initialTotalAmount,
                    cashPaidAmount: initialCashAmount,
                    bankPaidAmount: 0,
                  }
                });
              }
            }}
            disabled={updateLoading}
            css={{
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '8px',
              cursor: updateLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              height: '38px',
              background: updateLoading ? '#9CA3AF' : '#16a34a',
              color: 'white',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              gap: '6px',
              opacity: updateLoading ? 0.7 : 1,
              '&:hover': {
                background: updateLoading ? '#9CA3AF' : '#15803d',
                boxShadow: updateLoading ? 'none' : '0 4px 12px rgba(22, 163, 74, 0.3)',
                transform: updateLoading ? 'none' : 'translateY(-1px)',
              }
            }}
          >
            {updateLoading ? (
              <>
                <svg css={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabla de pagos - Diseño moderno */}
      <div css={{
        backgroundColor: themeColors.card,
        borderRadius: '16px',
        border: isEditing 
          ? `2px solid ${isDark ? '#f59e0b' : '#f59e0b'}` 
          : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: isEditing
          ? (isDark 
              ? '0 0 0 4px rgba(245, 158, 11, 0.15), 0 4px 24px rgba(0, 0, 0, 0.4)' 
              : '0 0 0 4px rgba(245, 158, 11, 0.1), 0 4px 24px rgba(0, 0, 0, 0.06)')
          : (isDark 
              ? '0 4px 24px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)' 
              : '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)'),
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Header con gradiente sutil */}
        <div css={{ 
          padding: '20px 24px',
          background: isEditing
            ? (isDark 
                ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)'
                : 'linear-gradient(180deg, rgba(245, 158, 11, 0.06) 0%, transparent 100%)')
            : (isDark 
                ? 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)'
                : 'linear-gradient(180deg, rgba(0,0,0,0.01) 0%, transparent 100%)'),
          borderBottom: isEditing
            ? `1px solid ${isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)'}`
            : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
        }}>
          <div css={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
          }}>
            <div css={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h3 css={{
                margin: 0, 
                fontSize: '16px', 
          fontWeight: '600',
          color: themeColors.foreground,
                letterSpacing: '-0.01em',
        }}>
                Todos los Abonos
        </h3>
              {isEditing && (
                <span css={{ 
                  fontSize: '11px', 
                  fontWeight: '600',
                  color: isDark ? '#fbbf24' : '#b45309',
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.12)',
                  padding: '6px 12px',
                  borderRadius: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'}`,
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { 
                      boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.3)',
                    },
                    '50%': { 
                      boxShadow: '0 0 0 6px rgba(245, 158, 11, 0)',
                    },
                  },
                }}>
                  <span css={{ 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    backgroundColor: '#f59e0b',
                    animation: 'blink 1s ease-in-out infinite',
                    '@keyframes blink': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.4 },
                    },
                  }} />
                  Modo Edición
                </span>
              )}
            </div>
            <div css={{ display: 'flex', gap: '8px' }}>
              {existingPayments.length > 0 && !isEditing && (
                <button
                  onClick={() => setState(prev => ({ ...prev, isEditing: true }))}
                  css={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: themeColors.foreground,
                    backgroundColor: 'transparent',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                    }
                  }}
                >
                  Editar
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={() => {
                      setState(prev => ({ ...prev, editedPayments: {}, isEditing: false }));
                      setStrikethroughPaymentIds([]);
                      setStrikethroughNewPaymentIndices([]);
                    }}
                    css={{
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: themeColors.foregroundMuted,
                      backgroundColor: 'transparent',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      }
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const allExistingPaymentIds = existingPayments
                        .filter((payment: ExistingPayment) => !payment.isMigrated)
                        .map((payment: ExistingPayment) => payment.id);
                      setStrikethroughPaymentIds(allExistingPaymentIds);
                    }}
                    css={{
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#ef4444',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      }
                    }}
                  >
                    Eliminar Todo
                  </button>
                </>
              )}
              <button
                onClick={handleAddPayment}
                css={{
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: 'white',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(59, 130, 246, 0.3)',
                  '&:hover': {
                    backgroundColor: '#2563eb',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
                  }
                }}
              >
                <FaPlus size={10} /> Agregar
              </button>
              {selectedRoute && (
                <button
                  onClick={() => updateState({ isMultaModalOpen: true })}
                  css={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'white',
                    backgroundColor: '#10b981',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(16, 185, 129, 0.3)',
                    '&:hover': {
                      backgroundColor: '#059669',
                      transform: 'translateY(-1px)',
                    }
                  }}
                >
                  💰 Multa
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabla con diseño compacto */}
        <div css={{ overflowX: 'auto' }}>
          <table css={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
          }}>
            <thead>
              <tr css={{ 
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              }}>
                <th css={{ 
                  width: '50px', 
                  textAlign: 'center',
                  padding: '12px 8px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: themeColors.foregroundMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}>#</th>
                <th css={{ 
                  padding: '12px 16px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: themeColors.foregroundMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'left',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}>Cliente</th>
                <th css={{ 
                  padding: '12px 16px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: themeColors.foregroundMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  width: '100px',
                }}>Fecha</th>
                <th css={{ 
                  padding: '12px 16px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: themeColors.foregroundMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'right',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  width: '100px',
                }}>Monto</th>
                <th css={{ 
                  padding: '12px 16px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: themeColors.foregroundMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'right',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  width: '80px',
                }}>Com.</th>
                <th css={{ 
                  padding: '12px 16px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: themeColors.foregroundMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  width: '110px',
                }}>Método</th>
                <th css={{ 
                  padding: '12px 16px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: themeColors.foregroundMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  width: '50px',
                }}></th>
              </tr>
            </thead>
            <tbody>
              {/* Créditos Sin Pago - Préstamos que debían pagar pero no tienen registro */}
              {missingPayments.map((loan: Loan, index: number) => {
                const rowNumber = existingPayments.length + index + 1;
                const hasIncompleteAvalForMissing = hasIncompleteAval(loan);
                
                return (
                  <tr 
                    key={`missing-${loan.id}`}
                    onClick={(e) => {
                      // Si tiene aval incompleto Y el checkbox está activo, abrir modal de edición de aval
                      if (hasIncompleteAvalForMissing && showOnlyIncompleteAvals) {
                        e.stopPropagation();
                        setAvalEditModal({ isOpen: true, loan });
                      }
                    }}
                    css={{ 
                      backgroundColor: hasIncompleteAvalForMissing 
                        ? (isDark ? 'rgba(249, 115, 22, 0.12)' : '#FFF7ED')
                        : (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2'),
                      borderBottom: `1px solid ${hasIncompleteAvalForMissing 
                        ? (isDark ? 'rgba(249, 115, 22, 0.25)' : '#fed7aa')
                        : (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fecaca')}`,
                      borderLeft: `4px solid ${hasIncompleteAvalForMissing 
                        ? '#f97316' 
                        : (isDark ? '#f87171' : '#ef4444')}`,
                      borderTop: hasIncompleteAvalForMissing 
                        ? `2px dashed ${isDark ? 'rgba(249, 115, 22, 0.5)' : '#f97316'}` 
                        : 'none',
                      cursor: (hasIncompleteAvalForMissing && showOnlyIncompleteAvals) ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                      '&:hover': hasIncompleteAvalForMissing && showOnlyIncompleteAvals ? {
                        backgroundColor: isDark ? 'rgba(249, 115, 22, 0.18)' : '#ffedd5',
                      } : {},
                    }}
                    title={hasIncompleteAvalForMissing && showOnlyIncompleteAvals ? '⚠️ Aval incompleto - Click para editar' : ''}
                  >
                    {/* Número */}
                    <td css={{ 
                      textAlign: 'center',
                      padding: '10px 8px',
                      fontWeight: '600',
                      fontSize: '12px',
                      color: isDark ? '#f87171' : '#dc2626',
                      fontFeatureSettings: '"tnum"',
                    }}>
                      {rowNumber}
                    </td>
                    {/* Cliente */}
                    <td css={{ padding: '10px 16px' }}>
                      <div css={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span css={{
                          padding: '3px 8px',
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                          color: isDark ? '#fca5a5' : '#dc2626',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '700',
                          border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.4)' : '#fca5a5'}`,
                          whiteSpace: 'nowrap',
                        }}>
                          ⚠️ SIN PAGO
                        </span>
                        {hasIncompleteAvalForMissing && (
                          <span css={{
                            padding: '3px 6px',
                            backgroundColor: isDark ? 'rgba(249, 115, 22, 0.2)' : '#FFF7ED',
                            color: isDark ? '#fb923c' : '#ea580c',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '600',
                            border: `1px solid ${isDark ? 'rgba(249, 115, 22, 0.4)' : '#f97316'}`,
                            whiteSpace: 'nowrap',
                          }}>
                            ⚠️ Aval incompleto
                          </span>
                        )}
                        <span css={{
                          fontSize: '13px',
                          fontWeight: '500',
                          color: isDark ? '#fca5a5' : '#dc2626',
                        }}>
                          {loan.borrower?.personalData?.fullName || 'Sin nombre'}
                        </span>
                      </div>
                    </td>
                    {/* Fecha */}
                    <td css={{
                      padding: '10px 16px',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: isDark ? '#f87171' : '#dc2626',
                      fontFeatureSettings: '"tnum"',
                    }}>
                      {loan.signDate 
                        ? new Date(loan.signDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '—'}
                    </td>
                    {/* Monto esperado */}
                    <td css={{ 
                      padding: '10px 16px', 
                      textAlign: 'right',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: isDark ? '#f87171' : '#dc2626',
                      fontFeatureSettings: '"tnum"',
                    }}>
                      ${Math.round(parseFloat(loan.weeklyPaymentAmount || '0')).toLocaleString()}
                    </td>
                    {/* Comisión */}
                    <td css={{ 
                      padding: '10px 16px', 
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: isDark ? '#f87171' : '#dc2626',
                      fontFeatureSettings: '"tnum"',
                    }}>
                      ${Math.round(parseFloat(loan.loantype?.loanPaymentComission || '0'))}
                    </td>
                    {/* Método */}
                    <td css={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span css={{
                        fontSize: '11px',
                        color: isDark ? '#f87171' : '#dc2626',
                      }}>
                        —
                      </span>
                    </td>
                    {/* Acciones */}
                    <td css={{ padding: '10px 8px', textAlign: 'center' }}>
                      {/* Sin acciones para pagos faltantes */}
                    </td>
                  </tr>
                );
              })}

              {/* Pagos existentes */}
              {existingPayments
                .sort((a: ExistingPayment, b: ExistingPayment) => {
                  const sa = a.loan?.signDate || '';
                  const sb = b.loan?.signDate || '';
                  return new Date(sa).getTime() - new Date(sb).getTime();
                })
                .map((payment: ExistingPayment, index: number) => {
                const editedPayment = editedPayments[payment.id] || payment;
                const isStrikethrough = strikethroughPaymentIds.includes(payment.id);
                const hasZeroCommission = parseFloat(editedPayment.comission || '0') === 0;
                const isTransferPayment = editedPayment.paymentMethod === 'MONEY_TRANSFER';
                
                // Detectar si el préstamo tiene aval incompleto
                const paymentLoanId = payment.loan?.id;
                const selectedLoan = loansData?.loans?.find((loan: Loan) => loan.id === paymentLoanId);
                const hasIncompleteAvalForPayment = selectedLoan ? hasIncompleteAval(selectedLoan) : false;

                // Calcular color de fondo según prioridad
                const getRowBackground = () => {
                  if (hasIncompleteAvalForPayment) return isDark ? 'rgba(249, 115, 22, 0.12)' : '#FFF7ED';
                  if (isStrikethrough) return 'rgba(239, 68, 68, 0.08)';
                  if (hasZeroCommission) return isDark ? 'rgba(217, 119, 6, 0.1)' : '#FEF3C7';
                  if (isTransferPayment) return isDark ? 'rgba(139, 92, 246, 0.1)' : '#F3E8FF';
                  return index % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)');
                };

                // Calcular borde izquierdo según prioridad
                const getLeftBorder = () => {
                  if (hasIncompleteAvalForPayment) return '4px solid #f97316';
                  if (isStrikethrough) return '4px solid #ef4444';
                  if (hasZeroCommission) return `4px solid ${isDark ? '#d97706' : '#D97706'}`;
                  if (isTransferPayment) return '4px solid #8B5CF6';
                  return 'none';
                };

                return (
                  <tr 
                    key={`existing-${payment.id}`}
                    onClick={(e) => {
                      // Si tiene aval incompleto, el checkbox está activo y no está en modo edición, abrir modal
                      if (hasIncompleteAvalForPayment && showOnlyIncompleteAvals && selectedLoan && !isEditing) {
                        e.stopPropagation();
                        setAvalEditModal({ isOpen: true, loan: selectedLoan });
                      } else {
                        handleRowSelection(payment.id, e);
                      }
                    }}
                    css={{ 
                      backgroundColor: getRowBackground(),
                      opacity: isStrikethrough ? 0.6 : 1,
                      borderBottom: hasIncompleteAvalForPayment
                        ? `1px solid ${isDark ? 'rgba(249, 115, 22, 0.25)' : '#fed7aa'}`
                        : `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                      borderLeft: getLeftBorder(),
                      borderTop: hasIncompleteAvalForPayment ? `2px dashed ${isDark ? 'rgba(249, 115, 22, 0.5)' : '#f97316'}` : 'none',
                      cursor: (hasIncompleteAvalForPayment && showOnlyIncompleteAvals && !isEditing) ? 'pointer' : 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        backgroundColor: hasIncompleteAvalForPayment && showOnlyIncompleteAvals && !isEditing
                          ? (isDark ? 'rgba(249, 115, 22, 0.18)' : '#ffedd5')
                          : isStrikethrough 
                            ? 'rgba(239, 68, 68, 0.12)'
                            : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
                      }
                    }}
                    title={hasIncompleteAvalForPayment && showOnlyIncompleteAvals && !isEditing ? '⚠️ Aval incompleto - Click para editar' : ''}
                  >
                    {/* Número de fila */}
                    <td css={{ 
                      textAlign: 'center',
                      padding: '10px 8px',
                      fontWeight: '500',
                      fontSize: '12px',
                      color: isStrikethrough ? '#ef4444' : themeColors.foregroundMuted,
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      fontFeatureSettings: '"tnum"',
                    }}>
                      {index + 1}
                    </td>
                    {/* Cliente con código */}
                    <td css={{ 
                      padding: '10px 16px',
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                    }}>
                      <div css={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span css={{
                          padding: '2px 6px',
                          backgroundColor: payment.isMigrated 
                            ? 'rgba(245, 158, 11, 0.12)'
                            : 'rgba(59, 130, 246, 0.1)',
                          color: payment.isMigrated ? '#f59e0b' : '#3b82f6',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '600',
                          fontFamily: 'ui-monospace, monospace',
                          letterSpacing: '0.02em',
                        }}>
                          {payment.loan?.borrower?.personalData?.clientCode || '—'}
                        </span>
                        {/* Indicador de aval incompleto */}
                        {hasIncompleteAvalForPayment && (
                          <span css={{
                            padding: '3px 6px',
                            backgroundColor: isDark ? 'rgba(249, 115, 22, 0.2)' : '#FFF7ED',
                            color: isDark ? '#fb923c' : '#ea580c',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '600',
                            border: `1px solid ${isDark ? 'rgba(249, 115, 22, 0.4)' : '#f97316'}`,
                            whiteSpace: 'nowrap',
                          }}>
                            ⚠️ Aval
                          </span>
                        )}
                        <span css={{
                          fontSize: '13px',
                          fontWeight: '400',
                          color: isStrikethrough ? '#ef4444' : themeColors.foreground,
                        }}>
                          {payment.loan?.borrower?.personalData?.fullName || 'Sin nombre'}
                        </span>
                      </div>
                    </td>
                    {/* Fecha */}
                    <td css={{
                      padding: '10px 16px',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: themeColors.foregroundMuted,
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      fontFeatureSettings: '"tnum"',
                    }}>
                      {payment.loan?.signDate 
                        ? new Date(payment.loan.signDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '—'}
                    </td>
                    {/* Monto */}
                    <td css={{ padding: '10px 16px', textAlign: 'right' }}>
                      {isEditing && !payment.isMigrated ? (
                        <input
                          type="number"
                          value={editedPayment.amount}
                          onChange={e => handleEditExistingPayment(payment.id, 'amount', e.target.value)}
                          disabled={isStrikethrough}
                          css={{
                            width: '80px',
                            padding: '6px 10px',
                            fontSize: '13px',
                            fontWeight: '500',
                            textAlign: 'right',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                            color: themeColors.foreground,
                            fontFeatureSettings: '"tnum"',
                            outline: 'none',
                            transition: 'all 0.15s ease',
                            '&:focus': {
                              borderColor: '#3b82f6',
                              boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
                            }
                          }}
                        />
                      ) : (
                        <span css={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: isStrikethrough ? '#ef4444' : themeColors.foreground,
                          fontFeatureSettings: '"tnum"',
                          textDecoration: isStrikethrough ? 'line-through' : 'none',
                        }}>
                          ${Math.round(parseFloat(payment.amount || '0')).toLocaleString()}
                        </span>
                      )}
                    </td>
                    {/* Comisión */}
                    <td css={{ padding: '10px 16px', textAlign: 'right' }}>
                      {isEditing && !payment.isMigrated ? (
                        <input
                          type="number"
                          value={editedPayment.comission}
                          onChange={e => handleEditExistingPayment(payment.id, 'comission', e.target.value)}
                          disabled={isStrikethrough}
                          css={{
                            width: '60px',
                            padding: '6px 8px',
                            fontSize: '13px',
                            fontWeight: '500',
                            textAlign: 'right',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                            color: themeColors.foreground,
                            fontFeatureSettings: '"tnum"',
                            outline: 'none',
                            transition: 'all 0.15s ease',
                            '&:focus': {
                              borderColor: '#3b82f6',
                              boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
                            }
                          }}
                        />
                      ) : (
                        <span css={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: themeColors.foregroundMuted,
                          fontFeatureSettings: '"tnum"',
                          textDecoration: isStrikethrough ? 'line-through' : 'none',
                        }}>
                          ${Math.round(parseFloat(editedPayment.comission || '0'))}
                        </span>
                      )}
                    </td>
                    {/* Método de pago */}
                    <td css={{ padding: '10px 16px', textAlign: 'center' }}>
                      {isEditing && !payment.isMigrated ? (
                        <select
                          value={editedPayment.paymentMethod}
                          onChange={e => handleEditExistingPayment(payment.id, 'paymentMethod', e.target.value)}
                          disabled={isStrikethrough}
                          css={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                            color: themeColors.foreground,
                            outline: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            '&:focus': {
                              borderColor: '#3b82f6',
                            }
                          }}
                        >
                          {paymentMethods.map(method => (
                            <option key={method.value} value={method.value}>{method.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span css={{
                          fontSize: '11px',
                          fontWeight: '500',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: editedPayment.paymentMethod === 'CASH' 
                            ? 'rgba(16, 185, 129, 0.1)' 
                            : 'rgba(59, 130, 246, 0.1)',
                          color: editedPayment.paymentMethod === 'CASH' 
                            ? '#10b981' 
                            : '#3b82f6',
                        }}>
                          {editedPayment.paymentMethod === 'CASH' ? '💵 Efectivo' : '🏦 Transfer'}
                        </span>
                      )}
                    </td>
                    {/* Acciones */}
                    <td css={{ padding: '10px 8px', textAlign: 'center' }}>
                      {!payment.isMigrated && isEditing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isStrikethrough) {
                              setStrikethroughPaymentIds(prev => prev.filter(id => id !== payment.id));
                            } else {
                              setStrikethroughPaymentIds(prev => [...prev, payment.id]);
                            }
                          }}
                          css={{
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            borderRadius: '6px',
                            backgroundColor: isStrikethrough 
                              ? 'rgba(16, 185, 129, 0.1)' 
                              : 'rgba(239, 68, 68, 0.08)',
                            color: isStrikethrough ? '#10b981' : '#ef4444',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              backgroundColor: isStrikethrough 
                                ? 'rgba(16, 185, 129, 0.2)' 
                                : 'rgba(239, 68, 68, 0.15)',
                            }
                          }}
                        >
                          {isStrikethrough ? '↩' : '×'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Pagos nuevos */}
              {payments.map((payment, index) => {
                const isStrikethrough = strikethroughNewPaymentIndices.includes(index);
                const selectedLoanData = loansData?.loans?.find((loan: Loan) => loan.id === payment.loanId);
                const rowNumber = existingPayments.length + index + 1;
                const hasIncompleteAvalForNewPayment = selectedLoanData ? hasIncompleteAval(selectedLoanData) : false;

                // Calcular color de fondo según prioridad
                const getNewRowBackground = () => {
                  if (hasIncompleteAvalForNewPayment && !isStrikethrough) return isDark ? 'rgba(249, 115, 22, 0.12)' : '#FFF7ED';
                  if (isStrikethrough) return 'rgba(239, 68, 68, 0.08)';
                  return isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)';
                };

                // Calcular borde izquierdo según prioridad
                const getNewLeftBorder = () => {
                  if (hasIncompleteAvalForNewPayment && !isStrikethrough) return '4px solid #f97316';
                  if (isStrikethrough) return '4px solid #ef4444';
                  return 'none';
                };

                return (
                  <tr 
                    key={`new-${index}`}
                    onClick={(e) => {
                      // Si tiene aval incompleto Y el checkbox está activo, abrir modal
                      if (hasIncompleteAvalForNewPayment && showOnlyIncompleteAvals && selectedLoanData && !isStrikethrough) {
                        e.stopPropagation();
                        setAvalEditModal({ isOpen: true, loan: selectedLoanData });
                      } else {
                        handleRowSelection(`new-${index}`, e);
                      }
                    }}
                    css={{ 
                      backgroundColor: getNewRowBackground(),
                      opacity: isStrikethrough ? 0.6 : 1,
                      borderBottom: hasIncompleteAvalForNewPayment && !isStrikethrough
                        ? `1px solid ${isDark ? 'rgba(249, 115, 22, 0.25)' : '#fed7aa'}`
                        : `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                      borderLeft: getNewLeftBorder(),
                      borderTop: hasIncompleteAvalForNewPayment && !isStrikethrough 
                        ? `2px dashed ${isDark ? 'rgba(249, 115, 22, 0.5)' : '#f97316'}` 
                        : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        backgroundColor: hasIncompleteAvalForNewPayment && showOnlyIncompleteAvals && !isStrikethrough
                          ? (isDark ? 'rgba(249, 115, 22, 0.18)' : '#ffedd5')
                          : isStrikethrough 
                            ? 'rgba(239, 68, 68, 0.12)'
                            : (isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)')
                      }
                    }}
                    title={hasIncompleteAvalForNewPayment && showOnlyIncompleteAvals && !isStrikethrough ? '⚠️ Aval incompleto - Click para editar' : ''}
                  >
                    {/* Número */}
                    <td css={{ 
                      textAlign: 'center',
                      padding: '10px 8px',
                      fontWeight: '500',
                      fontSize: '12px',
                      color: isStrikethrough ? '#ef4444' : '#3b82f6',
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      fontFeatureSettings: '"tnum"',
                    }}>
                      {rowNumber}
                    </td>
                    {/* Cliente */}
                    <td css={{ padding: '10px 16px' }}>
                      <div css={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Badge de estado */}
                        {isStrikethrough ? (
                          <span css={{
                            padding: '3px 8px',
                            backgroundColor: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                          }}>
                            SIN PAGO
                          </span>
                        ) : (
                          <>
                            <span css={{
                              padding: '2px 6px',
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '600',
                              fontFamily: 'ui-monospace, monospace',
                            }}>
                              {selectedLoanData?.borrower?.personalData?.clientCode || '—'}
                            </span>
                            {/* Indicador de aval incompleto */}
                            {hasIncompleteAvalForNewPayment && (
                              <span css={{
                                padding: '3px 6px',
                                backgroundColor: isDark ? 'rgba(249, 115, 22, 0.2)' : '#FFF7ED',
                                color: isDark ? '#fb923c' : '#ea580c',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '600',
                                border: `1px solid ${isDark ? 'rgba(249, 115, 22, 0.4)' : '#f97316'}`,
                                whiteSpace: 'nowrap',
                              }}>
                                ⚠️ Aval
                              </span>
                            )}
                          </>
                        )}
                        {/* Nombre del cliente o dropdown */}
                        {payment.isUserAdded && !isStrikethrough ? (
                          <select
                            data-no-select="true"
                            value={payment.loanId}
                            onChange={e => handleChange(index, 'loanId', e.target.value)}
                            css={{
                              flex: 1,
                              padding: '6px 10px',
                              fontSize: '13px',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                              borderRadius: '6px',
                              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                              color: themeColors.foreground,
                              outline: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              maxWidth: '250px',
                              '&:focus': {
                                borderColor: '#3b82f6',
                                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
                              }
                            }}
                          >
                            <option value="">Selecciona cliente...</option>
                            {loansData?.loans?.map(loan => (
                              <option key={loan.id} value={loan.id}>
                                {loan.borrower?.personalData?.fullName || 'Sin nombre'}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span css={{
                            fontSize: '13px',
                            fontWeight: '400',
                            color: isStrikethrough ? themeColors.foregroundMuted : themeColors.foreground,
                            textDecoration: isStrikethrough ? 'line-through' : 'none',
                            opacity: isStrikethrough ? 0.7 : 1,
                          }}>
                            {selectedLoanData?.borrower?.personalData?.fullName || 'Sin nombre'}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Fecha */}
                    <td css={{
                      padding: '10px 16px',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: isStrikethrough ? themeColors.foregroundMuted : themeColors.foregroundMuted,
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      opacity: isStrikethrough ? 0.5 : 1,
                      fontFeatureSettings: '"tnum"',
                    }}>
                      {selectedLoanData?.signDate 
                        ? new Date(selectedLoanData.signDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '—'}
                    </td>
                    {/* Monto */}
                    <td css={{ padding: '10px 16px', textAlign: 'right' }}>
                      {isStrikethrough ? (
                        <span css={{
                          fontSize: '13px',
                          fontWeight: '500',
                          color: themeColors.foregroundMuted,
                          opacity: 0.5,
                        }}>
                          $0
                        </span>
                      ) : (
                        <input
                          data-no-select="true"
                          type="number"
                          value={payment.amount}
                          onChange={e => handleChange(index, 'amount', e.target.value)}
                          css={{
                            width: '80px',
                            padding: '6px 10px',
                            fontSize: '13px',
                            fontWeight: '500',
                            textAlign: 'right',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                            color: themeColors.foreground,
                            fontFeatureSettings: '"tnum"',
                            outline: 'none',
                            transition: 'all 0.15s ease',
                            '&:focus': {
                              borderColor: '#3b82f6',
                              boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
                            }
                          }}
                        />
                      )}
                    </td>
                    {/* Comisión */}
                    <td css={{ padding: '10px 16px', textAlign: 'right' }}>
                      {isStrikethrough ? (
                        <span css={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: themeColors.foregroundMuted,
                          opacity: 0.5,
                        }}>
                          $0
                        </span>
                      ) : (
                        <input
                          data-no-select="true"
                          type="number"
                          value={payment.comission}
                          onChange={e => handleChange(index, 'comission', e.target.value)}
                          css={{
                            width: '60px',
                            padding: '6px 8px',
                            fontSize: '13px',
                            fontWeight: '500',
                            textAlign: 'right',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                            color: themeColors.foreground,
                            fontFeatureSettings: '"tnum"',
                            outline: 'none',
                            transition: 'all 0.15s ease',
                            '&:focus': {
                              borderColor: '#3b82f6',
                              boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
                            }
                          }}
                        />
                      )}
                    </td>
                    {/* Método */}
                    <td css={{ padding: '10px 16px', textAlign: 'center' }}>
                      {isStrikethrough ? (
                        <span css={{
                          fontSize: '11px',
                          color: themeColors.foregroundMuted,
                          opacity: 0.5,
                        }}>
                          —
                        </span>
                      ) : (
                        <select
                          data-no-select="true"
                          value={payment.paymentMethod}
                          onChange={e => handleChange(index, 'paymentMethod', e.target.value)}
                          css={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'white',
                            color: themeColors.foreground,
                            outline: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            '&:focus': {
                              borderColor: '#3b82f6',
                            }
                          }}
                        >
                          {paymentMethods.map(method => (
                            <option key={method.value} value={method.value}>{method.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    {/* Acciones */}
                    <td css={{ padding: '10px 8px', textAlign: 'center' }}>
                      {isStrikethrough ? (
                        <button
                          data-no-select="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Restaurar el pago (quitar de strikethrough)
                            setStrikethroughNewPaymentIndices(prev => prev.filter(i => i !== index));
                          }}
                          css={{
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            cursor: 'pointer',
                            fontSize: '12px',
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            }
                          }}
                          title="Restaurar pago"
                        >
                          ↩
                        </button>
                      ) : payment.isUserAdded ? (
                        <button
                          data-no-select="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePayment(index);
                          }}
                          css={{
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            }
                          }}
                          title="Eliminar"
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de distribución de pagos - Custom Modal */}
      {isModalOpen && (
        <div 
          css={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => updateState({ isModalOpen: false })}
        >
          <div 
            css={{
              width: '100%',
              maxWidth: '480px',
              margin: '20px',
              backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
              borderRadius: '16px',
              boxShadow: isDark 
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.8)' 
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: `1px solid ${isDark ? '#2d2d44' : '#e5e7eb'}`,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div css={{
              padding: '20px 24px',
              borderBottom: `1px solid ${isDark ? '#2d2d44' : '#e5e7eb'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
              <div>
                <h2 css={{ 
                  fontSize: '18px', 
                  fontWeight: '700', 
                  color: isDark ? '#f1f5f9' : '#111827',
                  margin: 0,
                  marginBottom: '4px',
                }}>
                  Distribución del Pago
                </h2>
                <p css={{ 
                  fontSize: '14px', 
                  color: isDark ? '#94a3b8' : '#6b7280',
                  margin: 0,
                }}>
                  Configura cómo se distribuirá el efectivo
                </p>
              </div>
              <button
                onClick={() => updateState({ isModalOpen: false })}
                css={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isDark ? '#2d2d44' : '#f3f4f6',
                  color: isDark ? '#94a3b8' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    backgroundColor: isDark ? '#3d3d5c' : '#e5e7eb',
                    color: isDark ? '#f1f5f9' : '#111827',
                  }
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div css={{ padding: '24px' }}>
              {/* Total a distribuir */}
              <div css={{
                padding: '20px',
                backgroundColor: isDark ? '#1e3a5f' : '#2563eb',
                borderRadius: '12px',
                marginBottom: '20px',
              }}>
                <div css={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: isDark ? '#93c5fd' : 'rgba(255,255,255,0.85)', 
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  Total a Distribuir
                </div>
                <div css={{ 
                  fontSize: '36px', 
                  fontWeight: '700', 
                  color: isDark ? '#60a5fa' : '#ffffff',
                  letterSpacing: '-0.02em',
                }}>
                  ${(payments.length > 0 ? totalAmount : groupedPayments ? Object.values(groupedPayments)[0]?.expectedAmount || 0 : 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* Desglose por método de pago */}
              <div css={{
                padding: '16px',
                backgroundColor: isDark ? '#232340' : '#f8fafc',
                border: `1px solid ${isDark ? '#2d2d44' : '#e2e8f0'}`,
                borderRadius: '12px',
                marginBottom: '20px',
              }}>
                <div css={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: isDark ? '#e2e8f0' : '#374151', 
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Desglose por Método de Pago
                </div>
                <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Efectivo */}
                  <div css={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                    border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0'}`,
                    borderRadius: '10px',
                    gap: '12px',
                  }}>
                    <div css={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#d1fae5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                    }}>💵</div>
                    <div>
                      <div css={{ 
                        fontSize: '10px', 
                        color: isDark ? '#86efac' : '#047857', 
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>Efectivo</div>
                      <div css={{ 
                        fontSize: '18px', 
                        color: isDark ? '#4ade80' : '#059669', 
                        fontWeight: '700',
                      }}>
                        ${totalByPaymentMethod.cashTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                  {/* Transferencia */}
                  <div css={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px',
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                    border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.3)' : '#93c5fd'}`,
                    borderRadius: '10px',
                    gap: '12px',
                  }}>
                    <div css={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                    }}>🏦</div>
                    <div>
                      <div css={{ 
                        fontSize: '10px', 
                        color: isDark ? '#93c5fd' : '#1d4ed8', 
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>Transferencia</div>
                      <div css={{ 
                        fontSize: '18px', 
                        color: isDark ? '#60a5fa' : '#2563eb', 
                        fontWeight: '700',
                      }}>
                        ${totalByPaymentMethod.transferTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Distribución de efectivo */}
              <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Efectivo en caja (read-only) */}
                <div>
                  <label css={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: isDark ? '#e2e8f0' : '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Efectivo en Caja
                  </label>
                  <div css={{
                    padding: '14px 16px',
                    backgroundColor: isDark ? '#232340' : '#f1f5f9',
                    border: `1px solid ${isDark ? '#2d2d44' : '#e2e8f0'}`,
                    borderRadius: '10px',
                    color: isDark ? '#4ade80' : '#059669',
                    fontWeight: '700',
                    fontSize: '18px',
                    height: '52px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    ${loadPaymentDistribution.cashPaidAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div css={{
                    fontSize: '11px',
                    color: isDark ? '#94a3b8' : '#6b7280',
                    marginTop: '6px',
                  }}>
                    Disponible: ${totalByPaymentMethod.cashTotal.toLocaleString('es-MX')}
                  </div>
                </div>

                {/* Transferencia al banco (editable) */}
                <div>
                  <label css={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: isDark ? '#e2e8f0' : '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Enviar al Banco
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalByPaymentMethod.cashTotal}
                    value={loadPaymentDistribution.bankPaidAmount}
                    onChange={(e) => {
                      updateState({ hasUserEditedDistribution: true });
                      const transferAmount = Math.max(0, Math.min(parseFloat(e.target.value) || 0, totalByPaymentMethod.cashTotal));
                      const cashAmount = totalByPaymentMethod.cashTotal - transferAmount;
                      const totalAmountValue = payments.length > 0 ? totalAmount : groupedPayments ? Object.values(groupedPayments)[0]?.expectedAmount || 0 : 0;
                      
                      updateState({
                        loadPaymentDistribution: {
                          ...loadPaymentDistribution,
                          bankPaidAmount: transferAmount,
                          cashPaidAmount: cashAmount,
                          totalPaidAmount: totalAmountValue,
                        }
                      });
                    }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    css={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: '18px',
                      fontWeight: '700',
                      border: loadPaymentDistribution.bankPaidAmount > totalByPaymentMethod.cashTotal 
                        ? '2px solid #ef4444' 
                        : `1px solid ${isDark ? '#3d3d5c' : '#d1d5db'}`,
                      borderRadius: '10px',
                      backgroundColor: isDark ? '#232340' : '#ffffff',
                      color: isDark ? '#60a5fa' : '#2563eb',
                      height: '52px',
                      outline: 'none',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box',
                      '&:focus': {
                        borderColor: '#3b82f6',
                        boxShadow: `0 0 0 3px ${isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.15)'}`,
                      },
                    }}
                    placeholder="0"
                  />
                  <div css={{
                    fontSize: '11px',
                    color: isDark ? '#94a3b8' : '#6b7280',
                    marginTop: '6px',
                  }}>
                    Máximo: ${totalByPaymentMethod.cashTotal.toLocaleString('es-MX')}
                  </div>
                </div>
              </div>

              {/* Error de validación */}
              {loadPaymentDistribution.bankPaidAmount > totalByPaymentMethod.cashTotal && (
                <div css={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: isDark ? '#fca5a5' : '#dc2626',
                  fontSize: '13px',
                  padding: '12px 14px',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2',
                  border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.4)' : '#fecaca'}`,
                  borderRadius: '10px',
                }}>
                  <span css={{ fontSize: '16px' }}>⚠️</span>
                  <span>El monto no puede ser mayor a ${totalByPaymentMethod.cashTotal.toLocaleString('es-MX')}</span>
                </div>
              )}
            </div>

            {/* Footer con botones */}
            <div css={{ 
              padding: '16px 24px 20px',
              borderTop: `1px solid ${isDark ? '#2d2d44' : '#e5e7eb'}`,
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => updateState({ isModalOpen: false })}
                css={{
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: isDark ? '#2d2d44' : '#f3f4f6',
                  color: isDark ? '#e2e8f0' : '#374151',
                  border: `1px solid ${isDark ? '#3d3d5c' : '#d1d5db'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    backgroundColor: isDark ? '#3d3d5c' : '#e5e7eb',
                  }
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || customLeadPaymentLoading || updateLoading || loadPaymentDistribution.bankPaidAmount > totalByPaymentMethod.cashTotal}
                css={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: (isSaving || customLeadPaymentLoading || updateLoading) 
                    ? (isDark ? '#4b5563' : '#9ca3af')
                    : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: (isSaving || customLeadPaymentLoading || updateLoading) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  '&:hover:not(:disabled)': {
                    backgroundColor: '#1d4ed8',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                  },
                  '&:disabled': {
                    opacity: 0.7,
                  }
                }}
              >
                {(isSaving || customLeadPaymentLoading || updateLoading) ? (
                  <>
                    <svg css={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                    </svg>
                    Guardando...
                  </>
                ) : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de crear falco */}
      <Dialog open={isCreateFalcoModalOpen} onOpenChange={(open) => updateState({ isCreateFalcoModalOpen: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar Nueva Falta</DialogTitle>
            <DialogDescription>
              Ingresa el monto de la falta para esta localidad
            </DialogDescription>
          </DialogHeader>
          <DialogClose onClick={() => updateState({ isCreateFalcoModalOpen: false })} />
          
          <div css={{ marginTop: '16px' }}>
            <label css={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: themeColors.foreground 
            }}>
              Monto de la Falta
            </label>
            <Input
              type="number"
              value={createFalcoAmount}
              onChange={(e) => updateState({ createFalcoAmount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
      </div>

          <div css={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <Button
              variant="secondary"
              onClick={() => updateState({ isCreateFalcoModalOpen: false })}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCreateFalco}
              disabled={!createFalcoAmount || createFalcoAmount <= 0}
            >
              Reportar Falta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de registrar multa */}
      <Dialog open={isMultaModalOpen} onOpenChange={(open) => updateState({ isMultaModalOpen: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Multa</DialogTitle>
            <DialogDescription>
              Ingresa los datos de la multa para esta localidad
            </DialogDescription>
          </DialogHeader>
          <DialogClose onClick={() => updateState({ isMultaModalOpen: false })} />
          
          <div css={{ marginTop: '16px' }}>
            <div css={{ marginBottom: '16px' }}>
              <div css={{ fontSize: '14px', fontWeight: '500', color: themeColors.foreground, marginBottom: '8px' }}>
                Ruta: {selectedRoute?.name}
              </div>
              <div css={{ fontSize: '14px', fontWeight: '500', color: themeColors.foreground }}>
                Fecha: {selectedDate?.toLocaleDateString('es-MX')}
              </div>
            </div>
            
            <div css={{ marginBottom: '16px' }}>
              <label css={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: themeColors.foreground 
              }}>
                Monto de la Multa *
              </label>
              <Input
                type="number"
                value={multaData.amount}
                onChange={(e) => setMultaData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            
            <div css={{ marginBottom: '16px' }}>
              <label css={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: themeColors.foreground 
              }}>
                Descripción (opcional)
              </label>
              <Input
                value={multaData.description}
                onChange={(e) => setMultaData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Ej: Multa por retraso en pago"
              />
            </div>

            <div css={{
              backgroundColor: themeColors.infoBackground,
              padding: '12px',
              borderRadius: '6px',
              fontSize: '13px',
              color: themeColors.infoForeground,
              border: `1px solid ${themeColors.info}`
            }}>
              <strong>💡 Información:</strong> Esta multa se registrará como ingreso directo de la localidad.
            </div>
          </div>

          <div css={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <Button
              variant="secondary"
              onClick={() => {
                updateState({ isMultaModalOpen: false });
                setMultaData({ amount: '', description: '', destinationAccountId: null });
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleRegisterMulta}
              disabled={createIncomeLoading || !multaData.amount}
            >
              {createIncomeLoading ? 'Registrando...' : 'Registrar Multa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de edición de cliente */}
      <EditPersonModal
        isOpen={isEditClientModalOpen}
        onClose={() => {
          setIsEditClientModalOpen(false);
          setEditingClient(null);
        }}
        person={editingClient}
        onSave={async () => {
          if (onSaveComplete) onSaveComplete();
          await Promise.all([refetchPayments(), refetchMigratedPayments(), refetchFalcos()]);
          setIsEditClientModalOpen(false);
          setEditingClient(null);
        }}
        title="Editar Cliente"
      />

      {/* Modal de edición de aval */}
      <Dialog open={avalEditModal.isOpen} onOpenChange={(open) => !open && closeAvalEditModal()}>
        <DialogContent css={{ maxWidth: '500px' }}>
          <DialogHeader>
            <DialogTitle>Modificar Información del Aval</DialogTitle>
            <DialogDescription>
              Modifica los datos del aval para el préstamo de {avalEditModal.loan?.borrower?.personalData?.fullName || 'Cliente'}
            </DialogDescription>
          </DialogHeader>
          <DialogClose onClick={closeAvalEditModal} />
          
          <div css={{ marginTop: '24px' }}>
            <AvalInputWithAutocomplete
              loanId="editing-aval"
              currentName={editingAvalData?.fullName || ''}
              currentPhone={editingAvalData?.phone || ''}
              selectedCollateralId={editingAvalData?.id}
              selectedCollateralPhoneId={editingAvalData?.phoneId}
              onAvalChange={(avalData) => {
                setEditingAvalData({
                  ...editingAvalData,
                  fullName: avalData.avalName,
                  phone: avalData.avalPhone,
                  id: avalData.selectedCollateralId,
                  phoneId: avalData.selectedCollateralPhoneId,
                  avalAction: avalData.avalAction
                });
              }}
              onAvalUpdated={async (updatedPerson) => {
                setEditingAvalData((prev: AvalData) => ({
                  ...prev,
                  fullName: updatedPerson.fullName,
                  phone: updatedPerson.phones?.[0]?.number || '',
                  id: updatedPerson.id,
                  phoneId: updatedPerson.phones?.[0]?.id,
                  avalAction: 'update'
                }));
              }}
              usedPersonIds={[]}
              borrowerLocationId={undefined}
              includeAllLocations={false}
              readonly={false}
              isFromPrevious={false}
            />
          </div>

          <div css={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <Button
              variant="secondary"
              onClick={closeAvalEditModal}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAvalChanges}
              disabled={!editingAvalData || updateLoanWithAvalLoading}
            >
              {updateLoanWithAvalLoading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function CustomPage() {
  const { isDark } = useTheme();
  const themeColors = useThemeColors();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [selectedLead, setSelectedLead] = useState<Employee | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showIncompleteAvals, setShowIncompleteAvals] = useState(false);

  const { triggerBalanceRefresh } = useBalanceRefresh();

  useEffect(() => {
    if (showIncompleteAvals) {
      setSelectedRoute(null);
      setSelectedLead(null);
    }
  }, [showIncompleteAvals]);

  return (
    <PageContainer header="Abonos">
      <div css={{ padding: '24px' }}>
        <div css={{ marginBottom: '24px' }}>
          <RouteLeadSelector
            selectedRoute={selectedRoute}
            selectedLead={selectedLead}
            selectedDate={selectedDate}
            onRouteSelect={setSelectedRoute}
            onLeadSelect={setSelectedLead}
            onDateSelect={setSelectedDate}
          />
        </div>

        <div css={{
          backgroundColor: themeColors.card,
          border: `1px solid ${themeColors.border}`,
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '24px',
          transition: 'all 0.3s ease',
        }}>
          <label css={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            color: themeColors.destructive,
            transition: 'color 0.3s ease',
          }}>
            <input
              type="checkbox"
              checked={showIncompleteAvals}
              onChange={(e) => setShowIncompleteAvals(e.target.checked)}
              css={{
                width: '18px',
                height: '18px',
                cursor: 'pointer'
              }}
            />
            <span>Ver avales incompletos</span>
          </label>
          {showIncompleteAvals && (
            <div css={{
              fontSize: '13px',
              color: themeColors.foregroundMuted,
              fontStyle: 'italic',
              padding: '4px 12px',
              backgroundColor: themeColors.warningBackground,
              borderRadius: '6px',
              border: `1px solid ${themeColors.warning}`,
              transition: 'all 0.3s ease',
            }}>
              Mostrando todos los préstamos con avales incompletos. Los préstamos aparecen marcados en naranja. Haz click en ellos para editar.
            </div>
          )}
        </div>

        <CreatePaymentForm
          selectedDate={selectedDate}
          selectedRoute={selectedRoute}
          selectedLead={selectedLead}
          refreshKey={refreshKey}
          onSaveComplete={triggerBalanceRefresh}
          showAllLocalities={showIncompleteAvals}
          showOnlyIncompleteAvals={showIncompleteAvals}
        />
      </div>
    </PageContainer>
  );
}

const HEIGHT_SYSTEM = {
  small: '32px',
  medium: '36px',
  large: '40px',
  xlarge: '44px'
};

const PADDING_SYSTEM = {
  small: '6px 12px',
  medium: '8px 16px',
  large: '10px 20px',
  xlarge: '12px 24px'
};

const FONT_SYSTEM = {
  small: '11px',
  medium: '12px',
  large: '13px',
  xlarge: '14px',
  table: '11px',
  tableHeader: '12px'
};

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '16px',
    fontSize: FONT_SYSTEM.table,
  }
};
