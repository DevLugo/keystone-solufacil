# Design Document

## Overview

This design document outlines the UI redesign of the CreditosTabNew component to match the provided mockups pixel-perfectly. The redesign focuses on modernizing the interface with a clean, professional look inspired by contemporary design systems (Vercel, Linear, Stripe), implementing proper validation feedback, and adding toast notifications for user actions.

## Architecture

### Component Structure

The redesigned system maintains the existing component hierarchy but with updated UI implementations:

```
CreditosTabNew (Main Container)
├── KPI Bar (Metrics Display)
├── Credits List Table
├── CreateCreditModal (Bulk Creation)
│   ├── Modal Header
│   ├── Credit Entry Cards (Multiple)
│   │   ├── Client Autocomplete
│   │   ├── Aval Autocomplete  
│   │   └── Loan Details Form
│   └── Modal Footer (Totals + Actions)
└── Toast Notification System
```

### Design System Tokens

```css
/* Colors */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-500: #6b7280;
--gray-700: #374151;
--gray-900: #111827;

--blue-50: #eff6ff;
--blue-600: #2563eb;

--green-50: #f0fdf4;
--green-600: #16a34a;

--red-50: #fef2f2;
--red-600: #dc2626;

--emerald-600: #059669;

/* Typography */
--font-size-xs: 10px;
--font-size-sm: 11px;
--font-size-base: 13px;
--font-size-lg: 15px;
--font-size-xl: 20px;

--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Spacing */
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-5: 20px;
--spacing-6: 24px;

/* Border Radius */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 12px;

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

## Components and Interfaces

### 1. Credits List Table

**Visual Specifications:**
- Background: White (#FFFFFF)
- Border radius: 8px
- Box shadow: 0 1px 3px rgba(0, 0, 0, 0.05)
- Padding: 12px
- Font size: 13px (body), 11px (cells)

**Table Structure:**
```typescript
interface CreditsTableProps {
  loans: Loan[];
  onEdit: (loanId: string) => void;
  onDelete: (loanId: string) => void;
  onRegisterPayment: (loanId: string) => void;
}
```

**Column Specifications:**
- Min width per column: 80px
- Cell padding: 8px 12px
- Header font weight: 600
- Header color: #374151
- Cell color: #6b7280

### 2. CreateCreditModal

**Modal Specifications:**
- Overlay: rgba(0, 0, 0, 0.5)
- Container max-width: 1200px (5xl)
- Container max-height: 90vh
- Border radius: 12px
- Box shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1)

**Header:**
- Padding: 24px
- Border bottom: 1px solid #e5e7eb
- Title font size: 20px
- Title font weight: 600
- Subtitle font size: 14px
- Subtitle color: #6b7280

**Content Area:**
- Padding: 24px
- Overflow: auto
- Gap between cards: 24px

**Credit Entry Card:**
```css
.creditCard {
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f9fafb;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.creditCard:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}
```

**Card Header:**
- Display: flex
- Justify: space-between
- Margin bottom: 16px
- Title font size: 14px
- Title font weight: 500
- Title color: #374151

**Delete Button:**
- Size: 24px × 24px
- Padding: 6px
- Border radius: 6px
- Background (hover): #fef2f2
- Color: #dc2626
- Icon size: 16px

**Footer:**
- Padding: 24px
- Border top: 1px solid #e5e7eb
- Background: #f9fafb

**Totals Display:**
```css
.totalItem {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.totalLabel {
  font-size: 12px;
  color: #6b7280;
  font-weight: 400;
}

.totalValue {
  font-size: 24px;
  font-weight: 600;
}

.totalValue.requested {
  color: #111827;
}

.totalValue.delivered {
  color: #059669;
}
```

### 3. Autocomplete Component

**Container Specifications:**
```css
.autocompleteContainer {
  position: relative;
  width: 100%;
}

.autocompleteInput {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.autocompleteInput:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

**Dropdown Specifications:**
```css
.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  padding: 4px;
  z-index: 50;
}

.dropdownItem {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dropdownItem:hover {
  background: #f9fafb;
  transform: translateX(2px);
}

.dropdownItemContent {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.dropdownItemName {
  font-size: 12px;
  font-weight: 400;
  color: #111827;
}

.dropdownItemPhone {
  font-size: 10px;
  color: #6b7280;
}

.dropdownItemBadges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.badge {
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 400;
  white-space: nowrap;
}

.badgeDebt {
  background: #fecaca;
  color: #7f1d1d;
}

.badgeNoDebt {
  background: #bbf7d0;
  color: #14532d;
}

.badgeLocation {
  background: #bfdbfe;
  color: #1e3a8a;
}
```

**Scrollbar Styling:**
```css
.dropdown::-webkit-scrollbar {
  width: 5px;
}

.dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.dropdown::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
```

**New Client State (Blue Design):**

When a user types a name that doesn't match any existing clients in the autocomplete, the input should display a distinct blue state to indicate that a new client is being created.

```css
.autocompleteInput.newClient {
  border: 1px solid #3B82F6;
  background: #EFF6FF;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.autocompleteInput.newClient:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
```

**State Detection Logic:**
- **New Client State**: Triggered when user has typed at least 2 characters AND no autocomplete results match
- **Visual Indicator**: Blue border (#3B82F6) and light blue background (#EFF6FF)
- **Applies to**: Both name and phone input fields when in new client creation mode
- **Transition**: Smooth 150ms transition when switching between states

**State Priority:**
1. **Selected** (Green): Client selected from autocomplete
2. **Edited** (Yellow): Existing client data modified
3. **New Client** (Blue): Creating new client (no autocomplete match)
4. **Renewed** (Blue): Renewing existing loan
5. **Default** (Gray): Empty or focused without data

**Color Specifications from blue_design.png:**
- Border color: `#3B82F6` (blue-600)
- Background color: `#EFF6FF` (blue-50)
- Focus ring: `rgba(37, 99, 235, 0.15)` (blue-600 with 15% opacity)

### 4. Form Inputs

**Input Field Specifications:**
```css
.fieldInput {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  color: #111827;
  background: white;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.fieldInput:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.fieldInput:disabled {
  background: #f3f4f6;
  color: #6b7280;
  cursor: not-allowed;
}

.fieldInput.error {
  border-color: #dc2626;
}

.fieldInput.error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}
```

**Label Specifications:**
```css
.fieldLabel {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.fieldLabel.required::after {
  content: ' *';
  color: #dc2626;
}
```

**Error Message:**
```css
.fieldError {
  margin-top: 4px;
  font-size: 12px;
  color: #dc2626;
}
```

### 5. Buttons

**Primary Button:**
```css
.buttonPrimary {
  padding: 11px 20px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.buttonPrimary:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.buttonPrimary:active {
  transform: translateY(0);
}

.buttonPrimary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}
```

**Secondary Button:**
```css
.buttonSecondary {
  padding: 11px 20px;
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.buttonSecondary:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}
```

**Ghost Button (Add Another):**
```css
.buttonGhost {
  width: 100%;
  padding: 12px;
  background: transparent;
  color: #6b7280;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.buttonGhost:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #374151;
}
```

### 6. Toast Notification System

**Toast Container:**
```css
.toastContainer {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}
```

**Toast Specifications:**
```css
.toast {
  min-width: 300px;
  max-width: 500px;
  padding: 16px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  animation: slideIn 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast.success {
  border-left: 4px solid #16a34a;
}

.toast.error {
  border-left: 4px solid #dc2626;
}

.toast.warning {
  border-left: 4px solid #f59e0b;
}

.toast.info {
  border-left: 4px solid #2563eb;
}

.toastIcon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.toastContent {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toastTitle {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.toastMessage {
  font-size: 13px;
  color: #6b7280;
}

.toastClose {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toastClose:hover {
  color: #6b7280;
}
```

**Toast Interface:**
```typescript
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number; // Default: 4000ms
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (type: Toast['type'], message: string, title?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}
```

## Data Models

### Extended Loan for Credits

```typescript
interface ExtendedLoanForCredits {
  id: string;
  requestedAmount: string;
  amountGived: string;
  amountToPay: string;
  pendingAmount: string;
  signDate: string;
  comissionAmount: string;
  avalName: string;
  avalPhone: string;
  selectedCollateralId?: string;
  selectedCollateralPhoneId?: string;
  avalAction: 'create' | 'update' | 'connect' | 'clear';
  collaterals: Collateral[];
  loantype?: LoanType;
  borrower: {
    id: string;
    personalData: {
      id: string;
      fullName: string;
      phones: Array<{
        id: string;
        number: string;
      }>;
    };
  };
  previousLoan?: Loan;
  previousLoanOption?: PreviousLoanOption | null;
  totalDebtAcquired?: string;
}
```

### Validation State

```typescript
interface ValidationState {
  [loanId: string]: {
    clientName: {
      isValid: boolean;
      error?: string;
    };
    clientPhone: {
      isValid: boolean;
      error?: string;
    };
    avalName: {
      isValid: boolean;
      error?: string;
    };
    avalPhone: {
      isValid: boolean;
      error?: string;
    };
    loanType: {
      isValid: boolean;
      error?: string;
    };
    requestedAmount: {
      isValid: boolean;
      error?: string;
    };
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Currency formatting consistency
*For any* monetary value displayed in the system, the formatted output should include the currency symbol ($ or MXN) and exactly 2 decimal places
**Validates: Requirements 1.4**

### Property 2: Toast on successful credit addition
*For any* successful credit addition operation, a success toast notification should be displayed containing the count of credits added
**Validates: Requirements 4.1**

### Property 3: Toast on credit deletion
*For any* credit deletion operation, a success toast notification should be displayed confirming the deletion
**Validates: Requirements 4.2**

### Property 4: Error toast on creation failure
*For any* error that occurs during credit creation, an error toast notification should be displayed with a descriptive message
**Validates: Requirements 4.3**

### Property 5: Error toast on deletion failure
*For any* error that occurs during credit deletion, an error toast notification should be displayed with a descriptive message
**Validates: Requirements 4.4**

### Property 6: Toast auto-dismiss behavior
*For any* toast notification displayed, it should auto-dismiss after 4000ms and be manually dismissible before that time
**Validates: Requirements 4.5**

### Property 7: Required field validation
*For any* save attempt with empty required fields, the system should highlight those fields with red borders and display error messages
**Validates: Requirements 5.1**

### Property 8: Phone number validation
*For any* invalid phone number entered, a validation error should be displayed below the phone input field
**Validates: Requirements 5.2**

### Property 9: Amount validation
*For any* monetary amount that is zero or negative, the system should prevent saving and display a validation error
**Validates: Requirements 5.3**

### Property 10: Valid form enables save
*For any* form where all required fields are valid, the save button should be enabled and all error indicators should be removed
**Validates: Requirements 5.4**

### Property 11: Validation summary display
*For any* form with validation errors, a summary message should be displayed indicating the number of incomplete entries
**Validates: Requirements 5.5**

### Property 12: Loading indicator on search
*For any* autocomplete search in progress, a loading indicator should be displayed
**Validates: Requirements 6.1**

### Property 13: Loading indicator removal
*For any* completed autocomplete search, the loading indicator should be removed
**Validates: Requirements 6.4**

### Property 14: Clear autocomplete resets field
*For any* autocomplete clear action, the field should be reset and any selected values should be removed
**Validates: Requirements 6.5**

### Property 15: Add credit entry increases count
*For any* "add another credit" button click, a new empty credit entry should be added to the list
**Validates: Requirements 7.3**

### Property 16: Scroll to new entry
*For any* new credit entry added, the view should scroll to show the new entry card
**Validates: Requirements 7.4**

### Property 17: Delete confirmation dialog
*For any* delete button click on a credit entry, a confirmation dialog should be displayed before deletion
**Validates: Requirements 8.1**

### Property 18: Confirmation dialog content
*For any* delete confirmation dialog, it should display the client name and amount being deleted
**Validates: Requirements 8.2**

### Property 19: Confirmed deletion removes entry
*For any* confirmed deletion, the credit entry should be removed and a success toast should be displayed
**Validates: Requirements 8.3**

### Property 20: Cancelled deletion preserves entry
*For any* cancelled deletion, the dialog should close and the credit entry should remain unchanged
**Validates: Requirements 8.4**

### Property 21: Minimum entry count enforcement
*For any* credit entry list with only one entry, the delete button should be disabled
**Validates: Requirements 8.5**

### Property 22: Real-time delivered amount calculation
*For any* requested amount entered, the delivered amount should be immediately calculated and displayed
**Validates: Requirements 10.1**

### Property 23: Commission updates delivered amount
*For any* commission amount entered, the delivered amount calculation should be immediately updated
**Validates: Requirements 10.2**

### Property 24: Delivered amount formatting
*For any* calculated delivered amount, it should be formatted as currency with proper decimal places
**Validates: Requirements 10.3**

### Property 25: Footer total updates on change
*For any* change to amount or commission fields, the total delivered amount in the footer should be updated
**Validates: Requirements 10.5**

## Error Handling

### Validation Errors

**Client-side Validation:**
1. Required field validation (name, phone, loan type, amount)
2. Phone number format validation (10 digits, numeric)
3. Amount validation (positive numbers only)
4. Duplicate client detection (name + phone combination)

**Error Display Strategy:**
- Inline errors: Show below the field with red text
- Field highlighting: Red border on invalid fields
- Summary errors: Display at top of modal with count
- Toast notifications: For system-level errors

**Error Messages:**
```typescript
const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'Este campo es requerido',
  INVALID_PHONE: 'Ingresa un número de teléfono válido (10 dígitos)',
  INVALID_AMOUNT: 'El monto debe ser mayor a 0',
  DUPLICATE_CLIENT: 'Este cliente ya existe. Usa la opción de renovación',
  SAVE_FAILED: 'Error al guardar los créditos. Intenta de nuevo',
  DELETE_FAILED: 'Error al eliminar el crédito. Intenta de nuevo',
  NETWORK_ERROR: 'Error de conexión. Verifica tu internet',
};
```

### GraphQL Error Handling

```typescript
const handleGraphQLError = (error: ApolloError): string => {
  if (error.networkError) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  if (error.graphQLErrors.length > 0) {
    const firstError = error.graphQLErrors[0];
    return firstError.message || ERROR_MESSAGES.SAVE_FAILED;
  }
  
  return ERROR_MESSAGES.SAVE_FAILED;
};
```

### Toast Notification Triggers

**Success Toasts:**
- Credit(s) saved successfully: "X crédito(s) guardado(s) exitosamente"
- Credit deleted: "Crédito eliminado exitosamente"
- New credit entry added: "Nuevo crédito agregado"

**Error Toasts:**
- Save failure: "Error al guardar los créditos"
- Delete failure: "Error al eliminar el crédito"
- Validation failure: "Completa todos los campos requeridos"

**Warning Toasts:**
- Minimum entry count: "Debe haber al menos un crédito"
- No valid credits: "No hay créditos válidos para guardar"

**Info Toasts:**
- Loading state: "Buscando clientes..."
- No results: "No se encontraron resultados"

## Testing Strategy

### Unit Tests

**Component Tests:**
1. CreditosTabNew rendering
2. CreateCreditModal open/close behavior
3. Autocomplete dropdown display
4. Form input validation
5. Button state management
6. Toast notification display

**Utility Function Tests:**
1. Currency formatting
2. Amount calculations
3. Phone number validation
4. Form validation logic

**Example Unit Tests:**
```typescript
describe('Currency Formatting', () => {
  it('should format numbers with currency symbol and 2 decimals', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('Amount Calculation', () => {
  it('should calculate delivered amount correctly', () => {
    const result = calculateDeliveredAmount('1000', '50');
    expect(result).toBe(950);
  });
  
  it('should handle zero commission', () => {
    const result = calculateDeliveredAmount('1000', '0');
    expect(result).toBe(1000);
  });
});

describe('Phone Validation', () => {
  it('should validate 10-digit phone numbers', () => {
    expect(validatePhone('5551234567')).toBe(true);
    expect(validatePhone('555123456')).toBe(false);
    expect(validatePhone('abc1234567')).toBe(false);
  });
});
```

### Property-Based Tests

**Testing Framework:** fast-check (for TypeScript/JavaScript)

**Property Test Configuration:**
- Minimum iterations: 100
- Seed: Random (for reproducibility on failure)
- Shrinking: Enabled (to find minimal failing case)

**Property Test Examples:**

```typescript
import fc from 'fast-check';

/**
 * Feature: creditos-ui-redesign, Property 1: Currency formatting consistency
 * Validates: Requirements 1.4
 */
describe('Property: Currency formatting consistency', () => {
  it('should format all monetary values with currency symbol and 2 decimals', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1000000, noNaN: true }),
        (amount) => {
          const formatted = formatCurrency(amount);
          // Should start with $ or contain MXN
          expect(formatted).toMatch(/^\$|MXN/);
          // Should have exactly 2 decimal places
          expect(formatted).toMatch(/\.\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: creditos-ui-redesign, Property 7: Required field validation
 * Validates: Requirements 5.1
 */
describe('Property: Required field validation', () => {
  it('should highlight empty required fields on save attempt', () => {
    fc.assert(
      fc.property(
        fc.record({
          clientName: fc.constant(''),
          clientPhone: fc.string(),
          avalName: fc.string(),
          avalPhone: fc.string(),
          loanType: fc.string(),
          amount: fc.string(),
        }),
        (loan) => {
          const errors = validateLoan(loan);
          expect(errors).toContain('Nombre del cliente requerido');
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: creditos-ui-redesign, Property 9: Amount validation
 * Validates: Requirements 5.3
 */
describe('Property: Amount validation', () => {
  it('should reject zero or negative amounts', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0),
          fc.float({ max: -0.01 })
        ),
        (amount) => {
          const errors = validateAmount(amount.toString());
          expect(errors.length).toBeGreaterThan(0);
          expect(errors[0]).toContain('mayor a 0');
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: creditos-ui-redesign, Property 15: Add credit entry increases count
 * Validates: Requirements 7.3
 */
describe('Property: Add credit entry increases count', () => {
  it('should increase entry count when adding new credit', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10 }),
        (initialCount) => {
          const entries = Array(initialCount).fill({});
          const newEntries = addCreditEntry(entries);
          expect(newEntries.length).toBe(initialCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: creditos-ui-redesign, Property 21: Minimum entry count enforcement
 * Validates: Requirements 8.5
 */
describe('Property: Minimum entry count enforcement', () => {
  it('should disable delete button when only one entry remains', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          clientName: fc.string(),
          amount: fc.string(),
        }),
        (entry) => {
          const entries = [entry];
          const canDelete = canDeleteEntry(entries, entry.id);
          expect(canDelete).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: creditos-ui-redesign, Property 22: Real-time delivered amount calculation
 * Validates: Requirements 10.1
 */
describe('Property: Real-time delivered amount calculation', () => {
  it('should calculate delivered amount immediately when requested amount changes', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 100000 }),
        fc.float({ min: 0, max: 1000 }),
        (requestedAmount, commission) => {
          const delivered = calculateDeliveredAmount(
            requestedAmount.toString(),
            commission.toString()
          );
          expect(delivered).toBe(requestedAmount - commission);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

**Test Scenarios:**
1. Complete credit creation flow (open modal → fill form → save → verify toast)
2. Credit deletion flow (click delete → confirm → verify removal → verify toast)
3. Autocomplete search flow (type → see results → select → verify selection)
4. Validation flow (submit invalid → see errors → fix → submit valid)
5. Multiple credit entries (add → fill → add another → fill → save all)

**Example Integration Test:**
```typescript
describe('Credit Creation Flow', () => {
  it('should create credits and show success toast', async () => {
    const { getByText, getByPlaceholderText, getByRole } = render(
      <CreditosTabNew
        selectedDate={new Date()}
        selectedRoute="route-1"
        selectedLead={mockLead}
      />
    );
    
    // Open modal
    fireEvent.click(getByText('Crear Crédito'));
    
    // Fill form
    fireEvent.change(getByPlaceholderText('Buscar cliente...'), {
      target: { value: 'Juan Pérez' }
    });
    fireEvent.change(getByPlaceholderText('Teléfono...'), {
      target: { value: '5551234567' }
    });
    
    // Save
    fireEvent.click(getByText('Guardar Cambios'));
    
    // Verify toast
    await waitFor(() => {
      expect(getByText(/crédito\(s\) guardado\(s\)/i)).toBeInTheDocument();
    });
  });
});
```

### Visual Regression Tests

**Tool:** Percy or Chromatic

**Test Cases:**
1. Credits list table (empty state)
2. Credits list table (with data)
3. Create credit modal (initial state)
4. Create credit modal (with one entry)
5. Create credit modal (with multiple entries)
6. Autocomplete dropdown (with results)
7. Autocomplete dropdown (no results)
8. Autocomplete dropdown (loading state)
9. Form validation errors
10. Toast notifications (all types)

## Implementation Notes

### CSS Modules Organization

```
admin/components/transactions/
├── CreditosTabNew.tsx
├── CreditosTabNew.module.css
├── CreateCreditModal.tsx
├── CreateCreditModal.module.css
├── CreditCard.module.css
└── Toast.module.css

admin/components/loans/
├── ClientLoanUnifiedInput.tsx
└── ClientLoanUnifiedInput.module.css

admin/components/ui/
├── button.tsx
├── button.module.css
├── input.tsx
├── input.module.css
├── select.tsx
├── select.module.css
├── toast.tsx
└── toast.module.css
```

### Performance Considerations

1. **Debounced Search:** 300ms delay for autocomplete to prevent excessive API calls
2. **Memoized Calculations:** Use `useMemo` for totals and derived values
3. **Virtualized Lists:** Consider react-window for large credit lists (>100 items)
4. **Optimistic Updates:** Update UI immediately, rollback on error
5. **Lazy Loading:** Load modal content only when opened

### Accessibility

1. **Keyboard Navigation:** All interactive elements accessible via Tab
2. **ARIA Labels:** Proper labels for screen readers
3. **Focus Management:** Trap focus in modal, restore on close
4. **Error Announcements:** Use aria-live for validation errors
5. **Color Contrast:** Ensure WCAG AA compliance (4.5:1 minimum)

### Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Responsive Design

**Breakpoints:**
- Mobile: < 640px (single column layout)
- Tablet: 640px - 1024px (adjusted spacing)
- Desktop: > 1024px (full layout)

**Modal Adjustments:**
- Mobile: Full screen, bottom sheet style
- Tablet: 90% width, centered
- Desktop: Max 1200px width, centered

## Migration Strategy

### Phase 1: UI Components (Week 1)
1. Create new CSS Module files with mockup styles
2. Update button components with new styles
3. Update input components with new styles
4. Implement toast notification system

### Phase 2: Modal Redesign (Week 1-2)
1. Update CreateCreditModal layout
2. Implement credit entry cards
3. Update autocomplete styling
4. Add validation UI

### Phase 3: Integration (Week 2)
1. Connect toast system to actions
2. Implement validation logic
3. Update existing components to use new styles
4. Test all flows

### Phase 4: Polish & Testing (Week 2-3)
1. Visual regression testing
2. Property-based testing
3. Integration testing
4. User acceptance testing

## Related Documentation

- [AGENTS.MD](../../AGENTS.MD) - Project coding guidelines
- [example.html](.kiro/specs/mockups/example.html) - Reference implementation
- [Mockup Screenshots](.kiro/specs/mockups/) - Visual design reference
