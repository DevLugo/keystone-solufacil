// Debug de la generación de semanas

console.log('🔍 DEBUGGING: Generación de semanas para BERNARDINA\n');

const signDate = new Date('2025-09-02'); // Martes 2 de septiembre

console.log('📅 FECHA DE FIRMA:');
console.log(`   - Fecha: ${signDate.toLocaleDateString()}`);
console.log(`   - Día: ${signDate.toLocaleDateString('es-MX', { weekday: 'long' })}\n`);

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

console.log('📊 ANÁLISIS DE SEMANAS:\n');

// Semana de firma
const signWeekMonday = getMondayOfWeek(signDate);
const signWeekSunday = getSundayOfWeek(signDate);
console.log('Semana de firma:');
console.log(`   - Lunes: ${signWeekMonday.toLocaleDateString()}`);
console.log(`   - Domingo: ${signWeekSunday.toLocaleDateString()}`);
console.log(`   - ¿Se espera pago? NO (primera semana)\n`);

// Primera semana de pago (segunda semana después de la firma)
let currentMonday = getMondayOfWeek(signDate);
currentMonday.setDate(currentMonday.getDate() + 7); // Primera semana no se espera pago
const firstPaymentWeekMonday = new Date(currentMonday);
const firstPaymentWeekSunday = getSundayOfWeek(firstPaymentWeekMonday);

console.log('Primera semana de pago:');
console.log(`   - Lunes: ${firstPaymentWeekMonday.toLocaleDateString()}`);
console.log(`   - Domingo: ${firstPaymentWeekSunday.toLocaleDateString()}`);
console.log(`   - ¿Se espera pago? SÍ (primera semana de pago)\n`);

// Generar todas las semanas
const weeks = [];
const now = new Date();
const endOfLastWeek = new Date(now.getTime() - 1);

console.log('Generando semanas:');
let weekCounter = 1;
while (currentMonday <= endOfLastWeek) {
  const sunday = getSundayOfWeek(currentMonday);
  weeks.push({ 
    monday: new Date(currentMonday), 
    sunday: new Date(sunday) 
  });
  
  console.log(`   Semana ${weekCounter}: ${currentMonday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`);
  console.log(`     - ¿Se espera pago? ${weekCounter === 1 ? 'NO (primera semana)' : 'SÍ'}`);
  
  currentMonday.setDate(currentMonday.getDate() + 7);
  weekCounter++;
}

console.log(`\n📋 Total de semanas generadas: ${weeks.length}`);

console.log('\n🎯 PROBLEMA IDENTIFICADO:');
console.log('   - La "Semana 1" en el array es en realidad la PRIMERA SEMANA DE PAGO');
console.log('   - Pero el sistema la está tratando como si fuera la semana de firma');
console.log('   - Por eso se espera pago en la "Semana 1" cuando no debería');

console.log('\n✅ SOLUCIÓN:');
console.log('   - La "Semana 1" en el array YA es la primera semana de pago');
console.log('   - NO se debe evaluar como "sin pago esperado"');
console.log('   - El problema está en la lógica de evaluación, no en la generación');
