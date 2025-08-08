/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { jsx, Box } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { Select, TextInput } from '@keystone-ui/fields';
import { LoadingDots } from '@keystone-ui/loading';
import { GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { gql } from '@apollo/client';
import { FaDownload, FaSync, FaChartLine, FaTable, FaFilter } from 'react-icons/fa';
import { ExportButton } from './ExportButton';

// Query para obtener el reporte
const GET_ACTIVE_LOANS_REPORT = gql`
  query GetActiveLoansReport($routeId: String!, $year: Int!, $month: Int!, $useActiveWeeks: Boolean!, $excludeCVAfterMonth: Int, $excludeCVAfterYear: Int) {
    getActiveLoansReport(routeId: $routeId, year: $year, month: $month, useActiveWeeks: $useActiveWeeks, excludeCVAfterMonth: $excludeCVAfterMonth, excludeCVAfterYear: $excludeCVAfterYear)
  }
`;

// Query para obtener registros de limpieza de cartera
const GET_PORTFOLIO_CLEANUPS = gql`
  query GetPortfolioCleanups($routeId: String!, $year: Int!, $month: Int!) {
    getPortfolioCleanups(routeId: $routeId, year: $year, month: $month)
  }
`;

// Query para obtener rutas
const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;

interface Route {
  id: string;
  name: string;
}

interface ReportData {
  route: { id: string; name: string };
  month: { year: number; month: number; name: string };
  weeks: string[];
  data: { [week: string]: { [locality: string]: any } };
  weeklyTotals: { [week: string]: any };
  summary: {
    totalActiveAtMonthStart: number;
    totalActiveAtMonthEnd: number;
    totalGrantedInMonth: number;
    totalFinishedInMonth: number;
    netChangeInMonth: number;
  };
}

const styles = {
  container: {
    padding: '32px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    maxWidth: '100%',
    overflow: 'auto',
  },
  header: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '32px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '24px',
  },
  filtersRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  summaryCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '32px',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    textAlign: 'center' as const,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 15px rgba(0, 0, 0, 0.1)',
    }
  },
  summaryValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '8px',
    lineHeight: '1.2',
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#718096',
    fontWeight: '500',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  summaryChange: {
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '4px',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  tableHeader: {
    backgroundColor: '#0052CC',
    color: 'white',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableTitle: {
    fontSize: '18px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    backgroundColor: '#f7fafc',
    padding: '16px 12px',
    textAlign: 'left' as const,
    fontWeight: '600',
    fontSize: '11px',
    color: '#4a5568',
    borderBottom: '2px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    whiteSpace: 'nowrap' as const,
    minWidth: '160px',
  },
  td: {
    padding: '16px 12px',
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    fontSize: '13px',
    color: '#2d3748',
    verticalAlign: 'top' as const,
    minWidth: '160px',
  },
  localityName: {
    fontWeight: '600',
    color: '#2d3748',
  },
  weekStats: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '4px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    padding: '2px 0',
    borderBottom: '1px solid rgba(226, 232, 240, 0.3)',
  },
  statGroup: {
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
  },
  statGroupTitle: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#4a5568',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '4px',
    textAlign: 'center' as const,
  },
  statLabel: {
    color: '#718096',
  },
  statValue: {
    fontWeight: '600',
    color: '#2d3748',
  },
  positive: {
    color: '#38a169',
  },
  negative: {
    color: '#e53e3e',
  },
  neutral: {
    color: '#718096',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
};

// Estilos CSS personalizados para el calendario
const calendarStyles = `
  .react-calendar {
    width: 100% !important;
    border: none !important;
    font-size: 11px !important;
  }
  
  .react-calendar__tile {
    padding: 4px !important;
    font-size: 11px !important;
  }
  
  .react-calendar__month-view__weekdays {
    font-size: 10px !important;
    font-weight: bold !important;
  }
  
  .active-week-day {
    background-color: #0ea5e9 !important;
    color: white !important;
    border-radius: 4px !important;
  }
  
  .active-week-day:hover {
    background-color: #0284c7 !important;
  }
`;

// Agregar estilos al head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = calendarStyles;
  document.head.appendChild(styleElement);
}

// Función para verificar si una fecha está en una semana activa
const isDateInActiveWeek = (date: Date, activeWeeks: Array<{start: Date, end: Date, weekNumber: number}>) => {
  return activeWeeks.some(week => {
    const dateTime = date.getTime();
    const weekStartTime = week.start.getTime();
    const weekEndTime = week.end.getTime();
    return dateTime >= weekStartTime && dateTime <= weekEndTime;
  });
};

