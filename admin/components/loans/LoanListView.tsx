/** @jsxRuntime classic */
/** @jsx jsx */

import React, { memo } from 'react';
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
  focusedInput: string | null;
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
  focusedInput 
}: LoanListViewProps) => {
  if (loading) return <LoadingDots label="Loading loans" />;
  if (error) return <GraphQLErrorNotice errors={error?.graphQLErrors || []} networkError={error?.networkError} />;

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
      {loans.map((loan, index) => (
        <div key={index} className="table-row">
          <div className="table-cell fixed-width" style={{ padding: '4px' }}>
            <div className="loan-input">
            <Select
              options={previousLoanOptions}
              value={loan.previousLoan?.id ? {
                value: loan.previousLoan.id,
                label: `${loan.previousLoan.borrower?.personalData?.fullName} ($${loan.previousLoan?.pendingAmount})`
              } : { value: '', label: 'Seleccionar préstamo previo' }}
              onChange={(option) => onEditLoan(index, 'previousLoan', option?.value || '')}
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
              onChange={(option) => onEditLoan(index, 'loantype', option?.value || '')}
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
              onChange={(e) => onEditLoan(index, 'borrowerName', e.target.value)}
              placeholder="Nombre del cliente"
            />
            </div>
          </div>
          <div className="table-cell fixed-width" style={{ padding: '4px' }}>
            <div className="loan-input">
            <input
              type="text"
              value={loan.requestedAmount || ''}
              onChange={(e) => onEditLoan(index, 'requestedAmount', e.target.value)}
              placeholder="Cantidad solicitada"
            />
            </div>
          </div>
          <div className="table-cell fixed-width" style={{ padding: '4px' }}>
            <div className="loan-input">
            <input
              type="text"
              value={loan.amountGived || ''}
              onChange={(e) => onEditLoan(index, 'amountGived', e.target.value)}
              placeholder="Cantidad entregada"
            />
            </div>
          </div>
          <div className="table-cell fixed-width" style={{ padding: '4px' }}>
            <div className="loan-input">
            <input
              type="text"
              value={loan.requestedAmount ? (parseFloat(loan.requestedAmount) * (1 + parseFloat(loan.loantype.rate) / 100)).toFixed(2) : ''}
              disabled
              placeholder="Cantidad a pagar (calculado)"
            />
            </div>
          </div>
          <div className="table-cell fixed-width" style={{ padding: '4px' }}>
            <div className="loan-input">
            <input
              type="text"
              value={loan.previousLoan?.pendingAmount || ''}
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
              onChange={(e) => onEditLoan(index, 'avalName', e.target.value)}
              placeholder="Nombre del aval"
            />
            </div>
          </div>
          <div className="table-cell fixed-width" style={{ padding: '4px' }}>
            <div className="loan-input">
            <input
              type="text"
              value={loan.avalPhone || ''}
              onChange={(e) => onEditLoan(index, 'avalPhone', e.target.value)}
              placeholder="Teléfono del aval"
            />
            </div>
          </div>
          <div className="table-cell fixed-width" style={{ padding: '4px' }}>
            <div className="loan-input">
            <input
              type="text"
              value={loan.borrower?.personalData?.phones?.[0]?.number || ''}
              onChange={(e) => onEditLoan(index, 'borrowerPhone', e.target.value)}
              placeholder="Teléfono del titular"
            />
            </div>
          </div>
          <div className="table-cell" style={{ padding: '4px' }}>
            <div className="loan-input">
            <input
              type="text"
              value={loan.comission || ''}
              onChange={(e) => onEditLoan(index, 'comission', e.target.value)}
              placeholder="Comisión"
            />
            </div>
          </div>
          <div className="table-cell">
            <Button tone="negative" onClick={() => onRemoveLoan(index)}>
              <FaTrash />
            </Button>
          </div>
        </div>
      ))}
    </Box>
  );
});

