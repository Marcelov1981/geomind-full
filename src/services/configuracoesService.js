import axios from 'axios';
import { API_ENDPOINTS, API_CONFIG } from '../config/api.js';

const api = axios.create(API_CONFIG);

class ConfiguracoesService {
  // Buscar todas as configurações
  async buscarTodasConfiguracoes() {
    try {
      const response = await api.get(API_ENDPOINTS.configuracoes.base);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      throw error;
    }
  }

  // Buscar configurações por tipo
  async buscarConfiguracoesPorTipo(tipo) {
    try {
      const response = await api.get(API_ENDPOINTS.configuracoes.byType(tipo));
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar configurações do tipo ${tipo}:`, error);
      throw error;
    }
  }

  // Salvar configuração
  async salvarConfiguracao(tipo, dados) {
    try {
      const payload = {
        tipo,
        dados
      };
      
      const response = await api.post(API_ENDPOINTS.configuracoes.base, payload);
      return response.data;
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      throw error;
    }
  }

  // Atualizar configuração
  async atualizarConfiguracao(tipo, dados) {
    try {
      const payload = {
        tipo,
        dados
      };
      
      const response = await api.put(`${API_ENDPOINTS.configuracoes.base}/${tipo}`, payload);
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      throw error;
    }
  }

  // Deletar configuração
  async deletarConfiguracao(tipo) {
    try {
      const response = await api.delete(`${API_ENDPOINTS.configuracoes.base}/${tipo}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao deletar configuração:', error);
      throw error;
    }
  }

  // Métodos específicos para cada tipo de configuração
  
  // Configurações Gerais
  async buscarConfiguracaoGeral() {
    return this.buscarConfiguracoesPorTipo('geral');
  }

  async salvarConfiguracaoGeral(dados) {
    return this.salvarConfiguracao('geral', dados);
  }

  // Configurações de Usuário
  async buscarConfiguracaoUsuario() {
    return this.buscarConfiguracoesPorTipo('usuario');
  }

  async salvarConfiguracaoUsuario(dados) {
    return this.salvarConfiguracao('usuario', dados);
  }

  // Configurações de Sistema
  async buscarConfiguracaoSistema() {
    return this.buscarConfiguracoesPorTipo('sistema');
  }

  async salvarConfiguracaoSistema(dados) {
    return this.salvarConfiguracao('sistema', dados);
  }

  // Configurações de Relatórios
  async buscarConfiguracaoRelatorios() {
    return this.buscarConfiguracoesPorTipo('relatorios');
  }

  async salvarConfiguracaoRelatorios(dados) {
    return this.salvarConfiguracao('relatorios', dados);
  }

  // Método para sincronizar com localStorage (fallback)
  async sincronizarComLocalStorage() {
    try {
      // Buscar configurações do backend
      const configuracoes = await this.buscarTodasConfiguracoes();
      
      if (configuracoes.success && configuracoes.data) {
        // Salvar no localStorage como backup
        Object.keys(configuracoes.data).forEach(tipo => {
          localStorage.setItem(`config_${tipo}`, JSON.stringify(configuracoes.data[tipo]));
        });
      }
      
      return configuracoes;
    } catch (error) {
      console.warn('Erro ao sincronizar com backend, usando localStorage:', error);
      
      // Fallback para localStorage
      const configLocal = {
        geral: JSON.parse(localStorage.getItem('config_geral') || '{}'),
        usuario: JSON.parse(localStorage.getItem('config_usuario') || '{}'),
        sistema: JSON.parse(localStorage.getItem('config_sistema') || '{}'),
        relatorios: JSON.parse(localStorage.getItem('config_relatorios') || '{}')
      };
      
      return {
        success: true,
        data: configLocal,
        source: 'localStorage'
      };
    }
  }

  // Método para testar conectividade com o backend
  async testarConectividade() {
    try {
      const response = await api.get(API_ENDPOINTS.health);
      return response.data;
    } catch (error) {
      console.error('Backend não está disponível:', error);
      return { success: false, error: error.message };
    }
  }
}

// Exportar instância única do serviço
const configuracoesService = new ConfiguracoesService();
export default configuracoesService;

// Exportar também a classe para casos específicos
export { ConfiguracoesService };