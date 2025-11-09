import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Db, ObjectId } from 'mongodb';
import { AnalysisDoc, RealEstateDoc, SimilarPropertyDoc } from '../types/realstate.js';

const REPORTS_DIR = path.resolve('reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export async function generateReport(db: Db, analysisId: string, format: 'pdf' | 'xls') {
  if (!ObjectId.isValid(analysisId)) throw new Error(`Invalid analysis ID: ${analysisId}`);
  const analysis = (await db.collection('analyses').findOne({ _id: new ObjectId(analysisId) })) as AnalysisDoc | null;
  if (!analysis) throw new Error(`Analysis with ID ${analysisId} not found`);

  const property = (await db
    .collection('real_estates')
    .findOne({ _id: new ObjectId(analysis.real_estate_id) })) as RealEstateDoc | null;
  if (!property) throw new Error(`Real estate property with ID ${analysis.real_estate_id} not found`);

  const similar = (await db
    .collection('similar_properties')
    .find({ real_estate_id: analysis.real_estate_id })
    .toArray()) as any[];

  let reportPath: string;
  if (format === 'pdf') {
    reportPath = await generatePdfReport(analysis, property, similar);
  } else if (format === 'xls') {
    reportPath = await generateXlsReport(analysis, property, similar);
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }

  await db.collection('analyses').updateOne({ _id: new ObjectId(analysisId) }, { $set: { report_path: reportPath } });
  const downloadUrl = `/api/v1/report/download/${path.basename(reportPath)}`;
  return { analysis_id: analysisId, report_path: reportPath, download_url: downloadUrl };
}

async function generatePdfReport(analysis: AnalysisDoc, property: RealEstateDoc, similar: SimilarPropertyDoc[]): Promise<string> {
  const filename = path.join(REPORTS_DIR, `analysis_${String((analysis as any)._id)}_${String((property as any)._id)}.pdf`);
  const doc = new PDFDocument({ size: 'LETTER' });
  const stream = fs.createWriteStream(filename);
  doc.pipe(stream);

  doc.fontSize(18).text('Relatório de Análise de Imóvel', { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).text('Detalhes do Imóvel');
  doc.moveDown(0.5);
  const details: Array<[string, string]> = [
    ['Tipo', (property.tipo ?? property.tipo_imovel ?? '').toString()],
    ['Endereço', (property.endereco ?? property.endereco_imovel ?? '').toString()],
    ['Bairro', (property.bairro ?? '').toString()],
    ['Cidade', (property.cidade ?? property.cidade_imovel ?? '').toString()],
    ['CEP', (property.cep_imovel ?? '').toString()],
    ['Área', `${property.area ?? property.area_construida ?? 0} m²`],
    ['Quartos', String(property.numero_quartos ?? 0)],
    ['Banheiros', String(property.banheiros ?? 0)],
    ['Vagas', String(property.vagas ?? 0)],
    ['Valor', `R$ ${(property.valor ?? 0).toFixed(2)}`],
  ];
  details.forEach(([k, v]) => doc.fontSize(10).text(`${k}: ${v}`));
  doc.moveDown();

  doc.fontSize(14).text('Resultados da Análise');
  doc.moveDown(0.5);
  const pc = analysis.price_comparison;
  const analysisRows: Array<[string, string]> = [
    ['Preço Médio do Mercado', `R$ ${pc.average_price.toFixed(2)}`],
    ['Preço Mediano do Mercado', `R$ ${pc.median_price.toFixed(2)}`],
    ['Preço Mínimo Encontrado', `R$ ${pc.min_price.toFixed(2)}`],
    ['Preço Máximo Encontrado', `R$ ${pc.max_price.toFixed(2)}`],
    ['Diferença Percentual', `${pc.price_difference_percentage.toFixed(2)}%`],
    ['Preço por m²', `R$ ${analysis.area_price_ratio.toFixed(2)}/m²`],
    ['Posição no Mercado', analysis.market_position],
  ];
  analysisRows.forEach(([k, v]) => doc.fontSize(10).text(`${k}: ${v}`));
  doc.moveDown();
  doc.fontSize(12).text('Recomendação');
  doc.moveDown(0.3);
  doc.fontSize(10).text(analysis.recommendation);
  doc.moveDown();

  doc.fontSize(12).text('Imóveis Similares Analisados');
  doc.moveDown(0.3);
  (similar as SimilarPropertyDoc[]).slice(0, 20).forEach((s) => {
    doc.fontSize(9).text(`${s.tipo} | ${s.bairro} | Área: ${s.area} m² | Quartos: ${s.numero_quartos} | Banheiros: ${s.banheiros} | Vagas: ${s.vagas} | Valor: R$ ${s.valor.toFixed(2)}`);
  });

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', (e) => reject(e));
  });
  return filename;
}

async function generateXlsReport(analysis: AnalysisDoc, property: RealEstateDoc, similar: SimilarPropertyDoc[]): Promise<string> {
  const filename = path.join(REPORTS_DIR, `analysis_${String((analysis as any)._id)}_${String((property as any)._id)}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet('Resumo');
  const propertySheet = workbook.addWorksheet('Imóvel');
  const analysisSheet = workbook.addWorksheet('Análise');
  const similarSheet = workbook.addWorksheet('Imóveis Similares');

  summary.mergeCells('A1', 'D1');
  summary.getCell('A1').value = 'Relatório de Análise de Imóvel';
  summary.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  const rows: Array<[string, string]> = [
    ['Tipo de Imóvel', (property.tipo ?? property.tipo_imovel ?? '').toString()],
    ['Endereço', (property.endereco ?? property.endereco_imovel ?? '').toString()],
    ['Bairro', (property.bairro ?? '').toString()],
    ['Cidade', (property.cidade ?? property.cidade_imovel ?? '').toString()],
  ];
  rows.forEach((r, i) => summary.addRow(r));

  propertySheet.addRows([
    ['Área (m²)', property.area ?? property.area_construida ?? 0],
    ['Quartos', property.numero_quartos ?? 0],
    ['Banheiros', property.banheiros ?? 0],
    ['Vagas', property.vagas ?? 0],
    ['Valor (R$)', property.valor ?? 0],
  ]);

  const pc = analysis.price_comparison;
  analysisSheet.addRows([
    ['Preço Médio (R$)', pc.average_price],
    ['Preço Mediano (R$)', pc.median_price],
    ['Preço Mínimo (R$)', pc.min_price],
    ['Preço Máximo (R$)', pc.max_price],
    ['Diferença (%)', pc.price_difference_percentage],
    ['Preço por m² (R$)', analysis.area_price_ratio],
    ['Posição no Mercado', analysis.market_position],
    ['Recomendação', analysis.recommendation],
  ]);

  similarSheet.columns = [
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Bairro', key: 'bairro', width: 18 },
    { header: 'Área (m²)', key: 'area', width: 12 },
    { header: 'Quartos', key: 'numero_quartos', width: 10 },
    { header: 'Banheiros', key: 'banheiros', width: 10 },
    { header: 'Vagas', key: 'vagas', width: 10 },
    { header: 'Valor (R$)', key: 'valor', width: 14 },
  ];
  (similar as SimilarPropertyDoc[]).forEach((s) => similarSheet.addRow(s as any));

  await workbook.xlsx.writeFile(filename);
  return filename;
}