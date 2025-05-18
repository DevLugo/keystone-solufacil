import { graphql, list } from '@keystone-6/core';
import { allowAll } from '@keystone-6/core/access';
import { text, password, timestamp, relationship, decimal, integer, select, virtual } from '@keystone-6/core/fields';
import { KeystoneContext } from '@keystone-6/core/types';
import { prisma } from './keystone';
import { calculateLoanProfitAmount, calculatePendingProfitAmount } from './utils/loan';
import { calculatePaymentProfitAmount } from './utils/loanPayment';
import { Decimal } from '@prisma/client/runtime/library';

// Función para manejar decimales con precisión
const parseAmount = (value: unknown): number => {
  if (typeof value === 'string') {
    return parseFloat(parseFloat(value).toFixed(2));
  }
  if (typeof value === 'number') {
    return parseFloat(value.toFixed(2));
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return parseFloat(parseFloat(value.toString()).toFixed(2));
  }
  return 0;
};

// Extender el tipo de contexto para incluir skipAfterOperation
interface ExtendedContext extends KeystoneContext {
  transactionsToDelete?: any[];
}

interface LoanType {
  rate: Decimal | null;
  weekDuration: number;
}

interface Loan {
  id: string;
  requestedAmount: Decimal;
  amountGived: Decimal;
  profitAmount: Decimal | null;
  loantype: LoanType | null;
  comissionAmount?: Decimal;
  signDate: Date;
  leadId?: string;
}

