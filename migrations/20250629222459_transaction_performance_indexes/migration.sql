-- CreateIndex
-- Migración para optimizar performance de queries de transacciones en la página de gastos
-- Fecha: 2025-06-29
-- Propósito: Mejorar performance de GET_EXPENSES_BY_DATE_SIMPLE query

-- Índice principal para queries por fecha (usado en casi todas las queries de transacciones)
CREATE INDEX IF NOT EXISTS "Transaction_date_idx" ON "Transaction" ("date");

-- Índice compuesto para filtros de gastos (date + type + expenseSource)
-- Optimizado para la query GET_EXPENSES_BY_DATE_SIMPLE que filtra por fecha, tipo EXPENSE, y expenseSource IN
CREATE INDEX IF NOT EXISTS "Transaction_date_type_expenseSource_idx" ON "Transaction" ("date", "type", "expenseSource");

-- Índice compuesto para queries por fecha y líder
-- Útil para filtros por líder específico en combinación con fecha
CREATE INDEX IF NOT EXISTS "Transaction_date_lead_idx" ON "Transaction" ("date", "lead");

-- Índice compuesto para gastos por fecha y tipo
-- Para queries que filtran por fecha y tipo de transacción
CREATE INDEX IF NOT EXISTS "Transaction_date_type_idx" ON "Transaction" ("date", "type");

-- Índice para optimizar ordenamiento por fecha (DESC para mostrar más recientes primero)
-- Útil para listados ordenados por fecha descendente
CREATE INDEX IF NOT EXISTS "Transaction_date_desc_idx" ON "Transaction" ("date" DESC); 