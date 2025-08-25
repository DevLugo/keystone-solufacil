import { gql } from '@apollo/client';

export const CREATE_LOAN = gql`
  mutation CreateLoan($data: LoanCreateInput!) {
    createLoan(data: $data) {
      id
    }
  }
`;

export const CREATE_LOANS_BULK = gql`
  mutation CreateMultipleLoans($loans: [MultipleLoanInput!]!) {
    createMultipleLoans(loans: $loans)
  }
`;

export const UPDATE_PERSONAL_DATA = gql`
  mutation UpdatePersonalData($where: PersonalDataWhereUniqueInput!, $data: PersonalDataUpdateInput!) {
    updatePersonalData(where: $where, data: $data) {
      id
    }
  }
`;

export const UPDATE_LOAN_COLLATERALS = gql`
  mutation UpdateLoanCollaterals($loanId: ID!, $collateralIds: [ID!]!) {
    updateLoan(
      where: { id: $loanId }
      data: { 
        collaterals: { 
          set: $collateralIds 
        } 
      }
    ) {
      id
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

export const UPDATE_PHONE = gql`
  mutation UpdatePhone($phoneId: ID!, $number: String!) {
    updatePhone(
      where: { id: $phoneId }
      data: { number: $number }
    ) {
      id
      number
    }
  }
`;

export const CREATE_PHONE = gql`
  mutation CreatePhone($personalDataId: ID!, $number: String!) {
    createPhone(
      data: { 
        number: $number
        personalData: { connect: { id: $personalDataId } }
      }
    ) {
      id
      number
    }
  }
`;

export const CREATE_PERSONAL_DATA = gql`
  mutation CreatePersonalData($data: PersonalDataCreateInput!) {
    createPersonalData(data: $data) {
      id
      fullName
      phones {
        id
        number
      }
    }
  }
`;

// ✅ NUEVA MUTACIÓN: Actualizar préstamo con manejo de avales
export const UPDATE_LOAN_WITH_AVAL = gql`
  mutation UpdateLoanWithAval($where: ID!, $data: UpdateLoanWithAvalInput!) {
    updateLoanWithAval(where: $where, data: $data)
  }
`;
