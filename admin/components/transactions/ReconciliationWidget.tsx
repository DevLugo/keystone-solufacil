/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { jsx } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput } from '@keystone-ui/fields';
import { useMutation, gql } from '@apollo/client';
import { FaCheck, FaTimes, FaCamera, FaExclamationTriangle } from 'react-icons/fa';
import { CREATE_DISCREPANCY } from '../../graphql/mutations/discrepancies';
import { captureTabScreenshot, generateScreenshotFilename } from '../../utils/screenshotCapture';

// Query para refrescar la lista de diferencias
const GET_DISCREPANCIES = gql`
  query GetDiscrepancies($routeId: ID, $startDate: String, $endDate: String, $status: String) {
    getDiscrepancies(routeId: $routeId, startDate: $startDate, endDate: $endDate, status: $status) {
      id
      discrepancyType
      date
      expectedAmount
      actualAmount
      difference
      description
      category
      status
      notes
      screenshotUrls
      telegramReported
      reportedAt
      route {
        id
        name
      }
      lead {
        id
        personalData {
          fullName
        }
      }
      createdAt
    }
  }
`;

interface Route {
  id: string;
  name?: string;
}

interface Employee {
  id: string;
  personalData?: {
    fullName?: string;
  };
}

interface ReconciliationWidgetProps {
  selectedDate: Date;
  selectedRoute: Route | null;
  selectedLead: Employee | null;
  tabType: 'PAYMENT' | 'CREDIT' | 'EXPENSE';
  actualAmount: number;
  captureElementId?: string;
  onReconcileComplete?: () => void;
}

