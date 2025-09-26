import { graphql, list } from '@keystone-6/core';
import { allowAll } from '@keystone-6/core/access';
import { text, password, timestamp, relationship, decimal, integer, select, virtual, json, checkbox } from '@keystone-6/core/fields';
import { KeystoneContext } from '@keystone-6/core/types';
import { prisma } from './keystone';
import { calculateLoanProfitAmount, calculatePendingProfitAmount } from './utils/loan';
import { calculatePaymentProfitAmount } from './utils/loanPayment';
import { Decimal } from '@prisma/client/runtime/library';
import * as AdjustBalanceField from './admin/components/accounts/AdjustBalance';

// Función para manejar decimales con precisión
const parseAmount = (value: unknown): number => {
  if (typeof value === 'string') {
    return parseFloat(parseFloat(value).toFixed(2));
  }
  if (typeof value === 'number') {
    return parseFloat(value.toFixed(2));
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return parseFloat(parseFloat(value.toString()).toFixed(2));
  }
  return 0;
};

// Extender el tipo de contexto para incluir skipAfterOperation
interface ExtendedContext extends KeystoneContext {
  transactionsToDelete?: any[];
}

// Función utilitaria para crear logs de auditoría
const createAuditLog = async (
  context: KeystoneContext,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  modelName: string,
  recordId: string,
  previousValues?: any,
  newValues?: any,
  changedFields?: string[],
  description?: string,
  metadata?: any
) => {
  try {
    const session = context.session;
    const user = session?.data;
    
    // Obtener información de la sesión
    const sessionId = session?.id || 'unknown';
    const ipAddress = (context.req as any)?.ip || (context.req as any)?.connection?.remoteAddress || 'unknown';
    const userAgent = (context.req as any)?.headers?.['user-agent'] || 'unknown';
    
    // Crear el log de auditoría
    await context.prisma.auditLog.create({
      data: {
        operation,
        modelName,
        recordId,
        userName: user?.name || 'Usuario Desconocido',
        userEmail: user?.email || 'unknown@example.com',
        userRole: user?.role || 'NORMAL',
        sessionId,
        ipAddress,
        userAgent,
        previousValues: previousValues ? JSON.parse(JSON.stringify(previousValues)) : null,
        newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
        changedFields: changedFields ? JSON.parse(JSON.stringify(changedFields)) : null,
        description: description || `${operation} en ${modelName} ${recordId}`,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        user: user?.id ? { connect: { id: user.id } } : undefined,
      }
    });
    
    console.log(`📊 Audit Log: ${operation} en ${modelName} ${recordId} por ${user?.name || 'Usuario Desconocido'}`);
  } catch (error) {
    console.error('❌ Error creando log de auditoría:', error);
    // No fallar la operación principal si falla el log
  }
};

// Hook global de auditoría que se puede aplicar a cualquier modelo
const createAuditHook = (modelName: string, getDescription?: (item: any, operation: string) => string, getMetadata?: (item: any) => any) => {
  return {
    afterOperation: async ({ operation, item, context, originalItem }: { operation: string; item: any; context: KeystoneContext; originalItem?: any }) => {
      // Evitar logs recursivos - no logear operaciones en AuditLog
      if (modelName === 'AuditLog') {
        return;
      }

      // Auditoría optimizada para operaciones críticas
      const criticalOperations = ['createCustomLeadPaymentReceived', 'createCustomPayment'];
      const isCriticalOperation = (context.req as any)?.body?.query?.includes('createCustomLeadPaymentReceived') || 
                                 (context.req as any)?.body?.query?.includes('createCustomPayment');
      
      if (isCriticalOperation) {
        // Para operaciones críticas, solo registrar información básica sin procesamiento complejo
        setImmediate(async () => {
          try {
            if (operation === 'create' && item) {
              await createAuditLog(
                context,
                'CREATE',
                modelName,
                item.id.toString(),
                undefined,
                { id: item.id, operation: 'CREATE' }, // Solo datos básicos
                undefined,
                `Creación rápida en ${modelName}`,
                { isCriticalOperation: true }
              );
            }
          } catch (error) {
            console.error(`❌ Error en auditoría crítica para ${modelName}:`, error);
          }
        });
        return;
      }

      // Ejecutar auditoría de forma asíncrona para no bloquear la transacción principal
      setImmediate(async () => {
        try {
          if (operation === 'create' && item) {
            const description = getDescription ? getDescription(item, 'CREATE') : `${operation} en ${modelName} ${item.id}`;
            const metadata = getMetadata ? getMetadata(item) : { modelName, recordId: item.id };
            
            await createAuditLog(
              context,
              'CREATE',
              modelName,
              item.id.toString(),
              undefined,
              item,
              undefined,
              description,
              metadata
            );
          } else if (operation === 'update' && item && originalItem) {
            const itemData = item as any;
            const originalItemData = originalItem as any;
            
            // Detectar campos que cambiaron
            const changedFields = Object.keys(originalItemData).filter(key => 
              originalItemData[key] !== itemData[key]
            );
            
/* PrepaidCard definition moved below, at top-level scope */

            const description = getDescription ? getDescription(item, 'UPDATE') : `${operation} en ${modelName} ${item.id}`;
            const metadata = getMetadata ? getMetadata(item) : { modelName, recordId: item.id, changedFields };
            
            await createAuditLog(
              context,
              'UPDATE',
              modelName,
              item.id.toString(),
              originalItem,
              item,
              changedFields,
              description,
              metadata
            );
          } else if (operation === 'delete' && originalItem) {
            const originalItemData = originalItem as any;
            
            const description = getDescription ? getDescription(originalItem, 'DELETE') : `${operation} en ${modelName} ${originalItem.id}`;
            const metadata = getMetadata ? getMetadata(originalItem) : { modelName, recordId: originalItem.id };
            
            await createAuditLog(
              context,
              'DELETE',
              modelName,
              originalItem.id.toString(),
              originalItem,
              undefined,
              undefined,
              description,
              metadata
            );
          }
        } catch (error) {
          console.error(`❌ Error en auditoría para ${modelName}:`, error);
        }
      });
    }
  };
};

interface LoanType {
  rate: Decimal | null;
  weekDuration: number;
}

interface Loan {
  id: string;
  requestedAmount: Decimal;
  amountGived: Decimal;
  profitAmount: Decimal | null;
  loantype: LoanType | null;
  comissionAmount?: Decimal;
  signDate: Date;
  leadId?: string;
}

interface TransactionItem {
  id: string;
  amount: Decimal | string | number;
  type: string;
  incomeSource?: string;
  expenseSource?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
}

export const User = list({
  access: allowAll,
  fields: {
    name: text({ defaultValue: '' }),
    email: text({ isIndexed: 'unique', defaultValue: '' }),
    password: password(),
    role: select({
      options: [
        { label: 'Administrador', value: 'ADMIN' },
        { label: 'Usuario Normal', value: 'NORMAL' },
      ],
      defaultValue: 'NORMAL',
    }),
    portfolioCleanups: relationship({ ref: 'PortfolioCleanup.executedBy', many: true }),
    // ✅ NUEVA FUNCIONALIDAD: Fotos de documentos subidas por el usuario
    documentPhotos: relationship({ 
      ref: 'DocumentPhoto.uploadedBy', 
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['title', 'documentType', 'createdAt'],
        linkToItem: true
      }
    }),
    // ✅ NUEVA FUNCIONALIDAD: Configuraciones de reportes creadas por el usuario
    reportConfigsCreated: relationship({ ref: 'ReportConfig.createdBy', many: true }),
    // ✅ NUEVA FUNCIONALIDAD: Configuraciones de reportes actualizadas por el usuario
    reportConfigsUpdated: relationship({ ref: 'ReportConfig.updatedBy', many: true }),
    // ✅ NUEVA FUNCIONALIDAD: Usuario como destinatario de reportes
    reportConfigRecipients: relationship({ ref: 'ReportConfig.recipients', many: true }),
    // ✅ NUEVA FUNCIONALIDAD: Usuarios de Telegram vinculados
    telegramUsers: relationship({ ref: 'TelegramUser.platformUser', many: true }),
    employee: relationship({ ref: 'Employee.user' }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    adjustBalance: virtual({
      ui: {
        views: './admin/components/accounts/AdjustBalance',
      },
      field: graphql.field({
        type: graphql.JSON,
        resolve: (item: any) => item,
      })
    })
  },
  hooks: createAuditHook('User', 
    (item, operation) => `${operation} de usuario: ${item.name} (${item.email})`,
    (item) => ({ userId: item.id, userName: item.name, userEmail: item.email })
  )
});

export const AuditLog = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    // Información de la operación
    operation: select({
      options: [
        { label: 'Creación', value: 'CREATE' },
        { label: 'Actualización', value: 'UPDATE' },
        { label: 'Eliminación', value: 'DELETE' },
      ],
      isIndexed: true,
    }),
    
    // Información del modelo afectado
    modelName: text({ isIndexed: true }), // 'Loan', 'Transaction', 'Employee', etc.
    recordId: text({ isIndexed: true }), // ID del registro afectado
    
    // Información del usuario que realizó la operación
    userName: text(),
    userEmail: text(),
    userRole: text(),
    
    // Información de la sesión
    sessionId: text(),
    ipAddress: text(),
    userAgent: text(),
    
    // Detalles de la operación
    previousValues: json(), // Valores anteriores (para UPDATE/DELETE)
    newValues: json(), // Valores nuevos (para CREATE/UPDATE)
    changedFields: json(), // Campos que cambiaron (para UPDATE)
    
    // Información adicional
    description: text(), // Descripción legible de la operación
    metadata: json(), // Datos adicionales específicos del modelo
    
    // Timestamps
    createdAt: timestamp({ defaultValue: { kind: 'now' }, isIndexed: true }),
    
    // Relaciones opcionales para facilitar consultas
    user: relationship({ ref: 'User', many: false }),
  },
  hooks: {
    beforeOperation: async ({ operation, item, context, resolvedData }) => {
      // Evitar logs recursivos - no logear operaciones en AuditLog
      if (resolvedData?.modelName === 'AuditLog') {
        return;
      }
    }
  }
});

