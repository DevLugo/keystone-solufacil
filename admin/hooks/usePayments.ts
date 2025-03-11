import { useState, useEffect } from 'react';
import { useLazyQuery, useQuery, useMutation } from '@apollo/client';
import { GET_LEADS, GET_ROUTES, GET_LOANS_BY_LEAD } from '../graphql/queries/payment';
import { CREATE_LEAD_PAYMENT_RECEIVED } from '../graphql/mutations/payment';
import { Lead, Loan, LoanPayment, Route, Option, PaymentDistribution, PaymentType, PaymentMethod } from '../types/payment';

export const usePayments = () => {
  const [selectedLead, setSelectedLead] = useState<Option | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [comission, setComission] = useState<number>(8);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Option | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [paymentDistribution, setPaymentDistribution] = useState<PaymentDistribution>({
    cashPaidAmount: 0,
    bankPaidAmount: 0,
    totalPaidAmount: 0,
    falcoAmount: 0,
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS);
  
  const { data: loansData, loading: loansLoading, error: loansError } = useQuery<{ loans: Loan[] }>(
    GET_LOANS_BY_LEAD,
    {
      variables: { 
        where: {
          lead: {
            id: { equals: selectedLead?.value || '' }
          },
          finishedDate: { equals: null }
        }
      },
      skip: !selectedLead,
    }
  );

  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: Route[] }>(
    GET_ROUTES,
    {
      variables: { where: { } },
    }
  );

  const [createCustomLeadPaymentReceived, { error: customLeadPaymentError, loading: customLeadPaymentLoading }] = useMutation(CREATE_LEAD_PAYMENT_RECEIVED);

  useEffect(() => {
    if (selectedRoute?.value) {
      getLeads({
        variables: { routeId: selectedRoute.value }
      });
    }
  }, [selectedRoute?.value, getLeads]);

  useEffect(() => {
    if (loansData?.loans) {
      const newPayments = loansData.loans.map(loan => ({
        amount: loan.weeklyPaymentAmount,
        comission,
        loanId: loan.id,
        type: PaymentType.PAYMENT,
        paymentMethod: PaymentMethod.CASH,
      }));
      setPayments(newPayments);
    }
  }, [loansData, comission]);

  const handleAddPayment = () => {
    setPayments([
      ...payments,
      {
        amount: '',
        loanId: '',
        type: PaymentType.PAYMENT,
        comission,
        paymentMethod: PaymentMethod.CASH,
      }
    ]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handlePaymentChange = (index: number, field: keyof LoanPayment, value: string | number) => {
    const updatedPayments = [...payments];
    updatedPayments[index] = {
      ...updatedPayments[index],
      [field]: value,
    };
    setPayments(updatedPayments);
  };

  const calculateTotalAmount = () => {
    return payments.reduce((total, payment) => {
      return total + (parseFloat(payment.amount) || 0);
    }, 0);
  };

  const handleSubmit = async () => {
    try {
      const totalAmount = calculateTotalAmount();
      const result = await createCustomLeadPaymentReceived({
        variables: {
          expectedAmount: totalAmount,
          agentId: selectedLead?.value,
          leadId: selectedLead?.value,
          payments: payments.map(payment => ({
            ...payment,
            amount: parseFloat(payment.amount),
          })),
          cashPaidAmount: paymentDistribution.cashPaidAmount,
          bankPaidAmount: paymentDistribution.bankPaidAmount,
          paymentDate: selectedDate?.toISOString(),
        },
      });
      return result;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  };

  return {
    selectedLead,
    setSelectedLead,
    selectedDate,
    setSelectedDate,
    comission,
    setComission,
    payments,
    selectedRoute,
    setSelectedRoute,
    isModalOpen,
    setIsModalOpen,
    paymentDistribution,
    setPaymentDistribution,
    leadsData,
    leadsLoading,
    leadsError,
    loansData,
    loansLoading,
    loansError,
    routesData,
    routesLoading,
    routesError,
    customLeadPaymentError,
    customLeadPaymentLoading,
    handleAddPayment,
    handleRemovePayment,
    handlePaymentChange,
    handleSubmit,
    calculateTotalAmount,
  };
};
