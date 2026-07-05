-- Migration 005b: Correcao para planos existente + dados admin
-- Execute ESTE em vez do 005 original

-- ============================================================
-- 1. ADICIONAR COLUNAS FALTANTES na tabela planos
-- ============================================================
ALTER TABLE planos ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS is_destaque BOOLEAN DEFAULT false;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS limite_clientes INTEGER DEFAULT -1;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS limite_receitas INTEGER DEFAULT -1;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS limite_despesas INTEGER DEFAULT -1;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS limite_armazenamento_mb INTEGER DEFAULT 100;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS limite_usuarios INTEGER DEFAULT 1;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS cor TEXT DEFAULT '#6366f1';
ALTER TABLE planos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT now();

-- Gerar slug a partir do nome para registros existentes
UPDATE planos SET slug = LOWER(REPLACE(nome, ' ', '-')) WHERE slug IS NULL;

-- Adicionar constraint UNIQUE no slug
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planos_slug_unique') THEN
    ALTER TABLE planos ADD CONSTRAINT planos_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- ============================================================
-- 2. ATUALIZAR planos existentes com dados novos
-- ============================================================
UPDATE planos SET
  descricao = 'Plano basico com funcionalidades limitadas',
  preco_mensal = 0,
  preco_anual = 0,
  is_ativo = true,
  is_destaque = false,
  ordem = 1,
  limite_clientes = 10,
  funcionalidades = '["Clientes basicos","Receitas","Despesas","Dashboard simples"]'::jsonb
WHERE slug = 'plano-basico' OR slug = 'basico' OR slug = 'gratuito';

-- Inserir PRO se nao existir
INSERT INTO planos (nome, slug, descricao, preco_mensal, preco_anual, is_ativo, is_destaque, ordem, limite_clientes, funcionalidades)
SELECT 'PRO', 'pro', 'Plano completo com todas as funcionalidades', 14.99, 139.99, true, true, 2, -1,
  '["Clientes ilimitados","Receitas e despesas","Calendario financeiro","Relatorios avancados","Propostas","Suporte prioritario"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM planos WHERE slug = 'pro');

-- ============================================================
-- 3. CONFIGURACOES GLOBAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracoes_globais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor TEXT,
  tipo TEXT DEFAULT 'texto' CHECK (tipo IN ('texto', 'numero', 'boolean', 'json', 'cor', 'imagem')),
  descricao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

INSERT INTO configuracoes_globais (chave, valor, tipo, descricao) VALUES
  ('app_name', 'LUCRIO', 'texto', 'Nome do sistema'),
  ('app_logo', '', 'imagem', 'Logo do sistema'),
  ('app_favicon', '', 'imagem', 'Favicon do sistema'),
  ('app_cor_primaria', '#6366f1', 'cor', 'Cor primaria do tema'),
  ('app_cor_secundaria', '#8b5cf6', 'cor', 'Cor secundaria do tema'),
  ('app_moeda', 'BRL', 'texto', 'Moeda padrao'),
  ('app_idioma', 'pt-BR', 'texto', 'Idioma padrao'),
  ('app_fuso_horario', 'America/Sao_Paulo', 'texto', 'Fuso horario'),
  ('app_manutencao', 'false', 'boolean', 'Modo manutencao'),
  ('app_trial_dias', '7', 'numero', 'Dias de trial gratuito'),
  ('app_url_politica', '', 'texto', 'URL da politica de privacidade'),
  ('app_url_termos', '', 'texto', 'URL dos termos de uso'),
  ('app_contato_email', '', 'texto', 'Email de contato'),
  ('app_whatsapp', '', 'texto', 'WhatsApp de suporte'),
  ('app_redes_sociais', '{}', 'json', 'Links de redes sociais')
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- 4. CUPONS DE DESCONTO
-- ============================================================
CREATE TABLE IF NOT EXISTS cupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  descricao TEXT,
  tipo_desconto TEXT NOT NULL CHECK (tipo_desconto IN ('fixo', 'porcentagem')),
  valor_desconto NUMERIC(10,2) NOT NULL,
  plano_permitido_id UUID REFERENCES planos(id) ON DELETE SET NULL,
  max_utilizacoes INTEGER DEFAULT -1,
  utilizacoes INTEGER DEFAULT 0,
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  dias_gratis INTEGER DEFAULT 0,
  meses_gratis INTEGER DEFAULT 0,
  is_vitalicio BOOLEAN DEFAULT false,
  primeiro_pagamento_gratis BOOLEAN DEFAULT false,
  uso_unico BOOLEAN DEFAULT false,
  is_ativo BOOLEAN DEFAULT true,
  restringir_email TEXT[],
  restringir_dominio TEXT[],
  restringir_usuario_id UUID[],
  apenas_novos BOOLEAN DEFAULT false,
  apenas_antigos BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. AUDITORIA
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_email TEXT,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  dados_antes JSONB,
  dados_depois JSONB,
  ip_address TEXT,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON auditoria(entidade);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado ON auditoria(criado_em);

