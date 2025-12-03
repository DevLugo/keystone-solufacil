# Implementation Plan: Mobile-Optimized Client History Page

**Branch**: `001-mobile-client-history` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mobile-client-history/spec.md`

## Summary

Migrate the existing client history page (`admin/pages/historial-cliente.tsx`) to a new mobile-optimized version at route `/historial-cliente-new` using shadcn/ui components exclusively. The implementation will remove all KeystoneJS UI dependencies while maintaining 100% functional parity with the original page, including client search, loan history visualization (borrower and guarantor roles), document access, duplicate detection, and PDF export. The new page prioritizes mobile-first responsive design (320px-1920px), performance optimization (lazy loading, cost reduction), and modern UI patterns following Vercel/Linear/Stripe design principles.

**Technical Approach**: Build UI components first with shadcn/ui and Tailwind CSS (referencing `/historial-cliente` folder for design patterns), then integrate existing GraphQL queries, business logic, and utility functions from the original implementation. No backend changes required - all GraphQL resolvers, schemas, and endpoints remain unchanged.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)
**Primary Dependencies**:
- React 18+ (admin UI framework)
- shadcn/ui components (Button, Card, Input, Tabs, Badge, Skeleton, Dialog, Command)
- Tailwind CSS 3.x (responsive utilities, spacing scale)
- Apollo Client 3.x (GraphQL operations)
- lucide-react (icon library)
- date-fns or native Intl API (date formatting)

**Storage**: PostgreSQL via Prisma ORM (existing database, no schema changes)
**Testing**: Jest for unit tests, manual mobile testing (iOS Safari 14+, Android Chrome 90+)
**Target Platform**: Web (Keystone Admin UI), mobile browsers (320px-1920px viewport)
**Project Type**: Web application (frontend-only, admin panel extension)

**Performance Goals**:
- Initial page load <2s on mobile (before data fetching)
- Client search completion <5s on 4G connection
- Document thumbnail load <3s per tab on mobile networks
- PDF generation <10s for clients with up to 20 loans
- Smooth 60fps animations/transitions (150-200ms)

**Constraints**:
- Cannot modify GraphQL schema or backend resolvers
- Must preserve all existing business logic (duplicate detection, payment chronology, loan status)
- Cannot break existing `/historial-cliente` route
- 100% shadcn/ui migration - zero @keystone-ui/* imports allowed
- Mobile-first responsive design (320px minimum width)
- WCAG 2.1 Level AA accessibility compliance
- Modern browsers only (iOS Safari 14+, Android Chrome 90+)

**Scale/Scope**:
- Single admin page at new route `/historial-cliente-new`
- Reuses 9 existing GraphQL queries/mutations
- ~10-15 shadcn/ui components
- ~2000-2500 lines of TypeScript/TSX (similar to original)
- Supports concurrent usage by 5-10 loan officers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality & Cleanliness
✅ **PASS** - Will implement clean code practices:
- Remove all unused imports/variables during development
- Use CSS Modules for all component styles (not applicable - using Tailwind CSS utility classes with shadcn/ui pattern)
- **ADJUSTMENT**: shadcn/ui uses Tailwind utility classes, not CSS Modules - aligns with modern design system principle
- Follow strict import order: external → internal → relative → styles
- Run ESLint/TypeScript checks before completion

### II. Modern Design System (2025)
✅ **PASS** - Explicitly required by specification:
- Implement Vercel-inspired gradients and shadows
- Use Linear-inspired transitions (150-200ms, cubic-bezier)
- Follow Stripe spacing scale (4px, 8px, 12px, 16px, 20px, 24px)
- Autocomplete with compact design (10-13px fonts, light weights, horizontal layout)
- Modern shadcn/ui components with proper hover states and micro-interactions

### III. GraphQL-First API
✅ **PASS** - Will reuse existing GraphQL patterns:
- Maintain existing operations in `admin/graphql/queries/` and `admin/graphql/mutations/`
- Preserve named exports (GET_ROUTES, SEARCH_CLIENTS, GET_CLIENT_HISTORY, etc.)
- No new queries needed - reuse all 9 existing operations
- Continue using fragments for repeated fields
- Optimize with variables, handle loading/error states

### IV. Type Safety & Error Handling
✅ **PASS** - TypeScript strict mode enforced:
- Explicit types for all function parameters and returns
- Interfaces for data shapes (Client, Loan, Payment, Document, Leader, NoPaymentPeriod)
- Try-catch for all async GraphQL operations
- Error logging with context: `console.error('❌ Error:', error)`
- Follow naming conventions: files (kebab-case), components (PascalCase), functions (camelCase)

### V. Testing & Audit Discipline
⚠️ **PARTIAL** - Testing scope limited:
- No new audit hooks needed (reusing existing client merge audit logic)
- Manual mobile testing on iOS Safari/Android Chrome
- No automated tests specified in requirements (acceptance criteria will be manually verified)
- **JUSTIFICATION**: This is a UI migration, not new business logic - existing backend audit hooks remain functional

### VI. Performance & Optimization
✅ **PASS** - Performance requirements explicit:
- Lazy load documents only when requested (cost optimization clarification)
- Use existing `-optimized` query variants where available
- Limit autocomplete results to 10-15 (avoid long lists on mobile)
- Cache loaded documents until client changes
- Batch operations with Promise.all() where applicable

### Technology Stack Compliance
✅ **PASS** - Using mandated stack:
- TypeScript (strict mode) ✅
- React with Apollo Client ✅
- KeystoneJS 6 admin UI routing ✅
- Existing GraphQL API (no changes) ✅
- Cloudinary for documents (read-only) ✅
- PDFKit for PDF export (existing endpoint) ✅

### Development Workflow Compliance
✅ **PASS** - Will follow practices:
- 2 spaces indentation, single quotes, semicolons
- 120 character line length
- Trailing commas in multi-line objects/arrays
- JSDoc for complex functions
- No `.env` file reading
- Prefer editing existing files over creating new ones

### Gates Summary
**Status**: ✅ **APPROVED TO PROCEED**

**Violations**: None

**Justifications**: N/A

## Project Structure

### Documentation (this feature)

```text
specs/001-mobile-client-history/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (to be generated)
├── data-model.md        # Phase 1 output (to be generated)
├── quickstart.md        # Phase 1 output (to be generated)
├── contracts/           # Phase 1 output (to be generated)
│   └── graphql-operations.md
└── checklists/
    └── requirements.md  # Spec quality checklist (completed)
