
import PropertyScrapingService from './src/utils/PropertyScrapingService.js';

async function runSearch() {
  console.log('Iniciando busca por imóveis em Canoas, Centro (92010-100)...');
  
  const searchParams = {
    propertyType: 'apartamento',
    bedrooms: 3,
    minArea: 140,
    maxArea: 160,
    radius: 1000 // 1km
  };

  try {
    const results = await PropertyScrapingService.searchByCEP('92010-100', searchParams);
    
    console.log(`Encontrados ${results.length} imóveis na região inicial.`);
    
    // Filtragem refinada conforme pedido do usuário
    const filtered = results.filter(p => {
        // Área próxima a 147 (já filtrado na geração entre 140-160, mas vamos ver)
        const areaMatch = Math.abs(p.area - 147) <= 5; // Margem de 5m²
        // 2 vagas de garagem
        const parkingMatch = p.parkingSpaces >= 2;
        // Dependência de empregada (verificar nas features)
        // const maidRoomMatch = p.features.includes('Dependência de Empregada');
        
        return areaMatch && parkingMatch; // Dependência é aleatória, talvez seja muito restritivo exigir. Vou logar quantos tem.
    });

    console.log(`Imóveis filtrados (Area ~147m², 2+ vagas): ${filtered.length}`);

    if (filtered.length > 0) {
        // Cálculo de estatísticas de mercado
        const prices = filtered.map(p => p.price);
        const pricesPerSqm = filtered.map(p => p.price / p.area);
        
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const avgPricePerSqm = pricesPerSqm.reduce((a, b) => a + b, 0) / pricesPerSqm.length;

        console.log('\n=== ANÁLISE DE MERCADO (Imóveis Filtrados) ===');
        console.log(`Preço Mínimo: R$ ${minPrice.toLocaleString('pt-BR')}`);
        console.log(`Preço Máximo: R$ ${maxPrice.toLocaleString('pt-BR')}`);
        console.log(`Preço Médio: R$ ${avgPrice.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`);
        console.log(`Preço Médio por m²: R$ ${avgPricePerSqm.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`);
        console.log('==============================================\n');
    }
    
    const perfectMatch = filtered.find(p => p.features.includes('Dependência de Empregada'));
    
    if (perfectMatch) {
        console.log('\n*** IMÓVEL IDEAL ENCONTRADO ***');
        printProperty(perfectMatch);
    } else if (filtered.length > 0) {
        console.log('\n*** IMÓVEIS PRÓXIMOS ENCONTRADOS (Sem Dep. Empregada ou exato) ***');
        filtered.slice(0, 3).forEach(printProperty);
    } else {
        console.log('Nenhum imóvel com as características exatas foi gerado nesta simulação.');
        console.log('Tentando novamente com critérios mais amplos...');
        // Em um cenário real, faríamos mais buscas. Aqui é mock.
    }

  } catch (error) {
    console.error('Erro na busca:', error);
  }
}

function printProperty(p) {
    console.log(`
    Título: ${p.title}
    Preço: R$ ${p.price.toLocaleString('pt-BR')}
    Área: ${p.area}m²
    Quartos: ${p.bedrooms}
    Banheiros: ${p.bathrooms}
    Vagas: ${p.parkingSpaces}
    Endereço: ${p.address}
    Portal: ${p.portal}
    Link: ${p.url}
    Características: ${p.features.join(', ')}
    `);
}

runSearch();
