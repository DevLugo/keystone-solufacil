import { gql } from '@apollo/client';

// Query optimizada con paginación y campos reducidos
export const GET_LOANS = gql`
  query GetLoans($leadId: ID!, $finishedDate: DateTimeNullableFilter, $skip: Int = 0, $take: Int = 50) {
    loans(
      where: { lead: { id: { equals: $leadId } }, finishedDate: $finishedDate }
      orderBy: { signDate: desc }
      skip: $skip
      take: $take
    ) {
      id
      requestedAmount
      amountGived
      signDate
      finishedDate
      createdAt
      updatedAt
      pendingAmountStored
      comissionAmount
      loantype {
        id
        name
        rate
        weekDuration
      }
      borrower {
        id
        personalData {
          id
          fullName
          phones(take: 1) {
            id
            number
          }
          addresses(take: 1) {
            id
            location {
              id
              name
            }
          }
        }
      }
      avalName
      avalPhone
      collaterals(take: 2) {
        id
        fullName
        phones(take: 1) {
          id
          number
        }
        addresses(take: 1) {
          id
          location {
            id
            name
          }
        }
      }
      previousLoan {
        id
        pendingAmountStored
        avalName
        avalPhone
        collaterals(take: 1) {
          id
          fullName
          phones(take: 1) {
            id
            number
          }
        }
        borrower {
          id
          personalData {
            fullName
          }
        }
      }
    }
    loansCount(
      where: { lead: { id: { equals: $leadId } }, finishedDate: $finishedDate }
    )
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

export const SEARCH_POTENTIAL_COLLATERALS = gql`
  query SearchPotentialCollaterals($searchTerm: String!) {
    personalDatas(
      where: {
        fullName: { contains: $searchTerm, mode: insensitive }
      }
      take: 20
    ) {
      id
      fullName
      phones {
        id
        number
      }
      addresses {
        id
        street
        location {
          id
          name
        }
      }
    }
  }
`;
