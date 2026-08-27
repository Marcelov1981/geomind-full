# GeoMind — Arquitetura de UX, dados híbridos e inteligência geográfica

**Status:** proposta de arquitetura para validação executiva e técnica
**Data:** 27 de agosto de 2026

## 1. Visão consolidada

O GeoMind deve ser uma plataforma de avaliação imobiliária **extremamente intuitiva**, capaz de operar com dados em nuvem ou em instalações locais e de enriquecer cada imóvel com contexto geográfico verificável. A experiência deve esconder a complexidade técnica: o avaliador informa ou confirma o endereço, escolhe o objetivo da análise e recebe um resumo claro, com mapa, distâncias, tempos de deslocamento, pontos de interesse, fonte dos dados e data de atualização.

A regra estrutural é separar **fato**, **cálculo** e **interpretação**. O sistema coleta fatos de provedores geográficos e bases públicas; calcula distância, tempo, densidade e indicadores transparentes; e somente depois pode usar o Gemini para redigir um resumo. A IA não deve inventar benefícios ou dificuldades do local nem transformar uma correlação em conclusão técnica.

> **Princípio do produto:** o GeoMind deve responder “o que existe, a que distância, com qual tempo de acesso e segundo qual fonte”, deixando claro o que é observação objetiva, o que é cálculo e o que exige julgamento profissional.

## 2. UX extremamente intuitiva

A interface deve ser orientada por tarefa, não por cadastro técnico. O usuário deve conseguir iniciar uma avaliação em poucos passos, visualizar o progresso e retornar ao ponto em que parou sem perder dados.

| Diretriz | Comportamento esperado no produto |
| --- | --- |
| Entrada única | Um campo de endereço ou coordenadas inicia a resolução geográfica, sugere o imóvel e permite confirmar o ponto no mapa. |
| Progressive disclosure | Exibir primeiro o essencial; revelar fatores avançados, fontes, filtros e parâmetros somente quando solicitados. |
| Assistente de avaliação | Conduzir em etapas: imóvel, finalidade, evidências, contexto do local, análise e laudo. |
| Linguagem humana | Usar “tempo até a escola mais próxima” em vez de expor nomes técnicos de endpoints. |
| Estados claros | Mostrar carregando, atualizado, parcialmente disponível, desatualizado, bloqueado e erro recuperável. |
| Revisão antes de publicar | Toda descrição de IA e todo resumo geográfico devem possuir ações aceitar, editar, rejeitar e ver fonte. |
| Repetibilidade | Permitir salvar uma configuração de análise, como raio, modo de transporte, categorias e data de referência. |
| Mobile e acessibilidade | Alvos de toque amplos, contraste adequado, teclado, textos legíveis e formulários curtos; o mapa nunca deve ser a única forma de comunicar um resultado. |
| Modo local | Indicar claramente quando a operação está conectada ao servidor local, à nuvem ou em modo sem sincronização. |

### Jornada principal recomendada

1. O avaliador cria o projeto e informa o endereço.
2. O GeoMind resolve o endereço e solicita confirmação do ponto no mapa.
3. O usuário escolhe as categorias de interesse, como escolas, shoppings, transporte, supermercados, saúde e serviços.
4. O sistema apresenta fatos, distâncias e tempos com fonte e data.
5. O Gemini transforma somente esses fatos em uma descrição executiva editável.
6. O avaliador revisa e decide quais achados entram na avaliação e no laudo.

## 3. Banco de dados em nuvem e local

O navegador **não deve acessar diretamente** bancos de dados locais ou em nuvem. A conexão deve ocorrer por uma API do GeoMind, com autenticação, autorização, auditoria e uma camada de adaptadores. Assim, a interface permanece igual quando o armazenamento muda.

### Arquitetura lógica

