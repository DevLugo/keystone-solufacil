/**
 * Validation utilities for form inputs
 * Provides structured validation for credit forms
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates that a field is not empty
 * @param value - The value to validate
 * @param fieldName - The name of the field for error messages
 * @returns ValidationResult with error if field is empty
 */
export const validateRequired = (value: string | undefined | null, fieldName: string): ValidationResult => {
  const trimmedValue = (value || '').trim();
  
  if (!trimmedValue) {
    return {
      isValid: false,
      errors: [{
        field: fieldName,
        message: `${fieldName} es requerido`
      }]
    };
  }
  
  return {
    isValid: true,
    errors: []
  };
};

/**
 * Validates phone number format (10 digits)
 * @param phone - The phone number to validate
 * @param fieldName - The name of the field for error messages
 * @returns ValidationResult with error if phone is invalid
 */
export const validatePhone = (phone: string | undefined | null, fieldName: string = 'Teléfono'): ValidationResult => {
  const trimmedPhone = (phone || '').trim();
  
  // Check if empty
  if (!trimmedPhone) {
    return {
      isValid: false,
      errors: [{
        field: fieldName,
        message: `${fieldName} es requerido`
      }]
    };
  }
  
  // Remove any non-digit characters for validation
  const digitsOnly = trimmedPhone.replace(/\D/g, '');
  
  // Check if exactly 10 digits
  if (digitsOnly.length !== 10) {
    return {
      isValid: false,
      errors: [{
        field: fieldName,
        message: 'Ingresa un número de teléfono válido (10 dígitos)'
      }]
    };
  }
  
  return {
    isValid: true,
    errors: []
  };
};

/**
 * Validates that an amount is positive
 * @param amount - The amount to validate (as string)
 * @param fieldName - The name of the field for error messages
 * @returns ValidationResult with error if amount is invalid
 */
export const validateAmount = (amount: string | undefined | null, fieldName: string = 'Monto'): ValidationResult => {
  const trimmedAmount = (amount || '').trim();
  
  // Check if empty
  if (!trimmedAmount) {
    return {
      isValid: false,
      errors: [{
        field: fieldName,
        message: `${fieldName} es requerido`
      }]
    };
  }
  
  // Parse as number
  const numericAmount = parseFloat(trimmedAmount);
  
  // Check if valid number
  if (isNaN(numericAmount)) {
    return {
      isValid: false,
      errors: [{
        field: fieldName,
        message: `${fieldName} debe ser un número válido`
      }]
    };
  }
  
  // Check if positive
  if (numericAmount <= 0) {
    return {
      isValid: false,
      errors: [{
        field: fieldName,
        message: `${fieldName} debe ser mayor a 0`
      }]
    };
  }
  
  return {
    isValid: true,
    errors: []
  };
};

/**
 * Validates multiple fields and returns combined results
 * @param validations - Array of validation results
 * @returns Combined ValidationResult
 */
export const combineValidations = (...validations: ValidationResult[]): ValidationResult => {
  const allErrors = validations.flatMap(v => v.errors);
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
};

/**
 * Validates a loan object for credit creation
 * @param loan - The loan object to validate
 * @returns ValidationResult with all validation errors
 */
export const validateLoanData = (loan: {
  borrower?: {
    personalData?: {
      fullName?: string;
      phones?: Array<{ number?: string }>;
    };
  };
  avalName?: string;
  avalPhone?: string;
  loantype?: { id?: string };
  requestedAmount?: string;
}): ValidationResult => {
  const validations: ValidationResult[] = [];
  
  // Validate client name
  validations.push(
    validateRequired(
      loan.borrower?.personalData?.fullName,
      'Nombre del cliente'
    )
  );
  
  // Validate client phone
  validations.push(
    validatePhone(
      loan.borrower?.personalData?.phones?.[0]?.number,
      'Teléfono del cliente'
    )
  );
  
  // Validate aval name
  validations.push(
    validateRequired(
      loan.avalName,
      'Nombre del aval'
    )
  );
  
  // Validate aval phone
  validations.push(
    validatePhone(
      loan.avalPhone,
      'Teléfono del aval'
    )
  );
  
  // Validate loan type
  validations.push(
    validateRequired(
      loan.loantype?.id,
      'Tipo de préstamo'
    )
  );
  
  // Validate requested amount
  validations.push(
    validateAmount(
      loan.requestedAmount,
      'Monto solicitado'
    )
  );
  
  return combineValidations(...validations);
};

/**
 * Gets a user-friendly error message for a specific field
 * @param errors - Array of validation errors
 * @param fieldName - The field to get error for
 * @returns Error message or undefined if no error
 */
export const getFieldError = (errors: ValidationError[], fieldName: string): string | undefined => {
  const error = errors.find(e => e.field === fieldName);
  return error?.message;
};

/**
 * Checks if a specific field has an error
 * @param errors - Array of validation errors
 * @param fieldName - The field to check
 * @returns True if field has error
 */
export const hasFieldError = (errors: ValidationError[], fieldName: string): boolean => {
  return errors.some(e => e.field === fieldName);
};
