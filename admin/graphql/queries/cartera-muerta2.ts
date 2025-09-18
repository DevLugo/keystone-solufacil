import { gql } from '@apollo/client';

export const GET_DEAD_DEBT_LOANS = gql`
  query GetDeadDebtLoans($weeksSinceLoan: Int!, $weeksWithoutPayment: Int!, $routeId: String) {
    loansForDeadDebt2(
      weeksSinceLoan: $weeksSinceLoan
      weeksWithoutPayment: $weeksWithoutPayment
      routeId: $routeId
    )
  }
`;

export const GET_DEAD_DEBT_SUMMARY = gql`
  query GetDeadDebtSummary($weeksSinceLoan: Int!, $weeksWithoutPayment: Int!, $routeId: String) {
    deadDebtSummary2(
      weeksSinceLoan: $weeksSinceLoan
      weeksWithoutPayment: $weeksWithoutPayment
      routeId: $routeId
    )
  }
`;

export const GET_DEAD_DEBT_BY_MONTH = gql`
  query GetDeadDebtByMonth($month: Int!, $year: Int!) {
    deadDebtByMonth2(month: $month, year: $year)
  }
`;

export const GET_ROUTES = gql`
  query GetRoutes {
    routes2
  }
`;