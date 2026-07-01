import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarRateLimit, obterChaveRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const chave = obterChaveRateLimit(request, "pagamentos");
    const rateLimit = verificarRateLimit(chave, 5, 60000);

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
    const { dados } = body;

    if (!dados || typeof dados !== "object") {
      return NextResponse.json(
        { erro: "Dados inválidos" },
        { status: 400 }
      );
    }

    const { valor, descricao, email } = dados;

    if (typeof valor !== "number" || valor <= 0 || valor > 100000) {
      return NextResponse.json(
        { erro: "Valor inválido. Deve ser um número entre 0.01 e 100.000" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { erro: "Email inválido" },
        { status: 400 }
      );
    }

    if (descricao && typeof descricao === "string" && descricao.length > 500) {
      return NextResponse.json(
        { erro: "Descrição muito longa (máximo 500 caracteres)" },
        { status: 400 }
      );
    }

    const { createMercoPagClient } = await import("@/services/mercopag.service");
    const mercopag = createMercoPagClient();

    const pagamento = await mercopag.criarPagamento({
      valor,
      descricao: String(descricao || "Assinatura LUCRIO").slice(0, 500),
      email: String(email),
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pagamento/sucesso`,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercopag`,
    });

    return NextResponse.json({ init_point: pagamento.init_point });
  } catch (error) {
    console.error("Erro ao criar pagamento:", error);
    return NextResponse.json(
      { erro: "Erro ao processar pagamento" },
      { status: 500 }
    );
  }
}
