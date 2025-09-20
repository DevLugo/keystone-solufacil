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
import { FaPlus, FaTrash, FaEdit, FaSearch, FaEllipsisV, FaCheck, FaTimes } from 'react-icons/fa';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { calculateLoanAmounts } from '../../utils/loanCalculations';
import { GET_ROUTE } from '../../graphql/queries/routes';
import { CREATE_LOANS_BULK, UPDATE_LOAN_WITH_AVAL } from '../../graphql/mutations/loans';
import PersonInputWithAutocomplete from '../loans/PersonInputWithAutocomplete';

// Import types
import type { Loan } from '../../types/loan';
import { calculateAmountToPay, calculatePendingAmountSimple, processLoansWithCalculations } from '../../utils/loanCalculations';
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
  alignItems: 'flex-end',
  transition: 'all 0.3s ease'
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

// Query unificada para buscar en todos los líderes (con o sin filtro)
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

  // Query unificada para búsqueda en todos los líderes
  const { data: allPreviousLoansData, loading: allPreviousLoansLoading, refetch: refetchAllPreviousLoans } = useQuery(GET_ALL_PREVIOUS_LOANS, {
    variables: { 
      searchText: '', 
      take: 10 
    },
    skip: false, // Permitir que se ejecute
  });

  const { data: loanTypesData, loading: loanTypesLoading } = useQuery(GET_LOAN_TYPES);

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
            // ✅ CORREGIDO: Actualizar específicamente los campos del aval
            updatedRow = { 
                ...updatedRow, 
                avalName: value.avalName,
                avalPhone: value.avalPhone,
                selectedCollateralId: value.selectedCollateralId,
                selectedCollateralPhoneId: value.selectedCollateralPhoneId,
                avalAction: value.avalAction
            };
        } else {
            updatedRow = { ...updatedRow, [field]: value };
        }
    }

    if (['requestedAmount', 'loantype', 'previousLoan'].includes(field)) {
      const { amountGived, amountToPay } = calculateLoanAmounts({
        requestedAmount: updatedRow.requestedAmount || '0',
        pendingAmount: updatedRow.previousLoan?.pendingAmount || '0',
        rate: updatedRow.loantype?.rate || '0',
      });
      updatedRow.amountGived = amountGived;
      updatedRow.amountToPay = amountToPay;
    }

    if (isNewRow) {
      setEditableEmptyRow(updatedRow);
    } else {
      setPendingLoans(prev => prev.map((loan, i) => i === index ? updatedRow : loan));
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

      // Validar clientes duplicados
      for (const loan of validLoans) {
        const cleanName = (loan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' ');
        const cleanPhone = (loan.borrower?.personalData?.phones?.[0]?.number || '').trim().replace(/\s+/g, ' ');
        
        if (cleanName && cleanPhone) {
          // Buscar si ya existe un cliente con el mismo nombre y teléfono
          const existingClient = allPreviousLoansData?.loans?.find((existingLoan: any) => {
            const existingName = (existingLoan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' ');
            const existingPhone = (existingLoan.borrower?.personalData?.phones?.[0]?.number || '').trim().replace(/\s+/g, ' ');
            return existingName.toLowerCase() === cleanName.toLowerCase() && existingPhone === cleanPhone;
          });

          if (existingClient) {
            alert(`El cliente "${cleanName}" ya existe, renueva el crédito anterior`);
            setIsCreating(false);
            return;
          }
        }
      }

      const loansData = validLoans.map(loan => {
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

    setEditingLoan({
      ...loan,
      requestedAmount: loan.requestedAmount.toString(),
      amountGived: loan.amountGived.toString(),
      amountToPay: calculatedAmountToPay.toString(),
      pendingAmount: calculatedPendingAmount.toString(),
      comissionAmount: loan.comissionAmount?.toString() || '0'
    });
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

  const totals = loans.reduce((acc, loan) => ({
    count: acc.count + 1,
    amountGived: acc.amountGived + parseFloat(loan.amountGived || '0'),
    amountToPay: acc.amountToPay + parseFloat(calculateAmountToPay(loan.requestedAmount, loan.loantype?.rate) || '0'),
    newLoans: acc.newLoans + (loan.previousLoan ? 0 : 1),
    renewals: acc.renewals + (loan.previousLoan ? 1 : 0),
  }), { count: 0, amountGived: 0, amountToPay: 0, newLoans: 0, renewals: 0 });
  
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
  
  return (
    <>
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
              borderColor: '#FBCFE8'
            },
            {
              label: 'A Pagar',
              value: `$${totals.amountToPay.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              color: '#166534',
              backgroundColor: '#F0FDF4',
              borderColor: '#BBF7D0'
            }
          ]}
          buttons={[]}
          dateMover={{
            type: 'loans',
            selectedDate,
            selectedLead,
            onSuccess: handleDateMoveSuccess,
            itemCount: loans.length,
            label: 'préstamo(s)'
          }}
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
            ← Scroll →
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
                            <td style={tableCellStyle}>{loan.previousLoan ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', backgroundColor: '#F0F9FF', color: '#0052CC', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>Renovado</span> : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', backgroundColor: '#F0FDF4', color: '#059669', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>Nuevo</span>}</td>
                            <td style={tableCellStyle}>{loan.loantype.name}</td>
                            <td style={tableCellStyle}>{loan.borrower?.personalData?.fullName || 'Sin nombre'}</td>
                            <td style={tableCellStyle}>{loan.borrower?.personalData?.phones?.[0]?.number || '-'}</td>
                            <td style={tableCellStyle}>${loan.requestedAmount}</td>
                            <td style={tableCellStyle}>${loan.previousLoan?.pendingAmount || '0'}</td>
                            <td style={tableCellStyle}>${loan.amountGived}</td>
                            <td style={tableCellStyle}>${calculateAmountToPay(loan.requestedAmount, loan.loantype?.rate) || 'N/A'}</td>
                            <td style={tableCellStyle}>${loan.comissionAmount || '0'}</td>
                            <td style={tableCellStyle}>{loan.collaterals?.[0]?.fullName || (loan as any).avalName || '-'}</td>
                            <td style={tableCellStyle}>{loan.collaterals?.[0]?.phones?.[0]?.number || (loan as any).avalPhone || '-'}</td>
                            <td style={{ ...tableCellStyle, width: '40px', position: 'relative' }}>
                                {isDeleting === loan.id ? <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '32px' }}><LoadingDots label="Eliminando" size="small" /></Box> : <Button ref={el => { buttonRefs.current[loan.id] = el; }} tone="passive" size="small" onClick={() => setActiveMenu(activeMenu === loan.id ? null : loan.id)} style={{ padding: '6px', minWidth: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaEllipsisV size={14} /></Button>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        </Box>
      </Box>

      {/* Tabla tipo Excel */}
      <Box style={{ backgroundColor: '#F0F9FF', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', marginTop: '16px', position: 'relative' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #E0F2FE' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0277BD', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>➕</span> {pendingLoans.length > 0 ? `Préstamos Pendientes (${pendingLoans.length})` : 'Agregar Nuevos Préstamos'}
            </h3>
        </div>
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
          ← Scroll →
        </div>
        <div ref={pendingLoansTableRef} style={{ 
          padding: '12px', 
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          scrollBehavior: 'smooth'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#E0F2FE', borderBottom: '1px solid #B3E5FC' }}>
                <th style={tableHeaderStyle}>Préstamo Previo</th>
                <th style={tableHeaderStyle}>Tipo</th>
                <th style={tableHeaderStyle}>M. Solicitado</th>
                <th style={tableHeaderStyle}>M. Entregado</th>
                <th style={tableHeaderStyle}>Comisión</th>
                <th style={{ ...tableHeaderStyle, minWidth: '200px', maxWidth: 'none', flex: '1' }}>Cliente</th>
                <th style={{ ...tableHeaderStyle, minWidth: '200px', maxWidth: 'none', flex: '1' }}>Aval</th>
                <th style={{ ...tableHeaderStyle, width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {[...pendingLoans, editableEmptyRow || emptyLoanRow].map((loan, index) => {
                const isNewRow = index === pendingLoans.length;
                const loanId = loan.id || `temp-${index}`;
                return (
                  <tr key={loanId} style={{ backgroundColor: isNewRow ? 'white' : '#ECFDF5', padding: '8px 0px' }}>
                    <td style={tableCellStyle}>
                        <div style={{ flexDirection: 'column', gap: '6px', height: '69px', justifyContent: 'flex-end' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6B7280', fontWeight: '500' }}>
                                <input
                                    type="checkbox"
                                    checked={searchAllLeadersByRow[loanId] || false}
                                    onChange={(e) => {
                                        const newValue = e.target.checked;
                                        setSearchAllLeadersByRow(prev => ({
                                            ...prev,
                                            [loanId]: newValue
                                        }));
                                        
                                        // Si se activa, hacer refetch de la query con el texto de búsqueda actual
                                        if (newValue) {
                                            const currentSearchText = dropdownSearchTextByRow[loanId] || '';
                                            refetchAllPreviousLoans({
                                                searchText: currentSearchText,
                                                take: 10
                                            });
                                        }
                                    }}
                                    disabled={allPreviousLoansLoading}
                                    style={{ margin: 0 }}
                                />
                                Buscar en todas las localidades
                                {allPreviousLoansLoading && <span style={{ fontSize: '10px', color: '#059669' }}>⏳ Cargando...</span>}
                            </label>
                            <div style={{
                                minWidth: isPreviousLoanFocused[loanId] ? '250px' : '150px',
                                maxWidth: isPreviousLoanFocused[loanId] ? '350px' : '250px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'flex-end',
                                transition: 'all 0.3s ease'
                            }}>
                        <Select
                                    placeholder={(searchAllLeadersByRow[loanId] || false) ? "Escribe para buscar en todas las localidades..." : "Renovación..."}
                                    options={getPreviousLoanOptions(loanId)}
                            onChange={(option) => handleRowChange(index, 'previousLoan', option, isNewRow)}
                                    value={loan.previousLoanOption}
                                    isClearable={true}
                                    onInputChange={(inputValue) => {
                                        if (searchAllLeadersByRow[loanId]) {
                                            setDropdownSearchTextByRow(prev => ({
                                                ...prev,
                                                [loanId]: inputValue
                                            }));
                                        }
                                    }}
                                    onFocus={() => {
                                        setIsPreviousLoanFocused(prev => ({
                                            ...prev,
                                            [loanId]: true
                                        }));
                                    }}
                                    onBlur={() => {
                                        setIsPreviousLoanFocused(prev => ({
                                            ...prev,
                                            [loanId]: false
                                        }));
                                    }}
                                    filterOption={(searchAllLeadersByRow[loanId] || false) ? null : undefined}
                                    menuPosition="fixed" 
                                    menuPortalTarget={document.body}
                                    components={{
                                        Option: ({ children, ...props }: any) => {
                                            const option = props.data;
                                            const hasDebt = option?.hasDebt;
                                            const statusColor = option?.statusColor || '#F3F4F6';
                                            const statusTextColor = option?.statusTextColor || '#374151';
                                            const debtColor = option?.debtColor || '#6B7280';
                                            const locationColor = option?.locationColor || '#3B82F6';
                                            const debtAmount = option?.debtAmount || '0';
                                            const location = option?.location || null;
                                            const leaderName = option?.leaderName || '';
                                            
                                            return (
                                                <div
                                                    {...props.innerProps}
                                                    style={{
                                                        ...props.innerProps.style,
                                                        backgroundColor: statusColor,
                                                        color: statusTextColor,
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
                                                                backgroundColor: debtColor,
                                                                color: 'white',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontSize: '10px',
                                                                fontWeight: '600'
                                                            }}
                                                        >
                                                            ${debtAmount}
                                                        </span>
                                                        {location && location !== 'Sin localidad' && (
                                                            <span
                                                                style={{
                                                                    backgroundColor: locationColor,
                                                                    color: 'white',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '10px',
                                                                    fontWeight: '600'
                                                                }}
                                                            >
                                                                {location}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    }}
                                    styles={{ 
                                        ...UNIFIED_SELECT_STYLES,
                                        menu: (base) => ({ ...base, minWidth: '400px', maxWidth: '500px' })
                                    }}
                                />
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style={{
                            minWidth: isLoanTypeFocused[loanId] ? '250px' : '150px',
                            maxWidth: isLoanTypeFocused[loanId] ? '350px' : '250px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'flex-end',
                            transition: 'all 0.3s ease'
                        }}>
                        <Select
                            placeholder="Tipo..."
                            options={loanTypeOptions}
                            onChange={(option) => handleRowChange(index, 'loantype', option, isNewRow)}
                            value={loanTypeOptions.find((opt: any) => opt.value === loan.loantype?.id) || null}
                                onFocus={() => {
                                    setIsLoanTypeFocused(prev => ({
                                        ...prev,
                                        [loanId]: true
                                    }));
                                }}
                                onBlur={() => {
                                    setIsLoanTypeFocused(prev => ({
                                        ...prev,
                                        [loanId]: false
                                    }));
                                }}
                            menuPosition="fixed" menuPortalTarget={document.body}
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
                                                    
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    minHeight: '40px'
                                                }}
                                            >
                                                <div style={{ flex: 1, alignItems: 'center', gap: '8px' }}>
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
                                    ...UNIFIED_SELECT_STYLES,
                                    menu: (base) => ({ ...base, minWidth: '300px', maxWidth: '400px' })
                                }}
                            />
                        </div>
                    </td>
                    <td>
                        <div style={{
                            minWidth: isRequestedAmountFocused[loanId] ? '120px' : '100px',
                            maxWidth: isRequestedAmountFocused[loanId] ? '180px' : '150px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'flex-end',
                            transition: 'all 0.3s ease'
                        }}>
                        <TextInput
                            placeholder="0.00" value={loan.requestedAmount || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                // Si el valor actual es "0" y el usuario empieza a escribir, eliminar el "0"
                                const newValue = (loan.requestedAmount === '0' && value.length > 1) ? value.substring(1) : value;
                                handleRowChange(index, 'requestedAmount', newValue, isNewRow);
                            }}
                                onFocus={() => {
                                    setIsRequestedAmountFocused(prev => ({
                                        ...prev,
                                        [loanId]: true
                                    }));
                                }}
                                onBlur={() => {
                                    setIsRequestedAmountFocused(prev => ({
                                        ...prev,
                                        [loanId]: false
                                    }));
                                }}
                                style={UNIFIED_INPUT_STYLES} 
                                type="text"
                            />
                        </div>
                    </td>
                     <td>
                        <div style={{
                            minWidth: '120px',
                            maxWidth: '180px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'flex-end',
                            transition: 'all 0.3s ease',
                            position: 'relative'
                        }}>
                        <TextInput
                            placeholder="0.00" value={loan.amountGived || ''} readOnly
                                style={{ 
                                    ...UNIFIED_INPUT_STYLES,
                                    padding: '6px 30px 6px 8px',
                                    backgroundColor: '#F3F4F6', 
                                    cursor: 'not-allowed',
                                    color: '#6B7280'
                                }} 
                                type="text"
                            />
                            <div 
                                style={{
                                    position: 'absolute',
                                    right: '6px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '18px',
                                    height: '18px',
                                    backgroundColor: '#3B82F6',
                                    color: 'white',
                                    borderRadius: '50%',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'default',
                                    zIndex: 10
                                }}
                                onMouseEnter={() => setShowTooltip(prev => ({ ...prev, [loanId]: true }))}
                                onMouseLeave={() => setShowTooltip(prev => ({ ...prev, [loanId]: false }))}
                            >
                                i
                                {showTooltip[loanId] && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        backgroundColor: '#1F2937',
                                        color: 'white',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        whiteSpace: 'nowrap',
                                        zIndex: 20,
                                        marginBottom: '4px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                    }}>
                                        Deuda Previa: ${loan.previousLoan?.pendingAmount || '0'}
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            width: 0,
                                            height: 0,
                                            borderLeft: '4px solid transparent',
                                            borderRight: '4px solid transparent',
                                            borderTop: '4px solid #1F2937'
                                        }}></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                     <td>
                        <div style={{
                            minWidth: isCommissionFocused[loanId] ? '120px' : '100px',
                            maxWidth: isCommissionFocused[loanId] ? '180px' : '150px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'flex-end',
                            transition: 'all 0.3s ease'
                        }}>
                        <TextInput
                            placeholder="0.00" value={loan.comissionAmount || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                // Si el valor actual es "0" y el usuario empieza a escribir, eliminar el "0"
                                const newValue = (loan.comissionAmount === '0' && value.length > 1) ? value.substring(1) : value;
                                handleRowChange(index, 'comissionAmount', newValue, isNewRow);
                            }}
                                onFocus={() => {
                                    setIsCommissionFocused(prev => ({
                                        ...prev,
                                        [loanId]: true
                                    }));
                                }}
                                onBlur={() => {
                                    setIsCommissionFocused(prev => ({
                                        ...prev,
                                        [loanId]: false
                                    }));
                                }}
                                style={UNIFIED_INPUT_STYLES} 
                                type="text"
                            />
                        </div>
                    </td>
                    {/* Celda Cliente */}
                    <td style={{...tableCellStyle, minWidth: '200px', maxWidth: 'none', height: '40px', padding: '0px 8px 0px 0px', flex: '1'}}>
                        <div style={{
                            minWidth: '200px',
                            maxWidth: 'none',
                            ...UNIFIED_CONTAINER_STYLES
                        }}>
                            {(() => {
                                console.log('CreditosTab - loan data:', {
                                    loanId,
                                    borrower: loan.borrower,
                                    personalData: loan.borrower?.personalData,
                                    personalDataId: loan.borrower?.personalData?.id,
                                    phoneId: loan.borrower?.personalData?.phones?.[0]?.id,
                                    isFromPrevious: !!loan.previousLoan
                                });
                                
                                // Verificar específicamente si es un préstamo previo
                                if (!!loan.previousLoan) {
                                    console.log('🔍 PREVIOUS LOAN DETECTED:', {
                                        hasBorrower: !!loan.borrower,
                                        hasPersonalData: !!loan.borrower?.personalData,
                                        personalDataId: loan.borrower?.personalData?.id,
                                        personalDataKeys: loan.borrower?.personalData ? Object.keys(loan.borrower.personalData) : 'NO PERSONAL DATA'
                                    });
                                }
                                
                                return null;
                            })()}
                            <PersonInputWithAutocomplete
                                key={`${loanId}-client-${loan.borrower?.personalData?.phones?.[0]?.id || 'no-phone'}`} 
                                loanId={loanId}
                                currentName={loan.borrower?.personalData?.fullName || ''}
                                currentPhone={loan.borrower?.personalData?.phones?.[0]?.number || ''}
                                onNameChange={(name) => {
                                    const currentPhone = loan.borrower?.personalData?.phones?.[0]?.number || '';
                                    handleRowChange(index, 'clientData', { clientName: name, clientPhone: currentPhone, action: 'create' }, isNewRow);
                                }}
                                onPhoneChange={(phone) => {
                                    const currentName = loan.borrower?.personalData?.fullName || '';
                                    handleRowChange(index, 'clientData', { clientName: currentName, clientPhone: phone, action: 'create' }, isNewRow);
                                }}
                                onClear={() => handleRowChange(index, 'clientData', { clientName: '', clientPhone: '', action: 'clear' }, isNewRow)}
                                onActionChange={(action) => {
                                    const currentName = loan.borrower?.personalData?.fullName || '';
                                    const currentPhone = loan.borrower?.personalData?.phones?.[0]?.number || '';
                                    handleRowChange(index, 'clientData', { clientName: currentName, clientPhone: currentPhone, action }, isNewRow);
                                }}
                                onPersonUpdated={async (updatedPerson) => {
                                    // ✅ SOLUCION: Actualizar el estado local con los datos reales de la base de datos
                                    const updatedBorrower = {
                                        ...loan.borrower,
                                        personalData: {
                                            ...loan.borrower?.personalData,
                                            id: updatedPerson.id,
                                            fullName: updatedPerson.fullName,
                                            phones: updatedPerson.phones
                                        }
                                    };
                                    
                                    handleRowChange(index, 'borrower', updatedBorrower, isNewRow);
                                    
                                    // También refrescar los datos del servidor
                                    try {
                                        await refetchLoans();
                                        console.log('✅ Datos del préstamo actualizados después de editar cliente');
                                    } catch (error) {
                                        console.error('❌ Error al refrescar datos del préstamo:', error);
                                    }
                                }}
                                enableAutocomplete={false}
                                isFromPrevious={!!loan.previousLoan}
                                originalData={{ name: loan.borrower?.personalData?.fullName || '', phone: loan.borrower?.personalData?.phones?.[0]?.number || '' }}
                                clientPersonalDataId={loan.borrower?.personalData?.id}
                                clientPhoneId={loan.borrower?.personalData?.phones?.[0]?.id}
                                leaderLocation={(loan as any).lead?.personalData?.addresses?.[0]?.location?.name || ''}
                                leaderName={(loan as any).lead?.personalData?.fullName || ''}
                                showLocationTag={searchAllLeadersByRow[loanId] || false}
                                namePlaceholder="Nombre del cliente..."
                                phonePlaceholder="Teléfono..."
                                actionType="client"
                                containerStyle={{ width: '100%' }}
                            />
                        </div>
                    </td>
                    {/* Celda Aval */}
                    <td style={{...tableCellStyle, minWidth: '200px', maxWidth: 'none', height: '40px', padding: '0px 0px 0px 8px', flex: '1'}}>
                        <div style={{
                            minWidth: '200px',
                            maxWidth: 'none',
                            ...UNIFIED_CONTAINER_STYLES
                        }}>
                            <PersonInputWithAutocomplete
                                key={`${loanId}-aval`} 
                                loanId={loanId}
                                selectedCollateralPhoneId={loan.selectedCollateralPhoneId}
                                currentName={loan.avalName || ''}
                                currentPhone={loan.avalPhone || ''}
                                onNameChange={(name) => {
                                    const currentPhone = loan.avalPhone || '';
                                    // ✅ CORREGIDO: Mantener selectedCollateralId y selectedCollateralPhoneId si existen
                                    const currentSelectedCollateralId = loan.selectedCollateralId;
                                    const currentSelectedCollateralPhoneId = loan.selectedCollateralPhoneId;
                                    const avalAction = currentSelectedCollateralId ? 'update' : 'create';
                                    handleRowChange(index, 'avalData', { avalName: name, avalPhone: currentPhone, selectedCollateralId: currentSelectedCollateralId, selectedCollateralPhoneId: currentSelectedCollateralPhoneId, avalAction }, isNewRow);
                                }}
                                onPhoneChange={(phone) => {
                                    const currentName = loan.avalName || '';
                                    // ✅ CORREGIDO: Mantener selectedCollateralId y selectedCollateralPhoneId si existen
                                    const currentSelectedCollateralId = loan.selectedCollateralId;
                                    const currentSelectedCollateralPhoneId = loan.selectedCollateralPhoneId;
                                    const avalAction = currentSelectedCollateralId ? 'update' : 'create';
                                    handleRowChange(index, 'avalData', { avalName: currentName, avalPhone: phone, selectedCollateralId: currentSelectedCollateralId, selectedCollateralPhoneId: currentSelectedCollateralPhoneId, avalAction }, isNewRow);
                                }}
                                onClear={() => handleRowChange(index, 'avalData', { avalName: '', avalPhone: '', selectedCollateralId: undefined, selectedCollateralPhoneId: undefined, avalAction: 'clear' }, isNewRow)}
                                onPersonUpdated={async (updatedPerson) => {
                                    // ✅ SOLUCION: Actualizar el estado local con los datos reales de la base de datos
                                    const updatedAvalData = {
                                        avalName: updatedPerson.fullName,
                                        avalPhone: updatedPerson.phones?.[0]?.number || '',
                                        selectedCollateralId: updatedPerson.id,
                                        selectedCollateralPhoneId: updatedPerson.phones?.[0]?.id,
                                        avalAction: 'update' as const
                                    };
                                    
                                    handleRowChange(index, 'avalData', updatedAvalData, isNewRow);
                                    
                                    // También refrescar los datos del servidor
                                    try {
                                        await refetchLoans();
                                        console.log('✅ Datos del préstamo actualizados después de editar aval');
                                    } catch (error) {
                                        console.error('❌ Error al refrescar datos del préstamo:', error);
                                    }
                                }}
                                onActionChange={(action) => {
                                    const currentName = loan.avalName || '';
                                    const currentPhone = loan.avalPhone || '';
                                    // Mantener el selectedCollateralId y selectedCollateralPhoneId si existen
                                    const currentSelectedCollateralId = loan.selectedCollateralId;
                                    const currentSelectedCollateralPhoneId = loan.selectedCollateralPhoneId;
                                    handleRowChange(index, 'avalData', { avalName: currentName, avalPhone: currentPhone, selectedCollateralId: currentSelectedCollateralId, selectedCollateralPhoneId: currentSelectedCollateralPhoneId, avalAction: action }, isNewRow);
                                }}
                                enableAutocomplete={true}
                                selectedPersonId={loan.selectedCollateralId}
                                onPersonSelect={(person) => handleRowChange(index, 'avalData', { avalName: person.fullName, avalPhone: person.phones?.[0]?.number || '', selectedCollateralId: person.id, selectedCollateralPhoneId: person.phones?.[0]?.id, avalAction: 'connect' }, isNewRow)}
                                usedPersonIds={usedAvalIds}
                                borrowerLocationId={undefined}
                                includeAllLocations={false}
                                namePlaceholder="Buscar o escribir nombre del aval..."
                                phonePlaceholder={loan.avalName ? `Tel. ${loan.avalName.split(' ')[0]}...` : "Teléfono"}
                                actionType="aval"
                                containerStyle={{ width: '100%' }}
                            />
                        </div>
                    </td>
                    <td>
                      {!isNewRow && (
                        <Button
                          tone="negative" size="small"
                          onClick={() => setPendingLoans(prev => prev.filter((_, i) => i !== index))}
                          style={{ padding: '4px 8px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Eliminar de la lista"
                        >
                          <FaTrash size={12} />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Box>
      
      {pendingLoans.length > 0 && (
        <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #e0f2fe', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#e0f2fe', borderRadius: '6px', color: '#0052CC', fontSize: '14px', fontWeight: '500' }}>
                <span>📋</span>
                <span>{pendingLoans.length} préstamo{pendingLoans.length !== 1 && 's'} listo{pendingLoans.length !== 1 && 's'} para guardar</span>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
                <Button tone="negative" weight="bold" onClick={() => setPendingLoans([])} style={{ padding: '4px 8px', height: '28px', fontSize: '11px' }}>
                    Cancelar Todo
                </Button>
                <Button tone="active" weight="bold" onClick={handleSaveAllNewLoans} disabled={isCreating} style={{ padding: '4px 8px', height: '28px', fontSize: '11px', backgroundColor: '#0052CC', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isCreating ? <><LoadingDots label="Guardando..." /><span>Guardando...</span></> : <><span role="img" aria-label="Save">💾</span><span>Crear {pendingLoans.length} Préstamo{pendingLoans.length !== 1 && 's'}</span></>}
                </Button>
            </div>
        </Box>
      )}

      {/* ... (DropdownPortal y Edit Modal se mantienen igual) ... */}
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
                          const { amountGived, amountToPay } = calculateLoanAmounts({
                            requestedAmount: editingLoan.requestedAmount,
                            pendingAmount: editingLoan.previousLoan?.pendingAmount || '0',
                            rate: selectedType.rate
                          });
                          const defaultCommission = selectedType.loanGrantedComission || 0;
                          const commissionAmount = defaultCommission && parseFloat(defaultCommission.toString()) > 0 ?
                            defaultCommission.toString() :
                            editingLoan.comissionAmount || '0';
                          setEditingLoan({ ...editingLoan, loantype: { id: value.value, name: value.label.split('(')[0].trim(), rate: selectedType.rate, weekDuration: selectedType.weekDuration }, amountGived, amountToPay, comissionAmount: commissionAmount });
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
                      const { amountGived, amountToPay } = calculateLoanAmounts({
                        requestedAmount,
                        pendingAmount: editingLoan.previousLoan?.pendingAmount || '0',
                        rate: editingLoan.loantype.rate
                      });
                      setEditingLoan({ ...editingLoan, requestedAmount, amountGived, amountToPay });
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
                  <PersonInputWithAutocomplete
                    loanId="editing-loan"
                    currentName={editingLoan.collaterals?.[0]?.fullName || (editingLoan as any).avalName || ''}
                    currentPhone={editingLoan.collaterals?.[0]?.phones?.[0]?.number || (editingLoan as any).avalPhone || ''}
                    onNameChange={(name) => {
                      const currentPhone = editingLoan.collaterals?.[0]?.phones?.[0]?.number || (editingLoan as any).avalPhone || '';
                      setEditingLoan(prev => ({ ...prev, avalName: name, avalPhone: currentPhone } as any));
                    }}
                    onPhoneChange={(phone) => {
                      const currentName = editingLoan.collaterals?.[0]?.fullName || (editingLoan as any).avalName || '';
                      setEditingLoan(prev => ({ ...prev, avalName: currentName, avalPhone: phone } as any));
                    }}
                    onClear={() => setEditingLoan(prev => ({ ...prev, avalName: '', avalPhone: '', selectedCollateralId: undefined } as any))}
                    onActionChange={(action) => {
                      const currentName = editingLoan.collaterals?.[0]?.fullName || (editingLoan as any).avalName || '';
                      const currentPhone = editingLoan.collaterals?.[0]?.phones?.[0]?.number || (editingLoan as any).avalPhone || '';
                      setEditingLoan(prev => ({ ...prev, avalName: currentName, avalPhone: currentPhone, avalAction: action } as any));
                    }}
                    enableAutocomplete={true}
                    selectedPersonId={(editingLoan as any).selectedCollateralId || editingLoan.collaterals?.[0]?.id}
                    onPersonSelect={(person) => {
                      setEditingLoan(prev => ({ 
                        ...prev, 
                        avalName: person.fullName, 
                        avalPhone: person.phones?.[0]?.number || '', 
                        selectedCollateralId: person.id, 
                        avalAction: 'connect' 
                      } as any));
                    }}
                    usedPersonIds={[]}
                    borrowerLocationId={editingLoan.borrower?.personalData?.addresses?.[0]?.location?.id}
                    includeAllLocations={false}
                    namePlaceholder="Buscar o escribir nombre del aval..."
                    phonePlaceholder="Teléfono..."
                    actionType="aval"
                    readonly={false}
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
    </>
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