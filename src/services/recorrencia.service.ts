import { createClient } from "@/lib/supabase/client";
import { dateToLocalISO } from "@/utils";
import type { Recorrencia } from "@/types/database";

const supabase = createClient();

// Lock em memória: evita que gerarReceitasRecorrentes/gerarDespesasRecorrentes
// execute duas vezes ao mesmo tempo para o mesmo negócio (Dashboard + Financeiro
// disparam a função ao carregar, causando condição de corrida).
const locksEmExecucao = new Map<string, Promise<unknown>>();

export async function listarRecorrencias(
  negocioId: string,
  tipo?: "receita" | "despesa"
): Promise<Recorrencia[]> {
  let query = supabase
    .from("recorrencias")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("criado_em", { ascending: false });

  if (tipo) {
    query = query.eq("tipo", tipo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function criarRecorrencia(
  recorrencia: Omit<Recorrencia, "id" | "criado_em" | "atualizado_em">
): Promise<Recorrencia> {
  const { data, error } = await supabase
    .from("recorrencias")
    .insert(recorrencia)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarRecorrencia(
  id: string,
  dados: Partial<Omit<Recorrencia, "id" | "negocio_id" | "criado_em" | "atualizado_em">>
): Promise<Recorrencia> {
  const { data, error } = await supabase
    .from("recorrencias")
    .update(dados)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function excluirRecorrencia(id: string): Promise<void> {
  const { error } = await supabase.from("recorrencias").delete().eq("id", id);
  if (error) throw error;
}

export async function obterRecorrencia(id: string): Promise<Recorrencia | null> {
  const { data, error } = await supabase
    .from("recorrencias")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function gerarReceitasRecorrentes(negocioId: string): Promise<number> {
  // Se já existe uma execução em andamento para este negócio, retorna o
  // resultado dela em vez de iniciar outra — impede a condição de corrida
  // no nível da aplicação (Dashboard e Financeiro disparam ao carregar).
  const execucaoAnterior = locksEmExecucao.get(`receita_${negocioId}`);
  if (execucaoAnterior) return execucaoAnterior as Promise<number>;

  const promessa = _gerarReceitasRecorrentesInterno(negocioId);
  locksEmExecucao.set(`receita_${negocioId}`, promessa);

  try {
    return await promessa;
  } finally {
    locksEmExecucao.delete(`receita_${negocioId}`);
  }
}

async function _gerarReceitasRecorrentesInterno(negocioId: string): Promise<number> {
  const hoje = dateToLocalISO();

  const { data: recorrencias, error } = await supabase
    .from("recorrencias")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("tipo", "receita")
    .eq("is_ativa", true)
    .lte("proximo_gerar_em", hoje);

  if (error) throw error;
  if (!recorrencias || recorrencias.length === 0) return 0;

  let geradas = 0;

  for (const rec of recorrencias) {
    const { error: insertError } = await supabase.from("receitas").insert({
      negocio_id: rec.negocio_id,
      cliente_id: rec.cliente_id,
      descricao: rec.descricao,
      valor: rec.valor,
      data: rec.proximo_gerar_em || hoje,
      data_vencimento: rec.proximo_gerar_em || hoje,
      status: "pendente",
      forma_pagamento: rec.forma_pagamento,
      recorrencia_tipo: rec.recorrencia,
      recorrencia_id: rec.id,
    });

    const jaExistiaPorOutraChamada = insertError?.code === "23505";

    if (!insertError || jaExistiaPorOutraChamada) {
      if (!insertError) geradas++;

      const proximaData = calcularProximaData(
        rec.proximo_gerar_em || hoje,
        rec.recorrencia
      );

      await supabase
        .from("recorrencias")
        .update({ proximo_gerar_em: proximaData })
        .eq("id", rec.id)
        .eq("proximo_gerar_em", rec.proximo_gerar_em);
    } else {
      console.error("[recorrencia] erro ao gerar receita:", insertError);
    }
  }

  return geradas;
}

function calcularProximaData(dataAtual: string, recorrencia: string): string {
  const [ano, mes, dia] = dataAtual.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia);

  switch (recorrencia) {
    case "mensal":
      d.setMonth(d.getMonth() + 1);
      break;
    case "semanal":
      d.setDate(d.getDate() + 7);
      break;
    case "quinzenal":
      d.setDate(d.getDate() + 15);
      break;
    case "anual":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }

  return dateToLocalISO(d);
}
