import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho para o arquivo de logs de auditoria
const auditLogPath = path.join(__dirname, '../data/audit-logs.json');

// Função para garantir que o diretório existe
const ensureLogDir = () => {
  const dir = path.dirname(auditLogPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Função para ler logs existentes
const readAuditLogs = () => {
  try {
    if (!fs.existsSync(auditLogPath)) {
      return [];
    }
    const data = fs.readFileSync(auditLogPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler logs de auditoria:', error);
    return [];
  }
};

// Função para salvar logs
const saveAuditLogs = (logs) => {
  try {
    ensureLogDir();
    fs.writeFileSync(auditLogPath, JSON.stringify(logs, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar logs de auditoria:', error);
    return false;
  }
};

// Função para registrar atividade
export const logActivity = (userId, action, resource, resourceId = null, details = {}) => {
  const logs = readAuditLogs();
  
  const logEntry = {
    id: Date.now().toString(),
    userId,
    action, // CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT
    resource, // clientes, projetos, orcamentos, usuarios
    resourceId,
    details,
    timestamp: new Date().toISOString(),
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown'
  };
  
  logs.push(logEntry);
  
  // Manter apenas os últimos 10000 logs para evitar crescimento excessivo
  if (logs.length > 10000) {
    logs.splice(0, logs.length - 10000);
  }
  
  saveAuditLogs(logs);
  return logEntry;
};

// Middleware de auditoria para rotas
export const auditMiddleware = (action, resource) => {
  return (req, res, next) => {
    // Interceptar a resposta para capturar o resultado
    const originalSend = res.send;
    
    res.send = function(data) {
      // Registrar apenas se a operação foi bem-sucedida
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id || 'anonymous';
        const resourceId = req.params?.id || null;
        
        logActivity(userId, action, resource, resourceId, {
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode
        });
      }
      
      // Chamar o método original
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Função para obter logs de um usuário específico (para relatórios LGPD)
export const getUserAuditLogs = (userId, startDate = null, endDate = null) => {
  const logs = readAuditLogs();
  
  let userLogs = logs.filter(log => log.userId === userId);
  
  if (startDate) {
    userLogs = userLogs.filter(log => new Date(log.timestamp) >= new Date(startDate));
  }
  
  if (endDate) {
    userLogs = userLogs.filter(log => new Date(log.timestamp) <= new Date(endDate));
  }
  
  return userLogs;
};

// Função para limpar logs antigos (para conformidade com LGPD)
export const cleanOldLogs = (daysToKeep = 365) => {
  const logs = readAuditLogs();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const filteredLogs = logs.filter(log => new Date(log.timestamp) > cutoffDate);
  
  saveAuditLogs(filteredLogs);
  
  return {
    totalLogs: logs.length,
    remainingLogs: filteredLogs.length,
    removedLogs: logs.length - filteredLogs.length
  };
};

export default {
  logActivity,
  auditMiddleware,
  getUserAuditLogs,
  cleanOldLogs
};