# GeoMind — Diagnóstico de prontidão para produção

**Data da análise:** 27 de agosto de 2026
**Conclusão executiva:** o GeoMind possui um frontend navegável e tecnicamente compilável, mas ainda não é um sistema completamente funcional nem está pronto para produção. O maior bloqueador é a ausência de backend persistente e protegido; em seguida vêm autenticação real, pagamentos, integrações de IA/geografia no servidor, testes automatizados e operação.

> **Resumo:** hoje o produto está mais próximo de um protótipo avançado de frontend do que de uma plataforma SaaS operacional ponta a ponta.

## 1. O que já existe

| Área | Estado atual | Avaliação |
| --- | --- | --- |
| Interface | Dashboard, clientes, projetos, orçamentos, avaliações, laudos, análise de imagens, planos, cartões e configurações. | A navegação e os principais formulários estão visualmente presentes. |
| Frontend | React/Vite com carregamento lazy, correções de hooks, tratamento de erro e divisão de bundle. | `npm run lint` e `npm run build` aprovados na revisão anterior. |
| PDF | Geração local de laudo com jsPDF e inclusão de imagens. | Funciona no navegador, mas ainda precisa de persistência, template versionado e validação ponta a ponta. |
| Referência funcional | Planilha XLSM mapeada em documentação sanitizada. | 24 abas, 3.468 fórmulas, VBA e links externos foram inventariados; o arquivo original foi mantido fora do repositório público. |
| Integração preliminar | Há serviços frontend para CEP, geolocalização, POIs, scraping, IA e relacionamentos. | São pontos de partida, não uma arquitetura de produção. |

## 2. Bloqueadores críticos — prioridade P0

### 2.1 Backend, banco e contratos de dados

Não há diretório de backend, ORM, schema de banco, migrações, rotas servidoras ou serviço de API no projeto auditado. O frontend espera endpoints em `http://localhost:3001` ou em uma URL configurada por ambiente. Sem esse serviço, a lista de laudos, clientes e demais entidades não possui persistência real.

É necessário criar uma API versionada, banco relacional, migrações e contratos de entrada/saída para clientes, projetos, orçamentos, avaliações, evidências, laudos, usuários, configurações, integrações e auditoria. O banco deve suportar tenant/organização, relacionamentos, status, soft delete quando aplicável, timestamps e versionamento do modelo de laudo.

**Correção adicional necessária:** o `.env.example` informa uma base contendo `/api/v1`, enquanto `src/config/api.js` também acrescenta `/api/v1` aos endpoints. O contrato precisa escolher uma única convenção para evitar URLs duplicadas como `/api/v1/api/v1/...`.

### 2.2 Autenticação e autorização reais

A aplicação inicia diretamente no dashboard e a navegação principal é controlada por estado local em `App.jsx`. Há formulário de cadastro e referências a perfil/sessão, mas não há fluxo completo de login, renovação de sessão, proteção de rotas ou autorização garantida no servidor.

É necessário implementar login, logout, expiração e renovação de sessão, recuperação de senha, verificação de e-mail, primeiro acesso, MFA opcional, controle de papéis e autorização por organização/projeto. O servidor deve repetir todas as verificações; esconder um botão no frontend não é controle de acesso.

### 2.3 Retirar segredos e chamadas sensíveis do navegador

Ainda existem caminhos frontend para chamar diretamente serviços externos. A integração Gemini usa `VITE_GEMINI_API_KEY` e a biblioteca legada `@google/generative-ai`; o `CustomAIService` também constrói chamadas diretas a APIs de IA. Chaves e tokens configurados com prefixo `VITE_` podem ser expostos ao bundle do navegador, e `ApiKeyStore`/outros módulos usam `localStorage`.

A correção é centralizar Gemini, mapas, POIs, geocodificação e scraping em um backend ou Local Gateway. As chaves devem permanecer no servidor, com rotação, menor privilégio, limites por organização e logs sem segredos. O Gemini deve migrar para o SDK recomendado `@google/genai`, usar JSON Schema, validação no backend e revisão humana antes de inserir conteúdo em laudo.

