# Feature Specification: Mobile-Optimized Client History Page

**Feature Branch**: `001-mobile-client-history`
**Created**: 2025-12-02
**Status**: Draft
**Input**: User description: "Create a new version of admin/pages/historial-cliente.tsx at route /historial-cliente-new. This page must be optimized for mobile devices. The new version will use only shadcn/ui components, removing all references to Keystone components/CSS. Use the /historial-cliente folder code as UI reference. Create the functional UI first, then implement the logic from admin/pages/historial-cliente.tsx. Maintain all internal logic but modify the UI to be 100% functional."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Client Search and Basic Information Display (Priority: P1)

Loan officers need to quickly search for clients by name or unique code and view their basic profile information on mobile devices while in the field.

**Why this priority**: This is the core functionality that enables loan officers to identify and access client information. Without this, no other features can function.

**Independent Test**: Can be fully tested by entering a client name/code in the search field and verifying that the client profile displays with correct name, ID, phone, role badges, and assigned leader information on mobile devices (320px-480px width).

**Acceptance Scenarios**:

1. **Given** loan officer is on the client history page, **When** they type a client name in the search field (minimum 2 characters), **Then** autocomplete suggestions appear showing up to 10-15 matching clients with their key details (name, code, location, route) in modern shadcn/ui styled dropdown
2. **Given** search returns more than 15 matching clients, **When** autocomplete displays, **Then** system shows top 15 results plus message "Se encontraron más resultados, refina tu búsqueda"
3. **Given** loan officer selects a client from search results, **When** the page loads, **Then** client profile card displays with name, unique code, phone number, role badges (Client/Guarantor), and membership duration
4. **Given** client profile is displayed, **When** viewing on mobile device, **Then** all information is readable without horizontal scrolling and touch targets are minimum 44x44px
5. **Given** client has an assigned leader, **When** client profile loads, **Then** leader information card displays showing leader name, route, location, municipality, state, and phone number

---

### User Story 2 - Loan History Visualization (Priority: P1)

Loan officers need to view a client's complete loan history including active, completed, and renewed loans with payment status and progress tracking.

**Why this priority**: Viewing loan history is essential for making lending decisions and understanding client payment behavior. This is a primary use case for the page.

**Independent Test**: Can be tested by selecting a client and verifying that all loans display in chronological order with status badges, payment progress bars, amount details, and collapsible payment details on mobile devices.

**Acceptance Scenarios**:

1. **Given** a client with multiple loans is selected, **When** the page loads, **Then** loans display in two separate sections: "Préstamos como Cliente" (borrower loans) and "Préstamos como Aval" (guarantor loans), each showing expandable cards with loan date, status (Active/Completed/Renewed), and loan ID in chronological order (newest first)
2. **Given** a loan card is displayed, **When** viewing loan summary, **Then** four key metrics are visible: Amount Loaned, Total Amount, Amount Paid, and Remaining Balance
3. **Given** a loan has payment history, **When** viewing loan card, **Then** progress bar shows percentage paid with visual indicator
4. **Given** loan officer taps a loan card, **When** expanding the card, **Then** detailed payment history displays with payment chronology showing dates, amounts, and payment status
5. **Given** viewing on mobile device, **When** loan cards are displayed, **Then** cards stack vertically with adequate spacing and touch-friendly collapse/expand buttons

---

### User Story 3 - Document Access (Priority: P2)

Loan officers need to quickly view client and guarantor documents (ID, address proof, promissory notes) while verifying information in the field.

**Why this priority**: Document verification is important but can function after basic client lookup and loan viewing. Documents are accessed less frequently than loan information.

**Independent Test**: Can be tested by selecting a client, tapping the "Ver Documentos" button, and verifying that document thumbnails load for both client and guarantor roles with ability to view full-size images.

**Acceptance Scenarios**:

1. **Given** a client is selected, **When** viewing client profile, **Then** document count displays showing number of client documents and guarantor documents (counts only, no images loaded)
2. **Given** loan officer taps "Ver Documentos" button, **When** document section expands, **Then** tab interface appears with "Cliente" and "Aval" tabs (default to "Cliente" tab active)
3. **Given** viewing "Cliente" tab, **When** tab loads for first time, **Then** document thumbnails load on-demand and display in responsive grid (2 columns on mobile, auto-fill on larger screens)
4. **Given** loan officer switches to "Aval" tab, **When** tab loads for first time, **Then** aval document thumbnails load on-demand and display in responsive grid
5. **Given** loan officer taps a document thumbnail, **When** image is selected, **Then** full-size document opens in new browser tab for zooming and detailed viewing
6. **Given** viewing on mobile device, **When** document thumbnails are displayed, **Then** images are appropriately sized for quick recognition while maintaining good performance

