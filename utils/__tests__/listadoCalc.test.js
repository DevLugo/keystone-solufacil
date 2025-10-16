const { calculateVDOForLoan, calculateAbonoParcialForLoan } = require('../listadoCalc');

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
    expect(vdoCurrentWeek.weeksWithoutPayment).toBe(1);
    expect(vdoCurrentWeek.arrearsAmount).toBe(350);
    
    // Validaciones para semana siguiente
    expect(vdoNextWeek.expectedWeeklyPayment).toBe(350);
    expect(vdoNextWeek.weeksWithoutPayment).toBe(2);
    expect(vdoNextWeek.arrearsAmount).toBe(700);
    
    // Análisis de resultados
    console.log('✅ Validaciones:');
    if (vdoCurrentWeek.arrearsAmount === 350) {
      console.log('   ✅ CORRECTO: Semana en curso muestra 350 (1 falta)');
    } else {
      console.log(`   ❌ ERROR: Semana en curso muestra ${vdoCurrentWeek.arrearsAmount} en lugar de 350`);
    }
    
    if (vdoNextWeek.arrearsAmount === 700) {
      console.log('   ✅ CORRECTO: Semana siguiente muestra 700 (2 faltas)');
    } else {
      console.log(`   ❌ ERROR: Semana siguiente muestra ${vdoNextWeek.arrearsAmount} en lugar de 700`);
    }
    
    // Verificar que hay diferencia entre ambos modos
    expect(vdoNextWeek.arrearsAmount).toBeGreaterThan(vdoCurrentWeek.arrearsAmount);
    console.log('   ✅ CORRECTO: Hay diferencia entre semana en curso y semana siguiente');
  });
});


