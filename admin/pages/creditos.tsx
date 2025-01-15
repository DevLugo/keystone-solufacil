/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo } from 'react';
import { gql, useQuery, useMutation } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { DatePicker, Select, TextInput } from '@keystone-ui/fields';
import { FaTrash } from 'react-icons/fa'; // Import the trash icon

const GET_LOANS = gql`
  query GetLoans {
    loans {
      id
      weeklyPaymentAmount
      requestedAmount
      amountGived
      amountToPay
      pendingAmount
      totalProfitAmount
      signDate
      finishedDate
      loanLeadId
      createdAt
      updatedAt
      borrower {
        personalData {
          fullName
          phones {
            number
          }
        }
      }
      avals {
        fullName
        phones {
          number
        }
      }
      previousLoan {
        id
        pendingAmount
        borrower {
          personalData {
            fullName
          }
        }
      }
    }
  }
`;

const GET_LOAN_TYPES = gql`
  query GetLoanTypes {
    loantypes {
      id
      name
      rate
      weekDuration
    }
  }
`;

const GET_LEADS = gql`
  query GetLeads {
    employees {
      id
      name
      type
    }
  }
`;

const CREATE_LOAN = gql`
  mutation CreateLoan($data: LoanCreateInput!) {
    createLoan(data: $data) {
      id
    }
  }
`;

type Loan = {
  id: string;
  weeklyPaymentAmount: string;
  requestedAmount: string;
  amountGived: string;
  amountToPay: string;
  pendingAmount: string;
  totalProfitAmount: string;
  signDate: string;
  firstPaymentDate: string;
  finishedDate: string;
  loanLeadId: string;
  createdAt: string;
  updatedAt: string;
  loantype: { id: string; name: string }; 
  borrower: {
    personalData: {
      fullName: string
      phones: Array<{ number: string }>
    }
  }
  avals: Array<{
      fullName: string
      phones: Array<{ number: string }>
  }>
  previousLoan: {
    id: string;
    pendingAmount: string;
    borrower: {
      personalData: {
        fullName: string
        phones: Array<{ number: string }>
      }
    }
  }
};

type LoanType = {
  id: string;
  name: string;
  weekDuration: number;
  rate: string;
};

type Option = {
  value: string;
  label: string;
};

