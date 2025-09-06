import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface BalanceRefreshContextType {
  refreshTrigger: number;
  triggerBalanceRefresh: () => void;
}

const BalanceRefreshContext = createContext<BalanceRefreshContextType | undefined>(undefined);

export const useBalanceRefresh = () => {
  const context = useContext(BalanceRefreshContext);
  if (!context) {
    throw new Error('useBalanceRefresh debe ser usado dentro de BalanceRefreshProvider');
  }
  return context;
};

interface BalanceRefreshProviderProps {
  children: ReactNode;
}

export const BalanceRefreshProvider: React.FC<BalanceRefreshProviderProps> = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerBalanceRefresh = useCallback(() => {
    console.log('🔄 BalanceRefreshContext: Triggeando refresh de balances');
    setRefreshTrigger(prev => {
      const newValue = prev + 1;
      console.log('🔄 BalanceRefreshContext: refreshTrigger actualizado de', prev, 'a', newValue);
      return newValue;
    });
  }, []);

  return (
    <BalanceRefreshContext.Provider value={{ refreshTrigger, triggerBalanceRefresh }}>
      {children}
    </BalanceRefreshContext.Provider>
  );
};
