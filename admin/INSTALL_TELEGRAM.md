# 🚀 Instalación Rápida - Bot de Telegram

## 📦 Instalar Dependencias

```bash
# Navegar al directorio del proyecto
cd admin

# Instalar dependencias necesarias
npm install axios form-data

# O si usas yarn
yarn add axios form-data
```

## 🔧 Configuración Rápida

### 1. Crear archivo .env

```bash
# Copiar el archivo de ejemplo
cp config/env.example .env

# Editar con tu configuración
nano .env
```

### 2. Configurar variables

```bash
# En el archivo .env, cambiar:
TELEGRAM_BOT_TOKEN=TU_TOKEN_REAL_AQUI
TELEGRAM_DEFAULT_CHAT_ID=TU_CHAT_ID_REAL_AQUI
```

### 3. Obtener Token del Bot

1. Buscar `@BotFather` en Telegram
2. Enviar `/newbot`
3. Seguir las instrucciones
4. Copiar el token proporcionado

### 4. Obtener Chat ID

1. Enviar mensaje al bot creado
2. Visitar: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Buscar `"chat":{"id":123456789}`
4. Copiar el número

## ✅ Verificar Instalación

```bash
# Crear archivo de prueba
node -e "
const { createReportSenderService } = require('./services/reportSenderService');
const reportSender = createReportSenderService('TU_TOKEN', 'TU_CHAT_ID');
console.log('✅ Servicio creado correctamente');
"
```

## 🧪 Prueba Rápida

```typescript
// En tu código
import { createReportSenderService } from './services/reportSenderService';

const reportSender = createReportSenderService(
  'TU_BOT_TOKEN',
  'TU_CHAT_ID'
);

// Enviar reporte de prueba
const success = await reportSender.sendTestReport('TU_CHAT_ID');
console.log(success ? '✅ Funciona' : '❌ Error');
```

## 🚨 Solución de Problemas Comunes

### Error: "Cannot find module 'axios'"
```bash
npm install axios
```

### Error: "Cannot find module 'form-data'"
```bash
npm install form-data
```

### Error: "Bot token is invalid"
- Verificar que el token esté correctamente copiado
- Asegurar que no haya espacios extra

### Error: "Chat not found"
- Verificar que el Chat ID sea correcto
- Asegurar que el bot esté agregado al chat

## 📱 Próximos Pasos

1. **Configurar bot** en Telegram
2. **Probar envío** de reporte de prueba
3. **Configurar reportes** automáticos
4. **Personalizar plantillas** de reportes

## 📚 Documentación Completa

Ver: `docs/TELEGRAM_SETUP.md` para instrucciones detalladas.

---

**⚡ ¡Listo!** Tu bot de Telegram debería estar funcionando en menos de 5 minutos.
