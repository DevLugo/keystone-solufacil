# Dashboard del Cobrador

## Descripción

Dashboard integral para cobradores que muestra KPIs clave de su ruta asignada, con capacidad de alternar entre vistas semanales y mensuales.

## Características Principales

### 📊 KPIs Principales
- **Cartera Vencida**: Incremento/decremento de préstamos vencidos
- **Nuevos Clientes**: Crecimiento de la base de clientes
- **Clientes Activos**: Variación en el total de clientes activos
- **% Pagando**: Porcentaje de clientes al día con sus pagos

### 🏘️ Análisis de Localidades
- **Localidades en Declive**: Zonas con reducción significativa en nuevos préstamos (>20% declive)
- **Localidades de Crecimiento Peligroso**: Zonas con crecimiento muy rápido (>50% crecimiento) que pueden requerir más recursos

### 👥 Gestión de Clientes
- **Clientes con Racha Sin Pago**: Lista de clientes con 3+ semanas sin realizar pagos
- **Clasificación por Urgencia**: 
  - 🔴 Crítico (8+ semanas)
  - 🟡 Urgente (5-7 semanas)
  - ⚪ Atención (3-4 semanas)

### 🚨 Sistema de Alertas
- Alertas automáticas basadas en umbrales críticos
- Notificaciones sobre localidades problemáticas
- Seguimiento de métricas de riesgo

## Componentes

### `CollectorDashboard.tsx`
Componente principal que orquesta todo el dashboard.

### `DashboardHeader.tsx`
Header con controles de navegación, toggle semanal/mensual y selector de rutas.

### `KPICard.tsx`
Tarjetas individuales para mostrar KPIs con comparaciones periodo anterior.

### `LocalityCard.tsx`
Tarjetas para mostrar el estado de localidades (declive/crecimiento peligroso).

### `ClientStreakCard.tsx`
Tarjetas para mostrar clientes con rachas largas sin pago.

### `SummaryStats.tsx`
Resumen estadístico general de la ruta.

### `AlertsPanel.tsx`
Panel de alertas automáticas basadas en umbrales.

### `TrendChart.tsx`
Componente de gráficas para mostrar tendencias.

### `LoadingDashboard.tsx`
Estados de carga con skeletons para mejor UX.

## Responsividad

El dashboard está optimizado para:
- 📱 **Móviles** (< 768px): Layout de una columna, controles apilados
- 📱 **Tablets** (768px - 1024px): Layout de dos columnas
- 💻 **Desktop** (> 1024px): Layout completo con múltiples columnas

## Permisos y Acceso

### Usuarios Normales
- Ven solo las rutas asignadas a su empleado
- Dashboard filtrado por su ruta específica
- No pueden cambiar de ruta (a menos que tengan múltiples asignadas)

### Administradores
- Pueden ver todas las rutas
- Selector de rutas disponible
- Acceso completo a todos los datos

## GraphQL Queries

### `getDashboardKPIs`
```graphql
query GetDashboardKPIs($routeId: String!, $timeframe: String, $year: Int, $month: Int) {
  getDashboardKPIs(routeId: $routeId, timeframe: $timeframe, year: $year, month: $month)
}
```

### `getUserRoutes`
```graphql
query GetUserRoutes {
  getUserRoutes
}
```

## Configuración de Umbrales

### Cartera Vencida
- **Verde**: < 25%
- **Amarillo**: 25% - 40%
- **Rojo**: > 40%

### Localidades
- **Declive**: < -20% crecimiento
- **Crecimiento Peligroso**: > +50% crecimiento

### Clientes Sin Pago
- **Atención**: 3-4 semanas
- **Urgente**: 5-7 semanas
- **Crítico**: 8+ semanas

## Actualizaciones

- **Automáticas**: Cada 60 segundos
- **Manual**: Botón de refresh en el header
- **Tiempo Real**: Los datos se actualizan automáticamente cuando cambia el timeframe o la ruta

## Tecnologías

- React con Keystone 6
- Apollo GraphQL para datos
- CSS-in-JS con emotion
- React Icons para iconografía
- Responsive design mobile-first