import { gql } from '@apollo/client';

export const GET_ACCOUNTS = gql`
  query GetAccounts {
    accounts {
      id
      name
      type
      amount
      updatedAt
      route {
        employees {
          id
          personalData {
            fullName
          }
        }
      }
    }
  }
`;
