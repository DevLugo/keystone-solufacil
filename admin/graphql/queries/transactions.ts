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
