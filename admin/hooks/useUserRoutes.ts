import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { GET_USER_ACCESSIBLE_ROUTES } from '../graphql/queries/dashboard';

interface Route {
  id: string;
  name: string;
}

interface UserRoutesData {
  isAdmin: boolean;
  routes: Route[];
  accessType: 'ADMIN_ALL_ROUTES' | 'MULTIPLE_ROUTES' | 'SINGLE_ROUTE';
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
}

export function useUserRoutes() {
  const { data, loading, error, refetch } = useQuery(GET_USER_ACCESSIBLE_ROUTES, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  const userRoutesData: UserRoutesData | null = data?.getUserAccessibleRoutes || null;

  return {
    data: userRoutesData,
    routes: userRoutesData?.routes || [],
    isAdmin: userRoutesData?.isAdmin || false,
    hasEmployee: userRoutesData?.hasEmployee || false,
    accessType: userRoutesData?.accessType || 'SINGLE_ROUTE',
    userInfo: userRoutesData?.userInfo || null,
    employeeInfo: userRoutesData?.employeeInfo || null,
    message: userRoutesData?.message,
    hasMultipleRoutes: (userRoutesData?.routes || []).length > 1,
    loading,
    error,
    refetch
  };
}