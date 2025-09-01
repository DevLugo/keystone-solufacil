/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { useQuery, useMutation } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { Select } from '@keystone-ui/fields';
import { gql } from '@apollo/client';
import { FaUser, FaUserTie, FaLink, FaUnlink, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import ProtectedRoute from '../components/ProtectedRoute';

const GET_USERS_AND_EMPLOYEES = gql`
  query GetUsersAndEmployees {
    users {
      id
      name
      email
      role
      employee {
        id
        type
        routes {
          id
          name
        }
        personalData {
          fullName
          clientCode
        }
      }
    }
    employees {
      id
      type
      routes {
        id
        name
      }
      personalData {
        fullName
        clientCode
      }
      user {
        id
        name
        email
      }
    }
  }
`;

const LINK_USER_TO_EMPLOYEE = gql`
  mutation LinkUserToEmployee($userId: ID!, $employeeId: ID!) {
    updateEmployee(where: { id: $employeeId }, data: { user: { connect: { id: $userId } } }) {
      id
      user {
        id
        name
        email
      }
    }
  }
`;

const UNLINK_USER_FROM_EMPLOYEE = gql`
  mutation UnlinkUserFromEmployee($employeeId: ID!) {
    updateEmployee(where: { id: $employeeId }, data: { user: { disconnect: true } }) {
      id
    }
  }
`;

const styles = {
  container: {
    padding: '24px',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  userGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  userCard: (hasEmployee: boolean) => ({
    backgroundColor: hasEmployee ? '#f0fdf4' : '#fef2f2',
    borderRadius: '12px',
    padding: '16px',
    border: `1px solid ${hasEmployee ? '#bbf7d0' : '#fecaca'}`,
  }),
  userInfo: {
    marginBottom: '12px',
  },
  userName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: '4px',
  },
  userEmail: {
    fontSize: '14px',
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  userRole: (role: string) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: role === 'ADMIN' ? '#3b82f6' : '#6b7280',
    color: 'white',
    marginTop: '4px',
  }),
  employeeInfo: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '8px',
    fontSize: '14px',
  },
  linkingSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    flexWrap: 'wrap' as const,
  },
  selectContainer: {
    flex: 1,
    minWidth: '200px',
  },
  actionButton: (type: 'link' | 'unlink') => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    padding: '6px 12px',
    backgroundColor: type === 'link' ? '#16a34a' : '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  }),
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center' as const,
    border: '1px solid #e2e8f0',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
  },
};

