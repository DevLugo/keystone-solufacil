/** @jsxRuntime classic */
/** @jsx jsx */

import React, { memo, useCallback, useState, useEffect } from 'react';
import { Box, jsx } from '@keystone-ui/core';
import { LoadingDots } from '@keystone-ui/loading';
import { Button } from '@keystone-ui/button';
import { Select } from '@keystone-ui/fields';
import { FaTrash } from 'react-icons/fa';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import type { ExtendedLoan, Loan, LoanType, Option } from '../../types/loan';

interface LoanListViewProps {
  loans: ExtendedLoan[];
  existingLoans: Loan[];
  loanTypes: LoanType[];
  loanTypeOptions: Option[];
  previousLoanOptions: Option[];
  loading: boolean;
  error: any;
  onRemoveLoan: (index: number) => void;
  onEditLoan: (index: number, field: string, value: string) => void;
  onEditExistingLoan: (loanId: string, field: string, value: string) => void;
  focusedInput: string | null;
  editedLoans: { [key: string]: Loan };
}

export const LoanListView = memo(({ 
  loans, 
  existingLoans,
  loanTypes,
  loanTypeOptions,
  previousLoanOptions,
  loading, 
  error, 
  onRemoveLoan, 
  onEditLoan,
  onEditExistingLoan,
  focusedInput,
  editedLoans
}: LoanListViewProps) => {
  const [localExistingLoans, setLocalExistingLoans] = useState<Loan[]>(existingLoans);

  useEffect(() => {
    setLocalExistingLoans(existingLoans);
  }, [existingLoans]);

  if (loading) return <LoadingDots label="Loading loans" />;
  if (error) return <GraphQLErrorNotice errors={error?.graphQLErrors || []} networkError={error?.networkError} />;

  const calculateAmounts = useCallback((loan: ExtendedLoan | Loan) => {
    const requestedAmount = parseFloat(loan.requestedAmount || '0');
    const previousLoanAmount = loan.previousLoan ? parseFloat(loan.previousLoan.pendingAmount || '0') : 0;
    const rate = loan.loantype ? parseFloat(loan.loantype.rate) : 0;

    return {
      amountGived: (requestedAmount - previousLoanAmount).toString(),
      amountToPay: (requestedAmount * (1 + rate)).toFixed(2),
      pendingAmount: previousLoanAmount.toString()
    };
  }, []);

  const handleEdit = useCallback((loan: ExtendedLoan | Loan, index: number, field: string, value: string, isExisting: boolean) => {
    if (isExisting) {
      // Actualizar el préstamo en el estado local
      const updatedLoans = localExistingLoans.map(l => {
        if (l.id === loan.id) {
          if (field === 'borrowerName' || field === 'borrowerPhone') {
            // Manejar campos anidados de borrower.personalData
            return {
              ...l,
              borrower: {
                ...l.borrower,
                personalData: {
                  ...l.borrower?.personalData,
                  ...(field === 'borrowerName' ? { fullName: value } : {}),
                  ...(field === 'borrowerPhone' ? {
                    phones: [{ number: value }]
                  } : {})
                }
              }
            };
          } else {
            // Manejar campos normales
            return {
              ...l,
              [field]: value
            };
          }
        }
        return l;
      });
      setLocalExistingLoans(updatedLoans);
      
      // Notificar al componente padre
      onEditExistingLoan(loan.id, field, value);

      // Si el cambio afecta a los campos calculados, actualizarlos
      if (['previousLoan', 'loantype', 'requestedAmount'].includes(field)) {
        const amounts = calculateAmounts({ ...loan, [field]: value });
        onEditExistingLoan(loan.id, 'amountGived', amounts.amountGived);
        onEditExistingLoan(loan.id, 'amountToPay', amounts.amountToPay);
        onEditExistingLoan(loan.id, 'pendingAmount', amounts.pendingAmount);
      }
    } else {
      onEditLoan(index, field, value);
    }
  }, [onEditLoan, onEditExistingLoan, calculateAmounts, localExistingLoans]);

  const renderLoanRow = (loan: ExtendedLoan | Loan, index: number, isExisting: boolean = false) => {
    const amounts = calculateAmounts(loan);

    return (
      <div key={index} className="table-row">
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <Select
              options={previousLoanOptions}
              value={loan.previousLoan?.id ? {
                value: loan.previousLoan.id,
                label: `${loan.previousLoan.borrower?.personalData?.fullName} ($${loan.previousLoan?.pendingAmount})`
              } : { value: '', label: 'Seleccionar préstamo previo' }}
              onChange={(option) => handleEdit(loan, index, 'previousLoan', option?.value || '', isExisting)}
              menuPlacement="auto"
              menuPosition="fixed"
            />
          </div>
        </div>
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <Select
              options={loanTypeOptions}
              value={loan.loantype ? { value: loan.loantype.id, label: `${loan.loantype.name} (${loan.loantype.weekDuration} semanas - ${loan.loantype.rate}%)` } : { value: '', label: 'Seleccionar tipo de préstamo' }}
              onChange={(option) => handleEdit(loan, index, 'loantype', option?.value || '', isExisting)}
              menuPlacement="auto"
              menuPosition="fixed"
            />
          </div>
        </div>
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <input
              type="text"
              value={loan.borrower?.personalData?.fullName || ''}
              onChange={(e) => handleEdit(loan, index, 'borrowerName', e.target.value, isExisting)}
              placeholder="Nombre del cliente"
            />
          </div>
        </div>
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <input
              type="text"
              value={loan.requestedAmount || ''}
              onChange={(e) => handleEdit(loan, index, 'requestedAmount', e.target.value, isExisting)}
              placeholder="Cantidad solicitada"
            />
          </div>
        </div>
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <input
              type="text"
              value={amounts.amountGived}
              disabled
              placeholder="Cantidad entregada (calculado)"
            />
          </div>
        </div>
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <input
              type="text"
              value={amounts.amountToPay}
              disabled
              placeholder="Cantidad a pagar (calculado)"
            />
          </div>
        </div>
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <input
              type="text"
              value={amounts.pendingAmount}
              disabled
              placeholder="Deuda previa"
            />
          </div>
        </div>
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <input
              type="text"
              value={loan.avalName || ''}
              onChange={(e) => handleEdit(loan, index, 'avalName', e.target.value, isExisting)}
              placeholder="Nombre del aval"
            />
          </div>
        </div>
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <input
              type="text"
              value={loan.avalPhone || ''}
              onChange={(e) => handleEdit(loan, index, 'avalPhone', e.target.value, isExisting)}
              placeholder="Teléfono del aval"
            />
          </div>
        </div>
        <div className="table-cell fixed-width" style={{ padding: '4px' }}>
          <div className="loan-input">
            <input
              type="text"
              value={loan.borrower?.personalData?.phones?.[0]?.number || ''}
              onChange={(e) => handleEdit(loan, index, 'borrowerPhone', e.target.value, isExisting)}
              placeholder="Teléfono del titular"
            />
          </div>
        </div>
        <div className="table-cell" style={{ padding: '4px' }}>
          <div className="loan-input">
            <input
              type="text"
              value={(loan as ExtendedLoan).comission || ''}
              onChange={(e) => handleEdit(loan, index, 'comission', e.target.value, isExisting)}
              placeholder="Comisión"
            />
          </div>
        </div>
        <div className="table-cell">
          {!isExisting && (
            <Button tone="negative" onClick={() => onRemoveLoan(index)}>
              <FaTrash />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Box className="table">
      <div className="table-row table-header">
        <div className="table-cell fixed-width">Prestamo Previo</div>
        <div className="table-cell fixed-width">Tipo Prestamo</div>
        <div className="table-cell fixed-width">Nombre</div>
        <div className="table-cell fixed-width">Cantidad Solicitada</div>
        <div className="table-cell fixed-width">Cantidad Entregada</div>
        <div className="table-cell fixed-width">Cantidad a pagar</div>
        <div className="table-cell fixed-width">Deuda Previa</div>
        <div className="table-cell fixed-width">Nombre Aval</div>
        <div className="table-cell fixed-width">Telefono Aval</div>
        <div className="table-cell fixed-width">Telefono Titular</div>
        <div className="table-cell">Comision</div>
        <div className="table-cell"></div>
      </div>
      {localExistingLoans.map((loan, index) => renderLoanRow(loan, index, true))}
      {loans.map((loan, index) => renderLoanRow(loan, index))}
    </Box>
  );
});

