import { gql } from '@apollo/client';

export const GET_LEAD_PAYMENTS = gql`
  query GetLeadPayments($date: DateTime!, $nextDate: DateTime!, $leadId: ID!) {
    loanPayments(where: { 
      AND: [
        { receivedAt: { gte: $date, lt: $nextDate } },
        { leadPaymentReceived: { lead: { id: { equals: $leadId } } } }
      ]
    }) {
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
            id
            fullName
            clientCode
          }
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
        createdAt
        agent {
          personalData {
            fullName
          }
        }
        lead {
          id
          personalData {
            fullName
          }
        }
        falcoCompensatoryPayments {
          id
          amount
          createdAt
        }
      }
    }
  }
`;
