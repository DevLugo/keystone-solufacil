#!/bin/bash

# Script para subir solo datos (preservando usuarios)
# Uso: ./scripts/upload-data-only.sh

set -e

echo "🔄 Script para subir solo datos (preservando usuarios)"
echo ""

# Cargar variables de entorno
if [ -f .env ]; then
    # Cargar variables usando export
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Error: Archivo .env no encontrado"
    echo "💡 Copia env.example a .env y configura las variables necesarias"
    exit 1
fi

# Verificar variables requeridas
if [ -z "$PROD_DATABASE_URL" ] || [ -z "$LOCAL_DATABASE_URL" ]; then
    echo "❌ Error: Variables de base de datos no configuradas"
    echo "💡 Configura PROD_DATABASE_URL y LOCAL_DATABASE_URL en tu archivo .env"
    exit 1
fi

# Variables de conexión desde .env
PROD_DB="$PROD_DATABASE_URL"
LOCAL_DB="$LOCAL_DATABASE_URL"

# Archivo temporal para el dump
DUMP_FILE="temp_local_dump.sql"

echo "📊 Analizando diferencias entre local y producción..."
echo ""

# Mostrar estadísticas de datos locales
echo "📈 Datos en LOCAL:"
psql "$LOCAL_DB" -c "
SELECT 
  'Loans' as tabla, COUNT(*) as registros FROM public.\"Loan\"
UNION ALL
SELECT 
  'LoanPayments' as tabla, COUNT(*) as registros FROM public.\"LoanPayment\"
UNION ALL
SELECT 
  'Transactions' as tabla, COUNT(*) as registros FROM public.\"Transaction\"
UNION ALL
SELECT 
  'PersonalData' as tabla, COUNT(*) as registros FROM public.\"PersonalData\"
UNION ALL
SELECT 
  'LoanTypes' as tabla, COUNT(*) as registros FROM public.\"Loantype\"
UNION ALL
SELECT 
  'Users' as tabla, COUNT(*) as registros FROM public.\"User\"
UNION ALL
SELECT 
  'PortfolioCleanup' as tabla, COUNT(*) as registros FROM public.\"PortfolioCleanup\"
UNION ALL
SELECT 
  'AuditLog' as tabla, COUNT(*) as registros FROM public.\"AuditLog\"
ORDER BY tabla;
"

echo ""
echo "📈 Datos en PRODUCCIÓN:"
psql "$PROD_DB" -c "
SELECT 
  'Loans' as tabla, COUNT(*) as registros FROM public.\"Loan\"
UNION ALL
SELECT 
  'LoanPayments' as tabla, COUNT(*) as registros FROM public.\"LoanPayment\"
UNION ALL
SELECT 
  'Transactions' as tabla, COUNT(*) as registros FROM public.\"Transaction\"
UNION ALL
SELECT 
  'PersonalData' as tabla, COUNT(*) as registros FROM public.\"PersonalData\"
UNION ALL
SELECT 
  'LoanTypes' as tabla, COUNT(*) as registros FROM public.\"Loantype\"
UNION ALL
SELECT 
  'Users' as tabla, COUNT(*) as registros FROM public.\"User\"
UNION ALL
SELECT 
  'PortfolioCleanup' as tabla, COUNT(*) as registros FROM public.\"PortfolioCleanup\"
UNION ALL
SELECT 
  'AuditLog' as tabla, COUNT(*) as registros FROM public.\"AuditLog\"
ORDER BY tabla;
"

echo ""
echo "⚠️  ADVERTENCIA: Este script va a actualizar datos de producción"
echo "¿Estás seguro de que quieres continuar? (y/N)"
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo "📥 Creando dump de datos (excluyendo usuarios, logs y PortfolioCleanup)..."
pg_dump "$LOCAL_DB" \
  --schema=public \
  --exclude-table-data='"User"' \
  --exclude-table-data='"Password"' \
  --exclude-table-data='"PortfolioCleanup"' \
  --exclude-table-data='"AuditLog"' \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  --no-security-labels \
  --no-comments \
  --clean \
  --if-exists \
  > "$DUMP_FILE"

echo "🔒 Preservando datos importantes de producción..."
# Crear backup de datos importantes de producción
psql "$PROD_DB" -c "
SET search_path TO public;

CREATE TABLE IF NOT EXISTS \"User_backup\" AS 
SELECT * FROM public.\"User\";

CREATE TABLE IF NOT EXISTS \"PortfolioCleanup_backup\" AS 
SELECT * FROM public.\"PortfolioCleanup\";

