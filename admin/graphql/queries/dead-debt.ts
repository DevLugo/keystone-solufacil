import { gql } from '@apollo/client';

export const GET_LOANS_FOR_DEAD_DEBT = gql`
  query GetLoansForDeadDebt($weeksSinceLoan: Int!, $weeksWithoutPayment: Int!) {
    loansForDeadDebt(weeksSinceLoan: $weeksSinceLoan, weeksWithoutPayment: $weeksWithoutPayment)
    deadDebtSummary(weeksSinceLoan: $weeksSinceLoan, weeksWithoutPayment: $weeksWithoutPayment)
  }
`;

export const MARK_LOANS_DEAD_DEBT = gql`
  mutation MarkLoansDeadDebt($loanIds: [ID!]!, $deadDebtDate: String!) {
    markLoansDeadDebt(loanIds: $loanIds, deadDebtDate: $deadDebtDate)
  }
`;
