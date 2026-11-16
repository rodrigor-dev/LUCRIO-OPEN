-- ============================================================
-- 029: Área de admin — segurança, funções quebradas e métricas reais
-- ============================================================
-- Só afeta o painel de admin. O que os usuários veem e cadastraram não
-- muda (o chat de suporte do usuário continua funcionando igual).
--
-- A. FALHA DE SEGURANÇA: 13 tabelas tinham a regra "all_admin" com
--    condição "true" — qualquer pessoa, até sem login, podia ler, criar,
--    alterar e apagar cupons, avisos, configurações, feature flags,
--    tickets/mensagens de suporte de todos, logs, auditoria etc.
-- B. Funções do painel que davam erro sempre (tela vazia):
--    get_all_assinaturas, get_admin_indicacoes, get_admin_indicacoes_stats.
-- C. Métricas erradas: MRR e "assinaturas ativas" contavam assinaturas
--    vencidas; gráficos em inglês e na ordem invertida.
-- D. Ações do admin:
--    * "Liberar acesso" podia ENCURTAR o período de quem já pagou;
--    * "Estender período" a partir de data vencida continuava vencido;
--    * "Reativar" não limpava o cancelamento;
--    * criar/editar plano era recusado pelo banco;
--    * salvar configuração nova não gravava (só atualizava existentes);
--    * excluir usuário era impossível (chaves estrangeiras bloqueavam).
-- Segura para rodar mais de uma vez.
-- ============================================================


-- ------------------------------------------------------------
-- A. Segurança das tabelas do admin
-- ------------------------------------------------------------
DO $$
DECLARE
  v_tabela TEXT;
  v_pol RECORD;
BEGIN
  -- Tabelas usadas SOMENTE pelo painel de admin
  FOREACH v_tabela IN ARRAY ARRAY[
    'atualizacoes', 'auditoria', 'avisos_globais', 'backups',
    'configuracoes_globais', 'cupons', 'feature_flags', 'ips_bloqueados',
    'sessoes_ativas', 'system_logs', 'roles', 'suporte_tickets', 'suporte_mensagens'
  ] LOOP
    IF to_regclass('public.' || v_tabela) IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tabela LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_tabela);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabela);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v_tabela);
    EXECUTE format(
      'CREATE POLICY admin_total ON public.%I FOR ALL TO authenticated
         USING (public.chamador_eh_admin_ou_servidor())
         WITH CHECK (public.chamador_eh_admin_ou_servidor())',
      v_tabela
    );
  END LOOP;
END $$;

-- roles: o perfil de todo usuário carrega a role dele (leitura liberada
-- para quem está logado, como antes); só admin altera.
CREATE POLICY roles_leitura ON public.roles FOR SELECT TO authenticated USING (true);

-- Suporte: o usuário continua vendo e abrindo os PRÓPRIOS tickets e
-- mandando mensagens no PRÓPRIO ticket (igual ao chat de hoje).
CREATE POLICY tickets_proprios_leitura ON public.suporte_tickets
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY tickets_proprios_criar ON public.suporte_tickets
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE POLICY mensagens_proprias_leitura ON public.suporte_mensagens
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suporte_tickets t WHERE t.id = ticket_id AND t.usuario_id = auth.uid()));
CREATE POLICY mensagens_proprias_criar ON public.suporte_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.suporte_tickets t WHERE t.id = ticket_id AND t.usuario_id = auth.uid())
    AND remetente_tipo IN ('usuario', 'sistema')
    AND (remetente_id IS NULL OR remetente_id = auth.uid())
  );

-- Planos: admin pode criar, editar e excluir (antes só a exclusão tinha
-- regra). A leitura para usuários logados continua como estava.
DO $$
DECLARE v_pol RECORD;
BEGIN
  FOR v_pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'planos' AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.planos', v_pol.policyname);
  END LOOP;
END $$;
CREATE POLICY planos_admin_excluir ON public.planos
  FOR DELETE TO authenticated USING (public.chamador_eh_admin_ou_servidor());
CREATE POLICY planos_admin_criar ON public.planos
  FOR INSERT TO authenticated WITH CHECK (public.chamador_eh_admin_ou_servidor());
