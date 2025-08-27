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
    title: 'Clientes',
    roles: ['normal', 'admin'],
    items: [
      {
        label: 'Historial de Clientes',
        href: '/historial-cliente',
        roles: ['normal', 'admin']
      },
      {
        label: 'Carga de Documentos',
        href: '/documentos-personales',
        roles: ['normal', 'admin']
      },
      {
        label: 'Limpieza de Cartera',
        href: '/limpieza-cartera',
        roles: ['admin']
      }
    ]
  },
  {
    title: 'Operaciones',
    roles: ['normal', 'admin'],
    items: [
      {
        label: 'Captura Semanal',
        href: '/transacciones',
        roles: ['normal', 'captura', 'admin']
      },
      {
        label: 'Carga Gastos Toka',
        href: '/gastos-toka',
        roles: ['admin']
      }
    ]
  },
  {
    title: 'Reportes',
    roles: ['normal', 'admin'],
    items: [
      {
        label: 'Reporte Finanzas',
        href: '/reporte-finanzas',
        roles: ['admin']
      },
      {
        label: 'Reporte Cobranza',
        href: '/reporte-cobranza',
        roles: ['normal', 'admin']
      }
    ]
  },
];

export function CustomNavigation({ authenticatedItem, lists }: NavigationProps) {
  const [userRole, setUserRole] = useState<string>('normal');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Obtener el rol del usuario desde la sesión
    // Por ahora usamos 'normal' como default, pero puedes implementar la lógica real
    if (authenticatedItem && 'id' in authenticatedItem) {
      // Aquí puedes hacer una consulta para obtener el rol del usuario
      setUserRole('normal'); // Cambiar por la lógica real
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
                  <NavItem key={itemIndex} href={item.href}>
                    {item.label}
                  </NavItem>
                ))}
            </div>
          )}
        </div>
      ))}
    </NavigationContainer>
  );
}

