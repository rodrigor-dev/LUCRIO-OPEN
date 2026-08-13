import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarRateLimit, obterChaveRateLimit } from "@/lib/rate-limit";

async function verificarAssinatura(
  body: string,
  headerAssinatura: string | null,
  secreto: string
): Promise<boolean> {
  if (!headerAssinatura || !secreto) return false;

  try {
    // Mercado Pago envia: ts=1234567890;v1=abcdef123456...
    const partes = headerAssinatura.split(";");
    let ts = "";
    let v1 = "";

    for (const parte of partes) {
      const [chave, valor] = parte.split("=");
      if (chave === "ts") ts = valor;
      if (chave === "v1") v1 = valor;
    }

    if (!ts || !v1) return false;

    // HMAC com o Webhook Secret
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secreto),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const mensagem = `${ts}.${body}`;
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(mensagem));
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return signatureHex === v1;
  } catch (error) {
    console.error("[WEBHOOK] Erro ao verificar assinatura:", error);
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
    const headerAssinatura = request.headers.get("x-signature");
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (webhookSecret) {
      const assinaturaValida = await verificarAssinatura(corpoRaw, headerAssinatura, webhookSecret);
      if (!assinaturaValida) {
        console.error("[WEBHOOK] Assinatura inválida, ignorando");
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    } else {
      console.warn("[WEBHOOK] MERCADO_PAGO_WEBHOOK_SECRET não configurado, pulando verificação");
    }

    const corpo = JSON.parse(corpoRaw);

    console.log("[WEBHOOK] Notificação recebida:", JSON.stringify(corpo).slice(0, 500));

    // Mercado Pago envia notificações de pagamento via webhook
    const action = corpo.action;
    const tipo = corpo.type; // "payment"

    // Buscar dados do pagamento
    let pagamentoId = corpo.data?.id;
    let status = corpo.data?.status;
    let externalReference: string | undefined = corpo.data?.external_reference;

    // Sempre buscamos os detalhes completos do pagamento (não só quando
    // falta o status): é de lá que vem o external_reference com o
    // usuario_id real, que é a forma confiável de saber de quem é esse
    // pagamento — funciona mesmo se o navegador do usuário nunca voltou
    // pro site (Pix, boleto, ou pagamento aprovado só depois).
    if (pagamentoId && (!status || !externalReference)) {
      try {
        const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        const resposta = await fetch(
          `https://api.mercadopago.com/v1/payments/${pagamentoId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (resposta.ok) {
          const dadosPagamento = await resposta.json();
          status = dadosPagamento.status;
          externalReference = dadosPagamento.external_reference;
          console.log(`[WEBHOOK] Pagamento ${pagamentoId} status: ${status}, ref: ${externalReference}`);
        }
      } catch (err) {
        console.error("[WEBHOOK] Erro ao consultar pagamento:", err);
      }
    }

    if (!pagamentoId) {
      console.log("[WEBHOOK] Sem ID de pagamento, ignorando");
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient();

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
    console.log(`[WEBHOOK] Pagamento ${pagamentoId}: ${status} → ${statusSupabase}`);

    // Caminho principal: identificar o usuário direto pelo external_reference
    // (formato "usuarioId|planoTipo", configurado na criação do pagamento).
    const [usuarioIdRef, planoTipoRef] = (externalReference || "").split("|");
    const pareceUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      usuarioIdRef || ""
    );

    let atualizou = false;

    if (pareceUuid) {
      const { data: ok, error } = await supabase.rpc(
        "webhook_ativar_assinatura_por_usuario",
        {
          p_usuario_id: usuarioIdRef,
          p_plano_tipo: planoTipoRef === "anual" ? "anual" : "mensal",
          p_pagamento_id: String(pagamentoId),
          p_status: statusSupabase,
          p_pago: status === "approved",
        }
      );

      if (error) {
        console.error("[WEBHOOK] Erro ao ativar por usuário:", error.message);
      } else {
        atualizou = !!ok;
      }
    } else {
      console.log("[WEBHOOK] external_reference sem usuario_id reconhecível, tentando caminho antigo");
    }

    // Caminho de reforço (compatibilidade com pagamentos antigos criados
    // antes desta correção): tenta casar pelo intent_pagamento_id já
    // gravado por /pagamento/sucesso, se o caminho principal não achou nada.
    if (!atualizou) {
      const { data, error } = await supabase
        .rpc("webhook_atualizar_assinatura", {
          p_pagamento_id: String(pagamentoId),
          p_status: statusSupabase,
          p_pago: status === "approved",
        });

      if (error) {
        console.error("[WEBHOOK] Erro ao atualizar (caminho antigo):", error.message);
      }

      if (!data) {
        console.log(`[WEBHOOK] Nenhuma assinatura encontrada com pagamento_id: ${pagamentoId}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[WEBHOOK] Erro geral:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
