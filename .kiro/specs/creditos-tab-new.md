# CreditosTabNew Component Specification

## Overview

**Component**: `CreditosTabNew.tsx`  
**Location**: `admin/components/transactions/`  
**Purpose**: Credit creation and management interface for a microfinance system

This component manages the creation of new loans (credits) for both new and existing clients within a hierarchical structure: Route → Location → Date.

## Architecture

### Hierarchy
```
Route (Ruta)
  └── Location (Localidad)
      └── Date (Fecha)
          └── Loans (Créditos)
```

### Key Features

1. **Loan Creation**
   - New clients (first-time borrowers)
   - Existing clients (renewals)
   - Bulk loan creation via modal

2. **Client Management**
   - Client autocomplete with search
   - Location validation (clients must match route location)
   - Guarantor (Aval) selection

3. **Loan Types**
   - Multiple loan types with different rates and durations
   - Automatic calculation of amounts (requested, delivered, to pay)
   - Commission management

4. **Real-time KPIs**
   - Total credits count
   - New vs renewals
   - Amount given, amount to pay
   - Total commissions

## Component Structure

### Main Components

1. **CreditosTabNew** (Main container)
   - KPI bar with metrics
   - Existing loans table
   - Pending loans section
   - Action buttons

2. **CreateCreditModal** (Modal for bulk creation)
   - Multi-credit form
   - Client/Guarantor selection
   - Loan details input
   - Totals calculation

3. **ClientLoanUnifiedInput** (Autocomplete component)
   - Client search
   - Previous loan selection
   - Location validation
   - Edit/Clear actions

## Data Flow

### State Management

```typescript
// Main state
loans: Loan[]                    // Existing loans for selected date
pendingLoans: ExtendedLoanForCredits[]  // Loans pending save
editingLoan: Loan | null         // Loan being edited

// UI state
isCreating: boolean              // Bulk save in progress
isSearchingLoansByRow: Record<string, boolean>  // Search loading per row
locationMismatchDialogOpen: {...}  // Location alert state

// Search state
dropdownSearchTextByRow: Record<string, string>  // Search text per input
debouncedDropdownSearchTextByRow: Record<string, string>  // Debounced search
```

### GraphQL Operations

**Queries:**
- `GET_LOANS_FOR_TRANSACTIONS` - Fetch loans for date/lead
- `GET_LOAN_TYPES` - Fetch available loan types
- `GET_ALL_PREVIOUS_LOANS` - Search previous loans (autocomplete)
- `GET_LEAD_PAYMENTS` - Fetch payments for date

**Mutations:**
- `CREATE_LOANS_BULK` - Create multiple loans at once
- `UPDATE_LOAN_WITH_AVAL` - Update loan with guarantor
- `DELETE_LOAN` - Delete a loan
- `MOVE_LOANS_TO_DATE` - Move loans to different date

## UI Design System

### Modern Design (2025)

**Inspired by**: Vercel, Linear, Stripe, Notion

**Color Palette:**
```css
/* KPI Chips */
--neutral: #f3f4f6 / #374151
--blue: #eff6ff / #1e40af
--amber: #fef3c7 / #92400e
--pink: #fdf2f8 / #be185d
--green: #f0fdf4 / #166534
--purple: #ede9fe / #6d28d9

/* Client Cards */
--selected-green: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)
--editing-yellow: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)
```

**Typography:**
- Body: 13-14px, weight 400-500
- Labels: 11-13px, weight 500-600
- Headers: 15-20px, weight 600
- Compact UI: 10-12px

**Spacing:**
- Card padding: 20-24px
- Gap between sections: 18-20px
- Input padding: 11px 14px
- Border radius: 8-12px

### Key UI Components

1. **KPI Bar**
   - Gradient background
   - Colored chips for metrics
   - Mass commission input
   - Save button with dropdown menu

2. **Loan Cards** (in modal)
   - 2-column layout: People (left) | Loan details (right)
   - Section headers with icons (👤 Titular, 🤝 Aval)
   - Compact inputs (28px height)
   - Delete button with validation check

3. **Client Selection Cards**
   - Green card: Selected client (read-only)
   - Yellow card: Editing mode (with warning)
   - Edit/Clear action buttons
   - Name, phone display

4. **Floating Action Button**
   - Fixed bottom-right position
   - Green gradient background
   - "+" icon with text
   - Opens CreateCreditModal

## Business Logic

### Loan Calculation

```typescript
// Formula
amountGived = requestedAmount - pendingAmount
amountToPay = (requestedAmount * (1 + rate)) - pendingAmount
totalDebtAcquired = amountToPay
```

### Validation Rules

1. **Client Validation**
   - Must have name and phone
   - New clients: Check for duplicates
   - Existing clients: Must select from autocomplete
   - Location must match route location (warning if different)

