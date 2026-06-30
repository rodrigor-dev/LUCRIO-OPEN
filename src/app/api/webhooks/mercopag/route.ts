import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const corpo = await request.json();
    const supabase = createClient();

    const assinaturaId = corpo.data?.id;
    const status = corpo.data?.status;

    if (!assinaturaId) {
      return NextResponse.json({ ok: true });
    }

    const statusMap: Record<string, string> = {
      authorized: "ativo",
      approved: "ativo",
      cancelled: "cancelado",
      denied: "atrasado",
      paused: "atrasado",
    };

    const statusSupabase = statusMap[status] || "pendente";

    await supabase
      .from("assinaturas")
      .update({ status: statusSupabase })
      .eq("intent_pagamento_id", String(assinaturaId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro no webhook Mercado Pago:", error);
    return NextResponse.json({ ok: true });
  }
}
