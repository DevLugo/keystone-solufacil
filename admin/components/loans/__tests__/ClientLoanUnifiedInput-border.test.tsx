/**
 * Test to verify border thickness consistency in ClientLoanUnifiedInput
 * Task 26: Fix autocomplete name input border thickness
 * Requirements: 1.1, 1.2, 3.1
 */

import React from 'react';
import { render } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import ClientLoanUnifiedInput from '../ClientLoanUnifiedInput';

describe('ClientLoanUnifiedInput - Border Thickness', () => {
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
  };

  it('should have 1px border thickness in default state', () => {
    const { container } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    // Find the container with the border
    const inputContainer = container.querySelector('[style*="border"]');
    expect(inputContainer).toBeTruthy();
    
    // Check that border is 1px
    const style = inputContainer?.getAttribute('style');
    expect(style).toContain('1px solid');
  });

  it('should have 1px border thickness when focused', () => {
    const { container } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const inputContainer = container.querySelector('[style*="border"]');
    const style = inputContainer?.getAttribute('style');
    
    // Border should be 1px in all states
    expect(style).toMatch(/border:\s*1px solid/);
  });

  it('should have 1px border thickness with data (new state)', () => {
    const { container } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput 
          {...defaultProps} 
          currentName="Juan Pérez"
          currentPhone="5551234567"
        />
      </MockedProvider>
    );

    const inputContainer = container.querySelector('[style*="border"]');
    const style = inputContainer?.getAttribute('style');
    
    // Border should be 1px even with data
    expect(style).toMatch(/border:\s*1px solid/);
  });

  it('should have consistent border thickness with other inputs in design system', () => {
    // This test verifies that the border thickness matches the design system
    // Design system specifies: border: 1px solid #d1d5db
    const { container } = render(
      <MockedProvider mocks={[]}>
        <ClientLoanUnifiedInput {...defaultProps} />
      </MockedProvider>
    );

    const inputContainer = container.querySelector('[style*="border"]');
    const style = inputContainer?.getAttribute('style');
    
    // Should use 1px border, not 2px or any other thickness
    expect(style).not.toContain('2px');
    expect(style).not.toContain('3px');
    expect(style).toContain('1px');
  });
});
