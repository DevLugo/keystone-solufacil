# ⚡ Configuración Rápida para Render

## 🔧 Configuración del Service en Render

```
Name: solufacil-keystone
Runtime: Node
Build Command: npm run build
Start Command: npm start
Auto-Deploy: Yes
```

## 🔑 Variables de Entorno (OBLIGATORIAS)

Configura estas 3 variables en Render:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db_name
SESSION_SECRET=clave-super-secreta-minimo-32-caracteres
NODE_ENV=production
```

## 📋 Checklist Rápido

- [ ] ✅ Repositorio en GitHub conectado a Render
- [ ] ✅ Variables de entorno configuradas en Render
- [ ] ✅ Build Command: `npm run build`
- [ ] ✅ Start Command: `npm start`
- [ ] ✅ Auto-Deploy activado

## 🗃️ Base de Datos Neon (Gratuita)

1. [neon.tech](https://neon.tech) → Sign up
2. Crear nuevo proyecto
3. Copiar **Connection string**
4. Usar como `DATABASE_URL`

## 🔐 Generar SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚀 Deploy

1. Push código a GitHub
2. Render auto-deploya (**sin** ejecutar Cypress)
3. App disponible en: `https://tu-app.onrender.com`
4. Admin panel: `https://tu-app.onrender.com/admin`

## 🧪 Archivos de Testing Ignorados

✅ **Configuración automática**:
- Cypress screenshots/videos no se suben
- Dependencies de testing excluidas en producción  
- Build optimizado (sin tests)

## 🐛 Si algo falla

Ver logs en Render → Tu servicio → Logs tab

## 📖 Guía Completa

Ver `DEPLOY_RENDER.md` para instrucciones detalladas. 