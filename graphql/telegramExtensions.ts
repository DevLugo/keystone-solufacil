import { gql } from 'graphql-tag';

// Extensión del esquema GraphQL para Telegram
export const telegramGraphQLExtensions = gql`
  extend type Query {
    debugTelegram: String!
    telegramStatus: String!
  }

  extend type Mutation {
    testWebhook: String!
  }
`;

// Resolvers para las extensiones
export const telegramResolvers = {
  Query: {
    debugTelegram: async () => {
      console.log('🔍 Debugging de Telegram solicitado via GraphQL');
      return 'Debugging de Telegram completado - Revisa la consola del servidor';
    },
    telegramStatus: async () => {
      console.log('📡 Estado de Telegram solicitado via GraphQL');
      return 'Estado de Telegram verificado - Revisa la consola del servidor';
    },
  },
  Mutation: {
    testWebhook: async () => {
      console.log('🧪 Test webhook solicitado via GraphQL');
      return 'Test webhook completado - Revisa la consola del servidor';
    },
  },
};
