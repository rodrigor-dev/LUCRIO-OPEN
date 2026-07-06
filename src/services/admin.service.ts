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
  const { data, error } = await supabase.rpc("get_admin_stats" as never).single();
  if (error) {
    console.error("[AdminService] get_admin_stats error:", error);
    return {
      total_usuarios: 0, usuarios_ativos: 0, usuarios_inativos: 0,
      novos_hoje: 0, novos_mes: 0, total_negocios: 0,
      total_clientes: 0, total_receitas: 0, total_despesas: 0,
    };
  }
  return data as AdminStats;
}

export async function obterFinanceiroAdmin(): Promise<AdminFinanceiro> {
  const { data, error } = await supabase.rpc("get_admin_financeiro" as never).single();
  if (error) {
    console.error("[AdminService] get_admin_financeiro error:", error);
    return { mrr: 0, arr_estimado: 0, total_assinaturas_ativas: 0, total_cancelamentos: 0, total_trials: 0 };
  }
  return data as AdminFinanceiro;
}

// ============================================================
// USUARIOS
// ============================================================
export async function listarUsuarios(_busca?: string, _filtros?: { plano?: string; status?: string }) {
  const { data, error } = await supabase.rpc("get_all_usuarios" as never);
  if (error) {
    console.error("[AdminService] get_all_usuarios error:", error);
    return [];
  }
  let usuarios = (data || []) as UsuarioAdmin[];

  if (_busca) {
    const busca = _busca.toLowerCase();
    usuarios = usuarios.filter((u) =>
      u.nome?.toLowerCase().includes(busca) || u.email?.toLowerCase().includes(busca)
    );
  }

  if (_filtros?.status === "ativo") usuarios = usuarios.filter((u) => u.is_ativo);
  if (_filtros?.status === "inativo") usuarios = usuarios.filter((u) => !u.is_ativo);
  if (_filtros?.status === "bloqueado") usuarios = usuarios.filter((u) => u.is_bloqueado);
  if (_filtros?.status === "suspenso") usuarios = usuarios.filter((u) => u.is_suspendido);

  return usuarios;
}

export async function obterUsuario(id: string) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*, role:roles(*)")
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
  const { data, error } = await supabase.rpc("get_all_planos" as never);
  if (error) {
    console.error("[AdminService] get_all_planos error:", error);
    return [];
  }
  return (data || []) as PlanoAdmin[];
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
  const { data, error } = await supabase.rpc("get_all_assinaturas" as never);
  if (error) {
    console.error("[AdminService] get_all_assinaturas error:", error);
    return [];
  }
  let assinaturas = data || [];
  if (filtros?.status) assinaturas = assinaturas.filter((a: Record<string, unknown>) => a.status === filtros.status);
  return assinaturas;
}

export async function atualizarAssinatura(id: string, dados: Record<string, unknown>) {
  const { error } = await supabase.from("assinaturas").update(dados).eq("id", id);
  if (error) throw error;
}

// ============================================================
// CUPONS
// ============================================================
export async function listarCupons() {
  const { data, error } = await supabase.rpc("get_all_cupons" as never);
  if (error) {
    console.error("[AdminService] get_all_cupons error:", error);
    return [];
  }
  return (data || []) as Cupom[];
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
  const { data, error } = await supabase.rpc("get_all_auditoria" as never, { p_limit: filtros?.limit || 100 });
  if (error) {
    console.error("[AdminService] get_all_auditoria error:", error);
    return [];
  }
  let auditoria = (data || []) as Auditoria[];
  if (filtros?.usuario_id) auditoria = auditoria.filter((a) => a.usuario_id === filtros.usuario_id);
  if (filtros?.acao) auditoria = auditoria.filter((a) => a.acao?.toLowerCase().includes(filtros.acao!.toLowerCase()));
  return auditoria;
}

export async function registrarAuditoria(dados: Omit<Auditoria, "id" | "criado_em">) {
  const { error } = await supabase.from("auditoria").insert(dados);
  if (error) console.error("Erro ao registrar auditoria:", error);
}

// ============================================================
// LOGS
// ============================================================
export async function listarLogs(filtros?: { nivel?: string; limit?: number }) {
  const { data, error } = await supabase.rpc("get_all_logs" as never, { p_limit: filtros?.limit || 200 });
  if (error) {
    console.error("[AdminService] get_all_logs error:", error);
    return [];
  }
  let logs = (data || []) as SystemLog[];
  if (filtros?.nivel) logs = logs.filter((l) => l.nivel === filtros.nivel);
  return logs;
}

// ============================================================
// SUPORTE
// ============================================================
interface TicketRaw {
  id: string;
  usuario_id: string;
  assunto: string;
  mensagem: string;
  status: string;
  prioridade: string;
  categoria: string;
  notas_internas: string | null;
  criado_em: string;
  atualizado_em: string;
  usuario_nome: string | null;
  usuario_email: string | null;
  usuario_avatar: string | null;
}

