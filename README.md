# GeoMind — Plataforma de Avaliação Imobiliária

O GeoMind organiza o processo de avaliação imobiliária do cadastro ao laudo, com padronização, rastreabilidade, validações de integridade e apoio de inteligência artificial. A aplicação centraliza clientes, projetos, orçamentos, avaliações, evidências, laudos e configurações em um fluxo único.

## Escopo funcional

O fluxo principal começa no cadastro do cliente e do projeto, passa pela montagem do orçamento e pelo registro das informações do imóvel, incorpora evidências e observações técnicas e termina com a geração do laudo e seu histórico. Os módulos de análise de imagens e integridade apoiam a revisão, mas não substituem a responsabilidade técnica do profissional.

A estrutura funcional derivada da planilha de referência está documentada em [`docs/LAUDO_BASE.md`](docs/LAUDO_BASE.md). O arquivo XLSM original não é versionado porque contém macro VBA, links externos e pode conter dados reais de imóveis ou clientes.

## Requisitos

É necessário utilizar Node.js compatível com o Vite configurado no projeto. As dependências são instaladas com `npm ci` para reproduzir o `package-lock.json`.

```bash
npm ci
npm run dev
```

O build de produção e a verificação de qualidade podem ser executados com:

```bash
npm run lint
npm run build
npm run preview
```

## Configuração

Copie `.env.example` para `.env.local` e preencha somente as variáveis necessárias no ambiente local. Nenhuma chave deve ser colocada no código-fonte, em commits ou em mensagens de log. Variáveis iniciadas com `VITE_` são incorporadas ao bundle do navegador; portanto, chaves privadas devem ser utilizadas exclusivamente no backend.

A URL da API é lida de `VITE_API_BASE_URL`. Em desenvolvimento, quando essa variável não está definida, a aplicação utiliza `http://localhost:3001`. Em produção, a base configurada é normalizada e, quando vazia, são usadas rotas relativas ao mesmo host.

## Segurança do repositório

O arquivo `.env` foi removido do índice Git e permanece ignorado. Planilhas `.xlsm` e `.xlsx` também são ignoradas por padrão para evitar publicação acidental de dados pessoais, fórmulas, links externos ou macros. A credencial que esteve presente no histórico público deve ser revogada e substituída pelo responsável pelo serviço correspondente; remover o arquivo do commit atual não apaga a exposição histórica.

O teste opcional do Gemini exige uma variável de ambiente:

```bash
VITE_GEMINI_API_KEY=... node test-gemini.js
```

O teste falha de forma explícita quando a variável não está configurada, sem utilizar fallback embutido.

## Diretrizes de desenvolvimento

As telas são componentes React e os módulos que não fazem parte do dashboard inicial são carregados sob demanda. Essa divisão reduz o custo inicial de carregamento e evita baixar análise de imagens, relatórios e geração de PDF antes de o usuário solicitar esses recursos.

As relações entre clientes, projetos, orçamentos e avaliações são normalizadas no serviço compartilhado. Consultas independentes são executadas em paralelo, IDs numéricos ou textuais são comparados de forma consistente e os caches de listas são invalidados após operações de gravação.

## Licença e dados

Este repositório contém código de aplicação e documentação técnica. Dados de clientes, imóveis, evidências, chaves de API e planilhas de operação devem permanecer em ambientes controlados e não devem ser adicionados ao GitHub público.
