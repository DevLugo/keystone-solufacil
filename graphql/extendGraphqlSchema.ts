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

// ✅ FUNCIÓN UTILITARIA GLOBAL: Calcular semanas sin pago automáticamente
const calculateWeeksWithoutPayment = (loanId: string, signDate: Date, analysisDate: Date, payments: any[], renewedDate?: Date | null) => {
  let weeksWithoutPayment = 0;
  
  // ✅ NUEVA FUNCIONALIDAD: Si el préstamo fue renovado, usar renewedDate como fecha límite
  const effectiveEndDate = renewedDate ? Math.min(new Date(renewedDate).getTime(), analysisDate.getTime()) : analysisDate.getTime();
  const endDate = new Date(effectiveEndDate);
  
  // Obtener todos los lunes desde la fecha de firma hasta la fecha de análisis (o renovación)
  const mondays: Date[] = [];
  let currentMonday = new Date(signDate);
  
  // Encontrar el lunes de la semana de firma
  while (currentMonday.getDay() !== 1) { // 1 = lunes
    currentMonday.setDate(currentMonday.getDate() - 1);
  }
  
  // Generar todos los lunes hasta la fecha de análisis (o renovación)
  while (currentMonday <= endDate) {
    mondays.push(new Date(currentMonday));
    currentMonday.setDate(currentMonday.getDate() + 7);
  }
  
  // Para cada semana (lunes), verificar si hay pago
  for (const monday of mondays) {
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6); // Domingo de esa semana
    
    // ✅ NUEVA FUNCIONALIDAD: Solo considerar semanas antes de la renovación
    if (renewedDate && monday >= new Date(renewedDate)) {
      break; // No contar semanas después de la renovación
    }
    
    // Verificar si hay algún pago en esa semana
    const hasPaymentInWeek = payments.some(payment => {
      const paymentDate = new Date(payment.receivedAt);
      return paymentDate >= monday && paymentDate <= sunday;
    });
    
    if (!hasPaymentInWeek) {
      weeksWithoutPayment++;
    }
  }
  
  return weeksWithoutPayment;
};

