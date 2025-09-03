/** @jsxRuntime classic */
/** @jsx jsx */
import React, { useMemo, useState } from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { PageContainer, GraphQLErrorNotice } from '@keystone-6/core/admin-ui/components';
import { Select, TextInput } from '@keystone-ui/fields';
import { Button } from '@keystone-ui/button';
import { useQuery, useMutation, gql } from '@apollo/client';
import { LoadingDots } from '@keystone-ui/loading';

const GET_ACCOUNTS_MINIMAL = gql`
  query GetAccountsMinimal($where: AccountWhereInput) {
    accounts(where: $where, orderBy: { name: asc }) {
      id
      name
      type
      amount
      routes { id name }
    }
  }
`;

const ADJUST_ACCOUNT_BALANCE = gql`
  mutation AdjustAccountBalance($accountId: String!, $targetAmount: Float!, $counterAccountId: String, $description: String) {
    adjustAccountBalance(accountId: $accountId, targetAmount: $targetAmount, counterAccountId: $counterAccountId, description: $description)
  }
`;

export default function AjustarCuentaPage() {
  const { data, loading, error, refetch } = useQuery(GET_ACCOUNTS_MINIMAL, { variables: { where: {} } });
  const [mutate] = useMutation(ADJUST_ACCOUNT_BALANCE);

  const accounts = data?.accounts || [];
  const accountOptions = useMemo(() => accounts.map((a: any) => {
    const routeName = a.routes && a.routes.length > 0 ? a.routes[0].name : 'Sin ruta';
    return { label: `${a.name} · ${a.type} · ${routeName}`, value: a.id };
  }), [accounts]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [counterAccountId, setCounterAccountId] = useState<string>('');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('Ajuste manual de balance');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string>('');

  const selectedAccount = useMemo(() => accounts.find((a: any) => a.id === selectedAccountId) || null, [accounts, selectedAccountId]);
  const currentAmount = selectedAccount ? Number(selectedAccount.amount || 0) : 0;

  const doAdjust = async () => {
    if (!selectedAccountId) return;
    const target = parseFloat(targetAmount);
    if (Number.isNaN(target)) {
      setResult('Ingresa un monto objetivo válido');
      return;
    }
    setSubmitting(true);
    setResult('');
    try {
      const res = await mutate({ variables: { accountId: selectedAccountId, targetAmount: target, counterAccountId: counterAccountId || null, description } });
      const payload = (res?.data as any)?.adjustAccountBalance || {};
      setResult(payload.message || 'Ajuste realizado');
      await refetch();
    } catch (err: any) {
      setResult(err?.message || 'Error al ajustar');
    } finally {
      setSubmitting(false);
    }
  };

  const counterOptions = useMemo(() => accounts
    .filter((a: any) => a.id !== selectedAccountId)
    .map((a: any) => {
      const routeName = a.routes && a.routes.length > 0 ? a.routes[0].name : 'Sin ruta';
      return { label: `${a.name} · ${a.type} · ${routeName}`, value: a.id };
    }), [accounts, selectedAccountId]);

  return (
    <PageContainer header="⚙️ Ajustar Cuenta">
      <Box css={{ padding: 24 }}>
        {error && <GraphQLErrorNotice errors={[error]} networkError={undefined} />}
        {loading && <LoadingDots label="Cargando cuentas..." />}

        {!loading && (
          <div css={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, maxWidth: 720 }}>
            <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div css={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Cuenta</div>
                <Select value={accountOptions.find((o: any) => o.value === selectedAccountId) || null} options={accountOptions} onChange={(opt: any) => setSelectedAccountId(opt?.value || '')} placeholder="Seleccionar cuenta" />
              </div>
              <div>
                <div css={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Saldo actual</div>
                <div css={{ fontWeight: 700, fontSize: 18 }}>
                  ${currentAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <div css={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Monto objetivo</div>
                <TextInput value={targetAmount} onChange={(e: any) => setTargetAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <div css={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Cuenta contraparte (opcional)</div>
                <Select value={counterOptions.find((o: any) => o.value === counterAccountId) || null} options={counterOptions} onChange={(opt: any) => setCounterAccountId(opt?.value || '')} placeholder="Seleccionar cuenta contraparte" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div css={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Descripción</div>
                <TextInput value={description} onChange={(e: any) => setDescription(e.target.value)} />
              </div>
            </div>

            <div css={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <Button tone="active" onClick={doAdjust} isDisabled={submitting || !selectedAccountId}>
                {submitting ? 'Ajustando...' : 'Ajustar balance'}
              </Button>
              {result && <div css={{ fontSize: 12, color: '#334155' }}>{result}</div>}
            </div>
          </div>
        )}
      </Box>
    </PageContainer>
  );
}

