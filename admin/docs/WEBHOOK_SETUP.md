# 🔗 Configuración del Webhook de Telegram

## 📋 ¿Qué es un Webhook?

Un webhook permite que Telegram envíe automáticamente los mensajes de los usuarios a tu aplicación, en lugar de que tengas que consultar constantemente la API.

## 🚀 Configuración del Webhook

### 1. Configurar la URL del Webhook

```bash
# Reemplaza con tu token y dominio real
curl -X POST "https://api.telegram.org/bot<TU_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tu-dominio.com/api/telegram-webhook",
    "allowed_updates": ["message", "edited_message"],
    "drop_pending_updates": true
  }'
```

### 2. Verificar el Webhook

```bash
curl "https://api.telegram.org/bot<TU_TOKEN>/getWebhookInfo"
```

### 3. Eliminar el Webhook (si es necesario)

```bash
curl "https://api.telegram.org/bot<TU_TOKEN>/deleteWebhook"
```

## 🔧 Configuración en tu Aplicación

### 1. Variables de Entorno

```bash
# En tu archivo .env
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_DEFAULT_CHAT_ID=tu_chat_id_aqui
```

### 2. URL del Webhook

La URL debe ser accesible públicamente:
```
https://tu-dominio.com/api/telegram-webhook
```

## ✅ Pruebas del Webhook

### 1. Enviar mensaje al bot
```
/start
```

### 2. Verificar logs
Revisa la consola de tu aplicación para ver los mensajes recibidos.

### 3. Verificar respuesta
El bot debe responder automáticamente al mensaje.

## 🚨 Solución de Problemas

### Error: "Webhook URL is not accessible"
- ✅ Verificar que la URL sea pública
- ✅ Verificar que el servidor esté funcionando
- ✅ Verificar firewall/proxy

### Error: "Invalid webhook URL"
- ✅ Usar HTTPS (obligatorio para webhooks)
- ✅ Verificar formato de la URL
- ✅ Verificar que el dominio sea válido

### No se reciben mensajes
- ✅ Verificar que el webhook esté configurado
- ✅ Verificar logs de la aplicación
- ✅ Verificar permisos del bot

## 📱 Comandos Disponibles

- `/start` - Registra al usuario
- `/status` - Muestra estado del usuario
- `/help` - Muestra ayuda
- `/unregister` - Da de baja al usuario

## 🔄 Flujo de Trabajo

1. **Usuario envía `/start`** al bot
2. **Telegram envía** el mensaje a tu webhook
3. **Tu aplicación procesa** el mensaje
4. **Se registra** al usuario automáticamente
5. **Se notifica** al administrador
6. **El usuario recibe** confirmación

## 🎯 Beneficios del Webhook

- ✅ **Respuesta inmediata** a los usuarios
- ✅ **No necesitas** consultar la API constantemente
- ✅ **Mejor experiencia** del usuario
- ✅ **Menor latencia** en las respuestas
- ✅ **Escalable** para múltiples usuarios

---

**⚠️ Importante**: El webhook solo funciona con URLs HTTPS públicas. Para desarrollo local, usa ngrok o similar.
