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
          // Usar transacción para garantizar atomicidad
          return await context.prisma.$transaction(async (tx) => {
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

            // Obtener todas las cuentas del agente en una sola query
            const agentAccounts = await tx.account.findMany({
              where: { 
                route: { 
                  employees: { 
                    some: { id: agentId } 
                  } 
                },
                type: { 
                  in: ['EMPLOYEE_CASH_FUND', 'BANK'] 
                }
              }
            });

            const cashAccount = agentAccounts.find((account: any) => account.type === 'EMPLOYEE_CASH_FUND');
            const bankAccount = agentAccounts.find((account: any) => account.type === 'BANK');

            if (!cashAccount) {
              throw new Error('Cuenta de efectivo no encontrada');
            }

            if (!bankAccount) {
              throw new Error('Cuenta bancaria no encontrada');
            }

            // Crear el LeadPaymentReceived
            const leadPaymentReceived = await tx.leadPaymentReceived.create({
              data: {
                expectedAmount: expectedAmount.toFixed(2),
                paidAmount: totalPaidAmount.toFixed(2),
                cashPaidAmount: cashPaidAmount.toFixed(2),
                bankPaidAmount: bankPaidAmount.toFixed(2),
                falcoAmount: falcoAmount > 0 ? falcoAmount.toFixed(2) : '0.00',
                createdAt: new Date(paymentDate),
                paymentStatus,
                agentId,
                leadId,
              },
            });

            // Crear todos los pagos usando createMany para performance
            const createdPayments: any[] = [];
            if (payments.length > 0) {
              const paymentData = payments.map(payment => ({
                amount: payment.amount.toFixed(2),
                comission: payment.comission.toFixed(2),
                loanId: payment.loanId,
                type: payment.type,
                paymentMethod: payment.paymentMethod,
                receivedAt: new Date(paymentDate),
                leadPaymentReceivedId: leadPaymentReceived.id,
              }));

              await tx.loanPayment.createMany({ data: paymentData });

              // Obtener los pagos creados para crear las transacciones
              const createdPaymentRecords = await tx.loanPayment.findMany({
                where: { leadPaymentReceivedId: leadPaymentReceived.id }
              });

              // Crear las transacciones manualmente (lógica del hook)
              const transactionData = [];
              let cashAmountChange = 0;
              let bankAmountChange = 0;

              for (const payment of createdPaymentRecords) {
                const paymentAmount = parseFloat((payment.amount || 0).toString());
                
                // Preparar datos de transacción
                transactionData.push({
                  amount: (payment.amount || 0).toString(),
                  date: new Date(paymentDate),
                  type: 'INCOME',
                  incomeSource: payment.paymentMethod === 'CASH' ? 'CASH_LOAN_PAYMENT' : 'BANK_LOAN_PAYMENT',
                  loanPaymentId: payment.id,
                  loanId: payment.loanId,
                  leadId: leadId, // Aquí está el leadId que estaba faltando!
                });

                // Acumular cambios en balances
                if (payment.paymentMethod === 'CASH') {
                  cashAmountChange += paymentAmount;
                } else {
                  bankAmountChange += paymentAmount;
                }
              }

              // Crear todas las transacciones de una vez
              if (transactionData.length > 0) {
                await tx.transaction.createMany({ data: transactionData });
              }

              // Actualizar balances de cuentas si hay cambios
              if (cashAmountChange > 0) {
                const currentCashAmount = parseFloat((cashAccount.amount || 0).toString());
                await tx.account.update({
                  where: { id: cashAccount.id },
                  data: { amount: (currentCashAmount + cashAmountChange).toString() }
                });
              }

              if (bankAmountChange > 0) {
                const currentBankAmount = parseFloat((bankAccount.amount || 0).toString());
                await tx.account.update({
                  where: { id: bankAccount.id },
                  data: { amount: (currentBankAmount + bankAmountChange).toString() }
                });
              }

              // Validar si los préstamos están completados y marcarlos como terminados
              for (const payment of createdPaymentRecords) {
                const loan = await tx.loan.findUnique({
                  where: { id: payment.loanId },
                  include: {
                    loantype: true,
                    payments: true
                  }
                });

                if (loan && (loan as any).loantype) {
                  // Calcular el monto total que debe pagar (principal + intereses)
                  // Si rate es 0.4, significa 40% de interés
                  const rate = (loan as any).loantype.rate ? parseFloat((loan as any).loantype.rate.toString()) : 0;
                  const totalAmountToPay = parseFloat(loan.requestedAmount.toString()) * (1 + rate);
                  
                  // Calcular el total pagado hasta ahora
                  const totalPaid = (loan as any).payments.reduce((sum: number, p: any) => {
                    return sum + parseFloat((p.amount || 0).toString());
                  }, 0);

                  // Si el total pagado es mayor o igual al monto total a pagar, marcar como terminado
                  if (totalPaid >= totalAmountToPay) {
                    await tx.loan.update({
                      where: { id: loan.id },
                      data: { 
                        finishedDate: new Date()
                      }
                    });
                  }
                }
              }
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
          });
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
          // Usar transacción para garantizar atomicidad y optimizar performance
          return await context.prisma.$transaction(async (tx) => {
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

            // Obtener el LeadPaymentReceived existente con pagos y transacciones relacionadas
            const existingPayment = await tx.leadPaymentReceived.findUnique({
              where: { id },
              include: {
                payments: {
                  include: {
                    transactions: true
                  }
                }
              }
            });

            if (!existingPayment) {
              throw new Error('Pago no encontrado');
            }

            const agentId = existingPayment.agentId || '';
            const leadId = existingPayment.leadId || '';

            // Obtener cuentas del agente para calcular cambios en balances
            const agentAccounts = await tx.account.findMany({
              where: { 
                route: { 
                  employees: { 
                    some: { id: agentId } 
                  } 
                },
                type: { 
                  in: ['EMPLOYEE_CASH_FUND', 'BANK'] 
                }
              }
            });

            const cashAccount = agentAccounts.find((account: any) => account.type === 'EMPLOYEE_CASH_FUND');
            const bankAccount = agentAccounts.find((account: any) => account.type === 'BANK');

            if (!cashAccount || !bankAccount) {
              throw new Error('Cuentas del agente no encontradas');
            }

            // Calcular cambios en balances de pagos existentes (para revertir)
            let oldCashAmountChange = 0;
            let oldBankAmountChange = 0;

            for (const payment of existingPayment.payments) {
              const paymentAmount = parseFloat((payment.amount || 0).toString());
              if (payment.paymentMethod === 'CASH') {
                oldCashAmountChange += paymentAmount;
              } else {
                oldBankAmountChange += paymentAmount;
              }
            }

            // Eliminar transacciones existentes en lote
            if (existingPayment.payments.length > 0) {
              const transactionIds = existingPayment.payments
                .flatMap((payment: any) => payment.transactions.map((t: any) => t.id));
              
              if (transactionIds.length > 0) {
                await tx.transaction.deleteMany({
                  where: { id: { in: transactionIds } }
                });
              }

              // Eliminar pagos existentes en lote
              await tx.loanPayment.deleteMany({
                where: { leadPaymentReceivedId: id }
              });
            }

            // Actualizar el LeadPaymentReceived
            const leadPaymentReceived = await tx.leadPaymentReceived.update({
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

            // Crear nuevos pagos y transacciones en lote
            let newCashAmountChange = 0;
            let newBankAmountChange = 0;

            if (payments.length > 0) {
              // Crear pagos en lote
              const paymentData = payments.map(payment => ({
                amount: payment.amount.toFixed(2),
                comission: payment.comission.toFixed(2),
                loanId: payment.loanId,
                type: payment.type,
                paymentMethod: payment.paymentMethod,
                receivedAt: new Date(paymentDate),
                leadPaymentReceivedId: leadPaymentReceived.id,
              }));

              await tx.loanPayment.createMany({ data: paymentData });

              // Obtener los pagos creados para crear las transacciones
              const createdPaymentRecords = await tx.loanPayment.findMany({
                where: { leadPaymentReceivedId: leadPaymentReceived.id }
              });

              // Crear las transacciones manualmente en lote
              const transactionData = [];

              for (const payment of createdPaymentRecords) {
                const paymentAmount = parseFloat((payment.amount || 0).toString());
                
                // Preparar datos de transacción
                transactionData.push({
                  amount: (payment.amount || 0).toString(),
                  date: new Date(paymentDate),
                  type: 'INCOME',
                  incomeSource: payment.paymentMethod === 'CASH' ? 'CASH_LOAN_PAYMENT' : 'BANK_LOAN_PAYMENT',
                  loanPaymentId: payment.id,
                  loanId: payment.loanId,
                  leadId: leadId,
                });

                // Acumular cambios en balances
                if (payment.paymentMethod === 'CASH') {
                  newCashAmountChange += paymentAmount;
                } else {
                  newBankAmountChange += paymentAmount;
                }
              }

              // Crear todas las transacciones de una vez
              if (transactionData.length > 0) {
                await tx.transaction.createMany({ data: transactionData });
              }
            }

            // Actualizar balances de cuentas (revertir antiguos y aplicar nuevos)
            const cashBalanceChange = newCashAmountChange - oldCashAmountChange;
            const bankBalanceChange = newBankAmountChange - oldBankAmountChange;

            if (cashBalanceChange !== 0) {
              const currentCashAmount = parseFloat((cashAccount.amount || 0).toString());
              await tx.account.update({
                where: { id: cashAccount.id },
                data: { amount: (currentCashAmount + cashBalanceChange).toString() }
              });
            }

            if (bankBalanceChange !== 0) {
              const currentBankAmount = parseFloat((bankAccount.amount || 0).toString());
              await tx.account.update({
                where: { id: bankAccount.id },
                data: { amount: (currentBankAmount + bankBalanceChange).toString() }
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
          });
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

          // OPTIMIZADO: Obtenemos todas las transacciones dentro del rango de fechas especificado
          const rangeTransactions = await context.db.Transaction.findMany({
            where: {
              date: {
                gte: start,
                lte: end,
              },
            },
          });
          
          console.log(`Obtenidas ${rangeTransactions.length} transacciones en el rango`);
          
          // DEBUG: Analizar todas las transacciones para encontrar problemas
          console.log('\n=== ANÁLISIS DE TRANSACCIONES ===');
          const transactionsByLeadId = new Map();
          rangeTransactions.forEach(transaction => {
            const leadId = transaction.leadId?.toString() || 'sin-lead';
            if (!transactionsByLeadId.has(leadId)) {
              transactionsByLeadId.set(leadId, []);
            }
            transactionsByLeadId.get(leadId).push({
              id: transaction.id,
              type: transaction.type,
              amount: transaction.amount,
              incomeSource: transaction.incomeSource,
              expenseSource: transaction.expenseSource,
              date: transaction.date
            });
          });
          
          // DEBUG ESPECÍFICO: Buscar transacciones de Rafaela
          console.log('\n🔍 BÚSQUEDA ESPECÍFICA: Rafaela Baeza Carrillo');
          let rafaelaTransactions = 0;
          rangeTransactions.forEach(transaction => {
            // Buscar en diferentes campos que podrían contener información de Rafaela
            const description = transaction.description?.toLowerCase() || '';
            const hasRafaela = description.includes('rafaela') || description.includes('baeza') || description.includes('carrillo');
            
            if (hasRafaela) {
              rafaelaTransactions++;
              console.log(`  📝 Transacción posible de Rafaela: ${transaction.id}`);
              console.log(`     - leadId: ${transaction.leadId || 'NULL'}`);
              console.log(`     - type: ${transaction.type}`);
              console.log(`     - amount: ${transaction.amount}`);
              console.log(`     - description: ${transaction.description || 'sin descripción'}`);
              console.log(`     - incomeSource: ${transaction.incomeSource || 'NULL'}`);
              console.log(`     - expenseSource: ${transaction.expenseSource || 'NULL'}`);
            }
          });
                     console.log(`   Total transacciones con menciones de Rafaela: ${rafaelaTransactions}`);
          
          // OPTIMIZADO: Recopilamos todos los IDs de líderes únicos para minimizar consultas
          const leadIds = new Set<string>();
          rangeTransactions.forEach(transaction => {
            if (transaction.leadId) {
              leadIds.add(transaction.leadId.toString());
            }
          });
          
          // OPTIMIZADO: Una sola consulta para obtener todos los líderes con sus datos personales
          const leads = await context.db.Employee.findMany({
            where: { 
              id: { in: Array.from(leadIds) } 
            },
            orderBy: { id: 'asc' }
          });
          
          // OPTIMIZADO: Obtenemos todos los PersonalData de una vez
          const personalDataIds = leads.map(lead => lead.personalDataId).filter(Boolean) as string[];
          
          const personalDataList = await context.db.PersonalData.findMany({
            where: { id: { in: personalDataIds } }
          });
          
          // DEBUG ESPECÍFICO: Buscar Rafaela en PersonalData
          personalDataList.forEach(pd => {
            const fullName = pd.fullName?.toLowerCase() || '';
            if (fullName.includes('rafaela') || fullName.includes('baeza') || fullName.includes('carrillo')) {
              console.log(`🎯 ENCONTRADO PERSONALDATA DE RAFAELA: ${pd.id} - ${pd.fullName}`);
            }
          });
          
          // OPTIMIZADO: Cache de datos personales por ID
          const personalDataMap = new Map();
          personalDataList.forEach(pd => {
            personalDataMap.set(pd.id, pd);
          });
          
          // OPTIMIZADO: Obtenemos todas las direcciones de una vez
          const addresses = await context.db.Address.findMany({
            where: { personalData: { id: { in: personalDataIds } } }
          });
          
          // OPTIMIZADO: Cache de direcciones por personalDataId
          const addressMap = new Map();
          addresses.forEach(addr => {
            if (!addressMap.has(addr.personalDataId)) {
              addressMap.set(addr.personalDataId, []);
            }
            addressMap.get(addr.personalDataId).push(addr);
          });
          
          // OPTIMIZADO: Obtenemos todas las localidades, municipios y estados de una vez
          const locationIds = addresses.map(addr => addr.locationId).filter(Boolean) as string[];
          const locations = await context.db.Location.findMany({
            where: { id: { in: locationIds } }
          });
          
          // DEBUG ESPECÍFICO: Buscar Calkiní en localidades
          locations.forEach(loc => {
            const locationName = loc.name?.toLowerCase() || '';
            if (locationName.includes('calkini') || locationName.includes('calkiní')) {
              console.log(`🎯 ENCONTRADA LOCALIDAD CALKINÍ: ${loc.id} - ${loc.name}`);
            }
          });
          
          const municipalityIds = locations.map(loc => loc.municipalityId).filter(Boolean) as string[];
          const municipalities = await context.db.Municipality.findMany({
            where: { id: { in: municipalityIds } }
          });
          
          // DEBUG ESPECÍFICO: Buscar Calkiní en municipios
          municipalities.forEach(mun => {
            const munName = mun.name?.toLowerCase() || '';
            if (munName.includes('calkini') || munName.includes('calkiní')) {
              console.log(`🎯 ENCONTRADO MUNICIPIO CALKINÍ: ${mun.id} - ${mun.name}`);
            }
          });
          
          const stateIds = municipalities.map(mun => mun.stateId).filter(Boolean) as string[];
          const states = await context.db.State.findMany({
            where: { id: { in: stateIds } }
          });
          
          // OPTIMIZADO: Crear mapas de cache para lookups rápidos
          const locationMap = new Map();
          locations.forEach(loc => locationMap.set(loc.id, loc));
          
          const municipalityMap = new Map();
          municipalities.forEach(mun => municipalityMap.set(mun.id, mun));
          
          const stateMap = new Map();
          states.forEach(state => stateMap.set(state.id, state));
          
          // OPTIMIZADO: Crear mapa de localidades por líder
          const leadInfoMap = new Map();
          
          leads.forEach(lead => {
            if (lead.personalDataId) {
              const personalData = personalDataMap.get(lead.personalDataId);
              
              if (personalData) {
                const leaderAddresses = addressMap.get(personalData.id) || [];
                
                if (leaderAddresses.length > 0) {
                  const address = leaderAddresses[0]; // Primera dirección
                  const location = locationMap.get(address.locationId);
                  
                  if (location && location.municipalityId) {
                    const municipality = municipalityMap.get(location.municipalityId);
                    
                    if (municipality && municipality.stateId) {
                      const state = stateMap.get(municipality.stateId);
                      
                      if (municipality.name && state && state.name) {
                        leadInfoMap.set(lead.id, {
                          municipality: municipality.name,
                          state: state.name,
                          fullName: personalData.fullName || 'Sin nombre'
                        });
                        
                        // DEBUG ESPECÍFICO: Verificar si es Rafaela/Calkiní
                        const fullName = personalData.fullName?.toLowerCase() || '';
                        const munName = municipality.name?.toLowerCase() || '';
                        const isRafaela = fullName.includes('rafaela') || fullName.includes('baeza') || fullName.includes('carrillo');
                        const isCalkiní = munName.includes('calkini') || munName.includes('calkiní');
                        
                        if (isRafaela || isCalkiní) {
                          console.log(`🎯 RAFAELA/CALKINÍ EN MAPA FINAL:`);
                          console.log(`   - leadId: ${lead.id}`);
                          console.log(`   - fullName: ${personalData.fullName}`);
                          console.log(`   - municipality: ${municipality.name}`);
                          console.log(`   - state: ${state.name}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          });
          
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

          // DEBUG ESPECÍFICO: Búsqueda directa de Rafaela en la base de datos
          console.log('\n🔍 BÚSQUEDA DIRECTA DE RAFAELA EN LA BASE DE DATOS');
          
          const rafaelaEmployees = await context.db.Employee.findMany({
            where: {
              personalData: {
                fullName: {
                  contains: 'Rafaela',
                  mode: 'insensitive'
                }
              }
            }
          });
          
          console.log(`   Empleados con nombre Rafaela encontrados: ${rafaelaEmployees.length}`);
          rafaelaEmployees.forEach(emp => {
            console.log(`     - Employee ID: ${emp.id}, personalDataId: ${emp.personalDataId}`);
          });
          
          // También buscar por apellidos
          const baezaEmployees = await context.db.Employee.findMany({
            where: {
              personalData: {
                fullName: {
                  contains: 'Baeza',
                  mode: 'insensitive'
                }
              }
            }
          });
          
          console.log(`   Empleados con apellido Baeza encontrados: ${baezaEmployees.length}`);
          baezaEmployees.forEach(emp => {
            console.log(`     - Employee ID: ${emp.id}, personalDataId: ${emp.personalDataId}`);
          });
          
          // Buscar localidades con Calkiní
          const calkiniLocations = await context.db.Location.findMany({
            where: {
              OR: [
                { name: { contains: 'Calkiní', mode: 'insensitive' } },
                { name: { contains: 'Calkini', mode: 'insensitive' } }
              ]
            }
          });
          
          console.log(`   Localidades con Calkiní encontradas: ${calkiniLocations.length}`);
          calkiniLocations.forEach(loc => {
            console.log(`     - Location ID: ${loc.id}, name: ${loc.name}`);
          });
          
          // DEBUG: Cruzar leadIds de transacciones con empleados de Rafaela encontrados
          console.log('\n🔗 CRUZANDO leadIds CON EMPLEADOS DE RAFAELA');
          const rafaelaEmployeeIds = [...rafaelaEmployees.map(emp => emp.id), ...baezaEmployees.map(emp => emp.id)];
          console.log(`   IDs de empleados Rafaela/Baeza: [${rafaelaEmployeeIds.join(', ')}]`);
          
          let transactionsWithRafaelaId = 0;
          rangeTransactions.forEach(transaction => {
            if (transaction.leadId && rafaelaEmployeeIds.includes(transaction.leadId)) {
              transactionsWithRafaelaId++;
              console.log(`     ✅ Transacción con leadId de Rafaela: ${transaction.id} (leadId: ${transaction.leadId})`);
              console.log(`        - type: ${transaction.type}, amount: ${transaction.amount}`);
            }
          });
          console.log(`   Total transacciones con leadId de Rafaela: ${transactionsWithRafaelaId}`);
          
          console.log('\n=== PROCESANDO TRANSACCIONES ===');

          // Este objeto almacenará los datos agrupados por fecha y localidad
          // Cada localidad contendrá valores para cada tipo de ingreso o gasto
          // La ruta para obtener la localidad de un líder es:
          // Employee → PersonalData → Address → Location → Municipality → State
          const localidades: Record<string, Record<string, { [key: string]: number }>> = {};

          for (const transaction of rangeTransactions) {
            // Obtener la fecha de la transacción en formato YYYY-MM-DD
            const txDate = transaction.date ? new Date(transaction.date) : new Date();
            const transactionDate = txDate.toISOString().split('T')[0];
            
            // ESTRATEGIA MEJORADA PARA LOCALIDADES:
            let locality = null;
            let state = null;
            let leadName = '';
            let leadId = transaction.leadId;
            let localitySource = 'sin fuente';
            
            // Si tenemos leadId, buscamos primero en el mapa de líderes que ya cargamos
            if (leadId) {
              if (leadInfoMap.has(leadId)) {
                const leadInfo = leadInfoMap.get(leadId);
                locality = leadInfo.municipality;
                state = leadInfo.state;
                leadName = leadInfo.fullName;
                localitySource = 'mapa de líderes';
              } else {
                // Verificar si es por problema de tipo
                const leadIdString = leadId.toString();
                if (leadInfoMap.has(leadIdString)) {
                  const leadInfo = leadInfoMap.get(leadIdString);
                  locality = leadInfo.municipality;
                  state = leadInfo.state;
                  leadName = leadInfo.fullName;
                  localitySource = 'mapa de líderes (string)';
                }
              }
            }
            
            // Construir la clave de agrupación con líder + localidad + municipio
            let leaderKey = '';
            if (leadName && leadName !== '') {
              if (locality && state && locality !== 'General' && state !== 'General') {
                leaderKey = `${leadName} - ${locality}, ${state}`;
              } else {
                leaderKey = leadName;
              }
            } else if (leadId) {
              leaderKey = `Líder ID: ${leadId}`;
            } else {
              leaderKey = 'General';
            }
            
            // DEBUG: Solo log si es Rafaela/Calkiní
            const isRafaelaTransaction = leadName.toLowerCase().includes('rafaela') || 
                                       leadName.toLowerCase().includes('baeza') || 
                                       leadName.toLowerCase().includes('carrillo') ||
                                       leaderKey.toLowerCase().includes('calkini') ||
                                       leaderKey.toLowerCase().includes('calkiní');
            
            if (isRafaelaTransaction) {
              console.log(`🎯 TRANSACCIÓN DE RAFAELA/CALKINÍ: ${transaction.id}`);
              console.log(`   - leadId: ${leadId}`);
              console.log(`   - leadName: ${leadName}`);
              console.log(`   - leaderKey: ${leaderKey}`);
              console.log(`   - type: ${transaction.type}`);
              console.log(`   - amount: ${transaction.amount}`);
              console.log(`   - date: ${transactionDate}`);
            }
            
            // Obtener información de cuentas
            const sourceAccount = (transaction.sourceAccountId) ? accountMap.get(transaction.sourceAccountId) : null;
            const destinationAccount = (transaction.destinationAccountId) ? accountMap.get(transaction.destinationAccountId) : null;

            // Para cada transacción, inicializamos las estructuras de datos necesarias
            if (!localidades[transactionDate]) {
              localidades[transactionDate] = {};
            }
            
            // Utilizamos el nombre del líder determinado anteriormente
            // Inicializamos la estructura para este líder si no existe
            if (!localidades[transactionDate][leaderKey]) {
              localidades[transactionDate][leaderKey] = {
                ABONO: 0, CASH_ABONO: 0, BANK_ABONO: 0,
                CREDITO: 0, VIATIC: 0, GASOLINE: 0, ACCOMMODATION: 0,
                NOMINA_SALARY: 0, EXTERNAL_SALARY: 0, VEHICULE_MAINTENANCE: 0,
                LOAN_GRANTED: 0, LOAN_PAYMENT_COMISSION: 0,
                LOAN_GRANTED_COMISSION: 0, LEAD_COMISSION: 0,
                MONEY_INVESMENT: 0, OTRO: 0, CASH_BALANCE: 0, BANK_BALANCE: 0
              };
            }



            if (transaction.type === 'INCOME') {
              if (isRafaelaTransaction) {
                console.log(`🎯 PROCESANDO INGRESO DE RAFAELA: $${transaction.amount}`);
              }
              
              // Determinar si es una transacción bancaria basado en la información de las cuentas
              const isBankTransaction = transaction.incomeSource === 'BANK_LOAN_PAYMENT' || 
                                       destinationAccount?.type === 'BANK';
              
              const amount = Number(transaction.amount || 0);
              
              // Procesar diferentes tipos de ingresos
              if (transaction.incomeSource === 'LOAN_PAYMENT' || transaction.incomeSource === 'CASH_LOAN_PAYMENT' || transaction.incomeSource === 'BANK_LOAN_PAYMENT') {
                // Abonos de pagos de préstamos
                if (isBankTransaction) {
                  localidades[transactionDate][leaderKey].BANK_ABONO += amount;
                  localidades[transactionDate][leaderKey].BANK_BALANCE += amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_ABONO += amount;
                  localidades[transactionDate][leaderKey].CASH_BALANCE += amount;
                }
                
                // Sumamos al ABONO general
                localidades[transactionDate][leaderKey].ABONO += amount;
                
              } else if (transaction.incomeSource === 'MONEY_INVESMENT') {
                localidades[transactionDate][leaderKey].MONEY_INVESMENT += amount;
                
                // Actualizar balance correspondiente
                if (isBankTransaction) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE += amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE += amount;
                }
                
              } else {
                // Otros tipos de ingresos se procesan como abonos generales
                if (isBankTransaction) {
                  localidades[transactionDate][leaderKey].BANK_ABONO += amount;
                  localidades[transactionDate][leaderKey].BANK_BALANCE += amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_ABONO += amount;
                  localidades[transactionDate][leaderKey].CASH_BALANCE += amount;
                }

                // Sumamos al ABONO general
                localidades[transactionDate][leaderKey].ABONO += amount;
              }
            } else if (transaction.type === 'EXPENSE') {
              if (isRafaelaTransaction) {
                console.log(`🎯 PROCESANDO GASTO DE RAFAELA: $${transaction.amount} (${transaction.expenseSource})`);
              }
              
              // Procesar diferentes tipos de gastos
              const amount = Number(transaction.amount || 0);
              
              // Determinar si es un gasto en efectivo o bancario
              const isBankExpense = sourceAccount?.type === 'BANK';
              
              // CORREGIDO: Verificar el tipo de gasto según expenseSource
              if (transaction.expenseSource === 'GASOLINE') {
                localidades[transactionDate][leaderKey].GASOLINE += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'VIATIC') {
                localidades[transactionDate][leaderKey].VIATIC += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'ACCOMMODATION') {
                localidades[transactionDate][leaderKey].ACCOMMODATION += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'VEHICULE_MAINTENANCE') {
                localidades[transactionDate][leaderKey].VEHICULE_MAINTENANCE += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'NOMINA_SALARY') {
                localidades[transactionDate][leaderKey].NOMINA_SALARY += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'EXTERNAL_SALARY') {
                localidades[transactionDate][leaderKey].EXTERNAL_SALARY += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'CREDITO') {
                localidades[transactionDate][leaderKey].CREDITO += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'LOAN_GRANTED') {
                localidades[transactionDate][leaderKey].LOAN_GRANTED += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'LOAN_GRANTED_COMISSION') {
                localidades[transactionDate][leaderKey].LOAN_GRANTED_COMISSION += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'LOAN_PAYMENT_COMISSION') {
                localidades[transactionDate][leaderKey].LOAN_PAYMENT_COMISSION += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'LEAD_COMISSION') {
                localidades[transactionDate][leaderKey].LEAD_COMISSION += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else {
                localidades[transactionDate][leaderKey].OTRO += amount;
                if (isBankExpense) {
                  localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                } else {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              }

            }
          }

          // Verificar estadísticas finales
          const localidadesUnicas = new Set();
          Object.entries(localidades).forEach(([date, localities]) => {
            Object.keys(localities).forEach(locality => {
              localidadesUnicas.add(locality);
            });
          });
          
          console.log(`\n📊 RESUMEN: ${localidadesUnicas.size} líderes únicos encontrados`);
          
          // DEBUG: Mostrar solo los líderes únicos para verificar si Rafaela aparece
          const leadersFound = Array.from(localidadesUnicas) as string[];
          leadersFound.forEach(leader => {
            const isRafaela = leader.toLowerCase().includes('rafaela') || 
                            leader.toLowerCase().includes('baeza') || 
                            leader.toLowerCase().includes('carrillo') ||
                            leader.toLowerCase().includes('calkini') ||
                            leader.toLowerCase().includes('calkiní');
            if (isRafaela) {
              console.log(`🎯 RAFAELA ENCONTRADA EN RESULTADOS FINALES: ${leader}`);
            }
          });

          const result = Object.entries(localidades).flatMap(([date, localities]) => 
            Object.entries(localities).map(([locality, data]) => {
              // Verificar si hay valores negativos o inválidos
              const checkValue = (value: number, name: string) => {
                if (isNaN(value) || value < 0) {
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

          return result;
        },
      }),
      
      getMonthlyResume: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
        },
        resolve: async (root, { routeId, year }, context: Context) => {
          try {
            // Obtener las cuentas de la ruta (cash y bank) usando Prisma directamente
            const route = await context.prisma.route.findUnique({
              where: { id: routeId },
              include: {
                accounts: true
              }
            });

            if (!route || !route.accounts) {
              throw new Error('Ruta no encontrada o sin cuentas');
            }

            const cashAccount = route.accounts.find(acc => acc.type === 'EMPLOYEE_CASH_FUND');
            const bankAccount = route.accounts.find(acc => acc.type === 'BANK');

            if (!cashAccount && !bankAccount) {
              throw new Error('No se encontraron cuentas EMPLOYEE_CASH_FUND o BANK para esta ruta');
            }

            const accountIds = [cashAccount?.id, bankAccount?.id].filter(Boolean) as string[];

            // Obtener transacciones del año para las cuentas de la ruta
            const transactions = await context.prisma.transaction.findMany({
              where: {
                OR: [
                  { sourceAccountId: { in: accountIds } },
                  { destinationAccountId: { in: accountIds } }
                ],
                date: {
                  gte: new Date(`${year}-01-01`),
                  lte: new Date(`${year}-12-31T23:59:59.999Z`),
                },
              },
              include: {
                lead: {
                  include: {
                    routes: true,
                    personalData: {
                      include: {
                        addresses: {
                          include: {
                            location: {
                              include: {
                                route: true
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            });

            // Filtrar transacciones por ruta (usando datos actuales por ahora)
            const filteredTransactions = transactions.filter(transaction => {
              // Por ahora usar solo datos actuales, después de la migración usar snapshot histórico
              const currentRouteId = transaction.lead?.personalData?.addresses?.[0]?.location?.route?.id ||
                                    transaction.lead?.routes?.id;
              
              return currentRouteId === routeId;
            });

            // Agrupar los pagos por mes (basado en el código de referencia)
            const totalsByMonth = filteredTransactions.reduce((acc, transaction) => {
              const month = transaction.date ? transaction.date.getMonth() + 1 : 0;
              const transactionYear = transaction.date ? transaction.date.getFullYear() : 0;
              const key = `${transactionYear}-${month.toString().padStart(2, '0')}`;
              
              if (!acc[key]) {
                acc[key] = { 
                  totalExpenses: 0, 
                  totalIncomes: 0, 
                  totalNomina: 0, 
                  balance: 0, 
                  reInvertido: 0, 
                  balanceWithReinvest: 0, 
                  totalCash: 0,
                  // Agregamos información de localidades
                  localities: {}
                };
              }

              const amount = Number(transaction.amount || 0);
              const profitAmount = Number(transaction.profitAmount || 0);

              // Obtener localidad (por ahora solo actual, después de migración usar snapshot)
              const locality = transaction.lead?.personalData?.addresses?.[0]?.location?.name ||
                              'Sin localidad';

              // Inicializar localidad si no existe
              if (!acc[key].localities[locality]) {
                acc[key].localities[locality] = {
                  totalExpenses: 0,
                  totalIncomes: 0,
                  totalNomina: 0,
                  reInvertido: 0,
                  balance: 0
                };
              }

              // Lógica basada en el código de referencia
              if (transaction.type === 'EXPENSE' && transaction.expenseSource === null) {
                acc[key].totalExpenses += amount;
                acc[key].localities[locality].totalExpenses += amount;
              } else if (transaction.type === 'EXPENSE' && transaction.expenseSource === 'NOMINA_SALARY') {
                acc[key].totalNomina += amount;
                acc[key].localities[locality].totalNomina += amount;
              } else if (
                transaction.type === 'INCOME' && 
                (transaction.incomeSource === 'CASH_LOAN_PAYMENT' || transaction.incomeSource === 'BANK_LOAN_PAYMENT')
              ) {
                acc[key].totalIncomes += profitAmount;
                acc[key].localities[locality].totalIncomes += profitAmount;
              } else if (transaction.type === 'EXPENSE' && transaction.expenseSource === 'LOAN_GRANTED') {
                acc[key].reInvertido += amount;
                acc[key].localities[locality].reInvertido += amount;
              }

              // Cálculo de cash flow
              if (transaction.type === 'EXPENSE') {
                acc[key].totalCash -= amount;
              } else if (transaction.type === 'INCOME') {
                acc[key].totalCash += amount;
              }

              // Calcular balance por localidad
              acc[key].localities[locality].balance = 
                acc[key].localities[locality].totalIncomes - 
                (acc[key].localities[locality].totalExpenses + acc[key].localities[locality].totalNomina);

              return acc;
            }, {} as { [key: string]: { 
              totalExpenses: number, 
              totalIncomes: number, 
              totalNomina: number, 
              balance: number, 
              reInvertido: number, 
              balanceWithReinvest: number, 
              totalCash: number,
              localities: { [locality: string]: {
                totalExpenses: number,
                totalIncomes: number, 
                totalNomina: number,
                reInvertido: number,
                balance: number
              }}
            }});

            // Calcular balance principal y balance con reinversión
            for (const key in totalsByMonth) {
              totalsByMonth[key].balance = totalsByMonth[key].totalIncomes - 
                                         (totalsByMonth[key].totalExpenses + totalsByMonth[key].totalNomina);
              totalsByMonth[key].balanceWithReinvest = totalsByMonth[key].balance - totalsByMonth[key].reInvertido;
            }

            // Ordenar los resultados por mes
            const sortedTotalsByMonth = Object.keys(totalsByMonth)
              .sort()
              .reduce((acc, key) => {
                acc[key] = totalsByMonth[key];
                return acc;
              }, {} as typeof totalsByMonth);

            // Calcular totales anuales
            let totalAnnualBalance = 0;
            let totalAnnualBalanceWithReinvest = 0;

            for (const month of Object.keys(sortedTotalsByMonth)) {
              totalAnnualBalance += sortedTotalsByMonth[month].balance || 0;
              totalAnnualBalanceWithReinvest += sortedTotalsByMonth[month].balanceWithReinvest || 0;
            }

            return {
              route: {
                id: route.id,
                name: route.name
              },
              year,
              monthlyData: sortedTotalsByMonth,
              annualSummary: {
                totalAnnualBalance,
                totalAnnualBalanceWithReinvest,
                totalMonths: Object.keys(sortedTotalsByMonth).length
              }
            };

          } catch (error) {
            console.error('Error in getMonthlyResume:', error);
            throw new Error(`Error generating monthly resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
      }),

      getLoansReport: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          month: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
        },
        resolve: async (root, { routeId, year, month }, context: Context) => {
          try {
            // Calcular inicio y fin del mes
            const start = new Date(year, month - 1, 1); // month es 1-based, Date() es 0-based
            const end = new Date(year, month, 0, 23, 59, 59, 999); // Último día del mes

            // Obtener información de la ruta
            const route = await context.prisma.route.findUnique({
              where: { id: routeId },
              include: {
                accounts: true
              }
            });

            if (!route) {
              throw new Error('Ruta no encontrada');
            }

            // Obtener todos los préstamos del periodo
            const loans = await context.prisma.loan.findMany({
              where: {
                signDate: {
                  gte: start,
                  lte: end,
                },
                lead: {
                  routes: {
                    id: routeId
                  }
                }
              },
              include: {
                borrower: {
                  include: {
                    personalData: {
                      include: {
                        addresses: {
                          include: {
                            location: true
                          }
                        }
                      }
                    }
                  }
                },
                previousLoan: true,
                loantype: true,
                lead: {
                  include: {
                    personalData: {
                      include: {
                        addresses: {
                          include: {
                            location: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            });

            // Obtener cuentas de la ruta para balance inicial/final
            const bankAccount = route.accounts.find(acc => acc.type === 'BANK');
            const cashAccount = route.accounts.find(acc => acc.type === 'EMPLOYEE_CASH_FUND');
            const accountIds = [bankAccount?.id, cashAccount?.id].filter(Boolean) as string[];

            // Obtener balance inicial (antes del periodo)
            const initialTransactions = await context.prisma.transaction.findMany({
              where: {
                OR: [
                  { sourceAccountId: { in: accountIds } },
                  { destinationAccountId: { in: accountIds } }
                ],
                date: { lt: start }
              }
            });

            // Obtener balance final (hasta el final del periodo)
            const finalTransactions = await context.prisma.transaction.findMany({
              where: {
                OR: [
                  { sourceAccountId: { in: accountIds } },
                  { destinationAccountId: { in: accountIds } }
                ],
                date: { lte: end }
              }
            });

            // Calcular balances
            const calculateBalance = (transactions: any[]) => {
              return transactions.reduce((balance, transaction) => {
                const amount = Number(transaction.amount || 0);
                if (transaction.type === 'INCOME') {
                  return balance + amount;
                } else if (transaction.type === 'EXPENSE') {
                  return balance - amount;
                }
                return balance;
              }, 0);
            };

            const initialBalance = calculateBalance(initialTransactions);
            const finalBalance = calculateBalance(finalTransactions);

            // Función para obtener semana del mes (1-5)
            const getWeekOfMonth = (date: Date) => {
              const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
              const dayOfMonth = date.getDate();
              const dayOfWeek = firstDayOfMonth.getDay(); // 0 = domingo
              const adjustedDay = dayOfMonth + dayOfWeek - 1;
              return Math.ceil(adjustedDay / 7);
            };

            // Generar todas las semanas del mes (1-5)
            const weeksInMonth: string[] = [];
            const tempDate = new Date(start);
            while (tempDate <= end) {
              const weekNum = getWeekOfMonth(tempDate);
              const weekKey = `SEMANA ${weekNum}`;
              if (!weeksInMonth.includes(weekKey)) {
                weeksInMonth.push(weekKey);
              }
              tempDate.setDate(tempDate.getDate() + 1);
            }

            // Estructura: { "SEMANA 1": { "LOCALIDAD": { datos } } }
            const reportData: { [week: string]: { [locality: string]: any } } = {};

            // Inicializar todas las semanas
            weeksInMonth.forEach(week => {
              reportData[week] = {};
            });

            loans.forEach(loan => {
              const signDate = new Date(loan.signDate);
              const weekNum = getWeekOfMonth(signDate);
              const weekKey = `SEMANA ${weekNum}`;

              // Obtener localidad (por ahora solo actual, se usará histórica después de migración)
              const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                              loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                              'Sin localidad';

              // Inicializar periodo si no existe
              if (!reportData[periodKey]) {
                reportData[periodKey] = {};
              }

              // Inicializar localidad si no existe
              if (!reportData[periodKey][locality]) {
                reportData[periodKey][locality] = {
                  totalLoans: 0,
                  newLoans: 0,
                  renewedLoans: 0,
                  totalAmount: 0,
                  newAmount: 0,
                  renewedAmount: 0,
                  uniqueClients: new Set(),
                  clientsWithNewLoans: new Set(),
                  clientsWithRenewals: new Set(),
                  loanTypes: {}
                };
              }

              const localityData = reportData[periodKey][locality];
              const amount = Number(loan.amountGived || 0);
              const isRenewal = !!loan.previousLoanId;
              const clientId = loan.borrower?.id;

              // Contadores generales
              localityData.totalLoans++;
              localityData.totalAmount += amount;

              if (clientId) {
                localityData.uniqueClients.add(clientId);
              }

              // Clasificar por tipo
              if (isRenewal) {
                localityData.renewedLoans++;
                localityData.renewedAmount += amount;
                if (clientId) {
                  localityData.clientsWithRenewals.add(clientId);
                }
              } else {
                localityData.newLoans++;
                localityData.newAmount += amount;
                if (clientId) {
                  localityData.clientsWithNewLoans.add(clientId);
                }
              }

              // Agregar tipo de préstamo
              const loanTypeName = loan.loantype?.name || 'Sin tipo';
              if (!localityData.loanTypes[loanTypeName]) {
                localityData.loanTypes[loanTypeName] = { count: 0, amount: 0 };
              }
              localityData.loanTypes[loanTypeName].count++;
              localityData.loanTypes[loanTypeName].amount += amount;
            });

            // Convertir Sets a números para el resultado final
            Object.keys(reportData).forEach(period => {
              Object.keys(reportData[period]).forEach(locality => {
                const data = reportData[period][locality];
                data.uniqueClientsCount = data.uniqueClients.size;
                data.newClientsCount = data.clientsWithNewLoans.size;
                data.renewalClientsCount = data.clientsWithRenewals.size;
                
                // Limpiar los Sets para serialización JSON
                delete data.uniqueClients;
                delete data.clientsWithNewLoans;
                delete data.clientsWithRenewals;
              });
            });

            // Calcular totales por periodo
            const periodTotals: { [period: string]: any } = {};
            Object.keys(reportData).forEach(period => {
              periodTotals[period] = {
                totalLoans: 0,
                newLoans: 0,
                renewedLoans: 0,
                totalAmount: 0,
                newAmount: 0,
                renewedAmount: 0,
                totalClients: 0,
                newClients: 0,
                renewalClients: 0,
                localities: Object.keys(reportData[period]).length
              };

              Object.values(reportData[period]).forEach((localityData: any) => {
                periodTotals[period].totalLoans += localityData.totalLoans;
                periodTotals[period].newLoans += localityData.newLoans;
                periodTotals[period].renewedLoans += localityData.renewedLoans;
                periodTotals[period].totalAmount += localityData.totalAmount;
                periodTotals[period].newAmount += localityData.newAmount;
                periodTotals[period].renewedAmount += localityData.renewedAmount;
                periodTotals[period].totalClients += localityData.uniqueClientsCount;
                periodTotals[period].newClients += localityData.newClientsCount;
                periodTotals[period].renewalClients += localityData.renewalClientsCount;
              });
            });

            // Ordenar periodos
            const sortedPeriods = Object.keys(reportData).sort();

            return {
              route: {
                id: route.id,
                name: route.name
              },
              period: {
                type: periodType,
                start: startDate,
                end: endDate
              },
              balance: {
                initial: Math.round(initialBalance * 100) / 100,
                final: Math.round(finalBalance * 100) / 100,
                difference: Math.round((finalBalance - initialBalance) * 100) / 100
              },
              periods: sortedPeriods,
              data: reportData,
              totals: periodTotals,
              summary: {
                totalPeriods: sortedPeriods.length,
                totalLoans: Object.values(periodTotals).reduce((sum: number, period: any) => sum + period.totalLoans, 0),
                totalNewLoans: Object.values(periodTotals).reduce((sum: number, period: any) => sum + period.newLoans, 0),
                totalRenewedLoans: Object.values(periodTotals).reduce((sum: number, period: any) => sum + period.renewedLoans, 0),
                totalAmount: Object.values(periodTotals).reduce((sum: number, period: any) => sum + period.totalAmount, 0),
                avgLoansPerPeriod: Math.round((Object.values(periodTotals).reduce((sum: number, period: any) => sum + period.totalLoans, 0) / sortedPeriods.length) * 100) / 100
              }
            };

          } catch (error) {
            console.error('Error in getLoansReport:', error);
            throw new Error(`Error generating loans report: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
      }),

      getActiveLoansReport: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          month: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          useActiveWeeks: graphql.arg({ type: graphql.nonNull(graphql.Boolean) }),
        },
        resolve: async (root, { routeId, year, month, useActiveWeeks }, context: Context) => {
          try {
            // Calcular inicio y fin del mes
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

            // Función para obtener semana del mes
            const getWeekOfMonth = (date: Date) => {
              const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
              const dayOfMonth = date.getDate();
              const dayOfWeek = firstDayOfMonth.getDay(); // 0 = domingo
              const adjustedDay = dayOfMonth + dayOfWeek - 1;
              return Math.ceil(adjustedDay / 7);
            };

            // Generar fechas de inicio/fin de cada semana del mes
            const weeks: { [key: string]: { start: Date, end: Date } } = {};
            
            if (useActiveWeeks) {
              // Modo "Semanas Activas": Semanas con mayoría de días de trabajo en el mes
              const firstDayOfMonth = new Date(year, month - 1, 1);
              const lastDayOfMonth = new Date(year, month, 0);
              
              // Generar todas las semanas que tocan el mes
              let currentDate = new Date(firstDayOfMonth);
              
              // Retroceder hasta encontrar el primer lunes antes del mes
              while (currentDate.getDay() !== 1) { // 1 = lunes
                currentDate.setDate(currentDate.getDate() - 1);
              }
              
              let weekNumber = 1;
              
              // Generar semanas hasta cubrir todo el mes
              while (currentDate <= lastDayOfMonth) {
                const weekStart = new Date(currentDate);
                const weekEnd = new Date(currentDate);
                weekEnd.setDate(weekEnd.getDate() + 5); // Lunes a sábado (6 días)
                weekEnd.setHours(23, 59, 59, 999);
                
                // Contar días de trabajo (lunes-sábado) que pertenecen al mes
                let workDaysInMonth = 0;
                let tempDate = new Date(weekStart);
                
                for (let i = 0; i < 6; i++) { // 6 días de trabajo
                  if (tempDate.getMonth() === month - 1) {
                    workDaysInMonth++;
                  }
                  tempDate.setDate(tempDate.getDate() + 1);
                }
                
                // La semana pertenece al mes que tiene más días activos
                // Si hay empate (3-3), la semana va al mes que tiene el lunes
                if (workDaysInMonth > 3 || (workDaysInMonth === 3 && weekStart.getMonth() === month - 1)) {
                  const weekKey = `SEMANA ${weekNumber}`;
                  weeks[weekKey] = { 
                    start: new Date(weekStart), 
                    end: weekEnd 
                  };
                  weekNumber++;
                }
                
                currentDate.setDate(currentDate.getDate() + 7);
              }
            } else {
              // Modo "Mes Real": Todas las semanas que toquen el mes
              const tempDate = new Date(monthStart);
              
              while (tempDate <= monthEnd) {
                const weekNum = getWeekOfMonth(tempDate);
                const weekKey = `SEMANA ${weekNum}`;
                
                if (!weeks[weekKey]) {
                  // Calcular inicio de la semana (lunes)
                  const weekStart = new Date(tempDate);
                  const dayOfWeek = weekStart.getDay();
                  const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
                  weekStart.setDate(weekStart.getDate() + diffToMonday);
                  weekStart.setHours(0, 0, 0, 0);
                  
                  // Asegurar que no sea antes del mes
                  if (weekStart < monthStart) {
                    weekStart.setTime(monthStart.getTime());
                  }
                  
                  // Calcular fin de la semana (domingo)
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  weekEnd.setHours(23, 59, 59, 999);
                  
                  // Asegurar que no sea después del mes
                  if (weekEnd > monthEnd) {
                    weekEnd.setTime(monthEnd.getTime());
                  }
                  
                  weeks[weekKey] = { start: weekStart, end: weekEnd };
                }
                
                tempDate.setDate(tempDate.getDate() + 1);
              }
            }

            // Obtener TODOS los préstamos relevantes para la ruta (no solo del mes)
            const allLoans = await context.prisma.loan.findMany({
              where: {
                lead: {
                  routes: {
                    id: routeId
                  }
                }
              },
              include: {
                borrower: {
                  include: {
                    personalData: {
                      include: {
                        addresses: {
                          include: {
                            location: true
                          }
                        }
                      }
                    }
                  }
                },
                previousLoan: true,
                loantype: true,
                lead: {
                  include: {
                    personalData: {
                      include: {
                        addresses: {
                          include: {
                            location: true
                          }
                        }
                      }
                    }
                  }
                },
                payments: {
                  orderBy: {
                    receivedAt: 'asc'
                  }
                }
              }
            });

            // Función para determinar si un préstamo está activo en una fecha específica
            const isLoanActiveOnDate = (loan: any, date: Date) => {
              const signDate = new Date(loan.signDate);
              
              // El préstamo debe haber sido otorgado antes o en la fecha
              if (signDate > date) return false;
              
              // Si tiene finishedDate y es antes de la fecha, no está activo
              if (loan.finishedDate && new Date(loan.finishedDate) < date) return false;
              
              // Si tiene status RENOVATED y es antes de la fecha, no está activo
              if (loan.status === 'RENOVATED' && loan.finishedDate && new Date(loan.finishedDate) < date) return false;
              
              // Verificar si está completamente pagado antes de la fecha
              const totalAmount = Number(loan.amountGived || 0);
              const profitAmount = Number(loan.profitAmount || 0);
              const totalToPay = totalAmount + profitAmount;
              
              let paidAmount = 0;
              for (const payment of loan.payments) {
                const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                if (paymentDate <= date) {
                  paidAmount += Number(payment.amount || 0);
                }
              }
              
              // Si está completamente pagado, no está activo
              return paidAmount < totalToPay;
            };

            // Procesar datos por semana
            const reportData: { [week: string]: { [locality: string]: any } } = {};
            const weekOrder = Object.keys(weeks).sort((a, b) => {
              const numA = parseInt(a.split(' ')[1]);
              const numB = parseInt(b.split(' ')[1]);
              return numA - numB;
            });

            // Track previous week's activeAtEnd for each locality
            const previousWeekActiveAtEnd: { [locality: string]: number } = {};

            for (const weekKey of weekOrder) {
              const { start: weekStart, end: weekEnd } = weeks[weekKey];
              reportData[weekKey] = {};

              // Agrupar por localidad
              const localitiesData: { [locality: string]: any } = {};
              const isFirstWeek = weekKey === weekOrder[0];

              allLoans.forEach(loan => {
                const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                                loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                                'Sin localidad';

                if (!localitiesData[locality]) {
                  localitiesData[locality] = {
                    activeAtStart: 0,
                    activeAtEnd: 0,
                    granted: 0,
                    grantedNew: 0,
                    grantedRenewed: 0,
                    finished: 0,
                    cv: 0, // Créditos Vencidos (activos sin pago en la semana)
                    totalAmountAtStart: 0,
                    totalAmountAtEnd: 0,
                    grantedAmount: 0,
                    finishedAmount: 0,
                    cvAmount: 0 // Monto de créditos vencidos
                  };
                }

                const data = localitiesData[locality];
                const loanAmount = Number(loan.amountGived || 0);

                // Préstamos activos al inicio de la semana
                // Solo para la primera semana calculamos basándose en la fecha
                // Para las demás semanas usaremos el activeAtEnd de la semana anterior
                if (isFirstWeek && isLoanActiveOnDate(loan, weekStart)) {
                  data.activeAtStart++;
                  data.totalAmountAtStart += loanAmount;
                }

                // Préstamos otorgados durante la semana
                const signDate = new Date(loan.signDate);
                if (signDate >= weekStart && signDate <= weekEnd) {
                  data.granted++;
                  data.grantedAmount += loanAmount;
                  
                  if (loan.previousLoanId) {
                    data.grantedRenewed++;
                  } else {
                    data.grantedNew++;
                  }
                }

                // Préstamos finalizados durante la semana
                if (loan.finishedDate) {
                  const finishedDate = new Date(loan.finishedDate);
                  if (finishedDate >= weekStart && finishedDate <= weekEnd) {
                    data.finished++;
                    data.finishedAmount += loanAmount;
                  }
                } else {
                  // Verificar si se pagó completamente durante la semana
                  const totalAmount = Number(loan.amountGived || 0);
                  const profitAmount = Number(loan.profitAmount || 0);
                  const totalToPay = totalAmount + profitAmount;
                  
                  let paidAmount = 0;
                  let lastPaymentInWeek = false;
                  
                  for (const payment of loan.payments) {
                    const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                    paidAmount += Number(payment.amount || 0);
                    
                    if (paymentDate >= weekStart && paymentDate <= weekEnd) {
                      lastPaymentInWeek = true;
                    }
                  }
                  
                  if (paidAmount >= totalToPay && lastPaymentInWeek) {
                    data.finished++;
                    data.finishedAmount += loanAmount;
                  }
                }
              });

              // Para semanas posteriores a la primera, usar el activeAtEnd de la semana anterior
              if (!isFirstWeek) {
                Object.keys(localitiesData).forEach(locality => {
                  const data = localitiesData[locality];
                  data.activeAtStart = previousWeekActiveAtEnd[locality] || 0;
                  // Calcular totalAmountAtStart basándose en préstamos activos al inicio
                  data.totalAmountAtStart = 0;
                  allLoans.forEach(loan => {
                    const loanLocality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                                        loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                                        'Sin localidad';
                    if (loanLocality === locality && isLoanActiveOnDate(loan, weekStart)) {
                      data.totalAmountAtStart += Number(loan.amountGived || 0);
                    }
                  });
                });
              }

              // Calcular CV (Créditos Vencidos) - préstamos activos sin pagos en la semana
              allLoans.forEach(loan => {
                const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                                loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                                'Sin localidad';

                const data = localitiesData[locality];
                if (!data) return;

                // Solo procesar si el préstamo está activo durante la semana
                const isActiveInWeek = isLoanActiveOnDate(loan, weekStart) || isLoanActiveOnDate(loan, weekEnd);
                if (!isActiveInWeek) return;

                // Verificar si recibió algún pago durante esta semana
                let hasPaymentInWeek = false;
                for (const payment of loan.payments) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                  if (paymentDate >= weekStart && paymentDate <= weekEnd) {
                    hasPaymentInWeek = true;
                    break;
                  }
                }

                // Verificar si el préstamo tiene badDetDate y si estamos después de esa fecha
                let isBadDebtAfterDate = false;
                if (loan.badDetDate) {
                  const badDetDate = new Date(loan.badDetDate);
                  if (weekEnd > badDetDate) {
                    isBadDebtAfterDate = true;
                  }
                }

                // Solo contar como CV si:
                // 1. No recibió pagos en la semana
                // 2. Y NO tiene badDetDate o estamos antes del badDetDate
                if (!hasPaymentInWeek && !isBadDebtAfterDate) {
                  data.cv++;
                  data.cvAmount += Number(loan.amountGived || 0);
                }
              });

              // Calcular activos al final usando la fórmula matemática correcta
              Object.keys(localitiesData).forEach(locality => {
                const data = localitiesData[locality];
                // Fórmula: activeAtEnd = activeAtStart + granted - finished
                data.activeAtEnd = data.activeAtStart + data.granted - data.finished;
                
                // Asegurar que no sea negativo (por si hay inconsistencias en los datos)
                if (data.activeAtEnd < 0) {
                  console.warn(`⚠️ Activos negativos en ${locality} ${weekKey}: ${data.activeAtEnd}. Ajustando a 0.`);
                  data.activeAtEnd = 0;
                }
                
                // Calcular totalAmountAtEnd basado en la diferencia
                data.totalAmountAtEnd = data.totalAmountAtStart + data.grantedAmount - data.finishedAmount;
                if (data.totalAmountAtEnd < 0) {
                  data.totalAmountAtEnd = 0;
                }

                // Guardar el activeAtEnd para la próxima semana
                previousWeekActiveAtEnd[locality] = data.activeAtEnd;
              });

              reportData[weekKey] = localitiesData;
            }

            // Calcular totales por semana
            const weeklyTotals: { [week: string]: any } = {};
            weekOrder.forEach(weekKey => {
              weeklyTotals[weekKey] = {
                activeAtStart: 0,
                activeAtEnd: 0,
                granted: 0,
                grantedNew: 0,
                grantedRenewed: 0,
                finished: 0,
                cv: 0, // Créditos Vencidos
                totalAmountAtStart: 0,
                totalAmountAtEnd: 0,
                grantedAmount: 0,
                finishedAmount: 0,
                cvAmount: 0, // Monto de créditos vencidos
                netChange: 0,
                localities: Object.keys(reportData[weekKey]).length
              };

              Object.values(reportData[weekKey]).forEach((localityData: any) => {
                weeklyTotals[weekKey].activeAtStart += localityData.activeAtStart;
                weeklyTotals[weekKey].activeAtEnd += localityData.activeAtEnd;
                weeklyTotals[weekKey].granted += localityData.granted;
                weeklyTotals[weekKey].grantedNew += localityData.grantedNew;
                weeklyTotals[weekKey].grantedRenewed += localityData.grantedRenewed;
                weeklyTotals[weekKey].finished += localityData.finished;
                weeklyTotals[weekKey].cv += localityData.cv; // Sumar CV
                weeklyTotals[weekKey].totalAmountAtStart += localityData.totalAmountAtStart;
                weeklyTotals[weekKey].totalAmountAtEnd += localityData.totalAmountAtEnd;
                weeklyTotals[weekKey].grantedAmount += localityData.grantedAmount;
                weeklyTotals[weekKey].finishedAmount += localityData.finishedAmount;
                weeklyTotals[weekKey].cvAmount += localityData.cvAmount; // Sumar monto CV
              });

              weeklyTotals[weekKey].netChange = weeklyTotals[weekKey].activeAtEnd - weeklyTotals[weekKey].activeAtStart;
            });

            // Obtener información de la ruta
            const route = await context.prisma.route.findUnique({
              where: { id: routeId }
            });

            return {
              route: {
                id: route?.id || '',
                name: route?.name || ''
              },
              month: {
                year,
                month,
                name: new Date(year, month - 1).toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })
              },
              weeks: weekOrder,
              data: reportData,
              weeklyTotals,
              summary: {
                totalActiveAtMonthStart: weekOrder.length > 0 ? weeklyTotals[weekOrder[0]].activeAtStart : 0,
                totalActiveAtMonthEnd: weekOrder.length > 0 ? weeklyTotals[weekOrder[weekOrder.length - 1]].activeAtEnd : 0,
                totalGrantedInMonth: Object.values(weeklyTotals).reduce((sum: number, week: any) => sum + week.granted, 0),
                totalFinishedInMonth: Object.values(weeklyTotals).reduce((sum: number, week: any) => sum + week.finished, 0),
                netChangeInMonth: weekOrder.length > 0 ? weeklyTotals[weekOrder[weekOrder.length - 1]].activeAtEnd - weeklyTotals[weekOrder[0]].activeAtStart : 0
              }
            };

          } catch (error) {
            console.error('Error in getActiveLoansReport:', error);
            throw new Error(`Error generating active loans report: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
      }),
    },
  };
});