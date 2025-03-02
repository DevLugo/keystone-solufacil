export const calculatePaymentProfitAmount = async (
    paymentAmount: number,
    totalProfit: number,
    totalAmountToPay: number,
    requestedAmount: number,
    loanPayedAmount: number,
) => {
    const remainingLoanAmount = totalAmountToPay - loanPayedAmount;

    let profitAmount = 0;
    let returnToCapital = 0;

    if (remainingLoanAmount <= 0) {
        // Si el préstamo ya se ha pagado, todo el pago se considera retorno de capital
        returnToCapital = paymentAmount;
        profitAmount = 0;
    } else if (paymentAmount > remainingLoanAmount) {
        // Si el pago es mayor que la deuda pendiente, el profitAmount es igual a la deuda pendiente
        profitAmount = remainingLoanAmount * (totalProfit / totalAmountToPay);
        returnToCapital = paymentAmount - profitAmount;
    } else {
        // Ajuste para manejar correctamente el caso en el que el paymentAmount es menor que el remainingLoanAmount
        //const expectedReturnToCapital = (requestedAmount / totalAmountToPay) * paymentAmount;
        profitAmount = paymentAmount * (totalProfit / totalAmountToPay);
        returnToCapital = paymentAmount - profitAmount;
    }

    return {
        returnToCapital: parseFloat(returnToCapital.toFixed(2)),
        profitAmount: parseFloat(profitAmount.toFixed(2)),
    };
};