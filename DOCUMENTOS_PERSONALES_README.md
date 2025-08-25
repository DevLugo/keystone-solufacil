# Sistema de Gestión de Documentos Personales

Este sistema permite gestionar documentos personales (INE, comprobantes de domicilio, pagarés) asociados a créditos otorgados, utilizando Cloudinary para el almacenamiento de imágenes.

## ✨ Características Principales

### 📄 Gestión de Documentos
- **Tipos de documentos soportados:**
  - 🆔 INE (Identificación oficial)
  - 🏠 Comprobante de Domicilio
  - 📄 Pagarés

### 👥 Gestión de Datos Personales
- **Información del cliente (borrower)** y **avales (collaterals)**
- **Edición inline** de nombres y teléfonos
- **Reutilización** de datos personales en múltiples créditos
- **Organización** por fecha de creación del crédito

### 🖼️ Almacenamiento en Cloudinary
- **Subida optimizada** con transformaciones automáticas
- **URLs seguras** (HTTPS)
- **Organización** en carpetas por tipo de documento
- **Metadata** completa para auditoría

### 📊 Panel de Control
- **Estadísticas** en tiempo real
- **Visualización** responsiva similar a CreditosTab
- **Filtrado** por fecha y líder de ruta

## 🛠️ Componentes Implementados

### 1. Modelo de Datos (schema.ts)
```typescript
// Modelo DocumentPhoto
export const DocumentPhoto = list({
  access: allowAll,
  fields: {
    filename: text({ validation: { isRequired: true } }),
    originalName: text({ validation: { isRequired: true } }),
    documentType: select({
      options: [
        { label: 'INE', value: 'INE' },
        { label: 'Comprobante de Domicilio', value: 'ADDRESS_PROOF' },
        { label: 'Pagaré', value: 'PROMISSORY_NOTE' },
      ],
    }),
    cloudinaryUrl: text({ validation: { isRequired: true } }),
    cloudinaryPublicId: text({ validation: { isRequired: true } }),
    personalData: relationship({ ref: 'PersonalData.documentPhotos' }),
    loan: relationship({ ref: 'Loan.documentPhotos' }),
    // ... más campos
  }
});
```

### 2. Cliente Cloudinary (/utils/cloudinary.ts)
```typescript
// Funciones principales:
- uploadDocumentPhoto() // Subir documento con metadata
- deleteDocumentPhoto() // Eliminar documento
- getDocumentPhotoThumbnail() // Generar miniaturas
- listDocumentPhotosByPersonalData() // Listar por persona
```

### 3. Mutaciones GraphQL (/graphql/extendGraphqlSchema.ts)
```graphql
# Mutación para subir documentos
mutation UploadDocumentPhoto($input: UploadDocumentPhotoInput!) {
  uploadDocumentPhoto(input: $input) {
    success
    message
    documentPhoto { ... }
  }
}

# Query para obtener documentos por fecha de crédito
query GetDocumentPhotosByCreditDate($date: DateTime!, $leadId: ID) {
  getDocumentPhotosByCreditDate(date: $date, leadId: $leadId) {
    success
    loans { ... }
  }
}
```

### 4. Página Principal (/admin/pages/documentos-personales.tsx)
- **Componente principal:** `DocumentosPersonales`
- **Componente de persona:** `PersonCard` 
- **Componente de documento:** `DocumentItem`
- **Interface responsiva** similar a CreditosTab.tsx

### 5. Mutaciones GraphQL del Cliente (/admin/graphql/mutations/documentPhotos.ts)
```typescript
export const UPLOAD_DOCUMENT_PHOTO = gql`...`;
export const GET_DOCUMENT_PHOTOS_BY_PERSONAL_DATA = gql`...`;
export const GET_DOCUMENT_PHOTOS_BY_LOAN = gql`...`;
export const GET_DOCUMENT_PHOTOS_BY_CREDIT_DATE = gql`...`;
```

