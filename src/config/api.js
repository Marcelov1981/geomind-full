import axios from 'axios';

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const defaultBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
export const API_BASE_URL = configuredBaseUrl.replace(/\/api\/v1$/i, '') || defaultBaseUrl;
export const API_PREFIX = `${API_BASE_URL}/api/v1`;

export const API_ENDPOINTS = {
  configuracoes: {
    base: `${API_PREFIX}/configuracoes`,
    geral: `${API_PREFIX}/configuracoes/geral`,
    logo: `${API_PREFIX}/configuracoes/logo`,
    byType: (tipo) => `${API_PREFIX}/configuracoes/${encodeURIComponent(tipo)}`,
  },
  usuarios: {
    base: `${API_PREFIX}/usuarios`,
    register: `${API_PREFIX}/usuarios/register`,
    login: `${API_PREFIX}/usuarios/login`,
    logout: `${API_PREFIX}/usuarios/logout`,
    profile: `${API_PREFIX}/usuarios/perfil`,
    updateProfile: `${API_PREFIX}/usuarios/perfil`,
    updatePassword: `${API_PREFIX}/usuarios/senha`,
    primeiroLogin: `${API_PREFIX}/usuarios/primeiro-login`,
    colaborador: `${API_PREFIX}/usuarios/colaborador`,
    colaboradores: `${API_PREFIX}/usuarios/colaboradores`,
  },
  backup: {
    base: `${API_PREFIX}/backup`,
    create: `${API_PREFIX}/backup`,
    list: `${API_PREFIX}/backup`,
    restore: (id) => `${API_PREFIX}/backup/${encodeURIComponent(id)}/restore`,
    delete: (id) => `${API_PREFIX}/backup/${encodeURIComponent(id)}`,
    download: (id) => `${API_PREFIX}/backup/${encodeURIComponent(id)}/download`,
    cleanup: `${API_PREFIX}/backup/cleanup`,
  },
  integracoes: {
    base: `${API_PREFIX}/integracoes`,
    webhooks: `${API_PREFIX}/integracoes/webhooks`,
    status: `${API_PREFIX}/integracoes/status`,
  },
  dashboard: `${API_PREFIX}/dashboard`,
  orcamentos: { base: `${API_PREFIX}/orcamentos`, byId: (id) => `${API_PREFIX}/orcamentos/${encodeURIComponent(id)}` },
  laudos: { base: `${API_PREFIX}/laudos`, byId: (id) => `${API_PREFIX}/laudos/${encodeURIComponent(id)}` },
  avaliacoes: { base: `${API_PREFIX}/avaliacoes`, byId: (id) => `${API_PREFIX}/avaliacoes/${encodeURIComponent(id)}` },
  clientes: { base: `${API_PREFIX}/clientes`, byId: (id) => `${API_PREFIX}/clientes/${encodeURIComponent(id)}` },
  projetos: { base: `${API_PREFIX}/projetos`, byId: (id) => `${API_PREFIX}/projetos/${encodeURIComponent(id)}`, geo: (id) => `${API_PREFIX}/projetos/${encodeURIComponent(id)}/geografia`, importLaudo: (id) => `${API_PREFIX}/projetos/${encodeURIComponent(id)}/importacoes/laudo`, routes: (id) => `${API_PREFIX}/projetos/${encodeURIComponent(id)}/rotas`, evidences: (id) => `${API_PREFIX}/projetos/${encodeURIComponent(id)}/evidencias` },
  evidencias: { byId: (id) => `${API_PREFIX}/evidencias/${encodeURIComponent(id)}`, download: (id) => `${API_PREFIX}/evidencias/${encodeURIComponent(id)}/download`, ai: (id) => `${API_PREFIX}/evidencias/${encodeURIComponent(id)}/analise-ia`, analyses: (id) => `${API_PREFIX}/evidencias/${encodeURIComponent(id)}/analises-ia`, review: (evidenceId, analysisId) => `${API_PREFIX}/evidencias/${encodeURIComponent(evidenceId)}/analises-ia/${encodeURIComponent(analysisId)}` },
  billing: {
    summary: `${API_PREFIX}/billing/summary`,
    topUp: `${API_PREFIX}/billing/top-up`,
    consume: `${API_PREFIX}/billing/consume`,
    transactions: `${API_PREFIX}/billing/transactions`,
    methods: `${API_PREFIX}/billing/payment-methods`,
  },
  auditoria: `${API_PREFIX}/auditoria`,
  health: `${API_BASE_URL}/health`,
};

export const API_CONFIG = {
  baseURL: '',
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
};

const api = axios.create(API_CONFIG);

const TOKEN_LS_KEY = 'geomind_token';

api.interceptors.request.use((config) => {
  const tok = (typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_LS_KEY) : null) || null;
  if (tok && !config.headers?.Authorization) {
    config.headers = { ...(config.headers || {}), Authorization: `Bearer ${tok}` };
  }
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || '';
    if (/\/(login|register|primeiro-login)$/.test(url) && response.data?.token) {
      try { window.localStorage.setItem(TOKEN_LS_KEY, response.data.token); } catch { /* ignore */ }
    }
    const logoutUrl = response.config?.url || '';
    if (/\/logout$/.test(logoutUrl)) {
      try { window.localStorage.removeItem(TOKEN_LS_KEY); } catch { /* ignore */ }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      try { window.localStorage.removeItem(TOKEN_LS_KEY); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('geomind:session-expired'));
    }
    return Promise.reject(error);
  },
);

export default api;
