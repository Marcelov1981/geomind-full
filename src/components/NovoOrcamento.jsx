import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import Modal from './Modal';
import { useProject } from '../hooks/useProject';
import ImageUpload from './ImageUpload';

const NovoOrcamento = ({ isOpen, onClose, onOrcamentoCreated }) => {
  const { projectData, updateProjectData } = useProject();
  
  const [formData, setFormData] = useState({
    projetoId: '',
    descricao: '',
    tipoAvaliacao: '',
    valorEstimado: '',
    prazoEntrega: '',
    metodologia: '',
    observacoes: ''
  });

  const [projetos, setProjetos] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingProjetos, setLoadingProjetos] = useState(false);

  const tiposAvaliacao = [
    'Avaliação para Financiamento',
    'Avaliação para Venda',
    'Avaliação para Aluguel',
    'Avaliação para Seguro',
    'Avaliação Judicial',
    'Avaliação para Garantia',
    'Reavaliação',
    'Laudo de Vistoria',
    'Parecer Técnico'
  ];

  const metodologias = [
    'Método Comparativo Direto',
    'Método da Renda',
    'Método do Custo',
    'Método Evolutivo',
    'Método Involutivo'
  ];

  useEffect(() => {
    if (isOpen) {
      fetchProjetos();
      
      // Preencher projeto ativo se existe
      if (projectData.projeto) {
        setFormData(prev => ({
          ...prev,
          projetoId: projectData.projeto._id || projectData.projeto.id || ''
        }));
      }
    }
  }, [isOpen, projectData.projeto]);

  const fetchProjetos = async () => {
    setLoadingProjetos(true);
    try {
      const projetosResponse = await axios.get(API_ENDPOINTS.projetos.base, { params: { t: Date.now() } });
      const projetosData = projetosResponse.data?.data || projetosResponse.data || [];

      const projetosComCliente = await Promise.all(
        projetosData.map(async (p) => {
          const clienteId = p.cliente_id || p.clienteId || p.cliente?.id;
          let clienteInfo = p.cliente || null;
          if (clienteId) {
            try {
              const res = await axios.get(API_ENDPOINTS.clientes.byId(clienteId), { params: { t: Date.now() } });
              const clienteData = res.data?.data || res.data || null;
              if (clienteData) {
                clienteInfo = { id: clienteData.id, nome: clienteData.nome };
              }
            } catch {
              return { ...p, cliente: clienteInfo };
            }
          }
          return { ...p, cliente: clienteInfo };
        })
      );

      setProjetos(projetosComCliente);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      setError('Erro ao carregar lista de projetos');
    } finally {
      setLoadingProjetos(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        API_ENDPOINTS.orcamentos.base,
        {
          ...formData,
          valorEstimado: parseFloat(formData.valorEstimado) || 0
        },
        {}
      );

      if (response.status === 201 || response.status === 200) {
        // Salvar orçamento no contexto
      updateProjectData('orcamento', { ...formData, id: response.data.id });
      
      // Reset form
      setFormData({
        projetoId: '',
        descricao: '',
        tipoAvaliacao: '',
        valorEstimado: '',
        prazoEntrega: '',
        metodologia: '',
        observacoes: ''
      });
      setImages([]);
        
        onOrcamentoCreated && onOrcamentoCreated();
        onClose();
      }
    } catch (error) {
      console.error('Erro ao criar orçamento:', error);
      setError(error.response?.data?.message || 'Erro ao criar orçamento');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    label: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151'
    },
    input: {
      padding: '12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      transition: 'border-color 0.2s',
      outline: 'none'
    },
    select: {
      padding: '12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      backgroundColor: 'white',
      cursor: 'pointer',
      outline: 'none'
    },
    textarea: {
      padding: '12px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
      minHeight: '80px',
      resize: 'vertical',
      fontFamily: 'inherit',
      outline: 'none'
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px'
    },
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '20px'
    },
    button: {
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      border: 'none'
    },
    cancelButton: {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      border: '1px solid #d1d5db'
    },
    submitButton: {
      backgroundColor: '#3b82f6',
      color: 'white'
    },
    error: {
      color: '#ef4444',
      fontSize: '14px',
      marginTop: '8px'
    },
    loading: {
      color: '#6b7280',
      fontSize: '14px',
      fontStyle: 'italic'
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Orçamento">
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projeto *</label>
          {loadingProjetos ? (
            <div style={styles.loading}>Carregando projetos...</div>
          ) : (
            <select
              name="projetoId"
              value={formData.projetoId}
              onChange={handleInputChange}
              style={styles.select}
              required
            >
              <option value="">Selecione um projeto</option>
              {projetos.map(projeto => (
                <option key={projeto._id || projeto.id} value={projeto._id || projeto.id}>
                  {projeto.nome} - {projeto.cliente?.nome || 'Cliente não informado'}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Descrição do Orçamento *</label>
          <input
            type="text"
            name="descricao"
            value={formData.descricao}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="Ex: Avaliação de apartamento para financiamento"
            required
          />
        </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tipo de Avaliação *</label>
            <select
              name="tipoAvaliacao"
              value={formData.tipoAvaliacao}
              onChange={handleInputChange}
              style={styles.select}
              required
            >
              <option value="">Selecione o tipo</option>
              {tiposAvaliacao.map(tipo => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Valor Estimado (R$) *</label>
            <input
              type="number"
              name="valorEstimado"
              value={formData.valorEstimado}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="0,00"
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Prazo de Entrega *</label>
            <input
              type="date"
              name="prazoEntrega"
              value={formData.prazoEntrega}
              onChange={handleInputChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Metodologia</label>
            <select
              name="metodologia"
              value={formData.metodologia}
              onChange={handleInputChange}
              style={styles.select}
            >
              <option value="">Selecione a metodologia</option>
              {metodologias.map(metodologia => (
                <option key={metodologia} value={metodologia}>{metodologia}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Observações</label>
          <textarea
            name="observacoes"
            value={formData.observacoes}
            onChange={handleInputChange}
            style={styles.textarea}
            placeholder="Informações adicionais sobre o orçamento..."
          />
        </div>

        <ImageUpload
          images={images}
          onImagesChange={setImages}
          maxImages={8}
          label="Anexar Documentos e Imagens"
        />

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.buttonGroup}>
          <button
            type="button"
            onClick={onClose}
            style={{...styles.button, ...styles.cancelButton}}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            style={{...styles.button, ...styles.submitButton}}
            disabled={loading}
          >
            {loading ? 'Criando...' : 'Criar Orçamento'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default NovoOrcamento;