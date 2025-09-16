import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';
import { Decimal } from '@prisma/client/runtime/library';
import { telegramGraphQLExtensions, telegramResolvers } from './telegramExtensions';
import { calculatePaymentProfitAmount } from '../utils/loanPayment';

// Import fetch for Telegram API calls
const fetch = require('node-fetch');

// Helper function to safely convert Decimal or any value to number
function safeToNumber(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }
  
  // Si es un objeto Decimal de Prisma
  if (typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber();
  }
  
  // Si es un string, convertir a número
  if (typeof value === 'string') {
    return parseFloat(value) || 0;
  }
  
  // Si es un número, devolverlo directamente
  if (typeof value === 'number') {
    return value;
  }
  
  // Fallback: intentar convertir a string y luego a número
  try {
    return parseFloat(String(value)) || 0;
  } catch {
    return 0;
  }
}

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
      resolve: (item) => item?.id || 'temp-id'
    }),
    amount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => item?.amount || 0
    }),
    comission: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => item?.comission || 0
    }),
    loanId: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (item) => item?.loanId || ''
    }),
    type: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (item) => item?.type || 'PAYMENT'
    }),
    paymentMethod: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (item) => item?.paymentMethod || 'CASH'
    }),
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
    id: graphql.field({ 
      type: graphql.nonNull(graphql.ID),
      resolve: (item) => item?.id || 'temp-id'
    }),
    expectedAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => safeToNumber(item?.expectedAmount)
    }),
    paidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => safeToNumber(item?.paidAmount)
    }),
    cashPaidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => safeToNumber(item?.cashPaidAmount)
    }),
    bankPaidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => safeToNumber(item?.bankPaidAmount)
    }),
    falcoAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => safeToNumber(item?.falcoAmount)
    }),
    paymentStatus: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (item) => item?.paymentStatus || 'FALCO'
    }),
    agentId: graphql.field({ 
      type: graphql.nonNull(graphql.ID),
      resolve: (item) => item?.agentId || 'temp-agent-id'
    }),
    leadId: graphql.field({ 
      type: graphql.nonNull(graphql.ID),
      resolve: (item) => item?.leadId || 'temp-lead-id'
    }),
    paymentDate: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (item) => item?.paymentDate || new Date().toISOString()
    }),
    payments: graphql.field({ 
      type: graphql.nonNull(graphql.list(graphql.nonNull(PaymentType))),
      resolve: (item) => item?.payments || []
    }),
  },
});

// ✅ FUNCIÓN UTILITARIA GLOBAL: Calcular semanas sin pago automáticamente
// ✅ FUNCIÓN HELPER PARA VERIFICAR SI UN PRÉSTAMO ESTÁ ACTIVO EN UNA FECHA
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

// Birthday-related types
const LeaderBirthdayType = graphql.object<any>()({
  name: 'LeaderBirthday',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    fullName: graphql.field({ type: graphql.nonNull(graphql.String) }),
    birthDate: graphql.field({ 
      type: graphql.String,
      resolve: (item) => item.birthDate ? item.birthDate.toISOString() : null
    }),
    day: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    route: graphql.field({
      type: graphql.object<any>()({
        name: 'RouteInfo',
        fields: {
          id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
          name: graphql.field({ type: graphql.nonNull(graphql.String) })
        }
      }),
      resolve: (item) => item.route || null
    }),
    location: graphql.field({
      type: graphql.object<any>()({
        name: 'LocationInfo', 
        fields: {
          id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
          name: graphql.field({ type: graphql.nonNull(graphql.String) })
        }
      }),
      resolve: (item) => item.location || null
    })
  }
});

