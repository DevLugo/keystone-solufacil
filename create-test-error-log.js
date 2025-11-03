const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestErrorLog() {
  try {
    console.log('🧪 Creando log de prueba con información detallada...');
    
    const testLog = await prisma.documentNotificationLog.create({
      data: {
        documentId: `test-error-${Date.now()}`,
        documentType: 'DOCUMENTO_PERSONAL',
        personName: 'Usuario de Prueba',
        routeName: 'Ruta de Prueba',
        localityName: 'Localidad de Prueba',
        routeLeadName: 'Líder de Prueba',
        routeLeadId: 'test-lead-id',
        issueType: 'ERROR',
        status: 'FAILED',
        telegramChatId: '1234567890',
        telegramUsername: 'usuario_prueba',
        telegramErrorMessage: 'Error 400: Bad Request - Invalid chat ID',
        telegramErrorCode: 400,
        telegramResponse: JSON.stringify({
          ok: false,
          error_code: 400,
          description: 'Bad Request: chat not found'
        }),
        sentAt: new Date(),
        responseTimeMs: 1500,
        retryCount: 2,
        lastRetryAt: new Date(),
        notes: 'Log de prueba creado para demostrar la funcionalidad de expansión. Este log contiene información detallada de error para probar el sistema.',
        description: 'Documento marcado como error - Prueba del sistema de logging'
      }
    });
    
    console.log('✅ Log de prueba creado exitosamente:');
    console.log('📋 ID:', testLog.id);
    console.log('📋 Estado:', testLog.status);
    console.log('📋 Error Code:', testLog.telegramErrorCode);
    console.log('📋 Error Message:', testLog.telegramErrorMessage);
    console.log('📋 Notes:', testLog.notes);
    console.log('');
    console.log('🎯 Ahora ve a http://localhost:3000/logs-notificaciones');
    console.log('🎯 Busca el log con ID:', testLog.id);
    console.log('🎯 Haz click en la fila para expandir y ver los detalles del error');
    
  } catch (error) {
    console.error('❌ Error creando log de prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestErrorLog();
