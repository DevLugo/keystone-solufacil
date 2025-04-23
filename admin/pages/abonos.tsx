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
import { LoanPayment } from '../../schema';
import type { Employee, Option } from '../types/transaction';
import { FaPlus } from 'react-icons/fa';

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
        payments {
          id
          amount
          comission
          type
          paymentMethod
          loan {
            id
            borrower {
              personalData {
                fullName
              }
            }
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
};

type Route = {
  name: string;
  id: string;
};

const paymentTypeOptions: Option[] = [
  { label: 'ABONO', value: 'PAYMENT' },
  { label: 'SIN PAGO', value: 'NO_PAYMENT' },
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
}

export const CreatePaymentForm = ({ selectedDate, selectedRoute, selectedLead }: AbonosProps) => {
  const [state, setState] = useState<{
    payments: LoanPayment[];
    comission: number;
    isModalOpen: boolean;
    loadPaymentDistribution: {
      cashPaidAmount: number;
      bankPaidAmount: number;
      totalPaidAmount: number;
      falcoAmount: number;
    };
    existingPayments: any[];
    editedPayments: { [key: string]: any };
    isEditing: boolean;
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
    loadPaymentDistribution: {
      cashPaidAmount: 0,
      bankPaidAmount: 0,
      totalPaidAmount: 0,
      falcoAmount: 0,
    },
    existingPayments: [],
    editedPayments: {},
    isEditing: false,
  });

  const { 
    payments, comission, isModalOpen, loadPaymentDistribution,
    existingPayments, editedPayments, isEditing, groupedPayments
  } = state;

  const updateState = (updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const { data: paymentsData, loading: paymentsLoading, refetch: refetchPayments } = useQuery(GET_LEAD_PAYMENTS, {
    variables: {
      date: selectedDate ? new Date(selectedDate.setHours(0, 0, 0, 0)).toISOString() : new Date().toISOString(),
      nextDate: selectedDate ? new Date(selectedDate.setHours(23, 59, 59, 999)).toISOString() : new Date().toISOString(),
      leadId: selectedLead?.id || ''
    },
    skip: !selectedDate || !selectedLead,
    onCompleted: (data) => {
      console.log('Payments data received:', data);
      if (data?.loanPayments) {
        updateState({ existingPayments: data.loanPayments });
      }
    }
  });

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
        }
      }
    },
    skip: !selectedLead,
  });

  const [createCustomLeadPaymentReceived, { error: customLeadPaymentError, loading: customLeadPaymentLoading }] = useMutation(CREATE_LEAD_PAYMENT_RECEIVED);
  const [updateLeadPayment, { loading: updateLoading }] = useMutation(UPDATE_LEAD_PAYMENT);
  const [updateLoanPayment, { loading: updateLoanPaymentLoading }] = useMutation(UPDATE_LOAN_PAYMENT);

  const router = useRouter();

  const handleEditExistingPayment = (paymentId: string, field: string, value: any) => {
    const payment = existingPayments.find(p => p.id === paymentId);
    if (!payment) return;

    const updatedPayment = {
      ...payment,
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

  const handleSaveAllChanges = async () => {
    try {
      // Agrupar los pagos por leadPaymentReceived
      const paymentsByLeadPayment = existingPayments.reduce((acc, payment) => {
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
        alert('No hay pagos para actualizar');
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
      alert('Error al preparar los cambios');
    }
  };

  const handleSubmit = async () => {
    try {
      if (!selectedLead?.id || !selectedDate) {
        alert('Por favor seleccione un líder y una fecha');
        return;
      }

      // Verificar que la suma de la distribución coincida con el total pagado
      const { cashPaidAmount, bankPaidAmount } = loadPaymentDistribution;
      const totalPaid = cashPaidAmount + bankPaidAmount;
      
      // Calcular el total esperado según la pestaña seleccionada
      const expectedAmount = activeTab === 'new' 
        ? payments.reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0)
        : state.groupedPayments 
          ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0
          : 0;

      if (Math.abs(totalPaid - expectedAmount) > 0.01) {
        alert('La distribución no coincide con el total pagado');
        return;
      }

      // Si hay pagos nuevos, crear un nuevo LeadPaymentReceived
      if (activeTab === 'new' && payments.length > 0) {
        await createCustomLeadPaymentReceived({
          variables: {
            expectedAmount,
            cashPaidAmount,
            bankPaidAmount,
            agentId: selectedLead.id,
            leadId: selectedLead.id,
            paymentDate: selectedDate.toISOString(),
            payments: payments.map(payment => ({
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
      if (activeTab === 'existing' && state.groupedPayments) {
        for (const [leadPaymentId, data] of Object.entries(state.groupedPayments)) {
          const { payments, paymentDate } = data;
          const { cashPaidAmount, bankPaidAmount, falcoAmount } = loadPaymentDistribution;

          await updateLeadPayment({
            variables: {
              id: leadPaymentId,
              expectedAmount: data.expectedAmount,
              cashPaidAmount,
              bankPaidAmount,
              falcoAmount,
              paymentDate,
              payments
            }
          });
        }
      }

      // Refrescar los datos
      await refetchPayments();
      
      // Limpiar el estado
      setState(prev => ({ 
        ...prev,
        payments: [],
        editedPayments: {},
        isEditing: false,
        isModalOpen: false,
        groupedPayments: undefined
      }));

      alert('Cambios guardados exitosamente');
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Error al guardar los cambios');
    }
  };

  useEffect(() => {
    // Si no hay pagos existentes y tenemos datos de préstamos, cargar los pagos semanales
    if (loansData?.loans && existingPayments.length === 0) {
      const newPayments = loansData.loans.map(loan => ({
        amount: loan.weeklyPaymentAmount,
        comission: comission,
        loanId: loan.id,
        type: 'PAYMENT',
        paymentMethod: 'CASH',
        isNew: true, // Marcar como nuevo pago
        loan: {
          id: loan.id,
          borrower: loan.borrower
        }
      }));
      updateState({ payments: newPayments });
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
        }
      ]
    });
  };

  const handlePaymentTypeChange = (index: number, option: Option) => {
    const newPayments = [...payments];
    newPayments[index].type = option.value;
    if (option.value === 'NO_PAYMENT') {
      newPayments[index].amount = '0';
    }
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
    } else if (field === 'comission') {
      (newPayments[index][field] as unknown as string) = value;
    } else {
      (newPayments[index][field] as any) = value;
    }
    updateState({ payments: newPayments });
  };

  const totalAmount = useMemo(() => {
    return payments.reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);
  }, [payments]);

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
    return payments.reduce((sum, payment) => sum + parseFloat(payment.comission.toString() || '0'), 0);
  }, [payments]);

  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');

  if (loansLoading) return <LoadingDots label="Loading loans" size="large" />;
  if (loansError) return <GraphQLErrorNotice errors={loansError?.graphQLErrors || []} networkError={loansError?.networkError} />;

  return (
    <Box paddingTop="xlarge">
      {(customLeadPaymentError) && (
        <GraphQLErrorNotice
          networkError={customLeadPaymentError?.networkError}
          errors={customLeadPaymentError?.graphQLErrors}
        />
      )}

      <div style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        marginBottom: '16px',
        background: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}>
        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          background: '#E2E8F0',
          borderRadius: '8px',
          overflow: 'hidden',
          flex: 1,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: '#0052CC',
              opacity: 0.1,
            }} />
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '4px',
            }}>
              TOTAL DE PAGOS
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: '1',
              marginBottom: '2px',
            }}>
              {existingPayments.length + payments.length}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>Registrados</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: '#0052CC',
              opacity: 0.1,
            }} />
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '4px',
            }}>
              PAGOS NUEVOS
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: '1',
              marginBottom: '2px',
            }}>
              {payments.length}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>Por guardar</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: '#0052CC',
              opacity: 0.1,
            }} />
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '4px',
            }}>
              TOTAL PAGADO
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: '1',
              marginBottom: '2px',
            }}>
              ${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>En {existingPayments.length + payments.length} pagos</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'white',
            padding: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: '#0052CC',
              opacity: 0.1,
            }} />
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#6B7280',
              marginBottom: '4px',
            }}>
              COMISIÓN TOTAL
            </div>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              letterSpacing: '-0.02em',
              lineHeight: '1',
              marginBottom: '2px',
            }}>
              ${totalComission.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>Por guardar</span>
            </div>
          </div>
        </div>

        {/* Add Payment Button */}
        <Button
          tone="active"
          size="medium"
          weight="bold"
          onClick={handleAddPayment}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            borderRadius: '6px',
            backgroundColor: '#0052CC',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '36px',
            whiteSpace: 'nowrap',
            alignSelf: 'center',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
        >
          <FaPlus size={12} style={{ marginTop: '-1px' }} />
          <span>Nuevo Pago</span>
        </Button>
      </div>

      <Box marginBottom="large">
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px 6px 0 0',
          padding: '4px 8px'
        }}>
          <div
            onClick={() => setActiveTab('existing')}
            style={{ 
              padding: '8px 16px',
              marginRight: '8px',
              cursor: 'pointer',
              borderBottom: activeTab === 'existing' ? '2px solid #0052CC' : 'none',
              color: activeTab === 'existing' ? '#0052CC' : '#6B7280',
              fontWeight: activeTab === 'existing' ? '600' : '500',
              backgroundColor: activeTab === 'existing' ? 'white' : 'transparent',
              borderRadius: '4px 4px 0 0',
              boxShadow: activeTab === 'existing' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none'
            }}
          >
            Pagos Registrados
          </div>
          <div
            onClick={() => setActiveTab('new')}
            style={{ 
              padding: '8px 16px',
              cursor: 'pointer',
              borderBottom: activeTab === 'new' ? '2px solid #0052CC' : 'none',
              color: activeTab === 'new' ? '#0052CC' : '#6B7280',
              fontWeight: activeTab === 'new' ? '600' : '500',
              backgroundColor: activeTab === 'new' ? 'white' : 'transparent',
              borderRadius: '4px 4px 0 0',
              boxShadow: activeTab === 'new' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none'
            }}
          >
            Nuevos Pagos
          </div>
        </div>

        {activeTab === 'existing' && (
          <Box
            style={{
              backgroundColor: 'white',
              borderRadius: '0 8px 8px 8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'visible',
            }}
          >
            <Box padding="large">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Pagos Registrados</h3>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      tone="negative"
                      weight="bold"
                      onClick={() => setState(prev => ({ ...prev, editedPayments: {}, isEditing: false }))}
                    >
                      Cancelar
                    </Button>
                    <Button
                      tone="positive"
                      weight="bold"
                      onClick={handleSaveAllChanges}
                      isLoading={updateLoading}
                    >
                      Guardar Cambios
                    </Button>
                  </div>
                ) : (
                  <Button
                    tone="active"
                    weight="bold"
                    onClick={() => setState(prev => ({ ...prev, isEditing: true }))}
                  >
                    Editar Pagos
                  </Button>
                )}
              </div>

              <table css={styles.table}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Monto</th>
                    <th>Comisión</th>
                    <th>Tipo</th>
                    <th>Forma de Pago</th>
                    {isEditing && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {existingPayments.map((payment) => {
                    const editedPayment = editedPayments[payment.id] || payment;
                    return (
                      <tr key={payment.id}>
                        <td>{payment.loan?.borrower?.personalData?.fullName}</td>
                        <td>
                          {isEditing ? (
                            <TextInput
                              type="number"
                              value={editedPayment.amount}
                              onChange={e => handleEditExistingPayment(payment.id, 'amount', e.target.value)}
                            />
                          ) : (
                            payment.amount
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <TextInput
                              type="number"
                              value={editedPayment.comission}
                              onChange={e => handleEditExistingPayment(payment.id, 'comission', e.target.value)}
                            />
                          ) : (
                            payment.comission
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <Select
                              options={paymentTypeOptions}
                              value={paymentTypeOptions.find(option => option.value === editedPayment.type) || null}
                              onChange={(option) => handleEditExistingPayment(payment.id, 'type', (option as Option).value)}
                            />
                          ) : (
                            paymentTypeOptions.find(opt => opt.value === payment.type)?.label
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <Select
                              options={paymentMethods}
                              value={paymentMethods.find(option => option.value === editedPayment.paymentMethod) || null}
                              onChange={(option) => handleEditExistingPayment(payment.id, 'paymentMethod', (option as Option).value)}
                            />
                          ) : (
                            paymentMethods.find(opt => opt.value === payment.paymentMethod)?.label
                          )}
                        </td>
                        {isEditing && (
                          <td>
                            <Button
                              tone="negative"
                              size="small"
                              onClick={() => {
                                // Filtrar para quitar el pago de la lista principal
                                const updatedExistingPayments = existingPayments.filter(p => p.id !== payment.id);
                                
                                // Quitarlo también del mapa de ediciones si está ahí
                                const newEditedPayments = { ...editedPayments };
                                delete newEditedPayments[payment.id];
                                
                                // Actualizar el estado
                                setState(prev => ({
                                  ...prev,
                                  existingPayments: updatedExistingPayments,
                                  editedPayments: newEditedPayments
                                }));
                              }}
                            >
                              <TrashIcon size="small" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          </Box>
        )}

        {activeTab === 'new' && (
          <Box
            style={{
              backgroundColor: 'white',
              borderRadius: '0 8px 8px 8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'visible',
            }}
          >
            <Box padding="large">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Nuevos Pagos</h3>
                <Button
                  tone="active"
                  size="medium"
                  weight="bold"
                  onClick={handleAddPayment}
                >
                  <FaPlus size={12} style={{ marginRight: '8px' }} />
                  Agregar Pago
                </Button>
              </div>

              <table css={styles.table}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Monto</th>
                    <th>Comisión</th>
                    <th>Tipo</th>
                    <th>Forma de Pago</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr key={`new-${index}`}>
                      <td>
                        <Select
                          options={loansData?.loans.map(loan => ({
                            value: loan.id,
                            label: loan.borrower.personalData.fullName
                          })) || []}
                          value={loansData?.loans.find(loan => loan.id === payment.loanId) ? {
                            value: payment.loanId,
                            label: loansData.loans.find(loan => loan.id === payment.loanId)?.borrower.personalData.fullName || ''
                          } : null}
                          onChange={(option) => handleChange(index, 'loanId', (option as Option).value)}
                        />
                      </td>
                      <td>
                        <TextInput
                          type="number"
                          value={payment.amount}
                          onChange={(e) => handleChange(index, 'amount', e.target.value)}
                        />
                      </td>
                      <td>
                        <TextInput
                          type="number"
                          value={payment.comission}
                          onChange={(e) => handleChange(index, 'comission', e.target.value)}
                        />
                      </td>
                      <td>
                        <Select
                          options={paymentTypeOptions}
                          value={paymentTypeOptions.find(option => option.value === payment.type) || null}
                          onChange={(option) => handleChange(index, 'type', (option as Option).value)}
                        />
                      </td>
                      <td>
                        <Select
                          options={paymentMethods}
                          value={paymentMethods.find(option => option.value === payment.paymentMethod) || null}
                          onChange={(option) => handleChange(index, 'paymentMethod', (option as Option).value)}
                        />
                      </td>
                      <td>
                        <Button
                          tone="negative"
                          size="small"
                          onClick={() => handleRemovePayment(index)}
                        >
                          <TrashIcon size="small" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Box>
        )}
      </Box>

      <Box marginBottom="large" style={{ display: 'flex', alignItems: 'center' }}>
        <Box style={{ flex: 1 }} marginRight="medium">
          <label>Comisión</label>
          <TextInput 
            value={comission}
            type='number'
            onChange={(e) => updateState({ comission: parseInt(e.target.value) })}
          />
        </Box>
      </Box>

      <Box marginTop="large">
        <Button 
          isLoading={customLeadPaymentLoading}
          weight="bold"
          tone="active"
          onClick={() => updateState({ isModalOpen: true })}
          style={{ marginLeft: '10px' }}
          isDisabled={!payments.length}
        >
          Registrar pagos
        </Button>
      </Box>

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
            <h4>Total pagado: ${(activeTab === 'new' ? totalAmount : state.groupedPayments ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0 : 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
          </Box>
          <Box marginBottom="large">
            <label>Efectivo</label>
            <TextInput
              type="number"
              value={loadPaymentDistribution.cashPaidAmount}
              onChange={(e) => updateState({
                loadPaymentDistribution: {
                  ...loadPaymentDistribution,
                  cashPaidAmount: parseFloat(e.target.value),
                  totalPaidAmount: parseFloat(e.target.value) + loadPaymentDistribution.bankPaidAmount,
                }
              })}
            />
          </Box>
          <Box marginBottom="large">
            <label>Transferencia</label>
            <TextInput
              type="number"
              value={loadPaymentDistribution.bankPaidAmount}
              onChange={(e) => updateState({
                loadPaymentDistribution: {
                  ...loadPaymentDistribution,
                  bankPaidAmount: parseFloat(e.target.value),
                  totalPaidAmount: parseFloat(e.target.value) + loadPaymentDistribution.cashPaidAmount,
                }
              })}
            />
          </Box>
          <Box marginBottom="large">
            <label>Total distribuido</label>
            <TextInput
              type="number"
              value={loadPaymentDistribution.totalPaidAmount}
              readOnly
            />
          </Box>
        </Box>
      </AlertDialog>
    </Box>
  );
};

export default function CustomPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedLead, setSelectedLead] = useState<Employee | null>(null);

  return (
    <PageContainer header="Abonos">
      <Box padding="large">
        <Box marginBottom="large">
          <label>Fecha</label>
          <DatePicker
            value={selectedDate.toISOString()}
            onUpdate={(date: string) => setSelectedDate(new Date(date))}
            onClear={() => setSelectedDate(new Date())}
          />
        </Box>
        <Box marginBottom="large">
          <label>Ruta</label>
          <RouteSelector
            value={selectedRoute ? { value: selectedRoute.id, label: selectedRoute.name } : null}
            onRouteSelect={(route) => setSelectedRoute(route ? { id: route.value, name: route.label } : null)}
          />
        </Box>
        <Box marginBottom="large">
          <label>Líder</label>
          <LeadSelector
            routeId={selectedRoute?.id}
            value={selectedLead ? { value: selectedLead.id, label: selectedLead.personalData.fullName } : null}
            onLeadSelect={(lead) => setSelectedLead(lead ? { 
              id: lead.value, 
              personalData: { fullName: lead.label },
              type: 'LEAD',
              routes: { 
                accounts: [{
                  id: '',
                  name: 'Lead Account',
                  type: 'EMPLOYEE_CASH_FUND',
                  amount: 0
                }]
              }
            } : null)}
          />
        </Box>
        <CreatePaymentForm 
          selectedDate={selectedDate}
          selectedRoute={selectedRoute}
          selectedLead={selectedLead}
        />
      </Box>
    </PageContainer>
  );
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '16px',
    '& th, & td': {
      padding: '12px',
      textAlign: 'left' as const,
      borderBottom: '1px solid #e5e7eb'
    },
    '& th': {
      backgroundColor: '#f9fafb',
      fontWeight: 600
    },
    '& td:nth-child(3), & td:nth-child(4)': {
      width: '100px',
      minWidth: '100px',
      maxWidth: '100px'
    }
  }
};