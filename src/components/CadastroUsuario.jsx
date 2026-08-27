import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CepService from '../utils/CepService';

const CadastroUsuario = ({ onNavigateToPlanos, onRegistered }) => {
  const { register } = useAuth();
  const [tipoUsuario, setTipoUsuario] = useState('pessoa_fisica'); // pessoa_fisica ou pessoa_juridica
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showFormasPagamento, setShowFormasPagamento] = useState(false);
  
  const [formData, setFormData] = useState({
    // Dados pessoais/empresa
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    inscricaoEstadual: '',
    
    // Endereço
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    
    // Dados de acesso
    senha: '',
    confirmarSenha: '',
    
    // Configurações corporativas (apenas para CNPJ)
    precisaSubacessos: false,
    numeroColaboradores: 1,
    nomeResponsavel: '',
    cargoResponsavel: '',
    
    // Termos
    aceitaTermos: false,
    aceitaPrivacidade: false
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Formatar CEP automaticamente
    if (name === 'cep') {
      const cepFormatado = CepService.formatarCep(value);
      setFormData(prev => ({
        ...prev,
        [name]: cepFormatado
      }));
      
      // Buscar endereço automaticamente quando CEP estiver completo
      const cepLimpo = CepService.limparCep(cepFormatado);
      if (cepLimpo.length === 8 && CepService.validarCep(cepLimpo)) {
        buscarEnderecoPorCep(cepLimpo);
      }
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const buscarEnderecoPorCep = async (cep) => {
    try {
      const resultado = await CepService.buscarEnderecoPorCep(cep);
      
      if (resultado.success) {
        setFormData(prev => ({
          ...prev,
          endereco: resultado.data.endereco,
          bairro: resultado.data.bairro,
          cidade: resultado.data.cidade,
          estado: resultado.data.estado
        }));
      } else {
        console.error('Erro ao buscar CEP:', resultado.error);
      }
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
    }
  };

  const validarFormulario = () => {
    if (!formData.nome || !formData.email || !formData.telefone) {
      setError('Preencha todos os campos obrigatórios');
      return false;
    }
    
    if (tipoUsuario === 'pessoa_fisica' && !formData.cpf) {
      setError('CPF é obrigatório para pessoa física');
      return false;
    }
    
    if (tipoUsuario === 'pessoa_juridica' && (!formData.cnpj || !formData.razaoSocial)) {
      setError('CNPJ e Razão Social são obrigatórios para pessoa jurídica');
      return false;
    }
    
    if (tipoUsuario === 'pessoa_juridica' && !formData.nomeResponsavel) {
      setError('Nome do responsável é obrigatório para pessoa jurídica');
      return false;
    }
    
    if (tipoUsuario === 'pessoa_juridica' && formData.precisaSubacessos && formData.numeroColaboradores < 1) {
      setError('Número de colaboradores deve ser pelo menos 1');
      return false;
    }
    
    if (formData.senha !== formData.confirmarSenha) {
      setError('Senhas não conferem');
      return false;
    }
    
    if (!formData.aceitaTermos || !formData.aceitaPrivacidade) {
      setError('Você deve aceitar os termos de uso e política de privacidade');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validarFormulario()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const dadosEnvio = {
        name: formData.nomeResponsavel || formData.nome,
        email: formData.email,
        password: formData.senha,
        organization_name: tipoUsuario === 'pessoa_juridica'
          ? (formData.razaoSocial || formData.nomeFantasia)
          : formData.nome,
      };

      const response = await register(dadosEnvio);
      if (onRegistered) {
        onRegistered(response);
      } else {
        setSuccess('Usuário cadastrado com sucesso! A sessão já está ativa.');
        setShowFormasPagamento(true);
      }
      
    } catch (error) {
      console.error('Erro ao cadastrar usuário:', error);
      setError(error.response?.data?.error || error.response?.data?.message || 'Erro ao cadastrar usuário');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px'
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '30px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      marginBottom: '20px'
    },
    tipoSelector: {
      display: 'flex',
      gap: '15px',
      marginBottom: '30px'
    },
    tipoButton: {
      flex: 1,
      padding: '15px',
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      backgroundColor: '#ffffff',
      cursor: 'pointer',
      textAlign: 'center',
      fontWeight: '600',
      transition: 'all 0.3s ease'
    },
    tipoButtonActive: {
      borderColor: '#10b981',
      backgroundColor: '#f0fdf4',
      color: '#10b981'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '20px',
      marginBottom: '20px'
    },
    formGroup: {
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      marginBottom: '8px',
      fontWeight: '600',
      color: '#374151'
    },
    input: {
      width: '100%',
      padding: '12px',
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '16px',
      transition: 'border-color 0.3s ease',
      boxSizing: 'border-box'
    },
    inputFocus: {
      borderColor: '#10b981',
      outline: 'none'
    },
    checkboxGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '15px'
    },
    checkbox: {
      width: '18px',
      height: '18px',
      marginRight: '8px'
    },
    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      fontWeight: '600',
      color: '#374151',
      cursor: 'pointer',
      marginBottom: '8px'
    },
    helpText: {
      fontSize: '14px',
      color: '#6b7280',
      marginTop: '5px',
      lineHeight: '1.4'
    },
    submitButton: {
      width: '100%',
      padding: '15px',
      backgroundColor: '#10b981',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.3s ease'
    },
    submitButtonDisabled: {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed'
    },
    error: {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid #fecaca'
    },
    success: {
      backgroundColor: '#f0fdf4',
      color: '#16a34a',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid #bbf7d0'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '20px',
      borderBottom: '2px solid #e5e7eb',
      paddingBottom: '10px'
    }
  };

  if (showFormasPagamento) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Cadastro Realizado com Sucesso!</h2>
          <div style={styles.success}>
            {success}
          </div>
          <p style={{ marginBottom: '20px' }}>Agora você pode:</p>
          <ul style={{ marginBottom: '30px', paddingLeft: '20px' }}>
            <li>Configurar suas formas de pagamento</li>
            <li>Escolher um plano de assinatura</li>
            <li>Começar a usar o GeoMind</li>
          </ul>
          <button
            style={styles.submitButton}
            onClick={() => {
              if (onNavigateToPlanos) {
                // Passar número de colaboradores para planos corporativos
                const dadosNavegacao = tipoUsuario === 'pessoa_juridica' && formData.precisaSubacessos 
                  ? { numeroColaboradores: formData.numeroColaboradores }
                  : {};
                onNavigateToPlanos(dadosNavegacao);
              } else {
                window.location.reload();
              }
            }}
          >
            Escolher Plano de Assinatura
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Tipo de Usuário</h2>
        <div style={styles.tipoSelector}>
          <button
            type="button"
            style={{
              ...styles.tipoButton,
              ...(tipoUsuario === 'pessoa_fisica' ? styles.tipoButtonActive : {})
            }}
            onClick={() => setTipoUsuario('pessoa_fisica')}
          >
            Pessoa Física
          </button>
          <button
            type="button"
            style={{
              ...styles.tipoButton,
              ...(tipoUsuario === 'pessoa_juridica' ? styles.tipoButtonActive : {})
            }}
            onClick={() => setTipoUsuario('pessoa_juridica')}
          >
            Pessoa Jurídica
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <h3 style={styles.sectionTitle}>
            {tipoUsuario === 'pessoa_fisica' ? 'Dados Pessoais' : 'Dados da Empresa'}
          </h3>
          
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                {tipoUsuario === 'pessoa_fisica' ? 'Nome Completo *' : 'Razão Social *'}
              </label>
              <input
                type="text"
                name={tipoUsuario === 'pessoa_fisica' ? 'nome' : 'razaoSocial'}
                value={tipoUsuario === 'pessoa_fisica' ? formData.nome : formData.razaoSocial}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
            </div>

            {tipoUsuario === 'pessoa_juridica' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Nome Fantasia</label>
                <input
                  type="text"
                  name="nomeFantasia"
                  value={formData.nomeFantasia}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                style={styles.input}
                required
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
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {tipoUsuario === 'pessoa_fisica' ? 'CPF *' : 'CNPJ *'}
              </label>
              <input
                type="text"
                name={tipoUsuario === 'pessoa_fisica' ? 'cpf' : 'cnpj'}
                value={tipoUsuario === 'pessoa_fisica' ? formData.cpf : formData.cnpj}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
            </div>

            {tipoUsuario === 'pessoa_juridica' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Inscrição Estadual</label>
                <input
                  type="text"
                  name="inscricaoEstadual"
                  value={formData.inscricaoEstadual}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>
            )}
          </div>

          {tipoUsuario === 'pessoa_juridica' && (
            <>
              <h3 style={styles.sectionTitle}>Configurações Corporativas</h3>
              
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Nome do Responsável *</label>
                  <input
                    type="text"
                    name="nomeResponsavel"
                    value={formData.nomeResponsavel}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="Nome completo do responsável pela conta"
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Cargo do Responsável</label>
                  <input
                    type="text"
                    name="cargoResponsavel"
                    value={formData.cargoResponsavel}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder="Ex: Diretor, Gerente, Sócio"
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="precisaSubacessos"
                    checked={formData.precisaSubacessos}
                    onChange={handleInputChange}
                    style={styles.checkbox}
                  />
                  Preciso de subacessos para colaboradores
                </label>
                <p style={styles.helpText}>
                  Marque esta opção se você precisar dar acesso ao sistema para outros colaboradores da sua empresa.
                </p>
              </div>

              {formData.precisaSubacessos && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Número de Colaboradores (máximo 20) *</label>
                  <select
                    name="numeroColaboradores"
                    value={formData.numeroColaboradores}
                    onChange={handleInputChange}
                    style={styles.input}
                    required
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'colaborador' : 'colaboradores'}
                      </option>
                    ))}
                  </select>
                  <p style={styles.helpText}>
                    O valor da assinatura será calculado baseado no número de colaboradores selecionado.
                  </p>
                </div>
              )}
            </>
          )}

          <h3 style={styles.sectionTitle}>Endereço</h3>
          
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>CEP</label>
              <input
                type="text"
                name="cep"
                value={formData.cep}
                onChange={handleInputChange}
                style={styles.input}
                maxLength="9"
                placeholder="12345-678"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Endereço</label>
              <input
                type="text"
                name="endereco"
                value={formData.endereco}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Número</label>
              <input
                type="text"
                name="numero"
                value={formData.numero}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Complemento</label>
              <input
                type="text"
                name="complemento"
                value={formData.complemento}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Bairro</label>
              <input
                type="text"
                name="bairro"
                value={formData.bairro}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Cidade</label>
              <input
                type="text"
                name="cidade"
                value={formData.cidade}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Estado</label>
              <input
                type="text"
                name="estado"
                value={formData.estado}
                onChange={handleInputChange}
                style={styles.input}
                maxLength="2"
              />
            </div>
          </div>

          <h3 style={styles.sectionTitle}>Dados de Acesso</h3>
          
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Senha *</label>
              <input
                type="password"
                name="senha"
                value={formData.senha}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Confirmar Senha *</label>
              <input
                type="password"
                name="confirmarSenha"
                value={formData.confirmarSenha}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
            </div>
          </div>

          <h3 style={styles.sectionTitle}>Termos e Condições</h3>
          
          <div style={styles.checkboxGroup}>
            <input
              type="checkbox"
              name="aceitaTermos"
              checked={formData.aceitaTermos}
              onChange={handleInputChange}
              style={styles.checkbox}
              required
            />
            <label>Aceito os termos de uso do GeoMind *</label>
          </div>

          <div style={styles.checkboxGroup}>
            <input
              type="checkbox"
              name="aceitaPrivacidade"
              checked={formData.aceitaPrivacidade}
              onChange={handleInputChange}
              style={styles.checkbox}
              required
            />
            <label>Aceito a política de privacidade *</label>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitButton,
              ...(loading ? styles.submitButtonDisabled : {})
            }}
          >
            {loading ? 'Cadastrando...' : 'Cadastrar Usuário'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CadastroUsuario;