export default function GestionarUsuariosEmpleadosPage() {
  const [selectedEmployeeForUser, setSelectedEmployeeForUser] = useState<{[userId: string]: string}>({});
  
  const { data, loading, error, refetch } = useQuery(GET_USERS_AND_EMPLOYEES, {
    fetchPolicy: 'cache-and-network'
  });

  const [linkUserToEmployee] = useMutation(LINK_USER_TO_EMPLOYEE, {
    onCompleted: () => {
      refetch();
    }
  });

  const [unlinkUserFromEmployee] = useMutation(UNLINK_USER_FROM_EMPLOYEE, {
    onCompleted: () => {
      refetch();
    }
  });

  if (loading) {
    return (
      <PageContainer header="Gestionar Usuarios y Empleados">
        <Box css={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <LoadingDots label="Cargando datos..." size="large" tone="active" />
        </Box>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer header="Gestionar Usuarios y Empleados">
        <div css={{ color: 'red', padding: '20px' }}>
          Error al cargar datos: {error.message}
        </div>
      </PageContainer>
    );
  }

  const users = data?.users || [];
  const employees = data?.employees || [];
  
  // Statistics
  const usersWithEmployee = users.filter((user: any) => user.employee);
  const usersWithoutEmployee = users.filter((user: any) => !user.employee);
  const employeesWithUser = employees.filter((emp: any) => emp.user);
  const employeesWithoutUser = employees.filter((emp: any) => !emp.user);

  const handleLinkUser = async (userId: string) => {
    const employeeId = selectedEmployeeForUser[userId];
    if (!employeeId) return;

    try {
      await linkUserToEmployee({
        variables: { userId, employeeId }
      });
      setSelectedEmployeeForUser({ ...selectedEmployeeForUser, [userId]: '' });
    } catch (error) {
      console.error('Error linking user to employee:', error);
    }
  };

  const handleUnlinkEmployee = async (employeeId: string) => {
    try {
      await unlinkUserFromEmployee({
        variables: { employeeId }
      });
    } catch (error) {
      console.error('Error unlinking user from employee:', error);
    }
  };

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <PageContainer header="Gestionar Usuarios y Empleados">
        <div css={styles.container}>
          {/* Statistics */}
          <div css={styles.stats}>
            <div css={styles.statCard}>
              <div css={styles.statValue}>{users.length}</div>
              <div css={styles.statLabel}>Total Usuarios</div>
            </div>
            <div css={styles.statCard}>
              <div css={styles.statValue}>{employees.length}</div>
              <div css={styles.statLabel}>Total Empleados</div>
            </div>
            <div css={styles.statCard}>
              <div css={styles.statValue}>{usersWithEmployee.length}</div>
              <div css={styles.statLabel}>Usuarios Vinculados</div>
            </div>
            <div css={styles.statCard}>
              <div css={styles.statValue}>{usersWithoutEmployee.length}</div>
              <div css={styles.statLabel}>Usuarios Sin Vincular</div>
            </div>
          </div>

          {/* Users Section */}
          <div css={styles.section}>
            <h2 css={styles.sectionTitle}>
              <FaUser />
              Usuarios del Sistema
            </h2>
            
            <div css={styles.userGrid}>
              {users.map((user: any) => {
                const availableEmployees = employees.filter((emp: any) => 
                  !emp.user || emp.user.id === user.id
                );
                
                return (
                  <div key={user.id} css={styles.userCard(!!user.employee)}>
                    <div css={styles.userInfo}>
                      <div css={styles.userName}>
                        {user.employee ? <FaCheck style={{ color: '#16a34a', marginRight: '8px' }} /> : 
                         <FaExclamationTriangle style={{ color: '#dc2626', marginRight: '8px' }} />}
                        {user.name}
                      </div>
                      <div css={styles.userEmail}>{user.email}</div>
                      <span css={styles.userRole(user.role)}>{user.role}</span>
                    </div>

                    {user.employee ? (
                      <div css={styles.employeeInfo}>
                        <strong>Empleado Vinculado:</strong><br />
                        {user.employee.personalData?.fullName || 'Sin nombre'} 
                        {user.employee.type && ` (${user.employee.type})`}
                        {user.employee.routes && (
                          <div style={{ marginTop: '4px' }}>
                            <strong>Ruta:</strong> {user.employee.routes.name}
                          </div>
                        )}
                        <button
                          css={styles.actionButton('unlink')}
                          onClick={() => handleUnlinkEmployee(user.employee.id)}
                          style={{ marginTop: '8px' }}
                        >
                          <FaUnlink />
                          Desvincular
                        </button>
                      </div>
                    ) : (
                      <div css={styles.linkingSection}>
                        <div css={styles.selectContainer}>
                          <Select
                            value={availableEmployees.find(emp => emp.id === selectedEmployeeForUser[user.id])}
                            onChange={(option) => setSelectedEmployeeForUser({
                              ...selectedEmployeeForUser,
                              [user.id]: option?.id || ''
                            })}
                            options={availableEmployees.map(emp => ({
                              label: `${emp.personalData?.fullName || 'Sin nombre'} ${emp.routes?.name ? `(${emp.routes.name})` : '(Sin ruta)'}`,
                              value: emp.id,
                              id: emp.id
                            }))}
                            placeholder="Seleccionar empleado..."
                          />
                        </div>
                        <button
                          css={styles.actionButton('link')}
                          onClick={() => handleLinkUser(user.id)}
                          disabled={!selectedEmployeeForUser[user.id]}
                        >
                          <FaLink />
                          Vincular
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Employees without users */}
          {employeesWithoutUser.length > 0 && (
            <div css={styles.section}>
              <h2 css={styles.sectionTitle}>
                <FaUserTie />
                Empleados Sin Usuario Vinculado ({employeesWithoutUser.length})
              </h2>
              
              <div css={styles.userGrid}>
                {employeesWithoutUser.map((employee: any) => (
                  <div key={employee.id} css={styles.userCard(false)}>
                    <div css={styles.userInfo}>
                      <div css={styles.userName}>
                        <FaExclamationTriangle style={{ color: '#dc2626', marginRight: '8px' }} />
                        {employee.personalData?.fullName || 'Sin nombre'}
                      </div>
                      <div css={styles.userEmail}>
                        Código: {employee.personalData?.clientCode || 'Sin código'}
                      </div>
                      {employee.type && <span css={styles.userRole('NORMAL')}>{employee.type}</span>}
                    </div>
                    
                    {employee.routes && (
                      <div css={styles.employeeInfo}>
                        <strong>Ruta Asignada:</strong><br />
                        {employee.routes.name}
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626' }}>
                          ⚠️ Este empleado necesita un usuario vinculado para acceder al dashboard
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </ProtectedRoute>
  );
}