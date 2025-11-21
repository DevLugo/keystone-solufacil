# Requirements Document

## Introduction

This specification defines the requirements for redesigning the CreditosTabNew component UI to match the provided mockups pixel-perfectly. The redesign focuses on modernizing the interface, improving the autocomplete component design consistency, adding proper validation feedback, and implementing toast notifications for user actions.

## Glossary

- **CreditosTabNew Component**: The main component that displays the list of granted credits and provides functionality to add new credits
- **CreateCreditModal Component**: The modal dialog used to add one or multiple new credits in bulk
- **ClientLoanUnifiedInput Component**: The autocomplete component used for searching and selecting clients and guarantors
- **Toast Notification**: A temporary message that appears on screen to provide feedback about user actions
- **Mockup**: The reference design images stored in `.kiro/specs/mockups/` that define the exact visual appearance
- **Credit Entry**: A single loan record containing client, guarantor, loan type, amounts, and commission information
- **Autocomplete Dropdown**: A search input component that suggests matching results as the user types
- **System**: The CreditosTabNew UI redesign implementation

## Requirements

### Requirement 1

**User Story:** As a user, I want the credits list interface to match the mockup design exactly, so that I have a consistent and modern user experience.

#### Acceptance Criteria

1. WHEN the CreditosTabNew Component displays the credits list THEN the System SHALL render all spacing, padding, font sizes, and colors exactly as shown in the mockup screenshots
2. WHEN the CreditosTabNew Component displays the credits table THEN the System SHALL use the exact column widths, row heights, and border styles from the mockup
3. WHEN the CreditosTabNew Component loads THEN the System SHALL apply the correct typography matching the mockup specifications
4. WHEN the CreditosTabNew Component displays monetary values THEN the System SHALL format them with proper currency symbols and two decimal places
5. WHEN the CreditosTabNew Component renders action buttons THEN the System SHALL use the exact button styles, sizes, and hover states from the mockup

### Requirement 2

**User Story:** As a user, I want the add credit modal to match the mockup design exactly, so that the interface is visually consistent and professional.

#### Acceptance Criteria

1. WHEN the CreateCreditModal Component opens THEN the System SHALL display the modal with exact dimensions, border radius, and shadow as shown in the mockup
2. WHEN the CreateCreditModal Component displays the modal header THEN the System SHALL render the title, subtitle, and close button with exact spacing and typography from the mockup
3. WHEN the CreateCreditModal Component displays credit entry cards THEN the System SHALL render them with the exact padding, margins, background color, and border styling from the mockup
4. WHEN the CreateCreditModal Component displays the modal footer THEN the System SHALL show totals and action buttons with exact layout and styling from the mockup
5. WHEN the CreateCreditModal Component contains multiple credit entries THEN the System SHALL maintain consistent spacing between cards as shown in the mockup

### Requirement 3

**User Story:** As a user, I want the autocomplete component to match the overall design system, so that all UI elements feel cohesive and professional.

#### Acceptance Criteria

1. WHEN the Autocomplete Dropdown appears THEN the System SHALL render it with border radius, shadow, and padding matching the modal design language
2. WHEN the Autocomplete Dropdown displays suggestions THEN the System SHALL render each item with the exact font size, weight, and spacing from the mockup
3. WHEN a user hovers over Autocomplete Dropdown items THEN the System SHALL apply hover effects consistent with the mockup design
4. WHEN a user selects a client or aval from the Autocomplete Dropdown THEN the System SHALL display the selected state with styling matching the mockup
5. WHEN the Autocomplete Dropdown displays badges THEN the System SHALL render them with colors, sizes, and spacing matching the mockup design

### Requirement 4

**User Story:** As a user, I want to see toast notifications when I add or delete credits, so that I receive immediate feedback about my actions.

#### Acceptance Criteria

1. WHEN a user successfully adds new credits THEN the System SHALL display a success Toast Notification with the count of credits added
2. WHEN a user deletes a Credit Entry THEN the System SHALL display a success Toast Notification confirming the deletion
3. IF an error occurs during credit creation THEN the System SHALL display an error Toast Notification with a descriptive message
4. IF an error occurs during credit deletion THEN the System SHALL display an error Toast Notification with a descriptive message
5. WHEN a Toast Notification appears THEN the System SHALL auto-dismiss it after 4 seconds and allow manual dismissal

### Requirement 5

**User Story:** As a user, I want proper validation feedback in the add credit modal, so that I understand what information is required before saving.

#### Acceptance Criteria

