import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Tipos para testing
interface TestData {
  type: string;
  payload: any;
}

interface QueryData {
  type: string;
  [key: string]: any;
}

interface AccountBalance {
  id: string;
  name: string;
  type: string;
  amount: number;
}

// Limpiar BD completamente
export async function cleanDatabase() {
  try {
    // Orden específico para evitar errores de FK
    await prisma.transaction.deleteMany();
    await prisma.loanPayment.deleteMany();
    await prisma.commissionPayment.deleteMany();
    await prisma.loan.deleteMany();
    await prisma.account.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.route.deleteMany();
    await prisma.borrower.deleteMany();
    await prisma.personalData.deleteMany();
    await prisma.loantype.deleteMany();
    await prisma.user.deleteMany();
    
    console.log('✅ Base de datos limpiada correctamente');
  } catch (error) {
    console.error('❌ Error limpiando BD:', error);
    throw error;
  }
}

// Seed de datos base para testing
export async function seedDatabase() {
  try {
    await cleanDatabase();
    
    console.log('🌱 Comenzando seed de datos de testing...');

    // 0. Crear usuario de prueba para autenticación
    // TEMPORALMENTE COMENTADO - Keystone usará initFirstItem
    /*
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    const testUser = await prisma.user.create({
      data: {
        name: 'Usuario Test',
        email: 'test@example.com',
        password: hashedPassword
      }
    });
    */

    // 1. Crear tipo de préstamo
    const loanType = await prisma.loantype.create({
      data: {
        name: 'Préstamo Semanal Test',
        rate: 20.0,
        weekDuration: 10
      }
    });

    // 2. Crear ruta base
    const testRoute = await prisma.route.create({
      data: {
        name: 'Ruta Test Principal'
      }
    });

    // 3. Crear cuentas para la ruta (todas las necesarias)
    const bankAccount = await prisma.account.create({
      data: {
        name: 'Cuenta Banco Test',
        type: 'BANK',
        amount: 100000, // $100,000 inicial
        route: { connect: { id: testRoute.id } }
      }
    });

    const cashAccount = await prisma.account.create({
      data: {
        name: 'Cuenta Asesor Test',
        type: 'OFFICE_CASH_FUND',
        amount: 50000, // $50,000 inicial
        route: { connect: { id: testRoute.id } }
      }
    });

    // Cuenta de fondo específica para gastos (EMPLOYEE_CASH_FUND)
    const fondoAccount = await prisma.account.create({
      data: {
        name: 'Fondo de Empleados Test',
        type: 'EMPLOYEE_CASH_FUND',
        amount: 25000, // $25,000 inicial
        route: { connect: { id: testRoute.id } }
      }
    });

    // Cuenta de viáticos si es necesaria
    const viaticosAccount = await prisma.account.create({
      data: {
        name: 'Viáticos Test',
        type: 'OFFICE_CASH_FUND',
        amount: 10000, // $10,000 inicial
        route: { connect: { id: testRoute.id } }
      }
    });

    // 4. Crear datos personales del líder
    const leaderPersonalData = await prisma.personalData.create({
      data: {
        fullName: 'Ana María González - Líder Test',
        phones: {
          create: {
            number: '9991234567'
          }
        }
      }
    });

    // 5. Crear empleado líder
    const testLeader = await prisma.employee.create({
      data: {
        type: 'LOAN_LEAD',
        personalDataId: leaderPersonalData.id,
        routesId: testRoute.id
      }
    });

    // 6. Crear 10 clientas con datos realistas
    const clients = [];
    for (let i = 1; i <= 10; i++) {
      const personalData = await prisma.personalData.create({
        data: {
          fullName: faker.person.fullName({ sex: 'female' }),
          phones: {
            create: {
              number: `999${String(i).padStart(7, '0')}`
            }
          }
        }
      });

      const borrower = await prisma.borrower.create({
        data: {
          personalDataId: personalData.id
        }
      });

      clients.push({
        id: borrower.id,
        personalData: personalData,
        borrower: borrower
      });
    }

    // 7. Crear algunos préstamos activos para hacer testing más realista
    const activeLoans = [];
    for (let i = 0; i < 5; i++) {
      const client = clients[i];
      const loanAmount = 5000 + (i * 1000); // Montos variados: 5k, 6k, 7k, etc.
      
      const loan = await prisma.loan.create({
        data: {
          requestedAmount: loanAmount,
          amountGived: loanAmount,
          comissionAmount: loanAmount * 0.1, // 10% comisión
          profitAmount: loanAmount * 0.2, // 20% ganancia
          signDate: new Date(),
          status: 'APPROVED',
          loantype: { connect: { id: loanType.id } },
          borrower: { connect: { id: client.borrower.id } },
          lead: { connect: { id: testLeader.id } },
          grantor: { connect: { id: testLeader.id } }
        }
      });

      activeLoans.push(loan);
    }

    console.log('✅ Seed completado exitosamente');
    console.log(`📊 Datos creados:
    - 1 Ruta: ${testRoute.name}
    - 1 Líder: ${leaderPersonalData.fullName}
    - 10 Clientas
    - 5 Préstamos activos
    - 4 Cuentas:
      * Banco: $${(bankAccount.amount || 0).toLocaleString()}
      * Asesor: $${(cashAccount.amount || 0).toLocaleString()}
      * Fondo Empleados: $${(fondoAccount.amount || 0).toLocaleString()}
      * Viáticos: $${(viaticosAccount.amount || 0).toLocaleString()}`);

    return {
      route: testRoute,
      leader: testLeader,
      leaderPersonalData,
      accounts: {
        bank: bankAccount,
        cash: cashAccount,
        fondo: fondoAccount,
        viaticos: viaticosAccount
      },
      clients,
      activeLoans,
      loanType
    };

  } catch (error) {
    console.error('❌ Error en seed:', error);
    throw error;
  }
}

