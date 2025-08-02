import { gql } from '@apollo/client';

export const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
      employees {
        personalData {
          addresses {
            location {
              id
              name
            }
          }
        }
      }
    }
  }
`;

export const SEARCH_CLIENTS = gql`
  query SearchClients($searchTerm: String!, $routeId: String, $locationId: String, $limit: Int) {
    searchClients(searchTerm: $searchTerm, routeId: $routeId, locationId: $locationId, limit: $limit)
  }
`;

export const GET_CLIENT_HISTORY = gql`
  query GetClientHistory($clientId: String!, $routeId: String, $locationId: String) {
    getClientHistory(clientId: $clientId, routeId: $routeId, locationId: $locationId)
  }
`; 