### 2.4 Pagamentos não são reais

`PaymentSystem.js` persiste transações em `localStorage` e simula aprovação com `Math.random()`. Isso não pode ser usado para cobrar, conceder créditos ou liberar planos. É necessário escolher um gateway de pagamentos, criar customer/subscription/payment intent no servidor, tratar webhooks idempotentes, conciliação, estorno, falha, antifraude, recibos e status de assinatura.

Dados de cartão não devem ser persistidos no navegador pelo GeoMind. O frontend deve usar tokenização/checkout hospedado do provedor e o servidor deve ser a fonte de verdade para planos, créditos, limites e permissões.

## 3. Lacunas funcionais importantes — prioridade P1

| Lacuna | Evidência no projeto | O que precisa ser feito |
| --- | --- | --- |
| Dashboard | Os cartões exibem valores fixos como 124 clientes, 43 projetos, 28 orçamentos, 15 avaliações e 17 laudos. | Criar endpoint de indicadores com filtros por organização, período e permissões; mostrar carregamento, vazio, erro e timestamp. |
| CRUD ponta a ponta | Existem componentes e chamadas a endpoints, mas não há servidor nem banco no repositório. | Implementar criação, leitura, edição, exclusão/arquivamento, validação, paginação, busca, filtros e tratamento de concorrência. |
| Laudo | O modal cria o registro e o PDF é gerado localmente, mas a lista exibiu erro quando a API não estava disponível. | Persistir laudo, template, versão da base, evidências, assinatura/revisão, histórico, download autorizado e reprocessamento. |
| Planilha XLSM | A documentação mapeia a base, mas não há importador no frontend. | Criar importação segura no backend/worker: leitura limitada às linhas ocupadas, validação de fórmulas, isolamento, ausência de execução de macros e relatório de erros. |
| Avaliação imobiliária | Há telas, mas não há motor persistente para amostras, fatores, homogeneização, liquidez e riscos. | Transformar a base em entidades e serviços de cálculo versionados, com premissas e resultados intermediários auditáveis. |
| Imagens | Upload e análise preliminar existem, mas não há pipeline de storage, fila, limite, deduplicação e revisão persistente. | Criar evidência versionada, thumbnails, antivírus, metadados, fila, status e vínculo entre observação e imagem. |
| Georreferenciamento | CEP, Mapbox e Overpass são chamados a partir de serviços frontend; não há gateway, cache ou catálogo de fontes. | Criar Geo Intelligence Gateway com adaptadores, limites, cache, atribuição, timestamp e fallback. |
| POIs e transporte | Não há integração consolidada de escolas, shoppings, supermercados, linhas, estações e horários com validade. | Integrar Places/Geocoding/Routes ou alternativas, GTFS Schedule/Realtime e dados oficiais regionais; separar distância, rota e contexto. |
| Imóveis comparáveis | `PropertyScrapingService` retorna dados mock para portais como ZAP, Viva Real, ImovelWeb e OLX. | Substituir mocks por fontes autorizadas, APIs/licenças ou ingestão de dados permitida; registrar fonte e data. |
| Backup e restauração | Há endpoints declarados no frontend, mas não serviço de backup no projeto. | Implementar backup criptografado, retenção, restauração testada, logs e permissão administrativa. |
| Configurações e logo | Parte das configurações está em `localStorage` e parte aponta para API. | Definir fonte de verdade no servidor, storage de arquivos, escopo por organização e versionamento. |

## 4. Qualidade, segurança e operação — prioridade P1/P2

O projeto não possui script `test`, configuração de Vitest/Jest, Playwright/Cypress, pipeline de CI/CD, monitoramento, tracing, alertas ou ambiente de staging identificado. Os arquivos `test-*.js`, `teste-*.js` e HTML são testes manuais/ad hoc e não formam uma suíte de regressão automatizada.

