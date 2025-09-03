-- =====================================================
-- ÍNDICES PARA OPTIMIZAR createCustomLeadPaymentReceived
-- =====================================================
-- Estos índices mejorarán significativamente el rendimiento
-- en servidores con mayor latencia de red

-- 1. ÍNDICES PARA LA TABLA Employee
-- Ya existe índice en routesId según schema.prisma

-- 2. ÍNDICES PARA LA TABLA Account
-- Índice compuesto para búsqueda de cuentas por tipo en una ruta específica
CREATE INDEX IF NOT EXISTS idx_account_type 
ON "Account" ("type");

-- Índice para las relaciones many-to-many con Route
CREATE INDEX IF NOT EXISTS idx_account_routes_accountId 
ON "_AccountToRoute" ("A");

CREATE INDEX IF NOT EXISTS idx_account_routes_routeId 
ON "_AccountToRoute" ("B");

-- 3. ÍNDICES PARA LA TABLA LoanPayment
-- Índice compuesto para búsquedas por leadPaymentReceivedId (más importante)
CREATE INDEX IF NOT EXISTS idx_loanpayment_leadpaymentreceived_created 
ON "LoanPayment" ("leadPaymentReceived", "createdAt" DESC);

-- Índice para mejorar la inserción masiva y búsqueda
CREATE INDEX IF NOT EXISTS idx_loanpayment_receivedAt 
ON "LoanPayment" ("receivedAt" DESC);

-- 4. ÍNDICES PARA LA TABLA Transaction
-- Índice compuesto para búsquedas por tipo y fecha
CREATE INDEX IF NOT EXISTS idx_transaction_type_date 
ON "Transaction" ("type", "date" DESC);

-- Índice para búsquedas por fuente de ingreso/gasto
CREATE INDEX IF NOT EXISTS idx_transaction_income_source 
ON "Transaction" ("incomeSource") 
WHERE "incomeSource" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_expense_source 
ON "Transaction" ("expenseSource") 
WHERE "expenseSource" IS NOT NULL;

-- Índice compuesto para transacciones de pago de préstamos
CREATE INDEX IF NOT EXISTS idx_transaction_loanpayment_lead 
ON "Transaction" ("loanPayment", "lead");

-- 5. ÍNDICES PARA LA TABLA Loan
-- Índice para búsquedas de préstamos con sus pagos
CREATE INDEX IF NOT EXISTS idx_loan_status_lead 
ON "Loan" ("status", "lead") 
WHERE "status" IS NOT NULL;

-- Índice para búsquedas por fecha de firma
CREATE INDEX IF NOT EXISTS idx_loan_signdate 
ON "Loan" ("signDate" DESC);

-- 6. ÍNDICES PARA LA TABLA LeadPaymentReceived
-- Índice compuesto para búsquedas por agente y fecha
CREATE INDEX IF NOT EXISTS idx_leadpaymentreceived_agent_created 
ON "LeadPaymentReceived" ("agent", "createdAt" DESC);

-- Índice compuesto para búsquedas por lead y estado
CREATE INDEX IF NOT EXISTS idx_leadpaymentreceived_lead_status 
ON "LeadPaymentReceived" ("lead", "paymentStatus");

-- Índice para búsquedas por estado de pago
CREATE INDEX IF NOT EXISTS idx_leadpaymentreceived_status 
ON "LeadPaymentReceived" ("paymentStatus");

-- 7. ÍNDICES ADICIONALES PARA MEJORAR JOINS
-- Índice para mejorar el join entre Employee y Route
CREATE INDEX IF NOT EXISTS idx_employee_routes_user 
ON "Employee" ("routes", "user");

-- =====================================================
-- ÍNDICES PARA QUERIES ESPECÍFICAS DE LA MUTACIÓN
-- =====================================================

-- 8. ÍNDICE COMPUESTO PARA LA BÚSQUEDA INICIAL DE EMPLEADO
-- Este índice mejora: Employee.findUnique con include de routes y accounts
CREATE INDEX IF NOT EXISTS idx_employee_id_routes 
ON "Employee" ("id", "routes");

-- 9. ÍNDICE PARA ACTUALIZACIÓN DE BALANCES DE CUENTA
-- Mejora Account.update por id
CREATE INDEX IF NOT EXISTS idx_account_id_amount 
ON "Account" ("id", "amount");

-- 10. ÍNDICE PARA BÚSQUEDA DE PAGOS POR PRÉSTAMO
-- Mejora las consultas de pagos existentes de un préstamo
CREATE INDEX IF NOT EXISTS idx_loanpayment_loan_receivedAt 
ON "LoanPayment" ("loan", "receivedAt" DESC);

-- =====================================================
-- ESTADÍSTICAS Y VACUUM (PostgreSQL)
-- =====================================================

-- Actualizar estadísticas de las tablas más utilizadas
ANALYZE "Employee";
ANALYZE "Route";
ANALYZE "Account";
ANALYZE "LoanPayment";
ANALYZE "Transaction";
ANALYZE "Loan";
ANALYZE "LeadPaymentReceived";

-- Vacuum para optimizar el almacenamiento (ejecutar en mantenimiento)
-- VACUUM ANALYZE "LoanPayment";
-- VACUUM ANALYZE "Transaction";
-- VACUUM ANALYZE "LeadPaymentReceived";

-- =====================================================
-- VERIFICACIÓN DE ÍNDICES EXISTENTES
-- =====================================================
-- Consulta para ver todos los índices de las tablas relacionadas:
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename IN (
        'Employee', 'Route', 'Account', 'LoanPayment', 
        'Transaction', 'Loan', 'LeadPaymentReceived',
        '_AccountToRoute'
    )
ORDER BY 
    tablename, indexname;
*/

-- =====================================================
-- MONITOREO DE PERFORMANCE
-- =====================================================
-- Consulta para identificar queries lentas:
/*
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM 
    pg_stat_statements
WHERE 
    query LIKE '%LeadPaymentReceived%'
    OR query LIKE '%LoanPayment%'
ORDER BY 
    mean_time DESC
LIMIT 20;
*/