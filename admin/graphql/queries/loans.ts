import { gql } from '@apollo/client';

export const GET_LOANS = gql`
  query GetLoans($leadId: ID! $finishedDate: DateTimeNullableFilter) {
    loans(where: { lead: { id: { equals: $leadId } }, finishedDate: $finishedDate }) {
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
            id
            number
          }
          addresses {
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
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
        addresses {
          id
          location {
            id
            name
          }
        }
      }
      previousLoan {
        id
        pendingAmount
        avalName
        avalPhone
        collaterals {
          id
          fullName
          phones {
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
    employees(where: { 
      AND: [
        { routes: { id: { equals: $routeId } } },
        { type: { equals: "LEAD" } }
      ]
    }) {
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
