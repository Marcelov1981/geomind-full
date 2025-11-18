import React, { useState, useEffect } from 'react';
import { Card, Steps, Button, Select, Form, Input, message, Spin, Divider, Typography, Space, Tag } from 'antd';
import { UserOutlined, HomeOutlined, DollarOutlined, FileSearchOutlined, FilePdfOutlined, CheckCircleOutlined } from '@ant-design/icons';
import relationshipService from '../services/relationshipService';
import validationService from '../services/validationService';

const { Step } = Steps;
const { Option } = Select;
const { Title, Text } = Typography;
const { TextArea } = Input;

const CompleteWorkflow = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  
  // Estados para dados do fluxo
  const [clientes, setClientes] = useState([]);
  
  // Estados para seleções atuais
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedProjeto, setSelectedProjeto] = useState(null);
  const [selectedOrcamento, setSelectedOrcamento] = useState(null);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const data = await relationshipService.getUserCompleteData();
      setClientes(data.clientes || []);
    } catch {
      message.error('Erro ao carregar dados iniciais');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: 'Cliente',
      icon: <UserOutlined />,
      description: 'Cadastrar ou selecionar cliente'
    },
    {
      title: 'Projeto',
      icon: <HomeOutlined />,
      description: 'Criar projeto para o cliente'
    },
    {
      title: 'Orçamento',
      icon: <DollarOutlined />,
      description: 'Gerar orçamento do projeto'
    },
    {
      title: 'Avaliação',
      icon: <FileSearchOutlined />,
      description: 'Realizar avaliação técnica'
    },
    {
      title: 'Laudo',
      icon: <FilePdfOutlined />,
      description: 'Gerar laudo final'
    }
  ];

  const handleClienteSubmit = async (values) => {
    try {
      setLoading(true);
      
      if (values.cliente_existente) {
        const cliente = clientes.find(c => c.id === values.cliente_existente);
        setSelectedCliente(cliente);
      } else {
        // Criar novo cliente
        const clienteData = {
          nome: values.nome,
          email: values.email,
          telefone: values.telefone,
          endereco: values.endereco
        };
        
        // Validar dados do cliente
        validationService.validateClientData(clienteData);
        
        const response = await relationshipService.createClientWithRelations(clienteData);
        if (response.data.success) {
          setSelectedCliente(response.data.data);
          await loadInitialData(); // Recarregar dados
        }
      }
      
      setCurrentStep(1);
      form.resetFields();
      message.success('Cliente selecionado/criado com sucesso!');
    } catch (error) {
      message.error(error.message || 'Erro ao processar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleProjetoSubmit = async (values) => {
    try {
      setLoading(true);
      
      const projetoData = {
        nome: values.nome,
        descricao: values.descricao,
        endereco: values.endereco,
        cliente_id: selectedCliente.id,
        status: 'New'
      };
      
      // Validar dados do projeto
      validationService.validateProjectData(projetoData);
      
      // Validar se cliente existe
      await validationService.validateClientExists(selectedCliente.id);
      
      const response = await relationshipService.createProjectWithRelations(projetoData);
      if (response.data.success) {
        setSelectedProjeto(response.data.data);
        await loadInitialData();
      }
      
      setCurrentStep(2);
      form.resetFields();
      message.success('Projeto criado com sucesso!');
    } catch (error) {
      message.error(error.message || 'Erro ao criar projeto');
    } finally {
      setLoading(false);
    }
  };

  const handleOrcamentoSubmit = async (values) => {
    try {
      setLoading(true);
      
      const orcamentoData = {
        descricao: values.descricao,
        valor: parseFloat(values.valor),
        projeto_id: selectedProjeto.id,
        cliente_id: selectedCliente.id,
        status: 'pendente'
      };
      
      // Validar dados do orçamento
      validationService.validateBudgetData(orcamentoData);
      
      // Validar cadeia de relacionamentos
      await validationService.validateProjectBelongsToClient(selectedProjeto.id, selectedCliente.id);
      
      const response = await relationshipService.createProjectBudgetAssociation(selectedProjeto.id, orcamentoData);
      if (response.data.success) {
        setSelectedOrcamento(response.data.data);
        await loadInitialData();
      }
      
      setCurrentStep(3);
      form.resetFields();
      message.success('Orçamento criado com sucesso!');
    } catch (error) {
      message.error(error.message || 'Erro ao criar orçamento');
    } finally {
      setLoading(false);
    }
  };

  const handleAvaliacaoSubmit = async (values) => {
    try {
      setLoading(true);
      
      const avaliacaoData = {
        metodologia_utilizada: values.metodologia,
        valor_final: parseFloat(values.valor_final),
        observacoes: values.observacoes,
        status: 'concluida',
        data_avaliacao: new Date().toISOString().split('T')[0],
        orcamento_id: selectedOrcamento.id,
        projeto_id: selectedProjeto.id,
        cliente_id: selectedCliente.id
      };
      
      // Validar dados da avaliação
      validationService.validateEvaluationData(avaliacaoData);
      
      // Validar toda a cadeia de relacionamentos
      await validationService.validateCompleteChain(
        selectedCliente.id,
        selectedProjeto.id,
        selectedOrcamento.id
      );
      
      const response = await relationshipService.createEvaluationWithRelations(avaliacaoData);
      if (response.data.success) {
        setSelectedAvaliacao(response.data.data);
        await loadInitialData();
      }
      
      setCurrentStep(4);
      form.resetFields();
      message.success('Avaliação criada com sucesso!');
    } catch (error) {
      message.error(error.message || 'Erro ao criar avaliação');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Form form={form} onFinish={handleClienteSubmit} layout="vertical">
            <Form.Item name="cliente_existente" label="Selecionar Cliente Existente (opcional)">
              <Select placeholder="Escolha um cliente existente" allowClear>
                {clientes.map(cliente => (
                  <Option key={cliente.id} value={cliente.id}>
                    {cliente.nome} - {cliente.email}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            
            <Divider>OU Criar Novo Cliente</Divider>
            
            <Form.Item name="nome" label="Nome" rules={[{ required: !form.getFieldValue('cliente_existente') }]}>
              <Input placeholder="Nome do cliente" />
            </Form.Item>
            
            <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
              <Input placeholder="email@exemplo.com" />
            </Form.Item>
            
            <Form.Item name="telefone" label="Telefone">
              <Input placeholder="(11) 99999-9999" />
            </Form.Item>
            
            <Form.Item name="endereco" label="Endereço">
              <TextArea placeholder="Endereço completo" rows={3} />
            </Form.Item>
            
            <Button type="primary" htmlType="submit" loading={loading}>
              Próximo: Criar Projeto
            </Button>
          </Form>
        );
        
      case 1:
        return (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text strong>Cliente Selecionado: </Text>
              <Tag color="blue">{selectedCliente?.nome}</Tag>
            </Card>
            
            <Form form={form} onFinish={handleProjetoSubmit} layout="vertical">
              <Form.Item name="nome" label="Nome do Projeto" rules={[{ required: true }]}>
                <Input placeholder="Nome do projeto" />
              </Form.Item>
              
              <Form.Item name="descricao" label="Descrição">
                <TextArea placeholder="Descrição do projeto" rows={3} />
              </Form.Item>
              
              <Form.Item name="endereco" label="Endereço do Projeto">
                <TextArea placeholder="Endereço onde será realizado o projeto" rows={2} />
              </Form.Item>
              
              <Space>
                <Button onClick={() => setCurrentStep(0)}>Voltar</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Próximo: Criar Orçamento
                </Button>
              </Space>
            </Form>
          </div>
        );
        
      case 2:
        return (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text strong>Cliente: </Text><Tag color="blue">{selectedCliente?.nome}</Tag>
              <Text strong> | Projeto: </Text><Tag color="green">{selectedProjeto?.nome}</Tag>
            </Card>
            
            <Form form={form} onFinish={handleOrcamentoSubmit} layout="vertical">
              <Form.Item name="descricao" label="Descrição do Orçamento" rules={[{ required: true }]}>
                <TextArea placeholder="Descrição detalhada do orçamento" rows={3} />
              </Form.Item>
              
              <Form.Item name="valor" label="Valor (R$)" rules={[{ required: true }]}>
                <Input type="number" step="0.01" placeholder="0.00" />
              </Form.Item>
              
              <Space>
                <Button onClick={() => setCurrentStep(1)}>Voltar</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Próximo: Criar Avaliação
                </Button>
              </Space>
            </Form>
          </div>
        );
        
      case 3:
        return (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Text strong>Cliente: </Text><Tag color="blue">{selectedCliente?.nome}</Tag>
              <Text strong> | Projeto: </Text><Tag color="green">{selectedProjeto?.nome}</Tag>
              <Text strong> | Orçamento: </Text><Tag color="orange">R$ {selectedOrcamento?.valor}</Tag>
            </Card>
            
            <Form form={form} onFinish={handleAvaliacaoSubmit} layout="vertical">
              <Form.Item name="metodologia" label="Metodologia" rules={[{ required: true }]}>
                <Select placeholder="Selecione a metodologia">
                  <Option value="Análise de Imagens com IA">Análise de Imagens com IA</Option>
                  <Option value="Avaliação Presencial">Avaliação Presencial</Option>
                  <Option value="Análise Documental">Análise Documental</Option>
                  <Option value="Comparativo de Mercado">Comparativo de Mercado</Option>
                </Select>
              </Form.Item>
              
              <Form.Item name="valor_final" label="Valor Final da Avaliação (R$)" rules={[{ required: true }]}>
                <Input type="number" step="0.01" placeholder="0.00" />
              </Form.Item>
              
              <Form.Item name="observacoes" label="Observações">
                <TextArea placeholder="Observações da avaliação" rows={4} />
              </Form.Item>
              
              <Space>
                <Button onClick={() => setCurrentStep(2)}>Voltar</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Próximo: Gerar Laudo
                </Button>
              </Space>
            </Form>
          </div>
        );
        
      case 4:
        return (
          <div>
            <Card>
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
                <Title level={3}>Fluxo Completo Finalizado!</Title>
                
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Card size="small">
                    <Text strong>Resumo do Processo:</Text>
                    <div style={{ marginTop: 8 }}>
                      <p><Text strong>Cliente:</Text> {selectedCliente?.nome}</p>
                      <p><Text strong>Projeto:</Text> {selectedProjeto?.nome}</p>
                      <p><Text strong>Orçamento:</Text> R$ {selectedOrcamento?.valor}</p>
                      <p><Text strong>Avaliação:</Text> {selectedAvaliacao?.metodologia_utilizada}</p>
                      <p><Text strong>Valor Final:</Text> R$ {selectedAvaliacao?.valor_final}</p>
                    </div>
                  </Card>
                  
                  <Space>
                    <Button type="primary" icon={<FilePdfOutlined />}>
                      Gerar Laudo PDF
                    </Button>
                    <Button onClick={() => {
                      setCurrentStep(0);
                      setSelectedCliente(null);
                      setSelectedProjeto(null);
                      setSelectedOrcamento(null);
                      setSelectedAvaliacao(null);
                      form.resetFields();
                    }}>
                      Iniciar Novo Fluxo
                    </Button>
                  </Space>
                </Space>
              </div>
            </Card>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <Title level={2}>Fluxo Completo: Cadastro até Laudo</Title>
      <Text type="secondary">
        Este fluxo demonstra o processo completo desde o cadastro do cliente até a geração do laudo final,
        mostrando como todas as entidades se relacionam.
      </Text>
      
      <Card style={{ marginTop: 20 }}>
        <Steps current={currentStep} style={{ marginBottom: 30 }}>
          {steps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.description}
              icon={step.icon}
            />
          ))}
        </Steps>
        
        <Spin spinning={loading}>
          {renderStepContent()}
        </Spin>
      </Card>
    </div>
  );
};

export default CompleteWorkflow;