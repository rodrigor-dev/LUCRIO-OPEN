import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EVENTOS_TRATADOS,
  ehUuid,
  idOfertaDoLink,
  planoDaOferta,
  webhookEhAutentico,
} from "@/services/cakto.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PayloadCakto = {
  secret?: unknown;
  event?: string;
  data?: {
    id?: string;
    refId?: string;
    status?: string;
    callback?: string;
    customer?: { email?: string; name?: string };
    offer?: { id?: string; name?: string };
    checkoutUrl?: string | null;
    product?: { id?: string; name?: string };
    subscription?: unknown;
  };
};

export async function POST(request: Request) {
  const segredo = process.env.CAKTO_WEBHOOK_SECRET;
  if (!segredo) {
    console.error("[CAKTO] CAKTO_WEBHOOK_SECRET não configurado — webhook recusado.");
    return NextResponse.json({ ok: false, erro: "não configurado" }, { status: 500 });
  }

  const corpoCru = await request.text();

  let payload: PayloadCakto;
  try {
    payload = JSON.parse(corpoCru);
  } catch {
    return NextResponse.json({ ok: false, erro: "json inválido" }, { status: 400 });
  }

  const autentico = webhookEhAutentico({
    corpoCru,
    secretNoCorpo: payload.secret,
    assinatura: request.headers.get("x-cakto-signature"),
    timestamp: request.headers.get("x-cakto-timestamp"),
    segredo,
  });

  if (!autentico) {
    console.warn("[CAKTO] Assinatura inválida — ignorando chamada.");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const evento = payload.event ?? "";
  const dados = payload.data ?? {};

  // Eventos que não mudam a assinatura (pix gerado, checkout abandonado...)
  if (!EVENTOS_TRATADOS.has(evento) || !dados.id) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const plano =
    planoDaOferta(dados.offer?.id) ?? planoDaOferta(idOfertaDoLink(dados.checkoutUrl ?? undefined));
  if (!plano) {
    console.error(
      `[CAKTO] Oferta "${dados.offer?.id}" não é nenhuma das ofertas configuradas ` +
        "(CAKTO_CHECKOUT_MENSAL_URL / CAKTO_CHECKOUT_ANUAL_URL). Evento ignorado:",
      evento,
      dados.refId
    );
    return NextResponse.json({ ok: true, ignorado: true });
  }

  try {
    const supabase = createAdminClient();

    // 1) Usuário pelo callback do link de checkout
    let usuarioId: string | null = null;
    if (ehUuid(dados.callback)) {
      const { data } = await supabase
        .from("usuarios")
        .select("id")
        .eq("id", dados.callback)
        .maybeSingle();
      usuarioId = data?.id ?? null;
    }

    // 2) Reserva: e-mail do comprador (ex.: link compartilhado sem callback)
    const email = dados.customer?.email?.trim().toLowerCase();
    if (!usuarioId && email) {
      const { data } = await supabase
        .from("usuarios")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      usuarioId = data?.id ?? null;
    }

    // Guarda só o essencial do payload (sem o secret)
    const payloadSalvo = {
      event: evento,
      data: {
        id: dados.id,
        refId: dados.refId,
        status: dados.status,
        callback: dados.callback,
        customer: { email: dados.customer?.email, name: dados.customer?.name },
        offer: dados.offer,
        product: dados.product,
        subscription: dados.subscription ?? null,
      },
    };

    const { data: resultado, error } = await supabase.rpc("processar_evento_pagamento", {
      p_evento_id: `${evento}:${dados.id}`,
      p_evento: evento,
      p_pedido_id: dados.refId || dados.id,
      p_usuario_id: usuarioId,
      p_plano: plano,
      p_payload: payloadSalvo,
    });

    if (error) {
      console.error("[CAKTO] Erro ao processar evento:", evento, dados.refId, error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    if (resultado === "usuario_nao_encontrado") {
      console.error(
        `[CAKTO] Pagamento ${dados.refId} sem usuário correspondente (callback=${dados.callback}, email=${email}). ` +
          "Libere manualmente no painel admin."
      );
    } else {
      console.log(`[CAKTO] ${evento} ${dados.refId} → ${resultado}`);
    }

    return NextResponse.json({ ok: true, resultado });
  } catch (erro) {
    console.error("[CAKTO] Erro inesperado:", erro);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