---

### User Story 4 - Client Duplicate Detection and Merging (Priority: P3)

Administrators need to identify potential duplicate client records based on name similarity and merge them to maintain data integrity.

**Why this priority**: Duplicate management is an administrative task that doesn't block daily loan officer workflows. It's important for data quality but lower frequency use case.

**Independent Test**: Can be tested by searching for clients with similar names, verifying that potential duplicates are flagged with similarity percentage, and testing the merge workflow with primary/secondary client selection.

**Acceptance Scenarios**:

1. **Given** search results contain clients with similar names (>85% similarity), **When** results load, **Then** duplicate warning banner appears showing number of potential duplicates detected
2. **Given** potential duplicates are detected, **When** loan officer taps "Mostrar Duplicados" button, **Then** duplicate pairs display with similarity percentage and side-by-side client information
3. **Given** administrator selects "Fusionar" on a duplicate pair, **When** merge modal opens, **Then** both clients are pre-loaded with first client marked as primary
4. **Given** administrator confirms merge operation, **When** merge executes, **Then** success message displays and secondary client data is transferred to primary client record
5. **Given** viewing on mobile device, **When** duplicate comparison cards are displayed, **Then** client information stacks vertically with clear visual separation and readable similarity percentage

---

### User Story 5 - PDF Export (Priority: P3)

Loan officers and managers need to export client history as PDF reports for offline review, client meetings, or compliance documentation.

**Why this priority**: PDF export is a utility feature that enhances workflow but isn't required for core client lookup and loan viewing operations.

**Independent Test**: Can be tested by selecting a client, toggling between summary and detailed PDF modes, and verifying that PDF downloads with correct formatting and all client/loan information.

**Acceptance Scenarios**:

1. **Given** a client's history is displayed, **When** loan officer toggles "PDF detallado completo" checkbox, **Then** toggle state persists and PDF export button label updates to reflect mode
2. **Given** loan officer taps "Exportar PDF Resumen" button, **When** PDF generation completes, **Then** summary PDF downloads containing client profile, loan summary statistics, and basic loan list
3. **Given** loan officer taps "Exportar PDF Completo" button with detailed mode enabled, **When** PDF generation completes, **Then** detailed PDF downloads containing complete payment chronology for each loan
4. **Given** viewing on mobile device, **When** PDF export controls are displayed, **Then** checkbox and buttons are touch-friendly and clearly labeled
5. **Given** PDF export fails, **When** error occurs, **Then** user-friendly error message displays instructing to retry

---

### Edge Cases

