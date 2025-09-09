-- Agregar la columna snapshotRouteId si no existe
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "snapshotRouteId" TEXT;

-- Poblar snapshotRouteId con los valores actuales de routeId
-- Esto asegura que las transacciones históricas mantengan la ruta que tenían al momento de crearse
UPDATE "Transaction" 
SET "snapshotRouteId" = "route" 
WHERE "route" IS NOT NULL;
