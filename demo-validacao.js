
import ReportValidationService from './src/utils/ReportValidationService.js';
import PropertyScrapingService from './src/utils/PropertyScrapingService.js';
import CustomAIService from './src/utils/CustomAIService.js';

// Mock do CustomAIService para ambiente Node (sem File API real)
// eslint-disable-next-line no-unused-vars
CustomAIService.performVisualAnalysis = async (imageMock, prompt) => {
    console.log(`   [IA Vision Mock] Analisando imagem "${imageMock.name}"...`);
    
    // Simula detecção baseada no nome do arquivo (para teste)
    let analysisText = "";
    if (imageMock.name.includes('sala')) {
        analysisText = "A imagem mostra uma sala ampla com piso de madeira, teto de gesso rebaixado e varanda integrada. Paredes pintadas de branco. Estado de conservação excelente.";
    } else if (imageMock.name.includes('cozinha')) {
        analysisText = "Cozinha planejada com armários embutidos brancos, bancada de granito e piso frio (cerâmica).";
    } else if (imageMock.name.includes('quarto')) {
        analysisText = "Quarto com ar condicionado split, armários embutidos e piso laminado de madeira.";
    }

    return {
        provider: 'Mock Vision AI',
        analysis: analysisText,
        confidence: 0.95
    };
};

async function runDemo() {
    console.log('=== DEMONSTRAÇÃO: SISTEMA DE VALIDAÇÃO DE IMÓVEIS COM IA E RASTREABILIDADE ===\n');

    // 1. Simular Obtenção de Dados (com Fontes)
    console.log('1. Buscando dados do imóvel (Simulação de Scraping)...');
    const searchParams = {
        propertyType: 'apartamento',
        minArea: 100,
        maxArea: 120,
        coordinates: { lat: -29.918, lng: -51.178 } // Canoas, RS
    };
    const results = await PropertyScrapingService.generateMockProperties('ZapImoveis', searchParams, 1);
    const propertyData = results[0];
    
    // Forçar dados para teste de validação (Coerentes com as imagens simuladas para atingir alta confiança)
    propertyData.features = [
        'Piso de Madeira',      // Visível na Sala/Quarto
        'Varanda',              // Visível na Sala
        'Armários Embutidos',   // Visível na Cozinha/Quarto
        'Ar Condicionado',      // Visível no Quarto
        'Teto de Gesso',        // Visível na Sala
        'Portaria 24h'          // Não visual (deve ser ignorado no cálculo visual)
    ];
    
    console.log('   Dados Obtidos:');
    console.log(`   - Título: ${propertyData.title}`);
    console.log(`   - Fonte: ${propertyData.source.name} (${propertyData.source.url})`);
    console.log(`   - Características Declaradas: ${propertyData.features.join(', ')}\n`);

    // 2. Simular Imagens Carregadas
    console.log('2. Carregando imagens para validação...');
    const mockImages = [
        { name: 'sala_estar_varanda.jpg' },     // Alterado nome para reforçar contexto
        { name: 'cozinha_planejada.jpg' },
        { name: 'quarto_suite.jpg' }            // Alterado nome para reforçar contexto
    ];
    console.log(`   ${mockImages.length} imagens carregadas.\n`);

    // 3. Executar Validação Cruzada
    console.log('3. Executando Validação Cruzada (Relatório vs. Imagens)...');
    const validationReport = await ReportValidationService.validateReport(propertyData, mockImages);

    // 4. Exibir Relatório de Validação
    console.log('\n=== RELATÓRIO DE VALIDAÇÃO GERADO PELA IA ===');
    console.log(`Status Geral: ${validationReport.isValid ? '✅ APROVADO' : '⚠️ REVISÃO NECESSÁRIA'}`);
    console.log(`Score de Confiança: ${(validationReport.confidenceScore * 100).toFixed(1)}%`);
    
    console.log('\n-- Detalhes da Validação --');
    validationReport.validationDetails.forEach(item => {
        const icon = item.status === 'VERIFIED' ? '✅' : '❓';
        console.log(`${icon} ${item.item}: ${item.status === 'VERIFIED' ? 'Confirmado visualmente' : item.note}`);
    });

    console.log('\n-- Fontes de Dados Utilizadas --');
    validationReport.sources.forEach(src => {
        console.log(`• [${src.type}] ${src.name}`);
        if (src.url) console.log(`  URL: ${src.url}`);
        console.log(`  Método: ${src.method}`);
    });

    console.log('\n=================================================');
}

runDemo();
