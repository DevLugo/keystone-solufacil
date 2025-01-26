import { graphql, list } from '@keystone-6/core';
import { allowAll } from '@keystone-6/core/access';
import { text, password, timestamp, relationship, decimal, integer, select, virtual } from '@keystone-6/core/fields';
import { equal } from 'node:assert';

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
    name: text(),
    routes: relationship({
      ref: 'Route.employees',
      many: false,
    }),
    expenses: relationship({ ref: 'Expense.employee', many: true }), // Agrego esta línea
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

export const Expense = list({
  access: allowAll,
  fields: {
    amountToPay: decimal(),
    dueDate: timestamp(),
    payedAt: timestamp(),
    employee: relationship({ ref: 'Employee.expenses' }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    userId: text(),  // Assuming user ID is a text field; adjust as necessary
    /* employeeId: text(), */
  },
  hooks: {
    afterOperation: async ({ operation, item, context }) => {

    }
  }
});

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
  fields: {
    name: text(),
    weekDuration: integer(),
    rate: decimal(),  // Decimal type used for percentage, adjust precision as necessary
    /* weeksToRenew: integer(), */
    /* overdueRate: decimal(), */
    /* initialAmount: decimal({ defaultValue: '3000' }), */
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    loan: relationship({ ref: 'Loan.loantype', many: true, ui:{
      hideCreate: true,
    } }),
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
  },
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
  fields: {
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
    weeklyPaymentAmount: decimal(
      {
        precision: 10,
        scale: 2,
        validation: {
          isRequired: true,
        }
      }
    ),
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
    amountToPay: decimal({
      precision: 10,
      scale: 2,
      validation: {
        isRequired: true,
      }
    }),
    loantype: relationship({ ref: 'Loantype.loan' }),
    /* previousAmountGived: decimal(), */
    /* renovationProfitAmount: decimal({ defaultValue: "0"}), */
    //renovationPendingAmount: decimal({ defaultValue: "0"}),
    /* baseProfitAmount: decimal({ defaultValue: "0"}),
    totalProfitAmount: decimal({ defaultValue: "0"}), */
    signDate: timestamp({ defaultValue: { kind: 'now' }, validation: { isRequired: true } }),
    
    /* loanLeadId: text(), */
    /* phoneNumber: text(), */
    avalName: text(),
    avalPhone: text(),
    grantor: relationship({ ref: 'Employee.loan' }),
    //loanTypeId: text(),
    //grantorId: text(),
    transaction: relationship({ ref: 'Transaction.loan', many: true }),
    lead: relationship({ ref: 'Employee.LeadManagedLoans'}),
    borrower: relationship({ 
      ref: 'Borrower.loans',
    }),
    previousLoan: relationship({ ref: 'Loan' }), // Agrego esta línea
    commissionPayment: relationship({ ref: 'CommissionPayment.loan', many: true }),
    //avals: relationship({ ref: 'PersonalData.loan', many: true }),
    comissionAmount: decimal(),
    finishedDate: timestamp({validation: { isRequired: false }}),
    updatedAt: timestamp(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    //virtual fields
    totalpayedAmount: virtual({
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
          return parseFloat((item as { amountToPay: string }).amountToPay) - payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
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
    afterOperation: async ({ operation, item, context }) => {
      if ((operation === 'create' || operation === 'update') && item) {
        
        /* const loan = await context.query.Loan.findOne({
          where: { id: item?.id?.toString() || '' },
        }); */
        console.log("////////////ITEM///////////")
        console.log(item);
        console.log("////////////LOAN///////////")
        console.log(item.leadId);

        const leadId: string = item.leadId as string;
        const lead = await context.db.Employee.findOne({
          where: { id: leadId },            
        });

        // si status es igual a finalizado/renavado/cancelado, entonces se setea la fecha de termino
        if(item.status === 'FINISHED' || item.status === 'RENOVATED' || item.status === 'CANCELED'){
          context.db.Loan.updateOne({
            where: { id: item.id.toString() },
            data: { finishedDate: new Date() },
          })
        }

        console.log("////////////LEADID///////////", lead)


        const account = await context.db.Account.findMany({
          where: { route: {id:lead?.routeId}},            
        });


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
       
        console.log("////////////transaction///////////", transactions)
        //vamos a descontar la cantidad otorgada de la cuenta asociada a la ruta a la que pertence la loanLEad
        /* const route = await context..Route.findOne({
          where: { id: data.loanLeadId },
          query: 'account{id}',
        }); */
      }
    }
  },
  ui: {
    listView: {
      initialColumns: ['totalPayments', 'signDate', 'payments'],
    },
  }, 

});

export const LoanPayment = list({
  access: allowAll,
  fields: {
    amount: decimal(),
    comission: decimal(),
    profitAmount: decimal(),
    returnToCapital: decimal(),
    receivedAt: timestamp({ defaultValue: { kind: 'now' } }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    loan: relationship({ ref: 'Loan.payments' }),
    //collector: relationship({ ref: 'Employee.loanPayment' }),
    transaction: relationship({ ref: 'Transaction.loanPayment' }),
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
  },
  hooks: {
    afterOperation: async ({ operation, item, context }) => {
      if ((operation === 'create' || operation === 'update') && item) {
        if (item.type === 'PAYMENT') {
          const loan = await context.db.Loan.findOne({
            where: { id: item.loanId as string },
          });
          const lead = await context.db.Employee.findOne({
            where: { id: loan?.leadId as string },
          });

          const employeeAccount = await context.db.Account.findMany({
            where: { route: {id:lead?.routeId}},            
          });
          

          if(item.paymentMethod === 'CASH'){
            await context.db.Transaction.createOne({
              data: {
                amount: item.amount,
                date: item.receivedAt,
                type: 'INCOME',
                incomeSource: 'LOAN_PAYMENT',
                destinationAccount: { connect: { id: employeeAccount[0].id } },
                loanPayment: { connect: { id: item.id } },
              },
            });
          }else{
            const account = await context.db.Account.findMany({
              where: { type: { equals: 'BANK'} },            
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
              },
            });
          }

          
          await context.db.Transaction.createOne({
            data: {
              amount: item.comission,
              date: item.receivedAt,
              type: 'EXPENSE',
              expenseSource: 'LOAN_PAYMENT_COMISSION',
              sourceAccount: { connect: { id: employeeAccount[0].id } },
              loanPayment: { connect: { id: item.id } },
            },
          });

        }
      }
    }
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
        { label: 'LOAN_PAYMENT', value: 'LOAN_PAYMENT' },
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
    sourceAccount: relationship({ ref: 'Account.transactions' }),
    destinationAccount: relationship({ ref: 'Account.receivedTransactions' }),
    loan: relationship({ ref: 'Loan.transaction' }),
    loanPayment: relationship({ ref: 'LoanPayment.transaction' }),
  },
  hooks: {
    afterOperation: async ({ operation, item, context }) => {
      if ((operation === 'create' || operation === 'update')  && item) {
        if (item.type === 'EXPENSE') {
          const sourceAccount = await context.db.Account.findOne({
            where: { id: item.sourceAccountId as string },
          });

          let destinationAccount = null;
           if(destinationAccount){
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
        }else if(item.type === 'INCOME'){
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
    type: select({
      options: [
        { label: 'PENDING_MONEY', value: 'PENDING_MONEY' },
        { label: 'COMPENSATORY_PENDING_MONEY', value: 'COMPENSATORY_PENDING_MONEY' },
      ],
    }),
    expectedAmount: decimal(),
    paidAmount: decimal(),
    falco: decimal(),
    pendingFalcoAmount: decimal(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    //leadId: text(),
    //agentId: text(),
    agent: relationship({ ref: 'Employee.leadPaymentsReceivedAgent' }),
    lead: relationship({ ref: 'Employee.LeadPaymentReceivedLead' }),
    falcoCompensatoryPayments: relationship({ ref: 'FalcoCompensatoryPayment.leadPaymentReceived', many: true }),
    /* loanPayment: relationship({ ref: 'LoanPayment.leadPaymentReceived', many: true }), */
    payments: relationship({ ref: 'LoanPayment.leadPaymentReceived', many: true }),


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
  Expense,
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