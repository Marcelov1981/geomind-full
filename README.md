# GeoMind — Plataforma de Avaliação Imobiliária

O GeoMind organiza o processo de avaliação imobiliária do cadastro ao laudo, com padronização, rastreabilidade, validações de integridade, inteligência geográfica e apoio de IA. Esta versão contém frontend React, API Express, persistência local em SQLite nativo do Node e suporte a PostgreSQL por `DATABASE_URL`.

## O que está implementado

O fluxo funcional inclui cadastro e login com sessão HTTP-only, isolamento por organização, clientes, projetos, orçamentos, avaliações, evidências, laudos, auditoria, dashboard dinâmico e ledger de créditos. O upload de evidências aceita imagens com limite configurável, calcula checksum SHA-256 e mantém os arquivos fora do Git.

A análise de imagem é feita pelo backend com Gemini, saída estruturada em JSON e registro de modelo, versão do prompt, latência e resultado. Sem `GEMINI_API_KEY`, a API retorna um erro controlado e não tenta usar chaves no navegador. O gateway geográfico suporta geocodificação, pontos de interesse e rotas de transporte por Google Maps Platform, sempre registrando fonte e horário de observação.

A estrutura funcional derivada da planilha de referência está documentada em [`docs/LAUDO_BASE.md`](docs/LAUDO_BASE.md). O arquivo XLSM original não é versionado porque contém macro VBA, links externos e pode conter dados reais de imóveis ou clientes.

## Execução local

É necessário usar Node.js 22.13 ou superior, pois a persistência local utiliza `node:sqlite`. Instale e valide o projeto com:

```bash
npm ci
cp .env.example .env
npm run migrate
```

Em terminais separados, inicie a API e o frontend:

```bash
npm run dev:server
npm run dev
```

Acesse `http://localhost:5173`. A API fica em `http://localhost:3001`; o endpoint de saúde é `http://localhost:3001/health`.

Para executar o servidor com o frontend já compilado:

```bash
npm run build
NODE_ENV=production JWT_SECRET='use-um-segredo-real-e-longo' npm start
```

Para subir uma instalação local com PostgreSQL e API em containers:

```bash
docker compose up --build
```

A configuração do `docker-compose.yml` é somente de desenvolvimento. Troque `JWT_SECRET`, senha do banco, origens permitidas, chaves externas e volumes antes de qualquer uso real.

## Configuração segura

Copie `.env.example` para `.env` e preencha apenas o necessário. Nenhuma chave privada deve usar o prefixo `VITE_`, pois esse conteúdo é incorporado ao bundle do navegador. O `.env` é ignorado pelo Git.

| Variável | Uso |
|---|---|
| `JWT_SECRET` | Assinatura das sessões; obrigatório em produção. |
| `DATABASE_URL` | Opcional; omita para SQLite local ou use PostgreSQL em nuvem. |
| `GEOMIND_DATA_DIR` | Diretório do SQLite local. |
| `STORAGE_DIR` | Diretório local das evidências. Em nuvem, deve ser substituído por storage compatível. |
| `MAX_SPREADSHEET_BYTES` | Limite para importação de `.xlsx`/`.xlsm`; o conteúdo é lido em memória e macros não são executadas. |
| `GEMINI_API_KEY` | Chave server-side do Gemini. |
| `GEMINI_MODEL` | Modelo usado na descrição, por padrão `gemini-2.5-flash`. |
| `GOOGLE_MAPS_API_KEY` | Chave server-side para Geocoding, Places e Routes. |
| `LOCAL_GATEWAY_URL` | Serviço opcional para dados geográficos internos ou espelhados. |
| `SYNC_SHARED_SECRET` | Segredo HMAC compartilhado entre gateways; obrigatório em produção quando houver sync. |
| `BACKUP_RETENTION_DAYS` | Retenção usada pela limpeza de snapshots, limitada pelo backend. |
| `BILLING_PROVIDER` | `none` bloqueia recarga; `local` só deve ser usado em desenvolvimento; o provedor real deve ser configurado antes da produção. |
| `ALLOWED_ORIGINS` | Origens permitidas para CORS. |

