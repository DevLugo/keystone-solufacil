import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';

// Función para determinar si una fecha pertenece a una semana completa activa
function isDateInCompleteWeek(date: Date, year: number, month: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month - 1;
  const cutoffDate = isCurrentMonth ? today : lastDay;
  
  const dateToCheck = new Date(date);
  dateToCheck.setHours(0, 0, 0, 0);
  
  // Si la fecha está después del cutoff, no está en una semana completa
  if (dateToCheck > cutoffDate) {
    return false;
  }
  
  // Encontrar el lunes de la semana a la que pertenece esta fecha
  const dayOfWeek = dateToCheck.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si es domingo, retroceder 6 días; si no, calcular días hasta el lunes
  const weekMonday = new Date(dateToCheck);
  weekMonday.setDate(dateToCheck.getDate() + daysToMonday);
  
  // Calcular el domingo de esta semana
  const weekSunday = new Date(weekMonday);
  weekSunday.setDate(weekMonday.getDate() + 6);
  weekSunday.setHours(23, 59, 59, 999);
  
  // Solo contar si el domingo ya pasó (semana completa terminada)
  if (weekSunday > cutoffDate) {
    return false;
  }
  
  // Verificar que la semana tenga al menos 5 días laborables dentro del mes
  const weekStart = weekMonday > firstDay ? weekMonday : firstDay;
  const weekEnd = weekSunday < lastDay ? weekSunday : lastDay;
  
  let workingDays = 0;
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) { // Lunes (1) a Viernes (5)
      workingDays++;
    }
  }
  
  return workingDays >= 5;
}

// Función para calcular semanas completas activas y días laborables en semanas completas
// Retorna: { activeWeeks: number, workingDaysInCompleteWeeks: number, totalWorkingDays: number, adjustmentFactor: number }
function getActiveWeeksInfo(year: number, month: number): { 
  activeWeeks: number; 
  workingDaysInCompleteWeeks: number; 
  totalWorkingDays: number;
  adjustmentFactor: number;
} {
  // month es 1-12 (enero = 1)
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // Último día del mes
  
  // Obtener la fecha actual
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalizar a medianoche
  
  // Determinar hasta qué fecha podemos contar semanas completas
  // Si es el mes actual, solo contar semanas cuyo domingo ya pasó
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month - 1;
  const cutoffDate = isCurrentMonth ? today : lastDay;
  
  let activeWeeks = 0;
  let workingDaysInCompleteWeeks = 0;
  
  // Contar todos los días laborables del mes (para el factor de ajuste)
  let totalWorkingDays = 0;
  for (let d = new Date(firstDay); d <= lastDay && d <= cutoffDate; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) { // Lunes (1) a Viernes (5)
      totalWorkingDays++;
    }
  }
  
  // Encontrar el primer lunes del mes
  let currentMonday = new Date(firstDay);
  const firstDayOfWeek = firstDay.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  
  // Si el primer día no es lunes, encontrar el primer lunes
  if (firstDayOfWeek !== 1) {
    const daysToAdd = firstDayOfWeek === 0 ? 1 : 8 - firstDayOfWeek; // Si es domingo, sumar 1; si no, calcular días hasta el próximo lunes
    currentMonday = new Date(year, month - 1, 1 + daysToAdd);
  }
  
  // Iterar semana por semana (lunes a domingo)
  while (currentMonday <= lastDay) {
    // Calcular el domingo de esta semana
    const weekSunday = new Date(currentMonday);
    weekSunday.setDate(weekSunday.getDate() + 6);
    weekSunday.setHours(23, 59, 59, 999); // Fin del domingo
    
    // Solo contar semanas cuyo domingo ya pasó (semana completa terminada)
    if (weekSunday > cutoffDate) {
      // Esta semana aún no está completa, detener aquí
      break;
    }
    
    // Determinar el rango de días de esta semana que están dentro del mes
    const weekStart = currentMonday > firstDay ? currentMonday : firstDay;
    const weekEnd = weekSunday < lastDay ? weekSunday : lastDay;
    
    // Contar días laborables (lunes-viernes) en esta semana dentro del mes
    let workingDays = 0;
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) { // Lunes (1) a Viernes (5)
        workingDays++;
      }
    }
    
    // Si tiene al menos 5 días laborables, es una semana completa activa
    if (workingDays >= 5) {
      activeWeeks++;
      workingDaysInCompleteWeeks += workingDays;
    }
    
    // Mover al siguiente lunes
    currentMonday.setDate(currentMonday.getDate() + 7);
  }
  
  // Calcular factor de ajuste
  const adjustmentFactor = totalWorkingDays > 0 
    ? workingDaysInCompleteWeeks / totalWorkingDays 
    : 1;
  
  return {
    activeWeeks,
    workingDaysInCompleteWeeks,
    totalWorkingDays,
    adjustmentFactor
  };
}

