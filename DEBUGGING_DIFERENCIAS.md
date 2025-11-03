# 🐛 Debugging - Sistema de Diferencias

## Problema Reportado
- Las diferencias no aparecen en el modal
- No se reciben mensajes de Telegram

## ✅ Soluciones Aplicadas

### 1. Variables de Telegram Configuradas
Se agregaron al `.env`:
```bash
TELEGRAM_DEFAULT_CHAT_ID=5449955893
TELEGRAM_DISCREPANCY_CHAT_IDS=5449955893
```

### 2. Logs Agregados
Se agregaron logs detallados en:
- `createDiscrepancyResolver`: Para ver cuando se guarda una diferencia
- `getDiscrepanciesResolver`: Para ver qué diferencias se consultan

## 🔍 Pasos para Debugging

### Paso 1: Reiniciar el Servidor
```bash
# Detener el servidor (Ctrl+C)
# Reiniciar
yarn dev
```

**Importante**: Las variables de entorno solo se leen al iniciar el servidor.

### Paso 2: Reportar una Diferencia de Prueba
1. Ve a la página de Transacciones (Abonos tab)
2. Selecciona ruta y fecha
3. Captura algún abono
4. Abre el widget de Reconciliación
5. Ingresa monto esperado (diferente al capturado)
6. Escribe descripción: "Prueba de debugging"
7. Click en "Reportar Diferencia"

### Paso 3: Verificar en el Terminal
Debes ver estos logs:

```
📝 [createDiscrepancy] Datos a guardar: {...}
✅ [createDiscrepancy] Diferencia guardada con ID: xxx
✅ Notificación por Telegram enviada a 1 destinatario(s)
```

Si ves:
- ✅ "Diferencia guardada" → Se guardó en BD
- ✅ "Notificación enviada" → Se envió por Telegram
- ❌ "No se configuraron destinatarios" → Falta reiniciar servidor

### Paso 4: Abrir el Modal de Diferencias
1. Ve al tab "Resumen" en Transacciones
2. Click en el botón flotante "Diferencias" (abajo derecha)
3. Verifica que aparezca la diferencia

En el terminal debes ver:
```
🔍 [getDiscrepancies] Args recibidos: {...}
🔍 [getDiscrepancies] Where query: {...}
✅ [getDiscrepancies] Encontradas X diferencias
```

### Paso 5: Verificar en Telegram
- Abre Telegram
- Busca el chat con el bot
- Debes recibir un mensaje con:
  - Fecha, Ruta, Localidad
  - Monto Esperado vs Capturado
  - Diferencia
  - Descripción
  - (Opcional) Screenshot

## 🔧 Troubleshooting

### "No se configuraron destinatarios de Telegram"
**Causa**: Variables no cargadas
**Solución**: 
1. Verificar que `.env` tenga las variables
2. Reiniciar servidor (Ctrl+C → yarn dev)

### "Diferencia guardada pero no aparece en modal"
**Causa**: Query no está trayendo los datos
**Solución**:
1. Revisar logs de `[getDiscrepancies]` en terminal
2. Verificar que `status` sea 'PENDING'
3. Abrir consola del navegador (F12) y buscar errores

### "No recibo mensaje en Telegram"
**Causa**: Bot o Chat ID incorrectos
**Solución**:
1. Verificar TELEGRAM_BOT_TOKEN en `.env`
2. Verificar TELEGRAM_DEFAULT_CHAT_ID en `.env`
3. Probar enviando un mensaje directo al bot
4. Ver logs en terminal buscando "Telegram"

### "Modal se abre pero dice 'No hay diferencias'"
**Causa**: Filtro de estado o ruta
**Solución**:
1. En el modal, verificar que filtro de Estado esté en "Pendiente"
2. En el dropdown de Ruta, seleccionar "Todas las rutas"
3. Revisar logs de `[getDiscrepancies]` para ver qué query se ejecutó

## 📋 Checklist

Antes de reportar un error, verifica:

- [ ] Servidor reiniciado después de agregar variables .env
- [ ] Variables TELEGRAM_* están en el .env
- [ ] Diferencia se reportó exitosamente (mensaje de éxito en UI)
- [ ] Logs de `[createDiscrepancy]` muestran "guardada con ID"
- [ ] Modal está en filtro "Pendientes"
- [ ] No hay errores en consola del navegador (F12)
- [ ] Logs de `[getDiscrepancies]` muestran "Encontradas X diferencias"

## 🗄️ Consulta Directa a BD

Si todo falla, verifica directamente en la base de datos:

```sql
-- Ver todas las diferencias
SELECT 
  id,
  "discrepancyType",
  status,
  "expectedAmount",
  "actualAmount",
  difference,
  date,
  "createdAt"
FROM transaction_discrepancies
ORDER BY "createdAt" DESC
LIMIT 10;

-- Contar diferencias por estado
SELECT 
  status,
  COUNT(*) as total
FROM transaction_discrepancies
GROUP BY status;
```

## 📞 Si Sigue Sin Funcionar

Comparte:
1. Logs completos del terminal desde que reportas la diferencia
2. Screenshot del modal de diferencias
3. Screenshot de la consola del navegador (F12 → Console)
4. Resultado de la consulta SQL directa

---
**Última actualización**: Noviembre 2025


