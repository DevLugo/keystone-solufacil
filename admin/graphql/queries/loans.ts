import { gql } from '@apollo/client';

export const GET_LOANS = gql`
  query GetLoans($leadId: ID! $finishedDate: DateTimeNullableFilter) {
    loans(where: { lead: { id: { equals: $leadId } }, finishedDate: $finishedDate }) {
      id
      weeklyPaymentAmount
      requestedAmount
      amountGived
      amountToPay
      pendingAmount
      signDate
      finishedDate
      createdAt
      updatedAt
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            id
            number
          }
          addresses {
            id
            location {
              id
              name
            }
          }
        }
      }
      avalName
      avalPhone
      collaterals {
        id
        fullName
        phones {
          id
          number
        }
        addresses {
          id
          location {
            id
            name
          }
        }
      }
      previousLoan {
        id
        pendingAmount
        avalName
        avalPhone
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


export const GET_LOAN_TYPES = gql`
  query GetLoanTypes {
    loantypes {
      id
      name
      rate
      weekDuration
      loanPaymentComission
      loanGrantedComission
    }
  }
`;

export const GET_PREVIOUS_LOANS = gql`
  query GetPreviousLoansOptimized($leadId: ID!) {
    loans(
      where: {
        lead: { id: { equals: $leadId } }
      }
      orderBy: { signDate: desc }
      take: 100
    ) {
      id
      requestedAmount
      amountGived
      signDate
      finishedDate
      renewedDate
      status
      pendingAmountStored
      loantype {
        id
        name
        rate
        weekDuration
        loanPaymentComission
      }
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            id
            number
          }
          addresses {
            id
            location {
              id
              name
              municipality {
                id
                name
                state {
                  id
                  name
                }
              }
            }
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
      payments {
        amount
      }
    }
  }
`;

export const GET_ALL_PREVIOUS_LOANS = gql`
  query GetAllPreviousLoans($searchText: String, $take: Int) {
    loans(
      where: {
        borrower: { 
          personalData: { 
            fullName: { 
              contains: $searchText, 
              mode: insensitive 
            } 
          } 
        }
      }
      orderBy: { signDate: desc }
      take: $take
    ) {
      id
      requestedAmount
      amountGived
      signDate
      finishedDate
      renewedDate
      status
      pendingAmountStored
      lead {
        id
        personalData {
          fullName
          addresses {
            id
            location {
              id
              name
              municipality {
                id
                name
                state {
                  id
                  name
                }
              }
            }
          }
        }
      }
      loantype {
        id
        name
        rate
        weekDuration
        loanPaymentComission
      }
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            id
            number
          }
          addresses {
            id
            location {
              id
              name
              municipality {
                id
                name
                state {
                  id
                  name
                }
              }
            }
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
      payments {
        amount
      }
    }
  }
`;

export const GET_LEADS = gql`
  query GetLeads($routeId: ID!) {
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
      }
    }
  }
`;

export const SEARCH_POTENTIAL_COLLATERALS = gql`
  query SearchPotentialCollaterals($searchTerm: String!) {
    personalDatas(
      where: {
        fullName: { contains: $searchTerm, mode: insensitive }
      }
      take: 20
    ) {
      id
      fullName
      phones {
        id
        number
      }
      addresses {
        id
        street
        location {
          id
          name
        }
      }
      # Obtener préstamos donde esta persona es aval (collateral)
      # y de ahí obtener la localidad del líder
      loansAsCollateral(take: 1, orderBy: { signDate: desc }) {
        id
        lead {
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
  }
`;
