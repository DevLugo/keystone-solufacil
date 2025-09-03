-- Migración para mejorar el rendimiento de las tablas transactions, loan y loanPayment
-- Fecha: 2024-01-10
-- Propósito: Agregar índices para optimizar queries frecuentes

-- =====================================================
-- ÍNDICES PARA LA TABLA Transaction
-- =====================================================

-- Índice para búsquedas por fecha (muy importante para filtros de fecha)
CREATE INDEX IF NOT EXISTS "Transaction_date_idx" ON "Transaction"("date");

-- Índice para búsquedas por tipo
CREATE INDEX IF NOT EXISTS "Transaction_type_idx" ON "Transaction"("type");

-- Índice compuesto para queries frecuentes por fecha y tipo
CREATE INDEX IF NOT EXISTS "Transaction_date_type_idx" ON "Transaction"("date", "type");

-- Índice compuesto para queries por fecha y lead
CREATE INDEX IF NOT EXISTS "Transaction_date_leadId_idx" ON "Transaction"("date", "leadId");

-- Índice para incomeSource y expenseSource
CREATE INDEX IF NOT EXISTS "Transaction_incomeSource_idx" ON "Transaction"("incomeSource");
CREATE INDEX IF NOT EXISTS "Transaction_expenseSource_idx" ON "Transaction"("expenseSource");

-- =====================================================
-- ÍNDICES PARA LA TABLA Loan
-- =====================================================

-- Índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS "Loan_status_idx" ON "Loan"("status");

-- Índice para búsquedas por fecha de firma
CREATE INDEX IF NOT EXISTS "Loan_signDate_idx" ON "Loan"("signDate");

-- Índice para búsquedas por fecha de finalización
CREATE INDEX IF NOT EXISTS "Loan_finishedDate_idx" ON "Loan"("finishedDate");

-- Índice compuesto para queries frecuentes
CREATE INDEX IF NOT EXISTS "Loan_leadId_status_idx" ON "Loan"("leadId", "status");
CREATE INDEX IF NOT EXISTS "Loan_leadId_finishedDate_idx" ON "Loan"("leadId", "finishedDate");

-- Índice para pendingAmountStored (usado en filtros)
CREATE INDEX IF NOT EXISTS "Loan_pendingAmountStored_idx" ON "Loan"("pendingAmountStored");

-- Índice compuesto para queries de préstamos activos por lead
CREATE INDEX IF NOT EXISTS "Loan_active_by_lead_idx" ON "Loan"("leadId", "finishedDate", "pendingAmountStored") 
WHERE "finishedDate" IS NULL AND "pendingAmountStored" > '0';

-- =====================================================
-- ÍNDICES PARA LA TABLA LoanPayment
-- =====================================================

-- Índice para búsquedas por fecha de recepción
CREATE INDEX IF NOT EXISTS "LoanPayment_receivedAt_idx" ON "LoanPayment"("receivedAt");

-- Índice para búsquedas por tipo
CREATE INDEX IF NOT EXISTS "LoanPayment_type_idx" ON "LoanPayment"("type");

-- Índice para búsquedas por método de pago
CREATE INDEX IF NOT EXISTS "LoanPayment_paymentMethod_idx" ON "LoanPayment"("paymentMethod");

-- Índice compuesto para queries frecuentes
CREATE INDEX IF NOT EXISTS "LoanPayment_receivedAt_leadPaymentReceivedId_idx" ON "LoanPayment"("receivedAt", "leadPaymentReceivedId");

-- Índice para queries de pagos por loan
CREATE INDEX IF NOT EXISTS "LoanPayment_loanId_receivedAt_idx" ON "LoanPayment"("loanId", "receivedAt");

-- =====================================================
-- ÍNDICES PARA LA TABLA LeadPaymentReceived
-- =====================================================

-- Índice para búsquedas por estado de pago
CREATE INDEX IF NOT EXISTS "LeadPaymentReceived_paymentStatus_idx" ON "LeadPaymentReceived"("paymentStatus");

-- Índice compuesto para queries por lead y fecha
CREATE INDEX IF NOT EXISTS "LeadPaymentReceived_leadId_createdAt_idx" ON "LeadPaymentReceived"("leadId", "createdAt");

-- =====================================================
-- ÍNDICES PARA LA TABLA Employee
-- =====================================================

-- Índice para búsquedas por tipo
CREATE INDEX IF NOT EXISTS "Employee_type_idx" ON "Employee"("type");

-- =====================================================
-- ÍNDICES PARA LA TABLA PersonalData
-- =====================================================

-- Índice para búsquedas por nombre completo (búsquedas de texto)
CREATE INDEX IF NOT EXISTS "PersonalData_fullName_idx" ON "PersonalData"("fullName");

-- Índice para clientCode (ya existe como unique, pero verificamos)
-- Ya existe: clientCode text unique

-- =====================================================
-- ANÁLISIS DE TABLAS PARA ACTUALIZAR ESTADÍSTICAS
-- =====================================================

-- Actualizar estadísticas para el optimizador de queries
ANALYZE "Transaction";
ANALYZE "Loan";
ANALYZE "LoanPayment";
ANALYZE "LeadPaymentReceived";
ANALYZE "Employee";
ANALYZE "PersonalData";

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON INDEX "Transaction_date_idx" IS 'Índice para optimizar búsquedas por fecha en transacciones';
COMMENT ON INDEX "Loan_active_by_lead_idx" IS 'Índice parcial para préstamos activos por líder - optimiza queries frecuentes';
COMMENT ON INDEX "LoanPayment_receivedAt_idx" IS 'Índice para optimizar búsquedas de pagos por fecha';