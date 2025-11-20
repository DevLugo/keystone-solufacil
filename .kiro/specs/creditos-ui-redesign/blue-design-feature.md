# Blue Design Feature - New Client Creation State

## Overview

This document describes the new feature for visually distinguishing when a user is creating a new client (not selecting from autocomplete) using a blue color scheme as shown in `blue_design.png`.

## Feature Description

When a user types a client name that doesn't match any existing clients in the autocomplete dropdown, the input fields should display a distinct **blue state** to clearly indicate that a new client is being created.

## Visual Design

### Colors
- **Border**: `#3B82F6` (blue-600)
- **Background**: `#EFF6FF` (blue-50)
- **Focus Ring**: `rgba(37, 99, 235, 0.15)` (blue-600 with 15% opacity)

### State Trigger
The blue state is triggered when:
1. User has typed at least 2 characters in the name field
2. No autocomplete results match the typed text
3. User is actively creating a new client entry

### Visual Appearance
```
┌────────────────────────────────────────────────┐
│ JUAN PEREZ NUEVO                               │ ← Blue border + light blue background
└────────────────────────────────────────────────┘
┌────────────────────────────────────────────────┐
│ 5551234567                                     │ ← Blue border + light blue background
└────────────────────────────────────────────────┘
```

## State Priority

The autocomplete component can be in multiple states. The priority order is:

1. **Selected** (Green) - Client selected from autocomplete
2. **Edited** (Yellow) - Existing client data modified
3. **New Client** (Blue) - Creating new client (no autocomplete match)
4. **Renewed** (Blue) - Renewing existing loan
5. **Default** (Gray) - Empty or focused without data

## Implementation Details

### Component: ClientLoanUnifiedInput

**State Detection:**
```typescript
const isNewClient = 
  inputValue.length >= 2 && 
  !isLoading && 
  searchResults.length === 0 && 
  !selectedClient;
```

**CSS Classes:**
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

### State Transitions

**Empty → New Client:**
- User types 2+ characters
- No autocomplete matches found
- Apply blue styling

**New Client → Selected:**
- User selects from autocomplete
- Remove blue styling
- Apply green styling

**New Client → Empty:**
- User clears the input
- Remove blue styling
- Return to default gray styling

## User Experience

### Benefits
1. **Clear Visual Feedback**: Users immediately know they're creating a new client
2. **Reduced Errors**: Less confusion between selecting existing vs creating new
3. **Consistent Design**: Follows the established color-coded state system
4. **Professional Look**: Modern, polished interface matching design system

### User Flow
1. User opens "Crear Crédito" modal
2. User starts typing client name
3. If no matches found → Blue state appears
4. User continues entering phone and other details
5. Blue state persists until client is saved or cleared

## Requirements

See **Requirement 11** in `requirements.md`:
- 11.1: Blue border and background when no autocomplete match
- 11.2: Visual indicator for new client creation
- 11.3: Exact blue colors from mockup
- 11.4: Blue styling on both name and phone fields
- 11.5: State transitions work correctly

## Tasks

See **Task 30** in `tasks.md`:
- Implement state detection logic
- Apply blue styling
- Update getStateColor function
- Add smooth transitions
- Write property tests

## Testing

### Manual Testing
1. Open CreateCreditModal
2. Type a name that doesn't exist (e.g., "NUEVO CLIENTE TEST")
3. Verify blue border and background appear
4. Type phone number
5. Verify blue styling persists
6. Clear fields
7. Verify blue styling is removed

### Property Tests
- Property 26: New client state detection
- Property 27: Blue styling application
- Property 28: State transition consistency

## References

- **Mockup**: `.kiro/specs/mockups/blue_design.png`
- **Requirements**: `requirements.md` - Requirement 11
- **Tasks**: `tasks.md` - Task 30
- **Design**: `design.md` - Section 3 (Autocomplete Component)
