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
                receivedAt: new Date(paymentDate),
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
          const existingPayment = await context.db.LeadPaymentReceived.findOne({
            where: { id },
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
          const agentRoutes = await context.db.Route.findMany({
            where: { 
              employees: { some: { id: { equals: agentId } } }
            }
          });

          if (!agentRoutes || agentRoutes.length === 0) {
            throw new Error(`Ruta no encontrada para el agente ${agentId}`);
          }

          const agentRoute = agentRoutes[0];

          // Obtener las cuentas de la ruta
          const routeAccounts = await context.db.Account.findMany({
            where: { route: { id: { equals: agentRoute.id } } }
          });

          const routeCashAccount = routeAccounts.find((account: any) => account.type === 'EMPLOYEE_CASH_FUND');
          const routeBankAccount = routeAccounts.find((account: any) => account.type === 'BANK');

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

              // Actualizar pago existente usando context.db para asegurar que se disparen los hooks
              await context.db.LoanPayment.updateOne({
                where: { id: existingPayment.id },
                data: {
                  amount: payment.amount.toFixed(2),
                  comission: payment.comission.toFixed(2),
                  type: payment.type,
                  paymentMethod: payment.paymentMethod,
                  receivedAt: new Date(paymentDate),
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
                  receivedAt: new Date(paymentDate),
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
              resolve: (item: any) => item.date
            }),
            locality: graphql.field({ 
              type: graphql.nonNull(graphql.String),
              resolve: (item: any) => item.locality
            }),
            abono: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.abono
            }),
            credito: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.credito
            }),
            viatic: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.viatic
            }),
            gasoline: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.gasoline
            }),
            accommodation: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.accommodation
            }),
            nominaSalary: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.nominaSalary
            }),
            externalSalary: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.externalSalary
            }),
            vehiculeMaintenance: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.vehiculeMaintenance
            }),
            loanGranted: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.loanGranted
            }),
            loanPaymentComission: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.loanPaymentComission
            }),
            loanGrantedComission: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.loanGrantedComission
            }),
            leadComission: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.leadComission
            }),
            moneyInvestment: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.moneyInvestment
            }),
            otro: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.otro
            }),
            balance: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.balance
            }),
            profit: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.profit
            }),
            cashBalance: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.cashBalance
            }),
            bankBalance: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.bankBalance
            }),
            cashAbono: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.cashAbono
            }),
            bankAbono: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.bankAbono
            }),
          },
        })))),
        args: {
          startDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          endDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        resolve: async (root, { startDate, endDate }, context: Context) => {
          // Normalizar las fechas al inicio y fin del día en la zona horaria local
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);

          console.log('Buscando transacciones entre:', {
            start: start.toISOString(),
            end: end.toISOString()
          });

          console.log('Buscando transacciones entre:', {
            start: start.toISOString(),
            end: end.toISOString()
          });

          // Obtenemos todas las transacciones dentro del rango de fechas especificado
          const rangeTransactions = await context.db.Transaction.findMany({
            where: {
              date: {
                gte: start,
                lte: end,
              },
            },
          });
          
          console.log(`Obtenidas ${rangeTransactions.length} transacciones en el rango`);
          
          // Recopilamos todos los IDs de líderes para obtener sus datos
          const leadIds = new Set<string>();
          rangeTransactions.forEach(transaction => {
            if (transaction.leadId) {
              leadIds.add(transaction.leadId.toString());
            }
          });
          
          console.log(`Encontrados ${leadIds.size} líderes únicos en las transacciones`);
          
          // Obtenemos información de todos los líderes involucrados
          const leads = await context.db.Employee.findMany({
            where: { 
              id: { in: Array.from(leadIds) } 
            },
            orderBy: { id: 'asc' }
          });
          
          console.log(`Obtenidos ${leads.length} líderes con sus datos`);
          
          // Obtenemos datos personales y de localidad para cada líder
          const leadInfoMap = new Map();
          
          // Para cada líder, intentamos obtener su localidad
          for (const lead of leads) {
            try {
              // Obtenemos los datos personales completos del líder
              const personalData = await context.db.PersonalData.findOne({
                where: { id: lead.personalDataId }
              });
              
              if (personalData && personalData.id) {
                // Buscamos las direcciones del líder
                const addresses = await context.db.Address.findMany({
                  where: { personalData: { id: { equals: personalData.id } } }
                });
                
                if (addresses && addresses.length > 0) {
                  // Obtenemos la localidad del líder
                  const location = await context.db.Location.findOne({
                    where: { id: addresses[0].locationId }
                  });
                  
                  if (location && location.municipalityId) {
                    // Obtenemos el municipio
                    const municipality = await context.db.Municipality.findOne({
                      where: { id: location.municipalityId }
                    });
                    
                    if (municipality) {
                      // Obtenemos el estado
                      const state = await context.db.State.findOne({
                        where: { id: municipality.stateId }
                      });
                      
                      if (municipality.name && state && state.name) {
                        leadInfoMap.set(lead.id, {
                          municipality: municipality.name,
                          state: state.name,
                          fullName: personalData.fullName || 'Sin nombre'
                        });
                        console.log(`✅ Líder mapeado: ${lead.id} (${personalData.fullName}) → ${municipality.name}, ${state.name}`);
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.error(`Error obteniendo datos para líder ${lead.id}:`, error);
            }
          }
          
          console.log(`Mapa de líderes creado con ${leadInfoMap.size} entradas`);
          
          // Obtenemos información de todas las cuentas relevantes
          const accountIds = new Set<string>();
          rangeTransactions.forEach(transaction => {
            if (transaction.sourceAccountId) accountIds.add(transaction.sourceAccountId.toString());
            if (transaction.destinationAccountId) accountIds.add(transaction.destinationAccountId.toString());
          });
          
          const accounts = await context.db.Account.findMany({
            where: { 
              id: { in: Array.from(accountIds) } 
            }
          });
          
          const accountMap = new Map();
          accounts.forEach(account => {
            accountMap.set(account.id, { 
              name: account.name, 
              type: account.type 
            });
          });
          
          console.log(`Mapa de cuentas creado con ${accountMap.size} entradas`);

          console.log('=== INICIO DE PROCESAMIENTO DE TRANSACCIONES ===');
          console.log(`Total de transacciones encontradas: ${rangeTransactions.length}`);

          // Este objeto almacenará los datos agrupados por fecha y localidad
          // Cada localidad contendrá valores para cada tipo de ingreso o gasto
          // La ruta para obtener la localidad de un líder es:
          // Employee → PersonalData → Address → Location → Municipality → State
          const localidades: Record<string, Record<string, { [key: string]: number }>> = {};

          for (const transaction of rangeTransactions) {
            // Obtener la fecha de la transacción en formato YYYY-MM-DD
            const txDate = transaction.date ? new Date(transaction.date) : new Date();
            const transactionDate = txDate.toISOString().split('T')[0];
            
            console.log(`\n🔍 PROCESANDO TRANSACCIÓN: ${transaction.id} (${transaction.type}) - Fecha: ${transactionDate}`);
            
            // ESTRATEGIA MEJORADA PARA LOCALIDADES:
            let locality = null;
            let state = null;
            let leadName = '';
            let leadId = transaction.leadId;
            let localitySource = 'sin fuente';
            
            // Si tenemos leadId, buscamos primero en el mapa de líderes que ya cargamos
            if (leadId) {
              console.log(`Buscando localidad para líder ${leadId} en el mapa (${leadInfoMap.size} entradas)`);
              
              if (leadInfoMap.has(leadId)) {
                const leadInfo = leadInfoMap.get(leadId);
                locality = leadInfo.municipality;
                state = leadInfo.state;
                leadName = leadInfo.fullName;
                localitySource = 'mapa de líderes';
                
                console.log(`✅ LOCALIDAD ENCONTRADA EN MAPA: ${locality}, ${state} (${leadName})`);
              } else {
                console.log(`⚠️ LÍDER NO ENCONTRADO: ${leadId} no está en el mapa`);
              }
            }
            
            // Usar 'General' como último recurso si no hay localidad
            locality = locality || 'General';
            state = state || 'General';
            
            const localityWithLeader = `${locality} - ${state}`;
            console.log(`📍 LOCALIDAD FINAL: "${localityWithLeader}" (${localitySource}) para ${transaction.id}`);
            
            // Obtener información de cuentas
            const sourceAccount = (transaction.sourceAccountId) ? accountMap.get(transaction.sourceAccountId) : null;
            const destinationAccount = (transaction.destinationAccountId) ? accountMap.get(transaction.destinationAccountId) : null;

            console.log('=== DETALLE DE TRANSACCIÓN ===');
            console.log({
              id: transaction.id,
              fecha: transactionDate,
              tipo: transaction.type,
              monto: transaction.amount,
              fuente: transaction.incomeSource,
              localidad: localityWithLeader,
              liderId: transaction.leadId || 'N/A',
              liderNombre: leadName || 'N/A',
              cuentaOrigen: {
                id: transaction.sourceAccountId || 'N/A',
                tipo: sourceAccount?.type || 'N/A',
                nombre: sourceAccount?.name || 'N/A'
              },
              cuentaDestino: {
                id: transaction.destinationAccountId || 'N/A',
                tipo: destinationAccount?.type || 'N/A',
                nombre: destinationAccount?.name || 'N/A'
              }
            });

            // Para cada transacción, inicializamos las estructuras de datos necesarias
            if (!localidades[transactionDate]) {
              localidades[transactionDate] = {};
            }
            
            // Utilizamos los valores de localidad y estado determinados anteriormente
            // Inicializamos la estructura para esta localidad si no existe
            if (!localidades[transactionDate][localityWithLeader]) {
              localidades[transactionDate][localityWithLeader] = {
                ABONO: 0, CASH_ABONO: 0, BANK_ABONO: 0,
                CREDITO: 0, VIATIC: 0, GASOLINE: 0, ACCOMMODATION: 0,
                NOMINA_SALARY: 0, EXTERNAL_SALARY: 0, VEHICULE_MAINTENANCE: 0,
                LOAN_GRANTED: 0, LOAN_PAYMENT_COMISSION: 0,
                LOAN_GRANTED_COMISSION: 0, LEAD_COMISSION: 0,
                MONEY_INVESMENT: 0, OTRO: 0, CASH_BALANCE: 0, BANK_BALANCE: 0
              };
            }



            if (transaction.type === 'INCOME') {
              console.log(`\n--- PROCESANDO TRANSACCIÓN DE INGRESO: ${transaction.id} (${localityWithLeader}) ---`);
              
              // Determinar si es una transacción bancaria basado en la información de las cuentas
              const isBankTransaction = transaction.incomeSource === 'BANK_LOAN_PAYMENT' || 
                                       destinationAccount?.type === 'BANK';
              
              console.log('¿Es transacción bancaria?', isBankTransaction);
              console.log('Tipo de cuenta origen:', sourceAccount?.type);
              console.log('Tipo de cuenta destino:', destinationAccount?.type);
              console.log('Fuente de ingreso:', transaction.incomeSource);
              
              // Procesamos el abono según su tipo (efectivo o banco)
              const amount = Number(transaction.amount || 0);
              if (isBankTransaction) {
                console.log(`💰 Procesando como ABONO BANCARIO: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].BANK_ABONO += amount;
                localidades[transactionDate][localityWithLeader].BANK_BALANCE += amount;
              } else {
                console.log(`💵 Procesando como ABONO EN EFECTIVO: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].CASH_ABONO += amount;
                localidades[transactionDate][localityWithLeader].CASH_BALANCE += amount;
              }

              // Sumamos al ABONO general
              localidades[transactionDate][localityWithLeader].ABONO += amount;

              console.log(`✅ Totales actualizados para ${localityWithLeader}:`, {
                abonoTotal: localidades[transactionDate][localityWithLeader].ABONO,
                abonoEfectivo: localidades[transactionDate][localityWithLeader].CASH_ABONO,
                abonoBanco: localidades[transactionDate][localityWithLeader].BANK_ABONO,
                balanceEfectivo: localidades[transactionDate][localityWithLeader].CASH_BALANCE,
                balanceBanco: localidades[transactionDate][localityWithLeader].BANK_BALANCE
              });
            } else if (transaction.type === 'EXPENSE') {
              console.log('\n--- PROCESANDO TRANSACCIÓN DE GASTO ---');
              console.log('Fuente de gasto:', transaction.incomeSource);
              
              // Procesar diferentes tipos de gastos
              const amount = Number(transaction.amount || 0);
              
              // Determinar si es un gasto en efectivo o bancario
              const isBankExpense = sourceAccount?.type === 'BANK';
              console.log('¿Es gasto bancario?', isBankExpense);
              
              // Verificar el tipo de gasto según incomeSource y actualizar los balances
              if (transaction.incomeSource === 'GASOLINE') {
                console.log(`⛽ Procesando gasto de GASOLINA: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].GASOLINE += amount;
                
                // Actualizar el balance correspondiente
                if (isBankExpense) {
                  localidades[transactionDate][localityWithLeader].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][localityWithLeader].CASH_BALANCE -= amount;
                }
              } else if (transaction.incomeSource === 'VIATIC') {
                console.log(`🚌 Procesando gasto de VIÁTICOS: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].VIATIC += amount;
                
                // Actualizar el balance correspondiente
                if (isBankExpense) {
                  localidades[transactionDate][localityWithLeader].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][localityWithLeader].CASH_BALANCE -= amount;
                }
              } else if (transaction.incomeSource === 'ACCOMMODATION') {
                console.log(`🏨 Procesando gasto de HOSPEDAJE: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].ACCOMMODATION += amount;
                
                // Actualizar el balance correspondiente
                if (isBankExpense) {
                  localidades[transactionDate][localityWithLeader].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][localityWithLeader].CASH_BALANCE -= amount;
                }
              } else if (transaction.incomeSource === 'VEHICULE_MAINTENANCE') {
                console.log(`🔧 Procesando gasto de MANTENIMIENTO DE VEHÍCULO: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].VEHICULE_MAINTENANCE += amount;
                
                // Actualizar el balance correspondiente
                if (isBankExpense) {
                  localidades[transactionDate][localityWithLeader].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][localityWithLeader].CASH_BALANCE -= amount;
                }
              } else if (transaction.incomeSource === 'NOMINA_SALARY') {
                console.log(`💼 Procesando gasto de SALARIO DE NÓMINA: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].NOMINA_SALARY += amount;
                
                // Actualizar el balance correspondiente
                if (isBankExpense) {
                  localidades[transactionDate][localityWithLeader].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][localityWithLeader].CASH_BALANCE -= amount;
                }
              } else if (transaction.incomeSource === 'EXTERNAL_SALARY') {
                console.log(`👷‍♂️ Procesando gasto de SALARIO EXTERNO: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].EXTERNAL_SALARY += amount;
                
                // Actualizar el balance correspondiente
                if (isBankExpense) {
                  localidades[transactionDate][localityWithLeader].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][localityWithLeader].CASH_BALANCE -= amount;
                }
              } else if (transaction.incomeSource === 'CREDITO') {
                console.log(`💳 Procesando gasto de CRÉDITO: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].CREDITO += amount;
                
                // Actualizar el balance correspondiente
                if (isBankExpense) {
                  localidades[transactionDate][localityWithLeader].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][localityWithLeader].CASH_BALANCE -= amount;
                }
              } else if (transaction.incomeSource === 'LOAN_GRANTED') {
                console.log(`🏦 Procesando gasto de PRÉSTAMO OTORGADO: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].LOAN_GRANTED += amount;
                
                // Actualizar el balance correspondiente
                if (isBankExpense) {
                  localidades[transactionDate][localityWithLeader].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][localityWithLeader].CASH_BALANCE -= amount;
                }
              } else {
                console.log(`📊 Procesando OTRO tipo de gasto: $${amount} para ${localityWithLeader}`);
                localidades[transactionDate][localityWithLeader].OTRO += amount;
                
                // Actualizar el balance correspondiente
                if (isBankExpense) {
                  localidades[transactionDate][localityWithLeader].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][localityWithLeader].CASH_BALANCE -= amount;
                }
              }
              
              // Mostrar los balances actualizados después del gasto
              console.log(`✅ Balances actualizados para ${localityWithLeader} después del gasto:`, {
                balanceEfectivo: localidades[transactionDate][localityWithLeader].CASH_BALANCE,
                balanceBanco: localidades[transactionDate][localityWithLeader].BANK_BALANCE
              });
              
              console.log(`✅ Gastos actualizados para ${localityWithLeader}:`, {
                gasolina: localidades[transactionDate][localityWithLeader].GASOLINE,
                viaticos: localidades[transactionDate][localityWithLeader].VIATIC,
                hospedaje: localidades[transactionDate][localityWithLeader].ACCOMMODATION,
                mantenimiento: localidades[transactionDate][localityWithLeader].VEHICULE_MAINTENANCE,
                credito: localidades[transactionDate][localityWithLeader].CREDITO,
                prestamos: localidades[transactionDate][localityWithLeader].LOAN_GRANTED,
                otros: localidades[transactionDate][localityWithLeader].OTRO
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