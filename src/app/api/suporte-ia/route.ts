import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarRateLimit, obterChaveRateLimit } from "@/lib/rate-limit";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const CONTEXTO_SUPORTE = `Você é o assistente de suporte do FATURION, um sistema de gestão financeira
para prestadores de serviços autônomos (o público geralmente não tem muita familiaridade com tecnologia).

Você ajuda respondendo dúvidas sobre COMO USAR o sistema, por exemplo:
- Como cadastrar um cliente, uma receita ou uma despesa
- Como gerar e enviar um orçamento em PDF
- Como funciona o período de teste grátis e a assinatura
- Como funciona o programa "Indique e Ganhe"
- Como mudar a situação de um cliente (ativo/inativo)
- Diferença entre cliente "fixo" e "esporádico"
- Dúvidas gerais de navegação no sistema

Regras importantes:
- Responda de forma MUITO simples, curta e direta, sem termos técnicos. Use passo a passo numerado quando fizer sentido.
- Se a dúvida for sobre um problema técnico específico da conta do usuário (erro, cobrança errada, bug, dado sumido, etc.) que você não tem como resolver só com informação, diga claramente que vai encaminhar para a equipe de suporte responder, e não invente uma solução.
- Nunca invente funcionalidades que não existem.
- Sempre responda em português brasileiro.`;

export async function POST(request: Request) {
  try {
    const chave = obterChaveRateLimit(request, "suporte-ia");
    const rateLimit = verificarRateLimit(chave, 10, 60000);

    if (!rateLimit.permitido) {
      return NextResponse.json(
        { erro: "Limite de perguntas atingido. Tente novamente em breve." },
        { status: 429 }
      );
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const pergunta = String(body.pergunta || "").slice(0, 2000);

    if (!pergunta.trim()) {
      return NextResponse.json({ erro: "Pergunta vazia" }, { status: 400 });
    }

    const resposta = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "FATURION - Suporte",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
        messages: [
          { role: "system", content: CONTEXTO_SUPORTE },
          { role: "user", content: pergunta },
        ],
        max_tokens: 600,
        temperature: 0.4,
      }),
    });

    if (!resposta.ok) {
      console.error("Erro OpenRouter (suporte):", resposta.status);
      return NextResponse.json(
        { erro: "Erro ao consultar o assistente. Sua dúvida foi encaminhada para nossa equipe." },
        { status: 500 }
      );
    }

    const dados = await resposta.json();
    const respostaTexto =
      dados.choices?.[0]?.message?.content ||
      "Não consegui responder essa automaticamente. Encaminhei sua dúvida para nossa equipe de suporte.";

    return NextResponse.json({ resposta: respostaTexto });
  } catch (error) {
    console.error("Erro na API de suporte IA:", error);
    return NextResponse.json({ erro: "Erro interno do servidor" }, { status: 500 });
  }
}
