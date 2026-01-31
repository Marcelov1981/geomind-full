/**
 * Serviço de Geolocalização Reversa
 * Converte coordenadas em endereços e informações de localização
 */

import ApiKeyStore from './ApiKeyStore.js'

// Helper para compatibilidade entre Vite e Node.js
const getEnv = (key) => {
  // Verifica import.meta.env (Vite)
  try {
    // eslint-disable-next-line
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // eslint-disable-next-line
      return import.meta.env[key];
    }
  } catch {
    // Ignora erro de acesso
  }
  
  // Verifica process.env (Node.js)
  try {
    // eslint-disable-next-line
    if (typeof process !== 'undefined' && process.env) {
      // eslint-disable-next-line
      return process.env[key];
    }
  } catch {
    // Ignora erro de acesso
  }
  
  return undefined;
};

class GeoLocationService {
  static API_KEYS = {
    OPENCAGE: ApiKeyStore.get('OPENCAGE') || getEnv('VITE_OPENCAGE_API_KEY'),
    MAPBOX: ApiKeyStore.get('MAPBOX') || getEnv('VITE_MAPBOX_API_KEY'),
    GOOGLE: ApiKeyStore.get('GOOGLE_MAPS') || getEnv('VITE_GOOGLE_MAPS_API_KEY')
  };

  /**
   * Busca reversa de endereço usando múltiplas APIs
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Informações de localização
   */
  static async reverseGeocode(lat, lng) {
    const results = [];
    
    try {
      // Tenta OpenCage primeiro (gratuito até 2500 req/dia)
      if (this.API_KEYS.OPENCAGE) {
        const opencageResult = await this.reverseGeocodeOpenCage(lat, lng);
        if (opencageResult) results.push(opencageResult);
      }

      // Tenta Mapbox como backup
      if (this.API_KEYS.MAPBOX && results.length === 0) {
        const mapboxResult = await this.reverseGeocodeMapbox(lat, lng);
        if (mapboxResult) results.push(mapboxResult);
      }

      // Google Maps como último recurso
      if (this.API_KEYS.GOOGLE && results.length === 0) {
        const googleResult = await this.reverseGeocodeGoogle(lat, lng);
        if (googleResult) results.push(googleResult);
      }

      // Se nenhuma API funcionou, usa serviço gratuito
      if (results.length === 0) {
        const nominatimResult = await this.reverseGeocodeNominatim(lat, lng);
        if (nominatimResult) results.push(nominatimResult);
      }

      return this.consolidateResults(results, lat, lng);
    } catch (error) {
      console.error('Erro na busca reversa de geolocalização:', error);
      return this.createFallbackResult(lat, lng);
    }
  }

