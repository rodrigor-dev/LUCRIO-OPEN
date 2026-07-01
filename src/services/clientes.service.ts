import { createClient } from "@/lib/supabase/client";
import type { Cliente } from "@/types/database";

const supabase = createClient();

export async function listarClientes(negocioId: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("nome");

  if (error) throw error;
  return data || [];
}

export async function obterCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function criarCliente(
  cliente: Omit<Cliente, "id" | "criado_em" | "atualizado_em">
): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .insert(cliente)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarCliente(
  id: string,
  dados: Omit<Cliente, "id" | "negocio_id" | "criado_em" | "atualizado_em">
): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update(dados)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function excluirCliente(id: string): Promise<void> {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}

export async function buscarClientes(
  negocioId: string,
  termo: string
): Promise<Cliente[]> {
  const termoSanitizado = termo
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/\\/g, "\\\\");

  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("negocio_id", negocioId)
    .or(`nome.ilike.%${termoSanitizado}%,email.ilike.%${termoSanitizado}%,telefone.ilike.%${termoSanitizado}%`)
    .order("nome");

  if (error) throw error;
  return data || [];
}
