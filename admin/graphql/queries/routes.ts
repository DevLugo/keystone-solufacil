import { gql } from '@apollo/client';

export const GET_ROUTES = gql`
  query Routes($where: RouteWhereInput!) {
    routes(where: $where) {
      id
      name
      account {
        id
        type
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
        account {
          id
          type
        }
      }
    }
  }
`;
