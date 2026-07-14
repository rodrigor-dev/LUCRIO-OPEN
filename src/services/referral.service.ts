import { createClient } from "@/lib/supabase/client";
import type {
  CodigoIndicacao,
  IndicacoesUsuarioStats,
  CampanhaIndicacao,
  IndicacoesStats,
  Indicacao,
} from "@/types/admin";

const supabase = createClient();

// ============================================================
// USUARIO: Obter codigo e stats de indicacoes
// ============================================================
export async function obterStatsIndicacoes(
  usuarioId: string
): Promise<IndicacoesUsuarioStats> {
  const { data, error } = await supabase.rpc(
    "get_indicacoes_stats" as never,
    { p_usuario_id: usuarioId } as never
  );

  if (error) {
    console.error("[ReferralService] get_indicacoes_stats error:", error);
    return {
      codigo: "",
      total_indicacoes: 0,
      total_convertidas: 0,
      total_recompensas: 0,
      indicacoes: [],
    };
  }

  const stats = data as unknown as IndicacoesUsuarioStats;

  // Se nao tem codigo, gerar
  if (!stats.codigo) {
    const codigo = await gerarCodigoIndicacao(usuarioId);
    stats.codigo = codigo;
  }

  return stats;
}

// ============================================================
// USUARIO: Gerar codigo de indicacao
// ============================================================
export async function gerarCodigoIndicacao(
  usuarioId: string
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "gerar_codigo_indicacao" as never,
    { p_usuario_id: usuarioId } as never
  );

  if (error) {
    console.error("[ReferralService] gerar_codigo_indicacao error:", error);
    return "";
  }

  return (data as unknown as string) || "";
}

// ============================================================
// USUARIO: Compartilhar link
// ============================================================
export function montarLinkIndicacao(codigo: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/cadastro?ref=${codigo}`;
  }
  return `https://lucrio-open.vercel.app/cadastro?ref=${codigo}`;
}

// ============================================================
// USUARIO: Obter link de compartilhamento para redes sociais
// ============================================================
export function gerarLinksCompartilhamento(codigo: string) {
  const link = montarLinkIndicacao(codigo);
  const texto = "Estou usando o LUCRIO para organizar minhas finanças! Cadastre-se e ganhe 7 dias grátis de trial:";

  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${texto}\n\n${link}`)}`,
    copiar: link,
  };
}

// ============================================================
// ADMIN: Campanhas
// ============================================================
export async function listarCampanhas(): Promise<CampanhaIndicacao[]> {
  const { data, error } = await supabase
    .from("campanhas_indicacao")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("[ReferralService] listarCampanhas error:", error);
    return [];
  }

  return (data || []) as CampanhaIndicacao[];
}

export async function criarCampanha(
  campanha: Omit<CampanhaIndicacao, "id" | "criado_em" | "atualizado_em">
): Promise<{ erro?: string }> {
  const { error } = await supabase.from("campanhas_indicacao").insert({
    nome: campanha.nome,
    descricao: campanha.descricao,
    recompensa_indicador_tipo: campanha.recompensa_indicador_tipo,
    recompensa_indicador_valor: campanha.recompensa_indicador_valor,
    recompensa_indicado_tipo: campanha.recompensa_indicado_tipo,
    recompensa_indicado_valor: campanha.recompensa_indicado_valor,
    max_indicacoes_por_usuario: campanha.max_indicacoes_por_usuario,
    max_total_indicacoes: campanha.max_total_indicacoes,
    data_inicio: campanha.data_inicio,
    data_fim: campanha.data_fim,
    bloquear_temp_emails: campanha.bloquear_temp_emails,
    dominios_bloqueados: campanha.dominios_bloqueados,
    is_ativo: campanha.is_ativo,
  });

  if (error) {
    return { erro: error.message };
  }

  return {};
}

export async function atualizarCampanha(
  id: string,
  campanha: Partial<CampanhaIndicacao>
): Promise<{ erro?: string }> {
  const { error } = await supabase
    .from("campanhas_indicacao")
    .update(campanha)
    .eq("id", id);

  if (error) {
    return { erro: error.message };
  }

  return {};
}

export async function toggleCampanha(
  id: string,
  is_ativo: boolean
): Promise<{ erro?: string }> {
  const { error } = await supabase
    .from("campanhas_indicacao")
    .update({ is_ativo })
    .eq("id", id);

  if (error) {
    return { erro: error.message };
  }

  return {};
}

export async function excluirCampanha(
  id: string
): Promise<{ erro?: string }> {
  const { error } = await supabase
    .from("campanhas_indicacao")
    .delete()
    .eq("id", id);

  if (error) {
    return { erro: error.message };
  }

  return {};
}

// ============================================================
// ADMIN: Stats de indicacoes
// ============================================================
export async function obterStatsAdminIndicacoes(): Promise<IndicacoesStats> {
  const { data, error } = await supabase.rpc(
    "get_admin_indicacoes_stats" as never
  );

  if (error) {
    console.error("[ReferralService] get_admin_indicacoes_stats error:", error);
    return {
      total_indicacoes: 0,
      convertidas: 0,
      pendentes: 0,
      recompensas_dadas: 0,
      total_dias_dados: 0,
      indicacoes_por_dia: [],
    };
  }

  return data as unknown as IndicacoesStats;
}

// ============================================================
// ADMIN: Listar todas as indicacoes
// ============================================================
export async function listarAdminIndicacoes(
  status?: string,
  busca?: string
): Promise<Indicacao[]> {
  const { data, error } = await supabase.rpc(
    "get_admin_indicacoes" as never,
    {
      p_status: status || null,
      p_busca: busca || null,
    } as never
  );

  if (error) {
    console.error("[ReferralService] listarAdminIndicacoes error:", error);
    return [];
  }

  return (data || []) as Indicacao[];
}
