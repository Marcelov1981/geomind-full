import React, { useState, useEffect } from 'react';
import Modal from './Modal';

const PrivacidadeLGPD = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [consentimentos, setConsentimentos] = useState({
    coleta_dados: false,
    uso_dados: false,
    compartilhamento: false,
    marketing: false,
    cookies: false
  });
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConsentimentos();
    }
  }, [isOpen]);

  const loadConsentimentos = async () => {
    try {
      setLoading(true);
      
      

      // Carregar consentimentos salvos do localStorage ou API
      const savedConsents = localStorage.getItem('lgpd_consentimentos');
      if (savedConsents) {
        setConsentimentos(JSON.parse(savedConsents));
      }
    } catch (error) {
      console.error('Erro ao carregar consentimentos:', error);
      setError('Erro ao carregar configurações de privacidade');
    } finally {
      setLoading(false);
    }
  };

  const handleConsentChange = (tipo, valor) => {
    const novosConsentimentos = {
      ...consentimentos,
      [tipo]: valor
    };
    
    setConsentimentos(novosConsentimentos);
    
    // Salvar no localStorage
    localStorage.setItem('lgpd_consentimentos', JSON.stringify(novosConsentimentos));
    
    // Log da ação
    const logEntry = {
      timestamp: new Date().toISOString(),
      acao: 'CONSENT_UPDATE',
      detalhes: `Consentimento ${tipo} ${valor ? 'concedido' : 'revogado'}`
    };
    
    // Salvar log
    const existingLogs = JSON.parse(localStorage.getItem('lgpd_logs') || '[]');
    existingLogs.push(logEntry);
    localStorage.setItem('lgpd_logs', JSON.stringify(existingLogs));
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      // Carregar logs do localStorage
      const savedLogs = JSON.parse(localStorage.getItem('lgpd_logs') || '[]');
      setLogs(savedLogs);
      setShowLogs(true);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      setError('Erro ao carregar histórico de atividades');
    } finally {
      setLoading(false);
    }
  };

  const exportarDados = async () => {
    try {
      setLoading(true);
      
      

      // Simular exportação de dados
      const dadosUsuario = {
        perfil: JSON.parse(localStorage.getItem('user_profile') || '{}'),
        consentimentos: consentimentos,
        logs: JSON.parse(localStorage.getItem('lgpd_logs') || '[]'),
        configuracoes: JSON.parse(localStorage.getItem('app_settings') || '{}'),
        timestamp_exportacao: new Date().toISOString()
      };

      // Criar arquivo para download
      const dataStr = JSON.stringify(dadosUsuario, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `meus_dados_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess('Dados exportados com sucesso!');
      
      // Log da ação
      const logEntry = {
        timestamp: new Date().toISOString(),
        acao: 'DATA_EXPORT',
        detalhes: 'Dados pessoais exportados pelo usuário'
      };
      
      const existingLogs = JSON.parse(localStorage.getItem('lgpd_logs') || '[]');
      existingLogs.push(logEntry);
      localStorage.setItem('lgpd_logs', JSON.stringify(existingLogs));
      
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      setError('Erro ao exportar dados');
    } finally {
      setLoading(false);
    }
  };

  const solicitarExclusao = async () => {
    try {
      setLoading(true);
      
      

      // Simular solicitação de exclusão
      const solicitacao = {
        timestamp: new Date().toISOString(),
        status: 'pendente',
        prazo_exclusao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 dias
      };
      
      localStorage.setItem('lgpd_solicitacao_exclusao', JSON.stringify(solicitacao));
      
      // Log da ação
      const logEntry = {
        timestamp: new Date().toISOString(),
        acao: 'DELETE_REQUEST',
        detalhes: 'Solicitação de exclusão de dados enviada'
      };
      
      const existingLogs = JSON.parse(localStorage.getItem('lgpd_logs') || '[]');
      existingLogs.push(logEntry);
      localStorage.setItem('lgpd_logs', JSON.stringify(existingLogs));

      setSuccess('Solicitação de exclusão enviada. Você receberá uma confirmação em até 72 horas.');
      setShowDeleteAccount(false);
      
    } catch (error) {
      console.error('Erro ao solicitar exclusão:', error);
      setError('Erro ao processar solicitação de exclusão');
    } finally {
      setLoading(false);
    }
  };

  const limparLogs = () => {
    localStorage.removeItem('lgpd_logs');
    setLogs([]);
    setSuccess('Histórico de atividades limpo');
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Privacidade e Proteção de Dados (LGPD)">
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Seção de Consentimentos */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Gerenciar Consentimentos</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Coleta de Dados</label>
                <p className="text-sm text-gray-600">Permitir coleta de dados pessoais para funcionamento do sistema</p>
              </div>
              <input
                type="checkbox"
                checked={consentimentos.coleta_dados}
                onChange={(e) => handleConsentChange('coleta_dados', e.target.checked)}
                className="h-4 w-4 text-blue-600"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Uso de Dados</label>
                <p className="text-sm text-gray-600">Permitir uso dos dados para melhorar a experiência do usuário</p>
              </div>
              <input
                type="checkbox"
                checked={consentimentos.uso_dados}
                onChange={(e) => handleConsentChange('uso_dados', e.target.checked)}
                className="h-4 w-4 text-blue-600"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Compartilhamento</label>
                <p className="text-sm text-gray-600">Permitir compartilhamento com parceiros autorizados</p>
              </div>
              <input
                type="checkbox"
                checked={consentimentos.compartilhamento}
                onChange={(e) => handleConsentChange('compartilhamento', e.target.checked)}
                className="h-4 w-4 text-blue-600"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Marketing</label>
                <p className="text-sm text-gray-600">Receber comunicações de marketing e promoções</p>
              </div>
              <input
                type="checkbox"
                checked={consentimentos.marketing}
                onChange={(e) => handleConsentChange('marketing', e.target.checked)}
                className="h-4 w-4 text-blue-600"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium">Cookies</label>
                <p className="text-sm text-gray-600">Permitir uso de cookies para melhorar a navegação</p>
              </div>
              <input
                type="checkbox"
                checked={consentimentos.cookies}
                onChange={(e) => handleConsentChange('cookies', e.target.checked)}
                className="h-4 w-4 text-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Seção de Direitos do Titular */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Seus Direitos</h3>
          <div className="space-y-3">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Visualizar Histórico de Atividades</div>
              <div className="text-sm text-gray-600">Ver todas as ações realizadas com seus dados</div>
            </button>
            
            <button
              onClick={exportarDados}
              disabled={loading}
              className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Exportar Meus Dados</div>
              <div className="text-sm text-gray-600">Baixar uma cópia de todos os seus dados</div>
            </button>
            
            <button
              onClick={() => setShowDeleteAccount(true)}
              disabled={loading}
              className="w-full text-left p-3 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-700"
            >
              <div className="font-medium">Solicitar Exclusão de Dados</div>
              <div className="text-sm text-red-600">Remover permanentemente todos os seus dados</div>
            </button>
          </div>
        </div>

        {/* Modal de Logs */}
        {showLogs && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold">Histórico de Atividades</h4>
                <div className="space-x-2">
                  <button
                    onClick={limparLogs}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={() => setShowLogs(false)}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Fechar
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-gray-500">Nenhuma atividade registrada</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="font-medium">{log.acao}</div>
                      <div className="text-sm text-gray-600">{log.detalhes}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteAccount && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
              <h4 className="text-lg font-semibold mb-4 text-red-700">Confirmar Exclusão de Dados</h4>
              <p className="text-gray-600 mb-4">
                Esta ação é irreversível. Todos os seus dados serão permanentemente removidos do sistema em até 30 dias.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Você pode cancelar esta solicitação entrando em contato conosco dentro de 72 horas.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={solicitarExclusao}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Confirmar Exclusão'}
                </button>
                <button
                  onClick={() => setShowDeleteAccount(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Informações Legais */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Informações sobre Proteção de Dados</h4>
          <p className="text-sm text-gray-700">
            Este sistema está em conformidade com a Lei Geral de Proteção de Dados (LGPD). 
            Seus dados são tratados com segurança e transparência. Para mais informações, 
            consulte nossa Política de Privacidade.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default PrivacidadeLGPD;