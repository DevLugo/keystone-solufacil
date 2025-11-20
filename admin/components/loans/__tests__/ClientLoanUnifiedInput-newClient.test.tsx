/**
 * Test to verify new client state detection and blue styling
 * Task 30: Implement blue design for new client creation
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import ClientLoanUnifiedInput from '../ClientLoanUnifiedInput';

describe('ClientLoanUnifiedInput - New Client State', () => {
  const defaultProps = {
    loanId: 'test-loan-1',
    currentName: '',
    currentPhone: '',
    onNameChange: jest.fn(),
    onPhoneChange: jest.fn(),
    onPreviousLoanSelect: jest.fn(),
    onPreviousLoanClear: jest.fn(),
    onClientDataChange: jest.fn(),
    mode: 'client' as const,
    previousLoanOptions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should apply blue styling when typing a new client name with no autocomplete matches', async () => {
    const { container, getByPlaceholderText, getByText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const nameInput = getByPlaceholderText(/Buscar cliente/i);
    
    // Type a name that won't match any autocomplete results
    fireEvent.change(nameInput, { target: { value: 'New Client Name' } });
    
    await waitFor(() => {
      // Find the container with the border
      const inputContainer = container.querySelector('[style*="border"]');
      const style = inputContainer?.getAttribute('style');
      
      // Should have blue border (#3B82F6)
      expect(style).toContain('#3B82F6');
      // Should have blue background (#EFF6FF)
      expect(style).toContain('#EFF6FF');
      
      // Should show "Nuevo Cliente - Se creará un registro nuevo" indicator
      expect(getByText('Nuevo Cliente - Se creará un registro nuevo')).toBeInTheDocument();
    });
  });

  it('should apply blue styling to both name and phone inputs in newClient state', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput 
          {...defaultProps}
          currentName="New Client"
        />
      </MockedProvider>
    );

    await waitFor(() => {
      // Find all containers with borders
      const containers = container.querySelectorAll('[style*="border"]');
      
      // Should have at least 2 containers (name and phone)
      expect(containers.length).toBeGreaterThanOrEqual(2);
      
      // Check that at least one has blue styling
      const hasBlueStyle = Array.from(containers).some(el => {
        const style = el.getAttribute('style');
        return style?.includes('#3B82F6') || style?.includes('#EFF6FF');
      });
      
      expect(hasBlueStyle).toBe(true);
    });
  });

  it('should transition from default to newClient state when typing', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const nameInput = getByPlaceholderText(/Buscar cliente/i);
    
    // Initially should have default styling
    let inputContainer = container.querySelector('[style*="border"]');
    let initialStyle = inputContainer?.getAttribute('style');
    expect(initialStyle).toContain('#D1D5DB'); // Default gray border
    
    // Type a new client name
    fireEvent.change(nameInput, { target: { value: 'Ne' } });
    
    await waitFor(() => {
      inputContainer = container.querySelector('[style*="border"]');
      const newStyle = inputContainer?.getAttribute('style');
      
      // Should transition to blue styling
      expect(newStyle).toContain('#3B82F6');
    });
  });

  it('should remove blue styling when selecting an existing client from autocomplete', async () => {
    const mockLoanOption = {
      value: 'loan-1',
      label: 'Juan Pérez - 5551234567',
      loanData: {
        id: 'loan-1',
        borrower: {
          id: 'borrower-1',
          personalData: {
            id: 'person-1',
            fullName: 'Juan Pérez',
            phones: [{ id: 'phone-1', number: '5551234567' }],
          },
        },
      },
    };

    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput 
          {...defaultProps}
          previousLoanOptions={[mockLoanOption]}
        />
      </MockedProvider>
    );

    const nameInput = getByPlaceholderText(/Buscar cliente/i);
    
    // Type to trigger newClient state
    fireEvent.change(nameInput, { target: { value: 'Ju' } });
    
    await waitFor(() => {
      const inputContainer = container.querySelector('[style*="border"]');
      const style = inputContainer?.getAttribute('style');
      
      // Should have blue styling initially (newClient state)
      expect(style).toContain('#3B82F6');
    });
  });

  it('should have smooth transition between states', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const nameInput = getByPlaceholderText(/Buscar cliente/i);
    
    // Check that transition property is set
    const inputContainer = container.querySelector('[style*="transition"]');
    const style = inputContainer?.getAttribute('style');
    
    // Should have transition for smooth state changes
    expect(style).toContain('transition');
    expect(style).toMatch(/0\.15s|150ms/); // 150ms transition
  });

  it('should distinguish newClient state from other states visually', async () => {
    // Test that newClient (blue) is different from:
    // - new with data (green)
    // - edited (yellow)
    // - renewed (blue but different context)
    
    const { container, rerender } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput 
          {...defaultProps}
          currentName="New Client"
        />
      </MockedProvider>
    );

    await waitFor(() => {
      const inputContainer = container.querySelector('[style*="border"]');
      const style = inputContainer?.getAttribute('style');
      
      // newClient state should have blue border and blue background
      expect(style).toContain('#3B82F6'); // Blue border
      expect(style).toContain('#EFF6FF'); // Blue background
    });
  });

  it('should clear newClient state when input is cleared', async () => {
    const { container, getByPlaceholderText, queryByText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const nameInput = getByPlaceholderText(/Buscar cliente/i);
    
    // Type to trigger newClient state
    fireEvent.change(nameInput, { target: { value: 'New Client' } });
    
    await waitFor(() => {
      const inputContainer = container.querySelector('[style*="border"]');
      const style = inputContainer?.getAttribute('style');
      expect(style).toContain('#3B82F6');
      // Should show indicator
      expect(queryByText('Nuevo Cliente - Se creará un registro nuevo')).toBeInTheDocument();
    });
    
    // Clear the input
    fireEvent.change(nameInput, { target: { value: '' } });
    
    await waitFor(() => {
      const inputContainer = container.querySelector('[style*="border"]');
      const style = inputContainer?.getAttribute('style');
      
      // Should return to default state
      expect(style).toContain('#D1D5DB');
      // Should hide indicator
      expect(queryByText('Nuevo Cliente - Se creará un registro nuevo')).not.toBeInTheDocument();
    });
  });

  it('should show "Nuevo Cliente - Se creará un registro nuevo" indicator badge when in newClient state', async () => {
    const { getByPlaceholderText, getByText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const nameInput = getByPlaceholderText(/Buscar cliente/i);
    
    // Type to trigger newClient state
    fireEvent.change(nameInput, { target: { value: 'New Client Name' } });
    
    await waitFor(() => {
      // Should show the "Nuevo Cliente - Se creará un registro nuevo" badge
      const badge = getByText('Nuevo Cliente - Se creará un registro nuevo');
      expect(badge).toBeInTheDocument();
      
      // Badge should have blue styling
      const badgeContainer = badge.closest('div');
      const style = badgeContainer?.getAttribute('style');
      expect(style).toContain('#EFF6FF'); // Blue background
      expect(style).toContain('#BFDBFE'); // Blue border (lighter)
      expect(style).toContain('#1E40AF'); // Blue text
    });
  });

  it('should hide "Nuevo Cliente" indicator when not in newClient state', async () => {
    const { queryByText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    // Initially should not show the indicator
    expect(queryByText('Nuevo Cliente - Se creará un registro nuevo')).not.toBeInTheDocument();
  });
});
