import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';
import { createDiscrepancyReporter } from '../../admin/services/discrepancyReporter';
import { v2 as cloudinary } from 'cloudinary';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Helper para subir screenshot a Cloudinary
 */
async function uploadScreenshotToCloudinary(
  base64Image: string,
  filename: string
): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'discrepancies',
      public_id: filename,
      resource_type: 'image',
    });
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading screenshot to Cloudinary:', error);
    throw error;
  }
}

/**
 * Helper para calcular el inicio de la semana (lunes)
 */
function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar a lunes
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Helper para transformar datos de Prisma a GraphQL
 * Convierte Decimal a number y Date a string ISO
 */
function transformDiscrepancyForGraphQL(discrepancy: any) {
  return {
    ...discrepancy,
    expectedAmount: discrepancy.expectedAmount.toNumber(),
    actualAmount: discrepancy.actualAmount.toNumber(),
    difference: discrepancy.difference.toNumber(),
    date: discrepancy.date.toISOString(),
    weekStartDate: discrepancy.weekStartDate.toISOString(),
    createdAt: discrepancy.createdAt?.toISOString() || null,
    updatedAt: discrepancy.updatedAt?.toISOString() || null,
    reportedAt: discrepancy.reportedAt?.toISOString() || null,
  };
}

/**
 * Tipos de respuesta
 */
const DiscrepancyType = graphql.object<any>()({
  name: 'Discrepancy',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    discrepancyType: graphql.field({ type: graphql.nonNull(graphql.String) }),
    date: graphql.field({ type: graphql.nonNull(graphql.String) }),
    weekStartDate: graphql.field({ type: graphql.nonNull(graphql.String) }),
    expectedAmount: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    actualAmount: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    difference: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    description: graphql.field({ type: graphql.nonNull(graphql.String) }),
    category: graphql.field({ type: graphql.String }),
    status: graphql.field({ type: graphql.nonNull(graphql.String) }),
    notes: graphql.field({ type: graphql.String }),
    screenshotUrls: graphql.field({ type: graphql.list(graphql.String) }),
    telegramReported: graphql.field({ type: graphql.Boolean }),
    reportedAt: graphql.field({ type: graphql.String }),
    route: graphql.field({
      type: graphql.object<any>()({
        name: 'DiscrepancyRoute',
        fields: {
          id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
          name: graphql.field({ type: graphql.String }),
        },
      }),
    }),
    lead: graphql.field({
      type: graphql.object<any>()({
        name: 'DiscrepancyLead',
        fields: {
          id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
          personalData: graphql.field({
            type: graphql.object<any>()({
              name: 'DiscrepancyLeadPersonalData',
              fields: {
                fullName: graphql.field({ type: graphql.String }),
              },
            }),
          }),
        },
      }),
    }),
    createdAt: graphql.field({ type: graphql.String }),
    updatedAt: graphql.field({ type: graphql.String }),
    createdBy: graphql.field({
      type: graphql.object<any>()({
        name: 'DiscrepancyCreatedBy',
        fields: {
          id: graphql.field({ type: graphql.ID }),
          name: graphql.field({ type: graphql.String }),
          email: graphql.field({ type: graphql.String }),
        },
      }),
    }),
    updatedBy: graphql.field({
      type: graphql.object<any>()({
        name: 'DiscrepancyUpdatedBy',
        fields: {
          id: graphql.field({ type: graphql.ID }),
          name: graphql.field({ type: graphql.String }),
          email: graphql.field({ type: graphql.String }),
        },
      }),
    }),
  },
});

const CreateDiscrepancyResponse = graphql.object<any>()({
  name: 'CreateDiscrepancyResponse',
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    discrepancy: graphql.field({ type: DiscrepancyType }),
    message: graphql.field({ type: graphql.String }),
    errors: graphql.field({ type: graphql.list(graphql.String) }),
  },
});

const UpdateDiscrepancyResponse = graphql.object<any>()({
  name: 'UpdateDiscrepancyResponse',
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    discrepancy: graphql.field({ type: DiscrepancyType }),
    message: graphql.field({ type: graphql.String }),
  },
});

const DeleteDiscrepancyResponse = graphql.object<any>()({
  name: 'DeleteDiscrepancyResponse',
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    message: graphql.field({ type: graphql.String }),
  },
});

/**
 * Mutation: createDiscrepancy
 */
