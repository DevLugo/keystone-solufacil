interface LoanCalculationParams {
  requestedAmount: string;
  pendingAmount: string;
  rate: string;
}

export const calculateLoanAmounts = ({ requestedAmount, pendingAmount, rate }: LoanCalculationParams) => {
  const requestedAmountNum = parseFloat(requestedAmount) || 0;
  const pendingAmountNum = parseFloat(pendingAmount) || 0;
  const rateNum = parseFloat(rate) || 0;

  // Calcular el monto entregado (monto solicitado - deuda pendiente)
  const amountGived = (requestedAmountNum - pendingAmountNum).toFixed(2);

  // Calcular el monto a pagar (monto solicitado * (1 + tasa))
  const amountToPay = (requestedAmountNum * (1 + rateNum)).toFixed(2);
  
  // totalDebtAcquired es lo mismo que amountToPay para préstamos nuevos
  const totalDebtAcquired = amountToPay;

  return {
    amountGived,
    amountToPay,
    totalDebtAcquired
  };
};

// OPTIMIZADO: Calcular amountToPay sin consultas a la DB
export const calculateAmountToPay = (requestedAmount: string, rate: string): string => {
  const requestedAmountNum = parseFloat(requestedAmount) || 0;
  const rateNum = parseFloat(rate) || 0;
  return (requestedAmountNum * (1 + rateNum)).toFixed(2);
};

// OPTIMIZADO: Calcular pendingAmount simple (puede ser mejorado con lógica de negocio)
export const calculatePendingAmountSimple = (previousLoanData?: any): string => {
  // Por ahora simplificado - en el futuro se puede mejorar con lógica específica
  if (!previousLoanData) return '0';
  
  // Lógica simplificada basada en datos disponibles
  const requestedAmount = parseFloat(previousLoanData.requestedAmount) || 0;
  const rate = parseFloat(previousLoanData.loantype?.rate) || 0;
  
  // Asumir que el pending es el 50% del monto total (simplificación)
  // En el futuro esto debería usar datos reales de pagos
  return ((requestedAmount * (1 + rate)) * 0.5).toFixed(2);
};

// OPTIMIZADO: Calcular weeklyPaymentAmount sin consultas a la DB
export const calculateWeeklyPaymentAmount = (requestedAmount: string, rate: string, weekDuration: number): string => {
  const requestedAmountNum = parseFloat(requestedAmount) || 0;
  const rateNum = parseFloat(rate) || 0;
  
  if (weekDuration <= 0) return '0';
  
  const totalAmountToPay = requestedAmountNum * (1 + rateNum);
  const weeklyPayment = totalAmountToPay / weekDuration;
  
  return weeklyPayment.toFixed(2);
};

// OPTIMIZADO: Procesar lista de préstamos con cálculos locales
export const processLoansWithCalculations = (loans: any[]) => {
  return loans.map(loan => ({
    ...loan,
    amountToPay: loan.loantype?.rate ? 
      calculateAmountToPay(loan.requestedAmount, loan.loantype.rate) : 
      '0',
    pendingAmount: calculatePendingAmountSimple(loan),
    weeklyPaymentAmount: loan.loantype?.rate && loan.loantype?.weekDuration ? 
      calculateWeeklyPaymentAmount(loan.requestedAmount, loan.loantype.rate, loan.loantype.weekDuration) : 
      '0'
  }));
}; 