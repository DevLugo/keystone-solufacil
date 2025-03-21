/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { useRouter } from 'next/router';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { TextInput } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { gql } from '@apollo/client';

// Import types
import type { 
  Loan, 
  LoanType, 
  LoanCreateInput
} from '../types/loan';
import type { Option, Route, Employee } from '../types/transaction';

// Import components
import { LoanListView } from '../components/loans/LoanListView';

// Import GraphQL queries and mutations
import { GET_LOAN_TYPES } from '../graphql/queries/loantypes';
import { CREATE_LOAN as CREATE_LOAN_MUTATION, UPDATE_PERSONAL_DATA as UPDATE_PERSONAL_DATA_MUTATION } from '../graphql/mutations/loans';

import './creditos.css';

interface CreditosProps {
  selectedDate: Date | null;
  selectedRoute: Route | null;
  selectedLead: Employee | null;
}

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

interface Phone {
  id: string;
  number: string;
}

interface FormState {
  newLoans: ExtendedLoan[];
  loans: Loan[];
  comission: string;
  focusedInput: string | null;
  editedLoans: { [key: string]: Loan };
  expandedSection: 'existing' | 'new';
  successMessage: string | null;
  error: Error | null;
  isLoading: boolean;
}

const GET_LOANS = gql`
  query GetLoans($date: DateTime!, $nextDate: DateTime!, $leadId: ID!) {
    loans(
      where: {
        AND: [
          { signDate: { gte: $date } }
          { signDate: { lt: $nextDate } }
          { lead: { id: { equals: $leadId } } }
          { finishedDate: { equals: null } }
        ]
      }
    ) {
      id
      requestedAmount
      amountGived
      amountToPay
      pendingAmount
      signDate
      finishedDate
      createdAt
      updatedAt
      comissionAmount
      loantype {
        id
        name
        rate
        weekDuration
        __typename
      }
      lead {
        id
        personalData {
          fullName
          __typename
        }
        __typename
      }
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            number
            __typename
          }
          __typename
        }
        __typename
      }
      previousLoan {
        id
        pendingAmount
        avalName
        avalPhone
        borrower {
          id
          personalData {
            fullName
            phones {
              number
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const UPDATE_LOAN_MUTATION = gql`
  mutation UpdateLoan($id: ID!, $data: LoanUpdateInput!) {
    updateLoan(where: { id: $id }, data: $data) {
      id
      requestedAmount
      amountGived
      avalName
      avalPhone
      comissionAmount
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            id
            number
          }
        }
      }
      loantype {
        id
        name
        rate
      }
      previousLoan {
        id
        pendingAmount
      }
    }
  }
