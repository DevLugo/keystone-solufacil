const express = require('express');
const request = require('supertest');

// Inyectar un Prisma mock global que el endpoint usa (globalThis.prisma)
beforeEach(() => {
  global.prisma = {
    loan: {
      findMany: jest.fn(),
    },
  };
});

afterEach(() => {
  delete global.prisma;
});

// Carga del extendExpressApp que registra el endpoint
const { extendExpressApp } = require('../../keystone-extensions.js');

function buildApp() {
  const app = express();
  extendExpressApp(app);
  return app;
}

describe('Integración /api/generar-listados - pago VDO y abono parcial', () => {
  test('Cliente con 2 semanas de faltas → pagoVdo = $900', async () => {
    const now = new Date();
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);

    const mockLoans = [
      {
        id: 'loan1',
        requestedAmount: 3000,
        expectedWeeklyPayment: '300',
        pendingAmountStored: '5000',
        signDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        loantype: { weekDuration: 10, rate: '0.0' },
        payments: [
          // Pagos en semanas 4 y 5, faltó semanas 1-3
          { amount: '300', receivedAt: new Date(now.getFullYear(), now.getMonth(), 29).toISOString() },
          { amount: '300', receivedAt: new Date(now.getFullYear(), now.getMonth()+1, 6).toISOString() },
        ],
        borrower: { personalData: { fullName: 'CLIENTE CON FALTAS', phones: [], addresses: [] } },
        collaterals: [],
        lead: { personalData: {} },
      },
    ];

    global.prisma.loan.findMany.mockResolvedValue(mockLoans);

    const app = buildApp();
    const res = await request(app)
      .get('/api/generar-listados')
      .query({ localityId: 'L1', routeId: 'R1', localityName: 'Loc', routeName: 'Ruta' })
      .expect(200);

    const { payments } = res.body;
    const cliente = payments.find(p => p.name === 'CLIENTE CON FALTAS');
    expect(cliente).toBeDefined();
    expect(cliente.pagoVdo).toBe('$900');
  });

  test('Cliente con adelanto de $1000 en semana actual → abonoParcial = $700', async () => {
    const now = new Date();

    const mockLoans = [
      {
        id: 'loan2',
        requestedAmount: 3000,
        expectedWeeklyPayment: '300',
        pendingAmountStored: '5000',
        signDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        loantype: { weekDuration: 10, rate: '0.0' },
        payments: [
          { amount: '1000', receivedAt: now.toISOString() },
        ],
        borrower: { personalData: { fullName: 'CLIENTE CON ADELANTO', phones: [], addresses: [] } },
        collaterals: [],
        lead: { personalData: {} },
      },
    ];

    global.prisma.loan.findMany.mockResolvedValue(mockLoans);

    const app = buildApp();
    const res = await request(app)
      .get('/api/generar-listados')
      .query({ localityId: 'L1', routeId: 'R1', localityName: 'Loc', routeName: 'Ruta' })
      .expect(200);

    const { payments } = res.body;
    const cliente = payments.find(p => p.name === 'CLIENTE CON ADELANTO');
    expect(cliente).toBeDefined();
    expect(cliente.abonoParcial).toBe('$700');
  });
});