// Crear datos específicos para tests
export async function createTestData(data: TestData) {
  try {
    switch (data.type) {
      case 'loan':
        return await prisma.loan.create({ data: data.payload });
      
      case 'transaction':
        return await prisma.transaction.create({ data: data.payload });
      
      case 'loanPayment':
        return await prisma.loanPayment.create({ data: data.payload });
      
      case 'borrower':
        const personalData = await prisma.personalData.create({
          data: {
            fullName: data.payload.fullName,
            phones: {
              create: { number: data.payload.phone }
            }
          }
        });
        return await prisma.borrower.create({
          data: {
            personalDataId: personalData.id
          }
        });
        
      default:
        throw new Error(`Tipo de dato no soportado: ${data.type}`);
    }
  } catch (error) {
    console.error(`❌ Error creando datos de tipo ${data.type}:`, error);
    throw error;
  }
}

// Verificar datos en BD
export async function verifyData(query: QueryData) {
  try {
    switch (query.type) {
      case 'transaction':
        const transaction = await prisma.transaction.findFirst({
          where: {
            amount: query.amount ? parseFloat(query.amount) : undefined,
            type: query.transactionType || undefined,
            description: query.description ? { contains: query.description } : undefined
          }
        });
        return transaction;
        
      case 'account':
        const account = await prisma.account.findFirst({
          where: {
            id: query.id || undefined,
            name: query.name ? { contains: query.name } : undefined
          }
        });
        return account;
        
      case 'loan':
        const loan = await prisma.loan.findFirst({
          where: {
            id: query.id || undefined,
            amountGived: query.amount ? parseFloat(query.amount) : undefined
          },
          include: {
            borrower: {
              include: { personalData: true }
            }
          }
        });
        return loan;
        
      default:
        throw new Error(`Tipo de verificación no soportado: ${query.type}`);
    }
  } catch (error) {
    console.error(`❌ Error verificando datos:`, error);
    throw error;
  }
}

// Obtener balances de todas las cuentas
export async function getAccountBalances(): Promise<AccountBalance[]> {
  try {
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        amount: true
      }
    });

    return accounts.map(account => ({
      id: account.id,
      name: account.name,
      type: account.type || '',
      amount: parseFloat(account.amount?.toString() || '0')
    }));
  } catch (error) {
    console.error('❌ Error obteniendo balances:', error);
    throw error;
  }
}

