import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import ClientLoanUnifiedInput from '../loans/ClientLoanUnifiedInput';
import { useToast } from '../ui/toast';
import { validateLoanData, type ValidationError } from '../../utils/validation';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '../ui/alert-dialog';
import type { 
  ExtendedLoanForCredits, 
  LoanTypeOption, 
  PreviousLoanOption,
  LeadInfo,
  LocationInfo
} from '../../types/loan';
import styles from './CreateCreditModal.module.css';

interface CreateCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (loans: ExtendedLoanForCredits[]) => void;
  selectedDate: Date | null;
  selectedLead: LeadInfo | null;
  selectedLeadLocation: LocationInfo | null;
  loanTypeOptions: LoanTypeOption[];
  getPreviousLoanOptions: (rowId: string) => PreviousLoanOption[];
  usedAvalIds: string[];
  isSearchingLoansByRow: Record<string, boolean>;
  onSearchTextChange: (loanId: string, text: string) => void;
  onLocationMismatch: (clientLocation: string, leadLocation: string) => void;
  calculateLoanAmounts: (params: { requestedAmount: string; pendingAmount: string; rate: string }) => {
    amountGived: string;
    amountToPay: string;
    totalDebtAcquired: string;
  };
}

export const CreateCreditModal: React.FC<CreateCreditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  selectedLead,
  selectedLeadLocation,
  loanTypeOptions,
  getPreviousLoanOptions,
  usedAvalIds,
  isSearchingLoansByRow,
  onSearchTextChange,
  onLocationMismatch,
  calculateLoanAmounts,
}) => {
  const { showToast } = useToast();
  
  const [modalLoans, setModalLoans] = useState<ExtendedLoanForCredits[]>([
    {
      id: `modal-loan-${Date.now()}`,
      requestedAmount: '',
      amountGived: '',
      amountToPay: '',
      pendingAmount: '0',
      signDate: selectedDate?.toISOString() || '',
      comissionAmount: '0',
      avalName: '',
      avalPhone: '',
      selectedCollateralId: undefined,
      selectedCollateralPhoneId: undefined,
      avalAction: 'clear' as const,
      collaterals: [],
      loantype: undefined,
      borrower: { 
        id: '', 
        personalData: { 
          id: '', 
          fullName: '', 
          phones: [{ id: '', number: '' }] 
        } 
      },
      previousLoan: undefined,
      previousLoanOption: null,
    }
  ]);

  // Estados para edición y validación
  const [isEditingClient, setIsEditingClient] = useState<Record<string, boolean>>({});
  const [isEditingAval, setIsEditingAval] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, ValidationError[]>>({});
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  
  // Estado para el diálogo de confirmación de eliminación
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    loanIndex: number | null;
    clientName: string;
    amount: string;
  }>({
    isOpen: false,
    loanIndex: null,
    clientName: '',
    amount: '',
  });

  const totals = useMemo(() => {
    return modalLoans.reduce((acc, loan) => ({
      requested: acc.requested + parseFloat(loan.requestedAmount || '0'),
      delivered: acc.delivered + parseFloat(loan.amountGived || '0'),
    }), { requested: 0, delivered: 0 });
  }, [modalLoans]);

  const completedCount = useMemo(() => {
    return modalLoans.filter(loan => 
      loan.borrower?.personalData?.fullName?.trim() &&
      loan.avalName?.trim() &&
      loan.requestedAmount
    ).length;
  }, [modalLoans]);

  // Validar todos los préstamos y contar errores
  const validationSummary = useMemo(() => {
    const loansWithErrors: number[] = [];
    let totalErrors = 0;

    modalLoans.forEach((loan, index) => {
      const validation = validateLoanData(loan);
      if (!validation.isValid) {
        loansWithErrors.push(index + 1);
        totalErrors += validation.errors.length;
      }
    });

    return {
      loansWithErrors,
      totalErrors,
      hasErrors: loansWithErrors.length > 0
    };
  }, [modalLoans]);

  // Determinar si el botón de guardar debe estar habilitado
  const canSave = useMemo(() => {
    return completedCount > 0 && !validationSummary.hasErrors;
  }, [completedCount, validationSummary.hasErrors]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const calculateDeliveredAmount = (amount: string, commission: string): number => {
    const amountNum = parseFloat(amount) || 0;
    const commissionNum = parseFloat(commission) || 0;
    return amountNum - commissionNum;
  };

  // Helper para obtener error de un campo específico
  const getFieldError = (loanId: string, fieldName: string): string | undefined => {
    const errors = validationErrors[loanId] || [];
    const error = errors.find(e => e.field === fieldName);
    return error?.message;
  };

  // Helper para verificar si un campo tiene error
  const hasFieldError = (loanId: string, fieldName: string): boolean => {
    const errors = validationErrors[loanId] || [];
    return errors.some(e => e.field === fieldName);
  };

  const validateLoan = (loan: ExtendedLoanForCredits): string[] => {
    const errors: string[] = [];
    if (!loan.borrower?.personalData?.fullName?.trim()) {
      errors.push('Nombre del cliente requerido');
    }
    if (!loan.borrower?.personalData?.phones?.[0]?.number?.trim()) {
      errors.push('Teléfono del cliente requerido');
    }
    if (!loan.avalName?.trim()) {
      errors.push('Nombre del aval requerido');
    }
    if (!loan.avalPhone?.trim()) {
      errors.push('Teléfono del aval requerido');
    }
    if (!loan.loantype?.id) {
      errors.push('Tipo de préstamo requerido');
    }
    if (!loan.requestedAmount || parseFloat(loan.requestedAmount) <= 0) {
      errors.push('Monto solicitado debe ser mayor a 0');
    }
    return errors;
  };

  if (!isOpen) return null;

  const handleAddLoan = () => {
    setModalLoans([
      ...modalLoans,
      {
        id: `modal-loan-${Date.now()}-${Math.random()}`,
        requestedAmount: '',
        amountGived: '',
        amountToPay: '',
        pendingAmount: '0',
        signDate: selectedDate?.toISOString() || '',
        comissionAmount: '0',
        avalName: '',
        avalPhone: '',
        selectedCollateralId: undefined,
        selectedCollateralPhoneId: undefined,
        avalAction: 'clear' as const,
        collaterals: [],
        loantype: undefined,
        borrower: { 
          id: '', 
          personalData: { 
            id: '', 
            fullName: '', 
            phones: [{ id: '', number: '' }] 
          } 
        },
        previousLoan: undefined,
        previousLoanOption: null,
      }
    ]);
    showToast('info', 'Nuevo crédito agregado');
  };

  const handleRemoveLoan = (index: number) => {
    if (modalLoans.length <= 1) {
      showToast('warning', 'Debe haber al menos un crédito');
      return;
    }

    const loan = modalLoans[index];
    const clientName = loan.borrower?.personalData?.fullName || 'Sin nombre';
    const amount = loan.requestedAmount || '0';

    // Abrir el diálogo de confirmación
    setDeleteConfirmation({
      isOpen: true,
      loanIndex: index,
      clientName,
      amount,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation.loanIndex !== null) {
      const index = deleteConfirmation.loanIndex;
      setModalLoans(modalLoans.filter((_, i) => i !== index));
      showToast('success', `Crédito eliminado exitosamente`);
    }
    
    // Cerrar el diálogo
    setDeleteConfirmation({
      isOpen: false,
      loanIndex: null,
      clientName: '',
      amount: '',
    });
  };

  const handleCancelDelete = () => {
    // Cerrar el diálogo sin eliminar
    setDeleteConfirmation({
      isOpen: false,
      loanIndex: null,
      clientName: '',
      amount: '',
    });
  };

  const handleLoanChange = (index: number, field: string, value: any) => {
    const updatedLoans = [...modalLoans];
    let updatedLoan = { ...updatedLoans[index] };

    if (field === 'previousLoan') {
      const previousLoanValue = value as PreviousLoanOption | null;
      if (previousLoanValue?.value) {
        const selectedLoan = previousLoanValue.loanData;
        const pendingAmount = Math.round(parseFloat(selectedLoan.pendingAmountStored || selectedLoan.pendingAmount || '0')).toString();
        
        updatedLoan = {
          ...updatedLoan,
          previousLoanOption: previousLoanValue,
          previousLoan: { ...selectedLoan, pendingAmount },
          borrower: selectedLoan.borrower,
          avalName: selectedLoan.collaterals?.[0]?.fullName || '',
          avalPhone: selectedLoan.collaterals?.[0]?.phones?.[0]?.number || '',
          selectedCollateralId: selectedLoan.collaterals?.[0]?.id,
          selectedCollateralPhoneId: selectedLoan.collaterals?.[0]?.phones?.[0]?.id,
          avalAction: selectedLoan.collaterals && selectedLoan.collaterals.length > 0 ? 'connect' : 'clear',
          loantype: selectedLoan.loantype,
          requestedAmount: selectedLoan.requestedAmount,
          comissionAmount: '0',
        };
      } else {
        updatedLoan = {
          ...updatedLoan,
          previousLoanOption: null,
          previousLoan: undefined,
          borrower: { 
            id: '', 
            personalData: { 
              id: '', 
              fullName: '', 
              phones: [{ id: '', number: '' }] 
            } 
          },
          avalName: '',
          avalPhone: '',
          selectedCollateralId: undefined,
          selectedCollateralPhoneId: undefined,
          avalAction: 'clear',
          collaterals: [],
          loantype: undefined,
          requestedAmount: '',
          comissionAmount: '0',
          amountGived: '',
          amountToPay: ''
        };
      }
    } else if (field === 'loantype') {
      updatedLoan.loantype = value;
      updatedLoan.comissionAmount = (value?.loanGrantedComission ?? 0).toString();
    } else if (field === 'clientData') {
      const clientDataValue = value as { clientName: string; clientPhone: string };
      updatedLoan.borrower = {
        id: updatedLoan.borrower?.id || '',
        personalData: {
          id: updatedLoan.borrower?.personalData?.id || '',
          fullName: clientDataValue.clientName,
          phones: [{ id: updatedLoan.borrower?.personalData?.phones?.[0]?.id || '', number: clientDataValue.clientPhone }]
        }
      };
    } else if (field === 'avalData') {
      const avalDataValue = value as { avalName: string; avalPhone: string; selectedCollateralId?: string; selectedCollateralPhoneId?: string; avalAction: 'create' | 'update' | 'connect' | 'clear' };
      updatedLoan = {
        ...updatedLoan,
        avalName: avalDataValue.avalName,
        avalPhone: avalDataValue.avalPhone,
        selectedCollateralId: avalDataValue.selectedCollateralId,
        selectedCollateralPhoneId: avalDataValue.selectedCollateralPhoneId,
        avalAction: avalDataValue.avalAction,
      };
    } else {
      updatedLoan = { ...updatedLoan, [field]: value };
    }

    // Calcular montos si cambian campos relevantes
    if (['requestedAmount', 'loantype', 'previousLoan', 'comissionAmount'].includes(field)) {
      const { amountGived, amountToPay, totalDebtAcquired } = calculateLoanAmounts({
        requestedAmount: updatedLoan.requestedAmount || '0',
        pendingAmount: updatedLoan.previousLoan?.pendingAmount || '0',
        rate: updatedLoan.loantype?.rate || '0',
      });
      
      // Calculate delivered amount: amountGived from calculateLoanAmounts minus commission
      const commission = parseFloat(updatedLoan.comissionAmount || '0');
      const deliveredAmount = parseFloat(amountGived) - commission;
      
      updatedLoan.amountGived = deliveredAmount.toFixed(2);
      updatedLoan.amountToPay = amountToPay;
      updatedLoan.totalDebtAcquired = totalDebtAcquired;
    }

    updatedLoans[index] = updatedLoan;
    setModalLoans(updatedLoans);

    // Validar el préstamo actualizado y actualizar errores
    const validation = validateLoanData(updatedLoan);
    setValidationErrors(prev => ({
      ...prev,
      [updatedLoan.id]: validation.errors
    }));

    // Ocultar resumen si ya no hay errores
    if (!validation.isValid) {
      setShowValidationSummary(true);
    }
  };

  const handleSave = () => {
    // Validar todos los préstamos
    const allErrors: Record<string, ValidationError[]> = {};
    let hasErrors = false;

    modalLoans.forEach((loan) => {
      const validation = validateLoanData(loan);
      if (!validation.isValid) {
        allErrors[loan.id] = validation.errors;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setValidationErrors(allErrors);
      setShowValidationSummary(true);
      showToast('error', 'Por favor completa todos los campos requeridos');
      return;
    }

    const validLoans = modalLoans.filter(loan => 
      loan.borrower?.personalData?.fullName?.trim() &&
      loan.loantype?.id &&
      loan.requestedAmount &&
      parseFloat(loan.requestedAmount) > 0
    );

    if (validLoans.length > 0) {
      onSave(validLoans);
      // Note: Success toast will be shown after actual database save in CreditosTabNew
      setModalLoans([{
        id: `modal-loan-${Date.now()}`,
        requestedAmount: '',
        amountGived: '',
        amountToPay: '',
        pendingAmount: '0',
        signDate: selectedDate?.toISOString() || '',
        comissionAmount: '0',
        avalName: '',
        avalPhone: '',
        selectedCollateralId: undefined,
        selectedCollateralPhoneId: undefined,
        avalAction: 'clear' as const,
        collaterals: [],
        loantype: undefined,
        borrower: { 
          id: '', 
          personalData: { 
            id: '', 
            fullName: '', 
            phones: [{ id: '', number: '' }] 
          } 
        },
        previousLoan: undefined,
        previousLoanOption: null,
      }]);
      onClose();
    } else {
      showToast('warning', 'No hay créditos válidos para guardar');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerContent}>
            <h2 className={styles.modalTitle}>
              Agregar Nuevos Créditos
            </h2>
            <p className={styles.modalSubtitle}>
              {selectedLead?.personalData?.fullName || 'Sin líder'} - {selectedLeadLocation?.name || 'Sin localidad'} • {selectedDate?.toLocaleDateString('es-MX') || 'Sin fecha'}
            </p>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
          >
            <X size={20} />
          </button>
        </div>

        {/* Validation Summary */}
        {showValidationSummary && validationSummary.hasErrors && (
          <div className={styles.validationSummary}>
            <div className={styles.validationSummaryIcon}>
              <AlertCircle size={20} />
            </div>
            <div className={styles.validationSummaryContent}>
              <p className={styles.validationSummaryTitle}>
                {validationSummary.loansWithErrors.length} {validationSummary.loansWithErrors.length === 1 ? 'crédito incompleto' : 'créditos incompletos'}
              </p>
              <p className={styles.validationSummaryMessage}>
                Por favor completa los campos requeridos en {validationSummary.loansWithErrors.length === 1 ? 'el crédito' : 'los créditos'} #{validationSummary.loansWithErrors.join(', #')}
              </p>
            </div>
            <button
              onClick={() => setShowValidationSummary(false)}
              className={styles.validationSummaryClose}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className={styles.modalContent}>
          <div className={styles.creditsContainer}>
            {modalLoans.map((loan, index) => {
              const loanId = loan.id || `modal-${index}`;
              const previousLoanOptions = getPreviousLoanOptions(loanId);
              const deliveredAmount = calculateDeliveredAmount(
                loan.requestedAmount || '0',
                loan.comissionAmount || '0'
              );

              return (
                <div
                  key={loanId}
                  className={styles.creditCard}
                >
                  <div className={styles.creditHeader}>
                    <h3 className={styles.creditTitle}>
                      Crédito #{index + 1}
                    </h3>
                    {modalLoans.length > 1 && (
                      <button
                        onClick={() => handleRemoveLoan(index)}
                        className={styles.removeButton}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className={styles.formSection}>
                    {/* Cliente / Renovación */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Cliente / Renovación</label>
                      
                      {/* Card de cliente seleccionado (verde o amarilla si está editando) */}
                      {loan.borrower?.personalData?.id && !isEditingClient[loanId] ? (
                        <div className={styles.selectedClientCard}>
                          <div className={styles.selectedClientContent}>
                            <div className={styles.selectedClientBadge}>
                              <span className={styles.selectedClientDot}>●</span>
                              <span>Cliente Existente</span>
                            </div>
                            <div className={styles.selectedClientInfo}>
                              <div className={styles.selectedClientName}>
                                {loan.borrower.personalData.fullName}
                              </div>
                              <div className={styles.selectedClientPhone}>
                                {loan.borrower.personalData.phones?.[0]?.number}
                              </div>
                            </div>
                          </div>
                          <div className={styles.selectedClientActions}>
                            <button
                              type="button"
                              className={styles.selectedClientEditBtn}
                              onClick={() => setIsEditingClient(prev => ({ ...prev, [loanId]: true }))}
                              title="Editar cliente"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className={styles.selectedClientClearBtn}
                              onClick={() => handleLoanChange(index, 'previousLoan', null)}
                              title="Limpiar selección"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : isEditingClient[loanId] ? (
                        <div className={styles.editingClientCard}>
                          <div className={styles.editingClientWarning}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span>Editando Cliente Existente - Los cambios afectarán el registro original</span>
                          </div>
                          <div className={styles.editingClientFields}>
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>Nombre Completo</label>
                              <input
                                type="text"
                                className={styles.fieldInput}
                                value={loan.borrower?.personalData?.fullName || ''}
                                onChange={(e) => {
                                  const currentPhone = loan.borrower?.personalData?.phones?.[0]?.number || '';
                                  handleLoanChange(index, 'clientData', { clientName: e.target.value, clientPhone: currentPhone });
                                }}
                              />
                            </div>
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>Teléfono</label>
                              <input
                                type="text"
                                className={styles.fieldInput}
                                value={loan.borrower?.personalData?.phones?.[0]?.number || ''}
                                onChange={(e) => {
                                  const currentName = loan.borrower?.personalData?.fullName || '';
                                  handleLoanChange(index, 'clientData', { clientName: currentName, clientPhone: e.target.value });
                                }}
                              />
                            </div>
                          </div>
                          <div className={styles.editingClientActions}>
                            <button
                              type="button"
                              className={styles.editingClientCancelBtn}
                              onClick={() => setIsEditingClient(prev => ({ ...prev, [loanId]: false }))}
                            >
                              Cancelar Edición
                            </button>
                            <button
                              type="button"
                              className={styles.editingClientSelectBtn}
                              onClick={() => {
                                setIsEditingClient(prev => ({ ...prev, [loanId]: false }));
                                handleLoanChange(index, 'previousLoan', null);
                              }}
                            >
                              Seleccionar Otro
                            </button>
                          </div>
                        </div>
                      ) : (
                        <ClientLoanUnifiedInput
                          loanId={loanId}
                          currentName={loan.borrower?.personalData?.fullName || ''}
                          currentPhone={loan.borrower?.personalData?.phones?.[0]?.number || ''}
                          previousLoanOption={loan.previousLoanOption}
                          previousLoan={loan.previousLoan}
                          clientPersonalDataId={loan.borrower?.personalData?.id}
                          clientPhoneId={loan.borrower?.personalData?.phones?.[0]?.id}
                          onNameChange={(name) => {
                            const currentPhone = loan.borrower?.personalData?.phones?.[0]?.number || '';
                            handleLoanChange(index, 'clientData', { clientName: name, clientPhone: currentPhone });
                          }}
                          onPhoneChange={(phone) => {
                            const currentName = loan.borrower?.personalData?.fullName || '';
                            handleLoanChange(index, 'clientData', { clientName: currentName, clientPhone: phone });
                          }}
                          onPreviousLoanSelect={(option) => {
                            handleLoanChange(index, 'previousLoan', option);
                          }}
                          onPreviousLoanClear={() => {
                            handleLoanChange(index, 'previousLoan', null);
                          }}
                          onClientDataChange={(data) => {
                            handleLoanChange(index, 'clientData', data);
                          }}
                          previousLoanOptions={previousLoanOptions}
                          isLoading={isSearchingLoansByRow[loanId] || false}
                          selectedLeadLocationId={selectedLeadLocation?.id}
                          onLocationMismatch={onLocationMismatch}
                          onSearchTextChange={(text) => onSearchTextChange(loanId, text)}
                        />
                      )}
                    </div>

                    {/* Divider */}
                    <div className={styles.divider} />

                    {/* Aval */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Aval</label>
                      
                      {/* Card de aval seleccionado */}
                      {loan.selectedCollateralId && !isEditingAval[`${loanId}-aval`] ? (
                        <div className={styles.selectedClientCard}>
                          <div className={styles.selectedClientContent}>
                            <div className={styles.selectedClientBadge}>
                              <span className={styles.selectedClientDot}>●</span>
                              <span>Cliente Existente</span>
                            </div>
                            <div className={styles.selectedClientInfo}>
                              <div className={styles.selectedClientName}>
                                {loan.avalName}
                              </div>
                              <div className={styles.selectedClientPhone}>
                                {loan.avalPhone}
                              </div>
                            </div>
                          </div>
                          <div className={styles.selectedClientActions}>
                            <button
                              type="button"
                              className={styles.selectedClientEditBtn}
                              onClick={() => setIsEditingAval(prev => ({ ...prev, [`${loanId}-aval`]: true }))}
                              title="Editar aval"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className={styles.selectedClientClearBtn}
                              onClick={() => {
                                handleLoanChange(index, 'avalData', {
                                  avalName: '',
                                  avalPhone: '',
                                  selectedCollateralId: undefined,
                                  selectedCollateralPhoneId: undefined,
                                  avalAction: 'clear'
                                });
                              }}
                              title="Limpiar selección"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : isEditingAval[`${loanId}-aval`] ? (
                        <div className={styles.editingClientCard}>
                          <div className={styles.editingClientWarning}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span>Editando Cliente Existente - Los cambios afectarán el registro original</span>
                          </div>
                          <div className={styles.editingClientFields}>
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>Nombre Completo</label>
                              <input
                                type="text"
                                className={styles.fieldInput}
                                value={loan.avalName || ''}
                                onChange={(e) => {
                                  handleLoanChange(index, 'avalData', {
                                    avalName: e.target.value,
                                    avalPhone: loan.avalPhone || '',
                                    selectedCollateralId: loan.selectedCollateralId,
                                    selectedCollateralPhoneId: loan.selectedCollateralPhoneId,
                                    avalAction: 'update'
                                  });
                                }}
                              />
                            </div>
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>Teléfono</label>
                              <input
                                type="text"
                                className={styles.fieldInput}
                                value={loan.avalPhone || ''}
                                onChange={(e) => {
                                  handleLoanChange(index, 'avalData', {
                                    avalName: loan.avalName || '',
                                    avalPhone: e.target.value,
                                    selectedCollateralId: loan.selectedCollateralId,
                                    selectedCollateralPhoneId: loan.selectedCollateralPhoneId,
                                    avalAction: 'update'
                                  });
                                }}
                              />
                            </div>
                          </div>
                          <div className={styles.editingClientActions}>
                            <button
                              type="button"
                              className={styles.editingClientCancelBtn}
                              onClick={() => setIsEditingAval(prev => ({ ...prev, [`${loanId}-aval`]: false }))}
                            >
                              Cancelar Edición
                            </button>
                            <button
                              type="button"
                              className={styles.editingClientSelectBtn}
                              onClick={() => {
                                setIsEditingAval(prev => ({ ...prev, [`${loanId}-aval`]: false }));
                                handleLoanChange(index, 'avalData', {
                                  avalName: '',
                                  avalPhone: '',
                                  selectedCollateralId: undefined,
                                  selectedCollateralPhoneId: undefined,
                                  avalAction: 'clear'
                                });
                              }}
                            >
                              Seleccionar Otro
                            </button>
                          </div>
                        </div>
                      ) : (
                        <ClientLoanUnifiedInput
                        loanId={`${loanId}-aval`}
                        currentName={loan.avalName || ''}
                        currentPhone={loan.avalPhone || ''}
                        previousLoanOption={undefined}
                        previousLoan={undefined}
                        clientPersonalDataId={loan.selectedCollateralId}
                        clientPhoneId={loan.selectedCollateralPhoneId}
                        onNameChange={(name) => {
                          const currentPhone = loan.avalPhone || '';
                          handleLoanChange(index, 'avalData', {
                            avalName: name,
                            avalPhone: currentPhone,
                            selectedCollateralId: undefined,
                            selectedCollateralPhoneId: undefined,
                            avalAction: 'create'
                          });
                        }}
                        onPhoneChange={(phone) => {
                          const currentName = loan.avalName || '';
                          handleLoanChange(index, 'avalData', {
                            avalName: currentName,
                            avalPhone: phone,
                            selectedCollateralId: undefined,
                            selectedCollateralPhoneId: undefined,
                            avalAction: 'create'
                          });
                        }}
                        onPreviousLoanSelect={() => {}}
                        onPreviousLoanClear={() => {
                          handleLoanChange(index, 'avalData', {
                            avalName: '',
                            avalPhone: '',
                            selectedCollateralId: undefined,
                            selectedCollateralPhoneId: undefined,
                            avalAction: 'clear'
                          });
                        }}
                        onClientDataChange={(data) => {
                          handleLoanChange(index, 'avalData', {
                            avalName: data.clientName,
                            avalPhone: data.clientPhone,
                            selectedCollateralId: data.selectedPersonId,
                            selectedCollateralPhoneId: data.selectedPersonPhoneId,
                            avalAction: data.action
                          });
                        }}
                        previousLoanOptions={[]}
                        mode="aval"
                        usedPersonIds={usedAvalIds}
                        borrowerLocationId={loan.borrower?.personalData?.addresses?.[0]?.location?.id}
                        selectedPersonId={loan.selectedCollateralId}
                        onLocationMismatch={onLocationMismatch}
                        namePlaceholder="Buscar o escribir nombre del aval..."
                        phonePlaceholder="Teléfono..."
                      />
                      )}
                    </div>

                    {/* Divider */}
                    <div className={styles.divider} />

                    {/* Loan Details */}
                    <div className={styles.loanDetailsGrid}>
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Tipo de Préstamo</label>
                        <select
                          className={`${styles.fieldInput} ${hasFieldError(loanId, 'Tipo de préstamo') ? styles.error : ''}`}
                          value={loan.loantype?.id || ''}
                          onChange={(e) => {
                            const selectedType = loanTypeOptions.find(opt => opt.value === e.target.value);
                            if (selectedType) {
                              handleLoanChange(index, 'loantype', selectedType.typeData);
                            }
                          }}
                        >
                          <option value="">Seleccionar tipo</option>
                          {loanTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {getFieldError(loanId, 'Tipo de préstamo') && (
                          <div className={styles.fieldError}>
                            <AlertCircle size={14} />
                            {getFieldError(loanId, 'Tipo de préstamo')}
                          </div>
                        )}
                      </div>

                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Monto Solicitado</label>
                        <input
                          type="number"
                          className={`${styles.fieldInput} ${hasFieldError(loanId, 'Monto solicitado') ? styles.error : ''}`}
                          placeholder="0"
                          value={loan.requestedAmount || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            handleLoanChange(index, 'requestedAmount', value);
                          }}
                        />
                        {getFieldError(loanId, 'Monto solicitado') && (
                          <div className={styles.fieldError}>
                            <AlertCircle size={14} />
                            {getFieldError(loanId, 'Monto solicitado')}
                          </div>
                        )}
                      </div>

                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Comisión</label>
                        <input
                          type="number"
                          className={styles.fieldInput}
                          placeholder="0"
                          value={loan.comissionAmount || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            handleLoanChange(index, 'comissionAmount', value);
                          }}
                        />
                      </div>

                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Monto Entregado</label>
                        <input
                          type="text"
                          className={styles.fieldInput}
                          value={formatCurrency(parseFloat(loan.amountGived || '0'))}
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={handleAddLoan} className={styles.addCreditButton}>
            <Plus size={16} />
            Agregar Otro Crédito
          </button>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.footerContent}>
            <div className={styles.totalsSection}>
              <div className={styles.totalItem}>
                <p className={styles.totalLabel}>Total Solicitado</p>
                <p className={`${styles.totalValue} ${styles.requested}`}>
                  {formatCurrency(totals.requested)}
                </p>
              </div>
              <div className={styles.totalItem}>
                <p className={styles.totalLabel}>Total a Entregar</p>
                <p className={`${styles.totalValue} ${styles.delivered}`}>
                  {formatCurrency(totals.delivered)}
                </p>
              </div>
            </div>
            <div className={styles.footerActions}>
              <button onClick={onClose} className={`${styles.footerButton} ${styles.cancel}`}>
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                disabled={!canSave}
                className={`${styles.footerButton} ${styles.save}`}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
          <p className={styles.completedText}>
            {completedCount} de {modalLoans.length} créditos completados
          </p>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmation.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelDelete();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar crédito?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar el crédito de{' '}
              <strong>{deleteConfirmation.clientName}</strong> por un monto de{' '}
              <strong>{formatCurrency(parseFloat(deleteConfirmation.amount || '0'))}</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
