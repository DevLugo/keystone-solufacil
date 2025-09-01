/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { useState, useEffect } from 'react';

interface TimePickerProps {
  value?: string;
  onChange?: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
  css?: any;
}

export const TimePicker: React.FC<TimePickerProps> = ({ 
  value = '', 
  onChange, 
  placeholder = 'Selecciona la hora',
  disabled = false,
  css = {}
}) => {
  const [selectedTime, setSelectedTime] = useState(value);

  useEffect(() => {
    setSelectedTime(value);
  }, [value]);

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = event.target.value;
    setSelectedTime(newTime);
    if (onChange) {
      onChange(newTime);
    }
  };

  return (
    <input
      type="time"
      value={selectedTime}
      onChange={handleTimeChange}
      placeholder={placeholder}
      disabled={disabled}
      css={{
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#374151',
        backgroundColor: disabled ? '#f3f4f6' : 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        '&:focus': {
          outline: 'none',
          borderColor: '#3b82f6',
          boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
        },
        '&:hover': {
          borderColor: disabled ? '#d1d5db' : '#9ca3af'
        },
        ...css
      }}
    />
  );
};
