# Estructura Refactorizada de GraphQL

Este directorio contiene el código GraphQL refactorizado del proyecto Solufácil, dividido en módulos más pequeños y organizados.

## Estructura de Carpetas

```
graphql/
├── types/           # Tipos GraphQL y definiciones de esquema
│   ├── payment.ts   # Tipos relacionados con pagos
│   └── leader.ts    # Tipos relacionados con líderes
├── queries/         # Queries GraphQL organizadas por funcionalidad
│   ├── leaders.ts   # Queries de líderes y cumpleaños
│   └── transactions.ts # Queries de transacciones y resúmenes
├── mutations/       # Mutations GraphQL organizadas por funcionalidad
│   ├── dateMovement.ts # Mutations para mover fechas
│   └── payment.ts   # Mutations de pagos
├── utils/           # Funciones utilitarias
│   ├── number.ts    # Utilidades para manejo de números
│   ├── loan.ts      # Utilidades para préstamos
│   └── text.ts      # Utilidades para texto
├── services/        # Servicios externos
│   └── telegram.ts  # Servicios de Telegram
├── reports/         # Generación de reportes
│   ├── pdf.ts       # Funciones principales de PDF
│   └── documentErrors.ts # Reportes de errores de documentos
└── extendGraphqlSchema.ts # Archivo principal con extensiones
```

## Beneficios del Refactor

### 1. **Modularización**
- Cada archivo tiene una responsabilidad específica
- Código más fácil de mantener y debuggear
- Facilita el trabajo en equipo

### 2. **Reutilización**
- Las funciones utilitarias se pueden usar en múltiples lugares
- Tipos definidos una vez y reutilizados
- Servicios compartidos

### 3. **Escalabilidad**
- Fácil agregar nuevas funcionalidades
- Estructura clara para nuevos desarrolladores
- Permite crecimiento del proyecto sin caos

### 4. **Mantenibilidad**
- Bugs más fáciles de localizar
- Testing más granular
- Actualizaciones menos propensas a errores

## Uso

### Importar Tipos
```typescript
import { PaymentInput, LeadPaymentReceivedResponse } from './types/payment';
import { LeaderBirthdayType } from './types/leader';
```

### Importar Queries
```typescript
import { getLeadersBirthdays } from './queries/leaders';
import { getTransactionsSummary } from './queries/transactions';
```

### Importar Mutations
```typescript
import { moveLoansToDate, movePaymentsToDate } from './mutations/dateMovement';
import { createCustomLeadPaymentReceived } from './mutations/payment';
```

### Importar Utilidades
```typescript
import { safeToNumber } from './utils/number';
import { isLoanActiveOnDate } from './utils/loan';
import { sanitizeText } from './utils/text';
```

## Migración desde el Archivo Original

El archivo original `extendGraphqlSchema.ts` ha sido respaldado como `extendGraphqlSchema.backup.ts`. 

### Funcionalidad Movida:

1. **Tipos** → `types/`
2. **Queries** → `queries/`
3. **Mutations** → `mutations/`
4. **Utilidades** → `utils/`
5. **Reportes PDF** → `reports/`
6. **Servicios Telegram** → `services/`

### Funcionalidad Pendiente:

Algunas funciones más complejas aún necesitan ser extraídas del archivo backup:

- Queries adicionales (getMonthlyResume, getLoansReport, etc.)
- Mutations adicionales (updateCustomLeadPaymentReceived, etc.)
- Más funciones de reportes
- Funciones de limpieza de cartera

## Próximos Pasos

1. **Continuar extrayendo** el resto de queries y mutations del archivo backup
2. **Agregar tests unitarios** para cada módulo
3. **Documentar APIs** de cada función importante
4. **Optimizar imports** para mejorar rendimiento

## Notas Importantes

- **Compatibilidad**: Toda la funcionalidad existente se mantiene
- **Sin Breaking Changes**: La API GraphQL permanece igual
- **Backup Disponible**: El archivo original está respaldado
- **Imports Actualizados**: Todos los imports se han corregido para la nueva estructura
