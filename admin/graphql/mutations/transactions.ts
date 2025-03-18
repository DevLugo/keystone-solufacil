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
