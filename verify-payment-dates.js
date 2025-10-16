// Verificar fechas exactas de pagos de BERNARDINA

console.log('🔍 VERIFICANDO FECHAS EXACTAS DE PAGOS\n');

const signDate = new Date('2025-09-02'); // Martes 2 de septiembre
const payments = [
  { amount: 300, date: new Date('2025-09-16') }, // Martes 16 de septiembre
  { amount: 300, date: new Date('2025-09-23') }, // Martes 23 de septiembre  
  { amount: 300, date: new Date('2025-10-01') }, // Miércoles 1 de octubre
  { amount: 300, date: new Date('2025-10-09') }  // Jueves 9 de octubre
];

console.log('📅 FECHA DE FIRMA:');
console.log(`   - ${signDate.toLocaleDateString()} (${signDate.toLocaleDateString('es-MX', { weekday: 'long' })})`);

console.log('\n💳 PAGOS REALIZADOS:');
payments.forEach((payment, index) => {
  console.log(`   ${index + 1}. $${payment.amount} - ${payment.date.toLocaleDateString()} (${payment.date.toLocaleDateString('es-MX', { weekday: 'long' })})`);
});

// Función para obtener el lunes de la semana
const getMondayOfWeek = (date) => {
  const monday = new Date(date);
  const dayOfWeek = monday.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// Función para obtener el domingo de la semana
const getSundayOfWeek = (date) => {
  const sunday = new Date(date);
  const dayOfWeek = sunday.getDay();
  const diff = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  sunday.setDate(sunday.getDate() + diff);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

// Generar semanas
const weeks = [];
let currentMonday = getMondayOfWeek(signDate);
currentMonday.setDate(currentMonday.getDate() + 7); // Primera semana no se espera pago

const now = new Date();
const endOfLastWeek = new Date(now.getTime() - 1);

while (currentMonday <= endOfLastWeek) {
  const sunday = getSundayOfWeek(currentMonday);
  weeks.push({ 
    monday: new Date(currentMonday), 
    sunday: new Date(sunday) 
  });
  currentMonday.setDate(currentMonday.getDate() + 7);
}

console.log('\n📊 MAPEO DE PAGOS A SEMANAS:');
weeks.forEach((week, index) => {
  console.log(`\n   Semana ${index + 1} (${week.monday.toLocaleDateString()} - ${week.sunday.toLocaleDateString()}):`);
  
  // Buscar pagos en esta semana
  const paymentsInWeek = payments.filter(p => {
    return p.date >= week.monday && p.date <= week.sunday;
  });
  
  if (paymentsInWeek.length > 0) {
    console.log(`     - Pagos: ${paymentsInWeek.length}`);
    paymentsInWeek.forEach((p, i) => {
      console.log(`       ${i + 1}. $${p.amount} - ${p.date.toLocaleDateString()}`);
    });
  } else {
    console.log(`     - Sin pagos`);
  }
});

console.log('\n🎯 ANÁLISIS:');
console.log('   - BERNARDINA firmó el 2 de septiembre');
console.log('   - Primera semana de pago: 8-14 de septiembre');
console.log('   - BERNARDINA NO pagó en la primera semana de pago');
console.log('   - BERNARDINA pagó en la segunda semana (16 de septiembre)');
console.log('   - Esto significa que BERNARDINA tiene 1 semana de atraso');
console.log('   - VDO debería ser: 1 semana × $300 = $300 (no $1,500)');

console.log('\n❌ PROBLEMA EN EL SISTEMA:');
console.log('   - El sistema está contando 5 semanas sin pago');
console.log('   - Pero BERNARDINA solo tiene 1 semana sin pago');
console.log('   - El problema está en la lógica de sobrepago acumulado');
