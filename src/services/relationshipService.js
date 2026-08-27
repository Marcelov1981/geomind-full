import api, { API_ENDPOINTS } from '../config/api';

const cache = new Map();
const TTL = 30000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > TTL) { cache.delete(key); return null; }
  return entry.v;
}

function setCached(key, value) {
  cache.set(key, { v: value, t: Date.now() });
}

async function getCachedOrFetch(key, request) {
  const cached = getCached(key);
  if (cached) return cached;
  const value = await request();
  setCached(key, value);
  return value;
}

function invalidateCache(...keys) {
  keys.forEach((key) => cache.delete(key));
}

function sameId(left, right) {
  if (left === null || left === undefined || right === null || right === undefined) return false;
  return String(left) === String(right);
}

function normalizeId(doc) {
  if (!doc) return doc;
  const id = doc.id ?? doc._id;
  return { id, ...doc };
}

function normalizeOrcamento(doc) {
  if (!doc) return doc;
  const id = doc.id ?? doc._id;
  const valor = doc.valor ?? doc.valorEstimado;
  const projetoId = doc.projeto_id ?? doc.projetoId;
  return { id, valorEstimado: valor, projeto_id: projetoId, ...doc };
}

/**
 * Serviço para gerenciar relacionamentos entre entidades do sistema
 */
class RelationshipService {
  /**
   * Busca projeto com seus orçamentos e avaliações relacionados
   */
  async getProjectWithRelations(projectId) {
    try {
      const pKey = `projetos:${projectId}`;
      const oKey = `orcamentos:list`;
      const [projectResponse, orcamentosResponse] = await Promise.all([
        getCachedOrFetch(pKey, () => api.get(`${API_ENDPOINTS.projetos.base}/${projectId}`)),
        getCachedOrFetch(oKey, () => api.get(API_ENDPOINTS.orcamentos.base))
      ]);

      const project = normalizeId(projectResponse.data?.data ?? projectResponse.data);
      const allOrcamentos = (orcamentosResponse.data?.data ?? orcamentosResponse.data ?? []).map(normalizeOrcamento);
      let allAvaliacoes = [];
      try {
        const aKey = `avaliacoes:list`;
        const avaliacoesResponse = await getCachedOrFetch(aKey, () => api.get(API_ENDPOINTS.avaliacoes.base));
        allAvaliacoes = avaliacoesResponse.data?.data ?? avaliacoesResponse.data ?? [];
      } catch {
        allAvaliacoes = [];
      }

      // Filtrar orçamentos do projeto
      const projectOrcamentos = allOrcamentos.filter(o => sameId(
        o.projeto_id ?? o.projetoId,
        project.id ?? projectId
      ));
      
      // Filtrar avaliações do projeto
      const projectAvaliacoes = allAvaliacoes
        .map(normalizeId)
        .filter(a => sameId(
          a.projeto_id ?? a.projetoId,
          project.id ?? projectId
        ));

      return {
        ...project,
        orcamentos: projectOrcamentos,
        avaliacoes: projectAvaliacoes
      };
    } catch (error) {
      console.error('Erro ao buscar projeto com relacionamentos:', error);
      throw error;
    }
  }

  /**
   * Busca orçamento com projeto e avaliações relacionados
   */
  async getOrcamentoWithRelations(orcamentoId) {
    try {
      const oKey = `orcamentos:${orcamentoId}`;
      const pKey = `projetos:list`;
      const [orcamentoResponse, projetosResponse] = await Promise.all([
        getCachedOrFetch(oKey, () => api.get(`${API_ENDPOINTS.orcamentos.base}/${orcamentoId}`)),
        getCachedOrFetch(pKey, () => api.get(API_ENDPOINTS.projetos.base))
      ]);

      const orcamento = normalizeOrcamento(orcamentoResponse.data?.data ?? orcamentoResponse.data);
      const allProjetos = (projetosResponse.data?.data ?? projetosResponse.data ?? []).map(normalizeId);
      let allAvaliacoes = [];
      try {
        const aKey = `avaliacoes:list`;
        const avaliacoesResponse = await getCachedOrFetch(aKey, () => api.get(API_ENDPOINTS.avaliacoes.base));
        allAvaliacoes = avaliacoesResponse.data?.data ?? avaliacoesResponse.data ?? [];
      } catch {
        allAvaliacoes = [];
      }

      // Buscar projeto relacionado
      const relatedProject = allProjetos.find(p => sameId(
        p.id,
        orcamento.projeto_id ?? orcamento.projetoId
      ));
      
      // Filtrar avaliações do orçamento
      const orcamentoAvaliacoes = allAvaliacoes
        .map(normalizeId)
        .filter(a => sameId(
          a.orcamento_id ?? a.orcamentoId,
          orcamento.id ?? orcamentoId
        ));

      return {
        ...orcamento,
        projeto: relatedProject,
        avaliacoes: orcamentoAvaliacoes
      };
    } catch (error) {
      console.error('Erro ao buscar orçamento com relacionamentos:', error);
      throw error;
    }
  }

