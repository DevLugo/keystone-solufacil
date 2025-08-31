import React from 'react';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import ActiveLoansReport from '../components/reports/ActiveLoansReport';

export default function ReporteCobranzaPage() {
  return (
    <PageContainer header="Reportes de Cobranza">
      <ActiveLoansReport />
    </PageContainer>
  );
}