- What happens when a client has no loans at all? System should display empty state message indicating no loan history found for this client.
- What happens when a client has loans as borrower but no loans as aval (or vice versa)? System should show both section headers: populated section displays loan cards, empty section shows header with message "No hay préstamos como [Cliente/Aval] para este cliente".
- How does system handle error when GraphQL query fails? Display error notice with retry option and maintain last successful state.
- What happens when autocomplete search returns zero results? Display "No se encontraron clientes" message with suggestion to try different search terms.
- How does system handle slow network on mobile? Display loading skeletons for each section being loaded and allow cancellation of long-running requests.
- What happens when viewing on very small screens (<320px)? Minimum viewport width of 320px enforced, below which horizontal scrolling is acceptable as graceful degradation.
- How does system handle documents that fail to load from Cloudinary? Display placeholder image with error icon and retry button.
- What happens when merging clients with conflicting data? Primary client data always takes precedence, secondary client data (loans, documents, payments) is appended.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a search input that filters clients by name or unique code with minimum 2 characters required for search activation
- **FR-002**: System MUST display autocomplete suggestions as user types (limited to top 10-15 results), showing client name, unique code, location, route, municipality, and state with modern shadcn/ui design (proper spacing, hover states, visual hierarchy), and display "Se encontraron más resultados, refina tu búsqueda" message when results exceed limit
- **FR-003**: System MUST display client profile card showing full name, unique code, phone numbers, role badges (Client/Guarantor), and membership start date
- **FR-004**: System MUST display assigned leader information including leader name, route, location, municipality, state, and phone number
- **FR-005**: System MUST display summary statistics showing total loans as client, total loans as guarantor, active loans count, and total/paid/pending amounts
- **FR-006**: System MUST display client loans in two separate sections: "Préstamos como Cliente" (borrower loans) and "Préstamos como Aval" (guarantor loans), each in expandable card format showing loan date, status badge, loan ID, week duration, chronologically ordered (newest first)
- **FR-007**: System MUST show four key loan metrics on each card: Amount Loaned, Total Amount Due, Amount Paid, and Remaining Balance
- **FR-008**: System MUST display visual progress bar showing percentage of loan amount paid
- **FR-009**: System MUST allow loan cards to expand/collapse to show detailed payment chronology with dates, amounts, and payment status
- **FR-010**: System MUST display document counts for client and guarantor roles in client profile (counts only, without loading actual images)
- **FR-011**: System MUST provide tabbed interface to view documents separately for "Cliente" and "Aval" roles, loading documents on-demand only when user explicitly accesses each tab
- **FR-012**: System MUST lazy-load document thumbnails when user switches to each tab (not pre-loaded), display in responsive grid layout (2 columns mobile, auto-fill desktop), and cache loaded images until client changes
- **FR-013**: System MUST allow clicking document thumbnails to open full-size images in new browser tab
- **FR-014**: System MUST detect potential duplicate clients based on name similarity (≥85% Levenshtein distance) when search results load
- **FR-015**: System MUST display duplicate warning banner showing count of potential duplicates detected
- **FR-016**: System MUST show duplicate comparison cards with similarity percentage and side-by-side client information
- **FR-017**: System MUST provide client merge workflow allowing administrator to select primary client and confirm merge operation
- **FR-018**: System MUST transfer secondary client's loans, documents, and payment history to primary client during merge
- **FR-019**: System MUST provide toggle to switch between summary and detailed PDF export modes
- **FR-020**: System MUST generate downloadable PDF containing client profile and loan history based on selected mode
- **FR-021**: System MUST provide "Limpiar" button to clear search and reset page state
- **FR-022**: System MUST display loading indicators during data fetching operations
- **FR-023**: System MUST display error messages when GraphQL operations fail with option to retry
- **FR-024**: System MUST be fully responsive supporting viewport widths from 320px to 1920px
- **FR-025**: System MUST use only shadcn/ui components and remove all Keystone UI component dependencies
- **FR-026**: System MUST maintain all existing GraphQL queries and mutations from original implementation
- **FR-027**: System MUST preserve all business logic including payment chronology calculation, status determination, and duplicate detection algorithms
- **FR-028**: System MUST be accessible at route /historial-cliente-new within the admin panel

### Key Entities

- **Client**: Represents a person who has taken loans or served as guarantor, with attributes including full name, unique code (clientCode), phone numbers, addresses, assigned leader, and relationship roles
- **Loan**: Represents a credit extended to a client, with attributes including sign date, loan type, amount requested, total amount due, interest, commission, status, week duration, rate, and associated payments
- **Payment**: Represents a payment made against a loan, with attributes including amount, received date, payment method, payment type, and balances before/after payment
- **Leader**: Represents a loan officer assigned to manage a client, with attributes including name, route, location, municipality, state, and phone
- **Document**: Represents uploaded document photos for client or guarantor, with attributes including title, description, photo URL, document type (INE/DOMICILIO/PAGARE), and error/missing flags
- **NoPaymentPeriod**: Represents a period where no payments were received, with attributes including start date, end date, and week count

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Loan officers can complete client search and view basic profile information in under 5 seconds on 4G mobile connection
- **SC-002**: Page remains fully functional and readable on mobile devices with viewport widths from 320px to 480px without horizontal scrolling
- **SC-003**: All touch targets (buttons, expandable cards, tabs) meet minimum 44x44px size for comfortable mobile interaction
- **SC-004**: Document thumbnails load and display within 3 seconds on mobile networks, with progressive loading for multiple documents
- **SC-005**: PDF export completes within 10 seconds for clients with up to 20 loans
- **SC-006**: Duplicate detection identifies potential duplicates with ≥85% name similarity in 100% of test cases
- **SC-007**: Client merge operation completes successfully without data loss in 100% of test cases
- **SC-008**: Page load time is under 2 seconds on mobile devices for initial render (before data fetching)
- **SC-009**: Zero Keystone UI component dependencies remain in the codebase - 100% migration to shadcn/ui components
- **SC-010**: All existing GraphQL queries return correct data with no regression from original implementation
- **SC-011**: Loan officers report improved mobile usability compared to original Keystone UI-based implementation (measured through user feedback)
- **SC-012**: Payment chronology displays accurately matching backend calculations in 100% of test cases

### Assumptions

