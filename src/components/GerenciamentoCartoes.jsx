import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Typography, List, Modal, message, Tag, Popconfirm, Alert, Checkbox } from 'antd';
import { CreditCardOutlined, PlusOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import api, { API_ENDPOINTS } from '../config/api';

const { Title, Text } = Typography;

const GerenciamentoCartoes = ({ onCardSaved, onCardDeleted }) => {
  const [cartoes, setCartoes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const carregarCartoes = async () => {
    setLoadingList(true);
    try {
      const response = await api.get(API_ENDPOINTS.billing.methods);
      setCartoes(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error(error.response?.data?.error || 'Não foi possível carregar os métodos de pagamento.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    carregarCartoes();
  }, []);

  const fecharModal = () => {
    setModalVisible(false);
    form.resetFields();
  };

  const handleSaveCard = async (values) => {
    setLoading(true);
    try {
      const response = await api.post(API_ENDPOINTS.billing.methods, {
        provider: values.provider.trim(),
        provider_token: values.provider_token.trim(),
        brand: values.brand?.trim() || null,
        last4: values.last4?.trim() || null,
        is_default: Boolean(values.is_default),
      });
      const method = response.data;
      setCartoes((current) => [method, ...current.filter((item) => item.id !== method.id)]);
      message.success('Método de pagamento tokenizado adicionado.');
      onCardSaved?.(method);
      fecharModal();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao salvar método de pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCard = async (cartaoId) => {
    try {
      await api.delete(`${API_ENDPOINTS.billing.methods}/${encodeURIComponent(cartaoId)}`);
      setCartoes((current) => current.filter((item) => item.id !== cartaoId));
      onCardDeleted?.(cartaoId);
      message.success('Método de pagamento removido.');
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao remover método de pagamento.');
    }
  };

  const getBandeiraColor = (bandeira) => {
    switch ((bandeira || '').toLowerCase()) {
      case 'visa': return '#1A1F71';
      case 'mastercard': return '#EB001B';
      case 'american express': return '#006FCF';
      default: return '#666';
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <Title level={3}>Métodos de pagamento</Title>
          <Text type="secondary">Gerencie referências tokenizadas pelo seu provedor de pagamentos.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          Adicionar método
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<LockOutlined />}
        message="Segurança dos dados"
        description="O GeoMind não coleta nem armazena número completo, validade ou CVV. Use o checkout/tokenização do provedor escolhido e informe aqui apenas o token retornado, a bandeira e os quatro últimos dígitos."
        style={{ marginBottom: '24px' }}
      />

      {cartoes.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px' }} loading={loadingList}>
          <CreditCardOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <Title level={4} type="secondary">Nenhum método cadastrado</Title>
          <Text type="secondary">Adicione um token gerado pelo gateway de pagamentos configurado.</Text>
        </Card>
      ) : (
        <List
          loading={loadingList}
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
          dataSource={cartoes}
          renderItem={(cartao) => (
            <List.Item>
              <Card
                style={{
                  background: cartao.is_default ? 'linear-gradient(135deg, #334155 0%, #0f172a 100%)' : '#f8fafc',
                  color: cartao.is_default ? 'white' : '#0f172a',
                  border: cartao.is_default ? 'none' : '1px solid #e2e8f0',
                }}
                actions={[
                  <Popconfirm
                    key="delete"
                    title="Remover método"
                    description="Tem certeza que deseja remover esta referência tokenizada?"
                    onConfirm={() => handleDeleteCard(cartao.id)}
                    okText="Sim"
                    cancelText="Não"
                  >
                    <Button type="text" icon={<DeleteOutlined />} style={{ color: cartao.is_default ? 'white' : '#dc2626' }} />
                  </Popconfirm>,
                ]}
              >
                <div style={{ marginBottom: '16px' }}>
                  {cartao.is_default && <Tag color="gold" style={{ marginBottom: '8px' }}>PRINCIPAL</Tag>}
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                    <CreditCardOutlined /> {' '}•••• •••• •••• {cartao.last4 || '----'}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    Provedor: {cartao.provider}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: cartao.is_default ? 'white' : '#475569' }}>Token protegido</Text>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: getBandeiraColor(cartao.brand) }}>
                    {cartao.brand || 'Não informado'}
                  </div>
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}

      <Modal
        title="Adicionar método tokenizado"
        open={modalVisible}
        onCancel={fecharModal}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveCard} size="large">
          <Form.Item
            name="provider"
            label="Provedor"
            extra="Ex.: stripe, mercadopago ou outro gateway configurado no backend."
            rules={[{ required: true, min: 2, message: 'Informe o provedor.' }]}
          >
            <Input placeholder="stripe" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="provider_token"
            label="Token retornado pelo provedor"
            extra="Não informe número de cartão, validade ou CVV neste campo."
            rules={[{ required: true, min: 8, message: 'Informe um token válido retornado pelo gateway.' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="tok_..." autoComplete="off" />
          </Form.Item>
          <Form.Item name="brand" label="Bandeira">
            <Input placeholder="Visa" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="last4"
            label="Quatro últimos dígitos"
            rules={[{ pattern: /^$|^\d{4}$/, message: 'Informe exatamente quatro dígitos.' }]}
          >
            <Input inputMode="numeric" maxLength={4} placeholder="4242" autoComplete="off" />
          </Form.Item>
          <Form.Item name="is_default" valuePropName="checked">
            <Checkbox>Tornar método principal</Checkbox>
          </Form.Item>
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <Button onClick={fecharModal} style={{ flex: 1 }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={loading} style={{ flex: 1 }}>Salvar referência</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default GerenciamentoCartoes;
