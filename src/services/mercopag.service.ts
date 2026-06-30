interface DadosPagamento {
  valor: number;
  descricao: string;
  email: string;
  redirectUrl: string;
  webhookUrl: string;
}

interface PagamentoCriado {
  id: string;
  init_point: string;
  status: string;
}

const MERCOPAG_API = "https://api.mercadopago.com/v1";

function obterTokenAcesso(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado");
  }
  return token;
}

export function createMercoPagClient() {
  const token = obterTokenAcesso();

  return {
    async criarPagamento(dados: DadosPagamento): Promise<PagamentoCriado> {
      const resposta = await fetch(`${MERCOPAG_API}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_amount: dados.valor,
          description: dados.descricao,
          payer: {
            email: dados.email,
          },
          external_reference: `LUCRIO-${Date.now()}`,
          back_urls: {
            success: dados.redirectUrl,
            failure: dados.redirectUrl,
            pending: dados.redirectUrl,
          },
          auto_return: "approved",
          notification_url: dados.webhookUrl,
        }),
      });

      if (!resposta.ok) {
        const erro = await resposta.json();
        throw new Error(
          erro.message || "Erro ao criar pagamento no Mercado Pago"
        );
      }

      const pagamento = await resposta.json();

      return {
        id: pagamento.id,
        init_point: pagamento.init_point,
        status: pagamento.status,
      };
    },

    async consultarPagamento(idPagamento: string) {
      const resposta = await fetch(
        `${MERCOPAG_API}/payments/${idPagamento}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resposta.ok) {
        throw new Error("Erro ao consultar pagamento");
      }

      return resposta.json();
    },

    async criarAssinatura(dados: {
      valor: number;
      descricao: string;
      email: string;
      frequency: number;
      frequency_type: string;
    }) {
      const resposta = await fetch(`${MERCOPAG_API}/preapproval`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: dados.descricao,
          auto_recurring: {
            frequency: dados.frequency,
            frequency_type: dados.frequency_type,
            transaction_amount: dados.valor,
            currency_id: "BRL",
          },
          payer_email: dados.email,
          status: "pending",
        }),
      });

      if (!resposta.ok) {
        const erro = await resposta.json();
        throw new Error(
          erro.message || "Erro ao criar assinatura"
        );
      }

      return resposta.json();
    },
  };
}
