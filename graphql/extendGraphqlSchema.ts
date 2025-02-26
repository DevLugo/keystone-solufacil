import { graphql } from '@keystone-6/core';
import { create } from 'node:domain';

const PaymentType = graphql.object<{}>()({
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
const CustomLeadPaymentReceivedType = graphql.object<{}>()({
  name: 'CustomLeadPaymentReceived',
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    expectedAmount: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    paidAmount: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    cashPaidAmount: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    bankPaidAmount: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    falcoAmount: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    agentId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    leadId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    paymentDate: graphql.field({ type: graphql.nonNull(graphql.String) }),
    payments: graphql.field({ type: graphql.nonNull(graphql.list(graphql.nonNull(PaymentType))) }),
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
        resolve: async (root, { expectedAmount, cashPaidAmount = 0, bankPaidAmount = 0, agentId, leadId, payments, paymentDate }, context) => {
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
          const leadPaymentReceived = await context.db.LeadPaymentReceived.createOne({
            
            data: {
              expectedAmount: expectedAmount.toFixed(2),
              paidAmount: totalPaidAmount.toFixed(2),
              cashPaidAmount: cashPaidAmount.toFixed(2),
              bankPaidAmount: bankPaidAmount.toFixed(2),
              falcoAmount: falcoAmount > 0 ? falcoAmount.toFixed(2) : '0.00',
              paymentStatus,
              agent: { connect: { id: agentId } },
              lead: { connect: { id: leadId } },
              payments: { 
                create: payments.map(payment => ({ 
                  amount: payment.amount.toFixed(2),
                  comission: payment.comission.toFixed(2),
                  loan: { connect: { id: payment.loanId } },
                  type: payment.type,
                  paymentMethod: payment.paymentMethod,
                })) 
              },
            },
          });
          console.log("---------------1---------------------");
          console.log(leadPaymentReceived);
          console.log("--------------2----------------------");
          return {
            id: leadPaymentReceived.id,
            expectedAmount: parseFloat(leadPaymentReceived.expectedAmount),
            paidAmount: parseFloat(leadPaymentReceived.paidAmount),
            cashPaidAmount: parseFloat(leadPaymentReceived.cashPaidAmount),
            bankPaidAmount: parseFloat(leadPaymentReceived.bankPaidAmount),
            falcoAmount: parseFloat(leadPaymentReceived.falcoAmount),
            paymentStatus: leadPaymentReceived.paymentStatus,
            payments,
            paymentDate,
            agentId,
            leadId,
          };
        },
      }),
    },
  };
});