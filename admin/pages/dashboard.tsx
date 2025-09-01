/** @jsxRuntime classic */
/** @jsx jsx */

import React from 'react';
import { jsx } from '@keystone-ui/core';
import CollectorDashboard from '../components/dashboard/CollectorDashboard';
import ProtectedRoute from '../components/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <CollectorDashboard />
    </ProtectedRoute>
  );
}
