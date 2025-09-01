/** @jsxRuntime classic */
/** @jsx jsx */

import React from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { useQuery } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { LoadingDots } from '@keystone-ui/loading';
import { gql } from '@apollo/client';
import { Button } from '@keystone-ui/button';

const DEBUG_USER_EMPLOYEE = gql`
  query DebugUserEmployee {
    debugUserEmployeeRelation
  }
`;

const styles = {
  container: {
    padding: '24px',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#1a202c',
  },
  code: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '16px',
    fontFamily: 'monospace',
    fontSize: '14px',
    overflow: 'auto',
  },
  status: (type: 'success' | 'warning' | 'error') => ({
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '16px',
    backgroundColor: 
      type === 'success' ? '#dcfce7' : 
      type === 'warning' ? '#fef3c7' : '#fee2e2',
    color: 
      type === 'success' ? '#166534' : 
      type === 'warning' ? '#92400e' : '#991b1b',
  }),
  employeeCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '8px',
  },
  employeeName: {
    fontWeight: '600',
    marginBottom: '4px',
  },
  employeeDetail: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '2px',
  },
};

export default function DebugUserEmployeePage() {
  const { data, loading, error, refetch } = useQuery(DEBUG_USER_EMPLOYEE, {
    fetchPolicy: 'no-cache'
  });

  if (loading) {
    return (
      <PageContainer header="Debug User-Employee Relation">
        <Box css={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <LoadingDots label="Cargando información de debug..." size="large" tone="active" />
        </Box>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer header="Debug User-Employee Relation">
        <div css={styles.container}>
          <div css={styles.status('error')}>
            ❌ Error: {error.message}
          </div>
        </div>
      </PageContainer>
    );
  }

  const debugData = data?.debugUserEmployeeRelation;

  if (!debugData) {
    return (
      <PageContainer header="Debug User-Employee Relation">
        <div css={styles.container}>
          <div css={styles.status('warning')}>
            ⚠️ No se recibieron datos de debug
          </div>
        </div>
      </PageContainer>
    );
  }

  const { currentUser, potentialEmployeeMatches, allEmployeesCount, employeesWithUser, employeesWithoutUser } = debugData;

  return (
    <PageContainer header="Debug User-Employee Relation">
      <div css={styles.container}>
        <div css={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h1>Debug: Relación User-Employee</h1>
          <Button onClick={() => refetch()}>Actualizar</Button>
        </div>

        {/* Current User Status */}
        <div css={styles.section}>
          <h2 css={styles.title}>Usuario Actual</h2>
          <div css={styles.status(currentUser.hasEmployee ? 'success' : 'warning')}>
            {currentUser.hasEmployee ? '✅ Usuario tiene empleado vinculado' : '⚠️ Usuario NO tiene empleado vinculado'}
          </div>
          
          <div css={styles.code}>
            <pre>{JSON.stringify(currentUser, null, 2)}</pre>
          </div>
        </div>

        {/* Statistics */}
        <div css={styles.section}>
          <h2 css={styles.title}>Estadísticas Generales</h2>
          <div css={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}>
            <div css={{
              backgroundColor: '#f0f9ff',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div css={{ fontSize: '24px', fontWeight: '700', color: '#1e40af' }}>
                {allEmployeesCount}
              </div>
              <div css={{ fontSize: '12px', color: '#6b7280' }}>
                Total Empleados
              </div>
            </div>
            
            <div css={{
              backgroundColor: '#f0fdf4',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div css={{ fontSize: '24px', fontWeight: '700', color: '#16a34a' }}>
                {employeesWithUser}
              </div>
              <div css={{ fontSize: '12px', color: '#6b7280' }}>
                Con Usuario Vinculado
              </div>
            </div>
            
            <div css={{
              backgroundColor: '#fef2f2',
              padding: '16px',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div css={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>
                {employeesWithoutUser}
              </div>
              <div css={{ fontSize: '12px', color: '#6b7280' }}>
                Sin Usuario Vinculado
              </div>
            </div>
          </div>
        </div>

        {/* Potential Matches */}
        <div css={styles.section}>
          <h2 css={styles.title}>Empleados Potenciales (por nombre)</h2>
          {potentialEmployeeMatches.length > 0 ? (
            <div>
              {potentialEmployeeMatches.map((emp: any, index: number) => (
                <div key={index} css={styles.employeeCard}>
                  <div css={styles.employeeName}>
                    {emp.name || 'Sin nombre'} 
                    {emp.hasUser && ' (YA VINCULADO)'}
                  </div>
                  <div css={styles.employeeDetail}>ID: {emp.id}</div>
                  <div css={styles.employeeDetail}>Tipo: {emp.type || 'Sin tipo'}</div>
                  <div css={styles.employeeDetail}>Ruta: {emp.routeName || 'Sin ruta'}</div>
                  {emp.hasUser && (
                    <div css={styles.employeeDetail}>
                      Vinculado a: {emp.connectedUserName} (ID: {emp.connectedUserId})
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div css={styles.status('warning')}>
              No se encontraron empleados con nombres similares
            </div>
          )}
        </div>

        {/* Instructions */}
        <div css={styles.section}>
          <h2 css={styles.title}>Instrucciones para Solucionar</h2>
          
          {!currentUser.hasEmployee && (
            <div>
              <div css={styles.status('warning')}>
                🔧 Tu usuario no está vinculado a ningún empleado
              </div>
              
              <h3>Opciones para solucionar:</h3>
              <ol css={{ marginLeft: '20px', lineHeight: '1.6' }}>
                <li>
                  <strong>Opción 1 - Via Admin UI:</strong>
                  <ul css={{ marginLeft: '20px', marginTop: '8px' }}>
                    <li>Ve a <code>/gestionar-usuarios-empleados</code></li>
                    <li>Busca tu usuario en la lista</li>
                    <li>Selecciona el empleado correcto</li>
                    <li>Haz clic en "Vincular"</li>
                  </ul>
                </li>
                
                <li css={{ marginTop: '12px' }}>
                  <strong>Opción 2 - Via Base de Datos:</strong>
                  <div css={{ ...styles.code, marginTop: '8px' }}>
                    {`UPDATE "Employee" SET "user" = '${currentUser.id}' WHERE id = 'EMPLOYEE_ID_AQUI';`}
                  </div>
                </li>
                
                <li css={{ marginTop: '12px' }}>
                  <strong>Opción 3 - Via GraphQL:</strong>
                  <div css={{ ...styles.code, marginTop: '8px' }}>
                    {`mutation {
  updateEmployee(
    where: { id: "EMPLOYEE_ID_AQUI" }
    data: { user: { connect: { id: "${currentUser.id}" } } }
  ) {
    id
    user { name }
  }
}`}
                  </div>
                </li>
              </ol>
            </div>
          )}

          {currentUser.hasEmployee && !currentUser.employeeData?.routes && (
            <div>
              <div css={styles.status('warning')}>
                🔧 Tu empleado no tiene ruta asignada
              </div>
              
              <p>Para asignar una ruta al empleado:</p>
              <div css={{ ...styles.code, marginTop: '8px' }}>
                {`UPDATE "Employee" SET "routesId" = 'ROUTE_ID_AQUI' WHERE id = '${currentUser.employeeData?.id}';`}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}