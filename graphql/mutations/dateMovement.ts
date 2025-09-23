import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';

export const moveLoansToDate = graphql.field({
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
});

export const movePaymentsToDate = graphql.field({
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
        
        console.log(`💰 Moviendo ${leadPaymentReceiveds.length} grupos de pagos del ${from.toISOString()} al ${to.toISOString()}`);
        
        let totalPaymentsMoved = 0;
        let totalTransactionsMoved = 0;
        
        // 2. Para cada LeadPaymentReceived, mover fecha y sus elementos relacionados
        for (const leadPaymentReceived of leadPaymentReceiveds) {
          // 2.1. Actualizar fecha del LeadPaymentReceived
          await tx.leadPaymentReceived.update({
            where: { id: leadPaymentReceived.id },
            data: { 
              createdAt: to,
              paymentDate: to.toISOString().split('T')[0] // Formato YYYY-MM-DD
            }
          });
          
          // 2.2. Actualizar fecha de cada Payment asociado
          if (leadPaymentReceived.payments && leadPaymentReceived.payments.length > 0) {
            await tx.payment.updateMany({
              where: {
                leadPaymentReceivedId: leadPaymentReceived.id
              },
              data: { 
                date: to 
              }
            });
            
            totalPaymentsMoved += leadPaymentReceived.payments.length;
            
            // 2.3. Actualizar todas las transacciones asociadas a estos pagos
            for (const payment of leadPaymentReceived.payments) {
              if (payment.transactions && payment.transactions.length > 0) {
                await tx.transaction.updateMany({
                  where: {
                    paymentId: payment.id
                  },
                  data: { date: to }
                });
                
                totalTransactionsMoved += payment.transactions.length;
              }
            }
          }
        }
        
        console.log(`📊 Movidos ${totalPaymentsMoved} pagos y ${totalTransactionsMoved} transacciones`);
        
        return {
          success: true,
          message: `${leadPaymentReceiveds.length} grupo(s) de pagos movidos exitosamente`,
          count: leadPaymentReceiveds.length,
          paymentsMoved: totalPaymentsMoved,
          transactionsMoved: totalTransactionsMoved,
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
});

export const moveExpensesToDate = graphql.field({
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
        
        // 1. Buscar todas las transacciones de gastos del líder en la fecha origen
        // Excluir las que ya tienen loanId o paymentId (porque serán movidas por otras funciones)
        const expenseTransactions = await tx.transaction.findMany({
          where: {
            leadId: leadId,
            type: 'EXPENSE',
            date: {
              gte: from,
              lte: fromEnd
            },
            loanId: null, // Excluir gastos asociados a préstamos específicos
            paymentId: null // Excluir gastos asociados a pagos específicos
          }
        });
        
        if (expenseTransactions.length === 0) {
          return {
            success: false,
            message: 'No se encontraron gastos independientes en la fecha origen',
            count: 0
          };
        }
        
        console.log(`💸 Moviendo ${expenseTransactions.length} transacciones de gastos del ${from.toISOString()} al ${to.toISOString()}`);
        
        // 2. Actualizar fecha de todas las transacciones de gastos
        const result = await tx.transaction.updateMany({
          where: {
            id: { in: expenseTransactions.map(transaction => transaction.id) }
          },
          data: { date: to }
        });
        
        console.log(`📊 Actualizadas ${result.count} transacciones de gastos`);
        
        return {
          success: true,
          message: `${result.count} transacción(es) de gastos movidas exitosamente`,
          count: result.count,
          fromDate: from.toISOString(),
          toDate: to.toISOString()
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
});
