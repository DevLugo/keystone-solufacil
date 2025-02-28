import { graphql, list } from '@keystone-6/core';
import { allowAll } from '@keystone-6/core/access';
import { text, password, timestamp, relationship, decimal, integer, select, virtual } from '@keystone-6/core/fields';
import { equal } from 'node:assert';
import { prisma } from './keystone';
import { calculateLoanProfitAmount, calculatePendingProfitAmount } from './utils/loan';

export const User = list({
  access: allowAll,
  fields: {
    name: text({ defaultValue: '' }),
    email: text({ isIndexed: 'unique', defaultValue: '' }),
    password: password(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
  }
});

export const Route = list({
  access: allowAll,
  fields: {
    name: text(),
    employees: relationship({ ref: 'Employee.routes', many: true }), // si
    localities: relationship({ ref: 'Location.route', many: true }),
    account: relationship({ ref: 'Account.route' }),
  }
});

export const Location = list({
  access: allowAll,
  fields: {
    name: text({ isIndexed: 'unique' }),
    municipality: relationship({ ref: 'Municipality.location' }),
    route: relationship({ ref: 'Route.localities' }),
    addresses: relationship({ ref: 'Address.location', many: true }),

  }
});

export const State = list({
  access: allowAll,
  fields: {
    name: text(),
    municipalities: relationship({ ref: 'Municipality.state', many: true }),
  }
});

export const Municipality = list({
  access: allowAll,
  fields: {
    name: text(),
    state: relationship({ ref: 'State.municipalities' }),
    location: relationship({ ref: 'Location.municipality', many: true }),
  }
});

export const Employee = list({
  access: allowAll,
  fields: {
    oldId: text({ db: { isNullable: true }, isIndexed: 'unique' }),
    routes: relationship({
      ref: 'Route.employees',
      many: false,
    }),
    //expenses: relationship({ ref: 'Expense.employee', many: true }), // Agrego esta línea
    transactions: relationship({ ref: 'Transaction.lead', many: true }),
    //comissionPaymentConfigurationLead: relationship({ ref: 'ComissionPaymentConfiguration.leadId' }),
    personalData: relationship({ ref: 'PersonalData.employee' }),
    loan: relationship({ ref: 'Loan.grantor', many: true }),
    //loanPayment: relationship({ ref: 'LoanPayment.collector', many: true }),
    commissionPayment: relationship({ ref: 'CommissionPayment.employee', many: true }),
    LeadManagedLoans: relationship({ ref: 'Loan.lead', many: true }),
    LeadPaymentReceivedLead: relationship({ ref: 'LeadPaymentReceived.lead', many: true }),
    leadPaymentsReceivedAgent: relationship({ ref: 'LeadPaymentReceived.agent', many: true }),
    type: select({
      options: [
        { label: 'LIDER DE RUTA', value: 'ROUTE_LEAD' },
        { label: 'LIDER DE CREDITOS', value: 'LEAD' },
        { label: 'ASISTENTE DE RUTA', value: 'ROUTE_ASSISTENT' },
      ],
    }),
  },
});

/* export const Expense = list({
  access: allowAll,
  fields: {
    amountToPay: decimal(),
    dueDate: timestamp(),
    payedAt: timestamp(),
    employee: relationship({ ref: 'Employee.expenses' }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    userId: text(),
  },
  hooks: {
    afterOperation: async ({ operation, item, context }) => {

    }
  }
}); */

/* export const ComissionPaymentConfiguration = list({
  access: allowAll,
  fields: {
    amount: decimal(),
    loanType: relationship({ ref: 'Loantype.comissionPaymentConfiguration' }),
    leadId: relationship({ ref: 'Employee.comissionPaymentConfigurationLead' }),
  }
}); */

export const Loantype = list({
  access: allowAll,
  db: {
    idField: { kind: 'cuid' }, // Usa db.idField para definir el campo id
  },
  fields: {
    name: text(),
    weekDuration: integer(),
    rate: decimal(),  // Decimal type used for percentage, adjust precision as necessary
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    loan: relationship({
      ref: 'Loan.loantype', many: true, ui: {
        hideCreate: true,
      }
    }),
    //comissionPaymentConfiguration: relationship({ ref: 'ComissionPaymentConfiguration.loanType', many: true }),
  }
});

// Additional models, like Phone, Address, Borrower, PersonalData, Loan, LoanPayment, Transaction, CommissionPayment, 
// and enums like EmployeesTypes, AccountType, TransactionType, TransactionIncomeSource, and TransactionExpenseSource 
// should be defined in a similar detailed manner based on the fields and relationships specified in the Prisma schema.

// Due to the complexity and length, consider breaking down into multiple files or modules if needed for maintainability.

// ... (resto del código)

export const Phone = list({
  access: allowAll,
  fields: {
    number: text(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    personalData: relationship({ ref: 'PersonalData.phones' }),
  },
});

export const Address = list({
  access: allowAll,
  fields: {
    street: text(),
    exteriorNumber: text(),
    interiorNumber: text(),
    postalCode: text(),
    references: text(),
    location: relationship({ ref: 'Location.addresses' }), // Cambio aquí
    personalData: relationship({ ref: 'PersonalData.addresses' }),
  },
});

export const Borrower = list({
  access: allowAll,
  fields: {
    personalData: relationship({ ref: 'PersonalData.borrower' }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    loanFinishedCount: integer({ defaultValue: 0 }),
    loans: relationship({ ref: 'Loan.borrower', many: true }),
    fullName: virtual({
      isFilterable: true,
      field: graphql.field({
        type: graphql.String,
        resolve: async (item, args, context) => {
          console.log("////////////ITEM///////////", item);
          /* const borrower = await context.db.Borrower.findOne({
            where: { id: {equal:(item as { id: string }).id }
            },
          });
          console.log("////////////BORROWER///////////", borrower);
          
          if(borrower === null){
            return "";
          } */
          const personalData = await context.db.PersonalData.findMany({
            where: {
              id: {
                equals: (item as { personalDataId: string }).personalDataId,
              }
            },
          });

          if (personalData.length === 0) {
            return "";
          }
          return personalData[0]?.fullName;
        },
      }),
    }),
  },
  ui: {
    listView: {
      initialColumns: ['fullName', 'id'],
    },
  }
});

export const PersonalData = list({
  access: allowAll,
  graphql: {
    plural: 'PersonalDatas',
  },
  fields: {
    fullName: text(),
    phones: relationship({ ref: 'Phone.personalData', many: true }),
    addresses: relationship({ ref: 'Address.personalData', many: true }),
    birthDate: timestamp(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    employee: relationship({ ref: 'Employee.personalData' }),
    borrower: relationship({ ref: 'Borrower.personalData' }),
  },
});

export const Loan = list({
  access: allowAll,
  db: {
    idField: { kind: 'cuid' }, // Usa db.idField para definir el campo id
  },
  fields: {
    oldId: text({ db: { isNullable: true }, isIndexed: 'unique', isFilterable: true }),
    payments: relationship({
      ref: 'LoanPayment.loan',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['amount'],
        inlineEdit: { fields: ['amount'] },
        linkToItem: true,
        inlineCreate: { fields: ['amount'] },
      },
    }),
    requestedAmount: decimal({
      precision: 10,
      scale: 2,
      validation: {
        isRequired: true,
      }
    }),
    amountGived: decimal({
      precision: 10,
      scale: 2,
      validation: {
        isRequired: true,
      }
    }),
    loantype: relationship({ ref: 'Loantype.loan' }),
    signDate: timestamp({ defaultValue: { kind: 'now' }, validation: { isRequired: true } }),
    badDebtDate: timestamp({ validation: { isRequired: false } }),
    profitAmount: decimal(
      {
        precision: 10,
        scale: 2,
        validation: { isRequired: false },
      }),
    avalName: text(),
    avalPhone: text(),
    grantor: relationship({ ref: 'Employee.loan' }),

    transactions: relationship({ ref: 'Transaction.loan', many: true }),
    lead: relationship({ ref: 'Employee.LeadManagedLoans' }),
    borrower: relationship({
      ref: 'Borrower.loans',
    }),
    previousLoan: relationship({ ref: 'Loan' }), // Agrego esta línea
    commissionPayment: relationship({ ref: 'CommissionPayment.loan', many: true }),

    comissionAmount: decimal(),
    finishedDate: timestamp({ validation: { isRequired: false } }),
    updatedAt: timestamp(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    // ((deuda pendoiente * % del prestamo ) / 10 )+ 
    pendingProfitAmount: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          return await calculatePendingProfitAmount((item as { id: string }).id.toString());
        }
      }),
    }),
    earnedProfit: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const loan = await prisma.loan.findUnique({
            where: { id: (item as { id: string }).id.toString() },
          });
          console.log("////////////LOAN///////////", loan);
          if (loan) {
            const payments = await prisma.loanPayment.findMany({
              where: { loan: { id: { equals: (item as { id: string }).id.toString() } } },
              include: {
                transactions: true,
              }
            });
            let profitAmount = 0;
            profitAmount =  payments.reduce((sum, payment) => {
              const transactionProfit = payment.transactions.reduce((transactionSum, transaction) => {
                return transactionSum + parseFloat(transaction.profitAmount ? transaction.profitAmount.toString() : "0");
              }, 0);
              return sum + transactionProfit;
            }, 0);
            console.log("payments", payments.length, profitAmount);
            return profitAmount;
          }
        },
      }),
    }),
    //virtual fields
    totalPayedAmount: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const payments = await context.db.LoanPayment.findMany({
            where: { loan: { id: { equals: (item as { id: string }).id } } },
          });
          return payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        },
      }),
    }),
    pendingAmount: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const payments = await context.db.LoanPayment.findMany({
            where: { loan: { id: { equals: (item as { id: string }).id } } },
          });
          const loan = await context.db.Loan.findOne({
            where: { id: (item as { id: string }).id.toString() },
          });
          const loanType = await context.db.Loantype.findOne({
            where: { id: loan?.loantypeId as string },
          });
          const rate = parseFloat(loanType.rate);
          const totalAmountToPay = parseFloat(loan.requestedAmount.toString()) * (1 + rate);
          const payedAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
          return (totalAmountToPay - payedAmount);
        },
      }),
    }),
    weeklyPaymentAmount: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const loan = await prisma.loan.findFirst({
            where: { id: (item as { id: string }).id.toString() },
            include: { loantype: true },
          });
          const loanType = loan?.loantype;
          if (loan && loanType) {
            const rate = loanType ? parseFloat(loanType.rate!.toString()) : 0;
            const totalAmountToPay = parseFloat(loan.requestedAmount.toString()) * (1 + rate);
            const amountGiven = parseFloat(loan.amountGived);
            const totalProfit = amountGiven * rate;
            /* console.log("////////////LOANTYPE///////////", loan, totalAmountToPay, totalProfit, loanType.weekDuration); */
            return (totalAmountToPay / loanType.weekDuration);
          } else {

          }

        },
      }),
    }),
    amountToPay: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const loan = await context.db.Loan.findOne({
            where: { id: (item as { id: string }).id.toString() },
          });
          const loanType = await context.db.Loantype.findOne({
            where: { id: loan?.loantypeId as string },
          });
          const rate = parseFloat(loanType.rate);
          const totalAmountToPay = loan.requestedAmount * (1 + rate);
          return totalAmountToPay;
        },
      }),
    }),
    status: select({
      options: [
        { label: 'ACTIVO', value: 'ACTIVE' },
        { label: 'FINALIZADO', value: 'FINISHED' },
        { label: 'RENOVADO', value: 'RENOVATED' },
        { label: 'CANCELADO', value: 'CANCELED' },
      ],
    }),
  },
  hooks: {
    afterOperation: async ({ operation, item, context, originalItem }) => {

      if ((operation === 'create' || operation === 'update') && item) {
        const loan = await prisma.loan.findFirst({
          where: { id: item.id.toString() },
          include: {
            loantype: true,
            previousLoan: true,
          }
        });

        console.log("////////////LOAN///////////", loan);
        const leadId: string = item.leadId as string;
        if (leadId === null) {
          return;
        }
        const lead = await context.db.Employee.findOne({
          where: { id: leadId },
        });
        console.log("////////////LEAD///////////", item, lead);
        // si status es igual a finalizado/renavado/cancelado, entonces se setea la fecha de termino
        if (item.status === 'FINISHED' || item.status === 'RENOVATED' || item.status === 'CANCELED') {
          context.db.Loan.updateOne({
            where: { id: item.id.toString() },
            data: { finishedDate: new Date() },
          })
        }
        console.log("////////////LEAD1///////////",);


        const account = await context.db.Account.findMany({
          where: { route: { id: lead?.routeId } },
        });

        console.log("////////////LEAD2///////////", account);
        if (operation === 'create') {
          // TODO:update the existing transaction on the update/delete action
          const transactions = await context.db.Transaction.createMany({
            data: [
              {
                amount: item.amountGived,
                date: item.signDate,
                type: 'EXPENSE',
                expenseSource: 'LOAN_GRANTED',
                sourceAccount: { connect: { id: account[0].id } },
                loan: { connect: { id: item.id } },
              },
              {
                amount: item.comissionAmount,
                date: item.signDate,
                type: 'EXPENSE',
                expenseSource: 'LOAN_GRANTED_COMISSION',
                sourceAccount: { connect: { id: account[0].id } },
                loan: { connect: { id: item.id } },
              }
            ]
          });
        };
        console.log("////////////originalItem///////////", originalItem, item);
        
        const totalProfitAmount = await calculateLoanProfitAmount(loan?.id as string);
        const previosLoanProfitAmount = await calculatePendingProfitAmount(loan?.previousLoanId as string);
        await prisma.loan.update({
          where: { id: item.id.toString() },
          data: { profitAmount: totalProfitAmount },
        });
        // Trigger afterOperation hook for LoanPayment
        if (originalItem && originalItem.loantypeId !== item.loantypeId) {
          // Trigger afterOperation hook for LoanPayment
          const payments = await context.db.LoanPayment.findMany({
            where: { loan: { id: { equals: item.id.toString() } } },
          });

          for (const payment of payments) {
            await context.db.LoanPayment.updateOne({
              where: { id: payment.id as string },
              data: { updatedAt: new Date() }, // Trigger the afterOperation hook
            });
          }
        }

      }
    },
  },
  ui: {
    listView: {
      initialColumns: ['totalPayments', 'signDate', 'payments', 'oldId'],
    },
  },

});

