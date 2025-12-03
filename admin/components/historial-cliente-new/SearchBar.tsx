/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import React, { useState, useEffect } from 'react';
import { Search, BarChart4, Trash2, GitMerge, Users } from 'lucide-react';
import { colors, radius, commonStyles, shadows } from './theme';
import { useSafeTheme, useSafeThemeColors } from '../../contexts/ThemeContext';

interface SearchBarProps {
  onSearch: (query: string) => void;
  initialValue?: string;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onClear: () => void;
  onMerge?: () => void;
  onShowDuplicates?: () => void;
  showDuplicates?: boolean;
  duplicateCount?: number;
  hasSelectedClient?: boolean;
  onGeneratePDF?: (detailed: boolean) => void;
  isLoading?: boolean;
  selectedClientName?: string;
  selectedClientCode?: string;
}

export function SearchBar({
  onSearch,
  searchTerm,
  onSearchTermChange,
  onClear,
  onMerge,
  onShowDuplicates,
  showDuplicates,
  duplicateCount = 0,
  hasSelectedClient,
  onGeneratePDF,
  isLoading,
  selectedClientName,
  selectedClientCode,
  // New props for integrated autocomplete
  searchResults = [],
  showResults = false,
  onSelectResult,
}: SearchBarProps & {
  searchResults?: any[];
  showResults?: boolean;
  onSelectResult?: (result: any) => void;
}) {
  // Use safe hooks that don't throw when outside ThemeProvider
  const { isDark } = useSafeTheme();
  const themeColors = useSafeThemeColors();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm) onSearch(searchTerm);
  };

  return (
    <div css={{ 
      ...commonStyles.card, 
      padding: '1.5rem', 
      border: `1px solid ${themeColors.border}`,
      backgroundColor: themeColors.card,
      marginBottom: '1.5rem',
      position: 'relative',
      zIndex: 20,
      transition: 'all 0.3s ease',
    }}>
      <div css={{ flex: 1 }}>
        <div css={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Search size={20} color={themeColors.foregroundMuted} />
          <h2 css={{ fontSize: '1.25rem', fontWeight: 500, margin: 0, color: themeColors.foreground, transition: 'color 0.3s ease' }}>Búsqueda de Cliente</h2>
        </div>
        <p css={{ color: themeColors.foregroundMuted, marginBottom: '1rem', fontSize: '0.875rem', marginTop: 0 }}>
          Buscar Cliente (Nombre, Clave Única) - La información de ruta y
          localidad aparecerá en los resultados
        </p>
        <form onSubmit={handleSubmit} css={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div css={{ position: 'relative' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Nombre del cliente o clave única"
              css={{
                width: '100%',
                borderRadius: radius.lg,
                border: `1px solid ${themeColors.border}`,
                backgroundColor: themeColors.background,
                color: themeColors.foreground,
                padding: '0.625rem 1rem',
                fontSize: '0.875rem',
                boxShadow: shadows.sm,
                transition: 'all 0.2s ease',
                outline: 'none',
                '&::placeholder': {
                  color: themeColors.foregroundMuted,
                },
                '&:focus': {
                  borderColor: colors.primary,
                  boxShadow: `0 0 0 2px ${isDark ? colors.blue[800] : colors.blue[100]}`
                }
              }}
            />
            
            {/* Integrated Autocomplete Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div css={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                backgroundColor: themeColors.card,
                borderRadius: '0.5rem',
                boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.4)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: `1px solid ${themeColors.border}`,
                maxHeight: '20rem',
                overflowY: 'auto',
                marginTop: '0.25rem',
              }}>
                {searchResults.map((result: any) => (
                  <div
                    key={result.id}
                    onClick={() => onSelectResult && onSelectResult(result)}
                    css={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: `1px solid ${isDark ? colors.slate[700] : colors.muted}`,
                      '&:hover': { backgroundColor: isDark ? colors.slate[700] : colors.muted },
                      '&:last-child': { borderBottom: 'none' }
                    }}
                  >
                    <div css={{ fontWeight: 500, color: themeColors.foreground }}>{result.name}</div>
                    <div css={{ fontSize: '0.875rem', color: themeColors.foregroundMuted, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>🔑 {result.clientCode}</span>
                      <span>📍 {result.location}</span>
                      <span>🗺️ {result.route}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div css={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '0.5rem',
            '@media (min-width: 640px)': { gridTemplateColumns: 'repeat(4, 1fr)' }
          }}>
            <Button 
              type="submit" 
              variant="primary" 
              icon={<BarChart4 size={16} />}
              disabled={isLoading}
            >
              Generar
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onClear}
              icon={<Trash2 size={16} />}
            >
              Limpiar
            </Button>
            <Button 
              type="button" 
              variant="purple" 
              onClick={onMerge}
              disabled={!onMerge}
              icon={<GitMerge size={16} />}
            >
              Fusionar
            </Button>
            {duplicateCount > 0 && (
               <Button 
               type="button" 
               variant="warning" 
               onClick={onShowDuplicates}
               icon={<Users size={16} />}
             >
               Duplicados ({duplicateCount})
             </Button>
            )}
          </div>
          
          {hasSelectedClient && onGeneratePDF && (
            <div css={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.25rem' }}>
              <Button 
                type="button" 
                variant="outline-success" 
                onClick={() => onGeneratePDF(true)}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 21H17C19.2091 21 21 19.2091 21 17V7C21 4.79086 19.2091 3 17 3H7C4.79086 3 3 4.79086 3 7V17C3 19.2091 4.79086 21 7 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.5 8H10.5C9.67157 8 9 8.67157 9 9.5V14.5C9 15.3284 9.67157 16 10.5 16H13.5C14.3284 16 15 15.3284 15 14.5V9.5C15 8.67157 14.3284 8 13.5 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 11H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 13H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                PDF Detallado
              </Button>
              <Button 
                type="button" 
                variant="outline-primary" 
                onClick={() => onGeneratePDF(false)}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                PDF Resumen
              </Button>
            </div>
          )}
        </form>
        
        {selectedClientName && (
          <div css={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            <p css={{ color: colors.mutedForeground, margin: 0 }}>
              Cliente seleccionado:{' '}
              <span css={{ fontWeight: 500, color: colors.foreground }}>
                {selectedClientName}
              </span>{' '}
              {selectedClientCode && (
                <span css={{ color: colors.mutedForeground }}>({selectedClientCode})</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Button({ type = 'button', variant = 'primary', children, onClick, icon, disabled }: any) {
  const getStyles = () => {
    const base = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.375rem',
      borderRadius: radius.lg,
      padding: '0.625rem 0.75rem',
      fontSize: '0.875rem',
      fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: 'none',
      transition: 'background-color 0.2s',
      opacity: disabled ? 0.6 : 1,
    };

    switch (variant) {
      case 'primary':
        return { ...base, backgroundColor: colors.blue[500], color: 'white', '&:hover': { backgroundColor: disabled ? colors.blue[500] : colors.blue[600] } };
      case 'secondary':
        return { ...base, backgroundColor: colors.slate[500], color: 'white', '&:hover': { backgroundColor: disabled ? colors.slate[500] : colors.slate[600] } };
      case 'purple':
        return { ...base, backgroundColor: colors.purple[500], color: 'white', '&:hover': { backgroundColor: disabled ? colors.purple[500] : colors.purple[600] } };
      case 'warning':
        return { ...base, backgroundColor: colors.amber[500], color: 'white', '&:hover': { backgroundColor: disabled ? colors.amber[500] : colors.amber[600] } };
      case 'outline-success':
        return { 
          ...base, 
          backgroundColor: 'rgba(16, 185, 129, 0.1)', 
          color: colors.green[700], 
          border: `1px solid ${colors.green[500]}`,
          '&:hover': { backgroundColor: 'rgba(16, 185, 129, 0.2)' } 
        };
      case 'outline-primary':
        return { 
          ...base, 
          backgroundColor: 'rgba(59, 130, 246, 0.1)', 
          color: colors.blue[700], 
          border: `1px solid ${colors.blue[500]}`,
          '&:hover': { backgroundColor: 'rgba(59, 130, 246, 0.2)' } 
        };
      default:
        return base;
    }
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled} css={getStyles()}>
      {icon}
      <span css={{ display: 'none', '@media (min-width: 640px)': { display: 'inline' } }}>{children}</span>
    </button>
  );
}

