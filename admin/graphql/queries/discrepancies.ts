import { gql } from '@apollo/client';

export const GET_DISCREPANCIES = gql`
  query GetDiscrepancies(
    $routeId: ID
    $startDate: String
    $endDate: String
    $status: String
    $discrepancyType: String
  ) {
    getDiscrepancies(
      routeId: $routeId
      startDate: $startDate
      endDate: $endDate
      status: $status
      discrepancyType: $discrepancyType
    ) {
      id
      discrepancyType
      date
      weekStartDate
      expectedAmount
      actualAmount
      difference
      description
      category
      status
      notes
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
      createdBy {
        id
        name
      }
      updatedBy {
        id
        name
      }
    }
  }
`;

export const GET_DISCREPANCY = gql`
  query GetDiscrepancy($id: ID!) {
    getDiscrepancy(id: $id) {
      id
      discrepancyType
      date
      weekStartDate
      expectedAmount
      actualAmount
      difference
      description
      category
      status
      notes
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
      createdBy {
        id
        name
        email
      }
      updatedBy {
        id
        name
        email
      }
    }
  }
`;

export const GET_DISCREPANCY_STATS = gql`
  query GetDiscrepancyStats($routeId: ID, $weekStartDate: String) {
    getDiscrepancyStats(routeId: $routeId, weekStartDate: $weekStartDate) {
      totalDiscrepancies
      pendingCount
      completedCount
      discardedCount
      totalDifference
      byType {
        type
        count
        totalDifference
      }
      byRoute {
        routeId
        routeName
        count
        totalDifference
      }
      byWeek {
        weekStart
        count
        totalDifference
      }
    }
  }
`;

export const GET_DISCREPANCIES_BY_WEEK = gql`
  query GetDiscrepanciesByWeek($weekStartDate: String!, $routeId: ID) {
    getDiscrepanciesByWeek(weekStartDate: $weekStartDate, routeId: $routeId) {
      weekStart
      weekEnd
      discrepancies {
        id
        discrepancyType
        date
        expectedAmount
        actualAmount
        difference
        description
        status
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
      }
      summary {
        totalCount
        totalDifference
        pendingCount
        completedCount
        discardedCount
      }
    }
  }
`;

