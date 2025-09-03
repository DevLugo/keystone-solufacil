# Guía de Optimización de Rendimiento

## 🚀 Cambios Implementados para Mejorar el Rendimiento

### 1. **Índices de Base de Datos** 📊

Se creó un archivo de migración SQL que agrega índices críticos para mejorar las queries:

#### Ejecutar la migración:
```bash
# Configurar la URL de la base de datos
export DATABASE_URL='postgresql://usuario:password@host:puerto/database'

# Ejecutar el script de migración
cd /workspace/migrations
./run_performance_migration.sh
```

**Índices agregados:**
- `Transaction`: date, type, leadId, combinaciones
- `Loan`: signDate, status, finishedDate, leadId, combinaciones
- `LoanPayment`: receivedAt, type, paymentMethod, loanId, combinaciones
- Índices parciales para queries específicas

### 2. **Queries Optimizadas** 🎯

Se crearon nuevas queries GraphQL optimizadas en `/workspace/admin/graphql/queries/optimized.ts`:

- **GET_LOANS_OPTIMIZED**: Con paginación y campos selectivos
- **GET_LEAD_PAYMENTS_OPTIMIZED**: Con paginación para pagos
- **COUNT_ACTIVE_LOANS**: Query específica para contar sin cargar datos
- **CHECK_MIGRATED_PAYMENTS**: Verificación eficiente de pagos migrados

### 3. **Sistema de Cache para Cálculos** 💾

Se implementó un hook de cache en `/workspace/admin/hooks/useCalculationsCache.ts`:

- Cache en memoria para cálculos costosos
- Duración de cache: 5 minutos
- Invalidación selectiva o completa
- Hooks específicos para préstamos y transacciones

### 4. **Componentes Optimizados** ⚡

Se crearon versiones optimizadas de los componentes:

#### CreditosTab.optimized.tsx
- Paginación implementada (20 items por página)
- Queries separadas para contar vs. cargar datos
- Memoización de cálculos
- Lazy loading con botón "Cargar más"

#### AbonosTab.optimized.tsx
- Paginación implementada (50 items por página)
- Cálculos con memoización
- Eliminación de duplicados con Set
- Formateo de fechas optimizado

## 📝 Pasos para Implementar

### 1. Ejecutar la migración de base de datos
```bash
cd /workspace/migrations
./run_performance_migration.sh
```

### 2. Reemplazar los componentes actuales

```bash
# Backup de los componentes originales
cp /workspace/admin/components/transactions/CreditosTab.tsx /workspace/admin/components/transactions/CreditosTab.backup.tsx
cp /workspace/admin/components/transactions/abonosTab.tsx /workspace/admin/components/transactions/abonosTab.backup.tsx

# Copiar los componentes optimizados
cp /workspace/admin/components/transactions/CreditosTab.optimized.tsx /workspace/admin/components/transactions/CreditosTab.tsx
cp /workspace/admin/components/transactions/AbonosTab.optimized.tsx /workspace/admin/components/transactions/abonosTab.tsx
```

### 3. Actualizar las importaciones donde se usen estos componentes

### 4. Monitorear el rendimiento

## 🔍 Monitoreo y Mantenimiento

### Verificar uso de índices:
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('Transaction', 'Loan', 'LoanPayment')
ORDER BY idx_scan DESC;
```

### Identificar queries lentas:
```sql
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
WHERE query LIKE '%Transaction%' 
   OR query LIKE '%Loan%'
ORDER BY mean_time DESC
LIMIT 20;
```

### Mantenimiento periódico:
```sql
-- Ejecutar semanalmente
VACUUM ANALYZE "Transaction";
VACUUM ANALYZE "Loan";
VACUUM ANALYZE "LoanPayment";
```

## 🎯 Mejoras Adicionales Sugeridas

1. **Implementar Redis para cache distribuido**
   - Cache de queries frecuentes
   - Cache de sesión
   - Invalidación inteligente

2. **Optimizar el schema de GraphQL**
   - Implementar DataLoader para N+1 queries
   - Usar field resolvers más eficientes
   - Implementar query complexity analysis

3. **Agregar índices adicionales según uso**
   - Monitorear pg_stat_statements
   - Identificar patrones de queries
   - Crear índices específicos

4. **Considerar particionamiento de tablas**
   - Particionar Transaction por fecha
   - Particionar LoanPayment por fecha
   - Mejorar performance de queries históricas

## 📊 Resultados Esperados

Con estas optimizaciones, se espera:
- **50-70% reducción** en tiempo de carga inicial
- **80% reducción** en queries de conteo
- **Paginación fluida** sin cargar todos los datos
- **Mejor experiencia de usuario** con lazy loading
- **Menor uso de memoria** en el cliente

## ⚠️ Consideraciones

1. Los índices ocupan espacio adicional en disco
2. Las inserciones pueden ser ligeramente más lentas
3. Monitorear el uso real de índices
4. Ajustar la configuración de PostgreSQL si es necesario

## 🆘 Troubleshooting

Si las páginas siguen lentas después de la optimización:

1. Verificar que los índices se crearon correctamente
2. Revisar el plan de ejecución de queries problemáticas
3. Verificar la configuración de PostgreSQL (shared_buffers, work_mem)
4. Considerar agregar más recursos al servidor de base de datos
5. Implementar cache adicional con Redis