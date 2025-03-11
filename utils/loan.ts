import { prisma } from "../keystone";

export const calculatePendingProfitAmount = async (loanId: string) => {
    const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: { loantype: true},
    });
    const loanType = loan?.loantype;
    if (loan && loanType) {
        /* console.log("////////////LOANTYPE///////////", loanType); */
        const payments = await prisma.loanPayment.findMany({
            where: { loan: { id: { equals: loanId } } },
            include: {
                transactions: true,
            }
        });
        payments.forEach(payment => {
            payment.transactions.forEach(transaction => {
                if(transaction?.amount && parseFloat(transaction.amount.toString()) > 0)
                    console.log("////////////TRANSACTION///////////", payment.amount, transaction.profitAmount);
            });
        });
        console.log("////////////PAYMENTS///////////", payments.length);

        //const totalAmountToPay = parseFloat(loan.amountToPay);
        const amountRequested = parseFloat(loan.requestedAmount.toString());
        console.log("////////////AMOUNT GIVEN///////////", amountRequested);
        const rate = loanType.rate ? parseFloat(loanType.rate.toString()) : 0;
        console.log("////////////RATE///////////", rate);
        
        const profitFromCurrentLoan = loan.profitAmount ? parseFloat(loan.profitAmount.toString()) : 0;
        
        const earnedProfitAmount = payments.reduce((sum, payment) => {
            const profitAmount = payment.transactions.reduce((sum, transaction) => {
                return sum + parseFloat(transaction.profitAmount ? transaction.profitAmount.toString() : "0");
            }, 0);
            //return sum + parseFloat(profitAmount ? profitAmount.toString() : "0");
            return sum + parseFloat(profitAmount.toFixed(2)); // Redondear a 2 decimales

        }, 0);
        console.log("////////////TOTAL PROFIT///////////", profitFromCurrentLoan, earnedProfitAmount, profitFromCurrentLoan);
        //return profitFromCurrentLoan - earnedProfitAmount;
        const pendingProfit = profitFromCurrentLoan - earnedProfitAmount;
        return parseFloat(pendingProfit.toFixed(2)); // Redondear a 2 decimales
    }
    return 0;
}

export const calculateLoanProfitAmount = async (loanId: string) => {
    const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: { loantype: true, previousLoan: true },
    });
    const loanType = loan?.loantype;
    if (loan && loanType) {
        
        const amountRequested = parseFloat(loan.requestedAmount.toString());
        const rate = loanType.rate ? parseFloat(loanType.rate.toString()) : 0;
        const pendingProfitFromPreviousLoan = loan.previousLoan? await calculatePendingProfitAmount(loan.previousLoan.id) : 0;
        const profitFromCurrentLoan = amountRequested * rate;
        const totalProfit = pendingProfitFromPreviousLoan + profitFromCurrentLoan;
        
        return totalProfit;
    }
    return 0;
};
