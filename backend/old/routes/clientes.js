import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import process from 'node:process';
import Cliente from '../models/Cliente.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-aqui';

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

// GET /api/v1/clientes - Listar todos os clientes do usuário
router.get('/', authenticateToken, async (req, res) => {
  try {
    const clientes = await Cliente.find({ usuario_id: req.user.userId }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: clientes,
      message: `${clientes.length} cliente(s) encontrado(s)`
    });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/v1/clientes/:id - Buscar cliente por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ 
      _id: req.params.id, 
      usuario_id: req.user.userId 
    });

    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    res.json({
      success: true,
      data: cliente
    });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/v1/clientes - Criar novo cliente
router.post('/', authenticateToken, async (req, res) => {
  try {
    const clienteData = {
      ...req.body,
      usuario_id: req.user.userId
    };

    const novoCliente = new Cliente(clienteData);
    const clienteSalvo = await novoCliente.save();

    res.status(201).json({
      success: true,
      data: clienteSalvo,
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PUT /api/v1/clientes/:id - Atualizar cliente
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const clienteAtualizado = await Cliente.findOneAndUpdate(
      { _id: req.params.id, usuario_id: req.user.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!clienteAtualizado) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    res.json({
      success: true,
      data: clienteAtualizado,
      message: 'Cliente atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/v1/clientes/:id - Deletar cliente
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const clienteDeletado = await Cliente.findOneAndDelete({
      _id: req.params.id,
      usuario_id: req.user.userId
    });

    if (!clienteDeletado) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Cliente deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

export default router;