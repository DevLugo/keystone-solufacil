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
import { FaTrash } from 'react-icons/fa'; // Import the trash icon
import './creditos.css';


const UPDATE_PERSONAL_DATA = gql`
  mutation UpdatePersonalData($where: PersonalDataWhereUniqueInput!, $data: PersonalDataUpdateInput!) {
    updatePersonalData(where: $where, data: $data) {
      id
    }
  }
`;

const GET_LOANS = gql`
  query GetLoans($leadId: ID!) {
    loans(where: { lead: { id: { equals: $leadId } } }) {
      id
      weeklyPaymentAmount
      requestedAmount
      amountGived
      amountToPay
      pendingAmount
      signDate
      finishedDate
      createdAt
      updatedAt
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            number
          }
        }
      }
      avalName
      avalPhone
      previousLoan {
        id
        pendingAmount
        avalName
        avalPhone
        borrower {
          id
          personalData {
            fullName
          }
        }
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

const CREATE_LOAN = gql`
  mutation CreateLoan($data: LoanCreateInput!) {
    createLoan(data: $data) {
      id
    }
  }
`;

type PhoneCreateInput = {
  create: { number: string }[] | null;
};

type PersonalDataCreateInput = {
  create: {
    phones: PhoneCreateInput;
    fullName: string | null;
  };
};

type BorrowerCreateOrConnectInput = {
  create?: {
    email?: string | null;
    personalData: PersonalDataCreateInput;
  } | null;
  connect?: { id: string } | null;
};

type LoanCreateInput = {
  weeklyPaymentAmount: string
  requestedAmount: string
  amountToPay: string
  amountGived: string
  loantype: { connect: { id: string } }
  signDate: Date
  avalName: string
  avalPhone: string
  grantor?: { connect: { id: string } }
  lead: { connect: { id: string } }
  borrower: BorrowerCreateOrConnectInput
  previousLoan?: { connect: { id: string } }
  comissionAmount: string
};


type Loan = {
  id: string;
  weeklyPaymentAmount: string;
  requestedAmount: string;
  amountGived: string;
  amountToPay: string;
  pendingAmount: string;
  /* totalProfitAmount: string; */
  signDate: string;
  firstPaymentDate: string;
  finishedDate: string;
  createdAt: string;
  updatedAt: string;
  loantype: LoanType; 
  lead: {
    connect: {
      id: string
    }
  };
  borrowerPhone: string;
  borrower: {
    id: string;
    personalData: {
      id: string;
      fullName: string
      phones: Array<{ number: string }>
    }
  }
  comission: string;
  avalName: string;
  avalPhone: string;
  previousLoan: {
    id: string;
    pendingAmount: string;
    avalName: string;
    avalPhone: string;
    borrower: {
      id: string;
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
type Lead = {
  id: string;
  personalData: {
    fullName: string;
  }
  type: string;
};
type Route = {
  name: string;
  id: string;
};

function CreateLoanForm() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newLoans, setNewLoans] = useState<Loan[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLead, setSelectedLead] = useState<Option | null>(null);
  const { data: loansData, loading: loansLoading, error: loansError } = useQuery(GET_LOANS, {
    variables: { leadId: selectedLead?.value || '' },
    skip: !selectedLead,
  });
  const { data: loanTypesData, loading: loanTypesLoading, error: loanTypesError } = useQuery<{ loantypes: LoanType[] }>(GET_LOAN_TYPES);
  const [getLeads, { data: leadsData, loading: leadsLoading, error: leadsError }] = useLazyQuery<{ employees: Lead[] }>(GET_LEADS);
  const [comission, setComission] = useState<number>(8);
  const [updatePersonalData] = useMutation(UPDATE_PERSONAL_DATA);

  const [createLoan, { error: loanError, loading: loanLoading }] = useMutation<LoanCreateInput>(CREATE_LOAN);
  const router = useRouter();
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Option | null>(null);


  const { data: routesData, loading: routesLoading, error: routesError } = useQuery<{ routes: Route[] }>(GET_ROUTES, {
      variables: { where: { } },
    });

  useEffect(() => {
    if (loansData) {
      // Crear una copia del array antes de ordenarlo
    const loansCopy = [...loansData.loans];

    // Ordenar los préstamos por fecha de signDate en orden descendente
    const sortedLoans = loansCopy.sort((a, b) => new Date(a.signDate).getTime() - new Date(b.signDate).getTime());

    // Agrupar los préstamos por borrowerId, manteniendo solo el último préstamo
    const groupedLoans = sortedLoans.reduce((acc, loan) => {
      acc[loan.borrower.id] = loan;
      return acc;
    }, {} as { [key: string]: Loan });

    const uniqueLoans:Loan[] = Object.values(groupedLoans);

    console.log("grouped loans" ,groupedLoans);
    console.log("unique loans" ,uniqueLoans);
    console.log(loansData.loans);
    setLoans(uniqueLoans);
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
        /* totalProfitAmount: '0', */
        signDate: '',
        firstPaymentDate: '',
        finishedDate: '',
        createdAt: '',
        updatedAt: '',
        loantype: { id: '', name: '', weekDuration: 0, rate: '' },
        lead: { connect: { id: '' }},
        borrowerPhone: '',
        borrower: {
          id: '',
          personalData: {
            id: '',
            fullName: '',
            phones: [
              {
                number: ''
              }
            ]
          }
        },
        avalName: '',
        avalPhone: '',
        previousLoan: {
          id: '',
          pendingAmount: '0',
          avalName: '',
          avalPhone: '',
          borrower: {
            id: '',
            personalData: {
              fullName: '',
              phones: [
                {
                  number: ''
                }
              ]
            }
          },
        },
        comission: comission.toString()
      }
    ]);
  };

  const handleRemoveLoan = (index: number) => {
    const updatedLoans = newLoans.filter((_, i) => i !== index);
    setNewLoans(updatedLoans);
  };

  const handleChange = (index: number, field: keyof Omit<Loan, 'lead'>, value: string) => {
    const updatedLoans = [...newLoans];
    updatedLoans[index] = { ...updatedLoans[index] }; // Create a shallow copy of the loan object
    if (field === 'loantype') {
      updatedLoans[index][field] = {
        id: value,
        name: loanTypesData?.loantypes.find(type => type.id === value)?.name || '' ,
        weekDuration: loanTypesData?.loantypes.find(type => type.id === value)?.weekDuration || 0,
        rate: loanTypesData?.loantypes.find(type => type.id === value)?.rate || ''
      };
    } else {
      if (field === 'borrower') {
        updatedLoans[index].borrower = { 
          ...updatedLoans[index].borrower, 
          personalData: { 
            ...updatedLoans[index].borrower.personalData, 
            fullName: value 
          } 
        };
      } else if (field === 'borrowerPhone') {
        updatedLoans[index].borrower = { 
          ...updatedLoans[index].borrower, 
          personalData: { 
            ...updatedLoans[index].borrower.personalData, 
            phones: [{ number: value }] 
          } 
        };
      
      }else if (field === 'previousLoan' && value === '') {
          updatedLoans[index].previousLoan = {
            id: '',
            pendingAmount: '0',
            avalName: '',
            avalPhone: '',
            borrower: {
              id: '',
              personalData: {
                fullName: '',
                phones: [{ number: '' }]
              }
            }
          };
          updatedLoans[index].amountGived = '';
          updatedLoans[index].amountToPay = '';
          updatedLoans[index].avalName = '';
          updatedLoans[index].avalPhone = '';
          updatedLoans[index].borrower = {
            id: '',
            personalData: {
              id: '',
              fullName: '',
              phones: [{ number: '' }]
            }
          };
        } else if (field === 'previousLoan') {
        const previousLoan = loans.find(loan => loan.id === value);
        updatedLoans[index]['borrower'] = {
          id: previousLoan?.borrower?.id || '',
          personalData: {
            id: previousLoan?.borrower?.personalData.id || '',
            fullName: previousLoan?.borrower?.personalData.fullName || '',
            phones: previousLoan?.borrower?.personalData.phones || [{ number: '' }]
          }
        };
        updatedLoans[index]['avalName'] = previousLoan?.avalName || '';
        updatedLoans[index]['avalPhone'] = previousLoan?.avalPhone || '';
        updatedLoans[index]['pendingAmount'] = previousLoan?.pendingAmount || '0';
        
        if (previousLoan) {
          updatedLoans[index]['previousLoan'] = previousLoan;
        }
        
        console.log("previoooooos", previousLoan)
        console.log("ACA ANDO", updatedLoans)
        
      }else if(field === 'requestedAmount') {
        updatedLoans[index][field] = value;
        updatedLoans[index].amountGived = value;
        //updatedLoans[index].amountToPay = (Number(value) * 1.2).toString();
        console.log("ACA ANDO1", field)
        if (updatedLoans[index].loantype.id) {
          console.log("ACA ANDO")
          const selectedLoanType = loanTypesData?.loantypes.find(type => type.id === updatedLoans[index].loantype.id);
          console.log("ACA ANDO88", updatedLoans[index], selectedLoanType)
          if (selectedLoanType) {
            const amountToPay = (1 + parseFloat(selectedLoanType.rate)) * parseFloat(value);
            updatedLoans[index].amountToPay = amountToPay.toString();
            updatedLoans[index].amountGived = amountToPay.toString();
            console.log("ACA ANDO2", value)
            const previousLoan = updatedLoans[index].previousLoan;
            console.log("ACA ANDO3", previousLoan)

            if(previousLoan) {
            console.log("ACA ANDO4")
              updatedLoans[index].amountGived = (parseFloat(updatedLoans[index].requestedAmount) - parseFloat(previousLoan.pendingAmount)).toString();
              updatedLoans[index].pendingAmount = previousLoan.pendingAmount;
            }

          }
        }
      }else{
        updatedLoans[index][field] = value;
        console.log("ACA ANDO5", updatedLoans[index][field]);
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
    console.log("handleSubmit");
    if (!selectedDate) {
      alert('Please select a date');
      return;
    }
    console.log("handleSubmit2");

    for (const loan of newLoans) {
      console.log("handleSubmit3");
      const weeklyPaymentAmount = parseFloat(loan.amountToPay) / loan.loantype.weekDuration;
      const loanData:LoanCreateInput =  {
        weeklyPaymentAmount: weeklyPaymentAmount.toString(),
        requestedAmount: loan.requestedAmount,
        amountToPay: loan.amountToPay,
        amountGived: loan.amountGived,
        loantype: { connect: { id: loan.loantype.id } },
        signDate: selectedDate,
        avalName: loan.avalName,
        avalPhone: loan.avalPhone,
        lead: { connect: { id: selectedLead?.value || '' }},
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
        comissionAmount: loan.comission.toString()
      }
      if (loan.previousLoan.id) {
        loanData.previousLoan = { connect: { id: loan.previousLoan.id } };
        // Verificar si los datos del aval o del titular han cambiado
      const previousLoan = loans.find(l => l.id === loan.previousLoan.id);
      if (
        loan.avalName !== previousLoan?.avalName ||
        loan.avalPhone !== previousLoan?.avalPhone ||
        loan.borrower.personalData.fullName !== previousLoan?.borrower.personalData.fullName ||
        loan.borrower.personalData.phones[0]?.number !== previousLoan?.borrower.personalData.phones[0]?.number
      ) {
        // Actualizar la información del borrower
        const updatePersonalDataInput = {
          where: { id: loan.borrower?.personalData?.id },
          data: {
            fullName: loan.borrower.personalData.fullName,
            phones: {
              create: loan.borrower.personalData.phones.map(phone => ({
                number: loan.borrower.personalData.phones[loan.borrower.personalData.phones.length - 1]?.number,
              })),
            },
          },
        };

        await updatePersonalData({ variables: updatePersonalDataInput });
      }
    }
      await createLoan({ variables: { data: loanData } });
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
            value={comission.toString()}
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

      <Box className="table">
        <div className="table-row table-header">
        <div className="table-cell fixed-width">Prestamo Previo</div>
  <div className="table-cell fixed-width">Tipo Prestamo</div>
  <div className="table-cell fixed-width">Nombre</div>
  <div className="table-cell fixed-width">Cantidad Solicitada</div>
  <div className="table-cell fixed-width">Cantidad Entregada</div>
  <div className="table-cell fixed-width">Cantidad a pagar</div>
  <div className="table-cell fixed-width">Deuda Previa</div>
  <div className="table-cell fixed-width">Nombre Aval</div>
  <div className="table-cell fixed-width">Telefono Aval</div>
  <div className="table-cell fixed-width">Telefono Titular</div>
  <div className="table-cell">Comision</div>
  <div className="table-cell"></div>
        </div>
        {newLoans.map((loan, index) => (
          <div key={index} className="table-row">
            <div className={`fixed-width table-cell input-cell ${focusedInput === `previousLoan-${index}` ? 'focused' : ''}`}>
              <Select
                options={[
                  { value: '', label: 'Seleccionar cliente' }, // Opción vacía
                  ...(loans.map(loan => ({ 
                    value: loan.id, 
                    label: `${loan.borrower?.personalData?.fullName} (${loan.pendingAmount})` 
                  })) || [])
                ]}
                value={
                  loan.previousLoan?.id
                    ? { value: loan.previousLoan.id, label: `${loan.previousLoan.borrower?.personalData?.fullName} ($${loan.previousLoan?.pendingAmount})` }
                    : { value: '', label: 'Seleccionar cliente' } // Valor por defecto
                }
                onChange={(option) => {
                  const selectedValue = (option as Option).value;
                  if (selectedValue === '') {
                    handleChange(index, 'previousLoan', ''); // Limpiar la selección
                  } else {
                    handleChange(index, 'previousLoan', selectedValue);
                  }
                }}
                onFocus={() => setFocusedInput(`previousLoan-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`fixed-width table-cell input-cell ${focusedInput === `loantype-${index}` ? 'focused' : ''}`}>
              <Select
                options={loanTypesData?.loantypes.map(type => ({ value: type.id, label: type.name })) || []}
                value={loan.loantype ? { value: loan.loantype.id, label: loan.loantype.name } : null}
                onChange={(option) => handleChange(index, 'loantype', (option as Option).value)}
                onFocus={() => setFocusedInput(`loantype-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`fixed-width table-cell input-cell ${focusedInput === `borrower-${index}` ? 'focused' : ''}`}>
              <TextInput 
                value={loan.borrower?.personalData.fullName}
                onChange={(e) => handleChange(index, 'borrower', e.target.value)}
                onFocus={() => setFocusedInput(`borrower-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`fixed-width table-cell input-cell ${focusedInput === `requestedAmount-${index}` ? 'focused' : ''}`}>
              <TextInput 
                value={loan.requestedAmount} 
                onChange={(e) => handleChange(index, 'requestedAmount', e.target.value)} 
                onFocus={() => setFocusedInput(`requestedAmount-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`fixed-width table-cell input-cell ${focusedInput === `amountGived-${index}` ? 'focused' : ''}`}>
              <TextInput 
                value={loan.amountGived} 
                onChange={(e) => handleChange(index, 'amountGived', e.target.value)} 
                readOnly 
                style={{ backgroundColor: '#f0f0f0', color: '#888' }}
                onFocus={() => setFocusedInput(`amountGived-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`fixed-width table-cell input-cell ${focusedInput === `amountToPay-${index}` ? 'focused' : ''}`}>
              <TextInput 
                value={loan.amountToPay} 
                onChange={(e) => handleChange(index, 'amountToPay', e.target.value)} 
                readOnly 
                style={{ backgroundColor: '#f0f0f0', color: '#888' }}
                onFocus={() => setFocusedInput(`amountToPay-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`fixed-width table-cell input-cell ${focusedInput === `pendingAmount-${index}` ? 'focused' : ''}`}>
              <TextInput 
                value={loan.pendingAmount} 
                onChange={(e) => handleChange(index, 'pendingAmount', e.target.value)} 
                readOnly 
                style={{ backgroundColor: '#f0f0f0', color: '#888' }}
                onFocus={() => setFocusedInput(`pendingAmount-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`fixed-width table-cell input-cell ${focusedInput === `avalName-${index}` ? 'focused' : ''}`}>
              <TextInput 
                value={loan.avalName} 
                onChange={(e) => handleChange(index, 'avalName', e.target.value)} 
                onFocus={() => setFocusedInput(`avalName-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`fixed-width table-cell input-cell ${focusedInput === `avalPhone-${index}` ? 'focused' : ''}`}>
              <TextInput 
                value={loan.avalPhone} 
                onChange={(e) => handleChange(index, 'avalPhone', e.target.value)} 
                onFocus={() => setFocusedInput(`avalPhone-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`fixed-width table-cell input-cell ${focusedInput === `borrowerPhone-${index}` ? 'focused' : ''}`}>
              <TextInput 
                value={loan.borrower?.personalData?.phones[loan.borrower.personalData.phones.length - 1]?.number || ''} 
                onChange={(e) => handleChange(index, 'borrowerPhone', e.target.value)}
                onFocus={() => setFocusedInput(`borrowerPhone-${index}`)}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div className={`table-cell input-cell ${focusedInput === `borrowerPhone-${index}` ? 'focused' : ''}`}>
              <TextInput 
                defaultValue={comission.toString()}
                onChange={(e) => handleChange(index, 'comission', e.target.value)}
              />
            </div>
            <div className="table-cell">
              <Button onClick={() => handleRemoveLoan(index)}><FaTrash /></Button>
            </div>
          </div>
        ))}
      </Box>
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