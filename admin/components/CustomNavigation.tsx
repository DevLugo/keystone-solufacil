import React, { useState, useEffect } from 'react';
import { NavigationContainer, NavItem, ListNavItems } from '@keystone-6/core/admin-ui/components';
import type { NavigationProps } from '@keystone-6/core/admin-ui/components';
import './CustomNavigation.css';

interface MenuItem {
  label: string;
  href: string;
  roles: string[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
  roles: string[];
}

const menuSections: MenuSection[] = [
  {
    title: 'Principal',
    roles: ['NORMAL', 'ADMIN'],
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        roles: ['NORMAL', 'ADMIN']
      }
    ]
  },
  {
    title: 'Clientes',
    roles: ['NORMAL', 'ADMIN'],
    items: [
      {
        label: 'Historial de Clientes',
        href: '/historial-cliente',
        roles: ['NORMAL', 'ADMIN']
      },
      {
        label: 'Carga de Documentos',
        href: '/documentos-personales',
        roles: ['NORMAL', 'ADMIN']
      },

    ]
  },
  {
    title: 'Operaciones',
    roles: ['NORMAL', 'ADMIN'],
    items: [
      {
        label: 'Captura Semanal',
        href: '/transacciones',
        roles: ['NORMAL', 'CAPTURA', 'ADMIN']
      },
      {
        label: 'Carga Gastos Toka',
        href: '/gastos-toka',
        roles: ['ADMIN']
      },
      {
        label: 'Listados de Rutas',
        href: '/generar-pdfs',
        roles: ['NORMAL', 'ADMIN']
      }
    ]
  },
  {
    title: 'Reportes',
    roles: ['NORMAL', 'ADMIN'],
    items: [
      {
        label: 'Reporte Financiero',
        href: '/reporte-financiero',
        roles: ['ADMIN']
      },
      {
        label: 'Reporte de Cobranza',
        href: '/reporte-cobranza',
        roles: ['NORMAL', 'ADMIN']
      }
    ]
  },
                {
                title: 'Administración del Sistema',
                roles: ['ADMIN'],
                items: [
                  {
                    label: 'Administrar Rutas',
                    href: '/administrar-rutas',
                    roles: ['ADMIN']
                  },
                  {
                    label: 'Limpieza de Cartera',
                    href: '/limpieza-cartera',
                    roles: ['ADMIN']
                  },
                  {
                    label: 'Configuración de Reportes',
                    href: '/configuracion-reportes',
                    roles: ['ADMIN']
                  },
                  {
                    label: 'Usuarios de Telegram',
                    href: '/telegram-users',
                    roles: ['ADMIN']
                  },
                  {
                    label: 'Dashboard Administrativo',
                    href: '/admin-dashboard',
                    roles: ['ADMIN']
                  },
                  {
                    label: 'Todas las Listas',
                    href: '/',
                    roles: ['ADMIN']
                  }
                ]
              }
];

export function CustomNavigation({ authenticatedItem, lists }: NavigationProps) {
  const [userRole, setUserRole] = useState<string>('NORMAL');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showKeystoneLists, setShowKeystoneLists] = useState<boolean>(false);

  useEffect(() => {
    // Obtener el rol del usuario desde la sesión
    if (authenticatedItem && 'id' in authenticatedItem) {
      // Hacer una consulta GraphQL para obtener el rol del usuario
      const fetchUserRole = async () => {
        try {
          // Usar la API de Keystone para obtener el usuario actual
          const response = await fetch('/api/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                query GetCurrentUser($id: ID!) {
                  user(where: { id: $id }) {
                    id
                    role
                  }
                }
              `,
              variables: {
                id: authenticatedItem.id
              }
            })
          });

          const result = await response.json();
          if (result.data?.user?.role) {
            setUserRole(result.data.user.role);
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          // Fallback al rol por defecto
          setUserRole('NORMAL');
        }
      };

      fetchUserRole();
    }
  }, [authenticatedItem]);

  // Filtrar secciones según el rol
  const filteredSections = menuSections.filter(section => 
    section.roles.includes(userRole)
  );

  const toggleSection = (sectionTitle: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  const isSectionExpanded = (sectionTitle: string) => expandedSections.has(sectionTitle);

  const handleShowKeystoneLists = () => {
    setShowKeystoneLists(!showKeystoneLists);
  };

  return (
    <NavigationContainer authenticatedItem={authenticatedItem}>
      {/* Dashboard */}
      <NavItem href="/">Dashboard</NavItem>
      
      {/* Secciones del menú corporativo */}
      {filteredSections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="menu-section">
          {/* Encabezado de la sección */}
          <div 
            className={`section-header ${isSectionExpanded(section.title) ? 'expanded' : ''}`}
            onClick={() => toggleSection(section.title)}
          >
            <span className="section-title">{section.title}</span>
            <span className="section-arrow">›</span>
          </div>
          
          {/* Elementos de la sección */}
          {isSectionExpanded(section.title) && (
            <div className="section-items">
              {section.items
                .filter(item => item.roles.includes(userRole))
                .map((item, itemIndex) => (
                  <div key={itemIndex}>
                    {item.label === 'Todas las Listas' ? (
                      <div 
                        className="keystone-lists-toggle"
                        onClick={handleShowKeystoneLists}
                      >
                        {item.label}
                      </div>
                    ) : (
                      <NavItem href={item.href}>
                        {item.label}
                      </NavItem>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}

      {/* Mostrar listas nativas de Keystone cuando se solicite */}
      {showKeystoneLists && userRole === 'ADMIN' && (
        <div className="keystone-lists-section">
          <div className="keystone-lists-header">
            <span>Listas del Sistema</span>
            <button 
              className="close-keystone-lists"
              onClick={() => setShowKeystoneLists(false)}
            >
              ✕
            </button>
          </div>
          <ListNavItems lists={lists} />
        </div>
      )}
    </NavigationContainer>
  );
}