export const createDiscrepancyResolver = graphql.field({
  type: CreateDiscrepancyResponse,
  args: {
    discrepancyType: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    routeId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    leadId: graphql.arg({ type: graphql.ID }),
    date: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    expectedAmount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    actualAmount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    description: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    category: graphql.arg({ type: graphql.String }),
    screenshotBase64: graphql.arg({ type: graphql.String }),
  },
  resolve: async (root, args, context: Context) => {
    const errors: string[] = [];

    try {
      console.log('📝 Creando diferencia:', args.discrepancyType);

      // Validar datos
      if (!['PAYMENT', 'CREDIT', 'EXPENSE'].includes(args.discrepancyType)) {
        errors.push('Tipo de diferencia inválido');
      }

      if (errors.length > 0) {
        return {
          success: false,
          discrepancy: null,
          message: 'Validación fallida',
          errors,
        };
      }

      // Calcular diferencia
      const difference = args.actualAmount - args.expectedAmount;

      // Calcular inicio de semana
      const date = new Date(args.date);
      const weekStartDate = getWeekStartDate(date);

      // Subir screenshot si existe
      let screenshotUrls: string[] = [];
      if (args.screenshotBase64) {
        try {
          const filename = `discrepancy-${Date.now()}`;
          const url = await uploadScreenshotToCloudinary(args.screenshotBase64, filename);
          screenshotUrls.push(url);
          console.log('✅ Screenshot subido:', url);
        } catch (error) {
          console.error('❌ Error subiendo screenshot:', error);
          // Continuar sin screenshot
        }
      }

      // Obtener usuario actual
      const userId = context.session?.data?.id;

      // Crear discrepancy
      console.log('📝 [createDiscrepancy] Datos a guardar:', {
        discrepancyType: args.discrepancyType,
        routeId: args.routeId,
        leadId: args.leadId,
        date: date.toISOString(),
        weekStartDate: weekStartDate.toISOString(),
        expectedAmount: args.expectedAmount,
        actualAmount: args.actualAmount,
        difference: difference,
        category: args.category,
        status: 'PENDING'
      });

      const discrepancy = await context.prisma.transactionDiscrepancy.create({
        data: {
          discrepancyType: args.discrepancyType,
          route: { connect: { id: args.routeId } },
          lead: args.leadId ? { connect: { id: args.leadId } } : undefined,
          date: date,
          weekStartDate: weekStartDate,
          expectedAmount: args.expectedAmount,
          actualAmount: args.actualAmount,
          difference: difference,
          description: args.description,
          category: args.category,
          status: 'PENDING',
          screenshotUrls: screenshotUrls,
          telegramReported: false,
          createdBy: userId ? { connect: { id: userId } } : undefined,
          updatedBy: userId ? { connect: { id: userId } } : undefined,
        },
        include: {
          route: true,
          lead: {
            include: {
              personalData: true,
            },
          },
          createdBy: true,
          updatedBy: true,
        },
      });

      console.log('✅ [createDiscrepancy] Diferencia guardada con ID:', discrepancy.id);
      console.log('🔍 [createDiscrepancy] Detalles:', {
        id: discrepancy.id,
        type: discrepancy.discrepancyType,
        status: discrepancy.status,
        route: discrepancy.route?.name,
        difference: discrepancy.difference.toString()
      });

      // Enviar notificación por Telegram
      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const defaultChatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;
        
        // Obtener lista de chat IDs para reportes de diferencias
        const discrepancyChatIds = process.env.TELEGRAM_DISCREPANCY_CHAT_IDS 
          ? process.env.TELEGRAM_DISCREPANCY_CHAT_IDS.split(',').map(id => id.trim())
          : defaultChatId 
            ? [defaultChatId] 
            : [];

        if (botToken && discrepancyChatIds.length > 0) {
          const reporter = createDiscrepancyReporter(botToken, defaultChatId || discrepancyChatIds[0]);

          await reporter.reportDiscrepancy(
            {
              ...discrepancy,
              expectedAmount: discrepancy.expectedAmount.toString(),
              actualAmount: discrepancy.actualAmount.toString(),
              difference: discrepancy.difference.toString(),
            },
            {
              chatIds: discrepancyChatIds,
              includeScreenshots: true,
            }
          );

          // Actualizar flag de reportado
          await context.prisma.transactionDiscrepancy.update({
            where: { id: discrepancy.id },
            data: {
              telegramReported: true,
              reportedAt: new Date(),
            },
          });

          console.log(`✅ Notificación por Telegram enviada a ${discrepancyChatIds.length} destinatario(s)`);
        } else {
          console.log('⚠️ No se configuraron destinatarios de Telegram para reportes de diferencias');
        }
      } catch (telegramError) {
        console.error('❌ Error enviando notificación por Telegram:', telegramError);
        // No fallar la creación de la discrepancy si el envío falla
      }

      return {
        success: true,
        discrepancy: transformDiscrepancyForGraphQL(discrepancy),
        message: 'Diferencia creada y reportada exitosamente',
        errors: [],
      };
    } catch (error) {
      console.error('❌ Error creando discrepancy:', error);
      return {
        success: false,
        discrepancy: null,
        message: 'Error al crear diferencia',
        errors: [error.message],
      };
    }
  },
});

