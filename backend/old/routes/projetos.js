import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

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
const dataPath = path.join(__dirname, '../data/projetos.json');

// Função para ler dados
const readData = () => {
  try {
    if (!fs.existsSync(dataPath)) {
      return [];
    }
    const data = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler arquivo de projetos:', error);
    return [];
  }
};

// Função para salvar dados
const saveData = (data) => {
  try {
    // Garantir que o diretório existe
    const dir = path.dirname(dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar arquivo de projetos:', error);
    return false;
  }
};

// GET - Listar projetos do usuário autenticado
router.get('/', authenticateToken, (req, res) => {
  try {
    const projetos = readData();
    // Filtrar projetos do usuário logado
    const projetosUsuario = projetos.filter(p => p.usuario_id === req.user.id);
    res.json({
      success: true,
      data: projetosUsuario
    });
  } catch (error) {
    console.error('Erro ao buscar projetos:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// GET - Buscar projeto por ID (apenas do usuário autenticado)
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const projetos = readData();
    const projeto = projetos.find(p => p.id === req.params.id && p.usuario_id === req.user.id);
    
    if (!projeto) {
      return res.status(404).json({ 
        success: false,
        message: 'Projeto não encontrado ou acesso negado' 
      });
    }
    
    res.json({
      success: true,
      data: projeto
    });
  } catch (error) {
    console.error('Erro ao buscar projeto:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// POST - Criar novo projeto (associado ao usuário autenticado)
router.post('/', authenticateToken, (req, res) => {
  try {
    const projetos = readData();
    const novoProjeto = {
      id: Date.now().toString(),
      ...req.body,
      usuario_id: req.user.id, // Associar ao usuário logado
      status: req.body.status || 'em_andamento',
      imagens: req.body.imagens || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    projetos.push(novoProjeto);
    
    if (saveData(projetos)) {
      res.status(201).json({
        success: true,
        data: novoProjeto,
        message: 'Projeto criado com sucesso'
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Erro ao salvar projeto' 
      });
    }
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// PUT - Atualizar projeto (apenas do usuário autenticado)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const projetos = readData();
    const index = projetos.findIndex(p => p.id === req.params.id && p.usuarioId === req.user.id);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Projeto não encontrado ou acesso negado' 
      });
    }
    
    projetos[index] = {
      ...projetos[index],
      ...req.body,
      usuarioId: req.user.id, // Manter associação ao usuário
      updatedAt: new Date().toISOString()
    };
    
    if (saveData(projetos)) {
      res.json({
        success: true,
        data: projetos[index],
        message: 'Projeto atualizado com sucesso'
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Erro ao atualizar projeto' 
      });
    }
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

// DELETE - Deletar projeto (apenas do usuário autenticado)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const projetos = readData();
    const index = projetos.findIndex(p => p.id === req.params.id && p.usuarioId === req.user.id);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Projeto não encontrado ou acesso negado' 
      });
    }
    
    projetos.splice(index, 1);
    
    if (saveData(projetos)) {
      res.json({ 
        success: true,
        message: 'Projeto deletado com sucesso' 
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Erro ao deletar projeto' 
      });
    }
  } catch (error) {
    console.error('Erro ao deletar projeto:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
});

export default router;