1. WHEN a user attempts to save with empty required fields THEN the System SHALL highlight the empty fields with a red border and display error messages
2. WHEN a user enters an invalid phone number THEN the System SHALL display a validation error below the phone input field
3. WHEN a user enters a monetary amount of zero or negative value THEN the System SHALL prevent saving and display a validation error
4. WHEN all required fields contain valid data THEN the System SHALL enable the save button and remove all error indicators
5. WHEN validation errors exist in the CreateCreditModal Component THEN the System SHALL display a summary message at the top indicating the number of incomplete entries

### Requirement 6

**User Story:** As a user, I want the autocomplete to provide clear visual feedback during search, so that I understand when the system is loading results.

#### Acceptance Criteria

1. WHEN a user types in the autocomplete field THEN the system SHALL display a loading indicator while searching for matches
2. WHEN search results are found THEN the system SHALL display them in a dropdown with smooth animation
3. WHEN no search results are found THEN the system SHALL display a "No se encontraron resultados" message in the dropdown
4. WHEN the search completes THEN the system SHALL remove the loading indicator and show results within 300ms
5. WHEN the user clears the autocomplete THEN the system SHALL reset the field and remove any selected values immediately

### Requirement 7

**User Story:** As a user, I want the "Agregar Otro Crédito" button to be visually consistent with the mockup, so that the interface maintains a professional appearance.

#### Acceptance Criteria

1. WHEN viewing the add another credit button THEN the system SHALL render it with dashed border styling matching the mockup
2. WHEN hovering over the add another credit button THEN the system SHALL apply the hover effect shown in the mockup
3. WHEN clicking the add another credit button THEN the system SHALL add a new empty credit entry card with smooth animation
4. WHEN a new credit entry is added THEN the system SHALL scroll to show the new entry card
5. WHEN the button is displayed THEN the system SHALL use the exact icon, text, and spacing from the mockup

### Requirement 8

**User Story:** As a user, I want the delete credit button to have proper confirmation, so that I don't accidentally delete credits.

#### Acceptance Criteria

1. WHEN a user clicks the delete button on a credit entry THEN the system SHALL display a confirmation dialog before deletion
2. WHEN the confirmation dialog appears THEN the system SHALL show the client name and amount being deleted
3. WHEN the user confirms deletion THEN the system SHALL remove the credit entry and show a success toast
4. WHEN the user cancels deletion THEN the system SHALL close the dialog and keep the credit entry unchanged
5. WHEN only one credit entry remains THEN the system SHALL disable the delete button to prevent removing all entries

### Requirement 9

**User Story:** As a developer, I want all styling to use CSS Modules, so that styles are scoped and maintainable.

#### Acceptance Criteria

1. WHEN implementing the redesign THEN the system SHALL use CSS Module files for all component styling
2. WHEN adding new styles THEN the system SHALL avoid inline styles except for dynamic values
3. WHEN naming CSS classes THEN the system SHALL use semantic names that describe the element's purpose
4. WHEN organizing CSS files THEN the system SHALL create separate module files for each component
5. WHEN styles are applied THEN the system SHALL ensure no style conflicts with other components

### Requirement 10

**User Story:** As a user, I want the calculated "Monto Entregado" field to update in real-time, so that I can see the delivered amount as I enter data.

#### Acceptance Criteria

1. WHEN a user enters a requested amount THEN the system SHALL immediately calculate and display the delivered amount
2. WHEN a user enters a commission amount THEN the system SHALL immediately update the delivered amount calculation
3. WHEN the delivered amount is calculated THEN the system SHALL format it as currency with proper decimal places
4. WHEN the delivered amount field is displayed THEN the system SHALL render it as read-only with styling matching the mockup
5. WHEN either amount or commission changes THEN the system SHALL update the total delivered amount in the footer within 100ms

### Requirement 11

**User Story:** As a user, I want to see a distinct visual state when creating a new client (not selecting from autocomplete), so that I can clearly distinguish between new and existing clients.

#### Acceptance Criteria

1. WHEN a user types a client name that doesn't match any autocomplete results THEN the system SHALL display the input with a blue border and blue-tinted background
2. WHEN creating a new client THEN the system SHALL show a visual indicator (blue styling) that this is a new client being created
3. WHEN the new client input is displayed THEN the system SHALL use the exact blue color scheme from the blue_design.png mockup
4. WHEN a user types in both name and phone fields for a new client THEN the system SHALL maintain the blue styling to indicate new client creation mode
5. WHEN the user clears the fields or selects an existing client from autocomplete THEN the system SHALL remove the blue styling and return to default state
