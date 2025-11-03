/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Button } from '@keystone-ui/button';
import { Select, TextInput } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { Box, jsx } from '@keystone-ui/core';
import { 
  FaFilter, 
  FaDownload, 
  FaChartBar, 
  FaMoneyBillWave, 
  FaRoute, 
  FaCalendarAlt,
  FaEye,
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown
} from 'react-icons/fa';
import ProtectedRoute from '../components/ProtectedRoute';
import { GET_MONTHLY_EXPENSES_ADMIN, GET_EXPENSES_KPIS } from '../graphql/queries/transactions';
import { GET_ROUTES } from '../graphql/queries/routes';

// Tipos de gastos disponibles (excluyendo tipos relacionados con préstamos)
const expenseTypes = [
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
  { label: 'Otro', value: 'OTRO' }
];

// Tipos de gasto que deben ser excluidos por defecto
const excludedExpenseTypes = ['LOAN_GRANTED', 'LOAN_PAYMENT_COMISSION', 'LOAN_GRANTED_COMISSION'];

// Tipos de cuenta
const accountTypes = [
  { label: 'Efectivo Empleado', value: 'EMPLOYEE_CASH_FUND' },
  { label: 'Gasolina Prepagada', value: 'PREPAID_GAS' },
  { label: 'Gastos de Viaje', value: 'TRAVEL_EXPENSES' },
  { label: 'Banco', value: 'BANK' },
  { label: 'Fondo de Oficina', value: 'OFFICE_CASH_FUND' }
];