// Modelo para logs de ejecución de reportes automáticos
export const ReportExecutionLog = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    // Configuración del reporte que se ejecutó
    reportConfig: relationship({ ref: 'ReportConfig.executionLogs', many: false }),
    
    // Estado de la ejecución
    status: select({
      options: [
        { label: 'Exitoso', value: 'SUCCESS' },
        { label: 'Error', value: 'ERROR' },
        { label: 'En Proceso', value: 'RUNNING' },
        { label: 'Cancelado', value: 'CANCELLED' },
      ],
      isIndexed: true,
    }),
    
    // Detalles de la ejecución
    executionType: select({
      options: [
        { label: 'Automático (Cron)', value: 'AUTOMATIC' },
        { label: 'Manual', value: 'MANUAL' },
        { label: 'Prueba', value: 'TEST' },
      ],
      isIndexed: true,
    }),
    
    // Información del resultado
    message: text(), // Mensaje de éxito o descripción del error
    errorDetails: text(), // Detalles del error si ocurrió
    recipientsCount: integer(), // Número de destinatarios que recibieron el reporte
    successfulDeliveries: integer(), // Número de entregas exitosas
    failedDeliveries: integer(), // Número de entregas fallidas
    
    // Metadatos de la ejecución
    startTime: timestamp({ isIndexed: true }),
    endTime: timestamp(),
    duration: integer(), // Duración en milisegundos
    
    // Información del sistema
    cronExpression: text(), // Expresión cron utilizada
    timezone: text(), // Zona horaria de la ejecución
    
    // Timestamps
    createdAt: timestamp({ defaultValue: { kind: 'now' }, isIndexed: true }),
    updatedAt: timestamp({ defaultValue: { kind: 'now' } }),
  },
  hooks: {
    beforeOperation: async ({ operation, item, context, resolvedData }) => {
      if (operation === 'update') {
        resolvedData.updatedAt = new Date();
      }
    }
  }
});

export const Route = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    name: text(),
    employees: relationship({ ref: 'Employee.routes', many: true }),
    localities: relationship({ ref: 'Location.route', many: true }),
    accounts: relationship({ ref: 'Account.routes', many: true }),
    transactions: relationship({ ref: 'Transaction.route', many: true }),
    portfolioCleanups: relationship({ ref: 'PortfolioCleanup.route', many: true }),
    // ✅ NUEVA FUNCIONALIDAD: Configuraciones de reportes que incluyen esta ruta
    reportConfigs: relationship({ ref: 'ReportConfig.routes', many: true }),
  }
});

// Sin entidad PrepaidCard; mapeo por tarjeta se maneja en FE al importar

export const Location = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    name: text({ isIndexed: 'unique' }),
    municipality: relationship({ ref: 'Municipality.location' }),
    route: relationship({ ref: 'Route.localities' }),
    addresses: relationship({ ref: 'Address.location', many: true }),

  }
});

export const State = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    name: text(),
    municipalities: relationship({ ref: 'Municipality.state', many: true }),
  }
});

export const Municipality = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    name: text(),
    state: relationship({ ref: 'State.municipalities' }),
    location: relationship({ ref: 'Location.municipality', many: true }),
  }
});

export const Employee = list({
  access: allowAll,
  fields: {
    oldId: text({ db: { isNullable: true }, isIndexed: 'unique' }),
    routes: relationship({
      ref: 'Route.employees',
      many: false,
    }),
    //expenses: relationship({ ref: 'Expense.employee', many: true }), // Agrego esta línea
    transactions: relationship({ ref: 'Transaction.lead', many: true }),
    //comissionPaymentConfigurationLead: relationship({ ref: 'ComissionPaymentConfiguration.leadId' }),
    personalData: relationship({ ref: 'PersonalData.employee' }),
    loan: relationship({ ref: 'Loan.grantor', many: true }),
    //loanPayment: relationship({ ref: 'LoanPayment.collector', many: true }),
    commissionPayment: relationship({ ref: 'CommissionPayment.employee', many: true }),
    LeadManagedLoans: relationship({ ref: 'Loan.lead', many: true }),
    LeadPaymentReceivedLead: relationship({ ref: 'LeadPaymentReceived.lead', many: true }),
    leadPaymentsReceivedAgent: relationship({ ref: 'LeadPaymentReceived.agent', many: true }),
    user: relationship({ ref: 'User.employee' }),
    type: select({
      options: [
        { label: 'LIDER DE RUTA', value: 'ROUTE_LEAD' },
        { label: 'LIDER DE CREDITOS', value: 'LEAD' },
        { label: 'ASISTENTE DE RUTA', value: 'ROUTE_ASSISTENT' },
      ],
    }),
  },
  hooks: createAuditHook('Employee', 
    (item: any, operation: string) => {
      const employeeData = item as any;
      const employeeName = employeeData.personalData?.fullName || 'Empleado';
      const employeeType = employeeData.type || 'UNKNOWN';
      const operationText = operation === 'CREATE' ? 'creado' : operation === 'UPDATE' ? 'actualizado' : 'eliminado';
      return `Empleado ${operationText}: ${employeeName} (${employeeType})`;
    },
    (item: any) => {
      const employeeData = item as any;
      return {
        type: employeeData.type,
        employeeName: employeeData.personalData?.fullName,
        oldId: employeeData.oldId
      };
    }
  ),
});

/* export const Expense = list({
  access: allowAll,
  fields: {
    amountToPay: decimal(),
    dueDate: timestamp(),
    payedAt: timestamp(),
    employee: relationship({ ref: 'Employee.expenses' }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    userId: text(),
  }
}); */

/* export const ComissionPaymentConfiguration = list({
  access: allowAll,
  fields: {
    amount: decimal(),
    loanType: relationship({ ref: 'Loantype.comissionPaymentConfiguration' }),
    leadId: relationship({ ref: 'Employee.comissionPaymentConfigurationLead' }),
  }
}); */

export const Loantype = list({
  access: allowAll,
  db: {
    idField: { kind: 'cuid' }, // Usa db.idField para definir el campo id
  },
  fields: {
    name: text(),
    weekDuration: integer(),
    rate: decimal(  // Decimal type used for percentage, adjust precision as necessary
      {
        precision: 10,
        scale: 2,
        validation: {
          isRequired: true,
        }
      }),
    loanPaymentComission: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
      validation: {
        isRequired: false,
      },
      db: { isNullable: true }
    }),
    loanGrantedComission: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
      validation: {
        isRequired: false,
      },
      db: { isNullable: true }
    }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    loan: relationship({
      ref: 'Loan.loantype', many: true, ui: {
        hideCreate: true,
      }
    }),
    //comissionPaymentConfiguration: relationship({ ref: 'ComissionPaymentConfiguration.loanType', many: true }),
  }
});

// Additional models, like Phone, Address, Borrower, PersonalData, Loan, LoanPayment, Transaction, CommissionPayment, 
// and enums like EmployeesTypes, AccountType, TransactionType, TransactionIncomeSource, and TransactionExpenseSource 
// should be defined in a similar detailed manner based on the fields and relationships specified in the Prisma schema.

// Due to the complexity and length, consider breaking down into multiple files or modules if needed for maintainability.

// ... (resto del código)

export const Phone = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    number: text(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    personalData: relationship({ ref: 'PersonalData.phones' }),
  },
});

export const Address = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    street: text(),
    exteriorNumber: text(),
    interiorNumber: text(),
    postalCode: text(),
    references: text(),
    location: relationship({ ref: 'Location.addresses' }), // Cambio aquí
    personalData: relationship({ ref: 'PersonalData.addresses' }),
  },
});

export const Borrower = list({
  access: allowAll,
  fields: {
    personalData: relationship({ ref: 'PersonalData.borrower' }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    loanFinishedCount: integer({ defaultValue: 0 }),
    loans: relationship({ ref: 'Loan.borrower', many: true }),
    fullName: virtual({
      isFilterable: true,
      field: graphql.field({
        type: graphql.String,
        resolve: async (item, args, context) => {
          /* const borrower = await context.db.Borrower.findOne({
            where: { id: {equal:(item as { id: string }).id }
            },
          });
          
          if(borrower === null){
            return "";
          } */
          const personalData = await context.db.PersonalData.findMany({
            where: {
              id: {
                equals: (item as { personalDataId: string }).personalDataId,
              }
            },
          });

          if (personalData.length === 0) {
            return "";
          }
          return personalData[0]?.fullName;
        },
      }),
    }),
  },
  ui: {
    isHidden: true,
    listView: {
      initialColumns: ['fullName', 'id'],
    },
  }
  ,
  hooks: {
    beforeOperation: async ({ operation, resolvedData, context }) => {
      if (operation !== 'create' && operation !== 'update') return;

      const normalizeFullName = (name: string): string => {
        if (!name) return '';
        return name
          .replace(/\s+/g, ' ')
          .trim();
      };

      // Si viene un create anidado de personalData, intentar reutilizar existente
      const pdCreate: any = (resolvedData as any)?.personalData?.create;
      if (pdCreate && typeof pdCreate === 'object') {
        const incomingName: string = pdCreate.fullName || '';
        const normalizedName = normalizeFullName(incomingName);

        // Buscar un PersonalData existente por nombre normalizado (case-insensitive)
        const existing = await (context.prisma as any).personalData.findFirst({
          where: {
            fullName: {
              equals: normalizedName,
              mode: 'insensitive'
            }
          }
        });

        if (existing) {
          // Reutilizar PD existente
          (resolvedData as any).personalData = { connect: { id: existing.id } };
        } else {
          // Normalizar nombre para la creación
          (resolvedData as any).personalData.create.fullName = normalizedName;
        }
      }
    }
  }
});

export const PersonalData = list({
  access: allowAll,
  graphql: {
    plural: 'PersonalDatas',
  },
  fields: {
    fullName: text(),
    // ID corto único para la clienta (código que se entrega a la clienta)
    clientCode: text({
      isIndexed: 'unique',
      db: { isNullable: true },
      ui: { description: 'ID corto de clienta (alfanumérico)' }
    }),
    phones: relationship({ ref: 'Phone.personalData', many: true }),
    addresses: relationship({ ref: 'Address.personalData', many: true }),
    birthDate: timestamp(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    employee: relationship({ ref: 'Employee.personalData' }),
    borrower: relationship({ ref: 'Borrower.personalData' }),
    // ✅ NUEVA FUNCIONALIDAD: Relación de préstamos donde esta persona actúa como collateral
    loansAsCollateral: relationship({ 
      ref: 'Loan.collaterals', 
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['requestedAmount', 'signDate'],
        linkToItem: true
      }
    }),
    // ✅ NUEVA FUNCIONALIDAD: Fotos de documentos personales
    documentPhotos: relationship({ 
      ref: 'DocumentPhoto.personalData', 
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['title', 'documentType', 'createdAt'],
        linkToItem: true
      }
    }),
  },
  ui: { isHidden: true },
  hooks: {
    beforeOperation: async ({ operation, resolvedData }) => {
      if ((operation === 'create' || operation === 'update') && resolvedData?.fullName) {
        const normalizeFullName = (name: string): string => {
          if (!name) return '';
          return name
            .replace(/\s+/g, ' ')
            .trim();
        };
        resolvedData.fullName = normalizeFullName(resolvedData.fullName as string);
      }
    },
    afterOperation: async (args) => {
      const { operation, item, context } = args as any;
      // Generar clientCode solo al crear, si no existe
      if (operation === 'create' && item && !item.clientCode) {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const length = 6;
        const generate = () => Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
        let attempts = 0;
        let code = generate();
        try {
          while (attempts < 5) {
            const existing = await (context.prisma as any).personalData.findUnique({ where: { clientCode: code } });
            if (!existing) break;
            code = generate();
            attempts++;
          }
          await (context.prisma as any).personalData.update({ where: { id: item.id }, data: { clientCode: code } });
        } catch (e) {
          console.error('Error generating clientCode:', e);
        }
      }
    }
  },
});

