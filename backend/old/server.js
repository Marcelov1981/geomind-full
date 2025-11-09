import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import connectDB from './config/database.js';

// Importar rotas
import configuracoesRoutes from './routes/configuracoes.js';
import usuariosRoutes from './routes/usuarios.js';
import backupRoutes from './routes/backup.js';
import integracoesRoutes from './routes/integracoes.js';
import orcamentosRoutes from './routes/orcamentos.js';
import laudosRoutes from './routes/laudos.js';
import clientesRoutes from './routes/clientes.js';
import projetosRoutes from './routes/projetos.js';
import avaliacoesRoutes from './routes/avaliacoes.js';
import logoRoutes from './routes/logo.js';

// Configuração do ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de segurança
app.use(helmet());

// CORS configurado para permitir requisições do frontend
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:4173', 
    'http://localhost:3000',
    /\.onrender\.com$/,
    /localhost:\d+$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware de logging
app.use(morgan('combined'));

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para servir arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas da API
// IMPORTANTE: Rotas mais específicas devem vir ANTES das mais genéricas
app.use('/api/v1/configuracoes/logo', logoRoutes);
app.use('/api/v1/configuracoes', configuracoesRoutes);
app.use('/api/v1/usuarios', usuariosRoutes);
app.use('/api/v1/backup', backupRoutes);
app.use('/api/v1/integracoes', integracoesRoutes);
app.use('/api/v1/orcamentos', orcamentosRoutes);
app.use('/api/v1/laudos', laudosRoutes);
app.use('/api/v1/clientes', clientesRoutes);
app.use('/api/v1/projetos', projetosRoutes);
app.use('/api/v1/avaliacoes', avaliacoesRoutes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Servidor funcionando corretamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API SaaS Backend - Sistema de Configurações',
    version: '1.0.0',
    endpoints: {
      configuracoes: '/api/v1/configuracoes',
      usuarios: '/api/v1/usuarios',
      backup: '/api/v1/backup',
      integracoes: '/api/v1/integracoes',
      health: '/health'
    }
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
    path: req.originalUrl
  });
});

// Middleware de tratamento de erros global (deve ser o último)
app.use((err, req, res) => {
  console.error('Erro:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: 'Erro interno'
  });
});

// Conectar ao MongoDB e iniciar servidor
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📱 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS configurado para: ${process.env.CORS_ORIGIN || 'localhost'}`);
      console.log(`🗄️ MongoDB conectado com sucesso`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();

export default app;