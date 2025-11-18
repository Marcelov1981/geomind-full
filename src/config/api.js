import axios from 'axios';

const API_BASE_URL_DEV = 'http://localhost:3001';
const API_BASE_URL_PROD = import.meta.env.VITE_API_BASE_URL || 'https://your-backend-url.com';

const DEV_CONFIG = {
  baseURL: API_BASE_URL_DEV,
  timeout: 30000,
};

const PROD_CONFIG = {
  baseURL: API_BASE_URL_PROD,
  timeout: 30000,
};

const config = (import.meta.env.MODE === 'production' || import.meta.env.VITE_API_BASE_URL) ? PROD_CONFIG : DEV_CONFIG;
const API_BASE_URL = config.baseURL;

export const API_BASE_URL_EXPORT = config.baseURL;
export { API_BASE_URL_EXPORT as API_BASE_URL };

export const API_ENDPOINTS = {
  // Configurações
  configuracoes: {
    base: `${API_BASE_URL}/api/v1/configuracoes`,
    geral: `${API_BASE_URL}/api/v1/configuracoes/geral`,
    logo: `${API_BASE_URL}/api/v1/configuracoes/logo`,
    byType: (tipo) => `${API_BASE_URL}/api/v1/configuracoes/${tipo}`,
  },

  // Usuários
  usuarios: {
    base: `${API_BASE_URL}/api/v1/usuarios`,
    register: `${API_BASE_URL}/api/v1/usuarios/register`,
    login: `${API_BASE_URL}/api/v1/usuarios/login`,
    profile: `${API_BASE_URL}/api/v1/usuarios/perfil`,
    updatePassword: `${API_BASE_URL}/api/v1/usuarios/senha`,
    primeiroLogin: `${API_BASE_URL}/api/v1/usuarios/primeiro-login`,
    colaborador: `${API_BASE_URL}/api/v1/usuarios/colaborador`,
    colaboradores: `${API_BASE_URL}/api/v1/usuarios/colaboradores`,
  },
  
  // Backup
  backup: {
    base: `${API_BASE_URL}/api/v1/backup`,
    create: `${API_BASE_URL}/api/v1/backup`,
    list: `${API_BASE_URL}/api/v1/backup`,
    restore: (id) => `${API_BASE_URL}/api/v1/backup/${id}/restore`,
    delete: (id) => `${API_BASE_URL}/api/v1/backup/${id}`,
    autoConfig: `${API_BASE_URL}/api/v1/backup/auto-config`,
    cleanup: `${API_BASE_URL}/api/v1/backup/cleanup`,
  },
  
  // Integrações
  integracoes: {
    base: `${API_BASE_URL}/api/v1/integracoes`,
    apis: `${API_BASE_URL}/api/v1/integracoes/apis`,
    webhooks: `${API_BASE_URL}/api/v1/integracoes/webhooks`,
    test: `${API_BASE_URL}/api/v1/integracoes/test`,
    logs: `${API_BASE_URL}/api/v1/integracoes/logs`,
  },
  
  // Orçamentos
  orcamentos: {
    base: `${API_BASE_URL}/api/v1/orcamentos`,
    byId: (id) => `${API_BASE_URL}/api/v1/orcamentos/${id}`,
  },
  
  // Laudos
  laudos: {
    base: `${API_BASE_URL}/api/v1/laudos`,
    byId: (id) => `${API_BASE_URL}/api/v1/laudos/${id}`,
  },
  
  // Avaliações
  avaliacoes: {
    base: `${API_BASE_URL}/api/v1/avaliacoes`,
    byId: (id) => `${API_BASE_URL}/api/v1/avaliacoes/${id}`,
  },
  
  // Clientes
  clientes: {
    base: `${API_BASE_URL}/api/v1/clientes`,
    byId: (id) => `${API_BASE_URL}/api/v1/clientes/${id}`,
  },
  
  // Projetos
  projetos: {
    base: `${API_BASE_URL}/api/v1/projetos`,
    byId: (id) => `${API_BASE_URL}/api/v1/projetos/${id}`,
  },
  
  // Health check
  health: `${API_BASE_URL}/health`,
};

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

const api = axios.create(API_CONFIG);
export default api;