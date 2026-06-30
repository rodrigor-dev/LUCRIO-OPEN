import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface MensagemIA {
  role: "user" | "assistant";
  content: string;
}

export async function enviarMensagem(
  mensagens: MensagemIA[],
  dadosNegocio?: string
): Promise<string> {
  try {
    const resposta = await fetch("/api/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagens, dadosNegocio }),
    });

    if (!resposta.ok) {
      throw new Error("Erro ao comunicar com assistente IA");
    }

    const dados = await resposta.json();
    return dados.resposta;
  } catch (error) {
    console.error("Erro IA:", error);
    return "Desculpe, não consegui processar sua mensagem. Tente novamente.";
  }
}

export async function obterAnaliseFinanceira(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "Faça login para ver sua análise financeira.";

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id")
    .eq("usuario_id", user.id)
    .single();

  if (!negocio) return "Nenhum negócio encontrado.";

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [receitas, despesas] = await Promise.all([
    supabase
      .from("receitas")
      .select("valor, data")
      .eq("negocio_id", negocio.id)
      .gte("data", inicioMes)
      .eq("status", "pago"),
    supabase
      .from("despesas")
      .select("valor, data")
      .eq("negocio_id", negocio.id)
      .gte("data", inicioMes)
      .eq("status", "pago"),
  ]);

  const receitaTotal =
    receitas.data?.reduce((acc, r) => acc + r.valor, 0) || 0;
  const despesaTotal =
    despesas.data?.reduce((acc, d) => acc + d.valor, 0) || 0;
  const lucro = receitaTotal - despesaTotal;

  const contexto = `
    Dados financeiros do mês atual:
    - Receitas: R$ ${receitaTotal.toFixed(2)}
    - Despesas: R$ ${despesaTotal.toFixed(2)}
    - Lucro: R$ ${lucro.toFixed(2)}
    - Margem: ${receitaTotal > 0 ? ((lucro / receitaTotal) * 100).toFixed(1) : 0}%
  `;

  const resposta = await enviarMensagem(
    [
      {
        role: "user",
        content: `Analise meus dados financeiros e dê dicas para melhorar: ${contexto}`,
      },
    ],
    contexto
  );

  return resposta;
}
