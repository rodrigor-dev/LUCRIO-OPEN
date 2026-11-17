import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
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

/**
 * Antes, erros eram só registrados no console e a tela mostrava "nada
 * encontrado" — o admin não sabia que algo tinha falhado.
 */
function avisarErro(contexto: string, error: unknown) {
  console.error(`[AdminService] ${contexto}:`, error);
  const msg = (error as { message?: string })?.message;
  toast.error(`Não foi possível carregar ${contexto}.`, { description: msg, id: `admin-erro-${contexto}` });
}

/**
 * Update/delete recusado pelo banco (sem permissão) não dá erro: só não
 * altera nada. Aqui conferimos se alguma linha foi realmente alterada.
 */
function exigirAlteracao(data: unknown[] | null, acao: string) {
  if (!data || data.length === 0) {
    throw new Error(`Não foi possível ${acao}: registro não encontrado ou sem permissão.`);
  }
}

// ============================================================
// DASHBOARD
// ============================================================
export async function obterStatsAdmin(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc("get_admin_stats" as never).single();
  if (error) {
    avisarErro("as estatísticas", error);
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
    avisarErro("os dados financeiros", error);
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
    avisarErro("os usuários", error);
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
    .select("*, role:roles(*), assinaturas(status, fim_periodo, trial_termina, plano_id, criado_em)")
    .eq("id", id)
    .single();
  if (error) throw error;

  const assinaturas = (data as { assinaturas?: Array<{
    status: string;
    fim_periodo: string;
    trial_termina: string | null;
    plano_id: string;
    criado_em: string;
  }> }).assinaturas || [];

  const assinaturaAtual = [...assinaturas].sort(
    (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
  )[0];

  let planoNome: string | null = null;
  if (assinaturaAtual?.plano_id) {
    const { data: plano } = await supabase
      .from("planos")
      .select("nome")
      .eq("id", assinaturaAtual.plano_id)
      .single();
    planoNome = plano?.nome || null;
  }

  return {
    ...data,
    assinatura_status: assinaturaAtual?.status || null,
    assinatura_fim_periodo: assinaturaAtual?.fim_periodo || null,
    assinatura_trial_termina: assinaturaAtual?.trial_termina || null,
    plano_nome: planoNome,
  } as UsuarioAdmin;
}

export async function atualizarUsuario(id: string, dados: Partial<UsuarioAdmin>) {
  const { data, error } = await supabase.from("usuarios").update(dados).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "atualizar o usuário");
}

export async function bloquearUsuario(id: string) {
  const { data, error } = await supabase.from("usuarios").update({ is_bloqueado: true }).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "bloquear o usuário");
}

export async function desbloquearUsuario(id: string) {
  const { data, error } = await supabase.from("usuarios").update({ is_bloqueado: false }).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "desbloquear o usuário");
}

export async function suspenderUsuario(id: string) {
  const { data, error } = await supabase.from("usuarios").update({ is_suspendido: true }).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "suspender o usuário");
}

export async function reativarUsuario(id: string) {
  const { data, error } = await supabase.from("usuarios").update({ is_suspendido: false, is_ativo: true }).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "reativar o usuário");
}

/**
 * Exclui a conta de verdade (login + todos os dados). Antes só tentava
 * apagar a linha de "usuarios", o banco recusava em silêncio e a tela
 * mostrava "excluído".
 */
export async function excluirUsuario(id: string) {
  const res = await fetch("/api/admin/usuarios/excluir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuarioId: id }),
  });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(corpo.erro || "Não foi possível excluir o usuário.");
}

// ============================================================
// PLANOS
// ============================================================
export async function listarPlanos() {
  const { data, error } = await supabase.rpc("get_all_planos" as never);
  if (error) {
    avisarErro("os planos", error);
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
  const { data, error } = await supabase.from("planos").update(dados).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "atualizar o plano");
}

export async function excluirPlano(id: string) {
  const { data, error } = await supabase.from("planos").delete().eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "excluir o plano");
}

// ============================================================
// ASSINATURAS
// ============================================================
export async function listarAssinaturas(filtros?: { status?: string }) {
  const { data, error } = await supabase.rpc("get_all_assinaturas" as never);
  if (error) {
    avisarErro("as assinaturas", error);
    return [];
  }
  let assinaturas = data || [];
  if (filtros?.status) assinaturas = assinaturas.filter((a: Record<string, unknown>) => a.status === filtros.status);
  return assinaturas;
}

export async function listarUsuariosAssinaturas() {
  const { data, error } = await supabase.rpc("get_usuarios_assinaturas" as never);
  if (error) {
    avisarErro("as assinaturas", error);
    return [];
  }
  return data || [];
}

export async function atualizarAssinatura(id: string, dados: Record<string, unknown>) {
  if (dados.status === "cancelado") {
    const { error } = await supabase.rpc("cancelar_assinatura" as never, { p_assinatura_id: id });
    if (error) throw error;
  } else if (dados.status === "ativo" && !dados.fim_periodo) {
    const { error } = await supabase.rpc("reativar_assinatura" as never, { p_assinatura_id: id });
    if (error) throw error;
  } else {
    throw new Error("Alteração de assinatura não suportada. Use estender, liberar ou cancelar.");
  }
}

