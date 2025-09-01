/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx } from '@keystone-ui/core';
import { useQuery } from '@apollo/client';
import { Button } from '@keystone-ui/button';
import { FaBug, FaEye, FaEyeSlash, FaSync } from 'react-icons/fa';
import { DEBUG_USER_EMPLOYEE_RELATION } from '../../graphql/queries/dashboard';

const styles = {
  container: {
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    fontSize: '12px',
    fontFamily: 'monospace',
    border: '1px solid #374151',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fbbf24',
  },
  controls: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid #4b5563',
    backgroundColor: '#374151',
    color: '#f9fafb',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  content: {
    backgroundColor: '#111827',
    borderRadius: '4px',
    padding: '12px',
    overflow: 'auto',
    maxHeight: '400px',
  },
  status: (type: 'success' | 'warning' | 'error') => ({
    padding: '8px',
    borderRadius: '4px',
    marginBottom: '8px',
    backgroundColor: 
      type === 'success' ? '#065f46' : 
      type === 'warning' ? '#92400e' : '#991b1b',
    color: 'white',
    fontSize: '11px',
    fontWeight: '600',
  }),
  section: {
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #374151',
  },
  sectionTitle: {
    color: '#60a5fa',
    fontWeight: '600',
    marginBottom: '8px',
  },
};

interface DebugPanelProps {
  show?: boolean;
}

export const DebugPanel = ({ show = false }: DebugPanelProps) => {
  const [isVisible, setIsVisible] = useState(show);
  
  const { data, loading, error, refetch } = useQuery(DEBUG_USER_EMPLOYEE_RELATION, {
    fetchPolicy: 'no-cache',
    skip: !isVisible
  });

  if (!isVisible) {
    return (
      <div css={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
      }}>
        <button
          css={{
            ...styles.button,
            backgroundColor: '#dc2626',
            borderColor: '#dc2626',
          }}
          onClick={() => setIsVisible(true)}
        >
          <FaBug />
          Debug
        </button>
      </div>
    );
  }

  const debugData = data?.debugUserEmployeeRelation;

  return (
    <div css={styles.container}>
      <div css={styles.header}>
        <div css={styles.title}>
          <FaBug />
          Debug: User-Employee Relation
        </div>
        <div css={styles.controls}>
          <button css={styles.button} onClick={() => refetch()}>
            <FaSync />
            Refresh
          </button>
          <button css={styles.button} onClick={() => setIsVisible(false)}>
            <FaEyeSlash />
            Ocultar
          </button>
        </div>
      </div>

      {loading && (
        <div css={styles.status('warning')}>
          🔄 Cargando información de debug...
        </div>
      )}

      {error && (
        <div css={styles.status('error')}>
          ❌ Error: {error.message}
        </div>
      )}

      {debugData && (
        <div css={styles.content}>
          <div css={styles.section}>
            <div css={styles.sectionTitle}>Usuario Actual:</div>
            <div css={styles.status(debugData.currentUser?.hasEmployee ? 'success' : 'warning')}>
              {debugData.currentUser?.hasEmployee ? 
                '✅ Tiene empleado vinculado' : 
                '⚠️ NO tiene empleado vinculado'
              }
            </div>
            <pre>{JSON.stringify(debugData.currentUser, null, 2)}</pre>
          </div>

          {debugData.potentialEmployeeMatches?.length > 0 && (
            <div css={styles.section}>
              <div css={styles.sectionTitle}>Empleados Potenciales:</div>
              <pre>{JSON.stringify(debugData.potentialEmployeeMatches, null, 2)}</pre>
            </div>
          )}

          <div css={styles.section}>
            <div css={styles.sectionTitle}>Estadísticas:</div>
            <div>Total empleados: {debugData.allEmployeesCount}</div>
            <div>Con usuario: {debugData.employeesWithUser}</div>
            <div>Sin usuario: {debugData.employeesWithoutUser}</div>
          </div>
        </div>
      )}
    </div>
  );
};