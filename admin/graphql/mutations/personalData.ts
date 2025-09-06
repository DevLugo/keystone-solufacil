import { gql } from '@apollo/client';

// Mutation para actualizar el nombre de PersonalData
export const UPDATE_PERSONAL_DATA_NAME = gql`
  mutation UpdatePersonalDataName($where: PersonalDataWhereUniqueInput!, $data: PersonalDataUpdateInput!) {
    updatePersonalData(where: $where, data: $data) {
      id
      fullName
      phones {
        id
        number
      }
    }
  }
`;

// Mutation para actualizar el teléfono de PersonalData
export const UPDATE_PERSONAL_DATA_PHONE = gql`
  mutation UpdatePersonalDataPhone($where: PhoneWhereUniqueInput!, $data: PhoneUpdateInput!) {
    updatePhone(where: $where, data: $data) {
      id
      number
      personalData {
        id
        fullName
      }
    }
  }
`;

// Mutation para crear un nuevo teléfono si no existe
export const CREATE_PERSONAL_DATA_PHONE = gql`
  mutation CreatePersonalDataPhone($data: PhoneCreateInput!) {
    createPhone(data: $data) {
      id
      number
      personalData {
        id
        fullName
      }
    }
  }
`;

// Mutation para actualizar el estado de faltante de un documento
export const UPDATE_DOCUMENT_PHOTO_MISSING = gql`
  mutation UpdateDocumentPhotoMissing($id: ID!, $isMissing: Boolean!) {
    updateDocumentPhoto(where: { id: $id }, data: { isMissing: $isMissing }) {
      id
      isMissing
      documentType
      personalData {
        id
        fullName
      }
    }
  }
`;