```text
                 ┌──────────────────────────┐
                 │ Frontend GeoMind          │
                 │ Web / PWA / Mobile       │
                 └────────────┬─────────────┘
                              │ HTTPS / sessão
                 ┌────────────▼─────────────┐
                 │ API GeoMind               │
                 │ domínio + autorização    │
                 └───────┬─────────┬─────────┘
                         │         │
             ┌───────────▼───┐ ┌──▼────────────────┐
             │ Cloud Adapter  │ │ Local Gateway     │
             │ PostgreSQL /   │ │ serviço instalado │
             │ MySQL / TiDB   │ │ na rede do cliente│
             └───────────┬───┘ └──┬─────────────────┘
                         │         │
                    ┌────▼─────────▼────┐
                    │ Banco operacional │
                    │ cloud ou local    │
                    └───────────────────┘
```

### Estratégia de conectividade

| Cenário | Desenho recomendado | Observação |
| --- | --- | --- |
| Nuvem gerenciada | API GeoMind + banco relacional gerenciado, storage de evidências e fila de tarefas. | Melhor para equipes distribuídas, atualizações centralizadas e escala. |
| Instalação local | API e Local Gateway na rede do cliente, conectados ao banco local. | Adequado quando os dados não podem sair da rede ou há dependência de sistemas internos. |
| Híbrido | Dados operacionais locais, catálogo e indicadores anonimizados sincronizados com a nuvem. | Exige política clara para decidir quais entidades podem sincronizar. |
| Intermitente/offline | Outbox local, fila de sincronização e identificadores idempotentes. | A interface informa pendências; conflitos nunca são resolvidos silenciosamente. |

### Contratos necessários

A camada de dados deve depender de interfaces, não de um banco específico. Cada adaptador deve implementar operações de clientes, projetos, avaliações, evidências, laudos, fontes geográficas e sincronização. Migrações devem ser versionadas; cada registro deve possuir `tenant_id`, `created_at`, `updated_at`, `source_system` e `version`.

Para sincronização, recomenda-se o padrão **outbox/inbox**: uma transação local grava a alteração e um evento; o sincronizador entrega o evento, registra confirmação e repete com segurança quando necessário. Conflitos devem ser explícitos, com histórico e revisão do usuário.

## 4. Camada de APIs geográficas e inteligência urbana

O GeoMind deve adotar uma **Geo Intelligence Gateway** com adaptadores de provedor. O domínio do produto chama capacidades estáveis, como `geocode`, `searchNearby`, `routeMatrix`, `transitRoute` e `hazardContext`; o provedor pode ser trocado sem mudar a interface do avaliador.

### Capacidades e fontes

| Capacidade | Fonte primária sugerida | Alternativas / observações |
| --- | --- | --- |
| Geocodificação direta e reversa | Google Geocoding ou Mapbox Geocoding. | Nominatim próprio ou provedor comercial alternativo para reduzir dependência. Mapbox documenta endpoints de geocodificação direta, reversa e em lote [6]. |
| Escolas, shoppings, supermercados e serviços | Google Places Nearby Search. | A busca trabalha com tipos, área circular e máscara de campos; a máscara deve solicitar somente os campos necessários [1]. |
| Distância e tempo por carro, a pé ou bicicleta | Google Routes ou Mapbox Matrix. | A Matrix API retorna tempos e distâncias entre vários pontos, útil para análises de acessibilidade em lote [7]. |
| Ônibus, metrô e trem | Google Routes `TRANSIT` para rotas e tempos atuais. | GTFS Schedule e GTFS Realtime permitem uma base própria de paradas, linhas, horários, alertas e posições [3] [4]. |
| Dados abertos de POIs | OpenStreetMap via instância própria, extrato ou provedor compatível. | O endpoint público do Nominatim é limitado e não deve ser usado para consultas pesadas, periódicas ou sistemáticas [5]. |
| Riscos e ambiente | Bases oficiais municipais/estaduais, defesa civil, clima, relevo e hidrologia, conforme disponibilidade regional. | Cada indicador deve guardar fonte, versão, data e nível de cobertura; não apresentar ausência de dado como ausência de risco. |

