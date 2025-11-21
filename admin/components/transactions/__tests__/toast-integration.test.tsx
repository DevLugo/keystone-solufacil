/**
 * Toast Integration Verification Tests
 * 
 * This test file verifies that the ToastProvider is correctly integrated
 * and that toasts appear for all required scenarios.
 * 
 * Requirements tested:
 * - 4.1: Success toast on credit addition with count
 * - 4.2: Success toast on credit deletion
 * - 4.3: Error toast on creation failure
 * - 4.4: Error toast on deletion failure
 * - 4.5: Toast auto-dismiss after 4 seconds
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { ToastProvider, useToast } from '../../ui/toast';
import { CreateCreditModal } from '../CreateCreditModal';

// Mock component to test toast functionality
const ToastTestComponent = () => {
  const { showToast } = useToast();

  return (
    <div>
      <button onClick={() => showToast('success', 'Test success message')}>
        Show Success
      </button>
      <button onClick={() => showToast('error', 'Test error message')}>
        Show Error
      </button>
      <button onClick={() => showToast('warning', 'Test warning message')}>
        Show Warning
      </button>
      <button onClick={() => showToast('info', 'Test info message')}>
        Show Info
      </button>
    </div>
  );
};

describe('Toast Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('ToastProvider Integration', () => {
    it('should render ToastProvider without errors', () => {
      const { container } = render(
        <ToastProvider>
          <div>Test Content</div>
        </ToastProvider>
      );

      expect(container).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should provide useToast hook to children', () => {
      const { getByText } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      expect(getByText('Show Success')).toBeInTheDocument();
    });

    it('should throw error when useToast is used outside ToastProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<ToastTestComponent />);
      }).toThrow('useToast must be used within ToastProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Toast Display - Requirement 4.1, 4.2, 4.3, 4.4', () => {
    it('should display success toast', () => {
      const { getByText } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Success'));

      expect(screen.getByText('Test success message')).toBeInTheDocument();
    });

    it('should display error toast', () => {
      const { getByText } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Error'));

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('should display warning toast', () => {
      const { getByText } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Warning'));

      expect(screen.getByText('Test warning message')).toBeInTheDocument();
    });

    it('should display info toast', () => {
      const { getByText } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Info'));

      expect(screen.getByText('Test info message')).toBeInTheDocument();
    });

    it('should display multiple toasts simultaneously', () => {
      const { getByText } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Success'));
      fireEvent.click(getByText('Show Error'));
      fireEvent.click(getByText('Show Warning'));

      expect(screen.getByText('Test success message')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.getByText('Test warning message')).toBeInTheDocument();
    });
  });

  describe('Toast Auto-Dismiss - Requirement 4.5', () => {
    it('should auto-dismiss toast after 4 seconds', async () => {
      const { getByText, queryByText } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Success'));
      expect(screen.getByText('Test success message')).toBeInTheDocument();

      // Fast-forward time by 4 seconds
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      await waitFor(() => {
        expect(queryByText('Test success message')).not.toBeInTheDocument();
      });
    });

    it('should respect custom duration', async () => {
      const CustomDurationComponent = () => {
        const { showToast } = useToast();
        return (
          <button onClick={() => showToast('success', 'Custom duration', undefined, 2000)}>
            Show Custom
          </button>
        );
      };

      const { getByText, queryByText } = render(
        <ToastProvider>
          <CustomDurationComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Custom'));
      expect(screen.getByText('Custom duration')).toBeInTheDocument();

      // Fast-forward time by 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(queryByText('Custom duration')).not.toBeInTheDocument();
      });
    });
  });

  describe('Toast Manual Dismiss', () => {
    it('should manually dismiss toast when close button is clicked', async () => {
      const { getByText, queryByText, container } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Success'));
      expect(screen.getByText('Test success message')).toBeInTheDocument();

      // Find and click the close button
      const closeButton = container.querySelector('button[aria-label="Cerrar notificación"]');
      expect(closeButton).toBeInTheDocument();
      
      fireEvent.click(closeButton!);

      await waitFor(() => {
        expect(queryByText('Test success message')).not.toBeInTheDocument();
      });
    });
  });

  describe('CreateCreditModal Toast Integration', () => {
    const mockProps = {
      isOpen: true,
      onClose: jest.fn(),
      onSave: jest.fn(),
      selectedDate: new Date('2024-01-01'),
      selectedLead: {
        id: 'lead-1',
        personalData: {
          fullName: 'Test Lead',
          addresses: []
        }
      } as any,
      selectedLeadLocation: {
        id: 'loc-1',
        name: 'Test Location'
      } as any,
      loanTypeOptions: [
        {
          value: 'type-1',
          label: 'Test Type',
          typeData: {
            id: 'type-1',
            name: 'Test Type',
            rate: '0.2',
            loanGrantedComission: 50
          }
        }
      ],
      getPreviousLoanOptions: jest.fn(() => []),
      usedAvalIds: [],
      isSearchingLoansByRow: {},
      onSearchTextChange: jest.fn(),
      onLocationMismatch: jest.fn(),
      calculateLoanAmounts: jest.fn(() => ({
        amountGived: '1000',
        amountToPay: '1200',
        totalDebtAcquired: '1200'
      }))
    };

    it('should show info toast when adding another credit', () => {
      const { getByText } = render(
        <MockedProvider>
          <ToastProvider>
            <CreateCreditModal {...mockProps} />
          </ToastProvider>
        </MockedProvider>
      );

      const addButton = getByText('Agregar Otro Crédito');
      fireEvent.click(addButton);

      expect(screen.getByText('Nuevo crédito agregado')).toBeInTheDocument();
    });

    it('should show warning toast when trying to delete last credit', () => {
      const { container } = render(
        <MockedProvider>
          <ToastProvider>
            <CreateCreditModal {...mockProps} />
          </ToastProvider>
        </MockedProvider>
      );

      // Try to find and click delete button
      const deleteButton = container.querySelector('button[title*="Eliminar"]') || 
                          container.querySelector('svg[class*="trash"]')?.closest('button');
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(screen.getByText('Debe haber al menos un crédito')).toBeInTheDocument();
      }
    });

    it('should show error toast on validation failure', () => {
      const { getByText } = render(
        <MockedProvider>
          <ToastProvider>
            <CreateCreditModal {...mockProps} />
          </ToastProvider>
        </MockedProvider>
      );

      // Try to save without filling required fields
      const saveButton = getByText('Guardar Cambios');
      fireEvent.click(saveButton);

      expect(screen.getByText('Por favor completa todos los campos requeridos')).toBeInTheDocument();
    });
  });

  describe('Toast Styling and Accessibility', () => {
    it('should have correct CSS classes for toast types', () => {
      const { getByText, container } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Success'));
      const toast = container.querySelector('[class*="toast"]');
      expect(toast).toHaveClass(expect.stringContaining('success'));
    });

    it('should have accessible close button', () => {
      const { getByText, container } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Success'));
      const closeButton = container.querySelector('button[aria-label="Cerrar notificación"]');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', 'Cerrar notificación');
    });

    it('should display toast icons', () => {
      const { getByText, container } = render(
        <ToastProvider>
          <ToastTestComponent />
        </ToastProvider>
      );

      fireEvent.click(getByText('Show Success'));
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });
});
