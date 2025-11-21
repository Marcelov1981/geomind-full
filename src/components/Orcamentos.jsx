import { useEffect, useState } from "react";
import axios from "axios";
import { API_ENDPOINTS } from '../config/api';

function Orcamentos() {
  const [orcamentosList, setOrcamentosList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrcamentos = async () => {
      try {
        setLoading(true);
        setError(null);
        const [orcamentosResponse, projetosResponse, clientesResponse] = await Promise.all([
          axios.get(API_ENDPOINTS.orcamentos.base, { params: { t: Date.now() } }),
          axios.get(API_ENDPOINTS.projetos.base, { params: { t: Date.now() } }),
          axios.get(API_ENDPOINTS.clientes.base, { params: { t: Date.now() } })
        ]);
        const orcamentosData = orcamentosResponse.data?.data || orcamentosResponse.data || [];
        const projetosData = projetosResponse.data?.data || projetosResponse.data || [];
        const clientesData = clientesResponse.data?.data || clientesResponse.data || [];
        const projetosMap = new Map(projetosData.map(p => [p.id || p._id, p]));
        const clientesMap = new Map(clientesData.map(c => [c.id || c._id, c]));
        const enriched = orcamentosData.map(o => {
          const projetoId = o.projeto_id || o.projetoId || o.projeto?.id || o.projeto?._id;
          const projeto = projetoId ? projetosMap.get(projetoId) || o.projeto || null : o.projeto || null;
          const clienteId = o.cliente_id || o.clienteId || projeto?.cliente_id || projeto?.clienteId || projeto?.cliente?.id || projeto?.cliente?._id;
          const cliente = clienteId ? clientesMap.get(clienteId) || o.cliente || null : o.cliente || null;
          const valorRaw = o.valorEstimado ?? o.valor ?? o.valor_final;
          const valorFmt = (typeof valorRaw === 'number')
            ? valorRaw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : (typeof valorRaw === 'string' && valorRaw.trim() !== '' ? valorRaw : 'N/A');
          const prazoRaw = o.prazoEntrega || o.prazo_entrega;
          const prazoFmt = prazoRaw ? new Date(prazoRaw).toLocaleDateString('pt-BR') : 'N/A';
          return {
            ...o,
            projetoNome: projeto ? projeto.nome : undefined,
            clienteNome: cliente ? cliente.nome : undefined,
            projetoIdNorm: projetoId || '',
            descricaoNorm: o.descricao || o.nome || '',
            tipoAvaliacaoNorm: o.tipoAvaliacao || o.tipo_avaliacao || '',
            valorEstimadoNorm: valorFmt,
            prazoEntregaNorm: prazoFmt,
            metodologiaNorm: o.metodologia || o.metodologia_utilizada || o.metodo || '',
            observacoesNorm: o.observacoes || o.obs || ''
          };
        });
        setOrcamentosList(enriched);
      } catch {
        setError("Erro ao carregar orçamentos. Tente novamente mais tarde.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrcamentos();
  }, []);

  if (loading) {
    return (
      <tr>
        <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
          Carregando orçamentos...
        </td>
      </tr>
    );
  }

  if (error) {
    return (
      <tr>
        <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: '#dc2626' }}>
          {error}
        </td>
      </tr>
    );
  }

  return (
    <>
      {orcamentosList.map((orcamento, index) => (
        <tr key={index}>
          <td>{orcamento.projetoIdNorm || 'N/A'}</td>
          <td>{orcamento.descricaoNorm || 'N/A'}</td>
          <td>{orcamento.tipoAvaliacaoNorm || 'N/A'}</td>
          <td>{orcamento.valorEstimadoNorm}</td>
          <td>{orcamento.prazoEntregaNorm}</td>
          <td>{orcamento.metodologiaNorm || 'N/A'}</td>
          <td>{orcamento.observacoesNorm || 'N/A'}</td>
          <td>
            <span style={{
              background: orcamento.status === 'aprovado' ? '#dcfce7' : orcamento.status === 'pendente' ? '#fef3c7' : '#fee2e2',
              color: orcamento.status === 'aprovado' ? '#166534' : orcamento.status === 'pendente' ? '#92400e' : '#dc2626',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {orcamento.status || 'N/A'}
            </span>
          </td>
          <td>
            <button
              onClick={() => console.log('Editar orçamento:', orcamento.id || orcamento._id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#059669',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px'
              }}
            >
              Editar
            </button>
          </td>
        </tr>
      ))}
    </>
   );
}

export default Orcamentos;