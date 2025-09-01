/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { useQuery } from '@apollo/client';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { LoadingDots } from '@keystone-ui/loading';
import { GET_ACCOUNTS } from '../graphql/queries/accounts';
import { AccountCard } from '../components/dashboard/AccountCard';
import ProtectedRoute from '../components/ProtectedRoute';

interface Account {
  id: string;
  name: string;
  type: 'BANK' | 'OFFICE_CASH_FUND' | 'EMPLOYEE_CASH_FUND';
  amount: string;
  updatedAt: string;
  route?: {
    employees: Array<{
      id: string;
      personalData: {
        fullName: string;
      };
    }>;
  };
}

export default function AdminDashboardPage() {
  const { data, loading, error } = useQuery(GET_ACCOUNTS, {
    pollInterval: 30000, // Actualizar cada 30 segundos
  });

  if (loading) {
    return (
      <PageContainer header="Dashboard Administrativo - Cuentas">
        <div css={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <LoadingDots label="Cargando cuentas" size="large" tone="active" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer header="Dashboard Administrativo - Cuentas">
        <div css={{ color: 'red', padding: '20px' }}>
          Error al cargar las cuentas: {error.message}
        </div>
      </PageContainer>
    );
  }

  const accounts: Account[] = data?.accounts || [];

  const regularAccounts = accounts.filter(account => account.type !== 'EMPLOYEE_CASH_FUND');
  const employeeAccounts = accounts.filter(account => account.type === 'EMPLOYEE_CASH_FUND');

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <PageContainer header="Dashboard Administrativo - Cuentas">
        <div css={{ padding: '24px' }}>
          {/* Cuentas regulares */}
          <h2 css={{ marginBottom: '20px', fontSize: '1.5rem', fontWeight: 600 }}>Cuentas Generales</h2>
          <div
            css={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '24px',
              marginBottom: '40px',
              '@media (min-width: 1200px)': {
                gridTemplateColumns: 'repeat(3, 1fr)',
              },
              '@media (min-width: 1600px)': {
                gridTemplateColumns: 'repeat(4, 1fr)',
              },
            }}
          >
            {regularAccounts.map((account) => (
              <AccountCard
                key={account.id}
                name={account.name}
                amount={account.amount}
                type={account.type}
              />
            ))}
          </div>

          {/* Cuentas de empleados */}
          <h2 css={{ marginBottom: '20px', fontSize: '1.5rem', fontWeight: 600 }}>Fondos de Empleados</h2>
          <div
            css={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '24px',
              '@media (min-width: 1200px)': {
                gridTemplateColumns: 'repeat(3, 1fr)',
              },
              '@media (min-width: 1600px)': {
                gridTemplateColumns: 'repeat(4, 1fr)',
              },
            }}
          >
            {employeeAccounts.map((account) => (
              <AccountCard
                key={account.id}
                name={`${account.name} - ${account.route?.employees[0]?.personalData.fullName || 'Sin empleado asignado'}`}
                amount={account.amount}
                type={account.type}
              />
            ))}
          </div>

          {accounts.length === 0 && (
            <div
              css={{
                textAlign: 'center',
                padding: '40px',
                color: '#6B7280',
                fontSize: '1.125rem',
              }}
            >
              No hay cuentas disponibles
            </div>
          )}
        </div>
      </PageContainer>
    </ProtectedRoute>
  );
}