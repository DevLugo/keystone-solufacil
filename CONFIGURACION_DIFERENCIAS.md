# Configuración del Sistema de Reportes de Diferencias

## 📋 Resumen

El sistema de reportes de diferencias detecta automáticamente discrepancias entre los montos esperados (del PDF de cuenta de ruta) y los montos capturados en el sistema, enviando notificaciones por Telegram con capturas de pantalla.

## 🔧 Configuración Básica

### 1. Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```bash
# Telegram Bot (requerido)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Chat ID por defecto (requerido)
TELEGRAM_DEFAULT_CHAT_ID=-1001234567890

# Chat IDs para reportes de diferencias (opcional)
# Si no se especifica, se usa TELEGRAM_DEFAULT_CHAT_ID
# Puedes agregar múltiples chat IDs separados por comas
TELEGRAM_DISCREPANCY_CHAT_IDS=-1001234567890,-1009876543210
```

### 2. Obtener el Token del Bot

Si no tienes un bot de Telegram configurado:

1. Abre Telegram y busca a **@BotFather**
2. Envía el comando `/newbot`
3. Sigue las instrucciones para crear tu bot
4. Copia el **token** que te proporciona BotFather
5. Pega el token en `TELEGRAM_BOT_TOKEN`

### 3. Obtener Chat IDs

#### Para un grupo/canal:

1. Agrega el bot al grupo/canal
2. Envía un mensaje en el grupo mencionando al bot
3. Ve a: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
4. Busca el campo `"chat":{"id":...}` en la respuesta
5. Usa ese ID (incluye el signo negativo si lo tiene)

#### Para un usuario individual:

1. Inicia una conversación con el bot
2. Envía cualquier mensaje
3. Ve a: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
4. Busca tu `"chat":{"id":...}` (será un número positivo)

### 4. Configurar Múltiples Destinatarios

Para enviar reportes a múltiples grupos o personas:

```bash
# Ejemplo: Enviar a 3 grupos diferentes
TELEGRAM_DISCREPANCY_CHAT_IDS=-1001234567890,-1009876543210,-1005555555555
```

## 📱 Funcionamiento

### Cuándo se Envían Reportes

Los reportes se envían automáticamente cuando:

1. **Se detecta una diferencia** entre el monto esperado y el monto capturado
2. **El usuario hace clic en "Reportar Diferencia"** en cualquiera de las tabs:
   - Tab de Abonos
   - Tab de Créditos
   - Tab de Gastos

### Qué Incluye el Reporte

Cada reporte de Telegram contiene:

- 📅 **Fecha** de la transacción
- 🛣️ **Ruta** donde ocurrió la diferencia
- 📍 **Localidad** (líder asociado)
- 📊 **Tipo** de transacción (Abono/Crédito/Gasto)
- 💰 **Monto Esperado** (del PDF)
- 💵 **Monto Capturado** (en el sistema)
- ⚠️ **Diferencia** calculada automáticamente
- 📝 **Descripción** del problema
- 📸 **Captura de pantalla** del estado actual del sistema

### Formato del Mensaje

```
🚨 DIFERENCIA DETECTADA

📅 Fecha: viernes, 2 de noviembre de 2025
🛣️ Ruta: RUTA 1
📍 Localidad: ABIGAIL CHE CHE - PRESIDENTES JUAREZ

📊 Tipo: Abonos
💰 Monto Esperado: $4,500.00
💵 Monto Capturado: $4,400.00
⚠️ Diferencia: -$100.00

📝 Descripción:
Faltan 100 pesos - se le dio comisión de menos a la líder

