import React, { useState, useMemo } from 'react';
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { Heading, Box } from '@keystone-ui/core';
import { Button } from '@keystone-ui/button';
import { gql, useMutation, useQuery } from '@apollo/client';

const IMPORT_TOKA_XML = gql`
  mutation ImportTokaXml($xml: String!, $month: String!, $assignments: [TokaAssignmentInput!]) {
    importTokaXml(xml: $xml, month: $month, assignments: $assignments)
  }
`;

type PreviewRow = { cardNumber: string; date: string; amount: number };

type MessageState = { text: string; tone: 'success' | 'error' | '' };

export default function GastosTokaPage() {
  const [month, setMonth] = useState<string>(''); // YYYY-MM
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<MessageState>({ text: '', tone: '' });
  const [importTokaXml] = useMutation(IMPORT_TOKA_XML);
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [cardAssignments, setCardAssignments] = useState<Record<string, string>>({});
  const { data: routesData } = useQuery(gql`
    query RoutesAll { routes(where: {}) { id name } }
  `);

  const routesIndex = useMemo(() => {
    const idx: Record<string, string> = {};
    (routesData?.routes || []).forEach((r: any) => { idx[r.id] = r.name; });
    return idx;
  }, [routesData]);

  const assignmentsArray = useMemo(() => Object.entries(cardAssignments)
    .filter(([cn, rid]) => !!rid)
    .map(([cardNumber, routeId]) => ({ cardNumber, routeId })), [cardAssignments]);

  const summaryByRoute = useMemo(() => {
    const totals: Record<string, number> = {};
    if (!previewRows) return totals;
    const cards = Array.from(new Set(previewRows.map(r => r.cardNumber)));
    cards.forEach(cn => {
      const rid = cardAssignments[cn];
      if (!rid) return;
      const totalCard = previewRows.filter(r => r.cardNumber === cn)
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      totals[rid] = (totals[rid] || 0) + totalCard;
    });
    return totals;
  }, [previewRows, cardAssignments]);

  const totalMovements = previewRows?.length || 0;
  const totalAmount = useMemo(() => (previewRows || []).reduce((s, r) => s + Number(r.amount || 0), 0), [previewRows]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!month || !file) {
      setMessage({ text: 'Seleccione mes y archivo XML', tone: 'error' });
      return;
    }
    if (assignmentsArray.length === 0) {
      setMessage({ text: 'Asigne al menos una tarjeta a una ruta antes de importar', tone: 'error' });
      return;
    }

    // Confirmación con resumen por ruta
    const summaryLines = Object.entries(summaryByRoute)
      .map(([rid, total]) => `- ${routesIndex[rid] || rid}: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
      .join('\n');
    const confirmMsg = `Se importarán ${totalMovements} movimientos por un total de $${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\n\nDistribución por ruta:\n${summaryLines || '(sin asignaciones)'}\n\n¿Deseas continuar?`;
    const ok = window.confirm(confirmMsg);
    if (!ok) return;

    try {
      setLoading(true);
      const text = await file.text();
      await importTokaXml({ variables: { xml: text, month, assignments: assignmentsArray } });
      setMessage({ text: 'Gastos importados correctamente', tone: 'success' });
      // Limpieza post-importación
      setPreviewRows(null);
      setCardAssignments({});
      setSelectedCard('');
      setSelectedRoute('');
    } catch (e: any) {
      setMessage({ text: e.message || 'Error al importar', tone: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ text: '', tone: '' }), 3500);
    }
  };

  const handlePreview = async () => {
    if (!month || !file) {
      setMessage({ text: 'Seleccione mes y archivo XML', tone: 'error' });
      return;
    }
    setPreviewLoading(true);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'application/xml');
      const nodes = Array.from(doc.getElementsByTagName('ecc12:ConceptoEstadoDeCuentaCombustible'));
      const [yearStr, monthStr] = month.split('-');
      const y = Number(yearStr);
      const m = Number(monthStr);
      const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const to = new Date(Date.UTC(y, m, 1, 0, 0, 0));

      const rows: PreviewRow[] = [];
      for (const el of nodes) {
        const ident = el.getAttribute('Identificador') || '';
        const fechaStr = el.getAttribute('Fecha') || '';
        const importeStr = el.getAttribute('Importe') || '0';
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) continue;
        if (!(fecha >= from && fecha < to)) continue;
        const amount = Number(importeStr);
        rows.push({ cardNumber: ident, date: fecha.toISOString(), amount });
      }
      rows.sort((a, b) => a.date.localeCompare(b.date));
      setPreviewRows(rows);
      // Valores por defecto de selección
      const uniqueCards = Array.from(new Set(rows.map(r => r.cardNumber)));
      if (uniqueCards.length === 1) setSelectedCard(uniqueCards[0]);
      // Inicializar asignaciones en blanco para cada tarjeta
      setCardAssignments((prev) => {
        const next = { ...prev };
        uniqueCards.forEach(c => { if (!next[c]) next[c] = ''; });
        return next;
      });
      setMessage({ text: `Cargados ${rows.length} movimientos`, tone: 'success' });
      setTimeout(() => setMessage({ text: '', tone: '' }), 2500);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <PageContainer header={<Heading type="h3">Gastos Toka</Heading>}>
      <Box padding="large">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>Mes</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ padding: 8, border: '1px solid #DDD', borderRadius: 6 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>XML</label>
            <input type="file" accept=".xml" onChange={handleFileChange} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button tone="active" isDisabled={previewLoading} onClick={handlePreview}>
              {previewLoading ? 'Procesando…' : 'Vista previa'}
            </Button>
            <Button tone="positive" isDisabled={loading || assignmentsArray.length === 0} onClick={handleImport}>
              {loading ? 'Importando…' : 'Importar'}
            </Button>
          </div>
          {previewRows && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>
                Movimientos: {totalMovements}
              </span>
              <span style={{ background: '#ECFDF5', color: '#065F46', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>
                Total: ${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {message.text && (
          <div style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 6,
            background: message.tone === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: message.tone === 'success' ? '#065F46' : '#991B1B',
            border: `1px solid ${message.tone === 'success' ? '#A7F3D0' : '#FECACA'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* Preview table y asignaciones */}
        {previewRows && (
          <div style={{ marginTop: 20 }}>
            <Heading type="h4">Vista previa</Heading>
            {/* Selección de tarjeta y asignación masiva */}
            <div style={{ display: 'flex', gap: 12, margin: '8px 0', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Tarjeta</div>
                <select value={selectedCard} onChange={(e) => setSelectedCard(e.target.value)} style={{ padding: 8, border: '1px solid #DDD', borderRadius: 6 }}>
                  <option value="">Todas</option>
                  {Array.from(new Set(previewRows.map(r => r.cardNumber))).map(cn => (
                    <option key={cn} value={cn}>{cn}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Asignar todas a…</div>
                <select value={selectedRoute} onChange={(e) => {
                  const val = e.target.value;
                  setSelectedRoute(val);
                  const uniqueCards = Array.from(new Set(previewRows.map(r => r.cardNumber)));
                  setCardAssignments((prev) => {
                    const next = { ...prev };
                    uniqueCards.forEach(c => { next[c] = val; });
                    return next;
                  });
                }} style={{ padding: 8, border: '1px solid #DDD', borderRadius: 6 }}>
                  <option value="">Selecciona una ruta</option>
                  {(routesData?.routes || []).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Asignación por tarjeta */}
            <div style={{ marginTop: 10, border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #E5E7EB' }}>Tarjeta</th>
                    <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #E5E7EB' }}>Total</th>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #E5E7EB' }}>Ruta</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(previewRows.map(r => r.cardNumber))).map((cn, idx) => {
                    const totalCard = previewRows.filter(r => r.cardNumber === cn).reduce((s, r) => s + Number(r.amount || 0), 0);
                    const zebra = idx % 2 === 1 ? { background: '#FAFAFA' } as React.CSSProperties : {};
                    return (
                      <tr key={cn} style={zebra}>
                        <td style={{ padding: 8, borderBottom: '1px solid #F3F4F6' }}>{cn}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F3F4F6', textAlign: 'right' }}>
                          ${totalCard.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F3F4F6' }}>
                          <select value={cardAssignments[cn] || ''} onChange={(e) => {
                            const val = e.target.value;
                            setCardAssignments((prev) => ({ ...prev, [cn]: val }));
                          }} style={{ padding: 8, border: '1px solid #DDD', borderRadius: 6, minWidth: 240 }}>
                            <option value="">Selecciona una ruta</option>
                            {(routesData?.routes || []).map((r: any) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumen por ruta */}
            <div style={{ marginTop: 12, color: '#374151' }}>
              <strong>Resumen por ruta:</strong>
              <div style={{ marginTop: 6 }}>
                {(() => {
                  const entries = Object.entries(summaryByRoute);
                  if (entries.length === 0) return <div>Sin asignaciones.</div>;
                  return (
                    <ul style={{ paddingLeft: 18 }}>
                      {entries.map(([rid, total]) => (
                        <li key={rid}>{routesIndex[rid] || rid}: ${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>

            {/* Movimientos */}
            <div style={{ marginTop: 18, overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#F9FAFB' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #E5E7EB' }}>Fecha</th>
                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #E5E7EB' }}>Tarjeta</th>
                    <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #E5E7EB' }}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rowsToDisplay = (previewRows || []).filter(row => !selectedCard || row.cardNumber === selectedCard);
                    return rowsToDisplay.map((row: PreviewRow, idx: number) => (
                      <tr key={`${row.cardNumber}-${idx}`} style={idx % 2 === 1 ? { background: '#FAFAFA' } : {}}>
                        <td style={{ padding: 8, borderBottom: '1px solid #F3F4F6' }}>{new Date(row.date).toLocaleString('es-MX')}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F3F4F6' }}>{row.cardNumber}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F3F4F6', textAlign: 'right' }}>
                          ${Number(row.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop: 8, color: '#6B7280' }}>
          Sube el XML del estado de cuenta de combustible (TOKA). Se eliminarán los gastos de gasolina del mes seleccionado en las rutas asignadas y se recrearán según el XML.
        </div>
      </Box>
    </PageContainer>
  );
}

