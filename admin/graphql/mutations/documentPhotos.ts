import { gql } from '@apollo/client';

export const UPLOAD_DOCUMENT_PHOTO = gql`
  mutation UploadDocumentPhoto($input: UploadDocumentPhotoInput!) {
    uploadDocumentPhoto(input: $input) {
      success
      message
      documentPhoto {
        id
        filename
        originalName
        documentType
        cloudinaryUrl
        cloudinarySecureUrl
        cloudinaryPublicId
        size
        createdAt
        personalData {
          id
          fullName
        }
        loan {
          id
          requestedAmount
        }
      }
    }
  }
`;

export const DELETE_DOCUMENT_PHOTO = gql`
  mutation DeleteDocumentPhoto($id: ID!) {
    deleteDocumentPhoto(where: { id: $id }) {
      id
      cloudinaryPublicId
    }
  }
`;

export const UPDATE_DOCUMENT_PHOTO = gql`
  mutation UpdateDocumentPhoto($where: DocumentPhotoWhereUniqueInput!, $data: DocumentPhotoUpdateInput!) {
    updateDocumentPhoto(where: $where, data: $data) {
      id
      originalName
      documentType
      description
      cloudinaryUrl
      cloudinarySecureUrl
      personalData {
        id
        fullName
      }
      loan {
        id
        requestedAmount
      }
    }
  }
`;

export const GET_DOCUMENT_PHOTOS_BY_PERSONAL_DATA = gql`
  query GetDocumentPhotosByPersonalData($personalDataId: ID!) {
    documentPhotos(
      where: { personalData: { id: { equals: $personalDataId } } }
      orderBy: { createdAt: desc }
    ) {
      id
      filename
      originalName
      documentType
      cloudinaryUrl
      cloudinarySecureUrl
      cloudinaryPublicId
      size
      description
      createdAt
      loan {
        id
        requestedAmount
        signDate
      }
    }
  }
`;

export const GET_DOCUMENT_PHOTOS_BY_LOAN = gql`
  query GetDocumentPhotosByLoan($loanId: ID!) {
    documentPhotos(
      where: { loan: { id: { equals: $loanId } } }
      orderBy: { createdAt: desc }
    ) {
      id
      filename
      originalName
      documentType
      cloudinaryUrl
      cloudinarySecureUrl
      cloudinaryPublicId
      size
      description
      createdAt
      personalData {
        id
        fullName
      }
    }
  }
`;

export const GET_DOCUMENT_PHOTOS_BY_CREDIT_DATE = gql`
  query GetDocumentPhotosByCreditDate($date: DateTime!, $nextDate: DateTime!) {
    loans(
      where: {
        AND: [
          { signDate: { gte: $date } }
          { signDate: { lt: $nextDate } }
          { finishedDate: { equals: null } }
        ]
      }
      orderBy: { signDate: desc }
    ) {
      id
      requestedAmount
      amountGived
      signDate
      borrower {
        id
        personalData {
          id
          fullName
          phones {
            number
          }
          documentPhotos {
            id
            originalName
            documentType
            cloudinaryUrl
            cloudinarySecureUrl
            cloudinaryPublicId
            createdAt
          }
        }
      }
      collaterals {
        id
        fullName
        phones {
          number
        }
        documentPhotos {
          id
          originalName
          documentType
          cloudinaryUrl
          cloudinarySecureUrl
          cloudinaryPublicId
          createdAt
        }
      }
      documentPhotos {
        id
        originalName
        documentType
        cloudinaryUrl
        cloudinarySecureUrl
        cloudinaryPublicId
        createdAt
        personalData {
          id
          fullName
        }
      }
    }
  }
`;