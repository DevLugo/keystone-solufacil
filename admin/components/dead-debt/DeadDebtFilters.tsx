import React from 'react';
import { DeadDebtFilters, Route } from '../../types/dead-debt';

interface DeadDebtFiltersProps {
  filters: DeadDebtFilters;
  onFiltersChange: (filters: DeadDebtFilters) => void;
  routes: Route[];
  isLoading: boolean;
  onUpdate: () => void;
}

export default function DeadDebtFiltersComponent({
  filters,
  onFiltersChange,
  routes,
  isLoading,
  onUpdate
}: DeadDebtFiltersProps) {
  const handleFilterChange = (key: keyof DeadDebtFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleMonthYearChange = (month: number, year: number) => {
    onFiltersChange({
      ...filters,
      month,
      year
    });
  };

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  return (
    <div style={{ 
      backgroundColor: 'white', 
      border: '1px solid #ddd', 
      borderRadius: '8px', 
      padding: '2rem', 
      marginBottom: '2rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Configuración de Filtros</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Filtro de semanas desde el crédito */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Semanas desde el crédito:
          </label>
          <input
            type="number"
            value={filters.weeksSinceLoan}
            onChange={(e) => handleFilterChange('weeksSinceLoan', parseInt(e.target.value) || 0)}
            min="1"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <small style={{ color: '#666', fontSize: '12px' }}>
            Mínimo de semanas transcurridas desde que se otorgó el crédito
          </small>
        </div>

        {/* Filtro de semanas sin pago */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Semanas sin pago:
          </label>
          <input
            type="number"
            value={filters.weeksWithoutPayment}
            onChange={(e) => handleFilterChange('weeksWithoutPayment', parseInt(e.target.value) || 0)}
            min="1"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <small style={{ color: '#666', fontSize: '12px' }}>
            Mínimo de semanas consecutivas sin abonar
          </small>
        </div>

        {/* Filtro de ruta */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Ruta:
          </label>
          <select
            value={filters.routeId || ''}
            onChange={(e) => handleFilterChange('routeId', e.target.value || undefined)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">Todas las rutas</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro de mes para ver cartera muerta existente */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Ver cartera muerta del mes:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={filters.month || currentMonth}
              onChange={(e) => handleMonthYearChange(parseInt(e.target.value), filters.year || currentYear)}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(0, month - 1).toLocaleString('es-ES', { month: 'long' })}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={filters.year || currentYear}
              onChange={(e) => handleMonthYearChange(filters.month || currentMonth, parseInt(e.target.value) || currentYear)}
              min="2020"
              max="2030"
              style={{
                width: '80px',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <small style={{ color: '#666', fontSize: '12px' }}>
            Ver créditos ya marcados como cartera muerta
          </small>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={onUpdate}
          disabled={isLoading}
          style={{
            backgroundColor: isLoading ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {isLoading ? 'Cargando...' : 'Actualizar'}
        </button>

        <button
          onClick={() => onFiltersChange({
            weeksSinceLoan: 17,
            weeksWithoutPayment: 4,
            routeId: undefined,
            month: undefined,
            year: undefined
          })}
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
          Restablecer Filtros
        </button>
      </div>
    </div>
  );
}

