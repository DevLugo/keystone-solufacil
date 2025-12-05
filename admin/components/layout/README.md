# Layout Components - Migración a Shadcn con Tema Dark/Light

Esta carpeta contiene los componentes de layout migrados desde Keystone UI a shadcn con soporte completo para dark/light mode.

## Componentes

### 1. PageContainer
Reemplazo del `PageContainer` de Keystone con soporte de tema.

**Ubicación**: `admin/components/layout/PageContainer.tsx`

**Características**:
- Soporte dark/light mode usando variables CSS
- Layout responsive con sidebar
- Grid layout optimizado
- Scrollbar estilizado según tema

**Uso directo** (para páginas nuevas):
```tsx
import { PageContainer } from '../components/layout/PageContainer';
import { ThemeProvider } from '../contexts/ThemeContext';

function MyPage() {
  return (
    <ThemeProvider>
      <PageContainer
        title="Mi Página"
        header={<h1>Header Content</h1>}
        sidebar={<Navigation />}
      >
        <div>Contenido de la página</div>
      </PageContainer>
    </ThemeProvider>
  );
}
```

### 2. Navigation
Componentes de navegación lateral migrados a shadcn.

**Ubicación**: `admin/components/layout/Navigation.tsx`

**Componentes exportados**:
- `NavigationContainer`: Contenedor principal de navegación
- `NavItem`: Item individual de navegación
- `ListNavItem`: Item de navegación para listas de Keystone
- `ListNavItems`: Lista de items de navegación

**Características**:
- Integración con ThemeToggle
- Soporte para usuario autenticado
- Links de API en desarrollo
- Botón de signout

**Uso**:
```tsx
import { NavigationContainer, NavItem, ListNavItems } from '../components/layout/Navigation';

<NavigationContainer
  authenticatedItem={{ label: 'Usuario', state: 'authenticated' }}
  onSignout={() => console.log('Signout')}
>
  <NavItem href="/">Dashboard</NavItem>
  <ListNavItems lists={myLists} />
</NavigationContainer>
```

### 3. CustomPageContainer
Wrapper que inyecta el tema en el PageContainer de Keystone automáticamente.

**Ubicación**: `admin/components/CustomPageContainer.tsx`

**Uso**: Se configura automáticamente en `admin/config.ts` - no requiere cambios en las páginas existentes.

### 4. KeystonePageWrapper
Alternativa para páginas individuales que quieren usar el tema sin modificar el config global.

**Ubicación**: `admin/components/layout/KeystonePageWrapper.tsx`

**Uso**:
```tsx
// En lugar de:
import { PageContainer } from '@keystone-6/core/admin-ui/components';

// Usar:
import { PageContainer } from '../components/layout/KeystonePageWrapper';
```

## Configuración Global

El tema se aplica automáticamente a toda la aplicación mediante `admin/config.ts`:

```typescript
export const components: AdminConfig['components'] = {
  Logo: CustomHeader,
  Navigation: CustomNavigation,
  PageContainer: CustomPageContainer  // <- Inyecta el tema globalmente
};
```

## Sistema de Temas

### Variables CSS
Las variables de tema están centralizadas en `admin/styles/theme-variables.css`.

**Variables principales**:
```css
/* Light mode */
--theme-background
--theme-foreground
--theme-card
--theme-border
--theme-primary

/* Dark mode (en [data-theme="dark"]) */
--theme-background: #0f172a
--theme-foreground: #f8fafc
...
```

### ThemeContext
Ubicación: `admin/contexts/ThemeContext.tsx`

**Hooks disponibles**:
- `useTheme()`: Obtener tema actual y funciones de control
- `useThemeColors()`: Obtener objetos de colores
- `useSafeTheme()`: Versión segura (no falla fuera del Provider)
- `useSafeThemeColors()`: Versión segura de colores

**Uso**:
```tsx
import { useTheme, useThemeColors } from '../contexts/ThemeContext';

function MyComponent() {
  const { isDark, toggleTheme } = useTheme();
  const colors = useThemeColors();

  return (
    <div style={{ background: colors.background }}>
      Tema: {isDark ? 'Dark' : 'Light'}
    </div>
  );
}
```

## Componentes Actualizados

### CustomNavigation
**Cambios realizados**:
- ✅ Importa componentes desde `./layout/Navigation` en lugar de Keystone
- ✅ CSS actualizado a variables de tema (`CustomNavigation.css`)
- ✅ Soporte completo dark/light mode

