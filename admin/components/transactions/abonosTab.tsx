/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { gql, useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { AlertDialog } from '@keystone-ui/modals';
import { TrashIcon } from '@keystone-ui/icons';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { DatePicker, Select, TextInput } from '@keystone-ui/fields';
import { LoanPayment } from '../../../schema';
import type { Employee, Option } from '../../types/transaction';
import { FaPlus, FaEllipsisV, FaInfoCircle, FaCalendarAlt, FaEdit } from 'react-icons/fa';

// Import components
import RouteLeadSelector from '../routes/RouteLeadSelector';
import KPIBar from './KPIBar';
import { DateMover } from './utils/DateMover';
import { useBalanceRefresh } from '../../contexts/BalanceRefreshContext';
import EditPersonModal from '../loans/EditPersonModal';
import AvalInputWithAutocomplete from '../loans/AvalInputWithAutocomplete';
import { generatePaymentChronology, PaymentChronologyItem } from '../../utils/paymentChronology';
import { GET_LEAD_PAYMENTS } from '../../graphql/queries/payments';
import ReconciliationWidget from './ReconciliationWidget';

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

const GET_LOANS_BY_LEAD = gql`
  query Loans($where: LoanWhereInput!) {
    loans(where: $where, orderBy: [{ signDate: asc }, { id: asc }]) {
      id
      weeklyPaymentAmount
      signDate
      status
      finishedDate
      badDebtDate
      amountGived
      profitAmount
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
      payments {
        id
        receivedAt
        amount
        paymentMethod
      }
    }
  }
`;

// Query to get existing falcos in the locality (any date) - including completed ones
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

// Mutation to create falco compensatory payment
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
  isUserAdded?: boolean; // Indica si el pago fue agregado por el usuario
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

// Route selector component to isolate route-related logic
const RouteSelector = React.memo(({ onRouteSelect, value }: { onRouteSelect: (route: Option | null) => void, value: Option | null }) => {
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

  if (routesLoading) return <LoadingDots label="Loading routes" />;
  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;

  return (
    <Select
      value={value}
      options={routeOptions}
      onChange={onRouteSelect}
      placeholder="Select a route"
    />
  );
});

// Agregar el componente LeadSelector
const LeadSelector = React.memo(({ routeId, onLeadSelect, value }: { routeId: string | undefined, onLeadSelect: (lead: Option | null) => void, value: Option | null }) => {
  const { data: leadsData, loading: leadsLoading, error: leadsError } = useQuery<{ employees: Lead[] }>(GET_LEADS, {
    variables: { routeId: routeId || '' },
    // Removido skip para evitar el error "Rendered more hooks than during the previous render"
    // El query se ejecutará siempre pero puede retornar datos vacíos si routeId es undefined
  });

  const leadOptions = useMemo(() => 
    leadsData?.employees?.map(lead => ({
      value: lead.id,
      label: lead.personalData.fullName,
    })) || [], 
    [leadsData]
  );

  if (leadsLoading) return <LoadingDots label="Loading leads" />;
  if (leadsError) return <GraphQLErrorNotice errors={leadsError?.graphQLErrors || []} networkError={leadsError?.networkError} />;

  return (
    <Select
      value={value}
      options={leadOptions}
      onChange={onLeadSelect}
      placeholder="Select a lead"
    />
  );
});

export interface AbonosProps {
  selectedDate: Date | null;
  selectedRoute: Route | null;
  selectedLead: Employee | null;
  refreshKey: number;
}

// Componente reutilizable para mensaje de selección
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
}) => (
  <Box css={{ 
    display: 'flex', 
    flexDirection: 'column',
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '400px',
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    borderRadius: '12px',
    margin: '20px',
    position: 'relative',
    overflow: 'hidden'
  }}>
    {/* Efecto de ondas de fondo */}
    <Box css={{
      position: 'absolute',
      top: '-50%',
      left: '-50%',
      width: '200%',
      height: '200%',
      background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
      animation: 'pulse 2s ease-in-out infinite'
    }} />
    
    {/* Icono */}
    <Box css={{
      width: '60px',
      height: '60px',
      background: 'rgba(59, 130, 246, 0.1)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '20px',
      position: 'relative',
      zIndex: 1
    }}>
      <Box css={{ fontSize: '28px' }}>{icon}</Box>
    </Box>
    
    {/* Título */}
    <Box css={{
      fontSize: '18px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '8px',
      position: 'relative',
      zIndex: 1
    }}>
      {title}
    </Box>
    
    {/* Descripción */}
    <Box css={{
      fontSize: '14px',
      color: '#6b7280',
      marginBottom: '16px',
      textAlign: 'center',
      position: 'relative',
      zIndex: 1
    }}>
      {description}
    </Box>
    
    {/* Requisitos */}
    <Box css={{
      position: 'relative',
      zIndex: 1
    }}>
      {requirements.map((req, index) => (
        <Box key={index} css={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '8px',
          fontSize: '13px',
          color: '#6b7280'
        }}>
          <Box css={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#9ca3af',
            marginRight: '8px'
          }} />
          {req}
        </Box>
      ))}
    </Box>
    
    {/* CSS para animaciones */}
    <style jsx>{`
      @keyframes pulse {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.05); }
      }
    `}</style>
  </Box>
);