`;

const CreateLoanForm = ({ selectedDate, selectedRoute, selectedLead }: CreditosProps) => {
  const [state, setState] = useState<FormState>({
    newLoans: [],
    loans: [],
    comission: '',
    focusedInput: null,
    editedLoans: {},
    expandedSection: 'existing',
    successMessage: null,
    error: null,
    isLoading: false
  });

  const updateState = useCallback((updates: Partial<FormState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const { 
    newLoans, 
    loans, 
    comission, 
    focusedInput, 
    editedLoans, 
    expandedSection, 
    successMessage, 
    error, 
    isLoading 
  } = state;

  const setIsLoading = useCallback((value: boolean) => {
    updateState({ isLoading: value });
  }, [updateState]);

  const setError = useCallback((message: string | null) => {
    updateState({ error: message ? new Error(message) : null });
  }, [updateState]);

  const setSuccessMessage = useCallback((message: string | null) => {
    updateState({ successMessage: message });
  }, [updateState]);

  const setEditedLoans = useCallback((updater: (prev: { [key: string]: Loan }) => { [key: string]: Loan }) => {
    updateState({ editedLoans: updater(editedLoans) });
  }, [updateState, editedLoans]);

  const toggleSection = (section: 'existing' | 'new') => {
    updateState({
      expandedSection: section
    });
  };

  const { data: loansData, loading: loansLoading, error: loansError } = useQuery(GET_LOANS, {
    variables: { 
      leadId: selectedLead?.id || '',
      date: selectedDate?.toISOString().split('T')[0] + 'T00:00:00.000Z',
      nextDate: selectedDate ? new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 60000).toISOString() : ''
    },
    skip: !selectedLead || !selectedDate,
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

  const loanTypeOptions = useMemo(() => {
    return [
      { value: '', label: 'Seleccionar tipo de préstamo' },
      ...(loanTypesData?.loantypes?.map(type => ({
        value: type.id,
        label: `${type.name} (${type.weekDuration} semanas - ${type.rate}%)`,
      })) || [])
    ];
  }, [loanTypesData]);

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

  const [updatePersonalData] = useMutation(UPDATE_PERSONAL_DATA_MUTATION);
  const [createLoan, { error: loanError, loading: loanLoading }] = useMutation(CREATE_LOAN_MUTATION);
  const [updateLoan, { loading: updateLoading }] = useMutation(UPDATE_LOAN_MUTATION);
  const router = useRouter();

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
      lead: selectedLead ? { connect: { id: selectedLead.id }} : undefined,
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

  const handleEditExistingLoan = useCallback(async (loanId: string, field: string, value: string) => {
    try {
      setIsLoading(true);
      const loan = editedLoans[loanId] || loans.find(l => l.id === loanId);
      if (!loan) return;

      // Primero actualizamos el estado local
      const updatedLoan = {
        ...loan,
        [field]: value
      };

      setEditedLoans(prev => ({
        ...prev,
        [loanId]: updatedLoan
      }));

      let updateData: any = {};

      if (field === 'borrowerName' || field === 'borrowerPhone') {
        // Actualizar datos personales del prestatario
        const phoneId = loan.borrower?.personalData?.phones?.[0]?.id;
        if (!phoneId) {
          throw new Error('No se encontró el ID del teléfono');
        }

        updateData = {
          borrower: {
            connect: {
              id: loan.borrower.id
            }
          }
        };

        // Actualizar los datos personales
        await updatePersonalData({
          variables: {
            where: { id: loan.borrower.personalData.id },
            data: {
              fullName: field === 'borrowerName' ? value : loan.borrower.personalData.fullName,
              phones: {
                update: {
                  where: { id: phoneId },
                  data: { number: field === 'borrowerPhone' ? value : loan.borrower.personalData.phones[0].number }
                }
              }
            }
          }
        });
      } else {
        // Actualizar campos normales del préstamo
        updateData = {
          [field]: value
        };
      }

      // Asegurarnos de que comissionAmount sea un número válido
      if (field === 'comissionAmount') {
        updateData.comissionAmount = value ? parseFloat(value) : 0;
      }

      const { data } = await updateLoan({
        variables: {
          id: loanId,
          data: updateData
        }
      });

      if (data?.updateLoan) {
        setEditedLoans(prev => ({
          ...prev,
          [loanId]: data.updateLoan
        }));
        setSuccessMessage('Préstamo actualizado exitosamente');
        setTimeout(() => setSuccessMessage(''), 2000);
      }
    } catch (err: unknown) {
      console.error('Error al actualizar el préstamo:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar el préstamo');
    } finally {
      setIsLoading(false);
    }
  }, [editedLoans, loans, updateLoan, updatePersonalData, setIsLoading, setError, setSuccessMessage, setEditedLoans]);

  const handleSubmit = async () => {
    if (!selectedDate) {
      alert('Please select a date');
      return;
    }

    if (!selectedLead?.id) {
      alert('Please select a lead');
      return;
    }

    try {
      // Crear nuevos préstamos
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
          lead: { connect: { id: selectedLead.id }},
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
          comissionAmount: comission ? parseFloat(comission).toFixed(2) : "0.00"
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

      // Actualizar préstamos existentes
      for (const [id, loan] of Object.entries(editedLoans)) {
        await updateLoan({
          variables: {
            id,
            data: {
              requestedAmount: loan.requestedAmount,
              amountGived: loan.amountGived,
              avalName: loan.avalName,
              avalPhone: loan.avalPhone,
              comissionAmount: comission ? parseFloat(comission).toFixed(2) : "0.00",
              borrower: {
                connect: {
                  id: loan.borrower.id
                }
              }
            }
          }
        });
      }

      // Mostrar mensaje de éxito
      updateState({ successMessage: 'Cambios guardados exitosamente' });
      setTimeout(() => updateState({ successMessage: null }), 2000);

      // Limpiar el estado
      updateState({ newLoans: [], editedLoans: {} });
    } catch (error) {
      console.error('Error saving loans:', error);
      alert('Error saving loans. Please check the console for details.');
    }
  };

  const totalAmount = useMemo(() => {
    return newLoans.reduce((sum, loan) => sum + parseFloat(loan.amountToPay || '0'), 0);
  }, [newLoans]);

  if (loansLoading) {
    return <LoadingDots label="Loading loans" size="large" />;
  }

  if (loansError) return <GraphQLErrorNotice errors={loansError?.graphQLErrors || []} networkError={loansError?.networkError} />;
  if (loanTypesError) return <GraphQLErrorNotice errors={loanTypesError?.graphQLErrors || []} networkError={loanTypesError?.networkError} />;

  return (
    <Box paddingTop="xlarge">
      {error && (
        <GraphQLErrorNotice
          networkError={error}
        />
      )}
      {successMessage && (
        <Box
          marginBottom="large"
          padding="medium"
          style={{
            backgroundColor: '#d1fae5',
            color: '#065f46',
            borderRadius: '4px',
            textAlign: 'center'
          }}
        >
          {successMessage}
        </Box>
      )}
      <Box marginBottom="large" paddingX="none">
        <Box style={{ display: 'flex', gap: '2px', alignItems: 'flex-start' }}>
          <Box style={{ flex: 0.5 }}>
            <div className="form-group">
              <label>Comisión</label>
              <div>
                <TextInput 
                  type="number"
                  value={comission}
                  onChange={(e) => updateState({ comission: e.target.value })}
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
            isLoading={loanLoading}
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
        {loansLoading ? (
          <Box padding="xlarge" style={{ display: 'flex', justifyContent: 'center' }}>
            <LoadingDots label="Loading loans" size="large" />
          </Box>
        ) : (
          <>
            {/* Sección de Préstamos Existentes */}
            <Box
              style={{
                padding: '16px',
                borderBottom: '1px solid #e1e1e1',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f9fafb',
              }}
              onClick={() => toggleSection('existing')}
            >
              <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  Préstamos Existentes ({loans.length})
                </h3>
                <span>{expandedSection === 'existing' ? '▼' : '▶'}</span>
              </Box>
            </Box>
            {expandedSection === 'existing' && (
              <Box padding="medium">
                <LoanListView
                  loans={[]}
                  existingLoans={loans}
                  editedLoans={editedLoans}
                  loanTypes={loanTypesData?.loantypes || []}
                  loanTypeOptions={loanTypeOptions}
                  previousLoanOptions={previousLoanOptions}
                  loading={loanLoading}
                  error={loansError || loanTypesError || null}
                  onRemoveLoan={handleRemoveLoan}
                  onEditLoan={handleEditLoan}
                  onEditExistingLoan={handleEditExistingLoan}
                  focusedInput={focusedInput}
                />
              </Box>
            )}

            {/* Sección de Nuevos Préstamos */}
            <Box
              style={{
                padding: '16px',
                borderBottom: '1px solid #e1e1e1',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f9fafb',
              }}
              onClick={() => toggleSection('new')}
            >
              <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  Nuevos Préstamos ({newLoans.length})
                </h3>
                <span>{expandedSection === 'new' ? '▼' : '▶'}</span>
              </Box>
            </Box>
            {expandedSection === 'new' && (
              <Box padding="medium">
                <LoanListView
                  loans={newLoans}
                  existingLoans={[]}
                  editedLoans={{}}
                  loanTypes={loanTypesData?.loantypes || []}
                  loanTypeOptions={loanTypeOptions}
                  previousLoanOptions={previousLoanOptions}
                  loading={loanLoading}
                  error={loansError || loanTypesError || null}
                  onRemoveLoan={handleRemoveLoan}
                  onEditLoan={handleEditLoan}
                  onEditExistingLoan={handleEditExistingLoan}
                  focusedInput={focusedInput}
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {(newLoans.length > 0 || Object.keys(editedLoans).length > 0) && (
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
            onClick={() => updateState({ newLoans: [], editedLoans: {} })}
            style={{ padding: '8px 24px', minWidth: '150px' }}
            isLoading={loanLoading}
          >
            Limpiar Cambios
          </Button>
          <Button
            tone="positive"
            weight="bold"
            onClick={handleSubmit}
            isLoading={loanLoading}
            style={{ padding: '8px 24px', minWidth: '150px' }}
          >
            Guardar Cambios
          </Button>
        </Box>
      )}
    </Box>
  );
};

export { CreateLoanForm };