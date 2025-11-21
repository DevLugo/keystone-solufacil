import {
  validateRequired,
  validatePhone,
  validateAmount,
  validateLoanData,
  combineValidations,
  getFieldError,
  hasFieldError
} from '../validation';

describe('Validation Utilities', () => {
  describe('validateRequired', () => {
    it('should return valid for non-empty string', () => {
      const result = validateRequired('John Doe', 'Name');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for empty string', () => {
      const result = validateRequired('', 'Name');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Name es requerido');
    });

    it('should return invalid for whitespace-only string', () => {
      const result = validateRequired('   ', 'Name');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should return invalid for null', () => {
      const result = validateRequired(null, 'Name');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should return invalid for undefined', () => {
      const result = validateRequired(undefined, 'Name');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('validatePhone', () => {
    it('should return valid for 10-digit phone number', () => {
      const result = validatePhone('5551234567', 'Phone');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid for 10-digit phone with formatting', () => {
      const result = validatePhone('555-123-4567', 'Phone');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for less than 10 digits', () => {
      const result = validatePhone('555123456', 'Phone');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Ingresa un número de teléfono válido (10 dígitos)');
    });

    it('should return invalid for more than 10 digits', () => {
      const result = validatePhone('55512345678', 'Phone');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should return invalid for empty string', () => {
      const result = validatePhone('', 'Phone');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Phone es requerido');
    });

    it('should return invalid for null', () => {
      const result = validatePhone(null, 'Phone');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('validateAmount', () => {
    it('should return valid for positive number', () => {
      const result = validateAmount('1000', 'Amount');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid for decimal number', () => {
      const result = validateAmount('1000.50', 'Amount');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for zero', () => {
      const result = validateAmount('0', 'Amount');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Amount debe ser mayor a 0');
    });

    it('should return invalid for negative number', () => {
      const result = validateAmount('-100', 'Amount');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Amount debe ser mayor a 0');
    });

    it('should return invalid for non-numeric string', () => {
      const result = validateAmount('abc', 'Amount');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Amount debe ser un número válido');
    });

    it('should return invalid for empty string', () => {
      const result = validateAmount('', 'Amount');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Amount es requerido');
    });
  });

  describe('combineValidations', () => {
    it('should return valid when all validations pass', () => {
      const result = combineValidations(
        { isValid: true, errors: [] },
        { isValid: true, errors: [] }
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when any validation fails', () => {
      const result = combineValidations(
        { isValid: true, errors: [] },
        { isValid: false, errors: [{ field: 'test', message: 'error' }] }
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should combine all errors from multiple validations', () => {
      const result = combineValidations(
        { isValid: false, errors: [{ field: 'field1', message: 'error1' }] },
        { isValid: false, errors: [{ field: 'field2', message: 'error2' }] }
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('validateLoanData', () => {
    const validLoan = {
      borrower: {
        personalData: {
          fullName: 'John Doe',
          phones: [{ number: '5551234567' }]
        }
      },
      avalName: 'Jane Smith',
      avalPhone: '5559876543',
      loantype: { id: 'loan-type-1' },
      requestedAmount: '1000'
    };

    it('should return valid for complete loan data', () => {
      const result = validateLoanData(validLoan);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when client name is missing', () => {
      const loan = {
        ...validLoan,
        borrower: {
          personalData: {
            fullName: '',
            phones: [{ number: '5551234567' }]
          }
        }
      };
      const result = validateLoanData(loan);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'Nombre del cliente')).toBe(true);
    });

    it('should return invalid when client phone is invalid', () => {
      const loan = {
        ...validLoan,
        borrower: {
          personalData: {
            fullName: 'John Doe',
            phones: [{ number: '123' }]
          }
        }
      };
      const result = validateLoanData(loan);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'Teléfono del cliente')).toBe(true);
    });

    it('should return invalid when aval name is missing', () => {
      const loan = {
        ...validLoan,
        avalName: ''
      };
      const result = validateLoanData(loan);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'Nombre del aval')).toBe(true);
    });

    it('should return invalid when aval phone is invalid', () => {
      const loan = {
        ...validLoan,
        avalPhone: '123'
      };
      const result = validateLoanData(loan);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'Teléfono del aval')).toBe(true);
    });

    it('should return invalid when loan type is missing', () => {
      const loan = {
        ...validLoan,
        loantype: undefined
      };
      const result = validateLoanData(loan);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'Tipo de préstamo')).toBe(true);
    });

    it('should return invalid when requested amount is zero', () => {
      const loan = {
        ...validLoan,
        requestedAmount: '0'
      };
      const result = validateLoanData(loan);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'Monto solicitado')).toBe(true);
    });

    it('should return multiple errors for multiple invalid fields', () => {
      const loan = {
        borrower: {
          personalData: {
            fullName: '',
            phones: [{ number: '' }]
          }
        },
        avalName: '',
        avalPhone: '',
        loantype: undefined,
        requestedAmount: '0'
      };
      const result = validateLoanData(loan);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('getFieldError', () => {
    const errors = [
      { field: 'Name', message: 'Name is required' },
      { field: 'Phone', message: 'Phone is invalid' }
    ];

    it('should return error message for existing field', () => {
      const message = getFieldError(errors, 'Name');
      expect(message).toBe('Name is required');
    });

    it('should return undefined for non-existing field', () => {
      const message = getFieldError(errors, 'Email');
      expect(message).toBeUndefined();
    });
  });

  describe('hasFieldError', () => {
    const errors = [
      { field: 'Name', message: 'Name is required' },
      { field: 'Phone', message: 'Phone is invalid' }
    ];

    it('should return true for field with error', () => {
      const hasError = hasFieldError(errors, 'Name');
      expect(hasError).toBe(true);
    });

    it('should return false for field without error', () => {
      const hasError = hasFieldError(errors, 'Email');
      expect(hasError).toBe(false);
    });
  });
});
