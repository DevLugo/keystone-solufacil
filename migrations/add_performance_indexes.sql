-- Migración para mejorar el rendimiento de las tablas transactions, loan y loanPayment
-- Fecha: 2024-01-10
-- Propósito: Agregar índices para optimizar queries frecuentes
-- Nota: Este script está diseñado para ejecutarse múltiples veces sin errores

-- =====================================================
-- CONFIGURACIÓN INICIAL
-- =====================================================

-- Configurar para que no falle si los índices ya existen
SET client_min_messages = WARNING;

-- =====================================================
-- FUNCIÓN AUXILIAR PARA CREAR ÍNDICES DE FORMA SEGURA
-- =====================================================

CREATE OR REPLACE FUNCTION create_index_if_not_exists(
    index_name text,
    table_name text,
    column_spec text,
    where_clause text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    full_query text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = index_name
    ) THEN
        full_query := 'CREATE INDEX CONCURRENTLY ' || quote_ident(index_name) || 
                      ' ON ' || quote_ident(table_name) || '(' || column_spec || ')';
        
        IF where_clause IS NOT NULL THEN
            full_query := full_query || ' WHERE ' || where_clause;
        END IF;
        
        EXECUTE full_query;
        RAISE NOTICE 'Índice % creado exitosamente', index_name;
    ELSE
        RAISE NOTICE 'Índice % ya existe, omitiendo...', index_name;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error al crear índice %: %', index_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ÍNDICES PARA LA TABLA Transaction
-- =====================================================

-- Índice para búsquedas por fecha (muy importante para filtros de fecha)
SELECT create_index_if_not_exists('Transaction_date_idx', 'Transaction', '"date"');

-- Índice para búsquedas por tipo
SELECT create_index_if_not_exists('Transaction_type_idx', 'Transaction', '"type"');

-- Índice compuesto para queries frecuentes por fecha y tipo
SELECT create_index_if_not_exists('Transaction_date_type_idx', 'Transaction', '"date", "type"');

-- Índice compuesto para queries por fecha y lead
SELECT create_index_if_not_exists('Transaction_date_leadId_idx', 'Transaction', '"date", "leadId"');

-- Índice para incomeSource y expenseSource
SELECT create_index_if_not_exists('Transaction_incomeSource_idx', 'Transaction', '"incomeSource"');
SELECT create_index_if_not_exists('Transaction_expenseSource_idx', 'Transaction', '"expenseSource"');

-- Índice para relación con Lead
SELECT create_index_if_not_exists('Transaction_leadId_idx', 'Transaction', '"leadId"');

-- =====================================================
-- ÍNDICES PARA LA TABLA Loan
-- =====================================================

-- Índice para búsquedas por estado
SELECT create_index_if_not_exists('Loan_status_idx', 'Loan', '"status"');

-- Índice para búsquedas por fecha de firma
SELECT create_index_if_not_exists('Loan_signDate_idx', 'Loan', '"signDate"');

-- Índice para búsquedas por fecha de finalización
SELECT create_index_if_not_exists('Loan_finishedDate_idx', 'Loan', '"finishedDate"');

-- Índice para relación con Lead
SELECT create_index_if_not_exists('Loan_leadId_idx', 'Loan', '"leadId"');

-- Índice compuesto para queries frecuentes
SELECT create_index_if_not_exists('Loan_leadId_status_idx', 'Loan', '"leadId", "status"');
SELECT create_index_if_not_exists('Loan_leadId_finishedDate_idx', 'Loan', '"leadId", "finishedDate"');
SELECT create_index_if_not_exists('Loan_signDate_leadId_idx', 'Loan', '"signDate", "leadId"');
SELECT create_index_if_not_exists('Loan_signDate_status_idx', 'Loan', '"signDate", "status"');

-- Índice para pendingAmountStored (usado en filtros)
SELECT create_index_if_not_exists('Loan_pendingAmountStored_idx', 'Loan', '"pendingAmountStored"');

-- Índice parcial para queries de préstamos activos por lead
SELECT create_index_if_not_exists(
    'Loan_active_by_lead_idx', 
    'Loan', 
    '"leadId", "finishedDate", "pendingAmountStored"',
    '"finishedDate" IS NULL AND "pendingAmountStored" > ''0'''
);

-- =====================================================
-- ÍNDICES PARA LA TABLA LoanPayment
-- =====================================================

-- Índice para búsquedas por fecha de recepción
SELECT create_index_if_not_exists('LoanPayment_receivedAt_idx', 'LoanPayment', '"receivedAt"');

