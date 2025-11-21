import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { FaExclamationTriangle, FaEllipsisV } from 'react-icons/fa';
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
import { CreditsTable } from './CreditsTable';
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
  
  // Estados de UI
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
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
          {/* New button to open CreateCreditModal (replaces inline forms) */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              height: '38px',
              background: '#059669',
              color: 'white',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#047857';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#059669';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Agregar Crédito
          </button>
          
          {/* Botón Guardar cambios - solo visible si hay préstamos pendientes */}
          {pendingLoans.length > 0 && (
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
          )}
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
          {loans.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              textAlign: 'center',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}>
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#9ca3af" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              </div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '8px',
              }}>
                No hay créditos registrados
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '24px',
                maxWidth: '400px',
              }}>
                No se encontraron créditos para la fecha seleccionada. Haz clic en "Agregar Crédito" para crear uno nuevo.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  padding: '9px 20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'inherit',
                  letterSpacing: '-0.01em',
                  height: '38px',
                  background: '#059669',
                  color: 'white',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#047857';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#059669';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Agregar Crédito
              </button>
            </div>
          ) : (
            <CreditsTable
              loans={loans}
              newLoanId={newLoanId}
              isDeleting={isDeleting}
              initialPayments={initialPayments}
              hasPaymentForToday={hasPaymentForToday}
              getRegisteredPaymentAmount={getRegisteredPaymentAmount}
              handleToggleInitialPayment={handleToggleInitialPayment}
              handleEditLoan={handleEditLoan}
              handleDeleteClick={(loanId) => setDeleteDialogOpen({ open: true, loanId })}
            />
          )}
        </div>
      </div>

      {/* Removed: inline credit creation section (now handled by modal) */}


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
        allPreviousLoansData={allPreviousLoansData}
        onBalanceUpdate={onBalanceUpdate}
        refetchRoute={refetchRoute}
        refetchLoans={refetchLoans}
        triggerRefresh={triggerRefresh}
      />



      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

