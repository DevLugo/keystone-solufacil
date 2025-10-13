import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';

// Resolver para promover a un cliente a líder
export const promoteToLeadResolver = graphql.field({
  type: graphql.nonNull(graphql.JSON),
  args: {
    clientId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    currentLeadId: graphql.arg({ type: graphql.nonNull(graphql.ID) })
  },
  resolve: async (root, { clientId, currentLeadId }, context: Context) => {
    try {
      return await context.prisma.$transaction(async (tx) => {
        // 1. Obtener información del cliente actual
        const client = await tx.personalData.findUnique({
          where: { id: clientId },
          include: {
            addresses: true,
            phones: true
          }
        });

        if (!client) {
          return {
            success: false,
            message: 'Cliente no encontrado',
            newLeadId: null
          };
        }

        // 2. Obtener información del líder actual
        const currentLead = await tx.employee.findUnique({
          where: { id: currentLeadId },
          include: {
            routes: true,
            personalData: {
              include: {
                addresses: true
              }
            }
          }
        });

        if (!currentLead) {
          return {
            success: false,
            message: 'Líder actual no encontrado',
            newLeadId: null
          };
        }

        // 3. Crear nuevo registro de Employee para el cliente
        const newLead = await tx.employee.create({
          data: {
            type: 'ROUTE_LEAD',
            personalDataId: clientId,
            routesId: currentLead.routesId
          }
        });

        // 4. Copiar la dirección del líder actual al cliente promovido
        if (currentLead.personalData?.addresses && currentLead.personalData.addresses.length > 0) {
          const leadAddress = currentLead.personalData.addresses[0]; // Tomar la primera dirección
          
          // Verificar si el cliente ya tiene una dirección
          const existingAddress = await tx.address.findFirst({
            where: { personalDataId: clientId }
          });

          if (existingAddress) {
            // Actualizar la dirección existente con los datos del líder
            await tx.address.update({
              where: { id: existingAddress.id },
              data: {
                street: leadAddress.street,
                exteriorNumber: leadAddress.exteriorNumber,
                interiorNumber: leadAddress.interiorNumber,
                postalCode: leadAddress.postalCode,
                references: leadAddress.references,
                locationId: leadAddress.locationId
              }
            });
          } else {
            // Crear nueva dirección para el cliente
            await tx.address.create({
              data: {
                personalDataId: clientId,
                street: leadAddress.street,
                exteriorNumber: leadAddress.exteriorNumber,
                interiorNumber: leadAddress.interiorNumber,
                postalCode: leadAddress.postalCode,
                references: leadAddress.references,
                locationId: leadAddress.locationId
              }
            });
          }
        }

        // 5. Obtener todos los préstamos activos del líder actual
        const activeLoans = await tx.loan.findMany({
          where: {
            leadId: currentLeadId,
            finishedDate: null,
            isDeceased: false
          }
        });

        // 6. Transferir todos los préstamos activos al nuevo líder
        if (activeLoans.length > 0) {
          await tx.loan.updateMany({
            where: {
              id: {
                in: activeLoans.map(loan => loan.id)
              }
            },
            data: {
              leadId: newLead.id
            }
          });
        }

        // 7. Eliminar el registro de Employee del líder anterior
        await tx.employee.delete({
          where: { id: currentLeadId }
        });

        return {
          success: true,
          message: `Cliente promovido a líder exitosamente. Se transfirieron ${activeLoans.length} préstamos activos, se copió la dirección del líder anterior y se eliminó el registro del líder anterior.`,
          newLeadId: newLead.id
        };
      });
    } catch (error) {
      console.error('Error promoviendo a líder:', error);
      return {
        success: false,
        message: 'Error interno al promover a líder',
        newLeadId: null
      };
    }
  }
});

// Resolver para crear un nuevo líder
export const createNewLeaderResolver = graphql.field({
  type: graphql.nonNull(graphql.JSON),
  args: {
    fullName: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    birthDate: graphql.arg({ type: graphql.String }),
    phone: graphql.arg({ type: graphql.String }),
    locationId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    routeId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    replaceExisting: graphql.arg({ type: graphql.Boolean, defaultValue: false })
  },
  resolve: async (root, { fullName, birthDate, phone, locationId, routeId, replaceExisting }, context: Context) => {
    try {
      return await context.prisma.$transaction(async (tx) => {
        // 1. Verificar si ya existe un líder en esa localidad
        const existingLeader = await tx.employee.findFirst({
          where: {
            type: 'ROUTE_LEAD',
            personalData: {
              addresses: {
                some: {
                  locationId: locationId
                }
              }
            }
          },
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
        });

        if (existingLeader && !replaceExisting) {
          return {
            success: false,
            message: `Ya existe un líder en la localidad "${existingLeader.personalData?.addresses[0]?.location?.name}". Marca la opción "Reemplazar líder existente" si deseas continuar.`,
            newLeaderId: null
          };
        }

        // 2. Obtener información de la localidad
        const location = await tx.location.findUnique({
          where: { id: locationId },
          include: {
            municipality: {
              include: {
                state: true
              }
            }
          }
        });

        if (!location) {
          return {
            success: false,
            message: 'Localidad no encontrada',
            newLeaderId: null
          };
        }

        // 3. Crear el registro de PersonalData
        const personalData = await tx.personalData.create({
          data: {
            fullName: fullName,
            birthDate: birthDate ? new Date(birthDate) : null,
            clientCode: `L${Date.now()}` // Código único para líder
          }
        });

        // 4. Crear la dirección automática basada en la localidad
        await tx.address.create({
          data: {
            personalDataId: personalData.id,
            street: 'Centro', // Dirección genérica para líderes
            exteriorNumber: 'S/N',
            interiorNumber: '',
            postalCode: '00000',
            references: `Líder de ${location.name}`,
            locationId: locationId
          }
        });

        // 5. Crear el teléfono si se proporciona
        if (phone) {
          await tx.phone.create({
            data: {
              number: phone,
              personalDataId: personalData.id
            }
          });
        }

        // 6. Si hay que reemplazar líder existente, transferir préstamos activos
        if (existingLeader && replaceExisting) {
          const activeLoans = await tx.loan.findMany({
            where: {
              leadId: existingLeader.id,
              finishedDate: null,
              isDeceased: false
            }
          });

          // Crear el nuevo empleado primero
          const newLeader = await tx.employee.create({
            data: {
              type: 'ROUTE_LEAD',
              personalDataId: personalData.id,
              routesId: routeId
            }
          });

          // Transferir préstamos activos
          if (activeLoans.length > 0) {
            await tx.loan.updateMany({
              where: {
                id: {
                  in: activeLoans.map(loan => loan.id)
                }
              },
              data: {
                leadId: newLeader.id
              }
            });
          }

          // Eliminar el líder anterior
          await tx.employee.delete({
            where: { id: existingLeader.id }
          });

          return {
            success: true,
            message: `Nuevo líder creado exitosamente en ${location.name}. Se transfirieron ${activeLoans.length} préstamos activos del líder anterior.`,
            newLeaderId: newLeader.id
          };
        } else {
          // 7. Crear el nuevo empleado (líder)
          const newLeader = await tx.employee.create({
            data: {
              type: 'ROUTE_LEAD',
              personalDataId: personalData.id,
              routesId: routeId
            }
          });

          return {
            success: true,
            message: `Nuevo líder creado exitosamente en ${location.name}.`,
            newLeaderId: newLeader.id
          };
        }
      });
    } catch (error) {
      console.error('Error creando nuevo líder:', error);
      return {
        success: false,
        message: 'Error interno al crear nuevo líder',
        newLeaderId: null
      };
    }
  }
});