  /**
   * Busca reversa usando OpenCage API
   */
  static async reverseGeocodeOpenCage(lat, lng) {
    try {
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${this.API_KEYS.OPENCAGE}&language=pt&pretty=1`
      );
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        return this.formatOpenCageResult(result);
      }
    } catch (error) {
      console.error('Erro OpenCage:', error);
    }
    return null;
  }

  /**
   * Busca reversa usando Mapbox API
   */
  static async reverseGeocodeMapbox(lat, lng) {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${this.API_KEYS.MAPBOX}&language=pt`
      );
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return this.formatMapboxResult(data.features[0]);
      }
    } catch (error) {
      console.error('Erro Mapbox:', error);
    }
    return null;
  }

  /**
   * Busca reversa usando Google Maps API
   */
  static async reverseGeocodeGoogle(lat, lng) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.API_KEYS.GOOGLE}&language=pt-BR`
      );
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        return this.formatGoogleResult(data.results[0]);
      }
    } catch (error) {
      console.error('Erro Google Maps:', error);
    }
    return null;
  }

  /**
   * Busca reversa usando Nominatim (OpenStreetMap) - Gratuito
   */
  static async reverseGeocodeNominatim(lat, lng) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt-BR&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'GeoMind-SaaS/1.0'
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.address) {
        return this.formatNominatimResult(data);
      }
    } catch (error) {
      console.error('Erro Nominatim:', error);
    }
    return null;
  }

  /**
   * Formata resultado do OpenCage
   */
  static formatOpenCageResult(result) {
    const components = result.components;
    
    return {
      provider: 'OpenCage',
      formatted_address: result.formatted,
      street: components.road || components.street,
      number: components.house_number,
      neighborhood: components.neighbourhood || components.suburb,
      city: components.city || components.town || components.village,
      state: components.state,
      country: components.country,
      postal_code: components.postcode,
      confidence: result.confidence,
      accuracy: this.getAccuracyFromConfidence(result.confidence)
    };
  }

  /**
   * Formata resultado do Mapbox
   */
  static formatMapboxResult(feature) {
    const context = feature.context || [];
    
    return {
      provider: 'Mapbox',
      formatted_address: feature.place_name,
      street: this.extractFromContext(context, 'address'),
      neighborhood: this.extractFromContext(context, 'neighborhood'),
      city: this.extractFromContext(context, 'place'),
      state: this.extractFromContext(context, 'region'),
      country: this.extractFromContext(context, 'country'),
      postal_code: this.extractFromContext(context, 'postcode'),
      confidence: feature.relevance || 0.8,
      accuracy: 'high'
    };
  }

  /**
   * Formata resultado do Google Maps
   */
  static formatGoogleResult(result) {
    const components = result.address_components;
    
    return {
      provider: 'Google',
      formatted_address: result.formatted_address,
      street: this.extractGoogleComponent(components, 'route'),
      number: this.extractGoogleComponent(components, 'street_number'),
      neighborhood: this.extractGoogleComponent(components, 'sublocality'),
      city: this.extractGoogleComponent(components, 'locality'),
      state: this.extractGoogleComponent(components, 'administrative_area_level_1'),
      country: this.extractGoogleComponent(components, 'country'),
      postal_code: this.extractGoogleComponent(components, 'postal_code'),
      confidence: 0.9,
      accuracy: 'high'
    };
  }

  /**
   * Formata resultado do Nominatim
   */
  static formatNominatimResult(data) {
    const address = data.address;
    
    return {
      provider: 'Nominatim',
      formatted_address: data.display_name,
      street: address.road,
      number: address.house_number,
      neighborhood: address.neighbourhood || address.suburb,
      city: address.city || address.town || address.village,
      state: address.state,
      country: address.country,
      postal_code: address.postcode,
      confidence: 0.7,
      accuracy: 'medium'
    };
  }

  /**
   * Consolida resultados de múltiplas APIs
   */
  static consolidateResults(results, lat, lng) {
    if (results.length === 0) {
      return this.createFallbackResult(lat, lng);
    }

    // Usa o resultado com maior confiança
    const bestResult = results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return {
      ...bestResult,
      coordinates: { lat, lng },
      timestamp: new Date().toISOString(),
      alternatives: results.filter(r => r !== bestResult)
    };
  }

  /**
   * Cria resultado de fallback quando APIs falham
   */
  static createFallbackResult(lat, lng) {
    return {
      provider: 'Fallback',
      formatted_address: `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      coordinates: { lat, lng },
      confidence: 0.1,
      accuracy: 'low',
      timestamp: new Date().toISOString(),
      error: 'Não foi possível determinar o endereço'
    };
  }

  /**
   * Extrai componente do contexto Mapbox
   */
  static extractFromContext(context, type) {
    const item = context.find(c => c.id.startsWith(type));
    return item ? item.text : null;
  }

  /**
   * Extrai componente do Google Maps
   */
  static extractGoogleComponent(components, type) {
    const component = components.find(c => c.types.includes(type));
    return component ? component.long_name : null;
  }

  /**
   * Converte confiança em precisão
   */
  static getAccuracyFromConfidence(confidence) {
    if (confidence >= 0.9) return 'very_high';
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Busca informações de bairro e região
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} Informações detalhadas da região
   */
  static async getRegionInfo(lat, lng) {
    try {
      const locationData = await this.reverseGeocode(lat, lng);
      
      return {
        neighborhood: locationData.neighborhood,
        city: locationData.city,
        state: locationData.state,
        postal_code: locationData.postal_code,
        region_type: this.classifyRegion(locationData),
        market_area: this.getMarketArea(locationData)
      };
    } catch (error) {
      console.error('Erro ao obter informações da região:', error);
      return null;
    }
  }

  /**
   * Classifica o tipo de região
   */
  static classifyRegion(locationData) {
    const city = locationData.city?.toLowerCase() || '';
    const neighborhood = locationData.neighborhood?.toLowerCase() || '';
    
    // Lógica simples de classificação
    if (city.includes('centro') || neighborhood.includes('centro')) {
      return 'centro';
    }
    if (neighborhood.includes('jardim') || neighborhood.includes('vila')) {
      return 'residencial';
    }
    if (neighborhood.includes('industrial')) {
      return 'industrial';
    }
    
    return 'misto';
  }

  /**
   * Determina área de mercado imobiliário
   */
  static getMarketArea(locationData) {
    // Implementação básica - pode ser expandida
    return {
      zone: locationData.neighborhood || locationData.city,
      market_segment: 'residencial', // Padrão
      price_range: 'medio' // Padrão
    };
  }

  /**
   * Calcula distância entre duas coordenadas
   * @param {number} lat1 - Latitude 1
   * @param {number} lng1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lng2 - Longitude 2
   * @returns {number} Distância em metros
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distância em metros
  }

  /**
   * Verifica se coordenadas estão dentro de um raio
   * @param {number} centerLat - Latitude central
   * @param {number} centerLng - Longitude central
   * @param {number} targetLat - Latitude alvo
   * @param {number} targetLng - Longitude alvo
   * @param {number} radiusMeters - Raio em metros
   * @returns {boolean} True se está dentro do raio
   */
  static isWithinRadius(centerLat, centerLng, targetLat, targetLng, radiusMeters) {
    const distance = this.calculateDistance(centerLat, centerLng, targetLat, targetLng);
    return distance <= radiusMeters;
  }
}

export default GeoLocationService;
