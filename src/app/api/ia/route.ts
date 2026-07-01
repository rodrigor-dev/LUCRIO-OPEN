import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarRateLimit, obterChaveRateLimit } from "@/lib/rate-limit";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(request: Request) {
  try {
    const chave = obterChaveRateLimit(request, "ia");
    const rateLimit = verificarRateLimit(chave, 10, 60000);

    if (!rateLimit.permitido) {
      return NextResponse.json(
        { erro: "Limite de requisições atingido. Tente novamente em breve." },
        { status: 429 }
      );
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { erro: "Não autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { mensagens, dadosNegocio } = body;

    if (!mensagens || !Array.isArray(mensagens) || mensagens.length === 0) {
      return NextResponse.json(
        { erro: "Mensagens inválidas" },
        { status: 400 }
      );
    }

    if (mensagens.length > 20) {
      return NextResponse.json(
        { erro: "Máximo de 20 mensagens por requisição" },
        { status: 400 }
      );
    }

    const mensagensValidadas = mensagens.map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: String(msg.content || "").slice(0, 2000),
    }));

    const dadosNegocioSanitizado = dadosNegocio
      ? String(dadosNegocio).slice(0, 5000).replace(/<[^>]*>/g, "")
      : "";

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

    ${dadosNegocioSanitizado ? `Dados do negócio do usuário:\n${dadosNegocioSanitizado}` : ""}`;

    const resposta = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "LUCRIO - Assistente Financeiro",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          { role: "system", content: contextoSistema },
          ...mensagensValidadas,
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!resposta.ok) {
      console.error("Erro OpenRouter:", resposta.status);
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