export const Loan = list({
  access: allowAll,
  ui: { isHidden: true },
  db: {
    idField: { kind: 'cuid' },
  },
  fields: {
    oldId: text({ db: { isNullable: true }, isIndexed: 'unique', isFilterable: true }),
    payments: relationship({
      ref: 'LoanPayment.loan',
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['amount'],
        inlineEdit: { fields: ['amount'] },
        linkToItem: true,
        inlineCreate: { fields: ['amount'] },
      },
    }),
    requestedAmount: decimal({
      precision: 10,
      scale: 2,
      validation: {
        isRequired: true,
      }
    }),
    amountGived: decimal({
      precision: 10,
      scale: 2,
      validation: {
        isRequired: true,
      }
    }),
    loantype: relationship({ ref: 'Loantype.loan' }),
    signDate: timestamp({ defaultValue: { kind: 'now' }, validation: { isRequired: true } }),
    badDebtDate: timestamp({ validation: { isRequired: false } }),
    isDeceased: checkbox({ defaultValue: false }),
    profitAmount: decimal(
      {
        precision: 10,
        scale: 2,
        validation: { isRequired: false },
      }),
    // ✅ NUEVA FUNCIONALIDAD: Relación many-to-many con PersonalData para collaterals
    collaterals: relationship({ 
      ref: 'PersonalData.loansAsCollateral', 
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['fullName', 'clientCode'],
        inlineConnect: true,
        linkToItem: true
      }
    }),
    grantor: relationship({ ref: 'Employee.loan' }),

    transactions: relationship({ ref: 'Transaction.loan', many: true }),
    lead: relationship({ ref: 'Employee.LeadManagedLoans' }),
    // Snapshot del líder que asignó el crédito (backup histórico)
    snapshotLeadId: text({ db: { isNullable: true } }),
    // Fecha cuando se asignó el líder original
    snapshotLeadAssignedAt: timestamp({ validation: { isRequired: false } }),
    borrower: relationship({
      ref: 'Borrower.loans',
    }),
    previousLoan: relationship({ ref: 'Loan' }), // Agrego esta línea
    commissionPayment: relationship({ ref: 'CommissionPayment.loan', many: true }),
    // ✅ NUEVA FUNCIONALIDAD: Fotos de documentos personales
    documentPhotos: relationship({ 
      ref: 'DocumentPhoto.loan', 
      many: true,
      ui: {
        displayMode: 'cards',
        cardFields: ['title', 'documentType', 'personalData'],
        linkToItem: true
      }
    }),

    // Campos persistentes para métricas
    totalDebtAcquired: decimal({ precision: 12, scale: 2, db: { isNullable: true } }),
    expectedWeeklyPayment: decimal({ precision: 12, scale: 2, db: { isNullable: true } }),
    totalPaid: decimal({ precision: 12, scale: 2, db: { isNullable: true } }),
    pendingAmountStored: decimal({ precision: 12, scale: 2, db: { isNullable: true } }),

    comissionAmount: decimal(),
    finishedDate: timestamp({ validation: { isRequired: false } }),
    // ✅ NUEVA COLUMNA: Fecha de renovación del préstamo
    renewedDate: timestamp({ validation: { isRequired: false }, db: { isNullable: true } }),
    updatedAt: timestamp(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    // ((deuda pendoiente * % del prestamo ) / 10 )+ 
    pendingProfitAmount: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const pendingProfit = await calculatePendingProfitAmount((item as { id: string }).id.toString());
          // Redondear a 2 decimales
          let roundedPendingProfit = Math.round((pendingProfit + Number.EPSILON) * 100) / 100;
          // Si el valor es muy cercano a cero, establecerlo explícitamente a cero
          if (roundedPendingProfit < 0.01) {
            roundedPendingProfit = 0;
          }
          return roundedPendingProfit;
        }
      }),
    }),
    earnedProfit: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const loan = await prisma.loan.findUnique({
            where: { id: (item as { id: string }).id.toString() },
          });
          if (loan) {
            const payments = await prisma.loanPayment.findMany({
              where: { loan: { id: { equals: (item as { id: string }).id.toString() } } },
              include: {
                transactions: true,
              }
            });
            let profitAmount = 0;
            profitAmount =  payments.reduce((sum, payment) => {
              const transactionProfit = payment.transactions.reduce((transactionSum, transaction) => {
                return transactionSum + parseFloat(transaction.profitAmount ? transaction.profitAmount.toString() : "0");
              }, 0);
              return sum + transactionProfit;
            }, 0);
            return parseFloat(profitAmount.toFixed(2));
          }
          return 0;
        },
      }),
    }),
    //virtual fields
    totalPayedAmount: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const payments = await context.db.LoanPayment.findMany({
            where: { loan: { id: { equals: (item as { id: string }).id } } },
          });
          return payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        },
      }),
    }),
    pendingAmount: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const payments = await context.db.LoanPayment.findMany({
            where: { loan: { id: { equals: (item as { id: string }).id } } },
          });
          const loan = await context.db.Loan.findOne({
            where: { id: (item as { id: string }).id.toString() },
          });
          const loanType = await context.db.Loantype.findOne({
            where: { id: loan?.loantypeId as string },
          });
          const rate = parseFloat(loanType.rate);
          const totalAmountToPay = parseFloat(loan.requestedAmount.toString()) * (1 + rate);
          const payedAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
          return (totalAmountToPay - payedAmount);
        },
      }),
    }),
    weeklyPaymentAmount: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const loan = await prisma.loan.findFirst({
            where: { id: (item as { id: string }).id.toString() },
            include: { loantype: true },
          }) as Loan | null;
          
          const loanType = loan?.loantype;
          if (loan && loanType && loanType.weekDuration > 0) {
            const rate = loanType.rate ? parseFloat(loanType.rate.toString()) : 0;
            const totalAmountToPay = loan.requestedAmount.toNumber() * (1 + rate);
            const amountGiven = loan.amountGived.toNumber();
            const totalProfit = amountGiven * rate;
            return totalAmountToPay / loanType.weekDuration;
          } else {

          }

        },
      }),
    }),
    amountToPay: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: async (item, args, context) => {
          const loan = await context.db.Loan.findOne({
            where: { id: (item as { id: string }).id.toString() },
          });
          const loanType = await context.db.Loantype.findOne({
            where: { id: loan?.loantypeId as string },
          });
          const rate = parseFloat(loanType.rate);
          const totalAmountToPay = loan.requestedAmount * (1 + rate);
          return totalAmountToPay;
        },
      }),
    }),
    status: select({
      options: [
        { label: 'ACTIVO', value: 'ACTIVE' },
        { label: 'FINALIZADO', value: 'FINISHED' },
        { label: 'RENOVADO', value: 'RENOVATED' },
        { label: 'CANCELADO', value: 'CANCELLED' },
      ],
    }),

    // Campos de tracking histórico para reportes precisos
    snapshotRouteId: text({
      label: 'Snapshot Route ID',
      ui: {
        description: 'ID de la ruta al momento de crear el préstamo (para reportes históricos)',
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      }
    }),
    snapshotRouteName: text({
      label: 'Snapshot Route Name',
      ui: {
        description: 'Nombre de la ruta al momento de crear el préstamo (para reportes históricos)',
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      }
    }),
    // Campo para marcar préstamos excluidos por limpieza de cartera
    excludedByCleanup: relationship({ 
      ref: 'PortfolioCleanup.loansExcluded',
      many: false,
      ui: {
        description: 'Limpieza de cartera que excluyó este préstamo',
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      }
    }),
  },
  hooks: {
    beforeOperation: async ({ operation, item, context, resolvedData }) => {
      // Capturar snapshot histórico - solo en create o cuando se cambie el lead
      const shouldCaptureSnapshot = operation === 'create' || 
        (operation === 'update' && resolvedData && resolvedData.lead);

      if (shouldCaptureSnapshot && resolvedData && resolvedData.lead) {
        try {
          const leadId = resolvedData.lead.connect?.id;

          if (leadId) {
            // Obtener información del lead y su ruta/localidad actual
            const leadData = await context.prisma.employee.findUnique({
              where: { id: leadId },
              include: {
                routes: true,
                personalData: {
                  include: {
                    addresses: {
                      include: {
                        location: {
                          include: {
                            route: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            });

            if (leadData?.personalData?.addresses?.[0]?.location) {
              const location = leadData.personalData.addresses[0].location;
              /* resolvedData.snapshotLocationId = location.id;
              resolvedData.snapshotLocationName = location.name; */
              
              if (location.route) {
                /* resolvedData.snapshotRouteId = location.route.id;
                resolvedData.snapshotRouteName = location.route.name; */
              }
            } else if (leadData?.routes) {
              // Fallback: usar la ruta del empleado directamente
              /* resolvedData.snapshotRouteId = leadData.routes.id;
              resolvedData.snapshotRouteName = leadData.routes.name; */
            }

            // Capturar snapshot del líder
            /* resolvedData.snapshotLeadId = leadId;
            resolvedData.snapshotLeadAssignedAt = new Date(); */

            console.log(`📊 Snapshot capturado para loan ${operation}: Lead ${leadId} → Ruta ${resolvedData.snapshotRouteName}, Localidad ${resolvedData.snapshotLocationName}`);
          }
        } catch (error) {
          console.error('Error capturing historical snapshot for loan:', error);
          // No fallar el préstamo si no se puede capturar el snapshot
        }
      }
      
      if (operation === 'delete') {
        // Guardar las transacciones asociadas antes de eliminar el préstamo
        const transactions = await context.prisma.transaction.findMany({
          where: {
            loanId: item.id.toString()
          }
        });
        // Almacenar las transacciones en el contexto para usarlas después
        (context as ExtendedContext).transactionsToDelete = transactions;
      }
    },
    afterOperation: async ({ operation, item, context, originalItem }) => {
      // Hook de auditoría global
      const auditHook = createAuditHook('Loan', 
        (item: any, operation: string) => {
          const loanData = item as any;
          const amount = loanData.requestedAmount || loanData.amountGived || 0;
          const clientName = loanData.borrower?.personalData?.fullName || loanData.borrower?.fullName || 'Cliente';
          const operationText = operation === 'CREATE' ? 'creado' : operation === 'UPDATE' ? 'actualizado' : 'eliminado';
          return `Préstamo ${operationText}: $${amount} para ${clientName}`;
        },
        (item: any) => {
          const loanData = item as any;
          return {
            loanType: loanData.loantype?.name,
            leadName: loanData.lead?.personalData?.fullName,
            clientName: loanData.borrower?.personalData?.fullName,
            amount: loanData.requestedAmount || loanData.amountGived
          };
        }
      );
      
      await auditHook.afterOperation({ operation, item, context, originalItem });

      if ((operation === 'create' || operation === 'update') && item) {
        const leadId: string = item.leadId as string;
        if (leadId === null || leadId === undefined) {
          return;
        }

        // OPTIMIZADO: Hacer consultas en paralelo
        const [loan, lead] = await Promise.all([
          prisma.loan.findFirst({
            where: { id: item.id.toString() },
            include: {
              loantype: true,
              previousLoan: true,
            }
          }),
          context.db.Employee.findOne({
            where: { id: leadId },
          })
        ]);

        const account = await context.prisma.account.findFirst({
          where: { 
            routeId: lead?.routesId,
            type: 'EMPLOYEE_CASH_FUND'
          },
        });

        if (operation === 'create') {
          // ULTRA OPTIMIZADO: Usar transacción de Prisma para atomicidad y velocidad
          if (!account) {
            throw new Error('Cuenta EMPLOYEE_CASH_FUND no encontrada');
          }

          const loanAmountNum = parseAmount(item.amountGived);
          const commissionAmountNum = parseAmount(item.comissionAmount);
          const currentAmount = parseFloat(account.amount.toString());
          const newAccountBalance = currentAmount - loanAmountNum - commissionAmountNum;
          
          // OPTIMIZADO: Cálculo rápido sin consultas adicionales
          const loanAmount = parseAmount(item.requestedAmount);
          const basicProfitAmount = loanAmount * 0.20; // Valor base, se refinará después

          // ULTRA OPTIMIZADO: Una sola transacción DB con todas las operaciones
          await prisma.$transaction([
            // Crear transacciones
            prisma.transaction.createMany({
              data: [
                {
                  amount: loanAmountNum.toString(),
                  date: new Date(item.signDate as string),
                  type: 'EXPENSE',
                  expenseSource: 'LOAN_GRANTED',
                  sourceAccountId: account.id,
                  loanId: item.id.toString(),
                  leadId: leadId
                },
                {
                  amount: commissionAmountNum.toString(),
                  date: new Date(item.signDate as string),
                  type: 'EXPENSE',
                  expenseSource: 'LOAN_GRANTED_COMISSION',
                  sourceAccountId: account.id,
                  loanId: item.id.toString(),
                  leadId: leadId
                }
              ]
            }),
            // Actualizar balance de cuenta
            prisma.account.update({
              where: { id: account.id },
              data: { amount: newAccountBalance.toString() }
            }),
            // Actualizar profit del préstamo (cálculo básico)
            prisma.loan.update({
              where: { id: item.id.toString() },
              data: { profitAmount: basicProfitAmount }
            })
          ]);

          // SI HAY UN PRÉSTAMO PREVIO, FINALIZARLO AL RENOVAR
          if (item.previousLoanId) {
            await context.prisma.loan.update({
              where: { id: item.previousLoanId as string },
              data: {
                status: 'RENOVATED',
                finishedDate: new Date(item.signDate as string)
              }
            });
          }

          // Recalcular métricas persistentes del préstamo recien creado/actualizado
          try {
            const loanMetrics = await context.prisma.loan.findUnique({ where: { id: item.id.toString() }, include: { loantype: true, payments: true } });
            if (loanMetrics) {
              const rate = parseFloat(loanMetrics.loantype?.rate?.toString() || '0');
              const requested = parseFloat(loanMetrics.requestedAmount.toString());
              const weekDuration = Number(loanMetrics.loantype?.weekDuration || 0);
              const totalDebt = requested * (1 + rate);
              const expectedWeekly = weekDuration > 0 ? (totalDebt / weekDuration) : 0;
              const totalPaid = (loanMetrics.payments || []).reduce((s: number, p: any) => s + parseFloat((p.amount || 0).toString()), 0);
              const pending = Math.max(0, totalDebt - totalPaid);
              await context.prisma.loan.update({
                where: { id: item.id.toString() },
                data: {
                  totalDebtAcquired: totalDebt.toFixed(2),
                  expectedWeeklyPayment: expectedWeekly.toFixed(2),
                  totalPaid: totalPaid.toFixed(2),
                  pendingAmountStored: pending.toFixed(2),
                }
              });
            }
          } catch (e) { console.error('Error recomputing loan metrics (create):', e); }

        } else if (operation === 'update') {
          // OPTIMIZADO: Obtener transacciones y calcular profit en paralelo
          const [existingTransactions, totalProfitAmount] = await Promise.all([
            context.db.Transaction.findMany({
              where: {
                loan: { id: { equals: item.id.toString() } },
                type: { equals: 'EXPENSE' },
                OR: [
                  { expenseSource: { equals: 'LOAN_GRANTED' } },
                  { expenseSource: { equals: 'LOAN_GRANTED_COMISSION' } }
                ]
              }
            }),
            calculateLoanProfitAmount(loan?.id as string)
          ]);

          // OPTIMIZADO: Preparar todas las actualizaciones
          const updateOperations = [];

          for (const transaction of existingTransactions) {
            if (transaction.expenseSource === 'LOAN_GRANTED') {
              updateOperations.push(
                context.db.Transaction.updateOne({
                  where: { id: transaction.id.toString() },
                  data: {
                    amount: parseAmount(item.amountGived).toString(),
                    date: item.signDate
                  }
                })
              );
            } else if (transaction.expenseSource === 'LOAN_GRANTED_COMISSION') {
              updateOperations.push(
                context.db.Transaction.updateOne({
                  where: { id: transaction.id.toString() },
                  data: {
                    amount: parseAmount(item.comissionAmount).toString(),
                    date: item.signDate
                  }
                })
              );
            }
          }

          // Actualizar balance de la cuenta
          if (account && account.amount) {
            const currentAmount = parseFloat(account.amount.toString());
            const oldAmount = parseAmount(originalItem?.amountGived);
            const oldCommission = parseAmount(originalItem?.comissionAmount);
            const newAmount = parseAmount(item.amountGived);
            const newCommission = parseAmount(item.comissionAmount);
            
            const oldTotal = oldAmount + oldCommission;
            const newTotal = newAmount + newCommission;
            const balanceChange = oldTotal - newTotal;
            const updatedAmount = currentAmount + balanceChange;
            
            updateOperations.push(
              context.db.Account.updateOne({
                where: { id: account.id },
                data: { amount: updatedAmount.toString() }
              })
            );
          }

          // Actualizar profitAmount
          updateOperations.push(
            prisma.loan.update({
              where: { id: item.id.toString() },
              data: { profitAmount: totalProfitAmount },
            })
          );

          // OPTIMIZADO: Ejecutar todas las actualizaciones en paralelo
          await Promise.all(updateOperations);

          // Recalcular métricas persistentes del préstamo tras update
          try {
            const loanMetrics = await context.prisma.loan.findUnique({ where: { id: item.id.toString() }, include: { loantype: true, payments: true } });
            if (loanMetrics) {
              const rate = parseFloat(loanMetrics.loantype?.rate?.toString() || '0');
              const requested = parseFloat(loanMetrics.requestedAmount.toString());
              const weekDuration = Number(loanMetrics.loantype?.weekDuration || 0);
              const totalDebt = requested * (1 + rate);
              const expectedWeekly = weekDuration > 0 ? (totalDebt / weekDuration) : 0;
              const totalPaid = (loanMetrics.payments || []).reduce((s: number, p: any) => s + parseFloat((p.amount || 0).toString()), 0);
              const pending = Math.max(0, totalDebt - totalPaid);
              await context.prisma.loan.update({
                where: { id: item.id.toString() },
                data: {
                  totalDebtAcquired: totalDebt.toFixed(2),
                  expectedWeeklyPayment: expectedWeekly.toFixed(2),
                  totalPaid: totalPaid.toFixed(2),
                  pendingAmountStored: pending.toFixed(2),
                }
              });
            }
          } catch (e) { console.error('Error recomputing loan metrics (update):', e); }
        }

        if (originalItem && originalItem.loantypeId !== item.loantypeId) {
          const payments = await context.db.LoanPayment.findMany({
            where: { loan: { id: { equals: item.id.toString() } } },
          });

          for (const payment of payments) {
            await context.db.LoanPayment.updateOne({
              where: { id: payment.id as string },
              data: { updatedAt: new Date() },
            });
          }
        }
      } else if (operation === 'delete' && originalItem) {
        try {
          // Obtener el lead y la cuenta asociada
          const lead = await context.db.Employee.findOne({
            where: { id: originalItem.leadId as string },
          });

          const account = await context.prisma.account.findFirst({
            where: { 
              routes: {
                some: {
                  id: lead?.routesId
                }
              },
              type: 'EMPLOYEE_CASH_FUND'
            },
          });

          // Eliminar todas las transacciones asociadas al préstamo
          const transactionsToDelete = (context as ExtendedContext).transactionsToDelete || [];

          for (const transaction of transactionsToDelete) {
            await context.db.Transaction.deleteOne({
              where: { id: transaction.id }
            });
          }

          // SI HAY UN PRÉSTAMO PREVIO, REACTIVARLO
          if (originalItem.previousLoanId) {
            await context.prisma.loan.update({
              where: { id: originalItem.previousLoanId as string },
              data: {
                status: 'ACTIVE',
                finishedDate: null
              }
            });
          }

          // Actualizar balance de la cuenta
            if (account) {
              const currentAmount = parseFloat(account.amount?.toString() || '0');
              const loanAmount = parseFloat(originalItem.amountGived?.toString() || '0');
              const commissionAmount = parseFloat(originalItem.comissionAmount?.toString() || '0');
              const totalAmount = loanAmount + commissionAmount;
              
              const updatedAmount = currentAmount + totalAmount;

                          // Actualizar el balance usando prisma directamente
              await context.prisma.account.update({
                where: { id: account.id },
                data: { amount: updatedAmount.toString() }
              });
            }
        } catch (error) {
          console.error('Error al eliminar transacciones asociadas al préstamo:', error);
          throw error;
        }
      }
    },
  },
  
});

/* export const Profit = list({
  access: allowAll,
  fields: {
    amount: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }),
    returnToCapital: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }),
    loan: relationship({ ref: 'Loan.profit' }),
    loanPayment: relationship({ ref: 'LoanPayment.profit' }),
  },
});
 */
export const LoanPayment = list({
  access: {
    operation: {
      query: () => true,
      create: () => true,
      update: () => true,
      delete: () => true,
    },
  },
  ui: { isHidden: true },
  fields: {
    amount: decimal({
      precision: 10,
      scale: 2,
    }),
    comission: decimal(),
    /* profitAmount: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }), */
    /* returnToCapital: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }), */
    receivedAt: timestamp({ defaultValue: { kind: 'now' } }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    oldLoanId: text({ db: { isNullable: true } }),
    loan: relationship({ 
      ref: 'Loan.payments'
    }),
    //collector: relationship({ ref: 'Employee.loanPayment' }),
    transactions: relationship({ ref: 'Transaction.loanPayment', many: true }),
    //transactionId: text({ isIndexed: 'unique' }),
    type: select({
      options: [
        { label: 'ABONO', value: 'PAYMENT' },
        { label: 'EXTRA COBRANZA', value: 'EXTRA_COLLECTION' },
      ],
    }),
    leadPaymentReceived: relationship({ ref: 'LeadPaymentReceived.payments' }),
    paymentMethod: select({
      options: [
        { label: 'EFECTIVO', value: 'CASH' },
        { label: 'TRANSFERENCIA', value: 'MONEY_TRANSFER' },
      ],
    }),
    /* profit: relationship({ ref: 'Profit.loanPayment' }), */
  },
  hooks: {
    afterOperation: async (args) => {
      const { operation, item, context, resolvedData } = args;

      // ✅ SKIP: Si el hook está desactivado por updateCustomLeadPaymentReceived
      if ((context as any).skipLoanPaymentHooks) {
        console.log('🚫 SKIP: Hook de LoanPayment desactivado para evitar doble contabilidad');
        return;
      }

      if (operation === 'create' || operation === 'update') {
        try {
          
          const loan = await context.db.Loan.findOne({
            where: { id: item.loanId as string },
          });

          const leadPaymentReceived = await context.db.LeadPaymentReceived.findOne({
            where: { id: item.leadPaymentReceivedId as string },
          });

          if (!loan || !leadPaymentReceived) {
            throw new Error('No se encontró el préstamo o el pago recibido');
          }

          const lead = await context.db.Employee.findOne({
            where: { id: leadPaymentReceived.leadId as string },
          });

          if (!lead) {
            throw new Error('No se encontró el lead');
          }

          // Obtener el tipo de préstamo
          const loanType = await context.db.Loantype.findOne({
            where: { id: loan.loantypeId as string },
          });

          if (!loanType) {
            throw new Error('No se encontró el tipo de préstamo');
          }

          // Calcular montos
          const amount = parseFloat((item.amount as { toString(): string }).toString());
          const comission = parseFloat((item.comission as { toString(): string }).toString());
          const loanTypeData = loanType as unknown as { 
            rate: { toString(): string },
            weekDuration: { toString(): string }
          };
          const loanData = loan as unknown as { 
            amountGived: { toString(): string }
          };
          const rate = parseFloat(loanTypeData.rate.toString());
          const weekDuration = parseInt(loanTypeData.weekDuration.toString());
          const loanAmount = parseFloat(loanData.amountGived.toString());

          const profitAmount = (amount * (rate / 100)) / weekDuration;
          const returnToCapital = amount - profitAmount;

          // Buscar transacciones existentes - usamos findMany por si hay más de una
          const existingTransactions = await context.prisma.transaction.findMany({
            where: { 
              loanPaymentId: item.id.toString()
            },
          });

          // Crear o actualizar transacción según el método de pago
          const getDecimalString = (value: unknown): string => {
            if (typeof value === 'object' && value !== null && 'toString' in value) {
              return (value as { toString(): string }).toString();
            }
            if (typeof value === 'number') {
              return value.toFixed(2);
            }
            return '0.00';
          };

          const baseTransactionData = {
            amount: getDecimalString(item.amount),
            date: new Date(item.receivedAt as string),
            profitAmount: getDecimalString(profitAmount),
            returnToCapital: getDecimalString(returnToCapital),
          };

          if (existingTransactions.length > 0) {
            // Actualizar transacción existente
            await context.prisma.transaction.update({
              where: { id: existingTransactions[0].id },
              data: {
                ...baseTransactionData,
                type: 'INCOME',
                incomeSource: item.paymentMethod === 'CASH' ? 'CASH_LOAN_PAYMENT' : 'BANK_LOAN_PAYMENT',
              },
            });
          } else {
            // Crear nueva transacción usando prisma directamente
            
            await context.prisma.transaction.create({
              data: {
                ...baseTransactionData,
                type: 'INCOME',
                incomeSource: item.paymentMethod === 'CASH' ? 'CASH_LOAN_PAYMENT' : 'BANK_LOAN_PAYMENT',
                loanPaymentId: item.id.toString(),
                loanId: loan.id.toString(),
                leadId: lead.id.toString(),
              },
            });
          }

          // 🆕 CREAR TRANSACCIÓN DE COMISIÓN POR RECIBIR PAGO
          const commissionAmount = parseFloat((item.comission as { toString(): string }).toString());
          
          if (commissionAmount > 0) {
            // Buscar transacción de comisión existente
            const existingCommissionTransaction = await context.prisma.transaction.findFirst({
              where: { 
                loanPaymentId: item.id.toString(),
                type: 'EXPENSE',
                expenseSource: 'LOAN_PAYMENT_COMISSION'
              },
            });

            const commissionTransactionData = {
              amount: commissionAmount.toString(),
              date: new Date(item.receivedAt as string),
              type: 'EXPENSE',
              expenseSource: 'LOAN_PAYMENT_COMISSION',
              loanPaymentId: item.id.toString(),
              loanId: loan.id.toString(),
              leadId: lead.id.toString(),
            };

            if (existingCommissionTransaction) {
              // Actualizar transacción de comisión existente
              await context.prisma.transaction.update({
                where: { id: existingCommissionTransaction.id },
                data: commissionTransactionData,
              });
            } else {
              // Crear nueva transacción de comisión
              await context.prisma.transaction.create({
                data: commissionTransactionData,
              });
            }
          }

          // Actualizar balance de la cuenta según el método de pago
          const accountType = item.paymentMethod === 'CASH' ? 'CASH' : 'BANK';
          
          const accounts = await context.prisma.account.findMany({
            where: { 
              type: accountType
            },
          });
          
          const account = accounts[0];
          if (account) {
            const currentAmount = parseFloat(account.amount.toString());
            const transactionAmount = parseFloat((item.amount as { toString(): string }).toString());
            
            // Si es una actualización, necesitamos considerar el monto anterior
            let balanceChange = transactionAmount;
            if (operation === 'update' && args.originalItem) {
              const oldAmount = parseFloat((args.originalItem.amount as { toString(): string }).toString());
              balanceChange = transactionAmount - oldAmount;
            }

            const updatedAmount = currentAmount + balanceChange;
            
            // Usar prisma directamente para actualizar la cuenta
            await context.prisma.account.update({
              where: { id: account.id },
              data: { amount: updatedAmount.toString() }
            });
          }
        } catch (error) {
          console.error('Error en hook afterOperation de LoanPayment:', error);
          throw error;
        }
      }
      
      // Recalcular campos persistentes en Loan asociado
      const recomputeLoanMetrics = async (loanId: string) => {
        try {
          const loan = await context.prisma.loan.findUnique({ where: { id: loanId }, include: { loantype: true, payments: true } });
          if (!loan) return;
          const rate = parseFloat(loan.loantype?.rate?.toString() || '0');
          const requested = parseFloat(loan.requestedAmount.toString());
          const weekDuration = Number(loan.loantype?.weekDuration || 0);
          const totalDebt = requested * (1 + rate);
          const expectedWeekly = weekDuration > 0 ? (totalDebt / weekDuration) : 0;
          const totalPaid = (loan.payments || []).reduce((s: number, p: any) => s + parseFloat((p.amount || 0).toString()), 0);
          const pending = Math.max(0, totalDebt - totalPaid);
          
          // Verificar si el préstamo está completado
          const isCompleted = totalPaid >= totalDebt;
          
          // Obtener la fecha del último pago para usar como fecha de finalización
          const lastPayment = loan.payments && loan.payments.length > 0 
            ? loan.payments.reduce((latest: any, current: any) => {
                const latestDate = new Date(latest.receivedAt || latest.createdAt);
                const currentDate = new Date(current.receivedAt || current.createdAt);
                return currentDate > latestDate ? current : latest;
              })
            : null;
          
          const finishDate = isCompleted && lastPayment 
            ? new Date(lastPayment.receivedAt || lastPayment.createdAt)
            : null;
          
          await context.prisma.loan.update({
            where: { id: loanId },
            data: {
              totalDebtAcquired: totalDebt.toFixed(2),
              expectedWeeklyPayment: expectedWeekly.toFixed(2),
              totalPaid: totalPaid.toFixed(2),
              pendingAmountStored: pending.toFixed(2),
              ...(isCompleted && finishDate && { finishedDate: finishDate })
            }
          });
        } catch (e) {
          console.error('Error recomputing loan metrics:', e);
        }
      };

      try {
        if (operation === 'create' && item?.loanId) {
          await recomputeLoanMetrics(item.loanId as string);
        } else if (operation === 'update' && item?.loanId) {
          await recomputeLoanMetrics(item.loanId as string);
        } else if (operation === 'delete' && (args as any).originalItem?.loanId) {
          await recomputeLoanMetrics((args as any).originalItem.loanId as string);
        }
      } catch {}

      // Hook de auditoría global para LoanPayment
      const auditHook = createAuditHook('LoanPayment', 
        (item: any, operation: string) => {
          const paymentData = item as any;
          const amount = paymentData.amount || 0;
          const type = paymentData.type || 'UNKNOWN';
          const method = paymentData.paymentMethod || 'UNKNOWN';
          const operationText = operation === 'CREATE' ? 'creado' : operation === 'UPDATE' ? 'actualizado' : 'eliminado';
          return `Pago de préstamo ${operationText}: $${amount} - ${type} (${method})`;
        },
        (item: any) => {
          const paymentData = item as any;
          return {
            type: paymentData.type,
            paymentMethod: paymentData.paymentMethod,
            amount: paymentData.amount,
            loanId: paymentData.loanId
          };
        }
      );
      
      await auditHook.afterOperation({ operation, item, context, originalItem: args.originalItem });
    },
  },
});

export const Transaction = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    amount: decimal(),
    date: timestamp({ defaultValue: { kind: 'now' } }),
    type: select({
      options: [
        { label: 'INCOME', value: 'INCOME' },
        { label: 'EXPENSE', value: 'EXPENSE' },
        { label: 'TRANSFER', value: 'TRANSFER' },
        { label: 'INVESTMENT', value: 'INVESTMENT' },
      ],
    }),
    incomeSource: select({
      options: [
        { label: 'CASH_LOAN_PAYMENT', value: 'CASH_LOAN_PAYMENT' },
        { label: 'BANK_LOAN_PAYMENT', value: 'BANK_LOAN_PAYMENT' },
        { label: 'MONEY_INVESMENT', value: 'MONEY_INVESMENT' },
        { label: 'Compensación por Falco', value: 'FALCO_COMPENSATION' },
      ],
    }),
    expenseSource: select({
      options: [
        { label: 'VIATIC', value: 'VIATIC' },
        { label: 'Gasolina', value: 'GASOLINE' },
        { label: 'Hospedaje', value: 'ACCOMMODATION' },
        { label: 'Nómina', value: 'NOMINA_SALARY' },
        { label: 'Salario Externo', value: 'EXTERNAL_SALARY' },
        { label: 'Mantenimiento de Vehículo', value: 'VEHICULE_MAINTENANCE' },
        { label: 'Préstamo Otorgado', value: 'LOAN_GRANTED' },
        { label: 'Comisión de Pago de Préstamo', value: 'LOAN_PAYMENT_COMISSION' },
        { label: 'Comisión de Otorgamiento de Préstamo', value: 'LOAN_GRANTED_COMISSION' },
        { label: 'Comisión de Líder', value: 'LEAD_COMISSION' },
        { label: 'Gasto de Líder', value: 'LEAD_EXPENSE' },
        { label: 'Pérdida por Falco', value: 'FALCO_LOSS' },
        { label: 'Lavado de Auto', value: 'LAVADO_DE_AUTO' },
        { label: 'Caseta', value: 'CASETA' },
        { label: 'Papelería', value: 'PAPELERIA' },
        { label: 'Renta', value: 'HOUSE_RENT' },
        { label: 'IMSS/INFONAVIT', value: 'IMSS_INFONAVIT' },
        { label: 'Pago de Mensualidad de Auto', value: 'CAR_PAYMENT' },
        { label: 'Otro', value: 'OTRO' }
      ],
    }),
    description: text(),
    // Identificador de grupo para gastos distribuidos entre varias rutas
    expenseGroupId: text({ ui: { description: 'Agrupa transacciones del mismo gasto distribuido' } }),
    route: relationship({ ref: 'Route.transactions' }),
    lead: relationship({ ref: 'Employee.transactions' }),
    snapshotLeadId: text(),
    snapshotRouteId: text(),
    // Nota: los campos de snapshotLocation/Route se desactivan para evitar errores de Prisma
    sourceAccount: relationship({ ref: 'Account.transactions' }),
    destinationAccount: relationship({ ref: 'Account.receivedTransactions' }),
    loan: relationship({ ref: 'Loan.transactions' }),
    loanPayment: relationship({ ref: 'LoanPayment.transactions' }),
    leadPaymentReceived: relationship({ ref: 'LeadPaymentReceived.transactions' }),
    profitAmount: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }),
    returnToCapital: decimal({
      precision: 10,
      scale: 2,
      defaultValue: "0",
    }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
  },
  hooks: {
    beforeOperation: async ({ operation, resolvedData, context }) => {
      // Capturar snapshot histórico - solo en create o cuando se cambie el lead
      const shouldCaptureSnapshot = operation === 'create' || 
        (operation === 'update' && resolvedData.lead);

      if (shouldCaptureSnapshot && resolvedData.lead) {
        try {
          const leadId = resolvedData.lead.connect?.id;

          if (leadId) {
            // Obtener información del lead y su ruta/localidad actual
            const leadData = await context.prisma.employee.findUnique({
              where: { id: leadId },
              include: {
                routes: true,
                personalData: {
                  include: {
                    addresses: {
                      include: {
                        location: {
                          include: {
                            route: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            });

            // Desactivado: no escribir campos de snapshot inexistentes en Prisma

            console.log(`📊 Snapshot capturado para ${operation}: Lead ${leadId} → Ruta ${resolvedData.snapshotRouteName}, Localidad ${resolvedData.snapshotLocationName}`);
          }
        } catch (error) {
          console.error('Error capturing historical snapshot:', error);
          // No fallar la transacción si no se puede capturar el snapshot
        }
      }
    },
    afterOperation: async ({ operation, item, context, originalItem }) => {
      try {
        if (operation === 'create') {
          if (!item) {
            return;
          }

          const transactionItem = item as unknown as TransactionItem;

          // Si es una transacción de pago de préstamo o de préstamo otorgado, no procesar aquí
          // ya que estas se manejan en sus respectivos hooks
          if ((transactionItem.type === 'INCOME' && 
              (transactionItem.incomeSource === 'BANK_LOAN_PAYMENT' || 
               transactionItem.incomeSource === 'CASH_LOAN_PAYMENT')) ||
              (transactionItem.type === 'EXPENSE' && 
              (transactionItem.expenseSource === 'LOAN_GRANTED' || 
               transactionItem.expenseSource === 'LOAN_GRANTED_COMISSION' ||
               transactionItem.expenseSource === 'LOAN_PAYMENT_COMISSION')
              )) {
            return;
          }

          let sourceAccount = null;
          let destinationAccount = null;

          if (transactionItem.sourceAccountId) {
            sourceAccount = await context.prisma.account.findUnique({
              where: { id: transactionItem.sourceAccountId.toString() }
            });
          }

          if (transactionItem.destinationAccountId) {
            destinationAccount = await context.prisma.account.findUnique({
              where: { id: transactionItem.destinationAccountId.toString() }
            });
          }

          const transactionAmount = parseAmount(transactionItem.amount);

          // Aplicar el nuevo efecto en la cuenta origen
          if (sourceAccount && (transactionItem.type === 'EXPENSE' || transactionItem.type === 'TRANSFER')) {
            const currentAmount = parseAmount(sourceAccount.amount);
            const newAmount = parseFloat((currentAmount - transactionAmount).toFixed(2));
            
            if (newAmount < 0) {
              throw new Error(`La operación resultaría en un balance negativo: ${newAmount}`);
            }

            await context.prisma.account.update({
              where: { id: sourceAccount.id },
              data: { amount: newAmount.toString() }
            });
          }

          // Aplicar el nuevo efecto en la cuenta destino
          if (destinationAccount && (transactionItem.type === 'INCOME' || transactionItem.type === 'TRANSFER')) {
            const currentAmount = parseAmount(destinationAccount.amount);
            const newAmount = parseFloat((currentAmount + transactionAmount).toFixed(2));
            
            await context.prisma.account.update({
              where: { id: destinationAccount.id },
              data: { amount: newAmount.toString() }
            });
          }
        }
        else if (operation === 'update') {
          if (!item || !originalItem) {
            return;
          }

          const transactionItem = item as unknown as TransactionItem;
          const originalTransaction = originalItem as unknown as TransactionItem;

          // Si es una transacción de pago de préstamo o de préstamo otorgado, no procesar aquí
          // ya que estas se manejan en sus respectivos hooks
          if ((transactionItem.type === 'INCOME' && 
              (transactionItem.incomeSource === 'BANK_LOAN_PAYMENT' || 
               transactionItem.incomeSource === 'CASH_LOAN_PAYMENT')) ||
              (transactionItem.type === 'EXPENSE' && 
              (transactionItem.expenseSource === 'LOAN_GRANTED' || 
               transactionItem.expenseSource === 'LOAN_GRANTED_COMISSION' ||
               transactionItem.expenseSource === 'LOAN_PAYMENT_COMISSION'
              ))) {
            return;
          }

          // Obtener cuentas originales
          let originalSourceAccount = null;
          let originalDestinationAccount = null;

          if (originalTransaction.sourceAccountId) {
            originalSourceAccount = await context.prisma.account.findUnique({
              where: { id: originalTransaction.sourceAccountId.toString() }
            });
          }

          if (originalTransaction.destinationAccountId) {
            originalDestinationAccount = await context.prisma.account.findUnique({
              where: { id: originalTransaction.destinationAccountId.toString() }
            });
          }

          // Obtener cuentas nuevas
          let newSourceAccount = null;
          let newDestinationAccount = null;

          if (transactionItem.sourceAccountId) {
            newSourceAccount = await context.prisma.account.findUnique({
              where: { id: transactionItem.sourceAccountId.toString() }
            });
          }

          if (transactionItem.destinationAccountId) {
            newDestinationAccount = await context.prisma.account.findUnique({
              where: { id: transactionItem.destinationAccountId.toString() }
            });
          }

          const originalAmount = parseAmount(originalTransaction.amount);
          const newAmount = parseAmount(transactionItem.amount);

          // Calcular la diferencia para aplicar solo el cambio neto
          const amountDifference = newAmount - originalAmount;

          // Solo procesar si hay diferencia en el monto
          if (amountDifference !== 0) {
            // Aplicar diferencia en cuenta origen (para EXPENSE y TRANSFER)
            if (newSourceAccount && (transactionItem.type === 'EXPENSE' || transactionItem.type === 'TRANSFER')) {
              const currentAmount = parseAmount(newSourceAccount.amount);
              const finalAmount = parseFloat((currentAmount - amountDifference).toFixed(2));
              
              if (finalAmount < 0) {
                throw new Error(`La operación resultaría en un balance negativo: ${finalAmount}`);
              }

              await context.prisma.account.update({
                where: { id: newSourceAccount.id },
                data: { amount: finalAmount.toString() }
              });
            }

            // Aplicar diferencia en cuenta destino (para INCOME y TRANSFER)
            if (newDestinationAccount && (transactionItem.type === 'INCOME' || transactionItem.type === 'TRANSFER')) {
              const currentAmount = parseAmount(newDestinationAccount.amount);
              const finalAmount = parseFloat((currentAmount + amountDifference).toFixed(2));
              
              await context.prisma.account.update({
                where: { id: newDestinationAccount.id },
                data: { amount: finalAmount.toString() }
              });
            }
          }
        }
        else if (operation === 'delete') {
          if (!originalItem) {
            return;
          }

          const originalTransaction = originalItem as unknown as TransactionItem;

          // Si es una transacción de pago de préstamo o de préstamo otorgado, no procesar aquí
          // ya que estas se manejan en sus respectivos hooks
          if ((originalTransaction.type === 'INCOME' && 
              (originalTransaction.incomeSource === 'BANK_LOAN_PAYMENT' || 
               originalTransaction.incomeSource === 'CASH_LOAN_PAYMENT')) ||
              (originalTransaction.type === 'EXPENSE' && 
              (originalTransaction.expenseSource === 'LOAN_GRANTED' || 
               originalTransaction.expenseSource === 'LOAN_GRANTED_COMISSION'))) {
            return;
          }

          // Obtener cuentas de la transacción eliminada
          let originalSourceAccount = null;
          let originalDestinationAccount = null;

          if (originalTransaction.sourceAccountId) {
            originalSourceAccount = await context.prisma.account.findUnique({
              where: { id: originalTransaction.sourceAccountId.toString() }
            });
          }

          if (originalTransaction.destinationAccountId) {
            originalDestinationAccount = await context.prisma.account.findUnique({
              where: { id: originalTransaction.destinationAccountId.toString() }
            });
          }

          const originalAmount = parseAmount(originalTransaction.amount);

          // Revertir el efecto de la transacción eliminada

          // Para gastos y transferencias: devolver dinero a la cuenta origen
          if (originalSourceAccount && (originalTransaction.type === 'EXPENSE' || originalTransaction.type === 'TRANSFER')) {
            const currentAmount = parseAmount(originalSourceAccount.amount);
            const revertedAmount = parseFloat((currentAmount + originalAmount).toFixed(2)); // Sumar porque había sido restado
            
            await context.prisma.account.update({
              where: { id: originalSourceAccount.id },
              data: { amount: revertedAmount.toString() }
            });
          }

          // Para ingresos y transferencias: quitar dinero de la cuenta destino
          if (originalDestinationAccount && (originalTransaction.type === 'INCOME' || originalTransaction.type === 'TRANSFER')) {
            const currentAmount = parseAmount(originalDestinationAccount.amount);
            const revertedAmount = parseFloat((currentAmount - originalAmount).toFixed(2)); // Restar porque había sido sumado
            
            // Validar que no quede en negativo
            if (revertedAmount < 0) {
              throw new Error(`No se puede eliminar la transacción: resultaría en un balance negativo (${revertedAmount})`);
            }
            
            await context.prisma.account.update({
              where: { id: originalDestinationAccount.id },
              data: { amount: revertedAmount.toString() }
            });
          }
        }
        
        // Hook de auditoría global para Transaction
        const auditHook = createAuditHook('Transaction', 
          (item: any, operation: string) => {
            const transactionData = item as any;
            const amount = transactionData.amount || 0;
            const type = transactionData.type || 'UNKNOWN';
            const source = transactionData.incomeSource || transactionData.expenseSource || '';
            const operationText = operation === 'CREATE' ? 'creada' : operation === 'UPDATE' ? 'actualizada' : 'eliminada';
            return `Transacción ${operationText}: $${amount} - ${type} ${source}`;
          },
          (item: any) => {
            const transactionData = item as any;
            return {
              type: transactionData.type,
              source: transactionData.incomeSource || transactionData.expenseSource,
              description: transactionData.description,
              amount: transactionData.amount
            };
          }
        );
        
        await auditHook.afterOperation({ operation, item, context, originalItem });
      } catch (error) {
        console.error('Error en afterOperation de Transaction:', error);
        throw error;
      }
    }
  }
});

export const CommissionPayment = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    amount: decimal(),
    loan: relationship({ ref: 'Loan.commissionPayment' }),
    employee: relationship({ ref: 'Employee.commissionPayment' }),
  },
});


export const LeadPaymentType = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    type: select({
      options: [
        { label: 'PENDING_MONEY', value: 'PENDING_MONEY' },
        { label: 'COMPENSATORY_PENDING_MONEY', value: 'COMPENSATORY_PENDING_MONEY' },
      ],
    }),
  },
});

export const FalcoCompensatoryPayment = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    amount: decimal(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    leadPaymentReceived: relationship({ ref: 'LeadPaymentReceived.falcoCompensatoryPayments' }),
  },
  hooks: {
    afterOperation: async ({ operation, item, context, originalItem }) => {
      if (operation === 'create' && item && item.leadPaymentReceivedId) {
        try {
          // Obtener el LeadPaymentReceived relacionado
          const leadPaymentReceived = await context.prisma.leadPaymentReceived.findUnique({
            where: { id: item.leadPaymentReceivedId },
            include: {
              falcoCompensatoryPayments: true,
              agent: {
                include: {
                  routes: {
                    include: {
                      accounts: {
                        where: {
                          type: { in: ['EMPLOYEE_CASH_FUND', 'BANK'] }
                        }
                      }
                    }
                  }
                }
              }
            }
          });

          if (!leadPaymentReceived) return;

          // Calcular el total compensado
          const totalCompensated = leadPaymentReceived.falcoCompensatoryPayments?.reduce(
            (sum: number, comp: any) => sum + parseFloat(comp.amount?.toString() || '0'), 0
          ) || 0;

          const originalFalcoAmount = parseFloat(leadPaymentReceived.falcoAmount?.toString() || '0');
          const remainingFalcoAmount = Math.max(0, originalFalcoAmount - totalCompensated);

          // Obtener cuentas del agente desde la ruta
          const agentAccounts = leadPaymentReceived.agent?.routes?.accounts || [];
          const cashAccount = agentAccounts.find((account: any) => account.type === 'EMPLOYEE_CASH_FUND');

          if (!cashAccount) {
            console.error('No se encontró cuenta de efectivo para el agente en su ruta');
            return;
          }

          // Buscar la transacción de pérdida por falco
          const falcoLossTransaction = await context.prisma.transaction.findFirst({
            where: {
              leadPaymentReceivedId: item.leadPaymentReceivedId,
              type: 'EXPENSE',
              expenseSource: 'FALCO_LOSS'
            }
          });

          if (falcoLossTransaction) {
            // La cantidad compensada actual (solo este abono)
            const compensatedAmount = parseFloat(item.amount?.toString() || '0');
            
            // NUEVA LÓGICA: En lugar de crear INCOME, reducir directamente la pérdida original
            const newLossAmount = Math.max(0, originalFalcoAmount - totalCompensated);
            
            if (remainingFalcoAmount <= 0) {
              // Falco completamente pagado - reducir la transacción original a 0
              await context.prisma.transaction.update({
                where: { id: falcoLossTransaction.id },
                data: {
                  amount: '0.00',
                  description: `Pérdida por falco - COMPLETAMENTE COMPENSADO - Original: $${originalFalcoAmount} - ${leadPaymentReceived.id}`,
                }
              });

              console.log(`✅ Falco completamente pagado. Pérdida original cancelada: $${originalFalcoAmount} → $0.00`);
            } else {
              // Falco parcialmente pagado - reducir proporcionalmente la pérdida
              await context.prisma.transaction.update({
                where: { id: falcoLossTransaction.id },
                data: {
                  amount: newLossAmount.toFixed(2),
                  description: `Pérdida por falco - PARCIALMENTE COMPENSADO - Original: $${originalFalcoAmount}, Restante: $${newLossAmount.toFixed(2)} - ${leadPaymentReceived.id}`,
                }
              });
              
              console.log(`✅ Falco parcialmente pagado. Pérdida reducida: $${originalFalcoAmount} → $${newLossAmount.toFixed(2)}`);
            }

            // Devolver la cantidad compensada a la cuenta de efectivo
            const currentCashAmount = parseFloat(cashAccount.amount?.toString() || '0');
            await context.prisma.account.update({
              where: { id: cashAccount.id },
              data: { amount: (currentCashAmount + compensatedAmount).toString() }
            });

            console.log(`💰 Dinero devuelto a la cuenta: $${compensatedAmount}. Nuevo balance: $${(currentCashAmount + compensatedAmount).toFixed(2)}`);
          }

          // Actualizar el estado del LeadPaymentReceived si está completamente compensado
          if (remainingFalcoAmount <= 0) {
            const totalPaidAmount = parseFloat(leadPaymentReceived.paidAmount?.toString() || '0');
            const expectedAmount = parseFloat(leadPaymentReceived.expectedAmount?.toString() || '0');
            
            await context.prisma.leadPaymentReceived.update({
              where: { id: leadPaymentReceived.id },
              data: {
                paymentStatus: totalPaidAmount >= expectedAmount ? 'COMPLETE' : 'PARTIAL',
                falcoAmount: '0.00'
              }
            });
          }

        } catch (error) {
          console.error('Error en hook de FalcoCompensatoryPayment:', error);
        }
      }
    }
  }
});

export const LeadPaymentReceived = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    expectedAmount: decimal(),
    paidAmount: decimal(),
    cashPaidAmount: decimal(),
    bankPaidAmount: decimal(), // If bank amount > than 0. Then remove that amount from the cashAccount balance and inser it into the bankAccount balance
    falcoAmount: decimal(),
    paymentStatus: select({
      options: [
        { label: 'COMPLETO', value: 'COMPLETE' },
        { label: 'PARCIAL', value: 'PARTIAL' },
      ],
    }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    agent: relationship({ ref: 'Employee.leadPaymentsReceivedAgent' }),
    lead: relationship({ ref: 'Employee.LeadPaymentReceivedLead' }),
    falcoCompensatoryPayments: relationship({ ref: 'FalcoCompensatoryPayment.leadPaymentReceived', many: true }),
    payments: relationship({ ref: 'LoanPayment.leadPaymentReceived', many: true }),
    transactions: relationship({ ref: 'Transaction.leadPaymentReceived', many: true }),
  },
  
});

