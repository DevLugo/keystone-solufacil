import { gql } from '@apollo/client';

export const GET_LOAN_TYPES = gql`
  query GetLoanTypes {
    loantypes(orderBy: { name: asc }) {
      id
      name
      weekDuration
      rate
      createdAt
      updatedAt
    }
  }
`;
