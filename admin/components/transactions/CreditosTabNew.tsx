import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { FaEdit, FaSpinner, FaEllipsisV, FaTrash, FaExclamationTriangle } from 'react-icons/fa';
import { calculateLoanAmounts, calculateAmountToPay } from '../../utils/loanCalculations';
import { GET_ROUTE } from '../../graphql/queries/routes';
import { GET_LOANS_FOR_TRANSACTIONS } from '../../graphql/queries/loans-optimized';
import { CREATE_LOANS_BULK, UPDATE_LOAN_WITH_AVAL, DELETE_LOAN } from '../../graphql/mutations/loans';
import { CREATE_LEAD_PAYMENT_RECEIVED, UPDATE_LEAD_PAYMENT } from '../../graphql/mutations/payments';
import { GET_LEAD_PAYMENTS } from '../../graphql/queries/payments';
import { MOVE_LOANS_TO_DATE } from '../../graphql/mutations/dateMovement';
import { useBalanceRefresh } from '../../hooks/useBalanceRefresh';
import { useToast } from '../ui/toast';
import type { Loan, LoanType } from '../../types/loan';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
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
import { PaymentConfigModal } from './PaymentConfigModal';
import { CreateCreditModal } from './CreateCreditModal';
import { GET_LOAN_TYPES, GET_PREVIOUS_LOANS, GET_ALL_PREVIOUS_LOANS } from '../../graphql/queries/loans';
import type { 
  ExtendedLoanForCredits, 
  InitialPayment, 
  LoanTypeOption, 
  PreviousLoanOption,
  LeadInfo,
  LocationInfo
} from '../../types/loan';
import styles from './CreditosTabNew.module.css';

interface CreditosTabNewProps {
  selectedDate: Date | null;
  selectedRoute: string | null;
  selectedLead: LeadInfo | null;
  onBalanceUpdate?: (balance: number) => void;
}



// Helper para redondear montos consistentemente
const roundAmount = (amount: string | number): number => {
  return Math.round(parseFloat(String(amount || '0')));
};



