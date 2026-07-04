import { createClient } from "@/lib/supabase/client";
import type { Recorrencia } from "@/types/database";

const supabase = createClient();

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
  const hoje = new Date().toISOString().split("T")[0];

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
    const { data: existente } = await supabase
      .from("receitas")
      .select("id")
      .eq("recorrencia_id", rec.id)
      .eq("data", rec.proximo_gerar_em || "")
      .limit(1);

    if (existente && existente.length > 0) continue;

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

    if (!insertError) {
      geradas++;
      const proximaData = calcularProximaData(
        rec.proximo_gerar_em || hoje,
        rec.recorrencia
      );

      await supabase
        .from("recorrencias")
        .update({ proximo_gerar_em: proximaData })
        .eq("id", rec.id);
    }
  }

  return geradas;
}

function calcularProximaData(dataAtual: string, recorrencia: string): string {
  const d = new Date(dataAtual);

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

  return d.toISOString().split("T")[0];
}