-- Índice para búsquedas por tipo
SELECT create_index_if_not_exists('LoanPayment_type_idx', 'LoanPayment', '"type"');

-- Índice para búsquedas por método de pago
SELECT create_index_if_not_exists('LoanPayment_paymentMethod_idx', 'LoanPayment', '"paymentMethod"');

-- Índice para relación con Loan
SELECT create_index_if_not_exists('LoanPayment_loanId_idx', 'LoanPayment', '"loanId"');

-- Índice para relación con LeadPaymentReceived
SELECT create_index_if_not_exists('LoanPayment_leadPaymentReceivedId_idx', 'LoanPayment', '"leadPaymentReceivedId"');

-- Índice compuesto para queries frecuentes
SELECT create_index_if_not_exists('LoanPayment_receivedAt_leadPaymentReceivedId_idx', 'LoanPayment', '"receivedAt", "leadPaymentReceivedId"');
SELECT create_index_if_not_exists('LoanPayment_loanId_receivedAt_idx', 'LoanPayment', '"loanId", "receivedAt"');
SELECT create_index_if_not_exists('LoanPayment_receivedAt_loanId_idx', 'LoanPayment', '"receivedAt", "loanId"');

-- =====================================================
-- ÍNDICES PARA LA TABLA LeadPaymentReceived
-- =====================================================

-- Índice para búsquedas por estado de pago
SELECT create_index_if_not_exists('LeadPaymentReceived_paymentStatus_idx', 'LeadPaymentReceived', '"paymentStatus"');

-- Índice compuesto para queries por lead y fecha
SELECT create_index_if_not_exists('LeadPaymentReceived_leadId_createdAt_idx', 'LeadPaymentReceived', '"leadId", "createdAt"');

-- =====================================================
-- ÍNDICES PARA LA TABLA Employee
-- =====================================================

-- Índice para búsquedas por tipo
SELECT create_index_if_not_exists('Employee_type_idx', 'Employee', '"type"');

-- =====================================================
-- ÍNDICES PARA LA TABLA PersonalData
-- =====================================================

-- Índice para búsquedas por nombre completo (búsquedas de texto)
SELECT create_index_if_not_exists('PersonalData_fullName_idx', 'PersonalData', '"fullName"');

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
-- LIMPIEZA
-- =====================================================

-- Eliminar la función auxiliar
DROP FUNCTION IF EXISTS create_index_if_not_exists(text, text, text, text);

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Mostrar índices creados
DO $$
DECLARE
    r RECORD;
    idx_count INTEGER;
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'VERIFICACIÓN DE ÍNDICES CREADOS';
    RAISE NOTICE '====================================';
    
    -- Contar índices por tabla
    FOR r IN 
        SELECT 
            tablename,
            COUNT(*) as index_count
        FROM pg_indexes
        WHERE tablename IN ('Transaction', 'Loan', 'LoanPayment', 'LeadPaymentReceived', 'Employee', 'PersonalData')
          AND schemaname = 'public'
        GROUP BY tablename
        ORDER BY tablename
    LOOP
        RAISE NOTICE 'Tabla %: % índices', r.tablename, r.index_count;
    END LOOP;
    
    -- Mostrar tamaño de las tablas
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'TAMAÑO DE TABLAS E ÍNDICES';
    RAISE NOTICE '====================================';
    
    FOR r IN
        SELECT 
            relname AS tabla,
            pg_size_pretty(pg_total_relation_size(relid)) AS tamaño_total,
            pg_size_pretty(pg_relation_size(relid)) AS tamaño_tabla,
            pg_size_pretty(pg_indexes_size(relid)) AS tamaño_indices
        FROM pg_catalog.pg_statio_user_tables 
        WHERE relname IN ('Transaction', 'Loan', 'LoanPayment', 'LeadPaymentReceived')
        ORDER BY pg_total_relation_size(relid) DESC
    LOOP
        RAISE NOTICE 'Tabla %: Total=%, Tabla=%, Índices=%', 
            r.tabla, r.tamaño_total, r.tamaño_tabla, r.tamaño_indices;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Migración completada exitosamente!';
    RAISE NOTICE 'Los índices mejorarán significativamente el rendimiento de las queries.';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANTE: Si la base de datos está en producción, considera:';
    RAISE NOTICE '1. Ejecutar VACUUM ANALYZE periódicamente';
    RAISE NOTICE '2. Monitorear pg_stat_user_indexes para verificar el uso de índices';
    RAISE NOTICE '3. Revisar slow query logs para identificar nuevas optimizaciones';
END $$;

-- Restaurar mensajes normales
SET client_min_messages = NOTICE;