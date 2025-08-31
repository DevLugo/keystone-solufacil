import React, { useState, useEffect } from 'react';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { FaTelegram, FaUserPlus, FaUserMinus, FaCheck, FaTimes, FaEye, FaEdit, FaTrash } from 'react-icons/fa';

// Queries y mutations para usuarios de Telegram
const GET_TELEGRAM_USERS = gql`
  query GetTelegramUsers {
    telegramUsers {
      id
      chatId
      name
      username
      isActive
      registeredAt
      lastActivity
      reportsReceived
      isInRecipientsList
      notes
      platformUser {
        id
        name
        email
        role
      }
    }
  }
`;

const ACTIVATE_TELEGRAM_USER = gql`
  mutation ActivateTelegramUser($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { isActive: true }) {
      id
      isActive
    }
  }
`;

const DEACTIVATE_TELEGRAM_USER = gql`
  mutation DeactivateTelegramUser($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { isActive: false }) {
      id
      isActive
    }
  }
`;

const ADD_TO_RECIPIENTS_LIST = gql`
  mutation AddToRecipientsList($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { isInRecipientsList: true }) {
      id
      isInRecipientsList
    }
  }
`;

const REMOVE_FROM_RECIPIENTS_LIST = gql`
  mutation RemoveFromRecipientsList($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { isInRecipientsList: false }) {
      id
      isInRecipientsList
    }
  }
`;

const LINK_TELEGRAM_USER = gql`
  mutation LinkTelegramUser($id: ID!, $platformUserId: ID!) {
    updateTelegramUser(where: { id: $id }, data: { platformUser: { connect: { id: $platformUserId } } }) {
      id
      platformUser {
        id
        name
        email
      }
    }
  }
`;

const UNLINK_TELEGRAM_USER = gql`
  mutation UnlinkTelegramUser($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { platformUser: { disconnect: true } }) {
      id
      platformUser {
        id
        name
        email
      }
    }
  }
`;

const DELETE_TELEGRAM_USER = gql`
  mutation DeleteTelegramUser($id: ID!) {
    deleteTelegramUser(where: { id: $id }) {
      id
    }
  }
`;

const GET_PLATFORM_USERS = gql`
  query GetPlatformUsers {
    users {
      id
      name
      email
      role
    }
  }
`;

