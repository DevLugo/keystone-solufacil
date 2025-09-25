-- Query para ver todas las rutas y sus IDs
SELECT id, name FROM "Route" ORDER BY name;

-- Query específica para ver los 2 préstamos de RUTA1B en febrero 2025
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
  AND r.name = 'RUTA1B'
ORDER BY l."badDebtDate";

-- Query específica para ver los préstamos de RUTA2 en febrero 2025
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
  AND r.name = 'RUTA2'
ORDER BY l."badDebtDate";
