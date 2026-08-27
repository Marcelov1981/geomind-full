import React, { useCallback, useMemo } from 'react';

const PRECO_COLABORADOR_ADICIONAL = Object.freeze({
  corporativo_basico: 15.90,
  corporativo_medio: 12.90,
  corporativo_avancado: 9.90
});

const PlanosAssinatura = ({ onNavigate, numeroColaboradores = 1 }) => {
  // Função para calcular preço dinâmico baseado no número de colaboradores
  const calcularPrecoColaboradores = useCallback((plano, numColaboradores) => {
    if (plano.tipo !== 'corporativo') return plano;
    
    const colaboradoresExtras = Math.max(0, numColaboradores - plano.maxColaboradores);
    const custoAdicional = colaboradoresExtras * PRECO_COLABORADOR_ADICIONAL[plano.id];
    const novoValor = plano.valor + custoAdicional;
    
    return {
      ...plano,
      preco: `R$ ${novoValor.toFixed(2).replace('.', ',')}`,
      valor: novoValor,
      colaboradoresExtras,
      custoAdicional,
      descricao: colaboradoresExtras > 0 
        ? `${plano.descricao} + ${colaboradoresExtras} colaborador(es) adicional(is)`
        : plano.descricao,
      recursos: colaboradoresExtras > 0
        ? [
            `Até ${numColaboradores} subacessos inclusos`,
            ...plano.recursos.slice(1)
          ]
        : plano.recursos
    };
  }, []);

  const planos = useMemo(() => [
    {
      id: 'mensal',
      nome: 'Plano Mensal',
      preco: 'R$ 99,90',
      periodo: '/mês',
      valor: 99.90,
      valorOriginal: 129.90,
      desconto: 23,
      duracao: '1 mês',
      descricao: 'Ideal para testes e projetos pontuais',
      recursos: [
        'Até 50 análises por mês',
        'Relatórios básicos',
        'Suporte por email',
        'Acesso a todas as ferramentas básicas'
      ],
      cor: '#3b82f6',
      popular: false
    },
    {
      id: 'trimestral',
      nome: 'Plano Trimestral',
      preco: 'R$ 249,90',
      periodo: '/3 meses',
      valor: 249.90,
      valorOriginal: 389.70,
      desconto: 36,
      duracao: '3 meses',
      descricao: 'Melhor custo-benefício para projetos de médio prazo',
      recursos: [
        'Até 200 análises por mês',
        'Relatórios avançados',
        'Suporte prioritário',
        'Acesso a ferramentas premium',
        'Histórico de dados estendido'
      ],
      cor: '#10b981',
      popular: true
    },
    {
      id: 'semestral',
      nome: 'Plano Semestral',
      preco: 'R$ 449,90',
      periodo: '/6 meses',
      valor: 449.90,
      valorOriginal: 779.40,
      desconto: 42,
      duracao: '6 meses',
      descricao: 'Excelente para empresas em crescimento',
      recursos: [
        'Análises ilimitadas',
        'Relatórios personalizados',
        'Suporte 24/7',
        'API completa',
        'Integração com sistemas externos',
        'Backup automático'
      ],
      cor: '#8b5cf6',
      popular: false
    },
    {
      id: 'anual',
      nome: 'Plano Anual',
      preco: 'R$ 799,90',
      periodo: '/ano',
      valor: 799.90,
      valorOriginal: 1558.80,
      desconto: 49,
      duracao: '12 meses',
      descricao: 'Máximo desconto para uso corporativo',
      recursos: [
        'Análises ilimitadas',
        'Relatórios personalizados',
        'Suporte dedicado',
        'API completa',
        'Integração com sistemas externos',
        'Backup automático',
        'Consultoria especializada',
        'Treinamento da equipe'
      ],
      cor: '#f59e0b',
      popular: false
    },
    {
      id: 'corporativo_basico',
      nome: 'Corporativo Básico',
      preco: 'R$ 199,90',
      periodo: '/mês',
      valor: 199.90,
      valorOriginal: 299.90,
      desconto: 33,
      duracao: '1 mês',
      descricao: 'Para empresas com até 5 colaboradores',
      recursos: [
        'Até 5 subacessos inclusos',
        'Análises ilimitadas por usuário',
        'Relatórios corporativos',
        'Gestão centralizada de usuários',
        'Suporte prioritário',
        'Dashboard administrativo'
      ],
      cor: '#dc2626',
      popular: false,
      tipo: 'corporativo',
      maxColaboradores: 5
    },
    {
      id: 'corporativo_medio',
      nome: 'Corporativo Médio',
      preco: 'R$ 349,90',
      periodo: '/mês',
      valor: 349.90,
      valorOriginal: 499.90,
      desconto: 30,
      duracao: '1 mês',
      descricao: 'Para empresas com até 15 colaboradores',
      recursos: [
        'Até 15 subacessos inclusos',
        'Análises ilimitadas por usuário',
        'Relatórios corporativos avançados',
        'Gestão centralizada de usuários',
        'Suporte dedicado 24/7',
        'Dashboard administrativo',
        'API corporativa',
        'Integração com sistemas externos'
      ],
      cor: '#dc2626',
      popular: true,
      tipo: 'corporativo',
      maxColaboradores: 15
    },
    {
      id: 'corporativo_avancado',
      nome: 'Corporativo Avançado',
      preco: 'R$ 499,90',
      periodo: '/mês',
      valor: 499.90,
      valorOriginal: 699.90,
      desconto: 29,
      duracao: '1 mês',
      descricao: 'Para empresas com até 20 colaboradores',
      recursos: [
        'Até 20 subacessos inclusos',
        'Análises ilimitadas por usuário',
        'Relatórios corporativos personalizados',
        'Gestão avançada de usuários e permissões',
        'Suporte dedicado premium',
        'Dashboard administrativo avançado',
        'API corporativa completa',
        'Integração com sistemas externos',
        'Consultoria especializada',
        'Treinamento da equipe'
      ],
      cor: '#dc2626',
      popular: false,
      tipo: 'corporativo',
      maxColaboradores: 20
    }
    ], []);

  const planosAtualizados = useMemo(
    () => planos.map(plano => calcularPrecoColaboradores(plano, numeroColaboradores)),
    [planos, numeroColaboradores, calcularPrecoColaboradores]
  );

  const handleSelecionarPlano = (plano) => {
    // Navegar para página de pagamento
    if (onNavigate) {
      onNavigate('pagamento', { plano });
    }
  };





  const handleEscolherPlano = (plano) => {
    handleSelecionarPlano(plano);
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    content: {
      maxWidth: '1200px',
      margin: '0 auto'
    },
    header: {
      textAlign: 'center',
      marginBottom: '60px',
      color: 'white'
    },
    title: {
      fontSize: '3rem',
      fontWeight: '700',
      marginBottom: '16px',
      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    subtitle: {
      fontSize: '1.25rem',
      opacity: '0.9',
      maxWidth: '600px',
      margin: '0 auto',
      lineHeight: '1.6'
    },
    sectionHeader: {
      textAlign: 'center',
      marginBottom: '40px',
      marginTop: '80px',
      color: 'white'
    },
    sectionTitle: {
      fontSize: '2.5rem',
      fontWeight: '700',
      marginBottom: '12px',
      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    sectionSubtitle: {
      fontSize: '1.1rem',
      opacity: '0.9',
      maxWidth: '500px',
      margin: '0 auto',
      lineHeight: '1.5'
    },
    planosGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
      gap: '30px',
      marginBottom: '60px'
    },
    planoCard: {
      background: 'white',
      borderRadius: '20px',
      padding: '40px 30px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
      position: 'relative',
      transition: 'all 0.3s ease',
      border: '3px solid transparent'
    },
    planoCardHover: {
      transform: 'translateY(-10px)',
      boxShadow: '0 30px 60px rgba(0,0,0,0.15)'
    },
    popularBadge: {
      position: 'absolute',
      top: '-15px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)',
      color: 'white',
      padding: '8px 24px',
      borderRadius: '20px',
      fontSize: '0.875rem',
      fontWeight: '600',
      boxShadow: '0 4px 12px rgba(238, 90, 36, 0.3)'
    },
    planoNome: {
      fontSize: '1.5rem',
      fontWeight: '700',
      marginBottom: '8px',
      textAlign: 'center'
    },
    planoDescricao: {
      color: '#6b7280',
      textAlign: 'center',
      marginBottom: '24px',
      fontSize: '0.95rem'
    },
    precoContainer: {
      textAlign: 'center',
      marginBottom: '32px'
    },
    preco: {
      fontSize: '3rem',
      fontWeight: '800',
      marginBottom: '4px'
    },
    periodo: {
      color: '#6b7280',
      fontSize: '1rem'
    },
    recursosList: {
      listStyle: 'none',
      padding: '0',
      marginBottom: '32px'
    },
    recursoItem: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '12px',
      fontSize: '0.95rem',
      color: '#374151'
    },
    checkIcon: {
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: '#10b981',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '12px',
      fontSize: '12px',
      fontWeight: 'bold'
    },
    botaoEscolher: {
      width: '100%',
      padding: '16px',
      borderRadius: '12px',
      border: 'none',
      fontSize: '1.1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      color: 'white'
    },
    faq: {
      background: 'white',
      borderRadius: '20px',
      padding: '40px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
    },
    faqTitle: {
      fontSize: '2rem',
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: '32px',
      color: '#1f2937'
    },
    faqItem: {
      marginBottom: '24px',
      borderBottom: '1px solid #e5e7eb',
      paddingBottom: '24px'
    },
    faqQuestion: {
      fontSize: '1.1rem',
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: '8px'
    },
    faqAnswer: {
      color: '#6b7280',
      lineHeight: '1.6'
    },
    voltarButton: {
      position: 'fixed',
      top: '20px',
      left: '20px',
      background: 'rgba(255,255,255,0.2)',
      color: 'white',
      border: 'none',
      borderRadius: '12px',
      padding: '12px 20px',
      cursor: 'pointer',
      fontSize: '0.95rem',
      fontWeight: '500',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s ease'
    }
  };

  return (
    <div style={styles.container}>
      <button 
        style={styles.voltarButton}
        onClick={() => onNavigate && onNavigate('dashboard')}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255,255,255,0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255,255,255,0.2)';
        }}
      >
        ← Voltar
      </button>

      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>Escolha seu Plano</h1>
          <p style={styles.subtitle}>
            Selecione o plano ideal para suas necessidades profissionais. 
            Todos os planos incluem atualizações gratuitas e suporte técnico.
          </p>
        </div>

        {/* Planos Individuais */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Planos Individuais</h2>
          <p style={styles.sectionSubtitle}>Para profissionais e pequenos projetos</p>
        </div>
        
        <div style={styles.planosGrid}>
          {(planosAtualizados.length > 0 ? planosAtualizados : planos).filter(plano => !plano.tipo || plano.tipo !== 'corporativo').map((plano) => (
            <div
              key={plano.id}
              style={{
                ...styles.planoCard,
                borderColor: plano.popular ? plano.cor : 'transparent'
              }}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, styles.planoCardHover);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.1)';
              }}
            >
              {plano.popular && (
                <div style={styles.popularBadge}>
                  ⭐ Mais Popular
                </div>
              )}
              
              <h3 style={{ ...styles.planoNome, color: plano.cor }}>
                {plano.nome}
              </h3>
              
              <p style={styles.planoDescricao}>
                {plano.descricao}
              </p>
              
              <div style={styles.precoContainer}>
                <div style={{ ...styles.preco, color: plano.cor }}>
                  {plano.preco}
                </div>
                <div style={styles.periodo}>
                  {plano.periodo}
                </div>
              </div>
              
              <ul style={styles.recursosList}>
                {plano.recursos.map((recurso, index) => (
                  <li key={index} style={styles.recursoItem}>
                    <div style={styles.checkIcon}>✓</div>
                    {recurso}
                  </li>
                ))}
              </ul>
              
              <button
                style={{
                  ...styles.botaoEscolher,
                  background: plano.cor
                }}
                onClick={() => handleEscolherPlano(plano)}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = `0 8px 25px ${plano.cor}40`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                Escolher {plano.nome}
              </button>
            </div>
          ))}
        </div>

        {/* Planos Corporativos */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Planos Corporativos</h2>
          <p style={styles.sectionSubtitle}>Para empresas com múltiplos colaboradores</p>
          {numeroColaboradores > 1 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '20px',
              maxWidth: '600px',
              margin: '20px auto 0'
            }}>
              <p style={{
                color: 'white',
                fontSize: '1rem',
                margin: 0,
                lineHeight: '1.5'
              }}>
                💡 <strong>Preços ajustados para {numeroColaboradores} colaboradores</strong><br/>
                Colaboradores extras são cobrados por: Básico (+R$ 15,90), Médio (+R$ 12,90), Avançado (+R$ 9,90)
              </p>
            </div>
          )}
        </div>
        
        <div style={styles.planosGrid}>
          {(planosAtualizados.length > 0 ? planosAtualizados : planos).filter(plano => plano.tipo === 'corporativo').map((plano) => (
            <div
              key={plano.id}
              style={{
                ...styles.planoCard,
                borderColor: plano.popular ? plano.cor : 'transparent'
              }}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, styles.planoCardHover);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.1)';
              }}
            >
              {plano.popular && (
                <div style={styles.popularBadge}>
                  ⭐ Mais Popular
                </div>
              )}
              
              <h3 style={{ ...styles.planoNome, color: plano.cor }}>
                {plano.nome}
              </h3>
              
              <p style={styles.planoDescricao}>
                {plano.descricao}
              </p>
              
              <div style={styles.precoContainer}>
                <div style={{ ...styles.preco, color: plano.cor }}>
                  {plano.preco}
                </div>
                <div style={styles.periodo}>
                  {plano.periodo}
                </div>
              </div>
              
              <ul style={styles.recursosList}>
                {plano.recursos.map((recurso, index) => (
                  <li key={index} style={styles.recursoItem}>
                    <div style={styles.checkIcon}>✓</div>
                    <span>{recurso}</span>
                  </li>
                ))}
              </ul>
              
              <button
                style={{
                  ...styles.escolherButton,
                  backgroundColor: plano.cor
                }}
                onClick={() => handleEscolherPlano(plano)}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = `0 8px 25px ${plano.cor}40`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                Escolher {plano.nome}
              </button>
            </div>
          ))}
        </div>

        <div style={styles.faq}>
          <h2 style={styles.faqTitle}>Perguntas Frequentes</h2>
          
          <div style={styles.faqItem}>
            <h3 style={styles.faqQuestion}>
              Posso cancelar minha assinatura a qualquer momento?
            </h3>
            <p style={styles.faqAnswer}>
              Sim, você pode cancelar sua assinatura a qualquer momento sem taxas de cancelamento. 
              Você continuará tendo acesso aos recursos até o final do período pago.
            </p>
          </div>
          
          <div style={styles.faqItem}>
            <h3 style={styles.faqQuestion}>
              Posso fazer upgrade ou downgrade do meu plano?
            </h3>
            <p style={styles.faqAnswer}>
              Absolutamente! Você pode alterar seu plano a qualquer momento. 
              As alterações entram em vigor no próximo ciclo de cobrança.
            </p>
          </div>
          
          <div style={styles.faqItem}>
            <h3 style={styles.faqQuestion}>
              Os dados dos meus projetos ficam seguros?
            </h3>
            <p style={styles.faqAnswer}>
              Sim, utilizamos criptografia de ponta e backup automático para garantir 
              a segurança e integridade dos seus dados profissionais.
            </p>
          </div>
          
          <div style={styles.faqItem}>
            <h3 style={styles.faqQuestion}>
              Existe desconto para pagamento anual?
            </h3>
            <p style={styles.faqAnswer}>
              Sim! Oferecemos 20% de desconto para assinaturas anuais. 
              Entre em contato conosco para mais informações.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanosAssinatura;