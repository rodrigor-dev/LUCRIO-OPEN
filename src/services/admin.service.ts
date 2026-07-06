import { createClient } from "@/lib/supabase/client";
import type {
  AdminStats,
  AdminFinanceiro,
  ConfiguracaoGlobal,
  PlanoAdmin,
  Cupom,
  Auditoria,
  SystemLog,
  TicketSuporte,
  AvisoGlobal,
  FeatureFlag,
  Backup,
  Atualizacao,
  Role,
  UsuarioAdmin,
} from "@/types/admin";

const supabase = createClient();

// ============================================================
// DASHBOARD
// ============================================================
export async function obterStatsAdmin(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc("admin_stats" as never).single();
  if (error) {
    // Fallback: buscar direto das tabelas
    const [usuarios, negocios, clientes, receitas, despesas] = await Promise.all([
      supabase.from("usuarios").select("id, is_ativo, criado_em", { count: "exact" }),
      supabase.from("negocios").select("id", { count: "exact" }),
      supabase.from("clientes").select("id", { count: "exact" }),
      supabase.from("receitas").select("id", { count: "exact" }),
      supabase.from("despesas").select("id", { count: "exact" }),
    ]);

    const hoje = new Date().toISOString().split("T")[0];
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const totalU = usuarios.count || 0;
    const ativos = usuarios.data?.filter((u) => u.is_ativo).length || 0;
    const novosHoje = usuarios.data?.filter((u) => u.criado_em >= hoje).length || 0;
    const novosMes = usuarios.data?.filter((u) => u.criado_em >= inicioMes).length || 0;

    return {
      total_usuarios: totalU,
      usuarios_ativos: ativos,
      usuarios_inativos: totalU - ativos,
      novos_hoje: novosHoje,
      novos_mes: novosMes,
      total_negocios: negocios.count || 0,
      total_clientes: clientes.count || 0,
      total_receitas: receitas.count || 0,
      total_despesas: despesas.count || 0,
    };
  }
  return data as AdminStats;
}

export async function obterFinanceiroAdmin(): Promise<AdminFinanceiro> {
  const [assinaturas, planos] = await Promise.all([
    supabase.from("assinaturas").select("status").then((r) => r.data || []),
    supabase.from("planos").select("preco_mensal, preco_anual, is_ativo").then((r) => r.data || []),
  ]);

  const ativos = assinaturas.filter((a) => a.status === "ativo").length;
  const cancelados = assinaturas.filter((a) => a.status === "cancelado").length;
  const trials = assinaturas.filter((a) => a.status === "trial").length;

  // Calculate MRR from active subscriptions and plan prices
  let mrr = 0;
  if (planos.length > 0) {
    const activePlanPrice = planos.find((p) => p.is_ativo)?.preco_mensal || 0;
    mrr = ativos * activePlanPrice;
  } else {
    // Fallback: count active subscriptions × average plan price
    const mediaPreco = planos.length > 0
      ? planos.reduce((acc, p) => acc + (Number(p.preco_mensal) || 0), 0) / planos.length
      : 0;
    mrr = ativos * mediaPreco;
  }

  return {
    mrr,
    arr_estimado: mrr * 12,
    total_assinaturas_ativas: ativos,
    total_cancelamentos: cancelados,
    total_trials: trials,
  };
}

// ============================================================
// USUARIOS
// ============================================================
export async function listarUsuarios(busca?: string, filtros?: { plano?: string; status?: string }) {
  let query = supabase
    .from("usuarios")
    .select("*, role:roles(*), plano:planos(*)")
    .order("criado_em", { ascending: false });

  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);
  }

  if (filtros?.status === "ativo") query = query.eq("is_ativo", true);
  if (filtros?.status === "inativo") query = query.eq("is_ativo", false);
  if (filtros?.status === "bloqueado") query = query.eq("is_bloqueado", true);
  if (filtros?.status === "suspenso") query = query.eq("is_suspendido", true);

  const { data, error } = await query;
  if (error) throw error;
  return data as UsuarioAdmin[];
}

export async function obterUsuario(id: string) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*, role:roles(*), plano:planos(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as UsuarioAdmin;
}

export async function atualizarUsuario(id: string, dados: Partial<UsuarioAdmin>) {
  const { error } = await supabase.from("usuarios").update(dados).eq("id", id);
  if (error) throw error;
}

export async function bloquearUsuario(id: string) {
  const { error } = await supabase.from("usuarios").update({ is_bloqueado: true }).eq("id", id);
  if (error) throw error;
}

export async function desbloquearUsuario(id: string) {
  const { error } = await supabase.from("usuarios").update({ is_bloqueado: false }).eq("id", id);
  if (error) throw error;
}

export async function suspenderUsuario(id: string) {
  const { error } = await supabase.from("usuarios").update({ is_suspendido: true }).eq("id", id);
  if (error) throw error;
}

