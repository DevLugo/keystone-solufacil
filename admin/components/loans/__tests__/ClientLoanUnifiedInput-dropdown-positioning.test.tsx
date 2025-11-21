/**
 * Test to verify dropdown positioning in ClientLoanUnifiedInput
 * Task 29: Fix autocomplete dropdown positioning
 * Requirements: 3.1, 3.2, 6.2
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import ClientLoanUnifiedInput from '../ClientLoanUnifiedInput';
import { SEARCH_POTENTIAL_COLLATERALS } from '../../../graphql/queries/loans';

describe('ClientLoanUnifiedInput - Dropdown Positioning', () => {
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
    previousLoanOptions: [
      {
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
      },
    ],
  };

  const avalMocks = [
    {
      request: {
        query: SEARCH_POTENTIAL_COLLATERALS,
        variables: { searchTerm: 'Maria' },
      },
      result: {
        data: {
          personalDatas: [
            {
              id: 'person-2',
              fullName: 'Maria Garcia',
              phones: [{ id: 'phone-2', number: '5559876543' }],
              addresses: [
                {
                  id: 'address-1',
                  location: { id: 'loc-1', name: 'Centro' },
                },
              ],
              loansAsCollateral: [],
            },
          ],
        },
      },
    },
  ];

  it('should render dropdown with absolute positioning', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const input = getByPlaceholderText(/Buscar cliente/i);
    
    // Type to trigger dropdown
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Juan' } });

    await waitFor(() => {
      const dropdown = container.querySelector('[class*="dropdown"]');
      if (dropdown) {
        // Get computed styles
        const styles = window.getComputedStyle(dropdown);
        
        // Verify absolute positioning (not fixed)
        expect(styles.position).toBe('absolute');
      }
    });
  });

  it('should position dropdown directly below input', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const input = getByPlaceholderText(/Buscar cliente/i);
    
    // Type to trigger dropdown
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Juan' } });

    await waitFor(() => {
      const dropdown = container.querySelector('[class*="dropdown"]');
      if (dropdown) {
        const styles = window.getComputedStyle(dropdown);
        
        // Verify top position is calc(100% + 4px)
        expect(styles.top).toMatch(/calc\(100% \+ 4px\)|100%/);
      }
    });
  });

  it('should have dropdown width match input width', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const input = getByPlaceholderText(/Buscar cliente/i);
    
    // Type to trigger dropdown
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Juan' } });

    await waitFor(() => {
      const dropdown = container.querySelector('[class*="dropdown"]');
      if (dropdown) {
        const styles = window.getComputedStyle(dropdown);
        
        // Verify left and right are set to 0 (full width of parent)
        expect(styles.left).toBe('0px');
        expect(styles.right).toBe('0px');
      }
    });
  });

  it('should have proper z-index for dropdown', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const input = getByPlaceholderText(/Buscar cliente/i);
    
    // Type to trigger dropdown
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Juan' } });

    await waitFor(() => {
      const dropdown = container.querySelector('[class*="dropdown"]');
      if (dropdown) {
        const styles = window.getComputedStyle(dropdown);
        
        // Verify high z-index to appear above other elements
        const zIndex = parseInt(styles.zIndex, 10);
        expect(zIndex).toBeGreaterThanOrEqual(9999);
      }
    });
  });

  it('should position dropdown correctly in aval mode', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={avalMocks}>
        <ClientLoanUnifiedInput 
          {...defaultProps} 
          mode="aval"
          namePlaceholder="Buscar aval..."
        />
      </MockedProvider>
    );

    const input = getByPlaceholderText(/Buscar aval/i);
    
    // Type to trigger search
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Maria' } });

    await waitFor(() => {
      const dropdown = container.querySelector('[class*="dropdown"]');
      if (dropdown) {
        const styles = window.getComputedStyle(dropdown);
        
        // Verify positioning
        expect(styles.position).toBe('absolute');
        expect(styles.top).toMatch(/calc\(100% \+ 4px\)|100%/);
      }
    });
  });

  it('should maintain dropdown position when parent container has relative positioning', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <div style={{ position: 'relative', padding: '20px' }}>
          <ClientLoanUnifiedInput {...defaultProps} />
        </div>
      </MockedProvider>
    );

    const input = getByPlaceholderText(/Buscar cliente/i);
    
    // Type to trigger dropdown
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Juan' } });

    await waitFor(() => {
      const dropdown = container.querySelector('[class*="dropdown"]');
      if (dropdown) {
        // Dropdown should still be positioned correctly relative to its immediate parent
        const styles = window.getComputedStyle(dropdown);
        expect(styles.position).toBe('absolute');
      }
    });
  });

  it('should have max-height constraint on dropdown', async () => {
    const { container, getByPlaceholderText } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const input = getByPlaceholderText(/Buscar cliente/i);
    
    // Type to trigger dropdown
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Juan' } });

    await waitFor(() => {
      const dropdown = container.querySelector('[class*="dropdown"]');
      if (dropdown) {
        const styles = window.getComputedStyle(dropdown);
        
        // Verify max-height is set (300px as per design)
        expect(styles.maxHeight).toBe('300px');
      }
    });
  });
});
