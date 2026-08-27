import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Typography, Progress, Button, Space, Statistic, List, Tag, Alert, Divider } from 'antd';
import { 
  CrownOutlined, 
  WalletOutlined, 
  BarChartOutlined, 
  CalendarOutlined,
  UpgradeOutlined,
  SettingOutlined,
  CreditCardOutlined,
  HistoryOutlined,
  TrophyOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { FUNCIONALIDADES, PLANOS } from '../utils/AccessControl';
import paymentSystem from '../utils/PaymentSystem';

const { Title, Text, Paragraph } = Typography;

const DashboardAssinatura = ({ onNavigate }) => {
  const [infoPlano, setInfoPlano] = useState(null);
  const [estatisticas, setEstatisticas] = useState(null);
  const [limites, setLimites] = useState({});
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = useCallback(async () => {
    try {
      const stats = await paymentSystem.atualizarDados();
      const normalizedStats = {
        ...stats,
        consultasMesAtual: Number(stats?.monthly_used || 0),
        gastoMesAtual: 0,
        totalGasto: 0,
        consultasRealizadas: Number(stats?.monthly_used || 0),
        creditosDisponiveis: Number(stats?.balance_cents || 0),
      };
      const info = {
        plano: stats?.plan || 'trial',
        nome: stats?.plan === 'trial' ? 'Período de avaliação' : `Plano ${stats?.plan || 'atual'}`,
        preco: null,
        permissoes: [FUNCIONALIDADES.ANALISE_IMAGEM, FUNCIONALIDADES.RELATORIO_PDF, FUNCIONALIDADES.HISTORICO_CONSULTAS],
        dataVencimento: null,
        ativo: true,
      };
      setInfoPlano(info);
      setEstatisticas(normalizedStats);
      setLimites({ consultasMensais: { limite: null, usado: normalizedStats.consultasMesAtual } });
      gerarAlertas(info, {}, normalizedStats);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const gerarAlertas = (info, limites, stats) => {
    const novosAlertas = [];

    // Verificar vencimento da assinatura
    if (info.dataVencimento) {
      const vencimento = new Date(info.dataVencimento);
      const hoje = new Date();
      const diasRestantes = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes <= 7 && diasRestantes > 0) {
        novosAlertas.push({
          tipo: 'warning',
          titulo: 'Assinatura vencendo em breve',
          descricao: `Sua assinatura vence em ${diasRestantes} dias. Renove para continuar usando todos os recursos.`,
          acao: 'renovar'
        });
      } else if (diasRestantes <= 0) {
        novosAlertas.push({
          tipo: 'error',
          titulo: 'Assinatura vencida',
          descricao: 'Sua assinatura venceu. Renove agora para reativar todos os recursos.',
          acao: 'renovar'
        });
      }
    }

    // Verificar limites próximos do esgotamento
    Object.entries(limites).forEach(([tipo, limite]) => {
      if (limite.limite && limite.usado / limite.limite >= 0.8) {
        const porcentagem = Math.round((limite.usado / limite.limite) * 100);
        novosAlertas.push({
          tipo: porcentagem >= 100 ? 'error' : 'warning',
          titulo: `Limite de ${tipo} ${porcentagem >= 100 ? 'esgotado' : 'próximo do limite'}`,
          descricao: `Você ${porcentagem >= 100 ? 'esgotou' : 'está próximo de esgotar'} seu limite mensal de ${tipo}.`,
          acao: 'upgrade'
        });
      }
    });

    // Verificar créditos baixos para consultas avulsas
    if (info.plano === PLANOS.CONSULTA_AVULSA && stats?.creditosDisponiveis < 100) {
      novosAlertas.push({
        tipo: 'warning',
        titulo: 'Créditos insuficientes',
        descricao: 'Você não tem créditos suficientes para realizar uma consulta. Adicione créditos para continuar.',
        acao: 'creditos'
      });
    }

    setAlertas(novosAlertas);
  };

  const formatarMoeda = (valor) => {
    return `R$ ${(valor / 100).toFixed(2)}`;
  };

  const formatarData = (data) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const calcularDiasRestantes = (dataVencimento) => {
    if (!dataVencimento) return null;
    const vencimento = new Date(dataVencimento);
    const hoje = new Date();
    return Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
  };

  const handleAcaoAlerta = (acao) => {
    switch (acao) {
      case 'renovar':
      case 'upgrade':
        if (onNavigate) onNavigate('planos');
        break;
      case 'creditos':
        if (onNavigate) onNavigate('creditos');
        break;
      default:
        break;
    }
  };

  const getProgressColor = (porcentagem) => {
    if (porcentagem >= 90) return '#ff4d4f';
    if (porcentagem >= 70) return '#faad14';
    return '#52c41a';
  };

  if (loading || !infoPlano) {
    return <div>Carregando...</div>;
  }

  const diasRestantes = calcularDiasRestantes(infoPlano.dataVencimento);

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Space align="center" style={{ marginBottom: '16px' }}>
          <Title level={2} style={{ margin: 0 }}>Dashboard de Assinatura</Title>
          <Tag color="blue">{infoPlano.nome}</Tag>
        </Space>
        <Text type="secondary">Gerencie sua assinatura e acompanhe seu uso</Text>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {alertas.map((alerta, index) => (
              <Alert
                key={index}
                type={alerta.tipo}
                message={alerta.titulo}
                description={alerta.descricao}
                showIcon
                action={
                  <Button 
                    size="small" 
                    type={alerta.tipo === 'error' ? 'primary' : 'default'}
                    onClick={() => handleAcaoAlerta(alerta.acao)}
                  >
                    {alerta.acao === 'renovar' ? 'Renovar' : 
                     alerta.acao === 'upgrade' ? 'Fazer Upgrade' : 
                     alerta.acao === 'creditos' ? 'Adicionar Créditos' : 'Ação'}
                  </Button>
                }
              />
            ))}
          </Space>
        </div>
      )}

      <Row gutter={[16, 16]}>
        {/* Informações do Plano */}
        <Col xs={24} lg={8}>
          <Card title="Meu Plano" extra={<CrownOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong style={{ fontSize: '18px' }}>{infoPlano.nome}</Text>
                <br />
                <Text type="secondary">{infoPlano.preco == null ? 'Preço e limites definidos pelo servidor' : `${formatarMoeda(infoPlano.preco)}${infoPlano.plano !== PLANOS.CONSULTA_AVULSA ? '/mês' : '/consulta'}`}</Text>
              </div>
              
              {infoPlano.dataVencimento && (
                <div>
                  <Text type="secondary">Próximo vencimento:</Text>
                  <br />
                  <Text strong>{formatarData(infoPlano.dataVencimento)}</Text>
                  {diasRestantes !== null && (
                    <Text type={diasRestantes <= 7 ? 'danger' : 'secondary'} style={{ marginLeft: '8px' }}>
                      ({diasRestantes > 0 ? `${diasRestantes} dias` : 'Vencido'})
                    </Text>
                  )}
                </div>
              )}
              
              <Divider style={{ margin: '12px 0' }} />
              
              <Space>
                <Button 
                  type="primary" 
                  icon={<UpgradeOutlined />}
                  onClick={() => onNavigate && onNavigate('planos')}
                >
                  Alterar Plano
                </Button>
                <Button 
                  icon={<SettingOutlined />}
                  onClick={() => onNavigate && onNavigate('configuracoes')}
                >
                  Configurações
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>

        {/* Estatísticas de Uso */}
        <Col xs={24} lg={8}>
          <Card title="Estatísticas" extra={<BarChartOutlined />}>
            {estatisticas ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Consultas"
                      value={estatisticas.consultasMesAtual}
                      suffix=" / servidor"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Gasto Mensal"
                      value={estatisticas.gastoMesAtual / 100}
                      precision={2}
                      prefix="R$"
                    />
                  </Col>
                </Row>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Total Gasto"
                      value={estatisticas.totalGasto / 100}
                      precision={2}
                      prefix="R$"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Total Consultas"
                      value={estatisticas.consultasRealizadas}
                    />
                  </Col>
                </Row>
                
                {infoPlano.plano === PLANOS.CONSULTA_AVULSA && (
                  <div>
                    <Text type="secondary">Créditos Disponíveis:</Text>
                    <br />
                    <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                      {formatarMoeda(estatisticas.creditosDisponiveis)}
                    </Text>
                  </div>
                )}
              </Space>
            ) : (
              <Text type="secondary">Carregando estatísticas...</Text>
            )}
          </Card>
        </Col>

        {/* Limites de Uso */}
        <Col xs={24} lg={8}>
          <Card title="Limites de Uso" extra={<TrophyOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {Object.keys(limites).length > 0 ? (
                Object.entries(limites).map(([tipo, limite]) => {
                  const porcentagem = limite.limite ? (limite.usado / limite.limite) * 100 : 0;
                  return (
                    <div key={tipo}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <Text>{tipo.replace(/([A-Z])/g, ' $1').toLowerCase()}</Text>
                        <Text>{limite.usado}/{limite.limite || '∞'}</Text>
                      </div>
                      <Progress 
                        percent={Math.min(porcentagem, 100)} 
                        strokeColor={getProgressColor(porcentagem)}
                        size="small"
                      />
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <TrophyOutlined style={{ fontSize: '32px', color: '#52c41a', marginBottom: '8px' }} />
                  <br />
                  <Text strong>Uso controlado pelo servidor</Text>
                  <br />
                  <Text type="secondary">Os limites comerciais são aplicados no backend.</Text>
                </div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Ações Rápidas */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24}>
          <Card title="Ações Rápidas">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Button 
                  block 
                  size="large" 
                  icon={<CreditCardOutlined />}
                  onClick={() => onNavigate && onNavigate('cartoes')}
                >
                  Gerenciar Cartões
                </Button>
              </Col>
              
              {infoPlano.plano === PLANOS.CONSULTA_AVULSA && (
                <Col xs={24} sm={12} md={6}>
                  <Button 
                    block 
                    size="large" 
                    icon={<WalletOutlined />}
                    onClick={() => onNavigate && onNavigate('creditos')}
                  >
                    Gerenciar Créditos
                  </Button>
                </Col>
              )}
              
              <Col xs={24} sm={12} md={6}>
                <Button 
                  block 
                  size="large" 
                  icon={<HistoryOutlined />}
                  onClick={() => onNavigate && onNavigate('historico')}
                >
                  Histórico
                </Button>
              </Col>
              
              <Col xs={24} sm={12} md={6}>
                <Button 
                  block 
                  size="large" 
                  icon={<UpgradeOutlined />}
                  type="primary"
                  onClick={() => onNavigate && onNavigate('planos')}
                >
                  Upgrade de Plano
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Funcionalidades do Plano */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24}>
          <Card title="Funcionalidades do Seu Plano">
            <Row gutter={[8, 8]}>
              {infoPlano.permissoes.map((funcionalidade) => {
                const nomesFuncionalidades = {
                  [FUNCIONALIDADES.ANALISE_IMAGEM]: 'Análise de Imagens',
                  [FUNCIONALIDADES.RELATORIO_PDF]: 'Relatórios em PDF',
                  [FUNCIONALIDADES.COMPARACAO_PROPRIEDADES]: 'Comparação de Propriedades',
                  [FUNCIONALIDADES.HISTORICO_CONSULTAS]: 'Histórico de Consultas',
                  [FUNCIONALIDADES.DASHBOARD_AVANCADO]: 'Dashboard Avançado',
                  [FUNCIONALIDADES.API_INTEGRACAO]: 'Integração via API',
                  [FUNCIONALIDADES.SUPORTE_PRIORITARIO]: 'Suporte Prioritário',
                  [FUNCIONALIDADES.EXPORTACAO_DADOS]: 'Exportação de Dados',
                  [FUNCIONALIDADES.RELATORIOS_PERSONALIZADOS]: 'Relatórios Personalizados',
                  [FUNCIONALIDADES.ANALISE_BATCH]: 'Análise em Lote'
                };
                
                return (
                  <Col key={funcionalidade} xs={24} sm={12} md={8} lg={6}>
                    <Tag color="green" style={{ width: '100%', textAlign: 'center', padding: '8px' }}>
                      {nomesFuncionalidades[funcionalidade] || funcionalidade}
                    </Tag>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardAssinatura;