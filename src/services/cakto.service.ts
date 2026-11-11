import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Integração com a Cakto (somente servidor).
 *
 * Fluxo:
 * 1. /api/pagamentos devolve o link do checkout da oferta (mensal ou anual)
 *    com ?callback=<id do usuário>.
 * 2. A Cakto chama /api/webhooks/cakto a cada evento (compra aprovada,
 *    renovação, cancelamento, reembolso...). O `data.callback` traz o id do
 *    usuário de volta; se faltar, usamos o e-mail do comprador.
 * 3. O webhook aplica o evento na assinatura pelo banco
 *    (função processar_evento_pagamento, idempotente).
 *
 * Docs: https://docs.cakto.com.br/conceitos/webhooks
 */

export type PlanoTipo = "mensal" | "anual";

/** Eventos que mudam a assinatura. Os demais são só confirmados (200). */
export const EVENTOS_TRATADOS = new Set([
  "purchase_approved",
  "subscription_created",
  "subscription_renewed",
  "subscription_late_recovered",
  "subscription_resumed",
  "subscription_canceled",
  "subscription_late",
  "subscription_renewal_refused",
  "subscription_paused",
  "refund",
  "chargeback",
]);

const TOLERANCIA_TIMESTAMP_SEGUNDOS = 5 * 60;

function urlCheckout(plano: PlanoTipo): string | undefined {
  return plano === "anual"
    ? process.env.CAKTO_CHECKOUT_ANUAL_URL
    : process.env.CAKTO_CHECKOUT_MENSAL_URL;
}

/** Id da oferta = último trecho do link (ex.: pay.cakto.com.br/32f9yzc). */
export function idOfertaDoLink(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const partes = new URL(link).pathname.split("/").filter(Boolean);
    return partes[partes.length - 1] || null;
  } catch {
    return null;
  }
}

export function montarLinkCheckout(plano: PlanoTipo, usuarioId: string): string {
  const base = urlCheckout(plano);
  if (!base) {
    throw new Error(
      `Link de checkout da Cakto (${plano}) não configurado. Defina CAKTO_CHECKOUT_${plano.toUpperCase()}_URL.`
    );
  }
  const url = new URL(base);
  // O callback volta no webhook (data.callback) e identifica o usuário.
  // A Cakto aceita letras, números e . _ ~ - (UUID atende).
  url.searchParams.set("callback", usuarioId);
  return url.toString();
}

/**
 * Normaliza o código da oferta: alguns links trazem um sufixo numérico
 * (ex.: "sceo2oh_1311315") e o webhook pode mandar com ou sem ele.
 * Comparamos só a parte antes do "_", sem diferenciar maiúsculas.
 */
function normalizarOferta(id: string | undefined | null): string | null {
  if (!id) return null;
  const base = id.trim().split("_")[0].toLowerCase();
  return base || null;
}

/** Descobre o plano pelo id da oferta. null = oferta que não é do Faturion. */
export function planoDaOferta(ofertaId: string | undefined | null): PlanoTipo | null {
  const alvo = normalizarOferta(ofertaId);
  if (!alvo) return null;
  if (alvo === normalizarOferta(idOfertaDoLink(process.env.CAKTO_CHECKOUT_ANUAL_URL))) return "anual";
  if (alvo === normalizarOferta(idOfertaDoLink(process.env.CAKTO_CHECKOUT_MENSAL_URL))) return "mensal";
  return null;
}

function comparacaoSegura(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Valida que a chamada veio mesmo da Cakto.
 * Preferência: HMAC-SHA256 do header X-Cakto-Signature sobre
 * "{timestamp}.{corpo cru}". Alternativa: campo `secret` no corpo.
 */
export function webhookEhAutentico(params: {
  corpoCru: string;
  secretNoCorpo: unknown;
  assinatura: string | null;
  timestamp: string | null;
  segredo: string;
  agoraSegundos?: number;
}): boolean {
  const { corpoCru, secretNoCorpo, assinatura, timestamp, segredo } = params;
  const agora = params.agoraSegundos ?? Math.floor(Date.now() / 1000);

  if (assinatura && timestamp) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(agora - ts) > TOLERANCIA_TIMESTAMP_SEGUNDOS) {
      return false;
    }
    const recebida = assinatura.startsWith("v1=") ? assinatura.slice(3) : assinatura;
    const esperada = createHmac("sha256", segredo).update(`${timestamp}.${corpoCru}`).digest("hex");
    return comparacaoSegura(recebida.toLowerCase(), esperada);
  }

  if (typeof secretNoCorpo === "string" && secretNoCorpo.length > 0) {
    return comparacaoSegura(secretNoCorpo, segredo);
  }

  return false;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor);
}