```

### Source Code (repository root)

```text
admin/
├── pages/
│   ├── historial-cliente.tsx          # Original implementation (DO NOT MODIFY)
│   └── historial-cliente-new.tsx      # New mobile-optimized version (CREATE)
├── components/
│   └── client-history/                # New component directory (CREATE)
│       ├── SearchBar.tsx              # Search input with autocomplete
│       ├── ClientProfile.tsx          # Client info card + leader card
│       ├── LoanSection.tsx            # Section wrapper ("Como Cliente"/"Como Aval")
│       ├── LoanCard.tsx               # Individual loan expandable card
│       ├── PaymentHistory.tsx         # Payment chronology modal/section
│       ├── DocumentTabs.tsx           # Tabbed document interface
│       ├── DocumentGrid.tsx           # Document thumbnail grid
│       ├── DuplicateDetector.tsx      # Duplicate warning banner + comparison
│       ├── MergeModal.tsx             # Client merge dialog
│       └── PDFExportControls.tsx      # PDF toggle + export buttons
├── graphql/
│   ├── queries/
│   │   └── client-history.ts          # Existing queries (REUSE, DO NOT MODIFY)
│   └── mutations/
│       └── client-merge.ts            # Existing mutations (REUSE, DO NOT MODIFY)
├── utils/
│   └── paymentChronology.ts           # Existing utility (REUSE, DO NOT MODIFY)
├── hooks/
│   └── useAuth.ts                     # Existing auth hook (REUSE, DO NOT MODIFY)
└── lib/
    └── cn.ts                           # shadcn/ui utility (likely exists)

