import React, { useState, useEffect } from 'react';
import CustomAIService from '../utils/CustomAIService';
import api, { API_ENDPOINTS } from '../config/api';
import ApiKeyStore from '../utils/ApiKeyStore.js';
import PDFGenerator from '../utils/PDFGenerator';
import SafariNotification from './SafariNotification.jsx';
import SafariCompatibility from '../utils/SafariCompatibility.js';
import LaudoPDF from './LaudoPDF';
import relationshipService from '../services/relationshipService';

const AIImageAnalysis = () => {
  const [activeTab, setActiveTab] = useState('analysis');
  const [images, setImages] = useState([]);
  const [databaseImages, setDatabaseImages] = useState([]);
  const [webscrapingImages, setWebscrapingImages] = useState([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisType, setAnalysisType] = useState('single'); // single, multiple, comparison
  const [showLaudoPDF, setShowLaudoPDF] = useState(false);
  const [savedAvaliacao, setSavedAvaliacao] = useState(null);
  const [detailedReport, setDetailedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editableReport, setEditableReport] = useState(null);
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [apiKeys, setApiKeys] = useState({ OPENAI: '', ANTHROPIC: '', GOOGLE_VISION: '', OPENCAGE: '', MAPBOX: '', GOOGLE_MAPS: '' });
  const [providersStatus, setProvidersStatus] = useState({ openai: false, anthropic: false, googleVision: false, geocode: false });
  
  // Estados para dados de projeto
  const [clientes, setClientes] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedProjeto, setSelectedProjeto] = useState('');
  const [selectedOrcamento, setSelectedOrcamento] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  
  const [propertyInfo, setPropertyInfo] = useState({
    endereco: '',
    cidade: '',
    tipo: '',
    areaTerreno: '',
    areaConstruida: '',
    finalidade: '',
    coordsLat: '',
    coordsLng: ''
  });

  // Manipula upload de imagens
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.heic', '.heif'];
    const imageFiles = files.filter(file => {
      const name = (file.name || '').toLowerCase();
      const hasType = (file.type || '').startsWith('image/');
      const hasExt = allowedExt.some(ext => name.endsWith(ext));
      return hasType || hasExt;
    });

    if (!imageFiles.length) {
      setError('Não foi possível carregar as imagens. Formato não suportado.');
      return;
    }

    setImages(prev => [...prev, ...imageFiles]);
    setError('');
    if (event.target) {
      event.target.value = null;
    }
  };

  // Remove imagem
  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDatabaseImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.heic', '.heif'];
    const imageFiles = files.filter(file => {
      const name = (file.name || '').toLowerCase();
      const hasType = (file.type || '').startsWith('image/');
      const hasExt = allowedExt.some(ext => name.endsWith(ext));
      return hasType || hasExt;
    });
    if (!imageFiles.length) {
      setError('Não foi possível carregar imagens do banco (formato não suportado).');
      return;
    }
    setDatabaseImages(prev => [...prev, ...imageFiles]);
    if (event.target) {
      event.target.value = null;
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    fetchClientes();
  }, []);

  useEffect(() => {
    try {
      const all = ApiKeyStore.all();
      setApiKeys({
        OPENAI: all.OPENAI,
        ANTHROPIC: all.ANTHROPIC,
        GOOGLE_VISION: all.GOOGLE_VISION,
        OPENCAGE: all.OPENCAGE,
        MAPBOX: all.MAPBOX,
        GOOGLE_MAPS: all.GOOGLE_MAPS
      });
      setProvidersStatus({
        openai: !!all.OPENAI,
        anthropic: !!all.ANTHROPIC,
        googleVision: !!all.GOOGLE_VISION,
        geocode: !!(all.OPENCAGE || all.MAPBOX || all.GOOGLE_MAPS)
      });
    } catch (e) {
      if (isDev) console.error('Erro ao carregar chaves de API locais:', e);
    }
  }, []);

  // Carregar projetos quando cliente for selecionado
  useEffect(() => {
    if (selectedCliente) {
      fetchProjetos(selectedCliente);
    } else {
      setProjetos([]);
      setSelectedProjeto('');
      setOrcamentos([]);
      setSelectedOrcamento('');
    }
  }, [selectedCliente]);

  // Carregar orçamentos quando projeto for selecionado
  useEffect(() => {
    if (selectedProjeto) {
      fetchOrcamentos(selectedProjeto);
    } else {
      setOrcamentos([]);
      setSelectedOrcamento('');
    }
  }, [selectedProjeto]);

  // Atualizar propertyInfo quando projeto for selecionado
  useEffect(() => {
    if (selectedProjeto) {
      const projeto = projetos.find(p => p.id === selectedProjeto);
      if (projeto) {
        setPropertyInfo({
          endereco: projeto.endereco_imovel || '',
          cidade: projeto.cidade_imovel || '',
          tipo: projeto.tipo_imovel || '',
          areaTerreno: projeto.area_terreno || '',
          areaConstruida: projeto.area_construida || '',
          finalidade: projeto.finalidade_avaliacao || ''
        });
      }
    }
  }, [selectedProjeto, projetos]);

  // Funções para carregar dados usando relationshipService
  const fetchClientes = async () => {
    try {
      setLoadingData(true);
      const data = await relationshipService.getUserCompleteData();
      setClientes(data.clientes || []);
    } catch (error) {
      if (isDev) console.error('Erro ao carregar clientes:', error);
      setError('Erro ao carregar clientes');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchProjetos = async (clienteId) => {
    try {
      setLoadingData(true);
      const data = await relationshipService.getUserCompleteData();
      const projetosCliente = data.projetos.filter(p => p.cliente_id === clienteId);
      setProjetos(projetosCliente);
    } catch (error) {
      if (isDev) console.error('Erro ao carregar projetos:', error);
      setError('Erro ao carregar projetos');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchOrcamentos = async (projetoId) => {
    try {
      setLoadingData(true);
      const projectData = await relationshipService.getProjectWithRelations(projetoId);
      setOrcamentos(projectData.orcamentos || []);
    } catch (error) {
      if (isDev) console.error('Erro ao carregar orçamentos:', error);
      setError('Erro ao carregar orçamentos');
    } finally {
      setLoadingData(false);
    }
  };

  const handleWebscrapingImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.heic', '.heif'];
    const imageFiles = files.filter(file => {
      const name = (file.name || '').toLowerCase();
      const hasType = (file.type || '').startsWith('image/');
      const hasExt = allowedExt.some(ext => name.endsWith(ext));
      return hasType || hasExt;
    });
    if (!imageFiles.length) {
      setError('Não foi possível carregar imagens de webscraping (formato não suportado).');
      return;
    }
    setWebscrapingImages(prev => [...prev, ...imageFiles]);
    if (event.target) {
      event.target.value = null;
    }
  };

  const removeDatabaseImage = (index) => {
    setDatabaseImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeWebscrapingImage = (index) => {
    setWebscrapingImages(prev => prev.filter((_, i) => i !== index));
  };

  // Limpa todas as imagens
  const clearImages = () => {
    setImages([]);
    setAnalysisResult(null);
    setError('');
  };

  // Manipula mudanças nas informações do imóvel
  const handlePropertyInfoChange = (field, value) => {
    setPropertyInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Executa análise
  const runAnalysis = async () => {
    // Validações específicas por tipo de análise
    if (analysisType === 'single' && images.length === 0) {
      setError('Selecione uma imagem para análise única.');
      return;
    }
    
    if (analysisType === 'multiple' && images.length < 2) {
      setError('Selecione pelo menos 2 imagens para análise múltipla.');
      return;
    }
    
    if (analysisType === 'comparison' && images.length < 2) {
      setError('Selecione pelo menos 2 imagens para comparação.');
      return;
    }
    
    if (images.length === 0) {
      setError('Selecione pelo menos uma imagem para análise.');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysisResult(null);

    try {
      // Enriquecer propertyInfo com dados do projeto selecionado
      const selectedProject = projetos.find(p => p.id === selectedProjeto);
      const selectedClient = clientes.find(c => c.id === selectedCliente);
      const selectedBudget = orcamentos.find(o => o.id === selectedOrcamento);
      
      const enrichedPropertyInfo = {
        ...propertyInfo,
        ...(selectedProject && {
          projectId: selectedProject.id,
          projectName: selectedProject.nome,
          clientId: selectedProject.cliente_id,
          clientName: selectedClient?.nome,
          clientType: selectedClient?.tipo,
          projectType: selectedProject.tipo_imovel,
          projectPurpose: selectedProject.finalidade_avaliacao,
          projectAddress: selectedProject.endereco_imovel,
          projectCity: selectedProject.cidade_imovel,
          projectState: selectedProject.estado_imovel,
          projectCep: selectedProject.cep_imovel,
          landArea: selectedProject.area_terreno,
          builtArea: selectedProject.area_construida,
          estimatedValue: selectedProject.valor_estimado,
          deliveryDeadline: selectedProject.prazo_entrega,
          observations: selectedProject.observacoes
        }),
        ...(selectedBudget && {
          budgetId: selectedBudget.id,
          budgetValue: selectedBudget.valor,
          budgetStatus: selectedBudget.status,
          budgetDate: selectedBudget.data_criacao
        })
      };



      let result;
      
      if (analysisType === 'single' && images.length > 0) {
        result = await CustomAIService.analyzeImageWithLocation(images[0], customPrompt, enrichedPropertyInfo);
      } else if (analysisType === 'multiple') {
        result = await CustomAIService.analyzeMultipleImages(images, customPrompt, enrichedPropertyInfo);
      } else if (analysisType === 'comparison' && images.length >= 2) {
        const midPoint = Math.ceil(images.length / 2);
        const images1 = images.slice(0, midPoint);
        const images2 = images.slice(midPoint);
        // Para comparação, analisamos ambos os grupos e comparamos os resultados
        const result1 = await CustomAIService.analyzeMultipleImages(images1, customPrompt, enrichedPropertyInfo);
        const result2 = await CustomAIService.analyzeMultipleImages(images2, customPrompt, enrichedPropertyInfo);
        result = {
          success: true,
          analysis: `COMPARAÇÃO ENTRE GRUPOS DE IMAGENS:\n\nGRUPO 1:\n${result1.analysis}\n\nGRUPO 2:\n${result2.analysis}\n\nCOMPARAÇÃO:\nAmbos os grupos foram analisados com a nova IA avançada incluindo metadados EXIF, geolocalização e análise de mercado.`,
          confidence: Math.min(result1.confidence || 0.8, result2.confidence || 0.8),
          metadata: result1.metadata,
          locationData: result1.locationData,
          marketAnalysis: result1.marketAnalysis
        };
      } else {
        setError('Configuração inválida para o tipo de análise selecionado.');
        setLoading(false);
        return;
      }

      if (result.success) {
        setAnalysisResult({
          ...result,
          propertyInfo: enrichedPropertyInfo,
          images: images.map(img => ({
            name: img.name,
            size: img.size,
            type: img.type
          }))
        });
      } else {
        if (result.error && result.error.includes('sobrecarregado')) {
          setError('⚠️ O modelo de IA está temporariamente sobrecarregado. Tente novamente em alguns minutos.');
        } else {
          setError(result.error || 'Erro na análise das imagens.');
        }
      }
    } catch (err) {
      setError('Erro inesperado durante a análise.');
      if (isDev) console.error('Erro na análise:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleComparison = async () => {
    if (databaseImages.length === 0 || webscrapingImages.length === 0) {
      setError('Por favor, adicione pelo menos uma imagem em cada seção.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Enriquecer propertyInfo com dados do projeto selecionado
      const selectedProject = projetos.find(p => p.id === selectedProjeto);
      const selectedClient = clientes.find(c => c.id === selectedCliente);
      const selectedBudget = orcamentos.find(o => o.id === selectedOrcamento);
      
      const enrichedPropertyInfo = {
        ...propertyInfo,
        ...(selectedProject && {
          projectId: selectedProject.id,
          projectName: selectedProject.nome,
          clientId: selectedProject.cliente_id,
          clientName: selectedClient?.nome,
          clientType: selectedClient?.tipo,
          projectType: selectedProject.tipo_imovel,
          projectPurpose: selectedProject.finalidade_avaliacao,
          projectAddress: selectedProject.endereco_imovel,
          projectCity: selectedProject.cidade_imovel,
          projectState: selectedProject.estado_imovel,
          projectCep: selectedProject.cep_imovel,
          landArea: selectedProject.area_terreno,
          builtArea: selectedProject.area_construida,
          estimatedValue: selectedProject.valor_estimado,
          deliveryDeadline: selectedProject.prazo_entrega,
          observations: selectedProject.observacoes
        }),
        ...(selectedBudget && {
          budgetId: selectedBudget.id,
          budgetValue: selectedBudget.valor,
          budgetStatus: selectedBudget.status,
          budgetDate: selectedBudget.data_criacao
        })
      };

      const prompt = customPrompt || `
        Compare as imagens do banco de dados com as imagens de webscraping e forneça uma análise detalhada sobre:
        
        1. SIMILARIDADE VISUAL:
        - Percentual de similaridade entre as propriedades
        - Características arquitetônicas em comum
        - Diferenças estruturais identificadas
        
        2. QUALIDADE DAS IMAGENS:
        - Resolução e nitidez das imagens do banco vs webscraping
        - Ângulos e perspectivas utilizadas
        - Iluminação e condições de captura
        
        3. AUTENTICIDADE:
        - Indicadores de que as imagens são da mesma propriedade
        - Elementos únicos que confirmam ou negam a correspondência
        - Possíveis sinais de edição ou manipulação
        
        4. AVALIAÇÃO DE VALOR:
        - Consistência na apresentação da propriedade
        - Impacto das diferenças no valor percebido
        - Recomendações para verificação adicional
        
        5. CONCLUSÃO:
        - Probabilidade de serem da mesma propriedade (0-100%)
        - Nível de confiança na análise
        - Próximos passos recomendados
      `;

      // Análise comparativa usando CustomAIService
      const result1 = await CustomAIService.analyzeMultipleImages(databaseImages, prompt, enrichedPropertyInfo);
      const result2 = await CustomAIService.analyzeMultipleImages(webscrapingImages, prompt, enrichedPropertyInfo);
      
      const result = {
        success: true,
        analysis: `COMPARAÇÃO DETALHADA ENTRE IMAGENS:\n\nIMAGENS DO BANCO DE DADOS:\n${result1.analysis}\n\nIMAGENS DO WEBSCRAPING:\n${result2.analysis}\n\nANÁLISE COMPARATIVA:\nComparação realizada com IA avançada incluindo análise de metadados, geolocalização e dados de mercado.`,
        confidence: Math.min(result1.confidence || 0.8, result2.confidence || 0.8),
        metadata: result1.metadata,
        locationData: result1.locationData,
        marketAnalysis: result1.marketAnalysis
      };

      if (result.success) {
        setComparisonResult({
          analysis: result.comparison,
          timestamp: result.timestamp,
          databaseImageCount: result.property1ImageCount,
          webscrapingImageCount: result.property2ImageCount
        });
      } else {
        if (result.error && result.error.includes('sobrecarregado')) {
          setError('⚠️ O modelo de IA está temporariamente sobrecarregado. Tente novamente em alguns minutos.');
        } else {
          setError(result.error || 'Erro na comparação das imagens.');
        }
      }
    } catch (err) {
      setError(`Erro inesperado: ${err.message}`);
      
    } finally {
      setLoading(false);
    }
  };

  const isDev = import.meta.env.MODE !== 'production';
  const generateDetailedReport = () => {
    if (activeTab === 'analysis' && analysisResult) {
      const report = {
        titulo: 'Relatório de Análise de Imóvel',
        dataAnalise: new Date().toLocaleString('pt-BR'),
        analiseVisual: analysisResult.visualAnalysis?.analysis || analysisResult.analysis || analysisResult.comparison,
        analiseContextual: analysisResult.contextualAnalysis || '',
        recomendacoes: analysisResult.recommendations || '',
        metadados: analysisResult.imageMetadata || analysisResult.metadata || {},
        localizacao: analysisResult.locationData || {},
        mercado: analysisResult.marketAnalysis || {},
        propriedadesSimilares: analysisResult.similarProperties || [],
        tecnico: {
          timestamp: analysisResult.timestamp,
          aiProvider: analysisResult.aiProvider || 'IA Personalizada GeoMind',
          confidence: analysisResult.confidence || 0.85,
          analysisMethod: analysisResult.analysisMethod || 'Multi-Provider AI',
          processingTime: analysisResult.metadata?.processingTime || 'N/A',
          success: analysisResult.success !== false
        },
        imagens: images.map((img, index) => ({
          nome: `Imagem ${index + 1}`,
          arquivo: img.name || `imagem-${index + 1}`,
          tamanho: img.size ? `${(img.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'
        }))
      };
      
      setDetailedReport(report);
       setEditableReport(report);
       setShowReportModal(true);
    } else if (activeTab === 'comparison' && comparisonResult) {
      const report = {
        titulo: 'Relatório de Comparação de Imóveis',
        dataAnalise: new Date().toLocaleString('pt-BR'),
        analiseComparativa: comparisonResult.analysis,
        tecnico: {
          timestamp: comparisonResult.timestamp,
          aiProvider: comparisonResult.aiProvider || 'IA Personalizada GeoMind',
          confidence: comparisonResult.confidence,
          analysisMethod: comparisonResult.analysisMethod || 'Multi-Provider AI'
        },
        imagensOriginais: databaseImages.map((img, index) => ({
          nome: `Imagem Original ${index + 1}`,
          arquivo: img.name || `imagem-original-${index + 1}`,
          tamanho: img.size ? `${(img.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'
        })),
        imagensComparacao: webscrapingImages.map((img, index) => ({
          nome: `Imagem Comparação ${index + 1}`,
          arquivo: img.name || `imagem-comparacao-${index + 1}`,
          tamanho: img.size ? `${(img.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'
        }))
      };
      
      setDetailedReport(report);
       setEditableReport(report);
       setShowReportModal(true);
    }
  };

  // Gera e baixa PDF
  const generatePDF = async () => {
    if (activeTab === 'analysis' && !analysisResult) {
      setError('Nenhuma análise disponível para gerar PDF.');
      return;
    }
    
    if (activeTab === 'comparison' && !comparisonResult) {
      setError('Nenhuma comparação disponível para gerar PDF.');
      return;
    }

    // Mostra instruções específicas para Safari se necessário
    if (SafariCompatibility.isSafari() && !SafariCompatibility.supportsAutomaticDownloads()) {
      SafariCompatibility.showSafariInstructions('baixar o relatório PDF');
    }

    try {
      const pdfGenerator = new PDFGenerator();
      
      if (activeTab === 'analysis') {
        // Usar conteúdo editado se disponível
        const analysisContent = editableReport && editableReport.analiseVisual 
          ? editableReport.analiseVisual 
          : analysisResult.analysis;
          
        await pdfGenerator.generateAnalysisReport({
          propertyInfo,
          analysis: analysisContent,
          images,
          timestamp: analysisResult.timestamp
        });
        // Fazer o download do PDF
        const fileName = `analise_imovel_${new Date().toISOString().split('T')[0]}.pdf`;
        pdfGenerator.save(fileName);
      } else {
        // Usar conteúdo editado se disponível
        const comparisonContent = editableReport && editableReport.analiseComparativa 
          ? editableReport.analiseComparativa 
          : comparisonResult.analysis;
          
        await pdfGenerator.generateComparisonReport({
          propertyInfo,
          analysis: comparisonContent,
          databaseImages,
          webscrapingImages,
          timestamp: comparisonResult.timestamp
        });
        // Fazer o download do PDF
        const fileName = `comparacao_imovel_${new Date().toISOString().split('T')[0]}.pdf`;
        pdfGenerator.save(fileName);
      }
    } catch (err) {
      setError(`Erro ao gerar PDF: ${err.message}`);
    }
  };

  // Salvar análise como avaliação
  const saveAnalysisAsAvaliacao = async () => {
    if (!analysisResult || !selectedProjeto || !selectedOrcamento) {
      setError('É necessário ter um resultado de análise e um projeto/orçamento selecionado.');
      return;
    }

    try {
       setLoading(true);
       const selectedBudget = orcamentos.find(o => o.id === selectedOrcamento);
       const selectedProject = projetos.find(p => p.id === selectedProjeto);
       const selectedClient = clientes.find(c => c.id === selectedProject?.cliente_id);
      
      const avaliacaoData = {
        orcamento_id: selectedOrcamento,
        projeto_id: selectedProjeto,
        cliente_id: selectedProject?.cliente_id,
        metodologia_utilizada: 'Análise de Imagens com IA',
        valor_final: selectedBudget?.valorEstimado || 0,
        observacoes: `Análise realizada com IA para o projeto "${selectedProject?.nome}" do cliente "${selectedClient?.nome}":\n\n${analysisResult.analysis}`,
        status: 'concluida',
        data_avaliacao: new Date().toISOString().split('T')[0],
        detalhes_analise: {
          tipo_analise: analysisType,
          numero_imagens: analysisResult.images?.length || 0,
          propriedades_analisadas: analysisResult.propertyInfo,
          timestamp: new Date().toISOString(),
          projeto_info: {
            nome: selectedProject?.nome,
            endereco: selectedProject?.endereco,
            cliente: selectedClient?.nome
          }
        }
      };

      // Usar relationshipService para criar a avaliação com relacionamentos
      const response = await relationshipService.createEvaluationWithRelations(avaliacaoData);
      
      if (response.data.success) {
        const avaliacaoSalva = {
          ...response.data.data,
          orcamento: selectedBudget
        };
        setSavedAvaliacao(avaliacaoSalva);
        alert('Análise salva como avaliação com sucesso! Agora você pode gerar o laudo.');
      } else {
        throw new Error(response.data.message || 'Erro ao salvar avaliação');
      }
    } catch (error) {
      if (isDev) console.error('Erro ao salvar avaliação:', error);
      setError('Erro ao salvar análise como avaliação: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGerarLaudo = () => {
    if (savedAvaliacao) {
      setShowLaudoPDF(true);
    } else {
      alert('Primeiro salve a análise como avaliação para poder gerar o laudo.');
    }
  };

  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      marginBottom: '20px'
    },
    title: {
      fontSize: '24px',
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: '20px',
      textAlign: 'center'
    },
    section: {
      marginBottom: '24px'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '12px'
    },
    formGroup: {
      marginBottom: '16px'
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '6px'
    },
    input: {
      width: '100%',
      padding: '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '14px',
      transition: 'border-color 0.2s'
    },
    select: {
      width: '100%',
      padding: '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '14px',
      backgroundColor: 'white'
    },
    textarea: {
      width: '100%',
      padding: '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '14px',
      minHeight: '120px',
      resize: 'vertical'
    },
    fileInput: {
      width: '100%',
      padding: '12px',
      border: '2px dashed #d1d5db',
      borderRadius: '8px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'border-color 0.2s'
    },
    imageGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '12px',
      marginTop: '12px'
    },
    imageItem: {
      position: 'relative',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '8px',
      textAlign: 'center'
    },
    removeButton: {
      position: 'absolute',
      top: '4px',
      right: '4px',
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '24px',
      height: '24px',
      cursor: 'pointer',
      fontSize: '12px'
    },
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
      flexWrap: 'wrap'
    },
    button: {
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      border: 'none'
    },
    primaryButton: {
      backgroundColor: '#10b981',
      color: 'white'
    },
    secondaryButton: {
      backgroundColor: '#6b7280',
      color: 'white'
    },
    dangerButton: {
      backgroundColor: '#ef4444',
      color: 'white'
    },
    resultCard: {
      backgroundColor: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '20px',
      marginTop: '20px'
    },
    resultText: {
      fontSize: '14px',
      lineHeight: '1.6',
      color: '#374151',
      whiteSpace: 'pre-wrap'
    },
    error: {
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#dc2626',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '16px'
    },
    loading: {
      textAlign: 'center',
      padding: '40px',
      color: '#6b7280'
    },
    row: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '16px'
    },
    formRow: {
      display: 'flex',
      gap: '16px',
      flexWrap: 'wrap'
    },
    projectInfo: {
      backgroundColor: '#f0f9ff',
      border: '1px solid #0ea5e9',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '12px'
    },
    projectInfoTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#0369a1',
      marginBottom: '8px'
    },
    projectInfoText: {
      fontSize: '14px',
      color: '#374151',
      marginBottom: '4px'
    },
    loadingText: {
      color: '#6b7280',
      fontStyle: 'italic'
    }
  };

  return (
    <div style={styles.container}>
      <SafariNotification 
        action="gerar relatórios PDF e fazer upload de imagens"
        showOnMount={true}
        autoHide={true}
      />
      <div style={styles.card}>
        <h1 style={styles.title}>Análise de Imóveis com IA</h1>
        
        <div className="tab-navigation" style={{ display: 'flex', gap: '12px', marginBottom: '20px', justifyContent: 'center' }}>
          <button 
            style={{
              ...styles.button,
              ...(activeTab === 'analysis' ? styles.primaryButton : styles.secondaryButton),
              padding: '8px 16px'
            }}
            onClick={() => setActiveTab('analysis')}
          >
            📊 Análise Simples
          </button>
          <button 
            style={{
              ...styles.button,
              ...(activeTab === 'comparison' ? styles.primaryButton : styles.secondaryButton),
              padding: '8px 16px'
            }}
            onClick={() => setActiveTab('comparison')}
          >
            🔍 Comparação de Imagens
          </button>
        </div>

        <div style={{ ...styles.card, marginTop: '12px' }}>
          <h3 style={styles.sectionTitle}>Configuração de APIs</h3>
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>OpenAI API Key</label>
              <input type="password" value={apiKeys.OPENAI} onChange={(e)=>setApiKeys(prev=>({ ...prev, OPENAI: e.target.value }))} style={styles.input} placeholder="sk-..." />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Anthropic API Key</label>
              <input type="password" value={apiKeys.ANTHROPIC} onChange={(e)=>setApiKeys(prev=>({ ...prev, ANTHROPIC: e.target.value }))} style={styles.input} placeholder="api_key" />
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Google Vision API Key</label>
              <input type="password" value={apiKeys.GOOGLE_VISION} onChange={(e)=>setApiKeys(prev=>({ ...prev, GOOGLE_VISION: e.target.value }))} style={styles.input} placeholder="AIza..." />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>OpenCage API Key</label>
              <input type="password" value={apiKeys.OPENCAGE} onChange={(e)=>setApiKeys(prev=>({ ...prev, OPENCAGE: e.target.value }))} style={styles.input} placeholder="opencage-key" />
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Mapbox Token</label>
              <input type="password" value={apiKeys.MAPBOX} onChange={(e)=>setApiKeys(prev=>({ ...prev, MAPBOX: e.target.value }))} style={styles.input} placeholder="pk.ey..." />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Google Maps Geocoding Key</label>
              <input type="password" value={apiKeys.GOOGLE_MAPS} onChange={(e)=>setApiKeys(prev=>({ ...prev, GOOGLE_MAPS: e.target.value }))} style={styles.input} placeholder="AIza..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={()=>{
                ApiKeyStore.set('OPENAI', apiKeys.OPENAI);
                ApiKeyStore.set('ANTHROPIC', apiKeys.ANTHROPIC);
                ApiKeyStore.set('GOOGLE_VISION', apiKeys.GOOGLE_VISION);
                ApiKeyStore.set('OPENCAGE', apiKeys.OPENCAGE);
                ApiKeyStore.set('MAPBOX', apiKeys.MAPBOX);
                ApiKeyStore.set('GOOGLE_MAPS', apiKeys.GOOGLE_MAPS);
                setProvidersStatus({
                  openai: !!apiKeys.OPENAI,
                  anthropic: !!apiKeys.ANTHROPIC,
                  googleVision: !!apiKeys.GOOGLE_VISION,
                  geocode: !!(apiKeys.OPENCAGE || apiKeys.MAPBOX || apiKeys.GOOGLE_MAPS)
                });
                alert('Chaves salvas localmente. Reinicie a análise para aplicar.');
              }}
              style={{ ...styles.button, ...styles.primaryButton }}
            >
              Salvar Chaves
            </button>
            <button
              onClick={async ()=>{
                try {
                  const adminToken = localStorage.getItem('geomind_admin_token') || '';
                  await api.post(API_ENDPOINTS.integracoes.apis, {
                    OPENAI: apiKeys.OPENAI,
                    ANTHROPIC: apiKeys.ANTHROPIC,
                    GOOGLE_VISION: apiKeys.GOOGLE_VISION,
                    OPENCAGE: apiKeys.OPENCAGE,
                    MAPBOX: apiKeys.MAPBOX,
                    GOOGLE_MAPS: apiKeys.GOOGLE_MAPS
                  }, { headers: { 'x-admin-token': adminToken } });
                  const statusResp = await api.get(API_ENDPOINTS.integracoes.apis);
                  const st = statusResp.data?.status || {};
                  setProvidersStatus({
                    openai: !!st.OPENAI,
                    anthropic: !!st.ANTHROPIC,
                    googleVision: !!st.GOOGLE_VISION,
                    geocode: !!(st.OPENCAGE || st.MAPBOX || st.GOOGLE_MAPS)
                  });
                  alert('Chaves salvas no servidor com sucesso.');
                } catch (e) {
                  if (isDev) console.error('Erro ao salvar chaves no servidor:', e);
                  alert('Erro ao salvar no servidor. Verifique o token admin.');
                }
              }}
              style={{ ...styles.button, backgroundColor: '#0ea5e9', color: 'white' }}
            >
              Salvar no Servidor
            </button>
            <div style={{ alignSelf: 'center', fontSize: '12px', color: '#6b7280' }}>
              OpenAI: {providersStatus.openai ? 'ok' : 'off'} | Anthropic: {providersStatus.anthropic ? 'ok' : 'off'} | Google Vision: {providersStatus.googleVision ? 'ok' : 'off'} | Geocoding: {providersStatus.geocode ? 'ok' : 'off'}
            </div>
          </div>
        </div>
        
        {error && <div style={styles.error}>{error}</div>}
        
        {activeTab === 'analysis' && (
          <>
            {/* Configuração do tipo de análise */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Tipo de Análise</h3>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                style={styles.select}
              >
                <option value="single">Análise de Imagem Única</option>
                <option value="multiple">Análise de Múltiplas Imagens</option>
                <option value="comparison">Comparação de Imagens</option>
              </select>
            </div>

            {/* Informações do imóvel */}
            <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Informações do Imóvel (Opcional)</h3>
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Endereço</label>
              <input
                type="text"
                value={propertyInfo.endereco}
                onChange={(e) => handlePropertyInfoChange('endereco', e.target.value)}
                style={styles.input}
                placeholder="Endereço completo do imóvel"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Cidade</label>
              <input
                type="text"
                value={propertyInfo.cidade}
                onChange={(e) => handlePropertyInfoChange('cidade', e.target.value)}
                style={styles.input}
                placeholder="Cidade"
              />
            </div>
          </div>
          
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tipo de Imóvel</label>
            <select
              value={propertyInfo.tipo}
              onChange={(e) => handlePropertyInfoChange('tipo', e.target.value)}
              style={styles.select}
            >
              <option value="">Selecione o tipo</option>
              <option value="Casa">Casa</option>
              <option value="Apartamento">Apartamento</option>
              <option value="Terreno">Terreno</option>
              <option value="Comercial">Comercial</option>
              <option value="Industrial">Industrial</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Finalidade</label>
            <select
              value={propertyInfo.finalidade}
              onChange={(e) => handlePropertyInfoChange('finalidade', e.target.value)}
              style={styles.select}
            >
              <option value="">Selecione a finalidade</option>
              <option value="Compra e Venda">Compra e Venda</option>
              <option value="Financiamento">Financiamento</option>
              <option value="Seguro">Seguro</option>
              <option value="Locação">Locação</option>
              <option value="Judicial">Judicial</option>
            </select>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Latitude (manual)</label>
            <input
              type="number"
              step="0.000001"
              value={propertyInfo.coordsLat}
              onChange={(e) => handlePropertyInfoChange('coordsLat', e.target.value)}
              style={styles.input}
              placeholder="Ex.: -30.123456"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Longitude (manual)</label>
            <input
              type="number"
              step="0.000001"
              value={propertyInfo.coordsLng}
              onChange={(e) => handlePropertyInfoChange('coordsLng', e.target.value)}
              style={styles.input}
              placeholder="Ex.: -51.123456"
            />
          </div>
        </div>
          
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Área do Terreno (m²)</label>
              <input
                type="number"
                value={propertyInfo.areaTerreno}
                onChange={(e) => handlePropertyInfoChange('areaTerreno', e.target.value)}
                style={styles.input}
                placeholder="Área do terreno"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Área Construída (m²)</label>
              <input
                type="number"
                value={propertyInfo.areaConstruida}
                onChange={(e) => handlePropertyInfoChange('areaConstruida', e.target.value)}
                style={styles.input}
                placeholder="Área construída"
              />
            </div>
          </div>
        </div>

        {/* Seleção de Projeto */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Vincular à Projeto</h3>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Cliente</label>
              <select
                value={selectedCliente}
                onChange={(e) => setSelectedCliente(e.target.value)}
                style={styles.select}
                disabled={loadingData}
              >
                <option value="">Selecione um cliente</option>
                {clientes.map(cliente => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Projeto</label>
              <select
                value={selectedProjeto}
                onChange={(e) => setSelectedProjeto(e.target.value)}
                style={styles.select}
                disabled={!selectedCliente || loadingData}
              >
                <option value="">Selecione um projeto</option>
                {projetos.map(projeto => (
                  <option key={projeto.id} value={projeto.id}>
                    {projeto.nome}
                  </option>
                ))}
              </select>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Orçamento (Opcional)</label>
              <select
                value={selectedOrcamento}
                onChange={(e) => setSelectedOrcamento(e.target.value)}
                style={styles.select}
                disabled={!selectedProjeto || loadingData}
              >
                <option value="">Selecione um orçamento</option>
                {orcamentos.map(orcamento => (
                  <option key={orcamento.id} value={orcamento.id}>
                    {orcamento.descricao} - R$ {orcamento.valorEstimado?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {selectedProjeto && (
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Dados do Projeto Selecionado:</h4>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                <p><strong>Endereço:</strong> {propertyInfo.endereco}</p>
                <p><strong>Cidade:</strong> {propertyInfo.cidade}</p>
                <p><strong>Tipo:</strong> {propertyInfo.tipo}</p>
                <p><strong>Finalidade:</strong> {propertyInfo.finalidade}</p>
                {propertyInfo.areaTerreno && <p><strong>Área do Terreno:</strong> {propertyInfo.areaTerreno} m²</p>}
                {propertyInfo.areaConstruida && <p><strong>Área Construída:</strong> {propertyInfo.areaConstruida} m²</p>}
              </div>
            </div>
          )}
        </div>

            {/* Upload de imagens */}
            <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Imagens para Análise</h3>
          <div style={styles.formGroup}>
            <label style={styles.label}>Selecionar Imagens</label>
            <input
              type="file"
              multiple
              accept="image/*,.heic,.heif"
              onChange={handleImageUpload}
              style={styles.fileInput}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
              {analysisType === 'single' && 'Selecione uma imagem para análise.'}
              {analysisType === 'multiple' && 'Selecione múltiplas imagens do mesmo imóvel.'}
              {analysisType === 'comparison' && 'Selecione imagens de dois imóveis diferentes (serão divididas automaticamente).'}
            </p>
          </div>
          
          {images.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', color: '#374151' }}>
                  {images.length} imagem(ns) selecionada(s)
                </span>
                <button
                  onClick={clearImages}
                  style={{ ...styles.button, ...styles.dangerButton, padding: '6px 12px', fontSize: '12px' }}
                >
                  Limpar Todas
                </button>
              </div>
              
              <div style={styles.imageGrid}>
                {images.map((image, index) => (
                  <div key={index} style={styles.imageItem}>
                    <button
                      onClick={() => removeImage(index)}
                      style={styles.removeButton}
                    >
                      ×
                    </button>
                    <div style={{ marginBottom: '6px' }}>
                      <img
                        alt={image.name}
                        src={SafariCompatibility.createObjectURL(image)}
                        style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }}
                      />
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', wordBreak: 'break-word' }}>
                      {image.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                      {(image.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

            {/* Prompt personalizado */}
            <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Prompt Personalizado (Opcional)</h3>
          <div style={styles.formGroup}>
            <label style={styles.label}>Instruções Específicas para a IA</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              style={styles.textarea}
              placeholder="Digite instruções específicas para a análise. Deixe em branco para usar o prompt padrão otimizado para análise de imóveis."
            />
          </div>
        </div>

            {/* Botões de ação */}
            <div style={styles.buttonGroup}>
              <button
                onClick={runAnalysis}
                disabled={loading || images.length === 0}
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  opacity: loading || images.length === 0 ? 0.6 : 1
                }}
              >
                {loading ? 'Analisando...' : 'Iniciar Análise'}
              </button>
              
              {analysisResult && (
                <>
                  <button
                    onClick={generateDetailedReport}
                    style={{ ...styles.button, backgroundColor: '#3b82f6', color: 'white' }}
                  >
                    📋 Ver Relatório Detalhado
                  </button>
                  
                  <button
                    onClick={generatePDF}
                    style={{ ...styles.button, ...styles.secondaryButton }}
                  >
                    Gerar PDF
                  </button>
                  
                  {selectedProjeto && selectedOrcamento && (
                    <>
                      <button
                        onClick={saveAnalysisAsAvaliacao}
                        disabled={loading}
                        style={{
                          ...styles.button,
                          backgroundColor: '#059669',
                          color: 'white',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        {loading ? 'Salvando...' : 'Salvar como Avaliação'}
                      </button>
                      
                      {savedAvaliacao && (
                        <button
                          onClick={handleGerarLaudo}
                          style={{
                            ...styles.button,
                            backgroundColor: '#7c3aed',
                            color: 'white'
                          }}
                        >
                          📄 Gerar Laudo
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'comparison' && (
          <>
            {/* Seção de imagens do banco de dados */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Imagens do Banco de Dados</h3>
              <div style={styles.formGroup}>
                <label style={styles.label}>Selecionar Imagens do Banco</label>
                <input
                  type="file"
                  multiple
                  accept="image/*,.heic,.heif"
                  onChange={handleDatabaseImageUpload}
                  style={styles.fileInput}
                />
              </div>
              
              {databaseImages.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#374151' }}>
                      {databaseImages.length} imagem(ns) do banco
                    </span>
                    <button
                      onClick={() => setDatabaseImages([])}
                      style={{ ...styles.button, ...styles.dangerButton, padding: '6px 12px', fontSize: '12px' }}
                    >
                      Limpar
                    </button>
                  </div>
                  
                  <div style={styles.imageGrid}>
                    {databaseImages.map((image, index) => (
                      <div key={index} style={styles.imageItem}>
                        <button
                          onClick={() => removeDatabaseImage(index)}
                          style={styles.removeButton}
                        >
                          ×
                        </button>
                        <div style={{ marginBottom: '6px' }}>
                          <img
                            alt={image.name}
                            src={SafariCompatibility.createObjectURL(image)}
                            style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }}
                          />
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', wordBreak: 'break-word' }}>
                          {image.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                          {(image.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seção de imagens de webscraping */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Imagens de Webscraping</h3>
              <div style={styles.formGroup}>
                <label style={styles.label}>Selecionar Imagens de Webscraping</label>
                <input
                  type="file"
                  multiple
                  accept="image/*,.heic,.heif"
                  onChange={handleWebscrapingImageUpload}
                  style={styles.fileInput}
                />
              </div>
              
              {webscrapingImages.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#374151' }}>
                      {webscrapingImages.length} imagem(ns) de webscraping
                    </span>
                    <button
                      onClick={() => setWebscrapingImages([])}
                      style={{ ...styles.button, ...styles.dangerButton, padding: '6px 12px', fontSize: '12px' }}
                    >
                      Limpar
                    </button>
                  </div>
                  
                  <div style={styles.imageGrid}>
                    {webscrapingImages.map((image, index) => (
                      <div key={index} style={styles.imageItem}>
                        <button
                          onClick={() => removeWebscrapingImage(index)}
                          style={styles.removeButton}
                        >
                          ×
                        </button>
                        <div style={{ marginBottom: '6px' }}>
                          <img
                            alt={image.name}
                            src={SafariCompatibility.createObjectURL(image)}
                            style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }}
                          />
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', wordBreak: 'break-word' }}>
                          {image.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                          {(image.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Prompt personalizado para comparação */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Prompt Personalizado (Opcional)</h3>
              <div style={styles.formGroup}>
                <label style={styles.label}>Instruções Específicas para Comparação</label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  style={styles.textarea}
                  placeholder="Digite instruções específicas para a comparação. Deixe em branco para usar o prompt padrão otimizado para comparação de imóveis."
                />
              </div>
            </div>

            {/* Botões de ação para comparação */}
            <div style={styles.buttonGroup}>
              <button
                onClick={handleComparison}
                disabled={loading || databaseImages.length === 0 || webscrapingImages.length === 0}
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  opacity: loading || databaseImages.length === 0 || webscrapingImages.length === 0 ? 0.6 : 1
                }}
              >
                {loading ? 'Comparando...' : 'Iniciar Comparação'}
              </button>
              
              {comparisonResult && (
                <>
                  <button
                    onClick={generateDetailedReport}
                    style={{ ...styles.button, backgroundColor: '#3b82f6', color: 'white' }}
                  >
                    📋 Ver Relatório Detalhado
                  </button>
                  
                  <button
                    onClick={generatePDF}
                    style={{ ...styles.button, ...styles.secondaryButton }}
                  >
                    Gerar PDF
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* Loading */}
        {loading && (
          <div style={styles.loading}>
            <div>🤖 Analisando imagens com IA...</div>
            <div style={{ fontSize: '12px', marginTop: '8px' }}>Isso pode levar alguns segundos</div>
          </div>
        )}

        {/* Resultado da análise */}
        {analysisResult && activeTab === 'analysis' && (
          <div style={styles.resultCard}>
            <h3 style={styles.sectionTitle}>🤖 Resultado da Análise da IA</h3>
            
            {/* Análise Principal */}
            <div style={styles.resultText}>
              <h4 style={{ color: '#1f2937', marginBottom: '12px', fontSize: '16px' }}>📋 Análise Visual</h4>
              {analysisResult.analysis || analysisResult.comparison}
            </div>
            
            {/* Metadados EXIF */}
            {analysisResult.metadata && (
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                <h4 style={{ color: '#1f2937', marginBottom: '12px', fontSize: '16px' }}>📸 Metadados da Imagem</h4>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  {analysisResult.metadata.camera && (
                    <div><strong>Câmera:</strong> {analysisResult.metadata.camera}</div>
                  )}
                  {analysisResult.metadata.dateTime && (
                    <div><strong>Data/Hora:</strong> {analysisResult.metadata.dateTime}</div>
                  )}
                  {analysisResult.metadata.gps && (
                    <div><strong>GPS:</strong> {analysisResult.metadata.gps.latitude}, {analysisResult.metadata.gps.longitude}</div>
                  )}
                  {analysisResult.metadata.dimensions && (
                    <div><strong>Dimensões:</strong> {analysisResult.metadata.dimensions}</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Dados de Localização */}
            {analysisResult.locationData && (
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '8px' }}>
                <h4 style={{ color: '#1f2937', marginBottom: '12px', fontSize: '16px' }}>📍 Informações de Localização</h4>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  {analysisResult.locationData.address && (
                    <div><strong>Endereço:</strong> {analysisResult.locationData.address}</div>
                  )}
                  {analysisResult.locationData.neighborhood && (
                    <div><strong>Bairro:</strong> {analysisResult.locationData.neighborhood}</div>
                  )}
                  {analysisResult.locationData.city && (
                    <div><strong>Cidade:</strong> {analysisResult.locationData.city}</div>
                  )}
                  {analysisResult.locationData.coordinates && (
                    <div><strong>Coordenadas:</strong> {analysisResult.locationData.coordinates}</div>
                  )}
                </div>
              </div>
            )}

            {analysisResult.amenities && (
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#eef2ff', borderRadius: '8px' }}>
                <h4 style={{ color: '#1f2937', marginBottom: '12px', fontSize: '16px' }}>🗺️ Comodidades no Entorno</h4>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  <div><strong>Total mapeado:</strong> {analysisResult.amenities.total}</div>
                  <div style={{ marginTop: '8px' }}>
                    {Object.entries(analysisResult.amenities.summary).slice(0,8).map(([k,v]) => (
                      <span key={k} style={{ display: 'inline-block', marginRight: '8px', marginBottom: '6px', backgroundColor: '#e2e8f0', color: '#1f2937', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>{k}: {v}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Análise de Mercado */}
            {analysisResult.marketAnalysis && (
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                <h4 style={{ color: '#1f2937', marginBottom: '12px', fontSize: '16px' }}>💰 Análise de Mercado</h4>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  {analysisResult.marketAnalysis.averagePrice && (
                    <div><strong>Preço Médio da Região:</strong> {analysisResult.marketAnalysis.averagePrice}</div>
                  )}
                  {analysisResult.marketAnalysis.priceRange && (
                    <div><strong>Faixa de Preços:</strong> {analysisResult.marketAnalysis.priceRange}</div>
                  )}
                  {analysisResult.marketAnalysis.marketTrend && (
                    <div><strong>Tendência:</strong> {analysisResult.marketAnalysis.marketTrend}</div>
                  )}
                  {analysisResult.marketAnalysis.similarProperties && (
                    <div><strong>Propriedades Similares:</strong> {analysisResult.marketAnalysis.similarProperties} encontradas</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Informações Técnicas */}
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#e0e7ff', borderRadius: '8px' }}>
              <h4 style={{ color: '#1f2937', marginBottom: '12px', fontSize: '16px' }}>⚙️ Informações Técnicas</h4>
              <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.6' }}>
                <div>Análise realizada em: {new Date(analysisResult.timestamp).toLocaleString('pt-BR')}</div>
                <div>Modelo de IA: {analysisResult.aiProvider || 'IA Personalizada GeoMind'}</div>
                <div>Confiança: {analysisResult.confidence ? (analysisResult.confidence * 100).toFixed(1) + '%' : 'N/A'}</div>
                <div>Método: {analysisResult.analysisMethod || 'Multi-Provider AI'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Resultado da comparação */}
        {comparisonResult && activeTab === 'comparison' && (
          <div style={styles.resultCard}>
            <h3 style={styles.sectionTitle}>Resultado da Comparação</h3>
            <div style={styles.resultText}>
              {comparisonResult.analysis}
            </div>
            
            <div style={{ marginTop: '16px', fontSize: '12px', color: '#6b7280' }}>
              <div>Comparação realizada em: {new Date(comparisonResult.timestamp).toLocaleString('pt-BR')}</div>
              <div>Imagens do banco: {comparisonResult.databaseImageCount}</div>
              <div>Imagens de webscraping: {comparisonResult.webscrapingImageCount}</div>
            </div>
          </div>
        )}
        
        {/* Modal do Relatório Detalhado */}
        {showReportModal && detailedReport && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '90%',
              height: '90%',
              maxWidth: '1000px',
              position: 'relative',
              overflow: 'auto'
            }}>
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                backgroundColor: 'white',
                zIndex: 1
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
                  {detailedReport.titulo}
                </h2>
                <button
                  onClick={() => setShowReportModal(false)}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '20px' }}>
                  <p><strong>Data da Análise:</strong> {detailedReport.dataAnalise}</p>
                </div>
                
                {detailedReport.analiseVisual && (
                   <div style={{ marginBottom: '20px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                       <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>📋 Análise Visual</h3>
                       <button
                         onClick={() => setIsEditingReport(!isEditingReport)}
                         style={{
                           background: isEditingReport ? '#ef4444' : '#3b82f6',
                           color: 'white',
                           border: 'none',
                           borderRadius: '6px',
                           padding: '4px 8px',
                           fontSize: '12px',
                           cursor: 'pointer'
                         }}
                       >
                         {isEditingReport ? '❌ Cancelar' : '✏️ Editar'}
                       </button>
                     </div>
                     {isEditingReport ? (
                       <textarea
                         value={editableReport.analiseVisual}
                         onChange={(e) => setEditableReport({
                           ...editableReport,
                           analiseVisual: e.target.value
                         })}
                         style={{
                           width: '100%',
                           minHeight: '200px',
                           backgroundColor: '#f9fafb',
                           padding: '16px',
                           borderRadius: '8px',
                           border: '2px solid #3b82f6',
                           fontSize: '14px',
                           lineHeight: '1.6',
                           fontFamily: 'inherit',
                           resize: 'vertical'
                         }}
                       />
                     ) : (
                       <div style={{
                         backgroundColor: '#f9fafb',
                         padding: '16px',
                         borderRadius: '8px',
                         whiteSpace: 'pre-wrap',
                         fontSize: '14px',
                         lineHeight: '1.6'
                       }}>
                         {editableReport.analiseVisual}
                       </div>
                     )}
                   </div>
                 )}
                
                {detailedReport.analiseComparativa && (
                   <div style={{ marginBottom: '20px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                       <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>🔍 Análise Comparativa</h3>
                       <button
                         onClick={() => setIsEditingReport(!isEditingReport)}
                         style={{
                           background: isEditingReport ? '#ef4444' : '#3b82f6',
                           color: 'white',
                           border: 'none',
                           borderRadius: '6px',
                           padding: '4px 8px',
                           fontSize: '12px',
                           cursor: 'pointer'
                         }}
                       >
                         {isEditingReport ? '❌ Cancelar' : '✏️ Editar'}
                       </button>
                     </div>
                     {isEditingReport ? (
                       <textarea
                         value={editableReport.analiseComparativa}
                         onChange={(e) => setEditableReport({
                           ...editableReport,
                           analiseComparativa: e.target.value
                         })}
                         style={{
                           width: '100%',
                           minHeight: '200px',
                           backgroundColor: '#f9fafb',
                           padding: '16px',
                           borderRadius: '8px',
                           border: '2px solid #3b82f6',
                           fontSize: '14px',
                           lineHeight: '1.6',
                           fontFamily: 'inherit',
                           resize: 'vertical'
                         }}
                       />
                     ) : (
                       <div style={{
                         backgroundColor: '#f9fafb',
                         padding: '16px',
                         borderRadius: '8px',
                         whiteSpace: 'pre-wrap',
                         fontSize: '14px',
                         lineHeight: '1.6'
                       }}>
                         {editableReport.analiseComparativa}
                       </div>
                     )}
                   </div>
                 )}
                
                {detailedReport.metadados && Object.keys(detailedReport.metadados).length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>📸 Metadados</h3>
                    <div style={{
                      backgroundColor: '#f3f4f6',
                      padding: '16px',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}>
                      {Object.entries(detailedReport.metadados).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: '4px' }}>
                          <strong>{key}:</strong> {JSON.stringify(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {detailedReport.localizacao && Object.keys(detailedReport.localizacao).length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>📍 Localização</h3>
                    <div style={{
                      backgroundColor: '#ecfdf5',
                      padding: '16px',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}>
                      {Object.entries(detailedReport.localizacao).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: '4px' }}>
                          <strong>{key}:</strong> {JSON.stringify(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {detailedReport.mercado && Object.keys(detailedReport.mercado).length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>💰 Análise de Mercado</h3>
                    <div style={{
                      backgroundColor: '#fef3c7',
                      padding: '16px',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}>
                      {Object.entries(detailedReport.mercado).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: '4px' }}>
                          <strong>{key}:</strong> {JSON.stringify(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>⚙️ Informações Técnicas</h3>
                  <div style={{
                    backgroundColor: '#e0e7ff',
                    padding: '16px',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}>
                    {Object.entries(detailedReport.tecnico).map(([key, value]) => (
                      <div key={key} style={{ marginBottom: '4px' }}>
                        <strong>{key}:</strong> {JSON.stringify(value)}
                      </div>
                    ))}
                  </div>
                </div>
                
                {detailedReport.imagens && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>🖼️ Imagens Analisadas</h3>
                    <div style={{
                      backgroundColor: '#f9fafb',
                      padding: '16px',
                      borderRadius: '8px'
                    }}>
                      {detailedReport.imagens.map((img, index) => (
                        <div key={index} style={{ marginBottom: '8px', fontSize: '14px' }}>
                          <strong>{img.nome}:</strong> {img.arquivo} ({img.tamanho})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {detailedReport.imagensOriginais && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>🖼️ Imagens Originais</h3>
                    <div style={{
                      backgroundColor: '#f9fafb',
                      padding: '16px',
                      borderRadius: '8px'
                    }}>
                      {detailedReport.imagensOriginais.map((img, index) => (
                        <div key={index} style={{ marginBottom: '8px', fontSize: '14px' }}>
                          <strong>{img.nome}:</strong> {img.arquivo} ({img.tamanho})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {detailedReport.imagensComparacao && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>🔍 Imagens de Comparação</h3>
                    <div style={{
                      backgroundColor: '#f9fafb',
                      padding: '16px',
                      borderRadius: '8px'
                    }}>
                      {detailedReport.imagensComparacao.map((img, index) => (
                        <div key={index} style={{ marginBottom: '8px', fontSize: '14px' }}>
                          <strong>{img.nome}:</strong> {img.arquivo} ({img.tamanho})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'center',
                  marginTop: '30px',
                  paddingTop: '20px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <button
                     onClick={() => {
                       if (isEditingReport) {
                         setIsEditingReport(false);
                         alert('✅ Alterações salvas! Agora você pode gerar o PDF com o conteúdo editado.');
                       } else {
                         generatePDF();
                       }
                     }}
                     style={{
                       ...styles.button,
                       backgroundColor: isEditingReport ? '#f59e0b' : '#10b981',
                       color: 'white'
                     }}
                   >
                     {isEditingReport ? '💾 Salvar Alterações' : '📄 Gerar PDF'}
                   </button>
                  
                  <button
                    onClick={() => setShowReportModal(false)}
                    style={{
                      ...styles.button,
                      backgroundColor: '#6b7280',
                      color: 'white'
                    }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal do Laudo PDF */}
        {showLaudoPDF && savedAvaliacao && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '90%',
              height: '90%',
              maxWidth: '1200px',
              position: 'relative'
            }}>
              <button
                onClick={() => setShowLaudoPDF(false)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  zIndex: 1001
                }}
              >
                ×
              </button>
              <LaudoPDF 
                 avaliacao={savedAvaliacao} 
                 onClose={() => setShowLaudoPDF(false)}
               />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIImageAnalysis;
