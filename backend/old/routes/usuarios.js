import express from 'express';
import { body, validationResult } from 'express-validator';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import process from 'process';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo de usuários
const USERS_FILE = path.join(__dirname, '../data/usuarios.json');
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-aqui';

// Função para gerar senha temporária
const gerarSenhaTemporaria = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let senha = '';
  for (let i = 0; i < 8; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
};

// Função para garantir que o diretório de dados existe
const ensureDataDir = async () => {
  const dataDir = path.dirname(USERS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });

// Rota para criar colaborador vinculado a conta matriz
router.post('/colaborador', authenticateToken, async (req, res) => {
  try {
    const { nome, email, telefone, cargo } = req.body;
    const usuarios = await readUsuarios();
    
    // Buscar usuário matriz (quem está criando o colaborador)
    const usuarioMatriz = usuarios.find(u => u.id === req.user.userId);
    if (!usuarioMatriz || usuarioMatriz.tipo !== 'matriz') {
      return res.status(403).json({
        success: false,
        message: 'Apenas contas matriz podem criar colaboradores'
      });
    }
    
    // Verificar limite de colaboradores
    if (usuarioMatriz.colaboradores.length >= usuarioMatriz.numeroColaboradores) {
      return res.status(400).json({
        success: false,
        message: `Limite de ${usuarioMatriz.numeroColaboradores} colaboradores atingido`
      });
    }
    
    // Verificar se email já existe
    const emailExistente = usuarios.find(u => u.email === email);
    if (emailExistente) {
      return res.status(409).json({
        success: false,
        message: 'Email já está em uso'
      });
    }
    
    // Gerar senha temporária única
    const senhaTemporaria = gerarSenhaTemporaria();
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);
    
    // Criar colaborador
    const novoColaborador = {
      id: uuidv4(),
      nome,
      email,
      senha: senhaHash,
      telefone: telefone || '',
      cargo: cargo || '',
      tipoUsuario: 'pessoa_fisica',
      plano: usuarioMatriz.plano,
      status: 'ativo',
      tipo: 'colaborador',
      usuarioMatriz: usuarioMatriz.id,
      colaboradores: [],
      senhaTemporaria: true,
      primeiroLogin: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Adicionar colaborador à lista
    usuarios.push(novoColaborador);
    
    // Atualizar lista de colaboradores do usuário matriz
    usuarioMatriz.colaboradores.push(novoColaborador.id);
    usuarioMatriz.updated_at = new Date().toISOString();
    
    await saveUsuarios(usuarios);
    
    // Remover senha da resposta
     const { senha: _, ...colaboradorSemSenha } = novoColaborador;
    
    res.status(201).json({
      success: true,
      message: 'Colaborador criado com sucesso',
      colaborador: colaboradorSemSenha,
      senhaTemporaria: senhaTemporaria
    });
  } catch (error) {
    console.error('Erro ao criar colaborador:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar colaborador'
    });
  }
});

// Rota para listar colaboradores da conta matriz
router.get('/colaboradores', authenticateToken, async (req, res) => {
  try {
    const usuarios = await readUsuarios();
    const usuarioAtual = usuarios.find(u => u.id === req.user.userId);
    
    if (!usuarioAtual) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    let colaboradores = [];
    
    if (usuarioAtual.tipo === 'matriz') {
      // Se é matriz, buscar seus colaboradores
      colaboradores = usuarios.filter(u => 
        usuarioAtual.colaboradores.includes(u.id)
      ).map(colaborador => {
           delete colaborador.senha;
           return colaborador;
         });
    } else if (usuarioAtual.tipo === 'colaborador') {
      // Se é colaborador, buscar outros colaboradores da mesma matriz
      const matriz = usuarios.find(u => u.id === usuarioAtual.usuarioMatriz);
      if (matriz) {
        colaboradores = usuarios.filter(u => 
          matriz.colaboradores.includes(u.id) && u.id !== usuarioAtual.id
        ).map(colaborador => {
         delete colaborador.senha;
         return colaborador;
       });
      }
    }
    
    res.json({
      success: true,
      colaboradores
    });
  } catch (error) {
    console.error('Erro ao listar colaboradores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar colaboradores'
    });
  }
});
  }
};

// Função para ler usuários do arquivo
const readUsuarios = async () => {
  try {
    await ensureDataDir();
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    // Se o arquivo não existe, retorna array vazio
    return [];
  }
};

// Função para salvar usuários no arquivo
const saveUsuarios = async (usuarios) => {
  await ensureDataDir();
  await fs.writeFile(USERS_FILE, JSON.stringify(usuarios, null, 2));
};

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

