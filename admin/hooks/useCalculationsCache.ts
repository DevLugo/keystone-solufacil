import { useMemo, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache en memoria para cálculos costosos
const calculationsCache = new Map<string, CacheEntry<any>>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export function useCalculationsCache() {
  // Limpiar cache expirado
  const cleanExpiredCache = useCallback(() => {
    const now = Date.now();
    for (const [key, entry] of calculationsCache.entries()) {
      if (now - entry.timestamp > CACHE_DURATION) {
        calculationsCache.delete(key);
      }
    }
  }, []);

  // Obtener valor del cache o calcular
  const getCachedValue = useCallback(<T>(
    key: string, 
    calculator: () => T
  ): T => {
    cleanExpiredCache();
    
    const cached = calculationsCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data as T;
    }

    const result = calculator();
    calculationsCache.set(key, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }, [cleanExpiredCache]);

  // Invalidar cache específico
  const invalidateCache = useCallback((pattern?: string) => {
    if (pattern) {
      for (const key of calculationsCache.keys()) {
        if (key.includes(pattern)) {
          calculationsCache.delete(key);
        }
      }
    } else {
      calculationsCache.clear();
    }
  }, []);

  return {
    getCachedValue,
    invalidateCache
  };
}

// Hook específico para cálculos de préstamos
export function useLoanCalculations() {
  const { getCachedValue, invalidateCache } = useCalculationsCache();

  const calculatePendingAmount = useCallback((
    loan: any
  ): number => {
    const cacheKey = `pending_${loan.id}_${loan.updatedAt}`;
    
    return getCachedValue(cacheKey, () => {
      if (!loan?.loantype?.rate || !loan?.requestedAmount) return 0;

      const rate = parseFloat(loan.loantype.rate);
      const requestedAmount = parseFloat(loan.requestedAmount);
      const totalAmountToPay = requestedAmount * (1 + rate);

      const payedAmount = loan.payments?.reduce((sum: number, payment: any) => {
        return sum + parseFloat(payment.amount || '0');
      }, 0) || 0;

      return Math.max(0, totalAmountToPay - payedAmount);
    });
  }, [getCachedValue]);

  const calculateWeeklyPayment = useCallback((
    loan: any
  ): number => {
    const cacheKey = `weekly_${loan.id}_${loan.loantype?.id}`;
    
    return getCachedValue(cacheKey, () => {
      if (!loan?.loantype?.rate || !loan?.loantype?.weekDuration) return 0;

      const rate = parseFloat(loan.loantype.rate);
      const requestedAmount = parseFloat(loan.requestedAmount);
      const weekDuration = parseInt(loan.loantype.weekDuration);

      if (weekDuration === 0) return 0;

      const totalAmountToPay = requestedAmount * (1 + rate);
      return totalAmountToPay / weekDuration;
    });
  }, [getCachedValue]);

  return {
    calculatePendingAmount,
    calculateWeeklyPayment,
    invalidateCache
  };
}

// Hook para cálculos de transacciones
export function useTransactionCalculations() {
  const { getCachedValue, invalidateCache } = useCalculationsCache();

  const calculateTotalsByType = useCallback((
    transactions: any[]
  ) => {
    const cacheKey = `trans_totals_${transactions.length}_${transactions[0]?.id}`;
    
    return getCachedValue(cacheKey, () => {
      return transactions.reduce((acc, transaction) => {
        const amount = parseFloat(transaction.amount || '0');
        const type = transaction.type;
        
        if (!acc[type]) {
          acc[type] = 0;
        }
        
        acc[type] += amount;
        return acc;
      }, {} as Record<string, number>);
    });
  }, [getCachedValue]);

  return {
    calculateTotalsByType,
    invalidateCache
  };
}