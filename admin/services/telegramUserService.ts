import { gql } from '@apollo/client';

// Interfaces para usuarios de Telegram
export interface TelegramUser {
  id: string;
  chatId: string;
  name: string;
  username?: string;
  isActive: boolean;
  registeredAt: Date;
  lastActivity: Date;
  reportsReceived: number;
  isInRecipientsList: boolean;
  notes?: string;
}

export interface CreateTelegramUserInput {
  chatId: string;
  name: string;
  username?: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateTelegramUserInput {
  id: string;
  isActive?: boolean;
  isInRecipientsList?: boolean;
  notes?: string;
  lastActivity?: Date;
}

// Queries GraphQL
export const GET_TELEGRAM_USERS = gql`
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
    }
  }
`;

export const GET_TELEGRAM_USER_BY_CHAT_ID = gql`
  query GetTelegramUserByChatId($chatId: String!) {
    telegramUsers(where: { chatId: { equals: $chatId } }) {
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
    }
  }
`;

export const CREATE_TELEGRAM_USER = gql`
  mutation CreateTelegramUser($data: TelegramUserCreateInput!) {
    createTelegramUser(data: $data) {
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
    }
  }
`;

export const UPDATE_TELEGRAM_USER = gql`
  mutation UpdateTelegramUser($id: ID!, $data: TelegramUserUpdateInput!) {
    updateTelegramUser(where: { id: $id }, data: $data) {
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
    }
  }
`;

export const DELETE_TELEGRAM_USER = gql`
  mutation DeleteTelegramUser($id: ID!) {
    deleteTelegramUser(where: { id: $id }) {
      id
    }
  }
`;

export const ACTIVATE_TELEGRAM_USER = gql`
  mutation ActivateTelegramUser($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { isActive: true }) {
      id
      isActive
    }
  }
`;

export const DEACTIVATE_TELEGRAM_USER = gql`
  mutation DeactivateTelegramUser($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { isActive: false }) {
      id
      isActive
    }
  }
`;

export const ADD_TO_RECIPIENTS_LIST = gql`
  mutation AddToRecipientsList($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { isInRecipientsList: true }) {
      id
      isInRecipientsList
    }
  }
`;

export const REMOVE_FROM_RECIPIENTS_LIST = gql`
  mutation RemoveFromRecipientsList($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { isInRecipientsList: false }) {
      id
      isInRecipientsList
    }
  }
`;

export const INCREMENT_REPORTS_RECEIVED = gql`
  mutation IncrementReportsReceived($id: ID!) {
    updateTelegramUser(where: { id: $id }, data: { 
      reportsReceived: { increment: 1 },
      lastActivity: { set: "${new Date().toISOString()}" }
    }) {
      id
      reportsReceived
      lastActivity
    }
  }
`;

export class TelegramUserService {
  /**
   * Crea un nuevo usuario de Telegram
   */
  async createUser(userData: CreateTelegramUserInput): Promise<TelegramUser | null> {
    try {
      // Aquí implementarías la lógica real con GraphQL
      // Por ahora simulamos la creación
      const newUser: TelegramUser = {
        id: `user_${Date.now()}`,
        chatId: userData.chatId,
        name: userData.name,
        username: userData.username,
        isActive: userData.isActive ?? true,
        registeredAt: new Date(),
        lastActivity: new Date(),
        reportsReceived: 0,
        isInRecipientsList: false,
        notes: userData.notes,
      };

      console.log('Usuario de Telegram creado:', newUser);
      return newUser;
    } catch (error) {
      console.error('Error creating Telegram user:', error);
      return null;
    }
  }

  /**
   * Obtiene un usuario por Chat ID
   */
  async getUserByChatId(chatId: string): Promise<TelegramUser | null> {
    try {
      // Aquí implementarías la lógica real con GraphQL
      // Por ahora simulamos la búsqueda
      console.log('Buscando usuario con Chat ID:', chatId);
      
      // Simular usuario encontrado
      const user: TelegramUser = {
        id: 'user_123',
        chatId: chatId,
        name: 'Usuario Simulado',
        username: 'usuario_simulado',
        isActive: true,
        registeredAt: new Date(),
        lastActivity: new Date(),
        reportsReceived: 5,
        isInRecipientsList: true,
        notes: 'Usuario de prueba',
      };

      return user;
    } catch (error) {
      console.error('Error getting Telegram user by Chat ID:', error);
      return null;
    }
  }

