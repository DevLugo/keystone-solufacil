// Extensiones para cartera muerta que se pueden agregar al schema existente
// Agregar estas líneas al final del archivo extendGraphqlSchema.ts

export const deadDebtAdditions = `
    // Queries para cartera muerta
    loansForDeadDebt: graphql.field({
      type: graphql.list(graphql.JSON),
      args: {
        weeksSinceLoan: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
        weeksWithoutPayment: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
        routeId: graphql.arg({ type: graphql.String })
      },
      resolve: async (_, { weeksSinceLoan, weeksWithoutPayment, routeId }, context) => {
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
                personalData: {
                  addresses: loan.lead.personalData?.addresses?.map(addr => ({
                    location: { name: addr.location?.name || 'Sin localidad' }
                  }))
                }
              },
              loantype: loan.loantype ? {
                name: loan.loantype.name,
                weekDuration: loan.loantype.weekDuration
              } : null,
              weeksSinceLoan,
              weeksWithoutPayment
            };
          });

          return JSON.stringify(loansWithWeeks);
        } catch (error) {
          console.error('Error en loansForDeadDebt:', error);
          throw new Error('Error al obtener créditos para cartera muerta');
        }
      }
    }),

    deadDebtSummary: graphql.field({
      type: graphql.list(graphql.JSON),
      args: {
        weeksSinceLoan: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
        weeksWithoutPayment: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
        routeId: graphql.arg({ type: graphql.String })
      },
      resolve: async (_, { weeksSinceLoan, weeksWithoutPayment, routeId }, context) => {
        try {
          // Obtener los datos de créditos elegibles
          const loansData = await context.graphql.run({
            query: \`
              query GetLoansForDeadDebt($weeksSinceLoan: Int!, $weeksWithoutPayment: Int!, $routeId: String) {
                loansForDeadDebt(weeksSinceLoan: $weeksSinceLoan, weeksWithoutPayment: $weeksWithoutPayment, routeId: $routeId)
              }
            \`,
            variables: { weeksSinceLoan, weeksWithoutPayment, routeId }
          });
          
          const loans = JSON.parse(loansData.data.loansForDeadDebt);

          const summaryByLocality: { [key: string]: { loanCount: number; totalAmount: number } } = {};

          loans.forEach((loan: any) => {
            const locality = loan.lead.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
            
            if (!summaryByLocality[locality]) {
              summaryByLocality[locality] = { loanCount: 0, totalAmount: 0 };
            }
            
            summaryByLocality[locality].loanCount += 1;
            summaryByLocality[locality].totalAmount += loan.pendingAmountStored;
          });

          const summary = Object.entries(summaryByLocality).map(([locality, data]) => ({
            locality,
            loanCount: data.loanCount,
            totalAmount: data.totalAmount
          }));

          return JSON.stringify(summary);
        } catch (error) {
          console.error('Error en deadDebtSummary:', error);
          throw new Error('Error al obtener resumen de cartera muerta');
        }
      }
    }),

    deadDebtByMonth: graphql.field({
      type: graphql.list(graphql.JSON),
      args: {
        month: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
        year: graphql.arg({ type: graphql.nonNull(graphql.Int) })
      },
      resolve: async (_, { month, year }, context) => {
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

          const summaryByLocality: { [key: string]: { loanCount: number; totalAmount: number; loans: any[] } } = {};

          loans.forEach(loan => {
            const locality = loan.lead.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
            
            if (!summaryByLocality[locality]) {
              summaryByLocality[locality] = { loanCount: 0, totalAmount: 0, loans: [] };
            }
            
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
              lead: { fullName: loan.lead.personalData?.fullName || 'Sin nombre' }
            };

            summaryByLocality[locality].loanCount += 1;
            summaryByLocality[locality].totalAmount += parseFloat(loan.pendingAmountStored?.toString() || '0');
            summaryByLocality[locality].loans.push(loanData);
          });

          const summary = Object.entries(summaryByLocality).map(([locality, data]) => ({
            locality,
            loanCount: data.loanCount,
            totalAmount: data.totalAmount,
            loans: data.loans
          }));

          return JSON.stringify(summary);
        } catch (error) {
          console.error('Error en deadDebtByMonth:', error);
          throw new Error('Error al obtener cartera muerta por mes');
        }
      }
    }),

    // Mutations para cartera muerta
    markLoansDeadDebt: graphql.field({
      type: graphql.JSON,
      args: {
        loanIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.ID))) }),
        badDebtDate: graphql.arg({ type: graphql.nonNull(graphql.String) })
      },
      resolve: async (_, { loanIds, badDebtDate }, context) => {
        try {
          const date = new Date(badDebtDate);
          
          const result = await context.prisma.loan.updateMany({
            where: { id: { in: loanIds } },
            data: { badDebtDate: date }
          });

          return JSON.stringify({
            success: true,
            message: \`\${result.count} créditos marcados como cartera muerta exitosamente\`,
            updatedCount: result.count,
            errors: []
          });
        } catch (error) {
          console.error('Error en markLoansDeadDebt:', error);
          return JSON.stringify({
            success: false,
            message: 'Error al marcar créditos como cartera muerta',
            updatedCount: 0,
            errors: [{ loanId: 'unknown', message: error instanceof Error ? error.message : 'Error desconocido' }]
          });
        }
      }
    }),

    removeDeadDebtStatus: graphql.field({
      type: graphql.JSON,
      args: {
        loanIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.ID))) })
      },
      resolve: async (_, { loanIds }, context) => {
        try {
          const result = await context.prisma.loan.updateMany({
            where: { id: { in: loanIds } },
            data: { badDebtDate: null }
          });

          return JSON.stringify({
            success: true,
            message: \`\${result.count} créditos removidos de cartera muerta exitosamente\`,
            updatedCount: result.count,
            errors: []
          });
        } catch (error) {
          console.error('Error en removeDeadDebtStatus:', error);
          return JSON.stringify({
            success: false,
            message: 'Error al remover estatus de cartera muerta',
            updatedCount: 0,
            errors: [{ loanId: 'unknown', message: error instanceof Error ? error.message : 'Error desconocido' }]
          });
        }
      }
    })
`;

