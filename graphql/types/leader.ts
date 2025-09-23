import { graphql } from '@keystone-6/core';

export const LeaderBirthdayType = graphql.object<any>()({
  name: 'LeaderBirthday',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    fullName: graphql.field({ type: graphql.nonNull(graphql.String) }),
    birthDate: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (source) => source.personalData?.birthDate || ''
    }),
    day: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    route: graphql.field({
      type: graphql.object({
        name: 'Route',
        fields: {
          id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
          name: graphql.field({ type: graphql.nonNull(graphql.String) })
        }
      })
    }),
    location: graphql.field({
      type: graphql.object({
        name: 'Location',
        fields: {
          id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
          name: graphql.field({ type: graphql.nonNull(graphql.String) })
        }
      })
    })
  }
});
