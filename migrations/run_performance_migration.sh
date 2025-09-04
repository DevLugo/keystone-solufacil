#!/bin/bash

# Script para ejecutar la migración de índices de rendimiento
# Este script puede ejecutarse múltiples veces sin problemas

echo "================================================"
echo "MIGRACIÓN DE ÍNDICES DE RENDIMIENTO"
echo "================================================"
echo ""

# Verificar si se proporcionó la URL de la base de datos
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: La variable DATABASE_URL no está definida."
    echo "Por favor, define DATABASE_URL antes de ejecutar este script."
    echo ""
    echo "Ejemplo:"
    echo "  export DATABASE_URL='postgresql://usuario:password@host:puerto/database'"
    echo "  ./run_performance_migration.sh"
    echo ""
    exit 1
fi

# Archivo de migración
MIGRATION_FILE="add_performance_indexes.sql"

# Verificar que el archivo existe
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "ERROR: No se encontró el archivo $MIGRATION_FILE"
    exit 1
fi

echo "Conectando a la base de datos..."
echo ""

# Ejecutar la migración
psql "$DATABASE_URL" -f "$MIGRATION_FILE" -v ON_ERROR_STOP=1

# Verificar el resultado
if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "✅ MIGRACIÓN COMPLETADA EXITOSAMENTE"
    echo "================================================"
    echo ""
    echo "Los índices han sido creados/verificados correctamente."
    echo "El rendimiento de las queries debería mejorar significativamente."
    echo ""
    echo "Próximos pasos recomendados:"
    echo "1. Monitorear el rendimiento de la aplicación"
    echo "2. Verificar los logs de queries lentas"
    echo "3. Ejecutar VACUUM ANALYZE periódicamente"
    echo ""
else
    echo ""
    echo "================================================"
    echo "❌ ERROR EN LA MIGRACIÓN"
    echo "================================================"
    echo ""
    echo "Hubo un error al ejecutar la migración."
    echo "Por favor, revisa los mensajes de error anteriores."
    echo ""
    exit 1
fi