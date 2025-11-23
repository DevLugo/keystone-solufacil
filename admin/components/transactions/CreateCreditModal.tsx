import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useMutation, gql } from '@apollo/client';
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
import { CREATE_LOANS_BULK } from '../../graphql/mutations/loans';
import type {
  ExtendedLoanForCredits,
  LoanTypeOption,
  PreviousLoanOption,
  LeadInfo,
  LocationInfo,
  Loan
} from '../../types/loan';
import styles from './CreateCreditModal.module.css';

// Mutación para actualizar información personal
const UPDATE_PERSONAL_DATA = gql`
  mutation UpdatePersonalData($where: PersonalDataWhereUniqueInput!, $data: PersonalDataUpdateInput!) {
    updatePersonalData(where: $where, data: $data) {
      id
      fullName
      phones {
        id
        number
      }
    }
  }
`;

// Mutación para actualizar teléfono
const UPDATE_PHONE = gql`
  mutation UpdatePhone($where: PhoneWhereUniqueInput!, $data: PhoneUpdateInput!) {
    updatePhone(where: $where, data: $data) {
      id
      number
      personalData {
        id
        fullName
      }
    }
  }
`;

// Mutación para crear teléfono
const CREATE_PHONE = gql`
  mutation CreatePhone($data: PhoneCreateInput!) {
    createPhone(data: $data) {
      id
      number
      personalData {
        id
        fullName
      }
    }
  }
`;

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
  allPreviousLoansData?: { loans: Loan[] };
  onBalanceUpdate?: (balance: number) => void;
  refetchRoute: () => Promise<any>;
  refetchLoans: () => Promise<any>;
  triggerRefresh: () => void;
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
  allPreviousLoansData,
  onBalanceUpdate,
  refetchRoute,
  refetchLoans,
  triggerRefresh,
}) => {
  const { showToast } = useToast();

  // Mutación para crear múltiples préstamos
  const [createMultipleLoans] = useMutation(CREATE_LOANS_BULK);

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
  const [touchedFields, setTouchedFields] = useState<Record<string, Record<string, boolean>>>({});
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  const [isValidationSummaryExpanded, setIsValidationSummaryExpanded] = useState(false);
  const [isSavingPersonalData, setIsSavingPersonalData] = useState<Record<string, boolean>>({});
  const [hasNoPhoneByLoanId, setHasNoPhoneByLoanId] = useState<Record<string, boolean>>({});
  // Guardar valores originales cuando se entra en modo de edición
  const [originalClientData, setOriginalClientData] = useState<Record<string, { name: string; phone: string }>>({});
  const [originalAvalData, setOriginalAvalData] = useState<Record<string, { name: string; phone: string }>>({});

  // Mutaciones para actualizar información personal
  const [updatePersonalData] = useMutation(UPDATE_PERSONAL_DATA);
  const [updatePhone] = useMutation(UPDATE_PHONE);
  const [createPhone] = useMutation(CREATE_PHONE);

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

  // Estado para el diálogo de confirmación de cierre
  const [closeConfirmation, setCloseConfirmation] = useState(false);

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
    const loansWithErrors: Array<{ index: number; errors: ValidationError[] }> = [];
    let totalErrors = 0;

    modalLoans.forEach((loan, index) => {
      const loanId = loan.id || `modal-${index}`;
      const validation = validateLoanData(loan, {
        hasNoClientPhone: hasNoPhoneByLoanId[`${loanId}-client-phone`] || false,
        hasNoAvalPhone: hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false
      });
      if (!validation.isValid) {
        loansWithErrors.push({
          index: index + 1,
          errors: validation.errors
        });
        totalErrors += validation.errors.length;
      }
    });

    return {
      loansWithErrors,
      totalErrors,
      hasErrors: loansWithErrors.length > 0
    };
  }, [modalLoans, hasNoPhoneByLoanId]);

  // Determinar si el botón de guardar debe estar habilitado
  const canSave = useMemo(() => {
    return completedCount > 0 && !validationSummary.hasErrors;
  }, [completedCount, validationSummary.hasErrors]);

  // Detectar si hay cambios en progreso (créditos con datos)
  const hasChangesInProgress = useMemo(() => {
    return modalLoans.some(loan =>
      loan.borrower?.personalData?.fullName?.trim() ||
      loan.borrower?.personalData?.phones?.[0]?.number?.trim() ||
      loan.avalName?.trim() ||
      loan.avalPhone?.trim() ||
      loan.requestedAmount?.trim() ||
      loan.loantype?.id
    );
  }, [modalLoans]);

  // Función para limpiar el estado del modal
  const resetModalState = () => {
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
    setIsEditingClient({});
    setIsEditingAval({});
    setValidationErrors({});
    setTouchedFields({});
    setShowValidationSummary(false);
    setIsValidationSummaryExpanded(false);
    setIsSavingPersonalData({});
    setHasNoPhoneByLoanId({});
    setOriginalClientData({});
    setOriginalAvalData({});
  };

  // Manejar el cierre del modal
  const handleClose = () => {
    if (hasChangesInProgress) {
      setCloseConfirmation(true);
    } else {
      resetModalState();
      onClose();
    }
  };

  // Confirmar cierre y perder cambios
  const handleConfirmClose = () => {
    setCloseConfirmation(false);
    resetModalState();
    onClose();
  };

  // Cancelar cierre
  const handleCancelClose = () => {
    setCloseConfirmation(false);
  };

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
    // Si no está tocado, no mostrar error (excepto si se intentó guardar, que marcaremos todo como tocado)
    const isTouched = touchedFields[loanId]?.[fieldName];
    if (!isTouched) return undefined;

    const errors = validationErrors[loanId] || [];
    const error = errors.find(e => e.field === fieldName);
    return error?.message;
  };

  // Helper para verificar si un campo tiene error
  const hasFieldError = (loanId: string, fieldName: string): boolean => {
    const isTouched = touchedFields[loanId]?.[fieldName];
    if (!isTouched) return false;

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

  const handleSavePersonalData = async (loanId: string, index: number, isAval: boolean = false) => {
    const loan = modalLoans[index];
    const personalDataId = isAval
      ? loan.selectedCollateralId
      : loan.borrower?.personalData?.id;

    if (!personalDataId) {
      showToast('error', 'No se puede guardar: ID de persona no encontrado');
      return;
    }

    const fullName = isAval ? loan.avalName : loan.borrower?.personalData?.fullName;
    const phoneNumber = isAval ? loan.avalPhone : loan.borrower?.personalData?.phones?.[0]?.number;
    const phoneId = isAval ? loan.selectedCollateralPhoneId : loan.borrower?.personalData?.phones?.[0]?.id;

    // Cuando isAval es true, el loanId que se pasa ya incluye '-aval' (ej: 'modal-loan-123-aval')
    // Pero en el estado se usa 'loanId-aval-phone' donde loanId es el base (ej: 'modal-loan-123')
    // Necesitamos extraer el loanId base removiendo el sufijo '-aval'
    const baseLoanId = isAval && loanId.endsWith('-aval')
      ? loanId.replace(/-aval$/, '')
      : loanId;
    const hasNoPhone = isAval
      ? (hasNoPhoneByLoanId[`${baseLoanId}-aval-phone`] || false)
      : (hasNoPhoneByLoanId[`${loanId}-client-phone`] || false);

    // Validar nombre
    if (!fullName?.trim()) {
      showToast('error', 'El nombre es requerido');
      return;
    }

    // Validar teléfono solo si no está marcado como "sin teléfono"
    if (!hasNoPhone) {
      if (!phoneNumber?.trim()) {
        // Agregar error de validación
        setValidationErrors(prev => ({
          ...prev,
          [loanId]: [
            ...(prev[loanId] || []),
            { field: isAval ? 'Teléfono del aval' : 'Teléfono del cliente', message: 'El teléfono es requerido' }
          ]
        }));
        showToast('error', 'El teléfono es requerido');
        return;
      }

      // Validar formato del teléfono (10 dígitos)
      const digitsOnly = phoneNumber.trim().replace(/\D/g, '');
      if (digitsOnly.length !== 10) {
        // Agregar error de validación
        setValidationErrors(prev => ({
          ...prev,
          [loanId]: [
            ...(prev[loanId] || []),
            { field: isAval ? 'Teléfono del aval' : 'Teléfono del cliente', message: 'Ingresa un número de teléfono válido (10 dígitos)' }
          ]
        }));
        showToast('error', 'Ingresa un número de teléfono válido (10 dígitos)');
        return;
      }
    }

    // Limpiar errores de validación antes de guardar
    setValidationErrors(prev => {
      const errors = prev[loanId] || [];
      const filtered = errors.filter(e =>
        e.field !== (isAval ? 'Teléfono del aval' : 'Teléfono del cliente')
      );
      const updated = { ...prev };
      if (filtered.length > 0) {
        updated[loanId] = filtered;
      } else {
        delete updated[loanId];
      }
      return updated;
    });

    try {
      setIsSavingPersonalData(prev => ({ ...prev, [loanId]: true }));

      // Actualizar nombre
      await updatePersonalData({
        variables: {
          where: { id: personalDataId },
          data: {
            fullName: fullName.trim()
          }
        }
      });

      // Manejar teléfono solo si no está marcado como "sin teléfono"
      if (!hasNoPhone && phoneNumber?.trim()) {
        const trimmedPhone = phoneNumber.trim();
        if (phoneId) {
          // Actualizar teléfono existente
          await updatePhone({
            variables: {
              where: { id: phoneId },
              data: { number: trimmedPhone }
            }
          });
        } else {
          // Crear nuevo teléfono
          await createPhone({
            variables: {
              data: {
                number: trimmedPhone,
                personalData: {
                  connect: {
                    id: personalDataId
                  }
                }
              }
            }
          });
        }
      }

      showToast('success', 'Información actualizada exitosamente');

      // Actualizar el estado local del modal con los datos guardados
      setModalLoans(prev => {
        const updated = [...prev];
        if (updated[index]) {
          if (isAval) {
            updated[index] = {
              ...updated[index],
              avalName: fullName.trim(),
              avalPhone: hasNoPhone ? '' : (phoneNumber?.trim() || ''),
              selectedCollateralId: loan.selectedCollateralId,
              selectedCollateralPhoneId: phoneId || loan.selectedCollateralPhoneId
            };
          } else {
            updated[index] = {
              ...updated[index],
              borrower: {
                ...updated[index].borrower,
                id: updated[index].borrower?.id || '',
                personalData: {
                  ...updated[index].borrower?.personalData,
                  id: personalDataId,
                  fullName: fullName.trim(),
                  phones: hasNoPhone ? [] : [{
                    id: phoneId || '',
                    number: phoneNumber?.trim() || ''
                  }]
                }
              }
            };
          }
        }
        return updated;
      });

      // Cerrar el modo de edición PRIMERO para que el UI se actualice inmediatamente
      // Nota: cuando isAval es true, el loanId que se pasa ya incluye el sufijo '-aval' (ej: 'modal-loan-123-aval')
      // El estado isEditingAval usa este mismo formato, así que podemos usar loanId directamente
      if (isAval) {
        setIsEditingAval(prev => {
          const updated = { ...prev };
          delete updated[loanId];
          return { ...updated };
        });
      } else {
        setIsEditingClient(prev => {
          const updated = { ...prev };
          delete updated[loanId];
          return { ...updated };
        });
      }

      // Refrescar los datos del préstamo para obtener los valores actualizados de la base de datos
      await refetchLoans();

      // Limpiar valores originales ya que se guardaron los cambios
      if (isAval) {
        setOriginalAvalData(prev => {
          const updated = { ...prev };
          delete updated[loanId]; // loanId ya es `${loanId}-aval`
          return updated;
        });
      } else {
        setOriginalClientData(prev => {
          const updated = { ...prev };
          delete updated[loanId];
          return updated;
        });
      }
    } catch (error) {
      console.error('Error al actualizar información personal:', error);
      showToast('error', 'Error al actualizar la información');
    } finally {
      setIsSavingPersonalData(prev => ({ ...prev, [loanId]: false }));
    }
  };

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
      const previousLoanValue = value as any;
      
      // Caso 1: Es una renovación válida (tiene datos del préstamo anterior)
      if (previousLoanValue?.value && previousLoanValue.loanData) {
        const selectedLoan = previousLoanValue.loanData;
        const pendingAmount = Math.round(parseFloat(selectedLoan.pendingAmountStored || selectedLoan.pendingAmount || '0')).toString();

        // Buscar el tipo de préstamo para obtener la comisión por defecto
        const selectedType = loanTypeOptions.find(opt => opt.value === selectedLoan.loantype?.id)?.typeData;
        // Usar loanGrantedComission si está disponible, de lo contrario usar loanPaymentComission o 0
        const commission = (selectedType as any)?.loanGrantedComission ?? (selectedType?.loanPaymentComission ?? 0);

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
          comissionAmount: commission.toString(),
        };
      } 
      // Caso 2: Es una selección de persona existente pero SIN crédito previo (no es renovación)
      else if (previousLoanValue?.value) {
        const personData = previousLoanValue.personData || {};
        const fullName = personData.fullName || previousLoanValue.label || '';
        const phones = personData.phones || [];
        const phone = phones.length > 0 ? phones[0].number : '';
        const phoneId = phones.length > 0 ? phones[0].id : '';

        updatedLoan = {
          ...updatedLoan,
          previousLoanOption: null, // Importante: null para que no se marque como renovación
          previousLoan: undefined,
          borrower: {
            id: '', // ID vacío porque será un nuevo préstamo
            personalData: {
              id: previousLoanValue.value,
              fullName: fullName,
              phones: [{ id: phoneId, number: phone }]
            }
          },
          // Limpiar datos de aval anteriores
          avalName: '',
          avalPhone: '',
          selectedCollateralId: undefined,
          selectedCollateralPhoneId: undefined,
          avalAction: 'clear',
          collaterals: [],
          // No sobrescribimos loantype ni montos para permitir que el usuario los llene
        };
      }
      // Caso 3: Se limpió la selección
      else {
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
      // Usar loanGrantedComission si está disponible, de lo contrario usar loanPaymentComission o 0
      const commission = (value as any)?.loanGrantedComission ?? (value?.loanPaymentComission ?? 0);
      updatedLoan.comissionAmount = commission.toString();
    } else if (field === 'clientData') {
      const clientDataValue = value as { clientName: string; clientPhone: string; selectedPersonId?: string };
      updatedLoan.borrower = {
        id: updatedLoan.borrower?.id || '',
        personalData: {
          id: clientDataValue.selectedPersonId || updatedLoan.borrower?.personalData?.id || '',
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

      // ✅ CORREGIDO: Usar amountGived directamente sin restar comisión
      // La comisión es un cargo adicional, no se resta del monto entregado
      // Fórmula: amountGived = requestedAmount - pendingAmount
      updatedLoan.amountGived = amountGived;
      updatedLoan.amountToPay = amountToPay;
      updatedLoan.totalDebtAcquired = totalDebtAcquired;
    }

    updatedLoans[index] = updatedLoan;
    setModalLoans(updatedLoans);

    // Marcar campo como tocado
    setTouchedFields(prev => {
      const loanTouched = prev[updatedLoan.id] || {};
      let fieldsToMark: string[] = [];

      if (field === 'clientData') {
        fieldsToMark = ['Nombre del cliente', 'Teléfono del cliente'];
      } else if (field === 'avalData') {
        fieldsToMark = ['Nombre del aval', 'Teléfono del aval'];
      } else if (field === 'loantype') {
        fieldsToMark = ['Tipo de préstamo'];
      } else if (field === 'requestedAmount') {
        fieldsToMark = ['Monto solicitado'];
      }

      if (fieldsToMark.length > 0) {
        const newLoanTouched = { ...loanTouched };
        fieldsToMark.forEach(f => newLoanTouched[f] = true);
        return { ...prev, [updatedLoan.id]: newLoanTouched };
      }
      return prev;
    });

    // Validar el préstamo actualizado y actualizar errores
    const validation = validateLoanData(updatedLoan, {
      hasNoClientPhone: hasNoPhoneByLoanId[`${updatedLoan.id}-client-phone`] || false,
      hasNoAvalPhone: hasNoPhoneByLoanId[`${updatedLoan.id}-aval-phone`] || false
    });
    setValidationErrors(prev => ({
      ...prev,
      [updatedLoan.id]: validation.errors
    }));

    // NO mostrar resumen automáticamente al cambiar inputs
  };

  const handleShowErrors = () => {
    // Validar todos los préstamos
    const allErrors: Record<string, ValidationError[]> = {};
    let hasErrors = false;

    modalLoans.forEach((loan) => {
      const loanId = loan.id;
      const validation = validateLoanData(loan, {
        hasNoClientPhone: hasNoPhoneByLoanId[`${loanId}-client-phone`] || false,
        hasNoAvalPhone: hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false
      });
      if (!validation.isValid) {
        allErrors[loan.id] = validation.errors;
        hasErrors = true;
      }
    });

    // Marcar todos los campos como tocados para mostrar errores o campos faltantes
    const allTouched: Record<string, Record<string, boolean>> = {};
    modalLoans.forEach(loan => {
      allTouched[loan.id] = {
        'Nombre del cliente': true,
        'Teléfono del cliente': true,
        'Nombre del aval': true,
        'Teléfono del aval': true,
        'Tipo de préstamo': true,
        'Monto solicitado': true
      };
    });
    setTouchedFields(allTouched);

    if (hasErrors) {
      setValidationErrors(allErrors);
      setShowValidationSummary(true);
      showToast('error', 'Por favor corrige los errores marcados');
    } else {
      showToast('warning', 'Por favor completa todos los campos requeridos');
    }
  };

  const handleSave = async () => {
    try {
      setIsSavingPersonalData(prev => ({ ...prev, 'saving': true }));

      // Validar todos los préstamos
      const allErrors: Record<string, ValidationError[]> = {};
      let hasErrors = false;

      modalLoans.forEach((loan) => {
        const loanId = loan.id;
        const validation = validateLoanData(loan, {
          hasNoClientPhone: hasNoPhoneByLoanId[`${loanId}-client-phone`] || false,
          hasNoAvalPhone: hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false
        });
        if (!validation.isValid) {
          allErrors[loan.id] = validation.errors;
          hasErrors = true;
        }
      });

      if (hasErrors) {
        setValidationErrors(allErrors);

        // Marcar todos los campos como tocados para mostrar errores
        const allTouched: Record<string, Record<string, boolean>> = {};
        modalLoans.forEach(loan => {
          allTouched[loan.id] = {
            'Nombre del cliente': true,
            'Teléfono del cliente': true,
            'Nombre del aval': true,
            'Teléfono del aval': true,
            'Tipo de préstamo': true,
            'Monto solicitado': true
          };
        });
        setTouchedFields(allTouched);

        setShowValidationSummary(true);
        showToast('error', 'Por favor completa todos los campos requeridos');
        setIsSavingPersonalData(prev => ({ ...prev, 'saving': false }));
        return;
      }

      const validLoans = modalLoans.filter(loan =>
        loan.borrower?.personalData?.fullName?.trim() &&
        loan.loantype?.id &&
        loan.requestedAmount &&
        parseFloat(loan.requestedAmount) > 0
      );

      if (validLoans.length === 0) {
        showToast('warning', 'No hay préstamos válidos para guardar');
        setIsSavingPersonalData(prev => ({ ...prev, 'saving': false }));
        return;
      }

      // Validar clientes duplicados (solo para clientes nuevos, no para seleccionados del autocomplete o renovaciones)
      for (const loan of validLoans) {
        // Si el cliente fue seleccionado del autocomplete o es una renovación, no validar duplicados
        const isSelectedFromAutocomplete = !!(loan as any).borrower?.personalData?.id;
        const isRenewal = !!loan.previousLoan;

        if (isSelectedFromAutocomplete || isRenewal) {
          continue; // Skip validation for selected or renewal loans
        }

        const cleanName = (loan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' ');
        const cleanPhone = (loan.borrower?.personalData?.phones?.[0]?.number || '').trim().replace(/\s+/g, ' ');

        if (cleanName && cleanPhone) {
          const existingClient = allPreviousLoansData?.loans?.find((existingLoan: Loan) => {
            const existingName = (existingLoan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' ');
            const existingPhone = (existingLoan.borrower?.personalData?.phones?.[0]?.number || '').trim().replace(/\s+/g, ' ');
            return existingName.toLowerCase() === cleanName.toLowerCase() &&
              existingPhone === cleanPhone;
          });

          if (existingClient) {
            showToast('error', `El cliente "${cleanName}" ya ha tenido créditos anteriormente, usa la opción de renovación`);
            setIsSavingPersonalData(prev => ({ ...prev, 'saving': false }));
            return;
          }
        }
      }

      // Preparar datos para la mutación
      const loansData = validLoans.map(loan => {
        const phoneNumber = loan.borrower?.personalData?.phones?.[0]?.number || '';

        return {
          requestedAmount: (loan.requestedAmount || '0').toString(),
          amountGived: (loan.amountGived || '0').toString(),
          signDate: loan.signDate || selectedDate?.toISOString() || '',
          comissionAmount: (loan.comissionAmount || '0').toString(),
          leadId: selectedLead?.id || '',
          loantypeId: loan.loantype?.id || '',
          previousLoanId: loan.previousLoan?.id || undefined,
          borrowerData: {
            fullName: (loan.borrower?.personalData?.fullName || '').trim().replace(/\s+/g, ' '),
            phone: phoneNumber.trim().replace(/\s+/g, ' '),
            personalDataId: loan.borrower?.personalData?.id || undefined
          },
          avalData: {
            selectedCollateralId: loan.selectedCollateralId || undefined,
            action: loan.avalAction || 'clear',
            name: (loan.avalName || '').trim().replace(/\s+/g, ' '),
            phone: (loan.avalPhone || '').trim().replace(/\s+/g, ' ')
          }
        };
      });

      // Ejecutar la mutación
      const { data } = await createMultipleLoans({ variables: { loans: loansData } });

      if (data?.createMultipleLoans) {
        // Verificar errores en la respuesta
        const responses = data.createMultipleLoans as Array<{ success: boolean; message?: string; loan?: Loan }>;
        const errorResponse = responses.find((response) => !response.success);

        if (errorResponse) {
          showToast('error', errorResponse.message || 'Error desconocido al crear el préstamo');
          setIsSavingPersonalData(prev => ({ ...prev, 'saving': false }));
          return;
        }

        // Refrescar datos
        await Promise.all([refetchRoute(), refetchLoans()]);

        // Actualizar balance
        if (onBalanceUpdate) {
          const totalAmount = responses.reduce((sum, response) =>
            sum + parseFloat(response.loan?.amountGived || '0'), 0
          );
          onBalanceUpdate(-totalAmount);
        }

        // Mostrar mensaje de éxito
        showToast('success', `${validLoans.length} crédito(s) guardado(s) exitosamente`);

        // Triggear refresh de balances
        triggerRefresh();

        // Limpiar estado y cerrar modal
        resetModalState();
        onClose();
      }
    } catch (error) {
      console.error('❌ Error al crear los préstamos:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al crear los préstamos. Por favor, intenta de nuevo.';
      showToast('error', errorMessage);
    } finally {
      setIsSavingPersonalData(prev => ({ ...prev, 'saving': false }));
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
            onClick={handleClose}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <p className={styles.validationSummaryTitle}>
                  {validationSummary.totalErrors} {validationSummary.totalErrors === 1 ? 'error encontrado' : 'errores encontrados'} en {validationSummary.loansWithErrors.length} {validationSummary.loansWithErrors.length === 1 ? 'crédito' : 'créditos'}
                </p>
                <button
                  onClick={() => setIsValidationSummaryExpanded(!isValidationSummaryExpanded)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#DC2626',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    marginLeft: '12px'
                  }}
                >
                  {isValidationSummaryExpanded ? 'Ver menos' : 'Ver detalles'}
                </button>
              </div>

              {/* Mostrar solo el primer error si no está expandido */}
              {!isValidationSummaryExpanded && validationSummary.loansWithErrors.length > 0 && (
                <div className={styles.validationSummaryMessage} style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '13px' }}>
                    Crédito #{validationSummary.loansWithErrors[0].index}: {validationSummary.loansWithErrors[0].errors[0].message}
                    {validationSummary.totalErrors > 1 && ' ...'}
                  </span>
                </div>
              )}

              {/* Mostrar todos los errores si está expandido */}
              {isValidationSummaryExpanded && (
                <div className={styles.validationSummaryMessage} style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {validationSummary.loansWithErrors.map(({ index, errors }) => (
                    <div key={index} style={{ marginBottom: '8px' }}>
                      <strong>Crédito #{index}:</strong>
                      <ul style={{ margin: '4px 0 0 20px', padding: 0, listStyle: 'disc' }}>
                        {errors.map((error, errorIndex) => (
                          <li key={errorIndex} style={{ marginBottom: '4px', fontSize: '13px' }}>
                            {error.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className={styles.selectedClientName}>
                                  {loan.borrower.personalData.fullName}
                                </div>
                                {/* Badge de deuda pendiente - justo después del nombre */}
                                {loan.previousLoan?.pendingAmount && (
                                  <>
                                    {parseFloat(loan.previousLoan.pendingAmount) > 0 ? (
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        color: '#DC2626',
                                        backgroundColor: '#FEE2E2',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        💰 Deuda: ${parseFloat(loan.previousLoan.pendingAmount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        color: '#059669',
                                        backgroundColor: '#D1FAE5',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        ✓ Sin deuda
                                      </span>
                                    )}
                                  </>
                                )}
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
                              onClick={() => {
                                // Guardar valores originales antes de entrar en modo de edición
                                setOriginalClientData(prev => ({
                                  ...prev,
                                  [loanId]: {
                                    name: loan.borrower?.personalData?.fullName || '',
                                    phone: loan.borrower?.personalData?.phones?.[0]?.number || ''
                                  }
                                }));
                                setIsEditingClient(prev => ({ ...prev, [loanId]: true }));
                              }}
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
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="text"
                                  className={styles.fieldInput}
                                  value={loan.borrower?.personalData?.phones?.[0]?.number || ''}
                                  onChange={(e) => {
                                    const currentName = loan.borrower?.personalData?.fullName || '';
                                    handleLoanChange(index, 'clientData', { clientName: currentName, clientPhone: e.target.value });
                                    // Si se escribe algo, desmarcar "sin teléfono"
                                    if (e.target.value.trim() !== '') {
                                      setHasNoPhoneByLoanId(prev => ({
                                        ...prev,
                                        [`${loanId}-client-phone`]: false
                                      }));
                                    }
                                  }}
                                  disabled={(hasNoPhoneByLoanId[`${loanId}-client-phone`] || false)}
                                  style={{
                                    width: '100%',
                                    paddingRight: '40px'
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentHasNoPhone = hasNoPhoneByLoanId[`${loanId}-client-phone`] || false;
                                    if (currentHasNoPhone) {
                                      // Desmarcar "sin teléfono"
                                      setHasNoPhoneByLoanId(prev => ({
                                        ...prev,
                                        [`${loanId}-client-phone`]: false
                                      }));
                                    } else {
                                      // Marcar como "sin teléfono" y limpiar
                                      setHasNoPhoneByLoanId(prev => ({
                                        ...prev,
                                        [`${loanId}-client-phone`]: true
                                      }));
                                      const currentName = loan.borrower?.personalData?.fullName || '';
                                      handleLoanChange(index, 'clientData', { clientName: currentName, clientPhone: '' });
                                    }
                                  }}
                                  style={{
                                    position: 'absolute',
                                    right: '6px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '28px',
                                    height: '28px',
                                    padding: '0',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: (hasNoPhoneByLoanId[`${loanId}-client-phone`] || false) ? '#DC2626' : 'transparent',
                                    color: (hasNoPhoneByLoanId[`${loanId}-client-phone`] || false) ? '#FFFFFF' : '#6B7280',
                                    cursor: 'pointer',
                                    transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                                    flexShrink: 0,
                                    zIndex: 1
                                  }}
                                  onMouseEnter={(e) => {
                                    const isActive = hasNoPhoneByLoanId[`${loanId}-client-phone`] || false;
                                    if (!isActive) {
                                      e.currentTarget.style.backgroundColor = '#F3F4F6';
                                      e.currentTarget.style.color = '#374151';
                                    } else {
                                      e.currentTarget.style.backgroundColor = '#B91C1C';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    const isActive = hasNoPhoneByLoanId[`${loanId}-client-phone`] || false;
                                    if (!isActive) {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                      e.currentTarget.style.color = '#6B7280';
                                    } else {
                                      e.currentTarget.style.backgroundColor = '#DC2626';
                                    }
                                  }}
                                  title={(hasNoPhoneByLoanId[`${loanId}-client-phone`] || false) ? 'Hacer clic para agregar teléfono' : 'Marcar como sin teléfono'}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className={styles.editingClientActions}>
                            <button
                              type="button"
                              className={styles.editingClientCancelBtn}
                              onClick={() => {
                                // Restaurar valores originales al cancelar
                                const original = originalClientData[loanId];
                                if (original) {
                                  handleLoanChange(index, 'clientData', {
                                    clientName: original.name,
                                    clientPhone: original.phone
                                  });
                                  // Restaurar estado de "sin teléfono" si el teléfono original estaba vacío
                                  if (!original.phone || original.phone.trim() === '') {
                                    setHasNoPhoneByLoanId(prev => ({
                                      ...prev,
                                      [`${loanId}-client-phone`]: true
                                    }));
                                  } else {
                                    setHasNoPhoneByLoanId(prev => ({
                                      ...prev,
                                      [`${loanId}-client-phone`]: false
                                    }));
                                  }
                                }
                                setIsEditingClient(prev => ({ ...prev, [loanId]: false }));
                              }}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className={styles.editingClientSaveBtn}
                              onClick={() => handleSavePersonalData(loanId, index, false)}
                              disabled={isSavingPersonalData[loanId]}
                            >
                              {isSavingPersonalData[loanId] ? 'Guardando...' : 'Guardar'}
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
                          leaderLocation={selectedLeadLocation?.name}
                          onLocationMismatch={onLocationMismatch}
                          onSearchTextChange={(text) => onSearchTextChange(loanId, text)}
                          nameError={getFieldError(loanId, 'Nombre del cliente')}
                          phoneError={getFieldError(loanId, 'Teléfono del cliente')}
                          onNoPhoneChange={(hasNoPhone) => {
                            setHasNoPhoneByLoanId(prev => ({
                              ...prev,
                              [`${loanId}-client-phone`]: hasNoPhone
                            }));
                          }}
                          hideErrorMessages={true}
                          allowPersonSearch={true}
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
                              onClick={() => {
                                // Guardar valores originales antes de entrar en modo de edición
                                setOriginalAvalData(prev => ({
                                  ...prev,
                                  [`${loanId}-aval`]: {
                                    name: loan.avalName || '',
                                    phone: loan.avalPhone || ''
                                  }
                                }));
                                setIsEditingAval(prev => ({ ...prev, [`${loanId}-aval`]: true }));
                              }}
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
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="text"
                                  className={`${styles.fieldInput} ${hasFieldError(`${loanId}-aval-phone`, 'Teléfono del aval') ? styles.error : ''}`}
                                  value={loan.avalPhone || ''}
                                  onChange={(e) => {
                                    handleLoanChange(index, 'avalData', {
                                      avalName: loan.avalName || '',
                                      avalPhone: e.target.value,
                                      selectedCollateralId: loan.selectedCollateralId,
                                      selectedCollateralPhoneId: loan.selectedCollateralPhoneId,
                                      avalAction: 'update'
                                    });
                                    // Si se escribe algo, desmarcar "sin teléfono"
                                    if (e.target.value.trim() !== '') {
                                      setHasNoPhoneByLoanId(prev => ({
                                        ...prev,
                                        [`${loanId}-aval-phone`]: false
                                      }));
                                    }
                                    // Limpiar error de validación cuando el usuario escribe
                                    setValidationErrors(prev => {
                                      const errors = prev[`${loanId}-aval-phone`] || [];
                                      const filtered = errors.filter(e => e.field !== 'Teléfono del aval');
                                      const updated = { ...prev };
                                      if (filtered.length > 0) {
                                        updated[`${loanId}-aval-phone`] = filtered;
                                      } else {
                                        delete updated[`${loanId}-aval-phone`];
                                      }
                                      return updated;
                                    });
                                  }}
                                  disabled={(hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false)}
                                  style={{
                                    width: '100%',
                                    paddingRight: '40px'
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentHasNoPhone = hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false;
                                    if (currentHasNoPhone) {
                                      // Desmarcar "sin teléfono"
                                      setHasNoPhoneByLoanId(prev => ({
                                        ...prev,
                                        [`${loanId}-aval-phone`]: false
                                      }));
                                    } else {
                                      // Marcar como "sin teléfono" y limpiar
                                      setHasNoPhoneByLoanId(prev => ({
                                        ...prev,
                                        [`${loanId}-aval-phone`]: true
                                      }));
                                      handleLoanChange(index, 'avalData', {
                                        avalName: loan.avalName || '',
                                        avalPhone: '',
                                        selectedCollateralId: loan.selectedCollateralId,
                                        selectedCollateralPhoneId: loan.selectedCollateralPhoneId,
                                        avalAction: 'update'
                                      });
                                    }
                                  }}
                                  style={{
                                    position: 'absolute',
                                    right: '6px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '28px',
                                    height: '28px',
                                    padding: '0',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: (hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false) ? '#DC2626' : 'transparent',
                                    color: (hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false) ? '#FFFFFF' : '#6B7280',
                                    cursor: 'pointer',
                                    transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                                    flexShrink: 0,
                                    zIndex: 1
                                  }}
                                  onMouseEnter={(e) => {
                                    const isActive = hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false;
                                    if (!isActive) {
                                      e.currentTarget.style.backgroundColor = '#F3F4F6';
                                      e.currentTarget.style.color = '#374151';
                                    } else {
                                      e.currentTarget.style.backgroundColor = '#B91C1C';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    const isActive = hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false;
                                    if (!isActive) {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                      e.currentTarget.style.color = '#6B7280';
                                    } else {
                                      e.currentTarget.style.backgroundColor = '#DC2626';
                                    }
                                  }}
                                  title={(hasNoPhoneByLoanId[`${loanId}-aval-phone`] || false) ? 'Hacer clic para agregar teléfono' : 'Marcar como sin teléfono'}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                  </svg>
                                </button>
                              </div>
                              {/* Error message removed as per request */}
                            </div>
                          </div>
                          <div className={styles.editingClientActions}>
                            <button
                              type="button"
                              className={styles.editingClientCancelBtn}
                              onClick={() => {
                                // Restaurar valores originales al cancelar
                                const original = originalAvalData[`${loanId}-aval`];
                                if (original) {
                                  handleLoanChange(index, 'avalData', {
                                    avalName: original.name,
                                    avalPhone: original.phone,
                                    selectedCollateralId: loan.selectedCollateralId,
                                    selectedCollateralPhoneId: loan.selectedCollateralPhoneId,
                                    avalAction: 'update'
                                  });
                                  // Restaurar estado de "sin teléfono" si el teléfono original estaba vacío
                                  if (!original.phone || original.phone.trim() === '') {
                                    setHasNoPhoneByLoanId(prev => ({
                                      ...prev,
                                      [`${loanId}-aval-phone`]: true
                                    }));
                                  } else {
                                    setHasNoPhoneByLoanId(prev => ({
                                      ...prev,
                                      [`${loanId}-aval-phone`]: false
                                    }));
                                  }
                                }
                                setIsEditingAval(prev => ({ ...prev, [`${loanId}-aval`]: false }));
                              }}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className={styles.editingClientSaveBtn}
                              onClick={() => handleSavePersonalData(`${loanId}-aval`, index, true)}
                              disabled={isSavingPersonalData[`${loanId}-aval`]}
                            >
                              {isSavingPersonalData[`${loanId}-aval`] ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
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
                            onPreviousLoanSelect={() => { }}
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
                            leaderLocation={loan.borrower?.personalData?.addresses?.[0]?.location?.name || selectedLeadLocation?.name}
                            selectedPersonId={loan.selectedCollateralId}
                            onLocationMismatch={onLocationMismatch}
                            namePlaceholder="Buscar o escribir nombre del aval..."
                            phonePlaceholder="Teléfono..."
                            nameError={getFieldError(loanId, 'Nombre del aval')}
                            phoneError={getFieldError(loanId, 'Teléfono del aval')}
                            onNoPhoneChange={(hasNoPhone) => {
                              setHasNoPhoneByLoanId(prev => ({
                                ...prev,
                                [`${loanId}-aval-phone`]: hasNoPhone
                              }));
                            }}
                            hideErrorMessages={true}
                          />
                        </div>
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
                        {/* Error message removed as per request */}
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
                        {/* Error message removed as per request */}
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
              <button onClick={handleClose} className={`${styles.footerButton} ${styles.cancel}`}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave || isSavingPersonalData['saving']}
                className={`${styles.footerButton} ${styles.save}`}
              >
                {isSavingPersonalData['saving'] ? 'Guardando...' : 'Guardar Créditos'}
              </button>

              {(!canSave && !isSavingPersonalData['saving']) && (
                <button
                  onClick={handleShowErrors}
                  title="Ver errores de validación"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#EF4444',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '4px'
                  }}
                >
                  <AlertCircle size={24} />
                </button>
              )}
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

      {/* Close Confirmation Dialog */}
      <AlertDialog
        open={closeConfirmation}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelClose();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={24} style={{ color: '#F59E0B', flexShrink: 0 }} />
              <AlertDialogTitle>¿Cerrar sin guardar?</AlertDialogTitle>
            </div>
            <AlertDialogDescription style={{ marginTop: '8px' }}>
              Tienes <strong>{completedCount > 0 ? completedCount : modalLoans.length}</strong> crédito(s) en progreso.
              Si cierras ahora, se perderán todos los cambios que no hayas guardado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClose}>
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              style={{ backgroundColor: '#DC2626', color: 'white' }}
            >
              Cerrar y perder cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
};
