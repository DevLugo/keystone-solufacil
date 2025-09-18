/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Box, jsx, Stack, Text, Heading } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput, Select } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { AlertDialog } from '@keystone-ui/modals';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { FaFilter, FaSearch, FaCheck, FaTimes, FaExclamationTriangle } from 'react-icons/fa';

// Consulta personalizada para cartera muerta
const GET_LOANS_FOR_CARTERA_MUERTA = gql`
  query GetLoansForCarteraMuerta($routeId: ID, $weeksWithoutPayment: Int, $weeksSinceCreation: Int, $analysisDate: String) {
    loansForCarteraMuerta(routeId: $routeId, weeksWithoutPayment: $weeksWithoutPayment, weeksSinceCreation: $weeksSinceCreation, analysisDate: $analysisDate)
  }
`;

const GET_ROUTES_QUERY = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;


const UPDATE_LOAN_MUTATION = gql`
  mutation UpdateLoan($id: ID!, $data: LoanUpdateInput!) {
    updateLoan(id: $id, data: $data) {
      id
      badDebtDate
    }
  }
`;

interface Loan {
  id: string;
  oldId: string | null;
  requestedAmount: any;
  amountGived: any;
  signDate: string;
  badDebtDate: string | null;
  pendingAmountStored: any;
  borrower: {
    id: string;
    fullName?: string | null;
    personalData: {
      fullName?: string | null;
      phones: Array<{ number: string }>; 
      addresses: Array<{
        street: string;
        exteriorNumber: string;
        interiorNumber: string;
        location: {
          name: string;
          municipality: {
            state: {
              name: string;
            };
          } | null;
        };
      }>;
    } | null;
  } | null;
  lead: {
    id: string;
    personalData: {
      fullName?: string | null;
      addresses: Array<{
        location: {
          name: string;
          municipality: {
            state: {
              name: string;
            };
          } | null;
        };
      }>;
    } | null;
    routes: {
      id: string;
      name: string;
    } | null;
  } | null;
  loantype: {
    id: string;
    name: string;
    weekDuration: number | null;
    rate: any;
  } | null;
  payments: Array<{
    id: string;
    amount: any;
    receivedAt: string;
    createdAt: string;
  }>;
  previousLoan: {
    id: string;
  } | null;
}

interface Route {
  id: string;
  name: string;
}

const msPerWeek = 7 * 24 * 60 * 60 * 1000;
const getMonday = (dateInput: string | Date) => {
  const d = new Date(dateInput);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1); // Monday as start
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};
const weeksBetweenMondays = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / msPerWeek);

