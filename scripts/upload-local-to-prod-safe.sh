#!/bin/bash

# Script SEGURO para subir datos modificados de local a producción
# Uso: ./scripts/upload-local-to-prod-safe.sh

set -e

echo "🔄 Script SEGURO para subir datos a producción"
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

# Función para subir solo datos
upload_data_only() {
    echo "📥 Creando dump de datos (excluyendo usuarios, logs y limpiezas)..."
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
    # Restaurar datos importantes originales
    psql "$PROD_DB" -c "
    SET search_path TO public;

    -- Restaurar usuarios originales (mantener solo el usuario temporal)
    DELETE FROM public.\"User\" WHERE email = 'elugo.isi@gmail.com';
    INSERT INTO public.\"User\" (id, name, email, password, role, \"createdAt\")
    SELECT id, name, email, password, role, \"createdAt\"
    FROM \"User_backup\"
    ON CONFLICT (id) DO NOTHING;

    -- Restaurar PortfolioCleanup originales
    DELETE FROM public.\"PortfolioCleanup\";
    INSERT INTO public.\"PortfolioCleanup\" (id, name, description, \"cleanupDate\", \"fromDate\", \"toDate\", \"excludedLoansCount\", \"excludedAmount\", route, \"executedBy\", \"createdAt\", \"updatedAt\")
    SELECT id, name, description, \"cleanupDate\", \"fromDate\", \"toDate\", \"excludedLoansCount\", \"excludedAmount\", route, \"executedBy\", \"createdAt\", \"updatedAt\"
    FROM \"PortfolioCleanup_backup\"
    ON CONFLICT (id) DO NOTHING;

    -- Restaurar AuditLog originales
    DELETE FROM public.\"AuditLog\";
    INSERT INTO public.\"AuditLog\" (id, \"entityType\", \"entityId\", operation, \"oldData\", \"newData\", \"userId\", \"createdAt\")
    SELECT id, \"entityType\", \"entityId\", operation, \"oldData\", \"newData\", \"userId\", \"createdAt\"
    FROM \"AuditLog_backup\"
    ON CONFLICT (id) DO NOTHING;

    -- Limpiar tablas de backup
    DROP TABLE \"User_backup\";
    DROP TABLE \"PortfolioCleanup_backup\";
    DROP TABLE \"AuditLog_backup\";
    "

    echo "✅ ¡Subida completada exitosamente!"
    echo "🔒 Usuarios, logs y PortfolioCleanup de producción preservados"
    echo "📊 Datos actualizados con información local"
}

# Función para subir datos y usuarios
upload_data_and_users() {
    echo "📥 Creando dump completo (incluyendo usuarios)..."
    pg_dump "$LOCAL_DB" \
      --schema=public \
      --no-owner \
      --no-privileges \
      --no-tablespaces \
      --no-security-labels \
      --no-comments \
      --clean \
      --if-exists \
      > "$DUMP_FILE"

    echo "🗑️ Limpiando base de datos de producción..."
    psql "$PROD_DB" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

    echo "📤 Restaurando datos completos en base de datos de producción..."
    psql "$PROD_DB" < "$DUMP_FILE"

    echo "✅ ¡Subida completada exitosamente!"
    echo "⚠️  Usuarios de producción sobrescritos"
    echo "📊 Datos y usuarios actualizados"
}

