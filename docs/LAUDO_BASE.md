# Base de laudo do GeoMind

## Objetivo

O GeoMind transforma a avaliação imobiliária em um fluxo padronizado, rastreável e escalável, desde o cadastro de cliente e projeto até a geração do laudo. A planilha XLSM fornecida foi tratada como referência funcional e estrutural para os módulos de orçamento, avaliação, evidências, homogeneização e entrega do relatório.

O arquivo original **não é versionado** neste repositório porque contém macro VBA, links externos e pode conter dados reais de imóveis ou clientes. A integração deve utilizar dados persistidos no backend e gerar uma cópia de trabalho controlada, preservando a rastreabilidade da versão do modelo.

## Inventário sanitizado da referência

A base possui 24 abas, 3.468 fórmulas, macro VBA e cinco relacionamentos de links externos. A aba `amostra` possui a dimensão máxima registrada de 1.048.575 linhas por 63 colunas; por isso, qualquer importação deve ler somente as linhas ocupadas e validar limites antes de montar objetos em memória.

| Grupo funcional | Abas identificadas | Papel no fluxo |
| --- | --- | --- |
| Entradas do imóvel e do cliente | `IMÓVEL`, `matriculas`, `Observações complementares`, `ag sicredi` | Dados cadastrais, matrícula, finalidade, observações e informações institucionais. |
| Amostras e mercado | `elementosamostrais`, `amostra`, `vendaforçada` | Evidências de mercado, amostras comparáveis e cenários de venda forçada. |
| Localização e transposição | `distanciapolo`, `distância centro`, `fator Transposição Dist.Centro`, `fator Transposição PGV` | Distâncias, polos de influência e fatores de transposição. |
| Tratamento estatístico | `Homogeneização`, `I - KD`, `II - Padrão (IBAPE)`, `III - Andar`, `IV - Distribuição t`, `V - Oferta e Expoentes`, `Liquidez`, `risco climáticos` | Homogeneização, fatores, distribuição estatística, liquidez e risco climático. |
| Entregáveis | `Laudo - Amostra`, `Laudo - Homogeneização` | Estrutura final dos relatórios e resultados calculados. |
| Apoio | `Plan1`, `Planilha1` | Áreas auxiliares e parâmetros de apoio do modelo. |

## Mapeamento para os módulos do sistema

| Módulo GeoMind | Origem funcional na base | Resultado esperado |
| --- | --- | --- |
| Clientes | Identificação do contratante e partes relacionadas | Cadastro normalizado, com histórico e validação de campos obrigatórios. |
| Projetos | `IMÓVEL`, matrícula, endereço e finalidade | Projeto com imóvel, localização, finalidade, área e vínculo com cliente. |
| Orçamentos | Tipo de avaliação, prazo, metodologia e observações | Orçamento versionado, associado ao projeto e pronto para aprovação. |
| Avaliações | Amostras, fatores, critérios e observações técnicas | Avaliação auditável com evidências, premissas e resultados intermediários. |
| Integridade | Fórmulas, campos obrigatórios e consistência entre abas | Relatório de qualidade que aponta ausência, divergência ou dado desatualizado. |
| Laudos | `Laudo - Amostra` e `Laudo - Homogeneização` | Entregável final com rastreabilidade das evidências e da versão do modelo. |
| Análise de imagens | Evidências fotográficas e observações | Apoio de IA para descrição e revisão, sem substituir a responsabilidade técnica. |

## Regras de implementação recomendadas

A importação da base deve ser explicitamente versionada. Cada laudo deve registrar o identificador do modelo utilizado, a data de geração, os dados de entrada, as evidências anexadas, os parâmetros calculados e a pessoa responsável pela revisão. A saída não deve depender de links externos ativos no momento da consulta; quando uma fonte externa for necessária, o sistema deve registrar a origem, a data de coleta e o conteúdo utilizado.

Os campos de entrada devem ser validados antes dos cálculos. Identificadores podem chegar como número ou texto, portanto o frontend e o backend devem normalizar comparações de relacionamento. Valores monetários e áreas devem utilizar representação numérica interna e formatação somente na camada de apresentação. Fórmulas e resultados derivados devem ser recalculados em uma camada controlada, em vez de confiar cegamente em valores cacheados de uma planilha.

A planilha de referência contém macro VBA e links externos. Por segurança, o GeoMind deve tratar o arquivo como fonte de configuração e referência, nunca como código executável do navegador. Qualquer processamento de XLSM deve ocorrer em ambiente isolado, com validação de tipo, tamanho, fórmulas e conteúdo; macros não devem ser executadas automaticamente.

## Estado da implementação atual

O frontend já possui os módulos de clientes, projetos, orçamentos, avaliações, laudos, análise de imagens e relatório de integridade. Esta revisão melhora o carregamento sob demanda dos módulos, a montagem das relações entre entidades e o tratamento seguro de configuração. A documentação acima serve como contrato funcional para a próxima etapa de integração da base de laudo com os endpoints persistentes.