export const CreditosTabNew: React.FC<CreditosTabNewProps> = ({ 
  selectedDate, 
  selectedRoute, 
  selectedLead, 
  onBalanceUpdate 
}) => {
  const { triggerRefresh } = useBalanceRefresh();
  const { showToast } = useToast();
  
  // Estado principal
  const [loans, setLoans] = useState<Loan[]>([]);
  const [pendingLoans, setPendingLoans] = useState<ExtendedLoanForCredits[]>([]);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [editableEmptyRow, setEditableEmptyRow] = useState<ExtendedLoanForCredits | null>(null);
  
  // Estados de UI
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [newLoanId, setNewLoanId] = useState<string | null>(null);
  const [isSearchingLoansByRow, setIsSearchingLoansByRow] = useState<Record<string, boolean>>({});
  
  // Estados de diálogos
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<{ open: boolean; loanId: string | null }>({ 
    open: false, 
    loanId: null 
  });
  const [deletePendingLoanDialogOpen, setDeletePendingLoanDialogOpen] = useState<{ 
    open: boolean; 
    loanIndex: number | null 
  }>({ 
    open: false, 
    loanIndex: null 
  });
  const [locationMismatchDialogOpen, setLocationMismatchDialogOpen] = useState<{
    open: boolean;
    clientLocation: string;
    leadLocation: string;
  }>({ 
    open: false, 
    clientLocation: '', 
    leadLocation: '' 
  });
  
  // Estados de pagos
  const [initialPayments, setInitialPayments] = useState<Record<string, InitialPayment>>({});
  const [selectedPaymentLoan, setSelectedPaymentLoan] = useState<Loan | null>(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [massCommission, setMassCommission] = useState<string>('0');
  
  // Estados de búsqueda
  const [dropdownSearchTextByRow, setDropdownSearchTextByRow] = useState<Record<string, string>>({});
  const [debouncedDropdownSearchTextByRow, setDebouncedDropdownSearchTextByRow] = useState<Record<string, string>>({});
  
  // Referencias
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const existingLoansTableRef = useRef<HTMLDivElement>(null);
  
  const [createMultipleLoans] = useMutation(CREATE_LOANS_BULK);
  const [updateLoanWithAval] = useMutation(UPDATE_LOAN_WITH_AVAL);
  const [deleteLoan] = useMutation(DELETE_LOAN);
  const [createLeadPaymentReceived] = useMutation(CREATE_LEAD_PAYMENT_RECEIVED);
  const [updateLeadPayment] = useMutation(UPDATE_LEAD_PAYMENT);
  
  const { refetch: refetchRoute } = useQuery<{ route: any }>(GET_ROUTE, {
    variables: { where: { id: selectedRoute } },
    skip: !selectedRoute,
  });

  const { data: loansData, loading: loansLoading, error: loansError, refetch: refetchLoans } = useQuery<{ loans: Loan[] }>(GET_LOANS_FOR_TRANSACTIONS, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : '',
      nextDate: selectedDate ? new Date(new Date(selectedDate).setHours(24, 0, 0, 0)).toISOString() : '',
      leadId: selectedLead?.id || ''
    },
    skip: !selectedDate || !selectedLead?.id,
  });

  const { refetch: refetchPreviousLoans } = useQuery(GET_PREVIOUS_LOANS, {
    variables: { leadId: selectedLead?.id || '' },
    skip: !selectedLead,
  });

  const { data: paymentsData, refetch: refetchPayments } = useQuery(GET_LEAD_PAYMENTS, {
    variables: {
      date: selectedDate ? new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString() : new Date().toISOString(),
      nextDate: selectedDate ? new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString() : new Date().toISOString(),
      leadId: selectedLead?.id || ''
    },
    skip: !selectedDate || !selectedLead,
  });
  
  // Obtener la localidad del lead seleccionado
  const selectedLeadLocation = useMemo((): LocationInfo | null => {
    // Obtener directamente del selectedLead
    if (selectedLead?.personalData?.addresses && selectedLead.personalData.addresses.length > 0) {
      const location = selectedLead.personalData.addresses[0].location;
      if (location) {
        return {
          id: location.id,
          name: location.name
        };
      }
    }
    
    // Fallback: intentar desde loansData si no está en selectedLead
    if (loansData?.loans && loansData.loans.length > 0) {
      const firstLoan = loansData.loans[0];
      const location = firstLoan.lead?.personalData?.addresses?.[0]?.location;
      if (location) {
        return {
          id: location.id,
          name: location.name
        };
      }
    }
    
    return null;
  }, [selectedLead, loansData]);
  

  
  const { data: allPreviousLoansData, refetch: refetchAllPreviousLoans } = useQuery(GET_ALL_PREVIOUS_LOANS, {
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
    // Procesar cada fila independientemente
    Object.entries(debouncedDropdownSearchTextByRow).forEach(([rowId, searchText]) => {
      // Solo hacer refetch si hay texto de búsqueda (al menos 2 caracteres)
      if (searchText.trim().length >= 2) {
        setIsSearchingLoansByRow(prev => ({ ...prev, [rowId]: true }));
        refetchAllPreviousLoans({
          searchText: searchText,
          take: 50 // Aumentar el límite para obtener más resultados
        }).finally(() => {
          setIsSearchingLoansByRow(prev => ({ ...prev, [rowId]: false }));
        });
      } else {
        // Limpiar el loading si no hay texto suficiente
        setIsSearchingLoansByRow(prev => {
          const newState = { ...prev };
          delete newState[rowId];
          return newState;
        });
      }
    });
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

  const hasPaymentForToday = useCallback((loanId: string): boolean => {
    if (!paymentsData?.loanPayments) return false;
    
    interface LoanPayment {
      loan?: { id: string };
      leadPaymentReceived?: { lead?: { id: string } };
    }
    
    const payments = paymentsData.loanPayments as LoanPayment[];
    return payments.some((payment) => 
      payment.loan?.id === loanId && 
      payment.leadPaymentReceived?.lead?.id === selectedLead?.id
    );
  }, [paymentsData, selectedLead]);

  const getRegisteredPaymentAmount = useCallback((loanId: string): string => {
    if (!paymentsData?.loanPayments) return '0';
    
    interface LoanPayment {
      amount?: string;
      loan?: { id: string };
      leadPaymentReceived?: { lead?: { id: string } };
    }
    
    const payments = paymentsData.loanPayments as LoanPayment[];
    const payment = payments.find((p) => 
      p.loan?.id === loanId && 
      p.leadPaymentReceived?.lead?.id === selectedLead?.id
    );
    
    return payment ? roundAmount(payment.amount || '0').toString() : '0';
  }, [paymentsData, selectedLead]);

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
      
      interface LoanPayment {
        amount: string;
        comission: string;
        loanId: string;
        type: string;
        paymentMethod: string;
        loan?: { id: string };
        leadPaymentReceived?: {
          id: string;
          lead?: { id: string };
          cashPaidAmount: string;
          bankPaidAmount: string;
          falcoAmount: string;
        };
      }
      
      const existingPayments = (paymentsData?.loanPayments || []) as LoanPayment[];
      const existingLeadPayment = existingPayments.find((p) => p.leadPaymentReceived?.lead?.id === selectedLead?.id);
      
      const newPayment = {
        amount: weeklyAmount,
        comission: comission,
        loanId: selectedPaymentLoan.id,
        type: 'PAYMENT',
        paymentMethod: payment.paymentMethod
      };
      
      if (existingLeadPayment?.leadPaymentReceived) {
        const existingPaymentsForToday = existingPayments.filter((p) => 
          p.leadPaymentReceived?.lead?.id === selectedLead?.id
        );
        
        const existingPaymentsList = existingPaymentsForToday.map((p) => ({
          amount: parseFloat(p.amount || '0'),
          comission: parseFloat(p.comission || '0'),
          loanId: p.loan?.id || '',
          type: p.type || 'PAYMENT',
          paymentMethod: p.paymentMethod || 'CASH'
        }));
        
        const allPayments = [...existingPaymentsList, newPayment];
        const totalExpectedAmount = allPayments.reduce((sum, p) => sum + parseFloat(String(p.amount || '0')), 0);
        
        const leadPaymentReceived = existingLeadPayment.leadPaymentReceived;
        
        if (payment.paymentMethod === 'CASH') {
          const existingCashAmount = parseFloat(leadPaymentReceived.cashPaidAmount || '0');
          const totalCashAmount = existingCashAmount + weeklyAmount;
          const existingBankAmount = parseFloat(leadPaymentReceived.bankPaidAmount || '0');
          const existingFalcoAmount = parseFloat(leadPaymentReceived.falcoAmount || '0');
          
          await updateLeadPayment({
            variables: {
              id: leadPaymentReceived.id,
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
              id: leadPaymentReceived.id,
              expectedAmount: totalExpectedAmount,
              cashPaidAmount: parseFloat(leadPaymentReceived.cashPaidAmount || '0'),
              bankPaidAmount: parseFloat(leadPaymentReceived.bankPaidAmount || '0'),
              falcoAmount: parseFloat(leadPaymentReceived.falcoAmount || '0'),
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
        showToast('warning', 'No hay préstamos válidos para guardar');
        setIsCreating(false);
        return;
      }

      // Validar clientes duplicados (solo para clientes nuevos, no para seleccionados del autocomplete o renovaciones)
      for (const loan of validLoans) {
        // Si el cliente fue seleccionado del autocomplete o es una renovación, no validar duplicados
        const isSelectedFromAutocomplete = !!(loan as any).borrower?.personalData?.id;
        const isRenewal = !!loan.previousLoan;
        
        if (isSelectedFromAutocomplete || isRenewal) {
          continue; // Skip validation for selected or renewal loans
        }
        
        const cleanName = (loan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' ');
        const cleanPhone = (loan.borrower?.personalData?.phones?.[0]?.number || '').trim().replace(/\s+/g, ' ');
        
        if (cleanName && cleanPhone) {
          const existingClient = allPreviousLoansData?.loans?.find((existingLoan: Loan) => {
            const existingName = (existingLoan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' ');
            const existingPhone = (existingLoan.borrower?.personalData?.phones?.[0]?.number || '').trim().replace(/\s+/g, ' ');
            return existingName.toLowerCase() === cleanName.toLowerCase() && 
                   existingPhone === cleanPhone;
          });

          if (existingClient) {
            showToast('error', `El cliente "${cleanName}" ya ha tenido créditos anteriormente, usa la opción de renovación`);
            setIsCreating(false);
            return;
          }
        }
      }

      const loansData = validLoans.map(loan => {
        const phoneNumber = loan.borrower?.personalData?.phones?.[0]?.number || '';
        
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
        // Verificar errores en la respuesta
        const responses = data.createMultipleLoans as Array<{ success: boolean; message?: string; loan?: Loan }>;
        const errorResponse = responses.find((response) => !response.success);
        
        if (errorResponse) {
          showToast('error', errorResponse.message || 'Error desconocido al crear el préstamo');
          return;
        }

        // Limpiar estado y refrescar datos
        setPendingLoans([]);
        setEditableEmptyRow(null);
        await Promise.all([refetchRoute(), refetchLoans()]);
        
        // Actualizar balance
        if (onBalanceUpdate) {
          const totalAmount = responses.reduce((sum, response) => 
            sum + parseFloat(response.loan?.amountGived || '0'), 0
          );
          onBalanceUpdate(-totalAmount);
        }
        
        // Show success toast with count
        showToast('success', `${validLoans.length} crédito(s) guardado(s) exitosamente`);
        
        triggerRefresh();
      }
    } catch (error) {
      console.error('❌ Error al crear los préstamos en bulk:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al crear los préstamos. Por favor, intenta de nuevo.';
      showToast('error', errorMessage);
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
    } as Loan & { 
      avalName: string; 
      avalPhone: string; 
      selectedCollateralId?: string; 
      selectedCollateralPhoneId?: string; 
      avalAction: 'create' | 'connect' 
    });
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
        showToast('success', 'Crédito eliminado exitosamente');
        triggerRefresh();
      }
    } catch (error) {
      console.error('Error al eliminar el préstamo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar el crédito. Intenta de nuevo';
      showToast('error', errorMessage);
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
  const emptyLoanRow = React.useMemo<ExtendedLoanForCredits>(() => ({
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
  const getPreviousLoanOptions = useCallback((rowId: string): PreviousLoanOption[] => {
    const loans = (allPreviousLoansData?.loans || []) as Loan[];

    if (!loans || loans.length === 0) {
      return [];
    }


    // IDs de clientes que ya tienen renovaciones en la fecha actual
    const renewedTodayBorrowerIds = new Set<string>(
      [
        ...loans.filter((l: Loan) => l.previousLoan).map((l: Loan) => l.borrower?.id),
        ...pendingLoans.filter(l => l.previousLoan).map(l => l.borrower?.id),
      ].filter((id): id is string => Boolean(id))
    );

    // Obtener el ÚLTIMO crédito de cada cliente (activo o terminado)
    const latestBorrowerLoans = loans.reduce<Record<string, Loan>>((acc, loan) => {
      const borrowerId = loan.borrower?.id;
      if (borrowerId && !renewedTodayBorrowerIds.has(borrowerId)) {
        if (!acc[borrowerId] || new Date(loan.signDate) > new Date(acc[borrowerId].signDate)) {
          acc[borrowerId] = loan;
        }
      }
      return acc;
    }, {});

    // Convertir a array y ordenar por fecha de firma (más reciente primero)
    const options: PreviousLoanOption[] = Object.values(latestBorrowerLoans)
      .sort((a: Loan, b: Loan) => new Date(b.signDate).getTime() - new Date(a.signDate).getTime())
      .map((loan: Loan) => {
        const leadAddress = loan.lead?.personalData?.addresses?.[0];
        const leadLocation = leadAddress?.location;
        const location = leadLocation?.name || 'Sin localidad';
        const leaderName = loan.lead?.personalData?.fullName || 'Sin líder';
        const pendingAmount = parseFloat(loan.pendingAmountStored || loan.pendingAmount || '0');
        const hasDebt = pendingAmount > 0;

        return {
          value: loan.id,
          label: loan.borrower?.personalData?.fullName || 'Sin nombre',
          loanData: loan,
          hasDebt,
          statusColor: hasDebt ? '#FEF3C7' : '#D1FAE5',
          statusTextColor: hasDebt ? '#92400E' : '#065F46',
          debtColor: hasDebt ? '#DC2626' : '#059669',
          locationColor: '#3B82F6',
          location: location || null,
          debtAmount: roundAmount(pendingAmount).toString(),
          leaderName,
        };
      });
    
    return options;
  }, [allPreviousLoansData, pendingLoans]);

  // Manejar cambios en la fila
  const handleRowChange = useCallback((
    index: number, 
    field: string, 
    value: PreviousLoanOption | LoanTypeOption | { clientName: string; clientPhone: string; action?: string } | { avalName: string; avalPhone: string; selectedCollateralId?: string; selectedCollateralPhoneId?: string; avalAction: 'create' | 'update' | 'connect' | 'clear' } | string | null, 
    isNewRow: boolean
  ) => {
    const sourceRow = isNewRow 
      ? (editableEmptyRow || { ...emptyLoanRow, id: generateLoanId() }) 
      : pendingLoans[index];

    let updatedRow: ExtendedLoanForCredits = { ...sourceRow };

    if (field === 'previousLoan') {
      const previousLoanValue = value as PreviousLoanOption | null | undefined;
      if (previousLoanValue?.value) {
        const selectedLoan = previousLoanValue.loanData;
        const pendingAmount = roundAmount(selectedLoan.pendingAmountStored || selectedLoan.pendingAmount || '0').toString();
        const selectedType = loanTypesData?.loantypes?.find((type: LoanType) => type.id === selectedLoan.loantype?.id);
        
        updatedRow = {
          ...updatedRow,
          previousLoanOption: previousLoanValue,
          previousLoan: { ...selectedLoan, pendingAmount },
          borrower: selectedLoan.borrower,
          avalName: selectedLoan.collaterals?.[0]?.fullName || '',
          avalPhone: selectedLoan.collaterals?.[0]?.phones?.[0]?.number || '',
          selectedCollateralId: selectedLoan.collaterals?.[0]?.id,
          selectedCollateralPhoneId: selectedLoan.collaterals?.[0]?.phones?.[0]?.id,
          avalAction: selectedLoan.collaterals && selectedLoan.collaterals.length > 0 ? 'connect' : 'clear',
          loantype: selectedLoan.loantype,
          requestedAmount: selectedLoan.requestedAmount,
          comissionAmount: (selectedType?.loanGrantedComission ?? 0).toString(),
        };
      } else {
        updatedRow = { 
          ...updatedRow, 
          previousLoanOption: null, 
          previousLoan: undefined, 
          borrower: emptyLoanRow.borrower,
          avalName: '',
          avalPhone: '',
          selectedCollateralId: undefined,
          selectedCollateralPhoneId: undefined,
          avalAction: 'clear',
          collaterals: [],
          loantype: undefined,
          requestedAmount: '',
          comissionAmount: '0',
          amountGived: '',
          amountToPay: ''
        };
      }
    } else if (field === 'loantype') {
      const loanTypeValue = value as LoanTypeOption;
      const selectedType = loanTypesData?.loantypes?.find((t: LoanType) => t.id === loanTypeValue.value);
      if (selectedType) {
        updatedRow.loantype = selectedType;
        updatedRow.comissionAmount = (selectedType.loanGrantedComission ?? 0).toString();
      }
    } else if (field === 'clientData') {
      const clientDataValue = value as { clientName: string; clientPhone: string; action?: string };
      const currentPersonalData = updatedRow.borrower?.personalData;
      const currentPhoneId = currentPersonalData?.phones?.[0]?.id || '';
      updatedRow.borrower = { 
        id: updatedRow.borrower?.id || '',
        personalData: { 
          id: currentPersonalData?.id || '',
          fullName: clientDataValue.clientName, 
          phones: [{ id: currentPhoneId, number: clientDataValue.clientPhone }] 
        } 
      };
    } else if (field === 'avalData') {
      const avalDataValue = value as { avalName: string; avalPhone: string; selectedCollateralId?: string; selectedCollateralPhoneId?: string; avalAction: 'create' | 'update' | 'connect' | 'clear' };
      const collateral = avalDataValue.selectedCollateralId
        ? {
            id: avalDataValue.selectedCollateralId,
            fullName: avalDataValue.avalName,
            phones: [{ id: avalDataValue.selectedCollateralPhoneId || '', number: avalDataValue.avalPhone }],
          }
        : null;

      updatedRow = {
        ...updatedRow,
        collaterals: collateral ? [collateral] : [],
        selectedCollateralId: avalDataValue.selectedCollateralId,
        selectedCollateralPhoneId: avalDataValue.selectedCollateralPhoneId,
        avalAction: avalDataValue.avalAction,
        avalName: avalDataValue.avalName,
        avalPhone: avalDataValue.avalPhone,
      };
    } else {
      updatedRow = { ...updatedRow, [field]: value as string };
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

  interface LoanTotals {
    count: number;
    amountGived: number;
    amountToPay: number;
    totalComission: number;
    newLoans: number;
    renewals: number;
  }

  const existingTotals = useMemo((): LoanTotals => 
    loans.reduce((acc, loan) => ({
      count: acc.count + 1,
      amountGived: acc.amountGived + parseFloat(loan.amountGived || '0'),
      amountToPay: acc.amountToPay + parseFloat(loan.totalDebtAcquired || '0'),
      totalComission: acc.totalComission + parseFloat(loan.comissionAmount || '0'),
      newLoans: acc.newLoans + (loan.previousLoan ? 0 : 1),
      renewals: acc.renewals + (loan.previousLoan ? 1 : 0),
    }), { count: 0, amountGived: 0, amountToPay: 0, totalComission: 0, newLoans: 0, renewals: 0 }), 
  [loans]);

  const pendingTotals = useMemo((): LoanTotals => 
    pendingLoans.reduce((acc, loan) => ({
      count: acc.count + 1,
      amountGived: acc.amountGived + parseFloat(loan.amountGived || '0'),
      amountToPay: acc.amountToPay + parseFloat(loan.totalDebtAcquired || '0'),
      totalComission: acc.totalComission + parseFloat(loan.comissionAmount || '0'),
      newLoans: acc.newLoans + (loan.previousLoan ? 0 : 1),
      renewals: acc.renewals + (loan.previousLoan ? 1 : 0),
    }), { count: 0, amountGived: 0, amountToPay: 0, totalComission: 0, newLoans: 0, renewals: 0 }), 
  [pendingLoans]);

  const totals = useMemo((): LoanTotals => ({
    count: existingTotals.count + pendingTotals.count,
    amountGived: existingTotals.amountGived + pendingTotals.amountGived,
    amountToPay: existingTotals.amountToPay + pendingTotals.amountToPay,
    totalComission: existingTotals.totalComission + pendingTotals.totalComission,
    newLoans: existingTotals.newLoans + pendingTotals.newLoans,
    renewals: existingTotals.renewals + pendingTotals.renewals,
  }), [existingTotals, pendingTotals]);

  const loanTypeOptions = useMemo((): LoanTypeOption[] => {
    if (!loanTypesData?.loantypes) return [];
    
    return loanTypesData.loantypes.map((type: LoanType): LoanTypeOption => ({
      label: type.name,
      value: type.id,
      weekDuration: type.weekDuration,
      rate: type.rate,
      typeData: type
    }));
  }, [loanTypesData]);

  // Estado para el modal de mover fecha - MOVIDO AQUÍ ANTES DE RETURNS CONDICIONALES
  const [isDateMoverOpen, setIsDateMoverOpen] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [isMovingDate, setIsMovingDate] = useState(false);
  const [showPrimaryMenu, setShowPrimaryMenu] = useState(false);
  const [moveDate] = useMutation(MOVE_LOANS_TO_DATE);
  
  // Estado para el modal de crear crédito
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalLoan, setModalLoan] = useState<ExtendedLoanForCredits | null>(null);
  
  // Referencia para hacer scroll a la sección de nuevos préstamos
  const newLoansSectionRef = useRef<HTMLDivElement>(null);

  if (loansLoading || loanTypesLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <div className={styles.loadingText}>
          Cargando créditos...
        </div>
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
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>💰</div>
        <div className={styles.emptyStateTitle}>
          Selecciona Ruta y Localidad
        </div>
        <div className={styles.emptyStateDescription}>
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
      <AlertDialog
        open={locationMismatchDialogOpen.open}
        onOpenChange={(open) => {
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
              setLocationMismatchDialogOpen({ open: false, clientLocation: '', leadLocation: '' });
            }}>
              Entendido
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Barra de KPIs - Diseño moderno 2025 */}
      <div className={styles.kpiBar}>
        {/* Chips de KPIs */}
        <div className={styles.kpiChipsContainer}>
          {[
            { label: 'Créditos', value: totals.count, variant: 'neutral' },
            { label: 'Nuevos', value: totals.newLoans, variant: 'blue' },
            { label: 'Renovaciones', value: totals.renewals, variant: 'amber' },
            { label: 'Otorgado', value: `$${totals.amountGived.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, variant: 'pink' },
            { label: 'A Pagar', value: `$${totals.amountToPay.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, variant: 'green' },
            { label: 'Comisiones', value: `$${totals.totalComission.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, variant: 'purple' },
          ].map((chip, index) => (
            <div key={index} className={`${styles.kpiChip} ${styles[chip.variant]}`}>
              <span className={styles.kpiLabel}>{chip.label}:</span>
              <span className={styles.kpiValue}>{chip.value}</span>
            </div>
          ))}
          
          {/* Comisión Masiva */}
          {pendingLoans.length > 0 && (
            <div className={styles.kpiChip} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Comisión:</span>
              <Input
                type="number"
                value={massCommission}
                onChange={(e) => setMassCommission(e.target.value)}
                style={{ width: '60px', height: '32px', fontSize: '11px', textAlign: 'center' }}
                placeholder="0"
              />
              <Button
                onClick={handleApplyMassCommission}
                size="sm"
                className={`${styles.modernButton} ${styles.primary}`}
                style={{ fontSize: '11px', height: '32px', minWidth: 'auto', padding: '0 12px' }}
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

      {/* Sección de Agregar Nuevos Préstamos */}
      <div ref={newLoansSectionRef} className={styles.newLoansSection}>
        <div className={styles.newLoansCard}>
          <div className={styles.newLoansHeader}>
            <h3 className={styles.newLoansTitle}>
              <span>➕</span>
              <span>{pendingLoans.length > 0 ? `Préstamos Pendientes (${pendingLoans.length})` : 'Agregar Nuevos Préstamos'}</span>
            </h3>
          </div>
          <div style={{ padding: '12px' }}>
            {/* Diseño compacto tipo card */}
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
                    <div 
                      key={loanId} 
                      className={`${styles.compactLoanForm} ${!isNewRow ? styles.pending : ''}`}
                    >
                      {/* COLUMNA IZQUIERDA: PERSONAS */}
                      <div className={styles.personsColumn}>
                        {/* Titular */}
                        <div className={styles.personSection}>
                          <div className={`${styles.sectionHeader} ${styles.titular}`}>
                            <span className={styles.sectionIcon}>👤</span>
                            <span>Titular</span>
                          </div>
                          <div className={styles.compactInputWrapper}>
                            <label className={styles.compactLabel}>Cliente / Renovación</label>
                            <ClientLoanUnifiedInput
                            loanId={loanId}
                            currentName={loan.borrower?.personalData?.fullName || ''}
                            currentPhone={loan.borrower?.personalData?.phones?.[0]?.number || ''}
                            previousLoanOption={loan.previousLoanOption}
                            previousLoan={loan.previousLoan}
                            clientPersonalDataId={loan.borrower?.personalData?.id}
                            clientPhoneId={loan.borrower?.personalData?.phones?.[0]?.id}
                            onNameChange={(name) => {
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
                            isLoading={isSearchingLoansByRow[loanId] || false}
                            selectedLeadLocationId={selectedLeadLocation?.id}
                            onLocationMismatch={(clientLocation, leadLocation) => {
                              setLocationMismatchDialogOpen({
                                open: true,
                                clientLocation,
                                leadLocation: selectedLeadLocation?.name || 'desconocida'
                              });
                            }}
                            onSearchTextChange={(text) => {
                              setDropdownSearchTextByRow(prev => ({
                                ...prev,
                                [loanId]: text
                              }));
                            }}
                          />
                          </div>
                        </div>

                        {/* Aval */}
                        <div className={styles.personSection}>
                          <div className={`${styles.sectionHeader} ${styles.aval}`}>
                            <span className={styles.sectionIcon}>🤝</span>
                            <span>Aval</span>
                          </div>
                          <div className={styles.compactInputWrapper}>
                            <label className={styles.compactLabel}>Nombre y Teléfono</label>
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
                              onLocationMismatch={(avalLocation, _) => {
                                setLocationMismatchDialogOpen({
                                  open: true,
                                  clientLocation: avalLocation,
                                  leadLocation: selectedLeadLocation?.name || 'desconocida'
                                });
                              }}
                              namePlaceholder="Buscar o escribir nombre del aval..."
                              phonePlaceholder="Teléfono..."
                            />
                          </div>
                        </div>
                      </div>

                      {/* COLUMNA DERECHA: INFO DEL PRÉSTAMO */}
                      <div className={styles.loanInfoColumn}>
                        {/* Botón de eliminar con indicador de validación - Siempre reservar espacio */}
                        <div className={styles.loanFormActions} style={{ visibility: isNewRow ? 'hidden' : 'visible' }}>
                          <div className={styles.validationCheck}>✓</div>
                          <button
                            className={styles.compactActionButton}
                            onClick={() => {
                              if (!isNewRow) {
                                setDeletePendingLoanDialogOpen({ open: true, loanIndex: index });
                              }
                            }}
                            title="Eliminar préstamo"
                            type="button"
                            disabled={isNewRow}
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>

                        {/* Tipo */}
                        <div className={styles.compactInputWrapper}>
                          <label className={styles.compactLabel}>Tipo de Préstamo</label>
                          <select
                            className="w-full px-2 py-1 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={loanTypeOptions.find((opt: LoanTypeOption) => opt.value === loan.loantype?.id)?.value || ''}
                            onChange={(e) => {
                              const selectedOption = loanTypeOptions.find((opt: LoanTypeOption) => opt.value === e.target.value);
                              if (selectedOption) {
                                handleRowChange(index, 'loantype', selectedOption, isNewRow);
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
                            {loanTypeOptions.map((opt: LoanTypeOption) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Grid para montos */}
                        <div className={styles.loanInfoGrid}>
                          {/* Monto Solicitado */}
                          <div className={styles.compactInputWrapper}>
                            <label className={styles.compactLabel}>Solicitado</label>
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

                          {/* Comisión */}
                          <div className={styles.compactInputWrapper}>
                            <label className={styles.compactLabel}>Comisión</label>
                            <Input
                            placeholder="0"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
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
                              padding: '0 8px'
                            }}
                          />
                          </div>
                        </div>

                        {/* Monto Entregado (solo lectura) */}
                        <div className={styles.compactInputWrapper}>
                          <label className={styles.compactLabel}>Monto Entregado</label>
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
                      </div>
                    </div>
                  );
                })}
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
                    const selectedType = loanTypesData?.loantypes?.find((type: LoanType) => type.id === e.target.value);
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
                  {loanTypeOptions.map((option: LoanTypeOption) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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

      {/* Modal de configuración de pago */}
      <PaymentConfigModal
        loan={selectedPaymentLoan}
        isOpen={selectedPaymentLoan !== null}
        isSaving={isSavingPayment}
        onClose={() => setSelectedPaymentLoan(null)}
        onSave={handleSavePaymentConfig}
      />

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

      {/* Modal de crear créditos */}
      <CreateCreditModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={(loans) => {
          setPendingLoans(prev => [...prev, ...loans]);
          setIsCreateModalOpen(false);
        }}
        selectedDate={selectedDate}
        selectedLead={selectedLead}
        selectedLeadLocation={selectedLeadLocation}
        loanTypeOptions={loanTypeOptions}
        getPreviousLoanOptions={getPreviousLoanOptions}
        usedAvalIds={usedAvalIds}
        isSearchingLoansByRow={isSearchingLoansByRow}
        onSearchTextChange={(loanId, text) => {
          setDropdownSearchTextByRow(prev => ({
            ...prev,
            [loanId]: text
          }));
        }}
        onLocationMismatch={(clientLocation, leadLocation) => {
          setLocationMismatchDialogOpen({
            open: true,
            clientLocation,
            leadLocation
          });
        }}
        calculateLoanAmounts={calculateLoanAmounts}
      />

      {/* Botón flotante para crear crédito */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className={styles.floatingCreateButton}
        title="Crear nuevo crédito"
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span className={styles.floatingButtonText}>Crear Crédito</span>
      </button>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

