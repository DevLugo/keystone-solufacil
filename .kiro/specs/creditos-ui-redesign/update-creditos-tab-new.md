# Actualización de CreditosTabNew - Eliminar Secciones Obsoletas

## Contexto

El componente `CreditosTabNew.tsx` actualmente incluye:
1. ✅ Una tabla de préstamos otorgados (MANTENER)
2. ❌ Una sección "Agregar Nuevos Préstamos" con formularios inline (ELIMINAR)
3. ❌ Un botón flotante "Crear Crédito" (ELIMINAR)

La funcionalidad de agregar créditos ahora se maneja completamente a través del modal `CreateCreditModal`, por lo que las secciones 2 y 3 son obsoletas y deben eliminarse.

## Objetivo

Actualizar `CreditosTabNew.tsx` para:
- Mantener la tabla de préstamos existentes con toda su funcionalidad
- Eliminar la sección de "Agregar Nuevos Préstamos" 
- Eliminar el botón flotante
- Agregar el botón "Agregar Crédito" del mockup en la barra de KPIs

## Análisis del Componente Original (CreditosTab.tsx)

### Campos de la Tabla Original
El componente original `CreditosTab.tsx` muestra estos campos en la tabla:
1. **Préstamo Previo** - Badge (Nuevo/Renovado) + Botón de registrar pago
2. **Tipo** - Nombre del tipo de préstamo
3. **Nombre** - Nombre completo del cliente
4. **Teléfono** - Teléfono del cliente
5. **M. Solicitado** - Monto solicitado
6. **Deuda Pendiente** - Deuda del préstamo anterior (si es renovación)
7. **M. Entregado** - Monto entregado al cliente
8. **M. a Pagar** - Monto total a pagar (totalDebtAcquired)
9. **Comisión** - Comisión del préstamo
10. **Aval** - Nombre del aval
11. **Tel. Aval** - Teléfono del aval
12. **Acciones** - Menú de opciones (Editar/Eliminar)

### Funcionalidad de la Tabla Original
- ✅ Mostrar lista de préstamos del día/ruta/localidad seleccionada
- ✅ Badge visual para distinguir préstamos nuevos vs renovaciones
- ✅ Botón para registrar pagos del día
- ✅ Menú de opciones con Editar y Eliminar
- ✅ Modal de edición de préstamo
- ✅ Modal de confirmación de eliminación
- ✅ Modal de configuración de pago
- ✅ Actualización automática después de operaciones

## Estado Actual de CreditosTabNew.tsx

### ✅ Lo que YA está correcto:
1. **Tabla de préstamos existentes** (líneas 1400-1600)
   - Muestra todos los campos correctos
   - Tiene la funcionalidad de editar/eliminar
   - Tiene el botón de registrar pago
   - Usa los mismos queries y mutations

2. **Barra de KPIs** (líneas 1300-1400)
   - Muestra totales correctos
   - Tiene el botón "Guardar cambios" (para préstamos pendientes)

3. **Modales** (líneas 1800-2200)
   - Modal de edición
   - Modal de configuración de pago
   - Modal de mover fecha
   - AlertDialogs de confirmación

### ❌ Lo que debe ELIMINARSE:
1. **Sección "Agregar Nuevos Préstamos"** (líneas ~1600-1800)
   - Todo el div con `ref={newLoansSectionRef}`
   - Los formularios inline de préstamos pendientes
   - El botón "Guardar" al final de la sección

2. **Botón flotante "Crear Crédito"** (líneas ~2200-2230)
   - El botón con `className={styles.floatingCreateButton}`
   - El SVG del icono +
   - El texto "Crear Crédito"

3. **Estado relacionado con préstamos pendientes** (si no se usa en el modal)
   - `pendingLoans` - MANTENER (se usa en el modal)
   - `editableEmptyRow` - ELIMINAR (solo se usa en la sección eliminada)
   - `newLoansSectionRef` - ELIMINAR (solo se usa en la sección eliminada)

### ➕ Lo que debe AGREGARSE:
1. **Botón "Agregar Crédito" en la barra de KPIs**
   - Posición: A la derecha de los chips de KPIs, antes del botón "Guardar cambios"
   - Estilo: Botón verde con icono +
   - Acción: Abrir el modal `CreateCreditModal`
   - Texto: "Agregar Crédito"

