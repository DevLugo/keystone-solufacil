/** @jsxRuntime classic */
/** @jsx jsx */
import React from 'react';
import { jsx } from '@keystone-ui/core';
import { TextInput } from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { gql, useMutation } from '@apollo/client';

const ADJUST_ACCOUNT_BALANCE = gql`
  mutation AdjustAccountBalance($accountId: String!, $targetAmount: Float!, $counterAccountId: String, $description: String) {
    adjustAccountBalance(accountId: $accountId, targetAmount: $targetAmount, counterAccountId: $counterAccountId, description: $description)
  }
`;

export function Field({ value }: { value: any }) {
  const data = (value as any) || {};
  const accountId = data.id as string | undefined;
  const currentAmount = Number(data.amount || 0);

  const [targetAmount, setTargetAmount] = React.useState<string>('');
  const [counterAccountId, setCounterAccountId] = React.useState<string>('');
  const [description, setDescription] = React.useState<string>('Ajuste manual de balance');
  const [resultMsg, setResultMsg] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(false);

  const [mutate] = useMutation(ADJUST_ACCOUNT_BALANCE);

  const onAdjust = async () => {
    if (!accountId) return;
    const target = parseFloat(targetAmount);
    if (Number.isNaN(target)) {
      setResultMsg('Ingresa un monto objetivo válido');
      return;
    }
    setLoading(true);
    try {
      const res = await mutate({
        variables: {
          accountId,
          targetAmount: target,
          counterAccountId: counterAccountId || null,
          description,
        },
      });
      const payload = (res?.data as any)?.adjustAccountBalance || {};
      setResultMsg(payload.message || 'Ajuste realizado');
    } catch (err: any) {
      setResultMsg(err?.message || 'Error al ajustar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div css={{
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      padding: 12,
      background: '#fff',
      marginTop: 8,
    }}>
      <div css={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>Ajustar balance de la cuenta</div>
      <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div css={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Monto actual</div>
          <div css={{ fontWeight: 700 }}>${currentAmount.toFixed(2)}</div>
        </div>
        <div>
          <div css={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Monto objetivo</div>
          <TextInput value={targetAmount} onChange={(e: any) => setTargetAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <div css={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Cuenta contraparte (opcional)</div>
          <TextInput value={counterAccountId} onChange={(e: any) => setCounterAccountId(e.target.value)} placeholder="ID de cuenta" />
        </div>
        <div>
          <div css={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Descripción</div>
          <TextInput value={description} onChange={(e: any) => setDescription(e.target.value)} />
        </div>
      </div>
      <div css={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button tone="active" size="small" onClick={onAdjust} isDisabled={loading || !accountId}>
          {loading ? 'Ajustando...' : 'Ajustar balance'}
        </Button>
        {resultMsg && <div css={{ fontSize: 12, color: '#334155' }}>{resultMsg}</div>}
      </div>
    </div>
  );
}

export function Cell() {
  return null;
}

export function CardValue() {
  return null;
}