CREATE POLICY planos_admin_editar ON public.planos
  FOR UPDATE TO authenticated
  USING (public.chamador_eh_admin_ou_servidor()) WITH CHECK (public.chamador_eh_admin_ou_servidor());


-- ------------------------------------------------------------
-- A2. Excluir usuário pelo painel: histórico de suporte/log não bloqueia
-- ------------------------------------------------------------
DO $$
DECLARE
  v RECORD;
  v_acao TEXT;
BEGIN
  FOR v IN
    SELECT c.conname, c.conrelid::regclass AS tabela, a.attname AS coluna,
           c.confrelid::regclass AS referencia, cl.relname AS nome_tabela,
           a.attnotnull AS obrigatoria
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confdeltype = 'a'  -- sem ON DELETE (bloqueia)
      AND (
        (c.confrelid = 'auth.users'::regclass AND cl.relname IN
          ('auditoria', 'system_logs', 'suporte_tickets', 'suporte_mensagens', 'ips_bloqueados', 'sessoes_ativas'))
        OR (c.confrelid = 'public.usuarios'::regclass AND cl.relname = 'logs_atividade')
        OR (c.confrelid = 'public.negocios'::regclass AND cl.relname = 'pagamentos')
        OR (c.confrelid = 'public.assinaturas'::regclass AND cl.relname = 'pagamentos')
        OR (c.confrelid = 'public.suporte_tickets'::regclass AND cl.relname = 'suporte_mensagens')
      )
  LOOP
    -- Tickets e sessões são do usuário: vão junto. Logs/auditoria ficam,
    -- só sem o vínculo. Coluna obrigatória → apaga junto.
    v_acao := CASE
      WHEN v.nome_tabela IN ('suporte_tickets', 'sessoes_ativas')
        OR (v.nome_tabela = 'pagamentos' AND v.coluna = 'negocio_id')
        OR (v.nome_tabela = 'suporte_mensagens' AND v.coluna = 'ticket_id')
        OR v.obrigatoria
      THEN 'CASCADE' ELSE 'SET NULL' END;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v.tabela, v.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(id) ON DELETE %s',
                   v.tabela, v.conname, v.coluna, v.referencia, v_acao);
  END LOOP;
END $$;


