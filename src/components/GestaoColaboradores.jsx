import React, { useState, useEffect } from 'react';

const GestaoColaboradores = () => {
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cargo: ''
  });
  const [senhaTemporaria, setSenhaTemporaria] = useState('');

  useEffect(() => {
    carregarColaboradores();
  }, []);

  const carregarColaboradores = async () => {
    try {
      setLoading(true);
      const saved = JSON.parse(localStorage.getItem('colaboradores') || '[]');
      setColaboradores(saved);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
      setError('Erro ao carregar colaboradores');
    } finally {
      setLoading(false);
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
    setError('');
    setSuccess('');
    
    if (!formData.nome || !formData.email) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      const novo = { ...formData, id: crypto.randomUUID(), status: 'ativo' };
      const saved = JSON.parse(localStorage.getItem('colaboradores') || '[]');
      saved.push(novo);
      localStorage.setItem('colaboradores', JSON.stringify(saved));
      setSenhaTemporaria('temp1234');
      setSuccess('Colaborador criado com sucesso!');
      setFormData({ nome: '', email: '', telefone: '', cargo: '' });
      carregarColaboradores();
    } catch (error) {
      console.error('Erro ao criar colaborador:', error);
      setError('Erro ao criar colaborador');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '20px'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '30px'
    },
    title: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#1f2937'
    },
    addButton: {
      backgroundColor: '#10b981',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 24px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.3s ease'
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      padding: '30px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      marginBottom: '20px'
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
    buttonGroup: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'flex-end'
    },
    submitButton: {
      backgroundColor: '#10b981',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 24px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer'
    },
    cancelButton: {
      backgroundColor: '#6b7280',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 24px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '20px'
    },
    th: {
      backgroundColor: '#f9fafb',
      padding: '12px',
      textAlign: 'left',
      fontWeight: '600',
      color: '#374151',
      borderBottom: '2px solid #e5e7eb'
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #e5e7eb',
      color: '#6b7280'
    },
    status: {
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: '600'
    },
    statusAtivo: {
      backgroundColor: '#d1fae5',
      color: '#065f46'
    },
    alert: {
      padding: '12px 16px',
      borderRadius: '8px',
      marginBottom: '20px',
      fontWeight: '500'
    },
    alertError: {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      border: '1px solid #fecaca'
    },
    alertSuccess: {
      backgroundColor: '#f0fdf4',
      color: '#16a34a',
      border: '1px solid #bbf7d0'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: '#6b7280'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Gestão de Colaboradores</h1>
        <button 
          style={styles.addButton}
          onClick={() => setShowForm(!showForm)}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
        >
          {showForm ? 'Cancelar' : '+ Adicionar Colaborador'}
        </button>
      </div>

      {error && (
        <div style={{...styles.alert, ...styles.alertError}}>
          {error}
        </div>
      )}

      {success && (
        <div style={{...styles.alert, ...styles.alertSuccess}}>
          {success}
          {senhaTemporaria && (
            <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px'}}>
              <strong>⚠️ Importante:</strong> Anote a senha temporária e compartilhe com o colaborador. 
              Ele deverá alterá-la no primeiro login.
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div style={styles.card}>
          <h2 style={{marginBottom: '20px', color: '#1f2937'}}>Novo Colaborador</h2>
          <form onSubmit={handleSubmit}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Nome *</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  style={styles.input}
                  required
                />
              </div>
              
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
                <label style={styles.label}>Telefone</label>
                <input
                  type="tel"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Cargo</label>
                <input
                  type="text"
                  name="cargo"
                  value={formData.cargo}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>
            </div>
            
            <div style={styles.buttonGroup}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Criando...' : 'Criar Colaborador'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={styles.card}>
        <h2 style={{marginBottom: '20px', color: '#1f2937'}}>Colaboradores Ativos</h2>
        
        {loading && !showForm ? (
          <div style={styles.emptyState}>Carregando colaboradores...</div>
        ) : colaboradores.length === 0 ? (
          <div style={styles.emptyState}>
            <p>Nenhum colaborador cadastrado ainda.</p>
            <p>Clique em "Adicionar Colaborador" para começar.</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nome</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Cargo</th>
                <th style={styles.th}>Telefone</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Data de Criação</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores.map((colaborador) => (
                <tr key={colaborador.id}>
                  <td style={styles.td}>{colaborador.nome}</td>
                  <td style={styles.td}>{colaborador.email}</td>
                  <td style={styles.td}>{colaborador.cargo || '-'}</td>
                  <td style={styles.td}>{colaborador.telefone || '-'}</td>
                  <td style={styles.td}>
                    <span style={{...styles.status, ...styles.statusAtivo}}>
                      {colaborador.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {new Date(colaborador.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default GestaoColaboradores;