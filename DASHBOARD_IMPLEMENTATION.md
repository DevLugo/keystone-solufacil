# Implementación del Dashboard del Cobrador

## ✅ Componentes Implementados

### 1. Backend - GraphQL Resolvers
- **`getDashboardKPIs`**: Resolver principal que calcula todos los KPIs
- **`getUserRoutes`**: Obtiene las rutas asignadas al usuario autenticado
- Integración con el sistema existente de `calculateWeeksWithoutPayment`

### 2. Frontend - Componentes React

#### Componente Principal
- **`CollectorDashboard.tsx`**: Dashboard principal responsive

#### Componentes de UI
- **`DashboardHeader.tsx`**: Header con controles y toggle semanal/mensual
- **`KPICard.tsx`**: Tarjetas para KPIs con comparaciones
- **`LocalityCard.tsx`**: Tarjetas para análisis de localidades
- **`ClientStreakCard.tsx`**: Tarjetas para clientes con rachas sin pago
- **`SummaryStats.tsx`**: Estadísticas generales
- **`AlertsPanel.tsx`**: Panel de alertas automáticas
- **`RouteSelector.tsx`**: Selector de rutas para admins
- **`TrendChart.tsx`**: Gráficas de tendencias
- **`MiniChart.tsx`**: Mini gráficas para KPIs
- **`LoadingDashboard.tsx`**: Estados de carga con skeletons

### 3. Hooks y Utilidades
- **`useUserRoutes.ts`**: Hook para obtener rutas del usuario
- **`dashboard.ts`**: Queries GraphQL para el dashboard

### 4. Páginas
- **`dashboard.tsx`**: Página principal del dashboard (actualizada)
- **`admin-dashboard.tsx`**: Dashboard administrativo de cuentas

## 📊 KPIs Implementados

### KPIs Principales
1. **Incremento de Cartera Vencida (CV)**
   - Comparación periodo actual vs anterior
   - Cálculo basado en préstamos sin pago en 2+ semanas

2. **Incremento de Clientes**
   - Nuevos clientes en el periodo
   - Comparación con periodo anterior

3. **Clientes Activos**
   - Total de clientes con préstamos activos
   - Variación vs periodo anterior

4. **Porcentaje Pagando**
   - % de clientes al día con pagos
   - Tendencia de mejora/empeoramiento

### Análisis de Localidades
1. **Localidades en Declive**
   - Identificación automática (>20% declive)
   - Ordenadas por severidad del declive

2. **Localidades de Crecimiento Peligroso**
   - Identificación automática (>50% crecimiento)
   - Alerta para planificar recursos

### Gestión de Clientes
1. **Clientes con Racha Sin Pago**
   - Listado de clientes con 3+ semanas sin pagar
   - Clasificación por urgencia (Crítico/Urgente/Atención)
   - Información completa: nombre, código, localidad, monto

## 🎨 Diseño y UX

### Responsividad
- **Mobile-first**: Optimizado para celulares
- **Adaptive layout**: Se adapta a tablets y desktop
- **Touch-friendly**: Botones y controles optimizados para touch

### Visualización
- **Cards coloridas**: Cada KPI tiene su color distintivo
- **Iconografía clara**: Iconos de FontAwesome para mejor comprensión
- **Estados de carga**: Skeletons y loading states profesionales
- **Alertas visuales**: Sistema de alertas automático con códigos de color

### Accesibilidad
- **Contraste adecuado**: Colores que cumplen estándares WCAG
- **Navegación por teclado**: Todos los elementos son navegables
- **Texto descriptivo**: Labels y tooltips informativos

## 🔄 Toggle Semanal/Mensual

### Funcionalidad
- **Toggle visual**: Botones destacados en el header
- **Recálculo automático**: Datos se actualizan al cambiar timeframe
- **Persistencia**: El estado se mantiene durante la sesión

### Lógica de Cálculo
- **Semanal**: Lunes a domingo de la semana actual
- **Mensual**: Todo el mes seleccionado
- **Comparaciones**: Siempre vs periodo anterior equivalente

## 🔐 Sistema de Permisos

### Usuarios Normales
- Solo ven sus rutas asignadas
- Dashboard filtrado por ruta específica
- No pueden cambiar de ruta (salvo múltiples asignaciones)

### Administradores
- Acceso a todas las rutas
- Selector de rutas disponible
- Dashboard administrativo separado para cuentas

## 📱 Optimización Móvil

### Layout
- **Single column**: En móviles todo se apila verticalmente
- **Touch targets**: Botones de mínimo 44px
- **Spacing optimizado**: Márgenes y padding ajustados

### Performance
- **Lazy loading**: Componentes se cargan según necesidad
- **Polling inteligente**: Actualización cada 60 segundos
- **Caching**: Apollo Client maneja el cache automáticamente

## 🚀 Cómo Usar

### Para Cobradores
1. Hacer login en el sistema
2. Ir a "Dashboard" en el menú principal
3. Alternar entre vista semanal/mensual según necesidad
4. Revisar alertas y KPIs
5. Actuar sobre localidades problemáticas y clientes con rachas

### Para Administradores
1. Acceso al dashboard normal + selector de rutas
2. Dashboard administrativo separado para cuentas
3. Vista completa de todas las rutas del sistema

## 🔧 Configuración Técnica

### Variables de Entorno
No requiere variables adicionales - usa la configuración existente.

### Base de Datos
Utiliza las tablas existentes:
- `loans`
- `localities` (a través de `Location`)
- `routes`
- `loanPayments`
- `transactions`
- `employees`
- `users`

### Dependencias
- React 18+
- Apollo Client
- Keystone 6
- React Icons
- Emotion (CSS-in-JS)

## 📈 Métricas y Umbrales

### Umbrales de Alerta
- **CV Crítica**: >40%
- **CV Elevada**: 25-40%
- **Promedio Crítico**: >4 semanas sin pago
- **Declive Localidad**: >20% reducción
- **Crecimiento Peligroso**: >50% incremento

### Cálculos
- **Semanas sin pago**: Basado en función existente `calculateWeeksWithoutPayment`
- **CV**: Préstamos sin pago en últimas 2 semanas
- **Crecimiento**: Comparación periodo actual vs anterior
- **Promedios**: Cálculos ponderados por localidad

## 🔄 Actualizaciones Futuras

### Posibles Mejoras
1. **Gráficas interactivas**: Integrar Chart.js o similar
2. **Exportación**: PDF/Excel de reportes
3. **Notificaciones push**: Alertas en tiempo real
4. **Filtros avanzados**: Por localidad, tipo de cliente, etc.
5. **Predicciones**: ML para predecir tendencias
6. **Mapas**: Visualización geográfica de localidades

### Mantenimiento
- Revisar umbrales periódicamente
- Ajustar cálculos según cambios de negocio
- Optimizar queries para mejor performance
- Actualizar diseño según feedback de usuarios

## 🐛 Debugging

### Logs
Los resolvers incluyen logging detallado para debugging:
```
console.log('🔍 getDashboardKPIs - Processing route...', routeId);
```

### Common Issues
1. **Usuario sin rutas**: Verificar relación User-Employee
2. **Datos faltantes**: Revisar que existan préstamos en el periodo
3. **Performance**: Optimizar queries si hay muchos préstamos

## 📋 Testing

### Casos de Prueba
1. Usuario normal con una ruta
2. Usuario normal con múltiples rutas
3. Administrador con acceso completo
4. Usuario sin rutas asignadas
5. Datos vacíos/sin préstamos
6. Cambio entre semanal/mensual
7. Responsive en diferentes dispositivos