-- ------------------------------------------------------------
-- B. Funções que davam erro sempre
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_assinaturas()
RETURNS TABLE(id uuid, usuario_id uuid, plano_id text, status text, inicio_periodo timestamptz,
              fim_periodo timestamptz, trial_termina timestamptz, criado_em timestamptz,
              usuario_nome text, usuario_email text, plano_nome text, plano_preco numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id, a.usuario_id, a.plano_id::text, a.status, a.inicio_periodo, a.fim_periodo,
         a.trial_termina, a.criado_em, u.nome, u.email, p.nome, p.preco_mensal
  FROM assinaturas a
  LEFT JOIN usuarios u ON u.id = a.usuario_id
  LEFT JOIN planos p ON p.id = a.plano_id
  ORDER BY a.criado_em DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_indicacoes(p_status TEXT DEFAULT NULL, p_busca TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado JSONB;
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', i.id,
    'indicador_nome', COALESCE(u_ind.nome, 'N/A'),
    'indicador_email', u_ind.email,
    'indicado_nome', COALESCE(u_indicado.nome, 'N/A'),
    'indicado_email', u_indicado.email,
    'codigo_usado', i.codigo_usado,
    'status', i.status,
    'ip_indicado', i.ip_indicado,
    'criado_em', i.criado_em
  ) ORDER BY i.criado_em DESC) INTO v_resultado
  FROM indicacoes i
  LEFT JOIN usuarios u_ind ON u_ind.id = i.indicador_id
  LEFT JOIN usuarios u_indicado ON u_indicado.id = i.indicado_id
  WHERE (p_status IS NULL OR i.status = p_status)
    AND (p_busca IS NULL
      OR u_ind.email ILIKE '%' || p_busca || '%'
      OR u_indicado.email ILIKE '%' || p_busca || '%'
      OR u_ind.nome ILIKE '%' || p_busca || '%'
      OR u_indicado.nome ILIKE '%' || p_busca || '%');

  RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_indicacoes_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_convertidas INTEGER;
  v_pendentes INTEGER;
  v_recompensas_dadas INTEGER;
  v_total_dias_dados NUMERIC;
  v_por_dia JSONB;
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total FROM indicacoes;
  SELECT COUNT(*) INTO v_convertidas FROM indicacoes WHERE status IN ('convertida', 'recompensada');
  SELECT COUNT(*) INTO v_pendentes FROM indicacoes WHERE status = 'pendente';
  SELECT COUNT(*) INTO v_recompensas_dadas FROM recompensas_indicacao WHERE aplicada = true;
  SELECT COALESCE(SUM(valor), 0) INTO v_total_dias_dados
  FROM recompensas_indicacao WHERE aplicada = true AND tipo = 'dias_trial';

  SELECT jsonb_agg(jsonb_build_object('data', dias.dia, 'total', COALESCE(contagem.cnt, 0)) ORDER BY dias.dia)
  INTO v_por_dia
  FROM (
    SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day')::DATE AS dia
  ) dias
  LEFT JOIN (
    SELECT DATE(criado_em) AS dia, COUNT(*) AS cnt
    FROM indicacoes
    WHERE criado_em >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY DATE(criado_em)
  ) contagem ON contagem.dia = dias.dia;

  RETURN jsonb_build_object(
    'total_indicacoes', COALESCE(v_total, 0),
    'convertidas', COALESCE(v_convertidas, 0),
    'pendentes', COALESCE(v_pendentes, 0),
    'recompensas_dadas', COALESCE(v_recompensas_dadas, 0),
    'total_dias_dados', COALESCE(v_total_dias_dados, 0),
    'indicacoes_por_dia', COALESCE(v_por_dia, '[]'::jsonb)
  );
END;
$$;


