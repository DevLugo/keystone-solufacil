-- Eliminar tablas antiguas si existen
DROP TABLE IF EXISTS "_ReportConfigToTelegramUser";

-- Crear tabla intermedia para rutas si no existe
CREATE TABLE IF NOT EXISTS "_ReportConfig_routes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ReportConfig_routes_A_fkey" FOREIGN KEY ("A") REFERENCES "ReportConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ReportConfig_routes_B_fkey" FOREIGN KEY ("B") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Crear índices para rutas si no existen
CREATE UNIQUE INDEX IF NOT EXISTS "_ReportConfig_routes_AB_unique" ON "_ReportConfig_routes"("A", "B");
CREATE INDEX IF NOT EXISTS "_ReportConfig_routes_B_index" ON "_ReportConfig_routes"("B");

-- Crear tabla intermedia para usuarios de Telegram si no existe
CREATE TABLE IF NOT EXISTS "_ReportConfig_telegramUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ReportConfig_telegramUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "ReportConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ReportConfig_telegramUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "TelegramUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Crear índices para usuarios de Telegram si no existen
CREATE UNIQUE INDEX IF NOT EXISTS "_ReportConfig_telegramUsers_AB_unique" ON "_ReportConfig_telegramUsers"("A", "B");
CREATE INDEX IF NOT EXISTS "_ReportConfig_telegramUsers_B_index" ON "_ReportConfig_telegramUsers"("B");
