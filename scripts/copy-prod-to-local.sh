#!/bin/bash

# Script para copiar datos de producción a local
# Uso: ./scripts/copy-prod-to-local.sh

set -e  # Salir si hay algún error

echo "🔄 Iniciando copia de base de datos de producción a local..."

# Cargar variables de entorno
if [ -f .env ]; then
    # Cargar variables de forma segura
    while IFS= read -r line; do
        # Saltar líneas vacías y comentarios
        if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
            # Exportar variable
            export "$line"
        fi
    done < .env
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
DUMP_FILE="temp_prod_dump.sql"

echo "📥 Creando dump de la base de datos de producción..."
pg_dump "$PROD_DB" \
  --schema=public \
  --exclude-table-data='"User"' \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  --no-security-labels \
  --no-comments \
  --clean \
  --if-exists \
  > "$DUMP_FILE"

echo "🔧 Limpiando referencias a usuarios inexistentes..."
# Crear un archivo temporal para limpiar las referencias
CLEANED_DUMP="temp_cleaned_dump.sql"

# Solo comentar las restricciones problemáticas específicas
sed -E '
  # Comentar solo las restricciones específicas que causan problemas
  s/ADD CONSTRAINT "PortfolioCleanup_executedBy_fkey"/-- ADD CONSTRAINT "PortfolioCleanup_executedBy_fkey"/
  s/ADD CONSTRAINT "LeadPaymentReceived_createdBy_fkey"/-- ADD CONSTRAINT "LeadPaymentReceived_createdBy_fkey"/
  s/ADD CONSTRAINT "LeadPaymentReceived_updatedBy_fkey"/-- ADD CONSTRAINT "LeadPaymentReceived_updatedBy_fkey"/
  s/ADD CONSTRAINT "FalcoCompensatoryPayment_createdBy_fkey"/-- ADD CONSTRAINT "FalcoCompensatoryPayment_createdBy_fkey"/
  s/ADD CONSTRAINT "FalcoCompensatoryPayment_updatedBy_fkey"/-- ADD CONSTRAINT "FalcoCompensatoryPayment_updatedBy_fkey"/
' "$DUMP_FILE" > "$CLEANED_DUMP"

# Reemplazar el archivo original con el limpio
mv "$CLEANED_DUMP" "$DUMP_FILE"

echo "🗑️ Limpiando base de datos local..."
psql "$LOCAL_DB" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

echo "📤 Restaurando datos en base de datos local..."
psql "$LOCAL_DB" < "$DUMP_FILE"

echo "🔧 Arreglando restricciones de clave foránea..."
# Ejecutar el script de arreglo de claves foráneas
./scripts/fix-foreign-keys.sh

echo "🔑 Verificando usuario de acceso..."
# Verificar que el usuario se creó correctamente
psql "$LOCAL_DB" -c "SELECT id, name, email, role FROM \"User\" WHERE email = 'elugo.isi@gmail.com';"

echo "🧹 Limpiando archivo temporal..."
rm "$DUMP_FILE"

echo "✅ ¡Copia completada exitosamente!"
echo "📊 Tu base de datos local ahora tiene los datos de producción"
echo ""
echo "🔑 Credenciales de acceso:"
echo "   Email: elugo.isi@gmail.com"
echo "   Password: admin123"
echo ""
echo "💡 Puedes agregar tus miles de registros y luego usar el script de subida"