-- ============================================================
-- 6. LOGS do sistema
-- ============================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nivel TEXT NOT NULL CHECK (nivel IN ('erro', 'aviso', 'info')),
  mensagem TEXT NOT NULL,
  detalhes JSONB,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  rota TEXT,
  metodo_http TEXT,
  status_code INTEGER,
  tempo_resposta_ms INTEGER,
  stack_trace TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_nivel ON system_logs(nivel);
CREATE INDEX IF NOT EXISTS idx_system_logs_criado ON system_logs(criado_em);
CREATE INDEX IF NOT EXISTS idx_system_logs_usuario ON system_logs(usuario_id);

-- ============================================================
-- 7. SUPORTE
-- ============================================================
CREATE TABLE IF NOT EXISTS suporte_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'respondido', 'em_andamento', 'resolvido', 'fechado')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  categoria TEXT DEFAULT 'geral',
  notas_internas TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suporte_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES suporte_tickets(id) ON DELETE CASCADE,
  remetente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  remetente_tipo TEXT NOT NULL CHECK (remetente_tipo IN ('usuario', 'admin', 'sistema')),
  mensagem TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suporte_tickets_usuario ON suporte_tickets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_suporte_tickets_status ON suporte_tickets(status);

-- ============================================================
-- 8. AVISOS GLOBAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS avisos_globais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'info' CHECK (tipo IN ('info', 'aviso', 'manutencao', 'atualizacao')),
  destinatario TEXT DEFAULT 'todos' CHECK (destinatario IN ('todos', 'plano', 'usuario', 'novos', 'inativos')),
  destinatario_ids TEXT[],
  canal TEXT DEFAULT 'interno' CHECK (canal IN ('push', 'email', 'interno', 'todos')),
  is_ativo BOOLEAN DEFAULT true,
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. FEATURE FLAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  descricao TEXT,
  is_ativo BOOLEAN DEFAULT false,
  destinatario TEXT DEFAULT 'todos' CHECK (destinatario IN ('todos', 'admin', 'teste', 'plano', 'usuario')),
  destinatario_ids TEXT[],
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. BACKUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tamanho_bytes BIGINT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_progresso', 'concluido', 'falha')),
  tipo TEXT DEFAULT 'manual' CHECK (tipo IN ('manual', 'automatico')),
  url_download TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  concluido_em TIMESTAMPTZ
);

-- ============================================================
-- 11. ATUALIZACOES
-- ============================================================
CREATE TABLE IF NOT EXISTS atualizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT DEFAULT 'melhoria' CHECK (tipo IN ('nova_funcionalidade', 'melhoria', 'correcao', 'seguranca')),
  is_visivel BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 12. PERMISSOES RBAC
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  descricao TEXT,
  permissoes JSONB DEFAULT '[]'::jsonb,
  is_sistema BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

