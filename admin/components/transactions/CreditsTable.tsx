import React, { useState } from 'react';
import { FaSpinner, FaEdit, FaTrash, FaEllipsisV } from 'react-icons/fa';
import { Button } from '../ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import type { Loan } from '../../types/loan';
import styles from './CreditsTable.module.css';

interface CreditsTableProps {
  loans: Loan[];
  newLoanId: string | null;
  isDeleting: string | null;
  initialPayments: Record<string, any>;
  hasPaymentForToday: (loanId: string) => boolean;
  getRegisteredPaymentAmount: (loanId: string) => string;
  handleToggleInitialPayment: (loanId: string) => void;
  handleEditLoan: (loan: Loan) => void;
  handleDeleteClick: (loanId: string) => void;
}

export const CreditsTable: React.FC<CreditsTableProps> = ({
  loans,
  newLoanId,
  isDeleting,
  initialPayments,
  hasPaymentForToday,
  getRegisteredPaymentAmount,
  handleToggleInitialPayment,
  handleEditLoan,
  handleDeleteClick,
}) => {
  return (
    <div className={styles.tableContainer}>
      <Table className={styles.table}>
        <TableHeader>
          <TableRow className={styles.headerRow}>
            <TableHead className={styles.headerCell} style={{ minWidth: '200px' }}>Préstamo Previo</TableHead>
            <TableHead className={styles.headerCell} style={{ minWidth: '100px' }}>Tipo</TableHead>
            <TableHead className={styles.headerCell} style={{ minWidth: '150px' }}>Nombre</TableHead>
            <TableHead className={styles.headerCell} style={{ minWidth: '120px' }}>Teléfono</TableHead>
            <TableHead className={styles.headerCellRight} style={{ minWidth: '110px' }}>M. Solicitado</TableHead>
            <TableHead className={styles.headerCellRight} style={{ minWidth: '120px' }}>Deuda Pendiente</TableHead>
            <TableHead className={styles.headerCellRight} style={{ minWidth: '110px' }}>M. Entregado</TableHead>
            <TableHead className={styles.headerCellRight} style={{ minWidth: '100px' }}>M. a Pagar</TableHead>
            <TableHead className={styles.headerCellRight} style={{ minWidth: '90px' }}>Comisión</TableHead>
            <TableHead className={styles.headerCell} style={{ minWidth: '150px' }}>Aval</TableHead>
            <TableHead className={styles.headerCell} style={{ minWidth: '120px' }}>Tel. Aval</TableHead>
            <TableHead className={styles.headerCell} style={{ width: '50px', minWidth: '50px' }}></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => (
            <TableRow 
              key={loan.id} 
              className={loan.id === newLoanId ? styles.dataRowHighlight : styles.dataRow}
            >
              {loan.id === newLoanId && (
                <td colSpan={12} className={styles.newLoanIndicator} />
              )}
              <TableCell className={styles.dataCell}>
                <div className={styles.badgeContainer}>
                  {loan.previousLoan ? 
                    <span className={styles.badgeRenewal}>Renovado</span> 
                    : 
                    <span className={styles.badgeNew}>Nuevo</span>
                  }
                  {hasPaymentForToday(loan.id) ? (
                    <div className={styles.badgePaid}>
                      <span style={{ fontSize: '12px' }}>✓</span>
                      Pagado ${getRegisteredPaymentAmount(loan.id)}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleToggleInitialPayment(loan.id)}
                      size="sm"
                      className={initialPayments[loan.id] ? styles.paymentButtonConfigured : styles.paymentButtonRegister}
                    >
                      {initialPayments[loan.id] ? (
                        <>
                          <span style={{ fontSize: '12px' }}>✓</span>
                          Pago configurado
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '12px' }}>💰</span>
                          Registrar pago
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell className={styles.dataCell}>{loan.loantype.name}</TableCell>
              <TableCell className={styles.dataCellBold}>{loan.borrower?.personalData?.fullName || 'Sin nombre'}</TableCell>
              <TableCell className={styles.dataCellMuted}>{loan.borrower?.personalData?.phones?.[0]?.number || '-'}</TableCell>
              <TableCell className={styles.dataCellRight}>${Math.round(parseFloat(loan.requestedAmount || '0')).toLocaleString('es-MX')}</TableCell>
              <TableCell className={styles.dataCellDanger}>${Math.round(parseFloat(loan.previousLoan?.pendingAmount || '0')).toLocaleString('es-MX')}</TableCell>
              <TableCell className={styles.dataCellSuccess}>${Math.round(parseFloat(loan.amountGived || '0')).toLocaleString('es-MX')}</TableCell>
              <TableCell className={styles.dataCellRight}>{loan.totalDebtAcquired ? `$${Math.round(parseFloat(loan.totalDebtAcquired || '0')).toLocaleString('es-MX')}` : 'N/A'}</TableCell>
              <TableCell className={styles.dataCellPurple}>${Math.round(parseFloat(loan.comissionAmount || '0')).toLocaleString('es-MX')}</TableCell>
              <TableCell className={styles.dataCell}>{loan.collaterals?.[0]?.fullName || (loan as any).avalName || '-'}</TableCell>
              <TableCell className={styles.dataCellMuted}>{loan.collaterals?.[0]?.phones?.[0]?.number || (loan as any).avalPhone || '-'}</TableCell>
              <TableCell className={styles.dataCell} style={{ width: '50px', position: 'relative' }}>
                {isDeleting === loan.id ? (
                  <div className={styles.spinner}>
                    <FaSpinner className={styles.spinnerIcon} />
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Opciones del préstamo"
                      >
                        <FaEllipsisV size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="left">
                      <DropdownMenuItem onClick={() => handleEditLoan(loan)}>
                        <FaEdit size={14} style={{ marginRight: '8px' }} />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteClick(loan.id)}
                        disabled={isDeleting === loan.id}
                        variant="destructive"
                      >
                        <FaTrash size={14} style={{ marginRight: '8px' }} />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
