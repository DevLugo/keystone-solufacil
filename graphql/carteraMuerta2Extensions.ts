import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';

// Helper function to calculate weeks between dates
function calculateWeeksBetween(date1: Date, date2: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerWeek);
}

export const carteraMuerta2Extensions = graphql.extend(base => {
  return {
    query: {
      deadDebtLoans2: graphql.field({
        type: graphql.list(graphql.JSON),
        args: {
          weeksSinceLoan: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          weeksWithoutPayment: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          routeId: graphql.arg({ type: graphql.String })
        },
        resolve: async (_, { weeksSinceLoan, weeksWithoutPayment, routeId }, context: Context) => {
          try {
            const currentDate = new Date();
            const weeksSinceLoanDate = new Date();
            weeksSinceLoanDate.setDate(currentDate.getDate() - (weeksSinceLoan * 7));
            
            const weeksWithoutPaymentDate = new Date();
            weeksWithoutPaymentDate.setDate(currentDate.getDate() - (weeksWithoutPayment * 7));

            const whereClause: any = {
              status: 'ACTIVE',
              badDebtDate: null,
              signDate: { lte: weeksSinceLoanDate }
            };

            if (routeId) {
              whereClause.lead = { routesId: routeId };
            }

            const loans = await context.prisma.loan.findMany({
              where: whereClause,
              include: {
                borrower: { include: { personalData: true } },
                lead: { 
                  include: { 
                    personalData: { 
                      include: { 
                        addresses: { 
                          include: { location: true } 
                        } 
                      } 
                    } 
                  } 
                },
                loantype: true,
                payments: { orderBy: { receivedAt: 'desc' }, take: 1 }
              }
            });

            const eligibleLoans = loans.filter(loan => {
              const lastPayment = loan.payments[0];
              if (!lastPayment) {
                return loan.signDate <= weeksWithoutPaymentDate;
              }
              return lastPayment.receivedAt <= weeksWithoutPaymentDate;
            });

            const loansWithWeeks = eligibleLoans.map(loan => {
              const weeksSinceLoan = Math.floor((currentDate.getTime() - loan.signDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
              const lastPayment = loan.payments[0];
              let weeksWithoutPayment = 0;
              
              if (lastPayment) {
                weeksWithoutPayment = Math.floor((currentDate.getTime() - lastPayment.receivedAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
              } else {
                weeksWithoutPayment = weeksSinceLoan;
              }

              return {
                id: loan.id,
                requestedAmount: parseFloat(loan.requestedAmount.toString()),
                amountGived: parseFloat(loan.amountGived.toString()),
                signDate: loan.signDate.toISOString(),
                pendingAmountStored: parseFloat(loan.pendingAmountStored?.toString() || '0'),
                badDebtDate: loan.badDebtDate?.toISOString() || null,
                borrower: {
                  fullName: loan.borrower.personalData?.fullName || 'Sin nombre',
                  clientCode: loan.borrower.personalData?.clientCode || 'Sin código'
                },
                lead: {
                  fullName: loan.lead.personalData?.fullName || 'Sin nombre',
                  locality: loan.lead.personalData?.addresses?.[0]?.location?.name || 'Sin localidad'
                },
                loantype: loan.loantype ? {
                  name: loan.loantype.name,
                  weekDuration: loan.loantype.weekDuration
                } : null,
                weeksSinceLoan,
                weeksWithoutPayment
              };
            });

            return loansWithWeeks;
          } catch (error) {
            console.error('Error en deadDebtLoans2:', error);
            return [];
          }
        }
      }),

      deadDebtSummary2: graphql.field({
        type: graphql.list(graphql.JSON),
        args: {
          weeksSinceLoan: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          weeksWithoutPayment: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          routeId: graphql.arg({ type: graphql.String })
        },
        resolve: async (_, { weeksSinceLoan, weeksWithoutPayment, routeId }, context: Context) => {
          try {
            const currentDate = new Date();
            const weeksSinceLoanDate = new Date();
            weeksSinceLoanDate.setDate(currentDate.getDate() - (weeksSinceLoan * 7));
            
            const weeksWithoutPaymentDate = new Date();
            weeksWithoutPaymentDate.setDate(currentDate.getDate() - (weeksWithoutPayment * 7));

            const whereClause: any = {
              status: 'ACTIVE',
              badDebtDate: null,
              signDate: { lte: weeksSinceLoanDate }
            };

            if (routeId) {
              whereClause.lead = { routesId: routeId };
            }

            const loans = await context.prisma.loan.findMany({
              where: whereClause,
              include: {
                borrower: { include: { personalData: true } },
                lead: { 
                  include: { 
                    personalData: { 
                      include: { 
                        addresses: { 
                          include: { location: true } 
                        } 
                      } 
                    } 
                  } 
                },
                payments: { orderBy: { receivedAt: 'desc' }, take: 1 }
              }
            });

            const eligibleLoans = loans.filter(loan => {
              const lastPayment = loan.payments[0];
              if (!lastPayment) {
                return loan.signDate <= weeksWithoutPaymentDate;
              }
              return lastPayment.receivedAt <= weeksWithoutPaymentDate;
            });

            // Agrupar por localidad
            const loansByLocality = new Map();
            
            eligibleLoans.forEach(loan => {
              const locality = loan.lead.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
              const pendingAmount = parseFloat(loan.pendingAmountStored?.toString() || '0');

              if (!loansByLocality.has(locality)) {
                loansByLocality.set(locality, { loanCount: 0, totalAmount: 0 });
              }
              
              loansByLocality.get(locality).loanCount += 1;
              loansByLocality.get(locality).totalAmount += pendingAmount;
            });

            // Generar resumen por localidad
            const summary = Array.from(loansByLocality.entries()).map(([locality, data]) => ({
              locality,
              loanCount: data.loanCount,
              totalAmount: data.totalAmount
            }));

            return summary;
          } catch (error) {
            console.error('Error en deadDebtSummary2:', error);
            return [];
          }
        }
      }),

      deadDebtByMonth2: graphql.field({
        type: graphql.list(graphql.JSON),
        args: {
          month: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
          year: graphql.arg({ type: graphql.nonNull(graphql.Int) })
        },
        resolve: async (_, { month, year }, context: Context) => {
          try {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            const loans = await context.prisma.loan.findMany({
              where: { badDebtDate: { gte: startDate, lte: endDate } },
              include: {
                borrower: { include: { personalData: true } },
                lead: { 
                  include: { 
                    personalData: { 
                      include: { 
                        addresses: { 
                          include: { location: true } 
                        } 
                      } 
                    } 
                  } 
                }
              }
            });

            // Agrupar por localidad
            const loansByLocality = new Map();
            
            loans.forEach(loan => {
              const locality = loan.lead.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
              const pendingAmount = parseFloat(loan.pendingAmountStored?.toString() || '0');
              
              const loanData = {
                id: loan.id,
                requestedAmount: parseFloat(loan.requestedAmount.toString()),
                amountGived: parseFloat(loan.amountGived.toString()),
                signDate: loan.signDate.toISOString(),
                badDebtDate: loan.badDebtDate?.toISOString() || null,
                borrower: {
                  fullName: loan.borrower.personalData?.fullName || 'Sin nombre',
                  clientCode: loan.borrower.personalData?.clientCode || 'Sin código'
                },
                lead: {
                  fullName: loan.lead.personalData?.fullName || 'Sin nombre'
                }
              };

              if (!loansByLocality.has(locality)) {
                loansByLocality.set(locality, { loanCount: 0, totalAmount: 0, loans: [] });
              }
              
              loansByLocality.get(locality).loanCount += 1;
              loansByLocality.get(locality).totalAmount += pendingAmount;
              loansByLocality.get(locality).loans.push(loanData);
            });

            // Generar resumen por localidad
            const summary = Array.from(loansByLocality.entries()).map(([locality, data]) => ({
              locality,
              loanCount: data.loanCount,
              totalAmount: data.totalAmount,
              loans: data.loans
            }));

            return summary;
          } catch (error) {
            console.error('Error en deadDebtByMonth2:', error);
            return [];
          }
        }
      })
    },
    mutation: {
      markLoansDeadDebt2: graphql.field({
        type: graphql.JSON,
        args: {
          loanIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.ID))) }),
          badDebtDate: graphql.arg({ type: graphql.nonNull(graphql.String) })
        },
        resolve: async (_, { loanIds, badDebtDate }, context: Context) => {
          try {
            const date = new Date(badDebtDate);
            
            const result = await context.prisma.loan.updateMany({
              where: { id: { in: loanIds } },
              data: { badDebtDate: date }
            });

            return {
              success: true,
              message: `${result.count} créditos marcados como cartera muerta exitosamente`,
              updatedCount: result.count,
              errors: []
            };
          } catch (error) {
            console.error('Error en markLoansDeadDebt2:', error);
            return {
              success: false,
              message: 'Error al marcar créditos como cartera muerta',
              updatedCount: 0,
              errors: [{ loanId: 'unknown', message: error instanceof Error ? error.message : 'Error desconocido' }]
            };
          }
        }
      }),

      removeDeadDebtStatus2: graphql.field({
        type: graphql.JSON,
        args: {
          loanIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.ID))) })
        },
        resolve: async (_, { loanIds }, context: Context) => {
          try {
            const result = await context.prisma.loan.updateMany({
              where: { id: { in: loanIds } },
              data: { badDebtDate: null }
            });

            return {
              success: true,
              message: `${result.count} créditos removidos de cartera muerta exitosamente`,
              updatedCount: result.count,
              errors: []
            };
          } catch (error) {
            console.error('Error en removeDeadDebtStatus2:', error);
            return {
              success: false,
              message: 'Error al remover estatus de cartera muerta',
              updatedCount: 0,
              errors: [{ loanId: 'unknown', message: error instanceof Error ? error.message : 'Error desconocido' }]
            };
          }
        }
      })
    }
  };
});

