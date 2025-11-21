# Task 31 Fix: Resolved Null Location Issue

## Problem
The `selectedLeadLocation` was returning `null` because the `selectedLead` object didn't include the `addresses` field with location information.

## Root Cause
The issue was in the data flow:
1. `RouteLeadSelector` fetches leads using `GET_LEADS_SIMPLE` query (which includes addresses)
2. However, in `handleLeadChange`, only `fullName` was being passed to `onLeadSelect`
3. The `addresses` field was being omitted, causing `selectedLeadLocation` to be null

## Changes Made

### 1. RouteLeadSelector.tsx
**File:** `admin/components/routes/RouteLeadSelector.tsx`

**Change:** Updated `handleLeadChange` to include addresses in the lead object:

```typescript
// Before:
personalData: {
  fullName: option.data.personalData.fullName
}

// After:
personalData: {
  fullName: option.data.personalData.fullName,
  addresses: option.data.personalData.addresses || []
}
```

### 2. transaction.ts (Types)
**File:** `admin/types/transaction.ts`

**Change:** Updated `PersonalData` interface to include addresses:

```typescript
export interface PersonalData {
  fullName: string;
  addresses?: Array<{
    id: string;
    location: {
      id: string;
      name: string;
    };
  }>;
}
```

## Verification
- ✅ No TypeScript errors in affected files
- ✅ `toCreditLead` function already passes addresses correctly
- ✅ `GET_LEADS_SIMPLE` query already fetches addresses
- ✅ `selectedLeadLocation` computation in CreditosTabNew will now work correctly

## Data Flow (Fixed)
1. User selects a route → `RouteLeadSelector` fetches leads with `GET_LEADS_SIMPLE`
2. User selects a lead → `handleLeadChange` passes lead with addresses to `onLeadSelect`
3. `transacciones.tsx` receives lead with addresses
4. `toCreditLead` converts it and passes to `CreditosTabNew`
5. `CreditosTabNew` computes `selectedLeadLocation` from `selectedLead.personalData.addresses[0].location`
6. `CreateCreditModal` receives `selectedLeadLocation` with valid id and name
7. `ClientLoanUnifiedInput` uses it for location validation

## Testing
To verify the fix:
1. Select a route in the transactions page
2. Select a leader/location
3. Open the credit creation modal
4. The modal subtitle should show the location name (not "Sin localidad")
5. Try selecting a client from a different location
6. The warning dialog should show both location names correctly