INSERT INTO roles (nome, slug, descricao, permissoes, is_sistema) VALUES
  ('Super Admin', 'super_admin', 'Acesso total ao sistema', '["*"]'::jsonb, true),
  ('Administrador', 'admin', 'Administrador do sistema', '["usuarios.read","usuarios.update","planos.read","planos.update","assinaturas.read","assinaturas.update","cupons.read","cupons.update","suporte.read","suporte.update","logs.read","financeiro.read","configuracoes.read","configuracoes.update"]'::jsonb, true),
  ('Suporte', 'suporte', 'Equipe de suporte', '["suporte.read","suporte.update","usuarios.read","logs.read"]'::jsonb, true),
  ('Financeiro', 'financeiro', 'Equipe financeira', '["financeiro.read","assinaturas.read","assinaturas.update","cupons.read"]'::jsonb, true),
  ('Marketing', 'marketing', 'Equipe de marketing', '["avisos.read","avisos.update","cupons.read","cupons.update"]'::jsonb, true),
  ('Desenvolvedor', 'dev', 'Desenvolvedor', '["logs.read","feature_flags.read","feature_flags.update","backups.read","backups.update"]'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;

-- Adicionar colunas na tabela usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_bloqueado BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_suspendido BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login_em TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ip_ultimo_acesso TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS user_agent_ultimo TEXT;

-- ============================================================
-- 13. BLOQUEIO DE IP
-- ============================================================
CREATE TABLE IF NOT EXISTS ips_bloqueados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  motivo TEXT,
  bloqueado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT now(),
  expira_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ips_bloqueados_ip ON ips_bloqueados(ip);

-- ============================================================
-- 14. SESSOES ATIVAS
-- ============================================================
CREATE TABLE IF NOT EXISTS sessoes_ativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  ultimo_acesso_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_ativas_usuario ON sessoes_ativas(usuario_id);

-- ============================================================
-- RLS para tabelas admin
-- ============================================================
ALTER TABLE configuracoes_globais ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suporte_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE suporte_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos_globais ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE atualizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ips_bloqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_ativas ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  -- configuracoes_globais
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'config_globais_admin') THEN
    CREATE POLICY 'config_globais_admin' ON configuracoes_globais FOR ALL USING (true);
  END IF;
  -- cupons
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cupons_admin') THEN
    CREATE POLICY 'cupons_admin' ON cupons FOR ALL USING (true);
  END IF;
  -- auditoria
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auditoria_admin') THEN
    CREATE POLICY 'auditoria_admin' ON auditoria FOR ALL USING (true);
  END IF;
  -- system_logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'logs_admin') THEN
    CREATE POLICY 'logs_admin' ON system_logs FOR ALL USING (true);
  END IF;
  -- suporte_tickets
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'suporte_usuario') THEN
    CREATE POLICY 'suporte_usuario' ON suporte_tickets FOR ALL USING (usuario_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'suporte_admin') THEN
    CREATE POLICY 'suporte_admin' ON suporte_tickets FOR ALL USING (true);
  END IF;
  -- suporte_mensagens
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'suporte_msg_usuario') THEN
    CREATE POLICY 'suporte_msg_usuario' ON suporte_mensagens FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'suporte_msg_admin') THEN
    CREATE POLICY 'suporte_msg_admin' ON suporte_mensagens FOR ALL USING (true);
  END IF;
  -- avisos_globais
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avisos_public') THEN
    CREATE POLICY 'avisos_public' ON avisos_globais FOR SELECT USING (is_ativo = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avisos_admin') THEN
    CREATE POLICY 'avisos_admin' ON avisos_globais FOR ALL USING (true);
  END IF;
  -- feature_flags
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feature_flags_admin') THEN
    CREATE POLICY 'feature_flags_admin' ON feature_flags FOR ALL USING (true);
  END IF;
  -- backups
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'backups_admin') THEN
    CREATE POLICY 'backups_admin' ON backups FOR ALL USING (true);
  END IF;
  -- atualizacoes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'atualizacoes_public') THEN
    CREATE POLICY 'atualizacoes_public' ON atualizacoes FOR SELECT USING (is_visivel = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'atualizacoes_admin') THEN
    CREATE POLICY 'atualizacoes_admin' ON atualizacoes FOR ALL USING (true);
  END IF;
  -- roles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'roles_admin') THEN
    CREATE POLICY 'roles_admin' ON roles FOR ALL USING (true);
  END IF;
  -- ips_bloqueados
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ips_admin') THEN
    CREATE POLICY 'ips_admin' ON ips_bloqueados FOR ALL USING (true);
  END IF;
  -- sessoes_ativas
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessoes_admin') THEN
    CREATE POLICY 'sessoes_admin' ON sessoes_ativas FOR ALL USING (true);
  END IF;
END $$;

-- ============================================================
-- VIEWS para dashboard admin
-- ============================================================
CREATE OR REPLACE VIEW admin_stats AS
SELECT
  (SELECT COUNT(*) FROM usuarios) AS total_usuarios,
  (SELECT COUNT(*) FROM usuarios WHERE is_ativo = true) AS usuarios_ativos,
  (SELECT COUNT(*) FROM usuarios WHERE is_ativo = false) AS usuarios_inativos,
  (SELECT COUNT(*) FROM usuarios WHERE criado_em >= CURRENT_DATE) AS novos_hoje,
  (SELECT COUNT(*) FROM usuarios WHERE criado_em >= date_trunc('month', CURRENT_DATE)) AS novos_mes,
  (SELECT COUNT(*) FROM negocios) AS total_negocios,
  (SELECT COUNT(*) FROM clientes) AS total_clientes,
  (SELECT COUNT(*) FROM receitas) AS total_receitas,
  (SELECT COUNT(*) FROM despesas) AS total_despesas;

CREATE OR REPLACE VIEW admin_financeiro AS
SELECT
  (SELECT COALESCE(SUM(valor_mensal), 0) FROM clientes WHERE tipo = 'fixo' AND is_ativo = true) AS mrr,
  (SELECT COALESCE(SUM(preco_mensal), 0) FROM planos WHERE is_ativo = true AND preco_mensal > 0) AS arr_estimado,
  (SELECT COALESCE(SUM(valor), 0) FROM assinaturas WHERE status = 'ativo') AS total_assinaturas_ativas,
  (SELECT COUNT(*) FROM assinaturas WHERE status = 'cancelado') AS total_cancelamentos,
  (SELECT COUNT(*) FROM assinaturas WHERE status = 'trial') AS total_trials;
