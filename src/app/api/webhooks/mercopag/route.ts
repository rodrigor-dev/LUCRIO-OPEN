import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarRateLimit, obterChaveRateLimit } from "@/lib/rate-limit";

async function verificarAssinatura(
  body: string,
  assinatura: string | null,
  secreto: string
): Promise<boolean> {
  if (!assinatura || !secreto) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secreto),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return signatureHex === assinatura;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const chave = obterChaveRateLimit(request, "webhook-mercopag");
    const rateLimit = verificarRateLimit(chave, 30, 60000);

    if (!rateLimit.permitido) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const corpoRaw = await request.text();

    const assinatura = request.headers.get("x-signature");
    const secreto = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (!secreto) {
      return NextResponse.json({ erro: "Webhook secret não configurado" }, { status: 500 });
    }

    const assinaturaValida = await verificarAssinatura(corpoRaw, assinatura, secreto);
    if (!assinaturaValida) {
      console.error("Assinatura do webhook MercadoPago inválida");
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const corpo = JSON.parse(corpoRaw);
    const supabase = createClient();

    const pagamentoId = corpo.data?.id;
    const status = corpo.data?.status;

    if (!pagamentoId) {
      return NextResponse.json({ ok: true });
    }

    const statusMap: Record<string, string> = {
      authorized: "ativo",
      approved: "ativo",
      cancelled: "cancelado",
      denied: "atrasado",
      paused: "atrasado",
      refunded: "cancelado",
      charged_back: "cancelado",
      expired: "cancelado",
    };

    const statusSupabase = statusMap[status] || "pendente";

    await supabase
      .from("assinaturas")
      .update({ status: statusSupabase })
      .eq("intent_pagamento_id", String(pagamentoId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro no webhook Mercado Pago:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
