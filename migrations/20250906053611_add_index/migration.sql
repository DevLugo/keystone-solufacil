-- This is an empty migration.
-- Índices para transacciones (usando el campo mapeado correcto)
CREATE INDEX idx_transaction_route_date ON "Transaction" ("route", "date");
CREATE INDEX idx_transaction_type_source ON "Transaction" ("type", "expenseSource", "incomeSource");
CREATE INDEX idx_transaction_source_account ON "Transaction" ("sourceAccount", "expenseSource");

-- Índices para préstamos
CREATE INDEX idx_loan_lead_dates ON "Loan" ("lead", "signDate", "finishedDate");
CREATE INDEX idx_loan_bad_debt ON "Loan" ("badDebtDate") WHERE "badDebtDate" IS NOT NULL;

-- Índices para pagos de préstamos
CREATE INDEX idx_loanpayment_loan_date ON "LoanPayment" ("loan", "receivedAt");

-- Índice para empleados
CREATE INDEX idx_employee_routes ON "Employee" ("routes");

-- Índice compuesto para cuentas
CREATE INDEX idx_account_type ON "Account" ("type");