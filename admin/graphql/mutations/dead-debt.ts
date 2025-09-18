import { gql } from '@apollo/client';

export const MARK_LOANS_DEAD_DEBT = gql`
  mutation MarkLoansDeadDebt($loanIds: [ID!]!, $badDebtDate: String!) {
    markLoansDeadDebt(loanIds: $loanIds, badDebtDate: $badDebtDate) {
      success
      message
      updatedCount
      errors {
        loanId
        message
      }
    }
  }
`;

export const REMOVE_DEAD_DEBT_STATUS = gql`
  mutation RemoveDeadDebtStatus($loanIds: [ID!]!) {
    removeDeadDebtStatus(loanIds: $loanIds) {
      success
      message
      updatedCount
      errors {
        loanId
        message
      }
    }
  }
`;