// Obtener resumen financiero para validaciones
export async function getFinancialSummary() {
  try {
    const accounts = await getAccountBalances();
    const totalTransactions = await prisma.transaction.count();
    const totalLoans = await prisma.loan.count();
    
    const totalBalance = accounts.reduce((sum, account) => sum + account.amount, 0);
    
    return {
      accounts,
      totalBalance,
      totalTransactions,
      totalLoans,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error obteniendo resumen financiero:', error);
    throw error;
  }
}

// Obtener todas las rutas disponibles
export async function getRoutes() {
  try {
    const routes = await prisma.route.findMany({
      include: {
        employees: {
          include: {
            personalData: true
          }
        },
        accounts: true
      }
    });
    
    console.log('🗺️ Rutas encontradas:', routes.length);
    routes.forEach(route => {
      console.log(`   - ${route.name} (ID: ${route.id})`);
      console.log(`     Empleados: ${route.employees?.length || 0}`);
      console.log(`     Cuentas: ${route.accounts?.length || 0}`);
    });
    
    return routes;
  } catch (error) {
    console.error('❌ Error obteniendo rutas:', error);
    throw error;
  }
}

// Verificar que una ruta específica existe
export async function verifyRouteExists(routeName: string) {
  try {
    const route = await prisma.route.findFirst({
      where: {
        name: routeName
      },
      include: {
        employees: {
          include: {
            personalData: true
          }
        },
        accounts: true
      }
    });
    
    if (route) {
      console.log(`✅ Ruta encontrada: ${route.name}`);
      console.log(`   - Empleados: ${route.employees?.length || 0}`);
      console.log(`   - Cuentas: ${route.accounts?.length || 0}`);
      
      // Verificar tipos de cuenta específicos
      const accountTypes = route.accounts?.map(acc => acc.type) || [];
      console.log(`   - Tipos de cuenta: ${accountTypes.join(', ')}`);
      
      // Verificar que tiene cuenta de fondo para gastos
      const hasFund = accountTypes.includes('EMPLOYEE_CASH_FUND');
      console.log(`   - Tiene cuenta de fondo para gastos: ${hasFund ? '✅' : '❌'}`);
      
      return true;
    } else {
      console.log(`❌ Ruta NO encontrada: ${routeName}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error verificando ruta:', error);
    return false;
  }
}

// Verificar que una ruta tiene todas las cuentas necesarias para gastos
export async function verifyRouteHasRequiredAccounts(routeName: string) {
  try {
    const route = await prisma.route.findFirst({
      where: {
        name: routeName
      },
      include: {
        accounts: true
      }
    });

    if (!route) {
      console.log(`❌ Ruta no encontrada: ${routeName}`);
      return false;
    }

    const accounts = route.accounts || [];
    const accountTypes = accounts.map(acc => acc.type);
    
    console.log(`🔍 Verificando cuentas para ruta: ${route.name}`);
    console.log(`   Cuentas disponibles (${accounts.length}):`);
    accounts.forEach(acc => {
      console.log(`   - ${acc.name} (${acc.type}): $${(acc.amount || 0).toLocaleString()}`);
    });

    // Verificar tipos necesarios (incluyendo el requerido para gastos)
    const requiredTypes = ['BANK', 'OFFICE_CASH_FUND', 'EMPLOYEE_CASH_FUND'];
    const missingTypes = requiredTypes.filter(type => !accountTypes.includes(type));
    
    if (missingTypes.length > 0) {
      console.log(`❌ Faltan tipos de cuenta: ${missingTypes.join(', ')}`);
      return false;
    }

    console.log(`✅ Ruta tiene todas las cuentas necesarias`);
    return true;

  } catch (error) {
    console.error('❌ Error verificando cuentas de ruta:', error);
    return false;
  }
}

// Obtener datos completos de una ruta específica para debugging
export async function getRouteWithAccounts(routeName: string) {
  try {
    const route = await prisma.route.findFirst({
      where: {
        name: routeName
      },
      include: {
        accounts: true,
        employees: {
          include: {
            personalData: true
          }
        }
      }
    });

    if (!route) {
      console.log(`❌ Ruta no encontrada: ${routeName}`);
      return null;
    }

    console.log(`🔍 Datos completos de la ruta: ${route.name}`);
    console.log(`   ID: ${route.id}`);
    console.log(`   Cuentas (${route.accounts?.length || 0}):`);
    
    if (route.accounts) {
      route.accounts.forEach((account, index) => {
        console.log(`     ${index + 1}. ${account.name} (${account.type}): $${(account.amount || 0).toLocaleString()}`);
      });
    }

    console.log(`   Empleados (${route.employees?.length || 0}):`);
    if (route.employees) {
      route.employees.forEach((employee, index) => {
        console.log(`     ${index + 1}. ${employee.personalData?.fullName} (${employee.type})`);
      });
    }

    // Verificar específicamente la cuenta EMPLOYEE_CASH_FUND
    const employeeCashFund = route.accounts?.find(acc => acc.type === 'EMPLOYEE_CASH_FUND');
    if (employeeCashFund) {
      console.log(`✅ Cuenta EMPLOYEE_CASH_FUND encontrada: ${employeeCashFund.name} ($${(employeeCashFund.amount || 0).toLocaleString()})`);
    } else {
      console.log(`❌ NO se encontró cuenta EMPLOYEE_CASH_FUND`);
    }

    return route;

  } catch (error) {
    console.error('❌ Error obteniendo datos de ruta:', error);
    return null;
  }
}

export { prisma }; 