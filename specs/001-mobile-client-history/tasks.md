# Tasks: Mobile-Optimized Client History Page

**Feature Branch**: `001-mobile-client-history`
**Input**: Design documents from `/specs/001-mobile-client-history/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Tests**: Not requested in specification - manual testing will be performed on iOS Safari 14+ and Android Chrome 90+

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a **frontend-only** feature within existing KeystoneJS admin UI:
- All source code: `admin/` directory at repository root
- New components: `admin/components/client-history/`
- New page: `admin/pages/historial-cliente-new.tsx`
- Reused utilities: `admin/utils/`, `admin/graphql/`, `admin/hooks/`

---

## Phase 1: Setup (Component Structure)

**Purpose**: Create directory structure and verify dependencies for mobile-optimized page

- [ ] T001 Create component directory at admin/components/client-history/
- [ ] T002 [P] Verify shadcn/ui components installed (Button, Card, Input, Tabs, Badge, Skeleton, Dialog in admin/components/ui/)
- [ ] T003 [P] Verify lucide-react icon library available in package.json
- [ ] T004 [P] Verify Tailwind CSS configured with mobile-first breakpoints (tailwind.config.js)

---

## Phase 2: Foundational (Shared Components & Types)

**Purpose**: Core UI components and TypeScript types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create TypeScript interfaces file at admin/components/client-history/types.ts with Client, Loan, Payment, Leader, Document, ClientSearchResult interfaces based on existing GraphQL schema
- [ ] T006 [P] Create StatusBadge component in admin/components/client-history/StatusBadge.tsx for loan status display (Active/Completed/Renewed)
- [ ] T007 [P] Copy Levenshtein distance algorithm functions from admin/pages/historial-cliente.tsx to admin/components/client-history/duplicateDetection.ts (levenshteinDistance and findPotentialDuplicates)
- [ ] T008 Create main page skeleton at admin/pages/historial-cliente-new.tsx with basic layout, Apollo Client setup, and empty state

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Client Search and Basic Information Display (Priority: P1) 🎯 MVP

**Goal**: Enable loan officers to search for clients by name/code and view basic profile information on mobile devices

**Independent Test**: Enter client name in search field (minimum 2 characters), select from autocomplete, verify client profile displays with name, ID, phone, role badges, and leader information on mobile (320px-480px width)

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create SearchBar component in admin/components/client-history/SearchBar.tsx with autocomplete input following shadcn/ui Input + Popover pattern from admin/components/ui/autocomplete.tsx
- [ ] T010 [P] [US1] Create ClientProfile component in admin/components/client-history/ClientProfile.tsx with client info card layout (name, code, phone, role badges, membership duration) using shadcn/ui Card
- [ ] T011 [P] [US1] Create LeaderCard component in admin/components/client-history/LeaderCard.tsx displaying assigned leader information (name, route, location, municipality, state, phone)
- [ ] T012 [US1] Integrate SEARCH_CLIENTS GraphQL query in SearchBar component with useLazyQuery, implement 2-character minimum search activation, limit results to 10-15 with "Se encontraron más resultados" message
- [ ] T013 [US1] Integrate GET_CLIENT_HISTORY GraphQL query in main page (admin/pages/historial-cliente-new.tsx) triggered on client selection from autocomplete
- [ ] T014 [US1] Implement duplicate detection in SearchBar using findPotentialDuplicates function, display warning banner when duplicates detected (≥85% similarity)
- [ ] T015 [US1] Add responsive design for mobile (320px-480px) ensuring no horizontal scroll, 44x44px touch targets, and proper Tailwind breakpoints (sm:, md:, lg:)
- [ ] T016 [US1] Add loading skeletons using shadcn/ui Skeleton component for search and profile sections during GraphQL query execution
- [ ] T017 [US1] Add error handling with retry option for failed GraphQL queries, display user-friendly error messages

**Checkpoint**: At this point, User Story 1 should be fully functional - client search and profile display work independently on mobile devices

---

## Phase 4: User Story 2 - Loan History Visualization (Priority: P1)

**Goal**: Display client's complete loan history including active, completed, and renewed loans with payment status and progress tracking

**Independent Test**: Select a client, verify loans display in two separate sections (borrower/aval) with chronological order, status badges, payment progress bars, amount details, and collapsible payment details on mobile

### Implementation for User Story 2

- [ ] T018 [P] [US2] Create LoanSection component in admin/components/client-history/LoanSection.tsx as wrapper for "Préstamos como Cliente" and "Préstamos como Aval" sections with empty state handling
- [ ] T019 [P] [US2] Create LoanCard component in admin/components/client-history/LoanCard.tsx with expandable card pattern, four key metrics (Amount Loaned, Total Amount, Amount Paid, Remaining Balance), progress bar, and collapse/expand functionality
- [ ] T020 [P] [US2] Create PaymentHistory component in admin/components/client-history/PaymentHistory.tsx to display payment chronology with dates, amounts, and payment status using color coding
- [ ] T021 [US2] Import generatePaymentChronology utility from admin/utils/paymentChronology.ts, integrate into PaymentHistory component for chronology generation
- [ ] T022 [US2] Implement loan data parsing from GET_CLIENT_HISTORY response in admin/pages/historial-cliente-new.tsx, separate borrower loans vs aval loans into two arrays
- [ ] T023 [US2] Integrate LoanSection and LoanCard components into main page, display two sections with chronological sorting (newest first)
- [ ] T024 [US2] Add expand/collapse state management for loan cards, integrate PaymentHistory component to show when card expanded
- [ ] T025 [US2] Implement color coding for payment chronology items based on coverageType (FULL: green, COVERED_BY_SURPLUS: blue, PARTIAL: yellow, MISS: red)
- [ ] T026 [US2] Add responsive layout for mobile with vertical card stacking, adequate spacing (Stripe spacing scale: 8px, 12px, 16px), and touch-friendly buttons
- [ ] T027 [US2] Add loading skeletons for loan sections during data fetching
- [ ] T028 [US2] Handle edge cases: no loans display empty message, loans as borrower only (show empty aval section with message), loans as aval only (show empty borrower section with message)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - client search, profile, and complete loan history visualization functional on mobile

---

## Phase 5: User Story 3 - Document Access (Priority: P2)

**Goal**: Enable loan officers to view client and guarantor documents (ID, address proof, promissory notes) with lazy loading for cost optimization

**Independent Test**: Select a client, tap "Ver Documentos" button, verify document thumbnails load on-demand for both "Cliente" and "Aval" tabs with ability to view full-size images, confirm documents only load when explicitly requested

### Implementation for User Story 3

- [ ] T029 [P] [US3] Create DocumentTabs component in admin/components/client-history/DocumentTabs.tsx with shadcn/ui Tabs for "Cliente" and "Aval" tabs, default to "Cliente" tab active
- [ ] T030 [P] [US3] Create DocumentGrid component in admin/components/client-history/DocumentGrid.tsx with responsive grid layout (2 columns mobile, auto-fill desktop) for document thumbnails
- [ ] T031 [P] [US3] Add document count display to ClientProfile component showing client documents and guarantor documents counts (no images loaded)
- [ ] T032 [US3] Implement lazy loading for documents using useLazyQuery with GET_CLIENT_DOCUMENTS_ONLY and GET_AVAL_DOCUMENTS_ONLY queries, fetchPolicy: 'cache-first'
- [ ] T033 [US3] Add tab change handler in DocumentTabs component to trigger lazy queries only when user switches to each tab for first time
- [ ] T034 [US3] Integrate DocumentTabs and DocumentGrid components, display document thumbnails in responsive grid with proper image sizing for mobile performance
- [ ] T035 [US3] Implement full-size document viewing by opening photoUrl in new browser tab on thumbnail click
- [ ] T036 [US3] Add "Ver Documentos" button to ClientProfile component with expand/collapse state management for document section
- [ ] T037 [US3] Add loading skeletons for document thumbnails during lazy query execution
- [ ] T038 [US3] Handle edge cases: no documents display empty message, documents fail to load show placeholder with error icon and retry button, respect isError/isMissing flags from GraphQL response

**Checkpoint**: All core features now functional - search, profile, loans, and documents work independently with cost-optimized lazy loading

---

## Phase 6: User Story 4 - Client Duplicate Detection and Merging (Priority: P3)

**Goal**: Enable administrators to identify potential duplicate client records based on name similarity and merge them to maintain data integrity

**Independent Test**: Search for clients with similar names, verify duplicate warning banner appears with similarity percentage, test merge workflow with primary/secondary client selection and confirm data transfer

### Implementation for User Story 4

- [ ] T039 [P] [US4] Create DuplicateDetector component in admin/components/client-history/DuplicateDetector.tsx with duplicate warning banner and "Mostrar Duplicados" button
- [ ] T040 [P] [US4] Create DuplicateComparison component in admin/components/client-history/DuplicateComparison.tsx with side-by-side client information cards and similarity percentage display
- [ ] T041 [P] [US4] Create MergeModal component in admin/components/client-history/MergeModal.tsx using shadcn/ui Dialog with primary/secondary client selection and merge confirmation
- [ ] T042 [US4] Integrate DuplicateDetector component into main page, display banner when findPotentialDuplicates returns results after search
- [ ] T043 [US4] Implement duplicate comparison view showing all duplicate pairs with similarity percentages sorted descending
- [ ] T044 [US4] Add merge workflow using MERGE_CLIENTS GraphQL mutation with primary/secondary client ID variables
- [ ] T045 [US4] Implement success message display after merge operation, refresh client list to reflect merged data
- [ ] T046 [US4] Add authorization check using useAuth hook to verify isAdmin and canMergeClients flags before allowing merge operation
- [ ] T047 [US4] Add responsive layout for mobile with vertical stacking of duplicate comparison cards and readable similarity percentages
- [ ] T048 [US4] Handle edge cases: merge failure display error message with retry option, conflicting data resolution (primary takes precedence)

**Checkpoint**: Duplicate management functional - administrators can detect and merge duplicate client records

---

## Phase 7: User Story 5 - PDF Export (Priority: P3)

**Goal**: Enable loan officers and managers to export client history as PDF reports for offline review, client meetings, or compliance documentation

**Independent Test**: Select a client, toggle between summary and detailed PDF modes, verify PDF downloads with correct formatting and all client/loan information within 10 seconds for clients with up to 20 loans

### Implementation for User Story 5

- [ ] T049 [P] [US5] Create PDFExportControls component in admin/components/client-history/PDFExportControls.tsx with checkbox for "PDF detallado completo" toggle and two export buttons
- [ ] T050 [US5] Integrate PDFExportControls into main page below client profile section
- [ ] T051 [US5] Implement PDF export handler function calling POST /export-client-history-pdf endpoint with client data and detailed flag from toggle state
- [ ] T052 [US5] Construct request body from historyResult state including clientId, clientName, clientDui (clientCode), clientPhones, clientAddresses, loans array, leaderInfo, and detailed boolean
- [ ] T053 [US5] Implement blob response handling for PDF download with proper Content-Type and file name
- [ ] T054 [US5] Add loading indicator during PDF generation, disable export buttons to prevent duplicate requests
- [ ] T055 [US5] Update export button labels based on toggle state ("Exportar PDF Resumen" vs "Exportar PDF Completo")
- [ ] T056 [US5] Add responsive layout for mobile with touch-friendly checkbox (44x44px) and clearly labeled buttons
- [ ] T057 [US5] Handle edge cases: PDF export failure display user-friendly error message with retry instruction, timeout after 15 seconds for slow generation

**Checkpoint**: All user stories complete - full feature parity with original implementation achieved

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories and production readiness

- [ ] T058 [P] Add "Limpiar" button to SearchBar component to clear search and reset page state (FR-021)
- [ ] T059 [P] Implement Vercel-inspired gradients and shadows for modern design (linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%), 0 10px 15px -3px rgb(0 0 0 / 0.1))
- [ ] T060 [P] Apply Linear-inspired transitions (150-200ms, cubic-bezier) to all interactive elements (buttons, cards, tabs)
- [ ] T061 [P] Verify Stripe spacing scale compliance (4px, 8px, 12px, 16px, 20px, 24px) across all components
- [ ] T062 [P] Add WCAG 2.1 Level AA accessibility compliance checks (color contrast, keyboard navigation, ARIA labels)
- [ ] T063 Code cleanup: remove unused imports/variables, verify TypeScript strict mode compliance, run ESLint
- [ ] T064 Verify zero @keystone-ui/* imports remain in codebase (SC-009)
- [ ] T065 [P] Add JSDoc comments to complex functions (generatePaymentChronology integration, duplicate detection)
- [ ] T066 Test page load performance on mobile (target <2s initial render, <5s search completion on 4G)
- [ ] T067 Test all features on iOS Safari 14+ and Android Chrome 90+ across viewport widths 320px-1920px
- [ ] T068 [P] Optionally add page to CustomNavigation.tsx menu under "Clientes" section with "Historial de Clientes (Móvil)" label
- [ ] T069 Final validation: verify all 28 functional requirements (FR-001 to FR-028) met
- [ ] T070 Final validation: verify all 12 success criteria (SC-001 to SC-012) achievable

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories CAN proceed in parallel if multiple developers available
  - OR sequentially in priority order: US1 (P1) → US2 (P1) → US3 (P2) → US4 (P3) → US5 (P3)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ **MVP READY**
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 for client selection but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 for client selection but independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Depends on US1 for search results but independently testable
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Depends on US1+US2 for client/loan data but independently testable

### Within Each User Story

- Components marked [P] can be built in parallel (different files)
- Integration tasks depend on component completion
- Responsive design and error handling come after core functionality
- Each story should be fully functional before moving to next priority

### Parallel Opportunities

- **Phase 1**: All 4 tasks can run in parallel (T002, T003, T004)
- **Phase 2**: T006, T007 can run in parallel
- **Phase 3 (US1)**: T009, T010, T011 can run in parallel (different component files)
- **Phase 4 (US2)**: T018, T019, T020 can run in parallel (different component files)
- **Phase 5 (US3)**: T029, T030, T031 can run in parallel (different component files)
- **Phase 6 (US4)**: T039, T040, T041 can run in parallel (different component files)
- **Phase 7 (US5)**: T049 standalone component
- **Phase 8**: T058-T062, T065, T068 can run in parallel (different concerns)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 components together:
Task: "Create SearchBar component in admin/components/client-history/SearchBar.tsx"
Task: "Create ClientProfile component in admin/components/client-history/ClientProfile.tsx"
Task: "Create LeaderCard component in admin/components/client-history/LeaderCard.tsx"

# Then integrate sequentially:
Task: "Integrate SEARCH_CLIENTS GraphQL query in SearchBar component"
Task: "Integrate GET_CLIENT_HISTORY GraphQL query in main page"
# ... etc
```

