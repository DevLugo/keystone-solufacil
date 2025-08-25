import React from 'react';
import { Button } from '@keystone-ui/button';
import { FaDownload, FaFilePdf, FaFileExcel } from 'react-icons/fa';

interface ExportButtonProps {
  data: any;
  fileName: string;
  routeName: string;
  monthName: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ 
  data, 
  fileName, 
  routeName, 
  monthName 
}) => {
  const exportToCSV = () => {
    if (!data) return;

    // Crear headers
    const headers = ['LOCALIDAD'];
    data.weeks.forEach((week: string) => {
      headers.push(`${week} - Inicio`);
      headers.push(`${week} - Final`);
      headers.push(`${week} - Cambio`);
      headers.push(`${week} - Otorgados`);
      headers.push(`${week} - Nuevos`);
      headers.push(`${week} - Renovados`);
      headers.push(`${week} - Finalizados`);
      headers.push(`${week} - CV`);
      headers.push(`${week} - % Paga Promedio`);
    });
    headers.push('TOTAL - Inicio');
    headers.push('TOTAL - Final');
    headers.push('TOTAL - Cambio');
    headers.push('TOTAL - % Crecimiento');
    headers.push('TOTAL - Otorgados');
    headers.push('TOTAL - Nuevos');
    headers.push('TOTAL - Renovados');
    headers.push('TOTAL - Finalizados');
    headers.push('TOTAL - CV Promedio');
    headers.push('TOTAL - % Paga Promedio');

    // Crear filas de datos
    const rows = [];
    
    // Obtener todas las localidades
    const allLocalities = new Set<string>();
    Object.values(data.data).forEach((weekData: any) => {
      Object.keys(weekData).forEach(locality => {
        allLocalities.add(locality);
      });
    });

    // Procesar cada localidad
    Array.from(allLocalities).sort().forEach(locality => {
      const row = [locality];
      
      let totalGranted = 0;
      let totalFinished = 0;
      let startValue = 0;
      let endValue = 0;

      // Datos por semana
      data.weeks.forEach((week: string) => {
        const weekData = data.data[week]?.[locality];
        if (weekData) {
          row.push(weekData.activeAtStart.toString());
          row.push(weekData.activeAtEnd.toString());
          row.push((weekData.activeAtEnd - weekData.activeAtStart).toString());
          row.push(weekData.granted.toString());
          row.push((weekData.grantedNew || 0).toString());
          row.push((weekData.grantedRenewed || 0).toString());
          row.push(weekData.finished.toString());
          row.push((weekData.cv || 0).toString());
          row.push((() => {
            const totalActive = weekData.activeAtEnd || 0;
            const clientsPaying = totalActive - (weekData.cv || 0);
            const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
            return paymentRate.toFixed(1) + '%';
          })());
          
          totalGranted += weekData.granted;
          totalFinished += weekData.finished;
          if (startValue === 0) startValue = weekData.activeAtStart;
          endValue = weekData.activeAtEnd;
        } else {
          row.push('0', '0', '0', '0', '0', '0', '0', '0', '0%');
        }
      });

      // Totales de la localidad
      const totalCV = data.weeks.reduce((sum: number, week: string) => {
        const weekData = data.data[week]?.[locality];
        return sum + (weekData?.cv || 0);
      }, 0);
      
      // Calcular semanas activas para el promedio de CV
      const activeWeeksForLocality = data.weeks.reduce((count: number, week: string) => {
        const weekData = data.data[week]?.[locality];
        if (weekData) {
          const hasActivity = weekData.granted > 0 || weekData.finished > 0 || weekData.activeAtStart > 0;
          if (hasActivity) count++;
        }
        return count;
      }, 0);
      
      const avgCV = activeWeeksForLocality > 0 ? totalCV / activeWeeksForLocality : 0;
      
      const totalNew = data.weeks.reduce((sum: number, week: string) => {
        const weekData = data.data[week]?.[locality];
        return sum + (weekData?.grantedNew || 0);
      }, 0);
      
      const totalRenewed = data.weeks.reduce((sum: number, week: string) => {
        const weekData = data.data[week]?.[locality];
        return sum + (weekData?.grantedRenewed || 0);
      }, 0);
      
      row.push(startValue.toString());
      row.push(endValue.toString());
      row.push((endValue - startValue).toString());
      row.push((() => {
        const growthPercent = startValue > 0 
          ? (((endValue - startValue) / startValue) * 100)
          : 0;
        return growthPercent.toFixed(1) + '%';
      })());
      row.push(totalGranted.toString());
      row.push(totalNew.toString());
      row.push(totalRenewed.toString());
      row.push(totalFinished.toString());
      row.push(avgCV.toFixed(1));
      row.push((() => {
        const clientsPaying = endValue - totalCV;
        const paymentRate = endValue > 0 ? (clientsPaying / endValue) * 100 : 0;
        return paymentRate.toFixed(1) + '%';
      })());

      rows.push(row);
    });

    // Agregar fila de totales generales
    const totalRow = ['TOTALES'];
    data.weeks.forEach((week: string) => {
      const weekTotal = data.weeklyTotals[week];
      totalRow.push(weekTotal.activeAtStart.toString());
      totalRow.push(weekTotal.activeAtEnd.toString());
      totalRow.push(weekTotal.netChange.toString());
      totalRow.push(weekTotal.granted.toString());
      totalRow.push((weekTotal.grantedNew || 0).toString());
      totalRow.push((weekTotal.grantedRenewed || 0).toString());
      totalRow.push(weekTotal.finished.toString());
      totalRow.push((weekTotal.cv || 0).toString());
      totalRow.push((() => {
        const totalActive = weekTotal.activeAtEnd || 0;
        const clientsPaying = totalActive - (weekTotal.cv || 0);
        const paymentRate = totalActive > 0 ? (clientsPaying / totalActive) * 100 : 0;
        return paymentRate.toFixed(1) + '%';
      })());
    });
    
    // Totales generales del mes
    const totalCVMonth = Object.values(data.weeklyTotals).reduce((sum: number, week: any) => sum + (week.cv || 0), 0);
    
    // Calcular semanas activas para el promedio de CV general
    const activeWeeksGeneral = Object.values(data.weeklyTotals).reduce((count: number, week: any) => {
      const hasActivity = week.granted > 0 || week.finished > 0 || week.activeAtStart > 0;
      if (hasActivity) count++;
      return count;
    }, 0);
    
    const avgCVMonth = activeWeeksGeneral > 0 ? totalCVMonth / activeWeeksGeneral : 0;
    
    const totalNewMonth = Object.values(data.weeklyTotals).reduce((sum: number, week: any) => sum + (week.grantedNew || 0), 0);
    const totalRenewedMonth = Object.values(data.weeklyTotals).reduce((sum: number, week: any) => sum + (week.grantedRenewed || 0), 0);
    
    totalRow.push(data.summary.totalActiveAtMonthStart.toString());
    totalRow.push(data.summary.totalActiveAtMonthEnd.toString());
    totalRow.push(data.summary.netChangeInMonth.toString());
    totalRow.push((() => {
      const growthPercent = data.summary.totalActiveAtMonthStart > 0 
        ? ((data.summary.netChangeInMonth / data.summary.totalActiveAtMonthStart) * 100)
        : 0;
      return growthPercent.toFixed(1) + '%';
    })());
    totalRow.push(data.summary.totalGrantedInMonth.toString());
    totalRow.push(totalNewMonth.toString());
    totalRow.push(totalRenewedMonth.toString());
    totalRow.push(data.summary.totalFinishedInMonth.toString());
    totalRow.push(avgCVMonth.toFixed(1));
    totalRow.push((() => {
      const clientsPaying = data.summary.totalActiveAtMonthEnd - totalCVMonth;
      const paymentRate = data.summary.totalActiveAtMonthEnd > 0 
        ? (clientsPaying / data.summary.totalActiveAtMonthEnd) * 100 
        : 0;
      return paymentRate.toFixed(1) + '%';
    })());

    rows.push(totalRow);

    // Convertir a CSV
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button
        tone="passive"
        size="small"
        onClick={exportToCSV}
        title="Exportar a Excel"
      >
        <FaFileExcel style={{ marginRight: '6px' }} />
        Excel
      </Button>
      
      <Button
        tone="passive"
        size="small"
        onClick={printReport}
        title="Imprimir reporte"
      >
        <FaFilePdf style={{ marginRight: '6px' }} />
        Imprimir
      </Button>
    </div>
  );
}; 