Antes de liberar produção, é necessário adicionar testes unitários de serviços e validações, testes de integração da API com banco de teste, testes E2E do fluxo cadastro → projeto → orçamento → avaliação → evidências → laudo, testes de autorização por papel e testes de carga dos endpoints críticos. O pipeline deve executar lint, build, testes, auditoria de dependências e verificação de segredos em cada pull request.

Também faltam políticas e controles operacionais: gestão de segredos, CORS/CSRF, rate limiting, validação de upload, antivírus, criptografia em trânsito e repouso, trilha de auditoria, retenção e exclusão, segregação de tenant, plano de incidentes, RPO/RTO, logs estruturados e observabilidade por provedor.

A plataforma deve definir com o responsável jurídico e de segurança como tratar dados pessoais e evidências de clientes, especialmente em integrações externas e no uso de IA. O laudo deve deixar clara a origem dos dados, a data de consulta, a versão do modelo e a revisão humana.

## 5. Arquitetura mínima recomendada

```text
Frontend React/PWA
        │ HTTPS + sessão
        ▼
API GeoMind / BFF
        ├── Auth + RBAC + organizações
        ├── Clientes / Projetos / Avaliações / Laudos
        ├── Geo Intelligence Gateway
        ├── AI Orchestrator (Gemini)
        ├── Billing + Webhooks
        ├── Audit Log + Observability
        └── Queue / Workers
                ├── Banco relacional
                ├── Object Storage de evidências
                ├── Cache
                └── Adaptadores cloud ou Local Gateway
```

O mesmo contrato deve funcionar em nuvem e local. No modo local, um gateway instalado na rede do cliente acessa o banco permitido e sincroniza apenas o que a política autorizar. O frontend não deve conhecer credenciais nem detalhes do banco.

## 6. Roadmap de conclusão

| Ordem | Entrega | Definição de pronto |
| --- | --- | --- |
| 1 | Fundação de backend e dados | API versionada, banco, migrações, autenticação, RBAC, contratos e ambiente de staging. |
| 2 | Fluxo principal persistente | Cliente → projeto → orçamento → avaliação → evidência → laudo, com CRUD, validação e auditoria. |
| 3 | Segurança e operação | Segredos no servidor, uploads protegidos, backup, logs, monitoramento, CI/CD e testes automatizados. |
| 4 | Geo Intelligence Gateway | Geocodificação, POIs, rotas, transporte, cache, fontes, timestamps e fallback. |
| 5 | Gemini produtivo | `@google/genai` no backend, JSON Schema, fila, retry idempotente, custo, revisão humana e histórico. |
| 6 | Comercial e escala | Pagamento real, planos, limites, webhooks, multi-tenant, gateway local e sincronização híbrida. |

## 7. Ordem de investimento recomendada

A ordem correta não é começar pela IA. Primeiro deve existir uma fonte de verdade para usuários, imóveis, evidências e laudos. Depois, integrações geográficas devem produzir fatos reproduzíveis. Só então o Gemini deve redigir, resumir e classificar com base nesses fatos. Pagamentos e permissões devem ser implementados antes de vender o serviço, e observabilidade deve existir antes de ampliar o número de clientes.

O **MVP funcional** do GeoMind pode ser considerado pronto quando um usuário autenticado consegue criar um projeto, anexar evidências, executar uma avaliação, gerar e recuperar um laudo persistido, consultar fontes geográficas com timestamp, revisar uma descrição de IA, e repetir todo o processo após recarregar o navegador ou acessar de outro dispositivo.

## Referências técnicas

[1]: https://ai.google.dev/gemini-api/docs/libraries "Bibliotecas da API Gemini"

[2]: https://ai.google.dev/gemini-api/docs/generate-content/structured-output "Gemini API — Structured outputs"

[3]: https://developers.google.com/maps/documentation/places/web-service/nearby-search "Google Places — Nearby Search"

[4]: https://developers.google.com/maps/documentation/routes/transit-route "Google Routes — Transporte público"

[5]: https://gtfs.org/documentation/schedule/reference/ "GTFS Schedule Reference"

[6]: https://operations.osmfoundation.org/policies/nominatim/ "Nominatim Usage Policy"