// Validações
const validateUsuario = [
  body('nome').trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('email').isEmail().withMessage('Email inválido'),
  body('senha').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('cpfCnpj').optional().isLength({ min: 11 }).withMessage('CPF/CNPJ inválido')
];

const validateLogin = [
  body('email').isEmail().withMessage('Email inválido'),
  body('senha').notEmpty().withMessage('Senha é obrigatória')
];

// POST /api/v1/usuarios/register - Registrar novo usuário
router.post('/register', validateUsuario, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { 
      nome, 
      email, 
      senha, 
      telefone, 
      empresa, 
      cpfCnpj,
      tipoUsuario,
      razaoSocial,
      inscricaoEstadual,
      nomeResponsavel,
      cargoResponsavel,
      precisaSubacessos,
      numeroColaboradores,
      cep,
      endereco,
      cidade,
      estado,
      registroProfissional,
      tipoRegistro
    } = req.body;
    const usuarios = await readUsuarios();

    // Verificar se usuário já existe
    const usuarioExistente = usuarios.find(u => u.email === email);
    if (usuarioExistente) {
      return res.status(409).json({
        success: false,
        message: 'Usuário já existe com este email'
      });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar novo usuário
    const novoUsuario = {
      id: uuidv4(),
      nome,
      email,
      senha: senhaHash,
      telefone: telefone || '',
      empresa: empresa || '',
      cpfCnpj: cpfCnpj || '',
      tipoUsuario: tipoUsuario || 'pessoa_fisica',
      razaoSocial: razaoSocial || '',
      inscricaoEstadual: inscricaoEstadual || '',
      nomeResponsavel: nomeResponsavel || '',
      cargoResponsavel: cargoResponsavel || '',
      precisaSubacessos: precisaSubacessos || false,
      numeroColaboradores: numeroColaboradores || 0,
      registroProfissional: registroProfissional || '',
      tipoRegistro: tipoRegistro || '',
      endereco: {
        cep: cep || '',
        endereco: endereco || '',
        cidade: cidade || '',
        estado: estado || ''
      },
      plano: 'basico',
      status: 'ativo',
      tipo: tipoUsuario === 'pessoa_juridica' && precisaSubacessos ? 'matriz' : 'individual',
      usuarioMatriz: null, // Para colaboradores, será o ID do usuário matriz
      colaboradores: [], // Para usuários matriz, lista de IDs dos colaboradores
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    usuarios.push(novoUsuario);
    await saveUsuarios(usuarios);

    // Gerar token JWT
    const token = jwt.sign(
      { userId: novoUsuario.id, email: novoUsuario.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remover senha da resposta
    const { senha: _senha, ...usuarioSemSenha } = novoUsuario;

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      usuario: usuarioSemSenha,
      token
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar usuário'
    });
  }
});

// POST /api/v1/usuarios/login - Login de usuário
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { email, senha } = req.body;
    const usuarios = await readUsuarios();

    // Buscar usuário
    const usuario = usuarios.find(u => u.email === email);
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar se é primeiro login
    if (usuario.primeiroLogin) {
      return res.status(200).json({
        success: true,
        message: 'Primeiro login detectado',
        primeiroLogin: true,
        userId: usuario.id,
        requirePasswordChange: true
      });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { userId: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remover senha da resposta
    const { senha: _, ...usuarioSemSenha } = usuario;

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      usuario: usuarioSemSenha,
      token
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer login'
    });
  }
});

// GET /api/v1/usuarios/perfil - Buscar perfil do usuário logado
router.get('/perfil', authenticateToken, async (req, res) => {
  try {
    const usuarios = await readUsuarios();
    const usuario = usuarios.find(u => u.id === req.user.id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Remover senha da resposta
    const { senha: _, ...usuarioSemSenha } = usuario;

    res.json({
      success: true,
      data: usuarioSemSenha
    });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar perfil'
    });
  }
});

