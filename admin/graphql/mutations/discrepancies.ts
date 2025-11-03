import { gql } from '@apollo/client';

export const CREATE_DISCREPANCY = gql`
  mutation CreateDiscrepancy(
    $discrepancyType: String!
    $routeId: ID!
    $leadId: ID
    $date: String!
    $expectedAmount: Float!
    $actualAmount: Float!
    $description: String!
    $category: String
    $screenshotBase64: String
  ) {
    createDiscrepancy(
      discrepancyType: $discrepancyType
      routeId: $routeId
      leadId: $leadId
      date: $date
      expectedAmount: $expectedAmount
      actualAmount: $actualAmount
      description: $description
      category: $category
      screenshotBase64: $screenshotBase64
    ) {
      success
      discrepancy {
        id
        discrepancyType
        date
        expectedAmount
        actualAmount
        difference
        description
        category
        status
        screenshotUrls
        telegramReported
        reportedAt
        route {
          id
          name
        }
        lead {
          id
          personalData {
            fullName
          }
        }
        createdAt
        updatedAt
      }
      message
      errors
    }
  }
`;

export const UPDATE_DISCREPANCY_STATUS = gql`
  mutation UpdateDiscrepancyStatus(
    $id: ID!
    $status: String!
    $notes: String
  ) {
    updateDiscrepancyStatus(
      id: $id
      status: $status
      notes: $notes
    ) {
      success
      discrepancy {
        id
        status
        notes
        updatedAt
      }
      message
    }
  }
`;

export const DELETE_DISCREPANCY = gql`
  mutation DeleteDiscrepancy($id: ID!) {
    deleteDiscrepancy(id: $id) {
      success
      message
    }
  }
`;

export const RESEND_DISCREPANCY_REPORT = gql`
  mutation ResendDiscrepancyReport($id: ID!, $chatIds: [String!]!) {
    resendDiscrepancyReport(id: $id, chatIds: $chatIds) {
      success
      message
    }
  }
`;

