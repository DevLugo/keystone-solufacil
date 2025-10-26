import { gql } from '@apollo/client';

export const CREATE_DOCUMENT_PHOTO = gql`
  mutation CreateDocumentPhoto($data: DocumentPhotoCreateInput!) {
    createDocumentPhoto(data: $data) {
      id
      title
      description
      photoUrl
      publicId
      documentType
      isError
      errorDescription
      isMissing
      personalData {
        id
        fullName
      }
      loan {
        id
        signDate
        borrower {
          id
          personalData {
            id
            fullName
          }
        }
        lead {
          id
          personalData {
            id
            fullName
          }
          routes {
            id
            name
          }
        }
      }
    }
  }
`;

export const UPDATE_DOCUMENT_PHOTO = gql`
  mutation UpdateDocumentPhoto($id: ID!, $data: DocumentPhotoUpdateInput!) {
    updateDocumentPhoto(where: { id: $id }, data: $data) {
      id
      title
      description
      photoUrl
      publicId
      documentType
      isError
      errorDescription
      isMissing
      personalData {
        id
        fullName
      }
      loan {
        id
        signDate
        borrower {
          id
          personalData {
            id
            fullName
          }
        }
        lead {
          id
          personalData {
            id
            fullName
          }
          routes {
            id
            name
          }
        }
      }
    }
  }
`;
