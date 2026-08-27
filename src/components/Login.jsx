import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login = ({ onCreateAccount }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Não foi possível entrar. Confira seu e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: '24px' }}>
      <section style={{ width: '100%', maxWidth: '440px', background: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 18px 50px rgba(15, 23, 42, .12)' }}>
        <div style={{ marginBottom: '28px' }}>
          <div style={{ color: '#2563eb', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: '13px' }}>GeoMind</div>
          <h1 style={{ margin: '10px 0 8px', color: '#0f172a', fontSize: '32px' }}>Acessar plataforma</h1>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.5 }}>Entre para continuar sua avaliação imobiliária.</p>
        </div>
        {error && <div role="alert" style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 14px', borderRadius: '10px', marginBottom: '18px' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <label style={{ display: 'grid', gap: '7px', color: '#334155', fontWeight: 600 }}>
            E-mail
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '13px 14px', fontSize: '16px' }} />
          </label>
          <label style={{ display: 'grid', gap: '7px', color: '#334155', fontWeight: 600 }}>
            Senha
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '13px 14px', fontSize: '16px' }} />
          </label>
          <button disabled={loading} type="submit" style={{ border: 0, borderRadius: '10px', padding: '14px 16px', background: loading ? '#93c5fd' : '#2563eb', color: '#fff', fontWeight: 700, fontSize: '16px', cursor: loading ? 'wait' : 'pointer', marginTop: '8px' }}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p style={{ margin: '24px 0 0', textAlign: 'center', color: '#64748b' }}>
          Ainda não possui uma conta?{' '}
          <button type="button" onClick={onCreateAccount} style={{ border: 0, background: 'transparent', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Criar conta</button>
        </p>
      </section>
    </main>
  );
};

export default Login;
