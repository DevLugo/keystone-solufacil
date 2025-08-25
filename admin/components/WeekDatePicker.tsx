/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { jsx, Box, Text } from '@keystone-ui/core';
import { DatePicker } from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { FaCalendar, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface WeekDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
}

export const WeekDatePicker: React.FC<WeekDatePickerProps> = ({
  value,
  onChange,
  label = 'Seleccionar Semana'
}) => {
  // Función para obtener el lunes de la semana
  const getMondayOfWeek = (date: Date): Date => {
    try {
      if (!date || isNaN(date.getTime())) {
        throw new Error('Fecha de entrada inválida');
      }
      
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar cuando el día es domingo
      d.setDate(diff);
      
      // Verificar que la fecha resultante sea válida
      if (isNaN(d.getTime())) {
        throw new Error('Fecha resultante inválida');
      }
      
      return d;
    } catch (error) {
      console.error('Error en getMondayOfWeek:', error);
      // Fallback: usar fecha actual
      const fallbackDate = new Date();
      fallbackDate.setHours(0, 0, 0, 0);
      return fallbackDate;
    }
  };

  // Función para obtener el domingo de la semana
  const getSundayOfWeek = (date: Date): Date => {
    try {
      const monday = getMondayOfWeek(date);
      if (!monday || isNaN(monday.getTime())) {
        throw new Error('No se pudo obtener el lunes de la semana');
      }
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      // Verificar que la fecha resultante sea válida
      if (isNaN(sunday.getTime())) {
        throw new Error('Fecha del domingo inválida');
      }
      
      return sunday;
    } catch (error) {
      console.error('Error en getSundayOfWeek:', error);
      // Fallback: usar fecha actual + 6 días
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 6);
      return fallbackDate;
    }
  };

  // Función para formatear la fecha
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Función para ir a la semana anterior
  const goToPreviousWeek = () => {
    try {
      if (!value || isNaN(value.getTime())) {
        throw new Error('Fecha actual inválida');
      }
      
      const newDate = new Date(value);
      newDate.setDate(value.getDate() - 7);
      
      if (isNaN(newDate.getTime())) {
        throw new Error('Fecha anterior inválida');
      }
      
      onChange(newDate);
    } catch (error) {
      console.error('Error yendo a semana anterior:', error);
      // Fallback: usar fecha actual
      const fallbackDate = new Date();
      fallbackDate.setHours(0, 0, 0, 0);
      onChange(fallbackDate);
    }
  };

  // Función para ir a la semana siguiente
  const goToNextWeek = () => {
    try {
      if (!value || isNaN(value.getTime())) {
        throw new Error('Fecha actual inválida');
      }
      
      const newDate = new Date(value);
      newDate.setDate(value.getDate() + 7);
      
      if (isNaN(newDate.getTime())) {
        throw new Error('Fecha siguiente inválida');
      }
      
      onChange(newDate);
    } catch (error) {
      console.error('Error yendo a semana siguiente:', error);
      // Fallback: usar fecha actual
      const fallbackDate = new Date();
      fallbackDate.setHours(0, 0, 0, 0);
      onChange(fallbackDate);
    }
  };

  // Función para ir a la semana actual
  const goToCurrentWeek = () => {
    try {
      const today = new Date();
      if (isNaN(today.getTime())) {
        throw new Error('Fecha actual inválida');
      }
      
      const monday = getMondayOfWeek(today);
      onChange(monday);
    } catch (error) {
      console.error('Error yendo a semana actual:', error);
      // Fallback: usar fecha actual sin ajustar
      const fallbackDate = new Date();
      fallbackDate.setHours(0, 0, 0, 0);
      onChange(fallbackDate);
    }
  };

  // Validar que value sea una fecha válida
  if (!value || isNaN(value.getTime())) {
    console.error('WeekDatePicker: value es inválida, usando fecha actual');
    const fallbackDate = new Date();
    fallbackDate.setHours(0, 0, 0, 0);
    value = fallbackDate;
  }
  
  const monday = getMondayOfWeek(value);
  const sunday = getSundayOfWeek(value);
  const weekRange = `${formatDate(monday)} - ${formatDate(sunday)}`;

  return (
    <Box>
      {label && (
        <Text weight="medium" size="small" color="neutral" marginBottom="small">
          {label}
        </Text>
      )}
      
      <Box
        css={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}
      >
        <Button
          size="small"
          onClick={goToPreviousWeek}
          css={{
            padding: '6px',
            minWidth: 'auto',
            backgroundColor: '#64748b',
            '&:hover': { backgroundColor: '#475569' }
          }}
        >
          <FaChevronLeft size={12} />
        </Button>

        <Box
          css={{
            flex: 1,
            textAlign: 'center',
            padding: '8px 12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            cursor: 'pointer',
            '&:hover': { borderColor: '#9ca3af' }
          }}
          onClick={() => {
            // Al hacer click en el rango, abrir el DatePicker
            const input = document.querySelector('input[type="date"]') as HTMLInputElement;
            if (input) input.showPicker();
          }}
        >
          <Text weight="semibold" size="small" color="neutral">
            {weekRange}
          </Text>
        </Box>

        <Button
          size="small"
          onClick={goToNextWeek}
          css={{
            padding: '6px',
            minWidth: 'auto',
            backgroundColor: '#64748b',
            '&:hover': { backgroundColor: '#475569' }
          }}
        >
          <FaChevronRight size={12} />
        </Button>

        <Button
          size="small"
          onClick={goToCurrentWeek}
          css={{
            padding: '6px 12px',
            minWidth: 'auto',
            backgroundColor: '#0ea5e9',
            '&:hover': { backgroundColor: '#0284c7' }
          }}
        >
          <FaCalendar size={12} />
        </Button>
      </Box>

      <Box marginTop="small">
        <DatePicker
          value={value && !isNaN(value.getTime()) ? value.toISOString() : new Date().toISOString()}
          onUpdate={(dateString: string) => {
            try {
              const selectedDate = new Date(dateString);
              if (isNaN(selectedDate.getTime())) {
                console.error('Fecha seleccionada inválida:', dateString);
                return;
              }
              // Ajustar al lunes de la semana seleccionada
              const monday = getMondayOfWeek(selectedDate);
              onChange(monday);
            } catch (error) {
              console.error('Error procesando fecha seleccionada:', error);
            }
          }}
          onClear={() => {
            try {
              const today = new Date();
              const monday = getMondayOfWeek(today);
              onChange(monday);
            } catch (error) {
              console.error('Error procesando fecha actual:', error);
              // Fallback: usar fecha actual sin ajustar
              onChange(new Date());
            }
          }}
        />
      </Box>
    </Box>
  );
};
