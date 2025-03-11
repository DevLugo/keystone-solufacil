import { gql } from '@apollo/client';

export const CREATE_LEAD_PAYMENT_RECEIVED = gql`
  mutation CreateCustomLeadPaymentReceived(
    $expectedAmount: Float!, 
    $agentId: ID!, 
    $leadId: ID!, 
    $payments: [PaymentInput!]!, 
    $cashPaidAmount: Float, 
    $bankPaidAmount: Float, 
    $paymentDate: String!
  ) {
    createCustomLeadPaymentReceived(
      expectedAmount: $expectedAmount, 
      agentId: $agentId, 
      leadId: $leadId, 
      payments: $payments, 
      cashPaidAmount: $cashPaidAmount, 
      bankPaidAmount: $bankPaidAmount, 
      paymentDate: $paymentDate
    ) {
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
