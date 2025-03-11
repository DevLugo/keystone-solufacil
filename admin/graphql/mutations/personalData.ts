import { gql } from '@apollo/client';

export const UPDATE_PERSONAL_DATA = gql`
  mutation UpdatePersonalData($where: PersonalDataWhereUniqueInput!, $data: PersonalDataUpdateInput!) {
    updatePersonalData(where: $where, data: $data) {
      id
      fullName
      phones {
        number
      }
    }
  }
`;

export const CREATE_PERSONAL_DATA = gql`
  mutation CreatePersonalData($data: PersonalDataCreateInput!) {
    createPersonalData(data: $data) {
      id
      fullName
      phones {
        number
      }
    }
  }
`;
