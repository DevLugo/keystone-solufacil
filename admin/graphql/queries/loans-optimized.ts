import { gql } from '@apollo/client';

// ULTRA OPTIMIZADA: Solo campos básicos, SIN campos virtuales costosos
export const GET_LOANS_FAST = gql`
  query GetLoansFast($leadId: ID!, $finishedDate: DateTimeNullableFilter) {
    loans(
      where: { 
        lead: { id: { equals: $leadId } }, 
        finishedDate: $finishedDate 
      }
      orderBy: { signDate: desc }
      take: 100
    ) {
      id
      requestedAmount
      amountGived
      signDate
      finishedDate
      createdAt
      borrower {
        id
        personalData {
          fullName
          phones {
            number
          }
        }
      }
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
      }
      loantype {
        id
        name
        rate
        weekDuration
      }
      comissionAmount
    }
  }
`;

// OPTIMIZADA: Para transacciones/créditos con campos mínimos
export const GET_LOANS_FOR_TRANSACTIONS = gql`
  query GetLoansForTransactions($date: DateTime!, $nextDate: DateTime!, $leadId: ID!) {
    loans(
      where: {
        AND: [
          { signDate: { gte: $date } }
          { signDate: { lt: $nextDate } }
          { lead: { id: { equals: $leadId } } }
          { finishedDate: { equals: null } }
        ]
      }
      orderBy: { signDate: desc }
    ) {
      id
      requestedAmount
      amountGived
      signDate
      comissionAmount
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
      }
      loantype {
        id
        name
        rate
        weekDuration
      }
      borrower {
        id
        personalData {
          fullName
          phones {
            number
          }
        }
      }
      previousLoan {
        id
        requestedAmount
        amountGived
        profitAmount
        collaterals {
          id
          fullName
          phones {
            id
            number
          }
        }
        borrower {
          id
          personalData {
            fullName
          }
        }
      }
    }
  }
`;

// OPTIMIZADA: Para préstamos previos con cálculos locales
export const GET_PREVIOUS_LOANS_MINIMAL = gql`
  query GetPreviousLoansMinimal($leadId: ID!) {
    loans(
      where: {
        AND: [
          { lead: { id: { equals: $leadId } } }
          { finishedDate: { equals: null } }
        ]
      }
      orderBy: { signDate: desc }
      take: 50
    ) {
      id
      requestedAmount
      amountGived
      profitAmount
      signDate
      loantype {
        id
        rate
        weekDuration
      }
      borrower {
        id
        personalData {
          fullName
        }
      }
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
      }
    }
  }
`; 