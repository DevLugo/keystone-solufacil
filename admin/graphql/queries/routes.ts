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
      employees(where: { type: { equals: "LEAD" } }) {
        id
        type
      }
    }
  }
`;

export const GET_ALL_ROUTES_SIMPLE = gql`
  query RoutesAll {
    routes(where: {}) {
      id
      name
    }
  }
`;

export const GET_ROUTE = gql`
  query Route($where: RouteWhereUniqueInput!) {
    route(where: $where) {
      id
      name
      accounts {
        id
        name
        type
        amount
        transactions(take: 10, orderBy: { date: desc }) {
          id
          amount
          type
        }
      }
      employees(where: { type: { equals: "LEAD" } }) {
        id
        type
        LeadManagedLoans(take: 20, orderBy: { signDate: desc }) {
          id
          status
          requestedAmount
          amountGived
          finishedDate
          badDebtDate
          loantype {
            id
            rate
            weekDuration
          }
          payments(take: 5, orderBy: { receivedAt: desc }) {
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
      employees(where: { type: { equals: "LEAD" } }) {
        id
        type
        LeadManagedLoans(first: $first, skip: $skip, orderBy: { signDate: desc }) {
          id
          status
          requestedAmount
          amountGived
          finishedDate
          badDebtDate
          loantype {
            id
            rate
            weekDuration
          }
          payments(first: 10, orderBy: { receivedAt: desc }) {
            id
            amount
            receivedAt
          }
        }
      }
    }
  }
`;

