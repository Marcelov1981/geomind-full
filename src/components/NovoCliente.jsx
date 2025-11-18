import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from './Modal';
import CepService from '../utils/CepService';
import { useProject } from '../hooks/useProject';
import { API_ENDPOINTS } from '../config/api';

const NovoCliente = ({ isOpen, onClose, onClienteCreated }) => {
  const { getProjectDataForForm, updateProjectData, hasActiveProject } = useProject();
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    documento: '',
    tipo_pessoa: 'fisica', // fisica ou juridica
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    registroProfissional: '',
    tipoRegistro: '',
    observacoes: '',
    status: 'ativo'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [buscaReversaLoading, setBuscaReversaLoading] = useState(false);

  // Preencher dados do projeto quando o modal abrir
  useEffect(() => {
    if (isOpen && hasActiveProject) {
      const projectData = getProjectDataForForm('cliente');
      if (Object.keys(projectData).length > 0) {
        setFormData(projectData);
      }
    } else if (isOpen && !hasActiveProject) {
      // Reset form se não há projeto ativo
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        documento: '',
        tipo_pessoa: 'fisica',
        endereco: '',
        cidade: '',
        estado: '',
        cep: '',
        registroProfissional: '',
        tipoRegistro: '',
        observacoes: '',
        status: 'ativo'
      });
    }
  }, [isOpen, hasActiveProject, getProjectDataForForm]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Formatar CEP automaticamente
    if (name === 'cep') {
      const cepFormatado = CepService.formatarCep(value);
      setFormData(prev => ({
        ...prev,
        [name]: cepFormatado
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const buscarEnderecoPorCep = async () => {
    if (!formData.cep || !CepService.validarCep(formData.cep)) {
      alert('Por favor, digite um CEP válido');
      return;
    }
    
    setCepLoading(true);
    
    try {
      const resultado = await CepService.buscarEnderecoPorCep(formData.cep);
      
      if (resultado.success) {
        setFormData(prev => ({
          ...prev,
          endereco: resultado.data.endereco,
          cidade: resultado.data.cidade,
          estado: resultado.data.estado
        }));
        alert('Endereço encontrado e preenchido automaticamente!');
      } else {
        alert(`Erro ao buscar CEP: ${resultado.error}`);
      }
    } catch {
      alert('Erro ao buscar endereço. Tente novamente.');
    } finally {
      setCepLoading(false);
    }
  };

  const buscarCepPorEndereco = async () => {
    if (!formData.endereco || !formData.cidade || !formData.estado) {
      alert('Por favor, preencha endereço, cidade e estado para buscar o CEP');
      return;
    }
    
    if (formData.endereco.length < 3 || formData.cidade.length < 3) {
      alert('Endereço e cidade devem ter pelo menos 3 caracteres');
      return;
    }
    
    setBuscaReversaLoading(true);
    
    try {
      const resultado = await CepService.buscarCepPorEndereco(
        formData.estado,
        formData.cidade,
        formData.endereco
      );
      
      if (resultado.success && resultado.data.length > 0) {
        
        if (resultado.data.length === 1) {
          // Se encontrou apenas um resultado, preenche automaticamente
          setFormData(prev => ({
            ...prev,
            cep: resultado.data[0].cep
          }));
          alert('CEP encontrado e preenchido automaticamente!');
        } else {
          // Se encontrou múltiplos resultados, mostra para o usuário escolher
          const opcoes = resultado.data.map((item, index) => 
            `${index + 1}. ${item.cep} - ${item.endereco}, ${item.bairro}`
          ).join('\n');
          
          const escolha = prompt(
            `Encontrados ${resultado.data.length} CEPs. Escolha um número:\n\n${opcoes}`
          );
          
          const indice = parseInt(escolha) - 1;
          if (indice >= 0 && indice < resultado.data.length) {
            setFormData(prev => ({
              ...prev,
              cep: resultado.data[indice].cep
            }));
            alert('CEP selecionado e preenchido!');
          }
        }
      } else {
        alert(`Erro ao buscar CEP: ${resultado.error || 'Nenhum CEP encontrado'}`);
      }
    } catch {
      alert('Erro ao buscar CEP. Tente novamente.');
    } finally {
      setBuscaReversaLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        API_ENDPOINTS.clientes.base,
        formData,
        {}
      );
      
      // Salvar dados do cliente no contexto se há projeto ativo
      if (hasActiveProject) {
        updateProjectData('cliente', { ...formData, id: response.data.id });
      }
      
      // Reset form
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        documento: '',
        tipo_pessoa: 'fisica',
        endereco: '',
        cidade: '',
        estado: '',
        cep: '',
        registroProfissional: '',
        tipoRegistro: '',
        observacoes: '',
        status: 'ativo'
      });
      
      // Callback para atualizar lista
      if (onClienteCreated) {
        onClienteCreated(response.data);
      }
      
      onClose();
    } catch (err) {
      console.error('Erro ao criar cliente:', err);
      setError('Erro ao criar cliente. Tente novamente.');
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
    row: {
      display: 'flex',
      gap: '16px',
      flexWrap: 'wrap'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minWidth: '200px'
    },
    label: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '6px'
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
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '14px',
      resize: 'vertical',
      minHeight: '80px',
      outline: 'none'
    },
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '24px'
    },
    button: {
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      border: 'none',
      transition: 'all 0.2s'
    },
    cancelButton: {
      backgroundColor: '#f3f4f6',
      color: '#374151'
    },
    submitButton: {
      backgroundColor: '#10b981',
      color: 'white'
    },
    error: {
      color: '#dc2626',
      fontSize: '14px',
      padding: '12px',
      backgroundColor: '#fef2f2',
      borderRadius: '8px',
      border: '1px solid #fecaca'
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Cliente">
      <form onSubmit={handleSubmit} style={styles.form}>
        {error && <div style={styles.error}>{error}</div>}
        
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Nome Completo *</label>
            <input
              type="text"
              name="nome"
              value={formData.nome}
              onChange={handleInputChange}
              style={styles.input}
              required
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tipo de Pessoa *</label>
            <select
              name="tipo_pessoa"
              value={formData.tipo_pessoa}
              onChange={handleInputChange}
              style={styles.select}
              required
            >
              <option value="fisica">Pessoa Física</option>
              <option value="juridica">Pessoa Jurídica</option>
            </select>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              style={styles.input}
              required
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Telefone *</label>
            <input
              type="tel"
              name="telefone"
              value={formData.telefone}
              onChange={handleInputChange}
              style={styles.input}
              required
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            {formData.tipo_pessoa === 'fisica' ? 'CPF *' : 'CNPJ *'}
          </label>
          <input
            type="text"
            name="documento"
            value={formData.documento}
            onChange={handleInputChange}
            style={styles.input}
            required
            onFocus={(e) => e.target.style.borderColor = '#10b981'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Endereço *</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              name="endereco"
              value={formData.endereco}
              onChange={handleInputChange}
              style={{ ...styles.input, flex: 1 }}
              required
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <button
              type="button"
              onClick={buscarCepPorEndereco}
              disabled={buscaReversaLoading || !formData.endereco || !formData.cidade || !formData.estado}
              style={{
                ...styles.button,
                backgroundColor: buscaReversaLoading ? '#9ca3af' : '#3b82f6',
                cursor: buscaReversaLoading ? 'not-allowed' : 'pointer',
                padding: '8px 16px',
                fontSize: '14px',
                minWidth: '100px'
              }}
              title="Use apenas se não souber o CEP do imóvel"
            >
              {buscaReversaLoading ? 'Buscando...' : 'Buscar CEP'}
            </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Ou preencha endereço, cidade e estado e clique em "Buscar CEP" se não souber o CEP</p>
            </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Cidade *</label>
            <input
              type="text"
              name="cidade"
              value={formData.cidade}
              onChange={handleInputChange}
              style={styles.input}
              required
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Estado *</label>
            <input
              type="text"
              name="estado"
              value={formData.estado}
              onChange={handleInputChange}
              style={styles.input}
              required
              maxLength="2"
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>CEP *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                name="cep"
                value={formData.cep}
                onChange={handleInputChange}
                style={{ ...styles.input, flex: 1 }}
                required
                placeholder="00000-000"
                maxLength="9"
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <button
                type="button"
                onClick={buscarEnderecoPorCep}
                disabled={cepLoading || !formData.cep || !CepService.validarCep(formData.cep)}
                style={{
                  ...styles.button,
                  backgroundColor: cepLoading ? '#9ca3af' : '#10b981',
                  cursor: cepLoading ? 'not-allowed' : 'pointer',
                  padding: '8px 16px',
                  fontSize: '14px',
                  minWidth: '80px'
                }}
              >
                {cepLoading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Digite o CEP e clique em "Buscar" para preencher automaticamente o endereço
            </p>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tipo de Registro Profissional</label>
            <select
              name="tipoRegistro"
              value={formData.tipoRegistro}
              onChange={handleInputChange}
              style={styles.select}
            >
              <option value="">Selecione o tipo</option>
              <option value="CREA">CREA - Conselho Regional de Engenharia e Agronomia</option>
              <option value="CAU">CAU - Conselho de Arquitetura e Urbanismo</option>
              <option value="CRECI">CRECI - Conselho Regional de Corretores de Imóveis</option>
              <option value="IBAPE">IBAPE - Instituto Brasileiro de Avaliações e Perícias</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Número do Registro</label>
            <input
              type="text"
              name="registroProfissional"
              value={formData.registroProfissional}
              onChange={handleInputChange}
              style={styles.input}
              placeholder="Ex: 123456789-0"
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Observações</label>
          <textarea
            name="observacoes"
            value={formData.observacoes}
            onChange={handleInputChange}
            style={styles.textarea}
            placeholder="Informações adicionais sobre o cliente..."
            onFocus={(e) => e.target.style.borderColor = '#10b981'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>

        <div style={styles.buttonGroup}>
          <button
            type="button"
            onClick={onClose}
            style={{ ...styles.button, ...styles.cancelButton }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#e5e7eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#f3f4f6'}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{ 
              ...styles.button, 
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1
            }}
            onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#059669')}
            onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#10b981')}
          >
            {loading ? 'Criando...' : 'Criar Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default NovoCliente;