## ⚙️ Configuración Requerida

### 1. Variables de Entorno
Agregar al archivo `.env`:
```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key  
CLOUDINARY_API_SECRET=your-api-secret
```

### 2. Instalación de Dependencias
```bash
npm install cloudinary@^2.0.1 multer@^1.4.5-lts.1
npm install --save-dev @types/multer@^1.4.11
```

### 3. Migración de Base de Datos
```bash
npm run generate
```

## 🚀 Uso del Sistema

### 1. Acceso a la Página
- Navegar a `/admin/pages/documentos-personales`
- Seleccionar **fecha** y **líder** como en CreditosTab

### 2. Subir Documentos
- **Expandir** un crédito específico
- **Seleccionar** el tipo de documento (INE, Comprobante, Pagaré)
- **Hacer clic** en el botón correspondiente
- **Seleccionar** archivo de imagen

### 3. Editar Información Personal
- **Hacer clic** en el ícono de edición junto al nombre
- **Modificar** nombre y teléfono
- **Guardar** cambios

### 4. Visualizar Documentos
- **Ver** miniaturas en el listado expandido
- **Hacer clic** en ojo para **abrir** en nueva pestaña
- **Hacer clic** en descarga para **descargar** archivo

## 📋 Estructura de Carpetas Cloudinary

```
personal-documents/
├── ine/
│   └── [personalDataId]_[timestamp]_[filename]
├── address-proof/
│   └── [personalDataId]_[timestamp]_[filename]
└── promissory-notes/
    └── [personalDataId]_[timestamp]_[filename]
```

## 🔧 Integración con el Sistema Existente

### Relaciones de Datos
- **PersonalData** ↔ **DocumentPhoto** (uno a muchos)
- **Loan** ↔ **DocumentPhoto** (uno a muchos, opcional)
- **DocumentPhoto** → **Cloudinary** (almacenamiento externo)

### Compatibilidad
- ✅ Compatible con **CreditosTab.tsx** existente
- ✅ Reutiliza **datos personales** entre créditos
- ✅ **Auditoría completa** de cambios
- ✅ **Diseño responsivo** consistente

## 🎯 Características Especiales

### 📱 Responsive Design
- **Adaptable** a móviles y tablets
- **Grid sistema** para estadísticas
- **Cards colapsables** para organización

### 🔒 Seguridad
- **URLs seguras** (HTTPS) de Cloudinary
- **Validación** de tipos de archivo
- **Metadata** de auditoría completa

### ⚡ Performance
- **Miniaturas** optimizadas automáticamente
- **Carga lazy** de imágenes
- **Transformaciones** automáticas en Cloudinary

### 🎨 UX/UI
- **Iconos intuitivos** por tipo de documento
- **Colores diferenciados** por categoría
- **Feedback visual** durante uploads
- **Estados de carga** claros

## 🚦 Estados de la Aplicación

### Carga Inicial
- ⏳ **LoadingDots** mientras carga datos
- 📊 **Estadísticas** calculadas dinámicamente

### Sin Datos
- 📭 **Mensaje amigable** cuando no hay créditos
- 💡 **Sugerencias** de acción

### Upload de Archivos
- 🔄 **Loading** en botón específico
- ✅ **Confirmación** visual de éxito
- ❌ **Mensajes de error** claros

### Edición de Datos
- 📝 **Formulario inline** expandible
- 💾 **Botones** Guardar/Cancelar
- 🔄 **Actualización** automática tras edición

## 🎯 Próximos Pasos

1. **Navegar** al nuevo sistema desde el menú principal
2. **Configurar** variables de entorno de Cloudinary
3. **Ejecutar** migraciones de base de datos
4. **Probar** funcionalidad de upload
5. **Verificar** que no hay errores de tipo con `yarn dev`

Este sistema está completamente integrado con la estructura existente y sigue los mismos patrones de diseño y arquitectura que CreditosTab.tsx.