import express from 'express';
import { body, validationResult } from 'express-validator';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo de configurações
const CONFIG_FILE = path.join(__dirname, '../data/configuracoes.json');

// Função para garantir que o diretório de dados existe
const ensureDataDir = async () => {
  const dataDir = path.dirname(CONFIG_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
};

// Função para ler configurações do arquivo
const readConfiguracoes = async () => {
  try {
    await ensureDataDir();
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    // Se o arquivo não existe, retorna configurações padrão
    return {
      geral: {
        idioma: 'pt-BR',
        tema: 'light',
        notificacoes: {
          email: true,
          push: false,
          sms: false
        }
      },
      usuario: {
        perfil: {
          nome: '',
          email: '',
          telefone: '',
          empresa: ''
        },
        preferencias: {
          timezone: 'America/Sao_Paulo',
          formato_data: 'DD/MM/YYYY',
          formato_moeda: 'BRL'
        },
        seguranca: {
          autenticacao_dois_fatores: false,
          sessao_timeout: 30
        }
      },
      sistema: {
        backup: {
          automatico: true,
          frequencia: 'diario',
          retencao_dias: 30
        },
        logs: {
          nivel: 'info',
          retencao_dias: 7
        },
        integracao: {
          api_externa: false,
          webhook_url: ''
        }
      },
      relatorios: {
        formatos: ['PDF', 'Excel'],
        agendamento: {
          ativo: false,
          frequencia: 'semanal',
          dia_semana: 1
        },
        filtros: {
          periodo_padrao: '30_dias',
          incluir_graficos: true
        },
        templates: {
          cabecalho_personalizado: '',
          rodape_personalizado: '',
          logo_relatorio: ''
        },
        assinatura: {
          digital_ativa: false,
          certificado_path: '',
          senha_certificado: ''
        }
      }
    };
  }
};

// Função para salvar configurações no arquivo
const saveConfiguracoes = async (configuracoes) => {
  await ensureDataDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(configuracoes, null, 2));
};

// Middleware de validação
const validateConfiguracao = [
  body('tipo').isIn(['geral', 'usuario', 'sistema', 'relatorios']).withMessage('Tipo de configuração inválido'),
  body('dados').isObject().withMessage('Dados devem ser um objeto válido')
];

// GET /api/v1/configuracoes - Buscar todas as configurações
router.get('/', async (req, res) => {
  try {
    const configuracoes = await readConfiguracoes();
    res.json({
      success: true,
      data: configuracoes
    });
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configurações'
    });
  }
});

// GET /api/v1/configuracoes/:tipo - Buscar configurações por tipo
router.get('/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const configuracoes = await readConfiguracoes();
    
    if (!configuracoes[tipo]) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de configuração não encontrado'
      });
    }
    
    res.json({
      success: true,
      data: configuracoes[tipo]
    });
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configuração'
    });
  }
});

// POST /api/v1/configuracoes - Criar/atualizar configuração
router.post('/', validateConfiguracao, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }
    
    const { tipo, dados } = req.body;
    const configuracoes = await readConfiguracoes();
    
    // Atualizar configurações
    configuracoes[tipo] = { ...configuracoes[tipo], ...dados };
    
    await saveConfiguracoes(configuracoes);
    
    res.json({
      success: true,
      message: 'Configuração salva com sucesso',
      data: configuracoes[tipo]
    });
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar configuração'
    });
  }
});

// PUT /api/v1/configuracoes/:tipo - Atualizar configuração específica
router.put('/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const dados = req.body;
    
    const configuracoes = await readConfiguracoes();
    
    if (!configuracoes[tipo]) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de configuração não encontrado'
      });
    }
    
    // Atualizar configurações
    configuracoes[tipo] = { ...configuracoes[tipo], ...dados };
    
    await saveConfiguracoes(configuracoes);
    
    res.json({
      success: true,
      message: 'Configuração atualizada com sucesso',
      data: configuracoes[tipo]
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configuração'
    });
  }
});

// DELETE /api/v1/configuracoes/:tipo - Resetar configuração para padrão
router.delete('/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    
    // Recarregar configurações padrão
    const configuracoes = await readConfiguracoes();
    
    if (!configuracoes[tipo]) {
      return res.status(404).json({
        success: false,
        message: 'Tipo de configuração não encontrado'
      });
    }
    
    // Resetar para configuração padrão
    delete configuracoes[tipo];
    const novasConfiguracoes = await readConfiguracoes();
    configuracoes[tipo] = novasConfiguracoes[tipo];
    
    await saveConfiguracoes(configuracoes);
    
    res.json({
      success: true,
      message: 'Configuração resetada para padrão',
      data: configuracoes[tipo]
    });
  } catch (error) {
    console.error('Erro ao resetar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao resetar configuração'
    });
  }
});

export default router;