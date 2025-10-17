# Scripts de Base de Datos

Este directorio contiene los scripts esenciales para gestionar la sincronización de datos entre el entorno local y producción.

## 📋 Scripts Disponibles

### 1. `copy-prod-to-local.sh` ⭐
**Copia datos de producción a local**

```bash
./scripts/copy-prod-to-local.sh
```

**Qué hace:**
- ✅ Copia todos los datos de producción a tu base de datos local
- ✅ Excluye la tabla `User` (para mantener tus credenciales locales)
- ✅ Arregla claves foráneas automáticamente
- ✅ Configura usuario de acceso automáticamente
- ✅ Preserva `PortfolioCleanup` y `AuditLog` de producción

**Credenciales por defecto:**
- Email: `elugo.isi@gmail.com`
- Password: `admin123`
- Rol: `ADMIN`

### 2. `fix-foreign-keys.sh` 🔧
**Arregla claves foráneas problemáticas**

```bash
./scripts/fix-foreign-keys.sh
```

**Qué hace:**
- ✅ Crea el usuario principal para desarrollo
- ✅ Genera hash real de password (no dummy)
- ✅ Actualiza referencias a usuarios inexistentes
- ✅ Se ejecuta automáticamente desde `copy-prod-to-local.sh`

## 🚀 Flujo de Trabajo Recomendado

### Para Desarrollo Local:
```bash
# 1. Copiar datos de producción a local
./scripts/copy-prod-to-local.sh

# 2. Acceder al admin
# Ir a: http://localhost:3000/signin
# Email: elugo.isi@gmail.com
# Password: admin123

# 3. Trabajar con los datos (agregar registros, modificar, etc.)
```

### Para Subir Cambios a Producción:
```bash
# 1. Usar el script de subida que prefieras
# (Los scripts de subida se eliminaron para simplificar)

# 2. Verificar que todo funcione en producción
node scripts/verify-deployment.js
```

## 🔧 Requisitos

- PostgreSQL local ejecutándose
- Archivo `.env` configurado con las variables necesarias
- Acceso a la base de datos de producción

### Configuración del archivo .env

Copia `env.example` a `.env` y configura las siguientes variables:

```bash
# Base de datos de producción (para scripts de sincronización)
PROD_DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# Base de datos local (para scripts de sincronización)
LOCAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/database_name
```

**Ejemplo:**
```bash
PROD_DATABASE_URL=postgresql://neondb_owner:password@ep-odd-water-adx100oh-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
LOCAL_DATABASE_URL=postgresql://postgres:test1234@localhost:5432/postgres
```

## 📊 Datos que se Sincronizan

- Préstamos (`Loan`)
- Pagos (`LoanPayment`)
- Transacciones (`Transaction`)
- Datos personales (`PersonalData`)
- Direcciones (`Address`)
- Teléfonos (`Phone`)
- Prestatarios (`Borrower`)
- Empleados (`Employee`)
- Rutas (`Route`)
- Cuentas (`Account`)
- Pagos de líderes (`LeadPaymentReceived`)
- Pagos compensatorios (`FalcoCompensatoryPayment`)
- PortfolioCleanup
- AuditLog

## 🛡️ Seguridad

- Los scripts incluyen verificaciones de seguridad
- Se crean usuarios con roles apropiados
- Se generan hashes reales de password
- Se preservan datos críticos de producción

## 📝 Notas

- **Solo 2 scripts esenciales** para mantener simplicidad
- **Scripts de subida eliminados** para evitar confusión
- **Enfoque en desarrollo local** con datos de producción
- **Usuario de desarrollo configurado automáticamente**

0.- ./scripts/upload-local-to-prod-safe.sh opcion 3 --- Only Dev
1.- ./scripts/copy-prod-to-local.sh

after that you need to execute this queries on your local db:

```sql
UPDATE "Employee" 
SET "user" = NULL 
WHERE "user" NOT IN (SELECT id FROM "User");

UPDATE "TelegramUser" 
SET "platformUser" = NULL 
WHERE "platformUser" NOT IN (SELECT id FROM "User");

DELETE FROM "_ReportConfig_recipients" 
WHERE "B" NOT IN (SELECT id FROM "User");
```

2.- Execute Seeder without clean db
3.- ./scripts/upload-data-only.sh
