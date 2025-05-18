import { gql } from '@apollo/client';

export const GET_ROUTES = gql`
  query Routes($where: RouteWhereInput!) {
    routes(where: $where) {
      id
      name
      accounts {
        id
        name
        type
        amount
      }
      employees {
        id
        type
      }
    }
  }
`;

export const GET_ROUTE = gql`
  query Route($where: RouteWhereInput!) {
    routes(where: $where) {
      id
      name
      accounts {
        id
        name
        type
        amount
        transactions {
          id
          amount
          type
        }
      }
      employees {
        id
        type
        LeadManagedLoans {
          id
          status
          requestedAmount
          weeklyPaymentAmount
          finishedDate
          badDebtDate
          payments {
            id
            amount
            receivedAt
          }
        }
      }
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
      routes {
        accounts {
          id
          type
        }
      }
    }
  }
`;

export const GET_ROUTE_LOANS = gql`
  query RouteLoans($routeId: ID!, $first: Int = 10, $skip: Int = 0) {
    route(where: { id: $routeId }) {
      id
      employees {
        id
        type
        LeadManagedLoans(first: $first, skip: $skip) {
          id
          status
          requestedAmount
          weeklyPaymentAmount
          finishedDate
          badDebtDate
          payments(first: 10) {
            id
            amount
            receivedAt
          }
        }
      }
    }
  }
`;

