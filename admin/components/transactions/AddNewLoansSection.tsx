/** @jsxRuntime classic */
/** @jsx jsx */
/** @jsxFrag React.Fragment */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput, Select } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { FaTrash, FaEdit } from 'react-icons/fa';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { calculateLoanAmounts } from '../../utils/loanCalculations';
import ClientLoanUnifiedInput from '../loans/ClientLoanUnifiedInput';
import AvalInputWithAutocomplete from '../loans/AvalInputWithAutocomplete';

// Queries
const GET_ALL_PREVIOUS_LOANS = gql`
  query GetAllPreviousLoans($searchText: String, $take: Int) {
    loans(
      where: {
        borrower: { 
          personalData: { 
            fullName: { 
              contains: $searchText, 
              mode: insensitive 
            } 
          } 
        }
      }
      orderBy: { signDate: desc }
      take: $take
    ) {
      id
      requestedAmount
      amountGived
      signDate
      finishedDate
      pendingAmountStored
      loantype {
        id
        name
        rate
        weekDuration
        loanPaymentComission
      }
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            id
            number
          }
          addresses {
            id
            location {
              id
              name
            }
          }
        }
      }
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
      }
      lead {
        id
        personalData {
          fullName
          addresses {
            id
            location {
              id
              name
            }
          }
        }
      }
    }
  }
`;

const GET_LOAN_TYPES = gql`
  query GetLoanTypes {
    loantypes {
      id
      name
      rate
      weekDuration
      loanPaymentComission
      loanGrantedComission
    }
  }
`;

// Types
interface ExtendedLoan {
  id: string;
  requestedAmount?: string;
  amountGived?: string;
  amountToPay?: string;
  pendingAmount?: string;
  signDate?: string;
  comissionAmount?: string;
  loantype?: {
    id: string;
    name: string;
    rate: number;
    weekDuration: number;
    loanPaymentComission: string;
  };
  borrower: {
    id: string;
    personalData: {
      id: string;
      fullName: string;
      phones: Array<{
        id: string;
        number: string;
      }>;
    };
  };
  previousLoan?: any;
  previousLoanOption?: any;
  avalName?: string;
  avalPhone?: string;
  selectedCollateralId?: string;
  selectedCollateralPhoneId?: string;
  avalAction?: 'create' | 'update' | 'connect' | 'clear';
  collaterals?: Array<any>;
}

interface AddNewLoansSectionProps {
  selectedDate: Date | null;
  selectedLead: { id: string } | null;
  onSaveLoans: (loans: ExtendedLoan[]) => Promise<void>;
  isSaving?: boolean;
  usedAvalIds?: string[];
}

// Estilos unificados
const INPUT_HEIGHT = '36px';
const ROW_PADDING_TOP = '10px';

const inputStyles = {
  height: INPUT_HEIGHT,
  fontSize: '13px',
  padding: '6px 10px',
  border: '1px solid #D1D5DB',
  borderRadius: '6px',
  backgroundColor: '#FFFFFF',
  transition: 'all 0.2s ease',
  width: '100%',
  boxSizing: 'border-box' as const,
  lineHeight: '20px',
};

