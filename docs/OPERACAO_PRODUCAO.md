# GeoMind — operação e prontidão de produção

## Estado entregue

O repositório contém uma API Express com sessão por cookie HttpOnly, isolamento por `organization_id`, persistência SQLite local ou PostgreSQL via `DATABASE_URL`, upload de evidências com checksum, descrição de imagens por Gemini server-side, contexto geográfico com Google Maps Platform, ledger de créditos, métodos de pagamento tokenizados, backups comprimidos, outbox/inbox de sincronização, métricas HTTP e workflow de CI.

A aplicação **não deve ser anunciada como cobrança real, gateway de pagamentos completo ou sincronização automática de conflitos** até que as credenciais, o provedor e os processos abaixo sejam configurados e testados.

## Configuração obrigatória

| Item | Desenvolvimento | Produção |
|---|---|---|
| `JWT_SECRET` | Valor local temporário | Segredo longo, aleatório, armazenado no secret manager e rotacionável |
| Banco | SQLite nativo do Node | PostgreSQL gerenciado com backup e pool dimensionado |
| Storage | Diretório `storage/` | Bucket privado, criptografia, URL assinada e política de retenção |
| Gemini | Opcional; endpoint retorna `503` sem chave | `GEMINI_API_KEY` somente server-side, quotas e monitoramento |
| Google Maps | Opcional; endpoints retornam `503` sem chave | `GOOGLE_MAPS_API_KEY` restrita por API, projeto e quotas |
| Billing | `local` apenas para testes | Provedor escolhido, checkout/tokenização e webhook verificado |
| Sync | Gateway local opcional | `SYNC_SHARED_SECRET` obrigatório, rede privada e allowlist |
| Métricas | Endpoint local | `METRICS_TOKEN` ou rede privada antes de coletar externamente |

## Checklist antes do primeiro cliente

A equipe deve criar os secrets no ambiente de hospedagem, configurar `ALLOWED_ORIGINS` com a URL exata do frontend, migrar para PostgreSQL, configurar storage de objetos e validar restauração de um backup em ambiente isolado. As chaves antigas que apareceram no histórico público devem ser revogadas pelo responsável no provedor; removê-las dos arquivos atuais não desfaz a exposição histórica.

Também é necessário configurar limites e alertas de custo para Gemini e Maps, habilitar TLS no proxy, restringir o endpoint `/metrics`, revisar logs para não registrar tokens ou payloads de imagem, ativar retenção e exclusão de dados conforme a política da organização e executar uma avaliação de segurança independente antes de tratar os laudos como documentos regulados.

## Billing real

O ledger de créditos está preparado para receber eventos idempotentes, mas a integração financeira permanece deliberadamente incompleta sem um provedor e credenciais reais. Para ativá-la, implementar o checkout hospedado pelo provedor escolhido, receber apenas tokens, validar a assinatura de cada webhook com `BILLING_WEBHOOK_SECRET`, persistir o evento antes do processamento, tratar aprovação, falha, estorno e conciliação e testar duplicidade e replay. O modo `local` não deve ser habilitado em `NODE_ENV=production`.

## Sincronização híbrida

A outbox registra mutações no cloud e o receptor `/sync/events` autentica lotes por HMAC e deduplica eventos por organização e `event_id`. O inbox mantém os eventos em `received`; ainda é necessário um worker de aplicação com política explícita para conflitos, versionamento, tombstones e resolução manual. Não execute um worker que aplique payloads arbitrários sem uma allowlist de entidades e validação por schema.

## Backups

`POST /api/v1/backup` cria um snapshot gzip por organização em storage local, registra SHA-256 e permite download. `POST /api/v1/backup/:id/restore` exige `confirm: RESTORE` e deve ser executado somente por owner em janela controlada. A rotina de retenção é `POST /api/v1/backup/cleanup`; em produção, deve ser acionada por cron do ambiente de hospedagem e complementada por cópia externa, teste de restauração e retenção legal.

## Importação do XLSM de referência

A planilha original não é versionada nem executada pelo sistema. Qualquer importador futuro deve abrir o arquivo em modo somente leitura, rejeitar macros e links externos para execução, capturar apenas células/linhas ocupadas, registrar hash do arquivo e gerar relatório de integridade. O motor de cálculo do laudo deve ser versionado, testado com amostras sanitizadas e manter rastreabilidade de fatores, homogeneização, liquidez, riscos e fontes. Nunca habilite VBA no worker.

## Comandos de verificação

```bash
npm ci
npm run lint
NODE_ENV=test VITEST=true DATABASE_URL=sqlite::memory: BILLING_PROVIDER=local npm test
npm run build
npm run migrate
npm audit --omit=dev --audit-level=high
```

O workflow em `.github/workflows/ci.yml` executa esses passos, além do secret scan. O navegador conectado não foi usado como critério de aprovação do build: a validação automatizada confirmou o contrato HTTP e o carregamento da aplicação local.
