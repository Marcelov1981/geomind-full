import express from 'express';
import { v4 as uuidv4 } from 'uuid';
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
const dataPath = path.join(__dirname, '../data/avaliacoes.json');

// Função para ler dados
function readData() {
  try {
    if (!fs.existsSync(dataPath)) {
      fs.writeFileSync(dataPath, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler dados de avaliações:', error);
    return [];
  }
}

// Função para salvar dados
function saveData(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erro ao salvar dados de avaliações:', error);
    throw error;
  }
}

// GET - Listar avaliações do usuário autenticado
router.get('/', authenticateToken, auditMiddleware('READ', 'avaliacoes'), (req, res) => {
  try {
    const avaliacoes = readData();
    // Filtrar avaliações do usuário logado
    const avaliacoesUsuario = avaliacoes.filter(a => a.usuario_id === req.user.id);
    res.json({
      success: true,
      data: avaliacoesUsuario
    });
  } catch (error) {
    console.error('Erro ao buscar avaliações:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// GET - Buscar avaliação por ID (apenas do usuário autenticado)
router.get('/:id', authenticateToken, auditMiddleware('READ', 'avaliacoes'), (req, res) => {
  try {
    const avaliacoes = readData();
    const avaliacao = avaliacoes.find(a => a.id === req.params.id && a.usuario_id === req.user.id);
    
    if (!avaliacao) {
      return res.status(404).json({ 
        success: false,
        message: 'Avaliação não encontrada ou acesso negado' 
      });
    }
    
    res.json({
      success: true,
      data: avaliacao
    });
  } catch (error) {
    console.error('Erro ao buscar avaliação:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// POST - Criar nova avaliação (associada ao usuário autenticado)
router.post('/', authenticateToken, auditMiddleware('CREATE', 'avaliacoes'), (req, res) => {
  try {
    const {
      orcamentoId,
      dataAvaliacao,
      metodologia,
      valorAvaliado,
      observacoes,
      status
    } = req.body;

    // Validações básicas
    if (!orcamentoId || !dataAvaliacao || !metodologia || !valorAvaliado) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: orcamentoId, dataAvaliacao, metodologia, valorAvaliado'
      });
    }

    const avaliacoes = readData();
    const novaAvaliacao = {
      id: uuidv4(),
      usuario_id: req.user.id,
      orcamentoId,
      dataAvaliacao,
      metodologia,
      valorAvaliado: parseFloat(valorAvaliado),
      observacoes: observacoes || '',
      status: status || 'em_andamento',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    avaliacoes.push(novaAvaliacao);
    saveData(avaliacoes);

    res.status(201).json({
      success: true,
      message: 'Avaliação criada com sucesso',
      data: novaAvaliacao
    });
  } catch (error) {
    console.error('Erro ao criar avaliação:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// PUT - Atualizar avaliação (apenas do usuário autenticado)
router.put('/:id', authenticateToken, auditMiddleware('UPDATE', 'avaliacoes'), (req, res) => {
  try {
    const avaliacoes = readData();
    const index = avaliacoes.findIndex(a => a.id === req.params.id && a.usuario_id === req.user.id);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Avaliação não encontrada ou acesso negado' 
      });
    }

    const {
      orcamentoId,
      dataAvaliacao,
      metodologia,
      valorAvaliado,
      observacoes,
      status
    } = req.body;

    // Atualizar campos fornecidos
    const avaliacaoAtualizada = {
      ...avaliacoes[index],
      ...(orcamentoId && { orcamentoId }),
      ...(dataAvaliacao && { dataAvaliacao }),
      ...(metodologia && { metodologia }),
      ...(valorAvaliado && { valorAvaliado: parseFloat(valorAvaliado) }),
      ...(observacoes !== undefined && { observacoes }),
      ...(status && { status }),
      updated_at: new Date().toISOString()
    };

    avaliacoes[index] = avaliacaoAtualizada;
    saveData(avaliacoes);

    res.json({
      success: true,
      message: 'Avaliação atualizada com sucesso',
      data: avaliacaoAtualizada
    });
  } catch (error) {
    console.error('Erro ao atualizar avaliação:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// DELETE - Excluir avaliação (apenas do usuário autenticado)
router.delete('/:id', authenticateToken, auditMiddleware('DELETE', 'avaliacoes'), (req, res) => {
  try {
    const avaliacoes = readData();
    const index = avaliacoes.findIndex(a => a.id === req.params.id && a.usuario_id === req.user.id);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Avaliação não encontrada ou acesso negado' 
      });
    }

    avaliacoes.splice(index, 1);
    saveData(avaliacoes);

    res.json({
      success: true,
      message: 'Avaliação excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir avaliação:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

export default router;