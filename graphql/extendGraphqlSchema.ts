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
    },
  };
});