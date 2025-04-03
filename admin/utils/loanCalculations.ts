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

  return {
    amountGived,
    amountToPay
  };
}; 