function CreateLoanForm() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newLoans, setNewLoans] = useState<Loan[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const { data: loansData, loading: loansLoading, error: loansError } = useQuery<{ loans: Loan[] }>(GET_LOANS);
  const { data: loanTypesData, loading: loanTypesLoading, error: loanTypesError } = useQuery<{ loantypes: LoanType[] }>(GET_LOAN_TYPES);
  const { data: leadsData, loading: leadsLoading, error: leadsError } = useQuery<{ employees: Lead[] }>(GET_LEADS);
  const [selectedLead, setSelectedLead] = useState<Option | null>(null);
  
  const [createLoan, { error: loanError, loading: loanLoading }] = useMutation(CREATE_LOAN);
  const router = useRouter();

  useEffect(() => {
    if (loansData) {
      setLoans(loansData.loans);
    }
  }, [loansData]);

  const handleAddLoan = () => {
    setNewLoans([
      ...newLoans,
      {
        id: '',
        weeklyPaymentAmount: '',
        requestedAmount: '',
        amountGived: '',
        amountToPay: '',
        pendingAmount: '0',
        totalProfitAmount: '0',
        signDate: '',
        firstPaymentDate: '',
        finishedDate: '',
        loanLeadId: '',
        createdAt: '',
        updatedAt: '',
        loantype: { id: '', name: '' },
        borrower: {
          personalData: {
            fullName: '',
            phones: [
              {
                number: ''
              }
            ]
          }
        },
        avals: [
          {
            fullName: '',
            phones: [
              {
                number: ''
              }
            ]
          }
        ],
        previousLoan: {
          id: '',
          pendingAmount: '0',
          borrower: {
            personalData: {
              fullName: '',
              phones: [
                {
                  number: ''
                }
              ]
            }
          },
        }
      }
    ]);
  };

  const handleRemoveLoan = (index: number) => {
    const updatedLoans = newLoans.filter((_, i) => i !== index);
    setNewLoans(updatedLoans);
  };

  const handleChange = (index: number, field: keyof Loan, value: string) => {
    const updatedLoans = [...newLoans];
    updatedLoans[index] = { ...updatedLoans[index] }; // Create a shallow copy of the loan object
    if (field === 'loantype') {
      updatedLoans[index][field] = { id: value, name: loanTypesData?.loantypes.find(type => type.id === value)?.name || '' };
    } else {
      if (field === 'borrower') {
        updatedLoans[index][field] = { personalData: { fullName: value, phones: [{ number: '' }] } };
      }else if(field === 'previousLoan') {
        const previousLoan = loans.find(loan => loan.id === value);

        console.log("///////", previousLoan?.pendingAmount);
        updatedLoans[index][field] = {
          id: value, 
          pendingAmount: previousLoan?.pendingAmount === undefined ? '0' : previousLoan.pendingAmount,
          borrower: previousLoan?.borrower || { personalData: { fullName: '', phones: [{ number: '' }] } }
        };
        updatedLoans[index].pendingAmount = previousLoan?.pendingAmount === undefined ? '0' : previousLoan.pendingAmount;

        console.log(updatedLoans)
        console.log("///////", previousLoan?.borrower?.personalData?.fullName);
        console.log("///////", previousLoan?.borrower?.personalData?.phones[0]?.number);
        updatedLoans[index].borrower = { 
          ...updatedLoans[index].borrower, 
          personalData: { 
            ...updatedLoans[index].borrower.personalData, 
            fullName: previousLoan?.borrower?.personalData?.fullName || '', 
            phones: previousLoan?.borrower?.personalData?.phones || [{ number: '' }] 

          } 
        };
        // Assuming you have fields for aval name and phone number
        updatedLoans[index].avals = previousLoan?.avals.map(aval => ({
          fullName: aval.fullName,
          phones: aval.phones
        })) || [{ fullName: '', phones: [{ number: '' }] }];
      }else if(field === 'requestedAmount') {
        updatedLoans[index][field] = value;
        updatedLoans[index].amountGived = value;
        //updatedLoans[index].amountToPay = (Number(value) * 1.2).toString();
        if (updatedLoans[index].loantype.id) {
          const selectedLoanType = loanTypesData?.loantypes.find(type => type.id === updatedLoans[index].loantype.id);
          if (selectedLoanType) {
            const amountToPay = (1 + parseFloat(selectedLoanType.rate)) * parseFloat(value);
            updatedLoans[index].amountToPay = amountToPay.toString();
            updatedLoans[index].amountGived = amountToPay.toString();
            const previousLoan = loans.find(loan => loan.id === value);
            if(previousLoan) {
              updatedLoans[index].amountGived = (amountToPay - parseFloat(previousLoan.pendingAmount)).toString();
              //updatedLoans[index].pendingAmount = previousLoan.pendingAmount;
            }

          }
        }
      }
    }
    console.log(updatedLoans);
    setNewLoans(updatedLoans);
  };

  const handleDateChange = (value: string) => {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      setSelectedDate(date);
    } else {
      setSelectedDate(null);
    }
  };

  const handleSubmit = async () => {
    for (const loan of loans) {
      await createLoan({ variables: { data: loan } });
    }

    alert('Loans created successfully!');
    router.push('/loans');
  };

  const totalAmount = useMemo(() => {
    return newLoans.reduce((sum, loan) => sum + parseFloat(loan.amountToPay || '0'), 0);
  }, [newLoans]);

  if (loansLoading || loanTypesLoading) return <LoadingDots label="Loading data" size="large" />;
  if (loansError) return <p>Error loading loans: {loansError.message}</p>;
  if (loanTypesError) return <p>Error loading loan types: {loanTypesError.message}</p>;

  return (
    <Box paddingTop="xlarge">
      {loanError && (
        <GraphQLErrorNotice
          networkError={loanError?.networkError}
          errors={loanError?.graphQLErrors}
        />
      )}
      <Box marginBottom="large" style={{ display: 'flex', alignItems: 'center' }}>
        <Box marginRight="medium" style={{ flex: 1 }}>
          <label>Select Date</label>
          <DatePicker
            value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''} // Convertir la fecha a cadena en formato YYYY-MM-DD
            onUpdate={(value: string) => handleDateChange(value)} // Usar onUpdate con un valor de tipo string
            onClear={() => handleDateChange('')} // Usar handleDateChange con una cadena vacía
          />
        </Box>
        <Box style={{ flex: 1 }} marginRight="medium">
          <label>Select Lead</label>
          <Select
            options={leadsData?.employees?.filter(employee => employee.type === 'LEAD')?.map(lead => ({ value: lead.id, label: lead.name })) || []}
            isLoading={leadsLoading}
            value={selectedLead}
            onChange={option => {
              if (option) {
                setSelectedLead(option);
              }
            }}
          />
        </Box>
      </Box>
      <Box
        style={{
          position: 'sticky',
          top: '10px',
          backgroundColor: '#f9f9f9',
          border: '1px solid #ddd',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          marginBottom: '20px',
        }}
      >
        <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 'bold' }}>Resumen de Préstamos</h2>
        <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
          <strong>Total Amount to Pay:</strong> {totalAmount.toFixed(2)}
        </p>
      </Box>
      <Box>

      <table style={{ overflow: 'visible' }}>
          <thead>
            <tr>
              <th style={{ width: '150px' }}>Prestamo Previo</th>
              <th style={{ width: '400px' }}>Tipo Prestamo</th>
              <th style={{ width: '370px' }}>Nombre</th>
              <th>Cantidad Solicitada</th>
              <th>Cantidad Entregada</th>
              <th>Cantidad a pagar</th>
              <th style={{ width: '150px' }}>Deuda Previa</th>
              <th style={{ width: '300px' }}>Nombre Aval</th>
              <th style={{ width: '230px' }}>Telefono Aval</th>
              <th style={{ width: '230px' }}>Telefono Titular</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {newLoans.map((loan, index) => (
              <tr key={index}>
                <td style={{ width: '400px' }}>
                <Select
                    options={loansData?.loans.map(loan => ({ value: loan.id, label: `${loan.borrower?.personalData?.fullName} (${loan.pendingAmount})` })) || []}
                    value={
                      loan.previousLoan?.id
                        ? { value: loan.previousLoan.id, label: `${loan.previousLoan.borrower.personalData.fullName} ($${loan.previousLoan.pendingAmount})` }
                        : null
                    }
                    onChange={(option) => handleChange(index, 'previousLoan', (option as Option).value)}

                  />
                </td>
                <td>
                  <Select
                    options={loanTypesData?.loantypes.map(type => ({ value: type.id, label: type.name })) || []}
                    value={loan.loantype ? { value: loan.loantype.id, label: loan.loantype.name } : null}
                    onChange={(option) => handleChange(index, 'loantype', (option as Option).value)}
                  />
                </td>
                <td style={{ width: '200px' }}>
                  <TextInput value={loan.borrower.personalData.fullName} onChange={(e) => handleChange(index, 'borrower', e.target.value)} />
                </td>
                <td>
                  <TextInput value={loan.requestedAmount} onChange={(e) => handleChange(index, 'requestedAmount', e.target.value)} />
                </td>
                <td>
                  <TextInput value={loan.amountGived} onChange={(e) => handleChange(index, 'amountGived', e.target.value)} 
                    readOnly style={{ backgroundColor: '#f0f0f0', color: '#888' }}
                  />
                </td>
                <td>
                  <TextInput value={loan.amountToPay} onChange={(e) => handleChange(index, 'amountToPay', e.target.value)} 
                    readOnly style={{ backgroundColor: '#f0f0f0', color: '#888' }}
                    />
                </td>
                
                <td>
                  <TextInput value={loan.pendingAmount} 
                    readOnly style={{ backgroundColor: '#f0f0f0', color: '#888' }}
                  />
                </td>
                <td>
                  <TextInput value={loan.avals[0]?.fullName} onChange={(e) => handleChange(index, 'avals', e.target.value)} />
                </td>
                <td>
                  <TextInput value={loan.avals[0]?.phones[0]?.number} onChange={(e) => handleChange(index, 'avals', e.target.value)} />
                </td>
                <td>
                  <TextInput value={loan.borrower?.personalData?.phones[0]?.number} onChange={(e) => handleChange(index, 'borrower', e.target.value)} />
                </td>
                <td>
                <Button onClick={() => handleRemoveLoan(index)}><FaTrash /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <Box marginTop="large">
        <Button onClick={handleAddLoan}>Add Another Loan</Button>
        <Button isLoading={loanLoading} weight="bold" tone="active" onClick={handleSubmit} style={{ marginLeft: '10px' }}>
          Submit Loans
        </Button>
      </Box>
    </Box>
  );
}

export default function LoanPage() {
  return (
    <PageContainer
      title="Add Multiple Loans"
      header={<h1>Create Loans</h1>}
    >
      <CreateLoanForm />
    </PageContainer>
  );
}