export async function reativarUsuario(id: string) {
  const { error } = await supabase.from("usuarios").update({ is_suspendido: false, is_ativo: true }).eq("id", id);
  if (error) throw error;
}

export async function excluirUsuario(id: string) {
  const { error } = await supabase.from("usuarios").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// PLANOS
// ============================================================
export async function listarPlanos() {
  const { data, error } = await supabase.from("planos").select("*").order("ordem");
  if (error) throw error;
  return data as PlanoAdmin[];
}

export async function criarPlano(dados: Omit<PlanoAdmin, "id" | "criado_em" | "atualizado_em">) {
  const { data, error } = await supabase.from("planos").insert(dados).select().single();
  if (error) throw error;
  return data as PlanoAdmin;
}

export async function atualizarPlano(id: string, dados: Partial<PlanoAdmin>) {
  const { error } = await supabase.from("planos").update(dados).eq("id", id);
  if (error) throw error;
}

export async function excluirPlano(id: string) {
  const { error } = await supabase.from("planos").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// ASSINATURAS
// ============================================================
export async function listarAssinaturas(filtros?: { status?: string }) {
  let query = supabase
    .from("assinaturas")
    .select("*, usuario:usuarios(id, nome, email, avatar_url), plano:planos(*)")
    .order("criado_em", { ascending: false });

  if (filtros?.status) query = query.eq("status", filtros.status);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function atualizarAssinatura(id: string, dados: Record<string, unknown>) {
  const { error } = await supabase.from("assinaturas").update(dados).eq("id", id);
  if (error) throw error;
}

// ============================================================
// CUPONS
// ============================================================
export async function listarCupons() {
  const { data, error } = await supabase.from("cupons").select("*, plano:planos(*)").order("criado_em", { ascending: false });
  if (error) throw error;
  return data as (Cupom & { plano: PlanoAdmin | null })[];
}

export async function criarCupom(dados: Omit<Cupom, "id" | "criado_em" | "atualizado_em" | "utilizacoes">) {
  const { data, error } = await supabase.from("cupons").insert(dados).select().single();
  if (error) throw error;
  return data as Cupom;
}

export async function atualizarCupom(id: string, dados: Partial<Cupom>) {
  const { error } = await supabase.from("cupons").update(dados).eq("id", id);
  if (error) throw error;
}

export async function excluirCupom(id: string) {
  const { error } = await supabase.from("cupons").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// AUDITORIA
// ============================================================
export async function listarAuditoria(filtros?: { usuario_id?: string; acao?: string; limit?: number }) {
  let query = supabase.from("auditoria").select("*").order("criado_em", { ascending: false }).limit(filtros?.limit || 100);
  if (filtros?.usuario_id) query = query.eq("usuario_id", filtros.usuario_id);
  if (filtros?.acao) query = query.ilike("acao", `%${filtros.acao}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data as Auditoria[];
}

export async function registrarAuditoria(dados: Omit<Auditoria, "id" | "criado_em">) {
  const { error } = await supabase.from("auditoria").insert(dados);
  if (error) console.error("Erro ao registrar auditoria:", error);
}

// ============================================================
// LOGS
// ============================================================
export async function listarLogs(filtros?: { nivel?: string; limit?: number }) {
  let query = supabase.from("system_logs").select("*").order("criado_em", { ascending: false }).limit(filtros?.limit || 200);
  if (filtros?.nivel) query = query.eq("nivel", filtros.nivel);
  const { data, error } = await query;
  if (error) throw error;
  return data as SystemLog[];
}

// ============================================================
// SUPORTE
// ============================================================
export async function listarTickets(filtros?: { status?: string }) {
  let query = supabase
    .from("suporte_tickets")
    .select("*")
    .order("criado_em", { ascending: false });
  if (filtros?.status) query = query.eq("status", filtros.status);
  const { data, error } = await query;
  if (error) throw error;
  return data as TicketSuporte[];
}

export async function atualizarTicket(id: string, dados: Partial<TicketSuporte>) {
  const { error } = await supabase.from("suporte_tickets").update(dados).eq("id", id);
  if (error) throw error;
}

export async function enviarMensagemSuporte(ticketId: string, mensagem: string, remetenteId: string) {
  const { error } = await supabase.from("suporte_mensagens").insert({
    ticket_id: ticketId,
    remetente_id: remetenteId,
    remetente_tipo: "admin",
    mensagem,
  });
  if (error) throw error;
}

// ============================================================
// AVISOS
// ============================================================
export async function listarAvisos() {
  const { data, error } = await supabase.from("avisos_globais").select("*").order("criado_em", { ascending: false });
  if (error) throw error;
  return data as AvisoGlobal[];
}

export async function criarAviso(dados: Omit<AvisoGlobal, "id" | "criado_em" | "atualizado_em">) {
  const { data, error } = await supabase.from("avisos_globais").insert(dados).select().single();
  if (error) throw error;
  return data as AvisoGlobal;
}

export async function atualizarAviso(id: string, dados: Partial<AvisoGlobal>) {
  const { error } = await supabase.from("avisos_globais").update(dados).eq("id", id);
  if (error) throw error;
}

export async function excluirAviso(id: string) {
  const { error } = await supabase.from("avisos_globais").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// FEATURE FLAGS
// ============================================================
export async function listarFeatureFlags() {
  const { data, error } = await supabase.from("feature_flags").select("*").order("criado_em", { ascending: false });
  if (error) throw error;
  return data as FeatureFlag[];
}

export async function criarFeatureFlag(dados: Omit<FeatureFlag, "id" | "criado_em" | "atualizado_em">) {
  const { data, error } = await supabase.from("feature_flags").insert(dados).select().single();
  if (error) throw error;
  return data as FeatureFlag;
}

export async function atualizarFeatureFlag(id: string, dados: Partial<FeatureFlag>) {
  const { error } = await supabase.from("feature_flags").update(dados).eq("id", id);
  if (error) throw error;
}

export async function excluirFeatureFlag(id: string) {
  const { error } = await supabase.from("feature_flags").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// CONFIGURACOES GLOBAIS
// ============================================================
export async function listarConfiguracoes() {
  const { data, error } = await supabase.from("configuracoes_globais").select("*").order("chave");
  if (error) throw error;
  return data as ConfiguracaoGlobal[];
}

export async function salvarConfiguracao(chave: string, valor: string) {
  const { error } = await supabase
    .from("configuracoes_globais")
    .update({ valor, atualizado_em: new Date().toISOString() })
    .eq("chave", chave);
  if (error) throw error;
}

// ============================================================
// ROLES
// ============================================================
export async function listarRoles() {
  const { data, error } = await supabase.from("roles").select("*").order("nome");
  if (error) throw error;
  return data as Role[];
}

// ============================================================
// BACKUPS
// ============================================================
export async function listarBackups() {
  const { data, error } = await supabase.from("backups").select("*").order("criado_em", { ascending: false });
  if (error) throw error;
  return data as Backup[];
}

// ============================================================
// ATUALIZACOES
// ============================================================
export async function listarAtualizacoes() {
  const { data, error } = await supabase.from("atualizacoes").select("*").order("criado_em", { ascending: false });
  if (error) throw error;
  return data as Atualizacao[];
}

export async function criarAtualizacao(dados: Omit<Atualizacao, "id" | "criado_em">) {
  const { data, error } = await supabase.from("atualizacoes").insert(dados).select().single();
  if (error) throw error;
  return data as Atualizacao;
}

export async function excluirAtualizacao(id: string) {
  const { error } = await supabase.from("atualizacoes").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// BACKUPS (extras)
// ============================================================
export async function criarBackup() {
  const { data, error } = await supabase
    .from("backups")
    .insert({ nome: `backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}`, status: "pendente", tipo: "manual" })
    .select()
    .single();
  if (error) throw error;
  return data as Backup;
}

export async function excluirBackup(id: string) {
  const { error } = await supabase.from("backups").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// LOGS (extras)
// ============================================================
export async function limparLogsAntigos(dias: number = 30) {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);
  const { error } = await supabase
    .from("system_logs")
    .delete()
    .lt("criado_em", dataLimite.toISOString());
  if (error) throw error;
}

export async function contarLogsPorNivel() {
  const [erros, avisos, infos] = await Promise.all([
    supabase.from("system_logs").select("id", { count: "exact", head: true }).eq("nivel", "erro"),
    supabase.from("system_logs").select("id", { count: "exact", head: true }).eq("nivel", "aviso"),
    supabase.from("system_logs").select("id", { count: "exact", head: true }).eq("nivel", "info"),
  ]);
  return {
    erro: erros.count || 0,
    aviso: avisos.count || 0,
    info: infos.count || 0,
  };
}

// ============================================================
// LIBERACAO MANUAL
// ============================================================
export async function liberarAcesso(usuarioId: string, dias: number, planoId: string) {
  const inicio = new Date();
  const fim = new Date();
  if (dias === -1) {
    fim.setFullYear(fim.getFullYear() + 100);
  } else {
    fim.setDate(fim.getDate() + dias);
  }

  const { data: existente } = await supabase
    .from("assinaturas")
    .select("id")
    .eq("usuario_id", usuarioId)
    .in("status", ["trial", "ativo"])
    .single();

  if (existente) {
    await supabase.from("assinaturas").update({
      status: "ativo",
      plano_id: planoId,
      fim_periodo: fim.toISOString(),
      trial_termina: inicio.toISOString(),
    }).eq("id", existente.id);
  } else {
    await supabase.from("assinaturas").insert({
      usuario_id: usuarioId,
      plano_id: planoId,
      status: "ativo",
      trial_termina: inicio.toISOString(),
      inicio_periodo: inicio.toISOString(),
      fim_periodo: fim.toISOString(),
    });
  }
}