---

## Parallel Example: User Story 2

```bash
# Launch all US2 components together:
Task: "Create LoanSection component in admin/components/client-history/LoanSection.tsx"
Task: "Create LoanCard component in admin/components/client-history/LoanCard.tsx"
Task: "Create PaymentHistory component in admin/components/client-history/PaymentHistory.tsx"

# Then integrate sequentially:
Task: "Import generatePaymentChronology utility, integrate into PaymentHistory"
Task: "Implement loan data parsing from GET_CLIENT_HISTORY response"
# ... etc
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) 🎯

1. Complete Phase 1: Setup (verify dependencies)
2. Complete Phase 2: Foundational (types, shared components) - CRITICAL
3. Complete Phase 3: User Story 1 (search + profile)
4. **STOP and VALIDATE**: Test US1 independently on mobile devices (320px-480px)
5. Deploy to staging/demo if ready

**Result**: Loan officers can search for clients and view basic profile information on mobile - core value delivered!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! 🎯)
3. Add User Story 2 → Test independently → Deploy/Demo (Loans visualization added)
4. Add User Story 3 → Test independently → Deploy/Demo (Documents added)
5. Add User Story 4 → Test independently → Deploy/Demo (Duplicate management added)
6. Add User Story 5 → Test independently → Deploy/Demo (PDF export added)
7. Polish phase → Final production release

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With 2-3 developers after Foundational phase completes:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (search + profile)
   - Developer B: User Story 2 (loan history)
   - Developer C: User Story 3 (documents)
3. Stories complete independently, integrate into main page
4. Continue with US4 and US5 as capacity allows

---

## Notes

- **[P] tasks**: Different files, no dependencies - safe to parallelize
- **[Story] label**: Maps task to specific user story for traceability
- **Each user story independently testable**: Select client → verify story works
- **No backend changes**: All GraphQL queries/mutations reused from admin/pages/historial-cliente.tsx
- **Reference implementation**: `/historial-cliente` folder provides UI design patterns
- **Iterative approach**: Build UI components first, then wire up GraphQL integration
- **Original page preserved**: `/historial-cliente` route remains functional during development
- **Mobile-first**: Test on mobile devices throughout development (iOS Safari 14+, Android Chrome 90+)
- **Performance focus**: Lazy loading (US3), autocomplete limiting (US1), cost optimization
- **Commit strategy**: Commit after each task or logical component group
- **Stop at any checkpoint**: Validate story independently before proceeding

---

## Total Task Count: 70 tasks

- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 4 tasks
- **Phase 3 (US1 - P1)**: 9 tasks 🎯 MVP
- **Phase 4 (US2 - P1)**: 11 tasks
- **Phase 5 (US3 - P2)**: 10 tasks
- **Phase 6 (US4 - P3)**: 10 tasks
- **Phase 7 (US5 - P3)**: 9 tasks
- **Phase 8 (Polish)**: 13 tasks

**Parallel opportunities**: 15+ tasks marked [P] across all phases

**Suggested MVP scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1) = 17 tasks for functional mobile client search and profile display
