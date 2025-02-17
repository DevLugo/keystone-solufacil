/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo } from 'react';
import { gql, useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { DatePicker, Select, TextInput } from '@keystone-ui/fields';

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

const GET_ROUTES = gql`
  query Routes($where: RouteWhereInput!) {
    routes(where: $where) {
      id
      name
    }
  }
`;

const GET_LOANS_BY_LEAD = gql`
  query GetLoansByLead($leadId: IDFilter!) {
    loans(where: { lead: { id: $leadId } }) {
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

const CREATE_LOAN_PAYMENT = gql`
  mutation CreateLoanPayment($data: LoanPaymentCreateInput!) {
    createLoanPayment(data: $data) {
      id
    }
  }
`;

const CREATE_LEAD_PAYMENT_RECEIVED = gql`
  mutation CreateLeadPaymentReceived($data: LeadPaymentReceivedCreateInput!) {
    createLeadPaymentReceived(data: $data) {
      id
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
  profitAmount: string;
  returnToCapital: string;
  receivedAt: string;
  loan: { connect: { id: string } };
  /* collector: { connect: { id: string } }; */
  leadPaymentReceived: { connect: { id: string } };
  type: string;
  comission: number;
  paymentMethod: string;
};

type Route = {
  name: string;
  id: string;
};

type Option = {
  value: string;
  label: string;
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

function CreatePageForm() {
  const [selectedLead, setSelectedLead] = useState<Option | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [comission, setComission] = useState<number>(8);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Option | null>(null);
  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS);
  const { data: loansData, loading: loansLoading, error: loansError } = useQuery<{ loans: Loan[] }>(GET_LOANS_BY_LEAD, {
    variables: { 
      leadId: { equals: selectedLead?.value || '' },  
    },
    skip: !selectedLead,
  });
  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
    variables: { where: { } },
  });
  const [createLoanPayment, { error: loanPaymentError, loading: loanPaymentLoading }] = useMutation(CREATE_LOAN_PAYMENT);
  const [createLeadPaymentReceived, { error: leadPaymentError, loading: leadPaymentLoading }] = useMutation(CREATE_LEAD_PAYMENT_RECEIVED);

  const router = useRouter();

  useEffect(() => {
    if (loansData) {
      const newPayments = loansData.loans.map(loan => ({
        amount: loan.weeklyPaymentAmount,
        profitAmount: '',
        returnToCapital: '',
        receivedAt: selectedDate?.toISOString() || '',
        loan: { connect: { id: loan.id } },
        /* collector: { connect: { id: '' } }, */
        leadPaymentReceived: { connect: { id: '' } },
        type: 'PAYMENT',
        comission: comission,
        paymentMethod: 'CASH',

      }));
      setPayments(newPayments);
    }
  }, [loansData]);

  useEffect(() => {
    console.log("selectedRoute", selectedRoute);
    if (selectedRoute?.value) {
      console.log("111111", selectedRoute);
      getLeads(
        {
          variables: { 
            routeId: selectedRoute.value,
          }
        }
      );
    }
  }, [selectedRoute?.value]);

  const handleAddPayment = () => {
    setPayments([
      ...payments,
      {
        amount: '',
        profitAmount: '',
        returnToCapital: '',
        receivedAt: selectedDate?.toISOString() || '',
        loan: { connect: { id: '' } },
        /* collector: { connect: { id: '' } }, */
        leadPaymentReceived: { connect: { id: '' } },
        type: 'PAYMENT',
        comission: comission,
        paymentMethod: 'CASH',
      }
    ]);
  };

  const handlePaymentTypeChange = (index: number, option: Option) => {
    const newPayments = [...payments];
    newPayments[index].type = option.value;
    if (option.value === 'NO_PAYMENT') {
      newPayments[index].amount = '0';
    }
    setPayments(newPayments);
  };

  const handlePaymentMethodChange = (index: number, option: Option) => {
    const newPayments = [...payments];
    newPayments[index].paymentMethod = option.value;
    setPayments(newPayments);
  };

  const handleRemovePayment = (index: number) => {
    const newPayments = payments.filter((_, i) => i !== index);
    setPayments(newPayments);
  };

  const handleChange = (index: number, field: keyof LoanPayment, value: any) => {
    const newPayments = [...payments];
    if (field === 'loan' || /* field === 'collector' || */ field === 'leadPaymentReceived') {
      newPayments[index][field] = { connect: { id: value } };
    } else if (field === 'comission') {
      (newPayments[index][field] as unknown as string) = value;
    }else{
      (newPayments[index][field] as any) = value;
    }
    setPayments(newPayments);
  };
  // Ajusta la función handleDateChange para manejar una cadena
  const handleDateChange = (value: string) => {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      setSelectedDate(date);
      const dateString = date.toISOString();
      const newPayments = payments.map(payment => ({
        ...payment,
        receivedAt: dateString,
      }));
      setPayments(newPayments);
    } else {
      setSelectedDate(null);
      const newPayments = payments.map(payment => ({
        ...payment,
        receivedAt: selectedDate?.toISOString() || '',
      }));
      setPayments(newPayments);
    }
  };

  const handleSubmit = async () => {
    // Create LeadPaymentReceived
    const { data: leadPaymentData } = await createLeadPaymentReceived({ variables: { data: {} } });
    const leadPaymentReceivedId = leadPaymentData.createLeadPaymentReceived.id;

    // Update payments with the created LeadPaymentReceived ID
    const updatedPayments = payments.map(payment => ({
      ...payment,
      leadPaymentReceived: { connect: { id: leadPaymentReceivedId } },
      profitAmount: "0",
      returnToCapital: "0",
      comission: payment.comission.toString()
    }));

    // Create LoanPayments
    for (const payment of updatedPayments) {
      await createLoanPayment({ variables: { data: payment } });
    }

    alert('Payments created successfully!');
    router.push('/loan-payments');
  };
  const totalAmount = useMemo(() => {
    return payments.reduce((sum, payment) => sum + parseFloat(payment.amount || '0'), 0);
  }, [payments]);
  const paymentTypeCounts = useMemo(() => {
    return payments.reduce((counts, payment) => {
      counts[payment.type] = (counts[payment.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }, [payments]);
  
  const totalComission = useMemo(() => {
    return payments.reduce((sum, payment) => sum + parseFloat(payment.comission.toString() || '0'), 0);
  }, [payments]);

  if (leadsLoading) return <LoadingDots label="Loading leads" size="large" />;
  if (leadsError) return <p>Error loading leads: {leadsError.message}</p>;

  return (
    <Box paddingTop="xlarge">
      {(loanPaymentError || leadPaymentError) && (
        <GraphQLErrorNotice
          networkError={loanPaymentError?.networkError || leadPaymentError?.networkError}
          errors={loanPaymentError?.graphQLErrors || leadPaymentError?.graphQLErrors}
        />
      )}
      <Box marginBottom="large" style={{ display: 'flex', alignItems: 'center' }}>
        <Box marginRight="medium" style={{ flex: 1 }}>
          <label>Fecha</label>
          <DatePicker
            value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''} // Convertir la fecha a cadena en formato YYYY-MM-DD
            onUpdate={(value: string) => handleDateChange(value)} // Usar onUpdate con un valor de tipo string
            onClear={() => handleDateChange('')} // Usar handleDateChange con una cadena vacía
          />
        </Box>
        <Box style={{ flex: 1 }} marginRight="medium">
          <label>Ruta</label>
          <Select
            options={routesData?.routes.map(r => ({ value: r.id, label: r.name })) || []}
            isLoading={routesLoading}
            value={selectedRoute}
            onChange={option => {
              if (option) {
                setSelectedRoute(option);
              }
            }}
          />
        </Box>
        <Box style={{ flex: 1 }} marginRight="medium">
          <label>Lider</label>
          <Select
            options={leadsData?.employees?.filter(employee => employee.type === 'LEAD')?.map(lead => ({ value: lead.id, label: lead.personalData.fullName })) || []}
            isLoading={leadsLoading}
            value={selectedLead}
            onChange={option => {
              if (option) {
                setSelectedLead(option);
              }
            }}
          />
        </Box>
        <Box style={{ flex: 1 }} marginRight="medium">
          <label>Comision</label>
          <TextInput 
            value={8}
            type='number'
            onChange={(e) => setComission(parseInt(e.target.value))}
          />
          
        </Box>
      </Box>
      <Box
        style={{
          position: 'sticky',
          top: '10px',
          backgroundColor: '#f9f9f9',
          border: '1px solid #ddd',
          borderRadius: '8px',
          zIndex: 1000,
          marginBottom: '20px',
        }}
      >
        <ul>
          <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Sumal Total: ${totalAmount.toFixed(2)}</p>
          {Object.entries(paymentTypeCounts).map(([type, count]) => (
            <li key={type} style={{ marginBottom: '5px', fontSize: '14px' }}>
              <span style={{ marginRight: '10px', display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%' }}></span>
              <strong>{type}:</strong> {count}
            </li>
          ))}
          <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Comision Total: ${totalComission.toFixed(2)}</p>

        </ul>
      </Box>

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Pago Esperado</th>
            <th>Cantidad</th>
            <th>Typo</th>
            <th>Comission</th>
            <th>Forma de pago</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment, index) => (
            <tr key={index}>
              <td>
                <Select
                  options={loansData?.loans.map(loan => ({
                    value: loan.id,
                    label: loan.borrower?.personalData?.fullName,
                  })) || []}
                  value={loansData?.loans.find(loan => loan.id === payment.loan.connect.id) ? {
                    value: payment.loan.connect.id,
                    label: loansData.loans.find(loan => loan.id === payment.loan.connect.id)?.borrower?.personalData?.fullName || '',
                  } : null}
                  onChange={(option) => handleChange(index, 'loan', (option as Option).value)}
                />
              </td>
              <td>
                <TextInput value={payment.loan.connect.id ? loansData?.loans.find(loan => loan.id === payment.loan.connect.id)?.weeklyPaymentAmount : ''} readOnly style={{ backgroundColor: '#f0f0f0', color: '#888' }} // Fondo gris y texto gris
                />
              </td>
              <td>
                <TextInput 
                  type="number" 
                  value={payment.amount} onChange={(e) => handleChange(index, 'amount', e.target.value)}
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
                  value={payment.comission} onChange={(e) => handleChange(index, 'comission', e.target.value)}
                />
              </td>
              <td>
                <Select
                  options={paymentMethods}
                  value={paymentMethods.find(option => option.value === payment.paymentMethod) || null}
                  onChange={(option) => handlePaymentMethodChange(index, (option as Option))}
                />
              </td>
              <TextInput value={payment.profitAmount} onChange={(e) => handleChange(index, 'profitAmount', e.target.value)} hidden />

              <TextInput value={payment.returnToCapital} onChange={(e) => handleChange(index, 'returnToCapital', e.target.value)} hidden />

              <TextInput value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''} hidden />

              <TextInput value={payment.loan.connect.id} onChange={(e) => handleChange(index, 'loan', e.target.value)} hidden />

              {/* <TextInput value={payment.collector.connect.id} onChange={(e) => handleChange(index, 'collector', e.target.value)} hidden /> */}

              <TextInput value={payment.leadPaymentReceived.connect.id} onChange={(e) => handleChange(index, 'leadPaymentReceived', e.target.value)} hidden />
              <td>
                <Button onClick={() => handleRemovePayment(index)}>Remove</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Box marginTop="large">
        <Button onClick={handleAddPayment}>Agregar otro pago</Button>
        <Button isLoading={loanPaymentLoading || leadPaymentLoading} weight="bold" tone="active" onClick={handleSubmit} style={{ marginLeft: '10px' }}>
          Registrar pagos
        </Button>
      </Box>
    </Box>
  );
}

export default function CustomPage() {
  return (
    <PageContainer
      title="Add Multiple Loan Payments"
      header={<h1>Registrar pagos</h1>}
    >
      <CreatePageForm />
    </PageContainer>
  );
}