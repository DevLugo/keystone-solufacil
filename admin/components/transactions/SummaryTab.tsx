/** @jsxRuntime classic */
/** @jsx jsx */

import React, { useState, useEffect } from 'react';
import { jsx, Box } from '@keystone-ui/core';
import { gql, useQuery } from '@apollo/client';

const GET_TRANSACTIONS_SUMMARY = gql`
  query GetTransactionsSummary($startDate: String!, $endDate: String!) {
    getTransactionsSummary(startDate: $startDate, endDate: $endDate) {
      date
      locality
      abono
      cashAbono
      bankAbono
      credito
      viatic
      gasoline
      accommodation
      nominaSalary
      externalSalary
      vehiculeMaintenance
      loanGranted
      loanPaymentComission
      loanGrantedComission
      leadComission
      leadExpense
      moneyInvestment
      otro
      balance
      profit
      cashBalance
      bankBalance
    }
  }
`;

interface SummaryTabProps {
  selectedDate: Date;
  refreshKey: number;
}

interface LocalitySummary {
  locality: string;
  municipality: string;
  state: string;
  leaderName: string;
  locationKey: string;
  totalIncome: number;
  totalExpenses: number;
  totalComissions: number;
  balance: number;
  profit: number;
  cashBalance: number;
  bankBalance: number;
  details: any[];
}

