import React, { useState } from 'react';
import { DeadDebtLoan } from '../../types/dead-debt';

interface DeadDebtConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (badDebtDate: string) => void;
  selectedLoans: DeadDebtLoan[];
  isLoading: boolean;
}

export default function DeadDebtConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  selectedLoans,
  isLoading
}: DeadDebtConfirmationModalProps) {
  const [badDebtDate, setBadDebtDate] = useState(new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const totalAmount = selectedLoans.reduce((sum, loan) => sum + loan.pendingAmountStored, 0);
  const loanCount = selectedLoans.length;

  const handleConfirm = () => {
    onConfirm(badDebtDate);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={handleOverlayClick}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>
          Confirmar Cartera Muerta
        </h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#666' }}>Resumen de Créditos Seleccionados</h3>
          
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #e9ecef', 
            borderRadius: '4px', 
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Cantidad de Créditos:</strong> {loanCount}
              </div>
              <div>
                <strong>Monto Total:</strong> ${totalAmount.toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Fecha de Cartera Muerta:
            </label>
            <input
              type="date"
              value={badDebtDate}
              onChange={(e) => setBadDebtDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#666' }}>Créditos a Marcar:</h4>
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              padding: '0.5rem'
            }}>
              {selectedLoans.map((loan, index) => (
                <div key={loan.id} style={{ 
                  padding: '0.5rem', 
                  borderBottom: index < selectedLoans.length - 1 ? '1px solid #eee' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '500' }}>{loan.borrower.fullName}</div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>
                      {loan.borrower.clientCode} - {loan.lead.fullName}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '500' }}>${loan.pendingAmountStored.toLocaleString()}</div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>
                      {loan.weeksSinceLoan} semanas
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffeaa7', 
          borderRadius: '4px', 
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}>⚠️</div>
            <div>
              <strong>Advertencia:</strong> Esta acción marcará los créditos seleccionados como cartera muerta.
              Esta operación no se puede deshacer fácilmente. ¿Estás seguro de continuar?
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !badDebtDate}
            style={{
              backgroundColor: (isLoading || !badDebtDate) ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              cursor: (isLoading || !badDebtDate) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isLoading ? 'Procesando...' : `Marcar ${loanCount} Créditos como Cartera Muerta`}
          </button>
        </div>
      </div>
    </div>
  );
}

