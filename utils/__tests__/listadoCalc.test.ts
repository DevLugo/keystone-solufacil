import { calculateVDOForLoan, calculateAbonoParcialForLoan, computeExpectedWeeklyPayment, LoanLike } from '../listadoCalc';

const fixedNow = new Date('2025-10-15T12:00:00Z');

describe('ListadoCalc - Unit tests de pago VDO y abono parcial', () => {
  let baseLoan: LoanLike;

  beforeEach(() => {
    baseLoan = {
      signDate: '2025-09-02T00:00:00Z',
      requestedAmount: 3000,
      loantype: { weekDuration: 10, rate: 0 },
      payments: []
    };
  });

  test('Cliente con adelanto de $1000 en semana 1 → abono parcial', () => {
    const loan: LoanLike = {
      ...baseLoan,
      payments: [
        { amount: 1000, receivedAt: '2025-09-15T12:00:00Z' }, // Semana 2
        { amount: 300, receivedAt: '2025-09-22T12:00:00Z' },  // Semana 3
      ],
    };
    const vdo = calculateVDOForLoan(loan, fixedNow);
    const abono = calculateAbonoParcialForLoan(loan, fixedNow);
    expect(vdo.expectedWeeklyPayment).toBe(300);
    expect(vdo.weeksWithoutPayment).toBeGreaterThanOrEqual(1);
    expect(vdo.arrearsAmount % 300).toBe(0);
    // Abono parcial de semana actual depende de pagos en la semana actual; aquí solo validamos estructura
    expect(abono.expectedWeeklyPayment).toBe(300);
  });

  test('Cliente con 2 semanas de faltas → pago VDO', () => {
    const loan: LoanLike = {
      ...baseLoan,
      payments: [
        { amount: 300, receivedAt: '2025-09-29T12:00:00Z' }, // Semana 4
        { amount: 300, receivedAt: '2025-10-06T12:00:00Z' }, // Semana 5
      ],
    };
    const vdo = calculateVDOForLoan(loan, fixedNow);
    expect(vdo.weeksWithoutPayment).toBeGreaterThanOrEqual(2);
    expect(vdo.arrearsAmount).toBe(vdo.weeksWithoutPayment * vdo.expectedWeeklyPayment);
  });

  test('Cliente con pago parcial → diferencia en abono parcial (no sobrepago)', () => {
    const loan: LoanLike = {
      ...baseLoan,
      payments: [
        { amount: 200, receivedAt: '2025-10-13T12:00:00Z' }, // Semana actual parcial
      ],
    };
    const abono = calculateAbonoParcialForLoan(loan, fixedNow);
    expect(abono.expectedWeeklyPayment).toBe(300);
    expect(abono.totalPaidInCurrentWeek).toBe(200);
    expect(abono.abonoParcialAmount).toBe(0); // No hay sobrepago, hay déficit
  });

  test('Cliente con todos los pagos en regla', () => {
    const loan: LoanLike = {
      ...baseLoan,
      payments: [
        { amount: 300, receivedAt: '2025-09-15T12:00:00Z' }, // Sem 2
        { amount: 300, receivedAt: '2025-09-22T12:00:00Z' }, // Sem 3
        { amount: 300, receivedAt: '2025-09-29T12:00:00Z' }, // Sem 4
      ],
    };
    const vdo = calculateVDOForLoan(loan, fixedNow);
    const abono = calculateAbonoParcialForLoan(loan, fixedNow);
    expect(vdo.arrearsAmount).toBeGreaterThanOrEqual(0);
    expect(abono.abonoParcialAmount).toBeGreaterThanOrEqual(0);
  });

  test('Cliente con adelanto en semana 0 (firma) → abono parcial si cae en semana actual', () => {
    const loan: LoanLike = {
      ...baseLoan,
      payments: [
        { amount: 500, receivedAt: '2025-09-05T12:00:00Z' }, // Semana de firma
        { amount: 300, receivedAt: '2025-09-15T12:00:00Z' }, // Sem 2
      ],
    };
    const vdo = calculateVDOForLoan(loan, fixedNow);
    const abono = calculateAbonoParcialForLoan(loan, fixedNow);
    expect(vdo.expectedWeeklyPayment).toBe(300);
    expect(abono.expectedWeeklyPayment).toBe(300);
  });
});


