import React from 'react';
export const mockClient = {
  name: 'MARIA GUADALUPE BONFIL HERNANDEZ',
  id: '552WJ9',
  phone: '9381704148',
  roles: ['Cliente', 'Aval'],
  since: '10/06/2024',
  leader: {
    name: 'FRANCI PRIMAVERA VALENCIA MARRUFO',
    route: 'RUTA2',
    location: 'NUEVO PROGRESO',
    municipality: 'CARMEN',
    state: 'CAMPECHE',
    phone: '9381838872'
  },
  loanCount: 3
};
export const mockLoans = [{
  id: 'nbh7hqvu',
  date: '09/09/2025',
  status: 'active',
  amount: 3000.0,
  totalAmount: 4200.0,
  paidAmount: 2700.0,
  remainingAmount: 1500.0,
  guarantor: {
    name: 'HILARIA PEREZ RODRIGUEZ',
    phone: '9383852389'
  },
  weekCount: 14,
  interestRate: 0.4,
  interestAmount: 1200.0,
  payments: [{
    id: 1,
    date: '17/09/2025, 06:00',
    expected: 300.0,
    paid: 400.0,
    surplus: 100.0,
    status: 'overpaid'
  }, {
    id: 2,
    date: '24/09/2025, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 3,
    date: '01/10/2025, 06:00',
    expected: 300.0,
    paid: 150.0,
    surplus: 0.0,
    status: 'partial'
  }, {
    id: 4,
    date: '08/10/2025, 06:00',
    expected: 300.0,
    paid: 0.0,
    surplus: 0.0,
    status: 'missed'
  }, {
    id: 5,
    date: '15/10/2025, 06:00',
    expected: 300.0,
    paid: 450.0,
    surplus: 0.0,
    status: 'overpaid'
  }, {
    id: 6,
    date: '22/10/2025, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 7,
    date: '29/10/2025, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 8,
    date: '05/11/2025, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 9,
    date: '12/11/2025, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 10,
    date: '19/11/2025, 06:00',
    expected: 300.0,
    paid: 0.0,
    surplus: 0.0,
    status: 'upcoming'
  }, {
    id: 11,
    date: '26/11/2025, 06:00',
    expected: 300.0,
    paid: 0.0,
    surplus: 0.0,
    status: 'upcoming'
  }, {
    id: 12,
    date: '03/12/2025, 06:00',
    expected: 300.0,
    paid: 0.0,
    surplus: 0.0,
    status: 'upcoming'
  }, {
    id: 13,
    date: '10/12/2025, 06:00',
    expected: 300.0,
    paid: 0.0,
    surplus: 0.0,
    status: 'upcoming'
  }, {
    id: 14,
    date: '17/12/2025, 06:00',
    expected: 300.0,
    paid: 0.0,
    surplus: 0.0,
    status: 'upcoming'
  }]
}, {
  id: 'cmfk2dm262',
  date: '17/09/2024',
  status: 'renewed',
  amount: 3000.0,
  totalAmount: 4200.0,
  paidAmount: 4200.0,
  remainingAmount: 0.0,
  guarantor: {
    name: 'HILARIA PEREZ RODRIGUEZ',
    phone: '9383852389'
  },
  weekCount: 14,
  interestRate: 0.4,
  interestAmount: 1200.0,
  payments: [{
    id: 1,
    date: '24/09/2024, 06:00',
    expected: 300.0,
    paid: 350.0,
    surplus: 50.0,
    status: 'overpaid'
  }, {
    id: 2,
    date: '01/10/2024, 06:00',
    expected: 300.0,
    paid: 250.0,
    surplus: 0.0,
    status: 'partial'
  }, {
    id: 3,
    date: '08/10/2024, 06:00',
    expected: 300.0,
    paid: 0.0,
    surplus: 0.0,
    status: 'missed'
  }, {
    id: 4,
    date: '15/10/2024, 06:00',
    expected: 300.0,
    paid: 650.0,
    surplus: 0.0,
    status: 'overpaid'
  }, {
    id: 5,
    date: '22/10/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 6,
    date: '29/10/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 7,
    date: '05/11/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 8,
    date: '12/11/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 9,
    date: '19/11/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 10,
    date: '26/11/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 11,
    date: '03/12/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 12,
    date: '10/12/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 13,
    date: '17/12/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 14,
    date: '24/12/2024, 06:00',
    expected: 300.0,
    paid: 300.0,
    surplus: 0.0,
    status: 'paid'
  }],
  renovationId: 'xk29sjdm19'
}, {
  id: 'xk29sjdm19',
  date: '12/05/2024',
  status: 'completed',
  amount: 2500.0,
  totalAmount: 3500.0,
  paidAmount: 3500.0,
  remainingAmount: 0.0,
  guarantor: {
    name: 'JUAN PEREZ GOMEZ',
    phone: '9381234567'
  },
  weekCount: 10,
  interestRate: 0.4,
  interestAmount: 1000.0,
  payments: [{
    id: 1,
    date: '19/05/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 2,
    date: '26/05/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 3,
    date: '02/06/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 4,
    date: '09/06/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 5,
    date: '16/06/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 6,
    date: '23/06/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 7,
    date: '30/06/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 8,
    date: '07/07/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 9,
    date: '14/07/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }, {
    id: 10,
    date: '21/07/2024, 06:00',
    expected: 350.0,
    paid: 350.0,
    surplus: 0.0,
    status: 'paid'
  }]
}];