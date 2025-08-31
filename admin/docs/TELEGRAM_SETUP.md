# 🤖 Configuración del Bot de Telegram para Reportes Automáticos

## 📋 Requisitos Previos

- Cuenta de Telegram
- Acceso a internet
- Token de bot de Telegram (se obtiene de @BotFather)

## 🚀 Paso a Paso para Configurar el Bot

### 1. Crear el Bot en Telegram

1. **Abrir Telegram** y buscar `@BotFather`
2. **Enviar comando**: `/newbot`
3. **Proporcionar nombre del bot**: Ej: "Reportes Solufacil"
4. **Proporcionar username**: Ej: `solufacil_reportes_bot` (debe terminar en 'bot')
5. **Guardar el token** que te proporciona BotFather

### 2. Obtener Chat ID

#### Para Chat Individual:
1. **Enviar mensaje** al bot que creaste
2. **Abrir navegador** y visitar: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. **Buscar** el campo `"chat":{"id":123456789}` en la respuesta
4. **Guardar el número** (puede ser negativo para grupos)

#### Para Grupo:
1. **Agregar el bot al grupo**
2. **Enviar mensaje** en el grupo
3. **Verificar** en la misma URL del paso anterior
4. **El ID será negativo** para grupos

### 3. Configurar Variables de Entorno

Crear o editar el archivo `.env` en la raíz del proyecto:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_DEFAULT_CHAT_ID=123456789

# Configuración por entorno (opcional)
TELEGRAM_BOT_TOKEN_DEV=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_DEFAULT_CHAT_ID_DEV=123456789

TELEGRAM_BOT_TOKEN_PROD=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_DEFAULT_CHAT_ID_PROD=123456789
```

### 4. Verificar Configuración

El bot verificará automáticamente la configuración al iniciar. Si hay errores, verás mensajes en la consola.

## 🔧 Funcionalidades del Bot

### 📊 Tipos de Reportes Soportados

1. **Créditos con Documentos con Error**
   - Resumen de documentos problemáticos
   - Estadísticas de errores
   - Recomendaciones de acción

2. **Créditos Sin Documentos**
   - Lista de documentos faltantes
   - Clientes prioritarios para contacto
   - Estadísticas de completitud

3. **Créditos Completos**
   - Estado de documentación
   - Metas alcanzadas
   - Tendencia de mejora

4. **Resumen Semanal de Cartera**
   - Estado financiero
   - Métricas de cobranza
   - Objetivos y logros

5. **Reporte Financiero**
   - Estado de cartera
   - Flujo de caja
   - Indicadores financieros

### 📤 Formatos de Envío

- **Texto HTML**: Formateado con emojis y estructura clara
- **PDF**: Archivos descargables (implementación futura)

### 🕐 Programación Automática

- **Configuración de días**: Lunes, Martes, Miércoles, etc.
- **Configuración de hora**: Hora específica del día
- **Zona horaria**: Configurable (por defecto México)

## 🧪 Pruebas del Bot

### 1. Envío de Reporte de Prueba

```typescript
import { createReportSenderService } from './services/reportSenderService';

const reportSender = createReportSenderService(
  'TU_BOT_TOKEN',
  'TU_CHAT_ID'
);

// Enviar reporte de prueba
const success = await reportSender.sendTestReport('TU_CHAT_ID');
if (success) {
  console.log('✅ Bot funcionando correctamente');
} else {
  console.log('❌ Error en la configuración del bot');
}
```

### 2. Verificar Conexión

```typescript
// Verificar que el bot esté funcionando
const isConnected = await reportSender.testTelegramConnection();
if (isConnected) {
  console.log('✅ Conexión con Telegram exitosa');
} else {
  console.log('❌ Error de conexión con Telegram');
}
```

## 🚨 Solución de Problemas

### Error: "Bot token is invalid"

- **Verificar** que el token esté correctamente copiado
- **Asegurar** que no haya espacios extra
- **Confirmar** que el bot esté activo en @BotFather

### Error: "Chat not found"

- **Verificar** que el Chat ID sea correcto
- **Asegurar** que el bot esté agregado al chat/grupo
- **Confirmar** que el bot tenga permisos para enviar mensajes

### Error: "Forbidden: bot was blocked by the user"

- **Pedir al usuario** que desbloquee el bot
- **Verificar** que el bot no esté en la lista de bloqueados
- **Confirmar** que el usuario haya iniciado el bot

### Error: "Network Error"

- **Verificar** conexión a internet
- **Confirmar** que la API de Telegram esté disponible
- **Revisar** firewall o proxy corporativo

## 📱 Comandos del Bot

### Comandos Disponibles

- `/start` - Iniciar el bot
- `/help` - Mostrar ayuda
- `/status` - Estado del bot
- `/test` - Enviar reporte de prueba
- `/report` - Generar reporte manual

### Respuestas Automáticas

El bot responde automáticamente a:
- Mensajes de texto
- Comandos específicos
- Reportes programados

## 🔒 Seguridad

### Recomendaciones

1. **No compartir** el token del bot públicamente
2. **Usar variables de entorno** para configuraciones sensibles
3. **Limitar acceso** solo a usuarios autorizados
4. **Monitorear** el uso del bot regularmente
5. **Actualizar** el token si se compromete

### Permisos del Bot

- **Enviar mensajes**: ✅
- **Enviar archivos**: ✅
- **Leer mensajes**: ❌ (solo responde a comandos)
- **Administrar grupos**: ❌ (solo envía mensajes)

## 📈 Monitoreo y Logs

### Logs del Sistema

El bot registra automáticamente:
- Envíos exitosos
- Errores de envío
- Intentos de conexión
- Uso de comandos

### Métricas Disponibles

- **Tasa de envío exitoso**
- **Tiempo de respuesta**
- **Errores por tipo**
- **Uso por usuario**

## 🔄 Actualizaciones Futuras

### Funcionalidades Planificadas

- [ ] **Generación de PDFs** con Puppeteer
- [ ] **Webhooks** para respuestas en tiempo real
- [ ] **Comandos interactivos** con botones
- [ ] **Plantillas personalizables** de reportes
- [ ] **Integración con WhatsApp** y Email
- [ ] **Dashboard de monitoreo** en tiempo real

### Mejoras de Rendimiento

- [ ] **Cola de envío** para reportes masivos
- [ ] **Cache de reportes** para envíos repetidos
- [ ] **Compresión de archivos** para envíos más rápidos
- [ ] **Retry automático** para envíos fallidos

## 📞 Soporte

### Contacto

- **Desarrollador**: Equipo de Desarrollo
- **Email**: desarrollo@solufacil.com
- **Telegram**: @solufacil_dev

### Recursos Adicionales

- [Documentación de la API de Telegram](https://core.telegram.org/bots/api)
- [Guía de BotFather](https://core.telegram.org/bots#botfather)
- [Ejemplos de bots](https://core.telegram.org/bots/samples)

---

**⚠️ Importante**: Nunca compartas el token del bot en código público o repositorios abiertos. Siempre usa variables de entorno para configuraciones sensibles.
