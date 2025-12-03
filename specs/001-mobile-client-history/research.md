# Phase 0 Research: Mobile-Optimized Client History Page

**Feature Branch**: `001-mobile-client-history`
**Date**: 2025-12-02
**Research Phase**: Technical decisions and validation

## Executive Summary

This document captures the findings from Phase 0 research to resolve technical unknowns before implementation. All 8 research topics have been investigated, and technical decisions are documented below.

---

## 1. shadcn/ui Autocomplete Pattern

**Question**: What's the recommended shadcn/ui pattern for autocomplete with 10-15 result limit?

**Research Findings**:
- **Existing Pattern**: Project already has custom autocomplete component at `admin/components/ui/autocomplete.tsx`
- **Implementation**: Uses Input + Popover pattern (not cmdk/Command component)
- **Current Design**:
  - Two-column grid (name + phone)
  - Absolute positioned dropdown with z-10
  - Max height with scroll (`max-h-60 overflow-auto`)
  - Click-outside handler with useRef
  - Hover states on suggestions

**Technical Decision**:
✅ **Use custom Input + Popover pattern** similar to existing `admin/components/ui/autocomplete.tsx`

**Rationale**:
1. Project already has working autocomplete component following shadcn/ui design principles
2. Input + Popover is lighter-weight than Command (cmdk) for simple autocomplete
3. Existing pattern already handles:
   - Click-outside behavior
   - Keyboard navigation setup
   - Proper z-index layering
   - Mobile-friendly touch targets

**Implementation Notes**:
- Enhance existing pattern with:
  - 10-15 result limit with "Se encontraron más resultados" message
  - Client details in suggestions (name, code, location, route)
  - Modern hover states and visual hierarchy
  - Minimum 2 characters for search activation (per FR-001)

**Reference**: `admin/components/ui/autocomplete.tsx:1-104`

---

## 2. Mobile-First Responsive Breakpoints

**Question**: What Tailwind breakpoints align with 320px-1920px requirement and modern mobile/tablet/desktop?

**Research Findings**:
- **Tailwind Default Breakpoints**:
  - `sm`: 640px (landscape phones, small tablets)
  - `md`: 768px (tablets)
  - `lg`: 1024px (laptops)
  - `xl`: 1280px (desktops)
  - `2xl`: 1536px (large desktops)
- **Requirement**: Support 320px-1920px (mobile-first)
- **Reference Implementation**: `historial-cliente/src/components/` uses default Tailwind breakpoints

**Technical Decision**:
✅ **Use Tailwind default breakpoints** with mobile-first approach

**Breakpoint Strategy**:
```
Base (320px-639px)   → Mobile portrait
sm: (640px-767px)    → Mobile landscape, small tablets
md: (768px-1023px)   → Tablets portrait
lg: (1024px-1279px)  → Tablets landscape, laptops
xl: (1280px-1919px)  → Desktops
```

**Rationale**:
1. Default breakpoints align perfectly with requirement (320px minimum, no max needed below 1920px)
2. Reference implementation in `/historial-cliente` already uses defaults successfully
3. Modern CSS handles viewport scaling beyond defined breakpoints
4. No custom Tailwind config needed - faster setup

**Implementation Examples**:
```tsx
// Document grid: 2 cols mobile, auto-fill desktop
<div className="grid grid-cols-2 md:grid-cols-auto-fill gap-3">

// Loan metrics: 2 cols mobile, 4 cols desktop
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">

// Search buttons: stack mobile, inline desktop
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
```

**Reference**: `historial-cliente/src/components/LoanCard.tsx:78`, `historial-cliente/src/components/SearchBar.tsx:29`

---

## 3. Lazy Loading Documents Strategy

**Question**: How to implement tab-based lazy loading with Apollo Client cache management?

**Research Findings**:
- **Apollo Client Imports**: `import { useQuery, useLazyQuery, useMutation } from '@apollo/client'`
- **Original Implementation**: Uses `useLazyQuery` for document fetching
- **Cache Policy Options**:
  - `cache-first`: Check cache first, network if miss (best for static data)
  - `network-only`: Always fetch from network (no cache)
  - `cache-and-network`: Return cached data, fetch fresh in background

