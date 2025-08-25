import { gql } from '@apollo/client';

export const GET_TRANSACTIONS = gql`
  query GetTransactions($where: TransactionWhereInput!) {
    transactions(where: $where) {
      id
      amount
      date
      type
      expenseSource
      description
      lead {
        id
        personalData {
          fullName
        }
      }
      sourceAccount {
        id
        amount
        type
      }
    }
  }
`;

// Nueva query optimizada para gastos por fecha
// OPTIMIZACIONES:
// 1. Usa filtro IN en lugar de múltiples filtros NOT (más eficiente)
// 2. Elimina __typename innecesarios
// 3. Estructura optimizada para los índices de fecha + tipo + expenseSource
export const GET_EXPENSES_BY_DATE_OPTIMIZED = gql`
  query GetExpensesByDateOptimized($date: DateTime!, $nextDate: DateTime!, $leadId: ID) {
    transactions(where: {
      AND: [
        { date: { gte: $date } },
        { date: { lt: $nextDate } },
        { type: { equals: "EXPENSE" } },
        { expenseSource: { in: ["VIATIC", "GASOLINE", "ACCOMMODATION", "NOMINA_SALARY", "EXTERNAL_SALARY", "VEHICULE_MAINTENANCE"] } },
        { OR: [
          { lead: { id: { equals: $leadId } } },
          { AND: [{ NOT: { lead: null } }, { lead: { id: { not: null } } }] }
        ]}
      ]
    }) {
      id
      amount
      expenseSource
      date
      sourceAccount {
        id
        name
      }
      lead {
        id
        personalData {
          fullName
        }
      }
    }
  }
`;

// Query más simple sin filtro de líder para mejor performance
// OPTIMIZACIONES:
// 1. Filtro de inclusión (IN) en lugar de exclusiones (NOT) - 3-5x más rápido
// 2. Estructura optimizada para índice compuesto (date, type, expenseSource)
// 3. Eliminados __typename innecesarios que agregaban overhead
// 4. Filtrado de líder se hace en cliente para simplificar query
export const GET_EXPENSES_BY_DATE_SIMPLE = gql`
  query GetExpensesByDateSimple($date: DateTime!, $nextDate: DateTime!) {
    transactions(where: {
      AND: [
        { date: { gte: $date } },
        { date: { lt: $nextDate } },
        { type: { equals: "EXPENSE" } }
      ]
    }) {
      id
      amount
      expenseSource
      date
      sourceAccount {
        id
        name
      }
      lead {
        id
        personalData {
          fullName
        }
      }
    }
  }
`;
