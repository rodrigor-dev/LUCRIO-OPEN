import { NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(request: Request) {
  try {
    const { mensagens, dadosNegocio } = await request.json();

    const contextoSistema = `Você é o assistente financeiro do LUCRIO, um SaaS para prestadores de serviços.
    Você ajuda com:
    - Análise de despesas e receitas
    - Dicas para economizar
    - Análise de lucro e margem
    - Sugerir reajustes de preços
    - Mostrar clientes mais lucrativos
    - Criar metas financeiras
    - Explicar gráficos e indicadores
    - Planejamento financeiro

    Responda sempre em português brasileiro de forma clara e objetiva.
    Seja prestativo e profissional.

    ${dadosNegocio ? `Dados do negócio do usuário:\n${dadosNegocio}` : ""}`;

    const resposta = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL,
        "X-Title": "LUCRIO - Assistente Financeiro",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          { role: "system", content: contextoSistema },
          ...mensagens,
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.json();
      console.error("Erro OpenRouter:", erro);
      return NextResponse.json(
        { erro: "Erro ao comunicar com assistente IA" },
        { status: 500 }
      );
    }

    const dados = await resposta.json();
    const respostaTexto =
      dados.choices?.[0]?.message?.content ||
      "Desculpe, não consegui processar sua mensagem.";

    return NextResponse.json({ resposta: respostaTexto });
  } catch (error) {
    console.error("Erro na API de IA:", error);
    return NextResponse.json(
      { erro: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
