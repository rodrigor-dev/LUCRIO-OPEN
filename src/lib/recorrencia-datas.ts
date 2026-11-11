/**
 * Funções puras de data usadas pelo motor de recorrência.
 *
 * Todas trabalham com strings "AAAA-MM-DD" (data local, sem fuso) para
 * evitar os problemas clássicos de `new Date()`:
 *  - dia 31 em mês de 30 dias virava "2026-11-31" (data inválida → o banco
 *    recusava a receita e o cliente fixo simplesmente não aparecia);
 *  - `setMonth(+1)` em 31/jan pulava para 03/mar e a data ia "andando"
 *    mês a mês.
 * Aqui o dia é sempre limitado ao último dia do mês (31 → 30, 28 ou 29).
 */

export type TipoRecorrencia = "mensal" | "semanal" | "quinzenal" | "anual";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function montarISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

export function lerISO(iso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return { ano, mes, dia };
}

/** Quantidade de dias do mês (mes de 1 a 12). */
export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Data válida no mês, limitando o dia ao último dia do mês. */
export function dataNoMes(ano: number, mes: number, dia: number): string {
  const diaSeguro = Math.min(Math.max(1, Math.trunc(dia)), diasNoMes(ano, mes));
  return montarISO(ano, mes, diaSeguro);
}

/** Soma meses mantendo o "dia âncora" (ex.: vencimento todo dia 31). */
export function somarMeses(iso: string, meses: number, diaAncora?: number | null): string {
  const { ano, mes, dia } = lerISO(iso);
  const total = (ano * 12 + (mes - 1)) + meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return dataNoMes(novoAno, novoMes, diaAncora || dia);
}

export function somarDias(iso: string, dias: number): string {
  const { ano, mes, dia } = lerISO(iso);
  // Meio-dia evita qualquer efeito de horário de verão.
  const d = new Date(ano, mes - 1, dia, 12);
  d.setDate(d.getDate() + dias);
  return montarISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function proximaDataRecorrencia(
  iso: string,
  recorrencia: TipoRecorrencia | string,
  diaAncora?: number | null
): string {
  switch (recorrencia) {
    case "semanal":
      return somarDias(iso, 7);
    case "quinzenal":
      return somarDias(iso, 15);
    case "anual":
      return somarMeses(iso, 12, diaAncora);
    case "mensal":
    default:
      return somarMeses(iso, 1, diaAncora);
  }
}

export function hojeISO(agora: Date = new Date()): string {
  return montarISO(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
}

export function ultimoDiaDoMesISO(agora: Date = new Date()): string {
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  return montarISO(ano, mes, diasNoMes(ano, mes));
}

/** Data de vencimento no mês atual (dia limitado ao fim do mês). */
export function vencimentoNoMesAtual(diaVencimento: number | null | undefined, agora: Date = new Date()): string {
  if (!diaVencimento) return hojeISO(agora);
  return dataNoMes(agora.getFullYear(), agora.getMonth() + 1, diaVencimento);
}
