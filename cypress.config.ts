import { defineConfig } from 'cypress';
import dotenv from 'dotenv';

// Cargar variables de test
dotenv.config({ path: '.env.test' });

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    
    setupNodeEvents(on, config) {
      // Plugin para manejo de BD y tareas personalizadas
      on('task', {
        // Limpiar BD antes de cada test
        async 'db:seed'() {
          const { seedDatabase } = await import('./cypress/support/database');
          await seedDatabase();
          return null;
        },
        
        // Limpiar BD completamente  
        async 'db:clean'() {
          const { cleanDatabase } = await import('./cypress/support/database');
          await cleanDatabase();
          return null;
        },

        // Crear datos específicos para test
        async 'db:create'(data) {
          const { createTestData } = await import('./cypress/support/database');
          return await createTestData(data);
        },

        // Verificar datos en BD
        async 'db:verify'(query) {
          const { verifyData } = await import('./cypress/support/database');
          return await verifyData(query);
        },

        // Obtener balance de cuentas
        async 'db:getAccountBalances'() {
          const { getAccountBalances } = await import('./cypress/support/database');
          return await getAccountBalances();
        },

        // Obtener todas las rutas disponibles
        async 'db:getRoutes'() {
          const { getRoutes } = await import('./cypress/support/database');
          return await getRoutes();
        },

        // Verificar que una ruta específica existe
        async 'db:verifyRoute'(routeName) {
          const { verifyRouteExists } = await import('./cypress/support/database');
          return await verifyRouteExists(routeName);
        },

        // Verificar que una ruta tiene todas las cuentas necesarias
        async 'db:verifyRouteAccounts'(routeName) {
          const { verifyRouteHasRequiredAccounts } = await import('./cypress/support/database');
          return await verifyRouteHasRequiredAccounts(routeName);
        },

        // Obtener datos específicos de una ruta con todas sus cuentas
        async 'db:getRouteDetails'(routeName) {
          const { getRouteWithAccounts } = await import('./cypress/support/database');
          return await getRouteWithAccounts(routeName);
        },

        // Log para debugging
        log(message) {
          console.log('CYPRESS TASK:', message);
          return null;
        }
      });

      // Configurar screenshots en carpeta organizada
      on('after:screenshot', (details) => {
        const newPath = details.path.replace('cypress/screenshots/', 
          `cypress/screenshots/${new Date().toISOString().split('T')[0]}/`);
        return { path: newPath };
      });
    },
    
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV,
    },

    // Patterns para encontrar tests
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // Excluir archivos
    excludeSpecPattern: ['**/examples/*', '**/__snapshots__/*'],
  },

  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
  },
}); 