// PUT /api/v1/usuarios/perfil - Atualizar perfil do usuário
router.put('/perfil', authenticateToken, async (req, res) => {
  try {
    const { 
      nome, 
      telefone, 
      empresa, 
      cpfCnpj,
      tipoUsuario,
      razaoSocial,
      inscricaoEstadual,
      nomeResponsavel,
      cargoResponsavel,
      precisaSubacessos,
      numeroColaboradores,
      endereco,
      registroProfissional,
      tipoRegistro
    } = req.body;
    const usuarios = await readUsuarios();
    const usuarioIndex = usuarios.findIndex(u => u.id === req.user.id);

    if (usuarioIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Atualizar dados do usuário
    usuarios[usuarioIndex] = {
      ...usuarios[usuarioIndex],
      nome: nome || usuarios[usuarioIndex].nome,
      telefone: telefone || usuarios[usuarioIndex].telefone,
      empresa: empresa || usuarios[usuarioIndex].empresa,
      cpfCnpj: cpfCnpj || usuarios[usuarioIndex].cpfCnpj,
      tipoUsuario: tipoUsuario || usuarios[usuarioIndex].tipoUsuario,
      razaoSocial: razaoSocial || usuarios[usuarioIndex].razaoSocial,
      inscricaoEstadual: inscricaoEstadual || usuarios[usuarioIndex].inscricaoEstadual,
      nomeResponsavel: nomeResponsavel || usuarios[usuarioIndex].nomeResponsavel,
      cargoResponsavel: cargoResponsavel || usuarios[usuarioIndex].cargoResponsavel,
      precisaSubacessos: precisaSubacessos !== undefined ? precisaSubacessos : usuarios[usuarioIndex].precisaSubacessos,
      numeroColaboradores: numeroColaboradores || usuarios[usuarioIndex].numeroColaboradores,
      endereco: endereco || usuarios[usuarioIndex].endereco,
      registroProfissional: registroProfissional || usuarios[usuarioIndex].registroProfissional,
      tipoRegistro: tipoRegistro || usuarios[usuarioIndex].tipoRegistro,
      updated_at: new Date().toISOString()
    };

    await saveUsuarios(usuarios);

    // Remover senha da resposta
    const { senha: _, ...usuarioSemSenha } = usuarios[usuarioIndex];

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: usuarioSemSenha
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar perfil'
    });
  }
});

// POST /api/v1/usuarios/primeiro-login - Alterar senha no primeiro login
router.post('/primeiro-login', async (req, res) => {
  try {
    const { userId, senhaAtual, novaSenha } = req.body;
    
    if (!userId || !senhaAtual || !novaSenha) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos são obrigatórios'
      });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }

    const usuarios = await readUsuarios();
    const usuarioIndex = usuarios.findIndex(u => u.id === userId);
    
    if (usuarioIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const usuario = usuarios[usuarioIndex];
    
    // Verificar se ainda é primeiro login
    if (!usuario.primeiroLogin) {
      return res.status(400).json({
        success: false,
        message: 'Usuário já alterou a senha inicial'
      });
    }

    // Verificar senha atual
    const senhaAtualValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaAtualValida) {
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Hash da nova senha
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar usuário
    usuarios[usuarioIndex].senha = novaSenhaHash;
    usuarios[usuarioIndex].primeiroLogin = false;
    usuarios[usuarioIndex].senhaTemporaria = false;
    usuarios[usuarioIndex].updated_at = new Date().toISOString();

    await saveUsuarios(usuarios);

    // Gerar token JWT
    const token = jwt.sign(
      { userId: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remover senha da resposta
    const { senha: _, ...usuarioSemSenha } = usuarios[usuarioIndex];

    res.json({
      success: true,
      message: 'Senha alterada com sucesso',
      usuario: usuarioSemSenha,
      token
    });
  } catch (error) {
    console.error('Erro ao alterar senha no primeiro login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar senha'
    });
  }
});

// PUT /api/v1/usuarios/senha - Alterar senha
router.put('/senha', authenticateToken, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual e nova senha são obrigatórias'
      });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Nova senha deve ter pelo menos 6 caracteres'
      });
    }

    const usuarios = await readUsuarios();
    const usuarioIndex = usuarios.findIndex(u => u.id === req.user.id);

    if (usuarioIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar senha atual
    const senhaValida = await bcrypt.compare(senhaAtual, usuarios[usuarioIndex].senha);
    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Hash da nova senha
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar senha
    usuarios[usuarioIndex].senha = novaSenhaHash;
    usuarios[usuarioIndex].updated_at = new Date().toISOString();

    await saveUsuarios(usuarios);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar senha'
    });
  }
});

// GET /api/v1/usuarios - Listar usuários (admin)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const usuarios = await readUsuarios();
    
    // Remover senhas da resposta
    const usuariosSemSenha = usuarios.map(usuario => {
      const { senha: _senha, ...usuarioSemSenha } = usuario;
      return usuarioSemSenha;
    });

    res.json({
      success: true,
      data: usuariosSemSenha
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários'
    });
  }
});

export default router;