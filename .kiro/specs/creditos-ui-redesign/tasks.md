# Implementation Plan

- [x] 1. Set up toast notification system
  - Create toast context and provider
  - Implement toast component with CSS Module
  - Add toast container to app root
  - Support success, error, warning, and info types
  - Implement auto-dismiss after 4 seconds
  - Add manual dismiss functionality
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 1.1 Write property test for toast auto-dismiss
  - **Property 6: Toast auto-dismiss behavior**
  - **Validates: Requirements 4.5**

- [x] 2. Create base UI component styles matching mockup
  - Create button.module.css with primary, secondary, and ghost variants
  - Create input.module.css with focus states and error styling
  - Create select.module.css matching input styling
  - Ensure all measurements match mockup exactly (padding, font-size, border-radius)
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 3. Implement currency formatting utility
  - Create formatCurrency function with MXN locale
  - Ensure 2 decimal places always displayed
  - Handle edge cases (0, negative, very large numbers)
  - _Requirements: 1.4_

- [ ]* 3.1 Write property test for currency formatting
  - **Property 1: Currency formatting consistency**
  - **Validates: Requirements 1.4**

- [x] 4. Update CreateCreditModal layout and styling
  - Update modal overlay and container styles to match mockup
  - Implement modal header with exact spacing and typography
  - Create credit entry card component with 2-column layout
  - Style modal footer with totals display
  - Ensure all padding, margins, and border-radius match mockup
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 5. Redesign autocomplete dropdown
  - Create ClientLoanUnifiedInput.module.css
  - Style dropdown container with exact shadow and border-radius
  - Implement dropdown item layout (content left, badges right)
  - Style badges with semantic colors
  - Add custom scrollbar styling
  - Ensure font sizes match mockup (12px names, 10px badges)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Implement form validation logic
  - Create validation utility functions
  - Add required field validation
  - Add phone number format validation (10 digits)
  - Add amount validation (positive numbers only)
  - Return structured error objects
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 6.1 Write property test for required field validation
  - **Property 7: Required field validation**
  - **Validates: Requirements 5.1**

- [ ]* 6.2 Write property test for phone validation
  - **Property 8: Phone number validation**
  - **Validates: Requirements 5.2**

- [ ]* 6.3 Write property test for amount validation
  - **Property 9: Amount validation**
  - **Validates: Requirements 5.3**

- [x] 7. Add validation UI to CreateCreditModal
  - Display inline errors below fields with red text
  - Add red border to invalid fields
  - Show validation summary at top of modal
  - Enable/disable save button based on validation state
  - Clear errors when fields become valid
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 7.1 Write property test for valid form enables save
  - **Property 10: Valid form enables save**
  - **Validates: Requirements 5.4**

- [ ]* 7.2 Write property test for validation summary
  - **Property 11: Validation summary display**
  - **Validates: Requirements 5.5**

- [x] 8. Implement autocomplete loading states
  - Add loading indicator to autocomplete
  - Show loading while search is in progress
  - Remove loading when results arrive
  - Style loading spinner to match design
  - _Requirements: 6.1, 6.4_

- [ ]* 8.1 Write property test for loading indicator
  - **Property 12: Loading indicator on search**
  - **Validates: Requirements 6.1**

- [ ]* 8.2 Write property test for loading indicator removal
  - **Property 13: Loading indicator removal**
  - **Validates: Requirements 6.4**

- [x] 9. Add autocomplete empty and clear states
  - Display "No se encontraron resultados" when no matches
  - Implement clear functionality to reset field
  - Ensure clear removes selected values
  - _Requirements: 6.3, 6.5_

- [ ]* 9.1 Write property test for clear autocomplete
  - **Property 14: Clear autocomplete resets field**
  - **Validates: Requirements 6.5**

- [x] 10. Style "Agregar Otro Crédito" button
  - Apply dashed border styling
  - Add hover effects
  - Ensure icon and text spacing matches mockup
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 11. Implement add credit entry functionality
  - Add new empty entry to list on button click
  - Scroll to show new entry after adding
  - Maintain consistent spacing between entries
  - _Requirements: 7.3, 7.4_

- [ ]* 11.1 Write property test for add credit entry
  - **Property 15: Add credit entry increases count**
  - **Validates: Requirements 7.3**

- [ ]* 11.2 Write property test for scroll to new entry
  - **Property 16: Scroll to new entry**
  - **Validates: Requirements 7.4**

- [x] 12. Implement delete confirmation dialog
  - Create confirmation dialog component
  - Show dialog on delete button click
  - Display client name and amount in dialog
  - Handle confirm and cancel actions
  - _Requirements: 8.1, 8.2_

- [ ]* 12.1 Write property test for delete confirmation
  - **Property 17: Delete confirmation dialog**
  - **Validates: Requirements 8.1**

- [ ]* 12.2 Write property test for confirmation content
  - **Property 18: Confirmation dialog content**
  - **Validates: Requirements 8.2**

