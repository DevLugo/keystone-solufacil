/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Box, jsx, Stack } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput, Select } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { FaPlus, FaTrash, FaEdit, FaSearch, FaEllipsisV, FaCheck, FaTimes } from 'react-icons/fa';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { calculateLoanAmounts } from '../../utils/loanCalculations';
import { GET_ROUTE } from '../../graphql/queries/routes';

// Import types
import type { Loan } from '../../types/loan';
import { calculateAmountToPay, calculatePendingAmountSimple, processLoansWithCalculations } from '../../utils/loanCalculations';

// OPTIMIZADA: SIN campos virtuales costosos
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
      orderBy: { signDate: desc }
    ) {
      id
      requestedAmount
      amountGived
      signDate
      finishedDate
      createdAt
      updatedAt
      comissionAmount
      avalName
      avalPhone
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
            id
            number
            __typename
          }
          __typename
        }
        __typename
      }
      previousLoan {
        id
        requestedAmount
        amountGived
        profitAmount
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

const CREATE_LOAN = gql`
  mutation CreateLoan($data: LoanCreateInput!) {
    createLoan(data: $data) {
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
      avalName
      avalPhone
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
            id
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

const UPDATE_LOAN = gql`
  mutation UpdateLoan($where: LoanWhereUniqueInput!, $data: LoanUpdateInput!) {
    updateLoan(where: $where, data: $data) {
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
      avalName
      avalPhone
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
            id
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

const DELETE_LOAN = gql`
  mutation DeleteLoan($where: LoanWhereUniqueInput!) {
    deleteLoan(where: $where) {
      id
      amountGived
      comissionAmount
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
      __typename
    }
  }
`;

const GET_PREVIOUS_LOANS = gql`
  query GetPreviousLoansOptimized($leadId: ID!) {
    loans(
      where: {
        AND: [
          { lead: { id: { equals: $leadId } } }
          { finishedDate: { equals: null } }
        ]
      }
      orderBy: { signDate: desc }
      take: 50
    ) {
      id
      requestedAmount
      amountGived
      signDate
      borrower {
        id
        personalData {
          fullName
        }
      }
      avalName
      avalPhone
      __typename
    }
  }
`;

interface CreditosTabProps {
  selectedDate: Date | null;
  selectedRoute: string | null;
  selectedLead: {
    id: string;
    type: string;
    personalData: {
      fullName: string;
      __typename: string;
    };
    __typename: string;
  } | null;
  onBalanceUpdate?: (balance: number) => void;
}

interface DropdownPortalProps {
  children: ReactNode;
  isOpen: boolean;
}

const DropdownPortal = ({ children, isOpen }: DropdownPortalProps) => {
  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: 9999,
    }}>
      {children}
    </div>,
    document.body
  );
};

