# 🔗 Relación User-Employee - Implementación Completa

## ✅ Cambios Implementados

### 1. **Modelos de Datos Actualizados**

#### Schema Prisma
```prisma
model User {
  // ... campos existentes ...
  employee    Employee?  @relation("User_employee")
}

model Employee {
  // ... campos existentes ...
  user        User?      @relation("User_employee", fields: [userId], references: [id])
  userId      String?    @unique @map("user")
  
  @@index([userId])
}
```

#### Schema TypeScript (Keystone)
```typescript
// User model
employee: relationship({ ref: 'Employee.user' }),

// Employee model  
user: relationship({ ref: 'User.employee' }),
```

### 2. **Resolvers GraphQL Actualizados**

#### `getUserRoutes` - Versión Simplificada
- ✅ Usa relación directa User → Employee → Route
- ✅ Maneja usuarios sin empleado vinculado
- ✅ Maneja empleados sin ruta asignada

#### `getUserAccessibleRoutes` - Versión Avanzada
- ✅ Soporte para múltiples rutas (futuro)
- ✅ Lógica extensible para permisos especiales
- ✅ Tipos de acceso: `ADMIN_ALL_ROUTES`, `MULTIPLE_ROUTES`, `SINGLE_ROUTE`

### 3. **Frontend Actualizado**

#### Hook `useUserRoutes`
```typescript
const {
  routes,           // Rutas disponibles
  isAdmin,          // Si es administrador
  hasEmployee,      // Si tiene empleado vinculado
  accessType,       // Tipo de acceso
  hasMultipleRoutes,// Si tiene múltiples rutas
  message           // Mensaje de error/info
} = useUserRoutes();
```

#### Componentes Mejorados
- ✅ **DashboardHeader**: Muestra tipo de acceso y empleado vinculado
- ✅ **RouteSelector**: Se adapta según el tipo de acceso
- ✅ **UserAccessInfo**: Panel informativo sobre permisos
- ✅ **CollectorDashboard**: Maneja todos los casos de acceso

## 🎯 Casos de Uso Soportados

### ✅ Caso 1: Administrador
```
User (role: ADMIN) → Ve todas las rutas
```

### ✅ Caso 2: Usuario Normal con Ruta
```
User (role: NORMAL) → Employee → Route → Dashboard con datos de esa ruta
```

### ✅ Caso 3: Usuario Sin Empleado
```
User (role: NORMAL) → employee: null → Mensaje de error + instrucciones
```

### ✅ Caso 4: Usuario con Empleado Sin Ruta
```
User (role: NORMAL) → Employee → routes: null → Mensaje de error + info empleado
```

### 🔄 Caso 5: Usuario con Múltiples Rutas (Preparado)
```
User (role: NORMAL) → Employee (type: ROUTE_LEAD) → Múltiples rutas → Selector visible
```

## 🛠️ Herramientas de Gestión

### Página de Administración: `/gestionar-usuarios-empleados`
- ✅ **Vista de usuarios**: Estado de vinculación, empleado asociado
- ✅ **Vinculación manual**: Dropdown para seleccionar empleado
- ✅ **Desvinculación**: Botón para romper relación
- ✅ **Estadísticas**: Contadores de usuarios vinculados/sin vincular
- ✅ **Empleados huérfanos**: Lista de empleados sin usuario

### Script de Migración: `scripts/link-users-employees.js`
- ✅ **Vinculación automática**: Por coincidencia de nombres
- ✅ **Reporte detallado**: Usuarios vinculados/sin vincular
- ✅ **Seguridad**: No sobrescribe vinculaciones existentes
- ✅ **Logging**: Proceso detallado con estadísticas

## 📊 Flujo de Datos

### 1. Autenticación
```
Login → Session → User.id
```

### 2. Obtención de Rutas
```
User.id → User.employee → Employee.routes → Route[]
```

### 3. Dashboard KPIs
```
Route.id → Loans, Payments, Transactions → KPIs calculados
```

### 4. Permisos
```
User.role + Employee.routes → Nivel de acceso determinado
```

## 🔐 Matriz de Permisos

| User Role | Employee | Routes | Acceso Dashboard | Selector Rutas | Tipo Acceso |
|-----------|----------|--------|------------------|----------------|-------------|
| ADMIN     | Any      | Any    | ✅ Todas         | ✅ Todas       | ADMIN_ALL_ROUTES |
| NORMAL    | ✅       | ✅     | ✅ Su ruta       | ❌ (una ruta)  | SINGLE_ROUTE |
| NORMAL    | ✅       | ❌     | ❌ Error         | ❌             | - |
| NORMAL    | ❌       | -      | ❌ Error         | ❌             | - |

