import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, InputNumber, Modal, message, Statistic, Row, Col, List, Tag, Divider } from 'antd';
import { WalletOutlined, PlusOutlined, CreditCardOutlined, HistoryOutlined, DollarOutlined } from '@ant-design/icons';
import paymentSystem, { TIPOS_TRANSACAO, STATUS_TRANSACAO, METODOS_PAGAMENTO } from '../utils/PaymentSystem';
import { PRECOS_PLANO, PLANOS } from '../utils/AccessControl';

const { Title, Text, Paragraph } = Typography;

const GerenciamentoCreditos = () => {
  const [creditos, setCreditos] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [valorRecarga, setValorRecarga] = useState(2000); // R$ 20,00 em centavos
  const [loading, setLoading] = useState(false);
  const [estatisticas, setEstatisticas] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [modalHistorico, setModalHistorico] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      await paymentSystem.atualizarDados();
      setCreditos(paymentSystem.creditos);
      setEstatisticas(paymentSystem.obterEstatisticas());
      setHistorico(paymentSystem.obterHistoricoTransacoes());
    } catch (error) {
      message.error(error.response?.data?.error || 'Não foi possível carregar o saldo de créditos.');
    }
  };

  const handleAdicionarCreditos = async () => {
    if (valorRecarga < 500) { // Mínimo R$ 5,00
      message.error('Valor mínimo para recarga é R$ 5,00');
      return;
    }

    setLoading(true);
    try {
      const resultado = await paymentSystem.adicionarCreditos(
        valorRecarga,
        METODOS_PAGAMENTO.CARTAO_CREDITO
      );

      if (resultado.sucesso) {
        message.success(resultado.mensagem);
        setCreditos(resultado.novoSaldo);
        await carregarDados();
        setModalVisible(false);
      } else {
        message.error(resultado.mensagem);
      }
    } catch (error) {
      message.error('Erro ao adicionar créditos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConsultaAvulsa = async () => {
    await paymentSystem.atualizarDados();
    const verificacao = paymentSystem.podeRealizarConsulta();
    
    if (!verificacao.pode) {
      message.warning(verificacao.motivo);
      return;
    }

    setLoading(true);
    try {
      const dadosConsulta = {
        tipo: 'analise_imagem',
        timestamp: new Date().toISOString()
      };

      const metodo = verificacao.metodo === 'creditos' 
        ? METODOS_PAGAMENTO.CREDITOS 
        : METODOS_PAGAMENTO.CARTAO_CREDITO;

      const resultado = await paymentSystem.processarConsultaAvulsa(
        dadosConsulta,
        metodo
      );

      if (resultado.sucesso) {
        message.success('Consulta processada com sucesso!');
        await carregarDados();
        // Aqui você redirecionaria para a página de análise
        console.log('Redirecionando para análise...');
      } else {
        message.error(resultado.mensagem);
      }
    } catch (error) {
      message.error('Erro ao processar consulta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatarMoeda = (valor) => {
    return `R$ ${(valor / 100).toFixed(2)}`;
  };

  const formatarData = (data) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case STATUS_TRANSACAO.APROVADA: return 'success';
      case STATUS_TRANSACAO.PENDENTE: return 'processing';
      case STATUS_TRANSACAO.PROCESSANDO: return 'processing';
      case STATUS_TRANSACAO.REJEITADA: return 'error';
      case STATUS_TRANSACAO.CANCELADA: return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case STATUS_TRANSACAO.APROVADA: return 'Aprovada';
      case STATUS_TRANSACAO.PENDENTE: return 'Pendente';
      case STATUS_TRANSACAO.PROCESSANDO: return 'Processando';
      case STATUS_TRANSACAO.REJEITADA: return 'Rejeitada';
      case STATUS_TRANSACAO.CANCELADA: return 'Cancelada';
      default: return status;
    }
  };

  const getTipoText = (tipo) => {
    switch (tipo) {
      case TIPOS_TRANSACAO.CONSULTA_AVULSA: return 'Consulta Avulsa';
      case TIPOS_TRANSACAO.CREDITO_ADICIONAL: return 'Recarga de Créditos';
      case TIPOS_TRANSACAO.ASSINATURA_MENSAL: return 'Assinatura Mensal';
      default: return tipo;
    }
  };

  const valorConsulta = PRECOS_PLANO[PLANOS.CONSULTA_AVULSA];
  const podeConsultar = creditos >= valorConsulta;
  const consultasPossiveis = Math.floor(creditos / valorConsulta);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Gerenciamento de Créditos</Title>
        <Text type="secondary">Gerencie seus créditos e consultas avulsas</Text>
      </div>

      <Row gutter={[16, 16]}>
        {/* Card de Saldo */}
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Saldo Atual"
              value={creditos / 100}
              precision={2}
              prefix={<WalletOutlined />}
              suffix="R$"
              valueStyle={{ color: creditos > 0 ? '#3f8600' : '#cf1322' }}
            />
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">
                {consultasPossiveis} consulta{consultasPossiveis !== 1 ? 's' : ''} disponível{consultasPossiveis !== 1 ? 'eis' : ''}
              </Text>
            </div>
          </Card>
        </Col>

        {/* Card de Estatísticas */}
        {estatisticas && (
          <>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Gasto Total"
                  value={estatisticas.totalGasto / 100}
                  precision={2}
                  prefix={<DollarOutlined />}
                  suffix="R$"
                />
                <div style={{ marginTop: '8px' }}>
                  <Text type="secondary">
                    {estatisticas.consultasRealizadas} consultas realizadas
                  </Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title="Este Mês"
                  value={estatisticas.gastoMesAtual / 100}
                  precision={2}
                  prefix={<DollarOutlined />}
                  suffix="R$"
                />
                <div style={{ marginTop: '8px' }}>
                  <Text type="secondary">
                    {estatisticas.consultasMesAtual} consultas este mês
                  </Text>
                </div>
              </Card>
            </Col>
          </>
        )}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        {/* Ações Principais */}
        <Col xs={24} md={12}>
          <Card title="Ações" extra={<WalletOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="large"
                block
                onClick={() => setModalVisible(true)}
              >
                Adicionar Créditos
              </Button>
              
              <Button
                type={podeConsultar ? 'default' : 'dashed'}
                icon={<CreditCardOutlined />}
                size="large"
                block
                disabled={!podeConsultar && creditos < valorConsulta}
                loading={loading}
                onClick={handleConsultaAvulsa}
              >
                Realizar Consulta ({formatarMoeda(valorConsulta)})
              </Button>
              
              {!podeConsultar && creditos < valorConsulta && (
                <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
                  Créditos insuficientes. Adicione pelo menos {formatarMoeda(valorConsulta - creditos)}
                </Text>
              )}
            </Space>
          </Card>
        </Col>

        {/* Histórico Resumido */}
        <Col xs={24} md={12}>
          <Card 
            title="Últimas Transações" 
            extra={
              <Button 
                type="link" 
                icon={<HistoryOutlined />}
                onClick={() => setModalHistorico(true)}
              >
                Ver Todas
              </Button>
            }
          >
            {historico.length === 0 ? (
              <Text type="secondary">Nenhuma transação encontrada</Text>
            ) : (
              <List
                dataSource={historico.slice(0, 3)}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text>{getTipoText(item.tipo)}</Text>
                          <Tag color={getStatusColor(item.status)}>
                            {getStatusText(item.status)}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text>{formatarMoeda(item.valor)}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {formatarData(item.dataCreacao)}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Modal de Adicionar Créditos */}
      <Modal
        title="Adicionar Créditos"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>Valor da Recarga</Text>
            <InputNumber
              style={{ width: '100%', marginTop: '8px' }}
              size="large"
              min={500}
              max={50000}
              step={500}
              value={valorRecarga}
              onChange={setValorRecarga}
              formatter={value => `R$ ${(value / 100).toFixed(2)}`}
              parser={value => value.replace(/R\$\s?|(,*)/g, '') * 100}
            />
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
              Valor mínimo: R$ 5,00 | Máximo: R$ 500,00
            </Text>
          </div>

          <div style={{ 
            background: '#f6ffed', 
            border: '1px solid #b7eb8f',
            borderRadius: '6px',
            padding: '12px'
          }}>
            <Text strong>Resumo da Recarga</Text>
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Valor:</Text>
                <Text strong>{formatarMoeda(valorRecarga)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Consultas equivalentes:</Text>
                <Text>{Math.floor(valorRecarga / valorConsulta)}</Text>
              </div>
            </div>
          </div>

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setModalVisible(false)}>
              Cancelar
            </Button>
            <Button
              type="primary"
              loading={loading}
              onClick={handleAdicionarCreditos}
            >
              Confirmar Recarga
            </Button>
          </Space>
        </Space>
      </Modal>

      {/* Modal de Histórico Completo */}
      <Modal
        title="Histórico de Transações"
        open={modalHistorico}
        onCancel={() => setModalHistorico(false)}
        footer={null}
        width={800}
      >
        <List
          dataSource={historico}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{getTipoText(item.tipo)}</Text>
                    <Tag color={getStatusColor(item.status)}>
                      {getStatusText(item.status)}
                    </Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text>Valor: {formatarMoeda(item.valor)}</Text>
                    <Text type="secondary">
                      {formatarData(item.dataCreacao)}
                    </Text>
                    {item.motivoRejeicao && (
                      <Text type="danger" style={{ fontSize: '12px' }}>
                        Motivo: {item.motivoRejeicao}
                      </Text>
                    )}
                  </Space>
                }
              />
              <div style={{ textAlign: 'right' }}>
                <Text code style={{ fontSize: '10px' }}>
                  {item.id}
                </Text>
              </div>
            </List.Item>
          )}
          locale={{ emptyText: 'Nenhuma transação encontrada' }}
        />
      </Modal>
    </div>
  );
};

export default GerenciamentoCreditos;