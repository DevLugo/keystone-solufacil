# Casos de Prueba - Dashboard del Cobrador

## 🧪 Escenarios de Acceso de Usuario

### Escenario 1: Usuario Administrador
**Configuración:**
- User.role = 'ADMIN'
- User.employee = null o cualquier valor

**Comportamiento Esperado:**
- ✅ Puede ver todas las rutas del sistema
- ✅ Selector de rutas visible con todas las opciones
- ✅ Badge "Admin" visible en el header
- ✅ Acceso completo a todos los datos

**Query Result:**
```json
{
  "isAdmin": true,
  "routes": [/* todas las rutas */],
  "accessType": "ADMIN_ALL_ROUTES",
  "hasEmployee": true/false
}
```

### Escenario 2: Usuario Normal con Empleado y Ruta
**Configuración:**
- User.role = 'NORMAL'
- User.employee → Employee.routes → Route

**Comportamiento Esperado:**
- ✅ Ve solo su ruta asignada
- ✅ Sin selector de rutas (solo una ruta)
- ✅ Dashboard funcional con datos de su ruta
- ✅ Badge "Ruta Asignada" en subtitle

**Query Result:**
```json
{
  "isAdmin": false,
  "routes": [{ "id": "route1", "name": "Ruta 1" }],
  "accessType": "SINGLE_ROUTE",
  "hasEmployee": true
}
```

### Escenario 3: Usuario Normal Sin Empleado Vinculado
**Configuración:**
- User.role = 'NORMAL'
- User.employee = null

**Comportamiento Esperado:**
- ❌ No puede acceder al dashboard
- ⚠️ Mensaje: "Usuario no tiene un empleado asociado"
- 🔧 Instrucción para contactar administrador
- 📋 Sin datos de rutas

**Query Result:**
```json
{
  "isAdmin": false,
  "routes": [],
  "accessType": "SINGLE_ROUTE",
  "hasEmployee": false,
  "message": "Usuario no tiene un empleado asociado..."
}
```

### Escenario 4: Usuario con Empleado Sin Ruta
**Configuración:**
- User.role = 'NORMAL'
- User.employee → Employee.routes = null

**Comportamiento Esperado:**
- ❌ No puede acceder al dashboard
- ⚠️ Mensaje: "El empleado asociado no tiene rutas asignadas"
- 📋 Muestra información del empleado vinculado
- 🔧 Instrucción para contactar administrador

**Query Result:**
```json
{
  "isAdmin": false,
  "routes": [],
  "accessType": "SINGLE_ROUTE",
  "hasEmployee": true,
  "employeeInfo": { /* datos del empleado */ },
  "message": "El empleado asociado no tiene rutas asignadas..."
}
```

### Escenario 5: Usuario con Múltiples Rutas (Futuro)
**Configuración:**
- User.role = 'NORMAL'
- User.employee.type = 'ROUTE_LEAD'
- Lógica especial para múltiples rutas

**Comportamiento Esperado:**
- ✅ Ve múltiples rutas asignadas
- ✅ Selector de rutas visible
- ✅ Badge "Múltiples Rutas" visible
- ✅ Puede cambiar entre rutas

**Query Result:**
```json
{
  "isAdmin": false,
  "routes": [/* múltiples rutas */],
  "accessType": "MULTIPLE_ROUTES",
  "hasEmployee": true
}
```

## 🔧 Gestión de Vinculación

### Página de Gestión: `/gestionar-usuarios-empleados`
**Funcionalidades:**
- ✅ Lista todos los usuarios y su estado de vinculación
- ✅ Permite vincular usuarios sin empleado
- ✅ Permite desvincular usuarios de empleados
- ✅ Muestra empleados sin usuario vinculado
- ✅ Estadísticas de vinculación

### Proceso de Vinculación Manual
1. **Identificar usuario sin empleado**
2. **Seleccionar empleado disponible** (sin usuario vinculado)
3. **Ejecutar vinculación** via GraphQL mutation
4. **Verificar acceso** en el dashboard

