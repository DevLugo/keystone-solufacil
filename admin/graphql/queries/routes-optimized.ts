import { gql } from '@apollo/client';

// Consulta simple solo con datos básicos - OPTIMIZADA para evitar timeout
export const GET_ROUTES_SIMPLE = gql`
  query RoutesSimple($where: RouteWhereInput!) {
    routes(where: $where) {
      id
      name
      accounts {
        id
        name
        type
        amount
      }
    }
  }
`;

// Consulta solo para obtener nombres de rutas - MUY RÁPIDA
export const GET_ROUTES_MINIMAL = gql`
  query RoutesMinimal($where: RouteWhereInput!) {
    routes(where: $where) {
      id
      name
    }
  }
`;

// Usar solo cuando necesites datos completos de UNA ruta específica
export const GET_ROUTE_DETAILED = gql`
  query RouteDetailed($id: ID!) {
    route(where: { id: $id }) {
      id
      name
      accounts {
        id
        name
        type
        amount
        transactions(take: 10, orderBy: { date: desc }) {
          id
          amount
          type
          date
        }
      }
      employees(take: 50) {
        id
        type
        personalData {
          fullName
        }
      }
    }
  }
`;

// OPTIMIZADA: Préstamos previos SIN campos virtuales costosos
export const GET_PREVIOUS_LOANS_OPTIMIZED = gql`
  query GetPreviousLoansOptimized($leadId: ID!) {
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
      signDate
      borrower {
        id
        personalData {
          fullName
        }
      }
      avalName
      avalPhone
      loantype {
        id
        rate
      }
    }
  }
`;

// Para obtener líderes de forma optimizada
export const GET_LEADS_SIMPLE = gql`
  query LeadsSimple($routeId: ID!) {
    employees(where: { 
      AND: [
        { routes: { id: { equals: $routeId } } },
        { type: { equals: "LEAD" } }
      ]
    }) {
      id
      type
      personalData {
        fullName
        addresses {
          location {
            name
            municipality {
              state {
                name
              }
            }
          }
        }
      }
    }
  }
`; 