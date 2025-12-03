import { Locality } from '../types/financial';
export const mockLocalities: Locality[] = [{
  id: '1',
  name: 'TEABO',
  transactions: [{
    concept: 'Préstamos otorgados',
    quantity: 1,
    total: 6000
  }, {
    concept: 'Comisiones por préstamos',
    quantity: 1,
    total: 160,
    isCommission: true
  }],
  totalPlaced: {
    creditsAndLoans: 6000,
    commissions: 160,
    totalCollection: 0,
    collectionCash: 0,
    collectionBank: 0
  },
  balances: {
    cash: -6160,
    bank: 0
  }
}, {
  id: '2',
  name: 'TIXMEHUAC',
  transactions: [{
    concept: 'Préstamos otorgados',
    quantity: 1,
    total: 9000
  }, {
    concept: 'Comisiones por préstamos',
    quantity: 1,
    total: 240,
    isCommission: true
  }],
  totalPlaced: {
    creditsAndLoans: 9000,
    commissions: 240,
    totalCollection: 0,
    collectionCash: 0,
    collectionBank: 0
  },
  balances: {
    cash: -9240,
    bank: 0
  }
}, {
  id: '3',
  name: 'RUTA1B',
  transactions: [],
  totalPlaced: {
    creditsAndLoans: 0,
    commissions: 0,
    totalCollection: 0,
    collectionCash: 0,
    collectionBank: 0
  },
  balances: {
    cash: 0,
    bank: 0
  }
}, {
  id: '4',
  name: 'CENTRO',
  transactions: [{
    concept: 'Préstamos otorgados',
    quantity: 2,
    total: 7900
  }, {
    concept: 'Comisiones por préstamos',
    quantity: 2,
    total: 270,
    isCommission: true
  }],
  totalPlaced: {
    creditsAndLoans: 7900,
    commissions: 270,
    totalCollection: 4000,
    collectionCash: 2000,
    collectionBank: 2000
  },
  balances: {
    cash: -6170,
    bank: 2000
  }
}];