// Query para obtener todos los gastos del mes con información completa para administración
const GET_MONTHLY_EXPENSES_ADMIN = gql`
  query GetMonthlyExpensesAdmin($startDate: DateTime!, $endDate: DateTime!, $routeIds: [ID!]) {
    transactions(where: {
      AND: [
        { date: { gte: $startDate } },
        { date: { lt: $endDate } },
        { type: { equals: "EXPENSE" } },
        { expenseSource: { notIn: ["LOAN_GRANTED", "LOAN_PAYMENT_COMISSION", "LOAN_GRANTED_COMISSION"] } },
        { 
          OR: [
            { route: { id: { in: $routeIds } } },
            { sourceAccount: { routes: { some: { id: { in: $routeIds } } } } }
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
        amount
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

interface Transaction {
  id: string;
  amount: string;
  type: string;
  expenseSource: string;
  description: string;
  date: string;
  expenseGroupId?: string;
  route?: {
    id: string;
    name: string;
  };
  sourceAccount?: {
    id: string;
    name: string;
    type: string;
    amount: string;
    routes?: Array<{
      id: string;
      name: string;
    }>;
  };
  lead?: {
    id: string;
    personalData: {
      fullName: string;
    };
  };
}

interface Route {
  id: string;
  name: string;
}

interface KPIData {
  byExpenseType: { [key: string]: { count: number; total: number } };
  byAccountType: { [key: string]: { count: number; total: number } };
  byRoute: { [key: string]: { count: number; total: number } };
  totalExpenses: number;
  totalCount: number;
}

const AdministrarGastosPage = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [selectedExpenseTypes, setSelectedExpenseTypes] = useState<string[]>([]);
  const [selectedAccountTypes, setSelectedAccountTypes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Obtener fechas del mes seleccionado
  const { startDate, endDate } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  }, [selectedMonth]);

  // Obtener todas las rutas
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES, {
    variables: { where: {} }
  });
  const allRoutes = (routesData?.routes || []) as Route[];

  // Inicializar rutas seleccionadas con todas las rutas
  useEffect(() => {
    if (allRoutes.length > 0 && selectedRoutes.length === 0) {
      setSelectedRoutes(allRoutes.map(route => route.id));
    }
  }, [allRoutes, selectedRoutes.length]);

  // Obtener gastos del mes
  const { data: expensesData, loading: expensesLoading, error: expensesError } = useQuery(
    GET_MONTHLY_EXPENSES_ADMIN,
    {
      variables: {
        startDate,
        endDate,
        routeIds: selectedRoutes
      },
      skip: selectedRoutes.length === 0
    }
  );

  const transactions = (expensesData?.transactions || []) as Transaction[];

  // Calcular KPIs
  const kpiData: KPIData = useMemo(() => {
    const byExpenseType: { [key: string]: { count: number; total: number } } = {};
    const byAccountType: { [key: string]: { count: number; total: number } } = {};
    const byRoute: { [key: string]: { count: number; total: number } } = {};
    
    let totalExpenses = 0;
    let totalCount = 0;

    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      totalExpenses += amount;
      totalCount++;

      // Por tipo de gasto
      const expenseType = transaction.expenseSource || 'SIN_TIPO';
      if (!byExpenseType[expenseType]) {
        byExpenseType[expenseType] = { count: 0, total: 0 };
      }
      byExpenseType[expenseType].count++;
      byExpenseType[expenseType].total += amount;

      // Por tipo de cuenta
      const accountType = transaction.sourceAccount?.type || 'SIN_CUENTA';
      if (!byAccountType[accountType]) {
        byAccountType[accountType] = { count: 0, total: 0 };
      }
      byAccountType[accountType].count++;
      byAccountType[accountType].total += amount;

      // Por ruta
      const routeName = transaction.route?.name || transaction.sourceAccount?.routes?.[0]?.name || 'SIN_RUTA';
      if (!byRoute[routeName]) {
        byRoute[routeName] = { count: 0, total: 0 };
      }
      byRoute[routeName].count++;
      byRoute[routeName].total += amount;
    });

    return {
      byExpenseType,
      byAccountType,
      byRoute,
      totalExpenses,
      totalCount
    };
  }, [transactions]);

  // Filtrar y ordenar transacciones
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter(transaction => {
      // Excluir tipos de gasto relacionados con préstamos por defecto
      if (excludedExpenseTypes.includes(transaction.expenseSource)) {
        return false;
      }

      // Filtro por tipo de gasto
      if (selectedExpenseTypes.length > 0 && !selectedExpenseTypes.includes(transaction.expenseSource)) {
        return false;
      }

      // Filtro por tipo de cuenta
      if (selectedAccountTypes.length > 0 && !selectedAccountTypes.includes(transaction.sourceAccount?.type || '')) {
        return false;
      }

      // Filtro por búsqueda
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesDescription = transaction.description?.toLowerCase().includes(searchLower);
        const matchesLead = transaction.lead?.personalData?.fullName?.toLowerCase().includes(searchLower);
        const matchesRoute = transaction.route?.name?.toLowerCase().includes(searchLower);
        const matchesAccount = transaction.sourceAccount?.name?.toLowerCase().includes(searchLower);
        
        if (!matchesDescription && !matchesLead && !matchesRoute && !matchesAccount) {
          return false;
        }
      }

      return true;
    });

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'amount':
          aValue = parseFloat(a.amount);
          bValue = parseFloat(b.amount);
          break;
        case 'expenseSource':
          aValue = a.expenseSource || '';
          bValue = b.expenseSource || '';
          break;
        case 'route':
          aValue = a.route?.name || a.sourceAccount?.routes?.[0]?.name || '';
          bValue = b.route?.name || b.sourceAccount?.routes?.[0]?.name || '';
          break;
        case 'lead':
          aValue = a.lead?.personalData?.fullName || '';
          bValue = b.lead?.personalData?.fullName || '';
          break;
        default:
          aValue = a[sortField as keyof Transaction] || '';
          bValue = b[sortField as keyof Transaction] || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [transactions, selectedExpenseTypes, selectedAccountTypes, searchTerm, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <FaSort />;
    return sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getExpenseTypeLabel = (value: string) => {
    return expenseTypes.find(type => type.value === value)?.label || value;
  };

  const getAccountTypeLabel = (value: string) => {
    return accountTypes.find(type => type.value === value)?.label || value;
  };

  if (routesLoading || expensesLoading) {
    return (
      <ProtectedRoute requiredRole="ADMIN">
        <PageContainer header="Administrar Gastos">
          <Box css={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <LoadingDots label="Cargando gastos..." size="large" />
          </Box>
        </PageContainer>
      </ProtectedRoute>
    );
  }

  if (expensesError) {
    return (
      <ProtectedRoute requiredRole="ADMIN">
        <PageContainer header="Administrar Gastos">
          <GraphQLErrorNotice networkError={expensesError} />
        </PageContainer>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
        <PageContainer header="Administrar Gastos del Mes">
        <Box padding="large">
          
          {/* Controles principales */}
          <Box css={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '24px', 
            marginBottom: '24px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0'
          }}>
            <Box css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <Box css={{ fontSize: '20px', fontWeight: '600', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaChartBar />
                Controles de Filtrado
              </Box>
              <Button
                tone="passive"
                onClick={() => setShowFilters(!showFilters)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FaFilter />
                {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
              </Button>
            </Box>

            <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <Box>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  <FaCalendarAlt style={{ marginRight: '6px' }} />
                  Mes
                </label>
                <TextInput
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </Box>
              
              <Box>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  <FaSearch style={{ marginRight: '6px' }} />
                  Buscar
                </label>
                <TextInput
                  placeholder="Descripción, líder, ruta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Box>
            </Box>

            {/* Nota informativa sobre tipos excluidos */}
            <Box css={{ 
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: '#FEF3C7',
              borderRadius: '8px',
              border: '1px solid #F59E0B'
            }}>
              <Box css={{ 
                fontSize: '13px', 
                color: '#92400E', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>🚫</span>
                <span>
                  <strong>Tipos de gasto excluidos por defecto:</strong> LOAN_GRANTED, LOAN_PAYMENT_COMISSION, LOAN_GRANTED_COMISSION
                </span>
              </Box>
              <Box css={{ 
                fontSize: '12px', 
                color: '#A16207', 
                marginTop: '4px',
                fontStyle: 'italic'
              }}>
                Estos tipos están relacionados con préstamos y no se consideran gastos operativos
              </Box>
            </Box>

            {showFilters && (
              <Box css={{ 
                borderTop: '1px solid #e2e8f0', 
                paddingTop: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px'
              }}>
                <Box>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    <FaRoute style={{ marginRight: '6px' }} />
                    Rutas ({selectedRoutes.length} de {allRoutes.length})
                  </label>
                  <Box css={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px' }}>
                    {allRoutes.map(route => (
                      <label key={route.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={selectedRoutes.includes(route.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoutes([...selectedRoutes, route.id]);
                            } else {
                              setSelectedRoutes(selectedRoutes.filter(id => id !== route.id));
                            }
                          }}
                          style={{ margin: 0 }}
                        />
                        {route.name}
                      </label>
                    ))}
                  </Box>
                </Box>

                <Box>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    <FaMoneyBillWave style={{ marginRight: '6px' }} />
                    Tipos de Gasto
                  </label>
                  <Box css={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px' }}>
                    {expenseTypes.map(type => (
                      <label key={type.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={selectedExpenseTypes.includes(type.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedExpenseTypes([...selectedExpenseTypes, type.value]);
                            } else {
                              setSelectedExpenseTypes(selectedExpenseTypes.filter(t => t !== type.value));
                            }
                          }}
                          style={{ margin: 0 }}
                        />
                        {type.label}
                      </label>
                    ))}
                  </Box>
                </Box>

                <Box>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Tipos de Cuenta
                  </label>
                  <Box css={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px' }}>
                    {accountTypes.map(type => (
                      <label key={type.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={selectedAccountTypes.includes(type.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAccountTypes([...selectedAccountTypes, type.value]);
                            } else {
                              setSelectedAccountTypes(selectedAccountTypes.filter(t => t !== type.value));
                            }
                          }}
                          style={{ margin: 0 }}
                        />
                        {type.label}
                      </label>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}
          </Box>

          {/* KPIs */}
          <Box css={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '24px', 
            marginBottom: '24px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0'
          }}>
            <Box css={{ fontSize: '20px', fontWeight: '600', color: '#1a202c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaChartBar />
              Resumen de Gastos del Mes
            </Box>

            {/* KPIs principales */}
            <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <Box css={{ 
                backgroundColor: '#f0f9ff', 
                padding: '16px', 
                borderRadius: '8px', 
                border: '1px solid #bae6fd',
                textAlign: 'center'
              }}>
                <Box css={{ fontSize: '24px', fontWeight: '700', color: '#0369a1', marginBottom: '4px' }}>
                  {kpiData.totalCount}
                </Box>
                <Box css={{ fontSize: '14px', color: '#0c4a6e', fontWeight: '500' }}>
                  Total Gastos
                </Box>
              </Box>

              <Box css={{ 
                backgroundColor: '#f0fdf4', 
                padding: '16px', 
                borderRadius: '8px', 
                border: '1px solid #bbf7d0',
                textAlign: 'center'
              }}>
                <Box css={{ fontSize: '24px', fontWeight: '700', color: '#166534', marginBottom: '4px' }}>
                  {formatCurrency(kpiData.totalExpenses)}
                </Box>
                <Box css={{ fontSize: '14px', color: '#14532d', fontWeight: '500' }}>
                  Monto Total
                </Box>
              </Box>

              <Box css={{ 
                backgroundColor: '#fef3c7', 
                padding: '16px', 
                borderRadius: '8px', 
                border: '1px solid #fde68a',
                textAlign: 'center'
              }}>
                <Box css={{ fontSize: '24px', fontWeight: '700', color: '#92400e', marginBottom: '4px' }}>
                  {formatCurrency(kpiData.totalExpenses / Math.max(kpiData.totalCount, 1))}
                </Box>
                <Box css={{ fontSize: '14px', color: '#a16207', fontWeight: '500' }}>
                  Promedio por Gasto
                </Box>
              </Box>
            </Box>

            {/* KPIs por tipo de gasto */}
            <Box css={{ marginBottom: '24px' }}>
              <Box css={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                Por Tipo de Gasto
              </Box>
              <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {Object.entries(kpiData.byExpenseType)
                  .sort(([,a], [,b]) => b.total - a.total)
                  .slice(0, 8)
                  .map(([type, data]) => (
                    <Box key={type} css={{ 
                      backgroundColor: '#f9fafb', 
                      padding: '12px', 
                      borderRadius: '6px', 
                      border: '1px solid #e5e7eb'
                    }}>
                      <Box css={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                        {getExpenseTypeLabel(type)}
                      </Box>
                      <Box css={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                        {formatCurrency(data.total)}
                      </Box>
                      <Box css={{ fontSize: '11px', color: '#9ca3af' }}>
                        {data.count} gastos
                      </Box>
                    </Box>
                  ))}
              </Box>
            </Box>

            {/* KPIs por tipo de cuenta */}
            <Box css={{ marginBottom: '24px' }}>
              <Box css={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                Por Tipo de Cuenta
              </Box>
              <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {Object.entries(kpiData.byAccountType)
                  .sort(([,a], [,b]) => b.total - a.total)
                  .map(([type, data]) => (
                    <Box key={type} css={{ 
                      backgroundColor: '#f9fafb', 
                      padding: '12px', 
                      borderRadius: '6px', 
                      border: '1px solid #e5e7eb'
                    }}>
                      <Box css={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                        {getAccountTypeLabel(type)}
                      </Box>
                      <Box css={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                        {formatCurrency(data.total)}
                      </Box>
                      <Box css={{ fontSize: '11px', color: '#9ca3af' }}>
                        {data.count} gastos
                      </Box>
                    </Box>
                  ))}
              </Box>
            </Box>

            {/* KPIs por ruta */}
            <Box>
              <Box css={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                Por Ruta
              </Box>
              <Box css={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {Object.entries(kpiData.byRoute)
                  .sort(([,a], [,b]) => b.total - a.total)
                  .slice(0, 10)
                  .map(([route, data]) => (
                    <Box key={route} css={{ 
                      backgroundColor: '#f9fafb', 
                      padding: '12px', 
                      borderRadius: '6px', 
                      border: '1px solid #e5e7eb'
                    }}>
                      <Box css={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                        {route}
                      </Box>
                      <Box css={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' }}>
                        {formatCurrency(data.total)}
                      </Box>
                      <Box css={{ fontSize: '11px', color: '#9ca3af' }}>
                        {data.count} gastos
                      </Box>
                    </Box>
                  ))}
              </Box>
            </Box>
          </Box>

          {/* Tabla de gastos */}
          <Box css={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            padding: '24px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0'
          }}>
            <Box css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <Box css={{ fontSize: '18px', fontWeight: '600', color: '#1a202c' }}>
                Lista de Gastos ({filteredAndSortedTransactions.length})
              </Box>
              <Button
                tone="active"
                onClick={() => {
                  // TODO: Implementar exportación
                  console.log('Exportar gastos');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FaDownload />
                Exportar
              </Button>
            </Box>

            <Box css={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th 
                      style={{ ...tableHeaderStyle, cursor: 'pointer' }}
                      onClick={() => handleSort('date')}
                    >
                      <Box css={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Fecha {getSortIcon('date')}
                      </Box>
                    </th>
                    <th 
                      style={{ ...tableHeaderStyle, cursor: 'pointer' }}
                      onClick={() => handleSort('expenseSource')}
                    >
                      <Box css={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Tipo {getSortIcon('expenseSource')}
                      </Box>
                    </th>
                    <th 
                      style={{ ...tableHeaderStyle, cursor: 'pointer' }}
                      onClick={() => handleSort('amount')}
                    >
                      <Box css={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Monto {getSortIcon('amount')}
                      </Box>
                    </th>
                    <th style={tableHeaderStyle}>Descripción</th>
                    <th 
                      style={{ ...tableHeaderStyle, cursor: 'pointer' }}
                      onClick={() => handleSort('route')}
                    >
                      <Box css={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Ruta {getSortIcon('route')}
                      </Box>
                    </th>
                    <th 
                      style={{ ...tableHeaderStyle, cursor: 'pointer' }}
                      onClick={() => handleSort('lead')}
                    >
                      <Box css={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Líder {getSortIcon('lead')}
                      </Box>
                    </th>
                    <th style={tableHeaderStyle}>Cuenta</th>
                    <th style={tableHeaderStyle}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedTransactions.map((transaction) => (
                    <tr key={transaction.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={tableCellStyle}>
                        {formatDate(transaction.date)}
                      </td>
                      <td style={tableCellStyle}>
                        <Box css={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {transaction.expenseGroupId && (
                            <span style={{ 
                              fontSize: '10px', 
                              backgroundColor: '#dbeafe', 
                              color: '#1e40af', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontWeight: '500'
                            }}>
                              DIST
                            </span>
                          )}
                          {getExpenseTypeLabel(transaction.expenseSource)}
                        </Box>
                      </td>
                      <td style={{ ...tableCellStyle, fontWeight: '600', color: '#dc2626' }}>
                        {formatCurrency(parseFloat(transaction.amount))}
                      </td>
                      <td style={tableCellStyle}>
                        {transaction.description || '-'}
                      </td>
                      <td style={tableCellStyle}>
                        {transaction.route?.name || transaction.sourceAccount?.routes?.[0]?.name || '-'}
                      </td>
                      <td style={tableCellStyle}>
                        {transaction.lead?.personalData?.fullName || '-'}
                      </td>
                      <td style={tableCellStyle}>
                        <Box css={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {transaction.sourceAccount?.type === 'PREPAID_GAS' && (
                            <span style={{ 
                              fontSize: '10px', 
                              backgroundColor: '#fef3c7', 
                              color: '#92400e', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontWeight: '500'
                            }}>
                              GAS
                            </span>
                          )}
                          {transaction.sourceAccount?.type === 'BANK' && (
                            <span style={{ 
                              fontSize: '10px', 
                              backgroundColor: '#eff6ff', 
                              color: '#1e40af', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontWeight: '500'
                            }}>
                              BANCO
                            </span>
                          )}
                          {transaction.sourceAccount?.name || '-'}
                        </Box>
                      </td>
                      <td style={tableCellStyle}>
                        <Box css={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Box css={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: '#10b981' 
                          }} />
                          <span style={{ fontSize: '12px', color: '#059669' }}>Activo</span>
                        </Box>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>

            {filteredAndSortedTransactions.length === 0 && (
              <Box css={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: '#6b7280',
                fontSize: '14px'
              }}>
                No se encontraron gastos con los filtros aplicados
              </Box>
            )}
          </Box>
        </Box>
      </PageContainer>
    </ProtectedRoute>
  );
};

// Estilos
const tableHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#374151',
  fontSize: '12px',
  whiteSpace: 'nowrap',
  minWidth: '100px'
};

const tableCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: '#1f2937',
  fontSize: '13px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

export default AdministrarGastosPage;
