import express from 'express';
import { body, validationResult } from 'express-validator';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo de integrações
const INTEGRACOES_FILE = path.join(__dirname, '../data/integracoes.json');

// Função para garantir que o diretório de dados existe
const ensureDataDir = async () => {
  const dataDir = path.dirname(INTEGRACOES_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
};

// Função para ler integrações do arquivo
const readIntegracoes = async () => {
  try {
    await ensureDataDir();
    const data = await fs.readFile(INTEGRACOES_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    // Se o arquivo não existe, retorna configurações padrão
    return {
      apis_externas: [],
      webhooks: [],
      configuracoes: {
        timeout: 30000,
        retry_attempts: 3,
        rate_limit: 100
      }
    };
  }
};

// Função para salvar integrações no arquivo
const saveIntegracoes = async (integracoes) => {
  await ensureDataDir();
  await fs.writeFile(INTEGRACOES_FILE, JSON.stringify(integracoes, null, 2));
};

// Validações
const validateApiExterna = [
  body('nome').trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('url').isURL().withMessage('URL inválida'),
  body('tipo').isIn(['rest', 'graphql', 'soap']).withMessage('Tipo deve ser rest, graphql ou soap')
];

const validateWebhook = [
  body('nome').trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('url').isURL().withMessage('URL inválida'),
  body('eventos').isArray().withMessage('Eventos deve ser um array')
];

// GET /api/v1/integracoes - Buscar todas as integrações
router.get('/', async (req, res) => {
  try {
    const integracoes = await readIntegracoes();
    res.json({
      success: true,
      data: integracoes
    });
  } catch (error) {
    console.error('Erro ao buscar integrações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar integrações'
    });
  }
});

// GET /api/v1/integracoes/apis - Buscar APIs externas
router.get('/apis', async (req, res) => {
  try {
    const integracoes = await readIntegracoes();
    res.json({
      success: true,
      data: integracoes.apis_externas || []
    });
  } catch (error) {
    console.error('Erro ao buscar APIs externas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar APIs externas'
    });
  }
});

// POST /api/v1/integracoes/apis - Criar nova API externa
router.post('/apis', validateApiExterna, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { nome, url, tipo, headers, autenticacao, descricao } = req.body;
    const integracoes = await readIntegracoes();

    const novaApi = {
      id: uuidv4(),
      nome,
      url,
      tipo,
      headers: headers || {},
      autenticacao: autenticacao || { tipo: 'none' },
      descricao: descricao || '',
      ativa: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!integracoes.apis_externas) {
      integracoes.apis_externas = [];
    }

    integracoes.apis_externas.push(novaApi);
    await saveIntegracoes(integracoes);

    res.status(201).json({
      success: true,
      message: 'API externa criada com sucesso',
      data: novaApi
    });
  } catch (error) {
    console.error('Erro ao criar API externa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar API externa'
    });
  }
});

// PUT /api/v1/integracoes/apis/:id - Atualizar API externa
router.put('/apis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, url, tipo, headers, autenticacao, descricao, ativa } = req.body;
    const integracoes = await readIntegracoes();

    if (!integracoes.apis_externas) {
      return res.status(404).json({
        success: false,
        message: 'API externa não encontrada'
      });
    }

    const apiIndex = integracoes.apis_externas.findIndex(api => api.id === id);
    if (apiIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'API externa não encontrada'
      });
    }

    // Atualizar API
    integracoes.apis_externas[apiIndex] = {
      ...integracoes.apis_externas[apiIndex],
      nome: nome || integracoes.apis_externas[apiIndex].nome,
      url: url || integracoes.apis_externas[apiIndex].url,
      tipo: tipo || integracoes.apis_externas[apiIndex].tipo,
      headers: headers || integracoes.apis_externas[apiIndex].headers,
      autenticacao: autenticacao || integracoes.apis_externas[apiIndex].autenticacao,
      descricao: descricao || integracoes.apis_externas[apiIndex].descricao,
      ativa: ativa !== undefined ? ativa : integracoes.apis_externas[apiIndex].ativa,
      updated_at: new Date().toISOString()
    };

    await saveIntegracoes(integracoes);

    res.json({
      success: true,
      message: 'API externa atualizada com sucesso',
      data: integracoes.apis_externas[apiIndex]
    });
  } catch (error) {
    console.error('Erro ao atualizar API externa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar API externa'
    });
  }
});

