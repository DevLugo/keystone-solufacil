import { graphql } from '@keystone-6/core';

export const carteraMuertaCustomQuery = graphql.extend((base) => {
  return {
    query: {
      loansForCarteraMuerta: graphql.field({
        type: graphql.list(graphql.JSON),
        args: {
          routeId: graphql.arg({ type: graphql.ID }),
          weeksWithoutPayment: graphql.arg({ type: graphql.Int, defaultValue: 2 }),
          weeksSinceCreation: graphql.arg({ type: graphql.Int, defaultValue: 4 }),
          analysisDate: graphql.arg({ type: graphql.String }),
        },
        resolve: async (root, args, context) => {
          const { routeId, weeksWithoutPayment, weeksSinceCreation, analysisDate } = args as any;
          
          try {
            // Fecha de análisis (por defecto hoy)
            const now = analysisDate ? new Date(analysisDate) : new Date();

            // Construir filtros base para Prisma
            const baseFilters: any = {
              badDebtDate: null,
              finishedDate: null,
              pendingAmountStored: { gt: 0 },
              excludedByCleanup: null,
            };

            // Agregar filtro por ruta si se proporciona
            if (routeId) {
              baseFilters.lead = {
                routes: {
                  is: { id: routeId }
                }
              };
            }

            // Obtener todos los préstamos que cumplen los criterios base usando Prisma
            const allLoans = await context.prisma.loan.findMany({
              where: baseFilters,
              include: {
                borrower: {
                  include: {
                    personalData: {
                      include: {
                        phones: true,
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
                    },
                    routes: true
                  }
                },
                loantype: true,
                payments: {
                  orderBy: { receivedAt: 'desc' }
                },
                previousLoan: true
              }
            });

            // Obtener IDs de préstamos que han sido usados como renovación
            const renewedLoans = await context.prisma.loan.findMany({
              where: {
                previousLoan: { isNot: null }
              },
              select: {
                previousLoan: {
                  select: { id: true }
                }
              }
            });

            const renewedLoanIds = new Set(
              renewedLoans.map((loan: any) => loan.previousLoan?.id).filter(Boolean)
            );

            // Filtrar préstamos que NO han sido usados como renovación
            const filteredLoans = allLoans.filter((loan: any) => {
              return !renewedLoanIds.has(loan.id);
            });

            // Aplicar filtros de tiempo usando la fecha de análisis
            const weeksWithoutPaymentDays = weeksWithoutPayment * 7;
            const weeksSinceCreationDays = weeksSinceCreation * 7;

            const finalLoans = filteredLoans.filter((loan: any) => {
              const signDate = new Date(loan.signDate);
              const daysSinceSign = Math.floor((now.getTime() - signDate.getTime()) / (1000 * 60 * 60 * 24));
              
              // Debe ser >= al umbral de semanas desde creación
              if (daysSinceSign < weeksSinceCreationDays) {
                return false;
              }

              if (!loan.payments || loan.payments.length === 0) {
                // Si no tiene pagos, verificar contra fecha de firma
                return daysSinceSign >= weeksWithoutPaymentDays;
              }

              // Si tiene pagos, verificar el último pago
              const lastPayment = loan.payments[0]; // Ordenados desc
              const lastPaymentDate = new Date(lastPayment.receivedAt);
              const daysSinceLastPayment = Math.floor((now.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
              
              return daysSinceLastPayment >= weeksWithoutPaymentDays;
            });

            // Convertir a formato JSON serializable, corrigiendo fullName
            return finalLoans.map((loan: any) => ({
              id: loan.id,
              oldId: loan.oldId,
              requestedAmount: loan.requestedAmount?.toString(),
              amountGived: loan.amountGived?.toString(),
              signDate: loan.signDate?.toISOString(),
              badDebtDate: loan.badDebtDate?.toISOString() || null,
              pendingAmountStored: loan.pendingAmountStored?.toString(),
              borrower: {
                id: loan.borrower.id,
                fullName: loan.borrower.personalData?.fullName || loan.borrower.fullName || 'Sin nombre',
                personalData: {
                  fullName: loan.borrower.personalData?.fullName || null,
                  phones: loan.borrower.personalData?.phones?.map((phone: any) => ({
                    number: phone.number
                  })) || [],
                  addresses: loan.borrower.personalData?.addresses?.map((addr: any) => ({
                    street: addr.street,
                    exteriorNumber: addr.exteriorNumber,
                    interiorNumber: addr.interiorNumber,
                    location: {
                      name: addr.location?.name,
                      municipality: {
                        state: {
                          name: addr.location?.municipality?.state?.name
                        }
                      }
                    }
                  })) || []
                }
              },
              lead: {
                id: loan.lead.id,
                personalData: {
                  fullName: loan.lead.personalData?.fullName || null,
                  addresses: loan.lead.personalData?.addresses?.map((addr: any) => ({
                    location: {
                      name: addr.location?.name,
                      municipality: {
                        state: {
                          name: addr.location?.municipality?.state?.name
                        }
                      }
                    }
                  })) || []
                },
                routes: {
                  id: (loan.lead as any).routes?.id,
                  name: (loan.lead as any).routes?.name
                }
              },
              loantype: {
                id: loan.loantype?.id,
                name: loan.loantype?.name,
                weekDuration: loan.loantype?.weekDuration,
                rate: loan.loantype?.rate?.toString()
              },
              payments: loan.payments?.map((payment: any) => ({
                id: payment.id,
                amount: payment.amount?.toString(),
                receivedAt: payment.receivedAt?.toISOString(),
                createdAt: payment.createdAt?.toISOString()
              })) || [],
              previousLoan: loan.previousLoan ? { id: loan.previousLoan.id } : null
            }));

          } catch (error) {
            console.error('Error en loansForCarteraMuerta:', error);
            throw new Error('Error al obtener préstamos para cartera muerta');
          }
        },
      }),
    },
  };
});