🔍 Esta diferencia requiere revisión y resolución.
```

## 🎯 Uso en el Sistema

### En las Tabs de Transacciones

1. **Selecciona** la ruta y fecha
2. **Captura** todas las transacciones del día
3. **Abre** el widget de reconciliación (aparece automáticamente)
4. **Ingresa** el "Monto Esperado" del PDF
5. El sistema calcula automáticamente la diferencia
6. Si hay diferencia:
   - **Escribe** una descripción del problema
   - **Haz clic** en "Reportar Diferencia"
   - El sistema captura el screenshot y envía el reporte

### Estados de las Diferencias

Todas las diferencias reportadas pueden tener uno de estos estados:

- **🟡 PENDING** (Pendiente): Diferencia detectada, esperando resolución
- **🟢 COMPLETED** (Completada): Diferencia resuelta
- **🔴 DISCARDED** (Descartada): Diferencia descartada (error de captura, etc.)

## ⚙️ Configuración Avanzada

### Personalizar Destinatarios por Tipo

Si quieres que diferentes tipos de diferencias vayan a diferentes grupos, puedes crear variables adicionales:

```bash
# Reportes de abonos a un grupo
TELEGRAM_PAYMENT_DISCREPANCY_CHAT_IDS=-1001111111111

# Reportes de créditos a otro grupo
TELEGRAM_CREDIT_DISCREPANCY_CHAT_IDS=-1002222222222

# Reportes de gastos a un tercer grupo
TELEGRAM_EXPENSE_DISCREPANCY_CHAT_IDS=-1003333333333
```

> **Nota**: Esta funcionalidad requiere modificación del código. Por ahora, todos los tipos usan `TELEGRAM_DISCREPANCY_CHAT_IDS`.

### Deshabilitar Notificaciones

Si quieres deshabilitar temporalmente las notificaciones sin eliminar la configuración:

```bash
# Comenta o elimina estas líneas:
# TELEGRAM_DISCREPANCY_CHAT_IDS=-1001234567890
```

El sistema seguirá guardando las diferencias en la base de datos pero no enviará notificaciones.

## 🔍 Verificar Configuración

Para verificar que tu bot está configurado correctamente:

1. Ve a la página de **Configuración de Reportes** en el admin
2. Busca la sección de **Telegram**
3. Haz clic en **"Probar Conexión"**
4. Deberías recibir un mensaje de prueba en tu chat de Telegram

## 📊 Consultar Diferencias Reportadas

Todas las diferencias se guardan en la base de datos en la tabla `TransactionDiscrepancy`.

Puedes consultarlas:

```sql
SELECT 
  id,
  "discrepancyType",
  date,
  "expectedAmount",
  "actualAmount",
  difference,
  status,
  "telegramReported"
FROM transaction_discrepancies
WHERE status = 'PENDING'
ORDER BY date DESC;
```

## 🐛 Solución de Problemas

### El bot no envía mensajes

**Problema**: Las diferencias se guardan pero no llegan mensajes a Telegram.

**Soluciones**:
1. Verifica que el `TELEGRAM_BOT_TOKEN` sea correcto
2. Verifica que los `TELEGRAM_DISCREPANCY_CHAT_IDS` sean correctos
3. Asegúrate de que el bot está agregado al grupo
4. Si es un grupo, asegúrate de que el bot tenga permisos para enviar mensajes
5. Revisa los logs del servidor en busca de errores

### Los Chat IDs no funcionan

**Problema**: Los chat IDs parecen incorrectos.

**Soluciones**:
1. Verifica que incluiste el signo `-` si es negativo
2. Para grupos, el ID debe empezar con `-100`
3. Usa la API de Telegram para verificar: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Asegúrate de no tener espacios en los IDs

### Las capturas no se suben

**Problema**: El reporte se envía pero sin la captura de pantalla.

**Soluciones**:
1. Verifica que `CLOUDINARY_*` esté configurado correctamente
2. Revisa que `html2canvas` esté instalado: `npm list html2canvas`
3. Verifica que el elemento a capturar tenga el ID correcto

## 📞 Soporte

Si tienes problemas con la configuración:

1. Revisa los logs del servidor: `yarn dev` o `pm2 logs`
2. Verifica las variables de entorno: `echo $TELEGRAM_BOT_TOKEN`
3. Prueba el bot directamente usando la API de Telegram

## 🚀 Próximos Pasos

Una vez configurado, puedes:

1. ✅ Reportar diferencias desde cualquier tab
2. ✅ Ver el historial de diferencias en la base de datos
3. ⏳ **Próximamente**: Página web para gestionar diferencias (marcar como completadas/descartadas)
4. ⏳ **Próximamente**: Dashboard con estadísticas de diferencias por semana/ruta

---

**Fecha de última actualización**: Noviembre 2025
**Versión del sistema**: 1.0.0


