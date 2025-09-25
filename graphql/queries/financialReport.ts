import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';

type MonthlyData = {
  totalExpenses: number;
  generalExpenses: number;
  nomina: number;
  comissions: number;
  incomes: number;
  totalCash: number;
  loanDisbursements: number;
  carteraActiva: number;
  carteraVencida: number;
  renovados: number;
  badDebtAmount: number;
  totalIncomingCash: number;
  capitalReturn: number;
  profitReturn: number;
  operationalCashUsed: number;
  totalInvestment: number;
  tokaGasolina: number;
  cashGasolina: number;
  totalGasolina: number;
  operationalExpenses: number;
  availableCash: number;
  travelExpenses: number;
  paymentsCount: number;
  gainPerPayment: number;
  balance: number;
  operationalProfit: number;
  profitPercentage: number;
  balanceWithReinvest: number;
  carteraMuerta: number;
  uiExpensesTotal: number;
  uiGainsTotal: number;
  // Desglose de nómina
  nominaInterna: number;
  salarioExterno: number;
  viaticos: number;
  // ✅ NUEVAS MÉTRICAS SEMANALES
  operationalWeeks: number;
  weeklyIncome: number;
  weeklyExpenses: number;
  weeklyProfit: number;
  weeklyPayments: number;
};

function createEmptyMonthlyData(): MonthlyData {
  return {
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
    nominaInterna: 0,
    salarioExterno: 0,
    viaticos: 0,
    // ✅ NUEVAS MÉTRICAS SEMANALES
    operationalWeeks: 0,
    weeklyIncome: 0,
    weeklyExpenses: 0,
    weeklyProfit: 0,
    weeklyPayments: 0,
  };
}

function normalizeRouteIdsKey(routeIds: string[]): string {
  return [...routeIds].sort().join(',');
}