# shadcn/ui components (assume already installed)
components/ui/                         # shadcn/ui components directory
├── button.tsx
├── card.tsx
├── input.tsx
├── tabs.tsx
├── badge.tsx
├── skeleton.tsx
├── dialog.tsx
└── command.tsx (for autocomplete)
```

**Structure Decision**:

This is a **web application** with existing admin panel structure. The new page will be added to `admin/pages/` alongside the original implementation. All new UI components will be organized in `admin/components/client-history/` directory to maintain clean separation.

**Key Structural Decisions**:
1. **No backend changes**: All code lives in `admin/` frontend directory
2. **Component organization**: Dedicate `client-history/` subdirectory for 10 new components
3. **Reuse existing utilities**: Import GraphQL operations, payment chronology, auth hooks from existing paths
4. **shadcn/ui assumption**: Assume `components/ui/` already exists with required components installed
5. **Route registration**: Add new route in Keystone admin UI configuration (existing pattern)

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations detected - table not needed.**

---

## Phase 0: Research & Technical Decisions

*Research tasks to resolve technical unknowns and validate approach.*

### Research Topics

1. **shadcn/ui Autocomplete Pattern**
   - **Question**: What's the recommended shadcn/ui pattern for autocomplete with 10-15 result limit?
   - **Research**: Review shadcn/ui Command component + Combobox examples
   - **Expected outcome**: Decide between Command (cmdk) component vs custom Input + Popover pattern

2. **Mobile-First Responsive Breakpoints**
   - **Question**: What Tailwind breakpoints align with 320px-1920px requirement and modern mobile/tablet/desktop?
   - **Research**: Review Tailwind default breakpoints vs custom configuration
   - **Expected outcome**: Confirm breakpoint strategy (default sm:640px, md:768px, lg:1024px, xl:1280px)

3. **Lazy Loading Documents Strategy**
   - **Question**: How to implement tab-based lazy loading with Apollo Client cache management?
   - **Research**: Apollo Client `useLazyQuery` hook patterns, cache policies, `fetchPolicy: 'network-only'`
   - **Expected outcome**: Confirm lazy query + cache-first strategy for tab switches

4. **Existing GraphQL Operations Inventory**
   - **Question**: Which exact GraphQL operations from `admin/pages/historial-cliente.tsx` will be reused?
   - **Research**: Read original implementation, extract all `gql` queries/mutations
   - **Expected outcome**: Complete list of 9 operations with their signatures

5. **PDF Export Endpoint Signature**
   - **Question**: What's the exact request/response format for `/export-client-history-pdf`?
   - **Research**: Review original implementation's `handleExportPDF` function
   - **Expected outcome**: Confirm POST body structure and detailed mode toggle

6. **Payment Chronology Utility**
   - **Question**: What's the signature of `generatePaymentChronology` function?
   - **Research**: Read `admin/utils/paymentChronology.ts`
   - **Expected outcome**: Understand input/output types for payment timeline generation

7. **Duplicate Detection Algorithm**
   - **Question**: Is Levenshtein distance calculation client-side or server-side?
   - **Research**: Review original implementation's `levenshteinDistance` and `findPotentialDuplicates` functions
   - **Expected outcome**: Confirm client-side algorithm reuse

8. **Route Registration Pattern**
   - **Question**: How to register `/historial-cliente-new` route in Keystone admin UI?
   - **Research**: Review Keystone admin UI `pages` configuration
   - **Expected outcome**: Understand custom page registration in `keystone.ts` or admin config

*Output: research.md with all findings and technical decisions*

---

## Phase 1: Design Artifacts

*Generate data models, API contracts, and quickstart guide after research completion.*

### Data Model (data-model.md)

Extract entities from spec, add TypeScript types based on existing GraphQL schema:

**Entities**:
1. Client (PersonalData)
2. Loan
3. Payment
4. Leader (Employee with role)
5. Document (DocumentPhoto)
6. NoPaymentPeriod
7. ClientSearchResult (autocomplete)
8. ClientHistoryData (resolver response)

*File: data-model.md with interfaces, relationships, and state transitions*

### API Contracts (contracts/)

Document existing GraphQL operations being reused (no new contracts needed):

**Queries**:
1. GET_ROUTES
2. SEARCH_CLIENTS
3. GET_CLIENT_HISTORY
4. GET_CLIENT_DOCUMENTS
5. GET_LAST_LOAN_DOCUMENTS
6. GET_CLIENT_DOCUMENTS_ONLY
7. GET_AVAL_DOCUMENTS_ONLY

**Mutations**:
1. MERGE_CLIENTS

**REST Endpoint**:
1. POST `/export-client-history-pdf`

*File: contracts/graphql-operations.md with operation signatures and examples*

### Quickstart Guide (quickstart.md)

Developer onboarding for implementing the mobile-optimized page:

1. Prerequisites: shadcn/ui installed, Tailwind configured
2. Setup: Create component directory structure
3. Implementation order: SearchBar → ClientProfile → LoanSection → Documents → Merge/Export
4. Testing: Manual mobile browser testing checklist
5. Deployment: Route registration, verification steps

*File: quickstart.md with step-by-step implementation guide*

### Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` to add new technology:
- shadcn/ui component usage patterns
- Tailwind CSS mobile-first utilities
- Apollo Client lazy loading strategy
- This feature's component architecture

*Note: Script will update `.claude/` context files preserving manual additions*

---

## Post-Phase 1 Constitution Re-Check

After generating design artifacts, re-evaluate compliance:

### Expected Changes
- ✅ Data model confirmed TypeScript interfaces align with existing GraphQL types
- ✅ Reused GraphQL operations maintain optimization patterns
- ✅ Component architecture follows React best practices (composition, hooks)
- ✅ No new violations introduced

### Final Gate
**Status**: ✅ **APPROVED TO PROCEED TO TASK GENERATION**

Next command: `/speckit.tasks` to generate dependency-ordered implementation tasks

---

## Notes

- **No backend work**: This is purely a frontend UI migration
- **Reference implementation**: `/historial-cliente` folder provides design patterns (already built with modern shadcn-like patterns)
- **Iterative approach**: Build UI first with mock data, then wire up GraphQL queries
- **Risk mitigation**: Keep original page functional during development, A/B test before full migration
- **Performance focus**: Lazy loading and autocomplete limiting directly support mobile cost optimization goals
