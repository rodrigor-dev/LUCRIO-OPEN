import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarRateLimit, obterChaveRateLimit } from "@/lib/rate-limit";
import { montarLinkCheckout, type PlanoTipo } from "@/services/cakto.service";

/**
 * Devolve o link do checkout da Cakto para o plano escolhido.
 * O preço fica configurado na oferta da Cakto (antes o valor vinha do
 * navegador e podia ser alterado pelo usuário).
 */
export async function POST(request: Request) {
  try {
    const chave = obterChaveRateLimit(request, "pagamentos");
    const rateLimit = verificarRateLimit(chave, 10, 300000);

    if (!rateLimit.permitido) {
      return NextResponse.json(
        { erro: "Limite de requisições atingido. Tente novamente em breve." },
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

    const body = await request.json().catch(() => ({}));
    const planoBruto = body?.plano ?? body?.dados?.plano;
    const plano: PlanoTipo = planoBruto === "anual" ? "anual" : "mensal";

    const url = montarLinkCheckout(plano, user.id);

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const mensagem = error instanceof Error ? error.message : String(error);
    console.error("[PAGAMENTOS] Erro:", mensagem);
    return NextResponse.json(
      { erro: "Não foi possível abrir o pagamento agora. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