interface TransactionItem {
  id: string;
  amount: Decimal | string | number;
  type: string;
  incomeSource?: string;
  expenseSource?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
}

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
    employees: relationship({ ref: 'Employee.routes', many: true }),
    localities: relationship({ ref: 'Location.route', many: true }),
    accounts: relationship({ ref: 'Account.route', many: true })
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
    idField: { kind: 'cuid' },
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
          const pendingProfit = await calculatePendingProfitAmount((item as { id: string }).id.toString());
          // Redondear a 2 decimales
          let roundedPendingProfit = Math.round((pendingProfit + Number.EPSILON) * 100) / 100;
          console.log("////////////PENDING PROFIT///////////", roundedPendingProfit);
          // Si el valor es muy cercano a cero, establecerlo explícitamente a cero
          if (roundedPendingProfit < 0.01) {
            roundedPendingProfit = 0;
          }
          return roundedPendingProfit;
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
            return parseFloat(profitAmount.toFixed(2));
          }
          return 0;
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
          }) as Loan | null;
          
          const loanType = loan?.loantype;
          if (loan && loanType && loanType.weekDuration > 0) {
            const rate = loanType.rate ? parseFloat(loanType.rate.toString()) : 0;
            const totalAmountToPay = loan.requestedAmount.toNumber() * (1 + rate);
            const amountGiven = loan.amountGived.toNumber();
            const totalProfit = amountGiven * rate;
            return totalAmountToPay / loanType.weekDuration;
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
    isLastLoan: virtual({
      ui: {
        query: '{ isLastLoan: true }'
      },
      isFilterable: true,
      field: graphql.field({
        type: graphql.Boolean,
        args: {
          where: graphql.arg({ type: graphql.Boolean })
        },
        resolve: async (item) => {
          
          const loan = await prisma.loan.findUnique({
            where: { id: (item as { id: string }).id.toString() },
          });
          return !loan?.previousLoanId;
        }
      }),
      
    }),
  },
  hooks: {
    beforeOperation: async ({ operation, item, context }) => {
      if (operation === 'delete') {
        // Guardar las transacciones asociadas antes de eliminar el préstamo
        const transactions = await context.prisma.transaction.findMany({
          where: {
            loanId: item.id.toString()
          }
        });
        console.log("////////////TRANSACTIONS-beforeOperation///////////", transactions, operation, item);
        // Almacenar las transacciones en el contexto para usarlas después
        (context as ExtendedContext).transactionsToDelete = transactions;
      }
    },
    afterOperation: async ({ operation, item, context, originalItem }) => {
      console.log("////////////HOOK///////////", operation, item, originalItem);
      if ((operation === 'create' || operation === 'update') && item) {
        const loan = await prisma.loan.findFirst({
          where: { id: item.id.toString() },
          include: {
            loantype: true,
            previousLoan: true,
          }
        });

        const leadId: string = item.leadId as string;
        if (leadId === null) {
          return;
        }
        const lead = await context.db.Employee.findOne({
          where: { id: leadId },
        });

        const account = await context.prisma.account.findFirst({
          where: { 
            routeId: lead?.routesId,
            type: 'EMPLOYEE_CASH_FUND'
          },
        });

        if (operation === 'create') {
          // Crear transacciones de apertura
          const transactions = await context.db.Transaction.createMany({
            data: [
              {
                amount: parseAmount(item.amountGived),
                date: item.signDate,
                type: 'EXPENSE',
                expenseSource: 'LOAN_GRANTED',
                sourceAccount: { connect: { id: account?.id } },
                loan: { connect: { id: item.id } },
                lead: { connect: { id: lead?.id } },
              },
              {
                amount: parseAmount(item.comissionAmount),
                date: item.signDate,
                type: 'EXPENSE',
                expenseSource: 'LOAN_GRANTED_COMISSION',
                sourceAccount: { connect: { id: account?.id } },
                loan: { connect: { id: item.id } },
                lead: { connect: { id: lead?.id } },
              }
            ]
          });

          // Actualizar balance de la cuenta
          if (account) {
            const currentAmount = parseFloat(account.amount.toString());
            const newAmount = currentAmount - parseAmount(item.amountGived) - parseAmount(item.comissionAmount);
            await context.db.Account.updateOne({
              where: { id: account.id },
              data: { amount: newAmount.toString() }
            });
          }
        } else if (operation === 'update') {
          // Actualizar transacciones existentes
          const existingTransactions = await context.db.Transaction.findMany({
            where: {
              loan: { id: { equals: item.id.toString() } },
              type: { equals: 'EXPENSE' },
              OR: [
                { expenseSource: { equals: 'LOAN_GRANTED' } },
                { expenseSource: { equals: 'LOAN_GRANTED_COMISSION' } }
              ]
            }
          });

          for (const transaction of existingTransactions) {
            if (transaction.expenseSource === 'LOAN_GRANTED') {
              await context.db.Transaction.updateOne({
                where: { id: transaction.id.toString() },
                data: {
                  amount: parseAmount(item.amountGived).toString(),
                  date: item.signDate
                }
              });
            } else if (transaction.expenseSource === 'LOAN_GRANTED_COMISSION') {
              await context.db.Transaction.updateOne({
                where: { id: transaction.id.toString() },
                data: {
                  amount: parseAmount(item.comissionAmount).toString(),
                  date: item.signDate
                }
              });
            }
          }

          // Actualizar balance de la cuenta
          if (account) {
            const currentAmount = parseFloat(account.amount.toString());
            const oldAmount = parseAmount(originalItem?.amountGived);
            const oldCommission = parseAmount(originalItem?.comissionAmount);
            const newAmount = parseAmount(item.amountGived);
            const newCommission = parseAmount(item.comissionAmount);
            
            const balanceChange = (oldAmount + oldCommission) - (newAmount + newCommission);
            const updatedAmount = currentAmount + balanceChange;
            
            await context.db.Account.updateOne({
              where: { id: account.id },
              data: { amount: updatedAmount.toString() }
            });
          }
        }

        const totalProfitAmount = await calculateLoanProfitAmount(loan?.id as string);
        await prisma.loan.update({
          where: { id: item.id.toString() },
          data: { profitAmount: totalProfitAmount },
        });

        if (originalItem && originalItem.loantypeId !== item.loantypeId) {
          const payments = await context.db.LoanPayment.findMany({
            where: { loan: { id: { equals: item.id.toString() } } },
          });

          for (const payment of payments) {
            await context.db.LoanPayment.updateOne({
              where: { id: payment.id as string },
              data: { updatedAt: new Date() },
            });
          }
        }
      } else if (operation === 'delete' && originalItem) {
        try {
          console.log('Iniciando eliminación de préstamo:', originalItem.id);
          
          // Obtener el lead y la cuenta asociada
          const lead = await context.db.Employee.findOne({
            where: { id: originalItem.leadId as string },
          });
          console.log('Lead encontrado:', lead?.id);

          const account = await context.prisma.account.findFirst({
            where: { 
              routeId: lead?.routesId,
              type: 'EMPLOYEE_CASH_FUND'
            },
          });
          console.log('Cuenta encontrada:', account?.id);

          // Eliminar todas las transacciones asociadas al préstamo
          console.log('Eliminando transacciones...');
          const transactionsToDelete = (context as ExtendedContext).transactionsToDelete || [];
          console.log('Transacciones a eliminar:', transactionsToDelete.length);

          for (const transaction of transactionsToDelete) {
            await context.prisma.transaction.delete({
              where: { id: transaction.id }
            });
          }
          console.log('Transacciones eliminadas');

          // Actualizar balance de la cuenta
          if (account) {
            console.log('Actualizando balance de cuenta...');
            const currentAmount = parseFloat(account.amount.toString());
            const loanAmount = parseFloat(originalItem.amountGived?.toString() || '0');
            const commissionAmount = parseFloat(originalItem.comissionAmount?.toString() || '0');
            const totalAmount = loanAmount + commissionAmount;
            
            const updatedAmount = currentAmount + totalAmount;
            console.log('Montos:', {
              currentAmount,
              loanAmount,
              commissionAmount,
              totalAmount,
              updatedAmount
            });

            // Actualizar el balance usando prisma directamente
            await context.prisma.account.update({
              where: { id: account.id },
              data: { amount: updatedAmount.toString() }
            });
            console.log('Balance actualizado:', updatedAmount);
          }
        } catch (error) {
          console.error('Error al eliminar transacciones asociadas al préstamo:', error);
          throw error;
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
    afterOperation: async (args) => {
      const { operation, item, context, resolvedData } = args;
      //const extendedContext = context as unknown as ExtendedContext;
      //if (extendedContext.skipAfterOperation) {
      //  return;
      //}
      //extendedContext.skipAfterOperation = true;
      if ((operation === 'create' || operation === 'update') && item) {
        if (item.type !== 'WITHOUT_PAYMENT') {
          try {
            // Obtener el pago actual
            const payment = await context.prisma.loanPayment.findUnique({
              where: { id: item.id.toString() },
            });
            
            if (!payment || payment.loanId === null) {
              throw new Error("No hay Credito asociado a este pago");
            }
            
            // Obtener el préstamo asociado con su tipo
            const loan = await context.prisma.loan.findUnique({
              where: { id: payment.loanId },
              include: { loantype: true }
            });

            if (!loan || !loan.loantype) {
              throw new Error("No se encontró el préstamo o tipo de préstamo asociado");
            }

            const loanType = loan.loantype as { rate: { toString: () => string } };
            
            // Obtener todos los pagos excepto el actual
            const payments = await context.prisma.loanPayment.findMany({
              where: {
                id: { not: { equals: item.id.toString() } },
                loanId: payment.loanId
              },
            });

            // Calcular montos y tasas
            const rate = loanType.rate ? parseFloat(loanType.rate.toString()) : 0;
            const requestedAmount = parseFloat(loan.requestedAmount.toString());
            const originalProfit = requestedAmount * rate;
            const totalAmountToPay = requestedAmount + originalProfit;
            const amountGiven = parseFloat(loan.amountGived.toString());
            const totalProfit = loan.profitAmount ? parseFloat(loan.profitAmount.toString()) : 0;

            // Calcular total pagado y deuda pendiente
            const totalPayed = payments.reduce((sum: number, payment: any) => {
              if (!payment.amount) return sum;
              return sum + Number(payment.amount);
            }, 0);

            const pendingDebt = Math.max(0, totalAmountToPay - totalPayed);
            const pendingProfit = (pendingDebt * totalProfit) / totalAmountToPay;

            // Calcular montos de ganancia y retorno de capital
            const {profitAmount, returnToCapital} = await calculatePaymentProfitAmount(
              Number(item.amount),
              totalProfit,
              totalAmountToPay,
              requestedAmount,
              totalPayed
            );

            // Actualizar datos resueltos
            if (resolvedData) {
              resolvedData.profitAmount = profitAmount;
              resolvedData.returnToCapital = returnToCapital;
            }

            // Buscar el líder y sus cuentas asociadas
            const lead = await context.prisma.employee.findUnique({
              where: { id: loan.leadId || '' },
            });

            if (!lead) {
              throw new Error("No se encontró el líder asociado al préstamo");
            }

            // Buscar cuenta de efectivo del empleado
            const employeeCashAccounts = await context.prisma.account.findMany({
              where: {
                routeId: lead.routesId || '',
                type: 'EMPLOYEE_CASH_FUND'
              },
            });

            const employeeCashAccount = employeeCashAccounts[0];
            if (!employeeCashAccount) {
              throw new Error("No hay cuenta de efectivo asociada a este empleado");
            }

            // Crear transacción según el método de pago
            // Asegurarnos de que los montos sean strings con 2 decimales
            const getDecimalString = (value: unknown): string => {
              if (typeof value === 'object' && value !== null && 'toString' in value) {
                return (value as { toString(): string }).toString();
              }
              if (typeof value === 'number') {
                return value.toFixed(2);
              }
              return '0.00';
            };

            const baseTransactionData = {
              amount: getDecimalString(item.amount),
              date: new Date(item.receivedAt as string),
              loanPayment: { connect: { id: item.id.toString() } },
              loan: { connect: { id: loan.id } },
              lead: { connect: { id: lead.id } },
              profitAmount: getDecimalString(profitAmount),
              returnToCapital: getDecimalString(returnToCapital),
            };

            if (item.paymentMethod === 'CASH') {
              await context.db.Transaction.createOne({
                data: {
                  ...baseTransactionData,
                  type: 'INCOME',
                  incomeSource: 'CASH_LOAN_PAYMENT',
                  destinationAccount: { connect: { id: employeeCashAccount.id } },
                },
              });
            } else {
              // Buscar cuenta bancaria
              const bankAccounts = await context.prisma.account.findMany({
                where: {
                  type: 'BANK',
                  routeId: lead.routesId || ''
                },
              });

              if (!bankAccounts.length) {
                throw new Error("No se encontró cuenta bancaria asociada");
              }

              await context.db.Transaction.createOne({
                data: {
                  ...baseTransactionData,
                  type: 'INCOME',
                  incomeSource: 'BANK_LOAN_PAYMENT',
                  destinationAccount: { connect: { id: bankAccounts[0].id } },
                },
              });
            }

            // Crear transacción de comisión si existe
            if (item.comission) {
              await context.db.Transaction.createOne({
                data: {
                  amount: getDecimalString(item.comission),
                  date: new Date(item.receivedAt as string),
                  type: 'EXPENSE',
                  expenseSource: 'LOAN_PAYMENT_COMISSION',
                  sourceAccount: { connect: { id: employeeCashAccount.id } },
                  loanPayment: { connect: { id: item.id.toString() } },
                  loan: { connect: { id: loan.id } },
                  lead: { connect: { id: lead.id } },
                  createdAt: new Date(),
                },
              });
            }

          } catch (error) {
            console.error('Error en afterOperation de LoanPayment:', error);
            throw error;
          }
        }
      }
      
      /* // Marcar que el afterOperation ha terminado
      extendedContext.skipAfterOperation = false;
        }
      } */
    }
  },
  
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
    afterOperation: async ({ operation, item, context, originalItem }) => {
      try {
        if (operation === 'create') {
          if (!item) {
            console.log('No hay datos de transacción para procesar');
            return;
          }

          const transactionItem = item as unknown as TransactionItem;

          // Si es una transacción de pago de préstamo bancario o en efectivo, no procesar aquí
          // ya que estas se manejan en el hook de LoanPayment
          if (transactionItem.type === 'INCOME' && 
              (transactionItem.incomeSource === 'BANK_LOAN_PAYMENT' || 
               transactionItem.incomeSource === 'CASH_LOAN_PAYMENT')) {
            console.log('Transacción de pago de préstamo detectada, omitiendo procesamiento adicional');
            return;
          }

          let sourceAccount = null;
          let destinationAccount = null;

          if (transactionItem.sourceAccountId) {
            sourceAccount = await context.prisma.account.findUnique({
              where: { id: transactionItem.sourceAccountId.toString() }
            });
          }

          if (transactionItem.destinationAccountId) {
            destinationAccount = await context.prisma.account.findUnique({
              where: { id: transactionItem.destinationAccountId.toString() }
            });
          }

          const transactionAmount = parseAmount(transactionItem.amount);

          // Aplicar el nuevo efecto en la cuenta origen
          if (sourceAccount && (transactionItem.type === 'EXPENSE' || transactionItem.type === 'TRANSFER')) {
            const currentAmount = parseAmount(sourceAccount.amount);
            const newAmount = parseFloat((currentAmount - transactionAmount).toFixed(2));
            
            if (newAmount < 0) {
              throw new Error(`La operación resultaría en un balance negativo: ${newAmount}`);
            }

            await context.prisma.account.update({
              where: { id: sourceAccount.id },
              data: { amount: newAmount.toString() }
            });
            console.log('Actualizado balance cuenta origen:', {
              original: currentAmount,
              nuevo: newAmount,
              monto: transactionAmount
            });
          }

          // Aplicar el nuevo efecto en la cuenta destino
          if (destinationAccount && (transactionItem.type === 'INCOME' || transactionItem.type === 'TRANSFER')) {
            const currentAmount = parseAmount(destinationAccount.amount);
            const newAmount = parseFloat((currentAmount + transactionAmount).toFixed(2));
            
            await context.prisma.account.update({
              where: { id: destinationAccount.id },
              data: { amount: newAmount.toString() }
            });
            console.log('Actualizado balance cuenta destino:', {
              original: currentAmount,
              nuevo: newAmount,
              monto: transactionAmount
            });
          }
        }
      } catch (error) {
        console.error('Error en afterOperation de Transaction:', error);
        throw error;
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
    accountBalance: virtual({
      field: graphql.field({
        type: graphql.Float,
        async resolve(item: { id: string | { toString(): string } }, _args: any, context: KeystoneContext) {
          const id = item.id.toString();
          // Obtener todas las transacciones donde esta cuenta es origen o destino
          const sourceTransactions = await context.prisma.transaction.findMany({
            where: { sourceAccountId: id },
            select: { type: true, amount: true }
          });
          
          const destinationTransactions = await context.prisma.transaction.findMany({
            where: { destinationAccountId: id },
            select: { type: true, amount: true }
          });

          // Calcular el balance
          let balance = 0;
          
          // Procesar transacciones donde la cuenta es origen
          sourceTransactions.forEach((transaction: { type: string; amount: number | Decimal }) => {
            if (transaction.type === 'EXPENSE' || transaction.type === 'TRANSFER') {
              balance -= Number(transaction.amount);
            }
          });

          // Procesar transacciones donde la cuenta es destino
          destinationTransactions.forEach((transaction: { type: string; amount: number | Decimal }) => {
            if (transaction.type === 'INCOME' || transaction.type === 'TRANSFER') {
              balance += Number(transaction.amount);
            }
          });

          // Redondear el balance a 0, 0.5 o 1
          const decimal = balance % 1;
          if (decimal < 0.25) {
            balance = Math.floor(balance);
          } else if (decimal >= 0.25 && decimal < 0.75) {
            balance = Math.floor(balance) + 0.5;
          } else {
            balance = Math.ceil(balance);
          }

          return balance;
        }
      })
    }),
    transactions: relationship({ 
      ref: 'Transaction.sourceAccount', 
      many: true,
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'hidden' }
      }
    }),
    receivedTransactions: relationship({ 
      ref: 'Transaction.destinationAccount', 
      many: true,
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'hidden' }
      }
    }),
    route: relationship({ ref: 'Route.accounts' }),
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