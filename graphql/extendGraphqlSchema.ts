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

          // Si hay pago por transferencia, crear la transacción
          if (bankPaidAmount > 0) {
            await context.db.Transaction.createOne({
              data: {
                amount: bankPaidAmount.toFixed(2),
                date: new Date(paymentDate),
                type: 'TRANSFER',
                description: `Transferencia de pago de préstamo - ${paymentDate}`,
                sourceAccount: { connect: { id: cashAccount.id } },
                destinationAccount: { connect: { id: bankAccount.id } }
              }
            });

            // Actualizar los saldos de las cuentas
            await context.db.Account.updateOne({
              where: { id: cashAccount.id },
              data: {
                amount: (parseFloat(cashAccount.amount?.toString() || '0') - bankPaidAmount).toFixed(2)
              }
            });

            await context.db.Account.updateOne({
              where: { id: bankAccount.id },
              data: {
                amount: (parseFloat(bankAccount.amount?.toString() || '0') + bankPaidAmount).toFixed(2)
              }
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
                } else {
                  // Cambio de transferencia a efectivo: restar del banco y sumar al efectivo
                  bankAmount -= oldAmount;
                  cashAmount += oldAmount;
                }
              } else {
                // Si no cambió el método, solo aplicamos la diferencia
                if (payment.paymentMethod === 'CASH') {
                  cashAmount -= (newAmount - oldAmount);
                } else {
                  bankAmount -= (newAmount - oldAmount);
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
  };
});