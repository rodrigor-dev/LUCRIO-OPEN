import { createClient } from "@/lib/supabase/client";
import type { Negocio } from "@/types/database";

const supabase = createClient();

export async function obterNegocio(usuarioId: string): Promise<Negocio | null> {
  const { data, error } = await supabase
    .from("negocios")
    .select("*")
    .eq("usuario_id", usuarioId)
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarNegocio(
  id: string,
  dados: Partial<Omit<Negocio, "id" | "usuario_id" | "criado_em" | "atualizado_em">>
): Promise<Negocio> {
  const { data, error } = await supabase
    .from("negocios")
    .update(dados)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listarNegocios(usuarioId: string): Promise<Negocio[]> {
  const { data, error } = await supabase
    .from("negocios")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("nome");

  if (error) throw error;
  return data || [];
}
