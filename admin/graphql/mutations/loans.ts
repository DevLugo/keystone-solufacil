import { gql } from '@apollo/client';

export const CREATE_LOAN = gql`
  mutation CreateLoan($data: LoanCreateInput!) {
    createLoan(data: $data) {
      id
    }
  }
`;

export const UPDATE_PERSONAL_DATA = gql`
  mutation UpdatePersonalData($where: PersonalDataWhereUniqueInput!, $data: PersonalDataUpdateInput!) {
    updatePersonalData(where: $where, data: $data) {
      id
    }
  }
`;