export const PortfolioCleanup = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    name: text({ validation: { isRequired: true } }),
    description: text(),
    cleanupDate: timestamp({ validation: { isRequired: true } }),
    fromDate: timestamp(),
    toDate: timestamp(),
    excludedLoansCount: integer(),
    excludedAmount: decimal(),
    route: relationship({ ref: 'Route.portfolioCleanups' }),
    executedBy: relationship({ ref: 'User.portfolioCleanups' }),
    loansExcluded: relationship({ 
      ref: 'Loan.excludedByCleanup', 
      many: true,
      ui: {
        description: 'Préstamos excluidos por esta limpieza de cartera',
        displayMode: 'count'
      }
    }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
  },
  
  hooks: {
    afterOperation: async ({ operation, item, context, originalItem }) => {
      const auditHook = createAuditHook('PortfolioCleanup', 
        (item, operation) => `Limpieza de cartera: ${item.name} - ${operation}`,
        (item) => ({
          fromDate: item.fromDate,
          toDate: item.toDate
        })
      );
      
      await auditHook.afterOperation({ operation, item, context, originalItem });
    }
  }
});

export const Account = list({
  access: allowAll,
  ui: { isHidden: true },
  fields: {
    name: text(),
    type: select({
      options: [
        { label: 'BANK', value: 'BANK' },
        { label: 'OFFICE_CASH_FUND', value: 'OFFICE_CASH_FUND' },
        { label: 'EMPLOYEE_CASH_FUND', value: 'EMPLOYEE_CASH_FUND' },
        { label: 'PREPAID_GAS', value: 'PREPAID_GAS' },
        { label: 'TRAVEL_EXPENSES', value: 'TRAVEL_EXPENSES' },
      ],
    }),
    amount: decimal(),
    accountBalance: virtual({
      field: graphql.field({
        type: graphql.Float,
        async resolve(item: { id: string | { toString(): string } }, _args: any, context: KeystoneContext) {
          const id = item.id.toString();
          // Obtener todas las transacciones donde esta cuenta es origen o destino
          const sourceTransactions = await context.prisma.transaction.findMany({
            where: { sourceAccountId: id },
            select: { type: true, amount: true }
          });
          
          const destinationTransactions = await context.prisma.transaction.findMany({
            where: { destinationAccountId: id },
            select: { type: true, amount: true }
          });

          // Calcular el balance
          let balance = 0;
          
          // Procesar transacciones donde la cuenta es origen
          sourceTransactions.forEach((transaction: { type: string; amount: number | Decimal }) => {
            if (transaction.type === 'EXPENSE' || transaction.type === 'TRANSFER') {
              balance -= Number(transaction.amount);
            }
          });

          // Procesar transacciones donde la cuenta es destino
          destinationTransactions.forEach((transaction: { type: string; amount: number | Decimal }) => {
            if (transaction.type === 'INCOME' || transaction.type === 'TRANSFER') {
              balance += Number(transaction.amount);
            }
          });

          // Redondear el balance a 0, 0.5 o 1
          const decimal = balance % 1;
          if (decimal < 0.25) {
            balance = Math.floor(balance);
          } else if (decimal >= 0.25 && decimal < 0.75) {
            balance = Math.floor(balance) + 0.5;
          } else {
            balance = Math.ceil(balance);
          }

          return balance;
        }
      })
    }),
    transactions: relationship({ 
      ref: 'Transaction.sourceAccount', 
      many: true,
      ui: {
        createView: { fieldMode: 'hidden' as const },
        itemView: { fieldMode: 'hidden' as const }
      }
    }),
    receivedTransactions: relationship({ 
      ref: 'Transaction.destinationAccount', 
      many: true,
      ui: {
        createView: { fieldMode: 'hidden' as const },
        itemView: { fieldMode: 'hidden' as const }
      }
    }),
    routes: relationship({ ref: 'Route.accounts', many: true }),
    updatedAt: timestamp(),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
  },
  
});

