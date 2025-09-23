export function isLoanActiveOnDate(loan: any, date: Date): boolean {
  const signDate = new Date(loan.signDate);
  const endDate = loan.finishedDate ? new Date(loan.finishedDate) : null;
  
  // El préstamo debe estar firmado antes o en la fecha
  if (signDate > date) {
    return false;
  }
  
  // Si tiene fecha de fin, debe ser después de la fecha
  if (endDate && endDate <= date) {
    return false;
  }
  
  return true;
}

export const calculateWeeksWithoutPayment = (loanId: string, signDate: Date, analysisDate: Date, payments: any[], renewedDate?: Date | null) => {
  try {
    // Filtrar los pagos que pertenecen a este préstamo
    const loanPayments = payments.filter(p => p.loanId === loanId);
    
    if (loanPayments.length === 0) {
      // No hay pagos, calcular desde la fecha de firma
      const timeDiff = analysisDate.getTime() - signDate.getTime();
      return Math.floor(timeDiff / (1000 * 3600 * 24 * 7));
    }
    
    // Obtener la fecha del último pago
    const lastPaymentDate = new Date(Math.max(...loanPayments.map(p => new Date(p.date).getTime())));
    
    // Calcular semanas desde el último pago
    const timeDiff = analysisDate.getTime() - lastPaymentDate.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24 * 7));
  } catch (error) {
    console.error('Error calculando semanas sin pago:', error);
    return 0;
  }
};

export function calculateWeeksBetween(date1: Date, date2: Date): number {
  const timeDiff = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 7));
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
