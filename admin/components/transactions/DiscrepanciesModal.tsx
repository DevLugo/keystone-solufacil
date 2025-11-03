/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState } from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { FaTimes, FaCheck, FaTrash, FaImage, FaCalendarAlt, FaFilter } from 'react-icons/fa';
import { useMutation } from '@apollo/client';
import { UPDATE_DISCREPANCY_STATUS, DELETE_DISCREPANCY } from '../../graphql/mutations/discrepancies';

interface Discrepancy {
  id: string;
  discrepancyType: string;
  date: string;
  weekStartDate?: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  description: string;
  category?: string;
  status: string;
  notes?: string;
  screenshotUrls?: string[];
  telegramReported: boolean;
  reportedAt?: string;
  route?: {
    id: string;
    name?: string;
  };
  lead?: {
    id: string;
    personalData?: {
      fullName?: string;
    };
  };
  createdAt: string;
}

interface DiscrepanciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  discrepancies: Discrepancy[];
  loading: boolean;
  onRefresh: () => void;
  totalPending: number;
  totalCompleted: number;
  totalDiscarded: number;
}

export const DiscrepanciesModal: React.FC<DiscrepanciesModalProps> = ({
  isOpen,
  onClose,
  discrepancies,
  loading,
  onRefresh,
  totalPending,
  totalCompleted,
  totalDiscarded,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [routeFilter, setRouteFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null);
  const [notes, setNotes] = useState<string>('');

  const [updateStatus, { loading: updating }] = useMutation(UPDATE_DISCREPANCY_STATUS);
  const [deleteDiscrepancy, { loading: deleting }] = useMutation(DELETE_DISCREPANCY);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateStatus({
        variables: {
          id,
          status: newStatus,
          notes: notes || null,
        },
      });
      setNotes('');
      setSelectedDiscrepancy(null);
      onRefresh();
      alert('✅ Estado actualizado correctamente');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('❌ Error al actualizar el estado');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta diferencia?')) return;

    try {
      await deleteDiscrepancy({
        variables: { id },
      });
      onRefresh();
      alert('✅ Diferencia eliminada');
    } catch (error) {
      console.error('Error deleting:', error);
      alert('❌ Error al eliminar');
    }
  };

  // Obtener rutas únicas
  const uniqueRoutes = Array.from(
    new Set(discrepancies.map((d) => d.route?.name).filter(Boolean))
  ).sort();

  // Filtrar diferencias
  const filteredDiscrepancies = discrepancies.filter((d) => {
    // Filtro por estado
    if (d.status !== statusFilter) return false;
    
    // Filtro por ruta
    if (routeFilter !== 'ALL' && d.route?.name !== routeFilter) return false;
    
    // Filtro por tipo
    if (typeFilter !== 'ALL' && d.discrepancyType !== typeFilter) return false;
    
    return true;
  });

  // Calcular totales por semana
  const weeklyTotals = filteredDiscrepancies.reduce<Record<string, { total: number; count: number; start: string; end: string }>>((acc, d) => {
    const startIso = d.weekStartDate
      ? new Date(d.weekStartDate).toISOString().slice(0, 10)
      : (() => {
          const dt = new Date(d.date);
          const day = dt.getDay();
          const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
          dt.setDate(diff);
          dt.setHours(0, 0, 0, 0);
          return dt.toISOString().slice(0, 10);
        })();

    const startDate = new Date(startIso);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const endIso = endDate.toISOString().slice(0, 10);

    if (!acc[startIso]) acc[startIso] = { total: 0, count: 0, start: startIso, end: endIso };
    acc[startIso].total += d.difference;
    acc[startIso].count += 1;
    return acc;
  }, {});

  const weeklyTotalsSorted = Object.entries(weeklyTotals)
    .sort(([a], [b]) => (a < b ? 1 : -1));

  const typeLabels: Record<string, string> = {
    PAYMENT: 'Abono',
    CREDIT: 'Crédito',
    EXPENSE: 'Gasto',
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'Pendiente',
    COMPLETED: 'Completada',
    DISCARDED: 'Descartada',
  };

  const statusColors: Record<string, string> = {
    PENDING: '#F59E0B',
    COMPLETED: '#10B981',
    DISCARDED: '#6B7280',
  };

  if (!isOpen) return null;

  return (
    <div
      css={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        css={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box
          css={{
            padding: '24px',
            borderBottom: '1px solid #E5E7EB',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }}
        >
          <div css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 css={{ margin: 0, fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
                🎯 Diferencias de Transacciones
              </h2>
              <p css={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                Gestión y seguimiento de diferencias detectadas
              </p>
            </div>
            <button
              onClick={onClose}
              css={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                fontSize: '20px',
                transition: 'all 0.2s',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.3)',
                  transform: 'scale(1.1)',
                },
              }}
            >
              <FaTimes />
            </button>
          </div>

          {/* Estadísticas */}
          <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '20px' }}>
            <div
              css={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '16px',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div css={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>🟡 Pendientes</div>
              <div css={{ fontSize: '28px', fontWeight: '700' }}>{totalPending}</div>
            </div>
            <div
              css={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '16px',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div css={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>🟢 Completadas</div>
              <div css={{ fontSize: '28px', fontWeight: '700' }}>{totalCompleted}</div>
            </div>
            <div
              css={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '16px',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div css={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>⚪ Descartadas</div>
              <div css={{ fontSize: '28px', fontWeight: '700' }}>{totalDiscarded}</div>
            </div>
          </div>
        </Box>

        {/* Filtros */}
        <Box
          css={{
            padding: '16px 24px',
            borderBottom: '1px solid #E5E7EB',
            background: '#F9FAFB'
          }}
        >
          <div css={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div css={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span css={{ fontWeight: 700, color: '#111827' }}>Totales por semana:</span>
              {weeklyTotalsSorted.length === 0 ? (
                <span css={{ color: '#6B7280' }}>Sin datos</span>
              ) : (
                <div css={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {weeklyTotalsSorted.map(([week, info]) => (
                    <span key={week} css={{
                      backgroundColor: '#EEF2FF',
                      color: '#3730A3',
                      borderRadius: '9999px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <FaCalendarAlt /> de {info.start} a {info.end}: ${info.total.toFixed(2)} ({info.count})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Controles de filtros existentes permanecen debajo */}
          </div>
        </Box>

        {/* Content */}
        <Box css={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {loading ? (
            <div css={{ textAlign: 'center', padding: '40px' }}>
              <div css={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
              <div css={{ color: '#6B7280' }}>Cargando diferencias...</div>
            </div>
          ) : filteredDiscrepancies.length === 0 ? (
            <div css={{ textAlign: 'center', padding: '40px' }}>
              <div css={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <div css={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                No hay diferencias {statusLabels[statusFilter].toLowerCase()}
              </div>
              <div css={{ fontSize: '14px', color: '#6B7280' }}>
                {statusFilter === 'PENDING' && 'Todas las diferencias han sido resueltas'}
              </div>
            </div>
          ) : (
            <div css={{ display: 'grid', gap: '16px' }}>
              {filteredDiscrepancies.map((discrepancy) => (
                <div
                  key={discrepancy.id}
                  css={{
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '20px',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      borderColor: statusColors[discrepancy.status],
                    },
                  }}
                >
                  {/* Header de la tarjeta */}
                  <div css={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div css={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span
                        css={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: `${statusColors[discrepancy.status]}15`,
                          color: statusColors[discrepancy.status],
                        }}
                      >
                        {typeLabels[discrepancy.discrepancyType]}
                      </span>
                      <span css={{ fontSize: '14px', color: '#6B7280' }}>
                        <FaCalendarAlt css={{ marginRight: '6px' }} />
                        {new Date(discrepancy.date).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div css={{ display: 'flex', gap: '8px' }}>
                      {discrepancy.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(discrepancy.id, 'COMPLETED')}
                            disabled={updating}
                            css={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#10B981',
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              '&:hover': { background: '#059669' },
                              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                            }}
                          >
                            <FaCheck /> Completar
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(discrepancy.id, 'DISCARDED')}
                            disabled={updating}
                            css={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#6B7280',
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              '&:hover': { background: '#4B5563' },
                              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                            }}
                          >
                            <FaTimes /> Descartar
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(discrepancy.id)}
                        disabled={deleting}
                        css={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#EF4444',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          '&:hover': { background: '#DC2626' },
                          '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                        }}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  {/* Información */}
                  <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <div css={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>🛣️ Ruta</div>
                      <div css={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                        {discrepancy.route?.name || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div css={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>📍 Localidad</div>
                      <div css={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                        {discrepancy.lead?.personalData?.fullName || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Montos */}
                  <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div css={{ padding: '12px', background: '#F3F4F6', borderRadius: '6px' }}>
                      <div css={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>💰 Esperado</div>
                      <div css={{ fontSize: '16px', fontWeight: '700', color: '#374151' }}>
                        ${discrepancy.expectedAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div css={{ padding: '12px', background: '#F3F4F6', borderRadius: '6px' }}>
                      <div css={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>💵 Capturado</div>
                      <div css={{ fontSize: '16px', fontWeight: '700', color: '#374151' }}>
                        ${discrepancy.actualAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div
                      css={{
                        padding: '12px',
                        background: discrepancy.difference >= 0 ? '#DCFCE7' : '#FEE2E2',
                        borderRadius: '6px',
                      }}
                    >
                      <div css={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>⚖️ Diferencia</div>
                      <div
                        css={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: discrepancy.difference >= 0 ? '#059669' : '#DC2626',
                        }}
                      >
                        {discrepancy.difference >= 0 ? '+' : ''}$
                        {Math.abs(discrepancy.difference).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Descripción */}
                  <div
                    css={{
                      padding: '12px',
                      background: '#F9FAFB',
                      borderRadius: '6px',
                      marginBottom: '12px',
                    }}
                  >
                    <div css={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>📝 Descripción</div>
                    <div css={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>
                      {discrepancy.description}
                    </div>
                  </div>

                  {/* Screenshots */}
                  {discrepancy.screenshotUrls && discrepancy.screenshotUrls.length > 0 && (
                    <div css={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {discrepancy.screenshotUrls.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          css={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#EFF6FF',
                            color: '#2563EB',
                            fontSize: '12px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            textDecoration: 'none',
                            '&:hover': { background: '#DBEAFE' },
                          }}
                        >
                          <FaImage /> Ver captura {index + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Box>
      </div>
    </div>
  );
};