/* export const Profit = list({
  access: allowAll,
  fields: {
    amount: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }),
    returnToCapital: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }),
    loan: relationship({ ref: 'Loan.profit' }),
    loanPayment: relationship({ ref: 'LoanPayment.profit' }),
  },
});
 */
export const LoanPayment = list({
  access: allowAll,
  fields: {
    amount: decimal({
      precision: 10,
      scale: 2,
    }),
    comission: decimal(),
    /* profitAmount: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }), */
    /* returnToCapital: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }), */
    receivedAt: timestamp({ defaultValue: { kind: 'now' } }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    oldLoanId: text({ db: { isNullable: true } }),
    loan: relationship({ ref: 'Loan.payments' }),
    //collector: relationship({ ref: 'Employee.loanPayment' }),
    transactions: relationship({ ref: 'Transaction.loanPayment', many: true }),
    //transactionId: text({ isIndexed: 'unique' }),
    type: select({
      options: [
        { label: 'ABONO', value: 'PAYMENT' },
        { label: 'SIN PAGO', value: 'NO_PAYMENT' },
        { label: 'FALCO', value: 'FALCO' },
        { label: 'EXTRA COBRANZA', value: 'EXTRA_COLLECTION' },
      ],
    }),
    leadPaymentReceived: relationship({ ref: 'LeadPaymentReceived.payments' }),
    paymentMethod: select({
      options: [
        { label: 'EFECTIVO', value: 'CASH' },
        { label: 'TRANSFERENCIA', value: 'MONEY_TRANSFER' },
      ],
    }),
    /* profit: relationship({ ref: 'Profit.loanPayment' }), */
  },
  hooks: {
    /* resolveInput: async ({ resolvedData, context, item, inputData, listKey }) => {
      if (resolvedData.amount || resolvedData.loanId) {
        console.log("1111111", item);
        const loanId = item?.loanId || resolvedData.loanId;
        console.log("11111112")
        if(loanId === null){
          throw new Error("No hay Credito asociado a este pago");
        }
        console.log("11111113")
        const loan = await context.db.Loan.findOne({
          where: { id: loanId.toString() },
        });
        console.log("11111114")

        const loanType = await context.db.Loantype.findOne({
          where: { id: loan?.loantypeId },
        });
        console.log("////////////LOANTYPE///////////", loan);

        const totalAmountToPay = parseFloat(loan.amountToPay);
        const amountGiven = parseFloat(loan.amountGived);
        const rate = parseFloat(loanType.rate);
        const totalProfit = amountGiven * rate;

        // Calculate profit for the current payment
        const paymentAmount = parseFloat(resolvedData.amount || existingItem.amount);
        const paymentProfit = (paymentAmount * totalProfit) / totalAmountToPay;

        resolvedData.profitAmount = paymentProfit.toString();
        resolvedData.returnToCapital = (paymentAmount - paymentProfit).toString();
      }
      console.log("////////////RESOLVED DATA///////////", resolvedData);
      return resolvedData;
    }, */
    afterOperation: async ({ operation, item, context, resolvedData, originalItem }) => {
      if (context.skipAfterOperation) {
        return;
      }
      //context.skipAfterOperation = true;

      console.log("////////////AFTER OPERATION1///////////", operation);
      if ((operation === 'create' || operation === 'update') && item) {

        if (item.type !== 'WITHOUT_PAYMENT') {
          //calculate the profit amount of the payment

          //calculate pending profit and earned profit
          const payment = await context.db.LoanPayment.findOne({
            where: { id: item.id as string },
          });
          if (payment?.loanId === null)
            throw new Error("No hay Credito asociado a este pago");
          const loan = await prisma.loan.findUnique({
            where: { id: payment?.loanId as string },
            include: { loantype: true },
          });

          const loanType = loan?.loantype;

          const payments = await context.db.LoanPayment.findMany({
            where: { loan: { id: { equals: payment?.loanId } } },
          });
          if(!loan || !loanType){
            throw new Error("No hay Credito asociado a este pago");
          }
          const rate = loanType?.rate ? parseFloat(loanType.rate.toString()) : 0;
          const originalProfit = (loan?.requestedAmount.toNumber() || 0) * rate;
          const totalAmountToPay = (loan?.requestedAmount.toNumber() || 0) + (originalProfit);
          const amountGiven = loan.amountGived.toNumber();
          const totalProfit = loan?.profitAmount?.toNumber() || 0;
          console.log("////////LOAN PROFIT111", rate, originalProfit, loan?.requestedAmount);  
          console.log("////////LOAN PROFIT", totalProfit, totalAmountToPay, originalProfit);
          const totalPayed = payments.reduce((sum, payment) => sum + parseFloat(payment.amount as string), 0);
          console.log("////////TOTAL PAYED", totalPayed);
            const pendingDebt = Math.max(0, totalAmountToPay - totalPayed);
          console.log("////////PENDING DEBT", pendingDebt);
          const pendingProfit = (pendingDebt * totalProfit) / totalAmountToPay;
          console.log(pendingProfit)
          console.log(item.amount);

          let paymentProfit = 0;
          let returnToCapital = 0;

          if (pendingProfit === 0) {
            paymentProfit = parseFloat(item.amount as string);
            returnToCapital = 0;
          } else {
            paymentProfit = (parseFloat(item.amount as string) * totalProfit) / totalAmountToPay;
            returnToCapital = parseFloat(item.amount as string) - paymentProfit;

            // Ajustar returnToCapital si es mayor que el esperado
            const expectedReturnToCapital = (pendingDebt * amountGiven) / totalAmountToPay;
            if (returnToCapital > expectedReturnToCapital) {
              paymentProfit += returnToCapital - expectedReturnToCapital;
              returnToCapital = expectedReturnToCapital;
            }
          }

          resolvedData.profitAmount = paymentProfit.toString();
          resolvedData.returnToCapital = returnToCapital;


          const parsedProfit = isNaN(paymentProfit) ? "0" : paymentProfit.toString();
          console.log("////////////parsedProfit///////////", parsedProfit);
          if (operation === 'create') {
            console.log("////////////22222///////////", item.id, paymentProfit.toString(), (parseFloat(item.amount as string) - paymentProfit).toString());
          } else {
            /* const profits = await context.db.Profit.findMany({
              where: { loanPayment: { id: { equals: item.id as string } } },
            });
            const profit = profits[0];

            await context.db.Profit.updateOne({
              where: {
                id: profit.id as string,
              }, 
              data: 
                {
                  amount: paymentProfit.toString(),
                  returnToCapital: (parseFloat(item.amount as string) - paymentProfit).toString(),
                },
            }); */
          }

          const lead = await context.db.Employee.findOne({
            where: { id: loan?.leadId as string },
          });
          /* console.log("////////////22222///////////", lead); */
          const employeeCashAccounts = await context.db.Account.findMany({
            where: {
              route: {
                id: {
                  equals: lead?.routesId,
                },
              },
              type: {
                equals: 'EMPLOYEE_CASH_FUND',
              },
            },
          });
          const employeeCashAccount = employeeCashAccounts[0];
          /* console.log("////////////222221111///////////", employeeCashAccount); */

          if (employeeCashAccount === null) {
            throw new Error("No hay cuenta de efectivo asociada a este empleado");
          }

          console.log("////////////33333///////////", item.paymentMethod);
          if (item.paymentMethod === 'CASH') {
            console.log("////////////444444///////////");
            try {
              await prisma.transaction.create({
                data: {
                  amount: item.amount as number,
                  date: item.receivedAt as string | Date | null | undefined,
                  type: 'INCOME',
                  incomeSource: 'CASH_LOAN_PAYMENT',
                  destinationAccount: { connect: { id: employeeCashAccount.id.toString() } },
                  loanPayment: { connect: { id: item.id.toString() } },
                  loan: { connect: { id: loan?.id.toString() } },
                  lead: { connect: { id: lead?.id.toString() } },
                  profitAmount: parsedProfit,
                  returnToCapital: returnToCapital,
                },
              });
            } catch (error) {
              console.log("////////////ERROR///////////", error);
            }
          } else {
            console.log("////////////55555///////////");
            const account = await context.db.Account.findMany({
              where: {
                type: {
                  equals: 'BANK',
                  id: lead?.routesId,
                }
              },
            });
            console.log("////////////account///////////", account)
            await context.db.Transaction.createOne({
              data: {
                amount: item.amount,
                date: item.receivedAt,
                type: 'INCOME',
                incomeSource: 'LOAN_PAYMENT',
                destinationAccount: { connect: { id: account[0].id } },
                loanPayment: { connect: { id: item.id } },
                loan: { connect: { id: loan?.id } },
                lead: { connect: { id: lead?.id } },
                profitAmount: parsedProfit,
                returnToCapital: returnToCapital,
              },
            });
          }
          console.log("////////////77777///////////", lead);
          await context.db.Transaction.createOne({
            data: {
              amount: item.comission,
              date: item.receivedAt,
              type: 'EXPENSE',
              expenseSource: 'LOAN_PAYMENT_COMISSION',
              sourceAccount: { connect: { id: employeeCashAccount.id } },
              loanPayment: { connect: { id: item.id } },
              loan: { connect: { id: loan?.id } },
              lead: { connect: { id: lead?.id } },
              createdAt: new Date(),
            },
          });
        }
      }
      context.skipAfterOperation = false;

    },

  }
});

export const Transaction = list({
  access: allowAll,
  fields: {
    amount: decimal(),
    date: timestamp({ defaultValue: { kind: 'now' } }),
    type: select({
      options: [
        { label: 'INCOME', value: 'INCOME' },
        { label: 'EXPENSE', value: 'EXPENSE' },
        { label: 'TRANSFER', value: 'TRANSFER' },
        { label: 'INVESTMENT', value: 'INVESTMENT' },
      ],
    }),
    incomeSource: select({
      options: [
        { label: 'CASH_LOAN_PAYMENT', value: 'CASH_LOAN_PAYMENT' },
        { label: 'BANK_LOAN_PAYMENT', value: 'BANK_LOAN_PAYMENT' },
        { label: 'MONEY_INVESMENT', value: 'MONEY_INVESMENT' },
      ],
    }),
    expenseSource: select({
      options: [
        { label: 'VIATIC', value: 'VIATIC' },
        { label: 'GASOLINE', value: 'GASOLINE' },
        { label: 'ACCOMMODATION', value: 'ACCOMMODATION' },
        { label: 'NOMINA_SALARY', value: 'NOMINA_SALARY' },
        { label: 'EXTERNAL_SALARY', value: 'EXTERNAL_SALARY' },
        { label: 'VEHICULE_MAINTENANCE', value: 'VEHICULE_MAINTENANCE' },
        { label: 'LOAN_GRANTED', value: 'LOAN_GRANTED' },
        { label: 'LOAN_PAYMENT_COMISSION', value: 'LOAN_PAYMENT_COMISSION' },
        { label: 'LOAN_GRANTED_COMISSION', value: 'LOAN_GRANTED_COMISSION' },
        { label: 'LEAD_COMISSION', value: 'LEAD_COMISSION' },
      ],
    }),
    description: text(),
    lead: relationship({ ref: 'Employee.transactions' }),
    sourceAccount: relationship({ ref: 'Account.transactions' }),
    destinationAccount: relationship({ ref: 'Account.receivedTransactions' }),
    loan: relationship({ ref: 'Loan.transactions' }),
    loanPayment: relationship({ ref: 'LoanPayment.transactions' }),
    profitAmount: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }),
    returnToCapital: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
  },
  hooks: {
    afterOperation: async ({ operation, item, context }) => {
      if ((operation === 'create' || operation === 'update') && item) {
        if (item.type === 'EXPENSE') {
          const sourceAccount = await context.db.Account.findOne({
            where: { id: item.sourceAccountId as string },
          });

          let destinationAccount = null;
          if (destinationAccount) {
            destinationAccount = await context.db.Account.findOne({
              where: { id: item.destinationAccountId as string },
            });
          }

          if (sourceAccount) {
            const newAmount = (sourceAccount.amount as number) - (item.amount as number);
            await context.db.Account.updateOne({
              where: { id: sourceAccount.id as string },
              data: { amount: newAmount.toString() },
            });
          }

          if (destinationAccount) {
            destinationAccount.amount = (destinationAccount.amount as number) + (item.amount as number);
            await context.db.Account.updateOne({
              where: { id: destinationAccount.id as string },
              data: { amount: destinationAccount.toString() },
            });
          }
        } else if (item.type === 'INCOME') {
          const destinationAccount = await context.db.Account.findOne({
            where: { id: item.destinationAccountId as string },
          });
          if (destinationAccount) {
            const newAmount = parseFloat(destinationAccount.amount as string) + parseFloat(item.amount as string);

            await context.db.Account.updateOne({
              where: { id: destinationAccount.id as string },
              data: { amount: newAmount.toString() },
            });
          }
        }
      }
    }
  }
});

