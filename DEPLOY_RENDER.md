# 🚀 Guía de Deployment en Render

Este proyecto está configurado para deployarse automáticamente en Render con solo configurar las variables de entorno.

## 📋 Requisitos Previos

1. ✅ Cuenta en [Render.com](https://render.com)
2. ✅ Repositorio en GitHub/GitLab conectado
3. ✅ Base de datos PostgreSQL (Neon, Supabase, etc.)

## 🔧 Configuración en Render

### 1. **Crear Web Service**
- Ve a tu dashboard de Render
- Click **"New +"** → **"Web Service"**
- Conecta tu repositorio de GitHub
- Selecciona la rama (generalmente `main` o `master`)

### 2. **Configuración del Service**
```
Name: solufacil-keystone
Runtime: Node
Region: Oregon (US West) o el más cercano
Branch: main
Build Command: npm run build
Start Command: npm start
Auto-Deploy: Yes
```

⚠️ **IMPORTANTE**: 
- El comando de build está optimizado para **NO** ejecutar tests de Cypress ni instalar dependencias de desarrollo en producción
- El comando `start` ejecuta automáticamente las migraciones de base de datos antes de iniciar la aplicación

### 3. **Variables de Entorno Requeridas**

⚠️ **IMPORTANTE**: Configura estas variables en Render antes del primer deploy:

#### **Variables Obligatorias:**
```bash
# Base de datos (obtener de Neon)
DATABASE_URL=postgresql://usuario:password@host:5432/database

# Clave de sesión (generar cadena aleatoria de 32+ caracteres)
SESSION_SECRET=tu-clave-super-secreta-minimo-32-caracteres

# Entorno
NODE_ENV=production
```

#### **Variables Opcionales:**
```bash
# Puerto (Render lo asigna automáticamente)
PORT=3000

# Para shadow database (si Neon lo requiere)
SHADOW_DATABASE_URL=postgresql://usuario:password@host:5432/shadow_db
```

### 4. **Configuración Avanzada**
```
Auto-Deploy: Yes
Health Check Path: /admin
```

## 🗃️ Configuración de Base de Datos (Neon)

### 1. **Crear cuenta gratuita en Neon**
- Ve a [neon.tech](https://neon.tech)
- Sign up gratuito
- Crear nuevo proyecto

### 2. **Obtener CONNECTION STRING**
- Ve a **Dashboard** → Tu proyecto
- Click **"Connect"**
- Copia la **Connection string**
- Úsala como `DATABASE_URL` en Render

### 3. **Ejemplo de DATABASE_URL**
```
postgresql://alex:AbC123dEf@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

## 🔑 Generar SESSION_SECRET

Puedes generar una clave segura con:

```bash
# Opción 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opción 2: OpenSSL
openssl rand -hex 32

# Opción 3: Manualmente
# Cualquier cadena de 32+ caracteres aleatorios
```

## 🚀 Proceso de Deploy

### **Deploy Automático:**
1. Push tu código a la rama principal
2. Render detecta automáticamente los cambios
3. Ejecuta `npm run build` (construye la aplicación)
4. Ejecuta `npm start` (aplica migraciones automáticamente y inicia la aplicación)

### **Deploy Manual:**
1. Ve a tu servicio en Render
2. Click **"Manual Deploy"**
3. Selecciona la rama
4. Click **"Deploy"**

### **⚠️ Archivos ignorados en Deploy:**
Los siguientes archivos/carpetas se ignoran automáticamente y **NO** se suben a Render:
- `cypress/screenshots/` - Screenshots de tests
- `cypress/videos/` - Videos de tests  
- `cypress/downloads/` - Descargas temporales
- `.env` - Variables de entorno locales
- `node_modules/` - Se reinstalan automáticamente
- Todas las dependencias de testing (Cypress, Jest, etc.)

## 📊 Monitoreo y Logs

### **Ver Logs en Tiempo Real:**
- Ve a tu servicio en Render
- Tab **"Logs"**
- Verás logs de build y runtime

### **Verificar Deploy:**
- Espera mensaje: `✅ Environment variables validated successfully`
- Luego: `📋 Ejecutando: keystone prisma migrate deploy` (aplicando migraciones)
- Después: `✅ Comando completado exitosamente: keystone` (migraciones aplicadas)
- Finalmente: `🚀 Starting Keystone in production mode` y `KeystoneJS ready on https://tu-app.onrender.com`

## 🐛 Troubleshooting

### **Error de variables de entorno:**
```
❌ Error: Missing required environment variables:
   - DATABASE_URL
   - SESSION_SECRET
```
**Solución:** Configura las variables faltantes en Render

### **Error de conexión a DB:**
```
❌ Error: DATABASE_URL must be a valid PostgreSQL connection string
```
**Solución:** Verifica que la URL empiece con `postgresql://` o `postgres://`

### **Error de build:**
```
npm ERR! Failed at the keystone-app@1.0.3 build script
```
**Solución:** Revisa los logs detallados en Render, probablemente faltan variables de entorno

### **App no responde:**
1. Verifica que el **Health Check Path** esté en `/admin`
2. Revisa los logs para errores de runtime
3. Verifica que la DB esté accesible

## 🔄 Updates y Maintenance

### **Actualizar la aplicación:**
1. Push cambios a tu repo
2. Render auto-deploya automáticamente
3. Las migraciones de DB se ejecutan automáticamente

### **Rollback:**
1. Ve a **"Deploys"** tab en Render
2. Click **"Rollback"** en un deploy anterior
3. La app volverá a esa versión

## 📱 URLs Importantes

Una vez deployado, tendrás acceso a:

- **App Principal**: `https://tu-app.onrender.com`
- **Admin Panel**: `https://tu-app.onrender.com/admin`
- **GraphQL Playground**: `https://tu-app.onrender.com/api/graphql`
- **PDF Generator**: `https://tu-app.onrender.com/generate-pdf`

## 💰 Costos

- **Render Web Service**: GRATIS (con limitaciones de sleep)
- **Base de datos Neon**: GRATIS (hasta 0.5GB)
- **Total**: $0/mes para empezar

## 🎉 ¡Listo!

Tu aplicación KeystoneJS estará disponible en:
`https://tu-app-name.onrender.com`

El admin panel estará en:
`https://tu-app-name.onrender.com/admin` 