## Cambios Requeridos

### 1. Eliminar Estado No Utilizado

```typescript
// ELIMINAR estas líneas:
const [editableEmptyRow, setEditableEmptyRow] = useState<ExtendedLoanForCredits | null>(null);
const newLoansSectionRef = useRef<HTMLDivElement>(null);
```

### 2. Eliminar useEffect de Auto-agregar

```typescript
// ELIMINAR este useEffect completo (líneas ~900-920):
React.useEffect(() => {
  if (!editableEmptyRow) return;
  const hasRequiredInfo = editableEmptyRow.borrower?.personalData?.fullName?.trim() &&
                          editableEmptyRow.loantype?.id &&
                          editableEmptyRow.requestedAmount?.trim() &&
                          parseFloat(editableEmptyRow.requestedAmount) > 0;

  if (hasRequiredInfo) {
    const isAlreadyPending = pendingLoans.some(p => p.id === editableEmptyRow.id);
    if (!isAlreadyPending) {
      setPendingLoans(prev => [...prev, editableEmptyRow]);
      setEditableEmptyRow(null);
    }
  }
}, [editableEmptyRow, pendingLoans]);
```

### 3. Eliminar Funciones No Utilizadas

```typescript
// ELIMINAR estas funciones:
const generateLoanId = useCallback(() => `temp-loan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

const emptyLoanRow = React.useMemo<ExtendedLoanForCredits>(() => ({
  id: generateLoanId(),
  requestedAmount: '',
  amountGived: '',
  amountToPay: '',
  pendingAmount: '0',
  signDate: selectedDate?.toISOString() || '',
  comissionAmount: '0',
  avalName: '',
  avalPhone: '',
  selectedCollateralId: undefined,
  selectedCollateralPhoneId: undefined,
  avalAction: 'clear' as const,
  collaterals: [],
  loantype: undefined,
  borrower: { 
    id: '', 
    personalData: { 
      id: '', 
      fullName: '', 
      phones: [{ id: '', number: '' }] 
    } 
  },
  previousLoan: undefined,
  previousLoanOption: null,
}), [selectedDate, generateLoanId]);

const handleRowChange = useCallback((
  index: number, 
  field: string, 
  value: any, 
  isNewRow: boolean
) => {
  // ... toda la función
}, [editableEmptyRow, pendingLoans, emptyLoanRow, loanTypesData, generateLoanId]);
```

### 4. Actualizar Barra de KPIs

```typescript
// MODIFICAR la sección de botones de acción en la barra de KPIs
// ANTES (líneas ~1350-1400):
<div style={{ 
  display: 'flex', 
  alignItems: 'center', 
  gap: '8px',
  position: 'relative'
}}>
  {/* Botón principal con menú */}
  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch' }}>
    <div style={{
      display: 'inline-flex',
      borderRadius: '6px',
      overflow: 'hidden',
      border: '1px solid #15803d'
    }}>
      <Button
        onClick={handleSaveAllNewLoans}
        disabled={pendingLoans.length === 0 || isCreating}
        // ... resto del botón
      >
        {isCreating ? 'Guardando...' : 'Guardar cambios'}
      </Button>
      // ... resto del código
    </div>
  </div>
</div>

