const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugVicenteGuerreroNew() {
  try {
    console.log('🔍 DEBUG NUEVO: Vicente Guerrero - Semana 1 de Agosto 2025 (CÁLCULO EN TIEMPO REAL)');
    console.log('===============================================================================');

    // Buscar la ruta que contiene Vicente Guerrero
    const routes = await prisma.route.findMany({
      include: {
        employees: {
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

    let targetRoute = null;
    let vicenteGuerreroLocation = null;

    for (const route of routes) {
      for (const employee of route.employees) {
        const locationName = employee.personalData?.addresses?.[0]?.location?.name;
        if (locationName && locationName.toLowerCase().includes('vicente guerrero')) {
          targetRoute = route;
          vicenteGuerreroLocation = locationName;
          break;
        }
      }
      if (targetRoute) break;
    }

    if (!targetRoute) {
      console.log('❌ No se encontró ninguna ruta con Vicente Guerrero');
      return;
    }

    console.log(`📍 Ruta encontrada: ${targetRoute.name} (ID: ${targetRoute.id})`);
    console.log(`📍 Localidad: ${vicenteGuerreroLocation}`);

    // Fechas de referencia para la semana 1 de agosto 2025
    const week1Start = new Date(2025, 7, 1); // 1 de agosto 2025
    const week1End = new Date(2025, 7, 7, 23, 59, 59, 999); // 7 de agosto 2025
    const startReferenceDate = new Date(week1Start.getTime() - 1); // Domingo 31 de julio

    console.log(`📅 Semana 1: ${startReferenceDate.toISOString()} → ${week1End.toISOString()}`);

    // Obtener todos los préstamos de la ruta
    const allLoans = await prisma.loan.findMany({
      where: {
        lead: {
          routes: {
            id: targetRoute.id
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

    console.log(`📊 Total de préstamos en la ruta: ${allLoans.length}`);

    // Filtrar préstamos de Vicente Guerrero
    const vicenteGuerreroLoans = allLoans.filter(loan => {
      const locality = loan.borrower?.personalData?.addresses?.[0]?.location?.name ||
                      loan.lead?.personalData?.addresses?.[0]?.location?.name;
      return locality === vicenteGuerreroLocation;
    });

    console.log(`📍 Préstamos en Vicente Guerrero: ${vicenteGuerreroLoans.length}`);

    // ✅ NUEVA LÓGICA: Función que simula exactamente la implementada en getActiveLoansReport
    const isLoanActiveOnDateNew = (loan, date) => {
      const signDate = new Date(loan.signDate);
      if (signDate > date) return false;
      
      // NO excluidos por limpieza
      if (loan.excludedByCleanup !== null) return false;

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
          if (paymentDate <= date) {
            totalPaid += parseFloat((payment.amount || 0).toString());
          }
        }
        
        // Calcular el monto pendiente real
        realPendingAmount = Math.max(0, totalDebt - totalPaid);
        
        // Debug para préstamos problemáticos
        if (loan.id === 'cmf2t4eud35t4psoekkjy44r3' || loan.id === 'cmf2t4euk35u1psoe1pdfef3a') {
          console.log(`🔍 DEBUG LOAN ${loan.id}: totalDebt=${totalDebt}, totalPaid=${totalPaid}, realPendingAmount=${realPendingAmount}, finishedDate=${loan.finishedDate}`);
        }
        
      } catch (error) {
        console.error(`Error calculando monto pendiente para préstamo ${loan.id}:`, error);
        // Fallback al campo stored si hay error en el cálculo
        realPendingAmount = parseFloat(loan.pendingAmountStored || '0');
      }
      
      // ✅ LÓGICA CORREGIDA: Un préstamo está activo si:
      // 1. No está excluido por cleanup
      // 2. Tiene monto pendiente real > 0
      // 3. NO está finalizado O si está finalizado pero aún tiene deuda pendiente
      
      // Si tiene monto pendiente real > 0, está activo (independientemente de finishedDate)
      if (realPendingAmount > 0) {
        return true;
      }
      
      // Si no tiene monto pendiente, verificar si está finalizado
      if (loan.finishedDate !== null) {
        return false; // Finalizado y sin deuda pendiente
      }
      
      return false; // Sin deuda pendiente y no finalizado
    };

    // Verificar clientes activos al inicio de la semana 1 con la NUEVA lógica
    const activeAtStartNew = vicenteGuerreroLoans.filter(loan => 
      isLoanActiveOnDateNew(loan, startReferenceDate)
    );

    console.log(`✅ Clientes activos al inicio de la semana 1 (NUEVA LÓGICA): ${activeAtStartNew.length}`);

    // Comparar con la lógica antigua
    const isLoanActiveOnDateOld = (loan, date) => {
      const signDate = new Date(loan.signDate);
      if (signDate > date) return false;
      
      if (loan.finishedDate !== null) return false;
      
      const pendingAmount = parseFloat(loan.pendingAmountStored || '0');
      if (pendingAmount <= 0) return false;
      
      if (loan.excludedByCleanup !== null) return false;

      return true;
    };

    const activeAtStartOld = vicenteGuerreroLoans.filter(loan => 
      isLoanActiveOnDateOld(loan, startReferenceDate)
    );

    console.log(`❌ Clientes activos al inicio de la semana 1 (LÓGICA ANTIGUA): ${activeAtStartOld.length}`);

    // Debug detallado de cada préstamo activo con la nueva lógica
    console.log('\n🔍 ANÁLISIS DETALLADO DE PRÉSTAMOS ACTIVOS (NUEVA LÓGICA):');
    console.log('=============================================================');

    for (let i = 0; i < activeAtStartNew.length; i++) {
      const loan = activeAtStartNew[i];
      
      console.log(`\n${i + 1}. Préstamo ID: ${loan.id}`);
      console.log(`   Cliente: ${loan.borrower?.personalData?.fullName || loan.lead?.personalData?.fullName || 'N/A'}`);
      console.log(`   Fecha firma: ${loan.signDate}`);
      console.log(`   Fecha fin: ${loan.finishedDate || 'NO FINALIZADO'}`);
      console.log(`   Status: ${loan.status}`);
      console.log(`   Monto otorgado: ${loan.amountGived}`);
      console.log(`   Monto pendiente stored: ${loan.pendingAmountStored}`);
      
      // Calcular monto pendiente real
      try {
        const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
        const requested = parseFloat(loan.requestedAmount?.toString() || '0');
        const totalDebt = requested * (1 + rate);
        
        let totalPaid = 0;
        for (const payment of loan.payments || []) {
          const paymentDate = new Date(payment.receivedAt || payment.createdAt);
          if (paymentDate <= startReferenceDate) {
            totalPaid += parseFloat((payment.amount || 0).toString());
          }
        }
        
        const realPendingAmount = Math.max(0, totalDebt - totalPaid);
        console.log(`   Monto pendiente REAL: ${realPendingAmount} (totalDebt: ${totalDebt}, totalPaid: ${totalPaid})`);
        
      } catch (error) {
        console.log(`   Error calculando monto pendiente real: ${error.message}`);
      }
      
      console.log(`   Excluido por cleanup: ${loan.excludedByCleanup ? 'SÍ' : 'NO'}`);
      if (loan.excludedByCleanup) {
        console.log(`   Fecha cleanup: ${loan.excludedByCleanup.cleanupDate}`);
      }
      console.log(`   Préstamo previo: ${loan.previousLoanId || 'NO'}`);
    }

    // Mostrar préstamos que están activos con la nueva lógica pero no con la antigua
    const newActiveButOldInactive = activeAtStartNew.filter(loan => 
      !isLoanActiveOnDateOld(loan, startReferenceDate)
    );

    if (newActiveButOldInactive.length > 0) {
      console.log('\n🆕 PRÉSTAMOS QUE AHORA ESTÁN ACTIVOS (antes no):');
      console.log('==================================================');
      newActiveButOldInactive.forEach(loan => {
        console.log(`   - ID: ${loan.id}, Cliente: ${loan.borrower?.personalData?.fullName || 'N/A'}`);
        console.log(`     Fecha fin: ${loan.finishedDate || 'NO FINALIZADO'}`);
        console.log(`     pendingAmountStored: ${loan.pendingAmountStored}`);
      });
    }

    console.log('\n📋 RESUMEN COMPARATIVO:');
    console.log('=======================');
    console.log(`Total préstamos en Vicente Guerrero: ${vicenteGuerreroLoans.length}`);
    console.log(`Clientes activos (LÓGICA ANTIGUA): ${activeAtStartOld.length}`);
    console.log(`Clientes activos (NUEVA LÓGICA): ${activeAtStartNew.length}`);
    console.log(`Diferencia: +${activeAtStartNew.length - activeAtStartOld.length} clientes`);

    if (activeAtStartNew.length === 22) {
      console.log('\n✅ PROBLEMA RESUELTO: Ahora se detectan los 22 clientes activos esperados');
    } else if (activeAtStartNew.length > activeAtStartOld.length) {
      console.log(`\n🔄 MEJORA: Se detectaron ${activeAtStartNew.length - activeAtStartOld.length} clientes adicionales`);
      console.log(`   Se esperaban 22, ahora hay ${activeAtStartNew.length}`);
    } else {
      console.log(`\n❌ PROBLEMA PERSISTE: Aún solo hay ${activeAtStartNew.length} clientes activos`);
    }

  } catch (error) {
    console.error('❌ Error en debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugVicenteGuerreroNew();