- [x] 13. Implement delete functionality with toast
  - Remove entry on confirmed deletion
  - Show success toast after deletion
  - Keep entry unchanged on cancel
  - Disable delete button when only one entry remains
  - _Requirements: 8.3, 8.4, 8.5_

- [ ]* 13.1 Write property test for confirmed deletion
  - **Property 19: Confirmed deletion removes entry**
  - **Validates: Requirements 8.3**

- [ ]* 13.2 Write property test for cancelled deletion
  - **Property 20: Cancelled deletion preserves entry**
  - **Validates: Requirements 8.4**

- [ ]* 13.3 Write property test for minimum entry count
  - **Property 21: Minimum entry count enforcement**
  - **Validates: Requirements 8.5**

- [x] 14. Implement real-time amount calculations
  - Calculate delivered amount when requested amount changes
  - Update delivered amount when commission changes
  - Format calculated amounts as currency
  - Display delivered amount as read-only
  - Update footer totals on any change
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 14.1 Write unit tests for real-time amount calculations
  - Test delivered amount calculation for new loans
  - Test delivered amount calculation for renewals
  - Test commission updates
  - Test currency formatting
  - Test footer total updates
  - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [ ]* 14.2 Write property test for delivered amount calculation
  - **Property 22: Real-time delivered amount calculation**
  - **Validates: Requirements 10.1**

- [ ]* 14.3 Write property test for commission updates
  - **Property 23: Commission updates delivered amount**
  - **Validates: Requirements 10.2**

- [ ]* 14.4 Write property test for delivered amount formatting
  - **Property 24: Delivered amount formatting**
  - **Validates: Requirements 10.3**

- [ ]* 14.5 Write property test for footer total updates
  - **Property 25: Footer total updates on change**
  - **Validates: Requirements 10.5**

- [x] 15. Integrate toast notifications with credit actions
  - Show success toast on credit save with count
  - Show success toast on credit delete
  - Show error toast on save failure
  - Show error toast on delete failure
  - Pass descriptive error messages to toasts
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 15.1 Write property test for success toast on save
  - **Property 2: Toast on successful credit addition**
  - **Validates: Requirements 4.1**

- [ ]* 15.2 Write property test for success toast on delete
  - **Property 3: Toast on credit deletion**
  - **Validates: Requirements 4.2**

- [ ]* 15.3 Write property test for error toast on save failure
  - **Property 4: Error toast on creation failure**
  - **Validates: Requirements 4.3**

- [ ]* 15.4 Write property test for error toast on delete failure
  - **Property 5: Error toast on deletion failure**
  - **Validates: Requirements 4.4**

- [x] 16. Update CreditosTabNew table styling
  - Apply exact column widths from mockup
  - Update row heights and cell padding
  - Style table borders and shadows
  - Ensure font sizes match mockup
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 17. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Final visual polish and pixel-perfect adjustments
  - Compare implementation with mockup screenshots
  - Adjust any spacing, padding, or sizing discrepancies
  - Verify all colors match exactly
  - Test hover states and transitions
  - Ensure responsive behavior
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 19. Clean up unused code and imports
  - Remove any unused CSS classes
  - Remove unused imports
  - Remove commented-out code
  - Ensure all CSS Modules are properly scoped
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 20. Write unit tests for validation utilities
  - Test validateRequired function
  - Test validatePhone function
  - Test validateAmount function
  - Test validateLoanData function
  - Test combineValidations function
  - Test getFieldError and hasFieldError helpers
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 21. Add ToastProvider to transacciones page
  - Import ToastProvider from admin/components/ui/toast
  - Wrap TransaccionesPageContent with ToastProvider in TransaccionesPage component
  - Ensure ToastProvider is inside BalanceRefreshProvider
  - Test that toast notifications work correctly on the page
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 22. Verify ToastProvider integration
  - Navigate to transacciones page and verify no runtime errors
  - Test creating a credit and verify success toast appears
  - Test deleting a credit and verify success toast appears
  - Test error scenarios and verify error toasts appear
  - Verify toasts auto-dismiss after 4 seconds
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 23. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. Fix Select component usage errors
  - Fix Select component in CreditosTabNew to use options prop instead of children
  - Ensure all Select components pass required options array
  - Verify no runtime errors related to Select component
  - _Requirements: 9.1, 9.2_

- [x] 25. Pixel-perfect mockup alignment - CreateCreditModal
  - Review mockup images in .kiro/specs/mockups/ directory
  - Adjust modal dimensions to match mockup exactly (width, max-height, padding)
  - Fix credit card heights, padding, and spacing to match mockup
  - Adjust input field heights (should be more compact, ~36-40px)
  - Fix font sizes across all elements (labels, inputs, buttons)
  - Adjust spacing between form fields (should be tighter, ~12-16px gaps)
  - Fix button sizes and padding to match mockup
  - Adjust validation error message styling and positioning
  - Fix footer totals display (font sizes, spacing, alignment)
  - Ensure all border-radius values match mockup (8-12px range)
  - Verify all colors match design tokens exactly
  - Test with actual data to ensure layout holds
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 26. Fix autocomplete name input border thickness
  - Review mockup screenshot "Captura de pantalla 2025-11-19 a la(s) 11.30.09 a.m..png"
  - Adjust border thickness of name input in ClientLoanUnifiedInput to match mockup
  - Ensure border thickness is consistent with other inputs in the design system
  - Update ClientLoanUnifiedInput.module.css with correct border width
  - Test with different states (focused, filled, empty)
  - _Requirements: 1.1, 1.2, 3.1_