## API principal

| Método | Endpoint | Finalidade |
|---|---|---|
| `POST` | `/api/v1/usuarios/register` | Criar organização e usuário proprietário. |
| `POST` | `/api/v1/usuarios/login` | Criar sessão. |
| `GET` | `/api/v1/usuarios/perfil` | Consultar usuário autenticado. |
| `PATCH` | `/api/v1/usuarios/perfil` | Atualizar nome e email no servidor. |
| `GET` | `/api/v1/dashboard` | Indicadores reais da organização. |
| `GET/POST/PATCH/DELETE` | `/api/v1/clientes` | CRUD de clientes. |
| `GET/POST/PATCH/DELETE` | `/api/v1/projetos` | CRUD de projetos. |
| `GET/POST/PATCH/DELETE` | `/api/v1/avaliacoes` | CRUD de avaliações. |
| `GET/POST/PATCH/DELETE` | `/api/v1/laudos` | CRUD de laudos. |
| `POST` | `/api/v1/projetos/:id/evidencias` | Upload de imagem de evidência. |
| `POST` | `/api/v1/projetos/:id/importacoes/laudo` | Inspeção sanitizada de XLSX/XLSM; persiste relatório, hash e status. |
| `POST` | `/api/v1/evidencias/:id/analise-ia` | Descrição estruturada via Gemini, com retry e `Idempotency-Key` opcional. |
| `GET/PATCH` | `/api/v1/evidencias/:id/analises-ia` | Listar e revisar análises: aprovar, editar ou rejeitar. |
| `POST` | `/api/v1/projetos/:id/geografia` | Contexto de pontos de interesse. |
| `POST` | `/api/v1/projetos/:id/rotas` | Rota, incluindo transporte público. |
| `GET/POST` | `/api/v1/billing/*` | Saldo, consumo, recarga e meios tokenizados. |
| `GET` | `/api/v1/auditoria` | Histórico de ações para administradores. |
| `GET/POST/DELETE` | `/api/v1/backup` | Snapshots comprimidos por organização; download, restauração confirmada e retenção. |
| `POST` | `/sync/events` | Receptor de gateway com HMAC e idempotência por evento. |
| `GET` | `/metrics` | Métricas HTTP em formato Prometheus; proteja com `METRICS_TOKEN` em produção. |

## Banco local, nuvem e operação híbrida

A execução sem `DATABASE_URL` usa SQLite local e é adequada para piloto, desenvolvimento e instalações controladas. Para uma operação cloud, use PostgreSQL e um storage de objetos; o backend mantém a mesma interface de domínio e as migrações são reaproveitadas. O frontend nunca acessa o banco diretamente.

Para ambientes com dados sensíveis ou conectividade intermitente, a recomendação é manter o banco local atrás de um gateway interno e sincronizar somente entidades autorizadas com o ambiente cloud. A API mantém uma outbox local e um inbox receptor: eventos entram com HMAC, são deduplicados por organização/evento e ficam com status `received` até um worker autorizado aplicar a mudança. A aplicação ainda não executa automaticamente o worker de conflitos; essa etapa deve ser operada com política de resolução, logs e monitoramento próprios.

## Gemini e governança

O endpoint de IA recebe a imagem armazenada pelo GeoMind e retorna campos estruturados: descrição observável, ambiente, elementos visíveis, estado de conservação, pontos de atenção e limites. O prompt proíbe inferências de valor, segurança estrutural, vício construtivo ou conformidade legal. O resultado deve ser revisado pelo responsável técnico antes de compor o laudo.

