/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { DatePicker, Select, TextInput } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';

// Import types
import type { 
  Loan, 
  LoanType, 
  Option, 
  Lead,
  Route,
  LoanCreateInput,
  PhoneCreateInput,
  PersonalDataCreateInput,
  BorrowerCreateOrConnectInput 
} from '../types/loan';

// Import components
import { RouteLeadSelector } from '../components/routes/RouteLeadSelector';
import { LoanListView } from '../components/loans/LoanListView';

// Import GraphQL queries and mutations
import { GET_ROUTES, GET_LEADS } from '../graphql/queries/routes';
import { GET_LOANS as LOANS_QUERY } from '../graphql/queries/loans';
import { GET_LOAN_TYPES } from '../graphql/queries/loantypes';
import { CREATE_LOAN as CREATE_LOAN_MUTATION, UPDATE_PERSONAL_DATA as UPDATE_PERSONAL_DATA_MUTATION } from '../graphql/mutations/loans';

import './creditos.css';

const formStyles = {
  wrapper: {
    position: 'relative' as const,
    marginBottom: '8px',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    color: '#4B5563',
    fontWeight: 500,
    fontSize: '14px'
  },
  inputContainer: {
    position: 'relative' as const,
    transition: 'all 0.3s ease',
    '&:focus-within': {
      zIndex: 1,
      transform: 'scale(1.02)',
    }
  },
  input: {
    width: '100%',
    transition: 'all 0.3s ease',
    '&:focus': {
      outline: 'none',
      borderColor: '#2563eb',
    }
  }
};


interface ExtendedLoan extends Loan {
  lead?: { connect: { id: string } };
  comission?: string;
  previousLoan?: {
    id: string;
    pendingAmount: string;
    avalName: string;
    avalPhone: string;
    borrower: {
      id: string;
      personalData: {
        fullName: string;
        phones: { number: string }[];
      };
    };
  };
}

interface FormState {
  selectedDate: Date | null;
  selectedRoute: Option | null;
  selectedLead: Option | null;
  newLoans: ExtendedLoan[];
  loans: Loan[];
  comission: number;
  focusedInput: string | null;
}

