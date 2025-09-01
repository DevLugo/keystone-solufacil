import { gql } from '@apollo/client';

export const GET_USER_ROUTES = gql`
  query GetUserRoutes {
    getUserRoutes
  }
`;

export const GET_USER_ACCESSIBLE_ROUTES = gql`
  query GetUserAccessibleRoutes {
    getUserAccessibleRoutes
  }
`;

export const GET_DASHBOARD_KPIS = gql`
  query GetDashboardKPIs($routeId: String!, $timeframe: String, $year: Int, $month: Int) {
    getDashboardKPIs(routeId: $routeId, timeframe: $timeframe, year: $year, month: $month)
  }
`;

export const GET_ROUTE_STATS = gql`
  query GetRouteStats($routeId: String!) {
    getRouteStats(routeId: $routeId)
  }
`;