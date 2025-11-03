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


// ========== FUNCIONES DE CÁLCULO DE PROFIT Y RETURN TO CAPITAL ==========

export interface ProfitCalculationParams {
    paymentAmount: number;
    requestedAmount: number;
    interestRate: number;
    badDebtDate?: Date | null;
    paymentDate: Date;
    profitPendingFromPreviousLoan?: number;
}

export interface ProfitCalculationResult {
    profitAmount: number;
    returnToCapital: number;
}

/**
 * Calcula el profitAmount y returnToCapital para un pago de préstamo
 * @param params Parámetros del cálculo
 * @returns Objeto con profitAmount y returnToCapital calculados
 */
export const calculateProfitAndReturnToCapital = (params: ProfitCalculationParams): ProfitCalculationResult => {
    const {
        paymentAmount,
        requestedAmount,
        interestRate,
        badDebtDate,
        paymentDate,
        profitPendingFromPreviousLoan = 0
    } = params;

    // Si hay fecha de mala deuda y el pago es después de esa fecha, todo va a profit
    if (badDebtDate && paymentDate > badDebtDate) {
        return {
            profitAmount: paymentAmount,
            returnToCapital: 0
        };
    }

    // Calcular el profit base del préstamo actual
    const baseProfit = Number(requestedAmount) * (interestRate || 0);
    
    // Profit total incluyendo el pendiente del préstamo anterior (para renovaciones)
    const totalProfit = baseProfit + (profitPendingFromPreviousLoan || 0);
    
    // Monto total a pagar (capital + profit)
    const totalAmountToPay = Number(requestedAmount) + baseProfit;
    
    // Calcular profitAmount proporcional al pago
    const profitAmount = (paymentAmount * totalProfit) / totalAmountToPay;
    
    // El resto va a capital
    const returnToCapital = paymentAmount - profitAmount;

    return {
        profitAmount: Math.max(0, profitAmount), // Asegurar que no sea negativo
        returnToCapital: Math.max(0, returnToCapital) // Asegurar que no sea negativo
    };
};