export const CreatePaymentForm = ({ 
  selectedDate, 
  selectedRoute, 
  selectedLead,
  refreshKey,
  onSaveComplete
}: { 
  selectedDate: Date, 
  selectedRoute: Route | null, 
  selectedLead: Employee | null,
  refreshKey: number,
  onSaveComplete?: () => void
}) => {
  const [state, setState] = useState<{
    payments: LoanPayment[];
    comission: number;
    isModalOpen: boolean;
    isFalcoModalOpen: boolean;
    isCreateFalcoModalOpen: boolean;
    isMovePaymentsModalOpen: boolean;
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

  // ✅ AGREGAR: Estado para comisión masiva
  const [massCommission, setMassCommission] = useState<string>('0');

  const { 
    payments, comission, isModalOpen, isFalcoModalOpen, isCreateFalcoModalOpen, isMovePaymentsModalOpen, falcoPaymentAmount, 
    selectedFalcoId, createFalcoAmount, loadPaymentDistribution, existingPayments, editedPayments, 
    isEditing, showSuccessMessage, groupedPayments, hasUserEditedDistribution
  } = state;

  // Estado separado para trackear pagos tachados (eliminados visualmente)
  const [strikethroughPaymentIds, setStrikethroughPaymentIds] = useState<string[]>([]);
  // Estado para trackear pagos nuevos tachados (por índice)
  const [strikethroughNewPaymentIndices, setStrikethroughNewPaymentIndices] = useState<number[]>([]);

  // Estado para recordar valores previos por pago (para restaurar tras deshacer deceso)
  const [previousValuesByPaymentId, setPreviousValuesByPaymentId] = useState<Record<string, { amount: number; comission: number }>>({});

  // Estado para rastrear comisiones editadas manualmente (para evitar recálculo automático)
  const [manuallyEditedCommissions, setManuallyEditedCommissions] = useState<Set<string>>(new Set()); // IDs de pagos existentes o índices de pagos nuevos

  // Estados para el menú de 3 puntos y modal de deceso
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

  // Estado para modal de edición de aval
  const [avalEditModal, setAvalEditModal] = useState<{
    isOpen: boolean;
    loan: any | null;
  }>({
    isOpen: false,
    loan: null
  });

  // Estado para los datos del aval en edición
  const [editingAvalData, setEditingAvalData] = useState<any>(null);

  // Estado para filas seleccionadas para eliminar
  const [selectedRowsForDeletion, setSelectedRowsForDeletion] = useState<Set<string>>(new Set());

  // Debug: Log cuando cambie editingAvalData
  useEffect(() => {
    console.log('🔍 editingAvalData cambió:', editingAvalData);
  }, [editingAvalData]);

  // Función para manejar la selección de filas
  const handleRowSelection = (paymentId: string, event: React.MouseEvent) => {
    // Verificar si el clic fue en un elemento interactivo
    const target = event.target as HTMLElement;
    
    // Verificar si hay texto seleccionado (para evitar activar cuando se selecciona texto)
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      console.log('🔍 Hay texto seleccionado, ignorando selección de fila:', selection.toString());
      return;
    }
    
    // Verificar si el elemento o sus padres tienen el atributo data-no-select
    const hasNoSelectAttribute = target.closest('[data-no-select="true"]');
    if (hasNoSelectAttribute) {
      console.log('🔍 Clic en elemento con data-no-select, ignorando selección de fila:', target);
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
      console.log('🔍 Clic en elemento interactivo, ignorando selección de fila:', target);
      return;
    }

    console.log('🔍 Marcando fila como falta (strikethrough):', paymentId);
    
    // Determinar si es un pago existente o nuevo
    if (paymentId.startsWith('new-')) {
      // Es un pago nuevo - usar índice
      const index = parseInt(paymentId.replace('new-', ''));
      setStrikethroughNewPaymentIndices(prev => {
        if (prev.includes(index)) {
          // Si ya está marcado, lo desmarcamos
          console.log('🔍 Desmarcando pago nuevo como falta:', index);
          return prev.filter(i => i !== index);
        } else {
          // Si no está marcado, lo marcamos
          console.log('🔍 Marcando pago nuevo como falta:', index);
          return [...prev, index];
        }
      });
    } else {
      // Es un pago existente - usar ID
      setStrikethroughPaymentIds(prev => {
        if (prev.includes(paymentId)) {
          // Si ya está marcado, lo desmarcamos
          console.log('🔍 Desmarcando pago existente como falta:', paymentId);
          return prev.filter(id => id !== paymentId);
        } else {
          // Si no está marcado, lo marcamos
          console.log('🔍 Marcando pago existente como falta:', paymentId);
          return [...prev, paymentId];
        }
      });
    }
  };

  // Función para limpiar todas las selecciones
  const clearAllSelections = () => {
    setSelectedRowsForDeletion(new Set());
    setStrikethroughPaymentIds([]);
    setStrikethroughNewPaymentIndices([]);
    console.log('🔍 Todas las selecciones y marcas de falta limpiadas');
  };

  // Estado para el modal de promoción a líder
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

  // Estado para trackear préstamos marcados como deceso
  const [deceasedLoanIds, setDeceasedLoanIds] = useState<Set<string>>(new Set());

  const updateState = (updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Cerrar menú de 3 puntos al hacer click fuera o presionar ESC
  useEffect(() => {
    if (!showMenuForPayment) return;
    const handleClickOutside = () => setShowMenuForPayment(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenuForPayment(null);
    };
    // Usar bubbling (no capture) para evitar cancelar clicks internos del menú
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenuForPayment]);

  const { data: paymentsData, loading: paymentsLoading, refetch: refetchPayments } = useQuery(GET_LEAD_PAYMENTS, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : new Date().toISOString(),
      nextDate: selectedDate ? new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString() : new Date().toISOString(),
      leadId: selectedLead?.id || ''
    },
    skip: !selectedDate || !selectedLead,
  });

  // Query to get existing falcos for the selected lead
  const { data: falcosData, loading: falcosLoading, refetch: refetchFalcos } = useQuery(GET_LEAD_FALCOS, {
    variables: {
      leadId: selectedLead?.id || ''
    },
    skip: !selectedLead,
  });

  const { data: migratedPaymentsData, loading: migratedPaymentsLoading, refetch: refetchMigratedPayments } = useQuery(GET_MIGRATED_PAYMENTS, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : new Date().toISOString(),
      nextDate: selectedDate ? new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString() : new Date().toISOString(),
      leadId: selectedLead?.id || ''
    },
    skip: !selectedDate || !selectedLead,
  });

  // Combinar pagos regulares y migrados
  useEffect(() => {
    const regularPayments = paymentsData?.loanPayments || [];
    const migratedPayments = migratedPaymentsData?.loanPayments || [];
    
    
    
    if (regularPayments.length > 0 || migratedPayments.length > 0) {
      // Marcar los pagos migrados para identificarlos en la UI
      const markedMigratedPayments = migratedPayments.map((payment: any) => ({
        ...payment,
        isMigrated: true // Marcador para identificar datos migrados
      }));

      // Combinar ambos tipos de pagos
      const allPayments = [...regularPayments, ...markedMigratedPayments];

      // ✅ AGREGAR: Cargar comisiones por defecto automáticamente y asegurar tipo 'PAYMENT'
      const paymentsWithDefaultCommissions = allPayments.map((payment: any) => {
        const defaultCommission = payment.loan?.loantype?.loanPaymentComission;
        
        return {
          ...payment,
          type: 'PAYMENT', // ✅ Siempre tipo 'PAYMENT' (abono)
          ...(defaultCommission && parseFloat(defaultCommission) > 0 ? {
            comission: Math.round(parseFloat(defaultCommission))
          } : {})
        };
      });
      
      // ✅ SIMPLIFICADO: Los datos ya vienen ordenados por signDate desde la query GraphQL
      // Solo necesitamos mantener el orden que viene de la base de datos
      const sortedPayments = paymentsWithDefaultCommissions;
      
      updateState({ existingPayments: sortedPayments });
    }
  }, [paymentsData, migratedPaymentsData, selectedDate, selectedLead?.id]);

  const { data: loansData, loading: loansLoading, error: loansError, refetch: refetchLoans } = useQuery<{ loans: Loan[] }>(GET_LOANS_BY_LEAD, {
    variables: { 
      where: {
        lead: {
          id: {
            equals: selectedLead?.id || ''
          }
        },
        finishedDate: {
          equals: null
        },
        pendingAmountStored: {
          gt: "0"
        },
        excludedByCleanup: null
      }
    },
    skip: !selectedLead,
  });

  const [createCustomLeadPaymentReceived, { error: customLeadPaymentError, loading: customLeadPaymentLoading }] = useMutation(CREATE_LEAD_PAYMENT_RECEIVED);
  const [updateCustomLeadPaymentReceived, { loading: updateLoading }] = useMutation(UPDATE_LEAD_PAYMENT);
  const [updateLoanPayment, { loading: updateLoanPaymentLoading }] = useMutation(UPDATE_LOAN_PAYMENT);
  const [createFalcoPayment, { loading: falcoPaymentLoading }] = useMutation(CREATE_FALCO_PAYMENT);
  const [markLoanAsDeceased, { loading: markDeceasedLoading }] = useMutation(MARK_LOAN_AS_DECEASED);
  const [unmarkLoanAsDeceased, { loading: unmarkDeceasedLoading }] = useMutation(UNMARK_LOAN_AS_DECEASED);
  const [promoteToLead, { loading: promoteLoading }] = useMutation(PROMOTE_TO_LEAD);
  const [updateLoanCollaterals, { loading: updateCollateralsLoading }] = useMutation(UPDATE_LOAN_COLLATERALS);
  const [updatePhone, { loading: updatePhoneLoading }] = useMutation(UPDATE_PHONE);
  const [updateLoanWithAval, { loading: updateLoanWithAvalLoading }] = useMutation(UPDATE_LOAN_WITH_AVAL);

  // Hook para obtener datos completos del cliente
  const [getClientData, { loading: clientDataLoading }] = useLazyQuery(GET_CLIENT_DATA, {
    onCompleted: (data) => {
      if (data.personalData) {
        setEditingClient(data.personalData);
        setIsEditClientModalOpen(true);
      } else {
        console.log('❌ No se encontraron datos del cliente en la respuesta');
      }
    },
    onError: (error) => {
      console.error('❌ Error en getClientData:', error);
    }
  });

  // Hook para obtener historial del cliente (mismo que historial-cliente.tsx)
  const [getClientHistory, { data: clientHistoryData, loading: clientHistoryLoading }] = useLazyQuery(GET_CLIENT_HISTORY);
  
  // Estado para almacenar historiales de clientes
  const [clientHistories, setClientHistories] = useState<{[clientId: string]: any}>({});

  // Manejar datos del historial cuando se reciben
  useEffect(() => {
    if (clientHistoryData?.getClientHistory) {
      const historyData = clientHistoryData.getClientHistory;
      const clientId = historyData.client?.id;
      if (clientId) {
        setClientHistories(prev => ({
          ...prev,
          [clientId]: historyData
        }));
      }
    }
  }, [clientHistoryData]);

  // Estado para controlar loading general de guardado
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para tooltip de comisiones
  const [showCommissionTooltip, setShowCommissionTooltip] = useState(false);

  // Estados para modal de edición de cliente
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  // ✅ MOVIDO: Hooks useCallback al principio para evitar problemas de orden

  // Función separada para solicitar historiales (evita bucle infinito)
  const requestClientHistory = useCallback((clientId: string, clientName: string) => {
    if (!clientHistories[clientId]) {
      console.log(`Solicitando historial para cliente ${clientId} (${clientName})`);
      getClientHistory({
        variables: {
          clientId: clientId,
          routeId: null,
          locationId: null
        }
      });
    }
  }, [clientHistories, getClientHistory]);

  const router = useRouter();

  const handleEditExistingPayment = (paymentId: string, field: string, value: any) => {
    const payment = existingPayments.find(p => p.id === paymentId);
    if (!payment) return;

    // Utilidad para calcular comisión dinámica según monto vs esperado
    const computeDynamicCommission = (loanId: string | undefined, amountNum: number): number => {
      if (!loanId || !loansData?.loans) return 0;
      const loan = loansData.loans.find(l => l.id === loanId);
      if (!loan) return 0;
      const expectedWeekly = parseFloat(loan.weeklyPaymentAmount || '0');
      const baseCommission = Math.round(parseFloat(loan.loantype?.loanPaymentComission || '0')) || 0;
      if (!expectedWeekly || !baseCommission) return 0;
      if (!isFinite(amountNum) || amountNum <= 0) return 0;
      const multiplier = Math.floor(amountNum / expectedWeekly);
      return multiplier >= 1 ? baseCommission * multiplier : 0;
    };

    // Esto preserva ediciones anteriores
    const currentPayment = state.editedPayments[paymentId] || payment;

    let updatedPayment: any = {
      ...currentPayment,
      [field]: value
    };

    // Si se actualiza el monto, recalcular la comisión dinámicamente SOLO si no fue editada manualmente
    if (field === 'amount') {
      const paymentKey = `existing-${paymentId}`;
      if (!manuallyEditedCommissions.has(paymentKey)) {
        const amountNum = parseFloat(String(value) || '0');
        const loanId = (payment as any).loan?.id || (payment as any).loanId;
        updatedPayment.comission = computeDynamicCommission(loanId, amountNum);
      }
    }
    
    // Si se actualiza la comisión manualmente, marcar como editada manualmente
    if (field === 'comission') {
      const paymentKey = `existing-${paymentId}`;
      setManuallyEditedCommissions(prev => new Set(prev).add(paymentKey));
    }

    setState(prev => ({
      ...prev,
      editedPayments: {
        ...prev.editedPayments,
        [paymentId]: updatedPayment
      }
    }));
  };

  // Handle falco payment
  const handleFalcoPayment = async () => {
    try {
      if (!selectedFalcoId || falcoPaymentAmount <= 0) {
        // Validación fallida - no mostrar alert
        return;
      }

      await createFalcoPayment({
        variables: {
          leadPaymentReceivedId: selectedFalcoId,
          amount: falcoPaymentAmount.toString()
        }
      });

      // Refresh data
      await Promise.all([
        refetchFalcos(),
        refetchPayments(),
        refetchMigratedPayments()
      ]);

      // Llamar al callback para actualizar balances
      if (onSaveComplete) {
        console.log('🔄 abonosTab: Llamando callback onSaveComplete para actualizar balances (falco payment)');
        onSaveComplete();
      } else {
        console.warn('⚠️ abonosTab: onSaveComplete callback no está definido (falco payment)');
      }

      // Reset state
      updateState({
        isFalcoModalOpen: false,
        falcoPaymentAmount: 0,
        selectedFalcoId: null
      });

      // Mostrar mensaje de éxito
      updateState({ 
        showSuccessMessage: true
      });
      
      // Ocultar el mensaje después de 3 segundos
      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 3000);
    } catch (error) {
      console.error('Error creating falco payment:', error);
      // Aquí podrías agregar un estado de error si quieres mostrar un mensaje de error específico
    }
  };

  // Handle create falco
  const handleCreateFalco = async () => {
    try {
      if (!selectedLead?.id || !selectedDate || createFalcoAmount <= 0) {
        // Validación fallida - no mostrar alert
        return;
      }

      // Crear un LeadPaymentReceived con falco (sin pagos reales)
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

      // Refresh data
      await Promise.all([
        refetchFalcos(),
        refetchPayments(),
        refetchMigratedPayments()
      ]);

      // Llamar al callback para actualizar balances
      if (onSaveComplete) {
        console.log('🔄 abonosTab: Llamando callback onSaveComplete para actualizar balances (create falco)');
        onSaveComplete();
      } else {
        console.warn('⚠️ abonosTab: onSaveComplete callback no está definido (create falco)');
      }

      // Reset state
      updateState({
        isCreateFalcoModalOpen: false,
        createFalcoAmount: 0
      });

      // Mostrar mensaje de éxito
      updateState({ 
        showSuccessMessage: true
      });
      
      // Ocultar el mensaje después de 3 segundos
      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 3000);
    } catch (error) {
      console.error('Error creating falco:', error);
      // Aquí podrías agregar un estado de error si quieres mostrar un mensaje de error específico
    }
  };

  // Función para manejar el deceso
  const handleMarkAsDeceased = async () => {
    if (!selectedDate || !deceasedModal.loanId) return;
    
    try {
      await markLoanAsDeceased({
        variables: {
          loanId: deceasedModal.loanId,
          date: selectedDate.toISOString()
        }
      });
      
      // Marcar el préstamo como deceso en el estado local
      setDeceasedLoanIds(prev => new Set([...prev, deceasedModal.loanId!]));

      // Guardar valores previos y poner amount/comisión = 0 en filas asociadas (vista actual)
      setState(prev => {
        const updatedEdited = { ...prev.editedPayments } as Record<string, any>;
        const updatedPrev: Record<string, { amount: number; comission: number }> = { ...previousValuesByPaymentId };
        (prev.existingPayments || []).forEach((p: any) => {
          const loanId = p.loan?.id || p.loanId;
          if (loanId === deceasedModal.loanId && p.id) {
            const base = prev.editedPayments[p.id] || p;
            // Guardar solo una vez
            if (!updatedPrev[p.id]) {
              updatedPrev[p.id] = { amount: parseFloat(base.amount), comission: parseFloat(base.comission) };
            }
            updatedEdited[p.id] = { ...base, amount: 0, comission: 0 };
          }
        });
        setPreviousValuesByPaymentId(updatedPrev);
        return { ...prev, editedPayments: updatedEdited } as any;
      });
      
      setDeceasedModal({ isOpen: false, loanId: null, clientName: '' });
      alert('Préstamo marcado como deceso exitosamente');
    } catch (error) {
      console.error('Error marcando como deceso:', error);
      alert('Error al procesar el deceso');
    }
  };

  const handleUnmarkAsDeceased = async (loanId: string) => {
    try {
      await unmarkLoanAsDeceased({ variables: { loanId } });
      setDeceasedLoanIds(prev => {
        const copy = new Set(prev);
        copy.delete(loanId);
        return copy;
      });

      // Restaurar valores previos amount/comission para pagos de este préstamo
      setState(prev => {
        const updatedEdited = { ...prev.editedPayments } as Record<string, any>;
        (prev.existingPayments || []).forEach((p: any) => {
          const id = p.id;
          const loan = p.loan?.id || p.loanId;
          if (loan === loanId && id && previousValuesByPaymentId[id]) {
            const base = prev.editedPayments[id] || p;
            const prevVals = previousValuesByPaymentId[id];
            updatedEdited[id] = { ...base, amount: prevVals.amount, comission: prevVals.comission };
          }
        });
        return { ...prev, editedPayments: updatedEdited } as any;
      });
      // Limpiar cache previo de sólo los pagos de este préstamo
      setPreviousValuesByPaymentId(prev => {
        const copy = { ...prev };
        (state.existingPayments || []).forEach((p: any) => {
          const id = p.id;
          const loan = p.loan?.id || p.loanId;
          if (loan === loanId && id && copy[id]) delete copy[id];
        });
        return copy;
      });
      alert('Marcación de deceso eliminada');
    } catch (error) {
      console.error('Error revirtiendo deceso:', error);
      alert('No se pudo eliminar la marcación de deceso');
    }
  };

  // Función para manejar la promoción a líder
  const handlePromoteToLead = async () => {
    if (!promoteModal.clientId || !promoteModal.currentLeadId) return;
    
    try {
      const result = await promoteToLead({
        variables: {
          clientId: promoteModal.clientId,
          currentLeadId: promoteModal.currentLeadId
        }
      });

      // La respuesta es un objeto JSON directamente
      const response = result.data?.promoteToLead;
      
      if (response?.success) {
        alert('Cliente promovido a líder exitosamente');
        // Recargar los datos para reflejar los cambios
        window.location.reload();
      } else {
        alert(response?.message || 'Error al promover a líder');
      }
    } catch (error) {
      console.error('Error promoviendo a líder:', error);
      alert('Error al promover a líder');
    } finally {
      setPromoteModal({ isOpen: false, clientId: null, clientName: '', currentLeadId: null });
    }
  };

  // Handlers para modal de edición de cliente
  const handleEditClient = (loanId: string) => {
    // Buscar el préstamo en los datos de préstamos
    const loan = loansData?.loans?.find(l => l.id === loanId);
    
    // Si el préstamo tiene borrower con personalData.id, usar ese ID
    if (loan?.borrower?.personalData && 'id' in loan.borrower.personalData) {
      getClientData({ variables: { id: (loan.borrower.personalData as any).id } });
      return;
    }
    
    // Si no, buscar en los pagos existentes como fallback
    const existingPayment = existingPayments.find((p: any) => p.loan?.id === loanId);
    
    if (existingPayment?.loan?.borrower?.personalData && 'id' in existingPayment.loan.borrower.personalData) {
      getClientData({ variables: { id: (existingPayment.loan.borrower.personalData as any).id } });
      return;
    }
    
    // Buscar en los datos de pagos registrados (paymentsData)
    if (paymentsData?.loanPayments) {
      const registeredPayment = paymentsData.loanPayments.find((p: any) => p.loan?.id === loanId);
      
      if (registeredPayment?.loan?.borrower?.personalData && 'id' in registeredPayment.loan.borrower.personalData) {
        getClientData({ variables: { id: (registeredPayment.loan.borrower.personalData as any).id } });
        return;
      }
    }
    
    // Si no se encuentra en ningún lugar, mostrar error
    alert('No se pudo encontrar la información del cliente. Inténtalo de nuevo.');
  };

  const handleCloseEditClientModal = () => {
    setIsEditClientModalOpen(false);
    setEditingClient(null);
  };

  // Función para abrir modal de edición de aval
  const openAvalEditModal = (loan: any) => {
    // Extraer información del aval de los collaterals (igual que en CreditosTab)
    const firstCollateral = loan.collaterals?.[0];
    const avalName = firstCollateral?.fullName || '';
    const avalPhone = firstCollateral?.phones?.[0]?.number || '';
    const selectedCollateralId = firstCollateral?.id;
    const selectedCollateralPhoneId = firstCollateral?.phones?.[0]?.id;
    
    setAvalEditModal({
      isOpen: true,
      loan
    });
    
    // Pre-cargar los datos del aval existente (igual que en CreditosTab)
    setEditingAvalData({
      id: selectedCollateralId,
      fullName: avalName,
      phone: avalPhone,
      phoneId: selectedCollateralPhoneId,
      avalAction: selectedCollateralId ? 'connect' : 'create'
    });
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
      
      // Preparar datos para la mutación (igual que en CreditosTab)
      const avalData = editingAvalData.id
        ? {
            // Con ID seleccionado: forzar connect
            selectedCollateralId: editingAvalData.id,
            action: 'connect' as const
          }
        : (
            (editingAvalData.fullName || editingAvalData.phone)
              ? {
                  // Sin ID: si hay datos escritos, crear/actualizar según avalAction
                  name: editingAvalData.fullName || '',
                  phone: editingAvalData.phone || '',
                  action: editingAvalData.avalAction || 'create'
                }
              : { action: 'clear' as const }
          );

      console.log('🔄 Enviando actualización de aval:', avalData);

      // Usar la mutación personalizada updateLoanWithAval (igual que en CreditosTab)
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
        
        // Refrescar los datos de loans para mostrar los cambios
        try {
          await refetchLoans();
          console.log('✅ Datos de loans refrescados después de actualizar aval');
        } catch (error) {
          console.error('❌ Error al refrescar datos de loans:', error);
        }
        
        // Refrescar datos si es necesario
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

  const handleSaveEditedClient = async (updatedClient: any) => {
    // Refrescar los datos para mostrar los cambios
    if (onSaveComplete) {
      onSaveComplete();
    }
    
    // Refrescar los datos de pagos para asegurar que se muestren los cambios
    try {
      await Promise.all([
        refetchPayments(),
        refetchMigratedPayments(),
        refetchFalcos()
      ]);
    } catch (error) {
      console.error('Error al refrescar datos después de editar cliente:', error);
    }
    
    handleCloseEditClientModal();
  };

  const handleSaveAllChanges = async () => {
    try {
      
        // ✅ VERIFICACIÓN: Verificar si los pagos tachados realmente existen en existingPayments
        const nonExistentTachados = strikethroughPaymentIds.filter(id => 
          !existingPayments.some((payment: any) => payment.id === id)
        );
        
        if (nonExistentTachados.length > 0) {
          // Refrescar los datos
          await refetchPayments();
          await refetchMigratedPayments();
          
          // Limpiar el estado de eliminación ya que los datos están actualizados
          setStrikethroughPaymentIds([]);
          setStrikethroughNewPaymentIndices([]);
          
          return; // Salir de la función para que se ejecute con datos frescos
        }
      
      // Agrupar los pagos por leadPaymentReceived (excluyendo los tachados y migrados, incluyendo los marcados como pagados)
      const filteredPayments = existingPayments.filter((payment: any) => {
        const isStrikethrough = strikethroughPaymentIds.includes(payment.id);
        const isMigrated = payment.isMigrated;
        const shouldInclude = !isStrikethrough && !isMigrated;
        
        
        return shouldInclude;
      });
      
      
      const paymentsByLeadPayment = filteredPayments
        .reduce((acc: Record<string, {
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
        }>, payment: any) => {
        const leadPaymentId = payment.leadPaymentReceived?.id;
        if (!leadPaymentId) {
          // Para pagos marcados como pagados (isMissingPayment), usar el primer leadPaymentId disponible
          if (payment.isMissingPayment) {
            const firstExistingPayment = existingPayments.find((p: any) => p.leadPaymentReceived?.id && !p.isMissingPayment);
            if (firstExistingPayment?.leadPaymentReceived?.id) {
              const fallbackLeadPaymentId = firstExistingPayment.leadPaymentReceived.id;
              if (!acc[fallbackLeadPaymentId]) {
                acc[fallbackLeadPaymentId] = {
                  payments: [],
                  expectedAmount: 0,
                  cashPaidAmount: 0,
                  bankPaidAmount: 0,
                  falcoAmount: 0,
                  paymentDate: firstExistingPayment.leadPaymentReceived?.createdAt
                };
              }
              
              const editedPayment = state.editedPayments[payment.id] || payment;
              acc[fallbackLeadPaymentId].payments.push({
                amount: parseFloat(editedPayment.amount),
                comission: parseFloat(editedPayment.comission),
                loanId: editedPayment.loanId || editedPayment.loan?.id,
                type: editedPayment.type,
                paymentMethod: editedPayment.paymentMethod
              });

              acc[fallbackLeadPaymentId].expectedAmount += parseFloat(editedPayment.amount);
              if (editedPayment.paymentMethod === 'CASH') {
                acc[fallbackLeadPaymentId].cashPaidAmount += parseFloat(editedPayment.amount);
              } else {
                acc[fallbackLeadPaymentId].bankPaidAmount += parseFloat(editedPayment.amount);
              }
            }
          }
          return acc;
        }

        if (!acc[leadPaymentId]) {
          acc[leadPaymentId] = {
            payments: [],
            expectedAmount: 0,
            cashPaidAmount: 0,
            bankPaidAmount: 0,
            falcoAmount: 0,
            paymentDate: payment.leadPaymentReceived?.createdAt
          };
        }

        const editedPayment = state.editedPayments[payment.id] || payment;
        acc[leadPaymentId].payments.push({
          amount: parseFloat(editedPayment.amount),
          comission: parseFloat(editedPayment.comission),
          loanId: editedPayment.loan.id,
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
      }, {} as Record<string, {
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
      }>);

      // Obtener el primer grupo de pagos (asumimos que solo hay uno por ahora)
      const firstPaymentGroup = Object.values(paymentsByLeadPayment)[0];
      
      if (!firstPaymentGroup) {
        // 🆕 NUEVA LÓGICA: Si no hay pagos (todos fueron eliminados), 
        // necesitamos actualizar el LeadPaymentReceived con array vacío
        console.log('🗑️ handleSaveAllChanges: Todos los pagos fueron eliminados, ejecutando actualización con array vacío');
        
        // Obtener el ID del LeadPaymentReceived del primer pago existente (antes de filtrar)
        const firstExistingPayment = existingPayments.find((payment: any) => !payment.isMigrated);
        if (!firstExistingPayment?.leadPaymentReceived?.id) {
          console.error('❌ No se pudo encontrar el LeadPaymentReceived para actualizar');
          return;
        }
        
        const leadPaymentId = firstExistingPayment.leadPaymentReceived.id;
        
        // Ejecutar actualización directamente con array vacío
        await updateCustomLeadPaymentReceived({
          variables: {
            id: leadPaymentId,
            expectedAmount: 0, // Sin pagos, monto esperado es 0
            cashPaidAmount: 0,
            bankPaidAmount: 0,
            falcoAmount: 0, // ✅ ELIMINADO: Falco se maneja por separado
            paymentDate: firstExistingPayment.leadPaymentReceived.createdAt,
            payments: [] // Array vacío para eliminar todos los pagos
          }
        });
        
        // Refrescar datos y limpiar estado
        await Promise.all([
          refetchPayments(),
          refetchMigratedPayments(),
          refetchFalcos(),
        ]);
        
        setState(prev => ({ 
          ...prev,
          editedPayments: {},
          isEditing: false,
          groupedPayments: undefined
        }));
        
        // Llamar al callback para actualizar balances
        if (onSaveComplete) {
          onSaveComplete();
        }
        
        return;
      }

      // ✅ PRE-CARGAR: Obtener el bankPaidAmount anterior del LeadPaymentReceived existente
      const firstExistingPayment = existingPayments.find((p: any) => p.leadPaymentReceived?.bankPaidAmount !== undefined);
      const existingBankPaidAmount = firstExistingPayment?.leadPaymentReceived?.bankPaidAmount 
        ? parseFloat(firstExistingPayment.leadPaymentReceived.bankPaidAmount.toString())
        : 0;

      console.log('🔄 PRE-CARGAR: Valores de transferencia anterior:', {
        existingBankPaidAmount,
        cashTotal: totalByPaymentMethod.cashTotal,
        cashDisponible: totalByPaymentMethod.cashTotal - existingBankPaidAmount
      });

      // ✅ CORREGIDO: Abrir el modal con valores recalculados basándose en el estado real actual
      updateState({ 
        isModalOpen: true,
        loadPaymentDistribution: {
          totalPaidAmount: totalAmount,
          cashPaidAmount: totalByPaymentMethod.cashTotal - existingBankPaidAmount, // Efectivo menos transferencia anterior
          bankPaidAmount: existingBankPaidAmount, // ✅ PRE-CARGAR valor anterior de transferencia
          // ✅ ELIMINADO: Falco se maneja por separado
        }
      });

      // Guardar los pagos agrupados en el estado para usarlos después
      setState(prev => ({
        ...prev,
        groupedPayments: paymentsByLeadPayment
      }));
    } catch (error) {
      console.error('Error preparing changes:', error);
        // Error al preparar los cambios - no mostrar alert
    }
  };

  const handleSubmit = async () => {
    try {
      console.log('🚀 DEBUG handleSubmit - Iniciando...', {
        selectedLead: selectedLead?.id,
        selectedDate,
        paymentsCount: payments.length,
        groupedPayments: state.groupedPayments
      });

      if (!selectedLead?.id || !selectedDate) {
        console.log('❌ ERROR: Falta selectedLead o selectedDate');
        alert('Error: Falta información de líder o fecha seleccionada');
        return;
      }

      // Activar estado de loading
      setIsSaving(true);

      // Verificar que la suma de la distribución coincida con el total pagado
      const { cashPaidAmount, bankPaidAmount } = loadPaymentDistribution;
      // ✅ CORREGIDO: Para la validación, solo contar el efectivo que se está distribuyendo
      // bankPaidAmount es transferencia del efectivo, no dinero adicional
      const totalPaid = cashPaidAmount;
      
      // Calcular el total esperado
      const filteredNewPayments = payments
        .filter((p, index) => !strikethroughNewPaymentIndices.includes(index))
        .filter(p => (parseFloat(p.amount || '0') !== 0 || parseFloat(p.comission?.toString() || '0') !== 0));

      // ✅ SEPARAR: expectedAmount para mutación (todos) vs expectedCashAmount para validación (solo efectivo)
      // Calcular expectedAmount incluyendo pagos existentes Y nuevos si hay groupedPayments
      let expectedTotalAmount = 0;
      if (state.groupedPayments) {
        // Sumar pagos existentes de groupedPayments
        const existingAmount = Object.values(state.groupedPayments)[0]?.expectedAmount || 0;
        // Sumar pagos nuevos
        const newAmount = filteredNewPayments
          .reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);
        expectedTotalAmount = existingAmount + newAmount;
      } else if (filteredNewPayments.length > 0) {
        // Solo pagos nuevos (sin existentes)
        expectedTotalAmount = filteredNewPayments
          .reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);
      }

      // ✅ CORREGIDO: Calcular efectivo esperado basándose en el contexto correcto
      let expectedCashAmount;
      if (filteredNewPayments.length > 0) {
        // Caso: Hay pagos nuevos - usar totalByPaymentMethod de la UI
        expectedCashAmount = totalByPaymentMethod.cashTotal - bankPaidAmount;
      } else if (state.groupedPayments) {
        expectedCashAmount = totalByPaymentMethod.cashTotal - bankPaidAmount;
      } else {
        expectedCashAmount = 0 - bankPaidAmount;
      }

      console.log('🔍 DEBUG handleSubmit - Validación de distribución:', {
        'Efectivo total cobrado': totalByPaymentMethod.cashTotal,
        'Transferencia al banco': bankPaidAmount,
        'Efectivo disponible para distribución (esperado)': expectedCashAmount,
        'Efectivo que se está distribuyendo (actual)': totalPaid,
        'Diferencia': Math.abs(totalPaid - expectedCashAmount),
        'Total para mutación': expectedTotalAmount,
        cashPaidAmount,
        bankPaidAmount,
        filteredNewPayments
      });

      if (Math.abs(totalPaid - expectedCashAmount) > 0.01) {
        console.log('❌ ERROR: La distribución no coincide. Diferencia:', Math.abs(totalPaid - expectedCashAmount));
        alert(`Error: La distribución de efectivo ($${totalPaid}) no coincide con el efectivo cobrado ($${expectedCashAmount}). Diferencia: $${Math.abs(totalPaid - expectedCashAmount).toFixed(2)}`);
        return;
      }

      // ✅ CORREGIDO: Lógica para determinar si crear nuevo o actualizar existente
      if (state.groupedPayments) {
        // Si ya existen pagos para este día, actualizar incluyendo pagos existentes Y nuevos
        console.log('✅ Ejecutando updateCustomLeadPaymentReceived para pagos existentes:', state.groupedPayments);
        console.log('✅ Pagos nuevos a agregar:', filteredNewPayments);
        for (const [leadPaymentId, data] of Object.entries(state.groupedPayments)) {
          const { payments, paymentDate } = data;
          const { cashPaidAmount, bankPaidAmount } = loadPaymentDistribution;
          
          // ✅ CORREGIDO: Combinar pagos existentes con pagos nuevos
          const existingPaymentsArray = [...(payments as any[])];
          
          // Agregar pagos nuevos al mismo leadPayment
          const newPaymentsArray = filteredNewPayments.map(payment => ({
            amount: parseFloat(payment.amount || '0'),
            comission: parseFloat(payment.comission?.toString() || '0'),
            loanId: payment.loanId,
            type: payment.type,
            paymentMethod: payment.paymentMethod
          }));
          
          // Combinar ambos arrays
          const allPayments = [...existingPaymentsArray, ...newPaymentsArray];
          
          console.log('✅ Combinando pagos existentes y nuevos:', {
            existentes: existingPaymentsArray.length,
            nuevos: newPaymentsArray.length,
            total: allPayments.length
          });
          
          // Limpiar pagos 0/0 antes de enviar actualización
          const cleanedPayments = allPayments.filter((p: any) => {
            const amt = parseFloat(p.amount?.toString() || '0');
            const com = parseFloat(p.comission?.toString() || '0');
            return !(amt === 0 && com === 0);
          });
          
          // Calcular expectedAmount incluyendo ambos tipos de pagos
          const cleanedExpected = cleanedPayments.reduce((sum: number, p: any) => {
            const amt = parseFloat(p.amount?.toString() || '0');
            return sum + amt;
          }, 0);

          await updateCustomLeadPaymentReceived({
            variables: {
              id: leadPaymentId,
              expectedAmount: cleanedExpected,
              cashPaidAmount,
              bankPaidAmount,
              falcoAmount: 0, // ✅ ELIMINADO: Falco se maneja por separado
              paymentDate,
              payments: cleanedPayments.map((payment: any) => ({
                amount: parseFloat(payment.amount?.toString() || '0'),
                comission: parseFloat(payment.comission?.toString() || '0'),
                loanId: payment.loanId,
                type: payment.type,
                paymentMethod: payment.paymentMethod
              }))
            }
          });
        }
      } else if (filteredNewPayments.length > 0) {
        // Si no existen pagos para este día, crear nuevo
        console.log('✅ Ejecutando createCustomLeadPaymentReceived con:', {
          expectedAmount: expectedTotalAmount,
          cashPaidAmount,
          bankPaidAmount,
          agentId: selectedLead.id,
          leadId: selectedLead.id,
          paymentDate: selectedDate.toISOString(),
          payments: filteredNewPayments
        });
        await createCustomLeadPaymentReceived({
          variables: {
            expectedAmount: expectedTotalAmount,
            cashPaidAmount,
            bankPaidAmount,
            agentId: selectedLead.id,
            leadId: selectedLead.id,
            paymentDate: selectedDate.toISOString(),
            payments: filteredNewPayments
              .map(payment => ({
                amount: parseFloat(payment.amount || '0'),
                comission: parseFloat(payment.comission?.toString() || '0'),
                loanId: payment.loanId,
                type: payment.type,
                paymentMethod: payment.paymentMethod
              }))
          }
        });
      }

      // ✅ CORREGIDO: Refrescar todos los datos para obtener el balance real de la DB
      await Promise.all([
        refetchPayments(),
        refetchMigratedPayments(),
        refetchFalcos(),
        // Aquí deberías llamar a refetchRoute si tienes acceso a esa query
        // Por ahora solo refrescamos los pagos
      ]);
      
      // Limpiar el estado
      setState(prev => ({ 
        ...prev,
        payments: [],
        editedPayments: {},
        isEditing: false,
        isModalOpen: false,
        groupedPayments: undefined
      }));

      // Llamar al callback para actualizar balances
      if (onSaveComplete) {
        console.log('🔄 abonosTab: Llamando callback onSaveComplete para actualizar balances');
        onSaveComplete();
      } else {
        console.warn('⚠️ abonosTab: onSaveComplete callback no está definido');
      }

      // Mostrar mensaje de éxito y limpiar el estado
      updateState({ 
        showSuccessMessage: true,
        payments: [],
        editedPayments: {},
        isEditing: false,
        isModalOpen: false,
        groupedPayments: undefined
      });
      
      // Ocultar el mensaje después de 3 segundos
      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 3000);
    } catch (error) {
      console.error('Error saving changes:', error);
      // Mostrar mensaje de error temporal
      updateState({ 
        showSuccessMessage: false
      });
      // Aquí podrías agregar un estado de error si quieres mostrar un mensaje de error específico
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    console.log('🔍 [DEBUG] useEffect loansData/existingPayments ejecutándose...');
    console.log('   - loansData?.loans?.length:', loansData?.loans?.length);
    console.log('   - existingPayments.length:', existingPayments.length);
    console.log('   - payments.length (actual):', payments.length);
    
    // Si no hay pagos existentes y tenemos datos de préstamos, cargar los pagos semanales
    if (loansData?.loans && existingPayments.length === 0) {
      console.log('✅ [DEBUG] Creando pagos automáticamente desde loansData...');
      const newPayments = loansData.loans.map(loan => ({
        amount: loan.weeklyPaymentAmount,
        // ✅ MODIFICAR: Usar comisión por defecto del loanType si existe
        comission: loan.loantype?.loanPaymentComission ? Math.round(parseFloat(loan.loantype.loanPaymentComission)) : Math.round(comission),
        loanId: loan.id,
        type: 'PAYMENT',
        paymentMethod: 'CASH',
        isNew: true, // Marcar como nuevo pago
        isUserAdded: false, // Marcar como pagos existentes (no agregados por usuario)
        loan: {
          id: loan.id,
          signDate: loan.signDate,
          borrower: loan.borrower,
          loantype: loan.loantype // ✅ AGREGAR: Incluir loanType para acceder a la comisión
        }
      }));
      
      // ✅ AGREGAR: Ordenar pagos por fecha de creación del crédito (más viejo primero)
      const sortedNewPayments = newPayments.sort((a: any, b: any) => {
        const dateA = new Date(a.loan?.signDate || '1970-01-01');
        const dateB = new Date(b.loan?.signDate || '1970-01-01');
        return dateA.getTime() - dateB.getTime(); // Ascendente: crédito más viejo arriba
      });
      
      console.log('✅ [DEBUG] Pagos semanales creados con comisiones por defecto del loanType:', sortedNewPayments.length);
      sortedNewPayments.forEach((payment, index) => {
        console.log(`   ${index + 1}. ${payment.loan?.borrower?.personalData?.fullName} - Comisión: ${payment.comission} (del loanType: ${payment.loan?.loantype?.name}) - Fecha Crédito: ${payment.loan?.signDate ? new Date(payment.loan.signDate).toLocaleDateString('es-MX') : 'N/A'}`);
      });
      
      updateState({ payments: sortedNewPayments });
    } else if (existingPayments.length > 0) {
      // Si hay pagos existentes, limpiar los pagos nuevos
      console.log('🧹 [DEBUG] Limpiando pagos automáticos porque hay pagos existentes...');
      console.log('   - Pagos que se van a limpiar:', payments.length);
      updateState({ payments: [] });
    } else {
      console.log('ℹ️ [DEBUG] No se ejecuta ninguna acción - no hay loansData o existingPayments');
    }
  }, [loansData, comission, existingPayments.length]);

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
          isUserAdded: true, // Marcar como agregado por usuario
        }
      ]
    });
  };

  const handlePaymentTypeChange = (index: number, option: Option) => {
    const newPayments = [...payments];
    newPayments[index].type = option.value;
    updateState({ payments: newPayments });
  };

  const handlePaymentMethodChange = (index: number, option: Option) => {
    const newPayments = [...payments];
    newPayments[index].paymentMethod = option.value;
    updateState({ payments: newPayments });
  };

  const handleRemovePayment = (index: number) => {
    const newPayments = payments.filter((_, i) => i !== index);
    updateState({ payments: newPayments });
  };



  const handleChange = (index: number, field: keyof LoanPayment, value: any) => {
    const newPayments = [...payments];
    if (field === 'loanId') {
      newPayments[index][field] = value;
      
      // ✅ AGREGAR: Cargar comisión por defecto automáticamente al seleccionar préstamo
      if (value && loansData?.loans) {
        const selectedLoan = loansData.loans.find(loan => loan.id === value);
        if (selectedLoan?.loantype?.loanPaymentComission) {
          const defaultCommission = Math.round(parseFloat(selectedLoan.loantype.loanPaymentComission));
          if (defaultCommission > 0) {
            newPayments[index].comission = defaultCommission;
            console.log('✅ Comisión por defecto cargada automáticamente:', defaultCommission, 'para préstamo:', selectedLoan.loantype.name);
          }
        }
      }
    } else if (field === 'comission') {
      (newPayments[index][field] as unknown as string) = value;
      // Marcar comisión como editada manualmente
      const paymentKey = `new-${index}`;
      setManuallyEditedCommissions(prev => new Set(prev).add(paymentKey));
    } else {
      // ✅ VALIDACIÓN: Asegurar que amount nunca sea null o undefined
      if (field === 'amount') {
        (newPayments[index][field] as any) = value === null || value === undefined || value === '' ? '0' : value;
      } else {
        (newPayments[index][field] as any) = value;
      }
      // Reglas de comisión dinámica según monto vs pago esperado SOLO si no fue editada manualmente
      if (field === 'amount') {
        const paymentKey = `new-${index}`;
        if (!manuallyEditedCommissions.has(paymentKey)) {
          const amt = parseFloat(String(value) || '0');
          const loanId = newPayments[index].loanId;
          if (loanId && loansData?.loans) {
            const loan = loansData.loans.find(l => l.id === loanId);
            const expectedWeekly = loan ? parseFloat(loan.weeklyPaymentAmount || '0') : 0;
            const baseCommission = loan ? Math.round(parseFloat(loan.loantype?.loanPaymentComission || '0')) || 0 : 0;
            if (!expectedWeekly || !baseCommission || !isFinite(amt) || amt <= 0) {
              (newPayments[index].comission as any) = 0;
            } else {
              const multiplier = Math.floor(amt / expectedWeekly);
              (newPayments[index].comission as any) = multiplier >= 1 ? baseCommission * multiplier : 0;
            }
          } else {
            (newPayments[index].comission as any) = 0;
          }
        }
      }
    }
    updateState({ payments: newPayments });
  };

  const totalAmount = useMemo(() => {
    return payments
      .filter((_, index) => !strikethroughNewPaymentIndices.includes(index))
      .reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);
  }, [payments, strikethroughNewPaymentIndices]);

  // Calcular desglose por método de pago para el KPI Total
  const totalByPaymentMethod = useMemo(() => {
    let cashTotal = 0;
    let transferTotal = 0;

    // Pagos nuevos
    payments
      .filter((_: any, idx: number) => !strikethroughNewPaymentIndices.includes(idx))
      .forEach((payment: any) => {
        const amount = parseFloat(payment.amount || '0');
        if (payment.paymentMethod === 'CASH') {
          cashTotal += amount;
        } else if (payment.paymentMethod === 'MONEY_TRANSFER') {
          transferTotal += amount;
        }
      });

    // Pagos existentes
    existingPayments
      .filter((payment: any) => !strikethroughPaymentIds.includes(payment.id))
      .forEach((payment: any) => {
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

  // ✅ NUEVO ENFOQUE: Calcular loadPaymentDistribution priorizando valor persistido en DB
  const computedLoadPaymentDistribution = useMemo(() => {
    const availableCash = totalByPaymentMethod.cashTotal;

    // Tomar bankPaidAmount persistido si existe en algún pago existente (leadPaymentReceived)
    const persistedBank = (() => {
      const found = existingPayments.find((p: any) => p.leadPaymentReceived?.bankPaidAmount !== undefined);
      if (!found) return undefined;
      const raw = found.leadPaymentReceived?.bankPaidAmount;
      if (raw === null || raw === undefined) return undefined;
      const num = parseFloat(raw.toString());
      return isFinite(num) ? num : undefined;
    })();

    // Si el usuario ya editó manualmente la distribución, respetar su entrada y NO sobrescribir con persistidos
    const requestedTransfer = hasUserEditedDistribution
      ? loadPaymentDistribution.bankPaidAmount
      : (persistedBank !== undefined ? persistedBank : loadPaymentDistribution.bankPaidAmount);

    // Limitar transferencia al efectivo disponible y a valores no negativos
    const validTransfer = Math.min(Math.max(0, requestedTransfer || 0), Math.max(0, availableCash));

    return {
      totalPaidAmount: totalAmount,
      bankPaidAmount: validTransfer,
      cashPaidAmount: Math.max(0, availableCash - validTransfer)
    };
  }, [
    totalAmount,
    totalByPaymentMethod.cashTotal,
    loadPaymentDistribution.bankPaidAmount,
    existingPayments,
    hasUserEditedDistribution
  ]);

  // Actualizar estado solo cuando sea necesario
  useEffect(() => {
    updateState({
      loadPaymentDistribution: computedLoadPaymentDistribution
    });
  }, [computedLoadPaymentDistribution]);

  const paymentTypeCounts = useMemo(() => {
    return payments.reduce((counts, payment) => {
      counts[payment.type] = (counts[payment.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }, [payments]);
  
  const totalComission = useMemo(() => {
    return payments
      .filter((_, index) => !strikethroughNewPaymentIndices.includes(index))
      .reduce((sum, payment) => sum + parseFloat(payment.comission.toString() || '0'), 0);
  }, [payments, strikethroughNewPaymentIndices]);

  // Calcular totales de pagos existentes (considerando ediciones y tachados, incluyendo migrados)
  const totalExistingAmount = useMemo(() => {
    return existingPayments
      .filter((payment: any) => !strikethroughPaymentIds.includes(payment.id))
      .reduce((sum: number, payment: any) => {
        const editedPayment = editedPayments[payment.id] || payment;
        return sum + parseFloat(editedPayment.amount || '0');
      }, 0);
  }, [existingPayments, editedPayments, strikethroughPaymentIds]);

  const totalExistingComission = useMemo(() => {
    return existingPayments
      .filter((payment: any) => !strikethroughPaymentIds.includes(payment.id))
      .reduce((sum: number, payment: any) => {
        const editedPayment = editedPayments[payment.id] || payment;
        return sum + parseFloat(editedPayment.comission || '0');
      }, 0);
  }, [existingPayments, editedPayments, strikethroughPaymentIds]);

  // Total general (nuevos + existentes)
  const grandTotalAmount = useMemo(() => {
    return totalAmount + totalExistingAmount;
  }, [totalAmount, totalExistingAmount]);

  const grandTotalComission = useMemo(() => {
    return totalComission + totalExistingComission;
  }, [totalComission, totalExistingComission]);

  // Contar pagos existentes (considerando tachados)
  const existingPaymentsCount = useMemo(() => {
    return existingPayments.filter((payment: any) => !strikethroughPaymentIds.includes(payment.id)).length;
  }, [existingPayments, strikethroughPaymentIds]);
// Calcular créditos que debían pagar pero no aparecen registrados
const calculateMissingPayments = () => {
  // Solo mostrar si ya hay pagos registrados para esta fecha
  if (!loansData?.loans || !selectedDate || existingPayments.length === 0) return [];
  
  const selectedDateObj = new Date(selectedDate);
  
  // Obtener IDs de préstamos que SÍ tienen pagos registrados (excluyendo los marcados como pagados temporalmente)
  // Incluir también los marcados temporalmente como pagados (isMissingPayment)
  const paidLoanIds = new Set(
    existingPayments
      .map((payment: any) => payment.loanId || payment.loan?.id)
      .filter(Boolean)
  );
  
  // Filtrar préstamos que debían pagar en esta fecha pero no tienen pago registrado
  const missingPayments = loansData.loans.filter((loan: any) => {
    // Verificar que el préstamo está activo (no terminado)
    if (loan.finishedDate) return false;
    
    // Verificar que el préstamo ya había comenzado antes de la fecha seleccionada
    const signDate = new Date(loan.signDate);
    if (signDate >= selectedDateObj) return false;
    
    // Verificar que no tiene pago registrado para esta fecha
    return !paidLoanIds.has(loan.id);
  });
  
  return missingPayments;
};

// ✅ SIMPLIFICADO: Los datos ya vienen ordenados por signDate desde la query GraphQL
// Solo necesitamos mantener el orden que viene de la base de datos
const missingPayments = calculateMissingPayments();

// Solicitar historiales de clientes que aparecen como "sin pago" (sin causar bucles infinitos)
useEffect(() => {
  if (missingPayments.length > 0) {
    missingPayments.forEach((loan: any) => {
      const clientId = loan.borrower?.personalData?.id;
      const clientName = loan.borrower?.personalData?.fullName;
      if (clientId && clientName) {
        requestClientHistory(clientId, clientName);
      }
    });
  }
}, [missingPayments, requestClientHistory]);


  // Contar pagos migrados para mostrar información (debe estar antes de los returns condicionales)
  const migratedPaymentsCount = useMemo(() => {
    return existingPayments.filter((payment: any) => payment.isMigrated).length;
  }, [existingPayments]);

  useEffect(() => {
    refetchPayments();
    refetchMigratedPayments();
    refetchFalcos();
  }, [refreshKey, refetchPayments, refetchMigratedPayments, refetchFalcos]);

  // Validar que se hayan seleccionado ruta y localidad
  if (!selectedRoute || !selectedLead) {
    return (
      <SelectionMessage
        icon="👥"
        title="Selecciona Ruta y Localidad"
        description="Para gestionar los abonos, necesitas seleccionar una ruta y una localidad específica."
        requirements={[
          "Selecciona una ruta desde el selector superior",
          "Elige una localidad de la ruta seleccionada",
          "Los abonos se cargarán automáticamente"
        ]}
      />
    );
  }

  

  if (loansLoading || paymentsLoading || migratedPaymentsLoading || falcosLoading) return <LoadingDots label="Loading data" size="large" />;
  if (loansError) return <GraphQLErrorNotice errors={loansError?.graphQLErrors || []} networkError={loansError?.networkError} />;

  return (
    <Box paddingTop="xlarge">
      {(customLeadPaymentError) && (
        <GraphQLErrorNotice
          networkError={customLeadPaymentError?.networkError}
          errors={customLeadPaymentError?.graphQLErrors}
        />
      )}

      {/* Banner de loading cuando se están guardando los pagos */}
      {isSaving && (
        <div style={{
          backgroundColor: '#E0F2FE',
          border: '2px solid #0284C7',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <LoadingDots label="Guardando" size="small" />
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: '600',
              color: '#0284C7',
              fontSize: '14px',
              marginBottom: '4px',
            }}>
              Guardando pagos...
            </div>
            <div style={{
              color: '#0369A1',
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
        <div style={{
          backgroundColor: '#F0FDF4',
          border: '2px solid #10B981',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '16px',
          fontWeight: '600',
          color: '#059669'
        }}>
          <span>✅</span>
          <span>Cambios guardados exitosamente</span>
        </div>
      )}


      {/* Banner de falcos pendientes y historial mejorado */}
      {(() => {
        if (!falcosData?.leadPaymentReceiveds || falcosData.leadPaymentReceiveds.length === 0) return null;
        
        const pendingFalcos = falcosData.leadPaymentReceiveds.filter((falco: any) => {
          const falcoAmount = parseFloat(falco.falcoAmount || '0');
          const compensatedAmount = falco.falcoCompensatoryPayments?.reduce((sum: number, comp: any) => 
            sum + parseFloat(comp.amount || '0'), 0) || 0;
          return (falcoAmount - compensatedAmount) > 0;
        });
        
        const completedFalcos = falcosData.leadPaymentReceiveds.filter((falco: any) => {
          const falcoAmount = parseFloat(falco.falcoAmount || '0');
          const compensatedAmount = falco.falcoCompensatoryPayments?.reduce((sum: number, comp: any) => 
            sum + parseFloat(comp.amount || '0'), 0) || 0;
          return (falcoAmount - compensatedAmount) <= 0 && falcoAmount > 0;
        });
        
        const totalPendingAmount = pendingFalcos.reduce((sum: number, falco: any) => {
          const falcoAmount = parseFloat(falco.falcoAmount || '0');
          const compensatedAmount = falco.falcoCompensatoryPayments?.reduce((compensatedSum: number, comp: any) => 
            compensatedSum + parseFloat(comp.amount || '0'), 0) || 0;
          return sum + (falcoAmount - compensatedAmount);
        }, 0);

        const totalCompensatedAmount = completedFalcos.reduce((sum: number, falco: any) => {
          return sum + parseFloat(falco.expectedAmount || '0');
        }, 0);
        
        if (pendingFalcos.length === 0 && completedFalcos.length > 0) {
          // Solo falcos completados - Mostrar historial prominente
          return (
            <div style={{
              backgroundColor: '#F0FDF4',
              border: '2px solid #059669',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '24px' }}>✅</div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '700',
                    color: '#059669',
                    fontSize: '16px',
                    marginBottom: '4px',
                  }}>
                    HISTORIAL DE FALTAS - TODAS COMPENSADAS
                  </div>
                  <div style={{
                    color: '#065F46',
                    fontSize: '14px',
                    lineHeight: '1.4',
                  }}>
                    {completedFalcos.length} falta(s) completamente compensada(s). 
                    Total compensado histórico: ${totalCompensatedAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              
              {/* Historial detallado de falcos completados */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '12px',
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #D1FAE5'
              }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#059669',
                  marginBottom: '8px',
                  borderBottom: '1px solid #D1FAE5',
                  paddingBottom: '6px'
                }}>
                  📋 HISTORIAL DETALLADO
                </div>
                {completedFalcos.map((falco: any, index: number) => {
                  const falcoAmount = parseFloat(falco.expectedAmount || '0');
                  const compensatedAmount = falco.falcoCompensatoryPayments?.reduce((sum: number, comp: any) => 
                    sum + parseFloat(comp.amount || '0'), 0) || 0;
                  
                  return (
                    <div key={falco.id} style={{
                      padding: '8px',
                      marginBottom: '6px',
                      backgroundColor: '#F8FFF9',
                      borderRadius: '4px',
                      border: '1px solid #BBF7D0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#059669' }}>
                            ✅ Falta #{index + 1} - {new Date(falco.createdAt).toLocaleDateString('es-MX')}
                          </div>
                          <div style={{ fontSize: '11px', color: '#065F46' }}>
                            Agente: {falco.agent?.personalData?.fullName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#065F46' }}>
                            {falco.falcoCompensatoryPayments?.length || 0} abono(s) realizados
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>
                            ${falcoAmount.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '10px', color: '#065F46' }}>
                            COMPENSADO
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  tone="active"
                  size="small"
                  onClick={() => updateState({ isFalcoModalOpen: true })}
                >
                  📋 Ver Detalles Completos
                </Button>
                <Button
                  tone="active"
                  size="small"
                  onClick={() => updateState({ isCreateFalcoModalOpen: true })}
                >
                  ⚠️ Reportar Nueva Falta
                </Button>
              </div>
            </div>
          );
        }
        
        if (pendingFalcos.length > 0) {
          // Hay falcos pendientes - Mostrar con historial si existe
          return (
            <div style={{
              backgroundColor: '#FEE2E2',
              border: '2px solid #EF4444',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: completedFalcos.length > 0 ? '12px' : '8px' }}>
                <div style={{ fontSize: '24px' }}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '700',
                    color: '#DC2626',
                    fontSize: '16px',
                    marginBottom: '4px',
                  }}>
                    FALTAS PENDIENTES DETECTADAS
                  </div>
                  <div style={{
                    color: '#991B1B',
                    fontSize: '14px',
                    lineHeight: '1.4',
                  }}>
                    {pendingFalcos.length} falta(s) pendiente(s)
                    {completedFalcos.length > 0 && `, ${completedFalcos.length} completados en historial`}
                    <br />Total pendiente: ${totalPendingAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    {completedFalcos.length > 0 && ` | Histórico compensado: $${totalCompensatedAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  </div>
                </div>
              </div>
              
              {/* Mostrar resumen del historial si existen falcos completados */}
              {completedFalcos.length > 0 && (
                <div style={{
                  backgroundColor: '#FEF3C7',
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '12px',
                  border: '1px solid #F59E0B'
                }}>
                  <div style={{ fontSize: '12px', color: '#92400E', fontWeight: '600' }}>
                    📊 HISTORIAL: {completedFalcos.length} falco(s) compensados previamente
                  </div>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  tone="negative"
                  size="small"
                  onClick={() => updateState({ isFalcoModalOpen: true })}
                >
                  💰 Abonar a Falcos
                </Button>
                <Button
                  tone="active"
                  size="small"
                  onClick={() => updateState({ isCreateFalcoModalOpen: true })}
                >
                  ⚠️ Reportar Nueva Falta
                </Button>
              </div>
            </div>
          );
        }
        
        return null;
      })()}

      {/* Eliminado: Banner de falcos - ahora integrado en la barra de KPIs */}

      {/* Banner informativo para datos migrados */}
      {migratedPaymentsCount > 0 && (
        <div style={{
          backgroundColor: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            fontSize: '20px',
          }}>
            📊
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: '600',
              color: '#D97706',
              fontSize: '14px',
              marginBottom: '4px',
            }}>
              Datos migrados de Excel detectados
            </div>
            <div style={{
              color: '#92400E',
              fontSize: '13px',
              lineHeight: '1.4',
            }}>
              Se encontraron {migratedPaymentsCount} pago(s) migrados desde Excel. 
              Estos datos son de solo lectura y no se pueden editar desde la interfaz. 
              No funcionan igual que los pagos creados por el sistema actual.
            </div>
          </div>
        </div>
      )}

      {/* Barra de KPIs reutilizable */}
      <KPIBar
        chips={[
          {
            label: 'Clientes',
            value: loansData?.loans?.length || 0,
            color: '#111827',
            backgroundColor: '#F3F4F6',
            borderColor: '#E5E7EB'
          },
          {
            label: 'Abonos',
            value: payments.length - strikethroughNewPaymentIndices.length,
            color: '#0B5ED7',
            backgroundColor: '#E7F1FF',
            borderColor: '#CFE2FF'
          },
          {
            label: 'Faltas',
            value: (() => {
              let pendingFalcos = 0;
              if (falcosData?.leadPaymentReceiveds && falcosData.leadPaymentReceiveds.length > 0) {
                pendingFalcos = falcosData.leadPaymentReceiveds.filter((falco: any) => {
                  const falcoAmount = parseFloat(falco.falcoAmount || '0');
                  const compensatedAmount = falco.falcoCompensatoryPayments?.reduce((sum: number, comp: any) => sum + parseFloat(comp.amount || '0'), 0) || 0;
                  return (falcoAmount - compensatedAmount) > 0;
                }).length;
              }
              const tachadosCount = strikethroughPaymentIds.length + strikethroughNewPaymentIndices.length;
              return pendingFalcos + tachadosCount;
            })(),
            color: '#B42318',
            backgroundColor: '#FEE2E2',
            borderColor: '#FECACA'
          },
          {
            label: 'Comisiones',
            value: `$${grandTotalComission.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            color: '#6D28D9',
            backgroundColor: '#EDE9FE',
            borderColor: '#DDD6FE',
            showTooltip: true,
            tooltipContent: (() => {
              const breakdown: { [key: string]: { count: number, amount: number } } = {};
              existingPayments
                .filter((payment: any) => !strikethroughPaymentIds.includes(payment.id))
                .forEach((payment: any) => {
                  const editedPayment = editedPayments[payment.id] || payment;
                  const c = parseFloat(editedPayment.comission || '0');
                  const k = c.toString();
                  if (!breakdown[k]) breakdown[k] = { count: 0, amount: 0 };
                  breakdown[k].count += 1;
                  breakdown[k].amount += c;
                });
              payments
                .filter((_: any, idx: number) => !strikethroughNewPaymentIndices.includes(idx))
                .forEach((payment: any) => {
                  const c = parseFloat(payment.comission?.toString() || '0');
                  const k = c.toString();
                  if (!breakdown[k]) breakdown[k] = { count: 0, amount: 0 };
                  breakdown[k].count += 1;
                  breakdown[k].amount += c;
                });
              const sorted = Object.entries(breakdown).sort(([,a], [,b]) => b.amount - a.amount).slice(0, 5);
              
              if (sorted.length === 0) {
                return <div style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic' }}>Sin desglose</div>;
              }
              
              return (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Desglose de Comisiones
                  </div>
                  {sorted.map(([commission, data]) => {
                    const isZeroCommission = parseFloat(commission) === 0;
                    return (
                      <div key={commission} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                        borderBottom: '1px solid #F3F4F6',
                        fontSize: '11px'
                      }}>
                        <span style={{
                          backgroundColor: isZeroCommission ? '#FEF3C7' : 'transparent',
                          color: isZeroCommission ? '#D97706' : '#374151',
                          padding: isZeroCommission ? '2px 6px' : '0',
                          borderRadius: isZeroCommission ? '4px' : '0',
                          fontWeight: isZeroCommission ? '500' : 'normal'
                        }}>
                          {data.count}x ${commission}
                        </span>
                        <span style={{ fontWeight: '600', color: '#6D28D9' }}>
                          ${data.amount.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          },
          {
            label: 'Total',
            value: `$${grandTotalAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            color: '#065F46',
            backgroundColor: '#ECFDF5',
            borderColor: '#D1FAE5',
            showTooltip: true,
            tooltipContent: (() => {
              const { cashTotal, transferTotal } = totalByPaymentMethod;
              
              return (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Desglose por Método de Pago
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #F3F4F6',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      💵 Efectivo
                    </span>
                    <span style={{ fontWeight: '600', color: '#065F46' }}>
                      ${cashTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      🏦 Transferencia
                    </span>
                    <span style={{ fontWeight: '600', color: '#065F46' }}>
                      ${transferTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              );
            })()
          },
          {
            label: 'Distribución Líder',
            value: (() => {
              const { cashPaidAmount, bankPaidAmount } = computedLoadPaymentDistribution;
              if (cashPaidAmount === 0 && bankPaidAmount === 0) {
                return 'Sin distribución';
              }
              return `E:$${cashPaidAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} T:$${bankPaidAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            })(),
            color: '#7C2D12',
            backgroundColor: '#FEF3C7',
            borderColor: '#FDE68A',
            showTooltip: true,
            tooltipContent: (() => {
              const { cashPaidAmount, bankPaidAmount } = computedLoadPaymentDistribution;
              const totalDistributed = cashPaidAmount + bankPaidAmount;
              const availableCash = totalByPaymentMethod.cashTotal;
              
              return (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Distribución del Pago de la Líder
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #F3F4F6',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      💵 Efectivo en Caja
                    </span>
                    <span style={{ fontWeight: '600', color: '#7C2D12' }}>
                      ${cashPaidAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #F3F4F6',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      🏦 Transferencia al Banco
                    </span>
                    <span style={{ fontWeight: '600', color: '#7C2D12' }}>
                      ${bankPaidAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #F3F4F6',
                    fontSize: '11px',
                    fontWeight: '600',
                    backgroundColor: '#FEF3C7',
                    margin: '4px -8px',
                    padding: '6px 8px',
                    borderRadius: '4px'
                  }}>
                    <span style={{ color: '#7C2D12' }}>
                      Total Distribuido
                    </span>
                    <span style={{ color: '#7C2D12' }}>
                      ${totalDistributed.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  {totalDistributed > availableCash && (
                    <div style={{
                      color: '#DC2626',
                      fontSize: '10px',
                      textAlign: 'center',
                      padding: '4px',
                      backgroundColor: '#FEE2E2',
                      border: '1px solid #FECACA',
                      borderRadius: '4px',
                      marginTop: '8px'
                    }}>
                      ⚠️ La distribución excede el efectivo disponible
                    </div>
                  )}
                </div>
              );
            })()
          }
        ]}
        buttons={[]}
        primaryMenu={{
          onSave: () => {
            // Adaptativo: Si hay pagos existentes (modo edición), guardar directamente
            // Si no hay pagos existentes (modo creación), abrir modal
            if (existingPayments.length > 0) {
              handleSaveAllChanges();
            } else {
              updateState({ isModalOpen: true });
            }
          },
          onReportFalco: () => updateState({ isCreateFalcoModalOpen: true }),
          onMove: () => {
            // Solo permitir mover si hay pagos existentes
            if (existingPayments.length > 0) {
              console.log('🔧 Botón Mover pagos clickeado');
              updateState({ isMovePaymentsModalOpen: true });
            }
          },
          saving: updateLoading,
          disabled: false,
          moveDisabled: existingPayments.length === 0 // Deshabilitar si no hay pagos
        }}
        massCommission={(payments.length > 0 || (isEditing && existingPayments.length > 0)) ? {
          value: massCommission,
          onChange: setMassCommission,
          onApply: () => {
            const commission = parseFloat(massCommission);
            if (isNaN(commission)) return;
            
            // Aplicar comisión masiva SOLO a pagos nuevos que tienen comisión > 0
            const newPayments = payments.map(payment => {
              const currentCommission = parseFloat(payment.comission?.toString() || '0');
              return {
                ...payment,
                comission: currentCommission > 0 ? commission : payment.comission
              };
            });
            
            // Aplicar comisión masiva SOLO a pagos existentes que tienen comisión > 0 en modo edición
            if (isEditing && existingPayments.length > 0) {
              const updatedEditedPayments = { ...editedPayments };
              existingPayments.forEach((payment: any) => {
                if (!payment.isMigrated && !strikethroughPaymentIds.includes(payment.id)) {
                  const currentCommission = parseFloat(payment.comission?.toString() || '0');
                  updatedEditedPayments[payment.id] = {
                    ...updatedEditedPayments[payment.id],
                    ...payment,
                    comission: currentCommission > 0 ? commission : payment.comission
                  };
                }
              });
              setState(prev => ({ 
                ...prev, 
                payments: newPayments,
                editedPayments: updatedEditedPayments
              }));
            } else {
              setState(prev => ({ ...prev, payments: newPayments }));
            }
          },
          visible: true
        } : undefined}
      />

      {/* Eliminado: Stats duplicados de TOTAL CLIENTES y PAGOS NUEVOS */}

      <Box
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'visible',
        }}
      >
        <Box padding="large">
          {/* Eliminado: Panel de comisión masiva - ahora integrado en la barra de KPIs */}

          {/* Contenedor principal con indicador de modo de edición */}
          <div style={{
            backgroundColor: isEditing ? '#FEF3C7' : 'transparent',
            border: isEditing ? '2px solid #F59E0B' : 'none',
            borderRadius: isEditing ? '12px' : '0',
            padding: isEditing ? '16px' : '0',
            marginBottom: '16px',
            transition: 'all 0.3s ease'
          }}>
            {/* Header con indicador de modo de edición */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '16px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Todos los Abonos</h3>
                {isEditing && (
                  <span style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: 'white',
                    backgroundColor: '#F59E0B',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    ✏️ Modo Edición
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {isEditing ? (
                  <>
                    <Button
                      tone="passive"
                      weight="bold"
                      onClick={() => {
                        setState(prev => ({ ...prev, editedPayments: {}, isEditing: false }));
                        setStrikethroughPaymentIds([]); // Resetear tachados al cancelar
                        setStrikethroughNewPaymentIndices([]); // Resetear tachados nuevos al cancelar
                      }}
                      style={{ 
                        fontSize: FONT_SYSTEM.small, 
                        padding: PADDING_SYSTEM.small, 
                        height: HEIGHT_SYSTEM.small,
                        fontWeight: '700',
                        backgroundColor: '#6B7280',
                        color: 'white',
                        border: 'none'
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      tone="negative"
                      weight="bold"
                      onClick={() => {
                        // Marcar TODOS los pagos existentes como eliminados
                        const allExistingPaymentIds = existingPayments
                          .filter((payment: any) => !payment.isMigrated)
                          .map((payment: any) => payment.id);
                        setStrikethroughPaymentIds(allExistingPaymentIds);
                        console.log('🗑️ Marcando todos los pagos existentes como eliminados:', allExistingPaymentIds);
                      }}
                      style={{ 
                        backgroundColor: '#DC2626', 
                        color: 'white', 
                        fontSize: FONT_SYSTEM.small, 
                        padding: PADDING_SYSTEM.small, 
                        height: HEIGHT_SYSTEM.small,
                        fontWeight: '700'
                      }}
                    >
                      Eliminar Todos
                    </Button>
                  </>
                ) : (
                <>
                  {/* Solo mostrar botones si hay pagos existentes */}
                  {existingPayments.length > 0 && (
                    <>
                      <Button
                        tone="active"
                        weight="bold"
                        onClick={() => setState(prev => ({ ...prev, isEditing: true }))}
                        style={{ 
                          fontSize: FONT_SYSTEM.small, 
                          padding: PADDING_SYSTEM.small, 
                          height: HEIGHT_SYSTEM.small, 
                          fontWeight: '700'
                        }}
                      >
                        Editar Abonos
                      </Button>
                      {/* Solo mostrar el botón de eliminar todos cuando esté en modo edición */}
                      {isEditing && (
                        <Button
                          tone="negative"
                          weight="bold"
                          onClick={() => {
                            // Marcar todos como eliminados
                            const allExistingPaymentIds = existingPayments
                              .filter((payment: any) => !payment.isMigrated)
                              .map((payment: any) => payment.id);
                            setStrikethroughPaymentIds(allExistingPaymentIds);
                            console.log('🗑️ Marcando todos los pagos existentes como eliminados:', allExistingPaymentIds);
                          }}
                          style={{ 
                            backgroundColor: '#DC2626', 
                            color: 'white', 
                            fontSize: FONT_SYSTEM.small, 
                            padding: PADDING_SYSTEM.small, 
                            height: HEIGHT_SYSTEM.small,
                            fontWeight: '700'
                          }}
                        >
                          Eliminar Todos (Existentes)
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    tone="active"
                    size="medium"
                    weight="bold"
                    onClick={handleAddPayment}
                    style={{ 
                      fontSize: FONT_SYSTEM.small, 
                      padding: PADDING_SYSTEM.small, 
                      height: HEIGHT_SYSTEM.small,
                      fontWeight: '700'
                    }}
                  >
                    <FaPlus size={12} style={{ marginRight: '8px' }} />
                    Agregar Pago
                  </Button>
                  {/* Botón dinámico para eliminar/desmarcar todos los pagos nuevos */}
                  {payments.length > 0 && (() => {
                    // Calcular si todos los pagos están marcados para eliminar
                    const allNewPaymentIndices = payments.map((_, index) => index);
                    const allMarkedForDeletion = allNewPaymentIndices.every(index => 
                      strikethroughNewPaymentIndices.includes(index)
                    );
                    
                    return (
                      <Button
                        tone={allMarkedForDeletion ? "positive" : "negative"}

                        weight="bold"
                        onClick={() => {
                          if (allMarkedForDeletion) {
                            // Desmarcar todos
                            setStrikethroughNewPaymentIndices([]);
                            console.log('✅ Desmarcando todos los pagos nuevos');
                          } else {
                            // Marcar todos como eliminados
                            setStrikethroughNewPaymentIndices(allNewPaymentIndices);
                            console.log('🗑️ Marcando todos los pagos nuevos como eliminados:', allNewPaymentIndices);
                          }
                        }}
                        size={"medium"}
                        style={{ 
                          backgroundColor: allMarkedForDeletion ? '#059669' : '#DC2626', 
                          color: 'white',
                          fontSize: FONT_SYSTEM.small, 
                          padding: PADDING_SYSTEM.small, 
                          height: HEIGHT_SYSTEM.small,
                          fontWeight: '700'
                        }}
                      >
                        {allMarkedForDeletion ? 'Desmarcar Todos (Nuevos)' : 'Eliminar Todos (Nuevos)'}
                      </Button>
                    );
                  })()}
                </>
              )}
            </div>
          </div>


          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ 
                  width: '60px',
                  textAlign: 'center',
                  cursor: 'help'
                }} title="Orden por fecha de crédito (1 = más antiguo)">
                  #
                </th>
                <th>Estado</th>
                <th>Código</th>
                <th>Cliente</th>
                <th style={{ 
                  position: 'relative',
                  cursor: 'help'
                }} title="Fecha de otorgamiento del crédito">
                  Fecha Crédito
                </th>
                <th>Monto</th>
                <th>Comisión</th>
                <th>Forma de Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {/* Créditos Sin Pago (siempre que haya pagos existentes) */}
              {missingPayments.map((loan: any, index: number) => (
                <tr key={`missing-${loan.id}`} style={{ 
                  backgroundColor: '#FEF2F2',
                  borderLeft: '4px solid #FCA5A5'
                }}>
                  <td style={{ 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#DC2626',
                    fontSize: FONT_SYSTEM.table
                  }}>
                    {existingPayments.length + index + 1}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: '1px solid #FCA5A5',
                    }}>
                      ⚠️ SIN PAGO
                    </span>
                  </td>
                  <td style={{
                    textAlign: 'center'
                  }}>
                    {(() => {
                      // Función para generar código corto a partir del id (igual que en generar-listados)
                      const shortCodeFromId = (id?: string): string => {
                        if (!id) return '';
                        const base = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        return base.slice(-6);
                      };

                      const clientCode = loan.borrower?.personalData?.clientCode || 
                                       shortCodeFromId(loan.borrower?.personalData?.id);
                      
                      return (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          border: '1px solid #FCA5A5'
                        }}>
                          {clientCode || 'N/A'}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ 
                    color: '#DC2626', 
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>{loan.borrower?.personalData?.fullName || 'Sin nombre'}</span>
                    {loan.borrower?.personalData?.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClient(loan.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6B7280',
                          fontSize: '12px'
                        }}
                        title="Editar cliente"
                      >
                        <FaEdit />
                      </button>
                    )}
                  </td>
                  <td style={{ color: '#DC2626', fontWeight: '500' }}>
                    {loan.signDate ? 
                      new Date(loan.signDate).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }) : 
                      '-'
                    }
                  </td>
                  <td style={{ color: '#DC2626', fontWeight: '500' }}>
                    ${Math.round(parseFloat(loan.weeklyPaymentAmount || '0'))}
                  </td>
                  <td style={{ color: '#DC2626', fontWeight: '500' }}>
                    ${Math.round(parseFloat(loan.loantype?.loanPaymentComission || '0'))}
                  </td>
                  <td style={{ color: '#DC2626', fontWeight: '500' }}>
                    -
                  </td>
                  <td>
                    {isEditing ? (
                      <Button
                        tone="positive"
                        weight="bold"
                        onClick={() => {
                          // Crear un pago temporal para este crédito sin pago
                          const newPayment = {
                            amount: loan.weeklyPaymentAmount,
                            comission: loan.loantype?.loanPaymentComission ? Math.round(parseFloat(loan.loantype.loanPaymentComission)) : Math.round(comission),
                            loanId: loan.id,
                            type: 'PAYMENT',
                            paymentMethod: 'CASH',
                            isUserAdded: true,
                            isMissingPayment: true, // Marcar como pago de crédito sin pago
                            loan: loan
                          };
                          
                          // Agregar a los pagos existentes para que aparezca como pagado
                          setState(prev => ({
                            ...prev,
                            existingPayments: [...prev.existingPayments, newPayment]
                          }));
                        }}
                        style={{ 
                          fontSize: FONT_SYSTEM.small, 
                          padding: PADDING_SYSTEM.small, 
                          height: HEIGHT_SYSTEM.small,
                          fontWeight: '700'
                        }}
                      >
                        Marcar como Pago
                      </Button>
                    ) : (
                      <span style={{
                        color: '#dc2626',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        fontWeight: '600'
                      }}>
                        Sin pago registrado
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {/* Abonos Registrados */}
              {existingPayments
                // Ordenar por fecha de firma del crédito ASC (mismo orden que PDF)
                .sort((a: any, b: any) => {
                  const sa = a.loan?.signDate || a.signDate;
                  const sb = b.loan?.signDate || b.signDate;
                  const dateA = new Date(sa || '1970-01-01').getTime();
                  const dateB = new Date(sb || '1970-01-01').getTime();
                  if (dateA !== dateB) return dateA - dateB;
                  const ida = (a.loan?.id || a.loanId || '').toString();
                  const idb = (b.loan?.id || b.loanId || '').toString();
                  return ida.localeCompare(idb);
                })
                .map((payment, index) => {
                const editedPayment = editedPayments[payment.id] || payment;
                const isStrikethrough = strikethroughPaymentIds.includes(payment.id);
                const hasZeroCommission = parseFloat(editedPayment.comission || '0') === 0;
                const isTransferPayment = editedPayment.paymentMethod === 'MONEY_TRANSFER';
                console.log(`Pago ${payment.id}: isStrikethrough=${isStrikethrough}, hasZeroCommission=${hasZeroCommission}, strikethroughPaymentIds=`, strikethroughPaymentIds);
                
                return (
                  <tr 
                    key={`existing-${payment.id}`} 
                    style={{ 
                      backgroundColor: isStrikethrough ? '#fee2e2' : (hasZeroCommission ? '#FEF3C7' : (isTransferPayment ? '#F3E8FF' : '#f8fafc')),
                      opacity: isStrikethrough ? 0.7 : 1,
                      borderLeft: isStrikethrough ? '4px solid #ef4444' : (hasZeroCommission ? '4px solid #D97706' : (isTransferPayment ? '4px solid #8B5CF6' : 'none')),
                      cursor: 'default',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <td style={{ 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: isStrikethrough ? '#dc2626' : '#6B7280',
                      fontSize: FONT_SYSTEM.table,
                      textDecoration: isStrikethrough ? 'line-through' : 'none'
                    }}>
                      {index + 1}
                    </td>
                    <td style={{
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      color: isStrikethrough ? '#dc2626' : 'inherit',
                      fontWeight: isStrikethrough ? '500' : 'inherit'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {payment.isMigrated ? (
                          <>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 8px',
                              backgroundColor: '#FEF3C7',
                              color: '#D97706',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              border: '1px solid #F59E0B',
                            }}>
                              📊 Migrado Excel
                            </span>
                            <span style={{
                              fontSize: '10px',
                              color: '#6B7280',
                              fontStyle: 'italic',
                              lineHeight: '1.2',
                            }}>
                              Solo lectura - No editable
                            </span>
                          </>
                        ) : payment.isMissingPayment ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            backgroundColor: '#DCFCE7',
                            color: '#166534',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                            border: '1px solid #BBF7D0',
                          }}>
                            ✅ Marcado como Pago
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            backgroundColor: '#E0F2FE',
                            color: '#0277BD',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                          }}>
                            Registrado
                          </span>
                        )}
                        
                        {/* Indicador de falco si el pago tiene falco */}
                        {payment.leadPaymentReceived?.paymentStatus === 'FALCO' && parseFloat(payment.leadPaymentReceived?.falcoAmount || '0') > 0 && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 6px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            border: '1px solid #EF4444',
                          }}>
                            ⚠️ FALCO: ${parseFloat(payment.leadPaymentReceived?.falcoAmount || '0').toFixed(2)}
                          </span>
                        )}
                        
                        {/* Indicador de falco parcial */}
                        {payment.leadPaymentReceived?.paymentStatus === 'PARTIAL' && parseFloat(payment.leadPaymentReceived?.falcoAmount || '0') > 0 && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 6px',
                            backgroundColor: '#FEF3C7',
                            color: '#D97706',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            border: '1px solid #F59E0B',
                          }}>
                            ⚠️ FALCO PARCIAL: ${parseFloat(payment.leadPaymentReceived?.falcoAmount || '0').toFixed(2)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      color: isStrikethrough ? '#dc2626' : 'inherit',
                      fontWeight: isStrikethrough ? '500' : 'inherit',
                      textAlign: 'center'
                    }}>
                      {(() => {
                        // Función para generar código corto a partir del id (igual que en generar-listados)
                        const shortCodeFromId = (id?: string): string => {
                          if (!id) return '';
                          const base = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                          return base.slice(-6);
                        };

                        const clientCode = payment.loan?.borrower?.personalData?.clientCode || 
                                         shortCodeFromId(payment.loan?.borrower?.personalData?.id);
                        
                        return (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            backgroundColor: '#EFF6FF',
                            color: '#1E40AF',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            border: '1px solid #BFDBFE'
                          }}>
                            {clientCode || 'N/A'}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      color: isStrikethrough ? '#dc2626' : 'inherit',
                      fontWeight: isStrikethrough ? '500' : 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>{payment.loan?.borrower?.personalData?.fullName}</span>
                      {payment.loan?.borrower?.personalData?.id && !isStrikethrough && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClient(payment.loanId || payment.loan?.id || '');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6B7280',
                            fontSize: '12px'
                          }}
                          title="Editar cliente"
                        >
                          <FaEdit />
                        </button>
                      )}
                    </td>
                    <td style={{
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      color: isStrikethrough ? '#dc2626' : 'inherit',
                      fontWeight: isStrikethrough ? '500' : 'inherit'
                    }}>
                      {payment.loan?.signDate ? 
                        new Date(payment.loan.signDate).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        }) : 
                        '-'
                      }
                    </td>
                    <td style={{
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      color: isStrikethrough ? '#dc2626' : 'inherit',
                      fontWeight: isStrikethrough ? '500' : 'inherit'
                    }}>
                      {isEditing && !payment.isMigrated ? (
                        <TextInput
                          type="number" step="1"
                          value={editedPayment.amount}
                          onChange={e => handleEditExistingPayment(payment.id, 'amount', e.target.value)}
                          disabled={isStrikethrough}
                          style={{ height: HEIGHT_SYSTEM.small, fontSize: FONT_SYSTEM.small }}
                        />
                      ) : (
                        <span style={{
                          ...(payment.isMigrated ? { color: '#6B7280', fontStyle: 'italic' } : {}),
                          textDecoration: isStrikethrough ? 'line-through' : 'none',
                          color: isStrikethrough ? '#dc2626' : (payment.isMigrated ? '#6B7280' : 'inherit'),
                          fontWeight: isStrikethrough ? '500' : 'inherit'
                        }}>
                          {Math.round(parseFloat(payment.amount || '0'))}
                        </span>
                      )}
                    </td>
                    <td style={{
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      color: isStrikethrough ? '#dc2626' : 'inherit',
                      fontWeight: isStrikethrough ? '500' : 'inherit'
                    }}>
                      {isEditing && !payment.isMigrated ? (
                        <div style={{ position: 'relative' }}>
                          <TextInput
                            type="number" step="1"
                            value={editedPayment.comission}
                            onChange={e => handleEditExistingPayment(payment.id, 'comission', e.target.value)}
                            disabled={isStrikethrough}
                            style={{ height: HEIGHT_SYSTEM.small, fontSize: FONT_SYSTEM.small }}
                          />
                          {payment.loan?.loantype?.loanPaymentComission && 
                           parseFloat(payment.loan.loantype.loanPaymentComission) > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '-20px',
                              right: '0',
                              fontSize: '10px',
                              color: '#059669',
                              backgroundColor: '#D1FAE5',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #A7F3D0'
                            }} title={`Comisión por defecto: ${payment.loan.loantype.loanPaymentComission}`}>
                              💡 {payment.loan.loantype.loanPaymentComission}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <span style={{
                            ...(payment.isMigrated ? { color: '#6B7280', fontStyle: 'italic' } : {}),
                            textDecoration: isStrikethrough ? 'line-through' : 'none',
                            color: isStrikethrough ? '#dc2626' : (payment.isMigrated ? '#6B7280' : 'inherit'),
                          fontWeight: isStrikethrough ? '500' : 'inherit'
                          }}>
                            {Math.round(parseFloat(payment.comission || '0'))}
                          </span>
                          {!payment.isMigrated && payment.loan?.loantype?.loanPaymentComission && 
                           parseFloat(payment.loan.loantype.loanPaymentComission) > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '-20px',
                              right: '0',
                              fontSize: '10px',
                              color: '#059669',
                              backgroundColor: '#D1FAE5',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #A7F3D0'
                            }} title={`Comisión por defecto: ${payment.loan.loantype.loanPaymentComission}`}>
                              💡 {payment.loan.loantype.loanPaymentComission}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{
                      textDecoration: isStrikethrough ? 'line-through' : 'none',
                      color: isStrikethrough ? '#dc2626' : 'inherit',
                      fontWeight: isStrikethrough ? '500' : 'inherit'
                    }}>
                      {isEditing && !payment.isMigrated ? (
                        <div 
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Select
                            options={paymentMethods}
                            value={paymentMethods.find(option => option.value === editedPayment.paymentMethod) || null}
                            onChange={(option) => handleEditExistingPayment(payment.id, 'paymentMethod', (option as Option).value)}
                            isDisabled={isStrikethrough}
                          />
                        </div>
                      ) : (
                        <span style={{
                          ...(payment.isMigrated ? { color: '#6B7280', fontStyle: 'italic' } : {}),
                          textDecoration: isStrikethrough ? 'line-through' : 'none',
                          color: isStrikethrough ? '#dc2626' : (payment.isMigrated ? '#6B7280' : 'inherit'),
                          fontWeight: isStrikethrough ? '500' : 'inherit'
                        }}>
                          {paymentMethods.find(opt => opt.value === payment.paymentMethod)?.label}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {/* Menú de 3 puntos para pagos existentes */}
                        {!payment.isMigrated && (
                          <div style={{ position: 'relative' }}>
                            <Button
                              tone="passive"
                              size="small"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                console.log('🔍 Abriendo menú para pago existente:', payment.id);
                                setShowMenuForPayment(`existing-${payment.id}`); 
                              }}
                              style={{ padding: '4px' }}
                            >
                              <FaEllipsisV size={12} />
                            </Button>
                            
                            {showMenuForPayment === `existing-${payment.id}` && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: '0',
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 1000,
                                minWidth: '180px'
                              }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const loanId = (payment.loanId || payment.loan?.id || '');
                                    if (!loanId) return;
                                    handleEditClient(loanId);
                                    setShowMenuForPayment(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderBottom: '1px solid #e5e7eb'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#f9fafb'}
                                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                                >
                                  <FaEdit size={12} />
                                  Editar Cliente
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const loanId = (payment.loanId || payment.loan?.id || '');
                                    if (loanId) {
                                      const selectedLoan = loansData?.loans?.find(l => l.id === loanId);
                                      if (selectedLoan) {
                                        openAvalEditModal(selectedLoan);
                                      }
                                    }
                                    setShowMenuForPayment(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#f9fafb'}
                                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                                >
                                  👤 Editar aval
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Botones de edición existentes */}
                        {!payment.isMigrated && isEditing && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {strikethroughPaymentIds.includes(payment.id) ? (
                              <Button
                                tone="positive"
                                size="small"
                                onClick={() => {
                                  // Restaurar pago (quitar de tachados)
                                  console.log('Restaurando pago:', payment.id);
                                  setStrikethroughPaymentIds(prev => prev.filter(id => id !== payment.id));
                                }}
                                title="Restaurar pago"
                              >
                                ✓
                              </Button>
                            ) : (
                              <Button
                                tone="negative"
                                size="small"
                                onClick={() => {
                                  // Marcar como tachado (eliminado visualmente)
                                  console.log('🗑️ [FRONTEND DEBUG] Marcando como tachado:', payment.id);
                                  console.log('🗑️ [FRONTEND DEBUG] Detalles del pago:', {
                                    id: payment.id,
                                    loanId: payment.loan?.id,
                                    amount: payment.amount,
                                    clientName: payment.loan?.borrower?.personalData?.fullName,
                                    receivedAt: payment.receivedAt,
                                    paymentMethod: payment.paymentMethod
                                  });
                                  
                                  
                                  setStrikethroughPaymentIds(prev => [...prev, payment.id]);
                                  
                                  // También eliminar del estado editedPayments
                                  const newEditedPayments = { ...editedPayments };
                                  delete newEditedPayments[payment.id];
                                  setState(prev => ({ ...prev, editedPayments: newEditedPayments }));
                                }}
                                title="Marcar como eliminado"
                              >
                                <TrashIcon size="small" />
                              </Button>
                            )}
                          </div>
                        )}
                        {payment.isMigrated && (
                          <span style={{
                            fontSize: '12px',
                            color: '#9CA3AF',
                            fontStyle: 'italic',
                          }}>
                            No editable
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Abonos Nuevos */}
              {payments.map((payment, index) => {
                const isStrikethrough = strikethroughNewPaymentIndices.includes(index);
                const hasZeroCommission = parseFloat(payment.comission?.toString() || '0') === 0;
                const isDeceased = deceasedLoanIds.has(payment.loanId || '');
                const isTransferPayment = payment.paymentMethod === 'MONEY_TRANSFER';
                const paymentKey = `new-${index}`;
                return (
                <tr 
                  key={paymentKey} 
                  onClick={(e) => handleRowSelection(paymentKey, e)}
                  style={{ 
                    backgroundColor: isDeceased ? '#f3f4f6' : (isStrikethrough ? '#fee2e2' : (hasZeroCommission ? '#FEF3C7' : (isTransferPayment ? '#F3E8FF' : '#ECFDF5'))),
                    opacity: isDeceased ? 0.6 : (isStrikethrough ? 0.7 : 1),
                    borderLeft: isDeceased ? '4px solid #6b7280' : (isStrikethrough ? '4px solid #ef4444' : (hasZeroCommission ? '4px solid #D97706' : (isTransferPayment ? '4px solid #8B5CF6' : 'none'))),
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <td style={{ 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: isDeceased ? '#6b7280' : (isStrikethrough ? '#dc2626' : '#059669'),
                    fontSize: FONT_SYSTEM.table,
                    textDecoration: isStrikethrough ? 'line-through' : 'none'
                  }}>
                    {existingPayments.filter(p => !strikethroughPaymentIds.includes(p.id)).length + index + 1}
                  </td>
                  <td style={{
                    textDecoration: isStrikethrough ? 'line-through' : 'none',
                    color: isDeceased ? '#6b7280' : (isStrikethrough ? '#dc2626' : 'inherit'),
                    fontWeight: isStrikethrough ? '500' : 'inherit'
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      backgroundColor: isDeceased ? '#e5e7eb' : (isStrikethrough ? '#fee2e2' : '#D1FAE5'),
                      color: isDeceased ? '#6b7280' : (isStrikethrough ? '#dc2626' : '#059669'),
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}>
                      {isDeceased ? 'Deceso' : 'Abono'}
                    </span>
                  </td>
                  <td style={{
                    textDecoration: isStrikethrough ? 'line-through' : 'none',
                    color: isStrikethrough ? '#dc2626' : 'inherit',
                    fontWeight: isStrikethrough ? '500' : 'inherit',
                    textAlign: 'center'
                  }}>
                    {(() => {
                      // Función para generar código corto a partir del id (igual que en generar-listados)
                      const shortCodeFromId = (id?: string): string => {
                        if (!id) return '';
                        const base = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        return base.slice(-6);
                      };

                      const selectedLoan = loansData?.loans?.find(loan => loan.id === payment.loanId);
                      const clientCode = selectedLoan?.borrower?.personalData?.clientCode || 
                                       shortCodeFromId(selectedLoan?.borrower?.personalData?.id);
                      
                      return (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          backgroundColor: '#EFF6FF',
                          color: '#1E40AF',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          border: '1px solid #BFDBFE'
                        }}>
                          {clientCode || 'N/A'}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{
                    textDecoration: isStrikethrough ? 'line-through' : 'none',
                    color: isStrikethrough ? '#dc2626' : 'inherit',
                    fontWeight: isStrikethrough ? '500' : 'inherit'
                  }}>
                    {payment.isUserAdded ? (
                      // Pagos agregados por usuario: siempre mostrar dropdown
                      <div 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Select
                          options={loansData?.loans
                            ?.filter(loan => loan.borrower && loan.borrower.personalData)
                            ?.map(loan => ({
                              value: loan.id,
                              label: `${loan.borrower?.personalData?.fullName || 'Sin nombre'} (${loan.signDate ? new Date(loan.signDate).toLocaleDateString('es-MX', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              }) : 'Sin fecha'})`
                            })) || []}
                          value={loansData?.loans.find(loan => loan.id === payment.loanId) ? {
                            value: payment.loanId,
                            label: (() => {
                            const selectedLoan = loansData.loans.find(loan => loan.id === payment.loanId);
                            return `${selectedLoan?.borrower?.personalData?.fullName || 'Sin nombre'} (${selectedLoan?.signDate ? new Date(selectedLoan.signDate).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            }) : 'Sin fecha'})`;
                          })()
                        } : null}
                        onChange={(option) => handleChange(index, 'loanId', (option as Option).value)}
                        isDisabled={isStrikethrough || isDeceased}
                      />
                      </div>
                    ) : (
                      // Pagos existentes: mostrar solo texto
                      loansData?.loans.find(loan => loan.id === payment.loanId)?.borrower?.personalData?.fullName || 'Sin nombre'
                    )}
                  </td>
                  <td style={{
                    textDecoration: isStrikethrough ? 'line-through' : 'none',
                    color: isStrikethrough ? '#dc2626' : 'inherit',
                    fontWeight: isStrikethrough ? '500' : 'inherit'
                  }}>
                    {payment.loanId && loansData?.loans ? 
                      (() => {
                        const selectedLoan = loansData.loans.find(loan => loan.id === payment.loanId);
                        return selectedLoan?.signDate ? 
                          new Date(selectedLoan.signDate).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          }) : 
                          '-'
                      })() : 
                      '-'
                    }
                  </td>
                  <td style={{
                    textDecoration: isStrikethrough ? 'line-through' : 'none',
                    color: isStrikethrough ? '#dc2626' : 'inherit',
                    fontWeight: isStrikethrough ? '500' : 'inherit'
                  }}>
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      data-no-select="true"
                    >
                      <TextInput
                        type="number" step="1"
                        value={Math.round(parseFloat(payment.amount || '0'))}
                        onChange={(e) => handleChange(index, 'amount', e.target.value)}
                        disabled={isStrikethrough || isDeceased}
                        style={{ height: HEIGHT_SYSTEM.small, fontSize: FONT_SYSTEM.small }}
                      />
                    </div>
                  </td>
                  <td style={{
                    textDecoration: isStrikethrough ? 'line-through' : 'none',
                    color: isStrikethrough ? '#dc2626' : 'inherit',
                    fontWeight: isStrikethrough ? '500' : 'inherit'
                  }}>
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      data-no-select="true"
                    >
                      <TextInput
                        type="number" step="1"
                        value={Math.round(parseFloat(payment.comission?.toString() || '0'))}
                        onChange={(e) => handleChange(index, 'comission', e.target.value)}
                        disabled={isStrikethrough || isDeceased}
                        style={{ height: HEIGHT_SYSTEM.small, fontSize: FONT_SYSTEM.small }}
                      />
                    </div>
                  </td>
                  <td style={{
                    textDecoration: isStrikethrough ? 'line-through' : 'none',
                    color: isStrikethrough ? '#dc2626' : 'inherit',
                    fontWeight: isStrikethrough ? '500' : 'inherit'
                  }}>
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select
                        options={paymentMethods}
                        value={paymentMethods.find(option => option.value === payment.paymentMethod) || null}
                        onChange={(option) => handleChange(index, 'paymentMethod', (option as Option).value)}
                        isDisabled={isStrikethrough || isDeceased}
                      />
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {/* Menú de 3 puntos */}
                      <div style={{ position: 'relative' }}>
                        <Button
                          tone="passive"
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setShowMenuForPayment(`new-${index}`); }}
                          style={{ padding: '4px' }}
                          isDisabled={isDeceased}
                        >
                          <FaEllipsisV size={12} />
                        </Button>
                        
                        {showMenuForPayment === `new-${index}` && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: '0',
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: '180px'
                          }}>
                            {!isDeceased ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const loanId = (payment.loanId || payment.loan?.id || '');
                                    console.log('🔍 Botón Editar Cliente (no fallecido) clickeado, loanId:', loanId);
                                    if (!loanId) {
                                      console.log('❌ No hay loanId, cancelando');
                                      return;
                                    }
                                    handleEditClient(loanId);
                                    setShowMenuForPayment(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderBottom: '1px solid #e5e7eb'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#f9fafb'}
                                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                                >
                                  <FaEdit size={12} />
                                  Editar Cliente
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const loanId = (payment.loanId || payment.loan?.id || '');
                                    if (loanId) {
                                      const selectedLoan = loansData?.loans?.find(l => l.id === loanId);
                                      if (selectedLoan) {
                                        openAvalEditModal(selectedLoan);
                                      }
                                    }
                                    setShowMenuForPayment(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderBottom: '1px solid #e5e7eb'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#f9fafb'}
                                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                                >
                                  👤 Editar aval
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const selectedLoan = loansData?.loans?.find(loan => loan.id === payment.loanId);
                                    setDeceasedModal({
                                      isOpen: true,
                                      loanId: (payment.loanId || ''),
                                      clientName: selectedLoan?.borrower?.personalData?.fullName || 'Cliente'
                                    });
                                    setShowMenuForPayment(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#dc2626',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#fef2f2'}
                                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                                >
                                  💀 Registrar deceso
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const selectedLoan = loansData?.loans?.find(loan => loan.id === payment.loanId);
                                    if (selectedLoan?.borrower?.personalData) {
                                      setPromoteModal({
                                        isOpen: true,
                                        clientId: selectedLoan.borrower.personalData.id,
                                        clientName: selectedLoan.borrower.personalData.fullName || 'Cliente',
                                        currentLeadId: selectedLead?.id || ''
                                      });
                                    }
                                    setShowMenuForPayment(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#059669',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderBottom: '1px solid #e5e7eb'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#f0fdf4'}
                                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                                >
                                  👑 Promover a lider
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const loanId = (payment.loanId || payment.loan?.id || '');
                                    if (!loanId) {
                                      console.log('❌ No hay loanId, cancelando');
                                      return;
                                    }
                                    handleEditClient(loanId);
                                    setShowMenuForPayment(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderBottom: '1px solid #e5e7eb'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#f9fafb'}
                                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                                >
                                  <FaEdit size={12} />
                                  Editar Cliente
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const selectedLoan = loansData?.loans?.find(loan => loan.id === payment.loanId);
                                    if (selectedLoan) {
                                      openAvalEditModal(selectedLoan);
                                    }
                                    setShowMenuForPayment(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderBottom: '1px solid #e5e7eb'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#f9fafb'}
                                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                                >
                                  👤 Editar aval
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const loanId = (payment.loanId || payment.loan?.id || '');
                                    if (!loanId) return;
                                    handleUnmarkAsDeceased(loanId);
                                    setShowMenuForPayment(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#2563eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#eff6ff'}
                                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                                >
                                  ↩️ Deshacer deceso
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Botones existentes */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {!isDeceased && (isStrikethrough ? (
                          <Button
                            tone="positive"
                            size="small"
                            onClick={() => {
                              console.log('Restaurando pago nuevo:', index);
                              setStrikethroughNewPaymentIndices(prev => prev.filter(i => i !== index));
                            }}
                            title="Restaurar pago"
                          >
                            ✓
                          </Button>
                        ) : (
                          <Button
                            tone="negative"
                            size="small"
                            onClick={() => {
                              console.log('Marcando pago nuevo como tachado:', index);
                              setStrikethroughNewPaymentIndices(prev => [...prev, index]);
                            }}
                            title="Marcar como eliminado"
                          >
                            <TrashIcon size="small" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div> {/* Cierre del contenedor del modo de edición */}
        </Box>
      </Box>

      

      {/* Modal para crear falco */}
      <AlertDialog 
        title="Reportar Nuevo Falco" 
        isOpen={isCreateFalcoModalOpen} 
        actions={{
          confirm: { 
            label: 'Reportar Falco', 
            action: () => handleCreateFalco(), 
            loading: customLeadPaymentLoading || updateLoading 
          },
          cancel: { 
            label: 'Cancelar', 
            action: () => updateState({ isCreateFalcoModalOpen: false, createFalcoAmount: 0 }) 
          }
        }}
      >
        <Box padding="large">
          <Box marginBottom="large">
            <h4>Información del Falco</h4>
          </Box>
          
          <Box marginBottom="large">
            <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Localidad: {selectedLead?.personalData?.fullName}
            </div>
            <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Fecha: {selectedDate?.toLocaleDateString('es-MX')}
            </div>
          </Box>
          
          <Box marginBottom="large">
            <label>Cantidad del Falco</label>
            <TextInput
              type="number"
              value={createFalcoAmount}
              onChange={(e) => updateState({ createFalcoAmount: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </Box>
          
          <div style={{
            backgroundColor: '#FEE2E2',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#991B1B',
            border: '1px solid #FCA5A5'
          }}>
            <strong>⚠️ Advertencia:</strong> Al reportar este falco se registrará automáticamente como una pérdida (EXPENSE) 
            en el sistema y se descontará del balance de efectivo de la localidad. 
            <br /><br />
            <strong>💡 Lógica mejorada:</strong> Cuando se hagan abonos a este falco, la pérdida se reducirá proporcionalmente. 
            Si se paga completamente, la pérdida se cancelará (quedará en $0.00), manteniendo el historial visible.
          </div>
        </Box>
      </AlertDialog>

      {/* Modal para abonar a falcos */}
      <AlertDialog 
        title="Abonar a Falcos Pendientes" 
        isOpen={isFalcoModalOpen} 
        actions={{
          confirm: { 
            label: 'Registrar Abono', 
            action: () => handleFalcoPayment(), 
            loading: falcoPaymentLoading 
          },
          cancel: { 
            label: 'Cancelar', 
            action: () => updateState({ isFalcoModalOpen: false, selectedFalcoId: null, falcoPaymentAmount: 0 }) 
          }
        }}
      >
        <Box padding="large">
          <Box marginBottom="large">
            <h4>Seleccionar Falco a Abonar</h4>
          </Box>
          
          {falcosData?.leadPaymentReceiveds && falcosData.leadPaymentReceiveds.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              {/* Separar falcos pendientes y completados */}
              {(() => {
                const pendingFalcos = falcosData.leadPaymentReceiveds.filter((falco: any) => {
                  const falcoAmount = parseFloat(falco.falcoAmount || '0');
                  const compensatedAmount = falco.falcoCompensatoryPayments?.reduce((sum: number, comp: any) => 
                    sum + parseFloat(comp.amount || '0'), 0) || 0;
                  return (falcoAmount - compensatedAmount) > 0;
                });
                
                const completedFalcos = falcosData.leadPaymentReceiveds.filter((falco: any) => {
                  const falcoAmount = parseFloat(falco.falcoAmount || '0');
                  const compensatedAmount = falco.falcoCompensatoryPayments?.reduce((sum: number, comp: any) => 
                    sum + parseFloat(comp.amount || '0'), 0) || 0;
                  return (falcoAmount - compensatedAmount) <= 0 && falcoAmount > 0;
                });

                return (
                  <>
                    {/* Falcos Pendientes */}
                    {pendingFalcos.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#DC2626',
                          marginBottom: '8px',
                          padding: '8px',
                          backgroundColor: '#FEE2E2',
                          borderRadius: '4px',
                          border: '1px solid #FCA5A5'
                        }}>
                          ⚠️ FALCOS PENDIENTES ({pendingFalcos.length})
                        </div>
                        {pendingFalcos.map((falco: any) => {
                          const falcoAmount = parseFloat(falco.falcoAmount || '0');
                          const compensatedAmount = falco.falcoCompensatoryPayments?.reduce((sum: number, comp: any) => 
                            sum + parseFloat(comp.amount || '0'), 0) || 0;
                          const remainingAmount = falcoAmount - compensatedAmount;
                          
                          return (
                            <div 
                              key={falco.id} 
                              style={{
                                border: selectedFalcoId === falco.id ? '2px solid #EF4444' : '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '8px',
                                cursor: 'pointer',
                                backgroundColor: selectedFalcoId === falco.id ? '#FEE2E2' : 'white',
                              }}
                              onClick={() => {
                                updateState({ 
                                  selectedFalcoId: falco.id, 
                                  falcoPaymentAmount: remainingAmount > 0 ? remainingAmount : 0 
                                });
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ 
                                    fontWeight: '600', 
                                    color: '#DC2626',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}>
                                    ⚠️ Falco del {new Date(falco.createdAt).toLocaleDateString('es-MX')}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                    Agente: {falco.agent?.personalData?.fullName}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                    Compensado: ${compensatedAmount.toFixed(2)} de ${falcoAmount.toFixed(2)}
                                  </div>
                                  {falco.falcoCompensatoryPayments && falco.falcoCompensatoryPayments.length > 0 && (
                                    <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>
                                      📋 {falco.falcoCompensatoryPayments.length} abono(s) realizado(s)
                                    </div>
                                  )}
                                </div>
                                <div style={{ 
                                  fontWeight: '700', 
                                  color: '#DC2626', 
                                  fontSize: '16px' 
                                }}>
                                  $${remainingAmount.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Historial de Falcos Completados */}
                    {completedFalcos.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#059669',
                          marginBottom: '8px',
                          padding: '8px',
                          backgroundColor: '#D1FAE5',
                          borderRadius: '4px',
                          border: '1px solid #A7F3D0'
                        }}>
                          ✅ HISTORIAL COMPLETADOS ({completedFalcos.length})
                        </div>
                        <div style={{
                          maxHeight: '200px',
                          overflowY: 'auto',
                          border: '1px solid #D1FAE5',
                          borderRadius: '6px',
                          backgroundColor: '#F8FFF9'
                        }}>
                          {completedFalcos.map((falco: any) => {
                            const falcoAmount = parseFloat(falco.expectedAmount || '0');
                            const compensatedAmount = falco.falcoCompensatoryPayments?.reduce((sum: number, comp: any) => 
                              sum + parseFloat(comp.amount || '0'), 0) || 0;
                            
                            return (
                              <div 
                                key={falco.id} 
                                style={{
                                  padding: '12px',
                                  borderBottom: '1px solid #D1FAE5',
                                  backgroundColor: '#F8FFF9',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div style={{ 
                                      fontWeight: '600', 
                                      color: '#059669',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}>
                                      ✅ Falco del {new Date(falco.createdAt).toLocaleDateString('es-MX')}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#065F46' }}>
                                      Agente: {falco.agent?.personalData?.fullName}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#065F46' }}>
                                      Total compensado: ${compensatedAmount.toFixed(2)}
                                    </div>
                                    {falco.falcoCompensatoryPayments && falco.falcoCompensatoryPayments.length > 0 && (
                                      <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>
                                        📋 {falco.falcoCompensatoryPayments.length} abono(s) realizado(s)
                                      </div>
                                    )}
                                    <div style={{ 
                                      fontSize: '11px', 
                                      color: '#059669', 
                                      marginTop: '4px',
                                      fontWeight: '600'
                                    }}>
                                      🎉 Completamente compensado
                                    </div>
                                  </div>
                                  <div style={{ 
                                    fontWeight: '700', 
                                    color: '#059669', 
                                    fontSize: '16px' 
                                  }}>
                                    ✅ ${falcoAmount.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          
          {/* Historial de abonos del falco seleccionado */}
          {selectedFalcoId && falcosData?.leadPaymentReceiveds && (
            <Box marginBottom="large">
              <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#374151' }}>
                📋 Historial de Abonos
              </h4>
              {(() => {
                const selectedFalco = falcosData.leadPaymentReceiveds.find((f: any) => f.id === selectedFalcoId);
                const payments = selectedFalco?.falcoCompensatoryPayments || [];
                
                if (payments.length === 0) {
                  return (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#F9FAFB',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#6B7280',
                      fontStyle: 'italic'
                    }}>
                      No hay abonos registrados para este falco
                    </div>
                  );
                }
                
                return (
                  <div style={{
                    maxHeight: '150px',
                    overflowY: 'auto',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px'
                  }}>
                    {payments.map((payment: any, index: number) => (
                      <div key={payment.id} style={{
                        padding: '8px 12px',
                        borderBottom: index < payments.length - 1 ? '1px solid #F3F4F6' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px'
                      }}>
                        <div>
                          <div style={{ color: '#374151', fontWeight: '500' }}>
                            Abono #{index + 1}
                          </div>
                          <div style={{ color: '#6B7280', fontSize: '12px' }}>
                            {new Date(payment.createdAt).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <div style={{ 
                          fontWeight: '600', 
                          color: '#059669',
                          fontSize: '14px'
                        }}>
                          +${parseFloat(payment.amount || '0').toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Box>
          )}
          
          <Box marginBottom="large">
            <label>Cantidad a Abonar</label>

            <TextInput
              type="number"
              value={falcoPaymentAmount.toString()}
              onChange={(e) => {
                const value = e.target.value;
                const numValue = value === '' ? 0 : parseFloat(value);
                updateState({ falcoPaymentAmount: isNaN(numValue) ? 0 : numValue });
              }}
              placeholder="0"
            />
          </Box>
          
          {selectedFalcoId && (
            <>
              <div style={{
                backgroundColor: '#E0F2FE',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#0C4A6E',
                marginBottom: '8px',
                border: '1px solid #7DD3FC'
              }}>
                <strong>💡 Nueva Lógica Mejorada:</strong> Este abono se registrará como pago compensatorio del falco. 
                En lugar de crear transacciones adicionales, se <strong>reducirá directamente</strong> el monto de la pérdida original. 
                Si el falco se paga completamente, la pérdida se cancelará (quedará en $0.00). 
                Si es pago parcial, la pérdida se reducirá proporcionalmente. El historial siempre se mantiene visible.
              </div>

            </>
          )}
        </Box>
      </AlertDialog>

      <AlertDialog 
        title="Distribución del pago" 
        isOpen={isModalOpen} 
        actions={{
          confirm: { 
            label: 'Confirmar', 
            action: () => handleSubmit(), 
            loading: customLeadPaymentLoading || updateLoading 
          },
          cancel: { 
            label: 'Cerrar', 
            action: () => updateState({ isModalOpen: false }) 
          }
        }}
      >
        <Box padding="large">
          <Box marginBottom="large">
            <h4><strong>Total:</strong> ${(payments.length > 0 ? totalAmount : state.groupedPayments ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0 : 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h4>
          </Box>
          
          {/* Desglose por método de pago */}
          <Box marginBottom="large" style={{ 
            backgroundColor: '#F8FAFC', 
            border: '1px solid #E2E8F0', 
            borderRadius: '8px', 
            padding: '1rem' 
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              Desglose por Método de Pago
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '8px 12px', 
                backgroundColor: '#ECFDF5', 
                border: '1px solid #D1FAE5', 
                borderRadius: '6px' 
              }}>
                <span style={{ marginRight: '8px', fontSize: '16px' }}>💵</span>
                <div>
                  <div style={{ fontSize: '12px', color: '#065F46', fontWeight: '500' }}>Efectivo</div>
                  <div style={{ fontSize: '16px', color: '#065F46', fontWeight: '600' }}>
                    ${totalByPaymentMethod.cashTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '8px 12px', 
                backgroundColor: '#EFF6FF', 
                border: '1px solid #BFDBFE', 
                borderRadius: '6px' 
              }}>
                <span style={{ marginRight: '8px', fontSize: '16px' }}>🏦</span>
                <div>
                  <div style={{ fontSize: '12px', color: '#1D4ED8', fontWeight: '500' }}>Transferencia</div>
                  <div style={{ fontSize: '16px', color: '#1D4ED8', fontWeight: '600' }}>
                    ${totalByPaymentMethod.transferTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>
          </Box>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
            <Box marginBottom="large">
              <label>Distribución de Efectivo:</label>
              <div style={{ 
                padding: '8px 12px', 
                backgroundColor: '#ffffff', 
                border: '1px solid #ccc',
                borderRadius: '4px',
                color: '#333',
                fontWeight: '500',
                marginTop: '0.5rem',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}>
                ${loadPaymentDistribution.cashPaidAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6B7280', 
                fontStyle: 'italic',
                marginTop: '0.5rem'
              }}>
                Solo puedes distribuir: ${totalByPaymentMethod.cashTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (efectivo real)
              </div>
            </Box>
            
            <Box marginBottom="large">
              <label>Transferencia:</label>
              <TextInput
                type="number"
                min="0"
                max={totalByPaymentMethod.cashTotal} // Limitar solo al efectivo real
                value={loadPaymentDistribution.bankPaidAmount.toString()}
                onChange={(e) => {
                  updateState({ hasUserEditedDistribution: true });
                  const transferAmount = Math.max(0, Math.min(parseFloat(e.target.value) || 0, totalByPaymentMethod.cashTotal));
                  // ✅ CORREGIDO: El efectivo disponible para distribución es solo el efectivo real menos la transferencia
                  const cashAmount = totalByPaymentMethod.cashTotal - transferAmount;
                  const totalAmountValue = payments.length > 0 ? totalAmount : state.groupedPayments ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0 : 0;
                  
                  updateState({
                    loadPaymentDistribution: {
                      ...loadPaymentDistribution,
                      bankPaidAmount: transferAmount,
                      cashPaidAmount: cashAmount, // Solo efectivo real menos transferencia
                      totalPaidAmount: totalAmountValue,
                    }
                  });
                }}
                style={{ 
                  border: loadPaymentDistribution.bankPaidAmount > totalByPaymentMethod.cashTotal ? '2px solid #e74c3c' : '1px solid #ccc',
                  marginTop: '0.5rem',
                  height: '40px',
                  fontSize: '14px',
                  padding: '8px 12px',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ 
                fontSize: '12px', 
                color: '#6B7280', 
                fontStyle: 'italic',
                marginTop: '0.5rem'
              }}>
                Máximo: ${totalByPaymentMethod.cashTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </Box>
          </div>
          
          {loadPaymentDistribution.bankPaidAmount > totalByPaymentMethod.cashTotal && (
            <div style={{ 
              color: '#e74c3c', 
              fontSize: '0.9em', 
              textAlign: 'center',
              padding: '0.5rem',
              backgroundColor: '#fdf2f2',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              marginTop: '1rem'
            }}>
              El monto de transferencia no puede ser mayor al efectivo real disponible (${totalByPaymentMethod.cashTotal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
            </div>
          )}
        </Box>
      </AlertDialog>

      {/* Modal de confirmación de deceso */}
      <AlertDialog 
        title="Confirmar Registro de Deceso" 
        isOpen={deceasedModal.isOpen} 
        actions={{
          confirm: { 
            label: 'Confirmar Deceso', 
            action: handleMarkAsDeceased, 
            loading: markDeceasedLoading 
          },
          cancel: { 
            label: 'Cancelar', 
            action: () => setDeceasedModal({ isOpen: false, loanId: null, clientName: '' }) 
          }
        }}
      >
        <Box padding="large">
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#DC2626',
              fontWeight: '600'
            }}>
              ⚠️ Acción Irreversible
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#991B1B' }}>
              Esta acción marcará el préstamo como deceso y establecerá la fecha de finalización.
              No se puede deshacer.
            </p>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Detalles del Préstamo</h4>
            <div style={{ 
              backgroundColor: '#F9FAFB', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #E5E7EB'
            }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>Cliente:</strong> {deceasedModal.clientName}
              </div>
              <div style={{ marginBottom: '4px' }}>
                <strong>Fecha de deceso:</strong> {selectedDate?.toLocaleDateString('es-MX')}
              </div>
              <div>
                <strong>Estado:</strong> Se marcará como finalizado por deceso
              </div>
            </div>
          </div>
          
          <div style={{
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '13px',
            color: '#1E40AF'
          }}>
            <strong>💡 Información:</strong> Al confirmar, el préstamo se marcará como deceso 
            con fecha {selectedDate?.toLocaleDateString('es-MX')} y se establecerá como finalizado.
          </div>
        </Box>
      </AlertDialog>

      {/* Modal de confirmación de promoción a líder */}
      <AlertDialog 
        title="Promover a Líder" 
        isOpen={promoteModal.isOpen} 
        actions={{
          confirm: { 
            label: 'Promover a Líder', 
            action: handlePromoteToLead, 
            loading: promoteLoading 
          },
          cancel: { 
            label: 'Cancelar', 
            action: () => setPromoteModal({ isOpen: false, clientId: null, clientName: '', currentLeadId: null }) 
          }
        }}
      >
        <Box padding="large">
          <div style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#059669',
              fontWeight: '600'
            }}>
              👑 Promoción a Líder
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#047857' }}>
              ¿Seguro que deseas promover a <strong>{promoteModal.clientName}</strong> a líder?
            </p>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Acciones que se realizarán:</h4>
            <div style={{ 
              backgroundColor: '#F9FAFB', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #E5E7EB'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>1.</strong> Se creará un nuevo registro de Employee para {promoteModal.clientName}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>2.</strong> Todos los clientes activos del líder actual serán transferidos al nuevo líder
              </div>
              <div>
                <strong>3.</strong> La información del líder anterior (dirección) se mantendrá idéntica
              </div>
            </div>
          </div>
          
          <div style={{
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '13px',
            color: '#1E40AF'
          }}>
            <strong>💡 Información:</strong> Esta acción creará un nuevo líder y transferirá toda la cartera de clientes activos.
          </div>
        </Box>
      </AlertDialog>

      {/* Modal de Mover Pagos */}
      {console.log('🔍 Estado isMovePaymentsModalOpen:', isMovePaymentsModalOpen)}
      {isMovePaymentsModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            minWidth: '400px',
            maxWidth: '500px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#374151' }}>
              Mover Pagos
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#6B7280', fontSize: '14px' }}>
              Selecciona la fecha destino para mover {existingPayments.length} pago(s) de {selectedDate?.toLocaleDateString('es-MX')}:
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                Fecha destino:
              </label>
              <input
                type="date"
                id="movePaymentsTargetDate"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                }}
                onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = '#3B82F6'}
                onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = '#D1D5DB'}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => updateState({ isMovePaymentsModalOpen: false })}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#F9FAFB'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'white'}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const targetDate = (document.getElementById('movePaymentsTargetDate') as HTMLInputElement)?.value;
                  if (!targetDate) {
                    alert('Por favor selecciona una fecha destino');
                    return;
                  }
                  
                  // Aquí iría la lógica para mover los pagos
                  // Por ahora solo mostramos un mensaje
                  alert(`Funcionalidad de mover pagos a ${targetDate} - Por implementar`);
                  updateState({ isMovePaymentsModalOpen: false });
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#15803d'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#16a34a'}
              >
                Mover Pagos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición de cliente */}
      <EditPersonModal
        isOpen={isEditClientModalOpen}
        onClose={handleCloseEditClientModal}
        person={editingClient}
        onSave={handleSaveEditedClient}
        title="Editar Cliente"
      />

      {/* Modal de edición de aval */}
      {avalEditModal.isOpen && avalEditModal.loan && (
        <Box
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <Box
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '12px',
              width: '500px',
              maxWidth: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1a1f36' }}>
                Modificar Información del Aval
              </h2>
              <p style={{ margin: '8px 0 0 0', color: '#697386', fontSize: '14px' }}>
                Modifica los datos del aval para el préstamo de {avalEditModal.loan.borrower?.personalData?.fullName || 'Cliente'}
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <AvalInputWithAutocomplete
                loanId="editing-aval"
                currentName={editingAvalData?.fullName || ''}
                currentPhone={editingAvalData?.phone || ''}
                selectedCollateralId={editingAvalData?.id}
                selectedCollateralPhoneId={editingAvalData?.phoneId}
                onAvalChange={(avalData) => {
                  // Actualizar el estado local con los datos del aval (igual que en CreditosTab)
                  const newState = {
                    ...editingAvalData,
                    fullName: avalData.avalName,
                    phone: avalData.avalPhone,
                    id: avalData.selectedCollateralId,
                    phoneId: avalData.selectedCollateralPhoneId,
                    avalAction: avalData.avalAction
                  };
                  setEditingAvalData(newState);
                }}
                onAvalUpdated={async (updatedPerson) => {
                  // Actualizar el estado local con los datos actualizados (igual que en CreditosTab)
                  console.log('Aval actualizado:', updatedPerson);
                  setEditingAvalData((prev: any) => ({
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button
                tone="negative"
                size="large"
                onClick={closeAvalEditModal}
                style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px' }}
              >
                Cancelar
              </Button>
              <Button
                tone="positive"
                size="large"
                onClick={handleSaveAvalChanges}
                isDisabled={!editingAvalData || updateLoanWithAvalLoading}
                isLoading={updateLoanWithAvalLoading}
                style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px' }}
              >
                {updateLoanWithAvalLoading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </Box>
        </Box>
      )}

      {/* Widget de Reconciliación */}
      {selectedRoute && (
            <ReconciliationWidget
              selectedDate={selectedDate}
              selectedRoute={selectedRoute}
              selectedLead={selectedLead}
              tabType="PAYMENT"
              actualAmount={grandTotalAmount}
              captureElementId="transactions-tab-content"
              onReconcileComplete={() => {
                console.log('✅ Reconciliación completada');
              }}
            />
      )}
    </Box>
  );
};

export default function CustomPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [selectedLead, setSelectedLead] = useState<Employee | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Usar el contexto para obtener la función de refresh
  const { triggerBalanceRefresh } = useBalanceRefresh();

  return (
    <PageContainer header="Abonos">
      <Box padding="large">
        <Box marginBottom="large">
          <RouteLeadSelector
            selectedRoute={selectedRoute}
            selectedLead={selectedLead}
            selectedDate={selectedDate}
            onRouteSelect={setSelectedRoute}
            onLeadSelect={setSelectedLead}
            onDateSelect={setSelectedDate}
          />
        </Box>
        <CreatePaymentForm 
          selectedDate={selectedDate}
          selectedRoute={selectedRoute}
          selectedLead={selectedLead}
          refreshKey={refreshKey}
          onSaveComplete={triggerBalanceRefresh}
        />
      </Box>
    </PageContainer>
  );
}

// Sistema de alturas consistente
const HEIGHT_SYSTEM = {
  small: '32px',    // Botones pequeños, inputs pequeños
  medium: '36px',   // Botones estándar, inputs estándar
  large: '40px',    // Botones grandes, inputs grandes
  xlarge: '44px'    // Botones principales, inputs principales
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
  table: '11px',      // Para textos de tabla
  tableHeader: '12px' // Para headers de tabla
};

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '16px',
    fontSize: FONT_SYSTEM.table,
    '& th, & td': {
      padding: '8px 12px',
      textAlign: 'left' as const,
      borderBottom: '1px solid #e5e7eb',
      fontSize: FONT_SYSTEM.table
    },
    '& th': {
      backgroundColor: '#f9fafb',
      fontWeight: 600,
      fontSize: FONT_SYSTEM.tableHeader
    },
    '& td:nth-child(3), & td:nth-child(4)': {
      width: '100px',
      minWidth: '100px',
      maxWidth: '100px'
    }
  }
};