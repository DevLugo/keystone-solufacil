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
  }>({
    payments: [],
    comission: 8,
    isModalOpen: false,
    loadPaymentDistribution: {
      cashPaidAmount: 0,
      bankPaidAmount: 0,
      totalPaidAmount: 0,
      falcoAmount: 0,
    }
  });

  const { 
    payments, comission, isModalOpen, loadPaymentDistribution 
  } = state;

  const updateState = (updates: Partial<{
    payments: LoanPayment[];
    comission: number;
    isModalOpen: boolean;
    loadPaymentDistribution: {
      cashPaidAmount: number;
      bankPaidAmount: number;
      totalPaidAmount: number;
      falcoAmount: number;
    };
  }>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

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

  const router = useRouter();

  useEffect(() => {
    if (loansData) {
      const newPayments = loansData.loans.map(loan => ({
        amount: loan.weeklyPaymentAmount,
        comission: comission,
        loanId: loan.id,
        type: 'PAYMENT',
        paymentMethod: 'CASH',
      }));
      updateState({ payments: newPayments });
    }
  }, [loansData, comission]);

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

  const handleSubmit = async () => {
    if (!selectedLead?.id || !selectedDate) {
      alert('Por favor seleccione un líder y una fecha');
      return;
    }

    //valida que la suma de cashpaidAmount, bakPaidAmount y falcoAmount sean igual a totalAmount
    if ((loadPaymentDistribution.bankPaidAmount + loadPaymentDistribution.cashPaidAmount) !== totalAmount) {
      alert('La suma de los pagos no coincide con el total de la deuda' );
      return;
    }

    // Update payments with the created LeadPaymentReceived ID
    const updatedPayments = payments.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount),
      comission: parseFloat(payment.comission.toString()),
    }));

    try {
      // Create Custom LeadPaymentReceived with the payment IDs
      await createCustomLeadPaymentReceived({
        variables: {
          expectedAmount: parseFloat(loadPaymentDistribution.totalPaidAmount.toFixed(2)),
          cashPaidAmount: parseFloat(loadPaymentDistribution.cashPaidAmount.toFixed(2)),
          bankPaidAmount: parseFloat(loadPaymentDistribution.bankPaidAmount.toFixed(2)),
          falcoAmount: parseFloat(loadPaymentDistribution.falcoAmount.toFixed(2)),
          agentId: selectedLead.id,
          leadId: selectedLead.id,
          payments: updatedPayments,
          paymentDate: selectedDate.toISOString(),
        },
      });

      alert('Payments created successfully!');
      router.push('/loan-payments');
    } catch (error) {
      console.error('Error creating payments:', error);
    }
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
      <Box marginBottom="large" style={{ display: 'flex', alignItems: 'center' }}>
        <Box style={{ flex: 1 }} marginRight="medium">
          <label>Comision</label>
          <TextInput 
            value={comission}
            type='number'
            onChange={(e) => updateState({ comission: parseInt(e.target.value) })}
          />
        </Box>
      </Box>
      <Box
        style={{
          position: 'sticky',
          top: '10px',
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          zIndex: 1000,
          marginBottom: '20px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#333' }}>Resumen de Pagos</h3>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c5282' }}>
                Suma Total: ${totalAmount.toFixed(2)}
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c5282' }}>
                Comisión Total: ${totalComission.toFixed(2)}
              </span>
            </div>
          </div>
          <div style={{ flex: 1, marginLeft: '20px' }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#666' }}>Distribución por Tipo</h4>
            {Object.entries(paymentTypeCounts).map(([type, count]) => (
              <div key={type} style={{ 
                display: 'flex',
                alignItems: 'center',
                marginBottom: '10px',
                padding: '8px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px'
              }}>
                <span style={{ 
                  marginRight: '10px',
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: type === 'NORMAL' ? '#4299e1' : '#48bb78'
                }}></span>
                <strong style={{ color: '#4a5568' }}>{type}:</strong>
                <span style={{ marginLeft: '8px', color: '#718096' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </Box>

      <Box
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          padding: '16px',
          marginBottom: '24px'
        }}
      >
        <table>
          <thead>
            <tr>
              <th style={{ width: '400px' }}>Nombre</th>
              <th>Pago Esperado</th>
              <th>Cantidad</th>
              <th style={{ width: '150px' }}>Tipo</th>
              <th>Comision</th>
              <th style={{ width: '150px' }}>Forma de pago</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index) => (
              <tr key={index}>
                <td>
                  <Select
                    options={loansData?.loans.map((loan: Loan) => ({
                      value: loan.id,
                      label: loan.borrower?.personalData?.fullName,
                    })) || []}
                    value={loansData?.loans.find((loan: Loan) => loan.id === payment.loanId) ? {
                      value: payment.loanId,
                      label: loansData.loans.find((loan: Loan) => loan.id === payment.loanId)?.borrower?.personalData?.fullName || '',
                    } : null}
                    onChange={(option) => handleChange(index, 'loanId', (option as Option).value)}
                  />
                </td>
                <td>
                  <TextInput 
                    value={payment.loanId ? loansData?.loans.find((loan: Loan) => loan.id === payment.loanId)?.weeklyPaymentAmount : ''} 
                    readOnly 
                    style={{ backgroundColor: '#f0f0f0', color: '#888' }}
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
                  <Select
                    options={paymentTypeOptions}
                    value={paymentTypeOptions.find(option => option.value === payment.type) || null}
                    onChange={(option) => handlePaymentTypeChange(index, (option as Option))}
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
                    options={paymentMethods}
                    value={paymentMethods.find(option => option.value === payment.paymentMethod) || null}
                    onChange={(option) => handlePaymentMethodChange(index, (option as Option))}
                  />
                </td>
                <td>
                  <Button
                    tone="negative"
                    size="small"
                    onClick={() => handleRemovePayment(index)}
                    style={{ padding: '4px 8px', minWidth: 'auto' }}
                  >
                    <TrashIcon size="small" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <Box marginTop="large">
        <Button onClick={handleAddPayment}>Agregar otro pago</Button>
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
        title="Set the money distribution" 
        isOpen={isModalOpen} 
        actions={{
          confirm: { 
            label: 'Confirm', 
            action: () => handleSubmit(), 
            loading: customLeadPaymentLoading 
          },
          cancel: { 
            label: 'Close', 
            action: () => updateState({ isModalOpen: false }) 
          }
        }}
      >
        <Box padding="large">
          <Box marginBottom="large">
            <h4>Deuda Total: {totalAmount}</h4>
          </Box>
          <Box marginBottom="large">
            <label>Falco</label>
            <TextInput
              type="number"
              value={loadPaymentDistribution.falcoAmount}
              onChange={(e) => updateState({
                loadPaymentDistribution: {
                  ...loadPaymentDistribution,
                  falcoAmount: parseFloat(e.target.value),
                }
              })}
            />
          </Box>
          <Box marginBottom="large">
            <label>Cash Paid Amount</label>
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
            <label>Bank Paid Amount</label>
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
            <label>Total Paid Amount</label>
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
    <CreatePaymentForm 
      selectedDate={selectedDate}
      selectedRoute={selectedRoute}
      selectedLead={selectedLead}
    />
  );
}