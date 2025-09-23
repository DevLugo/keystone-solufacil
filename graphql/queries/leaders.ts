import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';
import { LeaderBirthdayType } from '../types/leader';

export const getLeadersBirthdays = graphql.field({
  type: graphql.nonNull(graphql.list(graphql.nonNull(LeaderBirthdayType))),
  args: {
    month: graphql.arg({ type: graphql.nonNull(graphql.Int) })
  },
  resolve: async (source, { month }, context: Context) => {
    try {
      console.log(`🎂 Buscando cumpleaños para el mes: ${month}`);
      
      // Get all employees with type ROUTE_LEAD who have birthDate
      const leaders = await context.prisma.employee.findMany({
        where: {
          type: { equals: 'ROUTE_LEAD' },
          personalData: {
            birthDate: { not: null }
          }
        },
        include: {
          personalData: true,
          routes: true
        }
      });

      console.log(`📊 Total líderes con fecha de nacimiento: ${leaders.length}`);
      
      // Log some birth dates for debugging
      leaders.forEach(leader => {
        if (leader.personalData?.birthDate) {
          const birthDate = new Date(leader.personalData.birthDate);
          console.log(`👤 ${leader.personalData.fullName}: ${birthDate.toISOString()} (mes: ${birthDate.getMonth() + 1})`);
        }
      });

      // Filter by month and format data
      const birthdaysInMonth = leaders
        .filter(leader => {
          if (!leader.personalData?.birthDate) return false;
          const birthDate = new Date(leader.personalData.birthDate);
          const birthMonth = birthDate.getMonth() + 1;
          console.log(`🔍 Comparando: ${leader.personalData.fullName} - mes ${birthMonth} vs ${month}`);
          return birthMonth === month; // getMonth() returns 0-11
        })
        .map(leader => {
          const birthDate = new Date(leader.personalData.birthDate);
          return {
            id: leader.personalData.id,
            fullName: leader.personalData.fullName,
            birthDate: leader.personalData.birthDate,
            day: birthDate.getDate(),
            route: leader.routes ? {
              id: leader.routes.id,
              name: leader.routes.name
            } : null,
            location: null // We'll get this from addresses if needed
          };
        })
        .sort((a, b) => a.day - b.day); // Sort by day of month

      // Get location info for each leader
      for (const birthday of birthdaysInMonth) {
        const addresses = await context.db.Address.findMany({
          where: { personalData: { id: { equals: birthday.id } } },
          include: { location: true },
          take: 1
        });
        
        if (addresses.length > 0 && addresses[0].location) {
          birthday.location = {
            id: addresses[0].location.id,
            name: addresses[0].location.name
          };
        }
      }

      console.log(`🎉 Cumpleaños encontrados en el mes ${month}: ${birthdaysInMonth.length}`);
      return birthdaysInMonth;
    } catch (error) {
      console.error('Error fetching leaders birthdays:', error);
      throw new Error('Error al obtener cumpleaños de líderes');
    }
  }
});
