import { gql } from '@apollo/client';

export const GET_LOANS = gql`
  query GetLoans($leadId: ID!) {
    loans(where: { lead: { id: { equals: $leadId } } }) {
      id
      weeklyPaymentAmount
      requestedAmount
      amountGived
      amountToPay
      pendingAmount
      signDate
      finishedDate
      createdAt
      updatedAt
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            number
          }
        }
      }
      avalName
      avalPhone
      previousLoan {
        id
        pendingAmount
        avalName
        avalPhone
        borrower {
          id
          personalData {
            fullName
          }
        }
      }
    }
  }
`;


export const GET_LOAN_TYPES = gql`
  query GetLoanTypes {
    loantypes {
      id
      name
      rate
      weekDuration
    }
  }
`;

export const GET_LEADS = gql`
  query GetLeads($routeId: ID!) {
    employees(where: { routes: { id: { equals: $routeId } } }) {
      id
      type
      personalData {
        fullName
      }
    }
  }
`;
