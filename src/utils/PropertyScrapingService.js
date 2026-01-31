/**
 * Serviço de Scraping para Portais Imobiliários
 * Busca e compara imóveis similares em diferentes plataformas
 */

class PropertyScrapingService {
  static PORTALS = {
    ZAPIMOVEIS: 'zapimoveis',
    VIVAREAL: 'vivareal',
    IMOVELWEB: 'imovelweb',
    OLX: 'olx'
  };

  static PROPERTY_TYPES = {
    APARTAMENTO: 'apartamento',
    CASA: 'casa',
    TERRENO: 'terreno',
    COMERCIAL: 'comercial',
    RURAL: 'rural'
  };

  /**
   * Busca imóveis similares em múltiplos portais
   * @param {Object} searchParams - Parâmetros de busca
   * @returns {Promise<Array>} Lista de imóveis encontrados
   */
  static async searchSimilarProperties(searchParams) {
    const {
      coordinates,
      propertyType,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      radius = 2000, // 2km por padrão
      bedrooms,
      bathrooms
    } = searchParams;

    const results = [];
    const promises = [];

    // Busca em paralelo em todos os portais
    Object.values(this.PORTALS).forEach(portal => {
      promises.push(
        this.searchInPortal(portal, {
          coordinates,
          propertyType,
          minPrice,
          maxPrice,
          minArea,
          maxArea,
          radius,
          bedrooms,
          bathrooms
        }).catch(error => {
          console.error(`Erro ao buscar no portal ${portal}:`, error);
          return [];
        })
      );
    });

    try {
      const portalResults = await Promise.all(promises);
      
      // Consolida resultados de todos os portais
      portalResults.forEach((portalData, index) => {
        const portal = Object.values(this.PORTALS)[index];
        portalData.forEach(property => {
          results.push({
            ...property,
            portal,
            searchTimestamp: new Date().toISOString()
          });
        });
      });

      // Remove duplicatas e ordena por relevância
      return this.deduplicateAndRank(results, searchParams);
    } catch (error) {
      console.error('Erro na busca de imóveis:', error);
      return [];
    }
  }

  /**
   * Busca em um portal específico
   * @param {string} portal - Nome do portal
   * @param {Object} params - Parâmetros de busca
   * @returns {Promise<Array>} Imóveis encontrados
   */
  static async searchInPortal(portal, params) {
    switch (portal) {
      case this.PORTALS.ZAPIMOVEIS:
        return this.searchZapImoveis(params);
      case this.PORTALS.VIVAREAL:
        return this.searchVivaReal(params);
      case this.PORTALS.IMOVELWEB:
        return this.searchImovelWeb(params);
      case this.PORTALS.OLX:
        return this.searchOLX(params);
      default:
        return [];
    }
  }

  /**
   * Busca no ZAP Imóveis
   */
  static async searchZapImoveis(params) {
    try {
      // Simula busca no ZAP (em produção, usaria API oficial ou scraping)
      const mockData = this.generateMockProperties('ZAP Imóveis', params, 15);
      
      // Em produção, faria requisição real:
      // const response = await fetch(`https://glue-api.zapimoveis.com.br/v2/listings`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(this.buildZapQuery(params))
      // });
      
      return mockData;
    } catch (error) {
      console.error('Erro ZAP Imóveis:', error);
      return [];
    }
  }

  /**
   * Busca no Viva Real
   */
  static async searchVivaReal(params) {
    try {
      // Simula busca no Viva Real
      const mockData = this.generateMockProperties('Viva Real', params, 12);
      
      // Em produção:
      // const response = await fetch(`https://api.vivareal.com/v1/listings/search`, {
      //   headers: { 'x-domain': 'www.vivareal.com.br' },
      //   body: JSON.stringify(this.buildVivaRealQuery(params))
      // });
      
      return mockData;
    } catch (error) {
      console.error('Erro Viva Real:', error);
      return [];
    }
  }

  /**
   * Busca no ImovelWeb
   */
  static async searchImovelWeb(params) {
    try {
      // Simula busca no ImovelWeb
      const mockData = this.generateMockProperties('ImovelWeb', params, 8);
      return mockData;
    } catch (error) {
      console.error('Erro ImovelWeb:', error);
      return [];
    }
  }

  /**
   * Busca no OLX
   */
  static async searchOLX(params) {
    try {
      // Simula busca no OLX
      const mockData = this.generateMockProperties('OLX', params, 10);
      return mockData;
    } catch (error) {
      console.error('Erro OLX:', error);
      return [];
    }
  }

