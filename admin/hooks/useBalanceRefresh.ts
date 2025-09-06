import { useState, useCallback } from 'react';

// Hook personalizado para manejar el refresh de balances
export const useBalanceRefresh = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    console.log('🔄 useBalanceRefresh: Triggeando refresh de balances');
    setRefreshTrigger(prev => {
      const newValue = prev + 1;
      console.log('🔄 useBalanceRefresh: refreshTrigger actualizado de', prev, 'a', newValue);
      return newValue;
    });
  }, []);

  return {
    refreshTrigger,
    triggerRefresh
  };
};
