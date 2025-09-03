# Fix para Error de Timeout de Transacción en createCustomLeadPaymentReceived

## Problema Identificado
El error "Cannot read properties of undefined (reading 'toString')" era un síntoma secundario del problema real:
- **Error primario**: `P2028 - Transaction already closed` (timeout de 5 segundos)
- **Causa**: La transacción excedía el timeout predeterminado de Prisma debido a la latencia del servidor de desarrollo

## Soluciones Implementadas

### 1. Aumentar Timeout de Transacción
```typescript
return await context.prisma.$transaction(async (tx) => {
  // ... código de la transacción
}, {
  maxWait: 30000, // 30 segundos de timeout máximo
  timeout: 30000, // 30 segundos de timeout de transacción
});
```

### 2. Procesamiento en Paralelo
Cambié el procesamiento secuencial de préstamos por procesamiento paralelo:

```typescript
// ANTES (secuencial - lento)
for (const loanId of affectedLoanIds) {
  const loan = await tx.loan.findUnique({...});
  await tx.loan.update({...});
}

// DESPUÉS (paralelo - rápido)
await Promise.all(affectedLoanIds.map(async (loanId) => {
  const loan = await tx.loan.findUnique({...});
  await tx.loan.update({...});
}));
```

### 3. Eliminación de Código Duplicado
- Eliminé el bucle duplicado que recalculaba métricas de préstamos
- Integré la verificación de préstamos completados en un solo bucle

### 4. Uso de `safeToNumber()`
Reemplacé todos los `parseFloat(value.toString())` con la función helper que maneja valores Decimal de Prisma correctamente.

### 5. Manejo de Errores Mejorado
```typescript
if (error instanceof Error && error.code === 'P2028') {
  throw new Error(
    'Timeout de transacción: La operación excedió el tiempo límite de 30 segundos. ' +
    'Esto puede deberse a la latencia de red con el servidor de base de datos.'
  );
}
```

## Mejoras de Performance Adicionales

### Ejecutar los índices SQL
```bash
psql -h servidor-dev -U usuario -d database -f optimize_indexes.sql
```

### Optimizaciones Pendientes (si el problema persiste)

1. **Dividir la Transacción**
   ```typescript
   // Procesar en lotes más pequeños
   const BATCH_SIZE = 5;
   for (let i = 0; i < payments.length; i += BATCH_SIZE) {
     const batch = payments.slice(i, i + BATCH_SIZE);
     await processBatch(batch);
   }
   ```

2. **Implementar Queue/Jobs**
   - Usar Bull o similar para procesar pagos de forma asíncrona
   - Dividir la operación en trabajos más pequeños

3. **Optimizar Consultas de Préstamos**
   ```typescript
   // En lugar de múltiples findUnique, usar una sola consulta
   const loans = await tx.loan.findMany({
     where: { id: { in: affectedLoanIds } },
     include: { loantype: true, payments: true }
   });
   ```

4. **Cachear Datos Estáticos**
   - Cachear tipos de préstamo
   - Cachear cuentas de rutas

## Monitoreo
Para verificar que las mejoras funcionan:

```sql
-- Ver tiempo promedio de las transacciones
SELECT 
  query,
  calls,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%leadPaymentReceived%'
ORDER BY mean_time DESC;
```

## Resultado Esperado
- Las transacciones deberían completarse en menos de 30 segundos
- No más errores de "Cannot read properties of undefined"
- Mejor experiencia de usuario en el servidor de desarrollo