## 🚀 Pasos para Implementar

### 1. Aplicar Migración de Base de Datos
```bash
# Aplicar migración SQL
psql -d your_database -f migrations/add-user-employee-relation.sql

# O usar Prisma migrate
npx prisma migrate dev --name add-user-employee-relation
```

### 2. Vincular Usuarios Existentes
```bash
# Ejecutar script de vinculación automática
node scripts/link-users-employees.js
```

### 3. Gestión Manual (Si es necesario)
```bash
# 1. Login como admin
# 2. Ir a /gestionar-usuarios-empleados
# 3. Vincular usuarios restantes manualmente
```

### 4. Verificar Funcionamiento
```bash
# 1. Login como diferentes tipos de usuarios
# 2. Verificar acceso apropiado al dashboard
# 3. Probar toggle semanal/mensual
# 4. Verificar responsividad móvil
```

## 📱 Experiencia de Usuario

### Para Cobradores
1. **Login** → Acceso directo a su dashboard
2. **Dashboard** → Ve solo datos de su ruta
3. **KPIs** → Información relevante para su trabajo
4. **Alertas** → Notificaciones específicas de su ruta
5. **Acciones** → Enlaces a funciones de su ruta

### Para Administradores
1. **Login** → Acceso a todas las rutas
2. **Selector** → Puede cambiar entre cualquier ruta
3. **Gestión** → Página para vincular usuarios-empleados
4. **Dashboard Admin** → Vista de cuentas (separada)

## 🔄 Extensibilidad Futura

### Múltiples Rutas por Usuario
```typescript
// En getUserAccessibleRoutes resolver
if (user.employee?.type === 'SUPERVISOR') {
  // Lógica para obtener múltiples rutas supervisadas
  const supervisedRoutes = await context.prisma.route.findMany({
    where: { supervisorId: user.employee.id }
  });
  accessibleRoutes.push(...supervisedRoutes);
}
```

### Permisos Granulares
```typescript
// Tabla de permisos futura
model UserPermission {
  id       String @id @default(cuid())
  userId   String
  routeId  String
  permission String // 'READ', 'WRITE', 'ADMIN'
  user     User   @relation(fields: [userId], references: [id])
  route    Route  @relation(fields: [routeId], references: [id])
}
```

### Jerarquías de Empleados
```typescript
// Relación jerárquica futura
model Employee {
  // ... campos existentes ...
  supervisor   Employee? @relation("EmployeeHierarchy", fields: [supervisorId], references: [id])
  supervisorId String?
  subordinates Employee[] @relation("EmployeeHierarchy")
}
```

## ⚠️ Consideraciones de Migración

### Datos Existentes
1. **Usuarios sin empleado**: Requerirán vinculación manual
2. **Empleados sin usuario**: Pueden seguir operando normalmente
3. **Compatibilidad**: Sistema existente sigue funcionando

### Rollback Plan
```sql
-- Para revertir la migración si es necesario
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_user_fkey";
DROP INDEX "Employee_user_idx";
DROP INDEX "Employee_user_key";
ALTER TABLE "Employee" DROP COLUMN "user";
```

### Backup Recomendado
```bash
# Hacer backup antes de la migración
pg_dump your_database > backup_before_user_employee_relation.sql
```

## 📋 Checklist de Implementación

- [x] Actualizar schema.prisma con nueva relación
- [x] Actualizar schema.ts con relationship fields
- [x] Actualizar schema.graphql con nuevos campos
- [x] Implementar resolver getUserAccessibleRoutes
- [x] Actualizar hook useUserRoutes
- [x] Actualizar componentes dashboard
- [x] Crear página de gestión admin
- [x] Crear script de vinculación automática
- [x] Documentar casos de prueba
- [x] Agregar al menú de navegación

## 🎉 Resultado Final

**Sistema completo de gestión de acceso basado en relación User-Employee:**

1. **Flexibilidad**: Soporta usuarios con/sin empleado
2. **Escalabilidad**: Preparado para múltiples rutas
3. **Seguridad**: Permisos basados en relaciones reales
4. **Gestión**: Herramientas admin para vinculación
5. **UX**: Mensajes claros para todos los casos
6. **Responsividad**: Funciona perfecto en móviles

El dashboard ahora funciona correctamente con la nueva relación User-Employee y maneja todos los casos de acceso de manera elegante y segura.