const CarteraMuerta2Page: React.FC = () => {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [weeksWithoutPayment, setWeeksWithoutPayment] = useState<number>(2);
  const [weeksSinceCreation, setWeeksSinceCreation] = useState<number>(4);
  const [analysisDate, setAnalysisDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Consulta para obtener rutas
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES_QUERY);

  // Consulta para obtener préstamos de cartera muerta
  const { data: loansData, loading: loansLoading, refetch } = useQuery(GET_LOANS_FOR_CARTERA_MUERTA, {
    variables: {
      routeId: selectedRoute || null,
      weeksWithoutPayment,
      weeksSinceCreation,
      analysisDate
    }
  });

  // Mutación para actualizar préstamos
  const [updateLoan] = useMutation(UPDATE_LOAN_MUTATION);

  // Refetch cuando cambien los filtros
  React.useEffect(() => {
    refetch();
  }, [selectedRoute, weeksWithoutPayment, weeksSinceCreation, analysisDate, refetch]);

  // Los préstamos ya vienen filtrados desde el backend
  const potentialDeadDebtLoans = loansData?.loansForCarteraMuerta || [];

  const handleSelectLoan = (loanId: string) => {
    setSelectedLoans(prev => 
      prev.includes(loanId) 
        ? prev.filter(id => id !== loanId)
        : [...prev, loanId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLoans.length === potentialDeadDebtLoans.length) {
      setSelectedLoans([]);
    } else {
      setSelectedLoans(potentialDeadDebtLoans.map((loan: Loan) => loan.id));
    }
  };

  const handleMarkAsDeadDebt = async () => {
    if (selectedLoans.length === 0) return;

    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await Promise.all(
        selectedLoans.map(loanId =>
          updateLoan({
            variables: {
              id: loanId,
              data: {
                badDebtDate: today
              }
            }
          })
        )
      );
      await refetch();
      setSelectedLoans([]);
      setShowConfirmModal(false);
      alert(`Se marcaron ${selectedLoans.length} préstamos como cartera muerta`);
    } catch (error) {
      console.error('Error al marcar préstamos como cartera muerta:', error);
      alert('Error al marcar préstamos como cartera muerta');
    } finally {
      setIsLoading(false);
    }
  };

  const getLastPaymentDate = (loan: Loan) => {
    if (!loan.payments || loan.payments.length === 0) {
      return 'Sin pagos';
    }
    const lastPayment = loan.payments.reduce((latest, payment) => {
      return new Date(payment.receivedAt) > new Date(latest.receivedAt) ? payment : latest;
    });
    return format(new Date(lastPayment.receivedAt), 'dd/MM/yyyy', { locale: es });
  };

  const getWeeksSinceCreation = (loan: Loan) => {
    const analysisMonday = getMonday(analysisDate);
    const signMonday = getMonday(loan.signDate);
    return weeksBetweenMondays(analysisMonday, signMonday);
  };

  const getWeeksWithoutPayment = (loan: Loan) => {
    const analysisMonday = getMonday(analysisDate);
    const lastActivityDate = loan.payments && loan.payments.length > 0
      ? loan.payments.reduce((latest, payment) => new Date(payment.receivedAt) > new Date(latest.receivedAt) ? payment : latest).receivedAt
      : loan.signDate;
    const lastActivityMonday = getMonday(lastActivityDate);
    return weeksBetweenMondays(analysisMonday, lastActivityMonday);
  };

  // Suma correcta con coerción numérica
  const totalAmount = potentialDeadDebtLoans.reduce((sum: number, loan: Loan) => sum + Number(loan.amountGived || 0), 0);
  // Total de deuda pendiente y resumen por localidad
  const totalPending = potentialDeadDebtLoans.reduce((sum: number, loan: Loan) => sum + Number(loan.pendingAmountStored || 0), 0);
  const [showSummaryDetails, setShowSummaryDetails] = useState<boolean>(false);
  const summaryByLocality = React.useMemo(() => {
    const map = new Map<string, { count: number; pending: number }>();
    for (const loan of potentialDeadDebtLoans as Loan[]) {
      const loc = loan.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
      const key = loc;
      const prev = map.get(key) || { count: 0, pending: 0 };
      prev.count += 1;
      prev.pending += Number(loan.pendingAmountStored || 0);
      map.set(key, prev);
    }
    return Array.from(map.entries()).map(([locality, data]) => ({ locality, ...data }));
  }, [potentialDeadDebtLoans]);

  const copyWhatsAppSummary = () => {
    const lines: string[] = [];
    lines.push(`Cartera muerta (${analysisDate})`);
    lines.push(`Ruta: ${routesData?.routes?.find((r: Route) => r.id === selectedRoute)?.name || 'Todas'}`);
    lines.push(`Préstamos: ${potentialDeadDebtLoans.length}`);
    lines.push(`Deuda pendiente total: $${totalPending.toLocaleString()}`);
    lines.push('');
    lines.push('Por localidad:');
    for (const row of summaryByLocality) {
      lines.push(`- ${row.locality}: ${row.count} | $${row.pending.toLocaleString()}`);
    }
    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => alert('Resumen copiado para WhatsApp'));  
  };

  return (
    <PageContainer header="💀 Cartera Muerta 2">
      <Stack gap="large">
        {/* Filtros */}
        <Box padding="large" background="neutral" borderRadius="medium">
          <Stack gap="medium">
            <Heading type="h3">Filtros</Heading>
            <Stack gap="medium" across>
              <Box width="medium">
                <Text weight="medium" marginBottom="small">
                  Ruta
                </Text>
                <Select
                  value={routesData?.routes?.find((route: Route) => route.id === selectedRoute) || null}
                  options={routesData?.routes?.map((route: Route) => ({
                    label: route.name,
                    value: route.id
                  })) || []}
                  onChange={(option: any) => setSelectedRoute(option?.value || '')}
                  placeholder="Seleccionar ruta..."
                  isLoading={routesLoading}
                />
              </Box>

              <Box width="small">
                <Text weight="medium" marginBottom="small">
                  Semanas sin Pago
                </Text>
                <TextInput
                  type="number"
                  value={weeksWithoutPayment.toString()}
                  onChange={(e) => setWeeksWithoutPayment(parseInt(e.target.value) || 2)}
                  min="1"
                  max="52"
                />
              </Box>

              <Box width="small">
                <Text weight="medium" marginBottom="small">
                  Semanas desde Creación
                </Text>
                <TextInput
                  type="number"
                  value={weeksSinceCreation.toString()}
                  onChange={(e) => setWeeksSinceCreation(parseInt(e.target.value) || 4)}
                  min="1"
                  max="52"
                />
              </Box>

              <Box width="small">
                <Text weight="medium" marginBottom="small">
                  Fecha de análisis
                </Text>
                <TextInput
                  type="date"
                  value={analysisDate}
                  onChange={(e) => setAnalysisDate(e.target.value)}
                />
              </Box>
            </Stack>
          </Stack>
        </Box>

        {/* Resumen */}
        {potentialDeadDebtLoans.length > 0 && (
          <Box padding="large" background="accent" borderRadius="medium">
            <Stack gap="medium">
              <Heading type="h3">Resumen</Heading>
              <Stack gap="medium" across>
                <Box>
                  <Text size="small" color="neutral600">Préstamos potenciales:</Text>
                  <Text weight="semibold">{potentialDeadDebtLoans.length}</Text>
                </Box>
                <Box>
                  <Text size="small" color="neutral600">Deuda pendiente total:</Text>
                  <Text weight="semibold">${totalPending.toLocaleString()}</Text>
                </Box>
                <Box>
                  <Text size="small" color="neutral600">Seleccionados:</Text>
                  <Text weight="semibold">{selectedLoans.length}</Text>
                </Box>
                <Box>
                  <Button tone="passive" onClick={() => setShowSummaryDetails(!showSummaryDetails)}>
                    {showSummaryDetails ? 'Ocultar detalle' : 'Ver por localidad'}
                  </Button>
                </Box>
                <Box>
                  <Button tone="active" onClick={copyWhatsAppSummary}>Copiar (WhatsApp)</Button>
                </Box>
              </Stack>

              {showSummaryDetails && (
                <Box background="white" borderRadius="medium" padding="medium">
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--neutral600)' }}>Localidad</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--neutral600)' }}>Préstamos</th>
                        <th style={{ padding: '10px 12px', fontSize: 12, color: 'var(--neutral600)' }}>Deuda pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryByLocality.map((row, idx) => (
                        <tr
                          key={row.locality}
                          style={{
                            borderBottom: '1px solid var(--muted)',
                            background: idx % 2 === 0 ? '#F7FAFF' : '#EEF4FF'
                          }}
                        >
                          <td style={{ padding: '10px 12px' }}>{row.locality}</td>
                          <td style={{ padding: '10px 12px' }}>{row.count}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              background: '#E6FFFA',
                              color: '#0F766E',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600
                            }}>
                              ${row.pending.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#FFF7ED' }}>
                        <td style={{ padding: '12px', fontWeight: 700 }}>Total</td>
                        <td style={{ padding: '12px', fontWeight: 700 }}>{potentialDeadDebtLoans.length}</td>
                        <td style={{ padding: '12px', fontWeight: 700 }}>${totalPending.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* Botones de acción */}
        <Stack gap="medium" across>
          <Button
            onClick={() => refetch()}
            isLoading={loansLoading}
            tone="active"
          >
            🔄 Buscar/Actualizar
          </Button>
          
          {potentialDeadDebtLoans.length > 0 && (
            <>
              <Button
                onClick={handleSelectAll}
                tone="passive"
              >
                {selectedLoans.length === potentialDeadDebtLoans.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </Button>
              
              <Button
                onClick={() => setShowConfirmModal(true)}
                disabled={selectedLoans.length === 0}
                tone="negative"
              >
                Marcar como cartera muerta ({selectedLoans.length})
              </Button>
            </>
          )}
        </Stack>

        {/* Tabla de préstamos */}
        {loansLoading ? (
          <Box padding="large" textAlign="center">
            <LoadingDots label="Cargando préstamos..." />
          </Box>
        ) : potentialDeadDebtLoans.length === 0 ? (
          <Box padding="large" textAlign="center">
            <Text color="neutral600">
              {!selectedRoute ? 'Selecciona una ruta para ver los préstamos' : 'No hay préstamos que cumplan los criterios'}
            </Text>
          </Box>
        ) : (
          <Box background="white" borderRadius="medium" overflow="auto">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: 'var(--neutral)', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>
                    <input
                      type="checkbox"
                      checked={selectedLoans.length === potentialDeadDebtLoans.length && potentialDeadDebtLoans.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th style={{ padding: '12px' }}>Cliente</th>
                  <th style={{ padding: '12px' }}>Monto</th>
                  <th style={{ padding: '12px' }}>Deuda Pendiente</th>
                  <th style={{ padding: '12px' }}>Otorgado - Pagado</th>
                  <th style={{ padding: '12px' }}>Último Pago</th>
                  <th style={{ padding: '12px' }}>Semanas sin Pago</th>
                  <th style={{ padding: '12px' }}>Semanas desde Creación</th>
                  <th style={{ padding: '12px' }}>Localidad (Líder)</th>
                  <th style={{ padding: '12px' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {potentialDeadDebtLoans.map((loan: Loan) => {
                  const leaderLocality = loan.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
                  const leaderState = loan.lead?.personalData?.addresses?.[0]?.location?.municipality?.state?.name || '';
                  const fullLocality = leaderState ? `${leaderLocality}, ${leaderState}` : leaderLocality;
                  const isRenewal = loan.previousLoan !== null;
                  const displayName = loan.borrower?.personalData?.fullName || loan.borrower?.fullName || 'Sin nombre';
                  const amountGived = Number(loan.amountGived || 0);
                  const pending = Number(loan.pendingAmountStored || 0);
                  const amountPaid = (loan.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
                  const grantedMinusPaid = amountGived - amountPaid;
                  const weeksNoPay = getWeeksWithoutPayment(loan);
                  const weeksSince = getWeeksSinceCreation(loan);

                  return (
                    <tr key={loan.id} style={{ borderBottom: '1px solid var(--muted)' }}>
                      <td style={{ padding: '12px' }}>
                        <input
                          type="checkbox"
                          checked={selectedLoans.includes(loan.id)}
                          onChange={() => handleSelectLoan(loan.id)}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{displayName}</div>
                        <div style={{ color: 'var(--neutral600)', fontSize: 12 }}>
                          {loan.borrower?.personalData?.phones?.[0]?.number || 'Sin teléfono'}
                        </div>
                        {loan.oldId && (
                          <div style={{ color: 'var(--neutral500)', fontSize: 12 }}>ID: {loan.oldId}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>${amountGived.toLocaleString()}</td>
                      <td style={{ padding: '12px', color: 'var(--negative)' }}>${pending.toLocaleString()}</td>
                      <td style={{ padding: '12px' }}>${grantedMinusPaid.toLocaleString()}</td>
                      <td style={{ padding: '12px' }}>{getLastPaymentDate(loan)}</td>
                      <td style={{ padding: '12px', color: weeksNoPay >= weeksWithoutPayment ? 'var(--negative)' : 'var(--warning)' }}>{weeksNoPay}</td>
                      <td style={{ padding: '12px' }}>{weeksSince}</td>
                      <td style={{ padding: '12px' }}>
                        <div>{fullLocality}</div>
                        <div style={{ color: 'var(--neutral600)', fontSize: 12 }}>Líder: {loan.lead?.personalData?.fullName || 'Sin líder'}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {isRenewal ? (
                          <span style={{ color: 'var(--warning)', fontSize: 12 }}>Renovación</span>
                        ) : (
                          <span style={{ color: 'var(--neutral600)', fontSize: 12 }}>Activo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        )}

        {/* Modal de confirmación */}
        <AlertDialog
          isOpen={showConfirmModal}
          title="Confirmar marcado como cartera muerta"
          actions={{
            confirm: {
              label: isLoading ? 'Procesando...' : 'Confirmar',
              action: handleMarkAsDeadDebt,
              loading: isLoading
            },
            cancel: {
              label: 'Cancelar',
              action: () => setShowConfirmModal(false)
            }
          }}
        >
          <Text>
            ¿Estás seguro de que quieres marcar {selectedLoans.length} préstamos como cartera muerta?
            Esta acción no se puede deshacer.
          </Text>
        </AlertDialog>
      </Stack>
    </PageContainer>
  );
};

export default CarteraMuerta2Page;