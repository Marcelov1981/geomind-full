import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Button, Space, List, Tag, Avatar, Descriptions, Modal, Form, Input, message } from 'antd';
import { UserOutlined, EditOutlined, CreditCardOutlined, HistoryOutlined, MailOutlined, BankOutlined, DollarOutlined, LockOutlined } from '@ant-design/icons';
import api, { API_ENDPOINTS } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const PerfilUsuario = ({ onNavigate }) => {
  const { user, refresh } = useAuth();
  const [historico, setHistorico] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [modalHistoricoVisible, setModalHistoricoVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(API_ENDPOINTS.billing.transactions),
      api.get(API_ENDPOINTS.billing.methods),
    ]).then(([transactionsResponse, methodsResponse]) => {
      if (!active) return;
      setHistorico(Array.isArray(transactionsResponse.data) ? transactionsResponse.data : []);
      setCartoes(Array.isArray(methodsResponse.data) ? methodsResponse.data : []);
    }).catch((error) => {
      if (active) message.error(error.response?.data?.error || 'Não foi possível carregar os dados da conta.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleEditarPerfil = async (values) => {
    setSaving(true);
    try {
      await api.patch(API_ENDPOINTS.usuarios.updateProfile, { name: values.name.trim(), email: values.email.trim() });
      await refresh();
      setModalEditarVisible(false);
      message.success('Perfil atualizado com sucesso.');
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0) / 100);
  const formatarData = (data) => data ? new Date(data).toLocaleString('pt-BR') : 'Data não informada';
  const getTypeText = (type) => ({ usage: 'Uso de créditos', top_up: 'Recarga', subscription: 'Assinatura', refund: 'Estorno' }[type] || type || 'Transação');
  const getStatusColor = (status) => ({ approved: 'green', pending: 'orange', processing: 'blue', rejected: 'red', cancelled: 'default', refunded: 'purple' }[status] || 'default');
  const getStatusText = (status) => ({ approved: 'Aprovada', pending: 'Pendente', processing: 'Processando', rejected: 'Rejeitada', cancelled: 'Cancelada', refunded: 'Estornada' }[status] || status || 'Sem status');

  if (loading) {
    return <div style={{ padding: '24px', textAlign: 'center' }}><Text>Carregando dados da conta…</Text></div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Meu perfil</Title>
        <Text type="secondary">Dados da sua sessão, organização e histórico financeiro.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="Informações da conta"
            extra={<Button type="primary" icon={<EditOutlined />} onClick={() => { form.setFieldsValue({ name: user?.name, email: user?.email }); setModalEditarVisible(true); }}>Editar</Button>}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
              <div style={{ marginTop: '12px' }}>
                <Title level={4} style={{ margin: 0 }}>{user?.name || 'Usuário'}</Title>
                <Text type="secondary">{user?.email || 'Email não informado'}</Text>
              </div>
            </div>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Nome">{user?.name || 'Não informado'}</Descriptions.Item>
              <Descriptions.Item label="Email">{user?.email || 'Não informado'}</Descriptions.Item>
              <Descriptions.Item label="Perfil">{user?.role || 'analyst'}</Descriptions.Item>
              <Descriptions.Item label="Organização">#{user?.organization_id || 'Não informado'}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={user?.active !== false ? 'green' : 'red'}>{user?.active !== false ? 'Ativa' : 'Inativa'}</Tag></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Resumo da conta">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div><Text strong>Permissão:</Text><div><Tag color="blue">{user?.role || 'analyst'}</Tag></div></div>
              <div><Text strong>Métodos de pagamento:</Text><div><Text>{cartoes.length} método(s) tokenizado(s)</Text></div></div>
              <div><Text strong>Transações:</Text><div><Text>{historico.length} transação(ões)</Text></div></div>
              <div><Text type="secondary"><LockOutlined /> Nenhum número de cartão ou CVV é armazenado pelo GeoMind.</Text></div>
            </Space>
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Ações rápidas">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}><Button block size="large" icon={<CreditCardOutlined />} onClick={() => onNavigate?.('cartoes')}>Métodos de pagamento</Button></Col>
              <Col xs={24} sm={12} md={6}><Button block size="large" icon={<HistoryOutlined />} onClick={() => setModalHistoricoVisible(true)}>Histórico completo</Button></Col>
              <Col xs={24} sm={12} md={6}><Button block size="large" icon={<DollarOutlined />} onClick={() => onNavigate?.('creditos')}>Gerenciar créditos</Button></Col>
              <Col xs={24} sm={12} md={6}><Button block size="large" icon={<BankOutlined />} onClick={() => onNavigate?.('planos')}>Ver planos</Button></Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Últimas transações" extra={<Button type="link" icon={<HistoryOutlined />} onClick={() => setModalHistoricoVisible(true)}>Ver todas</Button>}>
            {historico.length === 0 ? <div style={{ textAlign: 'center', padding: '40px' }}><HistoryOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} /><br /><Text type="secondary">Nenhuma transação encontrada.</Text></div> : (
              <List dataSource={historico.slice(0, 5)} renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Space><Text>{getTypeText(item.type)}</Text><Tag color={getStatusColor(item.status)}>{getStatusText(item.status)}</Tag></Space>}
                    description={<Space direction="vertical" size={0}><Text>{formatarMoeda(item.amount_cents)}</Text><Text type="secondary" style={{ fontSize: '12px' }}>{formatarData(item.created_at)}</Text></Space>}
                  />
                </List.Item>
              )} />
            )}
          </Card>
        </Col>
      </Row>

      <Modal title="Editar perfil" open={modalEditarVisible} onCancel={() => setModalEditarVisible(false)} onOk={() => form.submit()} okText="Salvar" cancelText="Cancelar" confirmLoading={saving}>
        <Form form={form} layout="vertical" onFinish={handleEditarPerfil}>
          <Form.Item name="name" label="Nome completo" rules={[{ required: true, min: 2, message: 'Informe seu nome.' }]}><Input prefix={<UserOutlined />} autoComplete="name" /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Informe um email válido.' }]}><Input prefix={<MailOutlined />} autoComplete="email" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Histórico completo de transações" open={modalHistoricoVisible} onCancel={() => setModalHistoricoVisible(false)} footer={null} width={800}>
        <List dataSource={historico} renderItem={(item) => (
          <List.Item>
            <List.Item.Meta title={<Space><Text>{getTypeText(item.type)}</Text><Tag color={getStatusColor(item.status)}>{getStatusText(item.status)}</Tag></Space>} description={<Space direction="vertical" size={0}><Text>{formatarMoeda(item.amount_cents)}</Text><Text type="secondary">{formatarData(item.created_at)}</Text>{item.metadata && <Text type="secondary">Metadados registrados no servidor.</Text>}</Space>} />
          </List.Item>
        )} />
      </Modal>
    </div>
  );
};

export default PerfilUsuario;
