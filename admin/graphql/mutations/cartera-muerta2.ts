import { gql } from '@apollo/client';

export const MARK_LOANS_DEAD_DEBT = gql`
  mutation MarkLoansDeadDebt($loanIds: [ID!]!, $badDebtDate: String!) {
    markLoansDeadDebt2(loanIds: $loanIds, badDebtDate: $badDebtDate)
  }
`;

export const REMOVE_DEAD_DEBT_STATUS = gql`
  mutation RemoveDeadDebtStatus($loanIds: [ID!]!) {
    removeDeadDebtStatus2(loanIds: $loanIds)
  }
`;