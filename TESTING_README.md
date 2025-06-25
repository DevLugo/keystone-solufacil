# 🧪 Testing Setup - Cypress con Base de Datos Aislada

## 📋 Configuración Completa

Esta configuración permite hacer testing visual completo de la página de transacciones usando **Cypress** con una **base de datos PostgreSQL aislada en memoria**.

### 🗂️ Estructura Creada

```
├── cypress/
│   ├── e2e/
│   │   └── transacciones.cy.ts    # Tests principales
│   └── support/
│       ├── database.ts            # Utilidades de BD
│       └── seed.ts               # Script de seed
├── docker-compose.test.yml        # PostgreSQL para testing
├── cypress.config.ts              # Configuración de Cypress
├── env.test                       # Variables de ambiente para testing
└── TESTING_README.md              # Esta documentación
```

## 🚀 Instalación y Setup

### 1. Instalar Dependencias

```bash
yarn install
```

### 2. Verificar Docker

Asegúrate de que Docker esté instalado y corriendo:

```bash
# Verificar Docker
docker --version

# Verificar Docker Compose (versión moderna)
docker compose version
```

**⚠️ Nota sobre Docker Compose:**
- **Versión moderna**: `docker compose` (sin guión) - integrado en Docker Desktop
- **Versión legacy**: `docker-compose` (con guión) - instalación separada

Si tienes problemas con `docker compose`, consulta la sección de troubleshooting.

**🐋 Iniciar Docker:**
```bash
# En macOS - abrir Docker Desktop
open -a Docker

# Verificar que Docker esté corriendo
docker ps
```

Si obtienes el error "Cannot connect to the Docker daemon", significa que Docker Desktop no está corriendo.

### 3. Configurar Variables de Ambiente

El archivo `env.test` ya está configurado con:
- Base de datos PostgreSQL en puerto 5433
- Configuración optimizada para testing en memoria

### 4. Levantar Base de Datos de Testing

```bash
# Levantar PostgreSQL en Docker (primera vez)
yarn test:setup

# Aplicar migraciones a la BD de test
yarn test:db:migrate

# Poblar con datos de prueba
yarn test:db:seed
```

## 🎯 Datos de Seed Incluidos

El seed crea automáticamente:

### 📍 **Ruta Base**
- **Nombre**: "Ruta Test Principal"
- **Líder**: Ana María González - Líder Test
- **10 Clientas** con nombres realistas (usando Faker)

### 💰 **Cuentas Financieras**
- **Cuenta Banco Test**: $100,000 iniciales
- **Cuenta Asesor Test**: $50,000 iniciales

### 📊 **Préstamos de Ejemplo**
- 5 préstamos activos con montos de $5,000 a $9,000
- Datos completos de avales y comisiones

## 🧪 Ejecutar Tests

### Modo Desarrollo (Interfaz Visual)
```bash
yarn test:e2e:dev
```
Este comando:
1. ✅ Levanta PostgreSQL en Docker
2. ✅ Aplica migraciones
3. ✅ Ejecuta seed de datos
4. ✅ Abre Cypress en modo interactivo

### Modo CI/CD (Headless)
```bash
yarn test:e2e
```
Este comando ejecuta todo automáticamente y genera reportes.

### Solo Cypress (BD ya configurada)
```bash
yarn cypress:open   # Modo visual
yarn cypress:run    # Modo headless
```

## 📸 Tests Visuales Incluidos

### 🏠 **Estado Inicial y Navegación**
- Screenshot de página inicial
- Navegación entre todos los tabs
- Verificación de elementos UI

### 💸 **Transferencias Completas**
- ✅ Estado sin ruta seleccionada
- ✅ Carga de cuentas al seleccionar ruta
- ✅ Transferencia normal (Banco → Asesor)
- ✅ Inversión de capital (sin cuenta origen)
- ✅ Validación de saldos insuficientes
- ✅ Prevención de transferencia a misma cuenta

### 💰 **Validación de Balances**
- Verificación en base de datos después de cada operación
- Consistencia entre tabs
- Balance total siempre conservado

### 🔄 **Flujo Completo de Día**
- Múltiples transferencias consecutivas
- Validación matemática de balances finales
- Screenshots de cada paso

## 📊 Ejemplos de Tests

### Test de Transferencia Simple
```typescript
it('debe realizar transferencia normal completa', () => {
  cy.get('[data-testid="route-selector"]').select('Ruta Test Principal');
  cy.get('[data-testid="source-account"]').select('Cuenta Banco Test');
  cy.get('[data-testid="destination-account"]').select('Cuenta Asesor Test');
  cy.get('[data-testid="amount-input"]').type('5000');
  cy.get('[data-testid="submit-button"]').click();
  
  // Verificar éxito y balances
  cy.task('db:getAccountBalances').then((balances) => {
    expect(balances.find(acc => acc.name === 'Cuenta Banco Test').amount)
      .to.equal(95000); // 100k - 5k
  });
});
```

