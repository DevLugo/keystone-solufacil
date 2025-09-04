import React, { useState, useCallback, useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { Row, Col, Badge, Spinner, Button, Alert } from "react-bootstrap";
import { LoanCard } from "../loans/LoanCard";
import { Lead, Loan } from "../../../src/generated/graphql";
import { useLoanCalculations } from "../../hooks/useCalculationsCache";
import { GET_LOANS_OPTIMIZED, COUNT_ACTIVE_LOANS } from "../../graphql/queries/optimized";

interface CreditosTabProps {
  date: Date;
  nextDate: Date;
  lead: Lead;
}

const ITEMS_PER_PAGE = 20;

export const CreditosTabOptimized: React.FC<CreditosTabProps> = ({
  date,
  nextDate,
  lead,
}) => {
  const [page, setPage] = useState(0);
  const { calculatePendingAmount } = useLoanCalculations();

  // Query para contar préstamos activos (más eficiente)
  const { data: countData } = useQuery(COUNT_ACTIVE_LOANS, {
    variables: { leadId: lead.id },
    fetchPolicy: 'cache-first',
  });

  // Query principal con paginación
  const { loading, error, data, fetchMore } = useQuery(GET_LOANS_OPTIMIZED, {
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

  // Calcular totales con memoización
  const totals = useMemo(() => {
    if (!data?.loans) return { totalGived: 0, totalComission: 0 };

    return data.loans.reduce(
      (acc, loan) => ({
        totalGived: acc.totalGived + parseFloat(loan.amountGived || "0"),
        totalComission: acc.totalComission + parseFloat(loan.comissionAmount || "0"),
      }),
      { totalGived: 0, totalComission: 0 }
    );
  }, [data?.loans]);

  // Función para cargar más préstamos
  const loadMore = useCallback(() => {
    if (loading || !data?.loans) return;

    const currentCount = data.loans.length;
    if (currentCount >= (data.loansCount || 0)) return;

    fetchMore({
      variables: {
        skip: currentCount,
        take: ITEMS_PER_PAGE,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          ...prev,
          loans: [...prev.loans, ...fetchMoreResult.loans],
        };
      },
    });

    setPage(page + 1);
  }, [data, loading, fetchMore, page]);

  // Función para calcular préstamos activos con eficiencia
  const getActiveLoansCount = useCallback(() => {
    if (countData?.loansConnection?.totalCount !== undefined) {
      return countData.loansConnection.totalCount;
    }

    // Fallback si no tenemos el count query
    if (!data?.loans) return 0;
    
    return data.loans.filter(loan => {
      const pendingAmount = calculatePendingAmount(loan);
      return pendingAmount > 0 && !loan.finishedDate;
    }).length;
  }, [data?.loans, countData, calculatePendingAmount]);

  if (error) {
    return (
      <Alert variant="danger">
        Error al cargar los créditos: {error.message}
      </Alert>
    );
  }

  const hasMore = data?.loans && data.loans.length < (data.loansCount || 0);
  const activeLoansCount = getActiveLoansCount();

  return (
    <div>
      <Row>
        <Col>
          <h5 className="mb-3">
            Créditos del período{" "}
            {data?.loansCount !== undefined && (
              <Badge bg="primary">{data.loansCount}</Badge>
            )}
          </h5>
        </Col>
        <Col className="text-end">
          <div>
            <strong>Total Entregado:</strong> ${totals.totalGived.toFixed(2)}
          </div>
          <div>
            <strong>Total Comisión:</strong> ${totals.totalComission.toFixed(2)}
          </div>
          <div>
            <strong>Créditos Activos:</strong>{" "}
            <Badge bg={activeLoansCount > 0 ? "warning" : "success"}>
              {activeLoansCount}
            </Badge>
          </div>
        </Col>
      </Row>

      {loading && page === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
        </div>
      ) : (
        <>
          <Row className="g-3 mt-3">
            {data?.loans?.map((loan) => (
              <Col key={loan.id} xs={12} md={6} lg={4}>
                <LoanCard loan={loan as Loan} />
              </Col>
            ))}
          </Row>

          {hasMore && (
            <div className="text-center mt-4">
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
                  `Cargar más (${data.loans.length} de ${data.loansCount})`
                )}
              </Button>
            </div>
          )}

          {!loading && data?.loans?.length === 0 && (
            <Alert variant="info" className="mt-3">
              No se encontraron créditos en este período.
            </Alert>
          )}
        </>
      )}
    </div>
  );
};