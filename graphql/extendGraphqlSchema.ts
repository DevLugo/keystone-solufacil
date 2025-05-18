import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';
import { Decimal } from '@prisma/client/runtime/library';

interface PaymentInput {
  id?: string;
  amount: number;
  comission: number;
  loanId: string;
  type: string;
  paymentMethod: string;
}

interface LeadPaymentReceivedResponse {
  id: string;
  expectedAmount: number;
  paidAmount: number;
  cashPaidAmount: number;
  bankPaidAmount: number;
  falcoAmount: number;
  paymentStatus: string;
  payments: PaymentInput[];
  paymentDate: string;
  agentId: string;
  leadId: string;
}

const PaymentType = graphql.object<PaymentInput>()({
  name: 'Payment',
  fields: {
    id: graphql.field({ 
      type: graphql.nonNull(graphql.ID),
      resolve: (item) => item.id || ''
    }),
    amount: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    comission: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    loanId: graphql.field({ type: graphql.nonNull(graphql.String) }),
    type: graphql.field({ type: graphql.nonNull(graphql.String) }),
    paymentMethod: graphql.field({ type: graphql.nonNull(graphql.String) }),
  },
});

const PaymentInputType = graphql.inputObject({
  name: 'PaymentInput',
  fields: {
    amount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    comission: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    loanId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    type: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    paymentMethod: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
});

// Definir el tipo de objeto LeadPaymentReceived
const CustomLeadPaymentReceivedType = graphql.object<LeadPaymentReceivedResponse>()({
  name: 'CustomLeadPaymentReceived',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    expectedAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.expectedAmount?.toString() || '0')
    }),
    paidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.paidAmount?.toString() || '0')
    }),
    cashPaidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.cashPaidAmount?.toString() || '0')
    }),
    bankPaidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.bankPaidAmount?.toString() || '0')
    }),
    falcoAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.falcoAmount?.toString() || '0')
    }),
    paymentStatus: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (item) => item.paymentStatus || 'FALCO'
    }),
    agentId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    leadId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    paymentDate: graphql.field({ type: graphql.nonNull(graphql.String) }),
    payments: graphql.field({ 
      type: graphql.nonNull(graphql.list(graphql.nonNull(PaymentType))),
      resolve: (item) => item.payments || []
    }),
  },
});

