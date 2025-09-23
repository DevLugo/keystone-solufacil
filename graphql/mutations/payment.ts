import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';
import { safeToNumber } from '../utils/number';
import { calculatePaymentProfitAmount } from '../../utils/loanPayment';
import { PaymentInputType, CustomLeadPaymentReceivedType, LeadPaymentReceivedResponse } from '../types/payment';

export const createCustomLeadPaymentReceived = graphql.field({
  type: graphql.nonNull(CustomLeadPaymentReceivedType),
  args: {
    expectedAmount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    cashPaidAmount: graphql.arg({ type: graphql.Float }),
    bankPaidAmount: graphql.arg({ type: graphql.Float }),
    falcoAmount: graphql.arg({ type: graphql.Float }),
    agentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    leadId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    paymentDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    payments: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(PaymentInputType))) }),
  },
  resolve: async (root, { expectedAmount, cashPaidAmount = 0, bankPaidAmount = 0, agentId, leadId, payments, paymentDate }, context: Context): Promise<LeadPaymentReceivedResponse> => {
    try {
      // Usar transacción para garantizar atomicidad
      // Aumentar timeout a 30 segundos para manejar la latencia del servidor de desarrollo
      return await context.prisma.$transaction(async (tx) => {
      // Log de entrada para debug
      console.log('🚀 createCustomLeadPaymentReceived - Inicio:', {
        expectedAmount,
        cashPaidAmount,
        bankPaidAmount,
        agentId,
        leadId,
        paymentDate,
        paymentsCount: payments?.length || 0
      });
      
      cashPaidAmount = cashPaidAmount ?? 0;
      bankPaidAmount = bankPaidAmount ?? 0;
      const totalPaidAmount = cashPaidAmount + bankPaidAmount;
      // ✅ ELIMINADO: Lógica de Falco - ahora se maneja por separado
      let paymentStatus = 'COMPLETE';
      if (totalPaidAmount < expectedAmount) {
        paymentStatus = 'PARTIAL';
      }

      // Obtener el agente con su ruta para acceder a las cuentas
      const agent = await tx.employee.findUnique({
        where: { id: agentId },
        include: {
          routes: {
            include: {
              accounts: {
                where: {
                  type: { in: ['EMPLOYEE_CASH_FUND', 'BANK'] }
                }
              }
            }
          }
        }
      });

      if (!agent) {
        throw new Error(`Agente no encontrado: ${agentId}`);
      }
      
      if (!agent.routes) {
        throw new Error(`Agente sin ruta asignada: ${agentId}`);
      }

      // Obtener las cuentas de la ruta del agente
      const agentAccounts = agent.routes.accounts || [];
      console.log('🔍 DEBUG - Agent Accounts:', { agentId, routeId: agent.routes.id, accountsCount: agentAccounts.length });

      if (!agentAccounts || agentAccounts.length === 0) {
        throw new Error(`No se encontraron cuentas para la ruta del agente: ${agentId}`);
      }

      const cashAccount = agentAccounts.find((account: any) => account.type === 'EMPLOYEE_CASH_FUND');
      const bankAccount = agentAccounts.find((account: any) => account.type === 'BANK');

      if (!cashAccount) {
        throw new Error('Cuenta de efectivo no encontrada en la ruta del agente');
      }

      if (!bankAccount) {
        throw new Error('Cuenta bancaria no encontrada en la ruta del agente');
      }

      // Crear el LeadPaymentReceived
      console.log('🔍 DEBUG - Creando LeadPaymentReceived con datos:', {
        expectedAmount: expectedAmount.toFixed(2),
        paidAmount: totalPaidAmount.toFixed(2),
        cashPaidAmount: cashPaidAmount.toFixed(2),
        bankPaidAmount: bankPaidAmount.toFixed(2),
        falcoAmount: '0.00', // ✅ ELIMINADO: Falco se maneja por separado
        paymentStatus,
        agentId,
        leadId,
        paymentDate
      });
      
      const leadPaymentReceived = await tx.leadPaymentReceived.create({
        data: {
          expectedAmount: expectedAmount.toFixed(2),
          paidAmount: totalPaidAmount.toFixed(2),
          cashPaidAmount: cashPaidAmount.toFixed(2),
          bankPaidAmount: bankPaidAmount.toFixed(2),
          falcoAmount: '0.00', // ✅ ELIMINADO: Falco se maneja por separado
          createdAt: new Date(paymentDate),
          paymentStatus,
          agentId,
          leadId,
        },
      });
      
      console.log('✅ LeadPaymentReceived creado:', leadPaymentReceived.id);
      // Crear todos los pagos usando createMany para performance
      if (payments.length > 0) {
        const paymentData = payments.map(payment => ({
          amount: payment.amount.toFixed(2),
          comission: payment.comission.toFixed(2),
          loanId: payment.loanId,
          type: payment.type,
          paymentMethod: payment.paymentMethod,
          receivedAt: new Date(paymentDate),
          leadPaymentReceivedId: leadPaymentReceived.id,
        }));

        await tx.loanPayment.createMany({ data: paymentData });

        // Obtener los pagos creados para crear las transacciones
        console.log('🔍 DEBUG - Buscando pagos creados para leadPaymentReceivedId:', leadPaymentReceived.id);
        
        const createdPaymentRecords = await tx.loanPayment.findMany({
          where: { leadPaymentReceivedId: leadPaymentReceived.id }
        });
        
        console.log('🔍 DEBUG - Pagos recuperados:', {
          count: createdPaymentRecords.length,
          firstPayment: createdPaymentRecords[0] ? {
            id: createdPaymentRecords[0].id,
            amount: createdPaymentRecords[0].amount,
            amountType: typeof createdPaymentRecords[0].amount,
            comission: createdPaymentRecords[0].comission,
            comissionType: typeof createdPaymentRecords[0].comission
          } : null
        });

        // Crear las transacciones manualmente (lógica del hook)
        const transactionData = [];
        let cashAmountChange = 0;
        let bankAmountChange = 0;

        console.log('🔍 DEBUG - Procesando pagos:', createdPaymentRecords.length);

        for (const payment of createdPaymentRecords) {
          // Manejo seguro de valores Decimal de Prisma usando la función helper
          const paymentAmount = safeToNumber(payment.amount);
          const comissionAmount = safeToNumber(payment.comission);
          
          console.log('🔍 DEBUG - Payment:', {
            id: payment.id,
            amount: payment.amount,
            comission: payment.comission,
            comissionAmount,
          });

          // Obtener datos del préstamo para calcular returnToCapital y profitAmount
          const loan = await tx.loan.findUnique({
            where: { id: payment.loanId },
            include: { loantype: true }
          });

          // Obtener el líder para obtener su routeId
          const lead = await tx.employee.findUnique({
            where: { id: leadId },
            include: { routes: true }
          });

          let returnToCapital = 0;
          let profitAmount = 0;

          if (loan && loan.loantype) {
            const loanData = {
              amountGived: safeToNumber(loan.amountGived),
              profitAmount: safeToNumber(loan.profitAmount),
              weekDuration: loan.loantype.weekDuration || 0,
              rate: safeToNumber(loan.loantype.rate)
            };

            const paymentCalculation = await calculatePaymentProfitAmount(
              paymentAmount,
              loanData.profitAmount,
              loanData.amountGived + loanData.profitAmount,
              loanData.amountGived,
              0 // loanPayedAmount - asumimos 0 para el primer pago
            );

            returnToCapital = paymentCalculation.returnToCapital;
            profitAmount = paymentCalculation.profitAmount;

          }
          
          // Preparar datos de transacción para el PAGO (INCOME)
          transactionData.push({
            amount: paymentAmount.toFixed(2),
            date: new Date(paymentDate),
            type: 'INCOME',
            incomeSource: payment.paymentMethod === 'CASH' ? 'CASH_LOAN_PAYMENT' : 'BANK_LOAN_PAYMENT',
            loanPaymentId: payment.id,
            loanId: payment.loanId,
            leadId: leadId,
            routeId: agent?.routes?.id,
            snapshotRouteId: agent?.routes?.id,
            returnToCapital: returnToCapital.toFixed(2),
            profitAmount: profitAmount.toFixed(2),
          });

          // Preparar datos de transacción para la COMISIÓN (EXPENSE)
          if (comissionAmount > 0) {
            console.log('🔍 DEBUG - Creando transacción de comisión:', {
              amount: comissionAmount.toFixed(2),
              date: new Date(paymentDate),
              type: 'EXPENSE',
              expenseSource: 'LOAN_PAYMENT_COMISSION',
              sourceAccountId: cashAccount.id,
              loanPaymentId: payment.id,
              loanId: payment.loanId,
              leadId: leadId,
              description: `Comisión por pago de préstamo - ${payment.id}`,
            });
            
            transactionData.push({
              amount: comissionAmount.toFixed(2),
              date: new Date(paymentDate),
              type: 'EXPENSE',
              expenseSource: 'LOAN_PAYMENT_COMISSION',
              sourceAccountId: cashAccount.id,
              loanPaymentId: payment.id,
              loanId: payment.loanId,
              leadId: leadId,
              routeId: agent?.routes?.id,
              snapshotRouteId: agent?.routes?.id,
              description: `Comisión por pago de préstamo - ${payment.id}`,
            });
          }

          // 🆕 MODIFICADO: Registrar según el método de pago
          if (payment.paymentMethod === 'CASH') {
            // Pagos en efectivo van a la cuenta de efectivo
            cashAmountChange += paymentAmount; // Sumar el pago (aumenta efectivo)
            
            // Descontar comisiones de efectivo
            if (comissionAmount > 0) {
              cashAmountChange -= comissionAmount; // Restar comisión (disminuye efectivo)
            }
          } else if (payment.paymentMethod === 'MONEY_TRANSFER') {
            // Pagos por transferencia van directamente a la cuenta bancaria
            bankAmountChange += paymentAmount; // Sumar el pago (aumenta banco)
            
            // Descontar comisiones de efectivo (las comisiones siempre se descuentan de efectivo)
            if (comissionAmount > 0) {
              cashAmountChange -= comissionAmount; // Restar comisión (disminuye efectivo)
            }
          }
        }

        console.log('🔍 DEBUG - Total transacciones a crear:', transactionData.length);
        console.log('🔍 DEBUG - Transacciones de comisiones:', transactionData.filter(t => t.type === 'EXPENSE' && t.expenseSource === 'LOAN_PAYMENT_COMISSION').length);
        console.log('🔍 DEBUG - cashAmountChange calculado:', cashAmountChange);
        console.log('🔍 DEBUG - bankAmountChange calculado:', bankAmountChange);

        // Crear todas las transacciones de una vez
        if (transactionData.length > 0) {
          try {
            await tx.transaction.createMany({ data: transactionData });
            console.log('✅ Transacciones creadas exitosamente');
            
            // ✅ CORREGIR: Actualizar cuentas manualmente ya que createMany no dispara hooks
            // Usar el cashAmountChange que ya se calculó correctamente arriba
            // (incluye todos los pagos menos las comisiones)
            
            // Calcular el cambio neto total (incluyendo transferencias)
            let netCashChange = cashAmountChange;
            let netBankChange = bankAmountChange;
            
            console.log('🔍 DEBUG - Valores antes del cálculo neto:', {
              cashAmountChange,
              bankAmountChange,
              bankPaidAmount,
              netCashChange,
              netBankChange
            });
            
            if (bankPaidAmount > 0) {
              netCashChange -= bankPaidAmount; // Restar la parte que se transfiere al banco
              netBankChange += bankPaidAmount; // Sumar la parte que se transfiere al banco
              console.log('🔍 DEBUG - Después de restar/sumar bankPaidAmount:', {
                bankPaidAmount,
                netCashChange,
                netBankChange
              });
            }
            
            // Actualizar cuenta de efectivo
            if (netCashChange !== 0) {
              const currentCashAmount = parseFloat((cashAccount.amount || 0).toString());
              const newCashAmount = currentCashAmount + netCashChange;
              
              console.log('🔍 DEBUG - Actualizando cuenta de efectivo:', {
                currentAmount: currentCashAmount,
                change: netCashChange,
                newAmount: newCashAmount
              });
              
              await tx.account.update({
                where: { id: cashAccount.id },
                data: { amount: newCashAmount.toFixed(2) }
              });
            }
            
            // Actualizar cuenta bancaria
            if (netBankChange !== 0) {
              const currentBankAmount = parseFloat((bankAccount.amount || 0).toString());
              const newBankAmount = currentBankAmount + netBankChange;
              
              console.log('🔍 DEBUG - Actualizando cuenta bancaria:', {
                currentAmount: currentBankAmount,
                change: netBankChange,
                newAmount: newBankAmount
              });
              
              await tx.account.update({
                where: { id: bankAccount.id },
                data: { amount: newBankAmount.toFixed(2) }
              });
            }
            
          } catch (transactionError) {
            console.error('❌ Error creando transacciones:', transactionError);
            throw transactionError;
          }
        }
      }

      // Preparar respuesta final
      const finalResponse: LeadPaymentReceivedResponse = {
        id: leadPaymentReceived.id,
        expectedAmount: expectedAmount,
        paidAmount: totalPaidAmount,
        cashPaidAmount: cashPaidAmount,
        bankPaidAmount: bankPaidAmount,
        falcoAmount: 0, // ✅ ELIMINADO: Falco se maneja por separado
        paymentStatus,
        payments: payments,
        paymentDate,
        agentId,
        leadId
      };

      console.log('✅ Respuesta final:', finalResponse);
      return finalResponse;
      
      }, { timeout: 300000 }); // 30 segundos de timeout
      
    } catch (error) {
      console.error('❌ Error en createCustomLeadPaymentReceived:', error);
      throw new Error(`Error creating LeadPaymentReceived: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});