// Interfaces
interface TelegramUser {
  id: string;
  chatId: string;
  name: string;
  username?: string;
  isActive: boolean;
  registeredAt: string;
  lastActivity: string;
  reportsReceived: number;
  isInRecipientsList: boolean;
  notes?: string;
  platformUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function TelegramUsersPage() {
  const [selectedUser, setSelectedUser] = useState<TelegramUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string>('');

  // Queries
  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useQuery(GET_TELEGRAM_USERS);
  const { data: platformUsersData } = useQuery(GET_PLATFORM_USERS);

  // Mutations
  const [activateUser] = useMutation(ACTIVATE_TELEGRAM_USER);
  const [deactivateUser] = useMutation(DEACTIVATE_TELEGRAM_USER);
  const [addToRecipientsList] = useMutation(ADD_TO_RECIPIENTS_LIST);
  const [removeFromRecipientsList] = useMutation(REMOVE_FROM_RECIPIENTS_LIST);
  const [linkTelegramUser] = useMutation(LINK_TELEGRAM_USER);
  const [unlinkTelegramUser] = useMutation(UNLINK_TELEGRAM_USER);
  const [deleteUser] = useMutation(DELETE_TELEGRAM_USER);

  // Datos procesados
  const users = usersData?.telegramUsers || [];

  // Funciones de manejo
  const handleActivateUser = async (userId: string) => {
    try {
      await activateUser({ variables: { id: userId } });
      refetchUsers();
    } catch (error) {
      console.error('Error activating user:', error);
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      await deactivateUser({ variables: { id: userId } });
      refetchUsers();
    } catch (error) {
      console.error('Error deactivating user:', error);
    }
  };

  const handleAddToRecipientsList = async (userId: string) => {
    try {
      await addToRecipientsList({ variables: { id: userId } });
      refetchUsers();
    } catch (error) {
      console.error('Error adding user to recipients list:', error);
    }
  };

  const handleRemoveFromRecipientsList = async (userId: string) => {
    try {
      await removeFromRecipientsList({ variables: { id: userId } });
      refetchUsers();
    } catch (error) {
      console.error('Error removing user from recipients list:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;

    try {
      await deleteUser({ variables: { id: userId } });
      refetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleLinkUser = async (telegramUserId: string, platformUserId: string) => {
    try {
      await linkTelegramUser({ 
        variables: { 
          id: telegramUserId, 
          platformUserId 
        } 
      });
      refetchUsers();
    } catch (error) {
      console.error('Error vinculando usuario:', error);
    }
  };

  const handleUnlinkUser = async (id: string) => {
    try {
      await unlinkTelegramUser({ variables: { id } });
      refetchUsers();
    } catch (error) {
      console.error('Error desvinculando usuario:', error);
    }
  };

  const handleViewUser = (user: TelegramUser) => {
    setSelectedUser(user);
    setEditingNotes(user.notes || '');
    setShowUserModal(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedUser) return;

    try {
      // TODO: Implementar actualización de notas
      console.log('Guardando notas:', editingNotes);
      setShowUserModal(false);
      refetchUsers();
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  // Estadísticas
  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    inRecipientsList: users.filter(u => u.isInRecipientsList).length,
    totalReportsSent: users.reduce((sum, u) => sum + u.reportsReceived, 0),
  };

  // Loading state
  if (usersLoading) {
    return (
      <PageContainer header="👥 Usuarios de Telegram">
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '16px' }}>
            Cargando usuarios...
          </div>
          <div style={{
            display: 'inline-block',
            width: '20px',
            height: '20px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer header="👥 Usuarios de Telegram">
      <div style={{ padding: '32px' }}>
        {/* Header con estadísticas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            padding: '24px',
            backgroundColor: '#f0f9ff',
            borderRadius: '12px',
            border: '1px solid #bae6fd',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0369a1' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '14px', color: '#0369a1' }}>
              Total de Usuarios
            </div>
          </div>

          <div style={{
            padding: '24px',
            backgroundColor: '#f0fdf4',
            borderRadius: '12px',
            border: '1px solid #bbf7d0',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
              {stats.active}
            </div>
            <div style={{ fontSize: '14px', color: '#16a34a' }}>
              Usuarios Activos
            </div>
          </div>

          <div style={{
            padding: '24px',
            backgroundColor: '#fef3c7',
            borderRadius: '12px',
            border: '1px solid #fcd34d',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706' }}>
              {stats.inRecipientsList}
            </div>
            <div style={{ fontSize: '14px', color: '#d97706' }}>
              En Lista de Destinatarios
            </div>
          </div>

          <div style={{
            padding: '24px',
            backgroundColor: '#f3e8ff',
            borderRadius: '12px',
            border: '1px solid #d8b4fe',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9333ea' }}>
              {stats.totalReportsSent}
            </div>
            <div style={{ fontSize: '14px', color: '#9333ea' }}>
              Reportes Enviados
            </div>
          </div>
        </div>

        {/* Lista de usuarios */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}>
            <h2 style={{ margin: '0', fontSize: '20px', fontWeight: '600' }}>
              Usuarios Registrados
            </h2>
            <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              Gestiona los usuarios que se han registrado a través del bot de Telegram
            </p>
          </div>

          {users.length === 0 ? (
            <div style={{
              padding: '48px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <FaTelegram style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }} />
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>
                No hay usuarios registrados
              </div>
              <div style={{ fontSize: '14px' }}>
                Los usuarios aparecerán aquí cuando se registren con /start en el bot
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                      Usuario
                    </th>
                    <th style={{ padding: '16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                      Chat ID
                    </th>
                    <th style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                      Estado
                    </th>
                    <th style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                      Destinatario
                    </th>
                    <th style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                      Reportes
                    </th>
                    <th style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: '600' }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px' }}>
                        <div>
                          <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                            {user.name}
                          </div>
                          {user.username && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              @{user.username}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '12px' }}>
                        {user.chatId}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: user.isActive ? '#f0fdf4' : '#fef2f2',
                          color: user.isActive ? '#16a34a' : '#dc2626',
                          border: `1px solid ${user.isActive ? '#bbf7d0' : '#fecaca'}`
                        }}>
                          {user.isActive ? '✅ Activo' : '❌ Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: user.isInRecipientsList ? '#f0fdf4' : '#fef3c7',
                          color: user.isInRecipientsList ? '#16a34a' : '#d97706',
                          border: `1px solid ${user.isInRecipientsList ? '#bbf7d0' : '#fcd34d'}`
                        }}>
                          {user.isInRecipientsList ? '✅ Sí' : '⏳ No'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: '#f3e8ff',
                          color: '#9333ea',
                          border: '1px solid #d8b4fe'
                        }}>
                          {user.reportsReceived}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleViewUser(user)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              backgroundColor: 'white',
                              color: '#374151',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                            title="Ver detalles"
                          >
                            <FaEye />
                          </button>

                          {user.isActive ? (
                            <button
                              onClick={() => handleDeactivateUser(user.id)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #dc2626',
                                backgroundColor: 'white',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Desactivar"
                            >
                              <FaTimes />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivateUser(user.id)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #16a34a',
                                backgroundColor: 'white',
                                color: '#16a34a',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Activar"
                            >
                              <FaCheck />
                            </button>
                          )}

                          {user.isInRecipientsList ? (
                            <button
                              onClick={() => handleRemoveFromRecipientsList(user.id)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #d97706',
                                backgroundColor: 'white',
                                color: '#d97706',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Remover de destinatarios"
                            >
                              <FaUserMinus />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddToRecipientsList(user.id)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #16a34a',
                                backgroundColor: 'white',
                                color: '#16a34a',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Agregar a destinatarios"
                            >
                              <FaUserPlus />
                            </button>
                          )}

                          {/* Botón de vincular/desvincular */}
                          {user.platformUser ? (
                            <button
                              onClick={() => handleUnlinkUser(user.id)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #7c3aed',
                                backgroundColor: 'white',
                                color: '#7c3aed',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title={`Desvincular de ${user.platformUser.name || user.platformUser.email}`}
                            >
                              🔗
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedUser(user)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #059669',
                                backgroundColor: 'white',
                                color: '#059669',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Vincular con usuario de plataforma"
                            >
                              🔗
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #dc2626',
                              backgroundColor: 'white',
                              color: '#dc2626',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                            title="Eliminar"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de vinculación de usuario */}
      {selectedUser && !showUserModal && (
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
              Vincular Usuario de Telegram
            </h3>
            <p style={{ margin: '0 0 16px 0', color: '#6b7280' }}>
              Selecciona el usuario de la plataforma para vincular con: <strong>{selectedUser.name}</strong>
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Usuario de la Plataforma:
              </label>
              <select 
                id="platformUserSelect"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">Selecciona un usuario...</option>
                {platformUsersData?.users?.map((platformUser: any) => (
                  <option key={platformUser.id} value={platformUser.id}>
                    {platformUser.name || 'Sin nombre'} ({platformUser.email}) - {platformUser.role || 'NORMAL'}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const select = document.getElementById('platformUserSelect') as HTMLSelectElement;
                  const platformUserId = select.value;
                  if (platformUserId) {
                    handleLinkUser(selectedUser.id, platformUserId);
                    setSelectedUser(null);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#059669',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Vincular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles del usuario */}
      {showUserModal && selectedUser && (
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Detalles del Usuario
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Nombre:
              </label>
              <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                {selectedUser.name}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Username:
              </label>
              <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                {selectedUser.username ? `@${selectedUser.username}` : 'No especificado'}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Chat ID:
              </label>
              <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '6px', fontFamily: 'monospace' }}>
                {selectedUser.chatId}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Estado:
              </label>
              <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                {selectedUser.isActive ? '✅ Activo' : '❌ Inactivo'}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                En Lista de Destinatarios:
              </label>
              <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                {selectedUser.isInRecipientsList ? '✅ Sí' : '⏳ No'}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Reportes Recibidos:
              </label>
              <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                {selectedUser.reportsReceived}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Fecha de Registro:
              </label>
              <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                {new Date(selectedUser.registeredAt).toLocaleString('es-MX')}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Última Actividad:
              </label>
              <div style={{ padding: '8px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                {new Date(selectedUser.lastActivity).toLocaleString('es-MX')}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Notas:
              </label>
              <textarea
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
                placeholder="Agregar notas sobre este usuario..."
              />
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowUserModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNotes}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