  /**
   * Gera dados mock para demonstração
   */
  static generateMockProperties(portal, params, count) {
    const properties = [];
    const { 
      coordinates, 
      propertyType, 
      minPrice = 100000, 
      maxPrice = 1000000,
      minArea = 50,
      maxArea = 300,
      bedrooms: targetBedrooms
    } = params;
    
    for (let i = 0; i < count; i++) {
      const price = this.randomBetween(minPrice, maxPrice);
      const area = this.randomBetween(minArea, maxArea);
      const bedrooms = targetBedrooms || this.randomBetween(1, 4);
      const bathrooms = this.randomBetween(Math.ceil(bedrooms/2), bedrooms + 1);
      
      // Gera coordenadas próximas
      const lat = coordinates.lat + (Math.random() - 0.5) * 0.02;
      const lng = coordinates.lng + (Math.random() - 0.5) * 0.02;
      const parkingSpaces = this.randomBetween(1, 3);
      
      properties.push({
        id: `${portal.toLowerCase()}_${Date.now()}_${i}`,
        title: `${propertyType} ${area}m² - ${bedrooms} quartos`,
        description: `Excelente ${propertyType} com ${bedrooms} quartos, ${bathrooms} banheiros e ${parkingSpaces} vagas`,
        price: price,
        area: area,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        parkingSpaces: parkingSpaces,
        propertyType: propertyType,
        coordinates: { lat, lng },
        address: `Rua Exemplo ${i + 1}, Bairro Teste`,
        neighborhood: `Bairro ${Math.floor(Math.random() * 10) + 1}`,
        city: 'São Paulo',
        state: 'SP',
        images: [
          `https://picsum.photos/400/300?random=${i}1`,
          `https://picsum.photos/400/300?random=${i}2`,
          `https://picsum.photos/400/300?random=${i}3`
        ],
        url: `https://${portal.toLowerCase()}.com.br/imovel/${i}`,
        portal: portal,
        publishDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        features: this.generateRandomFeatures(),
        pricePerSqm: Math.round(price / area),
        contactInfo: {
          phone: `(11) 9${Math.floor(Math.random() * 10000)}-${Math.floor(Math.random() * 10000)}`,
          email: `contato${i}@${portal.toLowerCase()}.com`,
          agency: `Imobiliária ${portal} ${i + 1}`
        }
      });
    }
    
    return properties;
  }

  /**
   * Gera características aleatórias
   */
  static generateRandomFeatures() {
    const allFeatures = [
      'Piscina', 'Academia', 'Churrasqueira', 'Playground',
      'Portaria 24h', 'Elevador', 'Garagem', 'Varanda',
      'Ar Condicionado', 'Armários Embutidos', 'Quintal',
      'Área de Serviço', 'Sacada', 'Vista para o Mar',
      'Dependência de Empregada'
    ];
    
    const count = Math.floor(Math.random() * 6) + 2;
    const features = [];
    
    for (let i = 0; i < count; i++) {
      const feature = allFeatures[Math.floor(Math.random() * allFeatures.length)];
      if (!features.includes(feature)) {
        features.push(feature);
      }
    }
    
    return features;
  }

