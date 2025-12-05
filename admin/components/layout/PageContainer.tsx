/**
 * PageContainer - Contenedor principal de página migrado a shadcn
 *
 * Reemplaza el PageContainer de Keystone UI con soporte para:
 * - Dark/Light mode usando ThemeContext
 * - Variables CSS centralizadas
 * - Sidebar responsive
 * - Layout grid optimizado
 */

import React, { useState, ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useSafeTheme } from '../../contexts/ThemeContext';

type PageContainerProps = {
  children: ReactNode;
  header: ReactNode;
  title?: string;
  sidebar?: ReactNode;
};

export const HEADER_HEIGHT = 80;

export function PageContainer({ children, header, title, sidebar }: PageContainerProps) {
  const { isDark } = useSafeTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      {/* Prevent body scroll when sidebar is open on mobile */}
      <style>{`body { overflow: hidden; }`}</style>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 1fr)',
          gridTemplateRows: `repeat(2, ${HEADER_HEIGHT}px) auto`,
          height: '100vh',
          isolation: 'isolate',
          background: 'var(--theme-background)',
          transition: 'background 0.3s ease',
        }}
        className="page-container"
      >
        {/* Logo and mobile menu toggle */}
        <div
          style={{
            gridColumn: '1/2',
            gridRow: '1/2',
            alignItems: 'center',
            borderBottom: '1px solid var(--theme-border)',
            display: 'flex',
            justifyContent: 'space-between',
            paddingLeft: '24px',
            paddingRight: '24px',
            background: 'var(--theme-card)',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--theme-foreground)' }}>
            {title || 'Keystone'}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              display: 'block',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: 'var(--theme-foreground)',
            }}
            className="mobile-menu-toggle"
            aria-label="Toggle navigation"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Header */}
        <header
          style={{
            gridColumn: '1/2',
            gridRow: '2/3',
            alignItems: 'center',
            background: 'var(--theme-background)',
            borderBottom: '1px solid var(--theme-border)',
            display: 'flex',
            justifyContent: 'space-between',
            minWidth: 0,
            paddingLeft: '24px',
            paddingRight: '24px',
            visibility: isSidebarOpen ? 'hidden' : 'visible',
            transition: 'all 0.3s ease',
          }}
        >
          {header}
        </header>

        {/* Sidebar */}
        {sidebar && (
          <div
            style={{
              gridColumn: '1/2',
              gridRow: '2/4',
              display: isSidebarOpen ? 'block' : 'none',
              height: '100vh',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: 'var(--theme-card)',
              borderRight: '1px solid var(--theme-border)',
              transition: 'all 0.3s ease',
            }}
            className="sidebar-container"
          >
            <aside style={{ minWidth: 0 }}>
              {sidebar}
            </aside>
          </div>
        )}

        {/* Main content */}
        <main
          style={{
            gridColumn: '1/2',
            gridRow: '3/4',
            background: 'var(--theme-background)',
            boxSizing: 'border-box',
            minWidth: 0,
            paddingLeft: '24px',
            paddingRight: '24px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
            transition: 'all 0.3s ease',
          }}
        >
          {children}
        </main>

        <style jsx>{`
          @media (min-width: 576px) {
            .page-container {
              grid-template-columns: minmax(300px, 1fr) 4fr !important;
              grid-template-rows: ${HEADER_HEIGHT}px auto !important;
            }

            .mobile-menu-toggle {
              display: none !important;
            }

            .sidebar-container {
              grid-column: 1/2 !important;
              grid-row: 2/3 !important;
              display: block !important;
              height: 100% !important;
            }

            header {
              grid-column: 2/3 !important;
              grid-row: 1/2 !important;
              visibility: visible !important;
            }

            main {
              grid-column: 2/3 !important;
              grid-row: 2/3 !important;
            }
          }

          /* Scrollbar styling */
          .sidebar-container::-webkit-scrollbar,
          main::-webkit-scrollbar {
            width: 8px;
          }

          .sidebar-container::-webkit-scrollbar-track,
          main::-webkit-scrollbar-track {
            background: var(--theme-scrollbar-track);
          }

          .sidebar-container::-webkit-scrollbar-thumb,
          main::-webkit-scrollbar-thumb {
            background: var(--theme-scrollbar-thumb);
            border-radius: 4px;
          }

          .sidebar-container::-webkit-scrollbar-thumb:hover,
          main::-webkit-scrollbar-thumb:hover {
            background: var(--theme-scrollbar-thumb-hover);
          }
        `}</style>
      </div>
    </>
  );
}