-- ------------------------------------------------------------
-- C. Métricas reais
-- ------------------------------------------------------------
-- Assinatura "atual" de cada usuário: mesma regra da tela do sistema
-- (a mais recente entre trial/ativo/cancelado/atrasado).
CREATE OR REPLACE FUNCTION public.admin_assinaturas_atuais()
RETURNS TABLE(usuario_id uuid, is_admin boolean, assinatura_id uuid, status text,
              inicio_periodo timestamptz, fim_periodo timestamptz, criado_em timestamptz,
              metodo_pagamento_id text, cancelar_ao_fim_periodo boolean,
              tem_acesso boolean, categoria text, valor_mensal numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, COALESCE(u.is_admin, false), a.id, a.status, a.inicio_periodo, a.fim_periodo, a.criado_em,
         a.metodo_pagamento_id, COALESCE(a.cancelar_ao_fim_periodo, false),
         public.usuario_tem_acesso(u.id) AS tem_acesso,
         CASE
           WHEN a.id IS NULL THEN 'sem_assinatura'
           WHEN COALESCE(u.is_admin, false) OR a.fim_periodo > now() + INTERVAL '2 years' THEN 'cortesia'
           WHEN NOT public.usuario_tem_acesso(u.id) THEN 'vencido'
           WHEN a.status = 'trial' THEN 'teste'
           WHEN a.fim_periodo - COALESCE(a.inicio_periodo, a.criado_em) > INTERVAL '200 days' THEN 'anual'
           ELSE 'mensal'
         END AS categoria,
         CASE
           WHEN a.fim_periodo - COALESCE(a.inicio_periodo, a.criado_em) > INTERVAL '200 days'
             THEN COALESCE(p.preco_anual, 0) / 12
           ELSE COALESCE(p.preco_mensal, 0)
         END AS valor_mensal
  FROM usuarios u
  LEFT JOIN LATERAL (
    SELECT * FROM assinaturas a2
    WHERE a2.usuario_id = u.id AND a2.status IN ('trial', 'ativo', 'cancelado', 'atrasado')
    ORDER BY a2.criado_em DESC
    LIMIT 1
  ) a ON true
  LEFT JOIN planos p ON p.id = a.plano_id;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_assinaturas_atuais() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mes_curto_pt(p_data DATE)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (ARRAY['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'])[EXTRACT(MONTH FROM p_data)::INT]
         || '/' || to_char(p_data, 'YY');
$$;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE(total_usuarios bigint, usuarios_ativos bigint, usuarios_inativos bigint, novos_hoje bigint,
              novos_mes bigint, total_negocios bigint, total_clientes bigint, total_receitas bigint,
              total_despesas bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_total BIGINT;
  v_com_acesso BIGINT;
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_total FROM usuarios;
  SELECT COUNT(*) INTO v_com_acesso FROM public.admin_assinaturas_atuais() x WHERE x.tem_acesso;

  RETURN QUERY SELECT
    v_total,
    v_com_acesso,                 -- "ativos" = com acesso liberado hoje
    v_total - v_com_acesso,       -- "inativos" = bloqueados/vencidos
    (SELECT COUNT(*) FROM usuarios WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo')::DATE = v_hoje),
    (SELECT COUNT(*) FROM usuarios WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo')::DATE >= date_trunc('month', v_hoje)::DATE),
    (SELECT COUNT(*) FROM negocios),
    (SELECT COUNT(*) FROM clientes),
    (SELECT COUNT(*) FROM receitas),
    (SELECT COUNT(*) FROM despesas);
END;
$$;

DROP FUNCTION IF EXISTS public.get_admin_financeiro();
CREATE FUNCTION public.get_admin_financeiro()
RETURNS TABLE(mrr numeric, arr_estimado numeric, total_assinaturas_ativas bigint, total_cancelamentos bigint,
              total_trials bigint, pagantes_mensal bigint, pagantes_anual bigint, cortesias bigint,
              atrasados bigint, vencidos bigint, reembolsos bigint, receita_mes_atual numeric,
              pagamentos_mes_atual bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio_mes TIMESTAMPTZ := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_preco_mensal NUMERIC;
  v_preco_anual NUMERIC;
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  SELECT preco_mensal, preco_anual INTO v_preco_mensal, v_preco_anual
  FROM planos WHERE slug = 'pro' ORDER BY is_ativo DESC LIMIT 1;

  RETURN QUERY
  WITH x AS (SELECT * FROM public.admin_assinaturas_atuais())
  SELECT
    ROUND(COALESCE(SUM(x.valor_mensal) FILTER (WHERE x.categoria IN ('mensal', 'anual')), 0), 2),
    ROUND(COALESCE(SUM(x.valor_mensal) FILTER (WHERE x.categoria IN ('mensal', 'anual')), 0) * 12, 2),
    COUNT(*) FILTER (WHERE x.categoria IN ('mensal', 'anual')),
    COUNT(*) FILTER (WHERE x.status = 'cancelado' OR x.cancelar_ao_fim_periodo),
    COUNT(*) FILTER (WHERE x.categoria = 'teste'),
    COUNT(*) FILTER (WHERE x.categoria = 'mensal'),
    COUNT(*) FILTER (WHERE x.categoria = 'anual'),
    COUNT(*) FILTER (WHERE x.categoria = 'cortesia'),
    COUNT(*) FILTER (WHERE x.status = 'atrasado' AND x.tem_acesso),
    COUNT(*) FILTER (WHERE x.categoria IN ('vencido', 'sem_assinatura')),
    (SELECT COUNT(*) FROM pagamentos_eventos e WHERE e.evento IN ('refund', 'chargeback')),
    (SELECT COALESCE(SUM(CASE WHEN e.plano = 'anual' THEN v_preco_anual ELSE v_preco_mensal END), 0)
       FROM pagamentos_eventos e WHERE e.estendeu_periodo AND e.recebido_em >= v_inicio_mes),
    (SELECT COUNT(*) FROM pagamentos_eventos e WHERE e.estendeu_periodo AND e.recebido_em >= v_inicio_mes)
  FROM x;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_plano_distribuicao()
RETURNS TABLE(nome text, value bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT CASE x.categoria
           WHEN 'mensal' THEN 'Mensal'
           WHEN 'anual' THEN 'Anual'
           WHEN 'teste' THEN 'Teste grátis'
           WHEN 'cortesia' THEN 'Cortesia/Admin'
           ELSE 'Sem acesso'
         END::TEXT,
         COUNT(*)::BIGINT
  FROM public.admin_assinaturas_atuais() x
  GROUP BY 1
  ORDER BY 2 DESC;
END;
$$;

-- Receita confirmada por mês (pagamentos recebidos pela Cakto), últimos
-- 6 meses, do mais antigo para o mais novo.
CREATE OR REPLACE FUNCTION public.get_receita_mensal()
RETURNS TABLE(mes text, receita numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preco_mensal NUMERIC;
  v_preco_anual NUMERIC;
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  SELECT preco_mensal, preco_anual INTO v_preco_mensal, v_preco_anual
  FROM planos WHERE slug = 'pro' ORDER BY is_ativo DESC LIMIT 1;

  RETURN QUERY
  SELECT public.mes_curto_pt(m.mes::DATE),
         COALESCE((
           SELECT SUM(CASE WHEN e.plano = 'anual' THEN v_preco_anual ELSE v_preco_mensal END)
           FROM pagamentos_eventos e
           WHERE e.estendeu_periodo
             AND date_trunc('month', e.recebido_em AT TIME ZONE 'America/Sao_Paulo') = m.mes
         ), 0)::NUMERIC
  FROM generate_series(
         date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '5 months',
         date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo'),
         INTERVAL '1 month') AS m(mes)
  ORDER BY m.mes;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_usuario_crescimento_mensal()
RETURNS TABLE(mes text, total bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT public.mes_curto_pt(m.mes::DATE),
         (SELECT COUNT(*) FROM usuarios u WHERE u.criado_em < (m.mes + INTERVAL '1 month') AT TIME ZONE 'America/Sao_Paulo')::BIGINT
  FROM generate_series(
         date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '5 months',
         date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo'),
         INTERVAL '1 month') AS m(mes)
  ORDER BY m.mes;
END;
$$;

-- Lista de assinaturas do admin: mesma assinatura "atual" da tela do
-- usuário + forma de pagamento e se tem acesso hoje.
DROP FUNCTION IF EXISTS public.get_usuarios_assinaturas();
CREATE FUNCTION public.get_usuarios_assinaturas()
RETURNS TABLE(usuario_id uuid, usuario_nome text, usuario_email text, usuario_avatar text,
              usuario_criado_em timestamptz, is_admin boolean, is_ativo boolean, assinatura_id uuid,
              plano_id uuid, plano_nome text, plano_preco numeric, status text, inicio_periodo timestamptz,
              fim_periodo timestamptz, trial_termina timestamptz, criado_em timestamptz,
              metodo_pagamento_id text, cancelar_ao_fim_periodo boolean, tem_acesso boolean, categoria text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.nome, u.email, u.avatar_url, u.criado_em, COALESCE(u.is_admin, false), COALESCE(u.is_ativo, true),
         a.id, a.plano_id, p.nome, p.preco_mensal, a.status, a.inicio_periodo, a.fim_periodo, a.trial_termina,
         a.criado_em, a.metodo_pagamento_id, COALESCE(a.cancelar_ao_fim_periodo, false), x.tem_acesso, x.categoria
  FROM usuarios u
  JOIN public.admin_assinaturas_atuais() x ON x.usuario_id = u.id
  LEFT JOIN assinaturas a ON a.id = x.assinatura_id
  LEFT JOIN planos p ON p.id = a.plano_id
  ORDER BY x.tem_acesso DESC, u.criado_em DESC;
END;
$$;


-- ------------------------------------------------------------
-- D. Ações do admin
-- ------------------------------------------------------------
-- Liberar acesso: SOMA os dias ao acesso atual (nunca encurta quem pagou).
CREATE OR REPLACE FUNCTION public.conceder_acesso(p_usuario_id UUID, p_dias INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano_id UUID;
  v_id UUID;
  v_fim TIMESTAMPTZ;
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
  IF p_dias IS NULL OR p_dias < 1 THEN
    RAISE EXCEPTION 'Informe ao menos 1 dia';
  END IF;

  SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' ORDER BY is_ativo DESC LIMIT 1;
  IF v_plano_id IS NULL THEN
    RAISE EXCEPTION 'Plano PRO nao encontrado';
  END IF;

  SELECT id, fim_periodo INTO v_id, v_fim FROM assinaturas
  WHERE usuario_id = p_usuario_id AND status IN ('trial', 'ativo', 'cancelado', 'atrasado')
  ORDER BY criado_em DESC LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE assinaturas SET
      status = 'ativo',
      plano_id = COALESCE(plano_id, v_plano_id),
      inicio_periodo = CASE WHEN fim_periodo IS NULL OR fim_periodo < now() THEN now() ELSE inicio_periodo END,
      fim_periodo = GREATEST(COALESCE(v_fim, now()), now()) + make_interval(days => p_dias),
      trial_termina = CASE WHEN status = 'trial' THEN now() ELSE trial_termina END,
      cancelar_ao_fim_periodo = false,
      cancelado_em = NULL
    WHERE id = v_id;
  ELSE
    INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
    VALUES (p_usuario_id, v_plano_id, 'ativo', now(), now(), now() + make_interval(days => p_dias));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.acesso_vitalicio(p_usuario_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano_id UUID;
  v_id UUID;
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' ORDER BY is_ativo DESC LIMIT 1;
  IF v_plano_id IS NULL THEN
    RAISE EXCEPTION 'Plano PRO nao encontrado';
  END IF;

  SELECT id INTO v_id FROM assinaturas
  WHERE usuario_id = p_usuario_id AND status IN ('trial', 'ativo', 'cancelado', 'atrasado')
  ORDER BY criado_em DESC LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE assinaturas SET
      status = 'ativo', plano_id = v_plano_id, fim_periodo = now() + INTERVAL '100 years',
      trial_termina = CASE WHEN status = 'trial' THEN now() ELSE trial_termina END,
      cancelar_ao_fim_periodo = false, cancelado_em = NULL
    WHERE id = v_id;
  ELSE
    INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
    VALUES (p_usuario_id, v_plano_id, 'ativo', now(), now(), now() + INTERVAL '100 years');
  END IF;
END;
$$;

-- Estender: soma a partir de hoje se já venceu (antes podia continuar vencido).
CREATE OR REPLACE FUNCTION public.estender_periodo(p_assinatura_id UUID, p_dias INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
  IF p_dias IS NULL OR p_dias < 1 THEN
    RAISE EXCEPTION 'Informe ao menos 1 dia';
  END IF;

  UPDATE assinaturas SET
    fim_periodo = GREATEST(COALESCE(fim_periodo, now()), now()) + make_interval(days => p_dias),
    status = 'ativo',
    cancelar_ao_fim_periodo = false,
    cancelado_em = NULL
  WHERE id = p_assinatura_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reativar_assinatura(p_assinatura_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  UPDATE assinaturas
  SET status = 'ativo', cancelar_ao_fim_periodo = false, cancelado_em = NULL
  WHERE id = p_assinatura_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;
END;
$$;

-- Cancelar: para o usuário continua igual; o admin pode cancelar também
-- um período de teste.
CREATE OR REPLACE FUNCTION public.cancelar_assinatura(p_assinatura_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE assinaturas
  SET status = 'cancelado',
      cancelar_ao_fim_periodo = true,
      cancelado_em = now()
  WHERE id = p_assinatura_id
    AND (
      (status IN ('ativo', 'atrasado', 'cancelado') AND usuario_id = auth.uid())
      OR public.chamador_eh_admin_ou_servidor()
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Configurações: grava mesmo se a chave ainda não existir.
CREATE OR REPLACE FUNCTION public.save_configuracao(p_chave TEXT, p_valor TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  UPDATE configuracoes_globais SET valor = p_valor, atualizado_em = now() WHERE chave = p_chave;
  IF NOT FOUND THEN
    INSERT INTO configuracoes_globais (chave, valor, tipo, descricao)
    VALUES (p_chave, p_valor, 'texto', NULL);
  END IF;
END;
$$;
