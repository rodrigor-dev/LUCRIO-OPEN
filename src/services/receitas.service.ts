import { createClient } from "@/lib/supabase/client";
import type { Receita } from "@/types/database";

const supabase = createClient();

export async function listarReceitas(
  negocioId: string,
  filtros?: { dataInicio?: string; dataFim?: string; status?: string }
): Promise<Receita[]> {
  let query = supabase
    .from("receitas")
    .select("*, cliente:clientes(nome)")
    .eq("negocio_id", negocioId)
    .order("data", { ascending: false });

  if (filtros?.dataInicio) {
    query = query.gte("data", filtros.dataInicio);
  }
  if (filtros?.dataFim) {
    query = query.lte("data", filtros.dataFim);
  }
  if (filtros?.status) {
    query = query.eq("status", filtros.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function obterReceita(id: string): Promise<Receita | null> {
  const { data, error } = await supabase
    .from("receitas")
    .select("*, cliente:clientes(nome)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function criarReceita(
  receita: Omit<Receita, "id" | "criado_em" | "atualizado_em">
): Promise<Receita> {
  const { data, error } = await supabase
    .from("receitas")
    .insert(receita)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarReceita(
  id: string,
  dados: Omit<Receita, "id" | "negocio_id" | "criado_em" | "atualizado_em">
): Promise<Receita> {
  const { data, error } = await supabase
    .from("receitas")
    .update(dados)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function excluirReceita(id: string): Promise<void> {
  const { error } = await supabase.from("receitas").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicarReceita(id: string): Promise<Receita> {
  const receita = await obterReceita(id);
  if (!receita) throw new Error("Receita não encontrada");

  const novaReceita = await criarReceita({
    negocio_id: receita.negocio_id,
    cliente_id: receita.cliente_id,
    servico_id: receita.servico_id,
    descricao: `${receita.descricao} (cópia)`,
    valor: receita.valor,
    data: new Date().toISOString().split("T")[0],
    status: "pendente",
    forma_pagamento: receita.forma_pagamento,
    observacoes: receita.observacoes,
  });

  return novaReceita;
}
