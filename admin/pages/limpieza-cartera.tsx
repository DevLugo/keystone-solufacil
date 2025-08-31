import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Select, TextInput, DatePicker } from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { gql } from '@apollo/client';
import { FaTrash, FaSave, FaFilter, FaCheck } from 'react-icons/fa';
import ProtectedRoute from '../components/ProtectedRoute';

// Query para obtener rutas
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;

// Query para obtener préstamos de una ruta (optimizada)
const GET_LOANS_FOR_CLEANUP = gql`
  query GetLoansForCleanup($routeId: ID!) {
    loans(where: { lead: { routes: { id: { equals: $routeId } } } }) {
      id
      requestedAmount
      amountGived
      signDate
      finishedDate
      status
      borrower {
        personalData {
          fullName
        }
      }
      lead {
        personalData {
          fullName
        }
      }
      excludedByCleanup {
        id
        name
        cleanupDate
      }
    }
  }
`;

// Preview limpieza masiva (OPTIMIZADO - solo conteo y monto total)
const PREVIEW_BULK_CLEANUP = gql`
  query PreviewBulkPortfolioCleanup($routeId: String!, $fromDate: String!, $toDate: String!, $weeksWithoutPaymentThreshold: Int) {
    previewBulkPortfolioCleanup(routeId: $routeId, fromDate: $fromDate, toDate: $toDate, weeksWithoutPaymentThreshold: $weeksWithoutPaymentThreshold)
  }
`;

// Mutation para crear limpieza de cartera (solo guarda fromDate/toDate)
const CREATE_PORTFOLIO_CLEANUP = gql`
  mutation CreatePortfolioCleanup(
    $name: String!
    $description: String
    $cleanupDate: String!
    $routeId: String!
    $fromDate: String
    $toDate: String
    $excludedLoanIds: [String!]!
  ) {
    createPortfolioCleanupAndExcludeLoans(
      name: $name
      description: $description
      cleanupDate: $cleanupDate
      routeId: $routeId
      fromDate: $fromDate
      toDate: $toDate
      excludedLoanIds: $excludedLoanIds
    )
  }
`;

// Mutation para limpieza masiva por fechas
const CREATE_BULK_PORTFOLIO_CLEANUP = gql`
  mutation CreateBulkPortfolioCleanup(
    $name: String!
    $description: String
    $cleanupDate: String!
    $routeId: String!
    $fromDate: String!
    $toDate: String!
    $weeksWithoutPaymentThreshold: Int
  ) {
    createBulkPortfolioCleanup(
      name: $name
      description: $description
      cleanupDate: $cleanupDate
      routeId: $routeId
      fromDate: $fromDate
      toDate: $toDate
      weeksWithoutPaymentThreshold: $weeksWithoutPaymentThreshold
    )
  }
`;

interface Loan {
  id: string;
  requestedAmount: number;
  amountGived: number;
  signDate: string;
  finishedDate?: string;
  status: string;
  borrower?: {
    personalData: {
      fullName: string;
    };
  };
  lead?: {
    personalData: {
      fullName: string;
    };
  };
  excludedByCleanup?: {
    id: string;
    name: string;
    cleanupDate: string;
  };
}