CREATE TABLE IF NOT EXISTS \"AuditLog_backup\" AS 
SELECT * FROM public.\"AuditLog\";
"

echo "🗑️ Limpiando solo tablas de datos de producción..."
# Eliminar solo las tablas de datos, NO las tablas de backup
psql "$PROD_DB" -c "
SET search_path TO public;

-- Eliminar tablas de datos (no usuarios, logs ni limpiezas)
DROP TABLE IF EXISTS \"Loan\" CASCADE;
DROP TABLE IF EXISTS \"LoanPayment\" CASCADE;
DROP TABLE IF EXISTS \"Transaction\" CASCADE;
DROP TABLE IF EXISTS \"PersonalData\" CASCADE;
DROP TABLE IF EXISTS \"Address\" CASCADE;
DROP TABLE IF EXISTS \"Phone\" CASCADE;
DROP TABLE IF EXISTS \"Borrower\" CASCADE;
DROP TABLE IF EXISTS \"Employee\" CASCADE;
DROP TABLE IF EXISTS \"Route\" CASCADE;
DROP TABLE IF EXISTS \"Account\" CASCADE;
DROP TABLE IF EXISTS \"LeadPaymentReceived\" CASCADE;
DROP TABLE IF EXISTS \"FalcoCompensatoryPayment\" CASCADE;
-- NO eliminar PortfolioCleanup ni AuditLog
"

echo "📤 Restaurando datos en base de datos de producción..."
psql "$PROD_DB" < "$DUMP_FILE"

echo "🔄 Restaurando datos importantes originales..."
# Restaurar datos importantes originales (solo si existen los backups)
psql "$PROD_DB" -c "
SET search_path TO public;

-- Restaurar usuarios originales si existe el backup
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User_backup' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM \"User\" WHERE email = ''elugo.isi@gmail.com''';
        EXECUTE 'INSERT INTO \"User\" (id, name, email, password, role, \"createdAt\")
                 SELECT id, name, email, password, role, \"createdAt\"
                 FROM \"User_backup\"
                 ON CONFLICT (id) DO NOTHING';
        EXECUTE 'DROP TABLE \"User_backup\"';
    END IF;
END
\$\$;

-- Restaurar PortfolioCleanup originales si existe el backup
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PortfolioCleanup_backup' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM \"PortfolioCleanup\"';
        EXECUTE 'INSERT INTO \"PortfolioCleanup\" (id, name, description, \"cleanupDate\", \"fromDate\", \"toDate\", \"excludedLoansCount\", \"excludedAmount\", route, \"executedBy\", \"createdAt\", \"updatedAt\")
                 SELECT id, name, description, \"cleanupDate\", \"fromDate\", \"toDate\", \"excludedLoansCount\", \"excludedAmount\", route, \"executedBy\", \"createdAt\", \"updatedAt\"
                 FROM \"PortfolioCleanup_backup\"
                 ON CONFLICT (id) DO NOTHING';
        EXECUTE 'DROP TABLE \"PortfolioCleanup_backup\"';
    END IF;
END
\$\$;

-- Restaurar AuditLog originales si existe el backup
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AuditLog_backup' AND table_schema = 'public') THEN
        EXECUTE 'DELETE FROM \"AuditLog\"';
        EXECUTE 'INSERT INTO \"AuditLog\" (id, operation, \"modelName\", \"recordId\", \"userName\", \"userEmail\", \"userRole\", \"sessionId\", \"ipAddress\", \"userAgent\", \"previousValues\", \"newValues\", \"changedFields\", description, metadata, \"createdAt\", \"user\")
                 SELECT id, operation, \"modelName\", \"recordId\", \"userName\", \"userEmail\", \"userRole\", \"sessionId\", \"ipAddress\", \"userAgent\", \"previousValues\", \"newValues\", \"changedFields\", description, metadata, \"createdAt\", \"user\"
                 FROM \"AuditLog_backup\"
                 ON CONFLICT (id) DO NOTHING';
        EXECUTE 'DROP TABLE \"AuditLog_backup\"';
    END IF;
END
\$\$;
"

echo "🧹 Limpiando archivo temporal..."
rm -f "$DUMP_FILE"

echo ""
echo "✅ ¡Subida completada exitosamente!"
echo "🔒 Usuarios, logs y PortfolioCleanup de producción preservados"
echo "📊 Datos actualizados con información local"
echo "🌐 Verifica tu aplicación en producción"