  /**
   * Busca avaliação com projeto e orçamento relacionados
   */
  async getAvaliacaoWithRelations(avaliacaoId) {
    try {
      const pKey = `projetos:list`;
      const oKey = `orcamentos:list`;
      const aKey = `avaliacoes:${avaliacaoId}`;
      const [projetosResponse, orcamentosResponse, avaliacaoResponse] = await Promise.all([
        getCachedOrFetch(pKey, () => api.get(API_ENDPOINTS.projetos.base)),
        getCachedOrFetch(oKey, () => api.get(API_ENDPOINTS.orcamentos.base)),
        getCachedOrFetch(aKey, () => api.get(`${API_ENDPOINTS.avaliacoes.base}/${avaliacaoId}`))
      ]);
      const avaliacao = normalizeId(avaliacaoResponse.data?.data ?? avaliacaoResponse.data);
      const allProjetos = (projetosResponse.data?.data ?? projetosResponse.data ?? []).map(normalizeId);
      const allOrcamentos = (orcamentosResponse.data?.data ?? orcamentosResponse.data ?? []).map(normalizeOrcamento);

      // Buscar projeto e orçamento relacionados
      const relatedProject = allProjetos.find(p => sameId(
        p.id,
        avaliacao.projeto_id ?? avaliacao.projetoId
      ));
      const relatedOrcamento = allOrcamentos.find(o => sameId(
        o.id,
        avaliacao.orcamento_id ?? avaliacao.orcamentoId
      ));

      return {
        ...avaliacao,
        projeto: relatedProject,
        orcamento: relatedOrcamento
      };
    } catch (error) {
      console.error('Erro ao buscar avaliação com relacionamentos:', error);
      throw error;
    }
  }

  /**
   * Busca todos os dados relacionados de um usuário
   */
  async getUserCompleteData() {
    try {
      const pKey = `projetos:list`;
      const cKey = `clientes:list`;
      const oKey = `orcamentos:list`;
      const [projetosResponse, clientesResponse, orcamentosResponse] = await Promise.all([
        getCachedOrFetch(pKey, () => api.get(API_ENDPOINTS.projetos.base)),
        getCachedOrFetch(cKey, () => api.get(API_ENDPOINTS.clientes.base)),
        getCachedOrFetch(oKey, () => api.get(API_ENDPOINTS.orcamentos.base))
      ]);

      const projetos = (projetosResponse.data?.data ?? projetosResponse.data ?? []).map(normalizeId);
      const clientes = (clientesResponse.data?.data ?? clientesResponse.data ?? []).map(normalizeId);
      const orcamentos = (orcamentosResponse.data?.data ?? orcamentosResponse.data ?? []).map(normalizeOrcamento);
      let avaliacoes = [];
      try {
        const aKey = `avaliacoes:list`;
        const avaliacoesResponse = await getCachedOrFetch(aKey, () => api.get(API_ENDPOINTS.avaliacoes.base));
        avaliacoes = avaliacoesResponse.data?.data ?? avaliacoesResponse.data ?? [];
      } catch {
        avaliacoes = [];
      }

      // Indexar relacionamentos uma vez para evitar filtros aninhados O(projetos x dados).
      const clientesById = new Map(clientes.map((cliente) => [String(cliente.id), cliente]));
      const orcamentosByProjeto = new Map();
      for (const orcamento of orcamentos) {
        const projectId = String(orcamento.projeto_id ?? orcamento.projetoId ?? '');
        const list = orcamentosByProjeto.get(projectId) || [];
        list.push(orcamento);
        orcamentosByProjeto.set(projectId, list);
      }
      const avaliacoesByProjeto = new Map();
      for (const avaliacao of avaliacoes.map(normalizeId)) {
        const projectId = String(avaliacao.projeto_id ?? avaliacao.projetoId ?? '');
        const list = avaliacoesByProjeto.get(projectId) || [];
        list.push(avaliacao);
        avaliacoesByProjeto.set(projectId, list);
      }

      const projectsWithRelations = projetos.map((projeto) => {
        const pid = String(projeto.id ?? '');
        const cid = String(projeto.cliente_id ?? projeto.clienteId ?? '');

        return {
          ...projeto,
          cliente: clientesById.get(cid),
          orcamentos: orcamentosByProjeto.get(pid) || [],
          avaliacoes: avaliacoesByProjeto.get(pid) || []
        };
      });

      return {
        projetos: projectsWithRelations,
        clientes,
        orcamentos,
        avaliacoes
      };
    } catch (error) {
      console.error('Erro ao buscar dados completos do usuário:', error);
      throw error;
    }
  }

