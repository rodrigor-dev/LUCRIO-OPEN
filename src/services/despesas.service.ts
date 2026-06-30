import { createClient } from "@/lib/supabase/client";
import type { Despesa } from "@/types/database";

const supabase = createClient();

export async function listarDespesas(
  negocioId: string,
  filtros?: { dataInicio?: string; dataFim?: string; categoriaId?: string }
): Promise<Despesa[]> {
  let query = supabase
    .from("despesas")
    .select("*, categoria:categorias_despesas(nome, icone, cor)")
    .eq("negocio_id", negocioId)
    .order("data", { ascending: false });

  if (filtros?.dataInicio) {
    query = query.gte("data", filtros.dataInicio);
  }
  if (filtros?.dataFim) {
    query = query.lte("data", filtros.dataFim);
  }
  if (filtros?.categoriaId) {
    query = query.eq("categoria_id", filtros.categoriaId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function obterDespesa(id: string): Promise<Despesa | null> {
  const { data, error } = await supabase
    .from("despesas")
    .select("*, categoria:categorias_despesas(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function criarDespesa(
  despesa: Omit<Despesa, "id" | "criado_em" | "atualizado_em">
): Promise<Despesa> {
  const { data, error } = await supabase
    .from("despesas")
    .insert(despesa)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarDespesa(
  id: string,
  dados: Partial<Despesa>
): Promise<Despesa> {
  const { data, error } = await supabase
    .from("despesas")
    .update(dados)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function excluirDespesa(id: string): Promise<void> {
  const { error } = await supabase.from("despesas").delete().eq("id", id);
  if (error) throw error;
}

export async function obterCategoriasDespesa(
  negocioId: string
): Promise<{ id: string; nome: string; icone: string; cor: string }[]> {
  const { data, error } = await supabase
    .from("categorias_despesas")
    .select("id, nome, icone, cor")
    .or(`negocio_id.eq.${negocioId},negocio_id.is.null`)
    .order("nome");

  if (error) throw error;
  return data || [];
}
