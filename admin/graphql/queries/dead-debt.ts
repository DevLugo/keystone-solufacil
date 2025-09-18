import { gql } from '@apollo/client';

export const GET_DEAD_DEBT_LOANS = gql`
  query GetDeadDebtLoans($weeksSinceLoan: Int!, $weeksWithoutPayment: Int!, $routeId: String) {
    loansForDeadDebt(
      weeksSinceLoan: $weeksSinceLoan
      weeksWithoutPayment: $weeksWithoutPayment
      routeId: $routeId
    ) {
      id
      requestedAmount
      amountGived
      signDate
      pendingAmountStored
      badDebtDate
      borrower {
        fullName
        clientCode
      }
      lead {
        fullName
        personalData {
          addresses {
            location {
              name
            }
          }
        }
      }
      loantype {
        name
        weekDuration
      }
      weeksSinceLoan
      weeksWithoutPayment
    }
  }
`;

export const GET_DEAD_DEBT_SUMMARY = gql`
  query GetDeadDebtSummary($weeksSinceLoan: Int!, $weeksWithoutPayment: Int!, $routeId: String) {
    deadDebtSummary(
      weeksSinceLoan: $weeksSinceLoan
      weeksWithoutPayment: $weeksWithoutPayment
      routeId: $routeId
    ) {
      locality
      loanCount
      totalAmount
    }
  }
`;

export const GET_DEAD_DEBT_BY_MONTH = gql`
  query GetDeadDebtByMonth($month: Int!, $year: Int!) {
    deadDebtByMonth(month: $month, year: $year) {
      locality
      loanCount
      totalAmount
      loans {
        id
        requestedAmount
        amountGived
        signDate
        badDebtDate
        borrower {
          fullName
          clientCode
        }
        lead {
          fullName
        }
      }
    }
  }
`;

export const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      name
    }
  }
`;