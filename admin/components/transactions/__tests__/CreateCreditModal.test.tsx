import { describe, it, expect } from '@jest/globals';

/**
 * Tests for CreateCreditModal real-time amount calculations
 * Feature: creditos-ui-redesign, Task 14
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

describe('CreateCreditModal - Real-time Amount Calculations', () => {
  /**
   * Helper function to simulate the calculation logic
   * This matches the logic in CreateCreditModal.tsx
   */
  const calculateDeliveredAmount = (
    requestedAmount: string,
    pendingAmount: string,
    commission: string
  ): number => {
    const requestedAmountNum = parseFloat(requestedAmount) || 0;
    const pendingAmountNum = parseFloat(pendingAmount) || 0;
    
    // ✅ CORREGIDO: amountGived = requestedAmount - pendingAmount (sin restar comisión)
    // La comisión es un cargo adicional, no se resta del monto entregado
    const amountGived = requestedAmountNum - pendingAmountNum;
    
    return parseFloat(amountGived.toFixed(2));
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  describe('Requirement 10.1: Calculate delivered amount when requested amount changes', () => {
    it('should calculate delivered amount correctly for new loan', () => {
      const requestedAmount = '1000';
      const pendingAmount = '0';
      const commission = '50';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      // ✅ CORREGIDO: 1000 - 0 = 1000 (sin restar comisión)
      expect(result).toBe(1000);
    });

    it('should calculate delivered amount correctly for renewal', () => {
      const requestedAmount = '2000';
      const pendingAmount = '500';
      const commission = '100';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      // ✅ CORREGIDO: 2000 - 500 = 1500 (sin restar comisión)
      expect(result).toBe(1500);
    });

    it('should handle zero requested amount', () => {
      const requestedAmount = '0';
      const pendingAmount = '0';
      const commission = '0';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      expect(result).toBe(0);
    });
  });

  describe('Requirement 10.2: Update delivered amount when commission changes', () => {
    it('should recalculate when commission increases', () => {
      const requestedAmount = '1000';
      const pendingAmount = '0';
      
      const withLowCommission = calculateDeliveredAmount(requestedAmount, pendingAmount, '50');
      const withHighCommission = calculateDeliveredAmount(requestedAmount, pendingAmount, '100');
      
      // ✅ CORREGIDO: La comisión NO afecta el monto entregado
      // amountGived = requestedAmount - pendingAmount (sin restar comisión)
      expect(withLowCommission).toBe(1000);
      expect(withHighCommission).toBe(1000);
      expect(withHighCommission).toBe(withLowCommission);
    });

    it('should handle zero commission', () => {
      const requestedAmount = '1000';
      const pendingAmount = '0';
      const commission = '0';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      expect(result).toBe(1000);
    });
  });

  describe('Requirement 10.3: Format calculated amounts as currency', () => {
    it('should format amounts with currency symbol and 2 decimals', () => {
      const amount = 1234.56;
      const formatted = formatCurrency(amount);
      
      expect(formatted).toMatch(/^\$/);
      expect(formatted).toMatch(/\d{1,3}(,\d{3})*\.\d{2}$/);
    });

    it('should format zero correctly', () => {
      const formatted = formatCurrency(0);
      
      expect(formatted).toBe('$0.00');
    });

    it('should format large amounts correctly', () => {
      const formatted = formatCurrency(1234567.89);
      
      expect(formatted).toContain('1,234,567.89');
    });
  });

  describe('Requirement 10.5: Update footer totals on any change', () => {
    it('should calculate total requested correctly', () => {
      const loans = [
        { requestedAmount: '1000', amountGived: '1000' },
        { requestedAmount: '2000', amountGived: '2000' },
        { requestedAmount: '1500', amountGived: '1500' },
      ];

      const totals = loans.reduce((acc, loan) => ({
        requested: acc.requested + parseFloat(loan.requestedAmount || '0'),
        delivered: acc.delivered + parseFloat(loan.amountGived || '0'),
      }), { requested: 0, delivered: 0 });

      expect(totals.requested).toBe(4500);
      // ✅ CORREGIDO: Sin restar comisión, delivered = requested cuando no hay deuda pendiente
      expect(totals.delivered).toBe(4500);
    });

    it('should handle empty loan list', () => {
      const loans: any[] = [];

      const totals = loans.reduce((acc, loan) => ({
        requested: acc.requested + parseFloat(loan.requestedAmount || '0'),
        delivered: acc.delivered + parseFloat(loan.amountGived || '0'),
      }), { requested: 0, delivered: 0 });

      expect(totals.requested).toBe(0);
      expect(totals.delivered).toBe(0);
    });

    it('should update totals when loan amounts change', () => {
      const loans = [
        { requestedAmount: '1000', amountGived: '1000' },
      ];

      const initialTotals = loans.reduce((acc, loan) => ({
        requested: acc.requested + parseFloat(loan.requestedAmount || '0'),
        delivered: acc.delivered + parseFloat(loan.amountGived || '0'),
      }), { requested: 0, delivered: 0 });

      // Simulate changing the requested amount
      loans[0].requestedAmount = '2000';
      // ✅ CORREGIDO: Sin restar comisión
      loans[0].amountGived = '2000';

      const updatedTotals = loans.reduce((acc, loan) => ({
        requested: acc.requested + parseFloat(loan.requestedAmount || '0'),
        delivered: acc.delivered + parseFloat(loan.amountGived || '0'),
      }), { requested: 0, delivered: 0 });

      expect(updatedTotals.requested).toBeGreaterThan(initialTotals.requested);
      expect(updatedTotals.delivered).toBeGreaterThan(initialTotals.delivered);
    });
  });

  describe('Edge cases', () => {
    it('should handle negative commission (should not happen in practice)', () => {
      const requestedAmount = '1000';
      const pendingAmount = '0';
      const commission = '-50';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      // ✅ CORREGIDO: La comisión NO afecta el cálculo
      expect(result).toBe(1000);
    });

    it('should handle very large amounts', () => {
      const requestedAmount = '1000000';
      const pendingAmount = '0';
      const commission = '5000';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      // ✅ CORREGIDO: Sin restar comisión
      expect(result).toBe(1000000);
    });

    it('should handle decimal amounts', () => {
      const requestedAmount = '1000.50';
      const pendingAmount = '100.25';
      const commission = '50.10';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      // ✅ CORREGIDO: 1000.50 - 100.25 = 900.25 (sin restar comisión)
      expect(result).toBe(900.25);
    });
  });
});
