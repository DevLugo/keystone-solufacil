import { gql } from '@apollo/client';

export const CREATE_TRANSACTION = gql`
  mutation CreateTransaction($data: TransactionCreateInput!) {
    createTransaction(data: $data) {
      id
      amount
      type
      expenseSource
      date
      sourceAccount {
        id
        amount
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

export const UPDATE_TRANSACTION = gql`
  mutation UpdateTransaction($id: ID!, $data: TransactionUpdateInput!) {
    updateTransaction(where: { id: $id }, data: $data) {
      id
      amount
      type
      expenseSource
      date
      sourceAccount {
        id
        amount
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
