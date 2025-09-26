import { gql } from '@apollo/client';

export const CREATE_TRANSACTION = gql`
  mutation CreateTransaction($data: TransactionCreateInput!) {
    createTransaction(data: $data) {
      id
      amount
      type
      expenseSource
      description
      date
      expenseGroupId
      route {
        id
      }
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
      description
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
export const DELETE_TRANSACTION = gql`
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(where: { id: $id }) { id }
  }
`;
