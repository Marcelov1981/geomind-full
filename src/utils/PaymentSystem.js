import api, { API_ENDPOINTS } from '../config/api';

export const TIPOS_TRANSACAO = {
  CONSULTA_AVULSA: 'usage',
  ASSINATURA_MENSAL: 'subscription',
  UPGRADE_PLANO: 'subscription',
  CREDITO_ADICIONAL: 'top_up',
};

export const STATUS_TRANSACAO = {
  PENDENTE: 'pending',
  PROCESSANDO: 'processing',
  APROVADA: 'approved',
  REJEITADA: 'rejected',
  CANCELADA: 'cancelled',
  ESTORNADA: 'refunded',
};

export const METODOS_PAGAMENTO = {
  CARTAO_CREDITO: 'card',
  PIX: 'pix',
  BOLETO: 'boleto',
  CREDITOS: 'credits',
};

const CREDIT_COST_CENTS = 100;

class PaymentSystem {
  constructor() {
    this.transacoes = [];
    this.creditos = 0;
    this.estatisticas = { balance_cents: 0, monthly_used: 0 };
    this.refreshPromise = null;
  }

  async atualizarDados() {
    if (!this.refreshPromise) {
      this.refreshPromise = Promise.all([
        api.get(API_ENDPOINTS.billing.summary),
        api.get(API_ENDPOINTS.billing.transactions),
      ]).then(([summaryResponse, transactionsResponse]) => {
        this.estatisticas = summaryResponse.data || {};
        this.creditos = Number(this.estatisticas.balance_cents || 0);
        this.transacoes = transactionsResponse.data || [];
        return this.estatisticas;
      }).finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }

  obterEstatisticas() {
    return { ...this.estatisticas, creditosDisponiveis: this.creditos };
  }

  obterHistoricoTransacoes() {
    return [...this.transacoes];
  }

  podeRealizarConsulta() {
    if (this.creditos >= CREDIT_COST_CENTS) return { pode: true, metodo: METODOS_PAGAMENTO.CREDITOS };
    return { pode: false, motivo: 'Saldo de créditos insuficiente. Adicione créditos pelo gateway de pagamento.' };
  }

  async processarConsultaAvulsa(dadosConsulta = {}, metodoPagamento = METODOS_PAGAMENTO.CREDITOS) {
    if (metodoPagamento !== METODOS_PAGAMENTO.CREDITOS) {
      return { sucesso: false, mensagem: 'Configure um gateway de pagamento antes de usar pagamento avulso.' };
    }
    const response = await api.post(API_ENDPOINTS.billing.consume, {
      amount_cents: CREDIT_COST_CENTS,
      type: TIPOS_TRANSACAO.CONSULTA_AVULSA,
      metadata: dadosConsulta,
    });
    await this.atualizarDados();
    return response.data;
  }

  async adicionarCreditos(valor, metodoPagamento = METODOS_PAGAMENTO.CARTAO_CREDITO, providerPaymentId = null) {
    const response = await api.post(API_ENDPOINTS.billing.topUp, {
      amount_cents: Number(valor),
      payment_method: metodoPagamento,
      provider_payment_id: providerPaymentId,
    });
    await this.atualizarDados();
    return response.data;
  }
}

const paymentSystem = new PaymentSystem();
export { PaymentSystem };
export default paymentSystem;
