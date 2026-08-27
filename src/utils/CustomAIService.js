/**
 * Serviço de IA Personalizada para Análise de Imagens Imobiliárias
 * Substitui o GeminiService com funcionalidades avançadas de geolocalização
 */

import ExifService from './ExifService.js';
import GeoLocationService from './GeoLocationService.js';
import PropertyScrapingService from './PropertyScrapingService.js';
import GoogleGenAIService from './GoogleGenAIService.js';
import POIService from './POIService.js';
import ApiKeyStore from './ApiKeyStore.js';

// Helper para compatibilidade entre Vite e Node.js
const getEnv = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key];
    }
  } catch {
    // Ignora erro de acesso
  }
  
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

class CustomAIService {
  static API_ENDPOINTS = {
    // APIs de IA para análise de imagens
    OPENAI_VISION: 'https://api.openai.com/v1/chat/completions',
    ANTHROPIC_CLAUDE: 'https://api.anthropic.com/v1/messages',
    AZURE_VISION: 'https://api.cognitive.microsoft.com/vision/v3.2/analyze',
    GOOGLE_VISION: 'https://vision.googleapis.com/v1/images:annotate'
  };

  static API_KEYS = {
    OPENAI: ApiKeyStore.get('OPENAI') || getEnv('VITE_OPENAI_API_KEY'),
    ANTHROPIC: ApiKeyStore.get('ANTHROPIC') || getEnv('VITE_ANTHROPIC_API_KEY'),
    AZURE: getEnv('VITE_AZURE_VISION_KEY'),
    GOOGLE: ApiKeyStore.get('GOOGLE_VISION') || getEnv('VITE_GOOGLE_VISION_KEY')
  };

