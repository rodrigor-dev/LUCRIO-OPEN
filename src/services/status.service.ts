import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function atualizarStatusVencidos(negocioId: string): Promise<void> {
  const hoje = new Date().toISOString().split("T")[0];

  await supabase
    .from("receitas")
    .update({ status: "atrasado" })
    .eq("negocio_id", negocioId)
    .eq("status", "pendente")
    .not("data_vencimento", "is", null)
    .lt("data_vencimento", hoje);

  await supabase
    .from("despesas")
    .update({ status: "atrasado" })
    .eq("negocio_id", negocioId)
    .eq("status", "pendente")
    .not("data_vencimento", "is", null)
    .lt("data_vencimento", hoje);
}

export async function marcarComoPago(
  tabela: "receitas" | "despesas",
  id: string
): Promise<void> {
  const hoje = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from(tabela)
    .update({ status: "pago", data_pagamento: hoje })
    .eq("id", id);

  if (error) throw error;
}

export async function desmarcarPago(
  tabela: "receitas" | "despesas",
  id: string
): Promise<void> {
  const hoje = new Date().toISOString().split("T")[0];

  const { data: registro } = await supabase
    .from(tabela)
    .select("data_vencimento")
    .eq("id", id)
    .single();

  const novoStatus =
    registro?.data_vencimento && registro.data_vencimento < hoje
      ? "atrasado"
      : "pendente";

  const { error } = await supabase
    .from(tabela)
    .update({ status: novoStatus, data_pagamento: null })
    .eq("id", id);

  if (error) throw error;
}

export async function alterarStatusEmMassa(
  tabela: "receitas" | "despesas",
  ids: string[],
  novoStatus: string
): Promise<void> {
  const updateData: Record<string, unknown> = { status: novoStatus };
  if (novoStatus === "pago") {
    updateData.data_pagamento = new Date().toISOString().split("T")[0];
  } else if (novoStatus === "pendente" || novoStatus === "atrasado") {
    updateData.data_pagamento = null;
  }

  const { error } = await supabase
    .from(tabela)
    .update(updateData)
    .in("id", ids);

  if (error) throw error;
}

export async function excluirEmMassa(
  tabela: "receitas" | "despesas",
  ids: string[]
): Promise<void> {
  const { error } = await supabase.from(tabela).delete().in("id", ids);
  if (error) throw error;
}
