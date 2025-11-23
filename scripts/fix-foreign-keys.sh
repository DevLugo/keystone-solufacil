#!/bin/bash

# Script para arreglar las restricciones de clave foránea después de copiar datos
# Uso: ./scripts/fix-foreign-keys.sh

set -e

echo "🔧 Arreglando restricciones de clave foránea..."

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
if [ -z "$LOCAL_DATABASE_URL" ]; then
    echo "❌ Error: Variable LOCAL_DATABASE_URL no configurada"
    echo "💡 Configura LOCAL_DATABASE_URL en tu archivo .env"
    exit 1
fi

LOCAL_DB="$LOCAL_DATABASE_URL"

# Crear el usuario principal para desarrollo
echo "👤 Creando usuario principal para desarrollo..."
# Intentar cargar nvm si node no está disponible
if ! command -v node &> /dev/null; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Generar hash real de password
if command -v node &> /dev/null; then
    PASSWORD_HASH=$(node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('admin123', 10));")
else
    echo "⚠️ Node no encontrado. Usando hash estático (puede no funcionar si la sal es incorrecta)."
    # Hash de ejemplo para 'admin123' (generado previamente)
    PASSWORD_HASH='$2b$10$8FzX/wZ5E1L.wO/x9.E1..YourFallbackHashHere' 
fi

psql "$LOCAL_DB" -c "
INSERT INTO \"User\" (id, name, email, password, role, \"createdAt\") 
VALUES (
  'user-admin-1', 
  'Admin User', 
  'elugo.isi@gmail.com', 
  '$PASSWORD_HASH', 
  'ADMIN', 
  NOW()
) 
ON CONFLICT (email) DO UPDATE SET
  password = '$PASSWORD_HASH',
  role = 'ADMIN',
  name = 'Admin User';
"

# Actualizar referencias a usuarios inexistentes
echo "🔄 Actualizando referencias a usuarios..."
psql "$LOCAL_DB" -c "
-- Actualizar PortfolioCleanup
UPDATE \"PortfolioCleanup\" 
SET \"executedBy\" = 'user-admin-1' 
WHERE \"executedBy\" IS NOT NULL 
AND \"executedBy\" NOT IN (SELECT id FROM \"User\");

-- Limpiar referencias en Employee (Fix FK error)
UPDATE \"Employee\" 
SET \"user\" = NULL 
WHERE \"user\" IS NOT NULL 
AND \"user\" NOT IN (SELECT id FROM \"User\");

-- Limpiar referencias en TelegramUser
UPDATE \"TelegramUser\" 
SET \"platformUser\" = NULL 
WHERE \"platformUser\" IS NOT NULL 
AND \"platformUser\" NOT IN (SELECT id FROM \"User\");
"

echo "✅ Restricciones de clave foránea arregladas"
echo "💡 Se creó un usuario temporal para mantener las referencias"
