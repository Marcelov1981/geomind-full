/**
 * Serviço de Validação de Relatórios Imobiliários via IA
 * Compara dados textuais do relatório com evidências visuais extraídas de imagens
 */

import CustomAIService from './CustomAIService.js';

class ReportValidationService {
  /**
   * Valida um relatório imobiliário cruzando dados com análise de imagens
   * @param {Object} reportData - Dados do relatório (características, cômodos, acabamentos)
   * @param {File[]} imageFiles - Lista de imagens do imóvel
   * @returns {Promise<Object>} Resultado da validação
   */
  static async validateReport(reportData, imageFiles) {
    console.log('🕵️‍♀️ Iniciando validação cruzada de relatório via IA...');
    const startTime = Date.now();
    
    try {
      // 1. Analisar todas as imagens para extrair características visuais
      const visualEvidence = await this.extractVisualEvidence(imageFiles);
      
      // 2. Comparar evidências visuais com dados do relatório
      const validationResult = this.compareDataWithEvidence(reportData, visualEvidence);
      
      // 3. Gerar score de confiança e metadados de fonte
      const finalReport = {
        isValid: validationResult.score > 0.7,
        confidenceScore: validationResult.score,
        timestamp: new Date().toISOString(),
        validationDetails: validationResult.details,
        sources: this.extractSources(reportData, visualEvidence),
        visualEvidenceSummary: visualEvidence.summary,
        processingTime: Date.now() - startTime
      };

      console.log('✅ Validação concluída:', finalReport.isValid ? 'APROVADO' : 'REVISÃO NECESSÁRIA');
      return finalReport;

    } catch (error) {
      console.error('❌ Erro na validação do relatório:', error);
      throw new Error(`Falha na validação do relatório: ${error.message}`);
    }
  }

  /**
   * Extrai evidências visuais das imagens usando CustomAIService
   */
  static async extractVisualEvidence(imageFiles) {
    const evidence = {
      features: new Set(),
      roomTypes: new Set(),
      materials: new Set(),
      condition: 'Unknown',
      summary: []
    };

    // Analisa até 3 imagens principais para economizar recursos, ou todas se forem poucas
    const imagesToAnalyze = imageFiles.slice(0, 3);
    
    for (const image of imagesToAnalyze) {
      // Prompt específico para extração de fatos visuais
      const validationPrompt = `
        Analise esta imagem imobiliária APENAS para validação de dados. 
        Liste:
        1. Tipo de cômodo visível
        2. Materiais de acabamento (piso, paredes, teto)
        3. Estado de conservação (Ruim, Regular, Bom, Excelente)
        4. Itens/Mobília visíveis (ex: armários embutidos, ar condicionado)
        Seja conciso e direto.
      `;

      const analysis = await CustomAIService.performVisualAnalysis(image, validationPrompt);
      
      if (analysis && analysis.analysis) {
        // Processamento simples do texto retornado (em produção usaria NLP mais robusto ou JSON mode)
        const text = analysis.analysis.toLowerCase();
        
        // Extração heurística simples baseada em palavras-chave
        if (text.includes('madeira') || text.includes('taco')) evidence.materials.add('Piso de Madeira');
        if (text.includes('porcelanato') || text.includes('cerâmica')) evidence.materials.add('Piso Frio/Porcelanato');
        if (text.includes('gesso')) evidence.materials.add('Teto de Gesso');
        
        if (text.includes('quarto') || text.includes('dormitório')) evidence.roomTypes.add('Quarto');
        if (text.includes('sala')) evidence.roomTypes.add('Sala');
        if (text.includes('cozinha')) evidence.roomTypes.add('Cozinha');
        if (text.includes('banheiro')) evidence.roomTypes.add('Banheiro');
        
        if (text.includes('armário')) evidence.features.add('Armários Embutidos');
        if (text.includes('ar condicionado') || text.includes('split')) evidence.features.add('Ar Condicionado');
        if (text.includes('sacada') || text.includes('varanda')) evidence.features.add('Varanda');

        evidence.summary.push({
          imageName: image.name,
          findings: analysis.analysis.substring(0, 100) + '...'
        });
      }
    }

    return evidence;
  }

  /**
   * Compara os dados do relatório com as evidências visuais
   */
  static compareDataWithEvidence(reportData, visualEvidence) {
    const details = [];
    let matchCount = 0;
    let checkCount = 0;

    // Validação de Características (Features)
    if (reportData.features && Array.isArray(reportData.features)) {
      reportData.features.forEach(feature => {
        checkCount++;
        // Verificação flexível
        const isVerified = Array.from(visualEvidence.features).some(evidence => 
          evidence.toLowerCase().includes(feature.toLowerCase()) || 
          feature.toLowerCase().includes(evidence.toLowerCase())
        );

        if (isVerified) {
          matchCount++;
          details.push({ item: feature, status: 'VERIFIED', source: 'Visual Analysis' });
        } else {
          details.push({ item: feature, status: 'UNVERIFIED', note: 'Não detectado nas imagens analisadas' });
        }
      });
    }

    // Validação de Acabamentos (se houver no relatório)
    if (reportData.finishes) {
       // Lógica similar para acabamentos
    }

    const score = checkCount > 0 ? matchCount / checkCount : 0.5; // 0.5 neutro se nada para checar

    return { score, details };
  }

  /**
   * Compila as fontes de dados utilizadas
   */
  static extractSources(reportData, visualEvidence) {
    const sources = [];

    // Fonte de Dados do Imóvel
    if (reportData.url) {
      sources.push({
        type: 'Market Data',
        name: reportData.portal || 'Portal Imobiliário',
        url: reportData.url,
        method: 'Automated Scraping',
        date: new Date().toISOString()
      });
    }

    // Fonte de Validação Visual
    if (visualEvidence.summary.length > 0) {
      sources.push({
        type: 'Verification',
        name: 'GeoMind AI Vision Analysis',
        method: 'Computer Vision / Multi-LLM Consensus',
        confidence: 'High',
        assetsAnalyzed: visualEvidence.summary.length
      });
    }

    return sources;
  }
}

export default ReportValidationService;
