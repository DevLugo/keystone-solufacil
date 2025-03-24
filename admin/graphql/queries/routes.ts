import { gql } from '@apollo/client';

export const GET_ROUTES = gql`
  query Routes($where: RouteWhereInput!) {
    routes(where: $where) {
      id
      name
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
        __typename
      }
      __typename
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