const ReconciliationWidget: React.FC<ReconciliationWidgetProps> = ({
  selectedDate,
  selectedRoute,
  selectedLead,
  tabType,
  actualAmount,
  captureElementId = 'main-content',
  onReconcileComplete,
}) => {
  const [expectedAmount, setExpectedAmount] = useState<string>('');
  const [difference, setDifference] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [createDiscrepancy, { loading: creating }] = useMutation(CREATE_DISCREPANCY, {
    refetchQueries: [
      {
        query: GET_DISCREPANCIES,
        variables: {
          routeId: null,
          startDate: null,
          endDate: null,
          status: null,
        },
      },
    ],
    awaitRefetchQueries: true, // Esperar a que termine el refetch
  });

  // Calcular diferencia automáticamente
  useEffect(() => {
    if (expectedAmount && !isNaN(parseFloat(expectedAmount))) {
      const expected = parseFloat(expectedAmount);
      const diff = actualAmount - expected;
      setDifference(diff);
    } else {
      setDifference(0);
    }
  }, [expectedAmount, actualAmount]);

  const hasDifference = Math.abs(difference) > 0.01;

  const typeLabels = {
    PAYMENT: 'Abonos',
    CREDIT: 'Créditos',
    EXPENSE: 'Gastos',
  };

  // Mapeo correcto a los valores del enum en el schema
  const categoryMapping = {
    PAYMENT: 'ABONO',
    CREDIT: 'CREDITO',
    EXPENSE: 'GASTO',
  };

  const handleReportDifference = async () => {
    if (!selectedRoute) {
      alert('Por favor selecciona una ruta');
      return;
    }

    if (!expectedAmount || isNaN(parseFloat(expectedAmount))) {
      alert('Por favor ingresa un monto esperado válido');
      return;
    }

    if (!description.trim()) {
      alert('Por favor ingresa una descripción de la diferencia');
      return;
    }

    try {
      setIsCapturing(true);

      // Capturar screenshot
      let screenshotBase64: string | undefined;
      try {
        screenshotBase64 = await captureTabScreenshot(captureElementId);
        console.log('✅ Screenshot capturado exitosamente');
      } catch (error) {
        console.error('❌ Error capturando screenshot:', error);
        // Continuar sin screenshot
      }

      // Crear la diferencia
      const { data } = await createDiscrepancy({
        variables: {
          discrepancyType: tabType,
          routeId: selectedRoute.id,
          leadId: selectedLead?.id || null,
          date: selectedDate.toISOString(),
          expectedAmount: parseFloat(expectedAmount),
          actualAmount: actualAmount,
          description: description.trim(),
          category: categoryMapping[tabType],
          screenshotBase64: screenshotBase64,
        },
      });

      if (data?.createDiscrepancy?.success) {
        alert('✅ Diferencia reportada exitosamente');
        
        // Limpiar formulario
        setExpectedAmount('');
        setDescription('');
        setShowDetails(false);

        // Llamar callback si existe
        if (onReconcileComplete) {
          onReconcileComplete();
        }
      } else {
        const errors = data?.createDiscrepancy?.errors?.join(', ') || 'Error desconocido';
        alert(`❌ Error al reportar diferencia: ${errors}`);
      }
    } catch (error) {
      console.error('Error reportando diferencia:', error);
      alert('❌ Error al reportar diferencia. Inténtalo de nuevo.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmNoDifference = async () => {
    if (!expectedAmount || isNaN(parseFloat(expectedAmount))) {
      alert('Por favor ingresa el monto esperado para confirmar');
      return;
    }

    if (Math.abs(difference) > 0.01) {
      alert('⚠️ Hay una diferencia detectada. Usa el botón "Reportar Diferencia" en su lugar.');
      return;
    }

    // Simplemente limpiar el formulario
    alert('✅ Reconciliación confirmada - sin diferencias');
    setExpectedAmount('');
    setDescription('');
    setShowDetails(false);
  };

  const getDifferenceColor = () => {
    if (Math.abs(difference) < 0.01) return '#059669'; // Verde
    if (Math.abs(difference) < 50) return '#D97706'; // Amarillo
    return '#DC2626'; // Rojo
  };

  const getDifferenceIcon = () => {
    if (Math.abs(difference) < 0.01) return <FaCheck />;
    return <FaExclamationTriangle />;
  };

  return (
    <div
      style={{
        backgroundColor: '#F8FAFC',
        border: `2px solid ${hasDifference ? getDifferenceColor() : '#E2E8F0'}`,
        borderRadius: '12px',
        padding: '20px',
        marginTop: '24px',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1E293B', fontWeight: '600' }}>
            🎯 Reconciliación de {typeLabels[tabType]}
          </h3>
          {hasDifference && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                backgroundColor: `${getDifferenceColor()}20`,
                color: getDifferenceColor(),
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {getDifferenceIcon()}
              Diferencia Detectada
            </span>
          )}
        </div>
        <Button
          size="small"
          tone="passive"
          onClick={() => setShowDetails(!showDetails)}
          style={{ fontSize: '12px' }}
        >
          {showDetails ? 'Ocultar' : 'Mostrar'} Detalles
        </Button>
      </div>

      {/* Content */}
      {showDetails && (
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Información actual */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>
                📅 Fecha
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                {selectedDate.toLocaleDateString('es-MX')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>
                🛣️ Ruta
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                {selectedRoute?.name || 'No seleccionada'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>
                📍 Localidad
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>
                {selectedLead?.personalData?.fullName || 'N/A'}
              </div>
            </div>
          </div>

          {/* Montos */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '12px',
            }}
          >
            {/* Monto Actual */}
            <div
              style={{
                padding: '16px',
                backgroundColor: '#EFF6FF',
                borderRadius: '8px',
                border: '1px solid #BFDBFE',
              }}
            >
              <div style={{ fontSize: '12px', color: '#1E40AF', marginBottom: '8px', fontWeight: '500' }}>
                💵 Monto Capturado
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1E40AF' }}>
                ${actualAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Monto Esperado */}
            <div
              style={{
                padding: '16px',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
              }}
            >
              <label style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px', display: 'block', fontWeight: '500' }}>
                💰 Monto Esperado (PDF)
              </label>
              <TextInput
                type="number"
                step="0.01"
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                placeholder="0.00"
                style={{ fontSize: '18px', fontWeight: '600' }}
              />
            </div>

            {/* Diferencia */}
            <div
              style={{
                padding: '16px',
                backgroundColor: `${getDifferenceColor()}10`,
                borderRadius: '8px',
                border: `2px solid ${getDifferenceColor()}`,
              }}
            >
              <div style={{ fontSize: '12px', color: getDifferenceColor(), marginBottom: '8px', fontWeight: '500' }}>
                ⚖️ Diferencia
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: getDifferenceColor() }}>
                {difference >= 0 ? '+' : ''}
                ${Math.abs(difference).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', color: getDifferenceColor(), marginTop: '4px' }}>
                {difference > 0 ? 'Excedente' : difference < 0 ? 'Faltante' : 'Sin diferencia'}
              </div>
            </div>
          </div>

          {/* Descripción (solo si hay diferencia) */}
          {hasDifference && (
            <div>
              <label
                style={{
                  fontSize: '13px',
                  color: '#1E293B',
                  marginBottom: '8px',
                  display: 'block',
                  fontWeight: '500',
                }}
              >
                📝 Descripción de la Diferencia *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explica brevemente la diferencia detectada (ej: Se dio comisión de más a la líder cuando no debían darle)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            {hasDifference ? (
              <Button
                tone="negative"
                size="medium"
                onClick={handleReportDifference}
                isLoading={creating || isCapturing}
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <FaCamera size={14} />
                {isCapturing ? 'Capturando...' : creating ? 'Reportando...' : 'Reportar Diferencia'}
              </Button>
            ) : (
              <Button
                tone="positive"
                size="medium"
                onClick={handleConfirmNoDifference}
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <FaCheck size={14} />
                Confirmar Sin Diferencias
              </Button>
            )}
          </div>

          {/* Ayuda */}
          <div
            style={{
              fontSize: '12px',
              color: '#64748B',
              padding: '12px',
              backgroundColor: '#F1F5F9',
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
            }}
          >
            💡 <strong>Cómo usar:</strong> Ingresa el monto esperado del PDF de la cuenta de ruta. El sistema calculará
            automáticamente la diferencia y podrás reportarla con una captura automática del estado actual.
          </div>
        </div>
      )}
    </div>
  );
};

export default ReconciliationWidget;

