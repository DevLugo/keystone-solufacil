import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';
import { safeToNumber } from '../utils/number';

export const TransactionSummaryType = graphql.object()({
  name: 'TransactionSummary',
  fields: {
    date: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (item: any) => item.date
    }),
    locality: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (item: any) => item.locality
    }),
    abono: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.abono
    }),
    credito: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.credito
    }),
    viatic: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.viatic
    }),
    gasoline: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.gasoline
    }),
    accommodation: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.accommodation
    }),
    nominaSalary: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.nominaSalary
    }),
    externalSalary: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.externalSalary
    }),
    vehiculeMaintenance: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.vehiculeMaintenance
    }),
    loanGranted: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.loanGranted
    }),
    loanPaymentComission: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.loanPaymentComission
    }),
    loanGrantedComission: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.loanGrantedComission
    }),
    leadComission: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.leadComission
    }),
    leadExpense: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.leadExpense
    }),
    moneyInvestment: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.moneyInvestment
    }),
    otro: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.otro
    }),
    balance: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.balance
    }),
    profit: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.profit
    }),
    cashBalance: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.cashBalance
    }),
    bankBalance: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.bankBalance
    }),
    cashAbono: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.cashAbono
    }),
    bankAbono: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.bankAbono
    }),
    transferFromCash: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.transferFromCash || 0
    }),
    transferToBank: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item: any) => item.transferToBank || 0
    }),
  },
});

