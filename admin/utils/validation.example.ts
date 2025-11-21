/**
 * Example usage of validation utilities
 * This file demonstrates how to use the validation functions in components
 */

import {
  validateRequired,
  validatePhone,
  validateAmount,
  validateLoanData,
  getFieldError,
  hasFieldError,
  type ValidationError
} from './validation';

// Example 1: Validate individual fields
export function validateClientName(name: string): string | undefined {
  const result = validateRequired(name, 'Nombre del cliente');
  if (!result.isValid) {
    return result.errors[0].message;
  }
  return undefined;
}

// Example 2: Validate phone number
export function validateClientPhone(phone: string): string | undefined {
  const result = validatePhone(phone, 'Teléfono del cliente');
  if (!result.isValid) {
    return result.errors[0].message;
  }
  return undefined;
}

// Example 3: Validate amount
export function validateRequestedAmount(amount: string): string | undefined {
  const result = validateAmount(amount, 'Monto solicitado');
  if (!result.isValid) {
    return result.errors[0].message;
  }
  return undefined;
}

// Example 4: Validate entire loan object
export function validateLoanForSave(loan: any): { isValid: boolean; errors: ValidationError[] } {
  return validateLoanData(loan);
}

// Example 5: Get specific field error from validation results
export function getClientNameError(errors: ValidationError[]): string | undefined {
  return getFieldError(errors, 'Nombre del cliente');
}

// Example 6: Check if field has error
export function shouldHighlightField(errors: ValidationError[], fieldName: string): boolean {
  return hasFieldError(errors, fieldName);
}

// Example 7: Usage in a React component
export function exampleComponentUsage() {
  // In your component state
  const [errors, setErrors] = React.useState<ValidationError[]>([]);
  
  // When validating on save
  const handleSave = (loan: any) => {
    const validation = validateLoanData(loan);
    
    if (!validation.isValid) {
      setErrors(validation.errors);
      // Show error toast or message
      return;
    }
    
    // Proceed with save
    setErrors([]);
  };
  
  // In your JSX to show field errors
  const clientNameError = getFieldError(errors, 'Nombre del cliente');
  const hasClientNameError = hasFieldError(errors, 'Nombre del cliente');
  
  return (
    <div>
      <input
        className={hasClientNameError ? 'error' : ''}
        // ... other props
      />
      {clientNameError && <span className="error-message">{clientNameError}</span>}
    </div>
  );
}