// Modelo para fotos de documentos personales
export const DocumentPhoto = list({
  access: allowAll,
  ui: { isHidden: true },
  graphql: {
    plural: 'DocumentPhotos',
  },
  fields: {
    title: text({ validation: { isRequired: true } }),
    description: text(),
    photoUrl: text({ validation: { isRequired: false } }),
    publicId: text({ validation: { isRequired: false } }),
    documentType: select({
      type: 'enum',
      options: [
        { label: 'INE', value: 'INE' },
        { label: 'Comprobante de Domicilio', value: 'DOMICILIO' },
        { label: 'Pagaré', value: 'PAGARE' },
        { label: 'Otro', value: 'OTRO' }
      ],
      validation: { isRequired: true }
    }),
    isError: checkbox({ defaultValue: false }),
    errorDescription: text(),
    isMissing: checkbox({ defaultValue: false }),
    personalData: relationship({ 
      ref: 'PersonalData.documentPhotos'
    }),
    loan: relationship({ 
      ref: 'Loan.documentPhotos'
    }),
    uploadedBy: relationship({ ref: 'User.documentPhotos' }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
  },
  
});

// Modelo para configuraciones de reportes automáticos
export const ReportConfig = list({
  access: allowAll,
  ui: { isHidden: true },
  graphql: {
    plural: 'ReportConfigs',
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    reportType: select({
      type: 'enum',
      options: [
        { label: 'Créditos con Documentos con Error', value: 'creditos_con_errores' },
        { label: 'Créditos Sin Documentos', value: 'creditos_sin_documentos' },
        { label: 'Créditos Completos', value: 'creditos_completos' },
        { label: 'Resumen Semanal de Cartera', value: 'resumen_semanal' },
        { label: 'Reporte Financiero', value: 'reporte_financiero' }
      ],
      validation: { isRequired: true }
    }),
    schedule: json({
      defaultValue: {
        days: [],
        hour: '09',
        timezone: 'America/Mexico_City'
      }
    }),
    routes: relationship({ 
      ref: 'Route.reportConfigs',
      many: true
    }),
    recipients: relationship({ 
      ref: 'User.reportConfigRecipients',
      many: true
    }),

    channel: select({
      type: 'enum',
      options: [
        { label: 'Telegram', value: 'telegram' },
        { label: 'Email', value: 'email' },
        { label: 'WhatsApp', value: 'whatsapp' }
      ],
      validation: { isRequired: true }
    }),
    isActive: checkbox({ defaultValue: true }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
    updatedAt: timestamp(),
    createdBy: relationship({ ref: 'User.reportConfigsCreated' }),
    updatedBy: relationship({ ref: 'User.reportConfigsUpdated' }),
    
    // Logs de ejecución de este reporte
    executionLogs: relationship({ 
      ref: 'ReportExecutionLog.reportConfig',
      many: true
    }),
  },
  
});

// Modelo para usuarios de Telegram
export const TelegramUser = list({
  access: allowAll,
  ui: { isHidden: true },
  graphql: {
    plural: 'TelegramUsers',
  },
  fields: {
    chatId: text({ 
      validation: { isRequired: true },
      isIndexed: 'unique'
    }),
    name: text({ validation: { isRequired: true } }),
    username: text(),
    isActive: checkbox({ defaultValue: true }),
    registeredAt: timestamp({ defaultValue: { kind: 'now' } }),
    lastActivity: timestamp({ defaultValue: { kind: 'now' } }),
    reportsReceived: integer({ defaultValue: 0 }),
    isInRecipientsList: checkbox({ defaultValue: false }),
    notes: text(),
    platformUser: relationship({ 
      ref: 'User.telegramUsers',
      many: false
    }),

  },
  
});

export const lists = {
  User,
  Employee,
  Route,
  Location,
  State,
  Municipality,
  /* Profit, */
  /* Expense, */
  //ComissionPaymentConfiguration,
  Loantype,
  Phone,
  Address,
  Borrower,
  PersonalData,
  Loan,
  LoanPayment,
  Transaction,
  CommissionPayment,
  LeadPaymentType,
  FalcoCompensatoryPayment,
  LeadPaymentReceived,
  Account,
  AuditLog,
  ReportExecutionLog,
  PortfolioCleanup,
  DocumentPhoto,
  ReportConfig,
  TelegramUser,
};