- **AS-001**: shadcn/ui components are already installed and configured in the project with Tailwind CSS
- **AS-002**: GraphQL queries (GET_ROUTES, SEARCH_CLIENTS, GET_CLIENT_HISTORY, GET_CLIENT_DOCUMENTS, etc.) remain unchanged and return same data structure
- **AS-003**: Apollo Client is configured and available for GraphQL operations
- **AS-004**: Cloudinary integration for document storage is working and URLs are accessible
- **AS-005**: PDF generation endpoint `/export-client-history-pdf` exists and accepts same request format
- **AS-006**: Authentication and authorization logic (useAuth hook) is functional and provides isAdmin and canMergeClients flags
- **AS-007**: Payment chronology utility function `generatePaymentChronology` is available and working correctly
- **AS-008**: Mobile devices accessing the page have modern browsers supporting ES6+ JavaScript features
- **AS-009**: The page will be developed iteratively: first UI components with mock data, then integration with existing GraphQL logic
- **AS-010**: Original `/historial-cliente` route will remain functional during development and testing of new `/historial-cliente-new` route

### Dependencies

- **DEP-001**: shadcn/ui component library (Button, Card, Input, Tabs, Badge, Skeleton, Dialog components)
- **DEP-002**: Tailwind CSS for styling and responsive design utilities
- **DEP-003**: lucide-react for icon components
- **DEP-004**: Apollo Client (@apollo/client) for GraphQL operations
- **DEP-005**: Keystone Admin UI routing system for /historial-cliente-new route registration
- **DEP-006**: Backend GraphQL resolvers (searchClients, getClientHistory, getClientDocuments, mergeClients)
- **DEP-007**: Document storage on Cloudinary with accessible URLs
- **DEP-008**: PDF generation service endpoint with PDFKit backend implementation

### Constraints

- **CON-001**: Must maintain 100% functional parity with existing admin/pages/historial-cliente.tsx page
- **CON-002**: Cannot modify existing GraphQL schema or resolver implementations
- **CON-003**: Must remove all references to @keystone-ui/* components and replace with shadcn/ui equivalents
- **CON-004**: Must maintain responsive design supporting mobile-first approach (320px minimum width)
- **CON-005**: Cannot break existing route /historial-cliente during development
- **CON-006**: Must preserve all business logic including duplicate detection algorithms, payment calculations, and loan status determination
- **CON-007**: Must maintain accessibility standards (WCAG 2.1 Level AA) for all UI components
- **CON-008**: Must support modern mobile browsers (iOS Safari 14+, Android Chrome 90+)

## Clarifications

### Session 2025-12-02

- Q: When a user first navigates to `/historial-cliente-new`, should the page load all client search results immediately or require user input? → A: Start with empty state, require search input (minimum 2 characters per FR-001) before showing results. Display only one client at a time. Must show loans where the client is the borrower AND loans where the client is aval (guarantor).
- Q: When displaying loans for a client who has both borrower loans and aval (guarantor) loans, how should these be organized on the screen? → A: Separate into two sections: "Préstamos como Cliente" and "Préstamos como Aval", each with its own chronological list (newest first).
- Q: When viewing a client's documents, should the system automatically refresh/reload documents when switching between "Cliente" and "Aval" tabs, or load both sets once and cache them? → A: Lazy load each tab's documents only when user switches to that tab (on-demand), keep cached until client changes. Documents should NOT load automatically - only when user explicitly requests them via "Ver Documentos" button to reduce data transfer costs.
- Q: When a client has loans as borrower but NO loans as aval (or vice versa), how should the empty section be displayed? → A: Show section header with empty state message (e.g., "No hay préstamos como Aval para este cliente").
- Q: When search autocomplete returns many matching clients (e.g., searching "Maria" returns 50+ results), how should the system handle the result list? → A: Limit to top 10-15 results, show message "Se encontraron más resultados, refina tu búsqueda" if results exceed limit. Autocomplete must have clean, beautiful, modern design following shadcn/ui design patterns with proper spacing, hover states, and visual hierarchy.

## Out of Scope

- Modifying GraphQL schema or backend resolver logic
- Adding new features not present in original implementation
- Implementing real-time updates or websocket connections
- Supporting offline mode or Progressive Web App features
- Modifying authentication/authorization logic
- Adding new document types beyond INE/DOMICILIO/PAGARE
- Implementing document upload functionality (view-only)
- Creating admin settings or configuration panels
- Adding analytics or usage tracking
- Supporting Internet Explorer or legacy browsers
- Implementing keyboard shortcuts or advanced navigation
- Adding bulk operations (merge multiple clients simultaneously)
