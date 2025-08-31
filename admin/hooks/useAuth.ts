import { useState, useEffect } from 'react';

interface User {
  id: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query GetCurrentUser {
                users {
                  id
                  role
                }
              }
            `
          })
        });

        const result = await response.json();
        if (result.data?.users?.[0]) {
          setUser(result.data.users[0]);
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
