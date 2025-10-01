import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';

// Resolver para marcar créditos como cartera muerta
export const markLoansDeadDebt = graphql.field({
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
});

// Resolver para obtener créditos elegibles para cartera muerta
export const loansForDeadDebt = graphql.field({
  type: graphql.nonNull(graphql.String),
  args: {
    weeksSinceLoanMin: graphql.arg({ type: graphql.Int }),
    weeksSinceLoanMax: graphql.arg({ type: graphql.Int }),
    weeksWithoutPaymentMin: graphql.arg({ type: graphql.Int }),
    weeksWithoutPaymentMax: graphql.arg({ type: graphql.Int }),
    routeId: graphql.arg({ type: graphql.String }),
    localities: graphql.arg({ type: graphql.list(graphql.nonNull(graphql.String)) }),
    badDebtStatus: graphql.arg({ type: graphql.String }) // 'ALL' | 'MARKED' | 'UNMARKED'
  },
  resolve: async (source, { weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, routeId, localities, badDebtStatus }, context: Context) => {
    try {
      console.log('🔍 Buscando créditos para cartera muerta:', { weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, routeId, localities, badDebtStatus });
      
      // Calcular fechas límite
      const now = new Date();
      const weeksSinceLoanMinDate = weeksSinceLoanMin ? new Date(now.getTime() - (weeksSinceLoanMin * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksSinceLoanMaxDate = weeksSinceLoanMax ? new Date(now.getTime() - (weeksSinceLoanMax * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksWithoutPaymentMinDate = weeksWithoutPaymentMin ? new Date(now.getTime() - (weeksWithoutPaymentMin * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksWithoutPaymentMaxDate = weeksWithoutPaymentMax ? new Date(now.getTime() - (weeksWithoutPaymentMax * 7 * 24 * 60 * 60 * 1000)) : null;

      // Construir filtros de fecha
      const dateFilters: any = {};
      if (weeksSinceLoanMinDate) {
        dateFilters.signDate = { ...dateFilters.signDate, lte: weeksSinceLoanMinDate };
      }
      if (weeksSinceLoanMaxDate) {
        dateFilters.signDate = { ...dateFilters.signDate, gte: weeksSinceLoanMaxDate };
      }

      // Filtro por estado de cartera muerta
      const badDebtFilters: any = {};
      if (badDebtStatus === 'MARKED') {
        badDebtFilters.badDebtDate = { not: null };
      } else if (badDebtStatus === 'UNMARKED') {
        badDebtFilters.badDebtDate = null;
      }

      // Construir filtros de localidad
      const localityFilters: any = {};
      if (localities && localities.length > 0) {
        localityFilters.lead = {
          personalData: {
            addresses: {
              some: {
                location: {
                  name: { in: localities }
                }
              }
            }
          }
        };
      }

      // Filtro por ruta
      const routeFilters: any = {};
      if (routeId) {
        routeFilters.lead = {
          ...routeFilters.lead,
          routes: { id: routeId }
        };
      }

      // Obtener préstamos con filtros
      const loans = await context.prisma.loan.findMany({
        where: {
          ...dateFilters,
          ...badDebtFilters,
          ...localityFilters,
          ...routeFilters,
          finishedDate: null // Solo préstamos activos
        },
        select: {
          id: true,
          signDate: true,
          badDebtDate: true,
          amountGived: true,
          profitAmount: true,
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
              },
              routes: {
                select: {
                  name: true
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
        }
      });

      // Procesar préstamos y calcular métricas
      const processedLoans: any[] = [];
      let totalBadDebtCandidate = 0;

      for (const loan of loans) {
        const signDate = new Date(loan.signDate);
        const weeksSinceLoan = Math.floor((now.getTime() - signDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        
        // Calcular semanas sin pago
        const lastPayment = loan.payments[0];
        const lastPaymentDate = lastPayment ? new Date(lastPayment.receivedAt) : signDate;
        const weeksWithoutPayment = Math.floor((now.getTime() - lastPaymentDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

        // Aplicar filtros de semanas sin pago
        if (weeksWithoutPaymentMin && weeksWithoutPayment < weeksWithoutPaymentMin) continue;
        if (weeksWithoutPaymentMax && weeksWithoutPayment > weeksWithoutPaymentMax) continue;

        // Calcular monto pendiente
        const totalPaid = loan.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const totalDebt = Number(loan.amountGived || 0) + Number(loan.profitAmount || 0);
        const pendingAmount = Math.max(0, totalDebt - totalPaid);

        // Calcular cartera muerta estimada (monto pendiente)
        const badDebtCandidate = pendingAmount;

        processedLoans.push({
          id: loan.id,
          borrower: {
            fullName: loan.borrower.personalData.fullName || 'Sin nombre',
            clientCode: loan.borrower.personalData.clientCode || 'Sin código'
          },
          lead: {
            fullName: loan.lead.personalData.fullName || 'Sin líder',
            locality: loan.lead.personalData.addresses[0]?.location?.name || 'Sin localidad',
            route: loan.lead.routes?.name || 'Sin ruta'
          },
          pendingAmountStored: pendingAmount,
          weeksSinceLoan,
          weeksWithoutPayment,
          badDebtCandidate,
          badDebtDate: loan.badDebtDate,
          signDate: loan.signDate.toISOString(),
          status: loan.badDebtDate ? 'DEAD' : 'ACTIVE',
          payments: loan.payments.map(p => ({
            receivedAt: p.receivedAt.toISOString(),
            amount: Number(p.amount)
          }))
        });

        totalBadDebtCandidate += badDebtCandidate;
      }

      // Crear resumen por localidad
      const summaryMap = new Map<string, { loanCount: number; totalAmount: number }>();
      
      for (const loan of processedLoans) {
        const locality = loan.lead.locality;
        if (!summaryMap.has(locality)) {
          summaryMap.set(locality, { loanCount: 0, totalAmount: 0 });
        }
        const summary = summaryMap.get(locality)!;
        summary.loanCount++;
        summary.totalAmount += loan.pendingAmountStored;
      }

      const summary = Array.from(summaryMap.entries()).map(([locality, data]) => ({
        locality,
        loanCount: data.loanCount,
        totalAmount: data.totalAmount
      }));

      return JSON.stringify({
        loans: processedLoans,
        summary: {
          totalBadDebtCandidate,
          summary
        }
      });
    } catch (error: any) {
      console.error('Error al obtener créditos para cartera muerta:', error);
      return JSON.stringify({
        loans: [],
        summary: { totalBadDebtCandidate: 0, summary: [] },
        error: error.message
      });
    }
  }
});

// Resolver para obtener resumen de cartera muerta
export const deadDebtSummary = graphql.field({
  type: graphql.nonNull(graphql.String),
  args: {
    weeksSinceLoanMin: graphql.arg({ type: graphql.Int }),
    weeksSinceLoanMax: graphql.arg({ type: graphql.Int }),
    weeksWithoutPaymentMin: graphql.arg({ type: graphql.Int }),
    weeksWithoutPaymentMax: graphql.arg({ type: graphql.Int }),
    routeId: graphql.arg({ type: graphql.String }),
    localities: graphql.arg({ type: graphql.list(graphql.nonNull(graphql.String)) }),
    badDebtStatus: graphql.arg({ type: graphql.String })
  },
  resolve: async (source, { weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, routeId, localities, badDebtStatus }, context: Context) => {
    try {
      // Reutilizar la lógica de loansForDeadDebt pero solo devolver el resumen
      const loansResult = await loansForDeadDebt.resolve(source, { 
        weeksSinceLoanMin, 
        weeksSinceLoanMax, 
        weeksWithoutPaymentMin, 
        weeksWithoutPaymentMax, 
        routeId, 
        localities, 
        badDebtStatus 
      }, context);
      
      const parsedResult = JSON.parse(loansResult);
      return JSON.stringify(parsedResult.summary);
    } catch (error: any) {
      console.error('Error al obtener resumen de cartera muerta:', error);
      return JSON.stringify({ totalBadDebtCandidate: 0, summary: [] });
    }
  }
});

// Resolver para obtener desglose mensual de cartera muerta
export const deadDebtMonthlySummary = graphql.field({
  type: graphql.nonNull(graphql.String),
  args: {
    year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    weeksSinceLoanMin: graphql.arg({ type: graphql.Int }),
    weeksSinceLoanMax: graphql.arg({ type: graphql.Int }),
    weeksWithoutPaymentMin: graphql.arg({ type: graphql.Int }),
    weeksWithoutPaymentMax: graphql.arg({ type: graphql.Int }),
    routeId: graphql.arg({ type: graphql.String }),
    localities: graphql.arg({ type: graphql.list(graphql.nonNull(graphql.String)) }),
    badDebtStatus: graphql.arg({ type: graphql.String }),
    fromDate: graphql.arg({ type: graphql.String }),
    toDate: graphql.arg({ type: graphql.String })
  },
  resolve: async (source, { year, weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, routeId, localities, badDebtStatus, fromDate, toDate }, context: Context) => {
    try {
      console.log('📅 Generando desglose mensual de cartera muerta para año:', year);
      
      // Obtener información de rutas
      const routes = await context.prisma.route.findMany({
        select: { id: true, name: true }
      });

      // Calcular fechas límite
      const now = new Date();
      const weeksSinceLoanMinDate = weeksSinceLoanMin ? new Date(now.getTime() - (weeksSinceLoanMin * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksSinceLoanMaxDate = weeksSinceLoanMax ? new Date(now.getTime() - (weeksSinceLoanMax * 7 * 24 * 60 * 60 * 1000)) : null;

      // Construir filtros de fecha
      const dateFilters: any = {};
      if (weeksSinceLoanMinDate) {
        dateFilters.signDate = { ...dateFilters.signDate, lte: weeksSinceLoanMinDate };
      }
      if (weeksSinceLoanMaxDate) {
        dateFilters.signDate = { ...dateFilters.signDate, gte: weeksSinceLoanMaxDate };
      }

      // Filtro por estado de cartera muerta
      const badDebtFilters: any = {};
      if (badDebtStatus === 'MARKED') {
        badDebtFilters.badDebtDate = { not: null };
      } else if (badDebtStatus === 'UNMARKED') {
        badDebtFilters.badDebtDate = null;
      }

      // Construir filtros de localidad
      const localityFilters: any = {};
      if (localities && localities.length > 0) {
        localityFilters.lead = {
          personalData: {
            addresses: {
              some: {
                location: {
                  name: { in: localities }
                }
              }
            }
          }
        };
      }

      // Filtro por ruta
      const routeFilters: any = {};
      if (routeId) {
        routeFilters.lead = {
          ...routeFilters.lead,
          routes: { id: routeId }
        };
      }

      // Obtener préstamos con filtros
      const loans = await context.prisma.loan.findMany({
        where: {
          ...dateFilters,
          ...badDebtFilters,
          ...localityFilters,
          ...routeFilters,
          finishedDate: null // Solo préstamos activos
        },
        select: {
          id: true,
          signDate: true,
          badDebtDate: true,
          amountGived: true,
          profitAmount: true,
          oldId: true,
          snapshotRouteName: true,
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
              },
              routes: {
                select: {
                  name: true
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
        }
      });

      // Procesar préstamos por mes
      const monthlyData: { [key: string]: any } = {};
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];

      // Inicializar meses del año
      for (let month = 0; month < 12; month++) {
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = {
          month: monthNames[month],
          monthNumber: month + 1,
          loans: [],
          summary: {
            totalDeuda: 0,
            totalCarteraMuerta: 0,
            totalClientes: 0,
            totalRutas: 0
          }
        };
      }

      // Procesar cada préstamo
      for (const loan of loans) {
        const signDate = new Date(loan.signDate);
        const weeksSinceLoan = Math.floor((now.getTime() - signDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        
        // Calcular semanas sin pago
        const lastPayment = loan.payments[0];
        const lastPaymentDate = lastPayment ? new Date(lastPayment.receivedAt) : signDate;
        const weeksWithoutPayment = Math.floor((now.getTime() - lastPaymentDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

        // Aplicar filtros de semanas sin pago
        if (weeksWithoutPaymentMin && weeksWithoutPayment < weeksWithoutPaymentMin) continue;
        if (weeksWithoutPaymentMax && weeksWithoutPayment > weeksWithoutPaymentMax) continue;

        // Calcular monto pendiente
        const totalPaid = loan.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const totalDebt = Number(loan.amountGived || 0) + Number(loan.profitAmount || 0);
        const pendingAmount = Math.max(0, totalDebt - totalPaid);

        // Calcular cartera muerta estimada
        const badDebtCandidate = pendingAmount;

        // Determinar en qué mes evaluar este préstamo
        const evaluationDate = fromDate ? new Date(fromDate) : new Date(year, 11, 31); // Por defecto, fin de año
        const monthKey = `${evaluationDate.getFullYear()}-${String(evaluationDate.getMonth() + 1).padStart(2, '0')}`;

        if (monthlyData[monthKey]) {
          const processedLoan: any = {
            id: loan.id,
            borrower: {
              fullName: loan.borrower.personalData.fullName || 'Sin nombre',
              clientCode: loan.borrower.personalData.clientCode || 'Sin código'
            },
            lead: {
              fullName: loan.lead.personalData.fullName || 'Sin líder',
              locality: loan.lead.personalData.addresses[0]?.location?.name || 'Sin localidad',
              route: loan.lead.routes?.name || 'Sin ruta'
            },
            pendingAmountStored: pendingAmount,
            weeksSinceLoan,
            weeksWithoutPayment,
            badDebtCandidate,
            badDebtDate: loan.badDebtDate,
            signDate: loan.signDate.toISOString(),
            status: loan.badDebtDate ? 'DEAD' : 'ACTIVE',
            payments: loan.payments.map(p => ({
              receivedAt: p.receivedAt.toISOString(),
              amount: Number(p.amount)
            }))
          };

          monthlyData[monthKey].loans.push(processedLoan);
        }
      }

      // Calcular resúmenes por mes
      for (const monthKey in monthlyData) {
        const month = monthlyData[monthKey];
        const uniqueClients = new Set(month.loans.map((loan: any) => loan.borrower.clientCode));
        const uniqueRoutes = new Set(month.loans.map((loan: any) => loan.lead.route));
        
        month.summary = {
          totalDeuda: month.loans.reduce((sum: number, loan: any) => sum + loan.pendingAmountStored, 0),
          totalCarteraMuerta: month.loans.reduce((sum: number, loan: any) => sum + loan.badDebtCandidate, 0),
          totalClientes: uniqueClients.size,
          totalRutas: uniqueRoutes.size
        };
      }

      // Convertir a array y filtrar meses vacíos si es necesario
      const months = Object.values(monthlyData).filter(month => month.loans.length > 0);

      const result = {
        year,
        months,
        routesInfo: routes
      };

      return JSON.stringify(result);
    } catch (error: any) {
      console.error('Error al generar desglose mensual de cartera muerta:', error);
      return JSON.stringify({
        year,
        months: [],
        routesInfo: [],
        error: error.message
      });
    }
  }
});
