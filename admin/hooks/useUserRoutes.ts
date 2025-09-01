import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { GET_USER_ROUTES } from '../graphql/queries/dashboard';

interface Route {
  id: string;
  name: string;
}

interface UserRoutesData {
  isAdmin: boolean;
  routes: Route[];
  accessType?: 'ADMIN_ALL_ROUTES' | 'MULTIPLE_ROUTES' | 'SINGLE_ROUTE';
  userInfo: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  hasEmployee: boolean;
  employeeInfo?: {
    id: string;
    routesId?: string;
    type?: string;
    personalData?: {
      fullName: string;
      clientCode: string;
    };
  };
  message?: string;
  method?: string;
  warning?: string;
}

export function useUserRoutes() {
  const { data, loading, error, refetch } = useQuery(GET_USER_ROUTES, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  const userRoutesData: UserRoutesData | null = data?.getUserRoutes || null;

  return {
    data: userRoutesData,
    routes: userRoutesData?.routes || [],
    isAdmin: userRoutesData?.isAdmin || false,
    hasEmployee: userRoutesData?.hasEmployee || false,
    accessType: userRoutesData?.accessType || 'SINGLE_ROUTE',
    userInfo: userRoutesData?.userInfo || null,
    employeeInfo: userRoutesData?.employeeInfo || null,
    message: userRoutesData?.message,
    method: userRoutesData?.method,
    warning: userRoutesData?.warning,
    hasMultipleRoutes: (userRoutesData?.routes || []).length > 1,
    loading,
    error,
    refetch
  };
}