// Componente de calendario personalizado
const CustomCalendar = ({ year, month, activeWeeks }: { 
  year: number; 
  month: number; 
  activeWeeks: Array<{start: Date, end: Date, weekNumber: number}> 
}) => {
  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Generar días del mes
  const getDaysInMonth = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const days: Array<{date: Date, isCurrentMonth: boolean, isActiveWeek: boolean}> = [];
    
    // Agregar días del mes anterior para completar la primera semana
    const firstDayOfWeek = firstDay.getDay();
    const daysFromPrevMonth = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    for (let i = daysFromPrevMonth; i > 0; i--) {
      const date = new Date(firstDay);
      date.setDate(date.getDate() - i);
      days.push({
        date,
        isCurrentMonth: false,
        isActiveWeek: isDateInActiveWeek(date, activeWeeks)
      });
    }
    
    // Agregar días del mes actual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month - 1, i);
      days.push({
        date,
        isCurrentMonth: true,
        isActiveWeek: isDateInActiveWeek(date, activeWeeks)
      });
    }
    
    // Agregar días del mes siguiente para completar la última semana
    const lastDayOfWeek = lastDay.getDay();
    const daysFromNextMonth = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    
    for (let i = 1; i <= daysFromNextMonth; i++) {
      const date = new Date(lastDay);
      date.setDate(date.getDate() + i);
      days.push({
        date,
        isCurrentMonth: false,
        isActiveWeek: isDateInActiveWeek(date, activeWeeks)
      });
    }
    
    return days;
  };

  const days = getDaysInMonth();

  return (
    <div style={{
      width: '100%',
      fontFamily: 'monospace',
      fontSize: '10px'
    }}>
      {/* Encabezado del mes */}
      <div style={{
        textAlign: 'center',
        fontWeight: 'bold',
        marginBottom: '8px',
        fontSize: '11px',
        color: '#0369a1'
      }}>
        {monthNames[month - 1]} {year}
      </div>
      
      {/* Días de la semana */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
        marginBottom: '4px'
      }}>
        {daysOfWeek.map(day => (
          <div key={day} style={{
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '9px',
            color: '#64748b',
            padding: '2px'
          }}>
            {day}
          </div>
        ))}
      </div>
      
      {/* Días del mes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px'
      }}>
        {days.map((day, index) => (
          <div
            key={index}
            style={{
              textAlign: 'center',
              padding: '4px 2px',
              fontSize: '9px',
              borderRadius: '3px',
              backgroundColor: day.isActiveWeek ? '#0ea5e9' : 'transparent',
              color: day.isActiveWeek ? 'white' : (day.isCurrentMonth ? '#1f2937' : '#9ca3af'),
              fontWeight: day.isActiveWeek ? 'bold' : 'normal',
              cursor: 'default'
            }}
          >
            {day.date.getDate()}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function ActiveLoansReport() {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [useActiveWeeks, setUseActiveWeeks] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Estados para filtro de CV
  const [excludeCVAfterMonth, setExcludeCVAfterMonth] = useState<number | null>(null);
  const [excludeCVAfterYear, setExcludeCVAfterYear] = useState<number | null>(null);
  const [useCVFilter, setUseCVFilter] = useState(false);

  // Query para obtener rutas
  const { data: routesData, loading: routesLoading } = useQuery(GET_ROUTES);

  // Query para obtener el reporte
  const { 
    data: reportData, 
    loading: reportLoading, 
    error: reportError,
    refetch: refetchReport 
  } = useQuery(GET_ACTIVE_LOANS_REPORT, {
    variables: {
      routeId: selectedRoute?.id || '',
      year: selectedYear,
      month: selectedMonth,
      useActiveWeeks: useActiveWeeks,
      excludeCVAfterMonth: useCVFilter ? excludeCVAfterMonth : null,
      excludeCVAfterYear: useCVFilter ? excludeCVAfterYear : null,
    },
    skip: !selectedRoute,
  });

  // Query para obtener registros de limpieza de cartera
  const { 
    data: cleanupsData, 
    loading: cleanupsLoading 
  } = useQuery(GET_PORTFOLIO_CLEANUPS, {
    variables: {
      routeId: selectedRoute?.id || '',
      year: selectedYear,
      month: selectedMonth,
    },
    skip: !selectedRoute,
  });

  // Opciones para los selects
  const routeOptions = useMemo(() => {
    if (!routesData?.routes) return [];
    return routesData.routes.map((route: Route) => ({
      label: route.name,
      value: route.id,
    }));
  }, [routesData]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => ({
      label: (currentYear - i).toString(),
      value: currentYear - i,
    }));
  }, []);

  const monthOptions = [
    { label: 'Enero', value: 1 },
    { label: 'Febrero', value: 2 },
    { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 },
    { label: 'Mayo', value: 5 },
    { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 },
    { label: 'Agosto', value: 8 },
    { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 },
    { label: 'Noviembre', value: 11 },
    { label: 'Diciembre', value: 12 },
  ];

  // Seleccionar primera ruta por defecto
  useEffect(() => {
    if (routeOptions.length > 0 && !selectedRoute) {
      const firstRoute = routesData.routes[0];
      setSelectedRoute(firstRoute);
    }
  }, [routeOptions, selectedRoute, routesData]);

  // Procesar datos del reporte
  const processedData: ReportData | null = useMemo(() => {
    if (!reportData?.getActiveLoansReport) return null;
    return reportData.getActiveLoansReport;
  }, [reportData]);

  // Obtener todas las localidades únicas
  const allLocalities = useMemo(() => {
    if (!processedData) return [];
    const localities = new Set<string>();
    
    Object.values(processedData.data).forEach(weekData => {
      Object.keys(weekData).forEach(locality => {
        localities.add(locality);
      });
    });
    
    return Array.from(localities).sort();
  }, [processedData]);

  // Función para formatear números
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-MX').format(num);
  };

  // Función para formatear moneda
  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Función para obtener color del cambio
  const getChangeColor = (change: number) => {
    if (change > 0) return styles.positive;
    if (change < 0) return styles.negative;
    return styles.neutral;
  };

  // Función para calcular cuántas semanas activas tiene un mes
  const getActiveWeeksCount = (year: number, month: number) => {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    
    // Generar todas las semanas que tocan el mes
    const weeks: Array<{start: Date, end: Date, weekNumber: number}> = [];
    let currentDate = new Date(firstDayOfMonth);
    
    // Retroceder hasta encontrar el primer lunes antes del mes
    while (currentDate.getDay() !== 1) { // 1 = lunes
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    let weekNumber = 1;
    
    // Generar semanas hasta cubrir todo el mes
    while (currentDate <= lastDayOfMonth) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 5); // Lunes a sábado (6 días)
      weekEnd.setHours(23, 59, 59, 999);
      
      // Contar días de trabajo (lunes-sábado) que pertenecen al mes
      let workDaysInMonth = 0;
      let tempDate = new Date(weekStart);
      
      for (let i = 0; i < 6; i++) { // 6 días de trabajo
        if (tempDate.getMonth() === month - 1) {
          workDaysInMonth++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
      
      // La semana pertenece al mes que tiene más días activos
      // Si hay empate (3-3), la semana va al mes que tiene el lunes
      if (workDaysInMonth > 3 || (workDaysInMonth === 3 && weekStart.getMonth() === month - 1)) {
        weeks.push({
          start: new Date(weekStart),
          end: new Date(weekEnd),
          weekNumber
        });
        weekNumber++;
      }
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return weeks.length;
  };

  // Función para obtener información detallada de las semanas activas
  const getActiveWeeksInfo = (year: number, month: number) => {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    
    // Generar todas las semanas que tocan el mes
    const weeks: Array<{start: Date, end: Date, weekNumber: number}> = [];
    let currentDate = new Date(firstDayOfMonth);
    
    // Retroceder hasta encontrar el primer lunes antes del mes
    while (currentDate.getDay() !== 1) { // 1 = lunes
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    let weekNumber = 1;
    
    // Generar semanas hasta cubrir todo el mes
    while (currentDate <= lastDayOfMonth) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 5); // Lunes a sábado (6 días)
      weekEnd.setHours(23, 59, 59, 999);
      
      // Contar días de trabajo (lunes-sábado) que pertenecen al mes
      let workDaysInMonth = 0;
      let tempDate = new Date(weekStart);
      
      for (let i = 0; i < 6; i++) { // 6 días de trabajo
        if (tempDate.getMonth() === month - 1) {
          workDaysInMonth++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
      
      // La semana pertenece al mes que tiene más días activos
      // Si hay empate (3-3), la semana va al mes que tiene el lunes
      if (workDaysInMonth > 3 || (workDaysInMonth === 3 && weekStart.getMonth() === month - 1)) {
        weeks.push({
          start: new Date(weekStart),
          end: new Date(weekEnd),
          weekNumber
        });
        weekNumber++;
      }
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    // Generar información visual
    const weeksInfo: string[] = [];
    const monthName = monthOptions.find(m => m.value === month)?.label;
    weeksInfo.push(`📅 ${monthName} ${year} - Semanas Activas:`);
    weeksInfo.push('');
    
    // Crear calendario visual
    const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    weeksInfo.push('📋 Calendario de Semanas Activas:');
    weeksInfo.push('');
    
    weeks.forEach(week => {
      const startDate = week.start.toLocaleDateString('es-MX', { 
        day: 'numeric', 
        month: 'short' 
      });
      const endDate = week.end.toLocaleDateString('es-MX', { 
        day: 'numeric', 
        month: 'short' 
      });
      
      // Mostrar días de la semana
      let weekDays = '';
      let tempDate = new Date(week.start);
      
      for (let i = 0; i < 6; i++) {
        const dayStr = tempDate.getDate().toString().padStart(2, '0');
        const isInMonth = tempDate.getMonth() === month - 1;
        weekDays += `${daysOfWeek[i]} ${dayStr}${isInMonth ? '' : '*'}`;
        if (i < 5) weekDays += ' | ';
        tempDate.setDate(tempDate.getDate() + 1);
      }
      
      weeksInfo.push(`🔹 Semana ${week.weekNumber}: ${startDate} - ${endDate}`);
      weeksInfo.push(`   ${weekDays}`);
      weeksInfo.push('');
    });
    
    weeksInfo.push('* Días fuera del mes seleccionado');
    
    return weeksInfo.join('\n');
  };

  // Función para verificar qué meses tienen 5 semanas (para debugging)
  const getMonthsWith5Weeks = (year: number) => {
    const monthsWith5Weeks: number[] = [];
    for (let month = 1; month <= 12; month++) {
      const weekCount = getActiveWeeksCount(year, month);
      if (weekCount === 5) {
        monthsWith5Weeks.push(month);
      }
    }
    return monthsWith5Weeks;
  };

  // Función para obtener las fechas de las semanas activas
  const getActiveWeeksDates = (year: number, month: number) => {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    
    // Generar todas las semanas que tocan el mes
    const weeks: Array<{start: Date, end: Date, weekNumber: number}> = [];
    let currentDate = new Date(firstDayOfMonth);
    
    // Retroceder hasta encontrar el primer lunes antes del mes
    while (currentDate.getDay() !== 1) { // 1 = lunes
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    let weekNumber = 1;
    
    // Generar semanas hasta cubrir todo el mes
    while (currentDate <= lastDayOfMonth) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 5); // Lunes a sábado (6 días)
      weekEnd.setHours(23, 59, 59, 999);
      
      // Contar días de trabajo (lunes-sábado) que pertenecen al mes
      let workDaysInMonth = 0;
      let tempDate = new Date(weekStart);
      
      for (let i = 0; i < 6; i++) { // 6 días de trabajo
        if (tempDate.getMonth() === month - 1) {
          workDaysInMonth++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
      
      // La semana pertenece al mes que tiene más días activos
      // Si hay empate (3-3), la semana va al mes que tiene el lunes
      if (workDaysInMonth > 3 || (workDaysInMonth === 3 && weekStart.getMonth() === month - 1)) {
        weeks.push({
          start: new Date(weekStart),
          end: new Date(weekEnd),
          weekNumber
        });
        weekNumber++;
      }
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return weeks;
  };



  if (routesLoading) {
    return <LoadingDots label="Cargando rutas..." />;
  }

  if (reportError) {
    return <GraphQLErrorNotice errors={[reportError]} />;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>📊 Análisis de Cartera Activa</h1>
        <p style={styles.subtitle}>
          Control semanal de créditos activos con desglose por localidad
        </p>
        {useActiveWeeks && (
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#0369a1'
          }}>
            <strong>💡 Modo "Semanas Activas":</strong> El reporte considera solo las semanas completas del mes. 
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span 
                style={{ 
                  cursor: 'help', 
                  textDecoration: 'underline',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                📅 {getActiveWeeksCount(selectedYear, selectedMonth)} semanas activas en {monthOptions.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </span>
              
              {showTooltip && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  zIndex: 1000,
                  backgroundColor: 'white',
                  border: '2px solid #0ea5e9',
                  borderRadius: '8px',
                  padding: '16px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  maxWidth: '350px',
                  minWidth: '320px'
                }}>
                  <div style={{
                    fontWeight: '600',
                    marginBottom: '12px',
                    color: '#0369a1',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '8px',
                    textAlign: 'center'
                  }}>
                    📅 {monthOptions.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </div>
                  
                  <div style={{
                    marginBottom: '12px',
                    fontSize: '11px',
                    color: '#64748b',
                    textAlign: 'center'
                  }}>
                    Semanas activas en azul
                  </div>
                  
                  <div style={{
                    width: '100%',
                    fontSize: '11px'
                  }}>
                    <CustomCalendar 
                      year={selectedYear}
                      month={selectedMonth}
                      activeWeeks={getActiveWeeksDates(selectedYear, selectedMonth)}
                    />
                  </div>
                  
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e2e8f0',
                    fontSize: '11px',
                    color: '#64748b',
                    textAlign: 'center'
                  }}>
                    📊 {getActiveWeeksCount(selectedYear, selectedMonth)} semanas activas
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div style={styles.filtersRow}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Ruta
            </label>
            <Select
              value={routeOptions.find(opt => opt.value === selectedRoute?.id) || null}
              options={routeOptions}
              onChange={(option) => {
                const route = routesData.routes.find((r: Route) => r.id === option?.value);
                setSelectedRoute(route || null);
              }}
              placeholder="Seleccionar ruta..."
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Año
            </label>
            <Select
              value={yearOptions.find(opt => opt.value === selectedYear) || null}
              options={yearOptions}
              onChange={(option) => setSelectedYear(option?.value || new Date().getFullYear())}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Mes
            </label>
            <Select
              value={monthOptions.find(opt => opt.value === selectedMonth) || null}
              options={monthOptions}
              onChange={(option) => setSelectedMonth(option?.value || new Date().getMonth() + 1)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="useActiveWeeks"
                checked={useActiveWeeks}
                onChange={(e) => setUseActiveWeeks(e.target.checked)}
                style={{ margin: 0 }}
              />
              <label 
                htmlFor="useActiveWeeks" 
                style={{ 
                  fontSize: '14px', 
                  fontWeight: '500',
                  cursor: 'pointer',
                  userSelect: 'none' as const
                }}
              >
                Semanas activas del mes
              </label>
            </div>
            <Button
              tone="active"
              onClick={() => refetchReport()}
              isLoading={reportLoading}
            >
              <FaSync /> Actualizar
            </Button>
          </div>
        </div>

        {/* Filtros de CV */}
        <div style={styles.filtersRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="useCVFilter"
              checked={useCVFilter}
              onChange={(e) => {
                setUseCVFilter(e.target.checked);
                if (!e.target.checked) {
                  setExcludeCVAfterMonth(null);
                  setExcludeCVAfterYear(null);
                } else {
                  // Por defecto, 6 meses hacia atrás
                  const defaultDate = new Date();
                  defaultDate.setMonth(defaultDate.getMonth() - 6);
                  setExcludeCVAfterMonth(defaultDate.getMonth() + 1);
                  setExcludeCVAfterYear(defaultDate.getFullYear());
                }
              }}
              style={{ margin: 0 }}
            />
            <label 
              htmlFor="useCVFilter" 
              style={{ 
                fontSize: '14px', 
                fontWeight: '500',
                cursor: 'pointer',
                userSelect: 'none' as const
              }}
            >
              Excluir CV después de:
            </label>
          </div>

          {useCVFilter && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '12px' }}>
                  Mes
                </label>
                <Select
                  value={monthOptions.find(opt => opt.value === excludeCVAfterMonth) || null}
                  options={monthOptions}
                  onChange={(option) => setExcludeCVAfterMonth(option?.value || null)}
                  placeholder="Seleccionar mes..."
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '12px' }}>
                  Año
                </label>
                <Select
                  value={yearOptions.find(opt => opt.value === excludeCVAfterYear) || null}
                  options={yearOptions}
                  onChange={(option) => setExcludeCVAfterYear(option?.value || null)}
                  placeholder="Seleccionar año..."
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Resumen de KPIs */}
      {processedData && (
        <React.Fragment>
          {/* Primera fila - Métricas básicas */}
          <div style={styles.summaryCards}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryValue}>
                {formatNumber(processedData.summary.totalActiveAtMonthStart)}
              </div>
              <div style={styles.summaryLabel}>Créditos Inicio Mes</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryValue}>
                {formatNumber(processedData.summary.totalActiveAtMonthEnd)}
              </div>
              <div style={styles.summaryLabel}>Créditos Final Mes</div>
            </div>

            <div style={styles.summaryCard}>
              <div style={styles.summaryValue}>
                {formatNumber(processedData.summary.totalGrantedInMonth)}
              </div>
              <div style={styles.summaryLabel}>Otorgados en Mes</div>
            </div>
          </div>

          {/* Segunda fila - Métricas de análisis */}
          <div style={styles.summaryCards}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryValue}>
                {formatNumber(processedData.summary.totalFinishedInMonth)}
              </div>
              <div style={styles.summaryLabel}>Finalizados en Mes</div>
            </div>

            <div style={styles.summaryCard}>
              <div 
                style={{
                  ...styles.summaryValue,
                  ...getChangeColor(processedData.summary.netChangeInMonth)
                }}
              >
                {processedData.summary.netChangeInMonth > 0 ? '+' : ''}
                {formatNumber(processedData.summary.netChangeInMonth)}
              </div>
              <div style={styles.summaryLabel}>Cambio Neto</div>
            </div>

            <div style={styles.summaryCard}>
              <div 
                style={{
                  ...styles.summaryValue,
                  ...getChangeColor((() => {
                    const growthPercent = processedData.summary.totalActiveAtMonthStart > 0 
                      ? ((processedData.summary.netChangeInMonth / processedData.summary.totalActiveAtMonthStart) * 100)
                      : 0;
                    return growthPercent;
                  })())
                }}
              >
                {(() => {
                  const growthPercent = processedData.summary.totalActiveAtMonthStart > 0 
                    ? ((processedData.summary.netChangeInMonth / processedData.summary.totalActiveAtMonthStart) * 100)
                    : 0;
                  return (growthPercent > 0 ? '+' : '') + growthPercent.toFixed(1) + '%';
                })()}
              </div>
              <div style={styles.summaryLabel}>% Crecimiento</div>
            </div>
          </div>

          {/* Sección de Limpiezas de Cartera */}
          {cleanupsData?.getPortfolioCleanups?.cleanups?.length > 0 && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '24px',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#92400e'
              }}>
                🧹 Limpiezas de Cartera Registradas
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px'
              }}>
                {cleanupsData.getPortfolioCleanups.cleanups.map((cleanup: any, index: number) => (
                  <div key={cleanup.id} style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '16px',
                    border: '1px solid #fbbf24'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        color: '#92400e'
                      }}>
                        {cleanup.name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#a16207',
                        backgroundColor: '#fef3c7',
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}>
                        {new Date(cleanup.cleanupDate).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                    
                    {cleanup.description && (
                      <div style={{
                        fontSize: '13px',
                        color: '#78716c',
                        marginBottom: '12px',
                        fontStyle: 'italic'
                      }}>
                        {cleanup.description}
                      </div>
                    )}
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      fontSize: '12px'
                    }}>
                      <div>
                        <span style={{ fontWeight: '500', color: '#92400e' }}>Préstamos excluidos:</span>
                        <div style={{ color: '#dc2626', fontWeight: '600' }}>
                          {formatNumber(cleanup.excludedLoansCount)}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', color: '#92400e' }}>Monto excluido:</span>
                        <div style={{ color: '#dc2626', fontWeight: '600' }}>
                          {formatCurrency(cleanup.excludedAmount)}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', color: '#92400e' }}>Desde:</span>
                        <div style={{ color: '#78716c' }}>
                          {cleanup.excludedFromMonth}/{cleanup.excludedFromYear}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', color: '#92400e' }}>Ejecutado por:</span>
                        <div style={{ color: '#78716c' }}>
                          {cleanup.executedByName || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#fef3c7',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#92400e',
                textAlign: 'center'
              }}>
                <strong>Total excluido en el mes:</strong> {formatNumber(
                  cleanupsData.getPortfolioCleanups.cleanups.reduce((sum: number, cleanup: any) => 
                    sum + cleanup.excludedLoansCount, 0
                  )
                )} préstamos por {formatCurrency(
                  cleanupsData.getPortfolioCleanups.cleanups.reduce((sum: number, cleanup: any) => 
                    sum + cleanup.excludedAmount, 0
                  )
                )}
              </div>
            </div>
          )}
        </React.Fragment>
      )}

      {/* Tabla de datos */}
      {processedData && (
        <div style={styles.tableContainer}>
          <div style={styles.tableHeader}>
            <div style={styles.tableTitle}>
              <FaTable />
              {processedData.month.name} - {processedData.route.name}
            </div>
            <div style={styles.actionButtons}>
              <Button tone="passive" size="small">
                <FaDownload /> Exportar
              </Button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>LOCALIDAD</th>
                  {processedData.weeks.map(week => (
                    <th key={week} style={{ ...styles.th, textAlign: 'center' }}>
                      <div style={{ fontWeight: '700', fontSize: '12px', marginBottom: '4px' }}>
                        {week}
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 'normal', color: '#718096', lineHeight: '1.3' }}>
                        Cartera • Movimientos • Indicadores
                      </div>
                    </th>
                  ))}
                  <th style={{ ...styles.th, textAlign: 'center', backgroundColor: '#edf2f7' }}>
                    <div style={{ fontWeight: '700', fontSize: '12px', marginBottom: '4px' }}>
                      RESUMEN MENSUAL
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 'normal', color: '#718096', lineHeight: '1.3' }}>
                                                  Totales • Indicadores • Comparaciones
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {allLocalities.map(locality => (
                  <tr key={locality} style={{ ':hover': { backgroundColor: '#f7fafc' } }}>
                    <td style={{ ...styles.td, ...styles.localityName }}>
                      {locality}
                    </td>
                    
                    {processedData.weeks.map(week => {
                      const weekData = processedData.data[week]?.[locality];
                      if (!weekData) {
                        return (
                          <td key={week} style={{ ...styles.td, textAlign: 'center', color: '#a0aec0' }}>
                            -
                          </td>
                        );
                      }

                      const change = weekData.activeAtEnd - weekData.activeAtStart;
                      
                      return (
                        <td key={week} style={{ ...styles.td, textAlign: 'center' }}>
                          <div style={styles.weekStats}>
                            {/* Grupo principal de datos */}
                            <div style={styles.statGroup}>
                              <div style={styles.statGroupTitle}>Cartera</div>
                              <div style={styles.statRow}>
                                <span style={styles.statLabel}>Activos:</span>
                                <span style={{
                                  ...styles.statValue,
                                  ...getChangeColor(weekData.activeAtEnd - weekData.activeAtStart)
                                }}>
                                  {weekData.activeAtStart} → {weekData.activeAtEnd}
                                </span>
                              </div>
                              <div style={styles.statRow}>
                                <span style={styles.statLabel}>Cambio:</span>
                                <span style={{ ...styles.statValue, ...getChangeColor(change) }}>
                                  {change > 0 ? '+' : ''}{change}
                                </span>
                              </div>
                            </div>

                            {/* Grupo de movimientos */}
                            <div style={styles.statGroup}>
                              <div style={styles.statGroupTitle}>Movimientos</div>
                              <div style={styles.statRow}>
                                <span style={styles.statLabel}>Otorgados:</span>
                                <span style={styles.statValue}>{weekData.granted}</span>
                              </div>
                              <div style={styles.statRow}>
                                <span style={{ ...styles.statLabel, paddingLeft: '8px', fontSize: '10px' }}>• Nuevos:</span>
                                <span style={{ ...styles.statValue, color: '#38a169', fontSize: '10px' }}>
                                  {weekData.grantedNew || 0}
                                </span>
                              </div>
                              <div style={styles.statRow}>
                                <span style={{ ...styles.statLabel, paddingLeft: '8px', fontSize: '10px' }}>• Renovados:</span>
                                <span style={{ ...styles.statValue, color: '#3182ce', fontSize: '10px' }}>
                                  {weekData.grantedRenewed || 0}
                                </span>
                              </div>
                              <div style={styles.statRow}>
                                <span style={styles.statLabel}>Finalizados:</span>
                                <span style={styles.statValue}>{weekData.finished}</span>
                              </div>
                            </div>

                            {/* Grupo de indicadores */}
                            <div>
                              <div style={styles.statGroupTitle}>Indicadores</div>
                              <div style={styles.statRow}>
                                <span style={styles.statLabel}>CV:</span>
                                <span style={{ 
                                  ...styles.statValue, 
                                  color: weekData.cv > 0 ? '#e53e3e' : '#718096' 
                                }}>
                                  {weekData.cv}
                                </span>
                              </div>
                              <div style={styles.statRow}>
                                <span style={styles.statLabel}>% Paga:</span>
                                <span style={{ 
                                  ...styles.statValue, 
                                  color: (() => {
                                    const totalActive = weekData.activeAtEnd || 0;
                                    const clientsPaying = totalActive - (weekData.cv || 0);
                                    const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
                                    if (paymentRate >= 80) return '#38a169';
                                    if (paymentRate >= 60) return '#d69e2e';
                                    return '#e53e3e';
                                  })(),
                                  fontSize: '10px'
                                }}>
                                  {(() => {
                                    const totalActive = weekData.activeAtEnd || 0;
                                    const clientsPaying = totalActive - (weekData.cv || 0);
                                    const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
                                    return paymentRate.toFixed(1) + '%';
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    {/* Total del mes para la localidad */}
                    <td style={{ ...styles.td, textAlign: 'center', backgroundColor: '#f7fafc' }}>
                      <div style={styles.weekStats}>
                        {(() => {
                          let totalGranted = 0;
                          let totalFinished = 0;
                          let startValue = 0;
                          let endValue = 0;

                          processedData.weeks.forEach(week => {
                            const weekData = processedData.data[week]?.[locality];
                            if (weekData) {
                              totalGranted += weekData.granted;
                              totalFinished += weekData.finished;
                              if (startValue === 0) startValue = weekData.activeAtStart;
                              endValue = weekData.activeAtEnd;
                            }
                          });

                          const totalChange = endValue - startValue;

                          return (
                            <React.Fragment>
                              {/* Grupo de cartera mensual */}
                              <div style={styles.statGroup}>
                                <div style={styles.statGroupTitle}>Cartera Mensual</div>
                                <div style={styles.statRow}>
                                  <span style={styles.statLabel}>Total:</span>
                                  <span style={{
                                    ...styles.statValue,
                                    ...getChangeColor(totalChange)
                                  }}>
                                    {startValue} → {endValue}
                                  </span>
                                </div>
                                <div style={styles.statRow}>
                                  <span style={styles.statLabel}>Cambio:</span>
                                  <span style={{ ...styles.statValue, ...getChangeColor(totalChange) }}>
                                    {totalChange > 0 ? '+' : ''}{totalChange}
                                  </span>
                                </div>
                                <div style={styles.statRow}>
                                  <span style={styles.statLabel}>% Crecimiento:</span>
                                  <span style={{
                                    ...styles.statValue,
                                    ...getChangeColor(totalChange),
                                    fontSize: '11px'
                                  }}>
                                    {(() => {
                                      const growthPercent = startValue > 0 
                                        ? ((totalChange / startValue) * 100)
                                        : 0;
                                      return (growthPercent > 0 ? '+' : '') + growthPercent.toFixed(1) + '%';
                                    })()}
                                  </span>
                                </div>
                              </div>

                              {/* Grupo de movimientos mensuales */}
                              <div style={styles.statGroup}>
                                <div style={styles.statGroupTitle}>Movimientos Mensuales</div>
                                <div style={styles.statRow}>
                                  <span style={styles.statLabel}>Otorgados:</span>
                                  <span>{totalGranted}</span>
                                </div>
                                <div style={styles.statRow}>
                                  <span style={{ ...styles.statLabel, paddingLeft: '8px', fontSize: '10px' }}>• Nuevos:</span>
                                  <span style={{ ...styles.statValue, color: '#38a169', fontSize: '10px' }}>
                                    {(() => {
                                      let totalNew = 0;
                                      processedData.weeks.forEach(week => {
                                        const weekData = processedData.data[week]?.[locality];
                                        if (weekData) {
                                          totalNew += weekData.grantedNew || 0;
                                        }
                                      });
                                      return totalNew;
                                    })()}
                                  </span>
                                </div>
                                <div style={styles.statRow}>
                                  <span style={{ ...styles.statLabel, paddingLeft: '8px', fontSize: '10px' }}>• Renovados:</span>
                                  <span style={{ ...styles.statValue, color: '#3182ce', fontSize: '10px' }}>
                                    {(() => {
                                      let totalRenewed = 0;
                                      processedData.weeks.forEach(week => {
                                        const weekData = processedData.data[week]?.[locality];
                                        if (weekData) {
                                          totalRenewed += weekData.grantedRenewed || 0;
                                        }
                                      });
                                      return totalRenewed;
                                    })()}
                                  </span>
                                </div>
                                <div style={styles.statRow}>
                                  <span style={styles.statLabel}>Finalizados:</span>
                                  <span>{totalFinished}</span>
                                </div>
                              </div>

                              {/* Grupo de indicadores mensuales */}
                              <div>
                                <div style={styles.statGroupTitle}>Indicadores Mensuales</div>
                                <div style={styles.statRow}>
                                  <span style={styles.statLabel}>CV Promedio:</span>
                                  <span style={{ 
                                    ...styles.statValue, 
                                    color: (() => {
                                      let totalCV = 0;
                                      let activeWeeks = 0;
                                      
                                      processedData.weeks.forEach(week => {
                                        const weekData = processedData.data[week]?.[locality];
                                        if (weekData) {
                                          const hasActivity = weekData.granted > 0 || weekData.finished > 0 || weekData.activeAtStart > 0;
                                          if (hasActivity) {
                                            totalCV += weekData.cv || 0;
                                            activeWeeks++;
                                          }
                                        }
                                      });
                                      
                                      const avgCV = activeWeeks > 0 ? totalCV / activeWeeks : 0;
                                      const prevMonthCV = 15;
                                      const currentCV = (avgCV / endValue) * 100;
                                      
                                      if (currentCV < prevMonthCV) return '#38a169';
                                      if (currentCV > prevMonthCV) return '#e53e3e';
                                      return '#718096';
                                    })(),
                                    fontSize: '10px'
                                  }}>
                                    {(() => {
                                      let totalCV = 0;
                                      let activeWeeks = 0;
                                      
                                      processedData.weeks.forEach(week => {
                                        const weekData = processedData.data[week]?.[locality];
                                        if (weekData) {
                                          const hasActivity = weekData.granted > 0 || weekData.finished > 0 || weekData.activeAtStart > 0;
                                          if (hasActivity) {
                                            totalCV += weekData.cv || 0;
                                            activeWeeks++;
                                          }
                                        }
                                      });
                                      
                                      const avgCV = activeWeeks > 0 ? totalCV / activeWeeks : 0;
                                      const prevMonthCV = 15;
                                      const currentCV = (avgCV / endValue) * 100;
                                      
                                      return `${prevMonthCV}% → ${currentCV.toFixed(1)}%`;
                                    })()}
                                  </span>
                                </div>
                                <div style={styles.statRow}>
                                  <span style={styles.statLabel}>% Paga Promedio:</span>
                                  <span style={{ 
                                    ...styles.statValue, 
                                    color: (() => {
                                      let totalPaymentRate = 0;
                                      let activeWeeks = 0;
                                      
                                      processedData.weeks.forEach(week => {
                                        const weekData = processedData.data[week]?.[locality];
                                        if (weekData) {
                                          const hasActivity = weekData.granted > 0 || weekData.finished > 0 || weekData.activeAtStart > 0;
                                          if (hasActivity) {
                                            const totalActive = weekData.activeAtEnd || 0;
                                            const clientsPaying = totalActive - (weekData.cv || 0);
                                            const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
                                            totalPaymentRate += paymentRate;
                                            activeWeeks++;
                                          }
                                        }
                                      });
                                      
                                      const avgPaymentRate = activeWeeks > 0 ? totalPaymentRate / activeWeeks : 0;
                                      const prevMonthPayment = 85;
                                      
                                      if (avgPaymentRate > prevMonthPayment) return '#38a169';
                                      if (avgPaymentRate < prevMonthPayment) return '#e53e3e';
                                      return '#718096';
                                    })(),
                                    fontSize: '10px'
                                  }}>
                                    {(() => {
                                      let totalPaymentRate = 0;
                                      let activeWeeks = 0;
                                      
                                      processedData.weeks.forEach(week => {
                                        const weekData = processedData.data[week]?.[locality];
                                        if (weekData) {
                                          const hasActivity = weekData.granted > 0 || weekData.finished > 0 || weekData.activeAtStart > 0;
                                          if (hasActivity) {
                                            const totalActive = weekData.activeAtEnd || 0;
                                            const clientsPaying = totalActive - (weekData.cv || 0);
                                            const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
                                            totalPaymentRate += paymentRate;
                                            activeWeeks++;
                                          }
                                        }
                                      });
                                      
                                      const avgPaymentRate = activeWeeks > 0 ? totalPaymentRate / activeWeeks : 0;
                                      const prevMonthPayment = 85;
                                      
                                      return `${prevMonthPayment}% → ${avgPaymentRate.toFixed(1)}%`;
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Fila de totales */}
                <tr style={{ backgroundColor: '#0052CC', color: 'white', fontWeight: '600' }}>
                  <td style={{ ...styles.td, color: 'white', fontWeight: '600' }}>
                    TOTALES
                  </td>
                  
                  {processedData.weeks.map(week => {
                    const weekTotal = processedData.weeklyTotals[week];
                    const change = weekTotal.netChange;
                    
                    return (
                      <td key={week} style={{ ...styles.td, textAlign: 'center', color: 'white' }}>
                        <div style={styles.weekStats}>
                          {/* Grupo de cartera semanal */}
                          <div style={styles.statGroup}>
                            <div style={{ ...styles.statGroupTitle, color: 'white' }}>Cartera</div>
                            <div style={styles.statRow}>
                              <span>Activos:</span>
                              <span style={getChangeColor(change)}>
                                {weekTotal.activeAtStart} → {weekTotal.activeAtEnd}
                              </span>
                            </div>
                            <div style={styles.statRow}>
                              <span>Cambio:</span>
                              <span style={getChangeColor(change)}>
                                {change > 0 ? '+' : ''}{change}
                              </span>
                            </div>
                            <div style={styles.statRow}>
                              <span style={{ fontSize: '11px' }}>% Crecimiento:</span>
                              <span style={{
                                ...getChangeColor(change),
                                fontSize: '11px'
                              }}>
                                {(() => {
                                  const growthPercent = weekTotal.activeAtStart > 0 
                                    ? ((change / weekTotal.activeAtStart) * 100)
                                    : 0;
                                  return (growthPercent > 0 ? '+' : '') + growthPercent.toFixed(1) + '%';
                                })()}
                              </span>
                            </div>
                          </div>

                          {/* Grupo de movimientos semanales */}
                          <div style={styles.statGroup}>
                            <div style={{ ...styles.statGroupTitle, color: 'white' }}>Movimientos</div>
                            <div style={styles.statRow}>
                              <span>Otorgados:</span>
                              <span>{weekTotal.granted}</span>
                            </div>
                            <div style={styles.statRow}>
                              <span style={{ fontSize: '11px' }}>• Nuevos:</span>
                              <span style={{ color: '#4ade80', fontSize: '11px' }}>
                                {weekTotal.grantedNew || 0}
                              </span>
                            </div>
                            <div style={styles.statRow}>
                              <span style={{ fontSize: '11px' }}>• Renovados:</span>
                              <span style={{ color: '#60a5fa', fontSize: '11px' }}>
                                {weekTotal.grantedRenewed || 0}
                              </span>
                            </div>
                            <div style={styles.statRow}>
                              <span>Finalizados:</span>
                              <span>{weekTotal.finished}</span>
                            </div>
                          </div>

                          {/* Grupo de indicadores semanales */}
                          <div>
                            <div style={{ ...styles.statGroupTitle, color: 'white' }}>Indicadores</div>
                            <div style={styles.statRow}>
                              <span>CV:</span>
                              <span style={{ color: weekTotal.cv > 0 ? '#ff6b6b' : 'white' }}>
                                {weekTotal.cv}
                              </span>
                            </div>
                            <div style={styles.statRow}>
                              <span style={{ fontSize: '11px' }}>% Paga:</span>
                              <span style={{ 
                                color: (() => {
                                  const totalActive = weekTotal.activeAtEnd || 0;
                                  const clientsPaying = totalActive - (weekTotal.cv || 0);
                                  const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
                                  if (paymentRate >= 80) return '#4ade80';
                                  if (paymentRate >= 60) return '#fbbf24';
                                  return '#ff6b6b';
                                })(),
                                fontSize: '11px'
                              }}>
                                {(() => {
                                  const totalActive = weekTotal.activeAtEnd || 0;
                                  const clientsPaying = totalActive - (weekTotal.cv || 0);
                                  const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
                                  return paymentRate.toFixed(1) + '%';
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  <td style={{ ...styles.td, textAlign: 'center', color: 'white' }}>
                    <div style={styles.weekStats}>
                      {/* Grupo de cartera mensual - TOTALES */}
                      <div style={styles.statGroup}>
                        <div style={{ ...styles.statGroupTitle, color: 'white' }}>Cartera Total</div>
                        <div style={styles.statRow}>
                          <span>Total:</span>
                          <span>
                            {processedData.summary.totalActiveAtMonthStart} → {processedData.summary.totalActiveAtMonthEnd}
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span>Cambio:</span>
                          <span>
                            {processedData.summary.netChangeInMonth > 0 ? '+' : ''}
                            {processedData.summary.netChangeInMonth}
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span style={{ fontSize: '11px' }}>% Crecimiento:</span>
                          <span style={{
                            color: (() => {
                              const growthPercent = processedData.summary.totalActiveAtMonthStart > 0 
                                ? ((processedData.summary.netChangeInMonth / processedData.summary.totalActiveAtMonthStart) * 100)
                                : 0;
                              if (growthPercent > 0) return '#4ade80';
                              if (growthPercent < 0) return '#ff6b6b';
                              return 'white';
                            })(),
                            fontSize: '11px'
                          }}>
                            {(() => {
                              const growthPercent = processedData.summary.totalActiveAtMonthStart > 0 
                                ? ((processedData.summary.netChangeInMonth / processedData.summary.totalActiveAtMonthStart) * 100)
                                : 0;
                              return (growthPercent > 0 ? '+' : '') + growthPercent.toFixed(1) + '%';
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Grupo de movimientos totales */}
                      <div style={styles.statGroup}>
                        <div style={{ ...styles.statGroupTitle, color: 'white' }}>Movimientos Totales</div>
                        <div style={styles.statRow}>
                          <span>Otorgados:</span>
                          <span>{processedData.summary.totalGrantedInMonth}</span>
                        </div>
                        <div style={styles.statRow}>
                          <span style={{ fontSize: '11px' }}>• Nuevos:</span>
                          <span style={{ color: '#4ade80', fontSize: '11px' }}>
                            {(() => {
                              let totalNew = 0;
                              Object.values(processedData.weeklyTotals).forEach((week: any) => {
                                totalNew += week.grantedNew || 0;
                              });
                              return totalNew;
                            })()}
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span style={{ fontSize: '11px' }}>• Renovados:</span>
                          <span style={{ color: '#60a5fa', fontSize: '11px' }}>
                            {(() => {
                              let totalRenewed = 0;
                              Object.values(processedData.weeklyTotals).forEach((week: any) => {
                                totalRenewed += week.grantedRenewed || 0;
                              });
                              return totalRenewed;
                            })()}
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span>Finalizados:</span>
                          <span>{processedData.summary.totalFinishedInMonth}</span>
                        </div>
                      </div>

                      {/* Grupo de indicadores totales */}
                      <div>
                        <div style={{ ...styles.statGroupTitle, color: 'white' }}>Indicadores Totales</div>
                        <div style={styles.statRow}>
                          <span>CV Promedio:</span>
                          <span style={{ 
                            color: (() => {
                              let totalCV = 0;
                              let activeWeeks = 0;
                              
                              Object.values(processedData.weeklyTotals).forEach((week: any) => {
                                const hasActivity = week.granted > 0 || week.finished > 0 || week.activeAtStart > 0;
                                if (hasActivity) {
                                  totalCV += week.cv || 0;
                                  activeWeeks++;
                                }
                              });
                              
                              const avgCV = activeWeeks > 0 ? totalCV / activeWeeks : 0;
                              const prevMonthCVPercent = 15;
                              const currentCVPercent = processedData.summary.totalActiveAtMonthEnd > 0 
                                ? (avgCV / processedData.summary.totalActiveAtMonthEnd) * 100 
                                : 0;
                              
                              if (currentCVPercent < prevMonthCVPercent) return '#4ade80';
                              if (currentCVPercent > prevMonthCVPercent) return '#ff6b6b';
                              return 'white';
                            })(),
                            fontSize: '11px'
                          }}>
                            {(() => {
                              let totalCV = 0;
                              let activeWeeks = 0;
                              
                              Object.values(processedData.weeklyTotals).forEach((week: any) => {
                                const hasActivity = week.granted > 0 || week.finished > 0 || week.activeAtStart > 0;
                                if (hasActivity) {
                                  totalCV += week.cv || 0;
                                  activeWeeks++;
                                }
                              });
                              
                              const avgCV = activeWeeks > 0 ? totalCV / activeWeeks : 0;
                              const prevMonthCVPercent = 15;
                              const currentCVPercent = processedData.summary.totalActiveAtMonthEnd > 0 
                                ? (avgCV / processedData.summary.totalActiveAtMonthEnd) * 100 
                                : 0;
                              
                              return `${prevMonthCVPercent}% → ${currentCVPercent.toFixed(1)}%`;
                            })()}
                          </span>
                        </div>
                        <div style={styles.statRow}>
                          <span style={{ fontSize: '11px' }}>% Paga Promedio:</span>
                          <span style={{
                            color: (() => {
                              let totalPaymentRate = 0;
                              let activeWeeks = 0;
                              
                              Object.values(processedData.weeklyTotals).forEach((week: any) => {
                                const hasActivity = week.granted > 0 || week.finished > 0 || week.activeAtStart > 0;
                                if (hasActivity) {
                                  const totalActive = week.activeAtEnd || 0;
                                  const clientsPaying = totalActive - (week.cv || 0);
                                  const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
                                  totalPaymentRate += paymentRate;
                                  activeWeeks++;
                                }
                              });
                              
                              const avgPaymentRate = activeWeeks > 0 ? totalPaymentRate / activeWeeks : 0;
                              const prevMonthPayment = 85;
                              
                              if (avgPaymentRate > prevMonthPayment) return '#4ade80';
                              if (avgPaymentRate < prevMonthPayment) return '#ff6b6b';
                              return 'white';
                            })(),
                            fontSize: '11px'
                          }}>
                            {(() => {
                              let totalPaymentRate = 0;
                              let activeWeeks = 0;
                              
                              Object.values(processedData.weeklyTotals).forEach((week: any) => {
                                const hasActivity = week.granted > 0 || week.finished > 0 || week.activeAtStart > 0;
                                if (hasActivity) {
                                  const totalActive = week.activeAtEnd || 0;
                                  const clientsPaying = totalActive - (week.cv || 0);
                                  const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
                                  totalPaymentRate += paymentRate;
                                  activeWeeks++;
                                }
                              });
                              
                              const avgPaymentRate = activeWeeks > 0 ? totalPaymentRate / activeWeeks : 0;
                              const prevMonthPayment = 85;
                              
                              return `${prevMonthPayment}% → ${avgPaymentRate.toFixed(1)}%`;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estado de carga */}
      {reportLoading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <LoadingDots label="Cargando reporte..." />
        </div>
      )}

      {/* Estado sin datos */}
      {!reportLoading && !processedData && selectedRoute && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '12px',
          color: '#718096'
        }}>
          No hay datos disponibles para el período seleccionado
        </div>
      )}
    </div>
  );
} 