export const SummaryTab = ({ selectedDate, refreshKey }: SummaryTabProps) => {
  const { data, loading, error, refetch } = useQuery(GET_TRANSACTIONS_SUMMARY, {
    variables: {
      startDate: selectedDate.toISOString(),
      endDate: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
    },
    skip: !selectedDate
  });

  useEffect(() => {
    if (selectedDate) {
      refetch();
    }
  }, [refreshKey, refetch, selectedDate]);

  const [expandedLocality, setExpandedLocality] = useState<string | null>(null);

  if (!selectedDate) return <div>Seleccione una fecha</div>;
  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const summaryData = data?.getTransactionsSummary || [];

  // CAMBIO: Ahora agrupamos por localidad usando las transacciones individuales
  const groupedByLocality = summaryData.reduce((acc: Record<string, any>, item: any) => {
    // Extraer información de ubicación del campo locality que contiene "Líder - Localidad, Estado"
    let localityName = 'General';
    let municipalityName = '';
    let stateName = '';
    let leaderName = '';
    
    if (item.locality && item.locality !== 'General') {
      // Si contiene " - ", extraer la parte después del " - "
      if (item.locality.includes(' - ')) {
        const parts = item.locality.split(' - ');
        if (parts.length > 1) {
          leaderName = parts[0].trim(); // "ESMERALDA ACOSTA MOO"
          const locationPart = parts[1]; // "CASTAMAY, CAMPECHE, CAMPECHE"
          // Separar localidad, municipio y estado por las comas
          if (locationPart.includes(',')) {
            const locationParts = locationPart.split(',').map((s: string) => s.trim());
            if (locationParts.length >= 3) {
              localityName = locationParts[0];    // "CASTAMAY"
              municipalityName = locationParts[1]; // "CAMPECHE"
              stateName = locationParts[2];       // "CAMPECHE"
            } else if (locationParts.length === 2) {
              // Formato anterior: "LOCALIDAD, ESTADO"
              localityName = locationParts[0];
              stateName = locationParts[1];
              municipalityName = locationParts[0]; // Usar localidad como municipio
            }
          } else {
            localityName = locationPart;
            municipalityName = locationPart;
          }
        }
      } else {
        localityName = item.locality;
        municipalityName = item.locality;
      }
    }
    
    // Crear una clave única que incluya localidad, municipio y estado (como RouteLeadSelector)
    const locationKey = stateName ? `${localityName} · ${municipalityName} · ${stateName} · (${leaderName})` : localityName;
    
    if (!acc[locationKey]) {
      acc[locationKey] = {
        locality: localityName,
        municipality: municipalityName,
        state: stateName,
        leaderName: leaderName,
        locationKey: locationKey,
        totalIncome: 0,
        totalExpenses: 0,
        totalComissions: 0,
        balance: 0,
        profit: 0,
        cashBalance: 0,
        bankBalance: 0,
        details: []
      };
    }
    
    // Calcular totales
    const income = item.abono + item.moneyInvestment;
    const expenses = item.viatic + item.gasoline + item.accommodation + 
                    item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                    item.otro + item.leadExpense; // loanGranted se muestra por separado
    const comissions = item.loanPaymentComission + item.loanGrantedComission + item.leadComission;
    
    // CALCULAR BALANCES EN EL FRONTEND (ingresos - gastos)
    const totalIngresosReales = item.cashAbono + item.bankAbono;
    const totalEgresos = expenses + item.credito + item.loanGranted + comissions;
    
    // CORREGIDO: Balance = Ingresos - Gastos (puede ser negativo)
    let calculatedCashBalance = 0;
    let calculatedBankBalance = 0;
    
    if (totalIngresosReales === 0 && item.moneyInvestment === 0) {
      // CASO 1: No hay ingresos, solo gastos -> Balance negativo
      // Asumir que los gastos se hacen en efectivo por defecto
      calculatedCashBalance = -totalEgresos;
      calculatedBankBalance = 0;
      
    } else if (totalIngresosReales === 0 && item.moneyInvestment > 0) {
      // CASO 2: Solo hay inversión de dinero, no abonos
      // Asumir que la inversión es en efectivo por defecto
      calculatedCashBalance = item.moneyInvestment - totalEgresos;
      calculatedBankBalance = 0;
      
    } else {
      // CASO 3: Hay ingresos reales (abonos), distribuir proporcionalmente
      const cashProportion = item.cashAbono / totalIngresosReales;
      const bankProportion = item.bankAbono / totalIngresosReales;
      
      // Distribuir moneyInvestment proporcionalmente
      const moneyInvestmentCash = item.moneyInvestment * cashProportion;
      const moneyInvestmentBank = item.moneyInvestment * bankProportion;
      
      // Distribuir gastos proporcionalmente
      const cashExpenses = totalEgresos * cashProportion;
      const bankExpenses = totalEgresos * bankProportion;
      
      // Balance final = Ingresos - Gastos
      calculatedCashBalance = (item.cashAbono + moneyInvestmentCash) - cashExpenses;
      calculatedBankBalance = (item.bankAbono + moneyInvestmentBank) - bankExpenses;
    }

    acc[locationKey].totalIncome += income;
    acc[locationKey].totalExpenses += expenses;
    acc[locationKey].totalComissions += comissions;
    acc[locationKey].balance += item.balance;
    acc[locationKey].profit += item.profit;
    acc[locationKey].cashBalance += calculatedCashBalance;
    acc[locationKey].bankBalance += calculatedBankBalance;
    acc[locationKey].details.push(item);

    return acc;
  }, {});

  const localities = Object.values(groupedByLocality) as LocalitySummary[];

  return (
    <Box css={{ padding: '16px' }}>
      {localities.map((locality: any) => (
        <Box key={locality.locationKey} css={{ marginBottom: '24px' }}>
          <h2 css={{ 
            margin: '0 0 16px 0', 
            padding: '8px 16px',
            backgroundColor: '#f7fafc',
            borderRadius: '4px',
            borderLeft: '4px solid #4299e1'
          }}>
            📍 {locality.locationKey}
          </h2>
          {/* Tabla principal con diseño similar al PDF */}
          <table css={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
            <thead>
              <tr css={{ backgroundColor: '#f7fafc' }}>
                <th css={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 'bold' }}>MONTO</th>
                <th css={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold' }}>NÚMERO</th>
                <th css={{ padding: '12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>TOTAL $</th>
              </tr>
            </thead>
            <tbody>
              {/* Créditos */}
              {(() => {
                const creditoTotal = locality.details.reduce((sum: number, item: any) => sum + item.credito, 0);
                // CAMBIO: Ahora cada item en details es una transacción individual
                // Por lo tanto, el conteo es directo: cuántas transacciones tienen credito > 0
                const creditoCount = locality.details.filter((item: any) => item.credito > 0).length;
                if (creditoTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Créditos</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{creditoCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${creditoTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Préstamos */}
              {(() => {
                const prestamoTotal = locality.details.reduce((sum: number, item: any) => sum + item.loanGranted, 0);
                // CAMBIO: Ahora cada item en details es una transacción individual
                // Por lo tanto, el conteo es directo: cuántas transacciones tienen loanGranted > 0
                const prestamoCount = locality.details.filter((item: any) => item.loanGranted > 0).length;
                
                // DEBUG: Log para entender qué está pasando con los préstamos
                if (locality.locality === 'LAURA PATRICIA MAY CIMA - CAMPECHE, CAMPECHE') {
                  console.log('🔍 DEBUG - Préstamos para Laura (TRANSACCIONES INDIVIDUALES):');
                  console.log('   - Total de transacciones individuales:', locality.details.length);
                  console.log('   - Transacciones con loanGranted > 0:', locality.details.filter((item: any) => item.loanGranted > 0));
                  console.log('   - Valores de loanGranted:', locality.details.map((item: any) => ({ 
                    id: item.id,
                    date: item.date, 
                    loanGranted: item.loanGranted,
                    credito: item.credito,
                    viatic: item.viatic
                  })));
                  console.log('   - prestamoCount:', prestamoCount);
                  console.log('   - prestamoTotal:', prestamoTotal);
                }
                
                if (prestamoTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Préstamos</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{prestamoCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${prestamoTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Gastos operativos */}
              {(() => {
                const gastosTotal = locality.details.reduce((sum: number, item: any) => 
                  sum + item.viatic + item.gasoline + item.accommodation + 
                  item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                  item.otro, 0);
                const gastosCount = locality.details.filter((item: any) => 
                  item.viatic > 0 || item.gasoline > 0 || item.accommodation > 0 || 
                  item.nominaSalary > 0 || item.externalSalary > 0 || item.vehiculeMaintenance > 0 || 
                  item.otro > 0).length;
                if (gastosTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Gastos operativos</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{gastosCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${gastosTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Comisiones por abonos */}
              {(() => {
                const comisionAbonosTotal = locality.details.reduce((sum: number, item: any) => 
                  sum + item.loanPaymentComission, 0);
                const comisionAbonosCount = locality.details.filter((item: any) => 
                  item.loanPaymentComission > 0).length;
                if (comisionAbonosTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Comisiones por abonos</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{comisionAbonosCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${comisionAbonosTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}

              {/* Gastos de líder */}
              {(() => {
                const gastosLiderTotal = locality.details.reduce((sum: number, item: any) => 
                  sum + item.leadComission, 0);
                const gastosLiderCount = locality.details.filter((item: any) => 
                  item.leadComission > 0).length;
                if (gastosLiderTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Comisiones de líder</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{gastosLiderCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${gastosLiderTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}

              {/* Gastos de líder */}
              {(() => {
                const gastosLiderTotal = locality.details.reduce((sum: number, item: any) => 
                  sum + item.leadExpense, 0);
                const gastosLiderCount = locality.details.filter((item: any) => 
                  item.leadExpense > 0).length;
                if (gastosLiderTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Gastos de líder</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{gastosLiderCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${gastosLiderTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Comisiones por préstamos otorgados */}
              {(() => {
                const comisionPrestamosTotal = locality.details.reduce((sum: number, item: any) => sum + item.loanGrantedComission, 0);
                const comisionPrestamosCount = locality.details.filter((item: any) => item.loanGrantedComission > 0).length;
                if (comisionPrestamosTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>Comisiones por préstamos</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{comisionPrestamosCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                        ${comisionPrestamosTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Abonos en efectivo */}
              {(() => {
                const abonoEfectivoTotal = locality.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0);
                const abonoEfectivoCount = locality.details.filter((item: any) => item.cashAbono > 0).length;
                if (abonoEfectivoTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>Abonos en efectivo</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{abonoEfectivoCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                        ${abonoEfectivoTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Abonos en banco */}
              {(() => {
                const abonoBancoTotal = locality.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0);
                const abonoBancoCount = locality.details.filter((item: any) => item.bankAbono > 0).length;
                if (abonoBancoTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>Abonos en banco</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{abonoBancoCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                        ${abonoBancoTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
              
              {/* Inversión de dinero */}
              {(() => {
                const inversionTotal = locality.details.reduce((sum: number, item: any) => sum + item.moneyInvestment, 0);
                const inversionCount = locality.details.filter((item: any) => item.moneyInvestment > 0).length;
                if (inversionTotal > 0) {
                  return (
                    <tr>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#3182ce' }}>Inversión de dinero</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{inversionCount}</td>
                      <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#3182ce' }}>
                        ${inversionTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
            </tbody>
          </table>
          
          {/* Resumen de totales y balances */}
          <Box css={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            {/* Columna izquierda - Totales */}
            <Box css={{ flex: 1 }}>
              <h3 css={{ margin: '0 0 12px 0', color: '#2d3748', fontSize: '16px' }}>TOTAL COLOCADO</h3>
              <table css={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                <tbody>
                  <tr>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>Créditos + Préstamos</td>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>
                      ${(locality.details.reduce((sum: number, item: any) => sum + item.credito, 0) + 
                         locality.details.reduce((sum: number, item: any) => sum + item.loanGranted, 0)).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>CUOTA</td>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>
                      ${(locality.totalComissions + locality.details.reduce((sum: number, item: any) => sum + item.loanGrantedComission, 0)).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>COBRANZA</td>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>
                      ${(locality.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0) + 
                         locality.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0)).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Box>
            
            {/* Columna derecha - Balances */}
            <Box css={{ flex: 1 }}>
              <h3 css={{ margin: '0 0 12px 0', color: '#2d3748', fontSize: '16px' }}>BALANCES</h3>
              <table css={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                <tbody>
                  <tr>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>Balance en Efectivo</td>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>
                      ${locality.cashBalance.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>Balance en Banco</td>
                    <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>
                      ${locality.bankBalance.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Box>
          </Box>
        </Box>
      ))}
      {/* Totales Generales */}
      <Box css={{ 
        marginTop: '32px', 
        padding: '16px',
        backgroundColor: '#f7fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <h2 css={{ margin: '0 0 16px 0', color: '#2d3748' }}>Totales Generales</h2>
        <table css={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Concepto</th>
              <th css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Dinero otorgado en créditos</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.credito, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Préstamos otorgados</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.loanGranted, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Gastos operativos</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => 
                  sum + item.viatic + item.gasoline + item.accommodation + 
                  item.nominaSalary + item.externalSalary + item.vehiculeMaintenance + 
                  item.otro + item.leadExpense, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Comisiones</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.totalComissions, 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Comisiones por Préstamos</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => 
                  sum + loc.details.reduce((sum: number, item: any) => sum + item.loanGrantedComission, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#e53e3e' }}>(-) Total Gastos de Líder</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => 
                  sum + loc.details.reduce((sum: number, item: any) => sum + item.leadExpense, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Efectivo</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.cashAbono, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#38a169' }}>(+) Total Abonos en Banco</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#38a169' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.bankAbono, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', color: '#3182ce' }}>(+) Total Inversión de dinero</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#3182ce' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.details.reduce((sum: number, item: any) => sum + item.moneyInvestment, 0), 0).toFixed(2)}
              </td>
            </tr>
            <tr css={{ backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance Total en Efectivo</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.cashBalance, 0).toFixed(2)}
              </td>
            </tr>
            <tr css={{ backgroundColor: '#e2e8f0', fontWeight: 'bold' }}>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0' }}>Balance Total en Banco</td>
              <td css={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                ${localities.reduce((sum: number, loc: LocalitySummary) => sum + loc.bankBalance, 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </Box>
    </Box>
  );
}; 