**Technical Decision**:
✅ **Use `useLazyQuery` with `cache-first` policy** for tab-based lazy loading

**Implementation Pattern**:
```tsx
// Declare lazy queries for each tab
const [getClientDocs, { data: clientDocs, loading: clientLoading }] = useLazyQuery(
  GET_CLIENT_DOCUMENTS_ONLY,
  { fetchPolicy: 'cache-first' }
);

const [getAvalDocs, { data: avalDocs, loading: avalLoading }] = useLazyQuery(
  GET_AVAL_DOCUMENTS_ONLY,
  { fetchPolicy: 'cache-first' }
);

// Trigger on tab switch
const handleTabChange = (tab: 'cliente' | 'aval') => {
  setActiveTab(tab);
  if (tab === 'cliente' && !clientDocs) {
    getClientDocs({ variables: { clientId } });
  } else if (tab === 'aval' && !avalDocs) {
    getAvalDocs({ variables: { loanId } });
  }
};
```

**Cache Behavior**:
1. **First tab switch**: Trigger lazy query → fetch from network → cache result
2. **Subsequent tab switches**: Return cached data instantly
3. **Client changes**: Clear cache or refetch with new clientId

**Rationale**:
1. `cache-first` reduces network requests on repeated tab switches
2. Lazy queries prevent preloading until user explicitly requests documents (cost optimization)
3. Apollo Client automatic cache management by query variables

**Reference**: `admin/pages/historial-cliente.tsx:2`

---

## 4. Existing GraphQL Operations Inventory

**Question**: Which exact GraphQL operations from `admin/pages/historial-cliente.tsx` will be reused?

**Research Findings**:
All GraphQL operations located in `admin/pages/historial-cliente.tsx:15-253`

### Queries (7)

1. **GET_ROUTES** (lines 15-32)
   - **Purpose**: Fetch available routes with locations for filtering
   - **Variables**: None
   - **Returns**: `routes { id, name, employees { personalData { addresses { location { id, name } } } } }`

2. **SEARCH_CLIENTS** (lines 34-38)
   - **Purpose**: Autocomplete search for clients by name/code
   - **Variables**: `$searchTerm: String!, $routeId: String, $locationId: String, $limit: Int`
   - **Returns**: JSON string with client search results
   - **Usage**: Limit to 10-15 results for autocomplete

3. **GET_CLIENT_HISTORY** (lines 40-44)
   - **Purpose**: Fetch complete client history including loans as borrower and aval
   - **Variables**: `$clientId: String!, $routeId: String, $locationId: String`
   - **Returns**: JSON string with complete client history data
   - **Note**: Custom resolver returns comprehensive data structure

4. **GET_CLIENT_DOCUMENTS** (lines 46-94)
   - **Purpose**: Fetch all documents related to client (both titular and aval)
   - **Variables**: `$clientId: ID!`
   - **Returns**: `documentPhotos[]` with full document details
   - **Query Pattern**: Uses OR clause to find documents where client is personalData, borrower, or collateral

5. **GET_LAST_LOAN_DOCUMENTS** (lines 97-141)
   - **Purpose**: Fetch documents for specific loan
   - **Variables**: `$loanId: ID!`
   - **Returns**: `documentPhotos[]` filtered by loan
   - **Usage**: May not be needed for new implementation

6. **GET_CLIENT_DOCUMENTS_ONLY** (lines 144-194)
   - **Purpose**: Fetch documents where client is titular/borrower
   - **Variables**: `$clientId: ID!`
   - **Returns**: `documentPhotos[]` with AND clause (personalData + borrower)
   - **Fields**: Includes `isError`, `errorDescription`, `isMissing` flags
   - **Usage**: "Cliente" tab lazy loading

7. **GET_AVAL_DOCUMENTS_ONLY** (lines 197-246)
   - **Purpose**: Fetch documents where client is aval/collateral
   - **Variables**: `$loanId: ID!`
   - **Returns**: `loan.documentPhotos[]` with collateral info
   - **Fields**: Includes `isError`, `errorDescription`, `isMissing` flags
   - **Usage**: "Aval" tab lazy loading

