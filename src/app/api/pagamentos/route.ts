import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { dados } = await request.json();

    const { createMercoPagClient } = await import("@/services/mercopag.service");
    const mercopag = createMercoPagClient();

    const pagamento = await mercopag.criarPagamento({
      valor: dados.valor,
      descricao: dados.descricao,
      email: dados.email,
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
