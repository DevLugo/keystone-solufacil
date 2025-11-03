console.log('🧪 Probando funcionalidad de expansión...');

// Simular un log
const testLog = {
  id: 'test-123',
  status: 'SENT',
  issueType: 'MISSING',
  documentId: 'cmh09ysi30002lzvnbq5kumup',
  personName: 'JUANA IRIS LOPEZ GARCIA',
  routeName: 'RUTA2',
  localityName: 'NICOLASB CAMPECHE',
  routeLeadName: 'JOCABETH PRIEGO GARCIA',
  telegramChatId: '5449955893',
  telegramUsername: 'lugo_test',
  sentAt: new Date(),
  responseTimeMs: 917,
  notes: 'Notificación de documento enviada exitosamente (MISSING)'
};

console.log('📋 Log de prueba:', testLog);
console.log('✅ Estado:', testLog.status);
console.log('✅ Chat ID:', testLog.telegramChatId);
console.log('✅ Destinatario:', testLog.personName);
console.log('');
console.log('🎯 Ahora ve a http://localhost:3000/logs-notificaciones');
console.log('🎯 Busca el log con ID:', testLog.documentId);
console.log('🎯 Haz click en la fila para expandir');
console.log('🎯 Deberías ver un panel verde con información detallada');