### Mutations (1)

8. **MERGE_CLIENTS** (lines 249-253)
   - **Purpose**: Merge duplicate client records
   - **Variables**: `$primaryClientId: ID!, $secondaryClientId: ID!`
   - **Returns**: Success message string
   - **Note**: Transfers loans, documents, payments from secondary to primary

### REST Endpoints (1)

9. **POST /export-client-history-pdf** (see next section)

**Technical Decision**:
✅ **Reuse all 8 GraphQL operations and 1 REST endpoint** without modification

**Implementation Notes**:
- Copy exact query/mutation definitions to `admin/graphql/queries/client-history.ts`
- Maintain named exports for each operation
- No schema changes allowed per constraints
- Use existing resolver responses (JSON strings for custom resolvers)

**Reference**: `admin/pages/historial-cliente.tsx:15-253`

---

## 5. PDF Export Endpoint Signature

**Question**: What's the exact request/response format for `/export-client-history-pdf`?

**Research Findings**:
Located at `admin/pages/historial-cliente.tsx:1208-1220`

**Request Signature**:
```typescript
const handleExportPDF = async (historyData: ClientHistoryData, detailed: boolean = false) => {
  const response = await fetch('/export-client-history-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId: historyData.client.id,
      clientName: historyData.client.fullName,
      clientDui: historyData.client.clientCode,
      clientPhones: historyData.client.phones,
      clientAddresses: historyData.client.addresses,
      // ... more fields from historyData
      detailed: detailed, // Boolean flag for detailed vs summary
    }),
  });
};
```

**Request Body Structure**:
```typescript
{
  clientId: string;
  clientName: string;
  clientDui: string; // clientCode
  clientPhones: Array<{ number: string }>;
  clientAddresses: Array<{ address: string }>;
  loans: Array<Loan>; // Complete loan array from historyData
  leaderInfo: { name, route, location, municipality, state, phone };
  detailed: boolean; // true = complete chronology, false = summary
}
```

**Response**:
- **Success**: PDF file download (Content-Type: application/pdf)
- **Error**: JSON error message

**Detailed Mode Toggle**:
- **Summary PDF**: Client profile + loan summary statistics + basic loan list
- **Detailed PDF**: Complete payment chronology for each loan (using `generatePaymentChronology`)

**Technical Decision**:
✅ **Reuse existing endpoint with exact request structure**

**Implementation Notes**:
1. Add checkbox/toggle for `detailed` flag (per FR-019)
2. Construct request body from `historyResult` state after successful `getClientHistory` query
3. Handle blob response for download
4. Display error toast on failure (per FR-023)

**Reference**: `admin/pages/historial-cliente.tsx:1208-1220`, `admin/pages/historial-cliente.tsx:1626-1639`

---

## 6. Payment Chronology Utility

**Question**: What's the signature of `generatePaymentChronology` function?

**Research Findings**:
Located at `admin/utils/paymentChronology.ts:1-283`

**Function Signature**:
```typescript
export const generatePaymentChronology = (loan: LoanData): PaymentChronologyItem[]
```

**Input Type (LoanData)**:
```typescript
interface LoanData {
  id: string;
  signDate: string; // ISO date string
  weekDuration?: number;
  status?: string; // 'ACTIVE' | 'FINISHED' | 'RENOVATED'
  finishedDate?: string;
  badDebtDate?: string;
  amountGived?: number; // Alternative to amountRequested
  profitAmount?: number; // Alternative to interestAmount
  amountRequested?: number;
  interestAmount?: number;
  totalAmountDue?: number;
  payments?: Array<{
    id: string;
    receivedAt: string; // ISO date string
    receivedAtFormatted?: string;
    amount: number;
    paymentMethod: string;
    balanceBeforePayment: number;
    balanceAfterPayment: number;
    paymentNumber?: number;
  }>;
}
```