export const CreditosTab = ({ selectedDate, selectedRoute, selectedLead, onBalanceUpdate }: CreditosTabProps) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [newLoan, setNewLoan] = useState<Partial<Loan>>({
    requestedAmount: '0',
    amountGived: '',
    amountToPay: '',
    pendingAmount: '0',
    signDate: selectedDate?.toISOString() || '',
    finishedDate: '',
    createdAt: '',
    updatedAt: '',
    comissionAmount: '0',
    avalName: '',
    avalPhone: '',
    loantype: { id: '', name: '', rate: '0', weekDuration: '0', __typename: 'LoanType' },
    lead: { id: selectedLead?.id || '', personalData: { fullName: '', __typename: 'PersonalData' }, __typename: 'Lead' },
    borrower: {
      id: '',
      personalData: {
        id: '',
        fullName: '',
        phones: [{ number: '', __typename: 'Phone' }],
        __typename: 'PersonalData'
      },
      __typename: 'Borrower'
    },
    previousLoan: undefined,
    __typename: 'Loan'
  });
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [newLoanId, setNewLoanId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeBalance, setRouteBalance] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const { data: routeData, loading: routeLoading, error: routeError, refetch: refetchRoute } = useQuery<{ route: Route }>(GET_ROUTE, {
    variables: { 
      where: { id: selectedRoute }
    },
    skip: !selectedRoute,
  });

  const { data: loansData, loading: loansLoading, error: loansError, refetch: refetchLoans } = useQuery<{ loans: Loan[] }>(GET_LOANS, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : '',
      nextDate: selectedDate ? new Date(new Date(selectedDate).setHours(24, 0, 0, 0)).toISOString() : '',
      leadId: selectedLead?.id || null
    },
    skip: !selectedDate || !selectedLead?.id,
  });

  const { data: previousLoansData, loading: previousLoansLoading, refetch: refetchPreviousLoans } = useQuery(GET_PREVIOUS_LOANS, {
    variables: { 
      leadId: selectedLead?.id || ''
    },
    skip: !selectedLead,
  });

  const { data: loanTypesData, loading: loanTypesLoading } = useQuery(GET_LOAN_TYPES);

  const loanTypeOptions = React.useMemo(() => {
    return loanTypesData?.loantypes?.map(type => ({
      label: `${type.name} (${type.weekDuration} semanas - ${type.rate}%)`,
      value: type.id
    })) || [];
  }, [loanTypesData]);

  const previousLoanOptions = React.useMemo(() => {
    const options = [
      { value: '', label: 'Seleccionar préstamo previo' }
    ];
    
    if (previousLoansData?.loans) {
      // Agrupar préstamos por borrower para obtener solo el más reciente de cada cliente
      const borrowerLoans = previousLoansData.loans.reduce((acc: { [key: string]: any }, loan: any) => {
        const borrowerId = loan.borrower?.id;
        if (!borrowerId) return acc;
        
        if (!acc[borrowerId] || new Date(loan.signDate) > new Date(acc[borrowerId].signDate)) {
          acc[borrowerId] = loan;
        }
        return acc;
      }, {});

      // Convertir a array y ordenar por nombre
      const sortedLoans = Object.values(borrowerLoans).sort((a: any, b: any) => {
        const nameA = a.borrower?.personalData?.fullName || '';
        const nameB = b.borrower?.personalData?.fullName || '';
        return nameA.localeCompare(nameB);
      });

      options.push(
        ...sortedLoans.map((loan: any) => ({
          value: loan.id,
          label: `${loan.borrower?.personalData?.fullName || 'Sin nombre'} ($${loan.pendingAmount || 0})`
        }))
      );
    }

    return options;
  }, [previousLoansData?.loans]);

  const handlePreviousLoanChange = (option: { value: string; label: string } | null) => {
    if (!option?.value) {
      setNewLoan(prev => ({
        ...prev,
        previousLoan: undefined,
        borrower: {
          id: '',
          personalData: {
            id: '',
            fullName: '',
            phones: [{ number: '', __typename: 'Phone' }],
            __typename: 'PersonalData'
          },
          __typename: 'Borrower'
        },
        avalName: '',
        avalPhone: '',
        pendingAmount: '0',
        amountGived: '',
        amountToPay: '',
        requestedAmount: '0'
      }));
      return;
    }

    const selectedLoan = previousLoansData?.loans?.find(loan => loan.id === option.value);
    if (selectedLoan) {
      console.log('Préstamo seleccionado completo:', selectedLoan);
      console.log('pendingAmount del préstamo seleccionado:', selectedLoan.pendingAmount);
      
      // Asegurarse de que pendingAmount sea un string
      const pendingAmount = selectedLoan.pendingAmount ? selectedLoan.pendingAmount.toString() : '0';
      
      console.log('Deuda pendiente convertida a string:', pendingAmount);

      // Crear una copia del préstamo seleccionado con los campos necesarios
      const previousLoan = {
        ...selectedLoan,
        pendingAmount,
        amountToPay: selectedLoan.amountToPay || '0'
      };

      console.log('Objeto previousLoan creado:', previousLoan);
      console.log('pendingAmount en previousLoan:', previousLoan.pendingAmount);

      // Calcular amountToPay para el nuevo préstamo
      let newLoanAmountToPay = '0';
      if (newLoan.loantype?.rate) {
        const rate = parseFloat(newLoan.loantype.rate);
        const requestedAmount = parseFloat(newLoan.requestedAmount || '0');
        if (!isNaN(rate) && !isNaN(requestedAmount)) {
          newLoanAmountToPay = (requestedAmount * (1 + rate)).toFixed(2);
        }
      }

      setNewLoan(prev => {
        const updatedLoan = {
          ...prev,
          previousLoan: {
            ...selectedLoan,
            pendingAmount,
            amountToPay: selectedLoan.loantype?.rate ? 
              (parseFloat(selectedLoan.requestedAmount) * (1 + parseFloat(selectedLoan.loantype.rate))).toFixed(2) : 
              '0'
          },
          borrower: selectedLoan.borrower,
          avalName: selectedLoan.avalName,
          avalPhone: selectedLoan.avalPhone,
          pendingAmount,
          amountToPay: newLoanAmountToPay
        };
        console.log('Nuevo estado de newLoan optimizado:', updatedLoan);
        return updatedLoan;
      });
    }
  };

  // Efecto para actualizar el estado de loans cuando cambien los datos
  useEffect(() => {
    if (loansData?.loans) {
      console.log('Loans data recibida:', loansData.loans);
      setLoans(loansData.loans);
    }
  }, [loansData]);

  // Efecto para actualizar el estado cuando cambie la fecha o el líder
  React.useEffect(() => {
    if (selectedDate && selectedLead) {
      // Recargar todos los datos
      Promise.all([
        refetchLoans(),
        refetchRoute(),
        refetchPreviousLoans()
      ]).then(() => {
        console.log('Datos recargados exitosamente');
      }).catch(error => {
        console.error('Error al recargar los datos:', error);
      });
    }
  }, [selectedDate, selectedLead, refetchLoans, refetchRoute, refetchPreviousLoans]);

  // Efecto para recargar datos cuando se active la pestaña
  React.useEffect(() => {
    if (selectedDate && selectedLead) {
      // Recargar todos los datos
      Promise.all([
        refetchLoans(),
        refetchRoute(),
        refetchPreviousLoans()
      ]).then(() => {
        console.log('Datos recargados al activar la pestaña');
      }).catch(error => {
        console.error('Error al recargar los datos:', error);
      });
    }
  }, [selectedDate, selectedLead, refetchLoans, refetchRoute, refetchPreviousLoans]);

  // Efecto para actualizar el newLoan cuando cambie el líder
  React.useEffect(() => {
    setNewLoan(prev => ({
      ...prev,
      lead: { 
        id: selectedLead?.id || '', 
        personalData: { fullName: '', __typename: 'PersonalData' }, 
        __typename: 'Lead' 
      }
    }));
  }, [selectedLead]);

  // Efecto para resaltar el nuevo préstamo por 3 segundos
  useEffect(() => {
    if (newLoanId) {
      const timer = setTimeout(() => {
        setNewLoanId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newLoanId]);

  // Cerrar el menú cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddLoan = () => {
    setIsAddingNew(true);
    setNewLoan({
      requestedAmount: '0',
      amountGived: '',
      amountToPay: '',
      pendingAmount: '0',
      signDate: selectedDate?.toISOString() || '',
      finishedDate: '',
      createdAt: '',
      updatedAt: '',
      comissionAmount: '0',
      avalName: '',
      avalPhone: '',
      loantype: { id: '', name: '', rate: '0', weekDuration: '0', __typename: 'LoanType' },
      lead: { id: selectedLead?.id || '', personalData: { fullName: '', __typename: 'PersonalData' }, __typename: 'Lead' },
      borrower: {
        id: '',
        personalData: {
          id: '',
          fullName: '',
          phones: [{ number: '', __typename: 'Phone' }],
          __typename: 'PersonalData'
        },
        __typename: 'Borrower'
      },
      previousLoan: undefined,
      __typename: 'Loan'
    });
  };

  const [createLoan] = useMutation(CREATE_LOAN);
  const [updateLoan] = useMutation(UPDATE_LOAN);
  const [deleteLoan] = useMutation(DELETE_LOAN);

  const handleSaveNewLoan = async () => {
    try {
      setIsCreating(true);
      const loanData = {
        requestedAmount: newLoan.requestedAmount,
        amountGived: newLoan.amountGived,
        signDate: selectedDate,
        avalName: newLoan.avalName,
        avalPhone: newLoan.avalPhone,
        comissionAmount: newLoan.comissionAmount,
        lead: { connect: { id: selectedLead?.id } },
        loantype: { connect: { id: newLoan.loantype?.id || '' } },
        borrower: {
          create: {
            personalData: {
              create: {
                fullName: newLoan.borrower?.personalData?.fullName || '',
                phones: {
                  create: newLoan.borrower?.personalData?.phones?.map(phone => ({
                    number: phone.number
                  })) || []
                }
              }
            }
          }
        }
      };

      const { data } = await createLoan({ 
        variables: { 
          data: loanData 
        } 
      });
      
      if (data?.createLoan) {
        // 1. Actualizar la lista de préstamos
        setLoans([...loans, data.createLoan]);
        setNewLoanId(data.createLoan.id);
        
        // 2. Cerrar el formulario inmediatamente
        setIsAddingNew(false);
        
        // 3. Actualizar los datos en segundo plano
        Promise.all([
          refetchRoute(),
          refetchLoans()
        ]).then(() => {
          // 4. Actualizar el balance local
          if (onBalanceUpdate) {
            const totalAmount = parseFloat(data.createLoan.amountGived);
            onBalanceUpdate(-totalAmount);
          }
        });
      }
    } catch (error) {
      console.error('Error al crear el préstamo:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
  };

  const handleEditLoan = (loan: Loan) => {
    setEditingLoan({
      ...loan,
      requestedAmount: loan.requestedAmount.toString(),
      amountGived: loan.amountGived.toString(),
      amountToPay: loan.amountToPay.toString(),
      pendingAmount: loan.pendingAmount.toString(),
      comissionAmount: loan.comissionAmount?.toString() || '0'
    });
  };

  const handleUpdateLoan = async () => {
    if (!editingLoan) return;

    try {
      setIsUpdating(editingLoan.id);
      const loanData = {
        requestedAmount: editingLoan.requestedAmount,
        amountGived: editingLoan.amountGived,
        avalName: editingLoan.avalName,
        avalPhone: editingLoan.avalPhone,
        comissionAmount: editingLoan.comissionAmount
      };

      const { data } = await updateLoan({
        variables: {
          where: { id: editingLoan.id },
          data: loanData
        }
      });

      if (data?.updateLoan) {
        setLoans(prevLoans => 
          prevLoans.map(loan => loan.id === editingLoan.id ? data.updateLoan : loan)
        );
        
        Promise.all([
          refetchLoans(),
          refetchRoute()
        ]).then(() => {
          if (onBalanceUpdate) {
            const oldTotal = parseFloat(editingLoan.amountGived) + parseFloat(editingLoan.comissionAmount || '0');
            const newTotal = parseFloat(data.updateLoan.amountGived) + parseFloat(data.updateLoan.comissionAmount || '0');
            onBalanceUpdate(oldTotal - newTotal);
          }
        });
        
        setEditingLoan(null);
      }
    } catch (error) {
      console.error('Error al actualizar el préstamo:', error);
      await refetchLoans();
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteLoan = async (id: string) => {
    try {
      setIsDeleting(id);
      const { data } = await deleteLoan({
        variables: {
          where: { id }
        }
      });

      if (data?.deleteLoan) {
        setLoans(prevLoans => prevLoans.filter(loan => loan.id !== id));
        
        Promise.all([
          refetchLoans(),
          refetchRoute()
        ]).then(() => {
          if (onBalanceUpdate) {
            const updatedBalance = routeBalance + parseFloat(data.deleteLoan.amountGived) + parseFloat(data.deleteLoan.comissionAmount || '0');
            onBalanceUpdate(updatedBalance);
            setRouteBalance(updatedBalance);
          }
        });
      }
    } catch (error) {
      console.error('Error al eliminar el préstamo:', error);
      await refetchLoans();
    } finally {
      setIsDeleting(null);
    }
  };

  // Calcular totales
  const totals = loans.reduce((acc, loan) => ({
    count: acc.count + 1,
    amountGived: acc.amountGived + parseFloat(loan.amountGived || '0'),
    amountToPay: acc.amountToPay + parseFloat(loan.amountToPay || '0'),
    newLoans: acc.newLoans + (loan.previousLoan ? 0 : 1),
    renewals: acc.renewals + (loan.previousLoan ? 1 : 0),
  }), { count: 0, amountGived: 0, amountToPay: 0, newLoans: 0, renewals: 0 });

  // Mover la función getDropdownPosition dentro del componente
  const getDropdownPosition = (buttonId: string) => {
    const button = buttonRefs.current[buttonId];
    if (!button) return { top: 0, left: 0 };

    const rect = button.getBoundingClientRect();
    return {
      top: rect.top - 4, // Posicionar arriba del botón
      left: rect.right - 160, // 160px es el ancho del dropdown
    };
  };

  useEffect(() => {
    if (routeData?.route) {
      const balance = routeData.route.accounts.reduce((total, account) => total + account.amount, 0);
      setRouteBalance(balance);
      if (onBalanceUpdate) {
        onBalanceUpdate(balance);
      }
    }
  }, [routeData, onBalanceUpdate]);

  if (loansLoading || loanTypesLoading || previousLoansLoading) {
    return (
      <Box paddingTop="xlarge" style={{ display: 'flex', justifyContent: 'center' }}>
        <LoadingDots label="Cargando préstamos" size="large" />
      </Box>
    );
  }

  if (loansError) {
    return (
      <Box paddingTop="xlarge">
        <GraphQLErrorNotice
          errors={loansError?.graphQLErrors || []}
          networkError={loansError?.networkError}
        />
      </Box>
    );
  }

  if (!selectedDate || !selectedLead) {
    return (
      <Box paddingTop="xlarge" style={{ textAlign: 'center', color: '#6B7280' }}>
        Selecciona una fecha y un líder para ver los préstamos
      </Box>
    );
  }

  return (
    <>
      <Box paddingTop="medium">
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
                TOTAL DE CRÉDITOS
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '2px',
              }}>
                {totals.count}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>Activos</span>
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
                CRÉDITOS NUEVOS
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '2px',
              }}>
                {totals.newLoans}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>Primera vez</span>
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
                RENOVACIONES
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '2px',
              }}>
                {totals.renewals}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>Clientes recurrentes</span>
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
                TOTAL OTORGADO
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '2px',
              }}>
                ${totals.amountGived.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>En {totals.count} préstamos</span>
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
                TOTAL A PAGAR
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                lineHeight: '1',
                marginBottom: '2px',
              }}>
                ${totals.amountToPay.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>Retorno esperado</span>
              </div>
            </div>
          </div>

          {/* Add Loan Button */}
          <Button
            tone="active"
            size="medium"
            weight="bold"
            onClick={handleAddLoan}
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
            <span>Nuevo Préstamo</span>
          </Button>
        </div>

        {/* Loans Table */}
        <Box
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            position: 'relative',
          }}
        >
          <div style={{
            padding: '12px',
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}>
              <thead>
                <tr style={{ 
                  backgroundColor: '#F9FAFB',
                  borderBottom: '1px solid #E5E7EB' 
                }}>
                  <th style={tableHeaderStyle}>Préstamo Previo</th>
                  <th style={tableHeaderStyle}>Tipo</th>
                  <th style={tableHeaderStyle}>Nombre</th>
                  <th style={tableHeaderStyle}>Teléfono</th>
                  <th style={tableHeaderStyle}>Monto Solicitado</th>
                  <th style={tableHeaderStyle}>Deuda Pendiente</th>
                  <th style={tableHeaderStyle}>Monto Entregado</th>
                  <th style={tableHeaderStyle}>Monto a Pagars</th>
                  <th style={tableHeaderStyle}>Comisión</th>
                  <th style={tableHeaderStyle}>Nombre del Aval</th>
                  <th style={tableHeaderStyle}>Teléfono del Aval</th>
                  <th style={{
                    ...tableHeaderStyle,
                    width: '40px',
                    minWidth: '40px',
                  }}></th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr 
                    key={loan.id}
                    style={{
                      borderBottom: '1px solid #E5E7EB',
                      transition: 'all 0.3s ease',
                      backgroundColor: loan.id === newLoanId ? '#F0F9FF' : 'white',
                      position: 'relative',
                    }}
                  >
                    {loan.id === newLoanId && (
                      <td
                        colSpan={12}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: '3px',
                          height: '100%',
                          backgroundColor: '#0052CC',
                        }}
                      />
                    )}
                    <td style={tableCellStyle}>
                      {loan.previousLoan ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          backgroundColor: '#F0F9FF',
                          color: '#0052CC',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}>
                          Renovado
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          backgroundColor: '#F0FDF4',
                          color: '#059669',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}>
                          Nuevo
                        </span>
                      )}
                    </td>
                    <td style={tableCellStyle}>{loan.loantype.name}</td>
                    <td style={tableCellStyle}>
                      <div 
                        style={{ 
                          position: 'relative',
                          display: 'inline-block',
                          maxWidth: '100%',
                          cursor: 'help',
                        }}
                        onMouseEnter={(e) => {
                          const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                          if (tooltip) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const tooltipRect = tooltip.getBoundingClientRect();
                            
                            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                            let top = rect.top - tooltipRect.height - 8;
                            
                            if (left < 0) left = 0;
                            if (left + tooltipRect.width > window.innerWidth) {
                              left = window.innerWidth - tooltipRect.width;
                            }
                            if (top < 0) {
                              top = rect.bottom + 8;
                            }
                            
                            tooltip.style.left = `${left}px`;
                            tooltip.style.top = `${top}px`;
                            tooltip.style.display = 'block';
                          }
                        }}
                        onMouseLeave={(e) => {
                          const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                          if (tooltip) {
                            tooltip.style.display = 'none';
                          }
                        }}
                      >
                        <span style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {loan.borrower?.personalData?.fullName || 'Sin nombre'}
                        </span>
                        <div 
                          className="tooltip"
                          style={{
                            ...tooltipStyle,
                            display: 'none',
                          }}
                        >
                          {loan.borrower?.personalData?.fullName || 'Sin nombre'}
                        </div>
                      </div>
                    </td>
                    <td style={tableCellStyle}>{loan.borrower?.personalData?.phones?.[0]?.number || '-'}</td>
                    <td style={tableCellStyle}>${loan.requestedAmount}</td>
                    <td style={tableCellStyle}>${loan.previousLoan?.pendingAmount || '0'}</td>
                    <td style={tableCellStyle}>${loan.amountGived}</td>
                    <td style={tableCellStyle}>
                      ${loan.loantype?.rate ? 
                        calculateAmountToPay(loan.requestedAmount, loan.loantype.rate) : 
                        'N/A'}
                    </td>
                    <td style={tableCellStyle}>${loan.comissionAmount}</td>
                    <td style={tableCellStyle}>
                      <div 
                        style={{ 
                          position: 'relative',
                          display: 'inline-block',
                          maxWidth: '100%',
                          cursor: 'help',
                        }}
                        onMouseEnter={(e) => {
                          const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                          if (tooltip) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const tooltipRect = tooltip.getBoundingClientRect();
                            
                            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                            let top = rect.top - tooltipRect.height - 8;
                            
                            if (left < 0) left = 0;
                            if (left + tooltipRect.width > window.innerWidth) {
                              left = window.innerWidth - tooltipRect.width;
                            }
                            if (top < 0) {
                              top = rect.bottom + 8;
                            }
                            
                            tooltip.style.left = `${left}px`;
                            tooltip.style.top = `${top}px`;
                            tooltip.style.display = 'block';
                          }
                        }}
                        onMouseLeave={(e) => {
                          const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                          if (tooltip) {
                            tooltip.style.display = 'none';
                          }
                        }}
                      >
                        <span style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {loan.avalName}
                        </span>
                        <div 
                          className="tooltip"
                          style={{
                            ...tooltipStyle,
                            display: 'none',
                          }}
                        >
                          {loan.avalName}
                        </div>
                      </div>
                    </td>
                    <td style={tableCellStyle}>{loan.avalPhone}</td>
                    <td style={{
                      ...tableCellStyle,
                      width: '40px',
                      position: 'relative',
                    }}>
                      {isDeleting === loan.id ? (
                        <Box style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          width: '100%',
                          height: '32px'
                        }}>
                          <LoadingDots label="Eliminando" size="small" />
                        </Box>
                      ) : (
                        <Button
                          ref={el => buttonRefs.current[loan.id] = el}
                          tone="passive"
                          size="small"
                          onClick={() => setActiveMenu(activeMenu === loan.id ? null : loan.id)}
                          style={{
                            padding: '6px',
                            minWidth: '32px',
                            height: '32px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FaEllipsisV size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {isAddingNew && (
                  <tr style={{
                    backgroundColor: '#F0F9FF',
                    position: 'relative',
                  }}>
                    <td style={tableCellStyle}>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <Select
                          options={previousLoanOptions}
                          onChange={handlePreviousLoanChange}
                          value={newLoan.previousLoan?.id ? {
                            value: newLoan.previousLoan.id,
                            label: `${newLoan.previousLoan.borrower?.personalData?.fullName || 'Sin nombre'} ($${newLoan.previousLoan.pendingAmount || 0})`
                          } : { value: '', label: 'Seleccionar préstamo previo' }}
                          menuPlacement="auto"
                          menuPosition="fixed"
                          styles={{
                            container: (base) => ({
                              ...base,
                              width: '100%'
                            }),
                            menu: (base) => ({
                              ...base,
                              minWidth: '250px'
                            })
                          }}
                        />
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <Select
                          options={loanTypeOptions}
                          onChange={value => {
                            if (value) {
                              const selectedType = loanTypesData?.loantypes?.find(type => type.id === value.value);
                              if (selectedType) {
                                const { amountGived, amountToPay } = calculateLoanAmounts({
                                  requestedAmount: newLoan.requestedAmount,
                                  pendingAmount: newLoan.pendingAmount,
                                  rate: selectedType.rate
                                });

                                console.log('Cálculo de monto a pagar:', {
                                  requestedAmount: newLoan.requestedAmount,
                                  rate: selectedType.rate,
                                  amountToPay,
                                  formula: `${newLoan.requestedAmount} * (1 + (${selectedType.rate} * 100))`
                                });

                                setNewLoan({
                                  ...newLoan,
                                  loantype: { 
                                    id: value.value, 
                                    name: value.label.split('(')[0].trim(),
                                    rate: selectedType.rate,
                                    weekDuration: selectedType.weekDuration,
                                    __typename: 'LoanType'
                                  },
                                  amountGived,
                                  amountToPay
                                });
                              }
                            }
                          }}
                          value={loanTypeOptions.find(option => option.value === newLoan.loantype?.id) || null}
                          menuPlacement="auto"
                          menuPosition="fixed"
                          styles={{
                            container: (base) => ({
                              ...base,
                              width: '100%'
                            }),
                            menu: (base) => ({
                              ...base,
                              minWidth: '250px'
                            })
                          }}
                        />
                      </div>
                    </td>
                    <td style={tableCellWithInputStyle}>
                      <input
                        type="text"
                        value={newLoan.borrower?.personalData?.fullName || ''}
                        onChange={e => setNewLoan({
                          ...newLoan,
                          borrower: {
                            ...newLoan.borrower,
                            personalData: {
                              ...newLoan.borrower?.personalData,
                              fullName: e.target.value
                            }
                          }
                        })}
                        onFocus={() => setFocusedInput('borrowerName')}
                        onBlur={() => setFocusedInput(null)}
                        style={focusedInput === 'borrowerName' ? focusedInputStyle : tableInputStyle}
                        placeholder="Nombre del cliente"
                      />
                    </td>
                    <td style={tableCellWithInputStyle}>
                      <input
                        type="tel"
                        value={newLoan.borrower?.personalData?.phones?.[0]?.number || ''}
                        onChange={e => setNewLoan({
                          ...newLoan,
                          borrower: {
                            ...newLoan.borrower,
                            personalData: {
                              ...newLoan.borrower?.personalData,
                              phones: [{ number: e.target.value, __typename: 'Phone' }]
                            }
                          }
                        })}
                        onFocus={() => setFocusedInput('borrowerPhone')}
                        onBlur={() => setFocusedInput(null)}
                        style={focusedInput === 'borrowerPhone' ? focusedInputStyle : tableInputStyle}
                        placeholder="Teléfono del cliente"
                      />
                    </td>
                    <td style={tableCellWithInputStyle}>
                      <input
                        type="number"
                        value={newLoan.requestedAmount}
                        onChange={e => {
                          const requestedAmount = e.target.value;
                          const { amountGived, amountToPay } = calculateLoanAmounts({
                            requestedAmount,
                            pendingAmount: newLoan.pendingAmount,
                            rate: newLoan.loantype.rate
                          });
                          
                          setNewLoan({ 
                            ...newLoan, 
                            requestedAmount,
                            amountGived,
                            amountToPay
                          });
                        }}
                        onFocus={() => setFocusedInput('requestedAmount')}
                        onBlur={() => setFocusedInput(null)}
                        style={focusedInput === 'requestedAmount' ? focusedInputStyle : tableInputStyle}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={tableCellWithInputStyle}>
                      <input
                        type="number"
                        value={newLoan.pendingAmount || '0'}
                        readOnly
                        onFocus={() => setFocusedInput('pendingAmount')}
                        onBlur={() => setFocusedInput(null)}
                        style={focusedInput === 'pendingAmount' ? focusedInputStyle : tableInputReadOnlyStyle}
                      />
                    </td>
                    <td style={tableCellWithInputStyle}>
                      <input
                        type="number"
                        value={newLoan.amountGived}
                        readOnly
                        onFocus={() => setFocusedInput('amountGived')}
                        onBlur={() => setFocusedInput(null)}
                        style={focusedInput === 'amountGived' ? focusedInputStyle : tableInputReadOnlyStyle}
                      />
                    </td>
                    <td style={tableCellWithInputStyle}>
                      <input
                        type="number"
                        value={newLoan.amountToPay}
                        readOnly
                        onFocus={() => setFocusedInput('amountToPay')}
                        onBlur={() => setFocusedInput(null)}
                        style={focusedInput === 'amountToPay' ? focusedInputStyle : tableInputReadOnlyStyle}
                      />
                    </td>
                    <td style={tableCellWithInputStyle}>
                      <input
                        type="number"
                        value={newLoan.comissionAmount}
                        onChange={e => setNewLoan({ ...newLoan, comissionAmount: e.target.value })}
                        onFocus={() => setFocusedInput('comissionAmount')}
                        onBlur={() => setFocusedInput(null)}
                        style={focusedInput === 'comissionAmount' ? focusedInputStyle : tableInputStyle}
                        placeholder="0.00"
                      />
                    </td>
                    <td style={tableCellWithInputStyle}>
                      <input
                        type="text"
                        value={newLoan.avalName}
                        onChange={e => setNewLoan({ ...newLoan, avalName: e.target.value })}
                        onFocus={() => setFocusedInput('avalName')}
                        onBlur={() => setFocusedInput(null)}
                        style={focusedInput === 'avalName' ? focusedInputStyle : tableInputStyle}
                        placeholder="Nombre del aval"
                      />
                    </td>
                    <td style={tableCellWithInputStyle}>
                      <input
                        type="tel"
                        value={newLoan.avalPhone}
                        onChange={e => setNewLoan({ ...newLoan, avalPhone: e.target.value })}
                        onFocus={() => setFocusedInput('avalPhone')}
                        onBlur={() => setFocusedInput(null)}
                        style={focusedInput === 'avalPhone' ? focusedInputStyle : tableInputStyle}
                        placeholder="Teléfono"
                      />
                    </td>
                    <td style={{
                      ...tableCellStyle,
                      width: '100px',
                    }}>
                      <Box style={{ display: 'flex', gap: '4px' }}>
                        {isCreating ? (
                          <Box style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            width: '100%',
                            height: '32px'
                          }}>
                            <LoadingDots label="Guardando" size="small" />
                          </Box>
                        ) : (
                          <>
                            <Button
                              tone="positive"
                              size="small"
                              onClick={handleSaveNewLoan}
                              style={{
                                padding: '6px',
                                width: '32px',
                                height: '32px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Guardar"
                            >
                              <FaCheck size={14} />
                            </Button>
                            <Button
                              tone="negative"
                              size="small"
                              onClick={handleCancelNew}
                              style={{
                                padding: '6px',
                                width: '32px',
                                height: '32px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Cancelar"
                            >
                              <FaTimes size={14} />
                            </Button>
                          </>
                        )}
                      </Box>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Box>
      </Box>

      {/* Global Dropdown Container */}
      <DropdownPortal isOpen={activeMenu !== null}>
        {loans.map((loan) => (
          activeMenu === loan.id && (
            <div
              key={`dropdown-${loan.id}`}
              ref={menuRef}
              style={{
                position: 'fixed',
                ...getDropdownPosition(loan.id),
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
                pointerEvents: 'auto',
                minWidth: '160px',
                zIndex: 10000,
                transform: 'translateY(-100%)', // Mover el menú hacia arriba
              }}
            >
              <button
                onClick={() => {
                  handleEditLoan(loan);
                  setActiveMenu(null);
                }}
                style={menuItemStyle}
              >
                <FaEdit size={14} style={{ marginRight: '8px' }} />
                Editar
              </button>
              <button
                onClick={() => {
                  handleDeleteLoan(loan.id);
                  setActiveMenu(null);
                }}
                style={{
                  ...menuItemStyle,
                  color: '#DC2626',
                  borderTop: '1px solid #E5E7EB',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  textAlign: 'left'
                }}
                disabled={isDeleting === loan.id}
              >
                <FaTrash size={14} />
                <span>Eliminar</span>
              </button>
            </div>
          )
        ))}

        {activeMenu === 'new' && (
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              ...getDropdownPosition('new'),
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
              pointerEvents: 'auto',
              minWidth: '160px',
              zIndex: 10000,
              transform: 'translateY(-100%)', // Mover el menú hacia arriba
            }}
          >
            <button
              onClick={() => {
                setActiveMenu(null);
              }}
              style={menuItemStyle}
            >
              <FaEdit size={14} style={{ marginRight: '8px' }} />
              Opción 1
            </button>
            <button
              onClick={() => {
                setActiveMenu(null);
              }}
              style={{
                ...menuItemStyle,
                borderTop: '1px solid #E5E7EB',
              }}
            >
              <FaEdit size={14} style={{ marginRight: '8px' }} />
              Opción 2
            </button>
            <button
              onClick={() => {
                setActiveMenu(null);
              }}
              style={{
                ...menuItemStyle,
                borderTop: '1px solid #E5E7EB',
              }}
            >
              <FaEdit size={14} style={{ marginRight: '8px' }} />
              Opción 3
            </button>
          </div>
        )}
      </DropdownPortal>

      {/* Edit Modal */}
      {editingLoan && (
        <Box
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <Box
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '12px',
              width: '500px',
              maxWidth: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <Stack gap="large">
              <Stack gap="medium">
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '20px', 
                  fontWeight: '600',
                  color: '#1a1f36'
                }}>
                  Editar Préstamo
                </h2>
                <p style={{ 
                  margin: 0, 
                  color: '#697386',
                  fontSize: '14px'
                }}>
                  Modifica los detalles del préstamo seleccionado
                </p>
              </Stack>

              <Stack gap="medium">
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Deuda Pendiente del Préstamo Anterior
                  </label>
                  <TextInput
                    type="number"
                    placeholder="0.00"
                    value={editingLoan.previousLoan?.pendingAmount || '0'}
                    readOnly
                    style={{
                      ...inputStyle,
                      backgroundColor: '#f3f4f6',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Tipo de Préstamo
                  </label>
                  <Select
                    options={loanTypeOptions}
                    onChange={value => {
                      if (value) {
                        const selectedType = loanTypesData?.loantypes?.find(type => type.id === value.value);
                        if (selectedType) {
                          const { amountGived, amountToPay } = calculateLoanAmounts({
                            requestedAmount: editingLoan.requestedAmount,
                            pendingAmount: editingLoan.previousLoan?.pendingAmount || '0',
                            rate: selectedType.rate
                          });

                          setEditingLoan({
                            ...editingLoan,
                            loantype: {
                              id: value.value,
                              name: value.label.split('(')[0].trim(),
                              rate: selectedType.rate,
                              weekDuration: selectedType.weekDuration,
                              __typename: 'LoanType'
                            },
                            amountGived,
                            amountToPay
                          });
                        }
                      }
                    }}
                    value={loanTypeOptions.find(option => option.value === editingLoan.loantype?.id) || null}
                    styles={{
                      container: (base) => ({
                        ...base,
                        width: '100%'
                      }),
                      menu: (base) => ({
                        ...base,
                        minWidth: '250px'
                      })
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Monto Solicitado
                  </label>
                  <TextInput
                    type="number"
                    placeholder="0.00"
                    value={editingLoan.requestedAmount}
                    onChange={(e) => {
                      const requestedAmount = e.target.value;
                      const { amountGived, amountToPay } = calculateLoanAmounts({
                        requestedAmount,
                        pendingAmount: editingLoan.previousLoan?.pendingAmount || '0',
                        rate: editingLoan.loantype.rate
                      });
                      
                      setEditingLoan({ 
                        ...editingLoan, 
                        requestedAmount,
                        amountGived,
                        amountToPay
                      });
                    }}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Monto Entregado
                  </label>
                  <TextInput
                    type="number"
                    placeholder="0.00"
                    value={editingLoan.amountGived}
                    readOnly
                    style={{
                      ...inputStyle,
                      backgroundColor: '#f3f4f6',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Monto a Pagar
                  </label>
                  <TextInput
                    type="number"
                    placeholder="0.00"
                    value={editingLoan.amountToPay}
                    readOnly
                    style={{
                      ...inputStyle,
                      backgroundColor: '#f3f4f6',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Comisión
                  </label>
                  <TextInput
                    type="number"
                    placeholder="0.00"
                    value={editingLoan.comissionAmount}
                    onChange={(e) => setEditingLoan({ ...editingLoan, comissionAmount: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Nombre del Aval
                  </label>
                  <TextInput
                    type="text"
                    placeholder="Nombre completo"
                    value={editingLoan.avalName}
                    onChange={(e) => setEditingLoan({ ...editingLoan, avalName: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Teléfono del Aval
                  </label>
                  <TextInput
                    type="tel"
                    placeholder="Número de teléfono"
                    value={editingLoan.avalPhone}
                    onChange={(e) => setEditingLoan({ ...editingLoan, avalPhone: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </Stack>

              <Box style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                marginTop: '16px'
              }}>
                <Button
                  tone="negative"
                  size="large"
                  onClick={() => setEditingLoan(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  tone="active"
                  size="large"
                  weight="bold"
                  onClick={handleUpdateLoan}
                  disabled={isUpdating === editingLoan.id}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#0052CC',
                    opacity: isUpdating === editingLoan.id ? 0.7 : 1,
                    cursor: isUpdating === editingLoan.id ? 'wait' : 'pointer'
                  }}
                >
                  {isUpdating === editingLoan.id ? (
                    <LoadingDots label="Guardando" size="small" />
                  ) : (
                    'Guardar Cambios'
                  )}
                </Button>
              </Box>
            </Stack>
          </Box>
        </Box>
      )}
    </>
  );
};

// Styles
const tableHeaderStyle = {
  padding: '8px 6px',
  textAlign: 'left' as const,
  fontWeight: '500',
  color: '#374151',
  whiteSpace: 'normal' as const,
  fontSize: '13px',
  lineHeight: '1.2',
  minWidth: '80px',
  maxWidth: '120px',
};

const tableCellStyle = {
  padding: '8px 6px',
  color: '#1a1f36',
  fontSize: '13px',
  whiteSpace: 'nowrap' as const,
  /* maxWidth: '120px', */
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  position: 'relative' as const,
};

const tableCellWithInputStyle = {
  ...tableCellStyle,
  overflow: 'visible' as const,
};

const tooltipStyle = {
  position: 'fixed' as const,
  backgroundColor: '#1a1f36',
  color: 'white',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '13px',
  zIndex: 1000,
  maxWidth: '300px',
  whiteSpace: 'normal' as const,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  display: 'none',
  pointerEvents: 'none' as const,
};

const inputStyle = {
  width: '100%',
  padding: '10px 16px',
  fontSize: '14px',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  outline: 'none',
  transition: 'all 0.2s ease',
  height: '50px !important',
};

const menuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '8px 16px',
  fontSize: '14px',
  color: '#1a1f36',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left' as const,
  transition: 'background-color 0.2s ease',
  ':hover': {
    backgroundColor: '#F9FAFB',
  },
};

const tableInputStyle = {
  width: '100%',
  padding: '2px 6px',
  height: '38px',
  fontSize: '13px',
  border: '1px solid #E5E7EB',
  borderRadius: '4px',
  outline: 'none',
  transition: 'all 0.2s ease',
  '&:focus': {
    borderColor: '#0052CC',
    boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.1)',
    padding: '4px 8px',
    width: 'calc(100% + 8px)',
    marginLeft: '-4px',
  },
};

const tableInputReadOnlyStyle = {
  ...tableInputStyle,
  backgroundColor: '#f3f4f6',
  '&:focus': {
    ...tableInputStyle['&:focus'],
    backgroundColor: '#f3f4f6',
  }
};

const focusedInputStyle = {
  ...tableInputStyle,
  borderColor: '#0052CC',
  boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.1)',
  padding: '4px 8px',
  overflow: 'visible' as const,
  width: 'calc(100% + 100px)',
  marginLeft: '-4px',
  position: 'relative' as const,
  zIndex: 1000,
}; 