const selectStyles = {
  control: (base: any) => ({ 
    ...base, 
    fontSize: '13px', 
    minHeight: INPUT_HEIGHT,
    height: INPUT_HEIGHT,
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    backgroundColor: '#FFFFFF',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
    padding: '0px'
  }),
  container: (base: any) => ({ ...base, width: '100%' }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  valueContainer: (base: any) => ({ ...base, padding: '4px 8px', height: INPUT_HEIGHT }),
  input: (base: any) => ({ ...base, margin: '0px', padding: '0px' }),
  placeholder: (base: any) => ({ ...base, margin: '0px', padding: '0px' })
};

const tableHeaderStyle: React.CSSProperties = {
  padding: '12px 8px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '12px',
  color: '#374151',
  backgroundColor: '#E0F2FE',
  borderBottom: '2px solid #B3E5FC',
  whiteSpace: 'nowrap',
};

const tableCellStyle: React.CSSProperties = {
  padding: '8px',
  borderBottom: '1px solid #E5E7EB',
  verticalAlign: 'top',
};

export const AddNewLoansSection: React.FC<AddNewLoansSectionProps> = ({
  selectedDate,
  selectedLead,
  onSaveLoans,
  isSaving = false,
  usedAvalIds = [],
}) => {
  const [pendingLoans, setPendingLoans] = useState<ExtendedLoan[]>([]);
  const [editableEmptyRow, setEditableEmptyRow] = useState<ExtendedLoan | null>(null);
  const [searchAllLeadersByRow, setSearchAllLeadersByRow] = useState<Record<string, boolean>>({});
  const [dropdownSearchTextByRow, setDropdownSearchTextByRow] = useState<Record<string, string>>({});
  const [showTooltip, setShowTooltip] = useState<Record<string, boolean>>({});

  // Queries
  const { data: allPreviousLoansData, loading: allPreviousLoansLoading, refetch: refetchAllPreviousLoans } = useQuery(GET_ALL_PREVIOUS_LOANS, {
    variables: { 
      searchText: '', 
      take: 10 
    },
  });

  const { data: loanTypesData } = useQuery(GET_LOAN_TYPES);

  // Generar ID único para préstamos temporales
  const generateLoanId = useCallback(() => `temp-loan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

  // Crear fila vacía
  const emptyLoanRow = useMemo<ExtendedLoan>(() => ({
    id: generateLoanId(),
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
  }), [selectedDate, generateLoanId]);

  // Opciones de préstamos anteriores
  const getPreviousLoanOptions = useCallback((rowId: string) => {
    const searchText = dropdownSearchTextByRow[rowId] || '';
    const loans = searchAllLeadersByRow[rowId] 
      ? allPreviousLoansData?.loans || []
      : allPreviousLoansData?.loans?.filter((loan: any) => 
          loan.lead?.id === selectedLead?.id
        ) || [];

    return loans.map((loan: any) => {
      const location = loan.borrower?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
      const leaderName = loan.lead?.personalData?.fullName || 'Sin líder';
      const pendingAmount = parseFloat(loan.pendingAmountStored || '0');
      const hasDebt = pendingAmount > 0;

      return {
        value: loan.id,
        label: `${loan.borrower?.personalData?.fullName || 'Sin nombre'} - ${loan.borrower?.personalData?.phones?.[0]?.number || 'Sin teléfono'}`,
        loanData: loan,
        hasDebt,
        statusColor: hasDebt ? '#FEF3C7' : '#D1FAE5',
        statusTextColor: hasDebt ? '#92400E' : '#065F46',
        debtColor: hasDebt ? '#DC2626' : '#059669',
        locationColor: '#3B82F6',
        location,
        debtAmount: pendingAmount.toFixed(2),
        leaderName,
      };
    });
  }, [allPreviousLoansData, selectedLead, searchAllLeadersByRow, dropdownSearchTextByRow]);

  // Manejar cambios en la fila
  const handleRowChange = useCallback((index: number, field: string, value: any, isNewRow: boolean) => {
    const sourceRow = isNewRow 
      ? (editableEmptyRow || { ...emptyLoanRow, id: generateLoanId() }) 
      : pendingLoans[index];

    let updatedRow = { ...sourceRow };

    if (field === 'previousLoan') {
      if (value?.value) {
        const selectedLoan = value.loanData;
        const pendingAmount = parseFloat(selectedLoan.pendingAmountStored || '0').toFixed(2);
        const selectedType = loanTypesData?.loantypes?.find((type: any) => type.id === selectedLoan.loantype?.id);
        
        updatedRow = {
          ...updatedRow,
          previousLoanOption: value,
          previousLoan: { ...selectedLoan, pendingAmount },
          borrower: selectedLoan.borrower as any,
          avalName: selectedLoan.collaterals?.[0]?.fullName || '',
          avalPhone: selectedLoan.collaterals?.[0]?.phones?.[0]?.number || '',
          selectedCollateralId: selectedLoan.collaterals?.[0]?.id,
          selectedCollateralPhoneId: selectedLoan.collaterals?.[0]?.phones?.[0]?.id,
          avalAction: selectedLoan.collaterals?.length > 0 ? 'connect' as const : 'clear' as const,
          loantype: selectedLoan.loantype,
          requestedAmount: selectedLoan.requestedAmount,
          comissionAmount: (selectedType?.loanGrantedComission ?? 0).toString(),
        };
      } else {
        updatedRow = { 
          ...updatedRow, 
          previousLoanOption: null, 
          previousLoan: undefined, 
          borrower: emptyLoanRow.borrower as any,
          avalName: '',
          avalPhone: '',
          selectedCollateralId: undefined,
          selectedCollateralPhoneId: undefined,
          avalAction: 'clear' as const,
          collaterals: [],
          loantype: undefined,
          requestedAmount: '',
          comissionAmount: '0',
          amountGived: '',
          amountToPay: ''
        };
      }
    } else if (field === 'loantype') {
      const selectedType = loanTypesData?.loantypes?.find((t: any) => t.id === value.value);
      updatedRow.loantype = selectedType;
      updatedRow.comissionAmount = (selectedType?.loanGrantedComission ?? 0).toString();
    } else if (field === 'clientData') {
      const currentPersonalData = updatedRow.borrower?.personalData;
      const currentPhoneId = currentPersonalData?.phones?.[0]?.id || '';
      updatedRow.borrower = { 
        ...updatedRow.borrower, 
        personalData: { 
          ...currentPersonalData, 
          fullName: value.clientName, 
          phones: [{ id: currentPhoneId, number: value.clientPhone }] 
        } 
      } as any;
    } else if (field === 'avalData') {
      const collateral = value.selectedCollateralId
        ? {
            id: value.selectedCollateralId,
            fullName: value.avalName,
            phones: [{ id: value.selectedCollateralPhoneId, number: value.avalPhone }],
          }
        : null;

      updatedRow = {
        ...updatedRow,
        collaterals: collateral ? [collateral] : [],
        selectedCollateralId: value.selectedCollateralId,
        selectedCollateralPhoneId: value.selectedCollateralPhoneId,
        avalAction: value.avalAction,
        avalName: value.avalName,
        avalPhone: value.avalPhone,
      } as ExtendedLoan;
    } else {
      updatedRow = { ...updatedRow, [field]: value };
    }

    // Calcular montos si cambian campos relevantes
    if (['requestedAmount', 'loantype', 'previousLoan'].includes(field)) {
      const { amountGived, amountToPay, totalDebtAcquired } = calculateLoanAmounts({
        requestedAmount: updatedRow.requestedAmount || '0',
        pendingAmount: updatedRow.previousLoan?.pendingAmount || '0',
        rate: updatedRow.loantype?.rate || '0',
      });
      updatedRow.amountGived = amountGived;
      updatedRow.amountToPay = amountToPay;
      updatedRow.amountToPay = totalDebtAcquired;
    }

    if (isNewRow) {
      setEditableEmptyRow(updatedRow);
    } else {
      setPendingLoans(prev => prev.map((loan, i) => i === index ? updatedRow : loan));
    }
  }, [editableEmptyRow, pendingLoans, emptyLoanRow, loanTypesData, generateLoanId]);

  // Auto-agregar a pendientes cuando tiene datos requeridos
  React.useEffect(() => {
    if (!editableEmptyRow) return;
    const hasRequiredInfo = editableEmptyRow.borrower?.personalData?.fullName?.trim() &&
                            editableEmptyRow.loantype?.id &&
                            editableEmptyRow.requestedAmount?.trim() &&
                            parseFloat(editableEmptyRow.requestedAmount) > 0;

    if (hasRequiredInfo) {
      const isAlreadyPending = pendingLoans.some(p => p.id === editableEmptyRow.id);
      if (!isAlreadyPending) {
        setPendingLoans(prev => [...prev, editableEmptyRow]);
        setEditableEmptyRow(null);
      }
    }
  }, [editableEmptyRow, pendingLoans]);

  // Opciones de tipos de préstamo
  const loanTypeOptions = useMemo(() => {
    return loanTypesData?.loantypes?.map((type: any) => ({
      value: type.id,
      label: `${type.name} (${type.weekDuration} sem, ${type.rate}%)`,
      weekDuration: type.weekDuration,
      rate: type.rate,
    })) || [];
  }, [loanTypesData]);

  // Manejar guardar todos
  const handleSaveAll = useCallback(async () => {
    if (pendingLoans.length === 0) return;
    try {
      await onSaveLoans(pendingLoans);
      setPendingLoans([]);
    } catch (error) {
      console.error('Error al guardar préstamos:', error);
    }
  }, [pendingLoans, onSaveLoans]);

  const allRows = [...pendingLoans, editableEmptyRow || emptyLoanRow];

  return (
    <Box style={{ marginTop: '24px' }}>
      <div style={{ 
        position: 'relative',
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ 
          padding: '16px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#F9FAFB'
        }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#1F2937',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>➕</span>
            <span>{pendingLoans.length > 0 ? `Préstamos Pendientes (${pendingLoans.length})` : 'Agregar Nuevos Préstamos'}</span>
          </h3>
        </div>

        <div style={{ 
          padding: '12px', 
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ ...tableHeaderStyle, minWidth: '320px' }}>Cliente / Renovación</th>
                <th style={{ ...tableHeaderStyle, minWidth: '150px' }}>Tipo</th>
                <th style={{ ...tableHeaderStyle, minWidth: '120px' }}>M. Solicitado</th>
                <th style={{ ...tableHeaderStyle, minWidth: '140px' }}>M. Entregado</th>
                <th style={{ ...tableHeaderStyle, minWidth: '100px' }}>Comisión</th>
                <th style={{ ...tableHeaderStyle, minWidth: '220px' }}>Aval</th>
                <th style={{ ...tableHeaderStyle, width: '100px' }}></th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((loan, index) => {
                const isNewRow = index === pendingLoans.length;
                const loanId = loan.id || `temp-${index}`;
                const previousLoanOptions = getPreviousLoanOptions(loanId);

                return (
                  <tr 
                    key={loanId} 
                    style={{ 
                      backgroundColor: isNewRow ? '#FFFFFF' : '#F0FDF4',
                      borderBottom: '1px solid #E5E7EB'
                    }}
                  >
                    {/* Cliente / Renovación */}
                    <td style={{ ...tableCellStyle, minWidth: '320px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          fontSize: '11px', 
                          color: '#6B7280', 
                          fontWeight: '500' 
                        }}>
                          <input
                            type="checkbox"
                            checked={searchAllLeadersByRow[loanId] || false}
                            onChange={(e) => {
                              setSearchAllLeadersByRow(prev => ({
                                ...prev,
                                [loanId]: e.target.checked
                              }));
                              if (e.target.checked) {
                                refetchAllPreviousLoans({
                                  searchText: dropdownSearchTextByRow[loanId] || '',
                                  take: 10
                                });
                              }
                            }}
                            disabled={allPreviousLoansLoading}
                            style={{ margin: 0 }}
                          />
                          Buscar en todas las localidades
                          {allPreviousLoansLoading && (
                            <span style={{ fontSize: '10px', color: '#059669' }}>⏳ Cargando...</span>
                          )}
                        </label>
                        <div style={{ paddingTop: ROW_PADDING_TOP }}>
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
                              handleRowChange(index, 'clientData', { clientName: name, clientPhone: currentPhone, action: 'create' }, isNewRow);
                            }}
                            onPhoneChange={(phone) => {
                              const currentName = loan.borrower?.personalData?.fullName || '';
                              handleRowChange(index, 'clientData', { clientName: currentName, clientPhone: phone, action: 'create' }, isNewRow);
                            }}
                            onPreviousLoanSelect={(option) => {
                              handleRowChange(index, 'previousLoan', option, isNewRow);
                            }}
                            onPreviousLoanClear={() => {
                              handleRowChange(index, 'previousLoan', null, isNewRow);
                            }}
                            onClientDataChange={(data) => {
                              handleRowChange(index, 'clientData', data, isNewRow);
                            }}
                            previousLoanOptions={previousLoanOptions}
                            searchAllLeaders={searchAllLeadersByRow[loanId] || false}
                            onSearchTextChange={(text) => {
                              setDropdownSearchTextByRow(prev => ({
                                ...prev,
                                [loanId]: text
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Tipo */}
                    <td style={{ ...tableCellStyle, minWidth: '150px' }}>
                      <div style={{ paddingTop: ROW_PADDING_TOP }}>
                        <Select
                          options={loanTypeOptions}
                          value={loanTypeOptions.find((opt: any) => opt.value === loan.loantype?.id) || null}
                          onChange={(value) => {
                            if (value) {
                              handleRowChange(index, 'loantype', value, isNewRow);
                            }
                          }}
                          placeholder="Tipo..."
                          menuPosition="fixed"
                          menuPortalTarget={document.body}
                          styles={selectStyles}
                        />
                      </div>
                    </td>

                    {/* Monto Solicitado */}
                    <td style={{ ...tableCellStyle, minWidth: '120px' }}>
                      <div style={{ paddingTop: ROW_PADDING_TOP }}>
                        <TextInput
                          placeholder="0.00"
                          value={loan.requestedAmount || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const newValue = (loan.requestedAmount === '0' && value.length > 1) 
                              ? value.substring(1) 
                              : value;
                            handleRowChange(index, 'requestedAmount', newValue, isNewRow);
                          }}
                          style={inputStyles}
                          type="text"
                        />
                      </div>
                    </td>

                    {/* Monto Entregado */}
                    <td style={{ ...tableCellStyle, minWidth: '140px' }}>
                      <div style={{ 
                        paddingTop: ROW_PADDING_TOP,
                        position: 'relative'
                      }}>
                        <TextInput
                          placeholder="0.00"
                          value={loan.amountGived || ''}
                          readOnly
                          style={{ 
                            ...inputStyles,
                            backgroundColor: '#F3F4F6', 
                            cursor: 'not-allowed',
                            color: '#6B7280',
                            paddingRight: '30px'
                          }}
                          type="text"
                        />
                        {loan.previousLoan?.pendingAmount && (
                          <div 
                            style={{
                              position: 'absolute',
                              right: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '18px',
                              height: '18px',
                              backgroundColor: '#3B82F6',
                              color: 'white',
                              borderRadius: '50%',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              cursor: 'default',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 10
                            }}
                            onMouseEnter={() => setShowTooltip(prev => ({ ...prev, [loanId]: true }))}
                            onMouseLeave={() => setShowTooltip(prev => ({ ...prev, [loanId]: false }))}
                          >
                            i
                            {showTooltip[loanId] && (
                              <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: '#1F2937',
                                color: 'white',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                whiteSpace: 'nowrap',
                                zIndex: 20,
                                marginBottom: '6px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }}>
                                Deuda Previa: ${loan.previousLoan?.pendingAmount || '0'}
                                <div style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  width: 0,
                                  height: 0,
                                  borderLeft: '5px solid transparent',
                                  borderRight: '5px solid transparent',
                                  borderTop: '5px solid #1F2937'
                                }}></div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Comisión */}
                    <td style={{ ...tableCellStyle, minWidth: '100px' }}>
                      <div style={{ paddingTop: ROW_PADDING_TOP }}>
                        <TextInput
                          placeholder="0"
                          value={loan.comissionAmount || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const newValue = (loan.comissionAmount === '0' && value.length > 1) 
                              ? value.substring(1) 
                              : value;
                            handleRowChange(index, 'comissionAmount', newValue, isNewRow);
                          }}
                          style={inputStyles}
                          type="text"
                        />
                      </div>
                    </td>

                    {/* Aval */}
                    <td style={{ ...tableCellStyle, minWidth: '220px' }}>
                      <div style={{ paddingTop: ROW_PADDING_TOP }}>
                        <AvalInputWithAutocomplete
                          key={`${loanId}-aval`}
                          loanId={loanId}
                          currentName={loan.avalName || ''}
                          currentPhone={loan.avalPhone || ''}
                          selectedCollateralId={loan.selectedCollateralId}
                          selectedCollateralPhoneId={loan.selectedCollateralPhoneId}
                          onAvalChange={(avalData) => {
                            handleRowChange(index, 'avalData', avalData, isNewRow);
                          }}
                          usedPersonIds={usedAvalIds}
                          borrowerLocationId={undefined}
                          includeAllLocations={false}
                          readonly={false}
                          isFromPrevious={!!loan.previousLoan}
                        />
                      </div>
                    </td>

                    {/* Acciones */}
                    <td style={{ ...tableCellStyle, width: '100px' }}>
                      {!isNewRow && (
                        <div style={{ paddingTop: ROW_PADDING_TOP }}>
                          <Button
                            tone="negative"
                            size="small"
                            onClick={() => setPendingLoans(prev => prev.filter((_, i) => i !== index))}
                            style={{ 
                              padding: '6px 12px', 
                              height: INPUT_HEIGHT,
                              fontSize: '12px'
                            }}
                          >
                            <FaTrash size={12} style={{ marginRight: '4px' }} />
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pendingLoans.length > 0 && (
        <Box style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '16px', 
          padding: '16px', 
          backgroundColor: '#F0F9FF', 
          borderRadius: '8px', 
          border: '1px solid #E0F2FE',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 12px', 
            backgroundColor: '#E0F2FE', 
            borderRadius: '6px', 
            color: '#0052CC', 
            fontSize: '14px', 
            fontWeight: '500' 
          }}>
            <span>📋</span>
            <span>{pendingLoans.length} préstamo{pendingLoans.length !== 1 && 's'} listo{pendingLoans.length !== 1 && 's'} para guardar</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button 
              tone="negative" 
              weight="bold" 
              onClick={() => setPendingLoans([])} 
              style={{ padding: '8px 16px', height: '36px', fontSize: '13px' }}
            >
              Cancelar Todo
            </Button>
            <Button 
              tone="active" 
              weight="bold" 
              onClick={handleSaveAll} 
              disabled={isSaving} 
              style={{ 
                padding: '8px 16px', 
                height: '36px', 
                fontSize: '13px', 
                backgroundColor: '#0052CC',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isSaving ? (
                <React.Fragment>
                  <LoadingDots label="Guardando..." size="small" />
                  <span>Guardando...</span>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <span>💾</span>
                  <span>Crear {pendingLoans.length} Préstamo{pendingLoans.length !== 1 && 's'}</span>
                </React.Fragment>
              )}
            </Button>
          </div>
        </Box>
      )}
    </Box>
  );
};