**Output Type (PaymentChronologyItem[])**:
```typescript
interface PaymentChronologyItem {
  id: string;
  date: string; // ISO date string
  dateFormatted: string; // Localized format (es-SV)
  type: 'PAYMENT' | 'NO_PAYMENT';
  description: string; // "Pago #1", "Sin pago", "Sin pago (cubierto por sobrepago)"
  amount?: number;
  paymentMethod?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  paymentNumber?: number;
  weekCount?: number; // For NO_PAYMENT type
  weekIndex?: number; // 1..N week number
  weeklyExpected?: number;
  weeklyPaid?: number;
  surplusBefore?: number;
  surplusAfter?: number;
  coverageType?: 'FULL' | 'COVERED_BY_SURPLUS' | 'PARTIAL' | 'MISS';
}
```

**Business Logic**:
1. Generates week-by-week chronology from `signDate` to `finishedDate` or current date
2. Matches payments to weeks (Monday-Sunday periods)
3. Calculates expected weekly payment: `totalDue / weekDuration`
4. Tracks surplus/deficit across weeks
5. Marks missing weeks as "Sin pago" or "Sin pago (cubierto por sobrepago)"
6. Includes payments outside regular weeks (late payments, overpayments)
7. Sorts all items chronologically

**Technical Decision**:
✅ **Import and use existing utility** without modification

**Implementation Notes**:
- Import: `import { generatePaymentChronology, PaymentChronologyItem, LoanData } from '@/admin/utils/paymentChronology'`
- Call when loan card expands to show payment history
- Display chronology items with color coding by `coverageType`:
  - `FULL`: Green (✓ Paid in full)
  - `COVERED_BY_SURPLUS`: Blue (✓ Covered by surplus)
  - `PARTIAL`: Yellow (⚠ Partial payment)
  - `MISS`: Red (✗ Missed payment)
- Use `weekIndex` for visual grouping/highlighting

**Reference**: `admin/utils/paymentChronology.ts:1-283`

---

## 7. Duplicate Detection Algorithm

**Question**: Is Levenshtein distance calculation client-side or server-side?

**Research Findings**:
Located at `admin/pages/historial-cliente.tsx:466-526`

**Implementation**: ✅ **Client-side** (both functions in frontend code)

**Levenshtein Distance Function** (lines 466-497):
```typescript
const levenshteinDistance = (str1: string, str2: string): number => {
  // Standard dynamic programming implementation
  // Creates matrix of size (str1.length+1) x (str2.length+1)
  // Returns edit distance (insertions, deletions, substitutions)
}
```

**Duplicate Detection Function** (lines 498-526):
```typescript
const findPotentialDuplicates = (
  clients: ClientSearchResult[]
): Array<{client1: ClientSearchResult, client2: ClientSearchResult, similarity: number}> => {

  // Algorithm:
  // 1. Normalize names (remove accents, uppercase)
  const name1 = client1.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  // 2. Calculate Levenshtein distance
  const distance = levenshteinDistance(name1, name2);

  // 3. Convert to similarity percentage
  const maxLength = Math.max(name1.length, name2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  // 4. Flag as duplicate if >= 85% AND distance <= 3
  if (similarity >= 85 && distance <= 3) {
    duplicates.push({ client1, client2, similarity: Math.round(similarity) });
  }

  // 5. Sort by similarity descending
  return duplicates.sort((a, b) => b.similarity - a.similarity);
}
```

**Threshold Rules**:
- **Minimum similarity**: 85%
- **Maximum distance**: 3 characters difference
- **Normalization**: Remove accents, convert to uppercase
- **Example**: "MARÍA" → "MARIA" for comparison

**Technical Decision**:
✅ **Reuse client-side algorithm** without modification

**Implementation Notes**:
1. Copy both functions to new implementation
2. Call `findPotentialDuplicates` after `SEARCH_CLIENTS` query returns results
3. Display duplicate warning banner if `duplicates.length > 0` (per FR-015)
4. Show duplicate comparison cards with similarity percentage (per FR-016)
5. Provide merge workflow with primary/secondary selection (per FR-017)

**Performance Consideration**:
- Complexity: O(n²) for pairwise comparison
- With 10-15 autocomplete results: ~100-225 comparisons (acceptable)
- Levenshtein: O(m×n) where m,n are string lengths
- Combined: Fast enough for client-side execution on modern devices

**Reference**: `admin/pages/historial-cliente.tsx:466-526`

---

## 8. Keystone Route Registration Pattern

