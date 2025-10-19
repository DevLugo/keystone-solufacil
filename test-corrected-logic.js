// Test de la lógica corregida paso a paso

console.log('🧪 PROBANDO LÓGICA CORREGIDA PASO A PASO\n');

// Datos de BERNARDINA
const signDate = new Date('2025-09-02'); // Martes 2 de septiembre
const expectedWeeklyPayment = 300;
const payments = [
  { amount: 300, date: new Date('2025-09-16') }, // Martes 16 de septiembre
  { amount: 300, date: new Date('2025-09-23') }, // Martes 23 de septiembre  
  { amount: 300, date: new Date('2025-10-01') }, // Miércoles 1 de octubre
  { amount: 300, date: new Date('2025-10-09') }  // Jueves 9 de octubre
];

console.log('📋 Datos de BERNARDINA:');
console.log(`   - Fecha de firma: ${signDate.toLocaleDateString()}`);
console.log(`   - Pago semanal esperado: $${expectedWeeklyPayment}`);
console.log(`   - Pagos realizados: ${payments.length}\n`);

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

// Generar semanas desde la segunda semana después de la firma
const weeks = [];
let currentMonday = getMondayOfWeek(signDate);
currentMonday.setDate(currentMonday.getDate() + 7); // Primera semana no se espera pago

const now = new Date();
const endOfLastWeek = new Date(now.getTime() - 1); // Hasta ayer

while (currentMonday <= endOfLastWeek) {
  const sunday = getSundayOfWeek(currentMonday);
  weeks.push({ 
    monday: new Date(currentMonday), 
    sunday: new Date(sunday) 
  });
  currentMonday.setDate(currentMonday.getDate() + 7);
}

console.log('📅 Semanas a evaluar:');
weeks.forEach((week, index) => {
  console.log(`   Semana ${index + 1}: ${week.monday.toLocaleDateString()} - ${week.sunday.toLocaleDateString()}`);
});

console.log('\n🧮 APLICANDO LÓGICA CORREGIDA:\n');

let weeksWithoutPayment = 0;
let surplusAccumulated = 0;

for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
  const week = weeks[weekIndex];
  
  // Solo evaluar semanas que ya terminaron
  if (week.sunday > now) {
    console.log(`   Semana ${weekIndex + 1}: FUTURA - No evaluar`);
    break;
  }
  
  // Buscar pagos en esta semana
  const paymentsInWeek = payments.filter(p => {
    return p.date >= week.monday && p.date <= week.sunday;
  });
  
  const weeklyPaid = paymentsInWeek.reduce((sum, p) => sum + p.amount, 0);
  
  console.log(`   Semana ${weekIndex + 1} (${week.monday.toLocaleDateString()} - ${week.sunday.toLocaleDateString()}):`);
  console.log(`     - Sobrepago anterior: $${surplusAccumulated}`);
  console.log(`     - Pagado en semana: $${weeklyPaid}`);
  
  // LÓGICA CORREGIDA
  const totalAvailableForWeek = surplusAccumulated + weeklyPaid;
  const isWeekCovered = totalAvailableForWeek >= expectedWeeklyPayment && expectedWeeklyPayment > 0;
  
  console.log(`     - Total disponible: $${totalAvailableForWeek}`);
  console.log(`     - Esperado: $${expectedWeeklyPayment}`);
  console.log(`     - Cubierta: ${isWeekCovered ? '✅ SÍ' : '❌ NO'}`);
  
  if (!isWeekCovered) {
    weeksWithoutPayment++;
    console.log(`     - ❌ SEMANA SIN PAGO`);
  } else {
    console.log(`     - ✅ SEMANA CUBIERTA`);
  }
  
  // Actualizar sobrepago
  surplusAccumulated = totalAvailableForWeek - expectedWeeklyPayment;
  console.log(`     - Sobrepago actualizado: $${surplusAccumulated}\n`);
}

// Calcular VDO final
const arrearsAmount = weeksWithoutPayment * expectedWeeklyPayment;

console.log('📊 RESULTADO FINAL:');
console.log(`   - Semanas evaluadas: ${weeks.filter(w => w.sunday <= now).length}`);
console.log(`   - Semanas sin pago: ${weeksWithoutPayment}`);
console.log(`   - Pago semanal esperado: $${expectedWeeklyPayment}`);
console.log(`   - VDO calculado: $${arrearsAmount}`);

if (arrearsAmount === 0) {
  console.log('\n🎉 ¡CORRECCIÓN EXITOSA!');
  console.log('   - BERNARDINA ahora tiene VDO = $0 (correcto)');
  console.log('   - Ha estado pagando puntualmente sus $300 semanales');
} else {
  console.log(`\n⚠️  Aún hay problemas: VDO = $${arrearsAmount}`);
  console.log('   - Debería ser $0 porque BERNARDINA paga puntualmente');
}
