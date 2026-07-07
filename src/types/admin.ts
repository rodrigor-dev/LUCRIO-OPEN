// ============================================================
// TYPES DO PAINEL ADMINISTRATIVO
// ============================================================

export interface ConfiguracaoGlobal {
  id: string;
  chave: string;
  valor: string | null;
  tipo: 'texto' | 'numero' | 'boolean' | 'json' | 'cor' | 'imagem';
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface PlanoAdmin {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number;
  is_ativo: boolean;
  is_destaque: boolean;
  ordem: number;
  limite_clientes: number;
  limite_receitas: number;
  limite_despesas: number;
  limite_armazenamento_mb: number;
  limite_usuarios: number;
  funcionalidades: string[];
  cor: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Cupom {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo_desconto: 'fixo' | 'porcentagem';
  valor_desconto: number;
  plano_permitido_id: string | null;
  max_utilizacoes: number;
  utilizacoes: number;
  data_inicio: string | null;
  data_fim: string | null;
  dias_gratis: number;
  meses_gratis: number;
  is_vitalicio: boolean;
  primeiro_pagamento_gratis: boolean;
  uso_unico: boolean;
  is_ativo: boolean;
  restringir_email: string[];
  restringir_dominio: string[];
  restringir_usuario_id: string[];
  apenas_novos: boolean;
  apenas_antigos: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Auditoria {
  id: string;
  usuario_id: string | null;
  usuario_email: string | null;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  dados_antes: Record<string, unknown> | null;
  dados_depois: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  criado_em: string;
}

export interface SystemLog {
  id: string;
  nivel: 'erro' | 'aviso' | 'info';
  mensagem: string;
  detalhes: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  rota: string | null;
  metodo_http: string | null;
  status_code: number | null;
  tempo_resposta_ms: number | null;
  stack_trace: string | null;
  criado_em: string;
}

export interface TicketSuporte {
  id: string;
  usuario_id: string;
  assunto: string;
  mensagem: string;
  status: 'aberto' | 'respondido' | 'em_andamento' | 'resolvido' | 'fechado';
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  categoria: string;
  notas_internas: string | null;
  criado_em: string;
  atualizado_em: string;
  usuario?: { nome: string; email: string; avatar_url: string | null };
  mensagens?: MensagemSuporte[];
}

export interface MensagemSuporte {
  id: string;
  ticket_id: string;
  remetente_id: string | null;
  remetente_tipo: 'usuario' | 'admin' | 'sistema';
  mensagem: string;
  criado_em: string;
}

export interface AvisoGlobal {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'aviso' | 'manutencao' | 'atualizacao';
  destinatario: 'todos' | 'plano' | 'usuario' | 'novos' | 'inativos';
  destinatario_ids: string[];
  canal: 'push' | 'email' | 'interno' | 'todos';
  is_ativo: boolean;
  data_inicio: string | null;
  data_fim: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface FeatureFlag {
  id: string;
  chave: string;
  descricao: string | null;
  is_ativo: boolean;
  destinatario: 'todos' | 'admin' | 'teste' | 'plano' | 'usuario';
  destinatario_ids: string[];
  criado_em: string;
  atualizado_em: string;
}

export interface Backup {
  id: string;
  nome: string;
  tamanho_bytes: number | null;
  status: 'pendente' | 'em_progresso' | 'concluido' | 'falha';
  tipo: 'manual' | 'automatico';
  url_download: string | null;
  criado_em: string;
  concluido_em: string | null;
}

export interface Atualizacao {
  id: string;
  versao: string;
  titulo: string;
  descricao: string | null;
  tipo: 'nova_funcionalidade' | 'melhoria' | 'correcao' | 'seguranca';
  is_visivel: boolean;
  criado_em: string;
}

export interface Role {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  permissoes: string[];
  is_sistema: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface AdminStats {
  total_usuarios: number;
  usuarios_ativos: number;
  usuarios_inativos: number;
  novos_hoje: number;
  novos_mes: number;
  total_negocios: number;
  total_clientes: number;
  total_receitas: number;
  total_despesas: number;
}

export interface AdminFinanceiro {
  mrr: number;
  arr_estimado: number;
  total_assinaturas_ativas: number;
  total_cancelamentos: number;
  total_trials: number;
}

export interface UsuarioAdmin {
  id: string;
  email: string;
  nome: string;
  avatar_url: string | null;
  telefone: string | null;
  is_admin: boolean;
  is_ativo: boolean;
  is_bloqueado: boolean;
  is_suspendido: boolean;
  plano_id: string | null;
  role_id: string | null;
  trial_termina_em: string | null;
  ultimo_login_em: string | null;
  ip_ultimo_acesso: string | null;
  user_agent_ultimo: string | null;
  criado_em: string;
  atualizado_em: string;
  role?: Role;
  plano?: PlanoAdmin;
  _count?: { clientes: number; receitas: number; despesas: number };
}

// ============================================================
// TYPES DO SISTEMA DE INDICACAO
// ============================================================

export interface CodigoIndicacao {
  id: string;
  usuario_id: string;
  codigo: string;
  total_indicacoes: number;
  total_recompensas: number;
  is_ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Indicacao {
  id: string;
  indicador_id: string;
  indicado_id: string;
  codigo_usado: string;
  status: "pendente" | "convertida" | "recompensada" | "cancelada";
  trial_convertido: boolean;
  assinatura_gerada: boolean;
  ip_indicado: string | null;
  user_agent_indicado: string | null;
  criado_em: string;
  atualizado_em: string;
  // Joined fields
  indicador_nome?: string;
  indicador_email?: string;
  indicado_nome?: string;
  indicado_email?: string;
}

export interface RecompensaIndicacao {
  id: string;
  usuario_id: string;
  indicacao_id: string;
  tipo: "dias_trial" | "meses_gratis" | "desconto";
  valor: number;
  descricao: string | null;
  aplicada: boolean;
  aplicada_em: string | null;
  criado_em: string;
}

export interface CampanhaIndicacao {
  id: string;
  nome: string;
  descricao: string | null;
  recompensa_indicador_tipo: "dias_trial" | "meses_gratis" | "desconto";
  recompensa_indicador_valor: number;
  recompensa_indicado_tipo: "dias_trial" | "meses_gratis" | "desconto";
  recompensa_indicado_valor: number;
  max_indicacoes_por_usuario: number;
  max_total_indicacoes: number;
  data_inicio: string | null;
  data_fim: string | null;
  bloquear_temp_emails: boolean;
  dominios_bloqueados: string[];
  is_ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface IndicacoesStats {
  total_indicacoes: number;
  convertidas: number;
  pendentes: number;
  recompensas_dadas: number;
  total_dias_dados: number;
  indicacoes_por_dia: { data: string; total: number }[];
}

export interface IndicacoesUsuarioStats {
  codigo: string;
  total_indicacoes: number;
  total_convertidas: number;
  total_recompensas: number;
  indicacoes: Indicacao[];
}