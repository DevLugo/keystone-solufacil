# Task 31 Fix: Corrected Location Validation Logic

## Problem
The location validation was not working when selecting a client from the autocomplete. The dialog was not appearing even when the client was from a different location.

## Root Cause
The validation logic was comparing the **wrong locations**:
- ❌ **Before**: Comparing borrower's location (client) vs currently selected lead
- ✅ **After**: Comparing previous loan's lead location vs currently selected lead

### Why This Matters
When a user selects a previous loan to renew:
- The client (borrower) might have moved or have multiple addresses
- What matters is: **where was this loan originally managed?** (previous lead's location)
- We want to warn if the previous loan was in a different location than the current selection

## Example Scenario

**Before (Incorrect):**
1. Client "Juan" had a loan in "Ciudad A" (managed by Lead A)
2. Juan moved to "Ciudad B" (his address changed)
3. User selects Lead B in "Ciudad B"
4. User tries to renew Juan's loan
5. ❌ No warning shown (because Juan's current address matches Ciudad B)
6. But the previous loan was in Ciudad A!

**After (Correct):**
1. Client "Juan" had a loan in "Ciudad A" (managed by Lead A)
2. Juan moved to "Ciudad B" (his address changed)
3. User selects Lead B in "Ciudad B"
4. User tries to renew Juan's loan
5. ✅ Warning shown: "Cliente de localidad Ciudad A, diferente a Ciudad B"
6. User is informed that this loan was originally from a different location

## Changes Made

### ClientLoanUnifiedInput.tsx
**File:** `admin/components/loans/ClientLoanUnifiedInput.tsx`

**Change in `handleSelectOption` function (client mode):**

```typescript
// Before (WRONG):
const clientLocationId = option.loanData?.borrower?.personalData?.addresses?.[0]?.location?.id;
const clientLocationName = option.loanData?.borrower?.personalData?.addresses?.[0]?.location?.name || 'desconocida';

// After (CORRECT):
const previousLoanLeadLocationId = option.loanData?.lead?.personalData?.addresses?.[0]?.location?.id;
const previousLoanLeadLocationName = option.loanData?.lead?.personalData?.addresses?.[0]?.location?.name || 'desconocida';
```

**Comparison logic:**
```typescript
// Compare: previous loan's lead location vs currently selected lead location
if (selectedLeadLocationId && previousLoanLeadLocationId && 
    previousLoanLeadLocationId !== selectedLeadLocationId && onLocationMismatch) {
  onLocationMismatch(previousLoanLeadLocationName, currentLeadLocationName);
}
```

## Data Flow (Corrected)

1. User selects Lead B in "Ciudad B"
2. User types client name in autocomplete
3. `GET_ALL_PREVIOUS_LOANS` query returns loans with:
   - `loan.lead.personalData.addresses[0].location` (where the loan was managed)
   - `loan.borrower.personalData.addresses[0].location` (client's current address)
4. User selects a previous loan
5. `handleSelectOption` compares:
   - `previousLoanLeadLocationId` (from loan.lead)
   - vs `selectedLeadLocationId` (currently selected lead)
6. If different → show warning dialog
7. Dialog shows: "Cliente de localidad [previous lead location], diferente a [current lead location]"

## Testing
To verify the fix:
1. Select a lead in location "Ciudad A"
2. Search for a client who has a previous loan in location "Ciudad B"
3. Select that client from the autocomplete
4. ✅ Warning dialog should appear showing both location names
5. Click "Entendido" to proceed

## Notes
- The query `GET_ALL_PREVIOUS_LOANS` already includes both lead and borrower addresses
- The validation now correctly identifies cross-location loan renewals
- This helps prevent accidentally managing loans from different locations