- [x] 27. Fix autocomplete phone display layout
  - Review mockup code in .kiro/specs/mockups/example.html
  - Review mockup screenshot "Captura de pantalla 2025-11-19 a la(s) 11.30.09 a.m..png"
  - Update ClientLoanUnifiedInput to show phone number on a separate row below the name when no autocomplete item is selected
  - Current behavior: phone is inline with name in same row
  - Expected behavior: phone appears below name in dropdown items (as shown in mockup)
  - Update dropdown item layout to match mockup structure
  - Ensure proper spacing and alignment
  - Test with different name lengths and phone formats
  - The input height must be higher, similar to the "monto solicitado" input
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 28. Style delete confirmation dialog buttons
  - Add proper styling to AlertDialogCancel and AlertDialogAction buttons in CreateCreditModal
  - Cancel button: secondary style (white background, gray border, gray text)
  - Delete button: danger style (red background, white text)
  - Match button heights and padding with other buttons in the modal (~38px height)
  - Add hover states matching design system
  - Ensure buttons are properly aligned in footer
  - Create alert-dialog.module.css if needed for custom styling
  - _Requirements: 1.5, 8.1, 8.2_

- [x] 29. Fix autocomplete dropdown positioning
  - Fix dropdown positioning in ClientLoanUnifiedInput to appear directly below the input
  - Current issue: dropdown appears in wrong position (not aligned with input)
  - Update dropdown positioning logic to use relative positioning instead of fixed
  - Calculate correct top position based on input element's position
  - Ensure dropdown width matches input width exactly
  - Add proper z-index to ensure dropdown appears above other elements
  - Test dropdown positioning with scrolling and different viewport sizes
  - Verify dropdown stays aligned when modal content scrolls
  - _Requirements: 3.1, 3.2, 6.2_

- [x] 30. Implement blue design for new client creation
  - Review blue_design.png mockup in .kiro/specs/mockups/ directory
  - Add "new client" state detection in ClientLoanUnifiedInput component
  - Detect when user is typing a name that doesn't match any autocomplete results
  - Apply blue border styling when creating new client (border: 1px solid #3B82F6)
  - Apply blue-tinted background when creating new client (background: #EFF6FF or similar light blue)
  - Ensure blue styling applies to both name and phone input fields
  - Add smooth transition when switching between states (default → new client → selected)
  - Update getStateColor function to include "newClient" state
  - Extract exact blue colors from blue_design.png mockup
  - Test state transitions: empty → typing new → selecting existing → clearing
  - Ensure blue styling is visually distinct from other states (green for selected, yellow for edited)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]* 30.1 Write property test for new client state detection
  - **Property 26: New client state detection**
  - **Validates: Requirements 11.1, 11.2**

- [ ]* 30.2 Write property test for blue styling application
  - **Property 27: Blue styling for new clients**
  - **Validates: Requirements 11.3, 11.4**

- [ ]* 30.3 Write property test for state transitions
  - **Property 28: State transition consistency**
  - **Validates: Requirements 11.5**

- [x] 31. Implement location validation for client and guarantor selection
  - Fix undefined location being passed from CreditosTabNew to CreateCreditModalNew
  - Pass the leader's location correctly to the modal
  - When a client is selected from autocomplete, fetch the client's leader information
  - Compare the selected client's leader location with the current leader's location
  - When an aval is selected from autocomplete, fetch the aval's leader information
  - Compare the selected aval's leader location with the current leader's location
  - If locations differ, display a small confirmation modal warning about the location discrepancy
  - Allow user to proceed or cancel the selection after seeing the warning
  - Ensure the warning is informational, not blocking (user can still proceed)
  - _Requirements: Data validation and user feedback_

- [x] 32. Handle cross-guarantor (swapped roles) edge case
  - **Scenario**: Credit 1: A (Titular) / B (Aval) AND Credit 2: B (Titular) / A (Aval)
  - Ensure system does NOT create duplicate `PersonalData` records
  - Verify existing persons are correctly identified by name/phone even if roles are swapped
  - Ensure single `PersonalData` ID is used for Client A in both roles, and Client B in both roles
  - _Requirements: Data integrity, Duplicate prevention_

- [x] 33. Handle new client batch deduplication
  - **Scenario**: New client A appears multiple times in batch (e.g., as Titular in Credit 1 and Aval in Credit 2)
  - Ensure `PersonalData` is created exactly once for Client A
  - First occurrence triggers creation; subsequent occurrences reuse the new ID
  - Implement deduplication logic within the mutation or pre-processing
  - _Requirements: Data integrity, Duplicate prevention_
