import { graphql } from '@keystone-6/core';

export interface PaymentInput {
  id?: string;
  amount: number;
  comission: number;
  loanId: string;
  type: string;
  paymentMethod: string;
}

export interface LeadPaymentReceivedResponse {
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

export const PaymentType = graphql.object<PaymentInput>()({
  name: 'Payment',
  fields: {
    id: graphql.field({ 
      type: graphql.String,
      resolve: ({ id }) => id
    }),
    amount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: ({ amount }) => amount
    }),
    comission: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: ({ comission }) => comission
    }),
    loanId: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: ({ loanId }) => loanId
    }),
    type: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: ({ type }) => type
    }),
    paymentMethod: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: ({ paymentMethod }) => paymentMethod
    })
  }
});

export const PaymentInputType = graphql.inputObject({
  name: 'PaymentInputType',
  fields: {
    amount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    comission: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    loanId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    type: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    paymentMethod: graphql.arg({ type: graphql.nonNull(graphql.String) })
  }
});

export const CustomLeadPaymentReceivedType = graphql.object<LeadPaymentReceivedResponse>()({
  name: 'CustomLeadPaymentReceived',
  fields: {
    id: graphql.field({ 
      type: graphql.nonNull(graphql.ID),
      resolve: ({ id }) => id
    }),
    expectedAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: ({ expectedAmount }) => expectedAmount
    }),
    paidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: ({ paidAmount }) => paidAmount
    }),
    cashPaidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: ({ cashPaidAmount }) => cashPaidAmount
    }),
    bankPaidAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: ({ bankPaidAmount }) => bankPaidAmount
    }),
    falcoAmount: graphql.field({ 
      type: graphql.nonNull(graphql.Float),
      resolve: ({ falcoAmount }) => falcoAmount
    }),
    paymentStatus: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: ({ paymentStatus }) => paymentStatus
    }),
    agentId: graphql.field({ 
      type: graphql.nonNull(graphql.ID),
      resolve: ({ agentId }) => agentId
    }),
    leadId: graphql.field({ 
      type: graphql.nonNull(graphql.ID),
      resolve: ({ leadId }) => leadId
    }),
    paymentDate: graphql.field({ 
      type: graphql.nonNull(graphql.String),
      resolve: ({ paymentDate }) => paymentDate
    }),
    payments: graphql.field({ 
      type: graphql.nonNull(graphql.list(graphql.nonNull(PaymentType))),
      resolve: ({ payments }) => payments
    })
  }
});
