// Queries optimizadas para mejorar el rendimiento

import { gql } from '@apollo/client';

// Query optimizada para préstamos - solo campos necesarios
export const GET_LOANS_OPTIMIZED = gql`
  query GetLoansOptimized(
    $date: DateTime!
    $nextDate: DateTime!
    $leadId: ID!
    $skip: Int = 0
    $take: Int = 50
  ) {
    loans(
      where: {
        AND: [
          { signDate: { gte: $date, lt: $nextDate } }
          { lead: { id: { equals: $leadId } } }
          { finishedDate: { equals: null } }
        ]
      }
      orderBy: { signDate: desc }
      skip: $skip
      take: $take
    ) {
      id
      requestedAmount
      amountGived
      signDate
      comissionAmount
      pendingAmountStored
      status
      loantype {
        id
        name
        rate
        weekDuration
      }
      borrower {
        id
        personalData {
          id
          fullName
          phones(take: 1) {
            id
            number
          }
        }
      }
      collaterals(take: 1) {
        id
        fullName
        phones(take: 1) {
          id
          number
        }
      }
      previousLoan {
        id
        requestedAmount
        pendingAmountStored
      }
    }
    loansCount(
      where: {
        AND: [
          { signDate: { gte: $date, lt: $nextDate } }
          { lead: { id: { equals: $leadId } } }
          { finishedDate: { equals: null } }
        ]
      }
    )
  }
`;

// Query optimizada para pagos - con paginación
export const GET_LEAD_PAYMENTS_OPTIMIZED = gql`
  query GetLeadPaymentsOptimized(
    $date: DateTime!
    $nextDate: DateTime!
    $leadId: ID!
    $skip: Int = 0
    $take: Int = 100
  ) {
    loanPayments(
      where: { 
        AND: [
          { receivedAt: { gte: $date, lt: $nextDate } }
          { leadPaymentReceived: { lead: { id: { equals: $leadId } } } }
        ]
      }
      orderBy: { receivedAt: asc }
      skip: $skip
      take: $take
    ) {
      id
      amount
      comission
      type
      paymentMethod
      receivedAt
      loan {
        id
        signDate
        borrower {
          personalData {
            fullName
          }
        }
        loantype {
          id
          name
          loanPaymentComission
        }
      }
      leadPaymentReceived {
        id
        expectedAmount
        paidAmount
        cashPaidAmount
        bankPaidAmount
        falcoAmount
        paymentStatus
      }
    }
    loanPaymentsCount: loanPaymentsConnection(
      where: { 
        AND: [
          { receivedAt: { gte: $date, lt: $nextDate } }
          { leadPaymentReceived: { lead: { id: { equals: $leadId } } } }
        ]
      }
    ) {
      totalCount
    }
  }
`;

// Query para contar préstamos activos sin cargar todos los datos
export const COUNT_ACTIVE_LOANS = gql`
  query CountActiveLoans($leadId: ID!) {
    loansConnection(
      where: {
        AND: [
          { lead: { id: { equals: $leadId } } }
          { finishedDate: { equals: null } }
          { pendingAmountStored: { gt: "0" } }
          { excludedByCleanup: null }
        ]
      }
    ) {
      totalCount
    }
  }
`;

// Query para verificar si hay datos migrados (más eficiente)
export const CHECK_MIGRATED_PAYMENTS = gql`
  query CheckMigratedPayments(
    $date: DateTime!
    $nextDate: DateTime!
    $leadId: ID!
  ) {
    loanPaymentsConnection(
      where: { 
        AND: [
          { receivedAt: { gte: $date, lt: $nextDate } }
          { leadPaymentReceived: null }
          { loan: { lead: { id: { equals: $leadId } } } }
        ]
      }
    ) {
      totalCount
    }
  }
`;

// Query para cargar solo resumen de transacciones
export const GET_TRANSACTIONS_SUMMARY = gql`
  query GetTransactionsSummary(
    $date: DateTime!
    $nextDate: DateTime!
    $routeId: ID
  ) {
    transactionsSummary: transactions(
      where: {
        AND: [
          { date: { gte: $date, lt: $nextDate } }
          { route: { id: { equals: $routeId } } }
        ]
      }
    ) {
      id
      amount
      type
      incomeSource
      expenseSource
    }
  }
`;