# Función para limpiar todo excepto usuarios
clean_all_except_users() {
    echo "📥 Creando dump completo (incluyendo usuarios)..."
    pg_dump "$LOCAL_DB" \
      --schema=public \
      --no-owner \
      --no-privileges \
      --no-tablespaces \
      --no-security-labels \
      --no-comments \
      --clean \
      --if-exists \
      > "$DUMP_FILE"

    echo "🔒 Preservando usuarios de producción..."
    # Crear backup solo de usuarios
    psql "$PROD_DB" -c "
    SET search_path TO public;
    CREATE TABLE IF NOT EXISTS \"User_backup\" AS 
    SELECT * FROM public.\"User\";
    "

    echo "🗑️ Limpiando todas las tablas excepto usuarios..."
    # Eliminar todas las tablas excepto User y User_backup
    psql "$PROD_DB" -c "
    SET search_path TO public;
    
    -- Eliminar todas las tablas excepto User y User_backup
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
    DROP TABLE IF EXISTS \"PortfolioCleanup\" CASCADE;
    DROP TABLE IF EXISTS \"AuditLog\" CASCADE;
    DROP TABLE IF EXISTS \"Password\" CASCADE;
    DROP TABLE IF EXISTS \"CommissionPayment\" CASCADE;
    DROP TABLE IF EXISTS \"DocumentPhoto\" CASCADE;
    DROP TABLE IF EXISTS \"LeadPaymentType\" CASCADE;
    DROP TABLE IF EXISTS \"Location\" CASCADE;
    DROP TABLE IF EXISTS \"Municipality\" CASCADE;
    DROP TABLE IF EXISTS \"ReportConfig\" CASCADE;
    DROP TABLE IF EXISTS \"ReportExecutionLog\" CASCADE;
    DROP TABLE IF EXISTS \"State\" CASCADE;
    DROP TABLE IF EXISTS \"TelegramUser\" CASCADE;
    DROP TABLE IF EXISTS \"Loantype\" CASCADE;
    -- Mantener User y User_backup
    "

    echo "📤 Restaurando datos completos en base de datos de producción..."
    psql "$PROD_DB" < "$DUMP_FILE"

    echo "🔄 Restaurando usuarios originales..."
    # Restaurar usuarios originales
    psql "$PROD_DB" -c "
    SET search_path TO public;

    -- Restaurar usuarios originales (mantener solo el usuario temporal)
    DELETE FROM public.\"User\" WHERE email = 'elugo.isi@gmail.com';
    INSERT INTO public.\"User\" (id, name, email, password, role, \"createdAt\")
    SELECT id, name, email, password, role, \"createdAt\"
    FROM \"User_backup\"
    ON CONFLICT (id) DO NOTHING;

    -- Limpiar tabla de backup
    DROP TABLE \"User_backup\";
    "

    echo "✅ ¡Limpieza y subida completada exitosamente!"
    echo "🔒 Usuarios de producción preservados"
    echo "📊 Todas las demás tablas actualizadas con datos locales"
}

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
echo "⚠️  OPCIONES DE SUBIDA:"
echo "1. Solo datos (preservar usuarios, logs y limpiezas de producción) - RECOMENDADO"
echo "2. Datos + usuarios locales (sobrescribir usuarios)"
echo "3. Limpiar todo excepto usuarios (subir datos locales completos)"
echo "4. Cancelar"
echo ""
read -p "Selecciona una opción (1-4): " choice

case $choice in
    1)
        echo "✅ Opción 1: Solo datos (preservando usuarios)"
        upload_data_only
        ;;
    2)
        echo "⚠️  Opción 2: Datos + usuarios (sobrescribiendo usuarios)"
        echo "¿Estás SEGURO de que quieres sobrescribir los usuarios de producción? (y/N)"
        read -r confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            upload_data_and_users
        else
            echo "❌ Operación cancelada"
            exit 1
        fi
        ;;
    3)
        echo "🧹 Opción 3: Limpiar todo excepto usuarios"
        echo "¿Estás SEGURO de que quieres limpiar todas las tablas excepto usuarios? (y/N)"
        read -r confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            clean_all_except_users
        else
            echo "❌ Operación cancelada"
            exit 1
        fi
        ;;
    4)
        echo "❌ Operación cancelada"
        exit 0
        ;;
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

# Limpiar archivo temporal
echo "🧹 Limpiando archivo temporal..."
rm -f "$DUMP_FILE"

echo ""
echo "🎉 ¡Proceso completado!"
echo "🌐 Verifica tu aplicación en producción"
