# Recomendaciones de Performance para createCustomLeadPaymentReceived

## 1. Problema Principal
El error "Cannot read properties of undefined (reading 'toString')" en el servidor de desarrollo está relacionado con:
- **Latencia de red**: Mayor tiempo de respuesta entre la aplicación y la base de datos
- **Timeouts en transacciones**: Las transacciones largas pueden fallar o devolver datos incompletos
- **Objetos Decimal de Prisma**: En conexiones lentas, estos objetos pueden no cargarse completamente

## 2. Soluciones Implementadas

### A. Función `safeToNumber()`
```typescript
function safeToNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'object' && 'toNumber' in value) return value.toNumber();
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (typeof value === 'number') return value;
  try { return parseFloat(String(value)) || 0; } catch { return 0; }
}
```

### B. Índices de Base de Datos
Los índices más críticos para esta mutación son:

1. **idx_loanpayment_leadpaymentreceived_created** - Mejora la búsqueda de pagos creados
2. **idx_account_type** - Acelera la búsqueda de cuentas por tipo
3. **idx_transaction_loanpayment_lead** - Optimiza la creación de transacciones

## 3. Optimizaciones Adicionales Recomendadas

### A. Reducir el Número de Consultas
```typescript
// En lugar de findMany después de createMany, considera:
const createdPayments = await Promise.all(
  paymentData.map(data => 
    tx.loanPayment.create({ data })
  )
);
```

### B. Implementar Paginación para Grandes Volúmenes
Si se procesan muchos pagos, considera procesarlos en lotes:
```typescript
const BATCH_SIZE = 50;
for (let i = 0; i < payments.length; i += BATCH_SIZE) {
  const batch = payments.slice(i, i + BATCH_SIZE);
  // Procesar batch
}
```

### C. Usar Conexión de Pool Optimizada
En el archivo de configuración de Prisma:
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Aumentar timeouts para servidores remotos
  engineType: 'binary',
  log: ['query', 'info', 'warn', 'error'],
  // Configuración de pool
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=30',
    },
  },
});
```

### D. Implementar Caché para Datos Estáticos
Cachear datos que no cambian frecuentemente:
```typescript
// Cachear cuentas de ruta
const routeAccountsCache = new Map();

async function getRouteAccounts(routeId: string) {
  if (routeAccountsCache.has(routeId)) {
    return routeAccountsCache.get(routeId);
  }
  // Fetch and cache
}
```

## 4. Monitoreo y Debugging

### A. Agregar Métricas de Performance
```typescript
const startTime = Date.now();
// ... operación
console.log(`Operation took ${Date.now() - startTime}ms`);
```

### B. Query para Identificar Cuellos de Botella
```sql
-- Ver queries más lentas
SELECT 
    query,
    calls,
    mean_time,
    total_time
FROM pg_stat_statements
WHERE mean_time > 100  -- queries que toman más de 100ms
ORDER BY mean_time DESC;
```

## 5. Orden de Implementación

1. **Inmediato**: Aplicar los índices SQL proporcionados
2. **Corto plazo**: Implementar manejo de errores mejorado (ya hecho)
3. **Mediano plazo**: Optimizar consultas para reducir round-trips
4. **Largo plazo**: Implementar caché y paginación

## 6. Comando para Aplicar Índices

```bash
# Conectar a la base de datos de desarrollo
psql -h [host] -U [usuario] -d [database] -f optimize_indexes.sql

# O usando Prisma
npx prisma db execute --file ./optimize_indexes.sql
```

## 7. Validación Post-Implementación

Después de aplicar los cambios:

1. Verificar que los índices se crearon:
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('LoanPayment', 'Transaction', 'Account');
```

2. Monitorear el performance:
```sql
EXPLAIN ANALYZE 
SELECT * FROM "LoanPayment" 
WHERE "leadPaymentReceived" = '[test-id]';
```

3. Revisar los logs de la aplicación para confirmar que el error ya no ocurre.