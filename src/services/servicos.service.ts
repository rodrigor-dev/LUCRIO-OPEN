import { createClient } from "@/lib/supabase/client";
import type { Servico } from "@/types/database";

const supabase = createClient();

export async function listarServicos(
  negocioId: string,
  filtros?: { dataInicio?: string; dataFim?: string; status?: string }
): Promise<Servico[]> {
  let query = supabase
    .from("servicos")
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

export async function criarServico(
  servico: Omit<Servico, "id" | "criado_em" | "atualizado_em">
): Promise<Servico> {
  const { data, error } = await supabase
    .from("servicos")
    .insert(servico)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarServico(
  id: string,
  dados: Partial<Servico>
): Promise<Servico> {
  const { data, error } = await supabase
    .from("servicos")
    .update(dados)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function excluirServico(id: string): Promise<void> {
  const { error } = await supabase.from("servicos").delete().eq("id", id);
  if (error) throw error;
}
