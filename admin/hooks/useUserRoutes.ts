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
  userInfo: {
    email: string;
    name: string;
    role: string;
  };
  employeeInfo?: {
    id: string;
    personalData: {
      fullName: string;
      clientCode: string;
    };
  };
  message?: string;
}

export function useUserRoutes() {
  const { data, loading, error, refetch } = useQuery(GET_USER_ROUTES, {
    errorPolicy: 'all'
  });

  const userRoutesData: UserRoutesData | null = data?.getUserRoutes || null;

  return {
    data: userRoutesData,
    routes: userRoutesData?.routes || [],
    isAdmin: userRoutesData?.isAdmin || false,
    userInfo: userRoutesData?.userInfo || null,
    employeeInfo: userRoutesData?.employeeInfo || null,
    loading,
    error,
    refetch
  };
}