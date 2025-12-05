/**
 * Navigation - Componente de navegación lateral migrado a shadcn
 *
 * Reemplaza el Navigation de Keystone UI con:
 * - Dark/Light mode usando ThemeContext
 * - Variables CSS centralizadas
 * - Componentes shadcn (Button, DropdownMenu)
 * - Integración con ThemeToggle
 */

import React, { Fragment, ReactNode } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { MoreHorizontal, ChevronRight } from 'lucide-react';
import { useSafeTheme } from '../../contexts/ThemeContext';
import { ThemeToggle } from '../ui/ThemeToggle';

type NavItemProps = {
  href: string;
  children: ReactNode;
  isSelected?: boolean;
};

export function NavItem({ href, children, isSelected: _isSelected }: NavItemProps) {
  const router = useRouter();
  const isSelected = _isSelected !== undefined ? _isSelected : router.pathname === href;

  return (
    <li style={{ listStyle: 'none' }}>
      <Link
        href={href}
        aria-current={isSelected ? 'location' : false}
        style={{
          display: 'block',
          padding: '8px 24px',
          marginBottom: '4px',
          marginRight: '24px',
          borderBottomRightRadius: '6px',
          borderTopRightRadius: '6px',
          background: isSelected ? 'var(--theme-background-secondary)' : 'transparent',
          color: isSelected ? 'var(--theme-foreground)' : 'var(--theme-foreground-muted)',
          fontWeight: isSelected ? '600' : '500',
          fontSize: '14px',
          textDecoration: 'none',
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
        className="nav-item"
      >
        {children}
        <style jsx>{`
          .nav-item:hover {
            background: var(--theme-card-hover);
            color: var(--theme-foreground-secondary);
          }
        `}</style>
      </Link>
    </li>
  );
}

type NavigationContainerProps = {
  children: ReactNode;
  authenticatedItem?: {
    label: string;
    state: 'authenticated' | 'unauthenticated';
  };
  showApiLinks?: boolean;
  onSignout?: () => void;
};

export function NavigationContainer({
  children,
  authenticatedItem,
  showApiLinks = false,
  onSignout,
}: NavigationContainerProps) {
  const { isDark } = useSafeTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        height: '100%',
      }}
    >
      {/* User info and theme toggle */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          margin: '24px',
          marginBottom: '0',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--theme-border)',
        }}
      >
        {authenticatedItem && authenticatedItem.state === 'authenticated' && (
          <div style={{ fontSize: '13px', color: 'var(--theme-foreground-muted)' }}>
            Conectado como{' '}
            <strong style={{ display: 'block', color: 'var(--theme-foreground)', fontSize: '14px' }}>
              {authenticatedItem.label}
            </strong>
          </div>
        )}

        {/* Theme toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemeToggle size="sm" showLabel />

          {showApiLinks && (
            <button
              style={{
                padding: '6px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--theme-foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
              }}
              className="api-links-button"
              aria-label="API Links"
            >
              <MoreHorizontal size={20} />
            </button>
          )}
        </div>

        {onSignout && authenticatedItem?.state === 'authenticated' && (
          <button
            onClick={onSignout}
            style={{
              padding: '8px 12px',
              background: 'var(--theme-destructive)',
              color: 'var(--theme-destructive-foreground)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
            }}
            className="signout-button"
          >
            Cerrar sesión
          </button>
        )}
      </div>

      {/* Navigation items */}
      <nav
        role="navigation"
        aria-label="Navegación lateral"
        style={{
          marginTop: '24px',
          flex: 1,
          overflowY: 'auto',
        }}
      >
        <ul style={{ padding: 0, margin: 0 }}>
          {children}
        </ul>
      </nav>

      <style jsx>{`
        .api-links-button:hover {
          background: var(--theme-card-hover);
          color: var(--theme-foreground);
        }

        .signout-button:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}

type ListMeta = {
  key: string;
  path: string;
  label: string;
  isSingleton?: boolean;
};

type ListNavItemProps = {
  list: ListMeta;
};

export function ListNavItem({ list }: ListNavItemProps) {
  const router = useRouter();
  const isSelected = router.pathname.split('/')[1] === `/${list.path}`.split('/')[1];

  return (
    <NavItem
      isSelected={isSelected}
      href={`/${list.path}${list.isSingleton ? '/1' : ''}`}
    >
      {list.label}
    </NavItem>
  );
}

type ListNavItemsProps = {
  lists?: ListMeta[];
  include?: string[];
};

export function ListNavItems({ lists = [], include = [] }: ListNavItemsProps) {
  const renderedList = include.length > 0
    ? lists.filter(i => include.includes(i.key))
    : lists;

  return (
    <Fragment>
      {renderedList.map((list: ListMeta) => (
        <ListNavItem key={list.key} list={list} />
      ))}
    </Fragment>
  );
}

// Hook para obtener estilos de link con tema
export function useNavLinkStyles() {
  const { isDark } = useSafeTheme();

  return {
    link: {
      display: 'flex',
      alignItems: 'center',
      fontSize: '13px',
      textDecoration: 'none',
      color: 'var(--theme-foreground-secondary)',
      transition: 'color 0.2s ease',
    },
    icon: {
      marginLeft: 'auto',
    },
  };
}
