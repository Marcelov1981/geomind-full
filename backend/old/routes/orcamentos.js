import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { auditMiddleware } from '../middleware/auditoria.js';

const JWT_SECRET = 'sua-chave-secreta-aqui';

const router = express.Router();

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token de acesso requerido'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token inválido'
      });
    }
    req.user = user;
    next();
  });
};
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo de dados
const dataPath = path.join(__dirname, '../data/orcamentos.json');

// Função para ler dados
const readData = () => {
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Erro ao ler dados de orçamentos:', error);
    return [];
  }
};

// Função para salvar dados
const saveData = (data) => {
  try {
    // Criar diretório se não existir
    const dir = path.dirname(dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar dados de orçamentos:', error);
    return false;
  }
};

// GET - Listar orçamentos do usuário autenticado
router.get('/', authenticateToken, auditMiddleware('READ', 'orcamentos'), (req, res) => {
  try {
    const orcamentos = readData();
    // Filtrar orçamentos do usuário logado
    const orcamentosUsuario = orcamentos.filter(o => o.usuario_id === req.user.id);
    res.json({
      success: true,
      data: orcamentosUsuario
    });
  } catch (error) {
    console.error('Erro ao buscar orçamentos:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// GET - Buscar orçamento por ID (apenas do usuário autenticado)
router.get('/:id', authenticateToken, auditMiddleware('READ', 'orcamentos'), (req, res) => {
  try {
    const orcamentos = readData();
    const orcamento = orcamentos.find(o => o.id === req.params.id && o.usuario_id === req.user.id);
    
    if (!orcamento) {
      return res.status(404).json({ 
        success: false,
        message: 'Orçamento não encontrado ou acesso negado' 
      });
    }
    
    res.json({
      success: true,
      data: orcamento
    });
  } catch (error) {
    console.error('Erro ao buscar orçamento:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// POST - Criar novo orçamento (associado ao usuário autenticado)
router.post('/', authenticateToken, auditMiddleware('CREATE', 'orcamentos'), (req, res) => {
  try {
    const orcamentos = readData();
    const novoOrcamento = {
      id: Date.now().toString(),
      ...req.body,
      usuario_id: req.user.id, // Associar ao usuário logado
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    orcamentos.push(novoOrcamento);
    
    if (saveData(orcamentos)) {
      res.status(201).json({
        success: true,
        data: novoOrcamento,
        message: 'Orçamento criado com sucesso'
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Erro ao salvar orçamento' 
      });
    }
  } catch (error) {
    console.error('Erro ao criar orçamento:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// PUT - Atualizar orçamento (apenas do usuário autenticado)
router.put('/:id', authenticateToken, auditMiddleware('UPDATE', 'orcamentos'), (req, res) => {
  try {
    const orcamentos = readData();
    const index = orcamentos.findIndex(o => o.id === req.params.id && o.usuario_id === req.user.id);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Orçamento não encontrado ou acesso negado' 
      });
    }
    
    orcamentos[index] = {
      ...orcamentos[index],
      ...req.body,
      usuario_id: req.user.id, // Manter associação ao usuário
      updatedAt: new Date().toISOString()
    };
    
    if (saveData(orcamentos)) {
      res.json({
        success: true,
        data: orcamentos[index],
        message: 'Orçamento atualizado com sucesso'
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Erro ao atualizar orçamento' 
      });
    }
  } catch (error) {
    console.error('Erro ao atualizar orçamento:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// DELETE - Deletar orçamento (apenas do usuário autenticado)
router.delete('/:id', authenticateToken, auditMiddleware('DELETE', 'orcamentos'), (req, res) => {
  try {
    const orcamentos = readData();
    const index = orcamentos.findIndex(o => o.id === req.params.id && o.usuarioId === req.user.id);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Orçamento não encontrado ou acesso negado' 
      });
    }
    
    orcamentos.splice(index, 1);
    
    if (saveData(orcamentos)) {
      res.json({ 
        success: true,
        message: 'Orçamento deletado com sucesso' 
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Erro ao deletar orçamento' 
      });
    }
  } catch (error) {
    console.error('Erro ao deletar orçamento:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

export default router;