// Placeholder importable resolver. Mueve aquí la implementación completa.
export const getFinancialReport = graphql.field({
    type: graphql.nonNull(graphql.JSON),
    args: {
      routeIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.String))) }),
      year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    },
    resolve: async (root, { routeIds, year }, context: Context) => {
      try {
        // Configurar timeout para evitar bloqueos en producción
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Reporte financiero timeout - demasiados datos')), 30000); // 30 segundos
        });
        
        const reportPromise = (async () => {
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
  
        // 2. Obtener préstamos relevantes con consulta optimizada
        const loans = await context.prisma.loan.findMany({
          where: {
            lead: {
              routes: { id: { in: routeIds } }
            },
            signDate: { lt: yearEnd }, // Solo préstamos que empezaron antes del final del año
            OR: [
              { finishedDate: null }, // Préstamos activos
              { finishedDate: { gte: yearStart } } // Préstamos que terminaron durante o después del año
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
              where: {
                OR: [
                  { receivedAt: { gte: yearStart, lte: yearEnd } },
                  { createdAt: { gte: yearStart, lte: yearEnd } }
                ]
              },
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
            viaticos: 0,
            // Campos de semanas completas activas
            activeWeeks: 0,
            workingDaysInCompleteWeeks: 0,
            totalWorkingDays: 0,
            weeklyAverageAdjustmentFactor: 1,
            // Promedios semanales calculados
            weeklyAverageProfit: 0,
            weeklyAverageExpenses: 0,
            weeklyAverageIncome: 0
          };
        }
  
        // 4. Procesar transacciones agrupadas por mes (TODAS las transacciones para campos normales)
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
  
        // 4b. Procesar transacciones filtradas SOLO para promedios semanales
        // Crear estructura separada solo para promedios semanales
        const weeklyData: { [key: string]: { profit: number; expenses: number; income: number; badDebt: number } } = {};
        for (let month = 1; month <= 12; month++) {
          const monthKey = month.toString().padStart(2, '0');
          weeklyData[monthKey] = { profit: 0, expenses: 0, income: 0, badDebt: 0 };
        }
        
        for (const transaction of transactions) {
          const transactionDate = transaction.date ? new Date(transaction.date) : new Date();
          const month = transactionDate.getMonth() + 1;
          const monthKey = month.toString().padStart(2, '0');
          
          // Solo procesar transacciones que pertenecen a semanas completas
          if (!isDateInCompleteWeek(transactionDate, year, month)) {
            continue; // Saltar esta transacción para promedios semanales
          }
  
          const amount = Number(transaction.amount || 0);
          const weekData = weeklyData[monthKey];
          
          if (transaction.type === 'EXPENSE') {
            // Para gastos, sumar todos los gastos operativos
            if (transaction.expenseSource === 'GASOLINE') {
              weekData.expenses += amount;
            } else {
              switch (transaction.expenseSource) {
                case 'NOMINA_SALARY':
                case 'EXTERNAL_SALARY':
                case 'VIATIC':
                case 'TRAVEL_EXPENSES':
                  weekData.expenses += amount;
                  break;
                case 'LOAN_PAYMENT_COMISSION':
                case 'LOAN_GRANTED_COMISSION':
                case 'LEAD_COMISSION':
                  weekData.expenses += amount;
                  break;
                case 'LOAN_GRANTED':
                  // No contar préstamos otorgados en gastos semanales
                  break;
                default:
                  weekData.expenses += amount;
                  break;
              }
            }
          } else if (transaction.type === 'INCOME') {
            if (transaction.incomeSource === 'CASH_LOAN_PAYMENT' || 
                transaction.incomeSource === 'BANK_LOAN_PAYMENT') {
              const profit = Number(transaction.profitAmount || 0);
              weekData.income += profit;
            } else {
              weekData.income += amount;
            }
          }
        }
  
        // 5. Preprocesar datos de préstamos para optimizar cálculos mensuales
        const loanMetrics = loans.map(loan => {
          const signDate = new Date(loan.signDate);
          const finishedDate = loan.finishedDate ? new Date(loan.finishedDate) : null;
          const badDebtDate = loan.badDebtDate ? new Date(loan.badDebtDate) : null;
          const amountGived = Number(loan.amountGived || 0);
          const profitAmount = Number(loan.profitAmount || 0);
          const totalToPay = amountGived + profitAmount;
          
          // Precalcular pagos por fecha y crear índices para búsquedas rápidas
          const paymentsByDate = (loan.payments || []).map(payment => ({
            amount: Number(payment.amount || 0),
            date: new Date(payment.receivedAt || payment.createdAt || new Date())
          })).sort((a, b) => a.date.getTime() - b.date.getTime());
          
          // Crear mapa de pagos por mes para acceso O(1)
          const paymentsByMonth = new Map();
          paymentsByDate.forEach(payment => {
            const month = payment.date.getMonth() + 1;
            if (!paymentsByMonth.has(month)) {
              paymentsByMonth.set(month, []);
            }
            paymentsByMonth.get(month).push(payment);
          });
          
          return {
            signDate,
            finishedDate,
            badDebtDate,
            amountGived,
            profitAmount,
            totalToPay,
            previousLoanId: loan.previousLoanId,
            paymentsByDate,
            paymentsByMonth
          };
        });
        
        // 5b. Agregar badDebtAmount a weeklyData solo si la fecha está en semana completa
        for (const loan of loanMetrics) {
          if (loan.badDebtDate) {
            const badDebtMonth = loan.badDebtDate.getMonth() + 1;
            const monthKey = badDebtMonth.toString().padStart(2, '0');
            
            // Solo incluir si la fecha de badDebt está en una semana completa
            if (isDateInCompleteWeek(loan.badDebtDate, year, badDebtMonth)) {
              let totalPaid = 0;
              for (const payment of loan.paymentsByDate) {
                if (payment.date <= loan.badDebtDate) {
                  totalPaid += payment.amount;
                } else {
                  break;
                }
              }
              const badDebtAmount = loan.totalToPay - totalPaid;
              weeklyData[monthKey].badDebt += badDebtAmount;
            }
          }
        }

        // 6. Calcular cartera y métricas de préstamos por mes (altamente optimizado)
        let cumulativeCashBalance = 0;
        
        for (let month = 1; month <= 12; month++) {
          const monthKey = month.toString().padStart(2, '0');
          const monthStart = new Date(year, month - 1, 1);
          const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
          
          // Flujo de caja acumulado
          const monthCashFlow = monthlyData[monthKey].totalCash || 0;
          cumulativeCashBalance += monthCashFlow;
          monthlyData[monthKey].availableCash = Math.max(0, cumulativeCashBalance);

          // Contar préstamos por estado (optimizado con preprocesamiento)
          let activeLoans = 0;
          let overdueLoans = 0;
          let deadLoans = 0;
          let renewedLoans = 0;
          let badDebtAmount = 0;
          let carteraMuertaTotal = 0;

          for (const loan of loanMetrics) {
            // Solo procesar préstamos relevantes para este mes
            if (loan.signDate > monthEnd) continue;
            
            // Verificar si está activo al final del mes
            const isActive = !loan.finishedDate || loan.finishedDate > monthEnd;
            
            if (isActive) {
              activeLoans++;
              
              // Verificar si está vencido (sin pagos en el mes) - optimizado con mapa
              const hasPaymentInMonth = loan.paymentsByMonth.has(month);
              
              if (!hasPaymentInMonth && loan.badDebtDate && loan.badDebtDate <= monthEnd) {
                overdueLoans++;
              }
            }
            
            // Contar cartera muerta
            if (loan.badDebtDate) {
              // Préstamos marcados como bad debt en este mes específico
              if (loan.badDebtDate >= monthStart && loan.badDebtDate <= monthEnd) {
                let totalPaid = 0;
                for (const payment of loan.paymentsByDate) {
                  if (payment.date <= loan.badDebtDate) {
                    totalPaid += payment.amount;
                  } else {
                    break; // Los pagos están ordenados por fecha
                  }
                }
                
                const pendingDebt = Math.max(0, loan.totalToPay - totalPaid);
                badDebtAmount += pendingDebt;
              }
              
              // Acumulado de cartera muerta
              if (loan.badDebtDate <= monthEnd) {
                deadLoans++;
                
                let totalPaid = 0;
                let gananciaCobrada = 0;
                for (const payment of loan.paymentsByDate) {
                  if (payment.date <= loan.badDebtDate) {
                    totalPaid += payment.amount;
                    // Aproximación de ganancia cobrada
                    gananciaCobrada += payment.amount * (loan.profitAmount / loan.totalToPay);
                  } else {
                    break; // Los pagos están ordenados por fecha
                  }
                }
                
                const deudaPendiente = loan.totalToPay - totalPaid;
                const gananciaPendiente = loan.profitAmount - gananciaCobrada;
                const carteraMuerta = deudaPendiente - gananciaPendiente;
                carteraMuertaTotal += Math.max(0, carteraMuerta);
              }
            }
            
            // Contar renovados en el mes
            if (loan.previousLoanId && loan.signDate >= monthStart && loan.signDate <= monthEnd) {
              renewedLoans++;
            }
          }

          monthlyData[monthKey].carteraActiva = activeLoans;
          monthlyData[monthKey].carteraVencida = overdueLoans;
          monthlyData[monthKey].carteraMuerta = carteraMuertaTotal;
          monthlyData[monthKey].renovados = renewedLoans;
          monthlyData[monthKey].badDebtAmount = badDebtAmount;
  
          // Calcular información de semanas completas activas
          const weeksInfo = getActiveWeeksInfo(year, month);
          monthlyData[monthKey].activeWeeks = weeksInfo.activeWeeks;
          monthlyData[monthKey].workingDaysInCompleteWeeks = weeksInfo.workingDaysInCompleteWeeks;
          monthlyData[monthKey].totalWorkingDays = weeksInfo.totalWorkingDays;
          monthlyData[monthKey].weeklyAverageAdjustmentFactor = weeksInfo.adjustmentFactor;
  
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
          
          // Calcular promedios semanales usando datos filtrados (solo semanas completas)
          const activeWeeks = weeksInfo.activeWeeks;
          const weekData = weeklyData[monthKey];
          
          // Gastos totales para semanas completas (incluyendo badDebt si aplica)
          const weeklyExpensesTotal = weekData.expenses + weekData.badDebt;
          
          // Calcular ganancia operativa solo con datos de semanas completas
          const weeklyProfit = weekData.income - weeklyExpensesTotal;
          data.weeklyAverageProfit = activeWeeks > 0 ? weeklyProfit / activeWeeks : 0;
          
          // Gastos semanales promedio (solo semanas completas)
          data.weeklyAverageExpenses = activeWeeks > 0 ? weeklyExpensesTotal / activeWeeks : 0;
          
          // Cobranza semanal promedio (solo semanas completas)
          data.weeklyAverageIncome = activeWeeks > 0 ? weekData.income / activeWeeks : 0;
        }
  
        // Calcular totales anuales de promedios semanales usando datos filtrados
        let totalActiveWeeks = 0;
        let totalWeeklyProfit = 0;
        let totalWeeklyExpenses = 0;
        let totalWeeklyIncome = 0;
        
        for (let month = 1; month <= 12; month++) {
          const monthKey = month.toString().padStart(2, '0');
          const weekData = weeklyData[monthKey];
          const activeWeeks = monthlyData[monthKey].activeWeeks;
          
          // Usar los datos filtrados de semanas completas
          const weeklyExpensesTotal = weekData.expenses + weekData.badDebt;
          const weeklyProfit = weekData.income - weeklyExpensesTotal;
          
          totalWeeklyProfit += weeklyProfit;
          totalWeeklyExpenses += weeklyExpensesTotal;
          totalWeeklyIncome += weekData.income;
          totalActiveWeeks += activeWeeks;
        }
        
        const annualWeeklyAverageProfit = totalActiveWeeks > 0 ? totalWeeklyProfit / totalActiveWeeks : 0;
        const annualWeeklyAverageExpenses = totalActiveWeeks > 0 ? totalWeeklyExpenses / totalActiveWeeks : 0;
        const annualWeeklyAverageIncome = totalActiveWeeks > 0 ? totalWeeklyIncome / totalActiveWeeks : 0;
  
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
            data: monthlyData,
            // Totales anuales de promedios semanales
            annualWeeklyAverageProfit,
            annualWeeklyAverageExpenses,
            annualWeeklyAverageIncome,
            totalActiveWeeks
          } as any;
        })();
        
        return Promise.race([reportPromise, timeoutPromise]);
      } catch (error) {
        console.error('Error in getFinancialReport:', error);
        throw new Error(`Error generating financial report: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
});