  /**
   * Obtiene todos los usuarios de Telegram
   */
  async getAllUsers(): Promise<TelegramUser[]> {
    try {
      // Aquí implementarías la lógica real con GraphQL
      // Por ahora simulamos la lista
      const users: TelegramUser[] = [
        {
          id: 'user_1',
          chatId: '123456789',
          name: 'Juan Pérez',
          username: 'juan_perez',
          isActive: true,
          registeredAt: new Date('2024-01-01'),
          lastActivity: new Date(),
          reportsReceived: 15,
          isInRecipientsList: true,
          notes: 'Usuario activo',
        },
        {
          id: 'user_2',
          chatId: '987654321',
          name: 'María García',
          username: 'maria_garcia',
          isActive: true,
          registeredAt: new Date('2024-01-02'),
          lastActivity: new Date(),
          reportsReceived: 8,
          isInRecipientsList: true,
          notes: 'Recibe reportes financieros',
        },
        {
          id: 'user_3',
          chatId: '555666777',
          name: 'Carlos López',
          username: 'carlos_lopez',
          isActive: false,
          registeredAt: new Date('2024-01-03'),
          lastActivity: new Date('2024-01-15'),
          reportsReceived: 3,
          isInRecipientsList: false,
          notes: 'Usuario desactivado',
        },
      ];

      return users;
    } catch (error) {
      console.error('Error getting all Telegram users:', error);
      return [];
    }
  }

  /**
   * Actualiza un usuario de Telegram
   */
  async updateUser(updateData: UpdateTelegramUserInput): Promise<TelegramUser | null> {
    try {
      // Aquí implementarías la lógica real con GraphQL
      console.log('Actualizando usuario:', updateData);
      
      // Simular usuario actualizado
      const updatedUser: TelegramUser = {
        id: updateData.id,
        chatId: '123456789',
        name: 'Usuario Actualizado',
        username: 'usuario_actualizado',
        isActive: updateData.isActive ?? true,
        registeredAt: new Date(),
        lastActivity: updateData.lastActivity ?? new Date(),
        reportsReceived: 10,
        isInRecipientsList: updateData.isInRecipientsList ?? true,
        notes: updateData.notes,
      };

      return updatedUser;
    } catch (error) {
      console.error('Error updating Telegram user:', error);
      return null;
    }
  }

  /**
   * Activa un usuario
   */
  async activateUser(id: string): Promise<boolean> {
    try {
      const result = await this.updateUser({ id, isActive: true });
      return result !== null;
    } catch (error) {
      console.error('Error activating Telegram user:', error);
      return false;
    }
  }

  /**
   * Desactiva un usuario
   */
  async deactivateUser(id: string): Promise<boolean> {
    try {
      const result = await this.updateUser({ id, isActive: false });
      return result !== null;
    } catch (error) {
      console.error('Error deactivating Telegram user:', error);
      return false;
    }
  }

  /**
   * Agrega un usuario a la lista de destinatarios
   */
  async addToRecipientsList(id: string): Promise<boolean> {
    try {
      const result = await this.updateUser({ id, isInRecipientsList: true });
      return result !== null;
    } catch (error) {
      console.error('Error adding user to recipients list:', error);
      return false;
    }
  }

  /**
   * Remueve un usuario de la lista de destinatarios
   */
  async removeFromRecipientsList(id: string): Promise<boolean> {
    try {
      const result = await this.updateUser({ id, isInRecipientsList: false });
      return result !== null;
    } catch (error) {
      console.error('Error removing user from recipients list:', error);
      return false;
    }
  }

  /**
   * Incrementa el contador de reportes recibidos
   */
  async incrementReportsReceived(id: string): Promise<boolean> {
    try {
      const result = await this.updateUser({ 
        id, 
        lastActivity: new Date() 
      });
      return result !== null;
    } catch (error) {
      console.error('Error incrementing reports received:', error);
      return false;
    }
  }

  /**
   * Elimina un usuario de Telegram
   */
  async deleteUser(id: string): Promise<boolean> {
    try {
      // Aquí implementarías la lógica real con GraphQL
      console.log('Eliminando usuario:', id);
      return true;
    } catch (error) {
      console.error('Error deleting Telegram user:', error);
      return false;
    }
  }

  /**
   * Obtiene estadísticas de usuarios
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    inRecipientsList: number;
    totalReportsSent: number;
  }> {
    try {
      const users = await this.getAllUsers();
      
      const stats = {
        total: users.length,
        active: users.filter(u => u.isActive).length,
        inactive: users.filter(u => !u.isActive).length,
        inRecipientsList: users.filter(u => u.isInRecipientsList).length,
        totalReportsSent: users.reduce((sum, u) => sum + u.reportsReceived, 0),
      };

      return stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        inRecipientsList: 0,
        totalReportsSent: 0,
      };
    }
  }
}

// Instancia singleton del servicio
export const telegramUserService = new TelegramUserService();
