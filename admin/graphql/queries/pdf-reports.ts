import { gql } from '@apollo/client';

// Consulta para obtener todas las rutas con localidades a través de líderes
export const GET_ROUTES_FOR_PDF = gql`
  query RoutesForPDF {
    routes {
      id
      name
      employees(where: { type: { equals: "ROUTE_LEAD" } }) {
        id
        personalData {
          id
          fullName
          addresses {
            id
            location {
              id
              name
            }
          }
        }
      }
    }
  }
`;

// Consulta para obtener localidades de una ruta específica a través de los líderes
export const GET_ROUTE_LOCALITIES = gql`
  query RouteLocalities($routeId: ID!) {
    route(where: { id: $routeId }) {
      id
      name
      employees(where: { type: { equals: "ROUTE_LEAD" } }) {
        id
        personalData {
          id
          fullName
          addresses {
            id
            location {
              id
              name
            }
          }
        }
      }
    }
  }
`;

// Consulta para obtener préstamos activos por localidad para el PDF
export const GET_LOANS_BY_LOCALITY = gql`
  query LoansByLocality($localityId: ID!) {
    loans(
      where: {
        AND: [
          { finishedDate: { equals: null } }
          { 
            borrower: {
              personalData: {
                addresses: {
                  some: {
                    location: {
                      id: { equals: $localityId }
                    }
                  }
                }
              }
            }
          }
        ]
      }
      orderBy: { signDate: asc }
    ) {
      id
      requestedAmount
      amountGived
      signDate
      weeklyPaymentAmount
      amountToPay
      pendingAmount
      borrower {
        id
        personalData {
          fullName
          phones {
            number
          }
        }
      }
      avalName
      avalPhone
      loantype {
        id
        name
        rate
        weekDuration
      }
      lead {
        id
        personalData {
          fullName
        }
      }
      payments(orderBy: { receivedAt: desc }, take: 1) {
        id
        amount
        receivedAt
      }
    }
  }
`;

// Consulta para obtener información del líder de la ruta para el PDF
export const GET_ROUTE_LEAD_INFO = gql`
  query RouteLeadInfo($routeId: ID!) {
    route(where: { id: $routeId }) {
      id
      name
      employees(where: { type: { equals: "ROUTE_LEAD" } }) {
        id
        personalData {
          fullName
        }
      }
    }
  }
`;

// Consulta optimizada para obtener datos completos para el PDF de una localidad
export const GET_PDF_DATA_BY_LOCALITY = gql`
  query PDFDataByLocality($localityId: ID!, $routeId: ID!) {
    location(where: { id: $localityId }) {
      id
      name
      route {
        id
        name
        employees(where: { type: { equals: "ROUTE_LEAD" } }) {
          id
          personalData {
            fullName
          }
        }
      }
    }
    loans(
      where: {
        AND: [
          { finishedDate: { equals: null } }
          { 
            borrower: {
              personalData: {
                addresses: {
                  some: {
                    location: {
                      id: { equals: $localityId }
                    }
                  }
                }
              }
            }
          }
        ]
      }
      orderBy: { signDate: asc }
    ) {
      id
      requestedAmount
      amountGived
      signDate
      weeklyPaymentAmount
      amountToPay
      pendingAmount
      borrower {
        id
        personalData {
          fullName
          phones {
            number
          }
        }
      }
      avalName
      avalPhone
      loantype {
        id
        name
        rate
        weekDuration
      }
      payments(orderBy: { receivedAt: desc }, take: 1) {
        id
        amount
        receivedAt
      }
    }
  }
`;