/**
 * Mutation: updateDiscrepancyStatus
 */
export const updateDiscrepancyStatusResolver = graphql.field({
  type: UpdateDiscrepancyResponse,
  args: {
    id: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    status: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    notes: graphql.arg({ type: graphql.String }),
  },
  resolve: async (root, args, context: Context) => {
    try {
      console.log('📝 Actualizando estado de diferencia:', args.id);

      // Validar estado
      if (!['PENDING', 'COMPLETED', 'DISCARDED'].includes(args.status)) {
        return {
          success: false,
          discrepancy: null,
          message: 'Estado inválido',
        };
      }

      const userId = context.session?.data?.id;

      const discrepancy = await context.prisma.transactionDiscrepancy.update({
        where: { id: args.id },
        data: {
          status: args.status,
          notes: args.notes,
          updatedBy: userId ? { connect: { id: userId } } : undefined,
        },
        include: {
          route: true,
          lead: {
            include: {
              personalData: true,
            },
          },
          createdBy: true,
          updatedBy: true,
        },
      });

      return {
        success: true,
        discrepancy: transformDiscrepancyForGraphQL(discrepancy),
        message: 'Estado actualizado exitosamente',
      };
    } catch (error) {
      console.error('❌ Error actualizando estado de diferencia:', error);
      return {
        success: false,
        discrepancy: null,
        message: 'Error al actualizar estado',
      };
    }
  },
});

/**
 * Mutation: deleteDiscrepancy
 */
export const deleteDiscrepancyResolver = graphql.field({
  type: DeleteDiscrepancyResponse,
  args: {
    id: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
  },
  resolve: async (root, args, context: Context) => {
    try {
      console.log('🗑️ Eliminando diferencia:', args.id);

      await context.prisma.transactionDiscrepancy.delete({
        where: { id: args.id },
      });

      return {
        success: true,
        message: 'Diferencia eliminada exitosamente',
      };
    } catch (error) {
      console.error('❌ Error eliminando diferencia:', error);
      return {
        success: false,
        message: 'Error al eliminar diferencia',
      };
    }
  },
});

/**
 * Query: getDiscrepancies
 */
export const getDiscrepanciesResolver = graphql.field({
  type: graphql.list(DiscrepancyType),
  args: {
    routeId: graphql.arg({ type: graphql.ID }),
    startDate: graphql.arg({ type: graphql.String }),
    endDate: graphql.arg({ type: graphql.String }),
    status: graphql.arg({ type: graphql.String }),
    discrepancyType: graphql.arg({ type: graphql.String }),
  },
  resolve: async (root, args, context: Context) => {
    try {
      console.log('🔍 [getDiscrepancies] Args recibidos:', args);
      
      const where: any = {};

      if (args.routeId) {
        where.routeId = args.routeId;
      }

      if (args.startDate && args.endDate) {
        where.date = {
          gte: new Date(args.startDate),
          lte: new Date(args.endDate),
        };
      }

      if (args.status) {
        where.status = args.status;
      }

      if (args.discrepancyType) {
        where.discrepancyType = args.discrepancyType;
      }

      console.log('🔍 [getDiscrepancies] Where query:', JSON.stringify(where, null, 2));

      const discrepancies = await context.prisma.transactionDiscrepancy.findMany({
        where,
        include: {
          route: true,
          lead: {
            include: {
              personalData: true,
            },
          },
          createdBy: true,
          updatedBy: true,
        },
        orderBy: { date: 'desc' },
      });

      console.log(`✅ [getDiscrepancies] Encontradas ${discrepancies.length} diferencias`);
      if (discrepancies.length > 0) {
        console.log('🔍 [getDiscrepancies] Primera diferencia:', {
          id: discrepancies[0].id,
          type: discrepancies[0].discrepancyType,
          status: discrepancies[0].status,
          route: discrepancies[0].route?.name,
          difference: discrepancies[0].difference.toString()
        });
      }

      // Transformar datos de Prisma a GraphQL
      return discrepancies.map(transformDiscrepancyForGraphQL);
    } catch (error) {
      console.error('❌ Error obteniendo diferencias:', error);
      return [];
    }
  },
});

