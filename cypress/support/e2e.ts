// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Add custom commands to Cypress global interface
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Limpiar la base de datos de testing
       */
      cleanDatabase(): Chainable<void>
      
      /**
       * Poblar la base de datos con datos de prueba
       */
      seedDatabase(): Chainable<any>
      
      /**
       * Crear datos específicos para testing
       */
      createTestData(data: any): Chainable<any>
      
      /**
       * Verificar datos en la base de datos
       */
      verifyData(query: any): Chainable<any>
      
      /**
       * Obtener balances de cuentas
       */
      getAccountBalances(): Chainable<any>
    }
  }
}

// Registrar comandos personalizados usando las tareas configuradas
Cypress.Commands.add('cleanDatabase', () => {
  return cy.task('db:clean')
})

Cypress.Commands.add('seedDatabase', () => {
  return cy.task('db:seed')
})

Cypress.Commands.add('createTestData', (data) => {
  return cy.task('db:create', data)
})

Cypress.Commands.add('verifyData', (query) => {
  return cy.task('db:verify', query)
})

Cypress.Commands.add('getAccountBalances', () => {
  return cy.task('db:getAccountBalances')
}) 