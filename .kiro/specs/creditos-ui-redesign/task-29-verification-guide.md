# Task 29: Dropdown Positioning - Verification Guide

## How to Verify the Fix

### 1. Open the Transacciones Page
Navigate to the transacciones page in your browser.

### 2. Open the Create Credit Modal
Click the "Crear Crédito" button to open the modal.

### 3. Test Client Autocomplete (Mode: 'client')

#### Test 3.1: Basic Positioning
1. Click on the "Nombre del Cliente" input field
2. Type at least 2 characters (e.g., "Juan")
3. **Expected**: Dropdown appears directly below the input with a 4px gap
4. **Expected**: Dropdown width matches the input width exactly
5. **Expected**: Dropdown has rounded corners and shadow

#### Test 3.2: Scrolling Behavior
1. Open the dropdown by typing in the client name field
2. Scroll the modal content up and down
3. **Expected**: Dropdown stays aligned with the input field
4. **Expected**: Dropdown doesn't jump or reposition incorrectly

#### Test 3.3: Viewport Resize
1. Open the dropdown
2. Resize the browser window (make it smaller/larger)
3. **Expected**: Dropdown maintains correct position relative to input
4. **Expected**: Dropdown width adjusts with the input

### 4. Test Aval Autocomplete (Mode: 'aval')

#### Test 4.1: Basic Positioning
1. In the same credit entry, click on the "Nombre del Aval" input field
2. Type at least 2 characters (e.g., "Maria")
3. **Expected**: Dropdown appears directly below the aval input with a 4px gap
4. **Expected**: Dropdown width matches the input width exactly

#### Test 4.2: Multiple Credit Entries
1. Click "Agregar Otro Crédito" to add a second entry
2. Test the autocomplete in the second entry
3. **Expected**: Each dropdown appears below its respective input
4. **Expected**: Dropdowns don't overlap or interfere with each other

### 5. Test Z-Index Stacking

#### Test 5.1: Dropdown Above Other Elements
1. Open a dropdown
2. **Expected**: Dropdown appears above all other modal content
3. **Expected**: Dropdown appears above other credit entry cards
4. **Expected**: Dropdown shadow is visible and not clipped

### 6. Test Edge Cases

#### Test 6.1: Dropdown at Bottom of Modal
1. Add multiple credit entries (3-4 entries)
2. Scroll to the bottom entry
3. Open the autocomplete dropdown
4. **Expected**: Dropdown appears below the input
5. **Expected**: Dropdown is scrollable if it extends beyond viewport

#### Test 6.2: Long Results List
1. Type a common search term that returns many results
2. **Expected**: Dropdown has max-height of 300px
3. **Expected**: Dropdown is scrollable with custom scrollbar
4. **Expected**: Scrollbar appears on the right side

### 7. Visual Inspection Checklist

Use browser DevTools to inspect the dropdown element:

```css
/* Expected CSS properties */
.dropdown {
  position: absolute;           /* ✓ Not 'fixed' */
  top: calc(100% + 4px);       /* ✓ 4px below input */
  left: 0;                      /* ✓ Aligned to left edge */
  right: 0;                     /* ✓ Aligned to right edge */
  max-height: 300px;            /* ✓ Height constraint */
  z-index: 9999;                /* ✓ High stacking order */
}
```

### 8. Browser Compatibility

Test in multiple browsers:
- ✓ Chrome/Edge (Chromium)
- ✓ Firefox
- ✓ Safari

### 9. Common Issues to Watch For

❌ **Dropdown appears in wrong position**
- Check that parent container has `position: relative`
- Verify CSS is loaded correctly

❌ **Dropdown doesn't match input width**
- Check that `left: 0` and `right: 0` are applied
- Verify no conflicting width styles

❌ **Dropdown jumps when scrolling**
- Verify using `position: absolute` not `position: fixed`
- Check that no JavaScript is recalculating position

❌ **Dropdown appears behind other elements**
- Verify `z-index: 9999` is applied
- Check for conflicting z-index values in parent elements

### 10. Success Criteria

✅ Dropdown appears directly below input with 4px gap
✅ Dropdown width matches input width exactly
✅ Dropdown stays aligned when modal scrolls
✅ Dropdown works correctly in both client and aval modes
✅ Dropdown has proper z-index and appears above other elements
✅ Dropdown is scrollable when content exceeds max-height
✅ No JavaScript errors in console
✅ Smooth animations and transitions

## Debugging Tips

If you encounter issues:

1. **Open Browser DevTools**
   - Inspect the dropdown element
   - Check computed styles
   - Look for CSS conflicts

2. **Check Console for Errors**
   - Look for JavaScript errors
   - Check for React warnings

3. **Verify CSS Module Loading**
   - Check that `.module.css` file is loaded
   - Verify class names are correctly applied

4. **Test in Isolation**
   - Test with a single credit entry first
   - Add complexity gradually

## Related Files

- `admin/components/loans/ClientLoanUnifiedInput.tsx` - Component logic
- `admin/components/loans/ClientLoanUnifiedInput.module.css` - Dropdown styles
- `admin/components/loans/__tests__/ClientLoanUnifiedInput-dropdown-positioning.test.tsx` - Tests
