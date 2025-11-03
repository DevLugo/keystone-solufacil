import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';

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

export const getBankIncomeTransactionsResolver = graphql.field({
  type: graphql.nonNull(graphql.JSON),
  args: {
    startDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    endDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    routeIds: graphql.arg({ type: graphql.list(graphql.nonNull(graphql.ID)) }),
    onlyAbonos: graphql.arg({ type: graphql.Boolean, defaultValue: false })
  },
  resolve: async (root, { startDate, endDate, routeIds, onlyAbonos }, context: Context) => {
    try {
      const whereConditions: any = {
        AND: [
          { date: { gte: new Date(startDate), lte: new Date(endDate) } },
          { route: { id: { in: routeIds } } }
        ]
      };

      // Si onlyAbonos es true, solo mostrar pagos de préstamos
      if (onlyAbonos) {
        whereConditions.AND.push({
          AND: [
            { type: { equals: "INCOME" } },
            { incomeSource: { equals: "BANK_LOAN_PAYMENT" } }
          ]
        });
      } else {
        // Mostrar todos los tipos de entrada al banco
        whereConditions.AND.push({
          OR: [
            { 
              AND: [
                { type: { equals: "TRANSFER" } },
                { destinationAccount: { type: { equals: "BANK" } } }
              ]
            },
            { 
              AND: [
                { type: { equals: "INCOME" } },
                { 
                  OR: [
                    { incomeSource: { equals: "BANK_LOAN_PAYMENT" } },
                    { incomeSource: { equals: "MONEY_INVESMENT" } }
                  ]
                }
              ]
            }
          ]
        });
      }

      const transactions = await context.prisma.transaction.findMany({
        where: whereConditions,
        include: {
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
          loan: {
            include: {
              borrower: {
                include: {
                  personalData: true
                }
              }
            }
          },
          destinationAccount: true
        },
        orderBy: { date: 'desc' }
      });

      const processedTransactions = transactions.map(transaction => {
        // Determinar el tipo de pago
        const isClientPayment = transaction.type === 'INCOME' && transaction.incomeSource === 'BANK_LOAN_PAYMENT';
        const isLeaderPayment = transaction.type === 'TRANSFER' && transaction.destinationAccount?.type === 'BANK';
        
        // Obtener información del empleado/líder
        const employeeName = transaction.lead?.personalData?.fullName;
        const leaderLocality = transaction.lead?.personalData?.addresses?.[0]?.location?.name;
        
        // Obtener información del cliente (para pagos de préstamos)
        const clientName = transaction.loan?.borrower?.personalData?.fullName;
        
        return {
          id: transaction.id,
          amount: safeToNumber(transaction.amount),
          type: transaction.type,
          incomeSource: transaction.incomeSource,
          createdAt: transaction.createdAt?.toISOString() || '',
          date: transaction.date?.toISOString() || '',
          description: transaction.description,
          locality: leaderLocality,
          employeeName: employeeName,
          leaderLocality: leaderLocality,
          isClientPayment: isClientPayment,
          isLeaderPayment: isLeaderPayment,
          name: isClientPayment ? clientName : employeeName || 'Sin nombre'
        };
      });

      return {
        success: true,
        transactions: processedTransactions
      };
    } catch (error) {
      console.error('Error obteniendo entradas al banco:', error);
      return {
        success: false,
        message: 'Error al obtener entradas al banco',
        transactions: []
      };
    }
  }
});

