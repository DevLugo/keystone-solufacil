import { gql } from '@apollo/client';

export const CREATE_LEAD_PAYMENT_RECEIVED = gql`
  mutation CreateCustomLeadPaymentReceived($expectedAmount: Float!, $agentId: ID!, $leadId: ID!, $payments: [PaymentInput!]!, $cashPaidAmount: Float, $bankPaidAmount: Float, $paymentDate: String!) {
    createCustomLeadPaymentReceived(expectedAmount: $expectedAmount, agentId: $agentId, leadId: $leadId, payments: $payments, cashPaidAmount: $cashPaidAmount, bankPaidAmount: $bankPaidAmount, paymentDate: $paymentDate) {
      id
      expectedAmount
      paidAmount
      cashPaidAmount
      bankPaidAmount
      falcoAmount
      agentId
      leadId
      paymentDate
      payments {
        amount
        comission
        loanId
        type
        paymentMethod
      }
    }
  }
`;

export const UPDATE_LEAD_PAYMENT = gql`
  mutation UpdateLeadPayment(
    $id: ID!
    $expectedAmount: Float!
    $cashPaidAmount: Float
    $bankPaidAmount: Float
    $falcoAmount: Float
    $paymentDate: String!
    $payments: [PaymentInput!]!
  ) {
    updateCustomLeadPaymentReceived(
      id: $id
      expectedAmount: $expectedAmount
      cashPaidAmount: $cashPaidAmount
      bankPaidAmount: $bankPaidAmount
      falcoAmount: $falcoAmount
      paymentDate: $paymentDate
      payments: $payments
    ) {
      id
      expectedAmount
      paidAmount
      cashPaidAmount
      bankPaidAmount
      falcoAmount
      paymentStatus
      payments {
        id
        amount
        comission
        loanId
        type
        paymentMethod
      }
    }
  }
`;