export const extendGraphqlSchema = graphql.extend(base => {
  return {
    mutation: {
      moveLoansToDate: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          leadId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
          fromDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          toDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        resolve: async (root, { leadId, fromDate, toDate }, context: Context) => {
          try {
            // Usar transacción para garantizar atomicidad
            return await context.prisma.$transaction(async (tx) => {
              // Convertir fechas para comparación
              const from = new Date(fromDate);
              from.setHours(0, 0, 0, 0);
              const fromEnd = new Date(fromDate);
              fromEnd.setHours(23, 59, 59, 999);
              
              const to = new Date(toDate);
              to.setHours(12, 0, 0, 0); // Mediodía para evitar problemas de zona horaria
              
              // 1. Buscar todos los préstamos del líder en la fecha origen
              const loans = await tx.loan.findMany({
                where: {
                  leadId: leadId,
                  signDate: {
                    gte: from,
                    lte: fromEnd
                  }
                },
                include: {
                  transactions: true
                }
              });
              
              if (loans.length === 0) {
                return {
                  success: false,
                  message: 'No se encontraron préstamos en la fecha origen',
                  count: 0
                };
              }
              
              console.log(`📦 Moviendo ${loans.length} préstamos del ${from.toISOString()} al ${to.toISOString()}`);
              
              // 2. Actualizar fecha de firma de todos los préstamos
              await tx.loan.updateMany({
                where: {
                  id: { in: loans.map(loan => loan.id) }
                },
                data: { signDate: to }
              });
              
              // 3. Actualizar todas las transacciones asociadas a estos préstamos
              // Esto incluye LOAN_GRANTED y LOAN_GRANTED_COMISSION
              const loanIds = loans.map(loan => loan.id);
              const transactionUpdateResult = await tx.transaction.updateMany({
                where: {
                  loanId: { in: loanIds },
                  date: {
                    gte: from,
                    lte: fromEnd
                  }
                },
                data: { date: to }
              });
              
              console.log(`📊 Actualizadas ${transactionUpdateResult.count} transacciones asociadas a préstamos`);
              
              // 4. Actualizar transacciones de comisiones del líder en esa fecha
              // (que no estén asociadas directamente a un préstamo específico)
              const leadCommissionResult = await tx.transaction.updateMany({
                where: {
                  leadId: leadId,
                  date: {
                    gte: from,
                    lte: fromEnd
                  },
                  expenseSource: 'LEAD_COMISSION',
                  loanId: null // Solo comisiones generales, no las asociadas a préstamos específicos
                },
                data: { date: to }
              });
              
              console.log(`💰 Actualizadas ${leadCommissionResult.count} comisiones del líder`);
              
              return {
                success: true,
                message: `${loans.length} préstamo(s) y sus transacciones asociadas movidos exitosamente`,
                count: loans.length,
                transactionsUpdated: transactionUpdateResult.count + leadCommissionResult.count,
                fromDate: from.toISOString(),
                toDate: to.toISOString()
              };
            });
            
          } catch (error) {
            console.error('Error en moveLoansToDate:', error);
            return {
              success: false,
              message: `Error al mover préstamos: ${error instanceof Error ? error.message : 'Unknown error'}`,
              count: 0
            };
          }
        }
      }),
      
      movePaymentsToDate: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          leadId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
          fromDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          toDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        resolve: async (root, { leadId, fromDate, toDate }, context: Context) => {
          try {
            return await context.prisma.$transaction(async (tx) => {
              const from = new Date(fromDate);
              from.setHours(0, 0, 0, 0);
              const fromEnd = new Date(fromDate);
              fromEnd.setHours(23, 59, 59, 999);
              
              const to = new Date(toDate);
              to.setHours(12, 0, 0, 0);
              
              // 1. Buscar todos los LeadPaymentReceived del líder en la fecha origen
              const leadPaymentReceiveds = await tx.leadPaymentReceived.findMany({
                where: {
                  leadId: leadId,
                  createdAt: {
                    gte: from,
                    lte: fromEnd
                  }
                },
                include: {
                  payments: {
                    include: {
                      transactions: true
                    }
                  }
                }
              });
              
              if (leadPaymentReceiveds.length === 0) {
                return {
                  success: false,
                  message: 'No se encontraron pagos en la fecha origen',
                  count: 0
                };
              }
              
              console.log(`📦 Moviendo ${leadPaymentReceiveds.length} LeadPaymentReceived del ${from.toISOString()} al ${to.toISOString()}`);
              
              // 2. Contar total de pagos individuales y transacciones
              let totalPayments = 0;
              let totalTransactions = 0;
              const loanPaymentIds: string[] = [];
              
              for (const lpr of leadPaymentReceiveds) {
                totalPayments += lpr.payments.length;
                for (const payment of lpr.payments) {
                  loanPaymentIds.push(payment.id);
                  totalTransactions += payment.transactions?.length || 0;
                }
              }
              
              // 3. Actualizar LeadPaymentReceived
              await tx.leadPaymentReceived.updateMany({
                where: {
                  id: { in: leadPaymentReceiveds.map(lpr => lpr.id) }
                },
                data: { createdAt: to }
              });
              
              // 4. Actualizar LoanPayment (receivedAt)
              await tx.loanPayment.updateMany({
                where: {
                  id: { in: loanPaymentIds }
                },
                data: { receivedAt: to }
              });
              
              // 5. Actualizar todas las transacciones asociadas a estos pagos
              // Esto incluye tanto INCOME (CASH_LOAN_PAYMENT, BANK_LOAN_PAYMENT) 
              // como EXPENSE (LOAN_PAYMENT_COMISSION) y TRANSFER (transferencias)
              const transactionResult = await tx.transaction.updateMany({
                where: {
                  OR: [
                    // Transacciones directamente asociadas a los pagos
                    {
                      loanPaymentId: { in: loanPaymentIds }
                    },
                    // Transacciones de ingresos/comisiones del líder en esa fecha
                    {
                      leadId: leadId,
                      date: {
                        gte: from,
                        lte: fromEnd
                      },
                      OR: [
                        { incomeSource: 'CASH_LOAN_PAYMENT' },
                        { incomeSource: 'BANK_LOAN_PAYMENT' },
                        { expenseSource: 'LOAN_PAYMENT_COMISSION' },
                        // CORREGIDO: Incluir transferencias del líder en esa fecha
                        { type: 'TRANSFER' }
                      ]
                    }
                  ]
                },
                data: { date: to }
              });
              
              console.log(`📊 Actualizadas ${transactionResult.count} transacciones asociadas a pagos`);
              
              return {
                success: true,
                message: `${totalPayments} pago(s) y sus transacciones asociadas movidos exitosamente`,
                count: totalPayments,
                leadPaymentReceivedCount: leadPaymentReceiveds.length,
                transactionsUpdated: transactionResult.count,
                fromDate: from.toISOString(),
                toDate: to.toISOString()
              };
            });
            
          } catch (error) {
            console.error('Error en movePaymentsToDate:', error);
            return {
              success: false,
              message: `Error al mover pagos: ${error instanceof Error ? error.message : 'Unknown error'}`,
              count: 0
            };
          }
        }
      }),
      
      moveExpensesToDate: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          leadId: graphql.arg({ type: graphql.ID }),
          routeId: graphql.arg({ type: graphql.ID }),
          fromDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          toDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
        },
        resolve: async (root, { leadId, routeId, fromDate, toDate }, context: Context) => {
          try {
            return await context.prisma.$transaction(async (tx) => {
              const from = new Date(fromDate);
              from.setHours(0, 0, 0, 0);
              const fromEnd = new Date(fromDate);
              fromEnd.setHours(23, 59, 59, 999);
              
              const to = new Date(toDate);
              to.setHours(12, 0, 0, 0);
              
              // Construir el where según los parámetros recibidos
              const whereCondition: any = {
                type: 'EXPENSE',
                date: {
                  gte: from,
                  lte: fromEnd
                },
                // IMPORTANTE: Usar exactamente el mismo filtro que la UI de gastos
                // Solo excluir las transacciones de comisiones que se mueven automáticamente
                NOT: {
                  OR: [
                    { expenseSource: 'LOAN_PAYMENT_COMISSION' },
                    { expenseSource: 'LOAN_GRANTED_COMISSION' },
                    { expenseSource: 'LEAD_COMISSION' }
                  ]
                }
              };
              
              // Aplicar filtro por líder o ruta
              if (leadId) {
                whereCondition.leadId = leadId;
              } else if (routeId) {
                whereCondition.routeId = routeId;
              } else {
                return {
                  success: false,
                  message: 'Debe especificar un líder o una ruta',
                  count: 0
                };
              }
              
              console.log(`🔍 Buscando gastos con condiciones:`, JSON.stringify(whereCondition, null, 2));
              
              // Buscar todos los gastos operativos (no relacionados con préstamos/pagos)
              const expenses = await tx.transaction.findMany({
                where: whereCondition
              });
              
              if (expenses.length === 0) {
                return {
                  success: false,
                  message: 'No se encontraron gastos operativos en la fecha origen',
                  count: 0,
                  details: 'Solo se mueven gastos operativos (viáticos, gasolina, etc.). Los gastos de préstamos y comisiones se mueven con sus respectivas operaciones.'
                };
              }
              
              console.log(`📦 Moviendo ${expenses.length} gastos operativos del ${from.toISOString()} al ${to.toISOString()}`);
              
              // Agrupar gastos por tipo para el reporte
              const expensesByType = expenses.reduce((acc, expense) => {
                const type = expense.expenseSource || 'SIN_TIPO';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              
              // Actualizar todos los gastos con la nueva fecha
              const updateResult = await tx.transaction.updateMany({
                where: {
                  id: { in: expenses.map(expense => expense.id) }
                },
                data: { date: to }
              });
              
              console.log(`✅ Actualizados ${updateResult.count} gastos operativos`);
              console.log(`📊 Detalle por tipo:`, expensesByType);
              
              return {
                success: true,
                message: `${expenses.length} gasto(s) operativo(s) movido(s) exitosamente`,
                count: expenses.length,
                expensesByType,
                fromDate: from.toISOString(),
                toDate: to.toISOString(),
                details: 'Gastos de préstamos y comisiones asociadas deben moverse desde sus respectivas pestañas'
              };
            });
            
          } catch (error) {
            console.error('Error en moveExpensesToDate:', error);
            return {
              success: false,
              message: `Error al mover gastos: ${error instanceof Error ? error.message : 'Unknown error'}`,
              count: 0
            };
          }
        }
      }),
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
                    snapshotRouteId: effectiveRouteId,
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
          try {
            // Usar transacción para garantizar atomicidad
            // Aumentar timeout a 30 segundos para manejar la latencia del servidor de desarrollo
            return await context.prisma.$transaction(async (tx) => {
            // Log de entrada para debug
            console.log('🚀 createCustomLeadPaymentReceived - Inicio:', {
              expectedAmount,
              cashPaidAmount,
              bankPaidAmount,
              agentId,
              leadId,
              paymentDate,
              paymentsCount: payments?.length || 0
            });
            
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

            // Obtener el agente con su ruta para acceder a las cuentas
            const agent = await tx.employee.findUnique({
              where: { id: agentId },
              include: {
                routes: {
                  include: {
                    accounts: {
                      where: {
                        type: { in: ['EMPLOYEE_CASH_FUND', 'BANK'] }
                      }
                    }
                  }
                }
              }
            });

            if (!agent) {
              throw new Error(`Agente no encontrado: ${agentId}`);
            }
            
            if (!agent.routes) {
              throw new Error(`Agente sin ruta asignada: ${agentId}`);
            }

            // Obtener las cuentas de la ruta del agente
            const agentAccounts = agent.routes.accounts || [];
            console.log('🔍 DEBUG - Agent Accounts:', { agentId, routeId: agent.routes.id, accountsCount: agentAccounts.length });

            if (!agentAccounts || agentAccounts.length === 0) {
              throw new Error(`No se encontraron cuentas para la ruta del agente: ${agentId}`);
            }

            const cashAccount = agentAccounts.find((account: any) => account.type === 'EMPLOYEE_CASH_FUND');
            const bankAccount = agentAccounts.find((account: any) => account.type === 'BANK');

            if (!cashAccount) {
              throw new Error('Cuenta de efectivo no encontrada en la ruta del agente');
            }

            if (!bankAccount) {
              throw new Error('Cuenta bancaria no encontrada en la ruta del agente');
            }

            // Crear el LeadPaymentReceived
            console.log('🔍 DEBUG - Creando LeadPaymentReceived con datos:', {
              expectedAmount: expectedAmount.toFixed(2),
              paidAmount: totalPaidAmount.toFixed(2),
              cashPaidAmount: cashPaidAmount.toFixed(2),
              bankPaidAmount: bankPaidAmount.toFixed(2),
              falcoAmount: falcoAmount > 0 ? falcoAmount.toFixed(2) : '0.00',
              paymentStatus,
              agentId,
              leadId,
              paymentDate
            });
            
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
            
            console.log('✅ LeadPaymentReceived creado:', leadPaymentReceived.id);

            // Crear todos los pagos usando createMany para performance
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
              console.log('🔍 DEBUG - Buscando pagos creados para leadPaymentReceivedId:', leadPaymentReceived.id);
              
              const createdPaymentRecords = await tx.loanPayment.findMany({
                where: { leadPaymentReceivedId: leadPaymentReceived.id }
              });
              
              console.log('🔍 DEBUG - Pagos recuperados:', {
                count: createdPaymentRecords.length,
                firstPayment: createdPaymentRecords[0] ? {
                  id: createdPaymentRecords[0].id,
                  amount: createdPaymentRecords[0].amount,
                  amountType: typeof createdPaymentRecords[0].amount,
                  comission: createdPaymentRecords[0].comission,
                  comissionType: typeof createdPaymentRecords[0].comission
                } : null
              });

              // Crear las transacciones manualmente (lógica del hook)
              const transactionData = [];
              let cashAmountChange = 0;
              let bankAmountChange = 0;

              console.log('🔍 DEBUG - Procesando pagos:', createdPaymentRecords.length);

              for (const payment of createdPaymentRecords) {
                // Manejo seguro de valores Decimal de Prisma usando la función helper
                const paymentAmount = safeToNumber(payment.amount);
                const comissionAmount = safeToNumber(payment.comission);
                
                console.log('🔍 DEBUG - Payment:', {
                  id: payment.id,
                  amount: payment.amount,
                  comission: payment.comission,
                  comissionAmount,
                });

                // Obtener datos del préstamo para calcular returnToCapital y profitAmount
                const loan = await tx.loan.findUnique({
                  where: { id: payment.loanId },
                  include: { loantype: true }
                });

                // Obtener el líder para obtener su routeId
                const lead = await tx.employee.findUnique({
                  where: { id: leadId },
                  include: { routes: true }
                });

                let returnToCapital = 0;
                let profitAmount = 0;

                if (loan && loan.loantype) {
                  const loanData = {
                    amountGived: safeToNumber(loan.amountGived),
                    profitAmount: safeToNumber(loan.profitAmount),
                    weekDuration: loan.loantype.weekDuration || 0,
                    rate: safeToNumber(loan.loantype.rate)
                  };

                  const paymentCalculation = await calculatePaymentProfitAmount(
                    paymentAmount,
                    loanData.profitAmount,
                    loanData.amountGived + loanData.profitAmount,
                    loanData.amountGived,
                    0 // loanPayedAmount - asumimos 0 para el primer pago
                  );

                  returnToCapital = paymentCalculation.returnToCapital;
                  profitAmount = paymentCalculation.profitAmount;

                }
                
                // Preparar datos de transacción para el PAGO (INCOME)
                transactionData.push({
                  amount: paymentAmount.toFixed(2),
                  date: new Date(paymentDate),
                  type: 'INCOME',
                  incomeSource: payment.paymentMethod === 'CASH' ? 'CASH_LOAN_PAYMENT' : 'BANK_LOAN_PAYMENT',
                  loanPaymentId: payment.id,
                  loanId: payment.loanId,
                  leadId: leadId,
                  routeId: agent?.routes?.id,
                  snapshotRouteId: agent?.routes?.id,
                  returnToCapital: returnToCapital.toFixed(2),
                  profitAmount: profitAmount.toFixed(2),
                });

                // Preparar datos de transacción para la COMISIÓN (EXPENSE)
                if (comissionAmount > 0) {
                  console.log('🔍 DEBUG - Creando transacción de comisión:', {
                    amount: comissionAmount.toFixed(2),
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
                    amount: comissionAmount.toFixed(2),
                    date: new Date(paymentDate),
                    type: 'EXPENSE',
                    expenseSource: 'LOAN_PAYMENT_COMISSION',
                    sourceAccountId: cashAccount.id,
                    loanPaymentId: payment.id,
                    loanId: payment.loanId,
                    leadId: leadId,
                    routeId: agent?.routes?.id,
                    snapshotRouteId: agent?.routes?.id,
                    description: `Comisión por pago de préstamo - ${payment.id}`,
                  });
                }

                // 🆕 MODIFICADO: Registrar según el método de pago
                if (payment.paymentMethod === 'CASH') {
                  // Pagos en efectivo van a la cuenta de efectivo
                  cashAmountChange += paymentAmount; // Sumar el pago (aumenta efectivo)
                  
                  // Descontar comisiones de efectivo
                  if (comissionAmount > 0) {
                    cashAmountChange -= comissionAmount; // Restar comisión (disminuye efectivo)
                  }
                } else if (payment.paymentMethod === 'MONEY_TRANSFER') {
                  // Pagos por transferencia van directamente a la cuenta bancaria
                  bankAmountChange += paymentAmount; // Sumar el pago (aumenta banco)
                  
                  // Descontar comisiones de efectivo (las comisiones siempre se descuentan de efectivo)
                  if (comissionAmount > 0) {
                    cashAmountChange -= comissionAmount; // Restar comisión (disminuye efectivo)
                  }
                }
              }

              console.log('🔍 DEBUG - Total transacciones a crear:', transactionData.length);
              console.log('🔍 DEBUG - Transacciones de comisiones:', transactionData.filter(t => t.type === 'EXPENSE' && t.expenseSource === 'LOAN_PAYMENT_COMISSION').length);
              console.log('🔍 DEBUG - cashAmountChange calculado:', cashAmountChange);
              console.log('🔍 DEBUG - bankAmountChange calculado:', bankAmountChange);

              // Crear todas las transacciones de una vez
              if (transactionData.length > 0) {
                try {
                  await tx.transaction.createMany({ data: transactionData });
                  console.log('✅ Transacciones creadas exitosamente');
                  
                  // ✅ CORREGIR: Actualizar cuentas manualmente ya que createMany no dispara hooks
                  // Usar el cashAmountChange que ya se calculó correctamente arriba
                  // (incluye todos los pagos menos las comisiones)
                  
                  // Calcular el cambio neto total (incluyendo transferencias)
                  let netCashChange = cashAmountChange;
                  let netBankChange = bankAmountChange;
                  
                  console.log('🔍 DEBUG - Valores antes del cálculo neto:', {
                    cashAmountChange,
                    bankAmountChange,
                    bankPaidAmount,
                    netCashChange,
                    netBankChange
                  });
                  
                  if (bankPaidAmount > 0) {
                    netCashChange -= bankPaidAmount; // Restar la parte que se transfiere al banco
                    netBankChange += bankPaidAmount; // Sumar la parte que se transfiere al banco
                    console.log('🔍 DEBUG - Después de restar/sumar bankPaidAmount:', {
                      bankPaidAmount,
                      netCashChange,
                      netBankChange
                    });
                  }
                  
                  // Actualizar cuenta de efectivo
                  if (netCashChange !== 0) {
                    const currentCashAmount = parseFloat((cashAccount.amount || 0).toString());
                    const newCashAmount = currentCashAmount + netCashChange;
                    
                    console.log('🔧 Actualizando cuenta de efectivo con cambio neto:', {
                      currentAmount: currentCashAmount,
                      cashAmountChange,
                      bankPaidAmount,
                      netCashChange,
                      newAmount: newCashAmount
                    });
                    
                    await tx.account.update({
                      where: { id: cashAccount.id },
                      data: { amount: newCashAmount.toString() }
                    });
                  }
                  
                  // Actualizar cuenta bancaria
                  if (netBankChange !== 0) {
                    const currentBankAmount = parseFloat((bankAccount.amount || 0).toString());
                    const newBankAmount = currentBankAmount + netBankChange;
                    
                    console.log('🔧 Actualizando cuenta bancaria con cambio neto:', {
                      currentAmount: currentBankAmount,
                      bankAmountChange,
                      bankPaidAmount,
                      netBankChange,
                      newAmount: newBankAmount
                    });
                    
                    await tx.account.update({
                      where: { id: bankAccount.id },
                      data: { amount: newBankAmount.toString() }
                    });
                  }
                } catch (error) {
                  console.error('❌ Error creando transacciones:', error);
                  throw error;
                }
              }
              
              // Código de recálculo ya está arriba, no duplicar

              // Actualizar métricas del préstamo para cada loan afectado
              const affectedLoanIds = Array.from(new Set(createdPaymentRecords.map(p => p.loanId).filter(id => id != null)));
              
              // Procesar préstamos en paralelo para mejorar performance
              console.log('🔍 DEBUG - Actualizando métricas de préstamos:', affectedLoanIds.length);
              
              await Promise.all(affectedLoanIds.map(async (loanId) => {
                try {
                  const loan = await tx.loan.findUnique({ 
                    where: { id: loanId }, 
                    include: { loantype: true, payments: true } 
                  });
                  
                  if (!loan) return;
                  
                  const loanWithRelations = loan as any;
                  const rate = safeToNumber(loanWithRelations.loantype?.rate);
                  const requested = safeToNumber(loanWithRelations.requestedAmount);
                  const weekDuration = Number(loanWithRelations.loantype?.weekDuration || 0);
                  const totalDebt = requested * (1 + rate);
                  const expectedWeekly = weekDuration > 0 ? (totalDebt / weekDuration) : 0;
                  const totalPaid = (loanWithRelations.payments || []).reduce((s: number, p: any) => s + safeToNumber(p.amount), 0);
                  const pending = Math.max(0, totalDebt - totalPaid);
                  
                  // Verificar si el préstamo está completado
                  const isCompleted = totalPaid >= totalDebt;
                  
                  await tx.loan.update({
                    where: { id: loanId },
                    data: {
                      totalDebtAcquired: totalDebt.toFixed(2),
                      expectedWeeklyPayment: expectedWeekly.toFixed(2),
                      totalPaid: totalPaid.toFixed(2),
                      pendingAmountStored: pending.toFixed(2),
                      ...(isCompleted && { finishedDate: new Date(paymentDate) })
                    }
                  });
                } catch (loanError) {
                  console.error(`Error actualizando préstamo ${loanId}:`, loanError);
                  // Continuar con otros préstamos aunque uno falle
                }
              }));

              // ✅ NOTA: La actualización de la cuenta de efectivo se hace más abajo
              // con el cálculo del cambio neto que incluye las transferencias

              // 🆕 NUEVA LÓGICA: Si hay monto bancario, crear transferencia automática
              // Solo si NO hay pagos individuales MONEY_TRANSFER (para evitar doble actualización)
              const hasMoneyTransferPayments = createdPaymentRecords.some(p => p.paymentMethod === 'MONEY_TRANSFER');
              
              if (bankPaidAmount > 0 && !hasMoneyTransferPayments) {
                console.log('🔄 Creando transferencia automática por pago mixto:', {
                  amount: bankPaidAmount,
                  from: 'EMPLOYEE_CASH_FUND',
                  to: 'BANK'
                });

                // Crear transacción de transferencia desde efectivo hacia banco
                await tx.transaction.create({
                  data: {
                    amount: bankPaidAmount.toFixed(2),
                    date: new Date(paymentDate),
                    type: 'TRANSFER',
                    sourceAccountId: cashAccount.id,
                    destinationAccountId: bankAccount.id,
                    leadId: leadId,
                    leadPaymentReceivedId: leadPaymentReceived.id,
                    routeId: agent?.routes?.id,
                    snapshotRouteId: agent?.routes?.id,
                    description: `Transferencia automática por pago mixto - Líder: ${agentId}`,
                  }
                });

                // Actualizar balance bancario con el monto transferido
                const currentBankAmount = safeToNumber(bankAccount.amount);
                await tx.account.update({
                  where: { id: bankAccount.id },
                  data: { amount: (currentBankAmount + bankPaidAmount).toString() }
                });

                // ✅ NOTA: La cuenta de efectivo ya se actualizó arriba con el cambio neto
                // que incluye la resta de la parte bancaria, no es necesario actualizarla aquí

                console.log('✅ Transferencia automática creada exitosamente');
              }

              // Validar si los préstamos están completados y marcarlos como terminados
              // Integrado en el procesamiento paralelo anterior para evitar duplicar consultas
            }

            // ✅ NUEVO: Crear transacción de pérdida (EXPENSE) si hay falco
            if (falcoAmount > 0) {
              await tx.transaction.create({
                data: {
                  amount: falcoAmount.toFixed(2),
                  date: new Date(paymentDate),
                  type: 'EXPENSE',
                  expenseSource: 'FALCO_LOSS',
                  sourceAccountId: cashAccount.id,
                  leadPaymentReceivedId: leadPaymentReceived.id,
                  leadId: leadId,
                  routeId: agent?.routes?.id,
                  snapshotRouteId: agent?.routes?.id,
                  description: `Pérdida por falco - ${leadPaymentReceived.id}`,
                }
              });
              
              // Descontar el falco del balance de efectivo
              const currentCashAmount = safeToNumber(cashAccount.amount);
              await tx.account.update({
                where: { id: cashAccount.id },
                data: { amount: (currentCashAmount - falcoAmount).toString() }
              });
            }

            return {
              id: leadPaymentReceived.id,
              expectedAmount: safeToNumber(leadPaymentReceived.expectedAmount),
              paidAmount: safeToNumber(leadPaymentReceived.paidAmount),
              cashPaidAmount: safeToNumber(leadPaymentReceived.cashPaidAmount),
              bankPaidAmount: safeToNumber(leadPaymentReceived.bankPaidAmount),
              falcoAmount: safeToNumber(leadPaymentReceived.falcoAmount),
              paymentStatus: leadPaymentReceived.paymentStatus || 'FALCO',
              payments: payments.map((p, index) => ({
                id: `temp-${index}`, // ID temporal para evitar el error
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
            }, {
              maxWait: 30000, // 30 segundos de timeout máximo
              timeout: 30000, // 30 segundos de timeout de transacción
            });
          } catch (error) {
            console.error('❌ ERROR en createCustomLeadPaymentReceived:', {
              error: error instanceof Error ? error.message : error,
              stack: error instanceof Error ? error.stack : undefined,
              agentId,
              leadId,
              paymentDate,
              paymentsCount: payments?.length || 0
            });
            
            // Manejo específico para error de timeout de transacción
            if (error instanceof Error && error.message.includes('Transaction already closed')) {
              throw new Error(
                'La operación tardó demasiado tiempo debido a la latencia del servidor. ' +
                'Por favor, intente procesar menos pagos a la vez o contacte al administrador.'
              );
            }
            
            // Manejo específico para error de Prisma P2028
            if (error instanceof Error && 'code' in error && error.code === 'P2028') {
              throw new Error(
                'Timeout de transacción: La operación excedió el tiempo límite de 45 segundos. ' +
                'Esto puede deberse a la latencia de red con el servidor de base de datos.'
              );
            }
            
            throw error;
          }
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
          try {
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

            // 🆕 LOGS DETALLADOS PARA DEBUGGING
            console.log('🔍 UPDATE: LeadPaymentReceived encontrado:', {
              id: existingPayment.id,
              expectedAmount: existingPayment.expectedAmount,
              paidAmount: existingPayment.paidAmount,
              paymentsCount: existingPayment.payments.length,
              payments: existingPayment.payments.map(p => ({
                id: p.id,
                amount: p.amount,
                comission: p.comission,
                transactionsCount: p.transactions.length
              }))
            });

            const agentId = existingPayment.agentId || '';
            const leadId = existingPayment.leadId || '';

            // Obtener el agente con su ruta para acceder a las cuentas
            const agent = await tx.employee.findUnique({
              where: { id: agentId },
              include: {
                routes: {
                  include: {
                    accounts: {
                      where: {
                        type: { in: ['EMPLOYEE_CASH_FUND', 'BANK'] }
                      }
                    }
                  }
                }
              }
            });

            if (!agent || !agent.routes) {
              throw new Error(`Agente no encontrado o sin ruta asignada: ${agentId}`);
            }

            // Obtener las cuentas de la ruta del agente
            const agentAccounts = agent.routes.accounts || [];

            if (!agentAccounts || agentAccounts.length === 0) {
              throw new Error(`No se encontraron cuentas para la ruta del agente: ${agentId}`);
            }

            const cashAccount = agentAccounts.find((account: any) => account.type === 'EMPLOYEE_CASH_FUND');
            const bankAccount = agentAccounts.find((account: any) => account.type === 'BANK');

            if (!cashAccount || !bankAccount) {
              throw new Error('Cuentas del agente no encontradas en su ruta');
            }

            // ✅ CORREGIDO: Solo calcular cambios de comisiones, no de pagos
            let oldCommissionChange = 0;
            let newCommissionChange = 0;

            // Calcular comisiones existentes
            for (const payment of existingPayment.payments) {
              const commissionAmount = parseFloat((payment.comission || 0).toString());
              oldCommissionChange += commissionAmount; // Sumar comisiones existentes
            }

            // Calcular comisiones nuevas
            for (const payment of payments) {
              const commissionAmount = payment.comission || 0;
              newCommissionChange += commissionAmount; // Sumar comisiones nuevas
            }

            // Calcular el cambio neto de comisiones
            const commissionChange = newCommissionChange - oldCommissionChange;

            // 🆕 LÓGICA CORREGIDA: Eliminar pagos existentes SIEMPRE que existan
            // Esto se ejecuta independientemente de si se van a crear nuevos pagos
            if (existingPayment.payments.length > 0) {
              console.log('🗑️ UPDATE: Eliminando pagos existentes:', existingPayment.payments.length);
              console.log('🗑️ UPDATE: IDs de pagos a eliminar:', existingPayment.payments.map(p => p.id));
              
              // Obtener IDs de transacciones existentes
              const transactionIds = existingPayment.payments
                .flatMap((payment: any) => payment.transactions.map((t: any) => t.id));
              
              console.log('🗑️ UPDATE: Transacciones a eliminar:', transactionIds.length);
              console.log('🗑️ UPDATE: IDs de transacciones:', transactionIds);
              
              // Eliminar transacciones existentes en lote
              if (transactionIds.length > 0) {
                const deleteResult = await tx.transaction.deleteMany({
                  where: { id: { in: transactionIds } }
                });
                console.log('✅ UPDATE: Transacciones eliminadas:', deleteResult.count);
              }

              // ✅ CORREGIDO: Solo revertir comisiones, no pagos
              if (oldCommissionChange !== 0) {
                const currentCashAmount = parseFloat((cashAccount.amount || 0).toString());
                const newCashAmount = currentCashAmount + oldCommissionChange; // Revertir comisiones (sumar porque se habían restado)
                
                console.log('🔄 UPDATE: Revirtiendo comisiones existentes:', {
                  currentAmount: currentCashAmount,
                  commissionToRevert: oldCommissionChange,
                  newAmount: newCashAmount
                });
                
                await tx.account.update({
                  where: { id: cashAccount.id },
                  data: { amount: newCashAmount.toString() }
                });
                console.log('✅ UPDATE: Comisiones existentes revertidas');
              }

              // Eliminar pagos existentes en lote
              console.log('🗑️ UPDATE: Ejecutando deleteMany para LoanPayments...');
              const deletePaymentsResult = await tx.loanPayment.deleteMany({
                where: { leadPaymentReceivedId: id }
              });

              console.log('✅ UPDATE: Pagos existentes eliminados:', deletePaymentsResult.count);
              
              // 🆕 VERIFICACIÓN: Confirmar que los pagos se eliminaron
              const remainingPayments = await tx.loanPayment.findMany({
                where: { leadPaymentReceivedId: id }
              });
              console.log('🔍 UPDATE: Pagos restantes después de eliminación:', remainingPayments.length);
            } else {
              console.log('ℹ️ UPDATE: No hay pagos existentes para eliminar');
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

            // ✅ SIMPLIFICADO: Solo manejar comisiones nuevas

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

              // OPTIMIZADO: Obtener todos los datos necesarios en una sola consulta
              const loanIds = createdPaymentRecords.map(p => p.loanId);
              const loans = await tx.loan.findMany({
                where: { id: { in: loanIds } },
                include: { loantype: true }
              });
              const loanMap = new Map(loans.map(loan => [loan.id, loan]));

              // Crear las transacciones manualmente en lote
              const transactionData = [];

              for (const payment of createdPaymentRecords) {
                const paymentAmount = parseFloat((payment.amount || 0).toString());
                const commissionAmount = parseFloat((payment.comission || 0).toString());
                const totalAmount = paymentAmount + commissionAmount; // ✅ INCLUIR comisión

                // Usar el mapa en lugar de consulta individual
                const loan = loanMap.get(payment.loanId);

                let returnToCapital = 0;
                let profitAmount = 0;

                if (loan && loan.loantype) {
                  const loanData = {
                    amountGived: safeToNumber(loan.amountGived),
                    profitAmount: safeToNumber(loan.profitAmount),
                    weekDuration: loan.loantype.weekDuration || 0,
                    rate: safeToNumber(loan.loantype.rate)
                  };

                  const paymentCalculation = await calculatePaymentProfitAmount(
                    paymentAmount,
                    loanData.profitAmount,
                    loanData.amountGived + loanData.profitAmount,
                    loanData.amountGived,
                    0 // loanPayedAmount - asumimos 0 para el primer pago
                  );

                  returnToCapital = paymentCalculation.returnToCapital;
                  profitAmount = paymentCalculation.profitAmount;
                }
                
                // Preparar datos de transacción para el pago principal
                transactionData.push({
                  amount: (payment.amount || 0).toString(),
                  date: new Date(paymentDate),
                  type: 'INCOME',
                  incomeSource: payment.paymentMethod === 'CASH' ? 'CASH_LOAN_PAYMENT' : 'BANK_LOAN_PAYMENT',
                  loanPaymentId: payment.id,
                  loanId: payment.loanId,
                  leadId: leadId,
                  routeId: agent?.routes?.id,
                  snapshotRouteId: agent?.routes?.id,
                  returnToCapital: returnToCapital.toFixed(2),
                  profitAmount: profitAmount.toFixed(2),
                });

                // ✅ AGREGAR: Crear transacción separada para la comisión si existe
                if (commissionAmount > 0) {
                  transactionData.push({
                    amount: (payment.comission || 0).toString(),
                    date: new Date(paymentDate),
                    type: 'EXPENSE',
                    expenseSource: 'LOAN_PAYMENT_COMISSION',
                    sourceAccountId: cashAccount.id,
                    loanPaymentId: payment.id,
                    loanId: payment.loanId,
                    leadId: leadId,
                    routeId: agent?.routes?.id,
                    snapshotRouteId: agent?.routes?.id,
                    description: `Comisión por pago de préstamo - ${payment.id}`,
                  });
                }

                // ✅ SIMPLIFICADO: Solo procesar transacciones, no calcular balances aquí
              }

              // Crear todas las transacciones de una vez
              if (transactionData.length > 0) {
                await tx.transaction.createMany({ data: transactionData });
                
                // ✅ CORREGIDO: Solo aplicar el cambio neto de comisiones
                if (commissionChange !== 0) {
                  const currentCashAmount = parseFloat((cashAccount.amount || 0).toString());
                  const newCashAmount = currentCashAmount - commissionChange; // Restar comisiones (aumento = resta, disminución = suma)
                  
                  console.log('🔧 Aplicando cambio neto de comisiones:', {
                    currentAmount: currentCashAmount,
                    commissionChange,
                    newAmount: newCashAmount
                  });
                  
                  await tx.account.update({
                    where: { id: cashAccount.id },
                    data: { amount: newCashAmount.toString() }
                  });
                }
              }
            }

            // ✅ SIMPLIFICADO: Los balances ya se actualizaron arriba, no duplicar

            // 🆕 NUEVA LÓGICA: Manejar transferencias automáticas (crear/actualizar/eliminar)
            const oldBankPaidAmount = parseFloat(existingPayment.bankPaidAmount?.toString() || '0');
            const newBankPaidAmount = bankPaidAmount;
            const bankAmountChange = newBankPaidAmount - oldBankPaidAmount;

            // Buscar transferencias automáticas existentes de este LeadPaymentReceived
            const existingTransferTransactions = await tx.transaction.findMany({
              where: {
                leadPaymentReceivedId: id,
                type: 'TRANSFER',
                description: { contains: 'Transferencia automática por pago mixto' }
              }
            });

            if (existingTransferTransactions.length > 0) {
              console.log('🔄 UPDATE: Eliminando transferencias automáticas existentes:', existingTransferTransactions.length);
              
              // Eliminar transferencias existentes
              await tx.transaction.deleteMany({
                where: {
                  id: { in: existingTransferTransactions.map(t => t.id) }
                }
              });

              // Revertir el efecto de las transferencias eliminadas en ambos balances
              const totalRevertedAmount = existingTransferTransactions.reduce((sum, t) => {
                return sum + parseFloat((t.amount || 0).toString());
              }, 0);

              if (totalRevertedAmount > 0) {
                // Revertir balance bancario (reducir)
                const currentBankAmount = parseFloat((bankAccount.amount || 0).toString());
                await tx.account.update({
                  where: { id: bankAccount.id },
                  data: { amount: (currentBankAmount - totalRevertedAmount).toString() }
                });

                // Revertir balance de efectivo (aumentar)
                const currentCashAmount = parseFloat((cashAccount.amount || 0).toString());
                await tx.account.update({
                  where: { id: cashAccount.id },
                  data: { amount: (currentCashAmount + totalRevertedAmount).toString() }
                });

                console.log('🔄 UPDATE: Revertidos balances bancario y efectivo:', totalRevertedAmount);
              }
            }

            // Crear nueva transferencia si hay monto bancario
            if (newBankPaidAmount > 0) {
              console.log('🔄 UPDATE: Creando nueva transferencia automática por pago mixto:', {
                amount: newBankPaidAmount,
                from: 'EMPLOYEE_CASH_FUND',
                to: 'BANK'
              });

              // Crear transacción de transferencia desde efectivo hacia banco
              await tx.transaction.create({
                data: {
                  amount: newBankPaidAmount.toFixed(2),
                  date: new Date(paymentDate),
                  type: 'TRANSFER',
                  sourceAccountId: cashAccount.id,
                  destinationAccountId: bankAccount.id,
                  leadId: leadId,
                  leadPaymentReceivedId: leadPaymentReceived.id,
                  routeId: agent?.routes?.id,
                  snapshotRouteId: agent?.routes?.id,
                  description: `Transferencia automática por pago mixto actualizado - Líder: ${agentId}`,
                }
              });

              // Actualizar balance bancario con el monto transferido
              const currentBankAmount = parseFloat((bankAccount.amount || 0).toString());
              await tx.account.update({
                where: { id: bankAccount.id },
                data: { amount: (currentBankAmount + newBankPaidAmount).toString() }
              });

              // Actualizar balance de efectivo (reducir el monto transferido)
              const currentCashAmount = parseFloat((cashAccount.amount || 0).toString());
              await tx.account.update({
                where: { id: cashAccount.id },
                data: { amount: (currentCashAmount - newBankPaidAmount).toString() }
              });

              console.log('✅ UPDATE: Nueva transferencia automática creada exitosamente');
            }

            // ✅ NUEVO: Manejar cambios en falco (crear/actualizar/eliminar transacciones de pérdida)
            const oldFalcoAmount = parseFloat(existingPayment.falcoAmount?.toString() || '0');
            const newFalcoAmount = falcoAmount;
            const falcoChange = newFalcoAmount - oldFalcoAmount;

            if (falcoChange !== 0) {
              // Buscar transacción de falco existente
              const existingFalcoTransaction = await tx.transaction.findFirst({
                where: {
                  leadPaymentReceivedId: id,
                  type: 'EXPENSE',
                  expenseSource: 'FALCO_LOSS'
                }
              });

              if (existingFalcoTransaction) {
                if (newFalcoAmount > 0) {
                  // Actualizar transacción existente
                  await tx.transaction.update({
                    where: { id: existingFalcoTransaction.id },
                    data: {
                      amount: newFalcoAmount.toFixed(2),
                      date: new Date(paymentDate),
                      description: `Pérdida por falco actualizada - ${id}`,
                    }
                  });
                } else {
                  // Eliminar transacción si no hay más falco
                  await tx.transaction.delete({
                    where: { id: existingFalcoTransaction.id }
                  });
                }
              } else if (newFalcoAmount > 0) {
                // Crear nueva transacción de falco
                await tx.transaction.create({
                  data: {
                    amount: newFalcoAmount.toFixed(2),
                    date: new Date(paymentDate),
                    type: 'EXPENSE',
                    expenseSource: 'FALCO_LOSS',
                    sourceAccountId: cashAccount.id,
                    leadPaymentReceivedId: id,
                    leadId: leadId,
                    routeId: agent?.routes?.id,
                    snapshotRouteId: agent?.routes?.id,
                    description: `Pérdida por falco - ${id}`,
                  }
                });
              }

              // Ajustar balance de efectivo por el cambio en falco
              if (falcoChange !== 0) {
                const currentCashAmount = safeToNumber(cashAccount.amount);
                const adjustedCashAmount = currentCashAmount - falcoChange; // Restar aumento de falco, sumar disminución
                await tx.account.update({
                  where: { id: cashAccount.id },
                  data: { amount: adjustedCashAmount.toString() }
                });
              }
            }

            // 🆕 LOGS FINALES: Verificar estado final
            const finalPayments = await tx.loanPayment.findMany({
              where: { leadPaymentReceivedId: id }
            });
            console.log('🔍 UPDATE: Estado final - Pagos restantes:', Array.isArray(finalPayments) ? finalPayments.length : 'No es array');
            console.log('🔍 UPDATE: Estado final - IDs de pagos:', Array.isArray(finalPayments) ? finalPayments.map(p => p.id) : 'No es array');

            return {
              id: leadPaymentReceived.id,
              expectedAmount: parseFloat(leadPaymentReceived.expectedAmount?.toString() || '0'),
              paidAmount: parseFloat(leadPaymentReceived.paidAmount?.toString() || '0'),
              cashPaidAmount: parseFloat(leadPaymentReceived.cashPaidAmount?.toString() || '0'),
              bankPaidAmount: parseFloat(leadPaymentReceived.bankPaidAmount?.toString() || '0'),
              falcoAmount: parseFloat(leadPaymentReceived.falcoAmount?.toString() || '0'),
              paymentStatus: leadPaymentReceived.paymentStatus || 'FALCO',
              payments: payments.map((p, index) => ({
                id: `temp-${index}`, // ID temporal para evitar el error
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
          }, {
            timeout: 45000 // 45 segundos de timeout de transacción (fallback generoso)
          });
          } catch (error) {
            console.error('❌ ERROR en updateCustomLeadPaymentReceived:', {
              error: error instanceof Error ? error.message : error,
              stack: error instanceof Error ? error.stack : undefined,
              id,
              expectedAmount,
              paymentDate,
              paymentsCount: payments?.length || 0
            });
            
            // Manejo específico para error de timeout de transacción
            if (error instanceof Error && error.message.includes('Transaction already closed')) {
              throw new Error(
                'La operación tardó demasiado tiempo debido a la latencia del servidor. ' +
                'Por favor, intente procesar menos pagos a la vez o contacte al administrador.'
              );
            }
            
            // Manejo específico para error de Prisma P2028
            if (error instanceof Error && 'code' in error && error.code === 'P2028') {
              throw new Error(
                'Timeout de transacción: La operación excedió el tiempo límite de 45 segundos. ' +
                'Esto puede deberse a la latencia de red con el servidor de base de datos.'
              );
            }
            
            throw error;
          }
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
              include: { routes: true }
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
              const accountRouteIds = account.routes?.map(r => r.id) || [];
              const fallback = await context.prisma.account.findFirst({
                where: {
                  id: { not: account.id },
                  OR: [
                    { routes: { some: { id: { in: accountRouteIds } } } },
                    { routes: { none: {} } }
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
                route: account.routes && account.routes.length > 0 ? { connect: { id: account.routes[0].id } } : undefined,
                snapshotRouteId: account.routes && account.routes.length > 0 ? account.routes[0].id : undefined,
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
                  where: { id: loanData.leadId },
                  include: { routes: true }
                });

                if (lead?.routes?.id) {
                  const account = await tx.account.findFirst({
                    where: { 
                      routes: { some: { id: lead.routes.id } },
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
                          leadId: loanData.leadId,
                          routeId: lead.routes.id,
                          snapshotRouteId: lead.routes.id
                        },
                        {
                          amount: commissionAmountNum.toString(),
                          date: new Date(loanData.signDate),
                          type: 'EXPENSE',
                          expenseSource: 'LOAN_GRANTED_COMISSION',
                          sourceAccountId: account.id,
                          loanId: loan.id,
                          leadId: loanData.leadId,
                          routeId: lead.routes.id,
                          snapshotRouteId: lead.routes.id
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
                      routes: { 
                        some: { id: (lead as any)?.routesId }
                      },
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

                    console.log('💰 Calculando actualización de cuenta:', {
                      oldAmount,
                      oldCommission,
                      newAmount,
                      newCommission,
                      oldTotal,
                      newTotal,
                      balanceChange,
                      currentAmount,
                      updatedAmount
                    });

                    const updateResult = await context.db.Account.updateOne({
                      where: { id: account.id },
                      data: { amount: updatedAmount.toString() }
                    });

                    console.log('💰 Cuenta EMPLOYEE_CASH_FUND actualizada:', {
                      accountId: account.id,
                      oldTotal,
                      newTotal,
                      balanceChange,
                      updatedAmount,
                      updateResult
                    });
                  } else {
                    console.log('⚠️ No se encontró cuenta EMPLOYEE_CASH_FUND para la ruta:', (lead as any)?.routesId);
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
                      route: { id: (lead as any)?.routesId },
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

      // ✅ NUEVA MUTATION: Enviar mensaje de prueba a Telegram
      sendTestTelegramMessage: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: { 
          chatId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          message: graphql.arg({ type: graphql.nonNull(graphql.String) })
        },
        resolve: async (root, { chatId, message }, context: Context) => {
          try {
            console.log('🚀 sendTestTelegramMessage llamado con:', { chatId, message });
            
            const sent = await sendTelegramMessageToUser(chatId, message);
            
            if (sent) {
              return `✅ Mensaje enviado exitosamente a ${chatId}`;
            } else {
              return `❌ Error al enviar mensaje a ${chatId}`;
            }
          } catch (error) {
            console.error('❌ Error en sendTestTelegramMessage:', error);
            return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // ✅ NUEVA MUTATION: Enviar reporte con PDF a Telegram (versión temporal sin routeIds)
      sendReportWithPDF: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: { 
          chatId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          reportType: graphql.arg({ type: graphql.nonNull(graphql.String) })
        },
        resolve: async (root, { chatId, reportType }, context: Context) => {
          try {
            console.log('🚀🚀🚀 MUTACIÓN sendReportWithPDF LLAMADA 🚀🚀🚀');
            console.log('📋 Parámetros recibidos:', { chatId, reportType });
            console.log('📋 Tipo de reporte exacto:', `"${reportType}"`);
            console.log('📋 ¿Es créditos con errores?', reportType === 'creditos_con_errores');
            
            // Generar PDF del reporte usando la función con streams y datos reales
            console.log('📋 Llamando generatePDFWithStreams...');
            const pdfBuffer = await generatePDFWithStreams(reportType, context, []);
            console.log('📋 PDF generado, tamaño:', pdfBuffer.length, 'bytes');
            const filename = `reporte_${reportType}_${Date.now()}.pdf`;
            const caption = `📊 <b>REPORTE AUTOMÁTICO</b>\n\nTipo: ${reportType}\nGenerado: ${new Date().toLocaleString('es-ES')}\n\n✅ Enviado desde Keystone Admin`;
            
            console.log('📱 PDF generado, tamaño:', pdfBuffer.length, 'bytes');
            
            // Verificar que el PDF se generó correctamente
            if (pdfBuffer.length === 0) {
              console.error('❌ PDF generado con 0 bytes');
              return `❌ Error: No se pudo generar el PDF (0 bytes)`;
            }
            
            // Enviar PDF real a Telegram
            const sent = await sendTelegramFile(chatId, pdfBuffer, filename, caption);
            
            if (sent) {
              return `✅ Reporte PDF enviado exitosamente a ${chatId} (${filename}, ${(pdfBuffer.length / 1024).toFixed(2)} KB)`;
            } else {
              return `❌ Error al enviar reporte PDF a ${chatId}`;
            }
          } catch (error) {
            console.error('❌ Error en sendReportWithPDF:', error);
            return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),
      
      // ✅ FUNCIONALIDAD SIMPLIFICADA: Marcar créditos como cartera muerta
      markLoansDeadDebt: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: {
          loanIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.ID))) }),
          deadDebtDate: graphql.arg({ type: graphql.nonNull(graphql.String) })
        },
        resolve: async (source, { loanIds, deadDebtDate }, context: Context) => {
          try {
            const result = await context.prisma.loan.updateMany({
              where: {
                id: { in: loanIds },
                badDebtDate: null
              },
              data: {
                badDebtDate: new Date(deadDebtDate)
              }
            });
            
            return JSON.stringify({
              success: true,
              message: `${result.count} créditos marcados como cartera muerta exitosamente`,
              updatedCount: result.count
            });
          } catch (error) {
            return JSON.stringify({
              success: false,
              message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              updatedCount: 0
            });
          }
        }
      }),
    },
    query: {
      // ✅ NUEVA FUNCIONALIDAD: Obtener cumpleaños de líderes por mes
      getLeadersBirthdays: graphql.field({
        type: graphql.nonNull(graphql.list(graphql.nonNull(LeaderBirthdayType))),
        args: {
          month: graphql.arg({ type: graphql.nonNull(graphql.Int) })
        },
        resolve: async (source, { month }, context: Context) => {
          try {
            console.log(`🎂 Buscando cumpleaños para el mes: ${month}`);
            
            // Get all employees with type ROUTE_LEAD who have birthDate
            const leaders = await context.prisma.employee.findMany({
              where: {
                type: { equals: 'ROUTE_LEAD' },
                personalData: {
                  birthDate: { not: null }
                }
              },
              include: {
                personalData: true,
                routes: true
              }
            });

            console.log(`📊 Total líderes con fecha de nacimiento: ${leaders.length}`);
            
            // Log some birth dates for debugging
            leaders.forEach(leader => {
              if (leader.personalData?.birthDate) {
                const birthDate = new Date(leader.personalData.birthDate);
                console.log(`👤 ${leader.personalData.fullName}: ${birthDate.toISOString()} (mes: ${birthDate.getMonth() + 1})`);
              }
            });

            // Filter by month and format data
            const birthdaysInMonth = leaders
              .filter(leader => {
                if (!leader.personalData?.birthDate) return false;
                const birthDate = new Date(leader.personalData.birthDate);
                const birthMonth = birthDate.getMonth() + 1;
                console.log(`🔍 Comparando: ${leader.personalData.fullName} - mes ${birthMonth} vs ${month}`);
                return birthMonth === month; // getMonth() returns 0-11
              })
              .map(leader => {
                const birthDate = new Date(leader.personalData.birthDate);
                return {
                  id: leader.personalData.id,
                  fullName: leader.personalData.fullName,
                  birthDate: leader.personalData.birthDate,
                  day: birthDate.getDate(),
                  route: leader.routes ? {
                    id: leader.routes.id,
                    name: leader.routes.name
                  } : null,
                  location: null // We'll get this from addresses if needed
                };
              })
              .sort((a, b) => a.day - b.day); // Sort by day of month

            // Get location info for each leader
            for (const birthday of birthdaysInMonth) {
              const addresses = await context.db.Address.findMany({
                where: { personalData: { id: { equals: birthday.id } } },
                include: { location: true },
                take: 1
              });
              
              if (addresses.length > 0 && addresses[0].location) {
                birthday.location = {
                  id: addresses[0].location.id,
                  name: addresses[0].location.name
                };
              }
            }

            console.log(`🎉 Cumpleaños encontrados en el mes ${month}: ${birthdaysInMonth.length}`);
            return birthdaysInMonth;
          } catch (error) {
            console.error('Error fetching leaders birthdays:', error);
            throw new Error('Error al obtener cumpleaños de líderes');
          }
        }
      }),
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
            transferFromCash: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.transferFromCash || 0
            }),
            transferToBank: graphql.field({ 
              type: graphql.nonNull(graphql.Float),
              resolve: (item: any) => item.transferToBank || 0
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
          
          
          // OPTIMIZADO: Recopilamos todos los IDs de rutas únicos para minimizar consultas
          const routeIds = new Set<string>();
          rangeTransactions.forEach(transaction => {
            // Prioridad: snapshotRouteId > routeId
            const routeId = transaction.snapshotRouteId || transaction.routeId;
            if (routeId) {
              routeIds.add(routeId.toString());
            }
          });
          
          // OPTIMIZADO: Una sola consulta para obtener todas las rutas
          const routes = await context.prisma.route.findMany({
            where: { 
              id: { in: Array.from(routeIds) } 
            },
            orderBy: { id: 'asc' }
          });
          
          // OPTIMIZADO: Crear mapa de rutas por ID
          const routeMap = new Map();
          routes.forEach(route => {
            routeMap.set(route.id, {
              name: route.name,
              id: route.id
            });
          });
          
          // OPTIMIZADO: Recopilamos todos los IDs de líderes únicos para minimizar consultas
          const leadIds = new Set<string>();
          rangeTransactions.forEach(transaction => {
            if (transaction.leadId) {
              leadIds.add(transaction.leadId.toString());
            }
          });
          
          // OPTIMIZADO: Una sola consulta para obtener todos los líderes con sus datos personales
          const leads = await context.prisma.employee.findMany({
            where: { 
              id: { in: Array.from(leadIds) } 
            },
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
            },
            orderBy: { id: 'asc' }
          });
          
          // OPTIMIZADO: Crear mapa de localidades por líder usando las relaciones ya cargadas
          const leadInfoMap = new Map();
          
          leads.forEach(lead => {
            if (lead.personalData) {
              const personalData = lead.personalData;
              const addresses = personalData.addresses || [];
              
              if (addresses.length > 0) {
                const address = addresses[0]; // Primera dirección
                const location = address.location;
                
                if (location && location.municipality) {
                  const municipality = location.municipality;
                  const state = municipality.state;
                  
                  if (location.name && municipality.name && state && state.name) {
                    leadInfoMap.set(lead.id, {
                      locality: location.name,
                      municipality: municipality.name,
                      state: state.name,
                      fullName: personalData.fullName || 'Sin nombre'
                    });
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
            
            // ESTRATEGIA MEJORADA PARA RUTAS HISTÓRICAS:
            // Prioridad: snapshotRouteId > routeId
            const routeId = transaction.snapshotRouteId || transaction.routeId;
            let routeName = 'Sin ruta';
            let locality = 'General';
            let leadName = '';
            let leadId = transaction.leadId;
            let localitySource = 'sin fuente';
            
            // Obtener información de la ruta histórica
            if (routeId) {
              const route = routeMap.get(routeId.toString());
              if (route) {
                routeName = route.name;
                localitySource = 'ruta histórica';
              }
            }
            
            // Obtener información del lead para localidad geográfica
            if (leadId) {
              const leadInfo = leadInfoMap.get(leadId) || leadInfoMap.get(leadId?.toString());
              if (leadInfo) {
                leadName = leadInfo.fullName;
                  locality = leadInfo.locality;
                localitySource = 'datos del líder';
                }
              }
            
            // Si no tenemos información del lead, usar el nombre de la ruta como fallback
            if (locality === 'General' && routeName !== 'Sin ruta') {
              locality = routeName;
              localitySource = 'nombre de ruta';
            }
            
            // Construir la clave de agrupación basada en la localidad geográfica
            let leaderKey = '';
            if (leadName && leadName !== '') {
              leaderKey = `${leadName} - ${locality}`;
            } else if (leadId) {
              leaderKey = `Líder ID: ${leadId} - ${locality}`;
            } else {
              leaderKey = locality;
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
                MONEY_INVESMENT: 0, OTRO: 0, CASH_BALANCE: 0, BANK_BALANCE: 0,
                TRANSFER_FROM_CASH: 0, TRANSFER_TO_BANK: 0
              };
            }



            if (transaction.type === 'INCOME') {
              
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
              
              // Procesar diferentes tipos de gastos
              const amount = Number(transaction.amount || 0);
              
              // Determinar si es un gasto en efectivo o bancario
              const isBankExpense = sourceAccount?.type === 'BANK';
              
              if (isBankExpense) {
                console.log(`💰 Gasto bancario: ${transaction.expenseSource} - $${amount} para ${leaderKey}`);
                console.log(`   - Balance banco antes: ${localidades[transactionDate][leaderKey].BANK_BALANCE}`);
                console.log(`   - NOTA: Los gastos bancarios NO se descuentan del balance bancario (solo se suman ingresos)`);
                console.log(`   - Balance banco después: ${localidades[transactionDate][leaderKey].BANK_BALANCE}`);
              }
              
              // CORREGIDO: Verificar el tipo de gasto según expenseSource
              // IMPORTANTE: Los gastos bancarios NO se descuentan del BANK_BALANCE
              // El BANK_BALANCE solo suma ingresos bancarios
              if (transaction.expenseSource === 'GASOLINE') {
                localidades[transactionDate][leaderKey].GASOLINE += amount;
                // Solo descontar del balance de efectivo si es gasto en efectivo
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'VIATIC') {
                localidades[transactionDate][leaderKey].VIATIC += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'ACCOMMODATION') {
                localidades[transactionDate][leaderKey].ACCOMMODATION += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'VEHICULE_MAINTENANCE') {
                localidades[transactionDate][leaderKey].VEHICULE_MAINTENANCE += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'NOMINA_SALARY') {
                localidades[transactionDate][leaderKey].NOMINA_SALARY += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'EXTERNAL_SALARY') {
                localidades[transactionDate][leaderKey].EXTERNAL_SALARY += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'CREDITO') {
                localidades[transactionDate][leaderKey].CREDITO += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'LOAN_GRANTED') {
                localidades[transactionDate][leaderKey].LOAN_GRANTED += amount;
                console.log(`💰 Préstamo otorgado: ${amount} - isBankExpense: ${isBankExpense} para ${leaderKey}`);
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                  console.log(`   - CASH_BALANCE después: ${localidades[transactionDate][leaderKey].CASH_BALANCE}`);
                }
              } else if (transaction.expenseSource === 'LOAN_GRANTED_COMISSION') {
                localidades[transactionDate][leaderKey].LOAN_GRANTED_COMISSION += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'LOAN_PAYMENT_COMISSION') {
                localidades[transactionDate][leaderKey].LOAN_PAYMENT_COMISSION += amount;
                console.log(`💰 Comisión pago: ${amount} - isBankExpense: ${isBankExpense} para ${leaderKey}`);
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                  console.log(`   - CASH_BALANCE después: ${localidades[transactionDate][leaderKey].CASH_BALANCE}`);
                }
              } else if (transaction.expenseSource === 'LEAD_COMISSION') {
                localidades[transactionDate][leaderKey].LEAD_COMISSION += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else if (transaction.expenseSource === 'LEAD_EXPENSE') {
                localidades[transactionDate][leaderKey].LEAD_EXPENSE += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              } else {
                localidades[transactionDate][leaderKey].OTRO += amount;
                if (!isBankExpense) {
                  localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                }
              }

            } else if (transaction.type === 'TRANSFER') {
              // Procesar transferencias entre cuentas
              const amount = Number(transaction.amount || 0);
              
              // Determinar el tipo de transferencia basado en las cuentas
              const isFromCashToBank = sourceAccount?.type === 'EMPLOYEE_CASH_FUND' && destinationAccount?.type === 'BANK';
              const isFromBankToCash = sourceAccount?.type === 'BANK' && destinationAccount?.type === 'EMPLOYEE_CASH_FUND';
              
              if (isFromCashToBank) {
                // Transferencia de efectivo a banco: 
                // 1. Reducir abonos en efectivo (porque se transfirió a banco)
                localidades[transactionDate][leaderKey].CASH_ABONO -= amount;
                // 2. Aumentar abonos en banco (porque llegó al banco)
                localidades[transactionDate][leaderKey].BANK_ABONO += amount;
                // 3. Ajustar balances finales
                localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
                localidades[transactionDate][leaderKey].BANK_BALANCE += amount;
                // 4. Rastrear transferencias
                localidades[transactionDate][leaderKey].TRANSFER_FROM_CASH += amount;
                localidades[transactionDate][leaderKey].TRANSFER_TO_BANK += amount;
                console.log(`🔄 Transferencia efectivo->banco: ${amount} para ${leaderKey}`);
                console.log(`   - Balance efectivo después: ${localidades[transactionDate][leaderKey].CASH_BALANCE}`);
                console.log(`   - Balance banco después: ${localidades[transactionDate][leaderKey].BANK_BALANCE}`);
              } else if (isFromBankToCash) {
                // Transferencia de banco a efectivo: 
                // 1. Reducir abonos en banco (porque se transfirió a efectivo)
                localidades[transactionDate][leaderKey].BANK_ABONO -= amount;
                // 2. Aumentar abonos en efectivo (porque llegó al efectivo)
                localidades[transactionDate][leaderKey].CASH_ABONO += amount;
                // 3. Ajustar balances finales
                localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
                localidades[transactionDate][leaderKey].CASH_BALANCE += amount;
                // Nota: No rastreamos transferencias de banco a efectivo en estos campos
                console.log(`🔄 Transferencia banco->efectivo: ${amount} para ${leaderKey}`);
              }
              // Nota: No procesamos otras transferencias (entre cuentas del mismo tipo o diferentes tipos)
            }
          }

          // Verificar estadísticas finales
          const localidadesUnicas = new Set();
          Object.entries(localidades).forEach(([date, localities]) => {
            Object.keys(localities).forEach(locality => {
              localidadesUnicas.add(locality);
            });
          });
          

          const result = Object.entries(localidades).flatMap(([date, localities]) => 
            Object.entries(localities).map(([locality, data]) => {
              // Verificar si hay valores inválidos (permitir negativos para balances)
              const checkValue = (value: number, name: string) => {
                if (isNaN(value)) {
                  return 0;
                }
                return value;
              };
              
              // Función especial para balances que permite valores negativos
              const checkBalanceValue = (value: number, name: string) => {
                if (isNaN(value)) {
                  return 0;
                }
                return value; // Permite valores negativos
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
              
              // Logging final para debugging
              console.log(`📊 RESUMEN FINAL para ${locality} (${date}):`);
              console.log(`   - CASH_ABONO: ${data.CASH_ABONO}`);
              console.log(`   - BANK_ABONO: ${data.BANK_ABONO}`);
              console.log(`   - LOAN_GRANTED: ${data.LOAN_GRANTED}`);
              console.log(`   - LOAN_PAYMENT_COMISSION: ${data.LOAN_PAYMENT_COMISSION}`);
              console.log(`   - LOAN_GRANTED_COMISSION: ${data.LOAN_GRANTED_COMISSION}`);
              console.log(`   - CASH_BALANCE: ${data.CASH_BALANCE}`);
              console.log(`   - BANK_BALANCE: ${data.BANK_BALANCE}`);
              console.log(`   - TRANSFER_TO_BANK: ${data.TRANSFER_TO_BANK}`);
              
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
                cashBalance: checkBalanceValue(data.CASH_BALANCE, 'CASH_BALANCE'),
                bankBalance: checkBalanceValue(data.BANK_BALANCE, 'BANK_BALANCE'),
                transferFromCash: checkValue(data.TRANSFER_FROM_CASH, 'TRANSFER_FROM_CASH'),
                transferToBank: checkValue(data.TRANSFER_TO_BANK, 'TRANSFER_TO_BANK'),
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
              const periodKey = `${year}-${month.toString().padStart(2, '0')}`;
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
                type: 'monthly',
                start: new Date(year, month - 1, 1),
                end: new Date(year, month, 0, 23, 59, 59, 999)
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
                
                // ✅ CORRECCIÓN: Asegurar que weekEnd no se extienda más allá del mes
                const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
                if (weekEnd > monthEnd) {
                  weekEnd.setTime(monthEnd.getTime());
                }
                
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

            // ✅ OPTIMIZACIÓN: Calcular rango de fechas para filtrar préstamos
            const weekOrder = Object.keys(weeks).sort((a, b) => {
              const numA = parseInt(a.split(' ')[1]);
              const numB = parseInt(b.split(' ')[1]);
              return numA - numB;
            });
            
            // Calcular rango de fechas para la consulta (desde 1 año antes hasta 1 mes después)
            const queryStart = new Date(year - 1, month - 1, 1);
            const queryEnd = new Date(year, month, 0, 23, 59, 59, 999);

            // ✅ OPTIMIZACIÓN: Query optimizada con filtros de fecha y solo campos necesarios
            const allLoans = await (context.prisma as any).loan.findMany({
              where: {
                lead: {
                  routes: {
                    id: routeId
                  }
                },
                OR: [
                  {
                    signDate: {
                      gte: queryStart,
                      lte: queryEnd
                    }
                  },
                  {
                    finishedDate: {
                      gte: queryStart,
                      lte: queryEnd
                    }
                  },
                  {
                    AND: [
                      {
                        signDate: {
                          lte: queryEnd
                        }
                      },
                      {
                        OR: [
                          {
                            finishedDate: null
                          },
                          {
                            finishedDate: {
                              gte: queryStart
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              select: {
                id: true,
                signDate: true,
                finishedDate: true,
                amountGived: true,
                requestedAmount: true,
                pendingAmountStored: true,
                status: true,
                previousLoanId: true,
                borrower: {
                  select: {
                    personalData: {
                      select: {
                        fullName: true,
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
                },
                previousLoan: {
                  select: {
                    finishedDate: true,
                    amountGived: true
                  }
                },
                loantype: {
                  select: {
                    rate: true,
                    weekDuration: true
                  }
                },
                lead: {
                  select: {
                    personalData: {
                      select: {
                        fullName: true,
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
                },
                payments: {
                  select: {
                    amount: true,
                    receivedAt: true,
                    createdAt: true
                  },
                  orderBy: {
                    receivedAt: 'asc'
                  }
                },
                excludedByCleanup: {
                  select: {
                    cleanupDate: true,
                    executedBy: {
                      select: {
                        id: true
                      }
                    }
                  }
                }
              }
            });

            // ✅ OPTIMIZACIÓN: Cache para cálculos de préstamos
            const loanCache = new Map();
            const loanCalculations = new Map();
            
            // ✅ OPTIMIZACIÓN: Pre-calcular datos de préstamos para evitar recálculos
            const preCalculatedLoans = allLoans.map(loan => {
              const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
              const requested = parseFloat(loan.requestedAmount?.toString() || '0');
              const totalDebt = requested * (1 + rate);
              const duration = Number(loan.loantype?.weekDuration || 0);
              const expectedWeekly = duration > 0 ? totalDebt / duration : 0;
              
              return {
                ...loan,
                _calculated: {
                  rate,
                  requested,
                  totalDebt,
                  duration,
                  expectedWeekly
                }
              };
            });

            // ✅ OPTIMIZACIÓN: Crear mapa de renovaciones para acceso O(1)
            const renewalMap = new Map();
            preCalculatedLoans.forEach(loan => {
              if (loan.previousLoanId) {
                if (!renewalMap.has(loan.previousLoanId)) {
                  renewalMap.set(loan.previousLoanId, []);
                }
                renewalMap.get(loan.previousLoanId).push(loan);
              }
            });
            
            // 🔍 DEBUG: Log del mapa de renovaciones
            // console.log('\n🔍 MAPA DE RENOVACIONES:');
            // renewalMap.forEach((renewals, previousLoanId) => {
            //   console.log(`  - Préstamo ${previousLoanId} fue renovado por ${renewals.length} préstamos:`);
            //   renewals.forEach((renewal: any, index: number) => {
            //     console.log(`    ${index + 1}. ID: ${renewal.id}, Fecha: ${renewal.signDate}`);
            //   });
            // });

            // ✅ CRITERIOS ESTRICTOS: Determina si el préstamo se considera ACTIVO según los 3 puntos clave
            const isLoanConsideredOnDate = (loan: any, date: Date, debugForAtasta = false) => {
              // 🔍 DEBUG: Log específico para crédito cmfdjecea3u1bpsjv0xf8p1wp
              const isDebugLoan = loan.id === 'cmfdjecea3u1bpsjv0xf8p1wp';
              
              if (isDebugLoan) {
                console.log(`\n🔍 DEBUG isLoanConsideredOnDate - CRÉDITO ${loan.id}:`);
                console.log(`  - Fecha de evaluación: ${date.toISOString()}`);
                console.log(`  - Fecha de firma: ${loan.signDate}`);
                console.log(`  - Fecha de finalización: ${loan.finishedDate || 'No finalizado'}`);
                console.log(`  - Excluido por cleanup: ${loan.excludedByCleanup ? 'Sí' : 'No'}`);
              }
              
              // Si no hay signDate, el préstamo no puede estar activo
              if (!loan.signDate) {
                if (debugForAtasta || isDebugLoan) {
                  console.log(`    ❌ PUNTO 0: Préstamo ${loan.id} no tiene signDate`);
                }
                return false;
              }
              
              const signDate = new Date(loan.signDate);
              if (signDate > date) {
                if (debugForAtasta || isDebugLoan) {
                  console.log(`    ❌ PUNTO 0: Préstamo ${loan.id} firmado después de la fecha (${signDate.toISOString()} > ${date.toISOString()})`);
                }
                return false;
              }
              
              // ✅ PUNTO 0: Si ya fue finalizado antes de la fecha de referencia, NO está activo
              if (loan.finishedDate !== null) {
                const finishedDate = new Date(loan.finishedDate);
                if (finishedDate <= date) {
                  if (debugForAtasta) {
                    console.log(`    ❌ PUNTO 1: Préstamo ${loan.id} ya finalizado antes de la fecha (${finishedDate.toISOString()} <= ${date.toISOString()})`);
                  }
                  return false; // Ya fue finalizado antes de la fecha de referencia
                }
              }
              
              // ✅ PUNTO 1: Si para la semana de revisión fue marcado como portafolioCleanup, entonces no se contempla
              if (loan.excludedByCleanup !== null && loan.excludedByCleanup !== undefined) {
                const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate as any);
                if (cleanupDate <= date) {
                  if (debugForAtasta) {
                    console.log(`    ❌ PUNTO 2: Préstamo ${loan.id} excluido por cleanup antes de la fecha (${cleanupDate.toISOString()} <= ${date.toISOString()})`);
                  }
                  return false; // Ya fue excluido por cleanup antes de la fecha de referencia
                }
              }

              // ✅ PUNTO 2: Si para la semana de revisión fue renovado, no se contempla
              if (loan.previousLoanId) {
                // ✅ OPTIMIZACIÓN: Usar mapa de renovaciones en lugar de buscar en array
                const renewals = renewalMap.get(loan.id) || [];
                const hasNewerRenewal = renewals.some((renewal: any) => {
                  return new Date(renewal.signDate) <= date;
                });
                
                if (hasNewerRenewal) {
                  if (debugForAtasta) {
                    console.log(`    ❌ PUNTO 3: Préstamo ${loan.id} ya renovado antes de la fecha`);
                  }
                  return false;
                }
              }

              // ✅ PUNTO 3: Si para la semana de revisión ya se pagó por completo, entonces no se contempla
              // ✅ OPTIMIZACIÓN: Usar datos pre-calculados
              const totalDebt = loan._calculated?.totalDebt || (Number(loan.amountGived || 0) + Number(loan.profitAmount || 0));
              
              // Calcular el total pagado hasta la fecha de referencia
              let totalPaid = 0;
              for (const payment of loan.payments || []) {
                const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                if (paymentDate <= date) {
                  totalPaid += parseFloat((payment.amount || 0).toString());
                }
              }
              
              // Calcular el monto pendiente real
              const realPendingAmount = Math.max(0, totalDebt - totalPaid);
              
              if (debugForAtasta) {
                console.log(`    💰 PUNTO 4: Préstamo ${loan.id} - Total deuda: ${totalDebt}, Total pagado: ${totalPaid}, Pendiente: ${realPendingAmount}`);
              }
              
              // Solo está activo si tiene monto pendiente real > 0
              const isActive = realPendingAmount > 0;
              if (debugForAtasta) {
                console.log(`    ${isActive ? '✅' : '❌'} RESULTADO: Préstamo ${loan.id} ${isActive ? 'ACTIVO' : 'NO ACTIVO'}`);
              }
              return isActive;
            };

            // ✅ OPTIMIZACIÓN: Procesar datos por semana de manera más eficiente
            const reportData: { [week: string]: { [locality: string]: any } } = {};

            // ✅ OPTIMIZACIÓN: Pre-procesar préstamos por localidad y fechas
            const loansByLocality = new Map();
            const loansBySignDate = new Map();
            const loansByFinishedDate = new Map();
            const loansByCleanupDate = new Map();

            preCalculatedLoans.forEach(loan => {
              const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                              loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                              'Sin localidad';
              
              if (!loansByLocality.has(locality)) {
                loansByLocality.set(locality, []);
              }
              loansByLocality.get(locality).push(loan);

              // Indexar por fechas para acceso rápido
              const signDate = new Date(loan.signDate).toISOString().split('T')[0];
              if (!loansBySignDate.has(signDate)) {
                loansBySignDate.set(signDate, []);
              }
              loansBySignDate.get(signDate).push(loan);

              if (loan.finishedDate) {
                const finishedDate = new Date(loan.finishedDate).toISOString().split('T')[0];
                if (!loansByFinishedDate.has(finishedDate)) {
                  loansByFinishedDate.set(finishedDate, []);
                }
                loansByFinishedDate.get(finishedDate).push(loan);
              }

              if (loan.excludedByCleanup?.cleanupDate) {
                const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate).toISOString().split('T')[0];
                if (!loansByCleanupDate.has(cleanupDate)) {
                  loansByCleanupDate.set(cleanupDate, []);
                }
                loansByCleanupDate.get(cleanupDate).push(loan);
              }
            });

            // Track previous week's activeAtEnd for each locality
            const previousWeekActiveAtEnd: { [locality: string]: number } = {};

            for (const weekKey of weekOrder) {
              const { start: weekStart, end: weekEnd } = weeks[weekKey];
              reportData[weekKey] = {};

              // 🔍 DEBUG: Log general para todas las semanas
              // console.log(`\n📅 PROCESANDO SEMANA: ${weekKey} - RouteId: ${routeId}`);
              // console.log(`  - Fechas: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);

              // Agrupar por localidad
              const localitiesData: { [locality: string]: any } = {};
              const isFirstWeek = weekKey === weekOrder[0];

              // 🔍 DEBUG: Log específico para semana 3 de Atasta
              const isAtastaWeek3 = weekKey === 'SEMANA 3';
              
              // 🔍 DEBUG: Log específico para María Dolores en Isla Aguada semana 4
              const isIslaAguadaWeek4 = weekKey === 'SEMANA 4';
              
              // Helper function para verificar si una localidad es de Atasta
              const isAtastaLocality = (locality: string) => {
                return locality && typeof locality === 'string' && locality.toLowerCase().includes('atasta');
              };
              
              // Helper function para verificar si una localidad es de Isla Aguada
              const isIslaAguadaLocality = (locality: string) => {
                return locality && typeof locality === 'string' && locality.toLowerCase().includes('isla aguada');
              };
              
              // 🔍 DEBUG: Contadores para rastrear el flujo de Atasta
              let atastaFinishedCount = 0;
              let atastaRenewedNotFinishedCount = 0;
              let atastaRenewedFinishedCount = 0;
              
              // 🔍 DEBUG: Verificar condición para semana 3
              if (weekKey === 'SEMANA 3') {
                console.log(`\n🔍 VERIFICANDO SEMANA 3:`);
                console.log(`  - weekKey: ${weekKey}`);
                console.log(`  - routeId: ${routeId}`);
                console.log(`  - isAtastaWeek3: ${isAtastaWeek3}`);
              }
              
              if (isAtastaWeek3) {
                console.log(`\n🔍 DEBUG SEMANA 3 ATASTA:`);
                console.log(`  - Semana: ${weekKey}`);
                console.log(`  - Fechas: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                console.log(`  - RouteId: ${routeId}`);
                console.log(`  - ¿Es primera semana?: ${isFirstWeek}`);
                console.log(`  - Condición cumplida: weekKey=${weekKey}`);
                
                // 🔍 DEBUG: Mostrar todas las localidades disponibles
                console.log(`\n🔍 LOCALIDADES DISPONIBLES EN ESTA RUTA:`);
                Object.keys(loansByLocality).forEach(locality => {
                  const loans = loansByLocality.get(locality);
                  console.log(`  - Localidad: "${locality}" (tipo: ${typeof locality})`);
                  console.log(`    - Préstamos: ${loans.length}`);
                  console.log(`    - lowercase: "${locality?.toLowerCase()}"`);
                  console.log(`    - includes('atasta'): ${locality?.toLowerCase()?.includes('atasta')}`);
                  if (isAtastaLocality(locality)) {
                    console.log(`    ✅ CONTIENE 'atasta'`);
                  }
                });
              }

              // ✅ RESTAURAR CONTINUIDAD: Para semanas que no son la primera, usar activeAtEnd de la semana anterior
              if (!isFirstWeek) {
                // Obtener todas las localidades que tuvieron actividad en la semana anterior
                const previousWeekKey = weekOrder[weekOrder.indexOf(weekKey) - 1];
                const previousWeekData = reportData[previousWeekKey];
                
                if (previousWeekData) {
                  Object.keys(previousWeekData).forEach(locality => {
                    if (!localitiesData[locality]) {
                      localitiesData[locality] = {
                        activeAtStart: 0,
                        activeAtEnd: 0,
                        granted: 0,
                        grantedNew: 0,
                        grantedRenewed: 0,
                        grantedReintegros: 0,
                        grantedLoans: [],
                        grantedLoansNew: [],
                        grantedLoansRenewed: [],
                        grantedLoansReintegros: [],
                        finished: 0,
                        finishedNotRenewed: 0,
                        finishedForUI: 0,
                        finishedLoans: [],
                        cvClients: [],
                        cv: 0,
                        totalAmountAtStart: 0,
                        totalAmountAtEnd: 0,
                        grantedAmount: 0,
                        finishedAmount: 0,
                        finishedNotRenewedAmount: 0,
                        cvAmount: 0
                      };
                    }
                    // ✅ CONTINUIDAD: El inicio de esta semana = fin de la semana anterior
                    localitiesData[locality].activeAtStart = previousWeekData[locality].activeAtEnd || 0;
                  });
                }
              }

              // ✅ OPTIMIZACIÓN: Procesar préstamos por localidad en lugar de todos los préstamos
              for (const [locality, loans] of loansByLocality) {
                if (!localitiesData[locality]) {
                  localitiesData[locality] = {
                    activeAtStart: 0,
                    activeAtEnd: 0,
                    granted: 0,
                    grantedNew: 0,
                    grantedRenewed: 0,
                    grantedReintegros: 0,
                    grantedLoans: [],
                    grantedLoansNew: [],
                    grantedLoansRenewed: [],
                    grantedLoansReintegros: [],
                    finished: 0,
                    finishedNotRenewed: 0,
                    finishedForUI: 0,
                    finishedLoans: [],
                    cvClients: [],
                    cv: 0,
                    totalAmountAtStart: 0,
                    totalAmountAtEnd: 0,
                    grantedAmount: 0,
                    finishedAmount: 0,
                    finishedNotRenewedAmount: 0,
                    cvAmount: 0
                  };
                }
                
                // 🔍 DEBUG: Log específico para semana 3 de Atasta - TODOS los préstamos de la localidad
                if (isAtastaWeek3 && isAtastaLocality(locality)) {
                  console.log(`\n  📋 PROCESANDO LOCALIDAD: ${locality}`);
                  console.log(`    - Total préstamos en localidad: ${loans.length}`);
                  const loansInWeek = loans.filter((loan: any) => {
                    const signDate = new Date(loan.signDate);
                    return signDate >= weekStart && signDate <= weekEnd;
                  });
                  console.log(`    - Préstamos otorgados en esta semana: ${loansInWeek.length}`);
                  
                  const loansFinishedInWeek = loans.filter((loan: any) => {
                    if (!loan.finishedDate) return false;
                    const finishedDate = new Date(loan.finishedDate);
                    return finishedDate >= weekStart && finishedDate <= weekEnd;
                  });
                  console.log(`    - Préstamos finalizados en esta semana: ${loansFinishedInWeek.length}`);
                  
                  const loansCleanupInWeek = loans.filter((loan: any) => {
                    if (!loan.excludedByCleanup?.cleanupDate) return false;
                    const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate);
                    return cleanupDate >= weekStart && cleanupDate <= weekEnd;
                  });
                  console.log(`    - Préstamos finalizados por CLEANUP en esta semana: ${loansCleanupInWeek.length}`);
                }

                const data = localitiesData[locality];

                // Procesar cada préstamo de esta localidad
                loans.forEach((loan: any) => {
                  const loanAmount = Number(loan.amountGived || 0);
                  
                  // 🔍 DEBUG: Log específico para María Dolores en Isla Aguada semana 4
                  if (isIslaAguadaWeek4 && isIslaAguadaLocality(locality)) {
                    const fullName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A';
                    if (fullName.toLowerCase().includes('maria dolores') || loan.id === 'cmfc9o0em3t0npszx4p5bwt01') {
                      console.log(`\n🔍 MARÍA DOLORES DEBUG - ISLA AGUADA SEMANA 4:`);
                      console.log(`  - Préstamo ID: ${loan.id}`);
                      console.log(`  - Nombre: ${fullName}`);
                      console.log(`  - Localidad: ${locality}`);
                      console.log(`  - Fecha firma: ${loan.signDate}`);
                      console.log(`  - Fecha finalización: ${loan.finishedDate || 'NO FINALIZADO'}`);
                      console.log(`  - Monto otorgado: ${loanAmount}`);
                      console.log(`  - Monto pendiente almacenado: ${loan.pendingAmountStored}`);
                      console.log(`  - ¿Excluido por cleanup?: ${loan.excludedByCleanup ? 'SÍ' : 'NO'}`);
                      console.log(`  - ¿Tiene préstamo anterior?: ${!!loan.previousLoanId}`);
                      console.log(`  - Semana actual: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                      
                      // Calcular deuda pendiente real
                      const totalDebt = loan._calculated?.totalDebt || (Number(loan.amountGived || 0) + Number(loan.profitAmount || 0));
                      let totalPaid = 0;
                      for (const payment of loan.payments || []) {
                        const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                        if (paymentDate <= weekEnd) {
                          totalPaid += parseFloat((payment.amount || 0).toString());
                        }
                      }
                      const realPendingAmount = Math.max(0, totalDebt - totalPaid);
                      
                      console.log(`  - Total deuda: ${totalDebt}`);
                      console.log(`  - Total pagado hasta fin de semana: ${totalPaid}`);
                      console.log(`  - Deuda pendiente real: ${realPendingAmount}`);
                      console.log(`  - ¿Está activo al inicio de semana?: ${isLoanConsideredOnDate(loan, new Date(weekStart.getTime() - 1))}`);
                      console.log(`  - ¿Está activo al final de semana?: ${isLoanConsideredOnDate(loan, weekEnd)}`);
                      
                      // Mostrar pagos
                      console.log(`  - Pagos del préstamo:`);
                      (loan.payments || []).forEach((payment: any, index: number) => {
                        const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                        console.log(`    ${index + 1}. ${payment.amount} - ${paymentDate.toISOString()}`);
                      });
                    }
                  }

                  // ✅ SOLO PARA LA PRIMERA SEMANA: Calcular préstamos activos al inicio
                  if (isFirstWeek) {
                    const startReferenceDate = new Date(weekStart.getTime() - 1);
                    let activeAtStartCond = isLoanConsideredOnDate(loan, startReferenceDate);
                    // Neutralizar renovaciones dentro de la misma semana para el stock inicial
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
                    }
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
                    
                    // 🔍 DEBUG: Log específico para semana 3 de Atasta
                    if (isAtastaWeek3 && isAtastaLocality(locality)) {
                      console.log(`  - Préstamo otorgado: ${loan.id} (${loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A'})`);
                      console.log(`    - Fecha firma: ${signDate.toISOString()}`);
                      console.log(`    - Monto: ${loanAmount}`);
                      console.log(`    - ¿Tiene préstamo anterior?: ${!!loan.previousLoanId}`);
                    }
                    
                    if (loan.previousLoanId) {
                      // Verificar si es un reintegro (préstamo anterior ya estaba finalizado al inicio de la semana)
                      const previousLoan = loan.previousLoan;
                      let isReintegro = false;
                      
                      if (previousLoan) {
                        // 🔍 DEBUG: Log detallado para Atasta
                        const fullName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A';
                        const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                                        loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                                        'Sin localidad';
                        
                        // 🔍 DEBUG: Log específico para semana 3 de Atasta
                        if (isAtastaWeek3 && isAtastaLocality(locality)) {
                          console.log(`  - ANÁLISIS REINTEGRO/RENOVADO para ${loan.id} (${fullName}):`);
                          console.log(`    - Fecha firma nuevo préstamo: ${new Date(loan.signDate).toISOString()}`);
                          console.log(`    - Fecha finalización préstamo anterior: ${previousLoan.finishedDate ? new Date(previousLoan.finishedDate).toISOString() : 'NO FINALIZADO'}`);
                          console.log(`    - Semana actual: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                        }
                        
                        // 🔍 DEBUG ESPECÍFICO: Para los 3 reintegros problemáticos en Atasta semana 1
                        const isAtastaWeek1Debug = locality.toLowerCase().includes('atasta') && 
                          weekStart.getTime() === new Date('2025-08-04T06:00:00.000Z').getTime();
                        
                        if (isAtastaWeek1Debug) {
                          const isProblematicLoan = fullName.includes('LEYDI DEL CARMEN CRUZ DOMINGUEZ') || 
                                                   fullName.includes('MELBA CHUINA POLANCO SARAO') || 
                                                   fullName.includes('ALBA MARINA HERNANDEZ TACU');
                          
                          if (isProblematicLoan) {
                            console.log(`\n🔍 ANÁLISIS REINTEGRO/RENOVADO PROBLEMÁTICO - ATASTA SEMANA 1:`);
                            console.log(`  - Préstamo ID: ${loan.id}`);
                            console.log(`  - Nombre: ${fullName}`);
                            console.log(`  - Fecha firma nuevo préstamo: ${new Date(loan.signDate).toISOString()}`);
                            console.log(`  - Fecha finalización préstamo anterior: ${previousLoan.finishedDate ? new Date(previousLoan.finishedDate).toISOString() : 'NO FINALIZADO'}`);
                            console.log(`  - Semana actual: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                            console.log(`  - previousLoanId: ${loan.previousLoanId}`);
                            console.log(`  - amountGived: ${loan.amountGived}`);
                          }
                        }
                        
                        // 🔍 LÓGICA CORREGIDA PARA REINTEGROS
                        // Un reintegro es cuando el préstamo anterior ya estaba finalizado ANTES del inicio de la semana
                        // Un renovado es cuando el préstamo anterior se finaliza DURANTE la misma semana que se firma el nuevo
                        
                        if (previousLoan.finishedDate) {
                          const finishedDate = new Date(previousLoan.finishedDate);
                          const signDate = new Date(loan.signDate);
                          
                          // ✅ CRITERIO CORREGIDO: 
                          // - REINTEGRO: Préstamo anterior finalizado ANTES del inicio de la semana
                          // - RENOVADO: Préstamo anterior finalizado DURANTE la semana (mismo día o después del inicio de semana)
                          if (finishedDate < weekStart) {
                            isReintegro = true;
                            if (isAtastaWeek3 && isAtastaLocality(locality)) {
                              console.log(`  ✅ REINTEGRO: Préstamo anterior finalizado ANTES del inicio de semana (${finishedDate.toISOString()} < ${weekStart.toISOString()})`);
                            }
                            
                            // 🔍 DEBUG ESPECÍFICO: Para los 3 reintegros problemáticos en Atasta semana 1
                            if (isAtastaWeek1Debug) {
                              const isProblematicLoan = fullName.includes('LEYDI DEL CARMEN CRUZ DOMINGUEZ') || 
                                                       fullName.includes('MELBA CHUINA POLANCO SARAO') || 
                                                       fullName.includes('ALBA MARINA HERNANDEZ TACU');
                              
                              if (isProblematicLoan) {
                                console.log(`  ✅ REINTEGRO PROBLEMÁTICO: Préstamo anterior finalizado ANTES del inicio de semana (${finishedDate.toISOString()} < ${weekStart.toISOString()})`);
                                console.log(`    - ✅ CLASIFICADO como REINTEGRO`);
                                console.log(`    - 🔄 REINTEGRO de crédito que ya estaba cerrado`);
                                console.log(`    - 📊 CONTADOR: Reintegros = ${data.grantedReintegros + 1}`);
                                console.log(`    - 📊 BALANCE AJUSTADO: +1`);
                              }
                            }
                            
                            // 🔍 DEBUG ESPECÍFICO: Para los 3 reintegros problemáticos en Atasta semana 1
                            if (isAtastaWeek1Debug) {
                              const isProblematicLoan = fullName.includes('LEYDI DEL CARMEN CRUZ DOMINGUEZ') || 
                                                       fullName.includes('MELBA CHUINA POLANCO SARAO') || 
                                                       fullName.includes('ALBA MARINA HERNANDEZ TACU');
                              
                              if (isProblematicLoan) {
                                console.log(`\n🔍 REINTEGRO PROBLEMÁTICO - ATASTA SEMANA 1:`);
                                console.log(`  - Préstamo ID: ${loan.id}`);
                                console.log(`  - Nombre: ${fullName}`);
                                console.log(`  - Fecha finalización préstamo anterior: ${finishedDate.toISOString()}`);
                                console.log(`  - Inicio de semana: ${weekStart.toISOString()}`);
                                console.log(`  - ¿Es reintegro?: ${isReintegro}`);
                                console.log(`  - ✅ CLASIFICADO como REINTEGRO`);
                              }
                            }
                          } else {
                            // Verificar si el préstamo anterior se finalizó en la misma semana que se firmó el nuevo
                            if (finishedDate >= weekStart && finishedDate <= weekEnd) {
                              // Es una renovación en la misma semana
                              isReintegro = false;
                              if (isAtastaWeek3 && isAtastaLocality(locality)) {
                                console.log(`  ❌ RENOVADO: Préstamo anterior finalizado DURANTE la semana (${finishedDate.toISOString()} entre ${weekStart.toISOString()} y ${weekEnd.toISOString()})`);
                              }
                              
                              // 🔍 DEBUG ESPECÍFICO: Para los 3 reintegros problemáticos en Atasta semana 1
                              if (isAtastaWeek1Debug) {
                                const isProblematicLoan = fullName.includes('LEYDI DEL CARMEN CRUZ DOMINGUEZ') || 
                                                         fullName.includes('MELBA CHUINA POLANCO SARAO') || 
                                                         fullName.includes('ALBA MARINA HERNANDEZ TACU');
                                
                                if (isProblematicLoan) {
                                  console.log(`\n🔍 RENOVADO PROBLEMÁTICO - ATASTA SEMANA 1:`);
                                  console.log(`  - Préstamo ID: ${loan.id}`);
                                  console.log(`  - Nombre: ${fullName}`);
                                  console.log(`  - Fecha finalización préstamo anterior: ${finishedDate.toISOString()}`);
                                  console.log(`  - Semana: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                                  console.log(`  - ¿Es renovado?: ${!isReintegro}`);
                                  console.log(`  - ❌ CLASIFICADO como RENOVADO`);
                                }
                              }
                            } else {
                              // Préstamo anterior finalizado después de la semana actual
                              isReintegro = false;
                              if (isAtastaWeek3 && isAtastaLocality(locality)) {
                                console.log(`  ❌ RENOVADO: Préstamo anterior finalizado DESPUÉS de la semana (${finishedDate.toISOString()} > ${weekEnd.toISOString()})`);
                              }
                            }
                          }
                        } else {
                          // Si no tiene finishedDate, es un RENOVADO (reemplaza un préstamo activo)
                            isReintegro = false;
                          
                            if (isAtastaWeek3 && isAtastaLocality(locality)) {
                            console.log(`  ❌ RENOVADO: Préstamo anterior NO FINALIZADO (reemplaza préstamo activo)`);
                          }
                          
                          // 🔍 DEBUG ESPECÍFICO: Para los 3 reintegros problemáticos en Atasta semana 1
                          if (isAtastaWeek1Debug) {
                            const isProblematicLoan = fullName.includes('LEYDI DEL CARMEN CRUZ DOMINGUEZ') || 
                                                     fullName.includes('MELBA CHUINA POLANCO SARAO') || 
                                                     fullName.includes('ALBA MARINA HERNANDEZ TACU');
                            
                            if (isProblematicLoan) {
                              console.log(`\n🔍 RENOVADO PROBLEMÁTICO - ATASTA SEMANA 1:`);
                              console.log(`  - Préstamo ID: ${loan.id}`);
                              console.log(`  - Nombre: ${fullName}`);
                              console.log(`  - Fecha finalización préstamo anterior: NO FINALIZADO`);
                              console.log(`  - ¿Es renovado?: ${!isReintegro}`);
                              console.log(`  - ❌ CLASIFICADO como RENOVADO (reemplaza préstamo activo)`);
                            }
                          }
                        }
                      }
                      
                      if (isReintegro) {
                        data.grantedReintegros++;
                        (data.grantedLoansReintegros as any[]).push({
                          id: loan.id,
                          date: signDate,
                          finishedDate: loan.finishedDate || null,
                          amountGived: Number(loan.amountGived || 0),
                          fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                          previousFinishedDate: loan.previousLoan?.finishedDate || null,
                          isReintegro: true
                        });
                        
                        // 🔍 DEBUG: Log específico para semana 3 de Atasta
                        if (isAtastaWeek3 && isAtastaLocality(locality)) {
                          console.log(`    - ✅ CLASIFICADO como REINTEGRO`);
                        }
                      } else {
                        data.grantedRenewed++;
                        (data.grantedLoansRenewed as any[]).push({
                          id: loan.id,
                          date: signDate,
                          finishedDate: loan.finishedDate || null,
                          amountGived: Number(loan.amountGived || 0),
                          fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                          previousFinishedDate: loan.previousLoan?.finishedDate || null,
                          isReintegro: false
                        });
                        
                        // 🔍 DEBUG: Log específico para semana 3 de Atasta
                        if (isAtastaWeek3 && isAtastaLocality(locality)) {
                          console.log(`    - ✅ CLASIFICADO como RENOVADO`);
                          
                          // Verificar si el préstamo anterior se finalizó en la misma semana
                          const previousFinishedDate = loan.previousLoan?.finishedDate;
                          if (previousFinishedDate) {
                            const prevFinished = new Date(previousFinishedDate);
                            const isPreviousFinishedInWeek = prevFinished >= weekStart && prevFinished <= weekEnd;
                            
                            if (isPreviousFinishedInWeek) {
                              // RENOVADO de un crédito que se cerró en la misma semana
                              atastaRenewedFinishedCount++;
                              console.log(`    - 🔄 RENOVADO de crédito que se cerró en la misma semana`);
                              console.log(`    - 📊 CONTADOR: Renovados de finalizados = ${atastaRenewedFinishedCount}`);
                              console.log(`    - 📊 BALANCE AJUSTADO: -${atastaFinishedCount} + ${atastaRenewedFinishedCount} = -${atastaFinishedCount - atastaRenewedFinishedCount}`);
                            } else {
                              // RENOVADO de un crédito que aún no finalizaba
                              atastaRenewedNotFinishedCount++;
                              console.log(`    - 🔄 RENOVADO de crédito que aún no finalizaba`);
                              console.log(`    - 📊 CONTADOR: Renovados no finalizados = ${atastaRenewedNotFinishedCount}`);
                              console.log(`    - 📊 BALANCE: Sin cambio (sigue -${atastaFinishedCount})`);
                            }
                          }
                        }
                      }
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
                      
                      // 🔍 DEBUG: Log específico para semana 3 de Atasta
                      if (isAtastaWeek3 && isAtastaLocality(locality)) {
                        console.log(`    - ✅ CLASIFICADO como NUEVO`);
                      }
                    }
                  }

                  // Préstamos finalizados durante la semana (por finishedDate)
                  // Solo contar como finalizados si NO fueron renovados por otro préstamo
                  if (loan.finishedDate) {
                    const finishedDate = new Date(loan.finishedDate);
                    const isWithinWeek = finishedDate >= weekStart && finishedDate <= weekEnd;
                    
                    // Definir fullName aquí para uso en todo el bloque
                    const fullName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A';
                    
                      // 🔍 DEBUG: Log específico para semana 3 de Atasta - TODOS los préstamos con finishedDate
                      if (isAtastaWeek3 && isAtastaLocality(locality)) {
                        console.log(`  - Préstamo con finishedDate: ${loan.id} (${fullName})`);
                        console.log(`    - Fecha finishedDate: ${finishedDate.toISOString()}`);
                        console.log(`    - ¿Dentro de semana?: ${isWithinWeek}`);
                        console.log(`    - Semana: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                        
                        // 🔍 DEBUG ESPECÍFICO: Buscar el préstamo con oldid 7415
                        if (loan.fullName === 'MARIA CONSEPCION TACU SANCHEZ') {
                          console.log(`\n🔍 PRÉSTAMO ESPECÍFICO OLDID 7415 ENCONTRADO:`);
                          console.log(`  - ID: ${loan.id}`);
                          console.log(`  - Nombre: ${fullName}`);
                          console.log(`  - Localidad: ${locality}`);
                          console.log(`  - Fecha finishedDate: ${finishedDate.toISOString()}`);
                          console.log(`  - Semana actual: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                          console.log(`  - ¿Dentro de semana?: ${isWithinWeek}`);
                          console.log(`  - ¿Es Atasta?: ${isAtastaLocality(locality)}`);
                          console.log(`  - ¿Es semana 3?: ${isAtastaWeek3}`);
                        }
                      }
                    
                    if (isWithinWeek) {
                      // Verificar si este préstamo fue renovado por otro préstamo
                      // CORRECCIÓN: Verificar si existe otro préstamo que tenga este como previousLoanId
                      // Y que la renovación haya ocurrido en o antes de la fecha de finalización
                      let wasRenewed = false;
                      
                      // 🔍 DEBUG ESPECÍFICO: Solo para préstamo cmfdfreqp3ugkpst2zrqiy2ko en Atasta semana 1
                      const isTargetLoan = loan.id === 'cmfdfreqp3ugkpst2zrqiy2ko';
                      const isAtastaWeek1 = locality.toLowerCase().includes('atasta') && 
                        weekStart.getTime() === new Date('2025-08-04T06:00:00.000Z').getTime();
                      
                      if (isTargetLoan && isAtastaWeek1) {
                        console.log(`\n🔍 PRÉSTAMO cmfdfreqp3ugkpst2zrqiy2ko - ATASTA SEMANA 1:`);
                        console.log(`  - Préstamo ID: ${loan.id}`);
                        console.log(`  - Nombre: ${loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A'}`);
                        console.log(`  - Fecha finishedDate: ${finishedDate.toISOString()}`);
                        console.log(`  - Fecha semana: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                        console.log(`  - ¿Dentro de semana?: ${isWithinWeek}`);
                        console.log(`  - ¿Tiene renovaciones en renewalMap?: ${renewalMap.has(loan.id)}`);
                        console.log(`  - previousLoanId: ${loan.previousLoanId}`);
                        console.log(`  - signDate: ${loan.signDate.toISOString()}`);
                        console.log(`  - amountGived: ${loan.amountGived}`);
                        console.log(`  - profitAmount: ${loan.profitAmount}`);
                        console.log(`  - borrower ID: ${loan.borrower?.id}`);
                        console.log(`  - lead ID: ${loan.lead?.id}`);
                      }
                      
                      // 🔍 DEBUG ESPECÍFICO: Para los 3 reintegros problemáticos en Atasta semana 1
                      const isAtastaWeek1Debug = locality.toLowerCase().includes('atasta') && 
                        weekStart.getTime() === new Date('2025-08-04T06:00:00.000Z').getTime();
                      
                      if (isAtastaWeek1Debug) {
                        const loanName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A';
                        const isProblematicLoan = loanName.includes('LEYDI DEL CARMEN CRUZ DOMINGUEZ') || 
                                                 loanName.includes('MELBA CHUINA POLANCO SARAO') || 
                                                 loanName.includes('ALBA MARINA HERNANDEZ TACU');
                        
                        if (isProblematicLoan) {
                          console.log(`\n🔍 REINTEGRO PROBLEMÁTICO - ATASTA SEMANA 1:`);
                          console.log(`  - Préstamo ID: ${loan.id}`);
                          console.log(`  - Nombre: ${loanName}`);
                          console.log(`  - Fecha finishedDate: ${finishedDate.toISOString()}`);
                          console.log(`  - Fecha semana: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                          console.log(`  - ¿Dentro de semana?: ${isWithinWeek}`);
                          console.log(`  - ¿Tiene renovaciones en renewalMap?: ${renewalMap.has(loan.id)}`);
                          console.log(`  - previousLoanId: ${loan.previousLoanId}`);
                          console.log(`  - signDate: ${loan.signDate.toISOString()}`);
                          console.log(`  - amountGived: ${loan.amountGived}`);
                          console.log(`  - profitAmount: ${loan.profitAmount}`);
                          console.log(`  - borrower ID: ${loan.borrower?.id}`);
                          console.log(`  - lead ID: ${loan.lead?.id}`);
                        }
                      }
                      
                      if (renewalMap.has(loan.id)) {
                        const renewals = renewalMap.get(loan.id) || [];
                        
                        if (isTargetLoan && isAtastaWeek1) {
                          console.log(`  - Renovaciones encontradas: ${renewals.length}`);
                          renewals.forEach((renewal: any, index: number) => {
                            console.log(`    - Renovación ${index + 1}: ID ${renewal.id}, Fecha: ${renewal.signDate}`);
                            console.log(`    - Fecha renovación: ${new Date(renewal.signDate).toISOString()}`);
                            console.log(`    - Fecha finishedDate: ${finishedDate.toISOString()}`);
                            console.log(`    - ¿Renovación antes de finalización?: ${new Date(renewal.signDate) <= finishedDate}`);
                          });
                        }
                        
                        if (isAtastaWeek1Debug) {
                          const loanName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A';
                          const isProblematicLoan = loanName.includes('LEYDI DEL CARMEN CRUZ DOMINGUEZ') || 
                                                   loanName.includes('MELBA CHUINA POLANCO SARAO') || 
                                                   loanName.includes('ALBA MARINA HERNANDEZ TACU');
                          
                          if (isProblematicLoan) {
                            console.log(`  - Renovaciones encontradas: ${renewals.length}`);
                            renewals.forEach((renewal: any, index: number) => {
                              console.log(`    - Renovación ${index + 1}: ID ${renewal.id}, Fecha: ${renewal.signDate}`);
                              console.log(`    - Fecha renovación: ${new Date(renewal.signDate).toISOString()}`);
                              console.log(`    - Fecha finishedDate: ${finishedDate.toISOString()}`);
                              console.log(`    - ¿Renovación antes de finalización?: ${new Date(renewal.signDate) <= finishedDate}`);
                            });
                          }
                        }
                        
                        // Verificar si alguna renovación ocurrió en o antes de la fecha de finalización
                        wasRenewed = renewals.some((renewal: any) => {
                          const renewalDate = new Date(renewal.signDate);
                          const isRenewalBeforeFinish = renewalDate <= finishedDate;
                          
                          if (isTargetLoan && isAtastaWeek1) {
                            console.log(`    - Renovación ${renewal.id}: Fecha ${renewal.signDate}, ¿Antes de finalización?: ${isRenewalBeforeFinish}`);
                          }
                          
                          return isRenewalBeforeFinish;
                        });
                        
                        if (isTargetLoan && isAtastaWeek1) {
                          console.log(`  - ¿Fue renovado antes de finalizar?: ${wasRenewed}`);
                          console.log(`  - RAZÓN: ${wasRenewed ? 'RENOVADO - Debería ser reingreso' : 'NO RENOVADO - Debería ser finalizado'}`);
                        }
                      }
                      
                      // 🔍 DEBUG: Log detallado para entender el problema
                      if (renewalMap.has(loan.id)) {
                        const renewals = renewalMap.get(loan.id) || [];
                        console.log(`🔍 PRÉSTAMO CON RENOVACIONES:`);
                        console.log(`  - Préstamo ID: ${loan.id}`);
                        console.log(`  - Nombre: ${fullName}`);
                        console.log(`  - Fecha finalización: ${finishedDate.toISOString()}`);
                        console.log(`  - Renovaciones encontradas: ${renewals.length}`);
                        renewals.forEach((renewal: any, index: number) => {
                          const renewalDate = new Date(renewal.signDate);
                          const isRenewalBeforeFinish = renewalDate <= finishedDate;
                          console.log(`    - Renovación ${index + 1}: ID ${renewal.id}, Fecha: ${renewal.signDate}, ¿Antes de finalización?: ${isRenewalBeforeFinish}`);
                        });
                        console.log(`  - ¿Fue renovado antes de finalizar?: ${wasRenewed}`);
                      }
                      
                      // Definir locality para uso en logs (fullName ya está definido arriba)
                      const loanLocality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                                      loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                                      'Sin localidad';
                      
                      // 🔍 DEBUG: Solo para CELENE DZUL CHABLE de Xbacab
                      
                      if (loanLocality.toLowerCase().includes('xbacab') && fullName.toLowerCase().includes('celene')) {
                        console.log(`🔍 DEBUG CELENE DZUL CHABLE - XBACAB:`);
                        console.log(`  - Préstamo ID: ${loan.id}`);
                        console.log(`  - Fecha finalización: ${finishedDate.toISOString()}`);
                        console.log(`  - Semana: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                        console.log(`  - ¿Dentro de semana?: ${isWithinWeek}`);
                        console.log(`  - ¿Fue renovado?: ${wasRenewed}`);
                        
                        // Calcular deuda pendiente real
                        const totalDebt = loan._calculated?.totalDebt || (Number(loan.amountGived || 0) + Number(loan.profitAmount || 0));
                        let totalPaid = 0;
                        for (const payment of loan.payments || []) {
                          const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                          if (paymentDate <= finishedDate) {
                            totalPaid += parseFloat((payment.amount || 0).toString());
                          }
                        }
                        const realPendingAmount = Math.max(0, totalDebt - totalPaid);
                        
                        console.log(`  - Total deuda: ${totalDebt}`);
                        console.log(`  - Total pagado: ${totalPaid}`);
                        console.log(`  - Deuda pendiente: ${realPendingAmount}`);
                        console.log(`  - ¿Realmente finalizado?: ${realPendingAmount === 0}`);
                      }
                      
                      // ✅ NUEVA LÓGICA: Contar TODOS los préstamos con finishedDate como finalizados
                      // independientemente de si fueron renovados o no
                      if (true) {
                        // ✅ VALIDAR DEUDA PENDIENTE REAL: Solo marcar como finalizado si realmente no tiene deuda
                        const totalDebt = loan._calculated?.totalDebt || (Number(loan.amountGived || 0) + Number(loan.profitAmount || 0));
                        let totalPaid = 0;
                        for (const payment of loan.payments || []) {
                          const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                          if (paymentDate <= finishedDate) {
                            totalPaid += parseFloat((payment.amount || 0).toString());
                          }
                        }
                        const realPendingAmount = Math.max(0, totalDebt - totalPaid);
                        
                        // 🔍 DEBUG: Log específico para semana 3 de Atasta
                        if (isAtastaWeek3 && isAtastaLocality(locality)) {
                          console.log(`  - Préstamo finalizado: ${loan.id} (${fullName})`);
                          console.log(`    - Fecha finishedDate: ${finishedDate.toISOString()}`);
                          console.log(`    - Total deuda: ${totalDebt}`);
                          console.log(`    - Total pagado: ${totalPaid}`);
                          console.log(`    - Deuda pendiente: ${realPendingAmount}`);
                          console.log(`    - ¿Fue renovado?: ${wasRenewed}`);
                          console.log(`    - ¿Dentro de semana?: ${isWithinWeek}`);
                        }
                        
                        // SOLUCIÓN HÍBRIDA: Dos contadores separados
                        // 1. finishedInternal: Para cálculos internos (incluye renovados)
                        // 2. finishedUI: Para mostrar en UI (excluye renovados)
                        
                        // Siempre contar para cálculos internos (balance de activos)
                          data.finished++;
                          data.finishedAmount += loanAmount;
                        
                        // Solo contar para UI si NO fue renovado
                        if (!wasRenewed) {
                          data.finishedNotRenewed++;
                          data.finishedNotRenewedAmount += loanAmount;
                        }
                        
                        if (isTargetLoan && isAtastaWeek1) {
                          console.log(`\n🔍 cmfdfreqp3ugkpst2zrqiy2ko - PRÉSTAMO FINALIZADO:`);
                          console.log(`  - ID: ${loan.id}`);
                          console.log(`  - Nombre: ${loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A'}`);
                          console.log(`  - Fecha finishedDate: ${finishedDate.toISOString()}`);
                          console.log(`  - ¿Fue renovado?: ${wasRenewed}`);
                          console.log(`  - Total deuda: ${totalDebt}`);
                          console.log(`  - Total pagado: ${totalPaid}`);
                          console.log(`  - Deuda pendiente: ${totalDebt - totalPaid}`);
                          console.log(`  - ¿Deuda pendiente = 0?: ${totalDebt - totalPaid === 0}`);
                          console.log(`  - CONTADOR ANTES: ${data.finished - 1}`);
                          console.log(`  - CONTADOR DESPUÉS: ${data.finished}`);
                          console.log(`  - LISTA ANTES: ${(data.finishedLoans as any[]).length}`);
                        }
                        
                        // Solo agregar a la lista de UI si NO fue renovado
                        if (!wasRenewed) {
                          data.finishedNotRenewed++;
                          data.finishedNotRenewedAmount += loanAmount;
                          data.finishedForUI++;
                          
                          (data.finishedLoans as any[]).push({
                            id: loan.id,
                            finishedDate,
                            startDate: loan.signDate,
                            amountGived: Number(loan.amountGived || 0),
                            fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                            reason: 'FINISHED_DATE'
                          });
                        }
                        
                        if (isTargetLoan && isAtastaWeek1) {
                          console.log(`  - LISTA DESPUÉS: ${(data.finishedLoans as any[]).length}`);
                          console.log(`  - RAZÓN: ${wasRenewed ? 'FINISHED_DATE_RENEWED' : 'FINISHED_DATE'}`);
                          console.log(`  - ✅ AGREGADO A LISTA`);
                          console.log(`  - 📊 CONTADOR FINAL: ${data.finished}`);
                          console.log(`  - 📊 MONTO FINAL: ${data.finishedAmount}`);
                          console.log(`  - 📊 ¿ESTO DEBERÍA SER REINGRESO?: ${loan.previousLoanId ? 'SÍ, tiene previousLoanId' : 'NO, no tiene previousLoanId'}`);
                        }
                          
                          // 🔍 DEBUG: Log específico para semana 3 de Atasta
                          if (isAtastaWeek3 && isAtastaLocality(locality)) {
                            atastaFinishedCount++;
                          console.log(`    - ✅ CONTADO como finalizado${wasRenewed ? ' (RENOVADO - marcado en UI)' : ' (NO RENOVADO - visible en UI)'}`);
                            console.log(`    - 📊 CONTADOR: Créditos finalizados = ${atastaFinishedCount}`);
                            console.log(`    - 📊 BALANCE ACTUAL: -${atastaFinishedCount}`);
                            
                            // 🔍 DEBUG ESPECÍFICO: Log adicional para oldid 7415
                            if (loan.id === '7415') {
                              console.log(`\n🔍 OLDID 7415 - PROCESADO COMO FINALIZADO:`);
                              console.log(`  - ID: ${loan.id}`);
                              console.log(`  - ¿Fue renovado?: ${wasRenewed}`);
                              console.log(`  - Total deuda: ${totalDebt}`);
                              console.log(`  - Total pagado: ${totalPaid}`);
                              console.log(`  - Deuda pendiente: ${totalDebt - totalPaid}`);
                              console.log(`  - ¿Deuda pendiente = 0?: ${totalDebt - totalPaid === 0}`);
                            }
                          }
                          
                          // 🔍 DEBUG: Solo para CELENE DZUL CHABLE de Xbacab
                          if (locality.toLowerCase().includes('xbacab') && fullName.toLowerCase().includes('celene')) {
                            console.log(`⚠️ CELENE DZUL CHABLE NO FINALIZADO - XBACAB:`);
                            console.log(`  - Préstamo ID: ${loan.id}`);
                            console.log(`  - Fecha finishedDate: ${finishedDate.toISOString()}`);
                            console.log(`  - Total deuda: ${totalDebt}`);
                            console.log(`  - Total pagado: ${totalPaid}`);
                            console.log(`  - Deuda pendiente: ${realPendingAmount}`);
                            console.log(`  - ❌ NO se marca como finalizado (tiene deuda pendiente)`);
                        }
                      }
                    }
                  }

                  // Efecto de PortfolioCleanup durante la semana: tratarlo como salida de cartera
                  if (loan.excludedByCleanup?.cleanupDate) {
                    const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate as any);
                    const isCleanupInWeek = cleanupDate >= weekStart && cleanupDate <= weekEnd;
                    
                    // 🔍 DEBUG: Log específico para semana 3 de Atasta - TODOS los préstamos con cleanup
                    if (isAtastaWeek3 && isAtastaLocality(locality)) {
                      console.log(`  - Préstamo con cleanup: ${loan.id} (${loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A'})`);
                      console.log(`    - Fecha cleanup: ${cleanupDate.toISOString()}`);
                      console.log(`    - ¿Dentro de semana?: ${isCleanupInWeek}`);
                      console.log(`    - Semana: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);
                    }
                    
                    if (isCleanupInWeek) {
                      data.finished++;
                      data.finishedAmount += loanAmount;
                      
                      // Verificar si fue renovado antes del cleanup
                      const wasRenewed = renewalMap.has(loan.id);
                      
                      if (!wasRenewed) {
                        data.finishedNotRenewed++;
                        data.finishedNotRenewedAmount += loanAmount;
                        data.finishedForUI++;
                      (data.finishedLoans as any[]).push({
                        id: loan.id,
                        finishedDate: cleanupDate,
                        startDate: loan.signDate,
                        amountGived: Number(loan.amountGived || 0),
                        fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                        reason: 'PORTFOLIO_CLEANUP'
                      });
                      }
                      
                      // 🔍 DEBUG: Log específico para semana 3 de Atasta
                      if (isAtastaWeek3 && isAtastaLocality(locality)) {
                        console.log(`    - ✅ CONTADO como finalizado por CLEANUP`);
                      }
                    }
                  }
                });
              }

              // ✅ OPTIMIZACIÓN: Calcular CV de manera más eficiente usando datos pre-calculados
              for (const [locality, loans] of loansByLocality) {
                const data = localitiesData[locality];
                if (!data) continue;

                loans.forEach((loan: any) => {
                  // Solo procesar si el préstamo está activo durante la semana
                  const isActiveInWeek = isLoanConsideredOnDate(loan, weekStart) || isLoanConsideredOnDate(loan, weekEnd);
                  if (!isActiveInWeek) return;

                  // Excluir préstamos firmados en esta semana
                  const signDate = new Date(loan.signDate);
                  if (signDate >= weekStart && signDate <= weekEnd) {
                    // 🔍 DEBUG: Log específico para crédito cmfdjecea3u1bpsjv0xf8p1wp
                    if (loan.id === 'cmfdjecea3u1bpsjv0xf8p1wp' && 
                        typeof locality === 'string' && locality.toLowerCase().includes('chekubul')) {
                      console.log(`\n🔍 EXCLUSIÓN CV - CRÉDITO ${loan.id} - CHEKUBUL ${weekKey}:`);
                      console.log(`  - Fecha de firma: ${loan.signDate}`);
                      console.log(`  - Fecha inicio semana: ${weekStart.toISOString()}`);
                      console.log(`  - Fecha fin semana: ${weekEnd.toISOString()}`);
                      console.log(`  - ¿Fue otorgado en esta semana?: SÍ`);
                      console.log(`  - RAZÓN: Los créditos otorgados en la semana actual no se evalúan para CV`);
                      console.log(`  - RESULTADO: NO se marca como CV`);
                    }
                    return;
                  }

                  // ✅ OPTIMIZACIÓN: Usar datos pre-calculados
                  const expectedWeekly = loan._calculated?.expectedWeekly || (Number(loan.amountGived || 0) + Number(loan.profitAmount || 0)) / (loan.weekDuration || 16);

                  // Sumar pagos de la semana
                  let weeklyPaid = 0;
                  for (const payment of loan.payments || []) {
                    const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                    if (paymentDate >= weekStart && paymentDate <= weekEnd) {
                      weeklyPaid += Number(payment.amount || 0);
                    }
                  }

                  // ✅ OPTIMIZACIÓN: Calcular excedente previo usando semanas desde la FIRMA del préstamo
                  let paidBeforeWeek = 0;
                  for (const payment of loan.payments || []) {
                    const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                    if (paymentDate < weekStart) paidBeforeWeek += Number(payment.amount || 0);
                  }

                  // Calcular semanas transcurridas desde la firma
                  const sign = new Date(loan.signDate);
                  const signWeekStart = new Date(sign);
                  while (signWeekStart.getDay() !== 1) {
                    signWeekStart.setDate(signWeekStart.getDate() - 1);
                  }
                  signWeekStart.setHours(0, 0, 0, 0);
                  
                  const weeksSinceSign = Math.floor((weekStart.getTime() - signWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
                  // Usar semanas COMPLETADAS antes de la semana actual (alineado con cronología semanal)
                  const weeksElapsed = Math.max(0, weeksSinceSign - 1);

                  const expectedBefore = weeksElapsed > 0 ? weeksElapsed * (expectedWeekly || 0) : 0;
                  const surplusBefore = paidBeforeWeek - expectedBefore;

                  // Aplicar reglas de contribución (considerando excedente previo)
                  let cvContribution = 0;
                  let cvReason = '';
                  
                  if (weeklyPaid === 0) {
                    if (weeksElapsed === 0) {
                      // ✅ CORRECCIÓN PRECISA: Distinguir entre semana de otorgamiento y primera semana de pago
                      if (weeksSinceSign === 0) {
                        // Semana de otorgamiento: no se espera pago
                        cvContribution = 0;
                        cvReason = 'Semana de otorgamiento (no se espera pago)';
                      } else {
                        // Primera semana de pago: SÍ se espera pago
                        cvContribution = 1;
                        cvReason = 'Sin pago en primera semana';
                        data.cv += 1;
                        data.cvAmount += Number(loan.amountGived || 0);
                      }
                    } else {
                      if (surplusBefore >= (expectedWeekly || 0)) {
                        cvContribution = 0;
                        cvReason = 'Excedente previo';
                      } else {
                        cvContribution = 1;
                        cvReason = 'Sin pago';
                        data.cv += 1;
                        data.cvAmount += Number(loan.amountGived || 0);
                      }
                    }
                  } else if (expectedWeekly > 0) {
                    if (weeklyPaid >= expectedWeekly) {
                      cvContribution = 0;
                      cvReason = 'Pago completo';
                    } else if (surplusBefore >= expectedWeekly) {
                      cvContribution = 0;
                      cvReason = 'Excedente previo';
                    } else if (weeklyPaid < 0.5 * expectedWeekly) {
                      cvContribution = 1;
                      cvReason = 'Pago < 50%';
                      data.cv += 1;
                      data.cvAmount += Number(loan.amountGived || 0);
                    } else {
                      cvContribution = 0.5;
                      cvReason = 'Pago 50-100%';
                      data.cv += 0.5;
                    }
                  }

                  // 🔍 DEBUG: CV específico para María Dolores en Isla Aguada semana 4
                  try {
                    const fullName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || '';
                    if (typeof fullName === 'string' && fullName.toLowerCase().includes('maria dolores') &&
                        typeof locality === 'string' && locality.toLowerCase().includes('isla aguada') &&
                        weekKey === 'SEMANA 4') {
                      console.log(`\n🔍 CV DEBUG - MARÍA DOLORES - ISLA AGUADA SEMANA 4:`);
                      console.log(`  - Préstamo ID: ${loan.id}`);
                      console.log(`  - weeklyPaid: ${weeklyPaid}`);
                      console.log(`  - expectedWeekly: ${expectedWeekly}`);
                      console.log(`  - paidBeforeWeek: ${paidBeforeWeek}`);
                      console.log(`  - weeksElapsed: ${weeksElapsed}`);
                      console.log(`  - expectedBefore: ${expectedBefore}`);
                      console.log(`  - surplusBefore: ${surplusBefore}`);
                      console.log(`  - cvContribution: ${cvContribution}`);
                      console.log(`  - cvReason: ${cvReason}`);
                      console.log(`  - ¿Se suma a CV en data.cv?: ${cvContribution > 0 ? 'SÍ' : 'NO'}`);
                    }
                  } catch (_) {}

                  // 🔍 DEBUG: CV específico para crédito cmfdjecea3u1bpsjv0xf8p1wp en Chekubul
                  try {
                    if (loan.id === 'cmfdjecea3u1bpsjv0xf8p1wp' && 
                        typeof locality === 'string' && locality.toLowerCase().includes('chekubul')) {
                      console.log(`\n🔍 CV DEBUG - CRÉDITO cmfdjecea3u1bpsjv0xf8p1wp - CHEKUBUL ${weekKey}:`);
                      console.log(`  - Préstamo ID: ${loan.id}`);
                      console.log(`  - Fecha de firma: ${loan.signDate}`);
                      console.log(`  - Fecha de finalización: ${loan.finishedDate || 'No finalizado'}`);
                      console.log(`  - Localidad: ${locality}`);
                      console.log(`  - Semana: ${weekKey}`);
                      console.log(`  - Fecha inicio semana: ${weekStart.toISOString()}`);
                      console.log(`  - Fecha fin semana: ${weekEnd.toISOString()}`);
                      console.log(`  - ¿Firmado antes del fin de semana?: ${new Date(loan.signDate) <= weekEnd ? 'SÍ' : 'NO'}`);
                      console.log(`  - ¿No finalizado antes del fin de semana?: ${!loan.finishedDate || new Date(loan.finishedDate) > weekEnd ? 'SÍ' : 'NO'}`);
                      console.log(`  - ¿No excluido por cleanup?: ${!loan.excludedByCleanup || new Date(loan.excludedByCleanup.cleanupDate) > weekEnd ? 'SÍ' : 'NO'}`);
                      console.log(`  - weeklyPaid: ${weeklyPaid}`);
                      console.log(`  - expectedWeekly: ${expectedWeekly}`);
                      console.log(`  - paidBeforeWeek: ${paidBeforeWeek}`);
                      console.log(`  - weeksElapsed: ${weeksElapsed}`);
                      console.log(`  - expectedBefore: ${expectedBefore}`);
                      console.log(`  - surplusBefore: ${surplusBefore}`);
                      console.log(`  - cvContribution: ${cvContribution}`);
                      console.log(`  - cvReason: ${cvReason}`);
                      console.log(`  - ¿Se suma a CV en data.cv?: ${cvContribution > 0 ? 'SÍ' : 'NO'}`);
                    }
                  } catch (_) {}

                  // Guardar para hover: solo los que contribuyen al CV
                  if (cvContribution > 0) {
                    (data.cvClients as any[]).push({
                      id: loan.id,
                      fullName: loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A',
                      amountGived: Number(loan.amountGived || 0),
                      date: loan.signDate,
                      weeklyPaid: weeklyPaid,
                      expectedWeekly: expectedWeekly,
                      cvContribution: cvContribution,
                      cvReason: cvReason
                    });
                  }
                });
              }




              // ✅ APLICAR CONTINUIDAD: Para semanas que no son la primera, actualizar activeAtStart usando la semana anterior
              if (!isFirstWeek) {
                Object.keys(localitiesData).forEach(locality => {
                  const data = localitiesData[locality];
                  const previousValue = previousWeekActiveAtEnd[locality];
                  if (previousValue !== undefined) {
                    data.activeAtStart = previousValue;
                    
                    // 🔍 DEBUG: Log específico para semana 3 de Atasta
                    if (isAtastaWeek3 && isAtastaLocality(locality)) {
                      console.log(`  - Localidad ${locality}: activeAtStart = ${previousValue} (de semana anterior)`);
                    }
                  }
                });
              }

              // Calcular activos al final usando verificación real de cada préstamo
              Object.keys(localitiesData).forEach(locality => {
                const data = localitiesData[locality];
                const loansInLocality = loansByLocality.get(locality) || [];
                
                // ✅ VERIFICACIÓN REAL: Contar préstamos realmente activos al final de la semana
                let realActiveAtEnd = 0;
                let realActiveAmount = 0;
                
                loansInLocality.forEach((loan: any) => {
                  const isActiveAtEnd = isLoanConsideredOnDate(loan, weekEnd);
                  if (isActiveAtEnd) {
                    realActiveAtEnd++;
                    realActiveAmount += Number(loan.amountGived || 0);
                  }
                });
                
                // Usar el conteo real en lugar de la fórmula matemática
                data.activeAtEnd = realActiveAtEnd;
                data.totalAmountAtEnd = realActiveAmount;
                
                // 🔍 DEBUG: Comparar con el cálculo anterior (fórmula matemática)
                const finishedNotRenewed = (data.finished || 0) - (data.grantedRenewed || 0);
                const delta = (data.grantedNew || 0) + (data.grantedReintegros || 0) - finishedNotRenewed;
                const formulaActiveAtEnd = data.activeAtStart + delta;
                
                if (realActiveAtEnd !== formulaActiveAtEnd) {
                  console.log(`\n⚠️ DISCREPANCIA EN ${locality}:`);
                  console.log(`  - Fórmula matemática: ${formulaActiveAtEnd}`);
                  console.log(`  - Verificación real: ${realActiveAtEnd}`);
                  console.log(`  - Diferencia: ${realActiveAtEnd - formulaActiveAtEnd}`);
                }
                
                // 🔍 DEBUG: Log específico para María Dolores en Isla Aguada semana 4
                if (isIslaAguadaWeek4 && isIslaAguadaLocality(locality)) {
                  console.log(`\n🔍 CÁLCULO ACTIVEATEND - ISLA AGUADA SEMANA 4:`);
                  console.log(`  - Localidad: ${locality}`);
                  console.log(`  - activeAtStart: ${data.activeAtStart}`);
                  console.log(`  - grantedNew: ${data.grantedNew || 0}`);
                  console.log(`  - grantedReintegros: ${data.grantedReintegros || 0}`);
                  console.log(`  - grantedRenewed: ${data.grantedRenewed || 0}`);
                  console.log(`  - finished: ${data.finished || 0}`);
                  console.log(`  - finishedNotRenewed: ${finishedNotRenewed}`);
                  console.log(`  - delta (fórmula): ${delta}`);
                  console.log(`  - activeAtEnd (fórmula): ${formulaActiveAtEnd}`);
                  console.log(`  - activeAtEnd (real): ${realActiveAtEnd}`);
                  console.log(`  - netChange: ${realActiveAtEnd - data.activeAtStart}`);
                  console.log(`  - totalAmountAtEnd: ${realActiveAmount}`);
                  
                  // Buscar específicamente a María Dolores
                  const mariaDoloresLoan = loansInLocality.find((loan: any) => {
                    const fullName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A';
                    return fullName.toLowerCase().includes('maria dolores') || loan.id === 'cmfc9o0em3t0npszx4p5bwt01';
                  });
                  
                  if (mariaDoloresLoan) {
                    const isMariaActive = isLoanConsideredOnDate(mariaDoloresLoan, weekEnd);
                    console.log(`\n🔍 MARÍA DOLORES - VERIFICACIÓN FINAL:`);
                    console.log(`  - ¿Está activa al final de semana?: ${isMariaActive}`);
                    console.log(`  - ¿Aparece en conteo de activos?: ${isMariaActive ? 'SÍ' : 'NO'}`);
                    
                    if (!isMariaActive) {
                      console.log(`  - ✅ CORRECTO: María Dolores NO está activa (tiene sobrepago)`);
                    } else {
                      console.log(`  - ❌ PROBLEMA: María Dolores SÍ está activa pero debería tener sobrepago`);
                    }
                  } else {
                    console.log(`\n🔍 MARÍA DOLORES NO ENCONTRADA en esta localidad`);
                  }
                }
                
                // Cambiar finished para la UI - solo mostrar los no renovados
                data.finished = data.finishedForUI;
                
                // 🔍 DEBUG: Log específico para semana 3 de Atasta
                if (isAtastaWeek3 && isAtastaLocality(locality)) {
                  console.log(`  - CÁLCULO FINAL para ${locality}:`);
                  console.log(`    - activeAtStart: ${data.activeAtStart}`);
                  console.log(`    - grantedNew: ${data.grantedNew || 0}`);
                  console.log(`    - grantedReintegros: ${data.grantedReintegros || 0}`);
                  console.log(`    - finished: ${data.finished || 0}`);
                  console.log(`    - grantedRenewed: ${data.grantedRenewed || 0}`);
                  console.log(`    - finishedNotRenewed: ${finishedNotRenewed}`);
                  console.log(`    - delta: ${delta}`);
                  console.log(`    - activeAtEnd: ${data.activeAtEnd}`);
                  console.log(`    - netChange: ${data.activeAtEnd - data.activeAtStart}`);
                }
                
                previousWeekActiveAtEnd[locality] = data.activeAtEnd;
              });

              reportData[weekKey] = localitiesData;

              // 🔍 DEBUG: Log resumen para semana 3 de Atasta
              if (isAtastaWeek3) {
                console.log(`\n📊 RESUMEN SEMANA 2 ATASTA:`);
                Object.keys(localitiesData).forEach(locality => {
                  const data = localitiesData[locality];
                  if (isAtastaLocality(locality)) {
                    console.log(`  - Localidad: ${locality}`);
                    console.log(`    - activeAtStart: ${data.activeAtStart}`);
                    console.log(`    - grantedNew: ${data.grantedNew || 0}`);
                    console.log(`    - grantedReintegros: ${data.grantedReintegros || 0}`);
                    console.log(`    - grantedRenewed: ${data.grantedRenewed || 0}`);
                    console.log(`    - finished: ${data.finished || 0}`);
                    console.log(`    - activeAtEnd: ${data.activeAtEnd}`);
                    console.log(`    - netChange: ${data.activeAtEnd - data.activeAtStart}`);
                    console.log(`    - Total otorgados: ${data.granted || 0}`);
                    
                    // 🔍 DEBUG: Resumen del flujo de Atasta
                    console.log(`\n  🔍 ANÁLISIS DEL FLUJO ATASTA:`);
                    console.log(`    - Créditos finalizados: ${atastaFinishedCount}`);
                    console.log(`    - Renovados de no finalizados: ${atastaRenewedNotFinishedCount}`);
                    console.log(`    - Renovados de finalizados: ${atastaRenewedFinishedCount}`);
                    console.log(`    - Balance final esperado: -${atastaFinishedCount - atastaRenewedFinishedCount}`);
                    
                    console.log(`    - Préstamos finalizados detalle:`);
                    (data.finishedLoans || []).forEach((finished: any) => {
                      console.log(`      - ${finished.id} (${finished.fullName}) - ${finished.reason}`);
                    });
                    console.log(`    - Préstamos otorgados detalle:`);
                    (data.grantedLoans || []).forEach((granted: any) => {
                      console.log(`      - ${granted.id} (${granted.fullName}) - ${granted.date}`);
                    });
                    console.log(`    - Préstamos nuevos detalle:`);
                    (data.grantedLoansNew || []).forEach((newLoan: any) => {
                      console.log(`      - ${newLoan.id} (${newLoan.fullName}) - ${newLoan.date}`);
                    });
                    console.log(`    - Préstamos reintegros detalle:`);
                    (data.grantedLoansReintegros || []).forEach((reintegro: any) => {
                      console.log(`      - ${reintegro.id} (${reintegro.fullName}) - ${reintegro.date}`);
                    });
                    console.log(`    - Préstamos renovados detalle:`);
                    (data.grantedLoansRenewed || []).forEach((renewed: any) => {
                      console.log(`      - ${renewed.id} (${renewed.fullName}) - ${renewed.date}`);
                    });
                  }
                });
                
                // 🔍 DEBUG: Análisis de créditos terminados sin renovar
                console.log(`\n🔍 ANÁLISIS CRÉDITOS TERMINADOS SIN RENOVAR - SEMANA 2:`);
                Object.keys(localitiesData).forEach(locality => {
                  const data = localitiesData[locality];
                  if (isAtastaLocality(locality)) {
                    console.log(`  - Localidad: ${locality}`);
                    
                    // Contar créditos terminados por FINISHED_DATE (no por cleanup)
                    const finishedByDate = (data.finishedLoans || []).filter((f: any) => f.reason === 'FINISHED_DATE');
                    const finishedByCleanup = (data.finishedLoans || []).filter((f: any) => f.reason === 'PORTFOLIO_CLEANUP');
                    
                    console.log(`    - Créditos terminados por FINISHED_DATE: ${finishedByDate.length}`);
                    console.log(`    - Créditos terminados por CLEANUP: ${finishedByCleanup.length}`);
                    console.log(`    - Total terminados: ${data.finished || 0}`);
                    
                    // Mostrar detalles de cada crédito terminado
                    finishedByDate.forEach((finished: any) => {
                      console.log(`      - FINISHED_DATE: ${finished.id} (${finished.fullName}) - ${finished.finishedDate}`);
                    });
                    finishedByCleanup.forEach((finished: any) => {
                      console.log(`      - CLEANUP: ${finished.id} (${finished.fullName}) - ${finished.finishedDate}`);
                    });
                    
                    // Verificar si estos créditos terminados fueron renovados
                    console.log(`    - Verificando renovaciones:`);
                    (data.finishedLoans || []).forEach((finished: any) => {
                      const wasRenewed = renewalMap.has(finished.id);
                      console.log(`      - ${finished.id} (${finished.fullName}) - ¿Fue renovado?: ${wasRenewed}`);
                      if (wasRenewed) {
                        const renewals = renewalMap.get(finished.id) || [];
                        renewals.forEach((renewal: any) => {
                          console.log(`        - Renovado por: ${renewal.id} (${renewal.borrower?.personalData?.fullName || renewal.lead?.personalData?.fullName || 'N/A'}) - ${renewal.signDate}`);
                        });
                      }
                    });
                  }
                });
                
                // 🔍 DEBUG: Análisis de TODOS los préstamos con finishedDate en la semana 3
                console.log(`\n🔍 ANÁLISIS TODOS LOS PRÉSTAMOS CON FINISHED_DATE - SEMANA 2:`);
                Object.keys(loansByLocality).forEach(locality => {
                  if (isAtastaLocality(locality)) {
                    const loans = loansByLocality.get(locality);
                    console.log(`  - Localidad: ${locality}`);
                    
                    // Buscar todos los préstamos con finishedDate en la semana 3
                    const loansWithFinishedDate = loans.filter((loan: any) => {
                      if (!loan.finishedDate) return false;
                      const finishedDate = new Date(loan.finishedDate);
                      return finishedDate >= weekStart && finishedDate <= weekEnd;
                    });
                    
                    console.log(`    - Total préstamos con finishedDate en semana 3: ${loansWithFinishedDate.length}`);
                    
                    loansWithFinishedDate.forEach((loan: any) => {
                      const finishedDate = new Date(loan.finishedDate);
                      const wasRenewed = renewalMap.has(loan.id);
                      const fullName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A';
                      
                      console.log(`      - ${loan.id} (${fullName})`);
                      console.log(`        - Fecha finishedDate: ${finishedDate.toISOString()}`);
                      console.log(`        - ¿Fue renovado?: ${wasRenewed}`);
                      if (wasRenewed) {
                        const renewals = renewalMap.get(loan.id) || [];
                        renewals.forEach((renewal: any) => {
                          console.log(`        - Renovado por: ${renewal.id} - ${renewal.signDate}`);
                        });
                      }
                    });
                  }
                });
              }

              // ✅ OPTIMIZACIÓN: Eliminar debug counters para mejor performance
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
                grantedReintegros: 0,
                finished: 0,
                finishedNotRenewed: 0,
                finishedForUI: 0,
                finishedLoans: [],
                finishedByCleanup: 0,
                cv: 0, // Créditos Vencidos
                cvClients: [],
                totalAmountAtStart: 0,
                totalAmountAtEnd: 0,
                grantedAmount: 0,
                finishedAmount: 0,
                finishedNotRenewedAmount: 0,
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
                weeklyTotals[weekKey].grantedReintegros += localityData.grantedReintegros;
                weeklyTotals[weekKey].finished += (localityData.finishedLoans || []).length;
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
              const cleanupToDateCount = preCalculatedLoans.filter((loan: any) => {
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
                return preCalculatedLoans.some((ln: any) => {
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
              let reintegrosInMonth = 0;
              preCalculatedLoans.forEach((loan: any) => {
                const sd = new Date(loan.signDate);
                if (sd >= monthStart && sd <= monthEnd && loan.previousLoanId) {
                  renewalsInMonth++;
                  
                  // Verificar si es un reintegro (préstamo anterior ya estaba finalizado al inicio del mes)
                  const previousLoan = loan.previousLoan;
                  if (previousLoan) {
                    // Un reintegro es cuando el préstamo anterior ya estaba finalizado al inicio del mes
                    const monthStartForCheck = new Date(year, month - 1, 1, 0, 0, 0, 0);
                    const wasActiveAtMonthStart = isLoanConsideredOnDate(previousLoan, monthStartForCheck);
                    
                    // Si NO estaba activo al inicio del mes, es un reintegro
                    if (!wasActiveAtMonthStart) {
                      reintegrosInMonth++;
                    }
                  }
                  
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
                  preCalculatedLoans.forEach((loan: any) => {
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
                preCalculatedLoans.forEach((loan: any) => {
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
                grantedPrevMonth = preCalculatedLoans.reduce((acc: number, loan: any) => {
                  const sd = new Date(loan.signDate);
                  return acc + ((sd >= monthStartPrev && sd <= monthEndPrev) ? 1 : 0);
                }, 0);

                // Cerrados sin renovar prev mes (finishedDate en mes previo y sin nueva renovación en mes previo)
                const isRenewedInPrevMonth = (finishedId: string) => {
                  return preCalculatedLoans.some((ln: any) => {
                    if (!ln.previousLoanId) return false;
                    if (ln.previousLoanId !== finishedId) return false;
                    const sd = new Date(ln.signDate);
                    return sd >= monthStartPrev && sd <= monthEndPrev;
                  });
                };
                closedWithoutRenewalPrevMonth = preCalculatedLoans.reduce((acc: number, loan: any) => {
                  const fd = loan.finishedDate ? new Date(loan.finishedDate as any) : null;
                  if (!fd) return acc;
                  if (fd >= monthStartPrev && fd <= monthEndPrev) {
                    return acc + (isRenewedInPrevMonth(loan.id) ? 0 : 1);
                  }
                  return acc;
                }, 0);
              } catch {}

            // ✅ OPTIMIZACIÓN: KPI Gasolina con cache y consulta optimizada
            let gasolineCurrent = 0;
            let gasolinePrevious = 0;
            try {
              const thisMonthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
              const thisMonthEnd = new Date(year, month, 0, 23, 59, 59, 999);
              const prevBase = new Date(year, month - 2, 1, 0, 0, 0, 0);
              const prevMonthStart = new Date(prevBase.getFullYear(), prevBase.getMonth(), 1, 0, 0, 0, 0);
              const prevMonthEnd = new Date(prevBase.getFullYear(), prevBase.getMonth() + 1, 0, 23, 59, 59, 999);

              // ✅ OPTIMIZACIÓN: Consulta paralela para gasolina
              const [aggCurr, aggPrev] = await Promise.all([
                context.prisma.transaction.aggregate({
                  _sum: { amount: true },
                  where: {
                    routeId,
                    type: 'EXPENSE',
                    expenseSource: 'GASOLINE',
                    date: { gte: thisMonthStart, lte: thisMonthEnd }
                  }
                } as any),
                context.prisma.transaction.aggregate({
                  _sum: { amount: true },
                  where: {
                    routeId,
                    type: 'EXPENSE',
                    expenseSource: 'GASOLINE',
                    date: { gte: prevMonthStart, lte: prevMonthEnd }
                  }
                } as any)
              ]);
              
              gasolineCurrent = Number(aggCurr?._sum?.amount || 0);
              gasolinePrevious = Number(aggPrev?._sum?.amount || 0);
            } catch (_) {}

            // ✅ OPTIMIZACIÓN: Eliminar logs de debug para mejor performance

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
              weekDates: weeks, // ✅ AGREGAR: Incluir las fechas de cada semana
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
                reintegrosInMonth,
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

      getActiveClientsForLocality: graphql.field({
        type: graphql.nonNull(graphql.JSON),
        args: {
          routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          localityName: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          month: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          weekEndDate: graphql.arg({ type: graphql.String }), // Fecha específica del final de la semana
        },
        resolve: async (root, { routeId, localityName, year, month, weekEndDate }, context: Context) => {
          try {
            console.log(`🚀 FUNCIÓN getActiveClientsForLocality EJECUTÁNDOSE:`);
            console.log(`   📍 Localidad: "${localityName}"`);
            console.log(`   🛣️  Ruta ID: ${routeId}`);
            console.log(`   📅 Año: ${year}, Mes: ${month}`);
            console.log(`   📅 Fecha fin semana: ${weekEndDate || 'No especificada'}`);
            
            // Usar la fecha específica de la semana si se proporciona, sino usar fin del mes
            const referenceDate = weekEndDate ? new Date(weekEndDate) : new Date(year, month, 0, 23, 59, 59, 999);
            console.log(`   📅 Fecha referencia calculada: ${referenceDate.toISOString()}`);
            
            // ✅ NUEVA ESTRATEGIA: Usar la misma lógica exacta que el reporte principal
            // Obtener TODOS los préstamos de la ruta para aplicar la lógica temporal
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
                loantype: true,
                payments: {
                  orderBy: {
                    receivedAt: 'asc'
                  }
                },
                excludedByCleanup: {
                  include: {
                    executedBy: true
                  }
                },
                previousLoan: true
              }
            });

            // ✅ CALCULO EN TIEMPO REAL: Usar la misma lógica que getActiveLoansReport
            // Un préstamo está "activo" si tiene monto pendiente real > 0 (calculado on-the-fly)
            // Y fue firmado antes o en la fecha de referencia
            
            let activeLoansAtDate = allLoans.filter(loan => {
              // Verificar que fue firmado antes de la fecha de referencia
              const signDate = new Date(loan.signDate);
              if (signDate > referenceDate) return false;
              
              // ✅ PUNTO 1: Si para la semana de revisión fue marcado como portafolioCleanup, entonces no se contempla
              if (loan.excludedByCleanup !== null && loan.excludedByCleanup !== undefined) {
                const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate as any);
                if (cleanupDate <= referenceDate) {
                  return false; // Ya fue excluido por cleanup antes de la fecha de referencia
                }
              }

              // ✅ PUNTO 2: Si para la semana de revisión fue renovado, no se contempla
              if (loan.previousLoanId) {
                // Buscar si hay un préstamo más reciente que este (otra renovación posterior)
                const hasNewerRenewal = allLoans.some((otherLoan: any) => {
                  // Si el otro préstamo tiene este como previousLoan, es más reciente
                  return otherLoan.previousLoanId === loan.id && 
                         new Date(otherLoan.signDate) <= referenceDate;
                });
                
                if (hasNewerRenewal) {
                  // Este préstamo ya fue renovado por uno más reciente, no está activo
                  return false;
                }
              }

              // ✅ CALCULO ON-THE-FLY: Calcular monto pendiente real en tiempo real
              let realPendingAmount = 0;
              
              try {
                // Calcular el monto total que se debe pagar
                const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
                const requested = parseFloat(loan.requestedAmount?.toString() || '0');
                const totalDebt = requested * (1 + rate);
                
                // Calcular el total pagado hasta la fecha de referencia
                let totalPaid = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                  if (paymentDate <= referenceDate) {
                    totalPaid += parseFloat((payment.amount || 0).toString());
                  }
                }
                
                // Calcular el monto pendiente real
                realPendingAmount = Math.max(0, totalDebt - totalPaid);
                
              } catch (error) {
                console.error(`Error calculando monto pendiente para préstamo ${loan.id}:`, error);
                // Fallback al campo stored si hay error en el cálculo
                realPendingAmount = parseFloat(loan.pendingAmountStored || '0');
              }
              
              // ✅ LÓGICA CORREGIDA: Un préstamo está activo si:
              // 1. No está excluido por cleanup
              // 2. No es una renovación ya superada por una más reciente
              // 3. Tiene monto pendiente real > 0
              
              // Si tiene monto pendiente real > 0, está activo
              if (realPendingAmount > 0) {
                // Filtrar por localidad si no es TOTALES o GRAN TOTAL
                if (localityName !== 'TOTALES' && localityName !== 'GRAN TOTAL') {
                  const loanLocality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                                     loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                                     'Sin localidad';
                  return loanLocality === localityName;
                }
                return true;
              }
              
              return false; // Sin deuda pendiente
            });
            
            // Formatear datos para el hover tooltip
            const activeClients = activeLoansAtDate.map((loan: any) => {
              const clientName = loan.borrower?.personalData?.fullName || 'Sin nombre';
              const leadName = loan.lead?.personalData?.fullName || 'Sin líder';
              const loanTypeName = loan.loantype?.name || 'Sin tipo';
              const amountGived = parseFloat(loan.amountGived || '0');
              
              // ✅ CALCULAR MONTO PENDIENTE REAL para el tooltip
              let realPendingAmount = 0;
              try {
                const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
                const requested = parseFloat(loan.requestedAmount?.toString() || '0');
                const totalDebt = requested * (1 + rate);
                
                let totalPaid = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                  if (paymentDate <= referenceDate) {
                    totalPaid += parseFloat((payment.amount || 0).toString());
                  }
                }
                
                realPendingAmount = Math.max(0, totalDebt - totalPaid);
              } catch (error) {
                console.error(`Error calculando monto pendiente para tooltip del préstamo ${loan.id}:`, error);
                realPendingAmount = parseFloat(loan.pendingAmountStored || '0');
              }
              
              const signDate = loan.signDate ? new Date(loan.signDate) : null;
              
              // Obtener la localidad real del préstamo
              const actualLocality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                                  loan.lead?.personalData?.addresses?.[0]?.location?.name ||
                                  'Sin localidad';
              
              return {
                id: loan.id,
                clientName,
                leadName,
                loanTypeName,
                amountGived,
                pendingAmount: realPendingAmount, // ✅ Usar el monto calculado en tiempo real
                signDate: signDate ? signDate.toLocaleDateString('es-MX') : 'N/A',
                locality: actualLocality,
                requestedLocality: localityName // Para referencia
              };
            });



            // 🔍 DEBUG GENERAL - SIEMPRE SE EJECUTA
            console.log(`🔍 DEBUG GENERAL: Procesando localidad "${localityName}" con fecha ${referenceDate.toISOString()}`);
            
            // 🔍 DEBUG DETALLADO SOLO PARA VICENTE GUERRERO - SEMANA 1 AGOSTO
            if (localityName && localityName.toLowerCase().includes('vicente guerrero')) {
              // Debug siempre para Vicente Guerrero, pero con información específica de la fecha
              const isAugustWeek1 = referenceDate.getMonth() === 7 && referenceDate.getDate() <= 8;
              console.log('\n🔍 DEBUG VICENTE GUERRERO - SEMANA 1 AGOSTO 2025');
              console.log('==================================================');
              console.log(`📊 Total préstamos en la ruta: ${allLoans.length}`);
              console.log(`📊 Préstamos activos después del filtro: ${activeLoansAtDate.length}`);
              console.log(`📅 Fecha de referencia: ${referenceDate.toLocaleDateString()}`);
              console.log(`📅 Mes: ${referenceDate.getMonth() + 1}, Día: ${referenceDate.getDate()}`);
              console.log(`🎯 CONDICIÓN ACTIVADA: Vicente Guerrero + ${isAugustWeek1 ? 'AGOSTO SEMANA 1' : 'OTRA FECHA'}`);
              console.log(`🔍 DEBUG SIEMPRE ACTIVO PARA VICENTE GUERRERO - FECHA: ${referenceDate.toISOString()}`);
              console.log(`📊 Total préstamos en la ruta: ${allLoans.length}`);
              console.log(`📊 Préstamos activos después del filtro: ${activeLoansAtDate.length}`);
              console.log(`📅 Fecha de referencia: ${referenceDate.toLocaleDateString()}`);
              console.log(`📅 Mes: ${referenceDate.getMonth() + 1}, Día: ${referenceDate.getDate()}`);
              console.log(`🎯 CONDICIÓN ACTIVADA: Vicente Guerrero + Agosto (mes ${referenceDate.getMonth() + 1}) + Semana 1 (día ≤ 8)`);
              
              // Mostrar detalles de cada préstamo activo
              console.log('\n📋 PRÉSTAMOS ACTIVOS:');
              activeLoansAtDate.forEach((loan: any, index: number) => {
                const clientName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'Sin nombre';
                const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name || 
                                loan.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
                const signDate = loan.signDate ? new Date(loan.signDate).toLocaleDateString() : 'Sin fecha';
                const requested = parseFloat(loan.requestedAmount?.toString() || '0');
                const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
                const totalDebt = requested * (1 + rate);
                
                // Calcular monto pendiente real
                let totalPaid = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                  if (paymentDate <= referenceDate) {
                    totalPaid += parseFloat((payment.amount || 0).toString());
                  }
                }
                const realPendingAmount = totalDebt - totalPaid;
                
                console.log(`  ${index + 1}. ${clientName} (${locality})`);
                console.log(`     📅 Firma: ${signDate}`);
                console.log(`     💰 Solicitado: $${requested.toFixed(2)}`);
                console.log(`     📈 Tasa: ${(rate * 100).toFixed(1)}%`);
                console.log(`     💳 Total deuda: $${totalDebt.toFixed(2)}`);
                console.log(`     💵 Total pagado: $${totalPaid.toFixed(2)}`);
                console.log(`     ⚖️  Pendiente real: $${realPendingAmount.toFixed(2)}`);
                console.log(`     🔄 Es renovación: ${loan.previousLoanId ? 'SÍ' : 'NO'}`);
                if (loan.previousLoanId) {
                  console.log(`        📋 ID préstamo anterior: ${loan.previousLoanId}`);
                }
                console.log(`     🧹 Excluido por cleanup: ${loan.excludedByCleanup ? 'SÍ' : 'NO'}`);
                if (loan.excludedByCleanup) {
                  const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate as any);
                  console.log(`        📅 Fecha cleanup: ${cleanupDate.toLocaleDateString()}`);
                }
                console.log('');
              });
              
              // Mostrar préstamos que NO están activos y por qué
              const inactiveLoans = allLoans.filter(loan => {
                const signDate = new Date(loan.signDate);
                if (signDate > referenceDate) return false;
                
                // Verificar cada criterio
                if (loan.excludedByCleanup !== null && loan.excludedByCleanup !== undefined) {
                  const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate as any);
                  if (cleanupDate <= referenceDate) return false;
                }
                
                if (loan.previousLoanId) {
                  const hasNewerRenewal = allLoans.some((otherLoan: any) => {
                    return otherLoan.previousLoanId === loan.id && 
                           new Date(otherLoan.signDate) <= referenceDate;
                  });
                  if (hasNewerRenewal) return false;
                }
                
                // Calcular monto pendiente
                const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
                const requested = parseFloat(loan.requestedAmount?.toString() || '0');
                const totalDebt = requested * (1 + rate);
                
                let totalPaid = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                  if (paymentDate <= referenceDate) {
                    totalPaid += parseFloat((payment.amount || 0).toString());
                  }
                }
                const realPendingAmount = totalDebt - totalPaid;
                
                return realPendingAmount > 0;
              });
              
              console.log('\n❌ PRÉSTAMOS INACTIVOS (y por qué):');
              inactiveLoans.forEach((loan: any, index: number) => {
                const clientName = loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'Sin nombre';
                const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name || 
                                loan.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
                
                console.log(`  ${index + 1}. ${clientName} (${locality})`);
                
                // Verificar cada criterio
                if (loan.excludedByCleanup !== null && loan.excludedByCleanup !== undefined) {
                  const cleanupDate = new Date(loan.excludedByCleanup.cleanupDate as any);
                  if (cleanupDate <= referenceDate) {
                    console.log(`     🧹 EXCLUIDO: Cleanup el ${cleanupDate.toLocaleDateString()}`);
                  }
                }
                
                if (loan.previousLoanId) {
                  const hasNewerRenewal = allLoans.some((otherLoan: any) => {
                    return otherLoan.previousLoanId === loan.id && 
                           new Date(otherLoan.signDate) <= referenceDate;
                  });
                  if (hasNewerRenewal) {
                    console.log(`     🔄 EXCLUIDO: Ya fue renovado por un préstamo más reciente`);
                  }
                }
                
                // Calcular monto pendiente
                const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
                const requested = parseFloat(loan.requestedAmount?.toString() || '0');
                const totalDebt = requested * (1 + rate);
                
                let totalPaid = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt);
                  if (paymentDate <= referenceDate) {
                    totalPaid += parseFloat((payment.amount || 0).toString());
                  }
                }
                const realPendingAmount = totalDebt - totalPaid;
                
                if (realPendingAmount <= 0) {
                  console.log(`     💰 EXCLUIDO: Ya se pagó completamente (pendiente: $${realPendingAmount.toFixed(2)})`);
                }
                
                console.log('');
              });
              
              console.log('==================================================\n');
            }

            return {
              locality: localityName,
              totalActiveClients: activeClients.length,
              clients: activeClients,
              generatedAt: new Date().toISOString(),
              referenceDate: referenceDate.toISOString() // Para debugging
            };

          } catch (error) {
            console.error('Error in getActiveClientsForLocality:', error);
            throw new Error(`Error getting active clients for locality: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
      }),

        getRouteStats: graphql.field({
    type: graphql.nonNull(graphql.JSON),
    args: {
      routeId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    },
    resolve: async (root, { routeId }, context: Context) => {
      try {
        // Obtener estadísticas de la ruta
        const route = await context.prisma.route.findUnique({
          where: { id: routeId },
          include: {
            localities: {
              include: {
                _count: {
                  select: { leads: true }
                }
              }
            }
          }
        });

        if (!route) {
          throw new Error(`Ruta con ID ${routeId} no encontrada`);
        }

        // Obtener clientes activos (con préstamos activos)
        const activeClients = await context.prisma.lead.count({
          where: {
            routesId: routeId,
            loans: {
              some: {
                finishedDate: null,
                excludedByCleanup: null
              }
            }
          }
        });

        // Obtener clientes pagando (con pagos en las últimas 4 semanas)
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        const payingClients = await context.prisma.lead.count({
          where: {
            routesId: routeId,
            loans: {
              some: {
                finishedDate: null,
                excludedByCleanup: null,
                payments: {
                  some: {
                    receivedAt: {
                      gte: fourWeeksAgo
                    }
                  }
                }
              }
            }
          }
        });

        // Obtener total de clientes
        const totalClients = await context.prisma.lead.count({
          where: {
            routesId: routeId
          }
        });

        return {
          routeId: route.id,
          routeName: route.name,
          localitiesCount: route.localities.length,
          activeClients,
          payingClients,
          totalClients,
          payingPercentage: totalClients > 0 ? Math.round((payingClients / totalClients) * 100) : 0
        };
      } catch (error) {
        console.error('Error en getRouteStats:', error);
        throw error;
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
          where: { id: { in: routeIds } },
          select: { id: true, name: true }
        });
  
        if (routes.length === 0) {
          throw new Error('No se encontraron rutas');
        }
  
        // Definir rango de fechas del año
        const yearStart = new Date(`${year}-01-01`);
        const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);
  
        // 1. Obtener TODAS las transacciones del año en una sola consulta
        const transactions = await context.prisma.transaction.findMany({
          where: {
            route: { id: { in: routeIds } },
            date: {
              gte: yearStart,
              lte: yearEnd,
            },
          },
          select: {
            amount: true,
            type: true,
            date: true,
            expenseSource: true,
            incomeSource: true,
            sourceAccountId: true,
            profitAmount: true,
          }
        });
  
        // 2. Obtener préstamos relevantes en una sola consulta optimizada
        const loans = await context.prisma.loan.findMany({
          where: {
            lead: {
              routes: { id: { in: routeIds } }
            },
            OR: [
              // Préstamos firmados en el año
              {
                signDate: {
                  gte: yearStart,
                  lte: yearEnd
                }
              },
              // Préstamos activos durante el año (sin fecha de finalización o finalizado después del inicio del año)
              {
                AND: [
                  { signDate: { lt: yearEnd } },
                  {
                    OR: [
                      { finishedDate: null },
                      { finishedDate: { gte: yearStart } }
                    ]
                  }
                ]
              }
            ]
          },
          select: {
            id: true,
            signDate: true,
            finishedDate: true,
            badDebtDate: true,
            amountGived: true,
            profitAmount: true,
            previousLoanId: true,
            payments: {
              select: {
                amount: true,
                receivedAt: true,
                createdAt: true
              }
            }
          }
        });
  
        // 3. Obtener cuentas de gasolina una sola vez
        const gasolineAccounts = await context.prisma.account.findMany({
          where: {
            OR: [
              { type: 'PREPAID_GAS' },
              { type: 'OFFICE_CASH_FUND' },
              { type: 'EMPLOYEE_CASH_FUND' }
            ]
          },
          select: { id: true, type: true }
        });
  
        const tokaAccountId = gasolineAccounts.find(acc => acc.type === 'PREPAID_GAS')?.id;
        const cashAccountIds = gasolineAccounts
          .filter(acc => acc.type === 'OFFICE_CASH_FUND' || acc.type === 'EMPLOYEE_CASH_FUND')
          .map(acc => acc.id);
  
        // Inicializar estructura de datos mensual
        const monthlyData: { [key: string]: any } = {};
        
        // Inicializar todos los meses
        for (let month = 1; month <= 12; month++) {
          const monthKey = month.toString().padStart(2, '0');
          monthlyData[monthKey] = {
            totalExpenses: 0,
            generalExpenses: 0,
            nomina: 0,
            comissions: 0,
            incomes: 0,
            totalCash: 0,
            loanDisbursements: 0,
            carteraActiva: 0,
            carteraVencida: 0,
            renovados: 0,
            badDebtAmount: 0,
            totalIncomingCash: 0,
            capitalReturn: 0,
            profitReturn: 0,
            operationalCashUsed: 0,
            totalInvestment: 0,
            tokaGasolina: 0,
            cashGasolina: 0,
            totalGasolina: 0,
            operationalExpenses: 0,
            availableCash: 0,
            travelExpenses: 0,
            paymentsCount: 0,
            gainPerPayment: 0,
            balance: 0,
            operationalProfit: 0,
            profitPercentage: 0,
            balanceWithReinvest: 0,
            carteraMuerta: 0,
            uiExpensesTotal: 0,
            uiGainsTotal: 0,
            // Campos de desglose de nómina
            nominaInterna: 0,
            salarioExterno: 0,
            viaticos: 0
          };
        }
  
        // 4. Procesar transacciones agrupadas por mes
        for (const transaction of transactions) {
          const transactionDate = transaction.date ? new Date(transaction.date) : new Date();
          const month = transactionDate.getMonth() + 1;
          const monthKey = month.toString().padStart(2, '0');
  
          const amount = Number(transaction.amount || 0);
          const monthData = monthlyData[monthKey];
  
          // Clasificar transacciones
          if (transaction.type === 'EXPENSE') {
            // Clasificar gastos de gasolina
            if (transaction.expenseSource === 'GASOLINE') {
              if (transaction.sourceAccountId === tokaAccountId) {
                monthData.tokaGasolina += amount;
              } else if (cashAccountIds.includes(transaction.sourceAccountId || '')) {
                monthData.cashGasolina += amount;
              }
              monthData.totalGasolina += amount;
              monthData.generalExpenses += amount;
            } else {
              // Otros gastos
              switch (transaction.expenseSource) {
                case 'NOMINA_SALARY':
                  monthData.nominaInterna += amount;
                  monthData.nomina += amount;
                  monthData.operationalExpenses += amount;
                  break;
                case 'EXTERNAL_SALARY':
                  monthData.salarioExterno += amount;
                  monthData.nomina += amount;
                  monthData.operationalExpenses += amount;
                  break;
                case 'VIATIC':
                  monthData.viaticos += amount;
                  monthData.nomina += amount;
                  monthData.operationalExpenses += amount;
                  break;
                case 'TRAVEL_EXPENSES':
                  monthData.travelExpenses += amount;
                  monthData.operationalExpenses += amount;
                  break;
                case 'LOAN_PAYMENT_COMISSION':
                case 'LOAN_GRANTED_COMISSION':
                case 'LEAD_COMISSION':
                  monthData.comissions += amount;
                  monthData.operationalExpenses += amount;
                  break;
                case 'LOAN_GRANTED':
                  monthData.loanDisbursements += amount;
                  break;
                default:
                  monthData.generalExpenses += amount;
                  monthData.operationalExpenses += amount;
                  break;
              }
            }
            
            monthData.totalExpenses += amount;
            monthData.totalCash -= amount;
            monthData.operationalCashUsed += amount;
            
            if (transaction.expenseSource !== 'LOAN_GRANTED') {
              monthData.totalInvestment += amount;
            }
          } else if (transaction.type === 'INCOME') {
            if (transaction.incomeSource === 'CASH_LOAN_PAYMENT' || 
                transaction.incomeSource === 'BANK_LOAN_PAYMENT') {
              monthData.totalIncomingCash += amount;
              const profit = Number(transaction.profitAmount || 0);
              monthData.profitReturn += profit;
              monthData.incomes += profit;
              monthData.capitalReturn += (amount - profit);
              monthData.paymentsCount += 1;
            } else {
              monthData.incomes += amount;
              monthData.totalIncomingCash += amount;
              monthData.profitReturn += amount;
            }
            monthData.totalCash += amount;
          }
        }
  
        // 5. Calcular cartera y métricas de préstamos por mes (optimizado)
        let cumulativeCashBalance = 0;
        
        for (let month = 1; month <= 12; month++) {
          const monthKey = month.toString().padStart(2, '0');
          const monthStart = new Date(year, month - 1, 1);
          const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
          
          // Flujo de caja acumulado
          const monthCashFlow = monthlyData[monthKey].totalCash || 0;
          cumulativeCashBalance += monthCashFlow;
          monthlyData[monthKey].availableCash = Math.max(0, cumulativeCashBalance);
  
          // Contar préstamos por estado (optimizado)
          let activeLoans = 0;
          let overdueLoans = 0;
          let deadLoans = 0;
          let renewedLoans = 0;
          let badDebtAmount = 0;
          let carteraMuertaTotal = 0;
  
          for (const loan of loans) {
            const signDate = new Date(loan.signDate);
            
            // Solo procesar préstamos relevantes para este mes
            if (signDate > monthEnd) continue;
            
            // Verificar si está activo al final del mes
            const isActive = !loan.finishedDate || new Date(loan.finishedDate) > monthEnd;
            
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
            
            // Contar cartera muerta
            if (loan.badDebtDate) {
              const badDebtDate = new Date(loan.badDebtDate);
              
              // Préstamos marcados como bad debt en este mes específico
              if (badDebtDate >= monthStart && badDebtDate <= monthEnd) {
                const amountGived = Number(loan.amountGived || 0);
                const profitAmount = Number(loan.profitAmount || 0);
                const totalToPay = amountGived + profitAmount;
                
                let totalPaid = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt || new Date());
                  if (paymentDate <= badDebtDate) {
                    totalPaid += Number(payment.amount || 0);
                  }
                }
                
                const pendingDebt = Math.max(0, totalToPay - totalPaid);
                badDebtAmount += pendingDebt;
              }
              
              // Acumulado de cartera muerta
              if (badDebtDate <= monthEnd) {
                deadLoans++;
                const amountGived = Number(loan.amountGived || 0);
                const profitAmount = Number(loan.profitAmount || 0);
                const totalToPay = amountGived + profitAmount;
                
                let totalPaid = 0;
                let gananciaCobrada = 0;
                for (const payment of loan.payments || []) {
                  const paymentDate = new Date(payment.receivedAt || payment.createdAt || new Date());
                  if (paymentDate <= badDebtDate) {
                    totalPaid += Number(payment.amount || 0);
                    // Aproximación de ganancia cobrada
                    gananciaCobrada += Number(payment.amount || 0) * (profitAmount / totalToPay);
                  }
                }
                
                const deudaPendiente = totalToPay - totalPaid;
                const gananciaPendiente = profitAmount - gananciaCobrada;
                const carteraMuerta = deudaPendiente - gananciaPendiente;
                carteraMuertaTotal += Math.max(0, carteraMuerta);
              }
            }
            
            // Contar renovados en el mes
            if (loan.previousLoanId && signDate >= monthStart && signDate <= monthEnd) {
              renewedLoans++;
            }
          }
  
          monthlyData[monthKey].carteraActiva = activeLoans;
          monthlyData[monthKey].carteraVencida = overdueLoans;
          monthlyData[monthKey].carteraMuerta = carteraMuertaTotal;
          monthlyData[monthKey].renovados = renewedLoans;
          monthlyData[monthKey].badDebtAmount = badDebtAmount;
  
          // Recalcular métricas finales
          const data = monthlyData[monthKey];
          const operationalExpenses = data.generalExpenses + data.nomina + data.comissions;
          data.totalExpenses = operationalExpenses;
          data.balance = data.incomes - operationalExpenses;
          data.balanceWithReinvest = data.balance - data.loanDisbursements;
          
          const uiExpensesTotal = operationalExpenses + data.badDebtAmount + data.travelExpenses;
          const uiGainsTotal = data.incomes;
          data.uiExpensesTotal = uiExpensesTotal;
          data.uiGainsTotal = uiGainsTotal;
          data.operationalProfit = uiGainsTotal - uiExpensesTotal;
          data.profitPercentage = uiGainsTotal > 0 ? ((data.operationalProfit / uiGainsTotal) * 100) : 0;
          data.gainPerPayment = data.paymentsCount > 0 ? (data.operationalProfit / data.paymentsCount) : 0;
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
              include: { routes: true }
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
              const accountRouteIds = account.routes?.map(r => r.id) || [];
              const fallback = await context.prisma.account.findFirst({
                where: {
                  id: { not: account.id },
                  OR: [
                    { routes: { some: { id: { in: accountRouteIds } } } },
                    { routes: { none: {} } }
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
                route: account.routes && account.routes.length > 0 ? { connect: { id: account.routes[0].id } } : undefined,
                snapshotRouteId: account.routes && account.routes.length > 0 ? account.routes[0].id : undefined,
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
                },
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
                        route: true,
                        municipality: {
                          include: {
                            state: true
                          }
                        }
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
                        status: true,
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
                        }
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

              // Extraer información de ubicación del líder (no del cliente)
              let location = 'Sin localidad';
              let municipality = 'Sin municipio';
              let state = 'Sin estado';
              let city = 'Sin dirección';
              
              // Buscar información del líder en el préstamo más reciente
              if (loans.length > 0) {
                const latestLoan = loans.reduce((latest, loan) => {
                  const loanDate = new Date(loan.signDate);
                  const latestDate = new Date(latest.signDate);
                  return loanDate > latestDate ? loan : latest;
                });
                
                if (latestLoan.lead?.personalData?.addresses?.[0]?.location) {
                  const leadLocation = latestLoan.lead.personalData.addresses[0].location;
                  location = leadLocation.name || 'Sin localidad';
                  municipality = leadLocation.municipality?.name || 'Sin municipio';
                  state = leadLocation.municipality?.state?.name || 'Sin estado';
                  city = latestLoan.lead.personalData.addresses[0].street || 'Sin dirección';
                }
              }

              combinedResults.set(client.id, {
                id: client.id,
                name: client.fullName || 'Sin nombre',
                dui: 'N/A', // Campo no disponible en PersonalData
                phone: client.phones[0]?.number || 'N/A',
                address: client.addresses[0] ? `${client.addresses[0].location?.name || 'Sin localidad'}` : 'N/A',
                route: client.addresses[0]?.location?.route?.name || 'N/A',
                location: location,
                municipality: municipality,
                state: state,
                city: city,
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
                      
                      // Actualizar información de ubicación del líder si este préstamo es más reciente
                      if (loan.lead?.personalData?.addresses?.[0]?.location) {
                        const leadLocation = loan.lead.personalData.addresses[0].location;
                        existingClient.location = leadLocation.name || 'Sin localidad';
                        existingClient.municipality = leadLocation.municipality?.name || 'Sin municipio';
                        existingClient.state = leadLocation.municipality?.state?.name || 'Sin estado';
                        existingClient.city = loan.lead.personalData.addresses[0].street || 'Sin dirección';
                      }
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

      // Extensiones para Telegram
      debugTelegram: graphql.field({
        type: graphql.nonNull(graphql.String),
        resolve: async () => {
          console.log('🔍 Debugging de Telegram solicitado via GraphQL');
          return 'Debugging de Telegram completado - Revisa la consola del servidor';
        }
      }),

      telegramStatus: graphql.field({
        type: graphql.nonNull(graphql.String),
        resolve: async () => {
          console.log('📡 Estado de Telegram solicitado via GraphQL');
          return 'Estado de Telegram verificado - Revisa la consola del servidor';
        }
      }),

      // ✅ FUNCIONALIDAD SIMPLIFICADA: Cartera muerta
      loansForDeadDebt: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: {
          weeksSinceLoan: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          weeksWithoutPayment: graphql.arg({ type: graphql.nonNull(graphql.Int) })
        },
        resolve: async (source, { weeksSinceLoan, weeksWithoutPayment }, context: Context) => {
          try {
            console.log('🔍 Buscando créditos para cartera muerta:', { weeksSinceLoan, weeksWithoutPayment });
            
            // Calcular fechas límite
            const now = new Date();
            const weeksSinceLoanDate = new Date(now.getTime() - (weeksSinceLoan * 7 * 24 * 60 * 60 * 1000));
            const weeksWithoutPaymentDate = new Date(now.getTime() - (weeksWithoutPayment * 7 * 24 * 60 * 60 * 1000));
            
            // Consulta real a la base de datos
            const loans = await context.prisma.loan.findMany({
              where: {
                AND: [
                  {
                    signDate: {
                      lte: weeksSinceLoanDate
                    }
                  },
                  {
                    // Solo créditos que NO están marcados como cartera muerta
                    badDebtDate: null
                  },
                  {
                    // Solo créditos que NO están terminados
                    finishedDate: null
                  },
                  {
                    // Solo créditos con deuda pendiente mayor a 0
                    pendingAmountStored: {
                      gt: 0
                    }
                  },
                  {
                    OR: [
                      {
                        // Créditos que no tienen pagos recientes
                        payments: {
                          none: {
                            receivedAt: {
                              gte: weeksWithoutPaymentDate
                            }
                          }
                        }
                      },
                      {
                        // Créditos que no tienen ningún pago
                        payments: {
                          none: {}
                        }
                      }
                    ]
                  }
                ]
              },
              include: {
                borrower: {
                  select: {
                    personalData: {
                      select: {
                        fullName: true,
                        clientCode: true
                      }
                    }
                  }
                },
                lead: {
                  select: {
                    personalData: {
                      select: {
                        fullName: true
                      }
                    },
                    routes: {
                      select: {
                        name: true,
                        localities: {
                          select: {
                            name: true
                          }
                        }
                      }
                    }
                  }
                },
                payments: {
                  select: {
                    receivedAt: true,
                    amount: true
                  },
                  orderBy: {
                    receivedAt: 'desc'
                  }
                }
              },
              orderBy: {
                signDate: 'asc'
              }
            });

            console.log('🔍 Datos brutos de la consulta:', loans.length, 'créditos');
            console.log('🔍 Primer crédito (ejemplo):', loans[0] ? {
              id: loans[0].id,
              leadName: loans[0].lead?.personalData?.fullName,
              routeName: loans[0].lead?.routes?.name,
              localities: loans[0].lead?.routes?.localities?.map(l => l.name),
              pendingAmount: loans[0].pendingAmountStored
            } : 'No hay créditos');

            // Procesar los datos para calcular semanas
            const processedLoans = loans.map(loan => {
              const weeksSinceLoanCalculated = Math.floor((now.getTime() - loan.signDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
              
              // Calcular semanas sin pago
              let weeksWithoutPaymentCalculated = 0;
              if (loan.payments.length > 0) {
                const lastPaymentDate = loan.payments[0].receivedAt;
                if (lastPaymentDate) {
                  weeksWithoutPaymentCalculated = Math.floor((now.getTime() - lastPaymentDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
                }
              } else {
                // Si no tiene pagos, las semanas sin pago son las mismas que las semanas desde el crédito
                weeksWithoutPaymentCalculated = weeksSinceLoanCalculated;
              }

              return {
                id: loan.id,
                requestedAmount: Number(loan.requestedAmount),
                amountGived: Number(loan.amountGived),
                signDate: loan.signDate.toISOString(),
                pendingAmountStored: Number(loan.pendingAmountStored || 0),
                borrower: {
                  fullName: loan.borrower?.personalData?.fullName || 'Sin nombre',
                  clientCode: loan.borrower?.personalData?.clientCode || 'Sin código'
                },
                lead: {
                  fullName: loan.lead?.personalData?.fullName || 'Sin líder',
                  locality: {
                    name: loan.lead?.routes?.localities?.[0]?.name || 'Sin localidad'
                  }
                },
                weeksSinceLoan: weeksSinceLoanCalculated,
                weeksWithoutPayment: weeksWithoutPaymentCalculated
              };
            });

            console.log('✅ Créditos encontrados para cartera muerta:', processedLoans.length);
            
            // Debug: verificar localidades
            const localities = [...new Set(processedLoans.map(loan => loan.lead.locality.name))];
            console.log('📍 Localidades encontradas:', localities);

            return JSON.stringify(processedLoans);
          } catch (error) {
            console.error('Error al obtener créditos para cartera muerta:', error);
            return JSON.stringify([]);
          }
        }
      }),

      deadDebtSummary: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: {
          weeksSinceLoan: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          weeksWithoutPayment: graphql.arg({ type: graphql.nonNull(graphql.Int) })
        },
        resolve: async (source, { weeksSinceLoan, weeksWithoutPayment }, context: Context) => {
          try {
            console.log('🔍 Generando resumen de cartera muerta:', { weeksSinceLoan, weeksWithoutPayment });
            
            // Calcular fechas límite (misma lógica que loansForDeadDebt)
            const now = new Date();
            const weeksSinceLoanDate = new Date(now.getTime() - (weeksSinceLoan * 7 * 24 * 60 * 60 * 1000));
            const weeksWithoutPaymentDate = new Date(now.getTime() - (weeksWithoutPayment * 7 * 24 * 60 * 60 * 1000));
            
            // Consulta real a la base de datos (misma lógica que loansForDeadDebt)
            const loans = await context.prisma.loan.findMany({
              where: {
                AND: [
                  {
                    signDate: {
                      lte: weeksSinceLoanDate
                    }
                  },
                  {
                    // Solo créditos que NO están marcados como cartera muerta
                    badDebtDate: null
                  },
                  {
                    // Solo créditos que NO están terminados
                    finishedDate: null
                  },
                  {
                    // Solo créditos con deuda pendiente mayor a 0
                    pendingAmountStored: {
                      gt: 0
                    }
                  },
                  {
                    OR: [
                      {
                        // Créditos que no tienen pagos recientes
                        payments: {
                          none: {
                            receivedAt: {
                              gte: weeksWithoutPaymentDate
                            }
                          }
                        }
                      },
                      {
                        // Créditos que no tienen ningún pago
                        payments: {
                          none: {}
                        }
                      }
                    ]
                  }
                ]
              },
              include: {
                lead: {
                  select: {
                    routes: {
                      select: {
                        localities: {
                          select: {
                            name: true
                          }
                        }
                      }
                    }
                  }
                },
                payments: {
                  select: {
                    receivedAt: true
                  },
                  orderBy: {
                    receivedAt: 'desc'
                  }
                }
              }
            });

            // Procesar los datos y agrupar por localidad
            const summaryMap = new Map<string, { loanCount: number; totalAmount: number }>();
            
            loans.forEach(loan => {
              const localityName = loan.lead?.routes?.localities?.[0]?.name || 'Sin localidad';
              const pendingAmount = Number(loan.pendingAmountStored || 0);
              
              if (summaryMap.has(localityName)) {
                const current = summaryMap.get(localityName)!;
                summaryMap.set(localityName, {
                  loanCount: current.loanCount + 1,
                  totalAmount: current.totalAmount + pendingAmount
                });
              } else {
                summaryMap.set(localityName, {
                  loanCount: 1,
                  totalAmount: pendingAmount
                });
              }
            });

            const summary = Array.from(summaryMap.entries()).map(([locality, data]) => ({
              locality,
              loanCount: data.loanCount,
              totalAmount: data.totalAmount
            }));

            console.log('✅ Resumen generado:', summary.length, 'localidades');

            return JSON.stringify(summary);
          } catch (error) {
            console.error('Error al generar resumen de cartera muerta:', error);
            return JSON.stringify([]);
          }
        }
      })
    },

    Mutation: {
      testWebhook: graphql.field({
        type: graphql.nonNull(graphql.String),
        resolve: async () => {
          console.log('🧪 Test webhook solicitado via GraphQL');
          return 'Test webhook completado - Revisa la consola del servidor';
        }
      }),

      // Nueva mutation para simular el registro de usuario de Telegram
      simulateTelegramStart: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: {
          chatId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          name: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          username: graphql.arg({ type: graphql.String })
        },
        resolve: async (root, { chatId, name, username }, context: Context) => {
          try {
            console.log('🚀 Simulando comando /start de Telegram:', { chatId, name, username });
            
            // Verificar si el usuario ya existe
            const existingUser = await (context.prisma as any).telegramUser.findUnique({
              where: { chatId }
            });

            if (existingUser) {
              console.log('✅ Usuario ya existe, actualizando actividad');
              await (context.prisma as any).telegramUser.update({
                where: { chatId },
                data: { 
                  lastActivity: new Date(),
                  isActive: true
                }
              });
              return `Usuario ${name} ya registrado. Actividad actualizada.`;
            }

            // Crear nuevo usuario
            const newUser = await (context.prisma as any).telegramUser.create({
              data: {
                chatId,
                name,
                username: username || null,
                isActive: true,
                registeredAt: new Date(),
                lastActivity: new Date(),
                reportsReceived: 0,
                isInRecipientsList: false,
                notes: 'Registrado automáticamente via comando /start'
              }
            });

            console.log('✅ Nuevo usuario de Telegram creado:', newUser);
            return `Usuario ${name} registrado exitosamente con ID: ${newUser.id}`;
            
          } catch (error) {
            console.error('❌ Error al registrar usuario de Telegram:', error);
            return `Error al registrar usuario: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // Nueva mutation para procesar webhook real de Telegram
      processTelegramWebhook: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: {
          update: graphql.arg({ type: graphql.nonNull(graphql.JSON) })
        },
        resolve: async (root, { update }, context: Context) => {
          try {
            console.log('📱 Webhook de Telegram recibido:', JSON.stringify(update, null, 2));
            
            const message = update?.message;
            if (!message) {
              return 'No se recibió mensaje válido';
            }

            const chatId = message.chat?.id?.toString();
            const text = message.text;
            const from = message.from;

            if (!chatId || !text || !from) {
              return 'Datos del mensaje incompletos';
            }

            console.log('📝 Procesando mensaje:', { chatId, text, from });

            // Procesar comando /start
            if (text === '/start') {
              const name = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
              const username = from.username;

              // Verificar si el usuario ya existe
              const existingUser = await (context.prisma as any).telegramUser.findUnique({
                where: { chatId }
              });

              if (existingUser) {
                console.log('✅ Usuario ya existe, actualizando actividad');
                await (context.prisma as any).telegramUser.update({
                  where: { chatId },
                  data: { 
                    lastActivity: new Date(),
                    isActive: true
                  }
                });
                return `Usuario ${name} ya registrado. Actividad actualizada.`;
              }

              // Crear nuevo usuario
              const newUser = await (context.prisma as any).telegramUser.create({
                data: {
                  chatId,
                  name,
                  username: username || 'sin_username',
                  isActive: true,
                  registeredAt: new Date(),
                  lastActivity: new Date(),
                  reportsReceived: 0,
                  isInRecipientsList: false,
                  notes: 'Registrado automáticamente via webhook de Telegram'
                }
              });

              console.log('✅ Nuevo usuario de Telegram creado via webhook:', newUser);
              return `Usuario ${name} registrado exitosamente via webhook con ID: ${newUser.id}`;
            }

            // Procesar otros comandos
            if (text === '/status') {
              const user = await (context.prisma as any).telegramUser.findUnique({
                where: { chatId }
              });
              
              if (user) {
                return `Estado: Activo, Registrado: ${user.registeredAt}, Reportes recibidos: ${user.reportsReceived}`;
              } else {
                return 'No estás registrado. Envía /start para registrarte.';
              }
            }

            if (text === '/help') {
              return 'Comandos disponibles:\n/start - Registrarse\n/status - Ver estado\n/vincular email - Vincular con cuenta de plataforma\n/help - Esta ayuda';
            }

            // Comando para vincular con usuario de la plataforma
            if (text.startsWith('/vincular ')) {
              const email = text.split(' ')[1];
              
              if (!email) {
                return '❌ Uso: /vincular email@ejemplo.com';
              }

              try {
                // Buscar usuario por email
                const platformUser = await (context.prisma as any).user.findUnique({
                  where: { email: email.toLowerCase() }
                });
                
                if (!platformUser) {
                  return '❌ No se encontró usuario con ese email en la plataforma';
                }

                // Verificar si ya está vinculado
                const existingUser = await (context.prisma as any).telegramUser.findUnique({
                  where: { chatId }
                });

                if (!existingUser) {
                  return '❌ Primero debes registrarte con /start';
                }

                // Vincular TelegramUser con User
                await (context.prisma as any).telegramUser.update({
                  where: { chatId },
                  data: { 
                    platformUserId: platformUser.id,
                    notes: `Vinculado con usuario: ${platformUser.name || platformUser.email}`
                  }
                });
                
                return `✅ Usuario vinculado exitosamente con: ${platformUser.name || platformUser.email}`;
                
              } catch (error) {
                console.error('❌ Error vinculando usuario:', error);
                return '❌ Error al vincular usuario. Intenta nuevamente.';
              }
            }

            return `Comando no reconocido: ${text}. Envía /help para ver comandos disponibles.`;
            
          } catch (error) {
            console.error('❌ Error al procesar webhook de Telegram:', error);
            return `Error al procesar webhook: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // Nueva mutation para enviar reportes a usuarios de Telegram
      sendTelegramReport: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: {
          reportType: graphql.arg({ type: graphql.nonNull(graphql.String) }),
          reportData: graphql.arg({ type: graphql.nonNull(graphql.JSON) }),
          recipients: graphql.arg({ type: graphql.list(graphql.nonNull(graphql.String)) })
        },
        resolve: async (root, { reportType, reportData, recipients }, context: Context) => {
          try {
            console.log('📊 Enviando reporte de Telegram:', { reportType, reportData, recipients });
            
            // Obtener usuarios destinatarios
            let targetUsers;
            if (recipients && recipients.length > 0) {
              // Enviar a usuarios específicos
              targetUsers = await (context.prisma as any).telegramUser.findMany({
                where: {
                  chatId: { in: recipients },
                  isActive: true
                }
              });
            } else {
              // Enviar a todos los usuarios en la lista de destinatarios
              targetUsers = await (context.prisma as any).telegramUser.findMany({
                where: {
                  isInRecipientsList: true,
                  isActive: true
                }
              });
            }

            if (targetUsers.length === 0) {
              return 'No hay usuarios destinatarios activos para enviar el reporte';
            }

            console.log(`📤 Enviando reporte a ${targetUsers.length} usuarios`);

            // Generar contenido del reporte
            const reportContent = generateReportContent(reportType, reportData);
            
            // Enviar a cada usuario
            let successCount = 0;
            let errorCount = 0;

            for (const user of targetUsers) {
              try {
                const sent = await sendTelegramMessageToUser(user.chatId, reportContent);
                if (sent) {
                  successCount++;
                  // Actualizar contador de reportes recibidos
                  await (context.prisma as any).telegramUser.update({
                    where: { id: user.id },
                    data: { reportsReceived: { increment: 1 } }
                  });
                } else {
                  errorCount++;
                }
              } catch (error) {
                console.error(`❌ Error enviando reporte a ${user.name}:`, error);
                errorCount++;
              }
            }

            const result = `Reporte enviado: ${successCount} exitosos, ${errorCount} fallidos`;
            console.log('✅', result);
            return result;
            
          } catch (error) {
            console.error('❌ Error al enviar reporte de Telegram:', error);
            return `Error al enviar reporte: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),

      // Mutation simple para enviar reporte ahora
      sendReportNow: graphql.field({
        type: graphql.nonNull(graphql.String),
        args: {
          configId: graphql.arg({ type: graphql.nonNull(graphql.ID) })
        },
        resolve: async (root, { configId }, context: Context) => {
          try {
            console.log('🚀 sendReportNow llamado con configId:', configId);
            
            // Obtener la configuración del reporte
            const reportConfig = await (context.prisma as any).reportConfig.findUnique({
              where: { id: configId }
            });

            if (!reportConfig) {
              return 'Configuración de reporte no encontrada';
            }

            if (!reportConfig.isActive) {
              return 'La configuración del reporte no está activa';
            }

            // Obtener usuarios de la plataforma que son destinatarios
            const platformRecipients = await (context.prisma as any).user.findMany({
              where: {
                id: { in: reportConfig.recipients?.map(r => r.id) || [] }
              }
            });

            if (!platformRecipients || platformRecipients.length === 0) {
              return 'No hay destinatarios configurados';
            }

            // Generar contenido del reporte
            let reportContent = '';
            switch (reportConfig.reportType) {
              case 'creditos_con_errores':
                reportContent = '📋 REPORTE: Créditos con Documentos con Error\n\nReporte generado automáticamente';
                break;
              case 'creditos_sin_documentos':
                reportContent = '⚠️ REPORTE: Créditos Sin Documentos\n\nReporte generado automáticamente';
                break;
              case 'creditos_completos':
                reportContent = '✅ REPORTE: Créditos Completos\n\nReporte generado automáticamente';
                break;
              case 'resumen_semanal':
                reportContent = '📊 REPORTE: Resumen Semanal de Cartera\n\nReporte generado automáticamente';
                break;
              case 'reporte_financiero':
                reportContent = '💰 REPORTE: Reporte Financiero\n\nReporte generado automáticamente';
                break;
              default:
                reportContent = `📊 REPORTE: ${reportConfig.reportType}\n\nReporte generado automáticamente`;
            }

            // Buscar usuarios de Telegram activos para cada destinatario
            let sentCount = 0;
            for (const recipient of platformRecipients) {
              try {
                // Buscar si el usuario tiene Telegram configurado
                const telegramUser = await (context.prisma as any).telegramUser.findFirst({
                  where: {
                    platformUser: { id: recipient.id },
                    isActive: true
                  }
                });

                if (telegramUser && telegramUser.isActive) {
                  const sent = await sendTelegramMessageToUser(telegramUser.chatId, reportContent);
                  if (sent) {
                    sentCount++;
                    console.log(`✅ Enviado a ${recipient.name}`);
                  }
                } else {
                  console.log(`⚠️ Usuario ${recipient.name} no tiene Telegram configurado`);
                }
              } catch (error) {
                console.error(`❌ Error procesando usuario ${recipient.name}:`, error);
              }
            }

            return `Reporte enviado exitosamente a ${sentCount} destinatarios`;
          } catch (error) {
            console.error('❌ Error:', error);
            return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }
      }),
    }
  };
});

// Funciones auxiliares para Telegram
function generateReportContent(reportType: string, reportData: any): string {
  switch (reportType) {
    case 'creditos_con_documentos':
      return `📋 REPORTE: Créditos con Documentos\n\n${JSON.stringify(reportData, null, 2)}`;
    
    case 'cartera_vencida':
      return `⚠️ REPORTE: Cartera Vencida\n\n${JSON.stringify(reportData, null, 2)}`;
    
    case 'resumen_financiero':
      return `💰 REPORTE: Resumen Financiero\n\n${JSON.stringify(reportData, null, 2)}`;
    
    default:
      return `📊 REPORTE: ${reportType}\n\n${JSON.stringify(reportData, null, 2)}`;
  }
}

async function sendTelegramMessageToUser(chatId: string, text: string): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.log('❌ TELEGRAM_BOT_TOKEN no configurado');
      return false;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });

    if (response.ok) {
      console.log('✅ Mensaje enviado a Telegram:', text.substring(0, 100) + '...');
      return true;
    } else {
      console.error('❌ Error al enviar mensaje a Telegram:', response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error al enviar mensaje a Telegram:', error);
    return false;
  }
}

// ✅ FUNCIÓN PARA GENERAR PDF DE PRUEBA (VERSIÓN CORREGIDA)
function generateTestPDF(reportType: string, data: any = {}): Buffer {
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    
    // Configurar eventos para capturar el PDF
    doc.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    // Configurar el documento
    doc.fontSize(20).text('📊 REPORTE AUTOMÁTICO', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`Tipo: ${reportType}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generado: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Agregar contenido específico según el tipo de reporte
    switch (reportType) {
      case 'creditos_con_errores':
        doc.fontSize(14).text('📋 CRÉDITOS CON DOCUMENTOS CON ERROR');
        doc.moveDown();
        doc.fontSize(12).text('Este reporte muestra todos los créditos que tienen documentos con errores.');
        doc.moveDown();
        doc.text('• Verificar documentación faltante');
        doc.text('• Revisar formatos incorrectos');
        doc.text('• Validar información requerida');
        doc.moveDown();
        doc.text('• Documentos pendientes de revisión');
        doc.text('• Errores de formato detectados');
        doc.text('• Información incompleta identificada');
        break;
        
      case 'creditos_sin_documentos':
        doc.fontSize(14).text('⚠️ CRÉDITOS SIN DOCUMENTOS');
        doc.moveDown();
        doc.fontSize(12).text('Este reporte identifica créditos que no tienen documentación completa.');
        doc.moveDown();
        doc.text('• Documentos pendientes de entrega');
        doc.text('• Información faltante del cliente');
        doc.text('• Requisitos no cumplidos');
        doc.moveDown();
        doc.text('• Acta de nacimiento pendiente');
        doc.text('• DUI no entregado');
        doc.text('• Comprobante de domicilio faltante');
        break;
        
      case 'creditos_completos':
        doc.fontSize(14).text('✅ CRÉDITOS COMPLETOS');
        doc.moveDown();
        doc.fontSize(12).text('Este reporte muestra todos los créditos con documentación completa.');
        doc.moveDown();
        doc.text('• Documentación al 100%');
        doc.text('• Información verificada');
        doc.text('• Listos para procesamiento');
        doc.moveDown();
        doc.text('• Todos los documentos entregados');
        doc.text('• Información validada');
        doc.text('• Cumple requisitos legales');
        break;
        
      case 'resumen_semanal':
        doc.fontSize(14).text('📊 RESUMEN SEMANAL DE CARTERA');
        doc.moveDown();
        doc.fontSize(12).text('Resumen de la actividad semanal de la cartera de créditos.');
        doc.moveDown();
        doc.text('• Nuevos créditos otorgados');
        doc.text('• Pagos recibidos');
        doc.text('• Estado general de la cartera');
        doc.moveDown();
        doc.text('• Monto total desembolsado');
        doc.text('• Número de clientes atendidos');
        doc.text('• Rendimiento semanal');
        break;
        
      case 'reporte_financiero':
        doc.fontSize(14).text('💰 REPORTE FINANCIERO');
        doc.moveDown();
        doc.fontSize(12).text('Análisis financiero detallado de la cartera de créditos.');
        doc.moveDown();
        doc.text('• Ingresos y egresos');
        doc.text('• Rentabilidad por ruta');
        doc.text('• Proyecciones financieras');
        doc.moveDown();
        doc.text('• Balance general');
        doc.text('• Flujo de caja');
        doc.text('• Indicadores de rentabilidad');
        break;
        
      default:
        doc.fontSize(14).text(`📊 REPORTE: ${reportType.toUpperCase()}`);
        doc.moveDown();
        doc.fontSize(12).text('Reporte generado automáticamente por el sistema.');
        doc.moveDown();
        doc.text('• Información del reporte');
        doc.text('• Datos procesados');
        doc.text('• Resumen ejecutivo');
    }
    
    doc.moveDown(2);
    doc.fontSize(10).text('✅ Generado automáticamente desde Keystone Admin', { align: 'center' });
    doc.fontSize(8).text(`ID del reporte: ${Date.now()}`, { align: 'center' });
    doc.fontSize(8).text(`Versión: 1.0`, { align: 'center' });
    
    // Finalizar el documento
    doc.end();
    
    // Esperar un momento para que se procese
    setTimeout(() => {}, 100);
    
    const result = Buffer.concat(chunks);
    console.log('📱 PDF generado exitosamente, tamaño:', result.length, 'bytes');
    
    return result;
  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    // Retornar un buffer con contenido de error
    return Buffer.from(`Error generando PDF: ${error.message}`);
  }
}

// ✅ FUNCIÓN ALTERNATIVA PARA GENERAR PDF (USANDO STREAMS)
async function generatePDFWithStreams(reportType: string, context: Context, routeIds: string[] = []): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      
      // Configurar eventos para capturar el PDF
      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        console.log('📱 PDF generado con streams, tamaño:', result.length, 'bytes');
        resolve(result);
      });
      
      // El header específico se genera en cada función de reporte
      // No agregar contenido genérico aquí
      
      // Agregar contenido específico según el tipo de reporte
      console.log('🎯 Determinando tipo de reporte:', `"${reportType}"`);
      switch (reportType) {
        case 'creditos_con_errores':
          console.log('✅ ENTRANDO A CASO creditos_con_errores');
          try {
            await generateCreditsWithDocumentErrorsReport(doc, context, routeIds);
            console.log('✅ FUNCIÓN generateCreditsWithDocumentErrorsReport COMPLETADA');
          } catch (reportError) {
            console.error('❌ Error en generateCreditsWithDocumentErrorsReport:', reportError);
            doc.fontSize(16).text('Error generando reporte detallado', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text('Se produjo un error al generar el reporte.', { align: 'center' });
            doc.text('Revisa los logs del servidor para más detalles.', { align: 'center' });
          }
          break;
          
        default:
          console.log('⚠️ USANDO CASO DEFAULT para tipo:', reportType);
          doc.fontSize(14).text(`📊 REPORTE: ${reportType.toUpperCase()}`);
          doc.moveDown();
          doc.fontSize(12).text('Reporte generado automáticamente por el sistema.');
      }
      
      // Footer se agrega en cada función específica si es necesario
      
      // Finalizar el documento
      doc.end();
      
    } catch (error) {
      console.error('❌ Error generando PDF con streams:', error);
      reject(error);
    }
  });
}

// ✅ FUNCIÓN PARA GENERAR REPORTE DE CRÉDITOS CON DOCUMENTOS CON ERROR (USANDO FUNCIÓN UNIFICADA)
async function generateCreditsWithDocumentErrorsReport(doc: any, context: Context, routeIds: string[] = []) {
  try {
    console.log('🎯🎯🎯 FUNCIÓN generateCreditsWithDocumentErrorsReport INICIADA (USANDO FUNCIÓN UNIFICADA) 🎯🎯🎯');
    console.log('📋 Generando reporte de créditos con documentos con error para rutas:', routeIds);
    
    // ✅ GENERAR CONTENIDO DIRECTAMENTE EN EL DOCUMENTO EXISTENTE
    // No usar función unificada que genera PDF completo, sino generar contenido en el doc actual
    await generateCreditsWithDocumentErrorsReportContent(doc, context, routeIds);
    
  } catch (error) {
    console.error('❌ Error generando reporte de créditos con errores:', error);
    doc.fontSize(12).text(`❌ Error generando reporte: ${error instanceof Error ? error.message : 'Unknown error'}`, { align: 'center' });
  }
}

// ✅ NUEVA FUNCIÓN MEJORADA PARA GENERAR CONTENIDO DEL REPORTE DIRECTAMENTE EN EL DOCUMENTO
async function generateCreditsWithDocumentErrorsReportContent(doc: any, context: Context, routeIds: string[] = []) {
  try {
    console.log('🎯 Iniciando generación de reporte de créditos con documentos con error...');
    
    // Calcular fecha de hace 2 meses
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    // Filtro de rutas específicas si se proporcionan
    const routeFilter = routeIds.length > 0 ? {
      lead: {
        routes: {
          id: { in: routeIds }
        }
      }
    } : {};
    
    // Obtener todos los créditos de los últimos 2 meses con información completa
    const allRecentCredits = await context.prisma.loan.findMany({
      where: {
        signDate: {
          gte: twoMonthsAgo
        },
        ...routeFilter
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
            routes: true,
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
        documentPhotos: true,
        collaterals: {
          include: {
            documentPhotos: true
          }
        }
      },
      orderBy: [
        { signDate: 'desc' }
      ]
    });

    console.log(`📊 Encontrados ${allRecentCredits.length} créditos en los últimos 2 meses`);

    // Procesar y organizar datos para la tabla
    const tableData: any[] = [];
    
    for (const credit of allRecentCredits) {
      const locality = credit.borrower?.personalData?.addresses?.[0]?.location?.name ||
                      credit.lead?.personalData?.addresses?.[0]?.location?.name ||
                      'Sin localidad';
      
      const routeName = credit.lead?.routes?.name || 'Sin ruta';
      const clientName = credit.borrower?.personalData?.fullName || 'Sin nombre';
      const signDate = new Date(credit.signDate);
      
      // Analizar documentos del cliente
      const clientDocuments = credit.documentPhotos || [];
      const clientDocErrors = clientDocuments.filter(doc => doc.isError);
      
      // Verificar documentos faltantes del cliente
      const requiredDocTypes = ['INE', 'DOMICILIO', 'PAGARE'];
      const clientAvailableTypes = clientDocuments.map(doc => doc.documentType);
      const clientMissingDocs = requiredDocTypes.filter(type => !clientAvailableTypes.includes(type));
      
      // Analizar documentos del aval (si existe)
      const avalDocuments = credit.collaterals?.[0]?.documentPhotos || [];
      const avalDocErrors = avalDocuments.filter(doc => doc.isError);
      const avalAvailableTypes = avalDocuments.map(doc => doc.documentType);
      const avalMissingDocs = requiredDocTypes.filter(type => !avalAvailableTypes.includes(type));
      
      // Solo incluir si hay problemas
      const hasClientProblems = clientDocErrors.length > 0 || clientMissingDocs.length > 0;
      const hasAvalProblems = avalDocErrors.length > 0 || avalMissingDocs.length > 0;
      
      if (hasClientProblems || hasAvalProblems) {
        // Agregar fila para problemas del cliente
        if (hasClientProblems) {
          const errorDescriptions = clientDocErrors.map(doc => `${doc.documentType} con error`);
          const missingDescriptions = clientMissingDocs.map(type => `${type} faltante`);
          const allProblems = [...errorDescriptions, ...missingDescriptions];
          
          const detailedObservations = clientDocErrors
            .map(doc => doc.errorDescription)
            .filter(Boolean)
            .join('; ') || 'Sin observaciones específicas';
          
          tableData.push({
            locality,
            routeName,
            clientName,
            signDate,
            problemType: 'CLIENTE',
            problemDescription: allProblems.join('; '),
            observations: detailedObservations
          });
        }
        
        // Agregar fila para problemas del aval
        if (hasAvalProblems && credit.collaterals?.[0]) {
          const avalName = credit.collaterals[0].fullName || 'Aval sin nombre';
          const avalErrorDescriptions = avalDocErrors.map(doc => `${doc.documentType} con error`);
          const avalMissingDescriptions = avalMissingDocs.map(type => `${type} faltante`);
          const allAvalProblems = [...avalErrorDescriptions, ...avalMissingDescriptions];
          
          const avalDetailedObservations = avalDocErrors
            .map(doc => doc.errorDescription)
            .filter(Boolean)
            .join('; ') || 'Sin observaciones específicas';
          
          tableData.push({
            locality,
            routeName,
            clientName: `${clientName} (Aval: ${avalName})`,
            signDate,
            problemType: 'AVAL',
            problemDescription: allAvalProblems.join('; '),
            observations: avalDetailedObservations
          });
        }
      }
    }

    console.log(`📊 Procesados ${tableData.length} registros con problemas de documentos`);
    
    // Generar header profesional moderno
    await addModernCompanyHeader(doc);
    
    // Título principal del reporte
    doc.fontSize(22).fillColor('#1e40af').text('REPORTE DE CRÉDITOS CON DOCUMENTOS CON ERROR', 50, doc.y, { 
      width: 500, 
      align: 'center' 
    });
    doc.moveDown(1.5);
    
    // Información del período
    const reportStartDate = new Date();
    reportStartDate.setMonth(reportStartDate.getMonth() - 2);
    doc.fontSize(12).fillColor('#64748b').text(`Período de Análisis: ${reportStartDate.toLocaleDateString('es-ES')} - ${new Date().toLocaleDateString('es-ES')}`, 50, doc.y, { 
      width: 500, 
      align: 'center' 
    });
    
    // Información de rutas
    if (routeIds.length > 0) {
      doc.fontSize(10).fillColor('#64748b').text(`Rutas analizadas: ${routeIds.length} ruta(s) específica(s)`, { align: 'center' });
    } else {
      doc.fontSize(10).fillColor('#64748b').text('Análisis: Todas las rutas del sistema', { align: 'center' });
    }
    
    doc.moveDown(2);

    // Si no hay datos reales, mostrar mensaje de éxito
    if (tableData.length === 0) {
      console.log('✅ No se encontraron problemas de documentos - generando mensaje de éxito');
      
      // Caja de estado exitoso con diseño moderno
      const successBoxY = doc.y;
      const successBoxHeight = 120;
      
      // Fondo con gradiente simulado
      doc.fillColor('#f0fdf4').rect(50, successBoxY, 500, successBoxHeight).fill();
      doc.strokeColor('#16a34a').lineWidth(3).rect(50, successBoxY, 500, successBoxHeight).stroke();
      
      // Icono y título
      doc.fontSize(32).fillColor('#16a34a').text('✓', 70, successBoxY + 20, { width: 50, align: 'center' });
      doc.fontSize(18).fillColor('#16a34a').text('EXCELENTE NOTICIA', 130, successBoxY + 25, { width: 350, align: 'left' });
      
      doc.fontSize(14).fillColor('#15803d').text('No se encontraron créditos con documentos con error', 70, successBoxY + 55, { width: 460, align: 'center' });
      doc.text('en el período especificado.', 70, successBoxY + 75, { width: 460, align: 'center' });
      
      doc.fontSize(11).fillColor('#166534').text('✓ Todos los créditos tienen su documentación completa y correcta', 70, successBoxY + 95, { width: 460, align: 'center' });
      
      return;
    }

    console.log(`📊 Generando tabla moderna con ${tableData.length} registros...`);
    
    // Generar estadísticas de resumen antes de la tabla
    await generateExecutiveSummary(doc, tableData);
    
    // Generar tabla moderna mejorada
    await generateModernDocumentErrorTable(doc, tableData);
    
    console.log('✅ Reporte de créditos con errores generado exitosamente');
    
  } catch (error) {
    console.error('❌ Error generando contenido del reporte:', error);
    doc.fontSize(12).fillColor('#dc2626').text(`❌ Error generando reporte: ${error instanceof Error ? error.message : 'Unknown error'}`, { align: 'center' });
  }
}

// ✅ FUNCIÓN PARA AGREGAR HEADER MODERNO DE LA EMPRESA
async function addModernCompanyHeader(doc: any): Promise<void> {
  try {
    // Fondo del header con gradiente azul
    doc.fillColor('#1e40af').rect(0, 0, 612, 90).fill();
    doc.fillColor('#3b82f6').rect(0, 70, 612, 20).fill();
    
    // Logo y nombre de la empresa
    doc.fontSize(28).fillColor('white').text('SOLUFÁCIL', 50, 25, { align: 'left' });
    doc.fontSize(11).fillColor('#e0f2fe').text('SISTEMA DE GESTIÓN DE CRÉDITOS', 50, 58);
    
    // Información de generación en la esquina derecha
    doc.fontSize(9).fillColor('white');
    const currentDate = new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generado: ${currentDate}`, 350, 25, { align: 'right', width: 200 });
    doc.text('Reporte Oficial', 350, 40, { align: 'right', width: 200 });
    doc.text('Confidencial', 350, 55, { align: 'right', width: 200 });
    
    // Línea divisoria elegante
    doc.strokeColor('#60a5fa').lineWidth(3).moveTo(50, 95).lineTo(562, 95).stroke();
    
    // Espacio después del header
    doc.y = 110;
    doc.fillColor('black'); // Resetear color a negro
    
  } catch (error) {
    console.error('Error agregando header moderno:', error);
    // Fallback simple si hay error
    doc.fontSize(18).fillColor('#1e40af').text('SOLUFÁCIL - REPORTE DE CRÉDITOS', 50, 50, { align: 'center' });
    doc.y = 80;
    doc.fillColor('black');
  }
}

// ✅ FUNCIÓN PARA GENERAR RESUMEN EJECUTIVO MODERNO
async function generateExecutiveSummary(doc: any, tableData: any[]): Promise<void> {
  try {
    // Calcular estadísticas
    const totalCredits = new Set(tableData.map(row => row.clientName.split(' (Aval:')[0])).size;
    const totalWithClientErrors = tableData.filter(row => row.problemType === 'CLIENTE').length;
    const totalWithAvalErrors = tableData.filter(row => row.problemType === 'AVAL').length;
    const totalLocalities = new Set(tableData.map(row => row.locality)).size;
    const totalRoutes = new Set(tableData.map(row => row.routeName)).size;
    
    // Título del resumen
    doc.fontSize(16).fillColor('#1e40af').text('RESUMEN EJECUTIVO', 50, doc.y, { width: 500, align: 'center' });
    doc.moveDown(1);
    
    // Caja principal de estadísticas con diseño moderno
    const statsBoxY = doc.y;
    const statsBoxHeight = 100;
    
    // Fondo de la caja
    doc.fillColor('#f8fafc').rect(50, statsBoxY, 500, statsBoxHeight).fill();
    doc.strokeColor('#1e40af').lineWidth(2).rect(50, statsBoxY, 500, statsBoxHeight).stroke();
    
    // Estadísticas en grid de 3x2
    const statItems = [
      { label: 'Clientes Afectados', value: totalCredits.toString(), color: '#dc2626' },
      { label: 'Problemas Cliente', value: totalWithClientErrors.toString(), color: '#ea580c' },
      { label: 'Problemas Aval', value: totalWithAvalErrors.toString(), color: '#d97706' },
      { label: 'Localidades', value: totalLocalities.toString(), color: '#059669' },
      { label: 'Rutas', value: totalRoutes.toString(), color: '#0284c7' },
      { label: 'Total Registros', value: tableData.length.toString(), color: '#7c3aed' }
    ];
    
    // Dibujar estadísticas en grid
    statItems.forEach((stat, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 70 + (col * 150);
      const y = statsBoxY + 20 + (row * 35);
      
      doc.fontSize(20).fillColor(stat.color).text(stat.value, x, y, { width: 130, align: 'center' });
      doc.fontSize(9).fillColor('#374151').text(stat.label, x, y + 25, { width: 130, align: 'center' });
    });
    
    doc.y = statsBoxY + statsBoxHeight + 20;
    
    // Desglose por tipo de documento
    doc.fontSize(14).fillColor('#1e40af').text('ANÁLISIS POR TIPO DE DOCUMENTO', 50, doc.y, { width: 500, align: 'left' });
    doc.moveDown(1);
    
    const problemTypes = ['INE', 'DOMICILIO', 'PAGARE'];
    const docStatsY = doc.y;
    
    problemTypes.forEach((docType, index) => {
      const clientProblems = tableData.filter(row => 
        row.problemType === 'CLIENTE' && row.problemDescription.includes(docType)
      ).length;
      const avalProblems = tableData.filter(row => 
        row.problemType === 'AVAL' && row.problemDescription.includes(docType)
      ).length;
      
      if (clientProblems > 0 || avalProblems > 0) {
        const y = docStatsY + (index * 20);
        doc.fontSize(11).fillColor('#374151');
        doc.text(`• ${docType}:`, 70, y, { width: 80, align: 'left' });
        doc.text(`${clientProblems} clientes`, 150, y, { width: 100, align: 'left' });
        doc.text(`${avalProblems} avales`, 250, y, { width: 100, align: 'left' });
        doc.fillColor(clientProblems > avalProblems ? '#dc2626' : '#ea580c');
        doc.text(`${clientProblems + avalProblems} total`, 350, y, { width: 100, align: 'left' });
      }
    });
    
    doc.y = docStatsY + (problemTypes.length * 20) + 20;
    doc.fillColor('black');
    
  } catch (error) {
    console.error('Error generando resumen ejecutivo:', error);
    doc.fontSize(12).text('Error generando resumen ejecutivo', { align: 'center' });
  }
}

// ✅ FUNCIÓN PARA GENERAR TABLA MODERNA DE DOCUMENTOS CON ERROR
async function generateModernDocumentErrorTable(doc: any, tableData: any[]): Promise<void> {
  try {
    console.log('🎨 Iniciando generación de tabla moderna...');
    
    // Configuración de la tabla moderna (usando todo el ancho disponible)
    const pageWidth = 512; // Ancho total disponible (612 - 100 márgenes)
    const startX = 50;
    const headerHeight = 35;
    const rowHeight = 50;
    let currentY = doc.y;
    
    // Configuración de columnas con más espacio para observaciones
    const columns = [
      { header: 'RUTA', width: 60, align: 'left' },
      { header: 'LOCALIDAD', width: 90, align: 'left' },
      { header: 'CLIENTE', width: 130, align: 'left' },
      { header: 'TIPO', width: 50, align: 'center' },
      { header: 'PROBLEMAS', width: 90, align: 'left' },
      { header: 'OBSERVACIONES', width: 192, align: 'left' }
    ];
    
    // Función para dibujar header moderno
    const drawModernTableHeader = (y: number) => {
      // Fondo del header con gradiente azul
      doc.fillColor('#1e40af').rect(startX, y, pageWidth, headerHeight).fill();
      doc.fillColor('#3b82f6').rect(startX, y + headerHeight - 5, pageWidth, 5).fill();
      
      // Bordes del header
      doc.strokeColor('#1e40af').lineWidth(2).rect(startX, y, pageWidth, headerHeight).stroke();
      
      // Texto del header
      doc.fillColor('white').fontSize(10);
      let x = startX;
      columns.forEach((col, index) => {
        if (index > 0) {
          // Líneas divisorias verticales
          doc.strokeColor('#60a5fa').lineWidth(1);
          doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke();
        }
        doc.text(col.header, x + 8, y + 12, { 
          width: col.width - 16, 
          align: col.align === 'center' ? 'center' : 'left' 
        });
        x += col.width;
      });
      
      doc.fillColor('black');
      return y + headerHeight;
    };
    
    // Función para dibujar fila moderna
    const drawModernTableRow = (data: any, y: number, isShaded: boolean = false) => {
      if (!data) return y + rowHeight;
      
      // Fondo alternado moderno
      if (isShaded) {
        doc.fillColor('#f1f5f9').rect(startX, y, pageWidth, rowHeight).fill();
      } else {
        doc.fillColor('white').rect(startX, y, pageWidth, rowHeight).fill();
      }
      
      // Bordes de la fila
      doc.strokeColor('#e2e8f0').lineWidth(1).rect(startX, y, pageWidth, rowHeight).stroke();
      
      // Preparar datos para las celdas
      const cellData = [
        data.routeName || 'N/A',
        data.locality || 'N/A', 
        data.clientName || 'N/A',
        data.problemType || 'N/A',
        data.problemDescription || 'N/A',
        data.observations || 'N/A'
      ];
      
      // Dibujar celdas con contenido optimizado
      let x = startX;
      columns.forEach((col, index) => {
        if (index > 0) {
          // Líneas divisorias verticales
          doc.strokeColor('#e2e8f0').lineWidth(0.5);
          doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
        }
        
        let cellText = cellData[index] || 'N/A';
        
        // Columna de tipo con color
        if (index === 3) {
          const bgColor = cellText === 'CLIENTE' ? '#dcfce7' : '#fef3c7';
          const textColor = cellText === 'CLIENTE' ? '#166534' : '#92400e';
          
          doc.fillColor(bgColor).rect(x + 2, y + 15, col.width - 4, 20).fill();
          doc.strokeColor(textColor).lineWidth(1).rect(x + 2, y + 15, col.width - 4, 20).stroke();
          doc.fontSize(9).fillColor(textColor).text(cellText, x + 4, y + 22, { 
            width: col.width - 8, 
            align: 'center' 
          });
        }
        // Columna de problemas con formato especial
        else if (index === 4) {
          const problems = cellText.split(';').filter(p => p.trim());
          doc.fontSize(8);
          let textY = y + 8;
          
          for (let i = 0; i < Math.min(problems.length, 3); i++) {
            const problem = problems[i].trim();
            if (textY < y + rowHeight - 10) {
                          if (problem.includes('con error')) {
              doc.fillColor('#dc2626');
              doc.text(`ERROR: ${problem.replace('con error', '').trim()}`, x + 4, textY, { width: col.width - 8 });
            } else if (problem.includes('faltante')) {
              doc.fillColor('#ea580c');
              doc.text(`FALTA: ${problem.replace('faltante', '').trim()}`, x + 4, textY, { width: col.width - 8 });
              } else {
                doc.fillColor('#374151');
                doc.text(`• ${problem}`, x + 4, textY, { width: col.width - 8 });
              }
              textY += 12;
            }
          }
          
          if (problems.length > 3) {
            doc.fontSize(7).fillColor('#64748b');
            doc.text(`+${problems.length - 3} más...`, x + 4, textY, { width: col.width - 8 });
          }
        }
        // Otras columnas con formato estándar
        else {
          doc.fillColor('#374151');
          
          // Formato estándar para todas las columnas
          doc.fontSize(index === 5 ? 8 : 9); // Observaciones más pequeñas
          
          // Solo para observaciones: ocultar el texto por defecto
          if (index === 5 && cellText === 'Sin observaciones específicas') {
            cellText = ''; // Mostrar vacío en lugar del texto por defecto
          }
          
          // Truncar texto si es muy largo (excepto observaciones)
          if (index !== 5 && cellText.length > 25) {
            cellText = cellText.substring(0, 22) + '...';
          }
          
          doc.text(cellText, x + 8, y + (index === 5 ? 12 : 18), { 
            width: col.width - 16,
            ellipsis: index !== 5, // No truncar observaciones
            lineBreak: index === 5, // Solo multilínea para observaciones
            height: index === 5 ? rowHeight - 20 : undefined
          });
        }
        
        x += col.width;
      });
      
      doc.fillColor('black');
      return y + rowHeight;
    };
    
    // Título de la tabla
    doc.fontSize(14).fillColor('#1e40af').text('DETALLE DE PROBLEMAS DOCUMENTALES', 50, currentY, { width: 500, align: 'left' });
    doc.moveDown(1);
    currentY = doc.y;
    
    // Dibujar header de la tabla
    currentY = drawModernTableHeader(currentY);
    
    // Agrupar datos por semana para mejor organización
    const weekGroups = new Map<string, any[]>();
    tableData.forEach(row => {
      const weekStart = getWeekStart(row.signDate);
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weekGroups.has(weekKey)) {
        weekGroups.set(weekKey, []);
      }
      weekGroups.get(weekKey)!.push(row);
    });
    
    // Procesar datos por semana
    const sortedWeeks = Array.from(weekGroups.keys()).sort().reverse();
    let isWeekShaded = false;
    let recordCount = 0;
    
    for (const weekKey of sortedWeeks) {
      const weekData = weekGroups.get(weekKey) || [];
      const weekStart = new Date(weekKey);
      
      // Nueva página si es necesario
      if (currentY > 650) {
        doc.addPage();
        await addModernCompanyHeader(doc);
        doc.fontSize(16).fillColor('#1e40af').text('REPORTE DE CRÉDITOS (Continuación)', 50, doc.y, { align: 'center' });
        doc.moveDown(2);
        currentY = doc.y;
        currentY = drawModernTableHeader(currentY);
      }
      
      // Header de semana con diseño moderno
      const weekHeaderY = currentY;
      doc.fillColor('#e0f2fe').rect(startX, weekHeaderY, pageWidth, 25).fill();
      doc.strokeColor('#0284c7').lineWidth(1).rect(startX, weekHeaderY, pageWidth, 25).stroke();
      
      doc.fontSize(11).fillColor('#0284c7');
      doc.text(`Semana del ${weekStart.toLocaleDateString('es-ES')}`, startX + 10, weekHeaderY + 8);
      doc.text(`(${weekData.length} registro${weekData.length !== 1 ? 's' : ''})`, startX + 300, weekHeaderY + 8);
      
      currentY = weekHeaderY + 25;
      
      // Dibujar filas de la semana
      for (const rowData of weekData) {
        if (currentY > 650) {
          doc.addPage();
          await addModernCompanyHeader(doc);
          currentY = doc.y;
          currentY = drawModernTableHeader(currentY);
        }
        
        currentY = drawModernTableRow(rowData, currentY, isWeekShaded);
        recordCount++;
      }
      
      // Alternar sombreado por semana
      isWeekShaded = !isWeekShaded;
      
      // Separador entre semanas
      if (weekKey !== sortedWeeks[sortedWeeks.length - 1]) {
        doc.strokeColor('#0284c7').lineWidth(1);
        doc.moveTo(startX, currentY + 5).lineTo(startX + pageWidth, currentY + 5).stroke();
        currentY += 15;
      }
    }
    
    console.log(`✅ Tabla moderna completada con ${recordCount} registros`);
    
    // Agregar página de resumen final si hay datos
    if (tableData.length > 0) {
      doc.addPage();
      await addModernCompanyHeader(doc);
      await generateFinalActionSummary(doc, tableData);
    }
    
  } catch (error) {
    console.error('Error generando tabla moderna:', error);
    doc.fontSize(12).text('Error generando tabla de documentos', { align: 'center' });
  }
}

// ✅ FUNCIÓN PARA GENERAR RESUMEN FINAL DE ACCIONES
async function generateFinalActionSummary(doc: any, tableData: any[]): Promise<void> {
  try {
    doc.fontSize(18).fillColor('#1e40af').text('PLAN DE ACCIÓN RECOMENDADO', 50, doc.y, { width: 500, align: 'center' });
    doc.moveDown(2);
    
    // Caja de acción prioritaria
    const actionBoxY = doc.y;
    const actionBoxHeight = 80;
    
    doc.fillColor('#fef2f2').rect(50, actionBoxY, 500, actionBoxHeight).fill();
    doc.strokeColor('#dc2626').lineWidth(3).rect(50, actionBoxY, 500, actionBoxHeight).stroke();
    
    doc.fontSize(14).fillColor('#dc2626').text('🚨 ACCIÓN INMEDIATA REQUERIDA', 70, actionBoxY + 15, { width: 460, align: 'left' });
    doc.fontSize(11).fillColor('#7f1d1d');
    doc.text('1. Contactar a todos los clientes listados para completar documentación', 70, actionBoxY + 35, { width: 460 });
    doc.text('2. Verificar calidad de fotografías y legibilidad de documentos', 70, actionBoxY + 50, { width: 460 });
    doc.text('3. Los créditos no pueden proceder sin documentación completa', 70, actionBoxY + 65, { width: 460 });
    
    doc.y = actionBoxY + actionBoxHeight + 30;
    
    // Estadísticas de prioridad
    const priorityStats = [
      { 
        label: 'ALTA PRIORIDAD', 
        count: tableData.filter(r => r.problemDescription.includes('faltante')).length,
        description: 'Documentos completamente faltantes',
        color: '#dc2626'
      },
      { 
        label: 'MEDIA PRIORIDAD', 
        count: tableData.filter(r => r.problemDescription.includes('con error')).length,
        description: 'Documentos con errores que requieren corrección',
        color: '#ea580c'
      }
    ];
    
    priorityStats.forEach((priority, index) => {
      const y = doc.y + (index * 40);
      
      // Caja de prioridad
      doc.fillColor(priority.color).rect(50, y, 20, 20).fill();
      doc.fontSize(12).fillColor('white').text(priority.count.toString(), 55, y + 6, { width: 10, align: 'center' });
      
      doc.fontSize(12).fillColor(priority.color).text(priority.label, 80, y + 2, { width: 150 });
      doc.fontSize(10).fillColor('#374151').text(priority.description, 80, y + 16, { width: 400 });
    });
    
    doc.y += (priorityStats.length * 40) + 20;
    
    // Footer con información de contacto
    const footerY = doc.y;
    doc.fillColor('#f8fafc').rect(50, footerY, 500, 60).fill();
    doc.strokeColor('#64748b').lineWidth(1).rect(50, footerY, 500, 60).stroke();
    
    doc.fontSize(10).fillColor('#64748b').text('📞 Para más información sobre este reporte, contacte al administrador del sistema', 70, footerY + 15, { width: 460, align: 'center' });
    doc.text(`📊 Reporte generado automáticamente el ${new Date().toLocaleString('es-ES')}`, 70, footerY + 30, { width: 460, align: 'center' });
    doc.text('🔒 Documento confidencial - Solo para uso interno', 70, footerY + 45, { width: 460, align: 'center' });
    
  } catch (error) {
    console.error('Error generando resumen final:', error);
  }
}



// ✅ FUNCIÓN PARA AGREGAR FOOTER PROFESIONAL
async function addProfessionalFooter(doc: any) {
  try {
    const pageHeight = 792; // Altura estándar de página A4
    const footerY = pageHeight - 50;
    
    // Línea divisoria
    doc.strokeColor('#e2e8f0').lineWidth(1);
    doc.moveTo(50, footerY - 10).lineTo(562, footerY - 10).stroke();
    
    // Información del footer
    doc.fontSize(8).fillColor('gray');
    doc.text('SOLUFACIL - Sistema de Gestion de Creditos', 50, footerY, { align: 'left' });
    doc.text(`Pagina generada automaticamente - ${new Date().toLocaleDateString('es-ES')}`, 50, footerY + 12, { align: 'left' });
    
    // Información de contacto (lado derecho)
    doc.text('Reporte Confidencial', 400, footerY, { align: 'right', width: 150 });
    doc.text('Para uso interno únicamente', 400, footerY + 12, { align: 'right', width: 150 });
    
    // Resetear color
    doc.fillColor('black');
    
  } catch (error) {
    console.error('Error agregando footer:', error);
  }
}

// ✅ FUNCIÓN AUXILIAR PARA LIMPIAR TEXTO PROBLEMÁTICO
function sanitizeText(text: string): string {
  if (!text) return 'N/A';
  
  return text
    .replace(/[áéíóúñü]/g, (match) => { // Reemplazar acentos específicamente
      const map: any = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u' };
      return map[match] || match;
    })
    .replace(/[ÁÉÍÓÚÑÜ]/g, (match) => { // Reemplazar acentos mayúsculas
      const map: any = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'Ü': 'U' };
      return map[match] || match;
    })
    .replace(/[^\w\s\-\.,\(\):]/g, '') // Eliminar otros caracteres especiales
    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
    .trim()
    .substring(0, 80); // Limitar longitud
}

// ✅ FUNCIÓN PARA GENERAR TABLA REAL DE DOCUMENTOS CON ERROR (VERSIÓN LIMPIA)
async function generateRealDocumentErrorTable(doc: any, tableData: any[], weekGroups: Map<string, any[]>) {
  console.log('🎨 Iniciando generación de tabla real...');
  
  const pageWidth = 500;
  const startX = 50;
  const headerHeight = 30;
  const rowHeight = 45;
  let currentY = doc.y;
  
  // Configuración de columnas
  const columns = [
    { header: 'Ruta', width: 60 },
    { header: 'Localidad', width: 70 },
    { header: 'Cliente', width: 85 },
    { header: 'Tipo', width: 45 },
    { header: 'Problema', width: 140 },
    { header: 'Observaciones', width: 100 }
  ];
  
  // Función para dibujar header
  const drawTableHeader = (y: number) => {
    doc.fillColor('#1e40af').rect(startX, y, pageWidth, headerHeight).fill();
    doc.strokeColor('#1e40af').lineWidth(2).rect(startX, y, pageWidth, headerHeight).stroke();
    
    doc.fillColor('white').fontSize(10);
    let x = startX;
    columns.forEach((col, index) => {
      if (index > 0) {
        doc.strokeColor('white').lineWidth(1);
        doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke();
      }
      doc.text(col.header, x + 5, y + 10, { width: col.width - 10, align: 'center' });
      x += col.width;
    });
    
    doc.fillColor('black');
    return y + headerHeight;
  };
  
  // Función para dibujar fila
  const drawTableRow = (data: any, y: number, isShaded: boolean = false) => {
    if (!data) return y + rowHeight;
    
    // Fondo alternado
    if (isShaded) {
      doc.fillColor('#e0f2fe').rect(startX, y, pageWidth, rowHeight).fill();
    } else {
      doc.fillColor('white').rect(startX, y, pageWidth, rowHeight).fill();
    }
    
    // Bordes
    doc.strokeColor('#374151').lineWidth(1).rect(startX, y, pageWidth, rowHeight).stroke();
    
    // Datos sanitizados
    const cellData = [
      sanitizeText(data.routeName),
      sanitizeText(data.locality), 
      sanitizeText(data.clientName),
      sanitizeText(data.problemType),
      sanitizeText(data.problemDescription),
      sanitizeText(data.observations)
    ];
    
    // Dibujar celdas
    let x = startX;
    columns.forEach((col, index) => {
      if (index > 0) {
        doc.strokeColor('#374151').lineWidth(0.5);
        doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
      }
      
      let cellText = cellData[index] || 'N/A';
      
      // Columna de problemas
      if (index === 4) {
        const problems = cellText.split(';').filter(p => p.trim());
        doc.fontSize(7);
        let textY = y + 5;
        
        for (let i = 0; i < Math.min(problems.length, 3); i++) {
          const problem = problems[i].trim();
          if (textY < y + rowHeight - 10) {
            if (problem.includes('con error')) {
              doc.fillColor('#dc2626');
              doc.text(`ERROR: ${problem.replace('con error', '').trim().substring(0, 15)}`, x + 2, textY);
            } else if (problem.includes('faltante')) {
              doc.fillColor('#f59e0b');
              doc.text(`FALTA: ${problem.replace('faltante', '').trim().substring(0, 15)}`, x + 2, textY);
            } else {
              doc.fillColor('black');
              doc.text(problem.substring(0, 20), x + 2, textY);
            }
            textY += 8;
          }
        }
      } else {
        // Otras columnas
        if (index === 3) {
          doc.fillColor(cellText === 'CLIENTE' ? '#059669' : '#dc2626');
          doc.fontSize(9);
        } else {
          doc.fillColor('black');
          doc.fontSize(8);
        }
        
        if (cellText.length > 18) {
          cellText = cellText.substring(0, 15) + '...';
        }
        
        doc.text(cellText, x + 2, y + 15, { 
          width: col.width - 4,
          ellipsis: true,
          lineBreak: false
        });
      }
      
      x += col.width;
    });
    
    doc.fillColor('black');
    return y + rowHeight;
  };
    
  // Dibujar header inicial
  currentY = drawTableHeader(currentY);
  
  // Procesar datos por semana
  const sortedWeeks = Array.from(weekGroups.keys()).sort().reverse();
  let isWeekShaded = false;
  let recordCount = 0;
  
  for (const weekKey of sortedWeeks) {
    const weekData = weekGroups.get(weekKey) || [];
    const weekStart = new Date(weekKey);
    
    // Nueva página si es necesario
    if (currentY > 650) {
      doc.addPage();
      doc.fontSize(20).fillColor('#1e40af').text('SOLUFACIL', { align: 'center' });
      doc.fontSize(14).fillColor('black').text('REPORTE DE CREDITOS (Continuacion)', { align: 'center' });
      doc.moveDown(2);
      currentY = doc.y;
      currentY = drawTableHeader(currentY);
    }
    
    // Header de semana
    doc.fontSize(10).fillColor('#1e40af');
    doc.text(`Semana del ${weekStart.toLocaleDateString('es-ES')} (${weekData.length} registros)`, startX, currentY + 5);
    doc.fillColor('black');
    currentY += 18;
    
    // Dibujar filas
    weekData.forEach((rowData) => {
      if (currentY > 650) {
        doc.addPage();
        doc.fontSize(20).fillColor('#1e40af').text('SOLUFACIL', { align: 'center' });
        doc.moveDown(2);
        currentY = doc.y;
        currentY = drawTableHeader(currentY);
      }
      
      currentY = drawTableRow(rowData, currentY, isWeekShaded);
      recordCount++;
    });
    
    // Alternar sombreado
    isWeekShaded = !isWeekShaded;
    
    // Separador entre semanas
    if (weekKey !== sortedWeeks[sortedWeeks.length - 1]) {
      doc.strokeColor('#1e40af').lineWidth(2);
      doc.moveTo(startX, currentY + 5).lineTo(startX + pageWidth, currentY + 5).stroke();
      currentY += 15;
    }
  }
  
  console.log(`Tabla completada con ${recordCount} registros`);
}

// ✅ FUNCIÓN PARA AGREGAR HEADER CON LOGO DE LA EMPRESA
async function addCompanyHeader(doc: any) {
  try {
    // Fondo del header
    doc.fillColor('#1e40af').rect(0, 0, 612, 80).fill();
    
    // Logo y nombre de la empresa (simulado con texto estilizado)
    doc.fontSize(24).fillColor('white').text('SOLUFACIL', 50, 25, { align: 'left' });
    doc.fontSize(10).fillColor('white').text('SISTEMA DE GESTION DE CREDITOS', 50, 55);
    
    // Información de generación en la esquina derecha
    doc.fontSize(8).fillColor('white');
    const currentDate = new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generado: ${currentDate}`, 350, 30, { align: 'right', width: 200 });
    doc.text('Reporte Oficial', 350, 45, { align: 'right', width: 200 });
    doc.text('Confidencial', 350, 60, { align: 'right', width: 200 });
    
    // Línea divisoria elegante
    doc.strokeColor('#3b82f6').lineWidth(2).moveTo(50, 85).lineTo(562, 85).stroke();
    
    // Espacio después del header
    doc.y = 100;
    doc.fillColor('black'); // Resetear color a negro
    
  } catch (error) {
    console.error('Error agregando header:', error);
    // Fallback simple si hay error
    doc.fontSize(16).fillColor('#1e40af').text('SOLUFÁCIL', 50, 50);
    doc.y = 80;
    doc.fillColor('black');
  }
}

// ✅ FUNCIÓN PARA GENERAR TABLA DE DOCUMENTOS CON ERROR
async function generateDocumentErrorTableContent(doc: any, tableData: any[], weekGroups: Map<string, any[]>) {
  try {
    const pageWidth = 500;
    const startX = 50;
    const rowHeight = 35;
    let currentY = doc.y;
    
    // Headers de la tabla
    const headers = ['Localidad', 'Cliente', 'Problema', 'Descripción del Error', 'Observaciones'];
    const columnWidths = [70, 100, 60, 140, 130];
    
    // Función para dibujar header de tabla
    const drawTableHeader = (y: number) => {
      doc.fontSize(9);
      
      // Fondo del header
      doc.fillColor('#1e40af').rect(startX, y, pageWidth, 25).fill();
      
      // Texto del header en blanco
      doc.fillColor('white');
      let x = startX + 5;
      headers.forEach((header, index) => {
        doc.text(header, x, y + 8, { width: columnWidths[index] - 10, align: 'center' });
        x += columnWidths[index];
      });
      
      // Resetear color
      doc.fillColor('black');
      return y + 25;
    };
    
    // Función para dibujar fila de datos
    const drawTableRow = (data: any, y: number, isShaded: boolean = false) => {
      // Fondo de la fila
      if (isShaded) {
        doc.fillColor('#f1f5f9').rect(startX, y, pageWidth, rowHeight).fill();
      } else {
        doc.fillColor('white').rect(startX, y, pageWidth, rowHeight).fill();
      }
      
      // Bordes de la fila
      doc.strokeColor('#d1d5db').lineWidth(0.5);
      doc.rect(startX, y, pageWidth, rowHeight).stroke();
      
      // Texto de la fila
      doc.fillColor('black').fontSize(8);
      
      let x = startX + 3;
      const values = [
        data.locality,
        data.clientName.length > 25 ? data.clientName.substring(0, 22) + '...' : data.clientName,
        data.problemType,
        data.problemDescription.length > 35 ? data.problemDescription.substring(0, 32) + '...' : data.problemDescription,
        data.observations.length > 30 ? data.observations.substring(0, 27) + '...' : data.observations
      ];
      
      values.forEach((value, index) => {
        const cellWidth = columnWidths[index] - 6;
        
        // Texto con word wrap mejorado
        doc.text(value || '-', x, y + 8, { 
          width: cellWidth,
          align: 'left',
          lineBreak: true
        });
        x += columnWidths[index];
      });
      
      // Resetear color
      doc.fillColor('black');
      return y + rowHeight;
    };
    
    // Dibujar header inicial
    currentY = drawTableHeader(currentY);
    
    // Procesar datos por semana con sombreado
    const sortedWeeks = Array.from(weekGroups.keys()).sort().reverse(); // Más recientes primero
    let isWeekShaded = false;
    
    for (const weekKey of sortedWeeks) {
      const weekData = weekGroups.get(weekKey);
      const weekStart = new Date(weekKey);
      
      // Verificar si necesitamos nueva página
      if (currentY > 680) {
        doc.addPage();
        await addCompanyHeader(doc);
        currentY = doc.y;
        currentY = drawTableHeader(currentY);
      }
      
      // Header de semana con estilo profesional
      doc.fontSize(10).fillColor('#1e40af');
      const weekText = `Semana del ${weekStart.toLocaleDateString('es-ES')} (${weekData.length} registros)`;
      doc.text(weekText, startX, currentY + 5);
      doc.fillColor('black');
      currentY += 20;
      
      // Filas de datos de la semana
      for (const rowData of weekData) {
        if (currentY > 680) {
          doc.addPage();
          await addCompanyHeader(doc);
          currentY = doc.y;
          currentY = drawTableHeader(currentY);
          
          // Repetir header de semana en nueva página
          doc.fontSize(10).fillColor('#1e40af');
          doc.text(`${weekText} (continuación)`, startX, currentY + 5);
          doc.fillColor('black');
          currentY += 20;
        }
        
        currentY = drawTableRow(rowData, currentY, isWeekShaded);
      }
      
      // Alternar sombreado para la siguiente semana
      isWeekShaded = !isWeekShaded;
      
      // Línea separadora entre semanas
      doc.strokeColor('#94a3b8').lineWidth(1);
      doc.moveTo(startX, currentY + 5).lineTo(startX + pageWidth, currentY + 5).stroke();
      currentY += 15;
    }

  } catch (error) {
    console.error('❌ Error generando tabla de documentos con errores:', error);
    doc.fontSize(12).text(`❌ Error generando tabla: ${error instanceof Error ? error.message : 'Unknown error'}`, { align: 'center' });
  }
}

// ✅ FUNCIÓN AUXILIAR PARA OBTENER EL INICIO DE LA SEMANA (LUNES)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para que lunes sea el primer día
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ✅ FUNCIÓN PARA ENVIAR ARCHIVO A TELEGRAM
async function sendTelegramFile(chatId: string, fileBuffer: Buffer, filename: string, caption: string): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.log('❌ TELEGRAM_BOT_TOKEN no configurado');
      return false;
    }

    console.log('📱 Intentando enviar archivo a Telegram:', { chatId, filename, caption, bufferSize: fileBuffer.length });

    // Crear FormData para enviar el archivo
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('chat_id', chatId);
    form.append('document', fileBuffer, {
      filename: filename,
      contentType: 'application/pdf'
    });
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');

    // Usar node-fetch (ya importado al inicio del archivo)
    
    console.log('📱 FormData creado, enviando a Telegram...');
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    console.log('📱 Respuesta de Telegram recibida:', response.status, response.statusText);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Archivo enviado a Telegram:', filename, result);
      return result.ok;
    } else {
      const errorText = await response.text();
      console.error('❌ Error al enviar archivo a Telegram:', response.status, response.statusText, errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error al enviar archivo a Telegram:', error);
    return false;
  }
}

// Helper function to calculate weeks between dates
function calculateWeeksBetween(date1: Date, date2: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerWeek);
}

// Helper function to get Monday of a week
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}