export const extendGraphqlSchema = graphql.extend(base => {
  return {
    mutation: {
      createCustomLeadPaymentReceived: graphql.field({
        type: graphql.nonNull(CustomLeadPaymentReceivedType),
        args: {
          expectedAmount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
          cashPaidAmount: graphql.arg({ type: graphql.Float }),
          bankPaidAmount: graphql.arg({ type: graphql.Float }),
          falcoAmount: graphql.arg({ type: graphql.Float }),
          agentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
          leadId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
          paymentDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          payments: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(PaymentInputType))) }),
        },
        resolve: async (root, { expectedAmount, cashPaidAmount = 0, bankPaidAmount = 0, agentId, leadId, payments, paymentDate }, context: Context): Promise<LeadPaymentReceivedResponse> => {
          cashPaidAmount = cashPaidAmount ?? 0;
          bankPaidAmount = bankPaidAmount ?? 0;
          const totalPaidAmount = cashPaidAmount + bankPaidAmount;
          const falcoAmount = expectedAmount - totalPaidAmount;
          let paymentStatus = 'FALCO';

          if (totalPaidAmount >= expectedAmount) {
            paymentStatus = 'COMPLETE';
          } else if (totalPaidAmount > 0 && totalPaidAmount < expectedAmount) {
            paymentStatus = 'PARTIAL';
          }

          // Obtener la cuenta de efectivo del agente
          const agent = await context.db.Employee.findOne({
            where: { id: agentId },
          });

          if (!agent) {
            throw new Error('Agente no encontrado');
          }

          // Obtener las cuentas del agente
          const agentAccounts = await context.db.Account.findMany({
            where: { 
              AND: [
                { route: { employees: { some: { id: { equals: agentId } } } } },
                { type: { equals: 'EMPLOYEE_CASH_FUND' } }
              ]
            }
          });
          console.log("AGENT ACCOUNTS", agentAccounts);
          const cashAccount = agentAccounts[0];
          console.log("CASH ACCOUNT", cashAccount);
          if (!cashAccount) {
            throw new Error('Cuenta de efectivo no encontrada');
          }

          // Obtener la cuenta bancaria
          const bankAccounts = await context.db.Account.findMany({
            where: { 
              AND: [
                { route: { employees: { some: { id: { equals: agentId } } } } },
                { type: { equals: 'BANK' } }
              ]
            }
          });

          const bankAccount = bankAccounts[0];
          console.log("BANK ACCOUNT", bankAccount);
          if (!bankAccount) {
            throw new Error('Cuenta bancaria no encontradaaaa');
          }

          // Crear el LeadPaymentReceived
          const leadPaymentReceived = await context.db.LeadPaymentReceived.createOne({
            data: {
              expectedAmount: expectedAmount.toFixed(2),
              paidAmount: totalPaidAmount.toFixed(2),
              cashPaidAmount: cashPaidAmount.toFixed(2),
              bankPaidAmount: bankPaidAmount.toFixed(2),
              falcoAmount: falcoAmount > 0 ? falcoAmount.toFixed(2) : '0.00',
              createdAt: new Date(paymentDate),
              paymentStatus,
              agent: { connect: { id: agentId } },
              lead: { connect: { id: leadId } },
            },
          });

          // Crear los pagos
          for (const payment of payments) {
            await context.db.LoanPayment.createOne({
              data: {
                amount: payment.amount.toFixed(2),
                comission: payment.comission.toFixed(2),
                loan: { connect: { id: payment.loanId } },
                type: payment.type,
                paymentMethod: payment.paymentMethod,
                leadPaymentReceived: { connect: { id: leadPaymentReceived.id } },
              },
            });
          }

          return {
            id: leadPaymentReceived.id,
            expectedAmount: parseFloat(leadPaymentReceived.expectedAmount?.toString() || '0'),
            paidAmount: parseFloat(leadPaymentReceived.paidAmount?.toString() || '0'),
            cashPaidAmount: parseFloat(leadPaymentReceived.cashPaidAmount?.toString() || '0'),
            bankPaidAmount: parseFloat(leadPaymentReceived.bankPaidAmount?.toString() || '0'),
            falcoAmount: parseFloat(leadPaymentReceived.falcoAmount?.toString() || '0'),
            paymentStatus: leadPaymentReceived.paymentStatus || 'FALCO',
            payments: payments.map(p => ({
              amount: p.amount,
              comission: p.comission,
              loanId: p.loanId,
              type: p.type,
              paymentMethod: p.paymentMethod
            })),
            paymentDate,
            agentId,
            leadId,
          };
        },
      }),
      updateCustomLeadPaymentReceived: graphql.field({
        type: graphql.nonNull(CustomLeadPaymentReceivedType),
        args: {
          id: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
          expectedAmount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
          cashPaidAmount: graphql.arg({ type: graphql.Float }),
          bankPaidAmount: graphql.arg({ type: graphql.Float }),
          falcoAmount: graphql.arg({ type: graphql.Float }),
          paymentDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          payments: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(PaymentInputType))) }),
        },
        resolve: async (root, { id, expectedAmount, cashPaidAmount = 0, bankPaidAmount = 0, paymentDate, payments }, context: Context): Promise<LeadPaymentReceivedResponse> => {
          cashPaidAmount = cashPaidAmount ?? 0;
          bankPaidAmount = bankPaidAmount ?? 0;
          const totalPaidAmount = cashPaidAmount + bankPaidAmount;
          const falcoAmount = expectedAmount - totalPaidAmount;
          let paymentStatus = 'FALCO';
          let agentId = '';
          let leadId = '';

          if (totalPaidAmount >= expectedAmount) {
            paymentStatus = 'COMPLETE';
          } else if (totalPaidAmount > 0 && totalPaidAmount < expectedAmount) {
            paymentStatus = 'PARTIAL';
          }

          // Obtener el LeadPaymentReceived existente
          const existingPayment = await context.prisma.leadPaymentReceived.findUnique({
            where: { id },
            include: {
              agent: true
            }
          });

          if (!existingPayment) {
            throw new Error('Pago no encontrado');
          }

          agentId = existingPayment.agentId || '';
          leadId = existingPayment.leadId || '';

          // Obtener pagos existentes
          const existingPayments = await context.db.LoanPayment.findMany({
            where: { leadPaymentReceived: { id: { equals: id } } }
          });

          console.log('Pagos existentes antes de la actualización:', {
            total: existingPayments.length,
            payments: existingPayments.map(p => ({ id: p.id, loanId: p.loanId, amount: p.amount }))
          });

          // Obtener la ruta del agente
          const agentRoute = await context.prisma.route.findFirst({
            where: { 
              employees: { some: { id: { equals: agentId } } }
            },
            include: {
              accounts: true
            }
          });

          if (!agentRoute) {
            throw new Error(`Ruta no encontrada para el agente ${agentId}`);
          }

          // Obtener las cuentas de la ruta
          const routeCashAccount = agentRoute.accounts.find(account => account.type === 'EMPLOYEE_CASH_FUND');
          const routeBankAccount = agentRoute.accounts.find(account => account.type === 'BANK');

          if (!routeCashAccount || !routeBankAccount) {
            throw new Error('Cuentas de la ruta no encontradas');
          }

          // Obtener los saldos actuales de las cuentas
          const currentCashAccount = await context.db.Account.findOne({
            where: { id: routeCashAccount.id }
          });
          const currentBankAccount = await context.db.Account.findOne({
            where: { id: routeBankAccount.id }
          });

          let cashAmount = parseFloat(currentCashAccount?.amount?.toString() || '0');
          let bankAmount = parseFloat(currentBankAccount?.amount?.toString() || '0');

          console.log('=== DEBUG: Saldos iniciales ===');
          console.log('Saldo efectivo:', cashAmount);
          console.log('Saldo banco:', bankAmount);

          // Actualizar el LeadPaymentReceived
          const leadPaymentReceived = await context.db.LeadPaymentReceived.updateOne({
            where: { id },
            data: {
              expectedAmount: expectedAmount.toFixed(2),
              paidAmount: totalPaidAmount.toFixed(2),
              cashPaidAmount: cashPaidAmount.toFixed(2),
              bankPaidAmount: bankPaidAmount.toFixed(2),
              falcoAmount: falcoAmount > 0 ? falcoAmount.toFixed(2) : '0.00',
              createdAt: new Date(paymentDate),
              paymentStatus,
            },
          });

          // Crear un mapa de pagos existentes por ID para fácil acceso
          const existingPaymentsMap = new Map(
            existingPayments.map(payment => [payment.id, payment])
          );

          // Procesar cada pago en la lista nueva
          for (const payment of payments) {
            // Buscar si existe un pago para este loanId asociado a este LeadPaymentReceived
            const existingPayment = existingPayments.find(p => p.loanId === payment.loanId);

            if (existingPayment) {
              console.log('Actualizando pago existente:', {
                id: existingPayment.id,
                loanId: existingPayment.loanId,
                oldAmount: existingPayment.amount,
                newAmount: payment.amount,
                oldPaymentMethod: existingPayment.paymentMethod,
                newPaymentMethod: payment.paymentMethod
              });

              const oldAmount = parseFloat(existingPayment.amount?.toString() || '0');
              const newAmount = parseFloat(payment.amount?.toString() || '0');

              // Si el método de pago cambió, revertir el monto anterior
              if (existingPayment.paymentMethod !== payment.paymentMethod) {
                if (existingPayment.paymentMethod === 'CASH') {
                  // Cambio de efectivo a transferencia: restar del efectivo y sumar al banco
                  cashAmount -= oldAmount;
                  bankAmount += oldAmount;

                  // Crear transacción bancaria
                  await context.db.Transaction.createOne({
                    data: {
                      amount: oldAmount.toFixed(2),
                      date: new Date(paymentDate),
                      type: 'INCOME',
                      incomeSource: 'BANK_LOAN_PAYMENT',
                      description: `Transferencia de pago de préstamo - ${paymentDate}`,
                      sourceAccount: { connect: { id: routeCashAccount.id } },
                      destinationAccount: { connect: { id: routeBankAccount.id } },
                      lead: { connect: { id: leadId } }
                    }
                  });
                } else {
                  // Cambio de transferencia a efectivo: restar del banco y sumar al efectivo
                  bankAmount -= oldAmount;
                  cashAmount += oldAmount;

                  // Crear transacción en efectivo
                  await context.db.Transaction.createOne({
                    data: {
                      amount: oldAmount.toFixed(2),
                      date: new Date(paymentDate),
                      type: 'INCOME',
                      incomeSource: 'CASH_LOAN_PAYMENT',
                      description: `Pago en efectivo de préstamo - ${paymentDate}`,
                      sourceAccount: { connect: { id: routeBankAccount.id } },
                      destinationAccount: { connect: { id: routeCashAccount.id } },
                      lead: { connect: { id: leadId } }
                    }
                  });
                }
              } else {
                // Si no cambió el método, solo aplicamos la diferencia
                if (payment.paymentMethod === 'CASH') {
                  cashAmount -= (newAmount - oldAmount);
                  // Crear transacción en efectivo por la diferencia
                  if (newAmount > oldAmount) {
                    await context.db.Transaction.createOne({
                      data: {
                        amount: (newAmount - oldAmount).toFixed(2),
                        date: new Date(paymentDate),
                        type: 'INCOME',
                        incomeSource: 'CASH_LOAN_PAYMENT',
                        description: `Pago en efectivo de préstamo - ${paymentDate}`,
                        sourceAccount: { connect: { id: routeBankAccount.id } },
                        destinationAccount: { connect: { id: routeCashAccount.id } },
                        lead: { connect: { id: leadId } }
                      }
                    });
                  }
                } else {
                  bankAmount -= (newAmount - oldAmount);
                  // Crear transacción bancaria por la diferencia
                  if (newAmount > oldAmount) {
                    await context.db.Transaction.createOne({
                      data: {
                        amount: (newAmount - oldAmount).toFixed(2),
                        date: new Date(paymentDate),
                        type: 'INCOME',
                        incomeSource: 'BANK_LOAN_PAYMENT',
                        description: `Transferencia de pago de préstamo - ${paymentDate}`,
                        sourceAccount: { connect: { id: routeCashAccount.id } },
                        destinationAccount: { connect: { id: routeBankAccount.id } },
                        lead: { connect: { id: leadId } }
                      }
                    });
                  }
                }
              }

              console.log('=== DEBUG: Actualización de saldos ===');
              console.log('Método anterior:', existingPayment.paymentMethod);
              console.log('Método nuevo:', payment.paymentMethod);
              console.log('Monto anterior:', oldAmount);
              console.log('Monto nuevo:', newAmount);
              console.log('Saldo efectivo actual:', cashAmount);
              console.log('Saldo banco actual:', bankAmount);

              // Actualizar pago existente
              await context.prisma.loanPayment.update({
                where: { id: existingPayment.id },
                data: {
                  amount: payment.amount.toFixed(2),
                  comission: payment.comission.toFixed(2),
                  type: payment.type,
                  paymentMethod: payment.paymentMethod,
                  leadPaymentReceivedId: leadPaymentReceived.id,
                  updatedAt: new Date()
                }
              });
            } else {
              // Crear nuevo pago
              await context.db.LoanPayment.createOne({
                data: {
                  amount: payment.amount.toFixed(2),
                  comission: payment.comission.toFixed(2),
                  loan: { connect: { id: payment.loanId } },
                  type: payment.type,
                  paymentMethod: payment.paymentMethod,
                  leadPaymentReceived: { connect: { id: leadPaymentReceived.id } },
                }
              });

              // Aplicar el nuevo monto según el método de pago
              if (payment.paymentMethod === 'CASH') {
                cashAmount -= payment.amount;
              } else {
                bankAmount -= payment.amount;
              }
            }
          }

          // Eliminar pagos que ya no están en la lista
          const paymentsToDelete = existingPayments.filter(p => !payments.some(np => np.loanId === p.loanId));
          for (const paymentToDelete of paymentsToDelete) {
            const amount = parseFloat(paymentToDelete.amount?.toString() || '0');
            
            // Revertir el pago según su método
            if (paymentToDelete.paymentMethod === 'CASH') {
              cashAmount += amount;
            } else {
              bankAmount += amount;
            }

            await context.db.LoanPayment.deleteOne({
              where: { id: paymentToDelete.id }
            });
          }

          console.log('=== DEBUG: Saldos finales ===');
          console.log('Saldo efectivo:', cashAmount.toFixed(2));
          console.log('Saldo banco:', bankAmount.toFixed(2));

          // Actualizar los saldos de las cuentas
          await context.db.Account.updateOne({
            where: { id: routeCashAccount.id },
            data: { amount: cashAmount.toFixed(2) }
          });

          await context.db.Account.updateOne({
            where: { id: routeBankAccount.id },
            data: { amount: bankAmount.toFixed(2) }
          });

          return {
            id: leadPaymentReceived.id,
            expectedAmount: parseFloat(leadPaymentReceived.expectedAmount?.toString() || '0'),
            paidAmount: parseFloat(leadPaymentReceived.paidAmount?.toString() || '0'),
            cashPaidAmount: parseFloat(leadPaymentReceived.cashPaidAmount?.toString() || '0'),
            bankPaidAmount: parseFloat(leadPaymentReceived.bankPaidAmount?.toString() || '0'),
            falcoAmount: parseFloat(leadPaymentReceived.falcoAmount?.toString() || '0'),
            paymentStatus: leadPaymentReceived.paymentStatus || 'FALCO',
            payments: payments.map(p => ({
              amount: p.amount,
              comission: p.comission,
              loanId: p.loanId,
              type: p.type,
              paymentMethod: p.paymentMethod
            })),
            paymentDate,
            agentId,
            leadId,
          };
        },
      }),
    },
    query: {
      getTransactionsSummary: graphql.field({
        type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.object()({
          name: 'TransactionSummary',
          fields: {
            date: graphql.field({ 
              type: graphql.nonNull(graphql.String),
              resolve: (item) => item.date
            }),
            locality: graphql.field({ 
              type: graphql.nonNull(graphql.String),
              resolve: (item) => item.locality
            }),
            abono: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.abono
            }),
            credito: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.credito
            }),
            viatic: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.viatic
            }),
            gasoline: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.gasoline
            }),
            accommodation: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.accommodation
            }),
            nominaSalary: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.nominaSalary
            }),
            externalSalary: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.externalSalary
            }),
            vehiculeMaintenance: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.vehiculeMaintenance
            }),
            loanGranted: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.loanGranted
            }),
            loanPaymentComission: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.loanPaymentComission
            }),
            loanGrantedComission: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.loanGrantedComission
            }),
            leadComission: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.leadComission
            }),
            moneyInvestment: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.moneyInvestment
            }),
            otro: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.otro
            }),
            balance: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.balance
            }),
            profit: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.profit
            }),
            cashBalance: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.cashBalance
            }),
            bankBalance: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.bankBalance
            }),
            cashAbono: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.cashAbono
            }),
            bankAbono: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item) => item.bankAbono
            }),
          },
        })))),
        args: {
          startDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          endDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        resolve: async (root, { startDate, endDate }, context: Context) => {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0); // Inicio del día
          
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Fin del día

          console.log('Buscando transacciones entre:', {
            start: start.toISOString(),
            end: end.toISOString()
          });

          const rangeTransactions = await context.prisma.transaction.findMany({
            where: {
              date: {
                gte: start,
                lte: end,
              },
            },
            include: {
              lead: {
                include: {
                  personalData: {
                    include: {
                      addresses: {
                        include: {
                          location: {
                            include: {
                              municipality: {
                                include: {
                                  state: true
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              sourceAccount: true,
              destinationAccount: true
            }
          });

          console.log('=== INICIO DE PROCESAMIENTO DE TRANSACCIONES ===');
          console.log(`Total de transacciones encontradas: ${rangeTransactions.length}`);

          const localidades: Record<string, Record<string, { [key: string]: number }>> = {};

          for (const transaction of rangeTransactions) {
            // Obtener la fecha de la transacción en formato YYYY-MM-DD
            const transactionDate = transaction.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];
            
            // Obtener la localidad de la transacción
            const locality = transaction.lead?.personalData?.addresses?.[0]?.location?.municipality?.name || 'General';
            const state = transaction.lead?.personalData?.addresses?.[0]?.location?.municipality?.state?.name || 'General';
            const localityWithLeader = `${locality} - ${state}`;

            console.log('=== DETALLE DE TRANSACCIÓN ===');
            console.log({
              id: transaction.id,
              fecha: transactionDate,
              tipo: transaction.type,
              monto: transaction.amount,
              fuente: transaction.incomeSource,
              localidad: localityWithLeader,
              cuentaOrigen: {
                id: transaction.sourceAccount?.id,
                tipo: transaction.sourceAccount?.type,
                nombre: transaction.sourceAccount?.name
              },
              cuentaDestino: {
                id: transaction.destinationAccount?.id,
                tipo: transaction.destinationAccount?.type,
                nombre: transaction.destinationAccount?.name
              }
            });

            // Inicializar la estructura para la fecha si no existe
            if (!localidades[transactionDate]) {
              localidades[transactionDate] = {};
            }

            // Inicializar la estructura para la localidad si no existe
            if (!localidades[transactionDate][localityWithLeader]) {
              localidades[transactionDate][localityWithLeader] = {
                ABONO: 0,
                CASH_ABONO: 0,
                BANK_ABONO: 0,
                CREDITO: 0,
                VIATIC: 0,
                GASOLINE: 0,
                ACCOMMODATION: 0,
                NOMINA_SALARY: 0,
                EXTERNAL_SALARY: 0,
                VEHICULE_MAINTENANCE: 0,
                LOAN_GRANTED: 0,
                LOAN_PAYMENT_COMISSION: 0,
                LOAN_GRANTED_COMISSION: 0,
                LEAD_COMISSION: 0,
                MONEY_INVESMENT: 0,
                OTRO: 0,
                CASH_BALANCE: 0,
                BANK_BALANCE: 0
              };
            }

            if (transaction.type === 'INCOME') {
              console.log('\n--- PROCESANDO TRANSACCIÓN DE INGRESO ---');
              const isBankTransaction = transaction.incomeSource === 'BANK_LOAN_PAYMENT';
              
              console.log('¿Es transacción bancaria?', isBankTransaction);
              console.log('Tipo de cuenta origen:', transaction.sourceAccount?.type);
              console.log('Tipo de cuenta destino:', transaction.destinationAccount?.type);
              console.log('Fuente de ingreso:', transaction.incomeSource);

              if (isBankTransaction) {
                console.log('Procesando como ABONO BANCARIO');
                localidades[transactionDate][localityWithLeader].BANK_ABONO += Number(transaction.amount || 0);
                localidades[transactionDate][localityWithLeader].BANK_BALANCE += Number(transaction.amount || 0);
                // No sumamos al ABONO general ya que ya está incluido en BANK_ABONO
              } else {
                console.log('Procesando como ABONO EN EFECTIVO');
                localidades[transactionDate][localityWithLeader].CASH_ABONO += Number(transaction.amount || 0);
                localidades[transactionDate][localityWithLeader].CASH_BALANCE += Number(transaction.amount || 0);
                // No sumamos al ABONO general ya que ya está incluido en CASH_ABONO
              }

              // Sumamos al ABONO general solo una vez
              localidades[transactionDate][localityWithLeader].ABONO += Number(transaction.amount || 0);

              console.log('Totales actualizados:', {
                abonoTotal: localidades[transactionDate][localityWithLeader].ABONO,
                abonoEfectivo: localidades[transactionDate][localityWithLeader].CASH_ABONO,
                abonoBanco: localidades[transactionDate][localityWithLeader].BANK_ABONO,
                balanceEfectivo: localidades[transactionDate][localityWithLeader].CASH_BALANCE,
                balanceBanco: localidades[transactionDate][localityWithLeader].BANK_BALANCE
              });
            }
          }

          console.log('\n=== RESUMEN FINAL ===');
          Object.entries(localidades).forEach(([date, localities]) => {
            console.log(`\nFecha: ${date}`);
            Object.entries(localities).forEach(([locality, data]) => {
              console.log(`Localidad: ${locality}`);
              console.log({
                abonoTotal: data.ABONO,
                abonoEfectivo: data.CASH_ABONO,
                abonoBanco: data.BANK_ABONO,
                balanceEfectivo: data.CASH_BALANCE,
                balanceBanco: data.BANK_BALANCE
              });
            });
          });

          const result = Object.entries(localidades).flatMap(([date, localities]) => 
            Object.entries(localities).map(([locality, data]) => {
              console.log(`Generando resultado para ${date} - ${locality}:`, {
                comisiones: {
                  loanPaymentComission: data.LOAN_PAYMENT_COMISSION,
                  loanGrantedComission: data.LOAN_GRANTED_COMISSION,
                  leadComission: data.LEAD_COMISSION
                }
              });
              
              // Verificar si hay valores negativos o inválidos
              const checkValue = (value: number, name: string) => {
                if (isNaN(value) || value < 0) {
                  console.log(`ADVERTENCIA: Valor inválido en ${name} para ${date} - ${locality}: ${value}`);
                  return 0;
                }
                return value;
              };

              // Calcular el balance final usando los totales acumulados
              const totalIngresos = checkValue(data.ABONO, 'ABONO') + checkValue(data.MONEY_INVESMENT, 'MONEY_INVESMENT');
              const totalGastos = checkValue(data.CREDITO, 'CREDITO') + 
                                checkValue(data.VIATIC, 'VIATIC') + 
                                checkValue(data.GASOLINE, 'GASOLINE') + 
                                checkValue(data.ACCOMMODATION, 'ACCOMMODATION') + 
                                checkValue(data.NOMINA_SALARY, 'NOMINA_SALARY') + 
                                checkValue(data.EXTERNAL_SALARY, 'EXTERNAL_SALARY') + 
                                checkValue(data.VEHICULE_MAINTENANCE, 'VEHICULE_MAINTENANCE') + 
                                checkValue(data.LOAN_GRANTED, 'LOAN_GRANTED') + 
                                checkValue(data.OTRO, 'OTRO');
              const totalComisiones = checkValue(data.LOAN_PAYMENT_COMISSION, 'LOAN_PAYMENT_COMISSION') + 
                                    checkValue(data.LOAN_GRANTED_COMISSION, 'LOAN_GRANTED_COMISSION') + 
                                    checkValue(data.LEAD_COMISSION, 'LEAD_COMISSION');
              
              const balanceFinal = totalIngresos - totalGastos - totalComisiones;
              const profitFinal = totalIngresos - totalGastos;

              console.log('Cálculo final de balance:', {
                totalIngresos,
                totalGastos,
                totalComisiones,
                balanceFinal,
                profitFinal,
                detalle: {
                  abono: data.ABONO,
                  moneyInvestment: data.MONEY_INVESMENT,
                  credito: data.CREDITO,
                  viatic: data.VIATIC,
                  gasoline: data.GASOLINE,
                  accommodation: data.ACCOMMODATION,
                  nominaSalary: data.NOMINA_SALARY,
                  externalSalary: data.EXTERNAL_SALARY,
                  vehiculeMaintenance: data.VEHICULE_MAINTENANCE,
                  loanGranted: data.LOAN_GRANTED,
                  otro: data.OTRO,
                  loanPaymentComission: data.LOAN_PAYMENT_COMISSION,
                  loanGrantedComission: data.LOAN_GRANTED_COMISSION,
                  leadComission: data.LEAD_COMISSION
                }
              });
              
              return {
                date,
                locality,
                abono: checkValue(data.ABONO, 'ABONO'),
                cashAbono: checkValue(data.CASH_ABONO, 'CASH_ABONO'),
                bankAbono: checkValue(data.BANK_ABONO, 'BANK_ABONO'),
                credito: checkValue(data.CREDITO, 'CREDITO'),
                viatic: checkValue(data.VIATIC, 'VIATIC'),
                gasoline: checkValue(data.GASOLINE, 'GASOLINE'),
                accommodation: checkValue(data.ACCOMMODATION, 'ACCOMMODATION'),
                nominaSalary: checkValue(data.NOMINA_SALARY, 'NOMINA_SALARY'),
                externalSalary: checkValue(data.EXTERNAL_SALARY, 'EXTERNAL_SALARY'),
                vehiculeMaintenance: checkValue(data.VEHICULE_MAINTENANCE, 'VEHICULE_MAINTENANCE'),
                loanGranted: checkValue(data.LOAN_GRANTED, 'LOAN_GRANTED'),
                loanPaymentComission: checkValue(data.LOAN_PAYMENT_COMISSION, 'LOAN_PAYMENT_COMISSION'),
                loanGrantedComission: checkValue(data.LOAN_GRANTED_COMISSION, 'LOAN_GRANTED_COMISSION'),
                leadComission: checkValue(data.LEAD_COMISSION, 'LEAD_COMISSION'),
                moneyInvestment: checkValue(data.MONEY_INVESMENT, 'MONEY_INVESMENT'),
                otro: checkValue(data.OTRO, 'OTRO'),
                balance: balanceFinal,
                profit: profitFinal,
                cashBalance: checkValue(data.CASH_BALANCE, 'CASH_BALANCE'),
                bankBalance: checkValue(data.BANK_BALANCE, 'BANK_BALANCE'),
              };
            })
          );

          console.log('Resultado final:', result);
          return result;
        },
      }),
    },
  };
});