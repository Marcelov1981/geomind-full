import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminhos para arquivos de dados
const DATA_DIR = path.join(__dirname, '../data');
const BACKUP_DIR = path.join(__dirname, '../backups');

// Função para garantir que os diretórios existem
const ensureDirectories = async () => {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  }
};

// Função para criar backup
const createBackup = async () => {
  await ensureDirectories();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = uuidv4();
  const backupFileName = `backup-${timestamp}-${backupId}.json`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);
  
  // Ler todos os arquivos de dados
  const backupData = {
    id: backupId,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    data: {}
  };
  
  try {
    // Backup de configurações
    try {
      const configData = await fs.readFile(path.join(DATA_DIR, 'configuracoes.json'), 'utf8');
      backupData.data.configuracoes = JSON.parse(configData);
    } catch {
      backupData.data.configuracoes = null;
    }
    
    // Backup de usuários (sem senhas)
    try {
      const usersData = await fs.readFile(path.join(DATA_DIR, 'usuarios.json'), 'utf8');
      const users = JSON.parse(usersData);
      backupData.data.usuarios = users.map(user => {
        const { senha: _senha, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
    } catch {
      backupData.data.usuarios = null;
    }
    
    // Salvar backup
    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
    
    return {
      id: backupId,
      filename: backupFileName,
      path: backupPath,
      timestamp: backupData.timestamp,
      size: (await fs.stat(backupPath)).size
    };
  } catch (error) {
    throw new Error(`Erro ao criar backup: ${error.message}`);
  }
};

// Função para listar backups
const listBackups = async () => {
  await ensureDirectories();
  
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = [];
    
    for (const file of files) {
      if (file.endsWith('.json') && file.startsWith('backup-')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = await fs.stat(filePath);
        
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const backupData = JSON.parse(content);
          
          backups.push({
            id: backupData.id,
            filename: file,
            timestamp: backupData.timestamp,
            size: stats.size,
            version: backupData.version || '1.0.0'
          });
        } catch {
          // Arquivo corrompido, pular
          continue;
        }
      }
    }
    
    // Ordenar por timestamp (mais recente primeiro)
    return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch {
    return [];
  }
};

// Função para restaurar backup
const restoreBackup = async (backupId) => {
  await ensureDirectories();
  
  const backups = await listBackups();
  const backup = backups.find(b => b.id === backupId);
  
  if (!backup) {
    throw new Error('Backup não encontrado');
  }
  
  const backupPath = path.join(BACKUP_DIR, backup.filename);
  
  try {
    const content = await fs.readFile(backupPath, 'utf8');
    const backupData = JSON.parse(content);
    
    // Restaurar configurações
    if (backupData.data.configuracoes) {
      await fs.writeFile(
        path.join(DATA_DIR, 'configuracoes.json'),
        JSON.stringify(backupData.data.configuracoes, null, 2)
      );
    }
    
    // Restaurar usuários (nota: senhas não são restauradas por segurança)
    if (backupData.data.usuarios) {
      await fs.writeFile(
        path.join(DATA_DIR, 'usuarios.json'),
        JSON.stringify(backupData.data.usuarios, null, 2)
      );
    }
    
    return backup;
  } catch (error) {
    throw new Error(`Erro ao restaurar backup: ${error.message}`);
  }
};

// POST /api/v1/backup - Criar novo backup
router.post('/', async (req, res) => {
  try {
    const backup = await createBackup();
    
    res.json({
      success: true,
      message: 'Backup criado com sucesso',
      data: backup
    });
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/v1/backup - Listar backups
router.get('/', async (req, res) => {
  try {
    const backups = await listBackups();
    
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('Erro ao listar backups:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar backups'
    });
  }
});

// POST /api/v1/backup/:id/restore - Restaurar backup
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await restoreBackup(id);
    
    res.json({
      success: true,
      message: 'Backup restaurado com sucesso',
      data: backup
    });
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE /api/v1/backup/:id - Deletar backup
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const backups = await listBackups();
    const backup = backups.find(b => b.id === id);
    
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup não encontrado'
      });
    }
    
    const backupPath = path.join(BACKUP_DIR, backup.filename);
    await fs.unlink(backupPath);
    
    res.json({
      success: true,
      message: 'Backup deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar backup'
    });
  }
});

// GET /api/v1/backup/auto-config - Configurações de backup automático
router.get('/auto-config', async (req, res) => {
  try {
    // Ler configurações de backup
    const configPath = path.join(DATA_DIR, 'configuracoes.json');
    let backupConfig = {
      automatico: false,
      frequencia: 'diario',
      retencao_dias: 30,
      proximo_backup: null
    };
    
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      if (config.sistema && config.sistema.backup) {
        backupConfig = { ...backupConfig, ...config.sistema.backup };
      }
    } catch {
      // Usar configuração padrão
    }
    
    res.json({
      success: true,
      data: backupConfig
    });
  } catch (error) {
    console.error('Erro ao buscar configurações de backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar configurações de backup'
    });
  }
});

// POST /api/v1/backup/cleanup - Limpar backups antigos
router.post('/cleanup', async (req, res) => {
  try {
    const { retencao_dias = 30 } = req.body;
    const backups = await listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retencao_dias);
    
    let deletedCount = 0;
    
    for (const backup of backups) {
      const backupDate = new Date(backup.timestamp);
      if (backupDate < cutoffDate) {
        try {
          const backupPath = path.join(BACKUP_DIR, backup.filename);
          await fs.unlink(backupPath);
          deletedCount++;
        } catch {
          // Ignorar erros de deleção individual
        }
      }
    }
    
    res.json({
      success: true,
      message: `${deletedCount} backups antigos foram removidos`,
      data: { deletedCount, retencao_dias }
    });
  } catch (error) {
    console.error('Erro ao limpar backups:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao limpar backups'
    });
  }
});

export default router;