### Test de Inversión de Capital
```typescript
it('debe manejar inversión de capital', () => {
  cy.get('[data-testid="capital-investment-checkbox"]').check();
  cy.get('[data-testid="destination-account"]').select('Cuenta Banco Test');
  cy.get('[data-testid="amount-input"]').type('10000');
  cy.get('[data-testid="submit-button"]').click();
  
  // Verificar que se agregó dinero al sistema
  cy.task('db:getAccountBalances').then((balances) => {
    expect(balances.find(acc => acc.name === 'Cuenta Banco Test').amount)
      .to.equal(110000); // 100k + 10k
  });
});
```

## 🔧 Tareas de Base de Datos Disponibles

Cypress tiene acceso a estas tareas personalizadas:

```typescript
// Limpiar y resetear datos
cy.task('db:seed')

// Crear datos específicos
cy.task('db:create', {
  type: 'transaction',
  payload: { amount: 1000, type: 'TRANSFER' }
})

// Verificar datos
cy.task('db:verify', {
  type: 'transaction',
  amount: 1000
})

// Obtener balances actuales
cy.task('db:getAccountBalances')
```

## 📱 Screenshots y Videos

Los tests generan automáticamente:
- **Screenshots**: En `cypress/screenshots/` organizados por fecha
- **Videos**: En `cypress/videos/` de tests fallidos
- **Evidencia Visual**: De cada paso importante

### Ejemplos de Screenshots Generados:
```
01-transacciones-inicial.png
02-tab-transfers.png
03-transferencias-sin-ruta.png
04-transferencias-ruta-seleccionada.png
05-transferencias-cuentas-disponibles.png
06-transferencia-formulario-completo.png
07-transferencia-exitosa.png
08-transferencia-balances-validados.png
...
```

## 🛠️ Comandos Útiles

```bash
# Resetear BD completamente
yarn test:db:reset

# Solo aplicar migraciones
yarn test:db:migrate

# Solo ejecutar seed
yarn test:db:seed

# Bajar containers de Docker
yarn test:teardown

# Ver logs de PostgreSQL
docker logs solufacil-test-db
```

## 🚨 Troubleshooting

### Docker Daemon no está corriendo

**Error**: `Cannot connect to the Docker daemon`

**Solución:**
```bash
# 1. Abrir Docker Desktop (macOS)
open -a Docker

# 2. Esperar que Docker se inicie (puede tomar 1-2 minutos)
# Verás el ícono de Docker en la barra de menú

# 3. Verificar que Docker esté corriendo
docker ps

# 4. Si todavía no funciona, reiniciar Docker Desktop
# Ir a Docker Desktop > Troubleshoot > Restart Docker Desktop
```

**Verificación paso a paso:**
```bash
# Paso 1: ¿Docker está instalado?
docker --version

# Paso 2: ¿Docker Compose está disponible?
docker compose version

# Paso 3: ¿El daemon está corriendo?
docker ps
# Si funciona, verás una tabla (puede estar vacía)

# Paso 4: ¿El puerto 5433 está libre?
lsof -i :5433
# Si no hay salida, el puerto está libre
```

### Docker Compose no encontrado

**Error**: `docker-compose: command not found`

**Solución 1 - Docker Desktop moderno (recomendado):**
```bash
# Los scripts ya usan la sintaxis moderna
yarn test:setup
```

**Solución 2 - Si tienes docker-compose legacy:**
```bash
# Ejecutar manualmente con docker-compose
docker-compose -f docker-compose.test.yml up -d
```

**Solución 3 - Instalar Docker Compose plugin:**
```bash
# En macOS con Homebrew
brew install docker-compose

# En Ubuntu/Debian
sudo apt-get install docker-compose-plugin

# Verificar instalación
docker compose version
```

### PostgreSQL no inicia
```bash
# Verificar que el puerto 5433 esté libre
lsof -i :5433

# Forzar reinicio del container
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d

# Si tienes docker-compose legacy:
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

### Error en migraciones
```bash
# Resetear BD desde cero
yarn test:db:reset
yarn test:db:migrate
yarn test:db:seed
```

### Tests fallan por timeouts
- Los tests esperan hasta 10 segundos por elementos
- La BD en memoria es muy rápida
- Verifica que el servidor esté corriendo en puerto 3000

### Verificar estado de containers
```bash
# Ver containers corriendo
docker ps

# Ver logs del container de testing
docker logs solufacil-test-db

# Entrar al container para debugging
docker exec -it solufacil-test-db psql -U test_user -d solufacil_test
```

## ✅ Próximos Pasos

1. **Agregar tests para otros tabs**:
   - Gastos
   - Créditos  
   - Abonos
   - Resumen

2. **Tests de performance**:
   - Medir tiempos de carga
   - Testing de stress con múltiples operaciones

3. **Tests cross-browser**:
   - Firefox
   - Safari
   - Mobile

4. **Integración CI/CD**:
   - GitHub Actions
   - Reportes automáticos

---

**💡 La BD es completamente aislada y se resetea en cada test, así que puedes experimentar sin miedo.** 