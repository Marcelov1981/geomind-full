export interface ObjectIdLike {
  toString?: () => string;
}

export interface RealEstateDoc {
  _id?: ObjectIdLike;
  id?: string;
  // Core fields from Python RealEstate model
  nome: string;
  cliente_id: ObjectIdLike | string;
  tipo_imovel: string;
  endereco_imovel: string;
  cidade_imovel: string;
  estado_imovel: string;
  cep_imovel: string;
  area_terreno: number;
  area_construida: number;
  finalidade_avaliacao: string;
  prazo_entrega: string;
  observacoes?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string | null;

  // Optional fields used by legacy scraping/analysis logic
  tipo?: string; // mapped from tipo_imovel when needed
  endereco?: string; // mapped from endereco_imovel
  cidade?: string; // mapped from cidade_imovel
  bairro?: string; // not always available
  area?: number; // mapped from area_construida
  numero_quartos?: number;
  banheiros?: number;
  vagas?: number;
  valor?: number; // price if available
}

export interface SimilarPropertyDoc {
  _id?: ObjectIdLike;
  id?: string;
  real_estate_id: string;
  tipo: string;
  endereco: string;
  bairro: string;
  cidade: string;
  area: number;
  numero_quartos: number;
  banheiros: number;
  vagas: number;
  valor: number;
  url: string;
  search_date?: Date | string;
}

export interface PriceComparison {
  average_price: number;
  median_price: number;
  min_price: number;
  max_price: number;
  price_difference_percentage: number;
}

export type MarketPosition = 'below_market' | 'at_market' | 'above_market';

export interface AnalysisDoc {
  _id?: ObjectIdLike;
  id?: string;
  real_estate_id: string;
  price_comparison: PriceComparison;
  area_price_ratio: number;
  market_position: MarketPosition;
  recommendation: string;
  analysis_date: Date | string;
  report_path?: string | null;
}