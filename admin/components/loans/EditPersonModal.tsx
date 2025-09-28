/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
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

  const [updatePersonalDataName] = useMutation(UPDATE_PERSONAL_DATA_NAME);
  const [updatePersonalDataPhone] = useMutation(UPDATE_PERSONAL_DATA_PHONE);

  useEffect(() => {
    if (person) {
      setFullName(person.fullName);
      setPhone(person.phones?.[0]?.number || '');
    }
  }, [person]);

  const handleSave = async () => {
    if (!person || !fullName.trim()) return;

    setIsLoading(true);
    try {
      // Actualizar nombre
      const nameResult = await updatePersonalDataName({
        variables: {
          where: { id: person.id },
          data: { fullName: fullName.trim() }
        }
      });

      // Actualizar teléfono si existe y tiene un ID válido (no temp-phone)
      if (phone.trim() && person.phones?.[0]?.id && person.phones[0].id !== 'temp-phone') {
        await updatePersonalDataPhone({
          variables: {
            where: { id: person.phones[0].id },
            data: { number: phone.trim() }
          }
        });
      }

      if (nameResult.data?.updatePersonalData) {
        // Crear objeto actualizado con los datos modificados
        const updatedPerson = {
          ...person,
          fullName: fullName.trim(),
          phones: person.phones?.map((p, index) => 
            index === 0 ? { ...p, number: phone.trim() } : p
          ) || []
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
            label="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ingresa el nombre completo"
            autoFocus
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <TextInput
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
