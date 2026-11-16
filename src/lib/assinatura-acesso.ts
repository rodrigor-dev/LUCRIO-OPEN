/**
 * Regra única de "o usuário está com acesso liberado?".
 * Usada pela tela (bloqueio) e pelo gerador de mensalidades, e espelhada
 * no banco em public.usuario_tem_acesso (migration 028).
 */

export const STATUS_COM_ACESSO = ["trial", "ativo", "cancelado", "atrasado"] as const;

/** Tolerância para a Cakto confirmar a renovação sem bloquear quem paga. */
export const TOLERANCIA_RENOVACAO_DIAS = 3;

export type AssinaturaParaAcesso = {
  status: string;
  fim_periodo: string | null;
  metodo_pagamento_id?: string | null;
  cancelar_ao_fim_periodo?: boolean | null;
};

/** Data até quando o acesso vale, já com a tolerância de renovação. */
export function acessoValeAte(a: AssinaturaParaAcesso): Date | null {
  if (!a.fim_periodo) return null;
  const fim = new Date(a.fim_periodo);
  if (Number.isNaN(fim.getTime())) return null;

  const renovaPelaCakto =
    a.metodo_pagamento_id === "cakto" &&
    (a.status === "ativo" || a.status === "atrasado") &&
    !a.cancelar_ao_fim_periodo;

  if (renovaPelaCakto) {
    return new Date(fim.getTime() + TOLERANCIA_RENOVACAO_DIAS * 24 * 60 * 60 * 1000);
  }
  return fim;
}

export function assinaturaLiberaAcesso(
  a: AssinaturaParaAcesso | null | undefined,
  agora: Date = new Date()
): boolean {
  if (!a) return false;
  if (!(STATUS_COM_ACESSO as readonly string[]).includes(a.status)) return false;
  const ate = acessoValeAte(a);
  return !!ate && ate.getTime() > agora.getTime();
}