export const extendGraphqlSchema = graphql.extend(base => {
  return {
    mutation: {
      importTokaXml: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: {
          xml: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          month: graphql.arg({ type: graphql.nonNull(graphql.String) }), // YYYY-MM
          assignments: graphql.arg({ type: graphql.list(graphql.nonNull(graphql.inputObject({
            name: 'TokaAssignmentInput',
            fields: {
              cardNumber: graphql.arg({ type: graphql.nonNull(graphql.String) }),
              routeId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
            }
          }))) }),
        },
        resolve: async (root, { xml, month, assignments = [] }, context: Context) => {
          // Parseo rápido de XML simple (usaremos fast-xml-parser disponible en deps)
          const { XMLParser } = require('fast-xml-parser');
          const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
          const data = parser.parse(xml);

          const conceptos = data?.['cfdi:Comprobante']?.['cfdi:Complemento']?.['ecc12:EstadoDeCuentaCombustible']?.['ecc12:Conceptos']?.['ecc12:ConceptoEstadoDeCuentaCombustible'];
          if (!conceptos) {
            throw new Error('XML inválido o sin conceptos de combustible');
          }

          const records = Array.isArray(conceptos) ? conceptos : [conceptos];

          // Extraer año y mes
          const [yearStr, monthStr] = month.split('-');
          const year = Number(yearStr);
          const monthNum = Number(monthStr);
          const fromDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
          const toDate = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0));

          // Agrupar por tarjeta (Identificador)
          const byCard: Record<string, { date: Date; amount: number }[]> = {};
          for (const r of records) {
            const ident = (r?.Identificador || '').toString();
            const fecha = new Date(r?.Fecha);
            if (!(fecha >= fromDate && fecha < toDate)) continue;
            const importe = Number(r?.Importe || 0);
            if (!byCard[ident]) byCard[ident] = [];
            byCard[ident].push({ date: fecha, amount: importe });
          }

          // Transacción atómica: por cada tarjeta, borrar y re-crear gastos del mes
          // Ya no usamos entidad PrepaidCard: solo continuamos

          // Mapeo tarjeta→ruta desde assignments
          const numberToRoute: Record<string, string | null> = {};
          for (const a of assignments as Array<{ cardNumber: string; routeId: string }>) {
            numberToRoute[a.cardNumber] = a.routeId;
          }

          await context.prisma.$transaction(async (tx) => {
            for (const [cardNumberKey, entries] of Object.entries(byCard)) {
              const effectiveRouteId = (numberToRoute[cardNumberKey] || null) as string | null;

              // Borrar transacciones EXPENSE GASOLINE del mes para la ruta asignada (cuentas PREPAID_GAS)
              const existing = effectiveRouteId ? await tx.transaction.findMany({
                where: ({
                  type: 'EXPENSE',
                  expenseSource: 'GASOLINE',
                  date: { gte: fromDate, lt: toDate },
                  // Solo transacciones que salieron de la cuenta TOKA (PREPAID_GAS)
                  sourceAccount: { is: { type: 'PREPAID_GAS', routeId: effectiveRouteId } },
                } as any)
              }) : [];
              if (existing && existing.length > 0) {
                await tx.transaction.deleteMany({ where: { id: { in: existing.map(e => e.id) } } });
              }

              // Determinar cuenta origen: si la ruta de la tarjeta tiene cuenta PREPAID_GAS preferentemente
              let sourceAccountId: string | null = null;
              
              if (!effectiveRouteId) {
                console.log('no hay ruta asignada para la tarjeta', cardNumberKey);
                // Sin ruta asignada desde UI: no crear gastos para esta tarjeta
                continue;
              }
              const accounts = await tx.account.findMany({ where: { routeId: effectiveRouteId } });
              const prepaid = accounts.find((a: any) => a.type === 'PREPAID_GAS');
              if (prepaid) sourceAccountId = prepaid.id;
              
              if(!sourceAccountId) {
                console.log('no hay cuenta de gasolina para la ruta', effectiveRouteId);
                // Si la ruta no tiene cuenta PREPAID_GAS, omitimos crear gastos de esta tarjeta
                continue;
              }
              console.log('insergando', sourceAccountId);  
              // Crear transacciones por cada movimiento
              for (const e of entries) {
                await tx.transaction.create({
                  data: ({
                    amount: e.amount.toFixed(2),
                    date: e.date,
                    type: 'EXPENSE',
                    expenseSource: 'GASOLINE',
                    description: 'Gasto gasolina TOKA',
                    route: effectiveRouteId,
                    ...(effectiveRouteId ? { route: { connect: { id: effectiveRouteId } } } : {}),
                    ...(sourceAccountId ? { sourceAccount: { connect: { id: sourceAccountId } } } : {}),
                  } as any)
                });
              }
            }
          });

          return 'OK';
        }
      }),
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

              console.log('🔍 DEBUG - Procesando pagos:', createdPaymentRecords.length);

              for (const payment of createdPaymentRecords) {
                const paymentAmount = parseFloat((payment.amount || 0).toString());
                const comissionAmount = parseFloat((payment.comission || 0).toString());
                
                console.log('🔍 DEBUG - Payment:', {
                  id: payment.id,
                  amount: payment.amount,
                  comission: payment.comission,
                  comissionAmount,
                });
                
                // Preparar datos de transacción para el PAGO (INCOME)
                transactionData.push({
                  amount: (payment.amount || 0).toString(),
                  date: new Date(paymentDate),
                  type: 'INCOME',
                  incomeSource: payment.paymentMethod === 'CASH' ? 'CASH_LOAN_PAYMENT' : 'BANK_LOAN_PAYMENT',
                  loanPaymentId: payment.id,
                  loanId: payment.loanId,
                  leadId: leadId,
                });

                // Preparar datos de transacción para la COMISIÓN (EXPENSE)
                if (comissionAmount > 0) {
                  console.log('🔍 DEBUG - Creando transacción de comisión:', {
                    amount: comissionAmount.toString(),
                    date: new Date(paymentDate),
                    type: 'EXPENSE',
                    expenseSource: 'LOAN_PAYMENT_COMISSION',
                    sourceAccountId: cashAccount.id,
                    loanPaymentId: payment.id,
                    loanId: payment.loanId,
                    leadId: leadId,
                    description: `Comisión por pago de préstamo - ${payment.id}`,
                  });
                  
                  transactionData.push({
                    amount: comissionAmount.toString(),
                    date: new Date(paymentDate),
                    type: 'EXPENSE',
                    expenseSource: 'LOAN_PAYMENT_COMISSION',
                    sourceAccountId: cashAccount.id,
                    loanPaymentId: payment.id,
                    loanId: payment.loanId,
                    leadId: leadId,
                    description: `Comisión por pago de préstamo - ${payment.id}`,
                  });
                }

                // Acumular cambios en balances
                if (payment.paymentMethod === 'CASH') {
                  cashAmountChange += paymentAmount;
                } else {
                  bankAmountChange += paymentAmount;
                }

                // ✅ AGREGAR: Descontar comisiones de los balances
              if (comissionAmount > 0) {
                if (payment.paymentMethod === 'CASH') {
                  cashAmountChange -= comissionAmount; // Descontar de efectivo
                } else {
                  bankAmountChange -= comissionAmount; // Descontar de banco
                }
              }
              }

              console.log('🔍 DEBUG - Total transacciones a crear:', transactionData.length);
              console.log('🔍 DEBUG - Transacciones de comisiones:', transactionData.filter(t => t.type === 'EXPENSE' && t.expenseSource === 'LOAN_PAYMENT_COMISSION').length);

              // Crear todas las transacciones de una vez
              if (transactionData.length > 0) {
                try {
                  await tx.transaction.createMany({ data: transactionData });
                  console.log('✅ Transacciones creadas exitosamente');
                } catch (error) {
                  console.error('❌ Error creando transacciones:', error);
                  throw error;
                }
              }
              

              // Recalcular métricas para cada préstamo afectado
              const affectedLoanIds2 = Array.from(new Set(createdPaymentRecords.map((p: any) => p.loanId)));
              for (const loanId of affectedLoanIds2) {
                const loan = await tx.loan.findUnique({ where: { id: loanId }, include: { loantype: true, payments: true } });
                if (!loan) continue;
                const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
                const requested = parseFloat(loan.requestedAmount.toString());
                const weekDuration = Number(loan.loantype?.weekDuration || 0);
                const totalDebt = requested * (1 + rate);
                const expectedWeekly = weekDuration > 0 ? (totalDebt / weekDuration) : 0;
                const totalPaid = (loan.payments || []).reduce((s: number, p: any) => s + parseFloat((p.amount || 0).toString()), 0);
                const pending = Math.max(0, totalDebt - totalPaid);
                await tx.loan.update({
                  where: { id: loanId },
                  data: {
                    totalDebtAcquired: totalDebt.toFixed(2),
                    expectedWeeklyPayment: expectedWeekly.toFixed(2),
                    totalPaid: totalPaid.toFixed(2),
                    pendingAmountStored: pending.toFixed(2),
                  }
                });
              }

              // Actualizar métricas del préstamo para cada loan afectado
              const affectedLoanIds = Array.from(new Set(createdPaymentRecords.map(p => p.loanId)));
              for (const loanId of affectedLoanIds) {
                const loan = await tx.loan.findUnique({ where: { id: loanId }, include: { loantype: true, payments: true } });
                if (!loan) continue;
                const loanWithRelations = loan as any;
                const rate = parseFloat(loanWithRelations.loantype?.rate?.toString() || '0');
                const requested = parseFloat(loanWithRelations.requestedAmount.toString());
                const weekDuration = Number(loanWithRelations.loantype?.weekDuration || 0);
                const totalDebt = requested * (1 + rate);
                const expectedWeekly = weekDuration > 0 ? (totalDebt / weekDuration) : 0;
                const totalPaid = (loanWithRelations.payments || []).reduce((s: number, p: any) => s + parseFloat((p.amount || 0).toString()), 0);
                const pending = Math.max(0, totalDebt - totalPaid);
                await tx.loan.update({
                  where: { id: loanId },
                  data: {
                    totalDebtAcquired: totalDebt.toFixed(2),
                    expectedWeeklyPayment: expectedWeekly.toFixed(2),
                    totalPaid: totalPaid.toFixed(2),
                    pendingAmountStored: pending.toFixed(2),
                  }
                });
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
              const commissionAmount = parseFloat((payment.comission || 0).toString());
              const totalAmount = paymentAmount + commissionAmount; // ✅ INCLUIR comisión
              
              if (payment.paymentMethod === 'CASH') {
                oldCashAmountChange += totalAmount;
              } else {
                oldBankAmountChange += totalAmount;
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
                const commissionAmount = parseFloat((payment.comission || 0).toString());
                const totalAmount = paymentAmount + commissionAmount; // ✅ INCLUIR comisión
                
                // Preparar datos de transacción para el pago principal
                transactionData.push({
                  amount: (payment.amount || 0).toString(),
                  date: new Date(paymentDate),
                  type: 'INCOME',
                  incomeSource: payment.paymentMethod === 'CASH' ? 'CASH_LOAN_PAYMENT' : 'BANK_LOAN_PAYMENT',
                  loanPaymentId: payment.id,
                  loanId: payment.loanId,
                  leadId: leadId,
                });

                // ✅ AGREGAR: Crear transacción separada para la comisión si existe
                if (commissionAmount > 0) {
                  transactionData.push({
                    amount: (payment.comission || 0).toString(),
                    date: new Date(paymentDate),
                    type: 'INCOME',
                    incomeSource: 'LOAN_PAYMENT_COMISSION',
                    loanPaymentId: payment.id,
                    loanId: payment.loanId,
                    leadId: leadId,
                  });
                }

                // Acumular cambios en balances (pago + comisión)
                if (payment.paymentMethod === 'CASH') {
                  newCashAmountChange += totalAmount;
                } else {
                  newBankAmountChange += totalAmount;
                }
              }

              // Crear todas las transacciones de una vez
              if (transactionData.length > 0) {
                await tx.transaction.createMany({ data: transactionData });
              }
            }

            // ✅ AGREGAR: Logs de debugging para verificar cálculos
            console.log('🔍 UPDATE LEAD PAYMENT - Cálculo de balances:', {
              oldCashAmountChange,
              oldBankAmountChange,
              newCashAmountChange,
              newBankAmountChange,
              cashBalanceChange: newCashAmountChange - oldCashAmountChange,
              bankBalanceChange: newBankAmountChange - oldBankAmountChange,
              currentCashAmount: parseFloat((cashAccount.amount || 0).toString()),
              currentBankAmount: parseFloat((bankAccount.amount || 0).toString())
            });

            // Actualizar balances de cuentas (revertir antiguos y aplicar nuevos)
            const cashBalanceChange = newCashAmountChange - oldCashAmountChange;
            const bankBalanceChange = newBankAmountChange - oldBankAmountChange;

            if (cashBalanceChange !== 0) {
              const currentCashAmount = parseFloat((cashAccount.amount || 0).toString());
              const newCashBalance = currentCashAmount + cashBalanceChange;
              
              console.log('💰 Actualizando balance CASH:', {
                currentAmount: currentCashAmount,
                change: cashBalanceChange,
                newAmount: newCashBalance
              });
              
              await tx.account.update({
                where: { id: cashAccount.id },
                data: { amount: newCashBalance.toString() }
              });
            }

            if (bankBalanceChange !== 0) {
              const currentBankAmount = parseFloat((bankAccount.amount || 0).toString());
              const newBankBalance = currentBankAmount + bankBalanceChange;
              
              console.log('🏦 Actualizando balance BANK:', {
                currentAmount: currentBankAmount,
                change: bankBalanceChange,
                newAmount: newBankBalance
              });
              
              await tx.account.update({
                where: { id: bankAccount.id },
                data: { amount: newBankBalance.toString() }
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
      createPortfolioCleanupAndExcludeLoans: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          name: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          description: graphql.arg({ type: graphql.String }),
          cleanupDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          fromDate: graphql.arg({ type: graphql.String }),
          toDate: graphql.arg({ type: graphql.String }),
          routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          excludedLoanIds: graphql.arg({ type: graphql.list(graphql.nonNull(graphql.String)) }),
        },
        resolve: async (root, { name, description, cleanupDate, routeId, fromDate, toDate, excludedLoanIds }, context: Context) => {
          try {
            const session = context.session as any;
            const userId = session?.itemId || session?.data?.id;
            if (!userId) {
              throw new Error('Usuario no autenticado');
            }

            // Crear el registro de limpieza
            const portfolioCleanup = await (context.prisma as any).portfolioCleanup.create({
              data: {
                name,
                description: description || '',
                cleanupDate: new Date(cleanupDate),
                fromDate: fromDate ? new Date(fromDate) : null,
                toDate: toDate ? new Date(toDate) : null,
                route: { connect: { id: routeId } },
                executedBy: { connect: { id: userId } },
              }
            });

            // Actualizar los préstamos excluidos
            if (excludedLoanIds && excludedLoanIds.length > 0) {
              await (context.prisma as any).loan.updateMany({
                where: {
                  id: { in: excludedLoanIds }
                },
                data: ({ excludedByCleanupId: portfolioCleanup.id } as any)
              });

              console.log(`📊 ${excludedLoanIds.length} préstamos marcados como excluidos por limpieza de cartera`);
            }

            console.log(`📊 Portfolio Cleanup creado: ${name} por usuario ${userId}`);

            return {
              success: true,
              id: portfolioCleanup.id,
              message: `Limpieza de cartera registrada exitosamente`
            };

          } catch (error) {
            console.error('Error en createPortfolioCleanupAndExcludeLoans:', error);
            throw new Error(`Error al crear registro de limpieza de cartera: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }),
      createBulkPortfolioCleanup: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          name: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          description: graphql.arg({ type: graphql.String }),
          cleanupDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          fromDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          toDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          weeksWithoutPaymentThreshold: graphql.arg({ type: graphql.Int }),
        },
        resolve: async (root, { name, description, cleanupDate, routeId, fromDate, toDate, weeksWithoutPaymentThreshold = 0 }, context: Context) => {
          try {
            const session = context.session as any;
            const userId = session?.itemId || session?.data?.id;
            if (!userId) {
              throw new Error('Usuario no autenticado');
            }

            const start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);

            // Buscar préstamos activos por fecha de firma
            const candidateLoans = await (context.prisma as any).loan.findMany({
              where: {
                lead: { routes: { id: routeId } },
                signDate: { gte: start, lte: end },
                excludedByCleanup: { is: null },
                finishedDate: null,
                status: 'ACTIVE'
              },
              include: {
                payments: { orderBy: { receivedAt: 'asc' } }
              }
            });

            const applyCV = typeof weeksWithoutPaymentThreshold === 'number' && weeksWithoutPaymentThreshold > 0;
            let loansToExclude = candidateLoans as any[];

            if (applyCV) {
              const now = new Date();
              loansToExclude = candidateLoans.filter((loan: any) => {
                const lastPaymentDate = loan.payments?.length > 0
                  ? new Date(loan.payments[loan.payments.length - 1].receivedAt)
                  : new Date(loan.signDate);
                const diffMs = now.getTime() - lastPaymentDate.getTime();
                const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
                return weeks >= weeksWithoutPaymentThreshold;
              });
            }

            if (loansToExclude.length === 0) {
              return {
                success: false,
                message: 'No se encontraron préstamos activos dentro del rango indicado'
              };
            }

            // Crear el registro de limpieza
            const portfolioCleanup = await (context.prisma as any).portfolioCleanup.create({
              data: {
                name,
                description: description || '',
                cleanupDate: new Date(cleanupDate),
                fromDate: start,
                toDate: end,
                route: { connect: { id: routeId } },
                executedBy: { connect: { id: userId } },
              }
            });

            // Actualizar todos los préstamos encontrados
            const loanIds = loansToExclude.map((loan: any) => loan.id);
            await (context.prisma as any).loan.updateMany({
              where: { id: { in: loanIds } },
              data: ({ excludedByCleanupId: portfolioCleanup.id } as any)
            });

            const totalAmount = loansToExclude.reduce((sum: number, loan: any) => sum + Number(loan.amountGived || 0), 0);

            return {
              success: true,
              id: portfolioCleanup.id,
              excludedLoansCount: loansToExclude.length,
              excludedAmount: totalAmount,
              message: `Limpieza masiva registrada. ${loansToExclude.length} préstamos excluidos.`
            };

          } catch (error) {
            console.error('Error en createBulkPortfolioCleanup:', error);
            throw new Error(`Error al crear limpieza masiva de cartera: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }),

      adjustAccountBalance: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          accountId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          targetAmount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
          counterAccountId: graphql.arg({ type: graphql.String }),
          description: graphql.arg({ type: graphql.String })
        },
        resolve: async (root, { accountId, targetAmount, counterAccountId, description }, context: Context) => {
          try {
            const account = await context.prisma.account.findUnique({
              where: { id: accountId },
              include: { route: true }
            });
            if (!account) {
              return { success: false, message: 'Cuenta no encontrada' } as any;
            }

            const current = Number(account.amount || 0);
            const deltaRaw = Number(targetAmount) - current;
            const delta = parseFloat(deltaRaw.toFixed(2));
            if (Math.abs(delta) < 0.01) {
              return { success: true, message: 'La cuenta ya tiene el balance deseado', delta: 0, transactionId: null, newAmount: current } as any;
            }

            let counter = counterAccountId || null;
            if (!counter) {
              const fallback = await context.prisma.account.findFirst({
                where: {
                  id: { not: account.id },
                  OR: [
                    { routeId: account.routeId || undefined },
                    { routeId: null }
                  ],
                  type: 'OFFICE_CASH_FUND'
                }
              });
              if (fallback) counter = fallback.id;
              if (!counter) {
                const anyOther = await context.prisma.account.findFirst({ where: { id: { not: account.id } } });
                if (anyOther) counter = anyOther.id;
              }
            }

            if (!counter) {
              return { success: false, message: 'No hay cuenta contraparte disponible para transferir fondos' } as any;
            }

            const amountStr = Math.abs(delta).toFixed(2);
            const isIncrease = delta > 0;

            const tx = await (context as any).db.Transaction.createOne({
              data: {
                amount: amountStr,
                type: 'TRANSFER',
                description: description || `Ajuste de balance a ${targetAmount.toFixed ? targetAmount.toFixed(2) : targetAmount}`,
                route: account.routeId ? { connect: { id: account.routeId } } : undefined,
                sourceAccount: { connect: { id: isIncrease ? counter : account.id } },
                destinationAccount: { connect: { id: isIncrease ? account.id : counter } },
              }
            });

            const updated = await context.prisma.account.findUnique({ where: { id: account.id } });
            return { success: true, message: 'Ajuste realizado', transactionId: tx?.id || null, delta, newAmount: Number(updated?.amount || 0) } as any;
          } catch (err) {
            console.error('adjustAccountBalance error:', err);
            return { success: false, message: err instanceof Error ? err.message : 'Error desconocido' } as any;
          }
        }
      }),

      createMultipleLoans: graphql.field({
        type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.JSON))),
        args: {
          loans: graphql.arg({ 
            type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.inputObject({
              name: 'MultipleLoanInput',
              fields: {
                requestedAmount: graphql.arg({ type: graphql.nonNull(graphql.String) }),
                amountGived: graphql.arg({ type: graphql.nonNull(graphql.String) }),
                signDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
                avalName: graphql.arg({ type: graphql.String }),
                avalPhone: graphql.arg({ type: graphql.String }),
                comissionAmount: graphql.arg({ type: graphql.String }),
                leadId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
                loantypeId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
                previousLoanId: graphql.arg({ type: graphql.ID }),
                borrowerData: graphql.arg({ 
                  type: graphql.inputObject({
                    name: 'MultipleBorrowerDataInput',
                    fields: {
                      fullName: graphql.arg({ type: graphql.nonNull(graphql.String) }),
                      phone: graphql.arg({ type: graphql.String }),
                    }
                  })
                }),
                // ✅ NUEVO: Campo para manejo de aval
                avalData: graphql.arg({ 
                  type: graphql.inputObject({
                    name: 'AvalDataInput',
                    fields: {
                      selectedCollateralId: graphql.arg({ type: graphql.ID }),
                      action: graphql.arg({ type: graphql.String }), // 'create' | 'update' | 'connect' | 'clear'
                      name: graphql.arg({ type: graphql.String }),
                      phone: graphql.arg({ type: graphql.String })
                    }
                  })
                }),
              }
            }))))
          })
        },
        resolve: async (root, { loans }, context: Context) => {
          try {
            const createdLoans: any[] = [];
            
            // Usar transacción para garantizar atomicidad
            await context.prisma.$transaction(async (tx) => {
              for (const loanData of loans) {
                // Crear o conectar el borrower
                let borrowerId: string;
                
                if (loanData.previousLoanId) {
                  // Si hay préstamo previo, usar el mismo borrower
                  const previousLoan = await tx.loan.findUnique({
                    where: { id: loanData.previousLoanId },
                    include: { borrower: true }
                  });
                  
                  if (!previousLoan?.borrower) {
                    throw new Error(`Préstamo previo ${loanData.previousLoanId} no encontrado o sin borrower`);
                  }
                  
                  borrowerId = previousLoan.borrower.id;
                } else {
                  // Crear nuevo borrower
                  const borrower = await tx.borrower.create({
                    data: {
                      personalData: {
                        create: {
                          fullName: loanData.borrowerData?.fullName || '',
                          phones: loanData.borrowerData?.phone ? {
                            create: [{ number: loanData.borrowerData.phone }]
                          } : undefined
                        }
                      }
                    }
                  });
                  
                  borrowerId = borrower.id;
                }

                // ✅ NUEVO: Manejar aval según la acción especificada
                let collateralConnections: any = {};
                
                console.log('🔍 DEBUG: Datos completos del préstamo recibidos:', {
                  avalName: loanData.avalName,
                  avalPhone: loanData.avalPhone,
                  avalData: loanData.avalData,
                  hasAvalData: !!loanData.avalData,
                  avalDataAction: loanData.avalData?.action,
                  avalDataId: loanData.avalData?.selectedCollateralId,
                  avalDataStringified: JSON.stringify(loanData.avalData, null, 2),
                  '🔍 DEBUG AVAL DATA DETALLADO': {
                    action: loanData.avalData?.action,
                    selectedCollateralId: loanData.avalData?.selectedCollateralId,
                    name: loanData.avalData?.name,
                    phone: loanData.avalData?.phone,
                    nameLength: loanData.avalData?.name?.length,
                    phoneLength: loanData.avalData?.phone?.length,
                    nameTrimmed: loanData.avalData?.name?.trim(),
                    phoneTrimmed: loanData.avalData?.phone?.trim()
                  }
                });
                
                if (loanData.avalData?.action && loanData.avalData.action !== 'clear') {
                  const avalData = loanData.avalData;
                  
                  console.log('🏗️ Procesando aval para préstamo:', {
                    action: avalData.action,
                    selectedCollateralId: avalData.selectedCollateralId,
                    name: avalData.name,
                    phone: avalData.phone
                  });
                  
                  if (avalData.action === 'connect' && avalData.selectedCollateralId) {
                    // ✅ NUEVO: Conectar aval existente, pero si hay cambios, actualizarlo primero
                    console.log('🔗 Conectando aval existente con posible actualización:', {
                      selectedCollateralId: avalData.selectedCollateralId,
                      name: avalData.name,
                      phone: avalData.phone,
                      hasChanges: !!(avalData.name || avalData.phone)
                    });
                    
                    // Si hay cambios en name o phone, actualizar primero
                    if (avalData.name || avalData.phone) {
                      console.log('🔄 Actualizando aval existente antes de conectar:', {
                        action: 'connect (con actualización)',
                        selectedCollateralId: avalData.selectedCollateralId,
                        name: avalData.name,
                        phone: avalData.phone
                      });
                      
                      const updateData: any = {};
                      
                      if (avalData.name) {
                        updateData.fullName = avalData.name;
                        console.log('📝 Actualizando nombre del aval a:', avalData.name);
                      }
                      
                      if (avalData.phone) {
                        updateData.phones = {
                          deleteMany: {},
                          create: [{ number: avalData.phone }]
                        };
                        console.log('📞 Actualizando teléfono del aval a:', avalData.phone);
                      }
                      
                      console.log('💾 Datos de actualización del aval (connect):', updateData);
                      
                      await tx.personalData.update({
                        where: { id: avalData.selectedCollateralId },
                        data: updateData
                      });
                      console.log('✅ Aval actualizado exitosamente antes de conectar:', avalData.selectedCollateralId);
                    }
                    
                    collateralConnections = {
                      collaterals: {
                        connect: [{ id: avalData.selectedCollateralId }]
                      }
                    };
                    console.log('🔗 Aval conectado al préstamo (con actualización si fue necesaria):', avalData.selectedCollateralId);
                    
                  } else if (avalData.action === 'update' && avalData.selectedCollateralId) {
                    // ✅ MEJORADO: Actualizar aval existente y conectar (lógica consistente con connect)
                    console.log('🔄 INICIANDO ACTUALIZACIÓN DE AVAL (update):', {
                      action: avalData.action,
                      selectedCollateralId: avalData.selectedCollateralId,
                      name: avalData.name,
                      phone: avalData.phone,
                      hasName: !!avalData.name,
                      hasPhone: !!avalData.phone,
                      nameLength: avalData.name?.length,
                      phoneLength: avalData.phone?.length
                    });
                    
                    // ✅ NUEVO: Validar que realmente hay datos para actualizar
                    if (!avalData.name && !avalData.phone) {
                      console.log('⚠️ No hay datos para actualizar en el aval (update), procediendo solo con conexión');
                    } else {
                      // ✅ MEJORADO: Lógica de actualización más robusta
                      const updateData: any = {};
                      
                      if (avalData.name && avalData.name.trim()) {
                        updateData.fullName = avalData.name.trim();
                        console.log('📝 Actualizando nombre del aval a:', updateData.fullName);
                      }
                      
                      if (avalData.phone && avalData.phone.trim()) {
                        updateData.phones = {
                          deleteMany: {},
                          create: [{ number: avalData.phone.trim() }]
                        };
                        console.log('📞 Actualizando teléfono del aval a:', updateData.phones.create[0].number);
                      }
                      
                      if (Object.keys(updateData).length > 0) {
                        console.log('💾 Datos de actualización del aval (update):', updateData);
                        
                        try {
                          await tx.personalData.update({
                            where: { id: avalData.selectedCollateralId },
                            data: updateData
                          });
                          console.log('✅ Aval actualizado exitosamente (update):', avalData.selectedCollateralId);
                        } catch (error) {
                          console.error('❌ Error al actualizar aval (update):', error);
                          throw new Error(`Error al actualizar aval: ${error}`);
                        }
                      } else {
                        console.log('ℹ️ No hay cambios válidos para aplicar al aval (update)');
                      }
                    }
                    
                    // ✅ IMPORTANTE: Siempre conectar el aval (actualizado o no)
                    collateralConnections = {
                      collaterals: {
                        connect: [{ id: avalData.selectedCollateralId }]
                      }
                    };
                    
                    console.log('🔗 Aval conectado al préstamo después de update:', avalData.selectedCollateralId);
                  } else if (avalData.action === 'create' && avalData.name) {
                    // Crear nuevo aval
                    const newAval = await tx.personalData.create({
                      data: {
                        fullName: avalData.name,
                        ...(avalData.phone ? {
                          phones: {
                            create: [{ number: avalData.phone }]
                          }
                        } : {})
                      }
                    });
                    
                    collateralConnections = {
                      collaterals: {
                        connect: [{ id: newAval.id }]
                      }
                    };
                    console.log('➕ Nuevo aval creado:', newAval.id);
                  }
                }

                console.log('🔧 Resultado de collateralConnections:', {
                  collateralConnections: JSON.stringify(collateralConnections, null, 2),
                  hasConnections: Object.keys(collateralConnections).length > 0
                });

                // ✅ NUEVO: Crear el préstamo SIN campos legacy (avalName y avalPhone ya no existen)
                console.log('💾 Creando préstamo con configuración:', {
                  hasCollateralConnections: Object.keys(collateralConnections).length > 0,
                  avalAction: loanData.avalData?.action
                });

                // Preparar datos para crear el préstamo
                const loanCreateData = {
                  requestedAmount: parseFloat(loanData.requestedAmount).toFixed(2),
                  amountGived: parseFloat(loanData.amountGived).toFixed(2),
                  signDate: new Date(loanData.signDate),
                  comissionAmount: (parseFloat(loanData.comissionAmount || '0')).toFixed(2),
                  lead: { connect: { id: loanData.leadId } },
                  loantype: { connect: { id: loanData.loantypeId } },
                  borrower: { connect: { id: borrowerId } },
                  ...collateralConnections, // ✅ NUEVO: Conexiones de aval
                  ...(loanData.previousLoanId ? { previousLoan: { connect: { id: loanData.previousLoanId } } } : {}),
                  status: 'ACTIVE'
                };
                
                console.log('📋 Datos finales para crear préstamo:', {
                  loanCreateData: JSON.stringify(loanCreateData, null, 2)
                });

                // Crear el préstamo
                const loan = await tx.loan.create({
                  data: loanCreateData,
                  include: {
                    borrower: {
                      include: {
                        personalData: {
                          include: {
                            phones: true
                          }
                        }
                      }
                    },
                    loantype: true,
                    lead: {
                      include: {
                        personalData: true
                      }
                    },
                    collaterals: { // ✅ NUEVO: Incluir los avales conectados
                      include: {
                        phones: true
                      }
                    }
                  }
                });
                
                console.log('✅ Préstamo creado con avales:', {
                  loanId: loan.id,
                  borrower: loan.borrower,
                  borrowerId: loan.borrower?.id,
                  borrowerPersonalData: loan.borrower?.personalData,
                  borrowerName: loan.borrower?.personalData?.fullName,
                  borrowerPhones: loan.borrower?.personalData?.phones,
                  loantype: loan.loantype,
                  loantypeId: loan.loantype?.id,
                  lead: loan.lead,
                  leadId: loan.lead?.id,
                  collateralsCount: loan.collaterals?.length || 0,
                  collaterals: loan.collaterals?.map(c => ({ id: c.id, name: c.fullName, phone: c.phones?.[0]?.number })) || []
                });

                // ✅ AGREGAR: Crear transacciones y actualizar balance (lógica del hook)
                const lead = await tx.employee.findUnique({
                  where: { id: loanData.leadId }
                });

                if (lead?.routesId) {
                  const account = await tx.account.findFirst({
                    where: { 
                      routeId: lead.routesId,
                      type: 'EMPLOYEE_CASH_FUND'
                    },
                  });

                  if (account) {
                    const loanAmountNum = parseFloat(loanData.amountGived);
                    const commissionAmountNum = parseFloat(loanData.comissionAmount || '0');
                    const currentAmount = parseFloat((account.amount || '0').toString());
                    const newAccountBalance = currentAmount - loanAmountNum - commissionAmountNum;
                    
                    // Crear transacciones LOAN_GRANTED y LOAN_GRANTED_COMISSION
                    await tx.transaction.createMany({
                      data: [
                        {
                          amount: loanAmountNum.toString(),
                          date: new Date(loanData.signDate),
                          type: 'EXPENSE',
                          expenseSource: 'LOAN_GRANTED',
                          sourceAccountId: account.id,
                          loanId: loan.id,
                          leadId: loanData.leadId
                        },
                        {
                          amount: commissionAmountNum.toString(),
                          date: new Date(loanData.signDate),
                          type: 'EXPENSE',
                          expenseSource: 'LOAN_GRANTED_COMISSION',
                          sourceAccountId: account.id,
                          loanId: loan.id,
                          leadId: loanData.leadId
                        }
                      ]
                    });

                    // Actualizar balance de la cuenta
                    await tx.account.update({
                      where: { id: account.id },
                      data: { amount: newAccountBalance.toString() }
                    });

                    // Calcular profit básico
                    const basicProfitAmount = parseFloat(loanData.requestedAmount) * 0.20;
                    await tx.loan.update({
                      where: { id: loan.id },
                      data: { profitAmount: basicProfitAmount.toFixed(2) }
                    });
                  }
                }

                // ✅ AGREGAR: Finalizar préstamo previo si existe
                if (loanData.previousLoanId) {
                  await tx.loan.update({
                    where: { id: loanData.previousLoanId },
                    data: {
                      status: 'RENOVATED',
                      finishedDate: new Date(loanData.signDate)
                      // ✅ NUEVA FUNCIONALIDAD: Establecer fecha de renovación (descomentado después de migración)
                      // renewedDate: new Date(loanData.signDate)
                    }
                  });
                }

                // ✅ AGREGAR: Recalcular métricas del préstamo
                try {
                  // Usar el objeto loan ya creado que ya tiene las relaciones incluidas
                  const loanWithRelations = loan as any;
                  if (loanWithRelations.loantype) {
                    const rate = parseFloat(loanWithRelations.loantype.rate?.toString() || '0');
                    const requested = parseFloat(loanWithRelations.requestedAmount.toString());
                    const weekDuration = Number(loanWithRelations.loantype.weekDuration || 0);
                    const totalDebt = requested * (1 + rate);
                    const expectedWeekly = weekDuration > 0 ? (totalDebt / weekDuration) : 0;
                    const totalPaid = 0; // No hay pagos aún para préstamos nuevos
                    const pending = Math.max(0, totalDebt - totalPaid);
                    
                    await tx.loan.update({
                      where: { id: loan.id },
                      data: {
                        totalDebtAcquired: totalDebt.toFixed(2),
                        expectedWeeklyPayment: expectedWeekly.toFixed(2),
                        totalPaid: totalPaid.toFixed(2),
                        pendingAmountStored: pending.toFixed(2),
                      }
                    });
                  }
                } catch (e) { 
                  console.error('Error recomputing loan metrics (bulk create):', e); 
                }

                const loanResult = {
                  id: loan.id,
                  requestedAmount: loan.requestedAmount,
                  amountGived: loan.amountGived,
                  signDate: loan.signDate,
                  comissionAmount: loan.comissionAmount,
                  borrower: loan.borrower ? {
                    id: loan.borrower.id,
                    personalData: loan.borrower.personalData ? {
                      id: loan.borrower.personalData.id,
                      fullName: loan.borrower.personalData.fullName,
                      phones: loan.borrower.personalData.phones?.map((p: any) => ({ id: p.id, number: p.number })) || []
                    } : null
                  } : null,
                  loantype: loan.loantype ? {
                    id: loan.loantype.id,
                    name: loan.loantype.name,
                    rate: loan.loantype.rate,
                    weekDuration: loan.loantype.weekDuration
                  } : null,
                  lead: loan.lead ? {
                    id: loan.lead.id,
                    personalData: loan.lead.personalData ? {
                      fullName: loan.lead.personalData.fullName
                    } : null
                  } : null
                };
                
                console.log('🔍 DEBUG: Objeto que se agrega a createdLoans:', {
                  loanResult: JSON.stringify(loanResult, null, 2),
                  hasBorrower: !!loanResult.borrower,
                  hasLoanType: !!loanResult.loantype,
                  hasLead: !!loanResult.lead
                });
                
                createdLoans.push(loanResult);
              }
            });

            return createdLoans;
          } catch (error) {
            console.error('Error en createMultipleLoans:', error);
            throw new Error(`Error al crear múltiples préstamos: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }),
      
      // ✅ NUEVA MUTACIÓN: Actualizar préstamo con manejo de avales
      updateLoanWithAval: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          where: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
          data: graphql.arg({ 
            type: graphql.inputObject({
              name: 'UpdateLoanWithAvalInput',
              fields: {
                requestedAmount: graphql.arg({ type: graphql.String }),
                amountGived: graphql.arg({ type: graphql.String }),
                comissionAmount: graphql.arg({ type: graphql.String }),
                avalData: graphql.arg({ 
                  type: graphql.inputObject({
                    name: 'UpdateAvalDataInput',
                    fields: {
                      selectedCollateralId: graphql.arg({ type: graphql.ID }),
                      action: graphql.arg({ type: graphql.String }), // 'create' | 'update' | 'connect' | 'clear'
                      name: graphql.arg({ type: graphql.String }),
                      phone: graphql.arg({ type: graphql.String })
                    }
                  })
                }),
              }
            })
          })
        },
        resolve: async (root, { where, data }, context: Context) => {
          try {
            console.log('🔄 Iniciando updateLoanWithAval:', {
              loanId: where,
              data: data,
              avalData: data.avalData
            });
            
            // Usar transacción para garantizar atomicidad
            return await context.prisma.$transaction(async (tx) => {
              // 0) Obtener el préstamo original ANTES de actualizar para calcular delta en la cuenta
              const originalLoan = await tx.loan.findUnique({ where: { id: where } });

              // 1. Actualizar el préstamo básico
              const loanUpdateData: any = {};
              
              if (data.requestedAmount) loanUpdateData.requestedAmount = parseFloat(data.requestedAmount).toFixed(2);
              if (data.amountGived) loanUpdateData.amountGived = parseFloat(data.amountGived).toFixed(2);
              if (data.comissionAmount) loanUpdateData.comissionAmount = parseFloat(data.comissionAmount).toFixed(2);
              
              const updatedLoan = await tx.loan.update({
                where: { id: where },
                data: loanUpdateData
              });
              
              console.log('✅ Préstamo básico actualizado:', updatedLoan.id);

              // 1.1 Actualizar transacciones asociadas LOAN_GRANTED y LOAN_GRANTED_COMISSION si cambian montos/fecha
              try {
                const existingTransactions = await context.db.Transaction.findMany({
                  where: {
                    loan: { id: { equals: updatedLoan.id } },
                    type: { equals: 'EXPENSE' },
                    OR: [
                      { expenseSource: { equals: 'LOAN_GRANTED' } },
                      { expenseSource: { equals: 'LOAN_GRANTED_COMISSION' } }
                    ]
                  }
                });

                const signDateToUse = (data as any).signDate || updatedLoan.signDate;
                const ops: Promise<any>[] = [];

                for (const tr of (existingTransactions || [])) {
                  if (tr.expenseSource === 'LOAN_GRANTED') {
                    ops.push(context.db.Transaction.updateOne({
                      where: { id: tr.id.toString() },
                      data: {
                        amount: (parseFloat((data.amountGived ?? updatedLoan.amountGived) as any).toFixed(2)).toString(),
                        date: signDateToUse
                      }
                    }));
                  } else if (tr.expenseSource === 'LOAN_GRANTED_COMISSION') {
                    ops.push(context.db.Transaction.updateOne({
                      where: { id: tr.id.toString() },
                      data: {
                        amount: (parseFloat((data.comissionAmount ?? updatedLoan.comissionAmount) as any).toFixed(2)).toString(),
                        date: signDateToUse
                      }
                    }));
                  }
                }

                if (ops.length) {
                  await Promise.all(ops);
                  console.log('🔁 Transacciones LOAN_GRANTED(_COMISSION) actualizadas');
                }
              } catch (e) {
                console.error('⚠️ No se pudo actualizar transacciones asociadas:', e);
              }

              // 1.2 Actualizar balance de cuenta EMPLOYEE_CASH_FUND según delta de montos (usar originalLoan)
              try {
                if (originalLoan) {
                  const lead = await context.db.Employee.findOne({ where: { id: (originalLoan as any).leadId } });
                  const account = await context.prisma.account.findFirst({
                    where: {
                      routeId: (lead as any)?.routesId,
                      type: 'EMPLOYEE_CASH_FUND'
                    }
                  });

                  if (account) {
                    const parseAmountNum = (v: any) => parseFloat((v ?? '0').toString());

                    const oldAmount = parseAmountNum((originalLoan as any).amountGived);
                    const oldCommission = parseAmountNum((originalLoan as any).comissionAmount);
                    const newAmount = parseAmountNum((data as any).amountGived ?? updatedLoan.amountGived);
                    const newCommission = parseAmountNum((data as any).comissionAmount ?? updatedLoan.comissionAmount);

                    const oldTotal = oldAmount + oldCommission;
                    const newTotal = newAmount + newCommission;
                    const balanceChange = oldTotal - newTotal; // mismo criterio que schema.ts

                    const currentAmount = parseFloat(account.amount.toString());
                    const updatedAmount = currentAmount + balanceChange;

                    await context.db.Account.updateOne({
                      where: { id: account.id },
                      data: { amount: updatedAmount.toString() }
                    });

                    console.log('💰 Cuenta EMPLOYEE_CASH_FUND actualizada:', {
                      accountId: account.id,
                      oldTotal,
                      newTotal,
                      balanceChange,
                      updatedAmount
                    });
                  }
                }
              } catch (e) {
                console.error('⚠️ No se pudo actualizar la cuenta asociada:', e);
              }

              // 2. Manejar la lógica de avales
              if (data.avalData?.action && data.avalData.action !== 'clear') {
                const avalData = data.avalData;
                
                console.log('🏗️ Procesando aval para actualización:', {
                  action: avalData.action,
                  selectedCollateralId: avalData.selectedCollateralId,
                  name: avalData.name,
                  phone: avalData.phone
                });
                
                if (avalData.action === 'connect' && avalData.selectedCollateralId) {
                  // ✅ Conectar aval existente, pero si hay cambios, actualizarlo primero
                  console.log('🔗 Conectando aval existente con posible actualización:', {
                    selectedCollateralId: avalData.selectedCollateralId,
                    name: avalData.name,
                    phone: avalData.phone,
                    hasChanges: !!(avalData.name || avalData.phone)
                  });
                  
                  // Si hay cambios en name o phone, actualizar primero
                  if (avalData.name || avalData.phone) {
                    console.log('🔄 Actualizando aval existente antes de conectar:', {
                      action: 'connect (con actualización)',
                      selectedCollateralId: avalData.selectedCollateralId,
                      name: avalData.name,
                      phone: avalData.phone
                    });
                    
                    const updateData: any = {};
                    
                    if (avalData.name) {
                      updateData.fullName = avalData.name;
                      console.log('📝 Actualizando nombre del aval a:', avalData.name);
                    }
                    
                    if (avalData.phone) {
                      updateData.phones = {
                        deleteMany: {},
                        create: [{ number: avalData.phone }]
                      };
                      console.log('📞 Actualizando teléfono del aval a:', avalData.phone);
                    }
                    
                    console.log('💾 Datos de actualización del aval (connect):', updateData);
                    
                    await tx.personalData.update({
                      where: { id: avalData.selectedCollateralId },
                      data: updateData
                    });
                    console.log('✅ Aval actualizado exitosamente antes de conectar:', avalData.selectedCollateralId);
                  }
                  
                  // Conectar el aval al préstamo
                  await tx.loan.update({
                    where: { id: where },
                    data: {
                      collaterals: {
                        set: [], // Limpiar conexiones existentes
                        connect: [{ id: avalData.selectedCollateralId }]
                      }
                    }
                  });
                  console.log('🔗 Aval conectado al préstamo (con actualización si fue necesaria):', avalData.selectedCollateralId);
                  
                } else if (avalData.action === 'update' && avalData.selectedCollateralId) {
                  // ✅ MEJORADO: Actualizar aval existente y conectar (lógica consistente con connect)
                  console.log('🔄 INICIANDO ACTUALIZACIÓN DE AVAL (update):', {
                    action: avalData.action,
                    selectedCollateralId: avalData.selectedCollateralId,
                    name: avalData.name,
                    phone: avalData.phone,
                    hasName: !!avalData.name,
                    hasPhone: !!avalData.phone,
                    nameLength: avalData.name?.length,
                    phoneLength: avalData.phone?.length
                  });
                  
                  // ✅ NUEVO: Validar que realmente hay datos para actualizar
                  if (!avalData.name && !avalData.phone) {
                    console.log('⚠️ No hay datos para actualizar en el aval (update), procediendo solo con conexión');
                  } else {
                    // ✅ MEJORADO: Lógica de actualización más robusta
                    const updateData: any = {};
                    
                    if (avalData.name && avalData.name.trim()) {
                      updateData.fullName = avalData.name.trim();
                      console.log('📝 Actualizando nombre del aval a:', updateData.fullName);
                    }
                    
                    if (avalData.phone && avalData.phone.trim()) {
                      updateData.phones = {
                        deleteMany: {},
                        create: [{ number: avalData.phone.trim() }]
                      };
                      console.log('📞 Actualizando teléfono del aval a:', updateData.phones.create[0].number);
                    }
                    
                    if (Object.keys(updateData).length > 0) {
                      console.log('💾 Datos de actualización del aval (update):', updateData);
                      
                      try {
                        await tx.personalData.update({
                          where: { id: avalData.selectedCollateralId },
                          data: updateData
                        });
                        console.log('✅ Aval actualizado exitosamente (update):', avalData.selectedCollateralId);
                      } catch (error) {
                        console.error('❌ Error al actualizar aval (update):', error);
                        throw new Error(`Error al actualizar aval: ${error}`);
                      }
                    } else {
                      console.log('ℹ️ No hay cambios válidos para aplicar al aval (update)');
                    }
                  }
                  
                  // ✅ IMPORTANTE: Siempre conectar el aval (actualizado o no)
                  await tx.loan.update({
                    where: { id: where },
                    data: {
                      collaterals: {
                        set: [], // Limpiar conexiones existentes
                        connect: [{ id: avalData.selectedCollateralId }]
                      }
                    }
                  });
                  
                  console.log('🔗 Aval conectado al préstamo después de update:', avalData.selectedCollateralId);
                  
                } else if (avalData.action === 'create' && avalData.name) {
                  // Crear nuevo aval
                  const newAval = await tx.personalData.create({
                    data: {
                      fullName: avalData.name,
                      ...(avalData.phone ? {
                        phones: {
                          create: [{ number: avalData.phone }]
                        }
                      } : {})
                    }
                  });
                  
                  // Conectar el nuevo aval al préstamo
                  await tx.loan.update({
                    where: { id: where },
                    data: {
                      collaterals: {
                        set: [], // Limpiar conexiones existentes
                        connect: [{ id: newAval.id }]
                      }
                    }
                  });
                  
                  console.log('➕ Nuevo aval creado y conectado:', newAval.id);
                }
              } else if (data.avalData?.action === 'clear') {
                // Limpiar conexiones de aval
                await tx.loan.update({
                  where: { id: where },
                  data: {
                    collaterals: {
                      set: [] // Limpiar todas las conexiones
                    }
                  }
                });
                console.log('🧹 Conexiones de aval limpiadas del préstamo');
              }
              
              // 3. Obtener el préstamo actualizado con todas las relaciones
              const finalLoan = await tx.loan.findUnique({
                where: { id: where },
                include: {
                  borrower: {
                    include: {
                      personalData: {
                        include: {
                          phones: true,
                          addresses: {
                            include: {
                              location: true
                            }
                          }
                        }
                      }
                    }
                  },
                  loantype: true,
                  lead: {
                    include: {
                      personalData: true
                    }
                  },
                  collaterals: {
                    include: {
                      phones: true
                    }
                  },
                  previousLoan: {
                    include: {
                      borrower: {
                        include: {
                          personalData: {
                            include: {
                              phones: true
                            }
                          }
                        }
                      }
                    }
                  }
                }
              });
              
              console.log('✅ Préstamo actualizado exitosamente con avales:', finalLoan?.id);
              
              // 1.2 Actualizar balance de cuenta EMPLOYEE_CASH_FUND según delta de montos
              try {
                // Obtener préstamo original para calcular delta
                const originalLoan = await tx.loan.findUnique({ where: { id: where } });
                if (originalLoan) {
                  // Buscar lead y cuenta
                  const lead = await context.db.Employee.findOne({ where: { id: (originalLoan as any).leadId } });
                  const account = await context.prisma.account.findFirst({
                    where: {
                      routeId: (lead as any)?.routesId,
                      type: 'EMPLOYEE_CASH_FUND'
                    }
                  });

                  if (account) {
                    const parseAmount = (v: any) => parseFloat((v ?? '0').toString());

                    const oldAmount = parseAmount((originalLoan as any).amountGived);
                    const oldCommission = parseAmount((originalLoan as any).comissionAmount);
                    const newAmount = parseAmount((data as any).amountGived ?? updatedLoan.amountGived);
                    const newCommission = parseAmount((data as any).comissionAmount ?? updatedLoan.comissionAmount);

                    const oldTotal = oldAmount + oldCommission;
                    const newTotal = newAmount + newCommission;
                    const balanceChange = oldTotal - newTotal; // mismo signo que schema.ts

                    const currentAmount = parseFloat(account.amount.toString());
                    const updatedAmount = currentAmount + balanceChange;

                    await context.db.Account.updateOne({
                      where: { id: account.id },
                      data: { amount: updatedAmount.toString() }
                    });

                    console.log('💰 Cuenta EMPLOYEE_CASH_FUND actualizada:', {
                      accountId: account.id,
                      oldTotal,
                      newTotal,
                      balanceChange,
                      updatedAmount
                    });
                  }
                }
              } catch (e) {
                console.error('⚠️ No se pudo actualizar la cuenta asociada:', e);
              }

              return {
                success: true,
                loan: finalLoan,
                message: 'Préstamo actualizado exitosamente'
              };
            });
            
          } catch (error) {
            console.error('Error en updateLoanWithAval:', error);
            return {
              success: false,
              message: `Error al actualizar préstamo: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }
        }
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
            leadExpense: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.leadExpense
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
                LOAN_GRANTED_COMISSION: 0, LEAD_COMISSION: 0, LEAD_EXPENSE: 0,
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
              } else if (transaction.expenseSource === 'LEAD_EXPENSE') {
                localidades[transactionDate][leaderKey].LEAD_EXPENSE += amount;
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
                leadExpense: checkValue(data.LEAD_EXPENSE, 'LEAD_EXPENSE'),
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
              // Modo "Semanas Activas": decide pertenencia por mayoría de días laborales (L-V) del mes,
              // pero las ventanas semanales abarcan de lunes a domingo para el conteo de eventos
              const firstDayOfMonth = new Date(year, month - 1, 1);
              const lastDayOfMonth = new Date(year, month, 0);
              
              let currentDate = new Date(firstDayOfMonth);
              // Retroceder hasta el primer lunes previo/al inicio del mes
              while (currentDate.getDay() !== 1) { // 1 = lunes
                currentDate.setDate(currentDate.getDate() - 1);
              }
              
              let weekNumber = 1;
              while (currentDate <= lastDayOfMonth) {
                const weekStart = new Date(currentDate);
                const weekEnd = new Date(currentDate);
                // ventana de conteo: lunes-domingo
                weekEnd.setDate(weekEnd.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                
                // contar mayoría en L-V para decidir pertenencia al mes
                let workDaysInMonth = 0;
                let tempDate = new Date(weekStart);
                for (let i = 0; i < 5; i++) { // Lunes a Viernes
                  if (tempDate.getMonth() === month - 1) workDaysInMonth++;
                  tempDate.setDate(tempDate.getDate() + 1);
                }
                
                if (workDaysInMonth >= 3) { // mayoría de 5 días
                  const weekKey = `SEMANA ${weekNumber}`;
                  weeks[weekKey] = { start: new Date(weekStart), end: weekEnd };
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
            const allLoans = await (context.prisma as any).loan.findMany({
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
                },
                excludedByCleanup: {
                  include: {
                    executedBy: true
                  }
                }
              }
            });
            console.log("================ASDASDASD================");
            console.log(allLoans.length);

            // Ya se excluyeron en la consulta (where: excludedByCleanup: { is: null })
            let filteredLoans = allLoans;

            // Determina si el préstamo se considera ACTIVO en la fecha dada según las reglas solicitadas
            const isLoanConsideredOnDate = (loan: any, date: Date) => {
              const signDate = new Date(loan.signDate);
              if (signDate > date) return false;
              
              // Solo los marcados como ACTIVE o RENOVATED en la DB
              const isActiveByStatus = ['ACTIVE'].includes(loan.status || '');
              if (!isActiveByStatus) return false;

              // Excluir si existe un registro de limpieza aplicado antes de la fecha de referencia
              if (loan.excludedByCleanup?.cleanupDate) {
                const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate as any);
                // A partir del día de la limpieza ya no se considera activo
                if (date >= cleanupDate) return false;
              }

              // Excluir si ya tiene finishedDate en o antes de la fecha (consistencia temporal)
              if (loan.finishedDate && new Date(loan.finishedDate) <= date) return false;

              return true;
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

              // Debug counters para primera semana
              let debugFirstWeekCounters: any = null;
              if (isFirstWeek && useActiveWeeks && (year === 2025) && (month === 1 || month === 2)) {
                debugFirstWeekCounters = { total: 0, considered: 0, byReason: { status: 0, signedAfter: 0, finishedBefore: 0, cleanupOnOrBefore: 0 } };
              }

              // (Lógica simplificada solicitada) No neutralizamos renovaciones; los conteos N (granted) y Y (finished) se usan tal cual

              filteredLoans.forEach((loan: any) => {
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
                    grantedLoans: [],
                    grantedLoansNew: [],
                    grantedLoansRenewed: [],
                    finished: 0,
                    finishedLoans: [],
                    cvClients: [],
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

                // Préstamos activos al inicio de la semana (siempre domingo 23:59:59.999 antes del lunes)
                const startReferenceDate = new Date(weekStart.getTime() - 1);
                let activeAtStartCond = isLoanConsideredOnDate(loan, startReferenceDate);
                // Neutralizar renovaciones dentro de la misma semana para el stock inicial:
                // si el previousLoan se cerró antes del corte y este nuevo se firma dentro de la semana,
                // considerar que no incrementa activos al inicio (entrará durante la semana como otorgado, afectando fin).
                if (activeAtStartCond && loan.previousLoanId) {
                  const sd = new Date(loan.signDate);
                  const prevFinished = loan.previousLoan?.finishedDate ? new Date(loan.previousLoan.finishedDate as any) : null;
                  if (sd >= weekStart && sd <= weekEnd && prevFinished && prevFinished <= startReferenceDate) {
                    activeAtStartCond = false; // no estaba activo al inicio (es una sustitución por renovación)
                  }
                }
                if (activeAtStartCond) {
                  data.activeAtStart++;
                  data.totalAmountAtStart += loanAmount;
                  if (isFirstWeek && debugFirstWeekCounters) {
                    debugFirstWeekCounters.total++;
                    debugFirstWeekCounters.considered++;
                  }
                } else if (isFirstWeek && debugFirstWeekCounters) {
                  debugFirstWeekCounters.total++;
                  const signDate = new Date(loan.signDate);
                  const finishedDate = loan.finishedDate ? new Date(loan.finishedDate) : null;
                  const cleanupDate = loan.excludedByCleanup?.cleanupDate ? new Date(loan.excludedByCleanup.cleanupDate as any) : null;
                  const activeByStatus = ['ACTIVE'].includes(loan.status || '');
                  if (!activeByStatus) debugFirstWeekCounters.byReason.status++;
                  else if (signDate > startReferenceDate) debugFirstWeekCounters.byReason.signedAfter++;
                  else if (finishedDate && finishedDate <= startReferenceDate) debugFirstWeekCounters.byReason.finishedBefore++;
                  else if (cleanupDate && startReferenceDate >= cleanupDate) debugFirstWeekCounters.byReason.cleanupOnOrBefore++;
                }

                // Préstamos otorgados durante la semana
                const signDate = new Date(loan.signDate);
                if (signDate >= weekStart && signDate <= weekEnd) {
                  data.granted++;
                  data.grantedAmount += loanAmount;
                    (data.grantedLoans as any[]).push({
                    id: loan.id,
                    date: signDate,
                      finishedDate: loan.finishedDate || null,
                    amountGived: Number(loan.amountGived || 0),
                    fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                    previousFinishedDate: loan.previousLoan?.finishedDate || null
                  });
                  
                  if (loan.previousLoanId) {
                    data.grantedRenewed++;
                    (data.grantedLoansRenewed as any[]).push({
                      id: loan.id,
                      date: signDate,
                      finishedDate: loan.finishedDate || null,
                      amountGived: Number(loan.amountGived || 0),
                      fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                      previousFinishedDate: loan.previousLoan?.finishedDate || null
                    });
                  } else {
                    data.grantedNew++;
                    (data.grantedLoansNew as any[]).push({
                      id: loan.id,
                      date: signDate,
                      finishedDate: loan.finishedDate || null,
                      amountGived: Number(loan.amountGived || 0),
                      fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                      previousFinishedDate: null
                    });
                  }
                }

                // Préstamos finalizados durante la semana (por finishedDate)
                if (loan.finishedDate) {
                  const finishedDate = new Date(loan.finishedDate);
                  const isWithinWeek = finishedDate >= weekStart && finishedDate <= weekEnd;
                  // Misma lógica para ambos modos: solo importa el rango semanal ya calculado
                  if (isWithinWeek) {
                    data.finished++;
                    data.finishedAmount += loanAmount;
                    (data.finishedLoans as any[]).push({
                      id: loan.id,
                      finishedDate,
                      startDate: loan.signDate,
                      amountGived: Number(loan.amountGived || 0),
                      fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                      reason: 'FINISHED_DATE'
                    });
                  }
                }

                // Efecto de PortfolioCleanup durante la semana: tratarlo como salida de cartera
                if (loan.excludedByCleanup?.cleanupDate) {
                  const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate as any);
                  if (cleanupDate >= weekStart && cleanupDate <= weekEnd) {
                    data.finished++;
                    data.finishedAmount += loanAmount;
                    (data.finishedLoans as any[]).push({
                      id: loan.id,
                      finishedDate: cleanupDate,
                      startDate: loan.signDate,
                      amountGived: Number(loan.amountGived || 0),
                      fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                      reason: 'PORTFOLIO_CLEANUP'
                    });
                  }
                }
              });

              // Eliminado el arrastre por previousWeekActiveAtEnd; el inicio se calcula siempre por condición en el corte del domingo

              // Calcular CV (Créditos Vencidos) basado en conteo de pagos por semana
              // Reglas:
              // - 0 pagos en la semana => +1
              // - pagos < 50% del pago semanal esperado => +1
              // - pagos >= 50% y < 100% del pago semanal esperado => +0.5
              // - pagos >= 100% del pago semanal esperado => +0
              // Nota: Ignoramos badDebt para este reporte; los préstamos excluidos por cleanup ya no están aquí
              filteredLoans.forEach((loan: any) => {
                const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                                loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                                'Sin localidad';

                const data = localitiesData[locality];
                if (!data) return;

                // Solo procesar si el préstamo está activo durante la semana
                const isActiveInWeek = isLoanConsideredOnDate(loan, weekStart) || isLoanConsideredOnDate(loan, weekEnd);
                if (!isActiveInWeek) return;

                // Si el préstamo se firmó dentro de esta semana, no se espera pago en esta misma semana
                try {
                  const signDate = new Date(loan.signDate);
                  if (signDate >= weekStart && signDate <= weekEnd) {
                    return; // excluir de CV esta semana
                  }
                } catch (_) {}

                // Sumar pagos de la semana
                let weeklyPaid = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                  if (paymentDate >= weekStart && paymentDate <= weekEnd) {
                    weeklyPaid += Number(payment.amount || 0);
                  }
                }

                // Calcular pago semanal esperado
                let expectedWeekly = 0;
                try {
                  const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
                  const duration = Number(loan.loantype?.weekDuration || 0);
                  const requested = parseFloat(loan.requestedAmount?.toString?.() || `${loan.requestedAmount || 0}`);
                  if (duration > 0) {
                    const totalAmountToPay = requested * (1 + rate);
                    expectedWeekly = totalAmountToPay / duration;
                  }
                } catch (_) {}

                // Calcular excedente previo a la semana (pagos acumulados menos lo esperado hasta antes de esta semana)
                let paidBeforeWeek = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                  if (paymentDate < weekStart) paidBeforeWeek += Number(payment.amount || 0);
                }
                let surplusBefore = 0;
                try {
                  const sign = new Date(loan.signDate);
                  const weeksElapsed = Math.floor((weekStart.getTime() - sign.getTime()) / (7 * 24 * 60 * 60 * 1000));
                  const expectedBefore = Math.max(0, weeksElapsed - 1) * (expectedWeekly || 0); // primera semana no paga
                  surplusBefore = paidBeforeWeek - expectedBefore;
                } catch {}

                // Aplicar reglas de contribución (considerando excedente previo)
                if (weeklyPaid === 0) {
                  if (surplusBefore >= (expectedWeekly || 0)) {
                    // Excedente cubre la semana completa => no CV
                  } else {
                    data.cv += 1;
                  data.cvAmount += Number(loan.amountGived || 0);
                    // Guardar para hover: solo los que NO pagaron
                    (data.cvClients as any[]).push({
                      id: loan.id,
                      fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                      amountGived: Number(loan.amountGived || 0),
                      date: loan.signDate
                    });
                  }
                } else if (expectedWeekly > 0) {
                  if (weeklyPaid >= expectedWeekly) {
                    // Cumplió la semana con pagos de la misma semana
                  } else if (surplusBefore >= expectedWeekly) {
                    // Traía excedente suficiente para cubrir esta semana
                  } else if (weeklyPaid < 0.5 * expectedWeekly) {
                    // Pagó menos del 50% => cuenta como 1
                    data.cv += 1;
                    data.cvAmount += Number(loan.amountGived || 0);
                  } else {
                    // Entre 50% y 100% sin excedente => 0.5
                    data.cv += 0.5;
                  }
                }
              });

              // Calcular activos al final usando N-Y sobre el stock inicial
              Object.keys(localitiesData).forEach(locality => {
                const data = localitiesData[locality];
                const delta = (data.granted || 0) - (data.finished || 0);
                data.activeAtEnd = data.activeAtStart + delta;
                if (data.activeAtEnd < 0) data.activeAtEnd = 0;
                data.totalAmountAtEnd = Math.max(0, data.totalAmountAtStart + (data.grantedAmount || 0) - (data.finishedAmount || 0));
                previousWeekActiveAtEnd[locality] = data.activeAtEnd;
              });

              reportData[weekKey] = localitiesData;

              // Debug focalizado por localidad: Atasta (semana 2)
              try {
                const atastaKey = Object.keys(localitiesData).find(k => (k || '').toLowerCase().includes('atasta'));
                if (atastaKey && weekKey === 'SEMANA 2') {
                  const d = localitiesData[atastaKey];
                  console.log(`🔎 Atasta ${weekKey}: start=${d.activeAtStart} end=${d.activeAtEnd} granted=${d.granted} (new=${d.grantedNew}, ren=${d.grantedRenewed}) finished=${d.finished} cv=${d.cv}`);
                  console.log(`   Atasta loans: granted=${(d.grantedLoans||[]).length}, finished=${(d.finishedLoans||[]).length}`);

                  // Diff de IDs activos al inicio (domingo) vs fin (domingo)
                  const startRef = new Date(weeks[weekKey].start.getTime() - 1);
                  const endRef = weeks[weekKey].end;
                  const entrants: any[] = [];
                  const leavers: any[] = [];
                  filteredLoans.forEach((loan: any) => {
                    const loc = (loan.borrower?.personalData?.addresses?.[0]?.location?.name || loan.lead?.personalData?.addresses?.[0]?.location?.name || '').toLowerCase();
                    if (!loc.includes('atasta')) return;
                    const wasActive = isLoanConsideredOnDate(loan, startRef);
                    const isActive = isLoanConsideredOnDate(loan, endRef);
                    if (!wasActive && isActive) {
                      entrants.push({ id: loan.id, signDate: loan.signDate, finishedDate: loan.finishedDate, cleanupDate: loan.excludedByCleanup?.cleanupDate || null, status: loan.status, prevFinished: loan.previousLoan?.finishedDate || null });
                    } else if (wasActive && !isActive) {
                      leavers.push({ id: loan.id, signDate: loan.signDate, finishedDate: loan.finishedDate, cleanupDate: loan.excludedByCleanup?.cleanupDate || null, status: loan.status, prevFinished: loan.previousLoan?.finishedDate || null });
                    }
                  });
                  // Subdividir por tipo para debug
                  const inWeek = (d: Date | null) => !!d && d >= weekStart && d <= weekEnd;
                  const entrantsRenewed = entrants.filter(e => !!e.prevFinished && inWeek(new Date(e.signDate)));
                  const entrantsNew = entrants.filter(e => !e.prevFinished);
                  const leaversRenovationPrev = leavers.filter(l => renewedPrevIdsThisWeek.has(l.id));
                  const leaversFinished = leavers.filter(l => inWeek(l.finishedDate ? new Date(l.finishedDate) : null) && !renewedPrevIdsThisWeek.has(l.id));
                  const leaversCleanup = leavers.filter(l => inWeek(l.cleanupDate ? new Date(l.cleanupDate) : null));
                  const leaversOther = leavers.filter(l => !leaversRenovationPrev.includes(l) && !leaversFinished.includes(l) && !leaversCleanup.includes(l));

                  console.log(`   Atasta diff: entrants=${entrants.length} (new=${entrantsNew.length}, renewed=${entrantsRenewed.length}), leavers=${leavers.length} (prevRenov=${leaversRenovationPrev.length}, finished=${leaversFinished.length}, cleanup=${leaversCleanup.length}, other=${leaversOther.length})`);
                  console.log('   Entrants NEW sample:', entrantsNew.slice(0, 5));
                  console.log('   Entrants RENEWED sample:', entrantsRenewed.slice(0, 5));
                  console.log('   Leavers PREV-RENOV sample:', leaversRenovationPrev.slice(0, 5));
                  console.log('   Leavers FINISHED sample:', leaversFinished.slice(0, 5));
                  console.log('   Leavers CLEANUP sample:', leaversCleanup.slice(0, 5));
                }
              } catch (_) {}

              if (isFirstWeek && debugFirstWeekCounters) {
                try {
                  console.log(`🔍 FirstWeekStartBreakdown ${routeId} ${year}-${month} ${weekKey}:`, debugFirstWeekCounters);
                } catch (_) {}
              }
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
                finishedLoans: [],
                finishedByCleanup: 0,
                cv: 0, // Créditos Vencidos
                cvClients: [],
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
                weeklyTotals[weekKey].finishedLoans.push(...(localityData.finishedLoans || []));
                weeklyTotals[weekKey].finishedByCleanup += (localityData.finishedLoans || []).filter((f: any) => f.reason === 'PORTFOLIO_CLEANUP').length;
                weeklyTotals[weekKey].cv += localityData.cv; // Sumar CV
                weeklyTotals[weekKey].cvClients.push(...(localityData.cvClients || []));
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

            // Debug controlado para validar corte de meses con semanas activas
            try {
              if (useActiveWeeks && (year === 2025) && (month === 1 || month === 2)) {
                console.log(`🧪 Debug Semanas Activas ${routeId} ${year}-${month}`);
                weekOrder.forEach(k => {
                  const w = weeks[k];
                  const s = w.start.toISOString().slice(0,10);
                  const e = w.end.toISOString().slice(0,10);
                  const tot = weeklyTotals[k];
                  console.log(`  ${k}: ${s} -> ${e} | start=${tot.activeAtStart} end=${tot.activeAtEnd} granted=${tot.granted} finished=${tot.finished}`);
                });
                console.log('  Summary:', {
                  start: weekOrder.length ? weeklyTotals[weekOrder[0]].activeAtStart : 0,
                  end: weekOrder.length ? weeklyTotals[weekOrder[weekOrder.length-1]].activeAtEnd : 0,
                });
              }
            } catch (_) {}

              // Calcular conteos de cleanup acumulados hasta fin de mes
              const cleanupToDateCount = allLoans.filter((loan: any) => {
                const cd = loan.excludedByCleanup?.cleanupDate ? new Date(loan.excludedByCleanup.cleanupDate as any) : null;
                return !!cd && cd <= monthEnd;
              }).length;

              // Calcular CV mensual promedio (promedio simple de CV semanal)
              const cvMonthlyAvg = weekOrder.length > 0
                ? (weekOrder.reduce((acc, wk) => acc + (weeklyTotals[wk]?.cv || 0), 0) / weekOrder.length)
                : 0;

              // KPI auxiliares por semana
              const weeklyCv = weekOrder.map(wk => Number(weeklyTotals[wk]?.cv || 0));
              const weeklyPayingPct = weekOrder.map(wk => {
                const act = Number(weeklyTotals[wk]?.activeAtEnd || 0);
                const cv = Number(weeklyTotals[wk]?.cv || 0);
                return act > 0 ? (1 - (cv / act)) * 100 : 0;
              });

              // Cerrados sin renovar por semana (renovación dentro del mismo mes)
              const isRenewedInMonth = (finishedId: string) => {
                return allLoans.some((ln: any) => {
                  if (!ln.previousLoanId) return false;
                  if (ln.previousLoanId !== finishedId) return false;
                  const sd = new Date(ln.signDate);
                  return sd >= monthStart && sd <= monthEnd;
                });
              };

              const weeklyClosedWithoutRenewal: { [week: string]: number } = {};
              weekOrder.forEach(wk => {
                const total = Object.values(reportData[wk] || {}).reduce((acc: number, loc: any) => {
                  const fins = (loc.finishedLoans || []).filter((f: any) => f?.reason !== 'PORTFOLIO_CLEANUP');
                  let count = 0;
                  for (const f of fins) {
                    if (!isRenewedInMonth(f.id)) count++;
                  }
                  return acc + count;
                }, 0);
                weeklyClosedWithoutRenewal[wk] = total;
              });

              // Totales de mes
              const grantedInMonth = Object.values(weeklyTotals).reduce((sum: number, w: any) => sum + (w.granted || 0), 0);
              const finishedInMonth = Object.values(weeklyTotals).reduce((sum: number, w: any) => sum + (w.finished || 0), 0);
              const finishedByCleanupInMonth = Object.values(weeklyTotals).reduce((sum: number, w: any) => sum + (w.finishedByCleanup || 0), 0);
              const totalClosedNonCleanupInMonth = finishedInMonth - finishedByCleanupInMonth;
              const closedWithoutRenewalInMonth = weekOrder.reduce((sum, wk) => sum + (weeklyClosedWithoutRenewal[wk] || 0), 0);
              const weeklyClosedWithoutRenewalSeries = weekOrder.map(wk => weeklyClosedWithoutRenewal[wk] || 0);

              // Renovaciones con aumento (signDate dentro del mes actual y con previousLoan)
              let renewalsInMonth = 0;
              let renewalsIncreasedCount = 0;
              let renewalsIncreasePercentSum = 0;
              filteredLoans.forEach((loan: any) => {
                const sd = new Date(loan.signDate);
                if (sd >= monthStart && sd <= monthEnd && loan.previousLoanId) {
                  renewalsInMonth++;
                  const prevAmount = Number(loan.previousLoan?.amountGived || 0);
                  const currAmount = Number(loan.amountGived || 0);
                  if (prevAmount > 0 && currAmount > prevAmount) {
                    renewalsIncreasedCount++;
                    const incPct = ((currAmount - prevAmount) / prevAmount) * 100;
                    renewalsIncreasePercentSum += incPct;
                  }
                }
              });
              const renewalsAvgIncreasePercent = renewalsIncreasedCount > 0 ? (renewalsIncreasePercentSum / renewalsIncreasedCount) : 0;

              // Deltas inicio vs fin
              const activeStart = weekOrder.length ? Number(weeklyTotals[weekOrder[0]].activeAtStart || 0) : 0;
              const activeEnd = weekOrder.length ? Number(weeklyTotals[weekOrder[weekOrder.length - 1]].activeAtEnd || 0) : 0;
              const activeDelta = activeEnd - activeStart;

              const cvStart = weekOrder.length ? weeklyCv[0] : 0;
              const cvEnd = weekOrder.length ? weeklyCv[weeklyCv.length - 1] : 0;
              const cvDelta = cvEnd - cvStart;

              const payStart = weekOrder.length ? weeklyPayingPct[0] : 0;
              const payEnd = weekOrder.length ? weeklyPayingPct[weeklyPayingPct.length - 1] : 0;
              const payDelta = payEnd - payStart;

              // Totales/Promedios
              const payingPercentMonthlyAvg = weeklyPayingPct.length ? (weeklyPayingPct.reduce((a, b) => a + b, 0) / weeklyPayingPct.length) : 0;
              const payingClientsWeeklyAvg = weekOrder.length > 0
                ? (weekOrder.reduce((sum, wk) => {
                    const wt: any = weeklyTotals[wk] || {};
                    const act = Number(wt.activeAtEnd || 0);
                    const cv = Number(wt.cv || 0);
                    return sum + Math.max(0, act - cv);
                  }, 0) / weekOrder.length)
                : 0;

              // CV promedio mes anterior (usando mismas semanas activas del mes anterior aprox: promediamos por semanas del mes anterior según semana del último día)
              let cvMonthlyAvgPrev = 0;
              try {
                const prev = new Date(year, month - 2, 1);
                const monthStartPrev = new Date(prev.getFullYear(), prev.getMonth(), 1, 0, 0, 0, 0);
                const monthEndPrev = new Date(prev.getFullYear(), prev.getMonth() + 1, 0, 23, 59, 59, 999);

                // Generar semanas L-D completas dentro del mes previo (semanas activas aproximadas)
                const weeksPrev: Array<{ start: Date; end: Date }> = [];
                let cursor = new Date(monthStartPrev);
                // mover a lunes
                const d = cursor.getDay();
                const offset = (d + 6) % 7; // 0 lunes
                cursor.setDate(cursor.getDate() - offset);
                cursor.setHours(0,0,0,0);
                while (cursor <= monthEndPrev) {
                  const start = new Date(cursor);
                  const end = new Date(start);
                  end.setDate(end.getDate() + 6);
                  end.setHours(23,59,59,999);
                  // semana que toca parcialmente el mes, la consideramos si la mayoría de días laborables (lun-vie) caen dentro del mes
                  let weekdaysInMonth = 0;
                  for (let i = 0; i < 7; i++) {
                    const day = new Date(start);
                    day.setDate(start.getDate() + i);
                    const isWeekday = day.getDay() >= 1 && day.getDay() <= 5;
                    if (isWeekday && day >= monthStartPrev && day <= monthEndPrev) weekdaysInMonth++;
                  }
                  if (weekdaysInMonth >= 3) weeksPrev.push({ start, end });
                  cursor.setDate(cursor.getDate() + 7);
                }

                const cvPrevList: number[] = [];
                for (const w of weeksPrev) {
                  let cvWeek = 0;
                  filteredLoans.forEach((loan: any) => {
                    const isActive = isLoanConsideredOnDate(loan, w.start) || isLoanConsideredOnDate(loan, w.end);
                    if (!isActive) return;
                    // excluir firmas dentro de la semana
                    const sd = new Date(loan.signDate);
                    if (sd >= w.start && sd <= w.end) return;
                    let weeklyPaid = 0;
                    for (const p of loan.payments || []) {
                      const pd = new Date(p.receivedAt || p.createdAt);
                      if (pd >= w.start && pd <= w.end) weeklyPaid += Number(p.amount || 0);
                    }
                    let expected = 0;
                    try {
                      const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
                      const dur = Number(loan.loantype?.weekDuration || 0);
                      const requested = parseFloat(loan.requestedAmount?.toString?.() || `${loan.requestedAmount || 0}`);
                      if (dur > 0) expected = (requested * (1 + rate)) / dur;
                    } catch {}
                    if (weeklyPaid === 0) cvWeek += 1; else if (expected > 0) {
                      if (weeklyPaid < 0.5 * expected) cvWeek += 1; else if (weeklyPaid < expected) cvWeek += 0.5;
                    }
                  });
                  cvPrevList.push(cvWeek);
                }
                if (cvPrevList.length > 0) {
                  cvMonthlyAvgPrev = cvPrevList.reduce((a, b) => a + b, 0) / cvPrevList.length;
                }
              } catch {}

              // Clientes pagando al cierre del mes actual (activos al final - CV de la última semana)
              const payingClientsEndOfMonth = (weekOrder.length > 0)
                ? Math.max(0, Number(weeklyTotals[weekOrder[weekOrder.length - 1]].activeAtEnd || 0) - Number(weeklyTotals[weekOrder[weekOrder.length - 1]].cv || 0))
                : 0;

              // Clientes pagando del mes anterior (aprox usando la última semana activa del mes anterior)
              let payingClientsPrevMonth = 0;
              let grantedPrevMonth = 0;
              let closedWithoutRenewalPrevMonth = 0;
              try {
                const prev = new Date(year, month - 2, 1);
                const monthStartPrev = new Date(prev.getFullYear(), prev.getMonth(), 1, 0, 0, 0, 0);
                const monthEndPrev = new Date(prev.getFullYear(), prev.getMonth() + 1, 0, 23, 59, 59, 999);
                // Calcular semana (Lunes a Domingo) que contiene el último día del mes anterior
                const dow = monthEndPrev.getDay(); // 0 Dom .. 6 Sab
                const mondayOffset = ((dow + 6) % 7);
                const weekStartPrev = new Date(monthEndPrev);
                weekStartPrev.setDate(weekStartPrev.getDate() - mondayOffset);
                weekStartPrev.setHours(0, 0, 0, 0);
                const weekEndPrev = new Date(weekStartPrev);
                weekEndPrev.setDate(weekEndPrev.getDate() + 6);
                weekEndPrev.setHours(23, 59, 59, 999);

                // Conteos previos
                let activePrevEnd = 0;
                let cvPrev = 0;
                filteredLoans.forEach((loan: any) => {
                  const isActive = isLoanConsideredOnDate(loan, weekStartPrev) || isLoanConsideredOnDate(loan, weekEndPrev);
                  if (!isActive) return;
                  // activo al cierre
                  if (isLoanConsideredOnDate(loan, weekEndPrev)) activePrevEnd++;

                  // Excluir firmas dentro de la misma semana para CV
                  const sd = new Date(loan.signDate);
                  if (sd >= weekStartPrev && sd <= weekEndPrev) return;

                  // Sumar pagos en la semana
                  let weeklyPaid = 0;
                  for (const p of loan.payments || []) {
                    const pd = new Date(p.receivedAt || p.createdAt);
                    if (pd >= weekStartPrev && pd <= weekEndPrev) weeklyPaid += Number(p.amount || 0);
                  }
                  // Esperado semanal
                  let expectedWeekly = 0;
                  try {
                    const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
                    const duration = Number(loan.loantype?.weekDuration || 0);
                    const requested = parseFloat(loan.requestedAmount?.toString?.() || `${loan.requestedAmount || 0}`);
                    if (duration > 0) expectedWeekly = (requested * (1 + rate)) / duration;
                  } catch {}
                  if (weeklyPaid === 0) cvPrev += 1;
                  else if (expectedWeekly > 0) {
                    if (weeklyPaid < 0.5 * expectedWeekly) cvPrev += 1;
                    else if (weeklyPaid < expectedWeekly) cvPrev += 0.5;
                  }
                });
                payingClientsPrevMonth = Math.max(0, activePrevEnd - cvPrev);

                // Otorgados prev mes (signDate en mes previo)
                grantedPrevMonth = filteredLoans.reduce((acc: number, loan: any) => {
                  const sd = new Date(loan.signDate);
                  return acc + ((sd >= monthStartPrev && sd <= monthEndPrev) ? 1 : 0);
                }, 0);

                // Cerrados sin renovar prev mes (finishedDate en mes previo y sin nueva renovación en mes previo)
                const isRenewedInPrevMonth = (finishedId: string) => {
                  return filteredLoans.some((ln: any) => {
                    if (!ln.previousLoanId) return false;
                    if (ln.previousLoanId !== finishedId) return false;
                    const sd = new Date(ln.signDate);
                    return sd >= monthStartPrev && sd <= monthEndPrev;
                  });
                };
                closedWithoutRenewalPrevMonth = filteredLoans.reduce((acc: number, loan: any) => {
                  const fd = loan.finishedDate ? new Date(loan.finishedDate as any) : null;
                  if (!fd) return acc;
                  if (fd >= monthStartPrev && fd <= monthEndPrev) {
                    return acc + (isRenewedInPrevMonth(loan.id) ? 0 : 1);
                  }
                  return acc;
                }, 0);
              } catch {}

            // KPI Gasolina (mes actual vs mes anterior)
            let gasolineCurrent = 0;
            let gasolinePrevious = 0;
            try {
              const thisMonthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
              const thisMonthEnd = new Date(year, month, 0, 23, 59, 59, 999);
              const prevBase = new Date(year, month - 2, 1, 0, 0, 0, 0);
              const prevMonthStart = new Date(prevBase.getFullYear(), prevBase.getMonth(), 1, 0, 0, 0, 0);
              const prevMonthEnd = new Date(prevBase.getFullYear(), prevBase.getMonth() + 1, 0, 23, 59, 59, 999);

              const aggCurr: any = await context.prisma.transaction.aggregate({
                _sum: { amount: true },
                where: {
                  routeId,
                  type: 'EXPENSE',
                  expenseSource: 'GASOLINE',
                  date: { gte: thisMonthStart, lte: thisMonthEnd }
                }
              } as any);
              const aggPrev: any = await context.prisma.transaction.aggregate({
                _sum: { amount: true },
                where: {
                  routeId,
                  type: 'EXPENSE',
                  expenseSource: 'GASOLINE',
                  date: { gte: prevMonthStart, lte: prevMonthEnd }
                }
              } as any);
              gasolineCurrent = Number(aggCurr?._sum?.amount || 0);
              gasolinePrevious = Number(aggPrev?._sum?.amount || 0);
            } catch (_) {}

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
                totalGrantedInMonth: grantedInMonth,
                totalFinishedInMonth: finishedInMonth,
                  totalFinishedByCleanupInMonth: finishedByCleanupInMonth,
                  totalFinishedByCleanupToDate: cleanupToDateCount,
                netChangeInMonth: weekOrder.length > 0 ? weeklyTotals[weekOrder[weekOrder.length - 1]].activeAtEnd - weeklyTotals[weekOrder[0]].activeAtStart : 0,
                cvMonthlyAvg,
                cvMonthlyAvgPrev,
                payingPercentMonthlyAvg,
                closedWithoutRenewalInMonth,
                totalClosedNonCleanupInMonth,
                closedWithRenewalInMonth: Math.max(0, totalClosedNonCleanupInMonth - closedWithoutRenewalInMonth),
                payingClientsEndOfMonth,
                payingClientsPrevMonth,
                grantedPrevMonth,
                closedWithoutRenewalPrevMonth,
                payingClientsWeeklyAvg,
                payingClientsWeeklyAvgPrev: payingClientsPrevMonth,
                renewalsInMonth,
                renewalsIncreasedCount,
                renewalsAvgIncreasePercent,
                weeklyClosedWithoutRenewalSeries,
                kpis: {
                  active: { start: activeStart, end: activeEnd, delta: activeDelta },
                  cv: { start: cvStart, end: cvEnd, delta: cvDelta, average: cvMonthlyAvg },
                  payingPercent: { start: payStart, end: payEnd, delta: payDelta, average: payingPercentMonthlyAvg },
                  granted: { total: grantedInMonth, startWeek: weekOrder.length ? weeklyTotals[weekOrder[0]].granted : 0, endWeek: weekOrder.length ? weeklyTotals[weekOrder[weekOrder.length - 1]].granted : 0, delta: weekOrder.length ? (weeklyTotals[weekOrder[weekOrder.length - 1]].granted - weeklyTotals[weekOrder[0]].granted) : 0 },
                  closedWithoutRenewal: { total: closedWithoutRenewalInMonth, startWeek: weekOrder.length ? (weeklyClosedWithoutRenewal[weekOrder[0]] || 0) : 0, endWeek: weekOrder.length ? (weeklyClosedWithoutRenewal[weekOrder[weekOrder.length - 1]] || 0) : 0, delta: weekOrder.length ? ((weeklyClosedWithoutRenewal[weekOrder[weekOrder.length - 1]] || 0) - (weeklyClosedWithoutRenewal[weekOrder[0]] || 0)) : 0 },
                  gasoline: { current: gasolineCurrent, previous: gasolinePrevious, delta: gasolineCurrent - gasolinePrevious }
                }
              }
            };

          } catch (error) {
            console.error('Error in getActiveLoansReport:', error);
            throw new Error(`Error generating active loans report: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
      }),

      getFinancialReport: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          routeIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.String))) }),
          year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
        },
        resolve: async (root, { routeIds, year }, context: Context) => {
          try {
            // Obtener información de las rutas
            const routes = await context.prisma.route.findMany({
              where: { id: { in: routeIds } }
            });

            if (routes.length === 0) {
              throw new Error('No se encontraron rutas');
            }

            if (routes.length !== routeIds.length) {
              throw new Error('Algunas rutas no fueron encontradas');
            }

            // Obtener todas las transacciones del año para las rutas seleccionadas
            const transactions = await context.prisma.transaction.findMany({
              where: {
                routeId: { in: routeIds },
                date: {
                  gte: new Date(`${year}-01-01`),
                  lte: new Date(`${year}-12-31`),
                },
              },
              select: {
                amount: true,
                type: true,
                date: true,
                expenseSource: true,
                incomeSource: true,
                loanPayment: true,
                returnToCapital: true,
                profitAmount: true,
                lead: {
                  select: {
                    id: true,
                    personalData: {
                      select: {
                        addresses: {
                          select: {
                            location: {
                              select: {
                                name: true
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

            // Obtener cuentas de gasolina
            const tokaAccount = await context.prisma.account.findFirst({
              where: {
                type: 'PREPAID_GAS'
              }
            });

            const cashAccount = await context.prisma.account.findFirst({
              where: {
                type: 'OFFICE_CASH_FUND'
              }
            });

            console.log(`⛽ getFinancialReport - Cuenta TOKA: ${tokaAccount?.id || 'No encontrada'}`);
            console.log(`💵 getFinancialReport - Cuenta Efectivo: ${cashAccount?.id || 'No encontrada'}`);
            
            // Debug: Buscar todas las cuentas para ver qué hay
            const allAccounts = await context.prisma.account.findMany({
              select: { id: true, name: true }
            });
            console.log(`🏦 getFinancialReport - Todas las cuentas:`, allAccounts);
            
            // Debug: Buscar todas las transacciones de gasolina sin filtros
            const allGasolinaTransactions = await context.prisma.transaction.findMany({
              where: {
                type: 'EXPENSE',
                expenseSource: 'GASOLINE'
              },
              select: {
                id: true,
                amount: true,
                sourceAccountId: true,
                expenseSource: true,
                date: true,
                routeId: true
              }
            });
            console.log(`⛽ getFinancialReport - Todas las transacciones de gasolina:`, allGasolinaTransactions);

            // Obtener TODOS los préstamos de las rutas seleccionadas (sin filtrar por signDate)
            const loans = await context.prisma.loan.findMany({
              where: {
                lead: {
                  routesId: { in: routeIds }
                }
              },
              include: {
                payments: true,
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
                }
              }
            });
            //filter loans by badDebtDate = to january 2025
            console.log('loans', loans.length);
            const loansWithBadDebtDate = loans.filter(loan => loan.badDebtDate);
            console.log('loansWithBadDebtDate', loansWithBadDebtDate.length);

            // Agrupar transacciones por mes
            const monthlyData = transactions.reduce((acc, transaction) => {
              const transactionDate = transaction.date ? new Date(transaction.date) : new Date();
              const month = transactionDate.getMonth() + 1; // 1-12
              const monthKey = month.toString().padStart(2, '0');

              if (!acc[monthKey]) {
                acc[monthKey] = {
                  totalExpenses: 0,      // Gastos operativos totales
                  generalExpenses: 0,    // Gastos generales (sin nómina/comisiones)
                  nomina: 0,             // Gastos de nómina
                  comissions: 0,         // Comisiones pagadas
                  incomes: 0,            // Ingresos por cobros (solo ganancia)
                  totalCash: 0,          // Flujo de efectivo total
                  loanDisbursements: 0,  // Préstamos otorgados (reinversión)
                  carteraActiva: 0,      // Créditos activos
                  carteraVencida: 0,     // Cartera vencida
                  renovados: 0,
                  badDebtAmount: 0,      // Suma de préstamos marcados como badDebtDate en el mes          // Créditos renovados
                  // Nuevos campos para flujo de efectivo
                  totalIncomingCash: 0,  // Total que entra por pagos (capital + ganancia)
                  capitalReturn: 0,      // Capital devuelto
                  profitReturn: 0,       // Ganancia de los pagos
                  operationalCashUsed: 0, // Dinero usado en operación
                  // Campos para ROI real
                  totalInvestment: 0,    // Inversión total (préstamos + gastos operativos)
                  // Campos para gasolina
                  tokaGasolina: 0,       // Gasolina de cuenta TOKA
                  cashGasolina: 0,       // Gasolina de cuenta efectivo (incluye OFFICE_CASH_FUND y EMPLOYEE_CASH_FUND)
                  totalGasolina: 0,      // Total de gasolina
                  operationalExpenses: 0, // Solo gastos operativos (sin préstamos)
                    availableCash: 0,      // Dinero disponible en cajas
                  // Travel expenses (cuenta TRAVEL_EXPENSES)
                  travelExpenses: 0,
                    // Métricas de pagos
                    paymentsCount: 0,
                    gainPerPayment: 0
                };
              }

              const amount = Number(transaction.amount || 0);
              const monthData = acc[monthKey];

              // Clasificar transacciones
              if (transaction.type === 'EXPENSE') {
                switch (transaction.expenseSource) {
                  case 'NOMINA_SALARY':
                  case 'EXTERNAL_SALARY':
                    monthData.nomina += amount;
                    monthData.operationalCashUsed += amount;
                    monthData.operationalExpenses += amount;
                    monthData.totalInvestment += amount;
                    break;
                  case 'TRAVEL_EXPENSES':
                    // Gastos de viaje asociados a la ruta (cuenta TRAVEL_EXPENSES)
                    monthData.travelExpenses += amount;
                    monthData.operationalCashUsed += amount;
                    monthData.operationalExpenses += amount;
                    monthData.totalInvestment += amount;
                    break;
                  case 'LOAN_PAYMENT_COMISSION':
                  case 'LOAN_GRANTED_COMISSION':
                  case 'LEAD_COMISSION':
                    monthData.comissions += amount;
                    monthData.operationalCashUsed += amount;
                    monthData.operationalExpenses += amount;
                    monthData.totalInvestment += amount;
                    break;
                  case 'LOAN_GRANTED':
                    monthData.loanDisbursements += amount;
                    monthData.operationalCashUsed += amount;
                    monthData.totalInvestment += amount; // Préstamos también son inversión
                    break;
                  default:
                    // Gastos operativos (viáticos, gasolina, mantenimiento, etc.)
                    monthData.generalExpenses += amount;
                    monthData.operationalCashUsed += amount;
                    monthData.operationalExpenses += amount;
                    monthData.totalInvestment += amount;
                    break;
                }
                
                // Todos los gastos suman al total
                monthData.totalExpenses += amount;
                monthData.totalCash -= amount;
              } else if (transaction.type === 'INCOME') {
                if (transaction.incomeSource === 'CASH_LOAN_PAYMENT' || 
                    transaction.incomeSource === 'BANK_LOAN_PAYMENT') {
                  // Total que entra por pagos
                  monthData.totalIncomingCash += amount;
                  
                  // Ganancia del pago
                  const profit = Number(transaction.profitAmount || 0);
                  monthData.profitReturn += profit;
                  monthData.incomes += profit;
                  
                  // Capital devuelto = total del pago - ganancia
                  const capitalReturned = amount - profit;
                  monthData.capitalReturn += capitalReturned;
                  
                  monthData.totalCash += amount; // El total incluye capital + ganancia
                  // Contador de pagos
                  monthData.paymentsCount += 1;
                } else {
                  // Otros ingresos
                  monthData.incomes += amount;
                  monthData.totalIncomingCash += amount;
                  monthData.profitReturn += amount; // Otros ingresos son 100% ganancia
                  monthData.totalCash += amount;
                }
              }

              return acc;
            }, {} as { [month: string]: any });

            // Calcular gasolina por mes
            if (tokaAccount || cashAccount) {
              for (let month = 1; month <= 12; month++) {
                const monthKey = month.toString().padStart(2, '0');
                const monthStart = new Date(year, month - 1, 1);
                const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

                                // Obtener transacciones de gasolina para este mes
                const gasolinaTransactions = await context.prisma.transaction.findMany({
                  where: {
                    routeId: { in: routeIds },
                    date: {
                      gte: monthStart,
                      lte: monthEnd,
                    },
                    OR: [
                      // Gasolina de cuenta TOKA
                      ...(tokaAccount ? [{
                        sourceAccountId: tokaAccount.id,
                        type: 'EXPENSE',
                        expenseSource: 'GASOLINE'
                      }] : []),
                      // Gasolina de cuentas de efectivo (OFFICE_CASH_FUND y EMPLOYEE_CASH_FUND)
                      {
                        type: 'EXPENSE',
                        expenseSource: 'GASOLINE',
                        sourceAccount: {
                          type: {
                            in: ['OFFICE_CASH_FUND', 'EMPLOYEE_CASH_FUND']
                          }
                        }
                      }
                    ]
                  }
                });

                console.log(`⛽ getFinancialReport - Mes ${monthKey}: Encontradas ${gasolinaTransactions.length} transacciones de gasolina`);
                if (gasolinaTransactions.length > 0) {
                  console.log(`⛽ getFinancialReport - Detalles de transacciones:`, gasolinaTransactions.map(t => ({
                    id: t.id,
                    amount: t.amount,
                    sourceAccountId: t.sourceAccountId,
                    expenseSource: t.expenseSource,
                    date: t.date
                  })));
                }

                let tokaGasolina = 0;
                let cashGasolina = 0;

                for (const transaction of gasolinaTransactions) {
                  const amount = Number(transaction.amount || 0);
                  
                  if (transaction.sourceAccountId === tokaAccount?.id) {
                    tokaGasolina += amount;
                  } else {
                    // Todo lo demás es efectivo (OFFICE_CASH_FUND y EMPLOYEE_CASH_FUND)
                    cashGasolina += amount;
                  }
                }

                if (monthlyData[monthKey]) {
                  monthlyData[monthKey].tokaGasolina = tokaGasolina;
                  monthlyData[monthKey].cashGasolina = cashGasolina;
                  monthlyData[monthKey].totalGasolina = tokaGasolina + cashGasolina;
                }

                console.log(`⛽ getFinancialReport - Mes ${monthKey}: TOKA=${tokaGasolina}, Efectivo=${cashGasolina}, Total=${tokaGasolina + cashGasolina}`);
              }
            }

            // Calcular métricas adicionales para cada mes
            Object.keys(monthlyData).forEach(monthKey => {
              const data = monthlyData[monthKey];
              
              // Gastos operativos = gastos generales + nómina + comisiones (no incluye préstamos)
              const operationalExpenses = data.generalExpenses + data.nomina + data.comissions;
              data.totalExpenses = operationalExpenses;
              
              // Ganancia operativa = (solo la ganancia de los cobros) - gastos operativos
              // Usamos profitReturn (ganancia de pagos + otros ingresos considerados 100% ganancia)
              data.balance = data.incomes - operationalExpenses; // referencia histórica
              data.operationalProfit = Number(data.profitReturn || 0) - operationalExpenses;
              
              // Porcentaje de ganancia operativa vs. ganancia generada
              data.profitPercentage = Number(data.profitReturn || 0) > 0
                ? ((data.operationalProfit / Number(data.profitReturn)) * 100)
                : 0;
              
              // Balance considerando reinversión
              data.balanceWithReinvest = data.balance - data.loanDisbursements;
              
              // Ganancia por pago recibido basada en ganancia operativa (evitar división por 0)
              const payments = Number(data.paymentsCount || 0);
              const operationalProfit = Number(data.operationalProfit || 0);
              data.gainPerPayment = payments > 0 ? operationalProfit / payments : 0;
            });

            // Calcular cartera activa y vencida por mes
            // También calcular dinero en caja acumulativo
            let cumulativeCashBalance = 0;
            
            for (let month = 1; month <= 12; month++) {
              const monthKey = month.toString().padStart(2, '0');
              const monthStart = new Date(year, month - 1, 1);
              const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
              console.log('monthStart', monthStart);
              console.log('monthEnd', monthEnd);
              
              if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                  totalExpenses: 0, generalExpenses: 0, nomina: 0, comissions: 0,
                  incomes: 0, totalCash: 0, loanDisbursements: 0, balance: 0,
                  profitPercentage: 0, balanceWithReinvest: 0, carteraActiva: 0,
                  carteraVencida: 0, carteraMuerta: 0, renovados: 0,
                  badDebtAmount: 0,      // Suma de préstamos marcados como badDebtDate en el mes
                  totalIncomingCash: 0, capitalReturn: 0, profitReturn: 0, 
                  operationalCashUsed: 0, totalInvestment: 0, operationalExpenses: 0, 
                  availableCash: 0,
                  // Campos para gasolina
                  tokaGasolina: 0, cashGasolina: 0, totalGasolina: 0
                };
              }

              // Calcular flujo de caja del mes
              const monthCashFlow = monthlyData[monthKey].totalCash || 0;
              cumulativeCashBalance += monthCashFlow;
              monthlyData[monthKey].availableCash = Math.max(0, cumulativeCashBalance);

              // Contar préstamos activos al final del mes
              let activeLoans = 0;
              let overdueLoans = 0;
              let deadLoans = 0;
              let renewedLoans = 0;

              loans.forEach(loan => {
                const signDate = new Date(loan.signDate);
                /*   if(loan.badDebtDate) {
                    console.log('badDebtDate', loan.badDebtDate);
                  } */
                
                // Solo procesar préstamos firmados hasta este mes
                if (signDate <= monthEnd) {
                  // Verificar si está activo al final del mes
                  const isActive = isLoanActiveOnDate(loan, monthEnd);
                  
                  if (isActive) {
                    activeLoans++;
                    
                    // Verificar si está vencido (sin pagos en el mes)
                    let hasPaymentInMonth = false;
                    for (const payment of loan.payments || []) {
                      const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                      if (paymentDate >= monthStart && paymentDate <= monthEnd) {
                        hasPaymentInMonth = true;
                        break;
                      }
                    }
                    
                    if (!hasPaymentInMonth && loan.badDebtDate && new Date(loan.badDebtDate) <= monthEnd) {
                      overdueLoans++;
                    }
                  }
                  
                  // Contar cartera muerta (préstamos con badDebtDate establecido al final del mes)
                  if (loan.badDebtDate && new Date(loan.badDebtDate) <= monthEnd) {
                    deadLoans++;
                  }
                  
                  // Contar renovados en el mes
                  if (loan.previousLoanId && signDate >= monthStart && signDate <= monthEnd) {
                    renewedLoans++;
                  }
                }
              });

              monthlyData[monthKey].carteraActiva = activeLoans;
              monthlyData[monthKey].carteraVencida = overdueLoans;
              monthlyData[monthKey].carteraMuerta = deadLoans;
              monthlyData[monthKey].renovados = renewedLoans;
              // Calcular suma de préstamos marcados como badDebtDate en este mes
              // (sin importar cuándo fueron creados originalmente)
              let badDebtAmount = 0;
              console.log(`🔍 getFinancialReport - Procesando mes ${monthKey}: monthStart=${monthStart.toISOString()}, monthEnd=${monthEnd.toISOString()}`);
              
              // Buscar SOLO los préstamos que fueron marcados como badDebtDate EN ESTE MES específico
              console.log(`🔍 getFinancialReport - Total de préstamos en la ruta: ${loans.length}`);
              console.log(`🔍 getFinancialReport - Buscando préstamos marcados como badDebtDate EN ${monthKey}:`);
              
              const badDebtLoans = loans.filter(loan => {
                if (!loan.badDebtDate) return false;
                
                const badDebtDate = new Date(loan.badDebtDate);
                console.log(`📅 getFinancialReport - Loan ${loan.id}: badDebtDate=${badDebtDate.toISOString()}, original=${loan.badDebtDate}`);
                
                // Comparar solo por fecha (sin hora) para evitar problemas de zona horaria
                const badDebtDateOnly = new Date(badDebtDate.getFullYear(), badDebtDate.getMonth(), badDebtDate.getDate());
                const monthStartOnly = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate());
                const monthEndOnly = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate());
                
                console.log(`🔍 getFinancialReport - Comparando fechas: badDebtDateOnly=${badDebtDateOnly.toISOString()}, monthStartOnly=${monthStartOnly.toISOString()}, monthEndOnly=${monthEndOnly.toISOString()}`);
                
                // SOLO incluir si fue marcado EN ESTE MES específico
                const isMarkedInThisMonth = badDebtDateOnly >= monthStartOnly && badDebtDateOnly <= monthEndOnly;
                
                if (isMarkedInThisMonth) {
                  console.log(`✅ getFinancialReport - Loan ${loan.id} marcado como bad debt EN ${monthKey}`);
                } else {
                  console.log(`❌ getFinancialReport - Loan ${loan.id} NO fue marcado en ${monthKey} (fue marcado en ${badDebtDateOnly.getMonth() + 1}/${badDebtDateOnly.getFullYear()})`);
                }
                
                return isMarkedInThisMonth;
              });
              
              console.log(`📊 getFinancialReport - Encontrados ${badDebtLoans.length} préstamos marcados como bad debt en mes ${monthKey}`);
              
              // Calcular la deuda pendiente para cada préstamo marcado como bad debt
              badDebtLoans.forEach(loan => {
                const badDebtDate = new Date(loan.badDebtDate!);
                
                // Calcular deuda pendiente: monto prestado + ganancia - total pagado
                const amountGived = Number(loan.amountGived || 0);
                const profitAmount = Number(loan.profitAmount || 0);
                const totalToPay = amountGived + profitAmount;
                
                // Calcular total pagado hasta la fecha de marcado como bad debt
                let totalPaid = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt || new Date());
                  if (paymentDate <= badDebtDate) {
                    totalPaid += Number(payment.amount || 0);
                  }
                }
                
                // La deuda pendiente es lo que falta por pagar
                const pendingDebt = totalToPay - totalPaid;
                console.log(`💰 getFinancialReport - Loan ${loan.id}: amountGived=${amountGived}, profitAmount=${profitAmount}, totalToPay=${totalToPay}, totalPaid=${totalPaid}, pendingDebt=${pendingDebt}`);
                
                badDebtAmount += Math.max(0, pendingDebt);
              });
              
              console.log(`�� getFinancialReport - Mes ${monthKey}: badDebtAmount total = ${badDebtAmount}`);
              monthlyData[monthKey].badDebtAmount = badDebtAmount;
              
              // Calcular cartera muerta para este mes
              let carteraMuertaTotal = 0;
              console.log(`💀 getFinancialReport - Calculando cartera muerta para mes ${monthKey}:`);
              
              // Buscar préstamos marcados como badDebtDate hasta el final de este mes
              deadLoans = loans.filter(loan => {
                if (!loan.badDebtDate) return false;
                const badDebtDate = new Date(loan.badDebtDate);
                return badDebtDate <= monthEnd;
              });
              
              console.log(`💀 getFinancialReport - Encontrados ${deadLoans.length} préstamos marcados como bad debt hasta ${monthKey}`);
              
              deadLoans.forEach(loan => {
                // Calcular deuda pendiente
                const amountGived = Number(loan.amountGived || 0);
                const profitAmount = Number(loan.profitAmount || 0);
                const totalToPay = amountGived + profitAmount;
                
                // Calcular total pagado hasta la fecha de marcado como bad debt
                let totalPaid = 0;
                let gananciaCobrada = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt || new Date());
                  if (paymentDate <= new Date(loan.badDebtDate!)) {
                    totalPaid += Number(payment.amount || 0);
                    // La ganancia cobrada se calcula del profitAmount del pago
                    gananciaCobrada += Number(payment.profitAmount || 0);
                  }
                }
                
                // Deuda pendiente
                const deudaPendiente = totalToPay - totalPaid;
                
                // Ganancia pendiente por cobrar
                const gananciaPendiente = profitAmount - gananciaCobrada;
                
                // Cartera muerta = Deuda pendiente - Ganancia pendiente por cobrar
                const carteraMuerta = deudaPendiente - gananciaPendiente;
                
                console.log(`💀 getFinancialReport - Loan ${loan.id}: amountGived=${amountGived}, profitAmount=${profitAmount}, totalToPay=${totalToPay}, totalPaid=${totalPaid}, gananciaCobrada=${gananciaCobrada}, deudaPendiente=${deudaPendiente}, gananciaPendiente=${gananciaPendiente}, carteraMuerta=${carteraMuerta}`);
                
                carteraMuertaTotal += Math.max(0, carteraMuerta);
              });
              
              console.log(`💀 getFinancialReport - Mes ${monthKey}: carteraMuertaTotal = ${carteraMuertaTotal}`);
              monthlyData[monthKey].carteraMuerta = carteraMuertaTotal;

              // Recalcular métricas dependientes incluyendo deuda mala como gasto operativo
              const opExpensesBase = (Number(monthlyData[monthKey].generalExpenses || 0) + Number(monthlyData[monthKey].nomina || 0) + Number(monthlyData[monthKey].comissions || 0));
              const uiExpensesTotal = opExpensesBase + Number(monthlyData[monthKey].badDebtAmount || 0) + Number(monthlyData[monthKey].travelExpenses || 0);
              const uiGainsTotal = Number(monthlyData[monthKey].incomes || 0);
              monthlyData[monthKey].uiExpensesTotal = uiExpensesTotal;
              monthlyData[monthKey].uiGainsTotal = uiGainsTotal;
              // Ganancia operativa final: total ganancias (UI) - total gastos (UI)
              monthlyData[monthKey].operationalProfit = uiGainsTotal - uiExpensesTotal;
              // % de ganancia operativa respecto a las ganancias totales de UI
              monthlyData[monthKey].profitPercentage = uiGainsTotal > 0 ? ((monthlyData[monthKey].operationalProfit / uiGainsTotal) * 100) : 0;
              // Ganancia por pago con nueva operativa
              const paymentsCnt = Number(monthlyData[monthKey].paymentsCount || 0);
              monthlyData[monthKey].gainPerPayment = paymentsCnt > 0 ? (monthlyData[monthKey].operationalProfit / paymentsCnt) : 0;
            }

            // Función helper para verificar si un préstamo está activo
            function isLoanActiveOnDate(loan: any, date: Date): boolean {
              const signDate = new Date(loan.signDate);
              
              // Debe estar firmado antes o en la fecha
              if (signDate > date) return false;
              
              // Si tiene finishedDate y es antes de la fecha, no está activo
              if (loan.finishedDate && new Date(loan.finishedDate) < date) return false;
              
              // Si tiene status RENOVATED y finishedDate antes de la fecha, no está activo
              if (loan.finishedDate && new Date(loan.finishedDate) < date) return false;
              
              // Verificar si está completamente pagado antes de la fecha
              const totalAmount = Number(loan.amountGived || 0);
              const profitAmount = Number(loan.profitAmount || 0);
              const totalToPay = totalAmount + profitAmount;
              
              let paidAmount = 0;
              for (const payment of loan.payments || []) {
                const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                if (paymentDate <= date) {
                  paidAmount += Number(payment.amount || 0);
                }
              }
              
              return paidAmount < totalToPay;
            }

            return {
              routes: routes.map(route => ({
                id: route.id,
                name: route.name
              })),
              year,
              months: [
                'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
              ],
              data: monthlyData
            };

          } catch (error) {
            console.error('Error in getFinancialReport:', error);
            throw new Error(`Error generating financial report: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
      }),
      // Query para obtener cartera por ruta
      getCartera: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          weeksWithoutPayment: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          includeBadDebt: graphql.arg({ type: graphql.nonNull(graphql.Boolean) }),
          analysisMonth: graphql.arg({ type: graphql.String }),
          analysisYear: graphql.arg({ type: graphql.Int }),
          includeOverdue: graphql.arg({ type: graphql.nonNull(graphql.Boolean) }),
          includeOverdrawn: graphql.arg({ type: graphql.nonNull(graphql.Boolean) }),
        },
        resolve: async (root, { routeId, weeksWithoutPayment, includeBadDebt, analysisMonth, analysisYear, includeOverdue, includeOverdrawn }, context: Context) => {
          try {
            console.log(`🔍 getCartera - Procesando ruta ${routeId} con ${weeksWithoutPayment} semanas sin pago`);

            // Obtener información de la ruta
            const route = await context.prisma.route.findUnique({
              where: { id: routeId }
            });

            if (!route) {
              throw new Error('Ruta no encontrada');
            }

            // Obtener TODOS los préstamos de las rutas seleccionadas (incluyendo info de limpieza de cartera)
            const loans = await (context.prisma as any).loan.findMany({
              where: {
                lead: {
                  routesId: { in: routeIds }
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
                lead: {
                  include: {
                    personalData: true
                  }
                },
                payments: {
                  orderBy: {
                    receivedAt: 'asc'
                  }
                },
                loantype: true,
                excludedByCleanup: true
              }
            });

            console.log(`📊 getCartera - Encontrados ${loans.length} préstamos en la ruta`);

            const today = new Date();
            const processedLoans = [];
            let activeLoans = 0;
            let overdueLoans = 0;
            let deadLoans = 0;

            for (const loan of loans) {
              // Calcular deuda total: amountGived * (1 + loanRate)
              const amountGived = Number(loan.amountGived || 0);
              const loanRate = Number(loan.loanRate || 0);
              const totalDebt = amountGived * (1 + loanRate);

              // Calcular total pagado
              let totalPaid = 0;
              let lastPaymentDate = null;
              
              for (const payment of loan.payments || []) {
                totalPaid += Number(payment.amount || 0);
                if (!lastPaymentDate || new Date(payment.receivedAt || payment.createdAt) > new Date(lastPaymentDate)) {
                  lastPaymentDate = payment.receivedAt || payment.createdAt;
                }
              }

              // Calcular deuda pendiente
              const pendingDebt = Math.max(0, totalDebt - totalPaid);

              // Determinar fecha de análisis (histórica o actual)
              let analysisDate = new Date();
              if (analysisMonth && analysisYear) {
                const month = parseInt(analysisMonth) - 1; // Mes en JS es 0-indexed
                const lastDay = new Date(analysisYear, month + 1, 0); // Último día del mes
                const dayOfWeek = lastDay.getDay();
                
                // Si es domingo (0), retroceder al sábado (6)
                // Si es sábado (6), mantener
                // Si es otro día, retroceder al sábado anterior
                if (dayOfWeek === 0) {
                  lastDay.setDate(lastDay.getDate() - 1);
                } else if (dayOfWeek !== 6) {
                  lastDay.setDate(lastDay.getDate() - (dayOfWeek + 1));
                }
                
                analysisDate = lastDay;
              }

              // Si el préstamo fue marcado como excluido por limpieza y la fecha de limpieza
              // es anterior o igual a la fecha de análisis, no lo incluimos en la cartera
              if (loan.excludedByCleanup?.cleanupDate) {
                const cleanupAt = new Date(loan.excludedByCleanup.cleanupDate as any);
                if (cleanupAt <= analysisDate) {
                  continue;
                }
              }

              // ✅ NUEVA LÓGICA: Calcular semanas sin pago automáticamente por ausencia de registros
              // Filtrar solo pagos tipo 'PAYMENT' (excluyendo FALCO y EXTRA_COLLECTION para el cálculo)
              const actualPayments = (loan.payments || []).filter(payment => 
                payment.type === 'PAYMENT' && Number(payment.amount || 0) > 0
              );
              
              const signDate = new Date(loan.signDate);
              const weeksWithoutPayment = calculateWeeksWithoutPayment(
                loan.id, 
                signDate, 
                analysisDate, 
                actualPayments
                // ✅ NUEVA FUNCIONALIDAD: Pasar renewedDate para calcular períodos solo hasta la renovación (descomentado después de migración)
                // loan.renewedDate
              );
              
              console.log(`📊 Préstamo ${loan.id}: ${weeksWithoutPayment} semanas sin pago (calculado por ausencia de registros)`);
              

              // Filtrar solo préstamos activos (no finalizados, renovados o cancelados)
              const isFinishedStatus = ['CANCELLED'].includes(loan.status);
              if (isFinishedStatus) {
                continue; // Saltar préstamos finalizados/renovados/cancelados
              }

              // Calcular si el préstamo está sobregirado (pasó de su plazo original)
              const originalWeeksDuration = (loan as any).loantype?.weekDuration || 14;
              const totalWeeksSinceSign = Math.floor((analysisDate.getTime() - new Date(loan.signDate).getTime()) / (1000 * 60 * 60 * 24 * 7));
              const isOverdue = totalWeeksSinceSign > originalWeeksDuration;

              // Determinar estado solo para préstamos activos
              let status = 'ACTIVE';
              if (loan.badDebtDate) {
                status = 'DEAD';
                deadLoans++;
              } else if (weeksWithoutPayment >= weeksWithoutPayment) {
                status = 'OVERDUE';
                overdueLoans++;
              } else {
                activeLoans++;
              }

              // Filtrar por badDebtDate según el parámetro includeBadDebt
              if (loan.badDebtDate && !includeBadDebt) {
                continue; // Saltar préstamos marcados como badDebtDate si no se incluyen
              }
              if (!loan.badDebtDate && includeBadDebt) {
                continue; // Saltar préstamos NO marcados como badDebtDate si solo se quieren los marcados
              }

              // Calcular si el préstamo está en sobregiro (pagó más de lo que debía)
              const isOverdrawn = totalPaid > totalDebt;

              // Filtrar por sobregirado si se solicita (DESPUÉS de verificar semanas sin pago)
              if (includeOverdue && !isOverdue) {
                continue; // Saltar préstamos que NO están sobregirados si solo se quieren los sobregirados
              }

              // Filtrar por sobregiro si se solicita
              if (includeOverdrawn && !isOverdrawn) {
                continue; // Saltar préstamos que NO están en sobregiro si solo se quieren los sobregirados
              }

              processedLoans.push({
                id: loan.id,
                amountGived,
                loanRate,
                signDate: loan.signDate,
                status: loan.status,
                badDebtDate: loan.badDebtDate,
                borrower: loan.borrower,
                lead: loan.lead,
                payments: loan.payments,
                totalPaid,
                totalDebt,
                pendingDebt,
                lastPaymentDate,
                weeksWithoutPayment,
                originalWeeksDuration,
                isOverdue,
                isOverdrawn
              });
            }

            // Calcular total de deuda pendiente
            const totalPendingDebt = processedLoans.reduce((total, loan) => total + loan.pendingDebt, 0);

            console.log(`📊 getCartera - Resumen: ${activeLoans} activos, ${overdueLoans} vencidos, ${deadLoans} muertos, deuda total: ${totalPendingDebt}`);

            return {
              route: {
                id: route.id,
                name: route.name
              },
              totalLoans: processedLoans.length,
              activeLoans,
              overdueLoans,
              deadLoans,
              totalPendingDebt,
              loans: processedLoans
            };

          } catch (error) {
            console.error('Error in getCartera:', error);
            throw new Error(`Error generating cartera report: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
      }),

      adjustAccountBalance: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          accountId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          targetAmount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
          counterAccountId: graphql.arg({ type: graphql.String }),
          description: graphql.arg({ type: graphql.String })
        },
        resolve: async (root, { accountId, targetAmount, counterAccountId, description }, context: Context) => {
          try {
            const account = await context.prisma.account.findUnique({
              where: { id: accountId },
              include: { route: true }
            });
            if (!account) {
              return { success: false, message: 'Cuenta no encontrada' } as any;
            }

            const current = Number(account.amount || 0);
            const deltaRaw = Number(targetAmount) - current;
            const delta = parseFloat(deltaRaw.toFixed(2));
            if (Math.abs(delta) < 0.01) {
              return { success: true, message: 'La cuenta ya tiene el balance deseado', delta: 0, transactionId: null, newAmount: current } as any;
            }

            let counter = counterAccountId || null;
            if (!counter) {
              // Buscar cuenta de respaldo en la misma ruta: OFFICE_CASH_FUND; si no, cualquier otra distinta
              const fallback = await context.prisma.account.findFirst({
                where: {
                  id: { not: account.id },
                  OR: [
                    { routeId: account.routeId || undefined },
                    { routeId: null }
                  ],
                  type: 'OFFICE_CASH_FUND'
                }
              });
              if (fallback) counter = fallback.id;
              if (!counter) {
                const anyOther = await context.prisma.account.findFirst({
                  where: { id: { not: account.id } },
                });
                if (anyOther) counter = anyOther.id;
              }
            }

            if (!counter) {
              return { success: false, message: 'No hay cuenta contraparte disponible para transferir fondos' } as any;
            }

            const amountStr = Math.abs(delta).toFixed(2);
            const isIncrease = delta > 0;

            // Crear transacción de transferencia usando API de listas para disparar hooks
            const tx = await (context as any).db.Transaction.createOne({
              data: {
                amount: amountStr,
                type: 'TRANSFER',
                description: description || `Ajuste de balance a ${targetAmount.toFixed ? targetAmount.toFixed(2) : targetAmount}`,
                route: account.routeId ? { connect: { id: account.routeId } } : undefined,
                sourceAccount: { connect: { id: isIncrease ? counter : account.id } },
                destinationAccount: { connect: { id: isIncrease ? account.id : counter } },
              }
            });

            // Leer monto actualizado
            const updated = await context.prisma.account.findUnique({ where: { id: account.id } });
            return { success: true, message: 'Ajuste realizado', transactionId: tx?.id || null, delta, newAmount: Number(updated?.amount || 0) } as any;
          } catch (err) {
            console.error('adjustAccountBalance error:', err);
            return { success: false, message: err instanceof Error ? err.message : 'Error desconocido' } as any;
          }
        }
      }),
      // Autocomplete para búsqueda de clientes
      searchClients: graphql.field({
        type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.JSON))),
        args: {
          searchTerm: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          routeId: graphql.arg({ type: graphql.String }),
          locationId: graphql.arg({ type: graphql.String }),
          limit: graphql.arg({ type: graphql.Int, defaultValue: 20 }),
        },
        resolve: async (root, { searchTerm, routeId, locationId, limit }, context: Context) => {
          try {
            console.log('🔍 Búsqueda de clientes:', { searchTerm, routeId, locationId, limit });
            
            const whereCondition: any = {
              OR: [
                {
                  fullName: {
                    contains: searchTerm,
                    mode: 'insensitive'
                  }
                }
              ]
            };

            console.log('📋 whereCondition inicial:', JSON.stringify(whereCondition, null, 2));

            // Aplicar filtros de ruta/localidad si se especifican
            if (locationId) {
              console.log('🔧 Aplicando filtro de localidad:', { locationId });
              whereCondition.addresses = {
                some: {
                  locationId: locationId
                }
              };
              console.log('📍 Filtro por locationId aplicado:', locationId);
            } else if (routeId) {
              // Como Location no tiene routeId directo, buscaremos a través de empleados
              // Por ahora, omitimos este filtro hasta implementar correctamente
              console.log('⚠️ Filtro por ruta temporalmente deshabilitado - buscando sin filtro de ruta');
            }

            console.log('📋 whereCondition final:', JSON.stringify(whereCondition, null, 2));

            // PRUEBA: Buscar sin filtros para verificar si hay datos
            const testSearch = await context.prisma.personalData.findMany({
              where: {
                fullName: {
                  contains: searchTerm,
                  mode: 'insensitive'
                }
              },
              take: 5,
              select: {
                id: true,
                fullName: true
              }
            });
            console.log('🧪 Prueba sin filtros - resultados:', testSearch);

            // 🔍 Buscar préstamos donde aparece como aval (usando collaterals)
            const loansAsCollateral = await context.prisma.loan.findMany({
              where: {
                collaterals: {
                  some: {
                    fullName: {
                      contains: searchTerm,
                      mode: 'insensitive'
                    }
                  }
                }
              },
              select: {
                id: true,
                signDate: true,
                finishedDate: true,
                amountGived: true,
                status: true,
                collaterals: {
                  select: {
                    id: true,
                    fullName: true,
                    phones: {
                      select: {
                        number: true
                      }
                    }
                  }
                },
                borrower: {
                  include: {
                    personalData: {
                      select: {
                        id: true,
                        fullName: true
                      }
                    }
                  }
                }
              }
            });

            console.log('🏦 Préstamos como aval encontrados:', loansAsCollateral?.length || 0);

            const clients = await context.prisma.personalData.findMany({
              where: whereCondition,
              take: limit,
              include: {
                phones: true,
                addresses: {
                  include: {
                    location: {
                      include: {
                        route: true
                      }
                    }
                  }
                },
                borrower: {
                  include: {
                    loans: {
                      select: {
                        id: true,
                        signDate: true,
                        finishedDate: true,
                        amountGived: true,
                        status: true
                      }
                    }
                  }
                }
              },
              orderBy: [
                { fullName: 'asc' }
              ]
            });

            // Validar que clients sea un array
            if (!Array.isArray(clients)) {
              console.error('❌ clients no es un array:', typeof clients, clients);
              return [];
            }

            console.log('✅ Clientes encontrados:', clients.length);

            // 🔗 Combinar resultados: clientes como deudores + como avalistas
            const combinedResults = new Map();

            // Agregar clientes que aparecen como deudores principales
            clients.forEach(client => {
              const loans = client.borrower?.loans || [];
              const activeLoans = loans.filter(loan => 
                !loan.finishedDate && loan.status !== 'FINISHED'
              );

              // Encontrar el préstamo más reciente como cliente
              const latestLoan = loans.length > 0 
                ? loans.reduce((latest, loan) => {
                    const loanDate = new Date(loan.signDate);
                    const latestDate = new Date(latest.signDate);
                    return loanDate > latestDate ? loan : latest;
                  })
                : null;
              
              const latestLoanDate = latestLoan 
                ? new Date(latestLoan.signDate).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })
                : null;

              // Extraer localidad
              const location = client.addresses[0]?.location?.name || 'Sin localidad';

              combinedResults.set(client.id, {
                id: client.id,
                name: client.fullName || 'Sin nombre',
                dui: 'N/A', // Campo no disponible en PersonalData
                phone: client.phones[0]?.number || 'N/A',
                address: client.addresses[0] ? `${client.addresses[0].location?.name || 'Sin localidad'}` : 'N/A',
                route: client.addresses[0]?.location?.route?.name || 'N/A',
                location: location,
                latestLoanDate: latestLoanDate,
                hasLoans: loans.length > 0,
                hasBeenCollateral: false, // Se actualizará si aparece como aval
                totalLoans: loans.length,
                activeLoans: activeLoans.length,
                finishedLoans: loans.length - activeLoans.length,
                collateralLoans: 0
              });
            });

            // Agregar información de avales a clientes existentes (sin crear duplicados)
            if (loansAsCollateral && Array.isArray(loansAsCollateral)) {
              loansAsCollateral.forEach(loan => {
                // Obtener información del aval desde collaterals
                const collateral = loan.collaterals?.[0]; // Tomar el primer aval
                if (!collateral) return;

                // Buscar si ya existe un cliente con el mismo personalData.id
                const avalPersonalData = clients.find(client => 
                  client.fullName && collateral.fullName && 
                  client.fullName.toLowerCase().trim() === collateral.fullName.toLowerCase().trim()
                );

                if (avalPersonalData) {
                  // El aval ya existe como cliente principal, actualizar información
                  const existingClient = combinedResults.get(avalPersonalData.id);
                  if (existingClient) {
                    existingClient.hasBeenCollateral = true;
                    existingClient.collateralLoans += 1;
                    
                    // Actualizar fecha del préstamo más reciente si este es más nuevo
                    const loanDate = new Date(loan.signDate);
                    const currentLatestDate = existingClient.latestLoanDate ? new Date(existingClient.latestLoanDate.split('/').reverse().join('-')) : new Date(0);
                    
                    if (loanDate > currentLatestDate) {
                      existingClient.latestLoanDate = loanDate.toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      });
                    }
                  }
                }
                // ELIMINADO: No crear entradas separadas para avales que no son clientes principales
                // Esto evita duplicados y mantiene solo un resultado por personalData
              });
            }

            // Ordenar por fecha del préstamo más reciente (descendente) y luego por nombre
            const sortedResults = Array.from(combinedResults.values()).sort((a, b) => {
              if (a.latestLoanDate && b.latestLoanDate) {
                const dateA = new Date(a.latestLoanDate.split('/').reverse().join('-'));
                const dateB = new Date(b.latestLoanDate.split('/').reverse().join('-'));
                if (dateA.getTime() !== dateB.getTime()) {
                  return dateB.getTime() - dateA.getTime(); // Más reciente primero
                }
              }
              return a.name.localeCompare(b.name); // Luego por nombre alfabético
            });

            return sortedResults.slice(0, limit);

          } catch (error) {
            console.error('❌ Error completo en searchClients:', error);
            console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack');
            console.error('❌ Mensaje:', error instanceof Error ? error.message : String(error));
            throw new Error(`Error al buscar clientes: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }),
      getClientHistory: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          clientId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          routeId: graphql.arg({ type: graphql.String }),
          locationId: graphql.arg({ type: graphql.String }),
        },
        resolve: async (root, { clientId, routeId, locationId }, context: Context) => {
          try {
            // Obtener datos del cliente
            const client = await context.prisma.personalData.findUnique({
              where: { id: clientId },
              include: {
                phones: true,
                addresses: {
                  include: {
                    location: {
                      include: {
                        route: true
                      }
                    }
                  }
                },
                // Préstamos como cliente principal (a través de Borrower)
                borrower: {
                  include: {
                    loans: {
                      include: {
                        loantype: true,
                        lead: {
                          include: {
                            personalData: true,
                            routes: true
                          }
                        },
                        payments: {
                          orderBy: { receivedAt: 'asc' },
                          include: {
                            transactions: true
                          }
                        },
                        transactions: {
                          where: {
                            type: { in: ['EXPENSE', 'INCOME'] }
                          }
                        }
                      },
                      orderBy: { signDate: 'desc' }
                    }
                  }
                }
              }
            });

            if (!client) {
              throw new Error('Cliente no encontrado');
            }

            // Obtener préstamos como cliente (a través de borrower)
            const clientLoans = client.borrower?.loans || [];
            
            // Buscar préstamos como aval usando collaterals
            const collateralLoans = await context.prisma.loan.findMany({
              where: {
                collaterals: {
                  some: {
                    fullName: {
                      contains: client.fullName,
                      mode: 'insensitive'
                    }
                  }
                }
              },
              include: {
                loantype: true,
                lead: {
                  include: {
                    personalData: true,
                    routes: true
                  }
                },
                payments: {
                  orderBy: { receivedAt: 'asc' },
                  include: {
                    transactions: true
                  }
                },
                transactions: {
                  where: {
                    type: { in: ['EXPENSE', 'INCOME'] }
                  }
                },
                borrower: {
                  include: {
                    personalData: true
                  }
                },
                collaterals: {
                  include: {
                    phones: true,
                    addresses: {
                      include: {
                        location: true
                      }
                    }
                  }
                }
              },
              orderBy: { signDate: 'desc' }
            });

            // Filtrar por ruta/localidad si se especifica
            let filteredLoansAsClient = clientLoans;
            let filteredLoansAsCollateral = collateralLoans;

            if (routeId || locationId) {
              filteredLoansAsClient = clientLoans.filter(loan => {
                if (routeId && loan.lead?.routes?.id !== routeId) return false;
                if (locationId) {
                  const loanLocation = client.addresses.find(addr => addr.location?.id === locationId);
                  if (!loanLocation) return false;
                }
                return true;
              });

              filteredLoansAsCollateral = collateralLoans.filter(loan => {
                if (routeId && loan.lead?.routes?.id !== routeId) return false;
                return true; // Por ahora no filtramos por localidad para préstamos como aval
              });
            }

            // Función para calcular estadísticas de un préstamo
            const calculateLoanStats = (loan: any) => {
              const amountGiven = parseFloat(loan.amountGived?.toString() || '0');
              const amountRequested = parseFloat(loan.requestedAmount?.toString() || '0');
              const commission = parseFloat(loan.comissionAmount?.toString() || '0');
              const interestRate = parseFloat(loan.loantype?.rate?.toString() || '0');
              
              // Calcular el monto total a pagar (capital + intereses)
              // Nota: interestRate ya viene en formato decimal (0.4 = 40%)
              const totalAmountDue = amountRequested + (amountRequested * interestRate);
              
              // Procesar pagos con balance acumulativo y fechas formateadas
              let runningBalance = totalAmountDue;
              const detailedPayments = loan.payments
                .sort((a: any, b: any) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
                .map((payment: any, index: number) => {
                  const paymentAmount = parseFloat(payment.amount?.toString() || '0');
                  const balanceBeforePayment = runningBalance;
                  runningBalance -= paymentAmount;
                  
                  return {
                    id: payment.id,
                    amount: paymentAmount,
                    receivedAt: payment.receivedAt,
                    receivedAtFormatted: new Date(payment.receivedAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    }),
                    type: payment.type || 'PAGO',
                    paymentMethod: payment.paymentMethod || 'EFECTIVO',
                    paymentNumber: index + 1,
                    balanceBeforePayment: Math.max(0, balanceBeforePayment),
                    balanceAfterPayment: Math.max(0, runningBalance)
                  };
                });

              const totalPaid = detailedPayments.reduce((sum, payment) => sum + payment.amount, 0);
              const pendingDebt = Math.max(0, totalAmountDue - totalPaid);
              const isPaidOff = pendingDebt <= 0.01; // Tolerancia para errores de redondeo

              // ✅ CALCULAR PERÍODOS SIN PAGO para el historial
              const noPaymentPeriods = (() => {
                const periods: any[] = [];
                const start = new Date(loan.signDate);
                // ✅ NUEVA FUNCIONALIDAD: Si el préstamo fue renovado, usar renewedDate como fecha límite (descomentado después de migración)
                const end = loan.finishedDate ? new Date(loan.finishedDate) : new Date();
                // const end = loan.renewedDate ? 
                //   new Date(loan.renewedDate) : 
                //   (loan.finishedDate ? new Date(loan.finishedDate) : new Date());
                
                // Obtener fechas de pago tipo 'PAYMENT' con monto > 0
                const paymentDates = detailedPayments
                  .filter(payment => payment.type === 'PAYMENT' && payment.amount > 0)
                  .map(payment => new Date(payment.receivedAt))
                  .sort((a, b) => a.getTime() - b.getTime());
                
                // Función para obtener el lunes de la semana
                const getMondayOfWeek = (date: Date): Date => {
                  const monday = new Date(date);
                  const dayOfWeek = monday.getDay();
                  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                  monday.setDate(monday.getDate() + diff);
                  return monday;
                };
                
                // Función para obtener el domingo de la semana
                const getSundayOfWeek = (date: Date): Date => {
                  const sunday = new Date(date);
                  const dayOfWeek = sunday.getDay();
                  const diff = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                  sunday.setDate(sunday.getDate() + diff);
                  return sunday;
                };
                
                // Generar todas las semanas desde la segunda semana después de la firma
                const weeks: { monday: Date, sunday: Date }[] = [];
                let currentMonday = getMondayOfWeek(start);
                currentMonday.setDate(currentMonday.getDate() + 7); // Primera semana no se espera pago
                
                while (currentMonday <= end) {
                  const sunday = getSundayOfWeek(currentMonday);
                  weeks.push({ 
                    monday: new Date(currentMonday), 
                    sunday: new Date(sunday) 
                  });
                  currentMonday.setDate(currentMonday.getDate() + 7);
                }
                
                // Encontrar semanas sin pago
                const weeksWithoutPayment: { monday: Date, sunday: Date }[] = [];
                for (const week of weeks) {
                  const hasPaymentInWeek = paymentDates.some(paymentDate => 
                    paymentDate >= week.monday && paymentDate <= week.sunday
                  );
                  if (!hasPaymentInWeek) {
                    weeksWithoutPayment.push(week);
                  }
                }
                
                // Agrupar semanas consecutivas
                if (weeksWithoutPayment.length > 0) {
                  let periodStart = weeksWithoutPayment[0];
                  let periodEnd = weeksWithoutPayment[0];
                  let weekCount = 1;
                  
                  for (let i = 1; i < weeksWithoutPayment.length; i++) {
                    const currentWeek = weeksWithoutPayment[i];
                    const previousWeek = weeksWithoutPayment[i - 1];
                    const daysBetween = (currentWeek.monday.getTime() - previousWeek.monday.getTime()) / (1000 * 60 * 60 * 24);
                    
                    if (daysBetween === 7) {
                      periodEnd = currentWeek;
                      weekCount++;
                    } else {
                      periods.push({
                        id: `no-payment-${periodStart.monday.getTime()}`,
                        startDate: periodStart.monday.toISOString(),
                        endDate: periodEnd.sunday.toISOString(),
                        startDateFormatted: periodStart.monday.toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        }),
                        endDateFormatted: periodEnd.sunday.toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        }),
                        weekCount,
                        type: 'NO_PAYMENT_PERIOD'
                      });
                      
                      periodStart = currentWeek;
                      periodEnd = currentWeek;
                      weekCount = 1;
                    }
                  }
                  
                  // Agregar último período
                  periods.push({
                    id: `no-payment-${periodStart.monday.getTime()}`,
                    startDate: periodStart.monday.toISOString(),
                    endDate: periodEnd.sunday.toISOString(),
                    startDateFormatted: periodStart.monday.toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    }),
                    endDateFormatted: periodEnd.sunday.toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    }),
                    weekCount,
                    type: 'NO_PAYMENT_PERIOD'
                  });
                }
                
                return periods;
              })();
              
              // Calcular días desde la firma
              const signDate = new Date(loan.signDate);
              const today = new Date();
              const daysSinceSign = Math.floor((today.getTime() - signDate.getTime()) / (1000 * 60 * 60 * 24));
              
              // Determinar estado más detallado
              let loanStatus = 'ACTIVO';
              let statusDescription = 'Préstamo en curso, pendiente de pagos';
              
              // Verificar si fue renovado (hay otro préstamo que tiene este como previousLoanId)
              const wasRenewed = filteredLoansAsClient.some((l: any) => l.previousLoanId === loan.id);
              
              if (loan.finishedDate) {
                if (wasRenewed) {
                  loanStatus = 'RENOVADO';
                  statusDescription = 'Reemplazado por un nuevo préstamo (renovación)';
                } else {
                  loanStatus = 'TERMINADO';
                  statusDescription = 'Pagado completamente y finalizado';
                }
              } else if (isPaidOff) {
                loanStatus = 'PAGADO';
                statusDescription = 'Monto completo pagado, pendiente de marcar como finalizado';
              } else if (loan.badDebtDate && new Date(loan.badDebtDate) <= today) {
                loanStatus = 'CARTERA MUERTA';
                statusDescription = 'Marcado como cartera muerta - irrecuperable';
              } else {
                // Verificar si está dentro del plazo esperado
                const expectedWeeks = parseInt(loan.loantype?.weekDuration || '12');
                const expectedEndDate = new Date(signDate);
                expectedEndDate.setDate(expectedEndDate.getDate() + (expectedWeeks * 7));
                
                if (today > expectedEndDate) {
                  loanStatus = 'VENCIDO';
                  statusDescription = `Fuera del plazo esperado (${expectedWeeks} semanas)`;
                } else {
                  const daysLeft = Math.ceil((expectedEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  statusDescription = `Préstamo activo - ${daysLeft} días restantes del plazo`;
                }
              }

              return {
                id: loan.id,
                signDate: loan.signDate,
                signDateFormatted: signDate.toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                finishedDate: loan.finishedDate,
                finishedDateFormatted: loan.finishedDate ? 
                  new Date(loan.finishedDate).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : null,
                loanType: loan.loantype?.name || 'N/A',
                amountRequested,
                totalAmountDue,
                interestAmount: totalAmountDue - amountRequested,
                commission,
                totalPaid,
                pendingDebt,
                daysSinceSign,
                status: loanStatus,
                statusDescription,
                wasRenewed,
                weekDuration: loan.loantype?.weekDuration || 0,
                rate: loan.loantype?.rate || 0,
                leadName: loan.lead?.personalData?.fullName || 'N/A',
                routeName: loan.lead?.routes?.name || 'N/A',
                paymentsCount: detailedPayments.length,
                payments: detailedPayments,
                noPaymentPeriods: noPaymentPeriods,
                renewedFrom: loan.previousLoanId,
                renewedTo: null, // Se calculará después
                avalName: loan.avalName || null,
                avalPhone: loan.avalPhone || null
              };
            };

            // Procesar préstamos como cliente
            const loansAsClient = filteredLoansAsClient.map(calculateLoanStats);

            // Calcular relaciones renewedTo después de procesar todos los préstamos
            loansAsClient.forEach(loan => {
              const renewedLoan = loansAsClient.find(l => l.renewedFrom === loan.id);
              if (renewedLoan) {
                loan.renewedTo = renewedLoan.id;
              }
            });

            // Procesar préstamos como aval
            const loansAsCollateral = filteredLoansAsCollateral.map((loan: any) => ({
              ...calculateLoanStats(loan),
              clientName: loan.borrower?.personalData?.fullName || 'Sin nombre',
              clientDui: 'N/A' // Campo no disponible en PersonalData
            }));

            // Calcular estadísticas generales
            const totalLoansAsClient = loansAsClient.length;
            const totalLoansAsCollateral = loansAsCollateral.length;
            const activeLoansAsClient = loansAsClient.filter(loan => loan.status === 'ACTIVO').length;
            const activeLoansAsCollateral = loansAsCollateral.filter(loan => loan.status === 'ACTIVO').length;
            
            const totalAmountRequestedAsClient = loansAsClient.reduce((sum, loan) => sum + loan.amountRequested, 0);
            const totalAmountPaidAsClient = loansAsClient.reduce((sum, loan) => sum + loan.totalPaid, 0);
            const currentPendingDebtAsClient = loansAsClient.reduce((sum, loan) => sum + (loan.status === 'ACTIVO' ? loan.pendingDebt : 0), 0);

            return {
              client: {
                id: client.id,
                fullName: client.fullName,
                dui: 'N/A', // Campo no disponible en PersonalData
                phones: client.phones.map((phone: any) => phone.number),
                addresses: client.addresses.map((address: any) => ({
                  street: address.street,
                  city: address.city,
                  location: address.location?.name,
                  route: address.location?.route?.name
                }))
              },
              summary: {
                totalLoansAsClient,
                totalLoansAsCollateral,
                activeLoansAsClient,
                activeLoansAsCollateral,
                totalAmountRequestedAsClient,
                totalAmountPaidAsClient,
                currentPendingDebtAsClient,
                hasBeenClient: totalLoansAsClient > 0,
                hasBeenCollateral: totalLoansAsCollateral > 0
              },
              loansAsClient,
              loansAsCollateral
            };

          } catch (error) {
            console.error('Error en getClientHistory:', error);
            throw new Error(`Error al obtener historial del cliente: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }),

      // Query para obtener registros de limpieza de cartera
      getPortfolioCleanups: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          month: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
        },
        resolve: async (root, { routeId, year, month }, context: Context) => {
          try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
 
            const cleanups = await (context.prisma as any).portfolioCleanup.findMany({
              where: {
                routeId: routeId,
                cleanupDate: {
                  gte: monthStart,
                  lte: monthEnd
                }
              },
              include: {
                route: true,
                executedBy: true
              },
              orderBy: {
                cleanupDate: 'desc'
              }
            });
 
            return {
              cleanups: cleanups.map((cleanup: any) => ({
                id: cleanup.id,
                name: cleanup.name,
                description: cleanup.description,
                cleanupDate: cleanup.cleanupDate,
                fromDate: cleanup.fromDate,
                toDate: cleanup.toDate,
                routeName: cleanup.route?.name,
                executedByName: cleanup.executedBy?.name
              }))
            };
 
          } catch (error) {
            console.error('Error en getPortfolioCleanups:', error);
            throw new Error(`Error al obtener registros de limpieza de cartera: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }),

      previewBulkPortfolioCleanup: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          fromDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          toDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          weeksWithoutPaymentThreshold: graphql.arg({ type: graphql.Int })
        },
        resolve: async (root, { routeId, fromDate, toDate, weeksWithoutPaymentThreshold = 0 }, context: Context) => {
          try {
            const start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
 
            const candidateLoans = await (context.prisma as any).loan.findMany({
              where: {
                lead: { routes: { id: routeId } },
                signDate: { gte: start, lte: end },
                excludedByCleanup: { is: null },
                finishedDate: null,
                status: 'ACTIVE'
              },
              include: {
                borrower: { include: { personalData: true } },
                lead: { 
                  include: { 
                    personalData: { 
                      include: { 
                        addresses: { include: { location: true } }
                      }
                    }
                  }
                },
                payments: { orderBy: { receivedAt: 'asc' } }
              }
            });
 
            const applyCV = typeof weeksWithoutPaymentThreshold === 'number' && weeksWithoutPaymentThreshold > 0;
            const filtered = applyCV
              ? candidateLoans.filter((loan: any) => {
                  const lastPaymentDate = loan.payments?.length > 0
                    ? new Date(loan.payments[loan.payments.length - 1].receivedAt)
                    : new Date(loan.signDate);
                  const diffMs = Date.now() - lastPaymentDate.getTime();
                  const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
                  return weeks >= weeksWithoutPaymentThreshold;
                })
              : candidateLoans;
 
            const count = filtered.length;
            const totalAmount = filtered.reduce((sum: number, loan: any) => sum + Number(loan.amountGived || 0), 0);
 
            return {
              success: true,
              count,
              totalAmount,
              loans: filtered.map((loan: any) => ({
                id: loan.id,
                clientName: loan.borrower?.personalData?.fullName || 'N/A',
                leaderName: loan.lead?.personalData?.fullName || 'N/A',
                leaderLocality: loan.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad',
                amountGived: Number(loan.amountGived || 0),
                signDate: loan.signDate,
              }))
            };
          } catch (error) {
            console.error('Error en previewBulkPortfolioCleanup:', error);
            return { success: false, count: 0, totalAmount: 0, loans: [], message: 'Error al previsualizar limpieza' };
          }
        }
      }),
    },
  };
});