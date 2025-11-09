import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import process from 'process';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-aqui';

// Configuração do ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Caminho para o arquivo de dados
const dataPath = path.join(__dirname, '..', 'data', 'logo-config.json');

// Função para ler dados
const readLogoConfig = () => {
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Erro ao ler configurações de logo:', error);
    return {};
  }
};

// Função para salvar dados
const saveLogoConfig = (data) => {
  try {
    // Garantir que o diretório existe
    const dir = path.dirname(dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar configurações de logo:', error);
    return false;
  }
};

// GET - Buscar configurações de logo do usuário
router.get('/', authenticateToken, (req, res) => {
  try {
    const allConfigs = readLogoConfig();
    const userConfig = allConfigs[req.user.email] || {
      logoUrl: '',
      logoSize: 100,
      logoPosition: 'top-right',
      logoOpacity: 100,
      showInPages: true,
      showInReports: true
    };

    res.json({
      success: true,
      data: userConfig
    });
  } catch (error) {
    console.error('Erro ao buscar configurações de logo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST - Salvar configurações de logo
router.post('/', authenticateToken, (req, res) => {
  try {
    const { logoUrl, logoSize, logoPosition, logoOpacity, showInPages, showInReports } = req.body;

    // Validações básicas
    if (logoSize && (logoSize < 50 || logoSize > 200)) {
      return res.status(400).json({
        success: false,
        message: 'Tamanho do logo deve estar entre 50 e 200 pixels'
      });
    }

    if (logoOpacity && (logoOpacity < 10 || logoOpacity > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Opacidade deve estar entre 10% e 100%'
      });
    }

    const validPositions = [
      'top-left', 'top-center', 'top-right',
      'center-left', 'center', 'center-right',
      'bottom-left', 'bottom-center', 'bottom-right'
    ];

    if (logoPosition && !validPositions.includes(logoPosition)) {
      return res.status(400).json({
        success: false,
        message: 'Posição do logo inválida'
      });
    }

    // Ler configurações existentes
    const allConfigs = readLogoConfig();
    
    // Atualizar configurações do usuário
    allConfigs[req.user.email] = {
      logoUrl: logoUrl || '',
      logoSize: logoSize || 100,
      logoPosition: logoPosition || 'top-right',
      logoOpacity: logoOpacity || 100,
      showInPages: showInPages !== undefined ? showInPages : true,
      showInReports: showInReports !== undefined ? showInReports : true,
      updatedAt: new Date().toISOString()
    };

    // Salvar no arquivo
    if (saveLogoConfig(allConfigs)) {
      res.json({
        success: true,
        message: 'Configurações de logo salvas com sucesso',
        data: allConfigs[req.user.email]
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erro ao salvar configurações'
      });
    }
  } catch (error) {
    console.error('Erro ao salvar configurações de logo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// DELETE - Remover logo do usuário
router.delete('/', authenticateToken, (req, res) => {
  try {
    const allConfigs = readLogoConfig();
    
    if (allConfigs[req.user.email]) {
      allConfigs[req.user.email].logoUrl = '';
      allConfigs[req.user.email].updatedAt = new Date().toISOString();
      
      if (saveLogoConfig(allConfigs)) {
        res.json({
          success: true,
          message: 'Logo removido com sucesso'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro ao remover logo'
        });
      }
    } else {
      res.json({
        success: true,
        message: 'Nenhum logo encontrado para remover'
      });
    }
  } catch (error) {
    console.error('Erro ao remover logo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

export default router;