### Modelo de consulta geográfica

Cada análise deve gerar um `geo_run` com:

- imóvel, latitude, longitude, raio, idioma, data/hora e finalidade;
- provedor, endpoint, parâmetros e máscara de campos;
- resultados normalizados por categoria;
- distância geométrica e distância/tempo por rota, quando disponível;
- data de atualização, idade do dado e validade operacional;
- licença, atribuição e link de origem quando aplicável;
- status `complete`, `partial`, `stale`, `blocked` ou `failed`.

O sistema deve distinguir claramente **proximidade** de **acessibilidade**. Uma escola a 800 metros em linha reta pode exigir uma rota muito maior; portanto, a tela e o laudo não devem misturar esses indicadores.

## 5. Benefícios e dificuldades dos locais pesquisados

O GeoMind deve calcular primeiro e escrever depois. Para cada categoria, a aplicação pode produzir fatos como:

| Categoria | Benefícios observáveis | Dificuldades ou ressalvas |
| --- | --- | --- |
| Escolas | Quantidade no raio, menor distância, tempo estimado e faixa de horário se disponível. | Horários variáveis, capacidade não conhecida, qualidade pedagógica não inferível apenas pela localização. |
| Shoppings e comércio | Oferta de serviços, distância e tempo de acesso. | Horário, trânsito, sazonalidade e ausência de dados de uma região podem alterar a leitura. |
| Ônibus e metrô | Paradas/estações, linhas, frequência ou próxima partida quando fornecida, tempo de acesso. | Dados podem estar desatualizados; o GTFS Realtime só existe quando a agência publica o feed. |
| Supermercados e serviços | Número de opções, distância, tempo e horário de funcionamento quando disponível. | Cadastro de estabelecimentos pode estar incompleto ou conter duplicidades. |
| Risco e ambiente | Indicadores oficiais de alagamento, declividade, ruído ou clima, quando disponíveis. | A ausência de um registro não comprova ausência de risco; conclusões técnicas exigem validação profissional. |

O Gemini recebe essa matriz de fatos, não uma instrução genérica para “avaliar o bairro”. A saída deve usar linguagem condicional quando os dados forem incompletos, mencionar a data de consulta e apontar as fontes. A descrição deve ser editável e não deve ser incorporada automaticamente ao laudo.

## 6. Integração com Gemini

A integração deve usar o SDK oficial recomendado pelo Google no backend. A documentação atual identifica `@google/generative-ai` como biblioteca legada e recomenda `@google/genai` [8].

### Endpoint interno proposto

```http
POST /api/v1/properties/{propertyId}/geo-context
```

O endpoint recebe categorias, raio, modos de transporte e política de atualização. O backend executa as consultas, normaliza os resultados, valida a completude e chama o Gemini com:

1. imagem, se houver uma tarefa visual;
2. contexto do imóvel estritamente necessário;
3. fatos geográficos normalizados;
4. prompt versionado;
5. JSON Schema de saída.

O Gemini deve retornar uma estrutura semelhante a:

```json
{
  "resumo": "texto editável e factual",
  "pontos_positivos": [
    { "texto": "...", "evidencias": ["poi_123"], "fonte": "..." }
  ],
  "pontos_atencao": [
    { "texto": "...", "evidencias": ["route_456"], "fonte": "..." }
  ],
  "limites": ["..."],
  "status_revisao": "pendente",
  "prompt_version": "geo-context-v1"
}
```

A documentação do Gemini recomenda saídas aderentes a JSON Schema para obter resultados previsíveis [2]. Também recomenda controlar entrada de imagem e usar Files API para arquivos maiores ou reutilizados; a aplicação deve apagar referências temporárias conforme a política definida [1] [9]. Filtros e feedback de segurança devem ser tratados explicitamente [4].

