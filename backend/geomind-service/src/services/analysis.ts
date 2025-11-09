import { Db, ObjectId } from 'mongodb';
import { AnalysisDoc, PriceComparison, RealEstateDoc, SimilarPropertyDoc } from '../types/realstate.js';

function average(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function determineMarketPosition(propertyPrice: number, stats: PriceComparison): 'below_market' | 'at_market' | 'above_market' {
  const diff = stats.price_difference_percentage || 0;
  if (diff <= -10) return 'below_market';
  if (diff >= 10) return 'above_market';
  return 'at_market';
}

function generateRecommendation(market: string, stats: PriceComparison, property: RealEstateDoc): string {
  const diff = stats.price_difference_percentage || 0;
  const avg = stats.average_price || 0;
  const price = property.valor ?? 0;
  if (market === 'below_market') {
    return `O imóvel está avaliado em R$ ${price.toFixed(2)}, ${Math.abs(diff).toFixed(1)}% abaixo da média de mercado de R$ ${avg.toFixed(2)}. Boa oportunidade de compra.`;
  }
  if (market === 'above_market') {
    return `O imóvel está avaliado em R$ ${price.toFixed(2)}, ${diff.toFixed(1)}% acima da média de mercado de R$ ${avg.toFixed(2)}. Recomenda-se negociar o preço.`;
  }
  return `O imóvel está avaliado em R$ ${price.toFixed(2)}, alinhado à média de mercado de R$ ${avg.toFixed(2)} (diferença de ${diff.toFixed(1)}%).`;
}

export async function analyzeProperty(db: Db, realEstateId: string): Promise<AnalysisDoc> {
  if (!ObjectId.isValid(realEstateId)) {
    throw new Error(`Invalid real estate ID format: ${realEstateId}`);
  }

  const property = (await db.collection('real_estates').findOne({ _id: new ObjectId(realEstateId) })) as RealEstateDoc | null;
  if (!property) throw new Error(`Real estate property with ID ${realEstateId} not found`);

  const similarProps = await db
    .collection('similar_properties')
    .find({ real_estate_id: realEstateId })
    .toArray();
  if (!similarProps.length) throw new Error(`No similar properties found for real estate ID ${realEstateId}`);

  const prices = similarProps.map((p) => (typeof p.valor === 'number' && p.valor > 0 ? p.valor : 0)).filter((v) => v > 0);
  const stats: PriceComparison = {
    average_price: Number(average(prices).toFixed(2)),
    median_price: Number(median(prices).toFixed(2)),
    min_price: prices.length ? Math.min(...prices) : 0,
    max_price: prices.length ? Math.max(...prices) : 0,
    price_difference_percentage: 0,
  };

  const propertyPrice = property.valor ?? 0;
  if (stats.average_price > 0) {
    stats.price_difference_percentage = Number((((propertyPrice - stats.average_price) / stats.average_price) * 100).toFixed(2));
  }

  const area = property.area ?? property.area_construida ?? 0;
  const areaPriceRatio = area > 0 ? propertyPrice / area : 0;
  const marketPosition = determineMarketPosition(propertyPrice, stats);
  const recommendation = generateRecommendation(marketPosition, stats, property);

  const analysis: Omit<AnalysisDoc, '_id'> = {
    real_estate_id: realEstateId,
    price_comparison: stats,
    area_price_ratio: Number(areaPriceRatio.toFixed(2)),
    market_position: marketPosition,
    recommendation,
    analysis_date: new Date(),
    report_path: null,
  };

  const result = await db.collection('analyses').insertOne(analysis as any);
  const doc: AnalysisDoc = { ...analysis, _id: result.insertedId };
  return doc;
}