**Question**: How to register `/historial-cliente-new` route in Keystone admin UI?

**Research Findings**:

**Current Implementation Pattern**:
- **Custom Navigation**: Uses `CustomNavigation.tsx` component for menu (not page registration)
- **Page Discovery**: Keystone 6 automatically discovers pages in `admin/pages/` directory
- **Route Mapping**: File `admin/pages/historial-cliente.tsx` → Route `/historial-cliente`
- **No Explicit Registration Needed**: Convention-based routing

**File-Based Routing Pattern**:
```
admin/pages/
├── historial-cliente.tsx        → /historial-cliente
├── historial-cliente-new.tsx    → /historial-cliente-new  ✅ Auto-discovered
├── dashboard.tsx                → /dashboard
└── transacciones.tsx            → /transacciones
```

**Page Component Structure** (from `historial-cliente.tsx`):
```tsx
// Default export = page component
export default function HistorialClientePage() {
  return (
    <div>
      {/* Page content */}
    </div>
  );
}
```

**Navigation Menu Registration** (optional):
To add to sidebar menu, edit `admin/components/CustomNavigation.tsx:18-134`:

```tsx
{
  title: 'Clientes',
  roles: ['CAPTURA', 'NORMAL', 'ADMIN'],
  items: [
    {
      label: 'Historial de Clientes',
      href: '/historial-cliente',
      roles: ['CAPTURA', 'NORMAL', 'ADMIN']
    },
    {
      label: 'Historial de Clientes (Móvil)', // New entry
      href: '/historial-cliente-new',
      roles: ['CAPTURA', 'NORMAL', 'ADMIN']
    },
    // ... more items
  ]
}
```

**Technical Decision**:
✅ **Use file-based routing** (create `admin/pages/historial-cliente-new.tsx`)

**Implementation Steps**:
1. Create file: `admin/pages/historial-cliente-new.tsx`
2. Export default React component (page content)
3. Route automatically available at `/historial-cliente-new`
4. **Optional**: Add menu item to `CustomNavigation.tsx` for sidebar visibility
5. Test by navigating to `http://localhost:3000/historial-cliente-new` in browser

**Rationale**:
- Keystone 6 uses Next.js-style file-based routing for admin pages
- No configuration file needed (unlike older Keystone versions)
- Follows existing pattern used by all 24 pages in `admin/pages/`
- Simple, convention-based approach

**Reference**: `admin/components/CustomNavigation.tsx:22-27`, all files in `admin/pages/`

---

## Summary of Technical Decisions

| Topic | Decision | Implementation |
|-------|----------|----------------|
| **Autocomplete** | Custom Input + Popover | Enhance existing `admin/components/ui/autocomplete.tsx` pattern |
| **Breakpoints** | Tailwind defaults | Mobile-first with `sm:`, `md:`, `lg:`, `xl:` |
| **Lazy Loading** | `useLazyQuery` + `cache-first` | Tab-based triggers, Apollo cache management |
| **GraphQL Ops** | Reuse all 8 operations | Copy to `admin/graphql/queries/client-history.ts` |
| **PDF Export** | POST `/export-client-history-pdf` | Request body with `detailed: boolean` flag |
| **Payment Chronology** | Import existing utility | Use `generatePaymentChronology` from `admin/utils/` |
| **Duplicate Detection** | Client-side algorithm | Copy `levenshteinDistance` + `findPotentialDuplicates` |
| **Route Registration** | File-based routing | Create `admin/pages/historial-cliente-new.tsx` |

---

## Next Steps

**Phase 1: Design Artifacts**

With all technical unknowns resolved, proceed to generate:

1. **data-model.md**: TypeScript interfaces for 8 entities based on GraphQL schema responses
2. **contracts/graphql-operations.md**: Document all 9 reused operations with examples
3. **quickstart.md**: Developer onboarding guide with implementation order

**Command**: Manually generate Phase 1 artifacts or proceed to `/speckit.tasks` for implementation task generation

---

## Validation

✅ All 8 research topics completed
✅ No blocking technical unknowns remain
✅ All decisions align with Constitution principles
✅ Ready to proceed to Phase 1 design artifacts
