/** @jsxRuntime automatic */

import React, { useState, useEffect, useMemo } from 'react';
import { gql, useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { AlertDialog } from '@keystone-ui/modals';
import { TrashIcon } from '@keystone-ui/icons';
import { useRouter } from 'next/router';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { DatePicker, Select, TextInput } from '@keystone-ui/fields';
import { FaPlus, FaTrash, FaEdit, FaEllipsisV, FaCheck, FaTimes } from 'react-icons/fa';
import { createPortal } from 'react-dom';

// Import components
import RouteLeadSelector from '../routes/RouteLeadSelector';
import DateMover from './utils/DateMover';
import KPIBar from './KPIBar';
import { useBalanceRefresh } from '../../contexts/BalanceRefreshContext';

// Import GraphQL queries and mutations
import { GET_ROUTES_SIMPLE } from '../../graphql/queries/routes-optimized';
import { GET_ROUTES } from '../../graphql/queries/routes';
import { CREATE_TRANSACTION, UPDATE_TRANSACTION, DELETE_TRANSACTION } from '../../graphql/mutations/transactions';
import type { Transaction, Account, Option, TransactionCreateInput, Route, Employee } from '../../types/transaction';

const GET_EXPENSES_BY_DATE_SIMPLE = gql`
  query GetExpensesByDateSimple($date: DateTime!, $nextDate: DateTime!, $routeId: ID!) {
    transactions(
      where: {
        AND: [
          { date: { gte: $date } }
          { date: { lt: $nextDate } }
          { type: { equals: "EXPENSE" } }
          {
            OR: [
              { route: { id: { equals: $routeId } } }
              {
                AND: [
                  { route: { id: { equals: $routeId } } }
                  { sourceAccount: { routes: { some: { id: { equals: $routeId } } } } }
                  {
                    OR: [
                      { sourceAccount: { type: { equals: "EMPLOYEE_CASH_FUND" } } }
                      { sourceAccount: { type: { equals: "PREPAID_GAS" } } }
                      { sourceAccount: { type: { equals: "TRAVEL_EXPENSES" } } }
                      { sourceAccount: { type: { equals: "BANK" } } }
                      { sourceAccount: { type: { equals: "OFFICE_CASH_FUND" } } }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
      orderBy: { date: desc }
    ) {
      id
      amount
      type
      expenseSource
      description
      date
      expenseGroupId
      route { 
        id 
        name
      }
      sourceAccount {
        id
        name
        type
        routes {
          id
          name
        }
      }
      lead {
        id
        personalData {
          fullName
        }
      }
    }
  }
`;

const GET_EXPENSES_BY_GROUP_ID = gql`
  query GetExpensesByGroupId($expenseGroupId: String!) {
    transactions(
      where: {
        AND: [
          { type: { equals: "EXPENSE" } }
          { expenseGroupId: { equals: $expenseGroupId } }
        ]
      }
      orderBy: { date: desc }
    ) {
      id
      amount
      type
      expenseSource
      description
      date
      expenseGroupId
      route { 
        id 
        name
      }
      sourceAccount {
        id
        name
        type
        routes {
          id
          name
        }
      }
      lead {
        id
        personalData {
          fullName
        }
      }
    }
  }
`;

const expenseTypes = [
  { label: 'Seleccionar tipo de gasto', value: '' },
  { label: 'Viáticos', value: 'VIATIC' },
  { label: 'Gasolina', value: 'GASOLINE' },
  { label: 'Hospedaje', value: 'ACCOMMODATION' },
  { label: 'Nómina', value: 'NOMINA_SALARY' },
  { label: 'Salario Externo', value: 'EXTERNAL_SALARY' },
  { label: 'Mantenimiento de Vehículo', value: 'VEHICULE_MAINTENANCE' },
  { label: 'Gasto de Líder', value: 'LEAD_EXPENSE' },
  { label: 'Lavado de Auto', value: 'LAVADO_DE_AUTO' },
  { label: 'Caseta', value: 'CASETA' },
  { label: 'Papelería', value: 'PAPELERIA' },
  { label: 'Renta', value: 'HOUSE_RENT' },
  { label: 'IMSS/INFONAVIT', value: 'IMSS_INFONAVIT' },
  { label: 'Pago de Mensualidad de Auto', value: 'CAR_PAYMENT' },
  { label: 'Posada', value: 'POSADA' },
  { label: 'Regalos Líderes', value: 'REGALOS_LIDERES' },
  { label: 'Aguinaldo', value: 'AGUINALDO' },
  { label: 'Otro', value: 'OTRO' }
];

interface DropdownPortalProps {
  children: React.ReactNode;
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

export interface GastosProps {
  selectedDate: Date;
  selectedRoute: Route | null;
  selectedLead: Employee | null;
  onSaveComplete?: () => void;
  onBalanceUpdate?: (balance: number) => void;
  refreshKey: number;
}

interface FormState {
  newTransactions: TransactionCreateInput[];
  transactions: Transaction[];
  editedTransactions: { [key: string]: Transaction };
  showSuccessMessage: boolean;
  editingTransaction: Transaction | null;
  editingDistributedGroup: null | {
    expenseGroupId: string;
    amount: string;
    expenseSource: string;
    description?: string;
    date: string;
    routeIds: string[];
    sourceAccountId?: string; // Cuenta seleccionada para el grupo distribuido
  };
  showDistributedEditConfirmation: null | {
    currentTransaction: Transaction;
    groupId: string;
    totalTransactions: number;
    totalAmount: number;
    affectedRoutes: Array<{
      routeName: string;
      amount: number;
    }>;
    distributedGroupData: {
      expenseGroupId: string;
      amount: string;
      expenseSource: string;
      description?: string;
      date: string;
      routeIds: string[];
    };
  };
  showDistributedDeleteConfirmation: null | {
    currentTransaction: Transaction;
    groupId: string;
    totalTransactions: number;
    totalAmount: number;
    affectedRoutes: Array<{
      routeName: string;
      amount: number;
      transactionId: string;
    }>;
    selectedTransactionIds: string[];
  };
}

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
    <Box css={{
      position: 'absolute',
      top: '-50%',
      left: '-50%',
      width: '200%',
      height: '200%',
      background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
      animation: 'pulse 2s ease-in-out infinite'
    }} />
    
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
    
    <style jsx>{`
      @keyframes pulse {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.05); }
      }
    `}</style>
  </Box>
);

export const CreateExpensesForm = ({ 
  selectedDate, 
  selectedRoute, 
  selectedLead,
  refreshKey,
  onSaveComplete,
  onBalanceUpdate
}: GastosProps) => {
  const { triggerBalanceRefresh } = useBalanceRefresh();
  
  // Ocultar spinners de inputs numéricos para prevenir cambios accidentales
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      input[type="number"]::-webkit-outer-spin-button,
      input[type="number"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type="number"] {
        -moz-appearance: textfield;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [state, setState] = useState<FormState>({
    newTransactions: [],
    transactions: [],
    editedTransactions: {},
    showSuccessMessage: false,
    editingTransaction: null,
    editingDistributedGroup: null,
    showDistributedEditConfirmation: null,
    showDistributedDeleteConfirmation: null
  });

  // Estados para los filtros de gastos
  const [includeBankOfficeExpenses, setIncludeBankOfficeExpenses] = useState(false);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = React.useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const { 
    newTransactions, transactions, editedTransactions, showSuccessMessage, editingTransaction, editingDistributedGroup, showDistributedEditConfirmation, showDistributedDeleteConfirmation
  } = state;

  const updateState = (updates: Partial<FormState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const { data: expensesData, loading: expensesLoading, refetch: refetchExpenses } = useQuery(GET_EXPENSES_BY_DATE_SIMPLE, {
    variables: { 
      date: selectedDate,
      nextDate: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000),
      routeId: selectedRoute?.id
    },
    skip: !selectedDate || !selectedRoute?.id,
    onCompleted: (data) => {
      if (data?.transactions) {
        // Filtrar transacciones basado en los checkboxes
        let filteredTransactions = data.transactions;
        
        // Si no se incluyen gastos de BANK y OFFICE_CASH_FUND, filtrarlos
        if (!includeBankOfficeExpenses) {
          filteredTransactions = filteredTransactions.filter((t: Transaction) => 
            !['BANK', 'OFFICE_CASH_FUND'].includes(t.sourceAccount?.type || '')
          );
        }
        
        // Aplicar filtro de líder si está seleccionado
        if (selectedLead) {
          filteredTransactions = filteredTransactions.filter((t: Transaction) => 
            t.lead?.id === selectedLead.id
          );
        }
        
        // Filtrar tipos de gasto específicos
        filteredTransactions = filteredTransactions.filter((t: Transaction) => 
          !['LOAN_PAYMENT_COMISSION', 'LOAN_GRANTED_COMISSION', 'LEAD_COMISSION', 'leadPaymentReceived', 'LOAN_GRANTED'].includes(t.expenseSource || '')
        );
        
        updateState({ transactions: filteredTransactions });
      }
    }
  });

  const [getGroupTransactions] = useLazyQuery(GET_EXPENSES_BY_GROUP_ID);


  const [createTransaction, { loading: createLoading }] = useMutation(CREATE_TRANSACTION);
  const [updateTransaction, { loading: updateLoading }] = useMutation(UPDATE_TRANSACTION);
  const [deleteTransaction] = useMutation(DELETE_TRANSACTION);

  const router = useRouter();
  const { data: allRoutesData } = useQuery(GET_ROUTES, { variables: { where: {} } });
  const allRoutes = (allRoutesData?.routes || []) as Route[];

  const [defaultDistributionMode, setDefaultDistributionMode] = useState<boolean>(false);
  const [defaultSelectedRoutes, setDefaultSelectedRoutes] = useState<string[]>([]);
  
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [balanceWarnings, setBalanceWarnings] = useState<Array<{ accountName: string, currentBalance: number, impact: number, finalBalance: number }>>([]);

  useEffect(() => {
    if (defaultDistributionMode) {
      setDefaultSelectedRoutes(allRoutes.map(r => r.id));
    }
  }, [defaultDistributionMode, allRoutes]);

  // Validar balances en tiempo real
  useEffect(() => {
    const checkBalances = async () => {
      const validTransactions = newTransactions.filter(isTransactionValid);
      if (validTransactions.length > 0) {
        const warnings = await validateBalances(validTransactions);
        setBalanceWarnings(warnings);
      } else {
        setBalanceWarnings([]);
      }
    };

    const debounceTimer = setTimeout(checkBalances, 500); // Debounce para evitar muchas validaciones
    return () => clearTimeout(debounceTimer);
  }, [newTransactions, allRoutes]);



  const handleAddTransaction = () => {
    if (!selectedRoute || !selectedDate) {
      alert('Por favor seleccione una ruta y una fecha');
      return;
    }

    const routeData = selectedRoute as unknown as Route;
    const routeAccount = routeData?.accounts?.find(account => account.type === 'EMPLOYEE_CASH_FUND');
    if (!routeAccount) {
      alert('La ruta seleccionada no tiene una cuenta de fondo asociada');
      return;
    }

    const newTransaction: TransactionCreateInput = {
      amount: '',
      type: 'EXPENSE',
      expenseSource: '',
      description: '',
      date: selectedDate.toISOString(),
      sourceAccount: { connect: { id: routeAccount.id } },
      route: { connect: { id: selectedRoute.id } },
      snapshotRouteId: selectedRoute.id,
      isDistributed: defaultDistributionMode,
      selectedRouteIds: defaultDistributionMode ? defaultSelectedRoutes : [selectedRoute.id],
      ...(selectedLead && { lead: { connect: { id: selectedLead.id } } })
    };
    updateState({ newTransactions: [...newTransactions, newTransaction] });
  };

  const isTransactionValid = (transaction: TransactionCreateInput) => {
    const hasAmount = transaction.amount && transaction.amount.trim() !== '' && parseFloat(transaction.amount) > 0;
    const hasExpenseSource = transaction.expenseSource && transaction.expenseSource.trim() !== '';
    return hasAmount && hasExpenseSource;
  };

  // Función para validar balances antes de guardar
  const validateBalances = async (validTransactions: TransactionCreateInput[]) => {
    const balanceImpacts: { [accountId: string]: number } = {};
    const problemAccounts: Array<{ accountName: string, currentBalance: number, impact: number, finalBalance: number }> = [];

    // Calcular el impacto en cada cuenta
    for (const transaction of validTransactions) {
      if (transaction.isDistributed && transaction.selectedRouteIds && transaction.selectedRouteIds.length > 1) {
        // Transacciones distribuidas
        const amountNum = parseFloat(transaction.amount || '0');
        const routes = transaction.selectedRouteIds;
        const perRoute = Math.floor((amountNum / routes.length) * 100) / 100;
        let remainder = parseFloat((amountNum - perRoute * routes.length).toFixed(2));

        // Obtener el tipo de cuenta de la cuenta seleccionada originalmente
        const selectedAccountId = transaction.sourceAccount?.connect?.id;
        const originalAccount = selectedRoute?.accounts?.find(a => a.id === selectedAccountId);
        const accountType = originalAccount?.type;
        
        if (!accountType) continue;

        for (let i = 0; i < routes.length; i++) {
          const routeId = routes[i];
          const routeObj = allRoutes.find(r => r.id === routeId) as Route | undefined;
          
          if (!routeObj) continue;
          
          // 🔧 CORRECCIÓN: Buscar cuenta por tipo en lugar de por ID
          // Cada ruta tiene sus propias cuentas con IDs únicos, pero del mismo tipo
          const account = routeObj.accounts?.find(a => a.type === accountType);
          
          if (!account?.id) continue;
          
          const thisAmount = i === routes.length - 1 ? parseFloat((perRoute + remainder).toFixed(2)) : perRoute;
          remainder = i === routes.length - 1 ? 0 : remainder;
          
          balanceImpacts[account.id] = (balanceImpacts[account.id] || 0) - thisAmount;
        }
      } else {
        // Transacciones individuales
        const accountId = transaction.sourceAccount?.connect?.id;
        if (accountId) {
          const amount = parseFloat(transaction.amount || '0');
          balanceImpacts[accountId] = (balanceImpacts[accountId] || 0) - amount;
        }
      }
    }

    // Verificar si alguna cuenta quedará con balance negativo
    for (const [accountId, impact] of Object.entries(balanceImpacts)) {
      // Buscar la cuenta en todas las rutas
      let account: any = null;
      let routeName = '';
      
      for (const route of allRoutes) {
        const foundAccount = route.accounts?.find(a => a.id === accountId);
        if (foundAccount) {
          account = foundAccount;
          routeName = route.name;
          break;
        }
      }

      if (account) {
        const currentBalance = parseFloat(account.amount || '0');
        const finalBalance = currentBalance + impact; // impact es negativo para gastos

        if (finalBalance < 0) {
          problemAccounts.push({
            accountName: `${account.name} (${routeName})`,
            currentBalance,
            impact: Math.abs(impact),
            finalBalance
          });
        }
      }
    }

    return problemAccounts;
  };


  const handleToggleDistribution = (index: number) => {
    const updatedTransactions = [...newTransactions];
    const transaction = updatedTransactions[index];
    const newIsDistributed = !transaction.isDistributed;
    
    const originalAccount = transaction.sourceAccount;
    
    updatedTransactions[index] = {
      ...transaction,
      isDistributed: newIsDistributed,
      selectedRouteIds: newIsDistributed 
        ? (defaultSelectedRoutes.length > 0 ? defaultSelectedRoutes : allRoutes.map(r => r.id))
        : [selectedRoute?.id || ''],
      sourceAccount: originalAccount
    };
    
    updateState({ newTransactions: updatedTransactions });
  };

  const handleUpdateTransactionRoutes = (index: number, routeIds: string[]) => {
    const updatedTransactions = [...newTransactions];
    updatedTransactions[index] = {
      ...updatedTransactions[index],
      selectedRouteIds: routeIds
    };
    updateState({ newTransactions: updatedTransactions });
  };

  const handleBulkToggleDistribution = (makeDistributed: boolean) => {
    const updatedTransactions = newTransactions.map(transaction => ({
      ...transaction,
      isDistributed: makeDistributed,
      selectedRouteIds: makeDistributed 
        ? (defaultSelectedRoutes.length > 0 ? defaultSelectedRoutes : allRoutes.map(r => r.id))
        : [selectedRoute?.id || '']
    }));
    updateState({ newTransactions: updatedTransactions });
  };

  const handleToggleRowExpansion = (index: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(index)) {
      newExpandedRows.delete(index);
    } else {
      newExpandedRows.add(index);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleEditTransaction = (index: number, field: string, value: string) => {
    const updatedTransactions = [...newTransactions];
    const transaction = { ...updatedTransactions[index] };

    switch (field) {
      case 'expenseType': {
        transaction.expenseSource = value;
        
        if (value === 'GASOLINE' && selectedRoute?.accounts) {
          const tokaAccount = selectedRoute.accounts.find(acc => 
            acc.type === 'PREPAID_GAS' && acc.name?.toLowerCase().includes('toka')
          );
          if (tokaAccount) {
            transaction.sourceAccount = { connect: { id: tokaAccount.id } };
          }
        }
        break;
      }
      case 'amount': {
        transaction.amount = value;
        break;
      }
      case 'description': {
        transaction.description = value;
        break;
      }
      case 'sourceAccount': {
        transaction.sourceAccount = { connect: { id: value } };
        break;
      }
      default: {
        if (field in transaction) {
          (transaction as any)[field] = value;
        }
      }
    }

    updatedTransactions[index] = transaction;
    updateState({ newTransactions: updatedTransactions });
  };

  const handleCancelNew = (index: number) => {
    const updatedTransactions = [...newTransactions];
    updatedTransactions.splice(index, 1);
    updateState({ newTransactions: updatedTransactions });
  };

  const handleSaveAllChanges = async () => {
    try {
      console.log('🎯 FUNCIÓN handleSaveAllChanges EJECUTADA');
      setIsCreating(true);
      
      // Filtrar transacciones vacías antes de crear
      const validTransactions = newTransactions.filter(transaction => {
        const isValid = isTransactionValid(transaction);
        if (!isValid) {
          console.log('🚫 Filtrando transacción vacía:', {
            amount: transaction.amount,
            expenseSource: transaction.expenseSource,
          });
        }
        return isValid;
      });
      
      console.log(`📊 Transacciones válidas: ${validTransactions.length} de ${newTransactions.length}`);
      
      // ✅ CORRECCIÓN: Solo salir si no hay NADA que guardar
      if (validTransactions.length === 0 && Object.keys(editedTransactions).length === 0) {
        console.log('⚠️ No hay transacciones nuevas válidas ni editadas para procesar');
        setIsCreating(false);
        return;
      }

      // 🔍 Validar balances antes de proceder
      if (validTransactions.length > 0) {
        console.log('🔍 Validando balances antes de guardar...');
        const problemAccounts = await validateBalances(validTransactions);
        
        if (problemAccounts.length > 0) {
          setIsCreating(false);
          
          // Crear mensaje detallado de error
          let errorMessage = '❌ ERROR: Las siguientes cuentas quedarían con balance negativo:\n\n';
          
          problemAccounts.forEach(problem => {
            errorMessage += `• ${problem.accountName}\n`;
            errorMessage += `  Balance actual: $${problem.currentBalance.toLocaleString()}\n`;
            errorMessage += `  Gasto: $${problem.impact.toLocaleString()}\n`;
            errorMessage += `  Balance final: $${problem.finalBalance.toLocaleString()}\n\n`;
          });
          
          errorMessage += 'Por favor:\n';
          errorMessage += '• Reduce el monto de los gastos\n';
          errorMessage += '• Transfiere fondos a las cuentas\n';
          errorMessage += '• Selecciona otras rutas con más fondos';
          
          alert(errorMessage);
          return;
        }
        
        console.log('✅ Validación de balances exitosa, procediendo con el guardado...');
      }
  
      // Procesar cada transacción válida
      for (const transaction of validTransactions) {
        console.log('🔄 Procesando transacción:', {
          isDistributed: transaction.isDistributed,
          selectedRouteIds: transaction.selectedRouteIds,
          amount: transaction.amount,
          expenseSource: transaction.expenseSource
        });
        
        if (transaction.isDistributed && transaction.selectedRouteIds && transaction.selectedRouteIds.length > 1) {
          console.log('🔀 Procesando transacción DISTRIBUIDA');
          // Crear transacciones distribuidas
          const amountNum = parseFloat(transaction.amount || '0');
          const routes = transaction.selectedRouteIds;
          if (!amountNum || !transaction.expenseSource || routes.length === 0) {
            console.log('❌ Saltando transacción distribuida: datos insuficientes', { amountNum, expenseSource: transaction.expenseSource, routesLength: routes.length });
            continue;
          }
          
          const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const perRoute = Math.floor((amountNum / routes.length) * 100) / 100;
          let remainder = parseFloat((amountNum - perRoute * routes.length).toFixed(2));
          
          // Obtener el tipo de cuenta de la cuenta seleccionada originalmente
          const selectedAccountId = transaction.sourceAccount?.connect?.id;
          const originalAccount = selectedRoute?.accounts?.find(a => a.id === selectedAccountId);
          const accountType = originalAccount?.type;
          
          if (!accountType) {
            console.error(`❌ No se pudo determinar el tipo de cuenta para la transacción distribuida`);
            console.log(`🔍 Cuenta seleccionada ID: ${selectedAccountId}`);
            console.log(`🔍 Cuentas disponibles en ruta original:`, selectedRoute?.accounts?.map(a => ({ id: a.id, type: a.type, name: a.name })));
            continue;
          }
          
          for (let i = 0; i < routes.length; i++) {
            const routeId = routes[i];
            const routeObj = allRoutes.find(r => r.id === routeId) as Route | undefined;
            
            if (!routeObj) {
              console.error(`❌ No se encontró la ruta ${routeId}`);
              continue;
            }
            
            console.log(`🔍 Ruta ${routeObj.name} tiene ${routeObj.accounts?.length || 0} cuentas:`, routeObj.accounts?.map(a => ({ id: a.id, type: a.type, name: a.name })));
            
            // 🔧 CORRECCIÓN: Buscar cuenta por tipo en lugar de por ID
            // Cada ruta tiene sus propias cuentas con IDs únicos, pero del mismo tipo
            const account = routeObj.accounts?.find(a => a.type === accountType);
            
            if (!account?.id) {
              console.error(`❌ No se encontró cuenta de tipo ${accountType} para la ruta ${routeId} (${routeObj.name}) en transacción distribuida`);
              console.log(`🔍 Buscando cuenta con tipo: ${accountType}`);
              console.log(`🔍 Cuentas disponibles:`, routeObj.accounts?.map(a => ({ id: a.id, type: a.type, name: a.name })));
              continue;
            }
            
            const thisAmount = i === routes.length - 1 ? parseFloat((perRoute + remainder).toFixed(2)) : perRoute;
            remainder = i === routes.length - 1 ? 0 : remainder;
            
        await createTransaction({
              variables: {
                data: {
                  amount: String(thisAmount),
                  type: 'EXPENSE',
                  expenseSource: transaction.expenseSource,
                  description: transaction.description || '',
                  date: transaction.date,
                  expenseGroupId: groupId,
                  sourceAccount: { connect: { id: account.id } },
                  route: { connect: { id: routeId } },
                  snapshotRouteId: routeId,
                  ...(transaction.lead ? { lead: { connect: { id: transaction.lead.connect.id } } } : {})
                }
              }
            });
          }
        } else {
          console.log('📝 Procesando transacción INDIVIDUAL');
          // Crear transacción individual normal
          const { isDistributed, selectedRouteIds, ...transactionData } = transaction;
          
          if (!transactionData.sourceAccount?.connect?.id) {
            console.error(`❌ No se encontró cuenta para transacción individual:`, transactionData);
            continue;
          }
          
          await createTransaction({
            variables: { data: transactionData }
          });
        }
      }

      // Actualizar las transacciones existentes
      for (const [id, transaction] of Object.entries(editedTransactions)) {
        await updateTransaction({
          variables: { 
            id,
            data: {
              amount: transaction.amount,
              expenseSource: transaction.expenseSource,
              description: transaction.description
            }
          }
        });
      }

      // Refrescar todos los datos necesarios
      await Promise.all([
        refetchExpenses()
      ]);

      // Asegurarnos de que los datos se actualicen en el componente padre
      if (onSaveComplete) {
        await onSaveComplete();
      }

      // Actualizar balance en la UI
      if (onBalanceUpdate) {
        const totalExpenseAmount = validTransactions.reduce((sum, transaction) => {
          return sum + parseFloat(transaction.amount || '0');
        }, 0);
        onBalanceUpdate(-totalExpenseAmount); // Negativo porque son gastos
      }

      // Triggear refresh de balances
      triggerBalanceRefresh();

      // Mostrar mensaje de éxito y limpiar el estado
      updateState({ 
        showSuccessMessage: true,
        newTransactions: [],
        editedTransactions: {}
      });
      
      // Ocultar el mensaje después de 2 segundos
      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 2000);

    } catch (error) {
      console.error('Error saving changes:', error);
      
      // Extraer mensaje de error más específico
      let errorMessage = 'Error al guardar los cambios';
      
      if (error instanceof Error) {
        // Buscar errores de balance negativo
        if (error.message.includes('balance negativo')) {
          const balanceMatch = error.message.match(/balance negativo: ([-\d.,]+)/);
          const amount = balanceMatch ? balanceMatch[1] : 'desconocido';
          errorMessage = `❌ Error de Balance: La transacción resultaría en un balance negativo de $${amount}. Verifique que la cuenta tenga fondos suficientes.`;
        } 
        // Buscar otros errores de negocio
        else if (error.message.includes('afterOperation')) {
          const businessErrorMatch = error.message.match(/afterOperation[^:]*: (.+)/);
          if (businessErrorMatch) {
            errorMessage = `❌ Error de Validación: ${businessErrorMatch[1]}`;
          }
        }
        // Error genérico
        else {
          errorMessage = `❌ Error: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditExistingTransaction = (transactionId: string, field: string, value: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    const updatedTransaction = { ...transaction, [field]: value };

    updateState({
      editedTransactions: { ...editedTransactions, [transactionId]: updatedTransaction }
    });
  };

  const handleOpenEditModal = async (transaction: Transaction) => {
    if ((transaction as any).expenseGroupId) {
      const groupId = (transaction as any).expenseGroupId as string;
      
      console.log('✏️ Abriendo modal de edición para gasto distribuido:', groupId);
      
      try {
        // Obtener TODAS las transacciones del grupo distribuido
        const { data: groupData } = await getGroupTransactions({
          variables: { expenseGroupId: groupId }
        });
        
        const groupTx = groupData?.transactions || [];
        const total = groupTx.reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
        const routeIds = groupTx.map((t: any) => t.route?.id).filter(Boolean) as string[];
        
        console.log('📊 Datos del grupo para edición:', {
          totalTransacciones: groupTx.length,
          montoTotal: total,
          rutasAfectadas: groupTx.map((t: any) => ({ ruta: t.route?.name, monto: t.amount })),
          routeIds
        });
        
        updateState({ editingDistributedGroup: {
          expenseGroupId: groupId,
          amount: String(total),
          expenseSource: transaction.expenseSource,
          description: transaction.description || '',
          date: transaction.date,
          routeIds, // ✅ Ahora incluye TODAS las rutas del grupo
          sourceAccountId: transaction.sourceAccount?.id // ✅ Incluir la cuenta seleccionada
        }});
        
      } catch (error) {
        console.error('Error obteniendo transacciones del grupo para editar:', error);
        // Fallback a la lógica anterior
        const groupTx = transactions.filter(t => (t as any).expenseGroupId === groupId);
        const total = groupTx.reduce((s, t) => s + parseFloat(t.amount), 0);
        const routeIds = groupTx.map(t => t.route?.id).filter(Boolean) as string[];
        
        updateState({ editingDistributedGroup: {
          expenseGroupId: groupId,
          amount: String(total),
          expenseSource: transaction.expenseSource,
          description: transaction.description || '',
          date: transaction.date,
          routeIds,
          sourceAccountId: transaction.sourceAccount?.id // ✅ Incluir la cuenta seleccionada
        }});
      }
    } else {
      updateState({ editingTransaction: transaction });
    }
  };

  const handleCloseEditModal = () => {
    updateState({ editingTransaction: null });
  };

  const handleSaveEdit = async () => {
    if (state.editingDistributedGroup) {
      const g = state.editingDistributedGroup;
      const amountNum = parseFloat(g.amount || '0');
      if (!amountNum || !g.expenseSource || (g.routeIds?.length || 0) === 0) return;
      
      // 🔍 Validar balances antes de proceder con la edición
      console.log('🔍 Validando balances para edición de gasto distribuido...');
      
      // Obtener el tipo de cuenta de la cuenta seleccionada originalmente
      const originalAccount = g.sourceAccountId 
        ? (selectedRoute?.accounts?.find(a => a.id === g.sourceAccountId) ||
           allRoutes.flatMap(r => r.accounts || []).find(a => a.id === g.sourceAccountId))
        : null;
      const accountType = originalAccount?.type;
      
      if (!accountType) {
        alert('❌ No se pudo determinar el tipo de cuenta para la edición');
        setIsUpdating(null);
        return;
      }
      
      // Crear transacciones temporales para validación
      const tempTransactions = g.routeIds.map(routeId => {
        const routeObj = allRoutes.find(r => r.id === routeId);
        
        // 🔧 CORRECCIÓN: Buscar cuenta por tipo en lugar de por ID
        // Cada ruta tiene sus propias cuentas con IDs únicos, pero del mismo tipo
        const account = routeObj?.accounts?.find(a => a.type === accountType);
        
        const perRoute = Math.floor((amountNum / g.routeIds.length) * 100) / 100;
        
        return {
          amount: String(perRoute),
          expenseSource: g.expenseSource,
          sourceAccount: { connect: { id: account?.id || '' } },
          isDistributed: true,
          selectedRouteIds: [routeId]
        };
      });
      
      const problemAccounts = await validateBalances(tempTransactions);
      
      if (problemAccounts.length > 0) {
        setIsUpdating(null);
        
        let errorMessage = '❌ ERROR: Las siguientes cuentas quedarían con balance negativo:\n\n';
        
        problemAccounts.forEach(problem => {
          errorMessage += `• ${problem.accountName}\n`;
          errorMessage += `  Balance actual: $${problem.currentBalance.toLocaleString()}\n`;
          errorMessage += `  Gasto: $${problem.impact.toLocaleString()}\n`;
          errorMessage += `  Balance final: $${problem.finalBalance.toLocaleString()}\n\n`;
        });
        
        errorMessage += 'Por favor:\n';
        errorMessage += '• Reduce el monto del gasto\n';
        errorMessage += '• Transfiere fondos a las cuentas\n';
        errorMessage += '• Selecciona otras rutas con más fondos';
        
        alert(errorMessage);
        return;
      }
      
      console.log('✅ Validación de balances exitosa para edición, procediendo...');
      
      try {
        setIsUpdating(g.expenseGroupId);
        
        console.log('🔄 Iniciando edición inteligente del grupo distribuido:', g.expenseGroupId);
        
        // Obtener todas las transacciones del grupo actual
        const { data: currentGroupData } = await getGroupTransactions({
          variables: { expenseGroupId: g.expenseGroupId }
        });
        const currentGroupTx = currentGroupData?.transactions || [];
        
        console.log('📊 Transacciones actuales del grupo:', currentGroupTx.length);
        console.log('🎯 Rutas seleccionadas para edición:', g.routeIds.length);
        
        // Calcular nueva distribución
        const perRoute = Math.floor((amountNum / g.routeIds.length) * 100) / 100;
        let remainder = parseFloat((amountNum - perRoute * g.routeIds.length).toFixed(2));
        
        // Separar transacciones que mantener vs eliminar vs crear
        const toKeep: any[] = [];
        const toDelete: any[] = [];
        const toCreate: string[] = [];
        
        // Analizar transacciones existentes
        currentGroupTx.forEach(tx => {
          if (g.routeIds.includes(tx.route?.id)) {
            // Esta ruta sigue en el grupo, mantener la transacción pero actualizarla
            toKeep.push(tx);
          } else {
            // Esta ruta ya no está en el grupo, eliminar la transacción
            toDelete.push(tx);
          }
        });
        
        // Identificar rutas nuevas que necesitan transacciones
        g.routeIds.forEach(routeId => {
          if (!currentGroupTx.some(tx => tx.route?.id === routeId)) {
            toCreate.push(routeId);
          }
        });
        
        console.log('🔍 Plan de edición:');
        console.log(`  - Mantener y actualizar: ${toKeep.length} transacciones`);
        console.log(`  - Eliminar: ${toDelete.length} transacciones`);
        console.log(`  - Crear nuevas: ${toCreate.length} transacciones`);
        
        // 1. Eliminar transacciones de rutas que ya no están en el grupo
        for (const tx of toDelete) {
          console.log(`❌ Eliminando transacción de ruta ${tx.route?.name}`);
          await deleteTransaction({ variables: { id: tx.id } });
        }
        
        // 2. Actualizar transacciones existentes
        for (let i = 0; i < toKeep.length; i++) {
          const tx = toKeep[i];
          const thisAmount = i === toKeep.length + toCreate.length - 1 
            ? parseFloat((perRoute + remainder).toFixed(2)) 
            : perRoute;
          
          if (i === toKeep.length + toCreate.length - 1) {
            remainder = 0;
          }
          
          console.log(`✏️ Actualizando transacción de ruta ${tx.route?.name}: $${thisAmount}`);
          
          await updateTransaction({
            variables: {
              id: tx.id,
              data: {
                amount: String(thisAmount),
                expenseSource: g.expenseSource,
                description: g.description || '',
                date: g.date
              }
            }
          });
        }
        
        // Obtener el tipo de cuenta de la cuenta seleccionada originalmente
        const originalAccount = g.sourceAccountId 
          ? (selectedRoute?.accounts?.find(a => a.id === g.sourceAccountId) ||
             allRoutes.flatMap(r => r.accounts || []).find(a => a.id === g.sourceAccountId))
          : null;
        const accountType = originalAccount?.type;
        
        if (!accountType) {
          console.error('❌ No se pudo determinar el tipo de cuenta para crear nuevas transacciones');
          setIsUpdating(null);
          return;
        }
        
        // 3. Crear transacciones para rutas nuevas
        for (let i = 0; i < toCreate.length; i++) {
          const routeId = toCreate[i];
          const routeObj = allRoutes.find(r => r.id === routeId);
          // 🔧 CORRECCIÓN: Buscar cuenta por tipo en lugar de por ID
          // Cada ruta tiene sus propias cuentas con IDs únicos, pero del mismo tipo
          const account = routeObj?.accounts?.find(a => a.type === accountType);
          
          const thisAmount = i === toCreate.length - 1 
            ? parseFloat((perRoute + remainder).toFixed(2)) 
            : perRoute;
          
          console.log(`✨ Creando nueva transacción para ruta ${routeObj?.name}: $${thisAmount}`);
          
          await createTransaction({
            variables: {
              data: {
                amount: String(thisAmount),
                type: 'EXPENSE',
                expenseSource: g.expenseSource,
                description: g.description || '',
                date: g.date,
                expenseGroupId: g.expenseGroupId,
                sourceAccount: { connect: { id: account?.id || '' } },
                route: { connect: { id: routeId } },
                snapshotRouteId: routeId,
                ...(selectedLead?.id ? { lead: { connect: { id: selectedLead.id } } } : {})
              }
            }
          });
        }
        
        console.log('✅ Edición del grupo distribuido completada exitosamente');
        await refetchExpenses();
        if (onSaveComplete) await onSaveComplete();
        triggerBalanceRefresh();
        updateState({ showSuccessMessage: true, editingDistributedGroup: null });
        setTimeout(() => updateState({ showSuccessMessage: false }), 2000);
      } catch (e) {
        console.error('Error updating distributed expense:', e);
      } finally {
        setIsUpdating(null);
      }
      return;
    }
    if (!state.editingTransaction) return;

    try {
      setIsUpdating(state.editingTransaction.id);
      
      // Verificar si la transacción original tenía expenseGroupId pero la editada no
      const original = transactions.find(t => t.id === state.editingTransaction.id);
      const wasPartOfGroup = (original as any)?.expenseGroupId && !(state.editingTransaction as any).expenseGroupId;
      
      if (wasPartOfGroup) {
        console.log('🔄 Separando transacción del grupo distribuido');
        
        // Eliminar la transacción original del grupo
        await deleteTransaction({ variables: { id: state.editingTransaction.id } });
        
        // Crear nueva transacción individual
        await createTransaction({
          variables: {
            data: {
              amount: state.editingTransaction.amount,
              type: 'EXPENSE',
              expenseSource: state.editingTransaction.expenseSource,
              description: state.editingTransaction.description || '',
              date: state.editingTransaction.date,
              sourceAccount: { connect: { id: state.editingTransaction.sourceAccount?.id || '' } },
              route: { connect: { id: selectedRoute?.id || '' } },
              snapshotRouteId: selectedRoute?.id || '',
              ...(selectedLead?.id ? { lead: { connect: { id: selectedLead.id } } } : {})
            }
          }
        });
      } else {
        // Edición normal de transacción individual
      await updateTransaction({
        variables: { 
          id: state.editingTransaction.id,
          data: {
            amount: state.editingTransaction.amount,
            expenseSource: state.editingTransaction.expenseSource,
            description: state.editingTransaction.description
          }
        }
      });
      }

      await refetchExpenses();
      if (onSaveComplete) await onSaveComplete();
      triggerBalanceRefresh();

      updateState({ 
        showSuccessMessage: true,
        editingTransaction: null
      });

      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 2000);

    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteExistingTransaction = async (transactionId: string) => {
    const tx = transactions.find(t => t.id === transactionId);
    const isGroup = (tx as any)?.expenseGroupId;
    
    if (isGroup) {
      // Para gastos distribuidos, mostrar modal de selección
      console.log('🗑️ Gasto distribuido detectado, mostrando modal de selección de rutas a eliminar');
      
      const groupId = (tx as any).expenseGroupId as string;
      
      try {
        // Obtener todas las transacciones del grupo
        const { data: groupData } = await getGroupTransactions({
          variables: { expenseGroupId: groupId }
        });
        
        const groupTx = groupData?.transactions || [];
        const total = groupTx.reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
        
        console.log('📊 Transacciones del grupo a eliminar:', {
          total: groupTx.length,
          montoTotal: total,
          rutas: groupTx.map((t: any) => ({ ruta: t.route?.name, monto: t.amount, id: t.id }))
        });
        
        updateState({
          showDistributedDeleteConfirmation: {
            currentTransaction: tx,
            groupId: groupId,
            totalTransactions: groupTx.length,
            totalAmount: total,
            affectedRoutes: groupTx.map((t: any) => {
              const route = allRoutes.find(r => r.id === t.route?.id);
              return {
                routeName: route?.name || 'Ruta desconocida',
                amount: parseFloat(t.amount),
                transactionId: t.id
              };
            }),
            selectedTransactionIds: groupTx.map((t: any) => t.id) // Por defecto todas seleccionadas
          }
        });
        
      } catch (error) {
        console.error('Error obteniendo transacciones del grupo para eliminar:', error);
        // Fallback al confirm simple
        const message = 'Este gasto está distribuido. Se eliminarán todas las transacciones del grupo. ¿Continuar?';
        if (!window.confirm(message)) return;
        
        await performDelete(transactionId, true);
      }
    } else {
      // Para gastos individuales, confirm simple
      if (!window.confirm('¿Eliminar este gasto?')) return;
      await performDelete(transactionId, false);
    }
  };
  
  const performDelete = async (transactionId: string, isGroup: boolean) => {
    try {
      setIsDeleting(transactionId);
      
      if (isGroup) {
        const tx = transactions.find(t => t.id === transactionId);
        const groupId = (tx as any).expenseGroupId as string;
        const groupTx = transactions.filter(t => (t as any).expenseGroupId === groupId);
        
        console.log(`🗑️ Eliminando grupo completo: ${groupTx.length} transacciones`);
        
        for (const t of groupTx) {
          console.log(`❌ Eliminando transacción de ruta ${t.route?.name}: $${t.amount}`);
          await deleteTransaction({ variables: { id: t.id } });
        }
      } else {
        console.log(`🗑️ Eliminando transacción individual: $${transactions.find(t => t.id === transactionId)?.amount}`);
        await deleteTransaction({ variables: { id: transactionId } });
      }

      await refetchExpenses();
      if (onSaveComplete) await onSaveComplete();
      triggerBalanceRefresh();

      updateState({ showSuccessMessage: true });
      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 2000);

    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Error al eliminar el gasto. Por favor intenta de nuevo.');
    } finally {
      setIsDeleting(null);
    }
  };
  
  const handleConfirmSelectedDelete = async () => {
    if (!showDistributedDeleteConfirmation) return;
    
    const selectedIds = showDistributedDeleteConfirmation.selectedTransactionIds;
    
    if (selectedIds.length === 0) {
      alert('❗ Selecciona al menos una transacción para eliminar');
      return;
    }
    
    console.log(`🗑️ Eliminando ${selectedIds.length} transacciones seleccionadas del grupo`);
    
    try {
      setIsDeleting(showDistributedDeleteConfirmation.groupId);
      
      for (const txId of selectedIds) {
        const tx = showDistributedDeleteConfirmation.affectedRoutes.find(r => r.transactionId === txId);
        console.log(`❌ Eliminando transacción de ruta ${tx?.routeName}: $${tx?.amount}`);
        await deleteTransaction({ variables: { id: txId } });
      }
      
      await refetchExpenses();
      if (onSaveComplete) await onSaveComplete();
      triggerBalanceRefresh();
      
      updateState({ 
        showSuccessMessage: true,
        showDistributedDeleteConfirmation: null
      });
      
      setTimeout(() => {
        updateState({ showSuccessMessage: false });
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting selected transactions:', error);
      alert('Error al eliminar las transacciones seleccionadas. Por favor intenta de nuevo.');
    } finally {
      setIsDeleting(null);
    }
  };

  useEffect(() => {
    if (expensesData?.transactions) {
      // Filtrar transacciones basado en los checkboxes
      let filteredTransactions = expensesData.transactions;
      
      // Si no se incluyen gastos de BANK y OFFICE_CASH_FUND, filtrarlos
      if (!includeBankOfficeExpenses) {
        filteredTransactions = filteredTransactions.filter((t: Transaction) => 
          !['BANK', 'OFFICE_CASH_FUND'].includes(t.sourceAccount?.type || '')
        );
      }
      
      // Aplicar filtro de líder si está seleccionado
      if (selectedLead) {
        filteredTransactions = filteredTransactions.filter((t: Transaction) => 
          t.lead?.id === selectedLead.id
        );
      }
      
      // Filtrar tipos de gasto específicos
      filteredTransactions = filteredTransactions.filter((t: Transaction) => 
        !['LOAN_PAYMENT_COMISSION', 'LOAN_GRANTED_COMISSION', 'LEAD_COMISSION', 'leadPaymentReceived', 'LOAN_GRANTED'].includes(t.expenseSource || '')
      );
      
      updateState({ transactions: filteredTransactions });
    }
  }, [selectedDate, selectedLead, expensesData, includeBankOfficeExpenses, selectedRoute?.id]);

  useEffect(() => {
    refetchExpenses();
  }, [refreshKey, refetchExpenses]);

  const getDropdownPosition = (buttonId: string) => {
    const button = buttonRefs.current[buttonId];
    if (!button) return { top: 0, left: 0 };
    const rect = button.getBoundingClientRect();
    return {
      top: rect.top - 4,
      left: rect.right - 160,
    };
  };

  if (!selectedRoute) {
    return (
      <SelectionMessage
        icon="💸"
        title="Selecciona una Ruta"
        description="Para gestionar los gastos, necesitas seleccionar una ruta específica."
        requirements={[
          "Selecciona una ruta desde el selector superior",
          "Los gastos se cargarán automáticamente",
          "Podrás registrar nuevos gastos para la ruta seleccionada"
        ]}
      />
    );
  }

  if (expensesLoading) {
    return (
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
      <Box css={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
        animation: 'pulse 2s ease-in-out infinite'
      }} />
      
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
      
      <Box css={{
        fontSize: '18px',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '8px',
        position: 'relative',
        zIndex: 1
      }}>
        Cargando gastos...
      </Box>
      
      <Box css={{
        fontSize: '14px',
        color: '#6b7280',
        position: 'relative',
        zIndex: 1
      }}>
        Preparando datos de gastos
      </Box>
      
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
  } // ✅ Brace de cierre agregado aquí

  const totalAmount = transactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0) +
    newTransactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount || '0'), 0);

  return (
    <Box paddingTop="medium">
      <KPIBar
        chips={[
          { label: 'Gastos', value: transactions.length + newTransactions.length, color: '#374151', backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
          { label: 'Nuevos', value: newTransactions.length, color: '#92400E', backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
          { label: 'Distribuidos', value: newTransactions.filter(t => t.isDistributed).length, color: '#059669', backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' },
          { label: 'Modificados', value: Object.keys(editedTransactions).length, color: '#BE185D', backgroundColor: '#FDF2F8', borderColor: '#FBCFE8' },
          { label: 'Total', value: `$${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: '#DC2626', backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
          { label: 'Créditos a Otorgar', value: '$0', color: '#059669', backgroundColor: '#ECFDF5', borderColor: '#D1FAE5', tooltipContent: 'Preview de créditos que se van a otorgar hoy' }
        ]}
        buttons={[]}
        primaryMenu={{
          onSave: handleSaveAllChanges,
          onReportFalco: () => {
            // Funcionalidad de reportar falco - por implementar
            console.log('Reportar falco - funcionalidad por implementar');
          },
          onMove: () => {
            // Funcionalidad de mover - por implementar
            console.log('Mover gastos - funcionalidad por implementar');
          },
          saving: isCreating,
          disabled: balanceWarnings.length > 0 || (Object.keys(editedTransactions).length === 0 && newTransactions.length === 0)
        }}
        dateMover={{
          type: 'expenses',
          selectedDate,
          selectedRoute,
          selectedLead,
          onSuccess: () => { refetchExpenses(); },
          itemCount: transactions.length + newTransactions.length,
          label: 'gasto(s)'
        }}
      />

      {/* Filtros de gastos */}
      <Box css={{ 
        backgroundColor: '#F8FAFC', 
        borderRadius: '8px', 
        padding: '16px', 
        marginBottom: '16px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#374151' }}>
            🔍 Filtros de Gastos:
          </h4>
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          padding: '8px 12px',
          backgroundColor: '#ECFDF5',
          borderRadius: '6px',
          border: '1px solid #10B981'
        }}>
          <span style={{ fontSize: '12px', color: '#047857', fontWeight: '500' }}>
            ✅ Por defecto: Efectivo, Gasolina, Viajes
          </span>
        </div>
        
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: '6px',
          backgroundColor: includeBankOfficeExpenses ? '#EFF6FF' : 'transparent',
          border: includeBankOfficeExpenses ? '1px solid #3B82F6' : '1px solid #E5E7EB',
          transition: 'all 0.2s ease'
        }}>
          <input
            type="checkbox"
            checked={includeBankOfficeExpenses}
            onChange={(e) => setIncludeBankOfficeExpenses(e.target.checked)}
            style={{ margin: 0, width: '16px', height: '16px', accentColor: '#3B82F6' }}
          />
          <span style={{ 
            fontSize: '13px', 
            fontWeight: '500', 
            color: includeBankOfficeExpenses ? '#1E40AF' : '#6B7280' 
          }}>
            🏦 Incluir gastos de Banco y Oficina
          </span>
        </label>
        
        <div style={{ 
          fontSize: '12px', 
          color: '#6B7280', 
          fontStyle: 'italic',
          marginLeft: 'auto'
        }}>
          {includeBankOfficeExpenses 
            ? 'Mostrando todos los tipos de cuenta' 
            : 'Solo cuentas principales de la ruta'
          }
        </div>
      </Box>

      <Box css={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', position: 'relative', marginBottom: '16px' }}>
        <div style={{ padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>Gastos Registrados</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Botón movido al KPIBar para consistencia con otras tabs */}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={tableHeaderStyle}>Tipo</th>
                <th style={tableHeaderStyle}>Monto</th>
                <th style={tableHeaderStyle}>Descripción</th>
                <th style={tableHeaderStyle}>Fecha</th>
                <th style={tableHeaderStyle}>Líder</th>
                <th style={tableHeaderStyle}>Cuenta</th>
                <th style={{ ...tableHeaderStyle, width: '40px', minWidth: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} style={{ borderBottom: '1px solid #E5E7EB', transition: 'all 0.3s ease', backgroundColor: 'white', position: 'relative' }}>
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {(transaction as any).expenseGroupId && (
                        <span style={{ 
                          fontSize: '10px', 
                          backgroundColor: '#DBEAFE', 
                          color: '#1E40AF', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontWeight: '500',
                          border: '1px solid #93C5FD'
                        }}>
                          🔀 DIST
                        </span>
                      )}
                      {transaction.sourceAccount?.type === 'PREPAID_GAS' && (
                        <span style={{ 
                          fontSize: '10px', 
                          backgroundColor: '#FEF3C7', 
                          color: '#92400E', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontWeight: '500',
                          border: '1px solid #FDE68A'
                        }}>
                          ⛽ GAS
                        </span>
                      )}
                      {transaction.sourceAccount?.type === 'TRAVEL_EXPENSES' && (
                        <span style={{ 
                          fontSize: '10px', 
                          backgroundColor: '#F0FDF4', 
                          color: '#166534', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontWeight: '500',
                          border: '1px solid #BBF7D0'
                        }}>
                          ✈️ VIAJE
                        </span>
                      )}
                      {transaction.sourceAccount?.type === 'BANK' && (
                        <span style={{ 
                          fontSize: '10px', 
                          backgroundColor: '#EFF6FF', 
                          color: '#1E40AF', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontWeight: '500',
                          border: '1px solid #BFDBFE'
                        }}>
                          🏦 BANCO
                        </span>
                      )}
                      {transaction.sourceAccount?.type === 'OFFICE_CASH_FUND' && (
                        <span style={{ 
                          fontSize: '10px', 
                          backgroundColor: '#FDF2F8', 
                          color: '#BE185D', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontWeight: '500',
                          border: '1px solid #FBCFE8'
                        }}>
                          🏢 OFICINA
                        </span>
                      )}
                      <span>{expenseTypes.find(t => t.value === transaction.expenseSource)?.label || 'Sin tipo'}</span>
                    </div>
                  </td>
                  <td style={tableCellStyle}>${parseFloat(transaction.amount).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                  <td style={tableCellStyle}>{transaction.description || '-'}</td>
                  <td style={tableCellStyle}>{new Date(new Date(transaction.date).getTime() + new Date().getTimezoneOffset() * 60000).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td>
                  <td style={tableCellStyle}>{transaction.lead?.personalData?.fullName || 'Sin líder'}</td>
                  <td style={tableCellStyle}>{transaction.sourceAccount?.name || '-'}</td>
                  <td style={{ ...tableCellStyle, width: '40px', position: 'relative' }}>
                    {isDeleting === transaction.id ? (
                      <Box css={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '32px' }}>
                        <LoadingDots label="Eliminando" size="small" />
                      </Box>
                    ) : (
                      <Button
                        ref={(el) => { if (el) buttonRefs.current[transaction.id] = el; }}
                        tone="passive"
                        size="small"
                        onClick={() => setActiveMenu(activeMenu === transaction.id ? null : transaction.id)}
                        style={{ padding: '6px', minWidth: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <FaEllipsisV size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      {newTransactions.length > 0 && (
        <Box css={{ backgroundColor: '#F0F9FF', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', marginBottom: '16px', position: 'relative' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #E0F2FE' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0277BD', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>➕</span>
                Gastos Nuevos ({newTransactions.length})
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontWeight: '400', color: '#6B7280' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} /><span>Completo</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B' }} /><span>Incompleto</span></div>
              </div>
            </div>
          </div>
          
          <div style={{ padding: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#E0F2FE', borderBottom: '1px solid #B3E5FC' }}>
                  <th style={tableHeaderStyle}>Modo</th>
                  <th style={tableHeaderStyle}>Tipo</th>
                  <th style={tableHeaderStyle}>Monto</th>
                  <th style={tableHeaderStyle}>Descripción</th>
                  <th style={tableHeaderStyle}>Fecha</th>
                  <th style={tableHeaderStyle}>Líder</th>
                  <th style={tableHeaderStyle}>Cuenta</th>
                  <th style={{ ...tableHeaderStyle, width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {newTransactions.map((transaction, index) => (
                  <React.Fragment key={`new-${index}`}>
                    <tr style={{ backgroundColor: isTransactionValid(transaction) ? '#ECFDF5' : '#FEF3C7', borderBottom: '1px solid #E0F2FE' }}>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                          <input type="checkbox" checked={transaction.isDistributed || false} onChange={() => handleToggleDistribution(index)} style={{ margin: 0, width: '12px', height: '12px' }} />
                          <span style={{ color: transaction.isDistributed ? '#DC2626' : '#059669', fontWeight: '600', fontSize: '9px' }}>{transaction.isDistributed ? '🔀 DIST' : '📝 IND'}</span>
                          {transaction.isDistributed && (
                            <>
                              <span style={{ fontSize: '8px', color: '#6B7280', marginLeft: '2px' }}>({transaction.selectedRouteIds?.length || 0})</span>
                              <button type="button" onClick={() => handleToggleRowExpansion(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '10px', color: '#6B7280', display: 'flex', alignItems: 'center' }} title={expandedRows.has(index) ? 'Contraer' : 'Expandir para editar rutas'}>
                                {expandedRows.has(index) ? '🔼' : '🔽'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isTransactionValid(transaction) ? '#10B981' : '#F59E0B' }} />
                        <Select
                          value={expenseTypes.find(t => t.value === transaction.expenseSource) || expenseTypes[0]}
                          options={expenseTypes}
                          onChange={option => handleEditTransaction(index, 'expenseType', option?.value || '')}
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                          menuPlacement="auto"
                        />
                      </div>
                    </td>
                      <td style={tableCellStyle}><TextInput type="number" step="1" value={transaction.amount} onChange={e => handleEditTransaction(index, 'amount', e.target.value)} placeholder="0" style={{ fontSize: '11px', height: '32px' }} onWheel={(e) => e.currentTarget.blur()} /></td>
                      <td style={tableCellStyle}><TextInput value={transaction.description || ''} onChange={e => handleEditTransaction(index, 'description', e.target.value)} placeholder="Descripción del gasto" style={{ fontSize: '11px', height: '32px' }} /></td>
                      <td style={tableCellStyle}>{new Date(new Date(transaction.date).getTime() + new Date().getTimezoneOffset() * 60000).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td>
                    <td style={tableCellStyle}>{selectedLead?.personalData?.fullName}</td>
                    <td style={tableCellStyle}>
                      <Select
                          value={selectedRoute?.accounts?.map(acc => ({ label: acc.name || '', value: acc.id })).find(acc => acc.value === transaction.sourceAccount?.connect?.id) || null}
                        options={selectedRoute?.accounts?.filter(acc => {
                          if (transaction.expenseSource === 'GASOLINE') {
                            return acc.type === 'PREPAID_GAS' || acc.type === 'EMPLOYEE_CASH_FUND' || acc.type === 'OFFICE_CASH_FUND';
                          }
                          return acc.type !== 'PREPAID_GAS';
                        }).map(acc => ({
                            label: acc.type === 'PREPAID_GAS' ? `${acc.name || 'Toka'} (Prepago Gas)` : 
                                   acc.type === 'EMPLOYEE_CASH_FUND' ? `${acc.name || 'Efectivo'} (Efectivo)` : 
                                   acc.type === 'OFFICE_CASH_FUND' ? `${acc.name || 'Oficina'} (Oficina)` : 
                                   acc.name || '',
                          value: acc.id
                        })) || []}
                        onChange={option => handleEditTransaction(index, 'sourceAccount', option?.value || '')}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        menuPlacement="auto"
                      />
                    </td>
                      <td style={{ ...tableCellStyle, width: '80px' }}>
                        <Box css={{ display: 'flex', gap: '4px' }}>
                          <Button tone="negative" size="small" onClick={() => handleCancelNew(index)} style={{ padding: '4px 8px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Eliminar de la lista">
                          <FaTrash size={12} />
                        </Button>
                      </Box>
                    </td>
                  </tr>
                    
                    {transaction.isDistributed && expandedRows.has(index) && (
                      <tr>
                        <td colSpan={8} style={{ padding: '0', border: 'none', backgroundColor: 'transparent' }}>
                          <div style={{ margin: '0 16px 12px 16px', padding: '20px', backgroundColor: '#fafafa', borderRadius: '6px', border: '1px solid #e8e8e8', animation: 'slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1)', transformOrigin: 'top', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                              <div style={{ fontSize: '14px', fontWeight: '500', color: '#333333' }}>Seleccionar rutas ({transaction.selectedRouteIds?.length || 0} de {allRoutes.length})</div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleUpdateTransactionRoutes(index, allRoutes.map(r => r.id))} style={{ fontSize: '12px', padding: '6px 12px', backgroundColor: '#ffffff', color: '#666666', border: '1px solid #d0d0d0', borderRadius: '4px', cursor: 'pointer', fontWeight: '400' }}>Todas</button>
                                <button onClick={() => handleUpdateTransactionRoutes(index, [])} style={{ fontSize: '12px', padding: '6px 12px', backgroundColor: '#ffffff', color: '#666666', border: '1px solid #d0d0d0', borderRadius: '4px', cursor: 'pointer', fontWeight: '400' }}>Ninguna</button>
                              </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '20px' }}>
                              {allRoutes.map(route => (
                                <label key={route.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '4px', backgroundColor: '#ffffff', border: transaction.selectedRouteIds?.includes(route.id) ? '1px solid #1a73e8' : '1px solid #e0e0e0', cursor: 'pointer', transition: 'border-color 0.15s ease' }}>
                                  <input
                                    type="checkbox"
                                    checked={transaction.selectedRouteIds?.includes(route.id) || false}
                                    onChange={(e) => {
                                      const newRouteIds = e.target.checked
                                        ? [...(transaction.selectedRouteIds || []), route.id]
                                        : (transaction.selectedRouteIds || []).filter(id => id !== route.id);
                                      handleUpdateTransactionRoutes(index, newRouteIds);
                                    }}
                                    style={{ margin: 0, width: '16px', height: '16px', accentColor: '#1a73e8' }}
                                  />
                                  <span style={{ fontSize: '13px', fontWeight: '400', color: '#333333', flex: 1 }}>{route.name}</span>
                                </label>
                              ))}
                            </div>
                            
                            {transaction.selectedRouteIds && transaction.selectedRouteIds.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f8f8f8', borderRadius: '4px', fontSize: '13px', color: '#666666' }}>
                                <span>Total: <strong style={{ color: '#333333' }}>${transaction.amount || '0'}</strong></span>
                                <span>Por ruta: <strong style={{ color: '#333333' }}>${(parseFloat(transaction.amount || '0') / transaction.selectedRouteIds.length).toFixed(2)}</strong></span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      )}

      {/* Advertencias de balance */}
      {balanceWarnings.length > 0 && (
        <Box style={{
          marginBottom: '12px',
          padding: '16px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '6px'
        }}>
          <div style={{ 
              display: 'flex',
              alignItems: 'center',
            marginBottom: '12px',
            color: '#d32f2f',
            fontWeight: '600',
            fontSize: '14px'
          }}>
            ⚠️ ADVERTENCIA: Balances insuficientes
          </div>
          <div style={{ fontSize: '13px', color: '#d32f2f', marginBottom: '8px' }}>
            Las siguientes cuentas quedarían con balance negativo:
          </div>
          {balanceWarnings.map((warning, index) => (
            <div key={index} style={{
              margin: '4px 0',
              padding: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid #ffcdd2',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: '600', color: '#d32f2f', marginBottom: '2px' }}>
                {warning.accountName}
              </div>
              <div style={{ color: '#666' }}>
                Balance actual: ${warning.currentBalance.toLocaleString()} • 
                Gasto: ${warning.impact.toLocaleString()} • 
                Balance final: ${warning.finalBalance.toLocaleString()}
              </div>
            </div>
          ))}
        </Box>
      )}

      {newTransactions.length > 0 && (
        <Box css={{ backgroundColor: '#F1F5F9', borderRadius: '6px', padding: '12px', marginBottom: '12px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#475569' }}>🛠️ Herramientas de Gestión Masiva</h4>
            <div style={{ fontSize: '11px', color: '#6B7280' }}>{newTransactions.filter(t => t.isDistributed).length} distribuidos • {newTransactions.filter(t => !t.isDistributed).length} individuales</div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button size="small" tone="passive" onClick={() => handleBulkToggleDistribution(true)} style={{ fontSize: '10px', padding: '4px 8px', height: '24px' }}>🔀 Convertir todos a distribuidos</Button>
            <Button size="small" tone="passive" onClick={() => handleBulkToggleDistribution(false)} style={{ fontSize: '10px', padding: '4px 8px', height: '24px' }}>📝 Convertir todos a individuales</Button>
          </div>
        </Box>
      )}

      <Box css={{ backgroundColor: '#F8FAFC', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', marginBottom: '16px', position: 'relative' }}>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📝</span>
              Agregar Nuevo Gasto
            </h3>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6B7280', fontStyle: 'italic' }}>
              💡 Haz clic en el botón para agregar un nuevo gasto. Puedes configurar si es individual o distribuido después.
            </p>
            
            {defaultDistributionMode && (
              <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#FEF3C7', borderRadius: '4px', border: '1px solid #F59E0B' }}>
                <div style={{ fontSize: '11px', color: '#92400E', marginBottom: '6px', fontWeight: '500' }}>
                  🎯 Rutas por defecto para distribución ({defaultSelectedRoutes.length} de {allRoutes.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '60px', overflowY: 'auto' }}>
                  {allRoutes.map(route => (
                    <label key={route.id} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', cursor: 'pointer', padding: '1px 4px', borderRadius: '2px', backgroundColor: defaultSelectedRoutes.includes(route.id) ? '#DBEAFE' : 'transparent', border: defaultSelectedRoutes.includes(route.id) ? '1px solid #3B82F6' : '1px solid transparent' }}>
                      <input
                        type="checkbox"
                        checked={defaultSelectedRoutes.includes(route.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDefaultSelectedRoutes([...defaultSelectedRoutes, route.id]);
                          } else {
                            setDefaultSelectedRoutes(defaultSelectedRoutes.filter(id => id !== route.id));
                          }
                        }}
                        style={{ margin: 0, width: '10px', height: '10px' }}
                      />
                      <span style={{ color: defaultSelectedRoutes.includes(route.id) ? '#1E40AF' : '#6B7280', fontWeight: defaultSelectedRoutes.includes(route.id) ? '500' : '400' }}>{route.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <Button
            tone="active"
            size="medium"
            weight="bold"
            onClick={handleAddTransaction}
            isDisabled={!selectedRoute || !selectedDate || createLoading}
            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '6px', backgroundColor: '#0052CC', transition: 'all 0.2s ease', display: 'inline-flex', alignItems: 'center', gap: '6px', height: '40px', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}
          >
            <FaPlus size={12} style={{ marginTop: '-1px' }} />
            <span>Nuevo Gasto</span>
          </Button>
        </div>
      </Box>

      {/* Global Dropdown Container */}
      <DropdownPortal isOpen={activeMenu !== null}>
        {transactions.map((transaction) => (
          activeMenu === transaction.id && (
            <div key={`dropdown-${transaction.id}`} ref={menuRef} style={{ position: 'fixed', ...getDropdownPosition(transaction.id), backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)', pointerEvents: 'auto', minWidth: '160px', zIndex: 10000, transform: 'translateY(-100%)' }}>
              <button onClick={async () => { await handleOpenEditModal(transaction); setActiveMenu(null); }} style={menuItemStyle}><FaEdit size={14} style={{ marginRight: '8px' }} />Editar</button>
              <button onClick={() => { handleDeleteExistingTransaction(transaction.id); setActiveMenu(null); }} style={{ ...menuItemStyle, color: '#DC2626', borderTop: '1px solid #E5E7EB' }}><FaTrash size={14} style={{ marginRight: '8px' }} />Eliminar</button>
            </div>
          )
        ))}
      </DropdownPortal>

      {/* Edit Modal */}
      {editingTransaction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '400px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600', color: '#1a202c' }}>Editar Gasto</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4a5568' }}>Tipo de Gasto</label>
              <Select
                value={expenseTypes.find(t => t.value === editingTransaction.expenseSource) || expenseTypes[0]}
                options={expenseTypes}
                onChange={option => updateState({ editingTransaction: { ...editingTransaction, expenseSource: option?.value || '' } })}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                menuPlacement="auto"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4a5568' }}>Monto</label>
              <TextInput
                type="number" step="1"
                value={editingTransaction.amount}
                onChange={e => updateState({ editingTransaction: { ...editingTransaction, amount: e.target.value } })}
                placeholder="0"
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4a5568' }}>Descripción</label>
              <TextInput
                value={editingTransaction.description || ''}
                onChange={e => updateState({ editingTransaction: { ...editingTransaction, description: e.target.value } })}
                placeholder="Descripción del gasto"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button tone="passive" onClick={handleCloseEditModal}>Cancelar</Button>
              <Button tone="positive" onClick={handleSaveEdit} isLoading={isUpdating === editingTransaction.id}>{isUpdating === editingTransaction.id ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Distributed Edit Confirmation Modal */}
      {showDistributedEditConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px' 
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px', 
            padding: '32px', 
            width: '100%', 
            maxWidth: '600px', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
          }}>
            <h3 style={{
              marginBottom: '24px', 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#1f2937', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px' 
            }}>
              <span style={{ fontSize: '28px' }}>⚙️</span>Editar Gasto Distribuido
            </h3>
            
            <div style={{ 
              marginBottom: '24px', 
              padding: '20px', 
              backgroundColor: '#fef3c7', 
              borderRadius: '8px', 
              border: '1px solid #f59e0b' 
            }}>
              <div style={{ 
              fontSize: '16px',
                color: '#92400e', 
              fontWeight: '600',
                marginBottom: '6px' 
              }}>
                📋 Gasto distribuido entre {showDistributedEditConfirmation.totalTransactions} rutas
              </div>
              <div style={{ fontSize: '14px', color: '#a16207' }}>
                Total: <strong>${showDistributedEditConfirmation.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong> • 
                Tipo: <strong>{showDistributedEditConfirmation.currentTransaction.expenseSource}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '16px' 
              }}>
                Selecciona qué rutas editar:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {showDistributedEditConfirmation.affectedRoutes.map((route, index) => {
                  const routeId = showDistributedEditConfirmation.distributedGroupData.routeIds[index];
                  return (
                    <label 
                      key={index} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px 20px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        border: '2px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseOut={(e) => {
                        const checkbox = e.currentTarget.querySelector('input[type="checkbox"]') as HTMLInputElement;
                        e.currentTarget.style.backgroundColor = checkbox?.checked ? '#eff6ff' : '#f9fafb';
                        e.currentTarget.style.borderColor = checkbox?.checked ? '#3b82f6' : '#e5e7eb';
                      }}
                    >
                      <input 
                        type="checkbox" 
                        defaultChecked={true}
                        style={{ 
                          width: '20px', 
                          height: '20px',
                          accentColor: '#3b82f6',
                          cursor: 'pointer'
                        }}
                        onChange={(e) => {
                          const currentSelection = [...showDistributedEditConfirmation.distributedGroupData.routeIds];
                          
                          if (e.target.checked) {
                            // Agregar ruta si no está
                            if (!currentSelection.includes(routeId)) {
                              currentSelection.push(routeId);
                            }
                          } else {
                            // Remover ruta
                            const index = currentSelection.indexOf(routeId);
                            if (index > -1) {
                              currentSelection.splice(index, 1);
                            }
                          }
                          
                          updateState({
                            showDistributedEditConfirmation: {
                              ...showDistributedEditConfirmation,
                              distributedGroupData: {
                                ...showDistributedEditConfirmation.distributedGroupData,
                                routeIds: currentSelection
                              }
                            }
                          });

                          // Actualizar estilo visual
                          const label = e.target.closest('label') as HTMLLabelElement;
                          if (e.target.checked) {
                            label.style.backgroundColor = '#eff6ff';
                            label.style.borderColor = '#3b82f6';
                          } else {
                            label.style.backgroundColor = '#f9fafb';
                            label.style.borderColor = '#e5e7eb';
                          }
                        }}
                      />
                      <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center' 
                      }}>
                        <span style={{ 
                          fontSize: '16px', 
                          color: '#374151', 
                          fontWeight: '500' 
                        }}>
                          {route.routeName}
                        </span>
                        <span style={{ 
                          fontSize: '18px', 
                          color: '#059669', 
                          fontWeight: '700' 
                        }}>
                          ${route.amount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
              </label>
                  );
                })}
            </div>
            </div>

            <div style={{ 
              marginBottom: '32px', 
              padding: '16px 20px', 
              backgroundColor: '#ecfdf5', 
              borderRadius: '8px', 
              border: '1px solid #10b981' 
            }}>
              <div style={{ fontSize: '14px', color: '#047857', fontWeight: '500' }}>
                💡 <strong>Opciones disponibles:</strong><br/>
                • Selecciona <strong>todas</strong> para editar el grupo completo<br/>
                • Selecciona <strong>solo una</strong> para separarla como gasto individual<br/>
                • Selecciona <strong>varias</strong> para crear un nuevo subgrupo
            </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Button
                tone="passive"
                onClick={() => updateState({ showDistributedEditConfirmation: null })}
                style={{ 
                  minWidth: '120px',
                  padding: '12px 20px',
                  fontSize: '14px'
                }}
              >
                ❌ Cancelar
              </Button>
              
              <Button
                tone="positive"
                onClick={() => {
                  console.log('✏️ Procediendo a editar rutas seleccionadas');
                  const selectedRoutes = showDistributedEditConfirmation.distributedGroupData.routeIds;
                  
                  if (selectedRoutes.length === 0) {
                    alert('❗ Selecciona al menos una ruta para editar');
                    return;
                  }
                  
                  if (selectedRoutes.length === 1) {
                    // Editar como individual (separar del grupo)
                    console.log('📝 Editando como individual - separando del grupo');
                    const currentTx = showDistributedEditConfirmation.currentTransaction;
                    updateState({ 
                      editingTransaction: {
                        ...currentTx,
                        __separateFromGroup: true
                      },
                      showDistributedEditConfirmation: null 
                    });
                  } else if (selectedRoutes.length === showDistributedEditConfirmation.totalTransactions) {
                    // Editar todo el grupo original
                    console.log('🔄 Editando todo el grupo completo');
                    updateState({ 
                      editingDistributedGroup: showDistributedEditConfirmation.distributedGroupData,
                      showDistributedEditConfirmation: null 
                    });
                  } else {
                    // Editar subgrupo seleccionado
                    console.log('🔀 Editando subgrupo seleccionado');
                    updateState({ 
                      editingDistributedGroup: {
                        ...showDistributedEditConfirmation.distributedGroupData,
                        routeIds: selectedRoutes
                      },
                      showDistributedEditConfirmation: null 
                    });
                  }
                }}
                style={{ 
                  minWidth: '180px',
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: '600'
                }}
              >
                ✏️ Editar Seleccionadas
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Distributed Expense Modal */}
      {editingDistributedGroup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '500px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '8px' }}><span>🔄</span>Editar Gasto Distribuido</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4a5568' }}>Tipo de Gasto</label>
              <Select
                value={expenseTypes.find(t => t.value === editingDistributedGroup.expenseSource) || expenseTypes[0]}
                options={expenseTypes}
                onChange={option => updateState({ editingDistributedGroup: { ...editingDistributedGroup, expenseSource: option?.value || '' } })}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                menuPlacement="auto"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4a5568' }}>Monto Total</label>
              <TextInput
                type="number" step="1"
                value={editingDistributedGroup.amount}
                onChange={e => updateState({ editingDistributedGroup: { ...editingDistributedGroup, amount: e.target.value } })}
                placeholder="0"
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4a5568' }}>Descripción</label>
              <TextInput
                value={editingDistributedGroup.description || ''}
                onChange={e => updateState({ editingDistributedGroup: { ...editingDistributedGroup, description: e.target.value } })}
                placeholder="Descripción del gasto"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#4a5568' }}>
                Rutas ({editingDistributedGroup.routeIds.length} seleccionadas)
                {editingDistributedGroup.routeIds.length > 0 && editingDistributedGroup.amount && (
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#059669', fontWeight: '500' }}>
                    ~${(parseFloat(editingDistributedGroup.amount) / editingDistributedGroup.routeIds.length).toFixed(2)} por ruta
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '4px', backgroundColor: '#F9FAFB' }}>
                {allRoutes.map(route => (
                  <label key={route.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', backgroundColor: editingDistributedGroup.routeIds.includes(route.id) ? '#DBEAFE' : 'white', border: editingDistributedGroup.routeIds.includes(route.id) ? '1px solid #3B82F6' : '1px solid #E5E7EB' }}>
                    <input type="checkbox" checked={editingDistributedGroup.routeIds.includes(route.id)} onChange={(e) => {
                      if (e.target.checked) {
                        updateState({ editingDistributedGroup: { ...editingDistributedGroup, routeIds: [...editingDistributedGroup.routeIds, route.id] } });
                      } else {
                        updateState({ editingDistributedGroup: { ...editingDistributedGroup, routeIds: editingDistributedGroup.routeIds.filter(id => id !== route.id) } });
                      }
                    }} style={{ margin: 0, width: '14px', height: '14px' }} />
                    <span style={{ color: editingDistributedGroup.routeIds.includes(route.id) ? '#1E40AF' : '#6B7280', fontWeight: editingDistributedGroup.routeIds.includes(route.id) ? '500' : '400' }}>{route.name}</span>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#9CA3AF', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => updateState({ editingDistributedGroup: { ...editingDistributedGroup, routeIds: allRoutes.map(r => r.id) } })} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px' }}>Seleccionar todas</button>
                <button type="button" onClick={() => updateState({ editingDistributedGroup: { ...editingDistributedGroup, routeIds: [] } })} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px' }}>Limpiar selección</button>
              </div>
              {editingDistributedGroup.routeIds.length > 0 && editingDistributedGroup.amount && (
                <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#F0F9FF', borderRadius: '4px', border: '1px solid #BAE6FD' }}>
                  <div style={{ fontSize: '12px', color: '#0369A1', fontWeight: '500', marginBottom: '4px' }}>
                    📊 Distribución del Gasto
                  </div>
                  <div style={{ fontSize: '11px', color: '#0C4A6E' }}>
                    Total: ${parseFloat(editingDistributedGroup.amount).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} • 
                    Por ruta: ${(parseFloat(editingDistributedGroup.amount) / editingDistributedGroup.routeIds.length).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button tone="passive" onClick={() => updateState({ editingDistributedGroup: null })}>Cancelar</Button>
              <Button tone="positive" onClick={handleSaveEdit} isLoading={isUpdating === editingDistributedGroup.expenseGroupId}>{isUpdating === editingDistributedGroup.expenseGroupId ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Distributed Delete Confirmation Modal */}
      {showDistributedDeleteConfirmation && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0, 0, 0, 0.6)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000, 
          padding: '20px' 
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '32px', 
            width: '100%', 
            maxWidth: '600px', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
          }}>
            <h3 style={{ 
              marginBottom: '24px', 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#dc2626', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px' 
            }}>
              <span style={{ fontSize: '28px' }}>🗑️</span>Eliminar Gasto Distribuido
            </h3>
            
            <div style={{ 
              marginBottom: '24px', 
              padding: '20px', 
              backgroundColor: '#fef2f2', 
              borderRadius: '8px', 
              border: '1px solid #fca5a5' 
            }}>
              <div style={{ 
                fontSize: '16px', 
                color: '#dc2626', 
                fontWeight: '600', 
                marginBottom: '6px' 
              }}>
                ⚠️ Gasto distribuido entre {showDistributedDeleteConfirmation.totalTransactions} rutas
              </div>
              <div style={{ fontSize: '14px', color: '#991b1b' }}>
                Total: <strong>${showDistributedDeleteConfirmation.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong> • 
                Tipo: <strong>{showDistributedDeleteConfirmation.currentTransaction.expenseSource}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#374151', 
                marginBottom: '16px' 
              }}>
                Selecciona qué rutas eliminar:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {showDistributedDeleteConfirmation.affectedRoutes.map((route, index) => {
                  const isSelected = showDistributedDeleteConfirmation.selectedTransactionIds.includes(route.transactionId);
                  return (
                    <label 
                      key={index} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px 20px',
                        backgroundColor: isSelected ? '#fef2f2' : '#f9fafb',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #dc2626' : '2px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                          e.currentTarget.style.borderColor = '#dc2626';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                          e.currentTarget.style.borderColor = '#e5e7eb';
                        }
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        style={{ 
                          width: '20px', 
                          height: '20px',
                          accentColor: '#dc2626',
                          cursor: 'pointer'
                        }}
                        onChange={(e) => {
                          const currentSelection = [...showDistributedDeleteConfirmation.selectedTransactionIds];
                          
                          if (e.target.checked) {
                            if (!currentSelection.includes(route.transactionId)) {
                              currentSelection.push(route.transactionId);
                            }
                          } else {
                            const index = currentSelection.indexOf(route.transactionId);
                            if (index > -1) {
                              currentSelection.splice(index, 1);
                            }
                          }
                          
                          updateState({
                            showDistributedDeleteConfirmation: {
                              ...showDistributedDeleteConfirmation,
                              selectedTransactionIds: currentSelection
                            }
                          });
                        }}
                      />
                      <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center' 
                      }}>
                        <span style={{ 
                          fontSize: '16px', 
                          color: '#374151', 
                          fontWeight: '500' 
                        }}>
                          {route.routeName}
                        </span>
                        <span style={{ 
                          fontSize: '18px', 
                          color: '#dc2626', 
                          fontWeight: '700' 
                        }}>
                          ${route.amount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ 
              marginBottom: '32px', 
              padding: '16px 20px', 
              backgroundColor: '#fef3c7', 
              borderRadius: '8px', 
              border: '1px solid #f59e0b' 
            }}>
              <div style={{ fontSize: '14px', color: '#92400e', fontWeight: '500' }}>
                ⚠️ <strong>Atención:</strong><br/>
                • Selecciona <strong>todas</strong> para eliminar el grupo completo<br/>
                • Selecciona <strong>algunas</strong> para eliminar solo esas rutas<br/>
                • <strong>Esta acción no se puede deshacer</strong>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Button 
                tone="passive"
                onClick={() => updateState({ showDistributedDeleteConfirmation: null })}
                style={{ 
                  minWidth: '120px',
                  padding: '12px 20px',
                  fontSize: '14px'
                }}
              >
                ❌ Cancelar
              </Button>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button 
                  tone="passive"
                  onClick={() => {
                    const allSelected = showDistributedDeleteConfirmation.selectedTransactionIds.length === showDistributedDeleteConfirmation.affectedRoutes.length;
                    updateState({
                      showDistributedDeleteConfirmation: {
                        ...showDistributedDeleteConfirmation,
                        selectedTransactionIds: allSelected ? [] : showDistributedDeleteConfirmation.affectedRoutes.map(r => r.transactionId)
                      }
                    });
                  }}
                  style={{ 
                    minWidth: '140px',
                    padding: '12px 16px',
                    fontSize: '14px'
                  }}
                >
                  {showDistributedDeleteConfirmation.selectedTransactionIds.length === showDistributedDeleteConfirmation.affectedRoutes.length 
                    ? '🔄 Deseleccionar Todas' 
                    : '☑️ Seleccionar Todas'
                  }
                </Button>
                
                <Button 
                  tone="negative"
                  onClick={handleConfirmSelectedDelete}
                  isLoading={isDeleting === showDistributedDeleteConfirmation.groupId}
                  style={{ 
                    minWidth: '160px',
                    padding: '12px 24px',
                    fontSize: '15px',
                    fontWeight: '600'
                  }}
                >
                  {isDeleting === showDistributedDeleteConfirmation.groupId 
                    ? '🗑️ Eliminando...' 
                    : `🗑️ Eliminar (${showDistributedDeleteConfirmation.selectedTransactionIds.length})`
                  }
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuccessMessage && (
        <Box css={{ position: 'fixed', top: '20px', right: '20px', padding: '16px 24px', backgroundColor: '#10B981', borderRadius: '12px', color: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 1000, animation: 'slideIn 0.3s ease-out', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '500' }}>¡Cambios guardados exitosamente!</span>
        </Box>
      )}
    </Box>
  );
};

function ExpensesPageContent() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedLead, setSelectedLead] = useState<Employee | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { triggerBalanceRefresh } = useBalanceRefresh();
  const [defaultDistributionMode, setDefaultDistributionMode] = useState(false);
  const [defaultSelectedRoutes, setDefaultSelectedRoutes] = useState<string[]>([]);
  
  const { data: allRoutesData } = useQuery(GET_ROUTES, { variables: { where: {} } });
  const allRoutes = (allRoutesData?.routes || []) as Route[];

  useEffect(() => {
    if (defaultDistributionMode) {
      setDefaultSelectedRoutes(allRoutes.map(r => r.id));
    }
  }, [defaultDistributionMode, allRoutes]);

  const { refetch: refetchRouteData } = useQuery(GET_ROUTES_SIMPLE, {
    variables: { where: {} },
    fetchPolicy: 'network-only',
  });

  const handleRouteSelect = (route: Route | null) => {
    setSelectedRoute(route);
    setSelectedLead(null);
  };

  const handleLeadSelect = (lead: Employee | null) => {
    setSelectedLead(lead);
  };

  const handleDateChange = (date: string) => {
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    setSelectedDate(selectedDate);
  };

  const handleRefresh = async () => {
    try {
      if (selectedRoute?.id) {
        await refetchRouteData();
        setRefreshKey(prev => prev + 1);
        triggerBalanceRefresh();
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  return (
    <PageContainer header="Gastos">
      <Box css={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: defaultDistributionMode ? '#FEF3C7' : '#F0F9FF', border: `1px solid ${defaultDistributionMode ? '#F59E0B' : '#0EA5E9'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '20px' }}>{defaultDistributionMode ? '🔀' : '📝'}</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: defaultDistributionMode ? '#92400E' : '#0C4A6E', marginBottom: '2px' }}>
              Modo por defecto: {defaultDistributionMode ? 'Distribución' : 'Individual'}
            </div>
            <div style={{ fontSize: '12px', color: defaultDistributionMode ? '#A16207' : '#0369A1' }}>
              {defaultDistributionMode ? `Nuevos gastos se distribuirán entre ${defaultSelectedRoutes.length} rutas por defecto` : 'Nuevos gastos se crearán individualmente por defecto'}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500', color: defaultDistributionMode ? '#92400E' : '#0C4A6E' }}>
            <input type="checkbox" checked={defaultDistributionMode} onChange={(e) => setDefaultDistributionMode(e.target.checked)} style={{ margin: 0 }} />
            Distribución por defecto
          </label>
        </div>
      </Box>
      
      <Box padding="xlarge">
        <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <Box css={{ width: '100%' }}>
            <RouteLeadSelector
              key={refreshKey}
              selectedRoute={selectedRoute}
              selectedLead={selectedLead}
              selectedDate={selectedDate}
              onRouteSelect={handleRouteSelect}
              onLeadSelect={handleLeadSelect}
              onDateSelect={setSelectedDate}
            />
          </Box>
          <Box css={{ width: '100%' }}>
            <DatePicker
              value={selectedDate.toISOString().split('T')[0]}
              onUpdate={handleDateChange}
              onClear={() => setSelectedDate(new Date())}
            />
          </Box>
        </Box>
        <CreateExpensesForm
          selectedDate={selectedDate}
          selectedRoute={selectedRoute}
          selectedLead={selectedLead}
          refreshKey={refreshKey}
          onSaveComplete={handleRefresh}
        />
      </Box>
    </PageContainer>
  );
}

export default function ExpensesPage() {
  return <ExpensesPageContent />;
}

// Styles
const tableHeaderStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 500,
  color: '#374151',
  whiteSpace: 'normal',
  fontSize: '12px',
  lineHeight: '1.2',
  minWidth: '80px',
  maxWidth: '120px',
};

const tableCellStyle: React.CSSProperties = {
  padding: '8px 12px',
  color: '#1a1f36',
  fontSize: '11px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  position: 'relative',
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '8px 16px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#374151',
  transition: 'background-color 0.2s',
  textAlign: 'left'
};