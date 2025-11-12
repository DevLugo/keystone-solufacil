/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect, useRef } from 'react';
import { jsx } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { TextInput } from '@keystone-ui/fields';
import { useMutation, gql } from '@apollo/client';

interface PersonalData {
  id: string;
  fullName: string;
  phones: Array<{
    id: string;
    number: string;
  }>;
  addresses: Array<{
    id: string;
    location: {
      id: string;
      name: string;
    };
  }>;
}

interface EditPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: PersonalData | null;
  onSave: (updatedPerson: PersonalData) => void;
  title: string;
}

// Mutaciones GraphQL
const UPDATE_PERSONAL_DATA_NAME = gql`
  mutation UpdatePersonalDataName($where: PersonalDataWhereUniqueInput!, $data: PersonalDataUpdateInput!) {
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

const UPDATE_PERSONAL_DATA_PHONE = gql`
  mutation UpdatePersonalDataPhone($where: PhoneWhereUniqueInput!, $data: PhoneUpdateInput!) {
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


const EditPersonModal: React.FC<EditPersonModalProps> = ({
  isOpen,
  onClose,
  person,
  onSave,
  title
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fullNameInputRef = useRef<any>(null);
  const phoneInputRef = useRef<any>(null);

  const [updatePersonalDataName] = useMutation(UPDATE_PERSONAL_DATA_NAME);
  const [updatePersonalDataPhone] = useMutation(UPDATE_PERSONAL_DATA_PHONE);
  const [createPhone] = useMutation(CREATE_PHONE);

  // Estado para preservar la posición del cursor
  const [cursorPosition, setCursorPosition] = useState<{ fullName?: number; phone?: number }>({});

  useEffect(() => {
    if (person) {
      setFullName(person.fullName);
      setPhone(person.phones?.[0]?.number || '');
    }
  }, [person]);

  // Restaurar posición del cursor después de actualizar el estado
  useEffect(() => {
    if (cursorPosition.fullName !== undefined && fullNameInputRef.current) {
      // Usar setTimeout para asegurar que el DOM se haya actualizado
      setTimeout(() => {
        const input = fullNameInputRef.current;
        if (!input) return;
        
        // Buscar el input real dentro del componente TextInput
        let actualInput: HTMLInputElement | null = null;
        if (input instanceof HTMLInputElement) {
          actualInput = input;
        } else {
          actualInput = input.querySelector('input');
        }
        
        if (actualInput) {
          actualInput.focus();
          actualInput.setSelectionRange(cursorPosition.fullName!, cursorPosition.fullName!);
        }
        setCursorPosition(prev => ({ ...prev, fullName: undefined }));
      }, 0);
    }
  }, [fullName, cursorPosition.fullName]);

  useEffect(() => {
    if (cursorPosition.phone !== undefined && phoneInputRef.current) {
      setTimeout(() => {
        const input = phoneInputRef.current;
        if (!input) return;
        
        let actualInput: HTMLInputElement | null = null;
        if (input instanceof HTMLInputElement) {
          actualInput = input;
        } else {
          actualInput = input.querySelector('input');
        }
        
        if (actualInput) {
          actualInput.focus();
          actualInput.setSelectionRange(cursorPosition.phone!, cursorPosition.phone!);
        }
        setCursorPosition(prev => ({ ...prev, phone: undefined }));
      }, 0);
    }
  }, [phone, cursorPosition.phone]);

  // Handlers que preservan la posición del cursor
  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const cursorPos = input.selectionStart || 0;
    const newValue = e.target.value.toUpperCase();
    setFullName(newValue);
    // Guardar la posición del cursor ajustada por la transformación
    setCursorPosition(prev => ({ ...prev, fullName: cursorPos }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const cursorPos = input.selectionStart || 0;
    setPhone(e.target.value);
    setCursorPosition(prev => ({ ...prev, phone: cursorPos }));
  };

  const handleSave = async () => {
    if (!person || !fullName.trim()) return;

    setIsLoading(true);
    try {
      // Actualizar nombre
      const nameResult = await updatePersonalDataName({
        variables: {
          where: { id: person.id },
          data: { fullName: fullName.trim().toUpperCase() }
        }
      });

      let updatedPhones = person.phones || [];

      // Manejar teléfono
      if (phone.trim()) {
        const existingPhone = person.phones?.[0];
        
        if (existingPhone?.id && existingPhone.id !== 'temp-phone') {
          // Actualizar teléfono existente
          await updatePersonalDataPhone({
            variables: {
              where: { id: existingPhone.id },
              data: { number: phone.trim() }
            }
          });
          
          // Actualizar el array local
          updatedPhones = updatedPhones.map((p, index) => 
            index === 0 ? { ...p, number: phone.trim() } : p
          );
        } else {
          // Crear nuevo teléfono
          const phoneResult = await createPhone({
            variables: {
              data: {
                number: phone.trim(),
                personalData: {
                  connect: {
                    id: person.id
                  }
                }
              }
            }
          });
          
          if (phoneResult.data?.createPhone) {
            // Reemplazar el teléfono temporal con el real
            updatedPhones = [phoneResult.data.createPhone];
          }
        }
      } else {
        // Si no hay teléfono, mantener el array vacío
        updatedPhones = [];
      }

      if (nameResult.data?.updatePersonalData) {
        // Crear objeto actualizado con los datos modificados
        const updatedPerson = {
          ...person,
          fullName: fullName.trim().toUpperCase(),
          phones: updatedPhones
        };
        
        onSave(updatedPerson);
        onClose();
      }
    } catch (error) {
      console.error('Error updating person:', error);
      alert('Error al actualizar la información');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFullName('');
    setPhone('');
    onClose();
  };

  if (!isOpen || !person) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
      }}>
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#1F2937'
        }}>
          {title}
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <TextInput
            ref={fullNameInputRef}
            label="Nombre completo"
            value={fullName}
            onChange={handleFullNameChange}
            placeholder="Ingresa el nombre completo"
            autoFocus
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <TextInput
            ref={phoneInputRef}
            label="Teléfono"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="Ingresa el teléfono"
          />
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={handleClose}
            tone="passive"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            tone="positive"
            isLoading={isLoading}
            disabled={!fullName.trim()}
          >
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditPersonModal;