/**
 * Soma dias ao acesso. Se já venceu, conta a partir de hoje.
 * (Antes a tela calculava a data e o banco somava de novo: estender 7
 * dias de quem tinha 20 resultava em 47.)
 */
export async function estenderPeriodo(assinaturaId: string, dias: number) {
  const { error } = await supabase.rpc("estender_periodo" as never, {
    p_assinatura_id: assinaturaId,
    p_dias: dias,
  });
  if (error) throw error;
}

// ============================================================
// CUPONS
// ============================================================
export async function listarCupons() {
  const { data, error } = await supabase.rpc("get_all_cupons" as never);
  if (error) {
    avisarErro("os cupons", error);
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
  const { data, error } = await supabase.from("cupons").update(dados).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "atualizar o cupom");
}

export async function excluirCupom(id: string) {
  const { data, error } = await supabase.from("cupons").delete().eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "excluir o cupom");
}

// ============================================================
// AUDITORIA
// ============================================================
export async function listarAuditoria(filtros?: { usuario_id?: string; acao?: string; limit?: number }) {
  const { data, error } = await supabase.rpc("get_all_auditoria" as never, { p_limit: filtros?.limit || 100 });
  if (error) {
    avisarErro("a auditoria", error);
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
    avisarErro("os logs", error);
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
    avisarErro("os tickets", error);
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
    avisarErro("as mensagens do ticket", error);
    return [];
  }
  return (data || []) as import("@/types/admin").MensagemSuporte[];
}

export async function atualizarTicket(id: string, dados: Partial<TicketSuporte>) {
  const { data, error } = await supabase.from("suporte_tickets").update(dados).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "atualizar o ticket");
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
    avisarErro("os avisos", error);
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
  const { data, error } = await supabase.from("avisos_globais").update(dados).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "atualizar o aviso");
}

export async function excluirAviso(id: string) {
  const { data, error } = await supabase.from("avisos_globais").delete().eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "excluir o aviso");
}

// ============================================================
// FEATURE FLAGS
// ============================================================
export async function listarFeatureFlags() {
  const { data, error } = await supabase.rpc("get_all_feature_flags" as never);
  if (error) {
    avisarErro("as feature flags", error);
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
  const { data, error } = await supabase.from("feature_flags").update(dados).eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "atualizar a feature flag");
}

export async function excluirFeatureFlag(id: string) {
  const { data, error } = await supabase.from("feature_flags").delete().eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "excluir a feature flag");
}

// ============================================================
// CONFIGURACOES GLOBAIS
// ============================================================
export async function listarConfiguracoes() {
  const { data, error } = await supabase.rpc("get_all_configuracoes" as never);
  if (error) {
    avisarErro("as configurações", error);
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
    avisarErro("as permissões", error);
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
    avisarErro("os backups", error);
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
    avisarErro("as atualizações", error);
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
  const { data, error } = await supabase.from("atualizacoes").delete().eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "excluir a atualização");
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
  const { data, error } = await supabase.from("backups").delete().eq("id", id).select("id");
  if (error) throw error;
  exigirAlteracao(data, "excluir o backup");
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
export async function liberarAcesso(usuarioId: string, dias: number, _planoId?: string) {
  const { error } = await supabase.rpc("conceder_acesso" as never, {
    p_usuario_id: usuarioId,
    p_dias: dias,
  });
  if (error) {
    console.error("[AdminService] conceder_acesso error:", error);
    throw error;
  }
}

export async function acessoSistematico(usuarioId: string) {
  const { error } = await supabase.rpc("acesso_vitalicio" as never, {
    p_usuario_id: usuarioId,
  });
  if (error) {
    console.error("[AdminService] acesso_vitalicio error:", error);
    throw error;
  }
}

export async function estenderTrial(usuarioId: string, dias: number) {
  const { error } = await supabase.rpc("estender_trial" as never, {
    p_usuario_id: usuarioId,
    p_dias: dias,
  });
  if (error) {
    console.error("[AdminService] estender_trial error:", error);
    throw error;
  }
}

export async function tornarAdmin(usuarioId: string, is_admin: boolean) {
  const { error } = await supabase.rpc("toggle_admin" as never, {
    p_usuario_id: usuarioId,
    p_is_admin: is_admin,
  });
  if (error) {
    console.error("[AdminService] toggle_admin error:", error);
    throw error;
  }
}

export async function obterAssinaturaUsuario(usuarioId: string) {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*, plano:planos(nome, slug, preco_mensal)")
    .eq("usuario_id", usuarioId)
    .in("status", ["trial", "ativo", "cancelado", "atrasado"])
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

// ============================================================
// CHART DATA
// ============================================================
export async function obterCrescimentoUsuarios() {
  const { data, error } = await supabase.rpc("get_usuario_crescimento_mensal" as never);
  if (error) { avisarErro("o crescimento de usuários", error); return []; }
  return (data || []) as { mes: string; total: number }[];
}

export async function obterReceitaMensal() {
  const { data, error } = await supabase.rpc("get_receita_mensal" as never);
  if (error) { avisarErro("a receita mensal", error); return []; }
  return (data || []) as { mes: string; receita: number }[];
}

export async function obterDistribuicaoPlanos() {
  const { data, error } = await supabase.rpc("get_plano_distribuicao" as never);
  if (error) { avisarErro("a distribuição de planos", error); return []; }
  return (data || []) as { nome: string; value: number }[];
}