// DESPUÉS:
<div style={{ 
  display: 'flex', 
  alignItems: 'center', 
  gap: '8px',
  position: 'relative'
}}>
  {/* Botón Agregar Crédito */}
  <Button
    onClick={() => setIsCreateModalOpen(true)}
    size="sm"
    variant="default"
    style={{
      backgroundColor: '#16a34a',
      color: 'white',
      fontSize: '12px',
      height: '32px',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}
  >
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
    Agregar Crédito
  </Button>
  
  {/* Botón Guardar cambios - solo visible si hay préstamos pendientes */}
  {pendingLoans.length > 0 && (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch' }}>
      <div style={{
        display: 'inline-flex',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid #15803d'
      }}>
        <Button
          onClick={handleSaveAllNewLoans}
          disabled={pendingLoans.length === 0 || isCreating}
          // ... resto del botón
        >
          {isCreating ? 'Guardando...' : 'Guardar cambios'}
        </Button>
        // ... resto del código del menú
      </div>
    </div>
  )}
</div>
```

### 5. Eliminar Sección "Agregar Nuevos Préstamos"

```typescript
// ELIMINAR completamente esta sección (líneas ~1600-1800):
{/* Sección de Agregar Nuevos Préstamos */}
<div ref={newLoansSectionRef} className={styles.newLoansSection}>
  <div className={styles.newLoansCard}>
    // ... todo el contenido
  </div>
  {pendingLoans.length > 0 && (
    <div style={{...}}>
      // ... botones de guardar/cancelar
    </div>
  )}
</div>
```

### 6. Eliminar Botón Flotante

```typescript
// ELIMINAR completamente este botón (líneas ~2200-2230):
{/* Botón flotante para crear crédito */}
<button
  onClick={() => setIsCreateModalOpen(true)}
  className={styles.floatingCreateButton}
  title="Crear nuevo crédito"
>
  <svg>...</svg>
  <span className={styles.floatingButtonText}>Crear Crédito</span>
</button>
```

### 7. Mantener Modal CreateCreditModal

```typescript
// MANTENER este modal (ya está correcto):
<CreateCreditModal
  isOpen={isCreateModalOpen}
  onClose={() => setIsCreateModalOpen(false)}
  onSave={(loans) => {
    setPendingLoans(prev => [...prev, ...loans]);
    setIsCreateModalOpen(false);
  }}
  selectedDate={selectedDate}
  selectedLead={selectedLead}
  selectedLeadLocation={selectedLeadLocation}
  loanTypeOptions={loanTypeOptions}
  getPreviousLoanOptions={getPreviousLoanOptions}
  usedAvalIds={usedAvalIds}
  isSearchingLoansByRow={isSearchingLoansByRow}
  onSearchTextChange={(loanId, text) => {
    setDropdownSearchTextByRow(prev => ({
      ...prev,
      [loanId]: text
    }));
  }}
  onLocationMismatch={(clientLocation, leadLocation) => {
    setLocationMismatchDialogOpen({
      open: true,
      clientLocation,
      leadLocation
    });
  }}
  calculateLoanAmounts={calculateLoanAmounts}
/>
```

## Resultado Esperado

Después de los cambios, el componente `CreditosTabNew.tsx` debe:

1. ✅ Mostrar la barra de KPIs con totales
2. ✅ Mostrar el botón "Agregar Crédito" en la barra de KPIs
3. ✅ Mostrar la tabla de préstamos otorgados
4. ✅ Permitir editar préstamos existentes
5. ✅ Permitir eliminar préstamos existentes
6. ✅ Permitir registrar pagos del día
7. ✅ Abrir el modal CreateCreditModal al hacer clic en "Agregar Crédito"
8. ❌ NO mostrar la sección de "Agregar Nuevos Préstamos"
9. ❌ NO mostrar el botón flotante

## Verificación

Para verificar que los cambios son correctos:

1. **Navegación**: Ir a /transacciones → Tab "Créditos (Nuevo)"
2. **Selección**: Seleccionar fecha, ruta y localidad
3. **Tabla**: Verificar que se muestra la tabla de préstamos
4. **Botón**: Verificar que aparece el botón "Agregar Crédito" en la barra de KPIs
5. **Modal**: Hacer clic en "Agregar Crédito" y verificar que se abre el modal
6. **Funcionalidad**: Verificar que editar/eliminar/registrar pago funcionan correctamente
7. **Sin secciones obsoletas**: Verificar que NO aparece la sección de "Agregar Nuevos Préstamos" ni el botón flotante

## Notas Técnicas

- El estado `pendingLoans` se mantiene porque el modal `CreateCreditModal` lo usa para agregar préstamos
- La función `handleSaveAllNewLoans` se mantiene porque se usa para guardar los préstamos del modal
- El botón "Guardar cambios" solo aparece cuando hay préstamos pendientes (agregados desde el modal)
- Toda la lógica de queries, mutations y refetch se mantiene igual