export const getTransactionsSummary = graphql.field({
  type: graphql.nonNull(graphql.list(graphql.nonNull(TransactionSummaryType))),
  args: {
    startDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    endDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    routeId: graphql.arg({ type: graphql.String }),
  },
  resolve: async (root, { startDate, endDate, routeId }, context: Context) => {
    // Normalizar las fechas al inicio y fin del día en la zona horaria local
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    console.log('Buscando transacciones entre:', {
      start: start.toISOString(),
      end: end.toISOString()
    });

    // OPTIMIZADO: Obtenemos todas las transacciones dentro del rango de fechas especificado
    // Si se proporciona routeId, filtramos por ruta
    const whereClause: any = {
      date: {
        gte: start,
        lte: end,
      },
    };

    if (routeId) {
      whereClause.OR = [
        { snapshotRouteId: { equals: routeId } },
        { route: { id: { equals: routeId } } }
      ];
    }

    const rangeTransactions = await context.db.Transaction.findMany({
      where: whereClause,
    });
    
    console.log(`Obtenidas ${rangeTransactions.length} transacciones en el rango`);
    
    // DEBUG: Analizar todas las transacciones para encontrar problemas
    console.log('\n=== ANÁLISIS DE TRANSACCIONES ===');
    const transactionsByLeadId = new Map();
    rangeTransactions.forEach(transaction => {
      const leadId = transaction.leadId?.toString() || 'sin-lead';
      if (!transactionsByLeadId.has(leadId)) {
        transactionsByLeadId.set(leadId, []);
      }
      transactionsByLeadId.get(leadId).push({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        incomeSource: transaction.incomeSource,
        expenseSource: transaction.expenseSource,
        date: transaction.date
      });
    });
    
    
    // OPTIMIZADO: Recopilamos todos los IDs de rutas únicos para minimizar consultas
    const routeIds = new Set<string>();
    rangeTransactions.forEach(transaction => {
      // Prioridad: snapshotRouteId > routeId
      const routeId = transaction.snapshotRouteId || transaction.routeId;
      if (routeId) {
        routeIds.add(routeId.toString());
      }
    });
    
    // OPTIMIZADO: Una sola consulta para obtener todas las rutas
    const routes = await context.prisma.route.findMany({
      where: { 
        id: { in: Array.from(routeIds) } 
      },
      orderBy: { id: 'asc' }
    });
    
    // OPTIMIZADO: Crear mapa de rutas por ID
    const routeMap = new Map();
    routes.forEach(route => {
      routeMap.set(route.id, {
        name: route.name,
        id: route.id
      });
    });
    
    // OPTIMIZADO: Recopilamos todos los IDs de líderes únicos para minimizar consultas
    const leadIds = new Set<string>();
    rangeTransactions.forEach(transaction => {
      if (transaction.leadId) {
        leadIds.add(transaction.leadId.toString());
      }
    });
    
    // OPTIMIZADO: Una sola consulta para obtener todos los líderes con sus datos personales
    const leads = await context.prisma.employee.findMany({
      where: { 
        id: { in: Array.from(leadIds) } 
      },
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
        }
      },
      orderBy: { id: 'asc' }
    });
    
    // OPTIMIZADO: Crear mapa de localidades por líder usando las relaciones ya cargadas
    const leadInfoMap = new Map();
    
    leads.forEach(lead => {
      if (lead.personalData) {
        const personalData = lead.personalData;
        const addresses = personalData.addresses || [];
        
        if (addresses.length > 0) {
          const address = addresses[0]; // Primera dirección
          const location = address.location;
          
          if (location && location.municipality) {
            const municipality = location.municipality;
            const state = municipality.state;
            
            if (location.name && municipality.name && state && state.name) {
              leadInfoMap.set(lead.id, {
                locality: location.name,
                municipality: municipality.name,
                state: state.name,
                fullName: personalData.fullName || 'Sin nombre'
              });
            }
          }
        }
      }
    });
    
    // Obtenemos información de todas las cuentas relevantes
    const accountIds = new Set<string>();
    rangeTransactions.forEach(transaction => {
      if (transaction.sourceAccountId) accountIds.add(transaction.sourceAccountId.toString());
      if (transaction.destinationAccountId) accountIds.add(transaction.destinationAccountId.toString());
    });
    
    const accounts = await context.db.Account.findMany({
      where: { 
        id: { in: Array.from(accountIds) } 
      }
    });
    
    const accountMap = new Map();
    accounts.forEach(account => {
      accountMap.set(account.id, { 
        name: account.name, 
        type: account.type 
      });
    });

    
    console.log('\n=== PROCESANDO TRANSACCIONES ===');
    // Este objeto almacenará los datos agrupados por fecha y localidad
    // Cada localidad contendrá valores para cada tipo de ingreso o gasto
    // La ruta para obtener la localidad de un líder es:
    // Employee → PersonalData → Address → Location → Municipality → State
    const localidades: Record<string, Record<string, { [key: string]: number }>> = {};

    for (const transaction of rangeTransactions) {
      // Obtener la fecha de la transacción en formato YYYY-MM-DD
      const txDate = transaction.date ? new Date(transaction.date) : new Date();
      const transactionDate = txDate.toISOString().split('T')[0];
      
      // ESTRATEGIA MEJORADA PARA RUTAS HISTÓRICAS:
      // Prioridad: snapshotRouteId > routeId
      const routeId = transaction.snapshotRouteId || transaction.routeId;
      let routeName = 'Sin ruta';
      let locality = 'General';
      let leadName = '';
      let leadId = transaction.leadId;
      let localitySource = 'sin fuente';
      
      // Obtener información de la ruta histórica
      if (routeId) {
        const route = routeMap.get(routeId.toString());
        if (route) {
          routeName = route.name;
          localitySource = 'ruta histórica';
        }
      }
      
      // Obtener información del lead para localidad geográfica
      if (leadId) {
        const leadInfo = leadInfoMap.get(leadId) || leadInfoMap.get(leadId?.toString());
        if (leadInfo) {
          leadName = leadInfo.fullName;
            locality = leadInfo.locality;
          localitySource = 'datos del líder';
          }
        }
      
      // Si no tenemos información del lead, usar el nombre de la ruta como fallback
      if (locality === 'General' && routeName !== 'Sin ruta') {
        locality = routeName;
        localitySource = 'nombre de ruta';
      }
      
      // Construir la clave de agrupación basada en la localidad geográfica
      let leaderKey = '';
      if (leadName && leadName !== '') {
        leaderKey = `${leadName} - ${locality}`;
      } else if (leadId) {
        leaderKey = `Líder ID: ${leadId} - ${locality}`;
      } else {
        leaderKey = locality;
      }
      
      
      // Obtener información de cuentas
      const sourceAccount = (transaction.sourceAccountId) ? accountMap.get(transaction.sourceAccountId) : null;
      const destinationAccount = (transaction.destinationAccountId) ? accountMap.get(transaction.destinationAccountId) : null;

      // Para cada transacción, inicializamos las estructuras de datos necesarias
      if (!localidades[transactionDate]) {
        localidades[transactionDate] = {};
      }
      
      // Utilizamos el nombre del líder determinado anteriormente
      // Inicializamos la estructura para este líder si no existe
      if (!localidades[transactionDate][leaderKey]) {
        localidades[transactionDate][leaderKey] = {
          ABONO: 0, CASH_ABONO: 0, BANK_ABONO: 0,
          CREDITO: 0, VIATIC: 0, GASOLINE: 0, ACCOMMODATION: 0,
          NOMINA_SALARY: 0, EXTERNAL_SALARY: 0, VEHICULE_MAINTENANCE: 0,
          LOAN_GRANTED: 0, LOAN_PAYMENT_COMISSION: 0,
          LOAN_GRANTED_COMISSION: 0, LEAD_COMISSION: 0, LEAD_EXPENSE: 0,
          MONEY_INVESMENT: 0, OTRO: 0, CASH_BALANCE: 0, BANK_BALANCE: 0,
          TRANSFER_FROM_CASH: 0, TRANSFER_TO_BANK: 0
        };
      }

      // Procesar cada tipo de transacción
      if (transaction.type === 'INCOME') {
        // Determinar si es una transacción bancaria basado en la información de las cuentas
        const isBankTransaction = transaction.incomeSource === 'BANK_LOAN_PAYMENT' || 
                                 destinationAccount?.type === 'BANK';
        
        const amount = Number(transaction.amount || 0);
        
        // Procesar diferentes tipos de ingresos
        if (transaction.incomeSource === 'LOAN_PAYMENT' || transaction.incomeSource === 'CASH_LOAN_PAYMENT' || transaction.incomeSource === 'BANK_LOAN_PAYMENT') {
          // Abonos de pagos de préstamos
          if (isBankTransaction) {
            localidades[transactionDate][leaderKey].BANK_ABONO += amount;
            localidades[transactionDate][leaderKey].BANK_BALANCE += amount;
          } else {
            localidades[transactionDate][leaderKey].CASH_ABONO += amount;
            localidades[transactionDate][leaderKey].CASH_BALANCE += amount;
          }
          
          // Sumamos al ABONO general
          localidades[transactionDate][leaderKey].ABONO += amount;
          
        } else if (transaction.incomeSource === 'MONEY_INVESMENT') {
          localidades[transactionDate][leaderKey].MONEY_INVESMENT += amount;
          
          // Actualizar balance correspondiente
          if (isBankTransaction) {
            localidades[transactionDate][leaderKey].BANK_BALANCE += amount;
          } else {
            localidades[transactionDate][leaderKey].CASH_BALANCE += amount;
          }
          
        } else {
          // Otros tipos de ingresos se procesan como abonos generales
          if (isBankTransaction) {
            localidades[transactionDate][leaderKey].BANK_ABONO += amount;
            localidades[transactionDate][leaderKey].BANK_BALANCE += amount;
          } else {
            localidades[transactionDate][leaderKey].CASH_ABONO += amount;
            localidades[transactionDate][leaderKey].CASH_BALANCE += amount;
          }

          // Sumamos al ABONO general
          localidades[transactionDate][leaderKey].ABONO += amount;
        }
      } else if (transaction.type === 'EXPENSE') {
        
        // Procesar diferentes tipos de gastos
        const amount = Number(transaction.amount || 0);
        
        // Determinar si es un gasto en efectivo o bancario
        const isBankExpense = sourceAccount?.type === 'BANK';
        
        if (isBankExpense) {
          console.log(`💰 Gasto bancario: ${transaction.expenseSource} - $${amount} para ${leaderKey}`);
          console.log(`   - Balance banco antes: ${localidades[transactionDate][leaderKey].BANK_BALANCE}`);
          console.log(`   - NOTA: Los gastos bancarios NO se descuentan del balance bancario (solo se suman ingresos)`);
          console.log(`   - Balance banco después: ${localidades[transactionDate][leaderKey].BANK_BALANCE}`);
        }
        
        // CORREGIDO: Verificar el tipo de gasto según expenseSource
        // IMPORTANTE: Los gastos bancarios NO se descuentan del BANK_BALANCE
        // El BANK_BALANCE solo suma ingresos bancarios
        if (transaction.expenseSource === 'GASOLINE') {
          localidades[transactionDate][leaderKey].GASOLINE += amount;
          // Solo descontar del balance de efectivo si es gasto en efectivo
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else if (transaction.expenseSource === 'VIATIC') {
          localidades[transactionDate][leaderKey].VIATIC += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else if (transaction.expenseSource === 'ACCOMMODATION') {
          localidades[transactionDate][leaderKey].ACCOMMODATION += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else if (transaction.expenseSource === 'VEHICULE_MAINTENANCE') {
          localidades[transactionDate][leaderKey].VEHICULE_MAINTENANCE += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else if (transaction.expenseSource === 'NOMINA_SALARY') {
          localidades[transactionDate][leaderKey].NOMINA_SALARY += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else if (transaction.expenseSource === 'EXTERNAL_SALARY') {
          localidades[transactionDate][leaderKey].EXTERNAL_SALARY += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else if (transaction.expenseSource === 'CREDITO') {
          localidades[transactionDate][leaderKey].CREDITO += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else if (transaction.expenseSource === 'LOAN_GRANTED') {
          localidades[transactionDate][leaderKey].LOAN_GRANTED += amount;
          console.log(`💰 Préstamo otorgado: ${amount} - isBankExpense: ${isBankExpense} para ${leaderKey}`);
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
            console.log(`   - CASH_BALANCE después: ${localidades[transactionDate][leaderKey].CASH_BALANCE}`);
          }
        } else if (transaction.expenseSource === 'LOAN_GRANTED_COMISSION') {
          localidades[transactionDate][leaderKey].LOAN_GRANTED_COMISSION += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else if (transaction.expenseSource === 'LOAN_PAYMENT_COMISSION') {
          localidades[transactionDate][leaderKey].LOAN_PAYMENT_COMISSION += amount;
          console.log(`💰 Comisión pago: ${amount} - isBankExpense: ${isBankExpense} para ${leaderKey}`);
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
            console.log(`   - CASH_BALANCE después: ${localidades[transactionDate][leaderKey].CASH_BALANCE}`);
          }
        } else if (transaction.expenseSource === 'LEAD_COMISSION') {
          localidades[transactionDate][leaderKey].LEAD_COMISSION += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else if (transaction.expenseSource === 'LEAD_EXPENSE') {
          localidades[transactionDate][leaderKey].LEAD_EXPENSE += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        } else {
          localidades[transactionDate][leaderKey].OTRO += amount;
          if (!isBankExpense) {
            localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          }
        }

      } else if (transaction.type === 'TRANSFER') {
        // Procesar transferencias entre cuentas
        const amount = Number(transaction.amount || 0);
        
        // Determinar el tipo de transferencia basado en las cuentas
        const isFromCashToBank = sourceAccount?.type === 'EMPLOYEE_CASH_FUND' && destinationAccount?.type === 'BANK';
        const isFromBankToCash = sourceAccount?.type === 'BANK' && destinationAccount?.type === 'EMPLOYEE_CASH_FUND';
        
        if (isFromCashToBank) {
          // Transferencia de efectivo a banco: 
          // 1. Reducir abonos en efectivo (porque se transfirió a banco)
          localidades[transactionDate][leaderKey].CASH_ABONO -= amount;
          // 2. Aumentar abonos en banco (porque llegó al banco)
          localidades[transactionDate][leaderKey].BANK_ABONO += amount;
          // 3. Ajustar balances finales
          localidades[transactionDate][leaderKey].CASH_BALANCE -= amount;
          localidades[transactionDate][leaderKey].BANK_BALANCE += amount;
          // 4. Rastrear transferencias
          localidades[transactionDate][leaderKey].TRANSFER_FROM_CASH += amount;
          localidades[transactionDate][leaderKey].TRANSFER_TO_BANK += amount;
          console.log(`🔄 Transferencia efectivo->banco: ${amount} para ${leaderKey}`);
          console.log(`   - Balance efectivo después: ${localidades[transactionDate][leaderKey].CASH_BALANCE}`);
          console.log(`   - Balance banco después: ${localidades[transactionDate][leaderKey].BANK_BALANCE}`);
        } else if (isFromBankToCash) {
          // Transferencia de banco a efectivo: 
          // 1. Reducir abonos en banco (porque se transfirió a efectivo)
          localidades[transactionDate][leaderKey].BANK_ABONO -= amount;
          // 2. Aumentar abonos en efectivo (porque llegó al efectivo)
          localidades[transactionDate][leaderKey].CASH_ABONO += amount;
          // 3. Ajustar balances finales
          localidades[transactionDate][leaderKey].BANK_BALANCE -= amount;
          localidades[transactionDate][leaderKey].CASH_BALANCE += amount;
          // Nota: No rastreamos transferencias de banco a efectivo en estos campos
          console.log(`🔄 Transferencia banco->efectivo: ${amount} para ${leaderKey}`);
        }
        // Nota: No procesamos otras transferencias (entre cuentas del mismo tipo o diferentes tipos)
      }
    }

    // Verificar estadísticas finales
    const localidadesUnicas = new Set();
    Object.entries(localidades).forEach(([date, localities]) => {
      Object.keys(localities).forEach(locality => {
        localidadesUnicas.add(locality);
      });
    });
    

    const result = Object.entries(localidades).flatMap(([date, localities]) => 
      Object.entries(localities).map(([locality, data]) => {
        // Verificar si hay valores inválidos (permitir negativos para balances)
        const checkValue = (value: number, name: string) => {
          if (isNaN(value)) {
            return 0;
          }
          return value;
        };
        
        // Función especial para balances que permite valores negativos
        const checkBalanceValue = (value: number, name: string) => {
          if (isNaN(value)) {
            return 0;
          }
          return value; // Permite valores negativos
        };

        // Calcular el balance final usando los totales acumulados
        const totalIngresos = checkValue(data.ABONO, 'ABONO') + checkValue(data.MONEY_INVESMENT, 'MONEY_INVESMENT');
        const totalGastos = checkValue(data.CREDITO, 'CREDITO') + 
                          checkValue(data.VIATIC, 'VIATIC') + 
                          checkValue(data.GASOLINE, 'GASOLINE') + 
                          checkValue(data.ACCOMMODATION, 'ACCOMMODATION') + 
                          checkValue(data.NOMINA_SALARY, 'NOMINA_SALARY') + 
                          checkValue(data.EXTERNAL_SALARY, 'EXTERNAL_SALARY') + 
                          checkValue(data.VEHICULE_MAINTENANCE, 'VEHICULE_MAINTENANCE') + 
                          checkValue(data.LOAN_GRANTED, 'LOAN_GRANTED') + 
                          checkValue(data.OTRO, 'OTRO');
        const totalComisiones = checkValue(data.LOAN_PAYMENT_COMISSION, 'LOAN_PAYMENT_COMISSION') + 
                              checkValue(data.LOAN_GRANTED_COMISSION, 'LOAN_GRANTED_COMISSION') + 
                              checkValue(data.LEAD_COMISSION, 'LEAD_COMISSION');
        
        const balanceFinal = totalIngresos - totalGastos - totalComisiones;
        const profitFinal = totalIngresos - totalGastos;
        
        // Logging final para debugging
        console.log(`📊 RESUMEN FINAL para ${locality} (${date}):`);
        console.log(`   - CASH_ABONO: ${data.CASH_ABONO}`);
        console.log(`   - BANK_ABONO: ${data.BANK_ABONO}`);
        console.log(`   - LOAN_GRANTED: ${data.LOAN_GRANTED}`);
        console.log(`   - LOAN_PAYMENT_COMISSION: ${data.LOAN_PAYMENT_COMISSION}`);
        console.log(`   - LOAN_GRANTED_COMISSION: ${data.LOAN_GRANTED_COMISSION}`);
        console.log(`   - CASH_BALANCE: ${data.CASH_BALANCE}`);
        console.log(`   - BANK_BALANCE: ${data.BANK_BALANCE}`);
        console.log(`   - TRANSFER_TO_BANK: ${data.TRANSFER_TO_BANK}`);
        
        return {
          date,
          locality,
          abono: checkValue(data.ABONO, 'ABONO'),
          cashAbono: checkValue(data.CASH_ABONO, 'CASH_ABONO'),
          bankAbono: checkValue(data.BANK_ABONO, 'BANK_ABONO'),
          credito: checkValue(data.CREDITO, 'CREDITO'),
          viatic: checkValue(data.VIATIC, 'VIATIC'),
          gasoline: checkValue(data.GASOLINE, 'GASOLINE'),
          accommodation: checkValue(data.ACCOMMODATION, 'ACCOMMODATION'),
          nominaSalary: checkValue(data.NOMINA_SALARY, 'NOMINA_SALARY'),
          externalSalary: checkValue(data.EXTERNAL_SALARY, 'EXTERNAL_SALARY'),
          vehiculeMaintenance: checkValue(data.VEHICULE_MAINTENANCE, 'VEHICULE_MAINTENANCE'),
          loanGranted: checkValue(data.LOAN_GRANTED, 'LOAN_GRANTED'),
          loanPaymentComission: checkValue(data.LOAN_PAYMENT_COMISSION, 'LOAN_PAYMENT_COMISSION'),
          loanGrantedComission: checkValue(data.LOAN_GRANTED_COMISSION, 'LOAN_GRANTED_COMISSION'),
          leadComission: checkValue(data.LEAD_COMISSION, 'LEAD_COMISSION'),
          leadExpense: checkValue(data.LEAD_EXPENSE, 'LEAD_EXPENSE'),
          moneyInvestment: checkValue(data.MONEY_INVESMENT, 'MONEY_INVESMENT'),
          otro: checkValue(data.OTRO, 'OTRO'),
          balance: balanceFinal,
          profit: profitFinal,
          cashBalance: checkBalanceValue(data.CASH_BALANCE, 'CASH_BALANCE'),
          bankBalance: checkBalanceValue(data.BANK_BALANCE, 'BANK_BALANCE'),
          transferFromCash: checkValue(data.TRANSFER_FROM_CASH, 'TRANSFER_FROM_CASH'),
          transferToBank: checkValue(data.TRANSFER_TO_BANK, 'TRANSFER_TO_BANK'),
        };
      })
    );

    return result;
  },
});