Consulte a documentação oficial do [Gemini API](https://ai.google.dev/gemini-api/docs) e mantenha a chave apenas no ambiente server-side. Para imagens grandes, avalie a [Files API](https://ai.google.dev/gemini-api/docs/files) e retenção controlada.

## Geografia e inteligência urbana

O gateway usa Google Geocoding para transformar endereço em coordenadas, Places Nearby para escolas, shoppings, supermercados, hospitais, farmácias e transporte e Routes para deslocamentos. Cada execução é registrada com provedor, requisição, resposta, fonte e horário, permitindo auditoria e atualização futura. Transporte independente pode ser integrado por feeds [GTFS](https://gtfs.org/documentation/schedule/reference/) e [GTFS Realtime](https://gtfs.org/documentation/realtime/reference/).

Não use o endpoint público do Nominatim como backend comercial de alto volume; a [política oficial](https://operations.osmfoundation.org/policies/nominatim/) exige limites, identificação e respeito à capacidade do serviço. Para esse cenário, prefira provedor comercial, instância própria ou cache autorizado.

## Billing

O ledger evita saldo no navegador e registra cada recarga ou consumo no servidor. O modo `none` não simula aprovação e retorna erro explícito. O modo `local` existe somente para testes controlados. Antes de cobrar clientes reais, é necessário escolher um provedor, implementar criação de checkout, verificar assinatura do webhook, reconciliar eventos idempotentes e configurar política de estorno, conciliação e suporte.

Cartões não são armazenados pelo GeoMind. A API aceita somente token de provedor, marca e últimos quatro dígitos, e nunca devolve o token persistido.

## Validação

```bash
npm run lint
NODE_ENV=test VITEST=true DATABASE_URL=sqlite::memory: BILLING_PROVIDER=local npm test
npm run build
npm run migrate
```

A suíte cobre autenticação, sessão, isolamento por organização, CRUD de cliente/projeto/avaliação, dashboard real, ledger de créditos e logout. O build produz o frontend; a API é validada por `node:check` durante o desenvolvimento e deve ser executada em CI junto aos testes. O workflow em `.github/workflows/ci.yml` repete lint, testes, build e migração a cada push ou pull request.

## Segurança do repositório

O arquivo `.env` foi removido do índice Git e permanece ignorado. Planilhas `.xlsm` e `.xlsx` também são ignoradas por padrão. A credencial que esteve presente no histórico público deve ser revogada e substituída pelo responsável pelo serviço correspondente; remover o arquivo do commit atual não apaga a exposição histórica.

## Documentação relacionada

- [`docs/REVISAO_TECNICA.md`](docs/REVISAO_TECNICA.md): revisão e correções de desempenho.
- [`docs/LAUDO_BASE.md`](docs/LAUDO_BASE.md): mapeamento sanitizado da planilha-base.
- [`docs/ARQUITETURA_UX_GEO_HIBRIDA.md`](docs/ARQUITETURA_UX_GEO_HIBRIDA.md): UX, banco híbrido e gateway geográfico.
- [`docs/DIAGNOSTICO_PRONTIDAO_PRODUCAO.md`](docs/DIAGNOSTICO_PRONTIDAO_PRODUCAO.md): lacunas e critérios de prontidão.
- [`docs/openapi.yaml`](docs/openapi.yaml): contrato OpenAPI das rotas principais.
- [`docs/OPERACAO_PRODUCAO.md`](docs/OPERACAO_PRODUCAO.md): checklist de secrets, deploy, backups, billing e sync.

## Referências

[1]: https://ai.google.dev/gemini-api/docs "Gemini API"
[2]: https://ai.google.dev/gemini-api/docs/files "Gemini Files API"
[3]: https://developers.google.com/maps/documentation/places/web-service/nearby-search "Google Places Nearby Search"
[4]: https://developers.google.com/maps/documentation/routes/transit-route "Google Routes Transit"
[5]: https://gtfs.org/documentation/schedule/reference/ "GTFS Schedule Reference"
[6]: https://operations.osmfoundation.org/policies/nominatim/ "Nominatim Usage Policy"
