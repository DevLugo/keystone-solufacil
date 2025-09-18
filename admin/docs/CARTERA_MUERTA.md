# Módulo de Cartera Muerta

## Descripción
Módulo completo para la gestión de cartera muerta que permite identificar, filtrar y marcar créditos como cartera muerta basado en criterios configurables.

## Funcionalidades

### 1. Filtros Configurables
- **Semanas desde el crédito**: Filtro por mínimo de semanas transcurridas desde que se otorgó el crédito (default: 17 semanas)
- **Semanas sin pago**: Filtro por mínimo de semanas consecutivas sin realizar pagos (default: 4 semanas)
- **Filtro por ruta**: Permite filtrar por ruta específica (opcional)
- **Filtro por mes**: Permite ver créditos ya marcados como cartera muerta en un mes específico

### 2. Visualización de Datos
- **Resumen por localidad**: Muestra agrupación por localidad con totales de créditos y montos
- **Tabla de créditos elegibles**: Lista detallada de créditos que cumplen los criterios
- **Información detallada**: Cliente, líder, localidad, monto pendiente, semanas desde crédito, semanas sin pago

### 3. Gestión de Cartera Muerta
- **Selección múltiple**: Posibilidad de seleccionar créditos individuales o todos
- **Modal de confirmación**: Confirmación antes de marcar como cartera muerta
- **Fecha personalizable**: Selección de fecha para marcar como cartera muerta
- **Actualization en tiempo real**: La interfaz se actualiza después de marcar créditos

## Estructura de Archivos

### Frontend (React/TypeScript)
```
admin/
├── components/dead-debt/
│   ├── DeadDebtFilters.tsx          # Componente de filtros
│   ├── DeadDebtSummary.tsx          # Componente de resumen por localidad
│   ├── DeadDebtTable.tsx            # Componente de tabla de créditos
│   └── DeadDebtConfirmationModal.tsx # Modal de confirmación
├── graphql/
│   ├── queries/dead-debt.ts         # Queries GraphQL
│   └── mutations/dead-debt.ts       # Mutaciones GraphQL
├── types/dead-debt.ts               # Tipos TypeScript
└── pages/cartera-muerta.tsx         # Página principal
```

### Backend (GraphQL Extensions)
```
graphql/
├── deadDebtExtensions.ts            # Extensiones GraphQL organizadas
├── deadDebtSimple.ts               # Extensiones GraphQL simplificadas
└── deadDebtAdditions.ts            # Código para agregar al schema existente
```

## Criterios de Elegibilidad

Un crédito es elegible para cartera muerta cuando cumple **TODOS** estos criterios:

1. **Estado ACTIVO**: El crédito debe estar en estado activo
2. **No marcado previamente**: No debe tener ya una fecha de cartera muerta (`badDebtDate` debe ser `null`)
3. **Tiempo desde crédito**: Debe haber pasado el mínimo de semanas desde que se otorgó
4. **Tiempo sin pagos**: Debe haber pasado el mínimo de semanas sin recibir pagos

## Queries GraphQL

### `loansForDeadDebt`
Obtiene los créditos elegibles para cartera muerta.

**Parámetros:**
- `weeksSinceLoan`: Int! - Semanas mínimas desde el crédito
- `weeksWithoutPayment`: Int! - Semanas mínimas sin pago
- `routeId`: String - ID de ruta (opcional)

### `deadDebtSummary`
Obtiene el resumen agrupado por localidad.

**Parámetros:**
- `weeksSinceLoan`: Int! - Semanas mínimas desde el crédito
- `weeksWithoutPayment`: Int! - Semanas mínimas sin pago
- `routeId`: String - ID de ruta (opcional)

### `deadDebtByMonth`
Obtiene créditos ya marcados como cartera muerta en un mes específico.

**Parámetros:**
- `month`: Int! - Mes (1-12)
- `year`: Int! - Año

## Mutaciones GraphQL

### `markLoansDeadDebt`
Marca los créditos seleccionados como cartera muerta.

**Parámetros:**
- `loanIds`: [ID!]! - IDs de los créditos a marcar
- `badDebtDate`: String! - Fecha para marcar como cartera muerta

**Retorna:**
```json
{
  "success": boolean,
  "message": string,
  "updatedCount": number,
  "errors": [
    {
      "loanId": string,
      "message": string
    }
  ]
}
```

### `removeDeadDebtStatus`
Remueve el estatus de cartera muerta de los créditos seleccionados.

**Parámetros:**
- `loanIds`: [ID!]! - IDs de los créditos

## Configuración de Navegación

El módulo está disponible en el menú de administración bajo:
**Administración del Sistema > Cartera Muerta**

Solo usuarios con rol `ADMIN` pueden acceder a este módulo.

## Integración con el Schema

Para integrar las extensiones GraphQL al schema existente, agregar el contenido de cualquiera de estos archivos al `extendGraphqlSchema.ts`:

1. `deadDebtExtensions.ts` - Versión completa y organizada
2. `deadDebtSimple.ts` - Versión simplificada
3. `deadDebtAdditions.ts` - Código listo para copiar y pegar

## Consideraciones Técnicas

### Performance
- Las queries incluyen índices en campos críticos (`signDate`, `badDebtDate`, `status`)
- Se utilizan filtros a nivel de base de datos para optimizar rendimiento
- Los resultados se paginarían automáticamente si el volumen de datos aumenta

### Seguridad
- Solo usuarios con rol `ADMIN` pueden marcar créditos como cartera muerta
- Todas las operaciones son registradas en logs de auditoría
- Las fechas son validadas antes de procesar

### Usabilidad
- Interfaz responsiva que funciona en dispositivos móviles
- Indicadores visuales para diferentes estados de créditos
- Confirmación requerida antes de acciones irreversibles
- Mensajes de feedback claros para el usuario

## Futuras Mejoras

1. **Exportación**: Agregar funcionalidad para exportar listas a Excel/PDF
2. **Notificaciones**: Envío de notificaciones automáticas por Telegram
3. **Reportes automatizados**: Generación automática de reportes mensuales
4. **Historial**: Registro de cambios de estatus de cartera muerta
5. **Filtros avanzados**: Más opciones de filtrado por cliente, tipo de crédito, etc.

