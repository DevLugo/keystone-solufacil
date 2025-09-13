/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo } from 'react';
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
import { FaPlus, FaEllipsisV, FaInfoCircle, FaCalendarAlt } from 'react-icons/fa';

// Import components
import RouteLeadSelector from '../routes/RouteLeadSelector';
import KPIBar from './KPIBar';
import { useBalanceRefresh } from '../../contexts/BalanceRefreshContext';

const GET_LEADS = gql`
  query GetLeads($routeId: ID!) {
    employees(where: { routes: { id: { equals: $routeId } } }) {
      id
      type
      personalData {
        fullName
      }
    }
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
    loans(where: $where) {
      id
      weeklyPaymentAmount
      signDate
      loantype {
        id
        name
        loanPaymentComission
      }
      borrower {
        personalData{
          fullName
        }
      }
    }
  }
`;

const GET_LEAD_PAYMENTS = gql`
  query GetLeadPayments($date: DateTime!, $nextDate: DateTime!, $leadId: ID!) {
    loanPayments(where: { 
      AND: [
        { receivedAt: { gte: $date, lt: $nextDate } },
        { leadPaymentReceived: { lead: { id: { equals: $leadId } } } }
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
      leadPaymentReceived {
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
        lead {
          id
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
    skip: !routeId,
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
    falcoPaymentAmount: number;
    selectedFalcoId: string | null;
    createFalcoAmount: number;
    loadPaymentDistribution: {
      cashPaidAmount: number;
      bankPaidAmount: number;
      totalPaidAmount: number;
      falcoAmount: number;
    };
    existingPayments: any[];
    editedPayments: { [key: string]: any };
    isEditing: boolean;
    showSuccessMessage: boolean;
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
    falcoPaymentAmount: 0,
    selectedFalcoId: null,
    createFalcoAmount: 0,
    loadPaymentDistribution: {
      cashPaidAmount: 0,
      bankPaidAmount: 0,
      totalPaidAmount: 0,
      falcoAmount: 0,
    },
    existingPayments: [],
    editedPayments: {},
    isEditing: false,
    showSuccessMessage: false,
  });

  // ✅ AGREGAR: Estado para comisión masiva
  const [massCommission, setMassCommission] = useState<string>('0');

  const { 
    payments, comission, isModalOpen, isFalcoModalOpen, isCreateFalcoModalOpen, falcoPaymentAmount, 
    selectedFalcoId, createFalcoAmount, loadPaymentDistribution, existingPayments, editedPayments, 
    isEditing, showSuccessMessage, groupedPayments
  } = state;

  // Estado separado para trackear pagos tachados (eliminados visualmente)
  const [strikethroughPaymentIds, setStrikethroughPaymentIds] = useState<string[]>([]);
  // Estado para trackear pagos nuevos tachados (por índice)
  const [strikethroughNewPaymentIndices, setStrikethroughNewPaymentIndices] = useState<number[]>([]);

  // Estado para recordar valores previos por pago (para restaurar tras deshacer deceso)
  const [previousValuesByPaymentId, setPreviousValuesByPaymentId] = useState<Record<string, { amount: number; comission: number }>>({});

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
    
    console.log('🚀 CONSULTA COMPLETADA');
    console.log('📅 Fecha seleccionada:', selectedDate);
    console.log('👤 Lead seleccionado:', selectedLead?.id);
    console.log('🔍 Pagos regulares encontrados:', regularPayments.length);
    console.log('🔍 Pagos migrados encontrados:', migratedPayments.length);
    
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
      
      // ✅ AGREGAR: Ordenar abonos por fecha de creación del crédito (más viejo primero)
      const sortedPayments = paymentsWithDefaultCommissions.sort((a: any, b: any) => {
        const dateA = new Date(a.loan?.signDate || '1970-01-01');
        const dateB = new Date(b.loan?.signDate || '1970-01-01');
        return dateA.getTime() - dateB.getTime(); // Ascendente: crédito más viejo arriba
      });
      
      updateState({ existingPayments: sortedPayments });
    }
  }, [paymentsData, migratedPaymentsData, selectedDate, selectedLead?.id]);

  const { data: loansData, loading: loansLoading, error: loansError } = useQuery<{ loans: Loan[] }>(GET_LOANS_BY_LEAD, {
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

  // Estado para controlar loading general de guardado
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para tooltip de comisiones
  const [showCommissionTooltip, setShowCommissionTooltip] = useState(false);

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

    let updatedPayment: any = {
      ...payment,
      [field]: value
    };

    // Si se actualiza el monto, recalcular la comisión dinámicamente
    if (field === 'amount') {
      const amountNum = parseFloat(String(value) || '0');
      const loanId = (payment as any).loan?.id || (payment as any).loanId;
      updatedPayment.comission = computeDynamicCommission(loanId, amountNum);
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

  const handleSaveAllChanges = async () => {
    try {
      // Agrupar los pagos por leadPaymentReceived (excluyendo los tachados y migrados)
      const paymentsByLeadPayment = existingPayments
        .filter((payment: any) => !strikethroughPaymentIds.includes(payment.id) && !payment.isMigrated)
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
        if (!leadPaymentId) return acc;

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
            falcoAmount: 0,
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

      // Abrir el modal de distribución con los valores actuales
      updateState({ 
        isModalOpen: true,
        loadPaymentDistribution: {
          totalPaidAmount: firstPaymentGroup.expectedAmount,
          cashPaidAmount: firstPaymentGroup.cashPaidAmount,
          bankPaidAmount: firstPaymentGroup.bankPaidAmount,
          falcoAmount: firstPaymentGroup.expectedAmount - (firstPaymentGroup.cashPaidAmount + firstPaymentGroup.bankPaidAmount)
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
      if (!selectedLead?.id || !selectedDate) {
        // Validación fallida - no mostrar alert
        return;
      }

      // Activar estado de loading
      setIsSaving(true);

      // Verificar que la suma de la distribución coincida con el total pagado
      const { cashPaidAmount, bankPaidAmount } = loadPaymentDistribution;
      const totalPaid = cashPaidAmount + bankPaidAmount;
      
      // Calcular el total esperado
      const filteredNewPayments = payments
        .filter((p, index) => !strikethroughNewPaymentIndices.includes(index))
        .filter(p => (parseFloat(p.amount || '0') !== 0 || parseFloat(p.comission?.toString() || '0') !== 0));

      const expectedAmount = filteredNewPayments.length > 0
        ? filteredNewPayments
            .reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0)
        : state.groupedPayments 
          ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0
          : 0;

      if (Math.abs(totalPaid - expectedAmount) > 0.01) {
        // La distribución no coincide - no mostrar alert
        return;
      }

      // Si hay pagos nuevos, crear un nuevo LeadPaymentReceived
      if (filteredNewPayments.length > 0) {
        await createCustomLeadPaymentReceived({
          variables: {
            expectedAmount,
            cashPaidAmount,
            bankPaidAmount,
            agentId: selectedLead.id,
            leadId: selectedLead.id,
            paymentDate: selectedDate.toISOString(),
            payments: filteredNewPayments
              .map(payment => ({
                amount: parseFloat(payment.amount),
                comission: parseFloat(payment.comission.toString()),
                loanId: payment.loanId,
                type: payment.type,
                paymentMethod: payment.paymentMethod
              }))
          }
        });
      }

      // Si hay pagos existentes editados, actualizarlos
      if (state.groupedPayments) {
        for (const [leadPaymentId, data] of Object.entries(state.groupedPayments)) {
          const { payments, paymentDate } = data;
          const { cashPaidAmount, bankPaidAmount, falcoAmount } = loadPaymentDistribution;
          // Limpiar pagos 0/0 antes de enviar actualización
          const cleanedPayments = (payments as any[]).filter((p: any) => {
            const amt = parseFloat(p.amount || '0');
            const com = parseFloat(p.comission?.toString() || '0');
            return !(amt === 0 && com === 0);
          });
          const cleanedExpected = cleanedPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);

          await updateCustomLeadPaymentReceived({
            variables: {
              id: leadPaymentId,
              expectedAmount: cleanedExpected,
              cashPaidAmount,
              bankPaidAmount,
              falcoAmount,
              paymentDate,
              payments: cleanedPayments
            }
          });
        }
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
    // Si no hay pagos existentes y tenemos datos de préstamos, cargar los pagos semanales
    if (loansData?.loans && existingPayments.length === 0) {
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
      
      console.log('Pagos semanales creados con comisiones por defecto del loanType:', sortedNewPayments);
      sortedNewPayments.forEach((payment, index) => {
        console.log(`Pago ${index + 1}: ${payment.loan?.borrower?.personalData?.fullName} - Comisión: ${payment.comission} (del loanType: ${payment.loan?.loantype?.name}) - Fecha Crédito: ${payment.loan?.signDate ? new Date(payment.loan.signDate).toLocaleDateString('es-MX') : 'N/A'}`);
      });
      
      updateState({ payments: sortedNewPayments });
    } else if (existingPayments.length > 0) {
      // Si hay pagos existentes, limpiar los pagos nuevos
      updateState({ payments: [] });
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
    } else {
      (newPayments[index][field] as any) = value;
      // Reglas de comisión dinámica según monto vs pago esperado
      if (field === 'amount') {
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
    updateState({ payments: newPayments });
  };

  const totalAmount = useMemo(() => {
    return payments
      .filter((_, index) => !strikethroughNewPaymentIndices.includes(index))
      .reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);
  }, [payments, strikethroughNewPaymentIndices]);

  useEffect(() => {
    updateState({
      loadPaymentDistribution: {
        totalPaidAmount: totalAmount,
        bankPaidAmount: 0,
        cashPaidAmount: totalAmount,
        falcoAmount: 0,
      }
    });
  }, [totalAmount]);

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
            borderColor: '#D1FAE5'
          }
        ]}
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
          onMove: () => updateState({ isModalOpen: true }),
          saving: updateLoading,
          disabled: false
        }}
        massCommission={payments.length > 0 ? {
          value: massCommission,
          onChange: setMassCommission,
          onApply: () => {
            const commission = parseFloat(massCommission);
            if (isNaN(commission)) return;
            
            const newPayments = payments.map(payment => ({
              ...payment,
              comission: commission
            }));
            setState(prev => ({ ...prev, payments: newPayments }));
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
                    color: '#92400E',
                    backgroundColor: '#F59E0B',
                    color: 'white',
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
              {/* Abonos Registrados */}
              {existingPayments
                .map((payment, index) => {
                const editedPayment = editedPayments[payment.id] || payment;
                const isStrikethrough = strikethroughPaymentIds.includes(payment.id);
                const hasZeroCommission = parseFloat(editedPayment.comission || '0') === 0;
                console.log(`Pago ${payment.id}: isStrikethrough=${isStrikethrough}, hasZeroCommission=${hasZeroCommission}, strikethroughPaymentIds=`, strikethroughPaymentIds);
                
                return (
                  <tr key={`existing-${payment.id}`} style={{ 
                    backgroundColor: isStrikethrough ? '#fee2e2' : (hasZeroCommission ? '#FEF3C7' : '#f8fafc'),
                    opacity: isStrikethrough ? 0.7 : 1,
                    borderLeft: isStrikethrough ? '4px solid #ef4444' : (hasZeroCommission ? '4px solid #D97706' : 'none')
                  }}>
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
                      fontWeight: isStrikethrough ? '500' : 'inherit'
                    }}>
                      {payment.loan?.borrower?.personalData?.fullName}
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
                          type="number" step="1" step="1"
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
                            type="number" step="1" step="1" step="1"
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
                        <Select
                          options={paymentMethods}
                          value={paymentMethods.find(option => option.value === editedPayment.paymentMethod) || null}
                          onChange={(option) => handleEditExistingPayment(payment.id, 'paymentMethod', (option as Option).value)}
                          isDisabled={isStrikethrough}
                          size="small"
                          style={{ height: HEIGHT_SYSTEM.small, fontSize: FONT_SYSTEM.small }}
                            
                        />
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
                                console.log('Marcando como tachado:', payment.id);
                                setStrikethroughPaymentIds(prev => {
                                  const newIds = [...prev, payment.id];
                                  console.log('Nuevos IDs tachados:', newIds);
                                  return newIds;
                                });
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
                    </td>
                  </tr>
                );
              })}

              {/* Abonos Nuevos */}
              {payments.map((payment, index) => {
                const isStrikethrough = strikethroughNewPaymentIndices.includes(index);
                const hasZeroCommission = parseFloat(payment.comission?.toString() || '0') === 0;
                const isDeceased = deceasedLoanIds.has(payment.loanId || '');
                return (
                <tr key={`new-${index}`} style={{ 
                  backgroundColor: isDeceased ? '#f3f4f6' : (isStrikethrough ? '#fee2e2' : (hasZeroCommission ? '#FEF3C7' : '#ECFDF5')),
                  opacity: isDeceased ? 0.6 : (isStrikethrough ? 0.7 : 1),
                  borderLeft: isDeceased ? '4px solid #6b7280' : (isStrikethrough ? '4px solid #ef4444' : (hasZeroCommission ? '4px solid #D97706' : 'none'))
                }}>
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
                    fontWeight: isStrikethrough ? '500' : 'inherit'
                  }}>
                    {payment.isUserAdded ? (
                      // Pagos agregados por usuario: siempre mostrar dropdown
                      <Select
                        options={loansData?.loans
                          ?.filter(loan => loan.borrower && loan.borrower.personalData)
                          ?.map(loan => ({
                            value: loan.id,
                            label: loan.borrower?.personalData?.fullName || 'Sin nombre'
                          })) || []}
                        value={loansData?.loans.find(loan => loan.id === payment.loanId) ? {
                          value: payment.loanId,
                          label: loansData.loans.find(loan => loan.id === payment.loanId)?.borrower?.personalData?.fullName || 'Sin nombre'
                        } : null}
                        onChange={(option) => handleChange(index, 'loanId', (option as Option).value)}
                        isDisabled={isStrikethrough || isDeceased}
                        size="small"
                      />
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
                    <TextInput
                      type="number" step="1"
                      value={Math.round(parseFloat(payment.amount || '0'))}
                      onChange={(e) => handleChange(index, 'amount', e.target.value)}
                      disabled={isStrikethrough || isDeceased}
                      style={{ height: HEIGHT_SYSTEM.small, fontSize: FONT_SYSTEM.small }}
                    />
                  </td>
                  <td style={{
                    textDecoration: isStrikethrough ? 'line-through' : 'none',
                    color: isStrikethrough ? '#dc2626' : 'inherit',
                    fontWeight: isStrikethrough ? '500' : 'inherit'
                  }}>
                    <TextInput
                      type="number" step="1"
                      value={Math.round(parseFloat(payment.comission?.toString() || '0'))}
                      onChange={(e) => handleChange(index, 'comission', e.target.value)}
                      disabled={isStrikethrough || isDeceased}
                      style={{ height: HEIGHT_SYSTEM.small, fontSize: FONT_SYSTEM.small }}
                    />
                  </td>
                  <td style={{
                    textDecoration: isStrikethrough ? 'line-through' : 'none',
                    color: isStrikethrough ? '#dc2626' : 'inherit',
                    fontWeight: isStrikethrough ? '500' : 'inherit'
                  }}>
                    <Select
                      options={paymentMethods}
                      value={paymentMethods.find(option => option.value === payment.paymentMethod) || null}
                      onChange={(option) => handleChange(index, 'paymentMethod', (option as Option).value)}
                      isDisabled={isStrikethrough || isDeceased}
                      size="small"
                    />
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const selectedLoan = loansData?.loans?.find(loan => loan.id === (payment.loanId || payment.loan?.id));
                                  setDeceasedModal({
                                    isOpen: true,
                                    loanId: (payment.loanId || payment.loan?.id || ''),
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
                            ) : (
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
            loading: customLeadPaymentLoading 
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
            loading: customLeadPaymentLoading 
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
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
            <Box marginBottom="large">
              <label>Efectivo:</label>
              <div style={{ 
                padding: '0.75rem', 
                backgroundColor: '#f5f5f5', 
                border: '1px solid #ddd',
                borderRadius: '4px',
                color: '#333',
                fontWeight: '500',
                marginTop: '0.5rem'
              }}>
                ${(loadPaymentDistribution.totalPaidAmount - loadPaymentDistribution.bankPaidAmount).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </Box>
            
            <Box marginBottom="large">
              <label>Transferencia:</label>
              <TextInput
                type="number"
                min="0"
                max={payments.length > 0 ? totalAmount : state.groupedPayments ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0 : 0}
                value={loadPaymentDistribution.bankPaidAmount}
                onChange={(e) => {
                  const transferAmount = Math.max(0, Math.min(parseFloat(e.target.value) || 0, payments.length > 0 ? totalAmount : state.groupedPayments ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0 : 0));
                  const totalAmountValue = payments.length > 0 ? totalAmount : state.groupedPayments ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0 : 0;
                  const cashAmount = totalAmountValue - transferAmount;
                  
                  updateState({
                    loadPaymentDistribution: {
                      ...loadPaymentDistribution,
                      bankPaidAmount: transferAmount,
                      cashPaidAmount: cashAmount,
                      totalPaidAmount: totalAmountValue,
                    }
                  });
                }}
                style={{ 
                  border: loadPaymentDistribution.bankPaidAmount > (payments.length > 0 ? totalAmount : state.groupedPayments ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0 : 0) ? '2px solid #e74c3c' : '1px solid #ccc',
                  marginTop: '0.5rem'
                }}
              />
            </Box>
          </div>
          
          {loadPaymentDistribution.bankPaidAmount > (payments.length > 0 ? totalAmount : state.groupedPayments ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0 : 0) && (
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
              El monto de transferencia no puede ser mayor al total de cobranza
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