// ✅ FUNCIÓN PARA CALCULAR SEMANAS OPERATIVAS DEL MES
function getActiveWeeksCount(year: number, month: number): number {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  let currentDate = new Date(firstDayOfMonth);
  
  // Retroceder hasta encontrar el primer lunes antes del mes
  while (currentDate.getDay() !== 1) { // 1 = lunes
    currentDate.setDate(currentDate.getDate() - 1);
  }

  let activeWeeksCount = 0;

  // Generar semanas hasta cubrir todo el mes
  while (currentDate <= lastDayOfMonth) {
    const weekStart = new Date(currentDate);
    
    // Contar días de trabajo (lunes-sábado) que pertenecen al mes
    let workDaysInMonth = 0;
    let tempDate = new Date(weekStart);

    for (let i = 0; i < 6; i++) { // 6 días de trabajo (lunes-sábado)
      if (tempDate.getMonth() === month - 1) {
        workDaysInMonth++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    // La semana pertenece al mes si tiene mayoría de días activos
    // Si hay empate (3-3), la semana va al mes que tiene el lunes
    if (workDaysInMonth > 3 || (workDaysInMonth === 3 && weekStart.getMonth() === month - 1)) {
      activeWeeksCount++;
    }

    currentDate.setDate(currentDate.getDate() + 7);
  }

  return activeWeeksCount;
}

async function getGasAccounts(context: Context) {
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
  const tokaAccountId = gasolineAccounts.find((acc: any) => acc.type === 'PREPAID_GAS')?.id as string | undefined;
  const cashAccountIds = gasolineAccounts
    .filter((acc: any) => acc.type === 'OFFICE_CASH_FUND' || acc.type === 'EMPLOYEE_CASH_FUND')
    .map((acc: any) => acc.id as string);
  return { tokaAccountId, cashAccountIds };
}

async function computeMonth(
  context: Context,
  routeIds: string[],
  year: number,
  month: number,
  tokaAccountId?: string,
  cashAccountIds: string[] = []
): Promise<MonthlyData> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // console.log(`📅 computeMonth: Mes ${month}/${year}, fechas: ${monthStart.toISOString()} - ${monthEnd.toISOString()}`);
  
  const transactions = await context.prisma.transaction.findMany({
    where: {
      route: { id: { in: routeIds } },
      date: { gte: monthStart, lte: monthEnd }
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

  // console.log(`💰 computeMonth: Encontradas ${transactions.length} transacciones para mes ${month}`);

  const monthData: MonthlyData = createEmptyMonthlyData();

  for (const transaction of transactions) {
    const amount = Number(transaction.amount || 0);
    if (transaction.type === 'EXPENSE') {
      if (transaction.expenseSource === 'GASOLINE') {
        if (tokaAccountId && transaction.sourceAccountId === tokaAccountId) {
          monthData.tokaGasolina += amount;
        } else if (transaction.sourceAccountId && cashAccountIds.includes(transaction.sourceAccountId)) {
          monthData.cashGasolina += amount;
        }
        monthData.totalGasolina += amount;
        monthData.generalExpenses += amount;
      } else {
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
      if (transaction.incomeSource === 'CASH_LOAN_PAYMENT' || transaction.incomeSource === 'BANK_LOAN_PAYMENT') {
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

    // ✅ CALCULAR DEUDA MALA (badDebtAmount)
    // Buscar préstamos marcados como cartera muerta (badDebtDate) en este mes
    const badDebtLoans = await context.prisma.loan.findMany({
      where: {
        snapshotRouteId: { in: routeIds },
        badDebtDate: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      include: {
        loantype: {
          select: {
            rate: true
          }
        },
        payments: {
          include: {
            transactions: true
          }
        }
      }
    });

  // 🔍 DEBUG: Solo para febrero 2025
  if (year === 2025 && month === 2) {
    console.log(`🔍 DEBUG FEBRERO 2025 - Filtros aplicados:`);
    console.log(`  - routeIds: ${routeIds}`);
    console.log(`  - monthStart: ${monthStart.toISOString()}`);
    console.log(`  - monthEnd: ${monthEnd.toISOString()}`);
    console.log(`  - Total badDebtLoans encontrados: ${badDebtLoans.length}`);
    console.log(`  - IDs de préstamos:`, badDebtLoans.map(l => l.id));
    console.log(`---`);
  }

  for (const loan of badDebtLoans) {
    const requestedAmount = Number(loan.requestedAmount || 0);
    const rate = Number(loan.loantype?.rate || 0);
    
    // Calcular total pagado
    let totalPaid = 0;
    for (const payment of loan.payments || []) {
      totalPaid += Number(payment.amount || 0);
    }
    
    // ✅ OBTENER GANANCIA YA COBRADA DE TRANSACTIONS
    // Buscar todas las transacciones asociadas a los loanPayments de este préstamo
    const loanPaymentsForThisLoan = await context.prisma.loanPayment.findMany({
      where: {
        loanId: loan.id
      }
    });
    
    // Obtener todas las transacciones de estos loanPayments
    const allTransactions = await context.prisma.transaction.findMany({
      where: {
        loanPaymentId: {
          in: loanPaymentsForThisLoan.map(lp => lp.id)
        }
      }
    });
    
    // Sumar la ganancia de todas las transacciones
    let gananciaYaCobrada = 0;
    for (const transaction of allTransactions) {
      gananciaYaCobrada += Number(transaction.profitAmount || 0);
    }
    
    // ✅ CÁLCULO CORRECTO: Ganancia total - Ganancia ya cobrada
    const gananciaTotalXCobrar = requestedAmount * rate; // Ganancia total del préstamo
    const gananciaPendienteXCobrar = Math.max(0, gananciaTotalXCobrar - gananciaYaCobrada);
    
    // Deuda total pendiente = Total a pagar - Total pagado
    const totalAPagar = requestedAmount + gananciaTotalXCobrar; // Capital + Ganancia
    const deudaTotalPendiente = Math.max(0, totalAPagar - totalPaid);
    
    // BadDebtAmount = Deuda total pendiente - Ganancia pendiente
    const badDebtAmount = Math.max(0, deudaTotalPendiente - gananciaPendienteXCobrar);
    
    // 🔍 DEBUG: Solo para febrero 2025
    if (year === 2025 && month === 2) {
      console.log(`🔍 DEBUG FEBRERO 2025 - Cliente ${loan.id}:`);
      console.log(`  - snapshotRouteId: ${loan.snapshotRouteId}`);
      console.log(`  - badDebtDate: ${loan.badDebtDate}`);
      console.log(`  - requestedAmount: ${requestedAmount}`);
      console.log(`  - rate: ${rate} (${(rate * 100).toFixed(1)}%)`);
      console.log(`  - totalPaid: ${totalPaid}`);
      console.log(`  - gananciaTotalXCobrar: ${gananciaTotalXCobrar}`);
      console.log(`  - gananciaYaCobrada (de transactions): ${gananciaYaCobrada}`);
      console.log(`  - gananciaPendienteXCobrar: ${gananciaPendienteXCobrar}`);
      console.log(`  - deudaTotalPendiente: ${deudaTotalPendiente}`);
      console.log(`  - badDebtAmount: ${badDebtAmount}`);
      console.log(`  - loanPayments count: ${loanPaymentsForThisLoan.length}`);
      console.log(`  - loanPayments completos:`, loanPaymentsForThisLoan.map(lp => ({
        id: lp.id,
        loanId: lp.loanId,
        amount: lp.amount,
        receivedAt: lp.receivedAt
      })));
      console.log(`  - DEUDA PENDIENTE CALCULADA:`);
      console.log(`    - requestedAmount: ${requestedAmount}`);
      console.log(`    - gananciaTotalXCobrar: ${gananciaTotalXCobrar}`);
      console.log(`    - gananciaYaCobrada (profitTotal): ${gananciaYaCobrada}`);
      console.log(`    - gananciaPendienteXCobrar: ${gananciaPendienteXCobrar}`);
      console.log(`    - totalAPagar (requestedAmount + gananciaTotalXCobrar): ${totalAPagar}`);
      console.log(`    - totalPaid: ${totalPaid}`);
      console.log(`    - deudaTotalPendiente (totalAPagar - totalPaid): ${deudaTotalPendiente}`);
      console.log(`  - transactions count: ${allTransactions.length}`);
      console.log(`  - transactions completas:`, allTransactions);
      console.log(`---`);
    }
    
    monthData.badDebtAmount += badDebtAmount;
  }

  // ✅ CALCULAR SEMANAS OPERATIVAS DEL MES
  monthData.operationalWeeks = getActiveWeeksCount(year, month);

  // Ajustes finales
  const operationalExpenses = monthData.generalExpenses + monthData.nomina + monthData.comissions;
  monthData.totalExpenses = operationalExpenses;
  monthData.balance = monthData.incomes - operationalExpenses;
  monthData.balanceWithReinvest = monthData.balance - monthData.loanDisbursements;
  const uiExpensesTotal = operationalExpenses + monthData.badDebtAmount + monthData.travelExpenses;
  const uiGainsTotal = monthData.incomes;
  monthData.uiExpensesTotal = uiExpensesTotal;
  monthData.uiGainsTotal = uiGainsTotal;
  monthData.operationalProfit = uiGainsTotal - uiExpensesTotal;
  monthData.profitPercentage = uiGainsTotal > 0 ? ((monthData.operationalProfit / uiGainsTotal) * 100) : 0;
  monthData.gainPerPayment = monthData.paymentsCount > 0 ? (monthData.operationalProfit / monthData.paymentsCount) : 0;

  // ✅ CALCULAR MÉTRICAS SEMANALES
  if (monthData.operationalWeeks > 0) {
    monthData.weeklyIncome = monthData.incomes / monthData.operationalWeeks;
    monthData.weeklyExpenses = uiExpensesTotal / monthData.operationalWeeks;
    monthData.weeklyProfit = monthData.operationalProfit / monthData.operationalWeeks;
    monthData.weeklyPayments = monthData.paymentsCount / monthData.operationalWeeks;
  }

  return monthData;
}

// ✅ FUNCIÓN PARA SUMAR DATOS MENSUALES
function sumMonthlyData(dataArray: MonthlyData[]): MonthlyData {
  const result = createEmptyMonthlyData();
  
  for (const data of dataArray) {
    result.totalExpenses += data.totalExpenses;
    result.generalExpenses += data.generalExpenses;
    result.nomina += data.nomina;
    result.comissions += data.comissions;
    result.incomes += data.incomes;
    result.totalCash += data.totalCash;
    result.loanDisbursements += data.loanDisbursements;
    result.carteraActiva += data.carteraActiva;
    result.carteraVencida += data.carteraVencida;
    result.renovados += data.renovados;
    result.badDebtAmount += data.badDebtAmount;
    result.totalIncomingCash += data.totalIncomingCash;
    result.capitalReturn += data.capitalReturn;
    result.profitReturn += data.profitReturn;
    result.operationalCashUsed += data.operationalCashUsed;
    result.totalInvestment += data.totalInvestment;
    result.tokaGasolina += data.tokaGasolina;
    result.cashGasolina += data.cashGasolina;
    result.totalGasolina += data.totalGasolina;
    result.operationalExpenses += data.operationalExpenses;
    result.availableCash += data.availableCash;
    result.travelExpenses += data.travelExpenses;
    result.paymentsCount += data.paymentsCount;
    result.balance += data.balance;
    result.operationalProfit += data.operationalProfit;
    result.balanceWithReinvest += data.balanceWithReinvest;
    result.carteraMuerta += data.carteraMuerta;
    result.uiExpensesTotal += data.uiExpensesTotal;
    result.uiGainsTotal += data.uiGainsTotal;
    result.nominaInterna += data.nominaInterna;
    result.salarioExterno += data.salarioExterno;
    result.viaticos += data.viaticos;
    result.operationalWeeks += data.operationalWeeks;
    result.weeklyIncome += data.weeklyIncome;
    result.weeklyExpenses += data.weeklyExpenses;
    result.weeklyProfit += data.weeklyProfit;
    result.weeklyPayments += data.weeklyPayments;
  }
  
  // Recalcular métricas derivadas
  result.profitPercentage = result.uiGainsTotal > 0 ? ((result.operationalProfit / result.uiGainsTotal) * 100) : 0;
  result.gainPerPayment = result.paymentsCount > 0 ? (result.operationalProfit / result.paymentsCount) : 0;
  
  return result;
}

export const getFinancialReport = graphql.field({
  type: graphql.nonNull(graphql.JSON),
  args: {
    routeIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.String))) }),
    year: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    clearCache: graphql.arg({ type: graphql.Boolean }),
  },
  resolve: async (root, { routeIds, year, clearCache = false }, context: Context) => {
    const monthlyData: { [key: string]: MonthlyData } = {};

    // Get routes info
    const routes = await context.prisma.route.findMany({
      where: { id: { in: routeIds } },
      select: { id: true, name: true }
    });

    // Get gas accounts
    const { tokaAccountId, cashAccountIds } = await getGasAccounts(context);

    // ✅ NUEVA LÓGICA: Cachear solo rutas individuales y sumar para combinaciones
    if (routeIds.length === 1) {
      // Para una sola ruta, usar la lógica original de cache
      const routeId = routeIds[0];
      const routeIdsKey = routeId; // Para rutas individuales, usar el ID directamente
      const monthsToRecompute = new Set<number>();

      // If clearCache, recompute everything (and clear cache)
      if (clearCache) {
        await (context.prisma as any).financialReportCache.deleteMany({
          where: { routeIdsKey, year }
        });
        for (let m = 1; m <= 12; m++) monthsToRecompute.add(m);
      }

      // 1) Load from cache months not marked for recomputation
      const cached = await (context.prisma as any).financialReportCache.findMany({
        where: { routeIdsKey, year },
      });
      
      // Si no hay cache para esta ruta, generar todo desde cero
      if (cached.length === 0) {
        console.log(`🔄 No hay cache para ruta ${routeId}, generando desde cero`);
        for (let m = 1; m <= 12; m++) monthsToRecompute.add(m);
      } else {
        // Si hay cache, verificar cada mes individualmente
        for (const row of cached) {
          const cachedData = row.data as MonthlyData;
          
          // Verificar si el cache está corrupto
          const hasNoFinancialActivity = cachedData.totalExpenses === 0 && 
                                       cachedData.incomes === 0 && 
                                       cachedData.paymentsCount === 0 && 
                                       cachedData.loanDisbursements === 0 &&
                                       cachedData.totalIncomingCash === 0;
          
          if (hasNoFinancialActivity) {
            monthsToRecompute.add(row.month);
          } else if (!monthsToRecompute.has(row.month)) {
            // Solo usar cache si NO está marcado para recálculo Y tiene datos válidos
            const key = row.month.toString().padStart(2, '0');
            monthlyData[key] = cachedData;
          }
        }
        
        // Verificar si hay meses que no están en cache
        const cachedMonths = new Set(cached.map((row: any) => row.month));
        for (let m = 1; m <= 12; m++) {
          if (!cachedMonths.has(m) && !monthsToRecompute.has(m)) {
            monthsToRecompute.add(m);
          }
        }
      }

      // 2) Recompute necessary months and update cache
      for (let m = 1; m <= 12; m++) {
        if (!monthsToRecompute.has(m)) continue;
        const data = await computeMonth(context, [routeId], year, m, tokaAccountId, cashAccountIds);
        const key = m.toString().padStart(2, '0');
        monthlyData[key] = data;
        const existing = await (context.prisma as any).financialReportCache.findFirst({
          where: {
            routeIdsKey,
            year,
            month: m,
          }
        });

        if (existing) {
          await (context.prisma as any).financialReportCache.update({
            where: { id: existing.id },
            data: { data }
          });
        } else {
          await (context.prisma as any).financialReportCache.create({
            data: { routeIdsKey, year, month: m, data }
          });
        }
      }
    } else {
      // ✅ Para múltiples rutas, sumar los caches individuales
      console.log(`🔄 Combinación de ${routeIds.length} rutas, sumando caches individuales`);
      
      for (let m = 1; m <= 12; m++) {
        const monthKey = m.toString().padStart(2, '0');
        const individualData: MonthlyData[] = [];
        
        // Obtener datos de cada ruta individual
        for (const routeId of routeIds) {
          const cached = await (context.prisma as any).financialReportCache.findFirst({
            where: { 
              routeIdsKey: routeId, // Cache individual por ruta
              year, 
              month: m 
            }
          });
          
          if (cached) {
            individualData.push(cached.data as MonthlyData);
          } else {
            // Si no hay cache para esta ruta, calcularlo
            console.log(`🔄 Calculando cache para ruta ${routeId}, mes ${m}`);
            const data = await computeMonth(context, [routeId], year, m, tokaAccountId, cashAccountIds);
            
            // Guardar en cache individual
            await (context.prisma as any).financialReportCache.create({
              data: { routeIdsKey: routeId, year, month: m, data }
            });
            
            individualData.push(data);
          }
        }
        
        // Sumar todos los datos individuales
        monthlyData[monthKey] = sumMonthlyData(individualData);
      }
    }

    return {
      routes: routes.map(r => ({ id: r.id, name: r.name })),
      year,
      months: [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
      ],
      data: monthlyData,
    };
  }
});


