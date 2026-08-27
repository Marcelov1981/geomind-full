import React, { useState, useRef } from 'react';
import { Upload, Image, MapPin, Calendar, Camera, TrendingUp, Home, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import ExifService from '../utils/ExifService.js';
import PropertyScrapingService from '../utils/PropertyScrapingService.js';
import { analyzeImageOnServer } from '../services/aiAnalysisService';

const AIImageAnalysisV2 = () => {
  const [selectedImages, setSelectedImages] = useState([]);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState('');
  const [config, setConfig] = useState({
    aiProvider: 'google-gemini',
    projectId: '',
    includeMarketAnalysis: true,
    searchRadius: 2000,
    maxSimilarProperties: 10
  });
  const fileInputRef = useRef(null);

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setError('Por favor, selecione apenas arquivos de imagem.');
      return;
    }
    
    setSelectedImages(prev => [...prev, ...imageFiles]);
    setError('');
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeImages = async () => {
    if (selectedImages.length === 0) {
      setError('Selecione pelo menos uma imagem para análise.');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setAnalysisResults([]);
    
    try {
      const results = [];
      
      for (let i = 0; i < selectedImages.length; i++) {
        const image = selectedImages[i];
        setCurrentStep(`Analisando imagem ${i + 1} de ${selectedImages.length}: ${image.name}`);
        
        // A chave Gemini permanece no backend; a tela envia apenas a evidência.
        const result = await analyzeImageOnServer(image, {
          projectId: config.projectId,
          prompt: `Análise detalhada para avaliação imobiliária. Considere apenas elementos observáveis. Raio de busca solicitado: ${config.searchRadius}m. Não estime valor e não conclua segurança estrutural.`,
        });
        
        results.push({
          fileName: image.name,
          fileSize: image.size,
          ...result
        });
      }
      
      setAnalysisResults(results);
      setCurrentStep('Análise concluída!');
      
    } catch (err) {
      console.error('Erro na análise:', err);
      setError(`Erro durante a análise: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setCurrentStep(''), 3000);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderMetadata = (metadata) => {
    if (!metadata) return null;
    
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-2 flex items-center">
          <Camera className="w-4 h-4 mr-2" />
          Metadados da Imagem
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {metadata.dateTime && (
            <div className="flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              <span>{new Date(metadata.dateTime).toLocaleString('pt-BR')}</span>
            </div>
          )}
          {metadata.location && (
            <div className="flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              <span>{metadata.location.latitude.toFixed(6)}, {metadata.location.longitude.toFixed(6)}</span>
            </div>
          )}
          {metadata.camera && (
            <div className="col-span-2">
              <strong>Câmera:</strong> {metadata.camera.make} {metadata.camera.model}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLocationData = (locationData) => {
    if (!locationData) return null;
    
    return (
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-2 flex items-center">
          <MapPin className="w-4 h-4 mr-2" />
          Localização
        </h4>
        <div className="text-sm">
          <p><strong>Endereço:</strong> {locationData.address}</p>
          {locationData.neighborhood && (
            <p><strong>Bairro:</strong> {locationData.neighborhood}</p>
          )}
          {locationData.city && (
            <p><strong>Cidade:</strong> {locationData.city}</p>
          )}
          {locationData.coordinates && (
            <p><strong>Coordenadas:</strong> {locationData.coordinates.lat}, {locationData.coordinates.lng}</p>
          )}
        </div>
      </div>
    );
  };

  const renderMarketAnalysis = (marketAnalysis) => {
    if (!marketAnalysis) return null;
    
    return (
      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-2 flex items-center">
          <TrendingUp className="w-4 h-4 mr-2" />
          Análise de Mercado
        </h4>
        <div className="text-sm space-y-2">
          {marketAnalysis.averagePrice && (
            <p><strong>Preço Médio:</strong> R$ {marketAnalysis.averagePrice.toLocaleString('pt-BR')}</p>
          )}
          {marketAnalysis.priceRange && (
            <p><strong>Faixa de Preço:</strong> R$ {marketAnalysis.priceRange.min.toLocaleString('pt-BR')} - R$ {marketAnalysis.priceRange.max.toLocaleString('pt-BR')}</p>
          )}
          {marketAnalysis.trend && (
            <p><strong>Tendência:</strong> {marketAnalysis.trend}</p>
          )}
        </div>
      </div>
    );
  };

  const renderSimilarProperties = (properties) => {
    if (!properties || properties.length === 0) return null;
    
    return (
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-2 flex items-center">
          <Home className="w-4 h-4 mr-2" />
          Imóveis Similares ({properties.length})
        </h4>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {properties.slice(0, 5).map((property, index) => (
            <div key={index} className="text-sm border-l-2 border-yellow-300 pl-2">
              <p><strong>{property.title}</strong></p>
              <p>R$ {property.price?.toLocaleString('pt-BR')} - {property.area}m²</p>
              <p className="text-gray-600">{property.location}</p>
            </div>
          ))}
          {properties.length > 5 && (
            <p className="text-xs text-gray-500">+ {properties.length - 5} imóveis adicionais</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Análise Inteligente de Imagens Imobiliárias
          </h2>
          <p className="text-gray-600">
            IA avançada para análise de metadados, geolocalização e comparação de mercado
          </p>
        </div>

        {/* Configurações */}
        <div className="p-6 border-b bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Configurações</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ID do projeto</label>
              <input
                type="number"
                min="1"
                required
                value={config.projectId}
                onChange={(e) => setConfig(prev => ({ ...prev, projectId: e.target.value }))}
                className="w-full p-2 border rounded-md"
                placeholder="Ex.: 123"
              />
              <span className="text-xs text-gray-500">A imagem será vinculada ao projeto informado.</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Raio de Busca (m)</label>
              <input
                type="number"
                value={config.searchRadius}
                onChange={(e) => setConfig(prev => ({...prev, searchRadius: parseInt(e.target.value)}))}
                className="w-full p-2 border rounded-md"
                min="500"
                max="10000"
                step="500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max. Imóveis Similares</label>
              <input
                type="number"
                value={config.maxSimilarProperties}
                onChange={(e) => setConfig(prev => ({...prev, maxSimilarProperties: parseInt(e.target.value)}))}
                className="w-full p-2 border rounded-md"
                min="5"
                max="50"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.includeMarketAnalysis}
                  onChange={(e) => setConfig(prev => ({...prev, includeMarketAnalysis: e.target.checked}))}
                  className="mr-2"
                />
                <span className="text-sm">Análise de Mercado</span>
              </label>
            </div>
          </div>
        </div>

        {/* Upload de Imagens */}
        <div className="p-6">
          <div className="mb-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-gray-600 mb-2">
                Clique para selecionar imagens
              </p>
              <p className="text-sm text-gray-500">
                Suporte para JPG, PNG, HEIC e outros formatos de imagem
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Imagens Selecionadas */}
          {selectedImages.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Imagens Selecionadas ({selectedImages.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedImages.map((image, index) => (
                  <div key={index} className="relative border rounded-lg p-2">
                    <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-xs font-medium truncate">{image.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(image.size)}</p>
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botão de Análise */}
          <div className="flex justify-center mb-6">
            <button
              onClick={analyzeImages}
              disabled={selectedImages.length === 0 || isAnalyzing}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              {isAnalyzing ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                'Iniciar Análise Completa'
              )}
            </button>
          </div>

          {/* Status da Análise */}
          {currentStep && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <Loader className="w-5 h-5 mr-2 animate-spin text-blue-600" />
                <span className="text-blue-800">{currentStep}</span>
              </div>
            </div>
          )}

          {/* Erros */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* Resultados da Análise */}
          {analysisResults.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center mb-4">
                <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                <h3 className="text-xl font-bold text-gray-800">Resultados da Análise</h3>
              </div>
              
              {analysisResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-6 bg-white shadow-sm">
                  <h4 className="text-lg font-semibold mb-4 text-gray-800">
                    {result.fileName}
                  </h4>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {renderMetadata(result.metadata)}
                      {renderLocationData(result.locationData)}
                    </div>
                    
                    <div className="space-y-4">
                      {renderMarketAnalysis(result.marketAnalysis)}
                      {renderSimilarProperties(result.similarProperties)}
                    </div>
                  </div>
                  
                  {/* Análise Visual */}
                  {result.visualAnalysis && (
                    <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                      <h5 className="font-semibold mb-2">Análise Visual da IA</h5>
                      <div className="text-sm whitespace-pre-wrap">
                        {result.visualAnalysis.analysis}
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        Provedor: {result.visualAnalysis.provider} | 
                        Confiança: {(result.visualAnalysis.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                  
                  {/* Recomendações */}
                  {result.recommendations && (
                    <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
                      <h5 className="font-semibold mb-2">Recomendações</h5>
                      <div className="text-sm whitespace-pre-wrap">
                        {result.recommendations}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIImageAnalysisV2;