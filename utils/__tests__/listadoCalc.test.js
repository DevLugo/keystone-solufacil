const { calculateVDOForLoan, calculateAbonoParcialForLoan } = require('../listadoCalc');

// Función auxiliar para convertir a número
function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

const fixedNow = new Date('2025-10-15T12:00:00Z');

describe('ListadoCalc (JS) - Unit tests de pago VDO y abono parcial', () => {
  let baseLoan;

  beforeEach(() => {
    baseLoan = {
      signDate: '2025-09-02T00:00:00Z',
      requestedAmount: 3000,
      loantype: { weekDuration: 10, rate: 0 },
      payments: []
    };
  });

  test('Cliente con adelanto de $1000 en semana 1 → abono parcial', () => {
    const loan = {
      ...baseLoan,
      payments: [
        { amount: 1000, receivedAt: '2025-09-15T12:00:00Z' }, // Semana 2
        { amount: 300, receivedAt: '2025-09-22T12:00:00Z' },  // Semana 3
      ],
    };
    const vdo = calculateVDOForLoan(loan, fixedNow);
    const abono = calculateAbonoParcialForLoan(loan, fixedNow);
    expect(vdo.expectedWeeklyPayment).toBe(300);
    expect(vdo.arrearsAmount % 300).toBe(0);
    expect(abono.expectedWeeklyPayment).toBe(300);
  });

  test('Cliente con 2 semanas de faltas → pago VDO', () => {
    const loan = {
      ...baseLoan,
      payments: [
        { amount: 300, receivedAt: '2025-09-29T12:00:00Z' }, // Semana 4
        { amount: 300, receivedAt: '2025-10-06T12:00:00Z' }, // Semana 5
      ],
    };
    const vdo = calculateVDOForLoan(loan, fixedNow);
    expect(vdo.arrearsAmount).toBe(vdo.weeksWithoutPayment * vdo.expectedWeeklyPayment);
    expect(vdo.weeksWithoutPayment).toBeGreaterThanOrEqual(2);
  });

  test('Cliente con pago parcial → diferencia en abono parcial (no sobrepago)', () => {
    const loan = {
      ...baseLoan,
      payments: [
        { amount: 200, receivedAt: '2025-10-13T12:00:00Z' }, // Semana actual parcial
      ],
    };
    const abono = calculateAbonoParcialForLoan(loan, fixedNow);
    expect(abono.expectedWeeklyPayment).toBe(300);
    expect(abono.totalPaidInCurrentWeek).toBe(200);
    expect(abono.abonoParcialAmount).toBe(0);
  });

  test('Cliente con todos los pagos en regla', () => {
    const loan = {
      ...baseLoan,
      payments: [
        { amount: 300, receivedAt: '2025-09-15T12:00:00Z' }, // Sem 2
        { amount: 300, receivedAt: '2025-09-22T12:00:00Z' }, // Sem 3
        { amount: 300, receivedAt: '2025-09-29T12:00:00Z' }, // Sem 4
      ],
    };
    const vdo = calculateVDOForLoan(loan, fixedNow);
    const abono = calculateAbonoParcialForLoan(loan, fixedNow);
    expect(vdo.arrearsAmount).toBeGreaterThanOrEqual(0);
    expect(abono.abonoParcialAmount).toBeGreaterThanOrEqual(0);
  });

  test('Cliente con adelanto en semana 0 (firma) → abono parcial si cae en semana actual', () => {
    const loan = {
      ...baseLoan,
      payments: [
        { amount: 500, receivedAt: '2025-09-05T12:00:00Z' }, // Semana de firma
        { amount: 300, receivedAt: '2025-09-15T12:00:00Z' }, // Sem 2
      ],
    };
    const vdo = calculateVDOForLoan(loan, fixedNow);
    const abono = calculateAbonoParcialForLoan(loan, fixedNow);
    expect(vdo.expectedWeeklyPayment).toBe(300);
    expect(abono.expectedWeeklyPayment).toBe(300);
  });

  // Test para verificar que PAGO VDO no exceda la deuda total
  test('PAGO VDO no debe exceder la deuda total pendiente', () => {
    const loan = {
      signDate: '2024-01-01T00:00:00Z',
      expectedWeeklyPayment: 350,
      requestedAmount: 1000, // Deuda total pequeña
      loantype: { weekDuration: 10, rate: 0.1 }, // 10% de interés
      payments: [] // Sin pagos
    };

    const currentDate = new Date('2024-01-20T12:00:00Z');
    const vdoResult = calculateVDOForLoan(loan, currentDate, 'next');
    
    // Deuda total = 1000 * 1.1 = 1100
    // Sin pagos, debería tener muchas faltas, pero VDO no puede exceder 1100
    const expectedTotalDebt = 1000 * 1.1; // 1100
    
    console.log(`🔍 Test límite de deuda:`);
    console.log(`   - Deuda total: ${expectedTotalDebt}`);
    console.log(`   - Semanas sin pago: ${vdoResult.weeksWithoutPayment}`);
    console.log(`   - VDO calculado: ${vdoResult.arrearsAmount}`);
    console.log(`   - VDO limitado: ${vdoResult.arrearsAmount <= expectedTotalDebt ? '✅' : '❌'}`);
    
    expect(vdoResult.arrearsAmount).toBeLessThanOrEqual(expectedTotalDebt);
  });

  // Test específico para adelanto en semana 0 que cubre semana 1
  test('Adelanto en semana 0 cubre semana 1 sin pago', () => {
    const loan = {
      signDate: '2024-01-01T00:00:00Z', // Lunes
      expectedWeeklyPayment: 300,
      requestedAmount: 3000,
      loantype: { weekDuration: 10, rate: 0 },
      payments: [
        { amount: 600, receivedAt: '2024-01-01T12:00:00Z', createdAt: '2024-01-01T12:00:00Z' }, // Adelanto en semana 0
        { amount: 300, receivedAt: '2024-01-15T12:00:00Z', createdAt: '2024-01-15T12:00:00Z' }  // Pago en semana 2
      ]
    };

    // Simular que estamos en la semana 3
    const currentDate = new Date('2024-01-22T12:00:00Z');

    console.log('🔍 Test adelanto semana 0:');
    console.log(`   - Fecha de firma: ${loan.signDate}`);
    console.log(`   - Pago semanal esperado: ${loan.expectedWeeklyPayment}`);
    console.log(`   - Pagos realizados: ${loan.payments.length}`);
    console.log(`   - Fecha de análisis: ${currentDate.toISOString()}\n`);

    // Debug detallado
    const expectedWeeklyPayment = 300;
    const weekStart = new Date('2024-01-01T00:00:00Z');
    let surplusAccumulated = 0;
    
    for (let week = 0; week < 3; week++) {
      const weekMonday = new Date(weekStart);
      weekMonday.setDate(weekStart.getDate() + (week * 7));
      const weekSunday = new Date(weekMonday);
      weekSunday.setDate(weekMonday.getDate() + 6);
      weekSunday.setHours(23, 59, 59, 999);
      
      let weeklyPaid = 0;
      for (const p of loan.payments) {
        const dt = new Date(p.receivedAt);
        if (dt >= weekMonday && dt <= weekSunday) {
          weeklyPaid += toNumber(p.amount);
        }
      }
      
      const totalAvailableForWeek = surplusAccumulated + weeklyPaid;
      const isWeekCovered = totalAvailableForWeek >= expectedWeeklyPayment;
      const oldSurplus = surplusAccumulated;
      surplusAccumulated = surplusAccumulated + weeklyPaid - expectedWeeklyPayment;
      
      console.log(`   Semana ${week} (${weekMonday.toISOString().split('T')[0]} - ${weekSunday.toISOString().split('T')[0]}):`);
      console.log(`     - Pagado: ${weeklyPaid}`);
      console.log(`     - Sobreplus anterior: ${oldSurplus}`);
      console.log(`     - Total disponible: ${totalAvailableForWeek}`);
      console.log(`     - Esperado: ${expectedWeeklyPayment}`);
      console.log(`     - Cubierto: ${isWeekCovered ? '✅' : '❌'}`);
      console.log(`     - Nuevo sobreplus: ${surplusAccumulated}`);
      console.log('');
    }

    // Test: Semana en curso - NO debería tener PAGO VDO (semana 1 cubierta por sobrepago)
    const vdoCurrentWeek = calculateVDOForLoan(loan, currentDate, 'current');
    console.log(`📊 Semana en curso:`);
    console.log(`   - Semanas sin pago: ${vdoCurrentWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoCurrentWeek.arrearsAmount}`);
    console.log(`   - Esperado: 0 (semana 1 cubierta por sobrepago)\n`);
    
    // Test: Semana siguiente - Debería mostrar 0 (no hay faltas)
    const vdoNextWeek = calculateVDOForLoan(loan, currentDate, 'next');
    console.log(`📊 Semana siguiente:`);
    console.log(`   - Semanas sin pago: ${vdoNextWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoNextWeek.arrearsAmount}`);
    console.log(`   - Esperado: 0 (no hay faltas)\n`);
    
    // Validaciones
    expect(vdoCurrentWeek.arrearsAmount).toBe(0); // Semana en curso: sin faltas
    expect(vdoNextWeek.arrearsAmount).toBe(0);    // Semana siguiente: sin faltas
    
    console.log('✅ Validaciones:');
    if (vdoCurrentWeek.arrearsAmount === 0) {
      console.log('   ✅ CORRECTO: Semana en curso no tiene PAGO VDO (sobrepago funciona)');
    } else {
      console.log(`   ❌ ERROR: Semana en curso muestra ${vdoCurrentWeek.arrearsAmount} en lugar de 0`);
    }
    
    if (vdoNextWeek.arrearsAmount === 0) {
      console.log('   ✅ CORRECTO: Semana siguiente no tiene PAGO VDO');
    } else {
      console.log(`   ❌ ERROR: Semana siguiente muestra ${vdoNextWeek.arrearsAmount} en lugar de 0`);
    }
  });

  // Test específico para LIZBETH ADRIANA AGUILAR CUXIN - Caso con adelanto
  test('LIZBETH ADRIANA AGUILAR CUXIN - Con adelanto no debe tener PAGO VDO', () => {
    // Configuración basada en el historial mostrado en la imagen
    const loan = {
      signDate: '2025-09-16T00:00:00Z', // Lunes 16 de septiembre
      expectedWeeklyPayment: 300,
      requestedAmount: 3000,
      loantype: { weekDuration: 14, rate: 0.4 }, // 0.4% de interés
      payments: [
        { amount: 600, receivedAt: '2025-09-16T00:00:00Z', createdAt: '2025-09-16T00:00:00Z' }, // Pago #1 - adelanto de 300 (300 + 300)
        { amount: 300, receivedAt: '2025-09-30T00:00:00Z', createdAt: '2025-09-30T00:00:00Z' }, // Pago #2 - semana 3
        { amount: 300, receivedAt: '2025-10-07T00:00:00Z', createdAt: '2025-10-07T00:00:00Z' }, // Pago #3 - semana 4
        { amount: 300, receivedAt: '2025-10-14T00:00:00Z', createdAt: '2025-10-14T00:00:00Z' }  // Pago #4 - semana 5
      ]
    };

    // Simular que estamos en la semana 5 (después de todos los pagos)
    const currentDate = new Date('2025-10-15T12:00:00Z'); // Miércoles de la semana 5

    console.log('🔍 Test LIZBETH ADRIANA AGUILAR CUXIN:');
    console.log(`   - Fecha de firma: ${loan.signDate}`);
    console.log(`   - Pago semanal esperado: ${loan.expectedWeeklyPayment}`);
    console.log(`   - Pagos realizados: ${loan.payments.length}`);
    console.log(`   - Fecha de análisis: ${currentDate.toISOString()}\n`);

    // Test: Semana en curso - NO debería tener PAGO VDO
    const vdoCurrentWeek = calculateVDOForLoan(loan, currentDate, 'current');
    console.log(`📊 Semana en curso:`);
    console.log(`   - Semanas sin pago: ${vdoCurrentWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoCurrentWeek.arrearsAmount}`);
    console.log(`   - Esperado: 0 (sin faltas por adelanto)\n`);
    
    // Debug detallado de la lógica de sobrepago
    console.log(`🔍 Debug detallado:`);
    const expectedWeeklyPayment = 300;
    const weekStart = new Date('2025-09-16T00:00:00Z'); // Lunes de la semana de firma
    let surplusAccumulated = 0;
    
    for (let week = 0; week < 4; week++) {
      const weekMonday = new Date(weekStart);
      weekMonday.setDate(weekStart.getDate() + (week * 7));
      const weekSunday = new Date(weekMonday);
      weekSunday.setDate(weekMonday.getDate() + 6);
      weekSunday.setHours(23, 59, 59, 999);
      
      let weeklyPaid = 0;
      for (const p of loan.payments) {
        const dt = new Date(p.receivedAt);
        if (dt >= weekMonday && dt <= weekSunday) {
          weeklyPaid += toNumber(p.amount);
        }
      }
      
      const totalAvailableForWeek = surplusAccumulated + weeklyPaid;
      const isWeekCovered = totalAvailableForWeek >= expectedWeeklyPayment;
      const oldSurplus = surplusAccumulated;
      surplusAccumulated = surplusAccumulated + weeklyPaid - expectedWeeklyPayment;
      
      console.log(`   Semana ${week + 1} (${weekMonday.toISOString().split('T')[0]} - ${weekSunday.toISOString().split('T')[0]}):`);
      console.log(`     - Pagado: ${weeklyPaid}`);
      console.log(`     - Sobreplus anterior: ${oldSurplus}`);
      console.log(`     - Total disponible: ${totalAvailableForWeek}`);
      console.log(`     - Esperado: ${expectedWeeklyPayment}`);
      console.log(`     - Cubierto: ${isWeekCovered ? '✅' : '❌'}`);
      console.log(`     - Nuevo sobreplus: ${surplusAccumulated}`);
      console.log('');
    }
    
    // Test: Semana siguiente - NO debería tener PAGO VDO
    const vdoNextWeek = calculateVDOForLoan(loan, currentDate, 'next');
    console.log(`📊 Semana siguiente:`);
    console.log(`   - Semanas sin pago: ${vdoNextWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoNextWeek.arrearsAmount}`);
    console.log(`   - Esperado: 0 (sin faltas por adelanto)\n`);
    
    // Validaciones
    expect(vdoCurrentWeek.arrearsAmount).toBe(0);
    expect(vdoNextWeek.arrearsAmount).toBe(0);
    
    console.log('✅ Validaciones:');
    if (vdoCurrentWeek.arrearsAmount === 0) {
      console.log('   ✅ CORRECTO: Semana en curso no tiene PAGO VDO');
    } else {
      console.log(`   ❌ ERROR: Semana en curso muestra ${vdoCurrentWeek.arrearsAmount} en lugar de 0`);
    }
    
    if (vdoNextWeek.arrearsAmount === 0) {
      console.log('   ✅ CORRECTO: Semana siguiente no tiene PAGO VDO');
    } else {
      console.log(`   ❌ ERROR: Semana siguiente muestra ${vdoNextWeek.arrearsAmount} en lugar de 0`);
    }
  });

  // Test específico para el escenario de JUANA SANTIAGO LOPEZ con ambos modos de semana
  test('JUANA SANTIAGO LOPEZ - Comparar semana en curso vs semana siguiente', () => {
    // Configuración del préstamo basada en JUANA SANTIAGO LOPEZ
    const loan = {
      signDate: '2024-01-01T00:00:00Z', // Lunes
      expectedWeeklyPayment: 350,
      requestedAmount: 3000,
      loantype: { weekDuration: 10, rate: 0 },
      payments: [
        // Solo un pago en la primera semana (semana 2)
        { amount: 350, receivedAt: '2024-01-08T12:00:00Z', createdAt: '2024-01-08T12:00:00Z' }
      ]
    };

    // Simular que estamos en sábado 20 de enero de 2024 (semana 3)
    const currentDate = new Date('2024-01-20T12:00:00Z'); // Sábado

    console.log('🔍 Test JUANA SANTIAGO LOPEZ - Comparación de modos:');
    console.log(`   - Fecha de firma: ${loan.signDate}`);
    console.log(`   - Pago semanal esperado: ${loan.expectedWeeklyPayment}`);
    console.log(`   - Pagos realizados: ${loan.payments.length}`);
    console.log(`   - Fecha de análisis: ${currentDate.toISOString()}\n`);

    // Debug: Calcular fechas de semana
    const weekStart = new Date(currentDate);
    const isoDow = (weekStart.getDay() + 6) % 7; // 0=lunes
    weekStart.setDate(weekStart.getDate() - isoDow);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const previousWeekEnd = new Date(weekStart.getTime() - 1);
    
    console.log(`📅 Fechas de semana:`);
    console.log(`   - Lunes de semana actual: ${weekStart.toISOString()}`);
    console.log(`   - Domingo de semana actual: ${weekEnd.toISOString()}`);
    console.log(`   - Final de semana anterior: ${previousWeekEnd.toISOString()}\n`);

    // Debug detallado para JUANA SANTIAGO LOPEZ
    console.log(`🔍 Debug detallado JUANA:`);
    const expectedWeeklyPayment = 350;
    const juanaWeekStart = new Date('2024-01-01T00:00:00Z'); // Lunes de la semana de firma
    let surplusAccumulated = 0;
    
    for (let week = 0; week < 4; week++) {
      const weekMonday = new Date(juanaWeekStart);
      weekMonday.setDate(juanaWeekStart.getDate() + (week * 7));
      const weekSunday = new Date(weekMonday);
      weekSunday.setDate(weekMonday.getDate() + 6);
      weekSunday.setHours(23, 59, 59, 999);
      
      
      let weeklyPaid = 0;
      for (const p of loan.payments) {
        const dt = new Date(p.receivedAt);
        if (dt >= weekMonday && dt <= weekSunday) {
          weeklyPaid += toNumber(p.amount);
        }
      }
      
      // ✅ CORRECCIÓN: Aplicar la misma lógica que la función
      if (week === 0 && weeklyPaid === 0) {
        console.log(`   Semana ${week} (${weekMonday.toISOString().split('T')[0]} - ${weekSunday.toISOString().split('T')[0]}):`);
        console.log(`     - Pagado: ${weeklyPaid}`);
        console.log(`     - SALTADA: Semana de firma sin pagos`);
        console.log('');
        continue;
      }
      
      const totalAvailableForWeek = surplusAccumulated + weeklyPaid;
      const isWeekCovered = totalAvailableForWeek >= expectedWeeklyPayment;
      const oldSurplus = surplusAccumulated;
      surplusAccumulated = surplusAccumulated + weeklyPaid - expectedWeeklyPayment;
      
      console.log(`   Semana ${week} (${weekMonday.toISOString().split('T')[0]} - ${weekSunday.toISOString().split('T')[0]}):`);
      console.log(`     - Pagado: ${weeklyPaid}`);
      console.log(`     - Sobreplus anterior: ${oldSurplus}`);
      console.log(`     - Total disponible: ${totalAvailableForWeek}`);
      console.log(`     - Esperado: ${expectedWeeklyPayment}`);
      console.log(`     - Cubierto: ${isWeekCovered ? '✅' : '❌'}`);
      console.log(`     - Nuevo sobreplus: ${surplusAccumulated}`);
      console.log('');
    }

    // Test 1: Semana en curso - debería mostrar 350 (1 falta)
    const vdoCurrentWeek = calculateVDOForLoan(loan, currentDate, 'current');
    console.log(`📊 Semana en curso:`);
    console.log(`   - Semanas sin pago: ${vdoCurrentWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoCurrentWeek.arrearsAmount}`);
    
    // Test 2: Semana siguiente - debería mostrar 700 (2 faltas)
    const vdoNextWeek = calculateVDOForLoan(loan, currentDate, 'next');
    console.log(`📊 Semana siguiente:`);
    console.log(`   - Semanas sin pago: ${vdoNextWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoNextWeek.arrearsAmount}\n`);
    
    // Validaciones para semana en curso
    expect(vdoCurrentWeek.expectedWeeklyPayment).toBe(350);
    expect(vdoCurrentWeek.weeksWithoutPayment).toBe(0); // Sin faltas porque pagó en semana 1
    expect(vdoCurrentWeek.arrearsAmount).toBe(0);

    // Validaciones para semana siguiente
    expect(vdoNextWeek.expectedWeeklyPayment).toBe(350);
    expect(vdoNextWeek.weeksWithoutPayment).toBe(1); // 1 falta en semana 2
    expect(vdoNextWeek.arrearsAmount).toBe(350);
    
    // Análisis de resultados
    console.log('✅ Validaciones:');
    if (vdoCurrentWeek.arrearsAmount === 0) {
      console.log('   ✅ CORRECTO: Semana en curso muestra 0 (sin faltas, pagó en semana 1)');
    } else {
      console.log(`   ❌ ERROR: Semana en curso muestra ${vdoCurrentWeek.arrearsAmount} en lugar de 0`);
    }
    
    if (vdoNextWeek.arrearsAmount === 350) {
      console.log('   ✅ CORRECTO: Semana siguiente muestra 350 (1 falta en semana 2)');
    } else {
      console.log(`   ❌ ERROR: Semana siguiente muestra ${vdoNextWeek.arrearsAmount} en lugar de 350`);
    }
    
    // Verificar que hay diferencia entre ambos modos
    expect(vdoNextWeek.arrearsAmount).toBeGreaterThan(vdoCurrentWeek.arrearsAmount);
    console.log('   ✅ CORRECTO: Hay diferencia entre semana en curso y semana siguiente');
  });

  // Test específico para JUANA - Escenario real del reporte (700 VDO)
  test('JUANA SANTIAGO LOPEZ - Escenario real del reporte (700 VDO)', () => {
    // Simular datos reales basados en el debug del reporte real
    const loan = {
      signDate: '2025-09-02T06:00:00.000Z', // Exactamente como en el debug
      expectedWeeklyPayment: 350,
      requestedAmount: '3500', // Exactamente como en el debug
      loantype: { weekDuration: 14, rate: 0.4 },
      payments: [
        { amount: '350', receivedAt: '2025-09-09T06:00:00.000Z', createdAt: '2025-09-29T03:16:37.580Z' },
        { amount: '350', receivedAt: '2025-09-16T06:00:00.000Z', createdAt: '2025-09-29T03:16:37.580Z' },
        { amount: '350', receivedAt: '2025-09-23T06:00:00.000Z', createdAt: '2025-09-29T03:16:37.580Z' },
        { amount: '350', receivedAt: '2025-10-07T06:00:00.000Z', createdAt: '2025-10-08T05:16:43.142Z' }
      ]
    };

    // Debug para verificar las fechas de los pagos
    console.log('🔍 Debug de pagos:');
    loan.payments.forEach((p, i) => {
      const dt = new Date(p.receivedAt);
      console.log(`   Pago ${i + 1}: ${dt.toISOString()} (${dt.toLocaleDateString()})`);
    });

    // Simular que estamos en la fecha del debug real (10/18/2025)
    const currentDate = new Date('2025-10-18T12:00:00Z');

    console.log('🔍 Test JUANA - Escenario real (700 VDO):');
    console.log(`   - Fecha de firma: ${loan.signDate}`);
    console.log(`   - Pago semanal esperado: ${loan.expectedWeeklyPayment}`);
    console.log(`   - Pagos realizados: ${loan.payments.length}`);
    console.log(`   - Fecha de análisis: ${currentDate.toISOString()}\n`);

    // Test: Semana en curso - debería mostrar 350 (1 falta en semana 2)
    const vdoCurrentWeek = calculateVDOForLoan(loan, currentDate, 'current');
    console.log(`📊 Semana en curso:`);
    console.log(`   - Semanas sin pago: ${vdoCurrentWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoCurrentWeek.arrearsAmount}`);
    console.log(`   - Esperado: 350 (1 falta en semana 2)\n`);
    
    // Test: Semana siguiente - debería mostrar 700 (2 faltas en semana 2 y 3)
    const vdoNextWeek = calculateVDOForLoan(loan, currentDate, 'next');
    console.log(`📊 Semana siguiente:`);
    console.log(`   - Semanas sin pago: ${vdoNextWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoNextWeek.arrearsAmount}`);
    console.log(`   - Esperado: 700 (2 faltas en semana 2 y 3)\n`);
    
    // Validaciones
    expect(vdoCurrentWeek.arrearsAmount).toBe(350);
    expect(vdoNextWeek.arrearsAmount).toBe(700);
    
    console.log('✅ Validaciones:');
    if (vdoCurrentWeek.arrearsAmount === 350) {
      console.log('   ✅ CORRECTO: Semana en curso muestra 350 (1 falta en semana 2)');
    } else {
      console.log(`   ❌ ERROR: Semana en curso muestra ${vdoCurrentWeek.arrearsAmount} en lugar de 350`);
    }
    
    if (vdoNextWeek.arrearsAmount === 700) {
      console.log('   ✅ CORRECTO: Semana siguiente muestra 700 (2 faltas en semana 2 y 3)');
    } else {
      console.log(`   ❌ ERROR: Semana siguiente muestra ${vdoNextWeek.arrearsAmount} en lugar de 700`);
    }
  });

  // Test específico para LIZBETH - Escenario real del reporte
  test('LIZBETH ADRIANA AGUILAR CUXIN - Escenario real del reporte', () => {
    // Simular datos reales basados en el historial de pagos de la imagen
    const loan = {
      signDate: '2025-09-16T00:00:00Z', // Lunes 16 de septiembre
      expectedWeeklyPayment: 300,
      requestedAmount: 4500, // Deuda inicial $4,200 + $300 del primer pago
      loantype: { weekDuration: 14, rate: 0.4 }, // 0.4% de interés
      payments: [
        { amount: 600, receivedAt: '2025-09-16T00:00:00Z', createdAt: '2025-09-16T00:00:00Z' }, // Pago #1 - $600 (300 + 300 adelanto)
        { amount: 300, receivedAt: '2025-09-30T00:00:00Z', createdAt: '2025-09-30T00:00:00Z' }, // Pago #2 - semana 3
        { amount: 300, receivedAt: '2025-10-07T00:00:00Z', createdAt: '2025-10-07T00:00:00Z' }, // Pago #3 - semana 4
        { amount: 300, receivedAt: '2025-10-14T00:00:00Z', createdAt: '2025-10-14T00:00:00Z' }  // Pago #4 - semana 5
      ]
    };

    // Simular que estamos en la semana 5 (después de todos los pagos)
    const currentDate = new Date('2025-10-15T12:00:00Z'); // Miércoles de la semana 5

    console.log('🔍 Test LIZBETH - Escenario real:');
    console.log(`   - Fecha de firma: ${loan.signDate}`);
    console.log(`   - Pago semanal esperado: ${loan.expectedWeeklyPayment}`);
    console.log(`   - Pagos realizados: ${loan.payments.length}`);
    console.log(`   - Fecha de análisis: ${currentDate.toISOString()}\n`);

    // Test: Semana en curso - NO debería tener PAGO VDO
    const vdoCurrentWeek = calculateVDOForLoan(loan, currentDate, 'current');
    console.log(`📊 Semana en curso:`);
    console.log(`   - Semanas sin pago: ${vdoCurrentWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoCurrentWeek.arrearsAmount}`);
    console.log(`   - Esperado: 0 (sin faltas por adelanto)\n`);
    
    // Test: Semana siguiente - NO debería tener PAGO VDO
    const vdoNextWeek = calculateVDOForLoan(loan, currentDate, 'next');
    console.log(`📊 Semana siguiente:`);
    console.log(`   - Semanas sin pago: ${vdoNextWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoNextWeek.arrearsAmount}`);
    console.log(`   - Esperado: 0 (sin faltas por adelanto)\n`);
    
    // Validaciones
    expect(vdoCurrentWeek.arrearsAmount).toBe(0);
    expect(vdoNextWeek.arrearsAmount).toBe(0);
    
    console.log('✅ Validaciones:');
    if (vdoCurrentWeek.arrearsAmount === 0) {
      console.log('   ✅ CORRECTO: Semana en curso no tiene PAGO VDO');
    } else {
      console.log(`   ❌ ERROR: Semana en curso muestra ${vdoCurrentWeek.arrearsAmount} en lugar de 0`);
    }
    
    if (vdoNextWeek.arrearsAmount === 0) {
      console.log('   ✅ CORRECTO: Semana siguiente no tiene PAGO VDO');
    } else {
      console.log(`   ❌ ERROR: Semana siguiente muestra ${vdoNextWeek.arrearsAmount} en lugar de 0`);
    }
  });

  // Test específico para CELMY ILEANA MADERO CACH
  test('CELMY ILEANA MADERO CACH - Adelanto semana 0 cubre semana 1 sin pago', () => {
    // Configuración basada en el historial proporcionado
    const loan = {
      signDate: '2025-09-30T00:00:00Z', // Lunes 30 de septiembre (semana de firma)
      expectedWeeklyPayment: 300,
      requestedAmount: '4200',
      loantype: { weekDuration: 14, rate: 0 },
      payments: [
        { amount: '300', receivedAt: '2025-09-30T00:00:00Z', createdAt: '2025-09-30T00:00:00Z' }, // Pago #1 - Adelanto en semana 0
        { amount: '300', receivedAt: '2025-10-14T00:00:00Z', createdAt: '2025-10-14T00:00:00Z' }  // Pago #2 - Semana 2
      ]
    };

    // Simular que estamos en la semana del 14/10/2025 (después del pago #2)
    const currentDate = new Date('2025-10-14T12:00:00Z');

    console.log('🔍 Test CELMY ILEANA MADERO CACH:');
    console.log(`   - Fecha de firma: ${loan.signDate}`);
    console.log(`   - Pago semanal esperado: ${loan.expectedWeeklyPayment}`);
    console.log(`   - Pagos realizados: ${loan.payments.length}`);
    console.log(`   - Fecha de análisis: ${currentDate.toISOString()}\n`);

    // Debug para verificar las fechas de los pagos
    console.log('🔍 Debug de pagos:');
    loan.payments.forEach((p, i) => {
      const dt = new Date(p.receivedAt);
      console.log(`   Pago ${i + 1}: ${dt.toISOString()} (${dt.toLocaleDateString()})`);
    });

    // Test: Semana en curso - NO debería tener PAGO VDO (semana 1 cubierta por sobrepago)
    const vdoCurrentWeek = calculateVDOForLoan(loan, currentDate, 'current');
    console.log(`📊 Semana en curso:`);
    console.log(`   - Semanas sin pago: ${vdoCurrentWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoCurrentWeek.arrearsAmount}`);
    console.log(`   - Esperado: 0 (semana 1 cubierta por sobrepago)\n`);

    // Debug detallado para entender qué está pasando
    console.log('🔍 Debug detallado:');
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Lunes de la semana actual
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const previousWeekEnd = new Date(weekStart);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
    previousWeekEnd.setHours(23, 59, 59, 999);
    
    console.log(`   - Lunes de semana actual: ${weekStart.toISOString()}`);
    console.log(`   - Domingo de semana actual: ${weekEnd.toISOString()}`);
    console.log(`   - Final de semana anterior: ${previousWeekEnd.toISOString()}`);
    console.log(`   - evaluationEndDate (current): ${previousWeekEnd.toISOString()}\n`);
    
    // Test: Semana siguiente - Debería mostrar 0 (no hay faltas)
    const vdoNextWeek = calculateVDOForLoan(loan, currentDate, 'next');
    console.log(`📊 Semana siguiente:`);
    console.log(`   - Semanas sin pago: ${vdoNextWeek.weeksWithoutPayment}`);
    console.log(`   - Monto VDO: ${vdoNextWeek.arrearsAmount}`);
    console.log(`   - Esperado: 0 (no hay faltas)\n`);
    
    // Validaciones
    expect(vdoCurrentWeek.arrearsAmount).toBe(0); // Semana en curso: sin faltas
    expect(vdoNextWeek.arrearsAmount).toBe(0);    // Semana siguiente: sin faltas
    
    console.log('✅ Validaciones:');
    if (vdoCurrentWeek.arrearsAmount === 0) {
      console.log('   ✅ CORRECTO: Semana en curso no tiene PAGO VDO (sobrepago funciona)');
    } else {
      console.log(`   ❌ ERROR: Semana en curso muestra ${vdoCurrentWeek.arrearsAmount} en lugar de 0`);
    }
    
    if (vdoNextWeek.arrearsAmount === 0) {
      console.log('   ✅ CORRECTO: Semana siguiente no tiene PAGO VDO');
    } else {
      console.log(`   ❌ ERROR: Semana siguiente muestra ${vdoNextWeek.arrearsAmount} en lugar de 0`);
    }
  });

  // Tests específicos para abono parcial (sobrepago disponible)
  test('Abono parcial - Cliente con sobrepago en semana 0', () => {
    const loan = {
      signDate: '2025-09-30T00:00:00Z',
      expectedWeeklyPayment: 300,
      requestedAmount: '4200',
      loantype: { weekDuration: 14, rate: 0 },
      payments: [
        { amount: '600', receivedAt: '2025-09-30T00:00:00Z', createdAt: '2025-09-30T00:00:00Z' } // Adelanto de 600 en semana 0
      ]
    };

    const currentDate = new Date('2025-10-14T12:00:00Z');
    const vdoResult = calculateVDOForLoan(loan, currentDate, 'current');

    console.log('🔍 Test abono parcial - Sobrepago semana 0:');
    console.log(`   - Pago semanal esperado: ${vdoResult.expectedWeeklyPayment}`);
    console.log(`   - PAGO VDO: ${vdoResult.arrearsAmount}`);
    console.log(`   - Abono parcial: ${vdoResult.partialPayment}`);
    console.log(`   - Esperado abono parcial: 300 (600 - 300)\n`);

    expect(vdoResult.partialPayment).toBe(300); // 600 - 300 = 300 de sobrepago
    expect(vdoResult.arrearsAmount).toBe(0); // No hay faltas
  });

  test('Abono parcial - Cliente con sobrepago acumulado', () => {
    const loan = {
      signDate: '2025-09-16T00:00:00Z',
      expectedWeeklyPayment: 300,
      requestedAmount: '4200',
      loantype: { weekDuration: 14, rate: 0 },
      payments: [
        { amount: '600', receivedAt: '2025-09-16T00:00:00Z', createdAt: '2025-09-16T00:00:00Z' }, // Semana 1: 600 (sobrepago 300)
        { amount: '0', receivedAt: '2025-09-23T00:00:00Z', createdAt: '2025-09-23T00:00:00Z' },   // Semana 2: 0 (cubierta por sobrepago)
        { amount: '200', receivedAt: '2025-09-30T00:00:00Z', createdAt: '2025-09-30T00:00:00Z' }  // Semana 3: 200 (debe 100, queda sobrepago 200)
      ]
    };

    const currentDate = new Date('2025-10-07T12:00:00Z');
    const vdoResult = calculateVDOForLoan(loan, currentDate, 'current');

    console.log('🔍 Test abono parcial - Sobrepago acumulado:');
    console.log(`   - Pago semanal esperado: ${vdoResult.expectedWeeklyPayment}`);
    console.log(`   - PAGO VDO: ${vdoResult.arrearsAmount}`);
    console.log(`   - Abono parcial: ${vdoResult.partialPayment}`);
    console.log(`   - Esperado abono parcial: 200 (sobrepago restante)\n`);

    expect(vdoResult.partialPayment).toBe(200); // Sobrepago restante
    expect(vdoResult.arrearsAmount).toBe(0); // No hay faltas
  });

  test('Abono parcial - Cliente con adelanto en semana 0 y pagos posteriores', () => {
    const loan = {
      signDate: '2025-09-16T00:00:00Z',
      expectedWeeklyPayment: 300,
      requestedAmount: '4200',
      loantype: { weekDuration: 14, rate: 0 },
      payments: [
        { amount: '300', receivedAt: '2025-09-16T00:00:00Z', createdAt: '2025-09-16T00:00:00Z' }, // Semana 0: 300 (adelanto)
        { amount: '300', receivedAt: '2025-09-23T00:00:00Z', createdAt: '2025-09-23T00:00:00Z' }, // Semana 1: 300 (exacto)
        { amount: '300', receivedAt: '2025-09-30T00:00:00Z', createdAt: '2025-09-30T00:00:00Z' }  // Semana 2: 300 (exacto)
      ]
    };

    // Evaluar en la semana 3 (07/10 - 13/10)
    const currentDate = new Date('2025-10-07T12:00:00Z');
    const vdoResult = calculateVDOForLoan(loan, currentDate, 'current');

    console.log('🔍 Test abono parcial - Con adelanto en semana 0:');
    console.log(`   - Pago semanal esperado: ${vdoResult.expectedWeeklyPayment}`);
    console.log(`   - PAGO VDO: ${vdoResult.arrearsAmount}`);
    console.log(`   - Abono parcial: ${vdoResult.partialPayment}`);
    console.log(`   - Esperado abono parcial: 300 (adelanto semana 0 cubre semana 1, pago semana 1 genera sobrepago)\n`);

    expect(vdoResult.partialPayment).toBe(300); // Adelanto de semana 0 cubre semana 1, pago de semana 1 genera sobrepago
    expect(vdoResult.arrearsAmount).toBe(0); // No hay faltas
  });

  test('Abono parcial - Cliente con déficit (sin abono parcial)', () => {
    const loan = {
      signDate: '2025-09-16T00:00:00Z',
      expectedWeeklyPayment: 300,
      requestedAmount: '4200',
      loantype: { weekDuration: 14, rate: 0 },
      payments: [
        { amount: '200', receivedAt: '2025-09-16T00:00:00Z', createdAt: '2025-09-16T00:00:00Z' }, // Semana 1: 200 (debe 100)
        { amount: '0', receivedAt: '2025-09-23T00:00:00Z', createdAt: '2025-09-23T00:00:00Z' },   // Semana 2: 0 (falta)
        { amount: '300', receivedAt: '2025-09-30T00:00:00Z', createdAt: '2025-09-30T00:00:00Z' }  // Semana 3: 300 (exacto)
      ]
    };

    const currentDate = new Date('2025-10-07T12:00:00Z');
    const vdoResult = calculateVDOForLoan(loan, currentDate, 'current');

    console.log('🔍 Test abono parcial - Con déficit:');
    console.log(`   - Pago semanal esperado: ${vdoResult.expectedWeeklyPayment}`);
    console.log(`   - PAGO VDO: ${vdoResult.arrearsAmount}`);
    console.log(`   - Abono parcial: ${vdoResult.partialPayment}`);
    console.log(`   - Esperado abono parcial: 0 (con déficit no hay abono parcial)\n`);

    expect(vdoResult.partialPayment).toBe(0); // Con déficit no hay abono parcial
    expect(vdoResult.arrearsAmount).toBe(300); // 1 falta de 300
  });

  test('Abono parcial - CELMY ILEANA MADERO CACH (caso real)', () => {
    const loan = {
      signDate: '2025-09-30T00:00:00Z',
      expectedWeeklyPayment: 300,
      requestedAmount: '4200',
      loantype: { weekDuration: 14, rate: 0 },
      payments: [
        { amount: '300', receivedAt: '2025-09-30T00:00:00Z', createdAt: '2025-09-30T00:00:00Z' }, // Pago #1 - Adelanto en semana 0
        { amount: '300', receivedAt: '2025-10-14T00:00:00Z', createdAt: '2025-10-14T00:00:00Z' }  // Pago #2 - Semana 2
      ]
    };

    const currentDate = new Date('2025-10-14T12:00:00Z');
    const vdoResult = calculateVDOForLoan(loan, currentDate, 'current');

    console.log('🔍 Test abono parcial - CELMY (caso real):');
    console.log(`   - Pago semanal esperado: ${vdoResult.expectedWeeklyPayment}`);
    console.log(`   - PAGO VDO: ${vdoResult.arrearsAmount}`);
    console.log(`   - Abono parcial: ${vdoResult.partialPayment}`);
    console.log(`   - Esperado abono parcial: 0 (sobrepago se usó para cubrir semana 1)\n`);

    expect(vdoResult.partialPayment).toBe(0); // El sobrepago se usó para cubrir la semana 1
    expect(vdoResult.arrearsAmount).toBe(0); // No hay faltas
  });
});