export async function listarTickets(filtros?: { status?: string }): Promise<TicketSuporte[]> {
  const { data, error } = await supabase.rpc("get_all_tickets" as never);
  if (error) {
    console.error("[AdminService] get_all_tickets error:", error);
    return [];
  }
  let tickets: TicketSuporte[] = (data || []).map((t: TicketRaw) => ({
    id: t.id,
    usuario_id: t.usuario_id,
    assunto: t.assunto,
    mensagem: t.mensagem,
    status: t.status as TicketSuporte["status"],
    prioridade: t.prioridade as TicketSuporte["prioridade"],
    categoria: t.categoria,
    notas_internas: t.notas_internas,
    criado_em: t.criado_em,
    atualizado_em: t.atualizado_em,
    usuario: t.usuario_nome || t.usuario_email
      ? { nome: t.usuario_nome || "N/A", email: t.usuario_email || "", avatar_url: t.usuario_avatar }
      : undefined,
    mensagens: [],
  }));
  if (filtros?.status) tickets = tickets.filter((t) => t.status === filtros.status);
  return tickets;
}

export async function obterMensagensTicket(ticketId: string) {
  const { data, error } = await supabase.rpc("get_ticket_mensagens" as never, { p_ticket_id: ticketId });
  if (error) {
    console.error("[AdminService] get_ticket_mensagens error:", error);
    return [];
  }
  return (data || []) as import("@/types/admin").MensagemSuporte[];
}

export async function atualizarTicket(id: string, dados: Partial<TicketSuporte>) {
  const { error } = await supabase.from("suporte_tickets").update(dados).eq("id", id);
  if (error) throw error;
}

export async function enviarMensagemSuporte(ticketId: string, mensagem: string, _remetenteId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || _remetenteId || "00000000-0000-0000-0000-000000000000";
  const { error } = await supabase.from("suporte_mensagens").insert({
    ticket_id: ticketId,
    remetente_id: userId,
    remetente_tipo: "admin",
    mensagem,
  });
  if (error) throw error;
}

// ============================================================
// AVISOS
// ============================================================
export async function listarAvisos() {
  const { data, error } = await supabase.rpc("get_all_avisos" as never);
  if (error) {
    console.error("[AdminService] get_all_avisos error:", error);
    return [];
  }
  return (data || []) as AvisoGlobal[];
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
  const { data, error } = await supabase.rpc("get_all_feature_flags" as never);
  if (error) {
    console.error("[AdminService] get_all_feature_flags error:", error);
    return [];
  }
  return (data || []) as FeatureFlag[];
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
  const { data, error } = await supabase.rpc("get_all_configuracoes" as never);
  if (error) {
    console.error("[AdminService] get_all_configuracoes error:", error);
    return [];
  }
  return (data || []) as ConfiguracaoGlobal[];
}

export async function salvarConfiguracao(chave: string, valor: string) {
  const { error } = await supabase.rpc("save_configuracao" as never, { p_chave: chave, p_valor: valor });
  if (error) throw error;
}

// ============================================================
// ROLES
// ============================================================
export async function listarRoles() {
  const { data, error } = await supabase.rpc("get_all_roles" as never);
  if (error) {
    console.error("[AdminService] get_all_roles error:", error);
    return [];
  }
  return (data || []) as Role[];
}

// ============================================================
// BACKUPS
// ============================================================
export async function listarBackups() {
  const { data, error } = await supabase.rpc("get_all_backups" as never);
  if (error) {
    console.error("[AdminService] get_all_backups error:", error);
    return [];
  }
  return (data || []) as Backup[];
}

// ============================================================
// ATUALIZACOES
// ============================================================
export async function listarAtualizacoes() {
  const { data, error } = await supabase.rpc("get_all_atualizacoes" as never);
  if (error) {
    console.error("[AdminService] get_all_atualizacoes error:", error);
    return [];
  }
  return (data || []) as Atualizacao[];
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

// ============================================================
// CHART DATA
// ============================================================
export async function obterCrescimentoUsuarios() {
  const { data, error } = await supabase.rpc("get_usuario_crescimento_mensal" as never);
  if (error) return [];
  return (data || []) as { mes: string; total: number }[];
}

export async function obterReceitaMensal() {
  const { data, error } = await supabase.rpc("get_receita_mensal" as never);
  if (error) return [];
  return (data || []) as { mes: string; receita: number }[];
}

export async function obterDistribuicaoPlanos() {
  const { data, error } = await supabase.rpc("get_plano_distribuicao" as never);
  if (error) return [];
  return (data || []) as { nome: string; value: number }[];
}