2. **Guarantor Validation**
   - Cannot be used by multiple loans on same date
   - Can be existing person or new
   - Location validation applies

3. **Loan Validation**
   - Must have loan type
   - Requested amount > 0
   - Commission >= 0

### Location Validation

When selecting a client from a different location:
- Show alert dialog with warning
- Display client location vs route location
- Allow user to acknowledge and continue

## Key Features

### 1. Bulk Loan Creation

**Flow:**
1. Click floating "Crear Crédito" button
2. Modal opens with empty loan form
3. Fill client, guarantor, loan details
4. Click "+ Agregar Otro Crédito" for more
5. Review totals (Solicitado, A Entregar)
6. Click "Guardar Cambios"
7. Loans added to pending list
8. Save all pending loans to database

### 2. Client Autocomplete

**Features:**
- Fuzzy search by name or phone
- Shows previous loans with debt status
- Displays location and leader name
- Badges for debt amount
- "Nuevo Cliente" option for new clients
- Edit existing client data (with warning)

### 3. Loan Renewals

**Flow:**
1. Search for client in autocomplete
2. Select previous loan
3. Auto-fills: client, guarantor, loan type, amount
4. Shows pending debt
5. Calculates new amounts (subtracts debt)
6. Commission auto-set from loan type

### 4. Mass Commission

Apply same commission to all pending loans:
1. Enter commission amount in KPI bar
2. Click "Aplicar"
3. Updates all loans with commission > 0

## Technical Details

### Performance Optimizations

1. **Debounced Search** (300ms)
   - Prevents excessive API calls
   - Per-row search state
   - Independent loading indicators

2. **Memoized Calculations**
   - `useMemo` for totals
   - `useCallback` for handlers
   - Prevents unnecessary re-renders

3. **Optimized Queries**
   - Use `-optimized` query variants
   - Skip queries when no date/lead selected
   - Refetch only when necessary

### Error Handling

1. **Duplicate Client Detection**
   - Check name + phone combination
   - Alert user to use renewal option
   - Skip validation for autocomplete selections

2. **Location Mismatch**
   - Show warning dialog
   - Allow user to proceed
   - Log for audit purposes

3. **Save Failures**
   - Display error message
   - Keep pending loans in state
   - Allow retry

## CSS Modules

**File**: `CreditosTabNew.module.css`

**Key Classes:**
- `.kpiBar` - KPI metrics bar
- `.kpiChip` - Individual metric chip
- `.compactLoanForm` - Loan card in pending section
- `.personsColumn` - Left column (client/guarantor)
- `.loanInfoColumn` - Right column (loan details)
- `.floatingCreateButton` - FAB for modal

**Modal File**: `CreateCreditModal.module.css`

**Key Classes:**
- `.modalOverlay` - Dark backdrop
- `.modalContainer` - Modal card
- `.creditCard` - Individual loan card
- `.selectedClientCard` - Green selected state
- `.editingClientCard` - Yellow editing state
- `.fieldInput` - Form inputs

## Dependencies

### External Libraries
- `@apollo/client` - GraphQL client
- `react-icons/fa` - Icons
- `@keystone-ui/core` - UI components

### Internal Modules
- `calculateLoanAmounts` - Loan calculations
- `ClientLoanUnifiedInput` - Autocomplete component
- `CreateCreditModal` - Bulk creation modal
- `PaymentConfigModal` - Payment configuration

### GraphQL Queries/Mutations
- Located in `admin/graphql/queries/`
- Located in `admin/graphql/mutations/`

## Testing Considerations

### Unit Tests
- Loan amount calculations
- Validation logic
- State management

### Integration Tests
- GraphQL query/mutation flows
- Client search and selection
- Bulk loan creation

### E2E Tests
- Complete loan creation flow
- Renewal flow
- Location validation
- Mass commission application

## Future Enhancements

1. **Offline Support**
   - Cache pending loans locally
   - Sync when connection restored

2. **Advanced Search**
   - Filter by location
   - Filter by debt status
   - Sort options

3. **Batch Operations**
   - Delete multiple loans
   - Move multiple loans
   - Export to Excel

4. **Analytics**
   - Loan approval rate
   - Average loan amount
   - Commission trends

## Related Components

- `ClientLoanUnifiedInput.tsx` - Autocomplete with search
- `CreateCreditModal.tsx` - Bulk creation modal
- `PaymentConfigModal.tsx` - Payment configuration
- `KPIBar.tsx` - Metrics display (if extracted)

## Notes

- Uses CSS Modules for all styling
- Follows modern design system (2025)
- Optimized for performance with debouncing and memoization
- Comprehensive validation and error handling
- Supports both new clients and renewals
- Location-aware with validation