export const CommissionPayment = list({
  access: allowAll,
  fields: {
    amount: decimal(),
    loan: relationship({ ref: 'Loan.commissionPayment' }),
    employee: relationship({ ref: 'Employee.commissionPayment' }),
  },
});


export const LeadPaymentType = list({
  access: allowAll,
  fields: {
    type: select({
      options: [
        { label: 'PENDING_MONEY', value: 'PENDING_MONEY' },
        { label: 'COMPENSATORY_PENDING_MONEY', value: 'COMPENSATORY_PENDING_MONEY' },
      ],
    }),
  },
});

export const FalcoCompensatoryPayment = list({
  access: allowAll,
  fields: {
    amount: decimal(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    leadPaymentReceived: relationship({ ref: 'LeadPaymentReceived.falcoCompensatoryPayments' }),
  },
});

export const LeadPaymentReceived = list({
  access: allowAll,
  fields: {
    expectedAmount: decimal(),
    paidAmount: decimal(),
    cashPaidAmount: decimal(),
    bankPaidAmount: decimal(), // If bank amount > than 0. Then remove that amount from the cashAccount balance and inser it into the bankAccount balance
    falcoAmount: decimal(),
    paymentStatus: select({
      options: [
        { label: 'COMPLETO', value: 'COMPLETE' },
        { label: 'PARCIAL', value: 'PARTIAL' },
        { label: 'FALCO', value: 'FALCO' },
      ],
    }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    agent: relationship({ ref: 'Employee.leadPaymentsReceivedAgent' }),
    lead: relationship({ ref: 'Employee.LeadPaymentReceivedLead' }),
    falcoCompensatoryPayments: relationship({ ref: 'FalcoCompensatoryPayment.leadPaymentReceived', many: true }),
    payments: relationship({ ref: 'LoanPayment.leadPaymentReceived', many: true }),
  },
  ui: {
    listView: {
      initialColumns: ['expectedAmount', 'paidAmount', 'createdAt'],
      initialSort: {
        field: 'createdAt',
        direction: 'DESC',
      },
    },
  },
});

export const Account = list({
  access: allowAll,
  fields: {
    name: text(),
    type: select({
      options: [
        { label: 'BANK', value: 'BANK' },
        { label: 'OFFICE_CASH_FUND', value: 'OFFICE_CASH_FUND' },
        { label: 'EMPLOYEE_CASH_FUND', value: 'EMPLOYEE_CASH_FUND' },
      ],
    }),
    amount: decimal(),
    transactions: relationship({ ref: 'Transaction.sourceAccount', many: true }),
    receivedTransactions: relationship({ ref: 'Transaction.destinationAccount', many: true }),
    route: relationship({ ref: 'Route.account', isFilterable: true }),
    updatedAt: timestamp(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),

  },
});

export const lists = {
  User,
  Employee,
  Route,
  Location,
  State,
  Municipality,
  /* Profit, */
  /* Expense, */
  //ComissionPaymentConfiguration,
  Loantype,
  Phone,
  Address,
  Borrower,
  PersonalData,
  Loan,
  LoanPayment,
  Transaction,
  CommissionPayment,
  LeadPaymentType,
  FalcoCompensatoryPayment,
  LeadPaymentReceived,
  Account,
};