### transacciones-new.tsx
**Ejemplo de referencia**:
- Usa `ThemeProvider` en el componente raíz
- Usa `useTheme()` y `useThemeColors()` para estilos dinámicos
- Integra `ThemeToggle` en el header

## Migración de Páginas Existentes

### Opción 1: Sin cambios (Recomendado)
Las páginas existentes funcionarán automáticamente con el tema gracias a `CustomPageContainer` en `config.ts`.

### Opción 2: Migración manual
Para tener control completo del tema en una página específica:

```tsx
// Antes
import { PageContainer } from '@keystone-6/core/admin-ui/components';

// Después
import { PageContainer } from '../components/layout/KeystonePageWrapper';
```

### Opción 3: Migración completa
Para usar los componentes nuevos completamente:

```tsx
import { PageContainer } from '../components/layout/PageContainer';
import { NavigationContainer, NavItem } from '../components/layout/Navigation';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function MyPage() {
  return (
    <ThemeProvider>
      <PageContainer
        title="Mi Página"
        header={<h1>Header</h1>}
        sidebar={
          <NavigationContainer>
            <NavItem href="/">Dashboard</NavItem>
          </NavigationContainer>
        }
      >
        {/* Contenido */}
      </PageContainer>
    </ThemeProvider>
  );
}
```

## Estilos con Tema

### CSS-in-JS (emotion)
```tsx
import { useThemeColors } from '../contexts/ThemeContext';

function MyComponent() {
  const colors = useThemeColors();

  return (
    <div css={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      color: colors.foreground
    }}>
      Content
    </div>
  );
}
```

### Inline Styles con Variables CSS
```tsx
<div style={{
  background: 'var(--theme-card)',
  border: '1px solid var(--theme-border)',
  color: 'var(--theme-foreground)'
}}>
  Content
</div>
```

### CSS Modules o CSS tradicional
```css
.my-component {
  background: var(--theme-card);
  border: 1px solid var(--theme-border);
  color: var(--theme-foreground);
  transition: all 0.3s ease;
}
```

## ThemeToggle

El componente `ThemeToggle` está disponible en `admin/components/ui/ThemeToggle.tsx`.

**Uso**:
```tsx
import { ThemeToggle } from '../components/ui/ThemeToggle';

// Diferentes tamaños
<ThemeToggle size="sm" />
<ThemeToggle size="md" showLabel />
<ThemeToggle size="lg" showLabel />
```

## Testing

Para probar el tema:

1. Abrir cualquier página del admin
2. El toggle de tema debe aparecer en la navegación lateral
3. Click en el toggle debe cambiar entre light/dark
4. El cambio debe persistir en localStorage
5. Verificar que todos los componentes cambien de color correctamente

## Troubleshooting

### El tema no cambia
- Verificar que el componente esté dentro de un `ThemeProvider`
- Verificar que se estén usando variables CSS (`var(--theme-*)`)
- Revisar la consola por errores

### Colores no se aplican
- Verificar que `theme-variables.css` esté importado
- Verificar que el atributo `data-theme` esté en el `<html>`
- Usar DevTools para inspeccionar las variables CSS

### Conflictos con Keystone UI
- El `CustomPageContainer` envuelve el PageContainer de Keystone
- Los estilos de Keystone se mantienen, solo se agregan variables de tema
- Si hay conflictos, revisar el orden de importación de CSS

## Archivos Clave

```
admin/
├── components/
│   ├── layout/
│   │   ├── PageContainer.tsx          # PageContainer migrado
│   │   ├── Navigation.tsx             # Navegación migrada
│   │   ├── KeystonePageWrapper.tsx    # Wrapper alternativo
│   │   └── README.md                  # Esta documentación
│   ├── ui/
│   │   └── ThemeToggle.tsx            # Toggle de tema
│   ├── CustomNavigation.tsx           # Navegación personalizada (actualizada)
│   ├── CustomNavigation.css           # Estilos con variables CSS
│   └── CustomPageContainer.tsx        # Wrapper para config.ts
├── contexts/
│   └── ThemeContext.tsx               # Context y hooks de tema
├── styles/
│   └── theme-variables.css            # Variables CSS centralizadas
└── config.ts                          # Configuración de Keystone (actualizada)
```