/**
 * Query: getDiscrepancy
 */
export const getDiscrepancyResolver = graphql.field({
  type: DiscrepancyType,
  args: {
    id: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
  },
  resolve: async (root, args, context: Context) => {
    try {
      const discrepancy = await context.prisma.transactionDiscrepancy.findUnique({
        where: { id: args.id },
        include: {
          route: true,
          lead: {
            include: {
              personalData: true,
            },
          },
          createdBy: true,
          updatedBy: true,
        },
      });

      return discrepancy ? transformDiscrepancyForGraphQL(discrepancy) : null;
    } catch (error) {
      console.error('❌ Error obteniendo diferencia:', error);
      return null;
    }
  },
});

/**
 * Query: getDiscrepancyStats
 */
const DiscrepancyStatsType = graphql.object<any>()({
  name: 'DiscrepancyStats',
  fields: {
    totalDiscrepancies: graphql.field({ type: graphql.Int }),
    pendingCount: graphql.field({ type: graphql.Int }),
    completedCount: graphql.field({ type: graphql.Int }),
    discardedCount: graphql.field({ type: graphql.Int }),
    totalDifference: graphql.field({ type: graphql.Float }),
    byType: graphql.field({
      type: graphql.list(
        graphql.object<any>()({
          name: 'DiscrepancyByType',
          fields: {
            type: graphql.field({ type: graphql.String }),
            count: graphql.field({ type: graphql.Int }),
            totalDifference: graphql.field({ type: graphql.Float }),
          },
        })
      ),
    }),
    byRoute: graphql.field({
      type: graphql.list(
        graphql.object<any>()({
          name: 'DiscrepancyByRoute',
          fields: {
            routeId: graphql.field({ type: graphql.ID }),
            routeName: graphql.field({ type: graphql.String }),
            count: graphql.field({ type: graphql.Int }),
            totalDifference: graphql.field({ type: graphql.Float }),
          },
        })
      ),
    }),
    byWeek: graphql.field({
      type: graphql.list(
        graphql.object<any>()({
          name: 'DiscrepancyByWeek',
          fields: {
            weekStart: graphql.field({ type: graphql.String }),
            count: graphql.field({ type: graphql.Int }),
            totalDifference: graphql.field({ type: graphql.Float }),
          },
        })
      ),
    }),
  },
});

export const getDiscrepancyStatsResolver = graphql.field({
  type: DiscrepancyStatsType,
  args: {
    routeId: graphql.arg({ type: graphql.ID }),
    weekStartDate: graphql.arg({ type: graphql.String }),
  },
  resolve: async (root, args, context: Context) => {
    try {
      const where: any = {};

      if (args.routeId) {
        where.routeId = args.routeId;
      }

      if (args.weekStartDate) {
        const weekStart = new Date(args.weekStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        where.date = {
          gte: weekStart,
          lt: weekEnd,
        };
      }

      const discrepancies = await context.prisma.transactionDiscrepancy.findMany({
        where,
        include: {
          route: true,
        },
      });

      // Calcular estadísticas
      const stats = {
        totalDiscrepancies: discrepancies.length,
        pendingCount: discrepancies.filter((d) => d.status === 'PENDING').length,
        completedCount: discrepancies.filter((d) => d.status === 'COMPLETED').length,
        discardedCount: discrepancies.filter((d) => d.status === 'DISCARDED').length,
        totalDifference: discrepancies.reduce((sum, d) => sum + Number(d.difference), 0),
        byType: [] as any[],
        byRoute: [] as any[],
        byWeek: [] as any[],
      };

      // Agrupar por tipo
      const byType: any = {};
      discrepancies.forEach((d) => {
        if (!byType[d.discrepancyType]) {
          byType[d.discrepancyType] = { type: d.discrepancyType, count: 0, totalDifference: 0 };
        }
        byType[d.discrepancyType].count++;
        byType[d.discrepancyType].totalDifference += Number(d.difference);
      });
      stats.byType = Object.values(byType);

      // Agrupar por ruta
      const byRoute: any = {};
      discrepancies.forEach((d) => {
        const routeId = d.routeId;
        if (!byRoute[routeId]) {
          byRoute[routeId] = {
            routeId,
            routeName: d.route?.name,
            count: 0,
            totalDifference: 0,
          };
        }
        byRoute[routeId].count++;
        byRoute[routeId].totalDifference += Number(d.difference);
      });
      stats.byRoute = Object.values(byRoute);

      return stats;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de diferencias:', error);
      return null;
    }
  },
});