// DELETE /api/v1/integracoes/apis/:id - Deletar API externa
router.delete('/apis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const integracoes = await readIntegracoes();

    if (!integracoes.apis_externas) {
      return res.status(404).json({
        success: false,
        message: 'API externa não encontrada'
      });
    }

    const apiIndex = integracoes.apis_externas.findIndex(api => api.id === id);
    if (apiIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'API externa não encontrada'
      });
    }

    integracoes.apis_externas.splice(apiIndex, 1);
    await saveIntegracoes(integracoes);

    res.json({
      success: true,
      message: 'API externa deletada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar API externa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar API externa'
    });
  }
});

// GET /api/v1/integracoes/webhooks - Buscar webhooks
router.get('/webhooks', async (req, res) => {
  try {
    const integracoes = await readIntegracoes();
    res.json({
      success: true,
      data: integracoes.webhooks || []
    });
  } catch (error) {
    console.error('Erro ao buscar webhooks:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar webhooks'
    });
  }
});

// POST /api/v1/integracoes/webhooks - Criar novo webhook
router.post('/webhooks', validateWebhook, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { nome, url, eventos, headers, secret, descricao } = req.body;
    const integracoes = await readIntegracoes();

    const novoWebhook = {
      id: uuidv4(),
      nome,
      url,
      eventos,
      headers: headers || {},
      secret: secret || '',
      descricao: descricao || '',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!integracoes.webhooks) {
      integracoes.webhooks = [];
    }

    integracoes.webhooks.push(novoWebhook);
    await saveIntegracoes(integracoes);

    res.status(201).json({
      success: true,
      message: 'Webhook criado com sucesso',
      data: novoWebhook
    });
  } catch (error) {
    console.error('Erro ao criar webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar webhook'
    });
  }
});

// POST /api/v1/integracoes/test/:tipo/:id - Testar integração
router.post('/test/:tipo/:id', async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const integracoes = await readIntegracoes();

    if (tipo === 'api') {
      const api = integracoes.apis_externas?.find(a => a.id === id);
      if (!api) {
        return res.status(404).json({
          success: false,
          message: 'API não encontrada'
        });
      }

      // Simular teste de API
      const testResult = {
        success: true,
        response_time: Math.floor(Math.random() * 1000) + 100,
        status_code: 200,
        message: 'Conexão estabelecida com sucesso'
      };

      res.json({
        success: true,
        message: 'Teste de API realizado',
        data: testResult
      });
    } else if (tipo === 'webhook') {
      const webhook = integracoes.webhooks?.find(w => w.id === id);
      if (!webhook) {
        return res.status(404).json({
          success: false,
          message: 'Webhook não encontrado'
        });
      }

      // Simular teste de webhook
      const testResult = {
        success: true,
        response_time: Math.floor(Math.random() * 500) + 50,
        status_code: 200,
        message: 'Webhook testado com sucesso'
      };

      res.json({
        success: true,
        message: 'Teste de webhook realizado',
        data: testResult
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Tipo de integração inválido'
      });
    }
  } catch (error) {
    console.error('Erro ao testar integração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao testar integração'
    });
  }
});

// GET /api/v1/integracoes/logs - Buscar logs de integrações
router.get('/logs', async (req, res) => {
  try {
    // Simular logs de integrações
    const logs = [
      {
        id: uuidv4(),
        tipo: 'api',
        nome: 'API Externa 1',
        status: 'success',
        timestamp: new Date().toISOString(),
        response_time: 250,
        message: 'Requisição processada com sucesso'
      },
      {
        id: uuidv4(),
        tipo: 'webhook',
        nome: 'Webhook Notificações',
        status: 'error',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        response_time: 5000,
        message: 'Timeout na requisição'
      }
    ];

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar logs'
    });
  }
});

export default router;