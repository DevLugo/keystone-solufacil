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
  const isoDow = (date.getUTCDay() + 6) % 7; // 0=lunes
  date.setUTCDate(date.getUTCDate() - isoDow);
  date.setUTCHours(0, 0, 0, 0);
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
  // Calcular el final de la semana anterior (domingo anterior)
  const previousWeekEnd = new Date(weekStart);
  previousWeekEnd.setDate(weekStart.getDate() - 1);
  previousWeekEnd.setHours(23, 59, 59, 999);
  
  // Evaluar según el modo:
  // - "current": hasta el final de la semana anterior (domingo anterior)
  // - "next": hasta el final de la semana actual (domingo actual)
  const evaluationEndDate = weekMode === 'current' 
    ? previousWeekEnd // Final de la semana anterior
    : weekEnd; // Final de la semana actual
    

  // Debug para entender las fechas


  const weeks = [];
  let currentMonday = getIsoMonday(signDate);
  
  // Generar semanas solo hasta que el lunes exceda la fecha de evaluación
  while (currentMonday <= evaluationEndDate) {
    const end = new Date(currentMonday);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    // Solo agregar la semana si su domingo no excede la fecha límite
    if (end <= evaluationEndDate) {
      weeks.push({ monday: new Date(currentMonday), sunday: end });
    }
    
    // Avanzar al siguiente lunes
    currentMonday.setDate(currentMonday.getDate() + 7);
  }



  let surplusAccumulated = 0;
  let weeksWithoutPayment = 0;

  for (let i = 0; i < weeks.length; i++) {
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
    
    
    // ✅ CORRECCIÓN: La semana de firma (i=0) nunca cuenta como falta
    // La semana 0 no se paga, por lo que no debe contar para VDO
    if (i === 0) {
      // Semana de firma - no cuenta para VDO, pero sí puede crear sobrepago
      // Cualquier pago en la semana 0 es sobrepago completo
      if (weeklyPaid > 0) {
        surplusAccumulated = weeklyPaid; // Todo el pago es sobrepago
      }
      
      
      continue;
    }


    // ✅ CORRECCIÓN: El sobrepago se acumula, pero el déficit no se arrastra entre semanas
    const totalAvailableForWeek = surplusAccumulated + weeklyPaid;
    const isWeekCovered = totalAvailableForWeek >= expectedWeeklyPayment;
    
    
    if (!isWeekCovered) weeksWithoutPayment++;
    
    // Actualizar el sobrepago acumulado
    // Solo se acumula sobrepago positivo, no déficit
    if (totalAvailableForWeek > expectedWeeklyPayment) {
      surplusAccumulated = totalAvailableForWeek - expectedWeeklyPayment;
    } else {
      surplusAccumulated = 0; // No arrastrar déficit
    }
  }

  // Calcular deuda total pendiente
  const totalDebt = loan.requestedAmount ? toNumber(loan.requestedAmount) * (1 + toNumber(loan.loantype?.rate || 0)) : 0;
  let totalPaid = 0;
  for (const p of loan.payments || []) {
    totalPaid += toNumber(p.amount);
  }
  const pendingAmount = Math.max(0, totalDebt - totalPaid);
  
  // El PAGO VDO no puede ser mayor a la deuda total pendiente
  const arrearsAmount = Math.min(weeksWithoutPayment * expectedWeeklyPayment, pendingAmount);
  return { 
    expectedWeeklyPayment, 
    weeksWithoutPayment, 
    arrearsAmount,
    partialPayment: Math.max(0, surplusAccumulated) // Abono parcial = sobrepago disponible
  };
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


