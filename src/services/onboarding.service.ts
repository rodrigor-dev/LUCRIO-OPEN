import { createClient } from "@/lib/supabase/client";

export interface ItemChecklist {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  completo: boolean;
}

const supabase = createClient();

/**
 * Monta o checklist de primeiros passos, detectando automaticamente o
 * que o usuario ja fez (nao depende de ele marcar nada na mao - olha
 * direto os dados reais: ja tem cliente cadastrado? ja lancou uma
 * receita? etc).
 */
export async function obterChecklistOnboarding(
  negocioId: string,
  usuarioId: string
): Promise<ItemChecklist[]> {
  const [
    { count: totalClientes },
    { count: totalReceitas },
    { count: totalDespesas },
    { count: totalOrcamentos },
    { data: negocio },
    { count: totalIndicados },
  ] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId),
    supabase.from("receitas").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId),
    supabase.from("despesas").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId),
    supabase.from("propostas").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId),
    supabase.from("negocios").select("logo_url").eq("id", negocioId).single(),
    supabase.from("indicacoes").select("id", { count: "exact", head: true }).eq("indicador_id", usuarioId),
  ]);

  return [
    {
      id: "cliente",
      titulo: "Cadastre seu primeiro cliente",
      descricao: "Guarde os dados de contato de quem voce atende",
      href: "/dashboard/clientes",
      completo: (totalClientes || 0) > 0,
    },
    {
      id: "receita",
      titulo: "Lance sua primeira receita",
      descricao: "Registre um dinheiro que voce recebeu",
      href: "/dashboard/receitas",
      completo: (totalReceitas || 0) > 0,
    },
    {
      id: "despesa",
      titulo: "Lance sua primeira despesa",
      descricao: "Registre um gasto do seu negocio",
      href: "/dashboard/despesas",
      completo: (totalDespesas || 0) > 0,
    },
    {
      id: "orcamento",
      titulo: "Crie seu primeiro orcamento",
      descricao: "Monte uma proposta em PDF pra enviar a um cliente",
      href: "/dashboard/propostas",
      completo: (totalOrcamentos || 0) > 0,
    },
    {
      id: "logo",
      titulo: "Coloque a logo do seu negocio",
      descricao: "Deixe seus orcamentos com a sua cara",
      href: "/dashboard/configuracoes",
      completo: !!negocio?.logo_url,
    },
    {
      id: "indicacao",
      titulo: "Indique o FATURION pra um amigo",
      descricao: "Ganhe dias extras de teste gratis",
      href: "/dashboard/indicar",
      completo: (totalIndicados || 0) > 0,
    },
  ];
}
