import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { FaEdit, FaSpinner } from 'react-icons/fa';
import { calculateLoanAmounts, calculateAmountToPay } from '../../utils/loanCalculations';
import { GET_ROUTE } from '../../graphql/queries/routes';
import { CREATE_LOANS_BULK, UPDATE_LOAN_WITH_AVAL } from '../../graphql/mutations/loans';
import { CREATE_LEAD_PAYMENT_RECEIVED, UPDATE_LEAD_PAYMENT } from '../../graphql/mutations/payments';
import { GET_LEAD_PAYMENTS } from '../../graphql/queries/payments';
import { useBalanceRefresh } from '../../hooks/useBalanceRefresh';
import type { Loan, LoanType } from '../../types/loan';
import { FaEllipsisV, FaInfoCircle, FaCalendarAlt, FaExchangeAlt, FaTimes, FaCheck, FaSave } from 'react-icons/fa';
import { MOVE_LOANS_TO_DATE } from '../../graphql/mutations/dateMovement';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '../ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import ClientLoanUnifiedInput from '../loans/ClientLoanUnifiedInput';
import { FaTrash, FaExclamationTriangle } from 'react-icons/fa';

// Reutilizar las mismas queries del componente original
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
      totalDebtAcquired
      signDate
      finishedDate
      createdAt
      updatedAt
      comissionAmount
      collaterals {
        id
        fullName
        phones {
          id
          number
          __typename
        }
        addresses {
          id
          location {
            id
            name
            __typename
          }
          __typename
        }
        __typename
      }
      loantype {
        id
        name
        rate
        weekDuration
        loanPaymentComission
        __typename
      }
      lead {
        id
        personalData {
          fullName
          addresses {
            id
            location {
              id
              name
              municipality {
                id
                name
                state {
                  id
                  name
                }
              }
            }
          }
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
          addresses {
            id
            location {
              id
              name
              __typename
            }
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
        collaterals {
          id
          fullName
          phones {
            id
            number
            __typename
          }
          __typename
        }
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

const GET_LOAN_TYPES = gql`
  query GetLoanTypes {
    loantypes {
      id
      name
      rate
      weekDuration
      loanPaymentComission
      loanGrantedComission
      __typename
    }
  }
`;

const GET_PREVIOUS_LOANS = gql`
  query GetPreviousLoansOptimized($leadId: ID!) {
    loans(
      where: {
        lead: { id: { equals: $leadId } }
      }
      orderBy: { signDate: desc }
      take: 100
    ) {
      id
      requestedAmount
      amountGived
      signDate
      finishedDate
      renewedDate
      status
      pendingAmountStored
      loantype {
        id
        name
        rate
        weekDuration
        loanPaymentComission
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
          addresses {
            id
            location {
              id
              name
              municipality {
                id
                name
                state {
                  id
                  name
                }
              }
            }
          }
        }
      }
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
      }
      payments {
        amount
      }
      __typename
    }
  }
`;

const GET_ALL_PREVIOUS_LOANS = gql`
  query GetAllPreviousLoans($searchText: String, $take: Int) {
    loans(
      where: {
        # Siempre buscar en todas las localidades - sin filtro por lead o location
        # Si searchText está vacío o es null, no se aplica el filtro (devuelve todos)
        borrower: { 
          personalData: { 
            fullName: { 
              contains: $searchText, 
              mode: insensitive 
            } 
          } 
        }
      }
      orderBy: { signDate: desc }
      take: $take
    ) {
      id
      requestedAmount
      amountGived
      signDate
      finishedDate
      renewedDate
      status
      pendingAmountStored
      lead {
        id
        personalData {
          fullName
          addresses {
            id
            location {
              id
              name
              municipality {
                id
                name
                state {
                  id
                  name
                }
              }
            }
          }
        }
      }
      loantype {
        id
        name
        rate
        weekDuration
        loanPaymentComission
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
          addresses {
            id
            location {
              id
              name
              municipality {
                id
                name
                state {
                  id
                  name
                }
              }
            }
          }
        }
      }
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
      }
      payments {
        amount
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

interface ExtendedLoan extends Partial<Loan> {
  id: string;
  selectedCollateralId?: string;
  selectedCollateralPhoneId?: string;
  avalAction?: 'create' | 'update' | 'connect' | 'clear';
  avalName?: string;
  avalPhone?: string;
  avalData?: {
    avalName?: string;
    avalPhone?: string;
  };
  lead?: {
    id: string;
    personalData: {
      fullName: string;
    };
  };
  previousLoanOption?: any;
}

interface CreditosTabNewProps {
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

// Estilos modernos tipo shadcn/ui
const shadcnStyles = {
  button: {
    base: 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  },
  input: 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  table: 'w-full border-collapse',
  tableHeader: 'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
  tableCell: 'p-4 align-middle [&:has([role=checkbox])]:pr-0',
  card: 'rounded-lg border bg-card text-card-foreground shadow-sm',
};

export const CreditosTabNew: React.FC<CreditosTabNewProps> = ({ 
  selectedDate, 
  selectedRoute, 
  selectedLead, 
  onBalanceUpdate 
}) => {
  const { triggerRefresh } = useBalanceRefresh();
  
  const [loans, setLoans] = useState<Loan[]>([]);
  const [pendingLoans, setPendingLoans] = useState<ExtendedLoan[]>([]);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [newLoanId, setNewLoanId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<{ open: boolean; loanId: string | null }>({ open: false, loanId: null });
  const [deletePendingLoanDialogOpen, setDeletePendingLoanDialogOpen] = useState<{ open: boolean; loanIndex: number | null }>({ open: false, loanIndex: null });
  const [locationMismatchDialogOpen, setLocationMismatchDialogOpen] = useState<{
    open: boolean;
    clientLocation: string;
    leadLocation: string;
  }>({ open: false, clientLocation: '', leadLocation: '' });
  
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const existingLoansTableRef = useRef<HTMLDivElement>(null);
  
  interface InitialPayment {
    amount: string;
    paymentMethod: 'CASH' | 'MONEY_TRANSFER';
    comission: string;
  }
  const [initialPayments, setInitialPayments] = useState<Record<string, InitialPayment>>({});
  const [selectedPaymentLoan, setSelectedPaymentLoan] = useState<Loan | null>(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [massCommission, setMassCommission] = useState<string>('0');
  
  const [searchAllLeadersByRow, setSearchAllLeadersByRow] = useState<{ [key: string]: boolean }>({});
  const [dropdownSearchTextByRow, setDropdownSearchTextByRow] = useState<{ [key: string]: string }>({});
  const [debouncedDropdownSearchTextByRow, setDebouncedDropdownSearchTextByRow] = useState<{ [key: string]: string }>({});
  const [editableEmptyRow, setEditableEmptyRow] = useState<ExtendedLoan | null>(null);
  
  const [createMultipleLoans] = useMutation(CREATE_LOANS_BULK);
  const [updateLoanWithAval] = useMutation(UPDATE_LOAN_WITH_AVAL);
  const [deleteLoan] = useMutation(DELETE_LOAN);
  const [createLeadPaymentReceived] = useMutation(CREATE_LEAD_PAYMENT_RECEIVED);
  const [updateLeadPayment] = useMutation(UPDATE_LEAD_PAYMENT);
  
  const { data: routeData, refetch: refetchRoute } = useQuery<{ route: any }>(GET_ROUTE, {
    variables: { where: { id: selectedRoute } },
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
    variables: { leadId: selectedLead?.id || '' },
    skip: !selectedLead,
  });

  const { data: paymentsData, loading: paymentsLoading, refetch: refetchPayments } = useQuery(GET_LEAD_PAYMENTS, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : new Date().toISOString(),
      nextDate: selectedDate ? new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString() : new Date().toISOString(),
      leadId: selectedLead?.id || ''
    },
    skip: !selectedDate || !selectedLead,
  });

  const [isSearchingLoans, setIsSearchingLoans] = useState(false);
  
  // Query para obtener la información completa del lead (incluyendo localidad)
  const GET_LEAD_INFO = gql`
    query GetLeadInfo($id: ID!) {
      employee(where: { id: $id }) {
        id
        personalData {
          id
          fullName
          addresses {
            id
            location {
              id
              name
              municipality {
                id
                name
                state {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const { data: leadInfoData } = useQuery(GET_LEAD_INFO, {
    variables: { id: selectedLead?.id || '' },
    skip: !selectedLead?.id,
  });
  
  // Obtener la localidad del lead seleccionado
  const selectedLeadLocation = useMemo(() => {
    console.log('📍 Calculando selectedLeadLocation:', {
      hasLoansData: !!loansData,
      loansCount: loansData?.loans?.length || 0,
      selectedLead: selectedLead?.id,
      hasLeadInfoData: !!leadInfoData,
      leadInfoData: leadInfoData
    });
    
    // Primero intentar desde leadInfoData (más confiable)
    if (leadInfoData?.employee?.personalData?.addresses?.[0]?.location) {
      const location = {
        id: leadInfoData.employee.personalData.addresses[0].location.id,
        name: leadInfoData.employee.personalData.addresses[0].location.name
      };
      console.log('📍 selectedLeadLocation calculado desde leadInfoData:', location);
      return location;
    }
    
    // Fallback: intentar desde loansData
    if (loansData?.loans && loansData.loans.length > 0) {
      const firstLoan = loansData.loans[0] as any;
      const location = {
        id: firstLoan.lead?.personalData?.addresses?.[0]?.location?.id,
        name: firstLoan.lead?.personalData?.addresses?.[0]?.location?.name
      };
      console.log('📍 selectedLeadLocation calculado desde loansData:', location);
      return location;
    }
    
    console.log('📍 selectedLeadLocation es null');
    return null;
  }, [loansData, leadInfoData, selectedLead]);
  
  const { data: allPreviousLoansData, loading: allPreviousLoansLoading, refetch: refetchAllPreviousLoans } = useQuery(GET_ALL_PREVIOUS_LOANS, {
    variables: { 
      searchText: '', 
      take: 50 // Aumentar el límite inicial
    },
    skip: false,
  });

  const { data: loanTypesData, loading: loanTypesLoading } = useQuery(GET_LOAN_TYPES);

  // Debounce para el texto de búsqueda del dropdown por fila
  useEffect(() => {
    const timers: { [key: string]: NodeJS.Timeout } = {};
    
    Object.entries(dropdownSearchTextByRow).forEach(([rowId, searchText]) => {
      if (timers[rowId]) clearTimeout(timers[rowId]);
      
      timers[rowId] = setTimeout(() => {
        setDebouncedDropdownSearchTextByRow(prev => ({
          ...prev,
          [rowId]: searchText
        }));
      }, 300);
    });

    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer));
    };
  }, [dropdownSearchTextByRow]);

  // Refetch cuando cambie el texto de búsqueda debounced - siempre buscar en todas las localidades
  useEffect(() => {
    // Obtener el último texto de búsqueda de cualquier fila
    const allSearchTexts = Object.values(debouncedDropdownSearchTextByRow);
    const lastSearchText = allSearchTexts[allSearchTexts.length - 1] || '';
    
    // Solo hacer refetch si hay texto de búsqueda (al menos 2 caracteres)
    if (lastSearchText.trim().length >= 2) {
      setIsSearchingLoans(true);
      refetchAllPreviousLoans({
        searchText: lastSearchText,
        take: 50 // Aumentar el límite para obtener más resultados
      }).finally(() => {
        setIsSearchingLoans(false);
      });
    }
  }, [debouncedDropdownSearchTextByRow, refetchAllPreviousLoans]);

  useEffect(() => { 
    setLoans(loansData?.loans || []); 
  }, [loansData]);
  
  useEffect(() => {
    if (selectedDate && selectedLead) {
      refetchLoans(); 
      refetchRoute(); 
      refetchPreviousLoans();
    }
  }, [selectedDate, selectedLead, refetchLoans, refetchRoute, refetchPreviousLoans]);

  const hasPaymentForToday = (loanId: string) => {
    if (!paymentsData?.loanPayments) return false;
    return paymentsData.loanPayments.some((payment: any) => 
      payment.loan?.id === loanId && 
      payment.leadPaymentReceived?.lead?.id === selectedLead?.id
    );
  };

  const getRegisteredPaymentAmount = (loanId: string) => {
    if (!paymentsData?.loanPayments) return '0';
    const payment = paymentsData.loanPayments.find((p: any) => 
      p.loan?.id === loanId && 
      p.leadPaymentReceived?.lead?.id === selectedLead?.id
    );
    return payment ? Math.round(parseFloat(payment.amount || '0')).toString() : '0';
  };

  const handleToggleInitialPayment = (loanId: string) => {
    if (initialPayments[loanId]) {
      const newPayments = { ...initialPayments };
      delete newPayments[loanId];
      setInitialPayments(newPayments);
    } else {
      const loan = loans.find(l => l.id === loanId);
      if (loan) {
        setSelectedPaymentLoan(loan);
      }
    }
  };

  const handleSavePaymentConfig = async (payment: InitialPayment) => {
    if (!selectedPaymentLoan) return;
    
    setIsSavingPayment(true);
    
    try {
      const weeklyAmount = parseFloat(payment.amount);
      const comission = parseFloat(payment.comission);
      const paymentDate = selectedDate?.toISOString() || new Date().toISOString();
      
      const existingPayments = paymentsData?.loanPayments || [];
      const existingLeadPayment = existingPayments.find((p: any) => p.leadPaymentReceived?.lead?.id === selectedLead?.id);
      
      const newPayment = {
        amount: weeklyAmount,
        comission: comission,
        loanId: selectedPaymentLoan.id,
        type: 'PAYMENT',
        paymentMethod: payment.paymentMethod
      } as any;
      
      if (existingLeadPayment) {
        const existingPaymentsForToday = paymentsData?.loanPayments?.filter((p: any) => 
          p.leadPaymentReceived?.lead?.id === selectedLead?.id
        ) || [];
        
        const existingPaymentsList = existingPaymentsForToday.map((payment: any) => ({
          amount: parseFloat(payment.amount || '0'),
          comission: parseFloat(payment.comission || '0'),
          loanId: payment.loan?.id || '',
          type: payment.type || 'PAYMENT',
          paymentMethod: payment.paymentMethod || 'CASH'
        }));
        
        const allPayments = [...existingPaymentsList, newPayment];
        const totalExpectedAmount = allPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
        
        if (payment.paymentMethod === 'CASH') {
          const existingCashAmount = parseFloat(existingLeadPayment.leadPaymentReceived.cashPaidAmount || '0');
          const totalCashAmount = existingCashAmount + weeklyAmount;
          const existingBankAmount = parseFloat(existingLeadPayment.leadPaymentReceived.bankPaidAmount || '0');
          const existingFalcoAmount = parseFloat(existingLeadPayment.leadPaymentReceived.falcoAmount || '0');
          
          await updateLeadPayment({
            variables: {
              id: existingLeadPayment.leadPaymentReceived.id,
              expectedAmount: totalExpectedAmount,
              cashPaidAmount: totalCashAmount,
              bankPaidAmount: existingBankAmount,
              falcoAmount: existingFalcoAmount,
              paymentDate: paymentDate,
              payments: allPayments
            }
          });
        } else {
          await updateLeadPayment({
            variables: {
              id: existingLeadPayment.leadPaymentReceived.id,
              expectedAmount: totalExpectedAmount,
              cashPaidAmount: parseFloat(existingLeadPayment.leadPaymentReceived.cashPaidAmount || '0'),
              bankPaidAmount: parseFloat(existingLeadPayment.leadPaymentReceived.bankPaidAmount || '0'),
              falcoAmount: parseFloat(existingLeadPayment.leadPaymentReceived.falcoAmount || '0'),
              paymentDate: paymentDate,
              payments: allPayments
            }
          });
        }
      } else {
        await createLeadPaymentReceived({
          variables: {
            expectedAmount: weeklyAmount,
            agentId: selectedLead?.id,
            leadId: selectedLead?.id,
            payments: [newPayment],
            cashPaidAmount: payment.paymentMethod === 'CASH' ? weeklyAmount : 0,
            bankPaidAmount: payment.paymentMethod === 'MONEY_TRANSFER' ? weeklyAmount : 0,
            paymentDate: paymentDate
          }
        });
      }
      
      const newPayments = { ...initialPayments };
      delete newPayments[selectedPaymentLoan.id];
      setInitialPayments(newPayments);
      setSelectedPaymentLoan(null);
      
      await Promise.all([refetchRoute(), refetchLoans(), refetchPayments()]);
    } catch (error) {
      console.error('❌ Error registrando pago:', error);
      alert('Error al registrar el pago. Inténtalo de nuevo.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleSaveAllNewLoans = async () => {
    try {
      setIsCreating(true);

      const validLoans = pendingLoans.filter(loan => 
        loan.borrower?.personalData?.fullName?.trim() &&
        loan.loantype?.id &&
        loan.requestedAmount &&
        parseFloat(loan.requestedAmount) > 0
      );

      if (validLoans.length === 0) {
        alert('No hay préstamos válidos para guardar.');
        setIsCreating(false);
        return;
      }

      const loansData = validLoans.map(loan => {
        let phoneNumber = '';
        
        if (loan.borrower?.personalData?.phones?.[0]?.number) {
          phoneNumber = loan.borrower.personalData.phones[0].number;
        } else if ((loan as any).clientData?.clientPhone) {
          phoneNumber = (loan as any).clientData.clientPhone;
        }
        
        return {
          requestedAmount: (loan.requestedAmount || '0').toString(),
          amountGived: (loan.amountGived || '0').toString(),
          signDate: loan.signDate || selectedDate?.toISOString() || '',
          comissionAmount: (loan.comissionAmount || '0').toString(),
          leadId: selectedLead?.id || '',
          loantypeId: loan.loantype?.id || '',
          previousLoanId: loan.previousLoan?.id || undefined,
          borrowerData: {
            fullName: (loan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' '),
            phone: phoneNumber.trim().replace(/\s+/g, ' ')
          },
          avalData: {
            selectedCollateralId: loan.selectedCollateralId || undefined,
            action: loan.avalAction || 'clear',
            name: (loan.avalName || '').trim().replace(/\s+/g, ' '),
            phone: (loan.avalPhone || '').trim().replace(/\s+/g, ' ')
          }
        };
      });

      const { data } = await createMultipleLoans({ variables: { loans: loansData } });

      if (data?.createMultipleLoans) {
        const errorResponse = data.createMultipleLoans.find((loan: any) => !loan.success);
        if (errorResponse) {
          alert(errorResponse.message || 'Error desconocido al crear el préstamo');
          return;
        }

        setPendingLoans([]);
        await Promise.all([refetchRoute(), refetchLoans()]);
        if (onBalanceUpdate) {
          const totalAmount = data.createMultipleLoans.reduce((sum: number, loan: any) => sum + parseFloat(loan.loan?.amountGived || '0'), 0);
          onBalanceUpdate(-totalAmount);
        }
        triggerRefresh();
      }
    } catch (error) {
      console.error('Error al crear los préstamos en bulk:', error);
      alert('Error al crear los préstamos.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditLoan = (loan: Loan) => {
    const calculatedAmountToPay = loan.amountToPay ||
      calculateAmountToPay(loan.requestedAmount.toString(), loan.loantype?.rate?.toString() || '0');
    const calculatedPendingAmount = loan.pendingAmount || '0';
    const firstCollateral = loan.collaterals?.[0];
    const avalName = firstCollateral?.fullName || '';
    const avalPhone = firstCollateral?.phones?.[0]?.number || '';
    const selectedCollateralId = firstCollateral?.id;
    const selectedCollateralPhoneId = firstCollateral?.phones?.[0]?.id;

    setEditingLoan({
      ...loan,
      requestedAmount: loan.requestedAmount.toString(),
      amountGived: loan.amountGived.toString(),
      amountToPay: calculatedAmountToPay.toString(),
      pendingAmount: calculatedPendingAmount.toString(),
      comissionAmount: loan.comissionAmount?.toString() || '0',
      avalName,
      avalPhone,
      selectedCollateralId,
      selectedCollateralPhoneId,
      avalAction: selectedCollateralId ? 'connect' : 'create'
    } as any);
  };

  const handleUpdateLoan = async () => {
    if (!editingLoan) return;

    try {
      setIsUpdating(editingLoan.id);

      const loanData = {
        requestedAmount: editingLoan.requestedAmount,
        amountGived: editingLoan.amountGived,
        comissionAmount: editingLoan.comissionAmount,
        loantypeId: editingLoan.loantype?.id,
        avalData: ((editingLoan as any).selectedCollateralId
          ? {
              selectedCollateralId: (editingLoan as any).selectedCollateralId,
              action: 'connect' as const
            }
          : (
              ((editingLoan as any).avalName || (editingLoan as any).avalPhone)
                ? {
                    name: (editingLoan as any).avalName || '',
                    phone: (editingLoan as any).avalPhone || '',
                    action: (editingLoan as any).avalAction || 'create'
                  }
                : { action: 'clear' as const }
            ))
      };

      const { data } = await updateLoanWithAval({
        variables: {
          where: editingLoan.id,
          data: loanData
        }
      });

      const response = data?.updateLoanWithAval;

      if (response?.success) {
        if (response.loan) {
          setLoans(prevLoans =>
            prevLoans.map(loan => loan.id === editingLoan.id ? response.loan : loan)
          );
        }

        Promise.all([
          refetchLoans(),
          refetchRoute()
        ]).then(() => {
          console.log('✅ Préstamo actualizado y datos refrescados');
        });

        triggerRefresh();
        setEditingLoan(null);
      } else {
        throw new Error(response?.message || 'Error desconocido al actualizar préstamo');
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
            onBalanceUpdate(0);
          }
        });
        triggerRefresh();
      }
    } catch (error) {
      console.error('Error al eliminar el préstamo:', error);
      await refetchLoans();
    } finally {
      setIsDeleting(null);
    }
  };

  const getDropdownPosition = (loanId: string) => {
    const buttonElement = buttonRefs.current[loanId];
    if (!buttonElement) {
      return { top: 0, left: 0 };
    }
    
    const rect = buttonElement.getBoundingClientRect();
    return {
      top: rect.top - 10,
      left: rect.left - 140,
    };
  };

  const handleApplyMassCommission = () => {
    const commission = parseFloat(massCommission);
    if (isNaN(commission)) return;
    
    const updatedPendingLoans = pendingLoans.map(loan => {
      const currentCommission = parseFloat(loan.comissionAmount?.toString() || '0');
      if (currentCommission > 0) {
        return {
          ...loan,
          comissionAmount: Math.round(commission).toString()
        };
      }
      return loan;
    });
    
    setPendingLoans(updatedPendingLoans);
  };

  // Generar ID único para préstamos temporales
  const generateLoanId = useCallback(() => `temp-loan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

  // Crear fila vacía
  const emptyLoanRow = React.useMemo<ExtendedLoan>(() => ({
    id: generateLoanId(),
    requestedAmount: '',
    amountGived: '',
    amountToPay: '',
    pendingAmount: '0',
    signDate: selectedDate?.toISOString() || '',
    comissionAmount: '0',
    avalName: '',
    avalPhone: '',
    selectedCollateralId: undefined,
    selectedCollateralPhoneId: undefined,
    avalAction: 'clear' as const,
    collaterals: [],
    loantype: undefined,
    borrower: { 
      id: '', 
      personalData: { 
        id: '', 
        fullName: '', 
        phones: [{ id: '', number: '' }] 
      } 
    },
    previousLoan: undefined,
    previousLoanOption: null,
  }), [selectedDate, generateLoanId]);

  // Opciones de préstamos anteriores
  const getPreviousLoanOptions = useCallback((rowId: string) => {
    const searchText = dropdownSearchTextByRow[rowId] || '';
    // Siempre buscar en todas las localidades (no filtrar por lead)
    const loans = allPreviousLoansData?.loans || [];

    if (!loans || loans.length === 0) {
      return [];
    }

    // IDs de clientes que ya tienen renovaciones en la fecha actual
    const renewedTodayBorrowerIds = new Set<string>([
      ...(loans.filter((l: any) => l.previousLoan).map((l: any) => l.borrower?.id).filter(Boolean) || []),
      ...(pendingLoans.filter(l => l.previousLoan).map(l => l.borrower?.id).filter(Boolean) || []),
    ]);

    // Obtener el ÚLTIMO crédito de cada cliente (activo o terminado)
    // Esto evita duplicados y solo muestra el préstamo más reciente por cliente
    const latestBorrowerLoans = loans.reduce((acc: { [key: string]: any }, loan: any) => {
      const borrowerId = loan.borrower?.id;
      if (borrowerId && !renewedTodayBorrowerIds.has(borrowerId)) {
        // Si no existe en el acumulador o este préstamo es más reciente, actualizar
        if (!acc[borrowerId] || new Date(loan.signDate) > new Date(acc[borrowerId].signDate)) {
          acc[borrowerId] = loan;
        }
      }
      return acc;
    }, {});

    // Convertir a array y ordenar por fecha de firma (más reciente primero)
    return Object.values(latestBorrowerLoans)
      .sort((a: any, b: any) => new Date(b.signDate).getTime() - new Date(a.signDate).getTime())
      .map((loan: any) => {
        // Acceder a la localidad del líder asociado al préstamo: Loan->Lead->PersonalData->Address->Location->Municipality
        const leadAddress = loan.lead?.personalData?.addresses?.[0];
        const leadLocation = leadAddress?.location;
        const location = leadLocation?.name || 'Sin localidad';
        const municipality = leadLocation?.municipality?.name || null;
        const state = leadLocation?.municipality?.state?.name || null;
        const leaderName = loan.lead?.personalData?.fullName || 'Sin líder';
        const pendingAmount = parseFloat(loan.pendingAmountStored || '0');
        const hasDebt = pendingAmount > 0;

        // Construir el label solo con el nombre (la localidad se muestra como badge separado)
        const label = `${loan.borrower?.personalData?.fullName || 'Sin nombre'}`;

        return {
          value: loan.id,
          label: label,
          loanData: loan,
          hasDebt,
          statusColor: hasDebt ? '#FEF3C7' : '#D1FAE5',
          statusTextColor: hasDebt ? '#92400E' : '#065F46',
          debtColor: hasDebt ? '#DC2626' : '#059669',
          locationColor: '#3B82F6',
          location,
          municipality,
          state,
          debtAmount: Math.round(parseFloat(String(pendingAmount || '0'))).toString(),
          leaderName,
        };
      });
  }, [allPreviousLoansData, pendingLoans, dropdownSearchTextByRow]);

  // Manejar cambios en la fila
  const handleRowChange = useCallback((index: number, field: string, value: any, isNewRow: boolean) => {
    const sourceRow = isNewRow 
      ? (editableEmptyRow || { ...emptyLoanRow, id: generateLoanId() }) 
      : pendingLoans[index];

    let updatedRow = { ...sourceRow };

    if (field === 'previousLoan') {
      if (value?.value) {
        const selectedLoan = value.loanData;
        const pendingAmount = Math.round(parseFloat(selectedLoan.pendingAmountStored || '0')).toString();
        const selectedType = loanTypesData?.loantypes?.find((type: any) => type.id === selectedLoan.loantype?.id);
        
        updatedRow = {
          ...updatedRow,
          previousLoanOption: value,
          previousLoan: { ...selectedLoan, pendingAmount },
          borrower: selectedLoan.borrower as any,
          avalName: selectedLoan.collaterals?.[0]?.fullName || '',
          avalPhone: selectedLoan.collaterals?.[0]?.phones?.[0]?.number || '',
          selectedCollateralId: selectedLoan.collaterals?.[0]?.id,
          selectedCollateralPhoneId: selectedLoan.collaterals?.[0]?.phones?.[0]?.id,
          avalAction: selectedLoan.collaterals?.length > 0 ? 'connect' as const : 'clear' as const,
          loantype: selectedLoan.loantype,
          requestedAmount: selectedLoan.requestedAmount,
          comissionAmount: (selectedType?.loanGrantedComission ?? 0).toString(),
        };
      } else {
        updatedRow = { 
          ...updatedRow, 
          previousLoanOption: null, 
          previousLoan: undefined, 
          borrower: emptyLoanRow.borrower as any,
          avalName: '',
          avalPhone: '',
          selectedCollateralId: undefined,
          selectedCollateralPhoneId: undefined,
          avalAction: 'clear' as const,
          collaterals: [],
          loantype: undefined,
          requestedAmount: '',
          comissionAmount: '0',
          amountGived: '',
          amountToPay: ''
        };
      }
    } else if (field === 'loantype') {
      const selectedType = loanTypesData?.loantypes?.find((t: any) => t.id === value.value);
      updatedRow.loantype = selectedType;
      updatedRow.comissionAmount = (selectedType?.loanGrantedComission ?? 0).toString();
    } else if (field === 'clientData') {
      console.log('🟠 handleRowChange - clientData:', {
        clientName: value.clientName,
        clientPhone: value.clientPhone,
        index,
        isNewRow,
        previousBorrowerName: updatedRow.borrower?.personalData?.fullName
      });
      const currentPersonalData = updatedRow.borrower?.personalData;
      const currentPhoneId = currentPersonalData?.phones?.[0]?.id || '';
      updatedRow.borrower = { 
        ...updatedRow.borrower, 
        personalData: { 
          ...currentPersonalData, 
          fullName: value.clientName, 
          phones: [{ id: currentPhoneId, number: value.clientPhone }] 
        } 
      } as any;
    } else if (field === 'avalData') {
      const collateral = value.selectedCollateralId
        ? {
            id: value.selectedCollateralId,
            fullName: value.avalName,
            phones: [{ id: value.selectedCollateralPhoneId, number: value.avalPhone }],
          }
        : null;

      updatedRow = {
        ...updatedRow,
        collaterals: collateral ? [collateral] : [],
        selectedCollateralId: value.selectedCollateralId,
        selectedCollateralPhoneId: value.selectedCollateralPhoneId,
        avalAction: value.avalAction,
        avalName: value.avalName,
        avalPhone: value.avalPhone,
      } as ExtendedLoan;
    } else {
      updatedRow = { ...updatedRow, [field]: value };
    }

    // Calcular montos si cambian campos relevantes
    if (['requestedAmount', 'loantype', 'previousLoan'].includes(field)) {
      const { amountGived, amountToPay, totalDebtAcquired } = calculateLoanAmounts({
        requestedAmount: updatedRow.requestedAmount || '0',
        pendingAmount: updatedRow.previousLoan?.pendingAmount || '0',
        rate: updatedRow.loantype?.rate || '0',
      });
      updatedRow.amountGived = amountGived;
      updatedRow.amountToPay = amountToPay;
      updatedRow.totalDebtAcquired = totalDebtAcquired;
    }

    if (isNewRow) {
      setEditableEmptyRow(updatedRow);
    } else {
      setPendingLoans(prev => prev.map((loan, i) => i === index ? updatedRow : loan));
    }
  }, [editableEmptyRow, pendingLoans, emptyLoanRow, loanTypesData, generateLoanId]);

  // Auto-agregar a pendientes cuando tiene datos requeridos
  React.useEffect(() => {
    if (!editableEmptyRow) return;
    const hasRequiredInfo = editableEmptyRow.borrower?.personalData?.fullName?.trim() &&
                            editableEmptyRow.loantype?.id &&
                            editableEmptyRow.requestedAmount?.trim() &&
                            parseFloat(editableEmptyRow.requestedAmount) > 0;

    if (hasRequiredInfo) {
      const isAlreadyPending = pendingLoans.some(p => p.id === editableEmptyRow.id);
      if (!isAlreadyPending) {
        setPendingLoans(prev => [...prev, editableEmptyRow]);
        setEditableEmptyRow(null);
      }
    }
  }, [editableEmptyRow, pendingLoans]);

  const handleDateMoveSuccess = React.useCallback(() => {
    Promise.all([refetchLoans(), refetchRoute(), refetchPreviousLoans()]).then(() => {
      setPendingLoans([]);
    }).catch(error => console.error('❌ Error al refrescar datos:', error));
  }, [refetchLoans, refetchRoute, refetchPreviousLoans]);

  const usedAvalIds = React.useMemo(() => {
    const usedIds = new Set<string>();
    if (selectedDate) {
      if (loansData?.loans) {
        loansData.loans.forEach((loan: any) => loan.collaterals?.forEach((c: any) => usedIds.add(c.id)));
      }
      pendingLoans.forEach((loan: any) => {
        if (loan.selectedCollateralId) {
          usedIds.add(loan.selectedCollateralId);
        }
      });
    }
    return Array.from(usedIds);
  }, [selectedDate, loansData?.loans, pendingLoans]);

  const existingTotals = React.useMemo(() => loans.reduce((acc, loan) => ({
    count: acc.count + 1,
    amountGived: acc.amountGived + parseFloat(loan.amountGived || '0'),
    amountToPay: acc.amountToPay + parseFloat(loan.totalDebtAcquired || '0'),
    totalComission: acc.totalComission + parseFloat(loan.comissionAmount || '0'),
    newLoans: acc.newLoans + (loan.previousLoan ? 0 : 1),
    renewals: acc.renewals + (loan.previousLoan ? 1 : 0),
  }), { count: 0, amountGived: 0, amountToPay: 0, totalComission: 0, newLoans: 0, renewals: 0 }), [loans]);

  const pendingTotals = React.useMemo(() => pendingLoans.reduce((acc, loan) => ({
    count: acc.count + 1,
    amountGived: acc.amountGived + parseFloat(loan.amountGived || '0'),
    amountToPay: acc.amountToPay + parseFloat(loan.totalDebtAcquired || '0'),
    totalComission: acc.totalComission + parseFloat(loan.comissionAmount || '0'),
    newLoans: acc.newLoans + (loan.previousLoan ? 0 : 1),
    renewals: acc.renewals + (loan.previousLoan ? 1 : 0),
  }), { count: 0, amountGived: 0, amountToPay: 0, totalComission: 0, newLoans: 0, renewals: 0 }), [pendingLoans]);

  const totals = React.useMemo(() => ({
    count: existingTotals.count + pendingTotals.count,
    amountGived: existingTotals.amountGived + pendingTotals.amountGived,
    amountToPay: existingTotals.amountToPay + pendingTotals.amountToPay,
    totalComission: existingTotals.totalComission + pendingTotals.totalComission,
    newLoans: existingTotals.newLoans + pendingTotals.newLoans,
    renewals: existingTotals.renewals + pendingTotals.renewals,
  }), [existingTotals, pendingTotals]);

  const loanTypeOptions = React.useMemo(() => 
    loanTypesData?.loantypes?.map((type: any) => ({
      label: type.name,
      value: type.id,
      weekDuration: type.weekDuration,
      rate: type.rate,
      typeData: type
    })) || [],
  [loanTypesData]);

  // Estado para el modal de mover fecha - MOVIDO AQUÍ ANTES DE RETURNS CONDICIONALES
  const [isDateMoverOpen, setIsDateMoverOpen] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [isMovingDate, setIsMovingDate] = useState(false);
  const [showPrimaryMenu, setShowPrimaryMenu] = useState(false);
  const [moveDate] = useMutation(MOVE_LOANS_TO_DATE);

  if (loansLoading || loanTypesLoading || previousLoansLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        borderRadius: '12px',
        margin: '20px',
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px',
        }} />
        <div style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '8px',
        }}>
          Cargando créditos...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (loansError) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{
          padding: '16px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          color: '#991B1B',
        }}>
          Error al cargar los préstamos. Por favor, intenta de nuevo.
        </div>
      </div>
    );
  }

  if (!selectedDate || !selectedRoute || !selectedLead) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        borderRadius: '12px',
        margin: '20px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>💰</div>
        <div style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '8px',
        }}>
          Selecciona Ruta y Localidad
        </div>
        <div style={{
          fontSize: '14px',
          color: '#6b7280',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          Para gestionar los créditos, necesitas seleccionar una ruta y una localidad específica.
        </div>
      </div>
    );
  }

  const handleMoveDate = async () => {
    if (!targetDate || !selectedDate || !selectedLead) return;
    
    setIsMovingDate(true);
    try {
      const { data } = await moveDate({
        variables: {
          sourceDate: selectedDate.toISOString(),
          targetDate: new Date(targetDate).toISOString(),
          leadId: selectedLead.id
        }
      });

      if (data?.moveLoansToDate?.success) {
        setIsDateMoverOpen(false);
        setTargetDate('');
        handleDateMoveSuccess();
      } else {
        alert(data?.moveLoansToDate?.message || 'Error al mover préstamos');
      }
    } catch (error) {
      console.error('Error al mover préstamos:', error);
      alert('Error al mover préstamos');
    } finally {
      setIsMovingDate(false);
    }
  };

  return (
    <div style={{ paddingTop: '24px' }}>
      {/* AlertDialog de localidad diferente */}
      {(() => {
        console.log('🎭 Renderizando AlertDialog de localidad:', {
          open: locationMismatchDialogOpen.open,
          clientLocation: locationMismatchDialogOpen.clientLocation,
          leadLocation: locationMismatchDialogOpen.leadLocation,
          fullState: locationMismatchDialogOpen
        });
        return null;
      })()}
      <AlertDialog
        open={locationMismatchDialogOpen.open}
        onOpenChange={(open) => {
          console.log('🔄 AlertDialog onOpenChange llamado:', { open, currentState: locationMismatchDialogOpen });
          setLocationMismatchDialogOpen({ open, clientLocation: '', leadLocation: '' });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FaExclamationTriangle size={24} style={{ color: '#F59E0B', flexShrink: 0 }} />
              <AlertDialogTitle>Localidad diferente</AlertDialogTitle>
            </div>
            <AlertDialogDescription style={{ marginTop: '8px' }}>
              Estás seleccionando un cliente de la localidad <strong>{locationMismatchDialogOpen.clientLocation}</strong>, 
              que es diferente a la localidad seleccionada en el dropdown ({locationMismatchDialogOpen.leadLocation}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              console.log('❌ Botón Entendido clickeado');
              setLocationMismatchDialogOpen({ open: false, clientLocation: '', leadLocation: '' });
            }}>
              Entendido
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Barra de KPIs - Versión HTML nativa tipo shadcn/ui */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Chips de KPIs */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '8px', 
          alignItems: 'center',
          flex: '1 1 auto',
        }}>
          {[
            { label: 'Créditos', value: totals.count, color: '#374151', bg: '#F3F4F6', border: '#E5E7EB' },
            { label: 'Nuevos', value: totals.newLoans, color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
            { label: 'Renovaciones', value: totals.renewals, color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
            { label: 'Otorgado', value: `$${totals.amountGived.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: '#BE185D', bg: '#FDF2F8', border: '#FBCFE8' },
            { label: 'A Pagar', value: `$${totals.amountToPay.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: '#166534', bg: '#F0FDF4', border: '#BBF7D0' },
            { label: 'Comisiones', value: `$${totals.totalComission.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: '#6D28D9', bg: '#EDE9FE', border: '#DDD6FE' },
          ].map((chip, index) => (
            <span key={index} style={{ 
              fontSize: '12px', 
              color: chip.color, 
              background: chip.bg, 
              border: `1px solid ${chip.border}`, 
              padding: '6px 12px', 
              borderRadius: '999px', 
              fontWeight: '500' 
            }}>
              {chip.label}: {chip.value}
            </span>
          ))}
          
          {/* Comisión Masiva */}
          {pendingLoans.length > 0 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '11px', 
              color: '#6B7280', 
              background: '#F8FAFC', 
              border: '1px solid #E2E8F0', 
              padding: '6px 10px', 
              borderRadius: '999px',
              fontWeight: '500'
            }}>
              <span>Comisión:</span>
              <input
                type="number"
                value={massCommission}
                onChange={(e) => setMassCommission(e.target.value)}
                style={{
                  width: '60px',
                  height: '32px',
                  padding: '6px 12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  fontSize: '11px',
                  textAlign: 'center'
                }}
                placeholder="0"
              />
              <Button
                onClick={handleApplyMassCommission}
                size="sm"
                variant="default"
                style={{
                  backgroundColor: '#16a34a',
                  color: 'white',
                  fontSize: '11px',
                  height: '32px',
                  minWidth: 'auto',
                }}
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          position: 'relative'
        }}>
          {/* Botón principal con menú */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch' }}>
            <div style={{
              display: 'inline-flex',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid #15803d'
            }}>
              <Button
                onClick={handleSaveAllNewLoans}
                disabled={pendingLoans.length === 0 || isCreating}
                size="sm"
                variant="default"
                style={{
                  backgroundColor: isCreating ? '#9CA3AF' : '#16a34a',
                  color: 'white',
                  fontSize: '12px',
                  height: '32px',
                  fontWeight: '700',
                  borderRight: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 0,
                }}
              >
                {isCreating ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button
                onClick={(e) => { e.stopPropagation(); setShowPrimaryMenu(!showPrimaryMenu); }}
                disabled={pendingLoans.length === 0}
                size="icon"
                variant="default"
                style={{
                  backgroundColor: '#16a34a',
                  color: 'white',
                  fontSize: '12px',
                  height: '32px',
                  width: '32px',
                  padding: '0',
                  borderRadius: 0,
                }}
                title="Más opciones"
              >
                <FaEllipsisV size={12} />
              </Button>
            </div>
            {showPrimaryMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: '180px',
                zIndex: 1000
              }}>
                <Button
                  onClick={() => {
                    console.log('Reportar falco de créditos');
                    setShowPrimaryMenu(false);
                  }}
                  variant="ghost"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    padding: '8px 12px',
                    fontSize: '13px',
                  }}
                >
                  Reportar Falco
                </Button>
                <Button
                  onClick={() => {
                    if (loans.length > 0) {
                      setIsDateMoverOpen(true);
                    }
                    setShowPrimaryMenu(false);
                  }}
                  disabled={loans.length === 0}
                  variant="ghost"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderTop: '1px solid #E5E7EB',
                    borderRadius: 0,
                  }}
                >
                  Mover Créditos
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de Préstamos */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        marginTop: '24px',
      }}>
        <div ref={existingLoansTableRef} style={{ 
          padding: '12px', 
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <Table style={{ fontSize: '13px' }}>
            <TableHeader>
              <TableRow>
                <TableHead style={{ minWidth: '80px' }}>Préstamo Previo</TableHead>
                <TableHead style={{ minWidth: '80px' }}>Tipo</TableHead>
                <TableHead style={{ minWidth: '80px' }}>Nombre</TableHead>
                <TableHead style={{ minWidth: '80px' }}>Teléfono</TableHead>
                <TableHead style={{ minWidth: '80px' }}>M. Solicitado</TableHead>
                <TableHead style={{ minWidth: '80px' }}>Deuda Pendiente</TableHead>
                <TableHead style={{ minWidth: '80px' }}>M. Entregado</TableHead>
                <TableHead style={{ minWidth: '80px' }}>M. a Pagar</TableHead>
                <TableHead style={{ minWidth: '80px' }}>Comisión</TableHead>
                <TableHead style={{ minWidth: '80px' }}>Aval</TableHead>
                <TableHead style={{ minWidth: '80px' }}>Tel. Aval</TableHead>
                <TableHead style={{ width: '40px', minWidth: '40px' }}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((loan) => (
                <TableRow 
                  key={loan.id} 
                  style={{ 
                    backgroundColor: loan.id === newLoanId ? '#F0F9FF' : 'white',
                    position: 'relative' 
                  }}
                >
                  {loan.id === newLoanId && (
                    <td colSpan={12} style={{ 
                      position: 'absolute', 
                      left: 0, 
                      top: 0, 
                      width: '3px', 
                      height: '100%', 
                      backgroundColor: '#0052CC' 
                    }} />
                  )}
                  <TableCell style={{ fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {loan.previousLoan ? 
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          padding: '4px 8px', 
                          backgroundColor: '#F0F9FF', 
                          color: '#0052CC', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          fontWeight: '500' 
                        }}>Renovado</span> 
                        : 
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          padding: '4px 8px', 
                          backgroundColor: '#F0FDF4', 
                          color: '#059669', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          fontWeight: '500' 
                        }}>Nuevo</span>
                      }
                      {hasPaymentForToday(loan.id) ? (
                        <div style={{ 
                          fontSize: '11px', 
                          padding: '8px 12px',
                          height: '32px',
                          backgroundColor: '#F3F4F6',
                          color: '#6B7280',
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '500',
                        }}>
                          <span>✓</span>
                          Pagado ${getRegisteredPaymentAmount(loan.id)}
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleToggleInitialPayment(loan.id)}
                          size="sm"
                          variant={initialPayments[loan.id] ? 'default' : 'secondary'}
                          style={{ 
                            fontSize: '11px', 
                            height: '32px',
                            backgroundColor: initialPayments[loan.id] ? '#3B82F6' : '#10B981',
                            color: 'white',
                          }}
                        >
                          {initialPayments[loan.id] ? (
                            <>
                              <span>✓</span>
                              Pago configurado
                            </>
                          ) : (
                            <>
                              <span>💰</span>
                              Registrar pago
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell style={{ fontSize: '11px' }}>{loan.loantype.name}</TableCell>
                  <TableCell style={{ fontSize: '11px' }}>{loan.borrower?.personalData?.fullName || 'Sin nombre'}</TableCell>
                  <TableCell style={{ fontSize: '11px' }}>{loan.borrower?.personalData?.phones?.[0]?.number || '-'}</TableCell>
                  <TableCell style={{ fontSize: '11px' }}>${Math.round(parseFloat(loan.requestedAmount || '0')).toLocaleString('es-MX')}</TableCell>
                  <TableCell style={{ fontSize: '11px' }}>${Math.round(parseFloat(loan.previousLoan?.pendingAmount || '0')).toLocaleString('es-MX')}</TableCell>
                  <TableCell style={{ fontSize: '11px' }}>${Math.round(parseFloat(loan.amountGived || '0')).toLocaleString('es-MX')}</TableCell>
                  <TableCell style={{ fontSize: '11px' }}>{loan.totalDebtAcquired ? `$${Math.round(parseFloat(loan.totalDebtAcquired || '0')).toLocaleString('es-MX')}` : 'N/A'}</TableCell>
                  <TableCell style={{ fontSize: '11px' }}>${Math.round(parseFloat(loan.comissionAmount || '0')).toLocaleString('es-MX')}</TableCell>
                  <TableCell style={{ fontSize: '11px' }}>{loan.collaterals?.[0]?.fullName || (loan as any).avalName || '-'}</TableCell>
                  <TableCell style={{ fontSize: '11px' }}>{loan.collaterals?.[0]?.phones?.[0]?.number || (loan as any).avalPhone || '-'}</TableCell>
                  <TableCell style={{ width: '40px', position: 'relative' }}>
                    {isDeleting === loan.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '32px' }}>
                        <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
                      </div>
                    ) : (
                      <Button
                        ref={el => { buttonRefs.current[loan.id] = el; }}
                        onClick={() => setActiveMenu(activeMenu === loan.id ? null : loan.id)}
                        variant="ghost"
                        size="icon"
                        style={{
                          minWidth: '40px',
                          height: '32px',
                        }}
                        title="Opciones del préstamo"
                      >
                        ⋮
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Sección de Agregar Nuevos Préstamos - Versión HTML nativa */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ 
          position: 'relative',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{ 
            padding: '16px',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#1F2937',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>➕</span>
              <span>{pendingLoans.length > 0 ? `Préstamos Pendientes (${pendingLoans.length})` : 'Agregar Nuevos Préstamos'}</span>
            </h3>
          </div>
          <div style={{ 
            padding: '12px', 
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
            <Table style={{ fontSize: '13px' }}>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ minWidth: '320px', backgroundColor: '#E0F2FE' }}>Cliente / Renovación</TableHead>
                  <TableHead style={{ minWidth: '150px', backgroundColor: '#E0F2FE' }}>Tipo</TableHead>
                  <TableHead style={{ minWidth: '120px', backgroundColor: '#E0F2FE' }}>M. Solicitado</TableHead>
                  <TableHead style={{ minWidth: '140px', backgroundColor: '#E0F2FE' }}>M. Entregado</TableHead>
                  <TableHead style={{ minWidth: '70px', width: '70px', backgroundColor: '#E0F2FE' }}>Comisión</TableHead>
                  <TableHead style={{ minWidth: '220px', backgroundColor: '#E0F2FE' }}>Aval</TableHead>
                  <TableHead style={{ width: '100px', backgroundColor: '#E0F2FE' }}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...pendingLoans, editableEmptyRow || emptyLoanRow].map((loan, index) => {
                  const isNewRow = index === pendingLoans.length;
                  const loanId = loan.id || `temp-${index}`;
                  const previousLoanOptions = getPreviousLoanOptions(loanId);
                  const loanTypeOptions = loanTypesData?.loantypes?.map((type: any) => ({
                    value: type.id,
                    label: `${type.name} (${type.weekDuration} sem, ${type.rate}%)`,
                    weekDuration: type.weekDuration,
                    rate: type.rate,
                  })) || [];

                  return (
                    <TableRow 
                      key={loanId} 
                      style={{ 
                        backgroundColor: isNewRow ? '#FFFFFF' : '#F0FDF4',
                      }}
                    >
                      {/* Cliente / Renovación */}
                      <TableCell style={{ minWidth: '320px' }}>
                        <div style={{ paddingTop: '10px' }}>
                          <ClientLoanUnifiedInput
                            loanId={loanId}
                            currentName={loan.borrower?.personalData?.fullName || ''}
                            currentPhone={loan.borrower?.personalData?.phones?.[0]?.number || ''}
                            previousLoanOption={loan.previousLoanOption}
                            previousLoan={loan.previousLoan}
                            clientPersonalDataId={loan.borrower?.personalData?.id}
                            clientPhoneId={loan.borrower?.personalData?.phones?.[0]?.id}
                            onNameChange={(name) => {
                              console.log('🔴 onNameChange llamado desde padre:', {
                                name,
                                index,
                                isNewRow,
                                currentLoanName: loan.borrower?.personalData?.fullName
                              });
                              const currentPhone = loan.borrower?.personalData?.phones?.[0]?.number || '';
                              handleRowChange(index, 'clientData', { clientName: name, clientPhone: currentPhone, action: 'create' }, isNewRow);
                            }}
                            onPhoneChange={(phone) => {
                              const currentName = loan.borrower?.personalData?.fullName || '';
                              handleRowChange(index, 'clientData', { clientName: currentName, clientPhone: phone, action: 'create' }, isNewRow);
                            }}
                            onPreviousLoanSelect={(option) => {
                              handleRowChange(index, 'previousLoan', option, isNewRow);
                            }}
                            onPreviousLoanClear={() => {
                              handleRowChange(index, 'previousLoan', null, isNewRow);
                            }}
                            onClientDataChange={(data) => {
                              handleRowChange(index, 'clientData', data, isNewRow);
                            }}
                            previousLoanOptions={previousLoanOptions}
                            isLoading={allPreviousLoansLoading || isSearchingLoans}
                            selectedLeadLocationId={selectedLeadLocation?.id}
                            onLocationMismatch={(clientLocation, leadLocation) => {
                              console.log('🚨 onLocationMismatch llamado en CreditosTabNew:', {
                                clientLocation,
                                leadLocation,
                                selectedLeadLocation,
                                selectedLeadLocationName: selectedLeadLocation?.name,
                                currentDialogState: locationMismatchDialogOpen
                              });
                              
                              const newState = {
                                open: true,
                                clientLocation,
                                leadLocation: selectedLeadLocation?.name || 'desconocida'
                              };
                              
                              console.log('🚨 Actualizando locationMismatchDialogOpen a:', newState);
                              setLocationMismatchDialogOpen(newState);
                              
                              // Verificar el estado después de un pequeño delay
                              setTimeout(() => {
                                console.log('🚨 Estado después de actualizar:', locationMismatchDialogOpen);
                              }, 100);
                            }}
                            onSearchTextChange={(text) => {
                              setDropdownSearchTextByRow(prev => ({
                                ...prev,
                                [loanId]: text
                              }));
                            }}
                          />
                        </div>
                      </TableCell>

                      {/* Tipo */}
                      <TableCell style={{ minWidth: '150px' }}>
                        <div style={{ paddingTop: '10px' }}>
                          <Select
                            value={loanTypeOptions.find((opt: any) => opt.value === loan.loantype?.id)?.value || ''}
                            onChange={(e) => {
                              const selectedOption = loanTypeOptions.find((opt: any) => opt.value === e.target.value);
                              if (selectedOption) {
                                handleRowChange(index, 'loantype', { value: selectedOption.value }, isNewRow);
                              }
                            }}
                            style={{ 
                              height: '28px',
                              fontSize: '12px',
                              padding: '0 8px',
                              paddingRight: '28px'
                            }}
                          >
                            <option value="">Tipo...</option>
                            {loanTypeOptions.map((opt: any) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </Select>
                        </div>
                      </TableCell>

                      {/* Monto Solicitado */}
                      <TableCell style={{ minWidth: '120px' }}>
                        <div style={{ paddingTop: '10px' }}>
                          <Input
                            placeholder="0"
                            type="number"
                            value={loan.requestedAmount || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Solo permitir números enteros (sin decimales)
                              const numericValue = value.replace(/[^0-9]/g, '');
                              const newValue = (loan.requestedAmount === '0' && numericValue.length > 1) 
                                ? numericValue.substring(1) 
                                : numericValue;
                              handleRowChange(index, 'requestedAmount', newValue, isNewRow);
                            }}
                            style={{ 
                              height: '28px', 
                              fontSize: '12px',
                              padding: '0 8px'
                            }}
                          />
                        </div>
                      </TableCell>

                      {/* Monto Entregado */}
                      <TableCell style={{ minWidth: '140px' }}>
                        <div style={{ paddingTop: '10px' }}>
                          <Input
                            placeholder="0"
                            type="number"
                            value={loan.amountGived || ''}
                            readOnly
                            disabled
                            style={{ 
                              height: '28px', 
                              fontSize: '12px',
                              padding: '0 8px'
                            }}
                          />
                        </div>
                      </TableCell>

                      {/* Comisión */}
                      <TableCell style={{ minWidth: '70px', width: '70px' }}>
                        <div style={{ paddingTop: '10px' }}>
                          <Input
                            placeholder="0"
                            type="number"
                            value={loan.comissionAmount || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Solo permitir números enteros (sin decimales)
                              const numericValue = value.replace(/[^0-9]/g, '');
                              const newValue = (loan.comissionAmount === '0' && numericValue.length > 1) 
                                ? numericValue.substring(1) 
                                : numericValue;
                              handleRowChange(index, 'comissionAmount', newValue, isNewRow);
                            }}
                            style={{ 
                              height: '28px', 
                              fontSize: '12px',
                              padding: '0 6px',
                              maxWidth: '70px'
                            }}
                          />
                        </div>
                      </TableCell>

                      {/* Aval */}
                      <TableCell style={{ minWidth: '220px' }}>
                        <div style={{ paddingTop: '10px' }}>
                          <ClientLoanUnifiedInput
                            loanId={`${loanId}-aval`}
                            currentName={loan.avalName || ''}
                            currentPhone={loan.avalPhone || ''}
                            previousLoanOption={undefined}
                            previousLoan={undefined}
                            clientPersonalDataId={loan.selectedCollateralId}
                            clientPhoneId={loan.selectedCollateralPhoneId}
                            onNameChange={(name) => {
                              const currentPhone = loan.avalPhone || '';
                              handleRowChange(index, 'avalData', {
                                avalName: name,
                                avalPhone: currentPhone,
                                selectedCollateralId: undefined,
                                selectedCollateralPhoneId: undefined,
                                avalAction: 'create'
                              }, isNewRow);
                            }}
                            onPhoneChange={(phone) => {
                              const currentName = loan.avalName || '';
                              handleRowChange(index, 'avalData', {
                                avalName: currentName,
                                avalPhone: phone,
                                selectedCollateralId: undefined,
                                selectedCollateralPhoneId: undefined,
                                avalAction: 'create'
                              }, isNewRow);
                            }}
                            onPreviousLoanSelect={() => {}}
                            onPreviousLoanClear={() => {
                              handleRowChange(index, 'avalData', {
                                avalName: '',
                                avalPhone: '',
                                selectedCollateralId: undefined,
                                selectedCollateralPhoneId: undefined,
                                avalAction: 'clear'
                              }, isNewRow);
                            }}
                            onClientDataChange={(data) => {
                              handleRowChange(index, 'avalData', {
                                avalName: data.clientName,
                                avalPhone: data.clientPhone,
                                selectedCollateralId: data.selectedPersonId,
                                selectedCollateralPhoneId: data.selectedPersonPhoneId,
                                avalAction: data.action
                              }, isNewRow);
                            }}
                            previousLoanOptions={[]}
                            mode="aval"
                            usedPersonIds={usedAvalIds}
                            borrowerLocationId={loan.borrower?.personalData?.addresses?.[0]?.location?.id}
                            selectedPersonId={loan.selectedCollateralId}
                            namePlaceholder="Buscar o escribir nombre del aval..."
                            phonePlaceholder="Teléfono..."
                          />
                        </div>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell style={{ width: '100px' }}>
                        <div style={{ paddingTop: '10px', display: 'flex', gap: '4px' }}>
                          {!isNewRow && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletePendingLoanDialogOpen({ open: true, loanIndex: index });
                              }}
                              style={{ padding: '4px 8px' }}
                            >
                              <FaTrash size={12} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        {pendingLoans.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '20px',
            padding: '20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              fontSize: '14px', 
              color: '#374151', 
              fontWeight: '500' 
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }} />
              <span>
                {pendingLoans.length} préstamo{pendingLoans.length > 1 ? 's' : ''} pendiente{pendingLoans.length > 1 ? 's' : ''} de guardar
              </span>
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.5; }
                }
              `}</style>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button
                variant="outline"
                size="default"
                onClick={() => setPendingLoans([])}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                size="default"
                onClick={handleSaveAllNewLoans}
                disabled={isCreating || pendingLoans.length === 0}
                style={{
                  backgroundColor: isCreating ? '#9CA3AF' : '#10B981',
                  color: '#FFFFFF',
                }}
              >
                {isCreating ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid #FFFFFF',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }} />
                    Guardando...
                    <style>{`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                    `}</style>
                  </span>
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dropdown de opciones */}
      {activeMenu !== null && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            ...getDropdownPosition(activeMenu),
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)',
            pointerEvents: 'auto',
            minWidth: '160px',
            zIndex: 10000,
            transform: 'translateY(-100%)',
          }}
        >
          {loans.map((loan) => (
            activeMenu === loan.id && (
              <React.Fragment key={`dropdown-${loan.id}`}>
                <Button
                  onClick={() => {
                    handleEditLoan(loan);
                    setActiveMenu(null);
                  }}
                  variant="ghost"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    padding: '8px 16px',
                    fontSize: '14px',
                  }}
                >
                  <FaEdit size={14} style={{ marginRight: '8px' }} />
                  Editar
                </Button>
                <Button
                  onClick={() => {
                    setDeleteDialogOpen({ open: true, loanId: loan.id });
                    setActiveMenu(null);
                  }}
                  variant="ghost"
                  disabled={isDeleting === loan.id}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    padding: '8px 16px',
                    fontSize: '14px',
                    color: '#DC2626',
                    borderTop: '1px solid #E5E7EB',
                    borderRadius: 0,
                  }}
                >
                  <FaTrash size={14} style={{ marginRight: '8px' }} />
                  <span>Eliminar</span>
                </Button>
              </React.Fragment>
            )
          ))}
        </div>
      )}

      {/* Modal de edición */}
      {editingLoan && (
        <div
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
          onClick={() => setEditingLoan(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '12px',
              width: '500px',
              maxWidth: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', color: '#1a1f36' }}>
              Editar Préstamo
            </h2>
            <p style={{ margin: '0 0 24px 0', color: '#697386', fontSize: '14px' }}>
              Modifica los detalles del préstamo seleccionado
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Deuda Pendiente del Préstamo Anterior
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={editingLoan.previousLoan?.pendingAmount || '0'}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: '#f3f4f6',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Tipo de Préstamo
                </label>
                <select
                  value={editingLoan.loantype?.id || ''}
                  onChange={(e) => {
                    const selectedType = loanTypesData?.loantypes?.find((type: any) => type.id === e.target.value);
                    if (selectedType) {
                      const { amountGived, amountToPay, totalDebtAcquired } = calculateLoanAmounts({
                        requestedAmount: editingLoan.requestedAmount,
                        pendingAmount: editingLoan.previousLoan?.pendingAmount || '0',
                        rate: selectedType.rate
                      });
                      const defaultCommission = selectedType.loanGrantedComission || 0;
                      const comissionAmount = defaultCommission && parseFloat(defaultCommission.toString()) > 0 ?
                        defaultCommission.toString() :
                        editingLoan.comissionAmount || '0';
                      setEditingLoan({ 
                        ...editingLoan, 
                        loantype: { 
                          id: e.target.value, 
                          name: selectedType.name, 
                          rate: selectedType.rate, 
                          weekDuration: selectedType.weekDuration, 
                          loanPaymentComission: selectedType.loanPaymentComission || '0' 
                        } as LoanType, 
                        amountGived, 
                        amountToPay, 
                        totalDebtAcquired, 
                        comissionAmount 
                      });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                  }}
                >
                  {loanTypeOptions.map((option: any) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.weekDuration} sem, {option.rate}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Monto Solicitado
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={editingLoan.requestedAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Solo permitir números enteros (sin decimales)
                    const numericValue = value.replace(/[^0-9]/g, '');
                    const requestedAmount = (editingLoan.requestedAmount === '0' && numericValue.length > 1) ? numericValue.substring(1) : numericValue;
                    const { amountGived, amountToPay, totalDebtAcquired } = calculateLoanAmounts({
                      requestedAmount,
                      pendingAmount: editingLoan.previousLoan?.pendingAmount || '0',
                      rate: editingLoan.loantype.rate
                    });
                    setEditingLoan({ ...editingLoan, requestedAmount, amountGived, amountToPay, totalDebtAcquired });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Monto Entregado
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={editingLoan.amountGived}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: '#f3f4f6',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Monto a Pagar
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={editingLoan.amountToPay}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: '#f3f4f6',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Comisión
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={editingLoan.comissionAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Solo permitir números enteros (sin decimales)
                    const numericValue = value.replace(/[^0-9]/g, '');
                    const comissionAmount = (editingLoan.comissionAmount === '0' && numericValue.length > 1) ? numericValue.substring(1) : numericValue;
                    setEditingLoan({ ...editingLoan, comissionAmount });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Aval - Nombre
                </label>
                <input
                  type="text"
                  placeholder="Nombre del aval"
                  value={(editingLoan as any).avalName || ''}
                  onChange={(e) => {
                    setEditingLoan(prev => ({ 
                      ...prev, 
                      avalName: e.target.value,
                      avalAction: e.target.value ? 'create' : 'clear'
                    } as any));
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Aval - Teléfono
                </label>
                <input
                  type="text"
                  placeholder="Teléfono del aval"
                  value={(editingLoan as any).avalPhone || ''}
                  onChange={(e) => {
                    setEditingLoan(prev => ({ 
                      ...prev, 
                      avalPhone: e.target.value
                    } as any));
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <Button
                onClick={() => setEditingLoan(null)}
                variant="outline"
                size="default"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateLoan}
                disabled={isUpdating === editingLoan.id}
                variant="default"
                size="default"
                style={{
                  backgroundColor: isUpdating === editingLoan.id ? '#9CA3AF' : '#0052CC',
                  color: 'white',
                }}
              >
                {isUpdating === editingLoan.id ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de configuración de pago - Versión HTML nativa tipo shadcn/ui */}
      {selectedPaymentLoan && (
        <div
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
          onClick={() => setSelectedPaymentLoan(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              width: '500px',
              maxWidth: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#1a1f36' }}>
              Configurar Primer Pago
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#697386', fontSize: '14px' }}>
              Cliente: {selectedPaymentLoan.borrower?.personalData?.fullName}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Método de Pago
                </label>
                <select
                  value={initialPayments[selectedPaymentLoan.id]?.paymentMethod || 'CASH'}
                  onChange={(e) => {
                    const currentPayment = initialPayments[selectedPaymentLoan.id] || { amount: '0', paymentMethod: 'CASH', comission: '8' };
                    setInitialPayments({
                      ...initialPayments,
                      [selectedPaymentLoan.id]: {
                        ...currentPayment,
                        paymentMethod: e.target.value as 'CASH' | 'MONEY_TRANSFER'
                      }
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                  }}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="MONEY_TRANSFER">Transferencia</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Monto del Pago
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={initialPayments[selectedPaymentLoan.id]?.amount || '0'}
                  onChange={(e) => {
                    const currentPayment = initialPayments[selectedPaymentLoan.id] || { amount: '0', paymentMethod: 'CASH', comission: '8' };
                    setInitialPayments({
                      ...initialPayments,
                      [selectedPaymentLoan.id]: {
                        ...currentPayment,
                        amount: e.target.value
                      }
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Comisión por Pago ($)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={initialPayments[selectedPaymentLoan.id]?.comission || '8'}
                  onChange={(e) => {
                    const currentPayment = initialPayments[selectedPaymentLoan.id] || { amount: '0', paymentMethod: 'CASH', comission: '8' };
                    setInitialPayments({
                      ...initialPayments,
                      [selectedPaymentLoan.id]: {
                        ...currentPayment,
                        comission: e.target.value
                      }
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: '14px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <Button
                onClick={() => setSelectedPaymentLoan(null)}
                variant="outline"
                size="default"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const payment = initialPayments[selectedPaymentLoan.id];
                  if (payment) {
                    handleSavePaymentConfig(payment);
                  }
                }}
                disabled={isSavingPayment}
                variant="default"
                size="default"
                style={{
                  backgroundColor: isSavingPayment ? '#9CA3AF' : '#16a34a',
                  color: 'white',
                }}
              >
                {isSavingPayment ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de mover fecha - Versión HTML nativa */}
      {isDateMoverOpen && (
        <div
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
          onClick={() => setIsDateMoverOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              width: '400px',
              maxWidth: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#1a1f36' }}>
              Mover {loans.length} préstamo(s)
            </h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                Fecha de destino
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '14px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setIsDateMoverOpen(false)}
                variant="outline"
                size="default"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleMoveDate}
                disabled={!targetDate || isMovingDate}
                variant="default"
                size="default"
                style={{
                  backgroundColor: isMovingDate || !targetDate ? '#9CA3AF' : '#16a34a',
                  color: 'white',
                }}
              >
                {isMovingDate ? 'Moviendo...' : 'Mover'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AlertDialog para confirmar eliminación de préstamo existente */}
      <AlertDialog
        open={deleteDialogOpen.open}
        onOpenChange={(open) => setDeleteDialogOpen({ open, loanId: open ? deleteDialogOpen.loanId : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el préstamo y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen({ open: false, loanId: null })}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialogOpen.loanId) {
                  handleDeleteLoan(deleteDialogOpen.loanId);
                  setDeleteDialogOpen({ open: false, loanId: null });
                }
              }}
              style={{
                backgroundColor: '#DC2626',
                color: 'white',
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para confirmar eliminación de préstamo pendiente */}
      <AlertDialog
        open={deletePendingLoanDialogOpen.open}
        onOpenChange={(open) => setDeletePendingLoanDialogOpen({ open, loanIndex: open ? deletePendingLoanDialogOpen.loanIndex : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar préstamo pendiente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el préstamo pendiente de la lista. Los datos ingresados se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePendingLoanDialogOpen({ open: false, loanIndex: null })}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePendingLoanDialogOpen.loanIndex !== null) {
                  setPendingLoans(prev => prev.filter((_, i) => i !== deletePendingLoanDialogOpen.loanIndex));
                  setDeletePendingLoanDialogOpen({ open: false, loanIndex: null });
                }
              }}
              style={{
                backgroundColor: '#DC2626',
                color: 'white',
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

