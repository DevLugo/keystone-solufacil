-- Migración para simplificar la configuración de reportes
-- Esta migración elimina y recrea la tabla ReportConfig con el enum actualizado

-- Paso 1: Eliminar todas las tablas relacionadas con ReportConfig
DROP TABLE IF EXISTS "_ReportConfig_recipients";
DROP TABLE IF EXISTS "_ReportConfigToTelegramUser";
DROP TABLE IF EXISTS "_ReportConfig_routes";
DROP TABLE IF EXISTS "_ReportConfig_telegramUsers";
DROP TABLE IF EXISTS "ReportConfig" CASCADE;

-- Paso 2: Eliminar el enum antiguo si existe
DROP TYPE IF EXISTS "ReportConfigReportTypeType";

-- Paso 3: Crear el nuevo enum con los valores actualizados
CREATE TYPE "ReportConfigReportTypeType" AS ENUM ('notificacion_tiempo_real', 'creditos_con_errores', 'resumen_semanal');

-- Paso 4: Recrear la tabla ReportConfig con el esquema actualizado
CREATE TABLE "ReportConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" "ReportConfigReportTypeType" NOT NULL,
    "schedule" JSONB NOT NULL DEFAULT '{"days": [], "hour": "09", "timezone": "America/Mexico_City"}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    CONSTRAINT "ReportConfig_pkey" PRIMARY KEY ("id")
);

-- Paso 5: Crear tabla intermedia para usuarios de Telegram (relación directa)
CREATE TABLE "_ReportConfigToTelegramUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ReportConfigToTelegramUser_A_fkey" FOREIGN KEY ("A") REFERENCES "ReportConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ReportConfigToTelegramUser_B_fkey" FOREIGN KEY ("B") REFERENCES "TelegramUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Paso 6: Crear índices para la tabla intermedia
CREATE UNIQUE INDEX "_ReportConfigToTelegramUser_AB_unique" ON "_ReportConfigToTelegramUser"("A", "B");
CREATE INDEX "_ReportConfigToTelegramUser_B_index" ON "_ReportConfigToTelegramUser"("B");