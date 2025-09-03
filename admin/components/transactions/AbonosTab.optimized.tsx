import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@apollo/client";
import { Row, Col, Badge, Table, Alert, Spinner, Button } from "react-bootstrap";
import { Lead } from "../../../src/generated/graphql";
import { useLoanCalculations } from "../../hooks/useCalculationsCache";
import { 
  GET_LEAD_PAYMENTS_OPTIMIZED, 
  CHECK_MIGRATED_PAYMENTS 
} from "../../graphql/queries/optimized";

interface AbonosTabProps {
  date: Date;
  nextDate: Date;
  lead: Lead;
}

const ITEMS_PER_PAGE = 50;

export const AbonosTabOptimized: React.FC<AbonosTabProps> = ({
  date,
  nextDate,
  lead,
}) => {
  const [page, setPage] = useState(0);

  // Query principal con paginación
  const { loading, error, data, fetchMore } = useQuery(GET_LEAD_PAYMENTS_OPTIMIZED, {
    variables: {
      date: date.toISOString(),
      nextDate: nextDate.toISOString(),
      leadId: lead.id,
      skip: 0,
      take: ITEMS_PER_PAGE,
    },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  // Query para verificar pagos migrados (más eficiente)
  const { data: migratedData } = useQuery(CHECK_MIGRATED_PAYMENTS, {
    variables: {
      date: date.toISOString(),
      nextDate: nextDate.toISOString(),
      leadId: lead.id,
    },
    fetchPolicy: 'cache-first',
  });

  // Calcular totales con memoización
  const totals = useMemo(() => {
    if (!data?.loanPayments) {
      return {
        totalAmount: 0,
        totalComission: 0,
        byMethod: { cash: 0, bank: 0 },
        summary: {
          esperado: 0,
          pagado: 0,
          efectivoPagado: 0,
          bancoPagado: 0,
          falco: 0,
        },
      };
    }

    const result = {
      totalAmount: 0,
      totalComission: 0,
      byMethod: { cash: 0, bank: 0 },
      summary: {
        esperado: 0,
        pagado: 0,
        efectivoPagado: 0,
        bancoPagado: 0,
        falco: 0,
      },
    };

    // Usar un Set para evitar duplicados
    const processedPayments = new Set<string>();

    data.loanPayments.forEach((payment) => {
      if (processedPayments.has(payment.id)) return;
      processedPayments.add(payment.id);

      const amount = parseFloat(payment.amount || "0");
      const comission = parseFloat(payment.comission || "0");

      result.totalAmount += amount;
      result.totalComission += comission;

      if (payment.paymentMethod === "CASH") {
        result.byMethod.cash += amount;
      } else if (payment.paymentMethod === "BANK") {
        result.byMethod.bank += amount;
      }

      // Sumar al resumen si tiene leadPaymentReceived
      if (payment.leadPaymentReceived && !processedPayments.has(`lpr-${payment.leadPaymentReceived.id}`)) {
        processedPayments.add(`lpr-${payment.leadPaymentReceived.id}`);
        
        result.summary.esperado += parseFloat(payment.leadPaymentReceived.expectedAmount || "0");
        result.summary.pagado += parseFloat(payment.leadPaymentReceived.paidAmount || "0");
        result.summary.efectivoPagado += parseFloat(payment.leadPaymentReceived.cashPaidAmount || "0");
        result.summary.bancoPagado += parseFloat(payment.leadPaymentReceived.bankPaidAmount || "0");
        result.summary.falco += parseFloat(payment.leadPaymentReceived.falcoAmount || "0");
      }
    });

    return result;
  }, [data?.loanPayments]);

  // Función para cargar más pagos
  const loadMore = useCallback(() => {
    if (loading || !data?.loanPayments) return;

    const currentCount = data.loanPayments.length;
    const totalCount = data.loanPaymentsCount?.totalCount || 0;
    
    if (currentCount >= totalCount) return;

    fetchMore({
      variables: {
        skip: currentCount,
        take: ITEMS_PER_PAGE,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          ...prev,
          loanPayments: [...prev.loanPayments, ...fetchMoreResult.loanPayments],
        };
      },
    });

    setPage(page + 1);
  }, [data, loading, fetchMore, page]);

  // Función para formatear fecha
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  if (error) {
    return (
      <Alert variant="danger">
        Error al cargar los abonos: {error.message}
      </Alert>
    );
  }

  const hasMore = data?.loanPayments && 
    data.loanPayments.length < (data.loanPaymentsCount?.totalCount || 0);
  
  const hasMigratedPayments = (migratedData?.loanPaymentsConnection?.totalCount || 0) > 0;

  return (
    <div>
      <Row className="mb-3">
        <Col>
          <h5>
            Abonos del período{" "}
            {data?.loanPaymentsCount?.totalCount !== undefined && (
              <Badge bg="primary">{data.loanPaymentsCount.totalCount}</Badge>
            )}
          </h5>
        </Col>
        <Col className="text-end">
          <div>
            <strong>Total Cobrado:</strong> ${totals.totalAmount.toFixed(2)}
          </div>
          <div>
            <strong>Total Comisión:</strong> ${totals.totalComission.toFixed(2)}
          </div>
          <div>
            <small>
              Efectivo: ${totals.byMethod.cash.toFixed(2)} | 
              Banco: ${totals.byMethod.bank.toFixed(2)}
            </small>
          </div>
        </Col>
      </Row>

      {/* Resumen de pagos agrupados */}
      {totals.summary.esperado > 0 && (
        <Alert variant="info" className="mb-3">
          <Row>
            <Col xs={12} md={6}>
              <strong>Esperado:</strong> ${totals.summary.esperado.toFixed(2)}<br/>
              <strong>Pagado:</strong> ${totals.summary.pagado.toFixed(2)}
            </Col>
            <Col xs={12} md={6}>
              <strong>Efectivo:</strong> ${totals.summary.efectivoPagado.toFixed(2)}<br/>
              <strong>Banco:</strong> ${totals.summary.bancoPagado.toFixed(2)}<br/>
              <strong>Falco:</strong> ${totals.summary.falco.toFixed(2)}
            </Col>
          </Row>
        </Alert>
      )}

      {hasMigratedPayments && (
        <Alert variant="warning" className="mb-3">
          <strong>Nota:</strong> Hay {migratedData.loanPaymentsConnection.totalCount} pagos 
          anteriores a la migración que no están agrupados.
        </Alert>
      )}

      {loading && page === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Préstamo</th>
                  <th>Monto</th>
                  <th>Comisión</th>
                  <th>Método</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {data?.loanPayments?.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.receivedAt)}</td>
                    <td>{payment.loan?.borrower?.personalData?.fullName || 'N/A'}</td>
                    <td>
                      {payment.loan?.loantype?.name || 'N/A'}
                      {payment.loan?.signDate && (
                        <small className="text-muted d-block">
                          {new Date(payment.loan.signDate).toLocaleDateString('es-MX')}
                        </small>
                      )}
                    </td>
                    <td className="text-end">${parseFloat(payment.amount || "0").toFixed(2)}</td>
                    <td className="text-end">${parseFloat(payment.comission || "0").toFixed(2)}</td>
                    <td>
                      <Badge bg={payment.paymentMethod === "CASH" ? "success" : "primary"}>
                        {payment.paymentMethod === "CASH" ? "Efectivo" : "Banco"}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={payment.type === "REGULAR" ? "secondary" : "warning"}>
                        {payment.type}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {hasMore && (
            <div className="text-center mt-3">
              <Button
                variant="primary"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Cargando...
                  </>
                ) : (
                  `Cargar más (${data.loanPayments.length} de ${data.loanPaymentsCount?.totalCount})`
                )}
              </Button>
            </div>
          )}

          {!loading && data?.loanPayments?.length === 0 && (
            <Alert variant="info" className="mt-3">
              No se encontraron abonos en este período.
            </Alert>
          )}
        </>
      )}
    </div>
  );
};