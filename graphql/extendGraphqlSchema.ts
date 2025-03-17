import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';
import { Decimal } from '@prisma/client/runtime/library';

interface PaymentInput {
  amount: number;
  comission: number;
  loanId: string;
  type: string;
  paymentMethod: string;
}

interface LeadPaymentReceivedResponse {
  id: string;
  expectedAmount: number;
  paidAmount: number;
  cashPaidAmount: number;
  bankPaidAmount: number;
  falcoAmount: number;
  paymentStatus: string;
  payments: PaymentInput[];
  paymentDate: string;
  agentId: string;
  leadId: string;
}

const PaymentType = graphql.object<PaymentInput>()({
  name: 'Payment',
  fields: {
    amount: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    comission: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    loanId: graphql.field({ type: graphql.nonNull(graphql.String) }),
    type: graphql.field({ type: graphql.nonNull(graphql.String) }),
    paymentMethod: graphql.field({ type: graphql.nonNull(graphql.String) }),
  },
});

const PaymentInputType = graphql.inputObject({
  name: 'PaymentInput',
  fields: {
    amount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    comission: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    loanId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    type: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    paymentMethod: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
});

// Definir el tipo de objeto LeadPaymentReceived
const CustomLeadPaymentReceivedType = graphql.object<LeadPaymentReceivedResponse>()({
  name: 'CustomLeadPaymentReceived',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    expectedAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.expectedAmount?.toString() || '0')
    }),
    paidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.paidAmount?.toString() || '0')
    }),
    cashPaidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.cashPaidAmount?.toString() || '0')
    }),
    bankPaidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.bankPaidAmount?.toString() || '0')
    }),
    falcoAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: (item) => parseFloat(item.falcoAmount?.toString() || '0')
    }),
    paymentStatus: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: (item) => item.paymentStatus || 'FALCO'
    }),
    agentId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    leadId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    paymentDate: graphql.field({ type: graphql.nonNull(graphql.String) }),
    payments: graphql.field({ 
      type: graphql.nonNull(graphql.list(graphql.nonNull(PaymentType))),
      resolve: (item) => item.payments || []
    }),
  },
});

export const extendGraphqlSchema = graphql.extend(base => {
  return {
    mutation: {
      createCustomLeadPaymentReceived: graphql.field({
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
          console.log("AKA", paymentDate);
          cashPaidAmount = cashPaidAmount ?? 0;
          bankPaidAmount = bankPaidAmount ?? 0;
          const totalPaidAmount = cashPaidAmount + bankPaidAmount;
          const falcoAmount = expectedAmount - totalPaidAmount;
          let paymentStatus = 'FALCO';

          if (totalPaidAmount >= expectedAmount) {
            paymentStatus = 'COMPLETE';
          } else if (totalPaidAmount > 0 && totalPaidAmount < expectedAmount) {
            paymentStatus = 'PARTIAL';
          }
          console.log(".......",payments);
          // Primero crear el LeadPaymentReceived sin los payments
          const leadPaymentReceived = await context.db.LeadPaymentReceived.createOne({
            data: {
              expectedAmount: expectedAmount.toFixed(2),
              paidAmount: totalPaidAmount.toFixed(2),
              cashPaidAmount: cashPaidAmount.toFixed(2),
              bankPaidAmount: bankPaidAmount.toFixed(2),
              falcoAmount: falcoAmount > 0 ? falcoAmount.toFixed(2) : '0.00',
              createdAt: new Date(paymentDate),
              paymentStatus,
              agent: { connect: { id: agentId } },
              lead: { connect: { id: leadId } },
            },
          });

          // Luego crear los payments uno por uno de forma secuencial
          console.log('Creando payments de forma secuencial...');
          for (const payment of payments) {
            await context.db.LoanPayment.createOne({
              data: {
                amount: payment.amount.toFixed(2),
                comission: payment.comission.toFixed(2),
                loan: { connect: { id: payment.loanId } },
                type: payment.type,
                paymentMethod: payment.paymentMethod,
                leadPaymentReceived: { connect: { id: leadPaymentReceived.id } },
              },
            });
            console.log(`Payment creado para loan ${payment.loanId}`);
          }
          console.log('Todos los payments han sido creados.');
          console.log("---------------1---------------------");
          console.log(leadPaymentReceived);
          console.log("--------------2----------------------");
          return {
            id: leadPaymentReceived.id,
            expectedAmount: parseFloat(leadPaymentReceived.expectedAmount?.toString() || '0'),
            paidAmount: parseFloat(leadPaymentReceived.paidAmount?.toString() || '0'),
            cashPaidAmount: parseFloat(leadPaymentReceived.cashPaidAmount?.toString() || '0'),
            bankPaidAmount: parseFloat(leadPaymentReceived.bankPaidAmount?.toString() || '0'),
            falcoAmount: parseFloat(leadPaymentReceived.falcoAmount?.toString() || '0'),
            paymentStatus: leadPaymentReceived.paymentStatus || 'FALCO',
            payments: payments.map(p => ({
              amount: p.amount,
              comission: p.comission,
              loanId: p.loanId,
              type: p.type,
              paymentMethod: p.paymentMethod
            })),
            paymentDate,
            agentId,
            leadId,
          };
        },
      }),
    },
  };
});