const styles = {
  container: {
    padding: '32px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh'
  },
  header: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '32px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '24px',
  },
  filtersRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    backgroundColor: '#f8fafc',
    padding: '12px 16px',
    textAlign: 'left' as const,
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    borderBottom: '1px solid #f3f4f6',
  },
  checkbox: {
    margin: 0,
    cursor: 'pointer',
  },
  selectedRow: {
    backgroundColor: '#fef3c7',
  },
  excludedRow: {
    backgroundColor: '#fee2e2',
    opacity: 0.6,
  },
  actionButtons: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export default function LimpiezaCarteraPage() {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [selectedLoans, setSelectedLoans] = useState<Set<string>>(new Set());
  const [showCleanupForm, setShowCleanupForm] = useState(false);
  const [showBulkCleanupForm, setShowBulkCleanupForm] = useState(false);
  const [cleanupForm, setCleanupForm] = useState({
    name: '',
    description: ''
  });
  const [bulkCleanupForm, setBulkCleanupForm] = useState({
    name: '',
    description: '',
    fromDate: '',
    toDate: '',
    cleanupDate: new Date().toISOString().split('T')[0], // Fecha de creación por defecto
    weeksWithoutPaymentThreshold: 0,
    includeAll: true,
  });
  const [preview, setPreview] = useState<{count: number; totalAmount: number}|null>(null);

  // Query para obtener rutas
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);

  // Query para obtener préstamos
  const { data: loansData, loading: loansLoading, refetch: refetchLoans } = useQuery(GET_LOANS_FOR_CLEANUP, {
    variables: { routeId: selectedRoute },
    skip: !selectedRoute,
  });

  // Lazy query para previsualización
  const [runPreview, { loading: previewLoading }] = useLazyQuery(PREVIEW_BULK_CLEANUP, {
    fetchPolicy: 'no-cache',
    onCompleted: (data) => {
      const res = data?.previewBulkPortfolioCleanup;
      if (res?.success) {
        setPreview({ count: res.count, totalAmount: res.totalAmount });
      } else {
        setPreview({ count: 0, totalAmount: 0 });
      }
    }
  });

  // Mutation para crear limpieza
  const [createCleanup, { loading: creatingCleanup }] = useMutation(CREATE_PORTFOLIO_CLEANUP);
  
  // Mutation para limpieza masiva
  const [createBulkCleanup, { loading: creatingBulkCleanup }] = useMutation(CREATE_BULK_PORTFOLIO_CLEANUP);

  const routeOptions = routesData?.routes?.map((route: any) => ({
    label: route.name,
    value: route.id,
  })) || [];

  const loans: Loan[] = loansData?.loans || [];

  // Filtrar préstamos que ya están excluidos
  const availableLoans = loans.filter(loan => !loan.excludedByCleanup);
  const excludedLoans = loans.filter(loan => loan.excludedByCleanup);

  const handleSelectAll = () => {
    const allIds = new Set(availableLoans.map(loan => loan.id));
    setSelectedLoans(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedLoans(new Set());
  };

  const handleToggleLoan = (loanId: string) => {
    const newSelected = new Set(selectedLoans);
    if (newSelected.has(loanId)) {
      newSelected.delete(loanId);
    } else {
      newSelected.add(loanId);
    }
    setSelectedLoans(newSelected);
  };

  const handlePreview = async () => {
    if (!selectedRoute || !bulkCleanupForm.fromDate || !bulkCleanupForm.toDate) {
      setPreview(null);
      return;
    }
    const threshold = bulkCleanupForm.includeAll ? 0 : (bulkCleanupForm.weeksWithoutPaymentThreshold || 0);
    await runPreview({ 
      variables: { 
        routeId: selectedRoute, 
        fromDate: bulkCleanupForm.fromDate, 
        toDate: bulkCleanupForm.toDate, 
        weeksWithoutPaymentThreshold: threshold 
      } 
    });
  };

  useEffect(() => {
    handlePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoute, bulkCleanupForm.fromDate, bulkCleanupForm.toDate, bulkCleanupForm.weeksWithoutPaymentThreshold, bulkCleanupForm.includeAll]);

  const handleCreateCleanup = async () => {
    if (selectedLoans.size === 0) {
      alert('Debes seleccionar al menos un préstamo');
      return;
    }

    if (!cleanupForm.name.trim()) {
      alert('Debes ingresar un nombre para la limpieza');
      return;
    }

    try {
      await createCleanup({
        variables: {
          name: cleanupForm.name,
          description: cleanupForm.description,
          cleanupDate: new Date().toISOString(),
          routeId: selectedRoute,
          fromDate: null,
          toDate: null,
          excludedLoanIds: Array.from(selectedLoans),
        }
      });

      // Limpiar formulario y selección
      setCleanupForm({
        name: '',
        description: ''
      });
      setSelectedLoans(new Set());
      setShowCleanupForm(false);

      // Refrescar datos
      await refetchLoans();

      alert('Limpieza de cartera creada exitosamente');
    } catch (error) {
      console.error('Error creating cleanup:', error);
      alert('Error al crear la limpieza de cartera');
    }
  };

  const handleCreateBulkCleanup = async () => {
    if (!bulkCleanupForm.name.trim()) {
      alert('Debes ingresar un nombre para la limpieza');
      return;
    }

    if (!bulkCleanupForm.fromDate || !bulkCleanupForm.toDate) {
      alert('Debes especificar las fechas de inicio y fin');
      return;
    }

    if (new Date(bulkCleanupForm.fromDate) > new Date(bulkCleanupForm.toDate)) {
      alert('La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }

    try {
      const threshold = bulkCleanupForm.includeAll ? 0 : (bulkCleanupForm.weeksWithoutPaymentThreshold || 0);
      const result = await createBulkCleanup({
        variables: {
          name: bulkCleanupForm.name,
          description: bulkCleanupForm.description,
          cleanupDate: bulkCleanupForm.cleanupDate,
          routeId: selectedRoute,
          fromDate: bulkCleanupForm.fromDate,
          toDate: bulkCleanupForm.toDate,
          weeksWithoutPaymentThreshold: threshold,
        }
      });

      if (result.data?.createBulkPortfolioCleanup?.success) {
        // Limpiar formulario
        setBulkCleanupForm({
          name: '',
          description: '',
          fromDate: '',
          toDate: '',
          cleanupDate: new Date().toISOString().split('T')[0],
          weeksWithoutPaymentThreshold: 0,
          includeAll: true,
        });
        setShowBulkCleanupForm(false);

        // Refrescar datos
        await refetchLoans();

        alert(result.data.createBulkPortfolioCleanup.message);
      } else {
        alert(result.data?.createBulkPortfolioCleanup?.message || 'No se encontraron préstamos para excluir');
      }
    } catch (error) {
      console.error('Error creating bulk cleanup:', error);
      alert('Error al crear la limpieza masiva de cartera');
    }
  };

  const totalSelectedAmount = availableLoans
    .filter(loan => selectedLoans.has(loan.id))
    .reduce((sum, loan) => sum + loan.amountGived, 0);

  if (routesLoading) {
    return <LoadingDots label="Cargando rutas..." />;
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <PageContainer header="🧹 Limpieza de Cartera">
        <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Limpieza de Cartera</h1>
          <p style={styles.subtitle}>
            Selecciona préstamos para excluirlos de los reportes de cartera
          </p>

          {/* Filtros */}
          <div style={styles.filtersRow}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Ruta
              </label>
              <Select
                value={routeOptions.find((opt: any) => opt.value === selectedRoute) || null}
                options={routeOptions}
                onChange={(option: any) => setSelectedRoute(option?.value || '')}
                placeholder="Seleccionar ruta..."
              />
            </div>
          </div>

          {/* Resumen */}
          {selectedRoute && (
            <div style={styles.summaryCard}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    Préstamos Disponibles
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600' }}>
                    {availableLoans.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    Ya Excluidos
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#dc2626' }}>
                    {excludedLoans.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    Seleccionados
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#059669' }}>
                    {selectedLoans.size}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    Monto Seleccionado
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#059669' }}>
                    {formatCurrency(totalSelectedAmount)}
                  </div>
                </div>
              </div>

              <div style={styles.actionButtons}>
                {selectedLoans.size > 0 && (
                  <>
                    <Button
                      tone="active"
                      onClick={() => setShowCleanupForm(true)}
                      isLoading={creatingCleanup}
                    >
                      <FaSave /> Limpieza Manual
                    </Button>
                    <Button
                      tone="passive"
                      onClick={handleDeselectAll}
                    >
                      <FaTrash /> Deseleccionar Todo
                    </Button>
                  </>
                )}
                <Button
                  tone="active"
                  onClick={() => setShowBulkCleanupForm(true)}
                  isLoading={creatingBulkCleanup}
                >
                  <FaFilter /> Limpieza Masiva por Fechas
                </Button>
                <Button
                  tone="passive"
                  onClick={() => refetchLoans()}
                  disabled={loansLoading}
                >
                  🔄 Refrescar Datos
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Formulario de Limpieza Manual */}
        {showCleanupForm && (
          <div style={styles.summaryCard}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
              Limpieza Manual de Cartera
            </h3>
            
            <div style={styles.formGrid}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Nombre de la Limpieza *
                </label>
                <TextInput
                  value={cleanupForm.name}
                  onChange={(e) => setCleanupForm({ ...cleanupForm, name: e.target.value })}
                  placeholder="Ej: Limpieza Q1 2024 - Cartera Antigua"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Descripción
                </label>
                <TextInput
                  value={cleanupForm.description}
                  onChange={(e) => setCleanupForm({ ...cleanupForm, description: e.target.value })}
                  placeholder="Descripción opcional de la limpieza"
                />
              </div>
            </div>

            <div style={{ 
              padding: '16px', 
              backgroundColor: '#fef3c7', 
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                Resumen de la Limpieza Manual:
              </div>
              <div style={{ fontSize: '13px', color: '#92400e' }}>
                • {selectedLoans.size} préstamos serán excluidos
                <br />
                • Monto total: {formatCurrency(totalSelectedAmount)}
              </div>
            </div>

            <div style={styles.actionButtons}>
              <Button
                tone="active"
                onClick={handleCreateCleanup}
                isLoading={creatingCleanup}
              >
                <FaCheck /> Confirmar Limpieza Manual
              </Button>
              <Button
                tone="passive"
                onClick={() => setShowCleanupForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Formulario de Limpieza Masiva */}
        {showBulkCleanupForm && (
          <div style={styles.summaryCard}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
              Limpieza Masiva por Fechas
            </h3>
            
            <div style={styles.formGrid}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Nombre de la Limpieza *
                </label>
                <TextInput
                  value={bulkCleanupForm.name}
                  onChange={(e) => setBulkCleanupForm({ ...bulkCleanupForm, name: e.target.value })}
                  placeholder="Ej: Limpieza Enero 2025 - CV Antiguos"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Descripción
                </label>
                <TextInput
                  value={bulkCleanupForm.description}
                  onChange={(e) => setBulkCleanupForm({ ...bulkCleanupForm, description: e.target.value })}
                  placeholder="Descripción opcional de la limpieza"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  value={bulkCleanupForm.fromDate}
                  onChange={(e) => setBulkCleanupForm({ ...bulkCleanupForm, fromDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Fecha de Fin *
                </label>
                <input
                  type="date"
                  value={bulkCleanupForm.toDate}
                  onChange={(e) => setBulkCleanupForm({ ...bulkCleanupForm, toDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Fecha de Creación *
                </label>
                <input
                  type="date"
                  value={bulkCleanupForm.cleanupDate}
                  onChange={(e) => setBulkCleanupForm({ ...bulkCleanupForm, cleanupDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Incluir todos (ignorar semanas sin pago)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={bulkCleanupForm.includeAll}
                    onChange={(e) => setBulkCleanupForm({ ...bulkCleanupForm, includeAll: e.target.checked })}
                  />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    Si está activo, se listan todos los préstamos activos firmados entre las fechas.
                  </span>
                </div>
              </div>

              {!bulkCleanupForm.includeAll && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    Semanas sin pago (umbral) — opcional
                  </label>
                  <TextInput
                    type="number"
                    min={0}
                    value={String(bulkCleanupForm.weeksWithoutPaymentThreshold ?? 0)}
                    onChange={(e) => setBulkCleanupForm({ ...bulkCleanupForm, weeksWithoutPaymentThreshold: Number(e.target.value || 0) })}
                    placeholder="0 = ignorar"
                  />
                </div>
              )}
            </div>

            {/* Preview */}
            <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Previsualización</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {previewLoading ? 'Calculando...' : `Préstamos a excluir: ${preview?.count || 0} — Monto total: ${formatCurrency(preview?.totalAmount || 0)}`}
                  </div>
                </div>
                <Button tone="active" onClick={handlePreview} disabled={!selectedRoute || !bulkCleanupForm.fromDate || !bulkCleanupForm.toDate}>
                  Buscar
                </Button>
              </div>
              {preview && preview.count > 0 && (
                <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#ecfdf5', borderRadius: '6px', fontSize: 12, color: '#065f46' }}>
                  ✅ Se encontraron {preview.count} préstamos que cumplen con los criterios de limpieza.
                  <br />
                  💰 Monto total a excluir: {formatCurrency(preview.totalAmount)}
                </div>
              )}
            </div>

            <div style={styles.actionButtons}>
              <Button
                tone="active"
                onClick={handleCreateBulkCleanup}
                isLoading={creatingBulkCleanup}
                disabled={!preview || preview.count === 0}
              >
                <FaCheck /> Ejecutar Limpieza Masiva
              </Button>
              <Button
                tone="passive"
                onClick={() => setShowBulkCleanupForm(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Tabla de Préstamos */}
        {selectedRoute && (
          <div style={styles.tableContainer}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                  Préstamos de la Ruta
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    size="small"
                    tone="passive"
                    onClick={handleSelectAll}
                  >
                    Seleccionar Todo
                  </Button>
                  <Button
                    size="small"
                    tone="passive"
                    onClick={handleDeselectAll}
                  >
                    Deseleccionar Todo
                  </Button>
                </div>
              </div>
            </div>

            {loansLoading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <LoadingDots label="Cargando préstamos..." />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>
                        <input
                          type="checkbox"
                          checked={selectedLoans.size === availableLoans.length && availableLoans.length > 0}
                          onChange={selectedLoans.size === availableLoans.length ? handleDeselectAll : handleSelectAll}
                          style={styles.checkbox}
                        />
                      </th>
                      <th style={styles.th}>Cliente</th>
                      <th style={styles.th}>Líder</th>
                      <th style={styles.th}>Monto</th>
                      <th style={styles.th}>Fecha</th>
                      <th style={styles.th}>Estado</th>
                      <th style={styles.th}>Excluido por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => (
                      <tr 
                        key={loan.id} 
                        style={{
                          ...styles.td,
                          ...(selectedLoans.has(loan.id) ? styles.selectedRow : {}),
                          ...(loan.excludedByCleanup ? styles.excludedRow : {})
                        }}
                      >
                        <td style={styles.td}>
                          {!loan.excludedByCleanup && (
                            <input
                              type="checkbox"
                              checked={selectedLoans.has(loan.id)}
                              onChange={() => handleToggleLoan(loan.id)}
                              style={styles.checkbox}
                            />
                          )}
                        </td>
                        <td style={styles.td}>
                          {loan.borrower?.personalData?.fullName || 'N/A'}
                        </td>
                        <td style={styles.td}>
                          {loan.lead?.personalData?.fullName || 'N/A'}
                        </td>
                        <td style={styles.td}>
                          {formatCurrency(loan.amountGived)}
                        </td>
                        <td style={styles.td}>
                          {formatDate(loan.signDate)}
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            backgroundColor: loan.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                            color: loan.status === 'ACTIVE' ? '#166534' : '#dc2626'
                          }}>
                            {loan.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {loan.excludedByCleanup ? (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '500' }}>
                                {loan.excludedByCleanup.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                {formatDate(loan.excludedByCleanup.cleanupDate)}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>Disponible</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
    </ProtectedRoute>
  );
} 