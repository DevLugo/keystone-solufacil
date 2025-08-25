/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */

import React, { useState, useRef, useEffect } from 'react';
import { TextInput } from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { FaEdit, FaCheck, FaTimes } from 'react-icons/fa';

interface InlineEditFieldProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  type?: 'text' | 'tel';
  disabled?: boolean;
}

export const InlineEditField = ({ 
  value, 
  onSave, 
  placeholder = '', 
  type = 'text',
  disabled = false 
}: InlineEditFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
  };

  const handleSave = async () => {
    if (editValue.trim() === value.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Error al guardar:', error);
      setEditValue(value); // Revertir al valor original
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <TextInput
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          type={type}
          style={{ flex: 1, fontSize: '13px' }}
          disabled={isSaving}
        />
        <Button
          tone="active"
          size="small"
          onClick={handleSave}
          disabled={isSaving}
          style={{ padding: '4px 6px', minWidth: 'auto' }}
        >
          {isSaving ? '...' : <FaCheck size={10} />}
        </Button>
        <Button
          tone="negative"
          size="small"
          onClick={handleCancel}
          disabled={isSaving}
          style={{ padding: '4px 6px', minWidth: 'auto' }}
        >
          <FaTimes size={10} />
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ flex: 1, fontSize: '13px' }}>
        {value || placeholder}
      </span>
      {!disabled && (
        <Button
          tone="passive"
          size="small"
          onClick={handleStartEdit}
          style={{ padding: '2px 4px', minWidth: 'auto' }}
        >
          <FaEdit size={10} />
        </Button>
      )}
    </div>
  );
};