  /**
   * Remove duplicatas e ordena por relevância
   */
  static deduplicateAndRank(properties, searchParams) {
    // Remove duplicatas baseado em coordenadas similares e preço
    const unique = [];
    const seen = new Set();
    
    properties.forEach(property => {
      const key = `${Math.round(property.coordinates.lat * 1000)}_${Math.round(property.coordinates.lng * 1000)}_${property.price}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(property);
      }
    });
    
    // Calcula score de relevância
    unique.forEach(property => {
      property.relevanceScore = this.calculateRelevanceScore(property, searchParams);
    });
    
    // Ordena por relevância
    return unique.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calcula score de relevância
   */
  static calculateRelevanceScore(property, searchParams) {
    let score = 0;
    
    // Proximidade geográfica (peso 30%)
    const distance = this.calculateDistance(
      property.coordinates.lat,
      property.coordinates.lng,
      searchParams.coordinates.lat,
      searchParams.coordinates.lng
    );
    score += Math.max(0, (2000 - distance) / 2000) * 30;
    
    // Compatibilidade de preço (peso 25%)
    if (searchParams.minPrice && searchParams.maxPrice) {
      const priceRange = searchParams.maxPrice - searchParams.minPrice;
      const priceDiff = Math.abs(property.price - (searchParams.minPrice + searchParams.maxPrice) / 2);
      score += Math.max(0, (priceRange - priceDiff) / priceRange) * 25;
    }
    
    // Compatibilidade de área (peso 20%)
    if (searchParams.minArea && searchParams.maxArea) {
      const areaRange = searchParams.maxArea - searchParams.minArea;
      const areaDiff = Math.abs(property.area - (searchParams.minArea + searchParams.maxArea) / 2);
      score += Math.max(0, (areaRange - areaDiff) / areaRange) * 20;
    }
    
    // Tipo de propriedade (peso 15%)
    if (property.propertyType === searchParams.propertyType) {
      score += 15;
    }
    
    // Data de publicação (peso 10%)
    const daysSincePublish = (Date.now() - new Date(property.publishDate).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, (30 - daysSincePublish) / 30) * 10;
    
    return Math.round(score);
  }

  /**
   * Calcula distância entre coordenadas
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Gera número aleatório entre min e max
   */
  static randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Busca por CEP específico
   * @param {string} cep - CEP para busca
   * @param {Object} filters - Filtros adicionais
   * @returns {Promise<Array>} Imóveis na região do CEP
   */
  static async searchByCEP(cep, filters = {}) {
    try {
      // Primeiro, converte CEP em coordenadas
      const coordinates = await this.cepToCoordinates(cep);
      
      if (!coordinates) {
        throw new Error('CEP não encontrado');
      }
      
      // Busca imóveis na região
      return this.searchSimilarProperties({
        coordinates,
        radius: filters.radius || 1000,
        ...filters
      });
    } catch (error) {
      console.error('Erro na busca por CEP:', error);
      return [];
    }
  }

  /**
   * Converte CEP em coordenadas
   */
  static async cepToCoordinates(cep) {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        return null;
      }
      
      // Usa serviço de geocoding para obter coordenadas
      const address = `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`;
      const geoResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );
      
      const geoData = await geoResponse.json();
      
      if (geoData.length > 0) {
        return {
          lat: parseFloat(geoData[0].lat),
          lng: parseFloat(geoData[0].lon)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao converter CEP:', error);
      return null;
    }
  }

  /**
   * Analisa tendências de mercado na região
   * @param {Object} coordinates - Coordenadas da região
   * @param {number} radius - Raio de análise em metros
   * @returns {Promise<Object>} Análise de mercado
   */
  static async analyzeMarketTrends(coordinates, radius = 2000) {
    try {
      const properties = await this.searchSimilarProperties({
        coordinates,
        radius,
        minPrice: 50000,
        maxPrice: 5000000
      });
      
      if (properties.length === 0) {
        return null;
      }
      
      const prices = properties.map(p => p.price).filter(p => p > 0);
      const areas = properties.map(p => p.area).filter(a => a > 0);
      const pricesPerSqm = properties.map(p => p.pricePerSqm).filter(p => p > 0);
      
      return {
        totalProperties: properties.length,
        priceAnalysis: {
          min: Math.min(...prices),
          max: Math.max(...prices),
          average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
          median: this.calculateMedian(prices)
        },
        areaAnalysis: {
          min: Math.min(...areas),
          max: Math.max(...areas),
          average: Math.round(areas.reduce((a, b) => a + b, 0) / areas.length),
          median: this.calculateMedian(areas)
        },
        pricePerSqmAnalysis: {
          min: Math.min(...pricesPerSqm),
          max: Math.max(...pricesPerSqm),
          average: Math.round(pricesPerSqm.reduce((a, b) => a + b, 0) / pricesPerSqm.length),
          median: this.calculateMedian(pricesPerSqm)
        },
        propertyTypes: this.analyzePropertyTypes(properties),
        neighborhoods: this.analyzeNeighborhoods(properties),
        portals: this.analyzePortalDistribution(properties)
      };
    } catch (error) {
      console.error('Erro na análise de tendências:', error);
      return null;
    }
  }

  /**
   * Calcula mediana
   */
  static calculateMedian(values) {
    const sorted = values.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }

  /**
   * Analisa distribuição de tipos de propriedade
   */
  static analyzePropertyTypes(properties) {
    const types = {};
    properties.forEach(p => {
      types[p.propertyType] = (types[p.propertyType] || 0) + 1;
    });
    return types;
  }

  /**
   * Analisa distribuição de bairros
   */
  static analyzeNeighborhoods(properties) {
    const neighborhoods = {};
    properties.forEach(p => {
      neighborhoods[p.neighborhood] = (neighborhoods[p.neighborhood] || 0) + 1;
    });
    return neighborhoods;
  }

  /**
   * Analisa distribuição de portais
   */
  static analyzePortalDistribution(properties) {
    const portals = {};
    properties.forEach(p => {
      portals[p.portal] = (portals[p.portal] || 0) + 1;
    });
    return portals;
  }
}

export default PropertyScrapingService;