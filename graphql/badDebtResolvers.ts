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
    badDebtStatus: graphql.arg({ type: graphql.String }), // 'ALL' | 'MARKED' | 'UNMARKED'
    fromDate: graphql.arg({ type: graphql.String }),
    toDate: graphql.arg({ type: graphql.String })
  },
  resolve: async (source, { weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, routeId, localities, badDebtStatus, fromDate, toDate }, context: Context) => {
    try {
      console.log('🔍 Buscando créditos para cartera muerta:', { weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, routeId, localities, badDebtStatus, fromDate, toDate });

      // Calcular fechas límite
      const now = new Date();
      const weeksSinceLoanMinDate = weeksSinceLoanMin ? new Date(now.getTime() - (weeksSinceLoanMin * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksSinceLoanMaxDate = weeksSinceLoanMax ? new Date(now.getTime() - (weeksSinceLoanMax * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksWithoutPaymentMinDate = weeksWithoutPaymentMin ? new Date(now.getTime() - (weeksWithoutPaymentMin * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksWithoutPaymentMaxDate = weeksWithoutPaymentMax ? new Date(now.getTime() - (weeksWithoutPaymentMax * 7 * 24 * 60 * 60 * 1000)) : null;

      // Consulta real a la base de datos
      // NO aplicar filtro de localidades en la BD, lo haremos en memoria para mayor control

      const routeFilter: any = routeId ? { lead: { routesId: routeId } } : {};
      const localityFilter: any = {};

      const baseAndFilters: any[] = [
        routeFilter,
        localityFilter,
        {
          // Solo créditos que NO están terminados
          finishedDate: null
        },
        {
          // Solo créditos con deuda pendiente mayor a 0
          pendingAmountStored: { gt: 0 }
        }
      ];

      // Filtro por estado de cartera muerta
      if (badDebtStatus === 'MARKED') {
        const badDebtDateFilter: any = { not: null };

        // Si se proporcionan fechas específicas, filtrar por fecha de marcado
        if (fromDate || toDate) {
          const dateRange: any = {};
          if (fromDate) {
            dateRange.gte = new Date(fromDate);
          }
          if (toDate) {
            dateRange.lte = new Date(toDate);
          }
          badDebtDateFilter.and = dateRange;
        }

        baseAndFilters.push({ badDebtDate: badDebtDateFilter });
      } else if (badDebtStatus === 'UNMARKED' || !badDebtStatus) {
        // Por defecto, mostrar solo no marcados (comportamiento previo)
        baseAndFilters.push({ badDebtDate: null });
      } // 'ALL' no agrega condición

      // Filtros de semanas desde el crédito
      if (weeksSinceLoanMin !== null && weeksSinceLoanMin !== undefined && weeksSinceLoanMinDate) {
        baseAndFilters.push({ signDate: { lte: weeksSinceLoanMinDate } });
      }
      if (weeksSinceLoanMax !== null && weeksSinceLoanMax !== undefined && weeksSinceLoanMaxDate) {
        baseAndFilters.push({ signDate: { gte: weeksSinceLoanMaxDate } });
      }

      // Filtros de semanas sin pago
      if (weeksWithoutPaymentMin !== null && weeksWithoutPaymentMin !== undefined && weeksWithoutPaymentMinDate) {
        baseAndFilters.push({
          OR: [
            {
              // Créditos que no tienen pagos recientes (mínimo)
              payments: {
                none: { receivedAt: { gte: weeksWithoutPaymentMinDate } }
              }
            },
            {
              // Créditos que no tienen ningún pago
              payments: { none: {} }
            }
          ]
        });
      }
      if (weeksWithoutPaymentMax !== null && weeksWithoutPaymentMax !== undefined && weeksWithoutPaymentMaxDate) {
        baseAndFilters.push({
          OR: [
            {
              // Créditos que SÍ tienen pagos recientes (máximo)
              payments: {
                some: { receivedAt: { gte: weeksWithoutPaymentMaxDate } }
              }
            }
          ]
        });
      }

      let loans = await context.prisma.loan.findMany({
        where: { AND: baseAndFilters },
        select: {
          id: true,
          amountGived: true,
          profitAmount: true,
          signDate: true,
          pendingAmountStored: true,
          badDebtDate: true,
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
              amount: true,
              createdAt: true
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

      // Filtro de localidades en memoria - Incluir créditos donde el LÍDER pertenezca a la localidad solicitada
      console.log('🔍 Antes del filtro de localidades:', loans.length, 'créditos');

      // Debug: verificar datos básicos de los primeros créditos
      console.log('\n🔍 VERIFICACIÓN DE DATOS DE LA BD:');
      loans.slice(0, 2).forEach((loan, index) => {
        console.log(`  Crédito ${index + 1}:`);
        console.log(`    - ID: ${loan.id}`);
        console.log(`    - Cliente: ${loan.borrower?.personalData?.fullName || 'N/A'}`);
        console.log(`    - amountGived: ${loan.amountGived}`);
        console.log(`    - profitAmount: ${loan.profitAmount}`);
        console.log(`    - pendingAmountStored: ${loan.pendingAmountStored}`);
        console.log(`    - badDebtDate: ${loan.badDebtDate}`);
        console.log(`    - Pagos: ${loan.payments?.length || 0} pagos`);
      });

      if (Array.isArray(localities) && localities.length > 0) {
        console.log('🔍 Filtrando por localidad del LÍDER:', localities);
        const allowed = new Set(localities.filter(Boolean));
        const beforeFilter = loans.length;
        loans = loans.filter(loan => {
          // Obtener la localidad del líder desde su dirección
          const leadLocality = loan.lead?.personalData?.addresses?.[0]?.location?.name || '';

          // Incluir si la localidad del líder coincide con alguna de las solicitadas
          const hasMatchingLocality = allowed.has(leadLocality);

          if (!hasMatchingLocality) {
            console.log('🔍 Crédito excluido - localidad del líder:', leadLocality, 'vs solicitadas:', localities);
          } else {
            console.log('🔍 Crédito incluido - localidad del líder:', leadLocality, 'coincide con:', localities);
          }

          return hasMatchingLocality;
        });
        console.log('🔍 Después del filtro de localidades:', loans.length, 'créditos (se excluyeron', beforeFilter - loans.length, ')');
      } else {
        console.log('🔍 No se aplicó filtro de localidades');
      }

      console.log('🔍 Datos brutos de la consulta:', loans.length, 'créditos');
      console.log('🔍 Primer crédito (ejemplo):', loans[0] ? {
        id: loans[0].id,
        leadName: loans[0].lead?.personalData?.fullName,
        routeName: loans[0].lead?.routes?.name,
        localities: loans[0].lead?.routes?.localities?.map(l => l.name),
        pendingAmount: loans[0].pendingAmountStored
      } : 'No hay créditos');

      // Procesar los datos para calcular semanas y badDebtCandidate (misma lógica del reporte)
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

        // badDebtCandidate: deuda que se convierte en cartera muerta (FÓRMULA IDÉNTICA al reporte financiero)
        const amountGivedNum = Number(loan.amountGived || 0);
        const profitAmountNum = Number(loan.profitAmount || 0);
        const totalToPay = amountGivedNum + profitAmountNum;

        // Si ya está marcado como cartera muerta, usar esa fecha; si no, usar hoy para estimar
        const badDebtDate = loan.badDebtDate ? new Date(loan.badDebtDate) : now;

        // Debug: verificar la fecha que se está usando
        if (loan.borrower?.personalData?.fullName?.includes('LILI FRAIDE DIAZ ZAVALA')) {
          console.log('  📅 FECHA DE CÁLCULO:');
          console.log('    - badDebtDate original:', loan.badDebtDate);
          console.log('    - badDebtDate procesada:', badDebtDate.toISOString());
          console.log('    - now:', now.toISOString());
          console.log('    - ¿Usando fecha de cartera muerta?', !!loan.badDebtDate);
        }

        // Ordenar pagos por fecha (igual que en getFinancialReport)
        const paymentsByDate = (loan.payments || []).map(payment => ({
          amount: Number(payment.amount || 0),
          date: new Date(payment.receivedAt || payment.createdAt || new Date())
        })).sort((a, b) => a.date.getTime() - b.date.getTime());

        // Calcular pagos hasta la fecha de cartera muerta (FÓRMULA IDÉNTICA)
        let totalPaid = 0;
        let gananciaCobrada = 0;
        for (const payment of paymentsByDate) {
          if (payment.date <= badDebtDate) {
            totalPaid += payment.amount;
            // Aproximación de ganancia cobrada (FÓRMULA IDÉNTICA al reporte financiero)
            gananciaCobrada += payment.amount * (profitAmountNum / totalToPay);
          } else {
            break; // Los pagos están ordenados por fecha
          }
        }

        // FÓRMULA CORREGIDA: Deuda Pendiente - Ganancia por Cobrar
        const deudaPendiente = Number(loan.pendingAmountStored || 0); // Usar pendingAmountStored

        // Calcular ganancia por cobrar: ganancia que falta por cobrar de los pagos pendientes
        const pagosPendientes = deudaPendiente; // Monto que falta por pagar
        const gananciaPorCobrar = pagosPendientes * (profitAmountNum / totalToPay); // Proporción de ganancia

        const badDebtCandidate = Math.max(0, deudaPendiente - gananciaPorCobrar);

        // Debug detallado para LILI FRAIDE DIAZ ZAVALA
        if (loan.borrower?.personalData?.fullName?.includes('LILI FRAIDE DIAZ ZAVALA')) {
          console.log('\n🔍 DEBUG DETALLADO - LILI FRAIDE DIAZ ZAVALA:');
          console.log('  📊 DATOS BÁSICOS:');
          console.log('    - amountGivedNum:', amountGivedNum);
          console.log('    - profitAmountNum:', profitAmountNum);
          console.log('    - totalToPay:', totalToPay);
          console.log('    - pendingAmountStored:', loan.pendingAmountStored);
          console.log('    - badDebtDate:', badDebtDate.toISOString());
          console.log('  💰 PAGOS:');
          console.log('    - totalPaid:', totalPaid);
          console.log('    - gananciaCobrada:', gananciaCobrada);
          console.log('    - paymentsByDate:', paymentsByDate.map(p => ({
            amount: p.amount,
            date: p.date.toISOString()
          })));
          console.log('  🧮 CÁLCULOS (FÓRMULA CORREGIDA):');
          console.log('    - deudaPendiente:', deudaPendiente, '(pendingAmountStored)');
          console.log('    - pagosPendientes:', pagosPendientes, '(monto que falta por pagar)');
          console.log('    - gananciaPorCobrar:', gananciaPorCobrar.toFixed(2), '(ganancia que falta por cobrar)');
          console.log('    - badDebtCandidate:', badDebtCandidate.toFixed(2), '(deudaPendiente - gananciaPorCobrar)');
          console.log('  📈 VERIFICACIÓN:');
          console.log('    - Ratio ganancia/total:', (profitAmountNum / totalToPay).toFixed(4));
          console.log('    - Ganancia por pago promedio:', paymentsByDate.length > 0 ? (gananciaCobrada / paymentsByDate.length).toFixed(2) : 'N/A');
          console.log('\n');
        }

        return {
          id: loan.id,
          requestedAmount: Number(loan.requestedAmount),
          amountGived: Number(loan.amountGived),
          signDate: loan.signDate.toISOString(),
          pendingAmountStored: Number(loan.pendingAmountStored || 0),
          badDebtDate: loan.badDebtDate ? loan.badDebtDate.toISOString() : null,
          borrower: {
            fullName: loan.borrower?.personalData?.fullName || 'Sin nombre',
            clientCode: loan.borrower?.personalData?.clientCode || 'Sin código'
          },
          lead: {
            fullName: loan.lead?.personalData?.fullName || 'Sin líder',
            locality: {
              name: loan.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad'
            }
          },
          weeksSinceLoan: weeksSinceLoanCalculated,
          weeksWithoutPayment: weeksWithoutPaymentCalculated,
          badDebtCandidate
        };
      });

      console.log('✅ Créditos encontrados para cartera muerta:', processedLoans.length);

      // Debug: verificar localidades (renombrado para no chocar con arg 'localities')
      const foundLocalities = [...new Set(processedLoans.map(loan => loan.lead.locality.name))];
      console.log('📍 Localidades encontradas:', foundLocalities);

      // Calcular total de cartera muerta estimada
      const totalBadDebtCandidate = processedLoans.reduce((sum, loan) => sum + (loan.badDebtCandidate || 0), 0);
      console.log('💰 Total cartera muerta estimada:', totalBadDebtCandidate);

      // Debug: mostrar algunos créditos para verificar
      console.log('\n🔍 MUESTRA DE CRÉDITOS PROCESADOS:');
      processedLoans.slice(0, 3).forEach((loan, index) => {
        console.log(`  ${index + 1}. ${loan.borrower.fullName} - Cartera Muerta: $${loan.badDebtCandidate?.toFixed(2) || '0.00'}`);
      });

      return JSON.stringify({
        loans: processedLoans,
        summary: {
          totalLoans: processedLoans.length,
          totalBadDebtCandidate: totalBadDebtCandidate,
          localities: foundLocalities
        }
      });
    } catch (error) {
      console.error('Error al obtener créditos para cartera muerta:', error);
      return JSON.stringify([]);
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
    badDebtStatus: graphql.arg({ type: graphql.String }), // 'ALL' | 'MARKED' | 'UNMARKED'
    fromDate: graphql.arg({ type: graphql.String }),
    toDate: graphql.arg({ type: graphql.String })
  },
  resolve: async (source, { weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, routeId, localities, badDebtStatus, fromDate, toDate }, context: Context) => {
    try {
      console.log('🔍 Generando resumen de cartera muerta:', { weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, fromDate, toDate });

      // Calcular fechas límite (misma lógica que loansForDeadDebt)
      const now = new Date();
      const weeksSinceLoanMinDate = weeksSinceLoanMin ? new Date(now.getTime() - (weeksSinceLoanMin * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksSinceLoanMaxDate = weeksSinceLoanMax ? new Date(now.getTime() - (weeksSinceLoanMax * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksWithoutPaymentMinDate = weeksWithoutPaymentMin ? new Date(now.getTime() - (weeksWithoutPaymentMin * 7 * 24 * 60 * 60 * 1000)) : null;
      const weeksWithoutPaymentMaxDate = weeksWithoutPaymentMax ? new Date(now.getTime() - (weeksWithoutPaymentMax * 7 * 24 * 60 * 60 * 1000)) : null;

      // Consulta real a la base de datos (misma lógica que loansForDeadDebt)
      // Si localidades viene vacío o null, no filtramos por localidad

      const routeFilter: any = routeId ? { lead: { routesId: routeId } } : {};
      // NO aplicar filtro de localidades en la BD, lo haremos en memoria para mayor control
      const localityFilter: any = {};

      const summaryAndFilters: any[] = [
        routeFilter,
        localityFilter,
        { finishedDate: null },
        { pendingAmountStored: { gt: 0 } }
      ];

      if (badDebtStatus === 'MARKED') {
        const badDebtDateFilter: any = { not: null };

        // Si se proporcionan fechas específicas, filtrar por fecha de marcado
        if (fromDate || toDate) {
          const dateRange: any = {};
          if (fromDate) {
            dateRange.gte = new Date(fromDate);
          }
          if (toDate) {
            dateRange.lte = new Date(toDate);
          }
          badDebtDateFilter.and = dateRange;
        }

        summaryAndFilters.push({ badDebtDate: badDebtDateFilter });
      } else if (badDebtStatus === 'UNMARKED' || !badDebtStatus) {
        summaryAndFilters.push({ badDebtDate: null });
      }
      // Filtros de semanas desde el crédito
      if (weeksSinceLoanMin !== null && weeksSinceLoanMin !== undefined && weeksSinceLoanMinDate) {
        summaryAndFilters.push({ signDate: { lte: weeksSinceLoanMinDate } });
      }
      if (weeksSinceLoanMax !== null && weeksSinceLoanMax !== undefined && weeksSinceLoanMaxDate) {
        summaryAndFilters.push({ signDate: { gte: weeksSinceLoanMaxDate } });
      }

      // Filtros de semanas sin pago
      if (weeksWithoutPaymentMin !== null && weeksWithoutPaymentMin !== undefined && weeksWithoutPaymentMinDate) {
        summaryAndFilters.push({
          OR: [
            { payments: { none: { receivedAt: { gte: weeksWithoutPaymentMinDate } } } },
            { payments: { none: {} } }
          ]
        });
      }
      if (weeksWithoutPaymentMax !== null && weeksWithoutPaymentMax !== undefined && weeksWithoutPaymentMaxDate) {
        summaryAndFilters.push({
          OR: [
            { payments: { some: { receivedAt: { gte: weeksWithoutPaymentMaxDate } } } }
          ]
        });
      }

      let loans = await context.prisma.loan.findMany({
        where: { AND: summaryAndFilters },
        include: {
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
          // Ya no es necesario incluir pagos aquí; sumaremos pagos por agregación
        }
      });

      // Filtro de localidades en memoria - Incluir créditos donde el LÍDER pertenezca a la localidad solicitada
      if (Array.isArray(localities) && localities.length > 0) {
        const allowed = new Set(localities.filter(Boolean));
        loans = loans.filter(loan => {
          // Obtener la localidad del líder desde su dirección
          const leadLocality = loan.lead?.personalData?.addresses?.[0]?.location?.name || '';

          // Incluir si la localidad del líder coincide con alguna de las solicitadas
          return allowed.has(leadLocality);
        });
      }

      // Sumar pagos por loan mediante agregación, sin cargar todas las filas
      const paymentSums = await context.prisma.loanPayment.groupBy({
        by: ['loanId'],
        _sum: { amount: true },
        where: { loanId: { in: loans.map(l => l.id) } }
      });
      const paidByLoan = new Map<string, number>(
        paymentSums.map(p => [p.loanId as string, Number(p._sum.amount || 0)])
      );

      // Procesar los datos y agrupar por localidad con ambos totales
      const summaryMap = new Map<string, { loanCount: number; totalPending: number; totalPaid: number }>();

      loans.forEach(loan => {
        // Usar la localidad del líder desde su dirección
        const localityName = loan.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad';
        const pendingAmount = Number(loan.pendingAmountStored || 0);
        const paidAmount = paidByLoan.get(loan.id) || 0;

        const current = summaryMap.get(localityName) || { loanCount: 0, totalPending: 0, totalPaid: 0 };
        current.loanCount += 1;
        current.totalPending += pendingAmount;
        current.totalPaid += paidAmount;
        summaryMap.set(localityName, current);
      });

      const summary = Array.from(summaryMap.entries()).map(([locality, data]) => ({
        locality,
        loanCount: data.loanCount,
        totalAmount: data.totalPending, // alias para compatibilidad
        totalPending: data.totalPending,
        totalPaid: data.totalPaid
      }));

      console.log('✅ Resumen generado:', summary.length, 'localidades');

      return JSON.stringify(summary);
    } catch (error) {
      console.error('Error al generar resumen de cartera muerta:', error);
      return JSON.stringify([]);
    }
  }
});


export const deadDebtByMonth = graphql.field({
  type: graphql.nonNull(graphql.String),
  args: {
    routeId: graphql.arg({ type: graphql.String }),
    localities: graphql.arg({ type: graphql.list(graphql.nonNull(graphql.String)) }),
    year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    month: graphql.arg({ type: graphql.nonNull(graphql.Int) })
  },
  resolve: async (source, { routeId, localities, year, month }, context: Context) => {
    try {
      console.log('🔍 Generando cartera muerta por mes:', { routeId, localities, year, month });

      // Calcular fechas del mes
      const monthStart = new Date(year, month - 1, 1); // Mes en JavaScript es 0-indexado
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999); // Último día del mes

      console.log('📅 Rango del mes:', monthStart.toISOString(), 'a', monthEnd.toISOString());

      // Consulta para obtener préstamos marcados como cartera muerta en este mes específico
      const routeFilter: any = routeId ? { lead: { routesId: routeId } } : {};

      const loans = await context.prisma.loan.findMany({
        where: {
          AND: [
            routeFilter,
            { finishedDate: null },
            { pendingAmountStored: { gt: 0 } },
            { badDebtDate: { gte: monthStart, lte: monthEnd } } // Marcados como cartera muerta en este mes
          ]
        },
        select: {
          id: true,
          amountGived: true,
          profitAmount: true,
          signDate: true,
          pendingAmountStored: true,
          badDebtDate: true,
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
              }
            }
          },
          payments: {
            select: {
              receivedAt: true,
              amount: true,
              createdAt: true
            },
            orderBy: {
              receivedAt: 'desc'
            }
          }
        },
        orderBy: {
          badDebtDate: 'asc'
        }
      });

      console.log('📊 Préstamos encontrados marcados como cartera muerta en el mes:', loans.length);

      // Filtro de localidades en memoria
      let filteredLoans = loans;
      if (Array.isArray(localities) && localities.length > 0) {
        const allowed = new Set(localities.filter(Boolean));
        filteredLoans = loans.filter(loan => {
          const leadLocality = loan.lead?.personalData?.addresses?.[0]?.location?.name || '';
          return allowed.has(leadLocality);
        });
        console.log('📍 Después del filtro de localidades:', filteredLoans.length, 'préstamos');
      }

      // Procesar cada préstamo y calcular cartera muerta
      const processedLoans = filteredLoans.map(loan => {
        const amountGivedNum = Number(loan.amountGived || 0);
        const profitAmountNum = Number(loan.profitAmount || 0);
        const totalToPay = amountGivedNum + profitAmountNum;

        // Usar la fecha de cartera muerta para el cálculo
        const badDebtDate = new Date(loan.badDebtDate!);

        // Ordenar pagos por fecha
        const paymentsByDate = (loan.payments || []).map(payment => ({
          amount: Number(payment.amount || 0),
          date: new Date(payment.receivedAt || payment.createdAt || new Date())
        })).sort((a, b) => a.date.getTime() - b.date.getTime());

        // Calcular pagos hasta la fecha de cartera muerta
        let totalPaid = 0;
        let gananciaCobrada = 0;
        for (const payment of paymentsByDate) {
          if (payment.date <= badDebtDate) {
            totalPaid += payment.amount;
            gananciaCobrada += payment.amount * (profitAmountNum / totalToPay);
          } else {
            break;
          }
        }

        // Fórmula corregida: Deuda Pendiente - Ganancia por Cobrar
        const deudaPendiente = Number(loan.pendingAmountStored || 0);
        const pagosPendientes = deudaPendiente;
        const gananciaPorCobrar = pagosPendientes * (profitAmountNum / totalToPay);
        const badDebtCandidate = Math.max(0, deudaPendiente - gananciaPorCobrar);

        return {
          id: loan.id,
          requestedAmount: amountGivedNum,
          amountGived: amountGivedNum,
          signDate: loan.signDate.toISOString(),
          pendingAmountStored: deudaPendiente,
          badDebtDate: loan.badDebtDate?.toISOString() || null,
          badDebtCandidate: badDebtCandidate,
          borrower: {
            fullName: loan.borrower?.personalData?.fullName || 'Sin cliente',
            clientCode: loan.borrower?.personalData?.clientCode || 'Sin código'
          },
          lead: {
            fullName: loan.lead?.personalData?.fullName || 'Sin líder',
            locality: {
              name: loan.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad'
            }
          },
          weeksSinceLoan: Math.floor((new Date().getTime() - new Date(loan.signDate).getTime()) / (7 * 24 * 60 * 60 * 1000)),
          weeksWithoutPayment: Math.floor((new Date().getTime() - (paymentsByDate[paymentsByDate.length - 1]?.date.getTime() || new Date(loan.signDate).getTime())) / (7 * 24 * 60 * 60 * 1000))
        };
      });

      // Calcular totales
      const totalBadDebtCandidate = processedLoans.reduce((sum, loan) => sum + (loan.badDebtCandidate || 0), 0);
      const totalPendingAmount = processedLoans.reduce((sum, loan) => sum + (loan.pendingAmountStored || 0), 0);

      const result = {
        month: {
          year,
          month,
          name: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month - 1],
          startDate: monthStart.toISOString(),
          endDate: monthEnd.toISOString()
        },
        summary: {
          totalLoans: processedLoans.length,
          totalPendingAmount: totalPendingAmount,
          totalBadDebtCandidate: totalBadDebtCandidate
        },
        loans: processedLoans
      };

      console.log('✅ Cartera muerta por mes generada:', result.summary);

      return JSON.stringify(result);
    } catch (error) {
      console.error('Error al generar cartera muerta por mes:', error);
      return JSON.stringify({ error: 'Error al generar cartera muerta por mes' });
    }
  }
});

export const deadDebtMonthlySummary = graphql.field({
  type: graphql.nonNull(graphql.String),
  args: {
    routeId: graphql.arg({ type: graphql.String }),
    localities: graphql.arg({ type: graphql.list(graphql.nonNull(graphql.String)) }),
    year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    weeksSinceLoanMin: graphql.arg({ type: graphql.Int }),
    weeksSinceLoanMax: graphql.arg({ type: graphql.Int }),
    weeksWithoutPaymentMin: graphql.arg({ type: graphql.Int }),
    weeksWithoutPaymentMax: graphql.arg({ type: graphql.Int }),
    badDebtStatus: graphql.arg({ type: graphql.String }),
    fromDate: graphql.arg({ type: graphql.String }),
    toDate: graphql.arg({ type: graphql.String })
  },
  resolve: async (source, { routeId, localities, year, weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, badDebtStatus, fromDate, toDate }, context: Context) => {
    try {
      console.log('🔍 Generando resumen mensual de cartera muerta:', { routeId, localities, year, weeksSinceLoanMin, weeksSinceLoanMax, weeksWithoutPaymentMin, weeksWithoutPaymentMax, badDebtStatus });

      const now = new Date();

      // Obtener créditos que cumplen los criterios de filtros (igual que la consulta principal)
      // Si no se especifica routeId, incluir todas las rutas
      const routeFilter: any = routeId ? { lead: { routesId: routeId } } : {};

      // Aplicar los mismos filtros que la consulta principal
      const baseAndFilters: any[] = [
        routeFilter,
        { finishedDate: null },
        { pendingAmountStored: { gt: 0 } }
      ];

      // Filtro de estado de cartera muerta
      if (badDebtStatus === 'MARKED') {
        const badDebtDateFilter: any = { not: null };

        // Si se proporcionan fechas específicas, filtrar por fecha de marcado
        if (fromDate || toDate) {
          const dateRange: any = {};
          if (fromDate) {
            dateRange.gte = new Date(fromDate);
          }
          if (toDate) {
            dateRange.lte = new Date(toDate);
          }
          badDebtDateFilter.and = dateRange;
        }

        baseAndFilters.push({ badDebtDate: badDebtDateFilter });
      } else if (badDebtStatus === 'UNMARKED' || !badDebtStatus) {
        baseAndFilters.push({ badDebtDate: null });
      }

      // Filtros de semanas desde el crédito
      if (weeksSinceLoanMin !== null && weeksSinceLoanMin !== undefined) {
        const weeksSinceLoanMinDate = new Date(now.getTime() - (weeksSinceLoanMin * 7 * 24 * 60 * 60 * 1000));
        baseAndFilters.push({ signDate: { lte: weeksSinceLoanMinDate } });
      }
      if (weeksSinceLoanMax !== null && weeksSinceLoanMax !== undefined) {
        const weeksSinceLoanMaxDate = new Date(now.getTime() - (weeksSinceLoanMax * 7 * 24 * 60 * 60 * 1000));
        baseAndFilters.push({ signDate: { gte: weeksSinceLoanMaxDate } });
      }

      // Filtros de semanas sin pago
      if (weeksWithoutPaymentMin !== null && weeksWithoutPaymentMin !== undefined) {
        const weeksWithoutPaymentMinDate = new Date(now.getTime() - (weeksWithoutPaymentMin * 7 * 24 * 60 * 60 * 1000));
        baseAndFilters.push({
          OR: [
            { payments: { none: { receivedAt: { gte: weeksWithoutPaymentMinDate } } } },
            { payments: { none: {} } }
          ]
        });
      }
      if (weeksWithoutPaymentMax !== null && weeksWithoutPaymentMax !== undefined) {
        const weeksWithoutPaymentMaxDate = new Date(now.getTime() - (weeksWithoutPaymentMax * 7 * 24 * 60 * 60 * 1000));
        baseAndFilters.push({
          OR: [
            { payments: { some: { receivedAt: { gte: weeksWithoutPaymentMaxDate } } } }
          ]
        });
      }

      const allLoans = await context.prisma.loan.findMany({
        where: {
          AND: baseAndFilters
        },
        select: {
          id: true,
          signDate: true,
          amountGived: true,
          profitAmount: true,
          pendingAmountStored: true,
          badDebtDate: true,
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
              routes: {
                select: {
                  name: true
                }
              },
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
              receivedAt: true,
              amount: true,
              createdAt: true
            },
            orderBy: {
              receivedAt: 'desc'
            }
          }
        }
      });

      console.log('📊 Total créditos obtenidos de la base de datos:', allLoans.length);

      // Filtrar por localidades si se especificaron
      let filteredLoans = allLoans;
      if (Array.isArray(localities) && localities.length > 0) {
        const allowed = new Set(localities.filter(Boolean));
        filteredLoans = allLoans.filter(loan => {
          const leadLocality = loan.lead?.personalData?.addresses?.[0]?.location?.name || '';
          return allowed.has(leadLocality);
        });
      }

      const monthlySummary = [];
      const processedLoanIds = new Set<string>(); // Para evitar duplicados

      // Convertir fechas de filtro si se proporcionaron
      const fromDateFilter = fromDate ? new Date(fromDate) : null;
      const toDateFilter = toDate ? new Date(toDate) : null;

      // Procesar cada mes del año
      for (let month = 1; month <= 12; month++) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

        // Filtrar por rango de fechas si se especificó
        if (fromDateFilter && monthEnd < fromDateFilter) continue;
        if (toDateFilter && monthStart > toDateFilter) continue;

        // Para cada mes, calcular las fechas límite basándose en el último día del mes
        const evaluationDate = monthEnd; // Último día del mes para evaluar criterios

        // Calcular fechas límite basándose en el final del mes evaluado
        const weeksSinceLoanMinDate = weeksSinceLoanMin ? new Date(evaluationDate.getTime() - (weeksSinceLoanMin * 7 * 24 * 60 * 60 * 1000)) : null;
        const weeksSinceLoanMaxDate = weeksSinceLoanMax ? new Date(evaluationDate.getTime() - (weeksSinceLoanMax * 7 * 24 * 60 * 60 * 1000)) : null;
        const weeksWithoutPaymentMinDate = weeksWithoutPaymentMin ? new Date(evaluationDate.getTime() - (weeksWithoutPaymentMin * 7 * 24 * 60 * 60 * 1000)) : null;
        const weeksWithoutPaymentMaxDate = weeksWithoutPaymentMax ? new Date(evaluationDate.getTime() - (weeksWithoutPaymentMax * 7 * 24 * 60 * 60 * 1000)) : null;

        // Contadores para debug
        let totalEvaluated = 0;
        let passedBadDebtFilter = 0;
        let passedTimeFilters = 0;
        let passedAllFilters = 0;

        // Filtrar créditos que cumplieron con los criterios EN ESE MES
        // Y que NO han sido procesados en meses anteriores
        const loansInMonth = filteredLoans.filter(loan => {
          totalEvaluated++;
          // Excluir créditos ya procesados en meses anteriores
          if (processedLoanIds.has(loan.id)) return false;

          const signDate = new Date(loan.signDate);

          // El crédito debe haberse dado antes del final del mes
          if (signDate > monthEnd) return false;

          // Evaluar criterios de estado de cartera muerta al final del mes
          let passesBadDebtStatus = true;
          if (badDebtStatus === 'MARKED') {
            // Para marcados: debe tener badDebtDate y haber sido marcado en o antes del mes evaluado
            if (!loan.badDebtDate) {
              passesBadDebtStatus = false;
            } else {
              const badDebtDate = new Date(loan.badDebtDate);
              passesBadDebtStatus = badDebtDate <= evaluationDate;
            }
          } else if (badDebtStatus === 'UNMARKED' || !badDebtStatus) {
            // Para no marcados: NO debe tener badDebtDate O debe haber sido marcado DESPUÉS del mes evaluado
            if (loan.badDebtDate) {
              const badDebtDate = new Date(loan.badDebtDate);
              passesBadDebtStatus = badDebtDate > evaluationDate; // Si fue marcado después del mes, incluir
            }
            // Si no tiene badDebtDate, incluir (está no marcado)
          }

          if (passesBadDebtStatus) passedBadDebtFilter++;

          // Debug: log para el primer mes (solo algunos créditos)
          if (month === 1 && Math.random() < 0.05) {
            console.log(`🔍 DEBUG MES ${month} - badDebtStatus: ${badDebtStatus}`);
            console.log(`  - Loan ID: ${loan.id}`);
            console.log(`  - badDebtDate: ${loan.badDebtDate}`);
            console.log(`  - evaluationDate: ${evaluationDate.toISOString()}`);

            let passesBadDebtFilter = true;
            if (badDebtStatus === 'MARKED') {
              passesBadDebtFilter = loan.badDebtDate && new Date(loan.badDebtDate) <= evaluationDate;
            } else if (badDebtStatus === 'UNMARKED' || !badDebtStatus) {
              passesBadDebtFilter = !loan.badDebtDate || new Date(loan.badDebtDate) > evaluationDate;
            }

            console.log(`  - ¿Pasa filtro badDebt? ${passesBadDebtFilter}`);
            console.log(`  - ¿Pasa filtro general? ${!processedLoanIds.has(loan.id) && signDate <= monthEnd}`);
          }

          // Evaluar criterios de semanas desde el crédito al final del mes
          const weeksSinceLoan = Math.floor((evaluationDate.getTime() - signDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

          if (weeksSinceLoanMin !== null && weeksSinceLoanMin !== undefined) {
            if (weeksSinceLoan < weeksSinceLoanMin) return false;
          }
          if (weeksSinceLoanMax !== null && weeksSinceLoanMax !== undefined) {
            if (weeksSinceLoan > weeksSinceLoanMax) return false;
          }

          // Evaluar criterios de semanas sin pago al final del mes
          const lastPaymentDate = loan.payments && loan.payments.length > 0
            ? new Date(Math.max(...loan.payments.map(p => new Date(p.receivedAt || p.createdAt || new Date()).getTime())))
            : signDate;

          const weeksWithoutPayment = Math.floor((evaluationDate.getTime() - lastPaymentDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

          if (weeksWithoutPaymentMin !== null && weeksWithoutPaymentMin !== undefined) {
            if (weeksWithoutPayment < weeksWithoutPaymentMin) return false;
          }
          if (weeksWithoutPaymentMax !== null && weeksWithoutPaymentMax !== undefined) {
            if (weeksWithoutPayment > weeksWithoutPaymentMax) return false;
          }

          passedTimeFilters++;
          passedAllFilters++;
          return true;
        });

        // Debug: log detallado del filtrado
        console.log(`\n📊 MES ${month} (${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month - 1]}) - badDebtStatus: ${badDebtStatus}`);
        console.log(`  - Fecha evaluación: ${evaluationDate.toISOString()}`);
        console.log(`  - Total créditos evaluados: ${totalEvaluated}`);
        console.log(`  - Pasaron filtro badDebtStatus: ${passedBadDebtFilter}`);
        console.log(`  - Pasaron filtros de tiempo: ${passedTimeFilters}`);
        console.log(`  - Pasaron TODOS los filtros: ${passedAllFilters}`);
        console.log(`  - Créditos ya procesados: ${processedLoanIds.size}`);
        console.log(`  - Créditos finales en mes: ${loansInMonth.length}`);

        // Debug detallado de algunos créditos
        if (loansInMonth.length > 0) {
          console.log(`  - Ejemplos de créditos que pasaron:`);
          loansInMonth.slice(0, 3).forEach((loan, idx) => {
            console.log(`    ${idx + 1}. ID: ${loan.id}, badDebtDate: ${loan.badDebtDate || 'null'}`);
          });
        }

        // Marcar estos créditos como procesados para evitar duplicados en meses posteriores
        loansInMonth.forEach(loan => {
          processedLoanIds.add(loan.id);
        });

        // Calcular cartera muerta para cada préstamo que cumplió criterios en este mes
        let totalBadDebtCandidate = 0;
        let totalPendingAmount = 0;

        for (const loan of loansInMonth) {
          const amountGivedNum = Number(loan.amountGived || 0);
          const profitAmountNum = Number(loan.profitAmount || 0);
          const totalToPay = amountGivedNum + profitAmountNum;

          // Usar la fecha de evaluación del mes para el cálculo
          const evaluationDateForCalculation = evaluationDate;

          const paymentsByDate = (loan.payments || []).map(payment => ({
            amount: Number(payment.amount || 0),
            date: new Date(payment.receivedAt || payment.createdAt || new Date())
          })).sort((a, b) => a.date.getTime() - b.date.getTime());

          let totalPaid = 0;
          let gananciaCobrada = 0;
          for (const payment of paymentsByDate) {
            if (payment.date <= evaluationDateForCalculation) {
              totalPaid += payment.amount;
              gananciaCobrada += payment.amount * (profitAmountNum / totalToPay);
            } else {
              break;
            }
          }

          // Calcular cartera muerta usando el mismo método que el reporte financiero
          const deudaPendiente = totalToPay - totalPaid;
          const gananciaPendiente = profitAmountNum - gananciaCobrada;
          const badDebtCandidate = Math.max(0, deudaPendiente - gananciaPendiente);

          totalBadDebtCandidate += badDebtCandidate;
          totalPendingAmount += deudaPendiente;
        }

        monthlySummary.push({
          month: {
            year,
            month,
            name: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month - 1],
            startDate: monthStart.toISOString(),
            endDate: monthEnd.toISOString()
          },
          evaluationPeriod: {
            from: monthStart.toISOString(),
            to: monthEnd.toISOString(),
            description: `Desde ${monthStart.toLocaleDateString('es-ES')} hasta ${monthEnd.toLocaleDateString('es-ES')}`
          },
          criteria: {
            weeksSinceLoanMin,
            weeksSinceLoanMax,
            weeksWithoutPaymentMin,
            weeksWithoutPaymentMax,
            badDebtStatus,
            localities: localities || []
          },
          summary: {
            totalLoans: loansInMonth.length,
            totalPendingAmount: totalPendingAmount,
            totalBadDebtCandidate: totalBadDebtCandidate
          },
          loans: loansInMonth.map(loan => ({
            id: loan.id,
            borrower: {
              fullName: loan.borrower?.personalData?.fullName || 'Sin nombre',
              clientCode: loan.borrower?.personalData?.clientCode || 'Sin código'
            },
            lead: {
              fullName: loan.lead?.personalData?.fullName || 'Sin nombre',
              locality: loan.lead?.personalData?.addresses?.[0]?.location?.name || 'Sin localidad',
              route: loan.lead?.routes?.name || 'Sin ruta'
            },
            amountGived: Number(loan.amountGived || 0),
            pendingAmountStored: Number(loan.pendingAmountStored || 0),
            badDebtDate: loan.badDebtDate ? loan.badDebtDate.toISOString() : null,
            signDate: loan.signDate.toISOString(),
            weeksSinceLoan: Math.floor((evaluationDate.getTime() - new Date(loan.signDate).getTime()) / (7 * 24 * 60 * 60 * 1000)),
            weeksWithoutPayment: (() => {
              const lastPaymentDate = loan.payments && loan.payments.length > 0
                ? new Date(Math.max(...loan.payments.map(p => new Date(p.receivedAt || p.createdAt || new Date()).getTime())))
                : new Date(loan.signDate);
              return Math.floor((evaluationDate.getTime() - lastPaymentDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
            })(),
            badDebtCandidate: (() => {
              const amountGivedNum = Number(loan.amountGived || 0);
              const profitAmountNum = Number(loan.profitAmount || 0);
              const totalToPay = amountGivedNum + profitAmountNum;
              const deudaPendiente = Number(loan.pendingAmountStored || 0);
              const gananciaPorCobrar = deudaPendiente * (profitAmountNum / totalToPay);
              return Math.max(0, deudaPendiente - gananciaPorCobrar);
            })(),
            payments: (loan.payments || []).map(payment => ({
              receivedAt: payment.receivedAt ? payment.receivedAt.toISOString() : null,
              amount: Number(payment.amount || 0),
              createdAt: payment.createdAt ? payment.createdAt.toISOString() : null
            }))
          }))
        });
      }

      // Calcular totales del año
      const yearTotals = monthlySummary.reduce((acc, month) => {
        acc.totalLoans += month.summary.totalLoans;
        acc.totalPendingAmount += month.summary.totalPendingAmount;
        acc.totalBadDebtCandidate += month.summary.totalBadDebtCandidate;
        return acc;
      }, { totalLoans: 0, totalPendingAmount: 0, totalBadDebtCandidate: 0 });

      // Obtener información de rutas incluidas
      const routesInfo = routeId
        ? [{ id: routeId, name: 'Ruta seleccionada' }] // Si hay ruta específica, no necesitamos consultar
        : await context.prisma.route.findMany({
          select: { id: true, name: true }
        });

      const result = {
        year,
        monthlySummary,
        yearTotals,
        routesInfo
      };

      console.log('✅ Resumen mensual generado:', yearTotals);

      return JSON.stringify(result);
    } catch (error) {
      console.error('Error al generar resumen mensual:', error);
      return JSON.stringify({ error: 'Error al generar resumen mensual' });
    }
  }
});
