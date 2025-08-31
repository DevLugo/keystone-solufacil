/** @jsxRuntime automatic */

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
import { FaPlus } from 'react-icons/fa';

// Import components
import DateMover from './utils/DateMover';

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
};

type Route = {
  name: string;
  id: string;
};

const paymentTypeOptions: Option[] = [
  { label: 'ABONO', value: 'PAYMENT' },
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

export const CreatePaymentForm = ({ 
  selectedDate, 
  selectedRoute, 
  selectedLead,
  refreshKey 
}: { 
  selectedDate: Date, 
  selectedRoute: Route | null, 
  selectedLead: Employee | null,
  refreshKey: number 
}) => {
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

  // ✅ AGREGAR: Estado para comisión masiva
  const [massCommission, setMassCommission] = useState<string>('0');

  const { 
    payments, comission, isModalOpen, loadPaymentDistribution,
    existingPayments, editedPayments, isEditing, groupedPayments
  } = state;

  // Estado separado para trackear pagos eliminados visualmente
  const [deletedPaymentIds, setDeletedPaymentIds] = useState<string[]>([]);

  const updateState = (updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const { data: paymentsData, loading: paymentsLoading, refetch: refetchPayments } = useQuery(GET_LEAD_PAYMENTS, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : new Date().toISOString(),
      nextDate: selectedDate ? new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString() : new Date().toISOString(),
      leadId: selectedLead?.id || ''
    },
    skip: !selectedDate || !selectedLead,
        onCompleted: (data) => {
      console.log('🚀 CONSULTA GET_LEAD_PAYMENTS COMPLETADA');
      console.log('📅 Fecha seleccionada:', selectedDate);
      console.log('👤 Lead seleccionado:', selectedLead?.id);
      console.log('🔍 DATOS RECIBIDOS de GET_LEAD_PAYMENTS:', data);
      console.log('🔍 loanPayments encontrados:', data?.loanPayments?.length || 0);
        
        if (data?.loanPayments) {
          // ✅ AGREGAR: Cargar comisiones por defecto automáticamente
          const paymentsWithDefaultCommissions = data.loanPayments.map((payment: any) => {
            const defaultCommission = payment.loan?.loantype?.loanPaymentComission;
            if (defaultCommission && parseFloat(defaultCommission) > 0) {
              return {
                ...payment,
                comission: parseFloat(defaultCommission)
              };
            }
            return payment;
          });
          
          // ✅ AGREGAR: Ordenar abonos por fecha de creación del crédito (más viejo primero)
          const sortedPayments = paymentsWithDefaultCommissions.sort((a: any, b: any) => {
            const dateA = new Date(a.loan?.signDate || '1970-01-01');
            const dateB = new Date(b.loan?.signDate || '1970-01-01');
            return dateA.getTime() - dateB.getTime(); // Ascendente: crédito más viejo arriba
          });
          
          updateState({ existingPayments: sortedPayments });
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
      // Agrupar los pagos por leadPaymentReceived (excluyendo los eliminados)
      const paymentsByLeadPayment = existingPayments
        .filter((payment: any) => !deletedPaymentIds.includes(payment.id))
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
      
      // Calcular el total esperado
      const expectedAmount = payments.length > 0
        ? payments.reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0)
        : state.groupedPayments 
          ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0
          : 0;

      if (Math.abs(totalPaid - expectedAmount) > 0.01) {
        alert('La distribución no coincide con el total pagado');
        return;
      }

      // Si hay pagos nuevos, crear un nuevo LeadPaymentReceived
      if (payments.length > 0) {
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
      if (state.groupedPayments) {
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

      // ✅ CORREGIDO: Refrescar todos los datos para obtener el balance real de la DB
      await Promise.all([
        refetchPayments(),
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
        // ✅ MODIFICAR: Usar comisión por defecto del loanType si existe
        comission: loan.loantype?.loanPaymentComission ? parseFloat(loan.loantype.loanPaymentComission) : comission,
        loanId: loan.id,
        type: 'PAYMENT',
        paymentMethod: 'CASH',
        isNew: true, // Marcar como nuevo pago
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
          const defaultCommission = parseFloat(selectedLoan.loantype.loanPaymentComission);
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

  // Calcular totales de pagos existentes (considerando ediciones y eliminaciones)
  const totalExistingAmount = useMemo(() => {
    return existingPayments
      .filter((payment: any) => !deletedPaymentIds.includes(payment.id))
      .reduce((sum: number, payment: any) => {
        const editedPayment = editedPayments[payment.id] || payment;
        return sum + parseFloat(editedPayment.amount || '0');
      }, 0);
  }, [existingPayments, editedPayments, deletedPaymentIds]);

  const totalExistingComission = useMemo(() => {
    return existingPayments
      .filter((payment: any) => !deletedPaymentIds.includes(payment.id))
      .reduce((sum: number, payment: any) => {
        const editedPayment = editedPayments[payment.id] || payment;
        return sum + parseFloat(editedPayment.comission || '0');
      }, 0);
  }, [existingPayments, editedPayments, deletedPaymentIds]);

  // Total general (nuevos + existentes)
  const grandTotalAmount = useMemo(() => {
    return totalAmount + totalExistingAmount;
  }, [totalAmount, totalExistingAmount]);

  const grandTotalComission = useMemo(() => {
    return totalComission + totalExistingComission;
  }, [totalComission, totalExistingComission]);

  // Contar pagos existentes (considerando eliminaciones)
  const existingPaymentsCount = useMemo(() => {
    return existingPayments.filter((payment: any) => !deletedPaymentIds.includes(payment.id)).length;
  }, [existingPayments, deletedPaymentIds]);



  useEffect(() => {
    refetchPayments();
  }, [refreshKey, refetchPayments]);

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
          gridTemplateColumns: 'repeat(5, 1fr)',
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
              {existingPaymentsCount + payments.length}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>{existingPaymentsCount} registrados + {payments.length} nuevos</span>
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
              ${grandTotalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>${totalExistingAmount.toFixed(2)} registrados + ${totalAmount.toFixed(2)} nuevos</span>
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
              ${grandTotalComission.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>${totalExistingComission.toFixed(2)} registradas + ${totalComission.toFixed(2)} nuevas</span>
            </div>
          </div>

          {/* Quinta tarjeta - Cambiar Fecha */}
          <DateMover
            type="payments"
            selectedDate={selectedDate}
            selectedLead={selectedLead}
            onSuccess={() => {
              refetchPayments();
              // Aquí deberías llamar a refetchRoute si tienes acceso a esa query
            }}
            itemCount={existingPayments.filter(p => !deletedPaymentIds.includes(p.id)).length + payments.length}
            label="pago(s)"
          />
        </div>
      </div>

      <Box
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'visible',
        }}
      >
        <Box padding="large">
          {/* Panel de comisión masiva para nuevos pagos */}
          {payments.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              marginBottom: '16px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#475569',
                  marginBottom: '2px',
                }}>
                  COMISIÓN MASIVA
                </label>
                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontStyle: 'italic',
                }}>
                  Aplicar a todos los pagos nuevos
                </div>
              </div>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}>
                <input
                  type="number"
                  value={massCommission}
                  onChange={(e) => setMassCommission(e.target.value)}
                  placeholder="0.00"
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    outline: 'none',
                    width: '80px',
                    height: '36px',
                  }}
                />
                <Button
                  tone="passive"
                  size="small"
                  onClick={() => {
                    const commissionValue = parseFloat(massCommission);
                    if (isNaN(commissionValue)) return;
                    
                    const updatedPayments = payments.map(payment => ({
                      ...payment,
                      comission: commissionValue
                    }));
                    
                    updateState({ payments: updatedPayments });
                    alert(`✅ Comisión masiva de ${commissionValue} aplicada a ${payments.length} pagos`);
                  }}
                >
                  Aplicar a Todos
                </Button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Todos los Pagos</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isEditing ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    tone="negative"
                    weight="bold"
                    onClick={() => {
                      setState(prev => ({ ...prev, editedPayments: {}, isEditing: false }));
                      setDeletedPaymentIds([]); // Resetear eliminados al cancelar
                    }}
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
                <>
                  <Button
                    tone="active"
                    weight="bold"
                    onClick={() => setState(prev => ({ ...prev, isEditing: true }))}
                  >
                    Editar Pagos
                  </Button>
                  <Button
                    tone="active"
                    size="medium"
                    weight="bold"
                    onClick={handleAddPayment}
                  >
                    <FaPlus size={12} style={{ marginRight: '8px' }} />
                    Agregar Pago
                  </Button>
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
                <th>Tipo</th>
                <th>Forma de Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {/* Pagos Registrados */}
              {existingPayments
                .filter((payment: any) => !deletedPaymentIds.includes(payment.id))
                .map((payment, index) => {
                const editedPayment = editedPayments[payment.id] || payment;
                return (
                  <tr key={`existing-${payment.id}`} style={{ backgroundColor: '#f8fafc' }}>
                    <td style={{ 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: '#6B7280',
                      fontSize: '14px'
                    }}>
                      {index + 1}
                    </td>
                    <td>
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
                    </td>
                    <td>{payment.loan?.borrower?.personalData?.fullName}</td>
                    <td>
                      {payment.loan?.signDate ? 
                        new Date(payment.loan.signDate).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        }) : 
                        '-'
                      }
                    </td>
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
                        <div style={{ position: 'relative' }}>
                          <TextInput
                            type="number"
                            value={editedPayment.comission}
                            onChange={e => handleEditExistingPayment(payment.id, 'comission', e.target.value)}
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
                          {payment.comission}
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
                    <td>
                      {isEditing && (
                        <Button
                          tone="negative"
                          size="small"
                          onClick={() => {
                            // Agregar a la lista de eliminados visualmente
                            setDeletedPaymentIds(prev => [...prev, payment.id]);
                            // También eliminar del estado editedPayments
                            const newEditedPayments = { ...editedPayments };
                            delete newEditedPayments[payment.id];
                            setState(prev => ({ ...prev, editedPayments: newEditedPayments }));
                          }}
                        >
                          <TrashIcon size="small" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Pagos Nuevos */}
              {payments.map((payment, index) => (
                <tr key={`new-${index}`} style={{ backgroundColor: '#ECFDF5' }}>
                  <td style={{ 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#059669',
                    fontSize: '14px'
                  }}>
                    {existingPayments.filter(p => !deletedPaymentIds.includes(p.id)).length + index + 1}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      backgroundColor: '#D1FAE5',
                      color: '#059669',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}>
                      Nuevo
                    </span>
                  </td>
                  <td>
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
                    />
                  </td>
                  <td>
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



      <Box marginTop="large">
        <Button 
          isLoading={customLeadPaymentLoading}
          weight="bold"
          tone="active"
          onClick={() => updateState({ isModalOpen: true })}
          style={{ marginLeft: '10px' }}
          isDisabled={!payments.length && !isEditing}
        >
          {isEditing ? 'Guardar Cambios' : 'Registrar pagos'}
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
            <h4>Total pagado: ${(payments.length > 0 ? totalAmount : state.groupedPayments ? Object.values(state.groupedPayments)[0]?.expectedAmount || 0 : 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
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
  const [refreshKey, setRefreshKey] = useState(0);

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
          refreshKey={refreshKey}
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