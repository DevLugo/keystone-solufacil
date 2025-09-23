import type { Context } from '.keystone/types';
import { sanitizeText } from '../utils/text';
import { generateCreditsWithDocumentErrorsReportContent } from './documentErrors';

// ✅ FUNCIÓN PARA GENERAR PDF DE PRUEBA (VERSIÓN CORREGIDA)
export function generateTestPDF(reportType: string, data: any = {}): Buffer {
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    
    // Configurar eventos para capturar el PDF
    doc.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    // Configurar el documento
    doc.fontSize(20).text('📊 REPORTE AUTOMÁTICO', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`Tipo: ${reportType}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generado: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Agregar contenido específico según el tipo de reporte
    switch (reportType) {
      case 'creditos_con_errores':
        doc.fontSize(14).text('📋 CRÉDITOS CON DOCUMENTOS CON ERROR');
        doc.moveDown();
        doc.fontSize(12).text('Este reporte muestra todos los créditos que tienen documentos con errores.');
        doc.moveDown();
        doc.text('• Verificar documentación faltante');
        doc.text('• Revisar formatos incorrectos');
        doc.text('• Validar información requerida');
        doc.moveDown();
        doc.text('• Documentos pendientes de revisión');
        doc.text('• Errores de formato detectados');
        doc.text('• Información incompleta identificada');
        break;
        
      case 'creditos_sin_documentos':
        doc.fontSize(14).text('⚠️ CRÉDITOS SIN DOCUMENTOS');
        doc.moveDown();
        doc.fontSize(12).text('Este reporte identifica créditos que no tienen documentación completa.');
        doc.moveDown();
        doc.text('• Documentos pendientes de entrega');
        doc.text('• Información faltante del cliente');
        doc.text('• Requisitos no cumplidos');
        doc.moveDown();
        doc.text('• Acta de nacimiento pendiente');
        doc.text('• DUI no entregado');
        doc.text('• Comprobante de domicilio faltante');
        break;
        
      case 'creditos_completos':
        doc.fontSize(14).text('✅ CRÉDITOS COMPLETOS');
        doc.moveDown();
        doc.fontSize(12).text('Este reporte muestra todos los créditos con documentación completa.');
        doc.moveDown();
        doc.text('• Documentación al 100%');
        doc.text('• Información verificada');
        doc.text('• Listos para procesamiento');
        doc.moveDown();
        doc.text('• Todos los documentos entregados');
        doc.text('• Información validada');
        doc.text('• Cumple requisitos legales');
        break;
        
      case 'resumen_semanal':
        doc.fontSize(14).text('📊 RESUMEN SEMANAL DE CARTERA');
        doc.moveDown();
        doc.fontSize(12).text('Resumen de la actividad semanal de la cartera de créditos.');
        doc.moveDown();
        doc.text('• Nuevos créditos otorgados');
        doc.text('• Pagos recibidos');
        doc.text('• Estado general de la cartera');
        doc.moveDown();
        doc.text('• Monto total desembolsado');
        doc.text('• Número de clientes atendidos');
        doc.text('• Rendimiento semanal');
        break;
        
      case 'reporte_financiero':
        doc.fontSize(14).text('💰 REPORTE FINANCIERO');
        doc.moveDown();
        doc.fontSize(12).text('Análisis financiero detallado de la cartera de créditos.');
        doc.moveDown();
        doc.text('• Ingresos y egresos');
        doc.text('• Rentabilidad por ruta');
        doc.text('• Proyecciones financieras');
        doc.moveDown();
        doc.text('• Balance general');
        doc.text('• Flujo de caja');
        doc.text('• Indicadores de rentabilidad');
        break;
        
      default:
        doc.fontSize(14).text(`📊 REPORTE: ${reportType.toUpperCase()}`);
        doc.moveDown();
        doc.fontSize(12).text('Reporte generado automáticamente por el sistema.');
        doc.moveDown();
        doc.text('• Información del reporte');
        doc.text('• Datos procesados');
        doc.text('• Resumen ejecutivo');
    }
    
    doc.moveDown(2);
    doc.fontSize(10).text('✅ Generado automáticamente desde Keystone Admin', { align: 'center' });
    doc.fontSize(8).text(`ID del reporte: ${Date.now()}`, { align: 'center' });
    doc.fontSize(8).text(`Versión: 1.0`, { align: 'center' });
    
    // Finalizar el documento
    doc.end();
    
    // Esperar un momento para que se procese
    setTimeout(() => {}, 100);
    
    const result = Buffer.concat(chunks);
    console.log('📱 PDF generado exitosamente, tamaño:', result.length, 'bytes');
    
    return result;
  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    // Retornar un buffer con contenido de error
    return Buffer.from(`Error generando PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ✅ FUNCIÓN ALTERNATIVA PARA GENERAR PDF (USANDO STREAMS)
export async function generatePDFWithStreams(reportType: string, context: Context, routeIds: string[] = []): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      
      // Configurar eventos para capturar el PDF
      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        console.log('📱 PDF generado con streams, tamaño:', result.length, 'bytes');
        resolve(result);
      });
      
      // El header específico se genera en cada función de reporte
      // No agregar contenido genérico aquí
      
      // Agregar contenido específico según el tipo de reporte
      console.log('🎯 Determinando tipo de reporte:', `"${reportType}"`);
      switch (reportType) {
        case 'creditos_con_errores':
          console.log('✅ ENTRANDO A CASO creditos_con_errores');
          try {
            await generateCreditsWithDocumentErrorsReport(doc, context, routeIds);
            console.log('✅ FUNCIÓN generateCreditsWithDocumentErrorsReport COMPLETADA');
          } catch (reportError) {
            console.error('❌ Error en generateCreditsWithDocumentErrorsReport:', reportError);
            doc.fontSize(16).text('Error generando reporte detallado', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text('Se produjo un error al generar el reporte.', { align: 'center' });
            doc.text('Revisa los logs del servidor para más detalles.', { align: 'center' });
          }
          break;
          
        default:
          console.log('⚠️ USANDO CASO DEFAULT para tipo:', reportType);
          doc.fontSize(14).text(`📊 REPORTE: ${reportType.toUpperCase()}`);
          doc.moveDown();
          doc.fontSize(12).text('Reporte generado automáticamente por el sistema.');
      }
      
      // Footer se agrega en cada función específica si es necesario
      
      // Finalizar el documento
      doc.end();
      
    } catch (error) {
      console.error('❌ Error generando PDF con streams:', error);
      reject(error);
    }
  });
}

// ✅ FUNCIÓN PARA GENERAR REPORTE DE CRÉDITOS CON DOCUMENTOS CON ERROR (USANDO FUNCIÓN UNIFICADA)
export async function generateCreditsWithDocumentErrorsReport(doc: any, context: Context, routeIds: string[] = []) {
  try {
    console.log('🎯🎯🎯 FUNCIÓN generateCreditsWithDocumentErrorsReport INICIADA (USANDO FUNCIÓN UNIFICADA) 🎯🎯🎯');
    console.log('📋 Generando reporte de créditos con documentos con error para rutas:', routeIds);
    
    // ✅ GENERAR CONTENIDO DIRECTAMENTE EN EL DOCUMENTO EXISTENTE
    // No usar función unificada que genera PDF completo, sino generar contenido en el doc actual
    await generateCreditsWithDocumentErrorsReportContent(doc, context, routeIds);
    
  } catch (error) {
    console.error('❌ Error generando reporte de créditos con errores:', error);
    doc.fontSize(12).text(`❌ Error generando reporte: ${error instanceof Error ? error.message : 'Unknown error'}`, { align: 'center' });
  }
}
