import { Db } from 'mongodb';
import * as cheerio from 'cheerio';
import { RealEstateDoc, SimilarPropertyDoc } from '../types/realstate.js';

const BASE_URL = 'https://www.zapimoveis.com.br';

function buildSearchUrl(propertyType: string, city: string, neighborhood?: string): string {
  const zapType = propertyType?.toLowerCase().includes('apart') ? 'apartamentos' : 'imoveis';
  const cityFormatted = city.toLowerCase().replace(/\s+/g, '-');
  let url = `${BASE_URL}/${zapType}/venda/${cityFormatted}`;
  if (neighborhood) {
    const nf = neighborhood.toLowerCase().replace(/\s+/g, '-');
    url += `/${nf}`;
  }
  return url;
}

function extractPropertyData(card: any): Partial<SimilarPropertyDoc> {
  const data: Partial<SimilarPropertyDoc> = {};
  const typeText = card.find('.property-type').text().trim().toLowerCase();
  data.tipo = typeText.includes('apart') ? 'apartamento' : typeText ? 'casa' : 'unknown';

  const addressText = card.find('.property-card__address').text().trim();
  if (addressText) {
    const parts = addressText.split(',');
    if (parts.length >= 3) {
      data.endereco = parts[0].trim();
      data.bairro = parts[1].trim();
      data.cidade = parts[2].trim();
    } else {
      data.endereco = addressText;
      data.bairro = '';
      data.cidade = '';
    }
  } else {
    data.endereco = '';
    data.bairro = '';
    data.cidade = '';
  }

  const areaText = card.find('.property-card__detail-area').text().trim();
  const areaMatch = areaText.match(/(\d+)\s*m²/);
  data.area = areaMatch ? Number(areaMatch[1]) : 0;

  const bedText = card.find('.property-card__detail-room').text().trim();
  const bedMatch = bedText.match(/(\d+)\s*quarto/);
  data.numero_quartos = bedMatch ? Number(bedMatch[1]) : 0;

  const bathText = card.find('.property-card__detail-bathroom').text().trim();
  const bathMatch = bathText.match(/(\d+)\s*banheiro/);
  data.banheiros = bathMatch ? Number(bathMatch[1]) : 0;

  const garageText = card.find('.property-card__detail-garage').text().trim();
  const garageMatch = garageText.match(/(\d+)\s*vaga/);
  data.vagas = garageMatch ? Number(garageMatch[1]) : 0;

  const priceText = card.find('.property-card__price').text().trim();
  const priceMatch = priceText.match(/R\$\s*(\d+\.?\d*\.?\d*)/);
  data.valor = priceMatch ? Number(priceMatch[1].replace(/\./g, '')) : 0;

  const href = card.find('a.property-card__link').attr('href');
  data.url = href ? (href.startsWith('http') ? href : `${BASE_URL}${href}`) : '';

  return data;
}

export async function searchSimilarProperties(realEstate: RealEstateDoc, maxResults = 10): Promise<Partial<SimilarPropertyDoc>[]> {
  const tipo = realEstate.tipo ?? realEstate.tipo_imovel ?? '';
  const cidade = realEstate.cidade ?? realEstate.cidade_imovel ?? '';
  const bairro = realEstate.bairro ?? '';

  const url = buildSearchUrl(tipo, cidade, bairro);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' } });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);

  const cards = $('.card-container').toArray().slice(0, maxResults);
  const results: Partial<SimilarPropertyDoc>[] = cards.map((el) => extractPropertyData($(el)));

  // Sort by a simple heuristic (prefer filled fields and price closeness if property valor is present)
  const targetPrice = realEstate.valor ?? 0;
  results.sort((a, b) => {
    const filledA = Object.values(a).filter((v) => v !== undefined && v !== null && v !== '').length;
    const filledB = Object.values(b).filter((v) => v !== undefined && v !== null && v !== '').length;
    const diffA = targetPrice && a.valor ? Math.abs(targetPrice - a.valor) : 0;
    const diffB = targetPrice && b.valor ? Math.abs(targetPrice - b.valor) : 0;
    return filledB - filledA || diffA - diffB;
  });

  return results.slice(0, maxResults);
}

export async function saveSimilarProperties(db: Db, realEstateId: string, similar: Partial<SimilarPropertyDoc>[]): Promise<void> {
  if (!similar.length) return;
  const docs = similar.map((s) => ({
    real_estate_id: realEstateId,
    tipo: s.tipo ?? '',
    endereco: s.endereco ?? '',
    bairro: s.bairro ?? '',
    cidade: s.cidade ?? '',
    area: s.area ?? 0,
    numero_quartos: s.numero_quartos ?? 0,
    banheiros: s.banheiros ?? 0,
    vagas: s.vagas ?? 0,
    valor: s.valor ?? 0,
    url: s.url ?? '',
    search_date: new Date(),
  }));
  await db.collection('similar_properties').insertMany(docs as any);
}