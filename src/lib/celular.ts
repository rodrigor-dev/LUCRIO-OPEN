/**
 * Celular obrigatório nas contas novas.
 * Funções puras (rodam no navegador e no middleware).
 */

/**
 * Contas criadas a partir desta data precisam ter celular cadastrado.
 * Contas antigas não são obrigadas (não bloqueia quem já usa o sistema).
 */
export const CELULAR_OBRIGATORIO_DESDE = new Date("2026-11-17T00:00:00-03:00");

export const apenasDigitosCelular = (valor: string) => (valor || "").replace(/\D/g, "");

/** Máscara enquanto digita: (11) 98765-4321 */
export function mascaraCelular(valor: string): string {
  const d = apenasDigitosCelular(valor).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Celular brasileiro: DDD válido + 9 dígitos começando com 9. */
export function erroCelular(valor: string): string | null {
  const d = apenasDigitosCelular(valor);
  if (!d) return "Informe seu celular com DDD.";
  if (d.length !== 11) return "O celular precisa ter DDD + 9 números. Ex: (11) 98765-4321";
  if (!/^[1-9][1-9]/.test(d)) return "DDD inválido.";
  if (d[2] !== "9") return "Informe um número de celular (começa com 9 depois do DDD).";
  if (/^(\d)\1+$/.test(d.slice(2))) return "Número de celular inválido.";
  return null;
}

/** A conta precisa cadastrar o celular antes de usar o sistema? */
export function precisaCadastrarCelular(u: {
  telefone?: string | null;
  criado_em?: string | null;
  is_admin?: boolean | null;
} | null | undefined): boolean {
  if (!u || u.is_admin) return false;
  if (apenasDigitosCelular(u.telefone || "").length >= 10) return false;
  if (!u.criado_em) return false;
  const criado = new Date(u.criado_em);
  if (Number.isNaN(criado.getTime())) return false;
  return criado.getTime() >= CELULAR_OBRIGATORIO_DESDE.getTime();
}
