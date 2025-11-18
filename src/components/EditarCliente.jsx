import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from './Modal';
import CepService from '../utils/CepService';
import { API_ENDPOINTS } from '../config/api';

const EditarCliente = ({ isOpen, onClose, onSuccess, cliente }) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf_cnpj: '',
    tipo_pessoa: 'fisica',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    registroProfissional: '',
    tipoRegistro: '',
    observacoes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (isOpen && cliente) {
      setFormData({
        nome: cliente.nome || '',
        email: cliente.email || '',
        telefone: cliente.telefone || '',
        cpf_cnpj: cliente.cpf_cnpj || '',
        tipo_pessoa: cliente.tipo_pessoa || 'fisica',
        endereco: cliente.endereco || '',
        cidade: cliente.cidade || '',
        estado: cliente.estado || '',
        cep: cliente.cep || '',
        registroProfissional: cliente.registroProfissional || '',
        tipoRegistro: cliente.tipoRegistro || '',
        observacoes: cliente.observacoes || ''
      });
    }
  }, [isOpen, cliente]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.put(
        `${API_ENDPOINTS.clientes.base}/${cliente.id}`,
        formData,
        {}
      );
      
      if (onSuccess) {
        onSuccess(response.data);
      }
      
      onClose();
    } catch (err) {
      setError('Erro ao atualizar cliente. Tente novamente.');
      console.error('Erro ao atualizar cliente:', err);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    row: {
      display: 'flex',
      gap: '16px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1
    },
    label: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '6px'
    },
    input: {
      padding: '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '14px',
      transition: 'border-color 0.2s'
    },
    select: {
      padding: '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '14px',
      backgroundColor: 'white',
      transition: 'border-color 0.2s'
    },
    textarea: {
      padding: '12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '14px',
      minHeight: '80px',
      resize: 'vertical',
      transition: 'border-color 0.2s'
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
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Cliente">
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
            name="cpf_cnpj"
            value={formData.cpf_cnpj}
            onChange={handleInputChange}
            style={styles.input}
            required
            onFocus={(e) => e.target.style.borderColor = '#10b981'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Endereço *</label>
          <input
            type="text"
            name="endereco"
            value={formData.endereco}
            onChange={handleInputChange}
            style={styles.input}
            required
            onFocus={(e) => e.target.style.borderColor = '#10b981'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
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
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tipo de Registro</label>
            <select
              name="tipoRegistro"
              value={formData.tipoRegistro}
              onChange={handleInputChange}
              style={styles.select}
            >
              <option value="">Selecione o tipo</option>
              <option value="CREA">CREA</option>
              <option value="CAU">CAU</option>
              <option value="CRECI">CRECI</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Registro Profissional</label>
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
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditarCliente;