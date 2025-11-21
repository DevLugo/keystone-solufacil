/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Box, jsx, Stack } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput, Select } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { FaTrash, FaEdit } from 'react-icons/fa';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { calculateLoanAmounts } from '../../utils/loanCalculations';
import { GET_ROUTE } from '../../graphql/queries/routes';
import { CREATE_LOANS_BULK, UPDATE_LOAN_WITH_AVAL } from '../../graphql/mutations/loans';
import { CREATE_LEAD_PAYMENT_RECEIVED, UPDATE_LEAD_PAYMENT } from '../../graphql/mutations/payments';
import { GET_LEAD_PAYMENTS } from '../../graphql/queries/payments';
import PersonInputWithAutocomplete from '../loans/PersonInputWithAutocomplete';
import AvalInputWithAutocomplete from '../loans/AvalInputWithAutocomplete';
import ClientLoanUnifiedInput from '../loans/ClientLoanUnifiedInput';
import { PaymentConfigModal } from './PaymentConfigModal';
import { AddNewLoansSection } from './AddNewLoansSection';

// Import types
import type { Loan, LoanType, PersonalData } from '../../types/loan';

interface Option {
  label: string;
  value: string;
}
import { calculateAmountToPay } from '../../utils/loanCalculations';
import KPIBar from './KPIBar';
import { useBalanceRefresh } from '../../hooks/useBalanceRefresh';

