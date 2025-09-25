-- Query para revisar préstamos con badDebtDate en febrero 2025
SELECT 
    l.id,
    l."snapshotRouteId",
    l."badDebtDate",
    l."amountGived",
    lt.rate,
    COUNT(p.id) as payments_count,
    COALESCE(SUM(p.amount), 0) as total_paid
FROM "Loan" l
LEFT JOIN "LoanType" lt ON l."loanTypeId" = lt.id
LEFT JOIN "Payment" p ON l.id = p."loanId"
WHERE l."badDebtDate" >= '2025-02-01T00:00:00.000Z'
  AND l."badDebtDate" <= '2025-02-28T23:59:59.999Z'
  AND l."snapshotRouteId" = 'cmfk2c6q30004pshfx9s8sras'
GROUP BY l.id, l."snapshotRouteId", l."badDebtDate", l."amountGived", lt.rate
ORDER BY l."badDebtDate";

-- Query para ver todas las rutas disponibles
SELECT id, name FROM "Route" ORDER BY name;

-- Query para ver todos los préstamos con badDebtDate en febrero 2025 (sin filtro de ruta)
SELECT 
    l.id,
    l."snapshotRouteId",
    r.name as route_name,
    l."badDebtDate",
    l."amountGived"
FROM "Loan" l
LEFT JOIN "Route" r ON l."snapshotRouteId" = r.id
WHERE l."badDebtDate" >= '2025-02-01T00:00:00.000Z'
  AND l."badDebtDate" <= '2025-02-28T23:59:59.999Z'
ORDER BY l."snapshotRouteId", l."badDebtDate";
