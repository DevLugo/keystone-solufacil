function toNumber(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value));
  return isNaN(n) ? 0 : n;
}

function computeExpectedWeeklyPayment(loan) {
  const direct = toNumber(loan.expectedWeeklyPayment);
  if (direct > 0) return direct;
  const rate = toNumber(loan.loantype && loan.loantype.rate);
  const duration = loan.loantype && loan.loantype.weekDuration ? loan.loantype.weekDuration : 0;
  const principal = toNumber(loan.requestedAmount);
  if (duration && principal) {
    const total = principal * (1 + rate);
    return total / duration;
  }
  return 0;
}

function getIsoMonday(d) {
  const date = new Date(d);
  const isoDow = (date.getDay() + 6) % 7; // 0=lunes
  date.setDate(date.getDate() - isoDow);
  date.setHours(0, 0, 0, 0);
  return date;
}

function calculateVDOForLoan(loan, now, weekMode = 'current') {
  const expectedWeeklyPayment = computeExpectedWeeklyPayment(loan);
  const signDate = new Date(loan.signDate);

  // Calcular la fecha límite de evaluación según el modo de semana
  const weekStart = getIsoMonday(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  // ✅ CORRECCIÓN: Para semana en curso, evaluar solo hasta el final de la semana anterior
  // Para semana siguiente, evaluar hasta el final de la semana actual
  const previousWeekEnd = new Date(weekStart);
  previousWeekEnd.setDate(weekStart.getDate() - 1);
  previousWeekEnd.setHours(23, 59, 59, 999);
  
  const evaluationEndDate = weekMode === 'current' 
    ? previousWeekEnd // Final de la semana anterior (domingo anterior)
    : weekEnd; // Final de la semana actual (domingo actual)

  // Debug para entender las fechas
  if (loan.signDate === '2024-01-01T00:00:00Z') {
    console.log(`🔍 Debug VDO - Modo: ${weekMode}`);
    console.log(`   - weekStart: ${weekStart.toISOString()}`);
    console.log(`   - weekEnd: ${weekEnd.toISOString()}`);
    console.log(`   - previousWeekEnd: ${previousWeekEnd.toISOString()}`);
    console.log(`   - evaluationEndDate: ${evaluationEndDate.toISOString()}`);
  }

  const weeks = [];
  let currentMonday = getIsoMonday(signDate);
  while (currentMonday <= evaluationEndDate) {
    const end = new Date(currentMonday);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    weeks.push({ monday: new Date(currentMonday), sunday: end });
    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  if (loan.signDate === '2024-01-01T00:00:00Z') {
    console.log(`   - Total semanas generadas: ${weeks.length}`);
    weeks.forEach((week, i) => {
      console.log(`     Semana ${i}: ${week.monday.toISOString()} - ${week.sunday.toISOString()}`);
    });
  }

  let surplusAccumulated = 0;
  let weeksWithoutPayment = 0;

  for (let i = 1; i < weeks.length; i++) {
    const week = weeks[i];
    if (week.sunday > evaluationEndDate) break;

    let weeklyPaid = 0;
    for (const p of loan.payments || []) {
      const dtStr = p.receivedAt || p.createdAt;
      if (!dtStr) continue;
      const dt = new Date(dtStr);
      if (dt >= week.monday && dt <= week.sunday) {
        weeklyPaid += toNumber(p.amount);
      }
    }

    const totalAvailableForWeek = Math.max(0, surplusAccumulated) + weeklyPaid;
    const isWeekCovered = totalAvailableForWeek >= expectedWeeklyPayment;
    if (!isWeekCovered) weeksWithoutPayment++;
    surplusAccumulated = surplusAccumulated + weeklyPaid - expectedWeeklyPayment;
  }

  const arrearsAmount = weeksWithoutPayment * expectedWeeklyPayment;
  return { expectedWeeklyPayment, weeksWithoutPayment, arrearsAmount };
}

function calculateAbonoParcialForLoan(loan, now) {
  const expectedWeeklyPayment = computeExpectedWeeklyPayment(loan);
  const weekStart = getIsoMonday(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  let totalPaidInCurrentWeek = 0;
  for (const p of loan.payments || []) {
    const dtStr = p.receivedAt || p.createdAt;
    if (!dtStr) continue;
    const dt = new Date(dtStr);
    if (dt >= weekStart && dt <= weekEnd) {
      totalPaidInCurrentWeek += toNumber(p.amount);
    }
  }

  const abonoParcialAmount = Math.max(0, totalPaidInCurrentWeek - expectedWeeklyPayment);
  return { expectedWeeklyPayment, totalPaidInCurrentWeek, abonoParcialAmount };
}

module.exports = {
  computeExpectedWeeklyPayment,
  calculateVDOForLoan,
  calculateAbonoParcialForLoan,
};


