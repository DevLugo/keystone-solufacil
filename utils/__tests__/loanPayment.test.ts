import { calculatePaymentProfitAmount } from "../loanPayment";
import '@testing-library/jest-dom';

describe('LoanPayment Tests', () => {
    const testCases = [
        {
            input: {
                paymentAmount: 4200,
                totalProfit: 1200,
                totalAmountToPay: 4200,
                requestedAmount: 3000,
                loanPayedAmount: 0
            }, 
            output: {
                returnToCapital: 3000,
                profitAmount: 1200
            }
        },
        {
            input: {
                paymentAmount: 2100,
                totalProfit: 1200,
                totalAmountToPay: 4200,
                requestedAmount: 3000,
                loanPayedAmount: 2100
            }, 
            output: {
                returnToCapital: 1500,
                profitAmount: 600
            }
        },
        {
            input: {
                paymentAmount: 400,
                totalProfit: 1200,
                totalAmountToPay: 4200,
                requestedAmount: 3000,
                loanPayedAmount: 3900
            }, 
            output: {
                returnToCapital: 314.29,
                profitAmount: 85.71
            }
        },
        {
            input: {
                paymentAmount: 300,
                totalProfit: 1200,
                totalAmountToPay: 4200,
                requestedAmount: 3000,
                loanPayedAmount: 0
            }, 
            output: {
                returnToCapital: 214.29,
                profitAmount: 85.71
            }
        },
        {
            input: {
                paymentAmount: 300,
                totalProfit: 1200,
                totalAmountToPay: 4200,
                requestedAmount: 3000,
                loanPayedAmount: 2650
            }, 
            output: {
                returnToCapital: 214.29,
                profitAmount: 85.71
            }
        },
        {
            input: {
                paymentAmount: 300,
                totalProfit: 1542.90,
                totalAmountToPay: 4200,
                requestedAmount: 3000,
                loanPayedAmount: 0
            }, 
            output: {
                returnToCapital: 189.79,
                profitAmount: 110.21
            }
        },
        {
            input: {
                paymentAmount: 1550,
                totalProfit: 1542.90,
                totalAmountToPay: 4200,
                requestedAmount: 3000,
                loanPayedAmount: 1550
            }, 
            output: {
                returnToCapital: 980.6,
                profitAmount: 569.4
            }
        },
        {
            input: {
                paymentAmount: 0,
                totalProfit: 1542.90,
                totalAmountToPay: 4200,
                requestedAmount: 3000,
                loanPayedAmount: 1550
            }, 
            output: {
                returnToCapital: 0,
                profitAmount: 0
            }
        }
    ];

    testCases.forEach(({ input, output }) => {
        test(`calculatePaymentProfitAmount(${input.paymentAmount}, ${input.totalProfit}) should return ${output}`, async () => {
            const result = await calculatePaymentProfitAmount(
                input.paymentAmount,
                input.totalProfit,
                input.totalAmountToPay,
                input.requestedAmount,
                input.loanPayedAmount
            );
            expect(result).toEqual(output);
        });
    });

    //generate 6 payments and the sum the returnToCapital and profitAmount should be equal to the paymentAmount
    test(`calculatePaymentProfitAmount(${2100}, ${1200}) should return ${2100}`, async () => {
        const paymentAmounts = [250.00, 300, 300, 300, 300, 300, 300, 300, 300, 1550];
        let totalProfit = 1542.90;
        let totalAmountToPay = 4200;
        let requestedAmount = 3000;

        let latestPayedAmount = 0;
        let latestTotalReturnToCapital = 0;
        let latestTotalProfitAmount = 0;


        for (const paymentAmount of paymentAmounts) {
            const { returnToCapital, profitAmount } = await calculatePaymentProfitAmount(
                paymentAmount,
                totalProfit,
                totalAmountToPay,
                requestedAmount,
                latestPayedAmount
            );
            console.log("returnToCapital", returnToCapital);
            console.log("profitAmount", profitAmount);
            latestTotalReturnToCapital += returnToCapital;
            latestTotalProfitAmount += profitAmount;
            latestPayedAmount += paymentAmount;
            console.log("latestTotalReturnToCapital", latestTotalReturnToCapital);
            console.log("latestTotalProfitAmount", latestTotalProfitAmount);
        }

        expect(latestTotalReturnToCapital + latestTotalProfitAmount).toBeCloseTo(4200, 2);

        
    });
});