  /**
   * Análise completa de imagem com geolocalização
   * @param {File} imageFile - Arquivo de imagem
   * @param {string} customPrompt - Prompt personalizado
   * @param {Object} propertyInfo - Informações do imóvel
   * @returns {Promise<Object>} Análise completa
   */
  static async analyzeImageWithLocation(imageFile, customPrompt = '', propertyInfo = {}) {
    const startTime = Date.now();
    console.log('🔍 Iniciando análise completa da imagem...');
    console.log('📊 Parâmetros de entrada:', {
      fileName: imageFile?.name,
      fileSize: imageFile?.size,
      fileType: imageFile?.type,
      propertyInfo: Object.keys(propertyInfo),
      hasCustomPrompt: !!customPrompt
    });
    
    try {
      // 1. Extrai metadados EXIF
      console.log('📸 Extraindo metadados EXIF...');
      const exifStartTime = Date.now();
      const metadata = await ExifService.extractMetadata(imageFile);
      console.log(`✅ EXIF extraído em ${Date.now() - exifStartTime}ms:`, {
        hasGPS: !!metadata?.location?.latitude,
        hasDateTime: !!metadata?.datetime,
        hasCameraInfo: !!(metadata?.camera || metadata?.technical)
      });
      
      // 2. Análise de geolocalização
      let locationData = null;
      let marketAnalysis = null;
      let similarProperties = [];
      let amenities = null;
      
      if (metadata?.location?.latitude && metadata?.location?.longitude) {
        console.log('🌍 Processando geolocalização...');
        const geoStartTime = Date.now();
        
        try {
          // Busca reversa de endereço
          console.log('📍 Buscando endereço reverso...');
          locationData = await GeoLocationService.reverseGeocode(
            metadata.location.latitude,
            metadata.location.longitude
          );
          console.log(`✅ Endereço encontrado em ${Date.now() - geoStartTime}ms:`, locationData?.formatted_address);
          
          // Análise de mercado na região
          console.log('📊 Analisando mercado imobiliário...');
          const marketStartTime = Date.now();
          marketAnalysis = await PropertyScrapingService.analyzeMarketTrends(
            {
              lat: metadata.location.latitude,
              lng: metadata.location.longitude
            },
            2000 // 2km de raio
          );
          console.log(`✅ Análise de mercado concluída em ${Date.now() - marketStartTime}ms:`, {
            totalProperties: marketAnalysis?.totalProperties || 0,
            averagePrice: marketAnalysis?.priceAnalysis?.average
          });
          
          // Busca imóveis similares
          console.log('🏠 Buscando imóveis similares...');
          const similarStartTime = Date.now();
          similarProperties = await PropertyScrapingService.searchSimilarProperties({
            coordinates: {
              lat: metadata.location.latitude,
              lng: metadata.location.longitude
            },
            propertyType: propertyInfo.tipo_imovel || 'apartamento',
            minPrice: propertyInfo.valor_estimado ? propertyInfo.valor_estimado * 0.7 : 100000,
            maxPrice: propertyInfo.valor_estimado ? propertyInfo.valor_estimado * 1.3 : 1000000,
            radius: 1500
          });
          console.log(`✅ Busca de similares concluída em ${Date.now() - similarStartTime}ms:`, {
            found: similarProperties?.length || 0
          });
          const poiStart = Date.now();
          amenities = await POIService.nearbyAmenities(metadata.location.latitude, metadata.location.longitude, 1500);
          console.log(`✅ Comodidades mapeadas em ${Date.now() - poiStart}ms:`, { total: amenities?.total || 0 });
        } catch (geoError) {
          console.warn('⚠️ Erro na análise de geolocalização:', geoError.message);
        }
      } else {
        const manualLat = propertyInfo?.coordsLat ? parseFloat(propertyInfo.coordsLat) : null;
        const manualLng = propertyInfo?.coordsLng ? parseFloat(propertyInfo.coordsLng) : null;
        if (manualLat && manualLng) {
          console.log('🌍 Usando coordenadas manuais fornecidas...');
          const geoStartTime = Date.now();
          try {
            console.log('📍 Buscando endereço reverso (manual)...');
            locationData = await GeoLocationService.reverseGeocode(manualLat, manualLng);
            console.log(`✅ Endereço (manual) encontrado em ${Date.now() - geoStartTime}ms:`, locationData?.formatted_address);
            console.log('📊 Analisando mercado (manual)...');
            const marketStartTime = Date.now();
            marketAnalysis = await PropertyScrapingService.analyzeMarketTrends({ lat: manualLat, lng: manualLng }, 2000);
            console.log(`✅ Análise de mercado (manual) concluída em ${Date.now() - marketStartTime}ms:`, { totalProperties: marketAnalysis?.totalProperties || 0 });
            console.log('🏠 Buscando imóveis similares (manual)...');
            const similarStartTime = Date.now();
            similarProperties = await PropertyScrapingService.searchSimilarProperties({
              coordinates: { lat: manualLat, lng: manualLng },
              propertyType: propertyInfo.tipo_imovel || 'apartamento',
              minPrice: propertyInfo.valor_estimado ? propertyInfo.valor_estimado * 0.7 : 100000,
              maxPrice: propertyInfo.valor_estimado ? propertyInfo.valor_estimado * 1.3 : 1000000,
              radius: 1500
            });
            console.log(`✅ Busca de similares (manual) concluída em ${Date.now() - similarStartTime}ms:`, { found: similarProperties?.length || 0 });
            const poiStart = Date.now();
            amenities = await POIService.nearbyAmenities(manualLat, manualLng, 1500);
            console.log(`✅ Comodidades mapeadas (manual) em ${Date.now() - poiStart}ms:`, { total: amenities?.total || 0 });
          } catch (geoError) {
            console.warn('⚠️ Erro na análise geográfica manual:', geoError.message);
          }
        } else {
          console.log('📍 Nenhum dado de localização (GPS ou manual) disponível');
        }
      }
      
      // 3. Análise visual da imagem
      console.log('👁️ Iniciando análise visual...');
      const visualStartTime = Date.now();
      const visualAnalysis = await this.performVisualAnalysis(imageFile, customPrompt);
      console.log(`✅ Análise visual concluída em ${Date.now() - visualStartTime}ms:`, {
        provider: visualAnalysis?.provider,
        confidence: visualAnalysis?.confidence,
        hasAnalysis: !!visualAnalysis?.analysis,
        analysisLength: visualAnalysis?.analysis?.length || 0
      });
      
      // 4. Análise contextual integrada
      console.log('🔗 Gerando análise contextual integrada...');
      const contextStartTime = Date.now();
      const contextualAnalysis = await this.generateContextualAnalysis({
        metadata,
        locationData,
        marketAnalysis,
        similarProperties,
        visualAnalysis,
        propertyInfo,
        customPrompt
      });
      console.log(`✅ Análise contextual concluída em ${Date.now() - contextStartTime}ms`);
      
      // 5. Gerar recomendações
      console.log('💡 Gerando recomendações...');
      const recStartTime = Date.now();
      const recommendations = this.generateRecommendations({
        locationData,
        marketAnalysis,
        similarProperties,
        propertyInfo
      });
      console.log(`✅ Recomendações geradas em ${Date.now() - recStartTime}ms:`, {
        recommendationCount: recommendations?.length || 0
      });
      
      const totalTime = Date.now() - startTime;
      console.log(`🎉 Análise completa concluída em ${totalTime}ms`);
      
      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        aiProvider: visualAnalysis?.provider || 'IA Personalizada GeoMind',
        confidence: visualAnalysis?.confidence || 0.85,
        analysisMethod: 'Multi-Provider AI',
        imageMetadata: metadata,
        locationData,
        marketAnalysis,
        amenities,
        similarProperties: similarProperties.slice(0, 10), // Limita a 10 resultados
        visualAnalysis,
        contextualAnalysis,
        recommendations,
        metadata: {
           processingTime: totalTime,
           timestamp: new Date().toISOString(),
           aiProvider: visualAnalysis?.provider || 'IA Personalizada GeoMind',
           confidence: visualAnalysis?.confidence || 0.85,
           analysisMethod: 'Multi-Provider AI'
         }
      };
      
      // Validações para garantir conteúdo mínimo
      if (!result.visualAnalysis || !result.visualAnalysis.analysis) {
        result.visualAnalysis = {
          provider: 'Análise Local',
          analysis: 'Análise básica da imagem realizada. Para resultados mais detalhados, configure as chaves de API das IAs no arquivo .env',
          confidence: 0.3
        };
      }
      
      if (!result.contextualAnalysis) {
        result.contextualAnalysis = 'Análise contextual não disponível. Configure APIs de geolocalização para análise mais completa.';
      }
      
      if (!result.recommendations) {
        result.recommendations = 'Para recomendações personalizadas, configure as APIs de IA e geolocalização.';
      }
      
      const baseConfidence = visualAnalysis?.confidence || 0.85;
      const locationBoost = locationData ? 0.05 : 0;
      const amenitiesBoost = amenities && amenities.total ? (amenities.total > 10 ? 0.05 : 0.03) : 0;
      const computedConfidence = Math.min(0.95, baseConfidence + locationBoost + amenitiesBoost);
      if (computedConfidence >= 0.9) {
        result.confidence = computedConfidence;
        result.metadata.confidence = computedConfidence;
      }
      console.log('📋 Resultado final:', {
        success: result.success,
        hasVisualAnalysis: !!result.visualAnalysis,
        hasLocationData: !!result.locationData,
        hasMarketAnalysis: !!result.marketAnalysis,
        amenitiesCount: result.amenities?.total || 0,
        similarPropertiesCount: result.similarProperties?.length || 0,
        recommendationsCount: result.recommendations?.length || 0,
        processingTime: totalTime
      });
      
      return result;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error('❌ Erro crítico na análise de imagem:', {
        message: error.message,
        stack: error.stack,
        processingTime: errorTime,
        fileName: imageFile?.name,
        fileSize: imageFile?.size
      });
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTime: errorTime,
          errorDetails: {
            name: error.name,
            message: error.message,
            fileName: imageFile?.name
          }
        }
      };
    }
  }

  /**
   * Análise visual usando APIs de IA
   * @param {File} imageFile - Arquivo de imagem
   * @param {string} customPrompt - Prompt personalizado
   * @returns {Promise<Object>} Análise visual
   */
  static async performVisualAnalysis(imageFile, customPrompt) {
    try {
      console.log('🔍 Iniciando análise visual da imagem...');
      console.log('📊 APIs disponíveis:', {
        GoogleGenAI: !!getEnv('VITE_GEMINI_API_KEY'),
        OpenAI: !!this.API_KEYS.OPENAI && this.API_KEYS.OPENAI !== 'your_openai_api_key_here',
        Anthropic: !!this.API_KEYS.ANTHROPIC && this.API_KEYS.ANTHROPIC !== 'your_anthropic_api_key_here',
        Google: !!this.API_KEYS.GOOGLE && this.API_KEYS.GOOGLE !== 'your_google_vision_api_key_here',
        Gemini: !!getEnv('VITE_GEMINI_API_KEY')
      });
      
      // Converte imagem para base64
      const base64Image = await this.fileToBase64(imageFile);
      
      // Tenta diferentes APIs em ordem de preferência
      let result = null;
      
      // Tenta Google GenAI primeiro (nova biblioteca)
      if (getEnv('VITE_GEMINI_API_KEY')) {
        try {
          console.log('🤖 Tentando análise com Google GenAI (nova biblioteca)...');
          result = await GoogleGenAIService.analyzeImage(imageFile, customPrompt);
          console.log('✅ Análise Google GenAI concluída com sucesso');
        } catch (error) {
           console.warn('❌ Falha na análise Google GenAI:', error.message);
         }
      }
      
      // Tenta OpenAI se Google GenAI falhou
      if (!result && this.API_KEYS.OPENAI && this.API_KEYS.OPENAI !== 'your_openai_api_key_here') {
        try {
          console.log('🤖 Tentando análise com OpenAI...');
          result = await this.analyzeWithOpenAI(base64Image, customPrompt);
          console.log('✅ Análise OpenAI concluída com sucesso');
        } catch (error) {
           console.warn('❌ Falha na análise OpenAI:', error.message);
         }
      }
      
      // Tenta Anthropic se OpenAI falhou
      if (!result && this.API_KEYS.ANTHROPIC && this.API_KEYS.ANTHROPIC !== 'your_anthropic_api_key_here') {
        try {
          console.log('🤖 Tentando análise com Anthropic Claude...');
          result = await this.analyzeWithClaude(base64Image, customPrompt);
          console.log('✅ Análise Anthropic concluída com sucesso');
        } catch (error) {
           console.warn('❌ Falha na análise Anthropic:', error.message);
         }
      }
      
      // Tenta Google Vision se anteriores falharam
      if (!result && this.API_KEYS.GOOGLE && this.API_KEYS.GOOGLE !== 'your_google_vision_api_key_here') {
        try {
          console.log('🤖 Tentando análise com Google Vision...');
          result = await this.analyzeWithGoogleVision(base64Image, customPrompt);
          console.log('✅ Análise Google Vision concluída com sucesso');
        } catch (error) {
           console.warn('❌ Falha na análise Google Vision:', error.message);
         }
      }
      
      // Fallback para Gemini se disponível
      if (!result && getEnv('VITE_GEMINI_API_KEY')) {
        try {
          console.log('🤖 Usando fallback: Google Gemini...');
          result = await this.analyzeWithGemini(base64Image, customPrompt);
          console.log('✅ Análise Gemini (fallback) concluída com sucesso');
        } catch (error) {
           console.warn('❌ Falha no fallback Gemini:', error.message);
         }
      }
      
      // Último recurso: análise local
      if (!result) {
        console.log('🔧 Usando análise local como último recurso...');
        result = await this.performLocalAnalysis(imageFile, customPrompt);
      }
      
      return result;
    } catch (error) {
      console.error('💥 Erro crítico na análise visual:', error);
      return {
        provider: 'fallback-error',
        analysis: `Erro na análise: ${error.message}. Verifique se as chaves de API estão configuradas corretamente no arquivo .env`,
        confidence: 0.1,
        error: error.message
      };
    }
  }

  /**
   * Análise usando Google Gemini (Fallback)
   */
  static async analyzeWithGemini(base64Image) {
    try {
      const prompt = this.buildAnalysisPrompt();
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${getEnv('VITE_GEMINI_API_KEY')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }]
        })
      });
      
      const data = await response.json();
      
      if (data.candidates && data.candidates[0]) {
        return {
          provider: 'Google Gemini (Fallback)',
          analysis: data.candidates[0].content.parts[0].text,
          confidence: 0.8
        };
      } else {
        throw new Error('Resposta inválida do Gemini');
      }
    } catch (error) {
      console.error('Erro Gemini:', error);
      throw error;
    }
  }

  /**
   * Análise usando OpenAI GPT-4 Vision
   */
  static async analyzeWithOpenAI(base64Image, customPrompt) {
    try {
      const prompt = this.buildAnalysisPrompt(customPrompt);
      
      const response = await fetch(this.API_ENDPOINTS.OPENAI_VISION, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.API_KEYS.OPENAI}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        })
      });
      
      const data = await response.json();
      
      return {
        provider: 'OpenAI GPT-4 Vision',
        analysis: data.choices[0].message.content,
        confidence: 0.9,
        usage: data.usage
      };
    } catch (error) {
      console.error('Erro OpenAI:', error);
      throw error;
    }
  }

  /**
   * Análise usando Anthropic Claude
   */
  static async analyzeWithClaude(base64Image, customPrompt) {
    try {
      const prompt = this.buildAnalysisPrompt(customPrompt);
      
      const response = await fetch(this.API_ENDPOINTS.ANTHROPIC_CLAUDE, {
        method: 'POST',
        headers: {
          'x-api-key': this.API_KEYS.ANTHROPIC,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64Image
                  }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ]
        })
      });
      
      const data = await response.json();
      
      return {
        provider: 'Anthropic Claude',
        analysis: data.content[0].text,
        confidence: 0.85,
        usage: data.usage
      };
    } catch (error) {
      console.error('Erro Claude:', error);
      throw error;
    }
  }

  /**
   * Análise usando Google Vision API com recursos avançados
   */
  static async analyzeWithGoogleVision(base64Image) {
    try {
      const response = await fetch(
        `${this.API_ENDPOINTS.GOOGLE_VISION}?key=${this.API_KEYS.GOOGLE}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                image: {
                  content: base64Image
                },
                features: [
                  { type: 'LABEL_DETECTION', maxResults: 50 },
                  { type: 'OBJECT_LOCALIZATION', maxResults: 30 },
                  { type: 'TEXT_DETECTION' },
                  { type: 'LANDMARK_DETECTION' },
                  { type: 'SAFE_SEARCH_DETECTION' },
                  { type: 'IMAGE_PROPERTIES' },
                  { type: 'CROP_HINTS', maxResults: 5 },
                  { type: 'WEB_DETECTION', maxResults: 10 }
                ],
                imageContext: {
                  cropHintsParams: {
                    aspectRatios: [0.8, 1.0, 1.2]
                  },
                  webDetectionParams: {
                    includeGeoResults: true
                  }
                }
              }
            ]
          })
        }
      );
      
      const data = await response.json();
      const annotations = data.responses[0];
      
      // Processa resultados do Google Vision
      const analysis = this.processGoogleVisionResults(annotations);
      
      return {
        provider: 'Google Vision API',
        analysis,
        confidence: 0.8,
        rawData: annotations
      };
    } catch (error) {
      console.error('Erro Google Vision:', error);
      throw error;
    }
  }

  /**
   * Análise local básica (fallback)
   */
  static async performLocalAnalysis(imageFile, customPrompt = '') {
    console.log('🔧 Executando análise local avançada...');
    
    const fileName = imageFile.name.toLowerCase();
    const fileSize = imageFile.size;
    const fileType = imageFile.type;
    
    let analysis = '📊 ANÁLISE INTELIGENTE LOCAL\n\n';
    
    // Análise do arquivo
    analysis += '🔍 INFORMAÇÕES DO ARQUIVO:\n';
    analysis += `• Nome: ${imageFile.name}\n`;
    analysis += `• Tamanho: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n`;
    analysis += `• Tipo: ${fileType}\n\n`;
    
    // Inferências baseadas no nome do arquivo
    analysis += '🏠 IDENTIFICAÇÃO DO AMBIENTE:\n';
    let environmentDetected = false;
    
    if (fileName.includes('fachada') || fileName.includes('frente') || fileName.includes('exterior')) {
      analysis += '• 🏢 FACHADA/EXTERIOR: Imagem da parte externa do imóvel\n';
      analysis += '  - Permite avaliar arquitetura, conservação e localização\n';
      analysis += '  - Importante para primeira impressão e valor de mercado\n';
      environmentDetected = true;
    }
    
    if (fileName.includes('sala') || fileName.includes('living') || fileName.includes('social')) {
      analysis += '• 🛋️ ÁREA SOCIAL: Ambiente de convivência\n';
      analysis += '  - Espaço para receber visitas e relaxar\n';
      analysis += '  - Influencia diretamente no valor do imóvel\n';
      environmentDetected = true;
    }
    
    if (fileName.includes('quarto') || fileName.includes('bedroom') || fileName.includes('dormitorio')) {
      analysis += '• 🛏️ DORMITÓRIO: Área de descanso\n';
      analysis += '  - Privacidade e conforto são essenciais\n';
      analysis += '  - Quantidade e tamanho afetam o valor\n';
      environmentDetected = true;
    }
    
    if (fileName.includes('cozinha') || fileName.includes('kitchen')) {
      analysis += '• 🍳 COZINHA: Centro gastronômico da casa\n';
      analysis += '  - Funcionalidade e modernidade são valorizadas\n';
      analysis += '  - Integração com área social é tendência\n';
      environmentDetected = true;
    }
    
    if (fileName.includes('banheiro') || fileName.includes('bathroom') || fileName.includes('lavabo')) {
      analysis += '• 🚿 BANHEIRO: Área de higiene pessoal\n';
      analysis += '  - Acabamentos e funcionalidade são importantes\n';
      analysis += '  - Quantidade adequada valoriza o imóvel\n';
      environmentDetected = true;
    }
    
    if (fileName.includes('garagem') || fileName.includes('garage') || fileName.includes('estacionamento')) {
      analysis += '• 🚗 GARAGEM: Área de estacionamento\n';
      analysis += '  - Segurança para veículos\n';
      analysis += '  - Valorização significativa em centros urbanos\n';
      environmentDetected = true;
    }
    
    if (!environmentDetected) {
      analysis += '• 📷 AMBIENTE NÃO IDENTIFICADO: Análise geral\n';
      analysis += '  - Recomenda-se renomear arquivo para melhor identificação\n';
    }
    
    analysis += '\n';
    
    // Análise da qualidade da imagem
    analysis += '📸 QUALIDADE DA IMAGEM:\n';
    if (fileSize > 5 * 1024 * 1024) {
      analysis += '• ✅ ALTA RESOLUÇÃO: Excelente qualidade para análise\n';
      analysis += '  - Permite identificar detalhes importantes\n';
      analysis += '  - Ideal para documentação profissional\n';
    } else if (fileSize > 2 * 1024 * 1024) {
      analysis += '• ✅ BOA RESOLUÇÃO: Qualidade adequada\n';
      analysis += '  - Suficiente para análise geral\n';
      analysis += '  - Recomendada para uso comercial\n';
    } else if (fileSize > 500 * 1024) {
      analysis += '• ⚠️ RESOLUÇÃO MÉDIA: Qualidade aceitável\n';
      analysis += '  - Pode limitar análise de detalhes\n';
      analysis += '  - Considere usar imagens de maior qualidade\n';
    } else {
      analysis += '• ❌ BAIXA RESOLUÇÃO: Qualidade limitada\n';
      analysis += '  - Dificulta análise detalhada\n';
      analysis += '  - Recomenda-se capturar nova imagem\n';
    }
    
    analysis += '\n';
    
    // Recomendações gerais
    analysis += '💡 RECOMENDAÇÕES PARA ANÁLISE COMPLETA:\n';
    analysis += '• Configure uma API de IA (OpenAI, Anthropic, Google Vision)\n';
    analysis += '• Use imagens com boa iluminação e resolução\n';
    analysis += '• Capture múltiplos ângulos do mesmo ambiente\n';
    analysis += '• Inclua imagens da fachada e áreas externas\n';
    analysis += '• Documente acabamentos e detalhes construtivos\n\n';
    
    // Prompt personalizado
    if (customPrompt) {
      analysis += '🎯 ANÁLISE PERSONALIZADA SOLICITADA:\n';
      analysis += `"${customPrompt}"\n\n`;
      analysis += '📝 RESPOSTA BASEADA EM ANÁLISE LOCAL:\n';
      analysis += 'Para atender completamente sua solicitação, seria necessário ';
      analysis += 'processamento visual avançado com IA. A análise local fornece ';
      analysis += 'informações básicas baseadas no nome e propriedades do arquivo.\n\n';
    }
    
    analysis += '⚠️ LIMITAÇÕES DA ANÁLISE LOCAL:\n';
    analysis += '• Não processa conteúdo visual da imagem\n';
    analysis += '• Baseada apenas em metadados do arquivo\n';
    analysis += '• Para análise visual completa, configure APIs de IA\n';
    analysis += '• Resultados limitados comparados à análise com IA\n\n';
    
    analysis += '🔧 STATUS DO SISTEMA:\n';
    analysis += '• APIs externas: Indisponíveis ou não configuradas\n';
    analysis += '• Modo de operação: Análise local (fallback)\n';
    analysis += '• Confiabilidade: Limitada (30%)\n';
    
    return {
      provider: 'Análise Local Avançada (Fallback)',
      analysis,
      confidence: 0.3,
      limitations: [
        'Não processa conteúdo visual',
        'Baseada em metadados do arquivo',
        'Requer configuração de API para análise completa'
      ],
      recommendations: [
        'Configure API do OpenAI, Anthropic ou Google Vision',
        'Use imagens de alta qualidade',
        'Nomeie arquivos de forma descritiva',
        'Capture múltiplos ângulos'
      ]
    };
  }

  /**
   * Gera análise contextual integrada
   */
  static async generateContextualAnalysis(data) {
    const {
      metadata,
      locationData,
      marketAnalysis,
      similarProperties,
      visualAnalysis,
      propertyInfo
    } = data;
    
    let analysis = '## ANÁLISE CONTEXTUAL INTEGRADA\n\n';
    
    // Análise de localização detalhada
    if (locationData) {
      analysis += `### 📍 ANÁLISE GEOGRÁFICA DETALHADA\n`;
      analysis += `**Endereço completo:** ${locationData.formatted_address}\n`;
      analysis += `**Bairro:** ${locationData.neighborhood || 'N/A'}\n`;
      analysis += `**Cidade:** ${locationData.city || 'N/A'}\n`;
      analysis += `**Estado:** ${locationData.state || 'N/A'}\n`;
      analysis += `**CEP:** ${locationData.postal_code || 'N/A'}\n`;
      analysis += `**Coordenadas:** ${metadata?.location?.coordinates || 'N/A'}\n`;
      analysis += `**Precisão GPS:** ${locationData.accuracy}\n`;
      
      // Análise de contexto urbano
      if (locationData.place_types) {
        analysis += `**Tipo de área:** ${locationData.place_types.join(', ')}\n`;
      }
      
      // Análise de proximidade
      if (locationData.nearby_places) {
        analysis += `**Pontos de interesse próximos:**\n`;
        locationData.nearby_places.slice(0, 5).forEach(place => {
          analysis += `  - ${place.name} (${place.distance}m)\n`;
        });
      }
      analysis += '\n';
    }
    
    // Análise temporal e condições de captura
    if (metadata?.datetime?.dateTimeOriginal) {
      const photoDate = new Date(metadata.datetime.dateTimeOriginal);
      const daysSince = Math.floor((Date.now() - photoDate.getTime()) / (1000 * 60 * 60 * 24));
      const hour = photoDate.getHours();
      const timeOfDay = hour < 6 ? 'Madrugada' : hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite';
      
      analysis += `### 📅 ANÁLISE TEMPORAL E CONDIÇÕES\n`;
      analysis += `**Data da captura:** ${photoDate.toLocaleDateString('pt-BR')} às ${photoDate.toLocaleTimeString('pt-BR')}\n`;
      analysis += `**Período do dia:** ${timeOfDay}\n`;
      analysis += `**Idade da imagem:** ${daysSince} dias\n`;
      
      // Análise das condições técnicas
      if (metadata.camera) {
        analysis += `**Equipamento:** ${metadata.camera.make} ${metadata.camera.model}\n`;
        if (metadata.camera.lens?.model) {
          analysis += `**Lente:** ${metadata.camera.lens.model}\n`;
        }
      }
      
      if (metadata.technical) {
        analysis += `**Configurações:** ISO ${metadata.technical.iso}, f/${metadata.technical.aperture}, ${metadata.technical.shutterSpeed}s\n`;
      }
      analysis += '\n';
    }
    
    // Análise de mercado imobiliário
    if (marketAnalysis) {
      analysis += `### 📊 ANÁLISE DE MERCADO IMOBILIÁRIO\n`;
      analysis += `**Imóveis analisados na região:** ${marketAnalysis.totalProperties}\n`;
      analysis += `**Preço médio:** R$ ${marketAnalysis.priceAnalysis.average.toLocaleString('pt-BR')}\n`;
      analysis += `**Faixa de preços:** R$ ${marketAnalysis.priceAnalysis.min.toLocaleString('pt-BR')} - R$ ${marketAnalysis.priceAnalysis.max.toLocaleString('pt-BR')}\n`;
      analysis += `**Preço/m² médio:** R$ ${marketAnalysis.pricePerSqmAnalysis.average.toLocaleString('pt-BR')}\n`;
      analysis += `**Área média:** ${marketAnalysis.areaAnalysis.average}m²\n`;
      
      // Análise de tendências
      if (marketAnalysis.trends) {
        analysis += `**Tendência de preços:** ${marketAnalysis.trends.direction} (${marketAnalysis.trends.percentage}%)\n`;
      }
      analysis += '\n';
    }
    
    // Análise visual detalhada
    if (visualAnalysis) {
      analysis += `### 👁️ ANÁLISE VISUAL DETALHADA\n`;
      analysis += `**Provedor de IA:** ${visualAnalysis.provider}\n`;
      analysis += `**Nível de confiança:** ${(visualAnalysis.confidence * 100).toFixed(1)}%\n`;
      analysis += `**Análise:**\n${visualAnalysis.analysis}\n\n`;
      
      // Análise de elementos visuais específicos
      if (visualAnalysis.elements) {
        analysis += `**Elementos identificados:**\n`;
        Object.entries(visualAnalysis.elements).forEach(([category, items]) => {
          if (items.length > 0) {
            analysis += `  - ${category}: ${items.join(', ')}\n`;
          }
        });
        analysis += '\n';
      }
    }
    
    // Comparação detalhada com similares
    if (similarProperties.length > 0) {
      analysis += `### 🏠 ANÁLISE COMPARATIVA DE MERCADO\n`;
      analysis += `**Imóveis similares encontrados:** ${similarProperties.length}\n`;
      
      const avgPrice = similarProperties.reduce((sum, p) => sum + p.price, 0) / similarProperties.length;
      const avgArea = similarProperties.reduce((sum, p) => sum + p.area, 0) / similarProperties.length;
      const avgPricePerSqm = avgPrice / avgArea;
      
      analysis += `**Preço médio dos similares:** R$ ${avgPrice.toLocaleString('pt-BR')}\n`;
      analysis += `**Área média dos similares:** ${avgArea.toFixed(0)}m²\n`;
      analysis += `**Preço/m² médio dos similares:** R$ ${avgPricePerSqm.toLocaleString('pt-BR')}\n`;
      
      // Análise de posicionamento
      if (propertyInfo?.valor_estimado) {
        const priceComparison = ((propertyInfo.valor_estimado - avgPrice) / avgPrice * 100).toFixed(1);
        const comparisonText = priceComparison > 0 ? 'acima' : 'abaixo';
        analysis += `**Posicionamento de preço:** ${Math.abs(priceComparison)}% ${comparisonText} da média\n`;
      }
      
      // Top 3 similares mais relevantes
      analysis += `**Similares mais relevantes:**\n`;
      similarProperties.slice(0, 3).forEach((prop, index) => {
        analysis += `  ${index + 1}. ${prop.title} - R$ ${prop.price.toLocaleString('pt-BR')} (${prop.area}m²)\n`;
      });
      analysis += '\n';
    }
    
    // Análise arquitetônica e construtiva
    analysis += `### 🏗️ ANÁLISE ARQUITETÔNICA\n`;
    if (visualAnalysis?.analysis) {
      // Extrai informações arquitetônicas da análise visual
      const architecturalKeywords = ['estilo', 'arquitetura', 'construção', 'material', 'acabamento', 'design'];
      const architecturalInfo = visualAnalysis.analysis.split('.').filter(sentence => 
        architecturalKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
      );
      
      if (architecturalInfo.length > 0) {
        analysis += architecturalInfo.join('.') + '\n';
      } else {
        analysis += 'Análise arquitetônica baseada nos elementos visuais identificados.\n';
      }
    }
    
    // Análise de valorização
    if (metadata?.location && marketAnalysis) {
      analysis += `### 💰 POTENCIAL DE VALORIZAÇÃO\n`;
      analysis += `**Localização estratégica:** Análise baseada em coordenadas GPS precisas\n`;
      analysis += `**Contexto de mercado:** ${marketAnalysis.totalProperties} imóveis comparáveis na região\n`;
      
      if (locationData?.nearby_places) {
        const commercialPlaces = locationData.nearby_places.filter(p => 
          p.types?.includes('shopping_mall') || p.types?.includes('school') || p.types?.includes('hospital')
        );
        if (commercialPlaces.length > 0) {
          analysis += `**Infraestrutura próxima:** ${commercialPlaces.length} pontos de interesse relevantes\n`;
        }
      }
    }
    
    return analysis;
  }

  /**
   * Gera recomendações baseadas na análise
   */
  static generateRecommendations(data) {
    const { locationData, marketAnalysis, similarProperties, propertyInfo } = data;
    const recommendations = [];
    
    // Recomendações de preço
    if (marketAnalysis && propertyInfo.valor_estimado) {
      const marketAvg = marketAnalysis.priceAnalysis.average;
      const estimatedValue = propertyInfo.valor_estimado;
      
      if (estimatedValue > marketAvg * 1.2) {
        recommendations.push({
          type: 'pricing',
          priority: 'high',
          title: 'Preço acima do mercado',
          description: `O valor estimado está ${((estimatedValue / marketAvg - 1) * 100).toFixed(1)}% acima da média local.`,
          suggestion: 'Considere revisar a precificação ou destacar diferenciais únicos.'
        });
      } else if (estimatedValue < marketAvg * 0.8) {
        recommendations.push({
          type: 'pricing',
          priority: 'medium',
          title: 'Oportunidade de valorização',
          description: `O valor está ${((1 - estimatedValue / marketAvg) * 100).toFixed(1)}% abaixo da média local.`,
          suggestion: 'Há potencial para aumento de preço ou é uma boa oportunidade de compra.'
        });
      }
    }
    
    // Recomendações de localização
    if (locationData) {
      if (locationData.confidence > 0.8) {
        recommendations.push({
          type: 'location',
          priority: 'low',
          title: 'Localização bem definida',
          description: 'A localização foi identificada com alta precisão.',
          suggestion: 'Use a localização como ponto forte na comercialização.'
        });
      }
    }
    
    // Recomendações de mercado
    if (similarProperties.length > 0) {
      const highScoreProperties = similarProperties.filter(p => p.relevanceScore > 70);
      
      if (highScoreProperties.length > 5) {
        recommendations.push({
          type: 'market',
          priority: 'medium',
          title: 'Mercado competitivo',
          description: `Encontrados ${highScoreProperties.length} imóveis muito similares na região.`,
          suggestion: 'Destaque diferenciais únicos para se destacar da concorrência.'
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Constrói prompt para análise de IA
   */
  static buildAnalysisPrompt(customPrompt) {
    const basePrompt = `
Faça uma análise EXTREMAMENTE DETALHADA e MINUCIOSA desta imagem de imóvel, incluindo TODOS os aspectos visuais observáveis:

## 🏠 IDENTIFICAÇÃO DO AMBIENTE
- **Tipo específico de cômodo** (sala de estar, sala de jantar, quarto principal, suíte, cozinha americana, área gourmet, etc.)
- **Função do espaço** e layout observado
- **Integração com outros ambientes** (conceito aberto, separado, etc.)

## 🎨 ANÁLISE VISUAL DETALHADA
### Cores e Paleta:
- **Cores predominantes** nas paredes, móveis e decoração
- **Esquema cromático** (monocromático, complementar, análogo)
- **Temperatura das cores** (quente, fria, neutra)

### Materiais e Texturas:
- **Revestimentos de piso** (porcelanato, madeira, laminado, carpete, etc.)
- **Revestimentos de parede** (tinta, papel de parede, textura, pedra, etc.)
- **Materiais dos móveis** (madeira, MDF, metal, vidro, etc.)
- **Texturas observadas** (lisa, rugosa, brilhante, fosca)

### Iluminação:
- **Iluminação natural** (janelas, orientação solar aparente, qualidade da luz)
- **Iluminação artificial** (spots, lustres, arandelas, LED, etc.)
- **Distribuição da luz** no ambiente
- **Sombras e contrastes** observados

## 🪑 MOBILIÁRIO E DECORAÇÃO
### Móveis Identificados:
- **Lista detalhada** de todos os móveis visíveis
- **Estilo dos móveis** (moderno, clássico, rústico, industrial, etc.)
- **Estado de conservação** de cada peça
- **Qualidade aparente** (básica, média, alta, luxo)

### Elementos Decorativos:
- **Objetos decorativos** (quadros, plantas, almofadas, etc.)
- **Estilo decorativo** (minimalista, maximalista, eclético, etc.)
- **Harmonia do conjunto** decorativo

## 🏗️ ASPECTOS CONSTRUTIVOS E ARQUITETÔNICOS
### Estrutura:
- **Pé-direito** (baixo, médio, alto, duplo)
- **Formato do ambiente** (quadrado, retangular, irregular)
- **Elementos estruturais** visíveis (vigas, pilares, etc.)

### Aberturas:
- **Janelas** (tipo, tamanho, orientação aparente)
- **Portas** (tipo, material, estado)
- **Ventilação** aparente

### Acabamentos:
- **Qualidade dos acabamentos** (básico, médio, alto padrão, luxo)
- **Detalhes construtivos** (sancas, molduras, rodapés)
- **Estado de conservação** geral

## 🌍 CONTEXTO E LOCALIZAÇÃO
### Indicadores de Localização:
- **Vista externa** (se visível através de janelas)
- **Paisagem urbana ou natural** observada
- **Indicadores de bairro** (prédios, casas, vegetação)
- **Padrão construtivo** da região (se identificável)

### Características Climáticas:
- **Adaptações climáticas** observadas
- **Proteção solar** (persianas, cortinas, toldos)
- **Ventilação** e circulação de ar

## 💰 ANÁLISE DE VALOR IMOBILIÁRIO
### Aspectos Valorizadores:
- **Características premium** identificadas
- **Diferenciais competitivos**
- **Elementos de valorização**

### Aspectos Desvalorizadores:
- **Problemas identificados** (desgaste, danos, obsolescência)
- **Necessidades de manutenção**
- **Limitações do espaço**

### Classificação de Padrão:
- **Padrão estimado** (popular, médio, médio-alto, alto, luxo)
- **Justificativa** da classificação
- **Comparação** com padrões de mercado

## 📏 DIMENSÕES E PROPORÇÕES
- **Estimativa de metragem** do ambiente
- **Proporções** e ergonomia do espaço
- **Aproveitamento** do espaço disponível
- **Circulação** e fluxo no ambiente

## 🔍 DETALHES ESPECÍFICOS
### Equipamentos e Instalações:
- **Eletrodomésticos** visíveis (marca, modelo, estado)
- **Instalações elétricas** aparentes
- **Instalações hidráulicas** visíveis
- **Sistemas de climatização**

### Segurança e Acessibilidade:
- **Elementos de segurança** observados
- **Acessibilidade** do ambiente
- **Ergonomia** dos espaços

## 📊 ANÁLISE TÉCNICA FINAL
- **Resumo executivo** da análise
- **Pontos fortes** do imóvel
- **Pontos de atenção** identificados
- **Recomendações** para valorização
- **Adequação** para diferentes perfis de usuário

Seja EXTREMAMENTE DETALHADO, observando cada elemento visível na imagem. Descreva cores específicas, materiais exatos, marcas quando identificáveis, e todos os objetos presentes. Esta análise será usada para avaliação imobiliária profissional.
`;
    
    return customPrompt ? `${customPrompt}\n\n${basePrompt}` : basePrompt;
  }

  /**
   * Processa resultados do Google Vision com análise detalhada
   */
  static processGoogleVisionResults(annotations) {
    let analysis = '# ANÁLISE DETALHADA - GOOGLE VISION API\n\n';
    
    // Análise de elementos e objetos
    if (annotations.labelAnnotations) {
      analysis += '## 🏷️ ELEMENTOS E CARACTERÍSTICAS IDENTIFICADAS\n\n';
      
      // Categoriza os elementos
      const categories = {
        mobiliario: ['furniture', 'chair', 'table', 'sofa', 'bed', 'desk', 'cabinet', 'shelf'],
        decoracao: ['picture frame', 'plant', 'vase', 'lamp', 'curtain', 'pillow', 'artwork'],
        arquitetura: ['wall', 'ceiling', 'floor', 'window', 'door', 'room', 'building'],
        iluminacao: ['light', 'lighting', 'lamp', 'chandelier', 'natural light'],
        materiais: ['wood', 'metal', 'glass', 'fabric', 'stone', 'ceramic', 'plastic'],
        cores: ['white', 'black', 'brown', 'blue', 'red', 'green', 'yellow', 'gray']
      };
      
      const categorizedElements = {
        mobiliario: [],
        decoracao: [],
        arquitetura: [],
        iluminacao: [],
        materiais: [],
        cores: [],
        outros: []
      };
      
      annotations.labelAnnotations.forEach(label => {
        const desc = label.description.toLowerCase();
        let categorized = false;
        
        for (const [category, keywords] of Object.entries(categories)) {
          if (keywords.some(keyword => desc.includes(keyword))) {
            categorizedElements[category].push({
              name: label.description,
              confidence: (label.score * 100).toFixed(1)
            });
            categorized = true;
            break;
          }
        }
        
        if (!categorized) {
          categorizedElements.outros.push({
            name: label.description,
            confidence: (label.score * 100).toFixed(1)
          });
        }
      });
      
      // Exibe elementos categorizados
      Object.entries(categorizedElements).forEach(([category, elements]) => {
        if (elements.length > 0) {
          const categoryNames = {
            mobiliario: '🪑 **Mobiliário**',
            decoracao: '🎨 **Decoração**',
            arquitetura: '🏗️ **Elementos Arquitetônicos**',
            iluminacao: '💡 **Iluminação**',
            materiais: '🧱 **Materiais**',
            cores: '🌈 **Cores**',
            outros: '📋 **Outros Elementos**'
          };
          
          analysis += `### ${categoryNames[category]}\n`;
          elements.slice(0, 8).forEach(element => {
            analysis += `• ${element.name} (${element.confidence}% confiança)\n`;
          });
          analysis += '\n';
        }
      });
    }
    
    // Objetos localizados com posicionamento
    if (annotations.localizedObjectAnnotations) {
      analysis += '## 📍 OBJETOS DETECTADOS COM LOCALIZAÇÃO\n\n';
      annotations.localizedObjectAnnotations.forEach(obj => {
        const vertices = obj.boundingPoly.normalizedVertices;
        const x = ((vertices[0].x + vertices[2].x) / 2 * 100).toFixed(0);
        const y = ((vertices[0].y + vertices[2].y) / 2 * 100).toFixed(0);
        analysis += `• **${obj.name}** (${(obj.score * 100).toFixed(1)}% confiança)\n`;
        analysis += `  - Posição: ${x}% horizontal, ${y}% vertical na imagem\n`;
      });
      analysis += '\n';
    }
    
    // Análise de cores dominantes
    if (annotations.imagePropertiesAnnotation && annotations.imagePropertiesAnnotation.dominantColors) {
      analysis += '## 🎨 PALETA DE CORES DOMINANTES\n\n';
      const colors = annotations.imagePropertiesAnnotation.dominantColors.colors;
      colors.slice(0, 5).forEach((color, index) => {
        const rgb = color.color;
        const percentage = (color.pixelFraction * 100).toFixed(1);
        analysis += `• **Cor ${index + 1}**: RGB(${rgb.red || 0}, ${rgb.green || 0}, ${rgb.blue || 0}) - ${percentage}% da imagem\n`;
      });
      analysis += '\n';
    }
    
    // Texto detectado com análise
    if (annotations.textAnnotations && annotations.textAnnotations.length > 0) {
      analysis += '## 📝 TEXTO E INFORMAÇÕES IDENTIFICADAS\n\n';
      const fullText = annotations.textAnnotations[0].description;
      analysis += `**Texto completo detectado:**\n${fullText}\n\n`;
      
      // Analisa se há informações relevantes
      const relevantInfo = [];
      if (fullText.match(/\d{4,}/)) relevantInfo.push('Números identificados (possível endereço, telefone ou código)');
      if (fullText.match(/[A-Z]{2,}/)) relevantInfo.push('Siglas ou códigos em maiúsculas');
      if (fullText.match(/(rua|av|avenida|street|road)/i)) relevantInfo.push('Possível informação de endereço');
      
      if (relevantInfo.length > 0) {
        analysis += '**Informações relevantes detectadas:**\n';
        relevantInfo.forEach(info => analysis += `• ${info}\n`);
        analysis += '\n';
      }
    }
    
    // Landmarks e pontos de referência
    if (annotations.landmarkAnnotations && annotations.landmarkAnnotations.length > 0) {
      analysis += '## 🗺️ PONTOS DE REFERÊNCIA E LANDMARKS\n\n';
      annotations.landmarkAnnotations.forEach(landmark => {
        analysis += `• **${landmark.description}**\n`;
        if (landmark.locations && landmark.locations[0]) {
          const location = landmark.locations[0].latLng;
          analysis += `  - Coordenadas: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}\n`;
        }
        analysis += `  - Confiança: ${(landmark.score * 100).toFixed(1)}%\n`;
      });
      analysis += '\n';
    }
    
    // Análise de segurança (Safe Search)
    if (annotations.safeSearchAnnotation) {
      const safeSearch = annotations.safeSearchAnnotation;
      analysis += '## 🛡️ ANÁLISE DE CONTEÚDO\n\n';
      analysis += `• **Adequação para uso comercial**: ${safeSearch.adult === 'VERY_UNLIKELY' ? 'Adequada' : 'Verificar'}\n`;
      analysis += `• **Conteúdo profissional**: ${safeSearch.violence === 'VERY_UNLIKELY' ? 'Sim' : 'Verificar'}\n\n`;
    }
    
    // Resumo da análise
    analysis += '## 📊 RESUMO DA ANÁLISE TÉCNICA\n\n';
    const totalElements = annotations.labelAnnotations ? annotations.labelAnnotations.length : 0;
    const totalObjects = annotations.localizedObjectAnnotations ? annotations.localizedObjectAnnotations.length : 0;
    const hasText = annotations.textAnnotations && annotations.textAnnotations.length > 0;
    const hasLandmarks = annotations.landmarkAnnotations && annotations.landmarkAnnotations.length > 0;
    
    analysis += `• **Elementos identificados**: ${totalElements}\n`;
    analysis += `• **Objetos localizados**: ${totalObjects}\n`;
    analysis += `• **Texto detectado**: ${hasText ? 'Sim' : 'Não'}\n`;
    analysis += `• **Pontos de referência**: ${hasLandmarks ? 'Sim' : 'Não'}\n`;
    analysis += `• **Qualidade da análise**: ${totalElements > 10 ? 'Alta' : totalElements > 5 ? 'Média' : 'Básica'}\n`;
    
    return analysis;
  }

  /**
   * Converte arquivo para base64
   */
  static async fileToBase64(file) {
    // Verifica se é ambiente Node.js ou se o arquivo é um mock
    if (typeof window === 'undefined' || !file.type) {
      // Retorna uma imagem base64 de placeholder para testes em ambiente Node.js
      return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Análise de múltiplas imagens
   * @param {Array<File>} imageFiles - Array de arquivos de imagem
   * @param {string} customPrompt - Prompt personalizado
   * @param {Object} propertyInfo - Informações do imóvel
   * @returns {Promise<Object>} Análise consolidada
   */
  static async analyzeMultipleImages(imageFiles, customPrompt = '', propertyInfo = {}) {
    try {
      const analyses = [];
      let consolidatedLocation = null;
      let consolidatedMarket = null;
      
      // Analisa cada imagem
      for (const imageFile of imageFiles) {
        const analysis = await this.analyzeImageWithLocation(imageFile, customPrompt, propertyInfo);
        analyses.push(analysis);
        
        // Usa a primeira localização válida encontrada
        if (!consolidatedLocation && analysis.locationData) {
          consolidatedLocation = analysis.locationData;
          consolidatedMarket = analysis.marketAnalysis;
        }
      }
      
      // Consolida análises
      const consolidatedAnalysis = this.consolidateMultipleAnalyses(analyses);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        totalImages: imageFiles.length,
        individualAnalyses: analyses,
        consolidatedAnalysis,
        locationData: consolidatedLocation,
        marketAnalysis: consolidatedMarket
      };
    } catch (error) {
      console.error('Erro na análise múltipla:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Consolida múltiplas análises
   */
  static consolidateMultipleAnalyses(analyses) {
    const successful = analyses.filter(a => a.success);
    
    if (successful.length === 0) {
      return 'Não foi possível analisar nenhuma imagem.';
    }
    
    let consolidated = `## ANÁLISE CONSOLIDADA DE ${successful.length} IMAGENS\n\n`;
    
    // Resumo geral
    consolidated += `### 📊 RESUMO GERAL\n`;
    consolidated += `**Imagens analisadas com sucesso:** ${successful.length}\n`;
    consolidated += `**Imagens com geolocalização:** ${successful.filter(a => a.locationData).length}\n`;
    consolidated += `**Imagens com análise visual:** ${successful.filter(a => a.visualAnalysis).length}\n\n`;
    
    // Análises individuais resumidas
    successful.forEach((analysis, index) => {
      consolidated += `### 🖼️ IMAGEM ${index + 1}\n`;
      if (analysis.visualAnalysis) {
        const preview = analysis.visualAnalysis.analysis.substring(0, 200);
        consolidated += `${preview}...\n\n`;
      }
    });
    
    return consolidated;
  }
}

export default CustomAIService;