// Hook personalizado para prevenir navegación del navegador durante scroll horizontal
const usePreventSwipeBack = (containerRef: React.RefObject<HTMLElement>) => {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleWheel = useCallback((e: WheelEvent) => {
    // Solo prevenir si el scroll es horizontal
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      e.stopPropagation();
      
      // Scroll manual horizontal
      if (containerRef.current) {
        containerRef.current.scrollLeft += e.deltaX;
      }
    }
  }, [containerRef]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      setIsScrolling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isScrolling && e.touches.length === 1) {
      // Prevenir el gesto de swipe back del navegador
      e.preventDefault();
    }
  }, [isScrolling]);

  const handleTouchEnd = useCallback(() => {
    setIsScrolling(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Agregar event listeners
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);
};

// Estilos unificados para inputs
const UNIFIED_INPUT_STYLES = {
  height: '32px',
  fontSize: '13px',
  padding: '4px 6px',
  border: '1px solid #D1D5DB',
  borderRadius: '4px',
  backgroundColor: '#FFFFFF',
  transition: 'all 0.3s ease',
  width: '100%',
  boxSizing: 'border-box' as const,
  lineHeight: '20px'
};

const UNIFIED_SELECT_STYLES = {
  control: (base: any) => ({ 
    ...base, 
    fontSize: '13px', 
    minHeight: '32px',
    height: '32px',
    border: '1px solid #D1D5DB',
    borderRadius: '4px',
    backgroundColor: '#FFFFFF',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
    padding: '0px'
  }),
  container: (base: any) => ({ ...base, width: '100%' }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  valueContainer: (base: any) => ({ ...base, padding: '4px 6px' }),
  input: (base: any) => ({ ...base, margin: '0px', padding: '0px' }),
  placeholder: (base: any) => ({ ...base, margin: '0px', padding: '0px' })
};

const UNIFIED_CONTAINER_STYLES = {
  height: '40px',
  display: 'flex',
  alignItems: 'flex-start',
  transition: 'all 0.3s ease',
  paddingTop: '8px'
};

// Interfaz extendida para incluir información de collateral
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
          __typename
        }
        __typename
      }
      previousLoan {
        id
        pendingAmount
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
          __typename
        }
        __typename
      }
      previousLoan {
        id
        pendingAmount
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
        # Incluir préstamos terminados también - remover filtro de finishedDate
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
        # Filtrar por nombre del cliente si se proporciona texto de búsqueda
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
      # Agregar lead para mostrar de qué líder es cada préstamo
      lead {
        id
        personalData {
          fullName
          addresses {
            id
            location {
              id
              name
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

// Componente reutilizable para mensaje de selección
const SelectionMessage = ({ 
  icon, 
  title, 
  description, 
  requirements 
}: { 
  icon: string; 
  title: string; 
  description: string; 
  requirements: string[] 
}) => (
  <Box css={{ 
    display: 'flex', 
    flexDirection: 'column',
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '400px',
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    borderRadius: '12px',
    margin: '20px',
    position: 'relative',
    overflow: 'hidden'
  }}>
    {/* Efecto de ondas de fondo */}
    <Box css={{
      position: 'absolute',
      top: '-50%',
      left: '-50%',
      width: '200%',
      height: '200%',
      background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
      animation: 'pulse 2s ease-in-out infinite'
    }} />
    
    {/* Icono */}
    <Box css={{
      width: '60px',
      height: '60px',
      background: 'rgba(59, 130, 246, 0.1)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '20px',
      position: 'relative',
      zIndex: 1
    }}>
      <Box css={{ fontSize: '28px' }}>{icon}</Box>
    </Box>
    
    {/* Título */}
    <Box css={{
      fontSize: '18px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '8px',
      position: 'relative',
      zIndex: 1
    }}>
      {title}
    </Box>
    
    {/* Descripción */}
    <Box css={{
      fontSize: '14px',
      color: '#6b7280',
      marginBottom: '16px',
      textAlign: 'center',
      position: 'relative',
      zIndex: 1
    }}>
      {description}
    </Box>
    
    {/* Requisitos */}
    <Box css={{
      position: 'relative',
      zIndex: 1
    }}>
      {requirements.map((req, index) => (
        <Box key={index} css={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '8px',
          fontSize: '13px',
          color: '#6b7280'
        }}>
          <Box css={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: '#9ca3af',
            marginRight: '8px'
          }} />
          {req}
        </Box>
      ))}
    </Box>
    
    {/* CSS para animaciones */}
    <style jsx>{`
      @keyframes pulse {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.05); }
      }
    `}</style>
  </Box>
);

export const CreditosTab = ({ selectedDate, selectedRoute, selectedLead, onBalanceUpdate }: CreditosTabProps) => {
  const { triggerRefresh } = useBalanceRefresh();
 
  const [loans, setLoans] = useState<Loan[]>([]);
  const [pendingLoans, setPendingLoans] = useState<ExtendedLoan[]>([]);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  // Estado para pagos iniciales
  interface InitialPayment {
    amount: string;
    paymentMethod: 'CASH' | 'MONEY_TRANSFER';
    comission: string;
  }
  const [initialPayments, setInitialPayments] = useState<Record<string, InitialPayment>>({});
  const [selectedPaymentLoan, setSelectedPaymentLoan] = useState<Loan | null>(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Estado para comisión masiva
  const [massCommission, setMassCommission] = useState<string>('0');

  const [newLoanId, setNewLoanId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  // ✅ Referencias para prevenir swipe back en tablas
  const existingLoansTableRef = useRef<HTMLDivElement>(null);
  const pendingLoansTableRef = useRef<HTMLDivElement>(null);
  
  // ✅ Hooks para prevenir navegación del navegador
  usePreventSwipeBack(existingLoansTableRef);
  usePreventSwipeBack(pendingLoansTableRef);
  
  // Función para calcular la posición del dropdown basándose en el botón
  const getDropdownPosition = (loanId: string) => {
    const buttonElement = buttonRefs.current[loanId];
    if (!buttonElement) {
      return { top: 0, left: 0 };
    }
    
    const rect = buttonElement.getBoundingClientRect();
    return {
      top: rect.top - 10, // 10px arriba del botón
      left: rect.left - 140, // 140px a la izquierda para que no se salga de la pantalla
    };
  };
  
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  // Estado individual por fila para buscar en todos los líderes
  const [searchAllLeadersByRow, setSearchAllLeadersByRow] = useState<{ [key: string]: boolean }>({});
  const [dropdownSearchTextByRow, setDropdownSearchTextByRow] = useState<{ [key: string]: string }>({});
  const [debouncedDropdownSearchTextByRow, setDebouncedDropdownSearchTextByRow] = useState<{ [key: string]: string }>({});
  // Estado para controlar el focus de los dropdowns e inputs
  const [isPreviousLoanFocused, setIsPreviousLoanFocused] = useState<{ [key: string]: boolean }>({});
  const [isLoanTypeFocused, setIsLoanTypeFocused] = useState<{ [key: string]: boolean }>({});
  const [isRequestedAmountFocused, setIsRequestedAmountFocused] = useState<{ [key: string]: boolean }>({});
  const [isCommissionFocused, setIsCommissionFocused] = useState<{ [key: string]: boolean }>({});
  const [showTooltip, setShowTooltip] = useState<{ [key: string]: boolean }>({});
  const [createLoan] = useMutation(CREATE_LOAN);
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

  // Query unificada para búsqueda en todos los líderes
  const { data: allPreviousLoansData, loading: allPreviousLoansLoading, refetch: refetchAllPreviousLoans } = useQuery(GET_ALL_PREVIOUS_LOANS, {
    variables: { 
      searchText: '', 
      take: 10 
    },
    skip: false, // Permitir que se ejecute
  });

  const { data: loanTypesData, loading: loanTypesLoading } = useQuery(GET_LOAN_TYPES);

  // Función para verificar si un préstamo ya tiene pagos registrados para el día
  const hasPaymentForToday = (loanId: string) => {
    if (!paymentsData?.loanPayments) return false;
    return paymentsData.loanPayments.some((payment: any) => 
      payment.loan?.id === loanId && 
      payment.leadPaymentReceived?.lead?.id === selectedLead?.id
    );
  };

  // Función para obtener el monto del pago registrado para un préstamo
  const getRegisteredPaymentAmount = (loanId: string) => {
    if (!paymentsData?.loanPayments) return '0';
    const payment = paymentsData.loanPayments.find((p: any) => 
      p.loan?.id === loanId && 
      p.leadPaymentReceived?.lead?.id === selectedLead?.id
    );
    return payment ? parseFloat(payment.amount || '0').toFixed(2) : '0';
  };

  // Función para manejar el toggle del checkbox de pago inicial
  const handleToggleInitialPayment = (loanId: string) => {
    if (initialPayments[loanId]) {
      // Si ya existe, lo quitamos
      const newPayments = { ...initialPayments };
      delete newPayments[loanId];
      setInitialPayments(newPayments);
    } else {
      // Si no existe, abrimos el modal de configuración
      const loan = loans.find(l => l.id === loanId);
      if (loan) {
        setSelectedPaymentLoan(loan);
      }
    }
  };

  // Función para guardar la configuración del pago desde el modal
  const handleSavePaymentConfig = async (payment: InitialPayment) => {
    if (!selectedPaymentLoan) return;
    
    setIsSavingPayment(true);
    
    try {
      const weeklyAmount = parseFloat(payment.amount);
      const comission = parseFloat(payment.comission);
      const paymentDate = selectedDate?.toISOString() || new Date().toISOString();
      
      // Verificar si ya existen pagos para este día
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
        // Reutilizar pago existente - actualizar
        console.log('🔄 Actualizando pago existente:', existingLeadPayment.leadPaymentReceived.id);
        
        // Obtener pagos existentes del día (no solo del leadPaymentReceived)
        const existingPaymentsForToday = paymentsData?.loanPayments?.filter((p: any) => 
          p.leadPaymentReceived?.lead?.id === selectedLead?.id
        ) || [];
        
        // Convertir pagos existentes al formato correcto
        const existingPaymentsList = existingPaymentsForToday.map((payment: any) => ({
          amount: parseFloat(payment.amount || '0'),
          comission: parseFloat(payment.comission || '0'),
          loanId: payment.loan?.id || '',
          type: payment.type || 'PAYMENT',
          paymentMethod: payment.paymentMethod || 'CASH'
        }));
        
        // Agregar el nuevo pago a los existentes
        const allPayments = [...existingPaymentsList, newPayment];
        
        // Calcular montos totales
        const totalExpectedAmount = allPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
        
        // ✅ CORREGIDO: Solo actualizar LeadPaymentReceived si el pago es en EFECTIVO
        if (payment.paymentMethod === 'CASH') {
          console.log('💰 Pago en EFECTIVO - actualizando distribución');
          
          const existingCashAmount = parseFloat(existingLeadPayment.leadPaymentReceived.cashPaidAmount || '0');
          const existingBankAmount = parseFloat(existingLeadPayment.leadPaymentReceived.bankPaidAmount || '0');
          
          // Solo agregar el monto del nuevo pago en efectivo
          const totalCashAmount = existingCashAmount + weeklyAmount;
          
          // ✅ DEBUG: Log de la actualización de montos
          console.log('💰 Registro de nuevo pago en EFECTIVO:', {
            montoNuevoPago: weeklyAmount,
            efectivoPagadoAnterior: existingCashAmount,
            efectivoPagadoNuevo: totalCashAmount,
            incrementoEfectivo: weeklyAmount,
            nota: 'Solo se actualiza cashPaidAmount - bankPaidAmount se mantiene igual'
          });
          
          const existingFalcoAmount = parseFloat(existingLeadPayment.leadPaymentReceived.falcoAmount || '0');
          
          await updateLeadPayment({
            variables: {
              id: existingLeadPayment.leadPaymentReceived.id,
              expectedAmount: totalExpectedAmount,
              cashPaidAmount: totalCashAmount,
              bankPaidAmount: existingBankAmount, // Mantener igual
              falcoAmount: existingFalcoAmount,
              paymentDate: paymentDate,
              payments: allPayments
            }
          });
          
          console.log('✅ Pago en EFECTIVO actualizado exitosamente');
        } else {
          console.log('💳 Pago en TRANSFERENCIA - NO actualizando distribución');
          console.log('💳 Solo se agrega el pago a la lista, sin modificar cashPaidAmount/bankPaidAmount');
          
          // Solo actualizar la lista de pagos, sin modificar la distribución
          await updateLeadPayment({
            variables: {
              id: existingLeadPayment.leadPaymentReceived.id,
              expectedAmount: totalExpectedAmount,
              cashPaidAmount: parseFloat(existingLeadPayment.leadPaymentReceived.cashPaidAmount || '0'), // Mantener igual
              bankPaidAmount: parseFloat(existingLeadPayment.leadPaymentReceived.bankPaidAmount || '0'), // Mantener igual
              falcoAmount: parseFloat(existingLeadPayment.leadPaymentReceived.falcoAmount || '0'),
              paymentDate: paymentDate,
              payments: allPayments
            }
          });
          
          console.log('✅ Pago en TRANSFERENCIA agregado sin modificar distribución');
        }
        
        console.log('✅ Pago actualizado exitosamente en pago existente');
        
      } else {
        // Crear nuevo pago
        console.log('🆕 Creando nuevo pago');
        
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
        
        console.log('✅ Nuevo pago creado exitosamente');
      }
      
      // Limpiar el pago de la lista de pagos pendientes
      const newPayments = { ...initialPayments };
      delete newPayments[selectedPaymentLoan.id];
      setInitialPayments(newPayments);
      
      // Cerrar el modal de configuración de pago
      setSelectedPaymentLoan(null);
      
      // Refrescar los datos
      await Promise.all([refetchRoute(), refetchLoans(), refetchPayments()]);
      
      // ✅ Pago registrado exitosamente
      console.log('✅ Pago registrado:', {
        método: payment.paymentMethod === 'CASH' ? 'EFECTIVO' : 'TRANSFERENCIA',
        monto: weeklyAmount,
        cliente: selectedPaymentLoan.borrower?.personalData?.fullName,
        distribución: payment.paymentMethod === 'CASH' ? 'Aplicada automáticamente' : 'No aplicable'
      });
      
    } catch (error) {
      console.error('❌ Error registrando pago:', error);
      alert('Error al registrar el pago. Inténtalo de nuevo.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Función para registrar los pagos iniciales
  const handleRegisterInitialPayments = async () => {
    const loansWithPayment = loans.filter(loan => initialPayments[loan.id]);
    
    if (loansWithPayment.length === 0) return;
    
    try {
      for (const loan of loansWithPayment) {
        const payment = initialPayments[loan.id];
        const weeklyAmount = parseFloat(loan.weeklyPaymentAmount || '0');
        const comission = parseFloat(loan.loantype?.rate || '0');
        
        await createLeadPaymentReceived({
          variables: {
            expectedAmount: weeklyAmount,
            agentId: selectedLead?.id,
            leadId: selectedLead?.id,
            payments: [{
              amount: weeklyAmount,
              comission: comission,
              loanId: loan.id,
              type: 'PAYMENT',
              paymentMethod: payment.paymentMethod
            }],
            cashPaidAmount: payment.paymentMethod === 'CASH' ? weeklyAmount : 0,
            bankPaidAmount: payment.paymentMethod === 'MONEY_TRANSFER' ? weeklyAmount : 0,
            paymentDate: selectedDate?.toISOString() || new Date().toISOString()
          }
        });
      }
      
      // Limpiar estado de pagos iniciales
      setInitialPayments({});
      
    } catch (error) {
      console.error('Error registrando pagos iniciales:', error);
    }
  };

  const handleDateMoveSuccess = React.useCallback(() => {
    Promise.all([refetchLoans(), refetchRoute(), refetchPreviousLoans()]).then(() => {
      setPendingLoans([]);
      setEditableEmptyRow(null);
    }).catch(error => console.error('❌ Error al refrescar datos:', error));
  }, [refetchLoans, refetchRoute, refetchPreviousLoans]);

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

  // Refetch cuando cambie el texto de búsqueda debounced de cualquier fila
  useEffect(() => {
    // Solo hacer refetch si hay al menos una fila con búsqueda activa
    const activeSearchRows = Object.entries(searchAllLeadersByRow).filter(([_, isActive]) => isActive);
    
    if (activeSearchRows.length > 0) {
      // Usar el texto de búsqueda de la primera fila activa (o el más reciente)
      const [rowId, _] = activeSearchRows[activeSearchRows.length - 1];
      const searchText = debouncedDropdownSearchTextByRow[rowId] || '';
      
      refetchAllPreviousLoans({
        searchText: searchText,
        take: 10
      });
    }
  }, [debouncedDropdownSearchTextByRow, searchAllLeadersByRow, refetchAllPreviousLoans]);

  const loanTypeOptions = React.useMemo(() => 
    loanTypesData?.loantypes?.map((type: any) => ({
      label: type.name, // Solo el nombre, la info adicional va en tags
      value: type.id,
      // Datos adicionales para el estilo
      weekDuration: type.weekDuration,
      rate: type.rate,
      typeData: type
    })) || [],
  [loanTypesData]);

  const calculateLocalPendingAmount = React.useCallback((loan: any): number => {
    if (!loan?.loantype?.rate || !loan?.requestedAmount) return 0;
    const rate = parseFloat(loan.loantype.rate);
    const requestedAmount = parseFloat(loan.requestedAmount);
    const totalAmountToPay = requestedAmount * (1 + rate);
    const payedAmount = loan.payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0) || 0;
    return Math.max(0, totalAmountToPay - payedAmount);
  }, []);

  // Función para obtener opciones de préstamos previos por fila
  const getPreviousLoanOptions = React.useCallback((rowId: string) => {
    const searchAllLeaders = searchAllLeadersByRow[rowId] || false;
    const searchText = debouncedDropdownSearchTextByRow[rowId] || '';
    
    // Seleccionar la query apropiada según el estado de búsqueda de la fila
    const loansData = searchAllLeaders ? allPreviousLoansData : previousLoansData;
    
    if (!loansData?.loans || !selectedDate) {
      return [];
    }
    
    // IDs de clientes que ya tienen renovaciones en la fecha actual
    const renewedTodayBorrowerIds = new Set<string>([
      ...(loansData?.loans.filter((l: any) => l.previousLoan).map((l: any) => l.borrower.id) || []),
      ...(pendingLoans.filter(l => l.previousLoan).map(l => l.borrower?.id || '')),
    ]);
    
    // Obtener el ÚLTIMO crédito de cada cliente (activo o terminado)
    const latestBorrowerLoans = loansData.loans.reduce((acc: { [key: string]: any }, loan: any) => {
      const borrowerId = loan.borrower?.id;
      if (borrowerId && !renewedTodayBorrowerIds.has(borrowerId)) {
        if (!acc[borrowerId] || new Date(loan.signDate) > new Date(acc[borrowerId].signDate)) {
          acc[borrowerId] = loan;
        }
      }
      return acc;
    }, {});
    
    return Object.values(latestBorrowerLoans)
      .sort((a: any, b: any) => (a.borrower?.personalData?.fullName || '').localeCompare(b.borrower?.personalData?.fullName || ''))
      .map((loan: any) => {
        const borrowerName = loan.borrower?.personalData?.fullName || 'Sin nombre';
        const status = loan.finishedDate ? 'Terminado' : 'Activo';
        const debtAmount = loan.pendingAmountStored || '0';
        const hasDebt = parseFloat(debtAmount) > 0;
        
        // Obtener localidad del líder asociado al préstamo
        const location = loan.lead?.personalData?.addresses?.[0]?.location?.name || null; // No usar 'Sin localidad' por defecto
        const leaderName = searchAllLeaders ? loan.lead?.personalData?.fullName || 'Sin líder' : '';
        
        // Crear el label solo con nombre y estado (sin duplicar información de tags)
        const statusColor = hasDebt ? '#FEF3C7' : '#D1FAE5'; // Amarillo para deuda, verde para sin deuda
        const statusTextColor = hasDebt ? '#92400E' : '#065F46'; // Texto oscuro para contraste
        const debtColor = hasDebt ? '#DC2626' : '#059669'; // Rojo para deuda, verde para sin deuda
        const locationColor = '#3B82F6'; // Azul para localidad
        
        const label = `${borrowerName} (${status})`;
        
        return {
        value: loan.id,
          label: label,
        loanData: loan,
          // Datos adicionales para el estilo
          hasDebt: hasDebt,
          statusColor: statusColor,
          statusTextColor: statusTextColor,
          debtColor: debtColor,
          locationColor: locationColor,
          location: location,
          debtAmount: debtAmount,
          leaderName: leaderName,
        };
      });
  }, [previousLoansData?.loans, allPreviousLoansData?.loans, selectedDate, pendingLoans, searchAllLeadersByRow, debouncedDropdownSearchTextByRow]);
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
  const generateLoanId = React.useCallback(() => `temp-loan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

  const emptyLoanRow = React.useMemo(() => ({
    id: generateLoanId(),
    requestedAmount: '', amountGived: '', amountToPay: '', pendingAmount: '0',
    signDate: selectedDate?.toISOString() || '', comissionAmount: '0', avalName: '', avalPhone: '',
    selectedCollateralId: undefined, selectedCollateralPhoneId: undefined, avalAction: 'clear' as const, collaterals: [],
    loantype: undefined,
    borrower: { id: '', personalData: { id: '', fullName: '', phones: [{ id: '', number: '' }] } },
    previousLoan: undefined,
    previousLoanOption: null,
  }), [selectedDate, generateLoanId]);

  const [editableEmptyRow, setEditableEmptyRow] = React.useState<ExtendedLoan | null>(null);

  useEffect(() => {
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
  }, [editableEmptyRow, pendingLoans, emptyLoanRow, generateLoanId]);

  const handleRowChange = React.useCallback((index: number, field: string, value: any, isNewRow: boolean) => {
    const sourceRow = isNewRow 
        ? (editableEmptyRow || { ...emptyLoanRow, id: generateLoanId() }) 
        : pendingLoans[index];

    let updatedRow = { ...sourceRow };

    if (field === 'previousLoan') {
      if (value?.value) {
        // Forzar refetch de las queries para obtener datos actualizados
        refetchPreviousLoans();
        refetchAllPreviousLoans();
        
        const selectedLoan = value.loanData;
        const pendingAmount = calculateLocalPendingAmount(selectedLoan).toFixed(2);
        const selectedType = loanTypesData?.loantypes?.find((type: any) => type.id === selectedLoan.loantype?.id);
        
        console.log('🔍 SELECTED LOAN BORROWER:', {
          selectedLoanBorrower: selectedLoan.borrower,
          personalDataId: selectedLoan.borrower?.personalData?.id,
          personalDataKeys: selectedLoan.borrower?.personalData ? Object.keys(selectedLoan.borrower.personalData) : 'NO PERSONAL DATA'
        });
        
        updatedRow = {
          ...updatedRow,
          previousLoanOption: value, // ✅ FIX: Guarda el objeto completo de la opción
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
        // ✅ NUEVO: Limpiar todos los campos relacionados cuando se elimina previousLoan
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
    } else {
        if (field === 'loantype') {
            const selectedType = loanTypesData?.loantypes?.find((t: any) => t.id === value.value);
            updatedRow.loantype = selectedType;
            updatedRow.comissionAmount = (selectedType?.loanGrantedComission ?? 0).toString();
        } else if (field === 'clientData') {
            // ✅ CORREGIDO: Preservar el ID del personalData y del phone al actualizar
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
            // ✅ DEBUG: Log de los datos recibidos en avalData
            console.log('🔍 HANDLE ROW CHANGE - avalData recibido:', {
                field,
                value,
                loanId: sourceRow.id,
                isNewRow,
                index
            });
            
            // ✅ CORREGIDO: Actualizar específicamente los campos del aval
      const collateral = value.selectedCollateralId
        ? {
            id: value.selectedCollateralId,
            fullName: value.avalName,
            phones: [{ id: value.selectedCollateralPhoneId, number: value.avalPhone }],
          }
        : null;

      // Mantener el objeto de la fila y solo actualizar campos relacionados al aval,
      // sin perder metadatos como selectedCollateralId ni previousLoanOption
      updatedRow = {
        ...updatedRow,
        collaterals: collateral ? [collateral] : [],
        selectedCollateralId: value.selectedCollateralId,
        selectedCollateralPhoneId: value.selectedCollateralPhoneId,
        avalAction: value.avalAction,
        avalName: value.avalName,
        avalPhone: value.avalPhone,
      } as ExtendedLoan;
            
            // ✅ DEBUG: Log del row actualizado
            console.log('🔍 HANDLE ROW CHANGE - row actualizado:', {
                loanId: updatedRow.id,
                collaterals: updatedRow.collaterals
            });
        } else {
            updatedRow = { ...updatedRow, [field]: value };
        }
    }

    if (['requestedAmount', 'loantype', 'previousLoan'].includes(field)) {
      const { amountGived, amountToPay, totalDebtAcquired } = calculateLoanAmounts({
        requestedAmount: updatedRow.requestedAmount || '0',
        pendingAmount: updatedRow.previousLoan?.pendingAmount || '0',
        rate: updatedRow.loantype?.rate || '0',
      });
      updatedRow.amountGived = amountGived;
      updatedRow.amountToPay = amountToPay;
      updatedRow.amountToPay = totalDebtAcquired;
    }

    if (isNewRow) {
      console.log('🔍 ACTUALIZANDO EDITABLE EMPTY ROW:', updatedRow);
      setEditableEmptyRow(updatedRow);
    } else {
      console.log('🔍 ACTUALIZANDO PENDING LOANS - index:', index, 'updatedRow:', updatedRow);
      setPendingLoans(prev => {
        const newPendingLoans = prev.map((loan, i) => i === index ? updatedRow : loan);
        console.log('🔍 NUEVO ESTADO PENDING LOANS:', newPendingLoans);
        return newPendingLoans;
      });
    }
  }, [editableEmptyRow, pendingLoans, emptyLoanRow, loanTypesData, calculateLocalPendingAmount, calculateLoanAmounts]);

  useEffect(() => { setLoans(loansData?.loans || []); }, [loansData]);
  
  useEffect(() => {
    if (selectedDate && selectedLead) {
      refetchLoans(); refetchRoute(); refetchPreviousLoans();
    }
  }, [selectedDate, selectedLead, refetchLoans, refetchRoute, refetchPreviousLoans]);
  
  // ... (el resto de los hooks y funciones como handleDeleteLoan, handleSaveAll, etc. se mantienen igual) ...

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

      // Validar clientes duplicados - solo prevenir si han tenido créditos anteriormente
      for (const loan of validLoans) {
        const cleanName = (loan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' ');
        const cleanPhone = (loan.borrower?.personalData?.phones?.[0]?.number || '').trim().replace(/\s+/g, ' ');
        
        if (cleanName && cleanPhone) {
          // Buscar si ya existe un cliente con el mismo nombre y teléfono que haya tenido créditos anteriormente
          const existingClient = allPreviousLoansData?.loans?.find((existingLoan: any) => {
            const existingName = (existingLoan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' ');
            const existingPhone = (existingLoan.borrower?.personalData?.phones?.[0]?.number || '').trim().replace(/\s+/g, ' ');
            return existingName.toLowerCase() === cleanName.toLowerCase() && 
                   existingPhone === cleanPhone;
          });

          if (existingClient) {
            alert(`El cliente "${cleanName}" ya ha tenido créditos anteriormente, usa la opción de renovación`);
            setIsCreating(false);
            return;
          }
        }
      }

      const loansData = validLoans.map(loan => {
        // ✅ DEBUG: Estado completo del préstamo antes de procesar
        console.log('🔍 ESTADO COMPLETO DEL PRÉSTAMO:', {
          loanId: loan.id,
          loanKeys: Object.keys(loan),
          selectedCollateralId: loan.selectedCollateralId,
          avalAction: loan.avalAction,
          avalName: loan.avalName,
          avalPhone: loan.avalPhone,
          selectedCollateralPhoneId: loan.selectedCollateralPhoneId
        });
        
        // Debug detallado para cada préstamo
        console.log('🔍 DEBUG PRÉSTAMO EN handleSaveAllNewLoans:', {
          loanId: loan.id,
          hasBorrower: !!loan.borrower,
          hasPersonalData: !!loan.borrower?.personalData,
          personalDataKeys: loan.borrower?.personalData ? Object.keys(loan.borrower.personalData) : 'NO PERSONAL DATA',
          fullName: loan.borrower?.personalData?.fullName,
          hasPhones: !!loan.borrower?.personalData?.phones,
          phonesLength: loan.borrower?.personalData?.phones?.length || 0,
          firstPhone: loan.borrower?.personalData?.phones?.[0],
          firstPhoneNumber: loan.borrower?.personalData?.phones?.[0]?.number,
          isFromPrevious: !!loan.previousLoan,
          // Debug adicional para ver si hay datos en otras rutas
          loanKeys: Object.keys(loan),
          hasClientData: !!(loan as any).clientData,
          clientData: (loan as any).clientData,
          // ✅ DEBUG AVAL
          avalName: loan.avalName,
          avalPhone: loan.avalPhone,
          selectedCollateralId: loan.selectedCollateralId,
          selectedCollateralPhoneId: loan.selectedCollateralPhoneId,
          avalAction: loan.avalAction
        });
        
        // Intentar obtener el teléfono de diferentes fuentes
        let phoneNumber = '';
        
        // 1. Intentar desde personalData.phones[0].number
        if (loan.borrower?.personalData?.phones?.[0]?.number) {
          phoneNumber = loan.borrower.personalData.phones[0].number;
          console.log('📞 Teléfono encontrado en personalData.phones[0].number:', phoneNumber);
        }
        // 2. Intentar desde clientData (si existe)
        else if ((loan as any).clientData?.clientPhone) {
          phoneNumber = (loan as any).clientData.clientPhone;
          console.log('📞 Teléfono encontrado en clientData.clientPhone:', phoneNumber);
        }
        // 3. Intentar desde avalData (si es un aval)
        else if ((loan as any).avalData?.phone) {
          phoneNumber = (loan as any).avalData.phone;
          console.log('📞 Teléfono encontrado en avalData.phone:', phoneNumber);
        }
        
        console.log('📞 Teléfono final seleccionado:', phoneNumber);
        
        // ✅ DEBUG AVAL DATA - Verificar que selectedCollateralId se está enviando correctamente
        console.log('🔍 AVAL DATA DEBUG:', {
          loanId: loan.id,
          selectedCollateralId: loan.selectedCollateralId,
          avalAction: loan.avalAction,
          avalName: loan.avalName,
          avalPhone: loan.avalPhone,
          hasSelectedCollateralId: !!loan.selectedCollateralId,
          isFromPrevious: !!loan.previousLoan
        });
        
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
        
        // ✅ DEBUG FINAL - Mostrar el objeto avalData que se enviará
        console.log('📤 AVAL DATA FINAL ENVIADO:', {
          loanId: loan.id,
          avalData: {
            selectedCollateralId: loan.selectedCollateralId || undefined,
            action: loan.avalAction || 'clear',
            name: (loan.avalName || '').trim().replace(/\s+/g, ' '),
            phone: (loan.avalPhone || '').trim().replace(/\s+/g, ' ')
          }
        });
      });

      const { data } = await createMultipleLoans({ variables: { loans: loansData } });

      if (data?.createMultipleLoans) {
        console.log('🔍 Respuesta de createMultipleLoans:', data.createMultipleLoans);
        
        // Verificar si hay errores - puede ser un array con un solo elemento de error
        if (data.createMultipleLoans.length === 1 && !data.createMultipleLoans[0].success) {
          const errorResponse = data.createMultipleLoans[0];
          console.log('❌ Error único encontrado:', errorResponse);
          const errorMessage = errorResponse.message || 'Error desconocido al crear el préstamo';
          alert(errorMessage);
          return;
        }
        
        // Verificar si hay errores en múltiples elementos
        const errorResponse = data.createMultipleLoans.find((loan: any) => !loan.success);
        if (errorResponse) {
          console.log('❌ Error encontrado en múltiples elementos:', errorResponse);
          const errorMessage = errorResponse.message || 'Error desconocido al crear el préstamo';
          alert(errorMessage);
          return;
        }

        // Verificar que todos los elementos tengan success: true
        const allSuccessful = data.createMultipleLoans.every((loan: any) => loan.success === true);
        if (!allSuccessful) {
          console.log('❌ No todos los préstamos se crearon exitosamente');
          alert('Error al crear algunos préstamos');
          return;
        }

        console.log('✅ Todos los préstamos se crearon exitosamente');
        
        // Registrar pagos iniciales si hay préstamos con pagos configurados
        if (Object.keys(initialPayments).length > 0) {
          console.log('💳 Registrando pagos iniciales...');
          await handleRegisterInitialPayments();
        }
        
        setPendingLoans([]);
        setEditableEmptyRow(null);
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
    // Calcular amountToPay si no existe
    const calculatedAmountToPay = loan.amountToPay ||
      calculateAmountToPay(loan.requestedAmount.toString(), loan.loantype?.rate?.toString() || '0');

    // Calcular pendingAmount si no existe - usar 0 como valor por defecto seguro
    const calculatedPendingAmount = loan.pendingAmount || '0';

    // Extraer información del aval de los collaterals
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
      // Mapear información del aval para el modal
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

      // ✅ NUEVO: Preparar datos para la mutación personalizada
      const loanData = {
        requestedAmount: editingLoan.requestedAmount,
        amountGived: editingLoan.amountGived,
        comissionAmount: editingLoan.comissionAmount,
        loantypeId: editingLoan.loantype?.id, // ✅ NUEVO: Incluir loantypeId para recálculo de abonos
        // signDate eliminado; backend usará la fecha del préstamo
        avalData: ((editingLoan as any).selectedCollateralId
          ? {
              // Con ID seleccionado: forzar connect y NO enviar name/phone para evitar sobrescribir con texto parcial
              selectedCollateralId: (editingLoan as any).selectedCollateralId,
              action: 'connect' as const
            }
          : (
              ((editingLoan as any).avalName || (editingLoan as any).avalPhone)
                ? {
                    // Sin ID: si hay datos escritos, crear/actualizar según avalAction
                    name: (editingLoan as any).avalName || '',
                    phone: (editingLoan as any).avalPhone || '',
                    action: (editingLoan as any).avalAction || 'create'
                  }
                : { action: 'clear' as const }
            ))
      };

      console.log('🔄 Enviando actualización de préstamo con aval:', loanData);

      // ✅ NUEVO: Usar la mutación personalizada updateLoanWithAval
      const { data } = await updateLoanWithAval({
        variables: {
          where: editingLoan.id,
          data: loanData
        }
      });

      // ✅ NUEVO: La respuesta es JSON puro, no un objeto estructurado
      const response = data?.updateLoanWithAval;
      console.log('📊 Respuesta de updateLoanWithAval:', response);

      if (response?.success) {
        console.log('✅ Préstamo actualizado exitosamente con aval:', response);

        // ✅ NUEVO: Actualizar el estado local con el préstamo actualizado si está disponible
        if (response.loan) {
          setLoans(prevLoans =>
            prevLoans.map(loan => loan.id === editingLoan.id ? response.loan : loan)
          );
        }

        // Refrescar datos
        Promise.all([
          refetchLoans(),
          refetchRoute()
        ]).then(() => {
          console.log('✅ Préstamo actualizado y datos refrescados');
        });

        // Triggear refresh de balances
        triggerRefresh();

        setEditingLoan(null);
      } else {
        console.error('❌ Error en la respuesta de updateLoanWithAval:', response);
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
            const updatedBalance = 0; // Se necesita recalcular el balance total
            onBalanceUpdate(updatedBalance);
          }
        });

        // Triggear refresh de balances
        triggerRefresh();
      }
    } catch (error) {
      console.error('Error al eliminar el préstamo:', error);
      await refetchLoans();
    } finally {
      setIsDeleting(null);
    }
  };

  // Calcular totales de préstamos existentes
  const existingTotals = loans.reduce((acc, loan) => ({
    count: acc.count + 1,
    amountGived: acc.amountGived + parseFloat(loan.amountGived || '0'),
    amountToPay: acc.amountToPay + parseFloat(loan.totalDebtAcquired || '0'),
    totalComission: acc.totalComission + parseFloat(loan.comissionAmount || '0'),
    newLoans: acc.newLoans + (loan.previousLoan ? 0 : 1),
    renewals: acc.renewals + (loan.previousLoan ? 1 : 0),
  }), { count: 0, amountGived: 0, amountToPay: 0, totalComission: 0, newLoans: 0, renewals: 0 });

  // Calcular totales de préstamos pendientes
  const pendingTotals = pendingLoans.reduce((acc, loan) => ({
    count: acc.count + 1,
    amountGived: acc.amountGived + parseFloat(loan.amountGived || '0'),
    amountToPay: acc.amountToPay + parseFloat(loan.totalDebtAcquired || '0'),
    totalComission: acc.totalComission + parseFloat(loan.comissionAmount || '0'),
    newLoans: acc.newLoans + (loan.previousLoan ? 0 : 1),
    renewals: acc.renewals + (loan.previousLoan ? 1 : 0),
  }), { count: 0, amountGived: 0, amountToPay: 0, totalComission: 0, newLoans: 0, renewals: 0 });

  // Totales combinados (existentes + pendientes)
  const totals = {
    count: existingTotals.count + pendingTotals.count,
    amountGived: existingTotals.amountGived + pendingTotals.amountGived,
    amountToPay: existingTotals.amountToPay + pendingTotals.amountToPay,
    totalComission: existingTotals.totalComission + pendingTotals.totalComission,
    newLoans: existingTotals.newLoans + pendingTotals.newLoans,
    renewals: existingTotals.renewals + pendingTotals.renewals,
  };
  
  if (loansLoading || loanTypesLoading || previousLoansLoading) return (
    <Box css={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '400px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      borderRadius: '12px',
      margin: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Efecto de ondas de fondo */}
      <Box css={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
        animation: 'pulse 2s ease-in-out infinite'
      }} />
      
      {/* Spinner moderno */}
      <Box css={{
        width: '60px',
        height: '60px',
        border: '4px solid #e2e8f0',
        borderTop: '4px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '20px',
        position: 'relative',
        zIndex: 1
      }} />
      
      {/* Texto de carga */}
      <Box css={{
        fontSize: '18px',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '8px',
        position: 'relative',
        zIndex: 1
      }}>
        Cargando créditos...
      </Box>
      
      {/* Subtítulo */}
      <Box css={{
        fontSize: '14px',
        color: '#6b7280',
        position: 'relative',
        zIndex: 1
      }}>
        Preparando datos de préstamos
      </Box>
      
      {/* CSS para animaciones */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </Box>
  );
  if (loansError) return <Box paddingTop="xlarge"><GraphQLErrorNotice errors={loansError?.graphQLErrors || []} networkError={loansError?.networkError} /></Box>;
  
  // Validar que se hayan seleccionado ruta y localidad
  if (!selectedDate || !selectedRoute || !selectedLead) {
    return (
      <SelectionMessage
        icon="💰"
        title="Selecciona Ruta y Localidad"
        description="Para gestionar los créditos, necesitas seleccionar una ruta y una localidad específica."
        requirements={[
          "Selecciona una ruta desde el selector superior",
          "Elige una localidad de la ruta seleccionada",
          "Los créditos se cargarán automáticamente"
        ]}
      />
    );
  }

  // Función para aplicar comisión masiva a préstamos pendientes
  const handleApplyMassCommission = () => {
    const commission = parseFloat(massCommission);
    if (isNaN(commission)) return;
    
    // Aplicar comisión masiva SOLO a préstamos pendientes que tienen comisión > 0
    const updatedPendingLoans = pendingLoans.map(loan => {
      const currentCommission = parseFloat(loan.comissionAmount?.toString() || '0');
      if (currentCommission > 0) {
        return {
          ...loan,
          comissionAmount: commission.toFixed(2)
        };
      }
      return loan;
    });
    
    setPendingLoans(updatedPendingLoans);
  };
  
  return (
    <React.Fragment>
      <Box paddingTop="medium">
        {/* Barra de KPIs reutilizable */}
        <KPIBar
          chips={[
            {
              label: 'Créditos',
              value: totals.count,
              color: '#374151',
              backgroundColor: '#F3F4F6',
              borderColor: '#E5E7EB'
            },
            {
              label: 'Nuevos',
              value: totals.newLoans,
              color: '#1E40AF',
              backgroundColor: '#EFF6FF',
              borderColor: '#BFDBFE'
            },
            {
              label: 'Renovaciones',
              value: totals.renewals,
              color: '#92400E',
              backgroundColor: '#FEF3C7',
              borderColor: '#FDE68A'
            },
            {
              label: 'Otorgado',
              value: `$${totals.amountGived.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              color: '#BE185D',
              backgroundColor: '#FDF2F8',
              borderColor: '#FBCFE8',
              showTooltip: true,
              tooltipContent: (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Desglose de Montos Otorgados
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #F3F4F6',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      💰 Nuevos Créditos
                    </span>
                    <span style={{ fontWeight: '600', color: '#1E40AF' }}>
                      ${totals.newLoans > 0 ? (totals.amountGived * (totals.newLoans / totals.count)).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #F3F4F6',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      🔄 Renovaciones
                    </span>
                    <span style={{ fontWeight: '600', color: '#92400E' }}>
                      ${totals.renewals > 0 ? (totals.amountGived * (totals.renewals / totals.count)).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      📊 Existentes
                    </span>
                    <span style={{ fontWeight: '600', color: '#6B7280' }}>
                      ${existingTotals.amountGived.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      ⏳ Pendientes
                    </span>
                    <span style={{ fontWeight: '600', color: '#3B82F6' }}>
                      ${pendingTotals.amountGived.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              )
            },
            {
              label: 'A Pagar',
              value: `$${totals.amountToPay.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              color: '#166534',
              backgroundColor: '#F0FDF4',
              borderColor: '#BBF7D0',
              showTooltip: true,
              tooltipContent: (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Desglose de Montos a Pagar
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #F3F4F6',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      💰 Capital
                    </span>
                    <span style={{ fontWeight: '600', color: '#166534' }}>
                      ${totals.amountGived.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #F3F4F6',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      📈 Intereses
                    </span>
                    <span style={{ fontWeight: '600', color: '#166534' }}>
                      ${(totals.amountToPay - totals.amountGived).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '1px solid #F3F4F6',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      📊 Existentes
                    </span>
                    <span style={{ fontWeight: '600', color: '#6B7280' }}>
                      ${existingTotals.amountToPay.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#374151' }}>
                      ⏳ Pendientes
                    </span>
                    <span style={{ fontWeight: '600', color: '#3B82F6' }}>
                      ${pendingTotals.amountToPay.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              )
            },
            {
              label: 'Comisiones',
              value: `$${totals.totalComission.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              color: '#6D28D9',
              backgroundColor: '#EDE9FE',
              borderColor: '#DDD6FE',
              showTooltip: true,
              tooltipContent: (() => {
                const breakdown: { [key: string]: { count: number, amount: number, existing: number, pending: number } } = {};
                
                // Analizar comisiones de préstamos existentes
                loans.forEach((loan: any) => {
                  const commission = parseFloat(loan.comissionAmount || '0');
                  const key = commission.toString();
                  if (!breakdown[key]) breakdown[key] = { count: 0, amount: 0, existing: 0, pending: 0 };
                  breakdown[key].count += 1;
                  breakdown[key].amount += commission;
                  breakdown[key].existing += 1;
                });
                
                // Analizar comisiones de préstamos pendientes
                pendingLoans.forEach((loan: any) => {
                  const commission = parseFloat(loan.comissionAmount || '0');
                  const key = commission.toString();
                  if (!breakdown[key]) breakdown[key] = { count: 0, amount: 0, existing: 0, pending: 0 };
                  breakdown[key].count += 1;
                  breakdown[key].amount += commission;
                  breakdown[key].pending += 1;
                });
                
                const sorted = Object.entries(breakdown).sort(([,a], [,b]) => b.amount - a.amount).slice(0, 5);
                
                if (sorted.length === 0) {
                  return <div style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic' }}>Sin desglose</div>;
                }
                
                return (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Desglose de Comisiones
                    </div>
                    {sorted.map(([commission, data]) => {
                      const isZeroCommission = parseFloat(commission) === 0;
                      return (
                        <div key={commission} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '4px 0',
                          borderBottom: '1px solid #F3F4F6',
                          fontSize: '11px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '2px'
                          }}>
                            <span style={{
                              backgroundColor: isZeroCommission ? '#FEF3C7' : 'transparent',
                              color: isZeroCommission ? '#D97706' : '#374151',
                              padding: isZeroCommission ? '2px 6px' : '0',
                              borderRadius: isZeroCommission ? '4px' : '0',
                              fontWeight: isZeroCommission ? '500' : 'normal'
                            }}>
                              {data.count}x ${commission}
                            </span>
                            <span style={{ fontWeight: '600', color: '#6D28D9' }}>
                              ${data.amount.toFixed(2)}
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '10px',
                            color: '#6B7280'
                          }}>
                            <span>📊 {data.existing} existentes</span>
                            <span>⏳ {data.pending} pendientes</span>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0 4px 0',
                      borderTop: '1px solid #E5E7EB',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#374151'
                    }}>
                      <span>📊 Existentes: ${existingTotals.totalComission.toFixed(2)}</span>
                      <span>⏳ Pendientes: ${pendingTotals.totalComission.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()
            }
          ]}
          buttons={[]}
          primaryMenu={{
            onSave: handleSaveAllNewLoans,
            onReportFalco: () => {
              // TODO: Implementar reporte de falco para créditos
              console.log('Reportar falco de créditos');
            },
            onMove: () => {
              // TODO: Implementar mover créditos
              console.log('Mover créditos');
            },
            saving: isCreating,
            disabled: pendingLoans.length === 0,
            moveDisabled: loans.length === 0
          }}
          dateMover={{
            type: 'loans',
            selectedDate,
            selectedLead,
            onSuccess: handleDateMoveSuccess,
            itemCount: loans.length,
            label: 'préstamo(s)'
          }}
          massCommission={pendingLoans.length > 0 ? {
            value: massCommission,
            onChange: setMassCommission,
            onApply: handleApplyMassCommission,
            visible: true
          } : undefined}
        />

        {/* Loans Table */}
        <Box style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', position: 'relative' }}>
          {/* Indicador de scroll horizontal */}
          <div style={{
            position: 'absolute',
            top: '50%',
            right: '8px',
            transform: 'translateY(-50%)',
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
            color: '#666',
            zIndex: 10,
            pointerEvents: 'none',
            opacity: 0.7
          }}>
          </div>
          <div ref={existingLoansTableRef} style={{ 
            padding: '12px', 
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            scrollBehavior: 'smooth'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <th style={tableHeaderStyle}>Préstamo Previo</th>
                        <th style={tableHeaderStyle}>Tipo</th>
                        <th style={tableHeaderStyle}>Nombre</th>
                        <th style={tableHeaderStyle}>Teléfono</th>
                        <th style={tableHeaderStyle}>M. Solicitado</th>
                        <th style={tableHeaderStyle}>Deuda Pendiente</th>
                        <th style={tableHeaderStyle}>M. Entregado</th>
                        <th style={tableHeaderStyle}>M. a Pagar</th>
                        <th style={tableHeaderStyle}>Comisión</th>
                        <th style={tableHeaderStyle}>Aval</th>
                        <th style={tableHeaderStyle}>Tel. Aval</th>
                        <th style={{ ...tableHeaderStyle, width: '40px', minWidth: '40px' }}></th>
                    </tr>
                </thead>
                <tbody>
                    {loans.map((loan) => (
                        <tr key={loan.id} style={{ borderBottom: '1px solid #E5E7EB', transition: 'all 0.3s ease', backgroundColor: loan.id === newLoanId ? '#F0F9FF' : 'white', position: 'relative' }}>
                            {loan.id === newLoanId && <td colSpan={12} style={{ position: 'absolute', left: 0, top: 0, width: '3px', height: '100%', backgroundColor: '#0052CC' }} />}
                            <td style={tableCellStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {loan.previousLoan ? 
                                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', backgroundColor: '#F0F9FF', color: '#0052CC', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>Renovado</span> 
                                  : 
                                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', backgroundColor: '#F0FDF4', color: '#059669', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>Nuevo</span>
                                }
                {hasPaymentForToday(loan.id) ? (
                  <div
                    style={{ 
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
                      minWidth: '130px',
                      justifyContent: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.025em',
                      cursor: 'default'
                    }}
                  >
                    <span style={{ fontSize: '12px' }}>✓</span>
                    Pagado ${getRegisteredPaymentAmount(loan.id)}
                  </div>
                ) : (
                  <button
                    onClick={() => handleToggleInitialPayment(loan.id)}
                    style={{ 
                      fontSize: '11px', 
                      padding: '8px 12px',
                      height: '32px',
                      backgroundColor: initialPayments[loan.id] ? '#3B82F6' : '#10B981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '600',
                      boxShadow: initialPayments[loan.id] 
                        ? '0 4px 6px -1px rgba(59, 130, 246, 0.3), 0 2px 4px -1px rgba(59, 130, 246, 0.2)'
                        : '0 4px 6px -1px rgba(16, 185, 129, 0.3), 0 2px 4px -1px rgba(16, 185, 129, 0.2)',
                      transition: 'all 0.2s ease',
                      minWidth: '130px',
                      justifyContent: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.025em'
                    }}
                    onMouseEnter={(e) => {
                      if (!initialPayments[loan.id]) {
                        e.currentTarget.style.backgroundColor = '#059669';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(16, 185, 129, 0.4), 0 4px 6px -1px rgba(16, 185, 129, 0.3)';
                      } else {
                        e.currentTarget.style.backgroundColor = '#2563EB';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(59, 130, 246, 0.4), 0 4px 6px -1px rgba(59, 130, 246, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      if (!initialPayments[loan.id]) {
                        e.currentTarget.style.backgroundColor = '#10B981';
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(16, 185, 129, 0.3), 0 2px 4px -1px rgba(16, 185, 129, 0.2)';
                      } else {
                        e.currentTarget.style.backgroundColor = '#3B82F6';
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.3), 0 2px 4px -1px rgba(59, 130, 246, 0.2)';
                      }
                    }}
                  >
                    {initialPayments[loan.id] ? (
                      <>
                        <span style={{ fontSize: '12px' }}>✓</span>
                        Pago configurado
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '12px' }}>💰</span>
                        Registrar pago
                      </>
                    )}
                  </button>
                )}
                              </div>
                            </td>
                            <td style={tableCellStyle}>{loan.loantype.name}</td>
                            <td style={tableCellStyle}>{loan.borrower?.personalData?.fullName || 'Sin nombre'}</td>
                            <td style={tableCellStyle}>{loan.borrower?.personalData?.phones?.[0]?.number || '-'}</td>
                            <td style={tableCellStyle}>${loan.requestedAmount}</td>
                            <td style={tableCellStyle}>${loan.previousLoan?.pendingAmount || '0'}</td>
                            <td style={tableCellStyle}>${loan.amountGived}</td>
                            <td style={tableCellStyle}>${loan.totalDebtAcquired || 'N/A'}</td>
                            <td style={tableCellStyle}>${loan.comissionAmount || '0'}</td>
                            <td style={tableCellStyle}>{loan.collaterals?.[0]?.fullName || (loan as any).avalName || '-'}</td>
                            <td style={tableCellStyle}>{loan.collaterals?.[0]?.phones?.[0]?.number || (loan as any).avalPhone || '-'}</td>
                            <td style={{ ...tableCellStyle, width: '40px', position: 'relative' }}>
                                {isDeleting === loan.id ? <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '32px' }}><LoadingDots label="Eliminando" size="small" /></Box> : <Button ref={el => { buttonRefs.current[loan.id] = el; }} tone="passive" size="small" onClick={() => setActiveMenu(activeMenu === loan.id ? null : loan.id)} style={{ padding: '6px 8px', minWidth: '40px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }} title="Opciones del préstamo">⋮</Button>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        </Box>
      </Box>

      {/* Sección de Agregar Nuevos Préstamos */}
      <AddNewLoansSection
        selectedDate={selectedDate}
        selectedLead={selectedLead}
        onSaveLoans={async (loans) => {
          // Adaptar los préstamos del nuevo componente al formato esperado por handleSaveAllNewLoans
          setPendingLoans(loans as ExtendedLoan[]);
          await handleSaveAllNewLoans();
        }}
        isSaving={isCreating}
        usedAvalIds={usedAvalIds}
      />

      {/* Código antiguo removido - ahora se usa AddNewLoansSection */}

      {/* DropdownPortal y Edit Modal */}
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
                transform: 'translateY(-100%)',
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
                style={{ ...menuItemStyle, color: '#DC2626', borderTop: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', backgroundColor: 'transparent', border: 'none', textAlign: 'left' }}
                disabled={isDeleting === loan.id}
              >
                <FaTrash size={14} />
                <span>Eliminar</span>
              </button>
            </div>
          )
        ))}
      </DropdownPortal>

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
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1a1f36' }}>
                  Editar Préstamo
                </h2>
                <p style={{ margin: 0, color: '#697386', fontSize: '14px' }}>
                  Modifica los detalles del préstamo seleccionado
                </p>
              </Stack>

              <Stack gap="medium">
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Deuda Pendiente del Préstamo Anterior
                  </label>
                  <TextInput
                    type="text"
                    placeholder="0.00"
                    value={editingLoan.previousLoan?.pendingAmount || '0'}
                    readOnly
                    style={{ ...inputStyle, backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Tipo de Préstamo
                  </label>
                  <div style={{
                    minWidth: '200px',
                    maxWidth: '300px',
                    transition: 'all 0.3s ease'
                  }}>
                  <Select
                    options={loanTypeOptions}
                    onChange={value => {
                      if (value) {
                        const selectedType = loanTypesData?.loantypes?.find((type: any) => type.id === value.value);
                        if (selectedType) {
                          const { amountGived, amountToPay, totalDebtAcquired } = calculateLoanAmounts({
                            requestedAmount: editingLoan.requestedAmount,
                            pendingAmount: editingLoan.previousLoan?.pendingAmount || '0',
                            rate: selectedType.rate
                          });
                          const defaultCommission = selectedType.loanGrantedComission || 0;
                          const commissionAmount = defaultCommission && parseFloat(defaultCommission.toString()) > 0 ?
                            defaultCommission.toString() :
                            editingLoan.comissionAmount || '0';
                          setEditingLoan({ ...editingLoan, loantype: { id: value.value, name: value.label.split('(')[0].trim(), rate: selectedType.rate, weekDuration: selectedType.weekDuration, loanPaymentComission: selectedType.loanPaymentComission || '0' } as LoanType, amountGived, amountToPay, totalDebtAcquired, comissionAmount: commissionAmount });
                        }
                      }
                    }}
                    value={loanTypeOptions.find((option: any) => option.value === editingLoan.loantype?.id) || null}
                      components={{
                          Option: ({ children, ...props }: any) => {
                              const option = props.data;
                              const weekDuration = option?.weekDuration || 0;
                              const rate = option?.rate || 0;
                              
                              return (
                                  <div
                                      {...props.innerProps}
                                      style={{
                                          ...props.innerProps.style,
                                          backgroundColor: '#F8FAFC',
                                          color: '#1F2937',
                                          padding: '8px 12px',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          borderBottom: '1px solid #E5E7EB',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          minHeight: '40px'
                                      }}
                                  >
                                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontWeight: '500' }}>{children}</span>
                                          <span
                                              style={{
                                                  backgroundColor: '#3B82F6',
                                                  color: 'white',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  fontSize: '10px',
                                                  fontWeight: '600'
                                              }}
                                          >
                                              {weekDuration} sem
                                          </span>
                                          <span
                                              style={{
                                                  backgroundColor: '#059669',
                                                  color: 'white',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  fontSize: '10px',
                                                  fontWeight: '600'
                                              }}
                                          >
                                              {rate}%
                                          </span>
                                      </div>
                                  </div>
                              );
                          }
                      }}
                      styles={{ 
                          container: (base) => ({ ...base, width: '100%' }), 
                          menu: (base) => ({ ...base, minWidth: '300px', maxWidth: '400px' }) 
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Monto Solicitado
                  </label>
                  <TextInput
                    type="text"
                    placeholder="0.00"
                    value={editingLoan.requestedAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Si el valor actual es "0" y el usuario empieza a escribir, eliminar el "0"
                      const requestedAmount = (editingLoan.requestedAmount === '0' && value.length > 1) ? value.substring(1) : value;
                      const { amountGived, amountToPay, totalDebtAcquired } = calculateLoanAmounts({
                        requestedAmount,
                        pendingAmount: editingLoan.previousLoan?.pendingAmount || '0',
                        rate: editingLoan.loantype.rate
                      });
                      setEditingLoan({ ...editingLoan, requestedAmount, amountGived, amountToPay, totalDebtAcquired });
                    }}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Monto Entregado
                  </label>
                  <TextInput
                    type="text"
                    placeholder="0.00"
                    value={editingLoan.amountGived}
                    readOnly
                    style={{ ...inputStyle, backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Monto a Pagar
                  </label>
                  <TextInput
                    type="text"
                    placeholder="0.00"
                    value={editingLoan.amountToPay}
                    readOnly
                    style={{ ...inputStyle, backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Comisión
                  </label>
                  <TextInput
                    type="text"
                    placeholder="0.00"
                    value={editingLoan.comissionAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Si el valor actual es "0" y el usuario empieza a escribir, eliminar el "0"
                      const comissionAmount = (editingLoan.comissionAmount === '0' && value.length > 1) ? value.substring(1) : value;
                      setEditingLoan({ ...editingLoan, comissionAmount });
                    }}
                    style={inputStyle}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Aval
                  </label>
                  <AvalInputWithAutocomplete
                    loanId="editing-loan"
                    currentName={(editingLoan as any).avalName || ''}
                    currentPhone={(editingLoan as any).avalPhone || ''}
                    selectedCollateralId={(editingLoan as any).selectedCollateralId}
                    selectedCollateralPhoneId={(editingLoan as any).selectedCollateralPhoneId}
                    onAvalChange={(avalData) => {
                      setEditingLoan(prev => ({ 
                        ...prev, 
                        avalName: avalData.avalName,
                        avalPhone: avalData.avalPhone,
                        selectedCollateralId: avalData.selectedCollateralId,
                        selectedCollateralPhoneId: avalData.selectedCollateralPhoneId,
                        avalAction: avalData.avalAction
                      } as any));
                    }}
                    onAvalUpdated={(updatedPerson) => {
                      // Actualizar el estado del préstamo en edición con los datos actualizados
                      setEditingLoan(prev => ({
                        ...prev,
                        avalName: updatedPerson.fullName,
                        avalPhone: updatedPerson.phones?.[0]?.number || '',
                        selectedCollateralId: updatedPerson.id,
                        selectedCollateralPhoneId: updatedPerson.phones?.[0]?.id,
                        avalAction: 'update'
                      } as any));
                    }}
                    usedPersonIds={[]}
                    borrowerLocationId={editingLoan.borrower?.personalData?.addresses?.[0]?.location?.id}
                    includeAllLocations={false}
                    readonly={false}
                    isFromPrevious={!!editingLoan.previousLoan}
                  />
                </div>
              </Stack>

              <Box style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <Button
                  tone="negative"
                  size="large"
                  onClick={() => setEditingLoan(null)}
                  style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px' }}
                >
                  Cancelar
                </Button>
                <Button
                  tone="active"
                  size="large"
                  weight="bold"
                  onClick={handleUpdateLoan}
                  disabled={isUpdating === editingLoan.id}
                  style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', backgroundColor: '#0052CC', opacity: isUpdating === editingLoan.id ? 0.7 : 1, cursor: isUpdating === editingLoan.id ? 'wait' : 'pointer' }}
                >
                  {isUpdating === editingLoan.id ? <LoadingDots label="Guardando" size="small" /> : 'Guardar Cambios'}
                </Button>
              </Box>
            </Stack>
          </Box>
        </Box>
      )}
            {/* Modal de configuración de pago */}
            <PaymentConfigModal
              isOpen={!!selectedPaymentLoan}
              selectedLoan={selectedPaymentLoan}
              initialPayments={initialPayments}
              onClose={() => setSelectedPaymentLoan(null)}
              onSave={handleSavePaymentConfig}
              isSaving={isSavingPayment}
            />

    </React.Fragment>
  );
};

// Styles
const tableHeaderStyle = {
  padding: '8px 12px',
  textAlign: 'left' as const,
  fontWeight: '500',
  color: '#374151',
  whiteSpace: 'normal' as const,
  fontSize: '12px',
  lineHeight: '1.2',
  minWidth: '80px',
  maxWidth: '120px',
};

const tableCellStyle = {
  padding: '12px 16px',
  color: '#1a1f36',
  fontSize: '11px',
  verticalAlign: 'middle', // Usamos verticalAlign para celdas de tabla
  whiteSpace: 'nowrap' as const,
  height: '80px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  position: 'relative' as const,
} as const;

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