/**
 * Serviço de Validação de Relatórios Imobiliários via IA
 * Compara dados textuais do relatório com evidências visuais extraídas de imagens
 */

import { analyzeImageOnServer } from '../services/aiAnalysisService';

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
      const visualEvidence = await this.extractVisualEvidence(imageFiles, reportData);
      
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
   * Extrai evidências visuais das imagens usando o endpoint server-side
   */
  static async extractVisualEvidence(imageFiles, reportData = {}) {
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

      const projectId = reportData.projectId || reportData.project_id || reportData.projetoId || reportData.projeto_id;
      if (!projectId) throw new Error('A validação visual exige um projeto persistido.');
      const analysis = await analyzeImageOnServer(image, {
        projectId,
        evaluationId: reportData.evaluationId || reportData.evaluation_id || reportData.avaliacaoId || reportData.avaliacao_id,
        prompt: validationPrompt,
      });
      
      if (analysis?.success && analysis.analysis) {
        // A resposta estruturada vem do servidor; a heurística abaixo mantém compatibilidade com o relatório legado.
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
    
    // Lista de palavras-chave que indicam itens visualmente verificáveis em fotos internas/externas
    const VISUAL_KEYWORDS = [
      'piso', 'madeira', 'porcelanato', 'cerâmica', 'laminado', 'taco', 'carpete',
      'teto', 'gesso', 'sanca', 'iluminação',
      'parede', 'pintura', 'papel de parede',
      'armário', 'planejado', 'embutido', 'closet',
      'ar condicionado', 'split', 'aquecedor',
      'varanda', 'sacada', 'terraço', 'vista',
      'piscina', 'churrasqueira', 'jardim', 'quintal',
      'mobília', 'mobiliado', 'mesa', 'cadeira', 'sofá', 'cama',
      'cozinha', 'banheiro', 'sala', 'quarto', 'suíte', 'lavabo',
      'box', 'espelho', 'bancada', 'pia', 'cuba', 'torneira'
    ];

    // Validação de Características (Features)
    if (reportData.features && Array.isArray(reportData.features)) {
      reportData.features.forEach(feature => {
        const featureLower = feature.toLowerCase();
        
        // Verifica se a feature é passível de validação visual
        const isVisuallyVerifiable = VISUAL_KEYWORDS.some(keyword => featureLower.includes(keyword));

        if (isVisuallyVerifiable) {
          checkCount++;
          
          // Tenta encontrar evidência nas imagens
          // Verifica features extraídas E resumo textual das imagens
          const evidenceFound = Array.from(visualEvidence.features).some(ev => 
            ev.toLowerCase().includes(featureLower) || featureLower.includes(ev.toLowerCase())
          ) || Array.from(visualEvidence.materials).some(mat => 
             mat.toLowerCase().includes(featureLower) || featureLower.includes(mat.toLowerCase())
          );

          if (evidenceFound) {
            matchCount++;
            details.push({ item: feature, status: 'VERIFIED', source: 'Visual Analysis', confidence: 'High' });
          } else {
            // Verifica se talvez esteja nos tipos de cômodos (ex: "Cozinha" como feature)
            const roomMatch = Array.from(visualEvidence.roomTypes).some(room => 
              featureLower.includes(room.toLowerCase())
            );
            
            if (roomMatch) {
              matchCount++;
              details.push({ item: feature, status: 'VERIFIED', source: 'Visual Analysis (Room Type)', confidence: 'Medium' });
            } else {
              details.push({ item: feature, status: 'UNVERIFIED', note: 'Não detectado visualmente nas imagens fornecidas' });
            }
          }
        } else {
          // Itens não visuais (ex: "Próximo ao metrô", "Portaria 24h") não penalizam o score visual
          details.push({ item: feature, status: 'INFO_ONLY', note: 'Validação visual não aplicável' });
        }
      });
    }

    // Cálculo do Score Ponderado
    // Se não houver itens verificáveis, assume score neutro-alto (confiança na fonte de dados)
    // Se houver, calcula a proporção de acertos
    let score = checkCount > 0 ? (matchCount / checkCount) : 0.90;
    
    // Bônus de consistência: Se tiver pelo menos 3 verificações e 100% de acerto, dá bônus para chegar a 98-99%
    if (checkCount >= 3 && score === 1) {
        score = 0.98;
    } else if (checkCount > 0) {
        // Ajuste fino para não ser tão punitivo se houver muitos itens
        // Ex: 4 itens, 3 acertos = 0.75 -> Boost para 0.85 se os acertos forem "fortes"
        score = Math.min(0.99, score + 0.05);
    }

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
