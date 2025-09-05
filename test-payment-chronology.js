// Test rápido para verificar la función generatePaymentChronology
import { generatePaymentChronology } from './admin/utils/paymentChronology.js';

// Test con un crédito simple
const testLoan = {
  id: '1',
  signDate: '2024-01-01T00:00:00Z',
  weekDuration: 12,
  status: 'ACTIVE',
  amountGived: 1000,
  profitAmount: 200,
  payments: [
    {
      id: 'p1',
      receivedAt: '2024-01-08T00:00:00Z',
      amount: 100,
      paymentMethod: 'Efectivo',
      balanceBeforePayment: 1200,
      balanceAfterPayment: 1100,
      paymentNumber: 1
    },
    {
      id: 'p2',
      receivedAt: '2024-01-15T00:00:00Z',
      amount: 100,
      paymentMethod: 'Efectivo',
      balanceBeforePayment: 1100,
      balanceAfterPayment: 1000,
      paymentNumber: 2
    }
  ]
};

console.log('=== Test de generatePaymentChronology ===');
try {
  const result = generatePaymentChronology(testLoan);
  console.log(`Total items: ${result.length}`);
  console.log('Pagos encontrados:', result.filter(item => item.type === 'PAYMENT').length);
  console.log('Sin pago encontrados:', result.filter(item => item.type === 'NO_PAYMENT').length);
  
  if (result.length > 0) {
    console.log('Primer item:', result[0]);
    console.log('Último item:', result[result.length - 1]);
  } else {
    console.log('❌ No se generaron items en la cronología');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