## 7. Segurança, governança e observabilidade

As credenciais de mapas, banco e Gemini devem ficar no servidor ou no Local Gateway, nunca no frontend. O produto deve aplicar menor privilégio, rotação de segredos, logs sem dados pessoais desnecessários e segregação por cliente/tenant.

A tabela de auditoria deve registrar quem solicitou a análise, quais fontes foram consultadas, quais respostas foram recebidas, qual modelo e prompt foram usados, quem editou o texto e qual versão entrou no laudo. Em ambiente local, o gateway deve expor somente endpoints autenticados e não abrir o banco diretamente para a internet.

O painel operacional deve acompanhar latência por provedor, taxa de erro, cache hit, idade dos dados, custo por análise, taxa de edição humana, taxa de rejeição, divergência entre provedores e falhas de sincronização.

## 8. Roadmap recomendado

| Fase | Entrega | Critério de sucesso |
| --- | --- | --- |
| 0 — Fundação | Design system, jornada do avaliador, contratos de dados, catálogo de fontes e política de retenção. | Fluxo validado com usuários e schema aprovado. |
| 1 — Contexto básico | Geocodificação, POIs, distância em linha reta, cache e mapa acessível. | Endereço resolvido, fonte exibida e resultado reproduzível. |
| 2 — Acessibilidade | Rotas a pé/carro e transporte público; ingestão GTFS onde houver feed. | Tempo/distância com timestamp e fallback quando o feed não existir. |
| 3 — IA assistida | Gemini no backend, JSON Schema, revisão humana e integração com o laudo. | Descrição editável, vinculada às evidências e sem conclusões não sustentadas. |
| 4 — Operação híbrida | Local Gateway, sincronização outbox/inbox, conflitos e observabilidade. | Nuvem e instalação local usando a mesma experiência e contratos. |
| 5 — Escala | Multi-provedor, custos, SLA, políticas de atualização e expansão de indicadores. | Troca de provedor sem reescrever o produto e métricas operacionais publicadas. |

## 9. Decisões que precisam ser tomadas

| Decisão | Recomendação inicial |
| --- | --- |
| Provedor geográfico inicial | Google Maps Platform para MVP pela cobertura integrada de Places, Geocoding e Routes; manter adaptadores para Mapbox e dados abertos. |
| Transporte público | Google Routes para acessibilidade imediata e GTFS como camada local/versionada quando o operador disponibilizar feed. |
| Banco local | Local Gateway com PostgreSQL ou MySQL existente do cliente; o frontend nunca acessa o banco diretamente. |
| IA | `@google/genai` no backend, JSON Schema, prompt versionado, revisão humana e logs de evidência. |
| Indicadores de bairro | Fatos normalizados, métricas transparentes e linguagem condicional; nenhum score opaco no primeiro piloto. |
| Publicação no laudo | Somente conteúdo aceito ou editado pelo responsável técnico. |

## Referências

[1]: https://developers.google.com/maps/documentation/places/web-service/nearby-search "Google Places — Nearby Search (novo)"

[2]: https://ai.google.dev/gemini-api/docs/generate-content/structured-output "Google Gemini API — Structured outputs"

[3]: https://developers.google.com/maps/documentation/routes/transit-route "Google Routes API — Rota de transporte público"

[4]: https://gtfs.org/documentation/realtime/reference/ "GTFS Realtime Reference"

[5]: https://operations.osmfoundation.org/policies/nominatim/ "Nominatim Usage Policy"

[6]: https://docs.mapbox.com/api/search/geocoding/ "Mapbox Geocoding API"

[7]: https://docs.mapbox.com/api/navigation/matrix/ "Mapbox Matrix API"

[8]: https://ai.google.dev/gemini-api/docs/libraries "Google Gemini API — Bibliotecas"

[9]: https://ai.google.dev/gemini-api/docs/files "Google Gemini API — Files API"
