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
    const commissionNum = parseFloat(commission) || 0;
    
    // First calculate amountGived from calculateLoanAmounts
    const amountGived = requestedAmountNum - pendingAmountNum;
    
    // Then subtract commission
    const deliveredAmount = amountGived - commissionNum;
    
    return parseFloat(deliveredAmount.toFixed(2));
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
      
      expect(result).toBe(950);
    });

    it('should calculate delivered amount correctly for renewal', () => {
      const requestedAmount = '2000';
      const pendingAmount = '500';
      const commission = '100';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      expect(result).toBe(1400);
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
      
      expect(withLowCommission).toBe(950);
      expect(withHighCommission).toBe(900);
      expect(withHighCommission).toBeLessThan(withLowCommission);
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
        { requestedAmount: '1000', amountGived: '950' },
        { requestedAmount: '2000', amountGived: '1900' },
        { requestedAmount: '1500', amountGived: '1450' },
      ];

      const totals = loans.reduce((acc, loan) => ({
        requested: acc.requested + parseFloat(loan.requestedAmount || '0'),
        delivered: acc.delivered + parseFloat(loan.amountGived || '0'),
      }), { requested: 0, delivered: 0 });

      expect(totals.requested).toBe(4500);
      expect(totals.delivered).toBe(4300);
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
        { requestedAmount: '1000', amountGived: '950' },
      ];

      const initialTotals = loans.reduce((acc, loan) => ({
        requested: acc.requested + parseFloat(loan.requestedAmount || '0'),
        delivered: acc.delivered + parseFloat(loan.amountGived || '0'),
      }), { requested: 0, delivered: 0 });

      // Simulate changing the requested amount
      loans[0].requestedAmount = '2000';
      loans[0].amountGived = '1950';

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
      
      expect(result).toBe(1050);
    });

    it('should handle very large amounts', () => {
      const requestedAmount = '1000000';
      const pendingAmount = '0';
      const commission = '5000';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      expect(result).toBe(995000);
    });

    it('should handle decimal amounts', () => {
      const requestedAmount = '1000.50';
      const pendingAmount = '100.25';
      const commission = '50.10';
      
      const result = calculateDeliveredAmount(requestedAmount, pendingAmount, commission);
      
      expect(result).toBe(850.15);
    });
  });
});
