// graphql/dashboardExtensions.ts

import { graphql } from '@keystone-6/core';

export const dashboardExtensions = graphql.extend((base) => {
  return {
    query: {
      getDashboardMetrics: graphql.field({
        type: graphql.JSON,
        args: {
          routeId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
          startDate: graphql.arg({ type: graphql.nonNull(graphql.DateTime) }),
          endDate: graphql.arg({ type: graphql.nonNull(graphql.DateTime) }),
        },
        async resolve(_source, { routeId, startDate, endDate }, context) {
          const prisma = context.prisma;
          
          // Obtener préstamos activos de la ruta
          const loans = await prisma.loan.findMany({
            where: {
              AND: [
                {
                  lead: {
                    routes: {
                      id: routeId
                    }
                  }
                },
                {
                  signDate: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                  }
                },
                { finishedDate: null },
                { excludedByCleanup: null }
              ]
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
              payments: {
                orderBy: {
                  receivedAt: 'desc'
                }
              },
              loantype: true
            }
          });

          // Procesar métricas
          const now = new Date();
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

          // Calcular métricas básicas
          const totalLoans = loans.length;
          const activeLoans = loans.filter(l => l.status === 'ACTIVE' || !l.status).length;
          
          // Calcular cartera vencida (CV)
          const overdueLoans = loans.filter(loan => {
            const lastPayment = loan.payments?.[0];
            if (!lastPayment) {
              return new Date(loan.signDate) < twoWeeksAgo;
            }
            return new Date(lastPayment.receivedAt) < twoWeeksAgo;
          });

          // Clientes críticos (más de 3 semanas sin pagar)
          const criticalClients = loans.filter(loan => {
            const lastPayment = loan.payments?.[0];
            if (!lastPayment) {
              return new Date(loan.signDate) < threeWeeksAgo;
            }
            return new Date(lastPayment.receivedAt) < threeWeeksAgo;
          });

          // Cobranza semanal
          const weeklyPayments = loans.flatMap(loan => 
            loan.payments?.filter(p => new Date(p.receivedAt) >= oneWeekAgo) || []
          );
          
          const weeklyCollection = weeklyPayments.reduce((sum, p) => {
            const amount = p.amount ? parseFloat(p.amount.toString()) : 0;
            return sum + amount;
          }, 0);

          const expectedWeeklyTotal = loans.reduce((sum, loan) => {
            const amount = loan.expectedWeeklyPayment ? parseFloat(loan.expectedWeeklyPayment.toString()) : 0;
            return sum + amount;
          }, 0);

          const collectionRate = expectedWeeklyTotal > 0 
            ? (weeklyCollection / expectedWeeklyTotal) * 100 
            : 0;

          // Análisis por localidad
          const localityMetrics: Record<string, any> = {};
          
          loans.forEach(loan => {
            const locality = loan.borrower?.personalData?.addresses?.[0]?.location;
            if (locality) {
              if (!localityMetrics[locality.id]) {
                localityMetrics[locality.id] = {
                  id: locality.id,
                  name: locality.name,
                  totalLoans: 0,
                  overdueLoans: 0,
                  collection: 0,
                  expected: 0,
                  criticalClients: 0,
                  newLoansThisWeek: 0,
                  historicalAverage: 0
                };
              }
              
              localityMetrics[locality.id].totalLoans++;
              
              // Verificar si es préstamo nuevo esta semana
              if (new Date(loan.signDate) >= oneWeekAgo) {
                localityMetrics[locality.id].newLoansThisWeek++;
              }
              
              const lastPayment = loan.payments?.[0];
              const isOverdue = !lastPayment || 
                new Date(lastPayment.receivedAt) < twoWeeksAgo;
              
              if (isOverdue) {
                localityMetrics[locality.id].overdueLoans++;
              }
              
              const isCritical = !lastPayment || 
                new Date(lastPayment.receivedAt) < threeWeeksAgo;
              
              if (isCritical) {
                localityMetrics[locality.id].criticalClients++;
              }
              
              const expectedAmount = loan.expectedWeeklyPayment ? parseFloat(loan.expectedWeeklyPayment.toString()) : 0;
              localityMetrics[locality.id].expected += expectedAmount;
              
              const weekPayments = loan.payments?.filter(p => 
                new Date(p.receivedAt) >= oneWeekAgo
              ) || [];
              
              const collectionAmount = weekPayments.reduce((sum, p) => {
                const amount = p.amount ? parseFloat(p.amount.toString()) : 0;
                return sum + amount;
              }, 0);
              
              localityMetrics[locality.id].collection += collectionAmount;
            }
          });

          // Detectar anomalías en localidades (incremento anormal de créditos)
          const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
          
          for (const localityId in localityMetrics) {
            // Obtener el histórico de préstamos de las últimas 4 semanas
            const historicalLoans = await prisma.loan.findMany({
              where: {
                AND: [
                  {
                    borrower: {
                      personalData: {
                        addresses: {
                          some: {
                            location: {
                              id: localityId
                            }
                          }
                        }
                      }
                    }
                  },
                  {
                    signDate: {
                      gte: fourWeeksAgo,
                      lt: oneWeekAgo
                    }
                  }
                ]
              }
            });
            
            // Calcular promedio histórico semanal
            const historicalAverage = historicalLoans.length / 3; // Promedio de 3 semanas anteriores
            localityMetrics[localityId].historicalAverage = historicalAverage;
            
            // Detectar si hay incremento anormal (más del 50% sobre el promedio)
            if (localityMetrics[localityId].newLoansThisWeek > historicalAverage * 1.5 && historicalAverage > 0) {
              localityMetrics[localityId].hasAbnormalIncrease = true;
              localityMetrics[localityId].increasePercentage = 
                ((localityMetrics[localityId].newLoansThisWeek - historicalAverage) / historicalAverage) * 100;
            }
          }

          // Preparar lista de clientes críticos
          const criticalClientsList = criticalClients.slice(0, 10).map(loan => ({
            id: loan.id,
            name: loan.borrower?.personalData?.fullName || 'Sin nombre',
            code: loan.borrower?.personalData?.clientCode || 'N/A',
            amount: loan.pendingAmountStored ? parseFloat(loan.pendingAmountStored.toString()) : 0,
            lastPayment: loan.payments?.[0]?.receivedAt || null,
            locality: loan.borrower?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad',
            weeksSincePayment: loan.payments?.[0] 
              ? Math.floor((now.getTime() - new Date(loan.payments[0].receivedAt).getTime()) / (7 * 24 * 60 * 60 * 1000))
              : Math.floor((now.getTime() - new Date(loan.signDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
          }));

          // Calcular tendencias (comparación con semana anterior)
          const twoWeeksAgoDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          const previousWeekPayments = loans.flatMap(loan => 
            loan.payments?.filter(p => {
              const paymentDate = new Date(p.receivedAt);
              return paymentDate >= twoWeeksAgoDate && paymentDate < oneWeekAgo;
            }) || []
          );
          
          const previousWeekCollection = previousWeekPayments.reduce((sum, p) => {
            const amount = p.amount ? parseFloat(p.amount.toString()) : 0;
            return sum + amount;
          }, 0);

          const collectionTrend = previousWeekCollection > 0 
            ? ((weeklyCollection - previousWeekCollection) / previousWeekCollection) * 100 
            : 0;

          return {
            summary: {
              totalLoans,
              activeLoans,
              overdueLoans: overdueLoans.length,
              overdueRate: totalLoans > 0 ? (overdueLoans.length / totalLoans) * 100 : 0,
              criticalClients: criticalClients.length,
              weeklyCollection,
              expectedWeeklyTotal,
              collectionRate,
              weeklyPaymentsCount: weeklyPayments.length,
              collectionTrend,
              previousWeekCollection
            },
            localityMetrics: Object.values(localityMetrics),
            criticalClientsList,
            alerts: {
              hasRedAlert: criticalClients.length > 5,
              hasOrangeAlert: overdueLoans.length > totalLoans * 0.3,
              hasYellowAlert: collectionRate < 70,
              localitiesWithAnomalies: Object.values(localityMetrics)
                .filter((l: any) => l.hasAbnormalIncrease)
                .map((l: any) => ({
                  name: l.name,
                  increase: l.increasePercentage,
                  newLoans: l.newLoansThisWeek,
                  average: l.historicalAverage
                }))
            }
          };
        }
      })
    }
  };
});