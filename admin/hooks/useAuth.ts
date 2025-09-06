import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Usar la API de Keystone para obtener el usuario actual de la sesión
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query GetCurrentUser {
                authenticatedItem {
                  ... on User {
                    id
                    name
                    role
                    createdAt
                  }
                }
              }
            `
          })
        });

        const result = await response.json();
        if (result.data?.authenticatedItem) {
          setUser(result.data.authenticatedItem);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user:', error);
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const isAdmin = user?.role === 'ADMIN';
  const isAuthenticated = !!user;

  return { user, loading, isAdmin, isAuthenticated };
}
