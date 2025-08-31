import { gql } from '@apollo/client';

export const MOVE_LOANS_TO_DATE = gql`
  mutation MoveLoansToDate($leadId: ID!, $fromDate: String!, $toDate: String!) {
    moveLoansToDate(leadId: $leadId, fromDate: $fromDate, toDate: $toDate)
  }
`;

export const MOVE_PAYMENTS_TO_DATE = gql`
  mutation MovePaymentsToDate($leadId: ID!, $fromDate: String!, $toDate: String!) {
    movePaymentsToDate(leadId: $leadId, fromDate: $fromDate, toDate: $toDate)
  }
`;

export const MOVE_EXPENSES_TO_DATE = gql`
  mutation MoveExpensesToDate($leadId: ID, $routeId: ID, $fromDate: String!, $toDate: String!) {
    moveExpensesToDate(leadId: $leadId, routeId: $routeId, fromDate: $fromDate, toDate: $toDate)
  }
`;