function CreateLoanForm() {
  const [state, setState] = useState<FormState>({
    selectedDate: new Date(),
    selectedRoute: null,
    selectedLead: null,
    newLoans: [],
    loans: [],
    comission: 8,
    focusedInput: null
  });

  const { 
    selectedDate, selectedRoute, selectedLead, 
    newLoans, loans, comission, focusedInput 
  } = state;

  const updateState = (updates: Partial<FormState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
    variables: { where: {} },
  });

  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS);

  useEffect(() => {
    if (selectedRoute?.value) {
      getLeads({ variables: { routeId: selectedRoute.value } });
    }
  }, [selectedRoute, getLeads]);

  const { data: loansData, loading: loansLoading, error: loansError, refetch: refetchLoans } = useQuery(LOANS_QUERY, {
    variables: { leadId: selectedLead?.value || '', finishedDate: {
      equals: null
    }},
    skip: !selectedLead,
    onCompleted: (data) => {
      if (data?.loans) {
        updateState({ loans: data.loans });
      }
    }
  });

  const { data: loanTypesData, loading: loanTypesLoading, error: loanTypesError } = useQuery<{ loantypes: LoanType[] }>(GET_LOAN_TYPES, {
    fetchPolicy: 'network-only',
    onError: (error) => {
      console.error('Error loading loan types:', error);
    }
  });
  const [updatePersonalData] = useMutation(UPDATE_PERSONAL_DATA_MUTATION);
  const [createLoan, { error: loanError, loading: loanLoading }] = useMutation(CREATE_LOAN_MUTATION);
  const router = useRouter();

  const routeOptions = useMemo(() => 
    routesData?.routes?.map(route => ({
      value: route.id,
      label: route.name,
    })) || [],
    [routesData]
  );

  const leadOptions = useMemo(() => 
    leadsData?.employees?.filter(employee => employee.type === 'LEAD')?.map(lead => ({
      value: lead.id,
      label: lead.personalData.fullName,
    })) || [],
    [leadsData]
  );




  const handleRouteSelect = (route: Option | null) => {
    updateState({
      selectedRoute: route,
      selectedLead: null,
      focusedInput: null,
      comission: 8
    });
  };

  const loanTypeOptions = useMemo(() => {
    return [
      { value: '', label: 'Seleccionar tipo de préstamo' },
      ...(loanTypesData?.loantypes?.map(type => ({
        value: type.id,
        label: `${type.name} (${type.weekDuration} semanas - ${type.rate}%)`,
      })) || [])
    ];
  }, [loanTypesData]);

  useEffect(() => {
    if (loanTypesData?.loantypes && loanTypesData.loantypes.length > 0) {
      const defaultLoanType = loanTypesData.loantypes[0];
      const updatedLoans = newLoans.map(loan => ({
        ...loan,
        loantype: defaultLoanType
      }));
      updateState({ newLoans: updatedLoans });
    }
  }, [loanTypesData?.loantypes]);

  const previousLoanOptions = useMemo(() => {
    const options = [
      { value: '', label: 'Seleccionar préstamo previo' }
    ];
    
    if (loansData?.loans) {
      const activeLoans = loansData.loans.filter((loan: Loan) => parseFloat(loan.pendingAmount) > 0);
      const sortedLoans = activeLoans.sort((a: Loan, b: Loan) => {
        const nameA = a.borrower?.personalData?.fullName || '';
        const nameB = b.borrower?.personalData?.fullName || '';
        return nameA.localeCompare(nameB);
      });

      options.push(
        ...sortedLoans.map((loan: Loan) => ({
          value: loan.id,
          label: `${loan.borrower?.personalData?.fullName || 'Sin nombre'} ($${loan.pendingAmount || 0})`
        }))
      );
    }

    return options;
  }, [loansData?.loans]);

  const handleAddLoan = () => {
    const defaultLoanType = loanTypesData?.loantypes?.[0];
    if (!defaultLoanType) {
      alert('No hay tipos de préstamo disponibles');
      return;
    }

    const newLoan: ExtendedLoan = {
      id: '',
      weeklyPaymentAmount: '',
      requestedAmount: '',
      amountGived: '',
      amountToPay: '',
      pendingAmount: '0',
      signDate: '',
      firstPaymentDate: '',
      finishedDate: '',
      createdAt: '',
      updatedAt: '',
      loantype: defaultLoanType,
      lead: selectedLead ? { connect: { id: selectedLead.value }} : undefined,
      borrower: {
        id: '',
        personalData: {
          id: '',
          fullName: '',
          phones: [{ number: '' }]
        }
      },
      avalName: '',
      avalPhone: '',
      previousLoan: undefined
    };

    updateState({ newLoans: [...newLoans, newLoan] });
  };

  const handleRemoveLoan = (index: number) => {
    const updatedLoans = newLoans.filter((_, i) => i !== index);
    updateState({ newLoans: updatedLoans });
  };

  const handleEditLoan = (index: number, field: string, value: string) => {
    const updatedLoans = [...newLoans];
    const loan = { ...updatedLoans[index] };

    switch (field) {
      case 'previousLoan': {
        if (!value) {
          // If empty value selected, keep current values but recalculate amountGived
          loan.previousLoan = undefined;
          loan.amountGived = loan.requestedAmount || '0';
          break;
        }
        const previousLoan = loans.find(l => l.id === value);
        if (previousLoan) {
          loan.previousLoan = previousLoan;
          loan.borrower = previousLoan.borrower;
          loan.avalName = previousLoan.avalName;
          loan.avalPhone = previousLoan.avalPhone;
          loan.pendingAmount = previousLoan.pendingAmount;
          
          // Update amountGived based on requestedAmount and pendingAmount
          const requestedAmount = parseFloat(loan.requestedAmount) || 0;
          const previousLoanAmount = parseFloat(previousLoan.pendingAmount) || 0;
          loan.amountGived = (requestedAmount - previousLoanAmount).toString();
        }
        break;
      }
      case 'loantype': {
        if (!value) {
          // If empty value selected, keep current loan type
          break;
        }
        const selectedType = loanTypesData?.loantypes?.find(type => type.id === value);
        if (selectedType) {
          loan.loantype = selectedType;
          // Automatically calculate amountToPay based on rate
          if (loan.requestedAmount) {
            const amount = parseFloat(loan.requestedAmount);
            const rate = parseFloat(selectedType.rate);
            if (!isNaN(amount) && !isNaN(rate)) {
              loan.amountToPay = (amount * (1 + rate)).toFixed(2);
            }
          }
        }
        break;
      }
      case 'borrowerName': {
        loan.borrower = {
          ...loan.borrower,
          personalData: {
            ...loan.borrower?.personalData,
            fullName: value
          }
        };
        break;
      }
      case 'requestedAmount': {
        loan.requestedAmount = value;
        // Calculate amountGived based on requestedAmount and any previous loan
        const requestedAmount = parseFloat(value) || 0;
        const previousLoanAmount = loan.previousLoan ? parseFloat(loan.previousLoan.pendingAmount) || 0 : 0;
        loan.amountGived = (requestedAmount - previousLoanAmount).toString();

        // Calculate amountToPay based on rate
        if (loan.loantype) {
          const rate = parseFloat(loan.loantype.rate);
          if (!isNaN(requestedAmount) && !isNaN(rate)) {
            loan.amountToPay = (requestedAmount * (1 + rate)).toFixed(2);
          }
        }
        break;
      }
      case 'borrowerPhone': {
        const existingPhones = loan.borrower?.personalData?.phones || [];
        loan.borrower = {
          ...loan.borrower,
          personalData: {
            ...loan.borrower?.personalData,
            phones: existingPhones.length > 0 ? 
              existingPhones.map((_, i) => i === existingPhones.length - 1 ? { number: value } : existingPhones[i]) :
              [{ number: value }]
          }
        };
        break;
      }
      default: {
        if (field in loan) {
          (loan as any)[field] = value;
        }
      }
    }

    updatedLoans[index] = loan;
    updateState({ newLoans: updatedLoans });
  };

  const handleDateChange = (value: string) => {
    const date = new Date(value);
    updateState({ 
      selectedDate: !isNaN(date.getTime()) ? date : null 
    });
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      alert('Please select a date');
      return;
    }

    if (!selectedLead?.value) {
      alert('Please select a lead');
      return;
    }

    try {
      for (const loan of newLoans) {
        if (!loan.loantype) {
          alert('Please select a loan type for all loans');
          return;
        }

        const loanData: LoanCreateInput = {
          requestedAmount: loan.requestedAmount,
          amountGived: loan.amountGived,
          loantype: { connect: { id: loan.loantype.id } },
          signDate: selectedDate,
          avalName: loan.avalName,
          avalPhone: loan.avalPhone,
          lead: { connect: { id: selectedLead.value }},
          borrower: loan.previousLoan?.id
            ? { connect: { id: loan.borrower.id } }
            : {
                create: {
                  personalData: {
                    create: {
                      phones: { create: loan.borrower.personalData.phones },
                      fullName: loan.borrower.personalData.fullName,
                    },
                  },
                },
              },
          comissionAmount: comission.toString()
        };

        if (loan.previousLoan?.id && loan.borrower?.personalData) {
          loanData.previousLoan = { connect: { id: loan.previousLoan.id } };
          const previousLoan = loans.find(l => l.id === loan.previousLoan?.id);
          
          if (!previousLoan?.borrower?.personalData) {
            throw new Error('Previous loan data is incomplete');
          }

          if (
            loan.avalName !== previousLoan.avalName ||
            loan.avalPhone !== previousLoan.avalPhone ||
            loan.borrower.personalData.fullName !== previousLoan.borrower.personalData.fullName ||
            loan.borrower.personalData.phones[0]?.number !== previousLoan.borrower.personalData.phones[0]?.number
          ) {
            await updatePersonalData({
              variables: {
                where: { id: loan.borrower.personalData.id },
                data: {
                  fullName: loan.borrower.personalData.fullName,
                  phones: {
                    create: loan.borrower.personalData.phones.map(phone => ({
                      number: phone.number,
                    })),
                  },
                },
              },
            });
          }
        }

        await createLoan({ variables: { data: loanData } });
      }

      alert('Loans created successfully!');
      router.push('/loans');
    } catch (error) {
      console.error('Error creating loans:', error);
      alert('Error creating loans. Please check the console for details.');
    }
  };

  const totalAmount = useMemo(() => {
    return newLoans.reduce((sum, loan) => sum + parseFloat(loan.amountToPay || '0'), 0);
  }, [newLoans]);

  if (routesLoading || loanTypesLoading) {
    return <LoadingDots label="Loading data" size="large" />;
  }

  if (routesError) return <GraphQLErrorNotice errors={routesError?.graphQLErrors || []} networkError={routesError?.networkError} />;
  if (leadsError) return <GraphQLErrorNotice errors={leadsError?.graphQLErrors || []} networkError={leadsError?.networkError} />;
  if (loansError) return <GraphQLErrorNotice errors={loansError?.graphQLErrors || []} networkError={loansError?.networkError} />;
  if (loanTypesError) return <GraphQLErrorNotice errors={loanTypesError?.graphQLErrors || []} networkError={loanTypesError?.networkError} />;

  return (
    <Box paddingTop="xlarge">
      {loanError && (
        <GraphQLErrorNotice
          networkError={loanError?.networkError}
          errors={loanError?.graphQLErrors}
        />
      )}
      <Box marginBottom="large" paddingX="none">
        <Box style={{ display: 'flex', gap: '2px', alignItems: 'flex-start' }}>
          <Box style={{ flex: 0.7 }}>
            <div className="form-group">
              <label>Fecha</label>
              <div>
                <DatePicker
                  value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                  onUpdate={(value: string) => handleDateChange(value)}
                  onClear={() => handleDateChange('')}
                />
              </div>
            </div>
          </Box>
          <Box style={{ flex: 1.4 }}>
            <div className="form-group">
              <label>Ruta</label>
              <div>
                <Select
                  value={selectedRoute}
                  onChange={(option) => {
                    if (option) {
                      updateState({
                        selectedRoute: option,
                        selectedLead: null,
                        comission: 8
                      });
                    }
                  }}
                  options={routeOptions}
                />
              </div>
            </div>
          </Box>
          <Box style={{ flex: 1.4 }}>
            <div className="form-group">
              <label>Lider</label>
              <div>
                <Select
                  value={selectedLead}
                  onChange={(option) => {
                    if (option) {
                      updateState({
                        selectedLead: option
                      });
                    }
                  }}
                  options={leadOptions}
                  isDisabled={!selectedRoute}
                />
              </div>
            </div>
          </Box>
          <Box style={{ flex: 0.5 }}>
            <div className="form-group">
              <label>Comisión</label>
              <div>
                <TextInput 
                  type="number"
                  value={comission}
                  onChange={(e) => updateState({ comission: parseInt(e.target.value) })}
                  disabled={!selectedLead}
                />
              </div>
            </div>
          </Box>
        </Box>
      </Box>
      <Box
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Box style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Button
            tone="active"
            weight="bold"
            onClick={handleAddLoan}
            style={{ padding: '8px 16px' }}
            isDisabled={!selectedRoute || !selectedLead}
          >
            Agregar Prestamo
          </Button>
        </Box>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Total: ${totalAmount.toFixed(2)}</h3>
        </Box>
      </Box>

      <Box
        style={{
          marginBottom: '24px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {(loansLoading || leadsLoading) ? (
          <Box padding="xlarge" style={{ display: 'flex', justifyContent: 'center' }}>
            <LoadingDots label="Loading loans" size="large" />
          </Box>
        ) : (
          <LoanListView
            loans={newLoans}
            existingLoans={loans}
            loanTypes={loanTypesData?.loantypes || []}
            loanTypeOptions={loanTypeOptions}
            previousLoanOptions={previousLoanOptions}
            loading={false}
            error={loansError || loanTypesError}
            onRemoveLoan={handleRemoveLoan}
            onEditLoan={handleEditLoan}
            focusedInput={focusedInput}
          />
        )}
      </Box>

      <Box
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '16px',
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Button
          tone="active"
          weight="bold"
          onClick={handleSubmit}
          isLoading={loanLoading}
          style={{ padding: '8px 24px', minWidth: '150px' }}
        >
          Guardar Prestamos
        </Button>
      </Box>
    </Box>
  );
}

export default function LoanPage() {
  return (
    <PageContainer
      header={<h1>Create Loans</h1>}
    >
      <CreateLoanForm />
    </PageContainer>
  );
}