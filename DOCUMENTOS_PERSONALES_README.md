# Documentos Personales - Nueva Funcionalidad

## Descripción

Se ha creado una nueva página responsiva para gestionar fotos de documentos personales asociados a créditos otorgados. Esta funcionalidad permite:

- **Subir fotos** de documentos importantes (INE, comprobante de domicilio, pagarés)
- **Listar documentos** por fecha de creación del crédito
- **Modificar nombres y teléfonos** de clientes y avales de forma inline
- **Gestionar documentos** asociados a cada PersonalData (cliente y aval)

## Características Principales

### 📸 Gestión de Documentos
- **Tipos de documentos soportados:**
  - INE (Identificación oficial)
  - Comprobante de Domicilio
  - Pagaré
  - Otros documentos

- **Funcionalidades:**
  - Subir fotos directamente a Cloudinary con preview
  - Agregar títulos y descripciones
  - Editar documentos existentes
  - Eliminar documentos
  - Filtrado por tipo de documento
  - Optimización automática de imágenes

### 👤 Edición Inline de Datos Personales
- **Nombres:** Edición directa en la tabla
- **Teléfonos:** Edición directa con validación
- **Creación automática:** Si no existe teléfono, se puede crear uno nuevo
- **Persistencia:** Los cambios se guardan automáticamente en la base de datos

### 📊 Estadísticas en Tiempo Real
- Total de créditos con documentos
- Total de documentos subidos
- Créditos sin documentos (pendientes)

### 🔍 Filtros y Búsqueda
- Búsqueda por nombre o teléfono
- Filtrado por tipo de documento
- Vista expandible por crédito

## Estructura de Datos

### Modelo DocumentPhoto
```typescript
interface DocumentPhoto {
  id: string;
  title: string;
  description?: string;
  photoUrl: string;
  documentType: 'INE' | 'DOMICILIO' | 'PAGARE' | 'OTRO';
  createdAt: string;
  personalData: {
    id: string;
    fullName: string;
  };
  loan: {
    id: string;
    requestedAmount: string;
  };
}
```

### Relaciones
- **DocumentPhoto** ↔ **PersonalData** (muchos a uno)
- **DocumentPhoto** ↔ **Loan** (muchos a uno)
- **DocumentPhoto** ↔ **User** (muchos a uno - quien subió)

## Archivos Creados/Modificados

### Nuevos Archivos
- `admin/pages/documentos-personales.tsx` - Página principal
- `admin/components/documents/InlineEditField.tsx` - Componente de edición inline
- `admin/components/documents/ImageUploader.tsx` - Componente para subir imágenes a Cloudinary
- `admin/graphql/mutations/personalData.ts` - Mutaciones para actualizar datos personales
- `utils/cloudinary.ts` - Configuración y funciones de Cloudinary
- `pages/api/upload-image.ts` - Endpoint para subir imágenes
- `CLOUDINARY_SETUP.md` - Documentación de configuración de Cloudinary

### Archivos Modificados
- `schema.ts` - Agregado modelo DocumentPhoto y relaciones
- `package.json` - Resoluciones para GraphQL y dependencias de Cloudinary
- `env.example` - Variables de entorno para Cloudinary

## Uso

### Acceso a la Página
1. Navegar a la página de documentos personales
2. Seleccionar una fecha para ver los créditos de ese día
3. Los créditos se listan ordenados por fecha de creación

### Subir Documentos
1. Hacer clic en "Ver Detalles" en cualquier crédito
2. En la sección expandida, completar el formulario:
   - Título del documento
   - Seleccionar imagen del documento (se sube automáticamente a Cloudinary)
   - Tipo de documento
   - Descripción (opcional)
3. Hacer clic en "Subir Documento"

### Editar Datos Personales
1. Hacer clic en el ícono de edición (✏️) junto al nombre o teléfono
2. Modificar el valor directamente en el campo
3. Presionar Enter para guardar o Escape para cancelar

### Gestionar Documentos Existentes
- **Editar:** Hacer clic en el ícono de edición del documento
- **Eliminar:** Hacer clic en el ícono de eliminar (🗑️)

## Ventajas de la Implementación

### 🔄 Reutilización de Datos
- Los documentos se asocian a PersonalData, no solo al crédito
- Un mismo cliente puede reutilizar sus documentos en otros créditos
- Información centralizada y consistente

### 📱 Responsive Design
- Interfaz adaptada para móviles y tablets
- Tabla con scroll horizontal en pantallas pequeñas
- Componentes optimizados para touch

### ⚡ Performance
- Carga lazy de documentos
- Actualizaciones optimistas en la UI
- Refetch automático después de cambios

### 🛡️ Validación y Seguridad
- Validación de campos requeridos
- Confirmación antes de eliminar
- Manejo de errores con feedback visual

## Migración de Base de Datos

Se creó la migración `20250825190155_add_document_photo_model` que incluye:

- Tabla `DocumentPhoto` con todos los campos necesarios
- Relaciones con `PersonalData`, `Loan` y `User`
- Índices para optimizar consultas
- Constraints de integridad referencial

## Configuración de Cloudinary

### Variables de Entorno Requeridas
Para que la subida de imágenes funcione correctamente, necesitas configurar las siguientes variables en tu archivo `.env`:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### Pasos de Configuración
1. **Crear cuenta en Cloudinary**: [https://cloudinary.com/](https://cloudinary.com/)
2. **Obtener credenciales** del dashboard de Cloudinary
3. **Configurar variables de entorno** como se muestra arriba
4. **Reiniciar el servidor** después de configurar las variables

Para más detalles sobre la configuración de Cloudinary, consulta el archivo `CLOUDINARY_SETUP.md`.

## Próximas Mejoras Sugeridas

1. ✅ **Upload de archivos:** Integrado con Cloudinary para subir fotos directamente
2. ✅ **Vista previa:** Mostrar miniaturas de las fotos
3. **Búsqueda avanzada:** Filtros por fecha, monto, etc.
4. **Exportación:** Generar reportes de documentos
5. **Notificaciones:** Alertas para créditos sin documentos
6. **Auditoría:** Log de cambios en documentos

## Comandos Útiles

```bash
# Generar nueva migración
npx prisma migrate dev --name nombre_migracion

# Ver estado de la base de datos
npx prisma migrate status

# Resetear base de datos (¡cuidado!)
npx prisma migrate reset

# Generar cliente Prisma
npx prisma generate
```

## Solución de Problemas

### Error de GraphQL Duplicado
Si aparece el error de versiones duplicadas de GraphQL:
1. Eliminar `node_modules` y archivos de lock
2. Reinstalar con `yarn install`
3. Verificar que las resoluciones en `package.json` estén correctas

### Problemas de Migración
Si hay problemas con las migraciones:
1. Verificar que el schema esté sincronizado
2. Ejecutar `npx prisma migrate reset` (¡perderá datos!)
3. Regenerar migraciones desde cero

## Contacto

Para dudas o problemas con esta funcionalidad, revisar:
- Logs del servidor en la consola
- Errores en la consola del navegador
- Estado de la base de datos con Prisma Studio