### Proceso de Vinculación Automática
1. **Ejecutar script:** `node scripts/link-users-employees.js`
2. **Coincidencia por nombre:** Busca empleados con nombres similares
3. **Vinculación automática:** Para coincidencias claras
4. **Reporte de resultados:** Lista usuarios que requieren vinculación manual

## 🧪 Pruebas de Funcionalidad

### Test 1: Login como Admin
```bash
# 1. Login como usuario admin
# 2. Ir a /dashboard
# 3. Verificar que se ven todas las rutas
# 4. Cambiar entre rutas y verificar datos
```

### Test 2: Login como Usuario Normal
```bash
# 1. Login como usuario normal vinculado
# 2. Ir a /dashboard  
# 3. Verificar que solo ve su ruta
# 4. Verificar que no hay selector de rutas
```

### Test 3: Usuario Sin Empleado
```bash
# 1. Login como usuario sin empleado vinculado
# 2. Ir a /dashboard
# 3. Verificar mensaje de error apropiado
# 4. Verificar que no se muestran datos
```

### Test 4: Vinculación Manual
```bash
# 1. Login como admin
# 2. Ir a /gestionar-usuarios-empleados
# 3. Vincular un usuario con un empleado
# 4. Login como ese usuario
# 5. Verificar acceso al dashboard
```

### Test 5: Responsividad
```bash
# 1. Abrir dashboard en móvil (DevTools)
# 2. Verificar layout de una columna
# 3. Verificar controles touch-friendly
# 4. Probar toggle semanal/mensual
# 5. Verificar selector de rutas (si aplica)
```

## 📊 Datos de Prueba Sugeridos

### Crear Usuario de Prueba
```sql
INSERT INTO "User" (id, name, email, password, role) VALUES 
('test-user-1', 'Juan Pérez', 'juan.perez@test.com', '$2a$10$...', 'NORMAL');
```

### Crear Empleado de Prueba
```sql
INSERT INTO "Employee" (id, type, "routesId") VALUES 
('test-emp-1', 'ROUTE_LEAD', 'route-id-1');

INSERT INTO "PersonalData" (id, fullName) VALUES 
('test-pd-1', 'Juan Pérez');

UPDATE "Employee" SET "personalDataId" = 'test-pd-1' WHERE id = 'test-emp-1';
```

### Vincular Usuario con Empleado
```sql
UPDATE "Employee" SET "user" = 'test-user-1' WHERE id = 'test-emp-1';
```

## 🔍 Debugging

### Verificar Vinculación
```sql
SELECT 
  u.name as usuario_nombre,
  u.email as usuario_email,
  u.role as usuario_rol,
  e.id as empleado_id,
  e.type as empleado_tipo,
  pd.fullName as empleado_nombre,
  r.name as ruta_nombre
FROM "User" u
LEFT JOIN "Employee" e ON u.id = e."user"
LEFT JOIN "PersonalData" pd ON e."personalDataId" = pd.id
LEFT JOIN "Route" r ON e."routesId" = r.id
ORDER BY u.name;
```

### Verificar Acceso a Dashboard
```graphql
query TestUserAccess {
  getUserAccessibleRoutes
}
```

### Verificar KPIs
```graphql
query TestDashboardKPIs($routeId: String!) {
  getDashboardKPIs(routeId: $routeId, timeframe: "weekly")
}
```

## ⚠️ Consideraciones Importantes

### Seguridad
- ✅ Solo admins pueden gestionar vinculaciones
- ✅ Usuarios solo ven sus rutas asignadas
- ✅ Validación de sesión en todos los resolvers

### Performance
- ✅ Índices en campos de relación
- ✅ Queries optimizadas con includes específicos
- ✅ Cache Apollo para evitar requests repetidos

### Escalabilidad
- 🔄 Preparado para múltiples rutas por usuario
- 🔄 Extensible para roles especiales
- 🔄 Compatible con permisos granulares futuros

### Mantenimiento
- 📝 Logs detallados en resolvers
- 📝 Documentación completa
- 📝 Scripts de migración y vinculación
- 📝 Página de gestión para admins