  /**
   * Cria um novo orçamento associado a um projeto
   */
  async createOrcamentoForProject(projectId, orcamentoData) {
    try {
      const response = await api.post(API_ENDPOINTS.orcamentos.base, {
        ...orcamentoData,
        projetoId: projectId
      });
      invalidateCache('orcamentos:list');
      return response.data;
    } catch (error) {
      console.error('Erro ao criar orçamento para projeto:', error);
      throw error;
    }
  }

  /**
   * Cria uma nova avaliação associada a um projeto e orçamento
   */
  async createAvaliacaoForOrcamento(projectId, orcamentoId, avaliacaoData) {
    try {
      const response = await api.post(API_ENDPOINTS.avaliacoes.base, {
        ...avaliacaoData,
        projetoId: projectId,
        orcamentoId: orcamentoId
      });
      invalidateCache('avaliacoes:list');
      return response.data;
    } catch (error) {
      console.error('Erro ao criar avaliação para orçamento:', error);
      throw error;
    }
  }

  /**
    * Cria uma nova avaliação com todos os relacionamentos
    */
   async createEvaluationWithRelations(evaluationData) {
     try {
        const response = await api.post(API_ENDPOINTS.avaliacoes.base, evaluationData);
        
        if (response.data.success) {
          // Buscar dados relacionados para retornar avaliação completa
          const completeEvaluation = await this.getAvaliacaoWithRelations(response.data.data.id);
          return {
            ...response,
            data: {
              ...response.data,
              data: completeEvaluation
            }
          };
        }
        
        return response;
      } catch (error) {
        console.error('Erro ao criar avaliação com relacionamentos:', error);
        throw error;
      }
    }

   /**
    * Cria um novo cliente com relacionamentos
    */
   async createClientWithRelations(clientData) {
     try {
      const response = await api.post(API_ENDPOINTS.clientes.base, clientData);
      invalidateCache('clientes:list');
      return response;
     } catch (error) {
       console.error('Erro ao criar cliente:', error);
       throw error;
     }
   }

   /**
    * Cria um novo projeto com relacionamentos
    */
   async createProjectWithRelations(projectData) {
     try {
      const response = await api.post(API_ENDPOINTS.projetos.base, projectData);
      invalidateCache('projetos:list');
      return response;
     } catch (error) {
       console.error('Erro ao criar projeto:', error);
       throw error;
     }
   }

  /**
   * Busca estatísticas de relacionamentos
   */
  async getRelationshipStats() {
    try {
      const data = await this.getUserCompleteData();
      
      const stats = {
        totalProjetos: data.projetos.length,
        totalClientes: data.clientes.length,
        totalOrcamentos: data.orcamentos.length,
        totalAvaliacoes: data.avaliacoes.length,
        projetosComOrcamentos: data.projetos.filter(p => p.orcamentos.length > 0).length,
        projetosComAvaliacoes: data.projetos.filter(p => p.avaliacoes.length > 0).length,
        orcamentosSemAvaliacoes: data.orcamentos.filter(o => 
          !data.avaliacoes.some(a => sameId(a.orcamento_id ?? a.orcamentoId, o.id))
        ).length
      };

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas de relacionamentos:', error);
      throw error;
    }
  }
}

export default new RelationshipService();
