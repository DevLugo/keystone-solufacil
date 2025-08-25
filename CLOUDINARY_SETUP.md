# Configuración de Cloudinary para Subida de Imágenes

## Requisitos Previos

1. Crear una cuenta en [Cloudinary](https://cloudinary.com/)
2. Obtener las credenciales de tu cuenta:
   - Cloud Name
   - API Key
   - API Secret

## Configuración

### 1. Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### 2. Instalación de Dependencias

Las dependencias necesarias ya están instaladas:
- `cloudinary` - Para interactuar con la API de Cloudinary
- `multer` - Para manejar la subida de archivos
- `@types/multer` - Tipos de TypeScript para multer

### 3. Funcionalidades Implementadas

#### Subida de Imágenes
- **Endpoint**: `/api/upload-image`
- **Método**: POST
- **Formato**: multipart/form-data
- **Campos**:
  - `file`: Archivo de imagen (requerido)
  - `folder`: Carpeta en Cloudinary (opcional, por defecto: 'documentos-personales')

#### Límites de Archivo
- **Tamaño máximo**: 10MB
- **Formatos permitidos**: jpg, jpeg, png, gif, webp
- **Optimización automática**: Calidad y formato optimizados automáticamente

#### Transformaciones de Imagen
- **Calidad**: auto:good
- **Formato**: auto (selección automática del mejor formato)
- **Carpeta**: Organización automática en Cloudinary

### 4. Uso en el Frontend

El componente `ImageUploader` maneja automáticamente:
- Validación de archivos
- Preview de imágenes
- Subida a Cloudinary
- Manejo de errores
- Estados de carga

### 5. Estructura de Datos

Los documentos se almacenan con:
- **URL segura**: Para mostrar las imágenes
- **Public ID**: Para referencias y eliminación
- **Metadatos**: Formato, dimensiones, tamaño

### 6. Seguridad

- Validación de tipos de archivo en el frontend y backend
- Límites de tamaño de archivo
- Configuración segura de Cloudinary
- Manejo de errores robusto

### 7. Ejemplo de Uso

```typescript
// En un componente React
const handleImageUpload = (imageUrl: string, publicId: string) => {
  console.log('Imagen subida:', imageUrl);
  console.log('Public ID:', publicId);
};

<ImageUploader
  onImageUpload={handleImageUpload}
  placeholder="Subir imagen del documento"
/>
```

### 8. Troubleshooting

#### Error: "Configuración de Cloudinary no encontrada"
- Verifica que las variables de entorno estén configuradas correctamente
- Reinicia el servidor después de cambiar las variables de entorno

#### Error: "Solo se permiten archivos de imagen"
- Asegúrate de que el archivo sea una imagen válida
- Verifica que la extensión del archivo sea correcta

#### Error: "El archivo es demasiado grande"
- Reduce el tamaño de la imagen antes de subirla
- El límite es de 10MB

### 9. Optimización

- Las imágenes se optimizan automáticamente en Cloudinary
- Se usa el formato más eficiente según el navegador
- Las imágenes se sirven desde CDN global de Cloudinary

### 10. Monitoreo

- Revisa el dashboard de Cloudinary para monitorear el uso
- Las imágenes se organizan en carpetas por funcionalidad
- Puedes configurar alertas de uso en Cloudinary
