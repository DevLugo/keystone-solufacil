// admin/config.tsx
// Configuración personalizada del admin UI de Keystone

import { AdminConfig } from '@keystone-6/core/types';

export const adminConfig: AdminConfig = {
  // Configurar la página de inicio personalizada
  components: {
    Logo: () => (
      <div style={{ 
        fontSize: '1.5rem', 
        fontWeight: 'bold', 
        color: '#1e40af',
        padding: '0.5rem'
      }}>
        💰 SoluFácil
      </div>
    ),
  },
  
  // Personalizar la navegación
  navigation: {
    // Página principal será el dashboard
    initialPath: '/',
    
    // Estructura de navegación personalizada
    structure: [
      {
        label: 'Dashboard',
        path: '/',
        icon: '📊'
      },
      {
        label: 'Cobranza',
        children: [
          {
            label: 'Préstamos',
            path: '/loans',
            icon: '💵'
          },
          {
            label: 'Pagos Recibidos',
            path: '/lead-payment-receiveds',
            icon: '✅'
          },
          {
            label: 'Clientes',
            path: '/borrowers',
            icon: '👥'
          }
        ]
      },
      {
        label: 'Reportes',
        children: [
          {
            label: 'Reporte Financiero',
            path: '/reporte-financiero',
            icon: '📈'
          },
          {
            label: 'Reporte Cobranza',
            path: '/reporte-cobranza',
            icon: '📋'
          }
        ]
      },
      {
        label: 'Configuración',
        children: [
          {
            label: 'Rutas',
            path: '/routes',
            icon: '🗺️'
          },
          {
            label: 'Localidades',
            path: '/locations',
            icon: '📍'
          },
          {
            label: 'Empleados',
            path: '/employees',
            icon: '👷'
          },
          {
            label: 'Usuarios',
            path: '/users',
            icon: '👤'
          }
        ]
      }
    ]
  }
};

// Exportar la configuración para uso en keystone.ts
export default adminConfig;